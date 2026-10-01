import { NextRequest, NextResponse } from "next/server";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import { indexFreshness } from "@/lib/index-products";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  if (["family", "horizon", "sourceScope"].some((key) => params.has(key))) return NextResponse.json({
    error: "Experimental Pulse families have been retired", successor: "/api/indices", version: 1,
  }, { status: 410, headers: { "Link": '</api/indices>; rel="successor-version"', "Cache-Control": "public, s-maxage=300" } });
  const snapshot = await loadPublishedSnapshot();
  return NextResponse.json({ version: 1, indexProducts: snapshot?.indexProducts ?? null,
    asOf: snapshot?.generatedAt ?? null, status: snapshot ? indexFreshness(snapshot.generatedAt) : "unavailable" }, {
    status: snapshot ? 200 : 503,
    headers: { "Cache-Control": snapshot ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store" },
  });
}
