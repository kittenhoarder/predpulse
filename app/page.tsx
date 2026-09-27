import HeaderBar from "@/components/HeaderBar";
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
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Predpulse",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz",
            description:
              "Hourly observations of selected prediction market changes across Polymarket, Kalshi and Manifold.",
          }),
        }}
      />
      <HeaderBar />

      <HeroSection />

      {/* Page content */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 pb-6 flex flex-col">
        <HomeDashboard />
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
          <span className="text-center sm:text-right">
            Predpulse is a beta prototype — data may be incomplete or delayed.{" "}
            Not affiliated with Polymarket, Kalshi, or Manifold.
          </span>
        </div>
      </footer>
    </div>
  );
}
