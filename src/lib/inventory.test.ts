import { describe, expect, it } from "vitest";
import { packFillPercent, stockStatus } from "./inventory";

describe("packFillPercent", () => {
  it("treats pack as 100%", () => {
    expect(packFillPercent(25, 25)).toBe(100);
    expect(packFillPercent(12.5, 25)).toBe(50);
    expect(packFillPercent(18, 25)).toBe(72);
  });

  it("returns null without pack", () => {
    expect(packFillPercent(10, null)).toBeNull();
  });
});

describe("stockStatus", () => {
  it("flags critical at reorder point or very low fill", () => {
    expect(
      stockStatus({ onHand: 5, packSize: 25, minQty: 5 })
    ).toBe("critical");
    expect(
      stockStatus({ onHand: 3, packSize: 25, minQty: 5 })
    ).toBe("critical");
  });

  it("flags reorder under 35% pack", () => {
    expect(
      stockStatus({ onHand: 8, packSize: 25, minQty: 5 })
    ).toBe("reorder");
  });

  it("ok when healthy fill", () => {
    expect(
      stockStatus({ onHand: 18, packSize: 25, minQty: 5 })
    ).toBe("ok");
  });
});
