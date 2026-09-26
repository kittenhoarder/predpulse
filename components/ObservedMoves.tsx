import type { ObservationDigest } from "@/lib/observations";

const usd = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export default function ObservedMoves({
  digest,
  status,
}: {
  digest: ObservationDigest | null | undefined;
  status: "hourly" | "delayed" | "stale";
}) {
  if (!digest) return null;

  return (
    <section aria-labelledby="observed-moves-title" className="my-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-1">
        <div>
          <h2 id="observed-moves-title" className="text-sm font-semibold tracking-tight">Observed moves</h2>
          <p className="text-xs text-muted-foreground">
            Venue-reported 24h probability changes, captured {new Date(digest.asOf).toLocaleString()}.
            {status !== "hourly" && " This observation is delayed; values may have changed."}
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {digest.eligible.toLocaleString()} met the checks · {digest.examined.toLocaleString()} Polymarket markets examined
        </span>
      </div>

      {digest.items.length === 0 ? (
        <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          No moves met the evidence checks in this snapshot.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {digest.items.map((item) => (
            <article key={item.marketId} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{item.category} · Polymarket</span>
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
              <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                24h volume ${usd.format(item.volume24hUsd)} · Liquidity ${usd.format(item.liquidityUsd)} · Spread {item.spreadPoints.toFixed(1)} pp
              </p>
            </article>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Screening: ≥5 pp move, ≥$10k volume and liquidity, ≤5 pp quoted spread, at least 24h until scheduled close.
        One market per event. Venue figures are observations, not explanations or forecasts.
        Kalshi and Manifold are excluded until their change and volume measures are comparable.
      </p>
    </section>
  );
}
