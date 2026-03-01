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

function politicsMarkets(count: number, overrides: Partial<ProcessedMarket> = {}): ProcessedMarket[] {
  return Array.from({ length: count }, (_, i) =>
    makeMarket({ id: `p-${i}`, categoryslugs: ["politics"], ...overrides }),
  );
}

describe("computePulse v2", () => {
  // -------------------------------------------------------------------
  // Structural tests
  // -------------------------------------------------------------------

  it("returns an index for each category with >= 3 markets", () => {
    const markets = [
      ...politicsMarkets(4),
      ...Array.from({ length: 3 }, (_, i) =>
        makeMarket({ id: `c-${i}`, categoryslugs: ["crypto"] }),
      ),
    ];
    const result = computePulse(markets);
    const cats = result.map((r) => r.category);
    expect(cats).toContain("politics");
    expect(cats).toContain("crypto");
  });

  it("skips categories with no markets", () => {
    const markets = politicsMarkets(3);
    const result = computePulse(markets);
    const cats = result.map((r) => r.category);
    expect(cats).toContain("politics");
    expect(cats).not.toContain("sports");
  });

  it("requires minimum 3 markets per category", () => {
    const markets = [
      makeMarket({ id: "1", categoryslugs: ["politics"] }),
      makeMarket({ id: "2", categoryslugs: ["politics"] }),
    ];
    const result = computePulse(markets);
    expect(result.find((r) => r.category === "politics")).toBeUndefined();
  });

  it("includes all v2 signal keys", () => {
    const markets = politicsMarkets(3);
    const result = computePulse(markets);
    const signals = result[0].signals;
    expect(signals).toHaveProperty("momentum");
    expect(signals).toHaveProperty("flow");
    expect(signals).toHaveProperty("breadth");
    expect(signals).toHaveProperty("acceleration");
    expect(signals).toHaveProperty("level");
  });

  it("counts markets by source", () => {
    const markets = [
      makeMarket({ id: "1", source: "polymarket", categoryslugs: ["politics"] }),
      makeMarket({ id: "2", source: "kalshi", categoryslugs: ["politics"] }),
      makeMarket({ id: "3", source: "manifold", categoryslugs: ["politics"] }),
    ];
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    expect(idx.marketCount.polymarket).toBe(1);
    expect(idx.marketCount.kalshi).toBe(1);
    expect(idx.marketCount.manifold).toBe(1);
    expect(idx.marketCount.total).toBe(3);
  });

  it("returns top markets sorted by OI (openInterest > liquidity fallback)", () => {
    const markets = [
      makeMarket({ id: "1", categoryslugs: ["politics"], liquidity: 100, openInterest: 500 }),
      makeMarket({ id: "2", categoryslugs: ["politics"], liquidity: 300 }),
      makeMarket({ id: "3", categoryslugs: ["politics"], liquidity: 200 }),
    ];
    const result = computePulse(markets);
    const topIds = result.find((r) => r.category === "politics")!.topMarkets.map((m) => m.id);
    expect(topIds[0]).toBe("1");
  });

  it("assigns a valid band label", () => {
    const validBands = ["Extreme Bearish", "Bearish", "Neutral", "Bullish", "Extreme Bullish"];
    const markets = politicsMarkets(3);
    const result = computePulse(markets);
    expect(validBands).toContain(result[0].band);
  });

  // -------------------------------------------------------------------
  // Bounds: every score and signal in [0, 100]
  // -------------------------------------------------------------------

  it("produces composite scores in 0–100", () => {
    const markets = politicsMarkets(5, { currentPrice: 95, oneWeekChange: 18, oneDayChange: 8 });
    const result = computePulse(markets);
    for (const idx of result) {
      expect(idx.score).toBeGreaterThanOrEqual(0);
      expect(idx.score).toBeLessThanOrEqual(100);
    }
  });

  it("produces all signal values in 0–100", () => {
    const markets = politicsMarkets(5, { oneWeekChange: -25, oneDayChange: -12 });
    const result = computePulse(markets);
    for (const idx of result) {
      for (const val of Object.values(idx.signals)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });

  // -------------------------------------------------------------------
  // Monotonicity: higher momentum → higher score
  // -------------------------------------------------------------------

  it("higher oneWeekChange produces higher momentum and score", () => {
    const bearish = politicsMarkets(5, { oneWeekChange: -15, oneDayChange: -5 });
    const bullish = politicsMarkets(5, { oneWeekChange: 15, oneDayChange: 5 });

    const [bResult] = computePulse(bearish);
    const [uResult] = computePulse(bullish);

    expect(uResult.signals.momentum).toBeGreaterThan(bResult.signals.momentum);
    expect(uResult.score).toBeGreaterThan(bResult.score);
  });

  // -------------------------------------------------------------------
  // Sensitivity: each core signal moves the composite
  // -------------------------------------------------------------------

  it("volume-weighted flow responds to oneDayChange direction", () => {
    const negative = politicsMarkets(4, { oneDayChange: -8, volume24h: 500_000 });
    const positive = politicsMarkets(4, { oneDayChange: 8, volume24h: 500_000 });

    const [neg] = computePulse(negative);
    const [pos] = computePulse(positive);

    expect(pos.signals.flow).toBeGreaterThan(neg.signals.flow);
  });

  it("breadth responds to proportion of bullish markets", () => {
    const mixed = [
      ...politicsMarkets(2, { oneDayChange: 5, volume24h: 100_000 }),
      ...politicsMarkets(2, { oneDayChange: -5, volume24h: 100_000 }),
    ].map((m, i) => ({ ...m, id: `m-${i}` }));

    const allBull = politicsMarkets(4, { oneDayChange: 5, volume24h: 100_000 })
      .map((m, i) => ({ ...m, id: `b-${i}` }));

    const [mixedIdx] = computePulse(mixed);
    const [bullIdx] = computePulse(allBull);

    expect(bullIdx.signals.breadth).toBeGreaterThan(mixedIdx.signals.breadth);
  });

  it("acceleration detects intensifying momentum", () => {
    // Steady: 7d = +7pp, today = +1pp (daily rate = 1pp/day, steady)
    const steady = politicsMarkets(4, { oneWeekChange: 7, oneDayChange: 1 });
    // Accelerating: 7d = +7pp, today = +5pp (daily rate jumped)
    const accel = politicsMarkets(4, { oneWeekChange: 7, oneDayChange: 5 })
      .map((m, i) => ({ ...m, id: `a-${i}` }));

    const [steadyIdx] = computePulse(steady);
    const [accelIdx] = computePulse(accel);

    expect(accelIdx.signals.acceleration).toBeGreaterThan(steadyIdx.signals.acceleration);
  });

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------

  it("handles all-Manifold category (no weekly data)", () => {
    const markets = Array.from({ length: 4 }, (_, i) =>
      makeMarket({
        id: `mf-${i}`,
        source: "manifold",
        categoryslugs: ["politics"],
        oneWeekChange: 0,
        oneMonthChange: 0,
        oneDayChange: 2,
        volume24h: 10_000,
      }),
    );
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    // Momentum and acceleration fall back to neutral (50)
    expect(idx.signals.momentum).toBe(50);
    expect(idx.signals.acceleration).toBe(50);
    // Flow should still respond to oneDayChange
    expect(idx.signals.flow).toBeGreaterThan(50);
  });

  it("handles zero volume gracefully (falls back to equal-weighted)", () => {
    const markets = politicsMarkets(3, { volume24h: 0 });
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    expect(idx.score).toBeGreaterThanOrEqual(0);
    expect(idx.score).toBeLessThanOrEqual(100);
  });

  it("handles all-flat markets (no price changes)", () => {
    const markets = politicsMarkets(4, { oneDayChange: 0, oneWeekChange: 0 });
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    // All momentum/flow/breadth/acceleration should be neutral
    expect(idx.signals.momentum).toBe(50);
    expect(idx.signals.flow).toBe(50);
    expect(idx.signals.breadth).toBe(50);
    expect(idx.signals.acceleration).toBe(50);
  });

  it("includes orderflow signal when orderbookDepth is present", () => {
    const markets = politicsMarkets(3, {
      orderbookDepth: {
        bids: [[0.55, 100]],
        asks: [[0.65, 50]],
        depthScore: 67,
      },
    });
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    expect(idx.signals.orderflow).toBe(67);
  });

  it("includes smartMoney signal when topHolders are present", () => {
    const markets = politicsMarkets(3, {
      topHolders: [
        { address: "0xA", shares: 800, side: "YES" },
        { address: "0xB", shares: 200, side: "NO" },
      ],
    });
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    expect(idx.signals.smartMoney).toBe(80);
  });

  it("omits optional signals when data is absent", () => {
    const markets = politicsMarkets(3);
    const result = computePulse(markets);
    const idx = result.find((r) => r.category === "politics")!;
    expect(idx.signals.orderflow).toBeUndefined();
    expect(idx.signals.smartMoney).toBeUndefined();
  });
});
