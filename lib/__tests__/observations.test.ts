import { describe, expect, it } from "vitest";
import { buildObservationDigest } from "../observations";
import type { ProcessedMarket } from "../types";

const asOf = "2026-09-26T19:00:00.000Z";

function market(id: string, changes: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    id, question: `Will ${id} happen?`, source: "polymarket", eventSlug: id,
    eventTitle: id, categoryslugs: ["politics"], categories: ["Politics"], image: "",
    currentPrice: 60, oneDayChange: 10, oneHourChange: 1, oneWeekChange: 2, oneMonthChange: 3,
    volume24h: 25_000, volume1wk: 40_000, volume1mo: 100_000, liquidity: 30_000,
    createdAt: asOf, endDate: "2026-10-26T19:00:00.000Z", outcomes: ["Yes", "No"],
    outcomePrices: [0.6, 0.4], bestBid: 0.59, bestAsk: 0.61, spread: 0.02,
    clobTokenId: id, description: "", resolutionSource: "", competitive: 0.5,
    ...changes,
  };
}

describe("auditable observations", () => {
  it("keeps only supported, liquid, unexpired moves and links one market per event", () => {
    const digest = buildObservationDigest([
      market("a", { oneDayChange: 12 }),
      market("a-other", { eventSlug: "a", oneDayChange: 7 }),
      market("b", { oneDayChange: -9 }),
      market("kalshi", { source: "kalshi", oneDayChange: 0, currentPrice: 70,
        volume24h: 900, liquidity: 1_500,
        kalshiTradeMove24h: { currentPrice: 60, previousPrice: 50, change: 10 } }),
      market("kalshi-missing-trade", { source: "kalshi", volume24h: 900, liquidity: 1_500 }),
      market("kalshi-low-oi", { source: "kalshi", volume24h: 900, liquidity: 300,
        kalshiTradeMove24h: { currentPrice: 60, previousPrice: 50, change: 10 } }),
      market("no-trades", { volume24h: 0 }),
      market("wide", { spread: 0.10 }),
      market("closed", { endDate: asOf }),
      market("bad-baseline", { currentPrice: 10, oneDayChange: 30 }),
      market("duplicate-copy", { question: "Will this happen? (copy)" }),
    ], asOf);

    expect(digest.coverage).toEqual({
      polymarket: { examined: 8, eligible: 3 },
      kalshi: { examined: 3, eligible: 1 },
    });
    expect(digest.items.map((item) => item.marketId)).toEqual(["a", "b", "kalshi"]);
    expect(digest.items[0]).toMatchObject({
      eventUrl: "https://polymarket.com/event/a", change24h: 12,
      volume24h: 25_000, spreadPoints: 2,
    });
    expect(digest.items[2]).toMatchObject({
      eventUrl: "https://kalshi.com/markets/kalshi", priceBasis: "last trade price",
      currentProbability: 60, change24h: 10, volume24h: 900, liquidity: 1_500,
    });
  });

  it("publishes an honest empty digest when coverage is insufficient", () => {
    expect(buildObservationDigest([market("quiet", { oneDayChange: 0 })], asOf)).toMatchObject({
      version: 2, coverage: { polymarket: { examined: 1, eligible: 0 }, kalshi: { examined: 0, eligible: 0 } }, items: [],
    });
  });
});
