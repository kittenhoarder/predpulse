import type {
  IndexCoverage,
  IndexDiagnostics,
  IndexFamily,
  IndexHorizon,
  IndexSourceScope,
  OperatorIndex,
  ProcessedMarket,
  PulseSnapshot,
} from "./types";
import { inferPolarity, normalizeDirection } from "./polarity";
import {
  appendSnapshotBatch,
  getIndexSnapshots,
  getSignalHistory,
  type StoredIndexSnapshot,
  type StoredMarketSnapshot,
} from "./index-store";

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

const CORE_SOURCES = new Set<ProcessedMarket["source"]>(["polymarket", "kalshi"]);

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mapRange(v: number, min: number, max: number): number {
  if (min === max) return 50;
  return clamp(((v - min) / (max - min)) * 100, 0, 100);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const w = pos - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function robustQuantileScore(raw: number, history: number[], fallbackMin: number, fallbackMax: number): number {
  if (history.length < 20) {
    return mapRange(raw, fallbackMin, fallbackMax);
  }

  const sorted = history.slice().sort((a, b) => a - b);
  const q10 = quantile(sorted, 0.1);
  const q50 = quantile(sorted, 0.5);
  const q90 = quantile(sorted, 0.9);

  if (raw <= q50) {
    const den = q50 - q10;
    if (den === 0) return 50;
    return clamp(((raw - q10) / den) * 50, 0, 50);
  }

  const den = q90 - q50;
  if (den === 0) return 50;
  return clamp(50 + ((raw - q50) / den) * 50, 50, 100);
}

function getOI(m: ProcessedMarket): number {
  if (m.openInterest !== undefined && m.openInterest > 0) return m.openInterest;
  if (m.liquidity > 0) return m.liquidity;
  return 1;
}

function spreadToPP(m: ProcessedMarket): number {
  // Polymarket spread is fractional 0-1; Kalshi spread is already in pp.
  if (m.spread <= 1) return m.spread * 100;
  return m.spread;
}

function toUpProbability(m: ProcessedMarket, polarity: 1 | -1): number {
  return polarity === 1 ? m.currentPrice : 100 - m.currentPrice;
}

function sourceCounts(markets: ProcessedMarket[]): OperatorIndex["marketCount"] {
  const polymarket = markets.filter((m) => m.source === "polymarket").length;
  const kalshi = markets.filter((m) => m.source === "kalshi").length;
  const manifold = markets.filter((m) => m.source === "manifold").length;
  return { polymarket, kalshi, manifold, total: markets.length };
}

function topMarkets(markets: ProcessedMarket[]): OperatorIndex["topMarkets"] {
  return [...markets]
    .sort((a, b) => getOI(b) - getOI(a))
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      question: m.question,
      currentPrice: m.currentPrice,
      source: m.source,
    }));
}

function getPulseBand(score: number): "Extreme Bearish" | "Bearish" | "Neutral" | "Bullish" | "Extreme Bullish" {
  if (score <= 20) return "Extreme Bearish";
  if (score <= 40) return "Bearish";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Bullish";
  return "Extreme Bullish";
}

function computeFreshness(markets: ProcessedMarket[]): number {
  if (markets.length === 0) return 0;

  const volumeShare = markets.filter((m) => m.volume24h > 0).length / markets.length;
  const now = Date.now();
  const ageDays = markets.map((m) => {
    const ms = Date.parse(m.createdAt);
    if (!Number.isFinite(ms)) return 365;
    return (now - ms) / (24 * 60 * 60 * 1000);
  });
  const meanAgeDays = avg(ageDays);
  const recency = 1 - clamp(meanAgeDays / 365, 0, 1);

  return clamp(0.55 * volumeShare + 0.45 * recency, 0, 1);
}

function weightedSourceDirection(markets: ProcessedMarket[]): { poly?: number; kalshi?: number; manifold?: number } {
  const bySource: Partial<Record<ProcessedMarket["source"], { num: number; den: number }>> = {};

  for (const m of markets) {
    const polarity = m.polarity ?? inferPolarity(m.question);
    const upProb = toUpProbability(m, polarity);
    const w = Math.max(1, m.volume24h);
    const cur = bySource[m.source] ?? { num: 0, den: 0 };
    cur.num += w * upProb;
    cur.den += w;
    bySource[m.source] = cur;
  }

  const out: { poly?: number; kalshi?: number; manifold?: number } = {};
  if (bySource.polymarket && bySource.polymarket.den > 0) out.poly = bySource.polymarket.num / bySource.polymarket.den;
  if (bySource.kalshi && bySource.kalshi.den > 0) out.kalshi = bySource.kalshi.num / bySource.kalshi.den;
  if (bySource.manifold && bySource.manifold.den > 0) out.manifold = bySource.manifold.num / bySource.manifold.den;
  return out;
}

function computeSourceAgreement(markets: ProcessedMarket[]): number {
  const dirs = weightedSourceDirection(markets);
  const vals = [dirs.poly, dirs.kalshi, dirs.manifold].filter((v): v is number => v !== undefined);

  if (vals.length === 0) return 0.4;
  if (vals.length === 1) return 0.7;

  const mean = avg(vals);
  const variance = avg(vals.map((v) => (v - mean) * (v - mean)));
  const std = Math.sqrt(variance);
  return clamp(1 - std / 25, 0, 1);
}

function splitByScope(markets: ProcessedMarket[], sourceScope: IndexSourceScope): {
  inScope: ProcessedMarket[];
  scoreSet: ProcessedMarket[];
  notes: string[];
} {
  if (sourceScope === "all") return { inScope: markets, scoreSet: markets, notes: [] };
  if (sourceScope === "polymarket" || sourceScope === "kalshi" || sourceScope === "manifold") {
    const scoped = markets.filter((m) => m.source === sourceScope);
    return { inScope: scoped, scoreSet: scoped, notes: [] };
  }

  const core = markets.filter((m) => CORE_SOURCES.has(m.source));
  if (core.length >= MIN_MARKETS) {
    return {
      inScope: markets,
      scoreSet: core,
      notes: ["Core scope prioritizes Polymarket and Kalshi; Manifold kept auxiliary."],
    };
  }

  return {
    inScope: markets,
    scoreSet: markets,
    notes: ["Core markets below minimum; temporarily falling back to all available venues."],
  };
}

function hourlyHistory(rows: StoredIndexSnapshot[], nowIso: string, score: number): PulseSnapshot[] {
  const withCurrent = rows.slice();
  withCurrent.push({
    timestamp: nowIso,
    family: "directional",
    category: "",
    sourceScope: "core",
    horizon: "24h",
    score,
    confidence: 0,
    coverage: 0,
    rawSignals: {},
    diagnostics: { freshness: 0, sourceAgreement: 0, featureCoverage: 0 },
  });

  const byHour = new Map<string, PulseSnapshot>();
  for (const row of withCurrent) {
    const key = row.timestamp.slice(0, 13);
    byHour.set(key, { timestamp: row.timestamp, score: row.score });
  }

  return Array.from(byHour.values())
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-48);
}

function delta24h(rows: StoredIndexSnapshot[], nowIso: string, currentScore: number): number {
  const points = rows
    .map((r) => ({ t: Date.parse(r.timestamp), score: r.score }))
    .filter((r) => Number.isFinite(r.t));

  points.push({ t: Date.parse(nowIso), score: currentScore });
  if (points.length < 2) return 0;

  const target = Date.now() - 24 * 60 * 60 * 1000;
  let closest = points[0];
  let minDist = Math.abs(points[0].t - target);
  for (const p of points) {
    const d = Math.abs(p.t - target);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }

  return Math.round((currentScore - closest.score) * 10) / 10;
}

function weightedMean(markets: ProcessedMarket[], value: (m: ProcessedMarket) => number, weight: (m: ProcessedMarket) => number): number {
  let num = 0;
  let den = 0;
  for (const m of markets) {
    const w = weight(m);
    if (w <= 0) continue;
    num += w * value(m);
    den += w;
  }
  return den > 0 ? num / den : 0;
}

interface ComputedIndexInternal extends OperatorIndex {
  rawSignals: Record<string, number>;
  scoreMarkets: ProcessedMarket[];
  diagnosticsInputs: {
    freshness: number;
    sourceAgreement: number;
    featureCoverage: number;
  };
}

function normalizeSignalByHistory(
  family: IndexFamily,
  category: string,
  sourceScope: IndexSourceScope,
  horizon: IndexHorizon,
  signal: string,
  raw: number,
  fallbackMin: number,
  fallbackMax: number,
): number {
  const history = getSignalHistory({ family, category, sourceScope, horizon, signal, lookbackDays: 30 });
  return Math.round(robustQuantileScore(raw, history, fallbackMin, fallbackMax));
}

function directionalIndex(
  category: string,
  categoryMarkets: ProcessedMarket[],
  sourceScope: IndexSourceScope,
  horizon: IndexHorizon,
  nowIso: string,
): ComputedIndexInternal | null {
  const { inScope, scoreSet, notes } = splitByScope(categoryMarkets, sourceScope);
  if (scoreSet.length < MIN_MARKETS) return null;

  const scored = scoreSet.map((m) => ({ ...m, polarity: m.polarity ?? inferPolarity(m.question) }));
  const totalOI = scored.reduce((s, m) => s + getOI(m), 0);

  const momentumRaw = weightedMean(
    scored,
    (m) => normalizeDirection(m.oneWeekChange, m.polarity as 1 | -1),
    (m) => getOI(m),
  );

  const flowRaw = weightedMean(
    scored,
    (m) => normalizeDirection(m.oneDayChange, m.polarity as 1 | -1),
    (m) => (m.volume24h > 0 ? m.volume24h : 1),
  );

  let breadthNum = 0;
  let breadthDen = 0;
  for (const m of scored) {
    const d = normalizeDirection(m.oneDayChange, m.polarity as 1 | -1);
    const w = Math.max(1, m.volume24h) * Math.max(0.1, Math.abs(d));
    breadthNum += (d >= 0 ? 1 : -1) * w;
    breadthDen += w;
  }
  const breadthRaw = breadthDen > 0 ? breadthNum / breadthDen : 0;

  const accelerationRaw = weightedMean(
    scored,
    (m) => {
      const d1 = normalizeDirection(m.oneDayChange, m.polarity as 1 | -1);
      const d7 = normalizeDirection(m.oneWeekChange / 7, m.polarity as 1 | -1);
      return d1 - d7;
    },
    (m) => getOI(m),
  );

  const marketsWithOB = scored.filter((m) => m.orderbookDepth !== undefined);
  const obOI = marketsWithOB.reduce((s, m) => s + getOI(m), 0);
  const obCoverage = totalOI > 0 ? obOI / totalOI : 0;
  const includeOrderflow = marketsWithOB.length >= 5 && obCoverage >= 0.3;
  const orderflowRaw = marketsWithOB.length > 0
    ? weightedMean(marketsWithOB, (m) => ((m.orderbookDepth!.depthScore - 50) / 50) * (m.polarity as 1 | -1), (m) => getOI(m))
    : 0;

  const marketsWithSmart = scored.filter((m) => m.topHolders && m.topHolders.length > 0);
  const smartOI = marketsWithSmart.reduce((s, m) => s + getOI(m), 0);
  const smartCoverage = totalOI > 0 ? smartOI / totalOI : 0;
  const includeSmart = marketsWithSmart.length >= 5 && smartCoverage >= 0.3;

  let smartMoneyRaw = 0;
  if (marketsWithSmart.length > 0) {
    smartMoneyRaw = weightedMean(
      marketsWithSmart,
      (m) => {
        const holders = m.topHolders ?? [];
        let yes = 0;
        let no = 0;
        for (const h of holders) {
          if (h.side === "YES") yes += h.shares;
          else no += h.shares;
        }
        const total = yes + no;
        if (total === 0) return 0;
        const yesBias = (yes / total - 0.5) * 2;
        return yesBias * (m.polarity as 1 | -1);
      },
      (m) => getOI(m),
    );
  }

  const momentum = normalizeSignalByHistory("directional", category, sourceScope, horizon, "momentum", momentumRaw, -20, 20);
  const flow = normalizeSignalByHistory("directional", category, sourceScope, horizon, "flow", flowRaw, -12, 12);
  const breadth = normalizeSignalByHistory("directional", category, sourceScope, horizon, "breadth", breadthRaw, -1, 1);
  const acceleration = normalizeSignalByHistory("directional", category, sourceScope, horizon, "acceleration", accelerationRaw, -5, 5);
  const orderflow = normalizeSignalByHistory("directional", category, sourceScope, horizon, "orderflow", orderflowRaw, -1, 1);
  const smartMoney = normalizeSignalByHistory("directional", category, sourceScope, horizon, "smartMoney", smartMoneyRaw, -1, 1);

  const baseWeights: Record<string, number> = {
    momentum: 0.30,
    flow: 0.25,
    breadth: 0.15,
    acceleration: 0.15,
    orderflow: 0.10,
    smartMoney: 0.05,
  };

  const enabled: Record<string, number> = {
    momentum,
    flow,
    breadth,
    acceleration,
    ...(includeOrderflow ? { orderflow } : {}),
    ...(includeSmart ? { smartMoney } : {}),
  };

  const enabledWeight = Object.keys(enabled).reduce((s, k) => s + baseWeights[k], 0);
  const directionalScore = Math.round(
    Object.entries(enabled).reduce((sum, [k, v]) => sum + (baseWeights[k] / enabledWeight) * v, 0),
  );

  // Certainty-compatible "level" proxy for legacy Pulse transparency.
  const convictionRaw = weightedMean(scored, (m) => {
    const pUp = toUpProbability(m, m.polarity as 1 | -1);
    return Math.abs(pUp - 50) / 50;
  }, (m) => getOI(m));
  const level = Math.round(mapRange(convictionRaw, 0, 1));

  const featureCoverage = enabledWeight;
  const freshness = computeFreshness(scored);
  const sourceAgreement = computeSourceAgreement(scored);
  const confidence = Math.round(100 * clamp(freshness * sourceAgreement * featureCoverage, 0, 1));

  const coverage: IndexCoverage = {
    marketCoverage: Math.round((scoreSet.length / Math.max(1, inScope.length)) * 100),
    oiCoverage: {
      orderflow: Math.round(obCoverage * 100),
      smartMoney: Math.round(smartCoverage * 100),
    },
    featureCoverage: Math.round(featureCoverage * 100),
  };

  const diagnostics: IndexDiagnostics = {
    freshness: Math.round(freshness * 100),
    sourceAgreement: Math.round(sourceAgreement * 100),
    featureCoverage: Math.round(featureCoverage * 100),
    includedSignals: Object.keys(enabled),
    excludedSignals: [
      ...(includeOrderflow ? [] : ["orderflow"]),
      ...(includeSmart ? [] : ["smartMoney"]),
    ],
    rawSignals: {
      momentum: momentumRaw,
      flow: flowRaw,
      breadth: breadthRaw,
      acceleration: accelerationRaw,
      orderflow: orderflowRaw,
      smartMoney: smartMoneyRaw,
      conviction: convictionRaw,
    },
    notes,
  };

  const rows = getIndexSnapshots({
    family: "directional",
    category,
    sourceScope,
    horizon,
    sinceMs: Date.now() - 48 * 60 * 60 * 1000,
  });

  return {
    category,
    label: PULSE_CATEGORIES[category] ?? category,
    family: "directional",
    horizon,
    sourceScope,
    score: clamp(directionalScore, 0, 100),
    confidence,
    delta24h: delta24h(rows, nowIso, directionalScore),
    coverage,
    diagnostics,
    signals: {
      momentum,
      flow,
      breadth,
      acceleration,
      level,
      ...(includeOrderflow ? { orderflow } : {}),
      ...(includeSmart ? { smartMoney } : {}),
    },
    marketCount: sourceCounts(inScope),
    topMarkets: topMarkets(scored),
    history: hourlyHistory(rows, nowIso, directionalScore),
    computedAt: nowIso,
    rawSignals: {
      momentum: momentumRaw,
      flow: flowRaw,
      breadth: breadthRaw,
      acceleration: accelerationRaw,
      orderflow: orderflowRaw,
      smartMoney: smartMoneyRaw,
      conviction: convictionRaw,
    },
    scoreMarkets: scored,
    diagnosticsInputs: {
      freshness,
      sourceAgreement,
      featureCoverage,
    },
  };
}

function certaintyIndex(
  category: string,
  categoryMarkets: ProcessedMarket[],
  sourceScope: IndexSourceScope,
  horizon: IndexHorizon,
  nowIso: string,
): ComputedIndexInternal | null {
  const { inScope, scoreSet, notes } = splitByScope(categoryMarkets, sourceScope);
  if (scoreSet.length < MIN_MARKETS) return null;

  const scored = scoreSet.map((m) => ({ ...m, polarity: m.polarity ?? inferPolarity(m.question) }));

  const convictionRaw = weightedMean(scored, (m) => Math.abs(toUpProbability(m, m.polarity as 1 | -1) - 50) / 50, (m) => getOI(m));
  const spreadTightnessRaw = 1 - clamp(weightedMean(scored, (m) => spreadToPP(m), (m) => getOI(m)) / 20, 0, 1);
  const participationRaw = weightedMean(scored, (m) => Math.log10(m.volume24h + 1), () => 1);

  const conviction = normalizeSignalByHistory("certainty", category, sourceScope, horizon, "conviction", convictionRaw, 0, 1);
  const spreadTightness = normalizeSignalByHistory("certainty", category, sourceScope, horizon, "spreadTightness", spreadTightnessRaw, 0, 1);
  const participation = normalizeSignalByHistory("certainty", category, sourceScope, horizon, "participation", participationRaw, 0, 6);

  const score = Math.round(0.5 * conviction + 0.3 * spreadTightness + 0.2 * participation);

  const freshness = computeFreshness(scored);
  const sourceAgreement = computeSourceAgreement(scored);
  const featureCoverage = 1;
  const confidence = Math.round(100 * clamp(freshness * sourceAgreement * featureCoverage, 0, 1));

  const diagnostics: IndexDiagnostics = {
    freshness: Math.round(freshness * 100),
    sourceAgreement: Math.round(sourceAgreement * 100),
    featureCoverage: 100,
    includedSignals: ["conviction", "spreadTightness", "participation"],
    excludedSignals: [],
    rawSignals: { conviction: convictionRaw, spreadTightness: spreadTightnessRaw, participation: participationRaw },
    notes,
  };

  const rows = getIndexSnapshots({ family: "certainty", category, sourceScope, horizon, sinceMs: Date.now() - 48 * 60 * 60 * 1000 });

  return {
    category,
    label: PULSE_CATEGORIES[category] ?? category,
    family: "certainty",
    horizon,
    sourceScope,
    score,
    confidence,
    delta24h: delta24h(rows, nowIso, score),
    coverage: {
      marketCoverage: Math.round((scoreSet.length / Math.max(1, inScope.length)) * 100),
      oiCoverage: { orderflow: 0, smartMoney: 0 },
      featureCoverage: 100,
    },
    diagnostics,
    signals: { certainty: score, conviction, spreadTightness, participation },
    marketCount: sourceCounts(inScope),
    topMarkets: topMarkets(scored),
    history: hourlyHistory(rows, nowIso, score),
    computedAt: nowIso,
    rawSignals: { conviction: convictionRaw, spreadTightness: spreadTightnessRaw, participation: participationRaw },
    scoreMarkets: scored,
    diagnosticsInputs: { freshness, sourceAgreement, featureCoverage },
  };
}

function liquidityIndex(
  category: string,
  categoryMarkets: ProcessedMarket[],
  sourceScope: IndexSourceScope,
  horizon: IndexHorizon,
  nowIso: string,
): ComputedIndexInternal | null {
  const { inScope, scoreSet, notes } = splitByScope(categoryMarkets, sourceScope);
  if (scoreSet.length < MIN_MARKETS) return null;

  const scored = scoreSet.map((m) => ({ ...m, polarity: m.polarity ?? inferPolarity(m.question) }));

  const spreadRaw = weightedMean(scored, (m) => spreadToPP(m), (m) => getOI(m));
  const depthImbalanceRaw = weightedMean(
    scored.filter((m) => m.orderbookDepth !== undefined),
    (m) => Math.abs((m.orderbookDepth!.depthScore - 50) / 50),
    (m) => getOI(m),
  );
  const volatilityRaw = weightedMean(scored, (m) => Math.abs(m.oneDayChange), (m) => Math.max(1, m.volume24h));
  const volumeStressRaw = weightedMean(scored, (m) => 1 / Math.max(1, Math.log10(m.volume24h + 10)), () => 1);

  const spread = normalizeSignalByHistory("liquidity", category, sourceScope, horizon, "spread", spreadRaw, 0, 20);
  const depth = normalizeSignalByHistory("liquidity", category, sourceScope, horizon, "depth", depthImbalanceRaw, 0, 1);
  const volatility = normalizeSignalByHistory("liquidity", category, sourceScope, horizon, "volatility", volatilityRaw, 0, 12);
  const volume = normalizeSignalByHistory("liquidity", category, sourceScope, horizon, "volume", volumeStressRaw, 0, 0.8);

  const score = Math.round(0.35 * spread + 0.2 * depth + 0.3 * volatility + 0.15 * volume);

  const featuresPresent = [spread, volatility, volume].length + (scored.some((m) => m.orderbookDepth !== undefined) ? 1 : 0);
  const featureCoverage = featuresPresent / 4;
  const freshness = computeFreshness(scored);
  const sourceAgreement = computeSourceAgreement(scored);
  const confidence = Math.round(100 * clamp(freshness * sourceAgreement * featureCoverage, 0, 1));

  const diagnostics: IndexDiagnostics = {
    freshness: Math.round(freshness * 100),
    sourceAgreement: Math.round(sourceAgreement * 100),
    featureCoverage: Math.round(featureCoverage * 100),
    includedSignals: ["spread", "volatility", "volume", ...(scored.some((m) => m.orderbookDepth !== undefined) ? ["depth"] : [])],
    excludedSignals: scored.some((m) => m.orderbookDepth !== undefined) ? [] : ["depth"],
    rawSignals: { spread: spreadRaw, depth: depthImbalanceRaw, volatility: volatilityRaw, volume: volumeStressRaw },
    notes,
  };

  const rows = getIndexSnapshots({ family: "liquidity", category, sourceScope, horizon, sinceMs: Date.now() - 48 * 60 * 60 * 1000 });

  return {
    category,
    label: PULSE_CATEGORIES[category] ?? category,
    family: "liquidity",
    horizon,
    sourceScope,
    score,
    confidence,
    delta24h: delta24h(rows, nowIso, score),
    coverage: {
      marketCoverage: Math.round((scoreSet.length / Math.max(1, inScope.length)) * 100),
      oiCoverage: {
        orderflow: Math.round((scored.filter((m) => m.orderbookDepth !== undefined).length / Math.max(1, scored.length)) * 100),
        smartMoney: 0,
      },
      featureCoverage: Math.round(featureCoverage * 100),
    },
    diagnostics,
    signals: { spread, depth, volatility, volume },
    marketCount: sourceCounts(inScope),
    topMarkets: topMarkets(scored),
    history: hourlyHistory(rows, nowIso, score),
    computedAt: nowIso,
    rawSignals: { spread: spreadRaw, depth: depthImbalanceRaw, volatility: volatilityRaw, volume: volumeStressRaw },
    scoreMarkets: scored,
    diagnosticsInputs: { freshness, sourceAgreement, featureCoverage },
  };
}

function divergenceIndex(
  category: string,
  categoryMarkets: ProcessedMarket[],
  sourceScope: IndexSourceScope,
  horizon: IndexHorizon,
  nowIso: string,
): ComputedIndexInternal | null {
  const { inScope, scoreSet, notes } = splitByScope(categoryMarkets, sourceScope);
  if (scoreSet.length < MIN_MARKETS) return null;

  const scored = scoreSet.map((m) => ({ ...m, polarity: m.polarity ?? inferPolarity(m.question) }));

  const bySource = weightedSourceDirection(scored);
  const sourceVals = [bySource.poly, bySource.kalshi, bySource.manifold].filter((v): v is number => v !== undefined);
  const meanSource = sourceVals.length > 0 ? avg(sourceVals) : 50;
  const std = sourceVals.length > 1
    ? Math.sqrt(avg(sourceVals.map((v) => (v - meanSource) * (v - meanSource))))
    : 0;
  const basisRaw = std * 2;

  const sourceFlows: number[] = [];
  for (const source of ["polymarket", "kalshi", "manifold"] as const) {
    const srcMarkets = scored.filter((m) => m.source === source);
    if (srcMarkets.length === 0) continue;
    const flow = weightedMean(
      srcMarkets,
      (m) => normalizeDirection(m.oneDayChange, m.polarity as 1 | -1),
      (m) => Math.max(1, m.volume24h),
    );
    sourceFlows.push(flow);
  }
  const meanFlow = sourceFlows.length > 0 ? avg(sourceFlows) : 0;
  const flowStd = sourceFlows.length > 1
    ? Math.sqrt(avg(sourceFlows.map((v) => (v - meanFlow) * (v - meanFlow))))
    : 0;
  const conflictRaw = flowStd;

  const basis = normalizeSignalByHistory("divergence", category, sourceScope, horizon, "basis", basisRaw, 0, 20);
  const conflict = normalizeSignalByHistory("divergence", category, sourceScope, horizon, "conflict", conflictRaw, 0, 8);
  const divergence = Math.round(0.7 * basis + 0.3 * conflict);

  const freshness = computeFreshness(scored);
  const sourceAgreement = clamp(1 - divergence / 100, 0, 1);
  const featureCoverage = sourceVals.length >= 2 ? 1 : 0.5;
  const confidence = Math.round(100 * clamp(freshness * sourceAgreement * featureCoverage, 0, 1));

  const diagnostics: IndexDiagnostics = {
    freshness: Math.round(freshness * 100),
    sourceAgreement: Math.round(sourceAgreement * 100),
    featureCoverage: Math.round(featureCoverage * 100),
    includedSignals: ["basis", "conflict"],
    excludedSignals: [],
    rawSignals: { basis: basisRaw, conflict: conflictRaw },
    notes: sourceVals.length >= 2 ? notes : [...notes, "Divergence less reliable with fewer than two active sources."],
  };

  const rows = getIndexSnapshots({ family: "divergence", category, sourceScope, horizon, sinceMs: Date.now() - 48 * 60 * 60 * 1000 });

  return {
    category,
    label: PULSE_CATEGORIES[category] ?? category,
    family: "divergence",
    horizon,
    sourceScope,
    score: divergence,
    confidence,
    delta24h: delta24h(rows, nowIso, divergence),
    coverage: {
      marketCoverage: Math.round((scoreSet.length / Math.max(1, inScope.length)) * 100),
      oiCoverage: { orderflow: 0, smartMoney: 0 },
      featureCoverage: Math.round(featureCoverage * 100),
    },
    diagnostics,
    signals: { divergence, basis, conflict },
    marketCount: sourceCounts(inScope),
    topMarkets: topMarkets(scored),
    history: hourlyHistory(rows, nowIso, divergence),
    computedAt: nowIso,
    rawSignals: { basis: basisRaw, conflict: conflictRaw },
    scoreMarkets: scored,
    diagnosticsInputs: { freshness, sourceAgreement, featureCoverage },
  };
}

export interface ComputeIndicesOptions {
  family?: IndexFamily | "all";
  horizon?: IndexHorizon;
  sourceScope?: IndexSourceScope;
  persist?: boolean;
}

export interface ComputeIndicesResult {
  indices: OperatorIndex[];
  computedAt: string;
  persisted: boolean;
}

export function computeIndices(
  markets: ProcessedMarket[],
  opts: ComputeIndicesOptions = {},
): ComputeIndicesResult {
  const family = opts.family ?? "all";
  const horizon = opts.horizon ?? "24h";
  const sourceScope = opts.sourceScope ?? "core";
  const persist = opts.persist ?? true;

  const nowIso = new Date().toISOString();
  const families: IndexFamily[] = family === "all"
    ? ["directional", "liquidity", "divergence", "certainty"]
    : [family];

  const byCategory = new Map<string, ProcessedMarket[]>();
  for (const slug of Object.keys(PULSE_CATEGORIES)) {
    byCategory.set(slug, []);
  }

  for (const m of markets) {
    for (const slug of m.categoryslugs) {
      if (byCategory.has(slug)) {
        byCategory.get(slug)!.push(m);
      }
    }
  }

  const computed: ComputedIndexInternal[] = [];
  for (const [category, catMarkets] of Array.from(byCategory.entries())) {
    for (const fam of families) {
      let idx: ComputedIndexInternal | null = null;
      if (fam === "directional") idx = directionalIndex(category, catMarkets, sourceScope, horizon, nowIso);
      if (fam === "liquidity") idx = liquidityIndex(category, catMarkets, sourceScope, horizon, nowIso);
      if (fam === "divergence") idx = divergenceIndex(category, catMarkets, sourceScope, horizon, nowIso);
      if (fam === "certainty") idx = certaintyIndex(category, catMarkets, sourceScope, horizon, nowIso);
      if (idx) computed.push(idx);
    }
  }

  let persisted = false;
  if (persist && computed.length > 0) {
    const indexSnapshots: StoredIndexSnapshot[] = computed.map((idx) => ({
      timestamp: nowIso,
      family: idx.family,
      category: idx.category,
      sourceScope: idx.sourceScope,
      horizon: idx.horizon,
      score: idx.score,
      confidence: idx.confidence,
      coverage: idx.coverage.featureCoverage,
      rawSignals: idx.rawSignals,
      diagnostics: {
        freshness: idx.diagnostics.freshness,
        sourceAgreement: idx.diagnostics.sourceAgreement,
        featureCoverage: idx.diagnostics.featureCoverage,
      },
    }));

    const marketSnapshots: StoredMarketSnapshot[] = [];
    for (const idx of computed) {
      if (idx.family !== "directional") continue;
      for (const m of idx.scoreMarkets) {
        marketSnapshots.push({
          timestamp: nowIso,
          marketId: m.id,
          source: m.source,
          category: idx.category,
          polarity: (m.polarity ?? inferPolarity(m.question)) as 1 | -1,
          currentPrice: m.currentPrice,
          oneDayChange: m.oneDayChange,
          oneWeekChange: m.oneWeekChange,
          volume24h: m.volume24h,
          liquidity: m.liquidity,
          spreadPP: spreadToPP(m),
          orderflow: m.orderbookDepth?.depthScore,
          smartMoney: m.smartMoneyScore,
        });
      }
    }

    persisted = appendSnapshotBatch({
      indexSnapshots,
      marketSnapshots,
      minIntervalMs: 5 * 60 * 1000,
    });
  }

  const indices: OperatorIndex[] = computed.map((idx) => ({
    category: idx.category,
    label: idx.label,
    family: idx.family,
    horizon: idx.horizon,
    sourceScope: idx.sourceScope,
    score: idx.score,
    confidence: idx.confidence,
    delta24h: idx.delta24h,
    coverage: idx.coverage,
    diagnostics: idx.diagnostics,
    signals: idx.signals,
    marketCount: idx.marketCount,
    topMarkets: idx.topMarkets,
    history: idx.history,
    computedAt: idx.computedAt,
  }));

  indices.sort((a, b) => {
    if (a.family !== b.family) return a.family.localeCompare(b.family);
    return a.category.localeCompare(b.category);
  });

  return { indices, computedAt: nowIso, persisted };
}

export function pulseBand(score: number): "Extreme Bearish" | "Bearish" | "Neutral" | "Bullish" | "Extreme Bullish" {
  return getPulseBand(score);
}
