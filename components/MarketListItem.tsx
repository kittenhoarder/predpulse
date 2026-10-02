"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Star, ChevronDown } from "lucide-react";
import type { ProcessedMarket } from "@/lib/types";
import { formatChange } from "@/lib/format";
import {
  getWatchlist,
  savedMarketKey,
  toggleWatchlist,
  WATCHLIST_CHANGE,
} from "@/lib/watchlist";
import MarketEvidence from "./MarketEvidence";
const ExpandedPanel = dynamic(() => import("./ExpandedPanel"), {
  loading: () => (
    <p role="status" className="p-5 text-sm text-muted-foreground">
      Loading market details…
    </p>
  ),
});
export default function MarketListItem({
  market,
}: {
  market: ProcessedMarket;
}) {
  const [expanded, setExpanded] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const update = () => {
      const ids = getWatchlist();
      setSaved(
        ids.has(savedMarketKey(market.source, market.id)) || ids.has(market.id),
      );
    };
    update();
    window.addEventListener(WATCHLIST_CHANGE, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(WATCHLIST_CHANGE, update);
      window.removeEventListener("storage", update);
    };
  }, [market.id, market.source]);
  const unavailable =
    market.source === "kalshi" && !market.kalshiAskChangeAvailable;
  return (
    <article className="min-w-0 bg-card">
      <div className="p-4">
        <button
          className="flex min-h-11 w-full items-start justify-between gap-4 text-left"
          aria-expanded={expanded}
          aria-label={`Expand ${market.question}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="line-clamp-2 text-sm font-medium">
            {market.question}
          </span>
          <span className="w-16 shrink-0 text-right text-lg font-semibold tabular-nums">
            {market.currentPrice.toFixed(1)}%
          </span>
        </button>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            <span className="capitalize">{market.source}</span> ·{" "}
            <span
              className={`tabular-nums ${market.oneDayChange > 0 ? "text-emerald-500" : market.oneDayChange < 0 ? "text-rose-500" : ""}`}
            >
              {unavailable ? "Unavailable" : formatChange(market.oneDayChange)}
            </span>
          </p>
          <div className="flex gap-4">
            <button
              className="control rounded-full text-muted-foreground"
              aria-label={`${saved ? "Remove" : "Save"} ${market.question}`}
              aria-pressed={saved}
              onClick={() => toggleWatchlist(market.id, market.source)}
            >
              <Star
                className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`}
              />
            </button>
            {expanded && <MarketEvidence market={market} />}
            <button
              className="control rounded-full text-muted-foreground"
              aria-label={`${expanded ? "Collapse" : "Expand"} details`}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown
                className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="min-w-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-4 px-4 pb-4 text-xs">
            <p>
              24h volume{" "}
              <span className="block mt-1 font-medium">
                {market.volume24h.toLocaleString()}
              </span>
            </p>
            <p>
              {market.source === "kalshi" ? "Open interest" : "Liquidity"}
              <span className="block mt-1 font-medium">
                {market.liquidity.toLocaleString()}
              </span>
            </p>
          </div>
          <ExpandedPanel market={market} />
        </div>
      )}
    </article>
  );
}
