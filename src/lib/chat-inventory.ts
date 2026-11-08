import { convertQuantity, normalizeUnit } from "@/lib/scaling";

export type InventoryIntent =
  | {
      kind: "set";
      nameQuery: string;
      quantity: number;
      unit: string;
    }
  | {
      kind: "add";
      nameQuery: string;
      quantity: number;
      unit: string;
    };

const SET_RE =
  /(?:quedan|hay|actualizar?|poner|dejar|stock\s+(?:de|en)?|inventario\s+(?:de)?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|lt|litro|litros|ml|ud|unidad(?:es)?)\s+(?:de\s+)?(.+?)(?:\.|$)/i;
const SET_RE_ALT =
  /(?:actualizar?|poner|dejar)\s+(.+?)\s+(?:a|en)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|lt|litro|litros|ml|ud|unidad(?:es)?)/i;
const ADD_RE =
  /(?:recib[ií]|entr[oó]|lleg[oó]|sum[ae]|agregar?|añadir|agregué|añadí)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|lt|litro|litros|ml|ud|unidad(?:es)?)\s+(?:de\s+)?(.+?)(?:\.|$)/i;

function parseNum(s: string): number {
  return Number(s.replace(",", "."));
}

function normUnit(u: string): string {
  const n = normalizeUnit(u);
  if (n.startsWith("litro") || n === "lt") return "L";
  if (n.startsWith("unidad") || n === "ud") return "ud";
  if (n === "l") return "L";
  return n;
}

export function parseInventoryIntent(text: string): InventoryIntent | null {
  const t = text.trim();
  if (!t) return null;

  let m = t.match(ADD_RE);
  if (m) {
    return {
      kind: "add",
      quantity: parseNum(m[1]),
      unit: normUnit(m[2]),
      nameQuery: m[3].trim(),
    };
  }

  m = t.match(SET_RE);
  if (m) {
    return {
      kind: "set",
      quantity: parseNum(m[1]),
      unit: normUnit(m[2]),
      nameQuery: m[3].trim(),
    };
  }

  m = t.match(SET_RE_ALT);
  if (m) {
    return {
      kind: "set",
      nameQuery: m[1].trim(),
      quantity: parseNum(m[2]),
      unit: normUnit(m[3]),
    };
  }

  return null;
}

export function matchInsumoName<T extends { name: string }>(
  items: T[],
  query: string
): T | null {
  const q = normalizeUnit(query).replace(/\s+/g, " ");
  const exact = items.find((i) => normalizeUnit(i.name) === q);
  if (exact) return exact;
  const starts = items.find((i) => normalizeUnit(i.name).startsWith(q));
  if (starts) return starts;
  const includes = items.find(
    (i) =>
      normalizeUnit(i.name).includes(q) || q.includes(normalizeUnit(i.name))
  );
  return includes ?? null;
}

export function toBaseQty(
  quantity: number,
  unit: string,
  baseUnit: string
): { ok: true; quantity: number } | { ok: false; error: string } {
  return convertQuantity(quantity, unit, baseUnit);
}
