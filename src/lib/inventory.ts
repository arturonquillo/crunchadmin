import { convertQuantity, normalizeUnit } from "@/lib/scaling";

export type StockNeed = {
  name: string;
  quantity: number;
  unit: string;
  insumoId: string | null;
  onHand: number | null;
  onHandUnit: string | null;
  needInBase: number | null;
  available: boolean;
  missingQty: number | null;
};

/** Convert a recipe line qty into the insumo's base unit when possible */
export function qtyInInsumoBase(
  quantity: number,
  unit: string,
  baseUnit: string
): { ok: true; quantity: number } | { ok: false; error: string } {
  return convertQuantity(quantity, unit, baseUnit);
}

export function formatQty(n: number, unit: string): string {
  const rounded =
    n >= 100 ? Math.round(n * 100) / 100 : n >= 10 ? Math.round(n * 1000) / 1000 : Math.round(n * 10000) / 10000;
  return `${rounded} ${unit}`;
}

export function isLowStock(onHand: number, minQty: number | null | undefined): boolean {
  if (minQty == null) return false;
  return onHand <= minQty;
}

export function unitsLookSame(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}
