# Round 3: Thematic Baskets

## Product

State data-centre moratoriums · 2026 is the first admitted thematic basket. It measures the equal-weight mean of six specific YES quotes, expressed as index points on a 0–100 scale. It is not the probability that any or all states act, a return series, or a causal model. The fixed jurisdictions are Indiana, Louisiana, Missouri, Ohio, Oklahoma and Texas, each weighted exactly 1/6.

The [admission record](spec-009-theme-adapter.md) records exact contracts, common policy definition, common deadline and the individually declared enactment windows. The window starts differ by less than two hours on 29 September; the source panel exposes each exact start. The finite adapter is versioned, with full rules fingerprints. It is not a keyword-based sentiment aggregate or an ongoing manual quote registry.

The current level appears immediately when all six current quotes pass validation. A missing, stale, closed, resolved or changed constituent withholds the aggregate without reweighting survivors or replacing the component. A 24-hour change requires all six matching observations from a saved capture within the existing comparison tolerance. Contributions sum to the unrounded change; displayed rounding is explained beside the chart. Membership, contract identity, rules, window or method changes break comparison continuity.

## Experience

The card shows the basket level and six labelled probability bars. Desktop expansion shows a deterministic SVG composition diagram; mobile uses selectable component tiles. Selecting a component reveals its exact contract, fixed weight, probability pair, source and enactment window. Signed contribution bars explain the movement. Actual hourly captures form the saved level trend, capped at 25 points and shortened when required by the shared payload ceiling. Definition and full source evidence remain one interaction away. Evidence downloads are assembled locally.

The homepage shows three product types: Economics, Fed policy balance and the thematic basket. Politics remains available alongside Economics on the full Indices page. Existing Belief Shift and Fed calculations remain intact. Selection, filters, deep links, Back, Escape and focus restoration share the existing interaction model. Opening cards makes no requests and loads no expansion-specific chunks.

## Serving and persistence

The basket uses events already acquired by the existing Gamma pipeline. No new steady-state acquisition, schedule, endpoint, storage object or storage operation is introduced. It is added to the existing saved index digest and shares referenced observations. The preview uses an isolated spec-009 publication prefix; production remains guarded. A publisher restart retains the persisted evidence and exact basket version. Preview deployments do not themselves collect hourly observations; subsequent publication through the existing workflow supplies the next capture.

The six admitted contracts were present in a fresh acquisition on 1 October 2026 at 15:07:46 UTC, with six usable quotes and a current level of 9.5 points. This confirms present admission, not a guarantee that the existing sampled feed will retain each event. A dropped event produces an explicit unavailable state.

## Resource review exception

The strict no-growth gate does **not** pass. Preserving full comparison evidence requires raising the shared index allocation from 14,600 to 20,000 bytes. This remains below the original 32 KB hard limit but needs explicit acceptance before merge. Only optional chart history is trimmed; required evidence overflow fails before writes. Other product content and evidence are retained.

Frozen-input measurements are in [spec-009-resource-results.json](spec-009-resource-results.json). They are local measurements, not billed Vercel CPU guarantees.

| Measurement | Round 2 | Round 3 |
| --- | ---: | ---: |
| Filled index JSON | 14,572 B | 19,996 B |
| Generation gzip | 37,616 B | 38,851 B |
| Bootstrap gzip | 21,803 B | 23,029 B |
| Homepage route JS gzip | 154,309 B | 156,787 B |
| Indices route JS gzip | 122,693 B | 125,169 B |
| Cold publication storage operations | 3 reads, 2 writes | 3 reads, 2 writes |

The original retired Pulse allocation was 14,621 bytes. Round 3 also exceeds that baseline. First capture is 15,203 bytes; the first full paired capture is 18,105 bytes. The 2,000-event stress calculation took 98.4 ms; typical frozen-input calculation median was 17.2 ms and saved validation 0.28 ms. No unchanged non-index content was removed. No dependency was added.

## Verification and UAT

217 tests across 22 files pass, including fixed membership, arithmetic, incomplete pairs, invalid metadata, identity/window breaks, contribution sums, evidence validation, payload overflow and restart persistence. Type checking, lint and production build pass. Production browser checks cover desktop dark and 375 px light layouts, expanded 200% zoom, reduced motion, keyboard component selection, download, filters, deep links, focus restoration, homepage reuse, existing market detail and heatmap flows, no expansion API requests and no runtime errors.

Available-comparison browser fixtures are explicitly local, retimed and changed test inputs. They do not constitute real 24-hour product acceptance. Live UAT must inspect the first current capture, then a genuine matching capture approximately 24 hours later through the existing publisher. Review the six sources and fixed weights, select components, inspect contribution totals once paired, test missing-data behavior, and review the 20 KB allocation exception. This round remains a separate draft stacked on Round 2; no rounds are merged automatically.
