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
import { RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, List, Settings2, X } from "lucide-react";
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
  const [cogOpen, setCogOpen] = useState(false);
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

  // Derive stable token ID lists for WebSocket subscriptions per source
  const tokenIds = useMemo(
    () => markets.filter((m) => m.source !== "kalshi").map((m) => m.clobTokenId).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markets.filter((m) => m.source !== "kalshi").map((m) => m.clobTokenId).join(",")]
  );

  const kalshiTickers = useMemo(
    () => markets.filter((m) => m.source === "kalshi").map((m) => m.id).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markets.filter((m) => m.source === "kalshi").map((m) => m.id).join(",")]
  );

  const { livePrices, status: wsStatus } = useMarketSocket(tokenIds, kalshiTickers);

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
    <div className="flex flex-col">
      {/* Controls bar — full-viewport sticky strip, flush below the h-12 header */}
      <div className="sticky top-12 z-10 bg-background/95 backdrop-blur-sm border-b border-border"
           style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", paddingLeft: "max(1rem, calc(50vw - 50%))", paddingRight: "max(1rem, calc(50vw - 50%))" }}>
        {/* Desktop: all controls in one scrollable row */}
        <div className="hidden md:flex items-center h-11 gap-0 overflow-x-auto scrollbar-none max-w-screen-2xl mx-auto">
          <SortTabs
            active={sort}
            onChange={handleSortChange}
            watchlistCount={watchlistIds.length}
          />
          <div className="shrink-0 w-px h-4 bg-border mx-2" />
          <CategoryFilter active={category} onChange={handleCategoryChange} />
          <div className="ml-auto shrink-0 flex items-center gap-2 pl-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  wsStatus === "open"
                    ? "bg-emerald-500 animate-pulse"
                    : wsStatus === "connecting"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-muted-foreground/40"
                }`}
              />
              <span className="whitespace-nowrap">
                {wsStatus === "open" ? "Live" : wsStatus === "connecting" ? "Connecting…" : fetchedAtText ? `Updated ${fetchedAtText}` : "Polling"}
              </span>
            </span>
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                className={`h-7 px-2 flex items-center transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                aria-label="Heatmap view"
                className={`h-7 px-2 flex items-center border-l border-border transition-colors ${viewMode === "heatmap" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => mutate()}
              disabled={isValidating}
              aria-label="Refresh"
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile: sort tabs + cog button */}
        <div className="flex md:hidden items-center h-11 gap-0">
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
            <SortTabs
              active={sort}
              onChange={handleSortChange}
              watchlistCount={watchlistIds.length}
            />
          </div>
          <div className="shrink-0 flex items-center gap-1.5 pl-2">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                wsStatus === "open" ? "bg-emerald-500 animate-pulse" : wsStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
            <button
              onClick={() => setCogOpen(true)}
              aria-label="Open settings"
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cog drawer — slide-up bottom sheet */}
      {cogOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setCogOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-2xl p-5 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between">
              <div className="w-8 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters &amp; View</span>
              <button
                onClick={() => setCogOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category filter */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Category</p>
              <CategoryFilter active={category} onChange={(c) => { handleCategoryChange(c); setCogOpen(false); }} />
            </div>

            {/* View mode */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">View</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setViewMode("table"); setCogOpen(false); }}
                  className={`flex items-center gap-2 h-8 px-3 rounded-md border text-xs transition-colors ${
                    viewMode === "table"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => { setViewMode("heatmap"); setCogOpen(false); }}
                  className={`flex items-center gap-2 h-8 px-3 rounded-md border text-xs transition-colors ${
                    viewMode === "heatmap"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Heatmap
                </button>
              </div>
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { mutate(); setCogOpen(false); }}
              disabled={isValidating}
              className="gap-1.5 h-8 text-xs w-full"
            >
              <RefreshCw className={`w-3 h-3 ${isValidating ? "animate-spin" : ""}`} />
              {isValidating ? "Fetching…" : "Refresh data"}
            </Button>
          </div>
        </div>
      )}

      {/* Market count + error — slim row between controls and table */}
      <div className="flex items-center justify-between pt-2 pb-1 px-0.5 min-h-[1.5rem]">
        <p className="text-xs text-muted-foreground">
          {emptyWatchlist ? (
            "Star markets to build your watchlist"
          ) : totalMarkets > 0 ? (
            <>
              {offset + 1}–{Math.min(offset + PAGE_LIMIT, totalMarkets)}{" "}
              <span className="text-muted-foreground/60">of {totalMarkets.toLocaleString()}</span>
            </>
          ) : isLoading ? null : (
            "No markets found"
          )}
        </p>
        {isValidating && wsStatus !== "open" && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
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
                  livePrice={livePrices.get(
                    market.source === "kalshi" ? market.id : market.clobTokenId
                  )}
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

      {/* Pagination — only in table view when there are multiple pages */}
      {viewMode === "table" && (hasPrev || hasMore) && (
        <div className="flex items-center justify-between pt-1">
          <div>
            {hasPrev && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
            )}
          </div>
          <div>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOffset(offset + PAGE_LIMIT)}
                className="gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
