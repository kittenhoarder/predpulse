# Navigation baseline and verification

Captured 2 October 2026. Implementation remains behind `NEXT_PUBLIC_NAV_V2=1`; default is off. No deployment or production flag change performed.

## Production layout baseline

Read-only Chromium audit of https://predpulse.xyz, 844px viewport height, reduced motion, live production data. Command:

```sh
AUDIT_ROUTES=/,/pulse AUDIT_URL=https://predpulse.xyz AUDIT_OUTPUT=.predpulse/spec-010-baseline.json npm run audit:mobile -- --report-only
```

| Route    | Width | Height | Targets below 44px | Text below 12px | Horizontal overflow |
| -------- | ----: | -----: | -----------------: | --------------: | ------------------- |
| `/`      |   320 |   9069 |                 97 |             113 | Yes                 |
| `/`      |   390 |   8861 |                 97 |             113 | Yes                 |
| `/`      |   412 |   8787 |                 97 |             113 | Yes                 |
| `/pulse` |   320 |   3092 |                  4 |              34 | No                  |
| `/pulse` |   390 |   2980 |                  4 |              34 | No                  |
| `/pulse` |   412 |   2946 |                  4 |              34 | No                  |

Baseline used the initial audit, which excluded SVG text. Current audit measures scaled SVG labels and explicitly exempts marked chart axes. Inline sentence links and uppercase eyebrows are excluded. Measurements record rendered controls including below-fold content. Machine reports are local, ignored artifacts; preview CI uploads reports and traces.

## Implementation verification

Deterministic fixtures include moves, paired contracts, a Fed benchmark, indices, 75 paginated markets and three news cards. These validate layout budgets and interaction behavior; they are not a like-for-like production data comparison.

| Route                          | 320px height | 390px height | 412px height |
| ------------------------------ | -----------: | -----------: | -----------: |
| Today                          |         2418 |         2298 |         2286 |
| Moves                          |         2625 |         2625 |         2625 |
| Outlooks                       |         1048 |          928 |          928 |
| Indices                        |         1727 |         1659 |         1647 |
| Markets, excluding market list |         1241 |         1241 |         1241 |

All 15 fixture layouts pass height, control-size, type-size and overflow checks. Run locally against a flag-on server:

```sh
npm run test:browser
npm run audit:mobile -- --fixture
npm test -- --coverage
```

Thirteen browser tests cover loading/unavailable status, freshness aging, failed revalidation, shared-cache reuse, rapid dismissal, open-sheet budgets, Explore, static methods without JavaScript, direct links, Back/Forward, nested sheets, focus confinement/return, index scroll restoration, unknown IDs, saved filters and market expansion. Pure navigation/Guide/history logic has enforced 85% coverage thresholds. The preview workflow also audits live preview data; unavailable or unexpectedly long content can therefore fail a real layout budget.

## Production enablement gates still pending

- Vercel Analytics: preceding 30 days of page views per route and visits beyond Today.
- Speed Insights: mobile/desktop p75 LCP, INP and CLS; repeat on preview and after launch.
- Five-person comprehension test on production and preview using spec §10.
- Physical iOS Safari and Android Chrome checks, including swipe, safe areas and browser history.
- Flag-on public Vercel Preview verification and remaining manual UAT from spec §9.

These require production analytics access, participants and physical devices; automated Chromium results do not substitute for them. Keep the production flag off until the release gates pass. After launch, compare behavior and performance with the recorded baseline over 30 days.
