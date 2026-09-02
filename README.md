# Pocket Mint Phase 0 v0.4.1

Pocket Mint is a local-first Progressive Web App for testing an Australian $1 coin collection catalogue. Personal collection records and photos stay in the browser's IndexedDB database; no account, paid dependency, database, or ongoing-cost service is required.

## Deploy with GitHub and Cloudflare Workers Builds

1. Extract this repository ZIP.
2. In GitHub, open the empty `fashs666/pocket-mint` repository and upload **the contents of this folder** to its root (not the enclosing ZIP folder). Commit the files to `main`.
3. In Cloudflare, open **Workers & Pages → pocket-mint-test → Settings → Builds → Connect**.
4. Choose **GitHub**, then select `fashs666/pocket-mint`.
5. Set **Production branch** to `main`.
6. Leave **Build command** blank.
7. Set **Deploy command** to `npx wrangler deploy`.
8. Keep preview builds enabled if desired, then choose **Connect and deploy**.

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

Before testing a deployment, export a backup from **Settings → Export Pocket Mint backup**. After deployment, open the site once online so the v0.4.1 service worker can refresh its offline cache.

## Phase 0 phone checks

1. Wishlist a coin, then increase its quantity: Wishlist must clear.
2. Favourite a coin independently of ownership and Wishlist.
3. Open a coin in a multi-coin series and verify progress plus **More coins from this series**.
4. Navigate Home → Catalogue → coin detail, then use Android Back: detail → Catalogue → Home.
5. Export, reset, and restore a backup; Favourite and Date Added must return.
6. Reopen in airplane mode after one successful online load.

  
