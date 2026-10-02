"use client";

import { useState } from "react";
import type {
  DecisionDistribution,
  DecisionIssue,
} from "@/lib/decision-distribution";
import MetaNote from "./MetaNote";

const reasons: Record<DecisionIssue, string> = {
  missing_buckets: "One or more decision buckets are missing or duplicated.",
  unsupported_buckets:
    "The venue's outcome set has changed and does not match this methodology.",
  rule_mismatch:
    "The buckets do not share the same supported resolution rules and close time.",
  invalid_quotes:
    "One or more YES books are unavailable, crossed, or wider than 10 percentage points.",
  old_quotes:
    "One or more venue update times are missing or older than 75 minutes.",
  price_sum: "The raw midpoints do not total between 95% and 105%.",
};
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const label = (s: string) =>
  s.replace("bps decrease", "bp cut").replace("bps increase", "bp hike");

export default function DecisionDistributionSection({
  distribution: d,
  status,
}: {
  distribution: DecisionDistribution | null;
  status: "hourly" | "delayed" | "stale";
}) {
  const [normalized, setNormalized] = useState(false);
  const stale = status === "stale";
  const eligible = !!d?.coherent && !stale;
  const showNormalized = normalized && eligible;
  const date = d
    ? new Date(`${d.meetingDate}T12:00:00Z`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <section
      id="fed-decision"
      aria-labelledby="fed-decision-title"
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Central banks
          </p>
          <h2
            id="fed-decision-title"
            className="mt-1 text-xl font-semibold tracking-tight"
          >
            {date ? `Fed meeting · ${date}` : "Next Fed decision"}
          </h2>
          {(!d || stale) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {stale
                ? "Last-known prices"
                : "No supported meeting in the current sample"}
            </p>
          )}
        </div>
        <MetaNote kind="method" title="How this decision outlook works">
          <p>
            Automatically selects the nearest upcoming Fed decision event in the
            sampled Polymarket feed. Other meetings, cumulative rate-change
            markets and other venues are not combined.
          </p>
          <p>
            The five buckets describe the change in the upper bound of the
            target federal funds rate under one shared rule set. Nonstandard
            changes are rounded up to the nearest 25 bp under the venue rules.
            The outer buckets have no finite upper bound, so no expected rate
            change is calculated.
          </p>
          <p>
            Raw bars show each YES bid/ask midpoint. Normalization divides each
            midpoint by the raw total only when the complete rule set is
            present, books are valid with spreads at most 10 pp, venue update
            times are within 75 minutes, and the total is 95–105%. These are
            eligibility rules, not a guarantee of forecast accuracy or
            executable prices.
          </p>
          {d?.issue && (
            <p>
              {reasons[d.issue]} Derived shares and normalization are withheld.
            </p>
          )}
          {stale && (
            <p>
              This snapshot is more than three hours old. Raw historical prices
              remain visible; derived shares and normalization are withheld.
            </p>
          )}
          <p>
            Methodology: fed-meeting-buckets-v1. Discovery runs during the
            existing hourly publication. The feed is sampled, so unavailable
            coverage does not establish that no such contracts exist.
          </p>
        </MetaNote>
      </div>
      {!d ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Decision prices unavailable for this snapshot.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground tabular-nums">
              Raw total{" "}
              <span className="font-semibold text-foreground">
                {d.rawSum === null ? "Unavailable" : percent(d.rawSum)}
              </span>{" "}
              · {d.buckets.filter((b) => b.midpoint !== null).length}/5 priced
            </div>
            {eligible ? (
              <div
                role="group"
                aria-label="Decision price display"
                className="inline-flex rounded-lg border border-border p-0.5 text-xs"
              >
                <button
                  type="button"
                  aria-pressed={!showNormalized}
                  onClick={() => setNormalized(false)}
                  className={`min-h-11 rounded-md px-3 ${!showNormalized ? "bg-muted font-medium" : "text-muted-foreground"}`}
                >
                  Raw
                </button>
                <button
                  type="button"
                  aria-pressed={showNormalized}
                  onClick={() => setNormalized(true)}
                  className={`min-h-11 rounded-md px-3 ${showNormalized ? "bg-muted font-medium" : "text-muted-foreground"}`}
                >
                  Normalized
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Normalization unavailable
              </span>
            )}
          </div>
          <div
            className="mt-4 space-y-3"
            aria-label={
              showNormalized
                ? "Normalized decision shares"
                : "Raw decision midpoints"
            }
          >
            {d.buckets.map((bucket) => {
              const value = showNormalized
                ? bucket.normalized
                : bucket.midpoint;
              return (
                <div key={bucket.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span>{label(bucket.label)}</span>
                    <span className="font-medium tabular-nums">
                      {value === null ? "Unavailable" : percent(value)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${(value ?? 0) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 sr-only">
                    {bucket.bid !== null && bucket.ask !== null
                      ? `YES bid ${percent(bucket.bid)} · ask ${percent(bucket.ask)}`
                      : "No usable two-sided YES quote"}
                  </p>
                </div>
              );
            })}
          </div>
          {showNormalized && d.directionShares && (
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center text-xs">
              {(["cut", "hold", "hike"] as const).map((direction) => (
                <div key={direction}>
                  <p className="capitalize text-muted-foreground">
                    {direction}
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {percent(d.directionShares![direction])}
                  </p>
                </div>
              ))}
            </div>
          )}
          {showNormalized && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Adjusted from a {percent(d.rawSum!)} raw total to 100%.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">{d.meetingDate}</span>
            <div className="flex items-center gap-2">
              <a
                href={d.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
              >
                View venue contracts ↗
              </a>
              <MetaNote kind="evidence" title="Resolution rules and provenance">
                <p>Captured {new Date(d.asOf).toLocaleString()}.</p>
                <p className="whitespace-pre-line">{d.rules}</p>
                <p>
                  Venue event {d.eventId}. Rules fingerprint{" "}
                  {d.rulesHash.slice(0, 12)}.
                </p>
                <p>Scheduled close {new Date(d.closesAt).toLocaleString()}.</p>
                {d.buckets.map((b) => (
                  <p key={b.label}>
                    {b.label} · YES bid{" "}
                    {b.bid === null ? "unavailable" : percent(b.bid)} · ask{" "}
                    {b.ask === null ? "unavailable" : percent(b.ask)} · contract{" "}
                    {b.marketId ?? "missing"} · venue updated{" "}
                    {b.venueUpdatedAt
                      ? new Date(b.venueUpdatedAt).toLocaleString()
                      : "unavailable"}
                  </p>
                ))}
              </MetaNote>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
