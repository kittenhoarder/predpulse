# Predpulse

## Durable evidence and history (SPEC-006)

Open **Evidence & history** beneath Event outlooks, or visit `/research`. Select a
saved generation to inspect exact contract observations and download its JSON.
Capture runs in the scheduled publisher and survives application restarts.
The pilot automatically tracks up to 16 Polymarket YES contracts, one per event
family, retaining missing and settled contracts. The historical index covers up
to 30 days/750 generations. No historical evidence is backfilled or invented.

24-hour changes require saved comparable observations within ±45 minutes.
Unavailable forecast metrics are null with explicit sample size. Automatic venue
settlement evidence is retained, but forecasting scores remain withheld until a
supported adapter verifies public result time. Category scores are descriptive.
Public outcome writes are disabled. See [SPEC-006](docs/spec-006-durable-evidence.md).

Publication still makes two Blob writes. History adds bounded metadata, a baseline
read, and up to eight five-second venue follow-ups in GitHub Actions. Viewer paths
only read saved data. Actual storage/transfer grows; this is not a zero-cost claim.

## Automated event outlooks (SPEC-005)

The homepage automatically selects up to three upcoming events across central banks,
elections, economic releases and policy/geopolitics from the existing Polymarket
sample. It shows raw YES book midpoints with contract questions and provenance.
Unverified candidate sets and overlapping deadlines are never normalized. The
supported Fed meeting adapter offers opt-in normalization only after validating its
complete five-bucket partition. No extra venue requests, polling or Blob writes.

See [SPEC-005](docs/spec-005-event-outlooks.md) for selection and interpretation.
The feature publishes to an isolated Blob prefix on its PR branch. After merging,
dispatch the publisher on `main` once to populate it in production.

## Belief Shift indices (SPEC-007)

Round 1 replaces experimental Pulse scores on the homepage and `/pulse` with
saved, visual measurements of average absolute 24-hour YES midpoint changes.
Economics and Politics use pinned weekly samples, strict quote comparisons and
explicit coverage. Expand a tile for probability pairs, saved history and evidence.
No additional venue acquisition, homepage request or storage operation is introduced.

See [SPEC-007 and UAT notes](docs/spec-007-belief-shift.md). The preview branch writes
only to `predpulse/previews/spec-07`. It starts warming and needs another capture
roughly 24 hours later for genuine movement readings; old Pulse history is not reused.

## Hourly snapshot delivery (SPEC-01)

The homepage requests `/api/bootstrap` once, then displays the latest saved market
snapshot. The market and index API routes read that same snapshot. The
snapshot includes a **selected** research universe, not every market on each venue.
Its generation time appears above the data. If no snapshot has been published,
index serving stays unavailable without a saved generation; existing market fallbacks remain unchanged.

To activate and verify the publisher:

1. Connect a **private** Vercel Blob store to Predpulse. Vercel reads it through
   its connected `BLOB_STORE_ID` and rotating OIDC credentials. The Vercel
   connection does not need a static read-write token.
2. Create a static Blob read-write token for the GitHub runner. Store it only in
   the repository Actions secret `PREDPULSE_BLOB_READ_WRITE_TOKEN`. Never commit
   or expose its value to the browser. This token can write to that Blob store.
3. A push to `feat/spec-01-snapshot-delivery` or `feat/spec-02-trustworthy-observations` triggers a pilot run. After it
   succeeds, check `/api/bootstrap` on the newly deployed preview. Redeploy
   the preview if the Blob connection was added after its build.
4. After merging, manually dispatch `Publish market snapshot` once. Scheduled
   runs use the default branch, hourly at minute 17, subject to GitHub delays.

Each publication writes one immutable generation and one short-lived manifest
pointer. A source failure or count collapse leaves the last generation active.
The generated JSON is bounded to 250 KB. At most two routine Blob writes per
hour yield 1,440 advanced operations in a 30-day month, before retries; monitor
the project's **actual** shared Hobby allowance and transfer. Failed publication
is visible as a failed GitHub Actions run. The runner performs all market
ingestion and calculation; Vercel Functions only read published data on CDN
misses. Preview deployments without configured storage fall back to live APIs.

The initial visitor path no longer requests Kalshi candles or optional
orderbooks and holders; the hourly publisher acquires candle history for its
summary calculation. Live WebSocket prices can still update visible Polymarket
rows, but the dated snapshot describes the base observation.

## Evidence-backed observed moves (SPEC-02)

The hourly publisher screens its full Polymarket and Kalshi ingest and attaches
up to two observed moves per venue to the existing snapshot. This adds no
upstream requests or extra Blob writes. Each card includes a venue link,
timestamp, current YES price, change, 24h activity, liquidity or open interest,
and quoted spread. Venue-specific coverage counts and an honest empty state
make missing evidence visible; delayed snapshots are labelled.

Both venues require a 5–50 percentage point move, a positive spread no wider
than 5 points, a valid current and prior price, and a scheduled close at least
24 hours away. Polymarket requires $10k of both 24h volume and liquidity;
Kalshi requires 500 contracts traded in 24h and 500 contracts open interest.
Kalshi cards compare current and previous *last-trade* prices, while the
market table compares current and previous YES asks. Neither compares a last
trade with an ask. Market table volume and open interest use contract units
for Kalshi, rather than dollars. One market per event per source appears.
These are descriptive changes, not causal explanations, trade recommendations,
or performance claims. Manifold remains excluded because its API lacks a
dependable 24h move. Older generations without this digest still render.

The SPEC-02 branch pilot writes under `predpulse/previews/spec-02` so the
hourly production publisher cannot overwrite the preview observation digest.
The Kalshi follow-up branch uses `predpulse/previews/kalshi` for the same reason.
The preview deployment selects this namespace via `VERCEL_GIT_COMMIT_REF`;
Vercel's system environment variables must be exposed for branch previewing.

## Focused event monitor (SPEC-03 pilot)

The homepage opens with the visual hero and newsroom, then a policy and economy
monitor from the existing hourly snapshot. The publisher screens politics, economics and geopolitics
markets with the SPEC-02 evidence rules and selects up to 12 large 24-hour
moves, at most one outcome per event on each venue. Six appear initially;
visitors can expand the list. The screen shows quoted basis, outcome, spread,
venue-specific volume units, scheduled close, sample count and freshness.
Deadline links cover selected markets closing within seven days. Each monitor
item has a snapshot-backed detail page with rules excerpt and source link.

Saved markets and last-visit prices are stored on the visitor's device; a
comparison appears only when the earlier and current outcomes and quote bases
match and the current snapshot is fresh. This is a screened **sample**, not a
manual registry of events or verified cross-venue matches. Markets outside the
selected snapshot retain their saved state but cannot show a comparison.

The branch preview uses `predpulse/previews/spec-03`, leaving the production
manifest untouched. The publisher derives the monitor from its existing source
ingest and includes it in the same generation and manifest writes. The newsroom
sits immediately below the hero, while the indices remain below the monitor and
also at `/pulse`. Snapshot context, selection rules and index methodology appear
behind touch-friendly icons beside the relevant visible figures.
The newsroom needs a working `GUARDIAN_API_KEY` in the Vercel Production
environment; provider failures are visibly labelled and cached for five minutes.
After merging the parent Kalshi PR and this PR, manually dispatch the publisher
once on the default branch to populate the production monitor.

**Prediction market intelligence dashboard.** Dated market snapshots, heatmap, sparklines, and trade activity across Polymarket, Kalshi, and Manifold.

Live: [predpulse.xyz](https://predpulse.xyz)

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Data | Polymarket Gamma + CLOB, Kalshi, Manifold; Metaculus + Guardian via server proxies |
| Persistence | Hourly GitHub publisher → private Vercel Blob snapshot |
| Charts | Recharts |
| Real-time | WebSocket (Kalshi + Polymarket CLOB) via `useMarketSocket` (browser → venue, not Vercel) |
| Hosting | Vercel (CDN + Fluid); WAF rate limit on noisy `/api/*` paths |

No database or user auth. Visitor APIs prefer the published Blob snapshot. `/api/markets` still falls back to live venue ingest if no snapshot is available.

Index snapshot persistence is **opt-in** via `INDEX_PERSISTENCE_ENABLED=true` (default: disabled/in-memory).

---

## Architecture

```
GitHub Actions (hourly)
  └── scripts/publish-snapshot.ts
        └── fetchAllSources(fresh) ──► select + digests ──► private Blob (manifest + generation)

Visitor path (CDN-friendly)
  /  (static shell)
    └── HomeDashboard ──SWR──► /api/bootstrap ──► loadPublishedSnapshot
          ├── NewsroomSection ──SWR──► /api/news?q=…     ──► Guardian (normalized q)
          ├── outlooks / monitor / related / indices from bootstrap JSON
          └── MarketTable ──SWR──► /api/markets          ──► snapshot filter (live fallback if none)
                └── ExpandedPanel
                      ├── /api/news?q=… / /api/metaculus?q=…  (Token auth; cached empty/error)
                      ├── CLOB prices-history / trades (browser → Polymarket)
                      └── FRED / CoinGecko (browser → upstream)

  /pulse            ──► /api/indices          ──► saved Belief Shift / attention
  /events/…         ──► loadPageSnapshot      ──► ISR revalidate=300
  /compare/…        ──► loadPageSnapshot      ──► ISR revalidate=300
  /research         ──► loadPublishedSnapshot / historical
  /market/[slug]    ──► fetchEventBySlug      ──► live Gamma (detail)

Open `q=` proxies run through lib/search-query.ts so CDN keys coalesce.
Share cards use static /social-card.png (no /api/og).
```

---

## File Map

```
app/
  page.tsx                     # Static homepage shell + HomeDashboard
  layout.tsx                   # ThemeProvider, metadata, Analytics
  robots.ts / sitemap.ts       # Allow /api/bootstrap + /api/indices only under /api/
  api/bootstrap/route.ts       # Homepage snapshot JSON (s-maxage=300)
  api/markets/route.ts         # Paginated markets from snapshot (live fallback)
  api/indices/route.ts         # Saved index products from snapshot
  api/news/route.ts            # Guardian proxy; normalizeSearchQuery + CDN cache
  api/metaculus/route.ts       # Metaculus proxy; METACULUS_API_KEY + CDN cache
  api/research/route.ts        # Evidence JSON download
  api/pulse/route.ts           # HTTP 410 retirement
  pulse/page.tsx               # Indices catalogue
  research/page.tsx            # Evidence & history browser
  events/[source]/[id]/page.tsx  # Snapshot event detail (ISR 300s)
  compare/[pairId]/page.tsx    # Cross-venue pair (ISR 300s)
  market/[slug]/               # Live Polymarket detail
  methodology/page.tsx         # Static product methodology

lib/
  snapshot.ts / page-snapshot.ts / snapshot-response.ts
  search-query.ts              # normalizeSearchQuery + SEARCH_PROXY_CACHE
  metaculus.ts                 # searchMetaculusQuestions (Token auth)
  get-markets.ts / gamma.ts / kalshi.ts / manifold.ts
  belief-shift.ts / index-products.ts / observations.ts / …
  hooks/useMarketSocket.ts

components/
  HomeDashboard.tsx            # Bootstrap SWR + section composition
  NewsroomSection.tsx / ExpandedPanel.tsx / MarketTable.tsx / …
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
| `volume24h`, `volume1wk`, `volume1mo` | All sources | Kalshi: contract counts; Polymarket: USD; Manifold: platform-native units (24h only) |
| `liquidity` | All sources | Kalshi: open interest in contracts; Polymarket: USD liquidity |
| `bestBid`, `bestAsk`, `spread` | Fractional 0–1 | Manifold: bid=ask=probability, spread=0 |
| `outcomePrices` | Fractional 0–1 | `[yes, no]` |
| `clobTokenId` | Polymarket only | Used for CLOB price history; empty for Kalshi/Manifold |
| `categories`, `categoryslugs` | Mapped from source tags/groupSlugs | |
| `description`, `resolutionSource`, `endDate` | All sources | Manifold ProseMirror descriptions are dropped |
| `competitive` | Computed | 0–1 market heat score |

### Archived `OperatorIndex` / `PulseIndex` (`lib/types.ts`)

The following formulas describe retired experiments. Active indices use the saved
`IndexProductsDigest` in `lib/index-products.ts`; see [SPEC-007](docs/spec-007-belief-shift.md).
Archived v1 generations remain readable. These category scores do not serve the new UI/API.

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

### `GET /api/bootstrap`

Homepage payload from the published snapshot: first markets page, monitor extras,
index products, observations, outlooks, related pairs. `Cache-Control: public,
s-maxage=300, stale-while-revalidate=3600`. HTTP 503 + `Retry-After: 60` when no
snapshot exists (no live venue fan-out on this route).

### `GET /api/markets`

| Param | Default | Notes |
|---|---|---|
| `sort` | `movers` | See SortMode |
| `category` | `all` | Tag slug or `all` |
| `offset` | `0` | Pagination |
| `limit` | `50` | Allowed: `25`, `50`, `100` |
| `watchlist` | — | Comma-separated market IDs; required when `sort=watchlist` |
| `source` | `all` | `all` \| `polymarket` \| `kalshi` \| `manifold` |
| `hideSmall` | `true` | Pass `false` to include below-threshold markets |

Serves from the snapshot when present; otherwise live `getMarkets()`. Same CDN
cache header as bootstrap when successful.

### `GET /api/news?q=`

Guardian Open Platform proxy. `q` is normalized (lowercase, first 4 words, max
100 chars) before upstream and caching. Empty/error responses still send
`s-maxage=300`. Optional `GUARDIAN_API_KEY` (defaults to Guardian `test` key).

### `GET /api/metaculus?q=`

Metaculus open-question proxy. Same `q` normalization and CDN policy as news.
Requires server-only `METACULUS_API_KEY` (`Authorization: Token …`); without it
returns `{ questions: [] }` without calling upstream.

### `GET /api/pulse`

Retired. Returns HTTP 410 with a successor link to `/api/indices`; performs no acquisition.

### `GET /api/indices`

Returns `{ version: 1, indexProducts, asOf, status }` from the saved snapshot.
`indexProducts` is nullable for archived v1 generations. No saved snapshot returns
HTTP 503; there is no live calculation fallback. `asOf` is the publication time.
Legacy `family`, `horizon` or `sourceScope` parameters return HTTP 410.

### `GET /api/indices/backtest`

Returns the published exact-contract research coverage and evaluation readiness.
Forecast Brier/log loss are null until a qualified 24-hour lead observation,
verified public result time and chronological holdout exist. Category scores
never enter this evaluation. Accuracy promotion remains disabled.

### `POST /api/indices/outcomes`

Retired. Returns HTTP 410 and performs no writes. The scheduled publisher obtains
and versions settlement evidence directly from the venue.

### `GET /api/research?at=<ISO generation time>`

Downloads captured evidence and coverage as JSON. Omit `at` for latest. Historical
lookup requires a saved generation within 45 minutes and reports its actual time.
Missing generations return 404. `/research` provides the browsing interface.

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
| Metaculus | `www.metaculus.com/api2/questions` | `METACULUS_API_KEY` (`Authorization: Token …`) |
| The Guardian | `content.guardianapis.com/search` | Optional `GUARDIAN_API_KEY` |

---

## Local Dev

```bash
cp .env.local.example .env.local   # set NEXT_PUBLIC_APP_URL (+ METACULUS_API_KEY for related forecasts)
npm install
npm run dev                        # http://localhost:3000
```

`.env.local` typically needs:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
METACULUS_API_KEY=…               # server-only; expand-panel Metaculus
```

---

## Deploy

Push to `main` → Vercel auto-deploys. Set `NEXT_PUBLIC_APP_URL` and `METACULUS_API_KEY` in Vercel project env (Production + Preview). Snapshot Blob credentials remain as documented above.

**Feature flag / abuse controls:** WAF rate limit on `/api/news|metaculus|markets|og` (60/min/IP). Disable the Firewall rule in the Vercel dashboard to roll back without a redeploy. Attack Challenge Mode is emergency-only.

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
