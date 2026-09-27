import type { ObservationDigest } from "@/lib/observations";
import MetaNote from "./MetaNote";

const usd = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export default function ObservedMoves({
  digest,
  status,
}: {
  digest: ObservationDigest | null | undefined;
  status: "hourly" | "delayed" | "stale";
}) {
  if (!digest || digest.version !== 2) return null;

  return (
    <section aria-labelledby="observed-moves-title" className="my-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
        <h2 id="observed-moves-title" className="text-sm font-semibold tracking-tight">Observed moves</h2>
        <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <span>P {digest.coverage.polymarket.eligible}/{digest.coverage.polymarket.examined.toLocaleString()}
            {" · "}K {digest.coverage.kalshi.eligible}/{digest.coverage.kalshi.examined.toLocaleString()}</span>
          <MetaNote kind="method" title="About observed moves">
            <p>Venue-reported outcome price changes captured {new Date(digest.asOf).toLocaleString()}.{status !== "hourly" && " This snapshot is delayed."} Counts show eligible markets out of those examined on each venue.</p>
            <p>Screening requires a 5–50 pp move, at most 5 pp quoted spread and at least 24 hours until close. Polymarket needs $10k in both 24h volume and liquidity; Kalshi needs 500 contracts traded and 500 open interest.</p>
            <p>Kalshi compares last trade prices; its table quote is the YES ask. Manifold lacks a dependable 24h move. These are observations, not explanations or forecasts.</p>
          </MetaNote>
        </div>
      </div>

      {digest.items.length === 0 ? (
        <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          No moves met the evidence checks in this snapshot.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {digest.items.map((item) => (
            <article key={`${item.source}:${item.marketId}`} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{item.category} · {item.source === "kalshi" ? "Kalshi" : "Polymarket"}</span>
                <span>24h move</span>
              </div>
              <a href={item.eventUrl} target="_blank" rel="noopener noreferrer"
                className="line-clamp-2 min-h-10 text-sm font-medium leading-5 hover:underline underline-offset-2">
                {item.question}
              </a>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums">{item.currentProbability.toFixed(1)}%</span>
                <span className={`text-sm font-medium tabular-nums ${item.change24h > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {item.change24h > 0 ? "+" : ""}{item.change24h.toFixed(1)} pp
                </span>
              </div>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{item.outcomeLabel || "Outcome unspecified"} {item.priceBasis}</span>
              <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                24h volume {item.source === "kalshi" ? `${usd.format(item.volume24h)} contracts` : `$${usd.format(item.volume24h)}`}
                {" · "}{item.source === "kalshi" ? "Open interest" : "Liquidity"} {item.source === "kalshi" ? `${usd.format(item.liquidity)} contracts` : `$${usd.format(item.liquidity)}`}
                {" · "}Spread {item.spreadPoints.toFixed(1)} pp
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
