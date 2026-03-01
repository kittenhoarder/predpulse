"use client";

import type { PulseIndex } from "@/lib/types";

const BAND_HEX: Record<PulseIndex["band"], string> = {
  "Extreme Bearish": "#ef4444",
  "Bearish":         "#f87171",
  "Neutral":         "#71717a",
  "Bullish":         "#2dd4bf",
  "Extreme Bullish": "#34d399",
};

const CATEGORY_ABBR: Record<string, string> = {
  politics: "POL",
  economics: "ECO",
  crypto: "CRY",
  tech: "TEC",
  climate: "CLI",
  sports: "SPO",
  entertainment: "ENT",
  geopolitics: "GEO",
};

interface CompactPulseCardProps {
  index: PulseIndex;
  onClick: () => void;
  mobileTicker?: boolean;
}

export default function CompactPulseCard({ index, onClick, mobileTicker = false }: CompactPulseCardProps) {
  const hex = BAND_HEX[index.band];
  const baseAbbr = CATEGORY_ABBR[index.category] ?? index.label.slice(0, 3).toUpperCase();
  const abbr = mobileTicker ? baseAbbr.slice(0, 2) : baseAbbr;

  return (
    <button
      onClick={onClick}
      className={`group flex items-center rounded-full border bg-card/80 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-sm cursor-pointer shrink-0 ${
        mobileTicker ? "gap-1 h-5 px-1.5" : "gap-1.5 h-6 px-2"
      }`}
      style={{ borderColor: `${hex}30` }}
      title={`${index.label}: ${index.score} ${index.band}`}
    >
      {!mobileTicker && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: hex }}
        />
      )}
      <span
        className={`font-bold tabular-nums leading-none ${mobileTicker ? "text-[10px]" : "text-[10px]"}`}
        style={{ color: mobileTicker ? hex : undefined }}
      >
        {index.score}
      </span>
      <span className={`font-medium leading-none text-muted-foreground/70 ${mobileTicker ? "text-[8px]" : "text-[9px] hidden lg:inline"}`}>
        {abbr}
      </span>
    </button>
  );
}
