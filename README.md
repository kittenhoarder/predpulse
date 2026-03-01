# Predpulse

**Prediction market intelligence dashboard.** Real-time movers, heatmap, sparklines, and trade activity across Polymarket, Kalshi, and Manifold — the "CNBC Movers board" for prediction markets.

Live: [predpulse.xyz](https://predpulse.xyz)

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, SSR) |
| Styling | Tailwind CSS + shadcn/ui |
| Data | Polymarket Gamma + CLOB APIs, Kalshi Trade API, Manifold Markets API |
| Charts | Recharts |
| Real-time | WebSocket (Kalshi + Polymarket CLOB) via `useMarketSocket` |
| Hosting | Vercel |

No database. No auth. No persistent cache layer. Every `/api/markets` call fetches live from all three sources in parallel.

---

## Architecture

```
Polymarket Gamma API ──► lib/gamma.ts ──────────┐
Kalshi Trade API     ──► lib/kalshi.ts ──────────┤──► lib/get-markets.ts ──► /api/markets
Manifold Markets API ──► lib/manifold.ts ────────┘          │
                                                      MarketTable (SWR)
                                                            │
                                                      MarketRow (expand)
                                                            │
                                                      ExpandedPanel
                                                      ├── CLOB prices-history (sparkline, Polymarket only)
                                                      └── data-api trades (recent activity, Polymarket only)

/pulse      ──► lib/pulse.ts ──► /api/pulse ──► PulseDashboard ──► PulseCard ×8
/market/[slug] ──► fetchEventBySlug ──► MarketDetailClient
/api/og        ──► @vercel/og (edge) ──► OG share card
```

---

## File Map

```
app/
  page.tsx                  # SSR home — parallel getMarkets() + getAllMarkets() for Pulse
  layout.tsx                # ThemeProvider, Inter font, OG metadata
  api/markets/route.ts      # GET ?sort=&category=&offset=&watchlist=&source=
  api/pulse/route.ts        # GET — returns PulseApiResponse (8 category indices)
  api/og/route.tsx          # Edge OG image (1200x630) for share cards
  pulse/page.tsx            # Dedicated Pulse index page
  market/[slug]/
    page.tsx                # generateMetadata + SSR market detail
    MarketDetailClient.tsx  # Hero stats, Share button, ExpandedPanel

lib/
  types.ts                  # All shared types: ProcessedMarket, SortMode, PulseIndex, etc.
  gamma.ts                  # fetchAllActiveEvents(), fetchTags(), fetchEventBySlug() (Polymarket)
  process-markets.ts        # processEvents() — raw Gamma → ProcessedMarket[]
  kalshi.ts                 # fetchKalshiMarkets() — raw Kalshi → ProcessedMarket[]
  manifold.ts               # fetchManifoldMarkets() — raw Manifold v0 → ProcessedMarket[]
  get-markets.ts            # merge + filter + sort + paginate; GetMarketsOptions
  pulse.ts                  # computeCategoryPulse() + snapshot history; returns PulseIndex[]
  watchlist.ts              # localStorage helpers: getWatchlist / toggleWatchlist
  hooks/
    useMarketSocket.ts      # WebSocket client for live Polymarket CLOB + Kalshi prices

components/
  MarketTable.tsx           # SWR, controls bar, source/sort/category filters, heatmap/table toggle
  MarketRow.tsx             # Row + expand toggle + star + external trade links (P/K/M)
  ExpandedPanel.tsx         # Chart (CLOB, Polymarket only), stats grid, recent trades, resolution
  HeatmapView.tsx           # Recharts Treemap: tile=liquidity, color=24h change
  SortTabs.tsx              # Sort tab bar (watchlist star, Movers, 1h Movers, Gainers…)
  CategoryFilter.tsx        # Icon+label pill filters, horizontal scroll on mobile
  PulseDashboard.tsx        # SWR grid of 8 PulseCard components
  PulseCard.tsx             # Single Pulse index: center-origin score bar + signal breakdown
  ThemeProvider/Toggle.tsx  # next-themes dark/light
  ui/                       # shadcn/ui primitives (badge, button, table…)
```

---

## Data Models

### `ProcessedMarket` (`lib/types.ts`)

| Field | Source | Notes |
|---|---|---|
| `id`, `question`, `image` | All sources | — |
| `source` | — | `"polymarket"` \| `"kalshi"` \| `"manifold"` |
| `eventSlug` | Polymarket/Kalshi: slug; Manifold: full URL | Polymarket builds `polymarket.com/event/{slug}`; Manifold uses URL directly |
| `currentPrice` | `outcomePrices[0] * 100` | 0–100% |
| `oneDayChange`, `oneHourChange`, `oneWeekChange`, `oneMonthChange` | Polymarket/Kalshi | Percentage points; Manifold returns 0 (API v0 limitation) |
| `volume24h`, `volume1wk`, `volume1mo` | All sources (USD) | Manifold has `volume24Hours` only |
| `liquidity` | All sources (USD) | |
| `bestBid`, `bestAsk`, `spread` | Fractional 0–1 | Manifold: bid=ask=probability, spread=0 |
| `outcomePrices` | Fractional 0–1 | `[yes, no]` |
| `clobTokenId` | Polymarket only | Used for CLOB price history; empty for Kalshi/Manifold |
| `categories`, `categoryslugs` | Mapped from source tags/groupSlugs | |
| `description`, `resolutionSource`, `endDate` | All sources | Manifold ProseMirror descriptions are dropped |
| `competitive` | Computed | 0–1 market heat score |

### `OperatorIndex` / `PulseIndex` (`lib/types.ts`)

Operator indices are computed by `lib/indices.ts` and exposed via `/api/indices`.  
Legacy Pulse (`/api/pulse`) is now a compatibility alias to the `directional` family.

Index families:
- `directional`: polarity-adjusted directional pressure (forecast oriented)
- `liquidity`: spread/depth/volatility stress
- `divergence`: cross-venue disagreement/basis
- `certainty`: conviction/tightness/participation confidence context

Directional formula:

```
Directional = w_momentum     × S_momentum      (30%)
            + w_flow         × S_flow          (25%)
            + w_breadth      × S_breadth       (15%)
            + w_acceleration × S_acceleration  (15%)
            + w_orderflow    × S_orderflow     (10%, gated)
            + w_smartMoney   × S_smartMoney     (5%, gated)
```

Optional signals are included only when BOTH conditions hold:
- at least 5 markets in-category with that signal
- at least 30% OI coverage for that signal

Signal normalization uses rolling 30-day robust quantiles (with fixed-range fallback when history is sparse).
Confidence is computed as: `freshness × sourceAgreement × featureCoverage`.

### `SortMode`

`movers` · `movers1h` · `gainers` · `losers` · `volume` · `liquidity` · `new` · `watchlist`

---

## API Routes

### `GET /api/markets`

| Param | Default | Notes |
|---|---|---|
| `sort` | `movers` | See SortMode |
| `category` | `all` | Tag slug or `all` |
| `offset` | `0` | Pagination (100 per page) |
| `watchlist` | — | Comma-separated market IDs; required when `sort=watchlist` |
| `source` | `all` | `all` \| `polymarket` \| `kalshi` \| `manifold` |

Returns `MarketsApiResponse`: `{ markets, cachedAt, totalMarkets, fromCache }`.

### `GET /api/pulse`

Returns legacy-compatible `PulseApiResponse`: `{ indices: PulseIndex[], computedAt }`.  
Backed by the directional family in the new engine. Includes deprecation headers.

### `GET /api/indices`

| Param | Default | Notes |
|---|---|---|
| `family` | `all` | `all` \| `directional` \| `liquidity` \| `divergence` \| `certainty` |
| `horizon` | `24h` | `24h` \| `7d` |
| `sourceScope` | `core` | `core` \| `all` \| `polymarket` \| `kalshi` \| `manifold` |

Returns `IndicesApiResponse`: `{ indices, family, horizon, sourceScope, computedAt }`.

### `GET /api/indices/backtest`

Returns directional forecast-quality metrics from stored snapshots joined to ingested resolved outcomes:
`{ metrics: { brier, logLoss, calibrationSlope, directionalAuc24h, sampleSize }, joinedOutcomes, totalOutcomes, coveragePct }`.

### `POST /api/indices/outcomes`

Ingests resolved outcomes for backtesting joins.

Request body:

```json
{
  "rows": [
    {
      "marketId": "ABC-123",
      "source": "kalshi",
      "category": "economics",
      "polarity": 1,
      "outcomeYes": 1,
      "resolvedAt": "2026-03-01T00:00:00.000Z",
      "note": "optional"
    }
  ]
}
```

### `GET /api/og`

| Param | Notes |
|---|---|
| `title` | Market question |
| `prob` | Probability 0–100 |
| `change` | e.g. `+7.3%` |
| `category` | Category label |

Returns a 1200×630 PNG. Used by `generateMetadata` in `/market/[slug]`.

---

## External APIs Used

| API | Endpoint | Auth |
|---|---|---|
| Polymarket Gamma | `gamma-api.polymarket.com/events` | None |
| Polymarket Gamma | `gamma-api.polymarket.com/tags` | None |
| Polymarket CLOB | `clob.polymarket.com/prices-history?market=&interval=max&fidelity=10` | None |
| Polymarket Data | `data-api.polymarket.com/trades?market=&limit=10` | None |
| Kalshi Trade API | `trading-api.kalshi.com/trade-api/v2/markets` | None |
| Kalshi WebSocket | `wss://api.elections.kalshi.com/trade-api/ws/v2` | None |
| Manifold Markets | `api.manifold.markets/v0/markets?limit=1000&sort=last-bet-time` | None |

---

## Local Dev

```bash
cp .env.local.example .env.local   # set NEXT_PUBLIC_APP_URL
npm install
npm run dev                        # http://localhost:3000
```

`.env.local` only needs:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deploy

Push to `main` → Vercel auto-deploys. No env vars required beyond `NEXT_PUBLIC_APP_URL` (set in Vercel project settings).

**Rollback:** Vercel dashboard → Deployments → Promote previous deployment.

---

## Conventions

- **Commits:** Conventional Commits — `feat(scope): subject`, `fix(scope): subject`
- **Versions:** Semantic Versioning on production releases
- **Types:** All data shapes live in `lib/types.ts` — extend there first
- **New data sources:** Add `lib/<source>.ts` → wire into `get-markets.ts` → add `source` value to `ProcessedMarket.source` union
- **Renaming:** App name is Predpulse; domain is predpulse.xyz; Vercel project is predpulse
- **New sort modes:** Add to `SortMode` union → `sortMarkets()` in `get-markets.ts` → `TABS` in `SortTabs.tsx`
- **No force-push to main**
