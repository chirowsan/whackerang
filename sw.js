/* Boomerang Brawl service worker - build v2.0-20261016-2058. Whole game is one HTML file, so precache is tiny. */
const VERSION = 'v2.0-20261016-2058';
const CACHE = 'bb-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png', './screenshots/play.png', './screenshots/menu.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch((err) => { if (u === './' || u === './index.html') throw err; })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('bb-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    for (const c of await self.clients.matchAll()) c.postMessage({ type: 'offline-ready', version: VERSION });
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); if (e.data === 'version') e.source && e.source.postMessage({ type: 'version', version: VERSION }); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { // app shell: cache first so it opens instantly offline; new version arrives through SW update
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match('./index.html')) || (await c.match('./')) || fetch(req)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit;
    try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
  }));
});
