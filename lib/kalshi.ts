import type { KalshiMarket, KalshiSeries, KalshiCandle } from "./types";
import { fetchWithTimeout } from "./fetch-utils";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const FETCH_TIMEOUT_MS = 15_000;
const EVENTS_PAGE_LIMIT = 200;
const MAX_EVENT_PAGES = 5;
const MAX_CONCURRENT_MARKET_FETCHES = 10;

interface KalshiEventSummary {
  event_ticker: string;
  category: string;
  title: string;
  series_ticker: string;
}

/**
 * Fetch one page of Kalshi events.
 * Events have a `category` field directly (e.g. "Politics", "Climate and Weather").
 * Returns { events, cursor } where cursor is null on the last page.
 */
async function fetchEventsPage(
  cursor?: string
): Promise<{ events: KalshiEventSummary[]; cursor: string | null }> {
  const params = new URLSearchParams({ limit: String(EVENTS_PAGE_LIMIT) });
  if (cursor) params.set("cursor", cursor);

  const url = `${KALSHI_BASE}/events?${params.toString()}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[kalshi] ${res.status} fetching events: ${body}`);
    return { events: [], cursor: null };
  }

  const data = await res.json();
  const events: KalshiEventSummary[] = (data.events ?? []).map(
    (e: Record<string, unknown>) => ({
      event_ticker: String(e.event_ticker ?? ""),
      category: String(e.category ?? "general"),
      title: String(e.title ?? ""),
      series_ticker: String(e.series_ticker ?? ""),
    })
  );
  return { events, cursor: data.cursor ?? null };
}

/**
 * Fetch all markets for a single event ticker.
 * Returns an empty array on any error so one bad event doesn't block the rest.
 */
async function fetchMarketsForEvent(
  eventTicker: string,
  category: string
): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({
    event_ticker: eventTicker,
    limit: "100",
  });
  const url = `${KALSHI_BASE}/markets?${params.toString()}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    console.warn(`[kalshi] ${res.status} fetching markets for event ${eventTicker}`);
    return [];
  }

  const data = await res.json();
  const markets: KalshiMarket[] = data.markets ?? [];
  // Annotate each market with the event-level category (more reliable than series lookup)
  return markets.map((m) => ({ ...m, category, series_ticker: m.event_ticker?.split("-")[0] }));
}

/**
 * Fetch all active Kalshi series (exported for external use if needed).
 */
export async function fetchKalshiSeries(): Promise<KalshiSeries[]> {
  const params = new URLSearchParams({ limit: "200" });
  const url = `${KALSHI_BASE}/series?${params.toString()}`;
  const res = await fetchWithTimeout(url);
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
 * Requests are serialised (one at a time) to avoid rate-limiting.
 * Returns a Map<ticker, depth>; missing/errored tickers are omitted.
 *
 * Only called when ENABLE_ORDERBOOK_DEPTH env var is set.
 */
export async function fetchKalshiOrderbooks(
  tickers: string[]
): Promise<Map<string, KalshiOrderbookDepth>> {
  const result = new Map<string, KalshiOrderbookDepth>();
  for (const ticker of tickers) {
    const url = `${KALSHI_BASE}/market/${encodeURIComponent(ticker)}/orderbook`;
    let res: Response;
    try {
      res = await fetchWithTimeout(url);
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
      bids: parseLevel(ob.yes),  // yes bids = ascending price = buyers of YES
      asks: parseLevel(ob.no),   // no bids = equivalent to YES asks
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Batch candlestick requests: up to 100 tickers per POST body
const CANDLESTICK_BATCH_SIZE = 100;
// Fetch 35 days of daily candles — enough for 1d/7d/30d deltas
const CANDLESTICK_LOOKBACK_DAYS = 35;

/**
 * Fetch daily OHLCV candlesticks for a set of tickers via the batch endpoint.
 * Returns a map of ticker → KalshiCandle[] (sorted ascending by ts).
 * On any error the affected tickers are silently omitted.
 */
export async function fetchKalshiCandlesticks(
  tickers: string[]
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

    // Response shape: { candlesticks: { ticker: string, history: { open_price, high_price, low_price, close_price, volume, start_period_ts }[] }[] }
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
      // Sort ascending so index 0 = oldest
      candles.sort((a, b) => a.ts - b.ts);
      result.set(t, candles);
    }
  }

  return result;
}

/**
 * Fetch all active Kalshi markets via the events topology:
 *   1. Paginate /events (up to MAX_EVENT_PAGES × 200 = 1,000 events)
 *   2. Batch-fetch /markets?event_ticker=X in groups of MAX_CONCURRENT_MARKET_FETCHES
 *   3. Each market is annotated with the event-level category string
 *   4. Fetch 35-day daily candlesticks for all active tickers (batch endpoint)
 *   5. Fetch series list to provide recurring-event context (title, frequency)
 *
 * This is the correct approach because:
 *   - The raw /markets paginator returns MVE (sports-parlay) markets first, which are unpriced
 *   - /events includes the `category` field directly (no series lookup required)
 *   - Standard binary markets (politics, crypto, etc.) are reliably accessible via event_ticker filter
 */
export async function fetchAllKalshiMarkets(): Promise<{
  markets: KalshiMarket[];
  candleMap: Map<string, KalshiCandle[]>;
  seriesMap: Map<string, KalshiSeries>;
}> {
  // Step 1: Collect all event summaries + series list in parallel
  const [eventsResult, seriesRaw] = await Promise.all([
    (async () => {
      const allEvents: KalshiEventSummary[] = [];
      let cursor: string | null | undefined = undefined;
      for (let page = 0; page < MAX_EVENT_PAGES; page++) {
        const result = await fetchEventsPage(cursor ?? undefined);
        allEvents.push(...result.events);
        cursor = result.cursor;
        if (!cursor) break;
      }
      return allEvents;
    })(),
    fetchKalshiSeries(),
  ]);

  // Build seriesMap: ticker → KalshiSeries for O(1) enrichment
  const seriesMap = new Map<string, KalshiSeries>();
  for (const s of seriesRaw) {
    if (s.ticker) seriesMap.set(s.ticker, s);
  }

  const allEvents = eventsResult;
  if (allEvents.length === 0) return { markets: [], candleMap: new Map(), seriesMap };

  // Step 2: Batch-fetch markets for all events, MAX_CONCURRENT at a time
  const allMarkets: KalshiMarket[] = [];

  for (let i = 0; i < allEvents.length; i += MAX_CONCURRENT_MARKET_FETCHES) {
    const batch = allEvents.slice(i, i + MAX_CONCURRENT_MARKET_FETCHES);
    const results = await Promise.all(
      batch.map((e) => fetchMarketsForEvent(e.event_ticker, e.category))
    );
    for (const markets of results) {
      allMarkets.push(...markets);
    }
  }

  // Step 3: Fetch daily candlesticks for all active market tickers
  const activeTickers = allMarkets
    .filter((m) => m.status === "active")
    .map((m) => m.ticker);
  const candleMap = await fetchKalshiCandlesticks(activeTickers);

  return { markets: allMarkets, candleMap, seriesMap };
}
