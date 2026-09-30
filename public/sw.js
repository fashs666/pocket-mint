const CACHE = "pocket-mint-v0.14.12-value-reading-failed-tests";
const STATIC = ["./", "./index.html", "./styles.css", "./progress.css", "./identify.css", "./pm-visual.css", "./pm-stars.svg", "./pm-crescent.svg", "./pm-wordmark.webp", "./characters/grim-companion.webp", "./characters/grim-walk.webp", "./characters/grim-walk-b.webp", "./characters/grim-inspect.webp", "./characters/grim-walk-sheet.webp", "./characters/grim-clue-sheet.webp", "./characters/noxel-companion.webp", "./characters/noxel-scuttle.webp", "./characters/noxel-scuttle-b.webp", "./characters/noxel-peek.webp", "./characters/noxel-walk-sheet.webp", "./characters/noxel-discovery-sheet.webp", "./characters/grim-noxel-high-five.webp", "./companions.js", "./app.js", "./identification-report.js", "./progress.js", "./identify.js", "./batch-identify.js", "./batch-identification.js", "./batch-detection.js", "./batch-identify.css", "./catalogue.json", "./catalogue-v2.json", "./manifest.webmanifest", "./manifest-seal.webmanifest", "./manifest-spiral.webmanifest", "./manifest-character.webmanifest", "./icon-192.png", "./icon-512.png", "./icons/seal-192.png", "./icons/seal-512.png", "./icons/spiral-192.png", "./icons/character-192.png", "./icons/character-512.png"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC);
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
