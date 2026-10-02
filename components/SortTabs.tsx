"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import type { SortMode } from "@/lib/types";

interface Tab {
  id: SortMode;
  label: string;
  iconOnly?: boolean;
}

const TABS: Tab[] = [
  { id: "watchlist",  label: "Watchlist", iconOnly: true },
  { id: "movers",    label: "Movers" },
  { id: "movers1h",  label: "1h Movers" },
  { id: "gainers",   label: "Gainers" },
  { id: "losers",    label: "Losers" },
  { id: "liquidity", label: "Liquid" },
  { id: "volume",    label: "Volume" },
  { id: "new",       label: "New" },
];

interface SortTabsProps {
  active: SortMode;
  onChange: (sort: SortMode) => void;
  watchlistCount?: number;
}

export default function SortTabs({ active, onChange, watchlistCount }: SortTabsProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { root.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [active]);
  return (
    <div
      ref={root}
      data-carousel
      role="tablist"
      aria-label="Sort markets by"
      className="flex gap-1.5 overflow-x-auto scrollbar-none"
    >
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          aria-label={tab.iconOnly ? tab.label : undefined}
          variant={active === tab.id ? "default" : "secondary"}
          size="sm"
          onClick={() => onChange(tab.id)}
          className={`rounded-full h-11 min-w-11 shrink-0 gap-1 ${tab.iconOnly ? "px-2" : ""}`}
        >
          {tab.iconOnly ? (
            <>
              <Star className={`w-3.5 h-3.5 ${active === tab.id ? "" : "text-muted-foreground"} ${active === tab.id && watchlistCount ? "fill-current" : ""}`} />
              {watchlistCount !== undefined && watchlistCount > 0 && (
                <span className="text-xs opacity-70">{watchlistCount}</span>
              )}
            </>
          ) : (
            tab.label
          )}
        </Button>
      ))}
    </div>
  );
}
