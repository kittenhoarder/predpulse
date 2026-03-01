const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch with an AbortController-based timeout.
 * On timeout the request is aborted and the promise rejects.
 *
 * We force `cache: "no-store"` because several upstream market payloads exceed
 * Next.js dev data-cache limits; no-store avoids cache-write failures on large responses.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Process items in parallel batches of `batchSize`.
 * Useful for rate-limit-safe concurrent fetching.
 */
export async function batchParallel<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
