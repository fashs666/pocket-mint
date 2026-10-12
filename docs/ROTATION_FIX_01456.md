# Fresh-photo rotation improvement — v0.14.56

The old batch model selected quarter turns and repeated the same kind of check.
It could neither choose intermediate directions nor straighten arbitrary tilt.
Direct numeric-angle trials with Scout, Qwen and Gemma still made confident
mistakes. The new batch-only path uses Qwen 3.8 to select among eight rendered
directions, then nine nearby tilt candidates spaced 7.5° apart. Fine galleries
are rendered from the original with an offset; the final PNG is rotated once.

Both choices require valid JSON, confidence >=90 and a nonempty visible cue.
Unknown responses, malformed angles and fine-boundary choices keep the original
and request manual review. No fallback retries consume more quota. Legacy APIs
remain available for older clients. Saved-upright local matching is preserved,
but it was deliberately absent from the fresh-photo benchmark.

## Live evidence and limits

19 original crops from the October 12 report completed both live stages against
a temporary authenticated Worker running the same model/prompt/parser module.
The daily allowance then returned 4006; further inference stopped. The remaining
seven of the report's 26 crops have no completed two-stage benchmark result.
Two pilot cases are included in the 19; the other 17 were new to the experiment.
No corrected image was supplied as a reference to the inference model.

| Measurement | Recorded old results | New trial |
|---|---:|---:|
| Within 8° of the user's correction (19 evaluated) | 0 | 10 |
| Within 15° (19 evaluated) | 2 | 14 |
| Accepted rotations wrong by >45° | 5 | 1 |
| Median error on the same 17 newly accepted crops | 38° | 6° |

Two new results were rejected. One accepted result is a real regression: the
Federation map coin moved from 23° residual error to 68°. This is not a universal
orientation fix. Some remaining tilts exceed 15°. These figures compare with the
user's saved corrections, not a certified canonical-orientation dataset.
An already-upright coin was preserved in the four-case pilot, and Donation Dollar
improved to within 7°; neither is included as an extra success in the 19 rows.

The 19-case run used approximately 2,775 neurons, plus earlier model pilots. A
typical completed new check used about 145 neurons. Median model-stage latency
was 1.76 seconds; one cold coarse stage took 23.4 seconds. Requests have bounded
30-second timeouts. The Settings counter now prefers provider-reported neurons
for the new model and retains old pricing fallback where no exact usage exists.
The live allowance is temporarily exhausted, so new model testing must await its
reset. There is no paid-plan upgrade or new external image storage.

## Verification

Full npm check; strict parser/coordinator/quota tests; actual browser canvas tests
verify all eight directions, nine fine poses, tile separation and a signed 37.5°
rotation with no clipped saved crop. Existing single-engine hash protections,
manual-override/stale-result guards, batch previews and all-coins report tests
remain in place. Single identification and both camera flows are unchanged.
Live benchmark rendering used Pillow; native canvas geometry is verified with
mocked model replies because the live allowance was exhausted.

Private reports and images are not committed. The temporary evaluator and its
credential are removed after testing. Production uses the existing AI binding.
