// Simulated users for the Train engine (js/gym-engine.js). Run: node tools/gym_sim.js
// Checks: the staircase settles near 3 in 4 right; dials unlock one at a time and in order; spacing advances and
// resets; a planted weak band is found (and a fair player rarely gets a false one); calibration math; the
// check-in level; tips; the suggestion order. Exits 1 on any failure.
const E = require("../js/gym-engine.js");

let seed = 20261007; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL  " + msg); } };
const say = s => console.log(s);

// ---------- 1. staircase ----------
// A simulated observer: Weibull psychometric function with chance g, threshold a, slope b.
const pRight = (d, g, a, b = 2) => g + (1 - g) * (1 - Math.exp(-((d / a) ** b)));
say("Staircase (right: x" + E.STAIR_DOWN + ", wrong: x" + E.STAIR_UP + "), predicted settle point " + (E.stairTarget() * 100).toFixed(1) + "% right");
ok(E.stairTarget() > .7 && E.stairTarget() < .85, "staircase target should be 70-85% right");
for (const [k, g, a] of [["value", .5, 3], ["hue", 1 / 9, 2], ["memory", 1 / 3, 5], ["value", .5, 1.2]]) {
  const sk = E.SKILLS[k];
  let d = sk.start, hits = 0, n = 0, logs = [];
  for (let t = 0; t < 6000; t++) {
    const right = rand() < pRight(d, g, a);
    if (t >= 1000) { hits += right; n++; logs.push(Math.log(d)); }
    d = E.stairNext(d, right, sk.floor);
  }
  const dMean = Math.exp(logs.reduce((s, x) => s + x, 0) / logs.length), rate = hits / n;
  // where the observer is right `target` of the time
  let lo = .01, hi = 50; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pRight(m, g, a) < E.stairTarget()) lo = m; else hi = m; }
  say(`  ${k.padEnd(7)} chance ${(g * 100).toFixed(0).padStart(2)}%, threshold ${a}: settles at d=${dMean.toFixed(2)} (observer's ${(E.stairTarget() * 100).toFixed(0)}% point ${lo.toFixed(2)}), ${(rate * 100).toFixed(1)}% right`);
  ok(rate > .7 && rate < .85, `${k}: steady-state hit rate ${rate.toFixed(3)} should be 0.70-0.85`);
  ok(Math.abs(Math.log(dMean / lo)) < .25, `${k}: settles near the observer's target point`);
  // a 12-round session starting at level 1 moves toward the observer's level
  let d2 = sk.start; const log2 = [];
  for (let t = 0; t < 12; t++) { const r = rand() < pRight(d2, g, a); log2.push(d2); d2 = E.stairNext(d2, r, sk.floor); }
  ok(E.levelFor(sk, E.geoMean(log2.slice(-6))) > 1 || a > 8, `${k}: one session already lifts the level off 1`);
}

// ---------- 2. dials ----------
say("Dials");
for (const k of Object.keys(E.GY_DIALS)) {
  const unlocks = E.dialUnlocks(k);
  let prev = E.dialPlan(k, 1), maxTurn = 0;
  for (let lv = 2; lv <= 20; lv++) {
    const cur = E.dialPlan(k, lv), turned = Object.keys(cur).filter(id => cur[id] !== prev[id]);
    maxTurn = Math.max(maxTurn, turned.length);
    if (turned.length) ok(!!E.dialNews(k, lv), `${k}: level ${lv} turns ${turned} but has no announcement`);
    else ok(!E.dialNews(k, lv), `${k}: level ${lv} announces news but nothing turned`);
    prev = cur;
  }
  ok(maxTurn <= 1, `${k}: more than one dial turns at one level`);
  ok(unlocks.every((u, i) => i === 0 || u[0] > unlocks[i - 1][0]), `${k}: unlock levels must strictly increase`);
  ok(Object.keys(E.GY_DIALS[k]).length >= 2 && E.GY_DIALS[k].length <= 5, `${k}: 2-5 dials`);
  say(`  ${k.padEnd(7)} ${unlocks.map(u => `L${u[0]} ${u[1]}`).join(" · ")}`);
}
ok(E.dialNewsBetween("hue", 4, 8).map(x => x[0]).join() === "5,8", "news between levels 4 and 8 of Odd one out = 5, 8");

// ---------- 3. spacing ----------
say("Spaced stations");
{
  let st = { stage: 0, prevLv: null }, day = 100; const seq = [3, 4, 4, 6, 5, 7, 8, 9];
  const gaps = [];
  for (const lv of seq) { const r = E.nextDue(st, lv, day); gaps.push(r.due - day); st = { ...st, ...r }; day = r.due; }
  say(`  levels ${seq.join(" ")} -> gaps ${gaps.join(" ")} days`);
  ok(gaps.join() === "1,3,7,16,1,3,7,16", "gaps advance 1,3,7,16 and reset to 1 when a session drops");
  const m = E.nextDue({ stage: 2, prevLv: 15, maint: true }, 16, 0);
  ok(m.due === E.GY_GAPS_MAINT[3] && m.stage === 3, "maintenance uses the longer gaps");
}

// ---------- 4. weak band ----------
say("Weak spot");
const fams = ["Blues", "Reds", "Greens", "Yellows", "Purples"];
const mkTrials = (n, missOf) => Array.from({ length: n }, (_, i) => { const f = fams[Math.floor(rand() * 5)], l = E.lBand(20 + rand() * 70), c = E.cBand(rand() * 70); return { t: 200 - Math.floor(rand() * 6), ok: rand() < missOf(f, l, c) ? 0 : 1, f, l, c }; });
{
  for (const n of [60, 100]) {
    let found = 0, fp = 0, runs = 200;
    for (let r = 0; r < runs; r++) {
      const w = E.weakBand(mkTrials(n, f => f === "Blues" ? .55 : .2), 200);
      if (w && w.dim === "f" && w.val === "Blues") found++;
      const w2 = E.weakBand(mkTrials(n, () => .25), 200);
      if (w2) fp++;
    }
    say(`  ${n} trials (${n === 60 ? "about five sets" : "a busy week"}), planted (blues missed 55% vs 20%): found ${found}/${runs}; fair player flagged ${fp}/${runs}`);
    if (n === 100) ok(found / runs > .7, "planted weak family found in most runs over a week of practice");
    ok(fp / runs < .2, `${n} trials: a player with no weak spot is rarely flagged`);
  }
  const dark = E.weakBand(mkTrials(60, (f, l) => l === "dark" ? .6 : .15), 200);
  ok(dark && dark.dim === "l" && dark.val === "dark", "planted weak lightness band found");
  ok(E.weakLine({ dim: "f", val: "Blues", week: true }) === "Blues are your weak zone this week", "weak line copy");
}

// ---------- 5. calibration ----------
say("Calibration");
{
  // a player right 91% when sure and 60% when guessing
  const conf = { s: [0, 0], g: [0, 0] };
  for (let i = 0; i < 400; i++) { const sure = rand() < .6, right = rand() < (sure ? .91 : .6); const c = conf[sure ? "s" : "g"]; c[0]++; if (right) c[1]++; }
  const c = E.calib(conf);
  say(`  sure ${c.sure}% (n=${c.nSure}), guessing ${c.guess}% (n=${c.nGuess}) -> "${E.calibLine(c)}"`);
  ok(Math.abs(c.sure - 91) <= 4 && Math.abs(c.guess - 60) <= 7, "calibration percentages recover the planted rates");
  ok(E.calib({ s: [10, 9], g: [4, 1] }).sure === 90 && E.calib({ s: [10, 9], g: [4, 1] }).guess === 25, "calib exact math");
  ok(E.calibLine(E.calib({ s: [3, 3], g: [0, 0] })) === null, "no calibration line under 5 sure answers");
}

// ---------- 6. check-in ----------
say("Check-in");
{
  const lad = (k, hits) => E.ciLadder(k).map((lv, i) => ({ lv, ok: hits(i, lv) }));
  ok(E.ciLevel("value", lad("value", () => 1)) === 20, "all right -> level 20");
  ok(E.ciLevel("value", lad("value", () => 0)) === 1, "all wrong -> level 1");
  ok(E.ciLevel("hue", lad("hue", (i, lv) => lv <= 10)) > E.ciLevel("hue", lad("hue", (i, lv) => lv <= 4)), "more of the ladder right -> higher level");
  ok(E.ciLevel("value", lad("value", (i) => i % 2)) < 12, "a coin-flipper on a two-choice ladder stays low");
  ok(!E.checkinDue([], 2, 10).due && E.checkinDue([], 3, 10).due, "first check-in opens after 3 stations tried");
  ok(!E.checkinDue([{ t: 10 }], 5, 13).due && E.checkinDue([{ t: 10 }], 5, 17).due, "then every 7 days");
  ok(E.checkinPick(["hue", "value", "shade", "neutral"], [{ t: 1, res: { hue: {}, value: {} } }]).join() === "shade,neutral,hue", "least recently checked stations first");
  // a simulated player with a fixed threshold: check-in levels are stable week to week (honest number)
  for (const [k, g, a] of [["value", .5, 3], ["value", .5, 1.5], ["hue", 1 / 9, 2]]) {
    const sk = E.SKILLS[k], lvls = [];
    let lo = .01, hi = 50; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pRight(m, g, a) < E.stairTarget()) lo = m; else hi = m; }
    for (let w = 0; w < 500; w++) lvls.push(E.ciLevel(k, E.ciLadder(k).map(lv => ({ lv, ok: rand() < pRight(E.scoreAt(sk, lv), g, a) }))));
    const mean = lvls.reduce((s, x) => s + x, 0) / lvls.length, sd = Math.sqrt(lvls.reduce((s, x) => s + (x - mean) ** 2, 0) / lvls.length);
    say(`  fixed player on ${k} (true level ${E.levelFor(sk, lo)}): check-in level ${mean.toFixed(1)} ± ${sd.toFixed(1)} over ${E.ciLadder(k).length} rounds`);
    ok(Math.abs(mean - E.levelFor(sk, lo)) < 2.5, `${k}: check-in level centers near the true level`);
    ok(sd < 4, `${k}: week-to-week spread for an unchanged player under 4 levels`);
  }
  ok(E.inMaintenance("hue", [{ res: { hue: { lv: 16 } } }, { res: { value: { lv: 3 } } }, { res: { hue: { lv: 15 } } }]), "two check-ins in a row at 15+ -> maintenance");
  ok(!E.inMaintenance("hue", [{ res: { hue: { lv: 16 } } }, { res: { hue: { lv: 14 } } }]), "one below 15 -> not yet");
}

// ---------- 7. suggestion ----------
say("Suggested station");
{
  const info = [{ k: "hue", tried: true, lv: 9, due: 12 }, { k: "value", tried: true, lv: 4, due: 20 }, { k: "shade", tried: false, lv: 0, due: null }];
  ok(E.suggestPick(info, 13).k === "hue" && /Due 1 day ago/.test(E.suggestPick(info, 13).why), "overdue first");
  ok(E.suggestPick(info, 10).k === "value", "then the weakest");
  ok(E.suggestPick([{ k: "hue", tried: true, lv: 9, due: 12, today: true }, { k: "shade", tried: false, lv: 0 }], 10).k === "shade", "then one not tried (when the rest were trained today)");
}

// ---------- 8. tips ----------
say("Tips");
{
  const tr = Array.from({ length: 20 }, (_, i) => ({ t: 1, ok: i % 3 ? 1 : 0, f: "Reds", l: "mid", c: "mid", s: { vd: 1, pv: i % 3 ? 0 : 1 } }));
  const p = E.detectPattern("value", tr);
  ok(p && p.id === "vivid", "picking the more vivid color is spotted in Which is lighter?");
  say(`  value: ${p && p.tip}`);
  const nt = Array.from({ length: 6 }, () => ({ t: 1, ok: 0, s: { err: 4, tw: 1, warm: 0, gH: 240 } }));
  ok(E.detectPattern("neutral", nt).id === "toward", "greys leaning toward the ground are spotted");
  const vt = Array.from({ length: 6 }, () => ({ t: 1, ok: 0, s: { dL: 5, H: 30 } }));
  ok(E.detectPattern("vanish", vt).id === "light", "discs set too light are spotted");
  const ht = Array.from({ length: 30 }, (_, i) => ({ t: 1, ok: (i % 5 === 0 && i % 2 === 0) || (i % 5 && i % 9 === 0) ? 0 : 1, f: i % 5 === 0 ? "Blues" : fams[1 + i % 4], l: "mid", c: "mid" }));
  for (let i = 0; i < 30; i += 5) ht[i].ok = 0;
  const hp = E.detectPattern("hue", ht);
  ok(hp && hp.id === "band" && hp.fix.want.val === "Blues", "odd one out: misses bunched in blues -> band tip with a blues fix");
  say(`  hue: ${hp && hp.tip}`);
  ok(E.detectPattern("value", tr.map(t => ({ ...t, ok: 1 }))) === null, "no misses, no tip");
}

// ---------- 9. unlocks ----------
{
  const lv = { value: 8, shade: 8, vanish: 2 }, f = k => lv[k] || 0;
  ok(E.squintUnlocked(f), "squint opens at level 8 in both lightness stations");
  ok(!E.squintUnlocked(k => k === "value" ? 8 : 7), "not before");
  ok(E.mixUnlocked("light", f) && !E.mixUnlocked("ctx", f), "mixed lightness opens with two stations at level 5+");
}

say(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
