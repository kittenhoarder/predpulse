import type { GdeltArticle } from "@/lib/types";

// Words stripped before building a GDELT query from a market question
const STOP_WORDS = new Set([
  "will", "the", "be", "a", "an", "in", "by", "for", "to", "of", "on", "at",
  "if", "who", "what", "when", "which", "is", "are", "does", "do", "has",
  "have", "between", "and", "or", "not", "no", "yes", "this", "that", "with",
  "from", "its", "their", "was", "were", "had", "been", "get", "win", "lose",
  "hit", "reach", "above", "below", "over", "under", "least", "most", "more",
  "than", "before", "after", "within", "during", "through", "become", "make",
  "take", "go", "come", "end", "start", "first", "last", "next", "any", "all",
  "price", "market", "percent", "%",
]);

// Extract up to 4 meaningful keywords from a market question string
export function extractKeywords(question: string): string[] {
  return question
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 4);
}

// Fetch up to 5 related news articles from GDELT for a market question.
// Returns [] on any error — never throws.
export async function fetchMarketNews(question: string): Promise<GdeltArticle[]> {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  const query = encodeURIComponent(keywords.join(" "));
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc` +
    `?query=${query}&mode=artlist&maxrecords=5&format=json&sort=DateDesc`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();

    // GDELT returns { articles: [...] } or { articles: null } when no results
    const raw: {
      url: string;
      title: string;
      domain: string;
      seendate: string;
      tone?: number;
    }[] = json?.articles ?? [];

    return raw
      .filter((a) => a.url && a.title)
      .map((a) => ({
        url: a.url,
        title: a.title,
        domain: a.domain ?? new URL(a.url).hostname.replace(/^www\./, ""),
        seendate: a.seendate ?? "",
        tone: typeof a.tone === "number" ? a.tone : 0,
      }));
  } catch {
    return [];
  }
}
