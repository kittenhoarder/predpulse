import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { loadPublishedSnapshot, loadHistoricalSnapshot, listHistoricalSnapshots } from "@/lib/snapshot";
import { researchEvaluation } from "@/lib/research-evaluation";
import MetaNote from "@/components/MetaNote";

export const dynamic = "force-dynamic";
export function generateMetadata({ searchParams }: { searchParams: { at?: string } }) {
  return { ...pageMetadata("Prediction Market Evidence & History | Predpulse",
    "Inspect saved prediction market quotes, contract rules and comparable observations. Captured evidence with explicit coverage and forecast evaluation limitations.", "/research"),
    ...(searchParams.at ? { robots: { index: false, follow: true } } : {}),
  };
}
export default async function ResearchPage({ searchParams }: { searchParams: { at?: string } }) {
  const at = searchParams.at;
  const validAt = !at || (at.length <= 40 && Number.isFinite(Date.parse(at)));
  const [snapshot, dates] = await Promise.all([
    validAt ? at ? loadHistoricalSnapshot(at) : loadPublishedSnapshot() : Promise.resolve(null),
    listHistoricalSnapshots(),
  ]);
  const d = snapshot?.research ?? null;
  const evaluation = researchEvaluation(d);
  const selected = new Set(dates.slice(-48));
  const seenDays = new Set<string>();
  for (const stamp of [...dates].reverse()) if (!seenDays.has(stamp.slice(0, 10))) { seenDays.add(stamp.slice(0, 10)); selected.add(stamp); }
  const options = Array.from(selected).sort().reverse();
  return <div className="min-h-screen bg-background">

    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/outlooks" className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-foreground">← Back to outlooks</Link>
      <div className="mt-6 flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Evidence & history</h1>
        <MetaNote kind="method" title="What this evidence establishes">
          <p>Hourly publisher capture, independent of website visits. A bounded prospective cohort tracks one YES binary contract per event family from the sampled Polymarket feed, up to 16 contracts. This is sampled coverage, not a representative accuracy study.</p>
          <p>Prices are fresh two-sided YES book midpoints. Missing quotes remain missing. A 24h change requires the same contract, outcome token, rules and close time in a saved generation within 45 minutes of the 24-hour target.</p>
          <p>Each immutable generation records exact rules, their fingerprint, quote basis, outcome identity, status and timestamps. Changes and settlement corrections append new evidence. The manifest indexes up to 30 days and 750 generations. Original generations are never overwritten.</p>
          <p>Forecast evaluation is withheld until public result times can be established by a supported adapter. A venue settlement timestamp does not establish when the result became known. The research gate also requires 100 independent resolved event families, uncertainty intervals and a chronological holdout. Category scores are never probabilities.</p>
        </MetaNote>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <form action="/research" className="flex max-w-full flex-wrap items-end gap-2"><label className="min-w-0 text-xs text-muted-foreground">Saved generation<select name="at" defaultValue={snapshot?.generatedAt ?? ""} className="mt-1 block max-w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground"><option value="">Latest snapshot</option>{options.map((stamp) => <option key={stamp} value={stamp}>{new Date(stamp).toUTCString()}</option>)}</select></label><button className="min-h-10 rounded-lg border border-border px-3 text-sm">Load</button></form>
        {d && <a href={`/api/research?at=${encodeURIComponent(d.asOf)}`} className="text-sm font-medium text-primary hover:underline">Download this evidence JSON ↗</a>}
      </div>
      {!d ? <p className="mt-8 rounded-xl border border-border p-5 text-sm text-muted-foreground">No captured evidence for this generation. Capture begins with the first successful spec-006 publication; earlier history is not backfilled.</p> : <>
        <p className="mt-5 text-xs text-muted-foreground">{new Date(d.asOf).toUTCString()} · Capture started {new Date(d.startedAt).toUTCString()}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Tracked contracts", evaluation.trackedContracts], ["Comparable 24h changes", evaluation.comparable24hChanges], ["Venue-reported settlements", evaluation.settledContracts], ["Qualified forecast cases", evaluation.forecast.sampleSize]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
        <div className="mt-6 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Captured contracts</h2><MetaNote kind="context" title="Evaluation coverage"><p>{evaluation.reason}</p><p>{evaluation.missingPublicResultTime} settled contracts lack verified public result times. {evaluation.frozenLeadObservations} observations were captured about 24h before scheduled close. A scheduled close is not a public result time.</p><p>{evaluation.capacityExcluded} additional sampled event families were excluded by the cohort capacity. Brier loss, log loss, calibration, aggregation improvement and directional classification are unavailable, not zero.</p></MetaNote></div>
        <div className="mt-4 space-y-3">{d.contracts.map((c) => <article key={c.marketId} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3"><a href={c.eventUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 text-sm font-medium hover:text-primary">{c.question} ↗</a><MetaNote kind="evidence" title="Observation provenance"><p>YES token {c.outcomeId}. Family {c.familyId}. Mapping {c.mappingVersion}. Method {d.methodology}.</p><p>Venue updated {c.observedAt ?? "unavailable"}. Ingested {c.ingestedAt}. Status {c.status}. Scheduled close {c.closesAt}.</p><p className="whitespace-pre-line">{c.rules}</p><p>Rules fingerprint {c.rulesHash}.</p>{c.resolutions.map((r) => <p key={`${r.fingerprint}:${r.ingestedAt}`}>Venue-reported YES settlement {r.outcomeYes}, captured {r.ingestedAt}. Public result time unavailable. Evidence {r.evidenceUrl}. Revision {r.fingerprint.slice(0, 12)}.</p>)}</MetaNote></div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><span>YES midpoint <strong className="ml-1 font-medium text-foreground tabular-nums">{c.midpoint === null ? "Unavailable" : `${(c.midpoint * 100).toFixed(1)}%`}</strong></span><span>24h change <strong className="ml-1 font-medium text-foreground tabular-nums">{c.change24hPP === null ? "Unavailable" : `${c.change24hPP > 0 ? "+" : ""}${c.change24hPP.toFixed(1)} pp`}</strong></span><span>{c.status}</span></div>
        </article>)}</div>
      </>}
    </main>
  </div>;
}
