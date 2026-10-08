// Offline support. Network first, so a new version always lands when you're online;
// the cache is only the fallback for when you're not.
const CACHE = "colorhub-v3";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // revalidate with the server every time (GitHub Pages lets browsers reuse index.html for 10 minutes, so phones kept
  // showing the old app after a push); the ?v= tags already make each script and stylesheet its own URL
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then(r => r || caches.match("./"))));
});
