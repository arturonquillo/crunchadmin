import { scaleRecipe, ScaleError, type ScaleResult } from "@/lib/scaling";
import { qtyInInsumoBase } from "@/lib/inventory";

export type ProductionLineInput = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  isToTaste?: boolean;
  canBeScaleBase?: boolean;
  insumoId: string | null;
  insumo?: {
    id: string;
    name: string;
    baseUnit: string;
    quantityOnHand: number;
  } | null;
};

export type ProductionPreviewLine = {
  lineId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  scaled: boolean;
  isToTaste: boolean;
  insumoId: string | null;
  onHand: number | null;
  onHandUnit: string | null;
  needInBase: number | null;
  available: boolean;
  missingQty: number | null;
  reason?: string;
};

export type ProductionPreview = {
  scale: ScaleResult;
  lines: ProductionPreviewLine[];
  canConfirm: boolean;
  hasWarnings: boolean;
  missing: { name: string; missingQty: number; unit: string; insumoId: string }[];
};

export function previewProduction(params: {
  lines: ProductionLineInput[];
  yield?: { quantity: number; unit: string; label?: string | null } | null;
  baseKind: "line" | "yield";
  baseLineId?: string;
  targetQuantity: number;
  targetUnit?: string;
}): ProductionPreview {
  let scale: ScaleResult;
  try {
    scale = scaleRecipe({
      lines: params.lines,
      yield: params.yield,
      baseKind: params.baseKind,
      baseLineId: params.baseLineId,
      targetQuantity: params.targetQuantity,
      targetUnit: params.targetUnit,
    });
  } catch (e) {
    if (e instanceof ScaleError) throw e;
    throw e;
  }

  const missing: ProductionPreview["missing"] = [];
  const lines: ProductionPreviewLine[] = scale.lines.map((sl) => {
    const src = params.lines.find((l) => l.id === sl.id);
    const insumo = src?.insumo ?? null;
    if (!sl.scaled || sl.scaledQuantity == null || !sl.unit) {
      return {
        lineId: sl.id,
        name: sl.name,
        quantity: sl.scaledQuantity,
        unit: sl.unit,
        scaled: sl.scaled,
        isToTaste: sl.isToTaste,
        insumoId: insumo?.id ?? src?.insumoId ?? null,
        onHand: insumo?.quantityOnHand ?? null,
        onHandUnit: insumo?.baseUnit ?? null,
        needInBase: null,
        available: true,
        missingQty: null,
        reason: sl.reason,
      };
    }

    if (!insumo) {
      return {
        lineId: sl.id,
        name: sl.name,
        quantity: sl.scaledQuantity,
        unit: sl.unit,
        scaled: true,
        isToTaste: false,
        insumoId: src?.insumoId ?? null,
        onHand: null,
        onHandUnit: null,
        needInBase: null,
        available: true,
        missingQty: null,
        reason: "Sin vínculo a inventario — no se descuenta",
      };
    }

    const converted = qtyInInsumoBase(sl.scaledQuantity, sl.unit, insumo.baseUnit);
    if (!converted.ok) {
      return {
        lineId: sl.id,
        name: sl.name,
        quantity: sl.scaledQuantity,
        unit: sl.unit,
        scaled: true,
        isToTaste: false,
        insumoId: insumo.id,
        onHand: insumo.quantityOnHand,
        onHandUnit: insumo.baseUnit,
        needInBase: null,
        available: false,
        missingQty: null,
        reason: converted.error,
      };
    }

    const need = converted.quantity;
    const available = insumo.quantityOnHand + 1e-9 >= need;
    const missingQty = available ? 0 : Math.round((need - insumo.quantityOnHand) * 10000) / 10000;
    if (!available) {
      missing.push({
        name: insumo.name,
        missingQty,
        unit: insumo.baseUnit,
        insumoId: insumo.id,
      });
    }

    return {
      lineId: sl.id,
      name: sl.name,
      quantity: sl.scaledQuantity,
      unit: sl.unit,
      scaled: true,
      isToTaste: false,
      insumoId: insumo.id,
      onHand: insumo.quantityOnHand,
      onHandUnit: insumo.baseUnit,
      needInBase: need,
      available,
      missingQty: available ? null : missingQty,
    };
  });

  const hasWarnings = missing.length > 0 || lines.some((l) => l.reason && !l.available);
  return {
    scale,
    lines,
    canConfirm: missing.length === 0 && !lines.some((l) => l.available === false && l.needInBase != null),
    hasWarnings,
    missing,
  };
}
