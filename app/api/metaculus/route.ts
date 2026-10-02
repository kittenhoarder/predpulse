import { NextRequest, NextResponse } from "next/server";
import { searchMetaculusQuestions, SEARCH_PROXY_CACHE } from "@/lib/metaculus";
import { normalizeSearchQuery } from "@/lib/search-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = normalizeSearchQuery(raw);

  if (!q) {
    return NextResponse.json(
      { questions: [] },
      { headers: { "Cache-Control": SEARCH_PROXY_CACHE } },
    );
  }

  const questions = await searchMetaculusQuestions(q);
  return NextResponse.json(
    { questions },
    { headers: { "Cache-Control": SEARCH_PROXY_CACHE } },
  );
}
