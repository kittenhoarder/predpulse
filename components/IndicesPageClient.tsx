"use client";
import useSWR from "swr";
import type { IndexProductsDigest } from "@/lib/index-products";
import IndicesSection from "./IndicesSection";
async function fetchIndices(url: string): Promise<{ indexProducts: IndexProductsDigest | null }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Saved indices unavailable");
  return response.json();
}
export default function IndicesPageClient() {
  const { data, isLoading, error } = useSWR("/api/indices", fetchIndices, {
    revalidateOnFocus: false, shouldRetryOnError: false, refreshInterval: 0,
  });
  return <>{error && <p role="status" className="mb-4 text-xs text-muted-foreground">Saved index publication is unavailable.</p>}
    <IndicesSection digest={data?.indexProducts ?? null} full loading={isLoading} /></>;
}
