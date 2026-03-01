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
 * Retry a fetch-like async function on 429 responses using exponential backoff
 * with jitter. Non-429 errors and final-attempt 429s are rethrown immediately.
 *
 * @param fn       Function that returns a Response (or throws on network error)
 * @param retries  Max additional attempts after the first (default 3)
 * @param baseMs   Initial backoff delay in ms before jitter (default 1000)
 */
export async function fetchWithRetry(
  fn: () => Promise<Response>,
  retries = 3,
  baseMs = 1_000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fn();
    if (res.status !== 429 || attempt === retries) return res;
    const delay = baseMs * 2 ** attempt + Math.random() * 500;
    await new Promise((r) => setTimeout(r, delay));
  }
  // unreachable — loop always returns above
  return fn();
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
