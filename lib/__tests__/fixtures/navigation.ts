import type { Bootstrap } from "../../bootstrap";
import type { ProcessedMarket } from "../../types";
import { buildIndexProducts } from "../../outcome-benchmark";
import { buildDecisionDistribution } from "../../decision-distribution";
import { buildEventMonitor } from "../../event-monitor";
import { buildObservationDigest } from "../../observations";
import { buildRelatedDigest } from "../../related-markets";
import { buildEventOutlooks } from "../../event-outlooks";
import { fedEvent, T1 } from "./fed-event";

export function navigationFixture(at = T1): Bootstrap {
  const market = (id: string, i: number): ProcessedMarket => ({
    id,
    source: i % 3 === 0 ? "kalshi" : "polymarket",
    question: `Will the economic policy proposal ${i + 1} pass before the deadline?`,
    eventSlug: `policy-proposal-${i + 1}`,
    eventTitle: `Economic policy proposal ${i + 1}`,
    categoryslugs: ["economics"],
    categories: ["Economics"],
    image: "",
    currentPrice: 60 + (i % 10),
    oneDayChange: 18 - i,
    oneHourChange: 1,
    oneWeekChange: 2,
    oneMonthChange: 3,
    volume24h: 30_000,
    volume1wk: 90_000,
    volume1mo: 120_000,
    liquidity: 40_000,
    bestBid: 0.59,
    bestAsk: 0.61,
    spread: 0.02,
    endDate: new Date(
      Date.parse(at) + (2 + (i % 5)) * 86_400_000,
    ).toISOString(),
    createdAt: at,
    outcomes: ["Yes", "No"],
    outcomePrices: [0.6, 0.4],
    clobTokenId: "",
    description:
      "Resolves YES under the published proposal rules; inspect the original venue contract.",
    resolutionSource: "",
    competitive: 0.8,
    kalshiAskChangeAvailable: true,
    kalshiTradeMove24h: {
      currentPrice: 60,
      previousPrice: 42 + i,
      change: 18 - i,
    },
  });
  const markets = Array.from({ length: 25 }, (_, i) => market(`move-${i}`, i));
  const event = fedEvent(undefined, at),
    decision = buildDecisionDistribution([event], at);
  const indexProducts = buildIndexProducts([event], null, null, at, decision);
  indexProducts.products = [
    {
      id: "belief-shift-economics",
      type: "belief-shift",
      category: "economics",
      name: "Economics",
      unit: "pp",
      epoch: "2026-W40",
      cohortHash: "fixture",
      members: [],
      state: "available",
      reason: null,
      coverage: { eligible: 8, admitted: 8, usable: 8, comparable: 8 },
      headline: 2.4,
      breadth: 0.25,
      materialMovePP: 3,
      pairHash: "fixture",
      history: [],
    },
  ];
  indexProducts.marketAttention = {
    id: "market-attention",
    type: "market-attention",
    methodology: "reported-event-volume-v1",
    classifier: "attention-tags-v1",
    asOf: at,
    state: "available",
    issue: null,
    screened: 20,
    included: 20,
    totalVolume: 100_000,
    exclusions: {},
    tagFallbacks: 0,
    sourceUnavailable: 0,
    categories: [
      { key: "economics", volume: 60_000, count: 12, share: 0.6, sources: [] },
      { key: "politics", volume: 40_000, count: 8, share: 0.4, sources: [] },
    ],
  };
  const eventOutlooks = buildEventOutlooks([event], at, decision);
  eventOutlooks.items.push({
    eventId: "election",
    title: "Presidential election winner",
    eventUrl: "https://polymarket.com/event/election-winner",
    topic: "Elections",
    closesAt: markets[0].endDate,
    volume24h: 100_000,
    activeContracts: 6,
    decision: null,
    contracts: Array.from({ length: 6 }, (_, i) => ({
      id: `candidate-${i}`,
      question: `Will candidate ${i + 1} win the election?`,
      label: `Candidate ${i + 1} with a long name`,
      bid: 0.29 - i * 0.03,
      ask: 0.31 - i * 0.03,
      midpoint: 0.3 - i * 0.03,
      closesAt: markets[0].endDate,
      updatedAt: at,
      rulesExcerpt: "Resolves according to certified election results.",
      rulesHash: "fixture-rules-fingerprint",
    })),
  });
  return {
    generatedAt: at,
    status: "hourly",
    sourceCounts: { polymarket: 100, kalshi: 60, manifold: 30 },
    markets: {
      markets,
      cachedAt: at,
      totalMarkets: 75,
      pageSize: 50,
      fromCache: true,
      sourceBreakdown: { polymarket: 50, kalshi: 25, manifold: 0 },
    },
    monitorMarkets: [],
    monitor: buildEventMonitor(markets, at),
    observations: buildObservationDigest(markets, at),
    related: buildRelatedDigest(markets, at),
    decisionDistribution: decision,
    eventOutlooks,
    indexProducts,
  };
}
