import { describe, expect, it } from "vitest";
import {
  convertQuantity,
  scaleRecipe,
  ScaleError,
  unitsCompatible,
} from "./scaling";

/** Classic mayo ficha: 1 kg yield → scale to 1.8 kg */
const mayoLines = [
  { id: "aceite", name: "Aceite", quantity: 700, unit: "g" },
  { id: "yema", name: "Yema de huevo", quantity: 150, unit: "g" },
  { id: "mostaza", name: "Mostaza", quantity: 50, unit: "g" },
  { id: "vinagre", name: "Vinagre", quantity: 80, unit: "g" },
  { id: "sal", name: "Sal", quantity: 20, unit: "g" },
  { id: "pimienta", name: "Pimienta", quantity: null, unit: null, isToTaste: true },
];

const mayoYield = { quantity: 1, unit: "kg", label: "mayonesa" };

describe("unitsCompatible / convertQuantity", () => {
  it("treats g and kg as compatible", () => {
    expect(unitsCompatible("g", "kg")).toBe(true);
    expect(convertQuantity(1.8, "kg", "g")).toEqual({ ok: true, quantity: 1800 });
  });

  it("rejects mass vs volume", () => {
    expect(unitsCompatible("g", "ml")).toBe(false);
    const r = convertQuantity(100, "g", "ml");
    expect(r.ok).toBe(false);
  });
});

describe("scaleRecipe — 1 kg mayo → 1.8 kg", () => {
  it("scales all fixed lines by 1.8 when base is yield", () => {
    const result = scaleRecipe({
      lines: mayoLines,
      yield: mayoYield,
      baseKind: "yield",
      targetQuantity: 1.8,
      targetUnit: "kg",
    });

    expect(result.factor).toBe(1.8);
    expect(result.baseName).toBe("mayonesa");
    expect(result.scaledYield).toEqual({
      quantity: 1.8,
      unit: "kg",
      label: "mayonesa",
    });

    const byId = Object.fromEntries(result.lines.map((l) => [l.id, l]));
    expect(byId.aceite.scaledQuantity).toBe(1260);
    expect(byId.yema.scaledQuantity).toBe(270);
    expect(byId.mostaza.scaledQuantity).toBe(90);
    expect(byId.vinagre.scaledQuantity).toBe(144);
    expect(byId.sal.scaledQuantity).toBe(36);
    expect(byId.pimienta.scaled).toBe(false);
    expect(byId.pimienta.reason).toMatch(/gusto/i);
  });

  it("scales from an ingredient base (aceite 700g → 1260g) with same factor", () => {
    const result = scaleRecipe({
      lines: mayoLines,
      yield: mayoYield,
      baseKind: "line",
      baseLineId: "aceite",
      targetQuantity: 1260,
      targetUnit: "g",
    });

    expect(result.factor).toBe(1.8);
    expect(result.scaledYield?.quantity).toBe(1.8);
    const aceite = result.lines.find((l) => l.id === "aceite")!;
    expect(aceite.scaledQuantity).toBe(1260);
  });

  it("accepts target in g when yield base is kg", () => {
    const result = scaleRecipe({
      lines: mayoLines,
      yield: mayoYield,
      baseKind: "yield",
      targetQuantity: 1800,
      targetUnit: "g",
    });
    expect(result.factor).toBe(1.8);
  });

  it("throws when base is to-taste", () => {
    expect(() =>
      scaleRecipe({
        lines: mayoLines,
        baseKind: "line",
        baseLineId: "pimienta",
        targetQuantity: 1,
      })
    ).toThrow(ScaleError);
  });

  it("throws on incompatible units", () => {
    expect(() =>
      scaleRecipe({
        lines: mayoLines,
        yield: mayoYield,
        baseKind: "yield",
        targetQuantity: 1.8,
        targetUnit: "L",
      })
    ).toThrow(ScaleError);
    try {
      scaleRecipe({
        lines: mayoLines,
        yield: mayoYield,
        baseKind: "yield",
        targetQuantity: 1.8,
        targetUnit: "L",
      });
    } catch (e) {
      expect(String(e)).toContain("Unidades incompatibles");
    }
  });

  it("throws when target <= 0", () => {
    expect(() =>
      scaleRecipe({
        lines: mayoLines,
        yield: mayoYield,
        baseKind: "yield",
        targetQuantity: 0,
      })
    ).toThrow(ScaleError);
  });
});
