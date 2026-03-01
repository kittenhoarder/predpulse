import type { ProcessedMarket, PulseIndex, PulseSnapshot } from "./types";

// Categories surfaced in Pulse (slug → label)
export const PULSE_CATEGORIES: Record<string, string> = {
  politics: "Politics",
  economics: "Economics",
  crypto: "Crypto",
  tech: "Tech",
  climate: "Climate",
  sports: "Sports",
  entertainment: "Entertainment",
  geopolitics: "Geopolitics",
};

const MIN_MARKETS = 3;

// In-memory snapshot history per category: up to 48 hourly snapshots
// Module-level so it persists across requests within the same serverless instance
const snapshotHistory = new Map<string, PulseSnapshot[]>();
const MAX_SNAPSHOTS = 48;

// Timestamp of the last snapshot taken (to avoid writing multiple per minute)
let lastSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Map a value from [fromMin, fromMax] to [0, 100]. */
function mapRange(val: number, fromMin: number, fromMax: number): number {
  if (fromMax === fromMin) return 50;
  return clamp(((val - fromMin) / (fromMax - fromMin)) * 100, 0, 100);
}

function getPulseLabel(score: number): PulseIndex["band"] {
  if (score <= 20) return "Extreme Bearish";
  if (score <= 40) return "Bearish";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Bullish";
  return "Extreme Bullish";
}

/** Resolve best available OI proxy: true OI → liquidity → 1. */
function getOI(m: ProcessedMarket): number {
  if (m.openInterest !== undefined && m.openInterest > 0) return m.openInterest;
  if (m.liquidity > 0) return m.liquidity;
  return 1;
}

// ---------------------------------------------------------------------------
// Signal definitions and unified weight system
// ---------------------------------------------------------------------------

interface SignalDef {
  key: string;
  baseWeight: number;
  optional: boolean;
}

const SIGNAL_DEFS: SignalDef[] = [
  { key: "momentum",     baseWeight: 0.25, optional: false },
  { key: "flow",         baseWeight: 0.20, optional: false },
  { key: "breadth",      baseWeight: 0.15, optional: false },
  { key: "acceleration", baseWeight: 0.15, optional: false },
  { key: "level",        baseWeight: 0.10, optional: false },
  { key: "orderflow",    baseWeight: 0.10, optional: true  },
  { key: "smartMoney",   baseWeight: 0.05, optional: true  },
];

/**
 * Given computed signal values (undefined for absent optional signals),
 * return the weighted composite score using proportional redistribution.
 */
function compositeScore(values: Record<string, number | undefined>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const def of SIGNAL_DEFS) {
    const val = values[def.key];
    if (val !== undefined) {
      totalWeight += def.baseWeight;
    }
  }

  if (totalWeight === 0) return 50;

  for (const def of SIGNAL_DEFS) {
    const val = values[def.key];
    if (val !== undefined) {
      const effective = def.baseWeight / totalWeight;
      weightedSum += effective * val;
    }
  }

  return Math.round(weightedSum);
}

// ---------------------------------------------------------------------------
// v2 algorithm: 7 orthogonal signals
// ---------------------------------------------------------------------------

/**
 * Pulse v2 — compute category sentiment from 7 orthogonal signals.
 *
 * Direction (40%):
 *   S_momentum     (25%) — OI-weighted 7d price change
 *   S_acceleration (15%) — 24h rate vs 7d rate: is the move intensifying?
 *
 * Flow (35%):
 *   S_flow   (20%) — volume-weighted 24h price change
 *   S_breadth(15%) — volume-magnitude-weighted bullish breadth
 *
 * Context (10%):
 *   S_level (10%) — volume-weighted avg probability
 *
 * Microstructure (15%, optional):
 *   S_orderflow  (10%) — bid/ask depth imbalance
 *   S_smartMoney  (5%) — directional whale YES/NO bias
 */
function computeCategoryPulse(
  categorySlug: string,
  markets: ProcessedMarket[],
): Omit<PulseIndex, "history" | "delta24h"> | null {
  if (markets.length < MIN_MARKETS) return null;

  const polyMarkets = markets.filter((m) => m.source === "polymarket");
  const kalshiMarkets = markets.filter((m) => m.source === "kalshi");
  const manifoldMarkets = markets.filter((m) => m.source === "manifold");

  // Markets with valid weekly data (excludes Manifold whose oneWeekChange is always 0)
  const weeklyMarkets = markets.filter((m) => m.source !== "manifold");

  // --- S_momentum: OI-weighted 7d price change ---
  let S_momentum = 50;
  if (weeklyMarkets.length > 0) {
    let sumW = 0;
    let sumWV = 0;
    for (const m of weeklyMarkets) {
      const oi = getOI(m);
      sumW += oi;
      sumWV += oi * m.oneWeekChange;
    }
    S_momentum = mapRange(sumW > 0 ? sumWV / sumW : 0, -20, 20);
  }

  // --- S_flow: volume-weighted 24h price change ---
  let sumVol = 0;
  let sumVolDelta = 0;
  for (const m of markets) {
    const vol = m.volume24h > 0 ? m.volume24h : 0;
    sumVol += vol;
    sumVolDelta += vol * m.oneDayChange;
  }
  const S_flow = sumVol > 0
    ? mapRange(sumVolDelta / sumVol, -10, 10)
    : mapRange(
        markets.reduce((s, m) => s + m.oneDayChange, 0) / markets.length,
        -10,
        10,
      );

  // --- S_breadth: volume-magnitude-weighted bullish breadth ---
  let bullishWeight = 0;
  let totalWeight = 0;
  for (const m of markets) {
    const vol = m.volume24h > 0 ? m.volume24h : 1;
    const mag = Math.abs(m.oneDayChange);
    const w = vol * mag;
    if (m.oneDayChange > 0) bullishWeight += w;
    if (m.oneDayChange !== 0) totalWeight += w;
  }
  const S_breadth = totalWeight > 0 ? (bullishWeight / totalWeight) * 100 : 50;

  // --- S_acceleration: 24h rate vs 7d daily rate — is the move intensifying? ---
  let S_acceleration = 50;
  if (weeklyMarkets.length > 0) {
    let sumW = 0;
    let sumWA = 0;
    for (const m of weeklyMarkets) {
      const oi = getOI(m);
      const dailyRate = m.oneDayChange;
      const weeklyDailyRate = m.oneWeekChange / 7;
      sumW += oi;
      sumWA += oi * (dailyRate - weeklyDailyRate);
    }
    S_acceleration = mapRange(sumW > 0 ? sumWA / sumW : 0, -5, 5);
  }

  // --- S_level: volume-weighted average probability (context anchor) ---
  let sumLvol = 0;
  let sumLvolProb = 0;
  for (const m of markets) {
    const vol = m.volume24h > 0 ? m.volume24h : 0;
    sumLvol += vol;
    sumLvolProb += vol * (m.currentPrice / 100);
  }
  const S_level = sumLvol > 0
    ? clamp((sumLvolProb / sumLvol) * 100, 0, 100)
    : clamp(
        (markets.reduce((s, m) => s + m.currentPrice, 0) / markets.length),
        0,
        100,
      );

  // --- S_orderflow: OI-weighted average depthScore (optional) ---
  const marketsWithOB = markets.filter((m) => m.orderbookDepth !== undefined);
  let S_orderflow: number | undefined;
  if (marketsWithOB.length > 0) {
    let sumW = 0;
    let sumWD = 0;
    for (const m of marketsWithOB) {
      const oi = getOI(m);
      sumW += oi;
      sumWD += oi * m.orderbookDepth!.depthScore;
    }
    S_orderflow = sumW > 0 ? clamp(sumWD / sumW, 0, 100) : undefined;
  }

  // --- S_smartMoney: directional whale bias from topHolders (optional) ---
  const marketsWithHolders = markets.filter(
    (m) => m.topHolders && m.topHolders.length > 0,
  );
  let S_smartMoney: number | undefined;
  if (marketsWithHolders.length > 0) {
    let sumW = 0;
    let sumWB = 0;
    for (const m of marketsWithHolders) {
      const holders = m.topHolders!;
      let yesShares = 0;
      let noShares = 0;
      for (const h of holders) {
        if (h.side === "YES") yesShares += h.shares;
        else noShares += h.shares;
      }
      const totalShares = yesShares + noShares;
      if (totalShares === 0) continue;
      const bias = (yesShares / totalShares) * 100;
      const oi = getOI(m);
      sumW += oi;
      sumWB += oi * bias;
    }
    S_smartMoney = sumW > 0 ? clamp(sumWB / sumW, 0, 100) : undefined;
  }

  // --- Composite score (unified proportional weights) ---
  const signalValues: Record<string, number | undefined> = {
    momentum: S_momentum,
    flow: S_flow,
    breadth: S_breadth,
    acceleration: S_acceleration,
    level: S_level,
    orderflow: S_orderflow,
    smartMoney: S_smartMoney,
  };

  const score = compositeScore(signalValues);

  // Top 5 markets by OI
  const topMarkets = [...markets]
    .sort((a, b) => getOI(b) - getOI(a))
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      question: m.question,
      currentPrice: m.currentPrice,
      source: m.source,
    }));

  return {
    category: categorySlug,
    label: PULSE_CATEGORIES[categorySlug] ?? categorySlug,
    score,
    band: getPulseLabel(score),
    signals: {
      momentum: Math.round(S_momentum),
      flow: Math.round(S_flow),
      breadth: Math.round(S_breadth),
      acceleration: Math.round(S_acceleration),
      level: Math.round(S_level),
      ...(S_orderflow !== undefined && { orderflow: Math.round(S_orderflow) }),
      ...(S_smartMoney !== undefined && { smartMoney: Math.round(S_smartMoney) }),
    },
    marketCount: {
      polymarket: polyMarkets.length,
      kalshi: kalshiMarkets.length,
      manifold: manifoldMarkets.length,
      total: markets.length,
    },
    topMarkets,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// v1 algorithm (preserved for PULSE_V1_ALGORITHM=1 rollback)
// ---------------------------------------------------------------------------

function computeCategoryPulseV1(
  categorySlug: string,
  markets: ProcessedMarket[],
): Omit<PulseIndex, "history" | "delta24h"> | null {
  if (markets.length === 0) return null;

  const now = Date.now();
  const polyMarkets = markets.filter((m) => m.source === "polymarket");
  const kalshiMarkets = markets.filter((m) => m.source === "kalshi");
  const manifoldMarkets = markets.filter((m) => m.source === "manifold");

  let sumOI = 0;
  let sumOIProb = 0;
  for (const m of markets) {
    const oi = m.liquidity > 0 ? m.liquidity : 1;
    sumOI += oi;
    sumOIProb += oi * (m.currentPrice / 100);
  }
  const S_prob = sumOI > 0 ? clamp((sumOIProb / sumOI) * 100, 0, 100) : 50;

  let sumMomOI = 0;
  let sumMomWeighted = 0;
  for (const m of markets) {
    const oi = m.liquidity > 0 ? m.liquidity : 1;
    sumMomOI += oi;
    sumMomWeighted += oi * m.oneWeekChange;
  }
  const S_momentum = mapRange(sumMomOI > 0 ? sumMomWeighted / sumMomOI : 0, -20, 20);

  const bullishCount = markets.filter((m) => m.oneDayChange > 0).length;
  const S_breadth = (bullishCount / markets.length) * 100;

  let sumVol = 0;
  let sumVolProb = 0;
  for (const m of markets) {
    const vol = m.volume24h > 0 ? m.volume24h : 0;
    sumVol += vol;
    sumVolProb += vol * (m.currentPrice / 100);
  }
  const S_volWeighted = sumVol > 0 ? clamp((sumVolProb / sumVol) * 100, 0, 100) : S_prob;

  let sumDecay = 0;
  let sumDecayProb = 0;
  for (const m of markets) {
    const daysToExpiry = m.endDate
      ? Math.max(1, (new Date(m.endDate).getTime() - now) / (1000 * 60 * 60 * 24))
      : 365;
    const w = 1 / daysToExpiry;
    sumDecay += w;
    sumDecayProb += w * (m.currentPrice / 100);
  }
  const S_decay = sumDecay > 0 ? clamp((sumDecayProb / sumDecay) * 100, 0, 100) : S_prob;

  let S_consensus = 100;
  const sourceAvgs: number[] = [];
  const polyAvg = polyMarkets.length > 0
    ? polyMarkets.reduce((acc, m) => acc + m.currentPrice, 0) / polyMarkets.length
    : null;
  const kalshiAvg = kalshiMarkets.length > 0
    ? kalshiMarkets.reduce((acc, m) => acc + m.currentPrice, 0) / kalshiMarkets.length
    : null;
  const manifoldAvg = manifoldMarkets.length > 0
    ? manifoldMarkets.reduce((acc, m) => acc + m.currentPrice, 0) / manifoldMarkets.length
    : null;
  if (polyAvg !== null) sourceAvgs.push(polyAvg);
  if (kalshiAvg !== null) sourceAvgs.push(kalshiAvg);
  if (manifoldAvg !== null) sourceAvgs.push(manifoldAvg);
  if (sourceAvgs.length >= 2) {
    let totalGap = 0;
    let pairs = 0;
    for (let i = 0; i < sourceAvgs.length; i++) {
      for (let j = i + 1; j < sourceAvgs.length; j++) {
        totalGap += Math.abs(sourceAvgs[i] - sourceAvgs[j]);
        pairs++;
      }
    }
    S_consensus = clamp(100 - (pairs > 0 ? totalGap / pairs : 0) * 5, 0, 100);
  }

  const marketsWithOB = markets.filter((m) => m.orderbookDepth !== undefined);
  let S_orderflow: number | undefined;
  if (marketsWithOB.length > 0) {
    let sumOIob = 0;
    let sumOIFlow = 0;
    for (const m of marketsWithOB) {
      const oi = m.liquidity > 0 ? m.liquidity : 1;
      sumOIob += oi;
      sumOIFlow += oi * m.orderbookDepth!.depthScore;
    }
    S_orderflow = sumOIob > 0 ? clamp(sumOIFlow / sumOIob, 0, 100) : undefined;
  }

  const polyWithOI = polyMarkets.filter((m) => m.openInterest !== undefined && m.openInterest > 0);
  let S_openInterest: number | undefined;
  if (polyWithOI.length > 0) {
    const higherCount = polyWithOI.filter((m) => m.openInterest! > m.liquidity).length;
    S_openInterest = Math.round((higherCount / polyWithOI.length) * 100);
  }

  let S_manifoldDivergence: number | undefined;
  if (manifoldAvg !== null && (polyAvg !== null || kalshiAvg !== null)) {
    const regulatedAvg = [polyAvg, kalshiAvg].filter((v): v is number => v !== null);
    const regMean = regulatedAvg.reduce((s, v) => s + v, 0) / regulatedAvg.length;
    S_manifoldDivergence = clamp(100 - Math.abs(manifoldAvg - regMean) * 3, 0, 100);
  }

  let score: number;
  if (S_orderflow !== undefined && S_openInterest !== undefined && S_manifoldDivergence !== undefined) {
    score = Math.round(
      0.25 * S_prob + 0.15 * S_momentum + 0.10 * S_breadth +
      0.15 * S_volWeighted + 0.08 * S_decay + 0.07 * S_consensus +
      0.10 * S_orderflow + 0.05 * S_openInterest + 0.05 * S_manifoldDivergence,
    );
  } else if (S_manifoldDivergence !== undefined) {
    score = Math.round(
      0.28 * S_prob + 0.18 * S_momentum + 0.12 * S_breadth +
      0.18 * S_volWeighted + 0.10 * S_decay + 0.09 * S_consensus +
      0.05 * S_manifoldDivergence,
    );
  } else {
    score = Math.round(
      0.30 * S_prob + 0.20 * S_momentum + 0.15 * S_breadth +
      0.20 * S_volWeighted + 0.10 * S_decay + 0.05 * S_consensus,
    );
  }

  const topMarkets = [...markets]
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 5)
    .map((m) => ({ id: m.id, question: m.question, currentPrice: m.currentPrice, source: m.source }));

  // v1 signals mapped to v2 interface shape for API compatibility
  return {
    category: categorySlug,
    label: PULSE_CATEGORIES[categorySlug] ?? categorySlug,
    score,
    band: getPulseLabel(score),
    signals: {
      momentum: Math.round(S_momentum),
      flow: Math.round(S_volWeighted),
      breadth: Math.round(S_breadth),
      acceleration: 50,
      level: Math.round(S_prob),
      ...(S_orderflow !== undefined && { orderflow: Math.round(S_orderflow) }),
    },
    marketCount: {
      polymarket: polyMarkets.length,
      kalshi: kalshiMarkets.length,
      manifold: manifoldMarkets.length,
      total: markets.length,
    },
    topMarkets,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Algorithm selection via feature flag
// ---------------------------------------------------------------------------

const USE_V1 = process.env.PULSE_V1_ALGORITHM === "1";

const chosenAlgorithm = USE_V1 ? computeCategoryPulseV1 : computeCategoryPulse;

// ---------------------------------------------------------------------------
// Snapshot history
// ---------------------------------------------------------------------------

/**
 * Flush snapshots for all categories at the same instant to keep histories aligned.
 * Capped at MAX_SNAPSHOTS entries per category; oldest dropped first (ring buffer).
 */
function maybeFlushAllSnapshots(indices: Array<{ category: string; score: number }>): void {
  const now = Date.now();
  if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
  lastSnapshotAt = now;

  const timestamp = new Date(now).toISOString();
  for (const { category, score } of indices) {
    const entry: PulseSnapshot = { timestamp, score };
    const history = snapshotHistory.get(category) ?? [];
    history.push(entry);
    if (history.length > MAX_SNAPSHOTS) history.shift();
    snapshotHistory.set(category, history);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute Pulse indices for all tracked categories from the given market corpus.
 * Also records hourly snapshots (in-memory, persists within serverless instance lifetime).
 */
export function computePulse(markets: ProcessedMarket[]): PulseIndex[] {
  const byCategory = new Map<string, ProcessedMarket[]>();
  for (const slug of Object.keys(PULSE_CATEGORIES)) {
    byCategory.set(slug, []);
  }

  for (const market of markets) {
    for (const slug of market.categoryslugs) {
      if (byCategory.has(slug)) {
        byCategory.get(slug)!.push(market);
      }
    }
  }

  const partial: Array<{ category: string; score: number }> = [];
  const results: Array<Omit<PulseIndex, "history" | "delta24h"> & { category: string }> = [];

  for (const [slug, catMarkets] of Array.from(byCategory.entries())) {
    const computed = chosenAlgorithm(slug, catMarkets);
    if (computed) {
      results.push(computed);
      partial.push({ category: slug, score: computed.score });
    }
  }

  maybeFlushAllSnapshots(partial);

  return results.map((r) => {
    const history = snapshotHistory.get(r.category) ?? [];
    const oldest = history.length >= 24 ? history[history.length - 24] : history[0];
    const delta24h = oldest ? Math.round((r.score - oldest.score) * 10) / 10 : 0;
    return { ...r, history: [...history], delta24h };
  });
}
