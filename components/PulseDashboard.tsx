"use client";

import useSWR from "swr";
import { useState } from "react";
import type { PulseApiResponse, PulseIndex } from "@/lib/types";
import { fetchPulseApi } from "@/lib/pulse-client";
import PulseCard from "./PulseCard";
import MetaNote from "./MetaNote";

export const PULSE_SWR_KEY = "/api/pulse";

interface PulseDashboardProps {
  initialData?: PulseApiResponse;
  /** When true, renders larger cards (for the /pulse dedicated page) */
  large?: boolean;
}

export default function PulseDashboard({ initialData, large = false }: PulseDashboardProps) {
  const { data, isLoading, error } = useSWR<PulseApiResponse>(
    PULSE_SWR_KEY,
    fetchPulseApi,
    {
      fallbackData: initialData,
      revalidateOnMount: !initialData,
      revalidateIfStale: !initialData,
      refreshInterval: 300_000,
      revalidateOnFocus: false,
    }
  );

  const indices: PulseIndex[] = data?.indices ?? [];
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleToggleDetails = () => {
    setDetailsOpen((prev) => !prev);
  };

  return (
    <section className="pt-3 pb-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Pulse indices</h2>
        <MetaNote kind="context" title="About Pulse indices">
          <p>Category scores summarize 24-hour market direction from selected contracts. A score near 50 is neutral; it is not the probability of an event.</p>
          <p>The score blends available market signals, including momentum, flow and breadth. Tap a card for its component scores and underlying markets.</p>
        </MetaNote>
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

      {/* Cards grid */}
      {!isLoading && indices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
          {indices.map((index) => (
            <PulseCard
              key={index.category}
              index={index}
              large={large}
              showDetails={detailsOpen}
              onToggleDetails={handleToggleDetails}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && indices.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {error ? "Index data is unavailable. Retry by refreshing this page." : "No index data is available yet."}
        </div>
      )}

      {/* Scroll sentinel — observed by HeaderBar to trigger compact card display */}
      <div id="pulse-sentinel" className="h-px w-full" aria-hidden="true" />
    </section>
  );
}
