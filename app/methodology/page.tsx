import Link from "next/link";
import { GUIDE, THESIS } from "@/lib/guide";
import { PILLARS } from "@/lib/nav";
import { SITE_URL, jsonLd, pageMetadata } from "@/lib/seo";
const description =
  "How Predpulse measures changing expectations: sources, sampling, quote comparisons, evidence and limitations.";
export const metadata = pageMetadata(
  "How Predpulse Works | Predpulse",
  description,
  "/methodology",
);
export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "How Predpulse works",
            description,
            url: `${SITE_URL}/methodology`,
            isPartOf: { "@type": "WebSite", name: "Predpulse", url: SITE_URL },
          }),
        }}
      />
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        How it works
      </h1>
      <p className="mt-5 text-lg leading-relaxed">{THESIS}</p>
      <nav aria-label="Explore pillars" className="my-8 flex flex-wrap gap-3">
        {PILLARS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:border-primary/40"
          >
            {p.name}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Guide contents"
        className="mb-10 flex flex-wrap gap-x-5 gap-y-2"
      >
        {Object.values(GUIDE).map((entry) => (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            className="inline-flex min-h-11 items-center text-xs text-primary"
          >
            {entry.name}
          </a>
        ))}
      </nav>
      <div className="space-y-10 md:space-y-16">
        {Object.values(GUIDE).map((entry) => (
          <section
            key={entry.id}
            id={entry.method}
            className="space-y-4 text-sm leading-relaxed"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary">
                {entry.pillar}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {entry.name}
              </h2>
              <p className="mt-2 text-muted-foreground">{entry.hook}</p>
            </div>
            <p>{entry.why}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-medium">What you&apos;re seeing</h3>
                <ul className="list-disc space-y-2 pl-4 text-muted-foreground">
                  {entry.see.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-medium">How to read it</h3>
                <ul className="list-disc space-y-2 pl-4 text-muted-foreground">
                  {entry.read.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center font-medium">
                Limits &amp; method
              </summary>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-muted-foreground">
                {entry.limits.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Predpulse is a beta prototype. Sources: Polymarket, Kalshi and Manifold.
        Coverage is sampled and may be incomplete or delayed. Not financial
        advice. Not affiliated with source venues.
      </p>
      <Link
        href="/research"
        prefetch={false}
        className="mt-3 inline-flex min-h-11 items-center text-sm text-primary"
      >
        Inspect evidence &amp; history →
      </Link>
    </main>
  );
}
