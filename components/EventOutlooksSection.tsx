"use client";
import { useState } from "react";
import Link from "next/link";
import type { Bootstrap } from "@/lib/bootstrap";
import type { EventOutlook, EventOutlooks } from "@/lib/event-outlooks";
import type { DecisionDistribution } from "@/lib/decision-distribution";
import { fedPresentation, fedSummary, FED_HREF } from "@/lib/nav";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import DecisionDistributionSection from "./DecisionDistributionSection";
import EvidencePopover from "./EvidencePopover";
import SectionHeader from "./SectionHeader";

type Status = "hourly" | "delayed" | "stale";
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
function ContractEvidence({
  item,
  contract,
}: {
  item: EventOutlook;
  contract: EventOutlook["contracts"][number];
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-foreground">{contract.question}</p>
      <p>
        YES bid {percent(contract.bid)} · ask {percent(contract.ask)}.
      </p>
      <p className="whitespace-pre-line">{contract.rulesExcerpt}</p>
      <p>
        Rules excerpt, up to 600 characters. Read full resolution rules at the
        venue.
      </p>
      <p>
        Contract {contract.id}. Fingerprint {contract.rulesHash}. Venue updated{" "}
        {new Date(contract.updatedAt).toLocaleString()}. Scheduled close{" "}
        {new Date(contract.closesAt).toLocaleString()}.
      </p>
      <a
        href={item.eventUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-primary"
      >
        Read full venue rules ↗
      </a>
    </div>
  );
}
function ContractOutlook({
  item,
  status,
  asOf,
}: {
  item: EventOutlook;
  status: Status;
  asOf: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contracts = expanded ? item.contracts : item.contracts.slice(0, 3);
  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
        {item.topic}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {item.title}
      </h3>
      {status === "stale" && (
        <p className="mt-2 text-xs text-rose-500">
          Last-known prices; current outlook unavailable.
        </p>
      )}
      <div className="mt-5 space-y-4">
        {contracts.map((contract) => (
          <div key={contract.id} className="group">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">{contract.label}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium tabular-nums">
                  {percent(contract.midpoint)}
                </span>
                <span className="evidence-row">
                  <EvidencePopover
                    title={`Evidence: ${contract.label}`}
                    className="evidence-hover opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <ContractEvidence item={item} contract={contract} />
                  </EvidencePopover>
                </span>
              </div>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${contract.midpoint * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {item.contracts.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-3 min-h-11 text-xs font-medium text-primary"
        >
          {expanded
            ? "Show fewer contracts"
            : `Show all ${item.contracts.length} contracts`}
        </button>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          24h volume ${Math.round(item.volume24h).toLocaleString()}
        </span>
        <a
          href={item.eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-primary"
        >
          View on venue ↗
        </a>
        <span className="evidence-card">
          <EvidencePopover title={`Evidence: ${item.title}`}>
            <p>
              Captured {new Date(asOf).toLocaleString()}.{" "}
              {item.contracts.length} selected / {item.activeContracts} active
              contracts.
            </p>
            {item.contracts.map((contract) => (
              <ContractEvidence
                key={contract.id}
                item={item}
                contract={contract}
              />
            ))}
          </EvidencePopover>
        </span>
      </div>
    </article>
  );
}
export default function EventOutlooksSection({
  outlooks,
  legacyDecision,
  status,
  bootstrap,
}: {
  outlooks: EventOutlooks | null;
  legacyDecision: DecisionDistribution | null;
  status: Status;
  bootstrap?: Bootstrap;
}) {
  const { data, now } = useBootstrap();
  const snapshot = bootstrap ?? data;
  const mode = fedPresentation(snapshot, now),
    summary = fedSummary(snapshot, now);
  const other =
    outlooks?.items.filter(
      (item) =>
        !item.decision &&
        item.eventId !== snapshot?.indexProducts?.outcomeBenchmark?.familyId &&
        item.eventId !== legacyDecision?.eventId,
    ) ?? [];
  return (
    <section id="event-outlooks" className="space-y-6">
      <SectionHeader id="outlooks" title="Event outlooks" />
      {mode === "summary" && summary ? (
        <Link
          href={FED_HREF}
          prefetch={false}
          className="flex min-h-20 flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5"
        >
          <div>
            <p className="text-sm font-medium">Fed policy balance</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.meeting}
            </p>
          </div>
          <p className="font-mono text-lg text-primary">
            {summary.outcome} {(summary.share * 100).toFixed(0)}% ·{" "}
            {summary.lean > 0 ? "+" : ""}
            {summary.lean.toFixed(1)}
          </p>
          <span aria-hidden="true">→</span>
        </Link>
      ) : mode === "fallback-card" ? (
        <DecisionDistributionSection
          distribution={snapshot?.decisionDistribution ?? null}
          status={status}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Current Fed reading unavailable in this snapshot.
        </p>
      )}
      {other.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {other.map((item) => (
            <ContractOutlook
              key={item.eventId}
              item={item}
              status={status}
              asOf={outlooks!.asOf}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No other qualifying event outlooks in this snapshot.
        </p>
      )}
    </section>
  );
}
