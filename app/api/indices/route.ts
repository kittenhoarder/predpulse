import { NextRequest, NextResponse } from "next/server";
import { getAllMarkets } from "@/lib/get-markets";
import { computeIndices } from "@/lib/indices";
import { isIndexPersistenceEnabled } from "@/lib/index-store";
import type { IndexFamily, IndexHorizon, IndexSourceScope, IndicesApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_FAMILY = new Set(["all", "directional", "liquidity", "divergence", "certainty"]);
const VALID_HORIZON = new Set(["24h", "7d"]);
const VALID_SCOPE = new Set(["core", "all", "polymarket", "kalshi", "manifold"]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const familyRaw = searchParams.get("family") ?? "all";
    const horizonRaw = searchParams.get("horizon") ?? "24h";
    const sourceScopeRaw = searchParams.get("sourceScope") ?? "core";

    const family = (VALID_FAMILY.has(familyRaw) ? familyRaw : "all") as IndexFamily | "all";
    const horizon = (VALID_HORIZON.has(horizonRaw) ? horizonRaw : "24h") as IndexHorizon;
    const sourceScope = (VALID_SCOPE.has(sourceScopeRaw) ? sourceScopeRaw : "core") as IndexSourceScope;

    const markets = await getAllMarkets();
    const result = await computeIndices(markets, {
      family,
      horizon,
      sourceScope,
      persist: isIndexPersistenceEnabled(),
    });

    const body: IndicesApiResponse = {
      indices: result.indices,
      family,
      horizon,
      sourceScope,
      computedAt: result.computedAt,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[/api/indices]", err);
    return NextResponse.json({ error: "Failed to compute indices" }, { status: 500 });
  }
}
