/**
 * localStorage-backed watchlist for saved market IDs.
 * All reads/writes are synchronous and safe to call on the client only.
 */

const KEY = "predpulse:watchlist:v2";
export const WATCHLIST_CHANGE = "predpulse:watchlist-change";

export function savedMarketKey(source: string, id: string): string {
  return `${source}:${id}`;
}

export function getWatchlist(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    let raw = localStorage.getItem(KEY);
    if (raw === null) {
      // Legacy IDs have no venue. Retain them until a user toggles that market.
      raw = localStorage.getItem("predpulse:watchlist") ?? localStorage.getItem("predmove:watchlist");
      if (raw !== null) localStorage.setItem(KEY, raw);
    }
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveWatchlist(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable (private mode quota)
  }
}

export function toggleWatchlist(id: string, source?: string): boolean {
  const current = getWatchlist();
  const key = source ? savedMarketKey(source, id) : id;
  if (current.has(key) || (source && current.has(id))) {
    current.delete(key);
    if (source) current.delete(id);
  } else {
    current.add(key);
  }
  saveWatchlist(current);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WATCHLIST_CHANGE));
  return current.has(key);
}

export function isWatchlisted(id: string, source?: string): boolean {
  const saved = getWatchlist();
  return saved.has(id) || Boolean(source && saved.has(savedMarketKey(source, id)));
}
