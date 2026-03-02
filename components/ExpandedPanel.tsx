"use client";

import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow, differenceInDays, parseISO, format, parse } from "date-fns";
import type {
  ProcessedMarket,
  GdeltArticle,
  MetaculusQuestion,
  FredObservation,
  CoinGeckoPricePoint,
} from "@/lib/types";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatChange, marketTradeUrl } from "@/lib/format";
import { extractKeywords } from "@/lib/gdelt";
import { fetchFredSeries, getFredSeriesForSlugs } from "@/lib/fred";
import {
  fetchCryptoPriceHistory,
  detectCoinFromQuestion,
  coinLabel,
} from "@/lib/coingecko";
import { ToneBadge } from "@/lib/tone";

// ---------------------------------------------------------------------------
// CLOB price history fetch
// ---------------------------------------------------------------------------

interface PricePoint {
  t: number; // unix timestamp
  p: number; // price 0–1
}

interface ChartPoint {
  date: string;
  prob: number; // 0–100
}

async function fetchPriceHistory(tokenId: string): Promise<ChartPoint[]> {
  // interval=max avoids the strict startTs/endTs range limit; fidelity=10 gives ~300 points
  const url =
    `https://clob.polymarket.com/prices-history` +
    `?market=${tokenId}&interval=max&fidelity=10`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CLOB ${res.status}`);
  const json: { history?: PricePoint[]; error?: string } = await res.json();
  if (json.error) throw new Error(json.error);

  return (json.history ?? []).map((pt) => ({
    date: format(new Date(pt.t * 1000), "MMM d"),
    prob: Math.round(pt.p * 10000) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Recent trades fetch (data-api.polymarket.com)
// ---------------------------------------------------------------------------

interface RawTrade {
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  pseudonym: string;
  outcome: string;
  transactionHash: string;
}

interface RecentTrade {
  side: "BUY" | "SELL";
  sizeUsd: number;
  price: number;
  timestamp: number;
  pseudonym: string;
  outcome: string;
  txHash: string;
}

async function fetchRecentTrades(clobTokenId: string): Promise<RecentTrade[]> {
  const url = `https://data-api.polymarket.com/trades?market=${clobTokenId}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`trades ${res.status}`);
  const data: RawTrade[] = await res.json();
  return data.map((t) => ({
    side: t.side,
    sizeUsd: t.size * t.price,
    price: t.price,
    timestamp: t.timestamp,
    pseudonym: t.pseudonym || t.transactionHash.slice(0, 8),
    outcome: t.outcome,
    txHash: t.transactionHash,
  }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCellProps {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}

function StatCell({ label, value, highlight }: StatCellProps) {
  const color =
    highlight === "positive"
      ? "text-emerald-500"
      : highlight === "negative"
        ? "text-red-500"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

function changeHighlight(v: number): "positive" | "negative" | "neutral" {
  return v > 0 ? "positive" : v < 0 ? "negative" : "neutral";
}

// Custom tooltip for recharts — theme-aware
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart money card
// ---------------------------------------------------------------------------

interface SmartMoneyCardProps {
  topHolders: { address: string; shares: number; side: "YES" | "NO" }[];
  smartMoneyScore: number;
  openInterest?: number;
}

function SmartMoneyCard({ topHolders, smartMoneyScore, openInterest }: SmartMoneyCardProps) {
  const totalShares = topHolders.reduce((s, h) => s + h.shares, 0);
  const yesShares = topHolders.filter((h) => h.side === "YES").reduce((s, h) => s + h.shares, 0);
  const yesPct = totalShares > 0 ? Math.round((yesShares / totalShares) * 100) : 50;
  const noPct = 100 - yesPct;

  const scoreColor =
    smartMoneyScore >= 70 ? "text-amber-500"
    : smartMoneyScore >= 40 ? "text-foreground"
    : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-2.5">
      {/* YES/NO balance among top holders */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-emerald-500 w-8 text-right">{yesPct}%</span>
        <div className="flex-1 flex h-2 rounded-full overflow-hidden">
          <div className="bg-emerald-500/70 transition-all" style={{ width: `${yesPct}%` }} />
          <div className="bg-red-500/70 transition-all" style={{ width: `${noPct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-red-500 w-8">{noPct}%</span>
      </div>

      {/* Top holders list */}
      <div className="flex flex-col gap-0.5">
        {topHolders.slice(0, 5).map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-0.5">
            <span className="text-muted-foreground font-mono">
              {h.address.length > 10 ? `${h.address.slice(0, 6)}…${h.address.slice(-4)}` : h.address}
            </span>
            <div className="flex items-center gap-2">
              <span className={h.side === "YES" ? "text-emerald-500 font-medium" : "text-red-500 font-medium"}>
                {h.side}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {h.shares > 999 ? `${(h.shares / 1000).toFixed(1)}k` : h.shares.toFixed(0)} shares
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Score row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Concentration score: <span className={`font-semibold ${scoreColor}`}>{smartMoneyScore}</span>/100
        </span>
        {openInterest !== undefined && openInterest > 0 && (
          <span>
            OI: <span className="text-foreground font-medium">${(openInterest / 1000).toFixed(1)}k</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orderbook depth bar
// ---------------------------------------------------------------------------

interface OrderbookDepthBarProps {
  bids: [number, number][];
  asks: [number, number][];
  depthScore: number;
  mid: number;
}

function OrderbookDepthBar({ bids, asks, depthScore, mid }: OrderbookDepthBarProps) {
  // Build a combined 0–1 price axis with bid/ask quantities for a visual depth bar
  // We show the 10 best bid and ask levels, rendered as a two-sided horizontal bar
  const LEVELS = 10;
  const topBids = [...bids].sort((a, b) => b[0] - a[0]).slice(0, LEVELS);
  const topAsks = [...asks].sort((a, b) => a[0] - b[0]).slice(0, LEVELS);

  const maxBidQty = Math.max(...topBids.map((l) => l[1]), 1);
  const maxAskQty = Math.max(...topAsks.map((l) => l[1]), 1);
  const maxQty = Math.max(maxBidQty, maxAskQty);

  const bidFraction = topBids.reduce((s, l) => s + l[1], 0) /
    (topBids.reduce((s, l) => s + l[1], 0) + topAsks.reduce((s, l) => s + l[1], 0) || 1);

  const bidPct = Math.round(bidFraction * 100);
  const askPct = 100 - bidPct;

  const scoreColor =
    depthScore >= 60 ? "text-emerald-500" : depthScore <= 40 ? "text-red-500" : "text-foreground";

  return (
    <div className="flex flex-col gap-2">
      {/* Aggregate bid/ask bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-emerald-500 w-8 text-right">{bidPct}%</span>
        <div className="flex-1 flex h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500/70 transition-all"
            style={{ width: `${bidPct}%` }}
          />
          <div
            className="bg-red-500/70 transition-all"
            style={{ width: `${askPct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-red-500 w-8">{askPct}%</span>
      </div>

      {/* Per-level bars (bid left, ask right) */}
      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex flex-col gap-0.5">
          {topBids.map(([price, qty], i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
                {(price * 100).toFixed(0)}¢
              </span>
              <div className="flex-1 bg-muted rounded-sm h-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500/60"
                  style={{ width: `${(qty / maxQty) * 100}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground w-7">
                {qty > 999 ? `${(qty / 1000).toFixed(1)}k` : qty}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          {topAsks.map(([price, qty], i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
                {(price * 100).toFixed(0)}¢
              </span>
              <div className="flex-1 bg-muted rounded-sm h-1.5 overflow-hidden">
                <div
                  className="h-full bg-red-500/60"
                  style={{ width: `${(qty / maxQty) * 100}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground w-7">
                {qty > 999 ? `${(qty / 1000).toFixed(1)}k` : qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mid price + depth score */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Mid: <span className="text-foreground font-medium">{(mid * 100).toFixed(1)}¢</span></span>
        <span>Depth score: <span className={`font-semibold ${scoreColor}`}>{depthScore}</span>/100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context Intelligence Layer — sub-components
// ---------------------------------------------------------------------------

// Parse GDELT seendate "20240315T120000Z" → relative time string
function gdeltRelativeTime(seendate: string): string {
  try {
    const d = parse(seendate, "yyyyMMdd'T'HHmmss'Z'", new Date());
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function NewsCard({ article }: { article: GdeltArticle }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (summary !== null) return;

    // Prefer first-party summaries returned by our /api/news proxy (e.g. Guardian trailText).
    if (article.summary && article.summary.trim().length > 0) {
      setSummary(article.summary.trim());
      return;
    }

    // Never scrape The Guardian via third-party readability proxies — it is frequently blocked.
    if (article.domain === "theguardian.com") {
      setSummary("Summary unavailable.");
      return;
    }

    setSummaryLoading(true);
    fetch(`https://r.jina.ai/${article.url}`, { signal: AbortSignal.timeout(7000) })
      .then((r) => r.text())
      .then((text) => {
        const trimmed = text.trim();

        // Guard: readability proxies can return JSON error blobs (e.g. 451 SecurityCompromiseError).
        const looksLikeJson = trimmed.startsWith("{") && trimmed.includes("\"code\":");
        const isBlocked =
          trimmed.includes("SecurityCompromiseError") ||
          trimmed.includes("\"code\":451") ||
          trimmed.includes("\"status\":451");
        if (looksLikeJson || isBlocked) {
          setSummary("Summary unavailable.");
          return;
        }

        // Take the first ~400 chars as a prose summary
        const cleaned = trimmed
          .replace(/\s+/g, " ")
          .replace(/^(Title:|URL:|Published|Markdown Content:)[^\n]*/gm, "")
          .trim();
        setSummary(cleaned.slice(0, 400) + (cleaned.length > 400 ? "…" : ""));
      })
      .catch(() => setSummary("Summary unavailable."))
      .finally(() => setSummaryLoading(false));
  }

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-2">
        {/* Domain favicon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${article.domain}&sz=16`}
          alt=""
          className="w-4 h-4 mt-0.5 shrink-0 rounded-sm"
          loading="lazy"
        />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium leading-snug line-clamp-1 hover:text-primary transition-colors"
          >
            {article.title}
          </a>
          <div className="flex items-center gap-2 flex-wrap">
            <ToneBadge tone={article.tone} />
            <span className="text-[10px] text-muted-foreground">
              {article.domain}
            </span>
            {article.seendate && (
              <span className="text-[10px] text-muted-foreground">
                {gdeltRelativeTime(article.seendate)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleExpand}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
          aria-label={expanded ? "Collapse summary" : "Expand summary"}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="ml-6 text-[11px] text-muted-foreground leading-relaxed">
          {summaryLoading ? (
            <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
          ) : (
            summary
          )}
        </div>
      )}
    </div>
  );
}

function MetaculusCard({
  question,
  marketPrice,
}: {
  question: MetaculusQuestion;
  marketPrice: number;
}) {
  const medianPct =
    question.communityMedian !== null
      ? Math.round(question.communityMedian * 100)
      : null;

  const delta =
    medianPct !== null ? medianPct - Math.round(marketPrice) : null;
  const absDelta = delta !== null ? Math.abs(delta) : null;
  const showDivergence = absDelta !== null && absDelta > 5;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <a
          href={question.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium leading-snug line-clamp-2 hover:text-primary transition-colors"
        >
          {question.title}
        </a>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {showDivergence && delta !== null && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 shrink-0">
              {delta > 0 ? `+${delta}pp` : `${delta}pp`} vs market
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">via Metaculus</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {medianPct !== null ? (
          <span className="text-lg font-bold tabular-nums text-foreground">
            {medianPct}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No forecast</span>
        )}
        <p className="text-[10px] text-muted-foreground">community</p>
      </div>
    </div>
  );
}

// Shared sparkline chart for FRED series and CoinGecko price history
function ContextSparkline({
  data,
  dataKey,
  label,
  formatValue,
  gradientId,
}: {
  data: ({ date: string } & Record<string, number>)[];
  dataKey: string;
  label: string;
  formatValue: (v: number) => string;
  gradientId: string;
}) {
  if (data.length < 2) return null;
  const lastVal = data[data.length - 1][dataKey];

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        {label}
        {lastVal !== undefined && (
          <span className="normal-case font-semibold text-foreground ml-1">
            — {formatValue(lastVal)}
          </span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(v)}
            width={42}
          />
          <Tooltip
            content={({ active, payload, label: lbl }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-md border border-border bg-background px-2 py-1 text-xs shadow-md">
                  <p className="text-muted-foreground">{lbl}</p>
                  <p className="font-semibold">{formatValue(payload[0].value as number)}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ExpandedPanelProps {
  market: ProcessedMarket;
}

export default function ExpandedPanel({ market }: ExpandedPanelProps) {
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null);
  const [chartError, setChartError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [trades, setTrades] = useState<RecentTrade[] | null>(null);
  const [tradesError, setTradesError] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);

  // Context Intelligence Layer state:
  //   null  = fetch in progress
  //   []    = resolved with no results (sub-section hidden)
  //   data  = resolved with results (sub-section rendered)
  //   "n/a" = this data source is not applicable to this market category
  const [newsItems, setNewsItems] = useState<GdeltArticle[] | null>(null);
  const [metaculusItems, setMetaculusItems] = useState<MetaculusQuestion[] | null>(null);
  const [fredData, setFredData] = useState<
    { seriesId: string; label: string; unit: string; data: FredObservation[] }[] | null | "n/a"
  >(null);
  const [geckoData, setGeckoData] = useState<{
    coinId: string;
    data: CoinGeckoPricePoint[];
  } | null | "n/a" | []>("n/a"); // default "n/a" until useEffect determines category

  // Prevent re-fetching if market changes while panel is open
  const contextFetchedRef = useRef<string | null>(null);

  // Lazy-fetch price history once on first render of the expansion
  useEffect(() => {
    if (!market.clobTokenId) return;
    fetchPriceHistory(market.clobTokenId)
      .then(setChartData)
      .catch(() => setChartError(true));
    fetchRecentTrades(market.clobTokenId)
      .then(setTrades)
      .catch(() => setTradesError(true));
  }, [market.clobTokenId]);

  // Fire all context fetches in parallel on panel mount
  useEffect(() => {
    if (contextFetchedRef.current === market.id) return;
    contextFetchedRef.current = market.id;

    // Route through /api/news proxy to avoid CORS blocks on GDELT
    const keywords = extractKeywords(market.question).join(" ");

    fetch(`/api/news?q=${encodeURIComponent(keywords)}`)
      .then((r) => r.json())
      .then((json) => setNewsItems(json?.articles ?? []))
      .catch(() => setNewsItems([]));

    // Route through /api/metaculus proxy to avoid CORS blocks
    fetch(`/api/metaculus?q=${encodeURIComponent(keywords)}`)
      .then((r) => r.json())
      .then((json) => setMetaculusItems(json?.questions ?? []))
      .catch(() => setMetaculusItems([]));

    // Macro: FRED for economics/politics/science, CoinGecko for crypto
    const isCrypto = market.categoryslugs.some(
      (s) => s.toLowerCase() === "crypto"
    );

    if (isCrypto) {
      setFredData("n/a"); // not applicable — skip FRED skeleton
      const coinId = detectCoinFromQuestion(market.question);
      if (coinId) {
        setGeckoData(null); // null = loading
        fetchCryptoPriceHistory(coinId).then((data) =>
          setGeckoData(data.length > 0 ? { coinId, data } : [])
        );
      } else {
        setGeckoData("n/a"); // crypto market but no recognised coin keyword
      }
    } else {
      setGeckoData("n/a"); // not a crypto market — hide gecko entirely
      const fredSeries = getFredSeriesForSlugs(market.categoryslugs);
      if (fredSeries.length === 0) {
        setFredData("n/a"); // no FRED series for this category
      } else {
        setFredData(null); // null = loading
        Promise.all(
          fredSeries.map(async (s) => ({
            seriesId: s.seriesId,
            label: s.label,
            unit: s.unit,
            data: await fetchFredSeries(s.seriesId),
          }))
        ).then((results) =>
          setFredData(results.filter((r) => r.data.length > 0))
        );
      }
    }
  }, [market.id, market.question, market.categoryslugs]);

  const externalUrl = marketTradeUrl(market.source, market.eventSlug);

  const closesIn =
    market.endDate
      ? (() => {
          const days = differenceInDays(parseISO(market.endDate), new Date());
          if (days < 0) return "Closed";
          if (days === 0) return "Closes today";
          return `Closes in ${days}d`;
        })()
      : null;

  const spread = market.bestAsk - market.bestBid;

  // Determine Y axis domain with a bit of padding
  const chartMin =
    chartData && chartData.length > 0
      ? Math.max(0, Math.min(...chartData.map((d) => d.prob)) - 5)
      : 0;
  const chartMax =
    chartData && chartData.length > 0
      ? Math.min(100, Math.max(...chartData.map((d) => d.prob)) + 5)
      : 100;

  const lastUpdatedText = market.createdAt
    ? formatDistanceToNow(new Date(market.createdAt), { addSuffix: true })
    : null;

  return (
    <div className="bg-muted/30 border-t border-border px-4 sm:px-6 py-5 flex flex-col gap-5">

      {/* Section A — Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {market.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={market.image}
              alt={market.eventTitle || market.question}
              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug truncate">
              {market.eventTitle || market.question}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {closesIn && (
                <span className="text-xs text-muted-foreground">{closesIn}</span>
              )}
              {market.seriesFrequency && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium capitalize">
                  {market.seriesFrequency}
                </span>
              )}
              {market.seriesTitle && (
                <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[200px]">
                  · {market.seriesTitle}
                </span>
              )}
              {lastUpdatedText && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  · Created {lastUpdatedText}
                </span>
              )}
            </div>
          </div>
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {market.source === "kalshi" ? "Kalshi" : market.source === "manifold" ? "Manifold" : "Polymarket"}{" "}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Section B — Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-4">
        <StatCell
          label="1h"
          value={formatChange(market.oneHourChange)}
          highlight={changeHighlight(market.oneHourChange)}
        />
        <StatCell
          label="7d"
          value={formatChange(market.oneWeekChange)}
          highlight={changeHighlight(market.oneWeekChange)}
        />
        <StatCell
          label="30d"
          value={formatChange(market.oneMonthChange)}
          highlight={changeHighlight(market.oneMonthChange)}
        />
        <StatCell
          label="Bid / Ask"
          value={`${(market.bestBid * 100).toFixed(1)}¢ / ${(market.bestAsk * 100).toFixed(1)}¢`}
        />
        <StatCell
          label="Spread"
          value={`${(spread * 100).toFixed(2)}¢`}
        />
        <StatCell label="Vol 7d" value={formatCurrency(market.volume1wk)} />
      </div>

      {/* Section C — 30-day probability sparkline (Polymarket CLOB only) */}
      {market.source === "polymarket" && market.clobTokenId && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Probability history
          </p>
          {!chartData && !chartError && (
            <div className="h-28 w-full rounded-md bg-muted animate-pulse" />
          )}
          {chartError && (
            <p className="text-xs text-muted-foreground h-28 flex items-center">
              Chart unavailable
            </p>
          )}
          {chartData && chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={112}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 0, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`grad-${market.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[chartMin, chartMax]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="prob"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#grad-${market.id})`}
                  dot={false}
                  activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {chartData && chartData.length <= 1 && (
            <p className="text-xs text-muted-foreground h-28 flex items-center">
              Not enough history to chart
            </p>
          )}
        </div>
      )}

      {/* Section D — Recent trades (Polymarket CLOB only) */}
      {market.source === "polymarket" && market.clobTokenId && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Recent activity
          </p>
          {!trades && !tradesError && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 bg-muted rounded animate-pulse" />
              ))}
            </div>
          )}
          {tradesError && (
            <p className="text-xs text-muted-foreground">Activity unavailable</p>
          )}
          {trades && trades.length === 0 && (
            <p className="text-xs text-muted-foreground">No recent trades</p>
          )}
          {trades && trades.length > 0 && (
            <div className="flex flex-col gap-1">
              {(showAllTrades ? trades : trades.slice(0, 5)).map((trade) => {
                const isBuy = trade.side === "BUY";
                return (
                  <div
                    key={trade.txHash}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 font-semibold ${
                          isBuy ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {trade.pseudonym}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="text-foreground font-medium">
                        ${trade.sizeUsd < 1 ? trade.sizeUsd.toFixed(2) : trade.sizeUsd.toFixed(0)}
                      </span>
                      <span className="text-muted-foreground">
                        @{(trade.price * 100).toFixed(1)}¢
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">
                        {formatDistanceToNow(new Date(trade.timestamp * 1000), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {trades.length > 5 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllTrades((v) => !v); }}
                  className="text-xs text-primary hover:text-primary/80 transition-all duration-150 active:scale-95 mt-1 text-left hover:underline underline-offset-2"
                >
                  {showAllTrades ? "Show less" : `+${trades.length - 5} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section D1 — Smart Money (Polymarket only, when ENABLE_SMART_MONEY is set) */}
      {market.source === "polymarket" && market.topHolders && market.topHolders.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Smart money
          </p>
          <SmartMoneyCard
            topHolders={market.topHolders}
            smartMoneyScore={market.smartMoneyScore ?? 0}
            openInterest={market.openInterest}
          />
        </div>
      )}

      {/* Section D2 — Orderbook depth bar (Kalshi + Polymarket when available) */}
      {market.orderbookDepth && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Market depth
          </p>
          <OrderbookDepthBar
            bids={market.orderbookDepth.bids}
            asks={market.orderbookDepth.asks}
            depthScore={market.orderbookDepth.depthScore}
            mid={market.currentPrice / 100}
          />
        </div>
      )}

      {/* Section E — Resolution */}
      {(market.description || market.resolutionSource) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Resolution
          </p>
          {market.description && (
            <div>
              <p
                className={`text-xs text-muted-foreground leading-relaxed ${
                  descExpanded ? "" : "line-clamp-3"
                }`}
              >
                {market.description}
              </p>
              {market.description.length > 200 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescExpanded((v) => !v);
                  }}
                  className="text-xs text-primary hover:text-primary/80 mt-0.5 transition-all duration-150 active:scale-95 hover:underline underline-offset-2"
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
          {market.resolutionSource && (
            <a
              href={market.resolutionSource}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-fit"
            >
              Resolution source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Section F — Market Context (progressive: only renders when ≥1 sub-section has data) */}
      <MarketContext
        market={market}
        newsItems={newsItems}
        metaculusItems={metaculusItems}
        fredData={fredData}
        geckoData={geckoData}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MarketContext — progressive disclosure section
// ---------------------------------------------------------------------------

interface MarketContextProps {
  market: ProcessedMarket;
  newsItems: GdeltArticle[] | null;
  metaculusItems: MetaculusQuestion[] | null;
  // null = loading, "n/a" = not applicable for this category, [] = no results
  fredData: { seriesId: string; label: string; unit: string; data: FredObservation[] }[] | null | "n/a";
  // null = loading, "n/a" = not applicable, [] = no coin matched, data = results
  geckoData: { coinId: string; data: CoinGeckoPricePoint[] } | null | "n/a" | [];
}

function MarketContext({
  market,
  newsItems,
  metaculusItems,
  fredData,
  geckoData,
}: MarketContextProps) {
  const hasNews = Array.isArray(newsItems) && newsItems.length > 0;
  const hasMeta = Array.isArray(metaculusItems) && metaculusItems.length > 0;
  const hasFred =
    Array.isArray(fredData) &&
    fredData.length > 0 &&
    (fredData as { seriesId: string; label: string; unit: string; data: FredObservation[] }[]).some(
      (s) => s.data.length > 0
    );
  const hasGecko =
    geckoData !== null &&
    geckoData !== "n/a" &&
    !Array.isArray(geckoData) &&
    (geckoData as { coinId: string; data: CoinGeckoPricePoint[] }).data.length > 0;
  const hasMacro = hasFred || hasGecko;

  // Still loading — show per-section skeletons only
  const newsLoading = newsItems === null;
  const metaLoading = metaculusItems === null;
  // Macro loading: either fred or gecko is explicitly null (in-flight)
  const macroLoading = fredData === null || geckoData === null;

  // Nothing to show and nothing loading — hide entire section
  if (!hasNews && !hasMeta && !hasMacro && !newsLoading && !metaLoading && !macroLoading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="border-t border-border/60" />

      {/* Sub-section: News */}
      {(hasNews || newsLoading) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Related news
          </p>
          {newsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {newsItems!.map((article, i) => (
                <NewsCard key={`${article.url}-${i}`} article={article} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-section: Community Forecasts */}
      {(hasMeta || metaLoading) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Community forecasts
          </p>
          {metaLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {metaculusItems!.map((q) => (
                <MetaculusCard
                  key={q.id}
                  question={q}
                  marketPrice={market.currentPrice}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-section: Macro context */}
      {(hasMacro || macroLoading) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Macro context
          </p>
          {macroLoading ? (
            <div className="h-20 bg-muted rounded animate-pulse" />
          ) : hasFred ? (
            <div className="flex flex-col gap-4">
              {fredData!.map((s) => (
                <ContextSparkline
                  key={s.seriesId}
                  data={s.data as unknown as ({ date: string } & Record<string, number>)[]}
                  dataKey="value"
                  label={s.label}
                  formatValue={(v) =>
                    s.unit === "%"
                      ? `${v.toFixed(2)}%`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(1)}k`
                        : v.toFixed(2)
                  }
                  gradientId={`fred-${s.seriesId}-${market.id}`}
                />
              ))}
            </div>
          ) : hasGecko ? (
            <ContextSparkline
              data={(geckoData as { coinId: string; data: CoinGeckoPricePoint[] }).data as unknown as ({ date: string } & Record<string, number>)[]}
              dataKey="price"
              label={`${coinLabel((geckoData as { coinId: string; data: CoinGeckoPricePoint[] }).coinId)} Price (90d)`}
              formatValue={(v) =>
                v >= 1000
                  ? `$${(v / 1000).toFixed(1)}k`
                  : `$${v.toFixed(2)}`
              }
              gradientId={`gecko-${(geckoData as { coinId: string; data: CoinGeckoPricePoint[] }).coinId}-${market.id}`}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
