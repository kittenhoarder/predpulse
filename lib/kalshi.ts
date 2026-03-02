import type { KalshiMarket, KalshiSeries, KalshiCandle } from "./types";
import { fetchWithTimeout, fetchWithRetry } from "./fetch-utils";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const FETCH_TIMEOUT_MS = 15_000;
const EVENTS_PAGE_LIMIT = 200;
// 3 pages × 200 events = 600 events max. Each page with with_nested_markets=true
// returns 2-5MB; 3 pages stays well within a 45s cold-start budget.
// Increasing this risks timeouts and does not meaningfully improve Pulse quality.
const MAX_EVENT_PAGES = 3;
// Minimum open_interest_fp (dollars) for a ticker to qualify for the candle fetch.
// Tickers below this floor still reach processKalshiMarkets(); they get
// volume1wk/volume1mo = 0 (the same graceful fallback as missing candle data).
// Raising this value reduces candlestick batch requests at the cost of 7d/30d
// coverage on smaller markets.
const KALSHI_CANDLE_MIN_OI = 500;

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
 * Wrapped in fetchWithRetry so transient 429s are retried with backoff instead
 * of silently returning an empty page and halting pagination.
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
  let res: Response;
  try {
    res = await fetchWithRetry(
      () => fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS),
    );
  } catch (err) {
    console.error(`[kalshi] events page fetch failed:`, err);
    return { events: [], cursor: null };
  }

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
  let res: Response;
  try {
    res = await fetchWithRetry(
      () => fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS),
    );
  } catch {
    console.warn("[kalshi] series fetch failed after retries");
    return [];
  }
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
// Batch candlestick requests: up to 100 tickers per request
const CANDLESTICK_BATCH_SIZE = 100;
// Fetch 35 days of daily candles — enough for 7d/30d deltas (1d now from previous_price_dollars)
const CANDLESTICK_LOOKBACK_DAYS = 35;
let warnedCandlestick404 = false;

async function fetchLegacyBatchCandlesticks(
  tickers: string[],
  startTs: number,
  endTs: number,
): Promise<Response | null> {
  const url = `${KALSHI_BASE}/market/batch_candlesticks`;
  try {
    return await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers,
          start_ts: startTs,
          end_ts: endTs,
          period_interval: 1440,
        }),
      },
      FETCH_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

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
    const params = new URLSearchParams({
      market_tickers: batch.join(","),
      start_ts: String(startTs),
      end_ts: String(endTs),
      period_interval: "1440",
    });
    const url = `${KALSHI_BASE}/markets/candlesticks?${params.toString()}`;
    let res: Response;
    try {
      res = await fetchWithRetry(
        () => fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS),
      );
    } catch (err) {
      console.warn("[kalshi] markets/candlesticks fetch error:", err);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404) {
        if (!warnedCandlestick404) {
          warnedCandlestick404 = true;
          console.warn(`[kalshi] markets/candlesticks 404, trying legacy fallback: ${body.slice(0, 180)}`);
        }
        const legacyRes = await fetchLegacyBatchCandlesticks(batch, startTs, endTs);
        if (!legacyRes || !legacyRes.ok) {
          const legacyBody = legacyRes ? await legacyRes.text().catch(() => "") : "";
          console.warn(`[kalshi] legacy batch_candlesticks failed: ${legacyRes?.status ?? "no_response"} ${legacyBody.slice(0, 120)}`);
          continue;
        }
        res = legacyRes;
      } else {
        console.warn(`[kalshi] markets/candlesticks ${res.status}: ${body}`);
        continue;
      }
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.warn("[kalshi] markets/candlesticks invalid JSON");
      continue;
    }

    // Primary shape:
    // { markets: [{ market_ticker, candlesticks: [{ end_period_ts, price: { close_dollars }, volume_fp }, ...] }] }
    // Legacy shape:
    // { candlesticks: [{ ticker, history: [{ open_price, close_price, ... }] }] }
    const root = data as Record<string, unknown>;
    const items = Array.isArray(root.markets) ? root.markets : Array.isArray(root.candlesticks) ? root.candlesticks : [];
    if (!Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      const rec = item as Record<string, unknown>;
      const t = String(rec.market_ticker ?? rec.ticker ?? "");
      if (!t) continue;

      const sticks = rec.candlesticks;
      const history = rec.history;
      const rawCandles = Array.isArray(sticks) ? sticks : Array.isArray(history) ? history : [];
      if (rawCandles.length === 0) continue;

      const candles: KalshiCandle[] = rawCandles.map((h: Record<string, unknown>) => {
        const price = (h.price as Record<string, unknown> | undefined) ?? {};
        const yesBid = (h.yes_bid as Record<string, unknown> | undefined) ?? {};

        // Backward-compatible parsing across old/new shapes.
        const close =
          parseFloat(String(price.close_dollars ?? yesBid.close_dollars ?? h.close_price ?? "0")) || 0;
        const open =
          parseFloat(String(price.open_dollars ?? yesBid.open_dollars ?? h.open_price ?? close)) || close;
        const high =
          parseFloat(String(price.high_dollars ?? yesBid.high_dollars ?? h.high_price ?? close)) || close;
        const low =
          parseFloat(String(price.low_dollars ?? yesBid.low_dollars ?? h.low_price ?? close)) || close;
        const volume = parseFloat(String(h.volume_fp ?? h.volume ?? "0")) || 0;
        const endTs = Number(h.end_period_ts ?? h.start_period_ts ?? 0);

        return {
          ticker: t,
          open,
          high,
          low,
          close,
          volume,
          ts: endTs,
        };
      });

      candles.sort((a, b) => a.ts - b.ts);
      result.set(t, candles);
    }
  }

  return result;
}

/**
 * Fetch all active Kalshi markets using the nested-markets API:
 *   1. Paginate /events?with_nested_markets=true&status=open sequentially with
 *      per-page 429 retry — avoids burst that triggered rate limits.
 *      Series fetch starts concurrently with the last page to recover latency.
 *   2. Extract markets from event.markets[] — includes all pricing fields
 *      including previous_price_dollars for direct 24h change computation.
 *   3. Fetch daily candlesticks in batch for tickers above the OI floor.
 */
export async function fetchAllKalshiMarkets(): Promise<{
  markets: KalshiMarket[];
  candleMap: Map<string, KalshiCandle[]>;
  seriesMap: Map<string, KalshiSeries>;
}> {
  // Step 1: Paginate events sequentially (cursor-based) with per-page 429 retry.
  // Series is fetched concurrently with the LAST events page — this avoids the
  // original burst that caused 429s (series + page 1 firing simultaneously) while
  // recovering ~1-2s vs fully sequential. If only one page is needed, series still
  // runs in parallel with it, which is safe since a single-page run is much lighter.
  const allEvents: KalshiEventWithMarkets[] = [];
  let cursor: string | null | undefined = undefined;
  let seriesPromise: Promise<KalshiSeries[]> | null = null;

  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    const isLastPage = page === MAX_EVENT_PAGES - 1;
    // Start series fetch on the last page so it overlaps with that final RTT
    if (isLastPage && !seriesPromise) {
      seriesPromise = fetchKalshiSeries();
    }
    const result = await fetchEventsPage(cursor ?? undefined);
    allEvents.push(...result.events);
    cursor = result.cursor;
    if (!cursor) {
      // Pagination ended early — start series now if not already started
      if (!seriesPromise) seriesPromise = fetchKalshiSeries();
      break;
    }
  }

  const seriesRaw = await (seriesPromise ?? fetchKalshiSeries());

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

  // Step 3: Pull daily candle history in batches to recover 7d/30d metrics.
  // Only fetch candles for markets above KALSHI_CANDLE_MIN_OI — cuts batch
  // requests 3–5x (e.g. 2,000 tickers → ~400–600).
  const activeTickers = allMarkets
    .filter(
      (m) =>
        m.status === "active" &&
        parseFloat(m.open_interest_fp ?? "0") >= KALSHI_CANDLE_MIN_OI,
    )
    .map((m) => m.ticker);
  const candleMap = await fetchKalshiCandlesticks(activeTickers).catch(() => new Map());

  return { markets: allMarkets, candleMap, seriesMap };
}
