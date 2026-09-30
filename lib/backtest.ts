import { researchEvaluation } from "./research-evaluation";
import type { ResearchDigest } from "./research";

// Compatibility name only. No category score is interpreted as a probability.
export function computeDirectionalBacktest(research: ResearchDigest | null = null) {
  return researchEvaluation(research);
}
