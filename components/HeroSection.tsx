import ProbabilityLandscape from "./ProbabilityLandscape";

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/60" aria-labelledby="hero-title">
      <div className="relative mx-auto flex min-h-[360px] max-w-screen-2xl flex-col px-6 pb-8 pt-[calc(4rem+env(safe-area-inset-top))] sm:min-h-[390px] sm:px-10 sm:pb-4 sm:pt-14 lg:min-h-[min(58vh,530px)] lg:justify-center lg:py-16">
        <div className="relative z-10 max-w-xl">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Prediction markets, in perspective</p>
          <h1 id="hero-title" className="max-w-[13ch] text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[1.06] tracking-[-0.055em]">See where the odds are moving.</h1>
          <p className="mt-7 max-w-md text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-base">Follow changing expectations across prediction markets, with the context to make sense of the move.</p>
        </div>
        <div className="pointer-events-none relative mt-10 h-52 w-full shrink-0 sm:mt-8 sm:h-48 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:h-full lg:w-[68%]" aria-hidden="true">
          <ProbabilityLandscape />
        </div>
      </div>
    </section>
  );
}
