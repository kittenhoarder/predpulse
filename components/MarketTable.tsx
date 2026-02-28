"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import type { MarketsApiResponse, SortMode } from "@/lib/types";
import { getWatchlist } from "@/lib/watchlist";
import { useMarketSocket } from "@/lib/hooks/useMarketSocket";
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
import { RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import HeatmapView from "./HeatmapView";

const PAGE_LIMIT = 100;

async function fetcher(url: string): Promise<MarketsApiResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildUrl(
  sort: SortMode,
  category: string,
  offset: number,
  watchlistIds: string[]
): string {
  const params = new URLSearchParams({ sort, category, offset: String(offset) });
  if (sort === "watchlist" && watchlistIds.length > 0) {
    params.set("watchlist", watchlistIds.join(","));
  }
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
  const [viewMode, setViewMode] = useState<"table" | "heatmap">("table");
  // Watchlist IDs read from localStorage; refreshed when user stars/unstars
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);

  useEffect(() => {
    setWatchlistIds(Array.from(getWatchlist()));
  }, []);

  const refreshWatchlist = useCallback(() => {
    setWatchlistIds(Array.from(getWatchlist()));
  }, []);

  const url = buildUrl(sort, category, offset, watchlistIds);

  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, {
    fallbackData:
      offset === 0 && sort === initialSort && category === initialCategory
        ? initialData
        : undefined,
    // WebSocket handles sub-minute freshness; SWR does full sorted-list refresh every 60s
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const markets = data?.markets ?? [];

  // Derive stable token ID list for WebSocket subscription
  const tokenIds = useMemo(
    () => markets.map((m) => m.clobTokenId).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markets.map((m) => m.clobTokenId).join(",")]
  );

  const { livePrices, status: wsStatus } = useMarketSocket(tokenIds);

  const handleSortChange = useCallback((newSort: SortMode) => {
    setSort(newSort);
    setOffset(0);
  }, []);

  const handleCategoryChange = useCallback((newCat: string) => {
    setCategory(newCat);
    setOffset(0);
  }, []);

  const totalMarkets = data?.totalMarkets ?? 0;
  const hasMore = offset + PAGE_LIMIT < totalMarkets;
  const hasPrev = offset > 0;

  const fetchedAtText = data?.cachedAt
    ? formatDistanceToNow(new Date(data.cachedAt), { addSuffix: true })
    : null;

  const emptyWatchlist = sort === "watchlist" && watchlistIds.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <SortTabs
          active={sort}
          onChange={handleSortChange}
          watchlistCount={watchlistIds.length}
        />
        <CategoryFilter active={category} onChange={handleCategoryChange} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {emptyWatchlist ? (
            "Star markets to build your watchlist"
          ) : totalMarkets > 0 ? (
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

        <div className="flex items-center gap-2">
          {/* WebSocket live indicator */}
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                wsStatus === "open"
                  ? "bg-emerald-500 animate-pulse"
                  : wsStatus === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-muted-foreground/40"
              }`}
            />
            {wsStatus === "open"
              ? "Live"
              : wsStatus === "connecting"
                ? "Connecting…"
                : fetchedAtText
                  ? `Fetched ${fetchedAtText}`
                  : "Polling"}
            {isValidating && wsStatus !== "open" && (
              <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </span>

          {/* View mode toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              aria-label="Table view"
              className={`h-7 px-2 flex items-center transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              aria-label="Heatmap view"
              className={`h-7 px-2 flex items-center border-l border-border transition-colors ${
                viewMode === "heatmap"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

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

      {/* Heatmap view */}
      {viewMode === "heatmap" && !isLoading && (
        <HeatmapView markets={markets} />
      )}

      {/* Table — min-w ensures all columns are always present; overflow-auto on the Table wrapper enables horizontal scroll on mobile */}
      {viewMode === "table" && <div className="rounded-xl border border-border overflow-hidden">
        {/* table-fixed prevents columns reflowing when expansion rows are inserted */}
        <Table className="table-fixed min-w-[640px]">
          <colgroup>
            <col className="w-10" />   {/* # */}
            <col />                    {/* Market — takes remaining width */}
            <col className="w-24" />   {/* Probability */}
            <col className="w-24" />   {/* 24h Change */}
            <col className="w-24" />   {/* 24h Volume */}
            <col className="w-24" />   {/* Liquidity */}
            <col className="w-16" />   {/* Trade */}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">Market</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Probability</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">24h Change</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">24h Volume</TableHead>
              <TableHead className="text-xs text-right">Liquidity</TableHead>
              <TableHead />
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
                  onWatchlistChange={refreshWatchlist}
                  livePrice={livePrices.get(market.clobTokenId)}
                />
              ))}

            {!isLoading && markets.length === 0 && !error && (
              <TableRow>
                <TableHead
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground text-sm font-normal"
                >
                  {emptyWatchlist
                    ? "No saved markets yet — star a market to add it to your watchlist."
                    : "No markets found for this filter."}
                </TableHead>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>}

      {/* Pagination — only in table view */}
      {viewMode === "table" && (hasPrev || hasMore) && (
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
