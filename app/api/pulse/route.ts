import { NextResponse } from "next/server";
import { getAllMarkets, getCoreIndexMarkets } from "@/lib/get-markets";
import { computePulse } from "@/lib/pulse";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import type { PulseApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
const INDEX_CORE3_ENABLED =
  process.env.INDEX_CORE3_ENABLED === "1" || process.env.INDEX_CORE3_ENABLED === "true";

export async function GET() {
  try {
    const snapshot = await loadPublishedSnapshot();
    const markets = snapshot ? null : INDEX_CORE3_ENABLED ? await getCoreIndexMarkets() : await getAllMarkets();
    const indices = snapshot?.pulse ?? computePulse(markets!);

    const body: PulseApiResponse = {
      indices,
      computedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Deprecation": "true",
        "Sunset": new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
        "Link": '</api/indices?family=directional>; rel=\"successor-version\"',
        "X-Pulse-Model": INDEX_CORE3_ENABLED ? "directional-core3" : "directional-full",
        "X-Pulse-Compute-Mode": INDEX_CORE3_ENABLED ? "low-compute" : "standard",
      },
    });
  } catch (err) {
    console.error("[/api/pulse]", err);
    return NextResponse.json(
      { error: "Failed to compute pulse indices" },
      { status: 500 },
    );
  }
}
