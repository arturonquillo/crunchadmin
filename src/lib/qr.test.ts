import { describe, expect, it } from "vitest";
import {
  describeAgent,
  fillDailyCounts,
  generateQrCode,
  isValidQrCode,
  normalizeDestination,
  normalizeQrCode,
  publicQrUrl,
} from "./qr";

describe("qr codes", () => {
  it("generates a short unambiguous code", () => {
    const code = generateQrCode();
    expect(code).toHaveLength(6);
    expect(isValidQrCode(code)).toBe(true);
    expect(code).not.toMatch(/[01lo]/);
  });

  it("normalizes custom codes", () => {
    expect(normalizeQrCode("  ABC123 ")).toBe("abc123");
    expect(isValidQrCode("abc123")).toBe(true);
    expect(isValidQrCode("ab")).toBe(false);
    expect(isValidQrCode("has space")).toBe(false);
    expect(isValidQrCode("insta_gram")).toBe(false);
  });
});

describe("normalizeDestination", () => {
  it("prefixes https when the scheme is missing", () => {
    const result = normalizeDestination("instagram.com/_lecrunch");
    expect(result).toEqual({
      ok: true,
      url: "https://instagram.com/_lecrunch",
    });
  });

  it("keeps an explicit https URL", () => {
    const result = normalizeDestination("https://instagram.com/_lecrunch");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://instagram.com/_lecrunch");
  });

  it("rejects non-http schemes and QR loops", () => {
    expect(normalizeDestination("javascript:alert(1)").ok).toBe(false);
    expect(normalizeDestination("https://lecrunch.com.br/qr/abc123").ok).toBe(false);
    expect(normalizeDestination("").ok).toBe(false);
  });
});

describe("public URL and stats helpers", () => {
  it("builds the printable short link", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://lecrunch.com.br/";
    expect(publicQrUrl("abc123")).toBe("https://lecrunch.com.br/qr/abc123");
    process.env.NEXT_PUBLIC_SITE_URL = previous;
  });

  it("buckets scans by day and fills gaps", () => {
    const now = new Date("2026-11-10T15:00:00.000Z");
    const rows = fillDailyCounts(
      [new Date("2026-11-10T12:00:00.000Z"), new Date("2026-11-08T12:00:00.000Z")],
      4,
      now
    );
    expect(rows.map((row) => row.day)).toEqual([
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
    expect(rows.map((row) => row.count)).toEqual([0, 1, 0, 1]);
  });

  it("labels common scanners", () => {
    expect(describeAgent("Mozilla Instagram 123")).toBe("Instagram");
    expect(describeAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      "iPhone / iPad"
    );
    expect(describeAgent(null)).toBe("Desconocido");
  });
});
