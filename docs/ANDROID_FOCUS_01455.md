# Android focus recovery — v0.14.55

The camera entry wrapper had concrete recovery gaps: opening autofocus never
ran the detail scan when a focus mode was exposed; a near-zero sharpness baseline
prevented scanning at all; repeated taps could request the same completed
single-shot mode; pixel samples were judged without fresh-frame confirmation.

Android only: enable the measured fallback on a soft opening preview and on unproductive taps,
allow severely blurry baselines, require an absolute/relative improvement, wait
for fresh video frames, and recheck the winning distance before locking it.
Re-arm repeat single-shot taps through continuous mode before the new request.
Restore supported autofocus after no improvement, missing frames or a failed
scan, even when the starting mode was unreported. Stale jobs remain unable to
publish success or overwrite a later manual choice. Exported single-coin photo
diagnostics now include focus range, before/after detail and control version.

Focus distance scanning only works on lenses/browser sessions that expose manual
focus and its range. No unsupported physical focus capability is manufactured.
The code/simulated stream tests do not certify Fold 5 hardware focus quality.
The single matching engine, iPhone camera, circle crop and saved-photo dimensions
are untouched. Camera controls remain behind Options.

Verification: expanded VM tests for severe blur, blank/noise rejection, opening
scan, repeat taps, frame/cancellation cleanup and restoration. Playwright test
uses real fake-device video frames and deliberately simulated capabilities and
detail-vs-distance response; checks three phone layouts, focus controls, 768px
capture, native crop editor and zero single orientation calls. Full npm check.

## New iPhone report

October 12 v0.14.54: four rotation batches, 26 crops; 17 accepted automatic
results, nine uncertain/inconsistent; 24 manually corrected, two unchanged.
Zero saved-upright-reference matches. This independently confirms the previous
release did not solve fresh-photo orientation. Matching outcomes in the same
report: 15 correct, five wrong, five no-match and one partial. No new rotation
accuracy claim or rotation algorithm release is attached to this camera fix.
Private report images remain outside the repository.
