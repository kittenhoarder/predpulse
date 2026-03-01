import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getAllMarkets } from "@/lib/get-markets";
import { computePulse } from "@/lib/pulse";
import type { PulseApiResponse } from "@/lib/types";
import PulseDashboard from "@/components/PulseDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronLeft } from "lucide-react";
import PulseLogo from "@/components/PulseLogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
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

export default async function PulsePage() {
  // SSR: compute initial Pulse data server-side to avoid layout shift
  let initialData: PulseApiResponse | undefined;
  try {
    const markets = await getAllMarkets();
    const indices = computePulse(markets);
    initialData = { indices, computedAt: new Date().toISOString() };
  } catch {
    // Fallback: client-side SWR will handle the fetch
  }

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
          <div className="w-px h-4 bg-border shrink-0" />
          <div className="flex items-center gap-2">
            <PulseLogo size="sm" />
            <span className="font-semibold text-sm tracking-tight">Pulse</span>
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Proprietary
            </span>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Predpulse</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            A proprietary composite sentiment index across 8 market categories. Each score
            synthesizes probability, momentum, breadth, volume, and cross-platform consensus
            from both Polymarket and Kalshi.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />
              Polymarket (CLOB on-chain)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
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
          <PulseDashboard initialData={initialData} large />
        </Suspense>

        {/* Methodology disclosure */}
        <div className="mt-8 p-4 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">Methodology</p>
          <p>
            Each Pulse score (0–100) is a weighted composite of six signals: open-interest-weighted
            probability (30%), volume-weighted probability (20%), 7-day momentum (20%), market breadth
            — the share of markets trending positively (15%), time-decay-weighted probability (10%),
            and a cross-platform consensus penalty that reduces confidence when Polymarket and Kalshi
            disagree significantly (5%).
          </p>
          <p>
            Scores update every 60 seconds. Historical snapshots are retained for 48 hours in memory
            to power the sparkline charts. Not financial advice.
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
          <span>Predpulse is an original index by Predpulse.</span>
        </div>
      </footer>
    </div>
  );
}
