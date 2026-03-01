export interface OrderbookLevel {
  price: number;
  quantity: number;
}

/**
 * Compute a 0–100 depth score: bid quantity within 5pp of mid / total near-mid depth.
 * A higher score means more buy-side support close to the current price.
 */
export function computeDepthScore(
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  mid: number,
): number {
  const NEAR_PP = 0.05;
  const nearBids = bids.filter((l) => l.price >= mid - NEAR_PP);
  const nearAsks = asks.filter((l) => l.price <= mid + NEAR_PP);
  const bidQty = nearBids.reduce((s, l) => s + l.quantity, 0);
  const askQty = nearAsks.reduce((s, l) => s + l.quantity, 0);
  const total = bidQty + askQty;
  if (total === 0) return 50;
  return Math.round((bidQty / total) * 100);
}
