import { cache } from "react";
import { fetchAllSources, getAllMarkets, getMarkets } from "./get-markets";
import type { AllSourcesResult, GetMarketsOptions } from "./get-markets";
import type { ProcessedMarket, MarketsApiResponse } from "./types";

/**
 * React per-request cache wrapper for fetchAllSources.
 * When multiple async RSC components call this within the same request/render,
 * the underlying fetch runs exactly once — both PulseSection and MarketsSection
 * on the home page share the same sources result.
 */
export const getCachedSources: () => Promise<AllSourcesResult> = cache(fetchAllSources);

/**
 * Streaming-SSR helpers used by RSC sections.
 * Both delegate to getCachedSources so the underlying data fetch is shared.
 */
export async function streamAllMarkets(): Promise<ProcessedMarket[]> {
  const sources = await getCachedSources();
  return getAllMarkets(sources);
}

export async function streamGetMarkets(opts: GetMarketsOptions = {}): Promise<MarketsApiResponse> {
  const sources = await getCachedSources();
  return getMarkets(opts, sources);
}
