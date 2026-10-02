"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import EventMonitorSection from "./EventMonitorSection";
import ObservedMoves from "./ObservedMoves";
import EventOutlooksSection from "./EventOutlooksSection";
import RelatedPairCard from "./RelatedPairCard";
import MarketTable from "./MarketTable";
import SectionHeader from "./SectionHeader";
import { ClosingSoon } from "./ClosingSoon";
export default function PillarDashboard({
  pillar,
}: {
  pillar: "moves" | "outlooks" | "markets";
}) {
  const { data, status, isLoading } = useBootstrap();
  const params = useSearchParams();
  const markets = useMemo(
    () =>
      data ? [...data.markets.markets, ...(data.monitorMarkets ?? [])] : [],
    [data],
  );
  if (!data)
    return (
      <div
        role="status"
        className="min-h-48 rounded-2xl border border-border p-5 text-sm text-muted-foreground"
      >
        {isLoading
          ? "Loading saved snapshot…"
          : "Snapshot unavailable. Try again shortly."}
      </div>
    );
  const currentStatus = status ?? "stale";
  if (pillar === "moves")
    return (
      <div className="space-y-10 md:space-y-16">
        {data.monitor ? (
          <EventMonitorSection
            monitor={data.monitor}
            markets={markets}
            generatedAt={data.generatedAt}
            status={currentStatus}
            showClosing={false}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No policy or economy moves in this snapshot.
          </p>
        )}
        <ObservedMoves digest={data.observations} status={currentStatus} />
        <ClosingSoon markets={markets} generatedAt={data.generatedAt} />
      </div>
    );
  if (pillar === "outlooks")
    return (
      <EventOutlooksSection
        outlooks={data.eventOutlooks ?? null}
        legacyDecision={data.decisionDistribution ?? null}
        status={currentStatus}
        bootstrap={data}
      />
    );
  return (
    <div className="space-y-10 md:space-y-16">
      <section id="across-venues">
        <SectionHeader id="across-venues" />
        {currentStatus !== "stale" && data.related?.items.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.related.items.slice(0, 2).map((pair) => (
              <RelatedPairCard
                key={pair.id}
                pair={pair}
                asOf={data.generatedAt}
                compact
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {currentStatus === "stale"
              ? "Current comparisons withheld for this stale publication."
              : "No qualifying venue comparisons in this snapshot."}
          </p>
        )}
      </section>
      <section id="market-list" data-market-list>
        <MarketTable
          key={params.get("sort") === "watchlist" ? "watchlist" : "movers"}
          initialSort={
            params.get("sort") === "watchlist" ? "watchlist" : "movers"
          }
          initialData={data.markets}
        />
      </section>
    </div>
  );
}
