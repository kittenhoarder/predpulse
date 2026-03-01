import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { computePulse } from "../pulse";
import type { ProcessedMarket } from "../types";

const TEST_STORE = path.join(os.tmpdir(), "predpulse-pulse-store-test.json");

function makeMarket(overrides: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    id: "m-1",
    question: "Will candidate A win?",
    source: "polymarket",
    eventSlug: "event",
    eventTitle: "Event",
    categoryslugs: ["politics"],
    categories: ["Politics"],
    image: "",
    currentPrice: 58,
    oneDayChange: 3,
    oneHourChange: 0.5,
    oneWeekChange: 7,
    oneMonthChange: 12,
    volume24h: 100000,
    volume1wk: 500000,
    volume1mo: 2000000,
    liquidity: 70000,
    createdAt: new Date().toISOString(),
    endDate: "2027-12-31T00:00:00Z",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.58, 0.42],
    bestBid: 0.57,
    bestAsk: 0.59,
    spread: 0.02,
    clobTokenId: "tok",
    description: "",
    resolutionSource: "",
    competitive: 0.8,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.INDEX_STORE_PATH = TEST_STORE;
  if (fs.existsSync(TEST_STORE)) fs.unlinkSync(TEST_STORE);
});

describe("computePulse (directional compatibility alias)", () => {
  it("returns category index when at least 3 markets exist", () => {
    const markets = Array.from({ length: 3 }, (_, i) => makeMarket({ id: `p-${i}` }));
    const result = computePulse(markets);
    expect(result.find((r) => r.category === "politics")).toBeDefined();
  });

  it("preserves legacy shape and includes directional metadata", () => {
    const markets = Array.from({ length: 3 }, (_, i) => makeMarket({ id: `p-${i}` }));
    const idx = computePulse(markets)[0];

    expect(idx.signals).toHaveProperty("momentum");
    expect(idx.signals).toHaveProperty("flow");
    expect(idx.signals).toHaveProperty("breadth");
    expect(idx.signals).toHaveProperty("acceleration");
    expect(idx.signals).toHaveProperty("level");
    expect(idx.family).toBe("directional");
    expect(idx.horizon).toBe("24h");
    expect(typeof idx.confidence).toBe("number");
  });

  it("keeps scores bounded in [0,100]", () => {
    const markets = Array.from({ length: 5 }, (_, i) =>
      makeMarket({ id: `b-${i}`, oneDayChange: i % 2 === 0 ? 10 : -10, oneWeekChange: i % 2 === 0 ? 15 : -15 }),
    );
    const result = computePulse(markets);
    for (const idx of result) {
      expect(idx.score).toBeGreaterThanOrEqual(0);
      expect(idx.score).toBeLessThanOrEqual(100);
    }
  });

  it("persists snapshots and returns non-empty history", () => {
    const markets = Array.from({ length: 3 }, (_, i) => makeMarket({ id: `h-${i}` }));
    const first = computePulse(markets)[0];
    const second = computePulse(markets)[0];

    expect(first.history.length).toBeGreaterThanOrEqual(1);
    expect(second.history.length).toBeGreaterThanOrEqual(1);
  });

  it("updates market counts by source", () => {
    const markets: ProcessedMarket[] = [
      makeMarket({ id: "1", source: "polymarket" }),
      makeMarket({ id: "2", source: "kalshi", currentPrice: 57, bestBid: 55, bestAsk: 57, spread: 2 }),
      makeMarket({ id: "3", source: "manifold", currentPrice: 54, bestBid: 0.54, bestAsk: 0.54, spread: 0 }),
    ];

    const idx = computePulse(markets)[0];
    expect(idx.marketCount.polymarket).toBe(1);
    expect(idx.marketCount.kalshi).toBe(1);
    expect(idx.marketCount.manifold).toBe(1);
  });
});
