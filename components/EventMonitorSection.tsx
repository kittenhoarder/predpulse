"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { EventMonitor } from "@/lib/event-monitor";
import type { ProcessedMarket } from "@/lib/types";
import { getWatchlist, savedMarketKey, toggleWatchlist, WATCHLIST_CHANGE } from "@/lib/watchlist";
import MetaNote from "./MetaNote";

const LAST_SEEN_KEY = "predpulse:monitor:last-seen:v1";
const topics = new Set(["economics", "politics", "geopolitics"]);
type PriceRecord = { price: number; basis: string; outcome: string };
type Visit = { generatedAt: string; prices: Record<string, PriceRecord> };

function visitFrom(markets: ProcessedMarket[], generatedAt: string): Visit {
  return {
    generatedAt,
    prices: Object.fromEntries(markets.map((market) => [savedMarketKey(market.source, market.id), {
      price: market.currentPrice,
      basis: market.source === "kalshi" ? "YES ask" : "market price",
      outcome: market.outcomes[0] ?? "YES",
    }])),
  };
}

function readVisit(): Visit | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? "null") as Visit | null;
    return value && Number.isFinite(Date.parse(value.generatedAt)) && value.prices && typeof value.prices === "object"
      ? value : null;
  } catch { return null; }
}

function sourceName(source: string): string {
  return source === "polymarket" ? "Polymarket" : "Kalshi";
}

function marketUrl(source: string, id: string): string {
  return `/events/${source}/${encodeURIComponent(id)}`;
}

export default function EventMonitorSection({ monitor, markets, generatedAt, status }: {
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
    try { localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(visitFrom(markets, generatedAt))); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }, [markets, generatedAt, status]);

  const watched = useMemo(() => markets.filter((m) => saved.has(savedMarketKey(m.source, m.id)) || saved.has(m.id)), [markets, saved]);
  const unseenCount = Math.max(0, saved.size - watched.length);
  const closing = useMemo(() => {
    const now = Date.parse(generatedAt);
    const seen = new Set<string>();
    return markets.filter((m) => (m.source === "polymarket" || m.source === "kalshi") && m.categoryslugs.some((slug) => topics.has(slug)))
      .filter((m) => {
        const close = Date.parse(m.endDate);
        const key = `${m.source}:${m.eventSlug}`;
        if (!Number.isFinite(close) || close <= now || close > now + 7 * 86400_000 || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate)).slice(0, 3);
  }, [markets, generatedAt]);

  return (
    <section id="monitor" aria-labelledby="monitor-title" className="scroll-mt-16 py-4">
      {saved.size > 0 && (
        <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Your saved markets</h2>
            <MetaNote kind="context" title="Your saved markets">
              <p>Saved markets and the last quote you saw stay on this device. Changes compare the same outcome and price basis against your previous visit, when both snapshots are comparable.</p>
              <p>Saved markets outside this selected snapshot remain saved, but cannot show a comparison here.</p>
            </MetaNote>
          </div>
          {watched.length === 0 && <p className="text-xs text-muted-foreground">Saved markets are outside this selected snapshot. They remain saved.</p>}
          <div className="divide-y divide-border/70">
            {watched.slice(0, 4).map((market) => {
              const past = previousVisit?.prices[savedMarketKey(market.source, market.id)];
              const basis = market.source === "kalshi" ? "YES ask" : "market price";
              const reliable = market.source !== "kalshi" || market.kalshiAskChangeAvailable === true;
              const comparable = status === "hourly" && reliable && past?.basis === basis &&
                past.outcome === (market.outcomes[0] ?? "YES") &&
                Date.parse(previousVisit?.generatedAt ?? "") < Date.parse(generatedAt) && Number.isFinite(past.price);
              const delta = comparable ? market.currentPrice - past.price : null;
              return (
                <div key={savedMarketKey(market.source, market.id)} className="flex items-start justify-between gap-3 py-2 text-xs">
                  <Link href={marketUrl(market.source, market.id)} className="line-clamp-2 hover:underline">{market.question}</Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {delta === null ? "No comparable earlier quote" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp since last visit`}
                  </span>
                </div>
              );
            })}
          </div>
          {unseenCount > 0 && <p className="pt-2 text-[11px] text-muted-foreground">{unseenCount} saved market{unseenCount === 1 ? " is" : "s are"} outside this selected snapshot.</p>}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Policy &amp; economy</p>
          <h2 id="monitor-title" className="text-xl font-semibold tracking-tight">What changed</h2>
        </div>
        <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <span>{monitor.eligible} qualifying / {monitor.examined.toLocaleString()} screened</span>
          <MetaNote kind="evidence" title="How moves qualify">
            <p>Politics, economics and geopolitics markets are checked against price comparability, volume, liquidity or open interest, quoted spread and time until close. Only one outcome per source event is selected.</p>
            <p>This is a sampled venue universe. Contracts across different venues are not treated as equivalent. Price changes do not explain causes or predict outcomes.</p>
          </MetaNote>
        </div>
      </div>
      {status === "stale" ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">The snapshot is stale. Current movers are withheld until publishing resumes.</p>
      ) : monitor.items.length === 0 ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No policy or economy moves passed the evidence checks in this snapshot. Explore the wider market list below.</p>
      ) : (
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card">
          {monitor.items.slice(0, expanded ? 12 : 6).map((item) => {
            const active = saved.has(savedMarketKey(item.source, item.marketId)) || saved.has(item.marketId);
            const market = markets.find((m) => m.source === item.source && m.id === item.marketId);
            return (
              <article key={savedMarketKey(item.source, item.marketId)} className="flex items-start gap-3 p-3.5 sm:p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[11px] text-muted-foreground">{item.category} · {sourceName(item.source)} · {item.outcomeLabel} {item.priceBasis}</div>
                  <Link href={marketUrl(item.source, item.marketId)} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">{item.question}</Link>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">Spread {item.spreadPoints.toFixed(1)} pp · {item.source === "kalshi" ? `${Math.round(item.volume24h).toLocaleString()} contracts` : `$${Math.round(item.volume24h).toLocaleString()}`} in 24h{market && Number.isFinite(Date.parse(market.endDate)) ? ` · closes ${new Date(market.endDate).toLocaleDateString()}` : ""}</div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="text-sm font-semibold">{item.currentProbability.toFixed(1)}%</p>
                  <p className={`text-xs ${item.change24h > 0 ? "text-emerald-500" : "text-rose-500"}`}>{item.change24h > 0 ? "+" : ""}{item.change24h.toFixed(1)} pp / 24h</p>
                  <button type="button" aria-label={`${active ? "Remove" : "Save"} ${item.question}`} aria-pressed={active}
                    className="mt-2 rounded p-1 text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => toggleWatchlist(item.marketId, item.source)}>
                    <Star className={`ml-auto h-4 w-4 ${active ? "fill-primary text-primary" : ""}`} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {status !== "stale" && monitor.items.length > 6 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-2 text-xs font-medium text-primary hover:underline">
          {expanded ? "Show fewer moves" : `Show all ${monitor.items.length} moves`}
        </button>
      )}

      {closing.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Markets closing within seven days</h3>
          <div className="flex flex-wrap gap-2">
            {closing.map((market) => (
              <Link key={savedMarketKey(market.source, market.id)} href={marketUrl(market.source, market.id)}
                className="max-w-full rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/50">
                <span className="block max-w-72 truncate font-medium">{market.question}</span>
                <span className="text-muted-foreground">{sourceName(market.source)} · closes {new Date(market.endDate).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
