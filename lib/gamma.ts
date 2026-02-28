import type { GammaEvent, GammaTag } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const PAGE_SIZE = 100;
// Fetch up to 5 pages (500 events) per refresh cycle
const MAX_PAGES = 5;
// Per-request timeout; with parallel fetches the wall-clock time is ~1 page worth
const FETCH_TIMEOUT_MS = 15_000;
// Max concurrent Gamma API requests — stays polite while still being fast
const MAX_CONCURRENT = 3;

async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one page of active events (with embedded markets) from the Gamma API.
 * Returns an empty array on non-200 so a single bad page doesn't abort the whole run.
 */
async function fetchEventsPage(offset: number): Promise<GammaEvent[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    order: "volume_24hr",
    ascending: "false",
  });
  const url = `${GAMMA_BASE}/events?${params.toString()}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    console.warn(`[gamma] Non-OK response ${res.status} at offset ${offset}, skipping page`);
    return [];
  }
  const data: GammaEvent[] = await res.json();
  return data;
}

/**
 * Fetch all active events in parallel batches (MAX_CONCURRENT at a time).
 *
 * Strategy:
 *   1. Fire the first page to discover total event count.
 *   2. Determine how many additional pages are needed.
 *   3. Fetch remaining pages in parallel batches, capped at MAX_CONCURRENT.
 *
 * Compared to serial fetching this cuts wall-clock time from ~MAX_PAGES × RTT
 * down to ~ceil(MAX_PAGES / MAX_CONCURRENT) × RTT — roughly 5× faster.
 */
export async function fetchAllActiveEvents(): Promise<GammaEvent[]> {
  // Fetch the first page to anchor pagination
  const firstPage = await fetchEventsPage(0);
  if (firstPage.length === 0) return [];
  if (firstPage.length < PAGE_SIZE) return firstPage;

  // Build remaining page offsets
  const remainingOffsets: number[] = [];
  for (let page = 1; page < MAX_PAGES; page++) {
    remainingOffsets.push(page * PAGE_SIZE);
  }

  // Process in batches of MAX_CONCURRENT
  const all: GammaEvent[] = [...firstPage];
  for (let i = 0; i < remainingOffsets.length; i += MAX_CONCURRENT) {
    const batch = remainingOffsets.slice(i, i + MAX_CONCURRENT);
    const results = await Promise.all(batch.map(fetchEventsPage));
    let reachedEnd = false;
    for (const page of results) {
      all.push(...page);
      if (page.length < PAGE_SIZE) {
        reachedEnd = true;
      }
    }
    if (reachedEnd) break;
  }

  return all;
}

/**
 * Fetch the canonical tag list from the Gamma API.
 * Used at ingest time to build a slug→label normalisation map.
 */
export async function fetchTags(): Promise<GammaTag[]> {
  const url = `${GAMMA_BASE}/tags`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    console.warn(`[gamma] Failed to fetch tags: ${res.status}`);
    return [];
  }
  return res.json();
}
