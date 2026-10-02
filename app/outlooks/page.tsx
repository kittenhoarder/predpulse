import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import SectionHeader from "@/components/SectionHeader";
import PillarDashboard from "@/components/PillarDashboard";
import ContinueLink from "@/components/ContinueLink";
export const metadata = pageMetadata(
  "Outlooks | Predpulse",
  "Compare captured prices for upcoming events and explore the next supported Fed decision.",
  "/outlooks",
);
export default function Page() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-10">
        <SectionHeader id="outlooks" title="Outlooks" page />
      </div>
      <Suspense
        fallback={
          <p role="status" className="min-h-48 text-sm text-muted-foreground">
            Loading saved snapshot…
          </p>
        }
      >
        <PillarDashboard pillar="outlooks" />
      </Suspense>
      <ContinueLink path="/outlooks" />
    </main>
  );
}
