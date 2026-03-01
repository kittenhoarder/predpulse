import { NextRequest, NextResponse } from "next/server";
import { upsertResolvedOutcomes, type ResolvedOutcomeRow } from "@/lib/index-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    const parsed: ResolvedOutcomeRow[] = rows
      .map((row: Record<string, unknown>) => {
        const sourceRaw = String(row.source ?? "");
        if (!["polymarket", "kalshi", "manifold"].includes(sourceRaw)) return null;

        const outcomeYes = Number(row.outcomeYes);
        if (!(outcomeYes === 0 || outcomeYes === 1)) return null;

        const polarityRaw = Number(row.polarity);
        const polarity = polarityRaw === -1 ? -1 : polarityRaw === 1 ? 1 : undefined;

        return {
          marketId: String(row.marketId ?? ""),
          source: sourceRaw as "polymarket" | "kalshi" | "manifold",
          category: String(row.category ?? "general"),
          outcomeYes: outcomeYes as 0 | 1,
          resolvedAt: String(row.resolvedAt ?? new Date().toISOString()),
          note: row.note ? String(row.note) : undefined,
          ...(polarity !== undefined && { polarity }),
        } satisfies ResolvedOutcomeRow;
      })
      .filter((row: ResolvedOutcomeRow | null): row is ResolvedOutcomeRow => row !== null && row.marketId.length > 0);

    upsertResolvedOutcomes(parsed);

    return NextResponse.json({ inserted: parsed.length });
  } catch (err) {
    console.error("[/api/indices/outcomes]", err);
    return NextResponse.json({ error: "Failed to ingest outcomes" }, { status: 400 });
  }
}
