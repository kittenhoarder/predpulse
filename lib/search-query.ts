/**
 * Collapse open `q=` params so CDN cache keys coalesce across agents and UI variants.
 * Lowercase, trim, keep the first meaningful words, hard-cap length.
 */
export function normalizeSearchQuery(
  raw: string,
  maxWords = 4,
  maxChars = 100,
): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ")
    .slice(0, maxChars);
}

/** Shared CDN policy for proxied search APIs (news, metaculus). */
export const SEARCH_PROXY_CACHE =
  "public, s-maxage=300, stale-while-revalidate=600";
