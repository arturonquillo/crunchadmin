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
    n >= 100
      ? Math.round(n * 100) / 100
      : n >= 10
        ? Math.round(n * 1000) / 1000
        : Math.round(n * 10000) / 10000;
  return `${rounded} ${unit}`;
}

export function isLowStock(
  onHand: number,
  minQty: number | null | undefined
): boolean {
  if (minQty == null) return false;
  return onHand <= minQty;
}

/** Fill % relative to typical purchase pack (packSize = 100%) */
export function packFillPercent(
  onHand: number,
  packSize: number | null | undefined
): number | null {
  if (packSize == null || !(packSize > 0)) return null;
  return Math.max(0, Math.round((onHand / packSize) * 1000) / 10);
}

export type StockStatus = "ok" | "reorder" | "critical" | "unknown";

/**
 * Critical: at/below reorder point (minQty) or fill ≤ 15% of pack.
 * Reorder: fill ≤ 35% of pack (or ≤ 1.5× minQty when no pack).
 */
export function stockStatus(params: {
  onHand: number;
  packSize?: number | null;
  minQty?: number | null;
}): StockStatus {
  const { onHand, packSize, minQty } = params;
  const fill = packFillPercent(onHand, packSize);

  if (minQty != null && onHand <= minQty) return "critical";
  if (fill != null) {
    if (fill <= 15) return "critical";
    if (fill <= 35) return "reorder";
    return "ok";
  }
  if (minQty != null) {
    if (onHand <= minQty * 1.5) return "reorder";
    return "ok";
  }
  return "unknown";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: "OK",
  reorder: "Reponer",
  critical: "Crítico",
  unknown: "Sin pack",
};

export function unitsLookSame(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}
