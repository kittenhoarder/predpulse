import { fetchAllActiveEvents, fetchTags, fetchPolymarketOrderbooks, fetchPolymarketSmartMoney } from "./gamma";
import { buildTagMap, processEvents, parseJsonArray } from "./process-markets";
import { fetchAllKalshiMarkets, fetchKalshiOrderbooks } from "./kalshi";
import { processKalshiMarkets } from "./process-kalshi";
import { fetchManifoldMarkets } from "./manifold";
import type { ProcessedMarket, SortMode, MarketsApiResponse } from "./types";

const PAGE_LIMIT = 100;

// ---------------------------------------------------------------------------
// In-memory TTL cache — prevents thundering herd when CDN s-maxage expires
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

interface SourceCache {
  data: ProcessedMarket[];
  expiresAt: number;
}

const sourceCache = new Map<string, SourceCache>();

function getCached(key: string): ProcessedMarket[] | null {
  const entry = sourceCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCache(key: string, data: ProcessedMarket[]): void {
  sourceCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Filtering & sorting (pure functions, exported for testing)
// ---------------------------------------------------------------------------

export function filterByCategory(
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

export function sortMarkets(
  markets: ProcessedMarket[],
  sort: SortMode,
  watchlistIds?: string[]
): ProcessedMarket[] {
  switch (sort) {
    case "movers1h":
      return [...markets].sort(
        (a, b) => Math.abs(b.oneHourChange) - Math.abs(a.oneHourChange)
      );
    case "gainers":
      return markets
        .filter((m) => m.oneDayChange > 0)
        .sort((a, b) => b.oneDayChange - a.oneDayChange);
    case "losers":
      return markets
        .filter((m) => m.oneDayChange < 0)
        .sort((a, b) => a.oneDayChange - b.oneDayChange);
    case "volume":
      return [...markets].sort((a, b) => b.volume24h - a.volume24h);
    case "liquidity":
      return [...markets].sort((a, b) => b.liquidity - a.liquidity);
    case "new":
      return [...markets].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "watchlist": {
      const ids = new Set(watchlistIds ?? []);
      return markets
        .filter((m) => ids.has(m.id))
        .sort((a, b) => Math.abs(b.oneDayChange) - Math.abs(a.oneDayChange));
    }
    case "movers":
    default:
      return [...markets].sort(
        (a, b) => Math.abs(b.oneDayChange) - Math.abs(a.oneDayChange)
      );
  }
}

// ---------------------------------------------------------------------------
// Options & feature flags
// ---------------------------------------------------------------------------

export interface GetMarketsOptions {
  sort?: SortMode;
  category?: string;
  offset?: number;
  /** Comma-separated market IDs for the watchlist sort mode */
  watchlistIds?: string[];
  /** When set, only return markets from this source */
  source?: "polymarket" | "kalshi" | "manifold" | "all";
}

const ORDERBOOK_DEPTH_ENABLED = process.env.ENABLE_ORDERBOOK_DEPTH === "1";
const SMART_MONEY_ENABLED = process.env.ENABLE_SMART_MONEY === "1";

// ---------------------------------------------------------------------------
// Per-source fetchers (with cache)
// ---------------------------------------------------------------------------

async function fetchPolymarkets(): Promise<ProcessedMarket[]> {
  const cached = getCached("polymarket");
  if (cached) return cached;

  try {
    const [events, tags] = await Promise.all([fetchAllActiveEvents(), fetchTags()]);
    const tagMap = buildTagMap(tags);

    const tokenIds: string[] = [];
    const conditionIds: string[] = [];
    for (const event of events) {
      for (const market of event.markets ?? []) {
        const ids = parseJsonArray<string>(market.clobTokenIds);
        if (ids[0]) tokenIds.push(ids[0]);
        if (market.conditionId) conditionIds.push(market.conditionId);
      }
    }

    const [obMap, smMap] = await Promise.all([
      ORDERBOOK_DEPTH_ENABLED
        ? fetchPolymarketOrderbooks(tokenIds).catch(() => new Map())
        : Promise.resolve(new Map<string, import("./gamma").PolymarketOrderbookDepth>()),
      SMART_MONEY_ENABLED
        ? fetchPolymarketSmartMoney(conditionIds).catch(() => new Map())
        : Promise.resolve(new Map<string, import("./gamma").PolymarketSmartMoney>()),
    ]);

    const result = processEvents(events, tagMap, obMap, smMap);
    setCache("polymarket", result);
    return result;
  } catch (err) {
    console.error("[get-markets] Polymarket fetch failed:", err);
    return [];
  }
}

async function fetchKalshi(): Promise<ProcessedMarket[]> {
  const cached = getCached("kalshi");
  if (cached) return cached;

  try {
    const { markets, candleMap, seriesMap } = await fetchAllKalshiMarkets();

    let obMap = new Map<string, import("./kalshi").KalshiOrderbookDepth>();
    if (ORDERBOOK_DEPTH_ENABLED) {
      const activeTickers = markets
        .filter((m) => m.status === "active")
        .map((m) => m.ticker);
      obMap = await fetchKalshiOrderbooks(activeTickers).catch(() => new Map());
    }

    const result = processKalshiMarkets(markets, candleMap, obMap, seriesMap);
    setCache("kalshi", result);
    return result;
  } catch (err) {
    console.error("[get-markets] Kalshi fetch failed:", err);
    return [];
  }
}

async function fetchManifold(): Promise<ProcessedMarket[]> {
  const cached = getCached("manifold");
  if (cached) return cached;

  try {
    const result = await fetchManifoldMarkets();
    setCache("manifold", result);
    return result;
  } catch (err) {
    console.error("[get-markets] Manifold fetch failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AllSourcesResult {
  polymarkets: ProcessedMarket[];
  kalshiMarkets: ProcessedMarket[];
  manifoldMarkets: ProcessedMarket[];
}

/**
 * Fetch all sources in parallel. Returns the raw per-source arrays so callers
 * can derive both paginated (getMarkets) and full (getAllMarkets) views from a
 * single upstream round-trip.
 */
export async function fetchAllSources(): Promise<AllSourcesResult> {
  const [polymarkets, kalshiMarkets, manifoldMarkets] = await Promise.all([
    fetchPolymarkets(),
    fetchKalshi(),
    fetchManifold(),
  ]);
  return { polymarkets, kalshiMarkets, manifoldMarkets };
}

/**
 * Build a MarketsApiResponse from pre-fetched source data.
 * When `sources` is omitted, fetches all sources fresh.
 */
export async function getMarkets(
  opts: GetMarketsOptions = {},
  sources?: AllSourcesResult,
): Promise<MarketsApiResponse> {
  const sort: SortMode = opts.sort ?? "movers";
  const category = opts.category ?? "all";
  const offset = opts.offset ?? 0;
  const watchlistIds = opts.watchlistIds ?? [];
  const source = opts.source ?? "all";
  const fetchedAt = new Date().toISOString();

  const { polymarkets, kalshiMarkets, manifoldMarkets } =
    sources ?? (await fetchAllSources());

  let markets: ProcessedMarket[];
  if (source === "polymarket") markets = polymarkets;
  else if (source === "kalshi") markets = kalshiMarkets;
  else if (source === "manifold") markets = manifoldMarkets;
  else markets = [...polymarkets, ...kalshiMarkets, ...manifoldMarkets];

  const filtered = filterByCategory(markets, category);
  const sorted = sortMarkets(filtered, sort, watchlistIds);
  const paginated = sorted.slice(offset, offset + PAGE_LIMIT);

  return {
    markets: paginated,
    cachedAt: fetchedAt,
    totalMarkets: filtered.length,
    fromCache: false,
  };
}

/**
 * Return all markets from all sources as a flat array.
 * When `sources` is provided, skips fetching.
 */
export async function getAllMarkets(
  sources?: AllSourcesResult,
): Promise<ProcessedMarket[]> {
  const { polymarkets, kalshiMarkets, manifoldMarkets } =
    sources ?? (await fetchAllSources());
  return [...polymarkets, ...kalshiMarkets, ...manifoldMarkets];
}
