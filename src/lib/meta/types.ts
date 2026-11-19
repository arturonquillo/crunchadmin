export type DatePreset = "today" | "last_7d" | "last_30d" | "custom";

export type AdObjectStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | string;

export type InsightsMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  cpaAction: string | null;
};

export type MetaAdAccountDto = {
  id: string;
  actId: string;
  accountId: string;
  name: string;
  currency: string;
  accountStatus: number;
  isSelected: boolean;
};

export type HierarchyAd = {
  id: string;
  name: string;
  status: AdObjectStatus;
  effectiveStatus: string;
  adsetId: string;
  campaignId: string;
  creativeName?: string | null;
  thumbnailUrl?: string | null;
  metrics: InsightsMetrics;
};

export type HierarchyAdSet = {
  id: string;
  name: string;
  status: AdObjectStatus;
  effectiveStatus: string;
  campaignId: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  metrics: InsightsMetrics;
  ads: HierarchyAd[];
};

export type HierarchyCampaign = {
  id: string;
  name: string;
  status: AdObjectStatus;
  effectiveStatus: string;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  metrics: InsightsMetrics;
  adsets: HierarchyAdSet[];
};

export type HierarchyPayload = {
  actId: string;
  currency: string;
  datePreset: DatePreset;
  since: string;
  until: string;
  totals: InsightsMetrics;
  campaigns: HierarchyCampaign[];
  mock: boolean;
};

export type ConnectionStatus = {
  configured: boolean;
  connected: boolean;
  mock: boolean;
  metaUserName: string | null;
  scopes: string | null;
  selectedAccount: MetaAdAccountDto | null;
  accounts: MetaAdAccountDto[];
  setupHints: string[];
};
