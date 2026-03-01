import type { KalshiMarket, KalshiCandle, KalshiSeries, ProcessedMarket } from "./types";
import type { KalshiOrderbookDepth } from "./kalshi";
import { computeDepthScore } from "./orderbook";
import { inferPolarity } from "./polarity";

/**
 * Maps Kalshi event-level category strings (exact API values) to Pulse-compatible slugs.
 * Keys are the literal strings returned by GET /events .category field.
 * Also includes lowercase variants for defensive fallback.
 */
const KALSHI_CATEGORY_MAP: Record<string, string> = {
  // Exact Kalshi API values (title-cased)
  "Politics": "politics",
  "Elections": "politics",
  "World": "geopolitics",
  "Financials": "economics",
  "Economics": "economics",
  "Science and Technology": "tech",
  "Climate and Weather": "climate",
  "Sports": "sports",
  "Entertainment": "entertainment",
  "Social": "general",
  "Health": "health",
  "Companies": "economics",
  "Transportation": "general",
  "Crypto": "crypto",
  // Lowercase fallbacks (used when category comes pre-lowercased)
  politics: "politics",
  elections: "politics",
  world: "geopolitics",
  financials: "economics",
  economics: "economics",
  "science and technology": "tech",
  "climate and weather": "climate",
  sports: "sports",
  entertainment: "entertainment",
  social: "general",
  health: "health",
  companies: "economics",
  transportation: "general",
  crypto: "crypto",
  // Legacy keys kept for any data already in the pipeline
  economy: "economics",
  technology: "tech",
  tech: "tech",
  political: "politics",
  climate: "climate",
  environment: "climate",
  science: "tech",
  geopolitics: "geopolitics",
  finance: "economics",
  business: "economics",
  general: "general",
};

// Maps Pulse slug to human-readable label
const CATEGORY_LABELS: Record<string, string> = {
  economics: "Economics",
  tech: "Tech",
  politics: "Politics",
  climate: "Climate",
  sports: "Sports",
  entertainment: "Entertainment",
  health: "Health",
  crypto: "Crypto",
  geopolitics: "Geopolitics",
  general: "General",
};

function normalizeCategory(raw: string | undefined): { slug: string; label: string } {
  // Try exact match first, then lowercase fallback
  const exact = raw ?? "general";
  const slug = KALSHI_CATEGORY_MAP[exact] ?? KALSHI_CATEGORY_MAP[exact.toLowerCase().trim()] ?? "general";
  const label = CATEGORY_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  return { slug, label };
}

/** Parse Kalshi FixedPoint dollar string to a 0–100 probability percentage. */
function fpToPrice(fp: string | undefined): number {
  const val = parseFloat(fp ?? "0");
  if (isNaN(val)) return 0;
  // Kalshi prices are in dollars where $1.00 = 100% probability
  return Math.round(val * 10000) / 100;
}

/** Parse Kalshi FixedPoint string to a plain number (volume, open interest). */
function fpToNumber(fp: string | undefined): number {
  const val = parseFloat(fp ?? "0");
  return isNaN(val) ? 0 : val;
}


/**
 * Derive price-change and volume fields from a sorted-ascending candle array.
 * All price values are in percentage points (0–100).
 */
export function deriveCandleMetrics(candles: KalshiCandle[]): {
  oneDayChange: number;
  oneWeekChange: number;
  oneMonthChange: number;
  volume1wk: number;
  volume1mo: number;
} {
  if (candles.length === 0) {
    return { oneDayChange: 0, oneWeekChange: 0, oneMonthChange: 0, volume1wk: 0, volume1mo: 0 };
  }

  const last = candles[candles.length - 1];
  const closeNow = last.close * 100; // convert fractional → pp

  // Price at N candles ago (each candle = 1 day)
  const closeDaysAgo = (n: number): number | null => {
    const idx = candles.length - 1 - n;
    return idx >= 0 ? candles[idx].close * 100 : null;
  };

  const close1dAgo = closeDaysAgo(1);
  const close7dAgo = closeDaysAgo(7);
  const close30dAgo = closeDaysAgo(30);

  const oneDayChange = close1dAgo !== null ? Math.round((closeNow - close1dAgo) * 10) / 10 : 0;
  const oneWeekChange = close7dAgo !== null ? Math.round((closeNow - close7dAgo) * 10) / 10 : 0;
  const oneMonthChange = close30dAgo !== null ? Math.round((closeNow - close30dAgo) * 10) / 10 : 0;

  // Volume sums over last N candles (excluding current partial day)
  const volumeWindow = (n: number): number => {
    const startIdx = Math.max(0, candles.length - 1 - n);
    return candles.slice(startIdx, candles.length - 1).reduce((sum, c) => sum + c.volume, 0);
  };

  return {
    oneDayChange,
    oneWeekChange,
    oneMonthChange,
    volume1wk: volumeWindow(7),
    volume1mo: volumeWindow(30),
  };
}

/**
 * Transform a single KalshiMarket into a ProcessedMarket.
 * Returns null for markets that should be excluded (non-active, no pricing).
 * candleMap provides daily OHLCV history for price-change and volume derivation.
 * obMap optionally provides orderbook depth for the depthScore signal.
 * seriesMap provides recurring-event context (title, frequency).
 */
function processKalshiMarket(
  market: KalshiMarket,
  candleMap: Map<string, KalshiCandle[]>,
  obMap: Map<string, KalshiOrderbookDepth>,
  seriesMap: Map<string, KalshiSeries>
): ProcessedMarket | null {
  if (market.status !== "active") return null;
  if (!market.yes_ask_dollars && !market.last_price_dollars) return null;

  const currentPrice = fpToPrice(market.yes_ask_dollars || market.last_price_dollars);
  const bestBid = fpToPrice(market.yes_bid_dollars);
  const bestAsk = fpToPrice(market.yes_ask_dollars);
  const spread = Math.max(0, bestAsk - bestBid);

  const { slug, label } = normalizeCategory(market.category);

  const volume24h = fpToNumber(market.volume_24h_fp);
  const openInterest = fpToNumber(market.open_interest_fp);
  // Use open_interest as a liquidity proxy (liquidity_dollars is deprecated/zero)
  const liquidity = openInterest;

  const candles = candleMap.get(market.ticker) ?? [];
  const { oneDayChange: candleOneDayChange, oneWeekChange, oneMonthChange, volume1wk, volume1mo } =
    deriveCandleMetrics(candles);

  // previous_price_dollars is provided by the nested-markets API; prefer it over candle
  // approximation since it's the authoritative 24h-ago price from the exchange.
  const oneDayChange = market.previous_price_dollars
    ? Math.round((fpToPrice(market.last_price_dollars) - fpToPrice(market.previous_price_dollars)) * 10) / 10
    : candleOneDayChange;

  // Build a human-readable event slug from the event_ticker for URL construction
  const eventSlug = market.event_ticker?.toLowerCase() ?? market.ticker.toLowerCase();

  // Derive series_ticker from event_ticker prefix (e.g. "KXJOBSREPORT-24JUN" → "KXJOBSREPORT")
  const seriesTicker = market.series_ticker ?? market.event_ticker?.split("-")[0] ?? "";
  const series = seriesTicker ? seriesMap.get(seriesTicker) : undefined;

  const ob = obMap.get(market.ticker);
  const mid = currentPrice / 100;
  const orderbookDepth = ob
    ? {
        bids: ob.bids.map((l) => [l.price, l.delta] as [number, number]),
        asks: ob.asks.map((l) => [l.price, l.delta] as [number, number]),
        depthScore: computeDepthScore(
          ob.bids.map((l) => ({ price: l.price, quantity: l.delta })),
          ob.asks.map((l) => ({ price: l.price, quantity: l.delta })),
          mid,
        ),
      }
    : undefined;

  return {
    id: market.ticker,
    question: market.title,
    source: "kalshi",
    eventSlug,
    eventTitle: market.title,
    categoryslugs: [slug],
    categories: [label],
    image: "",
    currentPrice,
    oneDayChange,
    // Kalshi batch_candlesticks is daily only; 1h change remains 0
    oneHourChange: 0,
    oneWeekChange,
    oneMonthChange,
    volume24h,
    volume1wk,
    volume1mo,
    liquidity,
    createdAt: market.open_time ?? new Date().toISOString(),
    endDate: market.close_time ?? "",
    outcomes: ["Yes", "No"],
    outcomePrices: [currentPrice / 100, 1 - currentPrice / 100],
    bestBid,
    bestAsk,
    spread,
    // Kalshi markets don't use CLOB token IDs; use ticker as a stable key for WS
    clobTokenId: market.ticker,
    description: "",
    resolutionSource: "https://kalshi.com",
    competitive: spread < 5 ? 1 : spread < 15 ? 0.5 : 0,
    orderbookDepth,
    seriesTitle: series?.title,
    seriesFrequency: series?.frequency,
    polarity: inferPolarity(market.title),
  };
}

/**
 * Process a list of KalshiMarket objects into ProcessedMarket[].
 * candleMap provides daily OHLCV for each ticker to derive price changes.
 * obMap optionally provides orderbook depth (gated by ENABLE_ORDERBOOK_DEPTH).
 * seriesMap provides recurring-event context (title, frequency) from /series.
 * Skips inactive/unpriceable markets silently.
 */
export function processKalshiMarkets(
  markets: KalshiMarket[],
  candleMap: Map<string, KalshiCandle[]> = new Map(),
  obMap: Map<string, KalshiOrderbookDepth> = new Map(),
  seriesMap: Map<string, KalshiSeries> = new Map()
): ProcessedMarket[] {
  const seen = new Set<string>();
  const result: ProcessedMarket[] = [];
  for (const m of markets) {
    if (seen.has(m.ticker)) continue;
    seen.add(m.ticker);
    const processed = processKalshiMarket(m, candleMap, obMap, seriesMap);
    if (processed) result.push(processed);
  }
  return result;
}
