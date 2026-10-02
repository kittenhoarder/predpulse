import { getMarkets, type GetMarketsOptions } from "./get-markets";
import type { MarketsApiResponse, ProcessedMarket } from "./types";
import type { PublishedSnapshot } from "./snapshot";

export { snapshotStatus as snapshotAgeStatus } from "./bootstrap";

export async function marketsFromSnapshot(
  snapshot: PublishedSnapshot,
  options: GetMarketsOptions = {},
): Promise<MarketsApiResponse> {
  // Reuse the established filtering contract on the published subset.
  const bySource = (source: ProcessedMarket["source"]) =>
    snapshot.markets.filter((m) => m.source === source);
  const response = await getMarkets(options, {
    polymarkets: bySource("polymarket"),
    kalshiMarkets: bySource("kalshi"),
    manifoldMarkets: bySource("manifold"),
  });
  return { ...response, cachedAt: snapshot.generatedAt, fromCache: true };
}
