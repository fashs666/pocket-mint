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

Implementation and automated validation are recorded in MULTICOIN_DETECTION_FIX.md. Deployment remains a separate step.
