# Pocket Mint — active tasks

Updated 10 October 2026. Unchecked items remain outstanding, not shipped.

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

- [x] Initial live evaluation: twelve contact-sheet proposals and seven completed upright checks; all seven checks preserved the original. No orientation accuracy improvement is claimed.
- [ ] Improve real automatic orientation accuracy; the current method remains conservative and manual correction is still needed.

## Ordered review workflow — v0.14.36

- [x] Show progress and per-object outcomes when checking outlines, including when nothing changes.
- [x] Identify confirmed outlines serially in the background while earlier coins are reviewed.
- [x] Keep explicit collection confirmation; advance to the next unadded coin after saving.
- [x] Separate crop/rotation review from confirmation; show one photo comparison and one other-side option.
- [x] Pause the queue on allowance errors, avoid retry loops and reject stale/reset results.
- [ ] Verify the revised workflow and scrolling on physical Android/iPhone; automatic rotation accuracy remains open.

## Three-stage batch flow — v0.14.38

- [x] Default Find to photo Identify; keep Browse as the alternate tab.
- [x] Photo → outlines → crop/rotation → identification; no recognition begins on the crop screen.
- [x] Finish all queued orientation checks before starting sequential recognition; do not cancel waiting checks.
- [x] Larger four-view quarter-turn references, with independent upright verification and original-photo fallback.
- [x] Keep crop/rotation controls out of identification and show one focused coin comparison.
- [x] Offer positive test feedback for uncertain suggestions; leave unverified years unscored and wrong denominations partial.
- [x] Finish review with added/not-added totals and a guarded new-photo action; unmatched coins remain accessible.
- [x] Add UI-only Coming Home search alias for existing AU20-2005-END-OF-WWII; master catalogue remains unchanged.
- [ ] Evaluate real automatic orientation accuracy on physical album photographs. Larger references and workflow tests do not establish improved accuracy.
- [ ] Review shared-recogniser denomination/design mistakes in the supplied reports separately; single Identify remains protected.
- [ ] Decide whether to expand catalogue scope for 2023 AFL uncirculated team coins, including Brisbane Lions and Fremantle. Do not treat them as missing circulating designs.
- [ ] Physical Android/iPhone scrolling, Back and rotation checks.
- [ ] Supply rights-cleared photographic condition references for the nine grades and supported denominations (existing condition-image backlog remains active).

Catalogue sources: https://www.ramint.gov.au/collect/national-coin-collection/circulating-coins/twenty-cents and https://www.ramint.gov.au/collect/national-coin-collection/corporate-partnerships/woolworths-programs/afl

## Final quick-add review — v0.14.39

- [x] Finish opens a distinct final screen with compact photo/name/year rows and selection checkboxes.
- [x] Confirm & next selects a reviewed issue without saving; Add selected coins performs the explicit collection write at the end.
- [x] Add a bottom Next coin / Review & add control; return to review retains selections.
- [x] Keep uncertain/unmatched coins out of bulk add until an exact issue is chosen and explicitly selected.
- [x] Show automatic rotation outcome labels and a crop-screen total: corrected, already upright, needs checking, checking and manual adjustments.
- [x] Preserve selections on save failure and disable repeat addition of successfully saved physical crops.
- [ ] Automatic rotation accuracy remains open; this release clarifies outcomes, not model accuracy.
- [ ] Validate final review and scrolling on physical Android and iPhone.

## Shared vision allowance — v0.14.40

- [x] Automatically show a styled popup after a confirmed daily-limit response; show local reset time.
- [x] Keep the cooldown through reload and share it across tabs; stop new vision requests until reset.
- [x] Reuse exact batch photo/phase/value results in a bounded session cache; single recognition results remain uncached.
- [x] Reuse orientation work for unchanged crop blobs; failed/unavailable checks remain retryable.
- [x] Correct the batch orientation instruction to match four supplied views.
- [ ] Evaluate orientation accuracy after allowance resets; no accuracy claim from mocked tests.
- [ ] Rights-cleared condition-reference photos remain required.

## Tokyo correction and batch review — v0.14.41

- [x] Correct six Tokyo 2020 coloured designs to $2 (6.6g/20.5mm), retaining historical design and owned-item IDs. Source: Mint 2021–22 annual report; partner webpage labels are incorrect.
- [x] Add Commonwealth 2018/2022/AUS/Birmingham search aliases and allow batch manual search to suggest names at another denomination.
- [x] Defer automatic orientation until outlines are confirmed; removed false outlines use no orientation allowance.
- [x] Strengthen local colour/rim evidence and suppress tiny seam circles beside a credible coin-size cohort. Preserve no-coin rejection.
- [x] Add Skip unclear coin to crop review.
- [ ] Heavily obscured/poor coin photos such as reported number 6 must not be treated as automatically usable: reliable automatic quality rejection remains open.
- [ ] Two missed coins remain in IMG_5049 screenshot (one touches the image edge, one has a weak rim); original photo testing still required.
- [ ] Live automatic rotation accuracy remains unverified while daily vision allowance is exhausted.
- [ ] Rights-cleared condition photographs remain required.

## Rotation and testing counter — v0.14.42

- [x] Read the 10 October report: nine tests (one correct, two partial, five no-match and one connection error). Keep denomination/design failures separate from rotation changes.
- [x] Use a large individual coin view for batch orientation, allow fine-angle corrections, and verify upright before applying; keep original on uncertainty/failure.
- [x] Correct the crop editor's misleading automatic-suggestion message for batch/manual photos.
- [x] Hide failed batch reference images and show an honest reference-unavailable message.
- [x] Add Settings testing counter: device-local requests, model calls, reused results, missing usage and token-based estimated neurons; persist through reload and reset on the UTC day.
- [x] Keep single model inputs, outputs, request bodies and recognition/camera code unchanged; usage is an outer response-header observer.
- [ ] Account-wide neuron usage/remaining balance requires authenticated provider usage data; local estimates must not be labelled an account balance.
- [x] Live trial on three turns of an ANZAC photo: one correct direction proposal, two wrong; binary verification falsely accepted one wrong proposal. Replaced binary acceptance with a fresh near-zero angle requirement (±8°, confidence ≥95), without another model call.
- [ ] Real-photo rotation accuracy remains unresolved: fresh direction measurements on both a wrong candidate and the correctly rotated candidate still returned -90°. The stricter guard rejects both; do not claim successful general auto-rotation.
- [ ] Diagnose the reported connection error and recognition failures separately; preserve the shared single identifier.
- [ ] Repair the source/local reference asset for Great Aussie Coin Hunt 3 — Y for Yarra Valley; fallback presentation does not restore the asset.
- [ ] Obtain the rights-cleared condition photographs already listed above.
