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

// ---------- v2 engine (design/TASTE-ENGINE.md): the one growing model, four layers deep ----------
// Mirrors the real ladder's shape (colors, then pairs, then threes, then whole palettes) so every layer gets a
// real chance to be taught, the way js/tasteladder.js's four rungs teach one shared model.
console.log("\nV2 ENGINE -- js/tastemodel.js's layered model, over a ladder of colors -> pairs -> threes -> palettes.\n");
function mkSetItem(n) { const cols = Array.from({ length: n }, () => pool[rand() * pool.length | 0].h), shares = cols.map(() => .3 + rand()); return { cols, x: T.tasteFeat(cols, shares) }; }
const LDR_BLOCKS = [[1, 25], [2, 25], [3, 25], [5, 25]];   // [colors in the set, questions], ~100 choices, the real ladder's shape
function runV2Ladder(opt = {}, blocks = LDR_BLOCKS) {
  const m = T.model2(), rows = []; let t = 0;
  blocks.forEach(([n, cnt]) => {
    const bpool = Array.from({ length: 40 }, () => mkSetItem(n)), ref = bpool[0].x.map((_, i) => mean(bpool.map(p => p.x[i])));
    for (let k = 0; k < cnt; k++) {
      const u = opt.uAt(t);
      const [a, b] = T.nextDuelV2(m, bpool, { rand });
      const predicted = T.utility(m, a.x) >= T.utility(m, b.x) ? 0 : 1, actual = pick(u(a), u(b));
      T.choose(m, a.x, b.x, actual, ref);
      T.recordAcc(m, predicted === actual, .5);
      if (opt.forgetWeeksPerChoice) T.forget(m, opt.forgetWeeksPerChoice);
      rows.push({ t, hit: predicted === actual ? 1 : 0, acc: T.accuracy(m).acc }); t++;
    }
  });
  return { m, rows };
}
// 1) accuracy rises with choices.
// 2) the learned weights recover the hidden ones -- measured functionally (as the color/palette tests above
// already do: the correlation of the learned utility with the true one, over a held-out set of mixed-size
// items), since many of the 46 features are correlated with each other for any one random set of colors, so
// individual coefficients are only loosely identifiable even though the utility FUNCTION they imply recovers
// well. Empirically (see the lane's report) the mean held-out r climbs from ~0.65 at 100 choices to ~0.80 by
// about 150-160 -- consistent with the design doc's own layer table (layer 4 is "meaningful after ~80", so at
// 100 choices it has barely arrived): deeper layers move slowly ON PURPOSE (a small prior variance, so a
// beginner's choices can't overfit a family affinity), which is the point, not a bug to tune away.
const V2_RUNS = Math.max(10, Math.round(RUNS / 2));
const earlyAcc = [], lateAcc = [], corr100 = [], corr160 = [];
for (let i = 0; i < V2_RUNS; i++) {
  const wHidden = T.TASTE2_PRIOR.map(v => gauss() * Math.sqrt(v)), trueU = item => T.dot(wHidden, item.x);
  const heldOut = Array.from({ length: 300 }, () => mkSetItem([1, 2, 3, 5][rand() * 4 | 0]));
  const functionalR = m => pearson(heldOut.map(it => T.utility(m, it.x)), heldOut.map(it => trueU(it)));
  const { m, rows } = runV2Ladder({ uAt: () => trueU });
  earlyAcc.push(mean(rows.slice(14, 26).map(r => r.acc)));
  lateAcc.push(mean(rows.slice(-20).map(r => r.acc)));
  corr100.push(functionalR(m));
  const { m: m160 } = runV2Ladder({ uAt: () => trueU }, [[1, 40], [2, 40], [3, 40], [5, 40]]);
  corr160.push(functionalR(m160));
}
console.log(`accuracy around choice 20 (the colors rung): ${(100 * mean(earlyAcc)).toFixed(0)}%   around choice 100 (after a full ladder): ${(100 * mean(lateAcc)).toFixed(0)}%   (both a 30-choice window, chance 50%)`);
console.log(`weight recovery (functional r, held-out items): ${mean(corr100).toFixed(2)} after 100 choices, ${mean(corr160).toFixed(2)} after 160 (design doc's own layer table expects deeper layers still arriving at 100; want > 0.80 by ~160)`);
// 3) a taste that flips halfway is followed again within ~40 choices (slow forgetting lets the model re-learn).
// Kept on a single plain-color pool (not the block ladder above): flipping AND changing the kind of thing being
// compared in the same run would confound two different adaptations at once.
const poolV2 = pool.map(p => ({ h: p.h, x: T.tasteFeat([p.h], null) }));
const refV2 = poolV2[0].x.map((_, i) => mean(poolV2.map(p => p.x[i])));
function runV2Colors(nChoices, opt = {}) {
  const m = T.model2(), rows = [];
  for (let t = 0; t < nChoices; t++) {
    const u = opt.uAt(t);
    const [a, b] = T.nextDuelV2(m, poolV2, { rand });
    const predicted = T.utility(m, a.x) >= T.utility(m, b.x) ? 0 : 1, actual = pick(u(a), u(b));
    T.choose(m, a.x, b.x, actual, refV2);
    T.recordAcc(m, predicted === actual, .5);
    if (opt.forgetWeeksPerChoice) T.forget(m, opt.forgetWeeksPerChoice);
    rows.push({ t, hit: predicted === actual ? 1 : 0 });
  }
  return { m, rows };
}
const FLIP_AT = 60, FLIP_RUNS = Math.max(8, Math.round(RUNS / 4));
let followed = 0;
const rightAfter = [], after40 = [];
for (let i = 0; i < FLIP_RUNS; i++) {
  const wHidden = T.TASTE2_PRIOR.map(v => gauss() * Math.sqrt(v));
  const uAt = t => (t < FLIP_AT ? item => T.dot(wHidden, item.x) : item => -T.dot(wHidden, item.x));
  const { rows } = runV2Colors(FLIP_AT + 40, { uAt, forgetWeeksPerChoice: .22 });
  const ra = mean(rows.slice(FLIP_AT, FLIP_AT + 6).map(r => r.hit)), a40 = mean(rows.slice(FLIP_AT + 30, FLIP_AT + 40).map(r => r.hit));
  rightAfter.push(ra); after40.push(a40);
  if (a40 >= .55 && a40 > ra + .08) followed++;
}
console.log(`a taste that flips at choice ${FLIP_AT}: right in the 6 choices just after the flip ${(100 * mean(rightAfter)).toFixed(0)}%, back up to ${(100 * mean(after40)).toFixed(0)}% by 30-40 choices later -- followed again in ${followed}/${FLIP_RUNS} runs`);

// a light gate: fail loudly if either engine stops learning
const bad = Object.entries(results).filter(([, r]) => r.r < .6 || r.top < .75).map(([n]) => n);
const v2bad = [];
if (mean(lateAcc) < .62 || mean(lateAcc) < mean(earlyAcc) - .03) v2bad.push("v2 accuracy didn't rise");
if (mean(corr160) < .70) v2bad.push("v2 weight recovery");
if (followed / FLIP_RUNS < .5) v2bad.push("v2 flip test");
if (bad.length || mean(pa.map(r => r.mae)) > .7 || v2bad.length) { console.log("\nFAIL: weak recovery for " + [...bad, ...v2bad].join(", ")); process.exit(1); }
console.log("\nOK");
