import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPageSnapshot } from "@/lib/page-snapshot";
import { pageMetadata } from "@/lib/seo";
import RelatedPairCard from "@/components/RelatedPairCard";
import PulseLogo from "@/components/PulseLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Snapshot only changes on the hourly publisher; CDN can reuse HTML between publishes.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: { pairId: string } }) {
  const snapshot = await loadPageSnapshot();
  const item = snapshot?.related?.items.find((pair) => pair.id === params.pairId);
  if (!item) notFound();
  return pageMetadata(`${item.markets[0].question} | Venue comparison | Predpulse`,
    "Inspect related Polymarket and Kalshi contracts, their quoted prices and settlement differences. Similar titles do not establish identical outcomes.",
    `/compare/${encodeURIComponent(params.pairId)}`);
}

export default async function ComparePage({ params }: { params: { pairId: string } }) {
  const snapshot = await loadPageSnapshot();
  const item = snapshot?.related?.items.find((pair) => pair.id === params.pairId);
  if (!item) notFound();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="mx-auto flex h-12 max-w-4xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><PulseLogo size="sm" />Predpulse</Link><ThemeToggle />
      </div></header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/#monitor" className="text-xs text-muted-foreground hover:text-foreground">← Back to monitor</Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Across-venue comparison</h1>
        <div className="mt-4"><RelatedPairCard pair={item} asOf={snapshot!.generatedAt} /></div>
      </main>
    </div>
  );
}
