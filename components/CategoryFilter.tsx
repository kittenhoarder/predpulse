"use client";

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

export default function CategoryFilter({
  active,
  onChange,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Filter by category">
      {CATEGORIES.map((cat) => {
        const value = cat === "All" ? "all" : cat;
        const isActive =
          active === value || (active === "all" && cat === "All");
        return (
          <button
            key={cat}
            onClick={() => onChange(value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              isActive
                ? "bg-gray-600 text-white"
                : "bg-gray-800/60 text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
