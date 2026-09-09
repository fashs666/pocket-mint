# Validation report — Pocket Mint Phase 0 v0.5.0

Prepared 9 September 2026 for branch `v0.5-collection-progress`.

## Automated validation target

`npm run check` now validates both JavaScript entry points and the repository validator:

- `node --check public/app.js`
- `node --check public/progress.js`
- `node validate.mjs`

The validator checks:

- visible v0.5.0 marker
- compatible IndexedDB name `PocketMintPhase0`
- database schema remains version 2
- Favourite and automatic Date Added support remains present
- History API navigation remains present
- collection and series intelligence module is loaded
- duplicate and near-complete-series summaries are present
- service-worker cache is `pocket-mint-phase0-v0.5.0`
- `progress.js` and `progress.css` are included in offline assets
- manifest start route and icons remain valid
- catalogue JSON remains non-empty with unique IDs and series data

## Data compatibility

v0.5 introduces no IndexedDB migration and no new stored fields. Collection completion, duplicate counts, and series summaries are calculated live from the existing catalogue and `myMint` records.

## Manual phone/PWA acceptance still required

1. Overall and circulation-core percentages update when quantities change.
2. Duplicate extras count equals the total quantity above one across owned coins.
3. Missing and Wishlist shortcuts open the expected Catalogue filters.
4. Near-complete series and next-missing-coin shortcuts behave correctly.
5. Completed series move into the Complete count.
6. Existing Wishlist, Favourite, Date Added, series-detail and Android Back behaviour remains intact.
7. Backup/reset/restore keeps existing personal data.
8. Offline relaunch succeeds after the v0.5 service worker activates.
