"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NAV_V2 } from "@/lib/bootstrap";
import { briefingTiles } from "@/lib/nav";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import LegacyHomeDashboard from "./LegacyHomeDashboard";
import SectionHeader from "./SectionHeader";
import NewsroomSection from "./NewsroomSection";
import ExplorePanel from "./ExplorePanel";
import ContinueLink from "./ContinueLink";

export default function HomeDashboard() {
  return NAV_V2 ? <TodayDashboard /> : <LegacyHomeDashboard />;
}
function TodayDashboard() {
  const { data, now, isLoading, status } = useBootstrap();
  const tiles = briefingTiles(data, now);
  return (
    <div className="space-y-10 md:space-y-16">
      <section id="monitor" aria-labelledby="briefing-title">
        <SectionHeader
          id="moves"
          title="Today's briefing"
          headingId="briefing-title"
        />
        {isLoading && !data ? (
          <div
            className="grid gap-3 md:grid-cols-3"
            role="status"
            aria-label="Loading briefing"
          >
            {[0, 1, 2].map((id) => (
              <div
                key={id}
                className="h-24 rounded-2xl bg-muted/50 motion-safe:animate-pulse md:h-44"
              />
            ))}
          </div>
        ) : tiles.length ? (
          <div
            className={`grid gap-3 ${tiles.length === 3 ? "md:grid-cols-3" : tiles.length === 2 ? "md:grid-cols-2" : ""}`}
          >
            {tiles.map((tile) => (
              <Link
                href={tile.href}
                key={tile.id}
                prefetch={false}
                className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 active:bg-muted md:min-h-44 md:items-start"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{tile.name}</p>
                  <p className="mt-2 font-mono text-2xl font-medium tracking-tight text-primary md:text-3xl">
                    {tile.value}
                  </p>
                  <p className="mt-2 line-clamp-1 text-xs text-muted-foreground md:line-clamp-2">
                    {tile.context}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <p
            role="status"
            className="rounded-2xl border border-border p-5 text-sm text-muted-foreground"
          >
            {!data
              ? "Snapshot unavailable"
              : status === "stale"
                ? "Last-known snapshot — current briefing unavailable"
                : "No qualifying readings in this snapshot"}
          </p>
        )}
        <Link
          href="/moves"
          className="mt-3 inline-flex min-h-11 items-center text-xs text-primary"
        >
          All moves →
        </Link>
      </section>
      <NewsroomSection initialMarkets={data?.markets} />
      <section aria-labelledby="explore-title">
        <SectionHeader
          id="thesis"
          title="Explore Predpulse"
          headingId="explore-title"
        />
        <ExplorePanel compact />
      </section>
      <ContinueLink path="/" />
    </div>
  );
}
