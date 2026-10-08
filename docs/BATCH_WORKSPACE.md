# Pocket Mint batch workspace — v0.14.35

Multi-coin review now has an outline step and a stable coin grid. Open one coin to identify, choose a design/year, attach a portrait if needed and explicitly confirm it into My Mint. A single workspace replaces the previous collection of expandable matching forms.

The batch adapter calls the existing makeAnalysisImage and /api/identify single_coin request. A portrait is included only for the same uncertain/year-needed retry used by single Identify. Neither the single engine nor its camera, detector, matching prompts, catalogue or test export schema is edited.

Preview and outline nodes remain mounted across unrelated updates; unchanged outlines retain their cropped blobs. Large batch frame layers do not apply filters. The heading observer ignores non-heading changes. Background orientation work is bounded to two requests; identification takes priority over pending jobs.

Batch orientation uses a separate /api/batch-orientation endpoint, comparing eight 45-degree rotations of one isolated crop. Readable lettering and directional motifs support a confident choice; uncertain/service-unavailable/allowance cases preserve the original. Quick left/right controls and the existing crop/rotate editor remain available. Late automatic results cannot overwrite a manual edit or an identification underway. The original single-photo orientation route passes directly to the unchanged worker.

Validation: npm run check; adapter/worker tests; browser pixel propagation, stale responses, stable 24-coin grid, one mounted workspace, Back, manual overrides, cancelled edits, five widths and landscape; full condition guide browser suite including offline use. Real-photo model accuracy and physical-device scrolling are tracked separately in ACTIVE_TASKS.md.

The first live 12-crop evaluation found confidently wrong contact-sheet choices. v0.14.35 requires independent full-photo upright verification at 95% model confidence before exposing a correction. This is a guard against a demonstrated failure, not a claim of measured grading or orientation accuracy.

## Live checks, 8 October 2026

Cloudflare deployed v0.14.35 successfully. Live HTML and the changed batch scripts match the tested source. The original single-coin engine/camera/worker and catalogue remain unchanged in both protected hashes and the published comparison.

Twelve manually isolated crops from the recovered IMG_5029/IMG_5031 album photographs were submitted to the first contact-sheet selector. It returned eleven confident proposals and one uncertain result, including visibly incorrect proposals. Seven independent verification requests completed; all seven preserved the original, including one already-upright but directionally ambiguous design. Four remaining verification requests were interrupted by network access errors. These results demonstrate rejection of bad proposals, not improved automatic rotation accuracy. Actual orientation remains an open task; no success rate is claimed.

Two real-photo requests through the unchanged single-coin API returned: International Year of Older Persons matched AU1-1999-OLDER-PERSONS; the other design remained uncertain and requires comparison/manual selection. The batch interface does not turn uncertain results into confirmed owned records.

Both recovered album photographs still detect six actual coins at ceilings 12, 24 and 48. The full automated suite, condition/offline browser suite and batch pixel/stability/Back/layout suite pass. Physical iPhone/Android scrolling has not been tested.
