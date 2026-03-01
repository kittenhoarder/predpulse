import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { computeIndices } from "../indices";
import type { ProcessedMarket } from "../types";

const TEST_STORE = path.join(os.tmpdir(), "predpulse-index-store-test.json");

function makeMarket(overrides: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    id: "m-1",
    question: "Will GDP growth increase this quarter?",
    source: "polymarket",
    eventSlug: "event",
    eventTitle: "Event",
    categoryslugs: ["economics"],
    categories: ["Economics"],
    image: "",
    currentPrice: 60,
    oneDayChange: 4,
    oneHourChange: 0.6,
    oneWeekChange: 9,
    oneMonthChange: 15,
    volume24h: 100000,
    volume1wk: 500000,
    volume1mo: 2000000,
    liquidity: 80000,
    createdAt: new Date().toISOString(),
    endDate: "2027-12-31T00:00:00Z",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.6, 0.4],
    bestBid: 0.59,
    bestAsk: 0.61,
    spread: 0.02,
    clobTokenId: "tok",
    description: "",
    resolutionSource: "",
    competitive: 0.8,
    openInterest: 70000,
    polarity: 1,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.INDEX_STORE_PATH = TEST_STORE;
  if (fs.existsSync(TEST_STORE)) fs.unlinkSync(TEST_STORE);
});

describe("computeIndices (operator index families)", () => {
  it("inverts directional score when polarity flips", () => {
    const bullish = Array.from({ length: 3 }, (_, i) =>
      makeMarket({ id: `b-${i}`, polarity: 1, oneDayChange: 6, oneWeekChange: 12 }),
    );
    const bearish = bullish.map((m, i) => ({ ...m, id: `r-${i}`, polarity: -1 }));

    const bull = computeIndices(bullish, { family: "directional", sourceScope: "core", persist: false });
    const bear = computeIndices(bearish, { family: "directional", sourceScope: "core", persist: false });

    const bullScore = bull.indices.find((i) => i.category === "economics")!.score;
    const bearScore = bear.indices.find((i) => i.category === "economics")!.score;

    expect(bullScore).toBeGreaterThan(bearScore);
  });

  it("gates optional signals below coverage threshold", () => {
    const lowCoverage = Array.from({ length: 3 }, (_, i) =>
      makeMarket({
        id: `lc-${i}`,
        orderbookDepth: { bids: [[0.58, 100]], asks: [[0.62, 50]], depthScore: 70 },
        topHolders: [{ address: "0xA", shares: 1000, side: "YES" }],
      }),
    );

    const highCoverage = Array.from({ length: 5 }, (_, i) =>
      makeMarket({
        id: `hc-${i}`,
        orderbookDepth: { bids: [[0.58, 100]], asks: [[0.62, 50]], depthScore: 70 },
        topHolders: [{ address: "0xA", shares: 800, side: "YES" }, { address: "0xB", shares: 200, side: "NO" }],
      }),
    );

    const low = computeIndices(lowCoverage, { family: "directional", sourceScope: "core", persist: false });
    const high = computeIndices(highCoverage, { family: "directional", sourceScope: "core", persist: false });

    const lowSignals = low.indices.find((i) => i.category === "economics")!.signals;
    const highSignals = high.indices.find((i) => i.category === "economics")!.signals;

    expect(lowSignals.orderflow).toBeUndefined();
    expect(lowSignals.smartMoney).toBeUndefined();
    expect(highSignals.orderflow).toBeDefined();
    expect(highSignals.smartMoney).toBeDefined();
  });

  it("degrades confidence when only one core source is available", () => {
    const dualSource = [
      ...Array.from({ length: 3 }, (_, i) => makeMarket({ id: `p-${i}`, source: "polymarket" })),
      ...Array.from({ length: 3 }, (_, i) =>
        makeMarket({ id: `k-${i}`, source: "kalshi", bestBid: 55, bestAsk: 57, spread: 2, currentPrice: 57 }),
      ),
    ];

    const singleSource = Array.from({ length: 3 }, (_, i) => makeMarket({ id: `s-${i}`, source: "polymarket" }));

    const dual = computeIndices(dualSource, { family: "directional", sourceScope: "core", persist: false });
    const single = computeIndices(singleSource, { family: "directional", sourceScope: "core", persist: false });

    const dualConfidence = dual.indices.find((i) => i.category === "economics")!.confidence;
    const singleConfidence = single.indices.find((i) => i.category === "economics")!.confidence;

    expect(dualConfidence).toBeGreaterThan(singleConfidence);
  });

  it("returns all index families when requested", () => {
    const markets = Array.from({ length: 5 }, (_, i) => makeMarket({ id: `all-${i}` }));
    const result = computeIndices(markets, { family: "all", sourceScope: "core", persist: false });
    const families = new Set(result.indices.filter((i) => i.category === "economics").map((i) => i.family));

    expect(families.has("directional")).toBe(true);
    expect(families.has("liquidity")).toBe(true);
    expect(families.has("divergence")).toBe(true);
    expect(families.has("certainty")).toBe(true);
  });
});
