"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, ChevronRight, X } from "lucide-react";
import { indexFreshness, indexSourceUrl, observationMove, type BeliefShiftProduct, type IndexProductsDigest } from "@/lib/index-products";
import { MovementScale, ProbabilityPair, ShiftHistory } from "./BeliefShiftCharts";
import MetaNote from "./MetaNote";

const reasons = { insufficient_events: "Awaiting eligible events", insufficient_quotes: "Quote coverage limited",
  capturing_baseline: "Capturing 24h baseline", insufficient_pairs: "Comparison coverage limited" };
function reading(product: BeliefShiftProduct, stale: boolean) {
  if (product.reason) return `${reasons[product.reason]}${stale ? " · last capture" : ""}`;
  return stale ? "Last capture" : "Average 24h move";
}

export default function IndicesSection({ digest, full = false, loading = false }: {
  digest: IndexProductsDigest | null; full?: boolean; loading?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const detail = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);
  const selected = digest?.products.find((p) => p.id === selectedId);
  const freshness = digest ? indexFreshness(digest.asOf) : "stale";
  const stale = freshness === "stale";
  const products = digest?.products.slice(0, full ? 4 : 3) ?? [];
  useEffect(() => {
    if (!full) return;
    const restore = (event?: PopStateEvent) => {
      const id = new URLSearchParams(window.location.search).get("index");
      const previousId = detail.current?.id.replace(/^detail-/, "");
      focusOnOpen.current = !!event && !!id;
      setSelectedId(id);
      if (!id && previousId) buttons.current.get(previousId)?.focus();
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [full]);
  useEffect(() => {
    if (selected && focusOnOpen.current) { detail.current?.focus(); focusOnOpen.current = false; }
  }, [selected]);
  function choose(id: string | null) {
    const previousId = selectedId;
    setSelectedId(id); focusOnOpen.current = id !== null;
    if (full) {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("index", id); else url.searchParams.delete("index");
      window.history.pushState(window.history.state, "", url);
    }
    if (!id && previousId) buttons.current.get(previousId)?.focus();
  }
  const rows = selected && digest ? selected.members.map((id) => digest.observations.find((r) => r.marketId === id)!) : [];
  const ranked = [...rows].sort((a, b) => (observationMove(b) === null ? -1 : Math.abs(observationMove(b)!)) -
    (observationMove(a) === null ? -1 : Math.abs(observationMove(a)!)) || a.marketId.localeCompare(b.marketId));
  const moves = ranked.filter((r) => observationMove(r) !== null).slice(0, 5);
  function downloadEvidence() {
    if (!digest || !selected) return;
    const blob = new Blob([JSON.stringify({ ...digest, products: [selected], observations: rows, fullRulesEmbedded: false }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `${selected.id}-${digest.asOf.slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <section id="indices" aria-labelledby="indices-heading" className={full ? "space-y-5" : "my-6 space-y-3"}>
    <div className="flex items-center justify-between gap-3">
      <div><h2 id="indices-heading" className={full ? "text-xl font-semibold tracking-tight" : "text-sm font-semibold tracking-tight"}>{full ? "Belief Shift" : "Indices"}</h2>
        {full && <p className="mt-1 text-sm text-muted-foreground">Where sampled expectations moved over 24 hours.</p>}</div>
      <div className="flex items-center gap-1 [&_button]:min-h-11 [&_button]:min-w-11">
        {!full && <Link href="/pulse" prefetch={false} className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Explore <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        <MetaNote kind="method" title="How Belief Shift works">
          <p>The equal-weight average absolute change in YES midpoints, in percentage points. A 40% to 43% quote is a 3 pp move.</p>
          <p>One pinned contract per venue event, up to eight near-term events per category. At least five comparable events and 80% coverage are required. The sample is selected by activity, not representative of the whole venue.</p>
          <p>No bullish/bearish interpretation. Source-record updates are not timestamps of the last trade. Missing evidence is unavailable, not zero.</p>
        </MetaNote>
      </div>
    </div>
    {digest && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>Polymarket · near-term sample</span><span>{freshness === "recent" ? "Captured" : freshness === "delayed" ? "Update delayed · captured" : "Historical capture"} {new Date(digest.asOf).toLocaleString()}</span>
    </div>}
    {loading && <div role="status" className="grid gap-3 sm:grid-cols-2">{[0, 1].map((n) => <div key={n} className="h-60 rounded-2xl border border-border bg-muted/30 motion-safe:animate-pulse" />)}<span className="sr-only">Loading saved indices</span></div>}
    {!loading && !products.length && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground" role="status">Belief Shift begins with its first saved publication. No comparable index evidence is available in this generation.</div>}
    <div className={`grid gap-3 sm:grid-cols-2 ${products.length > 2 ? "xl:grid-cols-3" : ""}`}>
      {products.map((p) => {
        const sample = p.members.map((id) => digest!.observations.find((r) => r.marketId === id)!).filter((r) => r.quote).slice(0, 3);
        return <button key={p.id} type="button" ref={(node) => { if (node) buttons.current.set(p.id, node); else buttons.current.delete(p.id); }}
          aria-expanded={p.id === selectedId} aria-controls={`detail-${p.id}`} onClick={() => choose(p.id === selectedId ? null : p.id)}
          className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-card p-5 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${p.id === selectedId ? "border-primary/60" : "border-border hover:border-primary/40"}`}>
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">{p.name}</span><ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none ${p.id === selectedId ? "rotate-90" : "group-hover:translate-x-0.5"}`} /></div>
          <div className="mt-5 flex items-baseline gap-2"><span className={`font-mono text-4xl font-medium tracking-tight ${stale ? "text-muted-foreground" : "text-foreground"}`}>{p.headline === null ? "—" : p.headline.toFixed(1)}</span><span className="text-xs text-muted-foreground">pp</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{reading(p, stale)}</p>
          <div className="mt-5"><MovementScale value={p.headline} /></div>
          {p.headline === null && sample.length > 0 && <div className="mt-4 border-t border-border/60 pt-3"><div className="mb-1 text-[10px] text-muted-foreground">Captured YES probabilities</div>{sample.map((r) => <ProbabilityPair key={r.marketId} row={r} compact />)}</div>}
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"><span>{p.coverage.comparable}/{p.coverage.admitted} comparable events</span>
            {p.breadth !== null && <span>{Math.round(p.breadth * 100)}% moved ≥3 pp</span>}</div>
        </button>;
      })}
    </div>
    {selected && digest && <div id={`detail-${selected.id}`} ref={detail} tabIndex={-1} role="region" aria-label={`${selected.name} index detail`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); choose(null); } }}
      className="rounded-2xl border border-primary/25 bg-card p-5 outline-none sm:p-7">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Belief Shift · {selected.name}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">{selected.headline === null ? reading(selected, stale) : `${selected.headline.toFixed(1)} pp average movement`}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{selected.coverage.comparable} comparable of {selected.coverage.admitted} pinned events · {stale ? "Historical capture" : "Saved quotes"}</p></div>
        <button type="button" onClick={() => choose(null)} aria-label="Close index detail" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X className="h-4 w-4" /></button></div>
      <div className="mt-6 grid gap-7 lg:grid-cols-2">
        <div><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-semibold">Average 24h move · saved trend</h4><span className="text-[10px] text-muted-foreground">Actual captures</span></div><ShiftHistory product={selected} />
          {selected.breadth !== null && <div className="mt-4 rounded-xl bg-muted/40 p-4"><div className="flex justify-between text-xs"><span>Events moving at least 3 pp</span><span className="font-mono">{Math.round(selected.breadth * 100)}%</span></div><div className="mt-3 h-1.5 rounded-full bg-muted-foreground/15"><div className="h-full rounded-full bg-primary" style={{ width: `${selected.breadth * 100}%` }} /></div></div>}
        </div>
        <div><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold">{moves.length ? "Largest underlying moves" : "Captured contract probabilities"}</h4><span className="text-[10px] text-muted-foreground">{moves.length ? "○ Previous   ● Captured" : "● Captured"}</span></div>
          <div className="space-y-5">{(moves.length ? moves : rows.filter((r) => r.quote).slice(0, 5)).map((row) => <ProbabilityPair key={row.marketId} row={row} />)}</div>
          {!rows.some((r) => r.quote) && <p className="text-xs text-muted-foreground">A category needs five eligible events to form its first cohort.</p>}
        </div>
      </div>
      <details className="mt-6 border-t border-border pt-2 text-xs"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Underlying observations and coverage</summary>
        <p className="mb-3 text-muted-foreground">Weekly cohort {selected.epoch}. {selected.coverage.usable}/{selected.coverage.admitted} usable current quotes. {digest.baselineAt ? `Comparison capture ${new Date(digest.baselineAt).toLocaleString()}.` : "An exact saved 24-hour baseline has not yet been captured."}</p>
        <ul className="divide-y divide-border">{rows.map((r) => <li key={r.marketId} className="py-3"><a href={indexSourceUrl(r)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 leading-relaxed hover:text-primary">{r.question}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground"><span>{r.quote ? `YES bid ${(r.quote.bid * 100).toFixed(1)}% · ask ${(r.quote.ask * 100).toFixed(1)}%` : `Quote unavailable: ${r.issue}`}</span>
            {r.quote && <span>Record updated {new Date(r.quote.updatedAt).toLocaleString()}</span>}
            {r.comparisonIssue && <span>Comparison: {r.comparisonIssue.replaceAll("_", " ")}</span>}</div></li>)}</ul>
      </details>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 [&_button]:min-h-11 [&_button]:min-w-11"><div className="flex items-center gap-1">
        <button type="button" onClick={downloadEvidence} className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowDownToLine className="h-3.5 w-3.5" />Download evidence</button>
        <MetaNote kind="evidence" title="Index evidence"><p>Saved current and prior bid/ask midpoints reproduce this reading. Rules fingerprints detect revisions; full source rules are not embedded in this download.</p><p>Cohort and comparable-sample changes break the trend. No historical Pulse score is converted into Belief Shift.</p></MetaNote></div>
        {!full && <Link href={`/pulse?index=${selected.id}`} prefetch={false} className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Open index page<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
      </div>
    </div>}
  </section>;
}
