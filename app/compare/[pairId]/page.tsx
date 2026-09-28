import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublishedSnapshot } from "@/lib/snapshot";
import RelatedPairCard from "@/components/RelatedPairCard";
import PulseLogo from "@/components/PulseLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: { pairId: string } }) {
  const snapshot = await loadPublishedSnapshot();
  const item = snapshot?.related?.items.find((pair) => pair.id === params.pairId);
  if (!item) notFound();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="mx-auto flex h-12 max-w-4xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><PulseLogo size="sm" />Predpulse</Link><ThemeToggle />
      </div></header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/#monitor" className="text-xs text-muted-foreground hover:text-foreground">← Back to monitor</Link>
        <div className="mt-6"><RelatedPairCard pair={item} asOf={snapshot!.generatedAt} /></div>
      </main>
    </div>
  );
}
