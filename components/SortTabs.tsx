"use client";

import type { SortMode } from "@/lib/types";

interface Tab {
  id: SortMode;
  label: string;
}

const TABS: Tab[] = [
  { id: "movers", label: "Biggest Movers" },
  { id: "gainers", label: "Top Gainers" },
  { id: "losers", label: "Top Losers" },
  { id: "liquidity", label: "Most Liquid" },
  { id: "volume", label: "Highest Volume" },
  { id: "new", label: "New Markets" },
];

interface SortTabsProps {
  active: SortMode;
  onChange: (sort: SortMode) => void;
}

export default function SortTabs({ active, onChange }: SortTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sort markets by"
      className="flex flex-wrap gap-2"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            active === tab.id
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
