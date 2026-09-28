import Link from "next/link";
import type { RelatedPair } from "@/lib/related-markets";

export default function RelatedPairCard({ pair, asOf, compact = false }: {
  pair: RelatedPair; asOf: string; compact?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Across venues · {pair.category}</p>
      <p className="mt-2 text-xs text-muted-foreground">{pair.basis === "title" ? "Found by shared title terms." : "Two active markets from the same category; they may concern entirely different events."} Settlement terms and outcomes have not been verified as equivalent.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
      <p className="mt-3 text-xs text-muted-foreground">Snapshot {new Date(asOf).toLocaleString()} · Different settlement rules, quote bases or deadlines may explain different prices. No cross-venue price gap is calculated.</p>
      {compact ? <Link href={`/compare/${pair.id}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Inspect both markets →</Link>
        : <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-primary">Why these appeared together</summary>
          <p className="mt-2">{pair.basis === "title" ? `The titles share: ${pair.sharedTerms.join(", ")}.` : `Both markets are categorized as ${pair.category}; no event match was found.`} This is an automated discovery view, not a settlement or trading recommendation. Open each original contract to check its complete rules.</p>
        </details>}
    </article>
  );
}
