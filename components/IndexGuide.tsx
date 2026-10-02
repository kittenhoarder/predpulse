import Link from "next/link";
import { GUIDE } from "@/lib/guide";
export const MEASURES = (
  ["belief-shift", "policy-balance", "market-attention"] as const
).map((id) => ({
  id,
  name: GUIDE[id].name,
  question: GUIDE[id].hook,
  description: GUIDE[id].why,
  limitation: GUIDE[id].limits.join(" "),
}));
export default function IndexGuide({
  detailed = false,
}: {
  detailed?: boolean;
}) {
  return (
    <section
      className="mt-10 space-y-5"
      aria-label="Three ways to read the market"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {MEASURES.map((measure) => (
          <article key={measure.id} className="rounded-2xl bg-muted/30 p-5">
            <h2 className="text-sm font-semibold">{measure.name}</h2>
            <p className="mt-2 text-xs text-primary">{measure.question}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {measure.description}
            </p>
            {detailed && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {measure.limitation}
              </p>
            )}
          </article>
        ))}
      </div>
      <Link
        href="/methodology"
        prefetch={false}
        className="inline-flex min-h-11 items-center text-xs text-primary"
      >
        How Predpulse works →
      </Link>
    </section>
  );
}
