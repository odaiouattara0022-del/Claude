// Tests de bout en bout de Toise : node tests/suite.js (Playwright requis)
// Photo de test : mur en perspective, carte bancaire à coins arrondis, porte de 830 mm (positions exactes dans truth.json)
const path = require('path');
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
const fs = require('fs');
process.chdir(__dirname);
const T = require('./truth.json');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const tilePng = fs.readFileSync('tile.png');
fs.mkdirSync('out', { recursive: true });

let fails = 0;
const ok = (cond, msg, extra = '') => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg + (extra ? '  → ' + extra : '')); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const parseNum = (t) => parseFloat(String(t).replace(/[^\d,.-]/g, '').replace(',', '.'));

async function newPage(b, dev, opts = {}) {
  const ctx = await b.newContext({ ...devices[dev], ...opts });
  await ctx.route(/arcgisonline|openstreetmap/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: tilePng }));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(URL);
  return { ctx, p };
}

const orient = (p, alpha, beta, gamma, n = 30, jitter = 0.01) => p.evaluate(async ([a, b, g, n, j]) => {
  for (let i = 0; i < n; i++) {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: a, beta: b + (Math.random() - 0.5) * j, gamma: g }));
    await new Promise((r) => setTimeout(r, 16));
  }
}, [alpha, beta, gamma, n, jitter]);

(async () => {
  const b = await chromium.launch();

  console.log('\n1. Tous les écrans, 3 tailles d\'iPhone');
  for (const dev of ['iPhone SE', 'iPhone 13', 'iPhone 15 Pro Max']) {
    const { ctx, p } = await newPage(b, dev);
    for (const s of ['photo', 'height', 'terrain', 'plan', 'tools', 'history']) {
      await p.click(`[data-screen=${s}]`);
      await p.waitForTimeout(350);
      const ov = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.body.scrollHeight, innerHeight]);
      if (ov[0] > ov[1]) ok(false, `${dev} ${s} : débordement horizontal`, ov.join('/'));
      await p.screenshot({ path: `out/s-${dev.replace(/ /g, '')}-${s}.png` });
    }
    await p.click('[data-screen=tools]'); await p.click('[data-tool-screen=ruler]'); await p.waitForTimeout(200);
    await p.screenshot({ path: `out/s-${dev.replace(/ /g, '')}-ruler.png` });
    ok(p.errs.length === 0, `${dev} : aucun écran en erreur`, p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n2. Photo');
  {
    const { ctx, p } = await newPage(b, 'iPhone 13');
    await p.setInputFiles('#photoInputLib', 'persp.jpg');
    await p.waitForTimeout(1200);
    const tap = async ([ix, iy]) => {
      const [x, y] = await p.evaluate(([a, c]) => { const r = Photo.canvas.getBoundingClientRect(); const s = Photo.toScr([a, c]); return [s[0] + r.left, s[1] + r.top]; }, [ix, iy]);
      await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.up();
    };
    await p.evaluate(([cx, cy]) => { const s = 2; Photo.view = { s, x: Photo.cw / 2 - cx * s, y: Photo.ch / 2 - cy * s }; Photo.draw(); }, [620, 1145]);
    for (const c of T.card) await tap([c[0] + 2, c[1] - 1.5]);
    ok(await p.evaluate(() => !!Photo.toPlane && Photo.ref.every((q) => q.snapped)), 'référence posée et affinée automatiquement');
    await p.evaluate(() => Photo.fit());
    await tap([T.doorL[0] + 5, T.doorL[1]]); await tap([T.doorR[0] - 4, T.doorR[1]]);
    const L = await p.evaluate(() => Photo.value('line', Photo.shapes[0].pts.map(Photo.toPlane)));
    ok(near(L, 830, 12), 'porte de 830 mm mesurée', L.toFixed(1) + ' mm');
    // surface : rectangle de la porte (4 coins visibles en bas : on prend un rectangle intérieur)
    await p.click('[data-tool=area]');
    const P = (x, y) => p.evaluate(([x, y]) => { const H = Photo.toPlane; return null; }, [x, y]);
    for (const q of [[1300, 1600], [2000, 1650], [1950, 1900], [1300, 1850]]) await tap(q);
    await tap([1300, 1600]);
    ok(await p.evaluate(() => Photo.shapes[1] && Photo.shapes[1].done && Photo.shapes[1].pts.length === 4), 'surface fermée en touchant le 1er point');
    await p.click('[data-tool=angle]');
    for (const q of [[1200, 600], [1200, 1000], [1700, 600]]) await tap(q);
    const rows = await p.$$eval('#photoResults li', (l) => l.map((x) => x.textContent));
    ok(rows.length === 4 && rows[0].includes('±') && rows[1].includes('m²') && rows[2].includes('°'), 'résultats : longueur, surface, angle avec marges', rows.slice(0, 3).join(' | '));
    await p.click('#photoResults li:nth-child(3) .row-del');
    ok(await p.evaluate(() => Photo.shapes.length === 2), 'suppression d\'une mesure depuis la liste');
    await p.click('#undoBtn');
    ok(await p.evaluate(() => Photo.shapes[1].pts.length === 3 && !Photo.shapes[1].done), 'annuler retire le dernier point');
    for (const u of ['mm', 'm', 'in', 'ft', 'cm']) { await p.click('#unitBtn'); }
    ok(await p.textContent('#unitBtn') === 'cm', 'cycle des unités');
    await p.click('#savePhotoBtn'); await p.fill('#sheetNote', 'Porte test'); await p.press('#sheetNote', 'Enter');
    ok(await p.evaluate(() => History.items.length === 1 && !!History.items[0].img), 'enregistrement avec photo annotée (touche Entrée)');
    // référence longueur connue en mètres
    await p.click('#newPhotoBtn'); await p.setInputFiles('#photoInputLib', 'persp.jpg'); await p.waitForTimeout(800);
    await p.selectOption('#refSelect', 'line');
    await tap([T.doorL[0] + 3, T.doorL[1]]); await tap([T.doorR[0] - 3, T.doorR[1]]);
    ok(!(await p.isHidden('#sheet')), 'demande de la longueur de référence');
    await p.fill('#sheetNote', '0,83 m'); await p.click('#sheetOk');
    ok(await p.evaluate(() => Photo.lineRefLen === 830 && !!Photo.toPlane), 'longueur « 0,83 m » comprise', String(await p.evaluate(() => Photo.lineRefLen)));
    await p.selectOption('#refSelect', 'custom');
    await p.fill('#customW', '2000'); await p.fill('#customH', '1000,5');
    ok(await p.evaluate(() => JSON.stringify(Photo.refDims().slice(0, 2)) === '[2000,1000.5]'), 'rectangle personnalisé avec virgule');
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n2 bis. Photo : praticable au sol en vue rasante, sauvegarde, saisies');
  {
    const D = require('./deck.json');
    const { ctx, p } = await newPage(b, 'iPhone 13');
    await p.setInputFiles('#photoInputLib', 'deck.jpg'); await p.waitForTimeout(1200);
    await p.selectOption('#refSelect', 'deck');
    const d = await p.evaluate((D) => {
      Photo.view.s = 1;
      Photo.ref = D.corners.map(([x, y], i) => { const q = [x + [2, -2, 1.5, -1][i], y + [1, 2, -2, -1.5][i]]; q.sig = Photo.manualSig(); return q; });
      Photo.refineRef(); Photo.computeRef();
      const P = D.dots.map(Photo.toPlane);
      Photo.shapes = [{ type: 'line', done: true, pts: D.dots.map(([x, y]) => { const q = [x, y]; q.sig = 1; return q; }) }];
      Photo.refresh(); Photo.persist();
      return Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]);
    }, D);
    ok(near(d, 1500, 15), 'praticable 2 × 1 m vu en biais : longueur et largeur bien attribuées', d.toFixed(1) + ' mm (attendu 1500 ; l\'ancienne méthode donnait 2999)');
    ok(await p.isVisible('#swapRefBtn'), 'bouton « Inverser longueur / largeur » proposé');
    await p.waitForTimeout(700);
    await p.reload(); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => !!Photo.img && Photo.ref.length === 4 && Photo.shapes.length === 1 && !!Photo.toPlane), 'photo, référence et mesures restaurées après rechargement');
    // Restauration pendant qu'un autre écran est affiché, puis retour sur Photo
    await p.click('[data-screen=plan]'); await p.reload(); await p.waitForTimeout(1200);
    await p.click('[data-screen=photo]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => Photo.view.s > 0 && isFinite(Photo.view.x)), 'photo restaurée sur un autre écran : bien cadrée au retour', await p.evaluate(() => JSON.stringify(Photo.view)));
    // Surface fermée par changement d'outil → proposée au Plan
    await p.evaluate(() => {
      const mk = (x, y) => { const q = [x, y]; q.sig = 1; return q; };
      Photo.shapes.push({ type: 'area', done: false, pts: [mk(1400, 1900), mk(2600, 1900), mk(2600, 2300), mk(1400, 2300)] });
      Photo.tool = 'area';
    });
    await p.click('[data-tool=line]');
    ok(await p.evaluate(() => lastArea && lastArea.label === 'Photo'), 'surface fermée par changement d\'outil : proposée au Plan', await p.evaluate(() => JSON.stringify(lastArea)));
    const parsed = await p.evaluate(() => ['2m50', '1 250 mm', '36 in', '5\'11"', '2,5 m', '92 cm', 'abc', '5’11”', '1 m 20 cm', '2,5 mètres', '83 centimètres'].map((t) => parseLength(t, 'cm')));
    ok(JSON.stringify(parsed.map((v) => (isNaN(v) ? null : Math.round(v * 10) / 10))) === JSON.stringify([2500, 1250, 914.4, 1803.4, 2500, 920, null, 1803.4, 1200, 2500, 830]), 'longueurs saisies comprises (2m50, 1 250 mm, 36 in, 5’11”, 1 m 20 cm, 2,5 mètres…)', JSON.stringify(parsed));
    ok(await p.evaluate(() => fmtLen(5 * 304.8 + 11.999 * 25.4, 'ft', 1)) === '6′ 0,00″', 'pieds-pouces arrondis correctement', await p.evaluate(() => fmtLen(5 * 304.8 + 11.999 * 25.4, 'ft', 1)));
    // Nouvelle photo : confirmation si des mesures ne sont pas enregistrées
    await p.click('#newPhotoBtn');
    ok(await p.textContent('#newPhotoBtn') === 'Confirmer ?' && await p.isVisible('#photoWork'), '« Nouvelle photo » demande confirmation');
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n3. Visée');
  {
    const { ctx, p } = await newPage(b, 'iPhone 13');
    await p.click('[data-screen=height]');
    await p.evaluate(() => Sensors.start());
    await p.fill('#eyeH', '1,50');
    // Hauteur : base à -30°, sommet à +20° → d = 2,598 m, h = 2,445 m
    await orient(p, 0, 60, 0, 10); await p.click('#markBtn'); await orient(p, 0, 60, 0, 40);
    await orient(p, 0, 110, 0, 10); await p.click('#markBtn'); await orient(p, 0, 110, 0, 40);
    let d = parseNum(await p.textContent('#hVal1')), h = parseNum(await p.textContent('#hVal2'));
    ok(near(d, 259.8, 0.5) && near(h, 244.5, 0.5), 'hauteur 2,445 m / distance 2,598 m', `${await p.textContent('#hVal1')} ; ${await p.textContent('#hVal2')} ${await p.textContent('#hTol2')}`);
    await p.fill('#knownD', '2,598');
    h = parseNum(await p.textContent('#hVal2'));
    ok(near(h, 244.5, 0.5), 'distance connue avec virgule', await p.textContent('#hVal2') + ' ' + await p.textContent('#hTol2'));
    // instable : la capture attend
    await p.click('#heightReset');
    await orient(p, 0, 60, 0, 10, 3); await p.click('#markBtn'); await orient(p, 0, 60, 0, 30, 3);
    ok(await p.textContent('#markBtn') === 'Tenez immobile…', 'pas de capture tant que le téléphone bouge');
    await orient(p, 0, 60, 0, 40);
    ok(await p.textContent('#markBtn') === 'Viser le sommet', 'capture dès que c\'est stable');
    // Surface au sol 10×10 m, coins visés dans le désordre
    await p.click('[data-hmode=floor]'); await p.evaluate(() => { Height.shots = []; Height.changed(); });
    await p.fill('#armOff', '0');
    const el = -Math.atan(1.5 / Math.hypot(5, 5)) * 180 / Math.PI;
    for (const hd of [45, 225, 135, 315]) { await orient(p, (360 - hd) % 360, 90 + el, 0, 10); await p.click('#markBtn'); await orient(p, (360 - hd) % 360, 90 + el, 0, 40); }
    const area = parseNum(await p.textContent('#hVal1'));
    ok(near(area, 100, 0.5), 'surface au sol 100 m² malgré l\'ordre de visée', await p.textContent('#hVal1') + ' ' + await p.textContent('#hTol1'));
    ok(await p.isVisible('#shotSketch'), 'croquis vu de dessus affiché');
    await p.screenshot({ path: 'out/r-floor.png' });
    await p.click('#shotUndo');
    ok(await p.evaluate(() => Height.shots.length === 3), 'annuler le dernier point visé');
    // On tourne sur soi-même, téléphone à 0,30 m devant soi : l'objectif est plus près des coins que le pivot
    await p.evaluate(() => { Height.shots = []; Height.changed(); });
    await p.fill('#armOff', '0,30');
    const el2 = -Math.atan(1.5 / (Math.hypot(5, 5) - 0.3)) * 180 / Math.PI;
    for (const hd of [45, 135, 225, 315]) { await orient(p, (360 - hd) % 360, 90 + el2, 0, 10); await p.click('#markBtn'); await orient(p, (360 - hd) % 360, 90 + el2, 0, 40); }
    const area2 = parseNum(await p.textContent('#hVal1'));
    ok(near(area2, 100, 0.5), 'surface au sol juste en tenant compte de l\'écart pivot–téléphone', await p.textContent('#hVal1') + ' ' + await p.textContent('#hTol1'));
    await p.reload(); await p.click('[data-screen=height]');
    ok(await p.evaluate(() => Height.shots.length === 4 && Height.mode === 'floor'), 'points visés conservés après rechargement');
    await p.evaluate(() => Sensors.start());
    await orient(p, 0, 90 + el2, 0, 20);
    await p.click('#markBtn'); await orient(p, 0, 90 + el2, 0, 30);
    ok(await p.evaluate(() => Height.shots.length === 4), 'série d\'avant le redémarrage : pas complétée avec un cap d\'une autre origine');
    // Distance entre 2 points
    await p.evaluate(() => Sensors.start());
    await p.click('[data-hmode=dist]'); await p.evaluate(() => { Height.shots = []; Height.changed(); }); await p.fill('#armOff', '0');
    for (const [hd, r] of [[0, 8], [60, 12]]) { const e = -Math.atan(1.5 / r) * 180 / Math.PI; await orient(p, (360 - hd) % 360, 90 + e, 0, 10); await p.click('#markBtn'); await orient(p, (360 - hd) % 360, 90 + e, 0, 40); }
    d = parseNum(await p.textContent('#hVal1'));
    ok(near(d, 10.583, 0.01), 'distance A–B 10,583 m', await p.textContent('#hVal1') + ' ' + await p.textContent('#hTol1'));
    // La caméra de la Visée n'est jamais demandée depuis un autre écran
    const calls = await p.evaluate(async () => {
      let n = 0; const orig = Height.start.bind(Height); Height.start = () => { n++; return Promise.resolve(); };
      Height.wanted = true;
      show('terrain'); show('plan'); const off = n; show('height'); const on = n; Height.start = orig; return [off, on];
    });
    ok(calls[0] === 0 && calls[1] === 1, 'caméra relancée seulement sur l\'écran Visée', JSON.stringify(calls));
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n4. Outils : niveau et règle');
  {
    const { ctx, p } = await newPage(b, 'iPhone 13');
    await p.click('[data-screen=tools]'); await p.click('[data-tool-screen=level]');
    await orient(p, 0, 0, 2, 40, 0.001);
    ok(await p.textContent('#levelMain') === '2,00°' && (await p.textContent('#levelStable')).includes('stable'), 'surface : 2,00° stable', await p.textContent('#levelMain') + ' ' + await p.textContent('#levelSub'));
    // Calibrage : inclinaison réelle 1°, défaut du capteur 0,4° ; on retourne le téléphone de 180°
    await orient(p, 0, 0, 1.4, 40, 0.001); await p.click('#calibBtn');
    await orient(p, 0, 0, -0.6, 40, 0.001); await p.click('#calibBtn');
    await orient(p, 0, 0, 1.4, 40, 0.001);
    ok(await p.textContent('#levelMain') === '1,00°', 'calibrage par retournement : le défaut de 0,4° est retiré', await p.textContent('#levelMain'));
    ok(await p.evaluate(() => Object.values(Level.calib.edges).every((v) => v === 0)), 'le calibrage de la surface ne touche pas au chant');
    // Inclinaison exacte en biais : X = 30°, Y = 30° → 39,23° (et non 42,43° = hypot)
    await p.evaluate(() => { Level.calib.surface = { x: 0, y: 0 }; });
    await p.evaluate(async () => {
      const t = Math.tan(30 / 57.29578), uz = 1 / Math.sqrt(1 + 2 * t * t), up = [t * uz, t * uz, uz];
      for (let i = 0; i < 40; i++) { Level.update(up, up); await new Promise((r) => setTimeout(r, 5)); }
    });
    ok(parseNum(await p.textContent('#levelMain')) === 39.23, 'inclinaison combinée exacte (39,23° pour 30° + 30°)', await p.textContent('#levelMain'));
    await orient(p, 0, 80, 0, 40, 0.001);
    ok(!(await p.isHidden('#levelEdge')), 'bascule automatique en mode chant');
    ok((await p.textContent('#levelStable')).includes('stable'), 'chant : la moyenne se stabilise (« stable »)');
    // Chant : calibrage propre à chaque chant (défaut de 0,3° posé sur le chant du bas, retourné bout pour bout)
    await p.evaluate(async () => {
      const feed = async (rollDeg) => { const r = rollDeg / 57.29578, up = [Math.sin(r), Math.cos(r), 0.02]; for (let i = 0; i < 30; i++) { Level.update(up, up); await new Promise((q) => setTimeout(q, 5)); } };
      await feed(1.3); document.getElementById('calibBtn').click();
      await feed(-0.7); document.getElementById('calibBtn').click();
      await feed(1.3);
    });
    ok(await p.evaluate(() => Math.abs(Level.calib.edges['0'] - 0.3) < 0.01 && Level.calib.edges['180'] === 0), 'calibrage du chant du bas sans effet sur le chant opposé', await p.evaluate(() => JSON.stringify(Level.calib.edges)));
    ok(await p.textContent('#levelMain') === '1,00°', 'chant calibré : 1,00°', await p.textContent('#levelMain'));
    await p.click('[data-tool-screen=ruler]'); await p.waitForTimeout(300);
    ok(!(await p.isHidden('#rulerCalib')) && (await p.textContent('#rulerPpi')).includes('non calibrée'), 'règle non calibrée : signalée et calibrage proposé');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => 20 + Ruler.calibLen * Ruler.pxmm * 1.15 <= Ruler.h), 'trait de calibrage dans l\'écran', await p.evaluate(() => `${Ruler.calibLen} mm, hauteur ${Math.round(Ruler.h)} px`));
    await p.click('#calibDone');
    const box = await p.locator('#curB').boundingBox();
    const y0 = box.y + box.height / 2, x = box.x + box.width - 25;
    await p.mouse.move(x, y0); await p.mouse.down();
    const vals = [];
    for (let dy = 0; dy <= 80; dy += 4) { await p.mouse.move(x, y0 + dy); vals.push(parseNum(await p.textContent('#rulerVal'))); }
    await p.mouse.up();
    const jumps = vals.slice(1).map((v, i) => v - vals[i]);
    ok(Math.max(...jumps) < 1.5 && jumps.every((j) => j >= 0), 'curseur de règle sans saut, réglage fin puis rapide', vals.map((v) => v.toFixed(1)).join(' '));
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n5. Terrain (carte intégrée)');
  {
    const { ctx, p } = await newPage(b, 'iPhone 13', { geolocation: { latitude: 48.85296, longitude: 2.3501, accuracy: 4 }, permissions: ['geolocation'] });
    await p.click('[data-screen=terrain]');
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => Terrain.map && Terrain.map.loaded > 0), 'carte affichée (tuiles chargées)');
    // rectangle 100 m × 60 m
    const c = [48.85296, 2.3501], dLat = 30 / 111320, dLon = 50 / (111320 * Math.cos(c[0] / 57.29578));
    await p.evaluate(([c]) => Terrain.map.setView(c, 17), [c]);
    await p.waitForTimeout(200);
    const scr = (ll) => p.evaluate((ll) => { const r = Terrain.map.canvas.getBoundingClientRect(); const s = Terrain.map.toScreen(ll); return [s[0] + r.left, s[1] + r.top]; }, ll);
    const corners = [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([a, o]) => [c[0] + a * dLat, c[1] + o * dLon]);
    for (const ll of corners) { const [x, y] = await scr(ll); await p.mouse.click(x, y); }
    let A = await p.evaluate(() => Terrain.result().area);
    ok(near(A, 6000, 60), 'parvis 100 × 60 m = 6 000 m² (posé au doigt)', A.toFixed(1) + ' m² ' + await p.textContent('#tTol1'));
    // insérer un point au milieu d'un côté
    const m = await p.evaluate(() => { const S = Terrain.pts.map((q) => Terrain.map.toScreen(q)); const r = Terrain.map.canvas.getBoundingClientRect(); return [(S[0][0] + S[1][0]) / 2 + r.left, (S[0][1] + S[1][1]) / 2 + r.top]; });
    await p.mouse.move(m[0], m[1]); await p.mouse.down(); await p.mouse.move(m[0] - 20, m[1], { steps: 5 }); await p.mouse.up();
    ok(await p.evaluate(() => Terrain.pts.length === 5), 'poignée « + » : point inséré et déplacé');
    await p.click('#tUndo');
    ok(await p.evaluate(() => Terrain.pts.length === 4), 'retirer le point sélectionné');
    A = await p.evaluate(() => Terrain.result().area);
    ok(near(A, 6000, 60), 'surface revenue à 6 000 m²', A.toFixed(1));
    // déplacer un sommet : glissement démultiplié
    const v = await scr(await p.evaluate(() => [Terrain.pts[2][0], Terrain.pts[2][1]]));
    await p.mouse.move(v[0], v[1]); await p.mouse.down(); await p.mouse.move(v[0] + 40, v[1], { steps: 8 }); await p.mouse.up();
    const moved = await scr(await p.evaluate(() => [Terrain.pts[2][0], Terrain.pts[2][1]]));
    ok(near(moved[0] - v[0], 20, 2), 'sommet déplacé de moitié du geste (précision)', (moved[0] - v[0]).toFixed(1) + ' px');
    // zoom et déplacement
    const z0 = await p.evaluate(() => Terrain.map.zoom);
    await p.click('#mapZoomIn'); await p.click('#mapZoomIn');
    ok(await p.evaluate((z0) => Terrain.map.zoom === Math.round(z0) + 2, z0), 'boutons de zoom');
    await p.click('#mapFit');
    ok(await p.evaluate(() => Terrain.pts.every((q) => { const s = Terrain.map.toScreen(q); return s[0] > 0 && s[1] > 0 && s[0] < Terrain.map.w && s[1] < Terrain.map.h; })), 'cadrer toute la forme');
    const ctr = await p.evaluate(() => [...Terrain.map.center]);
    const bb = await p.locator('.map-canvas').boundingBox();
    await p.mouse.move(bb.x + 60, bb.y + 60); await p.mouse.down(); await p.mouse.move(bb.x + 160, bb.y + 110, { steps: 6 }); await p.mouse.up();
    ok(await p.evaluate((c0) => Terrain.map.center[1] < c0[1] && Terrain.pts.length === 4, ctr), 'glisser déplace la carte sans poser de point');
    // mode distance
    await p.click('[data-tmode=line]');
    const [len, exp] = await p.evaluate(() => [Terrain.result().len / 1000, geoLen(Terrain.pts, false)]);
    ok(near(len, exp, 0.01) && near(len, 260, 30), 'mode distance (ligne brisée, 3 côtés)', len.toFixed(2) + ' m');
    await p.click('[data-tmode=area]');
    // point GPS moyenné
    await p.click('#mapLocate'); await p.waitForTimeout(500);
    await p.click('#gpsPoint');
    await p.waitForTimeout(10500);
    ok(await p.evaluate(() => Terrain.pts.length === 5 && Terrain.pts[4].src === 'gps'), 'point GPS moyenné ajouté', await p.evaluate(() => JSON.stringify({ n: Terrain.pts.length, last: Terrain.pts[Terrain.pts.length - 1], src: Terrain.pts.map((q) => q.src), toast: document.getElementById('toast').textContent, btn: document.getElementById('gpsPoint').textContent })));
    await p.screenshot({ path: 'out/r-terrain.png' });
    await p.click('[data-screen=plan]');
    ok(await p.evaluate(() => Terrain.watchId === null), 'GPS arrêté en quittant l\'onglet Terrain');
    await p.click('[data-screen=terrain]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => Terrain.watchId !== null), 'GPS relancé au retour sur Terrain');
    // persistance
    await p.reload(); await p.waitForTimeout(800);
    ok(await p.evaluate(() => Terrain.pts.length === 5 && Terrain.pts[4].src === 'gps'), 'points conservés après redémarrage');
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n6. Plan');
  {
    const { ctx, p } = await newPage(b, 'iPhone 13');
    await p.click('[data-screen=plan]');
    await p.fill('#planName', 'Église test');
    await p.click('#addPiece');
    let ids = await p.$$eval('.piece-fields input', (l) => l.map((i) => i.id));
    await p.fill('#' + ids[0], '30'); await p.fill('#' + ids[1], '12,5'); await p.fill('#' + ids[2], '18');
    await p.selectOption('#pieceType', 'half'); await p.click('#addPiece');
    ids = await p.$$eval('.piece-fields input', (l) => l.map((i) => i.id));
    await p.fill('#' + ids[3], '12,5');
    await p.selectOption('#pieceType', 'rect'); await p.click('#addPiece');
    ids = await p.$$eval('.piece-fields input', (l) => l.map((i) => i.id));
    await p.fill('#' + ids[5], '1'); await p.fill('#' + ids[6], '1');
    await p.click('.piece:nth-child(3) .piece-opts .btn:nth-child(1)'); // retirée
    for (let i = 0; i < 5; i++) await p.click('.piece:nth-child(3) .piece-opts .btn:nth-child(2)'); // × 6 piliers
    const exp = 30 * 12.5 + Math.PI * 12.5 * 12.5 / 8 - 6;
    ok(near(parseNum(await p.textContent('#planArea')), exp, 0.11), 'surface nef + abside − 6 piliers', await p.textContent('#planArea') + ` (attendu ${exp.toFixed(1)})`);
    ok((await p.textContent('#planVol')).includes('incomplet'), 'volume signalé incomplet sans hauteur pour l\'abside');
    await p.fill('#ceilH', '12');
    const vexp = 30 * 12.5 * 18 + (Math.PI * 12.5 * 12.5 / 8) * 12 - 6 * 12;
    ok(near(parseNum((await p.textContent('#planVol')).replace(/\s/g, '')), vexp, 1), 'volume avec hauteur par forme', await p.textContent('#planVol') + ` (attendu ${vexp.toFixed(0)})`);
    await p.reload(); await p.click('[data-screen=plan]');
    ok(await p.evaluate(() => Plan.data.pieces.length === 3) && await p.inputValue('#planName') === 'Église test', 'plan conservé après redémarrage');
    await p.click('#planSave'); await p.click('#sheetOk');
    ok(await p.evaluate(() => History.items[0].kind.startsWith('Plan')), 'plan enregistré dans les mesures');
    await p.screenshot({ path: 'out/r-plan.png' });
    const json = await p.evaluate(() => exportData());
    const data = JSON.parse(json);
    ok(data.app === 'Toise' && Array.isArray(data.keys.history) && data.keys.plan, 'export complet des données');
    data.keys.history.push({ id: 42, kind: 'Test', value: '<img src=x onerror=alert(1)>', note: 'n', date: '2026-01-01T00:00:00Z', img: 'javascript:alert(1)' });
    fs.writeFileSync('out/import.json', JSON.stringify(data));
    await p.click('[data-screen=history]');
    await p.setInputFiles('#importFile', 'out/import.json'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => { const i = History.items.find((x) => x.id === 42); return i && i.img === null && !document.querySelector('#histList img[src="x"]'); }), 'import : mesures ajoutées, contenu dangereux neutralisé');
    data.keys.ppi = 1e9; data.keys.levelCalib3 = { surface: { x: 'a' }, edges: null }; data.keys.plan = { pieces: 'x' }; data.app = 'Toise';
    fs.writeFileSync('out/import2.json', JSON.stringify(data));
    await p.setInputFiles('#importFile', 'out/import2.json'); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => Ruler.ppi < 300 && Level.calib.surface.x === 0 && Array.isArray(Plan.data.pieces)), 'import piégé (échelle, calibrage, plan) : valeurs refusées, l\'app démarre');
    ok(p.errs.length === 0, 'aucune erreur', p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n7. Hors ligne et mises à jour (service worker, serveur local)');
  {
    const { execSync, spawn } = require('child_process');
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toise-sw-'));
    execSync(`cp -r ${path.resolve(__dirname, '..')}/{index.html,styles.css,app.js,sw.js,manifest.webmanifest,icons} ${dir}/`, { shell: '/bin/bash' });
    const port = 8700 + Math.floor(Math.random() * 200);
    const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 800));
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const base = `http://127.0.0.1:${port}/`;
    await p.goto(base); await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 8000))])); await p.waitForTimeout(1500);
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker actif');
    // Déploiement simulé : nouvelle page ET nouveau script (la page sait l'écrire, le script la lit)
    fs.writeFileSync(path.join(dir, 'app.js'), fs.readFileSync(path.join(dir, 'app.js'), 'utf8') + "\nwindow.TOISE_V2 = !!document.getElementById('v2');\n");
    fs.writeFileSync(path.join(dir, 'index.html'), fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('<main>', '<main><i id="v2" hidden></i>'));
    await p.waitForTimeout(31000);   // le service worker vérifie les mises à jour au plus toutes les 30 s
    await p.reload(); await p.waitForTimeout(2500);
    const mixed1 = await p.evaluate(() => ({ v2js: window.TOISE_V2 !== undefined, v2html: !!document.getElementById('v2') }));
    ok(mixed1.v2js === mixed1.v2html, 'jamais d\'ancienne page avec le nouveau script (ou l\'inverse)', JSON.stringify(mixed1));
    ok(await p.isVisible('#toast') && (await p.textContent('#toast')).includes('Nouvelle version'), 'nouvelle version annoncée', await p.textContent('#toast'));
    await p.click('#toast'); await p.waitForTimeout(2000);
    const after = await p.evaluate(() => ({ v2js: window.TOISE_V2, v2html: !!document.getElementById('v2') }));
    ok(after.v2js === true && after.v2html, 'après rechargement : nouvelle version complète', JSON.stringify(after));
    // Hors connexion : l'app s'ouvre depuis le cache
    srv.kill(); await new Promise((r) => setTimeout(r, 300));
    await p.reload(); await p.waitForTimeout(1000);
    ok(await p.evaluate(() => document.title === 'Toise' && typeof Photo === 'object'), 'ouverture hors connexion');
    ok(errs.length === 0, 'aucune erreur', errs.join(' | '));
    await ctx.close();
  }

  console.log(`\n${fails ? '✘ ' + fails + ' échec(s)' : '✔ Tous les tests passent'}`);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
