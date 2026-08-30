// Keep in sync with APP_VERSION in js/version.js - a classic (non-module)
// service worker can't import it directly, so this is bumped by hand on every
// release alongside that file.
const CACHE = 'lgv-driver-v1.4.3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/camera.js',
  './js/checklists-data.js',
  './js/checklist-view.js',
  './js/joblog-view.js',
  './js/history-view.js',
  './js/auth-view.js',
  './js/backend.js',
  './js/sync.js',
  './js/supabase-client.js',
  './js/photo-hash.js',
  './js/version.js',
  './manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
