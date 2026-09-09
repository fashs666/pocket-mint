# Pocket Mint Phase 0 v0.6.2

Pocket Mint is a local-first Progressive Web App for testing an Australian $1 coin collection catalogue. Personal collection records and photos stay in the browser's IndexedDB database; no account, paid dependency, database, or ongoing-cost service is required.

## v0.6 guided coin identification

- capture or upload the portrait and design sides on Android or desktop
- perform on-device brightness, glare and sharpness checks
- narrow the catalogue by year, portrait, design type, visible words and marks
- rank up to eight candidates with transparent clue-match reasons
- confirm a candidate to add one specimen and attach both photos
- keep all identification photos local unless the user exports a backup

Visual analysis now runs before the fallback clue form. Pocket Mint sends a reduced two-side composite to a Cloudflare-hosted vision model, maps its structured result to the local catalogue, and goes directly to likely matches when the result is decisive. The clue form appears only for uncertain, failed, or deliberately skipped visual analysis. Confirmed original photos remain in local IndexedDB.

## v0.5 collection progress

The Home screen now turns the existing collection data into useful collecting intelligence without changing the local database schema:

- overall catalogue completion count and percentage
- circulation-core completion count and percentage
- missing coin count
- duplicate extras count, plus quick links to duplicate coin records
- Wishlist and Favourite totals
- completed, in-progress, untouched, and total multi-coin series counts
- a **Closest to completion** view for started series
- quick links to the next missing coin in near-complete series
- Home shortcuts for missing coins and Wishlist

All progress is calculated live from the existing catalogue and `myMint` records. Nothing new is persisted for these statistics.

## Deploy with GitHub and Cloudflare Workers Builds

1. Use this repository as the source for the existing `pocket-mint-test` Worker.
2. In Cloudflare, open **Workers & Pages → pocket-mint-test → Settings → Builds**.
3. Ensure the GitHub repository is `fashs666/pocket-mint`.
4. Set **Production branch** to `main`.
5. Leave **Build command** blank.
6. Set **Deploy command** to `npx wrangler deploy`.
7. Keep preview builds enabled if desired.

The root `wrangler.jsonc` deliberately uses the existing Worker name `pocket-mint-test` and deploys the `public` directory as static assets.

## Local checks

With Node.js installed:

```text
npm run check
```

Optional local preview:

```text
npm run dev
```

## Data compatibility

- IndexedDB database name remains `PocketMintPhase0`.
- Database schema remains version 2.
- Existing `myMint`, `personalPhotos`, and `appMeta` stores are reused.
- Existing records missing `favourite` remain valid and default to `false`.
- Existing `date_added` values are preserved. A missing date is automatically set only when quantity first changes from zero to one or more.
- Catalogue files never overwrite personal records.
- v0.5 progress and series intelligence are calculated from existing records and add no new stored fields.

Before testing a deployment, export a backup from **Settings → Export Pocket Mint backup**. After deployment, open the site once online so the v0.5.0 service worker can refresh its offline cache.

## Phase 0 phone checks

1. Add/remove owned quantities and verify overall/core completion updates immediately.
2. Set a quantity above one and verify **Duplicate extras** plus the duplicate quick link.
3. Use **Browse missing coins** and **Open wishlist** and verify the Catalogue opens with the correct filter.
4. Start a multi-coin series and verify **Closest to completion** and its next-missing-coin shortcut.
5. Complete a series and verify it moves from **In progress** to **Complete**.
6. Re-check Wishlist auto-removal, Favourite independence, series detail progress, and Android Back navigation.
7. Export, reset, and restore a backup; Favourite and Date Added must return.
8. Reopen in airplane mode after one successful online load.
