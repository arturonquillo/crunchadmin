import { describe, expect, it } from "vitest";
import {
  adminMisconfiguredInProduction,
  safeEqual,
  safeNextPath,
  sameOriginMutation,
} from "./admin-session";

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("blocks open redirects", () => {
    expect(safeNextPath("/qrs")).toBe("/qrs");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("sameOriginMutation", () => {
  it("allows GET without Origin", () => {
    expect(
      sameOriginMutation({
        method: "GET",
        headers: { get: () => null },
        nextUrl: { origin: "https://lecrunch.com.br" },
      })
    ).toBe(true);
  });

  it("rejects cross-origin PATCH", () => {
    expect(
      sameOriginMutation({
        method: "PATCH",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "origin" ? "https://evil.example" : null,
        },
        nextUrl: { origin: "https://lecrunch.com.br" },
      })
    ).toBe(false);
  });

  it("allows same-origin POST", () => {
    expect(
      sameOriginMutation({
        method: "POST",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "origin" ? "https://lecrunch.com.br" : null,
        },
        nextUrl: { origin: "https://lecrunch.com.br" },
      })
    ).toBe(true);
  });
});

describe("adminMisconfiguredInProduction", () => {
  it("flags production without password", () => {
    expect(adminMisconfiguredInProduction("production", false)).toBe(true);
  });

  it("allows production with password and non-prod open mode", () => {
    expect(adminMisconfiguredInProduction("production", true)).toBe(false);
    expect(adminMisconfiguredInProduction("development", false)).toBe(false);
  });
});
