import type { MetaculusQuestion } from "@/lib/types";
import { extractKeywords } from "@/lib/gdelt";

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

// Fetch up to 3 Metaculus questions matching a market question's keywords.
// Returns [] on any error — never throws.
export async function fetchRelatedQuestions(
  question: string
): Promise<MetaculusQuestion[]> {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  const search = encodeURIComponent(keywords.join(" "));
  const url =
    `https://www.metaculus.com/api2/questions/` +
    `?search=${search}&status=open&format=json&limit=3`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();

    const results: MetaculusRawQuestion[] = json?.results ?? [];

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
  } catch {
    return [];
  }
}
