# SPEC-008: Outcome Benchmarks, Round 2

Adds one diagram-led product, Fed policy balance, to the existing Indices section.
Economics and Politics Belief Shift remain. Event outlooks and all other products
retain their content and data paths. The PR is stacked on SPEC-007; merge neither
round automatically. Round 3 is outside this change. Product acceptance is UAT.

## Reading and evidence

Use the existing `fed-meeting-buckets-v1` adapter once per publication, supplying
its result to both Event outlooks and Indices. The nearest supported meeting is
selected even when incomplete. No roll-forward to a healthier later meeting.
Require the complete ordered five-outcome partition: 50+ bps cut, 25 bps cut,
Hold, 25 bps hike, 50+ bps hike. The adapter validates common settlement rules and
close dates, explicit YES books, spread ≤0.10, source updates within 75 minutes
(five-minute future tolerance), and a 95–105% raw midpoint sum. Index evidence
also requires valid numeric market/family/token identities and exact questions.
Invalid or absent evidence produces a specific unavailable state, never zero.

Normalize each midpoint by the full five-outcome sum. Cut is the first two shares;
Hold the third; Hike the last two. `balance = 100 × (Hike − Cut)` in percentage
points on a fixed −100 to +100 axis. The dominant outcome is labelled separately:
a positive balance can coexist with Hold being most likely. This reading is
neither a probability nor expected basis points. Open tails keep
`expectedChangeBps = null`.

Current balance can be available on the first capture. The 24h change requires
the existing saved baseline within ±45 minutes of t−24h and all five identities
matching: market, family, YES token, exact question, full rules fingerprint,
meeting, close, methodology, adapter, mapping, quote basis and normalization.
Normalize the previous partition separately, then subtract its balance from the
current balance. Save current/prior bid, ask, midpoint, source update timestamps,
identity fingerprints and derived values. Reuse a shared observation if a Fed
contract is already in Belief Shift. No approximate baseline or historical Pulse
conversion. JSON exports expose these inputs and explain that full rules are
represented by fingerprints rather than embedded text.

Keep up to 25 actual hourly balance points. Gaps, changed identities/meetings and
missing hours break chart lines. Only oldest optional history may be removed to
fit the evidence allocation. Required pairs and other products are preserved.

## Interaction

Three homepage cards: Economics, Politics, Fed policy balance. The full page
adds local All / Belief Shift / Outcome Benchmarks filters. The Fed card shows a
signed balance axis and a labelled Cut/Hold/Hike distribution. The expanded
region adds the complete five-bucket distribution, previous-capture outlines,
24h balance change, fixed-axis saved history and source evidence. Every chart
has a text alternative. Keyboard opening, close, Escape and browser Back restore
focus; `/pulse?index=fed-policy-balance` deep-links to the expanded region.

No additional homepage API call, card-expansion fetch, index chunk request,
polling or venue fallback. JSON downloads are generated locally. SVGs require no
new chart dependency. Existing market details defer their heavy chart code until
opened, with a loading state; their data paths remain unchanged.

## Publication and resource review exception

New branch `feat/spec-008-outcome-benchmarks` uses isolated Blob prefix
`predpulse/previews/spec-08`. Its push uses the existing publisher workflow;
there is no new schedule. Three reads on cold publication, five with saved
previous/baseline evidence, and two writes are retained. Production writes still
require explicit main identity. The generation ceiling remains 250,000 bytes;
required evidence overflow fails before writes. Archived v1 and Round 1 digests
remain readable.

**The strict no-growth gate against Round 1 does not pass.** Five complete Fed
pairs require more evidence than its 11,000-byte allocation. This proposal raises
the shared index ceiling to **14,600 UTF-8 JSON bytes**, below the measured retired
Pulse allocation of 14,621 bytes. This is an explicit review exception, not a
claim of zero additional compute or bandwidth. It must be accepted or redesigned
before merge. Nothing was removed from another product to fit this feature.

Same frozen source capture as Round 1, with 500 raw events. Filled history retimes
unchanged prices to exercise bounds; it is not genuine 24h market evidence.

| Filled-history measurement | Original Pulse | Round 1 | Round 2 |
|---|---:|---:|---:|
| Index JSON | 14,621 B | 10,974 B | 14,572 B |
| Index gzip | 3,165 B | 3,035 B | 3,744 B |
| Generation JSON | 196,291 B | 192,652 B | 196,250 B |
| Generation gzip | 37,031 B | 36,901 B | 37,616 B |
| Homepage bootstrap JSON | 111,725 B | 108,034 B | 111,632 B |
| Homepage bootstrap gzip | 21,344 B | 21,213 B | 21,803 B |

Cold Round 2 index JSON is 10,293 B. Hot index calculation median is 16.87 ms
(20 local runs); saved validation median is 0.18 ms (100 runs). Full publication
with mocked storage/acquisition took 593 ms versus 759 ms for Pulse in this run;
these timings do not measure Vercel account-wide quotas or hosting CPU guarantees.
Stress calculation on 2,000 raw events took 85.17 ms. Initial per-route JS gzip
is 154,309 B on the homepage (Round 1: 259,459 B; Pulse: 264,008 B), and 122,693 B
on `/pulse` (Round 1: 120,423 B; Pulse: 216,160 B). The index page therefore also
has a 2,270-byte increase against Round 1 despite remaining below original Pulse.
Raw results: [spec-008-resource-results.json](spec-008-resource-results.json).

## Verification and UAT

Automated tests cover the declared −10 current / +5 prior / −15 pp delta example,
independent normalization, missing/duplicate/stale/invalid buckets, rules and
close mismatches, token changes, nearest-invalid meeting selection, identity and
method resets, tampered saved arithmetic, restart durability and operation counts.
All 200 automated tests, lint, TypeScript and the production build pass.
Production browser checks cover desktop dark and 375 px light layouts, zoom,
reduced motion, filters, deep links, local export, focus restoration, zero/warming
states and existing deferred charts. Retimed comparisons verify UI only.

UAT should inspect the actual saved meeting and its five source quotes, confirm
that the dominant outcome and balance are understandable together, open/close
and filter both product types, and verify the prior outline/change after a real
comparable 24h publication. Preview branches publish on push or manual rerun;
they do not inherit production's rolling schedule. Initial preview comparison
is therefore warming. Genuine saved-pair UAT remains pending until that capture.
