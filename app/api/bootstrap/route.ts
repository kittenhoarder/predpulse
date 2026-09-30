import { NextResponse } from "next/server";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import { marketsFromSnapshot, snapshotAgeStatus } from "@/lib/snapshot-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await loadPublishedSnapshot();
  if (!snapshot) return NextResponse.json({ error: "No published snapshot" }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
  const status = snapshotAgeStatus(snapshot.generatedAt);
  const markets = await marketsFromSnapshot(snapshot, { sort: "movers", category: "all", offset: 0, limit: 50 });
  const firstPage = new Set(markets.markets.map((m) => `${m.source}:${m.id}`));
  const monitored = new Set(snapshot.monitor?.items.map((item) => `${item.source}:${item.marketId}`) ?? []);
  return NextResponse.json({
    markets,
    monitorMarkets: snapshot.markets.filter((m) => monitored.has(`${m.source}:${m.id}`) && !firstPage.has(`${m.source}:${m.id}`)),
    pulse: { indices: snapshot.pulse, computedAt: snapshot.generatedAt },
    generatedAt: snapshot.generatedAt,
    status,
    sourceCounts: snapshot.sourceCounts,
    observations: snapshot.observations ?? null,
    monitor: snapshot.monitor ?? null,
    related: snapshot.related ?? null,
    decisionDistribution: snapshot.decisionDistribution ?? null,
    eventOutlooks: snapshot.eventOutlooks ?? null,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
