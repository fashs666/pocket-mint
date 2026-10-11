# Partial automatic rotation improvement — v0.14.54

The four-quarter-turn model cannot remove arbitrary tilt. Live trials with finer
rendered choices still made confident errors, so those trials are not enabled.
Catalogue-photo pixel matching was also insufficiently reliable.

Batch orientation now first attempts on-device registration against upright
crops in the user's saved all-coin rotation reports. The matcher estimates a full
signed angle at 2° resolution. It requires correlation >= .82, peak separation
>= .20 and agreement among accepted references within 8°. Blank, symmetric,
weak and conflicting matches are rejected. No personal examples ship in source.
Only explicitly upright-confirmed batch rotation records qualify; at most 32
recent unique images are used. Deleting the tests removes their references.

The October 11 report replay accepted 13/22 original crops, with all 13 within
2° of the saved/inferred correction (including Donation Dollar). Nine fell back.
Leave-one-crop-out matching accepted zero: this is a saved-example matching
improvement, NOT a demonstrated universal/new-photo orientation fix. Different
lighting/framing may reject a match, and accepted user references can inherit a
user's mistaken upright label. The existing two-call model remains the fallback.

Matched results use the actual rotated crop for both previews, identification
input and diagnostic evidence; no collection write occurs. Matching works when
the model allowance is exhausted and makes no uploads or vision requests.
Manual overrides and late-result checks remain in the existing batch coordinator.
The unchanged single-coin engine/camera are protected by baseline hash tests.

Verification: synthetic signed-angle/symmetry/blank/conflict tests and real
coordinator quota/cache-invalidation tests; complete npm check. The optional
`node scripts/evaluate-rotation-memory.mjs /path/to/report.json` runs the actual
JS comparison against Pillow-preprocessed report pixels, with separate replay
and held-out results. This is not a browser/hardware benchmark.
