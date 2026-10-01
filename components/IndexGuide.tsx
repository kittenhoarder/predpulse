import Link from "next/link";

export const MEASURES = [
  { id: "belief-shift", name: "Belief Shift", question: "How much have expectations moved?",
    description: "The average absolute 24-hour change in YES midpoints, measured in percentage points across a pinned sample of Economics or Politics events.",
    limitation: "A 24-hour score needs comparable saved quotes. It is a measure of movement, not a category probability." },
  { id: "policy-balance", name: "Fed policy balance", question: "Which way does policy lean?",
    description: "The normalized share of rate-hike outcomes minus the share of rate-cut outcomes for one supported Federal Reserve meeting. The outcome distribution shows the balance behind the score.",
    limitation: "Meeting-specific, with the meeting date displayed. The score is not an expected interest rate change." },
  { id: "market-attention", name: "Market Attention", question: "Where is trading activity concentrated?",
    description: "A map of seven categories, sized by their share of reported 24-hour dollar volume in the bounded Polymarket event sample. Event families are counted once.",
    limitation: "Sampled trading activity, not the whole market, investor sentiment or capital inflows. The map can display on its first capture." },
];

export default function IndexGuide({ detailed = false }: { detailed?: boolean }) {
  return <section className="mt-10 border-t border-border pt-7" aria-labelledby="measure-guide-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="measure-guide-title" className="text-lg font-semibold tracking-tight">Three ways to read the market</h2>
      {!detailed && <Link href="/methodology" prefetch={false} className="inline-flex min-h-11 items-center text-xs text-primary hover:underline">Methodology & sources →</Link>}
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">{MEASURES.map((measure, i) => <article id={measure.id} key={measure.id} className="rounded-2xl border border-border bg-card p-5">
      <span className="text-[10px] font-semibold tracking-widest text-primary">0{i + 1}</span>
      <h3 className="mt-3 text-base font-semibold">{measure.name}</h3>
      <p className="mt-2 text-sm font-medium">{measure.question}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{measure.description}</p>
      {detailed && <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{measure.limitation}</p>}
    </article>)}</div>
  </section>;
}
