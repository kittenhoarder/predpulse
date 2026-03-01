import { describe, it, expect } from "vitest";
import { computePulse } from "../pulse";
import type { ProcessedMarket } from "../types";

function makeMarket(overrides: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    id: "test-id",
    question: "Will X happen?",
    source: "polymarket",
    eventSlug: "test-slug",
    eventTitle: "Test Event",
    categoryslugs: ["politics"],
    categories: ["Politics"],
    image: "",
    currentPrice: 60,
    oneDayChange: 3,
    oneHourChange: 0.5,
    oneWeekChange: 5,
    oneMonthChange: 10,
    volume24h: 100_000,
    volume1wk: 500_000,
    volume1mo: 2_000_000,
    liquidity: 50_000,
    createdAt: "2025-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.6, 0.4],
    bestBid: 0.59,
    bestAsk: 0.61,
    spread: 0.02,
    clobTokenId: "tok-1",
    description: "Test",
    resolutionSource: "https://example.com",
    competitive: 0.8,
    ...overrides,
  };
}

describe("computePulse", () => {
  it("returns an index for each category with markets", () => {
    const markets = [
      makeMarket({ id: "1", categoryslugs: ["politics"] }),
      makeMarket({ id: "2", categoryslugs: ["crypto"] }),
    ];
    const result = computePulse(markets);
    const categories = result.map((r) => r.category);
    expect(categories).toContain("politics");
    expect(categories).toContain("crypto");
  });

  it("skips categories with no markets", () => {
    const markets = [makeMarket({ id: "1", categoryslugs: ["politics"] })];
    const result = computePulse(markets);
    const categories = result.map((r) => r.category);
    expect(categories).toContain("politics");
    expect(categories).not.toContain("sports");
  });

  it("produces scores in the 0–100 range", () => {
    const markets = [
      makeMarket({ id: "1", categoryslugs: ["politics"], currentPrice: 80 }),
      makeMarket({ id: "2", categoryslugs: ["politics"], currentPrice: 70 }),
    ];
    const result = computePulse(markets);
    const politicsIdx = result.find((r) => r.category === "politics");
    expect(politicsIdx).toBeDefined();
    expect(politicsIdx!.score).toBeGreaterThanOrEqual(0);
    expect(politicsIdx!.score).toBeLessThanOrEqual(100);
  });

  it("assigns a valid band label", () => {
    const validBands = [
      "Extreme Bearish",
      "Bearish",
      "Neutral",
      "Bullish",
      "Extreme Bullish",
    ];
    const markets = [makeMarket({ categoryslugs: ["politics"] })];
    const result = computePulse(markets);
    expect(validBands).toContain(result[0].band);
  });

  it("includes signal breakdowns", () => {
    const markets = [makeMarket({ categoryslugs: ["politics"] })];
    const result = computePulse(markets);
    const signals = result[0].signals;
    expect(signals).toHaveProperty("prob");
    expect(signals).toHaveProperty("momentum");
    expect(signals).toHaveProperty("breadth");
    expect(signals).toHaveProperty("volWeighted");
    expect(signals).toHaveProperty("decay");
    expect(signals).toHaveProperty("consensus");
  });

  it("counts markets by source", () => {
    const markets = [
      makeMarket({ id: "1", source: "polymarket", categoryslugs: ["politics"] }),
      makeMarket({ id: "2", source: "kalshi", categoryslugs: ["politics"] }),
      makeMarket({ id: "3", source: "manifold", categoryslugs: ["politics"] }),
    ];
    const result = computePulse(markets);
    const politicsIdx = result.find((r) => r.category === "politics")!;
    expect(politicsIdx.marketCount.polymarket).toBe(1);
    expect(politicsIdx.marketCount.kalshi).toBe(1);
    expect(politicsIdx.marketCount.manifold).toBe(1);
    expect(politicsIdx.marketCount.total).toBe(3);
  });

  it("returns top markets sorted by liquidity", () => {
    const markets = [
      makeMarket({ id: "1", categoryslugs: ["politics"], liquidity: 100 }),
      makeMarket({ id: "2", categoryslugs: ["politics"], liquidity: 300 }),
      makeMarket({ id: "3", categoryslugs: ["politics"], liquidity: 200 }),
    ];
    const result = computePulse(markets);
    const topIds = result.find((r) => r.category === "politics")!.topMarkets.map((m) => m.id);
    expect(topIds[0]).toBe("2");
    expect(topIds[1]).toBe("3");
    expect(topIds[2]).toBe("1");
  });
});
