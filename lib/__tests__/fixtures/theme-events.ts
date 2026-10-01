import type { GammaEvent } from "../../types";
import template from "./moratorium-template.json";
import { THEME_TARGETS } from "../../theme-adapter";
export const THEME_T0 = "2026-10-01T11:10:08.043Z", THEME_T1 = "2026-10-02T11:10:08.043Z";
/** Real admitted rules/identities. Test quotes and capture timestamps are synthetic. */
export function themeEvents(prices=[.2,.4,.8,.3,.5,.6],at=THEME_T0): GammaEvent[] {
  return THEME_TARGETS.map((t,i)=>({ ...template,id:t.familyId,slug:`${t.state.toLowerCase()}-enacts-data-center-moratorium-by-20260929`,
    title:template.title.replaceAll("Indiana",t.state),description:template.description.replaceAll("Indiana",t.state),
    markets:[{...template.markets[0],id:t.marketId,question:template.markets[0].question.replaceAll("Indiana",t.state),
      description:template.markets[0].description.replaceAll("Indiana",t.state),createdAt:t.createdAt,
      clobTokenIds:JSON.stringify([String(9000+i),String(10000+i)]),updatedAt:at,bestBid:prices[i]-.001,bestAsk:prices[i]+.001}]
  } as unknown as GammaEvent));
}
