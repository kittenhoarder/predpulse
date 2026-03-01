"use client";

import { useState } from "react";
import type { ProcessedMarket } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ExpandedPanel from "@/components/ExpandedPanel";
import { formatChange } from "@/components/MarketRow";
import { Share2, Check, ExternalLink } from "lucide-react";

interface MarketDetailClientProps {
  market: ProcessedMarket;
}

export default function MarketDetailClient({ market }: MarketDetailClientProps) {
  const [copied, setCopied] = useState(false);
  const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;

  const isPositive = market.oneDayChange > 0;
  const isNeutral = market.oneDayChange === 0;

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {market.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={market.image}
                alt={market.eventTitle || market.question}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border mt-0.5"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold leading-snug">
                {market.question}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {market.categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant="secondary"
                    className="text-xs rounded-full"
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Key stats */}
        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Probability
            </span>
            <span className="text-3xl font-bold tabular-nums">
              {market.currentPrice.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              24h Change
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-500"
                    : "text-red-500"
              }`}
            >
              {formatChange(market.oneDayChange)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              24h Volume
            </span>
            <span className="text-xl font-semibold tabular-nums text-muted-foreground">
              ${(market.volume24h / 1000).toFixed(0)}K
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-1.5"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : "Share"}
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <a href={polymarketUrl} target="_blank" rel="noopener noreferrer">
                Trade <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Reuse ExpandedPanel for the full detail view — already has chart, stats, resolution */}
      <div className="rounded-xl border border-border overflow-hidden">
        <ExpandedPanel market={market} />
      </div>
    </div>
  );
}
