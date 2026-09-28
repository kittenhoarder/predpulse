import { describe, expect, it } from "vitest";
import { buildRelatedDigest, validateRelatedDigest } from "../related-markets";
import type { ProcessedMarket } from "../types";

const asOf = "2026-09-28T12:00:00Z";
function market(source: ProcessedMarket["source"], id: string, question: string, overrides: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    source, id, question, eventSlug: id.toLowerCase(), eventTitle: question,
    categoryslugs: ["economics"], categories: ["Economics"], image: "", currentPrice: 48,
    oneDayChange: 0, oneHourChange: 0, oneWeekChange: 0, oneMonthChange: 0,
    volume24h: 3_000, volume1wk: 0, volume1mo: 0, liquidity: 7_000,
    createdAt: asOf, endDate: "2026-12-01T12:00:00Z", outcomes: ["Yes", "No"],
    outcomePrices: [0.48, 0.52], bestBid: 0.45, bestAsk: 0.49, spread: 0.04,
    clobTokenId: id, description: "Source rule", resolutionSource: "", competitive: 0.5,
    ...overrides,
  };
}

describe("automatic related markets", () => {
  it("finds a topic across sources without asserting equivalence or computing a gap", () => {
    const markets = [
      market("polymarket", "p1", "Will the US inflation rate exceed 3 percent in 2026?"),
      market("kalshi", "K1", "Will US inflation rate exceed 3 percent in 2026?", { currentPrice: 52 }),
    ];
    const digest = buildRelatedDigest(markets, asOf);
    expect(digest.items).toHaveLength(1);
    expect(digest.items[0].markets.map((m) => m.priceBasis)).toEqual(["outcome market price", "YES ask"]);
    expect(digest.items[0]).not.toHaveProperty("gapPP");
    expect(digest.items[0].basis).toBe("title");
    expect(digest.items[0].sharedTerms).toContain("inflation");
    expect(buildRelatedDigest(markets, asOf).items[0].id).toBe(digest.items[0].id);
  });

  it("excludes sports, thin markets, expired and distant deadlines", () => {
    const base = market("polymarket", "p1", "Will US inflation rate exceed 3 percent in 2026?");
    const kalshi = market("kalshi", "K1", "Will US inflation rate exceed 3 percent in 2026?");
    expect(buildRelatedDigest([base, { ...kalshi, categoryslugs: ["sports"] }], asOf).items).toHaveLength(0);
    expect(buildRelatedDigest([base, { ...kalshi, volume24h: 0, liquidity: 0 }], asOf).items).toHaveLength(0);
    const categoryOnly = buildRelatedDigest([base, { ...kalshi, endDate: "2027-09-01T12:00:00Z" }], asOf);
    expect(categoryOnly.items[0]).toMatchObject({ basis: "category", sharedTerms: [] });
    expect(buildRelatedDigest([base, { ...kalshi, endDate: "2026-09-01T12:00:00Z" }], asOf).items).toHaveLength(0);
  });

  it("shows a category overview when no title pair exists without claiming an event match", () => {
    const digest = buildRelatedDigest([
      market("polymarket", "p1", "Will unemployment in California exceed five percent?"),
      market("kalshi", "K1", "Will annual inflation in Britain exceed four percent?"),
    ], asOf);
    expect(digest.items).toHaveLength(1);
    expect(digest.items[0]).toMatchObject({ basis: "category", category: "economics", sharedTerms: [] });
  });

  it("uses one market only once and validates links at the snapshot boundary", () => {
    const markets = [
      market("polymarket", "p1", "Will US inflation rate exceed 3 percent in 2026?"),
      market("polymarket", "p2", "Will US inflation rate exceed 3 percent in 2026?"),
      market("kalshi", "K1", "Will US inflation rate exceed 3 percent in 2026?"),
    ];
    const digest = buildRelatedDigest(markets, asOf);
    expect(digest.items).toHaveLength(1);
    expect(() => validateRelatedDigest({ ...digest, items: [{ ...digest.items[0], markets: [
      { ...digest.items[0].markets[0], eventUrl: "https://example.org/phishing" },
      digest.items[0].markets[1],
    ] }] }, asOf)).toThrow();
  });
});
