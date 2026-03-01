import { describe, it, expect } from "vitest";
import { processKalshiMarkets, deriveCandleMetrics } from "../process-kalshi";
import type { KalshiMarket, KalshiCandle } from "../types";

describe("deriveCandleMetrics", () => {
  it("returns zeros for empty candles", () => {
    const result = deriveCandleMetrics([]);
    expect(result.oneDayChange).toBe(0);
    expect(result.oneWeekChange).toBe(0);
    expect(result.oneMonthChange).toBe(0);
    expect(result.volume1wk).toBe(0);
    expect(result.volume1mo).toBe(0);
  });

  it("computes 1-day change from consecutive candles", () => {
    const candles: KalshiCandle[] = [
      { ticker: "T", open: 0.5, high: 0.6, low: 0.4, close: 0.45, volume: 100, ts: 1 },
      { ticker: "T", open: 0.45, high: 0.55, low: 0.4, close: 0.50, volume: 200, ts: 2 },
    ];
    const result = deriveCandleMetrics(candles);
    expect(result.oneDayChange).toBeCloseTo(5.0, 1);
  });

  it("computes 7-day change when enough candles exist", () => {
    const candles: KalshiCandle[] = Array.from({ length: 8 }, (_, i) => ({
      ticker: "T",
      open: 0.5,
      high: 0.6,
      low: 0.4,
      close: 0.40 + i * 0.02,
      volume: 100,
      ts: i,
    }));
    const result = deriveCandleMetrics(candles);
    expect(result.oneWeekChange).not.toBe(0);
  });

  it("sums volume over the last 7 candles (excluding latest)", () => {
    const candles: KalshiCandle[] = Array.from({ length: 10 }, (_, i) => ({
      ticker: "T",
      open: 0.5,
      high: 0.6,
      low: 0.4,
      close: 0.5,
      volume: 10,
      ts: i,
    }));
    const result = deriveCandleMetrics(candles);
    expect(result.volume1wk).toBe(70);
  });
});

describe("processKalshiMarkets", () => {
  const baseMarket: KalshiMarket = {
    ticker: "KXTEST-YES",
    event_ticker: "KXTEST",
    market_type: "binary",
    title: "Will test happen?",
    status: "active",
    yes_bid_dollars: "0.4800",
    yes_ask_dollars: "0.5200",
    last_price_dollars: "0.5000",
    volume_24h_fp: "10000",
    volume_fp: "50000",
    open_interest_fp: "5000",
    open_time: "2025-01-01T00:00:00Z",
    close_time: "2026-12-31T00:00:00Z",
    category: "Politics",
  };

  it("processes an active Kalshi market", () => {
    const result = processKalshiMarkets([baseMarket]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("kalshi");
    expect(result[0].id).toBe("KXTEST-YES");
    expect(result[0].currentPrice).toBeCloseTo(52, 0);
    expect(result[0].categoryslugs).toContain("politics");
  });

  it("skips inactive markets", () => {
    const inactive = { ...baseMarket, status: "closed" as const };
    expect(processKalshiMarkets([inactive])).toHaveLength(0);
  });

  it("deduplicates by ticker", () => {
    const result = processKalshiMarkets([baseMarket, baseMarket]);
    expect(result).toHaveLength(1);
  });

  it("skips markets with no pricing", () => {
    const noPrice = {
      ...baseMarket,
      yes_ask_dollars: "",
      last_price_dollars: "",
    };
    expect(processKalshiMarkets([noPrice])).toHaveLength(0);
  });

  it("derives oneDayChange from previous_price_dollars when present", () => {
    // last_price_dollars = 0.6000 (60%), previous_price_dollars = 0.5000 (50%) → +10pp
    const market = {
      ...baseMarket,
      last_price_dollars: "0.6000",
      yes_ask_dollars: "0.6100",
      previous_price_dollars: "0.5000",
    };
    const result = processKalshiMarkets([market]);
    expect(result).toHaveLength(1);
    expect(result[0].oneDayChange).toBeCloseTo(10.0, 1);
  });

  it("falls back to candle-derived oneDayChange when previous_price_dollars is absent", () => {
    const candles: KalshiCandle[] = [
      { ticker: "KXTEST-YES", open: 0.4, high: 0.55, low: 0.4, close: 0.40, volume: 100, ts: 1 },
      { ticker: "KXTEST-YES", open: 0.4, high: 0.55, low: 0.4, close: 0.50, volume: 200, ts: 2 },
    ];
    const candleMap = new Map([["KXTEST-YES", candles]]);
    const result = processKalshiMarkets([baseMarket], candleMap);
    expect(result).toHaveLength(1);
    // candle-derived: (50 - 40) = 10pp
    expect(result[0].oneDayChange).toBeCloseTo(10.0, 1);
  });
});
