const CACHE_NAME = 'battle-tracker-145ce72e87';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Navigation Preload: let the browser start the network request for a
      // page navigation in parallel with the service worker booting up,
      // instead of waiting for the SW to spin up before any fetch begins.
      // This shortens the "blank tab" time on cold starts / right after an
      // SW update, without changing the cache-first behavior below.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      const staleKeys = keys.filter(k => k !== CACHE_NAME);
      await Promise.all(staleKeys.map(k => caches.delete(k)));
      await self.clients.claim();
      // Only notify existing tabs if this activation actually replaced an older
      // version's cache (i.e. skip the notification on a brand-new install).
      if (staleKeys.length === 0) return;
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      const networkFetch = (async () => {
        try {
          // Reuse the preloaded navigation response when available so we don't
          // issue a second, duplicate network request for the same navigation.
          const preload = event.preloadResponse ? await event.preloadResponse : null;
          const networkResponse = preload || await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        } catch {
          return cached;
        }
      })();
      return cached || networkFetch;
    })()
  );
});
