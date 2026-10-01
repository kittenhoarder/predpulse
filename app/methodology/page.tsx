import Link from "next/link";
import HeaderBar from "@/components/HeaderBar";
import IndexGuide, { MEASURES } from "@/components/IndexGuide";
import { SITE_URL, jsonLd, pageMetadata } from "@/lib/seo";

const description = "How Predpulse measures prediction market movement, Fed policy balance and market attention: sources, sampling, quote comparisons and limitations.";
export const metadata = pageMetadata("Prediction Market Index Methodology | Predpulse", description, "/methodology");

export default function MethodologyPage() {
  return <div className="min-h-screen bg-background"><HeaderBar />
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
        "@context": "https://schema.org", "@type": "WebPage", name: "Predpulse index methodology", description,
        url: `${SITE_URL}/methodology`, about: MEASURES.map(({ name, description }) => ({ "@type": "Thing", name, description })),
        isPartOf: { "@type": "WebSite", name: "Predpulse", url: SITE_URL },
      }) }} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Methodology & sources</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">What the measures mean</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Prediction markets express expectations through contract prices. Predpulse makes their movement, policy outcomes and trading activity easier to inspect. Each measure answers a different question.</p>
      <Link href="/pulse" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Explore the indices →</Link>
      <IndexGuide detailed />
      <section className="mt-8 grid gap-6 border-t border-border pt-7 sm:grid-cols-2" aria-label="Data and evidence">
        <div><h2 className="text-lg font-semibold">Captured, not live</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Publication is scheduled hourly and may be delayed. Every product displays its capture time. Missing quotes stay missing, and comparisons are withheld when contract identity, rules or timing are not comparable.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Belief Shift and Fed policy balance use two-sided YES bid/ask midpoints from Polymarket. A move from 40% to 43% is 3 percentage points. These indices are analytical measurements, not investable funds.</p></div>
        <div><h2 className="text-lg font-semibold">Sources & evidence</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">The dashboard draws on Polymarket, Kalshi and Manifold. The three index products currently use Polymarket. Venue units differ: dollar volume and Kalshi contract counts are not combined into one volume measure.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Open an index to inspect its captured evidence. The research view provides saved contract observations and history; it does not establish forecast accuracy.</p><Link href="/research" prefetch={false} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary hover:underline">Inspect evidence & history →</Link></div>
      </section>
      <p className="mt-8 text-xs text-muted-foreground">Predpulse is a beta prototype. Coverage is sampled and data may be incomplete or delayed. Not financial advice. Not affiliated with the source venues.</p>
    </main>
  </div>;
}
