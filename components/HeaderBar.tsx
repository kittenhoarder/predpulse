"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Clock3,
  AlertCircle,
  History,
  LayoutGrid,
  Menu,
  Star,
} from "lucide-react";
import { NAV_V2 } from "@/lib/bootstrap";
import { PILLARS } from "@/lib/nav";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { getWatchlist, WATCHLIST_CHANGE } from "@/lib/watchlist";
import PulseLogo from "./PulseLogo";
import { ThemeToggle } from "./ThemeToggle";
import LegacyHeaderBar from "./LegacyHeaderBar";
import { NavLink, useSheets } from "./SheetProvider";
import Sheet from "./ui/sheet";
import ExplorePanel from "./ExplorePanel";

export default function HeaderBar() {
  return NAV_V2 ? <NavigationHeader /> : <LegacyHeaderBar />;
}
function NavigationHeader() {
  const pathname = usePathname(),
    { data, status, isLoading } = useBootstrap();
  const { sheet, open, close, focusReturn } = useSheets();
  const [explore, setExplore] = useState(false),
    [saved, setSaved] = useState(0),
    [newVisitor, setNewVisitor] = useState(false);
  const region = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => setSaved(getWatchlist().size);
    update();
    window.addEventListener(WATCHLIST_CHANGE, update);
    window.addEventListener("storage", update);
    try {
      setNewVisitor(!localStorage.getItem("predpulse:onboarded:v1"));
    } catch {
      /* Private storage */
    }
    return () => {
      window.removeEventListener(WATCHLIST_CHANGE, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    setExplore(false);
  }, [pathname]);
  useEffect(() => {
    if (!explore) return;
    const outside = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !region.current?.contains(e.target) &&
        !trigger.current?.contains(e.target)
      )
        setExplore(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExplore(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [explore]);
  const onboard = () => {
    try {
      localStorage.setItem("predpulse:onboarded:v1", "1");
    } catch {
      /* Optional */
    }
  };
  const icon =
    status === "stale" ? History : status === "delayed" ? AlertCircle : Clock3;
  const StatusIcon = icon;
  const time = data
    ? new Date(data.generatedAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const label = data
    ? `${status === "stale" ? "Last known" : status === "delayed" ? "Delayed" : "Updated"} · ${status === "stale" ? new Date(data.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : time}`
    : isLoading
      ? "Loading snapshot status"
      : "Snapshot unavailable";
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-4 sm:px-6 lg:gap-5">
          <NavLink
            href="/"
            className="flex min-h-11 shrink-0 items-center gap-2"
            aria-label="Predpulse home"
          >
            <PulseLogo size="sm" />
            <span className="text-sm font-semibold tracking-tight">
              Predpulse
            </span>
            <span className="hidden min-[360px]:inline rounded bg-primary/10 px-1.5 py-1 text-[10px] uppercase tracking-wider text-primary">
              Beta
            </span>
          </NavLink>
          <nav
            aria-label="Main navigation"
            className="ml-auto hidden items-center gap-1 md:flex lg:gap-3"
          >
            {PILLARS.map((p) => (
              <NavLink
                href={p.href}
                key={p.href}
                aria-current={pathname === p.href ? "page" : undefined}
                className={`flex h-14 items-center border-b-2 px-2 text-xs ${pathname === p.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {p.name}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center md:ml-0">
            <button
              className={`control gap-2 rounded-full px-2 text-xs ${status === "stale" ? "text-rose-500" : status === "delayed" ? "text-amber-500" : "text-muted-foreground"}`}
              aria-label={label}
              onClick={() => open({ type: "guide", id: "freshness" })}
            >
              <StatusIcon className="h-4 w-4 shrink-0" />
              <span className="hidden whitespace-nowrap lg:inline">
                {label}
              </span>
            </button>
            {saved > 0 && (
              <NavLink
                href="/markets?sort=watchlist"
                aria-label={`${saved} saved markets`}
                className="control hidden gap-1 text-xs text-muted-foreground md:inline-flex"
              >
                <Star className="h-4 w-4" />
                {saved}
              </NavLink>
            )}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <button
              ref={trigger}
              aria-label="Explore Predpulse"
              aria-expanded={explore || sheet?.type === "menu"}
              aria-controls="explore-navigation"
              className="control gap-2 rounded-lg px-2"
              onClick={() => {
                onboard();
                if (window.matchMedia("(min-width: 768px)").matches)
                  setExplore(!explore);
                else open({ type: "menu" });
              }}
            >
              <LayoutGrid className="hidden h-5 w-5 md:block" />
              <Menu className="h-5 w-5 md:hidden" />
              <span className="hidden text-xs xl:inline">Explore</span>
            </button>
          </div>
        </div>
        {explore && (
          <div
            ref={region}
            id="explore-navigation"
            role="region"
            aria-label="Explore navigation"
            className="absolute inset-x-0 top-full mx-auto hidden max-w-screen-xl rounded-b-2xl border border-t-0 border-border bg-background p-6 shadow-xl motion-safe:animate-[page-in_150ms_ease-out] md:block"
          >
            <ExplorePanel
              newVisitor={newVisitor}
              onNavigate={() => setExplore(false)}
            />
          </div>
        )}
      </header>
      <Sheet
        open={sheet?.type === "menu"}
        onClose={close}
        title="Explore Predpulse"
        onFocusReturn={focusReturn}
      >
        <div id="explore-navigation">
          <ExplorePanel mobile newVisitor={newVisitor} />
        </div>
      </Sheet>
    </>
  );
}
