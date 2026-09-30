import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProcessedMarket } from "../types";

const storage = vi.hoisted(() => new Map<string, { text: string; etag: string }>());
const puts = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (path: string) => {
    const key = path.startsWith("https:") ? new URL(path).pathname.slice(1) : path;
    const blob = storage.get(key);
    return blob ? { statusCode: 200, blob: { size: Buffer.byteLength(blob.text), etag: blob.etag },
      stream: new Response(blob.text).body } : null;
  }),
  put: async (path: string, text: string, options: { ifMatch?: string }) => {
    if (options.ifMatch && storage.get(path)?.etag !== options.ifMatch) throw new Error("Precondition failed");
    puts(path);
    storage.set(path, { text, etag: `${Date.now()}-${storage.size}` });
    return { url: `https://test.private.blob.vercel-storage.com/${path}` };
  },
}));
vi.mock("../research-acquisition", () => ({ refreshTrackedContracts: async () => ({ markets: [], attemptedIds: [] }) }));

function market(source: "polymarket" | "kalshi"): ProcessedMarket {
  return { source, id: source, question: "Will inflation exceed 3%?", eventTitle: "Inflation", eventSlug: "inflation",
    categoryslugs: ["economics"], categories: ["Economics"], image: "", currentPrice: 50,
    oneDayChange: 5, oneHourChange: 1, oneWeekChange: 5, oneMonthChange: 5, volume24h: 100_000,
    volume1wk: 700_000, volume1mo: 3_000_000, liquidity: 100_000, createdAt: "2026-01-01T00:00:00Z",
    endDate: "2026-10-10T00:00:00Z", outcomes: ["Yes", "No"], outcomePrices: [0.5, 0.5],
    bestBid: 0.49, bestAsk: 0.51, spread: 0.02, clobTokenId: "", description: "Rules", resolutionSource: "Official", competitive: 0.5 };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); storage.clear(); puts.mockClear(); });
describe("scheduled immutable capture", () => {
  it("uses two writes, survives module restart, and reloads an exact historical generation", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("GITHUB_REF_NAME", "feat/spec-006-durable-evidence");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T14:00:00Z"));
    vi.resetModules();
    const firstModule = await import("../snapshot");
    const sources = { polymarkets: [market("polymarket"), { ...market("polymarket"), id: "p2" }], kalshiMarkets: [market("kalshi")], manifoldMarkets: [], outlookEvents: [] };
    const first = await firstModule.publishSnapshot(sources);
    expect(puts).toHaveBeenCalledTimes(2);
    const saved = storage.get("predpulse/previews/spec-06/generations/1790776800000.json")!.text;
    vi.resetModules();
    const restarted = await import("../snapshot");
    expect(await restarted.loadPublishedSnapshot()).toEqual(first);
    vi.setSystemTime(new Date("2026-10-01T14:00:00Z"));
    await restarted.publishSnapshot(sources);
    expect(puts).toHaveBeenCalledTimes(4);
    expect(await restarted.loadHistoricalSnapshot(first.generatedAt)).toEqual(first);
    expect(await restarted.listHistoricalSnapshots()).toHaveLength(2);
    expect(storage.get("predpulse/previews/spec-06/generations/1790776800000.json")!.text).toBe(saved);
    expect(storage.has("predpulse/latest.json")).toBe(false);
  });
});
