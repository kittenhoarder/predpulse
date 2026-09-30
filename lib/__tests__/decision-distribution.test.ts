import { describe, expect, it } from "vitest";
import { buildDecisionDistribution, validateDecisionDistribution } from "../decision-distribution";
import type { GammaEvent, GammaMarket } from "../types";

const asOf = "2026-09-30T14:00:00Z";
const labels = ["50+ bps decrease", "25 bps decrease", "No change", "25 bps increase", "50+ bps increase"];
const rules = `The FED interest rates are defined in this market by the upper bound of the target federal funds range.
This market will resolve to the amount of basis points the upper bound of the target federal funds rate is changed by versus the level it was prior to the Federal Reserve's October 2026 meeting.
If the target federal funds rate is changed to a level not expressed in the displayed options, the change will be rounded up to the nearest 25 and will resolve to the relevant bracket.
The resolution source for this market is the FOMC’s statement after its meeting scheduled for October 27-28, 2026 according to the official calendar: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm.
If no statement is released by the end date of the next scheduled meeting, this market will resolve to the "No change" bracket.`;

function event(prices = [0.05, 0.2, 0.6, 0.1, 0.05]): GammaEvent {
  return {
    id: "fed-october", slug: "fed-decision-in-october", title: "Fed Decision in October?",
    active: true, closed: false, archived: false, description: rules,
    markets: labels.map((groupItemTitle, i) => ({
      id: `bucket-${i}`, groupItemTitle, outcomes: '["Yes","No"]',
      description: rules, active: true, closed: false, archived: false,
      endDate: "2026-10-29T03:59:00Z", updatedAt: "2026-09-30T13:55:00Z",
      bestBid: prices[i] - 0.001, bestAsk: prices[i] + 0.001,
    } as GammaMarket)),
  } as GammaEvent;
}

describe("Fed meeting distribution", () => {
  it("reconstructs a complete partition without inventing a tail expectation", () => {
    const d = buildDecisionDistribution([event()], asOf)!;
    expect(d.coherent).toBe(true);
    expect(d.meetingDate).toBe("2026-10-28");
    expect(d.rawSum).toBeCloseTo(1);
    expect(d.directionShares?.cut).toBeCloseTo(0.25);
    expect(d.directionShares?.hold).toBeCloseTo(0.6);
    expect(d.directionShares?.hike).toBeCloseTo(0.15);
    expect(d.expectedChangeBps).toBeNull();
  });
  it("preserves raw midpoints and explicitly normalizes a permitted sum", () => {
    const d = buildDecisionDistribution([event([0.05, 0.2, 0.62, 0.1, 0.05])], asOf)!;
    expect(d.rawSum).toBeCloseTo(1.02);
    expect(d.buckets[2].midpoint).toBeCloseTo(0.62);
    expect(d.buckets[2].normalized).toBeCloseTo(0.62 / 1.02);
  });
  it("uses every raw bucket, including tiny tails that a volume filter would exclude", () => {
    const e = event([0.0025, 0.0045, 0.655, 0.335, 0.0055]);
    e.markets!.forEach((m) => { m.volume24hr = 0; m.liquidityNum = 0; });
    expect(buildDecisionDistribution([e], asOf)?.coherent).toBe(true);
  });
  it("selects the nearest named meeting regardless of input order", () => {
    const later = event();
    later.id = "fed-december"; later.slug = "fed-decision-in-december"; later.title = "Fed Decision in December?";
    later.description = rules.replaceAll("October", "December").replace("27-28", "8-9");
    later.markets!.forEach((m) => { m.description = later.description; m.endDate = "2026-12-10T00:00:00Z"; });
    expect(buildDecisionDistribution([later, event()], asOf)?.eventId).toBe("fed-october");
    expect(buildDecisionDistribution([event(), later], "2026-10-29T00:00:00Z")?.eventId).toBe("fed-december");
  });
  it("does not switch to a later meeting to conceal missing coverage", () => {
    const e = event(); e.markets!.pop();
    const d = buildDecisionDistribution([e], asOf)!;
    expect(d.issue).toBe("missing_buckets");
    expect(d.buckets[4].midpoint).toBeNull();
    expect(d.rawSum).toBeNull();
    expect(d.directionShares).toBeNull();
  });
  it.each([
    ["duplicates", (e: GammaEvent) => { e.markets!.push({ ...e.markets![0] }); }, "missing_buckets"],
    ["overlapping thresholds", (e: GammaEvent) => { e.markets!.push({ ...e.markets![0], id: "threshold", groupItemTitle: "25+ bps decrease" }); }, "unsupported_buckets"],
    ["different rules", (e: GammaEvent) => { e.markets![0].description += "Revised values count."; }, "rule_mismatch"],
    ["different meeting", (e: GammaEvent) => { e.markets![0].description = rules.replaceAll("October", "December"); }, "rule_mismatch"],
    ["different closes", (e: GammaEvent) => { e.markets![0].endDate = "2026-11-01T00:00:00Z"; }, "rule_mismatch"],
    ["closed bucket", (e: GammaEvent) => { e.markets![0].closed = true; }, "invalid_quotes"],
    ["reordered outcomes", (e: GammaEvent) => { e.markets![0].outcomes = '["No","Yes"]'; }, "invalid_quotes"],
    ["missing quote", (e: GammaEvent) => { e.markets![0].bestBid = undefined as unknown as number; }, "invalid_quotes"],
    ["crossed quote", (e: GammaEvent) => { e.markets![0].bestAsk = 0.001; }, "invalid_quotes"],
    ["wide quote", (e: GammaEvent) => { e.markets![0].bestAsk = 0.5; }, "invalid_quotes"],
    ["nonfinite quote", (e: GammaEvent) => { e.markets![0].bestBid = NaN; }, "invalid_quotes"],
    ["stale venue update", (e: GammaEvent) => { e.markets![0].updatedAt = "2026-09-29T00:00:00Z"; }, "old_quotes"],
    ["missing venue update", (e: GammaEvent) => { e.markets![0].updatedAt = ""; }, "old_quotes"],
    ["future venue update", (e: GammaEvent) => { e.markets![0].updatedAt = "2026-09-30T16:00:00Z"; }, "old_quotes"],
  ])("withholds derived shares for %s", (_name, mutate, issue) => {
    const e = event(); (mutate as (e: GammaEvent) => void)(e);
    const d = buildDecisionDistribution([e], asOf)!;
    expect(d.issue).toBe(issue);
    expect(d.coherent).toBe(false);
    expect(d.directionShares).toBeNull();
    expect(d.buckets.every((b) => b.normalized === null)).toBe(true);
  });
  it("retains an incoherent raw total rather than forcing it to 100%", () => {
    const d = buildDecisionDistribution([event([0.1, 0.2, 0.8, 0.1, 0.1])], asOf)!;
    expect(d.rawSum).toBeCloseTo(1.3); expect(d.issue).toBe("price_sum");
  });
  it("does not admit cumulative or arbitrary event families", () => {
    expect(buildDecisionDistribution([{ ...event(), title: "Fed rate cuts in 2026?" }], asOf)).toBeNull();
    expect(buildDecisionDistribution([{ ...event(), description: "Will the Fed cut?" }], asOf)).toBeNull();
    expect(buildDecisionDistribution([{ ...event(), slug: "wrong/path" }], asOf)).toBeNull();
  });
  it("rejects corrupted persisted sums, normalized shares, timestamps and invented expectations", () => {
    const d = buildDecisionDistribution([event()], asOf)!;
    expect(() => validateDecisionDistribution({ ...d, rawSum: NaN }, asOf)).toThrow();
    expect(() => validateDecisionDistribution({ ...d, directionShares: { cut: 0.9, hold: 0.1, hike: 0 } }, asOf)).toThrow();
    expect(() => validateDecisionDistribution({ ...d, expectedChangeBps: 10 }, asOf)).toThrow();
    expect(() => validateDecisionDistribution(d, "2026-09-30T16:00:00Z")).toThrow();
  });
});
