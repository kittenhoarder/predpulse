import type { GammaEvent } from "./types";
import type { DecisionDistribution } from "./decision-distribution";
import type { IndexProductsDigest } from "./index-products";
import { buildIndexProducts as buildOutcomes } from "./outcome-benchmark";
import { buildMarketAttention } from "./attention-evidence";
import { fitIndexDigest } from "./belief-shift";

export function buildIndexProducts(events: GammaEvent[], previous: IndexProductsDigest | null, baseline: IndexProductsDigest | null,
  asOf: string, decision?: DecisionDistribution | null): IndexProductsDigest {
  // Preserve the preceding rounds' history allocation; the map does not enlarge it.
  const digest=fitIndexDigest(buildOutcomes(events,previous,baseline,asOf,decision),14_600);
  digest.marketAttention=buildMarketAttention(events,asOf);
  return fitIndexDigest(digest);
}
