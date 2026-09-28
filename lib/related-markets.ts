import { createHash } from "node:crypto";
import { marketTradeUrl } from "./format";
import type { ProcessedMarket } from "./types";

export interface RelatedMarket {
  source: "polymarket" | "kalshi";
  marketId: string;
  question: string;
  eventUrl: string;
  outcome: string;
  price: number;
  priceBasis: "outcome market price" | "YES ask";
  closesAt: string;
  ruleExcerpt?: string;
}

export interface RelatedPair {
  id: string;
  basis: "title" | "category";
  category: string;
  sharedTerms: string[];
  markets: [RelatedMarket, RelatedMarket];
}

export interface RelatedDigest {
  version: 1;
  asOf: string;
  screened: number;
  items: RelatedPair[];
}

const TOPICS = new Set(["politics", "economics", "geopolitics", "crypto", "sports", "tech", "climate", "entertainment"]);
const STOP = new Set(["will", "the", "a", "an", "to", "of", "in", "on", "for", "by", "at", "be", "is", "are", "and", "or", "vs", "with", "from", "this", "that", "before", "after", "between", "above", "below", "more", "than", "market", "yes", "no"]);
const MAX_PAIRS = 8;
const MAX_BYTES = 14_000;

function terms(title: string): string[] {
  return Array.from(new Set(title.toLowerCase().match(/[a-z0-9]+/g)?.filter((term) =>
    term.length >= 3 && !STOP.has(term)) ?? []));
}

function eligible(m: ProcessedMarket, now: number): boolean {
  const close = Date.parse(m.endDate);
  return m.categoryslugs.some((slug) => TOPICS.has(slug)) &&
    Number.isFinite(close) && close > now && Number.isFinite(m.currentPrice) &&
    m.currentPrice >= 0 && m.currentPrice <= 100 &&
    (m.volume24h >= 1_000 || m.liquidity >= (m.source === "kalshi" ? 500 : 5_000)) &&
    terms(m.question).length >= 3;
}

function summary(m: ProcessedMarket): RelatedMarket {
  return {
    source: m.source as RelatedMarket["source"], marketId: m.id, question: m.question.slice(0, 220),
    eventUrl: marketTradeUrl(m.source, m.eventSlug), outcome: (m.outcomes[0] ?? "Outcome").slice(0, 80),
    price: m.currentPrice, priceBasis: m.source === "kalshi" ? "YES ask" : "outcome market price",
    closesAt: m.endDate,
    ...(m.source === "polymarket" && m.description ? { ruleExcerpt: m.description.slice(0, 280) } : {}),
  };
}

/** Automated topic discovery. Text resemblance NEVER establishes identical settlement. */
export function buildRelatedDigest(markets: ProcessedMarket[], asOf: string): RelatedDigest {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid related market timestamp");
  const poly = markets.filter((m) => m.source === "polymarket" && eligible(m, now));
  const kalshi = markets.filter((m) => m.source === "kalshi" && eligible(m, now));
  const kalshiTerms = kalshi.map((m) => ({ m, tokens: terms(m.question) }));
  const index = new Map<string, number[]>();
  kalshiTerms.forEach(({ tokens }, i) => tokens.forEach((token) => index.set(token, [...(index.get(token) ?? []), i])));
  const candidates: Array<{ a: ProcessedMarket; b: ProcessedMarket; shared: string[]; score: number }> = [];

  for (const a of poly) {
    const tokens = terms(a.question);
    const neighbours = new Set(tokens.flatMap((term) => index.get(term) ?? []));
    for (const i of Array.from(neighbours)) {
      const { m: b, tokens: other } = kalshiTerms[i];
      if (!a.categoryslugs.some((slug) => b.categoryslugs.includes(slug) && TOPICS.has(slug))) continue;
      const shared = tokens.filter((term) => other.includes(term));
      const shorterCoverage = shared.length / Math.min(tokens.length, other.length);
      const jaccard = shared.length / (new Set([...tokens, ...other]).size);
      const daysApart = Math.abs(Date.parse(a.endDate) - Date.parse(b.endDate)) / 86_400_000;
      if (shared.length < 3 || shorterCoverage < 0.6 || jaccard < 0.38 || daysApart > 60) continue;
      candidates.push({ a, b, shared, score: jaccard + shorterCoverage / 2 - daysApart / 600 });
    }
  }

  candidates.sort((x, y) => y.score - x.score || x.a.id.localeCompare(y.a.id) || x.b.id.localeCompare(y.b.id));
  const usedPoly = new Set<string>(), usedKalshi = new Set<string>();
  const items: RelatedPair[] = [];
  for (const { a, b, shared } of candidates) {
    if (usedPoly.has(a.id) || usedKalshi.has(b.id)) continue;
    usedPoly.add(a.id); usedKalshi.add(b.id);
    items.push({
      id: createHash("sha256").update(`${a.id}:${b.id}`).digest("hex").slice(0, 16),
      basis: "title", category: a.categoryslugs.find((slug) => b.categoryslugs.includes(slug)) ?? a.categoryslugs[0],
      sharedTerms: shared.slice(0, 5), markets: [summary(a), summary(b)],
    });
    if (items.length >= MAX_PAIRS) break;
  }
  // A showcase should still be useful when strict title matching yields nothing.
  // This fallback is explicitly a category overview, NEVER a claim of related events.
  if (items.length === 0) {
    for (const category of ["economics", "politics", "geopolitics", "crypto", "sports", "tech", "climate", "entertainment"]) {
      const a = poly.filter((m) => m.categoryslugs.includes(category)).sort((x, y) => y.volume24h - x.volume24h)[0];
      const b = kalshi.filter((m) => m.categoryslugs.includes(category)).sort((x, y) => y.volume24h - x.volume24h)[0];
      if (!a || !b) continue;
      items.push({ id: createHash("sha256").update(`${a.id}:${b.id}`).digest("hex").slice(0, 16),
        basis: "category", category, sharedTerms: [], markets: [summary(a), summary(b)] });
      break;
    }
  }
  const digest: RelatedDigest = { version: 1, asOf, screened: poly.length + kalshi.length, items };
  return validateRelatedDigest(digest, asOf);
}

export function validateRelatedDigest(input: unknown, generatedAt: string): RelatedDigest {
  const value = input as RelatedDigest;
  if (!value || value.version !== 1 || value.asOf !== generatedAt || !Number.isSafeInteger(value.screened) ||
    value.screened < 0 || !Array.isArray(value.items) || value.items.length > MAX_PAIRS ||
    Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) throw new Error("Invalid related digest");
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!item || !/^[a-f0-9]{16}$/.test(item.id) || seen.has(item.id) ||
      !["title", "category"].includes(item.basis) || !TOPICS.has(item.category) ||
      !Array.isArray(item.sharedTerms) ||
      (item.basis === "title" ? item.sharedTerms.length < 3 || item.sharedTerms.length > 5 : item.sharedTerms.length !== 0) ||
      item.sharedTerms.some((t) => typeof t !== "string" || !/^[a-z0-9]+$/.test(t)) ||
      !Array.isArray(item.markets) || item.markets.length !== 2 ||
      item.markets[0].source !== "polymarket" || item.markets[1].source !== "kalshi" ||
      item.markets.some((m) => {
        if (!m.marketId || !m.question || !m.outcome || !Number.isFinite(m.price) || m.price < 0 || m.price > 100 ||
          !Number.isFinite(Date.parse(m.closesAt)) ||
          m.priceBasis !== (m.source === "kalshi" ? "YES ask" : "outcome market price")) return true;
        try { const url = new URL(m.eventUrl); return url.protocol !== "https:" ||
          url.hostname !== (m.source === "kalshi" ? "kalshi.com" : "polymarket.com"); }
        catch { return true; }
      })) throw new Error("Invalid related pair");
    seen.add(item.id);
  }
  return value;
}
