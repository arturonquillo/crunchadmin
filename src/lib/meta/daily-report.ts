import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/meta/insights";
import { getConnectionStatus, getHierarchy } from "@/lib/meta/service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function buildDailyReport(reportDate?: string) {
  const date = reportDate && /^\d{4}-\d{2}-\d{2}$/.test(reportDate)
    ? reportDate
    : todayIso();

  const status = await getConnectionStatus();
  if (!status.connected || !status.selectedAccount) {
    return {
      reportDate: date,
      bodyMarkdown:
        "## Reporte diario Ads\n\nNo hay cuenta Meta conectada. Andá a **Anuncios** y conectá (OAuth real o modo mock).",
      metrics: null,
      actId: null as string | null,
    };
  }

  const actId = status.selectedAccount.actId;
  const hierarchy = await getHierarchy("custom", date, date);
  const currency = hierarchy.currency;
  const t = hierarchy.totals;

  let pendientes: { title: string }[] = [];
  let producciones: { title: string }[] = [];
  let criticos: { name: string }[] = [];
  try {
    pendientes = await prisma.pendiente.findMany({
      where: { estado: { not: "HECHO" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { title: true },
    });
  } catch {
    /* schema drift / empty */
  }
  try {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    producciones = await prisma.produccion.findMany({
      where: { createdAt: { gte: start, lte: end } },
      take: 20,
      select: { title: true },
    });
  } catch {
    /* Produccion table may be db-push-only on some envs */
  }
  try {
    const lowInv = await prisma.insumo.findMany({ take: 40 });
    criticos = lowInv
      .filter((i) => i.minQty != null && i.quantityOnHand <= (i.minQty as number))
      .slice(0, 8)
      .map((i) => ({ name: i.name }));
  } catch {
    /* ignore */
  }

  const topCampaigns = [...hierarchy.campaigns]
    .sort((a, b) => b.metrics.spend - a.metrics.spend)
    .slice(0, 5);

  const lines: string[] = [
    `## Reporte diario Ads · ${date}`,
    "",
    status.mock
      ? "_Modo mock (sin META_APP_ID/SECRET o conexión demo)._"
      : `_Cuenta: ${status.selectedAccount.name} (${actId})_`,
    "",
    "### Meta Ads (día)",
    `- Gasto: **${formatMoney(t.spend, currency)}**`,
    `- Impresiones: **${t.impressions.toLocaleString("es")}** · Clics: **${t.clicks.toLocaleString("es")}**`,
    `- CTR: **${t.ctr != null ? `${t.ctr.toFixed(2)}%` : "—"}** · CPC: **${t.cpc != null ? formatMoney(t.cpc, currency) : "—"}**`,
    `- CPA (${t.cpaAction || "n/a"}): **${t.cpa != null ? formatMoney(t.cpa, currency) : "—"}**`,
    "",
    "#### Campañas por gasto",
    ...topCampaigns.map(
      (c) =>
        `- ${c.status === "ACTIVE" ? "🟢" : "⏸"} **${c.name}** — ${formatMoney(c.metrics.spend, currency)} · CTR ${c.metrics.ctr?.toFixed(2) ?? "—"}%`
    ),
    "",
    "### Ops del local (sketch)",
    `- Pendientes abiertos: **${pendientes.length}**${pendientes.length ? ` — ${pendientes.map((p) => p.title).join("; ")}` : ""}`,
    `- Producciones del día: **${producciones.length}**${producciones.length ? ` — ${producciones.map((p) => p.title).join("; ")}` : ""}`,
    `- Insumos en/ bajo mínimo: **${criticos.length}**${criticos.length ? ` — ${criticos.map((i) => i.name).join("; ")}` : ""}`,
    "",
    "### Ventas / caja",
    "_Aún no hay POS integrado. Cuando exista caja, este bloque sumará ventas del día y ROAS (ventas ÷ gasto Ads)._",
    "",
    "### Notas",
    "- Pausá creativos con CTR flojo o CPC alto vía Hablar («pausá el anuncio X») o desde Anuncios.",
    "- Re-conectá Meta si el token expiró (~60 días en long-lived).",
  ];

  const bodyMarkdown = lines.join("\n");
  const metricsJson = JSON.stringify({
    spend: t.spend,
    impressions: t.impressions,
    clicks: t.clicks,
    ctr: t.ctr,
    cpc: t.cpc,
    cpa: t.cpa,
    cpaAction: t.cpaAction,
    currency,
    mock: hierarchy.mock,
    pendientesOpen: pendientes.length,
    produccionesDay: producciones.length,
    inventoryCritical: criticos.length,
  });

  await prisma.adsDailyReport.upsert({
    where: { actId_reportDate: { actId, reportDate: date } },
    create: { actId, reportDate: date, bodyMarkdown, metricsJson },
    update: { bodyMarkdown, metricsJson },
  });

  return {
    reportDate: date,
    bodyMarkdown,
    metrics: JSON.parse(metricsJson),
    actId,
  };
}
