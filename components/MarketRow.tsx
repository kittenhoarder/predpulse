"use client";

import { useState } from "react";
import type { ProcessedMarket } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import ExpandedPanel from "./ExpandedPanel";

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

interface MarketRowProps {
  market: ProcessedMarket;
  rank: number;
}

export default function MarketRow({ market, rank }: MarketRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isPositive = market.oneDayChange > 0;
  const isNeutral = market.oneDayChange === 0;
  const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;

  return (
    <>
      <TableRow
        className="group cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Rank + expand chevron */}
        <TableCell className="tabular-nums text-sm">
          <span className="flex items-center gap-1">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-muted-foreground">{rank}</span>
          </span>
        </TableCell>

        {/* Market question + category badges */}
        <TableCell>
          <span
            className="text-sm font-medium leading-snug line-clamp-2 block"
            title={market.question}
          >
            {market.question}
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {market.categories.slice(0, 2).map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 rounded-full font-normal"
              >
                {cat}
              </Badge>
            ))}
          </div>
        </TableCell>

        {/* Yes probability */}
        <TableCell className="text-right tabular-nums">
          <span className="text-sm font-semibold">
            {market.currentPrice.toFixed(1)}%
          </span>
        </TableCell>

        {/* 24h change */}
        <TableCell className="text-right tabular-nums">
          <Badge
            variant="outline"
            className={`text-xs font-semibold rounded-full ${
              isNeutral
                ? "text-muted-foreground border-border"
                : isPositive
                  ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                  : "text-red-500 border-red-500/30 bg-red-500/10"
            }`}
          >
            {formatChange(market.oneDayChange)}
          </Badge>
        </TableCell>

        {/* 24h volume */}
        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
          {formatCurrency(market.volume24h)}
        </TableCell>

        {/* Liquidity */}
        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
          {formatCurrency(market.liquidity)}
        </TableCell>

        {/* Trade link — visible on row hover */}
        <TableCell className="text-right w-16" onClick={(e) => e.stopPropagation()}>
          <a
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${market.question} on Polymarket`}
            className="inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Trade <ExternalLink className="w-3 h-3" />
          </a>
        </TableCell>
      </TableRow>

      {/* Expansion row — colSpan covers all 7 fixed columns; no padding so panel fills edge-to-edge */}
      {expanded && (
        <TableRow className="hover:bg-transparent border-0">
          <TableCell colSpan={7} className="p-0">
            <ExpandedPanel market={market} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
