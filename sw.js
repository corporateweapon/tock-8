/* Tock-8 offline copy.
   Online: always fetch the newest files and refresh the stored copy, so updates show up on the next open.
   Offline or slow: serve the stored copy. Saved beats live in the page's own storage and are not touched here. */
const CACHE = 'tock8-shell';
const SHELL = ['./', './index.html', './engine.js', './studio.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3000);
      const res = await fetch(req.url, { signal: ctl.signal, cache: 'no-cache' });
      clearTimeout(timer);
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(req.url)) || (await cache.match(req.url, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
