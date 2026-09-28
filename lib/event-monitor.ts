import type { ProcessedMarket } from "./types";
import { screenObservation, type MarketObservation } from "./observations";

// This is a disclosed topic screen, not a registry of equivalent cross-venue contracts.
const TOPICS = new Set(["economics", "politics", "geopolitics"]);
const MAX_ITEMS = 12;

export interface EventMonitor {
  version: 1;
  asOf: string;
  examined: number;
  eligible: number;
  items: MarketObservation[];
}

export function buildEventMonitor(markets: ProcessedMarket[], asOf: string): EventMonitor {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid monitor timestamp");
  const scoped = markets.filter((m) => m.categoryslugs.some((slug) => TOPICS.has(slug)));
  const eligible = scoped.map((m) => screenObservation(m, now))
    .filter((item): item is MarketObservation => item !== null)
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h) ||
      a.source.localeCompare(b.source) || a.marketId.localeCompare(b.marketId));
  const seen = new Set<string>();
  const items = eligible.filter((item) => {
    // Monitor events remain scoped to one source. Related topics live separately.
    const key = `${item.source}:${item.eventUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_ITEMS);
  return { version: 1, asOf, examined: scoped.length, eligible: eligible.length, items };
}
