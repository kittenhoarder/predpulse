"use client";

import useSWR from "swr";
import NewsroomSection from "./NewsroomSection";
import PulseDashboard from "./PulseDashboard";
import MarketTable from "./MarketTable";
import ObservedMoves from "./ObservedMoves";
import type { MarketsApiResponse, PulseApiResponse, ProcessedMarket } from "@/lib/types";
import type { ObservationDigest } from "@/lib/observations";

interface Bootstrap {
  markets: MarketsApiResponse;
  pulse: PulseApiResponse;
  generatedAt: string;
  status: "hourly" | "delayed" | "stale";
  sourceCounts: Record<ProcessedMarket["source"], number>;
  observations?: ObservationDigest | null;
}

async function fetchBootstrap(url: string): Promise<Bootstrap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Snapshot unavailable: ${response.status}`);
  return response.json();
}

export default function HomeDashboard() {
  const { data, error, isLoading } = useSWR<Bootstrap>("/api/bootstrap", fetchBootstrap, {
    refreshInterval: 300_000, revalidateOnFocus: false, shouldRetryOnError: false,
  });

  return (
    <>
      {data && (
        <div className="text-xs text-muted-foreground py-2" role="status">
          {data.status === "hourly" ? "Hourly snapshot" : data.status === "delayed" ? "Update delayed" : "Last-known snapshot"}
          {" · "}{new Date(data.generatedAt).toLocaleString()}
          {" · "}Selected markets from P {data.sourceCounts.polymarket.toLocaleString()},
          {" "}K {data.sourceCounts.kalshi.toLocaleString()}, M {data.sourceCounts.manifold.toLocaleString()} observed
        </div>
      )}
      {/* News is independent and cannot block market data. */}
      {!isLoading && <NewsroomSection initialMarkets={data?.markets} />}
      {isLoading ? (
        <div className="py-8 text-sm text-muted-foreground" role="status">Loading saved market snapshot…</div>
      ) : (
        <>
          {error && <div className="text-xs text-muted-foreground py-2">Saved snapshot unavailable; loading available sources.</div>}
          {data && <ObservedMoves digest={data.observations} status={data.status} />}
          <PulseDashboard initialData={data?.pulse} />
          <div className="mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              {data?.status === "stale" ? "Last-known markets · historical changes" : "Markets"}
            </span>
          </div>
          <MarketTable initialData={data?.markets} />
        </>
      )}
    </>
  );
}
