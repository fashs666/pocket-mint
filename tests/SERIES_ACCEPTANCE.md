# v0.14.17 series experience acceptance

Protected baseline: `a45150ec82fe21f121166d2068c8a2ee88617419` (v0.14.16).
Identification engines, candidate ranking, detection, guided camera code and
catalogue data remain unchanged. `camera-entry.js` separately selects native
Android capture; guided capture remains an explicit option and iPhone capture
is unchanged. This is a camera-path workaround, not a claim of tested lens focus.

## Implemented

- Canonical `#series/<seriesId>` route; Home, Stats, details and milestones link to it.
- Value/state filters operate only on designs in that series; all year variants
  of a design count once for completion.
- Home prefers incomplete series, prioritising started/progress/remaining coins,
  with recent activity as a tie-breaker. All series are available through Stats.
- First incomplete-to-complete transitions persist `series_completed` records in
  existing IndexedDB `appMeta`, atomically with the collection record.
- History is independent of current ownership and included in existing backups.
- Existing completed collections receive a non-celebrating baseline record, with
  an unknown original completion date rather than an invented date.
- One-time, dismissible celebration with history-backed Back behaviour.
- Stats → Milestones archive; prior completions remain after removing coins.
- Reusable hero, standard, coin, detail and capsule framing; updated Home,
  series, catalogue, collection, wishlist, Stats, milestones and celebration.
- Duplicate lower Home shortcut row removed; summary destinations remain.

## Automated checks

`npm run check` includes `tests/series-experience.mjs` and existing checks.
The series test uses an in-memory IndexedDB transaction test double, not a real
phone/browser. It covers canonical Outback membership, denomination confinement,
1/2 → 2/2 transition, write-before-celebration, history reload, one celebration,
remove/re-add, failed writes, rapid increments, multi-year design counts, existing
completion migration and Android/iPhone entry selection.

## Browser/device acceptance still required

Local preview is running but the provided browser blocks localhost. No mobile
screenshots or browser acceptance result have been claimed. Before release:

1. At 360, 390 and 430px widths check Home plaques, hero, ring and recent cards.
2. Start with one Outback design owned. Home should show 1/2.
3. Open its series; verify exactly 50c and $1 Outback, and $1-only filtering.
4. Add the missing design; verify normal write, 100% and a single celebration.
5. Test dismiss, device/browser Back, and View completed series from celebration.
6. Verify both owned; Home must prefer another incomplete series.
7. My Mint → Stats → Milestones must show and open the archived Outback series.
8. Remove/re-add; current progress changes, history stays, no new celebration.
9. Reload, export/restore a backup and repeat the history checks.
10. Verify long series names, coin-card density, nav clearance and safe areas.
11. Check no companion covers text, artwork, controls or the completion dialog.
12. Test offline navigation after the new assets have been cached.
13. On Android verify native capture opens and returns the chosen photo; compare
    sharp lettering with optional guided capture. This requires actual hardware.
