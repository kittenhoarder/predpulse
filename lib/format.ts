export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Build the external exchange URL for a market.
 *
 * - Polymarket: `/market/{eventSlug}` (internal detail page)
 * - Kalshi:     `https://kalshi.com/markets/{eventSlug}` (eventSlug = lowercased event_ticker)
 * - Manifold:   `eventSlug` contains the full URL (stored at ingest time)
 */
export function marketTradeUrl(
  source: "polymarket" | "kalshi" | "manifold",
  eventSlug: string,
): string {
  if (source === "kalshi") return `https://kalshi.com/markets/${eventSlug}`;
  if (source === "manifold") return eventSlug;
  return `https://polymarket.com/event/${eventSlug}`;
}
