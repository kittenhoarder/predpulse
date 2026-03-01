import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_STORE = path.join(os.tmpdir(), "predpulse-index-store-persistence-test.json");

beforeEach(() => {
  vi.resetModules();
  delete process.env.INDEX_PERSISTENCE_ENABLED;
  process.env.INDEX_STORE_PATH = TEST_STORE;
  if (fs.existsSync(TEST_STORE)) fs.unlinkSync(TEST_STORE);
});

describe("index-store persistence mode", () => {
  it("uses in-memory store when persistence is disabled", async () => {
    const store = await import("../index-store");

    expect(store.isIndexPersistenceEnabled()).toBe(false);

    const appended = store.appendSnapshotBatch({
      indexSnapshots: [
        {
          timestamp: new Date().toISOString(),
          family: "directional",
          category: "economics",
          sourceScope: "core",
          horizon: "24h",
          score: 55,
          confidence: 70,
          coverage: 80,
          rawSignals: { momentum: 0.3 },
          diagnostics: { freshness: 80, sourceAgreement: 75, featureCoverage: 90 },
        },
      ],
      marketSnapshots: [],
      minIntervalMs: 0,
    });

    expect(appended).toBe(true);
    expect(store.readStore().indexSnapshots).toHaveLength(1);
    expect(fs.existsSync(TEST_STORE)).toBe(false);
  });

  it("writes to disk when persistence is enabled", async () => {
    process.env.INDEX_PERSISTENCE_ENABLED = "true";
    const store = await import("../index-store");

    expect(store.isIndexPersistenceEnabled()).toBe(true);

    const appended = store.appendSnapshotBatch({
      indexSnapshots: [
        {
          timestamp: new Date().toISOString(),
          family: "directional",
          category: "economics",
          sourceScope: "core",
          horizon: "24h",
          score: 60,
          confidence: 75,
          coverage: 85,
          rawSignals: { flow: 0.2 },
          diagnostics: { freshness: 82, sourceAgreement: 76, featureCoverage: 91 },
        },
      ],
      marketSnapshots: [],
      minIntervalMs: 0,
    });

    expect(appended).toBe(true);
    expect(store.readStore().indexSnapshots).toHaveLength(1);
    expect(fs.existsSync(TEST_STORE)).toBe(true);
  });
});
