import { createPendingAction } from "@/lib/assistant/confirm-store";
import { logMutation } from "@/lib/assistant/mutation-log";
import { formatMoney } from "@/lib/meta/insights";
import { buildDailyReport } from "@/lib/meta/daily-report";
import {
  findObjectInHierarchy,
  getConnectionStatus,
  getHierarchy,
  selectAdAccount,
  setAdsetDailyBudget,
  setObjectStatus,
} from "@/lib/meta/service";
import type { DatePreset } from "@/lib/meta/types";

type ToolResult = {
  ok: boolean;
  needsConfirm?: boolean;
  confirmCode?: string;
  summary: string;
  data?: unknown;
};

function presetOf(raw?: unknown): DatePreset {
  const v = String(raw || "last_7d");
  if (v === "today" || v === "last_30d" || v === "last_7d") return v;
  return "last_7d";
}

export async function adsConnectionStatus(): Promise<ToolResult> {
  const s = await getConnectionStatus();
  if (!s.connected) {
    return {
      ok: true,
      summary: s.configured
        ? "Meta App configurada pero sin sesión. Pedile al dueño conectar en Anuncios (OAuth)."
        : `Sin META_APP_ID/SECRET. Puede usar mock desde Anuncios. Hints: ${s.setupHints.slice(0, 2).join(" · ")}`,
      data: s,
    };
  }
  return {
    ok: true,
    summary: `Conectado${s.mock ? " (MOCK)" : ""} como ${s.metaUserName || "usuario Meta"}. Cuenta: ${
      s.selectedAccount?.name || "ninguna"
    } (${s.selectedAccount?.actId || "—"}). Cuentas: ${s.accounts.length}.`,
    data: s,
  };
}

export async function adsListAccounts(): Promise<ToolResult> {
  const s = await getConnectionStatus();
  if (!s.connected) {
    return { ok: false, summary: "No hay conexión Meta. Conectá en /ads." };
  }
  const lines = s.accounts.map(
    (a) =>
      `${a.isSelected ? "→ " : "  "}${a.name} (${a.actId}) ${a.currency} status=${a.accountStatus}`
  );
  return {
    ok: true,
    summary: `Cuentas (${s.mock ? "mock" : "live"}):\n${lines.join("\n")}`,
    data: s.accounts,
  };
}

export async function adsSelectAccount(args: {
  actId?: string;
  nameQuery?: string;
}): Promise<ToolResult> {
  const s = await getConnectionStatus();
  if (!s.connected) return { ok: false, summary: "Sin conexión Meta." };
  let actId = String(args.actId || "").trim();
  if (!actId && args.nameQuery) {
    const q = args.nameQuery.toLowerCase();
    const hit = s.accounts.find(
      (a) => a.name.toLowerCase().includes(q) || a.actId.includes(q)
    );
    if (!hit) return { ok: false, summary: `No encontré cuenta «${args.nameQuery}».` };
    actId = hit.actId;
  }
  if (!actId) return { ok: false, summary: "Indicá actId o nameQuery." };
  const selected = await selectAdAccount(actId);
  const summary = `Cuenta seleccionada: ${selected.name} (${selected.actId}).`;
  logMutation({ tool: "ads_select_account", ok: true, summary });
  return { ok: true, summary, data: selected };
}

export async function adsListHierarchy(args: {
  datePreset?: string;
}): Promise<ToolResult> {
  try {
    const h = await getHierarchy(presetOf(args.datePreset));
    const lines: string[] = [
      `${h.mock ? "[MOCK] " : ""}Cuenta ${h.actId} · ${h.since}→${h.until} · gasto ${formatMoney(h.totals.spend, h.currency)}`,
    ];
    for (const c of h.campaigns) {
      lines.push(
        `- Campaña ${c.status} «${c.name}» spend=${formatMoney(c.metrics.spend, h.currency)} CTR=${c.metrics.ctr?.toFixed(2) ?? "—"}%`
      );
      for (const as of c.adsets) {
        lines.push(
          `  · Ad set ${as.status} «${as.name}» (${as.id}) spend=${formatMoney(as.metrics.spend, h.currency)}`
        );
        for (const ad of as.ads) {
          lines.push(
            `    · Ad ${ad.status} «${ad.name}» CTR=${ad.metrics.ctr?.toFixed(2) ?? "—"}%`
          );
        }
      }
    }
    return { ok: true, summary: lines.join("\n"), data: { totals: h.totals, count: h.campaigns.length } };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : "Error Ads" };
  }
}

export async function adsInsights(args: { datePreset?: string }): Promise<ToolResult> {
  try {
    const h = await getHierarchy(presetOf(args.datePreset));
    const t = h.totals;
    const summary = `${h.mock ? "[MOCK] " : ""}Insights ${h.since}→${h.until}: gasto ${formatMoney(
      t.spend,
      h.currency
    )}, impresiones ${t.impressions}, clics ${t.clicks}, CTR ${
      t.ctr?.toFixed(2) ?? "—"
    }%, CPC ${t.cpc != null ? formatMoney(t.cpc, h.currency) : "—"}, CPA ${
      t.cpa != null ? `${formatMoney(t.cpa, h.currency)} (${t.cpaAction})` : "—"
    }.`;
    return { ok: true, summary, data: t };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : "Error insights" };
  }
}

export async function adsSetStatus(args: {
  objectId?: string;
  nameQuery?: string;
  level?: string;
  status?: string;
}): Promise<ToolResult> {
  const status = String(args.status || "").toUpperCase();
  if (status !== "ACTIVE" && status !== "PAUSED") {
    return { ok: false, summary: "status debe ser ACTIVE o PAUSED." };
  }
  let objectId = String(args.objectId || "").trim();
  let label = objectId;
  const level = args.level as "campaign" | "adset" | "ad" | undefined;
  if (!objectId && args.nameQuery) {
    const hit = await findObjectInHierarchy(args.nameQuery, level);
    if (!hit) return { ok: false, summary: `No encontré «${args.nameQuery}».` };
    objectId = hit.object.id;
    label = hit.object.name;
  }
  if (!objectId) return { ok: false, summary: "Indicá objectId o nameQuery." };

  const pending = createPendingAction({
    kind: "ads_set_status",
    summary: `${status === "PAUSED" ? "Pausar" : "Activar"} «${label}» (${objectId})`,
    payload: { objectId, status, label },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Para confirmar, respondé con: CONFIRMAR ${pending.code}`,
  };
}

export async function adsSetBudget(args: {
  adsetId?: string;
  nameQuery?: string;
  dailyBudgetMinor?: number;
}): Promise<ToolResult> {
  const dailyBudgetMinor = Number(args.dailyBudgetMinor);
  if (!(dailyBudgetMinor > 0)) {
    return { ok: false, summary: "dailyBudgetMinor debe ser > 0 (centavos)." };
  }
  let adsetId = String(args.adsetId || "").trim();
  let label = adsetId;
  if (!adsetId && args.nameQuery) {
    const hit = await findObjectInHierarchy(args.nameQuery, "adset");
    if (!hit || hit.level !== "adset") {
      return { ok: false, summary: `No encontré ad set «${args.nameQuery}».` };
    }
    adsetId = hit.object.id;
    label = hit.object.name;
  }
  if (!adsetId) return { ok: false, summary: "Indicá adsetId o nameQuery." };

  const pending = createPendingAction({
    kind: "ads_set_budget",
    summary: `Presupuesto diario de «${label}» → ${dailyBudgetMinor} (minor units)`,
    payload: { adsetId, dailyBudgetMinor, label },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Para confirmar, respondé con: CONFIRMAR ${pending.code}`,
  };
}

export async function adsDailyReportTool(args: { date?: string }): Promise<ToolResult> {
  try {
    const report = await buildDailyReport(args.date);
    return {
      ok: true,
      summary: report.bodyMarkdown,
      data: report.metrics,
    };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : "Error reporte" };
  }
}

export async function confirmAdsSetStatus(payload: Record<string, unknown>): Promise<ToolResult> {
  const objectId = String(payload.objectId);
  const status = String(payload.status).toUpperCase() as "ACTIVE" | "PAUSED";
  await setObjectStatus(objectId, status);
  const summary = `${status === "PAUSED" ? "Pausé" : "Activé"} «${payload.label || objectId}».`;
  logMutation({ tool: "ads_set_status:confirmed", ok: true, summary });
  return { ok: true, summary };
}

export async function confirmAdsSetBudget(payload: Record<string, unknown>): Promise<ToolResult> {
  const adsetId = String(payload.adsetId);
  const dailyBudgetMinor = Number(payload.dailyBudgetMinor);
  await setAdsetDailyBudget(adsetId, dailyBudgetMinor);
  const summary = `Presupuesto diario de «${payload.label || adsetId}» actualizado a ${dailyBudgetMinor} (minor).`;
  logMutation({ tool: "ads_set_budget:confirmed", ok: true, summary });
  return { ok: true, summary };
}
