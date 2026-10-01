import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProcessedMarket } from "../types";
const state=vi.hoisted(()=>({blobs:new Map<string,{text:string;etag:string}>(),gets:0,heads:0,puts:0,conflicts:0,mode:"none" as "none"|"tag"|"winner"|"repeat"|"head_mismatch"|"other",writeHeaders:[] as unknown[]}));
vi.mock("@vercel/blob",async()=>{
  const actual=await vi.importActual<typeof import("@vercel/blob")>("@vercel/blob");
  return {
    BlobPreconditionFailedError:actual.BlobPreconditionFailedError,
    get:async(path:string,options:{headers?:Record<string,string>})=>{
      state.gets++;const key=path.startsWith("https:")?new URL(path).pathname.slice(1):path,b=state.blobs.get(key);
      if(!b)return null;
      const etag=options.headers?.["Accept-Encoding"]==="identity"?b.etag:`W/${b.etag}`;
      if(key.endsWith("latest.json"))state.writeHeaders.push(options.headers);
      return {statusCode:200,blob:{size:Buffer.byteLength(b.text),etag},stream:new Response(b.text).body};
    },
    head:async(path:string)=>{state.heads++;const b=state.blobs.get(path)!;return {etag:state.mode==="head_mismatch"?'"different"':b.etag};},
    put:async(path:string,text:string,options:{ifMatch?:string;allowOverwrite?:boolean})=>{
      state.puts++;const old=state.blobs.get(path);
      if(path.endsWith("latest.json") && old && state.mode!=="none"){
        if(state.mode==="other")throw new Error("Access denied");
        if(state.conflicts===0 || state.mode==="repeat"){
          state.conflicts++;
          if(state.mode==="winner"){
            const body=JSON.parse(text),snap=state.blobs.get(new URL(body.currentUrl).pathname.slice(1))!;
            const winnerUrl=body.currentUrl.replace(/\/\d+\.json$/,"/winner.json");state.blobs.set(new URL(winnerUrl).pathname.slice(1),snap);
            state.blobs.set(path,{text:JSON.stringify({...body,currentUrl:winnerUrl}),etag:'"winner"'});
          }else state.blobs.set(path,{text:old.text,etag:'"refreshed"'});
          throw new actual.BlobPreconditionFailedError();
        }
      }
      if(old && options.ifMatch && options.ifMatch!==old.etag)throw new actual.BlobPreconditionFailedError();
      if(old && !options.allowOverwrite)throw new Error("Already exists");
      state.blobs.set(path,{text,etag:`"${Date.now()}-${state.puts}"`});return {url:`https://test.private.blob.vercel-storage.com/${path}`};
    },
  };
});
vi.mock("../research-acquisition",()=>({refreshTrackedContracts:async()=>({markets:[],attemptedIds:[]})}));
const market=(source:"polymarket"|"kalshi"):ProcessedMarket=>({source,id:source,question:"Will inflation rise?",eventTitle:"Inflation",eventSlug:"inflation",categoryslugs:["economics"],categories:["Economics"],image:"",currentPrice:50,oneDayChange:3,oneHourChange:0,oneWeekChange:0,oneMonthChange:0,volume24h:100000,volume1wk:700000,volume1mo:3000000,liquidity:100000,createdAt:"2026-01-01T00:00:00Z",endDate:"2026-12-31T00:00:00Z",outcomes:["Yes","No"],outcomePrices:[.5,.5],bestBid:.49,bestAsk:.51,spread:.02,clobTokenId:"",description:"Rules",resolutionSource:"Official",competitive:.5});
const sources={polymarkets:[market("polymarket")],kalshiMarkets:[market("kalshi")],manifoldMarkets:[],outlookEvents:[]};
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.restoreAllMocks();state.blobs.clear();state.gets=0;state.heads=0;state.puts=0;state.conflicts=0;state.mode="none";state.writeHeaders=[];});
async function setup(){vi.stubEnv("BLOB_READ_WRITE_TOKEN","test-token");vi.stubEnv("GITHUB_REF_NAME","fix/snapshot-manifest-etag");vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));vi.resetModules();const publisher=await import("../snapshot");await publisher.publishSnapshot(sources);vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));state.gets=0;state.heads=0;state.puts=0;state.writeHeaders=[];return publisher;}
describe("conditional manifest publication",()=>{
  it("uses the stored representation ETag and retains the normal operation budget",async()=>{
    const publisher=await setup(),network=vi.spyOn(globalThis,"fetch");const next=await publisher.publishSnapshot(sources);
    expect(next.generatedAt).toBe("2026-10-02T12:00:00.000Z");expect(state.writeHeaders[0]).toEqual({"Accept-Encoding":"identity"});expect(state.puts).toBe(2);expect(state.gets).toBe(5);expect(state.heads).toBe(0);expect(network).not.toHaveBeenCalled();
  });
  it("recovers a changed tag once without acquiring or uploading another generation",async()=>{
    const publisher=await setup(),network=vi.spyOn(globalThis,"fetch");state.mode="tag";const next=await publisher.publishSnapshot(sources);
    expect(next.generatedAt).toBe("2026-10-02T12:00:00.000Z");expect(state.heads).toBe(1);expect(state.puts).toBe(3);expect(state.gets).toBe(6);expect(network).not.toHaveBeenCalled();
    expect([...state.blobs.keys()].filter(x=>x.includes("generations/"))).toHaveLength(2);expect(await publisher.loadPublishedSnapshot()).toEqual(next);
  });
  it("retains a competing committed capture without overwriting its pointer or archive",async()=>{
    const publisher=await setup();state.mode="winner";const log=vi.spyOn(console,"info").mockImplementation(()=>{});const next=await publisher.publishSnapshot(sources);
    const pointer=JSON.parse([...state.blobs.entries()].find(([key])=>key.endsWith("latest.json"))![1].text);expect(pointer.currentUrl).toContain("winner.json");expect(state.puts).toBe(2);expect(state.heads).toBe(1);expect(log).toHaveBeenCalledWith(expect.stringContaining("another publication"),expect.anything());expect(await publisher.loadPublishedSnapshot()).toEqual(next);
  });
  it.each(["repeat","head_mismatch","other"] as const)("fails closed for %s instead of removing the conditional guard",async(mode)=>{
    const publisher=await setup();const old=[...state.blobs.entries()].find(([key])=>key.endsWith("latest.json"))![1].text;state.mode=mode;
    await expect(publisher.publishSnapshot(sources)).rejects.toThrow();expect([...state.blobs.entries()].find(([key])=>key.endsWith("latest.json"))![1].text).toBe(old);expect(state.puts).toBeLessThanOrEqual(3);expect(state.heads).toBe(mode==="other"?0:1);
  });
});
