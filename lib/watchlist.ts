/**
 * localStorage-backed watchlist for saved market IDs.
 * All reads/writes are synchronous and safe to call on the client only.
 */

// One-time migration from the old "predmove" key — runs once on first client load
if (typeof window !== "undefined") {
  try {
    const old = localStorage.getItem("predmove:watchlist");
    if (old) {
      localStorage.setItem("predpulse:watchlist", old);
      localStorage.removeItem("predmove:watchlist");
    }
  } catch {
    // localStorage unavailable (private mode)
  }
}

const KEY = "predpulse:watchlist";

export function getWatchlist(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
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

export function toggleWatchlist(id: string): boolean {
  const current = getWatchlist();
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  saveWatchlist(current);
  return current.has(id);
}

export function isWatchlisted(id: string): boolean {
  return getWatchlist().has(id);
}
