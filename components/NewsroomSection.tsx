"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { formatDistanceToNow, parse } from "date-fns";
import type { GdeltArticle, MarketsApiResponse, ProcessedMarket } from "@/lib/types";
import { ToneBadge, toneGradientClass } from "@/lib/tone";
import { matchArticlesToMarkets, buildNewsroomQuery } from "@/lib/match-markets";
import { marketTradeUrl } from "@/lib/format";
import { ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsArticle extends GdeltArticle {
  image?: string;
}

interface StoryWithMarkets {
  article: NewsArticle;
  markets: ProcessedMarket[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function gdeltRelativeTime(seendate: string): string {
  try {
    const d = parse(seendate, "yyyyMMdd'T'HHmmss'Z'", new Date());
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// MarketChip — links an article to a matched prediction market
// ---------------------------------------------------------------------------

function MarketChip({ market }: { market: ProcessedMarket }) {
  const prob = Math.round(market.currentPrice);
  const probColor =
    prob >= 60
      ? "text-emerald-500"
      : prob <= 40
        ? "text-red-500"
        : "text-muted-foreground";

  const truncated =
    market.question.length > 52
      ? market.question.slice(0, 52) + "…"
      : market.question;

  // Internal /market/[slug] only exists for Polymarket (Gamma). Kalshi/Manifold link out.
  const href =
    market.source === "polymarket"
      ? `/market/${market.eventSlug}`
      : marketTradeUrl(market.source, market.eventSlug);
  const isExternal = market.source !== "polymarket";

  return (
    <a
      href={href}
      {...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}
      onClick={(e) => e.stopPropagation()}
      aria-label={`${market.question} — ${prob}% yes`}
      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors text-[11px] w-full group"
    >
      <span className="text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
        {truncated}
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${probColor}`}>
        {prob}%
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// StoryCard — full news card with hero image, headline, chips
// ---------------------------------------------------------------------------

function StoryCard({ article, markets }: { article: NewsArticle; markets: ProcessedMarket[] }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = article.image && !imgError;
  const gradientClass = toneGradientClass(article.tone);

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden flex flex-col group hover:border-border/80 transition-colors">
      {/* Hero image area */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted shrink-0">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          // Fallback gradient tile when og:image is absent or fails
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-end`} />
        )}

        {/* Dark gradient overlay — headline and meta sit on top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Top bar: domain favicon + source + timestamp + tone badge */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${article.domain}&sz=16`}
              alt=""
              className="w-4 h-4 rounded-sm shrink-0 opacity-90"
              loading="lazy"
            />
            <span className="text-[10px] text-white/70 font-medium">{article.domain}</span>
            {article.seendate && (
              <span className="text-[10px] text-white/50 hidden sm:inline">
                · {gdeltRelativeTime(article.seendate)}
              </span>
            )}
          </div>
          <ToneBadge tone={article.tone} />
        </div>

        {/* Headline over gradient */}
        <h3 className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white leading-snug line-clamp-2">
          {article.title}
        </h3>
      </div>

      {/* Content: top row has label + Read article link; body is chips or summary (no extra link row) */}
      <div className="flex flex-col p-3 flex-1 min-h-[7.5rem]">
        <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            {markets.length > 0 ? "Related markets" : article.summary ? "Article" : ""}
          </span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
            aria-label={`Read article: ${article.title}`}
          >
            Read article <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {markets.length > 0 ? (
          <div className="flex flex-col gap-1 flex-1 min-h-0">
            {markets.map((m) => (
              <MarketChip key={m.id} market={m} />
            ))}
          </div>
        ) : article.summary ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
              {article.summary}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0" />
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-video w-full bg-muted animate-pulse" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
        <div className="h-8 bg-muted rounded-lg animate-pulse mt-1" />
        <div className="h-8 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewsroomSection — main export
// ---------------------------------------------------------------------------

// Broad default query fired immediately on mount — covers the major prediction
// market categories without waiting for the /api/markets response first.
// Refined to a market-derived query once markets data is available.
const DEFAULT_NEWS_QUERY = "election economy bitcoin federal reserve trump";

const MARKETS_SWR_KEY = "/api/markets?sort=movers&category=all&offset=0&limit=50&hideSmall=true";

export default function NewsroomSection() {
  // Start with a default query so news fetch fires immediately on mount —
  // no waterfall waiting for market data first.
  const [newsQuery, setNewsQuery] = useState(DEFAULT_NEWS_QUERY);

  // Reuse the same market data already in-flight from MarketTable (SWR deduplicates)
  const { data: marketsData } = useSWR<MarketsApiResponse>(
    MARKETS_SWR_KEY,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false }
  );

  // Once markets load, refine the query to reflect actual active categories
  useEffect(() => {
    const markets = marketsData?.markets;
    if (!markets || markets.length === 0) return;
    const refined = buildNewsroomQuery(markets);
    if (refined && refined !== newsQuery) setNewsQuery(refined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketsData]);

  // Fetch news via the server-side proxy (no CORS issues, cached at edge 5min)
  const { data: newsData, isLoading: newsLoading } = useSWR<{ articles: NewsArticle[] }>(
    `/api/news?q=${encodeURIComponent(newsQuery)}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const articles = useMemo(() => newsData?.articles ?? [], [newsData?.articles]);
  const allMarkets = useMemo(
    () => (marketsData?.markets ?? []) as ProcessedMarket[],
    [marketsData?.markets]
  );

  // Match each article to the most relevant prediction markets — pure client computation
  const stories: StoryWithMarkets[] = useMemo(
    () =>
      articles.map((article) => ({
        article,
        markets: matchArticlesToMarkets(article.title, allMarkets, 3),
      })),
    [articles, allMarkets]
  );

  // Show skeletons while loading, hide section only after a confirmed empty response
  const showSkeleton = newsLoading && articles.length === 0;
  const isEmpty = !newsLoading && articles.length === 0;
  if (isEmpty) return null;

  return (
    <section className="py-3">
      {/* Section label — matches "Markets" label style */}
      <div className="mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
          Newsroom
        </span>
      </div>

      {showSkeleton ? (
        /* Skeleton grid — visible immediately on mount */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: horizontal snap-scroll strip */}
          <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
            {stories.map((story, i) => (
              <div key={`${story.article.url}-${i}`} className="w-[85vw] shrink-0 snap-start">
                <StoryCard article={story.article} markets={story.markets} />
              </div>
            ))}
          </div>

          {/* Desktop: 3-column grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((story, i) => (
              <StoryCard
                key={`${story.article.url}-${i}`}
                article={story.article}
                markets={story.markets}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
