"use client";
import { GUIDE, THESIS } from "@/lib/guide";
import { EXPLORE, PILLARS, fedStat, movesStat } from "@/lib/nav";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { NavLink, useSheets } from "./SheetProvider";
import NavIcon from "./NavIcon";
import { ThemeToggle } from "./ThemeToggle";
import { usePathname } from "next/navigation";

export default function ExplorePanel({
  mobile = false,
  compact = false,
  newVisitor = false,
  onNavigate,
}: {
  mobile?: boolean;
  compact?: boolean;
  newVisitor?: boolean;
  onNavigate?: () => void;
}) {
  const { data, now } = useBootstrap(),
    { open } = useSheets(),
    pathname = usePathname();
  const stats = {
    moves: movesStat(data, now),
    "policy-balance": fedStat(data, now),
  };
  return (
    <div className={mobile ? "space-y-6" : "space-y-5"}>
      {mobile && (
        <nav aria-label="Pillars" className="grid grid-cols-5 gap-1">
          {PILLARS.map((p) => (
            <NavLink
              href={p.href}
              key={p.href}
              aria-current={pathname === p.href ? "page" : undefined}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-2 rounded-xl text-xs ${pathname === p.href ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-muted"}`}
            >
              <NavIcon name={p.icon} className="h-4 w-4" />
              <span>{p.name}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <div
        className={
          mobile
            ? "space-y-1"
            : compact
              ? "grid grid-cols-2 gap-3 md:grid-cols-3"
              : "grid grid-cols-3 gap-8"
        }
      >
        {(compact || mobile ? [null] : ["follow", "measure", "browse"]).map(
          (group) => (
            <div
              key={group ?? "all"}
              className={compact ? "contents" : "space-y-2"}
            >
              {group && (
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group}
                </p>
              )}
              {EXPLORE.filter(
                (item) => !group || GUIDE[item.id].pillar === group,
              ).map((item) => (
                <NavLink
                  key={item.id}
                  href={item.href}
                  prefetch={
                    item.href === "/moves" ||
                    item.href === "/outlooks" ||
                    item.href === "/markets"
                  }
                  onClick={onNavigate}
                  className={`group flex min-h-12 items-start gap-3 rounded-xl transition-colors hover:bg-muted/60 active:bg-muted ${compact ? "border border-border/70 p-4 md:p-5" : "p-2"}`}
                >
                  <NavIcon
                    name={item.icon}
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{GUIDE[item.id].name}</p>
                    <p
                      className={`${compact ? "hidden md:block" : ""} mt-1 text-xs text-muted-foreground`}
                    >
                      {GUIDE[item.id].hook}
                    </p>
                    {!compact &&
                      item.id in stats &&
                      stats[item.id as keyof typeof stats] && (
                        <p className="mt-1 text-xs tabular-nums text-primary">
                          {stats[item.id as keyof typeof stats]}
                        </p>
                      )}
                  </div>
                </NavLink>
              ))}
            </div>
          ),
        )}
      </div>
      {!compact && (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Understand
            </span>
            <button
              className="inline-flex min-h-11 items-center gap-2 text-left hover:text-primary"
              onClick={() => {
                onNavigate?.();
                open({ type: "guide", id: "thesis" });
              }}
            >
              ⓘ How Predpulse works{" "}
              {newVisitor && (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  New here?
                </span>
              )}
            </button>
            <NavLink
              href="/research"
              prefetch={false}
              onClick={onNavigate}
              className="inline-flex min-h-11 items-center"
            >
              ⛨ Evidence &amp; history
            </NavLink>
            {mobile && <ThemeToggle />}
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {THESIS}
          </p>
        </div>
      )}
    </div>
  );
}
