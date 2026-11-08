import { describe, expect, it } from "vitest";
import { matchInsumoName, parseInventoryIntent } from "./chat-inventory";

describe("parseInventoryIntent", () => {
  it("parses set stock phrases", () => {
    expect(parseInventoryIntent("quedan 8 L de aceite vegetal")).toEqual({
      kind: "set",
      quantity: 8,
      unit: "L",
      nameQuery: "aceite vegetal",
    });
  });

  it("parses add stock phrases", () => {
    expect(parseInventoryIntent("recibí 5 kg de frango")).toEqual({
      kind: "add",
      quantity: 5,
      unit: "kg",
      nameQuery: "frango",
    });
  });
});

describe("matchInsumoName", () => {
  const items = [
    { name: "Aceite vegetal" },
    { name: "Frango" },
  ];

  it("matches partial names", () => {
    expect(matchInsumoName(items, "aceite")?.name).toBe("Aceite vegetal");
    expect(matchInsumoName(items, "frango")?.name).toBe("Frango");
  });
});
