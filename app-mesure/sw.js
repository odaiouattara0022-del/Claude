// Toise — service worker
// Les fichiers de l'app sont toujours servis ensemble depuis une même « génération » de cache :
// jamais une vieille page avec un nouveau script. Les mises à jour sont téléchargées en arrière-plan,
// puis la page propose de recharger.
const PREFIX = 'toise-app-';
const TILES = 'toise-tiles-v2';
const MAX_TILES = 3000;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const SHELL_PATHS = new Set(SHELL.map((f) => new URL(f, self.location).pathname));
const TILE_HOSTS = ['server.arcgisonline.com', 'tile.openstreetmap.org'];

async function currentCache() {
  const keys = (await caches.keys()).filter((k) => k.startsWith(PREFIX)).sort();
  return keys.length ? caches.open(keys[keys.length - 1]) : null;
}

const same = (a, b) => {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

// Télécharge tous les fichiers ; s'ils ont changé, les range ensemble dans une nouvelle génération
let refreshing = null, lastRefresh = 0;
function refresh() {
  if (refreshing) return refreshing;
  lastRefresh = Date.now();
  refreshing = (async () => {
    const res = await Promise.all(SHELL.map((f) => fetch(new Request(f, { cache: 'no-cache' }))));
    if (res.some((r) => !r.ok || r.type !== 'basic')) return false;
    const bodies = await Promise.all(res.map((r) => r.arrayBuffer()));
    const cur = await currentCache();
    let changed = !cur;
    for (let i = 0; !changed && i < SHELL.length; i++) {
      const old = await cur.match(SHELL[i]);
      changed = !old || !same(await old.arrayBuffer(), bodies[i]);
    }
    if (!changed) return false;
    const name = PREFIX + Date.now();
    const c = await caches.open(name);
    await Promise.all(SHELL.map((f, i) => c.put(f, new Response(bodies[i], {
      headers: { 'Content-Type': res[i].headers.get('Content-Type') || 'application/octet-stream' },
    }))));
    for (const k of await caches.keys()) if (k !== name && k !== TILES) await caches.delete(k);
    return !!cur;   // vraie mise à jour (et non premier remplissage)
  })().catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

async function announce() {
  for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'toise-update' });
}

self.addEventListener('install', (e) => { e.waitUntil(refresh().then(() => self.skipWaiting())); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = (await caches.keys()).filter((k) => k.startsWith(PREFIX)).sort().pop();
    for (const k of await caches.keys()) if (k !== keep && k !== TILES) await caches.delete(k);
    await trimTiles();
    await self.clients.claim();
  })());
});

let puts = 0;
async function trimTiles(extra = 0) {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES + extra; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Tuiles : cache d'abord ; seules les vraies images (CORS, statut 200) sont gardées
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(url.href);
      if (hit) return hit;
      let res;
      try { res = await fetch(url.href, { mode: 'cors', credentials: 'omit' }); } catch { return fetch(e.request); }
      if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) {
        const copy = res.clone();
        e.waitUntil(c.put(url.href, copy)
          .catch(() => trimTiles(500).then(() => c.put(url.href, res.clone())).catch(() => {}))   // quota atteint : place faite
          .then(() => { if (++puts % 25 === 0) return trimTiles(); }));
      }
      return res;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;
  const isNav = e.request.mode === 'navigate';
  if (!isNav && !SHELL_PATHS.has(url.pathname)) return;   // autres fichiers : réseau normal
  const key = isNav ? './' : url.pathname;

  e.respondWith((async () => {
    const cur = await currentCache();
    const hit = cur && await cur.match(new URL(key, self.location).href);
    if (hit) {
      // Réponse immédiate depuis le cache ; vérification de mise à jour en arrière-plan (au plus toutes les 30 s)
      if (isNav && Date.now() - lastRefresh > 30000) e.waitUntil(refresh().then((upd) => upd && announce()));
      return hit;
    }
    // Pas encore de cache : réseau, puis remplissage complet en arrière-plan
    e.waitUntil(refresh());
    return fetch(e.request);
  })());
});
