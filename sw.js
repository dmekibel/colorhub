// Offline support and speed. The page itself (index.html, anything without a ?v= tag) is network first, so a new version
// always lands when you're online and the cache is only its offline fallback. Every script, stylesheet and data file
// carries a ?v= tag that changes on each push, so that URL never changes content: it is served straight from the cache
// (no round trip to check it) and fetched once when it is new.
const CACHE = "colorhub-v4";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const versioned = url.searchParams.has("v") && !/\/early\.js$/.test(url.pathname) && req.mode !== "navigate" && !req.headers.has("range");
  if (versioned) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.delete(req, { ignoreSearch: true }).then(() => c.put(req, copy))); }   // an older ?v= of the same file goes away
      return res;
    })));
    return;
  }
  // revalidate with the server every time (GitHub Pages lets browsers reuse index.html for 10 minutes, so phones kept
  // showing the old app after a push)
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then(r => r || caches.match("./"))));
});
