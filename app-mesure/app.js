'use strict';

/* ================================================================
   Toise — outils de mesure pour iPhone (PWA)
   ================================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DEG = 180 / Math.PI;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// Nombre saisi au clavier français (« 1,5 », « 1 250,5 ») ; NaN si vide ou invalide
const pnum = (v) => { const n = parseFloat(String(v ?? '').replace(/[\s\u202f]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('toise.' + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  warned: new Set(),
  set(key, value) {
    try { localStorage.setItem('toise.' + key, JSON.stringify(value)); return true; }
    catch {
      if (key !== 'history' && !this.warned.has(key) && typeof toast === 'function') {
        this.warned.add(key);
        toast('Stockage de l\'appareil plein : ce travail n\'est plus sauvegardé. Supprimez d\'anciennes mesures avec photo.', 5000);
      }
      return false;
    }
  },
};

// Demande à iOS de ne pas effacer les données de l'app (accordé surtout une fois installée sur l'écran d'accueil)
const isStandalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch {}

/* ---------------- Statistiques (incertitudes Monte-Carlo) ---------------- */

// Générateur pseudo-aléatoire à graine fixe : les marges affichées restent stables d'un rendu à l'autre
function rng(seed = 12345) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussFrom(rand) {
  return () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
}
function meanStd(a) {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1);
  return [m, Math.sqrt(v)];
}

/* ---------------- Unités et formatage ---------------- */

const UNITS = ['cm', 'mm', 'm', 'in', 'ft'];
let unit = store.get('unit', 'cm');
if (!UNITS.includes(unit)) unit = 'cm';

function num(v, digits) {
  if (Math.abs(v) < 0.5 * 10 ** -digits) v = 0; // jamais « -0,00 »
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// tol (mm, facultatif) : ajoute des décimales quand la mesure est assez précise pour les justifier
function fmtLen(mm, u = unit, tol = Infinity) {
  if (!isFinite(mm)) return '—';
  switch (u) {
    case 'mm': return num(mm, tol < 0.1 ? 2 : (tol < 1 || mm < 100) ? 1 : 0) + ' mm';
    case 'cm': return mm >= 10000 ? num(mm / 1000, tol < 10 ? 3 : 2) + ' m' : num(mm / 10, tol < 1 ? 2 : 1) + ' cm';
    case 'm': return num(mm / 1000, tol < 1 ? 4 : (tol < 10 || mm < 10000) ? 3 : 2) + ' m';
    case 'in': return num(mm / 25.4, tol < 0.25 ? 3 : 2) + ' in';
    case 'ft': {
      const dg = tol < 2.5 ? 2 : 1;
      const inches = Math.round(mm / 25.4 * 10 ** dg) / 10 ** dg; // arrondi d'abord : jamais « 5′ 12,00″ »
      const ft = Math.floor(inches / 12 + 1e-9);
      return `${ft}′ ${num(inches - ft * 12, dg)}″`;
    }
  }
}

function fmtTol(mm, u = unit) {
  if (!isFinite(mm)) return '';
  if (u === 'in' || u === 'ft') return '± ' + num(mm / 25.4, mm < 25.4 ? 3 : 2) + ' in';
  if (mm < 1) return '± ' + num(mm, 2) + ' mm';
  if (mm < 10) return '± ' + num(mm, 1) + ' mm';
  if (mm < 1000) return '± ' + num(mm / 10, 1) + ' cm';
  return '± ' + num(mm / 1000, 2) + ' m';
}

function fmtArea(mm2, u = unit) {
  if (!isFinite(mm2)) return '—';
  const m2 = mm2 / 1e6;
  switch (u) {
    case 'mm':
    case 'cm':
    case 'm':
      if (m2 >= 10000) return num(m2 / 10000, 4) + ' ha';
      if (m2 >= 1) return num(m2, m2 >= 1000 ? 0 : m2 >= 100 ? 1 : 3) + ' m²';
      return u === 'm' ? num(m2, 4) + ' m²' : num(mm2 / 100, 1) + ' cm²';
    case 'in': return num(mm2 / 645.16, 1) + ' in²';
    case 'ft': return m2 >= 4046.86 ? num(m2 / 4046.86, 3) + ' acres' : num(mm2 / 92903.04, 2) + ' ft²';
  }
}

const fmtDeg = (d, digits = 1) => num(d, digits) + '°';

// Étiquettes de côtés (carte, croquis) : décimales constantes, mètres ou pieds
function fmtSide(mm) {
  if (unit === 'in' || unit === 'ft') { const ft = mm / 304.8; return num(ft, ft < 100 ? 1 : 0) + ' ft'; }
  const m = mm / 1000;
  return num(m, m < 100 ? 2 : 1) + ' m';
}

const paintUnit = () => { $('unitBtn').textContent = unit; $('unitBtn').setAttribute('aria-label', `Unité : ${unit}. Toucher pour changer`); };
paintUnit();
$('unitBtn').addEventListener('click', () => {
  unit = UNITS[(UNITS.indexOf(unit) + 1) % UNITS.length];
  paintUnit();
  store.set('unit', unit);
  Photo.refresh();
  Height.render();
  Ruler.draw(); Ruler.place();
  Terrain.render();
  Plan.totals();
});

/* ---------------- Toast et feuille d'enregistrement ---------------- */

let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Bouton destructeur : un premier toucher arme (« Confirmer ? »), le second agit
function armConfirm(btn, needs, action) {
  const label = btn.textContent;
  let armed = false, t;
  btn.addEventListener('click', () => {
    if (needs() && !armed) {
      armed = true; btn.textContent = 'Confirmer ?'; btn.classList.add('danger');
      t = setTimeout(() => { armed = false; btn.textContent = label; btn.classList.remove('danger'); }, 2500);
      return;
    }
    clearTimeout(t); armed = false; btn.textContent = label; btn.classList.remove('danger');
    action();
  });
}

let sheetCb = null;
function askSave(kind, value, cb, opts = {}) {
  $('sheetTitle').textContent = opts.title || 'Enregistrer : ' + kind;
  $('sheetValue').textContent = value;
  $('sheetNote').value = '';
  $('sheetNote').placeholder = opts.placeholder || 'Note (ex. : largeur porte salon)';
  $('sheetNote').inputMode = opts.inputMode || 'text';
  $('sheetOk').textContent = opts.ok || 'Enregistrer';
  $('sheet').hidden = false;
  sheetCb = cb;
}
$('sheetCancel').addEventListener('click', () => { $('sheet').hidden = true; sheetCb = null; });
$('sheetNote').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('sheetOk').click(); } });
$('sheetOk').addEventListener('click', () => {
  $('sheet').hidden = true;
  if (sheetCb) sheetCb($('sheetNote').value.trim());
  sheetCb = null;
});

/* ---------------- Capteurs (orientation) ---------------- */

const Sensors = {
  up: null,             // vecteur « haut » lissé, repère de l'appareil
  listeners: new Set(),
  started: false,

  async start() {
    if (this.started) return true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        // iOS ne redemande pas pendant la session : il faut quitter Safari (ou l'app installée) et la rouvrir
        if (res !== 'granted') { toast('Accès aux capteurs refusé. Quittez complètement Safari ou Toise, rouvrez-le, puis touchez « Autoriser ».', 6000); return false; }
      }
    } catch {
      toast('Touchez le bouton pour autoriser les capteurs.');
      return false;
    }
    window.addEventListener('deviceorientation', (e) => this.onOrient(e));
    this.started = true;
    setTimeout(() => { if (!this.up && (!$('s-height').hidden || !$('s-level').hidden)) toast('Aucun capteur détecté sur cet appareil.'); }, 1500);
    return true;
  },

  onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta / DEG, g = e.gamma / DEG;
    const raw = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
    if (!this.up) this.up = raw;
    else {
      const u = this.up.map((v, i) => v + (raw[i] - v) * 0.3);
      const n = Math.hypot(...u) || 1;
      this.up = u.map((v) => v / n);
    }
    // Axe de la caméra (−z appareil) dans le repère terrestre : élévation et cap (gyroscopique, relatif)
    let cam;
    if (e.alpha != null) {
      const a = e.alpha / DEG, ca = Math.cos(a), sa = Math.sin(a);
      const cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
      const X = -ca * sg - sa * sb * cg, Y = -sa * sg + ca * sb * cg, Z = -cb * cg;
      cam = { elev: Math.asin(clamp(Z, -1, 1)) * DEG, head: (Math.atan2(X, Y) * DEG + 360) % 360 };
    } else cam = { elev: Math.asin(clamp(-raw[2], -1, 1)) * DEG, head: null };
    const t = performance.now();
    this.listeners.forEach((fn) => fn(this.up, raw, t, cam));
  },

  on(fn) { this.listeners.add(fn); },
};

/* ---------------- Historique ---------------- */

const History = {
  items: store.get('history', []),

  add(kind, value, note, img) {
    const item = { id: Date.now(), kind, value, note, date: new Date().toISOString(), img: img || null };
    this.items.unshift(item);
    if (!store.set('history', this.items)) {
      item.img = null;
      if (!store.set('history', this.items)) { this.items.shift(); toast('Stockage plein : supprimez des mesures.'); return; }
      toast('Enregistré (sans photo, stockage plein)');
    } else toast(isStandalone() || store.get('installTip', false) ? 'Mesure enregistrée'
      : 'Mesure enregistrée. Ajoutez Toise à l\'écran d\'accueil pour la garder (Partager › Sur l\'écran d\'accueil).', isStandalone() ? 2400 : 5000);
    if (!isStandalone()) store.set('installTip', true);
    this.render();
  },

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    store.set('history', this.items);
    this.render();
  },

  asText() {
    return this.items.map((i) => {
      const d = new Date(i.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      return `${d} · ${i.kind}${i.note ? ' · ' + i.note : ''}\n${i.value}`;
    }).join('\n\n');
  },

  render() {
    const list = $('histList');
    list.textContent = '';
    $('histEmpty').hidden = this.items.length > 0;
    $('installNote').hidden = isStandalone();
    for (const i of this.items) {
      const li = document.createElement('li');
      if (i.img) {
        const im = document.createElement('img');
        im.src = i.img; im.alt = '';
        li.append(im);
      }
      const body = document.createElement('div');
      body.className = 'h-body';
      const k = document.createElement('div'); k.className = 'h-kind'; k.textContent = i.kind;
      const v = document.createElement('div'); v.className = 'h-val'; v.textContent = i.value;
      const m = document.createElement('div'); m.className = 'h-meta';
      m.textContent = (i.note ? i.note + ' · ' : '') +
        new Date(i.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
      body.append(k, v, m);
      const del = document.createElement('button');
      del.className = 'h-del'; del.textContent = '×'; del.setAttribute('aria-label', 'Supprimer');
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) { armed = true; del.textContent = 'Suppr. ?'; del.style.fontSize = '13px'; setTimeout(() => { armed = false; del.textContent = '×'; del.style.fontSize = ''; }, 2500); return; }
        this.remove(i.id);
      });
      li.append(body, del);
      list.append(li);
    }
  },
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copié'); }
  catch { toast('Copie impossible sur cet appareil'); }
}
$('copyAll').addEventListener('click', () => copyText(History.asText()));
$('shareAll').addEventListener('click', async () => {
  const text = History.asText();
  if (navigator.share) { try { await navigator.share({ title: 'Mesures Toise', text }); } catch {} }
  else copyText(text);
});
// Sauvegarde complète : toutes les clés « toise.* » dans un fichier JSON
function exportData() {
  const data = { app: 'Toise', version: 1, date: new Date().toISOString(), keys: {} };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('toise.')) data.keys[k.slice(6)] = JSON.parse(localStorage.getItem(k));
    }
  } catch {}
  return JSON.stringify(data);
}

$('exportAll').addEventListener('click', async () => {
  const json = exportData();
  const name = `toise-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde Toise' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || data.app !== 'Toise' || typeof data.keys !== 'object') throw new Error('format');
    const items = Array.isArray(data.keys.history) ? data.keys.history : [];
    // Validation stricte : texte simple, images JPEG en data: uniquement (tout est affiché en textContent)
    const clean = items.filter((i) => i && typeof i.value === 'string').map((i) => ({
      id: Number(i.id) || Date.now() + Math.random(), kind: String(i.kind || 'Mesure').slice(0, 80), value: String(i.value).slice(0, 2000),
      note: String(i.note || '').slice(0, 200), date: isNaN(Date.parse(i.date)) ? new Date().toISOString() : i.date,
      img: typeof i.img === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(i.img) ? i.img : null,
    }));
    const known = new Set(History.items.map((i) => i.id));
    const added = clean.filter((i) => !known.has(i.id));
    History.items = [...History.items, ...added].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    store.set('history', History.items);
    for (const k of ['plan', 'terrainPts', 'levelCalib2', 'ppi', 'eyeH', 'armOff']) {
      if (data.keys[k] !== undefined && store.get(k, null) == null) store.set(k, data.keys[k]);
    }
    History.render();
    toast(`${added.length} mesure${added.length > 1 ? 's' : ''} importée${added.length > 1 ? 's' : ''}. Rouvrez l'app pour retrouver le plan et les réglages.`, 4000);
  } catch { toast('Fichier non reconnu : choisissez un export Toise (.json)'); }
});

let clearArmed = false;
$('clearAll').addEventListener('click', () => {
  if (!clearArmed) {
    clearArmed = true; $('clearAll').textContent = 'Confirmer ?';
    setTimeout(() => { clearArmed = false; $('clearAll').textContent = 'Tout effacer'; }, 3000);
    return;
  }
  History.items = []; store.set('history', []); History.render();
  clearArmed = false; $('clearAll').textContent = 'Tout effacer';
});

/* ================================================================
   VISION — affinage sous-pixel des points sur la photo
   ================================================================ */

const Vision = {
  cv: document.createElement('canvas'),

  // Patch en niveaux de gris : pixel (i, j) = pixel image (x0 + i, y0 + j), centre en +0,5
  patch(img, x0, y0, w, h) {
    const c = this.cv; c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]) / 255;
    return { g, w, h, x0, y0 };
  },

  fits(img, x0, y0, w, h) { return x0 >= 0 && y0 >= 0 && x0 + w <= img.naturalWidth && y0 + h <= img.naturalHeight; },

  sample(P, x, y) {
    const fx = x - P.x0 - 0.5, fy = y - P.y0 - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= P.w - 1 || iy >= P.h - 1) return NaN;
    const ax = fx - ix, ay = fy - iy, i = iy * P.w + ix, g = P.g;
    return (g[i] * (1 - ax) + g[i + 1] * ax) * (1 - ay) + (g[i + P.w] * (1 - ax) + g[i + P.w + 1] * ax) * ay;
  },

  // Bord le plus net le long de « dir » autour de p (profil d'intensité, sommet de gradient parabolique)
  edgeAlong(img, p, dir, S) {
    const R = Math.ceil(S + 4), n = 2 * R + 1;
    const x0 = Math.floor(p[0]) - R, y0 = Math.floor(p[1]) - R;
    if (!this.fits(img, x0, y0, n, n)) return null;
    const P = this.patch(img, x0, y0, n, n);
    const step = 0.5, m = Math.ceil(S / step) + 2;
    const raw = [];
    for (let k = -m; k <= m; k++) raw.push(this.sample(P, p[0] + dir[0] * k * step, p[1] + dir[1] * k * step));
    const prof = raw.map((v, k) => (k === 0 || k === raw.length - 1) ? v : (raw[k - 1] + 2 * v + raw[k + 1]) / 4);
    const der = prof.map((v, k) => (k === 0 || k === prof.length - 1) ? 0 : Math.abs(prof[k + 1] - prof[k - 1]) / (2 * step));
    let best = -1, bk = -1;
    const sig2 = 2 * (S * 0.7) ** 2;
    for (let k = 2; k < der.length - 2; k++) {
      if (!isFinite(der[k])) continue;
      const s = (k - m) * step;
      if (Math.abs(s) > S) continue;
      const sc = der[k] * Math.exp(-(s * s) / sig2);
      if (sc > best) { best = sc; bk = k; }
    }
    if (bk < 0) return null;
    const a0 = der[bk - 1], a1 = der[bk], a2 = der[bk + 1], den = a0 - 2 * a1 + a2;
    const off = den < 0 ? clamp(0.5 * (a0 - a2) / den, -0.5, 0.5) : 0;
    const s = (bk - m + off) * step;
    return { p: [p[0] + dir[0] * s, p[1] + dir[1] * s], strength: a1 };
  },

  // Droite par moindres carrés totaux, avec rejet des points aberrants
  fitLine(pts) {
    let cur = pts;
    for (let pass = 0; pass < 3; pass++) {
      if (cur.length < 6) return null;
      const cx = cur.reduce((s, p) => s + p[0], 0) / cur.length;
      const cy = cur.reduce((s, p) => s + p[1], 0) / cur.length;
      let sxx = 0, sxy = 0, syy = 0;
      for (const [x, y] of cur) { sxx += (x - cx) ** 2; sxy += (x - cx) * (y - cy); syy += (y - cy) ** 2; }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const nrm = [-Math.sin(th), Math.cos(th)];
      const res = cur.map(([x, y]) => (x - cx) * nrm[0] + (y - cy) * nrm[1]);
      const mad = [...res].map(Math.abs).sort((a, b) => a - b)[Math.floor(res.length / 2)] * 1.4826;
      const lim = Math.max(0.8, 3 * mad);
      const keep = cur.filter((_, i) => Math.abs(res[i]) <= lim);
      if (keep.length === cur.length || pass === 2) {
        const rms = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
        return { n: nrm, d: cx * nrm[0] + cy * nrm[1], rms, count: cur.length };
      }
      cur = keep;
    }
  },

  intersect(l1, l2) {
    const det = l1.n[0] * l2.n[1] - l1.n[1] * l2.n[0];
    if (Math.abs(det) < 1e-6) return null;
    return [(l1.d * l2.n[1] - l1.n[1] * l2.d) / det, (l1.n[0] * l2.d - l1.d * l2.n[0]) / det];
  },

  // Affine les 4 coins d'une référence rectangulaire : ajuste une droite sur chaque bord,
  // puis intersecte les bords (insensible aux coins arrondis d'une carte bancaire)
  refineQuad(img, q, hint = 6) {
    const first = this.refineQuadOnce(img, q, hint);
    if (!first) return null;
    return this.refineQuadOnce(img, first, 3) || first;
  },

  refineQuadOnce(img, q, hint) {
    const lines = [];
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4], L = dist(a, b);
      if (L < 24) return null;
      const nrm = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
      const S = clamp(Math.max(L * 0.04, hint), 3, 40);
      const K = Math.round(clamp(L / 6, 14, 60));
      const pts = [];
      for (let k = 0; k < K; k++) {
        const u = 0.12 + 0.76 * k / (K - 1);
        const r = this.edgeAlong(img, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], nrm, S);
        if (r && r.strength > 0.015) pts.push(r.p);
      }
      const line = this.fitLine(pts);
      if (!line) return null;
      lines.push(line);
    }
    const out = [];
    for (let i = 0; i < 4; i++) {
      const prev = lines[(i + 3) % 4], next = lines[i];
      const c = this.intersect(prev, next);
      const minSide = Math.min(dist(q[0], q[1]), dist(q[1], q[2]));
      if (!c || dist(c, q[i]) > Math.max(10, hint * 2, minSide * 0.08)) return null;
      c.sig = Math.max(0.12, 2 * Math.hypot(prev.rms / Math.sqrt(prev.count), next.rms / Math.sqrt(next.count)));
      c.snapped = true;
      out.push(c);
    }
    return out;
  },

  // Coin net le plus proche (Shi-Tomasi) puis affinage sous-pixel (méthode de Förstner)
  refineCorner(img, p, searchR) {
    const r = Math.round(clamp(searchR, 3, 30)), w = 4, R = r + w + 3, n = 2 * R + 1;
    const x0 = Math.round(p[0]) - R, y0 = Math.round(p[1]) - R;
    if (!this.fits(img, x0, y0, n, n)) return null;
    const { g } = this.patch(img, x0, y0, n, n);
    const gx = new Float32Array(n * n), gy = new Float32Array(n * n);
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      gx[i] = (g[i - n + 1] + 2 * g[i + 1] + g[i + n + 1] - g[i - n - 1] - 2 * g[i - 1] - g[i + n - 1]) / 8;
      gy[i] = (g[i + n - 1] + 2 * g[i + n] + g[i + n + 1] - g[i - n - 1] - 2 * g[i - n] - g[i - n + 1]) / 8;
    }
    let best = -1, bx = R, by = R, bestRaw = 0;
    const sig2 = 2 * (r * 0.7) ** 2;
    for (let y = R - r; y <= R + r; y++) for (let x = R - r; x <= R + r; x++) {
      let a = 0, b = 0, c = 0;
      for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
        const i = (y + v) * n + x + u; a += gx[i] * gx[i]; b += gx[i] * gy[i]; c += gy[i] * gy[i];
      }
      const tr = (a + c) / 2, minEig = tr - Math.sqrt(Math.max(0, tr * tr - (a * c - b * b)));
      const sc = minEig * Math.exp(-((x - R) ** 2 + (y - R) ** 2) / sig2);
      if (sc > best) { best = sc; bx = x; by = y; bestRaw = minEig; }
    }
    if (bestRaw < 0.006) return null;
    let qx = bx, qy = by;
    for (let it = 0; it < 12; it++) {
      let a = 0, b = 0, c = 0, ux = 0, uy = 0;
      const ix = Math.round(qx), iy = Math.round(qy);
      for (let v = -w; v <= w; v++) for (let u = -w; u <= w; u++) {
        const x = ix + u, y = iy + v;
        if (x < 1 || y < 1 || x > n - 2 || y > n - 2) continue;
        const i = y * n + x, wt = Math.exp(-(u * u + v * v) / (2 * 2.5 * 2.5));
        const xx = gx[i] * gx[i] * wt, xy = gx[i] * gy[i] * wt, yy = gy[i] * gy[i] * wt;
        a += xx; b += xy; c += yy;
        ux += xx * x + xy * y; uy += xy * x + yy * y;
      }
      const det = a * c - b * b;
      if (det < 1e-10) break;
      const nx = (c * ux - b * uy) / det, ny = (a * uy - b * ux) / det;
      const moved = Math.hypot(nx - qx, ny - qy);
      qx = nx; qy = ny;
      if (moved < 0.01) break;
    }
    if (Math.hypot(qx - R, qy - R) > r + 1.5) return null;
    const out = [x0 + qx + 0.5, y0 + qy + 0.5];
    out.sig = 0.25; out.snapped = true;
    return out;
  },
};

/* ================================================================
   PHOTO — mesure avec correction de perspective (homographie)
   ================================================================ */

// Dimensions (mm) et tolérance de fabrication (écart-type, mm)
const REFS = {
  card: [85.6, 53.98, 0.05], a4: [210, 297, 0.7], letter: [215.9, 279.4, 0.7],
  bill: [133, 72, 0.2], tile: [300, 300, 0.5], a3: [297, 420, 1],
  deck: [2000, 1000, 2], pallet: [1200, 800, 3],
};

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Homographie avec normalisation des coordonnées (stabilité numérique sur les photos 48 Mpx)
function homography(src, dst) {
  const cx = src.reduce((s, p) => s + p[0], 0) / 4, cy = src.reduce((s, p) => s + p[1], 0) / 4;
  const sc = Math.SQRT2 / (src.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / 4 || 1);
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const x = (src[i][0] - cx) * sc, y = (src[i][1] - cy) * sc, [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  if (!h) return null;
  return (p) => {
    const x = (p[0] - cx) * sc, y = (p[1] - cy) * sc;
    const w = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
  };
}

// Homographie en matrice 3×3 (sans normalisation), pour analyser la géométrie de la prise de vue
function homMatrix(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return h && [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

// Focales usuelles de l'iPhone, rapportées au grand côté de l'image (0,5×, 1×, 2×, 3×, 5×)
const LENSES = [0.36, 0.75, 1.5, 2.2, 3.6];

// Une vraie photo (pixels carrés, centre optique au milieu) impose deux contraintes au rectangle de référence :
// ses deux axes restent perpendiculaires et à la même échelle. Chacune donne une focale ; avec la bonne
// attribution longueur/largeur, elles concordent (et collent à la focale EXIF quand on la connaît).
function aspectScore(q, W, H, imgW, imgH, fExif) {
  const D = Math.max(imgW, imgH), S = Math.max(W, H);
  const img = q.map(([x, y]) => [(x - imgW / 2) / D, (y - imgH / 2) / D]);
  const M = homMatrix([[0, 0], [W / S, 0], [W / S, H / S], [0, H / S]], img);
  if (!M) return { score: 99, persp: 0 };
  const [h11, h12, h21, h22, h31, h32] = [M[0][0], M[0][1], M[1][0], M[1][1], M[2][0], M[2][1]];
  const est = [];
  const d1 = h31 * h32, d2 = h31 * h31 - h32 * h32;
  if (Math.abs(d1) > 1e-6) est.push(-(h11 * h12 + h21 * h22) / d1);
  if (Math.abs(d2) > 1e-6) est.push(-(h11 * h11 + h21 * h21 - h12 * h12 - h22 * h22) / d2);
  const pos = est.filter((v) => v > 0).map(Math.sqrt);
  let score = (est.length - pos.length) * 4 + (est.length ? 0 : 3);
  if (pos.length === 2) score += Math.abs(Math.log(pos[0] / pos[1]));
  for (const f of pos) score += fExif ? Math.abs(Math.log(f / fExif)) : 0.5 * Math.min(...LENSES.map((t) => Math.abs(Math.log(f / t))));
  return { score, persp: Math.hypot(h31, h32) };
}

// Le grand côté de la référence est-il q0–q1 ? Comparaison des longueurs à l'image quand la vue est de face ;
// contraintes géométriques quand la perspective est marquée (vue rasante : sol, scène). Réglé par simulation :
// 98 % de bonnes décisions, contre 89 % avec les seules longueurs (69 % → 95 % à 15° de vue).
function refBigFirst(q, dims, imgW, imgH, fExif) {
  const big = Math.max(dims[0], dims[1]), small = Math.min(dims[0], dims[1]);
  const e0 = dist(q[0], q[1]) + dist(q[2], q[3]), e1 = dist(q[1], q[2]) + dist(q[3], q[0]);
  const byLength = e0 >= e1;
  if (big / small < 1.02 || !imgW) return byLength;
  const a = aspectScore(q, big, small, imgW, imgH, fExif), b = aspectScore(q, small, big, imgW, imgH, fExif);
  return Math.abs(a.score - b.score) > 0.4 && Math.max(a.persp, b.persp) > 0.1 ? a.score < b.score : byLength;
}

// Focale équivalente 24×36 (EXIF 0xA405) d'une photo JPEG, ou null
async function exifFocal35(file) {
  try {
    const v = new DataView(await file.slice(0, 196608).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = (p) => v.getUint16(t + p, le), u32 = (p) => v.getUint32(t + p, le);
        const find = (ifd, tag) => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; }
          return -1;
        };
        const ifd0 = u32(4), exifPtr = find(ifd0, 0x8769);
        if (exifPtr < 0) return null;
        const e = find(u32(exifPtr + 8), 0xA405);
        return e < 0 ? null : u16(e + 8) || null;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
      o += 2 + len;
    }
  } catch {}
  return null;
}

// Longueur saisie librement → mm : « 830 », « 1 250 mm », « 2,5 m », « 2m50 », « 36 in », « 5'11" », « 3 pieds »
function parseLength(str, defUnit) {
  const F = { mm: 1, cm: 10, dm: 100, m: 1000, km: 1e6, in: 25.4, po: 25.4, pouce: 25.4, pouces: 25.4, '"': 25.4, '″': 25.4,
    ft: 304.8, pi: 304.8, pied: 304.8, pieds: 304.8, "'": 304.8, '′': 304.8 };
  let t = String(str || '').toLowerCase().trim().replace(/(\d)[\s\u202f\u00a0]+(?=\d)/g, '$1').replace(/,/g, '.');
  let m = t.match(/^(\d+(?:\.\d+)?)\s*m\s*(\d{1,2})$/);                       // 2m50
  if (m) return parseFloat(m[1]) * 1000 + parseFloat(m[2].padEnd(2, '0')) * 10;
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:'|′|ft|pi|pieds?)\s*(\d+(?:\.\d+)?)\s*(?:"|″|in|po|pouces?)?$/); // 5'11"
  if (m) return parseFloat(m[1]) * 304.8 + parseFloat(m[2]) * 25.4;
  m = t.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|dm|km|m|in|po|pouces?|"|″|ft|pi|pieds?|'|′)?$/);
  if (!m) return NaN;
  return parseFloat(m[1]) * (F[m[2] || defUnit] || 1);
}

function orderConvex(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

// Petit magasin clé → valeur IndexedDB (pour la photo en cours, trop lourde pour localStorage)
const IDB = {
  open() {
    if (!this.p) this.p = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('idb')); return; }
      const r = indexedDB.open('toise', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.p;
  },
  async run(mode, fn) {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const tx = db.transaction('kv', mode), st = tx.objectStore('kv'), rq = fn(st);
        tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => res(undefined); tx.onabort = () => res(undefined);
      });
    } catch { return undefined; }
  },
  get(k) { return this.run('readonly', (st) => st.get(k)); },
  set(k, v) { return this.run('readwrite', (st) => st.put(v, k)); },
  del(k) { return this.run('readwrite', (st) => st.delete(k)); },
};

const ptOut = (p) => ({ x: p[0], y: p[1], sig: p.sig, snapped: !!p.snapped });
const ptIn = (o) => { const p = [o.x, o.y]; p.sig = o.sig; p.snapped = o.snapped; return p; };

const withSig = (p, src) => { p.sig = src.sig; p.snapped = src.snapped; return p; };

const Photo = {
  img: null,
  canvas: $('photoCanvas'),
  ctx: $('photoCanvas').getContext('2d'),
  loupe: $('loupe'),
  view: { s: 1, x: 0, y: 0 },
  ref: [],          // points image de la référence
  toPlane: null,    // fonction image → mm
  shapes: [],       // {type, pts, done}
  tool: 'line',
  snap: store.get('snap', true),
  lineRefLen: null,
  pointers: new Map(),
  drag: null,
  pinch: null,

  init() {
    const onFile = (e) => { const f = e.target.files[0]; if (f) this.load(f); e.target.value = ''; };
    $('photoInput').addEventListener('change', onFile);
    $('photoInputLib').addEventListener('change', onFile);
    armConfirm($('newPhotoBtn'), () => this.dirty(), () => {
      this.img = null; this.ref = []; this.shapes = []; this.saved = false;
      $('photoWork').hidden = true; $('photoEmpty').hidden = false;
      IDB.del('photo'); IDB.del('photoFile');
    });
    $('refSelect').value = store.get('ref', 'card');
    $('customRef').hidden = $('refSelect').value !== 'custom';
    this.lastRefKind = $('refSelect').value === 'line' ? 'line' : 'rect';
    $('refSelect').addEventListener('change', () => {
      store.set('ref', $('refSelect').value);
      $('customRef').hidden = $('refSelect').value !== 'custom';
      const kind = $('refSelect').value === 'line' ? 'line' : 'rect';
      if (kind !== this.lastRefKind) {
        if (this.ref.length) toast('Type de référence changé : replacez les points de la référence');
        this.ref = []; this.lineRefLen = null; this.refSwap = false;
      }
      this.lastRefKind = kind;
      this.computeRef();
      this.persist();
    });
    $('swapRefBtn').addEventListener('click', () => { this.refSwap = !this.refSwap; this.computeRef(); this.persist(); toast('Longueur et largeur de la référence inversées'); });
    $('lineLenBtn').addEventListener('click', () => this.askLineLen());
    ['customW', 'customH'].forEach((id) => $(id).addEventListener('input', () => this.computeRef()));
    armConfirm($('resetRefBtn'), () => this.ref.length > 0 && this.shapes.length > 0, () => {
      this.ref = []; this.lineRefLen = null; this.refSwap = false; this.computeRef(); this.persist();
      toast('Replacez les points de la référence');
    });
    $('undoBtn').addEventListener('click', () => this.undo());
    $('savePhotoBtn').addEventListener('click', () => this.save());
    const sb = $('snapBtn');
    const paintSnap = () => { sb.textContent = 'Aimant : ' + (this.snap ? 'oui' : 'non'); sb.classList.toggle('on', this.snap); };
    paintSnap();
    sb.addEventListener('click', () => { this.snap = !this.snap; store.set('snap', this.snap); paintSnap(); });
    document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => {
      this.finishOpen();
      this.tool = b.dataset.tool;
      document.querySelectorAll('.tool').forEach((x) => x.classList.toggle('active', x === b));
      this.refresh();
    }));

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e));
    new ResizeObserver(() => this.resize()).observe($('canvasWrap'));
  },

  load(file, state) {
    if (this.url) URL.revokeObjectURL(this.url);
    const url = this.url = URL.createObjectURL(file);
    const im = new Image();
    const f35 = state ? Promise.resolve(state.f35) : exifFocal35(file);
    im.onload = async () => {
      this.img = im; this.file = file;
      this.ref = []; this.shapes = []; this.toPlane = null; this.lineRefLen = null; this.refSwap = false;
      this.f35 = await f35;
      // Focale rapportée au grand côté de l'image (l'équivalent 24×36 se rapporte à la diagonale de 43,27 mm)
      this.focal = this.f35 ? this.f35 / 43.27 * Math.hypot(im.naturalWidth, im.naturalHeight) / Math.max(im.naturalWidth, im.naturalHeight) : null;
      if (state) {
        this.ref = (state.ref || []).map(ptIn);
        this.shapes = (state.shapes || []).map((sh) => ({ type: sh.type, done: sh.done, pts: sh.pts.map(ptIn) }));
        this.lineRefLen = state.lineRefLen || null; this.refSwap = !!state.refSwap;
        if (state.refType) { $('refSelect').value = state.refType; $('customRef').hidden = state.refType !== 'custom'; this.lastRefKind = state.refType === 'line' ? 'line' : 'rect'; }
        if (state.custom) { $('customW').value = state.custom[0] || ''; $('customH').value = state.custom[1] || ''; }
      }
      $('photoEmpty').hidden = true; $('photoWork').hidden = false;
      requestAnimationFrame(() => { this.resize(); this.fit(); this.computeRef(); });
      if (!state) {
        const mp = im.naturalWidth * im.naturalHeight / 1e6;
        toast(`Photo ${im.naturalWidth} × ${im.naturalHeight} (${num(mp, 1)} Mpx)` + (this.f35 ? ` · focale ${this.f35} mm` : '') + ' chargée en pleine résolution');
        this.persist(true);
      }
    };
    im.onerror = () => toast('Image illisible');
    im.src = url;
  },

  // Le travail en cours (photo + points) survit à un rechargement de la page, fréquent sur iPhone
  persist(withImage = false) {
    clearTimeout(this.persistT);
    this.persistT = setTimeout(() => {
      if (!this.img) { IDB.del('photo'); return; }
      const st = {
        ref: this.ref.map(ptOut), shapes: this.shapes.map((sh) => ({ type: sh.type, done: sh.done, pts: sh.pts.map(ptOut) })),
        lineRefLen: this.lineRefLen, refSwap: !!this.refSwap, refType: $('refSelect').value,
        custom: [$('customW').value, $('customH').value], f35: this.f35 || null,
      };
      if (withImage) IDB.set('photoFile', this.file);
      IDB.set('photo', st);
    }, withImage ? 0 : 400);
  },

  async restore() {
    const [st, file] = await Promise.all([IDB.get('photo'), IDB.get('photoFile')]);
    if (st && file instanceof Blob) this.load(file, st);
  },

  dirty() { return this.shapes.some((sh) => sh.pts.length) && !this.saved; },

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.cw = r.width; this.ch = r.height;
    this.draw();
  },

  fit() {
    if (!this.img) return;
    const s = Math.min(this.cw / this.img.naturalWidth, this.ch / this.img.naturalHeight);
    this.view = { s, x: (this.cw - this.img.naturalWidth * s) / 2, y: (this.ch - this.img.naturalHeight * s) / 2 };
    this.draw();
  },

  toImg(sx, sy) { return [(sx - this.view.x) / this.view.s, (sy - this.view.y) / this.view.s]; },
  toScr([x, y]) { return [x * this.view.s + this.view.x, y * this.view.s + this.view.y]; },

  refNeeded() { return $('refSelect').value === 'line' ? 2 : 4; },

  refDims() {
    const v = $('refSelect').value;
    if (v === 'custom') {
      const w = pnum($('customW').value), h = pnum($('customH').value);
      return w > 0 && h > 0 ? [w, h, 0.5] : null;
    }
    return REFS[v];
  },

  // Construit la fonction image → plan réel (mm) ; pure, réutilisée par la simulation d'incertitude
  // bigFirst : le grand côté de la référence est q0–q1 (décidé une fois dans computeRef, puis réutilisé
  // tel quel par la simulation d'incertitude pour ne pas basculer d'un tirage à l'autre)
  buildToPlane(ref, dims, lineLen, bigFirst = this.bigFirst) {
    if ($('refSelect').value === 'line') {
      if (ref.length !== 2 || !(lineLen > 0)) return null;
      const s = lineLen / dist(ref[0], ref[1]);
      return ([x, y]) => [x * s, y * s];
    }
    if (ref.length !== 4 || !dims) return null;
    const q = orderConvex(ref);
    const big = Math.max(dims[0], dims[1]), small = Math.min(dims[0], dims[1]);
    const [W, H] = bigFirst ? [big, small] : [small, big];
    return homography(q, [[0, 0], [W, 0], [W, H], [0, H]]);
  },

  computeRef() {
    const dims = this.refDims();
    if (this.ref.length === 4 && dims && $('refSelect').value !== 'line') {
      const auto = refBigFirst(orderConvex(this.ref), dims, this.img && this.img.naturalWidth, this.img && this.img.naturalHeight, this.focal);
      this.bigFirst = this.refSwap ? !auto : auto;
    }
    const square = !dims || Math.max(dims[0], dims[1]) / Math.min(dims[0], dims[1]) < 1.02;
    $('swapRefBtn').hidden = !(this.ref.length === 4 && $('refSelect').value !== 'line' && !square);
    $('lineLenBtn').hidden = $('refSelect').value !== 'line' || this.ref.length < 2;
    $('lineLenBtn').textContent = this.lineRefLen ? `Longueur : ${fmtLen(this.lineRefLen, unit, 1)} · modifier` : 'Saisir la longueur';
    this.toPlane = this.buildToPlane(this.ref, dims, this.lineRefLen);
    this.refresh();
  },

  /* --- Affinage automatique --- */

  searchR() { return clamp(14 / this.view.s, 3, 40); },

  refineRef() {
    if (!this.snap || !this.img) return;
    if (this.ref.length === 4 && $('refSelect').value !== 'line') {
      const q = orderConvex(this.ref);
      const r = Vision.refineQuad(this.img, q, Math.max(...this.ref.map((p) => (p.sig || 1) * 3), this.searchR() * 0.6));
      if (r) { this.ref = r; toast('Référence affinée au sous-pixel'); }
      else toast('Bords de la référence peu nets : placez les coins en zoomant', 3000);
    } else if (this.ref.length === 2 && $('refSelect').value === 'line') {
      this.refineSegment(this.ref);
    }
  },

  refineSegment(pts) {
    const [a, b] = pts, L = dist(a, b);
    if (L < 10) return;
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    pts.forEach((p, i) => {
      if (p.snapped) return;
      const r = Vision.edgeAlong(this.img, p, d, this.searchR());
      if (r && r.strength > 0.03) { r.p.sig = 0.3; r.p.snapped = true; pts[i] = r.p; }
    });
  },

  refinePoint(h) {
    if (!this.snap || !h.shape) return;
    const s = h.shape;
    if (s.type === 'line') { if (s.pts.length === 2) { s.pts[h.i].snapped = false; this.refineSegment(s.pts); } return; }
    const r = Vision.refineCorner(this.img, s.pts[h.i], this.searchR());
    if (r) s.pts[h.i] = r;
  },

  /* --- Interaction --- */

  pos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },

  allPoints() {
    const out = this.ref.map((p, i) => ({ arr: this.ref, i }));
    this.shapes.forEach((s) => s.pts.forEach((p, i) => out.push({ arr: s.pts, i, shape: s })));
    return out;
  },

  // Un point déjà posé n'est attrapé que si on le touche vraiment (20 px, 14 px pour une autre forme
  // que celle en cours) : on peut ainsi poser un nouveau point tout près, même en vue d'ensemble
  hit(sp) {
    let best = null, bd = 20;
    const cur = this.current();
    for (const h of this.allPoints()) {
      if (cur && h.shape && h.shape !== cur && dist(this.toScr(h.arr[h.i]), sp) > 14) continue;
      const d = dist(this.toScr(h.arr[h.i]), sp);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  },

  current() {
    const s = this.shapes[this.shapes.length - 1];
    return s && !s.done ? s : null;
  },

  // Incertitude de pointage manuel : ~0,8 point d'écran au zoom courant (avec loupe)
  manualSig() { return Math.max(0.4, 0.8 / this.view.s); },

  down(e) {
    if (!this.img) return;
    this.canvas.setPointerCapture(e.pointerId);
    const sp = this.pos(e);
    this.pointers.set(e.pointerId, sp);

    if (this.pointers.size === 2) {
      if (this.drag && this.drag.created && !this.drag.moved) this.removeHandle(this.drag.handle);
      this.drag = null; this.loupe.hidden = true;
      const [a, b] = [...this.pointers.values()];
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.pinch = { d0: dist(a, b), s0: this.view.s, imgC: this.toImg(...c) };
      this.refresh();
      return;
    }
    if (this.pointers.size > 2) return;

    const h = this.hit(sp);
    if (h) this.drag = { handle: h, start: sp, origin: [...h.arr[h.i]], created: false, moved: false };
    else {
      const p = this.toImg(...sp);
      p.sig = this.manualSig();
      const handle = this.addPoint(p);
      if (!handle) return;
      this.drag = { handle, start: sp, origin: [...p], created: true, moved: false };
    }
    this.showLoupe(this.drag.handle.arr[this.drag.handle.i]);
    this.draw();
  },

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const sp = this.pos(e);
    this.pointers.set(e.pointerId, sp);
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const minS = Math.min(this.cw / this.img.naturalWidth, this.ch / this.img.naturalHeight) * 0.5;
      const s = clamp(this.pinch.s0 * dist(a, b) / this.pinch.d0, minS, 30);
      this.view = { s, x: c[0] - this.pinch.imgC[0] * s, y: c[1] - this.pinch.imgC[1] * s };
      this.draw();
      return;
    }
    if (this.drag) {
      // Glissement démultiplié (×0,4) : le doigt ne cache pas le point et chaque pixel compte
      const d = this.drag, k = 0.4;
      if (dist(sp, d.start) > 3) d.moved = true;
      const { arr, i } = d.handle;
      const p = [d.origin[0] + (sp[0] - d.start[0]) * k / this.view.s, d.origin[1] + (sp[1] - d.start[1]) * k / this.view.s];
      p.sig = this.manualSig(); p.snapped = false;
      arr[i] = p;
      if (arr === this.ref) this.toPlane = this.buildToPlane(this.ref, this.refDims(), this.lineRefLen);
      this.showLoupe(p);
      this.refresh();
    }
  },

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.refresh(); return; }
    if (this.drag) {
      const d = this.drag;
      const sh = d.handle.shape;
      const isRef = d.handle.arr === this.ref;
      this.drag = null;
      this.loupe.hidden = true;
      // Toucher le premier point d'une surface ferme le polygone
      if (!d.created && !d.moved && sh && sh.type === 'area' && !sh.done && d.handle.i === 0 && sh.pts.length >= 3) {
        sh.done = true;
      } else if (isRef) {
        if (this.ref.length === this.refNeeded()) this.refineRef();
      } else {
        this.refinePoint(d.handle);
      }
      if (isRef) this.computeRef();
      if (this.ref.length === 2 && $('refSelect').value === 'line' && !this.lineRefLen) this.askLineLen();
      this.refresh();
      this.saved = false;
      if (sh && sh.type === 'area' && sh.done && this.toPlane) setLastArea(this.value('area', sh.pts.map(this.toPlane)) / 1e6, 'Photo');
      this.persist();
    }
  },

  askLineLen() {
    const def = unit === 'ft' ? 'ft' : unit;
    askSave('', `Entrez la longueur réelle entre les 2 points : 830 mm, 92 cm, 2,50 m, 2m50, 36 in, 5'11"… Sans unité : ${def}.`, (v) => {
      const L = parseLength(v, def);
      if (L > 0 && L < 1e7) {
        this.lineRefLen = L; this.computeRef(); this.persist();
        toast(`Longueur de référence : ${fmtLen(L, unit, 0.5)}`);
      } else {
        toast('Longueur non comprise : écrivez par exemple « 2,50 m » ou « 830 mm »', 3500);
        setTimeout(() => this.askLineLen(), 400);
      }
    }, { title: 'Longueur de référence', placeholder: 'ex. : 2,50 m', inputMode: 'text', ok: 'Valider' });
  },

  addPoint(p) {
    if (this.ref.length < this.refNeeded()) {
      this.ref.push(p);
      return { arr: this.ref, i: this.ref.length - 1 };
    }
    if (!this.toPlane) { toast('Indiquez d\'abord la taille de la référence'); return null; }
    let cur = this.current();
    if (!cur || cur.type !== this.tool) {
      this.finishOpen();
      cur = { type: this.tool, pts: [], done: false };
      this.shapes.push(cur);
    }
    cur.pts.push(p);
    if ((cur.type === 'line' && cur.pts.length === 2) || (cur.type === 'angle' && cur.pts.length === 3)) cur.done = true;
    return { arr: cur.pts, i: cur.pts.length - 1, shape: cur };
  },

  removeHandle(h) {
    h.arr.splice(h.i, 1);
    if (h.shape) { h.shape.done = false; if (!h.shape.pts.length) this.shapes.splice(this.shapes.indexOf(h.shape), 1); }
    if (h.arr === this.ref) this.computeRef();
  },

  finishOpen() {
    const cur = this.current();
    if (!cur) return;
    if (cur.type === 'area' && cur.pts.length >= 3) cur.done = true;
    else this.shapes.pop();
  },

  undo() {
    const last = this.shapes[this.shapes.length - 1];
    if (last) {
      last.pts.pop(); last.done = false;
      if (!last.pts.length) this.shapes.pop();
    } else if (this.ref.length) { this.ref.pop(); this.computeRef(); }
    this.refresh();
    this.persist();
  },

  /* --- Calculs --- */

  value(type, P) {
    if (type === 'line') return P.length === 2 ? dist(P[0], P[1]) : null;
    if (type === 'area') {
      if (P.length < 3) return null;
      let a = 0;
      for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
      return Math.abs(a) / 2;
    }
    if (type === 'angle') {
      if (P.length !== 3) return null;
      const v1 = [P[0][0] - P[1][0], P[0][1] - P[1][1]], v2 = [P[2][0] - P[1][0], P[2][1] - P[1][1]];
      return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2)), -1, 1)) * DEG;
    }
    return null;
  },

  perimeter(P, closed) {
    let per = 0;
    for (let i = 0; i < P.length - (closed ? 0 : 1); i++) per += dist(P[i], P[(i + 1) % P.length]);
    return per;
  },

  // Propagation complète des erreurs : pointage de chaque point (référence comprise)
  // et tolérance de l'objet de référence, par simulation (300 tirages). Renvoie ±2σ (95 %).
  uncertainty(s) {
    const dims = this.refDims();
    const g = gaussFrom(rng(7));
    const jit = (p) => { const k = p.sig ?? 1; return [p[0] + g() * k, p[1] + g() * k]; };
    const vals = [];
    for (let n = 0; n < 300; n++) {
      const ref = this.ref.map(jit);
      const d = dims && [dims[0] + g() * dims[2], dims[1] + g() * dims[2]];
      const L = this.lineRefLen && this.lineRefLen + g() * 0.5;
      const tp = this.buildToPlane(ref, d, L, this.bigFirst);
      if (!tp) continue;
      const v = this.value(s.type, s.pts.map(jit).map(tp));
      if (v != null && isFinite(v)) vals.push(v);
    }
    return vals.length > 20 ? 2 * meanStd(vals)[1] : null;
  },

  measure(s) {
    const P = s.pts.map(this.toPlane);
    const v = this.value(s.type, P);
    if (v == null) return null;
    const tol = this.drag || this.pinch ? s.lastTol : this.uncertainty(s);
    s.lastTol = tol;
    if (s.type === 'line') {
      return { label: 'Longueur', short: fmtLen(v, unit, tol ?? Infinity), tol: tol != null ? fmtTol(tol) : '', rel: tol / v };
    }
    if (s.type === 'area') {
      return { label: 'Surface', short: fmtArea(v), tol: tol != null ? '± ' + fmtArea(tol) : '',
        extra: 'périm. ' + fmtLen(this.perimeter(P, s.done)), rel: tol / v };
    }
    return { label: 'Angle', short: fmtDeg(v, tol != null && tol < 0.2 ? 2 : 1), tol: tol != null ? '± ' + fmtDeg(tol, 2) : '', rel: tol / 90 };
  },

  /* --- Rendu --- */

  refresh() {
    const needed = this.refNeeded();
    const step = $('photoStep');
    if (this.ref.length < needed) {
      step.textContent = needed === 4
        ? `1. Touchez les 4 coins de la référence (${this.ref.length}/4) · zoomez à 2 doigts`
        : `1. Touchez les 2 extrémités de la longueur connue (${this.ref.length}/2)`;
    } else if (!this.toPlane) {
      step.textContent = needed === 4 ? '1. Indiquez la taille de la référence' : '1. Indiquez la longueur de référence';
    } else {
      const hint = { line: 'Touchez 2 points', area: 'Touchez les sommets, puis le 1er pour fermer', angle: 'Touchez 3 points (sommet au milieu)' }[this.tool];
      step.textContent = '2. ' + hint + ' · glissez pour ajuster finement';
    }
    $('measureTools').hidden = !this.toPlane;

    const ul = $('photoResults');
    ul.textContent = '';
    let worst = 0;
    if (this.toPlane) {
      let n = 0;
      for (const s of this.shapes) {
        const m = this.measure(s);
        if (!m) continue;
        n++;
        if (m.rel > worst) worst = m.rel;
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = `${m.label} ${n}`;
        const b = document.createElement('span');
        const strong = document.createElement('b'); strong.textContent = m.short;
        const t = document.createElement('small'); t.textContent = ' ' + m.tol + (m.extra ? ' · ' + m.extra : '');
        b.append(strong, t);
        const del = document.createElement('button');
        del.className = 'row-del'; del.textContent = '×'; del.setAttribute('aria-label', `Supprimer ${m.label.toLowerCase()} ${n}`);
        del.addEventListener('click', () => { this.shapes.splice(this.shapes.indexOf(s), 1); this.refresh(); this.persist(); });
        li.append(a, b, del); ul.append(li);
        s.labelText = m.short;
      }
      const li = document.createElement('li');
      li.className = 'precision';
      if ($('refSelect').value === 'line') li.textContent = 'Longueur connue : simple mise à l\'échelle, sans correction de perspective. Mesurez dans le même plan, de face et près de la référence ; la marge ne compte que le pointage.';
      else if (!n) li.textContent = 'Marge à 95 % calculée pour chaque mesure (pointage + référence).';
      else if (worst > 0.02) li.textContent = 'Pour réduire la marge : zoomez avant de placer les points, prenez une référence plus grande (A4) et proche de l\'objet, photographiez bien de face.';
      else li.textContent = 'Marges à 95 % : pointage, perspective et tolérance de la référence inclus.';
      ul.append(li);
    }
    this.draw();
  },

  draw(target = this.ctx, scale = window.devicePixelRatio || 1, view = this.view, w = this.cw, h = this.ch) {
    const ctx = target;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (!this.img) return;
    ctx.imageSmoothingEnabled = view.s * scale < 3; // pixels nets au fort zoom
    ctx.drawImage(this.img, view.x, view.y, this.img.naturalWidth * view.s, this.img.naturalHeight * view.s);
    const S = (p) => [p[0] * view.s + view.x, p[1] * view.s + view.y];
    const accent = '#f5b82e';
    const lw = Math.max(1.5, Math.min(w, h) / 320);

    if (this.ref.length) {
      const pts = (this.ref.length === 4 ? orderConvex(this.ref) : this.ref).map(S);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      if (this.ref.length === 4) { ctx.closePath(); ctx.fillStyle = 'rgba(79,212,138,.18)'; ctx.fill(); }
      ctx.strokeStyle = '#4fd48a'; ctx.lineWidth = lw; ctx.stroke();
      (this.ref.length === 4 ? orderConvex(this.ref) : this.ref).forEach((p) => this.dot(ctx, S(p), '#4fd48a', lw, p.snapped));
      const dims = this.refDims();
      if (this.ref.length === 4 && dims && this.toPlane && $('refSelect').value !== 'line') {
        const big = Math.max(dims[0], dims[1]), small = Math.min(dims[0], dims[1]);
        const sideTxt = (i) => fmtLen((i % 2 === 0) === !!this.bigFirst ? big : small, unit, 1);
        const fs = Math.max(11, Math.min(w, h) / 34);
        for (let i = 0; i < 4; i++) {
          const a = pts[i], b = pts[(i + 1) % 4];
          if (dist(a, b) < 40) continue;
          this.label(ctx, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + fs * 1.2], sideTxt(i), fs, '#4fd48a');
        }
      }
    }

    for (const s of this.shapes) {
      const pts = s.pts.map(S);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      if (s.type === 'area' && s.done) { ctx.closePath(); ctx.fillStyle = 'rgba(245,184,46,.2)'; ctx.fill(); }
      ctx.strokeStyle = accent; ctx.lineWidth = lw; ctx.stroke();
      s.pts.forEach((p, i) => this.dot(ctx, pts[i], accent, lw, p.snapped));
      if (this.toPlane && s.labelText && pts.length) {
        let at;
        if (s.type === 'line' && pts.length === 2) at = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        else if (s.type === 'angle' && pts.length === 3) at = pts[1];
        else if (s.type === 'area') at = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
        if (at) this.label(ctx, at, s.labelText, Math.max(13, Math.min(w, h) / 26));
      }
    }
  },

  // Point : cercle + croix fine au centre exact ; plein = affiné automatiquement
  dot(ctx, p, color, lw, snapped) {
    const r = lw * 4;
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = snapped ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.25)'; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p[0] - r * 0.7, p[1]); ctx.lineTo(p[0] + r * 0.7, p[1]);
    ctx.moveTo(p[0], p[1] - r * 0.7); ctx.lineTo(p[0], p[1] + r * 0.7);
    ctx.lineWidth = 1; ctx.strokeStyle = snapped ? '#fff' : color; ctx.stroke();
  },

  label(ctx, [x, y], text, size, color = '#fff') {
    ctx.font = `600 ${size}px ui-monospace, Menlo, monospace`;
    const tw = ctx.measureText(text).width;
    const pad = size * 0.4;
    ctx.fillStyle = 'rgba(18,19,23,.88)';
    ctx.beginPath();
    ctx.roundRect(x - tw / 2 - pad, y - size * 1.9, tw + pad * 2, size * 1.4, size * 0.35);
    ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - size * 1.2);
  },

  // Loupe centrée sur le point (pas sur le doigt), en pixels réels de la photo
  showLoupe(ip) {
    const L = this.loupe, lc = L.getContext('2d');
    L.hidden = false;
    const sp = this.toScr(ip);
    L.classList.toggle('right', sp[0] < this.cw / 2 && sp[1] < 160);
    const zoom = Math.max(this.view.s * 4, 3);
    const size = L.width;
    const v = { s: zoom, x: size / 2 - ip[0] * zoom, y: size / 2 - ip[1] * zoom };
    this.draw(lc, 1, v, size, size);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.strokeStyle = '#ff3b30'; lc.lineWidth = 1;
    lc.beginPath();
    lc.moveTo(size / 2 + 0.5, 0); lc.lineTo(size / 2 + 0.5, size);
    lc.moveTo(0, size / 2 + 0.5); lc.lineTo(size, size / 2 + 0.5);
    lc.stroke();
  },

  save() {
    if (!this.toPlane) { toast('Placez d\'abord la référence'); return; }
    this.finishOpen();
    this.refresh();
    const rows = this.shapes.map((s) => this.measure(s)).filter(Boolean);
    if (!rows.length) { toast('Aucune mesure à enregistrer'); return; }
    const text = rows.map((r) => `${r.label} : ${r.short} ${r.tol}${r.extra ? ' · ' + r.extra : ''}`).join('\n');
    const tw = 480, s = tw / this.img.naturalWidth, th = Math.round(this.img.naturalHeight * s);
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    this.draw(c.getContext('2d'), 1, { s, x: 0, y: 0 }, tw, th);
    let img = null;
    try { img = c.toDataURL('image/jpeg', 0.72); } catch {}
    askSave('Photo', text, (note) => { History.add('Photo', text, note, img); this.saved = true; });
  },
};

/* ================================================================
   VISÉE — caméra + inclinaison + cap gyroscopique
   Hauteur (pied → sommet), Distance entre points au sol, Surface au sol depuis un seul point
   ================================================================ */

let lastArea = null; // dernière surface mesurée (m²), proposée dans le Plan
function setLastArea(m2, label) {
  if (!(m2 > 0)) return;
  lastArea = { m2, label };
  const b = $('addLast');
  if (b) { b.disabled = false; b.textContent = `Ajouter la dernière surface : ${fmtAreaBig(m2)} (${label})`; }
}

const Height = {
  mode: 'height',
  samples: [],      // {t, e, a} élévation et cap bruts de l'axe caméra (°)
  base: null,       // {e, sig}
  top: null,
  shots: [],        // points au sol : {e, a, sigE, sigA}
  pending: null,
  pendingSince: 0,
  stream: null,
  SENSOR_BIAS: 0.15, // incertitude résiduelle d'inclinaison (°)
  HEAD_BIAS: 0.3,    // dérive résiduelle du cap gyroscopique (°)

  init() {
    $('eyeH').value = num(store.get('eyeH', 1.5), 2);
    $('armOff').value = num(store.get('armOff', 0.3), 2);
    $('eyeH').addEventListener('input', () => { const v = pnum($('eyeH').value); if (this.eyeOk()) store.set('eyeH', v); this.render(); });
    $('armOff').addEventListener('input', () => { const v = pnum($('armOff').value); if (v >= 0 && v < 3) store.set('armOff', v); this.render(); });
    const sv = store.get('visee', null);
    if (sv) { this.mode = sv.mode || 'height'; this.base = sv.base || null; this.top = sv.top || null; this.shots = sv.shots || []; }
    document.querySelectorAll('[data-hmode]').forEach((x) => { x.classList.toggle('active', x.dataset.hmode === this.mode); x.setAttribute('aria-pressed', String(x.dataset.hmode === this.mode)); });
    $('knownD').addEventListener('input', () => this.render());
    $('camStart').addEventListener('click', () => this.start());
    $('markBtn').addEventListener('click', () => this.mark());
    document.querySelectorAll('[data-hmode]').forEach((b) => b.addEventListener('click', () => {
      this.mode = b.dataset.hmode;
      document.querySelectorAll('[data-hmode]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      this.pending = null;
      this.changed();
    }));
    $('shotUndo').addEventListener('click', () => {
      if (this.mode === 'height') { if (this.top) this.top = null; else this.base = null; }
      else this.shots.pop();
      this.changed();
    });
    armConfirm($('heightReset'), () => this.mode !== 'height' && this.shots.length > 1, () => {
      this.base = this.top = null; this.shots = []; this.pending = null; this.changed();
    });
    $('heightSave').addEventListener('click', () => this.save());
    Sensors.on((_, raw, t, cam) => this.onSample(cam, t));
  },

  eyeOk() { const v = pnum($('eyeH').value); return v > 0.2 && v < 50; },
  eye() { return (this.eyeOk() ? pnum($('eyeH').value) : store.get('eyeH', 1.5)) * 1000; },
  // Écart horizontal entre le pivot (vous, qui tournez sur vous-même) et l'objectif du téléphone
  arm() { const v = pnum($('armOff').value); return (v >= 0 && v < 3 ? v : 0.3) * 1000; },
  bigU() { return unit === 'in' || unit === 'ft' ? 'ft' : 'm'; },

  changed() {
    store.set('visee', { mode: this.mode, base: this.base, top: this.top, shots: this.shots });
    this.render();
  },
  knownDist() { const v = pnum($('knownD').value); return v > 0 ? v * 1000 : null; },

  // En surface au sol, les coins sont pris dans l'ordre du tour (cap croissant) quel que soit l'ordre de visée
  ordered() { return this.mode === 'floor' ? [...this.shots].sort((a, b) => a.a - b.a) : this.shots; },

  onSample(cam, t) {
    this.samples.push({ t, e: cam.elev, a: cam.head });
    while (this.samples.length && t - this.samples[0].t > 1500) this.samples.shift();
    const win = this.samples.filter((s) => t - s.t < 600);
    const E = win.map((s) => s.e);
    const [m, sd] = E.length > 2 ? meanStd(E) : [cam.elev, 1];
    let am = null, sdA = 0;
    if (cam.head != null && win.every((s) => s.a != null)) {
      const a0 = win[0].a;
      const D = win.map((s) => ((s.a - a0 + 540) % 360) - 180);
      const [dm, ds] = D.length > 2 ? meanStd(D) : [0, 1];
      am = (a0 + dm + 360) % 360; sdA = ds;
    }
    // Le cap ne sert qu'aux modes Distance et Surface : en Hauteur, seule l'inclinaison doit être stable
    const steady = E.length >= 8 && sd < 0.12 && (this.mode === 'height' || sdA < 0.3);
    if (!$('s-height').hidden) {
      $('hudAngle').textContent = num(m, 1);
      $('hudStable').textContent = steady ? '● stable' : '○ tenez immobile';
      $('hudStable').classList.toggle('ok', steady);
      $('hudFloor').textContent = m < -0.5 ? 'sol à ' + fmtLen(this.eye() / Math.tan(-m / DEG) + (this.mode === 'height' ? 0 : this.arm()), this.bigU()) : '';
    }
    if (!this.pending) return;
    const late = t - this.pendingSince > 5000;
    if (!(steady || (late && E.length >= 4))) return;
    const sigE = Math.hypot(sd / Math.sqrt(E.length), this.SENSOR_BIAS, late && !steady ? sd : 0);
    if (late && !steady) toast('Téléphone instable : précision réduite');
    if (this.pending === 'shot') {
      if (am == null) { toast('Cap gyroscopique indisponible sur cet appareil'); this.pending = null; this.render(); return; }
      if (m > -0.5) { toast('Visez un point du sol (vers le bas)'); this.pending = null; this.render(); return; }
      const r = this.eye() / Math.tan(-m / DEG);
      if (r / this.eye() > 12) toast('Point lointain : précision réduite. Rapprochez-vous ou tenez le téléphone plus haut.', 3500);
      this.shots.push({ e: m, a: am, sigE, sigA: Math.hypot(sdA / Math.sqrt(E.length), this.HEAD_BIAS) });
    } else {
      this[this.pending] = { e: m, sig: sigE };
    }
    this.pending = null;
    this.changed();
    if (this.mode === 'floor' && this.shots.length >= 3) { const r = this.result(); if (r) setLastArea(r.area / 1e6, 'Visée'); }
  },

  async start() {
    this.wanted = true;
    const ok = await Sensors.start();
    if (this.stream && this.stream.active) return;
    if (this.starting) return;
    this.starting = true;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if ($('s-height').hidden) { st.getTracks().forEach((t) => t.stop()); return; } // écran quitté entre-temps
      this.stream = st;
      $('camVideo').srcObject = this.stream;
      $('camStart').hidden = true;
    } catch {
      toast('Caméra indisponible : la visée fonctionne quand même avec le réticule.');
      if (ok) $('camStart').hidden = true;
    } finally { this.starting = false; }
  },

  stop() {
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; $('camStart').hidden = false; }
  },

  mark() {
    if (!this.samples.length) {
      if (!Sensors.started) Sensors.start().then((ok) => { if (ok) toast('Capteurs activés : visez puis touchez de nouveau'); });
      else toast('Aucune donnée des capteurs : ce navigateur ne les fournit pas');
      return;
    }
    if (!this.eyeOk()) { toast('Indiquez la hauteur de l\'objectif (entre 0,2 et 50 m)'); $('eyeH').focus(); return; }
    if (this.mode === 'height') {
      if (this.base && this.top) { this.base = this.top = null; this.changed(); return; }
      const target = this.base ? 'top' : 'base';
      const last = this.samples[this.samples.length - 1].e;
      if (target === 'base' && last > -1 && !this.knownDist()) { toast('Inclinez vers le bas pour viser la base'); return; }
      this.pending = target;
    } else this.pending = 'shot';
    this.pendingSince = performance.now();
    this.render();
  },

  /* --- Calculs --- */

  heightCalc(eb, et, h, known) {
    const tb = Math.tan(eb / DEG);
    const d = known != null ? known : h / -tb;
    if (!(d > 0) || !isFinite(d)) return null;
    return { d, h: et != null ? d * (Math.tan(et / DEG) - tb) : null };
  },

  // Position au sol de chaque point visé, depuis le pivot : écart pivot–objectif + distance au sol depuis l'objectif
  floorPts(shots, h, g, arm = this.arm()) {
    const out = [];
    for (const s of shots) {
      const e = s.e + (g ? g() * s.sigE : 0), a = s.a + (g ? g() * s.sigA : 0);
      if (e >= -0.05) return null;
      const r = arm + h / Math.tan(-e / DEG);
      out.push([r * Math.sin(a / DEG), r * Math.cos(a / DEG)]);
    }
    return out;
  },

  shotsCalc(P) {
    let chain = 0;
    for (let i = 1; i < P.length; i++) chain += dist(P[i - 1], P[i]);
    let area = 0;
    for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; area += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
    return { chain, area: Math.abs(area) / 2, per: P.length >= 3 ? chain + dist(P[P.length - 1], P[0]) : chain };
  },

  // Monte-Carlo : inclinaison, cap, hauteur de l'objectif (±2 cm), écart pivot–objectif (±8 cm) ; distance connue ±1 cm
  result() {
    const g = gaussFrom(rng(11)), h = this.eye();
    if (this.mode === 'height') {
      if (!this.base) return null;
      const known = this.knownDist();
      const r = this.heightCalc(this.base.e, this.top && this.top.e, h, known);
      if (!r) return null;
      const D = [], H = [];
      for (let i = 0; i < 400; i++) {
        const s = this.heightCalc(this.base.e + g() * this.base.sig, this.top && this.top.e + g() * this.top.sig,
          h + g() * 20, known != null ? known + g() * 10 : null);
        if (!s) continue;
        D.push(s.d); if (s.h != null) H.push(s.h);
      }
      r.dTol = D.length > 20 ? 2 * meanStd(D)[1] : Infinity;
      r.hTol = H.length > 20 ? 2 * meanStd(H)[1] : Infinity;
      return r;
    }
    if (this.shots.length < 2) return null;
    const shots = this.ordered();
    const P = this.floorPts(shots, h);
    if (!P) return null;
    const r = this.shotsCalc(P);
    const C = [], A = [], Pe = [];
    for (let i = 0; i < 400; i++) {
      const Q = this.floorPts(shots, h + g() * 20, g, Math.max(0, this.arm() + g() * 80));
      if (!Q) continue;
      const s = this.shotsCalc(Q);
      C.push(s.chain); A.push(s.area); Pe.push(s.per);
    }
    r.chainTol = 2 * meanStd(C)[1]; r.areaTol = 2 * meanStd(A)[1]; r.perTol = 2 * meanStd(Pe)[1];
    return r;
  },

  // Croquis vu de dessus : votre position, les points visés et les distances
  sketch() {
    const cv = $('shotSketch');
    const show = this.mode !== 'height' && this.shots.length > 0;
    cv.hidden = !show;
    if (!show) return;
    const P = this.floorPts(this.ordered(), this.eye());
    if (!P) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const all = [[0, 0], ...P];
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1000);
    const k = Math.min(r.width, r.height) * 0.78 / span;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const S = ([x, y]) => [r.width / 2 + (x - cx) * k, r.height / 2 - (y - cy) * k];
    const pts = P.map(S), me = S([0, 0]);
    const closed = this.mode === 'floor' && pts.length >= 3;
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(154,160,173,.6)'; ctx.lineWidth = 1;
    pts.forEach((p) => { ctx.beginPath(); ctx.moveTo(...me); ctx.lineTo(...p); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    if (closed) { ctx.closePath(); ctx.fillStyle = 'rgba(245,184,46,.18)'; ctx.fill(); }
    ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '600 11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const j = (i + 1) % pts.length, a = pts[i], b = pts[j];
      const t = fmtSide(dist(P[i], P[j]));
      ctx.fillStyle = 'rgba(18,19,23,.85)'; const tw = ctx.measureText(t).width + 8;
      ctx.fillRect((a[0] + b[0]) / 2 - tw / 2, (a[1] + b[1]) / 2 - 8, tw, 16);
      ctx.fillStyle = '#eef0f4'; ctx.fillText(t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); ctx.fillStyle = '#f5b82e'; ctx.fill();
      ctx.fillStyle = '#1a1405'; ctx.font = '700 11px -apple-system, sans-serif'; ctx.fillText(String.fromCharCode(65 + i), p[0], p[1] + 0.5);
    });
    ctx.beginPath(); ctx.arc(me[0], me[1], 6, 0, Math.PI * 2); ctx.fillStyle = '#2f8cff'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  },

  render() {
    const mode = this.mode;
    $('knownRow').hidden = mode !== 'height';
    $('armRow').hidden = mode === 'height';
    $('eyeH').classList.toggle('invalid', !this.eyeOk());
    this.sketch();
    const r = this.result();
    const set = (i, label, val, tol) => { $('hLabel' + i).textContent = label; $('hVal' + i).textContent = val; $('hTol' + i).textContent = tol || ''; };
    const tip = $('heightTip');
    tip.hidden = true;
    if (mode === 'height') {
      set(1, 'Distance', r ? fmtLen(r.d, unit, r.dTol) : '—', r && isFinite(r.dTol) ? fmtTol(r.dTol) : '');
      set(2, 'Hauteur', r && r.h != null ? fmtLen(r.h, unit, r.hTol) : '—', r && r.h != null && isFinite(r.hTol) ? fmtTol(r.hTol) : '');
      if (r && r.h != null && !this.knownDist() && r.hTol / r.h > 0.03) {
        tip.hidden = false;
        tip.textContent = 'Astuce précision : mesurez la distance au sol (au mètre ou avec « Distance ») et saisissez-la dans « Distance connue ».';
      }
    } else if (mode === 'dist') {
      const n = this.shots.length;
      set(1, n > 2 ? 'Cumul A→…' : 'Distance A–B', r ? fmtLen(r.chain, unit, r.chainTol) : '—', r ? fmtTol(r.chainTol) : '');
      set(2, 'Points visés', String(n), '');
    } else {
      const n = this.shots.length;
      const ok = r && n >= 3;
      set(1, 'Surface au sol', ok ? fmtAreaBig(r.area / 1e6) : '—', ok ? '± ' + fmtAreaBig(r.areaTol / 1e6) : `${n} coin${n > 1 ? 's' : ''} visé${n > 1 ? 's' : ''}`);
      set(2, 'Périmètre', ok ? fmtLen(r.per, this.bigU(), r.perTol) : '—', ok ? fmtTol(r.perTol, this.bigU()) : '');
    }
    if (mode !== 'height' && this.shots.length < 3) {
      tip.hidden = false;
      tip.textContent = mode === 'dist'
        ? 'Restez au même endroit et visez le pied de chaque point (bas d\'un mur, pied d\'une structure). Toise calcule la distance entre eux.'
        : 'Placez-vous au centre, sans bouger, et visez chaque coin du sol l\'un après l\'autre, dans l\'ordre du tour.';
    }
    const btn = $('markBtn');
    if (this.pending) { btn.textContent = 'Tenez immobile…'; $('heightHint').textContent = 'Capture dès que l\'image est stable'; return; }
    if (mode === 'height') {
      if (!this.base) { btn.textContent = 'Viser la base'; $('heightHint').textContent = 'Centrez le réticule sur le pied de l\'objet'; }
      else if (!this.top) { btn.textContent = 'Viser le sommet'; $('heightHint').textContent = 'Sans changer de place, montez jusqu\'au sommet (plafond, faîtage, structure)'; }
      else { btn.textContent = 'Nouvelle mesure'; $('heightHint').textContent = 'Mesure terminée'; }
    } else {
      const L = String.fromCharCode(65 + Math.min(this.shots.length, 25));
      btn.textContent = `Viser le point ${L}`;
      $('heightHint').textContent = mode === 'dist' ? 'Visez le pied du point, au sol' : 'Visez le coin au ras du sol';
    }
  },

  save() {
    const r = this.result();
    let text, kind;
    if (this.mode === 'height') {
      if (!r || r.h == null) { toast('Visez la base puis le sommet'); return; }
      text = `Hauteur : ${fmtLen(r.h, unit, r.hTol)} ${fmtTol(r.hTol)}\nDistance : ${fmtLen(r.d, unit, r.dTol)} ${fmtTol(r.dTol)}`;
      kind = 'Hauteur';
    } else if (this.mode === 'dist') {
      if (!r) { toast('Visez au moins 2 points'); return; }
      text = `Distance : ${fmtLen(r.chain, unit, r.chainTol)} ${fmtTol(r.chainTol)}\n${this.shots.length} points visés`;
      kind = 'Distance (visée)';
    } else {
      if (!r || this.shots.length < 3) { toast('Visez au moins 3 coins'); return; }
      text = `Surface : ${fmtAreaBig(r.area / 1e6)} ± ${fmtAreaBig(r.areaTol / 1e6)}\nPérimètre : ${fmtLen(r.per, this.bigU(), r.perTol)} ${fmtTol(r.perTol, this.bigU())}`;
      kind = 'Surface au sol (visée)';
    }
    askSave(kind, text, (note) => History.add(kind, text, note));
  },
};

/* ================================================================
   PLAN — surface d'un lieu par formes, volume et capacité
   ================================================================ */

const PIECES = {
  rect: { name: 'Rectangle', fields: ['Longueur', 'Largeur'], area: ([a, b]) => a * b },
  tri: { name: 'Triangle', fields: ['Base', 'Hauteur'], area: ([a, b]) => a * b / 2 },
  trap: { name: 'Trapèze', fields: ['Grand côté', 'Petit côté', 'Hauteur'], area: ([a, b, h]) => (a + b) / 2 * h },
  circle: { name: 'Cercle', fields: ['Diamètre'], area: ([d]) => Math.PI * d * d / 4 },
  half: { name: 'Demi-cercle', fields: ['Diamètre'], area: ([d]) => Math.PI * d * d / 8 },
  free: { name: 'Surface connue', fields: ['Surface (m²)'], area: ([s]) => s },
};

// m² par personne, valeurs usuelles d'organisation d'événements
const LAYOUTS = [
  ['Debout (concert, fosse)', 0.5],
  ['Cocktail, réception', 0.8],
  ['Bancs (culte, cérémonie)', 0.65],
  ['Théâtre (chaises en rangs)', 0.85],
  ['Banquet (tables rondes)', 1.3],
  ['Classe, conférence (tables)', 1.8],
];

const Plan = {
  data: store.get('plan', { name: '', pieces: [], ceil: '', reserve: 15 }),

  init() {
    $('planName').value = this.data.name || '';
    $('ceilH').value = this.data.ceil || '';
    $('reserve').value = this.data.reserve ?? 15;
    $('planName').addEventListener('input', () => { this.data.name = $('planName').value; this.save(); });
    $('ceilH').addEventListener('input', () => { this.data.ceil = $('ceilH').value; this.totals(); });
    $('reserve').addEventListener('input', () => { this.data.reserve = $('reserve').value; this.totals(); });
    $('addPiece').addEventListener('click', () => {
      const type = $('pieceType').value;
      this.data.pieces.push({ id: Date.now(), type, label: PIECES[type].name, vals: PIECES[type].fields.map(() => ''), qty: 1, sign: 1 });
      this.renderList();
      const inputs = $('pieces').lastElementChild?.querySelectorAll('.piece-fields input');
      if (inputs && inputs[0]) inputs[0].focus();
    });
    $('addLast').addEventListener('click', () => {
      if (!lastArea) return;
      this.data.pieces.push({ id: Date.now(), type: 'free', label: 'Mesure ' + lastArea.label, vals: [String(Math.round(lastArea.m2 * 100) / 100)], qty: 1, sign: 1 });
      this.renderList();
    });
    $('planCopy').addEventListener('click', () => copyText(this.summary()));
    $('planSave').addEventListener('click', () => {
      if (!this.area()) { toast('Ajoutez au moins une forme avec ses dimensions'); return; }
      const text = this.summary();
      askSave('Plan', text, (note) => History.add('Plan' + (this.data.name ? ' · ' + this.data.name : ''), text, note));
    });
    let armed = false;
    $('planReset').addEventListener('click', () => {
      if (!armed) { armed = true; $('planReset').textContent = 'Confirmer ?'; setTimeout(() => { armed = false; $('planReset').textContent = 'Nouveau plan'; }, 2500); return; }
      armed = false; $('planReset').textContent = 'Nouveau plan';
      this.data = { name: '', pieces: [], ceil: '', reserve: 15 };
      $('planName').value = ''; $('ceilH').value = ''; $('reserve').value = 15;
      this.renderList();
    });
    this.renderList();
  },

  save() { store.set('plan', this.data); },

  pieceArea(p) {
    const v = p.vals.map(pnum);
    if (v.some((x) => !(x > 0))) return null;
    return PIECES[p.type].area(v) * (parseFloat(p.qty) || 1) * p.sign;
  },

  area() { return this.data.pieces.reduce((s, p) => s + (this.pieceArea(p) || 0), 0); },

  // Volume : hauteur propre à chaque forme si saisie, sinon hauteur moyenne
  volume() {
    const def = pnum(this.data.ceil);
    let v = 0, partial = false;
    for (const p of this.data.pieces) {
      const a = this.pieceArea(p);
      if (a == null) continue;
      const h = pnum(p.h) > 0 ? pnum(p.h) : def;
      if (h > 0) v += a * h; else partial = true;
    }
    return { v, partial: partial && v > 0 };
  },

  renderList() {
    const ul = $('pieces');
    ul.textContent = '';
    this.data.pieces.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'piece' + (p.sign < 0 ? ' minus' : '');
      const head = document.createElement('div'); head.className = 'piece-head';
      const name = document.createElement('input'); name.type = 'text'; name.value = p.label; name.setAttribute('aria-label', 'Nom de la forme');
      name.id = 'pn' + p.id;
      name.addEventListener('input', () => { p.label = name.value; this.save(); });
      const out = document.createElement('b'); out.id = 'pa' + p.id;
      head.append(name, out);
      const fields = document.createElement('div'); fields.className = 'piece-fields';
      PIECES[p.type].fields.forEach((f, i) => {
        const lab = document.createElement('label');
        lab.textContent = f + (p.type === 'free' ? '' : ' (m)');
        const inp = document.createElement('input');
        inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = p.vals[i]; inp.placeholder = '0,00'; inp.id = `pv${p.id}_${i}`;
        inp.addEventListener('input', () => { p.vals[i] = inp.value; this.totals(); });
        lab.append(inp); fields.append(lab);
      });
      const hl = document.createElement('label');
      hl.textContent = 'Sous plafond (m)';
      const hi = document.createElement('input');
      hi.type = 'text'; hi.inputMode = 'decimal'; hi.value = p.h || ''; hi.placeholder = 'moyenne'; hi.id = `ph${p.id}`;
      hi.addEventListener('input', () => { p.h = hi.value; this.totals(); });
      hl.append(hi); fields.append(hl);
      const opts = document.createElement('div'); opts.className = 'piece-opts';
      const sign = document.createElement('button'); sign.className = 'btn small';
      sign.textContent = p.sign > 0 ? 'Ajoutée' : 'Retirée';
      sign.addEventListener('click', () => { p.sign = -p.sign; this.renderList(); });
      const qty = document.createElement('button'); qty.className = 'btn small';
      qty.textContent = '× ' + p.qty;
      qty.addEventListener('click', () => { p.qty = p.qty >= 8 ? 1 : p.qty + 1; this.renderList(); });
      const del = document.createElement('button'); del.className = 'btn small danger'; del.textContent = 'Supprimer';
      armConfirm(del, () => p.vals.some((v) => v !== ''), () => { this.data.pieces.splice(this.data.pieces.indexOf(p), 1); this.renderList(); });
      opts.append(sign, qty, del);
      li.append(head, fields, opts);
      ul.append(li);
    });
    this.totals();
  },

  totals() {
    this.save();
    for (const p of this.data.pieces) {
      const a = this.pieceArea(p);
      const el = $('pa' + p.id);
      if (el) el.textContent = a == null ? '—' : (a < 0 ? '− ' : '') + fmtAreaBig(Math.abs(a));
    }
    const A = this.area();
    $('planArea').textContent = fmtAreaBig(Math.max(0, A));
    const vol = this.volume();
    $('planVol').textContent = vol.v > 0 ? num(vol.v, vol.v < 100 ? 1 : 0) + ' m³' + (vol.partial ? ' (incomplet)' : '') : '—';
    const usable = Math.max(0, A) * (1 - clamp(pnum(this.data.reserve) || 0, 0, 90) / 100);
    const ul = $('capList');
    ul.textContent = '';
    for (const [name, m2pp] of LAYOUTS) {
      const li = document.createElement('li');
      const s = document.createElement('span'); s.textContent = name + ' ';
      const sm = document.createElement('small'); sm.textContent = `${num(m2pp, 2)} m²/pers.`;
      s.append(sm);
      const b = document.createElement('b'); b.textContent = usable > 0 ? '≈ ' + num(Math.floor(usable / m2pp), 0) + ' pers.' : '—';
      li.append(s, b); ul.append(li);
    }
  },

  summary() {
    const lines = [];
    if (this.data.name) lines.push(this.data.name);
    for (const p of this.data.pieces) {
      const a = this.pieceArea(p);
      if (a == null) continue;
      const dims = p.type === 'free' ? '' : ' (' + p.vals.join(' × ') + ' m)';
      lines.push(`${p.sign < 0 ? '− ' : '+ '}${p.label}${dims}${p.qty > 1 ? ' × ' + p.qty : ''} : ${fmtAreaBig(Math.abs(a))}`);
    }
    const A = this.area();
    lines.push(`Surface totale : ${fmtAreaBig(Math.max(0, A))}`);
    const vol = this.volume();
    if (vol.v > 0) lines.push(`Volume : ${num(vol.v, 0)} m³${vol.partial ? ' (incomplet)' : ''}`);
    return lines.join('\n');
  },
};

/* ================================================================
   NIVEAU — bulle 2D, chant, moyenne glissante, calibrage par retournement
   ================================================================ */

// Angle d'affichage de l'écran (0, 90, -90, 180) : iOS fait pivoter l'app même si le manifeste dit « portrait »
function screenAngle() {
  if (typeof window.orientation === 'number') return window.orientation;
  return (screen.orientation && screen.orientation.angle) || 0;
}

const Level = {
  mode: 'auto',
  current: 'surface',
  hold: false,
  // Calibrage et zéro propres à chaque mode, dans le repère de l'appareil
  zero: { surface: { x: 0, y: 0 }, edge: { e: 0 } },
  calib: (() => {
    const c = store.get('levelCalib2', null);
    return c && c.surface && c.edge ? c : { surface: { x: 0, y: 0 }, edge: { e: 0 } };
  })(),
  calibStep: 0,
  calibFirst: null,
  calibMode: null,
  buf: [],
  raw: null,
  reading: null,
  steady: false,
  sound: false,
  audio: null,

  init() {
    document.querySelectorAll('[data-lmode]').forEach((b) => b.addEventListener('click', () => {
      this.mode = b.dataset.lmode;
      document.querySelectorAll('[data-lmode]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      this.cancelCalib();
    }));
    $('sensorBtn').addEventListener('click', async () => { if (await Sensors.start()) $('sensorBtn').hidden = true; });
    $('holdBtn').addEventListener('click', () => {
      this.hold = !this.hold;
      $('holdBtn').classList.toggle('on', this.hold);
      $('holdBtn').setAttribute('aria-pressed', String(this.hold));
      $('holdBtn').textContent = this.hold ? 'Figé' : 'Figer';
      this.beep(false);
    });
    $('zeroBtn').addEventListener('click', () => {
      if (!this.raw) return;
      const m = this.current, z = this.zero[m];
      if (m === 'surface' ? (z.x || z.y) : z.e) {
        this.zero[m] = m === 'surface' ? { x: 0, y: 0 } : { e: 0 };
        toast('Zéro absolu');
      } else {
        const c = this.calib[m], r = this.raw;
        this.zero[m] = m === 'surface' ? { x: r.x - c.x, y: r.y - c.y } : { e: r.e - c.e };
        toast('Zéro relatif défini : mesurez un angle par rapport à cette surface');
      }
      this.paintZero();
    });
    $('calibBtn').addEventListener('click', () => this.calibrate());
    $('soundBtn').addEventListener('click', () => {
      this.sound = !this.sound;
      $('soundBtn').textContent = 'Son : ' + (this.sound ? 'oui' : 'non');
      $('soundBtn').classList.toggle('on', this.sound);
      $('soundBtn').setAttribute('aria-pressed', String(this.sound));
      if (this.sound) {
        this.initAudio();
        toast('Bip continu quand c\'est de niveau. Rien entendu ? Désactivez le mode silencieux.', 3500);
      } else this.beep(false);
    });
    // iOS suspend le son après un appel, Siri ou l'arrière-plan : on le relance au geste suivant
    document.addEventListener('pointerdown', () => {
      if (this.audio && this.sound && this.audio.ac.state !== 'running') this.audio.ac.resume().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.beep(false); });
    $('levelSave').addEventListener('click', () => {
      if (!this.reading) { toast('Activez les capteurs'); return; }
      const text = $('levelMain').textContent + '\n' + $('levelSub').textContent;
      askSave('Niveau', text, (note) => History.add(this.current === 'surface' ? 'Niveau (surface)' : 'Niveau (chant)', text, note));
    });
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') {
      Sensors.start().then((ok) => { if (ok) $('sensorBtn').hidden = true; });
    }
    Sensors.on((u, raw) => this.update(u, raw));
    this.paintCalib();
  },

  paintZero() {
    const z = this.zero[this.current];
    const on = this.current === 'surface' ? !!(z.x || z.y) : !!z.e;
    $('zeroBtn').classList.toggle('on', on);
    $('zeroBtn').setAttribute('aria-pressed', String(on));
  },

  paintCalib() {
    const s = this.calib.surface, e = this.calib.edge;
    if (s.x || s.y || e.e) {
      $('calibNote').textContent = `Calibré · surface : X ${fmtDeg(s.x, 2)}, Y ${fmtDeg(s.y, 2)} · chant : ${fmtDeg(e.e, 2)}. Chaque mode se calibre séparément.`;
    }
  },

  initAudio() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    if (!this.audio) {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator(), gain = ac.createGain();
        osc.frequency.value = 880; gain.gain.value = 0;
        osc.connect(gain).connect(ac.destination); osc.start();
        this.audio = { ac, gain };
      } catch { return; }
    }
    this.audio.ac.resume().catch(() => {});
  },

  beep(on) {
    if (!this.audio) return;
    this.audio.gain.gain.setTargetAtTime(this.sound && on ? 0.08 : 0, this.audio.ac.currentTime, 0.02);
  },

  cancelCalib() {
    if (!this.calibStep) return;
    this.calibStep = 0;
    $('calibBtn').textContent = 'Calibrer';
    $('calibBtn').classList.remove('on');
    $('calibNote').textContent = 'Calibrage annulé (changement de mode).';
  },

  // Calibrage par retournement : la moyenne des deux lectures à 180° d'écart est le défaut du capteur.
  // Seules les composantes du mode courant sont calibrées.
  calibrate() {
    if (!this.raw) { toast('Activez les capteurs'); return; }
    if (!this.steady) { toast('Posez le téléphone et attendez « stable »'); return; }
    const m = this.current;
    if (this.calibStep === 0) {
      this.calibFirst = { ...this.raw };
      this.calibMode = m;
      this.calibStep = 1;
      $('calibBtn').textContent = 'Étape 2';
      $('calibBtn').classList.add('on');
      $('calibNote').textContent = m === 'surface'
        ? 'Tournez le téléphone de 180° à plat, exactement au même endroit, attendez « stable », puis touchez « Étape 2 ».'
        : 'Retournez le téléphone bout pour bout (180°) sur le même chant, attendez « stable », puis touchez « Étape 2 ».';
      return;
    }
    if (m !== this.calibMode) { this.cancelCalib(); return; }
    const a = this.calibFirst, b = this.raw;
    if (m === 'surface') this.calib.surface = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    else this.calib.edge = { e: (a.e + b.e) / 2 };
    store.set('levelCalib2', this.calib);
    this.calibStep = 0;
    $('calibBtn').textContent = 'Calibrer';
    $('calibBtn').classList.remove('on');
    this.paintCalib();
    toast(m === 'surface' ? 'Calibrage de la surface enregistré' : 'Calibrage du chant enregistré');
  },

  update(_, rawUp) {
    const [ux, uy, uz] = rawUp;
    const roll = Math.atan2(ux, uy) * DEG;
    const now = { x: Math.atan2(ux, uz) * DEG, y: Math.atan2(uy, uz) * DEG, e: roll - 90 * Math.round(roll / 90), uz };
    const surfaceNow = this.current === 'surface';
    // Moyenne glissante ~0,5 s ; on repart de zéro seulement si l'appareil bouge franchement
    // (sur les seules composantes utiles au mode : à plat, l'angle de chant n'a pas de sens et varie beaucoup)
    const last = this.buf[this.buf.length - 1];
    if (last && (surfaceNow ? Math.max(Math.abs(last.x - now.x), Math.abs(last.y - now.y)) : Math.abs(last.e - now.e)) > 1.5) this.buf = [];
    this.buf.push(now);
    if (this.buf.length > 30) this.buf.shift();
    const avg = (k) => this.buf.reduce((s, v) => s + v[k], 0) / this.buf.length;
    this.raw = { x: avg('x'), y: avg('y'), e: avg('e') };
    const sd = surfaceNow
      ? Math.max(meanStd(this.buf.map((v) => v.x))[1], meanStd(this.buf.map((v) => v.y))[1])
      : meanStd(this.buf.map((v) => v.e))[1];
    if (this.hold || $('s-level').hidden) { this.beep(false); return; }

    const auz = Math.abs(avg('uz'));
    const prev = this.current;
    if (this.mode === 'auto') {
      if (this.current === 'surface' && auz < 0.7) this.current = 'edge';
      else if (this.current === 'edge' && auz > 0.8) this.current = 'surface';
    } else this.current = this.mode;
    if (prev !== this.current) { this.buf = [now]; this.cancelCalib(); this.paintZero(); }

    const surface = this.current === 'surface';
    this.steady = this.buf.length >= 15 && sd < 0.06;
    const dg = this.steady ? 2 : 1;
    $('levelSurface').hidden = !surface;
    $('levelEdge').hidden = surface;
    $('levelStable').textContent = this.steady ? '● stable' : '○ en mouvement';
    $('levelStable').classList.toggle('ok', this.steady);

    let dev;
    if (surface) {
      const c = this.calib.surface, z = this.zero.surface;
      const ax = this.raw.x - c.x - z.x, ay = this.raw.y - c.y - z.y;   // repère de l'appareil
      // Inclinaison exacte : tan²(X) + tan²(Y) = tan²(inclinaison)
      const tilt = Math.atan(Math.hypot(Math.tan(ax / DEG), Math.tan(ay / DEG))) * DEG;
      // Repère de l'écran (l'app peut être affichée en paysage)
      const th = screenAngle() / DEG;
      const x = ax * Math.cos(th) - ay * Math.sin(th), y = ax * Math.sin(th) + ay * Math.cos(th);
      this.reading = { x, y, tilt };
      dev = tilt;
      const R = $('levelSurface').clientWidth / 2;
      const r = Math.hypot(x, y), k = Math.min(1, r / 10) / (r || 1) * R * 0.78;
      $('bubble').style.transform = `translate(calc(-50% + ${x * k}px), calc(-50% + ${-y * k}px))`;
      $('levelMain').textContent = fmtDeg(tilt, dg);
      $('levelSub').textContent = `X ${fmtDeg(x, dg)} · Y ${fmtDeg(y, dg)} · ${num(Math.tan(tilt / DEG) * 1000, 1)} mm/m`;
    } else {
      const ed = this.raw.e - this.calib.edge.e - this.zero.edge.e;
      this.reading = { e: ed };
      dev = Math.abs(ed);
      $('horizon').style.transform = `rotate(${ed}deg)`;
      $('levelMain').textContent = fmtDeg(Math.abs(ed), dg);
      $('levelSub').textContent = `pente ${num(Math.tan(Math.abs(ed) / DEG) * 100, 2)} % · ${num(Math.tan(Math.abs(ed) / DEG) * 1000, 1)} mm/m`;
    }
    const level = dev < 0.1;
    $('levelBox').classList.toggle('is-level', level);
    this.beep(level);
  },
};

/* ================================================================
   RÈGLE — à l'échelle réelle selon le modèle d'iPhone
   ================================================================ */

// Points CSS par pouce (ppi physique ÷ facteur d'échelle), clé : largeur×hauteur CSS.
// Estimation seulement : 375×812 couvre X/XS/11 Pro (152,7) mais aussi 12/13 mini (165,3), et le « Zoom de
// l'affichage » change la taille logique. La règle invite donc toujours à se calibrer.
const IPHONE_PPI = {
  '320x568': 163, '375x667': 163, '414x736': 153.7, '375x812': 152.7, '360x780': 158.7,
  '414x896@2': 163, '414x896@3': 152.7, '390x844': 153.3, '428x926': 152.7, '393x852': 153.3,
  '430x932': 153.3, '402x874': 153.3, '440x956': 153.3, '420x912': 153.3,
};

function guessPpi() {
  const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
  const dpr = Math.round(window.devicePixelRatio || 1);
  return IPHONE_PPI[`${w}x${h}@${dpr}`] || IPHONE_PPI[`${w}x${h}`] || (w < 500 ? 160 : 96);
}

const Ruler = {
  ppi: store.get('ppi', null) || guessPpi(),
  calibrated: !!store.get('ppi', null),
  a: 0, b: 0,
  calibrating: false,

  get pxmm() { return this.ppi / 25.4; },

  init() {
    this.canvas = $('rulerCanvas');
    new ResizeObserver(() => this.resize()).observe($('rulerBox'));
    this.a = 10 * this.pxmm;   // curseurs sur 1 cm et 6 cm : rien n'est coupé en haut de l'écran
    this.b = 60 * this.pxmm;
    for (const [id, key] of [['curA', 'a'], ['curB', 'b']]) {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        // Déplacement démultiplié après le premier mouvement franc : réglage au dixième de mm
        const y0 = e.clientY, v0 = this[key];
        const mv = (ev) => {
          const dy = ev.clientY - y0, ady = Math.abs(dy);
          const eff = ady < 40 ? ady * 0.25 : 10 + (ady - 40);
          this[key] = clamp(v0 + Math.sign(dy) * eff, 0, this.h); this.place();
        };
        const upf = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', upf); };
        el.addEventListener('pointermove', mv);
        el.addEventListener('pointerup', upf);
      });
    }
    $('calibRuler').addEventListener('click', () => {
      this.calibrating = !this.calibrating;
      $('rulerCalib').hidden = !this.calibrating;
      $('rulerSlider').value = this.ppi;
      this.draw();
    });
    const setPpi = (v) => { this.ppi = clamp(v, 100, 220); $('rulerSlider').value = this.ppi; this.draw(); this.place(); };
    $('rulerSlider').addEventListener('input', () => setPpi(parseFloat($('rulerSlider').value)));
    $('ppiMinus').addEventListener('click', () => setPpi(this.ppi - 0.1));
    $('ppiPlus').addEventListener('click', () => setPpi(this.ppi + 0.1));
    $('calibDone').addEventListener('click', () => {
      store.set('ppi', this.ppi); this.calibrated = true;
      this.calibrating = false; $('rulerCalib').hidden = true; this.draw(); this.place();
      toast('Règle calibrée');
    });
    $('rulerSave').addEventListener('click', () => {
      const text = fmtLen(Math.abs(this.b - this.a) / this.pxmm, 'mm', 0.5);
      askSave('Règle', text, (note) => History.add('Règle', text, note));
    });
  },

  resize() {
    const r = $('rulerBox').getBoundingClientRect();
    if (!r.height) return;
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
    this.draw(); this.place();
  },

  place() {
    $('curA').style.top = this.a + 'px';
    $('curB').style.top = this.b + 'px';
    const mm = Math.abs(this.b - this.a) / this.pxmm;
    $('rulerVal').textContent = unit === 'in' || unit === 'ft' ? fmtLen(mm, 'in', 0.1) : num(mm, 1) + ' mm';
    $('rulerPpi').textContent = this.calibrated ? `calibrée · ${num(this.ppi, 1)} pt/po` : 'non calibrée (jusqu\'à ± 10 %)';
    $('rulerPpi').classList.toggle('warn', !this.calibrated);
    $('calibRuler').classList.toggle('primary', !this.calibrated);
  },

  draw() {
    if (!this.canvas || !this.w) return;
    const ctx = this.canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.strokeStyle = '#1b1b1b'; ctx.fillStyle = '#1b1b1b';
    ctx.lineWidth = 1;
    ctx.font = '600 13px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const pm = this.pxmm;
    for (let mm = 0; mm * pm <= this.h; mm++) {
      const y = Math.round(mm * pm * dpr) / dpr + 0.5 / dpr;
      const len = mm % 10 === 0 ? 26 : mm % 5 === 0 ? 17 : 10;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
      if (mm % 10 === 0 && mm > 0) ctx.fillText(String(mm / 10), 30, y);
    }
    const pi = this.ppi;
    ctx.textAlign = 'right';
    for (let s = 0; s * pi / 16 <= this.h; s++) {
      const y = Math.round(s * pi / 16 * dpr) / dpr + 0.5 / dpr;
      const len = s % 16 === 0 ? 26 : s % 8 === 0 ? 20 : s % 4 === 0 ? 15 : s % 2 === 0 ? 10 : 6;
      ctx.beginPath(); ctx.moveTo(this.w, y); ctx.lineTo(this.w - len, y); ctx.stroke();
      if (s % 16 === 0 && s > 0) ctx.fillText(String(s / 16), this.w - 30, y);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b5a2a';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('cm', 30, 10);
    ctx.textAlign = 'right'; ctx.fillText('in', this.w - 30, 10);
    if (this.calibrating) {
      const y0 = 20, y1 = y0 + 85.6 * pm;
      ctx.fillStyle = 'rgba(210,48,31,.12)';
      ctx.fillRect(60, y0, this.w - 120, y1 - y0);
      ctx.strokeStyle = '#d2301f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, y0); ctx.lineTo(this.w - 40, y0); ctx.moveTo(40, y1); ctx.lineTo(this.w - 40, y1); ctx.stroke();
    }
  },
};

/* ================================================================
   CARTE — fond satellite / plan en tuiles, sans bibliothèque externe
   ================================================================ */

const TILE = 256;
const BASEMAPS = {
  sat: { url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    max: 19, floorSig: 0.4, attr: 'Imagerie © Esri, Maxar, Earthstar Geographics' },
  plan: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    max: 19, floorSig: 1, attr: '© contributeurs OpenStreetMap' },
};

class GeoMap {
  constructor(wrap, o) {
    this.wrap = wrap;
    this.o = o;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.canvas.setAttribute('aria-label', 'Carte : touchez pour poser un point');
    wrap.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.center = o.center; this.zoom = o.zoom; this.base = o.base || 'sat';
    this.tiles = new Map();
    this.pointers = new Map();
    this.loaded = 0; this.errors = 0;
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e));
    c.addEventListener('wheel', (e) => { e.preventDefault(); const p = this.pos(e); this.zoomAround(p, this.zoom - e.deltaY * 0.003); }, { passive: false });
    new ResizeObserver(() => this.resize()).observe(wrap);
    this.resize();
  }

  static world(lat, lon, z) {
    const s = TILE * 2 ** z, sl = Math.sin(clamp(lat, -85.05, 85.05) / DEG);
    return [(lon + 180) / 360 * s, (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * s];
  }

  static unworld(x, y, z) {
    const s = TILE * 2 ** z, n = Math.PI - 2 * Math.PI * y / s;
    return [Math.atan(Math.sinh(n)) * DEG, x / s * 360 - 180];
  }

  resize() {
    const r = this.wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.draw();
  }

  pos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  toScreen([lat, lon]) {
    const [x, y] = GeoMap.world(lat, lon, this.zoom), [cx, cy] = GeoMap.world(...this.center, this.zoom);
    return [x - cx + this.w / 2, y - cy + this.h / 2];
  }

  toLatLon([sx, sy]) {
    const [cx, cy] = GeoMap.world(...this.center, this.zoom);
    return GeoMap.unworld(cx + sx - this.w / 2, cy + sy - this.h / 2, this.zoom);
  }

  // Mètres par point d'écran (et à la résolution native de l'imagerie)
  mpp(lat = this.center[0], z = this.zoom) { return 156543.03392 * Math.cos(lat / DEG) / 2 ** z; }

  changed() { this.request(); this.o.onChange && this.o.onChange(); }

  setView(center, zoom = this.zoom) { this.center = center; this.zoom = clamp(zoom, 2, 22); this.changed(); }

  // Garde le point géographique sous « p » fixe pendant le zoom
  zoomAround(p, z, ll = this.toLatLon(p)) {
    this.zoom = clamp(z, 2, 22);
    const [wx, wy] = GeoMap.world(...ll, this.zoom);
    this.center = GeoMap.unworld(wx - (p[0] - this.w / 2), wy - (p[1] - this.h / 2), this.zoom);
    this.changed();
  }

  panBy(dx, dy) {
    const [cx, cy] = GeoMap.world(...this.center, this.zoom);
    this.center = GeoMap.unworld(cx - dx, cy - dy, this.zoom);
    this.changed();
  }

  setBase(b) { this.base = b; this.loaded = 0; this.errors = 0; this.request(); }

  request() {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }

  tile(z, x, y, create = true) {
    const n = 2 ** z;
    if (y < 0 || y >= n) return null;
    x = ((x % n) + n) % n;
    const key = `${this.base}/${z}/${x}/${y}`;
    let t = this.tiles.get(key);
    if (t && t.err && create && Date.now() - t.errAt > 8000) { this.tiles.delete(key); t = null; } // nouvel essai
    if (t) { this.tiles.delete(key); this.tiles.set(key, t); return t; }
    if (!create) return null;
    t = { img: new Image(), ok: false };
    t.img.decoding = 'async';
    t.img.onload = () => { t.ok = true; this.loaded++; this.request(); this.o.onTiles && this.o.onTiles(this); };
    t.img.onerror = () => { t.err = true; t.errAt = Date.now(); this.errors++; this.o.onTiles && this.o.onTiles(this); setTimeout(() => this.request(), 8500); };
    t.img.src = BASEMAPS[this.base].url(z, x, y);
    this.tiles.set(key, t);
    if (this.tiles.size > 500) this.tiles.delete(this.tiles.keys().next().value);
    return t;
  }

  draw() {
    if (!this.w) return;
    const ctx = this.ctx, w = this.w, h = this.h;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#23262d';
    ctx.fillRect(0, 0, w, h);
    const B = BASEMAPS[this.base];
    const tz = clamp(Math.round(this.zoom), 0, B.max);
    const scale = 2 ** (this.zoom - tz), ts = TILE * scale;
    const [cx, cy] = GeoMap.world(...this.center, tz);
    const x0 = cx - w / 2 / scale, y0 = cy - h / 2 / scale;
    const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
    const tx1 = Math.floor((x0 + w / scale) / TILE), ty1 = Math.floor((y0 + h / scale) / TILE);
    ctx.imageSmoothingEnabled = true;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const sx = (tx * TILE - x0) * scale, sy = (ty * TILE - y0) * scale;
      const t = this.tile(tz, tx, ty);
      if (!t) continue;
      if (t.ok) { ctx.drawImage(t.img, sx, sy, ts + 0.6, ts + 0.6); continue; }
      // En attendant la tuile : agrandir une tuile parente déjà chargée
      let drawn = false;
      for (let k = 1; k <= 5 && tz - k >= 0 && !drawn; k++) {
        const f = 2 ** k, p = this.tile(tz - k, Math.floor(tx / f), Math.floor(ty / f), false);
        if (p && p.ok) {
          const sub = TILE / f, n = 2 ** tz;
          const ux = ((tx % n) + n) % n;
          ctx.drawImage(p.img, (ux % f) * sub, (ty % f) * sub, sub, sub, sx, sy, ts + 0.6, ts + 0.6);
          drawn = true;
        }
      }
      if (!drawn) { ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.strokeRect(sx + 0.5, sy + 0.5, ts, ts); }
    }
    if (this.o.onDraw) this.o.onDraw(ctx, this);
    // Attribution et échelle
    ctx.font = '10px -apple-system, sans-serif';
    const attr = B.attr;
    const aw = ctx.measureText(attr).width + 8;
    ctx.fillStyle = 'rgba(18,19,23,.7)'; ctx.fillRect(w - aw, h - 16, aw, 16);
    ctx.fillStyle = '#ddd'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(attr, w - 4, h - 8);
    this.drawScale(ctx, h);
  }

  drawScale(ctx, h) {
    const mpp = this.mpp();
    const target = 90 * mpp;
    const pow = 10 ** Math.floor(Math.log10(target));
    const nice = [1, 2, 5, 10].map((k) => k * pow).filter((v) => v <= target).pop() || pow;
    const px = nice / mpp;
    const x = 10, y = h - 26;
    ctx.fillStyle = 'rgba(18,19,23,.7)'; ctx.fillRect(x - 4, y - 14, px + 8, 20);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '600 11px ui-monospace, Menlo, monospace';
    ctx.fillText(nice >= 1000 ? num(nice / 1000, 0) + ' km' : num(nice, nice < 1 ? 1 : 0) + ' m', x + 3, y - 4);
  }

  /* --- Gestes : 1 doigt = déplacer la carte ou un point, toucher = poser, 2 doigts = zoom --- */

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      if (this.g && this.g.type === 'point' && this.o.onPointEnd) this.o.onPointEnd(this.g.hit, true);
      const [a, b] = [...this.pointers.values()];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.g = { type: 'pinch', d0: dist(a, b) || 1, z0: this.zoom, ll: this.toLatLon(m) };
      return;
    }
    if (this.pointers.size > 2) return;
    const hit = this.o.hitTest ? this.o.hitTest(p) : null;
    this.g = hit
      ? { type: 'point', hit, start: p, origin: this.o.onPointStart(hit), moved: false, t: performance.now() }
      : { type: 'pan', start: p, last: p, moved: false, t: performance.now() };
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    const g = this.g;
    if (!g) return;
    if (g.type === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.zoomAround(m, g.z0 + Math.log2(dist(a, b) / g.d0), g.ll);
      return;
    }
    if (dist(p, g.start) > 6) g.moved = true;
    if (g.type === 'pan') { this.panBy(p[0] - g.last[0], p[1] - g.last[1]); g.last = p; return; }
    if (g.type === 'point' && g.moved) {
      // Glissement démultiplié ×0,5 : le doigt ne cache pas le point
      const s = [g.origin[0] + (p[0] - g.start[0]) * 0.5, g.origin[1] + (p[1] - g.start[1]) * 0.5];
      this.o.onPointMove(g.hit, this.toLatLon(s));
      this.request();
    }
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    const g = this.g;
    if (!g) return;
    if (g.type === 'pinch') { if (!this.pointers.size) this.g = null; else this.g = { type: 'none' }; return; }
    if (this.pointers.size) return;
    this.g = null;
    const quick = performance.now() - g.t < 600;
    if (g.type === 'pan' && !g.moved && quick && this.o.onTap) this.o.onTap(this.toLatLon(p), p);
    if (g.type === 'point') this.o.onPointEnd(g.hit, g.moved);
  }
}

/* ================================================================
   TERRAIN — très grandes surfaces : carte satellite et/ou GPS
   ================================================================ */

const WGS_A = 6378137, WGS_E2 = 0.00669437999014;
// Rayons de courbure méridien (M) et transverse (N) à la latitude φ
function curv(lat) {
  const s2 = Math.sin(lat / DEG) ** 2, w = Math.sqrt(1 - WGS_E2 * s2);
  return { M: WGS_A * (1 - WGS_E2) / (w * w * w), N: WGS_A / w };
}
// Aire (m²) : projection sinusoïdale ellipsoïdale centrée sur le polygone (équivalente), puis formule du lacet
function geoArea(pts) {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length, lon0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const { M } = curv(lat0);
  const P = pts.map(([la, lo]) => [curv(la).N * Math.cos(la / DEG) * (lo - lon0) / DEG, M * (la - lat0) / DEG]);
  let a = 0;
  for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
  return Math.abs(a) / 2;
}
// Distance (m) avec les rayons de courbure à mi-chemin
function geoDist(p1, p2) {
  const lat = (p1[0] + p2[0]) / 2, { M, N } = curv(lat);
  let dLon = p2[1] - p1[1];
  if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
  return Math.hypot(N * Math.cos(lat / DEG) * dLon / DEG, M * (p2[0] - p1[0]) / DEG);
}
function geoLen(pts, closed) {
  let s = 0;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) s += geoDist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

const mkPt = (lat, lon, sig, src) => { const p = [lat, lon]; p.sig = sig; p.src = src; return p; };

const Terrain = {
  map: null,
  pts: store.get('terrainPts', []).map((q) => mkPt(q[0], q[1], q[2], q[3])),
  mode: store.get('terrainMode', 'area'),
  base: store.get('terrainBase', 'sat'),
  sel: null,
  watchId: null,
  fix: null,
  auto: false,
  collecting: null,

  init() {
    document.querySelectorAll('[data-tmode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tmode === this.mode);
      b.addEventListener('click', () => {
        this.mode = b.dataset.tmode; store.set('terrainMode', this.mode);
        document.querySelectorAll('[data-tmode]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        this.changed();
      });
    });
    $('tLayer').textContent = this.base === 'sat' ? 'Vue plan' : 'Vue satellite';
    $('gpsPoint').addEventListener('click', () => this.gpsPoint());
    $('gpsAuto').addEventListener('click', () => this.toggleAuto());
    $('tUndo').addEventListener('click', () => {
      if (this.sel != null) { this.pts.splice(this.sel, 1); this.sel = null; } else this.pts.pop();
      this.changed();
    });
    let clr = false;
    $('tClear').addEventListener('click', () => {
      if (!clr && this.pts.length) { clr = true; $('tClear').textContent = 'Confirmer ?'; setTimeout(() => { clr = false; $('tClear').textContent = 'Effacer'; }, 2500); return; }
      clr = false; $('tClear').textContent = 'Effacer';
      this.pts = []; this.sel = null; this.changed();
    });
    $('tLayer').addEventListener('click', () => {
      this.base = this.base === 'sat' ? 'plan' : 'sat';
      store.set('terrainBase', this.base);
      $('tLayer').textContent = this.base === 'sat' ? 'Vue plan' : 'Vue satellite';
      if (this.map) this.map.setBase(this.base);
      this.changed();
    });
    $('mapZoomIn').addEventListener('click', () => this.map && this.map.zoomAround([this.map.w / 2, this.map.h / 2], Math.round(this.map.zoom) + 1));
    $('mapZoomOut').addEventListener('click', () => this.map && this.map.zoomAround([this.map.w / 2, this.map.h / 2], Math.round(this.map.zoom) - 1));
    $('mapLocate').addEventListener('click', () => {
      this.startWatch(true);
      if (this.fix && this.map) this.map.setView([this.fix.lat, this.fix.lon], Math.max(this.map.zoom, 18));
      else toast('Recherche de votre position…');
    });
    $('mapFit').addEventListener('click', () => this.fit());
    $('tCopy').addEventListener('click', () => {
      if (!this.pts.length) { toast('Aucun point'); return; }
      copyText(this.pts.map((p, i) => `${i + 1}\t${p[0].toFixed(7)}\t${p[1].toFixed(7)}\t± ${num(2 * p.sig, 1)} m`).join('\n'));
    });
    $('tSave').addEventListener('click', () => {
      const r = this.result();
      if (!r) { toast(this.mode === 'area' ? 'Placez au moins 3 points' : 'Placez au moins 2 points'); return; }
      const text = this.mode === 'area'
        ? `Surface : ${r.areaText} ${r.areaTol}\nPérimètre : ${fmtLen(r.per, Height.bigU(), r.perTolMm)} ${fmtTol(r.perTolMm, Height.bigU())}\n${this.pts.length} sommets`
        : `Distance : ${fmtLen(r.len, Height.bigU(), r.lenTolMm)} ${fmtTol(r.lenTolMm, Height.bigU())}\n${this.pts.length} points`;
      askSave('Terrain', text, (note) => History.add('Terrain', text, note));
    });
  },

  open() {
    if (this.map) { this.map.resize(); if (!this.denied) this.startWatch(false); return; }
    const view = store.get('mapView', null);
    const first = this.pts[0];
    this.map = new GeoMap($('mapWrap'), {
      center: view ? view.c : first ? [first[0], first[1]] : [46.6, 2.4],
      zoom: view ? view.z : first ? 17 : 5,
      base: this.base,
      onTap: (ll) => this.tap(ll),
      hitTest: (p) => this.hit(p),
      onPointStart: (h) => this.pointStart(h),
      onPointMove: (h, ll) => this.pointMove(h, ll),
      onPointEnd: (h, moved) => this.pointEnd(h, moved),
      onDraw: (ctx, m) => this.drawOverlay(ctx, m),
      onChange: () => store.set('mapView', { c: this.map.center, z: this.map.zoom }),
      onTiles: (m) => {
        const bad = m.errors > 6 && m.loaded === 0;
        $('mapMsg').hidden = !bad;
        if (bad) $('mapMsg').textContent = 'Fond de carte indisponible (pas de connexion ?). Le GPS et les calculs fonctionnent : ajoutez un point GPS à chaque coin.';
      },
    });
    $('mapMsg').hidden = true;
    this.startWatch(!view && !first);
    this.changed(false);
  },

  // Incertitude d'un point posé à la main : 1,5 point d'écran, et jamais mieux que la précision du fond de carte
  tapSigma(lat) {
    return Math.max(this.map.mpp(lat) * 1.5, BASEMAPS[this.base].floorSig);
  },

  tap(ll) {
    if (this.sel != null) { this.sel = null; this.changed(false); return; }
    this.pts.push(mkPt(ll[0], ll[1], this.tapSigma(ll[0]), 'carte'));
    this.changed();
  },

  // Sommets, puis étiquettes des côtés (poignées « + » : insérer un point)
  hit(p) {
    const m = this.map;
    let best = null, bd = 24;
    this.pts.forEach((q, i) => { const d = dist(m.toScreen(q), p); if (d < bd) { bd = d; best = { type: 'v', i }; } });
    if (best) return best;
    for (const L of this.labels || []) {
      if (p[0] >= L.x - 4 && p[0] <= L.x + L.w + 4 && p[1] >= L.y - 6 && p[1] <= L.y + L.h + 6) return { type: 'm', i: L.i };
    }
    return null;
  },

  pointStart(h) {
    if (h.type === 'm') {
      const a = this.pts[h.i], b = this.pts[(h.i + 1) % this.pts.length];
      const q = mkPt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, this.tapSigma(a[0]), 'carte');
      this.pts.splice(h.i + 1, 0, q);
      h.type = 'v'; h.i = h.i + 1; h.inserted = true;
    }
    return this.map.toScreen(this.pts[h.i]);
  },

  pointMove(h, ll) {
    this.pts[h.i] = mkPt(ll[0], ll[1], this.tapSigma(ll[0]), 'carte');
    this.sel = h.i;
    this.render();
  },

  pointEnd(h, moved) {
    if (!moved && !h.inserted) this.sel = this.sel === h.i ? null : h.i;
    this.changed();
  },

  fit() {
    if (!this.map || !this.pts.length) return;
    const W = this.pts.map((p) => GeoMap.world(p[0], p[1], 0));
    const xs = W.map((v) => v[0]), ys = W.map((v) => v[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-7);
    const z = Math.log2(Math.min(this.map.w, this.map.h) * 0.7 / span);
    const c = GeoMap.unworld((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, 0);
    this.map.setView(c, Math.min(z, 20));
  },

  drawOverlay(ctx, m) {
    const S = this.pts.map((p) => m.toScreen(p));
    const closed = this.mode === 'area' && S.length >= 3;
    // Position GPS
    if (this.fix) {
      const c = m.toScreen([this.fix.lat, this.fix.lon]);
      const r = this.fix.acc / m.mpp(this.fix.lat);
      ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(r, 8), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(47,140,255,.15)'; ctx.fill(); ctx.strokeStyle = 'rgba(47,140,255,.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(c[0], c[1], 7, 0, Math.PI * 2);
      ctx.fillStyle = '#2f8cff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (!S.length) return;
    ctx.beginPath();
    S.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    if (closed) { ctx.closePath(); ctx.fillStyle = 'rgba(245,184,46,.22)'; ctx.fill(); }
    ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = 3; ctx.stroke();
    // Longueur de chaque côté, posée sur le côté ; l'étiquette sert aussi de poignée « + » pour insérer un point
    ctx.font = '600 12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    this.labels = [];
    for (let i = 0; i < S.length - (closed ? 0 : 1); i++) {
      const j = (i + 1) % S.length, a = S[i], b = S[j];
      if (dist(a, b) < 70) continue;
      const txt = fmtSide(geoDist(this.pts[i], this.pts[j]) * 1000);
      const tw = ctx.measureText(txt).width, w = tw + 30, h = 22;
      const x = clamp((a[0] + b[0]) / 2 - w / 2, 4, m.w - w - 4), y = clamp((a[1] + b[1]) / 2 - h / 2, 4, m.h - h - 20);
      this.labels.push({ i, x, y, w, h });
      ctx.fillStyle = 'rgba(18,19,23,.88)';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 11); ctx.fill();
      ctx.strokeStyle = 'rgba(245,184,46,.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x + 7, y + h / 2); ctx.lineTo(x + 15, y + h / 2); ctx.moveTo(x + 11, y + h / 2 - 4); ctx.lineTo(x + 11, y + h / 2 + 4); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, x + 21, y + h / 2 + 0.5);
    }
    S.forEach((p, i) => {
      const gps = this.pts[i].src === 'gps', sel = this.sel === i;
      ctx.beginPath(); ctx.arc(p[0], p[1], sel ? 13 : 10, 0, Math.PI * 2);
      ctx.fillStyle = sel ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = gps ? '#2f8cff' : '#f5b82e'; ctx.stroke();
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    });
  },

  stopWatch() {
    if (this.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  },

  startWatch(force) {
    if (!navigator.geolocation || this.watchId != null) return;
    let centered = !force;
    this.watchId = navigator.geolocation.watchPosition((pos) => {
      const c = pos.coords;
      const gap = this.fix ? Date.now() - this.fix.t : 0;
      this.fix = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: Date.now() };
      if (this.auto && gap > 15000) toast('Suivi GPS interrompu un moment (écran verrouillé ?) : vérifiez le tracé.', 4000);
      // « Position exacte » désactivée dans iOS : précision de plusieurs centaines de mètres
      if (c.accuracy > 500 && !this.approxWarned) {
        this.approxWarned = true;
        toast('Position approximative : activez « Position exacte » (Réglages › Confidentialité › Service de localisation › Safari ou Toise).', 6000);
      }
      $('gpsChip').hidden = false;
      $('gpsChip').textContent = `GPS ± ${num(c.accuracy, c.accuracy < 10 ? 1 : 0)} m`;
      $('gpsChip').classList.toggle('ok', c.accuracy <= 5);
      if (this.map) {
        if (!centered) { this.map.setView([c.latitude, c.longitude], 18); centered = true; }
        this.map.request();
      }
      if (this.collecting) this.collecting.push(this.fix);
      if (this.auto) this.autoStep();
    }, (err) => {
      $('gpsChip').hidden = false;
      if (err.code === 1) {
        // Refus : on arrête et on explique où le réautoriser
        this.stopWatch(); this.denied = true;
        $('gpsChip').textContent = 'GPS refusé';
        toast('Localisation refusée. Réglages › Confidentialité › Service de localisation › Safari (ou Toise) : « Lorsque l\'app est active ».', 6000);
      } else {
        // Délai dépassé ou signal perdu : la surveillance continue d'elle-même
        $('gpsChip').textContent = err.code === 3 ? 'GPS : recherche…' : 'GPS indisponible ici';
      }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  },

  // Point GPS moyenné pendant 8 s, pondéré par la précision de chaque relevé
  gpsPoint() {
    if (!navigator.geolocation) { toast('GPS indisponible'); return; }
    this.startWatch(false);
    if (this.collecting) return;
    // Immobile, l'iPhone peut ne plus envoyer de position : on la redemande chaque seconde
    // (sans nouvelle position, c'est qu'on n'a pas bougé : la dernière reste valable une minute)
    this.collecting = this.fix && Date.now() - this.fix.t < 60000 ? [this.fix] : [];
    const ask = () => navigator.geolocation.getCurrentPosition((pos) => {
      if (!this.collecting) return;
      const c = pos.coords;
      this.collecting.push({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: Date.now() });
    }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 });
    ask();
    const btn = $('gpsPoint');
    let left = 8;
    btn.textContent = `Immobile… ${left} s`; btn.classList.add('on');
    const tick = setInterval(() => {
      left--;
      if (left > 0) ask();
      btn.textContent = `Immobile… ${left} s`;
      if (left > 0) return;
      clearInterval(tick);
      btn.textContent = 'Point GPS ici'; btn.classList.remove('on');
      const fixes = this.collecting.filter((f) => f.acc < 50);
      const any = this.collecting.length;
      this.collecting = null;
      if (!fixes.length) {
        toast(this.denied ? 'Localisation refusée : autorisez-la dans Réglages › Confidentialité › Service de localisation.'
          : any ? 'Signal GPS trop imprécis (plus de 50 m) : allez à découvert ou activez « Position exacte ».' : 'Aucune position reçue : allez à découvert.', 5000);
        return;
      }
      let sw = 0, la = 0, lo = 0;
      for (const f of fixes) { const wt = 1 / (f.acc * f.acc); sw += wt; la += f.lat * wt; lo += f.lon * wt; }
      const bestAcc = Math.min(...fixes.map((f) => f.acc));
      // Les erreurs GPS sont corrélées dans le temps : la moyenne améliore peu, on reste prudent
      const sig = Math.max(bestAcc / 2, Math.sqrt(1 / sw) / Math.sqrt(Math.min(fixes.length, 3)));
      this.pts.push(mkPt(la / sw, lo / sw, sig, 'gps'));
      this.changed();
      toast(`Point GPS ajouté (± ${num(sig * 2, 1)} m, ${fixes.length} relevé${fixes.length > 1 ? 's' : ''})`);
    }, 1000);
  },

  async toggleAuto() {
    this.auto = !this.auto;
    $('gpsAuto').classList.toggle('on', this.auto);
    $('gpsAuto').setAttribute('aria-pressed', String(this.auto));
    $('gpsAuto').textContent = this.auto ? 'Arrêter la marche' : 'Marche auto';
    if (this.auto) {
      this.startWatch(false);
      // Écran verrouillé = GPS coupé par iOS : on garde l'écran allumé pendant le tour
      if (await this.keepAwake()) toast('Faites le tour : un point tous les 3 m environ. L\'écran reste allumé.');
      else toast('Faites le tour : un point tous les 3 m. Gardez l\'écran allumé (le verrouillage coupe le GPS).', 4500);
    } else if (this.lock) { this.lock.release().catch(() => {}); this.lock = null; }
  },

  async keepAwake() {
    try {
      if (!navigator.wakeLock) return false;
      this.lock = await navigator.wakeLock.request('screen');
      return true;
    } catch { return false; }
  },

  autoStep() {
    const f = this.fix;
    if (!f || f.acc > 15) return;
    const last = this.pts[this.pts.length - 1];
    if (!last || geoDist(last, [f.lat, f.lon]) >= Math.max(3, f.acc)) {
      this.pts.push(mkPt(f.lat, f.lon, f.acc / 2, 'gps'));
      this.changed();
    }
  },

  changed(persist = true) {
    if (persist) {
      store.set('terrainPts', this.pts.map((p) => [p[0], p[1], p.sig, p.src]));
      if (this.mode === 'area' && this.pts.length >= 3) setLastArea(geoArea(this.pts), 'Terrain');
    }
    if (this.sel != null && this.sel >= this.pts.length) this.sel = null;
    $('tUndo').textContent = this.sel != null ? 'Retirer ce point' : 'Annuler';
    if (this.map) this.map.request();
    this.render();
  },

  // Monte-Carlo sur la position de chaque sommet (m → degrés)
  result() {
    const P = this.pts, closed = this.mode === 'area';
    if (P.length < (closed ? 3 : 2)) return null;
    const g = gaussFrom(rng(5)), A = [], Ls = [];
    for (let n = 0; n < 300; n++) {
      const Q = P.map((p) => {
        const s = p.sig || 1;
        return [p[0] + g() * s / 111320, p[1] + g() * s / (111320 * Math.cos(p[0] / DEG))];
      });
      if (closed) A.push(geoArea(Q));
      Ls.push(geoLen(Q, closed));
    }
    const lenTol = 2 * meanStd(Ls)[1];
    if (!closed) return { len: geoLen(P, false) * 1000, lenTolMm: lenTol * 1000 };
    const area = geoArea(P), aTol = 2 * meanStd(A)[1];
    return { area, aTol, areaText: fmtAreaBig(area), areaTol: '± ' + fmtAreaBig(aTol), per: geoLen(P, true) * 1000, perTolMm: lenTol * 1000 };
  },

  render() {
    const r = this.result();
    const area = this.mode === 'area';
    $('tLabel1').textContent = area ? 'Surface' : 'Distance';
    $('tLabel2').textContent = area ? 'Périmètre' : 'Points';
    if (!r) {
      $('tVal1').textContent = '—'; $('tTol1').textContent = '';
      $('tVal2').textContent = area ? '—' : String(this.pts.length); $('tTol2').textContent = '';
      $('tExtra').textContent = this.pts.length ? `${this.pts.length} point${this.pts.length > 1 ? 's' : ''} posé${this.pts.length > 1 ? 's' : ''}` : '';
      return;
    }
    if (area) {
      $('tVal1').textContent = r.areaText; $('tTol1').textContent = r.areaTol;
      $('tVal2').textContent = fmtLen(r.per, Height.bigU(), r.perTolMm); $('tTol2').textContent = fmtTol(r.perTolMm, Height.bigU());
      const m2 = r.area;
      $('tExtra').textContent = `${num(m2, 0)} m² · ${num(m2 / 100, 2)} ares · ${num(m2 / 10000, 4)} ha · ${num(m2 / 4046.86, 3)} acres`
        + (r.aTol / m2 > 0.02 ? ' · Pour réduire la marge, zoomez au maximum puis replacez les coins.' : '');
    } else {
      $('tVal1').textContent = fmtLen(r.len, Height.bigU(), r.lenTolMm); $('tTol1').textContent = fmtTol(r.lenTolMm, Height.bigU());
      $('tVal2').textContent = String(this.pts.length); $('tTol2').textContent = '';
      $('tExtra').textContent = '';
    }
  },
};

function fmtAreaBig(m2) {
  if (unit === 'in' || unit === 'ft') return m2 >= 4046.86 ? num(m2 / 4046.86, 3) + ' acres' : num(m2 * 10.7639, 0) + ' ft²';
  if (m2 >= 10000) return num(m2 / 10000, 3) + ' ha';
  return num(m2, m2 < 10 ? 2 : m2 < 1000 ? 1 : 0) + ' m²';
}

/* ---------------- Navigation ---------------- */

const TITLES = { photo: 'Photo', height: 'Visée', terrain: 'Terrain', plan: 'Plan', level: 'Niveau', ruler: 'Règle', history: 'Mesures' };

function show(name) {
  if (name === 'tools') name = store.get('toolScreen', 'level');
  if (!TITLES[name]) name = 'photo';
  const isTool = name === 'level' || name === 'ruler';
  if (isTool) store.set('toolScreen', name);
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 's-' + name; });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.screen === (isTool ? 'tools' : name)));
  $('toolSeg').hidden = !isTool;
  document.querySelectorAll('[data-tool-screen]').forEach((b) => { b.classList.toggle('active', b.dataset.toolScreen === name); b.setAttribute('aria-pressed', String(b.dataset.toolScreen === name)); });
  document.querySelectorAll('.tab').forEach((t) => { if (t.classList.contains('active')) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  $('screenTitle').textContent = isTool ? '' : TITLES[name];
  if (name !== 'height') Height.stop();
  else if (Height.wanted) Height.start();
  if (name !== 'terrain' && !Terrain.auto && !Terrain.collecting) Terrain.stopWatch();
  if (Sensors.started) $('sensorBtn').hidden = true;
  if (name === 'ruler') requestAnimationFrame(() => {
    Ruler.resize();
    // Le modèle exact ne se devine pas (12 mini = 11 Pro en taille logique, « Zoom de l'affichage ») : calibrer d'abord
    if (!Ruler.calibrated && !Ruler.prompted) { Ruler.prompted = true; $('calibRuler').click(); }
  });
  if (name === 'photo') requestAnimationFrame(() => Photo.resize());
  if (name === 'terrain') requestAnimationFrame(() => Terrain.open());
  store.set('screen', name);
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.screen)));
document.querySelectorAll('[data-tool-screen]').forEach((b) => b.addEventListener('click', () => show(b.dataset.toolScreen)));

Photo.init();
Photo.restore();
Height.init();
Level.init();
Ruler.init();
Terrain.init();
Plan.init();
History.render();
Height.render();
Terrain.render();
show(store.get('screen', 'photo') === 'height' ? 'photo' : store.get('screen', 'photo'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
