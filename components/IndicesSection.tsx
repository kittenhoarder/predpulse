"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine, ArrowUpRight, ChevronRight, X } from "lucide-react";
import {
  indexFreshness,
  indexSourceUrl,
  observationMove,
  type BeliefShiftProduct,
  type IndexProductsDigest,
} from "@/lib/index-products";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  MovementScale,
  ProbabilityPair,
  ShiftHistory,
} from "./BeliefShiftCharts";
import {
  DirectionShares,
  OutcomeHistory,
  PolicyBalance,
} from "./OutcomeBenchmarkCharts";
import { AttentionDetail, AttentionSummary } from "./MarketAttentionCharts";
import { GuideButton } from "./GuidePanel";
import EvidencePopover from "./EvidencePopover";
import { useSheets } from "./SheetProvider";
import Sheet from "./ui/sheet";
import SectionHeader from "./SectionHeader";
const reasons = {
  insufficient_events: "Awaiting eligible events",
  insufficient_quotes: "Quote coverage limited",
  capturing_baseline: "Capturing 24h baseline",
  insufficient_pairs: "Comparison coverage limited",
};
function reading(p: BeliefShiftProduct) {
  return p.reason ? reasons[p.reason] : "";
}

export default function IndicesSection({
  digest,
  full = false,
  loading = false,
}: {
  digest: IndexProductsDigest | null;
  full?: boolean;
  loading?: boolean;
}) {
  const [localId, setLocalId] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [raw, setRaw] = useState(false);
  const params = useSearchParams(),
    sheets = useSheets(),
    { now, status } = useBootstrap();
  const mobile = useMediaQuery("(max-width: 767px)");
  const selectedId = full ? params.get("index") : localId;
  const selected = digest?.products.find((p) => p.id === selectedId),
    benchmark = digest?.outcomeBenchmark,
    attention = digest?.marketAttention;
  const outcome = benchmark?.id === selectedId ? benchmark : null,
    map = attention?.id === selectedId ? attention : null;
  const active = selected ?? outcome ?? map;
  const detailRef = useRef<HTMLDivElement>(null);
  const stale =
    status === "stale" ||
    (!!digest && indexFreshness(digest.asOf, now) === "stale");
  const products = digest?.products.slice(0, full ? 4 : 1) ?? [];
  useEffect(() => {
    if (selectedId) {
      setFilter("all");
      setRaw(false);
    }
  }, [selectedId]);
  useEffect(() => {
    if (active && !mobile) detailRef.current?.focus({ preventScroll: true });
  }, [active, mobile]);
  function choose(id: string | null) {
    if (!full) {
      setLocalId(id);
      return;
    }
    if (id) sheets.open({ type: "index", id });
    else sheets.close();
  }
  const rows =
    active && "members" in active && digest
      ? active.members
          .map((id) => digest.observations.find((r) => r.marketId === id))
          .filter((r): r is NonNullable<typeof r> => !!r)
      : [];
  const moves = [...rows]
    .filter((r) => observationMove(r) !== null)
    .sort(
      (a, b) =>
        Math.abs(observationMove(b)!) - Math.abs(observationMove(a)!) ||
        a.marketId.localeCompare(b.marketId),
    )
    .slice(0, 5);
  function download() {
    if (!digest || !active) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...digest,
            products: selected ? [selected] : [],
            outcomeBenchmark: outcome ?? undefined,
            marketAttention: map ?? undefined,
            observations: rows,
            sourceRowsAreExamples: !!map,
            fullConstituentArchive: false,
            fullRulesEmbedded: false,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${active.id}-${digest.asOf.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const guide = outcome
    ? "policy-balance"
    : map
      ? "market-attention"
      : "belief-shift";
  const detailHeadline = (outcome ?? selected)?.headline ?? null;
  const detail =
    active && digest ? (
      <div
        ref={detailRef}
        tabIndex={-1}
        id={`detail-${active.id}`}
        className="min-w-0 space-y-6 outline-none"
        role="region"
        aria-label={`${active.id} index detail`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold">
              {outcome
                ? `Meeting ${outcome.meetingDate ?? "unavailable"}`
                : map
                  ? "Market Attention"
                  : `Belief Shift · ${selected?.name}`}
            </h3>
            {(outcome || selected) && (
              <p className="mt-2 font-mono text-2xl tabular-nums">
                {detailHeadline === null
                  ? "—"
                  : `${outcome && detailHeadline > 0 ? "+" : ""}${detailHeadline.toFixed(1)}`}
                <span className="ml-2 text-xs text-muted-foreground">pp</span>
              </p>
            )}
            {stale && (
              <p className="mt-2 text-xs text-rose-500">
                Historical capture; current reading unavailable.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <GuideButton id={guide} />
            {!mobile && (
              <button
                className="control rounded-full"
                onClick={() => choose(null)}
                aria-label="Close index detail"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {outcome ? (
          <>
            {outcome.state !== "available" && (
              <p className="text-sm text-muted-foreground">
                Withheld: {outcome.issue?.replaceAll("_", " ")}
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <PolicyBalance product={outcome} />
                <div className="mt-5">
                  <DirectionShares product={outcome} />
                </div>
                <div className="mt-6">
                  <OutcomeHistory product={outcome} />
                </div>
              </div>
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">Meeting distribution</h4>
                  <div
                    role="group"
                    aria-label="Decision price display"
                    className="flex gap-3"
                  >
                    {[true, false].map((value) => (
                      <button
                        key={String(value)}
                        className={`min-h-11 rounded-full px-4 text-xs ${raw === value ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                        aria-pressed={raw === value}
                        disabled={
                          !value && (outcome.state !== "available" || stale)
                        }
                        onClick={() => setRaw(value)}
                      >
                        {value ? "Raw" : "Normalized"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    "50+ bp cut",
                    "25 bp cut",
                    "Hold",
                    "25 bp hike",
                    "50+ bp hike",
                  ].map((label, i) => {
                    const row = digest.observations.find(
                      (r) => r.marketId === outcome.members[i],
                    );
                    const value =
                      raw || stale
                        ? row?.quote?.midpoint
                        : outcome.normalized?.[i];
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{label}</span>
                          <span className="font-mono text-primary">
                            {value == null
                              ? "Unavailable"
                              : `${(value * 100).toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${(value ?? 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : map ? (
          <AttentionDetail key={map.asOf} product={map} />
        ) : selected ? (
          <>
            {selected.headline === null && (
              <p className="text-sm text-muted-foreground">
                {reading(selected)}
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <ShiftHistory product={selected} />
              </div>
              <div className="space-y-5">
                {(moves.length
                  ? moves
                  : rows.filter((r) => r.quote).slice(0, 5)
                ).map((row) => (
                  <ProbabilityPair key={row.marketId} row={row} />
                ))}
                {!rows.some((r) => r.quote) && (
                  <p className="text-sm text-muted-foreground">
                    A category needs five eligible events to form its first
                    cohort.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
        <details className="text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Underlying observations and coverage
          </summary>
          <div className="space-y-4 py-3 text-muted-foreground">
            <p>
              Captured {new Date(digest.asOf).toLocaleString()}.
              {digest.baselineAt
                ? ` Comparison ${new Date(digest.baselineAt).toLocaleString()}.`
                : " No saved 24h baseline yet."}
            </p>
            {selected && (
              <p>
                Weekly cohort {selected.epoch}: {selected.coverage.comparable}/
                {selected.coverage.admitted} comparable;{" "}
                {selected.coverage.usable} usable quotes.
              </p>
            )}
            {outcome && (
              <p>
                Raw midpoint total{" "}
                {outcome.rawSum === null
                  ? "unavailable"
                  : `${(outcome.rawSum * 100).toFixed(2)}%`}
                . 24h comparison{" "}
                {outcome.change24h === null
                  ? outcome.comparisonIssue?.replaceAll("_", " ")
                  : `${outcome.change24h.toFixed(1)} pp`}
                .
              </p>
            )}
            {rows.map((row) => (
              <div key={row.marketId} className="space-y-2 break-words">
                <a
                  href={indexSourceUrl(row)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-primary"
                >
                  {row.question}
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </a>
                <p>
                  {row.quote
                    ? `YES bid ${(row.quote.bid * 100).toFixed(1)}% · ask ${(row.quote.ask * 100).toFixed(1)}% · updated ${new Date(row.quote.updatedAt).toLocaleString()}`
                    : `Quote unavailable: ${row.issue}`}
                </p>
                <p>
                  Contract {row.marketId} · rules fingerprint {row.rulesHash} ·
                  closes {row.closesAt}.
                </p>
                {row.comparisonIssue && (
                  <p>Comparison: {row.comparisonIssue.replaceAll("_", " ")}</p>
                )}
              </div>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={download}
            className="inline-flex min-h-11 items-center gap-2 text-xs text-primary"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Download evidence
          </button>
          <EvidencePopover title="Index evidence">
            <p>
              Captured {new Date(digest.asOf).toLocaleString()}. {rows.length}{" "}
              underlying observations.
            </p>
            <p>
              Saved current and prior bid/ask midpoints reproduce this reading.
              Rules fingerprints detect revisions; full source rules are not
              embedded in this download.
            </p>
            {rows.map((r) => (
              <p key={r.marketId}>
                {r.question} · fingerprint {r.rulesHash} ·{" "}
                {r.quote
                  ? `YES bid ${r.quote.bid}, ask ${r.quote.ask}. Venue updated ${r.quote.updatedAt}.`
                  : "Quote unavailable"}
              </p>
            ))}
            <p>
              Cohort and comparable-sample changes break the trend. No
              historical Pulse score is converted into Belief Shift.
            </p>
          </EvidencePopover>
        </div>
      </div>
    ) : selectedId ? (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This index is unavailable in the current publication.
        </p>
        <button
          onClick={() => choose(null)}
          className="control rounded-full px-4"
        >
          Close detail
        </button>
      </div>
    ) : null;
  return (
    <section id="indices" className="space-y-6">
      {!full && <SectionHeader id="belief-shift" title="Indices" />}
      {stale && (
        <p role="status" className="text-sm text-muted-foreground">
          Historical index capture; current readings unavailable.
        </p>
      )}
      {loading && (
        <div
          role="status"
          aria-label="Loading indices"
          className="grid gap-3 sm:grid-cols-2"
        >
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-44 rounded-2xl bg-muted/50 motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}
      {!loading && !products.length && !benchmark && !attention && (
        <p className="text-sm text-muted-foreground">
          No comparable index evidence in this generation.
        </p>
      )}
      {full && (
        <div className="flex flex-wrap gap-3" aria-label="Index types">
          {[
            ["all", "All indices"],
            ["belief", "Belief Shift"],
            ["outcome", "Fed"],
            ["attention", "Attention"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-11 rounded-full px-4 text-xs ${filter === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(filter === "all" || filter === "belief" ? products : []).map((p) => (
          <button
            key={p.id}
            type="button"
            aria-expanded={selectedId === p.id}
            onClick={() => choose(selectedId === p.id ? null : p.id)}
            className="group min-w-0 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/40 active:bg-muted sm:p-6"
          >
            <div className="flex justify-between gap-3">
              <span className="text-sm font-medium">
                Belief Shift · {p.name}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 font-mono text-3xl">
              {p.headline === null ? "—" : p.headline.toFixed(1)}
              <span className="ml-2 text-xs text-muted-foreground">pp</span>
            </div>
            <MovementScale value={p.headline} />
            {p.state !== "available" && (
              <p className="mt-3 text-xs text-muted-foreground">{reading(p)}</p>
            )}
          </button>
        ))}
        {benchmark && (filter === "all" || filter === "outcome") && (
          <button
            type="button"
            onClick={() =>
              choose(selectedId === benchmark.id ? null : benchmark.id)
            }
            aria-expanded={selectedId === benchmark.id}
            className="min-w-0 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/40 active:bg-muted sm:p-6"
          >
            <div className="flex justify-between gap-3">
              <span className="text-sm font-medium">Fed policy balance</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-4 font-mono text-3xl">
              {benchmark.headline === null
                ? "—"
                : `${benchmark.headline > 0 ? "+" : ""}${benchmark.headline.toFixed(1)}`}
              <span className="ml-2 text-xs text-muted-foreground">pp</span>
            </p>
            <PolicyBalance product={benchmark} />
            {benchmark.state !== "available" && (
              <p className="mt-3 text-xs text-muted-foreground">
                {benchmark.issue?.replaceAll("_", " ")}
              </p>
            )}
          </button>
        )}
        {attention && (filter === "all" || filter === "attention") && (
          <button
            type="button"
            onClick={() =>
              choose(selectedId === attention.id ? null : attention.id)
            }
            aria-expanded={selectedId === attention.id}
            className="min-w-0 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/40 active:bg-muted sm:p-6"
          >
            <div className="flex justify-between gap-3">
              <span className="text-sm font-medium">Market Attention</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <AttentionSummary product={attention} />
          </button>
        )}
      </div>
      {mobile && full ? (
        <Sheet
          open={sheets.sheet?.type === "index" && !!selectedId}
          title={
            outcome
              ? "Fed policy balance"
              : map
                ? "Market Attention"
                : "Belief Shift"
          }
          full
          preserveScroll
          onClose={sheets.close}
          onFocusReturn={sheets.focusReturn}
        >
          {detail}
        </Sheet>
      ) : (
        detail && (
          <div className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-7">
            {detail}
          </div>
        )
      )}
    </section>
  );
}
