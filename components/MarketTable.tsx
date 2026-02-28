"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import type { MarketsApiResponse, SortMode } from "@/lib/types";
import SortTabs from "./SortTabs";
import CategoryFilter from "./CategoryFilter";
import MarketRow from "./MarketRow";

const PAGE_LIMIT = 100;

async function fetcher(url: string): Promise<MarketsApiResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildUrl(sort: SortMode, category: string, offset: number): string {
  const params = new URLSearchParams({ sort, category, offset: String(offset) });
  return `/api/markets?${params.toString()}`;
}

interface MarketTableProps {
  initialSort?: SortMode;
  initialCategory?: string;
  // Pre-fetched data from the Server Component for instant first paint
  initialData?: MarketsApiResponse;
}

export default function MarketTable({
  initialSort = "movers",
  initialCategory = "all",
  initialData,
}: MarketTableProps) {
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [category, setCategory] = useState(initialCategory);
  const [offset, setOffset] = useState(0);

  const url = buildUrl(sort, category, offset);

  const { data, error, isLoading, isValidating } = useSWR(url, fetcher, {
    fallbackData: offset === 0 && sort === initialSort ? initialData : undefined,
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const handleSortChange = useCallback((newSort: SortMode) => {
    setSort(newSort);
    setOffset(0);
  }, []);

  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategory(newCategory);
    setOffset(0);
  }, []);

  const markets = data?.markets ?? [];
  const totalMarkets = data?.totalMarkets ?? 0;
  const hasMore = offset + PAGE_LIMIT < totalMarkets;
  const hasPrev = offset > 0;

  const lastUpdatedText = data?.cachedAt
    ? formatDistanceToNow(new Date(data.cachedAt), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <SortTabs active={sort} onChange={handleSortChange} />
        <CategoryFilter active={category} onChange={handleCategoryChange} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {totalMarkets > 0 ? (
            <>
              Showing {offset + 1}–{Math.min(offset + PAGE_LIMIT, totalMarkets)}{" "}
              of {totalMarkets} markets
            </>
          ) : (
            isLoading ? "Loading…" : "No markets found"
          )}
        </span>
        <span className="flex items-center gap-2">
          {isValidating && !isLoading && (
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          )}
          {lastUpdatedText && (
            <span>
              {data?.fromCache ? "Cached" : "Live"} · Updated {lastUpdatedText}
            </span>
          )}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-sm">
          Failed to load markets. Retrying automatically…
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/60">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                Yes Price
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                24h Move
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                24h Volume
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                Liquidity
              </th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/60">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              markets.map((market, idx) => (
                <MarketRow
                  key={market.id}
                  market={market}
                  rank={offset + idx + 1}
                />
              ))}
            {!isLoading && markets.length === 0 && !error && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-500 text-sm"
                >
                  No markets found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <button
            disabled={!hasMore}
            onClick={() => setOffset(offset + PAGE_LIMIT)}
            className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
