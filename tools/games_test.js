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
  ok(E.OO_LEVELS.length === 20 && E.OO_GAPS.length === 20, "20 levels, each a gap");
  ok(E.OO_GAPS.every((g, i) => i === 0 || g < E.OO_GAPS[i - 1]) && E.OO_GAPS[0] >= 11 && E.OO_GAPS[19] <= 0.7, "gaps fall from obvious (12) to the edge (0.6)");
  ok(E.OO_LEVELS.every(l => l.v === undefined && l.b === undefined), "a level carries no layout: the layout is a separate axis");
  ok(E.ooLevelOfGap(2.1) === E.OO_GAPS.indexOf(2.1) && E.ooLevelForTh(1.0, 2) === E.ooLevelOfGap(2), "a threshold maps onto the ladder");
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

// ---------- 7. layouts: every layout can be drawn at every level it is offered at; moving up only shrinks the gap ----------
{
  let n = 0, bad = 0;
  for (const l of E.OO_LAYOUTS) {
    if (l.b === "painting") continue;
    for (const i of [0, 5, 10, 15, 19]) {
      const g = E.ooLevelGap(i);
      if (l.gmax && g > l.gmax) continue;
      for (let k = 0; k < 6; k++) {
        const r = E.ooRound({ v: l.v, b: l.b, n: l.n, d: g * E.ooLayoutF(l), rnd, twist: l.tw });
        n++; if (r.fallback) bad++;
      }
    }
  }
  ok(bad === 0, `every layout draws at every level it is offered at (${n} rounds, ${bad} fallbacks)`);
  ok(E.ooLayoutsFor(0, 3).length >= 3 && E.ooLayoutsFor(0, 3).every(l => l.at === 0), "a new player sees only the first layouts");
  ok(E.ooLayoutsFor(99, 12).every(l => !l.gmax || 12 <= l.gmax) && E.ooLayoutsFor(99, 1).length === E.OO_LAYOUTS.length, "gap-limited layouts drop out only where they can't be drawn");
  const seen = {}; let last = null; const picked = [];
  for (let k = 0; k < 40; k++) { const l = E.ooLayoutNext(E.ooLayoutsFor(99, 2), seen, last, rnd, k % 10); picked.push(l.id); if (l.id === last) bad++; last = l.id; }
  ok(new Set(picked).size >= 8 && bad === 0, "rounds rotate through many layouts and never repeat one back to back");
}

// ---------- 8. For you or Choose, the level map, test-out and the edge estimate ----------
{
  ok(E.ooPickTier({}) === null && E.ooPickTier({ m: "pick", d: "hard" }) === "hard" && E.ooPickTier({ m: "pick", d: "expert" }) === "harder" && E.ooPickTier({ m: "pick", d: "edge" }) === "boss", "For you has no tier; Choose maps Easy..Edge onto the tiers");
  ok(E.ooPrefNorm({ m: "pick", d: "bogus" }).d === "medium" && E.ooPrefNorm(null).m === "you", "a damaged preference is repaired");
  const lv = d => E.ooPickLevel({ m: "pick", d }, 2);
  ok(lv("easy") < lv("medium") && lv("medium") < lv("hard") && lv("hard") < lv("expert"), "Easy to Expert climb the ladder");
  ok(E.ooPickLevel({ m: "pick", d: "edge" }, 1.0) === E.ooLevelOfGap(1.0) && E.ooPickLevel({}, 1) === null, "Edge of my eye sits at your measured threshold; For you has no pick");
  ok(E.ooPickLevel({ m: "pick", d: "level", lv: 17 }) === 17, "a level tapped on the map is played as chosen");
  ok(E.ooTestTier({ m: "pick", d: "easy" }) === "hard" && E.ooTestTier({ m: "pick", d: "expert" }) === "harder" && E.ooTestTier({}) === "hard", "a test-out is at least Hard");
  const stars = { 0: [1, 0, 0], 1: [1, 0, 0] }, cl = {};
  ok(E.ooFrontier(stars, cl) === 2, "the frontier is the first level not passed");
  const k = E.ooTestOutMark(cl, 9);
  ok(k === 9 && E.ooFrontier(stars, cl) === 9 && E.ooDoneAt(stars, cl, 4) && !E.ooDoneAt(stars, cl, 9), "a passed test-out clears every level below it, not itself");
  ok(E.OO_LEVEL_PASS === 8 && E.OO_LEVEL_ROUNDS === 10, "a level is passed with 8 of 10");
  // a chosen difficulty still teaches the model fairly: an observer playing only Easy or only Hard ends at the same threshold
  const truth = 2, g = 0;
  // read as the mean over the last 200 of 600 answers (a single final value is one noisy step)
  const run = tier => { const m = E.ooModel({}); let acc = 0; for (let t = 0; t < 600; t++) { const d = E.ooTheta(m, "hue", "Blues") * E.OO_TIER[tier]; E.ooUpdate(m, "hue", "Blues", d, rnd() < E.ooP(d, truth, g), g); if (t >= 400) acc += Math.log(E.ooTheta(m, "hue", "Blues")); } return Math.exp(acc / 200); };
  const easy = run("easy"), hard = run("hard"), edge = run("boss");
  ok([easy, hard, edge].every(x => Math.abs(Math.log(x / truth)) < .35), `Easy (${easy.toFixed(2)}), Hard (${hard.toFixed(2)}) and Edge (${edge.toFixed(2)}) all find the true threshold ${truth}`);
  // the edge estimate for the games without an eye model
  for (const game of ["line", "pairs", "whose"]) {
    const C = E.OO_EDGE[game], tr = C.th * 1.7, e = { r: NaN, n: 0 };
    for (let t = 0; t < 300; t++) { const d = E.ooEdgeD(e, game, E.OO_BREATH[t % 6]); E.ooEdgeUpdate(e, game, d, rnd() < E.ooP(d, tr, C.g)); }
    const th = E.ooEdgeTh(e, game);
    ok(Math.abs(Math.log(th / Math.min(C.hi, Math.max(C.lo, tr)))) < .4, `${game}: the edge estimate finds the observer (${th.toFixed(2)} vs ${tr.toFixed(2)})`);
  }
  const wl = [1, 2, 3, 4, 5, 6, 7, 8], lo = [], hi = [];
  for (let t = 0; t < 60; t++) { lo.push(E.ooWhoseAlts(wl, .1, rnd).alts[0]); hi.push(E.ooWhoseAlts(wl, .9, rnd).alts[0]); }
  ok(lo.reduce((a, b) => a + b) / 60 < hi.reduce((a, b) => a + b) / 60 && E.ooWhoseAlts(wl, .5, rnd).alts.length === 2 && E.ooWhoseAlts([1, 2], .5, rnd).ease === null, "Whose palette?: higher ease draws farther decoys");
  ok(E.ooPairRatioOf([0, 0, 0, 0, 3], [0, 0, 0, 0, 1.5]) === 2 || Math.abs(E.ooPairRatioOf([0, 0, 0, 0, 3], [0, 0, 0, 0, 1.5]) - 2) < 1e-9, "pair ratio is the larger lift over the smaller");
}

// ---------- 9. sessions (David, 2026-10-09): honest difficulty, Classic boards, a staircase that converges ----------
{
  const de76 = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  // the gap metric: lightness, vividness and hue moves at one level look about equally big (ΔE76 medians within 25%),
  // so a chosen level never hides easy vividness rounds on saturated colors (the "super hard is still easy" bug)
  const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; }, by = {};
  for (const axis of ["light", "chroma", "hue"]) {
    by[axis] = [];
    for (let k = 0; by[axis].length < 200 && k < 2000; k++) {
      const base = lchHex(25 + rnd() * 65, 20 + rnd() * 50, rnd() * 360), m = E.ooMove(base, axis, rnd() < .5 ? 1 : -1, 1.1);
      if (m && Math.abs(m.act - 1.1) < .15) by[axis].push(de76(base, m.hex));
    }
  }
  const meds = Object.values(by).map(med), spread = Math.max(...meds) / Math.min(...meds);
  say(`Gap metric: ΔE76 at level 16 (1.1): lightness ${meds[0].toFixed(2)}, vividness ${meds[1].toFixed(2)}, hue ${meds[2].toFixed(2)}`);
  ok(spread < 1.25, `the three axes look about equally hard at one gap (spread ${spread.toFixed(2)})`);
  ok(E.ooGapDE("#808080", "#808080") === 0 && Math.abs(E.ooGapDE("#000000", "#FFFFFF") - 100) < .5, "the gap reads as % of black-to-white");
  // Choose: a session started at Expert, or at level 18, draws round 1 at exactly that level's gap (no easing at all)
  for (const [pref, want] of [[{ m: "pick", d: "expert" }, E.OO_PRESET_LV.expert], [{ m: "pick", d: "level", lv: 17 }, 17]]) {
    const lv = E.ooSessStart({ pick: E.ooPickLevel(pref, 2) });
    ok(lv === want, `Choose ${pref.d}${pref.lv != null ? " " + (pref.lv + 1) : ""} starts at level ${want + 1} (got ${lv + 1})`);
    for (const lay of [E.ooClassic(3, 1), E.ooClassic(8, 2), E.ooClassic(16, 1), E.ooLayout("ring"), E.ooLayout("honey")]) {
      const s = E.ooSess(lv), d = E.ooSessD(s, lay), gap = E.OO_GAPS[lv];
      ok(Math.abs(d / E.ooLayoutF(lay) - gap) < 1e-9, `${lay.id} ${lay.n}: the target is the level's gap through the layout's modifier`);
      // 8-bit hex codes can't hit every gap: at most 1 round in 20 may land just outside ±15%, never easier than +30%
      let inBand = 0, worst = 0;
      for (let k = 0; k < 40; k++) {
        const r = E.ooRound({ v: lay.v, b: lay.b, n: lay.n, k: lay.k, d, rnd });
        const eff = r.act / E.ooLayoutF(lay);
        ok(!r.fallback, `level ${lv + 1} on ${lay.name}: no fallback round`);
        if (eff >= gap * .85 && eff <= gap * 1.15) inBand++;
        worst = Math.max(worst, eff / gap);
      }
      ok(inBand >= 38 && worst < 1.3, `level ${lv + 1} on ${lay.name}: ${inBand} of 40 rounds at the level's gap (±15%), the easiest ${worst.toFixed(2)}× it`);
    }
  }
  // Classic: k odd tiles, all the same odd color, every grid size from 2 × 2 to 16 × 16
  for (const n of [2, 3, 8, 12, 16]) for (const k of [1, 2, 4]) {
    const lay = E.ooClassic(n, k), r = E.ooRound({ v: lay.v, b: lay.b, n: lay.n, k: lay.k, d: 3, rnd });
    ok(r.colors.length === n * n && r.ans.length === lay.k && r.ans.every(i => r.colors[i] === r.odd) && r.colors.filter(c => c === r.odd).length === lay.k, `Classic ${n} × ${n} with ${lay.k} odd tiles`);
  }
  ok(E.ooClassic(2, 4).k === 3, "a 2 × 2 grid leaves at least one plain tile");
  const pn = E.ooPrefNorm({ m: "pick", d: "level", lv: 17, mode: "shuffle", grid: 40, odd: 9 });
  ok(pn.mode === "shuffle" && pn.grid === 16 && pn.odd === 4 && pn.lv === 17 && E.ooPrefNorm({}).mode === "classic" && E.ooPrefNorm({}).grid === 3, "the board choice is kept and repaired");
  // the staircase: climbs a level per right answer at first, then settles near the observer's 75% point and stays there
  {
    const s = E.ooSess(4); E.ooSessStep(s, 1); E.ooSessStep(s, 1);
    ok(s.x === 6 && s.ups === 2, "the run-up climbs a whole level per right answer, each one a level-up");
    E.ooSessStep(s, 0); ok(s.x === 4.5 && !s.rush, "a miss drops a level and a half and ends the run-up");
    E.ooSessStep(s, 1); ok(s.x === 5, "after that a right answer climbs half a level");
  }
  for (const truth of [.9, 2, 4.5]) {
    // the observer's 75%-right gap on a 3 × 3 board (guessing 1 in 9)
    const g = 1 / 9; let lo = .01, hi = 50; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (E.ooP(mid, truth, g) < .75) lo = mid; else hi = mid; }
    const want = E.ooXOfGap(lo), edges = []; let hits = 0, n = 0;
    for (let rep = 0; rep < 80; rep++) {
      const s = E.ooSess(E.ooSessStart({ th: truth }));
      for (let t = 0; t < E.OO_SESSION_N; t++) { const ok1 = rnd() < E.ooP(E.ooGapAt(s.x), truth, g); E.ooSessStep(s, ok1); if (t >= 10) { hits += ok1; n++; } }
      edges.push(E.ooSessEdge(s));
    }
    const mean = edges.reduce((a, x) => a + x, 0) / edges.length;
    say(`  session vs observer at ${truth}: edge level ${(mean + 1).toFixed(1)} (75% point ${(want + 1).toFixed(1)}), ${(hits / n * 100).toFixed(0)}% right after the run-up`);
    ok(Math.abs(mean - want) < 1.2, `a 30-round session finds the 75% point within a level (${(mean + 1).toFixed(1)} vs ${(want + 1).toFixed(1)})`);
    ok(hits / n > .66 && hits / n < .86, `a session keeps you near three in four right (${(hits / n).toFixed(2)})`);
  }
  ok(E.ooSessStart({ edge: 12.4 }) === 9 && E.ooSessStart({}) === 0 && E.ooSessStart({ pick: 17 }) === 17, "For you starts three levels below your last edge; Choose starts at the pick");
  ok(Math.abs(E.ooGapAt(15) - E.OO_GAPS[15]) / E.OO_GAPS[15] < .05 && Math.abs(E.ooXOfGap(E.ooGapAt(7.5)) - 7.5) < 1e-9, "the continuous ladder matches the 20 levels");
}

say(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
