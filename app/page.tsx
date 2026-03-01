import { Suspense } from "react";
import Link from "next/link";
import { fetchAllSources, getMarkets, getAllMarkets } from "@/lib/get-markets";
import { computePulse } from "@/lib/pulse";
import type { PulseApiResponse } from "@/lib/types";
import MarketTable from "@/components/MarketTable";
import PulseDashboard from "@/components/PulseDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import PulseLogo from "@/components/PulseLogo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Single upstream fetch for all three sources — reused by both table and Pulse
  const sources = await fetchAllSources();
  const [initialData, pulseMarkets] = await Promise.all([
    getMarkets({ sort: "movers", category: "all", offset: 0 }, sources),
    getAllMarkets(sources),
  ]);

  const pulseIndices = computePulse(pulseMarkets);
  const initialPulse: PulseApiResponse = {
    indices: pulseIndices,
    computedAt: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Predpulse",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz",
            description:
              "Real-time dashboard tracking prediction market movers across Polymarket, Kalshi & Manifold.",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz"}/?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <PulseLogo size="sm" />
            <span className="font-semibold text-sm tracking-tight">Predpulse</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Pulse nav link — subtle, right-aligned */}
          <Link
            href="/pulse"
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 shrink-0"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Pulse
          </Link>

          {/* Market count */}
          <span className="text-xs text-muted-foreground/60 hidden sm:block tabular-nums shrink-0">
            {initialData.totalMarkets.toLocaleString()} markets
          </span>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 pt-0 pb-6 flex flex-col">
        {/* Pulse hero — above the fold */}
        <Suspense fallback={null}>
          <PulseDashboard initialData={initialPulse} />
        </Suspense>

        {/* "Markets" label — left-aligned, no broken horizontal rule */}
        <div className="mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Markets
          </span>
        </div>

        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
              Loading markets…
            </div>
          }
        >
          <MarketTable initialData={initialData} />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Data via{" "}
            <a
              href="https://docs.polymarket.com/developers/gamma-markets-api/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Polymarket
            </a>{" "}
            &amp;{" "}
            <a
              href="https://docs.kalshi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Kalshi
            </a>
            {" "}&amp;{" "}
            <a
              href="https://docs.manifold.markets"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Manifold
            </a>
            . Not financial advice.
          </span>
          <span>Predpulse is not affiliated with Polymarket, Kalshi, or Manifold.</span>
        </div>
      </footer>
    </div>
  );
}
