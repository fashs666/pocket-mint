# Rotation report follow-up — v0.14.53

The October 11 iPhone report contains four rotation batches / 22 coins. Several
accepted quarter-turns still need fine-angle corrections; Donation Dollar also
has a confident wrong-direction example. A live diagnostic direction request
returned -90° for both its original crop and the user's corrected upright crop.
That numeric-angle path is therefore not enabled as an automatic fine adjustment.

The previous crop editor returned pixels but discarded its numeric correction.
It now exposes immutable adjustment metadata alongside the unchanged File API.
Batch edits disable additional suggestions explicitly and accumulate fine angles
with quarter-turns. Unknown prior angles remain unknown. The one batch-wide save
exports the correction and crop transforms, with no extra model calls or changes
to the shared single-coin matching engine.

`scripts/evaluate-rotation-report.py` evaluates reports locally with Pillow/numpy.
For older missing angles it attempts conservative image registration, explicitly
labels inferred measurements, and excludes low-quality alignments. It reconstructs
user edits; it does not identify artwork or prove a general orientation accuracy.
Raw user images are not committed to the repository.

Verification: photo-editor and real batch-edit VM regressions cover signed fine
angles, accumulation, cancellation, unknown metadata and report serialization.
The full project check must also pass before release.
