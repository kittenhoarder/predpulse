# SPEC-004 — Automated related markets across venues

**Status:** implemented showcase feature · **Updated:** 2026-09-28
**Dependencies:** published snapshots (SPEC-001), typed observations (SPEC-002), event monitor (SPEC-003)

## Purpose

Let visitors discover Polymarket and Kalshi contracts on a similar topic, see what each actually asks, and inspect its original contract. The showcase updates without anyone hand-pairing contracts. A shared title does **not** establish identical settlement; do not calculate or display a cross-venue price gap or claim arbitrage.

## Automated publication

1. The existing GitHub publisher processes its already-fetched open Polymarket and Kalshi markets. A pure, bounded matcher considers politics, economics, geopolitics, crypto, sports, tech, climate and entertainment with a future close, activity/liquidity floor and at least three meaningful title terms.
2. Candidate titles must share at least three informative terms, at least 60% of the shorter title's terms, a Jaccard overlap of at least 0.38 and close no more than 60 days apart. Common filler terms are discarded. Rank by similarity with a small close-date adjustment; select at most eight pairs, at most once per underlying market. If there are no title pairs, show **one** clearly labeled category overview with a liquid open market from each venue. Those two contracts may refer to completely different events. There are no vendor requests for discovery, no ML model, and no registry or reviewer workflow.
3. Publish a versioned `related` digest alongside the existing snapshot. It contains both source titles, outcome labels, **source-specific price bases**, displayed values, scheduled closes, source links, a short available Polymarket rule excerpt and matching terms. Limit the digest to 14,000 bytes and remove supplemental pairs if the existing 250,000-byte snapshot limit would otherwise be exceeded. A failed or empty discovery leaves the rest of the publication intact.
4. Continue using the existing GitHub schedule, Blob generation and manifest. Do not fetch venues from visitor traffic or add new Blob writes. The UI always identifies the dated snapshot; stale homepage content is withheld by the existing three-hour policy.

## Visitor experience

- Place at most two compact paired cards after the policy/economy monitor when the published digest contains results. Each card links to a mobile-friendly detail page showing both question texts, outcome labels, quoted prices with **distinct price-basis labels**, close times and links to full venue rules. A category-only card explicitly says there was no event match.
- State near the title that the contracts were paired by topic terms and their settlement equivalence has **not** been verified. Explain the shared terms on the detail page. Never show a numerical cross-venue gap, a combined probability, or an execution/arb claim.
- If no pair passes the screen, add no empty section to the homepage. An individual source event links to its related pair when that event is present in the bounded snapshot.
- A Kalshi YES ask and Polymarket outcome market price are different observations. Present each with its own basis. A pair may have different wording, deadlines, resolution sources or outcome semantics. Readers must inspect the original venue terms before comparing them.

## Acceptance

- The matcher is deterministic for a given source snapshot and never repeats a contract across displayed title pairs. Expired, small and weakly similar markets are excluded from title matching. Altering a deadline past the 60-day bound removes the title relationship; at most one unrelated category overview may appear instead.
- Published URLs must point to the correct venue; values must be finite and within 0–100%, timestamps parse, and the digest must respect the 14,000-byte limit. Old snapshots without `related` still render.
- The homepage and detail view must display the precise separate outcomes, price bases and close dates; neither may imply identical settlement. On mobile, the source cards stack vertically. Both original contract links must work.
- Only one snapshot generation and one manifest write are performed, as before. Build and tests pass. Observe actual published pair count and click-throughs before changing the title threshold or expanding categories; the selected upstream universe is sampled, so an empty result does not imply no similar markets exist.

## Limit

This is automated **discovery and context**, not verified event equivalence. Genuine numerical differences require a later method that establishes identical settlement and compatible quote bases. The earlier manual registry design was removed because it would leave a showcase feature empty and require continuing operator work.
