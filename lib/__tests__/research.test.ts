import { describe, expect, it } from "vitest";
import { buildResearch, validateResearch, referenceAt, archiveReferences } from "../research";
import { researchEvaluation, evaluateForecastCases, type ForecastCase } from "../research-evaluation";
import { brierScore, logLoss, auc } from "../index-metrics";
import { POST } from "../../app/api/indices/outcomes/route";
import { delta24h } from "../indices";
import type { GammaEvent, GammaMarket } from "../types";

const asOf = "2026-09-30T14:00:00Z";
function event(): GammaEvent {
  return { id: "event-1", title: "CPI inflation in October", slug: "cpi-october", volume24hr: 50_000,
    active: true, closed: false, archived: false,
    markets: [{ id: "123", question: "Will CPI exceed 3%?", outcomes: '["Yes","No"]', clobTokenIds: '["token-yes","token-no"]',
      active: true, closed: false, archived: false, description: "Resolves YES for the first official CPI release above 3%.",
      volume24hr: 50_000, bestBid: 0.49, bestAsk: 0.51, updatedAt: asOf,
      endDate: "2026-10-10T14:00:00Z", outcomePrices: '["0.5","0.5"]' } as GammaMarket],
  } as GammaEvent;
}
describe("durable point-in-time evidence", () => {
  it("reproduces a saved observation after serialize/reload without process memory", () => {
    const d = buildResearch([event()], [], null, null, asOf);
    expect(validateResearch(JSON.parse(JSON.stringify(d)), asOf)).toEqual(d);
    expect(d.contracts[0].midpoint).toBe(0.5);
    expect(d.contracts[0].rulesHash).toHaveLength(64);
    expect(d.contracts[0].change24hPP).toBeNull();
    expect(buildResearch([event()], [], null, null, asOf)).toEqual(d);
  });
  it("reconstructs a 24h change only for an exact valid pair and saves both inputs", () => {
    const priorEvent = event(); priorEvent.markets![0].updatedAt = "2026-09-29T14:00:00Z";
    const prior = buildResearch([priorEvent], [], null, null, "2026-09-29T14:00:00Z");
    const e = event(); e.markets![0].bestBid = 0.59; e.markets![0].bestAsk = 0.61;
    const d = buildResearch([e], [], prior, prior, asOf);
    expect(d.contracts[0].change24hPP).toBe(10);
    expect(d.contracts[0].previous24h?.midpoint).toBe(0.5);
    const corrupt = structuredClone(d); corrupt.contracts[0].change24hPP = 99;
    expect(() => validateResearch(corrupt, asOf)).toThrow();
    e.markets![0].description += " Revised rules.";
    expect(buildResearch([e], [], prior, prior, asOf).contracts[0].change24hPP).toBeNull();
    expect(prior.contracts[0].rules).not.toContain("Revised");
  });
  it("retains missing/discontinued contracts and never reuses their previous price", () => {
    const old = buildResearch([event()], [], null, null, asOf);
    const next = buildResearch([], [], old, null, "2026-09-30T15:00:00Z");
    expect(next.contracts[0]).toMatchObject({ marketId: "123", status: "missing", midpoint: null, change24hPP: null });
    expect(next.contracts[0].rulesHash).toBe(old.contracts[0].rulesHash);
  });
  it("adds idempotent venue settlement revisions without overwriting previous generations", () => {
    const initial = buildResearch([event()], [], null, null, asOf);
    const market = { ...event().markets![0], closed: true, umaResolutionStatus: "resolved", outcomePrices: '["1","0"]' };
    const first = buildResearch([], [market], initial, null, "2026-09-30T15:00:00Z");
    const repeat = buildResearch([], [market], first, null, "2026-09-30T16:00:00Z");
    expect(repeat.contracts[0].resolutions).toHaveLength(1);
    market.outcomePrices = '["0","1"]';
    const correction = buildResearch([], [market], repeat, null, "2026-09-30T17:00:00Z");
    expect(correction.contracts[0].resolutions.map((r) => r.outcomeYes)).toEqual([1, 0]);
    expect(initial.contracts[0].resolutions).toEqual([]);
    expect(first.contracts[0].resolutions[0].outcomeYes).toBe(1);
    expect(researchEvaluation(correction).forecast.brier).toBeNull();
    expect(researchEvaluation(correction).missingPublicResultTime).toBe(1);
  });
  it.each(["proposed", "disputed", undefined])("does not resolve closed books with status %s", (umaResolutionStatus) => {
    const old = buildResearch([event()], [], null, null, asOf);
    const m = { ...event().markets![0], closed: true, umaResolutionStatus, outcomePrices: '["1","0"]' };
    expect(buildResearch([], [m], old, null, asOf).contracts[0].resolutions).toEqual([]);
  });
  it("rejects reordered outcomes rather than assigning them to a retained YES token", () => {
    const old = buildResearch([event()], [], null, null, asOf);
    const e = event(); e.markets![0].outcomes = '["No","Yes"]';
    expect(buildResearch([e], [], old, null, asOf).contracts[0].midpoint).toBeNull();
  });
  it("bounds the cohort to one contract per family and 16 families", () => {
    const events = Array.from({ length: 20 }, (_, i) => { const e = event(); e.id = `event-${i}`; e.markets![0].id = `${i + 1}`; return e; });
    const d = buildResearch(events, [], null, null, asOf);
    expect(d.contracts).toHaveLength(16); expect(d.capacityExcluded).toBe(4);
  });
  it("indexes existing generations within the 30-day/750-reference bound", () => {
    const refs = Array.from({ length: 1000 }, (_, i) => ({ generatedAt: new Date(Date.parse(asOf) - i * 3_600_000).toISOString(), url: `generation-${i}` }));
    const archive = archiveReferences(refs, refs[0]);
    expect(archive.length).toBeLessThanOrEqual(750);
    expect(Date.parse(archive[0].generatedAt) >= Date.parse("2026-08-31T14:00:00Z")).toBe(true);
    expect(referenceAt(archive, "2026-09-29T14:30:00Z")?.generatedAt).toBe("2026-09-29T14:00:00.000Z");
    expect(referenceAt(archive, "2026-01-01T00:00:00Z")).toBeNull();
  });
  it("rejects the legacy public outcome write endpoint", async () => {
    expect((await POST()).status).toBe(410);
  });
  it("returns null when the index has no point near t-24h", () => {
    expect(delta24h([], asOf, 50)).toBeNull();
    expect(delta24h([{ timestamp: "2026-09-30T13:00:00Z", score: 40 } as never], asOf, 50)).toBeNull();
    expect(delta24h([{ timestamp: "2026-09-29T14:30:00Z", score: 40 } as never], asOf, 50)).toBe(10);
  });
});
describe("honest evaluation metrics", () => {
  it("uses null for missing/invalid data, while genuine perfect forecasts still score zero", () => {
    expect(brierScore([], [])).toBeNull(); expect(logLoss([], [])).toBeNull();
    expect(brierScore([NaN], [1])).toBeNull(); expect(auc([0.4], [1])).toBeNull();
    expect(brierScore([1, 0], [1, 0])).toBe(0);
    expect(brierScore([0.25, 0.75], [0, 1])).toBe(0.0625);
  });
  it("enforces chronological holdout, lead time, frozen rules and event-family sample size", () => {
    const c: ForecastCase = { familyId: "f1", probability: 0.8, outcomeYes: 1, savedAt: asOf,
      publicResultAt: "2026-10-01T14:00:00Z", leadHours: 24, rulesHash: "a", outcomeRulesHash: "a", methodology: "v1" };
    const valid = evaluateForecastCases([c, c], "2026-09-29T00:00:00Z", "v1");
    expect(valid.sampleSize).toBe(1); expect(valid.brier).toBeCloseTo(0.04); expect(valid.baselineBrier).toBe(0.25);
    expect(valid.accuracyPromotionAllowed).toBe(false);
    expect(evaluateForecastCases([c], "2026-10-01T00:00:00Z", "v1").sampleSize).toBe(0);
    expect(evaluateForecastCases([{ ...c, publicResultAt: asOf }], "2026-09-29T00:00:00Z", "v1").sampleSize).toBe(0);
    expect(evaluateForecastCases([{ ...c, outcomeRulesHash: "b" }], "2026-09-29T00:00:00Z", "v1").sampleSize).toBe(0);
  });
});
