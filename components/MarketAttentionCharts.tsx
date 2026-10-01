"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { ATTENTION_COLOURS, ATTENTION_LABELS, leadingAttentionCategory, type AttentionCategory, type MarketAttention } from "@/lib/attention-model";
import { attentionTiles } from "@/lib/attention-layout";
import MetaNote from "./MetaNote";

const compactMoney=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1});
const exactMoney=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
const money=(n:number)=>compactMoney.format(n);
const share=(n:number)=>`${(n*100).toFixed(1)}%`;
const sourceUrl=(slug:string)=>`https://polymarket.com/event/${slug}`;
const emptyReading=(p:MarketAttention)=>p.state==="empty" ? "No reported activity in this capture" : p.issue==="input_limit" ? "Sample exceeds the supported limit" : p.issue==="arithmetic_overflow" ? "Activity totals could not be validated" : "Awaiting eligible activity";

function AttentionMap({product,selected,onSelect,compact=false}:{product:MarketAttention;compact?:boolean;selected?:AttentionCategory;onSelect?:(key:AttentionCategory)=>void}){
  const height=compact ? 200 : 320;
  const tiles=useMemo(()=>attentionTiles(product.categories,600,height),[product.categories,height]);
  return <svg viewBox={`0 0 600 ${height}`} style={{aspectRatio:`600/${height}`}} className="block w-full overflow-hidden rounded-xl" role={onSelect ? "group" : "img"} aria-label="Category area represents share of reported 24-hour volume">
    {tiles.map(({group:c,x,y,width,height})=>{
      const name=`${ATTENTION_LABELS[c.key]}, ${share(c.share)} of captured volume`;
      const choose=()=>onSelect?.(c.key);
      return <g key={c.key} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? name : undefined} aria-pressed={onSelect ? selected===c.key : undefined}
        onClick={onSelect ? choose : undefined} onKeyDown={onSelect ? e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}} : undefined}
        className={onSelect ? "cursor-pointer focus:outline focus:outline-2 focus:outline-primary" : undefined}>
        <title>{name}</title><rect x={x} y={y} width={width} height={height} fill={ATTENTION_COLOURS[c.key]} fillOpacity={selected && selected!==c.key ? .4 : .85} className="stroke-card" strokeWidth="3" />
        {width>=125 && height>=65 && <text x={x+14} y={y+30} fill="#08101a" fontSize="20" fontWeight="600" pointerEvents="none">{ATTENTION_LABELS[c.key]}</text>}
        {width>=90 && height>=96 && <text x={x+14} y={y+60} fill="#08101a" fontSize="25" fontFamily="monospace" pointerEvents="none">{share(c.share)}</text>}
      </g>;
    })}
  </svg>;
}
export function AttentionSummary({product}:{product:MarketAttention}){
  const leader=leadingAttentionCategory(product);
  return <>
    <div className="mt-5 flex flex-wrap items-baseline gap-x-2"><span className="font-mono text-4xl font-medium tracking-tight">{product.state==="available" ? share(leader.share) : "—"}</span>
      {product.state==="available" && <span className="text-sm font-medium">{ATTENTION_LABELS[leader.key]}</span>}</div>
    <p className="mt-1 text-xs text-muted-foreground">{product.state==="available" ? "Share of reported 24h volume" : emptyReading(product)}</p>
    <div className="mt-5">{product.state==="available" ? <AttentionMap product={product} compact /> : <div className="flex aspect-[15/8] items-center justify-center rounded-xl bg-muted/30 px-5 text-center text-xs text-muted-foreground">A valid positive total will populate the map.</div>}</div>
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground">{product.categories.map(c=><span key={c.key} className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{background:ATTENTION_COLOURS[c.key]}} /><span className="truncate">{ATTENTION_LABELS[c.key]}</span><span className="ml-auto font-mono">{share(c.share)}</span></span>)}</div>
    <p className="mt-4 text-[10px] text-muted-foreground">Polymarket · captured event sample · {product.included} events</p>
  </>;
}
export function AttentionDetail({product}:{product:MarketAttention}){
  const [selected,setSelected]=useState<AttentionCategory>(leadingAttentionCategory(product).key);
  const group=product.categories.find(c=>c.key===selected)!;
  const largest=group.sources[0]?.volume ?? 0;
  return <>
    <div className="mt-6 grid gap-7 lg:grid-cols-2">
      <div>{product.state==="available" ? <AttentionMap product={product} selected={selected} onSelect={setSelected} /> : <p className="rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground" role="status">{emptyReading(product)}</p>}
        <div className="mt-3 grid grid-cols-1 gap-1 min-[320px]:grid-cols-2" aria-label="Attention categories">{product.categories.map(c=><button key={c.key} type="button" aria-pressed={selected===c.key} onClick={()=>setSelected(c.key)} aria-label={`Select ${ATTENTION_LABELS[c.key]}, ${share(c.share)}`}
          className={`flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected===c.key ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{background:ATTENTION_COLOURS[c.key]}} /><span>{ATTENTION_LABELS[c.key]}</span><span className="ml-auto font-mono">{share(c.share)}</span></button>)}</div>
        <div className="mt-2 flex items-center justify-between gap-2 [&_button]:min-h-11 [&_button]:min-w-11"><p className="text-[11px] text-muted-foreground">Area shows activity share. Colour identifies category.</p><MetaNote kind="method" title="Map scale and rounding"><p>Rectangle areas use unrounded shares before separators. Small categories remain available in the legend. Rounded percentages may not total exactly 100%.</p><p>Stable category colours carry no probability or bullish/bearish interpretation.</p></MetaNote></div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{ATTENTION_LABELS[group.key]} · captured activity</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3"><h4 className="font-mono text-3xl font-medium tracking-tight">{share(group.share)}</h4><span className="text-sm text-muted-foreground">{money(group.volume)} reported volume</span></div>
        <p className="mt-2 text-xs text-muted-foreground">{group.count} included events · {group.sources.length} leading source examples</p>
        <ul className="mt-5 space-y-5">{group.sources.map(row=><li key={row.id}><a href={sourceUrl(row.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm leading-relaxed hover:text-primary"><span className="break-words">{row.title}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a>
          <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground"><span>Reported 24h volume</span><span className="font-mono">{money(row.volume)}</span></div><div className="mt-2 h-1.5 rounded-full bg-muted-foreground/10"><div className="h-full rounded-full" style={{width:`${largest>0 ? row.volume/largest*100 : 0}%`,background:ATTENTION_COLOURS[group.key]}} /></div></li>)}</ul>
        {group.sources.length>0 ? <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Bars compare these examples with the largest shown event. The category total includes all {group.count} events.</p> : <p className="mt-4 text-xs text-muted-foreground">{group.count ? "Source examples are unavailable for this category." : "No events in this category were included in this capture."}</p>}
      </div>
    </div>
    <details className="mt-6 border-t border-border text-xs"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Source scope and methodology</summary>
      <div className="space-y-3 leading-relaxed text-muted-foreground"><p>Polymarket · captured event sample. {product.included} of {product.screened} received events included. Total venue-reported rolling 24h volume {exactMoney.format(product.totalVolume)}.</p>
        <p>The feed is capped at 500 active events ordered by reported activity. Coverage completeness is not established; events outside this capture are not represented. Volume does not measure people, conviction or probability.</p>
        <p>Each event counts once. Exact-tag precedence: Sports, Weather, Crypto, Economics, Technology, Politics, Other. Unknown tags use Other. Events renew at publication; no historical comparison is shown.</p>
        <p>{Object.entries(product.exclusions).map(([key,n])=>`${n} ${key.replaceAll("_"," ")}`).join(" · ") || "No eligibility exclusions"}. {product.tagFallbacks} malformed tag sets assigned Other; {product.sourceUnavailable} events lack safe source metadata.</p>
        <p>Method {product.methodology}; classifier {product.classifier}. Downloads contain source examples, not all constituents; examples cannot reproduce the full denominator.</p>
        <dl className="space-y-2">{product.categories.map(c=><div key={c.key} className="flex flex-wrap justify-between gap-2"><dt>{ATTENTION_LABELS[c.key]} · {c.count} events</dt><dd className="font-mono">{share(c.share)} · {exactMoney.format(c.volume)}</dd></div>)}</dl>
      </div>
    </details>
  </>;
}
