import { describe, expect, it } from "vitest";
import { buildMarketAttention, attentionCategory, validateMarketAttention } from "../attention-evidence";
import { attentionTiles } from "../attention-layout";
import { leadingAttentionCategory } from "../attention-model";
import type { GammaEvent } from "../types";
const AT="2026-10-01T16:00:00.000Z";
const event=(id:string,volume=100,tags:string[]=["politics"]):GammaEvent=>({id,volume24hr:volume,tags:tags.map(slug=>({slug})),slug:`event-${id}`,title:`Event ${id}`,active:true,closed:false,archived:false} as GammaEvent);

describe("bounded, renewing market attention",()=>{
  it("partitions event activity once without summing underlying contracts",()=>{
    const a={...event("a",300,["economics"]),markets:[{volume24hr:999999},{volume24hr:999999}]} as GammaEvent;
    const p=buildMarketAttention([a,event("b",100),event("c",0,["weather"])],AT);
    expect(p.totalVolume).toBe(400);expect(p.included).toBe(3);expect(p.state).toBe("available");
    expect(p.categories.find(c=>c.key==="economics")?.share).toBe(.75);expect(p.categories.find(c=>c.key==="weather")?.count).toBe(1);
  });
  it.each([[['politics','sports'],'sports'],[['politics','finance'],'economics'],[['ai','crypto'],'crypto'],[['weather','sports'],'sports'],[['not-a-category'],'other']])("uses declared exact precedence for %j",(tags,key)=>{expect(attentionCategory(tags.map(slug=>({slug}))).key).toBe(key);});
  it("does not classify titles and falls back safely for malformed or oversized tags",()=>{
    expect(buildMarketAttention([{...event("a",100,[]),title:"Bitcoin and politics"}],AT).categories.at(-1)?.volume).toBe(100);
    for(const tags of [{},Array(65).fill({slug:"sports"}),[{slug:5}]])expect(attentionCategory(tags)).toEqual({key:"other",fallback:true});
    expect(attentionCategory([{slug:"POLITICS"}])).toEqual({key:"politics",fallback:false});
  });
  it("excludes every duplicate and rejects inactive and malformed numeric volume",()=>{
    const input=[event("a"),event("a",300),{...event("b"),closed:true},event("c",-1),event("d",NaN),event("e",Infinity),{...event("f"),volume24hr:"20"},event("g")];
    const p=buildMarketAttention(input as GammaEvent[],AT);expect(p.totalVolume).toBe(100);expect(p.exclusions).toEqual({duplicate_id:2,inactive:1,invalid_volume:4});
  });
  it("requires a bounded nonempty identity and a positive denominator for area",()=>{
    const p=buildMarketAttention([event(""),event("x".repeat(65)),event("a",0)],AT);expect(p.state).toBe("empty");expect(p.included).toBe(1);expect(attentionTiles(p.categories)).toEqual([]);
    expect(buildMarketAttention([],AT).issue).toBe("no_eligible_events");
  });
  it("bounds input without selecting an arbitrary truncated sample",()=>{const p=buildMarketAttention(Array.from({length:501},(_,i)=>event(String(i))),AT);expect(p.issue).toBe("input_limit");expect(p.included).toBe(0);expect(p.exclusions.input_limit).toBe(501);});
  it("withholds overflow totals instead of drawing invalid geometry",()=>{const p=buildMarketAttention([event("a",Number.MAX_VALUE),event("b",Number.MAX_VALUE)],AT);expect(p.issue).toBe("arithmetic_overflow");expect(p.totalVolume).toBe(0);});
  it("keeps volume when source metadata is unsafe",()=>{
    const p=buildMarketAttention([{...event("a"),slug:"https://malicious.test"},{...event("b"),title:""}],AT);expect(p.totalVolume).toBe(200);expect(p.sourceUnavailable).toBe(2);expect(p.categories.find(c=>c.key==="politics")?.sources).toEqual([]);
  });
  it("keeps the true leading rows deterministically and clamps Unicode display titles",()=>{
    const input=[event("d",200),event("b",200),event("c",200),{...event("a",300),title:"界".repeat(100)}];
    const p=buildMarketAttention(input,AT),rows=p.categories.find(c=>c.key==="politics")!.sources;
    expect(rows.map(r=>r.id)).toEqual(["a","b","c"]);expect(Buffer.byteLength(rows[0].title)).toBeLessThanOrEqual(96);expect(rows[0].title.endsWith("…")).toBe(true);
    expect(p).toEqual(buildMarketAttention([...input].reverse(),AT));
  });
  it("prunes optional examples to 4 KB without altering any category aggregate",()=>{
    const tags=["sports","weather","crypto","economics","tech","politics","unknown"];
    const input=tags.flatMap((tag,c)=>Array.from({length:3},(_,i)=>({...event(`${c}-${i}`,300-i,[tag]),title:"a".repeat(200),slug:`event-${c}-${i}-`+"a".repeat(110)})));
    const p=buildMarketAttention(input,AT);expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThanOrEqual(4000);expect(p.included).toBe(21);
    expect(p.categories.every(c=>c.count===3 && c.volume===897 && c.sources.length>=1)).toBe(true);expect(p.categories.reduce((s,c)=>s+c.sources.length,0)).toBeLessThan(21);
  });
  it("renews headlines, identities and dominant category on every capture without a registry",()=>{
    const first=buildMarketAttention([event("old",900,["economics"]),event("a",100,["sports"])],AT);
    const second=buildMarketAttention([{...event("old",900,["economics"]),closed:true},event("new",1000,["sports"])],"2026-11-01T16:00:00.000Z");
    expect(leadingAttentionCategory(first).key).toBe("economics");expect(leadingAttentionCategory(second).key).toBe("sports");expect(second.included).toBe(1);expect(JSON.stringify(second)).not.toContain('"old"');expect(second).not.toHaveProperty("history");
  });
  it("validates saved totals, shares, ordering, row identity and version independently",()=>{
    const p=buildMarketAttention([event("a",300),event("b",100)],AT);
    const tamper=[(x:typeof p)=>{x.totalVolume=999},(x:typeof p)=>{x.categories[5].share=.2},(x:typeof p)=>{x.included=3},(x:typeof p)=>{x.categories[5].sources.reverse()},(x:typeof p)=>{x.categories[5].sources[1].id="a"},(x:typeof p)=>{x.classifier="bad" as never},(x:typeof p)=>{x.categories[5].sources[0].volume=500}];
    for(const change of tamper){const bad=structuredClone(p);change(bad);expect(()=>validateMarketAttention(bad,AT)).toThrow();}
  });
  it("preserves exact rectangle area without overlap or invented minimum sizes",()=>{
    const p=buildMarketAttention([event("a",900,["politics"]),event("b",99,["economics"]),event("c",1,["weather"])],AT);
    const tiles=attentionTiles(p.categories);expect(tiles.length).toBe(3);expect(tiles.reduce((s,t)=>s+t.width*t.height,0)).toBeCloseTo(600*320);
    for(const t of tiles){expect(t.width*t.height/(600*320)).toBeCloseTo(t.group.share,12);expect(t.x+t.width).toBeLessThanOrEqual(600.000001);expect(t.y+t.height).toBeLessThanOrEqual(320.000001);}
    for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){const a=tiles[i],b=tiles[j];expect(Math.min(a.x+a.width,b.x+b.width)<=Math.max(a.x,b.x)+1e-9 || Math.min(a.y+a.height,b.y+b.height)<=Math.max(a.y,b.y)+1e-9).toBe(true);}
  });
});
