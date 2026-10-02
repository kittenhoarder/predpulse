import Link from "next/link";
import type { ProcessedMarket } from "@/lib/types";
import SectionHeader from "./SectionHeader";
export function ClosingSoon({
  markets,
  generatedAt,
}: {
  markets: ProcessedMarket[];
  generatedAt: string;
}) {
  const now = Date.parse(generatedAt),
    seen = new Set<string>();
  const closing = [...markets]
    .filter(
      (m) =>
        m.source !== "manifold" &&
        m.categoryslugs.some((c) =>
          ["economics", "politics", "geopolitics"].includes(c),
        ),
    )
    .sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate))
    .filter((m) => {
      const close = Date.parse(m.endDate),
        key = `${m.source}:${m.eventSlug}`;
      if (
        !Number.isFinite(close) ||
        close <= now ||
        close > now + 7 * 86400_000 ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
  return (
    <section id="closing-soon">
      <SectionHeader id="closing-soon" />
      {closing.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {closing.map((market) => (
            <Link
              prefetch={false}
              key={`${market.source}:${market.id}`}
              href={`/events/${market.source}/${encodeURIComponent(market.id)}`}
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 active:bg-muted"
            >
              <p className="line-clamp-2 text-sm font-medium">
                {market.question}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Closes{" "}
                {new Date(market.endDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No sampled policy or economy markets close within seven days.
        </p>
      )}
    </section>
  );
}
