const CACHE = 'cns-v1';
const PRECACHE = [
  '/smart-campus-navigator/',
  '/smart-campus-navigator/index.html',
  '/smart-campus-navigator/css/style.css',
  '/smart-campus-navigator/js/app.js',
  '/smart-campus-navigator/js/auth.js',
  '/smart-campus-navigator/js/firebase.js',
  '/smart-campus-navigator/js/routing.js',
  '/smart-campus-navigator/js/locations.js',
  '/smart-campus-navigator/js/userLocation.js',
  '/smart-campus-navigator/js/proximity.js',
  '/smart-campus-navigator/js/lang.js',
  '/smart-campus-navigator/map.geojson'
];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)))
);

self.addEventListener('activate', e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
);

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
