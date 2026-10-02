"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { EventMonitor } from "@/lib/event-monitor";
import type { ProcessedMarket } from "@/lib/types";
import {
  getWatchlist,
  savedMarketKey,
  toggleWatchlist,
  WATCHLIST_CHANGE,
} from "@/lib/watchlist";
import SectionHeader from "./SectionHeader";
import MoveEvidence from "./MoveEvidence";
import { ClosingSoon } from "./ClosingSoon";

const LAST_SEEN_KEY = "predpulse:monitor:last-seen:v1";
type PriceRecord = { price: number; basis: string; outcome: string };
type Visit = { generatedAt: string; prices: Record<string, PriceRecord> };

function visitFrom(markets: ProcessedMarket[], generatedAt: string): Visit {
  return {
    generatedAt,
    prices: Object.fromEntries(
      markets.map((market) => [
        savedMarketKey(market.source, market.id),
        {
          price: market.currentPrice,
          basis: market.source === "kalshi" ? "YES ask" : "market price",
          outcome: market.outcomes[0] ?? "YES",
        },
      ]),
    ),
  };
}

function readVisit(): Visit | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(LAST_SEEN_KEY) ?? "null",
    ) as Visit | null;
    return value &&
      Number.isFinite(Date.parse(value.generatedAt)) &&
      value.prices &&
      typeof value.prices === "object"
      ? value
      : null;
  } catch {
    return null;
  }
}

function marketUrl(source: string, id: string): string {
  return `/events/${source}/${encodeURIComponent(id)}`;
}

export default function EventMonitorSection({
  monitor,
  markets,
  generatedAt,
  status,
  showClosing = true,
}: {
  showClosing?: boolean;
  monitor: EventMonitor;
  markets: ProcessedMarket[];
  generatedAt: string;
  status: "hourly" | "delayed" | "stale";
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [previousVisit, setPreviousVisit] = useState<Visit | null>(null);
  const [expanded, setExpanded] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const updateSaved = () => setSaved(getWatchlist());
    updateSaved();
    window.addEventListener(WATCHLIST_CHANGE, updateSaved);
    window.addEventListener("storage", updateSaved);
    return () => {
      window.removeEventListener(WATCHLIST_CHANGE, updateSaved);
      window.removeEventListener("storage", updateSaved);
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) {
      setPreviousVisit(readVisit());
      loaded.current = true;
    }
    if (status !== "hourly") return;
    try {
      localStorage.setItem(
        LAST_SEEN_KEY,
        JSON.stringify(visitFrom(markets, generatedAt)),
      );
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
  }, [markets, generatedAt, status]);

  const watched = useMemo(
    () =>
      markets.filter(
        (m) => saved.has(savedMarketKey(m.source, m.id)) || saved.has(m.id),
      ),
    [markets, saved],
  );
  const unseenCount = Math.max(0, saved.size - watched.length);
  return (
    <section
      id="monitor"
      aria-labelledby="monitor-title"
      className="space-y-10"
    >
      {saved.size > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <SectionHeader id="saved" title="Your saved markets" />
          {watched.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Saved markets are outside this selected snapshot. They remain
              saved.
            </p>
          )}
          <div className="space-y-4">
            {watched.slice(0, 4).map((market) => {
              const past =
                previousVisit?.prices[savedMarketKey(market.source, market.id)];
              const basis =
                market.source === "kalshi" ? "YES ask" : "market price";
              const reliable =
                market.source !== "kalshi" ||
                market.kalshiAskChangeAvailable === true;
              const comparable =
                status === "hourly" &&
                reliable &&
                past?.basis === basis &&
                past.outcome === (market.outcomes[0] ?? "YES") &&
                Date.parse(previousVisit?.generatedAt ?? "") <
                  Date.parse(generatedAt) &&
                Number.isFinite(past.price);
              const delta = comparable
                ? market.currentPrice - past.price
                : null;
              return (
                <div
                  key={savedMarketKey(market.source, market.id)}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <Link
                    prefetch={false}
                    href={marketUrl(market.source, market.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center"
                  >
                    <span className="line-clamp-2">{market.question}</span>
                  </Link>
                  <span className="w-28 shrink-0 text-right tabular-nums text-muted-foreground">
                    {delta === null
                      ? "No comparable earlier quote"
                      : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp since last visit`}
                  </span>
                </div>
              );
            })}
          </div>
          {unseenCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {unseenCount} saved markets outside this selected snapshot.
            </p>
          )}
        </section>
      )}
      <section>
        <SectionHeader
          id="moves"
          title="What changed"
          headingId="monitor-title"
        />
        {status === "stale" ? (
          <p className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
            The snapshot is stale. Current movers are withheld until publishing
            resumes.
          </p>
        ) : !monitor.items.length ? (
          <p className="text-sm text-muted-foreground">
            No policy or economy moves passed the evidence checks in this
            snapshot.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {monitor.items.slice(0, expanded ? 12 : 6).map((item) => {
              const active =
                saved.has(savedMarketKey(item.source, item.marketId)) ||
                saved.has(item.marketId);
              const market = markets.find(
                (m) => m.source === item.source && m.id === item.marketId,
              );
              return (
                <article
                  key={savedMarketKey(item.source, item.marketId)}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-5 sm:p-6"
                >
                  <Link
                    href={marketUrl(item.source, item.marketId)}
                    prefetch={false}
                    className="flex min-h-11 items-center text-sm font-medium"
                  >
                    <span className="line-clamp-2">{item.question}</span>
                  </Link>
                  <div className="w-20 text-right tabular-nums">
                    <p className="text-lg font-semibold">
                      {item.currentProbability.toFixed(1)}%
                    </p>
                    <p
                      className={`mt-1 text-xs ${item.change24h > 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {item.change24h > 0 ? "+" : ""}
                      {item.change24h.toFixed(1)} pp
                    </p>
                  </div>
                  <p className="self-center text-xs text-muted-foreground">
                    {item.category}
                    {market
                      ? ` · closes ${new Date(market.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : ""}
                  </p>
                  <div className="flex justify-end gap-4">
                    <MoveEvidence
                      item={item}
                      market={market}
                      asOf={monitor.asOf}
                    />
                    <button
                      type="button"
                      aria-label={`${active ? "Remove" : "Save"} ${item.question}`}
                      aria-pressed={active}
                      className="control rounded-full text-muted-foreground"
                      onClick={() =>
                        toggleWatchlist(item.marketId, item.source)
                      }
                    >
                      <Star
                        className={`h-4 w-4 ${active ? "fill-primary text-primary" : ""}`}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {status !== "stale" && monitor.items.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-3 min-h-11 text-xs text-primary"
          >
            {expanded
              ? "Show fewer moves"
              : `Show all ${monitor.items.length} moves`}
          </button>
        )}
      </section>
      {showClosing && (
        <ClosingSoon markets={markets} generatedAt={generatedAt} />
      )}
    </section>
  );
}
