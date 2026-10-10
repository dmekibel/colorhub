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
// David, 2026-10-11, final word on grid size: FIXED for a whole run (no band, no ramp) -- the player picks it
// before the run (size0) -- except a slow, one-column-at-a-time GROWTH every ~10-12 correct (not necessarily
// consecutive), Arcade only by default, capped (gridHi, a phone-appropriate ~8 columns, never the engine's own
// abstract 3-20 scale). grows=false reproduces Zen's own default (never changes on its own).
function run(truths, size0, seed, n = 400, aspect = 1.6, richMode = "subtle", gridHi = 8, grows = true) {
  const rnd = E.ooRnd(seed);
  const model = E.ooModel({});
  let size = size0, hits = 0, hitsAtGrow = 0, growAt = 10 + Math.floor(rnd() * 3), grewCount = 0;
  const hist = [];
  let subFloor = 0, floorRounds = 0, drawCount = 0, gradRounds = 0, gradEarly = 0, richCount = { flat: 0, grad1: 0, grad2: 0, grad3: 0 }, worstNeighborRatio = 0;
  for (let t = 0; t < n; t++) {
    const breather = t > 0 && t % 5 === 4;
    let r = null;
    for (let tries = 0; tries < 6 && !r; tries++) {
      const palette = TEST_PALETTES[Math.floor(rnd() * TEST_PALETTES.length)];
      r = E.ooSimpleRound({ model, cols: size, round: t, aspect, palette, richMode }, breather, rnd);
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
    if (ok) {
      hits++;
      if (grows && size < gridHi && hits - hitsAtGrow >= growAt) { size++; grewCount++; hitsAtGrow = hits; growAt = 10 + Math.floor(rnd() * 3); }
    }
    hist.push({ t, axis: r.axis, act: r.act, ok, size, rows: r.rows, cols: r.cols, shape: r.v, gridType: r.gridType });
  }
  return { model, hist, subFloor, floorRounds, drawCount, gradRounds, gradEarly, richCount, worstNeighborRatio, grewCount };
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
  console.log(`  board reached by round 400: ${last.rows} x ${last.cols} (started at 3 columns, grows to the 8-column phone cap)`);
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
  console.log(`  board reached by round 400: ${last.rows} x ${last.cols} (should hit the 8-column phone cap: once the floor binds, size is the only difficulty lever left)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  // richness is now a real difficulty lever of its own (a richer ground gets a bigger bf-compensated gap even
  // when the raw per-axis estimate has hit its floor), so "near the floor" is rarer than before gradients became
  // the default -- the hard requirement is subFloor === 0 above; this is just a sanity floor on top of that.
  if (floorRounds < drawCount * .1) { console.log("FAIL: a sharp eye should still spend some rounds near the floor, not scaling up with true ability"); fail = true; }
  if (last.cols !== 8) { console.log(`FAIL: a sharp eye never reached the 8-column phone cap, stopped at ${last.cols}`); fail = true; }
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
console.log("\n== Grid size is fixed per run except a slow, monotonic growth (David, 2026-10-11, final word) ==");
{
  // same size for the whole run outside of a deliberate growth step: never a round-to-round jump, never a
  // decrease, and growth stops dead at the chosen cap.
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { hist, grewCount } = run(truths, 4, 20261011, 300, 1.6, "subtle", 8, true);
  let badJump = 0, shrank = 0, overCap = 0;
  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1].cols, cur = hist[i].cols;
    if (cur < prev) shrank++;
    if (cur > prev + 1) badJump++;
    if (cur > 8) overCap++;
  }
  console.log(`  started at 4 columns, grew ${grewCount} times over 300 rounds, ended at ${hist[hist.length - 1].cols} columns`);
  console.log(`  round-to-round: ${shrank} decreases, ${badJump} jumps of more than 1 column, ${overCap} over the 8-column cap (all must be 0)`);
  if (shrank > 0) { console.log(`FAIL: the grid shrank ${shrank} times -- it should only ever grow within a run`); fail = true; }
  if (badJump > 0) { console.log(`FAIL: the grid jumped by more than one column ${badJump} times`); fail = true; }
  if (overCap > 0) { console.log(`FAIL: the grid exceeded its own 8-column cap ${overCap} times`); fail = true; }
  if (grewCount < 3) { console.log(`FAIL: a 300-round run at ~78% accuracy should grow several times (every ~10-12 correct), only grew ${grewCount}`); fail = true; }
  // Zen's own default: grows=false, so the size genuinely never moves
  const { hist: zenHist } = run(truths, 6, 20261011, 200, 1.6, "subtle", 8, false);
  const zenSizes = new Set(zenHist.map(h => h.cols));
  console.log(`  Zen (grows off, the default there): ${zenSizes.size} distinct column count(s) across 200 rounds (must be 1)`);
  if (zenSizes.size !== 1) { console.log(`FAIL: Zen's grid changed on its own (${zenSizes.size} distinct sizes) even with growth off`); fail = true; }
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
console.log("\n== Classic style: square board, near the chosen column count, one solid color ==");
{
  const rnd = E.ooRnd(99);
  const model = E.ooModel({});
  let bad = 0, notFlat = 0;
  for (let t = 0; t < 40; t++) {
    const r = E.ooSimpleRound({ model, cols: 6, round: t, aspect: 1.6, style: "classic" }, false, rnd);
    if (r.rows !== r.cols) bad++;
    if (r.gridType !== "flat") notFlat++;
  }
  console.log(`  Classic at 6 columns: ${bad} of 40 rounds not square, ${notFlat} not a single solid color`);
  if (bad > 0) { console.log(`FAIL: Classic drew ${bad} non-square rounds`); fail = true; }
  if (notFlat > 0) { console.log(`FAIL: Classic drew ${notFlat} rounds that weren't a single solid color`); fail = true; }
}
console.log("\n== Near-square tiles (David, 2026-10-11: \"too tall... closer to square is better\") ==");
{
  let worst = 1;
  for (const cols of [4, 5, 6, 8]) {
    const d = E.ooSimpleDims(cols, 1.6);   // a typical portrait phone aspect
    const tileAspect = (1 / d.cols) / ((1 / d.rows) * 1.6);   // (tile width / tile height), 1 = perfectly square
    worst = Math.min(worst, Math.min(tileAspect, 1 / tileAspect));
    console.log(`  ${cols} columns -> ${d.cols} x ${d.rows}, tile aspect ${tileAspect.toFixed(2)}`);
  }
  console.log(`  worst tile squareness: ${worst.toFixed(2)} (must stay at or above 1:1.15, i.e. >= ${(1 / 1.15).toFixed(2)})`);
  if (worst < 1 / 1.15) { console.log(`FAIL: a tile strayed further than 1:1.15 from square (${worst.toFixed(2)})`); fail = true; }
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
