import type { GammaEvent, GammaMarket, GammaTag, ProcessedMarket } from "./types";

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
    // Prefer live tagMap label; fallback to tag.label from event; then title-case slug
    labels.push(tagMap.get(tag.slug) ?? tag.label ?? titleCase(tag.slug));
  }
  if (slugs.length === 0) return { slugs: ["general"], labels: ["General"] };
  return { slugs, labels };
}

/**
 * Parse a Gamma API JSON-string field (e.g. outcomePrices / outcomes / clobTokenIds).
 * Returns an empty array on any parse failure.
 */
function parseJsonArray<T>(raw: string | T[]): T[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Transform a single raw GammaMarket (with its parent event) into the leaner
 * ProcessedMarket shape. Returns null for markets that should be excluded.
 */
function processMarket(
  market: GammaMarket,
  event: GammaEvent,
  tagMap: Map<string, string>
): ProcessedMarket | null {
  if (market.closed || market.archived || !market.active) return null;

  const outcomePricesRaw = parseJsonArray<string>(market.outcomePrices);
  const outcomesRaw = parseJsonArray<string>(market.outcomes);

  if (outcomePricesRaw.length === 0) return null;

  const outcomePrices = outcomePricesRaw.map((p) => parseFloat(p));
  const currentPrice = outcomePrices[0] * 100;
  const oneDayChange = (market.oneDayPriceChange ?? 0) * 100;

  const { slugs, labels } = extractCategories(event, tagMap);

  return {
    id: market.id,
    question: market.question,
    eventSlug: event.slug,
    categoryslugs: slugs,
    categories: labels,
    image: market.image || event.image || "",
    currentPrice: Math.round(currentPrice * 100) / 100,
    oneDayChange: Math.round(oneDayChange * 100) / 100,
    volume24h: market.volume24hr ?? 0,
    liquidity: market.liquidityNum ?? parseFloat(market.liquidity ?? "0"),
    createdAt: market.createdAt,
    outcomes: outcomesRaw,
    outcomePrices,
  };
}

/**
 * Process a list of raw GammaEvents into a deduplicated ProcessedMarket[].
 *
 * @param events  - Raw events from the Gamma /events endpoint.
 * @param tagMap  - Slug→label map built from the Gamma /tags endpoint.
 *                  Pass an empty Map when unavailable; labels fall back gracefully.
 */
export function processEvents(
  events: GammaEvent[],
  tagMap: Map<string, string> = new Map()
): ProcessedMarket[] {
  const seen = new Set<string>();
  const result: ProcessedMarket[] = [];

  for (const event of events) {
    if (!event.markets || event.markets.length === 0) continue;
    for (const market of event.markets) {
      if (seen.has(market.id)) continue;
      seen.add(market.id);
      const processed = processMarket(market, event, tagMap);
      if (processed) result.push(processed);
    }
  }

  return result;
}
