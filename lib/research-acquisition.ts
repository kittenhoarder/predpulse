import { fetchWithTimeout } from "./fetch-utils";
import type { GammaMarket } from "./types";
import type { ResearchDigest } from "./research";

/** Publisher-only follow-up; eight bounded lookups, oldest check first. */
export async function refreshTrackedContracts(previous: ResearchDigest | null): Promise<{ markets: GammaMarket[]; attemptedIds: string[] }> {
  const rows = [...(previous?.contracts ?? [])].sort((a, b) =>
    Date.parse(a.checkedAt ?? a.firstCapturedAt) - Date.parse(b.checkedAt ?? b.firstCapturedAt) || a.marketId.localeCompare(b.marketId)).slice(0, 8);
  const results: GammaMarket[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const batch = await Promise.allSettled(rows.slice(i, i + 2).map(async (row) => {
      const response = await fetchWithTimeout(`https://gamma-api.polymarket.com/markets/${row.marketId}`, undefined, 5000);
      if (!response.ok) return null;
      const text = await response.text();
      if (Buffer.byteLength(text) > 100_000) return null;
      const market = JSON.parse(text) as GammaMarket;
      return market.id === row.marketId ? market : null;
    }));
    for (const result of batch) if (result.status === "fulfilled" && result.value) results.push(result.value);
  }
  return { markets: results, attemptedIds: rows.map((row) => row.marketId) };
}
