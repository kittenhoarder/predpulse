import { describe, expect, it } from "vitest";
import { buildEventMonitor } from "../event-monitor";
import { selectSnapshotMarkets } from "../snapshot";
import type { ProcessedMarket } from "../types";

const asOf = "2026-09-27T12:00:00.000Z";

function market(id: string, overrides: Partial<ProcessedMarket> = {}): ProcessedMarket {
  return {
    source: "polymarket", id, question: `Will ${id} happen?`, eventSlug: id, eventTitle: id,
    categoryslugs: ["economics"], categories: ["Economics"], image: "",
    currentPrice: 60, oneDayChange: 10, oneHourChange: 0, oneWeekChange: 0, oneMonthChange: 0,
    volume24h: 20_000, volume1wk: 0, volume1mo: 0, liquidity: 20_000,
    createdAt: asOf, endDate: "2026-10-27T12:00:00Z",
    outcomes: ["Yes", "No"], outcomePrices: [0.6, 0.4], bestBid: 0.59, bestAsk: 0.61,
    spread: 0.02, clobTokenId: id, description: "", resolutionSource: "", competitive: 0.8,
    ...overrides,
  };
}

describe("focused event monitor", () => {
  it("screens policy and economy contracts, ranks real moves and groups within each venue event", () => {
    const result = buildEventMonitor([
      market("sports", { categoryslugs: ["sports"], oneDayChange: 45 }),
      market("wide", { spread: 0.4, oneDayChange: 40 }),
      market("event-a", { oneDayChange: 18 }),
      market("event-a-other", { eventSlug: "event-a", oneDayChange: 12 }),
      market("event-b", { source: "kalshi", volume24h: 900, liquidity: 2_000,
        oneDayChange: 0, kalshiTradeMove24h: { currentPrice: 30, previousPrice: 40, change: -10 } }),
      market("event-c", { endDate: asOf }),
    ], asOf);
    expect(result).toMatchObject({ version: 1, examined: 5, eligible: 3 });
    expect(result.items.map((item) => item.marketId)).toEqual(["event-a", "event-b"]);
    expect(result.items[1].priceBasis).toBe("last trade price");
  });

  it("includes screened monitor contracts in the bounded snapshot for their detail links", () => {
    const polymarkets = Array.from({ length: 18 }, (_, i) => market(`p-${i}`, { oneDayChange: 30 - i }));
    const priority = market("priority", { oneDayChange: 6, categoryslugs: ["politics"] });
    const sources = { polymarkets: [...polymarkets, priority], kalshiMarkets: [], manifoldMarkets: [] };
    const selected = selectSnapshotMarkets(sources, [
      { marketId: priority.id, source: "polymarket", question: priority.question,
        outcomeLabel: "Yes", eventUrl: "https://polymarket.com/event/priority", category: "Politics",
        currentProbability: 60, change24h: 6, priceBasis: "market price", volume24h: 20_000,
        liquidity: 20_000, spreadPoints: 2 },
    ]);
    expect(selected.some((m) => m.id === priority.id)).toBe(true);
  });
});
