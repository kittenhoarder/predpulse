import { fetchWithTimeout } from "./fetch-utils";
import {
  comparePair, hashRules, reviewedPairs, validateComparisonDigest,
  type Comparison, type ComparisonDigest, type ComparisonReason, type ReviewedPair,
  type ReviewedSide, type VenueQuote,
} from "./venue-comparisons";

const TIMEOUT_MS = 8_000;

type VenueResult = { quote: VenueQuote; rulesHash?: string; reason?: ComparisonReason };

function emptyQuote(side: ReviewedSide): VenueQuote {
  return {
    source: side.source, marketId: side.marketId, outcomeId: side.outcomeId,
    outcomeLabel: side.outcomeLabel, orientation: side.orientation, url: side.url,
  };
}

function normalizedQuote(side: ReviewedSide, bid: number, ask: number, receivedAt: string, sourceUpdatedAt?: string): VenueQuote {
  return {
    ...emptyQuote(side),
    bid: side.orientation === "complement" ? 1 - ask : bid,
    ask: side.orientation === "complement" ? 1 - bid : ask,
    receivedAt, sourceUpdatedAt,
  };
}

async function getJson(url: string): Promise<{ data: Record<string, unknown>; receivedAt: string }> {
  const response = await fetchWithTimeout(url, undefined, TIMEOUT_MS);
  const receivedAt = new Date().toISOString();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data: await response.json() as Record<string, unknown>, receivedAt };
}

function arrayField(raw: unknown): string[] {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(data) && data.every((x) => typeof x === "string") ? data : [];
  } catch { return []; }
}

// Include settlement-relevant structured fields as well as full rules. The reviewer
// computes the same fingerprint using this canonical representation.
export function kalshiRuleText(m: Record<string, unknown>): string {
  return JSON.stringify({
    title: m.title, yes_sub_title: m.yes_sub_title, no_sub_title: m.no_sub_title,
    rules_primary: m.rules_primary, rules_secondary: m.rules_secondary,
    close_time: m.close_time, expiration_time: m.expiration_time,
    early_close_condition: m.early_close_condition,
  });
}

export function polymarketRuleText(m: Record<string, unknown>): string {
  return JSON.stringify({
    question: m.question, description: m.description, resolutionSource: m.resolutionSource,
    endDate: m.endDate, outcomes: m.outcomes, negRisk: m.negRisk,
  });
}

export async function fetchComparisonSide(side: ReviewedSide): Promise<VenueResult> {
  const empty = emptyQuote(side);
  try {
    if (side.source === "kalshi") {
      const { data, receivedAt } = await getJson(`https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(side.marketId)}`);
      const m = data.market as Record<string, unknown> | undefined;
      if (!m || m.ticker !== side.marketId || m.status !== "active") return { quote: empty, reason: "market-unavailable" };
      if (typeof m.rules_primary !== "string" || !m.rules_primary.trim() || typeof m.rules_secondary !== "string") {
        return { quote: empty, reason: "rules-changed" };
      }
      const rulesHash = hashRules(kalshiRuleText(m));
      const bid = Number(m.yes_bid_dollars), ask = Number(m.yes_ask_dollars);
      if (typeof m.yes_bid_dollars !== "string" || typeof m.yes_ask_dollars !== "string") {
        return { quote: empty, rulesHash, reason: "quote-unavailable" };
      }
      if ((m.yes_bid_size_fp !== undefined && Number(m.yes_bid_size_fp) <= 0) ||
        (m.yes_ask_size_fp !== undefined && Number(m.yes_ask_size_fp) <= 0)) {
        return { quote: empty, rulesHash, reason: "quote-unavailable" };
      }
      if (side.outcomeId !== "YES" && side.outcomeId !== "NO") return { quote: empty, rulesHash, reason: "outcome-changed" };
      const yes = side.outcomeId === "YES";
      const quote = normalizedQuote(side, yes ? bid : 1 - ask, yes ? ask : 1 - bid, receivedAt,
        typeof m.updated_time === "string" ? m.updated_time : undefined);
      return { quote, rulesHash };
    }

    const { data: m } = await getJson(`https://gamma-api.polymarket.com/markets/${encodeURIComponent(side.marketId)}`);
    if (String(m.id) !== side.marketId || m.active !== true || m.closed === true || m.archived === true || m.enableOrderBook !== true) {
      return { quote: empty, reason: "market-unavailable" };
    }
    if (typeof m.description !== "string" || !m.description.trim() || typeof m.resolutionSource !== "string") {
      return { quote: empty, reason: "rules-changed" };
    }
    const rulesHash = hashRules(polymarketRuleText(m));
    const outcomes = arrayField(m.outcomes), tokens = arrayField(m.clobTokenIds);
    const position = tokens.indexOf(side.outcomeId);
    if (position < 0 || outcomes[position] !== side.outcomeLabel || outcomes.length !== tokens.length) {
      return { quote: empty, rulesHash, reason: "outcome-changed" };
    }
    const { data: book, receivedAt: quoteReceivedAt } = await getJson(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(side.outcomeId)}`);
    if (String(book.asset_id) !== side.outcomeId) return { quote: empty, rulesHash, reason: "outcome-changed" };
    const bids = Array.isArray(book.bids) ? book.bids as Record<string, unknown>[] : [];
    const asks = Array.isArray(book.asks) ? book.asks as Record<string, unknown>[] : [];
    if (!bids.length || !asks.length) return { quote: empty, rulesHash, reason: "quote-unavailable" };
    const bid = Math.max(...bids.filter((l) => Number(l.size) > 0).map((l) => Number(l.price)));
    const ask = Math.min(...asks.filter((l) => Number(l.size) > 0).map((l) => Number(l.price)));
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return { quote: empty, rulesHash, reason: "quote-unavailable" };
    return { quote: normalizedQuote(side, bid, ask, quoteReceivedAt, typeof m.updatedAt === "string" ? m.updatedAt : undefined), rulesHash };
  } catch {
    return { quote: empty, reason: "market-unavailable" };
  }
}

export async function buildComparisonDigest(asOf: string, pairs: ReviewedPair[] = reviewedPairs): Promise<ComparisonDigest> {
  const items: Comparison[] = [];
  // Two pairs in flight at most, with one request per venue within each pair.
  for (let i = 0; i < pairs.length; i += 2) {
    const batch = await Promise.all(pairs.slice(i, i + 2).map(async (pair) => {
      const sides = await Promise.all(pair.sides.map(fetchComparisonSide));
      const quotes = [sides[0].quote, sides[1].quote] as [VenueQuote, VenueQuote];
      const reason = sides.find((s, index) => s.rulesHash && s.rulesHash !== pair.sides[index].rulesHash)
        ? "rules-changed" : sides[0].reason ?? sides[1].reason ??
          (sides.some((side) => !side.rulesHash) ? "rules-changed" : undefined);
      return reason
        ? { pairId: pair.pairId, familyId: pair.familyId, mappingRevision: pair.mappingRevision,
            proposition: pair.proposition, rationale: pair.rationale, reviewedAt: pair.reviewedAt,
            ruleComparison: pair.ruleComparison, venues: quotes, reason }
        : comparePair(pair, quotes, Date.now());
    }));
    items.push(...batch);
  }
  return validateComparisonDigest({ version: 1, asOf, items }, asOf);
}
