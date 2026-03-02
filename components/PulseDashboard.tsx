"use client";

import useSWR from "swr";
import { useState } from "react";
import type { PulseApiResponse, PulseIndex } from "@/lib/types";
import { fetchPulseApi } from "@/lib/pulse-client";
import PulseCard from "./PulseCard";

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
      refreshInterval: 120_000,
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
          {error
            ? "Still warming up — retrying automatically."
            : "Data is loading (MVP cold start). Caching improvements are in progress."}
        </div>
      )}

      {/* Scroll sentinel — observed by HeaderBar to trigger compact card display */}
      <div id="pulse-sentinel" className="h-px w-full" aria-hidden="true" />
    </section>
  );
}
