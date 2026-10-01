import type { GammaEvent } from "./types";
import { ATTENTION_CATEGORIES, ATTENTION_CLASSIFIER, ATTENTION_MAX_BYTES, ATTENTION_METHOD, type AttentionCategory, type MarketAttention, type AttentionSource } from "./attention-model";

const TAGS: Record<AttentionCategory, readonly string[]> = {
  sports: ["sports", "games", "esports"], weather: ["weather", "daily-temperature", "highest-temperature"],
  crypto: ["crypto", "crypto-prices"], economics: ["economics", "economy", "macro-indicators", "economic-policy", "finance"],
  technology: ["tech", "ai"], politics: ["politics", "geopolitics", "elections", "global-elections"], other: [],
};
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.trim() === id && Buffer.byteLength(id) <= 64;
export const attentionSourceOrder = (a: AttentionSource, b: AttentionSource) => b.volume - a.volume || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function attentionCategory(tags: unknown): { key: AttentionCategory; fallback: boolean } {
  if (tags === undefined || tags === null) return {key:"other",fallback:false};
  if (!Array.isArray(tags) || tags.length > 64 || tags.some(t => !t || typeof t.slug !== "string" || t.slug.length > 96)) return {key:"other",fallback:true};
  const slugs = new Set(tags.map(t => t.slug.toLowerCase()));
  return {key:ATTENTION_CATEGORIES.find(key => TAGS[key].some(tag => slugs.has(tag))) ?? "other",fallback:false};
}
function shortTitle(title: string): string {
  if (Buffer.byteLength(title) <= 96) return title;
  let result = "", length = 0;
  for (const char of title) { const n = Buffer.byteLength(char); if (length + n > 93) break; result += char; length += n; }
  return result + "…";
}
/** Two passes over the existing bounded sample; at most 21 retained candidate rows. */
export function buildMarketAttention(events: GammaEvent[], asOf: string): MarketAttention {
  if (!Number.isFinite(Date.parse(asOf))) throw new Error("Invalid attention timestamp");
  const map: MarketAttention = {id:"market-attention",type:"market-attention",methodology:ATTENTION_METHOD,classifier:ATTENTION_CLASSIFIER,
    asOf,state:"unavailable",issue:"no_eligible_events",screened:events.length,included:0,totalVolume:0,exclusions:{},tagFallbacks:0,sourceUnavailable:0,
    categories:ATTENTION_CATEGORIES.map(key=>({key,volume:0,count:0,share:0,sources:[]}))};
  const exclude = (reason: string) => { map.exclusions[reason] = (map.exclusions[reason] ?? 0) + 1; };
  if (events.length > 500) {map.issue="input_limit";map.exclusions.input_limit=events.length;return validateMarketAttention(map,asOf);}
  const counts = new Map<string,number>();
  for (const e of events) if (validId(e?.id)) counts.set(e.id,(counts.get(e.id) ?? 0)+1);
  for (const e of events) {
    if (!validId(e?.id)) {exclude("invalid_id");continue;}
    if (counts.get(e.id)! > 1) {exclude("duplicate_id");continue;}
    if (e.active !== true || e.closed !== false || e.archived === true) {exclude("inactive");continue;}
    if (!finite(e.volume24hr)) {exclude("invalid_volume");continue;}
    const {key,fallback}=attentionCategory(e.tags), group=map.categories.find(c=>c.key===key)!;
    group.volume+=e.volume24hr;group.count++;map.included++;if(fallback)map.tagFallbacks++;
    if (typeof e.slug !== "string" || !/^[a-z0-9-]{1,128}$/.test(e.slug) || typeof e.title !== "string" || !e.title.trim()) {map.sourceUnavailable++;continue;}
    group.sources.push({id:e.id,slug:e.slug,title:shortTitle(e.title),volume:e.volume24hr});
    group.sources.sort(attentionSourceOrder);if(group.sources.length>3)group.sources.pop();
  }
  map.totalVolume=map.categories.reduce((sum,c)=>sum+c.volume,0);
  if (!finite(map.totalVolume)) {
    map.issue="arithmetic_overflow";map.included=0;map.totalVolume=0;map.tagFallbacks=0;map.sourceUnavailable=0;
    map.exclusions={arithmetic_overflow:events.length};map.categories.forEach(c=>{c.volume=0;c.count=0;c.sources=[];});
  } else {
    map.issue=map.included ? null : "no_eligible_events";
    map.state=map.included ? map.totalVolume>0 ? "available" : "empty" : "unavailable";
    map.categories.forEach(c=>{c.share=map.totalVolume>0 ? c.volume/map.totalVolume : 0;});
  }
  const candidates=map.categories.map(c=>({key:c.key,sources:c.sources}));map.categories.forEach(c=>{c.sources=[];});
  if(bytes(map)>ATTENTION_MAX_BYTES)throw new Error("Required attention summary exceeds allocation");
  const add=(key:AttentionCategory,row:AttentionSource)=>{const c=map.categories.find(c=>c.key===key)!;c.sources.push(row);if(bytes(map)>ATTENTION_MAX_BYTES)c.sources.pop();};
  candidates.forEach(c=>{if(c.sources[0])add(c.key,c.sources[0]);});
  candidates.flatMap(c=>c.sources.slice(1).map(row=>({key:c.key,row}))).sort((a,b)=>attentionSourceOrder(a.row,b.row)).forEach(({key,row})=>{
    const original=candidates.find(c=>c.key===key)!.sources, kept=map.categories.find(c=>c.key===key)!.sources;
    if(kept.length===original.indexOf(row))add(key,row);
  });
  return validateMarketAttention(map,asOf);
}
/** A compact summary validates its own arithmetic; rows are examples, not the whole denominator. */
export function validateMarketAttention(value: unknown, asOf: string): MarketAttention {
  const p=value as MarketAttention, fail=()=>{throw new Error("Invalid saved market attention");};
  if(!p || p.id!=="market-attention" || p.type!=="market-attention" || p.methodology!==ATTENTION_METHOD || p.classifier!==ATTENTION_CLASSIFIER ||
    p.asOf!==asOf || !Number.isFinite(Date.parse(asOf)) || !integer(p.screened) || !integer(p.included) || p.included>500 || !finite(p.totalVolume) ||
    !integer(p.tagFallbacks) || p.tagFallbacks>p.included || !integer(p.sourceUnavailable) || p.sourceUnavailable>p.included || !p.exclusions ||
    Object.entries(p.exclusions).some(([k,n])=>!["invalid_id","duplicate_id","inactive","invalid_volume","input_limit","arithmetic_overflow"].includes(k)||!integer(n)) ||
    !Array.isArray(p.categories) || p.categories.length!==7 || bytes(p)>ATTENTION_MAX_BYTES) return fail();
  let count=0,total=0;const ids=new Set<string>();
  for(let i=0;i<7;i++){
    const c=p.categories[i];if(!c || c.key!==ATTENTION_CATEGORIES[i] || !integer(c.count) || c.count>500 || !finite(c.volume) || !finite(c.share) || c.share>1 ||
      (c.count===0 && c.volume!==0) || Math.abs(c.share-(p.totalVolume>0 ? c.volume/p.totalVolume : 0))>1e-12 || !Array.isArray(c.sources) || c.sources.length>Math.min(3,c.count))return fail();
    let rowVolume=0;
    for(let j=0;j<c.sources.length;j++){const r=c.sources[j];if(!r || !validId(r.id) || ids.has(r.id) || typeof r.slug!=="string" || !/^[a-z0-9-]{1,128}$/.test(r.slug) ||
      typeof r.title!=="string" || !r.title.trim() || Buffer.byteLength(r.title)>96 || !finite(r.volume) || (j>0 && attentionSourceOrder(c.sources[j-1],r)>0))return fail();
      ids.add(r.id);rowVolume+=r.volume;
    }
    if(!finite(rowVolume)||rowVolume>c.volume+Math.max(1,c.volume)*1e-12)return fail();count+=c.count;total+=c.volume;
  }
  if(!finite(total)||Math.abs(total-p.totalVolume)>Math.max(1,total)*1e-12 || count!==p.included ||
    Object.values(p.exclusions).reduce((a,b)=>a+b,0)+p.included!==p.screened)return fail();
  if(p.exclusions.input_limit && p.screened<=500)return fail();
  const issue=p.screened>500 ? "input_limit" : p.exclusions.arithmetic_overflow ? "arithmetic_overflow" : !p.included ? "no_eligible_events" : null;
  const state=p.included ? p.totalVolume>0 ? "available" : "empty" : "unavailable";
  if(p.issue!==issue || p.state!==state || (issue==="input_limit" && (p.included!==0 || p.exclusions.input_limit!==p.screened)) ||
    (issue==="arithmetic_overflow" && (p.included!==0 || p.exclusions.arithmetic_overflow!==p.screened)))return fail();
  return p;
}
