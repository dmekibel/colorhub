// Tests for the Odd one out engine (js/games/oo-engine.js). Run: node tools/games_test.js
// Checks: the learner model and the staircase converge on a simulated observer's true threshold; "how many"
// includes zero (and zero means an untouched board); the daily board is the same for everyone on a day and
// different the next; every variant's drawn difference lies within its difficulty band at every tier; boards
// and levels are well formed. Exits 1 on any failure.
const fs = require("fs"), path = require("path");
// the color math, straight from js/core.js (one copy of the formulas)
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- percent display"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lib = new Function("clamp", math + "\nreturn { rgb, lab, lch, labRgb, inGamut, labHex, lchHex, de2000, ink };")(clamp);
Object.assign(global, lib, { clamp });
const E = require("../js/games/oo-engine.js");

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL  " + msg); } };
const say = s => console.log(s);
const rnd = E.ooRnd(20261008);

// ---------- 1. the learner model converges (Elo on the log threshold) ----------
say("Learner model: rounds drawn on the breathing schedule against simulated observers");
for (const [j, truth, g] of [["hue", 1.4, 1 / 9], ["light", 2.1, 1 / 16], ["chroma", 3.5, .2], ["memory", 5, 1 / 16], ["context", .9, 1 / 9]]) {
  const m = E.ooModel({}), ests = [];
  let hits = 0, n = 0;
  for (let t = 0; t < 400; t++) {
    const th = E.ooTheta(m, j, "Blues"), tier = E.OO_TIER[E.OO_BREATH[t % 6]], d = th * tier;
    const right = rnd() < E.ooP(d, truth, g);
    E.ooUpdate(m, j, "Blues", d, right, g);
    if (t >= 150) { ests.push(Math.log(E.ooTheta(m, j, "Blues"))); hits += right; n++; }
  }
  const est = Math.exp(ests.reduce((a, x) => a + x, 0) / ests.length), err = Math.abs(Math.log(est / truth));
  say(`  ${j.padEnd(8)} true ${truth.toFixed(2)} → estimate ${est.toFixed(2)} (${(err * 100).toFixed(0)}% off), ${(hits / n * 100).toFixed(0)}% right`);
  ok(err < .25, `${j}: estimate ${est.toFixed(2)} should be within 25% of the true threshold ${truth}`);
  ok(hits / n > .66 && hits / n < .9, `${j}: hit rate ${(hits / n).toFixed(2)} should sit near 80% (0.66-0.90)`);
}
// a family offset learns that one family is harder
{
  const m = E.ooModel({});
  for (let t = 0; t < 600; t++) {
    const fam = t % 2 ? "Blues" : "Greens", truth = fam === "Greens" ? 2.4 : 1.2;
    const th = E.ooTheta(m, "hue", fam), d = th * E.OO_TIER[E.OO_BREATH[t % 6]];
    E.ooUpdate(m, "hue", fam, d, rnd() < E.ooP(d, truth, 1 / 9), 1 / 9);
  }
  const b = E.ooTheta(m, "hue", "Blues"), gr = E.ooTheta(m, "hue", "Greens");
  say(`  families: blues ${b.toFixed(2)} (true 1.2), greens ${gr.toFixed(2)} (true 2.4)`);
  ok(gr / b > 1.4, "family offsets should separate a harder family (greens 2x blues)");
}
// the 2-down / 1-up staircase settles near the observer's 71% point
{
  const truth = 2, g = 1 / 9;
  let lo = .01, hi = 50; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (E.ooP(mid, truth, g) < .707) lo = mid; else hi = mid; }
  const scores = [];
  for (let rep = 0; rep < 60; rep++) {
    const s = E.ooStair(8);
    for (let t = 0; t < 120; t++) E.ooStairStep(s, rnd() < E.ooP(s.d, truth, g));
    scores.push(Math.log(E.ooStairScore(s)));
  }
  const mean = Math.exp(scores.reduce((a, x) => a + x, 0) / scores.length);
  say(`Staircase: settles at ${mean.toFixed(2)} (observer's 71% point ${lo.toFixed(2)})`);
  ok(Math.abs(Math.log(mean / lo)) < .2, `staircase should settle within 20% of the 71% point (${mean.toFixed(2)} vs ${lo.toFixed(2)})`);
}

// ---------- 2. "how many" includes zero ----------
{
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 300; i++) {
    const r = E.ooRound({ v: "count", b: "grid", n: 4, d: 4, rnd });
    counts[r.count]++;
    const changed = r.colors.filter(c => c !== r.base).length;
    if (r.count === 0) ok(changed === 0 && r.none && r.ans.length === 0, "a zero round leaves every tile untouched");
    else ok(changed === r.count, `a count-${r.count} round changes exactly ${r.count} tiles (got ${changed})`);
  }
  say(`How many: answers 0-4 drawn ${counts.join(" / ")} times in 300 rounds`);
  ok(counts[0] >= 30, "zero should be the answer in roughly a fifth of rounds");
  ok(counts.every(c => c > 20), "every answer 0-4 should come up");
  const z = E.ooRound({ v: "count", b: "mosaic", n: 16, d: 3, rnd, count: 0 });
  ok(z.count === 0 && new Set(z.colors).size === 1, "a forced zero round on a mosaic is all one color");
}

// ---------- 3. the daily board is deterministic ----------
{
  const a = JSON.stringify(E.ooDaily("2026-10-08")), b = JSON.stringify(E.ooDaily("2026-10-08")), c = JSON.stringify(E.ooDaily("2026-10-09"));
  ok(a === b, "the same day gives the same daily board");
  ok(a !== c, "the next day gives a different board");
  const d = E.ooDaily("2026-10-08");
  ok(d.length === 6 && d.every((r, i) => r.d === E.OO_DAILY_D[i]), "the daily board has six rounds at the fixed ladder of differences");
  ok(E.ooDayNum("2026-10-08") === 1 && E.ooDayNum("2026-10-10") === 3, "daily numbers count from the start date");
  const txt = E.ooShareText("2026-10-08", [{ ok: 1, ms: 2000, act: 8 }, { ok: 1, ms: 5000, act: 5 }, { ok: 0 }, { ok: 1, ms: 1000, act: 2.5 }, { ok: 1, ms: 3000, act: 1.8 }, { ok: 0 }]);
  ok(txt === "ColorHub · Odd one out #1: 4 of 6, down to 1.8% different", "the share line is plain words: " + txt);
  ok(!/[\u{1F300}-\u{1FAFF}\u2B1B]/u.test(txt), "no emoji grid in the share line");
}

// ---------- 4. every variant's target lies within its difficulty band ----------
{
  const variants = [["one", "grid", 3], ["one", "grid", 6], ["pair", "grid", 4], ["group", "grid", 6], ["count", "grid", 4], ["twins", "grid", 3], ["which", "grid", 3],
    ["one", "ring", 10], ["one", "honey", 19], ["one", "strip", 8], ["one", "sizes", 4], ["one", "mosaic", 16], ["one", "busy", 4], ["one", "gradient", 4], ["twins", "ring", 10], ["count", "mosaic", 16]];
  const thetas = [.6, 1.5, 3, 6];
  let checked = 0, out = 0;
  for (const [v, b, n] of variants) for (const th of thetas) for (const tier of Object.keys(E.OO_TIER)) for (const axis of [undefined, "hue", "light", "chroma"]) {
    if (v === "twins" && axis) continue;
    const d = th * E.OO_TIER[tier] * (E.OO_VF[v] || 1);
    const r = E.ooRound({ v, b, n, d, axis, rnd });
    if (r.fallback) continue;
    const [lo, hi] = E.ooBand(r);
    checked++;
    if (!(r.act >= lo - 1e-9 && r.act <= hi + 1e-9)) { out++; if (out < 8) console.log(`      ${v}/${b} tier ${tier} d ${d.toFixed(2)}: drew ${r.act.toFixed(2)} outside [${lo.toFixed(2)}, ${hi.toFixed(2)}]`); }
    // the answer tiles are the odd ones and nothing else is
    if (!r.none && v !== "twins" && v !== "count" && b !== "gradient") ok(r.ans.every(i => r.colors[i] === r.odd) && r.colors.filter(c => c === r.odd).length === r.ans.length, `${v}/${b}: answer tiles carry the odd color`);
    if (v === "twins") ok(r.colors[r.ans[0]] === r.colors[r.ans[1]] && new Set(r.colors).size === r.colors.length - 1, "twins: exactly two identical tiles");
    if (v === "which") ok(E.ooDirChoices(r.base).flat().includes(r.dir), "which way: the answer is one of the offered words");
  }
  say(`Bands: ${checked - out} of ${checked} rounds drawn inside their band`);
  ok(out / checked < .01, `at most 1% of rounds may miss their band (missed ${out})`);
  // the direction word follows the axis it was moved along
  let dirOk = 0, dirN = 0;
  for (let i = 0; i < 200; i++) {
    const axis = ["light", "chroma", "hue"][i % 3], sign = i % 2 ? 1 : -1, r = E.ooRound({ v: "which", b: "grid", n: 3, d: 4, axis, sign, rnd });
    if (r.fallback) continue;
    dirN++;
    const want = axis === "light" ? ["lighter", "darker"] : axis === "chroma" ? ["more vivid", "greyer"] : ["redder", "yellower", "greener", "bluer"];
    if (want.includes(r.dir)) dirOk++;
  }
  say(`Which way: the word matches the moved axis in ${dirOk} of ${dirN} rounds`);
  ok(!/warmer|cooler|brighter/.test(JSON.stringify(E.OO_DIR_WORDS)), "no warmer, cooler or brighter (COLORNERD §6.5)");
  ok(dirOk / dirN > .95, "which-way words match the axis that moved");
  // busy grounds carry an illusion: every tile identical, "none" is right
  const il = E.ooRound({ v: "one", b: "busy", n: 4, d: 3, rnd, illusion: true });
  ok(il.none && new Set(il.colors).size === 1 && il.ground && il.ground.a !== il.ground.c, "illusion rounds: identical tiles on two clashing grounds");
  // painting shift moves a tile's mean by d
  const sh = E.ooPaintShift(lab("#6A7F5C"), "light", 1, 3);
  ok(sh && Math.abs(de2000(sh.from, sh.to) - 3) < .45, "a painting patch's mean moves by d");
}

// ---------- 5. boards, levels and the mix generators ----------
{
  for (const b of ["grid", "ring", "honey", "strip", "sizes", "mosaic", "busy", "gradient", "painting"]) {
    const g = E.ooCells(b, b === "honey" ? 19 : b === "ring" ? 10 : b === "strip" ? 8 : 4, rnd);
    ok(g.cells.length >= 7 && g.cells.every(c => c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9), `${b}: every cell inside the board`);
    if (b === "sizes") { const area = g.cells.reduce((a, c) => a + c.w * c.h, 0); ok(Math.abs(area - 1) < 1e-9, "mixed sizes tile the whole board"); }
  }
  ok(E.ooCells("honey", 19, rnd).cells.length === 19 && E.ooCells("honey", 7, rnd).cells.length === 7, "honeycombs have 7 or 19 cells");
  ok(E.OO_LEVELS.length === 24 && E.OO_LEVELS.every(l => l.news && l.name), "24 levels, each with a name and its news");
  ok(E.ooTierAt(0, true) === "intro" && E.ooTierAt(1, true) === "intro" && E.ooTierAt(2, true) === "hard", "a new kind of round arrives easy");
  ok(E.OO_BREATH.join() === "easy,medium,hard,easy,harder,boss", "the set breathes easy, medium, hard, easy, harder, boss");
  const o = E.ooOrderRound(8, 3, rnd);
  ok(Math.abs(o.from - o.to) >= 2 && o.strip.length === 8 && o.strip[o.to] === o.right[o.from], "out of order: one tile moved at least two places");
  const w = E.ooWasRound(3, rnd);
  ok(w && w.opts.length === 5 && !w.set.includes(w.opts[w.fresh]), "was it there: one newcomer among five");
  const nb = E.ooNbackSeq(14, 3, rnd);
  ok(nb.kind.every((k, i) => k !== "same" || nb.seq[i] === nb.seq[i - 2]), "n-back: a 'same' matches two back");
  ok(nb.kind.every((k, i) => k !== "lure" || nb.seq[i] !== nb.seq[i - 2]), "n-back: a lure never matches");
  const ch = E.ooChangedRound(4, 3, rnd);
  ok(ch && ch.before.filter((c, i) => c !== ch.after[i]).length === 1, "what changed: exactly one tile changes");
}

// ---------- 6. Painters' pairs: only clearly separated pairs are played ----------
{
  global.window = global.window || {};
  require("../data/games/pairs.js");
  const P = global.window.OO_PAIRS;
  let n = 0, bad = 0;
  for (const variant of ["love", "group", "avoided"]) for (const tier of ["easy", "medium", "hard"]) for (let k = 0; k < 60; k++) {
    const r = E.ooPairsRound(P, rnd, { variant, tier });
    if (!r) { bad++; continue; }
    n++;
    const w = r.win ? r.b : r.a, l = r.win ? r.a : r.b;
    if (variant === "avoided") ok(w[4] <= .55 && l[4] >= 1.2, "avoided: the answer is the stranger");
    else ok(w[4] > l[4], `${variant}: the answer has the higher lift`);
    ok(E.ooPairClear(r.a, r.b, E.OO_PAIR_RATIO[tier]), `${variant}/${tier}: the two lifts are clearly apart`);
    ok(variant === "avoided" || w[2] >= 25, "the winning pair rests on at least 25 paintings");
  }
  say(`Painters' pairs: ${n} rounds drawn, ${bad} not drawable`);
  ok(bad === 0, "every variant and tier can be drawn");
}

say(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
