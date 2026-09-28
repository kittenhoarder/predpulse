import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparePair, hashRules, validateComparisonDigest, validateRegistry,
  REVIEW_FIELDS,
  type ReviewedPair, type VenueQuote,
} from "../venue-comparisons";
import { isCurrentComparison } from "../comparison-display";
import { buildComparisonDigest, kalshiRuleText, polymarketRuleText } from "../venue-comparison-publisher";

const now = Date.parse("2026-09-28T12:00:00Z");
const receivedAt = new Date(now - 60_000).toISOString();
const kalshiMarket = {
  ticker: "KX-ONE", status: "active", title: "Example", yes_sub_title: "Yes", no_sub_title: "No",
  rules_primary: "Official settlement text", rules_secondary: "None", close_time: "2026-12-01T00:00:00Z",
  yes_bid_dollars: "0.4900", yes_ask_dollars: "0.5300",
};
const polyMarket = {
  id: "42", active: true, closed: false, archived: false, enableOrderBook: true,
  question: "Example", description: "Official settlement text", resolutionSource: "Official source",
  endDate: "2026-12-01T00:00:00Z", outcomes: '["Yes","No"]',
  clobTokenIds: '["token-yes","token-no"]', negRisk: false,
};

function pair(): ReviewedPair {
  return {
    pairId: "test-pair", familyId: "test-family", mappingRevision: 1,
    proposition: "Example resolves yes", rationale: "Same settlement criteria after manual review.",
    reviewer: "reviewer-a", secondReviewer: "reviewer-b", reviewedAt: receivedAt,
    ruleComparison: Object.fromEntries(REVIEW_FIELDS.map((field) => [field, ["Same", "Same"]])) as ReviewedPair["ruleComparison"],
    sides: [
      { source: "polymarket", marketId: "42", outcomeId: "token-yes", outcomeLabel: "Yes",
        orientation: "as-is", rulesHash: hashRules(polymarketRuleText(polyMarket)), url: "https://polymarket.com/event/example" },
      { source: "kalshi", marketId: "KX-ONE", outcomeId: "YES", outcomeLabel: "Yes",
        orientation: "as-is", rulesHash: hashRules(kalshiRuleText(kalshiMarket)), url: "https://kalshi.com/markets/example" },
    ],
  };
}

function quotes(p: ReviewedPair): [VenueQuote, VenueQuote] {
  return [
    { ...p.sides[0], bid: 0.52, ask: 0.56, receivedAt },
    { ...p.sides[1], bid: 0.49, ask: 0.53, receivedAt },
  ];
}

afterEach(() => vi.unstubAllGlobals());

describe("reviewed venue comparison", () => {
  it("computes only aligned, complete and timely midpoint gaps", () => {
    const p = pair(), q = quotes(p);
    expect(comparePair(p, q, now).gapPP).toBe(3);
    expect(comparePair(p, [{ ...q[0], outcomeId: "other" }, q[1]], now).reason).toBe("outcome-changed");
    expect(comparePair(p, [{ ...q[0], ask: 0.4 }, q[1]], now).reason).toBe("invalid-book");
    expect(comparePair(p, [{ ...q[0], receivedAt: new Date(now - 7 * 60_000).toISOString() }, q[1]], now).reason).toBe("quote-skew");
    expect(comparePair(p, [{ ...q[0], receivedAt: new Date(now - 11 * 60_000).toISOString() }, q[1]], now).reason).toBe("quote-stale");
  });

  it("expires published numbers in the browser even without another publish", () => {
    const item = comparePair(pair(), quotes(pair()), now);
    expect(isCurrentComparison(item, now)).toBe(true);
    expect(isCurrentComparison(item, now + 91 * 60_000)).toBe(false);
  });

  it("rejects unreviewed or malformed registry and untrusted digest data", () => {
    expect(validateRegistry({ version: 1, pairs: [pair()] })).toHaveLength(1);
    expect(() => validateRegistry({ version: 1, pairs: [{ ...pair(), secondReviewer: "reviewer-a" }] })).toThrow();
    const item = comparePair(pair(), quotes(pair()), now);
    expect(() => validateComparisonDigest({ version: 1, asOf: receivedAt, items: [{ ...item, venues: [{ ...item.venues[0], url: "https://evil.test" }, item.venues[1]] }] }, receivedAt)).toThrow();
  });

  it("fails closed on rule drift while preserving validated aligned quotes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const data = url.includes("gamma-api") ? polyMarket : url.includes("clob.polymarket")
        ? { asset_id: "token-yes", bids: [{ price: "0.52", size: "10" }], asks: [{ price: "0.56", size: "10" }] }
        : { market: kalshiMarket };
      return new Response(JSON.stringify(data), { status: 200 });
    }));
    const p = pair();
    const good = await buildComparisonDigest(new Date().toISOString(), [p]);
    expect(good.items[0].gapPP).toBe(3);
    const drift = await buildComparisonDigest(new Date().toISOString(), [{ ...p, sides: [p.sides[0], { ...p.sides[1], rulesHash: "0".repeat(64) }] }]);
    expect(drift.items[0].reason).toBe("rules-changed");
    expect(drift.items[0].gapPP).toBeUndefined();
  });

  it("inverts an explicitly reviewed NO book into the common proposition", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const data = url.includes("gamma-api") ? polyMarket : url.includes("clob.polymarket")
        ? { asset_id: "token-no", bids: [{ price: "0.44", size: "10" }], asks: [{ price: "0.48", size: "10" }] }
        : { market: kalshiMarket };
      return new Response(JSON.stringify(data), { status: 200 });
    }));
    const p = pair();
    p.sides[0] = { ...p.sides[0], outcomeId: "token-no", outcomeLabel: "No", orientation: "complement" };
    const item = (await buildComparisonDigest(new Date().toISOString(), [p])).items[0];
    expect(item.venues[0].bid).toBeCloseTo(0.52);
    expect(item.venues[0].ask).toBeCloseTo(0.56);
    expect(item.gapPP).toBe(3);
  });
});
