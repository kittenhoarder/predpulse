import type { ObservationDigest } from "@/lib/observations";
import SectionHeader from "./SectionHeader";
import MoveEvidence from "./MoveEvidence";
export default function ObservedMoves({
  digest,
  status,
}: {
  digest: ObservationDigest | null | undefined;
  status: "hourly" | "delayed" | "stale";
}) {
  return (
    <section id="observed-moves">
      <SectionHeader id="observed-moves" />
      {status === "stale" ? (
        <p className="text-sm text-muted-foreground">
          Current observed moves are withheld for this stale publication.
        </p>
      ) : !digest?.items.length ? (
        <p className="text-sm text-muted-foreground">
          No moves met the evidence checks in this snapshot.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {digest.items.map((item) => (
            <article
              key={`${item.source}:${item.marketId}`}
              className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <p className="text-xs text-muted-foreground">
                {item.category} ·{" "}
                {item.source === "kalshi" ? "Kalshi" : "Polymarket"}
              </p>
              <a
                href={item.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-11 items-center text-sm font-medium hover:text-primary"
              >
                <span className="line-clamp-2">{item.question}</span>
              </a>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="tabular-nums">
                  <span className="text-xl font-semibold">
                    {item.currentProbability.toFixed(1)}%
                  </span>
                  <span
                    className={`ml-3 text-sm ${item.change24h > 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {item.change24h > 0 ? "+" : ""}
                    {item.change24h.toFixed(1)} pp
                  </span>
                </div>
                <MoveEvidence item={item} asOf={digest.asOf} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
