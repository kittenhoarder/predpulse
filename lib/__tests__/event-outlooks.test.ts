import { describe, expect, it } from "vitest";
import { buildEventOutlooks, validateEventOutlooks, OUTLOOK_MAX_BYTES } from "../event-outlooks";
import type { GammaEvent, GammaMarket } from "../types";

const asOf = "2026-09-30T14:00:00Z";
function event(title = "Brazil Presidential Election", count = 8, volume24hr = 50_000): GammaEvent {
  return { id: title, slug: title.toLowerCase().replaceAll(" ", "-"), title, volume24hr,
    active: true, closed: false, archived: false,
    markets: Array.from({ length: count }, (_, i) => ({
      id: `${title}-${i}`, question: `Will candidate ${i} win?`, groupItemTitle: `Candidate ${i}`,
      active: true, closed: false, archived: false, outcomes: '["Yes","No"]',
      bestBid: 0.49, bestAsk: 0.51, updatedAt: "2026-09-30T13:55:00Z",
      endDate: "2026-10-05T12:00:00Z", description: "Resolves YES if this named candidate wins under the venue rules.",
    } as GammaMarket)),
  } as GammaEvent;
}

describe("automated event outlook discovery", () => {
  it("discovers multiple topics, with bounded cards and partial outcome coverage", () => {
    const d = buildEventOutlooks([event(), event("CPI inflation in October"), event("US Iran ceasefire"), event("ECB interest rate decision")], asOf);
    expect(d.items).toHaveLength(3);
    expect(new Set(d.items.map((i) => i.topic)).size).toBe(3);
    expect(d.items[0].contracts).toHaveLength(6);
    expect(d.items[0].activeContracts).toBe(8);
    expect(d.items.every((i) => i.decision === null)).toBe(true);
  });
  it("never treats candidate prices as an exhaustive partition, even at a 100% sum", () => {
    const item = buildEventOutlooks([event(undefined, 2)], asOf).items[0];
    expect(item.contracts.reduce((sum, c) => sum + c.midpoint, 0)).toBe(1);
    expect(item.decision).toBeNull();
    expect(item).not.toHaveProperty("normalized");
    expect(item).not.toHaveProperty("rawSum");
  });
  it("keeps overlapping deadlines as separate contract questions, without summing", () => {
    const e = event("US Iran ceasefire", 2);
    e.markets![0].question = "Ceasefire through October 5?";
    e.markets![1].question = "Ceasefire through October 10?";
    e.markets![1].endDate = "2026-10-10T12:00:00Z";
    const item = buildEventOutlooks([e], asOf).items[0];
    expect(item.contracts.map((c) => c.question)).toEqual(e.markets!.map((m) => m.question));
    expect(item.decision).toBeNull();
  });
  it("ranks deterministically by activity and keeps one event per topic", () => {
    const a = event(), b = event("French Presidential Election", 2, 100_000), c = event("CPI inflation in October");
    const first = buildEventOutlooks([a, b, c], asOf);
    expect(first).toEqual(buildEventOutlooks([c, b, a], asOf));
    expect(first.items.map((i) => i.eventId)).toEqual([b.id, c.id]);
  });
  it.each([
    ["low activity", (e: GammaEvent) => { e.volume24hr = 9999; }],
    ["sports", (e: GammaEvent) => { e.title = "New York vs Washington"; }],
    ["closed event", (e: GammaEvent) => { e.closed = true; }],
    ["old quotes", (e: GammaEvent) => { e.markets!.forEach((m) => { m.updatedAt = "2026-09-30T12:00:00Z"; }); }],
    ["future quotes", (e: GammaEvent) => { e.markets!.forEach((m) => { m.updatedAt = "2026-09-30T14:06:00Z"; }); }],
    ["distant deadlines", (e: GammaEvent) => { e.markets!.forEach((m) => { m.endDate = "2027-09-30T14:00:00Z"; }); }],
    ["past deadlines", (e: GammaEvent) => { e.markets!.forEach((m) => { m.endDate = asOf; }); }],
    ["reordered outcomes", (e: GammaEvent) => { e.markets!.forEach((m) => { m.outcomes = '["No","Yes"]'; }); }],
    ["wide books", (e: GammaEvent) => { e.markets!.forEach((m) => { m.bestAsk = 0.9; }); }],
  ])("excludes %s", (_, mutate) => {
    const e = event(); mutate(e);
    expect(buildEventOutlooks([e], asOf).items).toEqual([]);
  });
  it("validates persisted quote arithmetic and duplicate contracts", () => {
    const d = buildEventOutlooks([event()], asOf);
    const badQuote = structuredClone(d); badQuote.items[0].contracts[0].midpoint = 0.8;
    expect(() => validateEventOutlooks(badQuote, asOf)).toThrow();
    const duplicate = structuredClone(d); duplicate.items[0].contracts[1] = duplicate.items[0].contracts[0];
    expect(() => validateEventOutlooks(duplicate, asOf)).toThrow();
  });
  it("bounds rule excerpts without losing the source fingerprint", () => {
    const e = event(); e.markets![0].description = "Rules. ".repeat(1000);
    const contract = buildEventOutlooks([e], asOf).items[0].contracts[0];
    expect(contract.rulesExcerpt).toHaveLength(600);
    expect(contract.rulesHash).toHaveLength(64);
  });
  it("accepts an empty sample, so the section has an honest empty state", () => {
    expect(buildEventOutlooks([], asOf)).toMatchObject({ screened: 0, items: [] });
  });
  it("bounds UTF-8 payload size while retaining higher-ranked events", () => {
    const events = [event(), event("CPI inflation in October"), event("US Iran ceasefire")];
    events.forEach((e) => e.markets!.forEach((m) => { m.description = "規則".repeat(600); }));
    const d = buildEventOutlooks(events, asOf);
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.items.length).toBeLessThan(3);
    expect(Buffer.byteLength(JSON.stringify(d))).toBeLessThanOrEqual(OUTLOOK_MAX_BYTES);
  });
  it("keeps the Fed interpretation independent from general discovery", () => {
    const e = event("Fed Decision in October?", 5);
    e.slug = "fed-decision-in-october";
    e.description = 'Upper rules: upper bound of the target federal funds rate; rounded up to the nearest 25. The resolution source is the FOMC statement after its meeting scheduled for October 27-28, 2026. https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm If no statement, resolve to the "No change" bracket.';
    ["50+ bps decrease", "25 bps decrease", "No change", "25 bps increase", "50+ bps increase"].forEach((label, i) => {
      Object.assign(e.markets![i], { groupItemTitle: label, description: e.description,
        endDate: "2026-10-29T03:59:00Z", bestBid: 0.199, bestAsk: 0.201 });
    });
    const d = buildEventOutlooks([e, event()], asOf);
    const fed = d.items.find((item) => item.topic === "Central banks")!;
    expect(fed.contracts).toEqual([]);
    expect(fed.decision?.coherent).toBe(true);
    expect(fed.decision?.buckets).toHaveLength(5);
    const changed = structuredClone(d); changed.items.find((i) => i.decision)!.decision!.buckets[0].normalized = 0.8;
    expect(() => validateEventOutlooks(changed, asOf)).toThrow();
  });
});
