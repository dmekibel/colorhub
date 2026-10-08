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
const OO_START = { hue: 6, light: 6, chroma: 7, context: 8, memory: 9 };
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
const ooSizeF = cols => cols <= 4 ? 1 : cols === 5 ? 1.1 : cols === 6 ? 1.2 : 1.28;

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
// The reader other screens use (eyeThreshold in js/games/oo-ui.js): { th (ΔE00), n (answers behind it), sure }
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
  // the step shrinks as evidence builds (fast at first, steady later), never to zero, so the estimate can follow you
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

// ---------- moving a color by exactly d (as drawn, in hex) ----------
// axis "light" | "chroma" | "hue" in LCh, sign ±1. Returns { hex, act } with act = ΔE00 between the two hex codes,
// or null if the move leaves the screen gamut. The amount is found by bisection on the drawn colors.
function ooMove(baseHex, axis, sign, d) {
  const [L, C, H] = lch(baseHex), kMax = axis === "hue" ? 150 : 70;
  const at = k => {
    const L2 = axis === "light" ? L + sign * k : L, C2 = axis === "chroma" ? C + sign * k : C, H2 = axis === "hue" ? H + sign * k : H;
    if (L2 < 2 || L2 > 98 || C2 < 0 || !ooOk(L2, C2, H2)) return null;
    const hex = lchHex(L2, C2, (H2 + 360) % 360);
    return { hex, act: de2000(baseHex, hex) };
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
function ooMoveDir(baseHex, v, d) {
  const B = lab(baseHex), n = Math.hypot(...v) || 1, u = v.map(x => x / n);
  const at = k => { const P = B.map((x, i) => x + u[i] * k); if (P[0] < 2 || P[0] > 98 || !inGamut(...P)) return null; const hex = labHex(...P); return { hex, act: de2000(baseHex, hex) }; };
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
          const r = ooMoveDir(base, ooRandDir(rnd), d * ooBtw(1, 1.45, rnd));
          if (r && all.every(h => de2000(h, r.hex) >= d * .92)) got = r.hex;
        }
        if (!got) { ok = false; break; }
        others.push(got); all.push(got);
      }
      if (!ok) continue;
      let k = 0;
      for (let i = 0; i < N; i++) colors[i] = tw.includes(i) ? base : others[k++];
      const act = Math.min(...others.map(h => de2000(base, h)), ...others.flatMap((h, i) => others.slice(i + 1).map(x => de2000(h, x))));
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
    } else ans = [Math.floor(rnd() * N)];
    ans.forEach(i => { colors[i] = m.hex; });
    Object.assign(out, { colors, ans, act: m.act, odd: m.hex, dir: ooDirWord(base, m.hex), g: v === "pair" ? 2 / (N * (N - 1)) : v === "group" ? ans.length / N : v === "which" ? 1 / (6 * N) : 1 / N });
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

// ---------- the ladder: 24 levels in four worlds, then the Mix set (after level 10) ----------
// v: variant · b: board · n: size · tw: twist · news: what's new (shown on the map and the first round)
const OO_WORLDS = [
  { name: "First look", mile: "You can find one tile in a crowd, in any arrangement." },
  { name: "In context", mile: "You can see past the ground, the size and the strip around a color." },
  { name: "Under pressure", mile: "You can hold a color for a second and spot it inside a painting." },
  { name: "Mastery", mile: "Every judgment at once, near your own limit." },
];
const OO_LEVELS = [
  { w: 0, v: "one", b: "grid", n: 3, name: "Odd one", news: "Find the tile that's different" },
  { w: 0, v: "one", b: "grid", n: 4, name: "Bigger board", news: "Sixteen tiles: sweep row by row" },
  { w: 0, v: "pair", b: "grid", n: 4, name: "Odd pair", news: "Two tiles are different: find both" },
  { w: 0, v: "one", b: "ring", n: 10, name: "Ring", news: "Tiles in a ring" },
  { w: 0, v: "count", b: "grid", n: 4, name: "How many?", news: "Count the different tiles. Zero is sometimes right" },
  { w: 0, v: "one", b: "honey", n: 19, tw: "combo", name: "Honeycomb", news: "A honeycomb, and a combo for quick answers" },
  { w: 1, v: "one", b: "strip", n: 8, name: "Paint strip", news: "One chip in the strip is off" },
  { w: 1, v: "twins", b: "grid", n: 3, name: "Twins", news: "Every tile differs except two: find the twins" },
  { w: 1, v: "one", b: "sizes", n: 4, name: "Mixed sizes", news: "Big and small tiles (size changes how a color looks)" },
  { w: 1, v: "one", b: "busy", n: 4, tw: "illusion", name: "Busy ground", news: "Colored grounds. Sometimes none is different" },
  { w: 1, v: "which", b: "grid", n: 3, name: "Which way?", news: "Find it, then say how it differs" },
  { w: 1, v: "group", b: "grid", n: 6, name: "Hidden shape", news: "A few tiles form a hidden shape" },
  { w: 2, v: "one", b: "grid", n: 4, tw: "flash", name: "Flash", news: "The board shows for one second: tap where it was" },
  { w: 2, v: "one", b: "grid", n: 3, tw: "grow", name: "Growing board", news: "Every right answer adds tiles, until a miss" },
  { w: 2, v: "one", b: "gradient", n: 4, name: "Gradient", news: "The tiles drift smoothly; one breaks the pattern" },
  { w: 2, v: "one", b: "grid", n: 4, tw: "chain", name: "Chain", news: "The odd tile becomes the next board's color" },
  { w: 2, v: "one", b: "honey", n: 19, tw: "breathe", name: "Breathing", news: "Every tile breathes, each at its own pace" },
  { w: 2, v: "one", b: "painting", n: 4, name: "Painting", news: "A painting cut into tiles; one patch is recolored" },
  { w: 3, v: "count", b: "mosaic", n: 16, name: "Mosaic count", news: "How many, on a scattered mosaic" },
  { w: 3, v: "twins", b: "ring", n: 10, name: "Twin ring", news: "Twins in a ring" },
  { w: 3, v: "which", b: "busy", n: 4, tw: "illusion", name: "Which way, in context", news: "Which way, on colored grounds" },
  { w: 3, v: "one", b: "grid", n: 3, tw: "survival", name: "Survival", news: "Three lives. The board grows and the difference shrinks" },
  { w: 3, v: "which", b: "painting", n: 4, name: "Painter's eye", news: "Which way, inside a painting" },
  { w: 3, v: "mixed", b: "grid", n: 4, name: "Grand boss", news: "A bit of everything, near your limit" },
];
// the grand boss and the daily board draw their rounds from these (variant, board, size, twist)
const OO_KINDS = [
  ["one", "grid", 4], ["pair", "grid", 4], ["one", "ring", 10], ["count", "grid", 4], ["one", "honey", 19], ["one", "strip", 8],
  ["twins", "grid", 3], ["one", "sizes", 4], ["one", "busy", 4], ["which", "grid", 3], ["group", "grid", 6], ["one", "grid", 4, "flash"],
  ["one", "gradient", 4], ["count", "mosaic", 16], ["twins", "ring", 10],
];
const OO_ROUNDS = 6;
const OO_MIX_AT = 10;    // the Mix set unlocks once level 10 is cleared
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
    const m = ooMoveDir(set[near], ooRandDir(rnd), d);
    if (m && set.every(h => de2000(h, m.hex) >= d * .85)) { const opts = ooShuf([...set, m.hex], rnd); return { set, opts, fresh: opts.indexOf(m.hex), act: m.act, near, d }; }
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
// opts: { p (ΔE past the line), k (tiles: 4 or 6), cats: [{ n, h }] (category words, e.g. the ones you've met),
//         namer(hex) -> { n, de, near: [{ n, h }] } (nameOf in the app; a nearest-name list in tests) }
// Returns { cat, catHex, nb, nbHex, colors, at, trap, B, p, act, spread, tries } or null.
const OO_NEAR_DE = 8;
function ooLineRound(rnd, o) {
  const k = o.k || 4, p = o.p || 6, namer = o.namer, cats = o.cats || [];
  let tries = 0;
  const st = o.stats || {};
  ["narrow", "noflip", "gate", "spread"].forEach(x => { st[x] = st[x] || 0; });
  for (let c = 0; c < 12; c++) {
    const N = ooPick(cats, rnd);
    if (!N) return null;
    const nN = namer(N.h);
    if (nN.n !== N.n) continue;
    // the region must be wide enough: jittered samples within ΔE 6 keep the name
    const wide = [0, 1, 2, 3, 4].map(() => ooMoveDir(N.h, ooRandDir(rnd), ooBtw(2, 4, rnd))).filter(m => m && namer(m.hex).n === N.n && namer(m.hex).de < OO_NEAR_DE).length;
    if (wide < 3) { st.narrow++; continue; }
    const M = (nN.near || []).find(x => x.n !== N.n);
    if (!M) continue;
    for (let t = 0; t < 30; t++) {
      tries++;
      // march from N toward M (a little off the straight line, so rounds vary) until the name flips
      const A = lab(N.h), Bm = lab(M.h), jit = ooRandDir(rnd).map(x => x * 3), dir = Bm.map((x, i) => x - A[i] + jit[i]);
      const len = Math.hypot(...dir), u = dir.map(x => x / len);
      let lo = 0, hi = null;
      for (let s2 = .4; s2 <= len * 1.6; s2 += .4) { const P = A.map((x, i) => x + u[i] * s2); if (!inGamut(...P)) break; if (namer(labHex(...P)).n !== N.n) { hi = s2; break; } lo = s2; }
      if (hi == null) { st.noflip++; continue; }
      for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2, P = A.map((x, j) => x + u[j] * mid); if (namer(labHex(...P)).n !== N.n) hi = mid; else lo = mid; }
      const Bhex = labHex(...A.map((x, i) => x + u[i] * hi));
      const odd = ooMoveDir(Bhex, u, p * .5), trap = odd && ooMoveDir(odd.hex, u.map(x => -x), p);
      if (!odd || !trap) continue;
      // the odd tile's name is whichever neighbor the line leads into (revealed only after the tap)
      const nb = namer(odd.hex);
      if (nb.n === N.n || namer(trap.hex).n !== N.n || nb.de >= OO_NEAR_DE) { st.gate++; continue; }
      const act = de2000(odd.hex, trap.hex);
      if (act < .3) continue;
      // the other in-name tiles: spread inside the region so at least one pair is further apart than odd vs trap
      const ins = [trap.hex];
      for (let g = 0; g < 80 && ins.length < k - 1; g++) {
        const m = ooMoveDir(N.h, ooRandDir(rnd), ooBtw(.25, 1.1, rnd) * hi);
        if (m && namer(m.hex).n === N.n && ins.every(h => de2000(h, m.hex) >= Math.max(.8, p * .4)) && de2000(m.hex, odd.hex) > act * .9) ins.push(m.hex);
      }
      if (ins.length < k - 1) { st.spread++; continue; }
      const spread = Math.max(...ins.flatMap((a, i) => ins.slice(i + 1).map(b => de2000(a, b))));
      // prefer boards where "the most different tile" is a trap: retry a few times before settling
      if (spread <= act && t < 20) { st.spread++; continue; }
      const colors = ooShuf([...ins, odd.hex], rnd);
      return { cat: N.n, catHex: N.h, nb: nb.n, nbHex: (nb.near && nb.near[0] && nb.near[0].h) || M.h, colors, at: colors.indexOf(odd.hex), trap: colors.indexOf(trap.hex), odd: odd.hex, B: Bhex, p, act, spread, trapOk: spread > act, tries };
    }
  }
  return null;
}
// the line's own staircase: the push past the boundary, 8 at the start down to 1.5
const OO_LINE_P0 = 5, OO_LINE_MIN = 1;

if (typeof module !== "undefined") module.exports = {
  ooHash, ooRnd, ooShuf, OO_JUDG, OO_AXES, OO_START, OO_MIN, OO_MAX, OO_SLOPE, ooP, OO_TIER, OO_BREATH, OO_VF, OO_BF, ooModel, ooTheta, ooTheta0, ooUpdate, ooEye,
  ooStair, ooStairStep, ooStairScore, ooFam, OO_FAMS, ooBase, ooMove, ooMoveDir, ooDirWord, ooHuePair, ooDirChoices, OO_DIR_WORDS, ooCells, OO_SHAPES, ooRound, ooBand, ooPaintShift,
  OO_WORLDS, OO_LEVELS, OO_KINDS, OO_ROUNDS, OO_MIX_AT, OO_MIX, OO_PASS, OO_FAST_MS, ooTierAt, ooKindKey, OO_DAILY_D, ooDaily, ooDayNum, ooShareText,
  ooLineRound, OO_LINE_P0, OO_LINE_MIN, ooGradStrip, ooOrderRound, ooChangedRound, ooWasRound, ooNbackSeq, ooCountPick,
};
