import Link from "next/link";
import { NAV_V2 } from "@/lib/bootstrap";
import { SITE_URL, SITE_DESCRIPTION, jsonLd } from "@/lib/seo";
import HeroSection from "@/components/HeroSection";
import HomeDashboard from "@/components/HomeDashboard";

// ---------------------------------------------------------------------------
// Page shell — renders instantly (static HTML), data sections stream in
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Predpulse",
            url: SITE_URL,
            description: SITE_DESCRIPTION,
          }),
        }}
      />

      <HeroSection />

      {/* Page content */}
      <main className="flex-1 max-w-screen-xl w-full mx-auto px-4 sm:px-6 py-10 md:py-16 flex flex-col">
        <HomeDashboard />
        {!NAV_V2 && (
          <section
            className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground"
            aria-label="About Predpulse"
          >
            <h2 className="font-medium text-foreground">
              Prediction markets, measured
            </h2>
            <p className="mt-2 max-w-3xl leading-relaxed">
              Explore Belief Shift indices, Fed policy balance and a Market
              Attention map. Hourly snapshots bring changing expectations and
              trading activity into view, with the captured evidence behind each
              measure.
            </p>
            <Link
              href="/methodology"
              prefetch={false}
              className="mt-3 inline-flex min-h-11 items-center text-primary hover:underline"
            >
              How the measures work →
            </Link>
          </section>
        )}
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
            </a>{" "}
            &amp;{" "}
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
          <span className="text-center sm:text-right">
            Predpulse is a beta prototype — data may be incomplete or delayed.{" "}
            Not affiliated with Polymarket, Kalshi, or Manifold.
          </span>
        </div>
      </footer>
    </div>
  );
}
