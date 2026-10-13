# Coin Condition Guide — v0.14.23

## Visual consistency — v0.14.25

The Condition Guide now uses the same `frames/coin-wobble.svg` cream/gold nine-slice rails and `frames/neon-wobble.svg` action buttons as Pocket Mint's existing cards. My Mint record fields, issue chips, photo selector and actions share its warm palette, irregular outlines and restrained neon accents. A small hand-drawn loupe and heading underline add detail without covering controls. Decorative layers do not clip content or focus rings. Existing frame assets were already cached offline.

Validated with the complete regression suite and existing condition browser flows at six widths, landscape rotation, comparison, Back, saving and offline use. Mobile record and guide screenshots were visually reviewed. Only presentation, an information-icon markup change and release/cache metadata changed; Identify, camera, batch detection, condition storage and catalogue behaviour remain unchanged.

The existing Coin Detail dialog remains the Add/Edit record surface. Its condition selector now has Not recorded and the nine requested Australian adjectival grades. My Mint → Help & feedback → Coin Condition Guide opens the same reusable guide in reference-only mode.

## Record model

Existing `myMint` IndexedDB records gain:

- `conditionGrade`: G, VG, F, VF, EF, aUNC, UNC, CHU, GEM, or null.
- `conditionSource`: owner.
- `conditionIssues`: an independent array of scratched, cleaned, corrosion, toning, edge_damage, staining, dented, surface_marks, other.

No catalogue field or IndexedDB object-store change is required. Existing recognised text labels map on read and persist on the next record save. About Uncirculated maps to aUNC. Poor/Fair and other unrecognised historical text stay preserved and visible until the owner changes their condition. An explicit null does not remigrate the old label. Backup/restore carries these fields in owned records; the identification test-export format is unchanged.

Selecting a guide grade updates the current editor only. Save record persists it. Closing the guide without choosing leaves the existing selection and all unsaved fields intact. Comparison gives independent selectors and, when editable, an apply button for either side. Browser/Android history closes comparison before guide before normal navigation.

## Reference content and remaining imagery

`public/condition-data.js` contains the grade names, concise paraphrased guidance, inspection points, issue options and controlled reference registry. Guidance is based on ANDA's *Grading Commonwealth coins*:
https://anda.com.au/wp-content/uploads/00114_Pt-2-Grading-Commonwealth-coins.pdf

The registry is deliberately empty at release: no verified, rights-cleared grading photographs were supplied. All nine grades therefore show a clearly labelled photographic-reference pending area, with usable written guidance. The UI and recording feature are implemented; the photographic teaching content is still outstanding. No catalogue image, fabricated worn coin or arbitrary copied grading-site photo is presented as a verified grade example.

Supply at least one general Australian photographic example for each grade, ideally showing both sides in consistent lighting. Add 5c/10c/20c/50c/$1/$2 examples later. UNC/CHU/GEM need photographs that demonstrate strike, marks and lustre as well as absence of wear. Grading must be verified by a knowledgeable numismatist; asset rights must permit app redistribution.

Registry entry schema:

```js
{
  grade: 'VF',
  denomination: '2', // '5','10','20','50','1','2'; null for a general reference
  designId: null,    // future design-specific context
  image: 'condition-references/vf-two-dollar.webp',
  source: 'Photographer / collection / provenance',
  rightsNote: 'Redistribution permission or licence',
  description: 'Optional example-specific description',
  lookFor: ['Optional example-specific point'],
  callouts: [{x: 50, y: 30, label: 'Highest point'}] // percent coordinates; up to 3 displayed
}
```

Selection precedence: same design + denomination → denomination → general. Failed image loads try the next candidate, ending at the labelled pending area. References may use controlled local paths or the allowlisted Wikimedia Commons image host and require source/rights metadata. Service-worker caching includes guide assets and approved reference photos; one missing future reference does not prevent installation.

## Verification

- `npm run check`: syntax, condition data model and the complete existing regression suite.
- `node tests/condition-guide-browser.mjs`: optional Playwright suite. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to a supplied Chromium binary; Playwright is a test prerequisite, not an app dependency.
- Browser coverage: blank record → VF, save, VF → EF, cancel, unset and reload, multiple tags and removal, 50c/$2 context, Detail info entry, Help mode, independent comparisons, apply either side, Back order, rapid horizontal swipes/vertical-scroll discrimination, keyboard navigation, 320/360/390/430/768/1280 widths, landscape rotation, controlled missing-photo fallback and callouts, offline guide/recording, and unchanged catalogue data.
- Native Android/iPhone hardware testing remains a follow-up; browser tests simulate viewport, touch and history behavior.
- All Identify, denomination, matching, camera, segmentation, confidence, recognition prompts, test export and catalogue implementation files are unchanged.

The optional YOUR COIN / REFERENCE photo comparison is deferred. There is no automatic grading or cleaning detection.


## Photo sourcing pass — 8 October 2026

Every pending grade card now links directly to the relevant page of ANDA's official photographed grading guide (G page 7; VG/F page 6; VF/EF page 5; aUNC/UNC page 4; CHU/GEM page 3). These are publisher-hosted links, not redistributed/cached photos. They require an internet connection and remain available in comparison mode. The guide does not claim photo redistribution rights. The full ANDA booklet credits grading photographs to John Freestone with permission of Downie's; an open redistribution licence was not established.

The controlled `referenceAcquisition` queue records an independently sourced UNC candidate: Museums Victoria NU 49844, 2023/2024 $2 A Royal Transition coins, photograph by Nick Crotty, CC BY 4.0. The museum explicitly describes both coins as uncirculated and its photograph as reusable with attribution. Source: https://collections.museumsvictoria.com.au/items/2722365 . Original download: https://collections.museumsvictoria.com.au/items/2722365/media/1944032/large . Licence: https://creativecommons.org/licenses/by/4.0/ . This is a museum-described uncirculated example, not independent ANDA certification or justification for CHU/GEM.

Download returned HTTP 403 in the current workspace. No local image was installed or claimed as installed. The candidate stays inactive until the original file is acquired and visually reviewed; the commemorative-card windows may introduce glare. The local `references` array remains empty, and no asset is added to the offline library. Other investigated museum coin records often have image permission without documented condition, or documented condition without image permission; these were not promoted into grading references. No permission request was sent.

## Photo additions — 13 October 2026

Two grade-described photographs with confirmed CC BY-SA 3.0 terms are now wired into the guide: an Australian New Guinea 1936 shilling described as Extremely Fine, and an Australian 1951 florin described as Almost Uncirculated. Each card links to its Wikimedia Commons source and licence and carries a note that it is a historic pre-decimal coin, so its design-specific wear points do not map directly to decimal coins. Sources: https://commons.wikimedia.org/wiki/File:Australian_New_Guinea_1936_Silver_Shilling.jpg and https://commons.wikimedia.org/wiki/File:Florin_1951_Australian_Commonwealth_50_Years._AU_Silver_Coin.jpg .

The Wikimedia images are cached by the service worker after fetch, so offline viewing depends on the device having loaded them once while online. At this stage, G, VG, F, VF, CHU and GEM still use ANDA's publisher-hosted examples. Decimal-denomination examples remain outstanding.

## Follow-up image-rights search — 13 October 2026

The Australian photo search did not find more grade-described, reuse-cleared examples. TDK APDC's Australian pre-decimal grading index has useful comparisons but no stated reuse licence, so those photos were not embedded. The search did surface several suitable non-Australian examples; the next section records the implemented additions. The existing Australian EF and aUNC references remain alongside the international examples. All are broad condition illustrations, not design-specific guidance for Australian decimal coins.

## International photo additions — 13 October 2026

Added licensed non-Australian coin photographs for G, VG, F, VF, UNC, CHU and GEM, plus alternate EF and aUNC examples. G/VG/F/VF examples are Roman coins documented by the Portable Antiquities Scheme and released under CC BY-SA 4.0; the F and VF candidates show corrosion/edge damage or only one side, so their captions call out those limits. The Weimar 50 pfennig provides a second EF example (CC BY-SA 4.0). The France 1831 coin is described as uncirculated (CC BY-SA 4.0); Guatemala 1847 is described as choice uncirculated (CC BY-SA 3.0); and a Moroccan 5 francs scan is described as Gem Uncirculated (CC BY-SA 2.5). The Saxony 1913 3 Mark is described as almost uncirculated and provides a second aUNC example (CC BY-SA 4.0). Cards with multiple examples have previous/next controls, and each displayed photo links to its Commons file page and licence. These are not Australian grade certifications and their design high points do not map to decimal coins. Wikimedia images are fetched and cached by the service worker when online; an image must load at least once before it is available offline.

The Condition Guide no longer shows a denomination chooser. The editor may pass a coin denomination internally, but denomination-specific examples are not shown as an option until grade-verified photos exist for those denominations.
