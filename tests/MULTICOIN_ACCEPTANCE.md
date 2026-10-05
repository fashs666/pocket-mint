# Multi-coin identification — v0.14.20

## Implemented behaviour

1. Local outlines are proposals, shown in amber until checked. Zero detections is allowed.
2. Check detected objects analyses each crop without catalogue names. A confident non-coin is removed. Multiple-coin or uncertain crops stay for manual correction.
3. “Outlines look right · identify” approves the current outlines and sends each crop directly to the existing matcher. This deliberate review bypasses the batch-only preliminary count gate; an incidental neighbouring edge must not stop matching. Optional “Check detected objects” remains available before review.
4. Batch matching opts into the current six-denomination identifier through a batch-only flag. Existing single Identify and legacy requests retain their routes.
5. Stable physical-coin IDs and display numbers link outlines, crops and results. Removing coin 2 preserves coin 3's number. Late responses cannot restore removed or resized crops.
6. Result cards compare the photographed coin with the catalogue reference. Alternative designs have reference thumbnails; series/product references keep their labels.
7. Coin value can be supplied when unclear. Manual catalogue search uses the selected denomination.
8. Each coin can receive a new design-side photo or an optional portrait-side photo for year reading. Other results survive that retry.
9. Predictions and issue-year selection never tick collection confirmation. Only reviewed crops with an issue and an explicit confirmation can be added. Separate physical coins may share the same catalogue issue.
10. Vision requests time out after 45 seconds. Failed checks preserve manual review and search.
11. The proposal cap is 24, not 10. Source images retain up to 2400 pixels for crops; the local analysis remains reduced. Crops use tighter padding and an elliptical neutral-background mask to isolate their target. Radial rim evidence reduces proposals caused by fabric texture.
12. Tap an outline or thumbnail to select/deselect without rebuilding results. Tap empty photo space to deselect. Drag to move, use the slider to resize, or remove/add an outline. Crop thumbnails are a horizontal strip and results are collapsible.
13. Save all batch tests records matches and failures without requiring expected catalogue entries. Raw matches are “unreviewed”, not correct. Save & export also downloads this batch as JSON. Repeating save does not duplicate reports or add collection coins. Correct/wrong feedback and expected-coin correction remain available inside each result.

## Automated verification

Run `npm run check`. Includes existing catalogue, single-coin, camera, series and collection/report regressions, synthetic detector fixtures, batch preflight and stale-result tests, bulk diagnostic saves, and SHA-256 guards for the protected single-coin files.

These checks verify control flow with mocked model replies. They do not establish real-photo model accuracy. The local textured-table fixture may miss one coin; Add missed coin remains necessary. The supplied annotated screenshots show failures but cannot serve as detector fixtures because the overlays contaminate the pixels. Obtain original unannotated photos for tuning. Mobile layout and touch interactions still require browser/device acceptance; no browser executable was available for this change.

## Phone acceptance

Use the same saved photographs on Android and iPhone:

- Empty plain surface and empty patterned surface: no accepted coins.
- One coin with concentric artwork: one outline, outer edge included.
- Three and six spaced coins with mixed values: one outline per coin, no extra accepted objects.
- Round non-coins beside coins: check rejects them or leaves them uncertain for review.
- Touching or overlapping coins: isolate the target with one outline per coin; manually correct merged outlines. Peripheral neighbour fragments must not block a reviewed target.
- Portrait-side and blurred coins: ask for the individual design-side/closer photo.
- Remove the middle coin: subsequent outline numbers and result pairings remain unchanged.
- Remove or resize a coin while matching: old response does not reappear.
- Two identical designs: independently confirm both, resulting in quantity +2.
- Multi-year design: require issue choice when the year is unreadable.
- Choose an issue: confirmation remains unchecked until deliberately ticked.
- Retry one coin with another photo: other results remain unchanged.
- Save correct and failed identification reports without adding to collection.
- Save/export the whole batch: include failures, leave unreviewed matches unscored and exclude unprocessed crops; repeated save creates no duplicates.
- Tap to toggle selection, tap empty space to deselect, drag an outline and resize without losing other results.
- Navigate Back and retake while processing: no old results in the new batch.

Record false detections, missed coins, denomination errors, design errors and year errors separately. Do not claim a production accuracy target until this real-photo set is scored.
