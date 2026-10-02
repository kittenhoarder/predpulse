"use client";
import { Info } from "lucide-react";
import { GUIDE, isGuideId, type GuideId } from "@/lib/guide";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { NavLink, useSheets } from "./SheetProvider";
import Sheet from "./ui/sheet";

export function GuideButton({
  id,
  label,
  warning = false,
}: {
  id: GuideId;
  label?: string;
  warning?: boolean;
}) {
  const { open, sheet } = useSheets();
  return (
    <button
      type="button"
      onClick={() => open({ type: "guide", id })}
      aria-label={label ?? `About ${GUIDE[id].name}`}
      aria-expanded={sheet?.type === "guide" && sheet.id === id}
      aria-controls="guide-content"
      className={`control shrink-0 rounded-full ${warning ? "text-amber-500" : "text-muted-foreground"}`}
    >
      {warning ? (
        <span aria-hidden="true">⚠</span>
      ) : (
        <Info className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
export default function GuidePanel() {
  const { sheet, open, close, focusReturn } = useSheets();
  const { data, status } = useBootstrap();
  const entry =
    isGuideId(sheet?.id ?? null) && sheet?.type === "guide"
      ? GUIDE[sheet.id as GuideId]
      : null;
  return (
    <Sheet
      open={!!entry}
      onClose={close}
      title={entry?.name ?? "Guide"}
      side
      onFocusReturn={focusReturn}
    >
      {entry && (
        <div
          id="guide-content"
          className="space-y-6 pb-4 text-sm leading-relaxed"
        >
          <p className="text-primary">{entry.hook}</p>
          <section>
            <h3 className="mb-2 font-semibold">Why it matters</h3>
            <p>{entry.why}</p>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">What you&apos;re seeing</h3>
            <ul className="list-disc space-y-2 pl-4 text-muted-foreground">
              {entry.see.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">How to read it</h3>
            <ul className="list-disc space-y-2 pl-4 text-muted-foreground">
              {entry.read.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          {entry.id === "freshness" && (
            <section className="rounded-xl bg-muted/50 p-4 text-xs">
              <p>
                {data
                  ? `${status === "hourly" ? "Updated" : status === "delayed" ? "Delayed" : "Last known"} · ${new Date(data.generatedAt).toLocaleString()}`
                  : "Snapshot unavailable"}
              </p>
              {data && (
                <ul className="mt-3 space-y-2">
                  {Object.entries(data.sourceCounts).map(([source, count]) => (
                    <li key={source} className="capitalize">
                      {source}: {count.toLocaleString()} markets examined
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              Limits &amp; method
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-muted-foreground">
              {entry.limits.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <NavLink
              href={`/methodology#${entry.method}`}
              prefetch={false}
              className="mt-3 inline-flex min-h-11 items-center text-primary"
            >
              Full method →
            </NavLink>
          </details>
          <section>
            <h3 className="mb-3 font-semibold">Works well with</h3>
            <div className="flex flex-wrap gap-3">
              {entry.related.map((id) => (
                <button
                  key={id}
                  onClick={() => open({ type: "guide", id })}
                  className="min-h-11 rounded-full border border-border px-4 text-xs hover:border-primary/50 active:bg-muted"
                >
                  {GUIDE[id].name}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </Sheet>
  );
}
