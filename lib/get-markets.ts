import { fetchAllActiveEvents, fetchTags } from "./gamma";
import { buildTagMap, processEvents } from "./process-markets";
import type { ProcessedMarket, SortMode, MarketsApiResponse } from "./types";

const PAGE_LIMIT = 100;

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

function sortMarkets(markets: ProcessedMarket[], sort: SortMode): ProcessedMarket[] {
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

export interface GetMarketsOptions {
  sort?: SortMode;
  category?: string;
  offset?: number;
}

/**
 * Fetch all active markets from the Gamma API, process, sort, filter, and
 * return a paginated response. No caching — every call hits Gamma directly.
 */
export async function getMarkets(
  opts: GetMarketsOptions = {}
): Promise<MarketsApiResponse> {
  const sort: SortMode = opts.sort ?? "movers";
  const category = opts.category ?? "all";
  const offset = opts.offset ?? 0;
  const fetchedAt = new Date().toISOString();

  let markets: ProcessedMarket[] = [];
  try {
    const [events, tags] = await Promise.all([
      fetchAllActiveEvents(),
      fetchTags(),
    ]);
    const tagMap = buildTagMap(tags);
    markets = processEvents(events, tagMap);
  } catch (err) {
    console.error("[get-markets] Gamma API fetch failed:", err);
  }

  const filtered = filterByCategory(markets, category);
  const sorted = sortMarkets(filtered, sort);
  const paginated = sorted.slice(offset, offset + PAGE_LIMIT);

  return {
    markets: paginated,
    cachedAt: fetchedAt,
    totalMarkets: filtered.length,
    fromCache: false,
  };
}
