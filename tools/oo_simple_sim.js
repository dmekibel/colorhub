"use strict";
// A quick simulated player for the simple Odd one out game (js/games/oo-engine.js: ooSimpleAxis/ooSimpleD/
// ooSimpleShape/ooPaletteRound/ooSimpleRound/ooSimpleGrid). Each axis has a known JND; the simulated player is
// right with the same psychometric curve the engine itself uses (ooP), centered on that true threshold, drawing
// real rounds through ooSimpleRound so the guessing rate (g) and the actually-drawn gap are the real ones, not an
// approximation. Checks the staircase settles near 75-80% within about 15 rounds, that a typical eye grows the
// grid, and that a very sharp eye (below every axis's visibility floor) never gets a sub-floor round -- the grid
// keeps climbing instead. node tools/oo_simple_sim.js
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
  let subFloor = 0, floorRounds = 0, drawCount = 0;
  for (let t = 0; t < n; t++) {
    const breather = t > 0 && t % 5 === 4;
    let r = null;
    for (let tries = 0; tries < 6 && !r; tries++) r = E.ooSimpleRound({ model, cols }, breather, rnd);
    if (!r) continue;   // an unlucky draw (rare): skip, same as the UI would retry
    drawCount++;
    const floor = E.OO_S_FLOOR[r.axis];
    if (r.act < floor - 1e-6) subFloor++;
    if (r.act <= floor * 1.5) floorRounds++;   // near the floor, whatever the model's own (possibly much sharper) estimate says
    const ok = rnd() < E.ooP(r.act, truths[r.axis], r.g || 0);
    if (r.judg && E.OO_AXES.includes(r.judg)) E.ooUpdate(model, r.judg, null, r.act, ok, r.g || 0);
    acc.push(ok ? 1 : 0); if (acc.length > E.OO_S_WINDOW) acc.shift();
    const next = E.ooSimpleGrid(cols, acc);
    if (next !== cols) { cols = next; acc = []; }
    hist.push({ t, axis: r.axis, act: r.act, ok, cols, shape: r.v });
  }
  return { model, hist, subFloor, floorRounds, drawCount };
}
const accOf = (hist, from, to) => { const s = hist.slice(from, to); return s.length ? s.filter(x => x.ok).length / s.length : 0; };

let fail = false;
console.log("== A typical eye (hue 1.8, value 1.3, saturation 2.3 ΔE00) ==");
{
  const truths = { hue: 1.8, light: 1.3, chroma: 2.3 };
  const { model, hist, subFloor } = run(truths, 3, 20261010);
  console.log(`  rounds 1-15:   ${(accOf(hist, 0, 15) * 100).toFixed(0)}% right`);
  console.log(`  rounds 16-50:  ${(accOf(hist, 15, 50) * 100).toFixed(0)}% right`);
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right`);
  E.OO_AXES.forEach(a => { const th = Math.exp(model.j[a] ? model.j[a].r : Math.log(E.OO_START[a])); console.log(`  ${a.padEnd(7)} estimate ${th.toFixed(2)} (true ${truths[a]})`); });
  console.log(`  grid reached by round 400: ${hist[hist.length - 1].cols} x ${hist[hist.length - 1].cols} (started 3 x 3)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  const settled = accOf(hist, 50, 400);
  if (settled < .68 || settled > .90) { console.log(`FAIL: settled accuracy ${(settled * 100).toFixed(0)}% is outside 68-90%`); fail = true; }
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  if (hist[hist.length - 1].cols <= 3) { console.log("FAIL: the grid never grew past 3 x 3 for a typical eye"); fail = true; }
}
console.log("\n== A very sharp eye (hue 0.5, value 0.4, saturation 0.5 ΔE00, all below the floor) ==");
{
  const truths = { hue: .5, light: .4, chroma: .5 };
  const { hist, subFloor, floorRounds, drawCount } = run(truths, 3, 777);
  console.log(`  rounds 51-400: ${(accOf(hist, 50, 400) * 100).toFixed(0)}% right (near-ceiling is expected: the floor is easier than this eye needs)`);
  console.log(`  rounds drawn near the visibility floor (within 1.5x it): ${floorRounds} of ${drawCount}`);
  console.log(`  grid reached by round 400: ${hist[hist.length - 1].cols} x ${hist[hist.length - 1].cols} (should hit the 9 x 9 cap: once the floor binds, the grid is the only difficulty lever left)`);
  console.log(`  rounds drawn below the visibility floor: ${subFloor} (must be 0)`);
  if (subFloor > 0) { console.log(`FAIL: ${subFloor} rounds drawn below their axis's visibility floor`); fail = true; }
  if (floorRounds < drawCount * .5) { console.log("FAIL: a sharp eye should spend most rounds near the floor, not scaling up with true ability"); fail = true; }
  if (hist[hist.length - 1].cols !== E.OO_S_MAX_COLS) { console.log(`FAIL: a sharp eye never reached the ${E.OO_S_MAX_COLS} x ${E.OO_S_MAX_COLS} cap`); fail = true; }
}
console.log(fail ? "\nFAIL" : "\nPASS");
process.exit(fail ? 1 : 0);
