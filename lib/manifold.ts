import type { ProcessedMarket } from "./types";
import { batchParallel } from "./fetch-utils";
import { inferPolarity } from "./polarity";

const MANIFOLD_API = "https://api.manifold.markets";
const BETS_BATCH_SIZE = 20;

// Raw shape from https://api.manifold.markets/v0/markets
interface ManifoldMarket {
  id: string;
  question: string;
  probability?: number;           // 0–1, BINARY only
  totalLiquidity?: number;
  volume?: number;
  volume24Hours?: number;
  uniqueBettorCount?: number;
  createdTime: number;            // ms since epoch
  closeTime?: number;             // ms since epoch
  groupSlugs?: string[];
  url: string;
  isResolved: boolean;
  outcomeType: string;            // "BINARY" | "MULTIPLE_CHOICE" | "FREE_RESPONSE" | etc.
  description?: string | { content?: unknown };
  creatorName?: string;
  // MULTIPLE_CHOICE markets have an answers array
  answers?: ManifoldAnswer[];
}

interface ManifoldAnswer {
  id: string;
  text: string;
  probability: number;  // 0–1
}

// Raw bet shape from /v0/bets
interface ManifoldBet {
  probBefore?: number;  // probability before this bet
  probAfter?: number;   // probability after this bet
  createdTime: number;  // ms since epoch
}

// Manifold group slugs → Predpulse category slugs
const MANIFOLD_CATEGORY_MAP: Record<string, string> = {
  politics:                  "politics",
  "us-politics":             "politics",
  "world-politics":          "politics",
  economics:                 "economics",
  finance:                   "economics",
  "us-economy":              "economics",
  crypto:                    "crypto",
  cryptocurrency:            "crypto",
  sports:                    "sports",
  science:                   "science",
  technology:                "tech",
  "artificial-intelligence": "tech",
  ai:                        "tech",
  entertainment:             "entertainment",
  geopolitics:               "geopolitics",
  "climate-change":          "climate",
  climate:                   "climate",
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

  return slugs.length === 0 ? { slugs: ["general"], labels: ["General"] } : { slugs, labels };
}

function extractDescription(raw: ManifoldMarket["description"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  // ProseMirror JSON blob — extract plain text from content nodes recursively
  try {
    const extractText = (node: unknown): string => {
      const n = node as Record<string, unknown>;
      if (n.type === "text") return String(n.text ?? "");
      if (Array.isArray(n.content)) return n.content.map(extractText).join(" ");
      return "";
    };
    const doc = raw as Record<string, unknown>;
    return extractText(doc).trim().replace(/\s+/g, " ");
  } catch {
    return "";
  }
}

/**
 * Fetch 24h bet history for a batch of Manifold market IDs.
 * Returns Map<contractId, oneDayChange in pp> for markets with enough history.
 * Only fetches for the top-200 markets by volume to stay rate-limit safe.
 */
async function fetchManifoldBets(
  contractIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (contractIds.length === 0) return result;

  const after24h = Date.now() - 24 * 60 * 60 * 1000;

  await batchParallel(contractIds, BETS_BATCH_SIZE, async (contractId) => {
    const params = new URLSearchParams({
      contractId,
      after: String(after24h),
      limit: "100",
    });
    const url = `${MANIFOLD_API}/v0/bets?${params.toString()}`;
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return;
      const bets: ManifoldBet[] = await res.json();
      if (!Array.isArray(bets) || bets.length === 0) return;
      const sorted = [...bets].sort((a, b) => a.createdTime - b.createdTime);
      const earliest = sorted[0];
      const probStart = earliest.probBefore;
      const probEnd = sorted[sorted.length - 1].probAfter;
      if (probStart !== undefined && probEnd !== undefined) {
        result.set(contractId, Math.round((probEnd - probStart) * 10000) / 100);
      }
    } catch { /* non-fatal — delta stays 0 */ }
  });

  return result;
}

export async function fetchManifoldMarkets(): Promise<ProcessedMarket[]> {
  // Valid sort values: created-time | updated-time | last-bet-time | last-comment-time
  // The API has no type filter params — we filter client-side.
  const url =
    `${MANIFOLD_API}/v0/markets?limit=1000&sort=last-bet-time`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`[manifold] HTTP ${res.status}`);

  let raw: ManifoldMarket[];
  try {
    raw = await res.json();
  } catch {
    throw new Error("[manifold] failed to parse JSON response");
  }

  const now = Date.now();
  const eligible: ManifoldMarket[] = [];

  for (const m of raw) {
    if (m.isResolved) continue;
    const msToClose = m.closeTime ? m.closeTime - now : Infinity;
    if (msToClose < 0) continue;
    // Accept BINARY (with probability) or MULTIPLE_CHOICE (with answers)
    if (m.outcomeType === "BINARY" && m.probability !== undefined) {
      eligible.push(m);
    } else if (m.outcomeType === "MULTIPLE_CHOICE" && Array.isArray(m.answers) && m.answers.length >= 2) {
      eligible.push(m);
    }
  }

  // Fetch 24h bet history for top-200 by volume (rate-limit safe)
  const top200 = [...eligible]
    .sort((a, b) => (b.volume24Hours ?? 0) - (a.volume24Hours ?? 0))
    .slice(0, 200);
  const deltaMap = await fetchManifoldBets(top200.map((m) => m.id));

  const results: ProcessedMarket[] = [];

  for (const m of eligible) {
    const { slugs, labels } = mapGroupSlugs(m.groupSlugs);
    const endDate = m.closeTime ? new Date(m.closeTime).toISOString() : "";
    const oneDayChange = deltaMap.get(m.id) ?? 0;

    if (m.outcomeType === "BINARY") {
      const prob = m.probability!;
      const probPct = Math.round(prob * 1000) / 10;

      results.push({
        id: m.id,
        question: m.question,
        source: "manifold",
        // Manifold: stores full URL as eventSlug (handled in MarketRow/ExpandedPanel)
        eventSlug: m.url,
        eventTitle: m.question,
        categoryslugs: slugs,
        categories: labels,
        image: "",
        currentPrice: probPct,
        oneDayChange,
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
        outcomePrices: [prob, 1 - prob],
        bestBid: prob,
        bestAsk: prob,
        spread: 0,
        clobTokenId: "",  // no CLOB; expanded panel skips chart/trades for manifold
        description: extractDescription(m.description),
        resolutionSource: m.url,
        competitive: Math.min(prob, 1 - prob) * 2,
        polarity: inferPolarity(m.question),
      });
    } else {
      // MULTIPLE_CHOICE — represent as a multi-outcome market
      const answers = m.answers!;
      const topAnswer = answers.reduce((best, a) => a.probability > best.probability ? a : best);
      const topProb = topAnswer.probability;
      // competitive = how contested (1 = perfect tie, 0 = certainty)
      const competitive = 1 - topProb;

      results.push({
        id: m.id,
        question: m.question,
        source: "manifold",
        eventSlug: m.url,
        eventTitle: m.question,
        categoryslugs: slugs,
        categories: labels,
        image: "",
        // currentPrice = top-answer probability as percentage
        currentPrice: Math.round(topProb * 1000) / 10,
        oneDayChange,
        oneHourChange: 0,
        oneWeekChange: 0,
        oneMonthChange: 0,
        volume24h: m.volume24Hours ?? 0,
        volume1wk: 0,
        volume1mo: 0,
        liquidity: m.totalLiquidity ?? 0,
        createdAt: new Date(m.createdTime).toISOString(),
        endDate,
        // outcomes[] and outcomePrices[] support N answers
        outcomes: answers.map((a) => a.text),
        outcomePrices: answers.map((a) => a.probability),
        bestBid: topProb,
        bestAsk: topProb,
        spread: 0,
        clobTokenId: "",
        description: extractDescription(m.description),
        resolutionSource: m.url,
        competitive,
        polarity: inferPolarity(m.question),
      });
    }
  }

  return results;
}
