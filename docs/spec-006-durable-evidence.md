# SPEC-006: Durable evidence and valid evaluation

Status: implemented evidence pilot. Updated 30 September 2026.

## User outcome

Inspect what Predpulse actually captured, revisit a saved generation, download reproducible evidence and distinguish unavailable data from no movement. No account, curator, manual outcome registry or paid service is required. Forecasting effectiveness is not claimed.

## Prospective capture

The scheduled publisher screens its existing Polymarket sample for the spec-005 event topics, at least $10,000 reported daily volume and a future close within 90 days. Select one active Yes-first binary contract per event family by reported contract volume, breaking ties by contract ID. Admit up to 16 contracts. This is a small prospective cohort, not representative venue coverage. Capacity exclusions are counted. The cohort is sticky: missing, discontinued, closed and settled contracts are retained rather than silently replaced by survivors. No automatic weighting or training uses holdout observations.

Capture the source, market ID, YES outcome token, venue event family, exact contract question, full rules (bounded to 3 KB), SHA-256 rules fingerprint, mapping version, methodology version, price basis, venue update time, ingestion time, market status and close time. Unsupported outcome mappings are never guessed. A changed rule version is new evidence, and invalidates comparable history. Rules too large for the pilot are excluded rather than silently truncated into an allegedly complete rule version.

Fresh finite YES books must be uncrossed with positive ask and spread at most 10 percentage points. Venue update time must be within 75 minutes, with five-minute future tolerance. A venue update is not necessarily the time of the last trade. Missing or stale observations have null prices. Retain both bid and ask with the midpoint; do not use category scores or last-price fallbacks.

## Durable archive and replay

The existing immutable snapshot generation is the historical record. The existing manifest gains a bounded catalogue of at most 750 generation references within 30 days. References use private Blob URLs validated against the current preview/production prefix; callers can supply timestamps, never arbitrary storage URLs. The original generation is never modified by a subsequent price, rule or settlement correction. The manifest uses its previously read ETag for conditional publication, so a concurrent writer cannot silently replace the catalogue.

Capture happens without visitor traffic. Restart/redeployment uses Blob records, not process memory or `/tmp`. Earlier generations without evidence are compatible and unavailable, not reconstructed as observations. Archiving begins with this release. The archive index is bounded; physical old generations are not deleted by this PR and storage still grows. Deletion/longer retention needs a measured storage policy rather than a hidden quota assumption.

At each publication, load at most one saved generation near t−24h, within ±45 minutes. A change requires the same contract, outcome identity, quote basis, rule version and close time, active on both observations, with usable quotes. Save the actual historical timestamp and midpoint alongside the current midpoint and change so the downloaded generation reproduces the arithmetic. Missing matches produce null. Changing rules, closes, mappings or settlement status suppresses the pair. Legacy descriptive index deltas also return null outside this tolerance rather than labelling an arbitrary short history as 24 hours.

## Automated settlement evidence

The publisher performs up to eight follow-up `GET /markets/{id}` calls per run, oldest checked first, in pairs with five-second timeouts and bounded response sizes. This keeps tracked contracts visible when they leave the sampled feed. Failed attempts rotate through the cohort rather than starving other contracts. No venue follow-up occurs on a visitor path.

A settlement observation requires a closed Yes-first binary contract, `umaResolutionStatus=resolved` and exact complementary terminal payouts of 0/1. Closed alone, proposed/disputed oracle states and near-terminal prices are insufficient. Preserve the authoritative venue endpoint, ingestion/update timestamps, outcome identity, rule hash and a deterministic fingerprint. Repeated identical evidence is idempotent. Corrections append new revisions, with up to four retained in the current record; earlier immutable generations preserve the preceding evidence. These are venue-reported settlements, not independently verified public result times.

The old unauthenticated outcome POST is removed (HTTP 410). No visitor can insert research outcomes. Legacy local-store outcomes are unverified and excluded from the new evaluation.

## Evaluation boundaries

Remove the category-score/100 backtest. Missing Brier loss/log loss return null and sample size zero. The old ordinary least-squares calculation is precisely named `binaryOutcomeLogitOlsSlope`, not logistic calibration. No calibration slope is published for the new cohort.

The pure exact-contract evaluation harness accepts only a declared 24-hour lead observation within ±45 minutes of a proven public result time, unchanged rule version, frozen methodology and a chronological holdout. It deduplicates event families and compares Brier loss with a declared 50% baseline. The prospective holdout boundary is seven days after cohort capture starts. This split is provisional, not a claim of adequate power.

The production Gamma adapter cannot establish when a result became public, so it emits no qualified forecast cases. A frozen observation around scheduled close is retained as evidence but does not qualify merely because venue settlement happens later. Forecast losses, calibration, uncertainty, aggregation improvement and directional classifier results remain unavailable. Verified public-result-time adapters and clustered uncertainty are explicitly deferred; this release must not imply those scientific evaluations are complete. Promotion remains disabled even if there are many settlements. The roadmap gate requires at least 100 independent resolved families, a holdout period and uncertainty intervals; correlated strikes are not independent samples.

Separate actual comparable 24-hour price movements from terminal forecasting. This release provides evidence for descriptive monitoring, not a trained directional classifier or a validated cross-venue aggregate.

## Interface

Reuse the shared MetaNote icons. Add a small Evidence & history link under Event outlooks. `/research` shows the captured generation time, tracked contracts, valid historical-pair count, venue-reported settlement count and qualified forecast count. Methodology, limitations, exact rules and revision evidence stay in icons. A generation selector shows recent hourly and daily historical choices; missing older evidence has an explicit empty state. Downloaded JSON reports the actual generation time and fixed observation inputs. No additional homepage polling, chart dependency or permanent marketing text is added.

## Budget and deployment

Continue one immutable generation put and one manifest put per publication. The evidence digest is capped at 100 KB within the existing 250 KB generation envelope. Trim optional related/outlook content and supplemental explorer rows before failing a publication; protect monitor rows and at least one row per venue. Do not discard the evidence cohort to make a new publication appear successful. The catalogue is bounded to 180 KB, usually smaller. Existing hourly schedules and duplicate-run guard are unchanged. Preview publication uses `predpulse/previews/spec-06` and cannot change the main manifest.

Basic reads, manifest transfer, accumulated generation storage and up to eight venue calls are added costs. All acquisition/calculation runs in GitHub Actions. Vercel reads saved data; history is requested only on the research page/export. No paid database or tier change. Current account-wide quotas have not been measured, so the bounds are implementation limits, not proof that every shared quota can never be reached.

## Verification

Tests cover serialize/reload replay, two-write publication, module restart, immutable historical reads, isolated preview manifest, exact 24-hour pairs, rule changes, missing contracts, outcome reordering, proposed/disputed versus resolved evidence, idempotency/corrections, cohort/catalogue limits, retired public writes, null metrics and holdout/lead/mapping gates. Production build checks server/client boundaries and nullable delta rendering. Live preview verification must confirm both a successful publisher and captured evidence arriving in `/api/research`; a green deployment alone is insufficient.
