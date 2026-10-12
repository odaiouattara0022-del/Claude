const CACHE = 'toise-v3';
const TILES = 'toise-tiles-v1';
const MAX_TILES = 3000;
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const TILE_HOSTS = ['server.arcgisonline.com', 'tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let puts = 0;
async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Tuiles de carte : cache d'abord (zones déjà vues disponibles hors connexion)
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') {
        c.put(e.request, res.clone());
        if (++puts % 100 === 0) trimTiles();
      }
      return res;
    }));
    return;
  }

  // L'app : réseau d'abord (mises à jour), cache en secours (hors ligne)
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
