/* LayerFarm offline application shell. Deploy beside the app on HTTPS. */
const CACHE_NAME = 'layerfarm-shell-v4';
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache the deployed app entry point and the exact external libraries it needs.
    for (const asset of [self.registration.scope, ...CDN_ASSETS]) {
      try { await cache.add(new Request(asset, {cache: 'reload'})); } catch (error) { console.warn('LayerFarm asset not cached:', asset, error); }
    }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('layerfarm-shell-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') return (await caches.match(self.registration.scope)) || Response.error();
        return Response.error();
      }
    })());
    return;
  }
  if (CDN_ASSETS.includes(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const response = await fetch(req);
        if (response && (response.ok || response.type === 'opaque')) cache.put(req, response.clone()).catch(() => {});
        return response;
      } catch (_) { return Response.error(); }
    })());
  }
});
