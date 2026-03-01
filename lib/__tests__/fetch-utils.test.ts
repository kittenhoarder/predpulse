import { describe, it, expect } from "vitest";
import { batchParallel } from "../fetch-utils";

describe("batchParallel", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await batchParallel(items, 2, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects batch size", async () => {
    const concurrencyLog: number[] = [];
    let running = 0;

    const items = [1, 2, 3, 4, 5];
    await batchParallel(items, 2, async (n) => {
      running++;
      concurrencyLog.push(running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return n;
    });

    expect(Math.max(...concurrencyLog)).toBeLessThanOrEqual(2);
  });

  it("returns empty array for empty input", async () => {
    const results = await batchParallel([], 5, async (n) => n);
    expect(results).toEqual([]);
  });

  it("works when batch size exceeds item count", async () => {
    const items = [1, 2];
    const results = await batchParallel(items, 10, async (n) => n * 3);
    expect(results).toEqual([3, 6]);
  });
});
