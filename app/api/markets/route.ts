import { NextRequest, NextResponse } from "next/server";
import { getMarkets } from "@/lib/get-markets";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import { marketsFromSnapshot, snapshotAgeStatus } from "@/lib/snapshot-response";
import type { SortMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Unknown sort values fall through to the default case in sortMarkets() → "movers"
    const sort = (searchParams.get("sort") ?? "movers") as SortMode;
    const category = searchParams.get("category") ?? "all";
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
    const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
    const limit = [25, 50, 100].includes(rawLimit) ? rawLimit : undefined;

    // Watchlist IDs passed as comma-separated string from client localStorage
    const watchlistParam = searchParams.get("watchlist") ?? "";
    const watchlistIds = watchlistParam ? watchlistParam.split(",").filter(Boolean) : [];

    const sourceParam = searchParams.get("source") ?? "all";
    const source = (["polymarket", "kalshi", "manifold", "all"].includes(sourceParam)
      ? sourceParam
      : "all") as "polymarket" | "kalshi" | "manifold" | "all";

    // Default true — pass hideSmall=false explicitly to reveal small markets
    const hideSmall = searchParams.get("hideSmall") !== "false";

    const snapshot = await loadPublishedSnapshot();
    const data = snapshot
      ? await marketsFromSnapshot(snapshot, { sort, category, offset, limit, watchlistIds, source, hideSmall })
      : await getMarkets({ sort, category, offset, limit, watchlistIds, source, hideSmall });

    return NextResponse.json(data, {
      headers: {
        // CDN: serve up to 60 s; allow stale for 5 min while revalidating.
        // Note: manifold fetch cache revalidates every 300 s (aligned with stale-while-revalidate).
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        ...(snapshot ? { "X-Snapshot-Status": snapshotAgeStatus(snapshot.generatedAt) } : {}),
      },
    });
  } catch (err) {
    console.error("[/api/markets]", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
