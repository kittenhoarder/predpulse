import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { navigationFixture } from "./fixtures/navigation";
import { T1 } from "./fixtures/fed-event";
import {
  briefingTiles,
  EXPLORE,
  PILLARS,
  fedPresentation,
  fedStat,
  fedSummary,
  movesStat,
  nextPillar,
  FED_HREF,
  exploreHook,
} from "../nav";
import { snapshotStatus } from "../bootstrap";
const now = Date.parse(T1);
describe("navigation and truthful summaries", () => {
  it("links only to real routes and uses short registry hooks", () => {
    for (const entry of [...PILLARS, ...EXPLORE])
      expect(
        existsSync(
          `app${new URL(entry.href, "https://test").pathname === "/" ? "" : new URL(entry.href, "https://test").pathname}/page.tsx`,
        ),
      ).toBe(true);
    for (const entry of EXPLORE)
      expect(exploreHook(entry.id).length).toBeLessThanOrEqual(40);
    expect(nextPillar("/markets")?.href).toBe("/");
    expect(nextPillar("/unknown")).toBeNull();
  });
  it("uses current Fed data before a 24h baseline exists", () => {
    const b = navigationFixture();
    expect(fedPresentation(b, now)).toBe("summary");
    expect(fedSummary(b, now)).toMatchObject({ outcome: "Hold", share: 0.5 });
    expect(fedStat(b, now)).toBe("Hold leads · -10.0");
    expect(briefingTiles(b, now).map((tile) => tile.id)).toEqual([
      "move",
      "fed",
      "belief",
    ]);
    expect(briefingTiles(b, now).find((tile) => tile.id === "fed")?.href).toBe(
      FED_HREF,
    );
    expect(movesStat(b, now)).toBe("Top move +18.0 pp");
  });
  it("uses only a coherent matching fallback", () => {
    const b = navigationFixture();
    b.indexProducts!.outcomeBenchmark!.state = "unavailable";
    expect(fedPresentation(b, now)).toBe("fallback-card");
    b.indexProducts!.outcomeBenchmark!.familyId = "different";
    expect(fedPresentation(b, now)).toBeNull();
    b.indexProducts!.outcomeBenchmark!.familyId = null;
    expect(fedPresentation(b, now)).toBe("fallback-card");
    b.decisionDistribution!.coherent = false;
    expect(fedPresentation(b, now)).toBeNull();
  });
  it("rejects stale, missing, invalid and cross-publication data", () => {
    expect(fedPresentation(undefined, now)).toBeNull();
    expect(briefingTiles(undefined, now)).toEqual([]);
    expect(movesStat(undefined, now)).toBeNull();
    expect(fedStat(undefined, now)).toBeNull();
    const b = navigationFixture();
    expect(fedPresentation(b, now + 4 * 3_600_000)).toBeNull();
    expect(movesStat(b, now + 4 * 3_600_000)).toBeNull();
    expect(briefingTiles(b, now + 4 * 3_600_000)).toEqual([]);
    b.indexProducts!.asOf = "2026-09-30T12:00:00Z";
    b.decisionDistribution!.asOf = b.indexProducts!.asOf;
    expect(fedPresentation(b, now)).toBeNull();
    expect(fedStat(b, now)).toBeNull();
  });
  it("fills with distinct fallback products and never duplicates a contract", () => {
    const b = navigationFixture();
    b.indexProducts!.outcomeBenchmark = undefined;
    b.decisionDistribution = null;
    expect(briefingTiles(b, now).map((tile) => tile.id)).toEqual([
      "move",
      "belief",
      "attention",
    ]);
    b.indexProducts!.products[0].state = "warming";
    b.indexProducts!.products[0].headline = null;
    const tiles = briefingTiles(b, now);
    expect(tiles.map((tile) => tile.id)).toEqual([
      "move",
      "attention",
      "observed",
    ]);
    expect(tiles[0].contract).not.toBe(tiles[2].contract);
    b.observations!.items = [b.monitor!.items[0]];
    expect(briefingTiles(b, now)).toHaveLength(2);
    b.monitor = null;
    b.observations = null;
    expect(briefingTiles(b, now)).toHaveLength(1);
    b.indexProducts!.marketAttention!.state = "empty";
    expect(briefingTiles(b, now)).toEqual([]);
  });
  it("keeps valid zeros and deterministic ties", () => {
    const b = navigationFixture();
    b.indexProducts!.outcomeBenchmark!.headline = 0;
    b.indexProducts!.products[0].headline = 0;
    expect(fedStat(b, now)).toBe("Hold leads · 0.0");
    expect(briefingTiles(b, now)[2].value).toBe("0.0 pp");
    b.monitor!.items.forEach((m) => {
      m.change24h = 10;
    });
    expect(movesStat(b, now)).toBe("Top move +10.0 pp");
  });
  it("ages retained responses without trusting a cached status label", () => {
    expect(snapshotStatus(T1, now)).toBe("hourly");
    expect(snapshotStatus(T1, now + 76 * 60_000)).toBe("delayed");
    expect(snapshotStatus(T1, now + 181 * 60_000)).toBe("stale");
    expect(snapshotStatus("invalid", now)).toBe("stale");
    expect(snapshotStatus(T1, now - 600_000)).toBe("stale");
  });
});
