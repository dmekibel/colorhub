// Tests for the Match engine model (js/match-model.js): scoring, tips, curves, grades, light, value, masses, paint mixing.
// Run: node tools/match_test.js   (exits 1 on any failure)
const M = require("../js/match-model.js");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg} (got ${a}, want ${b} ± ${tol})`);
const lch = l => [l[0], Math.hypot(l[1], l[2]), (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360];

// ---------- ΔE and set scores ----------
near(M.mtDE(50, 0, 0, 50, 0, 0), 0, 1e-9, "ΔE of identical colors");
near(M.mtDE(50, 2.6772, -79.7751, 50, 0, -82.7485), 2.0425, 1e-3, "CIEDE2000 Sharma test pair 1");
near(M.mtDE(50, 2.5, 0, 50, 0, -2.5), 4.3065, 1e-3, "CIEDE2000 Sharma test pair 7");
const def = { start: 12, top: 1.2 };
ok(M.mtLevelOf(def, 12) === 1 && M.mtLevelOf(def, 1.2) === 20 && M.mtLevelOf(def, 99) === 1 && M.mtLevelOf(def, .1) === 20, "levels map start -> 1 and top -> 20, clamped");
ok(M.mtLevelOf(def, null) === 0, "no score = level 0");
near(M.mtSetScore([2, 8]), 4, 1e-9, "set score is the geometric mean");
near(M.mtSetScore([0, 0]), .3, 1e-9, "a perfect round counts as 0.3");

// ---------- image scoring on a rendered scene ----------
const scene = M.mtScene("studio", 120, 80, [1, 1, 1], 5);
const truth = M.mtLabBuf(scene, 2);
near(M.mtMeanDE(truth, M.mtLabBuf(scene, 2)), 0, 1e-9, "an image scores 0 against itself");
const warm = M.mtApplyLuts(scene, M.mtLuts((c, v) => M.mtLinGain(v, [1.25, 1, .78][c])));
const warmLab = M.mtLabBuf(warm, 2), dWarm = M.mtMeanDE(truth, warmLab);
ok(dWarm > 3, `a visible warm cast scores above 3 ΔE (got ${dWarm.toFixed(2)})`);
const zWarm = M.mtZoneErr(truth, warmLab);
ok(zWarm.every(z => !z.n || z.db > 0), "a warm cast shows as +b* in every zone");

// ---------- tips (one specific fix from the signed error) ----------
const Z = (name, dL, da, db, n = 100) => ({ name, n, dL, da, db, de: Math.hypot(dL, da, db) });
ok(/highlights are still too warm/.test(M.mtGradeTip([Z("shadows", 0, 0, 1), Z("midtones", 0, 0, 1), Z("highlights", 0, 2, 9)])), "tip names the zone and 'warm'");
ok(/shadows are still too cool/.test(M.mtGradeTip([Z("shadows", 0, 1, -8), Z("midtones", 0, 0, 1), Z("highlights", 0, 0, 1)])), "tip: shadows too cool");
ok(/midtones are too dark/.test(M.mtGradeTip([Z("shadows", 0, 0, 0), Z("midtones", -9, 0, 1), Z("highlights", 0, 0, 1)])), "tip: midtones too dark");
ok(/over-corrected.*magenta/.test(M.mtGradeTip([Z("shadows", 0, 0, 0), Z("midtones", 0, 7, -1), Z("highlights", 0, 0, 0)], [Z("shadows", 0, 0, 0), Z("midtones", 0, -9, 0), Z("highlights", 0, 0, 0)])), "tip catches over-correction toward magenta");
ok(/Spot on/.test(M.mtGradeTip([Z("shadows", .2, .1, .1), Z("midtones", .3, 0, 0), Z("highlights", 0, .2, 0)])), "tip: spot on when the error is invisible");
ok(/^The image is still too warm/.test(M.mtGradeTip([Z("image", 0, 3, 8)], null, { whole: true })), "whole-image tip wording");
ok(M.mtHueWord(0, 10) === "yellow" && M.mtHueWord(-10, 0) === "cyan" && M.mtHueWord(10, 0) === "magenta" && M.mtHueWord(4, 9) === "warm" && M.mtHueWord(1, -10) === "cool", "a*b* direction words");

// ---------- curves: monotone spline -> 256-entry table ----------
const id = M.mtCurveLut([[0, 0], [1, 1]]);
ok(id.every((v, i) => Math.abs(v - i / 255) < 1e-9), "identity curve gives an identity table");
for (let t = 0; t < 200; t++) {
  const xs = [0, ...Array.from({ length: 1 + (t % 3) }, () => .05 + Math.random() * .9).sort(), 1];
  const ys = xs.map(() => Math.random()).sort((a, b) => a - b);
  const pts = xs.map((x, i) => [x, ys[i]]), lut = M.mtCurveLut(pts);
  let mono = true, inside = true;
  for (let i = 1; i < 256; i++) if (lut[i] < lut[i - 1] - 1e-9) mono = false;
  for (let i = 0; i < 256; i++) { const x = i / 255, k = pts.findIndex((p, j) => j < pts.length - 1 && x >= p[0] && x <= pts[j + 1][0]); if (k >= 0 && (lut[i] < pts[k][1] - 1e-9 || lut[i] > pts[k + 1][1] + 1e-9)) inside = false; }
  if (!mono || !inside) { ok(false, `monotone curve through ${JSON.stringify(pts)} (mono ${mono}, no overshoot ${inside})`); break; }
  if (t === 199) ok(true, "200 random monotone curves: tables never decrease and never overshoot their points");
}
const flat = M.mtCurveLut([[0, .2], [.5, .2], [1, .9]]);
ok(flat.slice(0, 128).every(v => Math.abs(v - .2) < 1e-9), "a flat segment stays flat (no ringing)");

// ---------- color wheels ----------
ok([0, .3, .7, 1].every(x => [0, 1, 2].reduce((s, c) => s + M.mtOff({ x, y: .4, m: 0 }, c), 0) < 1e-9), "wheel offsets sum to zero across r, g, b (pure color, no brightness)");
const g0 = { lift: { x: 0, y: 0, m: 0 }, gamma: { x: 0, y: 0, m: 0 }, gain: { x: 0, y: 0, m: 0 } };
ok([0, 1, 2].every(c => Array.from({ length: 256 }, (_, i) => i / 255).every(v => Math.abs(M.mtGradeCh(g0, c, v) - v) < 1e-12)), "centered wheels are an identity grade");
const up = M.mtGradeCh({ gain: { x: 0, y: 0, m: .3 } }, 0, .5), dn = M.mtGradeCh({ gain: { x: 0, y: 0, m: -.3 } }, 0, .5);
ok(up > .5 && dn < .5, "gain brightness raises / lowers the image");
const liftBlack = M.mtGradeCh({ lift: { x: 0, y: 0, m: .5 } }, 1, 0), liftWhite = M.mtGradeCh({ lift: { x: 0, y: 0, m: .5 } }, 1, 1);
ok(liftBlack > .05 && Math.abs(liftWhite - 1) < 1e-9, "lift moves black, leaves white");
// a linear-light cast is undone by the matching gain-wheel position (what Kill the cast relies on)
const s = .4, th = 1.1, cast = [0, 1, 2].map(c => 2 ** (s * Math.cos(th - [100, 220, 340][c] * Math.PI / 180)));
const fix = { gain: { x: -s / 1.1 * Math.cos(th), y: -s / 1.1 * Math.sin(th), m: 0 } };
const fixed = M.mtApplyLuts(scene, M.mtLuts((c, v) => M.mtGradeCh(fix, c, M.mtLinGain(v, cast[c]))));
const dCast = M.mtMeanDE(truth, M.mtLabBuf(M.mtApplyLuts(scene, M.mtLuts((c, v) => M.mtLinGain(v, cast[c]))), 2)), dFixed = M.mtMeanDE(truth, M.mtLabBuf(fixed, 2));
ok(dFixed < 1.5 && dCast > 5, `the gain wheel can undo a cast (cast ${dCast.toFixed(1)} ΔE -> fixed ${dFixed.toFixed(2)} ΔE)`);

// ---------- light: kelvin, tint, mireds ----------
const d65 = M.mtLightGains(6504, 0);
ok(d65.every(x => Math.abs(x - 1) < 1e-9), "6504 K, tint 0 = no change");
const t27 = M.mtLightGains(2700), t75 = M.mtLightGains(7500);
ok(t27[0] > t27[1] && t27[1] > t27[2], "2700 K light is red > green > blue");
ok(t75[2] > t75[0], "7500 K light is bluer than red");
ok(M.mtLightGains(5000, 5)[1] < M.mtLightGains(5000, 0)[1] && M.mtLightGains(5000, -5)[1] > M.mtLightGains(5000, 0)[1], "positive tint = magenta (less green), negative = green");
near(M.mtKelvinScore({ K: 5000, t: 0 }, { K: 4000, t: 0 }).err, 50, 1e-9, "5000 K vs 4000 K = 50 mireds");
ok(M.mtMired(2700) - M.mtMired(3000) > M.mtMired(6500) - M.mtMired(7500), "2700->3000 K is a bigger mired step than 6500->7500 K (the claim in the station copy)");
ok(/warmer than it was/.test(M.mtKelvinTip({ K: 3000, t: 0 }, { K: 4000, t: 0 })), "Kelvin tip: guessed too warm");
ok(/cooler than it was/.test(M.mtKelvinTip({ K: 6000, t: 0 }, { K: 4000, t: 0 })), "Kelvin tip: guessed too cool");
ok(/Spot on/.test(M.mtKelvinTip({ K: 4050, t: 0 }, { K: 4000, t: 0 })), "Kelvin tip: spot on");

// ---------- value ----------
ok(/simultaneous contrast/.test(M.mtValueTip([{ label: "Spot 1", yours: 60, truth: 50, sur: 25 }])), "value tip blames a dark surround when a spot was set too light");
ok(/both of its neighbors/.test(M.mtValueTip([{ label: "Step 3", yours: 40, truth: 47 }])), "value tip for a scale step");
const grey = M.mtGrey(scene);
ok(Array.from({ length: 50 }, (_, i) => i * 37 % (grey.data.length / 4)).every(p => grey.data[p * 4] === grey.data[p * 4 + 1] && grey.data[p * 4 + 1] === grey.data[p * 4 + 2]), "greyscale has r = g = b");

// ---------- big masses: the majority filter makes bigger shapes ----------
const W = 60, H = 40, noisy = new Uint8Array(W * H).map((_, i) => ((i % W) < W / 2 ? 0 : 1) ^ (Math.random() < .15 ? 1 : 0));
const edges = m => { let e = 0; for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) if (m[y * W + x] !== m[y * W + x - 1]) e++; return e; };
const smooth = M.mtMajority(noisy, W, H, 2, 2, 2);
ok(edges(smooth) < edges(noisy) / 4, `majority filter removes speckle (${edges(noisy)} -> ${edges(smooth)} edges)`);
ok(/too light/.test(M.mtMassTip([{ name: "Denim", yours: [60, 0, -20], truth: [45, 0, -20], share: .5 }])), "mass tip: too light");
ok(/too strong/.test(M.mtMassTip([{ name: "Sage", yours: [55, -25, 15], truth: [55, -10, 6], share: .5 }])), "mass tip: too strong");

// ---------- Zorn palette mixing model ----------
const P = M.MT_PAINTS, one = i => P.map((_, j) => j === i ? 1 : 0);
const white = M.mtMix(one(0));
ok(white.lab[0] > 94 && lch(white.lab)[1] < 3, `titanium white comes out near white (L ${white.lab[0].toFixed(1)}, C ${lch(white.lab)[1].toFixed(1)})`);
ok(M.mtMix(one(3)).lab[0] < 30, "ivory black comes out dark");
for (let i = 1; i < 4; i++) {
  const pure = M.mtMix(one(i)), tint = M.mtMix(P.map((_, j) => j === i ? 1 : j === 0 ? 1 : 0));
  ok(tint.lab[0] > pure.lab[0], `white + ${P[i].name} is lighter than ${P[i].name} (${pure.lab[0].toFixed(1)} -> ${tint.lab[0].toFixed(1)})`);
}
const ochre = lch(M.mtMix(one(1)).lab), olive = lch(M.mtMix([0, 1, 0, .4]).lab);
ok(olive[2] > ochre[2] + 10 && olive[2] > 90, `ochre + black turns toward green-olive (hue ${ochre[2].toFixed(0)}° -> ${olive[2].toFixed(0)}°)`);
ok(lch(M.mtMix(one(2)).lab)[2] < 45, "vermilion is a red (hue below 45°)");
const target = M.mtMix([2, 1, .5, 0]).lab, best = M.mtZornBest(target);
ok(best.de < .6, `a reachable mix is found again (best ΔE ${best.de.toFixed(2)})`);
for (const h of ["#2E7D7A", "#2F5DA8", "#6A4C9C", "#4F8A3C", "#3F6E8C"]) {
  const b = M.mtZornBest(M.mtHexLab(h));
  ok(b.de > 10, `${h} is out of the Zorn palette's range (closest ΔE ${b.de.toFixed(1)})`);
}
ok(/more yellow ochre/.test(M.mtZornTip([2, .3, 0, 0], M.mtMix([2, 1.5, 0, 0]).lab)), "Zorn tip: add more of the missing paint");
ok(/less ivory black/.test(M.mtZornTip([2, 0, 0, 1.5], M.mtMix([2, 0, 0, .3]).lab)), "Zorn tip: use less of the extra paint");
ok(/Out of range/.test(M.mtZornTip([3, 0, 0, 1], M.mtHexLab("#2F5DA8"), M.mtZornBest(M.mtHexLab("#2F5DA8")))), "Zorn tip names the gamut for an unreachable target");

// ---------- speed: one LUT pass on a 360 x 270 image (what runs per drag frame) ----------
const big = M.mtScene("sky", 360, 270, [1, 1, 1], 2), luts = M.mtLuts((c, v) => M.mtGradeCh(fix, c, v)), t0 = process.hrtime.bigint();
for (let i = 0; i < 20; i++) M.mtApplyLuts(big, M.mtLuts((c, v) => M.mtGradeCh(fix, c, v)));
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
ok(ms < 12, `building + applying the grade tables takes ${ms.toFixed(2)} ms per frame (budget 12 ms)`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
