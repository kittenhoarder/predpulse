import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { streamAllMarkets, isCacheWarm } from "@/lib/cached-sources";
import { computePulse } from "@/lib/pulse";
import type { PulseApiResponse } from "@/lib/types";
import PulseDashboard from "@/components/PulseDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronLeft } from "lucide-react";

// Streaming RSC — shell renders immediately; PulseSection streams in when data is ready.
// No force-dynamic needed: Next.js infers dynamic rendering from the async data fetch.

export const metadata: Metadata = {
  alternates: { canonical: "/pulse" },
  title: "Predpulse — Category Sentiment Index",
  description:
    "Predpulse is a proprietary real-time sentiment index across Polymarket & Kalshi, scoring 8 market categories from Extreme Bearish to Extreme Bullish.",
  openGraph: {
    title: "Predpulse — Category Sentiment Index",
    description: "Real-time prediction market sentiment across Polymarket & Kalshi",
    images: [
      {
        url: `/api/og?type=pulse&title=Predpulse&category=All+Categories`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Predpulse — Category Sentiment Index",
    description: "Real-time prediction market sentiment across Polymarket & Kalshi",
  },
};

// Async RSC that streams Pulse data — renders when getCachedSources() resolves
async function PulseSection() {
  if (!isCacheWarm()) return <PulseDashboard large />;
  try {
    const markets = await streamAllMarkets();
    const indices = computePulse(markets);
    const initialData: PulseApiResponse = { indices, computedAt: new Date().toISOString() };
    return <PulseDashboard initialData={initialData} large />;
  } catch {
    return <PulseDashboard large />;
  }
}

export default function PulsePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Predpulse</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Pulse</h1>
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Proprietary
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            A proprietary composite sentiment index across 8 market categories. Each score
            synthesizes polarity-adjusted momentum, flow, and breadth across Polymarket and Kalshi,
            with certainty context shown separately.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
              Polymarket (CLOB on-chain)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              Kalshi (CFTC-regulated DCM)
            </span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Computing Pulse…
            </div>
          }
        >
          <PulseSection />
        </Suspense>

        {/* Methodology disclosure */}
        <div className="mt-8 p-4 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">Methodology</p>
          <p>
            The Pulse score is a composite directional sentiment index. It synthesizes momentum
            (45%), flow (35%), and breadth (20%) across Polymarket and Kalshi markets within each
            category.
          </p>
          <p>
            Confidence reflects data freshness, source agreement, and feature coverage.
            Snapshot history updates every 5 minutes. Not financial advice.
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Data via{" "}
            <a
              href="https://docs.polymarket.com"
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
            . Not financial advice.
          </span>
          <span className="text-center sm:text-right">
            Predpulse is a beta prototype — scores are experimental and may change.{" "}
            Not affiliated with Polymarket or Kalshi.
          </span>
        </div>
      </footer>
    </div>
  );
}
