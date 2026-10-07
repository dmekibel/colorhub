// Simulated users for the taste engine (js/tastemodel.js). Run: node tools/taste_sim.js
// A simulated person with a known preference answers ~20 "which do you prefer?" pairs, choosing noisily
// (Bradley-Terry: P(a) = sigmoid(u(a) - u(b))). We check that the engine recovers the preference, and compare
// the engine's pair picking with random pairs.
const fs = require("fs"), path = require("path");
// the app's color math, straight from js/core.js
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- data index"));
Object.assign(global, new Function(`const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n${math}\nreturn { clamp, rgb, lab, lch, labRgb, inGamut, labHex, lchHex, de2000 };`)());
const T = require("../js/tastemodel.js");

const N_CHOICES = 20, RUNS = +process.argv[2] || 40;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
function pearson(x, y) { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; c += (y[i] - my) ** 2; }); return a / Math.sqrt(b * c); }
let seed = 12345; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const pick = (ua, ub) => rand() < T.sig(ua - ub) ? 0 : 1;

// ---------- colors ----------
const pool = T.colorPool(), grid = T.colorGrid();
const ref = pool[0].x.map((_, i) => mean(pool.map(p => p.x[i])));
const bump = (H, at, w) => Math.exp(-((T.hueDist(H, at) / w) ** 2));
const PERSONAS = {
  // outside the model's own form, on purpose
  "deep cool blues to teal, no yellow-green": c => { const s = Math.min(1, c.C / 30); return 3.2 * bump(c.H, 225, 45) * s - 2 * bump(c.H, 110, 30) * s - ((c.L - 40) / 22) ** 2; },
  "warm and pale (peach, butter, pink)": c => { const s = Math.min(1, c.C / 30); return 2.5 * bump(c.H, 55, 50) * s + ((c.L - 60) / 18) - .5 * ((c.C - 30) / 20) ** 2; },
  "greys and muted colors": c => -2.2 * c.C / 40 - ((c.L - 55) / 30) ** 2,
};
function runColor(trueU, active) {
  const m = T.model(T.COLOR_PRIOR), recent = [];
  for (let t = 0; t < N_CHOICES; t++) {
    const [a, b] = active ? T.nextPair(m, pool, { rand, skip: new Set(recent), ok: (a, b) => de2000(a.h, b.h) > (t < 8 ? 18 : 10) })
      : [pool[rand() * pool.length | 0], pool[rand() * pool.length | 0]];
    T.choose(m, a.x, b.x, pick(trueU(a), trueU(b)), ref);
    recent.push(a, b); if (recent.length > 6) recent.splice(0, 2);
  }
  const est = grid.map(g => T.utility(m, g.x)), tru = grid.map(trueU);
  const sorted = tru.slice().sort((x, y) => x - y), pct = v => sorted.filter(s => s < v).length / sorted.length;
  const ex = T.extremes(m, grid), top = grid.indexOf(ex.top), low = grid.indexOf(ex.low);
  return { r: pearson(est, tru), top: pct(tru[top]), low: pct(tru[low]) };
}
function summary(rows) { return `r = ${mean(rows.map(r => r.r)).toFixed(2)}   top pick at ${(100 * mean(rows.map(r => r.top))).toFixed(0)}th pct   bottom pick at ${(100 * mean(rows.map(r => r.low))).toFixed(0)}th pct`; }
console.log(`COLOR — ${N_CHOICES} choices, ${RUNS} runs each. r = correlation of the learned map with the true one over ${grid.length} colors;`);
console.log("the true percentile of the color we call the favorite (want ~100) and the least favorite (want ~0).\n");
const randLinear = () => { const w = T.COLOR_PRIOR.map(v => gauss() * Math.sqrt(v)); return c => T.dot(w, c.x); };
const all = { ...PERSONAS, "random users (inside the model's form)": null };
const results = {};
for (const [name, fn] of Object.entries(all)) {
  const act = [], rnd = [];
  for (let i = 0; i < RUNS; i++) { const u = fn || randLinear(); act.push(runColor(u, true)); rnd.push(runColor(u, false)); }
  results[name] = { act: summary(act), rnd: summary(rnd), r: mean(act.map(x => x.r)), top: mean(act.map(x => x.top)) };
  console.log(name); console.log("  active pairs: " + results[name].act); console.log("  random pairs: " + results[name].rnd);
}

// ---------- palettes ----------
console.log(`\nPALETTE — ${N_CHOICES} choices, ${RUNS} runs. The simulated person has an ideal amount on each dial (z, -1.5..1.5) and an importance;`);
console.log("we compare the dial readout with their ideal on the dials that matter to them (importance >= .6).\n");
function runPal(active) {
  const ideal = T.DIALS.map(() => (rand() * 2 - 1) * 1.5), imp = T.DIALS.map(() => .2 + rand() * 1.3);
  const trueU = p => -p.z.reduce((s, z, k) => s + imp[k] * (clamp(z, -2.5, 2.5) - ideal[k]) ** 2, 0) / 2;
  const m = T.model(T.PAL_PRIOR), asked = [], zero = T.palFeat(T.DIALS.map(() => 0));
  for (let t = 0; t < N_CHOICES; t++) {
    let k, pair;
    if (active) ({ k, pair } = T.nextPalPair(m, asked, rand));
    else { k = rand() * 6 | 0; const base = T.DIALS.map(() => (rand() - .5) * 2), s = rand() * 1e9 | 0, ta = base.slice(), tb = base.slice(); ta[k] = (rand() - .5) * 3.6; tb[k] = (rand() - .5) * 3.6; pair = [T.genPalette(ta, s), T.genPalette(tb, s)]; }
    asked.push(k);
    T.choose(m, pair[0].x, pair[1].x, pick(trueU(pair[0]), trueU(pair[1])), zero);
  }
  const read = T.dialRead(m), errs = [];
  read.forEach((r, k) => { if (imp[k] >= .6) errs.push(Math.abs(r.z - ideal[k])); });
  const signs = read.map((r, k) => imp[k] >= .6 && Math.abs(ideal[k]) > .6 ? (Math.sign(r.z) === Math.sign(ideal[k]) ? 1 : 0) : null).filter(v => v != null);
  return { mae: mean(errs.length ? errs : [0]), sign: signs.length ? mean(signs) : 1, asked };
}
const pa = [], pr = [];
for (let i = 0; i < RUNS; i++) { pa.push(runPal(true)); pr.push(runPal(false)); }
const ps = rows => `mean dial error ${mean(rows.map(r => r.mae)).toFixed(2)} z (scale -2..2; guessing the middle ≈ .75)   right side of center ${(100 * mean(rows.map(r => r.sign))).toFixed(0)}%`;
console.log("  active pairs: " + ps(pa)); console.log("  random pairs: " + ps(pr));
const cover = T.DIALS.map((d, k) => `${d.k} ${mean(pa.map(r => r.asked.filter(x => x === k).length)).toFixed(1)}`).join(", ");
console.log("  rounds per dial (active): " + cover);

// a light gate: fail loudly if the engine stops learning
const bad = Object.entries(results).filter(([, r]) => r.r < .6 || r.top < .75).map(([n]) => n);
if (bad.length || mean(pa.map(r => r.mae)) > .7) { console.log("\nFAIL: weak recovery for " + (bad.join(", ") || "palettes")); process.exit(1); }
console.log("\nOK");
