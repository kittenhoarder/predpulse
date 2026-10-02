import type { MarketsApiResponse, ProcessedMarket } from "./types";
import type { IndexProductsDigest } from "./index-products";
import type { ObservationDigest } from "./observations";
import type { EventMonitor } from "./event-monitor";
import type { RelatedDigest } from "./related-markets";
import type { DecisionDistribution } from "./decision-distribution";
import type { EventOutlooks } from "./event-outlooks";

export interface Bootstrap {
  markets: MarketsApiResponse;
  indexProducts?: IndexProductsDigest | null;
  generatedAt: string;
  status: "hourly" | "delayed" | "stale";
  sourceCounts: Record<ProcessedMarket["source"], number>;
  observations?: ObservationDigest | null;
  monitor?: EventMonitor | null;
  monitorMarkets?: ProcessedMarket[];
  related?: RelatedDigest | null;
  decisionDistribution?: DecisionDistribution | null;
  eventOutlooks?: EventOutlooks | null;
}

export function snapshotStatus(
  at: string,
  now = Date.now(),
): Bootstrap["status"] {
  const age = now - Date.parse(at);
  if (!Number.isFinite(age) || age < -300_000 || age > 10_800_000)
    return "stale";
  return age > 4_500_000 ? "delayed" : "hourly";
}
export const NAV_V2 = process.env.NEXT_PUBLIC_NAV_V2 === "1";
