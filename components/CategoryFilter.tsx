"use client";

import {
  Globe2,
  Landmark,
  Bitcoin,
  Trophy,
  Clapperboard,
  TrendingUp,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "all",           label: "All",           icon: Globe2 },
  { value: "Politics",      label: "Politics",       icon: Landmark },
  { value: "Crypto",        label: "Crypto",         icon: Bitcoin },
  { value: "Sports",        label: "Sports",         icon: Trophy },
  { value: "Entertainment", label: "Entertainment",  icon: Clapperboard },
  { value: "Economics",     label: "Economics",      icon: TrendingUp },
  { value: "Science",       label: "Science",        icon: FlaskConical },
  { value: "Pop Culture",   label: "Pop Culture",    icon: Sparkles },
] as const;

interface CategoryFilterProps {
  active: string;
  onChange: (category: string) => void;
}

export default function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div data-carousel className="flex gap-3 overflow-x-auto scrollbar-none" aria-label="Filter by category" role="group">
      {CATEGORIES.map(({ value, label, icon: Icon }) => {
        const isActive = active === value;
        return (
          <Button
            key={value}
            variant={isActive ? "outline" : "ghost"}
            size="sm"
            title={label}
            aria-label={label}
            onClick={() => onChange(value)}
            className={`rounded-full h-11 w-11 p-0 shrink-0 ${
              isActive ? "border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
