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

// a few plausible curated palettes (2-4 colors), standing in for the real pool (js/games/oo-ui.js's
// ooBeautyPool/ooFavPool, which need the browser's data files and so can't run in node)
const TEST_PALETTES = [
  { colors: ["#1B3A5C", "#6C8EA6", "#A9C6A0", "#E8D9A0"] },
  { colors: ["#7A1E1A", "#C97B4A", "#E8C25A", "#F1D9B0"] },
  { colors: ["#2E2A4A", "#6A4C93", "#B185DB", "#E8C4F0"] },
  { colors: ["#0B3D3A", "#2E7D6B", "#8FBF8A"] },
  { colors: ["#1A1A2E", "#C9A227"] },
];
function run(truths, size0, seed, n = 400, aspect = 1.6, richMode = "subtle") {
  const rnd = E.ooRnd(seed);
  const model = E.ooModel({});
  let size = size0, acc = [];
  const hist = [];
  let subFloor = 0, floorRounds = 0, drawCount = 0, gradRounds = 0, gradEarly = 0, richCount = { flat: 0, grad1: 0, grad2: 0, grad3: 0 }, worstNeighborRatio = 0;
  for (let t = 0; t < n; t++) {
    const breather = t > 0 && t % 5 === 4;
    let r = null;
    const rampCols = E.ooSimpleRampCols(size, t);   // same ramp js/games/oo-ui.js applies: chill start, builds over a run
    for (let tries = 0; tries < 6 && !r; tries++) {
      const palette = TEST_PALETTES[Math.floor(rnd() * TEST_PALETTES.length)];
      r = E.ooSimpleRound({ model, cols: rampCols, round: t, aspect, palette, richMode }, breather, rnd);
    }
    if (!r) continue;   // an unlucky draw (rare): skip, same as the UI would retry
    drawCount++;
    const floor = E.OO_S_FLOOR[r.axis];
    if (r.act < floor - 1e-6) subFloor++;
    if (r.act <= floor * 1.5) floorRounds++;   // near the floor, whatever the model's own (possibly much sharper) estimate says
    richCount[r.gridType] = (richCount[r.gridType] || 0) + 1;
    // every gradient round: the worst step between neighboring tiles must stay clearly under the odd tile's own
    // move (David, 2026-10-11: "a normal gradient step looks like a radically different tile" otherwise)
    if (r.gridType && r.gridType !== "flat" && r.act > 0) {
      // fieldColors (not colors/out) excludes the odd tile's own deviated color -- comparing ITS neighbor step
      // would just re-measure the odd tile's own move, not "a normal gradient step" (which is what this checks)
      const step = E.ooMaxNeighborStep(r.cells, r.fieldColors, r.cols, r.rows);
      worstNeighborRatio = Math.max(worstNeighborRatio, step / r.act);
    }
    if (r.gridType && r.gridType !== "flat") { gradRounds++; if (t < 30) gradEarly++; }
    // the mix this round actually drew, judged against a weighted blend of the true per-axis JNDs, discounted by
    // the board factor the generator already used to inflate the drawn gap (ooSimpleRound's d * OO_S_GRAD_F[tier]).
    // Only the dominant axis in the mix is updated, credited with the full gap -- splitting credit proportionally
    // across every axis in the mix systematically dragged every estimate down (a tiny secondary nudge got marked
    // "detected" on the strength of the dominant axis's much bigger move); matches js/games/oo-ui.js's onAnswer.
    const mix = r.mix || { [r.axis]: 1 }, effAct = r.act / (r.bf || 1);
    const blendTruth = Object.keys(mix).reduce((s, a) => s + mix[a] * truths[a], 0);
    const ok = rnd() < E.ooP(effAct, blendTruth, r.g || 0);
    const dom = Object.keys(mix).reduce((best, a) => mix[a] > mix[best] ? a : best, Object.keys(mix)[0]);
    if (E.OO_AXES.includes(dom)) E.ooUpdate(model, dom, null, effAct, ok, r.g || 0);
    acc.push(ok ? 1 : 0); if (acc.length > E.OO_S_WINDOW) acc.shift();
    const next = E.ooSimpleGrid(size, acc);
    if (next !== size) { size = next; acc = []; }
    hist.push({ t, axis: r.axis, act: r.act, ok, size, rows: r.rows, cols: r.cols, shape: r.v, gridType: r.gridType });
  }
  return { model, hist, subFloor, floorRounds, drawCount, gradRounds, gradEarly, richCount, worstNeighborRatio };
}
const accOf = (hist, from, to) => { const s = hist.slice(from, to); return s.length ? s.filter(x => x.ok).length / s.length : 0; };

let fail = false;
console.log("== A typical eye (hue 1.8, value 1.3, saturation 2.3 ΔE00) ==");
{
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { model, hist, subFloor, gradRounds, drawCount, richCount, worstNeighborRatio } = run(truths, 3, 20261010);
  const last = hist[hist.length - 1];
  console.log(`  rounds 1-15:   ${(accOf(hist, 0, 15) * 100).toFixed(0)}% right`);
  console.log(`  rounds 16-50:  ${(accOf(hist, 15, 50) * 100).toFixed(0)}% right`);
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right`);
  E.OO_AXES.forEach(a => { const th = Math.exp(model.j[a] ? model.j[a].r : Math.log(E.OO_START[a])); console.log(`  ${a.padEnd(7)} estimate ${th.toFixed(2)} (true ${truths[a]})`); });
  console.log(`  board reached by round 400: ${last.rows} x ${last.cols} (started 3 x 4-ish, cap ~${E.OO_S_MAX_COLS} the long way)`);
  // Subtle is the default now (David, 2026-10-11: "less palettes and more subtle gradients as the default") --
  // almost every round is grad1 (1-2 close, harmonious stops), grad2 only occasionally, grad3 essentially never
  // outside Rich mode (checked in its own block below).
  console.log(`  gradient rounds: ${gradRounds} of ${drawCount} (~${(gradRounds / drawCount * 100).toFixed(0)}%); richness flat/grad1/grad2/grad3: ${richCount.flat || 0}/${richCount.grad1 || 0}/${richCount.grad2 || 0}/${richCount.grad3 || 0}`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  console.log(`  worst neighbor-step as a fraction of the odd tile's own move: ${(worstNeighborRatio * 100).toFixed(0)}% (must stay under 50%)`);
  const settled = accOf(hist, 50, 400), gradRate = gradRounds / drawCount;
  if (settled < .68 || settled > .90) { console.log(`FAIL: settled accuracy ${(settled * 100).toFixed(0)}% is outside 68-90%`); fail = true; }
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  if (last.rows * last.cols <= 12) { console.log("FAIL: the board never grew for a typical eye"); fail = true; }
  if (gradRate < .85) { console.log(`FAIL: gradient rate ${(gradRate * 100).toFixed(0)}% is too low -- David wants gradients as the default, flat only a rare palate-cleanser`); fail = true; }
  if (worstNeighborRatio > .5) { console.log(`FAIL: a neighbor step reached ${(worstNeighborRatio * 100).toFixed(0)}% of the odd tile's own move -- should always stay under 50%`); fail = true; }
}
console.log("\n== A struggling eye (hue 5, value 4.5, saturation 6 ΔE00: much coarser than typical) ==");
{
  const truths = { hue: 5, light: 4.5, chroma: 6 };
  const { hist, gradRounds, gradEarly, drawCount, richCount } = run(truths, 3, 555);
  const settled = accOf(hist, 50, 400), gradRate = gradRounds / drawCount, last = hist[hist.length - 1];
  console.log(`  rounds 51-400: ${(settled * 100).toFixed(0)}% right`);
  // the board is NOT gated by how coarse the eye's true JND is -- the staircase already finds the right ΔE for
  // this eye (d adapts per axis), so a well-calibrated "struggling" eye still answers ~75-80% right at ITS OWN
  // scale and the board grows just the same; size tracks accuracy, never absolute acuity.
  console.log(`  board reached by round 400: ${last.rows} x ${last.cols} (size tracks accuracy, not raw acuity, so this grows too)`);
  console.log(`  gradient rounds: ${gradRounds} of ${drawCount} (~${(gradRate * 100).toFixed(0)}%), ${gradEarly} inside the first 30, richness flat/grad1/grad2/grad3: ${richCount.flat || 0}/${richCount.grad1 || 0}/${richCount.grad2 || 0}/${richCount.grad3 || 0} (David: "give gradients even to low-skill players, on their level")`);
  if (settled < .65 || settled > .90) { console.log(`FAIL: settled accuracy ${(settled * 100).toFixed(0)}% is outside 65-90% for a struggling eye`); fail = true; }
  if (gradRate < .85) { console.log(`FAIL: a struggling eye should still see gradients at roughly the typical (now ~93%) rate, got ${(gradRate * 100).toFixed(0)}%`); fail = true; }
  if (gradEarly < 18) { console.log(`FAIL: a struggling eye saw only ${gradEarly} gradient rounds in its first 30 -- gradients should show up early for everyone`); fail = true; }
}
console.log("\n== A very sharp eye (hue 0.5, value 0.4, saturation 0.5 ΔE00, all below the floor) ==");
{
  const truths = { hue: .5, light: .4, chroma: .5 };
  const { hist, subFloor, floorRounds, drawCount, gradRounds, richCount } = run(truths, 3, 777);
  const gradRate = gradRounds / drawCount, last = hist[hist.length - 1];
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right (near-ceiling is expected: the floor is easier than this eye needs)`);
  console.log(`  rounds drawn near the visibility floor (within 1.5x it): ${floorRounds} of ${drawCount}`);
  console.log(`  gradient rounds: ${gradRounds} of ${drawCount} (~${(gradRate * 100).toFixed(0)}%); richness flat/grad1/grad2/grad3: ${richCount.flat || 0}/${richCount.grad1 || 0}/${richCount.grad2 || 0}/${richCount.grad3 || 0} -- richer and steeper on average than the typical eye's`);
  console.log(`  board reached by round 400: ${last.rows} x ${last.cols} (should hit the ${E.OO_S_MAX_COLS}-long cap: once the floor binds, size is the only difficulty lever left)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  // richness is now a real difficulty lever of its own (a richer ground gets a bigger bf-compensated gap even
  // when the raw per-axis estimate has hit its floor), so "near the floor" is rarer than before gradients became
  // the default -- the hard requirement is subFloor === 0 above; this is just a sanity floor on top of that.
  if (floorRounds < drawCount * .1) { console.log("FAIL: a sharp eye should still spend some rounds near the floor, not scaling up with true ability"); fail = true; }
  if (Math.max(last.rows, last.cols) !== E.OO_S_MAX_COLS) { console.log(`FAIL: a sharp eye never reached the ${E.OO_S_MAX_COLS}-long cap`); fail = true; }
  if (gradRate < .85) { console.log(`FAIL: gradient rate ${(gradRate * 100).toFixed(0)}% is too low for a sharp eye too`); fail = true; }
}
console.log("\n== Rich mode (the Settings opt-in): richer tiers become available again ==");
{
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { richCount, worstNeighborRatio } = run(truths, 3, 20261010, 400, 1.6, "rich");
  console.log(`  richness flat/grad1/grad2/grad3: ${richCount.flat || 0}/${richCount.grad1 || 0}/${richCount.grad2 || 0}/${richCount.grad3 || 0}`);
  console.log(`  worst neighbor-step as a fraction of the odd tile's own move: ${(worstNeighborRatio * 100).toFixed(0)}% (must stay under 50%, even in Rich)`);
  if (!richCount.grad3) { console.log("FAIL: Rich mode never once drew the richest gradient tier in 400 rounds"); fail = true; }
  if (worstNeighborRatio > .5) { console.log(`FAIL: Rich mode's neighbor step reached ${(worstNeighborRatio * 100).toFixed(0)}% of the odd tile's own move`); fail = true; }
}
console.log("\n== A returning player (high persisted skill, fresh run) ==");
{
  // David, 2026-10-11: "every new run... starts chill -- few, large tiles... then ramps... regardless of saved
  // skill". Start the sim at a near-max size (as if loaded from a long history) and check the first few rounds
  // are small anyway, then climb back toward that skill over ~15-25 rounds.
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 }, savedSkill = E.OO_S_MAX_COLS - 2;
  const { hist } = run(truths, savedSkill, 99001, 60);
  const early = hist.slice(0, 3).map(h => Math.max(h.rows, h.cols));
  const late = hist.slice(40, 60).map(h => Math.max(h.rows, h.cols));
  const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length, lateAvg = late.reduce((a, b) => a + b, 0) / late.length;
  console.log(`  saved skill: ${savedSkill}-long; first 3 rounds averaged ${earlyAvg.toFixed(1)}-long; rounds 40-60 averaged ${lateAvg.toFixed(1)}-long`);
  if (earlyAvg > E.OO_S_RAMP_FLOOR + E.OO_S_BAND + 1) { console.log(`FAIL: a fresh run with a high saved skill (${savedSkill}) should still start chill (near ${E.OO_S_RAMP_FLOOR}-long), got ${earlyAvg.toFixed(1)} averaged over the first 3 rounds`); fail = true; }
  if (lateAvg < savedSkill - E.OO_S_BAND - 1) { console.log(`FAIL: by rounds 40-60 the run should have climbed back near the saved skill (${savedSkill}), got ${lateAvg.toFixed(1)} averaged`); fail = true; }
  // the band varies round to round even once the ramp has settled (not one ratcheting number held flat)
  const settledWindow = hist.slice(40, 60).map(h => Math.max(h.rows, h.cols)), distinct = new Set(settledWindow).size;
  console.log(`  distinct sizes seen in rounds 40-60: ${distinct} (should be > 1 -- a band, not one held number)`);
  if (distinct < 2) { console.log("FAIL: the grid size never varied once the ramp settled -- expected a band, not a single held size"); fail = true; }
}
console.log("\n== Never an obvious pop (David, 2026-10-11: \"never super easy or super obvious\") ==");
{
  // every round's drawn gap should sit at or under the easiness ceiling (2.5x that round's own threshold, and
  // an absolute ΔE00 well under "pops out") -- check across a typical eye's whole run, including the chill,
  // ramped-down opening rounds where a naive implementation would be most tempted to over-compensate with size.
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { hist } = run(truths, 3, 424242, 300);
  // the generator aims for the ceiling via a binary search in-gamut (ooMoveDir/ooMove), which has its own small
  // granularity -- a fraction of a ΔE00 of overshoot on an awkward stop is the search's tolerance, not a broken
  // cap, so this allows a little slack above the target rather than demanding floating-point-exact targeting.
  const SLACK = 1.2;
  let overAbs = 0;
  hist.forEach(h => { if (h.act > E.OO_S_EASE_MAX + SLACK) overAbs++; });
  console.log(`  rounds over the absolute ΔE00 ceiling (${E.OO_S_EASE_MAX} + ${SLACK} search slack): ${overAbs} of ${hist.length} (must be 0)`);
  if (overAbs > 0) { console.log(`FAIL: ${overAbs} rounds drew a gap clearly above the easiness ceiling`); fail = true; }
  // a first-run median "reaction time" proxy: at ooP's own psychometric curve, a gap right at the ceiling still
  // leaves real uncertainty (not near-100% correct), which is the sim's stand-in for "needs a real look" --
  // true reaction-time needs a live player, this just checks the gap was never dialed so far past threshold
  // that the answer is a foregone conclusion even on the very first, chill rounds.
  const first10 = hist.slice(0, 10), ratios = first10.map(h => h.act / Math.max(.5, E.ooTheta({ j: {} }, h.axis, null)));
  console.log(`  first 10 rounds' gap as a multiple of the START threshold: ${ratios.map(x => x.toFixed(1)).join(", ")}`);
}
console.log("\n== No flat boards, anywhere ==");
{
  // David, 2026-10-11: "remove flat boards entirely". Checked across every run above.
  const allFlat = [20261010, 555, 777, 99001].reduce((sum, seed) => {
    const { richCount } = run({ hue: 1.8, light: 1.3, chroma: 2.3 }, 3, seed, 120);
    return sum + (richCount.flat || 0);
  }, 0);
  console.log(`  flat boards drawn across 4 runs of 120 rounds: ${allFlat} (must be 0)`);
  if (allFlat > 0) { console.log(`FAIL: ${allFlat} flat boards were drawn -- flat should be gone entirely now`); fail = true; }
}
console.log(fail ? "\nFAIL" : "\nPASS");
process.exit(fail ? 1 : 0);
