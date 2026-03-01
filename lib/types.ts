// Raw market object returned by the Kalshi Trade API v2 /markets endpoint
export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: "binary" | "scalar";
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: "initialized" | "inactive" | "active" | "closed" | "determined" | "disputed" | "amended" | "finalized";
  yes_bid_dollars: string;   // e.g. "0.5400"
  yes_ask_dollars: string;   // e.g. "0.5600"
  last_price_dollars: string; // e.g. "0.5500"
  volume_24h_fp: string;     // 24h volume as FixedPoint string
  volume_fp: string;         // lifetime volume as FixedPoint string
  open_interest_fp: string;  // open contracts as FixedPoint string
  open_time?: string;        // ISO timestamp
  close_time?: string;       // ISO timestamp
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
    prob: number;
    momentum: number;
    breadth: number;
    volWeighted: number;
    decay: number;
    consensus: number;
  };
  // Number of constituent markets by source
  marketCount: { polymarket: number; kalshi: number; manifold: number; total: number };
  // Top 5 constituent market IDs + questions + scores for card expansion
  topMarkets: Array<{ id: string; question: string; currentPrice: number; source: "polymarket" | "kalshi" | "manifold" }>;
  // Up to 48 hourly snapshots (oldest first) for sparkline
  history: PulseSnapshot[];
  // ISO timestamp of computation
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
  fromCache: boolean;
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
