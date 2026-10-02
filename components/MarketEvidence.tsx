import type { ProcessedMarket } from "@/lib/types";
import { marketTradeUrl } from "@/lib/format";
import EvidencePopover from "./EvidencePopover";
export default function MarketEvidence({
  market,
}: {
  market: ProcessedMarket;
}) {
  return (
    <EvidencePopover title={`Evidence: ${market.question}`}>
      <p className="font-medium text-foreground">{market.question}</p>
      <p>
        {market.source} · {market.outcomes[0] ?? "YES"} ·{" "}
        {market.source === "kalshi" ? "YES ask" : "market price"}.
      </p>
      <p>
        YES bid {(market.bestBid * 100).toFixed(1)}% · ask{" "}
        {(market.bestAsk * 100).toFixed(1)}%. Scheduled close{" "}
        {market.endDate || "unavailable"}.
      </p>
      <p>
        24h volume {market.volume24h.toLocaleString()} ·{" "}
        {market.source === "kalshi"
          ? "open interest (contracts)"
          : "liquidity (USD)"}{" "}
        {market.liquidity.toLocaleString()}.
      </p>
      {market.description && (
        <p className="whitespace-pre-line">{market.description}</p>
      )}
      <p>
        Contract {market.id}. Rules fingerprint and venue quote timestamp are
        not embedded in this market row.
      </p>
      <a
        href={marketTradeUrl(market.source, market.eventSlug)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-primary"
      >
        Inspect venue rules ↗
      </a>
    </EvidencePopover>
  );
}
