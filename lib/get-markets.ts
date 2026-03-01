import { fetchAllActiveEvents, fetchTags, fetchPolymarketOrderbooks, fetchPolymarketSmartMoney } from "./gamma";
import { buildTagMap, processEvents, parseJsonArray } from "./process-markets";
import { fetchAllKalshiMarkets, fetchKalshiOrderbooks } from "./kalshi";
import { processKalshiMarkets } from "./process-kalshi";
import { fetchManifoldMarkets } from "./manifold";
import type { ProcessedMarket, SortMode, MarketsApiResponse } from "./types";

const PAGE_LIMIT = 100;

// ---------------------------------------------------------------------------
// Stale-while-revalidate in-memory cache
//
// Two-tier TTL:
//   SOFT: return cached + kick off a background refresh (invisible to caller)
//   HARD: cache fully expired — block and wait for a fresh fetch
//
// Promise deduplication ensures concurrent cold-start requests share one fetch,
// preventing N parallel full-source round-trips under load.
// ---------------------------------------------------------------------------

const CACHE_SOFT_TTL_MS = 240_000; // 4 min — trigger background refresh
const CACHE_HARD_TTL_MS = 300_000; // 5 min — block and fetch if exceeded
// Maximum time to wait on a cold fetch before returning [] (lets other sources
// still render; the slow source retries on the next request).
const COLD_FETCH_TIMEOUT_MS = 20_000; // 20s

interface SourceCacheEntry {
  data: ProcessedMarket[];
  cachedAt: number;
}

const sourceCache = new Map<string, SourceCacheEntry>();
// One in-flight promise per source key — deduplicates concurrent cold fetches
const inflightFetch = new Map<string, Promise<ProcessedMarket[]>>();

function getCachedEntry(key: string): SourceCacheEntry | null {
  return sourceCache.get(key) ?? null;
}

function setCache(key: string, data: ProcessedMarket[]): void {
  sourceCache.set(key, { data, cachedAt: Date.now() });
}

/**
 * Fetch a source with stale-while-revalidate semantics:
 *  - Fresh (< SOFT_TTL):    return immediately, no fetch
 *  - Stale (SOFT–HARD TTL): return stale data immediately; refresh in background
 *  - Expired (> HARD_TTL):  block until fresh data is available
 * Promise deduplication prevents duplicate fetches for the same key.
 */
async function fetchWithSWR(
  key: string,
  fetcher: () => Promise<ProcessedMarket[]>,
): Promise<ProcessedMarket[]> {
  const entry = getCachedEntry(key);
  const age = entry ? Date.now() - entry.cachedAt : Infinity;

  if (entry && age < CACHE_SOFT_TTL_MS) {
    // Still fresh — return immediately
    return entry.data;
  }

  if (entry && age < CACHE_HARD_TTL_MS) {
    // Stale but usable — serve from cache and refresh in background
    if (!inflightFetch.has(key)) {
      const bg = fetcher()
        .then((data) => { setCache(key, data); return data; })
        .finally(() => inflightFetch.delete(key));
      inflightFetch.set(key, bg);
    }
    return entry.data;
  }

  // Fully expired (or first load) — block on fetch, deduplicating concurrent callers.
  // Race against COLD_FETCH_TIMEOUT_MS: if the source is still slow, return []
  // so other sources can render. The inflight promise keeps running and will
  // populate the cache when it eventually resolves.
  if (inflightFetch.has(key)) {
    const timeout = new Promise<ProcessedMarket[]>((resolve) =>
      setTimeout(() => {
        console.warn(`[get-markets] ${key} timed out after ${COLD_FETCH_TIMEOUT_MS}ms (inflight)`);
        resolve([]);
      }, COLD_FETCH_TIMEOUT_MS)
    );
    return Promise.race([
      inflightFetch.get(key)!,
      timeout,
    ]);
  }

  const promise = fetcher()
    .then((data) => { setCache(key, data); return data; })
    .finally(() => inflightFetch.delete(key));
  inflightFetch.set(key, promise);
  const timeout = new Promise<ProcessedMarket[]>((resolve) =>
    setTimeout(() => {
      console.warn(`[get-markets] ${key} timed out after ${COLD_FETCH_TIMEOUT_MS}ms (cold)`);
      resolve([]);
    }, COLD_FETCH_TIMEOUT_MS)
  );
  return Promise.race([
    promise,
    timeout,
  ]);
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

export function interlaceBySourceWeighted(
  markets: ProcessedMarket[],
  sourceOrder: ProcessedMarket["source"][] = ["polymarket", "kalshi", "manifold"],
): ProcessedMarket[] {
  if (markets.length <= 2) return markets;

  const queues = new Map<ProcessedMarket["source"], ProcessedMarket[]>();
  for (const source of sourceOrder) queues.set(source, []);
  for (const market of markets) {
    if (!queues.has(market.source)) queues.set(market.source, []);
    queues.get(market.source)!.push(market);
  }

  const picked = new Map<ProcessedMarket["source"], number>();
  for (const source of sourceOrder) picked.set(source, 0);
  for (const source of Array.from(queues.keys())) {
    if (!picked.has(source)) picked.set(source, 0);
  }

  const total = markets.length;
  const out: ProcessedMarket[] = [];

  while (out.length < total) {
    let remainingTotal = 0;
    for (const q of Array.from(queues.values())) remainingTotal += q.length;
    if (remainingTotal === 0) break;

    let chosen: ProcessedMarket["source"] | null = null;
    let bestDeficit = Number.NEGATIVE_INFINITY;

    const allSources = [...sourceOrder, ...Array.from(queues.keys()).filter((s) => !sourceOrder.includes(s))];
    for (const source of allSources) {
      const q = queues.get(source);
      if (!q || q.length === 0) continue;

      const remaining = q.length;
      const share = remaining / remainingTotal;
      const ideal = (out.length + 1) * share;
      const actual = picked.get(source) ?? 0;
      const deficit = ideal - actual;

      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        chosen = source;
      }
    }

    if (!chosen) break;
    const queue = queues.get(chosen)!;
    out.push(queue.shift()!);
    picked.set(chosen, (picked.get(chosen) ?? 0) + 1);
  }

  return out.length === markets.length ? out : markets;
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
  return fetchWithSWR("polymarket", async () => {
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

    return processEvents(events, tagMap, obMap, smMap);
  }).catch((err) => {
    console.error("[get-markets] Polymarket fetch failed:", err);
    return [];
  });
}

async function fetchKalshi(): Promise<ProcessedMarket[]> {
  return fetchWithSWR("kalshi", async () => {
    const { markets, candleMap, seriesMap } = await fetchAllKalshiMarkets();

    let obMap = new Map<string, import("./kalshi").KalshiOrderbookDepth>();
    if (ORDERBOOK_DEPTH_ENABLED) {
      // Cap at 50 top-OI tickers — serial orderbook fetches at 15s timeout each
      // would take hours for the full market set. 50 covers the most liquid markets
      // that actually move the Pulse orderflow signal.
      const activeTickers = markets
        .filter((m) => m.status === "active")
        .sort((a, b) => parseFloat(b.open_interest_fp ?? "0") - parseFloat(a.open_interest_fp ?? "0"))
        .slice(0, 50)
        .map((m) => m.ticker);
      obMap = await fetchKalshiOrderbooks(activeTickers).catch(() => new Map());
    }

    return processKalshiMarkets(markets, candleMap, obMap, seriesMap);
  }).catch((err) => {
    console.error("[get-markets] Kalshi fetch failed:", err);
    return [];
  });
}

async function fetchManifold(): Promise<ProcessedMarket[]> {
  return fetchWithSWR("manifold", async () => fetchManifoldMarkets()).catch((err) => {
    console.error("[get-markets] Manifold fetch failed:", err);
    return [];
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns whether all three source caches are currently warm (within SOFT_TTL).
 * Used by streaming SSR pages to decide whether to pre-render data server-side
 * or defer to client-side SWR (avoids blocking the first cold render).
 */
export function getCacheStatus(): { allWarm: boolean } {
  const keys = ["polymarket", "kalshi", "manifold"];
  const allWarm = keys.every((k) => {
    const entry = sourceCache.get(k);
    return entry !== undefined && Date.now() - entry.cachedAt < CACHE_SOFT_TTL_MS;
  });
  return { allWarm };
}

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
  const t0 = Date.now();
  const [initialPolymarkets, initialKalshiMarkets, manifoldMarkets] = await Promise.all([
    fetchPolymarkets(),
    fetchKalshi(),
    fetchManifold(),
  ]);
  let polymarkets = initialPolymarkets;
  let kalshiMarkets = initialKalshiMarkets;

  // Reliability-first guard: if one core source is empty on cold start, retry once.
  if (polymarkets.length === 0) {
    console.warn("[get-markets] Polymarket empty on first pass; retrying once");
    polymarkets = await fetchPolymarkets();
  }
  if (kalshiMarkets.length === 0) {
    console.warn("[get-markets] Kalshi empty on first pass; retrying once");
    kalshiMarkets = await fetchKalshi();
  }

  const dt = Date.now() - t0;
  console.info(
    `[get-markets] source counts poly=${polymarkets.length} kalshi=${kalshiMarkets.length} manifold=${manifoldMarkets.length} totalMs=${dt}`,
  );

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
  const arranged = source === "all" && sort !== "watchlist"
    ? interlaceBySourceWeighted(sorted)
    : sorted;
  const paginated = arranged.slice(offset, offset + PAGE_LIMIT);

  const sourceBreakdown = {
    polymarket: filtered.filter((m) => m.source === "polymarket").length,
    kalshi: filtered.filter((m) => m.source === "kalshi").length,
    manifold: filtered.filter((m) => m.source === "manifold").length,
  };

  return {
    markets: paginated,
    cachedAt: fetchedAt,
    totalMarkets: filtered.length,
    fromCache: false,
    sourceBreakdown,
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
