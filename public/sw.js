const CACHE = "pocket-mint-v0.14.34-neon-headings";
const STATIC = ["./batch-single-adapter.js","./pm-live-headings.js","./batch-photo-rotation.js","./artwork/headings/section-titles.png","./pm-headings.css","./artwork/headings/neon-titles.png","./fonts/coiny-latin-400.woff2","./fonts/coiny-LICENSE.txt","./frames/icon-stats.svg","./frames/icon-swaps.svg","./frames/icon-settings.svg","./frames/icon-help.svg","./frames/icon-about.svg","./fonts/short-stack-latin-400.woff2", "./fonts/short-stack-LICENSE.txt", "./frames/header-scribble.svg", "./", "./index.html", "./styles.css", "./progress.css", "./identify.css", "./pm-visual.css", "./pm-frames.css", "./frames/album-wobble.svg", "./frames/coin-wobble.svg", "./frames/icon-duplicates.svg", "./frames/icon-favourites.svg", "./frames/icon-owned.svg", "./frames/icon-wishlist.svg", "./frames/neon-wobble.svg", "./frames/plaque-wobble.svg", "./condition-data.js", "./condition-guide.js", "./condition-editor.js", "./condition-guide.css", "./series.js", "./camera-entry.js", "./auto-coin-photo.js", "./coin-photo-editor.js", "./coin-photo-editor.css", "./pm-stars.svg", "./pm-crescent.svg", "./pm-wordmark.webp", "./characters/grim-companion.webp", "./characters/grim-walk.webp", "./characters/grim-walk-b.webp", "./characters/grim-inspect.webp", "./characters/grim-walk-sheet.webp", "./characters/grim-clue-sheet.webp", "./characters/noxel-companion.webp", "./characters/noxel-scuttle.webp", "./characters/noxel-scuttle-b.webp", "./characters/noxel-peek.webp", "./characters/noxel-walk-sheet.webp", "./characters/noxel-discovery-sheet.webp", "./characters/grim-noxel-high-five.webp", "./companions.js", "./app.js", "./identification-report.js", "./progress.js", "./identify.js", "./batch-identify.js", "./batch-identification.js", "./batch-detection.js", "./batch-identify.css", "./catalogue.json", "./catalogue-v2.json", "./manifest.webmanifest", "./manifest-seal.webmanifest", "./manifest-spiral.webmanifest", "./manifest-character.webmanifest", "./icon-192.png", "./icon-512.png", "./icons/seal-192.png", "./icons/seal-512.png", "./icons/spiral-192.png", "./icons/character-192.png", "./icons/character-512.png"];

importScripts("./condition-data.js");

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC);
    // Cache only controlled, locally supplied grading photographs.
    const conditionImages = [...new Set(self.PocketMintConditionData.references.map(r => r.image).filter(p => /^condition-references\/[a-zA-Z0-9_./-]+$/.test(p || "") && !p.includes("..")))];
    await Promise.all(conditionImages.map(p => cache.add(`./${p}`).catch(() => {})));
    const catalogue = await fetch("./catalogue.json").then(response => response.json());
    const images = [...new Set((catalogue.coins || []).map(coin => coin.reference_image).filter(path => path && !/^https?:\/\//i.test(path)).map(path => `./${path}`))];
    await cache.addAll(images);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(response => response || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined))));
});
