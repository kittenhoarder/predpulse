import ProbabilityLandscape from "./ProbabilityLandscape";

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/60" aria-labelledby="hero-title">
      <div className="relative mx-auto flex min-h-[450px] max-w-screen-2xl flex-col px-6 pb-5 pt-16 sm:px-10 sm:pt-20 lg:min-h-[min(65vh,610px)] lg:justify-center lg:py-20">
        <div className="relative z-10 max-w-xl lg:pb-5">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            Prediction markets, in perspective
          </p>
          <h1 id="hero-title" className="max-w-[13ch] text-[clamp(2.6rem,5vw,5rem)] font-semibold leading-[1.06] tracking-[-0.055em] text-foreground">
            See where the odds are moving.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Follow changing expectations across prediction markets, with the context to make sense of the move.
          </p>
        </div>
        <div className="relative mt-2 h-56 w-full shrink-0 sm:h-64 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:h-full lg:w-[68%]" aria-hidden="true">
          <ProbabilityLandscape />
        </div>
      </div>
    </section>
  );
}
