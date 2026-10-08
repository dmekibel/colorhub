// Tests for Across the line (ooLineRound in js/games/oo-engine.js). Run: node tools/line_test.js
// Over 500 seeded rounds against the real ~1,000 core names (nearest name by CIEDE2000, as nameOf does):
// every in tile names the category and the odd tile names the neighbor; odd vs trap is visible as drawn
// (>= 0.3, accuracy.js SHOWN_MIN); the trap condition (some in-name pair further apart than odd vs trap) holds
// in at least 80% of rounds; a seed always gives the same round; no round needs more than 30 tries.
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- percent display"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
Object.assign(global, new Function("clamp", math + "\nreturn { rgb, lab, lch, labRgb, inGamut, labHex, lchHex, de2000 };")(clamp), { clamp });
const E = require("../js/games/oo-engine.js");
const names = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/core-names.json"), "utf8")).map(e => ({ n: e.n, h: e.h, L: lab(e.h) }));
// nearest names: a Euclidean pre-filter, then CIEDE2000 on the close ones (same answer as a full scan here)
const cache = new Map();
function namer(hex) {
  if (cache.has(hex)) return cache.get(hex);
  const L = lab(hex), eu = names.map(x => [x, Math.hypot(x.L[0] - L[0], x.L[1] - L[1], x.L[2] - L[2])]).sort((a, b) => a[1] - b[1]);
  const near = eu.slice(0, 24).map(([x]) => ({ n: x.n, h: x.h, de: de2000(L, x.L) })).sort((a, b) => a.de - b.de);
  const r = { n: near[0].n, de: near[0].de, near };
  cache.set(hex, r);
  return r;
}
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; if (fails < 20) console.log("FAIL  " + m); } };
const cats = names.filter((x, i) => i % 7 === 0).slice(0, 120);
const stats = {};
let made = 0, trapOk = 0, maxTries = 0;
const t0 = Date.now();
for (let s = 0; s < 500; s++) {
  const p = [5, 4, 3, 2.2, 1.6, 1][s % 6], r = E.ooLineRound(E.ooRnd(1000 + s), { p, k: s % 2 ? 4 : 6, cats, namer, stats });
  if (!r) continue;
  made++;
  maxTries = Math.max(maxTries, r.tries);
  ok(r.colors.every((h, i) => i === r.at ? namer(h).n === r.nb : namer(h).n === r.cat), `round ${s}: every in tile is ${r.cat}, the odd one ${r.nb}`);
  ok(r.nb !== r.cat, `round ${s}: the odd tile's name differs`);
  ok(de2000(r.colors[r.at], r.colors[r.trap]) >= .3, `round ${s}: odd vs trap is visible as drawn`);
  ok(Math.abs(r.act - p) <= p * .2 + .1, `round ${s}: odd vs trap is about p (${r.act.toFixed(2)} vs ${p})`);
  if (r.trapOk) trapOk++;
}
console.log(`Across the line: ${made} of 500 rounds drawn in ${((Date.now() - t0) / 1000).toFixed(1)} s; trap condition in ${(trapOk / made * 100).toFixed(0)}%; most tries ${maxTries}; rejections ${JSON.stringify(stats)}`);
ok(made >= 480, "almost every seed should give a round");
ok(trapOk / made >= .8, "the trap condition should hold in at least 80% of rounds");
ok(maxTries <= 30 * 12, "tries are bounded");
const a = JSON.stringify(E.ooLineRound(E.ooRnd(77), { p: 4, k: 4, cats, namer })), b = JSON.stringify(E.ooLineRound(E.ooRnd(77), { p: 4, k: 4, cats, namer }));
ok(a === b, "a seed gives the same round");
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
