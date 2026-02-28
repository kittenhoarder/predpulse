import { NextRequest, NextResponse } from "next/server";
import { refreshMarketCache } from "@/lib/get-markets";

/**
 * POST /api/cron/refresh
 *
 * Called by Vercel Cron every 15 minutes (see vercel.json).
 * Protected by CRON_SECRET to prevent unauthorised cache invalidation.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  try {
    const markets = await refreshMarketCache();
    const elapsedMs = Date.now() - startMs;
    console.log(`[cron/refresh] Cached ${markets.length} markets in ${elapsedMs}ms`);
    return NextResponse.json({ ok: true, markets: markets.length, elapsedMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/refresh] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
