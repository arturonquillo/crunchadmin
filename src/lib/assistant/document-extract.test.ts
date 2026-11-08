import { describe, expect, it } from "vitest";
import {
  extractPdfText,
  extractSpreadsheet,
  linesFromTable,
  parseCsv,
  parseLineCells,
  wantsInventoryLoad,
} from "./document-extract";

describe("parseCsv", () => {
  it("parses header + semicolon grocery list", () => {
    const rows = parseCsv("insumo;cantidad;unidad\nHarina;20;kg\nAceite vegetal;5;L\n");
    expect(rows[0]).toEqual(["insumo", "cantidad", "unidad"]);
    expect(linesFromTable(rows)).toEqual([
      { name: "Harina", quantity: 20, unit: "kg" },
      { name: "Aceite vegetal", quantity: 5, unit: "L" },
    ]);
  });

  it("handles quoted commas", () => {
    const rows = parseCsv('producto,qty,unit\n"Queso, mozzarella",2,kg\n');
    expect(linesFromTable(rows)[0]).toEqual({
      name: "Queso, mozzarella",
      quantity: 2,
      unit: "kg",
    });
  });
});

describe("parseLineCells", () => {
  it("normalizes liters", () => {
    expect(parseLineCells("Aceite", "12", "lts")).toEqual({
      name: "Aceite",
      quantity: 12,
      unit: "L",
    });
  });

  it("rejects header-like names", () => {
    expect(parseLineCells("Insumo", "1", "kg")).toBeNull();
  });
});

describe("wantsInventoryLoad", () => {
  it("defaults to load when no caption", () => {
    expect(wantsInventoryLoad("", true)).toBe(true);
  });
  it("loads on compra phrasing", () => {
    expect(wantsInventoryLoad("cargá estos insumos", true)).toBe(true);
  });
  it("skips when asking something else", () => {
    expect(wantsInventoryLoad("qué receta puedo hacer con esto", true)).toBe(
      false
    );
  });
});

describe("extractPdfText", () => {
  it("reads simple Tj literals", () => {
    const buf = Buffer.from("%PDF (Harina 20 kg) Tj (Aceite 5 L) Tj", "latin1");
    expect(extractPdfText(buf)).toContain("Harina 20 kg");
    expect(extractPdfText(buf)).toContain("Aceite 5 L");
  });
});

describe("extractSpreadsheet", () => {
  it("reads first sheet rows", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["insumo", "cantidad", "unidad"],
      ["Harina", 20, "kg"],
      ["Aceite vegetal", 5, "L"],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Compras");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const rows = await extractSpreadsheet(buf);
    expect(linesFromTable(rows)).toEqual([
      { name: "Harina", quantity: 20, unit: "kg" },
      { name: "Aceite vegetal", quantity: 5, unit: "L" },
    ]);
  });
});
