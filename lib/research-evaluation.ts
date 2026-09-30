import { brierScore, logLoss } from "./index-metrics";
import type { ResearchDigest } from "./research";

/** Single-venue exact-contract forecasts, never category scores. */
export interface ForecastCase {
  familyId: string; probability: number; outcomeYes: 0 | 1;
  savedAt: string; publicResultAt: string; leadHours: 24;
  rulesHash: string; outcomeRulesHash: string; methodology: string;
}
export function evaluateForecastCases(cases: ForecastCase[], holdoutStart: string, methodology: string) {
  const start = Date.parse(holdoutStart);
  const eligible = cases.filter((c) => Number.isFinite(start) && c.methodology === methodology &&
    c.rulesHash === c.outcomeRulesHash && Number.isFinite(c.probability) && c.probability >= 0 && c.probability <= 1 &&
    [0, 1].includes(c.outcomeYes) && c.leadHours === 24 && Date.parse(c.savedAt) >= start &&
    Math.abs(Date.parse(c.publicResultAt) - Date.parse(c.savedAt) - 24 * 3_600_000) <= 45 * 60_000);
  // One predeclared observation per event family prevents strikes inflating sample size.
  const families = new Map<string, ForecastCase>();
  for (const c of [...eligible].sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.familyId.localeCompare(b.familyId)))
    if (!families.has(c.familyId)) families.set(c.familyId, c);
  const rows = Array.from(families.values());
  const predictions = rows.map((r) => r.probability), outcomes = rows.map((r) => r.outcomeYes);
  return { status: "exploratory" as const, sampleSize: rows.length, independentFamilies: rows.length,
    excluded: cases.length - rows.length, holdoutStart, methodology,
    brier: brierScore(predictions, outcomes), logLoss: logLoss(predictions, outcomes),
    baselineBrier: brierScore(predictions.map(() => 0.5), outcomes),
    calibrationSlope: null, uncertaintyInterval: null, accuracyPromotionAllowed: false };
}

export function researchEvaluation(digest: ResearchDigest | null) {
  const contracts = digest?.contracts ?? [];
  const settled = contracts.filter((c) => c.resolutions.length);
  // Gamma settlement evidence does not establish when the result became public.
  // There is no qualified forecast case until a supported result-time adapter exists.
  const holdoutStart = digest ? new Date(Date.parse(digest.startedAt) + 7 * 86_400_000).toISOString() : null;
  return { methodology: "exact-contract-24h-v1", status: "accumulating" as const,
    forecast: evaluateForecastCases([], holdoutStart ?? "", "exact-contract-24h-v1"),
    trackedContracts: contracts.length, settledContracts: settled.length,
    missingPublicResultTime: settled.length, frozenLeadObservations: contracts.filter((c) => c.leadObservation).length,
    comparable24hChanges: contracts.filter((c) => c.change24hPP !== null).length,
    capacityExcluded: digest?.capacityExcluded ?? 0, independentFamilyGate: 100,
    reason: "Forecast scoring requires a verified public result time, a saved 24-hour lead observation and a chronological holdout. Venue settlement time is not public result time.",
    aggregationEvaluation: null, directionalClassifierEvaluation: null };
}
