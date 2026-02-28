"use client";

import { useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { PulseIndex } from "@/lib/types";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

const BAND_COLORS: Record<PulseIndex["band"], { text: string; bar: string; hex: string }> = {
  "Extreme Bearish": { text: "text-red-500",    bar: "bg-red-500",     hex: "#ef4444" },
  "Bearish":         { text: "text-orange-400", bar: "bg-orange-400",  hex: "#fb923c" },
  "Neutral":         { text: "text-zinc-400",   bar: "bg-zinc-400",    hex: "#71717a" },
  "Bullish":         { text: "text-teal-400",   bar: "bg-teal-400",    hex: "#2dd4bf" },
  "Extreme Bullish": { text: "text-emerald-400",bar: "bg-emerald-400", hex: "#34d399" },
};

interface PulseCardProps {
  index: PulseIndex;
  large?: boolean;
}

export default function PulseCard({ index, large = false }: PulseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = BAND_COLORS[index.band];
  const hasDelta = index.delta24h !== 0;
  const deltaPositive = index.delta24h > 0;
  const sparkData = index.history.map((s) => ({ v: s.score }));

  return (
    <div
      className={`rounded-xl border border-border bg-card transition-shadow hover:shadow-md cursor-pointer select-none ${
        large ? "p-4" : "p-3"
      }`}
      onClick={() => setExpanded((e) => !e)}
      role="button"
      aria-expanded={expanded}
    >
      {/* Header: label + chevron */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate pr-1">
          {index.label}
        </span>
        <span className="text-muted-foreground/40 shrink-0">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </div>

      {/* Score + band */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-2xl font-bold tabular-nums leading-none ${colors.text}`}>
          {index.score}
        </span>
        <span className={`text-[10px] font-semibold ${colors.text} truncate`}>
          {index.band}
        </span>
        {hasDelta && (
          <span className={`text-[10px] tabular-nums font-medium ml-auto shrink-0 ${
            deltaPositive ? "text-emerald-400" : "text-red-400"
          }`}>
            {deltaPositive ? "▲" : "▼"}{Math.abs(index.delta24h).toFixed(1)}
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${index.score}%` }}
        />
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div className={large ? "h-10" : "h-7"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`pg-${index.category}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.hex} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={colors.hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={colors.hex}
                strokeWidth={1.5}
                fill={`url(#pg-${index.category})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Market count */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground/50">
        <span>{index.marketCount.total} mkts</span>
        <span className="flex items-center gap-1.5">
          {index.marketCount.polymarket > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <span className="inline-block w-1 h-1 rounded-full bg-indigo-400" />
              {index.marketCount.polymarket}P
            </span>
          )}
          {index.marketCount.kalshi > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <span className="inline-block w-1 h-1 rounded-full bg-sky-400" />
              {index.marketCount.kalshi}K
            </span>
          )}
        </span>
      </div>

      {/* Expanded: signal breakdown + top markets */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              Signals
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { key: "prob",        label: "Wtd Prob",   pct: "30%" },
                  { key: "volWeighted", label: "Vol-Wtd",    pct: "20%" },
                  { key: "momentum",    label: "Momentum",   pct: "20%" },
                  { key: "breadth",     label: "Breadth",    pct: "15%" },
                  { key: "decay",       label: "Decay",      pct: "10%" },
                  { key: "consensus",   label: "Consensus",  pct: "5%" },
                ] as const
              ).map(({ key, label, pct }) => {
                const val = index.signals[key];
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground/60 w-16 shrink-0 truncate">{label}</span>
                    <div className="flex-1 min-w-0 h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${val}%`, backgroundColor: colors.hex }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-5 text-right shrink-0">{val}</span>
                    <span className="text-[10px] text-muted-foreground/30 w-5 shrink-0">{pct}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {index.topMarkets.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                Top Markets
              </p>
              <div className="space-y-1.5">
                {index.topMarkets.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex shrink-0 items-center justify-center w-3.5 h-3.5 rounded-sm text-[8px] font-bold ${
                        m.source === "kalshi" ? "bg-sky-500/20 text-sky-400" : "bg-indigo-500/20 text-indigo-400"
                      }`}
                    >
                      {m.source === "kalshi" ? "K" : "P"}
                    </span>
                    <span className="text-[11px] text-foreground/80 truncate flex-1 min-w-0">{m.question}</span>
                    <span className="text-[11px] tabular-nums font-semibold shrink-0">
                      {m.currentPrice.toFixed(1)}%
                    </span>
                    <a
                      href={m.source === "polymarket"
                        ? `https://polymarket.com/event/${m.id}`
                        : `https://kalshi.com/markets/${m.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
