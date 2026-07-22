const CACHE_NAME = 'battle-tracker-v3';
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
    caches.keys()
      .then(keys => {
        const staleKeys = keys.filter(k => k !== CACHE_NAME);
        return Promise.all(staleKeys.map(k => caches.delete(k))).then(() => staleKeys.length > 0);
      })
      .then(hadOldCache => self.clients.claim().then(() => hadOldCache))
      .then(hadOldCache => {
        // Only notify existing tabs if this activation actually replaced an older
        // version's cache (i.e. skip the notification on a brand-new install).
        if (!hadOldCache) return;
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
