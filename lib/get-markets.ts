import { fetchAllActiveEvents, fetchTags, fetchPolymarketOrderbooks, fetchPolymarketSmartMoney } from "./gamma";
import { buildTagMap, processEvents, parseJsonArray } from "./process-markets";
import { fetchAllKalshiMarkets, fetchKalshiOrderbooks } from "./kalshi";
import { processKalshiMarkets } from "./process-kalshi";
import { fetchManifoldMarkets } from "./manifold";
import type { ProcessedMarket, SortMode, MarketsApiResponse } from "./types";

const MARKETS_DOUBLE_PAGE_ENABLED =
  process.env.MARKETS_DOUBLE_PAGE_ENABLED !== "0" &&
  process.env.MARKETS_DOUBLE_PAGE_ENABLED !== "false";
const DEFAULT_PAGE_LIMIT = MARKETS_DOUBLE_PAGE_ENABLED ? 50 : 100;
const ALLOWED_PAGE_LIMITS = new Set([25, 50, 100]);

const CORE_INDEX_MAX_PER_CATEGORY_PER_SOURCE = 20;
const CORE_INDEX_FLOOR_KEEP_ALL = 8;

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
// Set above the observed worst-case cold-fetch time (~25s with Kalshi serial
// pagination + candlesticks) to prevent premature timeouts that trigger false
// empty-source retries and duplicate fetches.
const COLD_FETCH_TIMEOUT_MS = 32_000; // 32s

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

// Per-source minimum thresholds for the display-layer size filter.
// null volume24h means "skip volume check — use liquidity only".
// Polymarket + Manifold: volume24h OR liquidity (either qualifies).
// Kalshi: liquidity only — open_interest is the liquidity proxy; volume24h
// is legitimately 0 on quiet days for otherwise meaningful markets.
export const SIZE_THRESHOLDS: Record<
  ProcessedMarket["source"],
  { volume24h: number | null; liquidity: number }
> = {
  polymarket: { volume24h: 1_000, liquidity: 5_000 },
  kalshi:     { volume24h: null,  liquidity: 500   },
  manifold:   { volume24h: 100,   liquidity: 500   },
};

/**
 * Filter markets below per-source size thresholds.
 * When hideSmall is false, returns markets unchanged (user opted in to all).
 * Exported for unit testing and index pre-filtering.
 */
export function filterBySize(
  markets: ProcessedMarket[],
  hideSmall: boolean,
): ProcessedMarket[] {
  if (!hideSmall) return markets;
  return markets.filter((m) => {
    const t = SIZE_THRESHOLDS[m.source];
    const volumeOk = t.volume24h !== null && m.volume24h >= t.volume24h;
    const liquidityOk = m.liquidity >= t.liquidity;
    return volumeOk || liquidityOk;
  });
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

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 1;
  return (value - min) / (max - min);
}

/**
 * Lightweight core-index market sampler:
 * - only polymarket + kalshi
 * - cap each category+source bucket to top N by liquidity/volume priority
 * - keep all when the bucket is already small
 */
export function pickCoreIndexMarkets(
  polymarkets: ProcessedMarket[],
  kalshiMarkets: ProcessedMarket[],
): ProcessedMarket[] {
  // Strip micro-markets before ranking to prevent zero-OI outliers from
  // collapsing the normalization range and distorting index scores.
  const core = filterBySize([...polymarkets, ...kalshiMarkets], true);
  if (core.length === 0) return [];

  const selected = new Set<string>();
  const sources: ProcessedMarket["source"][] = ["polymarket", "kalshi"];

  for (const source of sources) {
    const sourceMarkets = core.filter((m) => m.source === source);
    const buckets = new Map<string, ProcessedMarket[]>();

    for (const market of sourceMarkets) {
      for (const slug of market.categoryslugs) {
        if (!buckets.has(slug)) buckets.set(slug, []);
        buckets.get(slug)!.push(market);
      }
    }

    for (const markets of Array.from(buckets.values())) {
      if (markets.length < CORE_INDEX_FLOOR_KEEP_ALL) {
        for (const market of markets) selected.add(`${market.source}:${market.id}`);
        continue;
      }

      const oiLike = markets.map((m) => (m.openInterest !== undefined && m.openInterest > 0 ? m.openInterest : m.liquidity));
      const vol = markets.map((m) => m.volume24h);
      const minOi = Math.min(...oiLike);
      const maxOi = Math.max(...oiLike);
      const minVol = Math.min(...vol);
      const maxVol = Math.max(...vol);

      const ranked = [...markets]
        .sort((a, b) => {
          const aOi = a.openInterest !== undefined && a.openInterest > 0 ? a.openInterest : a.liquidity;
          const bOi = b.openInterest !== undefined && b.openInterest > 0 ? b.openInterest : b.liquidity;
          const aPriority = 0.7 * normalize(aOi, minOi, maxOi) + 0.3 * normalize(a.volume24h, minVol, maxVol);
          const bPriority = 0.7 * normalize(bOi, minOi, maxOi) + 0.3 * normalize(b.volume24h, minVol, maxVol);
          if (bPriority !== aPriority) return bPriority - aPriority;
          if (bOi !== aOi) return bOi - aOi;
          return b.volume24h - a.volume24h;
        })
        .slice(0, CORE_INDEX_MAX_PER_CATEGORY_PER_SOURCE);

      for (const market of ranked) selected.add(`${market.source}:${market.id}`);
    }
  }

  const out = core.filter((m) => selected.has(`${m.source}:${m.id}`));
  // Fallback: if bucket ranking selected nothing (e.g. all buckets < FLOOR_KEEP_ALL
  // and the Set somehow stays empty), return the full size-filtered set rather than [].
  // Note: `core` is already the post-filterBySize array, not the raw inputs.
  return out.length > 0 ? out : core;
}

// ---------------------------------------------------------------------------
// Options & feature flags
// ---------------------------------------------------------------------------

export interface GetMarketsOptions {
  sort?: SortMode;
  category?: string;
  offset?: number;
  limit?: number;
  /** Comma-separated market IDs for the watchlist sort mode */
  watchlistIds?: string[];
  /** When set, only return markets from this source */
  source?: "polymarket" | "kalshi" | "manifold" | "all";
  /** When true (default), exclude markets below per-source size thresholds */
  hideSmall?: boolean;
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

  // Reliability-first guard: if a core source returned empty (timed out before
  // its inflight promise completed), wait briefly and re-read from the SWR cache.
  // Both sources are checked in parallel — sequential waits would add 6s total
  // in the worst case (both timed out), parallel waits cap the overhead at 3s.
  // We do NOT call fetchPolymarkets()/fetchKalshi() directly here — those bypass
  // inflight deduplication and would launch a second upstream fetch if the original
  // is still running. The 3s wait lets the inflight promise complete first.
  const needsPolyRetry = polymarkets.length === 0;
  const needsKalshiRetry = kalshiMarkets.length === 0;
  if (needsPolyRetry) console.warn("[get-markets] Polymarket empty on first pass; waiting for inflight");
  if (needsKalshiRetry) console.warn("[get-markets] Kalshi empty on first pass; waiting for inflight");

  if (needsPolyRetry || needsKalshiRetry) {
    const [resolvedPoly, resolvedKalshi] = await Promise.all([
      needsPolyRetry
        ? new Promise<void>((r) => setTimeout(r, 3_000))
            .then(() => getCachedEntry("polymarket")?.data ?? fetchPolymarkets())
        : Promise.resolve(polymarkets),
      needsKalshiRetry
        ? new Promise<void>((r) => setTimeout(r, 3_000))
            .then(() => getCachedEntry("kalshi")?.data ?? fetchKalshi())
        : Promise.resolve(kalshiMarkets),
    ]);
    polymarkets = resolvedPoly;
    kalshiMarkets = resolvedKalshi;
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
  const requestedLimit = opts.limit ?? DEFAULT_PAGE_LIMIT;
  const limit = ALLOWED_PAGE_LIMITS.has(requestedLimit) ? requestedLimit : DEFAULT_PAGE_LIMIT;
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

  const categorised = filterByCategory(markets, category);
  const filtered = filterBySize(categorised, opts.hideSmall ?? true);
  const sorted = sortMarkets(filtered, sort, watchlistIds);
  const arranged = source === "all" && sort !== "watchlist"
    ? interlaceBySourceWeighted(sorted)
    : sorted;
  const paginated = arranged.slice(offset, offset + limit);

  const sourceBreakdown = {
    polymarket: filtered.filter((m) => m.source === "polymarket").length,
    kalshi: filtered.filter((m) => m.source === "kalshi").length,
    manifold: filtered.filter((m) => m.source === "manifold").length,
  };

  return {
    markets: paginated,
    cachedAt: fetchedAt,
    totalMarkets: filtered.length,
    pageSize: limit,
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

/**
 * Low-compute core index market set used by /api/pulse when directional-core3
 * is enabled. Restricts to Polymarket + Kalshi and caps per category/source.
 */
export async function getCoreIndexMarkets(
  sources?: AllSourcesResult,
): Promise<ProcessedMarket[]> {
  const { polymarkets, kalshiMarkets } = sources ?? (await fetchAllSources());
  const selected = pickCoreIndexMarkets(polymarkets, kalshiMarkets);
  console.info(
    `[get-markets] core index set poly=${polymarkets.length} kalshi=${kalshiMarkets.length} selected=${selected.length}`,
  );
  return selected;
}
