import {
  getGraphApiVersion,
  getMetaAppId,
  getMetaAppSecret,
  getMetaRedirectUri,
} from "@/lib/meta/config";

const GRAPH = () => `https://graph.facebook.com/${getGraphApiVersion()}`;

export class MetaApiError extends Error {
  status: number;
  code?: number;
  raw: unknown;
  constructor(message: string, status: number, raw: unknown, code?: number) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.raw = raw;
    this.code = code;
  }
}

async function graphFetch<T>(
  pathAndQuery: string,
  init?: RequestInit & { accessToken?: string }
): Promise<T> {
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${GRAPH()}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const headers = new Headers(init?.headers);
  if (init?.accessToken) {
    // Prefer Authorization header; also append if missing access_token in URL
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    throw new MetaApiError(
      json.error?.message || `Meta Graph error ${res.status}`,
      res.status,
      json,
      json.error?.code
    );
  }
  return json as T;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const appId = getMetaAppId();
  const secret = getMetaAppSecret();
  if (!appId || !secret) throw new Error("Meta no configurado");
  const qs = new URLSearchParams({
    client_id: appId,
    client_secret: secret,
    redirect_uri: getMetaRedirectUri(),
    code,
  });
  return graphFetch(`/oauth/access_token?${qs}`);
}

export async function exchangeLongLivedToken(shortToken: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const appId = getMetaAppId();
  const secret = getMetaAppSecret();
  if (!appId || !secret) throw new Error("Meta no configurado");
  const qs = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: secret,
    fb_exchange_token: shortToken,
  });
  return graphFetch(`/oauth/access_token?${qs}`);
}

export async function fetchMe(accessToken: string): Promise<{
  id: string;
  name?: string;
}> {
  return graphFetch("/me?fields=id,name", { accessToken });
}

export type GraphAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  account_status?: number;
};

export async function fetchAdAccounts(accessToken: string): Promise<GraphAdAccount[]> {
  const out: GraphAdAccount[] = [];
  let url: string | null =
    "/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=50";
  while (url) {
    const page: {
      data?: GraphAdAccount[];
      paging?: { next?: string };
    } = await graphFetch(url, { accessToken });
    out.push(...(page.data || []));
    url = page.paging?.next || null;
  }
  return out;
}

export async function fetchCampaigns(accessToken: string, actId: string) {
  return graphFetch<{
    data: {
      id: string;
      name: string;
      status: string;
      effective_status?: string;
      objective?: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }[];
  }>(
    `/${actId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=100`,
    { accessToken }
  );
}

export async function fetchAdsets(accessToken: string, actId: string) {
  return graphFetch<{
    data: {
      id: string;
      name: string;
      campaign_id: string;
      status: string;
      effective_status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }[];
  }>(
    `/${actId}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget&limit=200`,
    { accessToken }
  );
}

export async function fetchAds(accessToken: string, actId: string) {
  return graphFetch<{
    data: {
      id: string;
      name: string;
      adset_id: string;
      campaign_id: string;
      status: string;
      effective_status?: string;
      creative?: { id?: string; name?: string; thumbnail_url?: string };
    }[];
  }>(
    `/${actId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url}&limit=200`,
    { accessToken }
  );
}

export async function fetchInsights(
  accessToken: string,
  actId: string,
  level: "campaign" | "adset" | "ad" | "account",
  since: string,
  until: string
) {
  const fields =
    "campaign_id,adset_id,ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,cost_per_action_type";
  const qs = new URLSearchParams({
    level: level === "account" ? "account" : level,
    fields,
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  });
  return graphFetch<{ data: Record<string, unknown>[] }>(
    `/${actId}/insights?${qs}`,
    { accessToken }
  );
}

export async function updateObjectStatus(
  accessToken: string,
  objectId: string,
  status: "ACTIVE" | "PAUSED"
) {
  const body = new URLSearchParams({ status });
  return graphFetch(`/${objectId}`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function updateAdsetBudget(
  accessToken: string,
  adsetId: string,
  dailyBudgetMinor: number
) {
  const body = new URLSearchParams({
    daily_budget: String(Math.round(dailyBudgetMinor)),
  });
  return graphFetch(`/${adsetId}`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export function oauthDialogUrl(state: string): string {
  const appId = getMetaAppId();
  if (!appId) throw new Error("META_APP_ID missing");
  const qs = new URLSearchParams({
    client_id: appId,
    redirect_uri: getMetaRedirectUri(),
    state,
    response_type: "code",
    scope: "ads_read,ads_management",
  });
  return `https://www.facebook.com/${getGraphApiVersion()}/dialog/oauth?${qs}`;
}
