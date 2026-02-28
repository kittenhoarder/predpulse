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
  volumeNum: number;
  liquidity: string;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  image: string;
  icon: string;
  description: string;
  enableOrderBook: boolean;
  clobTokenIds: string; // JSON string of token IDs
  oneDayPriceChange: number; // fractional, e.g. 0.016 = +1.6pp
  oneHourPriceChange: number;
  oneWeekPriceChange: number;
  oneMonthPriceChange: number;
  lastTradePrice: number;
  bestBid: number;
  bestAsk: number;
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
  // Event-level slug used to build: https://polymarket.com/event/{eventSlug}
  eventSlug: string;
  // Normalised category slugs (from Gamma tag slugs, e.g. "crypto", "politics")
  categoryslugs: string[];
  // Human-readable labels for the same tags
  categories: string[];
  image: string;
  // Yes outcome price as percentage 0–100
  currentPrice: number;
  // oneDayPriceChange * 100 (percentage points moved)
  oneDayChange: number;
  volume24h: number;
  liquidity: number;
  createdAt: string;
  // Raw fractional prices for Yes/No labels
  outcomes: string[];
  outcomePrices: number[];
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
  | "gainers"
  | "losers"
  | "volume"
  | "liquidity"
  | "new";
