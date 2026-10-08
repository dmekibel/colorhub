// Tests for Gradients, the rearrange puzzle engine (js/games/hue-engine.js). Run: node tools/hue_test.js
// Checks, on every level of every world at three eyes (sharp, typical, coarse) and on 60 daily boards:
//   solvability: every board passes the by-eye checks (neighbor steps ≥ HG_MIN_STEP, any two slots ≥ HG_MIN_PAIR),
//                every deal can be solved (swapping tiles home reaches solved in exactly par moves), anchors stay put;
//   even steps:  along every row and column the largest step is within HG_EVEN × the smallest (CIEDE2000),
//                and the warp makes lines more even than plain OKLab interpolation;
//   adaptive:    a sharper eye gets finer steps on the same level, and form (k) moves with how you solve;
//   seeds:       the same seed builds the same board and the same deal; the daily is the same all day, new tomorrow;
//   colors:      every tile is on screen (a real hex), corners come from the source palette.
// Exits 1 on any failure.
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- percent display"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lib = new Function("clamp", math + "\nreturn { rgb, lab, lch, labRgb, inGamut, labHex, lchHex, de2000, ink };")(clamp);
Object.assign(global, lib, { clamp });
const E = require("../js/games/hue-engine.js");
const win = {};
for (const f of ["paintings.js", "gems.js", "fashion.js"]) new Function("window", fs.readFileSync(path.join(__dirname, "../data", f), "utf8"))(win);

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL  " + msg); } };
const say = s => console.log(s);

// ---------- the sources, resolved the way js/games/hue-ui.js does ----------
const src = {
  painters: E.HG_PAINTINGS.map(id => { const p = win.PAINTINGS.find(x => x.id === "painting-" + id); return p && { id, pal: p.palette.map(c => c.h) }; }),
  gardens: E.HG_GARDENS.map(g => ({ id: g.id, pal: g.pal })),
  gems: E.HG_GEMS.map(id => { const g = win.GEMS.gems.find(x => x.id === id); return g && { id, pal: g.palette.map(p => p[0]) }; }),
  decades: E.HG_DECADES.map(d => { const ids = Array.isArray(d) ? d : [d], ds = ids.map(x => win.FASHION.decades.find(y => y.id === x)); return { id: ids.join("-"), pal: ds.flatMap(x => x.swatches.slice(0, Array.isArray(d) ? 3 : 6).map(s => s[0])) }; }),
  yours: Array.from({ length: 15 }, (_, i) => ({ id: "y" + i, pal: ["#E8A0B4", "#3A5BB8", "#F4A261", "#2E8B57", "#8E4585", "#F2D24B", "#5F9EA0"].slice(i % 3, (i % 3) + 4 + (i % 4)) })),
};
Object.entries(src).forEach(([w, l]) => ok(l.every(Boolean) && l.length >= E.HG_WORLDS.find(x => x.id === w).n, `${w}: ${l.filter(Boolean).length} sources for ${E.HG_WORLDS.find(x => x.id === w).n} levels`));

// ---------- 1. every level builds a solvable, even board ----------
say("Every level of every world, at three eyes (threshold 0.9, 2.2, 4.5):");
const stats = { boards: 0, forced: 0, even: [], ms: [] };
const pinned = {};
E.HG_WORLDS.forEach((W, w) => {
  for (let i = 0; i < W.n; i++) {
    const meds = [];
    for (const th of [.9, 2.2, 4.5]) {
      const spec = E.hgLevelSpec(w, i, src[W.id][i], th, 1, 0), t0 = Date.now(), b = E.hgBuild(spec), ms = Date.now() - t0;
      stats.boards++; stats.ms.push(ms); if (b.fit.forced) stats.forced++;
      const m = E.hgMeasure(b.geo, b.hex), tag = `${W.id} ${i + 1} (${spec.shape} ${spec.n}${spec.twist ? " " + spec.twist : ""}, eye ${th})`;
      stats.even.push(m.even);
      ok(m.min >= E.HG_MIN_STEP - 1e-9, `${tag}: smallest neighbor step ${m.min.toFixed(2)} under ${E.HG_MIN_STEP}`);
      ok(m.minPair >= E.HG_MIN_PAIR - 1e-9, `${tag}: two slots only ${m.minPair.toFixed(2)} apart`);
      ok(m.even <= E.HG_EVEN + 1e-9, `${tag}: a line's steps vary ${m.even.toFixed(2)}x`);
      ok(b.hex.every(h => /^#[0-9A-F]{6}$/.test(h)), `${tag}: a tile isn't a screen color`);
      ok(b.anchors.length >= 2 && b.anchors.length < b.hex.length - 1, `${tag}: ${b.anchors.length} anchors of ${b.hex.length}`);
      ok(new Set(b.anchors).size === b.anchors.length, `${tag}: duplicate anchors`);
      ok(!b.fit.forced, `${tag}: fell back to the stand-in palette`);
      // the deal: anchors stay, nothing starts home, par moves solve it
      const at = E.hgDeal(b, E.hgRnd(E.hgHash(spec.deal)));
      ok(b.anchors.every(a => at[a] === a), `${tag}: an anchor moved in the deal`);
      ok(!E.hgSolved(b, at), `${tag}: dealt already solved`);
      const par = E.hgPar(b, at);
      let moves = 0;
      for (let s = 0; s < at.length && moves < 1000; s++) {
        if (E.hgHome(b, at, s) || (b.geo.twins && b.geo.cells[s].i >= b.geo.n / 2)) continue;
        const from = at.findIndex((t, k) => t === s || b.hex[t] === b.hex[s] && !E.hgHome(b, at, k));
        E.hgSwap(b, at, s, from); moves++; s = -1;
      }
      ok(E.hgSolved(b, at), `${tag}: greedy swaps did not solve it`);
      ok(moves === par, `${tag}: solved in ${moves} swaps, par says ${par}`);
      meds.push(b.step.med);
      if (th === 2.2) pinned[spec.id] = b.hex.join();
    }
    // a sharper eye gets finer steps: always finer than the coarse eye's, and within one board size of the typical eye's
    // (sizes are whole numbers and every board must pass the checks, so neighbors in eye can land a little apart)
    ok(meds[0] <= meds[2] * 1.05 && meds[1] <= meds[2] * 1.05 && meds[0] <= meds[1] * 1.3, `${W.id} ${i + 1}: steps ${meds.map(x => x.toFixed(2)).join(" / ")} should not shrink as the eye coarsens`);
    stats.byEye = stats.byEye || [0, 0, 0]; meds.forEach((m, k) => { stats.byEye[k] += Math.log(m); });
  }
});
const evs = stats.even.slice().sort((a, b) => a - b), msS = stats.ms.slice().sort((a, b) => a - b);
say(`  ${stats.boards} boards, ${stats.forced} fell back; line evenness median ${evs[evs.length >> 1].toFixed(2)}x, worst ${evs[evs.length - 1].toFixed(2)}x; build median ${msS[msS.length >> 1]} ms, worst ${msS[msS.length - 1]} ms`);
{
  const g = stats.byEye.map(x => Math.exp(x / (stats.boards / 3)));
  say(`  typical step by eye: sharp ${g[0].toFixed(2)}, typical ${g[1].toFixed(2)}, coarse ${g[2].toFixed(2)} (ΔE00, geometric means)`);
  ok(g[0] < g[1] * .9 && g[1] < g[2] * .9, "on average, the sharper the eye the finer the steps");
}
ok(msS[Math.floor(msS.length * .95)] < 1000, `95% of boards should build in under 1000 ms (${msS[Math.floor(msS.length * .95)]} ms)`);

// ---------- 2. the warp evens the steps ----------
{
  let better = 0, tot = 0;
  for (const s of src.painters.concat(src.gems, src.gardens)) {
    // a 5 × 5 of the full palette: steps big enough that 8-bit rounding doesn't decide the ratio
    const C = E.hgCornerSets(s.pal, E.hgRnd(1), 1)[0].map(E.hgOk), geo = E.hgGeo("rect", 5);
    const plain = { kind: "bi", C, wu: t => t, wv: t => t }, warped = { kind: "bi", C, wu: E.hgWarp("bi", C, "u"), wv: E.hgWarp("bi", C, "v") };
    const a = E.hgMeasure(geo, E.hgPaint(geo, [plain]), false).evenMean, b = E.hgMeasure(geo, E.hgPaint(geo, [warped]), false).evenMean;
    tot++; if (b <= a + .02) better++;
  }
  say(`Warp: rows and columns as even or more even than plain OKLab in ${better} of ${tot} palettes`);
  ok(better / tot >= .8, `the CIEDE2000 warp should even out at least 80% of palettes (${better}/${tot})`);
}

// ---------- 3. adaptive difficulty ----------
{
  const T1 = E.hgTarget(1, 2), T2 = E.hgTarget(3, 2);
  ok(T1 < T2, `the target follows the eye (${T1.toFixed(2)} vs ${T2.toFixed(2)})`);
  ok(E.hgTarget(.1, 1) >= E.HG_MIN_STEP * 1.3 - 1e-9, "the target never drops under the floor");
  let k = 1; for (let i = 0; i < 6; i++) k = E.hgForm(k, { solved: true, hints: 0, par: 20, moves: 21 });
  ok(k < .7, `clean solves make the boards finer (form ${k.toFixed(2)})`);
  let k2 = 1; for (let i = 0; i < 6; i++) k2 = E.hgForm(k2, { solved: true, hints: 2, par: 20, moves: 60 });
  ok(k2 > 1.3, `hints and long searches make them gentler (form ${k2.toFixed(2)})`);
  ok(E.hgForm(1.6, { solved: false, par: 10, moves: 30 }) <= 1.6 && E.hgForm(.6, { solved: true, par: 10, moves: 10 }) >= .6, "form stays in range");
  // the ladder: boards grow, anchors thin, twists arrive easier
  const sizes = E.HG_LADDER.map(R => E.hgGeo(R.s, R.n, { m: R.m, K: R.K }).cells.length);
  ok(sizes[sizes.length - 1] >= 100 && sizes[0] <= 16, `the ladder grows from ${sizes[0]} to ${sizes[sizes.length - 1]} tiles`);
  ok(E.HG_LADDER.every((R, i) => !R.t || i === 0 || R.x >= E.HG_LADDER[i - 1].x * .98 || ["onehue", "onelight", "blind", "timer", "moves"].includes(R.t)), "a twist level is never harder than the level before it");
  const lastWorld = E.HG_WORLDS.length - 2, big = E.hgLevelSpec(lastWorld, E.HG_WORLDS[lastWorld].n - 1, src.decades[14], 2.2);
  ok(big.n === 12, `the last Decades level is a 12 × 12 (${big.n})`);
}

// ---------- 3b. Choose mode: a fixed difficulty, whatever the eye; Expert boards still pass every check ----------
{
  const ds = Object.keys(E.HG_DIFF), Ts = ds.map(d => E.hgDiffT(d, 0));
  ok(Ts.every((t, i) => !i || t < Ts[i - 1]), `difficulties order Easy > Medium > Hard > Expert (${Ts.map(t => t.toFixed(1)).join(", ")})`);
  let n = 0, bad = 0;
  const meanStep = ds.map(() => 0);
  E.HG_WORLDS.forEach((W, w) => { for (let i = 0; i < W.n; i += 3) ds.forEach((d, k) => {
    const a = E.hgLevelSpec(w, i, src[W.id][i], .8, .6, 0, d), b = E.hgLevelSpec(w, i, src[W.id][i], 5, 1.6, 0, d);
    ok(a.T === b.T, `${W.id} ${i + 1} ${d}: the chosen step ignores the eye (${a.T} vs ${b.T})`);
    const bd = E.hgBuild(a), m = E.hgMeasure(bd.geo, bd.hex); n++;
    if (!(m.min >= E.HG_MIN_STEP && m.minPair >= E.HG_MIN_PAIR && m.even <= E.HG_EVEN) || bd.fit.forced) bad++;
    meanStep[k] += Math.log(bd.step.med);
  }); });
  ok(!bad, `${bad} of ${n} chosen-difficulty boards failed a check`);
  const g = meanStep.map(x => Math.exp(x / (n / ds.length)));
  say(`Choose mode: typical step ${ds.map((d, k) => `${d} ${g[k].toFixed(2)}`).join(", ")} (ΔE00)`);
  ok(g.every((x, i) => !i || x < g[i - 1]), "harder choices give finer boards");
}

// ---------- 4. seeds ----------
{
  const spec = E.hgLevelSpec(0, 7, src.painters[7], 2.2), a = E.hgBuild(spec), b = E.hgBuild(spec);
  ok(a.hex.join() === b.hex.join() && a.anchors.join() === b.anchors.join(), "the same level builds the same board");
  ok(E.hgDeal(a, E.hgRnd(E.hgHash("x"))).join() === E.hgDeal(b, E.hgRnd(E.hgHash("x"))).join(), "the same seed deals the same way");
  ok(E.hgDeal(a, E.hgRnd(E.hgHash("x"))).join() !== E.hgDeal(a, E.hgRnd(E.hgHash("y"))).join(), "another attempt deals differently");
  const daily = [...src.painters, ...src.gardens, ...src.decades], days = [];
  for (let d = 0; d < 60; d++) {
    const dt = new Date(Date.UTC(2026, 9, 8 + d)), key = dt.toISOString().slice(0, 10), s1 = E.hgDailySpec(key, daily), s2 = E.hgDailySpec(key, daily);
    const b1 = E.hgBuild(s1), b2 = E.hgBuild(s2);
    ok(b1.hex.join() === b2.hex.join() && E.hgDeal(b1, E.hgRnd(E.hgHash(s1.deal))).join() === E.hgDeal(b2, E.hgRnd(E.hgHash(s2.deal))).join(), `daily ${key}: the same board for everyone`);
    const m = E.hgMeasure(b1.geo, b1.hex);
    ok(m.min >= E.HG_MIN_STEP && m.minPair >= E.HG_MIN_PAIR && m.even <= E.HG_EVEN && !b1.fit.forced, `daily ${key}: board passes the checks`);
    days.push(b1.hex.join());
    ok(s1.num === d + 1, `daily ${key} is #${s1.num}`);
  }
  ok(new Set(days).size === days.length, "every day of two months has its own board");
  ok(E.hgShareText(4, "hex", { moves: 31, par: 27, hints: 0 }) === "ColorHub · Gradients #4 · Honeycomb: 31 moves (par 27), no hints", "the share line");
}

// ---------- 5. shapes and twists ----------
{
  for (const s of E.HG_SHAPES) {
    const g = E.hgGeo(s, s === "hex" ? 3 : s === "ring" ? 14 : s === "spiral" ? 24 : s === "arch" ? 9 : 6, { K: 2 });
    ok(g.cells.length >= 9 && g.lines.length >= 1, `${s}: ${g.cells.length} cells, ${g.lines.length} lines`);
    ok(g.cells.every(c => c.x >= -.002 && c.y >= -.002 && c.x + c.w <= 1.002 && c.y + c.h <= 1.002), `${s}: a cell sits outside the board`);
    ok(g.cells.every(c => c.u >= -1e-9 && c.u <= 1 + 1e-9 && c.v >= -1e-9 && c.v <= 1 + 1e-9), `${s}: a field coordinate out of range`);
  }
  const holes = E.hgGeo("holes", 8), rect = E.hgGeo("rect", 8);
  ok(holes.cells.length < rect.cells.length, `the window has holes (${holes.cells.length} of ${rect.cells.length})`);
  // mirror: every move is mirrored, twins share a color
  const mb = E.hgBuild({ shape: "mirror", n: 8, anchors: "few", pal: src.gardens[0].pal, T: 4, seed: "m" }), mt = mb.geo.twins;
  ok(mb.hex.every((h, i) => h === mb.hex[mt[i]]), "mirror twins share a color");
  const mat = E.hgDeal(mb, E.hgRnd(5));
  ok(mat.every((t, s) => mb.hex[t] === mb.hex[mat[mt[s]]]), "the mirror deal is symmetric");
  // weave: two different gradients
  const wb = E.hgBuild({ shape: "weave", n: 6, anchors: "half", pal: src.painters[1].pal, pal2: src.painters[1].pal, T: 4, seed: "w" });
  ok(new Set(wb.geo.cells.map(c => c.f)).size === 2, "the weave has two gradients");
  // one hue / one lightness
  const oh = E.hgBuild({ shape: "diamond", n: 7, anchors: "few", mode: "onehue", pal: src.gems[0].pal, T: 3, seed: "h" });
  const hs = oh.hex.map(h => E.hgLch(E.hgOk(h))).filter(x => x[1] > .03).map(x => x[2]), spread = Math.max(...hs) - Math.min(...hs);
  ok(spread < 12, `one hue: hues spread ${spread.toFixed(1)}° (OKLCh)`);
  const ol = E.hgBuild({ shape: "rect", n: 7, m: 8, anchors: "few", mode: "onelight", pal: src.painters[0].pal, T: 3, seed: "l" });
  const Ls = ol.hex.map(h => E.hgOk(h)[0]), lspread = Math.max(...Ls) - Math.min(...Ls);
  ok(lspread < .05, `one lightness: OKLab L spread ${lspread.toFixed(3)}`);
  // a palette of near-greys still gets a solvable board
  const grey = E.hgBuild({ shape: "rect", n: 8, anchors: "corners", pal: ["#808080", "#828282", "#7F7F80"], T: 3, seed: "g" });
  const gm = E.hgMeasure(grey.geo, grey.hex);
  ok(gm.min >= E.HG_MIN_STEP && gm.minPair >= E.HG_MIN_PAIR, "a grey palette still makes a solvable board");
  // axis words
  ok(E.hgAxis("#808080", "#909090") === "light" && E.hgAxis("#C04040", "#C05050") !== "light", "the axis of a wrong drop");
}

say(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
