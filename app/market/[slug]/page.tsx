import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchEventBySlug, fetchTags } from "@/lib/gamma";
import { buildTagMap, processEvents } from "@/lib/process-markets";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import MarketDetailClient from "./MarketDetailClient";
import PulseLogo from "@/components/PulseLogo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

/** Build OG metadata so every shared link gets a rich preview card. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await fetchEventBySlug(params.slug).catch(() => null);
  if (!event) {
    return { title: "Market not found — Predpulse" };
  }

  const market = event.markets?.[0];
  const prob = market
    ? (parseFloat(
        JSON.parse(market.outcomePrices ?? "[]")[0] ?? "0"
      ) * 100).toFixed(1)
    : "—";
  const change = market
    ? ((market.oneDayPriceChange ?? 0) * 100).toFixed(1)
    : "0";
  const category = event.tags?.[0]?.label ?? "";

  const ogUrl = new URL(
    `/api/og?title=${encodeURIComponent(event.title)}&prob=${prob}&change=${change}%25&category=${encodeURIComponent(category)}`,
    process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz"
  );

  return {
    title: `${event.title} — Predpulse`,
    description: `Current probability: ${prob}% · 24h change: ${Number(change) >= 0 ? "+" : ""}${change}% via Predpulse`,
    openGraph: {
      title: event.title,
      description: `${prob}% probability · ${Number(change) >= 0 ? "+" : ""}${change}% 24h`,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: `${prob}% probability · ${Number(change) >= 0 ? "+" : ""}${change}% 24h`,
      images: [ogUrl.toString()],
    },
  };
}

export default async function MarketDetailPage({ params }: PageProps) {
  const [event, tags] = await Promise.all([
    fetchEventBySlug(params.slug).catch(() => null),
    fetchTags().catch(() => []),
  ]);

  if (!event) notFound();

  const tagMap = buildTagMap(tags);
  const processed = processEvents([event], tagMap);
  const market = processed[0];

  if (!market) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <a href="/" className="flex items-center gap-2.5">
              <PulseLogo size="sm" />
              <span className="font-semibold text-sm tracking-tight">Predpulse</span>
            </a>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <span className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-xs">
              {market.categories[0] ?? "Market"}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <MarketDetailClient market={market} />
      </main>

      <footer className="border-t border-border py-5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Data via Polymarket Gamma API. Not financial advice.</span>
          <a href="/" className="hover:text-foreground transition-colors">← Back to dashboard</a>
        </div>
      </footer>
    </div>
  );
}
