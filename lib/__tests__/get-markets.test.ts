import { describe, it, expect } from "vitest";
import { filterByCategory, sortMarkets } from "../get-markets";
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
