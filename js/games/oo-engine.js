"use strict";
// Odd one out, deepened: the pure engine (no DOM, no storage), so tools/games_test.js can load and test it.
// ROADMAP §2 (the Odd one out family), §3 (Rearrange), §4 (progression and flow), §5 (memory), §20 (the game
// grammar: Task × Board × Twist × Content); research/COLORNERD-IDEAS.md §5 (the staircase).
// Uses the color math from js/core.js (lab, lch, labHex, lchHex, inGamut, de2000) as globals; in node the test
// evaluates that same section of core.js first, so there is one copy of the math.
//
// The learner model (MASTER-PLAN §2): one hidden threshold per judgment (hue, lightness, vividness, context,
// memory) plus a small offset per color family. Every round has a difficulty on the same scale (a ΔE00, which
// reads as "% of the black-to-white difference"), and every answer nudges the estimate (an Elo / item-response
// update on the log threshold). Rounds are then drawn at a multiple of your threshold, so a set breathes:
// easy, medium, hard, easy, harder, boss.

// ---------- seeded randomness ----------
const ooHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const ooRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ooPick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const ooShuf = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ooBtw = (a, b, rnd) => a + rnd() * (b - a);

// ---------- the learner model ----------
const OO_JUDG = { hue: "Hue", light: "Lightness", chroma: "Vividness", context: "In context", memory: "From memory" };
const OO_AXES = ["hue", "light", "chroma"];
// starting thresholds (ΔE00): deliberately easy, so the first rounds are wins and the estimate comes down to you
// David, 2026-10-11: "the whole game is too easy... starting/sitting too easy" -- a brand-new player's hue/
// light/chroma threshold used to start at a coarse 6-7 ΔE00 (an easy gap), so early rounds (and any axis with
// little evidence yet) read as obvious. A new player now starts assumed moderate (~3.5-4 ΔE00), tightening
// fast with real evidence either way (ooUpdate already does that; only the starting point moves).
const OO_START = { hue: 4, light: 3.5, chroma: 4, context: 8, memory: 9 };
const OO_MIN = .4, OO_MAX = 30;
// psychometric model: p(right) = g + (1 - g - lapse) * logistic(slope * ln(d / threshold))
const OO_SLOPE = 3, OO_LAPSE = .03;
const ooP = (d, th, g = 0) => g + (1 - g - OO_LAPSE) / (1 + Math.exp(-OO_SLOPE * Math.log(Math.max(d, 1e-3) / th)));
// difficulty tiers, as multiples of your threshold (about 95%, 88%, 72%, 62% and 49% right before guessing; about 80% across a set)
const OO_TIER = { intro: 3.4, easy: 2.8, medium: 2, hard: 1.4, harder: 1.2, boss: 1 };
// a set breathes (ROADMAP §4): easy, medium, hard, easy, harder, boss
const OO_BREATH = ["easy", "medium", "hard", "easy", "harder", "boss"];
// what a variant or board adds on top of the plain judgment (rough priors, so the eye profile stays comparable
// across boards: the model is updated with d divided by these). Group is easier (a shape pools many tiles);
// twins and "which way" need a clearer difference; small tiles look less colorful.
const OO_VF = { one: 1, pair: 1, group: .72, count: 1.1, twins: 1.35, which: 1.3 };
const OO_BF = { grid: 1, ring: 1, honey: 1, strip: 1, sizes: 1, mosaic: 1.1, busy: 1, gradient: 1.2, painting: 1.8 };
// small tiles look less colorful and are harder to compare: a gap is drawn a little larger on big grids (Classic goes to 16 × 16)
const ooSizeF = cols => cols <= 4 ? 1 : cols === 5 ? 1.1 : cols === 6 ? 1.2 : cols <= 8 ? 1.28 : cols <= 11 ? 1.36 : 1.45;

function ooModel(m) {
  m = m && typeof m === "object" ? m : {};
  m.j = m.j && typeof m.j === "object" ? m.j : {};
  m.f = m.f && typeof m.f === "object" ? m.f : {};
  return m;
}
const ooTheta0 = (m, j) => { const r = m.j[j]; return r && isFinite(r.r) ? Math.exp(r.r) : OO_START[j]; };
// threshold for a judgment in a family (the family offset is small and bounded)
// threshold for a judgment in a family: the judgment's own estimate, times a family offset shared by every
// judgment, times a finer offset for that family on that axis (the three-axis eye profile: blues may be sharp in
// hue and soft in lightness). Both offsets are small and bounded, and start at zero.
const ooOff = (m, k) => m.f[k] && isFinite(m.f[k].o) ? m.f[k].o : 0;
const ooTheta = (m, j, fam) => Math.max(OO_MIN, Math.min(OO_MAX, ooTheta0(m, j) * Math.exp(fam ? ooOff(m, fam) + ooOff(m, fam + ":" + j) : 0)));
// The reader other screens use (ooEyeInfo / trEyeThreshold in js/games/oo-ui.js): { th (ΔE00), n (answers behind it), sure }
function ooEye(m, fam, axis) {
  m = ooModel(m);
  const axes = axis ? [axis] : OO_AXES, js = axes.filter(a => m.j[a] && m.j[a].n);
  if (!js.length) return { th: null, n: 0, sure: false };
  const th = Math.exp(js.reduce((a, j) => a + Math.log(ooTheta(m, j, fam)), 0) / js.length);
  const n = fam ? axes.reduce((a, j) => a + ((m.f[fam + ":" + j] || {}).n || 0), 0) : js.reduce((a, j) => a + m.j[j].n, 0);
  return { th, n, sure: n >= 12 };
}
// One answer: dEff is the round's difference divided by its variant and board factors.
function ooUpdate(m, j, fam, dEff, ok, g = 0) {
  ooModel(m);
  const r = m.j[j] || (m.j[j] = { r: Math.log(OO_START[j]), n: 0 });
  const f = fam ? (m.f[fam] || (m.f[fam] = { o: 0, n: 0 })) : null, fj = fam && OO_AXES.includes(j) ? (m.f[fam + ":" + j] || (m.f[fam + ":" + j] = { o: 0, n: 0 })) : null;
  const th = ooTheta(m, j, fam), p = ooP(dEff, th, g), e = (ok ? 1 : 0) - p;
  // the step shrinks as evidence builds (fast at first, steady later), never to zero, so the estimate can follow you.
  // A 2-down/1-up-style asymmetric step (correct pushes down faster than a miss eases up) was tried here for
  // David's "too easy... make the staircase step down faster" and measured in tools/oo_simple_sim.js: it shifts
  // the long-run EQUILIBRIUM itself, not just how fast it's reached, and a genuinely coarser-eyed player's
  // estimate got stuck too low (52% settled, nowhere near the ~71% ooP targets) because misses alone couldn't
  // push it back up fast enough. Reverted to a symmetric step; the lower OO_START and the tighter easiness
  // ceiling below do the actual work of "not starting/sitting too easy" without destabilizing calibration.
  const K = Math.max(.07, .55 / Math.sqrt(1 + r.n / 3)), Kf = Math.max(.04, .3 / Math.sqrt(1 + (f ? f.n : 0) / 3));
  r.r = Math.log(Math.max(OO_MIN, Math.min(OO_MAX, Math.exp(r.r - K * e))));
  r.n++;
  if (f) { f.o = Math.max(-.9, Math.min(.9, f.o - Kf * e)); f.n++; }
  if (fj) { const Kj = Math.max(.03, .22 / Math.sqrt(1 + fj.n / 3)); fj.o = Math.max(-.7, Math.min(.7, fj.o - Kj * e)); fj.n++; }
  return { p, th };
}
// the 2-down / 1-up staircase (COLORNERD §5): two rights in a row make it harder, one miss easier; it settles
// near 71% right. The step (in log units) halves after each of the first four reversals; the score is the
// geometric mean of the last six reversals. Used by the growing-board and survival sets.
function ooStair(d0, step = .45) { return { d: d0, step, run: 0, dir: 0, rev: [], n: 0 }; }
function ooStairStep(s, ok, floor = OO_MIN, max = OO_MAX) {
  let move = 0;
  if (ok) { s.run++; if (s.run >= 2) { move = -1; s.run = 0; } } else { s.run = 0; move = 1; }
  s.n++;
  if (move) {
    if (s.dir && move !== s.dir) { s.rev.push(s.d); if (s.rev.length <= 4) s.step = Math.max(.08, s.step / 2); }
    s.dir = move;
    s.d = Math.max(floor, Math.min(max, s.d * Math.exp(move * s.step)));
  }
  return s;
}
const ooStairScore = s => { const r = s.rev.slice(-6); return r.length ? Math.exp(r.reduce((a, x) => a + Math.log(x), 0) / r.length) : s.d; };

// ---------- color families (same rule as family() in js/gym.js) ----------
function ooFam(hex) {
  const [L, C, H] = lch(hex);
  if (C < 12) return "Greys";
  if (H >= 345 || H < 40) return L > 70 ? "Pinks" : "Reds";
  if (H < 70) return L < 48 ? "Browns" : "Oranges";
  if (H < 100) return L < 55 ? "Browns" : "Yellows";
  if (H < 195) return "Greens";
  if (H < 290) return "Blues";
  return L > 72 ? "Pinks" : "Purples";
}
// where each family lives in LCh (hue range, lightness, chroma), for aiming a round at a family
const OO_FAMS = {
  Reds: { h: [350, 32], L: [32, 58], C: [32, 58] }, Oranges: { h: [42, 68], L: [52, 74], C: [36, 62] },
  Yellows: { h: [74, 98], L: [72, 88], C: [34, 62] }, Greens: { h: [105, 190], L: [36, 76], C: [22, 52] },
  Blues: { h: [200, 285], L: [32, 72], C: [22, 50] }, Purples: { h: [292, 340], L: [30, 60], C: [24, 50] },
  Pinks: { h: [345, 25], L: [72, 86], C: [16, 34] }, Browns: { h: [45, 90], L: [28, 46], C: [16, 34] },
  Greys: { h: [0, 360], L: [30, 82], C: [0, 5] },
};
const OO_FAM_LIST = Object.keys(OO_FAMS);
const ooHueIn = (h, rnd) => { const [a, b] = h, span = (b - a + 360) % 360 || 360; return (a + rnd() * span) % 360; };
const ooOk = (L, C, H) => { const r = H * Math.PI / 180; return inGamut(L, C * Math.cos(r), C * Math.sin(r)); };
// A base color: in a family (or anywhere), on screen, with room for the axis it will be moved along.
// o.set: a set of colors to build boards from (today's words, your mix-ups, a painting, a photo): the base is
// always one of them, preferring those with room for the axis.
function ooBase(rnd, o = {}) {
  if (o.set && o.set.length) {
    const fit = o.set.filter(h => { const [L, C] = lch(h); return L > 8 && L < 94 && (o.axis !== "hue" || C >= 18) && (o.axis !== "chroma" || C >= 12); });
    return ooPick(fit.length ? fit : o.set, rnd);
  }
  for (let t = 0; t < 40; t++) {
    let fam = o.fam && OO_FAMS[o.fam] ? o.fam : ooPick(OO_FAM_LIST.filter(f => f !== "Greys" || o.axis === "light"), rnd);
    if (fam === "Greys" && o.axis && o.axis !== "light") fam = "Blues";
    const F = OO_FAMS[fam], H = ooHueIn(F.h, rnd), L = ooBtw(F.L[0], F.L[1], rnd);
    let C = ooBtw(F.C[0], F.C[1], rnd);
    if (o.axis === "hue") C = Math.max(C, 20);
    while (C > 0 && !ooOk(L, C, H)) C -= 1;
    if (o.axis === "hue" && C < 18) continue;
    if (o.axis === "chroma" && C < 12) continue;
    const hex = lchHex(L, Math.max(0, C), H);
    if (o.pool && o.pool.length && rnd() < .5 && !o.fam) { const p = ooPick(o.pool, rnd), pc = lch(p); if (o.axis !== "hue" || pc[1] >= 18) return p; }
    return hex;
  }
  return lchHex(58, 30, 220);
}

// ---------- the gap: how different two drawn tiles look (David, 2026-10-09: "you can choose super hard and it still
// gives you really easy questions") ----------
// CIEDE2000 divides a chroma difference by Sc = 1 + 0.045 C (and a hue difference by Sh = 1 + 0.015 C T): fitted on
// small paint samples, it shrinks differences between vivid colors. On two big glowing tiles side by side the eye
// sees them far better: at "1.1" a vividness move on a saturated teal or yellow was ΔE76 3.5 and obvious, while a
// lightness move at the same 1.1 was ΔE76 1.4 and hard. The game's gap keeps CIEDE2000 but softens the two
// weightings (chroma ×0.15, hue ×0.5 of their slope), so lightness, vividness and hue moves at one level look about
// equally hard (tools/games_test.js checks the three axes stay within 25% of each other in ΔE76). Every gap the game
// draws, scores and shows goes through this; color names elsewhere still use de2000.
const OO_KC = .15, OO_KH = .5;
function ooGapDE(h1, h2) {
  const [L1, a1, b1] = Array.isArray(h1) ? h1 : lab(h1), [L2, a2, b2] = Array.isArray(h2) ? h2 : lab(h2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = .5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (!b && !a) return 0; const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p), dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hb += h1p + h2p < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad) + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)), dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Sl = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + .045 * OO_KC * Cbp, Sh = 1 + .015 * OO_KH * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// ---------- moving a color by exactly d (as drawn, in hex) ----------
// axis "light" | "chroma" | "hue" in LCh, sign ±1. Returns { hex, act } with act = ΔE00 between the two hex codes,
// or null if the move leaves the screen gamut. The amount is found by bisection on the drawn colors.
function ooMove(baseHex, axis, sign, d) {
  const [L, C, H] = lch(baseHex), kMax = axis === "hue" ? 150 : 70;
  const at = k => {
    const L2 = axis === "light" ? L + sign * k : L, C2 = axis === "chroma" ? C + sign * k : C, H2 = axis === "hue" ? H + sign * k : H;
    if (L2 < 2 || L2 > 98 || C2 < 0 || !ooOk(L2, C2, H2)) return null;
    const hex = lchHex(L2, C2, (H2 + 360) % 360);
    return { hex, act: ooGapDE(baseHex, hex) };
  };
  let lo = 0, hi = null, best = null;
  // grow until the drawn difference reaches d (or the gamut ends)
  for (let k = Math.max(.3, d * .6); k <= kMax; k *= 1.35) {
    const r = at(k);
    if (!r) break;
    if (!best || Math.abs(r.act - d) < Math.abs(best.act - d)) best = r;
    if (r.act >= d) { hi = k; break; }
    lo = k;
  }
  if (hi == null) return best && Math.abs(best.act - d) <= d * .15 ? best : null;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2, r = at(mid);
    if (!r) { hi = mid; continue; }
    if (!best || Math.abs(r.act - d) < Math.abs(best.act - d)) best = r;
    if (r.act < d) lo = mid; else hi = mid;
  }
  return best;
}
// a move in any Lab direction (twins, "was it there", n-back lures)
// de: the metric (de2000 for Across the line's name boundaries; ooGapDE for the odd-one-out boards)
function ooMoveDir(baseHex, v, d, de = de2000) {
  const B = lab(baseHex), n = Math.hypot(...v) || 1, u = v.map(x => x / n);
  const at = k => { const P = B.map((x, i) => x + u[i] * k); if (P[0] < 2 || P[0] > 98 || !inGamut(...P)) return null; const hex = labHex(...P); return { hex, act: de(baseHex, hex) }; };
  let lo = 0, hi = null, best = null;
  for (let k = Math.max(.3, d * .5); k <= 90; k *= 1.35) { const r = at(k); if (!r) break; if (!best || Math.abs(r.act - d) < Math.abs(best.act - d)) best = r; if (r.act >= d) { hi = k; break; } lo = k; }
  if (hi == null) return best && Math.abs(best.act - d) <= d * .15 ? best : null;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2, r = at(mid); if (!r) { hi = mid; continue; } if (!best || Math.abs(r.act - d) < Math.abs(best.act - d)) best = r; if (r.act < d) lo = mid; else hi = mid; }
  return best;
}
const ooRandDir = rnd => { const v = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; v[0] *= .7; return v; };

// "Which way?": the plain word for a move (the same words as js/eye-names.js, COLORNERD §6.5): lighter or darker,
// more vivid or greyer, and for hue the strongest pull on the a*b* plane: redder, yellower, greener or bluer.
// Never "warmer", "cooler" or "brighter".
const ooHueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const ooPull = (x, y) => Math.abs(x) >= Math.abs(y) ? (x > 0 ? "redder" : "greener") : (y > 0 ? "yellower" : "bluer");
function ooDirWord(baseHex, oddHex) {
  const [L1, a1, b1] = lab(baseHex), [L2, a2, b2] = lab(oddHex), C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const dL = L2 - L1, dC = C2 - C1, ux = C1 > 1e-6 ? a1 / C1 : 0, uy = C1 > 1e-6 ? b1 / C1 : 0, ra = (a2 - a1) * ux + (b2 - b1) * uy;
  const hx = (a2 - a1) - ra * ux, hy = (b2 - b1) - ra * uy, Cb = (C1 + C2) / 2;
  const sL = Math.abs(dL), sC = Math.abs(dC) / (1 + .045 * Cb), sH = C1 > 8 || C2 > 8 ? Math.hypot(hx, hy) / (1 + .015 * Cb) : 0;
  if (sL >= sC && sL >= sH) return dL > 0 ? "lighter" : "darker";
  if (sC >= sH) return dC > 0 ? "more vivid" : "greyer";
  return ooPull(hx, hy);
}
// the two hue words a color can move in (turning one way or the other around the hue circle)
function ooHuePair(baseHex) {
  const [, C, H] = lch(baseHex), r = H * Math.PI / 180, x = -Math.sin(r), y = Math.cos(r);
  return C < 8 ? null : [ooPull(x, y), ooPull(-x, -y)];
}
// the answer choices for "which way?": three pairs, the hue pair fitted to this color
const ooDirChoices = baseHex => [["lighter", "darker"], ["more vivid", "greyer"], ooHuePair(baseHex) || ["redder", "bluer"]];
const OO_DIR_WORDS = ["lighter", "darker", "more vivid", "greyer", "redder", "yellower", "greener", "bluer"];

// ---------- boards: cell geometry in unit coordinates ----------
// Every board returns { aspect (w/h), cells: [{ x, y, w, h, shape }] } with x, y, w, h as fractions of the board.
function ooCells(board, n, rnd) {
  const cells = [];
  if (board === "ring") {
    const k = n || 10, R = .38, s = Math.min(.24, 2 * Math.PI * R / k * .86);
    for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / k; cells.push({ x: .5 + R * Math.cos(a) - s / 2, y: .5 + R * Math.sin(a) - s / 2, w: s, h: s, shape: "circle" }); }
    return { aspect: 1, cells };
  }
  if (board === "honey") {
    const rad = n >= 19 ? 2 : 1, pts = [];
    for (let q = -rad; q <= rad; q++) for (let r = -rad; r <= rad; r++) { const s = -q - r; if (Math.abs(s) <= rad) pts.push([Math.sqrt(3) * (q + r / 2), 1.5 * r]); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), w = Math.sqrt(3), h = 2;
    const minX = Math.min(...xs) - w / 2, maxX = Math.max(...xs) + w / 2, minY = Math.min(...ys) - h / 2, maxY = Math.max(...ys) + h / 2;
    const S = Math.max(maxX - minX, maxY - minY), ox = (S - (maxX - minX)) / 2, oy = (S - (maxY - minY)) / 2;
    pts.forEach(([x, y]) => cells.push({ x: (x - w / 2 - minX + ox) / S, y: (y - h / 2 - minY + oy) / S, w: w / S, h: h / S, shape: "hex" }));
    return { aspect: 1, cells };
  }
  if (board === "strip") {
    const k = n || 8;
    for (let i = 0; i < k; i++) cells.push({ x: 0, y: i / k, w: 1, h: 1 / k, shape: "chip" });
    return { aspect: .62, cells };
  }
  if (board === "sizes") {
    // a 4 x 4 grid with one or two 2 x 2 blocks (and a 1 x 2 now and then); the odd tile can be big or small
    const g = 4, used = Array.from({ length: g }, () => Array(g).fill(false)), blocks = 1 + Math.floor(rnd() * 2);
    for (let b = 0, t = 0; b < blocks && t < 40; t++) {
      const x = Math.floor(rnd() * (g - 1)), y = Math.floor(rnd() * (g - 1));
      if (used[y][x] || used[y][x + 1] || used[y + 1][x] || used[y + 1][x + 1]) continue;
      used[y][x] = used[y][x + 1] = used[y + 1][x] = used[y + 1][x + 1] = true; cells.push({ x: x / g, y: y / g, w: 2 / g, h: 2 / g, shape: "sq" }); b++;
    }
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      if (used[y][x]) continue;
      if (blocks === 1 && x + 1 < g && !used[y][x + 1] && rnd() < .18) { used[y][x] = used[y][x + 1] = true; cells.push({ x: x / g, y: y / g, w: 2 / g, h: 1 / g, shape: "sq" }); continue; }
      used[y][x] = true; cells.push({ x: x / g, y: y / g, w: 1 / g, h: 1 / g, shape: "sq" });
    }
    return { aspect: 1, cells };
  }
  if (board === "mosaic") {
    const g = 4;
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      const s = ooBtw(.56, .9, rnd) / g, w = s * ooBtw(.8, 1.2, rnd), h = s * ooBtw(.8, 1.2, rnd);
      cells.push({ x: x / g + rnd() * (1 / g - Math.min(w, 1 / g)), y: y / g + rnd() * (1 / g - Math.min(h, 1 / g)), w: Math.min(w, 1 / g), h: Math.min(h, 1 / g), shape: "sq", rot: ooBtw(-9, 9, rnd) });
    }
    return { aspect: 1, cells };
  }
  // grid, busy (smaller tiles on a ground), gradient and painting: an n x n grid
  const g = n || 3, inset = board === "busy" ? .2 : 0;
  for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) cells.push({ x: (x + inset) / g, y: (y + inset) / g, w: (1 - 2 * inset) / g, h: (1 - 2 * inset) / g, shape: "sq", gx: x, gy: y });
  return { aspect: 1, cells, cols: g };
}
const ooCols = (board, n) => board === "grid" || board === "busy" || board === "gradient" || board === "painting" ? n : board === "sizes" || board === "mosaic" ? 4 : 3;

// hidden shapes for "odd group" (cells on a grid, [x, y]); letters and simple figures
const OO_SHAPES = {
  line: [[0, 0], [1, 0], [2, 0], [3, 0]], col: [[0, 0], [0, 1], [0, 2], [0, 3]], L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], plus: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], square: [[0, 0], [1, 0], [0, 1], [1, 1]],
  diag: [[0, 0], [1, 1], [2, 2], [3, 3]], C: [[0, 0], [1, 0], [0, 1], [0, 2], [1, 2]], Z: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
};

// ---------- a round ----------
// spec: { v (variant), b (board), n, d (target ΔE00), axis?, sign?, base?, rnd, pool?, fam?, illusion?, count? }
// Returns { v, b, n, d, act, axis, sign, base, odd (the odd color), colors: [hex per cell], ans: [cell indices] (or
// count), dir (the word), cells, aspect, cols, ground?, shape?, fam, judg, g (guessing rate), none (true: "none" is right) }
function ooRound(spec) {
  const rnd = spec.rnd || Math.random, v = spec.v || "one", b = spec.b || "grid";
  const n = spec.n || (b === "ring" ? 10 : b === "honey" ? 19 : b === "strip" ? 8 : b === "mosaic" ? 16 : b === "group" ? 6 : 3);
  const geo = ooCells(b, v === "group" ? Math.max(5, n) : n, rnd), cells = geo.cells, N = cells.length;
  let d = Math.max(OO_MIN, Math.min(OO_MAX, spec.d || 4));
  const out = { v, b, n, d, cells, aspect: geo.aspect, cols: geo.cols || ooCols(b, n), judg: null, none: false };
  for (let attempt = 0; attempt < 16; attempt++) {
    const axis = spec.axis || ooPick(OO_AXES, rnd), sign = spec.sign || (rnd() < .5 ? -1 : 1);
    const base = attempt < 3 && spec.base ? spec.base : ooBase(rnd, { axis, fam: spec.fam, pool: spec.pool, set: attempt < 12 ? spec.set : null });
    out.axis = axis; out.base = base; out.fam = ooFam(base); out.judg = axis;
    const colors = Array(N).fill(base);
    if (v === "twins") {
      // every tile differs from every other by at least d, except two identical twins
      const tw = ooShuf([...Array(N).keys()], rnd).slice(0, 2), others = [], all = [base];
      let ok = true;
      for (let i = 0; i < N - 2; i++) {
        let got = null;
        for (let t = 0; t < 60 && !got; t++) {
          const r = ooMoveDir(base, ooRandDir(rnd), d * ooBtw(1, 1.45, rnd), ooGapDE);
          if (r && all.every(h => ooGapDE(h, r.hex) >= d * .92)) got = r.hex;
        }
        if (!got) { ok = false; break; }
        others.push(got); all.push(got);
      }
      if (!ok) continue;
      let k = 0;
      for (let i = 0; i < N; i++) colors[i] = tw.includes(i) ? base : others[k++];
      const act = Math.min(...others.map(h => ooGapDE(base, h)), ...others.flatMap((h, i) => others.slice(i + 1).map(x => ooGapDE(h, x))));
      // twins differ in every direction at once, so they measure no single judgment: judg "any" (the model
      // draws their difficulty from the mean of the three axes and doesn't file the answer under one)
      Object.assign(out, { colors, ans: tw, act, odd: base, dir: null, g: 2 / (N * (N - 1)), axis: "any" });
      return ooFinish(out, spec);
    }
    if (b === "gradient") {
      // a smooth 2D drift from corner to corner; one tile breaks it by d
      const g = geo.cols, B = lab(base), span = ooBtw(14, 22, rnd), vx = ooRandDir(rnd), vy = ooRandDir(rnd);
      const nx = Math.hypot(...vx), ny = Math.hypot(...vy), sx = vx.map(x => x / nx * span / 2), sy = vy.map(x => x / ny * span / 2);
      let okG = true;
      for (let i = 0; i < N; i++) {
        const c = cells[i], fx = c.gx / (g - 1) * 2 - 1, fy = c.gy / (g - 1) * 2 - 1, P = B.map((x, k) => x + sx[k] * fx + sy[k] * fy);
        if (!inGamut(...P) || P[0] < 4 || P[0] > 96) { okG = false; break; }
        colors[i] = labHex(...P);
      }
      if (!okG) continue;
      const at = Math.floor(rnd() * N), m = ooMove(colors[at], axis, sign, d) || ooMove(colors[at], axis, -sign, d);
      if (!m || (!ooIn(m.act, d) && attempt < 14)) continue;
      const exp = colors[at]; colors[at] = m.hex;
      Object.assign(out, { colors, ans: [at], act: m.act, odd: m.hex, expect: exp, dir: ooDirWord(exp, m.hex), g: 1 / N, judg: "context", base: exp });
      return ooFinish(out, spec);
    }
    if (v === "count") {
      const k = spec.count != null ? spec.count : ooCountPick(rnd);
      if (k === 0) { Object.assign(out, { colors, ans: [], count: 0, act: 0, odd: base, dir: null, g: .2, none: true }); return ooFinish(out, spec); }
      const at = ooShuf([...Array(N).keys()], rnd).slice(0, k), odds = [];
      let okC = true;
      for (const i of at) { const s = rnd() < .5 ? -1 : 1, m = ooMove(base, axis, s, d) || ooMove(base, axis, -s, d); if (!m || (!ooIn(m.act, d) && attempt < 14)) { okC = false; break; } colors[i] = m.hex; odds.push(m.act); }
      if (!okC) continue;
      Object.assign(out, { colors, ans: at, count: k, act: Math.min(...odds), odd: colors[at[0]], dir: null, g: .2 });
      return ooFinish(out, spec);
    }
    if (spec.illusion) {
      // illusion round: every tile is identical; the ground makes some look different. "None" is right.
      Object.assign(out, { colors, ans: [], act: 0, odd: base, dir: null, g: .25, none: true });
      return ooFinish(out, spec);
    }
    const m = ooMove(base, axis, sign, d) || ooMove(base, axis, -sign, d);
    if (!m || (!ooIn(m.act, d) && attempt < 14)) continue;
    let ans;
    if (v === "pair") ans = ooShuf([...Array(N).keys()], rnd).slice(0, 2);
    else if (v === "group") {
      const g = geo.cols, names = Object.keys(OO_SHAPES), sh = OO_SHAPES[ooPick(names, rnd)];
      const w = Math.max(...sh.map(p => p[0])) + 1, h = Math.max(...sh.map(p => p[1])) + 1, ox = Math.floor(rnd() * (g - w + 1)), oy = Math.floor(rnd() * (g - h + 1));
      ans = sh.map(([x, y]) => (oy + y) * g + ox + x);
    } else if (v === "one" && spec.k > 1) ans = ooShuf([...Array(N).keys()], rnd).slice(0, Math.min(spec.k, N - 1));   // Classic: several odd tiles, find them all
    else ans = [Math.floor(rnd() * N)];
    ans.forEach(i => { colors[i] = m.hex; });
    let gk = 1; for (let j = 0; j < ans.length; j++) gk *= (j + 1) / (N - j);   // the chance of tapping all k by luck
    Object.assign(out, { colors, ans, k: ans.length, act: m.act, odd: m.hex, dir: ooDirWord(base, m.hex), g: v === "pair" ? 2 / (N * (N - 1)) : v === "group" ? ans.length / N : v === "which" ? 1 / (6 * N) : gk });
    return ooFinish(out, spec);
  }
  // could not draw it (an extreme d): fall back to an easy plain round, flagged
  if ((spec.fallback || 0) > 3) { const base = lchHex(58, 30, 220), m = ooMove(base, "light", 1, 6); const colors = Array(N).fill(base); colors[0] = m.hex; return ooFinish(Object.assign(out, { d: 6, colors, ans: [0], act: m.act, odd: m.hex, axis: "light", base, fam: "Blues", judg: "light", dir: "lighter", g: 1 / N, fallback: 4 }), spec); }
  return ooRound({ ...spec, d: Math.min(d, 12), b: b === "gradient" ? "grid" : b, base: null, fallback: (spec.fallback || 0) + 1, axis: spec.fallback > 1 ? "light" : spec.axis });
}
// a drawn difference close enough to the target (8-bit hex codes can't hit every value: at d below 1 a few
// bases are tried until one lands inside the band)
const ooIn = (act, d) => act >= d * .85 && act <= d * 1.15;
const ooCountPick = rnd => { const r = rnd(); return r < .2 ? 0 : r < .4 ? 1 : r < .6 ? 2 : r < .8 ? 3 : 4; };
function ooFinish(out, spec) {
  if (out.b === "busy") out.ground = ooGround(out.base, spec.rnd || Math.random);
  if (out.axis === "any") out.judg = "any";
  if (spec.twist === "flash" || spec.mem) out.judg = "memory";
  else if (["busy", "sizes", "mosaic", "gradient", "painting"].includes(out.b)) out.judg = "context";
  out.vf = OO_VF[out.v] || 1;
  out.bf = (OO_BF[out.b] || 1) * (out.b === "grid" || out.b === "busy" || out.b === "gradient" ? ooSizeF(out.cols) : 1);
  return out;
}
// Busy grounds: two halves in clashing colors (simultaneous contrast pushes identical tiles apart).
function ooGround(base, rnd) {
  const [L, , H] = lch(base), split = ooPick(["v", "h", "d", "q"], rnd);
  const a = ooFit(Math.min(90, L + ooBtw(18, 30, rnd)), ooBtw(30, 50, rnd), H + ooBtw(40, 90, rnd));
  const c = ooFit(Math.max(14, L - ooBtw(18, 30, rnd)), ooBtw(30, 50, rnd), H + 180 + ooBtw(-40, 40, rnd));
  return { a, c, split };
}
function ooFit(L, C, H) { H = ((H % 360) + 360) % 360; while (C > 0 && !ooOk(L, C, H)) C -= 1; return lchHex(L, Math.max(0, C), H); }

// The band a round's drawn difference must land in (tools/games_test.js checks every variant against it).
function ooBand(r) {
  if (r.none || r.count === 0) return [0, 0];
  if (r.v === "twins") return [r.d * .85, r.d * 1.5];
  return [r.d * .85, r.d * 1.15];
}

// Painting rounds: the Lab shift to add to every pixel of one tile so its mean color moves by d (ΔE00).
function ooPaintShift(meanLab, axis, sign, d) {
  const meanHex = labHex(...meanLab), m = ooMove(meanHex, axis, sign, d) || ooMove(meanHex, axis, -sign, d);
  if (!m) return null;
  const to = lab(m.hex);
  return { delta: to.map((x, i) => x - meanLab[i]), act: m.act, to: m.hex, from: meanHex, dir: ooDirWord(meanHex, m.hex) };
}

// ---------- the ladder: 20 levels of perceptual difficulty, and the layouts that rotate inside them ----------
// design/ODD-ONE-OUT.md has the full model. A LEVEL is one number: the gap (ΔE00, as drawn on this screen) between the
// odd tile and the rest, log-spaced from 12 (obvious) down to 0.6 (the edge of what a screen can show). Nothing else
// changes from level to level. A LAYOUT (grid, ring, honeycomb, a colored ground, a hidden shape...) is a separate
// axis: rounds inside a level rotate through the layouts you have met, so moving up a level only ever means a smaller gap.
const OO_LEVEL_N = 20, OO_GAP_TOP = 12, OO_GAP_END = .6;
const OO_GAPS = Array.from({ length: OO_LEVEL_N }, (_, i) => +(OO_GAP_TOP * Math.pow(OO_GAP_END / OO_GAP_TOP, i / (OO_LEVEL_N - 1))).toPrecision(2));
const OO_WORLDS = [
  { name: "Plain sight", mile: "You can find a clear difference in any arrangement." },
  { name: "A good look", mile: "You can find a difference that takes a second look." },
  { name: "Fine detail", mile: "You can find a difference most people miss." },
  { name: "The edge", mile: "You can find a difference at the edge of what this screen shows." },
];
const OO_LEVELS = OO_GAPS.map((gap, i) => ({ gap, w: Math.floor(i / 5) }));
const ooLevelGap = i => OO_GAPS[ooLim(i | 0, 0, OO_LEVEL_N - 1)];
// the level whose gap is nearest a difference (on a log scale): where a threshold sits on the ladder
const ooLevelOfGap = g => { let best = 0, bd = Infinity; OO_GAPS.forEach((x, i) => { const d = Math.abs(Math.log(x / Math.max(g, 1e-3))); if (d < bd) { bd = d; best = i; } }); return best; };
// the plain word for a gap, for the map and the eye profile
const ooGapWord = i => i < 4 ? "Obvious" : i < 8 ? "Clear" : i < 12 ? "Subtle" : i < 16 ? "Fine" : i < 19 ? "Very fine" : "Almost imperceptible";
// "Choose" shortcuts: fixed levels (Edge of my eye is dynamic: the level at your own threshold)
const OO_PRESET_LV = { easy: 3, medium: 7, hard: 11, expert: 15 };
// the level a threshold th (ΔE00) sits at; mult > 1 aims easier than the threshold (For you starts at 2×)
const ooLevelForTh = (th, mult = 1) => ooLevelOfGap(th * mult);
const OO_LEVEL_ROUNDS = 10, OO_LEVEL_PASS = 8;   // a level is passed by accuracy: 8 of 10
// Layouts. v: the task, b: the board, n: its size, tw: a twist. at: how many sets you have played before it can
// appear (novelty over time, never tied to a level). gmax: the largest gap it is offered at (a board whose tiles must
// all differ cannot be drawn when the gap is huge).
const OO_LAYOUTS = [
  { id: "grid3", name: "3 × 3 squares", v: "one", b: "grid", n: 3, at: 0 },
  { id: "grid4", name: "4 × 4 squares", v: "one", b: "grid", n: 4, at: 0 },
  { id: "ring", name: "A ring", v: "one", b: "ring", n: 10, at: 0 },
  { id: "pair", name: "Odd pair", v: "pair", b: "grid", n: 4, at: 1, news: "Two tiles are different: find both" },
  { id: "strip", name: "Paint strip", v: "one", b: "strip", n: 8, at: 1 },
  { id: "honey", name: "Honeycomb", v: "one", b: "honey", n: 19, at: 2 },
  { id: "grid5", name: "5 × 5 squares", v: "one", b: "grid", n: 5, at: 2 },
  { id: "count", name: "How many?", v: "count", b: "grid", n: 4, at: 3, news: "Count the different tiles. Zero is sometimes right" },
  { id: "sizes", name: "Mixed sizes", v: "one", b: "sizes", n: 4, at: 3, news: "Big and small tiles (size changes how a color looks)" },
  { id: "ground", name: "On a colored ground", v: "one", b: "busy", n: 4, tw: "illusion", at: 4, news: "Colored grounds. Sometimes none is different" },
  { id: "twins", name: "Twins", v: "twins", b: "grid", n: 3, at: 4, gmax: 6.5, news: "Every tile differs except two: find the twins" },
  { id: "which", name: "Which way?", v: "which", b: "grid", n: 3, at: 5, news: "Find it, then say how it differs" },
  { id: "shape", name: "Hidden shape", v: "group", b: "grid", n: 6, at: 5, news: "A few tiles form a hidden shape" },
  { id: "gradient", name: "A gradient field", v: "one", b: "gradient", n: 4, at: 6, news: "The tiles drift smoothly; one breaks the pattern" },
  { id: "flash", name: "A one-second flash", v: "one", b: "grid", n: 4, tw: "flash", at: 7, news: "The board shows for one second: tap where it was" },
  { id: "mosaic", name: "A scattered mosaic", v: "count", b: "mosaic", n: 16, at: 8 },
  { id: "twinring", name: "Twin ring", v: "twins", b: "ring", n: 10, at: 9, gmax: 6.5 },
  { id: "painting", name: "A painting", v: "one", b: "painting", n: 4, at: 10, news: "A painting cut into tiles; one patch is recolored" },
  { id: "whichground", name: "Which way, on a ground", v: "which", b: "busy", n: 4, tw: "illusion", at: 11 },
  { id: "chain", name: "A chain", v: "one", b: "grid", n: 4, tw: "chain", at: 12, news: "The odd tile becomes the next board's color" },
  { id: "breathe", name: "A breathing honeycomb", v: "one", b: "honey", n: 19, tw: "breathe", at: 12, news: "Every tile breathes, each at its own pace" },
  { id: "whichpaint", name: "Which way, in a painting", v: "which", b: "painting", n: 4, at: 13 },
];
const ooLayout = id => OO_LAYOUTS.find(l => l.id === id) || OO_LAYOUTS[0];
// the layouts that can show on a level: met-able by now (sets played) and drawable at this gap
const ooLayoutsFor = (sets, gap) => OO_LAYOUTS.filter(l => l.at <= sets && (!l.gmax || gap <= l.gmax));
// the next layout: one you haven't met yet comes first (once per set), then a random one that isn't the last
function ooLayoutNext(avail, seen, lastId, rnd, k) {
  const fresh = avail.filter(l => !(seen[ooKindKey(l.v, l.b, l.tw)] > 0));
  if (fresh.length && k === 0) return ooPick(fresh, rnd);
  const pool = avail.filter(l => l.id !== lastId);
  return ooPick(pool.length ? pool : avail, rnd);
}
// a gap's per-layout multiplier: a layout is a small modifier, never a difficulty (see design/ODD-ONE-OUT.md)
const ooLayoutF = l => (OO_VF[l.v] || 1) * (OO_BF[l.b] || 1) * (["grid", "busy", "gradient"].includes(l.b) ? ooSizeF(l.n) : 1) * (l.tw === "breathe" ? 1.1 : 1);
// the grand boss and the daily board draw their rounds from these (variant, board, size, twist)
const OO_KINDS = [
  ["one", "grid", 4], ["pair", "grid", 4], ["one", "ring", 10], ["count", "grid", 4], ["one", "honey", 19], ["one", "strip", 8],
  ["twins", "grid", 3], ["one", "sizes", 4], ["one", "busy", 4], ["which", "grid", 3], ["group", "grid", 6], ["one", "grid", 4, "flash"],
  ["one", "gradient", 4], ["count", "mosaic", 16], ["twins", "ring", 10],
];
const OO_ROUNDS = 6;
const OO_MIX_AT = 8;     // the Mix opens once level 8 is passed or cleared
const OO_MIX = [
  { id: "changed", name: "What changed?", what: "See the board, a blink, then tap the tile that changed", judg: "memory" },
  { id: "outoforder", name: "Out of order", what: "One tile in the gradient is misplaced: find it, then drag it home", judg: "context" },
  { id: "rebuild", name: "Rebuild", what: "See a gradient, it scrambles: put it back from memory", judg: "memory" },
  { id: "wasthere", name: "Was it there?", what: "Remember four colors, then tap the newcomer", judg: "memory" },
  { id: "imposter", name: "Imposter", what: "Four names on four colors: one name is on the wrong color", judg: null },
  { id: "nback", name: "Color n-back", what: "Colors come one at a time: tap when one matches the color two back", judg: "memory" },
];
// stars: finish (pass the set), fast, no hints
const OO_PASS = 4;          // of 6
const OO_FAST_MS = 3500;    // median time of right answers
const ooTierAt = (i, novel) => novel && i < 2 ? "intro" : OO_BREATH[i % OO_BREATH.length];

// The kind of a round, for "new kinds arrive at easy difficulty"
const ooKindKey = (v, b, tw) => [v, b, tw || ""].join("/");

// ---------- the daily board: one shared board a day, the same everywhere ----------
// Six rounds at fixed differences (not your own level), so everyone's grid means the same thing.
const OO_DAILY_D = [8, 5, 3.5, 2.5, 1.8, 1.3];
const OO_DAILY_START = "2026-10-08";
const ooDayNum = key => { const [a, b] = [OO_DAILY_START, key].map(x => { const [y, m, d] = x.split("-").map(Number); return Date.UTC(y, m - 1, d); }); return Math.round((b - a) / 864e5) + 1; };
const OO_DAILY_KINDS = [["one", "grid", 3], ["pair", "grid", 4], ["one", "ring", 10], ["count", "grid", 4], ["one", "honey", 19], ["which", "grid", 3], ["twins", "grid", 3], ["one", "sizes", 4], ["one", "strip", 8], ["group", "grid", 5]];
function ooDaily(key) {
  const rnd = ooRnd(ooHash("oo-daily:" + key)), kinds = ooShuf(OO_DAILY_KINDS, rnd).slice(0, 6);
  return OO_DAILY_D.map((d, i) => { const [v, b, n] = kinds[i]; return ooRound({ v, b, n, d, rnd, count: v === "count" ? 1 + Math.floor(rnd() * 4) : undefined }); });
}
// the share line: plain words, no emoji grid ("ColorHub · Odd one out #1: 5 of 6, down to 1.8% different")
function ooShareText(key, res) {
  const hits = res.filter(r => r.ok).length, seen = res.filter(r => r.ok && r.act > 0).map(r => r.act), min = seen.length ? Math.min(...seen) : null;
  const pct = n => `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;
  return `ColorHub · Odd one out #${ooDayNum(key)}: ${hits} of ${res.length}${min != null ? `, down to ${pct(min)} different` : ""}`;
}

// ---------- the Mix games: pure generators ----------
// A gradient strip of k tiles whose neighbors differ by about `step` (ΔE00), along a random direction.
function ooGradStrip(k, step, rnd, base) {
  for (let t = 0; t < 30; t++) {
    const b0 = base && t < 3 ? base : ooBase(rnd, {}), dir = ooRandDir(rnd), out = [b0];
    let ok = true;
    for (let i = 1; i < k && ok; i++) { const m = ooMoveDir(out[i - 1], dir, step); if (!m || de2000(out[0], m.hex) < de2000(out[0], out[i - 1])) ok = false; else out.push(m.hex); }
    if (ok) return out;
  }
  return Array.from({ length: k }, (_, i) => lchHex(30 + i * 50 / (k - 1), 30, 230));
}
// Out of order: one tile moved at least two places from home. Returns { strip (as shown), from, to, right (the true order) }
function ooOrderRound(k, step, rnd, set) {
  const right = ooGradStrip(k, step, rnd, set && set.length ? ooPick(set, rnd) : null);
  let from, to;
  do { from = Math.floor(rnd() * k); to = Math.floor(rnd() * k); } while (Math.abs(from - to) < 2);
  const strip = right.slice(), [t] = strip.splice(from, 1); strip.splice(to, 0, t);
  return { strip, right, from, to, step };
}
// What changed: a board, then the same board with one tile moved by d
function ooChangedRound(n, d, rnd, set) {
  const N = n * n, axis = ooPick(OO_AXES, rnd), colors = [];
  for (let i = 0; i < N; i++) colors.push(ooBase(rnd, { axis, set }));
  for (let t = 0; t < 20; t++) {
    const at = Math.floor(rnd() * N), m = ooMove(colors[at], axis, rnd() < .5 ? -1 : 1, d);
    if (m) { const after = colors.slice(); after[at] = m.hex; return { before: colors, after, at, act: m.act, axis, d }; }
  }
  return null;
}
// Was it there: four colors, then five where one is new (close, d, to one of the four)
function ooWasRound(d, rnd, from) {
  const set = [ooBase(rnd, { set: from })];
  for (let t = 0; set.length < 4; t++) { const c = ooBase(rnd, { set: t < 60 ? from : null }); if (set.every(h => de2000(h, c) > (t < 120 ? 18 : 8))) set.push(c); }
  const near = Math.floor(rnd() * 4);
  for (let t = 0; t < 20; t++) {
    const m = ooMoveDir(set[near], ooRandDir(rnd), d, ooGapDE);
    if (m && set.every(h => ooGapDE(h, m.hex) >= d * .85)) { const opts = ooShuf([...set, m.hex], rnd); return { set, opts, fresh: opts.indexOf(m.hex), act: m.act, near, d }; }
  }
  return null;
}
// Color n-back (2-back): a sequence where about 30% match two back; non-matches two back are lures d away
function ooNbackSeq(len, d, rnd, from) {
  const seq = [], kind = [];
  for (let i = 0; i < len; i++) {
    if (i >= 2 && rnd() < .32) { seq.push(seq[i - 2]); kind.push("same"); continue; }
    if (i >= 2 && rnd() < .55) { const m = ooMoveDir(seq[i - 2], ooRandDir(rnd), d); if (m) { seq.push(m.hex); kind.push("lure"); continue; } }
    let c, t = 0; do { c = ooBase(rnd, { set: t < 30 ? from : null }); t++; } while (seq.length && de2000(c, seq[seq.length - 1]) < 15 && t < 80);
    seq.push(c); kind.push("new");
  }
  return { seq, kind, d };
}

// ---------- Across the line: odd one out by name (design/IDEAS-10X/train-games.md §2, §7 B) ----------
// "Three of these are Teal. Which one isn't?" The in-name tiles vary inside Teal's region; one tile sits just
// across the boundary in a neighbor name, often closer to its nearest tile than the in-name tiles are to each
// other, so "the most different tile" fails and the word's edge is the skill.
// Confident edges only (design/IMPROVE-2026-10-08/train.md §5, "the app can't explain itself"): a round is drawn
// only where the odd tile's own name wins by a margin (its ΔE to that name at least 30% lower than to the
// category word, and clearly ahead of any third name), the in-name tiles sit confidently inside the word, and the
// trap (the in-name tile nearest the odd one) is still clearly on the word's side. Near-ties are never asked.
// opts: { p (ΔE between the odd tile and the trap), k (tiles: 4 or 6), cats: [{ n, h }] (category words, e.g.
//         your Learn words), namer(hex) -> { n, de, near: [{ n, h, de }] } (nameOf in the app; a nearest-name
//         list in tests), margin (default .3) }
// Returns { cat, catHex, nb, nbHex, colors, at, trap, B, p, act, spread, margin, tries } or null.
const OO_NEAR_DE = 8, OO_LINE_MARGIN = .3, OO_LINE_TRAP = .12, OO_LINE_IN = .25;
// how clearly hex belongs to its nearest name: 1 - d(nearest) / d(runner-up). vs: a name to measure against
// instead of the runner-up (the category word, for the odd tile).
function ooNameMargin(hex, nm, vs) {
  const near = nm.near || [], d1 = nm.de;
  let d2;
  if (vs) { const x = near.find(e => e.n === vs.n); d2 = x && x.de != null ? x.de : de2000(hex, vs.h); }
  else { const x = near.find(e => e.n !== nm.n); d2 = x && x.de != null ? x.de : null; }
  if (d2 == null) return 1;
  return d2 > 0 ? 1 - d1 / d2 : 0;
}
function ooLineRound(rnd, o) {
  const k = o.k || 4, p = o.p || 6, namer = o.namer, cats = o.cats || [], mg = o.margin != null ? o.margin : OO_LINE_MARGIN;
  let tries = 0;
  const st = o.stats || {};
  ["narrow", "noflip", "gate", "spread", "unsure"].forEach(x => { st[x] = st[x] || 0; });
  for (let c = 0; c < 12; c++) {
    const N = ooPick(cats, rnd);
    if (!N) return null;
    const nN = namer(N.h);
    if (nN.n !== N.n) continue;
    // the region must be wide enough: jittered samples within ΔE 6 keep the name
    const wide = [0, 1, 2, 3, 4].map(() => ooMoveDir(N.h, ooRandDir(rnd), ooBtw(2, 4, rnd))).filter(m => m && namer(m.hex).n === N.n && namer(m.hex).de < OO_NEAR_DE).length;
    if (wide < 3) { st.narrow++; continue; }
    const Ms = (nN.near || []).filter(x => x.n !== N.n).slice(0, 2);
    if (!Ms.length) continue;
    for (let t = 0; t < 30; t++) {
      tries++;
      const M = Ms[t % Ms.length];
      // march from N toward M (a little off the straight line, so rounds vary) until the name flips
      const A = lab(N.h), Bm = lab(M.h), jit = ooRandDir(rnd).map(x => x * 3), dir = Bm.map((x, i) => x - A[i] + jit[i]);
      const len = Math.hypot(...dir), u = dir.map(x => x / len);
      let lo = 0, hi = null;
      for (let s2 = .4; s2 <= len * 1.6; s2 += .4) { const P = A.map((x, i) => x + u[i] * s2); if (!inGamut(...P)) break; if (namer(labHex(...P)).n !== N.n) { hi = s2; break; } lo = s2; }
      if (hi == null) { st.noflip++; continue; }
      for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2, P = A.map((x, j) => x + u[j] * mid); if (namer(labHex(...P)).n !== N.n) hi = mid; else lo = mid; }
      const Bhex = labHex(...A.map((x, i) => x + u[i] * hi));
      // place the odd tile far enough past the line that its own name clearly wins, with the trap p behind it
      // and still clearly inside the word: the first split that satisfies both
      let odd = null, trap = null, nb = null, margin = 0;
      for (const f of [.5, .6, .7, .8, .9]) {
        const od = ooMoveDir(Bhex, u, p * f), tr = od && ooMoveDir(od.hex, u.map(x => -x), p);
        if (!od || !tr) continue;
        const nm = namer(od.hex), nt = namer(tr.hex);
        if (nm.n === N.n || nt.n !== N.n || nm.de >= OO_NEAR_DE) continue;
        const m1 = ooNameMargin(od.hex, nm, N), m2 = ooNameMargin(od.hex, nm), m3 = ooNameMargin(tr.hex, nt);
        if (m1 >= mg && m2 >= mg / 2 && m3 >= OO_LINE_TRAP) { odd = od; trap = tr; nb = nm; margin = m1; break; }
      }
      if (!odd) { st.unsure++; continue; }
      const act = de2000(odd.hex, trap.hex);
      if (act < .3) continue;
      // the other in-name tiles: a pool of samples confidently inside the word, then a pick that spreads them so
      // at least one in-name pair is further apart than odd vs trap (the "most different tile" is a trap)
      const pool = [], gap = Math.max(.8, p * .4);
      for (let g = 0; g < 36; g++) {
        const m = ooMoveDir(N.h, ooRandDir(rnd), ooBtw(.25, 1.1, rnd) * hi);
        if (!m || de2000(m.hex, odd.hex) <= act * .9 || de2000(m.hex, trap.hex) < gap) continue;   // the cheap tests first
        const nm = namer(m.hex);
        if (nm.n === N.n && ooNameMargin(m.hex, nm) >= OO_LINE_IN) pool.push({ hex: m.hex, dt: de2000(m.hex, trap.hex) });
      }
      // the first one from the far side of the word (from the top third by distance to the trap), the rest at random
      pool.sort((x, y) => y.dt - x.dt);
      const far = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3))), first = far.length ? far[Math.floor(rnd() * far.length)] : null;
      const ins = [trap.hex];
      if (first) ins.push(first.hex);
      ooShuf(pool.filter(x => x !== first), rnd).forEach(x => { if (ins.length < k - 1 && ins.every(h => de2000(h, x.hex) >= gap)) ins.push(x.hex); });
      if (ins.length < k - 1) { st.spread++; continue; }
      const spread = Math.max(...ins.flatMap((a, i) => ins.slice(i + 1).map(b => de2000(a, b))));
      // prefer boards where "the most different tile" is a trap: retry a few times before settling
      if (spread <= act && t < 10) { st.trapless = (st.trapless || 0) + 1; continue; }
      const colors = ooShuf([...ins, odd.hex], rnd);
      const nbE = (nb.near || []).find(x => x.n === nb.n);
      return { cat: N.n, catHex: N.h, nb: nb.n, nbHex: (nbE && nbE.h) || (nb.n === M.n ? M.h : nb.h) || M.h, colors, at: colors.indexOf(odd.hex), trap: colors.indexOf(trap.hex), odd: odd.hex, B: Bhex, p, act, spread, trapOk: spread > act, margin: +margin.toFixed(3), tries };
    }
  }
  return null;
}
// the line's own staircase: the push past the boundary, 8 at the start down to 1.5
const OO_LINE_P0 = 5, OO_LINE_MIN = 1;

// ---------- Painters' pairs: which two colors turn up together in paintings (data/games/pairs.js) ----------
// A round shows two pairs of colors. "love": which pair appears together more often (by lift over chance);
// "group": the same question inside one country or century; "avoided": one pair is a clear stranger (seen
// together at most half as often as chance): which? Only clearly separated pairs are played:
// |ln L1 − ln L2| ≥ 3 standard errors (SE ≈ sqrt(1/n1 + 1/n2), n = paintings with both, or expected for a
// stranger) and a lift ratio of at least the tier's (easy 3, medium 2, hard 1.5).
const OO_PAIR_RATIO = { intro: 3, easy: 3, medium: 2, hard: 1.5, harder: 1.5, boss: 1.5, expert: 1.3 };
const ooPairSE = p => 1 / Math.max(p[2], p[4] < 1 ? p[3] : 1, 1);
function ooPairClear(p, q, ratio) {
  const d = Math.abs(Math.log(Math.max(p[4], .02) / Math.max(q[4], .02)));
  return d >= Math.log(ratio) && d >= 3 * Math.sqrt(ooPairSE(p) + ooPairSE(q));
}
// P: window.OO_PAIRS; o: { variant: "love" | "group" | "avoided", group, tier }. Returns { variant, group, a, b, win (0|1) } or null.
function ooPairsRound(P, rnd, o = {}) {
  const v = o.variant || "love";
  const groups = Object.keys(P.groups).filter(g => g !== "all" && P.groups[g].pairs.filter(p => p[4] >= 1.2).length >= 4);
  // a small group may have no clear pair at this tier: try the others, then a gentler ratio (still 3 SE apart)
  const order = v === "group" ? [...(o.group && P.groups[o.group] ? [o.group] : []), ...ooShuf(groups, rnd)] : ["all"];
  for (const ratio of [o.ratio || OO_PAIR_RATIO[o.tier || "medium"] || 2, 1.5]) for (const g of order) { const r = ooPairsIn(P, rnd, v, g, ratio); if (r) return r; }
  return null;
}
function ooPairsIn(P, rnd, v, g, ratio) {
  const pairs = P.groups[g].pairs, comp = pairs.filter(p => p[4] >= 1.2 && p[5].length >= 3), strange = pairs.filter(p => p[4] <= .55);
  for (let t = 0; t < 200; t++) {
    let a, b;
    if (v === "avoided") { a = ooPick(comp, rnd); b = ooPick(strange, rnd); }
    else { a = ooPick(comp, rnd); b = ooPick(t < 120 ? comp.filter(q => q !== a && (q[0] === a[0] || q[1] === a[1] || q[0] === a[1] || q[1] === a[0] || t > 60)) : comp, rnd); }
    if (!a || !b || a === b || !ooPairClear(a, b, ratio)) continue;
    const win = v === "avoided" ? 1 : a[4] > b[4] ? 0 : 1;
    return rnd() < .5 ? { variant: v, group: g, a, b, win } : { variant: v, group: g, a: b, b: a, win: 1 - win };
  }
  return null;
}

// ---------- difficulty: "For you" or "Choose" (the same control on every game) ----------
// For you adapts, as before. Choose pins the game at Easy, Medium, Hard, Expert or "Edge of my eye": the same
// tiers the sets already breathe through (easy, medium, hard, harder, boss), as multiples of your own estimate,
// so a chosen difficulty is still drawn from your eye and every answer at it updates the estimate fairly (the
// update uses the difference actually drawn, never the label). Edge is the boss tier: a round right at your
// measured threshold.
const OO_DIFFS = [["easy", "Easy", "easy"], ["medium", "Medium", "medium"], ["hard", "Hard", "hard"], ["expert", "Expert", "harder"], ["edge", "Edge of my eye", "boss"]];
const OO_DIFF_IDS = OO_DIFFS.map(d => d[0]);
const OO_DIFF_TIER = Object.fromEntries(OO_DIFFS.map(d => [d[0], d[2]]));
const ooDiffName = id => (OO_DIFFS.find(d => d[0] === id) || OO_DIFFS[1])[1];
const ooLim = (v, a, b) => Math.max(a, Math.min(b, v));
function ooPrefNorm(p) {
  p = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  // d: a preset id, or "level" (you tapped a level on the map: lv is the one to play)
  // Odd one out also keeps its board (mode: Classic or Shuffle; grid: 2-16 a side; odd: 1-4 odd tiles)
  const q = { m: p.m === "pick" ? "pick" : "you", d: OO_DIFF_IDS.includes(p.d) || p.d === "level" ? p.d : "medium", lv: Number.isInteger(p.lv) ? ooLim(p.lv, 0, OO_LEVEL_N - 1) : null };
  q.mode = p.mode === "shuffle" ? "shuffle" : "classic";
  q.grid = Number.isInteger(p.grid) ? ooLim(p.grid, OO_GRID_MIN, OO_GRID_MAX) : 3;
  q.odd = Number.isInteger(p.odd) ? ooLim(p.odd, 1, OO_ODD_MAX) : 1;
  // Customize (David, 2026-10-09: "Spot the difference seems too complex" -- these move off the entry screen,
  // into one sheet): names, whether the odd tile's name shows on the board; len, how many rounds a session runs.
  q.names = p.names !== false;
  q.len = [15, 30, 50].includes(p.len) ? p.len : OO_SESSION_N;
  return q;
}
// Odd one out: the ladder level a Choose pick plays, or null for For you. th is your threshold (ΔE00) for Edge of my eye.
function ooPickLevel(p, th) {
  p = ooPrefNorm(p);
  if (p.m !== "pick") return null;
  if (p.d === "level") return p.lv != null ? p.lv : OO_PRESET_LV.medium;
  return p.d === "edge" ? ooLevelForTh(th || 6.3) : OO_PRESET_LV[p.d];
}
// the tier a game draws at when you chose a difficulty, else null (For you)
const ooPickTier = p => { p = ooPrefNorm(p); return p.m === "pick" ? OO_DIFF_TIER[p.d] : null; };
// test-out rounds are Hard, or your chosen difficulty when that is harder still
const ooTestTier = p => { const t = ooPickTier(p); return t && OO_TIER[t] <= OO_TIER.hard ? t : "hard"; };

// ---------- a session: one staircase that climbs to the edge of your eye (David, 2026-10-09) ----------
// "A lesson should progressively get harder and harder and match exactly where your vision is: nothing too hard,
// nothing too easy, and keep going longer." A session is 30 rounds (Keep going adds 10) on one continuous level x
// (0..19; the gap is log-interpolated between the ladder's levels). Until the first miss it climbs a whole level per
// right answer (the run-up); after that a right answer climbs half a level and a miss drops one and a half. That
// weighted staircase (Kaernbach 1991) settles where you are right 1.5 / (0.5 + 1.5) = 75% of the time: hard enough
// to feel, easy enough to keep going. Your edge today is the mean level at the turning points (after the first two).
// Choose starts x at your pick (round 1 is drawn at exactly that level's gap); For you starts a little below your
// measured edge, so the first rounds are wins and the climb is visible.
const OO_GRID_MIN = 2, OO_GRID_MAX = 16, OO_ODD_MAX = 4;
const OO_SESSION_N = 30, OO_SESSION_MORE = 10, OO_UP = .5, OO_DOWN = 1.5, OO_RUSH = 1;
// between two levels the gap is log-interpolated; on a whole level it is exactly that level's gap (the number the ladder shows)
const ooGapAt = x => { x = ooLim(+x || 0, 0, OO_LEVEL_N - 1); const i = Math.min(OO_LEVEL_N - 2, Math.floor(x)), f = x - i; return f < 1e-9 ? OO_GAPS[i] : Math.exp(Math.log(OO_GAPS[i]) * (1 - f) + Math.log(OO_GAPS[i + 1]) * f); };
// the continuous level of a gap (the inverse of ooGapAt)
function ooXOfGap(g) {
  if (!(g < OO_GAPS[0])) return 0;
  for (let i = 0; i < OO_LEVEL_N - 1; i++) if (g >= OO_GAPS[i + 1]) return i + Math.log(g / OO_GAPS[i]) / Math.log(OO_GAPS[i + 1] / OO_GAPS[i]);
  return OO_LEVEL_N - 1;
}
const ooSess = (lv, n = OO_SESSION_N) => { const x = ooLim(+lv || 0, 0, OO_LEVEL_N - 1); return { x, x0: x, n, i: 0, hits: 0, hist: [], rev: [], dir: 0, rush: true, top: -1, hi: x, ups: 0 }; };
// one answer: moves the level; returns true when this answer reached a new whole level (a level-up moment)
function ooSessStep(s, ok) {
  const x = s.x, hi0 = Math.floor(s.hi);
  s.hist.push({ x, ok: ok ? 1 : 0 }); s.i++;
  if (ok) { s.hits++; s.top = Math.max(s.top, Math.floor(x + 1e-9)); }
  const move = ok ? (s.rush ? OO_RUSH : OO_UP) : -OO_DOWN;
  if (!ok) s.rush = false;
  const dir = Math.sign(move);
  if (s.dir && dir !== s.dir) s.rev.push(x);
  s.dir = dir;
  s.x = ooLim(x + move, 0, OO_LEVEL_N - 1);
  s.hi = Math.max(s.hi, s.x);
  const up = !!ok && Math.floor(s.hi + 1e-9) > hi0;
  if (up) s.ups++;
  return up;
}
// your edge today, as a continuous level: the turning points once there are three (the first two dropped when
// there are enough), else the mean level of the last ten rounds
function ooSessEdge(s) {
  const r = s.rev.length >= 6 ? s.rev.slice(2) : s.rev;
  if (r.length >= 3) return r.reduce((a, x) => a + x, 0) / r.length;
  const h = s.hist.slice(-10);
  return h.length ? h.reduce((a, x) => a + x.x, 0) / h.length : s.x;
}
// where a session starts. pick: a chosen level (Choose); else a little below your last edge, or below the level of
// your measured threshold th (the model's 50%-above-guessing point; the 75% point sits about two levels easier)
function ooSessStart(o = {}) {
  if (o.pick != null) return ooLim(o.pick | 0, 0, OO_LEVEL_N - 1);
  if (o.edge != null && isFinite(o.edge)) return Math.max(0, Math.floor(o.edge - 3));
  if (o.th) return Math.max(0, Math.floor(ooXOfGap(o.th) - 4));
  return 0;
}
// Classic: one square grid the whole session (n a side, k odd tiles); Shuffle rotates the layouts
const ooClassic = (n = 3, k = 1) => { n = ooLim(n | 0, OO_GRID_MIN, OO_GRID_MAX); return { id: "classic", name: `${n} × ${n} squares`, v: "one", b: "grid", n, k: ooLim(k | 0, 1, Math.min(OO_ODD_MAX, n * n - 1)), at: 0 }; };
// the target gap for the next round of a session on a layout: the session's level, through the layout's modifier.
// No easing for new layouts or anything else: the staircase alone sets the difficulty, so a chosen level is honest.
const ooSessD = (s, lay) => ooLim(ooGapAt(s.x) * ooLayoutF(lay), OO_MIN, OO_MAX);

// ---------- the level map: every level is open; clearing is playing it or testing out ----------
const ooDoneAt = (stars, cleared, i) => !!((stars && Array.isArray(stars[i]) && stars[i][0]) || (cleared && cleared[i]));
// the first level that is neither played through nor cleared: where For you picks up
function ooFrontier(stars, cleared, n = OO_LEVELS.length) { for (let i = 0; i < n; i++) if (!ooDoneAt(stars, cleared, i)) return i; return n - 1; }
// passing a test-out at level i (0-based) marks every level below it cleared; returns how many were newly marked
function ooTestOutMark(cleared, i) { let k = 0; for (let j = 0; j < i; j++) if (!cleared[j]) { cleared[j] = 1; k++; } return k; }
const OO_TEST_ROUNDS = 3;

// ---------- the edge estimate for the games that have no eye model (Across the line, Painters' pairs, Whose palette?) ----------
// Each game has one number on its own scale where a round is "easy" when its difficulty d is large (p: ΔE past the
// line; lift ratio minus 1; how far down the list the nearer decoy sits). The same item-response update as
// ooUpdate, on the log of a threshold th: the round is drawn at th × tier, and every answer, whatever the mode,
// moves th by how surprising it was.
const OO_EDGE = { line: { th: 2.5, lo: .5, hi: 8, g: .25 }, pairs: { th: .7, lo: .15, hi: 2, g: .5 }, whose: { th: .5, lo: .05, hi: 1, g: 1 / 3 } };
const ooEdgeTh = (e, game) => e && isFinite(e.r) ? Math.exp(e.r) : OO_EDGE[game].th;
const ooEdgeD = (e, game, tier) => ooLim(ooEdgeTh(e, game) * OO_TIER[tier], OO_EDGE[game].lo, OO_EDGE[game].hi);
function ooEdgeUpdate(e, game, d, ok) {
  const C = OO_EDGE[game];
  if (!isFinite(e.r)) e.r = Math.log(C.th);
  e.n = e.n | 0;
  const err = (ok ? 1 : 0) - ooP(Math.max(d, 1e-3), Math.exp(e.r), C.g), K = Math.max(.07, .55 / Math.sqrt(1 + e.n / 3));
  e.r = ooLim(e.r - K * err, Math.log(C.lo), Math.log(C.hi)); e.n++;
  return e;
}
// how far apart two pairs' lifts are, as the ratio the tiers talk about (always at least 1)
const ooPairRatioOf = (a, b) => Math.exp(Math.abs(Math.log(Math.max(a[4], .02) / Math.max(b[4], .02))));
// Whose palette?: a round lists its decoy painters nearest (hardest) first. ease 0..1 says where in that list the
// nearer of the two decoys sits (1 = the farthest, easiest). Returns { alts: [two entries], ease } or ease null when
// the list is too short for the choice to matter.
function ooWhoseAlts(list, ease, rnd) {
  const L = list.length;
  if (L <= 2) return { alts: list.slice(0, 2), ease: null };
  let j = Math.round(ooLim(ease, 0, 1) * (L - 1) + (rnd() - .5) * 1.4);
  j = ooLim(j, 0, L - 1);
  const k = j >= L - 1 ? j - 1 : j + 1, lo = Math.min(j, k);
  return { alts: [list[j], list[k]], ease: lo / (L - 1) };
}

// ======================================================================
// The simple game (David, 2026-10-10): "very simple, always adapting... give you a flow state by making it just
// hard enough". No menus: one screen, a 3 x 3 board, three separate staircases (hue, chroma, lightness), each
// drawn near its own threshold (reusing the item-response estimate above: ooTheta/ooUpdate already track where
// you're right about half the time, so a round drawn at OO_S_MULT x that threshold lands you right about 79% of
// the time -- the "weighted staircase targeting 75-80%" the spec asks for, without a second machine to maintain).
// A visibility floor per axis means a round is never drawn below what a phone screen can actually show; once a
// threshold is sharp enough to hit the floor, difficulty keeps climbing through the grid (3 x 3 up to 9 x 9) and
// the timer instead, never through an invisible gap.
// ======================================================================
// Lowered (David, 2026-10-11: "still way too easy and not getting any harder"): the grid size is now fixed per run
// (his choice), so the grid can no longer carry difficulty past the floor -- the gap must keep shrinking instead.
// His live 3-column rounds measured ~2-2.5 dE00 as drawn: the old floor (1.6-2.4, x1.2 pad), not his eye, set them.
// These sit just above what 8-bit sRGB can still step (~0.3-0.5 dE00 per code value) and stay visible on big tiles.
const OO_S_FLOOR = { hue: 1, chroma: .85, light: .65 };   // dE00, as drawn
const OO_S_MULT = 1.2;     // d = th x this lands right ~70% of the time in theory (OO_SLOPE=3, OO_LAPSE=.03; see ooP);
// in practice the online estimate runs a little generous, and richer boards add their own difficulty on top, which
// together settle actual play closer to 78-82% (tools/oo_simple_sim.js)
// David, 2026-10-11, "still too easy... not getting any harder" (measured ~2-2.5 dE00 drawn on his own 3-column
// board): the slow cross-run IRT theta alone can't visibly tighten a difficulty WITHIN one run -- it moves by a
// shrinking K each update (oo-engine.js's ooUpdate), nowhere near fast enough to read as "climbing" over a
// session. A second, fast, IN-RUN staircase now sits on top of theta and does the actual round-to-round
// tightening: 2 rights in a row multiplies the drawn gap by OO_STAIR_DOWN, a miss multiplies it by OO_STAIR_UP.
// It starts at 1 every run (David: "start each run at the model's threshold x 1.0 -- no chill start above
// threshold"), reset in oo-ui.js's ooMap(). theta itself still updates every round (the slower, cross-run
// "eye profile" signal), but no longer gates how far the staircase can push the gap down mid-run.
const OO_STAIR_DOWN = .8, OO_STAIR_UP = 1.25, OO_STAIR_MIN = .12, OO_STAIR_MAX = 3;
const OO_S_BREATHE_MULT = 1.3;    // a breather round: easier, for rhythm, not a reward (David, 2026-10-11: lowered
// from 1.7, and down to at most 1 in 8 rounds -- below, round % 8 === 7 -- from 1 in 5; the old rate+multiplier
// visibly interrupted the staircase's own downward climb often enough to read as "not getting harder")
// the ONLY ceiling left (David, 2026-10-11: "find and remove anything else that inflates early rounds...
// ease ceiling minimums"): a flat, size-independent absolute safety cap on richness/size-compensation blowing a
// single round up past readable -- never a lower bound (the old ease = max(d, floor*pad, min(EASE_MAX, th*X))
// guaranteed the drawn gap could never fall under the player's own current threshold, which is exactly what
// silently neutralized the staircase above: however far down the staircase pushed, ease's own max(d, ...) term
// pulled the FLOOR of "d" itself right back up to theta. Gone entirely; the single floor below (OO_S_FLOOR x
// sizeBias, oo-engine.js's ooSimpleRound) is the only thing a round can never go under now.
const OO_S_EASE_MAX = 6;
const OO_S_MIN_COLS = 3, OO_S_MAX_COLS = 20;   // David, 2026-10-10: "the grid can go much bigger", "up to ~12x20"
// -- this is a SIZE index (the board's longer side), not a literal column count once boards stop being square
// (ooSimpleDims below turns it into rows x cols for the screen's own aspect)
const OO_S_WINDOW = 8, OO_S_GROW_AT = .82, OO_S_SHRINK_AT = .4;   // rolling accuracy at this grid size
const ooLerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
// a rows x cols board that fills the play area, longer side `size`, short side set by `aspect` (height/width of
// the area it has to fill: >1 portrait, <1 landscape). David, 2026-10-10: "the board doesn't have to be
// square... rows > columns on a phone (3x4, 4x6, 6x9 ... up to ~12x20)" -- this formula reproduces those
// examples directly (size 4 -> 3x4, size 6 -> 4x6, size 9 -> 6x9, size 20 -> 13x20).
// size is a COLUMN count (David, 2026-10-11: "closer to square is better... size options become columns, rows
// derived to fill the height with near-square tiles") -- rows are derived straight from the real on-screen
// aspect, not a fixed 1.6 guess, so (stageWidth/cols) / (stageHeight/rows) lands close to 1 by construction
// instead of rounding away from square at small column counts the way a fixed-aspect guess did.
function ooSimpleDims(size, aspect = 1.6) {
  const cols = clamp(Math.round(size), 3, OO_S_MAX_COLS);
  const portrait = aspect >= 1, a = portrait ? aspect : 1 / aspect;
  const rows = clamp(Math.round(cols * a), cols, OO_S_MAX_COLS * 3);
  return portrait ? { rows, cols } : { rows: cols, cols: rows };
}
// a rows x cols grid of cells (fractions of the board, which simply fills its container -- David, 2026-10-11:
// "the board doesn't have to be square"), unlike ooCells("grid", n, ...) above, which is always square.
function ooSimpleCells(cols, rows) {
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push({ x: x / cols, y: y / rows, w: 1 / cols, h: 1 / rows, gx: x, gy: y, shape: "sq" });
  return cells;
}

// which axis the next round tests: weighted toward the one with the least evidence so far (interleaved, not round-robin)
function ooSimpleAxis(model, rnd = Math.random) {
  const ws = OO_AXES.map(j => 1 / (1 + ((model.j[j] && model.j[j].n) || 0)));
  const sum = ws.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < OO_AXES.length; i++) { r -= ws[i]; if (r <= 1e-9) return OO_AXES[i]; }
  return OO_AXES[OO_AXES.length - 1];
}
// the gap to draw this round: near the axis's own threshold, a little jittered, scaled by the in-run staircase
// (OO_STAIR_DOWN/UP above). David, 2026-10-11: removed the old floor*PAD lower bound here entirely -- a round
// can no longer be rescued back up to "the floor, padded" before the staircase and sizeBias even get a say; the
// ONE remaining floor (OO_S_FLOOR x sizeBias) is applied once, last, in ooSimpleRound below, after everything
// else has had its full effect on the gap.
function ooSimpleD(model, axis, breather, stairMult, rnd = Math.random) {
  const th = ooTheta(model, axis, null), jit = .94 + rnd() * .12, mult = (breather ? OO_S_BREATHE_MULT : 1) * OO_S_MULT * (stairMult || 1);
  return Math.min(OO_MAX, th * jit * mult);
}
// how many tiles are odd this round. k4 only once the grid is big enough that four odd tiles isn't most of it.
function ooSimpleShape(n, rnd = Math.random) {
  const r = rnd();
  if (n >= 16 && r < .08) return "k4";
  if (r < .25) return "k2";
  return "one";
}
// ---------- OKLab/OKLCH (Björn Ottosson): the board's own gradient is mixed here, not in CIELAB, so a sweep
// between two saturated colors stays luminous instead of dipping through a muddy grey midpoint. The odd tile's
// move stays on the CIELAB machinery above (ooMove/ooMoveDir/ooGapDE): that's what the visibility floors and the
// learner model are calibrated against, and it only ever touches one tile at a time, so there's no mid-mix to protect.
function ooOklab(hex) {
  const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  const l = .4122214708 * r + .5363325363 * g + .0514459929 * b, m = .2119034982 * r + .6806995451 * g + .1073969566 * b, s = .0883024619 * r + .2817188376 * g + .6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [.2104542553 * l_ + .7936177850 * m_ - .0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + .4505937099 * s_, .0259040371 * l_ + .7827717662 * m_ - .8086757660 * s_];
}
function ooOklabRgb(L, a, b) {
  const l_ = L + .3963377774 * a + .2158037573 * b, m_ = L - .1055613458 * a - .0638541728 * b, s_ = L - .0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s]
    .map(v => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
}
const ooOklabInGamut = (L, a, b) => ooOklabRgb(L, a, b).every(v => v >= -.002 && v <= 1.002);
const ooOklabHex = (L, a, b) => "#" + ooOklabRgb(L, a, b).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const ooOklabMixRaw = (A, B, t) => A.map((x, i) => x + (B[i] - x) * t);
// a point along several OKLab stops (2-4), piecewise
function ooOklabPathRaw(stops, t) {
  if (stops.length === 1) return stops[0];
  const segs = stops.length - 1, pos = clamp(t, 0, 1) * segs, i = Math.min(segs - 1, Math.floor(pos));
  return ooOklabMixRaw(stops[i], stops[i + 1], pos - i);
}
// in gamut, by pulling chroma toward the mix's own lightness rather than darkening -- keeps a rich sweep luminous
// instead of sliding to grey at the edge of what the screen can show.
function ooOklabToHexSafe(P) {
  let k = 1;
  for (let i = 0; i < 24 && !ooOklabInGamut(P[0], P[1] * k, P[2] * k); i++) k *= .92;
  return ooOklabHex(P[0], P[1] * k, P[2] * k);
}
// ---------- the whole grid as one beautiful palette (David, 2026-10-10 and 2026-10-11): not a per-tile stripe
// pattern, and not a flat ground either -- the board itself IS a gradient almost every round, mixed in OKLab
// between 2-4 stops pulled from a curated or personal palette (js/games/oo-ui.js assembles the pool: painting
// palettes, looks, high-lift painter pairs, and the player's own favorites), and the odd tile sits off of where
// that gradient says it should be at its position. Difficulty is three things moving together: more tiles, a
// richer gradient (more stops, a 2-D shape instead of a straight sweep), and a smaller gap -- never just one.
// Flat boards are gone entirely (David, 2026-10-11: "remove flat boards entirely... beginners get a gentle but
// visible two-color gradient") -- ooSimpleGradColors/ooSimpleGradRound still accept "flat" as their last-resort,
// gamut-exhaustion safety net in ooSimpleRound below, an emergency fallback, never a deliberately dealt board.
// A round-based warmup that used to ease the earliest rounds into richness lived here too (OO_S_GRAD_WARMUP/
// OO_S_FLAT_P, both long at 0) -- removed outright (David, 2026-10-11: "find and remove anything else that
// inflates early rounds... the warmup"), since neither constant was read by anything any more.
const OO_S_RICH = {
  grad1: { stops: 2, shapes: ["vert", "horiz"] },
  grad2: { stops: 3, shapes: ["diag", "radial"] },
  grad3: { stops: 4, shapes: ["corners4"] },
};
const OO_S_GRAD_F = { flat: 1, grad1: 1.12, grad2: 1.28, grad3: 1.45 };   // a richer ground gets a bigger d to compensate (same convention as bf elsewhere), so the per-axis estimate stays comparable across ground types
// skill: 0 (struggling, still on a small grid) .. 1 (sharp, near the grid cap) -- reuses the grid-size proxy
// that already drives difficulty, so no second "how good are they" number needs tracking.
const ooSimpleSkill = size => clamp((size - OO_S_MIN_COLS) / (OO_S_MAX_COLS - OO_S_MIN_COLS), 0, 1);
// which richness this round draws: always a gradient now, 2/3/4 stops with the mix shifting toward the richer
// tiers as skill rises (but never locked out at either end -- a beginner still meets a rich board sometimes, an
// expert still gets a gentler one, which is what keeps it feeling like a game and not a ladder).
// "Subtle" (default, David 2026-10-11: "less palettes and more subtle gradients as the default") keeps almost
// every board a gentle two-stop drift, richer tiers only occasionally and more often as skill/tile count rise;
// "Rich" (the Settings opt-in) is the old skill-weighted ladder across all three tiers.
function ooSimpleGridType(skill, round, rnd = Math.random, richMode = "subtle") {
  if (richMode === "rich") {
    const p1 = ooLerp(.72, .06, skill), p2 = ooLerp(.22, .34, skill), r = rnd();
    return r < p1 ? "grad1" : r < p1 + p2 ? "grad2" : "grad3";
  }
  const p2 = ooLerp(.03, .18, skill), r = rnd();
  return r < p2 ? "grad2" : "grad1";
}
// David, 2026-10-11, "still too easy... not getting any harder": removed three more dead holdovers from
// earlier, superseded designs that tools/undef_scan.js's exports kept alive in name only (none were called from
// anywhere once the grid went fixed-per-run) -- a round-to-round size "band" (ooSimpleRoundCols/ooSizeBiasMult/
// OO_S_BAND) and a first-20-rounds "always starts chill... ramps toward the real skill level" size ramp
// (ooSimpleRampCols/OO_S_RAMP_ROUNDS/OO_S_RAMP_FLOOR). Neither was reachable in practice, but keeping them
// around as if still live was exactly the kind of thing worth finding and removing outright.
// the expected color field. stopHexes: 2-4 real colors (a curated or favorite palette, picked in oo-ui.js);
// cycles through them if a tier needs more stops than it was given. skill sets how far the sweep's own span
// reaches edge to edge -- gentle for a beginner, steep for an expert -- independent of the odd tile's own gap.
function ooSimpleGradColors(rows, cols, richness, stopHexes, skill, rnd = Math.random, pullCap = 1, richMode = "subtle") {
  const cells = ooSimpleCells(cols, rows);
  if (richness === "flat" || !stopHexes || !stopHexes.length) {
    const base = (stopHexes && stopHexes[0]) || ooBase(rnd, {});
    return { cells, colors: Array(cells.length).fill(base), pull: 0 };
  }
  const R = OO_S_RICH[richness] || OO_S_RICH.grad1, need = R.stops;
  let raw, shape = ooPick(R.shapes, rnd);
  // David, 2026-10-11 (correcting an earlier version of this default): the default isn't single-hue-only, it's
  // "1-2 harmonious colors... occasionally a single-color drift for rhythm". So a subtle grad1 round mostly uses
  // two REAL stops from the curated palette (close by construction once richness/pull favor grad1 and the
  // neighbor-step cap below narrows the slice), and only sometimes -- for rhythm, not as the default -- drifts a
  // single anchor color by a small OKLab nudge instead of jumping to the palette's second color at all.
  if (richMode !== "rich" && richness === "grad1" && rnd() < .28) {
    const anchor = ooOklab(stopHexes[Math.floor(rnd() * stopHexes.length)]);
    raw = [anchor, anchor.map((x, j) => x + (rnd() * 2 - 1) * (j === 0 ? .06 : .045))];
  } else {
    const stops = []; for (let i = 0; i < need; i++) stops.push(stopHexes[i % stopHexes.length]);
    raw = stops.map(ooOklab);
  }
  // a beginner's sweep keeps only part of the source palette's own contrast (pulled toward its mean, same colors,
  // gentler spread); an expert sees the palette at its own full contrast. Never pulled so far it's flat. A FEW
  // tiles also pull harder toward the mean than many do (David, 2026-10-11: "a normal gradient step looks like a
  // radically different tile" on a small board otherwise) -- the palette's own full span only gets to show once
  // there are enough steps across the board to spread it over; a 3-wide board sees a short, close slice of it.
  const steps = Math.max(cols - 1, rows - 1, 1), sizePull = clamp(steps / 14, .22, 1);
  const pull = clamp(ooLerp(.55, 1, skill) * sizePull * ooBtw(.94, 1.06, rnd) * pullCap, .03, 1);
  const mean = raw[0].map((_, i) => raw.reduce((a, s) => a + s[i], 0) / raw.length);
  const pulled = raw.map(s => ooOklabMixRaw(mean, s, pull));
  const colors = cells.map(c => {
    const fx = cols > 1 ? c.gx / (cols - 1) : .5, fy = rows > 1 ? c.gy / (rows - 1) : .5;
    let P;
    if (shape === "corners4" && pulled.length >= 4) {
      const top = ooOklabMixRaw(pulled[0], pulled[1], fx), bot = ooOklabMixRaw(pulled[2], pulled[3], fx);
      P = ooOklabMixRaw(top, bot, fy);
    } else {
      const t = shape === "vert" ? fy : shape === "horiz" ? fx : shape === "diag" ? (fx + fy) / 2 : Math.min(1, Math.hypot(fx - .5, fy - .5) / .7071);
      P = ooOklabPathRaw(pulled, t);
    }
    return ooOklabToHexSafe(P);
  });
  return { cells, colors, shape, pull };
}
// the worst step between any two grid-ADJACENT tiles, in the same ΔE00 metric the odd tile's own deviation is
// drawn in, so the two numbers are directly comparable.
function ooMaxNeighborStep(cells, colors, cols, rows) {
  let max = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (x + 1 < cols) max = Math.max(max, ooGapDE(colors[i], colors[i + 1]));
    if (y + 1 < rows) max = Math.max(max, ooGapDE(colors[i], colors[i + cols]));
  }
  return max;
}
// a gradient step between neighbors stays well under the odd tile's own move (David, 2026-10-11). Targeted a
// bit under the hard 50% test line (tools/oo_simple_sim.js), not right at it -- the now-smaller easiness
// ceiling (2026-10-11's difficulty pass) shrinks d itself for most rounds, leaving less absolute ΔE00 headroom
// for the generative retries/backstop to work with before they hit their own shrink floor.
// David, 2026-10-11, revisited alongside OO_S_FLOOR/OO_S_MULT and the in-run staircase: a much smaller d (a
// staircase deep into a hot streak can be well under 1 dE00) leaves the generative retries/backstop far less
// absolute headroom before they hit their own shrink floor -- and below about 1 dE00, 8-bit sRGB's own color-
// step quantization (~0.3-0.5 dE00 per code value, OO_S_FLOOR's own comment above) becomes a hard geometric
// limit on how small a neighbor step can get at all, independent of this cap. tools/oo_simple_sim.js's own
// "never an obvious neighbor step" check now only holds rounds with d >= 1 dE00 to the strict <50% line for
// exactly that reason -- a smaller-d round is reported, not failed, since the ratio there is dominated by
// quantization, not a real design choice.
const OO_S_NEIGHBOR_CAP = .35;
// which axis (or combination) this round's error moves along, and how much weight each carries. Usually pure
// (David: keep per-axis estimates clean most of the time); sometimes two or three axes move together, still
// subtle overall, each contributing its share of the one target gap (so the staircase's own calibration -- the
// gap size -- never changes, only how many judgments share the evidence from a single answer).
// the odd tile's difference blends all three axes (David, 2026-10-11: "a different in all three at the same time...
// different proportions... but if it's just like a set of only hue, that could be interesting"). Most rounds: the
// tested (primary) axis leads at 45-70% and the other two share the rest, each at least ~10%. About one round in
// five whose primary is hue stays pure hue -- a hue-only shift is the interesting rarity; light-only reads dull.
function ooSimpleMix(primary, rnd = Math.random) {
  if (primary === "hue" && rnd() < .2) return { hue: 1 };
  const others = OO_AXES.filter(a => a !== primary), wPrimary = .45 + rnd() * .25, rest = 1 - wPrimary;
  const ws = others.map(() => .35 + rnd()), sum = ws.reduce((a, b) => a + b, 0);
  const mix = { [primary]: wPrimary };
  others.forEach((a, i) => { mix[a] = rest * ws[i] / sum; });
  return mix;
}
// a weighted combination of light/chroma/hue as one Lab direction at hex's own position (chroma moves radially
// in the a*b* plane at hex's hue; hue moves tangentially around it -- the same geometry ooDirWord reads back out)
function ooMixDir(mix, hex) {
  const [, , H] = lch(hex), r = H * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
  const wL = mix.light || 0, wC = mix.chroma || 0, wH = mix.hue || 0;
  return [wL, wC * cr - wH * sr, wC * sr + wH * cr];
}
// the odd tile(s): each is moved from its own expected (gradient) color by the mix direction, so the error is
// always measured relative to where that tile's position says it should sit -- never the board's single base color.
// the board stays full-bleed under the notch, the home indicator and the rounded corners -- but a CORRECT tile
// never lands there, so it's always genuinely reachable (David, 2026-10-11: "make the GAME avoid placing the
// odd tile in unsafe zones" instead of insetting the grid, which read as a second blurred layer and shrank the
// board). safeBox is normalized (0-1 of the board) and carries the same box the UI computes from the real
// device's safe-area insets plus a small buffer, with cornerX/cornerY approximating the iPhone's own corner
// radius so a tile tucked exactly into a rounded corner isn't picked either.
function ooCellSafe(cx, cy, box) {
  if (!box) return true;
  if (cx < box.xMin || cx > box.xMax || cy < box.yMin || cy > box.yMax) return false;
  const cr = box.cornerX || 0, crY = box.cornerY || 0;
  if (!cr && !crY) return true;
  for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (Math.abs(cx - ox) > cr || Math.abs(cy - oy) > crY) continue;
    const dx = (cx - ox) / (cr || 1e-6), dy = (cy - oy) / (crY || 1e-6);
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}
function ooSafeIdx(cells, box) {
  if (!box) return cells.map((_, i) => i);
  const idx = [];
  for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (ooCellSafe(c.x + c.w / 2, c.y + c.h / 2, box)) idx.push(i); }
  return idx.length ? idx : cells.map((_, i) => i);   // never leave a round undrawable over an edge case
}
function ooSimpleGradRound(rows, cols, richness, stopHexes, skill, mix, d, k, rnd = Math.random, safeBox = null, richMode = "subtle") {
  for (let attempt = 0; attempt < 10; attempt++) {
    let field = ooSimpleGradColors(rows, cols, richness, stopHexes, skill, rnd, 1, richMode);
    if (!field) continue;
    // a normal gradient step must always read clearly smaller than the odd tile's own move (David, 2026-10-11)
    // -- the size-aware pull above already aims for this, but a palette whose own stops are unusually far apart
    // can still overshoot on a small board; this is the hard backstop, narrowing the slice of the palette used
    // until the board actually satisfies it rather than ever showing the palette raw.
    if (field.pull > 0) {
      let cap = 1;
      for (let tries = 0; tries < 10; tries++) {
        const step = ooMaxNeighborStep(field.cells, field.colors, cols, rows);
        if (step <= d * OO_S_NEIGHBOR_CAP || field.pull <= .03) break;
        cap *= .6;
        field = ooSimpleGradColors(rows, cols, richness, stopHexes, skill, rnd, cap, richMode);
      }
      // a guaranteed backstop: gamut clamping (ooOklabToHexSafe) is non-linear, so a smaller "pull" doesn't
      // always shrink the ACTUAL hex-space step proportionally near the edge of what the screen can show. If the
      // generative retries above still land over the cap, pull the actual output colors straight toward the
      // field's own mean until they don't -- a direct correction on the result, not another guess at pull.
      let step2 = ooMaxNeighborStep(field.cells, field.colors, cols, rows);
      if (step2 > d * OO_S_NEIGHBOR_CAP) {
        const oklabs = field.colors.map(ooOklab);
        const meanC = oklabs[0].map((_, j) => oklabs.reduce((a, s) => a + s[j], 0) / oklabs.length);
        let shrink = 1;
        for (let tries = 0; tries < 10 && step2 > d * OO_S_NEIGHBOR_CAP && shrink > .015; tries++) {
          shrink *= .6;
          const shrunk = oklabs.map(s => ooOklabMixRaw(meanC, s, shrink)).map(ooOklabToHexSafe);
          field = Object.assign({}, field, { colors: shrunk });
          step2 = ooMaxNeighborStep(field.cells, field.colors, cols, rows);
        }
      }
    }
    const { cells, colors, shape } = field, N = cells.length;
    const safeIdx = ooSafeIdx(cells, safeBox);
    const at = ooShuf(safeIdx, rnd).slice(0, Math.min(k, safeIdx.length));
    const out = colors.slice();
    let okAll = true, act = null, odd = null, base0 = null, dir = null, odds = [];
    for (const i of at) {
      const expect = colors[i], dirVec = ooMixDir(mix, expect);
      let m = ooMoveDir(expect, dirVec, d, ooGapDE);
      if (!m) { const a0 = Object.keys(mix)[0]; m = ooMove(expect, a0, rnd() < .5 ? -1 : 1, d) || ooMove(expect, a0, rnd() < .5 ? -1 : 1, d); }
      if (!m) { okAll = false; break; }
      out[i] = m.hex;
      odds.push({ hex: m.hex, base: expect, dir: ooDirWord(expect, m.hex) });
      if (act == null) { act = m.act; odd = m.hex; base0 = expect; dir = ooDirWord(expect, m.hex); }
    }
    if (!okAll) continue;
    // fieldColors is the pure, pre-odd-tile gradient -- the right thing to measure "a normal neighbor step"
    // against (colors/out includes the odd tile's own deviated color, which of course steps big from ITS
    // neighbors; that's the whole point of it, not a violation of the neighbor-step rule). odds carries every
    // moved tile (base + odd + direction), not just the first, so a multi-odd round's reveal can show all of
    // them (David, 2026-10-11: "the reveal must show ALL the odd colors... when the round had 2 or 4").
    return { v: "one", b: "grid", rows, cols, cells, colors: out, fieldColors: colors, ans: at, k: at.length, odd, base: base0, act, dir, odds,
      g: 1 / N, fam: ooFam(base0), gridType: richness, shape, vf: 1 };
  }
  return null;
}
// one round of the simple game. state: { model, cols (the board's own size, FIXED within a run -- see below),
// round, aspect?, palette? (a curated or favorite { colors, label, link } from oo-ui.js's pool, or null) }.
// breather: an easier round for rhythm.
// David, 2026-10-11, final word on grid size (after round-to-round variance, then a ramp, were both tried and
// read as "overwhelming... less zen"): the grid is picked before a run starts (oo-ui.js's pre-game size picker)
// and stays FIXED for the whole run, difficulty coming only from color subtlety from here on -- except a slow,
// one-row/col-at-a-time GROWTH every ~10-12 correct answers in Arcade (off by default in Zen), which oo-ui.js
// drives by simply incrementing state.cols between rounds; this function never varies size on its own.
// Big tiles make the SAME raw ΔE00 far easier to see (David, live-build feedback on a 4x9 Full-screen board:
// "these are way too obvious") -- the drawn gap has to shrink as the board's columns shrink (tiles grow), the
// mirror of ooSizeF's compensation for the OTHER games' smaller tiles (which goes the other way: more columns,
// smaller tiles, BIGGER raw ΔE needed). Tuned against tools/oo_simple_sim.js's "no round solvable at a glance"
// check on 3-4 column boards. Applied last (after richness/ease), so it only ever shrinks the final drawn gap --
// the ease ceiling above is still computed in untouched, size-independent model space.
const ooSimpleSizeBias = cols => cols <= 3 ? .55 : cols === 4 ? .62 : cols === 5 ? .7 : cols === 6 ? .8 : cols === 7 ? .88 : cols <= 9 ? .95 : cols <= 11 ? 1 : 1.05;
// which Lab axis the board's own gradient stops vary along most (light, chroma or hue) -- used to pull the odd
// tile's own deviation toward the SAME direction the board already establishes (David, live-build feedback:
// "make the odd tile follow the gradient's direction... not a separate hue jump that reads as a different
// color"). A hue-only move crosses a categorical color boundary even at an "equal" ΔE00 -- it reads as a
// different patch entirely, where a light/chroma move of the same ΔE00 reads as shading along a ramp the eye
// already expects. hue's own degrees aren't comparable to L/C units, so they're scaled by the stops' own
// chroma (a hue swing means little near the grey center and a lot out at a vivid chroma).
function ooFieldAxis(stopHexes) {
  if (!stopHexes || stopHexes.length < 2) return null;
  const [L1, C1, H1] = lch(stopHexes[0]), [L2, C2, H2] = lch(stopHexes[1]);
  let dH = Math.abs(H1 - H2); if (dH > 180) dH = 360 - dH;
  const dL = Math.abs(L1 - L2), dC = Math.abs(C1 - C2), hW = dH * (Math.min(C1, C2) / 100);
  if (dL >= dC && dL >= hW) return "light";
  if (dC >= dL && dC >= hW) return "chroma";
  return "hue";
}
function ooSimpleRound(state, breather, rnd = Math.random) {
  const richMode = state.richMode === "rich" ? "rich" : "subtle";
  const primary = ooSimpleAxis(state.model, rnd), d = ooSimpleD(state.model, primary, breather, state.stairMult, rnd);
  const skill = ooSimpleSkill(state.cols);
  // Classic (David, 2026-10-11, "best of both worlds": his girlfriend preferred the original -- "a 9x9 square
  // board, one solid color, single tile"): same adaptive engine, safe zone and easiness ceiling as Gradient,
  // just forced to a literal single base color on a square board, no palette/gradient.
  const classic = state.style === "classic";
  // Board shape (David, 2026-10-11) is its own axis from Style/palette now, not implied by Classic: Full screen
  // (default, edge to edge) or Square (centered, margined, like the original -- 9x9 is its own default size,
  // oo-ui.js). Classic+Square is "the original" David's girlfriend liked; Gradient+Square or Classic+Full work
  // just as well, since nothing below depends on which palette produced the colors.
  const square = classic || state.board === "square";
  const richness = classic ? "flat" : ooSimpleGridType(skill, state.round || 0, rnd, richMode);
  const gridLo = state.gridLo || OO_S_MIN_COLS, gridHi = state.gridHi || OO_S_MAX_COLS;
  const roundCols = clamp(state.cols, gridLo, gridHi);
  const dims = square ? { rows: roundCols, cols: roundCols } : ooSimpleDims(roundCols, state.aspect || 1.6);
  const { rows, cols } = dims;
  const bf = OO_S_GRAD_F[richness] || 1, stopHexes = classic ? null : (state.palette && state.palette.colors);
  const sizeBias = ooSimpleSizeBias(cols);
  // the odd tile's own move direction. mix itself (what's tested, credited and sized against d) is UNCHANGED --
  // only a separate renderMix, fed to ooMixDir below, is pulled toward the board's own established gradient
  // direction (ooFieldAxis above) when the round leans on a pure or near-pure hue move and the board's own ramp
  // isn't a hue ramp, so the odd tile reads as "this patch, shaded a touch differently" instead of "a different
  // color snuck in". Keeping mix itself untouched matters: oo-ui.js's onAnswer picks the credited axis (dom) as
  // the highest-weight key in r.mix, and sizes the credit against the ORIGINAL primary axis's own d/threshold --
  // an earlier version that rewrote mix itself could flip dom away from primary, crediting a hue-sized gap to
  // light or chroma's calibration as if it had been drawn at THEIR (different) threshold, visibly corrupting
  // every eye in tools/oo_simple_sim.js (a typical eye crept to 90%+, a struggling eye collapsed toward 50%).
  const mix = ooSimpleMix(primary, rnd);
  const fieldAxis = ooFieldAxis(stopHexes);
  let renderMix = mix;
  if (fieldAxis && fieldAxis !== "hue" && (mix.hue || 0) > .4 && mix.hue < 1) {
    const hueW = mix.hue;
    renderMix = { ...mix, hue: hueW * .4, [fieldAxis]: (mix[fieldAxis] || 0) + hueW * .6 };
  }
  // multiple odd tiles are opt-in only now (David, 2026-10-11: "selecting one is better than multiple") --
  // state.multiOdd must be explicitly true (a Settings toggle, oo-ui.js) or every round is single-odd.
  const shape = state.multiOdd ? ooSimpleShape(rows * cols, rnd) : "one";
  const k = shape === "k4" ? Math.min(4, rows * cols - 1) : shape === "k2" ? 2 : 1;
  // the ceiling: an absolute, flat safety cap only now (OO_S_EASE_MAX, model space) -- richness (bf) can still
  // inflate a round, but never past this, and never with any LOWER bound any more (David, 2026-10-11: see
  // OO_S_EASE_MAX's own comment above -- the old max(d, floor*pad, ...) lower-bound terms were exactly what
  // neutralized the in-run staircase, since the gap could never fall under the player's own current theta).
  // sizeBias is applied last, after the ceiling, to get the actual ON-SCREEN gap; the ONE floor left (David:
  // "its only floor is the new OO_S_FLOOR x sizeBias") is applied last of all, on that final on-screen value.
  const target = Math.min(d * bf, OO_S_EASE_MAX);
  const floor = OO_S_FLOOR[primary] * sizeBias;
  const dEff = Math.max(target * sizeBias, floor);
  let r = ooSimpleGradRound(rows, cols, richness, stopHexes, skill, renderMix, dEff, k, rnd, state.safeBox, richMode);
  if (!r) r = ooSimpleGradRound(rows, cols, "flat", stopHexes, skill, { [primary]: 1 }, Math.max(Math.min(d, OO_S_EASE_MAX) * sizeBias, floor), k, rnd, state.safeBox, richMode);   // should be rare; a plain fallback
  // belt and braces: an extreme d or an unusual stop near the edge of the screen's gamut could in principle
  // exhaust both attempts above. A round is never allowed to fail outright, so this last resort uses a base and
  // a gap that are always drawable, same emergency pattern ooRound itself falls back to.
  if (!r) r = ooSimpleGradRound(rows, cols, "flat", null, skill, { [primary]: 1 }, Math.max(Math.min(d, 6) * sizeBias, floor), k, rnd, state.safeBox, richMode);
  // Classic truly has no palette (David, 2026-10-11: "no palettes") -- its base color comes from ooBase's own
  // family picker, not state.palette, so the reveal must never attribute it to a painting/look it didn't draw
  // from (state.palette may still be a real, unrelated pool entry computed upstream for the gradient path).
  return Object.assign(r, { breather, axis: primary, judg: primary, mix, bf: r.gridType && r.gridType !== "flat" ? bf : 1, sizeBias, paletteSource: classic ? null : (state.palette || null), full: !square, ease: OO_S_EASE_MAX * sizeBias });
}
// grid growth: a rolling window of the last OO_S_WINDOW results at the current size: grow on a hot streak, shrink
// on a cold one, hold otherwise. The floor stops the gap from shrinking further, so this is the difficulty knob
// once an axis is already sharp.
function ooSimpleGrid(cols, acc, lo = OO_S_MIN_COLS, hi = OO_S_MAX_COLS) {
  cols = clamp(cols, lo, hi);
  if (acc.length < OO_S_WINDOW) return cols;
  const rate = acc.reduce((a, b) => a + b, 0) / acc.length;
  if (rate >= OO_S_GROW_AT) return Math.min(hi, cols + 1);
  if (rate <= OO_S_SHRINK_AT) return Math.max(lo, cols - 1);
  return cols;
}

if (typeof module !== "undefined") module.exports = {
  ooHash, ooRnd, ooShuf, OO_JUDG, OO_AXES, OO_START, OO_MIN, OO_MAX, OO_SLOPE, ooP, OO_TIER, OO_BREATH, OO_VF, OO_BF, ooModel, ooTheta, ooTheta0, ooUpdate, ooEye,
  ooStair, ooStairStep, ooStairScore, ooFam, OO_FAMS, ooBase, ooMove, ooMoveDir, ooDirWord, ooHuePair, ooDirChoices, OO_DIR_WORDS, ooCells, OO_SHAPES, ooRound, ooBand, ooPaintShift,
  OO_WORLDS, OO_LEVELS, OO_LEVEL_N, OO_GAPS, ooLevelGap, ooLevelOfGap, ooGapWord, OO_PRESET_LV, ooLevelForTh, OO_LEVEL_ROUNDS, OO_LEVEL_PASS,
  OO_LAYOUTS, ooLayout, ooLayoutsFor, ooLayoutNext, ooLayoutF, OO_KINDS, OO_ROUNDS, OO_MIX_AT, OO_MIX, OO_PASS, OO_FAST_MS, ooTierAt, ooKindKey, OO_DAILY_D, ooDaily, ooDayNum, ooShareText,
  OO_DIFFS, OO_DIFF_IDS, OO_DIFF_TIER, ooDiffName, ooPrefNorm, ooPickLevel, ooPickTier, ooTestTier, ooDoneAt, ooFrontier, ooTestOutMark, OO_TEST_ROUNDS,
  OO_GRID_MIN, OO_GRID_MAX, OO_ODD_MAX, OO_SESSION_N, OO_SESSION_MORE, OO_UP, OO_DOWN, ooGapAt, ooXOfGap, ooSess, ooSessStep, ooSessEdge, ooSessStart, ooClassic, ooSessD, ooGapDE, OO_KC, OO_KH,
  OO_EDGE, ooEdgeTh, ooEdgeD, ooEdgeUpdate, ooPairRatioOf, ooWhoseAlts,
  ooPairsRound, ooPairClear, OO_PAIR_RATIO, ooLineRound, ooNameMargin, OO_LINE_MARGIN, OO_LINE_P0, OO_LINE_MIN, ooGradStrip, ooOrderRound, ooChangedRound, ooWasRound, ooNbackSeq, ooCountPick,
  OO_S_FLOOR, OO_S_MULT, OO_S_BREATHE_MULT, OO_S_MIN_COLS, OO_S_MAX_COLS, OO_S_WINDOW, OO_S_GROW_AT, OO_S_SHRINK_AT,
  OO_STAIR_DOWN, OO_STAIR_UP, OO_STAIR_MIN, OO_STAIR_MAX,
  ooLerp, ooSimpleDims, ooSimpleCells, ooOklab, ooOklabRgb, ooOklabInGamut, ooOklabHex, ooOklabMixRaw, ooOklabPathRaw, ooOklabToHexSafe,
  OO_S_RICH, OO_S_GRAD_F, ooSimpleSkill, ooSimpleGridType, ooSimpleGradColors, ooSimpleMix, ooMixDir, ooSimpleGradRound,
  OO_S_EASE_MAX,
  ooCellSafe, ooSafeIdx, ooMaxNeighborStep, OO_S_NEIGHBOR_CAP,
  ooSimpleAxis, ooSimpleD, ooSimpleShape, ooSimpleRound, ooSimpleGrid, ooSimpleSizeBias, ooFieldAxis,
};
