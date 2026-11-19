import { createHmac, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { emptyMetrics, parseInsightsRow, resolveDateRange, sumMetrics } from "@/lib/meta/insights";
import type {
  DatePreset,
  HierarchyCampaign,
  HierarchyPayload,
  InsightsMetrics,
  MetaAdAccountDto,
} from "@/lib/meta/types";

const STORE = path.join("/tmp", "crunchadmin-meta-mock.json");

type MockStore = {
  statuses: Record<string, string>;
  budgets: Record<string, number>;
};

function loadStore(): MockStore {
  try {
    if (!existsSync(STORE)) return { statuses: {}, budgets: {} };
    return JSON.parse(readFileSync(STORE, "utf8")) as MockStore;
  } catch {
    return { statuses: {}, budgets: {} };
  }
}

function saveStore(s: MockStore) {
  mkdirSync(path.dirname(STORE), { recursive: true });
  writeFileSync(STORE, JSON.stringify(s, null, 2));
}

export const MOCK_ACCOUNTS: MetaAdAccountDto[] = [
  {
    id: "mock-acc-1",
    actId: "act_9001001",
    accountId: "9001001",
    name: "Le Crunch — Delivery",
    currency: "BRL",
    accountStatus: 1,
    isSelected: true,
  },
  {
    id: "mock-acc-2",
    actId: "act_9001002",
    accountId: "9001002",
    name: "Le Crunch — Awareness",
    currency: "BRL",
    accountStatus: 1,
    isSelected: false,
  },
];

type SeedObj = {
  campaigns: {
    id: string;
    name: string;
    status: string;
    objective: string;
    adsets: {
      id: string;
      name: string;
      status: string;
      dailyBudget: number;
      ads: { id: string; name: string; status: string; creativeName: string }[];
    }[];
  }[];
};

const SEED: SeedObj = {
  campaigns: [
    {
      id: "23890001",
      name: "Delivery · Almuerzo",
      status: "ACTIVE",
      objective: "OUTCOME_SALES",
      adsets: [
        {
          id: "23890011",
          name: "Radio 3 km · 18–45",
          status: "ACTIVE",
          dailyBudget: 8000,
          ads: [
            {
              id: "23890021",
              name: "Burger combo video",
              status: "ACTIVE",
              creativeName: "Combo almuerzo v3",
            },
            {
              id: "23890022",
              name: "Carrusel menú",
              status: "PAUSED",
              creativeName: "Menú carrusel",
            },
          ],
        },
        {
          id: "23890012",
          name: "Retargeting 7d site",
          status: "ACTIVE",
          dailyBudget: 4500,
          ads: [
            {
              id: "23890023",
              name: "Última chance 10%",
              status: "ACTIVE",
              creativeName: "Promo 10%",
            },
          ],
        },
      ],
    },
    {
      id: "23890002",
      name: "Tráfico · Instagram",
      status: "PAUSED",
      objective: "OUTCOME_TRAFFIC",
      adsets: [
        {
          id: "23890013",
          name: "Lookalike fans",
          status: "PAUSED",
          dailyBudget: 3000,
          ads: [
            {
              id: "23890024",
              name: "Story cocina",
              status: "PAUSED",
              creativeName: "Story behind the pass",
            },
          ],
        },
      ],
    },
  ],
};

function dayHash(id: string, day: string): number {
  const h = createHmac("sha256", "crunchadmin-mock-insights")
    .update(`${id}:${day}`)
    .digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

function metricsFor(id: string, since: string, until: string, status: string): InsightsMetrics {
  if (status === "PAUSED" || status === "DELETED") {
    const soft = emptyMetrics();
    soft.impressions = Math.floor(dayHash(id, since) * 40);
    soft.clicks = Math.floor(soft.impressions * 0.02);
    soft.spend = Number((soft.clicks * 0.4).toFixed(2));
    soft.ctr = soft.impressions ? (soft.clicks / soft.impressions) * 100 : null;
    soft.cpc = soft.clicks ? soft.spend / soft.clicks : null;
    return soft;
  }
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let reach = 0;
  const start = new Date(`${since}T12:00:00Z`);
  const end = new Date(`${until}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const r = dayHash(id, key);
    const dayImp = Math.floor(80 + r * 420);
    const dayClicks = Math.floor(dayImp * (0.015 + r * 0.04));
    const daySpend = Number((dayClicks * (0.35 + r * 0.9)).toFixed(2));
    impressions += dayImp;
    clicks += dayClicks;
    spend += daySpend;
    reach += Math.floor(dayImp * 0.7);
  }
  spend = Number(spend.toFixed(2));
  const purchases = Math.max(1, Math.floor(clicks * 0.08));
  return parseInsightsRow({
    spend: String(spend),
    impressions: String(impressions),
    clicks: String(clicks),
    reach: String(reach),
    actions: [{ action_type: "purchase", value: String(purchases) }],
    cost_per_action_type: [
      { action_type: "purchase", value: String(Number((spend / purchases).toFixed(2))) },
    ],
  });
}

function statusOf(id: string, fallback: string): string {
  const s = loadStore();
  return s.statuses[id] || fallback;
}

function budgetOf(id: string, fallback: number): number {
  const s = loadStore();
  return s.budgets[id] ?? fallback;
}

export function mockSetStatus(objectId: string, status: "ACTIVE" | "PAUSED"): void {
  const s = loadStore();
  s.statuses[objectId] = status;
  saveStore(s);
}

export function mockSetBudget(adsetId: string, dailyBudgetMinor: number): void {
  const s = loadStore();
  s.budgets[adsetId] = dailyBudgetMinor;
  saveStore(s);
}

export function buildMockHierarchy(
  actId: string,
  preset: DatePreset,
  since?: string,
  until?: string
): HierarchyPayload {
  const range = resolveDateRange(preset, since, until);
  const currency =
    MOCK_ACCOUNTS.find((a) => a.actId === actId)?.currency ||
    MOCK_ACCOUNTS[0].currency;

  const campaigns: HierarchyCampaign[] = SEED.campaigns.map((c) => {
    const cStatus = statusOf(c.id, c.status);
    const adsets = c.adsets.map((as) => {
      const asStatus = statusOf(as.id, as.status);
      const ads = as.ads.map((ad) => {
        const adStatus = statusOf(ad.id, ad.status);
        return {
          id: ad.id,
          name: ad.name,
          status: adStatus,
          effectiveStatus: adStatus,
          adsetId: as.id,
          campaignId: c.id,
          creativeName: ad.creativeName,
          thumbnailUrl: null,
          metrics: metricsFor(ad.id, range.since, range.until, adStatus),
        };
      });
      const asMetrics = sumMetrics(ads.map((a) => a.metrics));
      return {
        id: as.id,
        name: as.name,
        status: asStatus,
        effectiveStatus: asStatus,
        campaignId: c.id,
        dailyBudget: budgetOf(as.id, as.dailyBudget),
        lifetimeBudget: null,
        metrics: asMetrics,
        ads,
      };
    });
    return {
      id: c.id,
      name: c.name,
      status: cStatus,
      effectiveStatus: cStatus,
      objective: c.objective,
      dailyBudget: null,
      lifetimeBudget: null,
      metrics: sumMetrics(adsets.map((a) => a.metrics)),
      adsets,
    };
  });

  return {
    actId,
    currency,
    datePreset: range.datePreset,
    since: range.since,
    until: range.until,
    totals: sumMetrics(campaigns.map((c) => c.metrics)),
    campaigns,
    mock: true,
  };
}

export function mockConnectionIds() {
  return {
    metaUserId: "mock-meta-user",
    metaUserName: "Dueño demo (mock)",
    accessToken: `mock_${randomBytes(8).toString("hex")}`,
  };
}
