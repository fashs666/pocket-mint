# Pocket Mint — active tasks

Updated 8 October 2026. Unchecked items remain outstanding, not shipped.

## Condition reference photographs

- [ ] Obtain rights-cleared, grade-verified general photographs for G, VG, F, VF, EF, aUNC, UNC, CHU and GEM.
- [ ] Acquire and visually review the queued Museums Victoria UNC candidate before activating it.
- [ ] Add source/licence attribution, useful detail callouts and controlled local assets.
- [ ] Verify comparison, missing-image fallback and offline caching with real reference photographs.
- [ ] Expand denomination-specific examples for 5c, 10c, 20c, 50c, $1 and $2.

Reference schema and sourcing status: [CONDITION_GUIDE.md](CONDITION_GUIDE.md).

## Multi-coin detection investigation

- [x] Reproduce false outlines on Ben's 8 October photographs and coin-free Lounge screenshot.
- [x] Verify actual detections remain unchanged at limits of 12, 24 and 48; the limit is a ceiling, never a target.
- [x] Add negative-image, empty-pocket and square/seam regressions; retain perspective and polygonal 50c coverage.
- [x] Fix PNG manual-edit requests in the batch path by preparing JPEG request copies, preserving saved transparent images.
- [ ] Investigate remaining batch design no-matches separately; the supplied Coming Home design is not currently found in the catalogue. Do not silently modify the catalogue or shared matcher.
- [x] Keep single-coin Identify, its camera and shared recognition behaviour unchanged; verify protected-file diffs and regression checks.
- [ ] Deploy and validate this multi-coin fix on physical Android and iPhone devices.

Implementation and automated validation are recorded in MULTICOIN_DETECTION_FIX.md. The detection fix is deployed; physical-device validation remains outstanding.


## Batch rotation and visual consistency — v0.14.31

- [x] Share edited photos across review thumbnails, results and batch recognition inputs.
- [x] Retain corrections when crops regenerate with unchanged outlines; invalidate them when the outline changes.
- [x] Check orientation automatically before batch identification, with a per-coin Auto rotate action and manual Crop / rotate override.
- [x] Preserve original orientation when the service is uncertain, unavailable or returns an invalid angle.
- [x] Verify actual rotated pixels in review/results/request, cancellation, refresh persistence and landscape layout.
- [x] Match remaining dynamic page headings to glossy two-colour lettering; round utility controls.
- [ ] Verify orientation accuracy and manual corrections on physical Android/iPhone with real batch photos.
- [ ] Review mascot placement separately (explicitly excluded from this release).

## Automatic batch orientation workflow — v0.14.33

- [x] Start a bounded orientation queue as detected/manual crops appear, before identification.
- [x] Update review/results immediately, show Checking rotation / Rotation checked / Check rotation.
- [x] Replace the Auto rotate button with accessible 90-degree left/right controls beside each preview.
- [x] Preserve manual priority over late orientation responses and maintain corrected recognition/saved inputs.
- [x] Restore transparent circles and guard their styling with computed-style browser checks (v0.14.32).
- [ ] Improve and evaluate real-coin orientation accuracy: Ben reports only 1 of 9 useful corrections. v0.14.34 compares eight orientations using lettering and directional artwork. Workflow tests do not establish real-photo accuracy; live evaluation and device checks remain required.


## Batch workspace and orientation — v0.14.34

- [x] Replace expandable matching cards with a stable preview grid and one focused coin workspace.
- [x] Keep outline circles transparent; retain the established cream wobbly frames and neon heading style.
- [x] Reuse the unchanged single-coin photo preparation and request flow through an isolated batch adapter.
- [x] Prevent whole-grid/image recreation on background updates; crop only changed outlines.
- [x] Prioritise identification over queued orientation checks and preserve manual correction priority.
- [x] Check 24-preview node stability, one mounted workspace, internal Back order and mobile/landscape widths.
- [ ] Verify scrolling/compositing on physical iPhone and Android; desktop emulation cannot establish that black screens are gone on those devices.
- [ ] Evaluate actual automatic rotation results on the recovered album photographs and additional designs.

## Upright verification — v0.14.35

- [x] Live testing on 12 supplied-photo crops exposed confidently wrong contact-sheet choices.
- [x] Require a second, full-photo upright check before applying a candidate. Disagreement preserves the original.
- [ ] Complete live evaluation of verified outcomes; two model checks do not guarantee a correct orientation.
