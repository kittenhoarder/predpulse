import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/get-markets";
import { publishSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.SNAPSHOT_PUBLISH_SECRET;
  const presented = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !presented) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return NextResponse.json({ error: "Blob store is not configured" }, { status: 503 });
  }
  try {
    const sources = await fetchAllSources({ fresh: true });
    const snapshot = await publishSnapshot(sources);
    return NextResponse.json({ generatedAt: snapshot.generatedAt, publishedMarkets: snapshot.markets.length,
      sourceCounts: snapshot.sourceCounts });
  } catch (error) {
    console.error("[publish] snapshot failed", error);
    return NextResponse.json({ error: "Snapshot publication failed; previous generation retained" }, { status: 503 });
  }
}
