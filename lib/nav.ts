import { GUIDE, type GuideId } from "./guide";
import { indexFreshness } from "./index-products";
import { snapshotStatus, type Bootstrap } from "./bootstrap";
import { ATTENTION_LABELS } from "./attention-model";

export const PILLARS = [
  { name: "Today", href: "/", guide: "thesis", icon: "today" },
  { name: "Moves", href: "/moves", guide: "moves", icon: "moves" },
  { name: "Outlooks", href: "/outlooks", guide: "outlooks", icon: "outlooks" },
  { name: "Indices", href: "/pulse", guide: "belief-shift", icon: "indices" },
  { name: "Markets", href: "/markets", guide: "markets", icon: "markets" },
] as const;
export const EXPLORE: { id: GuideId; href: string; icon: string }[] = [
  { id: "moves", href: "/moves", icon: "moves" },
  { id: "outlooks", href: "/outlooks", icon: "outlooks" },
  { id: "newsroom", href: "/#newsroom", icon: "newsroom" },
  {
    id: "belief-shift",
    href: "/pulse?index=belief-shift-economics",
    icon: "indices",
  },
  {
    id: "policy-balance",
    href: "/pulse?index=fed-policy-balance",
    icon: "policy",
  },
  {
    id: "market-attention",
    href: "/pulse?index=market-attention",
    icon: "attention",
  },
  { id: "markets", href: "/markets", icon: "markets" },
  { id: "across-venues", href: "/markets#across-venues", icon: "compare" },
  { id: "saved", href: "/markets?sort=watchlist", icon: "saved" },
];
export const FED_HREF = "/pulse?index=fed-policy-balance";
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const fresh = (b: Bootstrap | undefined, now: number): b is Bootstrap =>
  !!b && snapshotStatus(b.generatedAt, now) !== "stale";
export function fedPresentation(
  b: Bootstrap | undefined,
  now: number,
): "summary" | "fallback-card" | null {
  if (!fresh(b, now)) return null;
  const digest = b.indexProducts,
    p = digest?.outcomeBenchmark;
  if (
    p?.id === "fed-policy-balance" &&
    p.state === "available" &&
    p.issue === null &&
    finite(p.headline) &&
    p.familyId &&
    p.meetingDate &&
    digest?.asOf === b.generatedAt &&
    indexFreshness(digest.asOf, now) !== "stale" &&
    p.shares?.length === 3 &&
    p.shares.every(finite) &&
    p.normalized?.length === 5 &&
    p.normalized.every(finite)
  )
    return "summary";
  const d = b.decisionDistribution;
  if (
    !d ||
    !d.coherent ||
    d.issue !== null ||
    d.asOf !== b.generatedAt ||
    snapshotStatus(d.asOf, now) === "stale" ||
    !d.eventId ||
    !d.meetingDate ||
    d.buckets.length !== 5 ||
    d.buckets.some(
      (v) => !v.marketId || !finite(v.midpoint) || !finite(v.normalized),
    )
  )
    return null;
  if (
    p?.familyId &&
    (p.familyId !== d.eventId || p.meetingDate !== d.meetingDate)
  )
    return null;
  return "fallback-card";
}
export function fedSummary(b: Bootstrap | undefined, now: number) {
  if (fedPresentation(b, now) !== "summary") return null;
  const p = b!.indexProducts!.outcomeBenchmark!;
  const shares = p.shares!;
  const leader = shares.reduce(
    (best, value, i) => (value > shares[best] ? i : best),
    0,
  );
  return {
    outcome: ["Cut", "Hold", "Hike"][leader],
    share: shares[leader],
    lean: p.headline!,
    meeting: p.meetingDate!,
  };
}
export function movesStat(
  b: Bootstrap | undefined,
  now: number,
): string | null {
  if (!fresh(b, now) || b.monitor?.asOf !== b.generatedAt) return null;
  const item = rankedMoves(b.monitor.items)[0];
  return item ? `Top move ${signed(item.change24h)} pp` : null;
}
export function fedStat(b: Bootstrap | undefined, now: number): string | null {
  const p = fedSummary(b, now);
  return p ? `${p.outcome} leads · ${signed(p.lean)}` : null;
}
function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}
function rankedMoves<
  T extends {
    change24h: number;
    currentProbability: number;
    source: string;
    marketId: string;
  },
>(items: T[]): T[] {
  return items
    .filter((m) => finite(m.change24h) && finite(m.currentProbability))
    .sort(
      (a, b) =>
        Math.abs(b.change24h) - Math.abs(a.change24h) ||
        `${a.source}:${a.marketId}`.localeCompare(`${b.source}:${b.marketId}`),
    );
}
export interface BriefingTile {
  id: string;
  guide: GuideId;
  name: string;
  value: string;
  context: string;
  href: string;
  contract?: string;
}
export function briefingTiles(
  b: Bootstrap | undefined,
  now: number,
): BriefingTile[] {
  if (!fresh(b, now)) return [];
  const tiles: BriefingTile[] = [];
  const move =
    b.monitor?.asOf === b.generatedAt
      ? rankedMoves(b.monitor.items)[0]
      : undefined;
  if (move)
    tiles.push({
      id: "move",
      guide: "moves",
      name: "Biggest move",
      value: `${signed(move.change24h)} pp`,
      context: move.question,
      href: "/moves",
      contract: `${move.source}:${move.marketId}`,
    });
  const fed = fedSummary(b, now);
  if (fed)
    tiles.push({
      id: "fed",
      guide: "policy-balance",
      name: "Fed policy balance",
      value: `${fed.outcome} ${(fed.share * 100).toFixed(0)}%`,
      context: fed.meeting,
      href: FED_HREF,
    });
  const digest = b.indexProducts;
  const indexFresh =
    digest?.asOf === b.generatedAt &&
    indexFreshness(digest.asOf, now) !== "stale";
  const belief = indexFresh
    ? digest.products
        .filter((p) => p.state === "available" && finite(p.headline))
        .sort(
          (a, b) => b.headline! - a.headline! || a.id.localeCompare(b.id),
        )[0]
    : undefined;
  if (belief)
    tiles.push({
      id: "belief",
      guide: "belief-shift",
      name: "Belief Shift",
      value: `${belief.headline!.toFixed(1)} pp`,
      context: belief.name,
      href: `/pulse?index=${belief.id}`,
    });
  const attention = indexFresh ? digest.marketAttention : null;
  if (
    tiles.length < 3 &&
    attention?.state === "available" &&
    attention.asOf === b.generatedAt
  ) {
    const group = [...attention.categories]
      .filter((g) => finite(g.share) && g.share > 0)
      .sort((a, b) => b.share - a.share || a.key.localeCompare(b.key))[0];
    if (group)
      tiles.push({
        id: "attention",
        guide: "market-attention",
        name: "Market Attention",
        value: `${(group.share * 100).toFixed(0)}%`,
        context: ATTENTION_LABELS[group.key],
        href: "/pulse?index=market-attention",
      });
  }
  if (tiles.length < 3 && b.observations?.asOf === b.generatedAt) {
    const observed = rankedMoves(b.observations.items).find(
      (m) => !tiles.some((t) => t.contract === `${m.source}:${m.marketId}`),
    );
    if (observed)
      tiles.push({
        id: "observed",
        guide: "observed-moves",
        name: "Observed move",
        value: `${signed(observed.change24h)} pp`,
        context: observed.question,
        href: "/moves#observed-moves",
        contract: `${observed.source}:${observed.marketId}`,
      });
  }
  return tiles.slice(0, 3);
}
export function nextPillar(path: string) {
  const index = PILLARS.findIndex((p) => p.href === path);
  return index >= 0 ? PILLARS[(index + 1) % PILLARS.length] : null;
}
export function exploreHook(id: GuideId) {
  return GUIDE[id].hook;
}
