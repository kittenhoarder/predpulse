import { describe, it, expect } from "vitest";
import { buildTagMap, parseJsonArray, processEvents } from "../process-markets";
import type { GammaEvent, GammaTag } from "../types";

describe("parseJsonArray", () => {
  it("parses a valid JSON array string", () => {
    expect(parseJsonArray('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseJsonArray("not json")).toEqual([]);
  });

  it("passes through an actual array", () => {
    expect(parseJsonArray(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseJsonArray("")).toEqual([]);
  });

  it("returns empty array if parsed result is not an array", () => {
    expect(parseJsonArray('"scalar"')).toEqual([]);
  });
});

describe("buildTagMap", () => {
  it("builds a slug→label map", () => {
    const tags: GammaTag[] = [
      { id: "1", slug: "politics", label: "Politics" },
      { id: "2", slug: "crypto", label: "Crypto" },
    ];
    const map = buildTagMap(tags);
    expect(map.get("politics")).toBe("Politics");
    expect(map.get("crypto")).toBe("Crypto");
  });

  it("title-cases slug when label is missing", () => {
    const tags: GammaTag[] = [
      { id: "1", slug: "some-topic", label: "" },
    ];
    const map = buildTagMap(tags);
    expect(map.get("some-topic")).toBe("Some Topic");
  });

  it("skips tags without slug", () => {
    const tags = [{ id: "1", slug: "", label: "Orphan" }] as GammaTag[];
    const map = buildTagMap(tags);
    expect(map.size).toBe(0);
  });
});

describe("processEvents", () => {
  const mockEvent: GammaEvent = {
    id: "ev1",
    slug: "test-event",
    title: "Test Event",
    description: "A test event",
    image: "https://example.com/img.png",
    icon: "",
    active: true,
    closed: false,
    archived: false,
    liquidity: 50000,
    volume: 100000,
    volume24hr: 10000,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
    markets: [
      {
        id: "m1",
        question: "Will X happen?",
        slug: "will-x-happen",
        conditionId: "cond1",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.65","0.35"]',
        volume: "100000",
        volume24hr: 10000,
        volume1wk: 50000,
        volume1mo: 200000,
        volumeNum: 100000,
        liquidity: "50000",
        liquidityNum: 50000,
        active: true,
        closed: false,
        archived: false,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
        endDate: "2026-12-31T00:00:00Z",
        image: "",
        icon: "",
        description: "Test description",
        resolutionSource: "https://example.com",
        enableOrderBook: true,
        clobTokenIds: '["tok1"]',
        oneDayPriceChange: 0.05,
        oneHourPriceChange: 0.01,
        oneWeekPriceChange: 0.02,
        oneMonthPriceChange: 0.1,
        lastTradePrice: 0.65,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02,
        competitive: 0.8,
        negRisk: false,
        restricted: false,
        groupItemTitle: "",
        events: [],
      },
    ],
    tags: [{ id: "t1", slug: "politics", label: "Politics" }],
  };

  it("transforms a GammaEvent into ProcessedMarket[]", () => {
    const result = processEvents([mockEvent]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
    expect(result[0].source).toBe("polymarket");
    expect(result[0].currentPrice).toBeCloseTo(65, 0);
    expect(result[0].oneDayChange).toBeCloseTo(5, 0);
    expect(result[0].clobTokenId).toBe("tok1");
    expect(result[0].eventSlug).toBe("test-event");
  });

  it("deduplicates markets by id", () => {
    const result = processEvents([mockEvent, mockEvent]);
    expect(result).toHaveLength(1);
  });

  it("skips closed/archived/inactive markets", () => {
    const closedEvent: GammaEvent = {
      ...mockEvent,
      markets: [{ ...mockEvent.markets![0], closed: true }],
    };
    expect(processEvents([closedEvent])).toHaveLength(0);
  });

  it("falls back to 'general' category when no tags", () => {
    const noTags: GammaEvent = { ...mockEvent, tags: [] };
    const result = processEvents([noTags]);
    expect(result[0].categoryslugs).toEqual(["general"]);
    expect(result[0].categories).toEqual(["General"]);
  });
});
