import type { KalshiMarket, KalshiSeries, KalshiCandle } from "./types";
import { fetchWithTimeout } from "./fetch-utils";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const FETCH_TIMEOUT_MS = 15_000;
const EVENTS_PAGE_LIMIT = 200;
const MAX_EVENT_PAGES = 5;

// Raw event shape from GET /events?with_nested_markets=true
interface KalshiEventWithMarkets {
  event_ticker: string;
  series_ticker: string;
  category: string;
  title: string;
  markets?: KalshiMarket[];
}

/**
 * Fetch one page of Kalshi events WITH nested markets embedded.
 * Using with_nested_markets=true eliminates the per-event /markets fan-out
 * (was up to 1,000 individual calls; now ~5 pages total).
 * status=open filters to active events only.
 * min_close_ts=now filters out events where all markets have already closed.
 */
async function fetchEventsPage(cursor?: string): Promise<{
  events: KalshiEventWithMarkets[];
  cursor: string | null;
}> {
  const params = new URLSearchParams({
    limit: String(EVENTS_PAGE_LIMIT),
    with_nested_markets: "true",
    status: "open",
    min_close_ts: String(Math.floor(Date.now() / 1000)),
  });
  if (cursor) params.set("cursor", cursor);

  const url = `${KALSHI_BASE}/events?${params.toString()}`;
  const res = await fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[kalshi] ${res.status} fetching events: ${body}`);
    return { events: [], cursor: null };
  }

  const data = await res.json();
  const events: KalshiEventWithMarkets[] = (data.events ?? []).map(
    (e: Record<string, unknown>) => ({
      event_ticker: String(e.event_ticker ?? ""),
      series_ticker: String(e.series_ticker ?? ""),
      category: String(e.category ?? "general"),
      title: String(e.title ?? ""),
      markets: Array.isArray(e.markets) ? (e.markets as KalshiMarket[]) : [],
    }),
  );
  return { events, cursor: data.cursor ?? null };
}

/**
 * Fetch all active Kalshi series (exported for series title/frequency enrichment).
 */
export async function fetchKalshiSeries(): Promise<KalshiSeries[]> {
  const params = new URLSearchParams({ limit: "200" });
  const url = `${KALSHI_BASE}/series?${params.toString()}`;
  const res = await fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS);
  if (!res.ok) {
    console.warn(`[kalshi] Failed to fetch series: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.series ?? [];
}

// ---------------------------------------------------------------------------
// Orderbook depth
// ---------------------------------------------------------------------------

export interface KalshiOrderbookLevel {
  price: number;   // fractional 0–1
  delta: number;   // contract quantity
}

export interface KalshiOrderbookDepth {
  bids: KalshiOrderbookLevel[];
  asks: KalshiOrderbookLevel[];
}

/**
 * Fetch full orderbook depth for a batch of Kalshi tickers.
 * Requests are serialised (one at a time) to stay within rate limits.
 * Returns a Map<ticker, depth>; missing/errored tickers are omitted.
 *
 * Only called when ENABLE_ORDERBOOK_DEPTH env var is set.
 */
export async function fetchKalshiOrderbooks(
  tickers: string[],
): Promise<Map<string, KalshiOrderbookDepth>> {
  const result = new Map<string, KalshiOrderbookDepth>();
  for (const ticker of tickers) {
    const url = `${KALSHI_BASE}/market/${encodeURIComponent(ticker)}/orderbook`;
    let res: Response;
    try {
      res = await fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS);
    } catch {
      continue;
    }
    if (!res.ok) continue;
    let data: unknown;
    try { data = await res.json(); } catch { continue; }

    // Response: { orderbook: { yes: [[price_int, size], ...], no: [...] } }
    // Kalshi prices are integers 1–99 representing cents (¢ = pp)
    const ob = (data as Record<string, unknown>).orderbook as Record<string, unknown> | undefined;
    if (!ob) continue;

    const parseLevel = (raw: unknown): KalshiOrderbookLevel[] => {
      if (!Array.isArray(raw)) return [];
      return raw.map((pair: unknown) => {
        const p = Array.isArray(pair) ? pair : [];
        return { price: Number(p[0] ?? 0) / 100, delta: Number(p[1] ?? 0) };
      });
    };

    result.set(ticker, {
      bids: parseLevel(ob.yes),  // yes bids = buyers of YES
      asks: parseLevel(ob.no),   // no bids = equivalent to YES asks
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Batch candlestick requests: up to 100 tickers per POST body
const CANDLESTICK_BATCH_SIZE = 100;
// Fetch 35 days of daily candles — enough for 7d/30d deltas (1d now from previous_price_dollars)
const CANDLESTICK_LOOKBACK_DAYS = 35;

/**
 * Fetch daily OHLCV candlesticks for a set of tickers via the batch endpoint.
 * Returns a map of ticker → KalshiCandle[] (sorted ascending by ts).
 * Used for oneWeekChange and oneMonthChange; oneDayChange is now derived
 * directly from previous_price_dollars on the market object.
 */
export async function fetchKalshiCandlesticks(
  tickers: string[],
): Promise<Map<string, KalshiCandle[]>> {
  const result = new Map<string, KalshiCandle[]>();
  if (tickers.length === 0) return result;

  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - CANDLESTICK_LOOKBACK_DAYS * 24 * 60 * 60;

  for (let i = 0; i < tickers.length; i += CANDLESTICK_BATCH_SIZE) {
    const batch = tickers.slice(i, i + CANDLESTICK_BATCH_SIZE);
    const url = `${KALSHI_BASE}/market/batch_candlesticks`;
    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: batch,
          start_ts: startTs,
          end_ts: endTs,
          period_interval: 1440,
        }),
      }, FETCH_TIMEOUT_MS);
    } catch (err) {
      console.warn("[kalshi] batch_candlesticks fetch error:", err);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[kalshi] batch_candlesticks ${res.status}: ${body}`);
      continue;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.warn("[kalshi] batch_candlesticks invalid JSON");
      continue;
    }

    const items = (data as Record<string, unknown>).candlesticks;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const t = String((item as Record<string, unknown>).ticker ?? "");
      if (!t) continue;
      const history = (item as Record<string, unknown>).history;
      if (!Array.isArray(history)) continue;
      const candles: KalshiCandle[] = history.map((h: Record<string, unknown>) => ({
        ticker: t,
        open: parseFloat(String(h.open_price ?? "0")) || 0,
        high: parseFloat(String(h.high_price ?? "0")) || 0,
        low: parseFloat(String(h.low_price ?? "0")) || 0,
        close: parseFloat(String(h.close_price ?? "0")) || 0,
        volume: parseFloat(String(h.volume ?? "0")) || 0,
        ts: Number(h.start_period_ts ?? 0),
      }));
      candles.sort((a, b) => a.ts - b.ts);
      result.set(t, candles);
    }
  }

  return result;
}

/**
 * Fetch all active Kalshi markets using the nested-markets API:
 *   1. Paginate /events?with_nested_markets=true&status=open (up to MAX_EVENT_PAGES)
 *      → eliminates the old per-event /markets fan-out (~1,000 calls → ~5 calls)
 *   2. Extract markets from event.markets[] — already includes all pricing fields
 *      including previous_price_dollars for direct 24h change computation
 *   3. Fetch series list for recurring-event context (title, frequency) in parallel
 *   4. Fetch 35-day daily candlesticks for active tickers (for 7d/30d deltas)
 */
export async function fetchAllKalshiMarkets(): Promise<{
  markets: KalshiMarket[];
  candleMap: Map<string, KalshiCandle[]>;
  seriesMap: Map<string, KalshiSeries>;
}> {
  // Step 1: Paginate events (with nested markets) + fetch series list in parallel
  const [allEvents, seriesRaw] = await Promise.all([
    (async () => {
      const events: KalshiEventWithMarkets[] = [];
      let cursor: string | null | undefined = undefined;
      for (let page = 0; page < MAX_EVENT_PAGES; page++) {
        const result = await fetchEventsPage(cursor ?? undefined);
        events.push(...result.events);
        cursor = result.cursor;
        if (!cursor) break;
      }
      return events;
    })(),
    fetchKalshiSeries(),
  ]);

  // Build seriesMap: series_ticker → KalshiSeries for O(1) enrichment
  const seriesMap = new Map<string, KalshiSeries>();
  for (const s of seriesRaw) {
    if (s.ticker) seriesMap.set(s.ticker, s);
  }

  if (allEvents.length === 0) return { markets: [], candleMap: new Map(), seriesMap };

  // Step 2: Extract markets from nested events, annotating each with event-level category
  const allMarkets: KalshiMarket[] = [];
  for (const event of allEvents) {
    for (const market of event.markets ?? []) {
      allMarkets.push({
        ...market,
        category: event.category,
        series_ticker: event.series_ticker || market.event_ticker?.split("-")[0],
      });
    }
  }

  // Step 3: No batch candlestick endpoint exists in the current Kalshi API
  // (the old POST /market/batch_candlesticks was removed; the replacement is
  // per-market GET /series/{s}/markets/{t}/candlesticks which would recreate
  // the fan-out problem). oneDayChange is derived from previous_price_dollars
  // directly; oneWeekChange is unavailable and Pulse excludes Kalshi from
  // weekly signals (same as Manifold).
  const candleMap = new Map<string, KalshiCandle[]>();

  return { markets: allMarkets, candleMap, seriesMap };
}
