import { describe, expect, it } from "vitest";
import { parseInsightsRow, resolveDateRange, sumMetrics } from "@/lib/meta/insights";

describe("meta insights helpers", () => {
  it("parses spend and prefers purchase CPA", () => {
    const m = parseInsightsRow({
      spend: "42.5",
      impressions: "1000",
      clicks: "50",
      reach: "800",
      cost_per_action_type: [
        { action_type: "link_click", value: "0.85" },
        { action_type: "purchase", value: "12.5" },
      ],
    });
    expect(m.spend).toBe(42.5);
    expect(m.cpa).toBe(12.5);
    expect(m.cpaAction).toBe("purchase");
    expect(m.ctr).toBeCloseTo(5, 5);
  });

  it("resolves last_7d range", () => {
    const r = resolveDateRange("last_7d", undefined, "2026-11-19");
    expect(r.until).toBe("2026-11-19");
    expect(r.since).toBe("2026-11-13");
  });

  it("sums metrics", () => {
    const s = sumMetrics([
      parseInsightsRow({ spend: "10", impressions: "100", clicks: "10" }),
      parseInsightsRow({ spend: "5", impressions: "50", clicks: "5" }),
    ]);
    expect(s.spend).toBe(15);
    expect(s.clicks).toBe(15);
    expect(s.cpc).toBe(1);
  });
});
