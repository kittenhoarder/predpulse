import type { Metadata } from "next";
import { cache } from "react";
import { SITE_URL, jsonLd, pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { fetchEventBySlug, fetchTags } from "@/lib/gamma";
import { buildTagMap, processEvents } from "@/lib/process-markets";
import MarketDetailClient from "./MarketDetailClient";

export const dynamic = "force-dynamic";
const loadEvent = cache((slug: string) => fetchEventBySlug(slug).catch(() => null));

interface PageProps {
  params: { slug: string };
}

/** Share metadata and page content use the same venue event acquisition. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await loadEvent(params.slug);
  if (!event) notFound();
  return pageMetadata(`${event.title} | Predpulse`,
    "Explore Polymarket outcome contracts, market prices and resolution rules. Inspect the original venue event through Predpulse.",
    `/market/${encodeURIComponent(params.slug)}`);
}

export default async function MarketDetailPage({ params }: PageProps) {
  const [event, tags] = await Promise.all([
    loadEvent(params.slug),
    fetchTags().catch(() => []),
  ]);

  if (!event) notFound();

  const tagMap = buildTagMap(tags);
  const processed = processEvents([event], tagMap);
  const market = processed[0];

  if (!market) notFound();

  const BASE_URL = SITE_URL;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Predpulse", item: BASE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: market.question,
                item: `${BASE_URL}/market/${params.slug}`,
              },
            ],
          }),
        }}
      />
      {/* Header */}


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
