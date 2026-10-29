/**
 * Recipe scaling engine.
 *
 * Pick any ingredient line (or the declared yield) as base, provide a target
 * quantity in a compatible unit, and recalculate every other line by the same factor.
 * Lines marked "a gusto" / without quantity do not scale.
 */

export type Unit = string;

export interface ScaleLineInput {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  isToTaste?: boolean;
  canBeScaleBase?: boolean;
}

export interface YieldInput {
  quantity: number;
  unit: string;
  label?: string | null;
}

export interface ScaleRequest {
  lines: ScaleLineInput[];
  /** Optional declared recipe yield — can also be used as scale base via baseKind: "yield" */
  yield?: YieldInput | null;
  baseKind: "line" | "yield";
  /** Required when baseKind === "line" */
  baseLineId?: string;
  targetQuantity: number;
  /** If omitted, uses the base line/yield unit */
  targetUnit?: string;
}

export interface ScaledLine {
  id: string;
  name: string;
  originalQuantity: number | null;
  originalUnit: string | null;
  scaledQuantity: number | null;
  unit: string | null;
  isToTaste: boolean;
  scaled: boolean;
  reason?: string;
}

export interface ScaleResult {
  factor: number;
  baseName: string;
  baseOriginalQty: number;
  baseUnit: string;
  targetQuantity: number;
  lines: ScaledLine[];
  scaledYield: { quantity: number; unit: string; label: string | null } | null;
}

/** Mass/volume families for MVP metric conversion */
const MASS_TO_G: Record<string, number> = {
  g: 1,
  gr: 1,
  gramo: 1,
  gramos: 1,
  kg: 1000,
  kilogramo: 1000,
  kilogramos: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  mililitro: 1,
  mililitros: 1,
  l: 1000,
  lt: 1000,
  litro: 1000,
  litros: 1000,
};

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

export type ConvertResult =
  | { ok: true; quantityInBase: number; family: "mass" | "volume" | "count"; baseUnit: string }
  | { ok: false; error: string };

export function convertToCanonical(quantity: number, unit: string): ConvertResult {
  const u = normalizeUnit(unit);
  if (MASS_TO_G[u] != null) {
    return { ok: true, quantityInBase: quantity * MASS_TO_G[u], family: "mass", baseUnit: "g" };
  }
  if (VOLUME_TO_ML[u] != null) {
    return { ok: true, quantityInBase: quantity * VOLUME_TO_ML[u], family: "volume", baseUnit: "ml" };
  }
  // Count / piece units — only same-unit scaling
  return { ok: true, quantityInBase: quantity, family: "count", baseUnit: u };
}

export function unitsCompatible(a: string, b: string): boolean {
  const ca = convertToCanonical(1, a);
  const cb = convertToCanonical(1, b);
  if (!ca.ok || !cb.ok) return false;
  if (ca.family === "count" || cb.family === "count") {
    return normalizeUnit(a) === normalizeUnit(b);
  }
  return ca.family === cb.family;
}

/** Convert quantity from `fromUnit` into `toUnit` when compatible */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): { ok: true; quantity: number } | { ok: false; error: string } {
  if (!unitsCompatible(fromUnit, toUnit)) {
    return {
      ok: false,
      error: `Unidades incompatibles: "${fromUnit}" y "${toUnit}". Indica una conversión o usa la misma familia (masa/volumen).`,
    };
  }
  const from = convertToCanonical(quantity, fromUnit);
  const to = convertToCanonical(1, toUnit);
  if (!from.ok || !to.ok) {
    return { ok: false, error: "No se pudo convertir la unidad." };
  }
  if (from.family === "count") {
    return { ok: true, quantity };
  }
  const factor =
    from.family === "mass"
      ? MASS_TO_G[normalizeUnit(toUnit)]
      : VOLUME_TO_ML[normalizeUnit(toUnit)];
  if (factor == null || factor === 0) {
    return { ok: false, error: `Unidad destino no reconocida: ${toUnit}` };
  }
  return { ok: true, quantity: from.quantityInBase / factor };
}

function roundQty(n: number): number {
  // Keep sensible precision for kitchen use
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 10) return Math.round(n * 1000) / 1000;
  return Math.round(n * 10000) / 10000;
}

export class ScaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaleError";
  }
}

/**
 * Recalculate all recipe lines given a base ingredient (or yield) and target qty.
 *
 * Example: mayo ficha for 1 kg → target 1.8 kg → factor 1.8 applied to every line.
 */
export function scaleRecipe(req: ScaleRequest): ScaleResult {
  if (!(req.targetQuantity > 0)) {
    throw new ScaleError("La cantidad objetivo debe ser mayor que cero.");
  }

  let baseName: string;
  let baseQty: number;
  let baseUnit: string;

  if (req.baseKind === "yield") {
    if (!req.yield || !(req.yield.quantity > 0) || !req.yield.unit) {
      throw new ScaleError("La receta no tiene rendimiento (yield) definido para usar como base.");
    }
    baseName = req.yield.label?.trim() || "Rendimiento";
    baseQty = req.yield.quantity;
    baseUnit = req.yield.unit;
  } else {
    if (!req.baseLineId) {
      throw new ScaleError("Debes elegir un ingrediente base.");
    }
    const line = req.lines.find((l) => l.id === req.baseLineId);
    if (!line) {
      throw new ScaleError("No se encontró la línea base seleccionada.");
    }
    if (line.isToTaste || line.quantity == null || !(line.quantity > 0) || !line.unit) {
      throw new ScaleError(
        `El ingrediente "${line.name}" no puede ser base de escalado (sin cantidad fija o marcado a gusto).`
      );
    }
    if (line.canBeScaleBase === false) {
      throw new ScaleError(`El ingrediente "${line.name}" está marcado como no usable para escalado.`);
    }
    baseName = line.name;
    baseQty = line.quantity;
    baseUnit = line.unit;
  }

  const targetUnit = req.targetUnit ?? baseUnit;
  const converted = convertQuantity(req.targetQuantity, targetUnit, baseUnit);
  if (!converted.ok) {
    throw new ScaleError(converted.error);
  }

  const factor = converted.quantity / baseQty;
  if (!(factor > 0) || !Number.isFinite(factor)) {
    throw new ScaleError("Factor de escalado inválido.");
  }

  const scaledLines: ScaledLine[] = req.lines.map((line) => {
    const isToTaste = Boolean(line.isToTaste);
    if (isToTaste || line.quantity == null || !line.unit) {
      return {
        id: line.id,
        name: line.name,
        originalQuantity: line.quantity,
        originalUnit: line.unit,
        scaledQuantity: line.quantity,
        unit: line.unit,
        isToTaste,
        scaled: false,
        reason: isToTaste
          ? "A gusto — no escala"
          : "Sin cantidad fija — no escala",
      };
    }
    return {
      id: line.id,
      name: line.name,
      originalQuantity: line.quantity,
      originalUnit: line.unit,
      scaledQuantity: roundQty(line.quantity * factor),
      unit: line.unit,
      isToTaste: false,
      scaled: true,
    };
  });

  let scaledYield: ScaleResult["scaledYield"] = null;
  if (req.yield && req.yield.quantity > 0 && req.yield.unit) {
    scaledYield = {
      quantity: roundQty(req.yield.quantity * factor),
      unit: req.yield.unit,
      label: req.yield.label ?? null,
    };
  }

  return {
    factor: roundQty(factor),
    baseName,
    baseOriginalQty: baseQty,
    baseUnit,
    targetQuantity: req.targetQuantity,
    lines: scaledLines,
    scaledYield,
  };
}
