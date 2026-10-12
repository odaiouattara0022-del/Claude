const CACHE = 'toise-v4';
const TILES = 'toise-tiles-v2';
const MAX_TILES = 3000;
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const TILE_HOSTS = ['server.arcgisonline.com', 'tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
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

  // Tuiles de carte : cache d'abord ; seules les vraies images (CORS, statut 200) sont gardées
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(url.href);
      if (hit) return hit;
      let res;
      try { res = await fetch(url.href, { mode: 'cors', credentials: 'omit' }); } catch { return fetch(e.request); }
      const type = res.headers.get('content-type') || '';
      if (res.ok && type.startsWith('image/')) {
        try { e.waitUntil(c.put(url.href, res.clone()).then(() => { if (++puts % 100 === 0) return trimTiles(); }).catch(() => {})); } catch {}
      }
      return res;
    }));
    return;
  }

  // L'app : réseau d'abord (mises à jour) avec 4 s maximum, puis copie en cache.
  // Seules les réponses 200 de ce site sont gardées, sous une clé sans paramètres (?fbclid, ?utm…).
  if (url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname;
  const net = fetch(e.request);
  // Mise en cache déclarée tout de suite (et clonée avant que la page ne lise la réponse)
  e.waitUntil(net.then((res) => {
    if (!res.ok || res.type !== 'basic') return;
    const copy = res.clone();
    return caches.open(CACHE).then((c) => c.put(key, copy));
  }).catch(() => {}));
  const cached = () => caches.match(key).then((h) => h || (e.request.mode === 'navigate' ? caches.match(new URL('./', self.location).href) : undefined));
  e.respondWith((async () => {
    const quick = await Promise.race([net.catch(() => null), new Promise((r) => setTimeout(() => r('lent'), 4000))]);
    if (quick && quick !== 'lent' && quick.ok) return quick;
    const h = await cached();
    if (h) return h;
    return quick && quick !== 'lent' ? quick : net.catch(() => Response.error());
  })());
});
