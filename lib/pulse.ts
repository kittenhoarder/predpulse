import type { ProcessedMarket, PulseIndex } from "./types";
import { computeIndices, PULSE_CATEGORIES, pulseBand } from "./indices";
import { isIndexPersistenceEnabled } from "./index-store";

function isCore3Enabled(): boolean {
  return process.env.INDEX_CORE3_ENABLED === "1" || process.env.INDEX_CORE3_ENABLED === "true";
}

/**
 * Compatibility layer: legacy Pulse maps to the v3 directional family.
 * This keeps existing UI contracts stable while /api/indices exposes full families.
 */
export function computePulse(markets: ProcessedMarket[]): PulseIndex[] {
  const core3Enabled = isCore3Enabled();
  const persist = !core3Enabled && isIndexPersistenceEnabled();

  let result = computeIndices(markets, {
    family: "directional",
    horizon: "24h",
    sourceScope: "core",
    scoreProfile: core3Enabled ? "core3" : "full",
    persist,
  });

  // Graceful degradation: if core venues are unavailable on a cold/partial fetch,
  // fall back to all venues so Pulse cards do not disappear entirely.
  if (result.indices.length === 0) {
    result = computeIndices(markets, {
      family: "directional",
      horizon: "24h",
      sourceScope: "all",
      scoreProfile: core3Enabled ? "core3" : "full",
      persist,
    });
  }

  return result.indices
    .filter((idx) => idx.family === "directional")
    .map((idx) => ({
      category: idx.category,
      label: idx.label,
      score: idx.score,
      band: pulseBand(idx.score),
      delta24h: idx.delta24h,
      signals: {
        momentum: Math.round(idx.signals.momentum ?? 50),
        flow: Math.round(idx.signals.flow ?? 50),
        breadth: Math.round(idx.signals.breadth ?? 50),
        // Compatibility placeholder while directional-core3 omits acceleration from scoring.
        acceleration: core3Enabled ? 50 : Math.round(idx.signals.acceleration ?? 50),
        level: Math.round(idx.signals.level ?? 50),
      },
      marketCount: idx.marketCount,
      topMarkets: idx.topMarkets,
      history: idx.history,
      computedAt: idx.computedAt,
      confidence: idx.confidence,
      coverage: idx.coverage,
      family: idx.family,
      horizon: idx.horizon,
      diagnostics: idx.diagnostics,
    }))
    .sort((a, b) => {
      const ai = Object.keys(PULSE_CATEGORIES).indexOf(a.category);
      const bi = Object.keys(PULSE_CATEGORIES).indexOf(b.category);
      return ai - bi;
    });
}

export { PULSE_CATEGORIES };
