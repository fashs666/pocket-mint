# Drawn headings and stronger frames — v0.14.26

Page and section headings throughout Pocket Mint now use a locally bundled Short Stack hand-lettered font with cyan/pink scribbled underlines and a small gold sparkle. Includes Home, Find/Browse/Identify presentation, My Mint, Settings, series, stats, details and Condition Guide. Body text, fields and compact layouts retain their existing sizes. The illustrated Home wordmark stays intact.

The shared cream/gold SVG rails have larger undulations. Tall panels repeat vertical rail segments rather than stretching the curves into straight lines. Only decorative layers are shaped; content and focus rings remain unclipped. The paper centre uses a continuous gradient rather than a repeated fill, avoiding tile bands.

Font: unmodified `@fontsource/short-stack` 5.3.0 Latin 400 WOFF2, sourced from Google Fonts via Fontsource. Copyright 2011 Sorkin Type Co. SIL Open Font License 1.1 included at `public/fonts/short-stack-LICENSE.txt`. Local font and header-scribble SVG are explicitly cached by the existing service worker. No third-party runtime/font request is required.

Validation: full `npm run check`; existing condition browser regression across six widths and rotation, storage, comparison, Back and offline use; cached font and header decoration verified. Home, Find, My Mint, Settings, record and guide phone previews visually reviewed. Recognition, ranking, single and batch engines, camera, catalogue and persistence logic remain unchanged. App/cache version only advances to deliver the new presentation.
