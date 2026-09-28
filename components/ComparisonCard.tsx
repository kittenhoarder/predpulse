"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Comparison } from "@/lib/venue-comparisons";
import { isCurrentComparison } from "@/lib/comparison-display";

const label = { polymarket: "Polymarket", kalshi: "Kalshi" };

function reasonText(reason: Comparison["reason"]): string {
  switch (reason) {
    case "rules-changed": return "Venue rules changed; the match needs review.";
    case "outcome-changed": return "The selected outcome changed; the match needs review.";
    case "quote-skew": return "Venue quotes were observed too far apart.";
    case "quote-stale": return "A quote was too old at publication.";
    case "invalid-book": return "A bid or ask was invalid.";
    case "quote-unavailable": return "A complete bid and ask were unavailable.";
    default: return "A venue market or its terms could not be checked.";
  }
}

export default function ComparisonCard({ item, compact = false }: { item: Comparison; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const current = isCurrentComparison(item, now);
  const checkedAt = item.venues.map((q) => q.receivedAt).filter(Boolean).sort().at(-1);

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Reviewed venue comparison</p>
      {compact ? <Link href={`/compare/${item.pairId}`} className="mt-2 block text-sm font-semibold hover:underline">{item.proposition}</Link>
        : <h1 className="mt-2 text-xl font-semibold sm:text-2xl">{item.proposition}</h1>}
      {current ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {item.venues.map((q) => (
              <div key={q.source} className="min-w-0 rounded-lg border border-border p-3">
                <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">{label[q.source]} ↗</a>
                <p className="mt-1 text-sm tabular-nums">{(q.bid! * 100).toFixed(1)}–{(q.ask! * 100).toFixed(1)}% bid–ask</p>
                <p className="text-xs text-muted-foreground">{q.outcomeLabel}{q.orientation === "complement" ? " · inverted to this proposition" : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">Received {new Date(q.receivedAt!).toLocaleString()}</p>
                {q.sourceUpdatedAt && <p className="text-xs text-muted-foreground">Venue market updated {new Date(q.sourceUpdatedAt).toLocaleString()}</p>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium tabular-nums">{label[item.venues[0].source]} midpoint {item.gapPP! >= 0 ? "above" : "below"} {label[item.venues[1].source]} by {Math.abs(item.gapPP!).toFixed(1)} percentage points.</p>
          <p className="mt-1 text-xs text-muted-foreground">Dated quote observation{checkedAt ? ` · last received ${new Date(checkedAt).toLocaleString()}` : ""}. Midpoints are not executable prices.</p>
        </>
      ) : <p className="mt-3 text-sm text-muted-foreground" role="status">
        Comparison unavailable. {item.reason ? reasonText(item.reason) : "The last observation has aged out."}
        {checkedAt ? ` Last checked ${new Date(checkedAt).toLocaleString()}.` : ""}
      </p>}
      {!compact && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Why these contracts were matched</summary>
          <p className="mt-2 text-muted-foreground">{item.rationale}</p>
          <div className="mt-3 space-y-2">
            {Object.entries(item.ruleComparison).map(([field, [polymarket, kalshi]]) => (
              <div key={field} className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold">{field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</p>
                <p className="mt-1 text-xs text-muted-foreground">Polymarket: {polymarket}</p>
                <p className="text-xs text-muted-foreground">Kalshi: {kalshi}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Reviewed {new Date(item.reviewedAt).toLocaleDateString()} · mapping revision {item.mappingRevision}. Read both venues’ complete settlement terms before drawing a conclusion.</p>
          <ul className="mt-2 space-y-1">{item.venues.map((q) => <li key={q.source}><a href={q.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{label[q.source]} original contract and rules ↗</a></li>)}</ul>
        </details>
      )}
      {compact && <Link href={`/compare/${item.pairId}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Read the rule comparison →</Link>}
    </article>
  );
}
