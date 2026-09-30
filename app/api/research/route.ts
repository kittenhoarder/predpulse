import { NextRequest, NextResponse } from "next/server";
import { loadPublishedSnapshot, loadHistoricalSnapshot } from "@/lib/snapshot";
import { researchEvaluation } from "@/lib/research-evaluation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const at = request.nextUrl.searchParams.get("at");
  if (at && (at.length > 40 || !Number.isFinite(Date.parse(at)))) return NextResponse.json({ error: "Invalid generation time" }, { status: 400 });
  try {
    const snapshot = at ? await loadHistoricalSnapshot(at) : await loadPublishedSnapshot();
    if (!snapshot?.research) return NextResponse.json({ error: "No captured evidence for this generation" }, { status: 404 });
    return NextResponse.json({ generatedAt: snapshot.generatedAt, research: snapshot.research, evaluation: researchEvaluation(snapshot.research) }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Content-Disposition": `attachment; filename="predpulse-evidence-${snapshot.generatedAt.slice(0, 10)}.json"` },
    });
  } catch {
    return NextResponse.json({ error: "Evidence temporarily unavailable" }, { status: 503 });
  }
}
