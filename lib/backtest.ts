import { summarizeForecastMetrics, type ForecastMetricSummary } from "./index-metrics";
import { getIndexSnapshots, getResolvedOutcomes } from "./index-store";

export interface BacktestResult {
  metrics: ForecastMetricSummary;
  joinedOutcomes: number;
  totalOutcomes: number;
  coveragePct: number;
}

export function computeDirectionalBacktest(): BacktestResult {
  const outcomes = getResolvedOutcomes(20_000);
  const directional = getIndexSnapshots({
    family: "directional",
    sourceScope: "core",
    horizon: "24h",
    sinceMs: Date.now() - 365 * 24 * 60 * 60 * 1000,
  });

  const byCategory = new Map<string, typeof directional>();
  for (const row of directional) {
    const arr = byCategory.get(row.category) ?? [];
    arr.push(row);
    byCategory.set(row.category, arr);
  }

  const predictions: number[] = [];
  const outcomesUp: number[] = [];

  for (const r of outcomes) {
    const rows = byCategory.get(r.category) ?? [];
    if (rows.length === 0) continue;

    const resolvedTs = Date.parse(r.resolvedAt);
    if (!Number.isFinite(resolvedTs)) continue;

    const eligible = rows
      .filter((s) => Date.parse(s.timestamp) <= resolvedTs)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (eligible.length === 0) continue;

    const snapshot = eligible[0];
    const pUp = snapshot.score / 100;
    const polarity = r.polarity ?? 1;
    const yUp = polarity === 1 ? r.outcomeYes : (1 - r.outcomeYes);

    predictions.push(pUp);
    outcomesUp.push(yUp);
  }

  const metrics = summarizeForecastMetrics(predictions, outcomesUp, predictions, outcomesUp);
  const coverage = outcomes.length > 0 ? (predictions.length / outcomes.length) * 100 : 0;

  return {
    metrics,
    joinedOutcomes: predictions.length,
    totalOutcomes: outcomes.length,
    coveragePct: Math.round(coverage * 10) / 10,
  };
}
