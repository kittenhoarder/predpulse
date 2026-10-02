import Link from "next/link";
import type { RelatedPair } from "@/lib/related-markets";
import { GuideButton } from "./GuidePanel";
import EvidencePopover from "./EvidencePopover";
export default function RelatedPairCard({
  pair,
  asOf,
  compact = false,
}: {
  pair: RelatedPair;
  asOf: string;
  compact?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{pair.category}</p>
        <GuideButton id="across-venues" warning label="Settlement may differ" />
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {pair.markets.map((m) => (
          <div key={`${m.source}:${m.marketId}`} className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {m.source === "polymarket" ? "Polymarket" : "Kalshi"}
            </p>
            <a
              href={m.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-11 items-center text-sm font-medium hover:text-primary"
            >
              <span className="line-clamp-2">{m.question}</span>
            </a>
            <p className="mt-3 text-xl font-semibold tabular-nums">
              {m.price.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        {compact && (
          <Link
            href={`/compare/${pair.id}`}
            prefetch={false}
            className="inline-flex min-h-11 items-center text-xs text-primary"
          >
            Inspect both markets →
          </Link>
        )}
        <EvidencePopover title="Evidence for both contracts">
          <p>
            Captured {new Date(asOf).toLocaleString()}.{" "}
            {pair.basis === "title"
              ? `Shared title terms: ${pair.sharedTerms.join(", ")}.`
              : "Shared category only."}
          </p>
          {pair.markets.map((m) => (
            <div key={m.marketId} className="space-y-2">
              <p className="font-medium text-foreground">{m.question}</p>
              <p>
                {m.source} · {m.outcome} · {m.priceBasis}. Contract {m.marketId}
                . Closes {new Date(m.closesAt).toLocaleString()}.
              </p>
              <p className="whitespace-pre-line">
                {m.ruleExcerpt ||
                  "Rules excerpt unavailable; inspect the venue contract."}
              </p>
              <a
                href={m.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-primary"
              >
                Full venue rules ↗
              </a>
            </div>
          ))}
          <p>
            Separate contracts; settlement may differ. Rules fingerprints and
            source update times are not embedded in this comparison digest.
          </p>
        </EvidencePopover>
      </div>
    </article>
  );
}
