import type { MarketAttention } from "./attention-model";
/** Serializable index contract. This module is safe to import from the client. */
export const BELIEF_METHOD = "belief-shift-v1";
export const INDEX_MAPPING = "yes-first-binary-v1";
export const INDEX_QUOTE_BASIS = "YES bid/ask midpoint";
export const INDEX_MAX_BYTES = 20_000;
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
  outcomeBenchmark?: OutcomeBenchmark;
  marketAttention?: MarketAttention;
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

export const POLICY_METHOD = "fed-policy-balance-v1";
export const POLICY_NORMALIZATION = "full-partition-v1";
export interface OutcomeBenchmark {
  id: "fed-policy-balance"; type: "outcome-benchmark"; name: "Fed policy balance"; unit: "pp";
  methodology: typeof POLICY_METHOD; adapter: "fed-meeting-buckets-v1"; normalization: typeof POLICY_NORMALIZATION;
  meetingDate: string | null; familyId: string | null; members: (string | null)[];
  identity: string; state: "available" | "unavailable"; issue: string | null;
  headline: number | null; rawSum: number | null; shares: [number, number, number] | null;
  normalized: number[] | null; prior: { headline: number; rawSum: number; shares: [number, number, number]; normalized: number[] } | null;
  change24h: number | null; comparisonIssue: "capturing_baseline" | "meeting_changed" | "identity_changed" | "invalid_prior" | null;
  expectedChangeBps: null; history: IndexHistoryPoint[];
}
