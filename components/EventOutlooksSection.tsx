"use client";

import Link from "next/link";
import { useState } from "react";
import type { EventOutlook, EventOutlooks } from "@/lib/event-outlooks";
import type { DecisionDistribution } from "@/lib/decision-distribution";
import DecisionDistributionSection from "./DecisionDistributionSection";
import MetaNote from "./MetaNote";

type Status = "hourly" | "delayed" | "stale";
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ContractOutlook({ item, status }: { item: EventOutlook; status: Status }) {
  const [expanded, setExpanded] = useState(false);
  const contracts = expanded ? item.contracts : item.contracts.slice(0, 3);
  return <article className="my-5 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{item.topic}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">{item.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Polymarket · YES bid/ask midpoints{status === "stale" ? " · Last-known prices" : ""}</p>
      </div>
      <MetaNote kind="method" title="How to read these contract prices">
        <p>Each row prices YES to its own contract question. Different candidates, thresholds and deadlines may overlap or leave outcomes uncovered. No total, normalized shares or expected outcome is calculated for this unverified set.</p>
        <p>Shows up to six valid contracts ranked by midpoint, not a complete candidate list. A quote must be two-sided, uncrossed, no wider than 10 percentage points, updated within 75 minutes of publication and close within 90 days. A venue update time does not guarantee a recent trade.</p>
        {status === "stale" && <p>This snapshot is more than three hours old. These are historical prices, not current opportunities.</p>}
      </MetaNote>
    </div>
    <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
      <span>{item.contracts.length} selected / {item.activeContracts} active contracts</span>
      <span>Earliest selected close {date(item.closesAt)}</span>
    </div>
    <div className="mt-4 space-y-4">
      {contracts.map((contract) => <div key={contract.id}>
        <div className="mb-1 flex items-start justify-between gap-3 text-sm">
          <span className="min-w-0 break-words">{contract.label}</span>
          <span className="shrink-0 font-medium tabular-nums">{percent(contract.midpoint)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary/80" style={{ width: `${contract.midpoint * 100}%` }} /></div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="tabular-nums">YES bid {percent(contract.bid)} · ask {percent(contract.ask)}</span>
          <MetaNote kind="evidence" title="Contract question and rules">
            <p>{contract.question}</p><p>{contract.rulesExcerpt}</p><p>Rules excerpt, up to 600 characters. Read the complete resolution rules at the venue before interpreting the price.</p>
            <p>Contract {contract.id}. Rules fingerprint {contract.rulesHash.slice(0, 12)}. Venue updated {new Date(contract.updatedAt).toLocaleString()}. Scheduled close {new Date(contract.closesAt).toLocaleString()}.</p>
            <a href={item.eventUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Read full venue rules ↗</a>
          </MetaNote>
        </div>
      </div>)}
    </div>
    {item.contracts.length > 3 && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-3 min-h-10 text-xs font-medium text-primary">{expanded ? "Show fewer contracts" : `Show all ${item.contracts.length} selected contracts`}</button>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
      <span className="text-muted-foreground">24h volume ${Math.round(item.volume24h).toLocaleString()}</span>
      <a href={item.eventUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">View venue contracts ↗</a>
    </div>
  </article>;
}

export default function EventOutlooksSection({ outlooks, legacyDecision, status }: {
  outlooks: EventOutlooks | null; legacyDecision: DecisionDistribution | null; status: Status;
}) {
  return <section id="event-outlooks" aria-labelledby="event-outlooks-title" className="my-6">
    <div className="flex items-center justify-between gap-3">
      <div><h2 id="event-outlooks-title" className="text-xl font-semibold tracking-tight">Event outlooks</h2><Link href="/research" className="mt-1 inline-block text-xs text-primary hover:underline">Evidence & history →</Link></div>
      <MetaNote kind="method" title="How events are selected">
        <p>Automatically screens the existing sampled Polymarket feed for central-bank decisions, elections, economic releases and policy or geopolitical deadlines. Requires at least $10,000 of venue-reported 24h volume and a future close within 90 days.</p>
        <p>Ranks qualifying events by activity, then earliest close, with one event per topic and at most three cards. This is a transparent discovery heuristic, not an objective ranking of importance or a comprehensive calendar. Events outside the sample or without usable quotes may be absent.</p>
        <p>Only the explicit Fed meeting adapter verifies a complete outcome partition and enables normalization. Other topics show raw prices for individual contracts. Venue close times are deadlines, not verified event dates. Different venues are never pooled.</p>
        <p>Computed during the existing hourly snapshot publication, with no additional vendor requests or browser polling. Methodology: event-outlooks-v1. {outlooks ? `${outlooks.screened} sampled events screened.` : "Waiting for the updated publisher."}</p>
      </MetaNote>
    </div>
    {outlooks?.items.length ? outlooks.items.map((item) => item.decision ?
      <DecisionDistributionSection key={item.eventId} distribution={item.decision} status={status} /> :
      <ContractOutlook key={item.eventId} item={item} status={status} />) : legacyDecision ?
      <DecisionDistributionSection distribution={legacyDecision} status={status} /> :
      <p className="mt-3 text-sm text-muted-foreground">No qualifying event outlooks in this snapshot.</p>}
  </section>;
}
