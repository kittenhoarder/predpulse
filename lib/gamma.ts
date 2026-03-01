import type { GammaEvent, GammaTag } from "./types";
import { fetchWithTimeout, batchParallel } from "./fetch-utils";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_CONCURRENT = 3;

/**
 * Fetch one page of active events (with embedded markets) from the Gamma API.
 * Returns an empty array on non-200 so a single bad page doesn't abort the whole run.
 */
async function fetchEventsPage(offset: number): Promise<GammaEvent[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    // camelCase field name — volume_24hr (underscore) is rejected with 422
    order: "volume24hr",
    ascending: "false",
  });
  const url = `${GAMMA_BASE}/events?${params.toString()}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[gamma] ${res.status} at offset ${offset}: ${body}`);
    return [];
  }
  const data: GammaEvent[] = await res.json();
  return data;
}

/**
 * Fetch all active events in parallel batches (MAX_CONCURRENT at a time).
 *
 * Strategy:
 *   1. Fire the first page to discover total event count.
 *   2. Determine how many additional pages are needed.
 *   3. Fetch remaining pages in parallel batches, capped at MAX_CONCURRENT.
 *
 * Compared to serial fetching this cuts wall-clock time from ~MAX_PAGES × RTT
 * down to ~ceil(MAX_PAGES / MAX_CONCURRENT) × RTT — roughly 5× faster.
 */
export async function fetchAllActiveEvents(): Promise<GammaEvent[]> {
  // Fetch the first page to anchor pagination
  const firstPage = await fetchEventsPage(0);
  if (firstPage.length === 0) return [];
  if (firstPage.length < PAGE_SIZE) return firstPage;

  // Build remaining page offsets
  const remainingOffsets: number[] = [];
  for (let page = 1; page < MAX_PAGES; page++) {
    remainingOffsets.push(page * PAGE_SIZE);
  }

  // Process in batches of MAX_CONCURRENT
  const all: GammaEvent[] = [...firstPage];
  for (let i = 0; i < remainingOffsets.length; i += MAX_CONCURRENT) {
    const batch = remainingOffsets.slice(i, i + MAX_CONCURRENT);
    const results = await Promise.all(batch.map(fetchEventsPage));
    let reachedEnd = false;
    for (const page of results) {
      all.push(...page);
      if (page.length < PAGE_SIZE) {
        reachedEnd = true;
      }
    }
    if (reachedEnd) break;
  }

  return all;
}

/**
 * Fetch the canonical tag list from the Gamma API.
 * Used at ingest time to build a slug→label normalisation map.
 */
export async function fetchTags(): Promise<GammaTag[]> {
  const url = `${GAMMA_BASE}/tags`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    console.warn(`[gamma] Failed to fetch tags: ${res.status}`);
    return [];
  }
  return res.json();
}

/**
 * Fetch a single event by slug. Returns null if not found or on error.
 * Used by the market detail / OG image routes.
 */
export async function fetchEventBySlug(slug: string): Promise<GammaEvent | null> {
  const params = new URLSearchParams({ slug });
  const url = `${GAMMA_BASE}/events?${params.toString()}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const data: GammaEvent[] = await res.json();
  return data.find((e) => e.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Orderbook depth (Polymarket CLOB)
// ---------------------------------------------------------------------------

export interface PolymarketOrderbookLevel {
  price: number;  // fractional 0–1
  size: number;   // contracts
}

export interface PolymarketOrderbookDepth {
  bids: PolymarketOrderbookLevel[];
  asks: PolymarketOrderbookLevel[];
}

const CLOB_BASE = "https://clob.polymarket.com";
const DATA_API_BASE = "https://data-api.polymarket.com";

/**
 * Fetch full orderbook depth for a batch of Polymarket token IDs in one POST request.
 * Returns Map<tokenId, depth>; missing/errored tokens are omitted.
 *
 * Only called when ENABLE_ORDERBOOK_DEPTH env var is set.
 */
export async function fetchPolymarketOrderbooks(
  tokenIds: string[]
): Promise<Map<string, PolymarketOrderbookDepth>> {
  const result = new Map<string, PolymarketOrderbookDepth>();
  if (tokenIds.length === 0) return result;

  const url = `${CLOB_BASE}/books`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenIds.map((id) => ({ token_id: id }))),
    });
  } catch (err) {
    console.warn("[gamma] fetchPolymarketOrderbooks fetch error:", err);
    return result;
  }

  if (!res.ok) {
    console.warn(`[gamma] fetchPolymarketOrderbooks ${res.status}`);
    return result;
  }

  let data: unknown;
  try { data = await res.json(); } catch { return result; }

  // Response: array of { asset_id, bids: [{price, size},...], asks: [...] }
  if (!Array.isArray(data)) return result;

  for (const book of data as Record<string, unknown>[]) {
    const tokenId = String(book.asset_id ?? book.token_id ?? "");
    if (!tokenId) continue;

    const parseLevel = (raw: unknown): PolymarketOrderbookLevel[] => {
      if (!Array.isArray(raw)) return [];
      return raw.map((item: unknown) => {
        const r = item as Record<string, unknown>;
        return { price: parseFloat(String(r.price ?? "0")), size: parseFloat(String(r.size ?? "0")) };
      });
    };

    result.set(tokenId, {
      bids: parseLevel(book.bids),
      asks: parseLevel(book.asks),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Smart money: top holders + true open interest (Polymarket Data API)
// ---------------------------------------------------------------------------

export interface PolymarketHolder {
  address: string;
  shares: number;
  side: "YES" | "NO";
}

export interface PolymarketSmartMoney {
  openInterest: number;
  smartMoneyScore: number;
  topHolders: PolymarketHolder[];
}

/**
 * Fetch top holders and true open interest for a batch of Polymarket conditionIds.
 * Returns Map<conditionId, PolymarketSmartMoney>.
 * Only called when ENABLE_SMART_MONEY env var is set.
 */
export async function fetchPolymarketSmartMoney(
  conditionIds: string[]
): Promise<Map<string, PolymarketSmartMoney>> {
  const result = new Map<string, PolymarketSmartMoney>();
  if (conditionIds.length === 0) return result;

  const SMART_MONEY_BATCH_SIZE = 15;
  await batchParallel(conditionIds, SMART_MONEY_BATCH_SIZE, async (conditionId) => {
    try {
      const params = new URLSearchParams({
        market: conditionId,
        sizeThreshold: "1000",
        sortBy: "size",
        limit: "10",
      });
      const res = await fetchWithTimeout(`${DATA_API_BASE}/positions?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json() as Record<string, unknown>[];
      if (!Array.isArray(data)) return;

      const holders: PolymarketHolder[] = data
        .slice(0, 10)
        .map((p) => ({
          address: String(p.proxyWallet ?? p.user ?? p.address ?? ""),
          shares: parseFloat(String(p.size ?? p.shares ?? "0")) || 0,
          side: (String(p.outcome ?? "").toUpperCase() === "NO" ? "NO" : "YES") as "YES" | "NO",
        }))
        .filter((h) => h.address && h.shares > 0);

      const totalShares = holders.reduce((s, h) => s + h.shares, 0);
      const top5Shares = holders.slice(0, 5).reduce((s, h) => s + h.shares, 0);
      const concentration = totalShares > 0 ? top5Shares / totalShares : 0;
      const smartMoneyScore = Math.round(concentration * 100);

      let openInterest = 0;
      try {
        const oiRes = await fetchWithTimeout(`${DATA_API_BASE}/markets?id=${encodeURIComponent(conditionId)}`);
        if (oiRes.ok) {
          const oiData = await oiRes.json();
          const market = Array.isArray(oiData) ? oiData[0] : oiData;
          openInterest = parseFloat(String((market as Record<string, unknown>)?.openInterest ?? "0")) || 0;
        }
      } catch { /* non-fatal */ }

      result.set(conditionId, { openInterest, smartMoneyScore, topHolders: holders });
    } catch { /* non-fatal */ }
  });

  return result;
}
