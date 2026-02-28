"use client";

import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import type { SortMode } from "@/lib/types";

interface Tab {
  id: SortMode;
  label: string;
  shortLabel: string;
  icon?: React.ReactNode;
}

const TABS: Tab[] = [
  { id: "movers",    label: "Biggest Movers",  shortLabel: "Movers" },
  { id: "movers1h",  label: "1h Movers",       shortLabel: "1h" },
  { id: "gainers",   label: "Top Gainers",     shortLabel: "Gainers" },
  { id: "losers",    label: "Top Losers",      shortLabel: "Losers" },
  { id: "liquidity", label: "Most Liquid",     shortLabel: "Liquid" },
  { id: "volume",    label: "Highest Volume",  shortLabel: "Volume" },
  { id: "new",       label: "New Markets",     shortLabel: "New" },
  {
    id: "watchlist",
    label: "Watchlist",
    shortLabel: "Saved",
    icon: <Star className="w-3 h-3" />,
  },
];

interface SortTabsProps {
  active: SortMode;
  onChange: (sort: SortMode) => void;
  watchlistCount?: number;
}

export default function SortTabs({ active, onChange, watchlistCount }: SortTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sort markets by"
      className="flex gap-1.5 overflow-x-auto scrollbar-none"
    >
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          variant={active === tab.id ? "default" : "secondary"}
          size="sm"
          onClick={() => onChange(tab.id)}
          className="rounded-full shrink-0 gap-1"
        >
          {tab.icon}
          <span className="sm:hidden">{tab.shortLabel}</span>
          <span className="hidden sm:inline">{tab.label}</span>
          {tab.id === "watchlist" && watchlistCount !== undefined && watchlistCount > 0 && (
            <span className="ml-0.5 text-[10px] opacity-70">{watchlistCount}</span>
          )}
        </Button>
      ))}
    </div>
  );
}
