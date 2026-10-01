# Spec 009 revised: Market Attention Map

Status: development specification for review, 1 October 2026. Supersedes the fixed thematic basket proposed in PR #37. Implementation must start from Round 2 and remove the old basket from the release scope. This specification does not authorise merging earlier rounds.

## 1. Product contract

Answer one question immediately: **Where is trading activity concentrated in the captured prediction-market sample?**

A compact category treemap turns the existing Polymarket event feed into a visual distribution of venue-reported rolling 24-hour trading volume. Categories remain stable while their events renew automatically at every successful existing snapshot publication. No event IDs, jurisdictions, deadlines or headline themes are curated into the product.

The product name is **Market Attention**. Its label is **Share of reported 24h volume**. Required visible scope: **Polymarket · captured event sample**. “Attention” is a proxy for trading activity, not unique people, informed conviction, news importance or market-wide coverage. Volume is not probability, liquidity, open interest, net money invested or a forecast. Do not call the output a return index.

The first valid capture is useful immediately. No baseline, warming period or historical archive is required. No probability-movement colours, activity-change arrows, ranking-change claims or saved trend appear in v1. This deliberately narrows the earlier concept to a single explainable measurement and avoids additional paired quote evidence.

## 2. Existing data and constraints

Confirmed in the repository: `fetchAllActiveEvents()` requests active, unclosed Gamma events ordered by `volume24hr`, in at most five pages of 100. Embedded tags and event-level volume are already passed as `sources.outlookEvents` to the publisher. A captured 1 October fixture contains 500 events with the required fields.

Reuse that exact acquired array. Do not add vendor requests, increase pages, change acquisition ordering, fetch missing tags, fetch contract books or invoke an LLM. Do not widen existing Market Monitor or Event Outlook collections for this feature.

This is a volume-ranked, bounded sample, not a census. Moving pagination can omit or duplicate events; page failures can return a shortened array. The current acquisition interface does not prove completeness. Display the actual included count, and state in source evidence: “Coverage completeness is not established; events outside this capture are not represented.” Never infer a complete sample from a count of 500 or infer a failed request solely from a count below 500.

## 3. Eligibility and classification

One event is one counting unit. Use `event.volume24hr` once. Never sum event volume and embedded contract volumes together.

Admission requires a nonempty bounded event ID, `active === true`, `closed === false`, `archived !== true`, and a finite numeric nonnegative `volume24hr`. Numeric strings are not silently coerced. Zero-volume events contribute to included counts but no area. Exclude all occurrences of a duplicated event ID, rather than choosing a potentially inconsistent copy. Record excluded counts by reason.

Do not require a usable quote or a future contract deadline to admit event volume. The map measures reported trading activity, and quote screening must not silently alter its denominator. Do not gate eligibility using individual contract probability, liquidity or resolution rules. Preserve existing products' eligibility rules separately.

Use an explicit, versioned tag classifier. Lowercase and match exact slugs; no title keywords, fuzzy matching, semantic joins or dynamic taxonomies. The first matching category in this precedence wins:

| Category | Exact supported tag slugs |
| --- | --- |
| Sports | sports, games, esports |
| Weather | weather, daily-temperature, highest-temperature |
| Crypto | crypto, crypto-prices |
| Economics | economics, economy, macro-indicators, economic-policy, finance |
| Technology | tech, ai |
| Politics | politics, geopolitics, elections, global-elections |
| Other | No supported match, including absent tags |

Precedence is part of the methodology, not an inferred ontology. An event cannot contribute to two categories. For example, sports plus politics maps to Sports; economics plus politics maps to Economics. Tags such as `hide-from-new` or `recurring` are not substantive classification signals. Unknown tags remain Other. Do not import the Belief Shift classifier unchanged: it deliberately excludes sports and uses a different category scope.

At each publication, use the currently observed eligible events and tags. Renew immediately without weekly pinning. A classification or sample change affects current composition only; v1 makes no across-time comparison.

## 4. Arithmetic and evidence

For each category c:

- `volume[c] = sum(event.volume24hr)` for eligible unique events assigned to c.
- `totalVolume = sum(volume[c])` across all seven categories.
- `share[c] = volume[c] / totalVolume` when totalVolume is positive.
- `count[c]` counts all included events assigned to c, including zero-volume events.

Use unrounded finite numbers for aggregation and layout. Display shares to one decimal percentage place; optional rounding help explains why displayed percentages may not total exactly 100%. Shares describe the captured denominator. Dollar formatting is explicitly “venue-reported volume”; it is not a cross-venue adjusted measure. Reject arithmetic overflow, negative values and impossible derived totals.

Store compact summaries for all seven categories, included/excluded counts, total volume, capture time, classifier/method version and bounded source rows. Do not store all 500 events again or attach new quote observations to the shared evidence list.

For each category retain up to three highest-volume events for inspection, ordered by descending volume then lexical event ID. A row contains event ID, safe source slug, short title and exact volume. Rows are examples of leading contributors, not exhaustive constituents. Their sum must never be presented as the category total. Surface the full category count and retained source-row count.

Only optional rows and display-title length may be reduced to fit the byte budget. Keep all category totals, counts, methodology, source scope, exclusions and denominator intact. IDs and slugs must not be truncated into different identities. Limit admitted IDs to 64 bytes; evidence links require an existing valid ASCII slug of at most 128 bytes. Invalid or oversized source metadata prevents the source row, not inclusion of otherwise valid volume. Escape titles as text. Clamp optional display titles to 96 UTF-8 bytes at character boundaries, with an ellipsis and a complete source link where available.

Saved validation independently checks finite nonnegative totals, unique category keys and row identities, exact classifier version, category counts and shares, row bounds/order, row-volume sums no greater than category volume, timestamp consistency and payload size. The saved summary supports inspection, not exhaustive recalculation from exported rows. Export must explicitly label this limitation. Full-source arithmetic correctness is established by publisher tests; no claim of a complete auditable constituent archive is made.

## 5. Visual design and interaction

### Overview

One calm, fixed-height card replaces the thematic basket slot. Title: Market Attention. Main figure: largest category and its share, for example “Politics · 34.2%”. Subtitle: “Share of reported 24h volume”. The visual is a seven-category treemap, with no sparklines, synthetic history or loading animation after a valid first capture.

Use a deterministic binary partition of the unit rectangle by category volume. At most seven nonzero rectangles. Stable category colours and canonical category order reduce visual churn; geometry still changes as shares change, so no promise of spatial stability. No force layout, canvas, WebGL, chart library or animation loop. Do not impose minimum tile area, which would misrepresent shares. Use thin internal separators without changing the underlying area calculation. Exact ratios refer to layout rectangles before separator strokes.

The compact card is a single button that expands the detail panel. Rectangles inside that button are decorative, never nested interactive buttons. Show category names inside tiles only where they fit; a short legend contains the complete names and shares, including zero or tiny categories. Colour never conveys the only explanation. Keep scope and capture status accessible without making them the dominant visual content.

### Expanded detail

A larger treemap contains accessible selectable category regions. The legend provides normal keyboard-operable buttons for every category, including visually tiny categories. Default selection is the largest category, with canonical-order tie breaking. Selected category shows its exact share, volume, full included count and up to three linked source rows with proportional activity bars. Bars use a declared local scale and do not imply share of the full map.

All content is already in the digest. Selection, expansion and downloads must make zero network requests. Reuse the existing detail panel, metadata help, focus restoration, deep links and evidence export patterns. Deep link: `/pulse?index=market-attention`; category selection is local component state, not extra navigation history. Support Back, Escape, Enter/Space and visible focus. No hover-only evidence or interaction. At 375 px and 200% zoom, detail stacks vertically and source titles wrap; exact values remain readable in the legend/list when tiles cannot carry text.

Homepage continues to have at most three product cards: Economics, Fed policy balance, Market Attention. Full Indices retains Politics. Rename the former Thematic Baskets filter to Market Attention. No existing Monitor, research, Event Outlook or across-market content is removed. Existing index calculations remain unchanged.

## 6. States and renewal

| Condition | Required behavior |
| --- | --- |
| Positive valid total | Show current map immediately, even without a prior snapshot. |
| Eligible events but all zero volume | Show “No reported activity in this capture”; no artificial equal areas. |
| No eligible events or missing input | Show unavailable state with concise help; never reuse an old map as current. |
| Shortened or unknown-completeness sample | Show actual counts and normal sample scope; do not assert complete coverage. |
| Saved digest is stale | Use the existing snapshot stale indicator and timestamp; do not claim live data. |
| Largest category or events change | Replace composition on next existing publication; no code or registry update. |
| Previously prominent event resolves or closes | It leaves the next eligible sample automatically. |
| No safe source rows for a category | Retain its totals; explain that source examples are unavailable. |

V1 stores current composition only. There is no map-specific baseline or history, and therefore no rollover discontinuity presented as a trend. Production refresh follows the existing publisher cadence. Preview does not acquire data automatically just because someone opens it.

## 7. Compute, storage and transfer budgets

Hard architectural requirements: zero additional vendor calls; zero additional Blob operations or objects; zero new schedules; zero homepage or expansion requests; zero new dependencies; zero probability-pair observations; zero map history.

Bound the input at the existing 500-event contract. Reject an oversized array for this product with a diagnostic, without performing an unbounded sort or changing other products. Use two bounded passes for duplicate detection and aggregation; maintain top-three rows per category with bounded insertion. Complexity is O(N × bounded tag work), space O(N) for IDs plus seven aggregates and at most 21 candidates. Bound tag inspection at 64 entries per event; malformed/oversized tag sets map to Other with a diagnostic count instead of an unbounded scan. More tags are not silently truncated into a confidently assigned category.

The standalone map must serialize to **at most 4,000 UTF-8 bytes**. Preserve required aggregate fields first; keep one safe leading source row per nonempty category when it fits, then add further rows by global volume with deterministic ties until the cap. Removing optional rows is visible through retained row counts. If even required fields do not fit, fail publication before writes, following the existing required-evidence overflow behavior.

Target shared index ceiling: **20,000 bytes**, including unchanged Round 1/2 evidence. Replace the old Round 3 basket entirely. Do not borrow space from other product content, delete required comparison evidence or increase the 250 KB generation ceiling. Optional existing chart history follows its established trimming policy only.

This retains a review exception: Round 2's filled digest measured 14,572 bytes against a 14,600-byte allocation, leaving insufficient room for a useful map. A 20 KB allocation is bounded but still exceeds both Round 2 and the retired Pulse baseline. The strict no-growth requirement cannot be claimed satisfied. Acceptance of the allocation increase is a merge gate. A 4 KB map ceiling is a design constraint, not a measurement of implemented cost.

Implementation gates, measured on the same frozen inputs against Round 2:

| Gate | Limit / expectation |
| --- | --- |
| New acquisition / schedules / storage operations | Exactly zero increase |
| Standalone map JSON | ≤4,000 bytes |
| Shared digest JSON | ≤20,000 bytes |
| Generation JSON | ≤250,000 bytes; all non-index content retained |
| Compressed bootstrap increment | ≤1,500 bytes target; measured and reported |
| Homepage and Indices route JS increment | ≤3,000 bytes gzip each target; no expansion-specific chunk |
| Added calculation, 500-event fixture | ≤10 ms median and ≤25 ms p95 local target over 30 warmed runs |
| Saved validation increment | ≤1 ms median local target |
| Browser idle work | No timers, continuous animation or per-frame computation |

Targets are not guarantees about billed Vercel CPU or account quota. A failed transfer/compute target requires optimisation or explicit spec revision before merge, not an undocumented exception. Measure category layout only on first render or size change, with seven tiles, never every frame.

## 8. Verification and acceptance

Meaningful unit fixtures cover exact partition arithmetic, overlap precedence, unknown and oversized tags, duplicate IDs, zero/invalid/overflow volume, missing sources, deterministic ties, current renewal when events resolve, unsafe source slugs, title byte bounds, optional-row pruning and required-field overflow. Verify a large parent event with several contracts is counted once. Independently calculate totals from a captured real feed and reconcile every category and exclusion.

Publication/restart tests must show the same storage operation counts and unchanged Round 1/2 evidence. Verify serving reads the saved map, never acquiring data. A cold first publication must render a usable map. The second fixture must change headlines, IDs, dominant category and expired events without changing code or classifier, demonstrating the evergreen product behavior.

Production-browser verification covers dark/light desktop, 375 px mobile, 200% zoom, reduced motion, tiny and zero categories, legend keyboard selection, source links, local export, deep link, Back/Escape/focus restoration, homepage three-card limit, zero selection/expansion requests and no runtime errors. Compare before/after network payload and route JS rather than inferring cost from source size.

Live UAT: current captured map is populated; visible percentages reconcile with the saved denominator; a selected category explains its scale and sample scope; source rows correspond to real venue events; no manual list is required for renewal. Genuine volume-history or probability-change acceptance is outside v1 because neither is implemented.

## 9. Exclusions and implementation sequence

Excluded: cross-venue volume aggregation, full-market coverage, arbitrary theme inference, semantic clustering, manually curated successor baskets, sentiment/directional probability averages, movement colours, comparisons with yesterday, time-series storage, social attention, model calls and additional acquisition.

Implementation order: (1) pure classifier/aggregator and bounded digest validator; (2) existing snapshot integration and measured byte fit; (3) lightweight treemap, legend and existing detail integration; (4) browser/resource verification; (5) separate draft PR and preview for UAT. Record results alongside this specification. Do not merge PR #37's fixed basket as a prerequisite. Its reusable interaction ideas may be reused selectively, without retaining its adapter, six-contract evidence or history.
