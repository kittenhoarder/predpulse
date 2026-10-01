import type { GammaEvent, GammaMarket } from "../../types";
export const T0 = "2026-10-01T12:00:00.000Z", T1 = "2026-10-02T12:00:00.000Z";
const labels = ["50+ bps decrease", "25 bps decrease", "No change", "25 bps increase", "50+ bps increase"];
const rules = `The upper bound of the target federal funds rate. Changes are rounded up to the nearest 25. The resolution source is the FOMC statement after its meeting scheduled for October 27-28, 2026: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm. Otherwise resolve to the "No change" bracket.`;
export function fedEvent(prices = [.12, .18, .50, .15, .05], at = T0): GammaEvent {
  return { id: "100", slug: "fed-decision-in-october", title: "Fed Decision in October?", description: rules,
    active: true, closed: false, archived: false, volume24hr: 100_000, tags: [{slug:"economics"}],
    markets: labels.map((groupItemTitle, i) => ({ id: String(200 + i), question: `Will the Fed choose ${groupItemTitle} in October?`,
      clobTokenIds: JSON.stringify([String(300 + i), String(400 + i)]), outcomes: '["Yes","No"]',
      groupItemTitle, description: rules, resolutionSource: "FOMC statement", active: true, closed: false, archived: false,
      endDate: "2026-10-29T03:59:00Z", updatedAt: at, bestBid: prices[i] - .001, bestAsk: prices[i] + .001, volume24hr: 100_000 - i } as GammaMarket)),
  } as unknown as GammaEvent;
}
