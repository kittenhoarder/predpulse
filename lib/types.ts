// Raw market object returned by the Kalshi Trade API v2 /events?with_nested_markets=true
export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: "binary" | "scalar";
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: "initialized" | "inactive" | "active" | "closed" | "determined" | "disputed" | "amended" | "finalized";
  yes_bid_dollars: string;        // e.g. "0.5400"
  yes_ask_dollars: string;        // e.g. "0.5600"
  last_price_dollars: string;     // e.g. "0.5500" — current last traded price
  previous_price_dollars?: string; // last traded price 24h ago — from nested markets API
  volume_24h_fp: string;          // 24h volume as FixedPoint string
  volume_fp: string;              // lifetime volume as FixedPoint string
  open_interest_fp: string;       // open contracts as FixedPoint string
  open_time?: string;             // ISO timestamp
  close_time?: string;            // ISO timestamp
  result?: string;
  // Series category — populated after series lookup
  category?: string;
  series_ticker?: string;
}

// Raw series object from Kalshi /series endpoint
export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  frequency?: string;
}

// Single OHLCV candle from the Kalshi batch_candlesticks endpoint
export interface KalshiCandle {
  ticker: string;
  open: number;   // fractional 0–1
  high: number;
  low: number;
  close: number;
  volume: number; // contracts traded
  ts: number;     // unix timestamp seconds (start of period)
}

// Raw market object returned by the Polymarket Gamma API /events endpoint
export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  outcomes: string; // JSON string: "[\"Yes\",\"No\"]"
  outcomePrices: string; // JSON string: "[\"0.65\",\"0.35\"]"
  volume: string;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volumeNum: number;
  liquidity: string;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  endDate: string;
  image: string;
  icon: string;
  description: string;
  resolutionSource: string;
  enableOrderBook: boolean;
  clobTokenIds: string; // JSON string of token IDs
  oneDayPriceChange: number; // fractional, e.g. 0.016 = +1.6pp
  oneHourPriceChange: number;
  oneWeekPriceChange: number;
  oneMonthPriceChange: number;
  lastTradePrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  competitive: number;
  negRisk: boolean;
  restricted: boolean;
  groupItemTitle: string;
  events: GammaEvent[];
}

// Raw event object returned by the Gamma API /events endpoint
export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  liquidity: number;
  volume: number;
  volume24hr: number;
  createdAt: string;
  updatedAt: string;
  markets?: GammaMarket[];
  tags?: GammaTag[];
  series?: GammaSeries[];
}

export interface GammaTag {
  id: string;
  label: string;
  slug: string;
}

export interface GammaSeries {
  id: string;
  slug: string;
  title: string;
}

// Processed market shape used by the frontend
export interface ProcessedMarket {
  id: string;
  question: string;
  // Data source — drives source badge in the UI
  source: "polymarket" | "kalshi" | "manifold";
  // Event-level slug used to build: https://polymarket.com/event/{eventSlug}
  eventSlug: string;
  // Event-level title (e.g. "MicroStrategy Bitcoin 2025")
  eventTitle: string;
  // Normalised category slugs (from Gamma tag slugs, e.g. "crypto", "politics")
  categoryslugs: string[];
  // Human-readable labels for the same tags
  categories: string[];
  image: string;
  // Yes outcome price as percentage 0–100
  currentPrice: number;
  // Price changes as percentage points (oneDayPriceChange * 100)
  oneDayChange: number;
  oneHourChange: number;
  oneWeekChange: number;
  oneMonthChange: number;
  volume24h: number;
  volume1wk: number;
  volume1mo: number;
  liquidity: number;
  createdAt: string;
  endDate: string;
  // Raw fractional prices for Yes/No labels
  outcomes: string[];
  outcomePrices: number[];
  // Order book
  bestBid: number;
  bestAsk: number;
  spread: number;
  // First CLOB token ID — used to fetch price history for sparkline
  clobTokenId: string;
  // Resolution metadata
  description: string;
  resolutionSource: string;
  // 0–1 score of market competitiveness
  competitive: number;
  // Orderbook depth snapshot (Kalshi + Polymarket only; absent when ENABLE_ORDERBOOK_DEPTH is unset)
  orderbookDepth?: {
    // Price levels as [price_0_to_1, size_contracts]
    bids: [number, number][];
    asks: [number, number][];
    // 0–100: bid quantity within 5pp of mid-price as % of total near-mid depth (bid+ask)
    depthScore: number;
  };
  // Kalshi series context (e.g. "Monthly Jobs Report", frequency "monthly")
  seriesTitle?: string;
  seriesFrequency?: string;
  // True open interest from data-api (Polymarket only; absent when ENABLE_SMART_MONEY is unset)
  openInterest?: number;
  // 0–100 smart money concentration score (Polymarket only)
  smartMoneyScore?: number;
  // Top position holders (Polymarket only)
  topHolders?: { address: string; shares: number; side: "YES" | "NO" }[];
  // Directional polarity for category-up interpretation:
  // +1 => YES means category-up, -1 => YES means category-down
  polarity?: 1 | -1;
}

// Live price overlay from WebSocket (best_bid_ask events)
export interface LivePrice {
  // Yes outcome probability as percentage 0–100 (best ask * 100)
  price: number;
  flash: "up" | "down" | null;
}

// A single hourly snapshot of a category's Pulse score (for sparkline history)
export interface PulseSnapshot {
  // ISO timestamp of when this snapshot was taken
  timestamp: string;
  score: number;
}

// Predpulse Index entry for a single category
export interface PulseIndex {
  // e.g. "politics", "crypto", "economics"
  category: string;
  // Human-readable label, e.g. "Politics"
  label: string;
  // Composite score 0–100
  score: number;
  // Semantic band label
  band: "Extreme Bearish" | "Bearish" | "Neutral" | "Bullish" | "Extreme Bullish";
  // Change in score vs. 24h ago (pp)
  delta24h: number;
  // Component signal scores (each 0–100) for transparency display
  signals: {
    momentum: number;           // OI-weighted 7d price change (direction)
    flow: number;               // volume-weighted 24h price change (money-backed direction)
    breadth: number;            // volume-magnitude-weighted bullish breadth
    acceleration?: number;      // compatibility placeholder (neutral 50 in core3 mode)
    level: number;              // volume-weighted avg probability (context anchor)
    orderflow?: number;         // bid/ask depth imbalance from orderbook (optional)
    smartMoney?: number;        // directional whale YES/NO bias (optional)
  };
  // Number of constituent markets by source
  marketCount: { polymarket: number; kalshi: number; manifold: number; total: number };
  // Top 5 constituent market IDs + questions + scores for card expansion
  topMarkets: Array<{ id: string; question: string; currentPrice: number; source: "polymarket" | "kalshi" | "manifold"; eventSlug: string }>;
  // Up to 48 hourly snapshots (oldest first) for sparkline
  history: PulseSnapshot[];
  // ISO timestamp of computation
  computedAt: string;
  // Forecast-quality confidence (0-100)
  confidence?: number;
  // Coverage diagnostics for optional signals and source support
  coverage?: IndexCoverage;
  // Family/horizon metadata (Pulse is directional alias)
  family?: IndexFamily;
  horizon?: IndexHorizon;
  diagnostics?: IndexDiagnostics;
}

export type IndexFamily = "directional" | "liquidity" | "divergence" | "certainty";

export type IndexHorizon = "24h" | "7d";
export type IndexScoreProfile = "core3" | "full";

export type IndexSourceScope = "core" | "all" | "polymarket" | "kalshi" | "manifold";

export interface IndexCoverage {
  // Share of category markets used in core scoring, 0-100
  marketCoverage: number;
  // Share of OI carrying each optional signal, 0-100
  oiCoverage: {
    orderflow: number;
    smartMoney: number;
  };
  // Share of directional weight that is active, 0-100
  featureCoverage: number;
}

export interface IndexDiagnostics {
  freshness: number; // 0-100
  sourceAgreement: number; // 0-100
  featureCoverage: number; // 0-100
  includedSignals: string[];
  excludedSignals: string[];
  rawSignals: Record<string, number>;
  notes?: string[];
}

export interface OperatorIndex {
  category: string;
  label: string;
  family: IndexFamily;
  horizon: IndexHorizon;
  sourceScope: IndexSourceScope;
  score: number;
  confidence: number;
  delta24h: number;
  coverage: IndexCoverage;
  diagnostics: IndexDiagnostics;
  signals: Record<string, number>;
  marketCount: { polymarket: number; kalshi: number; manifold: number; total: number };
  topMarkets: Array<{ id: string; question: string; currentPrice: number; source: "polymarket" | "kalshi" | "manifold"; eventSlug: string }>;
  history: PulseSnapshot[];
  computedAt: string;
}

export interface IndicesApiResponse {
  indices: OperatorIndex[];
  family: IndexFamily | "all";
  horizon: IndexHorizon;
  sourceScope: IndexSourceScope;
  computedAt: string;
}

// Shape returned by GET /api/pulse
export interface PulseApiResponse {
  indices: PulseIndex[];
  computedAt: string;
}

// Shape returned by GET /api/markets
export interface MarketsApiResponse {
  markets: ProcessedMarket[];
  // ISO timestamp of when data was fetched from Gamma (not request time)
  cachedAt: string;
  totalMarkets: number;
  pageSize: number;
  fromCache: boolean;
  // Market counts by source for the current filtered set (pre-pagination)
  sourceBreakdown: {
    polymarket: number;
    kalshi: number;
    manifold: number;
  };
}

export type SortMode =
  | "movers"
  | "movers1h"
  | "gainers"
  | "losers"
  | "volume"
  | "liquidity"
  | "new"
  | "watchlist";

// ---------------------------------------------------------------------------
// Context Intelligence Layer — external data types
// ---------------------------------------------------------------------------

// GDELT Doc API article (tone: negative = bearish sentiment)
export interface GdeltArticle {
  url: string;
  title: string;
  domain: string;
  // GDELT seendate format: "20240315T120000Z"
  seendate: string;
  // GDELT tone float — negative is bearish/negative sentiment, positive is positive
  tone: number;
  // og:image URL extracted server-side by /api/news proxy (absent when fetched directly)
  image?: string;
  // Optional summary text (e.g. Guardian trailText) for in-app expansion
  summary?: string;
}

// Metaculus community question with forecast
export interface MetaculusQuestion {
  id: number;
  title: string;
  // Full URL to the Metaculus question page
  url: string;
  // Community median probability 0–1, null if no forecast yet
  communityMedian: number | null;
  resolutionCriteria: string;
}

// FRED series observation (filtered, ascending order for charting)
export interface FredObservation {
  date: string;
  value: number;
}

// CoinGecko daily price point for 90-day market chart
export interface CoinGeckoPricePoint {
  date: string;
  price: number;
}
