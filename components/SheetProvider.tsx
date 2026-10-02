"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  sheetFromUrl,
  sheetUrl,
  withoutSheet,
  type SheetEntry,
  type SheetState,
} from "@/lib/sheet-history";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import Sheet from "./ui/sheet";
import { isGuideId } from "@/lib/guide";

interface Evidence {
  publication: string | null;
  title: string;
  content: React.ReactNode;
}
interface Sheets {
  sheet: SheetState | null;
  open: (sheet: SheetState) => void;
  close: () => void;
  navigate: (href: string) => void;
  focusReturn: () => void;
  evidence: (id: string, title: string, content: React.ReactNode) => void;
}
const Context = createContext<Sheets | null>(null);
export function SheetProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const owner = useRef<string>("");
  const busy = useRef(false),
    pendingNavigation = useRef<string | null>(null);
  const { data } = useBootstrap();
  const publication = useRef<string | null>(null);
  publication.current = data?.generatedAt ?? null;
  const previousEntry = useRef<SheetEntry | null>(null);
  const origins = useRef(new Map<number, HTMLElement>());
  const returnTo = useRef<HTMLElement | null>(null);
  const evidenceCache = useRef(new Map<string, Evidence>());
  const current = () =>
    window.history.state?.predpulseSheet as SheetEntry | undefined;
  const focusReturn = useCallback(() => {
    requestAnimationFrame(() => {
      let target = returnTo.current;
      if (!target && document.querySelector('[role="dialog"]')) return;
      if (target && !target.isConnected && target.getAttribute("aria-label")) {
        const label = target.getAttribute("aria-label");
        target =
          Array.from(
            document.querySelectorAll<HTMLElement>(
              "button[aria-label],a[aria-label]",
            ),
          ).find((element) => element.getAttribute("aria-label") === label) ??
          null;
      }
      if (target?.isConnected) target.focus({ preventScroll: true });
      else {
        const heading = document.querySelector<HTMLElement>("main h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
    });
  }, []);
  useEffect(() => {
    owner.current ||= crypto.randomUUID();
    const restore = () => {
      const url = new URL(window.location.href);
      let cleaned = false;
      if (
        url.searchParams.has("guide") &&
        !isGuideId(url.searchParams.get("guide"))
      ) {
        url.searchParams.delete("guide");
        cleaned = true;
      }
      if (
        url.searchParams.has("index") &&
        !sheetFromUrl(
          `/pulse?index=${encodeURIComponent(url.searchParams.get("index") ?? "")}`,
        )
      ) {
        url.searchParams.delete("index");
        cleaned = true;
      }
      if (cleaned) window.history.replaceState(window.history.state, "", url);
      const entry = current();
      const owned = entry?.owner === owner.current;
      const previous = previousEntry.current;
      if (previous && (!owned || entry.depth < previous.depth))
        returnTo.current = origins.current.get(previous.depth) ?? null;
      else if (owned && (!previous || entry.depth > previous.depth))
        returnTo.current = null;
      previousEntry.current = owned ? entry : null;
      const next = owned ? entry.sheet : sheetFromUrl(window.location.href);
      const cached =
        next?.type === "evidence" ? evidenceCache.current.get(next.id!) : null;
      setEvidence(
        cached && cached.publication !== publication.current
          ? {
              ...cached,
              content: (
                <p>
                  Evidence unavailable for the current publication. Reopen the
                  item to inspect its latest evidence.
                </p>
              ),
            }
          : (cached ?? null),
      );
      setSheet(next?.type === "evidence" && !cached ? null : next);
      busy.current = false;
      if (pendingNavigation.current) {
        const href = pendingNavigation.current;
        pendingNavigation.current = null;
        setSheet(null);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => router.push(href)),
        );
      }
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [pathname, router]);
  useEffect(() => {
    if (
      sheet?.type === "evidence" &&
      evidence &&
      evidence.publication !== (data?.generatedAt ?? null)
    ) {
      setEvidence({
        ...evidence,
        publication: data?.generatedAt ?? null,
        content: (
          <p>
            Evidence unavailable for the current publication. Reopen the item to
            inspect its latest evidence.
          </p>
        ),
      });
    }
  }, [data?.generatedAt, evidence, sheet?.type]);
  const open = useCallback((next: SheetState) => {
    if (busy.current) return;
    const entry = current(),
      owned = entry?.owner === owner.current;
    const previous = owned ? entry.sheet : sheetFromUrl(window.location.href);
    const replace =
      owned &&
      (previous?.type === "menu" ||
        (previous?.type === "guide" && next.type === "guide"));
    const depth = owned ? entry.depth + (replace ? 0 : 1) : 1;
    if (!replace)
      origins.current.set(depth, document.activeElement as HTMLElement);
    const marker: SheetEntry = {
      owner: owner.current,
      depth,
      sheet: next,
      base: owned
        ? entry.base
        : window.location.pathname +
          window.location.search +
          window.location.hash,
    };
    window.history[replace ? "replaceState" : "pushState"](
      { ...window.history.state, predpulseSheet: marker },
      "",
      sheetUrl(window.location.href, next),
    );
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: window.history.state }),
    );
    setSheet(next);
  }, []);
  const close = useCallback(() => {
    if (busy.current) return;
    const entry = current();
    if (entry?.owner === owner.current) {
      returnTo.current = origins.current.get(entry.depth) ?? null;
      busy.current = true;
      window.history.back();
    } else {
      const direct = sheetFromUrl(window.location.href);
      window.history.replaceState(
        { ...window.history.state, predpulseSheet: undefined },
        "",
        withoutSheet(window.location.href, direct?.type),
      );
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: window.history.state }),
      );
      setSheet(sheetFromUrl(window.location.href));
      returnTo.current = null;
    }
  }, []);
  const navigate = useCallback(
    (href: string) => {
      if (busy.current) return;
      const entry = current();
      if (entry?.owner === owner.current) {
        busy.current = true;
        pendingNavigation.current = href;
        window.history.go(-entry.depth);
      } else {
        window.history.replaceState(
          { ...window.history.state, predpulseSheet: undefined },
          "",
          withoutSheet(window.location.href),
        );
        setSheet(null);
        router.push(href);
      }
    },
    [router],
  );
  const showEvidence = useCallback(
    (id: string, title: string, content: React.ReactNode) => {
      const value = { title, content, publication: publication.current };
      evidenceCache.current.set(id, value);
      setEvidence(value);
      open({ type: "evidence", id });
    },
    [open],
  );
  return (
    <Context.Provider
      value={{
        sheet,
        open,
        close,
        navigate,
        evidence: showEvidence,
        focusReturn,
      }}
    >
      {children}
      <Sheet
        open={sheet?.type === "evidence" && !!evidence}
        onClose={close}
        title={evidence?.title ?? "Evidence"}
        onFocusReturn={focusReturn}
      >
        <div className="space-y-4 break-words text-sm leading-relaxed text-muted-foreground">
          {evidence?.content}
        </div>
      </Sheet>
    </Context.Provider>
  );
}
export function useSheets() {
  const context = useContext(Context);
  if (!context) throw new Error("Sheets require SheetProvider");
  return context;
}
export function NavLink({
  href,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  const { sheet, navigate } = useSheets();
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0 ||
          !sheet
        )
          return;
        event.preventDefault();
        navigate(String(href));
      }}
    >
      {children}
    </Link>
  );
}
