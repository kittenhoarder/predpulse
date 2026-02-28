import { fetchAllActiveEvents, fetchTags } from "./gamma";
import { buildTagMap, processEvents } from "./process-markets";
import {
  readSortedMarkets,
  readFullMarkets,
  readMeta,
  writeMarketCache,
} from "./cache";
import type { ProcessedMarket, SortMode, MarketsApiResponse } from "./types";

const PAGE_LIMIT = 100;

/**
 * Fetch, process, and write a full market refresh to Redis.
 * Called by the cron job and as a cache-miss fallback.
 * Returns the processed market list so callers don't need a second cache read.
 */
export async function refreshMarketCache(): Promise<ProcessedMarket[]> {
  // Fetch events and tags in parallel — both are needed before processing
  const [events, tags] = await Promise.all([
    fetchAllActiveEvents(),
    fetchTags(),
  ]);
  const tagMap = buildTagMap(tags);
  const markets = processEvents(events, tagMap);
  const cachedAt = new Date().toISOString();
  await writeMarketCache(markets, cachedAt);
  return markets;
}

/**
 * Filter markets by category slug or label (exact slug match preferred,
 * case-insensitive label substring as fallback).
 */
function filterByCategory(
  markets: ProcessedMarket[],
  category: string
): ProcessedMarket[] {
  if (!category || category === "all") return markets;
  const lower = category.toLowerCase();
  return markets.filter(
    (m) =>
      m.categoryslugs.includes(lower) ||
      m.categories.some((c) => c.toLowerCase().includes(lower))
  );
}

export interface GetMarketsOptions {
  sort?: SortMode;
  category?: string;
  offset?: number;
}

/**
 * Primary data-access function used by both the API route and the server
 * component. Single responsibility: return a paginated MarketsApiResponse.
 *
 * Read path:
 *   1. If category is "all" → read the pre-sorted cache key (pure Redis read, zero sorting).
 *   2. If category filter is active → read the full list, filter, then paginate.
 *   3. On any cache miss → refresh from Gamma API and warm all cache keys.
 */
export async function getMarkets(
  opts: GetMarketsOptions = {}
): Promise<MarketsApiResponse> {
  const sort: SortMode = opts.sort ?? "movers";
  const category = opts.category ?? "all";
  const offset = opts.offset ?? 0;

  let markets: ProcessedMarket[] | null = null;
  let fromCache = false;

  if (category === "all") {
    // Fast path: pre-sorted slice, no filtering or sorting needed
    markets = await readSortedMarkets(sort);
    if (markets) fromCache = true;
  } else {
    // Category filter path: needs full list
    markets = await readFullMarkets();
    if (markets) fromCache = true;
  }

  // Cache miss — refresh from Gamma and re-read
  if (!markets) {
    try {
      const all = await refreshMarketCache();
      if (category === "all") {
        // Use freshly cached sorted slice
        const cached = await readSortedMarkets(sort);
        markets = cached ?? all; // fallback to in-memory if Redis write raced
      } else {
        markets = all;
      }
    } catch (err) {
      console.error("[get-markets] Live fetch failed:", err);
      markets = [];
    }
  }

  // Apply category filter when working from the full list
  const filtered =
    category !== "all" ? filterByCategory(markets, category) : markets;

  // For category-filtered results we still need to sort (no pre-sorted keys for filtered views)
  const sorted =
    category !== "all" ? sortInMemory(filtered, sort) : filtered;

  const paginated = sorted.slice(offset, offset + PAGE_LIMIT);

  // Read cachedAt from metadata (best-effort — don't fail if missing)
  const meta = await readMeta().catch(() => null);

  return {
    markets: paginated,
    cachedAt: meta?.cachedAt ?? new Date().toISOString(),
    totalMarkets: filtered.length,
    fromCache,
  };
}

function sortInMemory(
  markets: ProcessedMarket[],
  sort: SortMode
): ProcessedMarket[] {
  const copy = [...markets];
  switch (sort) {
    case "gainers":
      return copy
        .filter((m) => m.oneDayChange > 0)
        .sort((a, b) => b.oneDayChange - a.oneDayChange);
    case "losers":
      return copy
        .filter((m) => m.oneDayChange < 0)
        .sort((a, b) => a.oneDayChange - b.oneDayChange);
    case "volume":
      return copy.sort((a, b) => b.volume24h - a.volume24h);
    case "liquidity":
      return copy.sort((a, b) => b.liquidity - a.liquidity);
    case "new":
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "movers":
    default:
      return copy.sort(
        (a, b) => Math.abs(b.oneDayChange) - Math.abs(a.oneDayChange)
      );
  }
}
