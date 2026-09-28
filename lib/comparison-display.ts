import type { Comparison } from "./venue-comparisons";

const DISPLAY_MAX_AGE_MS = 90 * 60_000;

export function isCurrentComparison(item: Comparison, now = Date.now()): boolean {
  if (item.reason || !Number.isFinite(item.gapPP)) return false;
  const times = item.venues.map((q) => Date.parse(q.receivedAt ?? ""));
  return times.every((t) => Number.isFinite(t) && t <= now + 30_000 && now - t <= DISPLAY_MAX_AGE_MS);
}
