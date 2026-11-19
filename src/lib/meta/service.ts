import { prisma } from "@/lib/prisma";
import {
  isMetaConfigured,
  metaSetupHints,
  META_SCOPES,
} from "@/lib/meta/config";
import {
  exchangeCodeForToken,
  exchangeLongLivedToken,
  fetchAdAccounts,
  fetchAds,
  fetchAdsets,
  fetchCampaigns,
  fetchInsights,
  fetchMe,
  MetaApiError,
  updateAdsetBudget,
  updateObjectStatus,
} from "@/lib/meta/client";
import {
  emptyMetrics,
  parseInsightsRow,
  resolveDateRange,
  sumMetrics,
} from "@/lib/meta/insights";
import {
  buildMockHierarchy,
  MOCK_ACCOUNTS,
  mockConnectionIds,
  mockSetBudget,
  mockSetStatus,
} from "@/lib/meta/mock-data";
import type {
  ConnectionStatus,
  DatePreset,
  HierarchyAd,
  HierarchyAdSet,
  HierarchyCampaign,
  HierarchyPayload,
  MetaAdAccountDto,
} from "@/lib/meta/types";

function toActId(id: string, accountId?: string): string {
  if (id.startsWith("act_")) return id;
  if (accountId) return `act_${accountId}`;
  return `act_${id}`;
}

function mapAccount(a: {
  id: string;
  actId: string;
  accountId: string;
  name: string;
  currency: string;
  accountStatus: number;
  isSelected: boolean;
}): MetaAdAccountDto {
  return {
    id: a.id,
    actId: a.actId,
    accountId: a.accountId,
    name: a.name,
    currency: a.currency,
    accountStatus: a.accountStatus,
    isSelected: a.isSelected,
  };
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const configured = isMetaConfigured();
  const conn = await prisma.metaConnection.findFirst({
    include: { accounts: { orderBy: { name: "asc" } } },
  });
  if (!conn) {
    return {
      configured,
      connected: false,
      mock: false,
      metaUserName: null,
      scopes: null,
      selectedAccount: null,
      accounts: [],
      setupHints: configured ? [] : metaSetupHints(),
    };
  }
  const accounts = conn.accounts.map(mapAccount);
  return {
    configured,
    connected: true,
    mock: conn.isMock,
    metaUserName: conn.metaUserName,
    scopes: conn.scopes,
    selectedAccount: accounts.find((a) => a.isSelected) || accounts[0] || null,
    accounts,
    setupHints: configured || conn.isMock ? [] : metaSetupHints(),
  };
}

export async function connectWithOAuthCode(code: string) {
  if (!isMetaConfigured()) {
    throw new Error("Meta no configurado: faltan META_APP_ID / META_APP_SECRET");
  }
  const short = await exchangeCodeForToken(code);
  let token = short.access_token;
  let expiresIn = short.expires_in;
  try {
    const long = await exchangeLongLivedToken(short.access_token);
    token = long.access_token;
    expiresIn = long.expires_in ?? expiresIn;
  } catch {
    /* keep short-lived if exchange fails */
  }
  const me = await fetchMe(token);
  const accounts = await fetchAdAccounts(token);

  await prisma.metaAdAccount.deleteMany({});
  await prisma.metaConnection.deleteMany({});

  const expiresAt =
    expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : null;

  const conn = await prisma.metaConnection.create({
    data: {
      metaUserId: me.id,
      metaUserName: me.name || null,
      accessToken: token,
      tokenExpiresAt: expiresAt,
      scopes: META_SCOPES.join(","),
      isMock: false,
      accounts: {
        create: accounts.map((a, i) => ({
          actId: toActId(a.id, a.account_id),
          accountId: a.account_id,
          name: a.name || a.account_id,
          currency: a.currency || "USD",
          accountStatus: a.account_status ?? 1,
          isSelected: i === 0,
        })),
      },
    },
    include: { accounts: true },
  });
  return conn;
}

export async function connectMock() {
  const ids = mockConnectionIds();
  await prisma.metaAdAccount.deleteMany({});
  await prisma.metaConnection.deleteMany({});
  return prisma.metaConnection.create({
    data: {
      metaUserId: ids.metaUserId,
      metaUserName: ids.metaUserName,
      accessToken: ids.accessToken,
      scopes: META_SCOPES.join(","),
      isMock: true,
      accounts: {
        create: MOCK_ACCOUNTS.map((a) => ({
          actId: a.actId,
          accountId: a.accountId,
          name: a.name,
          currency: a.currency,
          accountStatus: a.accountStatus,
          isSelected: a.isSelected,
        })),
      },
    },
    include: { accounts: true },
  });
}

export async function disconnectMeta() {
  await prisma.adsDailyReport.deleteMany({});
  await prisma.metaAdAccount.deleteMany({});
  await prisma.metaConnection.deleteMany({});
}

export async function selectAdAccount(actId: string) {
  const conn = await prisma.metaConnection.findFirst();
  if (!conn) throw new Error("Sin conexión Meta");
  const target = await prisma.metaAdAccount.findFirst({
    where: { connectionId: conn.id, actId },
  });
  if (!target) throw new Error("Cuenta no encontrada");
  await prisma.metaAdAccount.updateMany({
    where: { connectionId: conn.id },
    data: { isSelected: false },
  });
  await prisma.metaAdAccount.update({
    where: { id: target.id },
    data: { isSelected: true },
  });
  return mapAccount({ ...target, isSelected: true });
}

async function requireConnection() {
  const conn = await prisma.metaConnection.findFirst({
    include: { accounts: true },
  });
  if (!conn) throw new Error("Conectá Meta Ads primero");
  const selected =
    conn.accounts.find((a) => a.isSelected) || conn.accounts[0] || null;
  if (!selected) throw new Error("Seleccioná una cuenta publicitaria");
  return { conn, selected };
}

function minorToMajor(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function getHierarchy(
  preset: DatePreset,
  since?: string,
  until?: string
): Promise<HierarchyPayload> {
  const { conn, selected } = await requireConnection();
  const range = resolveDateRange(preset, since, until);

  if (conn.isMock) {
    return buildMockHierarchy(selected.actId, range.datePreset, range.since, range.until);
  }

  const token = conn.accessToken;
  const actId = selected.actId;

  try {
    const [campaignsRes, adsetsRes, adsRes, campIns, adsetIns, adIns] =
      await Promise.all([
        fetchCampaigns(token, actId),
        fetchAdsets(token, actId),
        fetchAds(token, actId),
        fetchInsights(token, actId, "campaign", range.since, range.until),
        fetchInsights(token, actId, "adset", range.since, range.until),
        fetchInsights(token, actId, "ad", range.since, range.until),
      ]);

    const campMap = new Map(
      (campIns.data || []).map((r) => [String(r.campaign_id), parseInsightsRow(r)])
    );
    const adsetMap = new Map(
      (adsetIns.data || []).map((r) => [String(r.adset_id), parseInsightsRow(r)])
    );
    const adMap = new Map(
      (adIns.data || []).map((r) => [String(r.ad_id), parseInsightsRow(r)])
    );

    const adsBySet = new Map<string, HierarchyAd[]>();
    for (const ad of adsRes.data || []) {
      const list = adsBySet.get(ad.adset_id) || [];
      list.push({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effective_status || ad.status,
        adsetId: ad.adset_id,
        campaignId: ad.campaign_id,
        creativeName: ad.creative?.name || null,
        thumbnailUrl: ad.creative?.thumbnail_url || null,
        metrics: adMap.get(ad.id) || emptyMetrics(),
      });
      adsBySet.set(ad.adset_id, list);
    }

    const setsByCamp = new Map<string, HierarchyAdSet[]>();
    for (const as of adsetsRes.data || []) {
      const list = setsByCamp.get(as.campaign_id) || [];
      list.push({
        id: as.id,
        name: as.name,
        status: as.status,
        effectiveStatus: as.effective_status || as.status,
        campaignId: as.campaign_id,
        dailyBudget: minorToMajor(as.daily_budget),
        lifetimeBudget: minorToMajor(as.lifetime_budget),
        metrics: adsetMap.get(as.id) || emptyMetrics(),
        ads: adsBySet.get(as.id) || [],
      });
      setsByCamp.set(as.campaign_id, list);
    }

    const campaigns: HierarchyCampaign[] = (campaignsRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      effectiveStatus: c.effective_status || c.status,
      objective: c.objective || null,
      dailyBudget: minorToMajor(c.daily_budget),
      lifetimeBudget: minorToMajor(c.lifetime_budget),
      metrics: campMap.get(c.id) || emptyMetrics(),
      adsets: setsByCamp.get(c.id) || [],
    }));

    return {
      actId,
      currency: selected.currency,
      datePreset: range.datePreset,
      since: range.since,
      until: range.until,
      totals: sumMetrics(campaigns.map((c) => c.metrics)),
      campaigns,
      mock: false,
    };
  } catch (e) {
    if (e instanceof MetaApiError && e.code === 190) {
      throw new Error("Token Meta expirado o inválido. Volvé a conectar la cuenta.");
    }
    throw e;
  }
}

export async function setObjectStatus(
  objectId: string,
  status: "ACTIVE" | "PAUSED"
) {
  const { conn } = await requireConnection();
  if (conn.isMock) {
    mockSetStatus(objectId, status);
    return { ok: true, mock: true };
  }
  await updateObjectStatus(conn.accessToken, objectId, status);
  return { ok: true, mock: false };
}

export async function setAdsetDailyBudget(
  adsetId: string,
  dailyBudgetMinor: number
) {
  const { conn } = await requireConnection();
  if (conn.isMock) {
    mockSetBudget(adsetId, dailyBudgetMinor);
    return { ok: true, mock: true };
  }
  await updateAdsetBudget(conn.accessToken, adsetId, dailyBudgetMinor);
  return { ok: true, mock: false };
}

/** Find object by id or partial name across hierarchy */
export async function findObjectInHierarchy(
  query: string,
  level?: "campaign" | "adset" | "ad"
) {
  const hierarchy = await getHierarchy("last_7d");
  const q = query.toLowerCase();
  for (const c of hierarchy.campaigns) {
    if ((!level || level === "campaign") && (c.id === query || c.name.toLowerCase().includes(q))) {
      return { level: "campaign" as const, object: c, currency: hierarchy.currency };
    }
    for (const as of c.adsets) {
      if ((!level || level === "adset") && (as.id === query || as.name.toLowerCase().includes(q))) {
        return { level: "adset" as const, object: as, currency: hierarchy.currency };
      }
      for (const ad of as.ads) {
        if ((!level || level === "ad") && (ad.id === query || ad.name.toLowerCase().includes(q))) {
          return { level: "ad" as const, object: ad, currency: hierarchy.currency };
        }
      }
    }
  }
  return null;
}
