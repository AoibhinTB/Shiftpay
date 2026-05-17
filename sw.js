// ShiftPay service worker — network-first strategy
// Always fetches fresh content from the server; falls back to cache if offline.
var CACHE = 'shiftpay-v1';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(['/', './index.html']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.mode === 'navigate') {
    // Network-first: always try to get the latest version
    e.respondWith(
      fetch(e.request).then(function(response) {
        // Cache the fresh copy
        return caches.open(CACHE).then(function(cache) {
          cache.put(e.request, response.clone());
          return response;
        });
      }).catch(function() {
        // Offline fallback: serve cached version
        return caches.match(e.request);
      })
    );
  }
});
