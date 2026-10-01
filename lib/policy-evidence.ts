import { createHash } from "node:crypto";
import { DECISION_METHOD } from "./decision-distribution";
import { observationIdentity } from "./index-evidence";
import { POLICY_METHOD, POLICY_NORMALIZATION, type IndexObservation, type IndexProductsDigest, type OutcomeBenchmark } from "./index-products";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
const HOUR = 3_600_000;
export function partition(values: number[]) {
  const rawSum = values.reduce((s, n) => s + n, 0);
  if (values.length !== 5 || values.some((n) => !Number.isFinite(n) || n < 0 || n > 1) || rawSum < .95 - 1e-9 || rawSum > 1.05 + 1e-9) return null;
  const normalized = values.map((n) => n / rawSum);
  const shares: [number, number, number] = [normalized[0] + normalized[1], normalized[2], normalized[3] + normalized[4]];
  return { rawSum, normalized, shares, headline: 100 * (shares[2] - shares[0]) };
}
export function identity(p: OutcomeBenchmark, rows: IndexObservation[]) {
  return hash([POLICY_METHOD, DECISION_METHOD, POLICY_NORMALIZATION, p.meetingDate, p.familyId,
    p.members.map((id) => id ? rows.find((r) => r.marketId === id) : null).map((r) => r ? observationIdentity(r) : null)]);
}

/** Reproduce every derived value from saved quotes; reject incomplete partitions and fabricated comparisons. */
export function validateOutcomeBenchmark(p: OutcomeBenchmark, digest: IndexProductsDigest): void {
  const fail = () => { throw new Error("Invalid saved outcome benchmark"); };
  if (!p || p.id !== "fed-policy-balance" || p.type !== "outcome-benchmark" || p.name !== "Fed policy balance" || p.unit !== "pp" ||
    p.methodology !== POLICY_METHOD || p.adapter !== DECISION_METHOD || p.normalization !== POLICY_NORMALIZATION || p.expectedChangeBps !== null ||
    (p.meetingDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(p.meetingDate) || !Number.isFinite(Date.parse(p.meetingDate)))) ||
    (p.familyId !== null && !/^\d{1,30}$/.test(p.familyId)) || !Array.isArray(p.members) || p.members.length !== 5 ||
    new Set(p.members.filter(Boolean)).size !== p.members.filter(Boolean).length ||
    p.members.some((id) => id !== null && !digest.observations.some((r) => r.marketId === id)) ||
    p.identity !== identity(p, digest.observations)) return fail();
  const rows = p.members.map((id) => digest.observations.find((r) => r.marketId === id));
  const current = rows.every((r) => r?.quote) ? partition(rows.map((r) => r!.quote!.midpoint)) : null;
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (p.state === "available") {
    if (p.issue !== null || !p.meetingDate || !current || rows.some((r) => r!.familyId !== p.familyId || r!.closesAt !== rows[0]!.closesAt || r!.rulesHash !== rows[0]!.rulesHash) ||
      Date.parse(rows[0]!.closesAt) < Date.parse(p.meetingDate) || Date.parse(rows[0]!.closesAt) - Date.parse(p.meetingDate) > 45 * 86400_000 ||
      !equal([p.headline, p.rawSum, p.normalized, p.shares], [current.headline, current.rawSum, current.normalized, current.shares])) return fail();
  } else if (p.state !== "unavailable" || !["no_supported_meeting", "missing_buckets", "unsupported_buckets", "rule_mismatch", "invalid_quotes", "old_quotes", "price_sum", "invalid_identity"].includes(p.issue!) ||
    [p.headline, p.rawSum, p.normalized, p.shares].some((n) => n !== null)) return fail();
  if (p.prior) {
    const prior = rows.every((r) => r?.prior) ? partition(rows.map((r) => r!.prior!.midpoint)) : null;
    if (!digest.baselineAt || p.state !== "available" || p.comparisonIssue !== null || !prior || !equal(p.prior, prior) || p.change24h !== p.headline! - prior.headline) return fail();
  } else if (p.change24h !== null || !["capturing_baseline", "meeting_changed", "identity_changed", "invalid_prior"].includes(p.comparisonIssue!)) return fail();
  if (!Array.isArray(p.history) || !p.history.length || p.history.length > 25 || p.history.some((point, i) =>
    !Number.isFinite(Date.parse(point.at)) || Date.parse(point.at) > Date.parse(digest.asOf) ||
    (i > 0 && Math.floor(Date.parse(point.at) / HOUR) <= Math.floor(Date.parse(p.history[i - 1].at) / HOUR)) ||
    !/^[a-f0-9]{16}$/.test(point.segment) || (point.value !== null && (!Number.isFinite(point.value) || point.value < -100 || point.value > 100))) ||
    p.history.at(-1)!.at !== digest.asOf || p.history.at(-1)!.value !== p.headline || p.history.at(-1)!.segment !== p.identity.slice(0, 16)) return fail();
}
