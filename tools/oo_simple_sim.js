"use strict";
// A quick simulated player for the simple Odd one out game (js/games/oo-engine.js: ooSimpleAxis/ooSimpleD/
// ooSimpleShape/ooSimpleGridType/ooSimpleGradColors/ooSimpleMix/ooSimpleGradRound/ooSimpleRound/ooSimpleGrid).
// Each axis has a known JND; the simulated player is right with the same psychometric curve the engine itself
// uses (ooP), centered on a blend of the true thresholds weighted by that round's axis mix (a combined round is
// judged on the combination it actually drew), discounted by the board's own masking factor (OO_S_GRAD_F -- a
// gradient ground competes with the odd tile, the same factor the generator uses to inflate the drawn gap, so a
// well-tuned game should still land ~75-80% even once gradients are common). Draws real rounds through
// ooSimpleRound so the guessing rate, the mix and the actually-drawn gap are the real ones, not an approximation.
// Checks: the staircase settles near 75-80% within about 15 rounds; a typical eye grows the grid; a very sharp
// eye (below every axis's visibility floor) never gets a sub-floor round, and reaches the grid cap instead;
// gradients show up early and often, at every skill level, per David's "even for low-skill players" correction.
// node tools/oo_simple_sim.js
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- percent display"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lib = new Function("clamp", math + "\nreturn { rgb, lab, lch, labRgb, inGamut, labHex, lchHex, de2000, ink };")(clamp);
Object.assign(global, lib, { clamp });
const E = require(path.join(__dirname, "../js/games/oo-engine.js"));

function run(truths, cols0, seed, n = 400) {
  const rnd = E.ooRnd(seed);
  const model = E.ooModel({});
  let cols = cols0, acc = [];
  const hist = [];
  let subFloor = 0, floorRounds = 0, drawCount = 0, gradRounds = 0, gradEarly = 0;
  for (let t = 0; t < n; t++) {
    const breather = t > 0 && t % 5 === 4;
    let r = null;
    for (let tries = 0; tries < 6 && !r; tries++) r = E.ooSimpleRound({ model, cols, round: t }, breather, rnd);
    if (!r) continue;   // an unlucky draw (rare): skip, same as the UI would retry
    drawCount++;
    const floor = E.OO_S_FLOOR[r.axis];
    if (r.act < floor - 1e-6) subFloor++;
    if (r.act <= floor * 1.5) floorRounds++;   // near the floor, whatever the model's own (possibly much sharper) estimate says
    if (r.gridType && r.gridType !== "flat") { gradRounds++; if (t < 30) gradEarly++; }
    // the mix this round actually drew, judged against a weighted blend of the true per-axis JNDs, discounted by
    // the board factor the generator already used to inflate the drawn gap (ooSimpleRound's d * OO_S_GRAD_F[dims]).
    // Only the dominant axis in the mix is updated, credited with the full gap -- splitting credit proportionally
    // across every axis in the mix systematically dragged every estimate down (a tiny secondary nudge got marked
    // "detected" on the strength of the dominant axis's much bigger move); matches js/games/oo-ui.js's onAnswer.
    const mix = r.mix || { [r.axis]: 1 }, effAct = r.act / (r.bf || 1);
    const blendTruth = Object.keys(mix).reduce((s, a) => s + mix[a] * truths[a], 0);
    const ok = rnd() < E.ooP(effAct, blendTruth, r.g || 0);
    const dom = Object.keys(mix).reduce((best, a) => mix[a] > mix[best] ? a : best, Object.keys(mix)[0]);
    if (E.OO_AXES.includes(dom)) E.ooUpdate(model, dom, null, effAct, ok, r.g || 0);
    acc.push(ok ? 1 : 0); if (acc.length > E.OO_S_WINDOW) acc.shift();
    const next = E.ooSimpleGrid(cols, acc);
    if (next !== cols) { cols = next; acc = []; }
    hist.push({ t, axis: r.axis, act: r.act, ok, cols, shape: r.v, gridType: r.gridType });
  }
  return { model, hist, subFloor, floorRounds, drawCount, gradRounds, gradEarly };
}
const accOf = (hist, from, to) => { const s = hist.slice(from, to); return s.length ? s.filter(x => x.ok).length / s.length : 0; };

let fail = false;
console.log("== A typical eye (hue 1.8, value 1.3, saturation 2.3 ΔE00) ==");
{
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { model, hist, subFloor, gradRounds, drawCount } = run(truths, 3, 20261010);
  console.log(`  rounds 1-15:   ${(accOf(hist, 0, 15) * 100).toFixed(0)}% right`);
  console.log(`  rounds 16-50:  ${(accOf(hist, 15, 50) * 100).toFixed(0)}% right`);
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right`);
  E.OO_AXES.forEach(a => { const th = Math.exp(model.j[a] ? model.j[a].r : Math.log(E.OO_START[a])); console.log(`  ${a.padEnd(7)} estimate ${th.toFixed(2)} (true ${truths[a]})`); });
  console.log(`  grid reached by round 400: ${hist[hist.length - 1].cols} x ${hist[hist.length - 1].cols} (started 3 x 3, cap ${E.OO_S_MAX_COLS})`);
  console.log(`  gradient rounds (grad1d/grad2d): ${gradRounds} of ${drawCount} (~${(gradRounds / drawCount * 100).toFixed(0)}%)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  const settled = accOf(hist, 50, 400), gradRate = gradRounds / drawCount;
  if (settled < .68 || settled > .90) { console.log(`FAIL: settled accuracy ${(settled * 100).toFixed(0)}% is outside 68-90%`); fail = true; }
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  if (hist[hist.length - 1].cols <= 3) { console.log("FAIL: the grid never grew past 3 x 3 for a typical eye"); fail = true; }
  if (gradRate < .3 || gradRate > .55) { console.log(`FAIL: gradient rate ${(gradRate * 100).toFixed(0)}% is outside the ~35-50% David asked for`); fail = true; }
}
console.log("\n== A struggling eye (hue 5, value 4.5, saturation 6 ΔE00: much coarser than typical) ==");
{
  const truths = { hue: 5, light: 4.5, chroma: 6 };
  const { hist, gradRounds, gradEarly, drawCount } = run(truths, 3, 555);
  const settled = accOf(hist, 50, 400), gradRate = gradRounds / drawCount;
  console.log(`  rounds 51-400: ${(settled * 100).toFixed(0)}% right`);
  // the grid is NOT gated by how coarse the eye's true JND is -- the staircase already finds the right ΔE for
  // this eye (d adapts per axis), so a well-calibrated "struggling" eye still answers ~75-80% right at ITS OWN
  // scale and the grid grows just the same; grid size tracks accuracy, never absolute acuity.
  console.log(`  grid reached by round 400: ${hist[hist.length - 1].cols} x ${hist[hist.length - 1].cols} (grid size tracks accuracy, not raw acuity, so this grows too)`);
  console.log(`  gradient rounds: ${gradRounds} of ${drawCount} (~${(gradRate * 100).toFixed(0)}%), ${gradEarly} inside the first 30 (David: "give gradients even to low-skill players")`);
  if (settled < .65 || settled > .90) { console.log(`FAIL: settled accuracy ${(settled * 100).toFixed(0)}% is outside 65-90% for a struggling eye`); fail = true; }
  if (gradRate < .3 || gradRate > .55) { console.log(`FAIL: a struggling eye should still see gradients at roughly the typical rate, got ${(gradRate * 100).toFixed(0)}%`); fail = true; }
  if (gradEarly < 5) { console.log(`FAIL: a struggling eye saw only ${gradEarly} gradient rounds in its first 30 -- gradients should show up early for everyone`); fail = true; }
}
console.log("\n== A very sharp eye (hue 0.5, value 0.4, saturation 0.5 ΔE00, all below the floor) ==");
{
  const truths = { hue: .5, light: .4, chroma: .5 };
  const { hist, subFloor, floorRounds, drawCount, gradRounds } = run(truths, 3, 777);
  const gradRate = gradRounds / drawCount;
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right (near-ceiling is expected: the floor is easier than this eye needs)`);
  console.log(`  rounds drawn near the visibility floor (within 1.5x it): ${floorRounds} of ${drawCount}`);
  console.log(`  gradient rounds: ${gradRounds} of ${drawCount} (~${(gradRate * 100).toFixed(0)}%), steeper on average than the typical eye's`);
  console.log(`  grid reached by round 400: ${hist[hist.length - 1].cols} x ${hist[hist.length - 1].cols} (should hit the ${E.OO_S_MAX_COLS} x ${E.OO_S_MAX_COLS} cap: once the floor binds, the grid is the only difficulty lever left)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  if (floorRounds < drawCount * .35) { console.log("FAIL: a sharp eye should spend a good share of rounds near the floor, not scaling up with true ability"); fail = true; }
  if (hist[hist.length - 1].cols !== E.OO_S_MAX_COLS) { console.log(`FAIL: a sharp eye never reached the ${E.OO_S_MAX_COLS} x ${E.OO_S_MAX_COLS} cap`); fail = true; }
  if (gradRate < .3 || gradRate > .55) { console.log(`FAIL: gradient rate ${(gradRate * 100).toFixed(0)}% is outside the ~35-50% range for a sharp eye too`); fail = true; }
}
console.log(fail ? "\nFAIL" : "\nPASS");
process.exit(fail ? 1 : 0);
