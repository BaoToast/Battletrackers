const CACHE_NAME = 'battle-tracker-180008182b';
const APP_SHELL = ['./', './index.html'];

async function precache(cache) {
  // Force each app-shell file to be fetched straight from the network,
  // bypassing the browser's own HTTP cache. Without this, a stale
  // browser-cached copy of index.html could silently get baked into the
  // Service Worker's cache on "update", making every future update check
  // report "already latest" while the visible app stays on the old version.
  await Promise.all(APP_SHELL.map(async url => {
    const response = await fetch(url, { cache: 'reload' });
    await cache.put(url, response);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => precache(cache))
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
          const networkResponse = preload || await fetch(event.request, { cache: 'no-store' });
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
