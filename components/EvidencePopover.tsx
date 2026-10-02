"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useSheets } from "./SheetProvider";

export default function EvidencePopover({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId(),
    mobile = useMediaQuery("(max-width: 767px), (hover: none)");
  const sheets = useSheets();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current?.getBoundingClientRect(),
        content = panel.current?.getBoundingClientRect();
      if (!box || !content) return;
      setPosition({
        left: Math.max(
          16,
          Math.min(
            box.right - content.width,
            window.innerWidth - content.width - 16,
          ),
        ),
        top: Math.max(
          16,
          box.bottom + content.height + 8 < window.innerHeight
            ? box.bottom + 8
            : box.top - content.height - 8,
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <button
        ref={trigger}
        aria-label={title}
        aria-expanded={
          open || (sheets.sheet?.type === "evidence" && sheets.sheet.id === id)
        }
        aria-controls={id}
        onClick={(event) => {
          event.stopPropagation();
          if (mobile) sheets.evidence(id, title, children);
          else setOpen(!open);
        }}
        className="control rounded-full text-muted-foreground"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="note"
            style={position}
            className="fixed z-[60] max-h-[min(65dvh,32rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-popover p-5 text-sm leading-relaxed shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-semibold">{title}</p>
              <button
                className="control rounded-full"
                aria-label="Close evidence"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 break-words text-muted-foreground">
              {children}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
