"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { PulseIndex } from "@/lib/types";
import { X, ExternalLink } from "lucide-react";

const CLOSE_DURATION_MS = 350;

const BAND_COLORS: Record<PulseIndex["band"], { text: string; hex: string }> = {
  "Extreme Bearish": { text: "text-red-500",     hex: "#ef4444" },
  "Bearish":         { text: "text-red-400",     hex: "#f87171" },
  "Neutral":         { text: "text-zinc-400",    hex: "#71717a" },
  "Bullish":         { text: "text-teal-400",    hex: "#2dd4bf" },
  "Extreme Bullish": { text: "text-emerald-400", hex: "#34d399" },
};

const SIGNAL_DEFS = [
  { key: "momentum",     label: "Momentum",  pct: "30%" },
  { key: "flow",         label: "Flow",      pct: "25%" },
  { key: "breadth",      label: "Breadth",   pct: "15%" },
  { key: "acceleration", label: "Accel",     pct: "15%" },
  { key: "level",        label: "Certainty", pct: "ctx" },
  { key: "orderflow",    label: "Orderflow", pct: "10%" },
  { key: "smartMoney",   label: "Smart $",   pct: "5%"  },
] as const;

interface PulseDrawerProps {
  index: PulseIndex | null;
  onClose: () => void;
}

export default function PulseDrawer({ index, onClose }: PulseDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastIndexRef = useRef<PulseIndex | null>(null);

  // Keep a snapshot of the last non-null index so we can render during close animation
  if (index) lastIndexRef.current = index;
  const displayIndex = index ?? lastIndexRef.current;

  // Mount → animate in; null → animate out then unmount after duration
  useEffect(() => {
    if (index) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), CLOSE_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [index]);

  // Escape key
  useEffect(() => {
    if (!mounted) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mounted, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted || !displayIndex) return null;

  const colors = BAND_COLORS[displayIndex.band];
  const sparkData = displayIndex.history.map((s) => ({ v: s.score }));
  const hasDelta = displayIndex.delta24h !== 0;
  const deltaPositive = displayIndex.delta24h > 0;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute bottom-0 left-0 right-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card transition-transform duration-350 ease-out"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 bg-card pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-5 pb-6 max-w-xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-2.5 mb-1">
                <span className={`text-3xl font-bold tabular-nums ${colors.text}`}>
                  {displayIndex.score}
                </span>
                <span className={`text-sm font-semibold ${colors.text}`}>
                  {displayIndex.band}
                </span>
                {hasDelta && (
                  <span className={`text-xs tabular-nums font-medium ${
                    deltaPositive ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {deltaPositive ? "▲" : "▼"}{Math.abs(displayIndex.delta24h).toFixed(1)}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{displayIndex.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {displayIndex.marketCount.total} markets
                {displayIndex.marketCount.polymarket > 0 && ` · ${displayIndex.marketCount.polymarket} Polymarket`}
                {displayIndex.marketCount.kalshi > 0 && ` · ${displayIndex.marketCount.kalshi} Kalshi`}
                {displayIndex.marketCount.manifold > 0 && ` · ${displayIndex.marketCount.manifold} Manifold`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Score bar */}
          {(() => {
            const isBullish = displayIndex.score >= 50;
            const pct = (Math.abs(displayIndex.score - 50) / 50) * 100;
            return (
              <div className="relative h-2 w-full bg-muted/30 rounded-full overflow-hidden mb-5">
                {isBullish ? (
                  <div
                    className="absolute top-0 h-full rounded-r-full"
                    style={{ left: "50%", width: `${pct / 2}%`, backgroundColor: colors.hex }}
                  />
                ) : (
                  <div
                    className="absolute top-0 h-full rounded-l-full"
                    style={{ right: "50%", width: `${pct / 2}%`, backgroundColor: colors.hex }}
                  />
                )}
                <div className="absolute left-1/2 top-0 h-full w-px bg-border/50 -translate-x-px" />
              </div>
            );
          })()}

          {/* Sparkline */}
          {sparkData.length > 1 && (
            <div className="h-16 mb-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`drawer-pg-${displayIndex.category}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.hex} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.hex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={colors.hex}
                    strokeWidth={2}
                    fill={`url(#drawer-pg-${displayIndex.category})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Signals */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
              Signal Breakdown
            </p>
            <div className="space-y-2">
              {SIGNAL_DEFS
                .filter(({ key }) => displayIndex.signals[key as keyof typeof displayIndex.signals] !== undefined)
                .map(({ key, label, pct }) => {
                  const val = displayIndex.signals[key as keyof typeof displayIndex.signals] as number;
                  const isBullish = val >= 50;
                  const fillPct = (Math.abs(val - 50) / 50) * 100;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground/70 w-20 shrink-0">{label}</span>
                      <div className="relative flex-1 min-w-0 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        {isBullish ? (
                          <div
                            className="absolute top-0 h-full rounded-r-full"
                            style={{ left: "50%", width: `${fillPct / 2}%`, backgroundColor: colors.hex }}
                          />
                        ) : (
                          <div
                            className="absolute top-0 h-full rounded-l-full"
                            style={{ right: "50%", width: `${fillPct / 2}%`, backgroundColor: colors.hex }}
                          />
                        )}
                        <div className="absolute left-1/2 top-0 h-full w-px bg-border/60 -translate-x-px" />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground w-6 text-right shrink-0">{val}</span>
                      <span className="text-[10px] text-muted-foreground/30 w-6 shrink-0">{pct}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Top markets */}
          {displayIndex.topMarkets.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
                Top Markets
              </p>
              <div className="space-y-2">
                {displayIndex.topMarkets.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold ${
                        m.source === "kalshi"
                          ? "bg-sky-500/20 text-sky-400"
                          : m.source === "manifold"
                            ? "bg-violet-500/20 text-violet-400"
                            : "bg-indigo-500/20 text-indigo-400"
                      }`}
                    >
                      {m.source === "kalshi" ? "K" : m.source === "manifold" ? "M" : "P"}
                    </span>
                    <span className="text-sm text-foreground/80 truncate flex-1 min-w-0">{m.question}</span>
                    <span className="text-sm tabular-nums font-semibold shrink-0">
                      {m.currentPrice.toFixed(1)}%
                    </span>
                    <a
                      href={
                        m.source === "kalshi"
                          ? `https://kalshi.com/markets/${m.id}`
                          : m.source === "manifold"
                            ? `https://manifold.markets/${m.id}`
                            : `https://polymarket.com/event/${m.id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
