const CACHE = "pocket-mint-phase0-v0.8.0";
const STATIC = ["./", "./index.html", "./styles.css", "./progress.css", "./identify.css", "./app.js", "./progress.js", "./identify.js", "./catalogue.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC);
    const catalogue = await fetch("./catalogue.json").then(response => response.json());
    const images = [...new Set((catalogue.coins || []).map(coin => coin.reference_image).filter(Boolean).map(path => `./${path}`))];
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
