import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import { snapshotAgeStatus } from "@/lib/snapshot-response";
import { marketTradeUrl } from "@/lib/format";
import PulseLogo from "@/components/PulseLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { source: string; id: string } }) {
  if (params.source !== "kalshi" && params.source !== "polymarket") notFound();
  const snapshot = await loadPublishedSnapshot();
  const market = snapshot?.markets.find((m) => m.source === params.source && m.id === params.id);
  if (!snapshot || !market) notFound();

  const observation = [...(snapshot.monitor?.items ?? []), ...(snapshot.observations?.items ?? [])]
    .find((item) => item.source === market.source && item.marketId === market.id);
  const related = snapshot.markets.filter((m) => m.source === market.source &&
    m.eventSlug === market.eventSlug && m.id !== market.id).slice(0, 5);
  const status = snapshotAgeStatus(snapshot.generatedAt);
  const venueUrl = marketTradeUrl(market.source, market.eventSlug);
  const basis = observation?.priceBasis ?? (market.source === "kalshi" ? "YES ask" : "market price");
  const current = observation?.currentProbability ?? market.currentPrice;
  const pair = snapshot.related?.items.find((item) => item.markets.some((side) => side.source === market.source && side.marketId === market.id));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><PulseLogo size="sm" />Predpulse</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/#monitor" className="text-xs text-muted-foreground hover:text-foreground">← Back to monitor</Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{market.categories[0] ?? "Market"}</span><span>·</span>
          <span>{market.source === "kalshi" ? "Kalshi" : "Polymarket"}</span><span>·</span>
          <span>{status === "hourly" ? "Hourly snapshot" : "Last-known snapshot"} from {new Date(snapshot.generatedAt).toLocaleString()}</span>
        </div>
        <h1 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{market.question}</h1>
        {pair && <Link href={`/compare/${pair.id}`} className="mt-4 inline-block rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">See related market on another venue →</Link>}
        <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{observation?.outcomeLabel ?? market.outcomes[0] ?? "Outcome"} · {basis}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{current.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">24h change</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{status !== "stale" && observation
              ? `${observation.change24h > 0 ? "+" : ""}${observation.change24h.toFixed(1)} pp` : "Unavailable"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Only shown for screened comparable observations.</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">Quoted spread</dt><dd className="mt-1 tabular-nums">{Number.isFinite(market.spread) ? `${(market.spread * 100).toFixed(1)} pp` : "Unavailable"}</dd></div>
          <div className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">24h volume</dt><dd className="mt-1 tabular-nums">{market.source === "kalshi" ? `${Math.round(market.volume24h).toLocaleString()} contracts` : `$${Math.round(market.volume24h).toLocaleString()}`}</dd></div>
          <div className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">Scheduled market close</dt><dd className="mt-1">{Number.isFinite(Date.parse(market.endDate)) ? new Date(market.endDate).toLocaleString() : "Unavailable"}</dd></div>
        </dl>
        <section className="mt-8" aria-labelledby="event-rules">
          <h2 id="event-rules" className="text-lg font-semibold">Rules and source</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{market.description || "Full resolution terms are available at the venue."}</p>
          {market.description?.length >= 500 && <p className="mt-2 text-xs text-muted-foreground">Rule excerpt from the compact snapshot. Read the full terms at the venue.</p>}
          <a href={venueUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-2">Open original market and full rules ↗</a>
        </section>
        {related.length > 0 && (
          <section className="mt-8" aria-labelledby="related-contracts">
            <h2 id="related-contracts" className="text-lg font-semibold">Other outcomes in this venue event</h2>
            <ul className="mt-3 space-y-2 text-sm">{related.map((m) => (
              <li key={m.id}><Link href={`/events/${m.source}/${encodeURIComponent(m.id)}`} className="text-primary hover:underline">{m.question} · {m.outcomes[0] ?? "Outcome"} {m.currentPrice.toFixed(1)}%</Link></li>
            ))}</ul>
          </section>
        )}
        <p className="mt-10 text-xs text-muted-foreground">Snapshot observations are descriptive. Markets across venues are not treated as equivalent until their rules have been reviewed.</p>
      </main>
    </div>
  );
}
