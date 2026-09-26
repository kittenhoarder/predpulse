import type { ProcessedMarket } from "./types";

export interface MarketObservation {
  marketId: string;
  question: string;
  eventUrl: string;
  category: string;
  currentProbability: number;
  change24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  spreadPoints: number;
}

export interface ObservationDigest {
  asOf: string;
  source: "polymarket";
  examined: number;
  eligible: number;
  items: MarketObservation[];
}

/**
 * An auditable digest of venue-reported 24h moves. Polymarket is the only
 * supported source until the Kalshi price baseline and volume units can be
 * represented consistently. No move is inferred from category sentiment.
 */
export function buildObservationDigest(markets: ProcessedMarket[], asOf: string): ObservationDigest {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid observation timestamp");

  const examined = markets.filter((m) => m.source === "polymarket");
  const eligible = examined.filter((m) => {
    const baseline = m.currentPrice - m.oneDayChange;
    const end = Date.parse(m.endDate);
    return /^[a-z0-9-]+$/i.test(m.eventSlug) &&
      m.question.trim().length > 0 && !/\(copy\)\s*$/i.test(m.question) &&
      Number.isFinite(m.currentPrice) && m.currentPrice >= 2 && m.currentPrice <= 98 &&
      Number.isFinite(m.oneDayChange) && Math.abs(m.oneDayChange) >= 5 && Math.abs(m.oneDayChange) <= 50 &&
      baseline >= 0 && baseline <= 100 &&
      Number.isFinite(m.volume24h) && m.volume24h >= 10_000 &&
      Number.isFinite(m.liquidity) && m.liquidity >= 10_000 &&
      Number.isFinite(m.spread) && m.spread > 0 && m.spread <= 0.05 &&
      Number.isFinite(end) && end > now + 24 * 60 * 60_000;
  });

  // One market per event. Prefer a move backed by volume, while preventing a
  // single exceptionally large market from crowding out all other events.
  const seen = new Set<string>();
  const items = [...eligible]
    .sort((a, b) => Math.abs(b.oneDayChange) * Math.log10(1 + b.volume24h) -
      Math.abs(a.oneDayChange) * Math.log10(1 + a.volume24h))
    .filter((m) => {
      if (seen.has(m.eventSlug)) return false;
      seen.add(m.eventSlug);
      return true;
    })
    .slice(0, 3)
    .map((m) => ({
      marketId: m.id,
      question: m.question,
      eventUrl: `https://polymarket.com/event/${m.eventSlug}`,
      category: m.categories[0] || "Market",
      currentProbability: m.currentPrice,
      change24h: m.oneDayChange,
      volume24hUsd: m.volume24h,
      liquidityUsd: m.liquidity,
      spreadPoints: m.spread * 100,
    }));

  return { asOf, source: "polymarket", examined: examined.length, eligible: eligible.length, items };
}
