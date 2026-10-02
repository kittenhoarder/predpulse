import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import SectionHeader from "@/components/SectionHeader";
import PillarDashboard from "@/components/PillarDashboard";
import ContinueLink from "@/components/ContinueLink";
export const metadata = pageMetadata(
  "Moves | Predpulse",
  "Follow daily changes in policy, economy and wider prediction market expectations, with captured evidence.",
  "/moves",
);
export default function Page() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-10">
        <SectionHeader id="moves" title="Moves" page />
      </div>
      <Suspense
        fallback={
          <p role="status" className="min-h-48 text-sm text-muted-foreground">
            Loading saved snapshot…
          </p>
        }
      >
        <PillarDashboard pillar="moves" />
      </Suspense>
      <ContinueLink path="/moves" />
    </main>
  );
}
