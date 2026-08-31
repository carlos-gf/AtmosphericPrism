/* Offline cache.

   The point of this file is that the booth does not depend on conference wifi.
   Open the app once anywhere with a connection; from then on it loads and runs
   with the network switched off entirely.

   Bump CACHE when you change the words, the images or the code, otherwise the
   iPad will keep serving the version it already has. */

const CACHE = 'hp-kaleido-v1';

const SCENE_IDS = [
  'bangkok', 'fireworks', 'fuji', 'hamburg', 'hiyoshi',
  'river', 'sasazuka', 'shinjuku', 'sunset', 'weimar',
];

const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/scenes.js',
  'manifest.webmanifest',
  'icon.png',
  ...SCENE_IDS.flatMap(id => [`img/${id}_rpca.jpg`, `img/${id}_src.jpg`]),
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache first. Nothing here changes without a version bump, and a booth would
   rather serve a slightly old build instantly than wait on a captive portal. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('index.html')))
  );
});
