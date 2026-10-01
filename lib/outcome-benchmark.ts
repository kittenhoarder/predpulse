import type { GammaEvent } from "./types";
import type { DecisionDistribution } from "./decision-distribution";
import { DECISION_METHOD, buildDecisionDistribution } from "./decision-distribution";
import { buildBeliefShift, fitIndexDigest } from "./belief-shift";
import { metadataIssue, observationIdentity, outcomeId, quoteValid, rulesHash, usableQuote } from "./index-evidence";
import { identity, partition } from "./policy-evidence";
import { POLICY_METHOD, POLICY_NORMALIZATION, type IndexProductsDigest, type OutcomeBenchmark } from "./index-products";
const HOUR = 3_600_000;

/** Shares the existing acquisition, adapter and snapshot reads. Evidence is stored once per market. */
export function buildIndexProducts(events: GammaEvent[], previous: IndexProductsDigest | null,
  baseline: IndexProductsDigest | null, asOf: string, suppliedDecision?: DecisionDistribution | null): IndexProductsDigest {
  const digest = buildBeliefShift(events, previous, baseline, asOf);
  const decision = suppliedDecision === undefined ? buildDecisionDistribution(events, asOf) : suppliedDecision;
  const event = events.find((e) => e.id === decision?.eventId);
  const p: OutcomeBenchmark = {
    id: "fed-policy-balance", type: "outcome-benchmark", name: "Fed policy balance", unit: "pp",
    methodology: POLICY_METHOD, adapter: DECISION_METHOD, normalization: POLICY_NORMALIZATION,
    meetingDate: decision?.meetingDate ?? null, familyId: decision?.eventId ?? null,
    members: Array(5).fill(null), identity: "", state: "unavailable", issue: decision?.issue ?? "no_supported_meeting",
    headline: null, rawSum: null, normalized: null, shares: null, prior: null, change24h: null,
    comparisonIssue: "capturing_baseline", expectedChangeBps: null, history: [],
  };
  if (decision && event) {
    p.issue = decision.issue;
    for (let i = 0; i < 5; i++) {
      const id = decision.buckets[i].marketId;
      const matches = event.markets?.filter((m) => m.id === id) ?? [];
      const market = matches.length === 1 ? matches[0] : null;
      if (!market || metadataIssue(event, market) || !outcomeId(market)) { p.issue ??= "invalid_identity"; continue; }
      p.members[i] = market.id;
      if (!digest.observations.some((r) => r.marketId === id)) {
        const result = usableQuote(event, market, Date.parse(asOf));
        digest.observations.push({ marketId: market.id, familyId: event.id, outcomeId: outcomeId(market)!,
          question: market.question, eventSlug: event.slug, closesAt: market.endDate, rulesHash: rulesHash(event, market),
          ...result, prior: null, comparisonIssue: digest.baselineAt ? "missing_prior" : "no_baseline" });
      }
    }
  }
  const rows = p.members.map((id) => digest.observations.find((r) => r.marketId === id));
  if (p.members.filter(Boolean).length !== new Set(p.members.filter(Boolean)).size) { p.members = Array(5).fill(null); p.issue = "invalid_identity"; }
  p.identity = identity(p, digest.observations);
  const current = !p.issue && rows.every((r) => r?.quote) ? partition(rows.map((r) => r!.quote!.midpoint)) : null;
  if (current) { Object.assign(p, current); p.state = "available"; }
  else p.issue ??= "invalid_quotes";
  const priorProduct = digest.baselineAt ? baseline?.outcomeBenchmark : null;
  if (priorProduct) {
    p.comparisonIssue = priorProduct.meetingDate !== p.meetingDate || priorProduct.familyId !== p.familyId ? "meeting_changed" :
      priorProduct.methodology !== POLICY_METHOD || priorProduct.adapter !== DECISION_METHOD || priorProduct.normalization !== POLICY_NORMALIZATION ||
      priorProduct.identity !== p.identity ? "identity_changed" : "invalid_prior";
    const priorRows = p.members.map((id) => baseline!.observations.find((r) => r.marketId === id));
    if (current && priorProduct.state === "available" && p.comparisonIssue === "invalid_prior" &&
      priorRows.every((r, i) => r?.quote && quoteValid(r.quote, baseline!.asOf) && observationIdentity(r) === observationIdentity(rows[i]!))) {
      p.prior = partition(priorRows.map((r) => r!.quote!.midpoint));
      if (p.prior) {
        p.change24h = p.headline! - p.prior.headline; p.comparisonIssue = null;
        rows.forEach((row, i) => { row!.prior = { ...priorRows[i]!.quote!, identity: observationIdentity(priorRows[i]!) }; row!.comparisonIssue = null; });
      }
    }
  }
  const old = previous?.outcomeBenchmark;
  p.history = [...(old?.history ?? []).filter((point) => Math.floor(Date.parse(point.at) / HOUR) !== Math.floor(Date.parse(asOf) / HOUR)),
    { at: asOf, value: p.headline, segment: p.identity.slice(0, 16) }].slice(-25);
  digest.outcomeBenchmark = p;
  // Orphan observations can only arise from an ambiguous family. Keep unrelated products intact.
  const referenced = new Set([...digest.products.flatMap((product) => product.members), ...p.members.filter((id): id is string => !!id)]);
  digest.observations = digest.observations.filter((r) => referenced.has(r.marketId));
  return fitIndexDigest(digest);
}
