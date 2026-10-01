import { describe, expect, it } from "vitest";
import { buildIndexProducts } from "../thematic-basket";
import { basketMetrics } from "../theme-evidence";
import { fitIndexDigest, validateIndexProducts } from "../belief-shift";
import { themeEvents, THEME_T0 as T0, THEME_T1 as T1 } from "./fixtures/theme-events";
import type { GammaEvent } from "../types";
function paired(){const prior=buildIndexProducts(themeEvents([.1,.4,.7,.3,.5,.6]),null,null,T0);return buildIndexProducts(themeEvents(undefined,T1),prior,prior,T1);}
describe("Thematic basket admission and arithmetic",()=>{
  it("reproduces the three-component example, exact contributions and equal weights",()=>{
    const p=basketMetrics([.2,.4,.8],[1/3,1/3,1/3],[.1,.4,.7]);
    expect(p.headline).toBeCloseTo(46.6666666667);expect(p.priorLevel).toBeCloseTo(40);expect(p.change24h).toBeCloseTo(20/3);
    expect(p.contributions[0]).toBeCloseTo(10/3);expect(p.contributions[1]).toBe(0);expect(p.contributions[2]).toBeCloseTo(10/3);
    expect(p.contributions.reduce<number>((s,n)=>s+n!,0)).toBe(p.change24h);
    expect(()=>basketMetrics([.2,.4,.8],[.2,.3,.5])).toThrow();expect(()=>basketMetrics([.2,NaN,.8],[1/3,1/3,1/3])).toThrow();
  });
  it("admits the six explicit state definitions and shows current value before history exists",()=>{
    const d=buildIndexProducts(themeEvents(),null,null,T0),p=d.thematicBasket!;
    expect(p.state).toBe("available");expect(p.coverage).toEqual({expected:6,usable:6,comparable:0});expect(p.change24h).toBeNull();
    expect(p.components.every(c=>c.weight===1/6)).toBe(true);expect(validateIndexProducts(JSON.parse(JSON.stringify(d)),T0)).toEqual(d);
  });
  it("compares every exact pair and reproduces change as the sum of contributions",()=>{
    const d=paired(),p=d.thematicBasket!;expect(p.change24h).toBeCloseTo(10/3);expect(p.coverage.comparable).toBe(6);
    expect(p.headline!-p.priorLevel!).toBeCloseTo(p.change24h!);expect(validateIndexProducts(d,T1)).toEqual(d);
  });
  it("withholds current level without reweighting and retains missing saved identities",()=>{
    const previous=buildIndexProducts(themeEvents(),null,null,T0),events=themeEvents(undefined,T1);events.pop();
    const d=buildIndexProducts(events,previous,previous,T1),p=d.thematicBasket!;expect(p.headline).toBeNull();expect(p.change24h).toBeNull();
    expect(p.members.length).toBe(6);expect(p.components.every(c=>c.weight===1/6)).toBe(true);expect(p.coverage.usable).toBe(5);
    expect(validateIndexProducts(d,T1)).toEqual(d);
  });
  it("keeps current level but withholds change when only five prior quotes are valid",()=>{
    const events=themeEvents();events[0].markets![0].updatedAt="2026-09-30T00:00:00Z";
    const prior=buildIndexProducts(events,null,null,T0),d=buildIndexProducts(themeEvents(undefined,T1),prior,prior,T1);
    expect(d.thematicBasket!.headline).not.toBeNull();expect(d.thematicBasket!.change24h).toBeNull();expect(d.thematicBasket!.coverage.comparable).toBe(5);
  });
  it.each([
    ["rule",(e:GammaEvent[])=>{e[0].markets![0].description+=" Revised threshold.";}],
    ["deadline",(e:GammaEvent[])=>{e[0].markets![0].endDate="2027-07-01T03:59:00Z";}],
    ["creation window",(e:GammaEvent[])=>{e[0].markets![0].createdAt="2026-09-28T00:00:00Z";}],
    ["wrong jurisdiction",(e:GammaEvent[])=>{e[0].markets![0].question=e[1].markets![0].question;}],
    ["duplicate family",(e:GammaEvent[])=>{e.push(structuredClone(e[0]));}],
    ["crossed quote",(e:GammaEvent[])=>{e[0].markets![0].bestAsk=.01;}],
    ["resolved",(e:GammaEvent[])=>{e[0].markets![0].closed=true;}],
  ] as const)("rejects %s without substitution",(_name,mutate)=>{
    const events=themeEvents();mutate(events);const d=buildIndexProducts(events,null,null,T0);expect(d.thematicBasket!.headline).toBeNull();expect(d.thematicBasket!.coverage.usable).toBeLessThan(6);
  });
  it("breaks the version/history and excludes comparisons when a token mapping changes",()=>{
    const prior=buildIndexProducts(themeEvents(),null,null,T0),events=themeEvents(undefined,T1);events[0].markets![0].clobTokenIds='["99999","99998"]';
    const p=buildIndexProducts(events,prior,prior,T1).thematicBasket!;expect(p.headline).not.toBeNull();expect(p.change24h).toBeNull();expect(p.comparisonIssue).toBe("basket_changed");
    expect(p.history[0].segment).not.toBe(p.history[1].segment);
  });
  it("rejects modified weights, duplicate components, arithmetic, prior evidence and history",()=>{
    const good=paired();const mutations=[(d:typeof good)=>{d.thematicBasket!.components[0].weight=.5;},(d:typeof good)=>{d.thematicBasket!.components[0]=d.thematicBasket!.components[1];},
      (d:typeof good)=>{d.thematicBasket!.headline=NaN;},(d:typeof good)=>{d.thematicBasket!.contributions[0]=99;},(d:typeof good)=>{d.thematicBasket!.priorLevel=0;},
      (d:typeof good)=>{d.thematicBasket!.history.at(-1)!.segment="0000000000000000";},(d:typeof good)=>{d.observations.at(-1)!.prior!.midpoint=.99;}];
    for(const mutate of mutations){const bad=structuredClone(good);mutate(bad);expect(()=>validateIndexProducts(bad,T1)).toThrow();}
  });
  it("trims only optional history and fails a required-evidence overflow",()=>{
    const d=paired(),required=structuredClone(d);required.products.forEach(p=>p.history=p.history.slice(-1));required.outcomeBenchmark!.history=required.outcomeBenchmark!.history.slice(-1);required.thematicBasket!.history=required.thematicBasket!.history.slice(-1);
    const bytes=Buffer.byteLength(JSON.stringify(required));expect(fitIndexDigest(d,bytes).observations).toEqual(d.observations);expect(()=>fitIndexDigest(d,bytes-1)).toThrow("allocation");
  });
  it("cannot pair with a baseline outside the allowed capture window",()=>{
    const prior=buildIndexProducts(themeEvents(),null,null,T0),at="2026-10-02T12:10:08.043Z";
    const p=buildIndexProducts(themeEvents(undefined,at),prior,prior,at).thematicBasket!;expect(p.headline).not.toBeNull();expect(p.change24h).toBeNull();
  });
});
