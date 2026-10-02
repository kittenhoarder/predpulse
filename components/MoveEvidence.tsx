import type { MarketObservation } from "@/lib/observations";
import type { ProcessedMarket } from "@/lib/types";
import EvidencePopover from "./EvidencePopover";
export default function MoveEvidence({
  item,
  market,
  asOf,
}: {
  item: MarketObservation;
  market?: ProcessedMarket;
  asOf: string;
}) {
  return (
    <EvidencePopover title={`Evidence: ${item.question}`}>
      <p className="font-medium text-foreground">{item.question}</p>
      <p>
        {item.source} · {item.outcomeLabel} · {item.priceBasis}
      </p>
      <p>
        Captured {new Date(asOf).toLocaleString()}. Change{" "}
        {item.change24h.toFixed(1)} pp. Spread {item.spreadPoints.toFixed(1)}{" "}
        pp.
      </p>
      <p>
        24h volume {item.volume24h.toLocaleString()}{" "}
        {item.source === "kalshi" ? "contracts" : "USD"};{" "}
        {item.source === "kalshi" ? "open interest" : "liquidity"}{" "}
        {item.liquidity.toLocaleString()}.
      </p>
      {market && (
        <p>
          YES bid {(market.bestBid * 100).toFixed(1)}% · ask{" "}
          {(market.bestAsk * 100).toFixed(1)}%. Scheduled close{" "}
          {new Date(market.endDate).toLocaleString()}.
        </p>
      )}
      {market?.description && (
        <p className="whitespace-pre-line">{market.description}</p>
      )}
      <p>
        Contract {item.marketId}. Full rules and rules fingerprint are not
        embedded in this move digest; inspect the original contract.
      </p>
      <a
        href={item.eventUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-primary"
      >
        Read venue rules ↗
      </a>
    </EvidencePopover>
  );
}
