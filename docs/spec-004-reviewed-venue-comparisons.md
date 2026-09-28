# SPEC-004 — Reviewed event matching and honest venue comparison

**Status:** implementation-ready proposal · **Owner:** Predpulse · **Updated:** 2026-09-28

**Depends on:** SPEC-001 published snapshots, SPEC-002 typed market observations, SPEC-003 event monitor

**Decision:** publish a cross-venue numerical difference only for a manually reviewed, currently valid pair of contracts representing the same settled proposition.

## Why this exists

A user who sees two prices for a seemingly identical prediction wants to know whether the contracts actually settle the same way. Similar titles conceal different deadlines, release vintages, thresholds, time zones, cancellation rules, and sides of a multi-outcome event. A price gap without this context could mislead them. The first product is a small, auditable set of comparisons for policy and economic events, with direct links to both venues and the evidence for the match.

**User job:** “Show me what the two markets imply about precisely the same outcome, as of a stated time, and explain any rule differences before I draw a conclusion.” Success is comprehension and trust, not the number of pairs published. This is research context, not executable pricing or an arbitrage detector.

## Current starting point

- `lib/event-monitor.ts` selects policy/economy topics within a source; it does not establish cross-venue equivalence. `lib/match-markets.ts` matches news to market titles and must never be used to approve venue pairs.
- `lib/types.ts` has venue market IDs, outcomes, generic best bid/ask, and description, but no reviewed match, rule version, explicit outcome orientation, or per-quote receipt time. `lib/process-kalshi.ts` currently leaves `description` empty and does not retain primary/secondary rules; its displayed probability can derive from a YES ask or last trade. `lib/process-markets.ts` may use the first Polymarket outcome, which is not necessarily YES.
- `lib/snapshot.ts` publishes a bounded market sample, observations, and monitor into one private Blob generation (250,000-byte ceiling). Inclusion of both sides of a reviewed pair is not guaranteed. `app/events/[source]/[id]/page.tsx` is a one-venue detail page.
- The existing GitHub publisher runs at minutes 17 and 47 each hour. Runs can be delayed or missed; the site must use observation age, rather than schedule intent, when deciding what to show.

## Scope and release gates

Start with **20–30 candidate event families** in the curated policy/economy monitor. A candidate is a review backlog item, not a promised live comparison. Ship the first public comparison only after at least one pair passes the complete checklist and has two valid quotes. An empty set is a valid release state, with a useful explanation on the monitor. Initial coverage is Polymarket and Kalshi; do not imply that Manifold or every topic has an equivalent market.

| Classification | When used | Numerical venue difference |
| --- | --- | --- |
| Equivalent | Same proposition, settlement basis, and payout orientation after documented transformation; both rule sets reviewed | Eligible if quote and freshness gates also pass |
| Related | Same broad story but a material difference in any settlement dimension | Never; show the difference in words |
| Review required | Rules missing, ambiguous, updated, or waiting for human sign-off | Never |
| Not comparable | Different proposition or irreconcilable payout | Never |

One-source events remain normal event pages without a comparison. A “related” label does not become “equivalent” just because current prices happen to match.

### Rule review: required fields

For each side, store and review: venue and permanent market ID, outcome/token ID and its actual label, underlying variable or entity, geography, units, observation period, event/release/meeting date, cutoff with IANA time zone, threshold with strict/inclusive operator, positive outcome direction, resolving authority, first release versus revised data, cancellation/void/postponement handling, payout basis and currency/unit, venue event URL, full source rule reference, and source rule hash. Record a reviewer, review timestamp, reasoned decision, effective-from date, and a mapping revision. A changed market ID, outcome assignment, or rule hash invalidates the equivalence decision pending re-review. Missing rules never default to “same.”

Rules must come from the market's complete venue terms, including linked supplemental conditions where necessary. Capture the full primary/secondary Kalshi rules and full relevant Polymarket market description plus referenced resolution source in the publisher's review input. A compact 500-character display excerpt is insufficient for review. Normalize only transport artifacts such as line endings before hashing; any content change triggers review. Never put full rule texts into the small homepage snapshot unless required for a specific short excerpt.

### Versioned registry and review workflow

Use a checked-in, schema-validated registry of **candidate families and reviewed mappings**, e.g. `data/venue-comparisons.json`; each reviewed pair names the exact two venue market IDs, outcome IDs, canonical proposition, orientation (`as-is` or `complement`), reviewed rule fingerprints, classification, material differences, reviewer, reason, and effective mapping revision. A pull request is the human review surface: attach both venue links and the field-by-field comparison; require another reviewer for an `equivalent` change. Do not create an administration UI for the pilot.

The publisher verifies the current source IDs, outcome labels, full rule hashes, market status, and mapping revision against the reviewed registry on each run. If evidence is absent or has drifted, emit a reason-coded *ineligible* state for that pair and no numerical difference. Make the registry the sole path to publication; search, fuzzy matching, and AI may suggest candidates but cannot promote them. A revision supersedes a previous mapping rather than silently editing historical meaning. Store only the currently active compact decision in the snapshot; durable history belongs to SPEC-006.

## Quote contract and comparison math

Add a separate, versioned `comparisons` field to `PublishedSnapshot`; keep existing snapshot readers backward compatible with snapshots that lack it. Do **not** derive a cross-venue price from `ProcessedMarket.currentPrice`, a last trade, a generic spread, or an assumed first outcome. Fetch a bounded, targeted quote for each approved pair as part of the existing publisher run. Keep exact token/outcome IDs and retrieve actual best bid and ask for the reviewed side. Capture `receivedAt` immediately after the response; preserve `sourceUpdatedAt` separately if supplied. `receivedAt` is the time Predpulse received a quote, **not proof that the exchange book was updated then**.

Conceptual published shape (types, bounds, and enums enforced at the trust boundary):

```ts
type Comparison = {
  pairId: string; familyId: string; mappingRevision: number;
  proposition: string; classification: "equivalent" | "related" | "review-required" | "not-comparable";
  review: { reviewedAt: string; ruleHashes: [string, string]; summary: string };
  venues: [
    { source: "polymarket" | "kalshi"; marketId: string; outcomeId: string;
      outcomeLabel: string; url: string; bid?: number; ask?: number;
      receivedAt?: string; sourceUpdatedAt?: string },
    { source: "polymarket" | "kalshi"; marketId: string; outcomeId: string;
      outcomeLabel: string; url: string; bid?: number; ask?: number;
      receivedAt?: string; sourceUpdatedAt?: string }
  ];
  eligibility: { eligible: boolean; reason?: string };
  gapPP?: number; // signed, first venue midpoint minus second, percentage points
};
```

The implementation can avoid repeating field definitions with a shared `VenueQuote` type. Store normalized prices as fractions in `[0, 1]`; show percentages to users. Validate `0 <= bid <= ask <= 1`, finite values, correct market status, source URLs, and exact outcome correspondence. A market with a missing side of the book cannot produce a midpoint. If the reviewed proposition is the complement of a venue's quoted outcome, transform its interval to `[1 - ask, 1 - bid]` **before** computing a midpoint; record this orientation so the label always names the proposition being priced. Never complement a team-versus-team market without an explicit reviewed exhaustive binary payout relationship; draws, ties, voids, and multi-winner rules break the shortcut.

For eligible normalized quotes, `mid = (bid + ask) / 2` and `gapPP = 100 * (midFirst - midSecond)`. Show both full bid–ask ranges, their basis and orientation, the signed gap with its direction (“Polymarket midpoint 3.0 pp above Kalshi”), and the two receipt times. Prefer compact top-of-book observations over a single pseudo-probability. Midpoints are descriptions of displayed quotes, **not** executable prices; do not say that a user can buy one venue at the midpoint.

### Time and failure gates

- At publication, both quote receipts must be no more than **10 minutes** old, with receipt skew at most **5 minutes**. These are product thresholds to test, not a claim about venue feed guarantees. Prefer gathering both sequentially in the same small batch and reject if the skew limit is exceeded.
- The UI labels comparisons `As of <latest receipt time>` and shows both times. A published comparison is displayed as a **dated snapshot** for at most **90 minutes after its older receipt**. After that, suppress the numerical *current* gap and show “Comparison unavailable; last checked …” with an expandable last-known context if useful. If `sourceUpdatedAt` indicates an older exchange state, show that older time and fail closed when its meaning supports a stale quote; never mislabel receipt as exchange update time.
- If either venue is closed, halted, settled, rules-drifted, quote-incomplete, malformed, unavailable, or outside these time gates, publish an exclusion reason and **no `gapPP`**. If the entire snapshot is stale (>3 hours under the existing policy), current comparison cards also disappear. Keep the two standalone market links available.
- Rendering must independently recheck eligibility and age against the user's current clock (with sensible tolerance); the publisher's earlier decision does not extend a quote's lifetime. Failed publisher runs must not revive an old number through `previousUrl` or cache.

The existing 17/47 schedule means this is an intermittently refreshed research view. Do not market it as real time or build alerts off it. A later live product would need independently measured quote age, order depth, fees, funding, settlement timing, and comparable payouts.

## Experience

On the existing event detail page, link to a dedicated `/compare/[pairId]` view when a reviewed family is present; retain stable `/events/[source]/[id]` links. The comparison page leads with the exact canonical proposition and two venue labels. Show the compact bid–ask ranges, directional midpoint difference if eligible, observation times, and a short “Why these match” summary. Put the complete field comparison and source rules behind obvious information controls, with an always visible warning when the match is related, review required, or unavailable. On mobile, render the two venues as stacked cards, keep explanation controls within the viewport, and do not use a horizontal table as the only representation.

In the homepage policy/economy monitor, show at most a few eligible reviewed comparisons in a small section or link, after existing high-value content; do not create a global “biggest gap” leaderboard from a thin sample. If there are no eligible pairs, show a short neutral empty state. If a pair is related, show **what differs** rather than a suppressed gap badge. The language everywhere is “quote midpoint difference” and “compared as of”; never “arbitrage,” “free money,” or “market is wrong.” Link each venue name to its original contract. Preserve accessible text for sign, units, and state instead of relying on color.

## Delivery within the free-tier budget

Run rule checking and targeted quote acquisition in the existing GitHub publisher. Keep the registry in git and the bounded comparison digest in the **same** Blob generation and manifest: no per-visitor vendor requests, Vercel ingestion function, additional schedule, or extra Blob publication per pair. Reserve a strict byte budget for comparisons (suggested initial cap **20,000 bytes** and **10 active pairs**), reduce nonessential entries first, and retain the existing 250,000-byte hard limit and safe-publication checks. A candidate registry of 20–30 families does not require 20–30 fetched pairs per run.

Never abort publication of otherwise valid market data solely because one comparison's rule or quote fetch fails. Emit its reason-coded exclusion, with a bounded request timeout and concurrency. If the comparisons schema itself is invalid or the total payload exceeds the limit, reject that candidate snapshot before replacing the manifest. This feature must not make the existing homepage wait for any new upstream API.

## Acceptance and verification

1. A reviewed, equivalent pair with unchanged rules, complete bids/asks, correct orientation, receipt skew ≤5 minutes, and both quotes ≤10 minutes old at publish displays two ranges, timestamps, provenance, and the expected signed midpoint difference. A worked fixture: A `[0.52, 0.56]`, B `[0.49, 0.53]` gives **+3.0 pp** first minus second. Reversed order flips the sign.
2. Identical titles with different deadlines; CPI first release versus later revision; `>` versus `>=`; opposite outcomes; ambiguous team-versus-team ties; different time zones/cutoffs or void rules; and different payout units all stay related or ineligible. Assert that *none* yields `gapPP`.
3. Changing either full rule hash, market ID, or outcome token after review removes the number on the next run; omitted rules and unreviewed candidates also never display one. A previously cached comparison loses its current numeric display once it ages out, even if no new publication succeeds.
4. Missing bid or ask, crossed or out-of-range book, missing outcome ID, closed/settled market, stale quote receipt, >5-minute skew, and source fetch failure each produce the correct explicit exclusion reason. A one-source event never gains a synthetic second venue.
5. The snapshot contract validates the optional comparison digest and its source links; older published snapshots still render. Both the detail view and monitor render on narrow mobile screens. Publishing still performs only the existing Blob generation + manifest writes and stays under 250,000 bytes.
6. Before launch, independently adjudicate the initial candidate families with documented rule diffs; require a second reviewer for every equivalent designation. Measure `candidate families`, `reviewed`, `equivalent`, `quote eligible`, `shown`, and reason-coded exclusions, not just the headline gap count. In a small task-based pilot, ask at least five people to identify the exact proposition, quote time, and reason an excluded pair cannot be compared; record the results and adjust labeling. Do not claim validated product demand from this pilot.

## Evaluation and later work

Review pair coverage and exclusions weekly. Track visits from the monitor to the comparison page and click-throughs to source contracts only in the existing privacy-conscious analytics if enabled. Test whether readers can correctly explain the comparison; ask whether they would return to follow that family. The useful outcome is a repeatable research decision, not a large count of loosely matched markets.

A future matcher could suggest candidates after an adjudicated hard-negative set and an explicit target of **≥95% precision among proposed equivalent pairs**; keep human approval for publication until measured otherwise. Do not introduce an aggregate “market disagreement index” until enough independent, reviewed families exist; if one is later tested, publish median absolute eligible gap, equal weight per family, eligible count, total reviewed count, and excluded coverage together. Durable quote history and calibration belong in SPEC-006.

## Primary references

- [Kalshi market endpoint and rule/quote fields](https://docs.kalshi.com/api-reference/market/get-market)
- [Polymarket Gamma market metadata](https://docs.polymarket.com/api-reference/markets/get-market-by-id)
- [Polymarket token-specific order book](https://docs.polymarket.com/api-reference/market-data/get-order-book)
- [Polymarket bid/ask and midpoint definitions](https://docs.polymarket.com/trading/orderbook)

The time, sample, byte, and UX limits above are Predpulse product decisions; venue documentation does not guarantee that two apparent markets settle identically.
