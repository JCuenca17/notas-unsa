/*
 * Service worker de Mis Notas: guarda la app para que abra sin internet.
 * Al publicar cambios, sube VERSION para que los usuarios reciban la nueva versión.
 */
var VERSION = 'mis-notas-v6';
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
  'icons/apple-touch-icon.png',
  'og.png',
  'privacidad.html',
  'cookies.html',
  'terminos.html',
  'fonts/schibsted-grotesk-latin.woff2',
  'fonts/schibsted-grotesk-latin-ext.woff2'
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
  var fuentes = false; // la tipografía ahora se aloja en el sitio
  if (!propio && !fuentes) return;
  if (url.pathname.indexOf('/_vercel/') === 0) return; // contador de visitas: siempre directo

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

  // Fuentes: la copia guardada (no cambian).
  if (fuentes) {
    ev.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (g) {
        return g || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  // Archivos de la app: siempre lo último de la red; la copia guardada solo sin internet.
  ev.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (g) { return g || Response.error(); }); })
  );
});
