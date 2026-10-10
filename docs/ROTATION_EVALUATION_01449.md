# Rotation evaluation — v0.14.49

Ben explicitly approved using his supplied coin photos through Pocket Mint's existing Workers endpoint on 11 October 2026 (Sydney).

The previous numeric-angle route returned -90° for both upright and sideways ANZAC inputs. Four-view tests also produced inconsistent answers. The new client presents actual 0°, 90°, 180° and -90° views, then presents the candidate again with all views shifted 90°. A correction is accepted only when the second comparison independently selects the same upright view in its new position.

Live tests used the production batch-orientation route and the actual new browser renderer, not mocked model responses. `scripts/evaluate-rotation.mjs` accepts a local manifest and writes results outside the repository. It requires an explicit `--live-approved` flag. Photos and request image payloads are not committed.

| Input | Expected quarter-turn correction | Outcome |
| --- | --- | --- |
| ANZAC, original upright crop | 0° | Uncertain; original kept |
| ANZAC, turned 90° | -90° | Proposal rejected by second comparison |
| Dockers, original crop | 0° | Inconsistent proposal rejected |
| Dockers, turned 90° | -90° | Correct correction accepted |
| Five Kangaroos, supplied sideways crop | -90° | Correct correction accepted |
| Five Kangaroos, turned another 90° | 180° | Correct correction accepted |

Result: 3/6 accepted, all three correct at the quarter-turn level; 3/6 require manual checking. The Five Kangaroos upright direction was checked against the existing local catalogue reference. Dockers retains its small original tilt: fine straightening is not provided by this method. This is a small, selected sample of three designs, not a general accuracy estimate.

Additional browser checks verify the four comparison images and shifted positions at the pixel level, reject confident but inconsistent answers, retain uncertain originals, and preserve manual edits through review, result display, recognition input and saving. The existing recognition engine and batch detector are not modified.
