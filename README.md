# Predmove

**Prediction market intelligence dashboard.** Real-time movers, heatmap, sparklines, and trade activity for Polymarket — the "CNBC Movers board" for prediction markets.

Live: [predmove.vercel.app](https://predmove.vercel.app)

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, SSR) |
| Styling | Tailwind CSS + shadcn/ui |
| Data | Polymarket Gamma API (public, no auth) + CLOB API |
| Charts | Recharts |
| Hosting | Vercel |

No database. No auth. No cache layer (yet). Every `/api/markets` call fetches live from Gamma.

---

## Architecture

```
Gamma API ──► lib/gamma.ts ──► lib/get-markets.ts ──► /api/markets
                                                            │
                                                     MarketTable (SWR)
                                                            │
                                                      MarketRow (expand)
                                                            │
                                                      ExpandedPanel
                                                      ├── CLOB prices-history (sparkline)
                                                      └── data-api trades (recent activity)

/market/[slug] ──► fetchEventBySlug ──► MarketDetailClient
/api/og        ──► @vercel/og (edge) ──► OG share card
```

---

## File Map

```
app/
  page.tsx                  # SSR home — initial getMarkets() call
  layout.tsx                # ThemeProvider, Inter font, OG metadata
  api/markets/route.ts      # GET ?sort=&category=&offset=&watchlist=
  api/og/route.tsx          # Edge OG image (1200x630) for share cards
  market/[slug]/
    page.tsx                # generateMetadata + SSR market detail
    MarketDetailClient.tsx  # Hero stats, Share button, ExpandedPanel

lib/
  types.ts                  # GammaMarket, GammaEvent, ProcessedMarket, SortMode
  gamma.ts                  # fetchAllActiveEvents(), fetchTags(), fetchEventBySlug()
  process-markets.ts        # processEvents() — raw Gamma → ProcessedMarket[]
  get-markets.ts            # filter + sort + paginate; GetMarketsOptions
  watchlist.ts              # localStorage helpers: getWatchlist / toggleWatchlist

components/
  MarketTable.tsx           # SWR, controls, table/heatmap toggle, pagination
  MarketRow.tsx             # Row + expand toggle + star + detail/trade links
  ExpandedPanel.tsx         # Chart (CLOB), stats grid, recent trades, resolution
  HeatmapView.tsx           # Recharts Treemap: tile=liquidity, color=24h change
  SortTabs.tsx              # Tab bar with short labels on mobile
  CategoryFilter.tsx        # Pill filters, horizontal scroll on mobile
  ThemeProvider/Toggle.tsx  # next-themes dark/light
  ui/                       # shadcn/ui primitives (badge, button, table…)
```

---

## Data Models

### `ProcessedMarket` (frontend shape — `lib/types.ts`)

| Field | Source | Notes |
|---|---|---|
| `id`, `question`, `image` | GammaMarket | — |
| `eventSlug`, `eventTitle` | GammaEvent | Used for Polymarket URL and detail page |
| `currentPrice` | `outcomePrices[0] * 100` | 0–100% |
| `oneDayChange`, `oneHourChange`, `oneWeekChange`, `oneMonthChange` | `*PriceChange * 100` | Percentage points |
| `volume24h`, `volume1wk`, `volume1mo` | GammaMarket | USD |
| `liquidity` | `liquidityNum` | USD |
| `bestBid`, `bestAsk`, `spread` | GammaMarket | Fractional (0–1) |
| `clobTokenId` | `clobTokenIds[0]` | Used for CLOB price history |
| `categories`, `categoryslugs` | GammaEvent tags | Normalised via fetchTags() |
| `description`, `resolutionSource`, `endDate` | GammaMarket | Detail panel |
| `competitive` | GammaMarket | 0–1 market heat score |

### `SortMode`

`movers` · `movers1h` · `gainers` · `losers` · `volume` · `liquidity` · `new` · `watchlist`

---

## API Routes

### `GET /api/markets`

| Param | Default | Notes |
|---|---|---|
| `sort` | `movers` | See SortMode above |
| `category` | `all` | Tag slug or `all` |
| `offset` | `0` | Pagination (100 per page) |
| `watchlist` | — | Comma-separated market IDs; required when sort=watchlist |

Returns `MarketsApiResponse`: `{ markets, cachedAt, totalMarkets, fromCache }`.

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
- **New data fields:** Add to `GammaMarket`/`GammaEvent` → `ProcessedMarket` → `processMarket()` in sequence
- **New sort modes:** Add to `SortMode` union → `sortMarkets()` in `get-markets.ts` → `TABS` in `SortTabs.tsx`
- **No force-push to main**
