import { describe, it, expect } from "vitest";
import { filterByCategory, filterBySize, getMarkets, pickCoreIndexMarkets, SIZE_THRESHOLDS, sortMarkets } from "../get-markets";
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
    currentPrice: 50,
    oneDayChange: 5,
    oneHourChange: 1,
    oneWeekChange: 2,
    oneMonthChange: 10,
    volume24h: 100_000,
    volume1wk: 500_000,
    volume1mo: 2_000_000,
    liquidity: 50_000,
    createdAt: "2025-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.5, 0.5],
    bestBid: 0.49,
    bestAsk: 0.51,
    spread: 0.02,
    clobTokenId: "tok-1",
    description: "Test description",
    resolutionSource: "https://example.com",
    competitive: 0.8,
    ...overrides,
  };
}

describe("filterByCategory", () => {
  const markets = [
    makeMarket({ id: "1", categoryslugs: ["politics"], categories: ["Politics"] }),
    makeMarket({ id: "2", categoryslugs: ["crypto"], categories: ["Crypto"] }),
    makeMarket({ id: "3", categoryslugs: ["politics", "economics"], categories: ["Politics", "Economics"] }),
  ];

  it("returns all markets when category is 'all'", () => {
    expect(filterByCategory(markets, "all")).toHaveLength(3);
  });

  it("returns all markets when category is empty", () => {
    expect(filterByCategory(markets, "")).toHaveLength(3);
  });

  it("filters by category slug", () => {
    const result = filterByCategory(markets, "crypto");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("filters case-insensitively", () => {
    const result = filterByCategory(markets, "Politics");
    expect(result).toHaveLength(2);
  });

  it("matches partial category labels", () => {
    const result = filterByCategory(markets, "econ");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });
});

describe("sortMarkets", () => {
  const markets = [
    makeMarket({ id: "a", oneDayChange: 5, oneHourChange: 1, volume24h: 100, liquidity: 50, createdAt: "2025-01-01T00:00:00Z" }),
    makeMarket({ id: "b", oneDayChange: -10, oneHourChange: 3, volume24h: 200, liquidity: 30, createdAt: "2025-06-01T00:00:00Z" }),
    makeMarket({ id: "c", oneDayChange: 2, oneHourChange: -5, volume24h: 50, liquidity: 100, createdAt: "2025-03-01T00:00:00Z" }),
  ];

  it("sorts by absolute 24h change for 'movers'", () => {
    const result = sortMarkets(markets, "movers");
    expect(result.map((m) => m.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by absolute 1h change for 'movers1h'", () => {
    const result = sortMarkets(markets, "movers1h");
    expect(result.map((m) => m.id)).toEqual(["c", "b", "a"]);
  });

  it("filters and sorts gainers only", () => {
    const result = sortMarkets(markets, "gainers");
    expect(result.every((m) => m.oneDayChange > 0)).toBe(true);
    expect(result.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("filters and sorts losers only", () => {
    const result = sortMarkets(markets, "losers");
    expect(result.every((m) => m.oneDayChange < 0)).toBe(true);
    expect(result.map((m) => m.id)).toEqual(["b"]);
  });

  it("sorts by volume descending", () => {
    const result = sortMarkets(markets, "volume");
    expect(result.map((m) => m.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by liquidity descending", () => {
    const result = sortMarkets(markets, "liquidity");
    expect(result.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by creation date descending for 'new'", () => {
    const result = sortMarkets(markets, "new");
    expect(result.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("filters to watchlist IDs", () => {
    const result = sortMarkets(markets, "watchlist", ["a", "c"]);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("does not mutate the original array", () => {
    const original = [...markets];
    sortMarkets(markets, "volume");
    expect(markets.map((m) => m.id)).toEqual(original.map((m) => m.id));
  });
});

describe("getMarkets pagination limits", () => {
  const polymarkets = Array.from({ length: 40 }, (_, i) =>
    makeMarket({
      id: `p-${i}`,
      source: "polymarket",
      oneDayChange: 100 - i,
      categoryslugs: ["politics"],
      categories: ["Politics"],
    }),
  );
  const kalshiMarkets = Array.from({ length: 40 }, (_, i) =>
    makeMarket({
      id: `k-${i}`,
      source: "kalshi",
      oneDayChange: 99 - i,
      categoryslugs: ["politics"],
      categories: ["Politics"],
    }),
  );
  const manifoldMarkets = Array.from({ length: 40 }, (_, i) =>
    makeMarket({
      id: `m-${i}`,
      source: "manifold",
      oneDayChange: 98 - i,
      categoryslugs: ["politics"],
      categories: ["Politics"],
    }),
  );

  const sources = { polymarkets, kalshiMarkets, manifoldMarkets };

  it("supports limit=25", async () => {
    const res = await getMarkets({ limit: 25, source: "all" }, sources);
    expect(res.pageSize).toBe(25);
    expect(res.markets.length).toBeLessThanOrEqual(25);
    expect(res.totalMarkets).toBe(120);
  });

  it("supports limit=50", async () => {
    const res = await getMarkets({ limit: 50, source: "all" }, sources);
    expect(res.pageSize).toBe(50);
    expect(res.markets.length).toBeLessThanOrEqual(50);
  });

  it("supports limit=100", async () => {
    const res = await getMarkets({ limit: 100, source: "all" }, sources);
    expect(res.pageSize).toBe(100);
    expect(res.markets.length).toBeLessThanOrEqual(100);
  });
});

describe("pickCoreIndexMarkets", () => {
  it("caps each category/source bucket at 20 markets", () => {
    // Fixtures must clear per-source size thresholds so filterBySize (now applied
    // inside pickCoreIndexMarkets) doesn't strip them before the bucket ranking:
    //   Polymarket: volume24h >= 1_000 OR liquidity >= 5_000
    //   Kalshi:     liquidity >= 500
    const polymarkets = Array.from({ length: 30 }, (_, i) =>
      makeMarket({
        id: `p-${i}`,
        source: "polymarket",
        categoryslugs: ["economics"],
        categories: ["Economics"],
        openInterest: 10_000 + i * 10,
        liquidity: 5_000 + i,   // >= 5_000 threshold
        volume24h: 1_000 + i,   // >= 1_000 threshold
      }),
    );
    const kalshiMarkets = Array.from({ length: 30 }, (_, i) =>
      makeMarket({
        id: `k-${i}`,
        source: "kalshi",
        categoryslugs: ["economics"],
        categories: ["Economics"],
        openInterest: 9_000 + i * 9,
        liquidity: 1_000 + i,   // >= 500 threshold
        volume24h: 0,
      }),
    );

    const selected = pickCoreIndexMarkets(polymarkets, kalshiMarkets);
    const polyCount = selected.filter((m) => m.source === "polymarket").length;
    const kalshiCount = selected.filter((m) => m.source === "kalshi").length;

    expect(polyCount).toBe(20);
    expect(kalshiCount).toBe(20);
  });

  it("keeps all markets in small category/source buckets", () => {
    const polymarkets = Array.from({ length: 6 }, (_, i) =>
      makeMarket({
        id: `p-small-${i}`,
        source: "polymarket",
        categoryslugs: ["climate"],
        categories: ["Climate"],
      }),
    );

    const selected = pickCoreIndexMarkets(polymarkets, []);
    expect(selected).toHaveLength(6);
  });
});

describe("filterBySize", () => {
  it("is a no-op when hideSmall is false", () => {
    const markets = [
      makeMarket({ id: "1", source: "polymarket", volume24h: 0, liquidity: 0 }),
      makeMarket({ id: "2", source: "kalshi",     volume24h: 0, liquidity: 0 }),
      makeMarket({ id: "3", source: "manifold",   volume24h: 0, liquidity: 0 }),
    ];
    expect(filterBySize(markets, false)).toHaveLength(3);
  });

  it("filters all sub-threshold markets when hideSmall is true", () => {
    const markets = [
      makeMarket({ id: "1", source: "polymarket", volume24h: 0,   liquidity: 0   }),
      makeMarket({ id: "2", source: "kalshi",     volume24h: 0,   liquidity: 0   }),
      makeMarket({ id: "3", source: "manifold",   volume24h: 0,   liquidity: 0   }),
    ];
    expect(filterBySize(markets, true)).toHaveLength(0);
  });

  describe("Polymarket thresholds", () => {
    const { volume24h: minVol, liquidity: minLiq } = SIZE_THRESHOLDS.polymarket;

    it("keeps a market exactly at the volume24h threshold", () => {
      const m = makeMarket({ source: "polymarket", volume24h: minVol, liquidity: 0 });
      expect(filterBySize([m], true)).toHaveLength(1);
    });

    it("keeps a market exactly at the liquidity threshold", () => {
      const m = makeMarket({ source: "polymarket", volume24h: 0, liquidity: minLiq });
      expect(filterBySize([m], true)).toHaveLength(1);
    });

    it("drops a market one below both thresholds", () => {
      const m = makeMarket({ source: "polymarket", volume24h: minVol - 1, liquidity: minLiq - 1 });
      expect(filterBySize([m], true)).toHaveLength(0);
    });

    it("keeps a market exceeding both thresholds", () => {
      const m = makeMarket({ source: "polymarket", volume24h: minVol * 10, liquidity: minLiq * 10 });
      expect(filterBySize([m], true)).toHaveLength(1);
    });
  });

  describe("Kalshi thresholds", () => {
    const { liquidity: minLiq } = SIZE_THRESHOLDS.kalshi;

    it("keeps a market exactly at the liquidity threshold", () => {
      const m = makeMarket({ source: "kalshi", volume24h: 0, liquidity: minLiq });
      expect(filterBySize([m], true)).toHaveLength(1);
    });

    it("drops a market one below the liquidity threshold", () => {
      const m = makeMarket({ source: "kalshi", volume24h: 0, liquidity: minLiq - 1 });
      expect(filterBySize([m], true)).toHaveLength(0);
    });

    it("keeps a Kalshi market with zero volume24h but sufficient liquidity", () => {
      // Kalshi markets legitimately have zero volume24h on quiet days;
      // liquidity (OI proxy) is the meaningful signal.
      const m = makeMarket({ source: "kalshi", volume24h: 0, liquidity: minLiq + 1 });
      expect(filterBySize([m], true)).toHaveLength(1);
    });
  });

  describe("Manifold thresholds", () => {
    const { volume24h: minVol, liquidity: minLiq } = SIZE_THRESHOLDS.manifold;

    it("keeps a market at the volume24h floor", () => {
      const m = makeMarket({ source: "manifold", volume24h: minVol, liquidity: 0 });
      expect(filterBySize([m], true)).toHaveLength(1);
    });

    it("keeps a market at the liquidity floor", () => {
      const m = makeMarket({ source: "manifold", volume24h: 0, liquidity: minLiq });
      expect(filterBySize([m], true)).toHaveLength(1);
    });

    it("drops a market below both floors", () => {
      const m = makeMarket({ source: "manifold", volume24h: minVol - 1, liquidity: minLiq - 1 });
      expect(filterBySize([m], true)).toHaveLength(0);
    });
  });

  it("handles a mixed-source list correctly", () => {
    const markets = [
      makeMarket({ id: "p-small", source: "polymarket", volume24h: 0,     liquidity: 100   }), // below both
      makeMarket({ id: "p-big",   source: "polymarket", volume24h: 5_000, liquidity: 0     }), // volume qualifies
      makeMarket({ id: "k-small", source: "kalshi",     volume24h: 0,     liquidity: 100   }), // below liq floor
      makeMarket({ id: "k-big",   source: "kalshi",     volume24h: 0,     liquidity: 1_000 }), // liq qualifies
      makeMarket({ id: "m-small", source: "manifold",   volume24h: 50,    liquidity: 200   }), // below both
      makeMarket({ id: "m-big",   source: "manifold",   volume24h: 200,   liquidity: 0     }), // volume qualifies
    ];
    const result = filterBySize(markets, true);
    expect(result.map((m) => m.id)).toEqual(["p-big", "k-big", "m-big"]);
  });
});
