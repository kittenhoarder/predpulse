import type { FredObservation } from "@/lib/types";

// Map from Predpulse category slug → list of FRED series to display
export const CATEGORY_FRED_MAP: Record<
  string,
  { seriesId: string; label: string; unit: string }[]
> = {
  economics: [
    { seriesId: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
    { seriesId: "CPIAUCSL", label: "CPI", unit: "" },
  ],
  politics: [
    { seriesId: "UNRATE", label: "Unemployment Rate", unit: "%" },
  ],
  science: [
    { seriesId: "NASDAQCOM", label: "NASDAQ Composite", unit: "" },
  ],
};

// Returns which FRED series apply to a given set of category slugs.
// Returns [] when none match (Macro section hidden for that market).
export function getFredSeriesForSlugs(
  categorySlugs: string[]
): { seriesId: string; label: string; unit: string }[] {
  for (const slug of categorySlugs) {
    const series = CATEGORY_FRED_MAP[slug.toLowerCase()];
    if (series) return series;
  }
  return [];
}

// Fetch up to 90 observations for a FRED series (ascending, missing values filtered).
// Requires NEXT_PUBLIC_FRED_API_KEY in env.
// Returns [] on any error — never throws.
export async function fetchFredSeries(
  seriesId: string
): Promise<FredObservation[]> {
  const apiKey = process.env.NEXT_PUBLIC_FRED_API_KEY;
  if (!apiKey) return [];

  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}&api_key=${apiKey}&limit=90&sort_order=desc&file_type=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();

    const observations: { date: string; value: string }[] =
      json?.observations ?? [];

    return observations
      .filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)))
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse(); // ascending for chart rendering
  } catch {
    return [];
  }
}
