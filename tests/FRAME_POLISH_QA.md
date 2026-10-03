# Visual frame refinement QA

Baseline: main `c73ef331fb2d98f97dd26f70e8fca0005c1a907a` (v0.14.17).

The shipped application change is CSS only in `public/pm-frames.css`.
No application JavaScript, HTML, catalogue, storage, routes, camera, service
worker, companion animation or identification implementation changed.

## Executed checks

- `npm run check`: passed (syntax, catalogue validation, single/batch Identify,
  camera contracts, series transitions/history, reports and companion motion).
- Mobile-layout preview at 360, 390 and 430 CSS pixels: Home (empty and owned),
  collection, Outback series, completion dialog, Stats and coin details inspected.
- Browse coin rows inspected at 390px, including long names and multi-year cards.
- Collection +/-/favourite controls measured at 44 x 44px at all three widths.
- Collection and detail document scroll widths matched client widths:
  343/343, 373/373, 413/413px (desktop scrollbar consumes 17px of iframe width).
- Added both Outback coins through the isolated preview UI; collection totals,
  owned controls and completion celebration continued to work.
- Warm layered frames, arched coin wells, compact two-column density, calm detail
  information, safe bottom navigation and restrained accent treatment reviewed.

## Limits / remaining verification

- These are CSS viewport checks, not physical Android/iPhone hardware tests.
- Existing roaming companions can briefly cross headings/coin artwork. Their
  positions and motion were deliberately not changed in this visual-only pass.
- Final Stats tile/button consistency overrides need a refreshed preview review;
  the preview provider retried a failed build while QA was running.
- A populated Wishlist, milestone archive and live Identify result were not
  separately visually verified in this pass. Their underlying behaviour is unchanged.

## Reusing the fixture

`tests/frame-review.html` is an isolated QA fixture, not part of public assets.
Temporarily serve it beside the app on a disposable preview origin to compare
three viewport widths. Test collection writes affect that preview origin only.
Use real app navigation for interaction tests. The frame selectors are visual
QA shortcuts and are not application navigation.
