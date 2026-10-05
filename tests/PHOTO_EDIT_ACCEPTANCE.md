# Guided capture and photo adjustment — v0.14.21

## v0.14.22 automatic presentation pass

New personal photos are automatically tidied on save. Crop detection accepts only one sufficiently strong outline inside the source; ambiguous detection retains the source. A separate orientation-only endpoint rotates only when the response supplies a clear upright cue, an in-range angle and confidence >=95. This is a conservative model threshold, not a calibrated accuracy claim. Failures, timeouts or quota exhaustion preserve direction and never fail recognition. Results are cached per source file; manual overrides are not reprocessed. Source photos are retained without circular cropping (up to 2400 px) in original_data_url alongside the display image and included in existing backups.

The editor starts with the automatic suggestion and provides Start from original, pan, zoom and rotation. Single-photo edits now change specimenFile (the saved photo) only, keeping file (the recognition input) and its existing matches unchanged. Batch edits remain an explicit request to identify an adjusted target. Automatic tidying on collection save does not alter either matcher input.

The deployment entry is src/photo-worker.js, which passes all routes except /api/photo-orientation directly to src/index.js. Existing identification source files remain byte-for-byte unchanged. Orientation requests share the vision allowance and can add saving latency; they run on collection saving or explicit editor opening, never as a prerequisite for recognition.

Additional automated checks cover malformed/uncertain orientation, bounds, route passthrough, cached requests, source fallback and manual preservation. Real-photo orientation/crop and phone acceptance remain outstanding.

Android and iPhone open the existing guided masked camera by default. The explicit native-camera and gallery options remain available. This changes only camera entry; public/identify.js, public/identify.css, src/identify-single.js and src/index.js remain byte-for-byte unchanged and are guarded by tests/batch-flow.mjs.

An optional Crop / rotate button appears after a single photo is loaded. The editor offers pan, zoom, fine rotation, 90-degree turns and reset. Applying an edit replaces that photo before analysis and collection saving; cancel leaves it unchanged. No automatic centre crop is applied to native/gallery photographs. Export is a 768-pixel transparent PNG without the preview guide. Existing image preparation and matching process the adjusted photo as usual.

Batch thumbnails and result cards expose the same editor. Applying an edit replaces only that crop's design-side photo, clears its predictions and confirmation, and requires matching or manual selection again. The edited blob is used when explicitly adding this physical coin to My Mint. Optional portrait photos and other coins are preserved.

`npm run check` covers editor transforms, export format, preview-guide exclusion, cancellation/resource cleanup, guided camera entry on both platforms and existing matching regressions.

Phone acceptance remains required: inspect focus on Android with guided and native capture; crop/rotate single and batch photos; check transparent saved photos in My Mint; cancel preserves originals; edit one batch coin leaves others intact. No rotation accuracy uplift is claimed without comparative real-photo testing.
