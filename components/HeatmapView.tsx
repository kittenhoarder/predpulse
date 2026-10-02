"use client";

import { useMemo, useState } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { ProcessedMarket } from "@/lib/types";
import { formatChange, marketTradeUrl } from "@/lib/format";

interface HeatmapViewProps {
  markets: ProcessedMarket[];
}

interface TreeNode {
  name: string;
  size: number;
  change: number;
  prob: number;
  id: string;
  eventSlug: string;
  source: "polymarket" | "kalshi" | "manifold";
}

/**
 * Map a 24h change value (-100 to +100) to a tile color.
 * Strong green for big gains, strong red for big losses, neutral grey near zero.
 */
function changeToColor(change: number): string {
  if (change >= 15) return "#16a34a";   // dark green
  if (change >= 8)  return "#22c55e";   // green
  if (change >= 3)  return "#4ade80";   // light green
  if (change >= 0.5) return "#86efac";  // pale green
  if (change > -0.5) return "#4a6b6b";  // neutral
  if (change > -3)  return "#fca5a5";   // pale red
  if (change > -8)  return "#f87171";   // light red
  if (change > -15) return "#ef4444";   // red
  return "#dc2626";                      // dark red
}

function textColor(change: number): string {
  const abs = Math.abs(change);
  return abs < 0.5 ? "#a1a1aa" : "#ffffff";
}

// Custom content renderer for each treemap tile
interface ContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  change?: number;
  prob?: number;
  eventSlug?: string;
  source?: "polymarket" | "kalshi" | "manifold";
  select?: (source: string, slug: string) => void;
}

function tileHref(source: string, eventSlug: string): string {
  // Polymarket gets an internal detail page; Kalshi and Manifold go to their exchange
  if (source === "polymarket") return `/market/${eventSlug}`;
  return marketTradeUrl(source as "kalshi" | "manifold", eventSlug);
}

function CustomTile(props: ContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", change = 0, prob = 0, eventSlug = "", source = "polymarket" } = props;

  if (width < 20 || height < 20) return null;

  const bg = changeToColor(change);
  const fg = textColor(change);
  const showChange = height > 40 && width > 60;
  const showProb = height > 56 && width > 60;
  const fontSize = 12;

  const handleClick = () => props.select?.(source, eventSlug);
  const interactive = width >= 44 && height >= 44;

  return (
    <g role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `${name}, ${prob.toFixed(1)}%, ${formatChange(change)}` : undefined} onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); handleClick(); } }}>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        fill={bg}
        rx={4}
        style={{ cursor: "pointer" }}
        onClick={interactive ? handleClick : undefined}
      />
      {width > 40 && height > 28 && (
        <foreignObject x={x + 4} y={y + 4} width={width - 8} height={height - 8}>
          <div
            style={{ pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", overflow: "hidden", color: fg }}
          >
            <div style={{ fontSize, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {name}
            </div>
            {showProb && (
              <div style={{ fontSize, opacity: 0.9, marginTop: 2 }}>
                {prob.toFixed(1)}%
              </div>
            )}
            {showChange && (
              <div style={{ fontSize, opacity: 0.85, marginTop: 1 }}>
                {formatChange(change)}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

// Tooltip shown on hover
function HeatmapTooltip({ active, payload }: { active?: boolean; payload?: { payload: TreeNode }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg max-w-[240px]">
      <p className="font-semibold text-foreground leading-snug mb-1">{d.name}</p>
      <p className="text-muted-foreground">{d.prob.toFixed(1)}% probability</p>
      <p className={`font-medium ${d.change > 0 ? "text-emerald-500" : d.change < 0 ? "text-red-500" : "text-muted-foreground"}`}>
        {formatChange(d.change)} 24h
      </p>
    </div>
  );
}

export default function HeatmapView({ markets }: HeatmapViewProps) {
  const [selected, setSelected] = useState<ProcessedMarket | null>(null);
  const data = useMemo<TreeNode[]>(
    () =>
      markets
        .map((m) => ({
          name: m.question,
          size: Math.max(m.liquidity, 1),
          change: m.oneDayChange,
          prob: m.currentPrice,
          id: m.id,
          eventSlug: m.eventSlug,
          source: m.source,
        }))
        .slice(0, 100),
    [markets]
  );

  if (data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
        No markets to display
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Tile size = liquidity · Color = 24h change
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Losers
          <span className="w-3 h-3 rounded-sm bg-zinc-600 inline-block ml-1" />
          Flat
          <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block ml-1" />
          Gainers
        </div>
      </div>
      {selected && <div className="space-y-2 p-4 text-sm"><p className="font-medium">{selected.question}</p><p>{selected.currentPrice.toFixed(1)}% · {formatChange(selected.oneDayChange)} · <span className="capitalize">{selected.source}</span></p><a className="inline-flex min-h-11 items-center text-primary" href={tileHref(selected.source, selected.eventSlug)}>Open contract →</a></div>}
      <ResponsiveContainer width="100%" height={520}>
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          content={<CustomTile select={(source, slug) => setSelected(markets.find((market) => market.source === source && market.eventSlug === slug) ?? null)} />}
        >
          <Tooltip content={<HeatmapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
      <details className="p-4"><summary className="flex min-h-11 cursor-pointer items-center text-sm">Browse heatmap markets</summary><div className="space-y-3">{markets.map((market) => <button key={`${market.source}:${market.id}`} className="min-h-11 text-left text-xs" onClick={() => setSelected(market)}>{market.question} · {market.currentPrice.toFixed(1)}% · {formatChange(market.oneDayChange)}</button>)}</div></details>
    </div>
  );
}
