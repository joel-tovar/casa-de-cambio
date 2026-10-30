const CACHE = 'cdc-v1';
const BASE = ['./', 'index.html', 'three.min.js', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // la página y las tasas: primero la red, para que siempre salga lo último; sin señal, lo guardado
  if (e.request.mode === 'navigate' || u.pathname.endsWith('tasas.json') || u.pathname.endsWith('index.html')) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(u.pathname.endsWith('tasas.json') ? 'tasas.json' : e.request, c)); return r; })
      .catch(() => caches.match(u.pathname.endsWith('tasas.json') ? 'tasas.json' : e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return res; })));
});
