# Multi-coin detection fix — v0.14.24

## Scope

Batch-only detector and request preparation changes. Single Identify, camera, shared vision prompts, denomination recognition, matching/ranking, test export format and catalogue data remain unchanged. No live vision calls are needed to test local outline detection.

## Reproduction and changes

The raw-gradient rim test accepted fabric grain and plastic album stitching. Three supplied album photos reached the 24-object ceiling; the supplied coin-free Lounge screenshot produced seven false objects. The ceiling was not an explicit count target.

Rim direction is now measured after a 5x5 local smoothing pass. At least 70% of perimeter samples need strong, outward-normal-aligned gradients. Candidates below a 16-pixel analysis radius are not reliable enough for automatic selection; manual add remains available. The maximum remains 24, not a lower limit hiding false positives. Polygonal 50c and perspective outlines remain supported.

Manual crop edits produce transparent PNG specimens. The batch caller previously sent these directly to an API which accepts JPEG only, explaining a reproducible valid-design-side-image error. Only batch request copies are converted to bounded JPEGs (maximum side 960 pixels, neutral background). Original PNG specimens remain available for My Mint. Both design and portrait request images are prepared; the API and single-coin caller are untouched.

## Supplied-photo results

| Input | Before | After | Fully framed coins |
| --- | ---: | ---: | ---: |
| IMG_5028.jpeg | 10 | 3 | 3 |
| IMG_5029.jpeg | 24 | 6 | 6 |
| IMG_5030.jpeg | 24 | 6 | 6 |
| IMG_5031.jpeg | 24 | 6 | 6 |
| ghlu-v00957-room-links.jpg | 7 | 0 | 0 |

Partially clipped edge coins are excluded. Counts and coin centres are asserted, not just total counts. Identical results at test-only limits 12 and 48 confirm that raising the ceiling does not manufacture outlines. Two independently cropped empty album pockets return zero. Review screenshots with existing drawn outlines are evidence of the bug, not detector input fixtures.

## Tests

- `npm run check`: complete model, camera, single and batch regression suite; protected single-coin files have existing byte-for-byte hash assertions.
- `BATCH_PHOTO_DIR=/path/to/supplied/files PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node tests/batch-photo-detection.mjs`: actual browser decoding, real-photo counts/centres, independent ceilings, no-coin screenshot, empty pockets and PNG-to-JPEG conversion. Supplied private images remain outside the repo.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node tests/condition-guide-browser.mjs`: existing condition guide regression.
- Added deterministic square/seam negatives and twelve-sided 50c positive fixtures to the standard suite.
- Batch flow tests verify both edited sides pass request preparation, saved PNG stays intact, review gates and stale-result rejection remain intact.

These tests do not establish real-world design matching accuracy or physical-device performance. Remaining design no-matches are separate; the supplied Coming Home label is absent from the current catalogue search. No catalogue additions or new recognition rules are included. Reference-condition photographs remain on the active backlog.
