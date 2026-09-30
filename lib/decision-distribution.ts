import { createHash } from "node:crypto";
import type { GammaEvent } from "./types";
import { readYesQuote } from "./outlook-quotes";

// This is a versioned adapter for one explicit contract family, not a title matcher.
export const DECISION_METHOD = "fed-meeting-buckets-v1";
export const DECISION_MAX_BYTES = 12_000;
const LABELS = ["50+ bps decrease", "25 bps decrease", "No change", "25 bps increase", "50+ bps increase"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_QUOTE_AGE = 75 * 60_000;
export type DecisionIssue = "missing_buckets" | "unsupported_buckets" | "rule_mismatch" | "invalid_quotes" | "old_quotes" | "price_sum";

export interface DecisionBucket {
  label: string;
  marketId: string | null;
  bid: number | null;
  ask: number | null;
  midpoint: number | null;
  normalized: number | null;
  venueUpdatedAt: string | null;
}

export interface DecisionDistribution {
  version: 1;
  methodology: typeof DECISION_METHOD;
  source: "polymarket";
  eventId: string;
  eventUrl: string;
  meetingDate: string;
  closesAt: string;
  asOf: string;
  rules: string;
  rulesHash: string;
  buckets: DecisionBucket[];
  rawSum: number | null;
  coherent: boolean;
  issue: DecisionIssue | null;
  directionShares: { cut: number; hold: number; hike: number } | null;
  // Open-ended tails do not have known decision values. Never substitute +/-50.
  expectedChangeBps: null;
}

function clean(value: string): string {
  return value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** Require the named meeting and contract's explicit upper-bound/rounding rules. */
function meetingDate(event: GammaEvent): string | null {
  if (!/^Fed Decision in [A-Za-z]+\?$/i.test(event.title)) return null;
  const rules = clean(event.description ?? "");
  if (!rules.includes("upper bound of the target federal funds") ||
      !rules.includes("rounded up to the nearest 25") ||
      !rules.includes('resolve to the "No change" bracket') ||
      !rules.includes("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm") ||
      !/resolution source.*FOMC.*statement/i.test(rules)) return null;
  const match = rules.match(/meeting scheduled for ([A-Za-z]+) (\d{1,2})(?:[-–](\d{1,2}))?, (\d{4})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]);
  const day = Number(match[3] ?? match[2]);
  const year = Number(match[4]);
  if (month < 0 || Number(match[2]) > day || !event.title.toLowerCase().includes(match[1].toLowerCase())) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day || year < 2020 || year > 2100) return null;
  return date.toISOString().slice(0, 10);
}


/** Pure, bounded publication-time discovery. No vendor or storage calls. */
export function buildDecisionDistribution(events: GammaEvent[], asOf: string): DecisionDistribution | null {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid decision timestamp");
  const candidates = events.filter((event) => event.active && !event.closed && !event.archived)
    .map((event) => ({ event, date: meetingDate(event) }))
    .filter((item): item is { event: GammaEvent; date: string } => !!item.date && Date.parse(`${item.date}T23:59:59Z`) > now)
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id));
  // Keep the nearest meeting even if its coverage is incomplete. Do not silently roll forward.
  const selected = candidates[0];
  if (!selected || !/^[a-z0-9-]+$/.test(selected.event.slug)) return null;
  const { event, date } = selected;
  const rules = clean(event.description);
  if (rules.length > 5_000) return null;
  const markets = event.markets ?? [];
  const groups = LABELS.map((label) => markets.filter((m) => clean(m.groupItemTitle ?? "") === label));
  const buckets = LABELS.map((label, i): DecisionBucket => {
    const market = groups[i].length === 1 ? groups[i][0] : undefined;
    return { label, marketId: market?.id ?? null, ...readYesQuote(market), normalized: null,
      venueUpdatedAt: market?.updatedAt && Number.isFinite(Date.parse(market.updatedAt)) ? market.updatedAt : null };
  });
  const closesAt = groups.flat()[0]?.endDate ?? "";
  const complete = groups.every((group) => group.length === 1);
  const validRules = complete && markets.every((m) => clean(m.description ?? "") === rules && m.endDate === closesAt) &&
    Date.parse(closesAt) > now && Date.parse(closesAt) >= Date.parse(date) &&
    Date.parse(closesAt) - Date.parse(date) <= 45 * 86400_000;
  const validQuotes = buckets.every((bucket) => bucket.midpoint !== null);
  const recent = buckets.every((bucket) => bucket.venueUpdatedAt &&
    now - Date.parse(bucket.venueUpdatedAt) >= -5 * 60_000 && now - Date.parse(bucket.venueUpdatedAt) <= MAX_QUOTE_AGE);
  const rawSum = validQuotes ? buckets.reduce((sum, bucket) => sum + bucket.midpoint!, 0) : null;
  const issue: DecisionIssue | null = !complete ? "missing_buckets" : markets.length !== LABELS.length ? "unsupported_buckets" :
    !validRules ? "rule_mismatch" : !validQuotes ? "invalid_quotes" : !recent ? "old_quotes" :
    rawSum === null || rawSum < 0.95 - 1e-9 || rawSum > 1.05 + 1e-9 ? "price_sum" : null;
  const coherent = issue === null;
  if (coherent) for (const bucket of buckets) bucket.normalized = bucket.midpoint! / rawSum!;
  const result: DecisionDistribution = {
    version: 1, methodology: DECISION_METHOD, source: "polymarket", eventId: event.id,
    eventUrl: `https://polymarket.com/event/${event.slug}`, meetingDate: date,
    closesAt: Number.isFinite(Date.parse(closesAt)) ? closesAt : `${date}T23:59:59Z`,
    asOf, rules, rulesHash: createHash("sha256").update(rules).digest("hex"), buckets, rawSum, coherent, issue,
    directionShares: coherent ? { cut: buckets[0].normalized! + buckets[1].normalized!, hold: buckets[2].normalized!,
      hike: buckets[3].normalized! + buckets[4].normalized! } : null,
    expectedChangeBps: null,
  };
  return validateDecisionDistribution(result, asOf);
}

/** Validate saved data, including derived values, before serving it to visitors. */
export function validateDecisionDistribution(value: unknown, asOf: string): DecisionDistribution {
  const d = value as DecisionDistribution;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!d || d.version !== 1 || d.methodology !== DECISION_METHOD || d.source !== "polymarket" ||
      d.asOf !== asOf || !Number.isFinite(Date.parse(asOf)) || !/^\d{4}-\d{2}-\d{2}$/.test(d.meetingDate) ||
      !Number.isFinite(Date.parse(d.closesAt)) || !/^https:\/\/polymarket\.com\/event\/[a-z0-9-]+$/.test(d.eventUrl) ||
      typeof d.eventId !== "string" || !d.eventId || typeof d.coherent !== "boolean" ||
      typeof d.rules !== "string" || createHash("sha256").update(d.rules).digest("hex") !== d.rulesHash ||
      !Array.isArray(d.buckets) || d.buckets.length !== LABELS.length || d.expectedChangeBps !== null ||
      Buffer.byteLength(JSON.stringify(d)) > DECISION_MAX_BYTES) throw new Error("Invalid decision distribution");
  for (let i = 0; i < d.buckets.length; i++) {
    const b = d.buckets[i];
    if (b.label !== LABELS[i] || (b.marketId !== null && (typeof b.marketId !== "string" || !b.marketId)) ||
        ![b.bid, b.ask, b.midpoint, b.normalized].every((n) => n === null || valid(n)) ||
        (b.venueUpdatedAt !== null && !Number.isFinite(Date.parse(b.venueUpdatedAt))) ||
        (b.midpoint !== null && (b.bid === null || b.ask === null || b.ask <= 0 || b.bid > b.ask ||
          b.ask - b.bid > 0.10 + 1e-9 || Math.abs(b.midpoint - (b.bid + b.ask) / 2) > 1e-9))) throw new Error("Invalid decision bucket");
  }
  const sum = d.buckets.every((b) => b.midpoint !== null) ? d.buckets.reduce((s, b) => s + b.midpoint!, 0) : null;
  const ids = d.buckets.map((b) => b.marketId).filter((id) => id !== null);
  if (new Set(ids).size !== ids.length || (sum === null) !== (d.rawSum === null) ||
      (sum !== null && (typeof d.rawSum !== "number" || !Number.isFinite(d.rawSum) || Math.abs(sum - d.rawSum) > 1e-9))) throw new Error("Invalid decision sum");
  if (d.coherent) {
    if (d.issue !== null || sum === null || sum < 0.95 - 1e-9 || sum > 1.05 + 1e-9 || !d.directionShares ||
        d.buckets.some((b) => !b.marketId || !b.venueUpdatedAt ||
          Date.parse(asOf) - Date.parse(b.venueUpdatedAt) < -5 * 60_000 || Date.parse(asOf) - Date.parse(b.venueUpdatedAt) > MAX_QUOTE_AGE ||
          b.normalized === null || Math.abs(b.normalized - b.midpoint! / sum) > 1e-9)) throw new Error("Invalid normalized distribution");
    const expected = [d.buckets[0].normalized! + d.buckets[1].normalized!, d.buckets[2].normalized!, d.buckets[3].normalized! + d.buckets[4].normalized!];
    if ([d.directionShares.cut, d.directionShares.hold, d.directionShares.hike].some((n, i) => !valid(n) || Math.abs(n - expected[i]) > 1e-9)) throw new Error("Invalid decision shares");
  } else if (!d.issue || !["missing_buckets", "unsupported_buckets", "rule_mismatch", "invalid_quotes", "old_quotes", "price_sum"].includes(d.issue) ||
      d.directionShares !== null || d.buckets.some((b) => b.normalized !== null)) throw new Error("Ineligible decision summary");
  return d;
}
