import { describe, expect, it } from "vitest";
import { isSafeSnapshot, selectSnapshotMarkets, validateSnapshot, type PublishedSnapshot } from "../snapshot";
import { marketsFromSnapshot, snapshotAgeStatus } from "../snapshot-response";
import type { ProcessedMarket } from "../types";

function market(source: ProcessedMarket["source"], id: string, category = "politics"): ProcessedMarket {
  return {
    source, id, question: `Will ${id} happen?`, eventSlug: id, eventTitle: id,
    categoryslugs: [category], categories: [category], image: "", currentPrice: 50,
    oneDayChange: 2, oneHourChange: 1, oneWeekChange: 3, oneMonthChange: 4,
    volume24h: 10_000, volume1wk: 20_000, volume1mo: 30_000, liquidity: 10_000,
    createdAt: "2026-01-01T00:00:00Z", endDate: "2027-01-01T00:00:00Z",
    outcomes: ["Yes", "No"], outcomePrices: [0.5, 0.5], bestBid: 0.49,
    bestAsk: 0.51, spread: 0.02, clobTokenId: id,
    description: "a".repeat(1000), resolutionSource: "", competitive: 0.5,
    topHolders: [{ address: "test", shares: 1, side: "YES" }],
  };
}

function snapshot(overrides: Partial<PublishedSnapshot> = {}): PublishedSnapshot {
  return {
    version: 1, generatedAt: new Date().toISOString(),
    sourceCounts: { polymarket: 100, kalshi: 60, manifold: 20 },
    markets: [market("polymarket", "p"), market("kalshi", "k"), market("manifold", "m")],
    pulse: [{ category: "politics", label: "Politics", score: 50 } as PublishedSnapshot["pulse"][number]],
    ...overrides,
  };
}

describe("snapshot publication safeguards", () => {
  it("bounds the selected universe and strips oversized enrichment", () => {
    const sources = {
      polymarkets: Array.from({ length: 100 }, (_, i) => market("polymarket", `p${i}`)),
      kalshiMarkets: [market("kalshi", "k0")], manifoldMarkets: [market("manifold", "m0")],
    };
    const selected = selectSnapshotMarkets(sources);
    expect(selected.filter((m) => m.source === "polymarket")).toHaveLength(15);
    expect(selected).toHaveLength(17);
    expect(selected[0].description).toHaveLength(500);
    expect(selected[0].topHolders).toBeUndefined();
  });

  it("rejects invalid prices and empty indices", () => {
    expect(() => validateSnapshot(snapshot({ markets: [market("polymarket", "p"), { ...market("kalshi", "k"), currentPrice: 120 }] }))).toThrow();
    expect(() => validateSnapshot(snapshot({ pulse: [] }))).toThrow();
  });

  it("quarantines missing or collapsed core sources without evicting prior data", () => {
    const previous = snapshot();
    expect(isSafeSnapshot(snapshot({ sourceCounts: { polymarket: 0, kalshi: 60, manifold: 20 } }), previous)).toBe(false);
    expect(isSafeSnapshot(snapshot({ sourceCounts: { polymarket: 49, kalshi: 60, manifold: 20 } }), previous)).toBe(false);
    expect(isSafeSnapshot(snapshot({ sourceCounts: { polymarket: 80, kalshi: 45, manifold: 0 } }), previous)).toBe(true);
  });

  it("filters and paginates saved data without fetching upstream", async () => {
    const result = await marketsFromSnapshot(snapshot(), { source: "kalshi", category: "politics", limit: 25 });
    expect(result.markets.map((m) => m.id)).toEqual(["k"]);
    expect(result.totalMarkets).toBe(1);
    expect(result.fromCache).toBe(true);
  });
});

describe("snapshot freshness", () => {
  it("distinguishes hourly, delayed and stale observations", () => {
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    expect(snapshotAgeStatus(ago(30))).toBe("hourly");
    expect(snapshotAgeStatus(ago(90))).toBe("delayed");
    expect(snapshotAgeStatus(ago(181))).toBe("stale");
  });
});
