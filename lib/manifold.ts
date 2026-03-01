import type { ProcessedMarket } from "./types";

// Raw shape from https://api.manifold.markets/v0/markets
interface ManifoldMarket {
  id: string;
  question: string;
  probability?: number;         // 0–1, binary markets only
  totalLiquidity?: number;
  volume?: number;
  volume24Hours?: number;
  uniqueBettorCount?: number;
  createdTime: number;          // ms since epoch
  closeTime?: number;           // ms since epoch
  groupSlugs?: string[];
  url: string;
  isResolved: boolean;
  outcomeType: string;          // "BINARY" | "MULTIPLE_CHOICE" | "FREE_RESPONSE" | etc.
  description?: string | { content?: unknown };
  creatorName?: string;
}

// Manifold group slugs → Predpulse category slugs
const MANIFOLD_CATEGORY_MAP: Record<string, string> = {
  politics:          "politics",
  "us-politics":     "politics",
  "world-politics":  "politics",
  economics:         "economics",
  "finance":         "economics",
  "us-economy":      "economics",
  crypto:            "crypto",
  cryptocurrency:    "crypto",
  sports:            "sports",
  science:           "science",
  technology:        "tech",
  "artificial-intelligence": "tech",
  "ai":              "tech",
  entertainment:     "entertainment",
  geopolitics:       "geopolitics",
  "climate-change":  "climate",
  climate:           "climate",
};

function mapGroupSlugs(groupSlugs: string[] = []): { slugs: string[]; labels: string[] } {
  const seen = new Set<string>();
  const slugs: string[] = [];
  const labels: string[] = [];

  for (const gs of groupSlugs) {
    const mapped = MANIFOLD_CATEGORY_MAP[gs.toLowerCase()];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      slugs.push(mapped);
      labels.push(mapped.charAt(0).toUpperCase() + mapped.slice(1));
    }
  }

  if (slugs.length === 0) {
    return { slugs: ["general"], labels: ["General"] };
  }
  return { slugs, labels };
}

function extractDescription(raw: ManifoldMarket["description"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  // ProseMirror JSON blob — text extraction not yet implemented, return empty
  return "";
}

export async function fetchManifoldMarkets(): Promise<ProcessedMarket[]> {
  // Valid sort values: created-time | updated-time | last-bet-time | last-comment-time
  // The API has no open/binary filter params; we filter client-side after fetch.
  const url =
    "https://api.manifold.markets/v0/markets?limit=1000&sort=last-bet-time";

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`[manifold] HTTP ${res.status}`);

  let raw: ManifoldMarket[];
  try {
    raw = await res.json();
  } catch {
    throw new Error("[manifold] failed to parse JSON response");
  }

  const now = Date.now();
  const results: ProcessedMarket[] = [];

  for (const m of raw) {
    // Only process binary markets that have a probability
    if (m.outcomeType !== "BINARY" || m.probability === undefined || m.isResolved) {
      continue;
    }

    const prob = Math.round(m.probability * 1000) / 10; // 0–100, 1 dp
    const { slugs, labels } = mapGroupSlugs(m.groupSlugs);
    const endDate = m.closeTime ? new Date(m.closeTime).toISOString() : "";
    const msToClose = m.closeTime ? m.closeTime - now : Infinity;
    // Skip already-closed markets
    if (msToClose < 0) continue;

    results.push({
      id: m.id,
      question: m.question,
      source: "manifold",
      eventSlug: m.url, // Manifold: stores full URL here instead of a slug (handled in MarketRow/ExpandedPanel)
      eventTitle: m.question,
      categoryslugs: slugs,
      categories: labels,
      image: "",
      currentPrice: prob,
      oneDayChange: 0,     // Manifold API v0 doesn't expose price deltas
      oneHourChange: 0,
      oneWeekChange: 0,
      oneMonthChange: 0,
      volume24h: m.volume24Hours ?? 0,
      volume1wk: 0,
      volume1mo: 0,
      liquidity: m.totalLiquidity ?? 0,
      createdAt: new Date(m.createdTime).toISOString(),
      endDate,
      outcomes: ["Yes", "No"],
      outcomePrices: [m.probability, 1 - m.probability], // fractional 0–1 (consistent with Polymarket/Kalshi mapping)
      bestBid: m.probability,
      bestAsk: m.probability,
      spread: 0,
      clobTokenId: "",      // no CLOB; expanded panel skips chart/trades for manifold
      description: extractDescription(m.description),
      resolutionSource: m.url,
      competitive: Math.min(m.probability, 1 - m.probability) * 2, // 0–1
    });
  }

  return results;
}
