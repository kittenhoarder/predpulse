import { describe, it, expect } from "vitest";
import { computeDepthScore } from "../orderbook";

describe("computeDepthScore", () => {
  it("returns 50 when no levels near mid", () => {
    expect(computeDepthScore([], [], 0.5)).toBe(50);
  });

  it("returns 100 when only bids near mid", () => {
    const bids = [{ price: 0.48, quantity: 100 }];
    expect(computeDepthScore(bids, [], 0.5)).toBe(100);
  });

  it("returns 0 when only asks near mid", () => {
    const asks = [{ price: 0.52, quantity: 100 }];
    expect(computeDepthScore([], asks, 0.5)).toBe(0);
  });

  it("returns ~50 for equal bid/ask depth", () => {
    const bids = [{ price: 0.49, quantity: 100 }];
    const asks = [{ price: 0.51, quantity: 100 }];
    expect(computeDepthScore(bids, asks, 0.5)).toBe(50);
  });

  it("weights toward bids when bid quantity > ask quantity", () => {
    const bids = [{ price: 0.49, quantity: 300 }];
    const asks = [{ price: 0.51, quantity: 100 }];
    expect(computeDepthScore(bids, asks, 0.5)).toBe(75);
  });

  it("excludes levels outside 5pp of mid", () => {
    const bids = [
      { price: 0.49, quantity: 100 },
      { price: 0.30, quantity: 9999 },
    ];
    const asks = [{ price: 0.51, quantity: 100 }];
    expect(computeDepthScore(bids, asks, 0.5)).toBe(50);
  });
});
