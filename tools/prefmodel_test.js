// Tests for the preference model (js/prefmodel.js). Run: node tools/prefmodel_test.js
// A simulated person with known utilities answers noisily (Bradley-Terry). We check that every way of ranking
// converges on the true order, that best-of-three yields exactly the right comparisons, that adaptive questions beat
// random ones, that confidence rises as the order settles, and that undo restores a belief exactly.
const P = require("../js/prefmodel.js");
let seed = 20261008; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log("FAIL  " + msg); } else console.log("ok    " + msg); };
const rankArr = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]), r = []; o.forEach(([, i], k) => r[i] = k); return r; };
function spearman(x, y) { const a = rankArr(x), b = rankArr(y), n = a.length; let d = 0; for (let i = 0; i < n; i++) d += (a[i] - b[i]) ** 2; return 1 - 6 * d / (n * (n * n - 1)); }
const mkWorld = n => { const keys = Array.from({ length: n }, (_, i) => "#" + (0x100000 + i * 7919).toString(16).toUpperCase().padStart(6, "0")); const u = keys.map(() => gauss() * 2.2); return { keys, u, U: k => u[keys.indexOf(k)] }; };
const choose = (w, a, b) => rand() < P.sig(w.U(a) - w.U(b)) ? a : b;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

// 1. best-of-three yields the right comparisons
{
  const t = ["a", "b", "c"], pr = P.bwsPairs(t, "b", "c");
  ok(JSON.stringify(pr) === JSON.stringify([["b", "a"], ["b", "c"], ["a", "c"]]), "best-of-three: keep b, drop c gives b>a, b>c, a>c");
  ok(P.bwsPairs(t, "a", "a").length === 0, "best-of-three: same color kept and dropped yields nothing");
}

// 2. adaptive best-of-three converges, and beats random triples
function runBws(n, sets, adaptive) {
  const w = mkWorld(n), st = {}, skip = new Set();
  for (let s = 0; s < sets; s++) {
    let tr;
    if (adaptive) { tr = P.nextTriple(st, w.keys, { rand, skip }); }
    else { const idx = new Set(); while (idx.size < 3) idx.add((rand() * n) | 0); tr = [...idx].map(i => w.keys[i]); }
    // best = the winner of the triple under noisy choice, worst = the loser
    let best = tr[0]; tr.forEach(k => { if (k !== best && choose(w, k, best) === k) best = k; });
    const rest = tr.filter(k => k !== best); const worst = choose(w, rest[0], rest[1]) === rest[0] ? rest[1] : rest[0];
    P.applyPairs(st, P.bwsPairs(tr, best, worst));
    skip.add(P.pairId(tr[0], tr[1])); if (skip.size > 12) skip.delete(skip.values().next().value);
  }
  const m = w.keys.map(k => P.mean(st, k));
  return { rho: spearman(m, w.u), conf: P.confidence(st, w.keys) };
}
{
  const R = 30, A = [], B = [], CA = [];
  for (let r = 0; r < R; r++) { const a = runBws(20, 30, true), b = runBws(20, 30, false); A.push(a.rho); B.push(b.rho); CA.push(a.conf); }
  console.log(`      20 colors, 30 sets (60 taps): adaptive rho ${mean(A).toFixed(3)}, random rho ${mean(B).toFixed(3)}, confidence ${mean(CA).toFixed(2)}`);
  ok(mean(A) > .85, "best-of-three converges: rank correlation with the true order > .85 after 30 sets (20 colors)");
  ok(mean(A) > mean(B), "adaptive triples beat random triples");
}
{
  const early = runBws(20, 2, true).conf, late = runBws(20, 40, true).conf;
  ok(early < .3, `confidence starts low (${early.toFixed(2)})`);
  ok(late > .5, `confidence rises as the order settles (${late.toFixed(2)})`);
  ok(P.confidence({}, ["x", "y", "z"]) === 0, "no evidence means zero confidence");
}

// 3. pairwise duels (the model's core) recover a 40-color order
{
  const R = 20, rs = [];
  for (let r = 0; r < R; r++) {
    const w = mkWorld(40), st = {}, skip = new Set();
    for (let t = 0; t < 200; t++) { const [a, b] = P.nextPair(st, w.keys, { rand, skip }); const win = choose(w, a, b); P.compare(st, win, win === a ? b : a); skip.add(P.pairId(a, b)); if (skip.size > 10) skip.delete(skip.values().next().value); }
    rs.push(spearman(w.keys.map(k => P.mean(st, k)), w.u));
  }
  ok(mean(rs) > .88, `pairwise comparisons converge on 40 colors (rho ${mean(rs).toFixed(3)} after 200 duels)`);
}

// 4. tiers: Love > Like > Fine in the final order, each by a wide margin
{
  const st = {}, ks = ["l1", "l2", "k1", "k2", "f1", "f2"];
  [["l1", 0], ["l2", 0], ["k1", 1], ["k2", 1], ["f1", 2], ["f2", 2]].forEach(([k, lv]) => P.tierRate(st, k, lv));
  const o = P.order(st, ks);
  ok(["l1", "l2"].includes(o[0]) && ["l1", "l2"].includes(o[1]) && ["f1", "f2"].includes(o[4]) && ["f1", "f2"].includes(o[5]), "tiers: Love ranks above Like above Fine");
  ok(P.mean(st, "l1") > .8 && P.mean(st, "f1") < -.5, "tiers: Love is clearly positive, Fine clearly below average");
}

// 5. swipes
{
  const st = {}; P.swipeRate(st, "yes", true); P.swipeRate(st, "no", false);
  ok(P.mean(st, "yes") > 0 && P.mean(st, "no") < 0, "swipe: a like raises a color, a skip lowers it");
}

// 6. budget of drops and drag-to-order recover a known order
{
  const w = mkWorld(8), st1 = {}, st2 = {};
  const truth = w.keys.slice().sort((a, b) => w.U(b) - w.U(a));
  const alloc = {}; truth.forEach((k, i) => alloc[k] = [4, 3, 2, 1, 0, 0, 0, 0][i]);
  P.applyPairs(st1, P.budgetPairs(alloc));
  ok(P.order(st1, w.keys).slice(0, 4).join() === truth.slice(0, 4).join(), "budget: 10 drops recover the top four in order");
  P.applyPairs(st2, P.orderPairs(truth));
  ok(P.order(st2, w.keys).join() === truth.join(), "drag to order: a full order is reproduced exactly");
  ok(P.budgetPairs({ a: 2, b: 2 }).length === 0, "budget: equal drops say nothing");
}

// 7. undo restores a belief exactly; a context forks from general taste
{
  const st = {}; P.compare(st, "a", "b"); const s0 = JSON.stringify(st), sn = P.snap(st, ["a", "b", "c"]);
  P.compare(st, "c", "a"); P.restore(st, sn);
  ok(JSON.stringify(st) === s0, "undo: snapshot and restore return the exact beliefs (and drop a color that was new)");
  const ctx = P.fork(st, ["a", "b", "z"]);
  ok(ctx.a[0] === st.a[0] && ctx.a[1] >= 1.2 && !ctx.z, "context: starts from general taste with more doubt; unseen colors start blank");
}

// 8. a tie moves nothing much; strong evidence moves a lot; numbers stay finite
{
  const st = {}; for (let i = 0; i < 500; i++) P.compare(st, "a", "b");
  ok(Number.isFinite(P.mean(st, "a")) && st.a[1] > 0 && P.mean(st, "a") > P.mean(st, "b"), "500 identical comparisons stay finite with positive variance");
  const t = {}; P.compare(t, "a", "b", .5); ok(Math.abs(P.mean(t, "a")) < 1e-9, "a tie leaves two blank colors level");
}
// 9. a breather set: three different colors, spread from clearly liked to clearly less liked
{
  const w = mkWorld(24), st = {}, skip = new Set();
  for (let t = 0; t < 120; t++) { const [a, b] = P.nextPair(st, w.keys, { rand, skip }); const win = choose(w, a, b); P.compare(st, win, win === a ? b : a); }
  let distinct = true, wide = 0;
  for (let i = 0; i < 40; i++) { const tr = P.easyTriple(st, w.keys, { rand }), m = tr.map(k => P.mean(st, k)); if (new Set(tr).size !== 3) distinct = false; if (Math.max(...m) - Math.min(...m) > 1.5) wide++; }
  ok(distinct, "easy set: always three different colors");
  ok(wide >= 36, `easy set: the colors are clearly apart in score (${wide} of 40 sets span more than 1.5 logits)`);
  ok(P.easyTriple({}, ["a", "b", "c"]).length === 3, "easy set: works with exactly three favorites");
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
