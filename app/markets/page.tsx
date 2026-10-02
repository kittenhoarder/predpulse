import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import SectionHeader from "@/components/SectionHeader";
import PillarDashboard from "@/components/PillarDashboard";
import ContinueLink from "@/components/ContinueLink";
export const metadata = pageMetadata(
  "Markets | Predpulse",
  "Browse sampled prediction markets, compare venues and follow your saved questions.",
  "/markets",
);
export default function Page() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-10">
        <SectionHeader id="markets" title="Markets" page />
      </div>
      <Suspense
        fallback={
          <p role="status" className="min-h-48 text-sm text-muted-foreground">
            Loading saved snapshot…
          </p>
        }
      >
        <PillarDashboard pillar="markets" />
      </Suspense>
      <ContinueLink path="/markets" />
    </main>
  );
}
