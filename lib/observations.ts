import type { ProcessedMarket } from "./types";
import { isReliableKalshiMove } from "./market-quality";

type Source = "polymarket" | "kalshi";

export interface MarketObservation {
  marketId: string;
  source: Source;
  question: string;
  outcomeLabel: string;
  eventUrl: string;
  category: string;
  currentProbability: number;
  change24h: number;
  priceBasis: "market price" | "last trade price";
  volume24h: number;
  liquidity: number;
  spreadPoints: number;
}

export interface ObservationDigest {
  version: 2;
  asOf: string;
  coverage: Record<Source, { examined: number; eligible: number }>;
  items: MarketObservation[];
}

export function screenObservation(m: ProcessedMarket, now: number): MarketObservation | null {
  const kalshi = m.source === "kalshi";
  if (m.source !== "polymarket" && !kalshi) return null;

  const move = kalshi ? m.kalshiTradeMove24h : undefined;
  const current = kalshi ? move?.currentPrice : m.currentPrice;
  const change = kalshi ? move?.change : m.oneDayChange;
  const previous = kalshi ? move?.previousPrice : current! - change!;
  const outcomeLabel = kalshi ? "YES" : m.outcomes[0]?.trim();
  const end = Date.parse(m.endDate);

  if (!m.question?.trim() || /\(copy\)\s*$/i.test(m.question) ||
      !outcomeLabel || (!kalshi && /\bvs?\.?\s/i.test(m.question) && /^(yes|no)$/i.test(outcomeLabel)) ||
      !Number.isFinite(current) || current! < 2 || current! > 98 ||
      !Number.isFinite(change) || Math.abs(change!) < 5 || Math.abs(change!) > 50 ||
      !Number.isFinite(previous) || previous! <= 0 || previous! >= 100 ||
      (kalshi ? !isReliableKalshiMove(m.volume24h, m.liquidity, m.spread) :
        !Number.isFinite(m.volume24h) || m.volume24h < 10_000 ||
        !Number.isFinite(m.liquidity) || m.liquidity < 10_000 ||
        !Number.isFinite(m.spread) || m.spread <= 0 || m.spread > 0.05) ||
      !Number.isFinite(end) || end <= now + 24 * 60 * 60_000) return null;

  const eventUrl = kalshi
    ? /^[a-z0-9-]+$/i.test(m.eventSlug) ? `https://kalshi.com/markets/${m.eventSlug}` : null
    : /^[a-z0-9-]+$/i.test(m.eventSlug) ? `https://polymarket.com/event/${m.eventSlug}` : null;
  if (!eventUrl) return null;

  return {
    marketId: m.id, source: m.source as Source, question: m.question, outcomeLabel, eventUrl,
    category: m.categories[0] || "Market", currentProbability: current!, change24h: change!,
    priceBasis: kalshi ? "last trade price" : "market price", volume24h: m.volume24h,
    liquidity: m.liquidity, spreadPoints: m.spread * 100,
  };
}

/** Screens each venue in its own units and takes two distinct events per venue. */
export function buildObservationDigest(markets: ProcessedMarket[], asOf: string): ObservationDigest {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid observation timestamp");

  const coverage: ObservationDigest["coverage"] = {
    polymarket: { examined: 0, eligible: 0 },
    kalshi: { examined: 0, eligible: 0 },
  };
  const bySource: Record<Source, MarketObservation[]> = { polymarket: [], kalshi: [] };

  for (const market of markets) {
    if (market.source !== "polymarket" && market.source !== "kalshi") continue;
    const source = market.source;
    coverage[source].examined++;
    const item = screenObservation(market, now);
    if (!item) continue;
    coverage[source].eligible++;
    bySource[source].push(item);
  }

  const items: MarketObservation[] = [];
  for (const source of ["polymarket", "kalshi"] as const) {
    const seenEvents = new Set<string>();
    const selected = bySource[source]
      .sort((a, b) => Math.abs(b.change24h) * Math.log10(1 + b.volume24h) -
        Math.abs(a.change24h) * Math.log10(1 + a.volume24h))
      .filter((item) => {
        if (seenEvents.has(item.eventUrl)) return false;
        seenEvents.add(item.eventUrl);
        return true;
      })
      .slice(0, 2);
    items.push(...selected);
  }

  return { version: 2, asOf, coverage, items };
}
