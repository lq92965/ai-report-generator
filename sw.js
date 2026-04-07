/* Service Worker — Reportify PWA (cache shell + offline fallback) */
const CACHE_NAME = 'reportify-pwa-v13-native-export-data-dir';
const PRECACHE_URLS = [
  './',
  './index.html',
  './generate.html',
  './oauth-native-bridge.html',
  './account.html',
  './contact.html',
  './usage.html',
  './style.css',
  './mobile-patch.css',
  './mobile-patch.js',
  './pwa-nav.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './news.html',
  './blog.html',
  './history.html',
  './profile.html',
  './script.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache partial failure:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html') || caches.match('/index.html');
          }
          return undefined;
        })
      )
  );
});
