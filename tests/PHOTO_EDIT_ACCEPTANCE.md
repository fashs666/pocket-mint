# Guided capture and photo adjustment — v0.14.21

Android and iPhone open the existing guided masked camera by default. The explicit native-camera and gallery options remain available. This changes only camera entry; public/identify.js, public/identify.css, src/identify-single.js and src/index.js remain byte-for-byte unchanged and are guarded by tests/batch-flow.mjs.

An optional Crop / rotate button appears after a single photo is loaded. The editor offers pan, zoom, fine rotation, 90-degree turns and reset. Applying an edit replaces that photo before analysis and collection saving; cancel leaves it unchanged. No automatic centre crop is applied to native/gallery photographs. Export is a 768-pixel transparent PNG without the preview guide. Existing image preparation and matching process the adjusted photo as usual.

Batch thumbnails and result cards expose the same editor. Applying an edit replaces only that crop's design-side photo, clears its predictions and confirmation, and requires matching or manual selection again. The edited blob is used when explicitly adding this physical coin to My Mint. Optional portrait photos and other coins are preserved.

`npm run check` covers editor transforms, export format, preview-guide exclusion, cancellation/resource cleanup, guided camera entry on both platforms and existing matching regressions.

Phone acceptance remains required: inspect focus on Android with guided and native capture; crop/rotate single and batch photos; check transparent saved photos in My Mint; cancel preserves originals; edit one batch coin leaves others intact. No rotation accuracy uplift is claimed without comparative real-photo testing.
