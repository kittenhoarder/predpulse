import { NextRequest, NextResponse } from "next/server";
import type { GdeltArticle } from "@/lib/types";
import { normalizeSearchQuery, SEARCH_PROXY_CACHE } from "@/lib/search-query";

export const dynamic = "force-dynamic";

// The Guardian Open Platform API key.
// "test" key works in dev (100 req/day). Set GUARDIAN_API_KEY in env for production
// (free at https://open-platform.theguardian.com/access/ — 5,000 req/day).
const GUARDIAN_KEY = process.env.GUARDIAN_API_KEY ?? "test";
const GUARDIAN_BASE = "https://content.guardianapis.com/search";

interface GuardianResult {
  webUrl: string;
  webTitle: string;
  webPublicationDate: string;
  fields?: {
    headline?: string;
    thumbnail?: string;
    trailText?: string;
  };
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Map Predpulse category query terms to Guardian section IDs for tighter results
const TERM_TO_SECTION: Record<string, string> = {
  election: "politics",
  politics: "politics",
  government: "politics",
  bitcoin: "technology",
  cryptocurrency: "technology",
  "federal reserve": "business",
  economy: "business",
  inflation: "business",
  sports: "sport",
  championship: "sport",
  technology: "technology",
  science: "science",
  entertainment: "culture",
  celebrity: "culture",
  trump: "us-news",
};

// Derive the most relevant Guardian section from a query string
function querySections(q: string): string | null {
  const lower = q.toLowerCase();
  for (const [term, section] of Object.entries(TERM_TO_SECTION)) {
    if (lower.includes(term)) return section;
  }
  return null;
}

function emptyNews(unavailable = false) {
  return NextResponse.json(
    { articles: [] as (GdeltArticle & { image?: string; summary?: string })[], ...(unavailable ? { unavailable: true } : {}) },
    { headers: { "Cache-Control": SEARCH_PROXY_CACHE } },
  );
}

export async function GET(req: NextRequest) {
  const q = normalizeSearchQuery(req.nextUrl.searchParams.get("q") ?? "");

  if (!q) return emptyNews();

  try {
    const section = querySections(q);

    const params = new URLSearchParams({
      q,
      "show-fields": "headline,thumbnail,trailText",
      "order-by": "newest",
      "page-size": "8",
      "api-key": GUARDIAN_KEY,
    });
    if (section) params.set("section", section);

    const guardianUrl = `${GUARDIAN_BASE}?${params.toString()}`;

    const res = await fetch(guardianUrl, {
      signal: AbortSignal.timeout(6_000),
    });

    if (!res.ok) {
      console.error(`[/api/news] Guardian ${res.status}`);
      return emptyNews(true);
    }

    const json = await res.json();
    const results: GuardianResult[] = json?.response?.results ?? [];

    const articles: (GdeltArticle & { image?: string; summary?: string })[] = results
      .filter((r) => r.webUrl && (r.fields?.headline ?? r.webTitle))
      .map((r) => {
        const domain = new URL(r.webUrl).hostname.replace(/^www\./, "");
        // Convert Guardian ISO date to GDELT-style seendate for shared rendering
        const seendate = r.webPublicationDate
          ? r.webPublicationDate.replace(/-/g, "").replace(/:/g, "").replace(/\.\d+Z$/, "Z")
          : "";
        return {
          url: r.webUrl,
          title: r.fields?.headline ?? r.webTitle,
          domain,
          seendate,
          tone: 0, // Guardian doesn't provide tone — cards render as Neutral
          ...(r.fields?.thumbnail ? { image: r.fields.thumbnail } : {}),
          ...(r.fields?.trailText ? { summary: stripHtml(r.fields.trailText) } : {}),
        };
      });

    return NextResponse.json(
      { articles },
      { headers: { "Cache-Control": SEARCH_PROXY_CACHE } },
    );
  } catch (err) {
    console.error("[/api/news]", err);
    return emptyNews(true);
  }
}
