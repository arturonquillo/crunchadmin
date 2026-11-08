import { prisma, runWithPrisma } from "@/lib/prisma";
import { matchInsumoName, toBaseQty } from "@/lib/chat-inventory";
import { formatQty, packFillPercent, stockStatus } from "@/lib/inventory";
import { previewProduction } from "@/lib/production";
import { createPendingAction } from "@/lib/assistant/confirm-store";
import { logMutation } from "@/lib/assistant/mutation-log";
import { ZONE_IDS, type RestaurantZone } from "@/lib/zones";
import type { InsumoCategoria } from "@/lib/labels";

export type ToolResult = {
  ok: boolean;
  needsConfirm?: boolean;
  confirmCode?: string;
  summary: string;
  data?: unknown;
  /** Tool name — used by Hablar widgets */
  tool?: string;
};

function guessCategory(name: string, unit: string): InsumoCategoria {
  const n = name.toLowerCase();
  if (/harina|arroz|azúcar|azucar|sal|mostaza|vinagre|fideo/.test(n)) return "SECOS";
  if (/aceite|grasa|manteca/.test(n)) return "ACEITES";
  if (/frango|pollo|carne|res|cerdo/.test(n)) return "CARNES";
  if (/leche|yema|huevo|crema|queso/.test(n)) return "LACTEOS";
  if (/pimienta|pimentón|pimenton|vainilla|oregano|ajo en polvo/.test(n))
    return "ESPECIAS";
  if (/papa|limón|limon|tomate|cebolla|ajo\b|lechuga/.test(n)) return "FRESCOS";
  if (unit === "L" || unit === "ml") return "ACEITES";
  return "OTROS";
}

function normZone(z?: string): RestaurantZone {
  if (!z) return "oficina";
  const v = z.trim().toLowerCase().replace("ñ", "n");
  if (v.includes("salon") || v.includes("salón")) return "salon";
  if (v.includes("cocin")) return "cocina";
  if (v.includes("barr")) return "barra";
  if (v.includes("ban") || v.includes("baño")) return "bano";
  if (v.includes("exter") || v.includes("terraza")) return "exterior";
  if (v.includes("entrad") || v.includes("pared")) return "pared_entrada";
  if (ZONE_IDS.includes(v as RestaurantZone)) return v as RestaurantZone;
  return "oficina";
}

async function inventoryAddStock(args: {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
}): Promise<ToolResult> {
  const name = String(args.name || "").trim();
  const quantity = Number(args.quantity);
  const unit = String(args.unit || "kg").trim();
  if (!name || !(quantity > 0)) {
    return { ok: false, summary: "Nombre y cantidad > 0 son obligatorios." };
  }

  const all = await prisma.insumo.findMany();
  let item = matchInsumoName(all, name);

  if (!item) {
    const category = (args.category as InsumoCategoria) || guessCategory(name, unit);
    item = await prisma.insumo.create({
      data: {
        name,
        baseUnit: unit,
        category,
        quantityOnHand: 0,
        packSize: quantity > 0 ? quantity : null,
        minQty: null,
      },
    });
    logMutation({
      tool: "inventory_add_stock",
      ok: true,
      summary: `Creado insumo ${name}`,
      detail: { id: item.id, category },
    });
  }

  const converted = toBaseQty(quantity, unit, item.baseUnit);
  if (!converted.ok) {
    return { ok: false, summary: converted.error };
  }

  const before = item.quantityOnHand;
  const after = Math.round((before + converted.quantity) * 10000) / 10000;
  await prisma.insumo.update({
    where: { id: item.id },
    data: { quantityOnHand: after },
  });
  await prisma.inventoryMovement.create({
    data: {
      insumoId: item.id,
      kind: "CHAT",
      delta: converted.quantity,
      note: `assistant inventory_add_stock +${quantity} ${unit}`,
    },
  });

  const summary = `Sumé ${formatQty(converted.quantity, item.baseUnit)} a «${item.name}». Stock: ${formatQty(before, item.baseUnit)} → ${formatQty(after, item.baseUnit)}.`;
  logMutation({ tool: "inventory_add_stock", ok: true, summary });
  return { ok: true, summary, data: { id: item.id, before, after } };
}

async function inventorySetStock(args: {
  name: string;
  quantity: number;
  unit: string;
}): Promise<ToolResult> {
  const name = String(args.name || "").trim();
  const quantity = Number(args.quantity);
  const unit = String(args.unit || "kg").trim();
  const all = await prisma.insumo.findMany();
  const item = matchInsumoName(all, name);
  if (!item) {
    return {
      ok: false,
      summary: `No encontré «${name}». Usá inventory_add_stock para crearlo.`,
    };
  }
  const converted = toBaseQty(quantity, unit, item.baseUnit);
  if (!converted.ok) return { ok: false, summary: converted.error };

  const before = item.quantityOnHand;
  const after = converted.quantity;
  const delta = Math.round((after - before) * 10000) / 10000;
  await prisma.insumo.update({
    where: { id: item.id },
    data: { quantityOnHand: after },
  });
  await prisma.inventoryMovement.create({
    data: {
      insumoId: item.id,
      kind: "CHAT",
      delta,
      note: `assistant inventory_set_stock → ${after}`,
    },
  });
  const summary = `Stock de «${item.name}» = ${formatQty(after, item.baseUnit)} (antes ${formatQty(before, item.baseUnit)}).`;
  logMutation({ tool: "inventory_set_stock", ok: true, summary });
  return { ok: true, summary };
}

async function inventoryListLow(): Promise<ToolResult> {
  const items = await prisma.insumo.findMany({ orderBy: { name: "asc" } });
  const low = items
    .map((i) => {
      const st = stockStatus({
        onHand: i.quantityOnHand,
        packSize: i.packSize,
        minQty: i.minQty,
      });
      const fill = packFillPercent(i.quantityOnHand, i.packSize);
      return { i, st, fill };
    })
    .filter((x) => x.st === "reorder" || x.st === "critical");

  if (low.length === 0) {
    return { ok: true, summary: "Ningún insumo en Reponer/Crítico." };
  }
  const lines = low.map(
    ({ i, st, fill }) =>
      `• ${i.name}: ${formatQty(i.quantityOnHand, i.baseUnit)}${fill != null ? ` (${fill}%)` : ""} [${st}]`
  );
  return { ok: true, summary: `Bajo stock (${low.length}):\n${lines.join("\n")}` };
}

async function inventoryDelete(args: { name: string }): Promise<ToolResult> {
  const all = await prisma.insumo.findMany();
  const item = matchInsumoName(all, args.name);
  if (!item) return { ok: false, summary: `No encontré insumo «${args.name}».` };

  const pending = createPendingAction({
    kind: "inventory_delete",
    summary: `Eliminar insumo «${item.name}»`,
    payload: { insumoId: item.id, name: item.name },
  });
  logMutation({
    tool: "inventory_delete",
    ok: true,
    summary: `Pending confirm ${pending.code}`,
    detail: { name: item.name },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Acción pendiente: eliminar «${item.name}». Para confirmar, respondé: CONFIRMAR ${pending.code}`,
  };
}

async function inventoryClearAll(args: { reason?: string }): Promise<ToolResult> {
  const count = await prisma.insumo.count();
  const pending = createPendingAction({
    kind: "inventory_clear_all",
    summary: `Borrar los ${count} insumos del inventario`,
    payload: { reason: args.reason || null, count },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Acción pendiente: borrar TODOS los insumos (${count}). Para confirmar, respondé: CONFIRMAR ${pending.code}`,
  };
}

async function pendienteCreate(args: {
  title: string;
  description?: string;
  categoria?: string;
  prioridad?: string;
  zone?: string;
}): Promise<ToolResult> {
  const title = String(args.title || "").trim();
  if (!title) return { ok: false, summary: "Falta el título." };
  const item = await prisma.pendiente.create({
    data: {
      title,
      description: args.description || null,
      categoria: args.categoria || "MEJORAS_FISICAS",
      prioridad: args.prioridad || "MEDIA",
      estado: "PENDIENTE",
      zone: normZone(args.zone),
    },
  });
  const summary = `Pendiente creado: «${item.title}» · zona ${item.zone} · ${item.prioridad}.`;
  logMutation({ tool: "pendiente_create", ok: true, summary, detail: { id: item.id } });
  return { ok: true, summary, data: { id: item.id } };
}

async function pendienteUpdateStatus(args: {
  titleQuery?: string;
  id?: string;
  estado: string;
}): Promise<ToolResult> {
  const estado = String(args.estado || "").toUpperCase();
  if (!["PENDIENTE", "EN_CURSO", "HECHO"].includes(estado)) {
    return { ok: false, summary: "Estado inválido." };
  }
  let item = args.id
    ? await prisma.pendiente.findUnique({ where: { id: args.id } })
    : null;
  if (!item && args.titleQuery) {
    const q = args.titleQuery.toLowerCase();
    const all = await prisma.pendiente.findMany({
      where: { estado: { not: "HECHO" } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    item = all.find((p) => p.title.toLowerCase().includes(q)) || null;
  }
  if (!item) return { ok: false, summary: "No encontré ese pendiente." };
  await prisma.pendiente.update({
    where: { id: item.id },
    data: { estado },
  });
  const summary = `Pendiente «${item.title}» → ${estado}.`;
  logMutation({ tool: "pendiente_update_status", ok: true, summary });
  return { ok: true, summary };
}

async function pendienteList(args: {
  zone?: string;
  categoria?: string;
}): Promise<ToolResult> {
  const items = await prisma.pendiente.findMany({
    where: {
      estado: { not: "HECHO" },
      ...(args.zone ? { zone: normZone(args.zone) } : {}),
      ...(args.categoria ? { categoria: args.categoria } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  if (items.length === 0) return { ok: true, summary: "No hay pendientes abiertos." };
  const lines = items.map(
    (p) => `• [${p.estado}] ${p.title} (${p.zone}, ${p.prioridad})`
  );
  return { ok: true, summary: `Pendientes (${items.length}):\n${lines.join("\n")}` };
}

async function pendienteDelete(args: {
  titleQuery?: string;
  id?: string;
}): Promise<ToolResult> {
  let item = args.id
    ? await prisma.pendiente.findUnique({ where: { id: args.id } })
    : null;
  if (!item && args.titleQuery) {
    const q = args.titleQuery.toLowerCase();
    const all = await prisma.pendiente.findMany({ take: 80, orderBy: { updatedAt: "desc" } });
    item = all.find((p) => p.title.toLowerCase().includes(q)) || null;
  }
  if (!item) return { ok: false, summary: "No encontré el pendiente a borrar." };

  const pending = createPendingAction({
    kind: "pendiente_delete",
    summary: `Eliminar pendiente «${item.title}»`,
    payload: { pendienteId: item.id, title: item.title },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Acción pendiente: eliminar «${item.title}». Para confirmar, respondé: CONFIRMAR ${pending.code}`,
  };
}

async function recetaList(): Promise<ToolResult> {
  const recetas = await prisma.receta.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, yieldQty: true, yieldUnit: true, yieldLabel: true },
  });
  if (recetas.length === 0) return { ok: true, summary: "No hay fichas técnicas." };
  const lines = recetas.map(
    (r) =>
      `• ${r.name}${
        r.yieldQty != null
          ? ` — rendimiento ${r.yieldQty} ${r.yieldUnit || ""}${
              r.yieldLabel ? ` (${r.yieldLabel})` : ""
            }`
          : ""
      }`
  );
  return {
    ok: true,
    summary: `Recetas (${recetas.length}). Para ficha completa usá receta_get.\n${lines.join("\n")}`,
  };
}

async function recetaGet(args: {
  name: string;
  versionNumber?: number;
}): Promise<ToolResult> {
  const q = String(args.name || "").trim().toLowerCase();
  if (!q) return { ok: false, summary: "Falta el nombre de la receta." };

  const recetas = await prisma.receta.findMany({
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { insumo: { select: { name: true, baseUnit: true } } },
          },
        },
      },
    },
  });

  const exact = recetas.find((r) => r.name.toLowerCase() === q);
  const partial = exact || recetas.find((r) => r.name.toLowerCase().includes(q));
  if (!partial) {
    const known = recetas.map((r) => r.name).join(", ") || "ninguna";
    return {
      ok: false,
      summary: `No encontré receta «${args.name}». Recetas conocidas: ${known}.`,
    };
  }

  const version =
    (args.versionNumber != null
      ? partial.versions.find((v) => v.number === Number(args.versionNumber))
      : null) ||
    partial.versions.find((v) => v.id === partial.currentVersionId) ||
    partial.versions[0];

  if (!version) {
    return {
      ok: false,
      summary: `La receta «${partial.name}» no tiene versiones ni ingredientes cargados.`,
    };
  }

  const published = version.id === partial.currentVersionId;
  const yieldLine =
    partial.yieldQty != null
      ? `${partial.yieldQty} ${partial.yieldUnit || ""}${
          partial.yieldLabel ? ` (${partial.yieldLabel})` : ""
        }`.trim()
      : "sin rendimiento definido";

  const ingredientLines =
    version.lines.length === 0
      ? ["(sin ingredientes en esta versión)"]
      : version.lines.map((l, i) => {
          const qty =
            l.isToTaste
              ? "c/n"
              : l.quantity != null
                ? `${l.quantity}${l.unit ? ` ${l.unit}` : ""}`
                : "—";
          const notes: string[] = [];
          if (l.canBeScaleBase) notes.push("Puede ser base");
          if (l.isToTaste) notes.push("al gusto");
          if (l.insumo?.name) notes.push(`insumo: ${l.insumo.name}`);
          const noteStr = notes.length ? ` — ${notes.join("; ")}` : "";
          return `${i + 1}. ${l.name}: ${qty}${noteStr}`;
        });

  const summary = [
    `Ficha técnica «${partial.name}»`,
    partial.notes ? `Notas/descripción: ${partial.notes}` : null,
    `Rendimiento: ${yieldLine}`,
    `Versión: v${version.number}${version.label ? ` — ${version.label}` : ""}${
      published ? " (publicada)" : ""
    }${version.changelog ? ` — ${version.changelog}` : ""}`,
    `Ingredientes (${version.lines.length}):`,
    ...ingredientLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ok: true,
    summary,
    data: {
      id: partial.id,
      name: partial.name,
      notes: partial.notes,
      yieldQty: partial.yieldQty,
      yieldUnit: partial.yieldUnit,
      yieldLabel: partial.yieldLabel,
      version: {
        id: version.id,
        number: version.number,
        label: version.label,
        changelog: version.changelog,
        published,
        lines: version.lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit: l.unit,
          isToTaste: l.isToTaste,
          canBeScaleBase: l.canBeScaleBase,
          insumo: l.insumo?.name || null,
        })),
      },
    },
  };
}

async function inventoryList(args: { query?: string }): Promise<ToolResult> {
  const q = String(args.query || "").trim().toLowerCase();
  const items = await prisma.insumo.findMany({
    orderBy: { name: "asc" },
    take: 200,
  });
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q))
    : items;
  if (filtered.length === 0) {
    return {
      ok: true,
      summary: q
        ? `No hay insumos que coincidan con «${args.query}».`
        : "Inventario vacío.",
    };
  }
  const lines = filtered.map((i) => {
    const min = i.minQty != null ? `, mín ${formatQty(i.minQty, i.baseUnit)}` : "";
    return `• ${i.name}: ${formatQty(i.quantityOnHand, i.baseUnit)}${min} [${i.category}]`;
  });
  return {
    ok: true,
    summary: `Inventario (${filtered.length}${q ? ` filtro «${args.query}»` : ""}):\n${lines.join("\n")}`,
  };
}

async function recetaCreate(args: {
  name: string;
  notes?: string;
  yieldQty?: number;
  yieldUnit?: string;
  lines?: { name: string; quantity?: number; unit?: string }[];
}): Promise<ToolResult> {
  const name = String(args.name || "").trim();
  if (!name) return { ok: false, summary: "Falta el nombre de la receta." };
  const lines = Array.isArray(args.lines) ? args.lines : [];
  const receta = await prisma.receta.create({
    data: {
      name,
      notes: args.notes || null,
      yieldQty: args.yieldQty ?? null,
      yieldUnit: args.yieldUnit || null,
      versions: {
        create: {
          number: 1,
          label: "v1",
          changelog: "Creada por asistente",
          lines: {
            create: lines.map((l, i) => ({
              name: l.name,
              quantity: l.quantity ?? null,
              unit: l.unit ?? null,
              sortOrder: i + 1,
              canBeScaleBase: l.quantity != null,
            })),
          },
        },
      },
    },
    include: { versions: true },
  });
  await prisma.receta.update({
    where: { id: receta.id },
    data: { currentVersionId: receta.versions[0]?.id },
  });
  const summary = `Ficha técnica creada: «${receta.name}» (${lines.length} líneas).`;
  logMutation({ tool: "receta_create", ok: true, summary, detail: { id: receta.id } });
  return { ok: true, summary };
}

async function menuList(): Promise<ToolResult> {
  const items = await prisma.menuItem.findMany({
    include: { platformSpecs: true },
    orderBy: { name: "asc" },
  });
  if (items.length === 0) return { ok: true, summary: "Menú vacío." };
  const lines = items.map((m) => {
    const specs = m.platformSpecs
      .map((s) => `${s.platform}${s.price != null ? ` $${s.price}` : ""}`)
      .join(", ");
    return `• ${m.name}${specs ? ` — ${specs}` : ""}`;
  });
  return { ok: true, summary: `Menú:\n${lines.join("\n")}` };
}

async function produccionPropose(args: {
  recetaName: string;
  targetQuantity: number;
  targetUnit?: string;
  baseKind?: string;
}): Promise<ToolResult> {
  const q = args.recetaName.toLowerCase();
  const recetas = await prisma.receta.findMany({
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: { lines: { include: { insumo: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  const receta = recetas.find((r) => r.name.toLowerCase().includes(q));
  if (!receta) return { ok: false, summary: `No encontré receta «${args.recetaName}».` };
  const version =
    receta.versions.find((v) => v.id === receta.currentVersionId) || receta.versions[0];
  if (!version) return { ok: false, summary: "La receta no tiene versiones." };

  const baseKind = args.baseKind === "line" ? "line" : "yield";
  const preview = previewProduction({
    lines: version.lines.map((l) => ({
      id: l.id,
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      isToTaste: l.isToTaste,
      canBeScaleBase: l.canBeScaleBase,
      insumoId: l.insumoId,
      insumo: l.insumo,
    })),
    yield:
      receta.yieldQty != null && receta.yieldUnit
        ? { quantity: receta.yieldQty, unit: receta.yieldUnit, label: receta.yieldLabel }
        : null,
    baseKind,
    baseLineId: baseKind === "line" ? version.lines.find((l) => l.quantity != null)?.id : undefined,
    targetQuantity: Number(args.targetQuantity),
    targetUnit: args.targetUnit,
  });

  const missing =
    preview.missing.length > 0
      ? `\nFaltantes: ${preview.missing.map((m) => `${m.name} ${m.missingQty}${m.unit}`).join("; ")}`
      : "";
  return {
    ok: true,
    summary: `Preview «${receta.name}» ×${preview.scale.factor} → ${args.targetQuantity} ${args.targetUnit || preview.scale.baseUnit}. canConfirm=${preview.canConfirm}.${missing}\nPara descontar stock usá produccion_confirm (pedirá CONFIRMAR).`,
    data: { recetaId: receta.id, preview },
  };
}

async function inventoryProposeAddMany(args: {
  items?: {
    name?: string;
    quantity?: number;
    unit?: string;
    category?: string;
  }[];
  source?: string;
}): Promise<ToolResult> {
  const items = (args.items || [])
    .map((i) => ({
      name: String(i.name || "").trim(),
      quantity: Number(i.quantity),
      unit: String(i.unit || "ud").trim() || "ud",
      category: i.category ? String(i.category) : undefined,
    }))
    .filter((i) => i.name && i.quantity > 0);

  if (items.length === 0) {
    return {
      ok: false,
      summary: "No hay líneas con nombre y cantidad > 0 para cargar.",
    };
  }

  const list = items
    .map((i) => `• ${i.quantity} ${i.unit} ${i.name}`)
    .join("\n");
  const pending = createPendingAction({
    kind: "inventory_add_many",
    summary: `Sumar ${items.length} insumo(s)${args.source ? ` desde ${args.source}` : ""}`,
    payload: { items, source: args.source || null },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Voy a sumar ${items.length} línea(s) al inventario${args.source ? ` (adjunto: ${args.source})` : ""}:\n${list}\nPara confirmar, respondé: CONFIRMAR ${pending.code}`,
    data: { items },
  };
}

async function produccionConfirm(args: {
  recetaName: string;
  targetQuantity: number;
  targetUnit?: string;
  baseKind?: string;
  force?: boolean;
}): Promise<ToolResult> {
  const pending = createPendingAction({
    kind: "produccion_confirm",
    summary: `Producción «${args.recetaName}» ${args.targetQuantity} ${args.targetUnit || ""}`.trim(),
    payload: {
      recetaName: args.recetaName,
      targetQuantity: args.targetQuantity,
      targetUnit: args.targetUnit || null,
      baseKind: args.baseKind || "yield",
      force: Boolean(args.force),
    },
  });
  return {
    ok: true,
    needsConfirm: true,
    confirmCode: pending.code,
    summary: `Producción lista para descontar stock. Para confirmar, respondé: CONFIRMAR ${pending.code}`,
  };
}

export async function executeAssistantTool(
  name: string,
  rawArgs: string
): Promise<ToolResult> {
  return runWithPrisma(async () => {
    let args: Record<string, unknown> = {};
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, summary: "Argumentos JSON inválidos." };
    }

    let result: ToolResult;
    switch (name) {
      case "inventory_add_stock":
        result = await inventoryAddStock(args as never);
        break;
      case "inventory_set_stock":
        result = await inventorySetStock(args as never);
        break;
      case "inventory_list_low":
        result = await inventoryListLow();
        break;
      case "inventory_delete":
        result = await inventoryDelete(args as never);
        break;
      case "inventory_clear_all":
        result = await inventoryClearAll(args as never);
        break;
      case "pendiente_create":
        result = await pendienteCreate(args as never);
        break;
      case "pendiente_update_status":
        result = await pendienteUpdateStatus(args as never);
        break;
      case "pendiente_list":
        result = await pendienteList(args as never);
        break;
      case "pendiente_delete":
        result = await pendienteDelete(args as never);
        break;
      case "receta_list":
        result = await recetaList();
        break;
      case "receta_get":
        result = await recetaGet(args as never);
        break;
      case "receta_create":
        result = await recetaCreate(args as never);
        break;
      case "inventory_list":
        result = await inventoryList(args as never);
        break;
      case "inventory_propose_add_many":
        result = await inventoryProposeAddMany(args as never);
        break;
      case "menu_list":
        result = await menuList();
        break;
      case "produccion_propose":
        result = await produccionPropose(args as never);
        break;
      case "produccion_confirm":
        result = await produccionConfirm(args as never);
        break;
      default:
        result = { ok: false, summary: `Herramienta desconocida: ${name}` };
    }
    return { ...result, tool: name };
  });
}

/** Execute a previously staged destructive action after CONFIRMAR */
export async function executeConfirmedAction(kind: string, payload: Record<string, unknown>): Promise<ToolResult> {
  return runWithPrisma(() => executeConfirmedActionInner(kind, payload));
}

async function executeConfirmedActionInner(kind: string, payload: Record<string, unknown>): Promise<ToolResult> {
  if (kind === "inventory_delete") {
    const id = String(payload.insumoId);
    await prisma.inventoryMovement.deleteMany({ where: { insumoId: id } });
    await prisma.insumo.delete({ where: { id } });
    const summary = `Eliminé el insumo «${payload.name}».`;
    logMutation({ tool: "inventory_delete:confirmed", ok: true, summary });
    return { ok: true, summary };
  }
  if (kind === "inventory_clear_all") {
    await prisma.produccionLinea.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    // Unlink recipe lines from insumos before delete
    await prisma.recetaLinea.updateMany({ data: { insumoId: null } });
    await prisma.pendiente.updateMany({ data: { insumoId: null } });
    const res = await prisma.insumo.deleteMany({});
    const summary = `Inventario vaciado: ${res.count} insumos eliminados.`;
    logMutation({ tool: "inventory_clear_all:confirmed", ok: true, summary });
    return { ok: true, summary };
  }
  if (kind === "pendiente_delete") {
    await prisma.pendiente.delete({ where: { id: String(payload.pendienteId) } });
    const summary = `Eliminé el pendiente «${payload.title}».`;
    logMutation({ tool: "pendiente_delete:confirmed", ok: true, summary });
    return { ok: true, summary };
  }
  if (kind === "inventory_add_many") {
    const items = (payload.items as {
      name: string;
      quantity: number;
      unit?: string;
      category?: string;
    }[]) || [];
    const summaries: string[] = [];
    for (const item of items) {
      const r = await inventoryAddStock({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || "ud",
        category: item.category,
      });
      summaries.push(r.summary);
    }
    const summary = `Cargué ${items.length} insumo(s) al inventario:\n${summaries.join("\n")}`;
    logMutation({ tool: "inventory_add_many:confirmed", ok: true, summary });
    return { ok: true, summary, data: { count: items.length } };
  }
  if (kind === "produccion_confirm") {
    // Delegate to internal production POST logic via direct prisma (mirror API)
    const recetaName = String(payload.recetaName || "");
    const recetas = await prisma.receta.findMany({
      include: {
        versions: {
          orderBy: { number: "desc" },
          include: {
            lines: { include: { insumo: true }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
    const receta = recetas.find((r) =>
      r.name.toLowerCase().includes(recetaName.toLowerCase())
    );
    if (!receta) return { ok: false, summary: "Receta no encontrada al confirmar." };
    const version =
      receta.versions.find((v) => v.id === receta.currentVersionId) || receta.versions[0];
    if (!version) return { ok: false, summary: "Sin versión." };

    const baseKind = payload.baseKind === "line" ? "line" : "yield";
    const preview = previewProduction({
      lines: version.lines.map((l) => ({
        id: l.id,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        isToTaste: l.isToTaste,
        canBeScaleBase: l.canBeScaleBase,
        insumoId: l.insumoId,
        insumo: l.insumo,
      })),
      yield:
        receta.yieldQty != null && receta.yieldUnit
          ? {
              quantity: receta.yieldQty,
              unit: receta.yieldUnit,
              label: receta.yieldLabel,
            }
          : null,
      baseKind,
      baseLineId:
        baseKind === "line"
          ? version.lines.find((l) => l.quantity != null)?.id
          : undefined,
      targetQuantity: Number(payload.targetQuantity),
      targetUnit: payload.targetUnit ? String(payload.targetUnit) : undefined,
    });

    if (!preview.canConfirm && !payload.force) {
      return {
        ok: false,
        summary: `Inventario insuficiente. Faltantes: ${preview.missing
          .map((m) => `${m.name} ${m.missingQty}${m.unit}`)
          .join("; ")}. Pedí de nuevo con force=true si querés descontar solo lo disponible.`,
      };
    }

    const title = `${receta.name} — ${preview.scale.targetQuantity} ${
      payload.targetUnit || preview.scale.baseUnit
    }`;
    await prisma.$transaction(async (tx) => {
      const produccion = await tx.produccion.create({
        data: {
          recetaId: receta.id,
          versionId: version.id,
          title,
          baseKind,
          baseName: preview.scale.baseName,
          targetQuantity: preview.scale.targetQuantity,
          targetUnit: String(payload.targetUnit || preview.scale.baseUnit),
          factor: preview.scale.factor,
          status: "CONFIRMADA",
          missingJson:
            preview.missing.length > 0 ? JSON.stringify(preview.missing) : null,
        },
      });
      let sort = 0;
      for (const line of preview.lines) {
        let deductedQty: number | null = null;
        let onHandBefore: number | null = null;
        let onHandAfter: number | null = null;
        let insufficient = false;
        if (line.insumoId && line.needInBase != null && line.needInBase > 0) {
          const insumo = await tx.insumo.findUnique({ where: { id: line.insumoId } });
          if (insumo) {
            onHandBefore = insumo.quantityOnHand;
            const deduct = Math.min(insumo.quantityOnHand, line.needInBase);
            insufficient = insumo.quantityOnHand + 1e-9 < line.needInBase;
            const next =
              Math.round((insumo.quantityOnHand - deduct) * 10000) / 10000;
            await tx.insumo.update({
              where: { id: insumo.id },
              data: { quantityOnHand: next },
            });
            deductedQty = deduct;
            onHandAfter = next;
            if (deduct > 0) {
              await tx.inventoryMovement.create({
                data: {
                  insumoId: insumo.id,
                  kind: "PRODUCCION",
                  delta: -deduct,
                  note: title,
                  refId: produccion.id,
                },
              });
            }
          }
        }
        await tx.produccionLinea.create({
          data: {
            produccionId: produccion.id,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            insumoId: line.insumoId,
            deductedQty,
            onHandBefore,
            onHandAfter,
            insufficient,
            sortOrder: sort++,
          },
        });
      }
    });
    const summary = `Producción confirmada: ${title}.`;
    logMutation({ tool: "produccion_confirm:confirmed", ok: true, summary });
    return { ok: true, summary };
  }
  return { ok: false, summary: `Tipo de confirmación desconocido: ${kind}` };
}
