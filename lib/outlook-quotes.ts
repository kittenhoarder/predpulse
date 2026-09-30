import type { GammaMarket } from "./types";

export function readYesQuote(market: GammaMarket | undefined): { bid: number | null; ask: number | null; midpoint: number | null } {
  // Gamma book fields are used only for the supported Yes-first binary adapter.
  // Reordered/unknown outcomes are not guessed into an analytical price.
  let outcomes: unknown;
  try { outcomes = JSON.parse(market?.outcomes ?? "null"); } catch { return { bid: null, ask: null, midpoint: null }; }
  const bid = market?.bestBid, ask = market?.bestAsk;
  if (!market?.active || market.closed || market.archived || !Array.isArray(outcomes) ||
      outcomes.length !== 2 || outcomes[0] !== "Yes" || outcomes[1] !== "No" ||
      typeof bid !== "number" || typeof ask !== "number" || !Number.isFinite(bid) || !Number.isFinite(ask) ||
      bid < 0 || ask <= 0 || ask > 1 || bid > ask || ask - bid > 0.10 + 1e-9) {
    return { bid: null, ask: null, midpoint: null };
  }
  return { bid, ask, midpoint: (bid + ask) / 2 };
}

