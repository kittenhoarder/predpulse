"use client";

import useSWR from "swr";
import type { PulseApiResponse, PulseIndex } from "@/lib/types";
import PulseCard from "./PulseCard";
import { Activity } from "lucide-react";

async function pulseFetcher(url: string): Promise<PulseApiResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface PulseDashboardProps {
  initialData?: PulseApiResponse;
  /** When true, renders larger cards (for the /pulse dedicated page) */
  large?: boolean;
}

export default function PulseDashboard({ initialData, large = false }: PulseDashboardProps) {
  const { data, isLoading } = useSWR<PulseApiResponse>(
    "/api/pulse",
    pulseFetcher,
    {
      fallbackData: initialData,
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const indices: PulseIndex[] = data?.indices ?? [];

  return (
    <section className="pt-3 pb-3">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold tracking-tight">Predpulse</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Proprietary
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time category sentiment across Polymarket &amp; Kalshi
          </p>
        </div>
        {data?.computedAt && (
          <span className="text-[10px] text-muted-foreground/50 hidden sm:block">
            Updated {new Date(data.computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Skeleton loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 h-44 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Cards grid — 2xl: all 8 cards in a single row */}
      {!isLoading && indices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
          {indices.map((index) => (
            <PulseCard key={index.category} index={index} large={large} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && indices.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Pulse data unavailable — market data is loading.
        </div>
      )}
    </section>
  );
}
