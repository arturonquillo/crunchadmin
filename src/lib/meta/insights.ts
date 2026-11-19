import type { DatePreset, InsightsMetrics } from "@/lib/meta/types";

const empty: InsightsMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  reach: 0,
  ctr: null,
  cpc: null,
  cpa: null,
  cpaAction: null,
};

export function emptyMetrics(): InsightsMetrics {
  return { ...empty };
}

type ActionRow = { action_type?: string; value?: string };
type CostPerAction = { action_type?: string; value?: string };

const CPA_PREF = [
  "purchase",
  "omni_purchase",
  "lead",
  "complete_registration",
  "contact",
  "link_click",
];

export function parseInsightsRow(row: Record<string, unknown> | null | undefined): InsightsMetrics {
  if (!row) return emptyMetrics();
  const spend = Number(row.spend ?? 0) || 0;
  const impressions = Number(row.impressions ?? 0) || 0;
  const clicks = Number(row.clicks ?? 0) || 0;
  const reach = Number(row.reach ?? 0) || 0;
  const ctrRaw = row.ctr != null ? Number(row.ctr) : null;
  const cpcRaw = row.cpc != null ? Number(row.cpc) : null;

  let cpa: number | null = null;
  let cpaAction: string | null = null;
  const costs = (row.cost_per_action_type as CostPerAction[] | undefined) || [];
  for (const pref of CPA_PREF) {
    const hit = costs.find((c) => c.action_type === pref);
    if (hit?.value != null) {
      cpa = Number(hit.value);
      cpaAction = pref;
      break;
    }
  }
  if (cpa == null) {
    const actions = (row.actions as ActionRow[] | undefined) || [];
    for (const pref of CPA_PREF) {
      const hit = actions.find((a) => a.action_type === pref);
      const n = hit?.value != null ? Number(hit.value) : 0;
      if (n > 0 && spend > 0) {
        cpa = spend / n;
        cpaAction = pref;
        break;
      }
    }
  }

  return {
    spend,
    impressions,
    clicks,
    reach,
    ctr: ctrRaw != null && !Number.isNaN(ctrRaw) ? ctrRaw : impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: cpcRaw != null && !Number.isNaN(cpcRaw) ? cpcRaw : clicks > 0 ? spend / clicks : null,
    cpa,
    cpaAction,
  };
}

export function sumMetrics(rows: InsightsMetrics[]): InsightsMetrics {
  const out = emptyMetrics();
  let cpaSpend = 0;
  let cpaCount = 0;
  let cpaAction: string | null = null;
  for (const r of rows) {
    out.spend += r.spend;
    out.impressions += r.impressions;
    out.clicks += r.clicks;
    out.reach += r.reach;
    if (r.cpa != null && r.cpaAction) {
      // Recompute later from totals if same action — approximate by spend-weighted
      cpaSpend += r.spend;
      cpaCount += r.spend > 0 && r.cpa > 0 ? r.spend / r.cpa : 0;
      cpaAction = cpaAction || r.cpaAction;
    }
  }
  out.ctr = out.impressions > 0 ? (out.clicks / out.impressions) * 100 : null;
  out.cpc = out.clicks > 0 ? out.spend / out.clicks : null;
  if (cpaCount > 0) {
    out.cpa = cpaSpend / cpaCount;
    out.cpaAction = cpaAction;
  }
  return out;
}

export function resolveDateRange(
  preset: DatePreset,
  since?: string,
  until?: string
): { since: string; until: string; datePreset: DatePreset } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const untilDate = until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : iso(today);

  if (preset === "custom" && since && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return { since, until: untilDate, datePreset: "custom" };
  }

  if (preset === "today") {
    return { since: untilDate, until: untilDate, datePreset: "today" };
  }

  const days = preset === "last_30d" ? 29 : 6;
  const start = new Date(`${untilDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    since: iso(start),
    until: untilDate,
    datePreset: preset === "last_30d" ? "last_30d" : "last_7d",
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
