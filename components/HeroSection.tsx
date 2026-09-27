import ProbabilityLandscape from "./ProbabilityLandscape";

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/60" aria-labelledby="hero-title">
      <div className="relative mx-auto flex max-w-screen-2xl flex-col justify-center px-4 py-6 sm:min-h-52 sm:px-6 sm:py-9">
        <div className="relative z-10 max-w-lg">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Prediction markets, in perspective</p>
          <h1 id="hero-title" className="text-[clamp(1.7rem,4vw,2.7rem)] font-semibold leading-tight tracking-[-0.045em]">What changed in the markets you follow?</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Screened moves, named outcomes and the evidence behind them. Updated from an hourly snapshot.</p>
        </div>
        <div className="pointer-events-none absolute -bottom-12 right-0 top-0 w-1/2 opacity-25 sm:-bottom-20 sm:w-3/5 sm:opacity-45" aria-hidden="true">
          <ProbabilityLandscape />
        </div>
      </div>
    </section>
  );
}
