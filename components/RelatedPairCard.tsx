import Link from "next/link";
import type { RelatedPair } from "@/lib/related-markets";
import MetaNote from "./MetaNote";

export default function RelatedPairCard({ pair, asOf, compact = false }: {
  pair: RelatedPair; asOf: string; compact?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{pair.basis === "title" ? "Similar titles" : "Category view"} · {pair.category}</p>
        <MetaNote kind="method" title="Why these markets appear together">
          <p>{pair.basis === "title"
            ? `The titles share ${pair.sharedTerms.join(", ")}. This is a topic match, not a check of settlement rules.`
            : `Both markets are categorized as ${pair.category}. No event match was found; they may concern different events.`}</p>
          <p>The prices use their own venue-specific outcomes and quote bases. A price difference here is not an arbitrage opportunity. Open both original contracts to inspect the full rules.</p>
        </MetaNote>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Separate contracts · settlement may differ</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {pair.markets.map((m) => (
          <div key={`${m.source}:${m.marketId}`} className="min-w-0 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold">{m.source === "polymarket" ? "Polymarket" : "Kalshi"}</p>
            <a href={m.eventUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm font-medium leading-snug text-primary hover:underline">{m.question} ↗</a>
            <p className="mt-2 text-sm tabular-nums">{m.outcome} · {m.price.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{m.priceBasis} · closes {new Date(m.closesAt).toLocaleString()}</p>
            {!compact && m.ruleExcerpt && <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{m.ruleExcerpt}{m.ruleExcerpt.length >= 280 ? "…" : ""}</p>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Snapshot {new Date(asOf).toLocaleString()}</p>
      {compact ? <Link href={`/compare/${pair.id}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Inspect both markets →</Link>
        : null}
    </article>
  );
}
