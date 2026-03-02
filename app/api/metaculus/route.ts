import { NextRequest, NextResponse } from "next/server";
import type { MetaculusQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MetaculusRawQuestion {
  id: number;
  title: string;
  page_url?: string;
  url?: string;
  resolution_criteria?: string;
  community_prediction?: {
    full?: {
      q2?: number;
    };
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ questions: [] });
  }

  try {
    const search = encodeURIComponent(q);
    const url =
      `https://www.metaculus.com/api2/questions/` +
      `?search=${search}&status=open&format=json&limit=3`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ questions: [] });
    }

    const json = await res.json();
    const results: MetaculusRawQuestion[] = json?.results ?? [];

    const questions: MetaculusQuestion[] = results
      .filter((q) => q.id && q.title)
      .map((q) => ({
        id: q.id,
        title: q.title,
        url:
          q.page_url ??
          q.url ??
          `https://www.metaculus.com/questions/${q.id}/`,
        communityMedian: q.community_prediction?.full?.q2 ?? null,
        resolutionCriteria: q.resolution_criteria ?? "",
      }));

    return NextResponse.json(
      { questions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[/api/metaculus]", err);
    return NextResponse.json({ questions: [] });
  }
}
