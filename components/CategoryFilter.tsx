"use client";

import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "All",
  "Politics",
  "Crypto",
  "Sports",
  "Entertainment",
  "Economics",
  "Science",
  "Pop Culture",
];

interface CategoryFilterProps {
  active: string;
  onChange: (category: string) => void;
}

export default function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none" aria-label="Filter by category">
      {CATEGORIES.map((cat) => {
        const value = cat === "All" ? "all" : cat;
        const isActive = active === value;
        return (
          <Button
            key={cat}
            variant={isActive ? "outline" : "ghost"}
            size="sm"
            onClick={() => onChange(value)}
            className={`rounded-full text-xs h-7 shrink-0 ${
              isActive
                ? "border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {cat}
          </Button>
        );
      })}
    </div>
  );
}
