# Multi-coin identification — v0.14.19

## Implemented behaviour

1. Local outlines are proposals, shown in amber until checked. Zero detections is allowed.
2. Check detected objects analyses each crop without catalogue names. A confident non-coin is removed. Multiple-coin or uncertain crops stay for manual correction.
3. Coin matching runs only on reviewed outlines. The server independently checks that a crop shows one clear coin design before looking for catalogue matches.
4. Batch matching opts into the current six-denomination identifier through a batch-only flag. Existing single Identify and legacy requests retain their routes.
5. Stable physical-coin IDs and display numbers link outlines, crops and results. Removing coin 2 preserves coin 3's number. Late responses cannot restore removed or resized crops.
6. Result cards compare the photographed coin with the catalogue reference. Alternative designs have reference thumbnails; series/product references keep their labels.
7. Coin value can be supplied when unclear. Manual catalogue search uses the selected denomination.
8. Each coin can receive a new design-side photo or an optional portrait-side photo for year reading. Other results survive that retry.
9. Predictions and issue-year selection never tick collection confirmation. Only reviewed crops with an issue and an explicit confirmation can be added. Separate physical coins may share the same catalogue issue.
10. Vision requests time out after 45 seconds. Failed checks preserve manual review and search.

## Automated verification

Run `npm run check`. Includes existing catalogue, single-coin, camera, series and collection/report regressions, synthetic detector fixtures, plus batch preflight and stale-result tests.

These checks verify control flow with mocked model replies. They do not establish real-photo model accuracy. The local textured-table fixture may miss one coin; Add missed coin remains necessary.

## Phone acceptance

Use the same saved photographs on Android and iPhone:

- Empty plain surface and empty patterned surface: no accepted coins.
- One coin with concentric artwork: one outline, outer edge included.
- Three and six spaced coins with mixed values: one outline per coin, no extra accepted objects.
- Round non-coins beside coins: check rejects them or leaves them uncertain for review.
- Touching or overlapping coins: do not silently identify a multi-coin crop.
- Portrait-side and blurred coins: ask for the individual design-side/closer photo.
- Remove the middle coin: subsequent outline numbers and result pairings remain unchanged.
- Remove or resize a coin while matching: old response does not reappear.
- Two identical designs: independently confirm both, resulting in quantity +2.
- Multi-year design: require issue choice when the year is unreadable.
- Choose an issue: confirmation remains unchecked until deliberately ticked.
- Retry one coin with another photo: other results remain unchanged.
- Save correct and failed identification reports without adding to collection.
- Navigate Back and retake while processing: no old results in the new batch.

Record false detections, missed coins, denomination errors, design errors and year errors separately. Do not claim a production accuracy target until this real-photo set is scored.
