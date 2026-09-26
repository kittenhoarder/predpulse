import { getMarkets, type GetMarketsOptions } from "./get-markets";
import type { MarketsApiResponse, ProcessedMarket } from "./types";
import type { PublishedSnapshot } from "./snapshot";

export function snapshotAgeStatus(generatedAt: string): "hourly" | "delayed" | "stale" {
  const age = Date.now() - Date.parse(generatedAt);
  if (!Number.isFinite(age) || age > 3 * 60 * 60_000) return "stale";
  return age > 75 * 60_000 ? "delayed" : "hourly";
}

export async function marketsFromSnapshot(
  snapshot: PublishedSnapshot,
  options: GetMarketsOptions = {},
): Promise<MarketsApiResponse> {
  // Reuse the established filtering contract on the published subset.
  const bySource = (source: ProcessedMarket["source"]) => snapshot.markets.filter((m) => m.source === source);
  const response = await getMarkets(options, {
    polymarkets: bySource("polymarket"),
    kalshiMarkets: bySource("kalshi"),
    manifoldMarkets: bySource("manifold"),
  });
  return { ...response, cachedAt: snapshot.generatedAt, fromCache: true };
}
