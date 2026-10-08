// Fetched-file gate: every data/art/og/img file a js/*.js file names, and every script/link tag in index.html, must exist.
// A rebuild once deleted data/analysis/*.json silently and color pages lost whole sections (design/audit-graph/CHECKPOINT.md §1).
// Same scan as design/audit-graph/atlas.js section 2. Run alone or from tools/check.js.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), R = p => path.join(ROOT, p), ex = p => fs.existsSync(R(p));
const ls = d => { try { return fs.readdirSync(R(d)); } catch (e) { return []; } };
function checkFetched() {
  const miss = [], seen = new Set();
  for (const f of fs.readdirSync(R("js")).filter(f => f.endsWith(".js"))) {
    const s = fs.readFileSync(R("js/" + f), "utf8");
    const re = /["'`]((?:data|art|og|img|c|p)\/[A-Za-z0-9_\-\/.${}]*?\.(?:json|js|png|jpg|webp|svg))["'`]/g;
    let m;
    while ((m = re.exec(s))) {
      const p = m[1]; if (seen.has(p)) continue; seen.add(p);
      if (!p.includes("${")) { if (!ex(p)) miss.push(`${p} (js/${f})`); continue; }
      const dir = path.dirname(p.split("${")[0] + "x"), pat = new RegExp("^" + path.basename(p).replace(/[.]/g, "\\.").replace(/\$\{[^}]*\}/g, ".+") + "$");
      if (!ex(dir) || (!p.slice(dir.length + 1).includes("/") && !ls(dir).some(x => pat.test(x)))) miss.push(`${p} (js/${f}; nothing matches in ${dir}/)`);
    }
  }
  const html = fs.readFileSync(R("index.html"), "utf8");
  for (const m of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))/g)) if (!/^https?:/.test(m[1]) && !ex(m[1])) miss.push(`${m[1]} (index.html)`);
  return miss;
}
if (require.main === module) { const m = checkFetched(); m.forEach(x => console.log("FAIL  missing fetched file: " + x)); console.log(`fetched-file gate: ${m.length} missing`); process.exit(m.length ? 1 : 0); }
module.exports = { checkFetched };
