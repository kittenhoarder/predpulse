import { createHash } from "node:crypto";
import type { GammaEvent, GammaMarket } from "./types";
import { readYesQuote } from "./outlook-quotes";
import { BELIEF_CATEGORIES, BELIEF_METHOD, INDEX_MAPPING, INDEX_MAX_BYTES, INDEX_QUOTE_BASIS,
  observationMove, type BeliefCategory, type BeliefShiftProduct, type IndexObservation,
  type IndexProductsDigest, type IndexQuote, type QuoteIssue } from "./index-products";

const HOUR = 3_600_000, MIN_EVENTS = 5, MAX_EVENTS = 8;
// A small launch catalogue fits the measured 14.6 KB retired Pulse allocation.
export const LAUNCH_CATEGORIES: BeliefCategory[] = ["economics", "politics"];
const CATEGORY_TAGS: Record<BeliefCategory, string[]> = {
  economics: ["economics", "economy", "macro-indicators", "economic-policy"],
  politics: ["politics", "geopolitics", "elections", "global-elections"],
  crypto: ["crypto", "crypto-prices"], tech: ["tech", "ai"],
};
const EXCLUDED_TAGS = new Set(["sports", "games", "pop-culture", "tweets-markets"]);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const shortHash = (value: string) => hash(value).slice(0, 16);
const finiteDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const probability = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

export function primaryBeliefCategory(event: GammaEvent): BeliefCategory | null {
  const tags = new Set((event.tags ?? []).map((tag) => tag.slug?.toLowerCase()));
  if (Array.from(tags).some((tag) => tag && EXCLUDED_TAGS.has(tag))) return null;
  // Explicit precedence: macro policy, politics, crypto, then technology.
  return (Object.keys(CATEGORY_TAGS) as BeliefCategory[]).find((category) =>
    CATEGORY_TAGS[category].some((tag) => tags.has(tag))) ?? null;
}
export function beliefEpoch(asOf: string): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function outcomeId(m: GammaMarket): string | null {
  try {
    const outcomes = JSON.parse(m.outcomes), tokens = JSON.parse(m.clobTokenIds);
    return Array.isArray(outcomes) && outcomes.length === 2 && outcomes[0] === "Yes" && outcomes[1] === "No" &&
      Array.isArray(tokens) && tokens.length === 2 && tokens.every((t) => typeof t === "string" && /^\d{1,96}$/.test(t)) &&
      tokens[0] !== tokens[1] ? tokens[0] : null;
  } catch { return null; }
}
function metadataIssue(e: GammaEvent, m: GammaMarket): QuoteIssue | null {
  return !/^\d{1,30}$/.test(e.id ?? "") || !/^\d{1,30}$/.test(m.id ?? "") ||
    !/^[a-z0-9-]{1,180}$/.test(e.slug ?? "") || !m.question || m.question.length > 200 ||
    !m.description?.trim() || typeof e.description !== "string" ||
    Buffer.byteLength(m.description) > 15_000 || Buffer.byteLength(e.description) > 15_000 ||
    typeof m.resolutionSource !== "string" || !finiteDate(m.endDate) ? "invalid_identity" : null;
}
function usableQuote(e: GammaEvent, m: GammaMarket, now: number): { quote: IndexQuote | null; issue: QuoteIssue | null } {
  if (!e.active || e.closed || e.archived || !m.active || m.closed || m.archived) return { quote: null, issue: "inactive" };
  if (!outcomeId(m)) return { quote: null, issue: "unsupported_outcome" };
  const issue = metadataIssue(e, m);
  if (issue) return { quote: null, issue };
  if (Date.parse(m.endDate) <= now) return { quote: null, issue: "past_close" };
  if (!finiteDate(m.updatedAt) || now - Date.parse(m.updatedAt) < -300_000 || now - Date.parse(m.updatedAt) > 75 * 60_000)
    return { quote: null, issue: "old_record" };
  const book = readYesQuote(m);
  return book.midpoint === null ? { quote: null, issue: "invalid_book" } : {
    quote: { bid: book.bid!, ask: book.ask!, midpoint: book.midpoint, updatedAt: m.updatedAt }, issue: null,
  };
}
function rulesHash(e: GammaEvent, m: GammaMarket): string {
  const normalize = (s: string) => s.replace(/\r\n?/g, "\n").trim();
  return hash(JSON.stringify(["rules-normalization-v1", normalize(e.description), normalize(m.description), m.resolutionSource]));
}
export function observationIdentity(row: IndexObservation): string {
  return hash(JSON.stringify(["polymarket", row.marketId, row.familyId, row.outcomeId, row.question, row.rulesHash, row.closesAt,
    INDEX_MAPPING, INDEX_QUOTE_BASIS, BELIEF_METHOD])).slice(0, 32);
}
function quoteValid(q: IndexQuote, at: string): boolean {
  return !!q && [q.bid, q.ask, q.midpoint].every(probability) && q.ask > 0 && q.bid <= q.ask &&
    q.ask - q.bid <= 0.10 + 1e-9 && Math.abs(q.midpoint - (q.bid + q.ask) / 2) <= 1e-9 &&
    finiteDate(q.updatedAt) && Date.parse(at) - Date.parse(q.updatedAt) >= -300_000 &&
    Date.parse(at) - Date.parse(q.updatedAt) <= 75 * 60_000;
}
export function beliefMetrics(rows: IndexObservation[]): { headline: number; breadth: number } | null {
  const moves = rows.map(observationMove).filter((n): n is number => n !== null);
  return moves.length ? { headline: moves.reduce((s, n) => s + Math.abs(n), 0) / moves.length,
    breadth: moves.filter((n) => Math.abs(n) + 1e-9 >= 3).length / moves.length } : null;
}

/** Pure publication-time calculation. No acquisition, filesystem state or Blob calls. */
export function buildBeliefShift(events: GammaEvent[], previous: IndexProductsDigest | null,
  baseline: IndexProductsDigest | null, asOf: string, categories = LAUNCH_CATEGORIES, cohortLimit = 6): IndexProductsDigest {
  if (!finiteDate(asOf) || categories.length > 4 || new Set(categories).size !== categories.length ||
      categories.some((c) => !(c in BELIEF_CATEGORIES)) || !Number.isInteger(cohortLimit) || cohortLimit < MIN_EVENTS || cohortLimit > MAX_EVENTS) throw new Error("Invalid index capture");
  const now = Date.parse(asOf), epoch = beliefEpoch(asOf);
  if (previous && Date.parse(previous.asOf) > now) throw new Error("Index capture cannot run backwards");
  const validBaseline = baseline?.methodology === BELIEF_METHOD && baseline.mappingVersion === INDEX_MAPPING &&
    baseline.quoteBasis === INDEX_QUOTE_BASIS && Math.abs(now - Date.parse(baseline.asOf) - 24 * HOUR) <= 45 * 60_000 ? baseline : null;
  const oldRows = new Map(previous?.observations.map((r) => [r.marketId, r]) ?? []);
  const priorRows = new Map(validBaseline?.observations.map((r) => [r.marketId, r]) ?? []);
  const current = new Map<string, { event: GammaEvent; market: GammaMarket }>();
  const ambiguous = new Set<string>();
  const candidates = new Map<BeliefCategory, { event: GammaEvent; market: GammaMarket }[]>();
  const exclusions: Record<string, number> = {};
  const exclude = (reason: string) => { exclusions[reason] = (exclusions[reason] ?? 0) + 1; };
  for (const event of events) {
    const category = primaryBeliefCategory(event);
    let representative: GammaMarket | null = null;
    for (const market of event.markets ?? []) {
      // Duplicate vendor identities are ambiguous, not extra observations.
      if (ambiguous.has(market.id) || current.has(market.id)) { exclude("duplicate_identity"); current.delete(market.id); ambiguous.add(market.id); continue; }
      current.set(market.id, { event, market });
      if (!category || !categories.includes(category)) continue;
      const result = usableQuote(event, market, now);
      if (!result.quote) { exclude(result.issue!); continue; }
      if (Date.parse(market.endDate) > now + 90 * 24 * HOUR || result.quote.midpoint < 0.05 || result.quote.midpoint > 0.95 ||
        !Number.isFinite(market.volume24hr) || market.volume24hr < 10_000) { exclude("admission_screen"); continue; }
      if (!representative || market.volume24hr > representative.volume24hr ||
        (market.volume24hr === representative.volume24hr && market.id.localeCompare(representative.id) < 0)) representative = market;
    }
    if (category && representative) candidates.set(category, [...(candidates.get(category) ?? []), { event, market: representative }]);
  }
  const observations: IndexObservation[] = [];
  const products: BeliefShiftProduct[] = categories.map((category) => {
    const eligible = (candidates.get(category) ?? []).filter((r) => !ambiguous.has(r.market.id)).sort((a, b) => b.market.volume24hr - a.market.volume24hr || a.event.id.localeCompare(b.event.id));
    const old = previous?.products.find((p) => p.category === category);
    // Formation needs five independent venue event IDs; after formation the membership is sticky.
    const sameEpoch = old?.epoch === epoch && old.members.length >= MIN_EVENTS;
    const uniqueFamilies = Array.from(new Map(eligible.map((r) => [r.event.id, r])).values());
    const members = sameEpoch ? old!.members : uniqueFamilies.length >= MIN_EVENTS ? uniqueFamilies.slice(0, cohortLimit).map((r) => r.market.id) : [];
    const cohortHash = shortHash(JSON.stringify([epoch, members]));
    const rows = members.map((marketId): IndexObservation => {
      const item = current.get(marketId), saved = oldRows.get(marketId);
      if (!item && !saved) throw new Error("Missing pinned index identity");
      const result = item ? usableQuote(item.event, item.market, now) : { quote: null, issue: "missing" as const };
      // Invalid identity metadata cannot overwrite a known pinned identity.
      const known = item && !metadataIssue(item.event, item.market) && outcomeId(item.market) ? {
        marketId, familyId: item.event.id, outcomeId: outcomeId(item.market)!, question: item.market.question,
        eventSlug: item.event.slug, closesAt: item.market.endDate, rulesHash: rulesHash(item.event, item.market),
      } : saved!;
      const row: IndexObservation = { marketId: known.marketId, familyId: known.familyId, outcomeId: known.outcomeId,
        question: known.question, eventSlug: known.eventSlug, closesAt: known.closesAt, rulesHash: known.rulesHash,
        quote: result.quote, issue: result.issue, prior: null, comparisonIssue: validBaseline ? "missing_prior" : "no_baseline" };
      const prior = priorRows.get(marketId);
      if (prior && validBaseline) {
        if (observationIdentity(row) !== observationIdentity(prior)) row.comparisonIssue = "identity_changed";
        else if (!row.quote || !prior.quote || !quoteValid(prior.quote, validBaseline.asOf)) row.comparisonIssue = "invalid_prior";
        else { row.prior = { ...prior.quote, identity: observationIdentity(prior) }; row.comparisonIssue = null; }
      }
      if (row.issue) exclude(row.issue);
      if (row.comparisonIssue) exclude(row.comparisonIssue);
      return row;
    });
    observations.push(...rows);
    const paired = rows.filter((r) => r.quote && r.prior);
    const usable = rows.filter((r) => r.quote).length;
    const ready = paired.length >= MIN_EVENTS && paired.length / members.length >= 0.8;
    const metrics = ready ? beliefMetrics(rows) : null;
    const reason = members.length < MIN_EVENTS ? "insufficient_events" : usable < MIN_EVENTS || usable / members.length < 0.8 ? "insufficient_quotes" :
      !validBaseline ? "capturing_baseline" : ready ? null : "insufficient_pairs";
    const pairHash = shortHash(JSON.stringify(paired.map((r) => r.marketId)));
    const segment = shortHash(cohortHash + pairHash);
    const history = [...(old?.history ?? []).filter((p) => Math.floor(Date.parse(p.at) / HOUR) !== Math.floor(now / HOUR)),
      { at: asOf, value: metrics?.headline ?? null, segment }].slice(-25);
    return { id: `belief-shift-${category}`, type: "belief-shift", category, name: BELIEF_CATEGORIES[category], unit: "pp",
      epoch, cohortHash, members, state: ready ? "available" : reason === "capturing_baseline" ? "warming" : "unavailable",
      reason, coverage: { eligible: uniqueFamilies.length, admitted: members.length, usable, comparable: paired.length },
      headline: metrics?.headline ?? null, breadth: metrics?.breadth ?? null, materialMovePP: 3, pairHash, history };
  });
  return fitIndexDigest({ version: 1, methodology: BELIEF_METHOD, mappingVersion: INDEX_MAPPING, quoteBasis: INDEX_QUOTE_BASIS,
    source: "polymarket", asOf, baselineAt: validBaseline?.asOf ?? null, screened: events.length, products, observations, exclusions });
}

/** Reduce optional history only. Required identities, pairs and cohort members stay intact. */
export function fitIndexDigest(digest: IndexProductsDigest, maxBytes = INDEX_MAX_BYTES): IndexProductsDigest {
  const d = structuredClone(digest);
  while (Buffer.byteLength(JSON.stringify(d)) > maxBytes) {
    const product = [...d.products].sort((a, b) => b.history.length - a.history.length).find((p) => p.history.length > 1);
    if (!product) throw new Error("Index evidence exceeds replacement allocation");
    product.history.shift();
  }
  return validateIndexProducts(d, d.asOf);
}

/** Validate saved arithmetic and bounds without acquiring or recomputing a source universe. */
export function validateIndexProducts(value: unknown, asOf: string): IndexProductsDigest {
  const d = value as IndexProductsDigest;
  const fail = () => { throw new Error("Invalid saved index products"); };
  if (!d || d.version !== 1 || d.methodology !== BELIEF_METHOD || d.mappingVersion !== INDEX_MAPPING ||
    d.quoteBasis !== INDEX_QUOTE_BASIS || d.source !== "polymarket" || d.asOf !== asOf || !finiteDate(asOf) ||
    (d.baselineAt !== null && (!finiteDate(d.baselineAt) || Math.abs(Date.parse(asOf) - Date.parse(d.baselineAt) - 24 * HOUR) > 45 * 60_000)) ||
    !Number.isInteger(d.screened) || d.screened < 0 || !Array.isArray(d.products) || d.products.length > 4 ||
    !Array.isArray(d.observations) || d.observations.length > 32 || !d.exclusions ||
    Object.values(d.exclusions).some((n) => !Number.isInteger(n) || n < 0) || Buffer.byteLength(JSON.stringify(d)) > INDEX_MAX_BYTES) return fail();
  const ids = new Set<string>(), categories = new Set<string>();
  for (const row of d.observations) {
    if (!row || !/^\d{1,30}$/.test(row.marketId) || ids.has(row.marketId) || !/^\d{1,30}$/.test(row.familyId) ||
      !/^\d{1,96}$/.test(row.outcomeId) || typeof row.question !== "string" || !row.question || row.question.length > 200 ||
      !/^[a-z0-9-]{1,180}$/.test(row.eventSlug) || !finiteDate(row.closesAt) || !/^[a-f0-9]{64}$/.test(row.rulesHash) ||
      (row.quote !== null && (!quoteValid(row.quote, asOf) || Date.parse(row.closesAt) <= Date.parse(asOf) || row.issue !== null)) ||
      (row.quote === null && !["missing", "inactive", "unsupported_outcome", "invalid_identity", "invalid_book", "old_record", "past_close"].includes(row.issue!)) ||
      (row.prior !== null && (!d.baselineAt || !row.quote || !quoteValid(row.prior, d.baselineAt) || row.prior.identity !== observationIdentity(row) || row.comparisonIssue !== null)) ||
      (row.prior === null && !["no_baseline", "missing_prior", "identity_changed", "invalid_prior"].includes(row.comparisonIssue!))) return fail();
    ids.add(row.marketId);
  }
  const referenced = new Set<string>();
  for (const p of d.products) {
    if (!p || !(p.category in BELIEF_CATEGORIES) || categories.has(p.category) || p.id !== `belief-shift-${p.category}` ||
      p.type !== "belief-shift" || p.unit !== "pp" || p.name !== BELIEF_CATEGORIES[p.category] || p.epoch !== beliefEpoch(asOf) ||
      !Array.isArray(p.members) || (p.members.length > 0 && p.members.length < MIN_EVENTS) || p.members.length > MAX_EVENTS ||
      new Set(p.members).size !== p.members.length || p.members.some((id) => !ids.has(id) || referenced.has(id)) ||
      p.cohortHash !== shortHash(JSON.stringify([p.epoch, p.members])) || p.materialMovePP !== 3 || !p.coverage) return fail();
    categories.add(p.category); p.members.forEach((id) => referenced.add(id));
    const rows = p.members.map((id) => d.observations.find((r) => r.marketId === id)!);
    const usable = rows.filter((r) => r.quote).length, paired = rows.filter((r) => r.prior && r.quote);
    const ready = paired.length >= MIN_EVENTS && paired.length / rows.length >= 0.8;
    const metrics = ready ? beliefMetrics(rows) : null;
    const reason = rows.length < MIN_EVENTS ? "insufficient_events" : usable < MIN_EVENTS || usable / rows.length < 0.8 ? "insufficient_quotes" :
      !d.baselineAt ? "capturing_baseline" : ready ? null : "insufficient_pairs";
    if (new Set(rows.map((r) => r.familyId)).size !== rows.length || p.coverage.admitted !== rows.length ||
      p.coverage.usable !== usable || p.coverage.comparable !== paired.length || !Number.isInteger(p.coverage.eligible) || p.coverage.eligible < 0 ||
      p.reason !== reason || p.state !== (ready ? "available" : reason === "capturing_baseline" ? "warming" : "unavailable") ||
      p.pairHash !== shortHash(JSON.stringify(paired.map((r) => r.marketId))) ||
      (metrics ? typeof p.headline !== "number" || !Number.isFinite(p.headline) || Math.abs(p.headline - metrics.headline) > 1e-9 ||
        typeof p.breadth !== "number" || !Number.isFinite(p.breadth) || Math.abs(p.breadth - metrics.breadth) > 1e-9 : p.headline !== null || p.breadth !== null) ||
      !Array.isArray(p.history) || !p.history.length || p.history.length > 25 || p.history.some((point, i) =>
        !finiteDate(point.at) || Date.parse(point.at) > Date.parse(asOf) || (i > 0 && Math.floor(Date.parse(point.at) / HOUR) <= Math.floor(Date.parse(p.history[i - 1].at) / HOUR)) ||
        (point.value !== null && (typeof point.value !== "number" || !Number.isFinite(point.value) || point.value < 0 || point.value > 100)) || !/^[a-f0-9]{16}$/.test(point.segment)) ||
      p.history.at(-1)!.at !== asOf || p.history.at(-1)!.value !== p.headline ||
      p.history.at(-1)!.segment !== shortHash(p.cohortHash + p.pairHash)) return fail();
  }
  if (referenced.size !== ids.size) return fail();
  return d;
}
