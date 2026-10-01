import { describe, expect, it } from "vitest";
import { beliefEpoch, buildBeliefShift, fitIndexDigest, primaryBeliefCategory, validateIndexProducts } from "../belief-shift";
import { INDEX_MAX_BYTES, indexFreshness, observationMove } from "../index-products";
import type { GammaEvent, GammaMarket } from "../types";

const T0 = "2026-10-01T12:00:00.000Z", T1 = "2026-10-02T12:00:00.000Z";
function events(prices: number[], at = T0, category = "economics"): GammaEvent[] {
  return prices.map((price, i) => ({ id: String(1000 + i), slug: `event-${i}`, title: `Event ${i}`, description: "Event settlement rules",
    active: true, closed: false, archived: false, volume24hr: 100_000, tags: [{ slug: category }],
    markets: [{ id: String(2000 + i), question: `Will event ${i} happen?`, description: "Exact contract settlement rules", resolutionSource: "Official release",
      clobTokenIds: JSON.stringify([String(3000 + i), String(4000 + i)]), outcomes: '["Yes","No"]', active: true, closed: false, archived: false,
      bestBid: price - 0.01, bestAsk: price + 0.01, updatedAt: at, endDate: "2026-11-01T12:00:00.000Z", volume24hr: 100_000 - i }],
  } as unknown as GammaEvent));
}
const prices = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
function pair(now = prices) {
  const prior = buildBeliefShift(events(prices), null, null, T0, ["economics"]);
  return buildBeliefShift(events(now, T1), prior, prior, T1, ["economics"]);
}

describe("Belief Shift publication contract", () => {
  it("reproduces the declared six-event arithmetic without volume weighting", () => {
    const d = pair([0.23, 0.31, 0.4, 0.55, 0.58, 0.69]);
    expect(d.products[0].headline).toBeCloseTo(2, 10);
    expect(d.products[0].breadth).toBeCloseTo(1 / 3, 10);
    expect(d.products[0].state).toBe("available");
    expect(d.observations.map(observationMove)).toEqual(expect.arrayContaining([expect.closeTo(3), expect.closeTo(-2)]));
    expect(validateIndexProducts(JSON.parse(JSON.stringify(d)), T1)).toEqual(d);
  });
  it("distinguishes a genuine zero from missing history", () => {
    expect(pair().products[0].headline).toBe(0);
    const initial = buildBeliefShift(events(prices), null, null, T0, ["economics"]);
    expect(initial.products[0]).toMatchObject({ state: "warming", headline: null, breadth: null });
    expect(initial.observations.every((r) => r.quote && !r.prior)).toBe(true);
  });
  it("requires five events and one representative per venue family", () => {
    const e = events(prices.slice(0, 4));
    e[0].markets!.push({ ...e[0].markets![0], id: "9000", volume24hr: 999_999 } as GammaMarket);
    expect(buildBeliefShift(e, null, null, T0, ["economics"]).products[0]).toMatchObject({ state: "unavailable", reason: "insufficient_events", members: [] });
    const full = events(prices);
    full[0].markets!.push({ ...full[0].markets![0], id: "9000", volume24hr: 999_999 } as GammaMarket);
    const d = buildBeliefShift(full, null, null, T0, ["economics"]);
    expect(d.products[0].members).toHaveLength(6);
    expect(d.products[0].members).toContain("9000");
    expect(d.products[0].members).not.toContain("2000");
  });
  it("retains missing cohort members and fails 6/8 pair coverage without replacing survivors", () => {
    const p8 = [...prices, 0.5, 0.5];
    const prior = buildBeliefShift(events(p8), null, null, T0, ["economics"], 8);
    const now = events([...p8, 0.5], T1).filter((e) => !["1006", "1007"].includes(e.id));
    const d = buildBeliefShift(now, prior, prior, T1, ["economics"]);
    expect(d.products[0].members).toEqual(prior.products[0].members);
    expect(d.products[0]).toMatchObject({ state: "unavailable", headline: null, coverage: { admitted: 8, comparable: 6 } });
    expect(d.observations.filter((r) => r.issue === "missing")).toHaveLength(2);
  });
  it.each(["description", "endDate", "clobTokenIds", "question"])("excludes a revised %s from the pair and changes the history segment", (field) => {
    const prior = buildBeliefShift(events(prices), null, null, T0, ["economics"]);
    const e = events(prices, T1);
    Object.assign(e[0].markets![0], { [field]: field === "endDate" ? "2026-11-02T12:00:00.000Z" : field === "clobTokenIds" ? '["99999","88888"]' : "Changed content" });
    const d = buildBeliefShift(e, prior, prior, T1, ["economics"]);
    expect(d.observations[0].comparisonIssue).toBe("identity_changed");
    expect(d.products[0].coverage.comparable).toBe(5);
    expect(d.products[0].headline).toBe(0);
  });
  it("rejects stale, crossed and unsupported outcome books without a last-price fallback", () => {
    const e = events(prices);
    e[0].markets![0].updatedAt = "2026-10-01T10:00:00.000Z";
    e[1].markets![0].bestBid = 0.9;
    e[2].markets![0].outcomes = '["No","Yes"]';
    const d = buildBeliefShift(e, null, null, T0, ["economics"]);
    expect(d.products[0].state).toBe("unavailable");
    expect(d.exclusions).toMatchObject({ old_record: 1, invalid_book: 1, unsupported_outcome: 1 });
  });
  it("does not switch the representative when another outcome becomes more active", () => {
    const prior = buildBeliefShift(events(prices), null, null, T0, ["economics"]);
    const e = events(prices, T1);
    e[0].markets!.push({ ...e[0].markets![0], id: "9000", volume24hr: 999_999 });
    expect(buildBeliefShift(e, prior, prior, T1, ["economics"]).products[0].members).toEqual(prior.products[0].members);
  });
  it("pins category semantics and excludes social tweet counts", () => {
    const e = events(prices)[0];
    e.tags = [{ slug: "politics" }, { slug: "economy" }] as GammaEvent["tags"];
    expect(primaryBeliefCategory(e)).toBe("economics");
    e.tags!.push({ slug: "tweets-markets" } as NonNullable<GammaEvent["tags"]>[number]);
    expect(primaryBeliefCategory(e)).toBeNull();
  });
  it("uses UTC weekly boundaries and never backdates a missing baseline", () => {
    expect(beliefEpoch("2026-10-04T23:59:59Z")).toBe("2026-09-28");
    expect(beliefEpoch("2026-10-05T00:00:00Z")).toBe("2026-10-05");
    const prior = buildBeliefShift(events(prices), null, null, T0, ["economics"]);
    const late = "2026-10-02T13:00:00.000Z";
    expect(buildBeliefShift(events(prices, late), prior, prior, late, ["economics"]).products[0].state).toBe("warming");
  });
  it("keeps missing quote pairs out of the average and inserts a segment break", () => {
    const first = pair([0.23, 0.31, 0.4, 0.55, 0.58, 0.69]);
    const at = "2026-10-02T12:20:00.000Z", priorAt = "2026-10-01T12:20:00.000Z";
    const baseline = buildBeliefShift(events(prices, priorAt), null, null, priorAt, ["economics"]);
    const e = events(prices, at); e[0].markets![0].bestBid = 0.9;
    const d = buildBeliefShift(e, JSON.parse(JSON.stringify(first)), baseline, at, ["economics"]);
    expect(d.products[0].headline).toBe(0);
    expect(d.products[0].coverage.comparable).toBe(5);
    expect(d.products[0].history.at(-1)!.segment).not.toBe(first.products[0].history.at(-1)!.segment);
  });
  it("rejects tampered arithmetic, identity hashes, history and unsupported versions", () => {
    const d = pair();
    for (const change of [
      (x: typeof d) => { x.products[0].headline = 50; },
      (x: typeof d) => { x.products[0].headline = NaN; },
      (x: typeof d) => { x.observations[0].prior!.identity = "bad"; },
      (x: typeof d) => { x.products[0].history[0].value = 101; },
      (x: typeof d) => { (x as { version: number }).version = 2; },
    ]) { const copy = structuredClone(d); change(copy); expect(() => validateIndexProducts(copy, T1)).toThrow(); }
  });
  it("trims only optional history and stays within the replacement ceiling", () => {
    let d = pair();
    for (let i = 1; i <= 24; i++) {
      const at = new Date(Date.parse(T1) + i * 3_600_000).toISOString();
      const priorAt = new Date(Date.parse(at) - 24 * 3_600_000).toISOString();
      const b = buildBeliefShift(events(prices, priorAt), null, null, priorAt, ["economics"]);
      d = buildBeliefShift(events(prices, at), d, b, at, ["economics"]);
    }
    const bounded = fitIndexDigest(d, Buffer.byteLength(JSON.stringify(d)) - 500);
    expect(bounded.observations).toEqual(d.observations);
    expect(bounded.products[0].members).toEqual(d.products[0].members);
    expect(bounded.products[0].history.length).toBeLessThan(d.products[0].history.length);
    expect(Buffer.byteLength(JSON.stringify(d))).toBeLessThanOrEqual(INDEX_MAX_BYTES);
    expect(() => fitIndexDigest(d, 100)).toThrow("replacement allocation");
  });
  it("labels dated snapshots without restamping the generation", () => {
    expect(indexFreshness(T0, Date.parse(T0) + 90 * 60_000)).toBe("recent");
    expect(indexFreshness(T0, Date.parse(T0) + 180 * 60_000)).toBe("delayed");
    expect(indexFreshness(T0, Date.parse(T0) + 361 * 60_000)).toBe("stale");
  });
});
