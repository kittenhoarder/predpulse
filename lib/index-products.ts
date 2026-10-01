/** Serializable index contract. This module is safe to import from the client. */
export const BELIEF_METHOD = "belief-shift-v1";
export const INDEX_MAPPING = "yes-first-binary-v1";
export const INDEX_QUOTE_BASIS = "YES bid/ask midpoint";
export const INDEX_MAX_BYTES = 11_000;
export const BELIEF_CATEGORIES = { economics: "Economics", politics: "Politics", crypto: "Crypto", tech: "Tech" } as const;
export type BeliefCategory = keyof typeof BELIEF_CATEGORIES;
export type QuoteIssue = "missing" | "inactive" | "unsupported_outcome" | "invalid_identity" | "invalid_book" | "old_record" | "past_close";
export interface IndexQuote { bid: number; ask: number; midpoint: number; updatedAt: string }
export interface IndexObservation {
  marketId: string; familyId: string; outcomeId: string; question: string; eventSlug: string;
  closesAt: string; rulesHash: string; quote: IndexQuote | null; issue: QuoteIssue | null;
  prior: (IndexQuote & { identity: string }) | null;
  comparisonIssue: "no_baseline" | "missing_prior" | "identity_changed" | "invalid_prior" | null;
}
export interface IndexHistoryPoint { at: string; value: number | null; segment: string }
export interface BeliefShiftProduct {
  id: string; type: "belief-shift"; category: BeliefCategory; name: string; unit: "pp";
  epoch: string; cohortHash: string; members: string[];
  state: "available" | "warming" | "unavailable";
  reason: "insufficient_events" | "insufficient_quotes" | "capturing_baseline" | "insufficient_pairs" | null;
  coverage: { eligible: number; admitted: number; usable: number; comparable: number };
  headline: number | null; breadth: number | null; materialMovePP: 3;
  pairHash: string; history: IndexHistoryPoint[];
}
export interface IndexProductsDigest {
  version: 1; methodology: typeof BELIEF_METHOD; mappingVersion: typeof INDEX_MAPPING;
  quoteBasis: typeof INDEX_QUOTE_BASIS; source: "polymarket";
  asOf: string; baselineAt: string | null; screened: number;
  products: BeliefShiftProduct[]; observations: IndexObservation[];
  exclusions: Record<string, number>;
}
export function indexSourceUrl(observation: IndexObservation): string {
  return `https://polymarket.com/event/${observation.eventSlug}`;
}
export function indexFreshness(asOf: string, now = Date.now()): "recent" | "delayed" | "stale" {
  const age = now - Date.parse(asOf);
  return !Number.isFinite(age) || age < -300_000 || age > 6 * 3_600_000 ? "stale" : age > 2 * 3_600_000 ? "delayed" : "recent";
}
export function observationMove(row: IndexObservation): number | null {
  return row.quote && row.prior ? 100 * (row.quote.midpoint - row.prior.midpoint) : null;
}
