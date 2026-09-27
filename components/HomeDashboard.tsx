"use client";

import { useMemo } from "react";
import useSWR from "swr";
import NewsroomSection from "./NewsroomSection";
import PulseDashboard from "./PulseDashboard";
import MarketTable from "./MarketTable";
import ObservedMoves from "./ObservedMoves";
import EventMonitorSection from "./EventMonitorSection";
import MetaNote from "./MetaNote";
import type { MarketsApiResponse, PulseApiResponse, ProcessedMarket } from "@/lib/types";
import type { ObservationDigest } from "@/lib/observations";
import type { EventMonitor } from "@/lib/event-monitor";

interface Bootstrap {
  markets: MarketsApiResponse;
  pulse: PulseApiResponse;
  generatedAt: string;
  status: "hourly" | "delayed" | "stale";
  sourceCounts: Record<ProcessedMarket["source"], number>;
  observations?: ObservationDigest | null;
  monitor?: EventMonitor | null;
  monitorMarkets?: ProcessedMarket[];
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
  const monitorMarkets = useMemo(() => data ? [...data.markets.markets, ...(data.monitorMarkets ?? [])] : [], [data]);

  return (
    <>
      {isLoading ? (
        <div className="py-8 text-sm text-muted-foreground" role="status">Loading saved market snapshot…</div>
      ) : (
        <>
          {error && <div className="text-xs text-muted-foreground py-2">Saved snapshot unavailable; loading available sources.</div>}
          <NewsroomSection initialMarkets={data?.markets} />
          {data && (
            <div className="flex items-center justify-end gap-1 py-2 text-[11px] text-muted-foreground" role="status">
              <span>{data.status === "hourly" ? "Snapshot" : data.status === "delayed" ? "Update delayed" : "Last-known snapshot"} · {new Date(data.generatedAt).toLocaleString()}</span>
              <MetaNote kind="freshness" title="Snapshot freshness">
                <p>Prices and changes are from the dated snapshot, not a live quote. Publishing is scheduled hourly; a delayed or stale label means the latest successful publication is older.</p>
                <p>Selected market universe: {data.sourceCounts.polymarket.toLocaleString()} Polymarket, {data.sourceCounts.kalshi.toLocaleString()} Kalshi and {data.sourceCounts.manifold.toLocaleString()} Manifold markets examined.</p>
              </MetaNote>
            </div>
          )}
          {data?.monitor && <EventMonitorSection monitor={data.monitor} markets={monitorMarkets} generatedAt={data.generatedAt} status={data.status} />}
          {data && data.status !== "stale" && <ObservedMoves digest={data.observations} status={data.status} />}
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
