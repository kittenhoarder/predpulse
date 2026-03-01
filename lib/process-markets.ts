import type { GammaEvent, GammaMarket, GammaTag, ProcessedMarket } from "./types";
import type { PolymarketOrderbookDepth, PolymarketSmartMoney } from "./gamma";
import { computeDepthScore } from "./orderbook";
import { inferPolarity } from "./polarity";

/**
 * Build a slug→label lookup from the live Gamma /tags response.
 * Falls back to title-casing the slug when the label is missing.
 */
export function buildTagMap(tags: GammaTag[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of tags) {
    if (tag.slug) map.set(tag.slug, tag.label || titleCase(tag.slug));
  }
  return map;
}

function titleCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extract tag slugs and labels from an event, using the live tagMap for
 * authoritative label lookup. Falls back to ["general"] when no tags present.
 */
function extractCategories(
  event: GammaEvent,
  tagMap: Map<string, string>
): { slugs: string[]; labels: string[] } {
  if (!event.tags || event.tags.length === 0) {
    return { slugs: ["general"], labels: ["General"] };
  }
  const slugs: string[] = [];
  const labels: string[] = [];
  for (const tag of event.tags) {
    if (!tag.slug) continue;
    slugs.push(tag.slug);
    labels.push(tagMap.get(tag.slug) ?? tag.label ?? titleCase(tag.slug));
  }
  if (slugs.length === 0) return { slugs: ["general"], labels: ["General"] };
  return { slugs, labels };
}

/**
 * Parse a Gamma API JSON-string field (e.g. outcomePrices / outcomes / clobTokenIds).
 * Returns an empty array on any parse failure.
 */
export function parseJsonArray<T>(raw: string | T[]): T[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Convert fractional price change to rounded percentage points. */
function toPP(fractional: number | undefined | null): number {
  return Math.round((fractional ?? 0) * 10000) / 100;
}


/**
 * Transform a single raw GammaMarket (with its parent event) into the leaner
 * ProcessedMarket shape. Returns null for markets that should be excluded.
 * obMap optionally provides orderbook depth (gated by ENABLE_ORDERBOOK_DEPTH).
 * smMap optionally provides smart money data (gated by ENABLE_SMART_MONEY).
 */
function processMarket(
  market: GammaMarket,
  event: GammaEvent,
  tagMap: Map<string, string>,
  obMap: Map<string, PolymarketOrderbookDepth>,
  smMap: Map<string, PolymarketSmartMoney>
): ProcessedMarket | null {
  if (market.closed || market.archived || !market.active) return null;

  const outcomePricesRaw = parseJsonArray<string>(market.outcomePrices);
  const outcomesRaw = parseJsonArray<string>(market.outcomes);

  if (outcomePricesRaw.length === 0) return null;

  const outcomePrices = outcomePricesRaw.map((p) => parseFloat(p));
  const currentPrice = Math.round(outcomePrices[0] * 10000) / 100;

  const { slugs, labels } = extractCategories(event, tagMap);

  // First CLOB token ID is the "Yes" token — used to fetch price history
  const clobTokenId = parseJsonArray<string>(market.clobTokenIds)[0] ?? "";

  const ob = clobTokenId ? obMap.get(clobTokenId) : undefined;
  const mid = outcomePrices[0];
  const orderbookDepth = ob
    ? {
        bids: ob.bids.map((l) => [l.price, l.size] as [number, number]),
        asks: ob.asks.map((l) => [l.price, l.size] as [number, number]),
        depthScore: computeDepthScore(
          ob.bids.map((l) => ({ price: l.price, quantity: l.size })),
          ob.asks.map((l) => ({ price: l.price, quantity: l.size })),
          mid,
        ),
      }
    : undefined;

  // conditionId is the canonical Polymarket identifier for smart money lookup
  const sm = market.conditionId ? smMap.get(market.conditionId) : undefined;

  return {
    id: market.id,
    question: market.question,
    source: "polymarket",
    eventSlug: event.slug,
    eventTitle: event.title,
    categoryslugs: slugs,
    categories: labels,
    image: market.image || event.image || "",
    currentPrice,
    oneDayChange: toPP(market.oneDayPriceChange),
    oneHourChange: toPP(market.oneHourPriceChange),
    oneWeekChange: toPP(market.oneWeekPriceChange),
    oneMonthChange: toPP(market.oneMonthPriceChange),
    volume24h: market.volume24hr ?? 0,
    volume1wk: market.volume1wk ?? 0,
    volume1mo: market.volume1mo ?? 0,
    liquidity: market.liquidityNum ?? parseFloat(market.liquidity ?? "0"),
    createdAt: market.createdAt,
    endDate: market.endDate ?? "",
    outcomes: outcomesRaw,
    outcomePrices,
    bestBid: market.bestBid ?? 0,
    bestAsk: market.bestAsk ?? 0,
    spread: market.spread ?? 0,
    clobTokenId,
    description: market.description ?? "",
    resolutionSource: market.resolutionSource ?? "",
    competitive: market.competitive ?? 0,
    orderbookDepth,
    openInterest: sm?.openInterest,
    smartMoneyScore: sm?.smartMoneyScore,
    topHolders: sm?.topHolders,
    polarity: inferPolarity(market.question),
  };
}

/**
 * Process a list of raw GammaEvents into a deduplicated ProcessedMarket[].
 *
 * @param events  - Raw events from the Gamma /events endpoint.
 * @param tagMap  - Slug→label map built from the Gamma /tags endpoint.
 *                  Pass an empty Map when unavailable; labels fall back gracefully.
 * @param obMap   - Orderbook depth keyed by CLOB token ID (from fetchPolymarketOrderbooks).
 *                  Pass an empty Map when ENABLE_ORDERBOOK_DEPTH is unset.
 * @param smMap   - Smart money data keyed by conditionId (from fetchPolymarketSmartMoney).
 *                  Pass an empty Map when ENABLE_SMART_MONEY is unset.
 */
export function processEvents(
  events: GammaEvent[],
  tagMap: Map<string, string> = new Map(),
  obMap: Map<string, PolymarketOrderbookDepth> = new Map(),
  smMap: Map<string, PolymarketSmartMoney> = new Map()
): ProcessedMarket[] {
  const seen = new Set<string>();
  const result: ProcessedMarket[] = [];

  for (const event of events) {
    if (!event.markets || event.markets.length === 0) continue;
    for (const market of event.markets) {
      if (seen.has(market.id)) continue;
      seen.add(market.id);
      const processed = processMarket(market, event, tagMap, obMap, smMap);
      if (processed) result.push(processed);
    }
  }

  return result;
}
