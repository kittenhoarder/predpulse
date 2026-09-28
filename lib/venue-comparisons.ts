import { createHash } from "node:crypto";
import registryJson from "../data/venue-comparisons.json";

export type Venue = "polymarket" | "kalshi";
export type Orientation = "as-is" | "complement";
export type ComparisonReason = "rules-changed" | "market-unavailable" | "outcome-changed" |
  "quote-unavailable" | "invalid-book" | "quote-stale" | "quote-skew";

export const REVIEW_FIELDS = ["variable", "geography", "units", "observationWindow", "releaseDate",
  "cutoffAndTimezone", "threshold", "outcomeDirection", "resolvingAuthority", "dataVintage",
  "voidAndPostponement", "payoutBasis"] as const;
export type ReviewField = typeof REVIEW_FIELDS[number];
export type RuleComparison = Record<ReviewField, [string, string]>;

export interface ReviewedSide {
  source: Venue;
  marketId: string;
  outcomeId: string; // Polymarket CLOB token ID; Kalshi YES or NO
  outcomeLabel: string;
  orientation: Orientation;
  rulesHash: string;
  url: string;
}

export interface ReviewedPair {
  pairId: string;
  familyId: string;
  mappingRevision: number;
  proposition: string;
  rationale: string;
  reviewer: string;
  secondReviewer: string;
  reviewedAt: string;
  ruleComparison: RuleComparison;
  sides: [ReviewedSide, ReviewedSide];
}

export interface VenueQuote {
  source: Venue;
  marketId: string;
  outcomeId: string;
  outcomeLabel: string;
  orientation: Orientation;
  url: string;
  bid?: number;
  ask?: number;
  receivedAt?: string;
  sourceUpdatedAt?: string;
}

export interface Comparison {
  pairId: string;
  familyId: string;
  mappingRevision: number;
  proposition: string;
  rationale: string;
  reviewedAt: string;
  ruleComparison: RuleComparison;
  venues: [VenueQuote, VenueQuote];
  reason?: ComparisonReason;
  gapPP?: number;
}

export interface ComparisonDigest {
  version: 1;
  asOf: string;
  items: Comparison[];
}

const MAX_PAIRS = 10;
const MAX_DIGEST_BYTES = 20_000;
const QUOTE_MAX_AGE_MS = 10 * 60_000;
const SKEW_MAX_MS = 5 * 60_000;

export function hashRules(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

function validUrl(source: Venue, url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === (source === "kalshi" ? "kalshi.com" : "polymarket.com") &&
      parsed.pathname.length > 1;
  } catch { return false; }
}

export function validateRegistry(input: unknown): ReviewedPair[] {
  if (!input || typeof input !== "object") throw new Error("Invalid comparison registry");
  const value = input as { version?: unknown; pairs?: unknown };
  if (value.version !== 1 || !Array.isArray(value.pairs) || value.pairs.length > MAX_PAIRS) {
    throw new Error("Invalid comparison registry size or version");
  }
  const seen = new Set<string>();
  for (const pair of value.pairs as ReviewedPair[]) {
    if (!pair || !/^[a-z0-9-]{3,80}$/.test(pair.pairId) || seen.has(pair.pairId) ||
      !/^[a-z0-9-]{3,80}$/.test(pair.familyId) || !Number.isSafeInteger(pair.mappingRevision) || pair.mappingRevision < 1 ||
      !pair.proposition || pair.proposition.length > 240 || !pair.rationale || pair.rationale.length > 500 ||
      !pair.reviewer || !pair.secondReviewer || pair.reviewer === pair.secondReviewer ||
      !Number.isFinite(Date.parse(pair.reviewedAt)) || !Array.isArray(pair.sides) || pair.sides.length !== 2 ||
      !pair.ruleComparison || REVIEW_FIELDS.some((field) => !Array.isArray(pair.ruleComparison[field]) ||
        pair.ruleComparison[field].length !== 2 || pair.ruleComparison[field].some((value) =>
          typeof value !== "string" || !value.trim() || value.length > 300)) ||
      pair.sides[0].source !== "polymarket" || pair.sides[1].source !== "kalshi") {
      throw new Error("Invalid reviewed pair");
    }
    seen.add(pair.pairId);
    for (const side of pair.sides) {
      if (!side.marketId || !side.outcomeId || !side.outcomeLabel || side.outcomeLabel.length > 80 ||
        !["as-is", "complement"].includes(side.orientation) ||
        !/^[a-f0-9]{64}$/.test(side.rulesHash) || !validUrl(side.source, side.url) ||
        (side.source === "kalshi" && (side.marketId !== side.marketId.toUpperCase() || !["YES", "NO"].includes(side.outcomeId)))) {
        throw new Error("Invalid reviewed side");
      }
    }
  }
  return value.pairs as ReviewedPair[];
}

export const reviewedPairs = validateRegistry(registryJson);

function validQuote(quote: VenueQuote): boolean {
  return typeof quote.bid === "number" && typeof quote.ask === "number" &&
    Number.isFinite(quote.bid) && Number.isFinite(quote.ask) &&
    quote.bid >= 0 && quote.bid <= quote.ask && quote.ask <= 1;
}

export function comparePair(pair: ReviewedPair, quotes: [VenueQuote, VenueQuote], now: number): Comparison {
  const item: Comparison = {
    pairId: pair.pairId, familyId: pair.familyId, mappingRevision: pair.mappingRevision,
    proposition: pair.proposition, rationale: pair.rationale, reviewedAt: pair.reviewedAt,
    ruleComparison: pair.ruleComparison, venues: quotes,
  };
  if (quotes.some((q, i) => q.source !== pair.sides[i].source || q.marketId !== pair.sides[i].marketId ||
    q.outcomeId !== pair.sides[i].outcomeId || q.orientation !== pair.sides[i].orientation)) {
    return { ...item, reason: "outcome-changed" };
  }
  if (!validQuote(quotes[0]) || !validQuote(quotes[1])) return { ...item, reason: "invalid-book" };
  const timestamps = quotes.map((q) => Date.parse(q.receivedAt ?? ""));
  if (timestamps.some((t) => !Number.isFinite(t) || t > now + 30_000 || now - t > QUOTE_MAX_AGE_MS)) {
    return { ...item, reason: "quote-stale" };
  }
  if (Math.abs(timestamps[0] - timestamps[1]) > SKEW_MAX_MS) return { ...item, reason: "quote-skew" };
  const mids = quotes.map((q) => (q.bid! + q.ask!) / 2);
  return { ...item, gapPP: Math.round((mids[0] - mids[1]) * 10_000) / 100 };
}

export function validateComparisonDigest(input: unknown, generatedAt: string): ComparisonDigest {
  const digest = input as ComparisonDigest;
  if (!digest || digest.version !== 1 || digest.asOf !== generatedAt || !Array.isArray(digest.items) ||
    digest.items.length > MAX_PAIRS || Buffer.byteLength(JSON.stringify(digest)) > MAX_DIGEST_BYTES) {
    throw new Error("Invalid comparison digest");
  }
  const seen = new Set<string>();
  for (const item of digest.items) {
    if (!item || !/^[a-z0-9-]{3,80}$/.test(item.pairId) || seen.has(item.pairId) ||
      !item.proposition || !item.rationale || !Number.isSafeInteger(item.mappingRevision) ||
      !item.ruleComparison || REVIEW_FIELDS.some((field) => !Array.isArray(item.ruleComparison[field]) ||
        item.ruleComparison[field].length !== 2 || item.ruleComparison[field].some((value) =>
          typeof value !== "string" || !value.trim() || value.length > 300)) ||
      !Array.isArray(item.venues) || item.venues.length !== 2 ||
      item.venues[0].source !== "polymarket" || item.venues[1].source !== "kalshi" ||
      item.venues.some((q) => !q.marketId || !q.outcomeId || !q.outcomeLabel ||
        !["as-is", "complement"].includes(q.orientation) || !validUrl(q.source, q.url)) ||
      (item.reason ? (item.gapPP !== undefined || !["rules-changed", "market-unavailable", "outcome-changed", "quote-unavailable", "invalid-book", "quote-stale", "quote-skew"].includes(item.reason)) :
        (!Number.isFinite(item.gapPP) || item.venues.some((q) => !validQuote(q) ||
          !Number.isFinite(Date.parse(q.receivedAt ?? ""))) ||
          item.gapPP !== Math.round(((item.venues[0].bid! + item.venues[0].ask! -
            item.venues[1].bid! - item.venues[1].ask!) / 2) * 10_000) / 100))) {
      throw new Error("Invalid comparison item");
    }
    seen.add(item.pairId);
  }
  return digest;
}
