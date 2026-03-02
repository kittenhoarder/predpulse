import type { ProcessedMarket } from "@/lib/types";
import { extractKeywords } from "@/lib/gdelt";

// Score a market against a set of article keywords.
// Returns the count of keyword overlaps in the market question.
function scoreMarket(market: ProcessedMarket, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const question = market.question.toLowerCase();
  return keywords.reduce((score, kw) => {
    return score + (question.includes(kw) ? 1 : 0);
  }, 0);
}

// Match an article title to the most relevant prediction markets by keyword overlap.
// Returns up to `limit` markets with at least 1 keyword match, sorted by score desc.
export function matchArticlesToMarkets(
  articleTitle: string,
  markets: ProcessedMarket[],
  limit = 3
): ProcessedMarket[] {
  const keywords = extractKeywords(articleTitle);
  if (keywords.length === 0) return [];

  return markets
    .map((market) => ({ market, score: scoreMarket(market, keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ market }) => market);
}

// Map known Predpulse category slugs to Guardian-friendly search terms.
// Only known slugs are used — unknown slugs are silently dropped to avoid
// garbage terms appearing in the news query.
const SLUG_TO_TERM: Record<string, string> = {
  politics: "election politics",
  crypto: "bitcoin cryptocurrency",
  economics: "economy federal reserve",
  sports: "sports",
  science: "technology science",
  entertainment: "entertainment",
  "pop-culture": "culture",
  "pop culture": "culture",
  finance: "finance markets",
  business: "business economy",
  health: "health",
  environment: "climate environment",
  law: "legal court",
  geopolitics: "geopolitics international",
};

// Build a query string for the Newsroom section based on the top active market categories.
// Falls back to a sensible default if no categories match the known map.
export function buildNewsroomQuery(markets: ProcessedMarket[]): string {
  const counts: Record<string, number> = {};
  for (const m of markets) {
    for (const slug of m.categoryslugs) {
      const normalised = slug.toLowerCase().trim();
      counts[normalised] = (counts[normalised] ?? 0) + 1;
    }
  }

  const topSlugs = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => slug);

  // Only include slugs we have a mapping for — never pass unknown slugs as query terms
  const terms = topSlugs
    .filter((slug) => SLUG_TO_TERM[slug] !== undefined)
    .map((slug) => SLUG_TO_TERM[slug])
    .join(" ")
    .trim();

  return terms || "election economy bitcoin trump";
}
