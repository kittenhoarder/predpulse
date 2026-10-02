import { Suspense } from "react";
import SectionHeader from "@/components/SectionHeader";
import ContinueLink from "@/components/ContinueLink";
import { pageMetadata } from "@/lib/seo";
import IndexGuide from "@/components/IndexGuide";
import IndicesPageClient from "@/components/IndicesPageClient";
export const metadata = pageMetadata(
  "Prediction Market Indices | Predpulse",
  "Explore Belief Shift, Fed policy balance and Market Attention: visual measures of prediction market probability changes and sampled trading activity.",
  "/pulse",
);
export default function IndicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10">
          <SectionHeader id="belief-shift" title="Indices" page />
        </div>
        <Suspense
          fallback={
            <p role="status" className="min-h-48 text-sm text-muted-foreground">
              Loading saved indices…
            </p>
          }
        >
          <IndicesPageClient />
        </Suspense>
        <IndexGuide />
        <ContinueLink path="/pulse" />
      </main>
    </div>
  );
}
