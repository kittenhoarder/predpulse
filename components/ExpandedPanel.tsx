"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow, differenceInDays, parseISO, format } from "date-fns";
import type { ProcessedMarket } from "@/lib/types";
import { ExternalLink } from "lucide-react";
import { formatCurrency, formatChange } from "./MarketRow";

// ---------------------------------------------------------------------------
// CLOB price history fetch
// ---------------------------------------------------------------------------

interface PricePoint {
  t: number; // unix timestamp
  p: number; // price 0–1
}

interface ChartPoint {
  date: string;
  prob: number; // 0–100
}

async function fetchPriceHistory(tokenId: string): Promise<ChartPoint[]> {
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - 30 * 24 * 60 * 60; // 30 days back
  const url =
    `https://clob.polymarket.com/prices-history` +
    `?market=${tokenId}&startTs=${startTs}&endTs=${endTs}&fidelity=60`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CLOB ${res.status}`);
  const data: { history: PricePoint[] } = await res.json();

  return (data.history ?? []).map((pt) => ({
    date: format(new Date(pt.t * 1000), "MMM d"),
    prob: Math.round(pt.p * 10000) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCellProps {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}

function StatCell({ label, value, highlight }: StatCellProps) {
  const color =
    highlight === "positive"
      ? "text-emerald-500"
      : highlight === "negative"
        ? "text-red-500"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

function changeHighlight(v: number): "positive" | "negative" | "neutral" {
  return v > 0 ? "positive" : v < 0 ? "negative" : "neutral";
}

// Custom tooltip for recharts — theme-aware
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ExpandedPanelProps {
  market: ProcessedMarket;
}

export default function ExpandedPanel({ market }: ExpandedPanelProps) {
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null);
  const [chartError, setChartError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Lazy-fetch price history once on first render of the expansion
  useEffect(() => {
    if (!market.clobTokenId) return;
    fetchPriceHistory(market.clobTokenId)
      .then(setChartData)
      .catch(() => setChartError(true));
  }, [market.clobTokenId]);

  const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;

  const closesIn =
    market.endDate
      ? (() => {
          const days = differenceInDays(parseISO(market.endDate), new Date());
          if (days < 0) return "Closed";
          if (days === 0) return "Closes today";
          return `Closes in ${days}d`;
        })()
      : null;

  const spread = market.bestAsk - market.bestBid;

  // Determine Y axis domain with a bit of padding
  const chartMin =
    chartData && chartData.length > 0
      ? Math.max(0, Math.min(...chartData.map((d) => d.prob)) - 5)
      : 0;
  const chartMax =
    chartData && chartData.length > 0
      ? Math.min(100, Math.max(...chartData.map((d) => d.prob)) + 5)
      : 100;

  const lastUpdatedText = market.createdAt
    ? formatDistanceToNow(new Date(market.createdAt), { addSuffix: true })
    : null;

  return (
    <div className="bg-muted/30 border-t border-border px-4 sm:px-6 py-5 flex flex-col gap-5">

      {/* Section A — Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {market.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={market.image}
              alt=""
              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug truncate">
              {market.eventTitle || market.question}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {closesIn && (
                <span className="text-xs text-muted-foreground">{closesIn}</span>
              )}
              {lastUpdatedText && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  · Created {lastUpdatedText}
                </span>
              )}
            </div>
          </div>
        </div>
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          Polymarket <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Section B — Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-4">
        <StatCell
          label="1h"
          value={formatChange(market.oneHourChange)}
          highlight={changeHighlight(market.oneHourChange)}
        />
        <StatCell
          label="7d"
          value={formatChange(market.oneWeekChange)}
          highlight={changeHighlight(market.oneWeekChange)}
        />
        <StatCell
          label="30d"
          value={formatChange(market.oneMonthChange)}
          highlight={changeHighlight(market.oneMonthChange)}
        />
        <StatCell
          label="Bid / Ask"
          value={`${(market.bestBid * 100).toFixed(1)}¢ / ${(market.bestAsk * 100).toFixed(1)}¢`}
        />
        <StatCell
          label="Spread"
          value={`${(spread * 100).toFixed(2)}¢`}
        />
        <StatCell label="Vol 7d" value={formatCurrency(market.volume1wk)} />
      </div>

      {/* Section C — 30-day probability sparkline */}
      {market.clobTokenId && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            30-day probability
          </p>
          {!chartData && !chartError && (
            <div className="h-28 w-full rounded-md bg-muted animate-pulse" />
          )}
          {chartError && (
            <p className="text-xs text-muted-foreground h-28 flex items-center">
              Chart unavailable
            </p>
          )}
          {chartData && chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={112}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 0, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`grad-${market.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[chartMin, chartMax]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="prob"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#grad-${market.id})`}
                  dot={false}
                  activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {chartData && chartData.length <= 1 && (
            <p className="text-xs text-muted-foreground h-28 flex items-center">
              Not enough history to chart
            </p>
          )}
        </div>
      )}

      {/* Section D — Resolution */}
      {(market.description || market.resolutionSource) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Resolution
          </p>
          {market.description && (
            <div>
              <p
                className={`text-xs text-muted-foreground leading-relaxed ${
                  descExpanded ? "" : "line-clamp-3"
                }`}
              >
                {market.description}
              </p>
              {market.description.length > 200 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescExpanded((v) => !v);
                  }}
                  className="text-xs text-primary hover:text-primary/80 mt-0.5 transition-colors"
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
          {market.resolutionSource && (
            <a
              href={market.resolutionSource}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-fit"
            >
              Resolution source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
