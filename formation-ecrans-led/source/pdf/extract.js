const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
function grab(marker, from = 0) {
  const i = js.indexOf(marker, from); if (i < 0) throw new Error('absent: ' + marker);
  let j = i + marker.length - 1; const open = js[j], close = open === '[' ? ']' : '}';
  let depth = 0, q = null;
  for (let k = j; k < js.length; k++) {
    const c = js[k];
    if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === open) depth++; else if (c === close) { depth--; if (!depth) return [(0, eval)('(' + js.slice(j, k + 1) + ')'), k]; }
  }
}
const out = {};
out.MQ = grab('var MQ = {')[0];
out.MQX = grab('var MQX = {')[0];
out.FQX = grab('var FQX = [')[0];
out.FQ0 = grab('var FQ = [')[0];
out.chain = grab('var C = [')[0];
out.scen = grab('var S = [')[0];
out.order = grab('var R = [')[0];
out.T = grab('var T = {')[0];
out.L = grab('var L = {')[0];
if (process.argv[3] === '-') process.stdout.write(JSON.stringify(out)); else fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
