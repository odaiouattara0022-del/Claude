// Extrait les données de la formation et les missions du simulateur en JSON.
// Usage (depuis formation-reseau-av/) : node source/pdf/extract.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const s = fs.readFileSync(path.join(root, 'regie-ip-lab.html'), 'utf8');
const code = s.slice(s.indexOf('const MISSIONS=['), s.indexOf('const FAULTS=')).replace('const MISSIONS=', 'MISSIONS=');
let MISSIONS; const S = {flags: {}, faults: [], dirty: {}}, R = () => ({}), C = () => ({}), acc = () => 0, vn = () => 0,
  noIssue = () => 0, services = () => [], snoopOn = () => 0, allowedHas = () => 0;
eval(code);
fs.writeFileSync(path.join(__dirname, 'missions.json'), JSON.stringify(MISSIONS.map(m => ({title: m.title, dev: m.dev, goal: m.goal, steps: m.steps.map(x => x[0]), sol: m.sol}))));
eval(fs.readFileSync(path.join(root, 'source', 'data.js'), 'utf8').replace(/^const /gm, 'global.'));
fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify({DOMAINES, MODS, DIAG, PIEGES_EXTRA, ANTI, PRATIQUE, QCM, CARTES, PANNES}));
console.log('data.json et missions.json écrits');
