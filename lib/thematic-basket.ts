import type { GammaEvent } from "./types";
import type { DecisionDistribution } from "./decision-distribution";
import { buildIndexProducts as buildOutcomes } from "./outcome-benchmark";
import { fitIndexDigest } from "./belief-shift";
import { metadataIssue, observationIdentity, outcomeId, quoteValid, rulesHash, usableQuote } from "./index-evidence";
import { THEME_METHOD, type IndexProductsDigest, type IndexObservation, type ThematicBasket } from "./index-products";
import { THEME_ADAPTER, THEME_DEADLINE, THEME_TARGETS, themeQuestion } from "./theme-adapter";
import { basketMetrics, basketVersion } from "./theme-evidence";

/** No acquisition: six frozen, individually admitted state contracts from the existing feed. */
export function buildIndexProducts(events: GammaEvent[], previous: IndexProductsDigest | null,
  baseline: IndexProductsDigest | null, asOf: string, suppliedDecision?: DecisionDistribution | null): IndexProductsDigest {
  const digest=buildOutcomes(events,previous,baseline,asOf,suppliedDecision);
  const components: ThematicBasket["components"] = THEME_TARGETS.map(t=>{
    const families=events.filter(e=>e.id===t.familyId), event=families.length===1 ? families[0] : null;
    const markets=event?.markets?.filter(m=>m.id===t.marketId) ?? [], market=markets.length===1 ? markets[0] : null;
    const saved=previous?.observations.find(r=>r.marketId===t.marketId);
    const validMetadata=event && market && !metadataIssue(event,market) && !!outcomeId(market);
    let issue: ThematicBasket["components"][number]["issue"] = !event || !market ? "missing" : !validMetadata ||
      event.title!==`${t.state} enacts data center moratorium by...?` || market.question!==themeQuestion(t.state) ? "identity_changed" :
      market.endDate!==THEME_DEADLINE || market.createdAt!==t.createdAt ? "window_changed" : rulesHash(event,market)!==t.rulesHash ? "rules_changed" : null;
    const known: IndexObservation | null = validMetadata ? { marketId:market.id,familyId:event.id,outcomeId:outcomeId(market)!,question:market.question,
      eventSlug:event.slug,closesAt:market.endDate,rulesHash:rulesHash(event,market),...usableQuote(event,market,Date.parse(asOf)),prior:null,
      comparisonIssue:digest.baselineAt ? "missing_prior" : "no_baseline" } : saved ? {...saved,quote:null,prior:null,issue:event && market ? "invalid_identity" : "missing",
      comparisonIssue:digest.baselineAt ? "missing_prior" : "no_baseline"} : null;
    if (!known?.quote) issue ??= "quote_unavailable";
    if (known && !digest.observations.some(r=>r.marketId===t.marketId)) digest.observations.push(known);
    return {state:t.state,marketId:t.marketId,familyId:t.familyId,createdAt:t.createdAt,weight:1/6,issue};
  });
  const rows=components.map(c=>digest.observations.find(r=>r.marketId===c.marketId));
  const version=basketVersion(components,digest.observations);
  const old=baseline?.thematicBasket;
  const comparisonIssue: ThematicBasket["comparisonIssue"] = !digest.baselineAt || !old ? "capturing_baseline" :
    old.basketVersion!==version || old.methodology!==THEME_METHOD || old.adapter!==THEME_ADAPTER ? "basket_changed" : "incomplete_pairs";
  let comparable=0;
  if (digest.baselineAt && old && old.basketVersion===version && old.methodology===THEME_METHOD && old.adapter===THEME_ADAPTER) {
    rows.forEach((row,i)=>{
      const prior=baseline!.observations.find(r=>r.marketId===components[i].marketId);
      if (!components[i].issue && row?.quote && prior?.quote && !old.components[i].issue && observationIdentity(row)===observationIdentity(prior) && quoteValid(prior.quote,baseline!.asOf)) {
        row.prior={...prior.quote,identity:observationIdentity(prior)};row.comparisonIssue=null;comparable++;
      }
    });
  }
  const usable=rows.filter((r,i)=>r?.quote && !components[i].issue).length;
  const metrics=usable===6 ? basketMetrics(rows.map(r=>r!.quote!.midpoint),components.map(c=>c.weight),comparable===6 ? rows.map(r=>r!.prior!.midpoint) : undefined) : null;
  const p: ThematicBasket={id:"state-data-centre-moratoriums-2026",type:"thematic-basket",name:"State data-centre moratoriums",unit:"index points",
    methodology:THEME_METHOD,adapter:THEME_ADAPTER,deadline:THEME_DEADLINE,basketVersion:version,members:rows.filter((r):r is IndexObservation=>!!r).map(r=>r.marketId),components,
    state:usable===6 ? "available" : "unavailable", headline:metrics?.headline ?? null,priorLevel:metrics?.priorLevel ?? null,change24h:metrics?.change24h ?? null,
    contributions:metrics?.contributions ?? Array(6).fill(null),comparisonIssue:comparable===6 ? null : comparisonIssue,coverage:{expected:6,usable,comparable},
    history:[...(previous?.thematicBasket?.history ?? []).filter(point=>Math.floor(Date.parse(point.at)/3600000)!==Math.floor(Date.parse(asOf)/3600000)),
      {at:asOf,value:metrics?.headline ?? null,segment:version.slice(0,16)}].slice(-25)};
  digest.thematicBasket=p;
  return fitIndexDigest(digest);
}
