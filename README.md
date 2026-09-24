# Pocket Mint v0.13.2

## v0.13.2 iPhone camera-input repair

- keeps selected iPhone camera files alive until Pocket Mint has finished decoding and preparing them
- separates the ordinary photo chooser from a native rear-camera input
- adds a visible “Use phone camera” fallback when the full-screen guided camera is unavailable
- preserves the fixed-size circular guide for devices that support the guided camera

Phone check: refresh the installed app, then try the guided shutter, **Use phone camera**, and **Choose photo**. Each route should return to Step 1 with the selected coin preview still visible.

## v0.13.1 live visual-input repair

- sends Llama 4 coin photos through its required multimodal message format
- locks the circular camera guide after opening and disables accidental pinch-zoom inside the camera
- makes “Choose from gallery” a true gallery picker rather than launching the device camera

## v0.13.0 guided coin capture and clean collection images

- Added a full-screen guided camera with a circular coin target and direct camera-stream capture.
- New photos are centre-cropped into a transparent coin specimen for previews and My Mint.
- Identification now checks the design side first and only analyses the portrait side when the design or year remains uncertain.
- Kept standard Five Kangaroos and Mob of Six Roos catalogue records out of automatic identification suggestions.

## v0.12.3 stop false standard-kangaroo matches

- keeps Five Kangaroos and Mob of Six Roos in Browse but excludes them from photo identification
- prevents generic words such as “DOLLAR” and “kangaroos” from becoming a match
- stops issue group and a guessed standard type from awarding identification points

## v0.12.2 visual-analysis limit reporting

- reports an exhausted daily Workers AI allowance clearly instead of showing a generic visual failure
- keeps the licensed backup model opt-in until its Meta licence has been accepted by the account owner

## v0.12.1 vision runtime fallback support

- adds support for Cloudflare's documented Llama 3.2 Vision model once explicitly enabled after licence acceptance

## v0.12.0 vision repair and partner-series completion

- repairs direct visual analysis using the current Workers AI image input
- removes the manual kangaroo-count question while retaining standard coins in the catalogue
- completes Great Aussie Coin Hunt 3, Aussie Big Things 2 and the 2024 Bluey Dollarbucks set, and adds Bluey Christmas
- adds a result count and Clear filters control to Browse
- adds request IDs and a stable diagnostic code to visual-analysis failures

## v0.11.9 clearer catalogue filters

- adds a Series dropdown populated from the live catalogue
- adds an Issue type dropdown for standard and commemorative designs
- keeps Year, Issue group and Collection status as clearly labelled dropdowns
- replaces the cramped horizontal mobile filter strip with a responsive filter grid

## v0.11.8 reference-assisted identification

- compares ambiguous photo matches against up to three official reverse-side catalogue images
- only trusts the reference comparison at 80% confidence or above and falls back safely if an image cannot be loaded
- adds automated identification coverage for all 13 partner-program series in the catalogue
- verifies the complete ambiguous Bluey-versus-Bingo reference-comparison flow

## v0.11.7 expanded circulating $1 catalogue

The catalogue now includes all core Royal Australian Mint $1 circulation issues plus the base-metal $1 designs in the Mint's Woolworths and Australia Post program archive. Browse defaults to the full catalogue and can be filtered between regular circulation and partner-program releases.

- expands the catalogue from 35 to 58 verified or announced circulating Australian $1 records
- adds every standard Five Kangaroos circulation year listed by the Royal Australian Mint from 1984 onward
- adds the 2016 50th Anniversary of Decimal Currency circulating obverse variant
- distinguishes the Ian Rank-Broadley and Jody Clark 2019 issues in the shared year selector
- keeps the 28 Five Kangaroos issues grouped into one browse entry instead of flooding the catalogue

## v0.11.5 safer year and kangaroo identification

- requires a deliberate issue-year choice for visually identified designs issued across multiple years
- sends Five Kangaroos and Mob of Six Roos photos to the focused five-or-six question instead of trusting an unreliable visual count
- leaves the five-or-six answer blank and avoids copying a suspect kangaroo year into the clue screen
- makes the portrait-side reading prompt reject inferred or partly legible years

## v0.11.4 unobtrusive icon selection

- removes the bottom confirmation popup when changing the Settings app icon
- keeps the selected-card state and platform-specific launcher guidance inline in Settings
- preserves the coin-added confirmation and all collection data behaviour

## v0.11.3 selectable app icons

- adds **Pocket Mint Seal**, **Spiral Emblem**, and **Character Icon** choices to Settings
- remembers the selected icon on each device and updates the in-app header immediately
- uses the selected icon manifest for future PWA installations
- explains the Android and Apple steps required when an already-installed launcher icon does not refresh

## v0.11.2 grouped years, iPhone photos and cleaner feedback

- combines repeated designs such as Donation Dollar, ANZAC Centenary and Five Kangaroos into one Browse card
- adds an issue-year selector to the coin details page while preserving separate My Mint records for each year
- sends recognised multi-year designs directly to results instead of using Step 2 solely to ask for the year
- prevents empty or unreadable clues from producing false high-confidence kangaroo matches
- prepares large iPhone camera images at a safer size and uses the more reliable Apple photo picker flow
- replaces the browser alert after identification with a Pocket Mint confirmation toast
- removes the clipped horizontal layout from Home’s recent coins and collection shortcuts on phones

Pocket Mint is a local-first Progressive Web App for testing an Australian $1 coin collection catalogue. Personal collection records and photos stay in the browser's IndexedDB database; no account, paid dependency, database, or ongoing-cost service is required.

## v0.11.1 navigation and Home stability

- simplify bottom navigation to Home, Find and My Mint
- move Wishlist and Stats into My Mint alongside the other personal collection destinations
- remove a duplicate delayed Home render that could return a scrolling phone to the top
- preserve the Home shortcuts and all Wishlist and Stats functionality

## v0.11.0 visual cleanup

- introduce one calm, Android-first visual system across the app
- simplify Home around collection progress, Find a coin, series progress and recently added coins
- keep Browse and Identify together inside Find
- use a focused bottom navigation for the main app destinations
- group Collection, Favourites, Duplicates and future Swaps inside My Mint
- add dedicated Wishlist and Stats views without changing stored data
- move the testing checklist and technical diagnostics into Settings
- preserve the v0.10.5 identification engine, catalogue behaviour, installation controls, backups and offline architecture

## v0.10.5 device-aware installation

- detect Android, iPhone and iPad without requiring a device choice
- visually recommend the installation button that matches the current phone
- keep both platform instructions available before installation
- remove the complete installation block when Pocket Mint is already running from the home screen

## v0.10.4 phone installation

- add Android and Apple installation controls to Settings
- launch Android's native PWA install prompt when Chrome makes it available
- show Android browser-menu steps when the native prompt is unavailable
- show the required Safari Share → Add to Home Screen steps for iPhone and iPad
- recognise when Pocket Mint is already running as an installed app

## v0.10.3 circulating catalogue expansion

- default Browse & Search to all circulating catalogue records
- remove collector-only product issues from the active test catalogue
- add 20 commonly encountered circulating commemoratives from 1986–2017
- include Year of the Outback, Girl Guiding, Scouting, Peace, Bicentenary, Landcare, APEC and the complete 2014–2018 ANZAC circulating run
- display official Royal Australian Mint reference artwork for every added coin
- recognise years beginning with 19 as well as 20 during photo identification

## v0.10.2 identification repair

- preserve a visually recognised design when Step 2 asks for a year or another clue
- reduce an exact design-and-year combination to one catalogue result
- prevent generic words such as “to”, “help” and “kangaroos” from creating confident false matches
- ask whether five or six kangaroos are visible only when that distinction remains unresolved
- validate structured vision fields instead of accepting prompt text as a model answer
- describe preliminary photo checks honestly and flag photos that do not produce a reliable result

## v0.10 identification calibration

- identify from the required design-side photo alone; the portrait-side photo is now optional
- calculate confidence from catalogue evidence instead of trusting the vision model's self-rating
- prioritise distinctive names and artwork over uncertain year, portrait, and kangaroo-count observations
- recognise Matildas at series level when the exact player design remains uncertain
- limit results to three meaningful candidates and suppress weak extras after a decisive match
- add the missing provisional 2025 Five Kangaroos record with its standard reference image
- report basic photo quality and distinguish it from successful visual recognition

## v0.9 identification test log

- mark each identification as Correct, Partly right, Wrong, or Not in catalogue
- record the expected coin, returned candidates, confidence, detected visual details, clue path, fallback reason, and photo-quality metadata
- review saved tests in Settings and export a shareable JSON test report
- include the test log in full Pocket Mint backups while remaining compatible with older backups
- keep test evidence separate from My Mint and never duplicate the photographed coin images in the log

## v0.8 catalogue reference images

- official Royal Australian Mint reference artwork on every current catalogue record
- reference thumbnails in Browse, Search, My Mint and identification candidates
- personal photos automatically take over the card thumbnail when available
- coin details keep the official reference visible beside the collector's own photos
- clear labels distinguish exact reverse artwork from product or series reference images
- all reference artwork is cached for offline use

## v0.6 guided coin identification

- capture or upload the portrait and design sides on Android or desktop
- perform on-device brightness, glare and sharpness checks
- narrow the catalogue by year, portrait, design type, visible words and marks
- rank up to three meaningful candidates with transparent evidence
- confirm a candidate to add one specimen and attach every supplied photo
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
- Database schema upgrades in place from version 2 to version 3.
- Existing `myMint`, `personalPhotos`, and `appMeta` stores are reused; `identificationTests` is added without changing collection records.
- Existing records missing `favourite` remain valid and default to `false`.
- Existing `date_added` values are preserved. A missing date is automatically set only when quantity first changes from zero to one or more.
- Catalogue files never overwrite personal records.
- v0.5 progress and series intelligence are calculated from existing records and add no new stored fields.
- v0.9 backups include identification tests. Restoring an older backup leaves the current test log untouched because the older file has no test-log section.

Before testing a deployment, export a backup from **My Mint → Settings → Export Pocket Mint backup**. After deployment, open the site once online so the v0.13.2 service worker can refresh its offline cache. Some circulating records use Royal Australian Mint image links and need an internet connection for their reference pictures.

## Phase 0 phone checks

1. Add/remove owned quantities and verify overall/core completion updates immediately.
2. Set a quantity above one and verify **Duplicate extras** plus the duplicate quick link.
3. Use **Browse missing coins** and **Open wishlist** and verify the Catalogue opens with the correct filter.
4. Start a multi-coin series and verify **Closest to completion** and its next-missing-coin shortcut.
5. Complete a series and verify it moves from **In progress** to **Complete**.
6. Re-check Wishlist auto-removal, Favourite independence, series detail progress, and Android Back navigation.
7. Export, reset, and restore a backup; Favourite and Date Added must return.
8. Reopen in airplane mode after one successful online load.
9. Save identification feedback, review it in Settings, export the test report, and verify My Mint did not change.
