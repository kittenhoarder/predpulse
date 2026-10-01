import { describe, expect, it } from "vitest";
import { buildIndexProducts } from "../outcome-benchmark";
import { validateIndexProducts } from "../belief-shift";
import type { GammaEvent } from "../types";
import { fedEvent as event, T0 } from "./fixtures/fed-event";
const T1 = "2026-10-02T12:00:00.000Z";
function paired() {
  const prior = buildIndexProducts([event([.08, .12, .55, .20, .05])], null, null, T0);
  return buildIndexProducts([event(undefined, T1)], prior, prior, T1);
}
describe("Outcome Benchmark saved evidence", () => {
  it("shows a useful current balance before history exists", () => {
    const d = buildIndexProducts([event()], null, null, T0), p = d.outcomeBenchmark!;
    expect(p.state).toBe("available"); expect(p.headline).toBeCloseTo(-10);
    expect(p.shares![0]).toBeCloseTo(.3); expect(p.shares![1]).toBeCloseTo(.5); expect(p.shares![2]).toBeCloseTo(.2);
    expect(p.change24h).toBeNull(); expect(p.expectedChangeBps).toBeNull();
    expect(validateIndexProducts(JSON.parse(JSON.stringify(d)), T0)).toEqual(d);
  });
  it("normalizes both complete captures separately and reproduces the signed 24h delta", () => {
    const d = paired(), p = d.outcomeBenchmark!;
    expect(p.prior!.headline).toBeCloseTo(5); expect(p.change24h).toBeCloseTo(-15);
    expect(d.observations.every((r) => r.prior && r.prior.identity)).toBe(true);
    expect(validateIndexProducts(JSON.parse(JSON.stringify(d)), T1)).toEqual(d);
    const scaled = event([.12 * 1.02, .18 * 1.02, .5 * 1.02, .15 * 1.02, .05 * 1.02]);
    expect(buildIndexProducts([scaled], null, null, T0).outcomeBenchmark!.headline).toBeCloseTo(-10);
  });
  it.each([
    ["missing", (e: GammaEvent) => { e.markets!.pop(); }],
    ["duplicate", (e: GammaEvent) => { e.markets!.push({...e.markets![0]}); }],
    ["duplicate market ID", (e: GammaEvent) => { e.markets![1].id = e.markets![0].id; }],
    ["stale", (e: GammaEvent) => { e.markets![0].updatedAt = "2026-09-30T00:00:00Z"; }],
    ["rules", (e: GammaEvent) => { e.markets![0].description += " changed"; }],
    ["close", (e: GammaEvent) => { e.markets![0].endDate = "2026-11-01T00:00:00Z"; }],
    ["sum", (e: GammaEvent) => { e.markets![0].bestBid = .8; e.markets![0].bestAsk = .802; }],
    ["token", (e: GammaEvent) => { e.markets![0].clobTokenIds = '[]'; }],
    ["book", (e: GammaEvent) => { e.markets![0].bestAsk = .01; }],
  ] as const)("withholds derived balance for %s", (_name, mutate) => {
    const e = event(); mutate(e); const p = buildIndexProducts([e], null, null, T0).outcomeBenchmark!;
    expect(p.state).toBe("unavailable"); expect(p.headline).toBeNull(); expect(p.shares).toBeNull();
  });
  it("keeps the nearest invalid meeting rather than substituting a later one", () => {
    const nearest = event(); nearest.markets!.pop();
    const later = event(); later.id = "101"; later.title = "Fed Decision in December?";
    later.description = later.description.replaceAll("October", "December").replace("27-28", "8-9");
    later.markets!.forEach((m,i) => {m.id=String(500+i);m.description=later.description;m.endDate="2026-12-10T00:00:00Z";});
    const p = buildIndexProducts([later, nearest], null, null, T0).outcomeBenchmark!;
    expect(p.meetingDate).toBe("2026-10-28"); expect(p.state).toBe("unavailable");
  });
  it.each(["question", "token", "rules", "meeting", "method"])("resets comparison when %s changes", (change) => {
    const prior = buildIndexProducts([event()], null, null, T0), e = event(undefined,T1);
    if (change === "question") e.markets![0].question += " revised";
    if (change === "token") e.markets![0].clobTokenIds = '["999","998"]';
    if (change === "rules") { e.description += " amended"; e.markets!.forEach(m=>m.description=e.description); }
    if (change === "meeting") {e.description=e.description.replace("27-28", "26-27");e.markets!.forEach(m=>m.description=e.description);}
    if (change === "method") prior.outcomeBenchmark!.methodology = "changed" as never;
    const p = buildIndexProducts([e], prior, prior, T1).outcomeBenchmark!;
    expect(p.prior).toBeNull(); expect(p.change24h).toBeNull(); expect(p.comparisonIssue).not.toBeNull();
    if (change !== "method") expect(p.history[0].segment).not.toBe(p.history[1].segment);
  });
  it("rejects altered saved arithmetic, normalization, evidence and history", () => {
    const d = paired();
    const mutations = [(x: typeof d) => {x.outcomeBenchmark!.headline = NaN;},
      (x: typeof d) => {x.outcomeBenchmark!.shares![0] += .1;}, (x: typeof d) => {x.outcomeBenchmark!.change24h = 0;},
      (x: typeof d) => {x.outcomeBenchmark!.normalized![2] = .9;}, (x: typeof d) => {x.observations[0].outcomeId = "999";},
      (x: typeof d) => {x.outcomeBenchmark!.history.at(-1)!.segment = "0000000000000000";},
      (x: typeof d) => {x.outcomeBenchmark!.expectedChangeBps = 25 as never;}];
    for (const mutate of mutations) {const bad = structuredClone(d);mutate(bad);expect(()=>validateIndexProducts(bad,T1)).toThrow();}
  });
  it("deduplicates a Fed contract shared with Belief Shift without changing its pair arithmetic", () => {
    const make = (at: string) => { const fed = event(undefined, at); const others = Array.from({length:5}, (_,i) => {
      const e = event(undefined, at); e.id = String(1000+i); e.title = "Other event"; e.slug = `other-event-${i}`;
      e.markets = [{...e.markets![0], id:String(2000+i), clobTokenIds:JSON.stringify([String(3000+i),String(4000+i)]), bestBid:.49, bestAsk:.51}]; return e;
    }); return [fed,...others]; };
    const prior = buildIndexProducts(make(T0), null, null, T0);
    const next = buildIndexProducts(make(T1), prior, prior, T1);
    expect(next.products[0].members.length).toBe(6);
    expect(next.observations.length).toBe(10);
    expect(new Set(next.observations.map(r=>r.marketId)).size).toBe(10);
    expect(next.products[0].headline).toBe(0);
    expect(next.outcomeBenchmark!.change24h).toBe(0);
    expect(validateIndexProducts(next,T1)).toEqual(next);
  });
  it("does not approximate a baseline outside the 45-minute window", () => {
    const prior = buildIndexProducts([event()],null,null,T0);
    const at = "2026-10-02T13:00:00.000Z";
    const p = buildIndexProducts([event(undefined,at)],prior,prior,at).outcomeBenchmark!;
    expect(p.headline).not.toBeNull(); expect(p.change24h).toBeNull(); expect(p.comparisonIssue).toBe("capturing_baseline");
  });
  it("has an explicit unavailable product when no supported meeting exists", () => {
    const p = buildIndexProducts([],null,null,T0).outcomeBenchmark!;
    expect(p.issue).toBe("no_supported_meeting"); expect(p.headline).toBeNull();
  });
});
