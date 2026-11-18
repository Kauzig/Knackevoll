const CACHE_NAME = 'knackevoll-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game-data.js',
  './sound.js',
  './app.js',
  './manifest.json'
];

// 1. Installation: Alle Kerndateien einmalig im Gerät speichern
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 2. Aktivierung: Alte Caches aufräumen, falls der Name mal geändert wird
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// 3. Abruf (Network-First mit Offline-Fallback):
// Versucht zuerst die aktuellste Datei aus dem Netz zu laden und im Cache zu aktualisieren.
// Ist das Gerät offline, wird sofort die gespeicherte Datei aus dem Cache geliefert.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});