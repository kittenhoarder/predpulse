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
  return NextResponse.json({
    markets: await marketsFromSnapshot(snapshot, { sort: "movers", category: "all", offset: 0, limit: 50 }),
    pulse: { indices: snapshot.pulse, computedAt: snapshot.generatedAt },
    generatedAt: snapshot.generatedAt,
    status,
    sourceCounts: snapshot.sourceCounts,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
