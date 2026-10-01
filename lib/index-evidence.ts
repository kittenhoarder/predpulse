import { createHash } from "node:crypto";
import type { GammaEvent, GammaMarket } from "./types";
import { readYesQuote } from "./outlook-quotes";
import { BELIEF_METHOD, INDEX_MAPPING, INDEX_QUOTE_BASIS, type IndexObservation, type IndexQuote, type QuoteIssue } from "./index-products";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const finiteDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const probability = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

export function outcomeId(m: GammaMarket): string | null {
  try {
    const outcomes = JSON.parse(m.outcomes), tokens = JSON.parse(m.clobTokenIds);
    return Array.isArray(outcomes) && outcomes.length === 2 && outcomes[0] === "Yes" && outcomes[1] === "No" &&
      Array.isArray(tokens) && tokens.length === 2 && tokens.every((t) => typeof t === "string" && /^\d{1,96}$/.test(t)) &&
      tokens[0] !== tokens[1] ? tokens[0] : null;
  } catch { return null; }
}
export function metadataIssue(e: GammaEvent, m: GammaMarket): QuoteIssue | null {
  return !/^\d{1,30}$/.test(e.id ?? "") || !/^\d{1,30}$/.test(m.id ?? "") ||
    !/^[a-z0-9-]{1,180}$/.test(e.slug ?? "") || !m.question || m.question.length > 200 ||
    !m.description?.trim() || typeof e.description !== "string" ||
    Buffer.byteLength(m.description) > 15_000 || Buffer.byteLength(e.description) > 15_000 ||
    typeof m.resolutionSource !== "string" || !finiteDate(m.endDate) ? "invalid_identity" : null;
}
export function usableQuote(e: GammaEvent, m: GammaMarket, now: number): { quote: IndexQuote | null; issue: QuoteIssue | null } {
  if (!e.active || e.closed || e.archived || !m.active || m.closed || m.archived) return { quote: null, issue: "inactive" };
  if (!outcomeId(m)) return { quote: null, issue: "unsupported_outcome" };
  const issue = metadataIssue(e, m);
  if (issue) return { quote: null, issue };
  if (Date.parse(m.endDate) <= now) return { quote: null, issue: "past_close" };
  if (!finiteDate(m.updatedAt) || now - Date.parse(m.updatedAt) < -300_000 || now - Date.parse(m.updatedAt) > 75 * 60_000)
    return { quote: null, issue: "old_record" };
  const book = readYesQuote(m);
  return book.midpoint === null ? { quote: null, issue: "invalid_book" } : {
    quote: { bid: book.bid!, ask: book.ask!, midpoint: book.midpoint, updatedAt: m.updatedAt }, issue: null,
  };
}
export function rulesHash(e: GammaEvent, m: GammaMarket): string {
  const normalize = (s: string) => s.replace(/\r\n?/g, "\n").trim();
  return hash(JSON.stringify(["rules-normalization-v1", normalize(e.description), normalize(m.description), m.resolutionSource]));
}
export function observationIdentity(row: IndexObservation): string {
  return hash(JSON.stringify(["polymarket", row.marketId, row.familyId, row.outcomeId, row.question, row.rulesHash, row.closesAt,
    INDEX_MAPPING, INDEX_QUOTE_BASIS, BELIEF_METHOD])).slice(0, 32);
}
export function quoteValid(q: IndexQuote, at: string): boolean {
  return !!q && [q.bid, q.ask, q.midpoint].every(probability) && q.ask > 0 && q.bid <= q.ask &&
    q.ask - q.bid <= 0.10 + 1e-9 && Math.abs(q.midpoint - (q.bid + q.ask) / 2) <= 1e-9 &&
    finiteDate(q.updatedAt) && Date.parse(at) - Date.parse(q.updatedAt) >= -300_000 &&
    Date.parse(at) - Date.parse(q.updatedAt) <= 75 * 60_000;
}
