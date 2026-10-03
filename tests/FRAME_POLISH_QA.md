# Pocket Mint illustrated frame and series artwork QA

Baseline: main c73ef331fb2d98f97dd26f70e8fca0005c1a907a (v0.14.17).

## Current revision

- Shared drawn SVG outlines for cream plaques, Home album, neon CTA and coin cards.
- Dark inset stat wells with neon coin-stack, heart, star and gift icons.
- Bubble action controls; existing owned, wishlist and favourite state styles kept.
- A distinct transparent illustrated PNG for each of the 24 canonical series.
- Artwork selected using existing data-series-id attributes in CSS only.
- Reserved illustration/arrow space; no artwork overlays the title or controls.
- public/visual-review.html is a separate visual-review page with the live app
  in 360/390/430px iframes and a clearly labelled sample artwork gallery.
  It is not linked from app navigation and does not replace any app route.
- Full asset prompts and generation provenance: tests/series-art-prompts.json.

## Completed checks

- npm run check: passed. Catalogue, single/batch Identify, camera contracts,
  series transitions/history, reports and companion motion tests passed.
- node tests/frame-visual.mjs: passed; 24/24 canonical series mapped to real
  assets; drawn SVG variants exist; total PNG payload is 1488 KB.
- All 24 PNGs retain alpha transparency and fit within 240x180 pixels.
- Entire artwork sheet inspected for coherent style and matching subjects.
- git diff --check: passed.
- Protected implementation files are byte-for-byte unchanged from baseline:
  app.js, index.html, series.js, identify.js, camera-entry.js, companions.js,
  sw.js, src/, catalogue JSON, collection storage and navigation implementation.

## Browser verification status

Current revision: pending the refreshed Cloudflare deployment. Preview builds
failed and the cloud browser cannot access the local HTTP/file review server.
Earlier screenshots do not prove this stronger visual revision.

The earlier, subtler frame pass was inspected at 360/390/430 CSS pixels for Home,
Collection, Outback series, completion dialog, Stats and coin details; Browse
was inspected at 390px. Collection controls measured 44x44px and document widths
matched scroll widths. These results remain historical, not current visual QA.

Physical Android/iPhone validation is still required. Existing roaming companions
can briefly cross content; their positioning and movement are deliberately unchanged.
