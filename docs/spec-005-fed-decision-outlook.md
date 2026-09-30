# SPEC-005: One defensible decision distribution

Status: implemented pilot. Updated: 2026-09-30. Depends on SPEC-001 snapshots.

## User outcome

Answer “Which outcomes are being priced for the next Fed meeting?” using one named event with an explicit decision partition. This is a venue-implied outlook, separate from the existing descriptive Pulse scores. No human pairing, event registry, model calls or daily operating work is required.

## Scope and automatic discovery

Versioned adapter `fed-meeting-buckets-v1` supports Polymarket's “Fed Decision in [month]?” family. Use the raw events already fetched by the publisher, before liquidity filtering removes tiny tail contracts. Parse the meeting's final day and year from its resolution rules. Select the nearest future meeting, deterministically breaking ties by event ID. A supported event must describe the upper bound of the target federal funds range, rounding nonstandard changes up to the nearest 25 bp, FOMC statement resolution, the official Fed calendar and the no-statement fallback to “No change”.

The adapter requires exactly these mutually exclusive, exhaustive brackets under those common rounding rules: 50+ bp cut, 25 bp cut, no change, 25 bp hike, 50+ bp hike. All five children must have identical complete resolution text after whitespace and typographic quote normalization and the same close time. Missing, duplicate, extra, reordered/unknown binary outcomes, closed or archived contracts do not become inferred observations. Cumulative “by date” markets, rate levels, other banks and different meetings are excluded. Changes in the venue contract family require a new adapter version. This is structural validation of a supported template, not general semantic inference or a claim that all central-bank contracts have been verified.

Do not silently replace an incomplete nearest meeting with a farther meeting. Publish the known raw buckets with a reason and withhold derivatives. Show a compact unavailable state when the sampled source feed contains no supported event. Sampled discovery is not exhaustive venue coverage.

## Prices and calculations

- Prices stay on the 0–1 scale in storage. Each analytical value is the midpoint of an active, Yes-first binary contract's YES bid/ask book. Preserve the two quotes, contract ID and venue update time. No last-price fallback, zero-filled missing prices, or invented probability mass.
- Usable quotes require finite `0 <= bid <= ask <= 1`, nonzero ask and spread at most 10 pp. A zero bid with a positive ask remains valid. Venue update time must be no older than 75 minutes at acquisition and no more than five minutes in the future. A venue update timestamp is a feed timestamp, not proof of a last trade or tick timestamp.
- Raw total `S = sum(midpoint)` is available only when all five quotes are usable. Raw bars never silently normalize.
- Normalization is opt-in and eligible only for the complete supported partition, matching rules/close, recent venue updates and `0.95 <= S <= 1.05`. Display `q = midpoint / S` and explicitly state the original raw total. This tolerance is a provisional product rule.
- Show normalized cut, hold and hike shares only in the normalized view. These sum the appropriate normalized brackets. Never combine venues.
- Both tails are open-ended. `expectedChangeBps` is always null. No mean rate change, expected terminal rate, interpolated tail or joint forecast is published.
- Saved data validates schema version, bounds, timestamps, source URL, rules fingerprint, quote/midpoint consistency, raw sum and normalized shares. Invalid optional data is withheld without aborting core snapshot publication.

## Publication and cost

Retain only candidate raw event families during `fetchAllSources({fresh: true})`; visitor acquisition does not retain or compute them. Compute the digest once in the GitHub publisher. Store it inside the existing immutable generation and serve it in the existing `/api/bootstrap` response. No extra vendor requests, routes, polling loops, Blob puts, lists, archives or dependencies are added. Maximum digest size is 12 KB, inside the existing 250 KB envelope. Optional content can be withheld near the byte limit; absence is visible on the homepage.

Keep the existing hourly cadence with fallback schedule attempts and the 50-minute duplicate-publication guard. The PR branch has a separate `predpulse/previews/spec-05` Blob prefix and one push-triggered publisher for review. Per-branch concurrency keeps a preview publish from blocking production. The main publisher remains on the production prefix.

## Presentation

Place the “Decision outlook” card after newsroom/freshness and before the policy/economy monitor. Show exact meeting date, venue, price basis, five labelled horizontal bars, raw total, priced bucket count and snapshot date. Bars use a fixed 0–100% scale. Raw/Normalized buttons are touch-sized, keyboard accessible and expose pressed state. Bid/ask values remain visible as data. No chart dependency is needed.

Reuse `MetaNote`: method icon holds calculation, eligibility and exclusion reasons; evidence icon holds the full shared resolution rules, contract IDs, venue updates, scheduled close and rule hash. Keep methodology prose out of the main reading flow. Link the original venue event containing all outcome contracts. An unavailable normalization state stays visible; reasons are one tap away.

When the global snapshot is stale (>3 hours), retain labelled last-known raw prices and suppress normalization/derived shares. Delayed snapshots retain the existing page freshness label. Older snapshots without this optional field remain compatible and show the unavailable state. A new snapshot resets the view to raw so an update does not silently retain an adjusted interpretation.

## Acceptance and verification

1. Synthetic known distributions reconstruct cut/hold/hike shares; a 102% raw total remains visible and normalizes to 100% only on request.
2. Missing/duplicate buckets, overlapping thresholds, changed rules, different meetings/closes, closed/reordered contracts, invalid/wide quotes, missing/old/future updates and incoherent totals withhold all normalized values.
3. Low-volume tails stay in the partition. Future meetings sort by date. Cumulative and unsupported events are excluded.
4. Persisted incorrect sums/shares and any invented expected rate change are rejected. Snapshot readers accept older generations without the digest.
5. Main and preview manifests remain isolated. The publisher logs meeting, eligibility, exclusion reason and raw total.
6. Mobile bars and controls fit the viewport; the method/evidence icons use the existing shared interaction. No vendor requests occur when toggling the display.

## Limits and next step

One supported Polymarket family is the pilot, not an automatic cross-venue macro index. Kalshi support needs a separate adapter establishing its outcome partition, official rules and compatible quote semantics. Durable point-in-time history and calibration belong to SPEC-006. Do not present this implementation as a validated forecasting model.
