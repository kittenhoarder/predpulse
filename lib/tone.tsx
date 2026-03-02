"use client";

// Shared tone badge used by ExpandedPanel and NewsroomSection.
// GDELT tone: positive float = positive sentiment, negative = negative.
// Threshold: ±1.0 — only renders for meaningful signal; returns null for neutral/unknown.
export function ToneBadge({ tone }: { tone: number }) {
  if (tone > 1)
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">
        Positive
      </span>
    );
  if (tone < -1)
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 shrink-0">
        Negative
      </span>
    );
  // Neutral / unknown tone — render nothing rather than a meaningless "Neutral" pill
  return null;
}

// Returns a CSS class string for a gradient fallback tile based on tone
export function toneGradientClass(tone: number): string {
  if (tone > 1) return "from-emerald-900/60 to-emerald-950/80";
  if (tone < -1) return "from-red-900/60 to-red-950/80";
  return "from-slate-800/60 to-slate-900/80";
}
