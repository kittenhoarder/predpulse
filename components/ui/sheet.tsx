"use client";
import { Drawer } from "vaul";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export default function Sheet({
  open,
  onClose,
  title,
  children,
  side = false,
  full = false,
  onFocusReturn,
  preserveScroll = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: boolean;
  full?: boolean;
  onFocusReturn?: () => void;
  preserveScroll?: boolean;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const right = desktop && side;
  const content = useRef<HTMLDivElement | null>(null),
    heading = useRef<HTMLHeadingElement>(null),
    scrollTop = useRef(0);
  const attachContent = useCallback(
    (element: HTMLDivElement | null) => {
      if (content.current) scrollTop.current = content.current.scrollTop;
      content.current = element;
      if (element) element.scrollTop = preserveScroll ? scrollTop.current : 0;
    },
    [preserveScroll],
  );
  useEffect(() => {
    scrollTop.current = 0;
    if (content.current) content.current.scrollTop = 0;
  }, [title]);
  const [snap, setSnap] = useState<number | string | null>(0.6);
  useEffect(() => {
    if (open) setSnap(0.6);
  }, [open]);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      direction={right ? "right" : "bottom"}
      snapPoints={!right && !full ? [0.6, 0.92] : undefined}
      activeSnapPoint={!right && !full ? snap : undefined}
      setActiveSnapPoint={setSnap}
      repositionInputs={false}
      handleOnly
      autoFocus
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm motion-safe:duration-150" />
        <Drawer.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            heading.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onFocusReturn?.();
          }}
          className={`fixed z-50 flex flex-col border border-border bg-background shadow-2xl outline-none motion-safe:duration-150 ${right ? "inset-y-0 right-0 w-[420px] max-w-[100vw]" : `inset-x-0 bottom-0 ${full ? "h-[92dvh]" : "h-[100dvh]"} rounded-t-2xl`}`}
        >
          {!right && (
            <Drawer.Handle className="mx-auto mt-3 mb-1 shrink-0 bg-border" />
          )}
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-3">
            <Drawer.Title
              ref={heading}
              tabIndex={-1}
              className="text-lg font-semibold tracking-tight outline-none"
            >
              {title}
            </Drawer.Title>
            <button
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="control rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            ref={attachContent}
            onScroll={(event) => {
              scrollTop.current = event.currentTarget.scrollTop;
            }}
            style={
              !right
                ? {
                    maxHeight: `calc(${full ? 92 : Number(snap ?? 0.6) * 100}dvh - 88px)`,
                  }
                : undefined
            }
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            data-sheet-scroll
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
