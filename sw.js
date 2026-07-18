var CACHE = 'shiftpay-v42';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/fraunces.woff2',
  './fonts/geist.woff2',
  './fonts/geist-mono.woff2',
  './shiftpay-clock-cream-180.png',
  './shiftpay-clock-cream-512.png',
  './shiftpay-clock-cream-1024.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) { return cache.addAll(ASSETS); })
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
  var req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function(res) {
        return caches.open(CACHE).then(function(cache) {
          cache.put(req, res.clone());
          return res;
        });
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (res.ok && req.url.indexOf(self.location.origin) === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
