import { NextRequest, NextResponse } from "next/server";
import { getMarkets } from "@/lib/get-markets";
import type { SortMode } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Unknown sort values fall through to the default case in sortMarkets() → "movers"
    const sort = (searchParams.get("sort") ?? "movers") as SortMode;
    const category = searchParams.get("category") ?? "all";
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // Watchlist IDs passed as comma-separated string from client localStorage
    const watchlistParam = searchParams.get("watchlist") ?? "";
    const watchlistIds = watchlistParam ? watchlistParam.split(",").filter(Boolean) : [];

    const sourceParam = searchParams.get("source") ?? "all";
    const source = (["polymarket", "kalshi", "manifold", "all"].includes(sourceParam)
      ? sourceParam
      : "all") as "polymarket" | "kalshi" | "manifold" | "all";

    const data = await getMarkets({ sort, category, offset, watchlistIds, source });

    return NextResponse.json(data, {
      headers: {
        // CDN: serve up to 60 s; allow stale for 5 min while revalidating.
        // Note: manifold fetch cache revalidates every 300 s (aligned with stale-while-revalidate).
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[/api/markets]", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
