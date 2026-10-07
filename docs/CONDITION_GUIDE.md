# Coin Condition Guide — v0.14.23

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

Selection precedence: same design + denomination → denomination → general. Failed image loads try the next candidate, ending at the labelled pending area. Only controlled local paths with source/rights metadata are used. Service-worker caching includes guide assets and local reference photos; one missing future reference does not prevent installation.

## Verification

- `npm run check`: syntax, condition data model and the complete existing regression suite.
- `node tests/condition-guide-browser.mjs`: optional Playwright suite. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to a supplied Chromium binary; Playwright is a test prerequisite, not an app dependency.
- Browser coverage: blank record → VF, save, VF → EF, cancel, unset and reload, multiple tags and removal, 50c/$2 context, Detail info entry, Help mode, independent comparisons, apply either side, Back order, rapid horizontal swipes/vertical-scroll discrimination, keyboard navigation, 320/360/390/430/768/1280 widths, landscape rotation, controlled missing-photo fallback and callouts, offline guide/recording, and unchanged catalogue data.
- Native Android/iPhone hardware testing remains a follow-up; browser tests simulate viewport, touch and history behavior.
- All Identify, denomination, matching, camera, segmentation, confidence, recognition prompts, test export and catalogue implementation files are unchanged.

The optional YOUR COIN / REFERENCE photo comparison is deferred. There is no automatic grading or cleaning detection.
