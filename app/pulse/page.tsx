import type { Metadata } from "next";
import HeaderBar from "@/components/HeaderBar";
import IndicesPageClient from "@/components/IndicesPageClient";
export const metadata: Metadata = {
  alternates: { canonical: "/pulse" }, title: "Indices | Predpulse",
  description: "Visual measurements of prediction market repricing. Inspect saved quotes, comparable changes and the underlying sampled events.",
  openGraph: { title: "Belief Shift | Predpulse", description: "Where sampled prediction market expectations moved over 24 hours." },
  twitter: { card: "summary", title: "Belief Shift | Predpulse", description: "Visual prediction market repricing indices." },
};
export default function IndicesPage() {
  return <div className="min-h-screen bg-background"><HeaderBar />
    <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 border-b border-border pb-7"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Prediction market measurements</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Indices</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">A visual reading of changing market expectations, with the captured evidence one interaction away.</p></div>
      <IndicesPageClient />
    </main>
  </div>;
}
