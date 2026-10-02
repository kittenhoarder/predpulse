import { isGuideId } from "./guide";
export type SheetState = {
  type: "menu" | "guide" | "index" | "evidence" | "filters";
  id?: string;
};
export interface SheetEntry {
  owner: string;
  depth: number;
  sheet: SheetState;
  base: string;
}
export function sheetUrl(href: string, sheet: SheetState): string {
  const url = new URL(href, "https://predpulse.xyz");
  url.searchParams.delete("guide");
  if (sheet.type === "guide" && sheet.id)
    url.searchParams.set("guide", sheet.id);
  if (sheet.type === "index" && sheet.id)
    url.searchParams.set("index", sheet.id);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function sheetFromUrl(href: string): SheetState | null {
  const url = new URL(href, "https://predpulse.xyz");
  const guide = url.searchParams.get("guide"),
    index = url.searchParams.get("index");
  if (isGuideId(guide)) return { type: "guide", id: guide };
  if (
    index &&
    /^(fed-policy-balance|market-attention|belief-shift-(economics|politics|crypto|tech))$/.test(
      index,
    )
  )
    return { type: "index", id: index };
  return null;
}
export function withoutSheet(href: string, type?: SheetState["type"]) {
  const url = new URL(href, "https://predpulse.xyz");
  if (!type || type === "guide") url.searchParams.delete("guide");
  if (!type || type === "index") url.searchParams.delete("index");
  return `${url.pathname}${url.search}${url.hash}`;
}
