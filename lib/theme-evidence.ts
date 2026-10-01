import { createHash } from "node:crypto";
import { observationIdentity } from "./index-evidence";
import { THEME_METHOD, type IndexProductsDigest, type IndexObservation, type ThematicBasket } from "./index-products";
import { THEME_ADAPTER, THEME_DEADLINE, THEME_TARGETS, themeQuestion } from "./theme-adapter";

export function basketMetrics(probabilities: number[], weights: number[], prior?: number[]) {
  if (probabilities.length < 3 || probabilities.length > 6 || weights.length !== probabilities.length ||
    weights.some((w) => !Number.isFinite(w) || w <= 0 || Math.abs(w - 1 / weights.length) > 1e-12) ||
    Math.abs(weights.reduce((s,n)=>s+n,0)-1)>1e-12 || probabilities.some((p)=>!Number.isFinite(p)||p<0||p>1) ||
    (prior && (prior.length!==probabilities.length || prior.some((p)=>!Number.isFinite(p)||p<0||p>1)))) throw new Error("Invalid basket inputs");
  const headline = 100 * probabilities.reduce((s,p,i)=>s+weights[i]*p,0);
  const priorLevel = prior ? 100 * prior.reduce((s,p,i)=>s+weights[i]*p,0) : null;
  const contributions = probabilities.map((p,i)=>prior ? 100*weights[i]*(p-prior[i]) : null);
  const change24h = prior ? contributions.reduce<number>((s,n)=>s+n!,0) : null;
  return {headline, priorLevel, contributions, change24h};
}
export function basketVersion(components: ThematicBasket["components"], rows: IndexObservation[]): string {
  return createHash("sha256").update(JSON.stringify([THEME_METHOD,THEME_ADAPTER,THEME_DEADLINE,
    components.map((c)=>[c.state,c.marketId,c.familyId,c.createdAt,c.weight,
      rows.find(r=>r.marketId===c.marketId) ? observationIdentity(rows.find(r=>r.marketId===c.marketId)!) : null])])).digest("hex").slice(0,32);
}
export function validateThematicBasket(p: ThematicBasket, digest: IndexProductsDigest): void {
  const fail = () => {throw new Error("Invalid saved thematic basket");};
  if (!p || p.id!=="state-data-centre-moratoriums-2026" || p.name!=="State data-centre moratoriums" || p.type!=="thematic-basket" || p.unit!=="index points" ||
    p.methodology!==THEME_METHOD || p.adapter!==THEME_ADAPTER || p.deadline!==THEME_DEADLINE || !Array.isArray(p.components) || p.components.length!==6 ||
    !Array.isArray(p.members) || new Set(p.members).size!==p.members.length || !p.coverage || p.coverage.expected!==6) return fail();
  const rows = p.components.map(c=>digest.observations.find(r=>r.marketId===c.marketId));
  for (let i=0;i<6;i++) {
    const c=p.components[i],t=THEME_TARGETS[i],r=rows[i];
    if (!c || c.state!==t.state || c.marketId!==t.marketId || c.familyId!==t.familyId || c.createdAt!==t.createdAt || c.weight!==1/6 ||
      ![null,"missing","identity_changed","rules_changed","window_changed","quote_unavailable"].includes(c.issue) ||
      (c.issue===null && (!r?.quote || r.familyId!==t.familyId || r.question!==themeQuestion(t.state) || r.rulesHash!==t.rulesHash || r.closesAt!==THEME_DEADLINE))) return fail();
  }
  if (JSON.stringify(p.members)!==JSON.stringify(rows.filter((r):r is IndexObservation=>!!r).map(r=>r.marketId)) || p.basketVersion!==basketVersion(p.components,digest.observations)) return fail();
  const usable=rows.filter((r,i)=>r?.quote && p.components[i].issue===null).length;
  const comparable=["capturing_baseline","basket_changed"].includes(p.comparisonIssue ?? "") ? 0 : rows.filter((r,i)=>r?.quote && r.prior && p.components[i].issue===null).length;
  if (p.coverage.usable!==usable || p.coverage.comparable!==comparable || !Array.isArray(p.contributions) || p.contributions.length!==6) return fail();
  const ready=usable===6, paired=ready && comparable===6 && p.comparisonIssue===null;
  const metrics=ready ? basketMetrics(rows.map(r=>r!.quote!.midpoint),p.components.map(c=>c.weight),paired ? rows.map(r=>r!.prior!.midpoint) : undefined) : null;
  const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  if (p.state!==(ready?"available":"unavailable") || !equal([p.headline,p.priorLevel,p.change24h,p.contributions],
    metrics ? [metrics.headline,metrics.priorLevel,metrics.change24h,metrics.contributions] : [null,null,null,Array(6).fill(null)]) ||
    (paired && !digest.baselineAt) || (!paired && !["capturing_baseline","basket_changed","incomplete_pairs"].includes(p.comparisonIssue!)) ||
    !Array.isArray(p.history) || !p.history.length || p.history.length>25 || p.history.some((point,i)=>
      !Number.isFinite(Date.parse(point.at)) || Date.parse(point.at)>Date.parse(digest.asOf) || (i>0 && Math.floor(Date.parse(point.at)/3600000)<=Math.floor(Date.parse(p.history[i-1].at)/3600000)) ||
      !/^[a-f0-9]{16}$/.test(point.segment) || (point.value!==null && (!Number.isFinite(point.value)||point.value<0||point.value>100))) ||
    p.history.at(-1)!.at!==digest.asOf || p.history.at(-1)!.value!==p.headline || p.history.at(-1)!.segment!==p.basketVersion.slice(0,16)) return fail();
}
