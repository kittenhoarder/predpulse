"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Settings2,
  Droplets,
} from "lucide-react";
import type { MarketsApiResponse, SortMode } from "@/lib/types";
import { getWatchlist, WATCHLIST_CHANGE } from "@/lib/watchlist";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useSheets } from "./SheetProvider";
import { GuideButton } from "./GuidePanel";
import Sheet from "./ui/sheet";
import SortTabs from "./SortTabs";
import CategoryFilter from "./CategoryFilter";
import MarketRow from "./MarketRow";
import MarketListItem from "./MarketListItem";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
const HeatmapView = dynamic(() => import("./HeatmapView"), {
  loading: () => (
    <p role="status" className="min-h-48 py-8 text-sm text-muted-foreground">
      Loading heatmap…
    </p>
  ),
});
type Source = "all" | "polymarket" | "kalshi" | "manifold";
const DOUBLE =
  process.env.NEXT_PUBLIC_MARKETS_DOUBLE_PAGE_ENABLED !== "0" &&
  process.env.NEXT_PUBLIC_MARKETS_DOUBLE_PAGE_ENABLED !== "false";
const PAGE = DOUBLE ? 25 : 100;
async function fetcher(url: string): Promise<MarketsApiResponse> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function SourceToggle({
  value,
  change,
}: {
  value: Source;
  change: (source: Source) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-3"
      role="group"
      aria-label="Venue filter"
    >
      {(["all", "polymarket", "kalshi", "manifold"] as const).map((source) => (
        <button
          key={source}
          onClick={() => change(source)}
          aria-pressed={source === value}
          className={`min-h-11 rounded-full px-3 text-xs capitalize ${source === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          {source}
        </button>
      ))}
    </div>
  );
}
export default function MarketTable({
  initialSort = "movers",
  initialCategory = "all",
  initialData,
}: {
  initialSort?: SortMode;
  initialCategory?: string;
  initialData?: MarketsApiResponse;
}) {
  const [sort, setSort] = useState<SortMode>(initialSort),
    [category, setCategory] = useState(initialCategory),
    [source, setSource] = useState<Source>("all"),
    [page, setPage] = useState(0);
  const [view, setView] = useState<"table" | "heatmap">("table"),
    [hideSmall, setHideSmall] = useState(true),
    [watchlist, setWatchlist] = useState<string[]>([]);
  const sheets = useSheets(),
    mobile = useMediaQuery("(max-width: 767px)");
  const refreshWatchlist = useCallback(
    () => setWatchlist(Array.from(getWatchlist())),
    [],
  );
  useEffect(() => {
    refreshWatchlist();
    try {
      const stored = localStorage.getItem("hideSmall");
      if (stored !== null) setHideSmall(stored !== "false");
    } catch {
      /* Private storage */
    }
    window.addEventListener(WATCHLIST_CHANGE, refreshWatchlist);
    window.addEventListener("storage", refreshWatchlist);
    return () => {
      window.removeEventListener(WATCHLIST_CHANGE, refreshWatchlist);
      window.removeEventListener("storage", refreshWatchlist);
    };
  }, [refreshWatchlist]);
  const offset = DOUBLE ? Math.floor(page / 2) * 50 : page * 100;
  const query = new URLSearchParams({
    sort,
    category,
    offset: String(offset),
    limit: DOUBLE ? "50" : "100",
  });
  if (source !== "all") query.set("source", source);
  if (!hideSmall) query.set("hideSmall", "false");
  if (sort === "watchlist" && watchlist.length)
    query.set("watchlist", watchlist.join(","));
  const useInitial =
    DOUBLE &&
    sort === "movers" &&
    category === "all" &&
    source === "all" &&
    hideSmall &&
    offset === 0;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `/api/markets?${query}`,
    fetcher,
    {
      fallbackData: useInitial ? initialData : undefined,
      revalidateOnMount: !useInitial || !initialData,
      revalidateIfStale: !useInitial || !initialData,
      refreshInterval: 300_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );
  const markets = useMemo(
    () =>
      sort === "watchlist" && !watchlist.length
        ? []
        : DOUBLE
          ? (data?.markets ?? []).slice(
              (page % 2) * PAGE,
              ((page % 2) + 1) * PAGE,
            )
          : (data?.markets ?? []),
    [data?.markets, page, sort, watchlist.length],
  );
  const total =
    sort === "watchlist" && !watchlist.length ? 0 : (data?.totalMarkets ?? 0);
  const changeSort = (value: SortMode) => {
    setSort(value);
    setPage(0);
  };
  const changeCategory = (value: string) => {
    setCategory(value);
    setPage(0);
  };
  const changeSource = (value: Source) => {
    setSource(value);
    setPage(0);
  };
  const liquid = () => {
    setHideSmall((value) => {
      try {
        localStorage.setItem("hideSmall", String(!value));
      } catch {
        /* Optional */
      }
      return !value;
    });
    setPage(0);
  };
  const viewControls = (
    <div className="flex gap-3" role="group" aria-label="Market view">
      {(["table", "heatmap"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setView(mode)}
          aria-pressed={view === mode}
          aria-label={mode === "table" ? "List view" : "Heatmap view"}
          className={`control rounded-full px-3 ${view === mode ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          {mode === "table" ? (
            <List className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div data-carousel className="min-w-0 flex-1 overflow-x-auto">
          <SortTabs
            active={sort}
            onChange={changeSort}
            watchlistCount={watchlist.length}
          />
        </div>
        <button
          className="control shrink-0 rounded-full md:hidden"
          aria-label="Open market filters"
          onClick={() => sheets.open({ type: "filters" })}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
      <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
        <div className="flex flex-wrap items-center gap-4">
          <SourceToggle value={source} change={changeSource} />
          <CategoryFilter active={category} onChange={changeCategory} />
          <button
            className={`control rounded-full ${hideSmall ? "text-primary" : "text-muted-foreground"}`}
            aria-label="Liquid markets only"
            aria-pressed={hideSmall}
            onClick={liquid}
          >
            <Droplets className="h-4 w-4" />
          </button>
          <GuideButton id="markets" label="About market filters" />
        </div>
        <div className="flex gap-3">
          {viewControls}
          <button
            className="control rounded-full"
            aria-label="Refresh markets"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            <RefreshCw
              className={`h-4 w-4 ${isValidating ? "motion-safe:animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
      <Sheet
        open={sheets.sheet?.type === "filters"}
        onClose={sheets.close}
        title="Market filters"
        onFocusReturn={sheets.focusReturn}
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-medium">Category</h3>
            <CategoryFilter active={category} onChange={changeCategory} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-medium">Venue</h3>
            <SourceToggle value={source} change={changeSource} />
          </section>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={liquid}
              aria-pressed={hideSmall}
              className={`min-h-11 rounded-full px-4 text-sm ${hideSmall ? "bg-primary/10 text-primary" : "bg-muted"}`}
            >
              Liquid markets only {hideSmall ? "✓" : ""}
            </button>
            <GuideButton id="markets" label="About market filters" />
          </div>
          <section>
            <h3 className="mb-3 text-sm font-medium">View</h3>
            {viewControls}
          </section>
          <button
            className="min-h-11 w-full rounded-xl border border-border text-sm"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            Refresh markets
          </button>
        </div>
      </Sheet>
      <p className="text-xs text-muted-foreground">
        {total
          ? `${page * PAGE + 1}–${Math.min((page + 1) * PAGE, total)} of ${total.toLocaleString()}`
          : sort === "watchlist"
            ? "Star markets to build your saved list"
            : isLoading
              ? "Loading markets…"
              : "No markets found"}
      </p>
      {error && (
        <p
          role="status"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          Market snapshot unavailable. Try refreshing.
        </p>
      )}
      {view === "heatmap" ? (
        <HeatmapView markets={markets} />
      ) : mobile ? (
        <div
          className="overflow-hidden rounded-2xl border border-border"
          data-market-rows
        >
          {isLoading && !markets.length
            ? [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-muted/30 motion-safe:animate-pulse"
                />
              ))
            : markets.map((market) => (
                <MarketListItem
                  key={`${market.source}:${market.id}`}
                  market={market}
                />
              ))}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-border"
          data-market-rows
        >
          <Table className="table-fixed min-w-[640px]">
            <colgroup>
              <col className="w-14" />
              <col />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-44" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Market</TableHead>
                <TableHead className="text-right">Odds</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Liquidity / OI</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !markets.length
                ? [0, 1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <div className="h-16 rounded-lg bg-muted/30 motion-safe:animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                : markets.map((market, i) => (
                    <MarketRow
                      key={`${market.source}:${market.id}`}
                      market={market}
                      rank={page * PAGE + i + 1}
                      onWatchlistChange={refreshWatchlist}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!isLoading && !markets.length && (
        <p className="py-5 text-sm text-muted-foreground">
          {sort === "watchlist"
            ? "No saved markets match this snapshot and filter."
            : "No markets match this filter."}
        </p>
      )}
      {view === "table" && (page > 0 || (page + 1) * PAGE < total) && (
        <div className="flex justify-between gap-4">
          <button
            className="control rounded-full px-3 text-xs disabled:opacity-40"
            disabled={!page}
            onClick={() => setPage(Math.max(0, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            className="control rounded-full px-3 text-xs disabled:opacity-40"
            disabled={(page + 1) * PAGE >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
