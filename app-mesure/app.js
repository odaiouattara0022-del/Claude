'use strict';

/* ================================================================
   Toise — outils de mesure pour iPhone (PWA, 100 % hors ligne)
   ================================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DEG = 180 / Math.PI;

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('toise.' + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('toise.' + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

/* ---------------- Unités et formatage ---------------- */

const UNITS = ['cm', 'mm', 'm', 'in', 'ft'];
let unit = store.get('unit', 'cm');
if (!UNITS.includes(unit)) unit = 'cm';

function num(v, digits) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtLen(mm, u = unit) {
  if (!isFinite(mm)) return '—';
  switch (u) {
    case 'mm': return num(mm, mm < 100 ? 1 : 0) + ' mm';
    case 'cm': return num(mm / 10, 1) + ' cm';
    case 'm': return num(mm / 1000, mm < 10000 ? 3 : 2) + ' m';
    case 'in': return num(mm / 25.4, 2) + ' in';
    case 'ft': {
      const inches = mm / 25.4;
      let ft = Math.floor(inches / 12);
      let rest = inches - ft * 12;
      if (rest >= 11.95) { ft += 1; rest = 0; }
      return `${ft}′ ${num(rest, 1)}″`;
    }
  }
}

function fmtArea(mm2, u = unit) {
  if (!isFinite(mm2)) return '—';
  switch (u) {
    case 'mm':
    case 'cm': return mm2 >= 1e6 ? num(mm2 / 1e6, 3) + ' m²' : num(mm2 / 100, 1) + ' cm²';
    case 'm': return num(mm2 / 1e6, 3) + ' m²';
    case 'in': return num(mm2 / 645.16, 1) + ' in²';
    case 'ft': return num(mm2 / 92903.04, 2) + ' ft²';
  }
}

const fmtDeg = (d, digits = 1) => num(d, digits) + '°';

$('unitBtn').textContent = unit;
$('unitBtn').addEventListener('click', () => {
  unit = UNITS[(UNITS.indexOf(unit) + 1) % UNITS.length];
  $('unitBtn').textContent = unit;
  store.set('unit', unit);
  Photo.refresh();
  Height.render();
  Ruler.draw();
});

/* ---------------- Toast et feuille d'enregistrement ---------------- */

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

let sheetCb = null;
function askSave(kind, value, cb) {
  $('sheetTitle').textContent = 'Enregistrer : ' + kind;
  $('sheetValue').textContent = value;
  $('sheetNote').value = '';
  $('sheet').hidden = false;
  sheetCb = cb;
}
$('sheetCancel').addEventListener('click', () => { $('sheet').hidden = true; sheetCb = null; });
$('sheetOk').addEventListener('click', () => {
  $('sheet').hidden = true;
  if (sheetCb) sheetCb($('sheetNote').value.trim());
  sheetCb = null;
});

/* ---------------- Capteurs (orientation) ---------------- */

const Sensors = {
  up: null,             // vecteur « haut » dans le repère de l'appareil
  listeners: new Set(),
  started: false,

  async start() {
    if (this.started) return true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { toast('Accès aux capteurs refusé. Réglages › Safari › Mouvement et orientation.'); return false; }
      }
    } catch (e) {
      toast('Touchez le bouton pour autoriser les capteurs.');
      return false;
    }
    window.addEventListener('deviceorientation', (e) => this.onOrient(e));
    this.started = true;
    setTimeout(() => { if (!this.up) toast('Aucun capteur détecté sur cet appareil.'); }, 1500);
    return true;
  },

  onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta / DEG, g = e.gamma / DEG;
    const raw = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
    if (!this.up) this.up = raw;
    else {
      const k = 0.3;
      const u = this.up.map((v, i) => v + (raw[i] - v) * k);
      const n = Math.hypot(...u) || 1;
      this.up = u.map((v) => v / n);
    }
    this.listeners.forEach((fn) => fn(this.up));
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
    } else toast('Mesure enregistrée');
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
   PHOTO — mesure avec correction de perspective (homographie)
   ================================================================ */

const REFS = {
  card: [85.6, 53.98], a4: [210, 297], letter: [215.9, 279.4],
  bill: [133, 72], tile: [300, 300],
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

function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return h ? [...h, 1] : null;
}

function applyH(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

function orderConvex(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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
  pointers: new Map(),
  drag: null,
  pinch: null,

  init() {
    const onFile = (e) => { const f = e.target.files[0]; if (f) this.load(f); e.target.value = ''; };
    $('photoInput').addEventListener('change', onFile);
    $('photoInputLib').addEventListener('change', onFile);
    $('newPhotoBtn').addEventListener('click', () => {
      this.img = null; $('photoWork').hidden = true; $('photoEmpty').hidden = false;
    });
    $('refSelect').value = store.get('ref', 'card');
    $('customRef').hidden = $('refSelect').value !== 'custom';
    $('refSelect').addEventListener('change', () => {
      store.set('ref', $('refSelect').value);
      $('customRef').hidden = $('refSelect').value !== 'custom';
      const needed = this.refNeeded();
      if (this.ref.length > needed) this.ref = this.ref.slice(0, needed);
      this.computeRef();
    });
    ['customW', 'customH'].forEach((id) => $(id).addEventListener('input', () => this.computeRef()));
    $('resetRefBtn').addEventListener('click', () => { this.ref = []; this.computeRef(); });
    $('undoBtn').addEventListener('click', () => this.undo());
    $('savePhotoBtn').addEventListener('click', () => this.save());
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

  load(file) {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      this.img = im;
      this.ref = []; this.shapes = []; this.toPlane = null;
      $('photoEmpty').hidden = true; $('photoWork').hidden = false;
      requestAnimationFrame(() => { this.resize(); this.fit(); this.refresh(); });
    };
    im.onerror = () => toast('Image illisible');
    im.src = url;
  },

  resize() {
    const r = this.canvas.getBoundingClientRect();
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
      const w = parseFloat($('customW').value), h = parseFloat($('customH').value);
      return w > 0 && h > 0 ? [w, h] : null;
    }
    return REFS[v];
  },

  computeRef() {
    this.toPlane = null;
    const v = $('refSelect').value;
    if (v === 'line' && this.ref.length === 2) {
      const L = parseFloat(this.lineRefLen);
      if (L > 0) {
        const s = L / dist(this.ref[0], this.ref[1]);
        this.toPlane = ([x, y]) => [x * s, y * s];
      }
    } else if (this.ref.length === 4) {
      const dims = this.refDims();
      if (dims) {
        const q = orderConvex(this.ref);
        const e0 = dist(q[0], q[1]) + dist(q[2], q[3]);
        const e1 = dist(q[1], q[2]) + dist(q[3], q[0]);
        const big = Math.max(...dims), small = Math.min(...dims);
        const [W, Hh] = e0 >= e1 ? [big, small] : [small, big];
        const H = homography(q, [[0, 0], [W, 0], [W, Hh], [0, Hh]]);
        if (H) this.toPlane = (p) => applyH(H, p);
      }
    }
    this.refresh();
  },

  /* --- Interaction --- */

  pos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },

  allPoints() {
    const out = this.ref.map((p, i) => ({ arr: this.ref, i }));
    this.shapes.forEach((s) => s.pts.forEach((p, i) => out.push({ arr: s.pts, i, shape: s })));
    return out;
  },

  hit(sp) {
    let best = null, bd = 26;
    for (const h of this.allPoints()) {
      const d = dist(this.toScr(h.arr[h.i]), sp);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  },

  current() {
    const s = this.shapes[this.shapes.length - 1];
    return s && !s.done ? s : null;
  },

  down(e) {
    if (!this.img) return;
    this.canvas.setPointerCapture(e.pointerId);
    const sp = this.pos(e);
    this.pointers.set(e.pointerId, sp);

    if (this.pointers.size === 2) {
      if (this.drag && this.drag.created) this.removeHandle(this.drag.handle);
      this.drag = null; this.loupe.hidden = true;
      const [a, b] = [...this.pointers.values()];
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.pinch = { d0: dist(a, b), s0: this.view.s, imgC: this.toImg(...c) };
      this.draw();
      return;
    }
    if (this.pointers.size > 2) return;

    const h = this.hit(sp);
    if (h) { this.drag = { handle: h, start: sp, created: false }; }
    else {
      const p = this.toImg(...sp);
      const handle = this.addPoint(p);
      if (!handle) return;
      this.drag = { handle, start: sp, created: true };
    }
    this.showLoupe(sp);
    this.refresh();
  },

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const sp = this.pos(e);
    this.pointers.set(e.pointerId, sp);
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const minS = Math.min(this.cw / this.img.naturalWidth, this.ch / this.img.naturalHeight) * 0.5;
      const s = clamp(this.pinch.s0 * dist(a, b) / this.pinch.d0, minS, 20);
      this.view = { s, x: c[0] - this.pinch.imgC[0] * s, y: c[1] - this.pinch.imgC[1] * s };
      this.draw();
      return;
    }
    if (this.drag) {
      const { arr, i } = this.drag.handle;
      arr[i] = this.toImg(...sp);
      if (arr === this.ref) this.computeRef(); else this.refresh();
      this.showLoupe(sp);
    }
  },

  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
    if (this.drag) {
      const d = this.drag;
      const sh = d.handle.shape;
      // Toucher le premier point d'une surface ferme le polygone
      if (!d.created && sh && sh.type === 'area' && !sh.done && d.handle.i === 0 &&
          sh.pts.length >= 3 && dist(d.start, this.pos(e)) < 8) sh.done = true;
      this.drag = null;
      this.loupe.hidden = true;
      if (d.handle.arr === this.ref) this.computeRef();
      if (this.ref.length === this.refNeeded() && $('refSelect').value === 'line' && !this.toPlane) this.askLineLen();
      this.refresh();
    }
  },

  askLineLen() {
    askSave('longueur de référence', 'Entrez la longueur réelle entre les 2 points, en mm, puis validez.', (note) => {
      const v = parseFloat(note.replace(',', '.'));
      if (v > 0) { this.lineRefLen = v; this.computeRef(); }
      else toast('Longueur invalide');
    });
    $('sheetTitle').textContent = 'Longueur de référence';
    $('sheetNote').placeholder = 'ex. : 800';
    $('sheetNote').inputMode = 'decimal';
    $('sheetOk').textContent = 'Valider';
    const restore = () => { $('sheetNote').placeholder = 'Note (ex. : largeur porte salon)'; $('sheetNote').inputMode = 'text'; $('sheetOk').textContent = 'Enregistrer'; };
    $('sheetOk').addEventListener('click', restore, { once: true });
    $('sheetCancel').addEventListener('click', restore, { once: true });
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
    if (h.shape && h.shape.pts.length === 0) this.shapes.splice(this.shapes.indexOf(h.shape), 1);
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
  },

  /* --- Calculs --- */

  measure(s) {
    const P = s.pts.map(this.toPlane);
    if (s.type === 'line' && P.length === 2) return { label: 'Longueur', text: fmtLen(dist(P[0], P[1])), mm: dist(P[0], P[1]) };
    if (s.type === 'area' && P.length >= 3) {
      let a = 0, per = 0;
      for (let i = 0; i < P.length; i++) {
        const j = (i + 1) % P.length;
        a += P[i][0] * P[j][1] - P[j][0] * P[i][1];
        if (s.done || j !== 0) per += dist(P[i], P[j]);
      }
      return { label: 'Surface', text: `${fmtArea(Math.abs(a) / 2)} · périm. ${fmtLen(per)}` };
    }
    if (s.type === 'angle' && P.length === 3) {
      const v1 = [P[0][0] - P[1][0], P[0][1] - P[1][1]], v2 = [P[2][0] - P[1][0], P[2][1] - P[1][1]];
      const ang = Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2)), -1, 1)) * DEG;
      return { label: 'Angle', text: fmtDeg(ang) };
    }
    return null;
  },

  // Incertitude : ±1,5 px de pointage par extrémité, convertis en mm au point mesuré
  precision() {
    if (!this.toPlane || !this.img) return null;
    const c = [this.img.naturalWidth / 2, this.img.naturalHeight / 2];
    const a = this.toPlane(c), b = this.toPlane([c[0] + 1, c[1]]);
    const zoomFactor = Math.max(1, 1 / this.view.s);
    return dist(a, b) * 1.5 * Math.SQRT2 * Math.min(zoomFactor, 4);
  },

  /* --- Rendu --- */

  refresh() {
    const needed = this.refNeeded();
    const step = $('photoStep');
    if (this.ref.length < needed) {
      step.textContent = needed === 4
        ? `1. Touchez les 4 coins de la référence (${this.ref.length}/4)`
        : `1. Touchez les 2 extrémités de la longueur connue (${this.ref.length}/2)`;
    } else if (!this.toPlane) {
      step.textContent = needed === 4 ? '1. Indiquez la taille de la référence' : '1. Indiquez la longueur de référence';
    } else {
      const hint = { line: 'Touchez 2 points', area: 'Touchez les sommets, puis le 1er pour fermer', angle: 'Touchez 3 points (sommet au milieu)' }[this.tool];
      step.textContent = '2. ' + hint + ' · pincez pour zoomer';
    }
    $('measureTools').hidden = !this.toPlane;

    const ul = $('photoResults');
    ul.textContent = '';
    if (this.toPlane) {
      let n = 0;
      for (const s of this.shapes) {
        const m = this.measure(s);
        if (!m) continue;
        n++;
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = `${m.label} ${n}`;
        const b = document.createElement('span'); b.textContent = m.text;
        li.append(a, b); ul.append(li);
        s.labelText = m.text;
      }
      const p = this.precision();
      if (p != null) {
        const li = document.createElement('li');
        li.className = 'precision';
        li.textContent = `Précision estimée : ± ${fmtLen(p)} par point. Zoomez pour l'améliorer.`;
        ul.append(li);
      }
    }
    this.draw();
  },

  draw(target = this.ctx, scale = window.devicePixelRatio || 1, view = this.view, w = this.cw, h = this.ch) {
    const ctx = target;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (!this.img) return;
    ctx.drawImage(this.img, view.x, view.y, this.img.naturalWidth * view.s, this.img.naturalHeight * view.s);
    const S = (p) => [p[0] * view.s + view.x, p[1] * view.s + view.y];
    const accent = '#f5b82e';
    const lw = Math.max(2, w / 300);

    // Référence
    if (this.ref.length) {
      const pts = (this.ref.length === 4 ? orderConvex(this.ref) : this.ref).map(S);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      if (this.ref.length === 4) { ctx.closePath(); ctx.fillStyle = 'rgba(79,212,138,.22)'; ctx.fill(); }
      ctx.strokeStyle = '#4fd48a'; ctx.lineWidth = lw; ctx.stroke();
      pts.forEach((p) => this.dot(ctx, p, '#4fd48a', lw));
    }

    // Mesures
    for (const s of this.shapes) {
      const pts = s.pts.map(S);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      if (s.type === 'area' && s.done) { ctx.closePath(); ctx.fillStyle = 'rgba(245,184,46,.22)'; ctx.fill(); }
      ctx.strokeStyle = accent; ctx.lineWidth = lw; ctx.stroke();
      pts.forEach((p) => this.dot(ctx, p, accent, lw));
      const m = this.toPlane && this.measure(s);
      if (m) {
        let at;
        if (s.type === 'line') at = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        else if (s.type === 'angle') at = pts[1];
        else at = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
        this.label(ctx, at, s.type === 'area' ? m.text.split(' · ')[0] : m.text, Math.max(14, w / 28));
      }
    }
  },

  dot(ctx, p, color, lw) {
    ctx.beginPath(); ctx.arc(p[0], p[1], lw * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
    ctx.beginPath(); ctx.arc(p[0], p[1], lw * 0.8, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  },

  label(ctx, [x, y], text, size) {
    ctx.font = `600 ${size}px ui-monospace, Menlo, monospace`;
    const tw = ctx.measureText(text).width;
    const pad = size * 0.4;
    ctx.fillStyle = 'rgba(18,19,23,.88)';
    ctx.beginPath();
    ctx.roundRect(x - tw / 2 - pad, y - size * 1.9, tw + pad * 2, size * 1.4, size * 0.35);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - size * 1.2);
  },

  showLoupe(sp) {
    const L = this.loupe, lc = L.getContext('2d');
    L.hidden = false;
    L.classList.toggle('right', sp[0] < this.cw / 2 && sp[1] < 150);
    const zoom = Math.max(this.view.s * 3, 0.6);
    const ip = this.toImg(...sp);
    const size = L.width;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.fillStyle = '#000'; lc.fillRect(0, 0, size, size);
    const v = { s: zoom, x: size / 2 - ip[0] * zoom, y: size / 2 - ip[1] * zoom };
    this.draw(lc, 1, v, size, size);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.strokeStyle = '#ff3b30'; lc.lineWidth = 2;
    lc.beginPath(); lc.moveTo(size / 2, size / 2 - 22); lc.lineTo(size / 2, size / 2 + 22);
    lc.moveTo(size / 2 - 22, size / 2); lc.lineTo(size / 2 + 22, size / 2); lc.stroke();
  },

  save() {
    if (!this.toPlane) { toast('Placez d\'abord la référence'); return; }
    this.finishOpen();
    this.refresh();
    const rows = this.shapes.map((s) => this.measure(s)).filter(Boolean);
    if (!rows.length) { toast('Aucune mesure à enregistrer'); return; }
    const text = rows.map((r) => `${r.label} : ${r.text}`).join('\n');
    // Vignette annotée
    const tw = 480, s = tw / this.img.naturalWidth, th = Math.round(this.img.naturalHeight * s);
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    this.draw(c.getContext('2d'), 1, { s, x: 0, y: 0 }, tw, th);
    let img = null;
    try { img = c.toDataURL('image/jpeg', 0.72); } catch {}
    askSave('Photo', text, (note) => History.add('Photo', text, note, img));
  },
};

/* ================================================================
   HAUTEUR — visée caméra + inclinaison (trigonométrie)
   ================================================================ */

const Height = {
  samples: [],
  eBase: null,
  eTop: null,
  stream: null,

  init() {
    $('eyeH').value = store.get('eyeH', 1.5);
    $('eyeH').addEventListener('input', () => { store.set('eyeH', parseFloat($('eyeH').value) || 1.5); this.render(); });
    $('knownD').addEventListener('input', () => this.render());
    $('camStart').addEventListener('click', () => this.start());
    $('markBtn').addEventListener('click', () => this.mark());
    $('heightReset').addEventListener('click', () => { this.eBase = this.eTop = null; this.render(); });
    $('heightSave').addEventListener('click', () => {
      const r = this.result();
      if (!r || r.h == null) { toast('Visez la base puis le sommet'); return; }
      const text = `Hauteur : ${fmtLen(r.h)}\nDistance : ${fmtLen(r.d)}`;
      askSave('Hauteur', text, (note) => History.add('Hauteur', text, note));
    });
    Sensors.on((u) => {
      const e = Math.asin(clamp(-u[2], -1, 1)) * DEG; // élévation de l'axe de la caméra
      this.samples.push(e);
      if (this.samples.length > 20) this.samples.shift();
      if (!$('s-height').hidden) $('hudAngle').textContent = num(e, 1);
    });
  },

  async start() {
    const ok = await Sensors.start();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      $('camVideo').srcObject = this.stream;
      $('camStart').hidden = true;
    } catch {
      toast('Caméra indisponible : la visée fonctionne quand même avec le réticule.');
      if (ok) $('camStart').hidden = true;
    }
  },

  stop() {
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; $('camStart').hidden = false; }
  },

  angle() {
    const s = this.samples.slice(-10);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  },

  mark() {
    const a = this.angle();
    if (a == null) { toast('Activez d\'abord les capteurs'); this.start(); return; }
    if (this.eBase == null || this.eTop != null) {
      if (this.eTop != null) this.eTop = null;
      if (a > -1 && !(parseFloat($('knownD').value) > 0)) { toast('Inclinez vers le bas pour viser la base'); return; }
      this.eBase = a;
    } else {
      this.eTop = a;
    }
    this.render();
  },

  result() {
    if (this.eBase == null) return null;
    const known = parseFloat(($('knownD').value || '').replace(',', '.'));
    const h = (parseFloat($('eyeH').value) || 1.5) * 1000;
    const tb = Math.tan(this.eBase / DEG);
    const d = known > 0 ? known * 1000 : h / -tb;
    if (!(d > 0) || !isFinite(d)) return null;
    const out = { d, h: null };
    if (this.eTop != null) out.h = d * (Math.tan(this.eTop / DEG) - tb);
    return out;
  },

  render() {
    const r = this.result();
    $('outDist').textContent = r ? fmtLen(r.d) : '—';
    $('outHeight').textContent = r && r.h != null ? fmtLen(r.h) : '—';
    if (this.eBase == null) { $('markBtn').textContent = 'Viser la base'; $('heightHint').textContent = 'Centrez le réticule sur le pied de l\'objet'; }
    else if (this.eTop == null) { $('markBtn').textContent = 'Viser le sommet'; $('heightHint').textContent = 'Sans bouger, montez jusqu\'au sommet'; }
    else { $('markBtn').textContent = 'Nouvelle mesure'; $('heightHint').textContent = 'Mesure terminée'; }
  },
};

/* ================================================================
   NIVEAU — bulle 2D, chant, calibrage par retournement
   ================================================================ */

const Level = {
  mode: 'auto',
  current: 'surface',
  hold: false,
  zero: { x: 0, y: 0, e: 0 },
  calib: store.get('levelCalib', { x: 0, y: 0, e: 0 }),
  calibStep: 0,
  calibFirst: null,
  reading: null,
  sound: false,
  audio: null,

  init() {
    document.querySelectorAll('[data-lmode]').forEach((b) => b.addEventListener('click', () => {
      this.mode = b.dataset.lmode;
      document.querySelectorAll('[data-lmode]').forEach((x) => x.classList.toggle('active', x === b));
    }));
    $('sensorBtn').addEventListener('click', async () => { if (await Sensors.start()) $('sensorBtn').hidden = true; });
    $('holdBtn').addEventListener('click', () => {
      this.hold = !this.hold;
      $('holdBtn').classList.toggle('on', this.hold);
      $('holdBtn').textContent = this.hold ? 'Figé' : 'Figer';
    });
    $('zeroBtn').addEventListener('click', () => {
      if (!this.reading) return;
      const isZeroed = this.zero.x || this.zero.y || this.zero.e;
      if (isZeroed) { this.zero = { x: 0, y: 0, e: 0 }; $('zeroBtn').classList.remove('on'); toast('Zéro absolu'); }
      else {
        const r = this.raw;
        this.zero = { x: r.x - this.calib.x, y: r.y - this.calib.y, e: r.e - this.calib.e };
        $('zeroBtn').classList.add('on'); toast('Zéro relatif défini : mesurez un angle par rapport à cette surface');
      }
    });
    $('calibBtn').addEventListener('click', () => this.calibrate());
    $('soundBtn').addEventListener('click', () => {
      this.sound = !this.sound;
      $('soundBtn').textContent = 'Son : ' + (this.sound ? 'oui' : 'non');
      $('soundBtn').classList.toggle('on', this.sound);
      if (this.sound && !this.audio) this.initAudio();
    });
    $('levelSave').addEventListener('click', () => {
      if (!this.reading) { toast('Activez les capteurs'); return; }
      const text = $('levelMain').textContent + (this.current === 'surface' ? '\n' + $('levelSub').textContent : '');
      askSave('Niveau', text, (note) => History.add(this.current === 'surface' ? 'Niveau (surface)' : 'Niveau (chant)', text, note));
    });
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') {
      Sensors.start().then((ok) => { if (ok) $('sensorBtn').hidden = true; });
    }
    Sensors.on((u) => this.update(u));
  },

  initAudio() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.frequency.value = 880; gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination); osc.start();
      this.audio = { ac, gain };
    } catch {}
  },

  calibrate() {
    if (!this.raw) { toast('Activez les capteurs'); return; }
    if (this.calibStep === 0) {
      this.calibFirst = { ...this.raw };
      this.calibStep = 1;
      $('calibBtn').textContent = 'Étape 2';
      $('calibBtn').classList.add('on');
      $('calibNote').textContent = 'Tournez le téléphone de 180° au même endroit, puis touchez « Étape 2 ».';
    } else {
      const a = this.calibFirst, b = this.raw;
      this.calib = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, e: (a.e + b.e) / 2 };
      store.set('levelCalib', this.calib);
      this.calibStep = 0;
      $('calibBtn').textContent = 'Calibrer';
      $('calibBtn').classList.remove('on');
      $('calibNote').textContent = `Calibré. Correction : X ${fmtDeg(this.calib.x, 2)}, Y ${fmtDeg(this.calib.y, 2)}, chant ${fmtDeg(this.calib.e, 2)}.`;
      toast('Calibrage enregistré');
    }
  },

  update(u) {
    const [ux, uy, uz] = u;
    const roll = Math.atan2(ux, uy) * DEG;
    const e = roll - 90 * Math.round(roll / 90);
    this.raw = { x: Math.atan2(ux, uz) * DEG, y: Math.atan2(uy, uz) * DEG, e };
    if (this.hold || $('s-level').hidden) return;

    if (this.mode === 'auto') {
      if (this.current === 'surface' && Math.abs(uz) < 0.7) this.current = 'edge';
      else if (this.current === 'edge' && Math.abs(uz) > 0.8) this.current = 'surface';
    } else this.current = this.mode;

    const off = (k) => this.calib[k] + this.zero[k];
    const x = this.raw.x - off('x'), y = this.raw.y - off('y'), ed = this.raw.e - off('e');
    this.reading = { x, y, e: ed };
    const surface = this.current === 'surface';
    $('levelSurface').hidden = !surface;
    $('levelEdge').hidden = surface;

    let dev;
    if (surface) {
      const tilt = Math.hypot(x, y);
      dev = tilt;
      const R = $('levelSurface').clientWidth / 2;
      const k = Math.min(1, tilt / 10) / (tilt || 1) * R * 0.78;
      $('bubble').style.transform = `translate(calc(-50% + ${x * k}px), calc(-50% + ${-y * k}px))`;
      $('levelMain').textContent = fmtDeg(tilt);
      $('levelSub').textContent = `X ${fmtDeg(x)} · Y ${fmtDeg(y)} · pente ${num(Math.tan(tilt / DEG) * 100, 1)} %`;
    } else {
      dev = Math.abs(ed);
      $('horizon').style.transform = `rotate(${ed}deg)`;
      $('levelMain').textContent = fmtDeg(Math.abs(ed));
      $('levelSub').textContent = `pente ${num(Math.tan(Math.abs(ed) / DEG) * 100, 1)} % · ${num(Math.tan(Math.abs(ed) / DEG) * 1000, 1)} mm/m`;
    }
    const level = dev < 0.15;
    $('levelBox').classList.toggle('is-level', level);
    if (this.audio) this.audio.gain.gain.setTargetAtTime(this.sound && level ? 0.08 : 0, this.audio.ac.currentTime, 0.02);
  },
};

/* ================================================================
   RÈGLE — à l'échelle réelle selon le modèle d'iPhone
   ================================================================ */

// Points CSS par pouce (ppi physique ÷ facteur d'échelle), clé : largeur×hauteur CSS
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
    this.b = 50 * this.pxmm;
    for (const [id, key] of [['curA', 'a'], ['curB', 'b']]) {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        const top = $('rulerBox').getBoundingClientRect().top;
        const mv = (ev) => { this[key] = clamp(ev.clientY - top, 0, this.h); this.place(); };
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
    $('rulerSlider').addEventListener('input', () => { this.ppi = parseFloat($('rulerSlider').value); this.draw(); this.place(); });
    $('calibDone').addEventListener('click', () => {
      store.set('ppi', this.ppi); this.calibrated = true;
      this.calibrating = false; $('rulerCalib').hidden = true; this.draw(); this.place();
      toast('Règle calibrée');
    });
    $('rulerSave').addEventListener('click', () => {
      const text = fmtLen(Math.abs(this.b - this.a) / this.pxmm);
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
    $('rulerVal').textContent = unit === 'cm' || unit === 'm' ? num(mm, 1) + ' mm' : fmtLen(mm);
    $('rulerPpi').textContent = (this.calibrated ? 'calibrée' : 'modèle détecté') + ` · ${num(this.ppi, 1)} pt/po`;
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
    // Millimètres, bord gauche
    const pm = this.pxmm;
    for (let mm = 0; mm * pm <= this.h; mm++) {
      const y = Math.round(mm * pm) + 0.5;
      const len = mm % 10 === 0 ? 26 : mm % 5 === 0 ? 17 : 10;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
      if (mm % 10 === 0 && mm > 0) ctx.fillText(String(mm / 10), 30, y);
    }
    // Pouces, bord droit
    const pi = this.ppi;
    ctx.textAlign = 'right';
    for (let s = 0; s * pi / 16 <= this.h; s++) {
      const y = Math.round(s * pi / 16) + 0.5;
      const len = s % 16 === 0 ? 26 : s % 8 === 0 ? 20 : s % 4 === 0 ? 15 : s % 2 === 0 ? 10 : 6;
      ctx.beginPath(); ctx.moveTo(this.w, y); ctx.lineTo(this.w - len, y); ctx.stroke();
      if (s % 16 === 0 && s > 0) ctx.fillText(String(s / 16), this.w - 30, y);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b5a2a';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('cm', 30, 10);
    ctx.textAlign = 'right'; ctx.fillText('in', this.w - 30, 10);
    // Gabarit carte bancaire
    if (this.calibrating) {
      const y0 = 20, y1 = y0 + 85.6 * pm;
      ctx.fillStyle = 'rgba(210,48,31,.12)';
      ctx.fillRect(60, y0, this.w - 120, y1 - y0);
      ctx.strokeStyle = '#d2301f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(40, y0); ctx.lineTo(this.w - 40, y0); ctx.moveTo(40, y1); ctx.lineTo(this.w - 40, y1); ctx.stroke();
    }
  },
};

/* ---------------- Navigation ---------------- */

const TITLES = { photo: 'Photo', height: 'Hauteur', level: 'Niveau', ruler: 'Règle', history: 'Mesures' };

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 's-' + name; });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
  $('screenTitle').textContent = TITLES[name];
  if (name !== 'height') Height.stop();
  if (name === 'ruler') requestAnimationFrame(() => Ruler.resize());
  if (name === 'photo') requestAnimationFrame(() => Photo.resize());
  store.set('screen', name);
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.screen)));

Photo.init();
Height.init();
Level.init();
Ruler.init();
History.render();
Height.render();
show(store.get('screen', 'photo') === 'height' ? 'photo' : store.get('screen', 'photo'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
