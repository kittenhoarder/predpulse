import { NextResponse } from "next/server";
import { computeDirectionalBacktest } from "@/lib/backtest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = computeDirectionalBacktest();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/indices/backtest]", err);
    return NextResponse.json({ error: "Failed to compute backtest" }, { status: 500 });
  }
}
