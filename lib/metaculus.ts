import type { MetaculusQuestion } from "@/lib/types";
import { extractKeywords } from "@/lib/gdelt";
import { normalizeSearchQuery, SEARCH_PROXY_CACHE } from "@/lib/search-query";

export { SEARCH_PROXY_CACHE };

interface MetaculusRawQuestion {
  id: number;
  title: string;
  page_url?: string;
  url?: string;
  resolution_criteria?: string;
  community_prediction?: {
    full?: {
      // q2 is the median of the community forecast distribution (0–1)
      q2?: number;
    };
  };
}

function authHeaders(): HeadersInit | undefined {
  const key = process.env.METACULUS_API_KEY?.trim();
  if (!key) return undefined;
  // Metaculus API tokens use the Token scheme (not Bearer).
  return { Authorization: `Token ${key}` };
}

function mapQuestions(results: MetaculusRawQuestion[]): MetaculusQuestion[] {
  return results
    .filter((q) => q.id && q.title)
    .map((q) => ({
      id: q.id,
      title: q.title,
      url:
        q.page_url ??
        q.url ??
        `https://www.metaculus.com/questions/${q.id}/`,
      communityMedian: q.community_prediction?.full?.q2 ?? null,
      resolutionCriteria: q.resolution_criteria ?? "",
    }));
}

/**
 * Search open Metaculus questions for a free-text query.
 * Returns [] when the key is unset, the query is empty, or upstream fails.
 * Never throws.
 */
export async function searchMetaculusQuestions(
  rawQuery: string,
): Promise<MetaculusQuestion[]> {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) return [];

  const key = process.env.METACULUS_API_KEY?.trim();
  if (!key) {
    console.warn("[metaculus] METACULUS_API_KEY unset; skipping upstream");
    return [];
  }

  const url =
    `https://www.metaculus.com/api2/questions/` +
    `?search=${encodeURIComponent(q)}&status=open&format=json&limit=3`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: authHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[metaculus] upstream ${res.status}`);
      return [];
    }
    const json = await res.json();
    return mapQuestions(json?.results ?? []);
  } catch (err) {
    console.error("[metaculus]", err);
    return [];
  }
}

/** Fetch up to 3 Metaculus questions matching a market question's keywords. */
export async function fetchRelatedQuestions(
  question: string,
): Promise<MetaculusQuestion[]> {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];
  return searchMetaculusQuestions(keywords.join(" "));
}
