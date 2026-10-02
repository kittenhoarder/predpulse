import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDE, isGuideId } from "../guide";
const words = (text: string) => text.trim().split(/\s+/).length;
describe("central Guide", () => {
  it("has concise complete entries, valid relationships and server-rendered method anchors", () => {
    const methodology = readFileSync("app/methodology/page.tsx", "utf8");
    expect(methodology).toContain("id={entry.method}");
    for (const [id, entry] of Object.entries(GUIDE)) {
      expect(entry.id).toBe(id);
      expect(entry.hook.length, id).toBeLessThanOrEqual(40);
      expect(entry.why, id).not.toMatch(
        /^(This|Shows|Automatically|Calculates|Polymarket|Kalshi|Manifold)\b/,
      );
      expect(words(entry.why), id).toBeLessThanOrEqual(45);
      for (const field of [entry.see, entry.read, entry.limits]) {
        expect(field.length, id).toBeGreaterThan(0);
        for (const bullet of field)
          expect(words(bullet), `${id}: ${bullet}`).toBeLessThanOrEqual(25);
      }
      expect(entry.see.length).toBeLessThanOrEqual(3);
      expect(entry.read.length).toBeLessThanOrEqual(3);
      for (const related of entry.related)
        expect(isGuideId(related)).toBe(true);
      expect(entry.method).toBe(entry.id);
    }
    expect(isGuideId("__proto__")).toBe(false);
    expect(isGuideId(null)).toBe(false);
  });
  it("preserves each distinct honesty constraint from the previous explanations", () => {
    const text = Object.values(GUIDE)
      .flatMap((entry) => entry.limits)
      .join(" ")
      .toLowerCase();
    for (const phrase of [
      "not a probability",
      "expected rate change",
      "settlement may differ",
      "manifold",
      "last trade",
      "75 minutes",
      "95–105%",
      "80% coverage",
      "not representative",
      "100 independent",
      "chronological holdout",
      "45 minutes",
      "not causation",
      "not an arbitrage",
      "never overwritten",
      "not backfilled",
      "not embedded",
      "five buckets",
      "nearest 25",
      "no finite upper bound",
      "not a comprehensive calendar",
      "not sentiment",
      "dollar volume",
      "private browsing",
    ])
      expect(text, phrase).toContain(phrase);
  });
});
