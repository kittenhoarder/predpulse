/** Minimum evidence for treating a Kalshi price movement as a market move. */
export function isReliableKalshiMove(volume24h: number, openInterest: number, spread: number): boolean {
  return Number.isFinite(volume24h) && volume24h >= 500 &&
    Number.isFinite(openInterest) && openInterest >= 500 &&
    Number.isFinite(spread) && spread > 0 && spread <= 0.05;
}
