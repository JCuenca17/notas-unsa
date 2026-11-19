/*
 * Service worker de Mis Notas: guarda la app para que abra sin internet.
 * Al publicar cambios, sube VERSION para que los usuarios reciban la nueva versión.
 */
var VERSION = 'mis-notas-v1';
var APP = [
  './',
  'index.html',
  'styles.css',
  'parser.js',
  'app.js',
  'favicon.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var propio = url.origin === self.location.origin;
  var fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!propio && !fuentes) return;

  // Páginas: primero la red (para tener lo último); sin internet, la copia guardada.
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then(function (res) {
        var copia = res.clone();
        caches.open(VERSION).then(function (c) { c.put('index.html', copia); });
        return res;
      }).catch(function () { return caches.match('index.html'); })
    );
    return;
  }

  // Archivos y fuentes: la copia guardada al instante y se actualiza por detrás.
  ev.respondWith(
    caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (guardado) {
        var red = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }).catch(function () { return guardado; });
        return guardado || red;
      });
    })
  );
});
