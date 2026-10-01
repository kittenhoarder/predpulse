# Market Attention: implementation and UAT

This replaces PR #37's finite six-state basket. The branch starts from Round 2 and contains none of the old adapter, frozen contracts, quote pairs or basket history. The [revised specification](spec-009-attention-map.md) defines the product.

The saved map partitions venue-reported rolling 24-hour event volume into seven stable categories, with exact tag precedence. It refreshes automatically from the existing sampled feed on every existing publication. A valid first capture is immediately useful; no baseline, manual successor list or forecast interpretation is required.

The compact overview and selectable detail use a deterministic SVG area partition, category colours, a complete legend and bounded leading source examples. Tiny categories remain selectable through the legend; zero volumes receive no artificial area. Downloads label their source rows as examples, not a full constituent archive. Sample completeness is not claimed. Homepage has three cards: Economics, Fed policy balance and Market Attention; Politics remains on the full Indices page.

## Resource results

Frozen input: 1 October 2026 at 11:10:08 UTC, 500 already acquired Polymarket events. Independent reconciliation found 500 eligible events and reported volume of $33,541,309.084289. Sports accounted for 36.4%, Politics 31.1%; these are shares within this capture, not whole-market shares. The same full publication sources were used for the before/after comparison.

| Measurement | Round 2 | Replacement |
| --- | ---: | ---: |
| Filled index JSON | 14,572 B | 18,556 B |
| Generation JSON | 196,250 B | 200,234 B |
| Generation gzip | 37,616 B | 38,997 B |
| Bootstrap gzip | 21,803 B | 23,207 B |
| Homepage route JS gzip | 154,309 B | 157,260 B |
| Indices route JS gzip | 122,693 B | 125,642 B |
| Cold publication storage operations | 3 reads, 2 writes | 3 reads, 2 writes |
| Restart / paired publication operations | 5 reads, 2 writes | 5 reads, 2 writes |

The standalone map is 3,965 bytes. Its pure calculation median is 1.21 ms, p95 2.13 ms, over 30 warmed runs. Saved map validation median is 0.015 ms. Paired full-builder measurements show added calculation median 2.03 ms, p95 4.38 ms. These are local measurements, not billed Vercel CPU guarantees. [Machine-readable results](spec-009-attention-resource-results.json) include full details.

All spec transfer and compute targets pass. No acquisition requests, storage objects, operations, schedules or dependencies were added. Opening the map, selecting categories and exporting evidence require no API requests or expansion chunks. There is no animation loop or map history.

The strict no-growth gate still fails. Shared index allocation is proposed at 20,000 bytes, retaining the preceding rounds' own 14,600-byte evidence/history allocation. The map does not enlarge their history budget. Existing required index observations, product calculations and non-index content are retained. Required overflow fails before writes; source examples are pruned within the map's separate 4 KB cap. Acceptance of the shared allocation increase remains a merge gate.

## Verification

218 tests across 22 files pass. Coverage includes one-count-per-event arithmetic, tag precedence, malformed tags and volume, duplicates, source bounds, Unicode title limits, deterministic pruning, renewal without a registry, saved validator tampering and rectangle area/non-overlap. Restart tests prove unchanged reads/writes and no venue acquisition; saved serving tests include the map.

Type checking, lint and production build pass. Production browser verification covers desktop dark and 375 px light layouts, expanded 200% zoom, reduced motion, keyboard and pointer category selection, tiny/zero categories, local download, filter, deep link, Back/Escape/focus restoration, homepage three-card limit, existing market detail/heatmap flows, zero selection/expansion API requests or new script loads, and no runtime errors.

Attention values in captured browser fixtures are genuine captured volumes. Existing Round 1/2 comparison fixtures are retimed for regression verification; tiny/zero map scenarios use clearly local synthetic test data. They are not claims about current venue conditions. Live deployment values may differ as the next publication renews the feed.

## UAT

1. Open `/pulse?index=market-attention`. The current map should be populated immediately when the saved capture has positive eligible volume.
2. Select categories using tiles or the legend, including small categories. Verify the share, full category count, reported volume and linked source examples update together.
3. Inspect source scope: the map represents the captured event sample; source examples are not the whole denominator. Download and inspect the exact saved summaries.
4. Test mobile, zoom, Back and Escape. Homepage should show three product cards and the full Indices page should retain Politics.
5. On a subsequent existing publication, composition renews without code or manual IDs. Preview navigation does not itself acquire data or create a new collection schedule.

Keep this replacement as a separate draft stacked on Round 2. Earlier rounds remain unmerged. PR #37 is superseded and must not be included in the release.
