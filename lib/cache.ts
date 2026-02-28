import { redis } from "./redis";
import type { ProcessedMarket, SortMode } from "./types";

/**
 * Bump this integer whenever ProcessedMarket gains/loses fields.
 * Cache reads that find a different version are treated as a miss, forcing a
 * live re-fetch and re-population with the new schema.
 */
export const CACHE_SCHEMA_VERSION = 1;

export const CACHE_TTL_SECONDS = 15 * 60;

// Key for the canonical full market list (all active markets, unordered)
const FULL_KEY = `markets:v${CACHE_SCHEMA_VERSION}:all`;

// Key for per-sort pre-computed slices (top PAGE_LIMIT markets per sort mode)
function sortKey(sort: SortMode): string {
  return `markets:v${CACHE_SCHEMA_VERSION}:sort:${sort}`;
}

// Key for metadata (totalMarkets count + when data was fetched from Gamma)
const META_KEY = `markets:v${CACHE_SCHEMA_VERSION}:meta`;

export interface CacheMeta {
  totalMarkets: number;
  cachedAt: string; // ISO timestamp of when Gamma data was fetched
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Read the full unsorted market list from Redis. Returns null on miss/version mismatch. */
export async function readFullMarkets(): Promise<ProcessedMarket[] | null> {
  try {
    return await redis.get<ProcessedMarket[]>(FULL_KEY);
  } catch (err) {
    console.warn("[cache] readFullMarkets failed", err);
    return null;
  }
}

/** Read a pre-sorted/pre-sliced market list for a specific sort mode. */
export async function readSortedMarkets(
  sort: SortMode
): Promise<ProcessedMarket[] | null> {
  try {
    return await redis.get<ProcessedMarket[]>(sortKey(sort));
  } catch (err) {
    console.warn(`[cache] readSortedMarkets(${sort}) failed`, err);
    return null;
  }
}

/** Read cache metadata. Returns null on miss. */
export async function readMeta(): Promise<CacheMeta | null> {
  try {
    return await redis.get<CacheMeta>(META_KEY);
  } catch (err) {
    console.warn("[cache] readMeta failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

const SORT_MODES: SortMode[] = [
  "movers",
  "gainers",
  "losers",
  "volume",
  "liquidity",
  "new",
];

const PAGE_LIMIT = 100;

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

/**
 * Write a full market refresh to Redis atomically:
 *   - Full list under the versioned FULL_KEY
 *   - Pre-sorted top-100 slices for all 6 sort modes
 *   - Metadata (totalMarkets + cachedAt timestamp)
 *
 * All keys share the same TTL so they expire together.
 * Pre-sorting at write time means read-path is a pure cache fetch with zero
 * in-process sorting, and each key is ~100 objects (~50–100KB) rather than
 * a single ~2MB blob that would breach Upstash free-tier limits.
 */
export async function writeMarketCache(
  markets: ProcessedMarket[],
  cachedAt: string
): Promise<void> {
  const pipeline = redis.pipeline();

  // Full list (needed for category filtering, which can't be pre-computed)
  pipeline.set(FULL_KEY, markets, { ex: CACHE_TTL_SECONDS });

  // Pre-sorted slices
  for (const sort of SORT_MODES) {
    const sorted = sortMarkets(markets, sort).slice(0, PAGE_LIMIT);
    pipeline.set(sortKey(sort), sorted, { ex: CACHE_TTL_SECONDS });
  }

  // Metadata
  const meta: CacheMeta = { totalMarkets: markets.length, cachedAt };
  pipeline.set(META_KEY, meta, { ex: CACHE_TTL_SECONDS });

  await pipeline.exec();
}
