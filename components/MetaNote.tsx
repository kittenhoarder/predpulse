"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock3, CircleHelp, Info, ShieldCheck } from "lucide-react";

const icons = { freshness: Clock3, method: CircleHelp, evidence: ShieldCheck, context: Info };

export default function MetaNote({ kind, title, children }: {
  kind: keyof typeof icons;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const Icon = icons[kind];

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex shrink-0">
      <button type="button" aria-label={title} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} role="note" className="absolute right-0 top-full z-30 mt-1 max-h-[min(65dvh,24rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-4 text-left text-xs leading-relaxed text-popover-foreground shadow-xl">
          <p className="mb-1 font-semibold">{title}</p>
          <div className="space-y-2 text-muted-foreground">{children}</div>
        </div>
      )}
    </div>
  );
}
