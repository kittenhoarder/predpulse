"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import type { MarketsApiResponse, SortMode } from "@/lib/types";
import SortTabs from "./SortTabs";
import CategoryFilter from "./CategoryFilter";
import MarketRow from "./MarketRow";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

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

  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, {
    fallbackData:
      offset === 0 && sort === initialSort && category === initialCategory
        ? initialData
        : undefined,
    refreshInterval: 0,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const handleSortChange = useCallback((newSort: SortMode) => {
    setSort(newSort);
    setOffset(0);
  }, []);

  const handleCategoryChange = useCallback((newCat: string) => {
    setCategory(newCat);
    setOffset(0);
  }, []);

  const markets = data?.markets ?? [];
  const totalMarkets = data?.totalMarkets ?? 0;
  const hasMore = offset + PAGE_LIMIT < totalMarkets;
  const hasPrev = offset > 0;

  const fetchedAtText = data?.cachedAt
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {totalMarkets > 0 ? (
            <>
              Showing {offset + 1}–{Math.min(offset + PAGE_LIMIT, totalMarkets)}{" "}
              of {totalMarkets.toLocaleString()} markets
            </>
          ) : isLoading ? (
            "Loading…"
          ) : (
            "No markets found"
          )}
        </p>

        <div className="flex items-center gap-3">
          {fetchedAtText && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Fetched {fetchedAtText}
              {isValidating && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </p>
          )}

          {/* Triggers a fresh Gamma API fetch via the API route */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isValidating ? "animate-spin" : ""}`} />
            {isValidating ? "Fetching…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          Failed to load markets. Try refreshing.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-xs">#</TableHead>
              <TableHead className="text-xs">Market</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Yes Price</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">24h Move</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">24h Volume</TableHead>
              <TableHead className="text-xs text-right">Liquidity</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableHead key={j} className="py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableHead>
                  ))}
                </TableRow>
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
              <TableRow>
                <TableHead
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground text-sm font-normal"
                >
                  No markets found for this filter.
                </TableHead>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset(offset + PAGE_LIMIT)}
            className="gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
