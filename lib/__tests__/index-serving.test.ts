import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIndexProducts } from "../thematic-basket";
import { themeEvents } from "./fixtures/theme-events";
import { fedEvent, T0 } from "./fixtures/fed-event";
import { NextRequest } from "next/server";
type SavedFixture = { generatedAt: string; version?: number; indexProducts?: { asOf: string; products: unknown[] } };
const state = vi.hoisted(() => ({ snapshot: null as SavedFixture | null }));
vi.mock("../snapshot", () => ({ loadPublishedSnapshot: vi.fn(async () => state.snapshot) }));
import { GET } from "../../app/api/indices/route";
import { GET as retiredPulse } from "../../app/api/pulse/route";
afterEach(() => { state.snapshot = null; vi.restoreAllMocks(); });
describe("saved-only index serving", () => {
  it("serves the saved generation time and digest without upstream acquisition", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const digest = buildIndexProducts([fedEvent(),...themeEvents(undefined,T0)], null, null, T0);
    state.snapshot = { generatedAt: T0, indexProducts: digest };
    const response = await GET(new NextRequest("https://predpulse.xyz/api/indices"));
    const body = await response.json();
    expect(body.asOf).toBe(state.snapshot.generatedAt);
    expect(body.indexProducts).toEqual(digest);
    expect(body.indexProducts.outcomeBenchmark.state).toBe("available");
    expect(body.indexProducts.thematicBasket.coverage.usable).toBe(6);
    expect(network).not.toHaveBeenCalled();
  });
  it("reports missing/archived evidence without computing a live fallback", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    expect((await GET(new NextRequest("https://predpulse.xyz/api/indices"))).status).toBe(503);
    state.snapshot = { generatedAt: "2026-10-01T12:00:00.000Z", version: 1 };
    expect((await (await GET(new NextRequest("https://predpulse.xyz/api/indices"))).json()).indexProducts).toBeNull();
    expect(network).not.toHaveBeenCalled();
  });
  it("retires old API families explicitly", async () => {
    expect((await GET(new NextRequest("https://predpulse.xyz/api/indices?family=directional"))).status).toBe(410);
    expect((await retiredPulse()).status).toBe(410);
  });
});
