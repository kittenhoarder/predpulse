import { NextResponse } from "next/server";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import { computeDirectionalBacktest } from "@/lib/backtest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = computeDirectionalBacktest((await loadPublishedSnapshot())?.research ?? null);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[/api/indices/backtest]", err);
    return NextResponse.json({ error: "Failed to compute backtest" }, { status: 500 });
  }
}
