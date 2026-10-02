import { describe, expect, it } from "vitest";
import { sheetFromUrl, sheetUrl, withoutSheet } from "../sheet-history";
describe("sheet URLs", () => {
  it("preserves page filters, anchors and a parent index", () => {
    const href = sheetUrl(
      "/pulse?index=fed-policy-balance&sort=watchlist#evidence",
      { type: "guide", id: "policy-balance" },
    );
    expect(href).toBe(
      "/pulse?index=fed-policy-balance&sort=watchlist&guide=policy-balance#evidence",
    );
    expect(withoutSheet(href, "guide")).toBe(
      "/pulse?index=fed-policy-balance&sort=watchlist#evidence",
    );
    expect(sheetFromUrl(href)).toEqual({ type: "guide", id: "policy-balance" });
  });
  it("never adds menu or evidence query parameters", () => {
    expect(sheetUrl("/markets?sort=watchlist", { type: "menu" })).toBe(
      "/markets?sort=watchlist",
    );
    expect(
      sheetUrl("/pulse?index=fed-policy-balance", {
        type: "evidence",
        id: "contract",
      }),
    ).toBe("/pulse?index=fed-policy-balance");
  });
  it("ignores unknown ids and reads index deep links", () => {
    expect(sheetFromUrl("/?guide=bad")).toBeNull();
    expect(sheetFromUrl("/pulse?index=bad")).toBeNull();
    expect(sheetFromUrl("/pulse?index=market-attention")).toEqual({
      type: "index",
      id: "market-attention",
    });
    expect(withoutSheet("/pulse?index=x&guide=y&q=kept#anchor")).toBe(
      "/pulse?q=kept#anchor",
    );
  });
});
