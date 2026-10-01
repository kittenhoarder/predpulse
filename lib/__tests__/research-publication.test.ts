import { afterEach, describe, expect, it, vi } from "vitest";
import { fedEvent } from "./fixtures/fed-event";
import type { GammaEvent, ProcessedMarket } from "../types";

const storage = vi.hoisted(() => new Map<string, { text: string; etag: string }>());
const puts = vi.hoisted(() => vi.fn());
const gets = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (path: string) => {
    gets(path);
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
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); storage.clear(); puts.mockClear(); gets.mockClear(); vi.restoreAllMocks(); });
describe("scheduled immutable capture", () => {
  it("persists the index cohort and exact pairs across restart with no additional storage or venue operations", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token"); vi.stubEnv("GITHUB_REF_NAME", "feat/spec-007-belief-shift");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T14:00:00Z")); vi.resetModules();
    const network = vi.spyOn(globalThis, "fetch");
    const events = (at: string, shift = 0): GammaEvent[] => Array.from({ length: 6 }, (_, i) => ({
      id: String(1000 + i), slug: `event-${i}`, title: `Event ${i}`, description: "Event rules", active: true, closed: false, archived: false, tags: [{ slug: "economics" }],
      markets: [{ id: String(2000 + i), question: `Will event ${i} happen?`, description: "Contract rules", resolutionSource: "Official",
        outcomes: '["Yes","No"]', clobTokenIds: JSON.stringify([String(3000 + i), String(4000 + i)]), active: true, closed: false, archived: false,
        endDate: "2026-10-10T00:00:00Z", updatedAt: at, bestBid: 0.29 + shift, bestAsk: 0.31 + shift, volume24hr: 100_000 - i }],
    } as unknown as GammaEvent));
    const sources = { polymarkets: [market("polymarket")], kalshiMarkets: [market("kalshi")], manifoldMarkets: [], outlookEvents: events(new Date().toISOString()) };
    const first = await (await import("../snapshot")).publishSnapshot(sources);
    expect(first.indexProducts!.products[0].state).toBe("warming");
    expect(gets).toHaveBeenCalledTimes(3); expect(puts).toHaveBeenCalledTimes(2);
    gets.mockClear(); puts.mockClear(); vi.resetModules();
    vi.setSystemTime(new Date("2026-10-01T14:00:00Z"));
    const restarted = await import("../snapshot");
    const second = await restarted.publishSnapshot({ ...sources, outlookEvents: events(new Date().toISOString(), 0.03) });
    expect(gets).toHaveBeenCalledTimes(5); expect(puts).toHaveBeenCalledTimes(2); expect(network).not.toHaveBeenCalled();
    expect(second.indexProducts!.products[0].members).toEqual(first.indexProducts!.products[0].members);
    expect(second.indexProducts!.products[0].headline).toBeCloseTo(3);
    expect(second.indexProducts!.baselineAt).toBe(first.generatedAt);
    expect(await restarted.loadPublishedSnapshot()).toEqual(second);
    expect(storage.has("predpulse/latest.json")).toBe(false);
  });

  it("persists the complete Fed partition across restart with the existing five reads and two writes", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token"); vi.stubEnv("GITHUB_REF_NAME", "feat/spec-008-outcome-benchmarks");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z")); vi.resetModules();
    const network = vi.spyOn(globalThis, "fetch");
    const sources = { polymarkets: [market("polymarket")], kalshiMarkets: [market("kalshi")], manifoldMarkets: [], outlookEvents: [fedEvent([.08,.12,.55,.20,.05])] };
    const first = await (await import("../snapshot")).publishSnapshot(sources);
    expect(first.indexProducts!.outcomeBenchmark!.headline).toBeCloseTo(5);
    expect(gets).toHaveBeenCalledTimes(3); expect(puts).toHaveBeenCalledTimes(2);
    gets.mockClear(); puts.mockClear(); vi.resetModules(); vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
    const restarted = await import("../snapshot");
    const second = await restarted.publishSnapshot({...sources, outlookEvents:[fedEvent(undefined,new Date().toISOString())]});
    expect(gets).toHaveBeenCalledTimes(5); expect(puts).toHaveBeenCalledTimes(2); expect(network).not.toHaveBeenCalled();
    expect(second.indexProducts!.outcomeBenchmark!.change24h).toBeCloseTo(-15);
    expect(await restarted.loadPublishedSnapshot()).toEqual(second);
    expect(storage.has("predpulse/latest.json")).toBe(false);
    expect(Array.from(storage.keys()).every(path=>path.startsWith("predpulse/previews/spec-08/"))).toBe(true);
  });

  it("renews attention across restart without additional reads, writes or acquisition", async()=>{
    vi.stubEnv("BLOB_READ_WRITE_TOKEN","test-token");vi.stubEnv("GITHUB_REF_NAME","feat/spec-009-market-attention");
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));vi.resetModules();const network=vi.spyOn(globalThis,"fetch");
    const input=(id:string,slug:string)=>({...fedEvent(),id,slug:`attention-${id}`,title:`Current ${slug} event`,volume24hr:10000,tags:[{slug}]} as GammaEvent);
    const sources={polymarkets:[market("polymarket")],kalshiMarkets:[market("kalshi")],manifoldMarkets:[],outlookEvents:[input("7000","economics")]};
    const first=await(await import("../snapshot")).publishSnapshot(sources);expect(first.indexProducts!.marketAttention!.state).toBe("available");
    expect(gets).toHaveBeenCalledTimes(3);expect(puts).toHaveBeenCalledTimes(2);gets.mockClear();puts.mockClear();vi.resetModules();vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
    const restarted=await import("../snapshot"),second=await restarted.publishSnapshot({...sources,outlookEvents:[input("8000","sports")]});
    expect(gets).toHaveBeenCalledTimes(5);expect(puts).toHaveBeenCalledTimes(2);expect(network).not.toHaveBeenCalled();
    expect(second.indexProducts!.marketAttention!.categories[0].share).toBe(1);expect(second.indexProducts!.marketAttention!.categories[3].count).toBe(0);
    expect(await restarted.loadPublishedSnapshot()).toEqual(second);expect([...storage.keys()].every(path=>path.startsWith("predpulse/previews/spec-09-attention/"))).toBe(true);
  });

  it("fails closed before any storage operation when production publication has no main branch identity", async () => {
    vi.stubEnv("GITHUB_REF_NAME", ""); vi.stubEnv("VERCEL_GIT_COMMIT_REF", ""); vi.stubEnv("VERCEL_ENV", "production"); vi.resetModules();
    const publisher = await import("../snapshot");
    expect(publisher.assertPublicationTarget).toThrow("main branch");
    expect(gets).not.toHaveBeenCalled(); expect(puts).not.toHaveBeenCalled();
  });
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
