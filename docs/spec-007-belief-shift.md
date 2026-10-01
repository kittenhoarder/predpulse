# SPEC-007: Belief Shift, Round 1

Replaces experimental Pulse scores in their existing homepage position and at
`/pulse`. The new reading is average absolute 24-hour YES midpoint movement, in
percentage points, across a declared sample of Polymarket event families.
Newsroom, Event outlooks, What changed, Across venues, Observed moves, Markets,
market details, and Evidence & history keep their existing data paths.
Round 2 and Round 3 are outside this pull request. Product acceptance remains Owen's UAT.

## Calculation and saved evidence

- Launch Economics and Politics; admit at most six qualifying event families per category. The implementation supports four categories and a ceiling of eight members, subject to the shared byte budget.
- Use acquired raw events before explorer sampling. Category precedence is Economics, Politics, Crypto, Tech; sports/games/pop-culture/tweet-count tags are excluded.
- Admission requires an active explicit Yes/No contract, usable uncrossed bid/ask with spread ≤0.10, a source-record update within 75 minutes (five-minute future tolerance), future close within 90 days, midpoint 0.05–0.95, and reported daily volume ≥$10,000.
- Select one representative per venue event by volume then stable contract ID. Select families by representative volume then family ID. Pin the cohort and representative until Monday 00:00 UTC; missing members remain in coverage instead of being replaced.
- Pair with the already-loaded saved generation nearest t−24h within ±45 minutes. Compare market/family/token/question/rules/close, methodology, mapping, and quote basis. Preserve current/prior inputs and the actual capture times.
- Rules use full SHA-256 fingerprints over normalized event/contract rules and resolution source. Pair identity uses a 128-bit SHA-256 prefix; cohort/subset segments use compact fingerprints. Source-record updates are labelled separately from captures and do not claim last-trade timing.
- `headline = 100 × mean(abs(current midpoint − prior midpoint))`. Require at least five pairs and ≥80% of admitted members. Breadth is the fraction moving ≥3 pp with 1e−9 pp tolerance. A genuine unchanged set is zero; missing or incompatible evidence is null.
- Keep at most 25 actual hourly history points, trimming oldest optional history to the allocation. Break chart lines across missing hours or cohort/comparable-subset changes. Never convert old Pulse history.

The index digest ceiling is **11,000 UTF-8 JSON bytes**, below the measured
14,621-byte retired Pulse allocation. The launch cap of six members and optional
history trimming meet that measured transfer budget without removing calculation
inputs. A larger catalogue requires another paired budget review.

## Serving and interaction

`PublishedSnapshot` v2 saves `indexProducts` instead of `pulse`; archived v1
snapshots remain readable and show unavailable new indices. `/api/indices` returns
`{ version: 1, indexProducts, asOf, status }` from the saved generation only.
Missing snapshots return 503. Legacy family/horizon/sourceScope parameters and
`/api/pulse` return 410 with a successor link. No visitor-time index acquisition or
calculation fallback remains.

The homepage reuses its bootstrap request and existing five-minute refresh.
The full index page makes one cached digest request with no polling. Card
expansion, history, source observations and JSON download are local. Small SVGs
use a common 0–10+ pp movement scale and 0–100% probability scale; larger charts
mount only for the selected card. Cards open independently. Deep links use
`/pulse?index=belief-shift-economics` or `belief-shift-politics`. Back, close and
Escape restore focus. Captures become delayed after two hours and historical
after six hours; specific warming/unavailable reasons remain visible.

## Publication and isolation

The existing GitHub publisher schedule and duplicate-hour guard remain unchanged.
The branch push allowlist gains `feat/spec-007-belief-shift`, which publishes to
**`predpulse/previews/spec-07`**. Unknown non-main branches use isolated prefixes;
a production write requires an explicit `main` branch identity before acquisition.
Generation and manifest writes, archive bounds, source-collapse protection,
ETag concurrency and last-good read behavior remain intact.

Indices reuse the loaded previous/baseline snapshots. Cold publication still has
three manifest reads and two puts; a publication with previous/24h evidence has
five reads and two puts. No index-specific venue/get/list/write operation is added.
Non-index content uses the established trimming order first. Only optional index
history can use residual space; if required evidence will not fit, publication
fails before writes instead of evicting another product. The generation cap stays
250,000 bytes.

## Paired resource evidence

Same frozen capture: 2026-10-01 11:10:08 UTC, 500 raw Polymarket events,
11,944 processed Polymarket contracts, 4,285 Kalshi markets, 540 Manifold markets.
No acquisition was repeated for these comparisons. The filled-history scenario
retimes unchanged captured inputs to exercise storage/transfer bounds; it is a
synthetic resource fixture, not genuine historical movement evidence.

| Measurement | Original Pulse | Round 1 |
|---|---:|---:|
| Index JSON, filled fixture | 14,621 B | 10,974 B |
| Index gzip | 3,165 B | 3,035 B |
| Generation JSON | 196,291 B | 192,652 B |
| Generation gzip | 37,031 B | 36,901 B |
| Homepage bootstrap JSON | 111,725 B | 108,034 B |
| Homepage bootstrap gzip | 21,344 B | 21,213 B |
| Cold publication storage operations | 3 reads / 2 puts | 3 reads / 2 puts |
| Hot calculation median (20 runs) | 24.93 ms | 12.97 ms |
| Homepage initial JS gzip | 264,008 B | 259,459 B |
| `/pulse` initial JS gzip | 216,160 B | 120,423 B |

Saved index validation median: 0.13 ms over 100 local runs. Local full publication
was 560 ms before and 496 ms after, with acquisition/storage network mocked; this
is a sample, not a hosting CPU guarantee. Existing non-index contents were compared
field-for-field and retained. Raw measurements are in
[spec-007-resource-results.json](spec-007-resource-results.json).
Initial JavaScript is the sum of per-route production JS chunks, gzip per file.
The existing heatmap implementation loads only when its view is selected, keeping
initial homepage transfer below baseline. Its API/data path and visible behavior
remain unchanged. The shared header wraps when zoom leaves insufficient space.
All 178 automated tests, lint and production build pass. Final browser checks
cover responsive interactions, zero/warming states and the deferred heatmap.
Account-wide Vercel traffic/quota headroom and cache behavior remain unmeasured.
Preview pushes incur existing one-off publication/build work; they do not add a schedule.

## Verification and UAT

Automated checks cover the six-event 2.0 pp/33% example, unchanged zero, 6/8 coverage
failure, family deduplication, stable representatives, revised identity exclusion,
stale/crossed/reordered quotes, taxonomy, UTC epochs, baseline tolerance, history
breaks, tamper rejection, byte bounds, saved-only APIs, restart persistence and
fail-closed publication isolation. Local browser fixtures are kept outside the
application and are not shipped as product data.

For review now:

1. Open the homepage and `/pulse` on desktop and a 375 px mobile viewport, in light and dark themes.
2. Open each card independently; check Back, close, Escape and a copied deep link.
3. Read its pp unit, venue, capture time, coverage and state without opening methodology.
4. Inspect current probability marks, observation/source links and evidence download. Distinguish missing history from a valid zero.
5. Confirm the other existing homepage features still work.

For product-value acceptance after genuine evidence exists:

1. At least one live category must have five comparable pairs and ≥80% coverage.
2. Identify the category with the larger 24-hour move within ten seconds.
3. Find an actual underlying moving contract; explain pp versus probability.
4. Judge whether the aggregate adds value beyond Observed moves and whether the graphics feel clear and attractive.

The first isolated preview capture starts warming. After roughly 24 hours, manually
run **Publish market snapshot** on `feat/spec-007-belief-shift` within ±45 minutes
of the first capture. Preview branches do not receive the main branch's automatic
schedule. Another push also triggers publication. No fixture can satisfy live-data
UAT. After merge, existing scheduled `main` publications build production evidence
from their own first v2 capture; preview evidence is not copied into production.
A full hourly trend accumulates later, subject to byte limits.

## Migration and rollback

Review and merge only after UAT; do not begin Round 2 automatically. New application
readers accept both v1 and v2. A rollback should keep this compatible reader and
publisher pair. If returning to the original v1 application, first restore the
manifest to a verified immutable v1 generation (including a compatible previous
pointer) under the normal ETag write guard, then roll back the application and
publisher together. Redeploying an old v1 reader alone cannot safely interpret v2.
No old immutable generations are rewritten or deleted by this change.
