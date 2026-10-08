"use strict";
// Gradients: the rearrange puzzle (ROADMAP §3, §4, §20; design/COMPETITORS.md, the I Love Hue entry). The pure
// engine: board shapes, perceptually even gradients, the level ladder, adaptive difficulty and the daily seed.
// No DOM and no storage, so tools/hue_test.js can load it in node. The UI is js/games/hue-ui.js.
//
// A board is a set of slots (cells) in a shape: rectangle, diamond, honeycomb, ring, arch, spiral, heart, leaf,
// a grid with holes, two interleaved gradients, a mirror. Every slot has a home color drawn from a smooth field
// between four corner colors taken from a real source (a painting's palette, a flower, a gem, a decade, your own
// colors). The field is interpolated in OKLab, then each axis is re-spaced so equal steps are equal in CIEDE2000
// (an arc-length warp), and the board is checked: every line's steps even (max/min within HG_EVEN), every
// neighbor step at least HG_MIN_STEP, and every two slots at least HG_MIN_PAIR apart, so it can always be solved
// by eye. The typical step is fitted to a target drawn from the player's own eye threshold.
// Uses de2000 / lab from js/core.js as globals (the test evaluates that same section of core.js first).

// ---------- seeded randomness (own copy, so the engine stands alone) ----------
const hgHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hgRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------- OKLab (Björn Ottosson's matrices) ----------
const hgLin = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
const hgGam = v => v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v;
function hgOk(hex) {
  const n = parseInt(String(hex).slice(1), 16), r = hgLin(n >> 16 & 255), g = hgLin(n >> 8 & 255), b = hgLin(n & 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
// OKLab -> linear sRGB (unclamped)
function hgLinRgb([L, a, b]) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
const hgInG = ok => hgLinRgb(ok).every(v => v >= -1e-4 && v <= 1.0001);
// OKLab -> hex, pulled into the screen gamut by lowering chroma at the same lightness and hue
function hgHex(ok) {
  let [L, a, b] = ok; L = Math.max(0, Math.min(1, L));
  if (!hgInG([L, a, b])) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const k = (lo + hi) / 2; if (hgInG([L, a * k, b * k])) lo = k; else hi = k; }
    a *= lo; b *= lo;
  }
  return "#" + hgLinRgb([L, a, b]).map(v => Math.round(Math.max(0, Math.min(1, hgGam(Math.max(0, Math.min(1, v))))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const hgLch = ([L, a, b]) => [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360];
const hgFromLch = (L, C, h) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
// the most chroma a lightness and hue can have on screen
function hgMaxC(L, h) { let lo = 0, hi = .4; for (let i = 0; i < 16; i++) { const c = (lo + hi) / 2; if (hgInG(hgFromLch(L, c, h))) lo = c; else hi = c; } return lo; }
const hgMix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
const hgDe = (x, y) => de2000(x, y);   // on CIELAB arrays (lab(hex)) or hexes

// ---------- the checks every board passes ----------
const HG_MIN_STEP = 1.2;   // ΔE00: the smallest step between neighbors on any line
const HG_MIN_PAIR = 1;     // ΔE00: the smallest difference between any two slots (twins excepted)
const HG_EVEN = 2;         // the largest step on a line is at most this many times its smallest
const HG_STEP_MAX = 14;    // a target never asks for steps bigger than this

// ======================================================================
// Shapes. hgGeo(shape, n, o) -> { cells, lines, aspect, field, twins? }
//   cell: { x, y, w, h (0..1 of the board box), k: "sq" | "dia" | "hex" | "dot" | "poly", pts? (a clip-path
//          polygon in % of the cell box), u, v (0..1, where the color sits in the field), f (field index), nb }
//   lines: ordered runs of cell indexes (the rows and columns the evenness check walks), cyc: loop lines
//   field: "bi" (bilinear between four corners) | "loop" (around the four corners, rings shade lighter inward)
//          | "path" (through the four corners in order) ; twins: mirror pairs
// ======================================================================
const HG_SHAPES = ["rect", "diamond", "hex", "ring", "arch", "spiral", "heart", "leaf", "holes", "weave", "mirror"];
const HG_SHAPE_NAME = { rect: "Grid", diamond: "Diamond", hex: "Honeycomb", ring: "Ring", arch: "Arch", spiral: "Spiral", heart: "Heart", leaf: "Leaf", holes: "Window", weave: "Two gradients", mirror: "Mirror" };
// grid-based shapes: keep(i, j) decides which cells of an n×m grid exist
function hgGrid(n, m, keep, uv) {
  const cells = [], at = new Map();
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    if (keep && !keep(i, j)) continue;
    at.set(i + "," + j, cells.length);
    cells.push({ i, j, x: i / n, y: j / m, w: 1 / n, h: 1 / m, k: "sq", u: n > 1 ? i / (n - 1) : .5, v: m > 1 ? j / (m - 1) : .5, f: 0 });
  }
  if (uv) cells.forEach(uv);
  const runs = (outer, inner, key) => { const out = []; for (let a = 0; a < outer; a++) { let run = []; for (let b = 0; b < inner; b++) { const k = at.get(key(a, b)); if (k == null) { if (run.length > 1) out.push(run); run = []; } else run.push(k); } if (run.length > 1) out.push(run); } return out; };
  const lines = [...runs(m, n, (j, i) => i + "," + j), ...runs(n, m, (i, j) => i + "," + j)];
  cells.forEach(c => { c.nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => at.get((c.i + di) + "," + (c.j + dj))).filter(x => x != null); });
  return { cells, lines, at };
}
// stretch u,v of the kept cells so the field spans the shape (a heart or leaf only uses part of the grid)
function hgSpan(cells) {
  const us = cells.map(c => c.u), vs = cells.map(c => c.v), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  cells.forEach(c => { c.u = u1 > u0 ? (c.u - u0) / (u1 - u0) : .5; c.v = v1 > v0 ? (c.v - v0) / (v1 - v0) : .5; });
}
const hgPolyPts = (pts, box) => pts.map(([x, y]) => `${((x - box.x) / box.w * 100).toFixed(2)}% ${((y - box.y) / box.h * 100).toFixed(2)}%`).join(",");
// an annular sector as a polygon (board units), and its box
function hgSector(cx, cy, r0, r1, a0, a1, sx = 1, sy = 1) {
  const pts = [], K = 6;
  for (let t = 0; t <= K; t++) { const a = a0 + (a1 - a0) * t / K; pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
  for (let t = K; t >= 0; t--) { const a = a0 + (a1 - a0) * t / K; pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]); }
  const P = pts.map(([x, y]) => [x * sx, y * sy]), xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys) }; box.w = Math.max(...xs) - box.x; box.h = Math.max(...ys) - box.y;
  return { ...box, pts: hgPolyPts(P, box), cx: (cx + (r0 + r1) / 2 * Math.cos((a0 + a1) / 2)) * sx, cy: (cy + (r0 + r1) / 2 * Math.sin((a0 + a1) / 2)) * sy };
}
function hgGeo(shape, n, o = {}) {
  n = Math.max(2, Math.round(n));
  if (shape === "rect" || shape === "holes" || shape === "weave" || shape === "mirror") {
    const m = shape === "rect" && o.m ? o.m : n;
    let keep = null, uv = null;
    if (shape === "holes") {
      // a window: a block out of the middle, and four panes for the bigger boards
      const c = (n - 1) / 2, half = n >= 9 ? 1 : n % 2 ? 0 : .5, r = n >= 8 ? 2 : 1;
      const hole = (i, j) => (Math.abs(i - c) <= half + 1e-9 && Math.abs(j - c) <= half + 1e-9) || (n >= 7 && [r, n - 1 - r].includes(i) && [r, n - 1 - r].includes(j) && Math.abs(i - c) > half + 1);
      keep = (i, j) => !hole(i, j);
    }
    if (shape === "weave") uv = c => { c.f = c.j % 2; const rows = Math.ceil(m / 2) - (c.f && m % 2 ? 1 : 0); c.v = rows > 1 ? Math.floor(c.j / 2) / (rows - 1) : .5; };
    if (shape === "mirror") { if (n % 2) n++; const half = n / 2; uv = c => { c.u = c.i < half ? c.i / (half - 1) : (n - 1 - c.i) / (half - 1); }; }
    const g = hgGrid(n, shape === "mirror" ? n : m, keep, uv);
    let lines = g.lines;
    if (shape === "weave") {
      // rows are single gradients; columns step two rows at a time (same gradient)
      lines = lines.filter(l => g.cells[l[0]].j === g.cells[l[1]].j);
      for (let i = 0; i < n; i++) for (const f of [0, 1]) { const col = g.cells.map((c, k) => [c, k]).filter(([c]) => c.i === i && c.f === f).map(([, k]) => k); if (col.length > 1) lines.push(col); }
    }
    let twins = null;
    if (shape === "mirror") {
      const half = n / 2;
      lines = lines.map(l => g.cells[l[0]].j === g.cells[l[l.length - 1]].j ? l.filter(k => g.cells[k].i < half) : l).filter(l => l.length > 1);
      twins = g.cells.map(c => g.at.get((n - 1 - c.i) + "," + c.j));
    }
    return { shape, n, cells: g.cells, lines, aspect: n / (shape === "mirror" ? n : m), field: "bi", twins };
  }
  if (shape === "diamond") {
    // a square grid turned 45°: diamond tiles in a diamond
    const g = hgGrid(n, n);
    g.cells.forEach(c => { const px = (c.i + .5) / n - .5, py = (c.j + .5) / n - .5; c.x = .5 + (px - py) / 2 - .5 / n; c.y = .5 + (px + py) / 2 - .5 / n; c.k = "dia"; });
    return { shape, n, cells: g.cells, lines: g.lines, aspect: 1, field: "bi" };
  }
  if (shape === "heart" || shape === "leaf") {
    const inside = shape === "heart"
      ? (X, Y) => { const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; }
      : (X, Y) => { const p = (X - Y) / Math.SQRT2, q = (X + Y) / Math.SQRT2; return Math.hypot(p, q - .62) <= 1.05 && Math.hypot(p, q + .62) <= 1.05; };
    const keep = shape === "heart" ? (i, j) => inside((i + .5) / n * 2.5 - 1.25, 1.2 - (j + .5) / n * 2.45) : (i, j) => inside((i + .5) / n * 2 - 1, 1 - (j + .5) / n * 2);
    const g = hgGrid(n, n, keep);
    hgSpan(g.cells);
    return { shape, n, cells: g.cells, lines: g.lines, aspect: 1, field: "bi" };
  }
  if (shape === "hex") {
    // pointy-top hexagons in a hexagon of radius R
    const R = n, cells = [], at = new Map();
    for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) { if (Math.abs(q + r) > R) continue; at.set(q + "," + r, cells.length); cells.push({ q, r, X: Math.sqrt(3) * (q + r / 2), Y: 1.5 * r, k: "hex", f: 0 }); }
    const xs = cells.map(c => c.X), ys = cells.map(c => c.Y), x0 = Math.min(...xs) - Math.sqrt(3) / 2, x1 = Math.max(...xs) + Math.sqrt(3) / 2, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
    const W = x1 - x0, H = y1 - y0;
    cells.forEach(c => { c.x = (c.X - Math.sqrt(3) / 2 - x0) / W; c.y = (c.Y - 1 - y0) / H; c.w = Math.sqrt(3) / W; c.h = 2 / H; c.u = (c.X - (x0 + Math.sqrt(3) / 2)) / (W - Math.sqrt(3)); c.v = (c.Y - (y0 + 1)) / (H - 2); });
    const lines = [];
    for (let r = -R; r <= R; r++) { const l = []; for (let q = -R; q <= R; q++) { const k = at.get(q + "," + r); if (k != null) l.push(k); } if (l.length > 1) lines.push(l); }
    for (let q = -R; q <= R; q++) { const l = []; for (let r = -R; r <= R; r++) { const k = at.get(q + "," + r); if (k != null) l.push(k); } if (l.length > 1) lines.push(l); }
    cells.forEach(c => { c.nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([a, b]) => at.get((c.q + a) + "," + (c.r + b))).filter(x => x != null); });
    return { shape, n: R, cells, lines, aspect: W / H, field: "bi" };
  }
  if (shape === "ring" || shape === "arch") {
    const ring = shape === "ring", M = n, K = clampHg(o.K || (ring ? 2 : 3), 1, 5), cells = [], lines = [];
    const r0 = ring ? .2 : .2, r1 = .5, t = (r1 - r0) / K;
    // the arch is the top half of a ring in a 2:1 box
    const sy = ring ? 1 : 2, cy = ring ? .5 : .5;
    for (let k = 0; k < K; k++) for (let m = 0; m < M; m++) {
      const a0 = ring ? (m / M) * 2 * Math.PI - Math.PI / 2 - Math.PI / M : Math.PI + (m / M) * Math.PI, a1 = ring ? a0 + 2 * Math.PI / M : a0 + Math.PI / M;
      const s = hgSector(.5, cy, r0 + k * t, r0 + (k + 1) * t, a0, a1, 1, sy);
      cells.push({ m, kk: k, x: s.x, y: s.y, w: s.w, h: s.h, k: "poly", pts: s.pts, u: ring ? m / M : M > 1 ? m / (M - 1) : .5, v: K > 1 ? (ring ? k / (K - 1) : 1 - k / (K - 1)) : .5, f: 0, cx: s.cx, cy: s.cy });
    }
    const idx = (m, k) => k * M + m;
    for (let k = 0; k < K; k++) lines.push(Array.from({ length: M }, (_, m) => idx(m, k)));
    if (K > 1) for (let m = 0; m < M; m++) lines.push(Array.from({ length: K }, (_, k) => idx(m, k)));
    cells.forEach(c => { c.nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dm, dk]) => { let m = c.m + dm; const k = c.kk + dk; if (ring) m = (m + M) % M; return m >= 0 && m < M && k >= 0 && k < K ? idx(m, k) : null; }).filter(x => x != null && x !== idx(c.m, c.kk)); });
    if (!ring) { const y1 = Math.max(...cells.map(c => c.y + c.h)); cells.forEach(c => { c.y /= y1; c.h /= y1; }); return { shape, n: M, K, cells, lines, aspect: 2 / y1, field: "bi" }; }
    return { shape, n: M, K, cells, lines, cyc: K, aspect: 1, field: "loop" };
  }
  if (shape === "spiral") {
    // an Archimedean spiral of dots at equal spacing along the curve, growing outward
    const N = n, th0 = 1.1 * Math.PI, th1 = th0 + 4.6 * Math.PI, ra = .07, rb = .425, b = (rb - ra) / (th1 - th0), S = 900, arc = [0], pts = [];
    for (let s = 0; s <= S; s++) { const th = th0 + (th1 - th0) * s / S, r = ra + b * (th - th0); pts.push([.5 + r * Math.cos(th), .5 + r * Math.sin(th), r]); if (s) arc.push(arc[s - 1] + Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1])); }
    const tot = arc[S], gap = tot / (N - 1), turn = 2 * Math.PI * b, cells = [];
    let s = 0;
    for (let i = 0; i < N; i++) {
      const want = i * gap; while (s < S && arc[s + 1] < want) s++;
      const [x, y, r] = pts[Math.min(s, S)], d = Math.min(gap * .92, turn * .9) * (.72 + .28 * r / rb);
      cells.push({ x: x - d / 2, y: y - d / 2, w: d, h: d, k: "dot", u: i / (N - 1), v: 0, f: 0, nb: [i - 1, i + 1].filter(j => j >= 0 && j < N) });
    }
    return { shape, n: N, cells, lines: [cells.map((_, i) => i)], aspect: 1, field: "path" };
  }
  return hgGeo("rect", n, o);
}
function clampHg(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ======================================================================
// Fields: four corners (OKLab) -> a color at (u, v)
// ======================================================================
// corners: [c00 (top left), c10 (top right), c01 (bottom left), c11 (bottom right)]
function hgFieldAt(kind, C, u, v) {
  if (kind === "loop") {
    // around the ring: c00 → c10 → c11 → c01 → back; v shades the inner rings lighter, the outer ones deeper
    const ord = [C[0], C[1], C[3], C[2]], t = ((u % 1) + 1) % 1 * 4, s = Math.floor(t) % 4, p = hgMix(ord[s], ord[(s + 1) % 4], t - Math.floor(t));
    return [clampHg(p[0] + (.5 - v) * .14, .1, .96), p[1], p[2]];
  }
  if (kind === "path") { const ord = [C[0], C[1], C[3], C[2]], t = clampHg(u, 0, 1) * 3, s = Math.min(2, Math.floor(t)); return hgMix(ord[s], ord[s + 1], t - s); }
  if (kind === "lch") {
    // one lightness: hue sweeps across, chroma down (corners hold [L, C, h])
    const L = C[0][0], h = C[0][2] + (C[1][2] - C[0][2]) * u, Ch = C[0][1] + (C[2][1] - C[0][1]) * v;
    return hgFromLch(L, Ch, h);
  }
  const top = hgMix(C[0], C[1], u), bot = hgMix(C[2], C[3], u);
  return hgMix(top, bot, v);
}
// an arc-length warp: where to sample u (or v) so equal steps are equal in CIEDE2000. Returns a function [0,1]→[0,1].
function hgWarp(kind, C, axis) {
  const S = kind === "loop" ? 64 : 32, probes = kind === "loop" ? [.5] : kind === "path" ? [0] : [0, .5, 1];
  if (axis === "v" && (kind === "loop" || kind === "path")) return t => t;
  const acc = new Array(S + 1).fill(0);
  probes.forEach(p => {
    let prev = null, run = 0; const cum = [0];
    for (let s = 0; s <= S; s++) {
      const t = s / S, ok = axis === "u" ? hgFieldAt(kind, C, t, p) : hgFieldAt(kind, C, p, t), L = lab(hgHex(ok));
      if (prev) { run += Math.max(hgDe(prev, L), 1e-4); cum.push(run); }
      prev = L;
    }
    cum.forEach((x, s) => { acc[s] += x / (run || 1) / probes.length; });
  });
  // invert the averaged cumulative profile
  return t => {
    const want = clampHg(t, 0, 1);
    let s = 0; while (s < S && acc[s + 1] < want) s++;
    if (s >= S) return 1;
    const a = acc[s], b = acc[s + 1];
    return (s + (b > a ? (want - a) / (b - a) : 0)) / S;
  };
}

// ======================================================================
// Corners from a source palette
// ======================================================================
// a palette (hexes) -> distinct colors, at least four (a short gem palette gets a lighter and a deeper tone of its own)
function hgPalette(pal) {
  const out = [];
  (pal || []).forEach(h => { if (/^#[0-9a-f]{6}$/i.test(h || "") && !out.some(o => hgDe(o, h.toUpperCase()) < 4)) out.push(h.toUpperCase()); });
  if (!out.length) out.push("#7A8FA6");
  const tone = (h, dL) => { const [L, a, b] = hgOk(h); return hgHex([clampHg(L + dL, .18, .95), a, b]); };
  const byC = out.slice().sort((a, b) => hgLch(hgOk(b))[1] - hgLch(hgOk(a))[1]);
  for (let k = 0; out.length < 4 && k < 12; k++) {
    const h = byC[k % byC.length], t = tone(h, k % 2 ? -.16 - k * .02 : .16 + k * .02);
    if (!out.some(o => hgDe(o, t) < 4)) out.push(t);
  }
  return out;
}
// farthest-point sampling: at most k colors that cover the palette
function hgSpread(pal, k) {
  if (pal.length <= k) return pal.slice();
  const L = pal.map(h => lab(h)), pick = [0];
  while (pick.length < k) { let best = -1, bd = -1; L.forEach((x, i) => { if (pick.includes(i)) return; const d = Math.min(...pick.map(j => hgDe(x, L[j]))); if (d > bd) { bd = d; best = i; } }); pick.push(best); }
  return pick.map(i => pal[i]);
}
// candidate corner sets [c00, c10, c01, c11] (hexes), best first. Each is four palette colors, arranged so the
// two diagonals are the two most different pairs and every edge has room for steps.
function hgCornerSets(pal, rnd = Math.random, max = 8) {
  const P = hgSpread(hgPalette(pal), 7), L = P.map(h => lab(h)), d = (a, b) => hgDe(L[a], L[b]), out = [];
  for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) for (let c = b + 1; c < P.length; c++) for (let e = c + 1; e < P.length; e++) {
    const q = [a, b, c, e];
    // the three ways to pair four colors into two diagonals
    [[0, 3, 1, 2], [0, 2, 1, 3], [0, 1, 2, 3]].forEach(([p0, p3, p1, p2]) => {
      const c00 = q[p0], c11 = q[p3], c10 = q[p1], c01 = q[p2];
      const edges = [d(c00, c10), d(c01, c11), d(c00, c01), d(c10, c11)], diag = Math.min(d(c00, c11), d(c10, c01));
      const minE = Math.min(...edges), meanE = edges.reduce((s, x) => s + x, 0) / 4;
      // no edge flat, diagonals longer than edges (a twisted square folds the field), a little reward for range
      const chroma = q.reduce((t, i) => t + Math.hypot(L[i][1], L[i][2]), 0) / 4;   // vivid corners make the more beautiful board
      const score = minE + .2 * meanE + .15 * Math.min(diag - Math.max(...edges) * .6, 20) + .12 * chroma - (L.some((x, i) => q.includes(i) && x[0] < 10) ? 3 : 0);
      out.push({ score, set: [P[c00], P[c10], P[c01], P[c11]] });
    });
  }
  out.sort((x, y) => y.score - x.score);
  // a seeded turn of the square, so two boards from one palette don't always lie the same way
  return out.slice(0, max).map(o => { const s = o.set, r = Math.floor(rnd() * 4); return [s, [s[1], s[3], s[0], s[2]], [s[3], s[2], s[1], s[0]], [s[2], s[0], s[3], s[1]]][r]; });
}
// special fields: one hue (lightness and strength change, the hue holds) or one lightness (hue and strength change)
function hgModeCorners(pal, mode) {
  const P = hgPalette(pal).map(h => hgLch(hgOk(h))).sort((a, b) => b[1] - a[1]);
  if (mode === "onehue") {
    const h = P[0][2], La = .86, Lb = .4, Ca = Math.min(hgMaxC(La, h), hgMaxC(Lb, h)) * .9;
    return { kind: "bi", C: [hgFromLch(La, Ca * .18, h), hgFromLch(La, Ca, h), hgFromLch(Lb, Ca * .18, h), hgFromLch(Lb, Ca, h)] };
  }
  // one lightness: the two most vivid hues at least 60° apart, swept across at the palette's middle lightness
  const L = clampHg(P.reduce((s, p) => s + p[0], 0) / P.length, .58, .78);
  let h1 = P[0][2], h2 = (P.find(p => Math.min(Math.abs(p[2] - h1), 360 - Math.abs(p[2] - h1)) >= 60) || [0, 0, h1 + 90])[2];
  let dh = h2 - h1; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  if (Math.abs(dh) < 60) dh = 90 * Math.sign(dh || 1);
  h2 = h1 + dh;
  let Cmax = 1; for (let s = 0; s <= 12; s++) Cmax = Math.min(Cmax, hgMaxC(L, h1 + dh * s / 12));
  Cmax *= .92;
  return { kind: "lch", C: [[L, Cmax, h1], [L, Cmax, h2], [L, Cmax * .3, h1], [L, Cmax * .3, h2]] };
}

// ======================================================================
// Building a board
// ======================================================================
// colors of every cell for corners C (OKLab, or LCh for "lch") on a shape, with the warp
function hgPaint(geo, fields) {
  return geo.cells.map(c => { const F = fields[c.f] || fields[0]; return hgHex(hgFieldAt(F.kind, F.C, F.wu(c.u), F.wv(c.v))); });
}
function hgMeasure(geo, hex, full = true) {
  const L = hex.map(h => lab(h)), steps = [], lineRatio = [];
  geo.lines.forEach((l, li) => {
    const s = [];
    for (let k = 1; k < l.length; k++) s.push(hgDe(L[l[k - 1]], L[l[k]]));
    if (geo.cyc && li < geo.cyc && l.length > 2) s.push(hgDe(L[l[l.length - 1]], L[l[0]]));
    if (!s.length) return;
    steps.push(...s);
    lineRatio.push(Math.max(...s) / Math.max(Math.min(...s), 1e-6));
  });
  const sorted = steps.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
  const out = { med, min: sorted[0] || 0, max: sorted[sorted.length - 1] || 0, even: lineRatio.length ? Math.max(...lineRatio) : 1, evenMean: lineRatio.length ? lineRatio.reduce((a, x) => a + x, 0) / lineRatio.length : 1, minPair: null, L };
  if (full) out.minPair = hgMinPair(geo, L);
  return out;
}
// the closest two slots on the whole board (twins excepted): the real test that a board can be solved by eye.
// Pairs more than 20 apart in Lab can't be the closest once something under 6 is found, so they're skipped.
function hgMinPair(geo, L, stopBelow = -1) {
  let minPair = Infinity;
  for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    if (geo.twins && geo.twins[a] === b) continue;
    const dx = L[a][0] - L[b][0], dy = L[a][1] - L[b][1], dz = L[a][2] - L[b][2];
    if (minPair < 6 && dx * dx + dy * dy + dz * dz > 400) continue;
    const d = hgDe(L[a], L[b]); if (d < minPair) { minPair = d; if (minPair < stopBelow) return minPair; }
  }
  return minPair;
}
// fields pulled toward their middle by f (1 = the source's full range), with their CIEDE2000 warps
function hgContract(fields, f) {
  return fields.map(F => {
    let C;
    if (F.kind === "lch") { const Cm = (F.C[0][1] + F.C[2][1]) / 2, hm = (F.C[0][2] + F.C[1][2]) / 2; C = F.C.map(c => [c[0], Cm + (c[1] - Cm) * f, hm + (c[2] - hm) * f]); }
    else { const mid = [0, 1, 2].map(k => F.C.reduce((t, c) => t + c[k], 0) / 4); C = F.C.map(c => hgMix(mid, c, f)); }
    return { kind: F.kind, C, wu: hgWarp(F.kind, C, "u"), wv: hgWarp(F.kind, C, "v") };
  });
}
// a board from a spec. spec: { shape, n, m?, K?, nMin?, pal (hexes), pal2? (weave), corners? (four hexes), mode?
// ("onehue" | "onelight"), T (target typical step, ΔE00), anchors ("frame" | "half" | "few" | "corners"), seed }
// -> { geo, hex (home color per cell), anchors (cell indexes), corners (hexes), step (measured), fit } , always solvable
function hgBuild(spec) {
  const rnd = hgRnd(hgHash("hg:" + (spec.seed || "x"))), T = clampHg(spec.T || 4, HG_MIN_STEP * 1.25, HG_STEP_MAX);
  const shapeN = { hex: 2, ring: 8, arch: 6, spiral: 12, heart: 6, leaf: 6 }, drop = spec.shape === "spiral" ? 10 : spec.shape === "ring" || spec.shape === "arch" ? 4 : 2;
  const nMin = spec.nMin != null ? spec.nMin : Math.max(shapeN[spec.shape] || 3, spec.n - drop);
  const nMax = spec.nMax != null ? spec.nMax : spec.shape === "hex" ? spec.n + 1 : spec.shape === "spiral" ? spec.n + 8 : spec.shape === "ring" || spec.shape === "arch" ? spec.n + 4 : Math.min(12, spec.n + 2);
  const cand = spec.mode ? [null] : spec.corners ? [spec.corners] : hgCornerSets(spec.pal, rnd, 6);
  const trials = [];
  for (let ci = 0; ci < cand.length; ci++) {
    const base = spec.mode ? hgModeCorners(spec.pal, spec.mode) : { kind: hgGeo(spec.shape, 2).field, C: cand[ci].map(hgOk) };
    const fields = [base];
    // the weave's second gradient: the same corners turned a quarter, a step lighter or darker, so the two never touch
    if (spec.shape === "weave") { const C = base.C, mL = C.reduce((t, c) => t + c[0], 0) / 4, dL = mL > .62 ? -.13 : .13; fields.push({ kind: "bi", C: [C[1], C[3], C[0], C[2]].map(c => [clampHg(c[0] + dL, .12, .97), c[1], c[2]]) }); }
    const geoAt = n => hgGeo(spec.shape, n, { m: spec.m && spec.m - (spec.n - n), K: spec.K });
    const paint = (geo, f) => { const fx = hgContract(fields, f); return hgPaint(geo, fx); };
    // 1. the size: fewer tiles when even the full palette is too fine for this eye, more when it's far too coarse
    let n = spec.n, geo = geoAt(n), full = hgMeasure(geo, paint(geo, 1), false);
    for (let g = 0; g < 4; g++) {
      if (full.med < T * .8 && n > nMin) n--;
      else if (full.med * .55 > T * 1.2 && n < nMax) n++;   // more tiles before muddier corners: beauty first
      else break;
      geo = geoAt(n); full = hgMeasure(geo, paint(geo, 1), false);
    }
    // 2. the spread: contract the corners toward their middle until the typical step meets the target
    const fit = (n, geo, full) => {
      let f = clampHg(T / Math.max(full.med, .01), .25, 1), hex = paint(geo, f), meas = f < 1 ? hgMeasure(geo, hex, false) : full;
      if (f < 1 && Math.abs(meas.med - T) > T * .12) { f = clampHg(f * T / Math.max(meas.med, .01), .25, 1); hex = paint(geo, f); meas = hgMeasure(geo, hex, false); }
      // 3. the floor: if a step fell under HG_MIN_STEP, spread back out just enough (never past the source's own range;
      // a short search, since steps don't scale exactly with f)
      if ((meas.min < HG_MIN_STEP || meas.even > HG_EVEN) && f < 1) {
        let lo = f, hi = 1, best = null;
        for (let g = 0; g < 6; g++) {
          const mid = g === 0 ? 1 : (lo + hi) / 2, h = paint(geo, mid), m = hgMeasure(geo, h, false);
          if (m.min >= HG_MIN_STEP && m.even <= HG_EVEN) { best = { f: mid, hex: h, meas: m }; hi = mid; } else lo = mid;
          if (g === 0 && !best) break;
        }
        if (best) ({ f, hex, meas } = best); else { f = 1; hex = paint(geo, 1); meas = hgMeasure(geo, hex, false); }
      }
      return { geo, hex, meas, f, n, ci };
    };
    const valid = t => t.meas.min >= HG_MIN_STEP && t.meas.even <= HG_EVEN;
    let t = fit(n, geo, full);
    trials.push(t);
    // an uneven board: a size smaller sometimes settles it; and the level's own size is always in the running
    for (const n2 of [n - 1, spec.n]) {
      if ((valid(t) && n2 !== spec.n) || n2 < nMin || n2 === n) continue;
      const g2 = geoAt(n2); t = fit(n2, g2, hgMeasure(g2, paint(g2, 1), false)); trials.push(t);
    }
  }
  // the corner set whose steps land nearest the target wins (ties go to the more beautiful, earlier set), as long as
  // it passes every check; the all-pairs check runs last because it's the slow one
  const good = trials.filter(t => t.meas.min >= HG_MIN_STEP && t.meas.even <= HG_EVEN)
    .sort((x, y) => Math.abs(Math.log(x.meas.med / T)) + .05 * x.ci - Math.abs(Math.log(y.meas.med / T)) - .05 * y.ci);
  for (const t of good) {
    t.meas.minPair = hgMinPair(t.geo, t.meas.L, HG_MIN_PAIR);
    if (t.meas.minPair >= HG_MIN_PAIR) return hgFinish(spec, t.geo, t.hex, t.meas, rnd, { T, f: t.f, n: t.n, corners: hgCornerHex(t.geo, t.hex) });
  }
  // nothing from the source passes (a palette of near-identical greys): a guaranteed board around its main color
  const depth = spec.depth || 0;
  if (depth >= 2) { const geo = hgGeo(spec.shape, nMin, { K: spec.K }), C = hgCornerSets(["#E8C25A", "#3D7DB8", "#C2456B", "#3E8E5A"], rnd, 1)[0].map(hgOk), F = { kind: geo.field, C }; F.wu = hgWarp(F.kind, C, "u"); F.wv = hgWarp(F.kind, C, "v"); const hex = hgPaint(geo, [F, F]), meas = hgMeasure(geo, hex); return hgFinish(spec, geo, hex, meas, rnd, { T, f: 1, n: nMin, corners: hgCornerHex(geo, hex), forced: true }); }
  const h0 = hgPalette(spec.pal)[0], H0 = hgLch(hgOk(h0))[2], C0 = Math.min(hgMaxC(.8, H0), hgMaxC(.72, H0 + 70), hgMaxC(.46, H0 - 40), hgMaxC(.4, H0 + 30)) * .85 + .02;
  return hgBuild({ ...spec, pal: [hgHex(hgFromLch(.8, C0, H0)), hgHex(hgFromLch(.72, C0, H0 + 70)), hgHex(hgFromLch(.46, C0, H0 - 40)), hgHex(hgFromLch(.4, C0, H0 + 30))], pal2: null, mode: null, corners: null, seed: (spec.seed || "x") + "+", T: Math.max(T, 3), depth: depth + 1 });
}
// the colors sitting at the four field corners (what the player sees at the corners)
function hgCornerHex(geo, hex) {
  const near = (u, v) => { let best = 0, bd = Infinity; geo.cells.forEach((c, i) => { if (c.f) return; const d = (c.u - u) ** 2 + (c.v - v) ** 2; if (d < bd) { bd = d; best = i; } }); return hex[best]; };
  if (geo.field === "loop") return [0, .25, .5, .75].map(u => near(u, .5));
  if (geo.field === "path") return [0, 1 / 3, 2 / 3, 1].map(u => near(u, 0));
  return [near(0, 0), near(1, 0), near(0, 1), near(1, 1)];
}
function hgFinish(spec, geo, hex, meas, rnd, fit) {
  const anchors = hgAnchors(geo, spec.anchors || "half");
  return { spec, geo, hex, anchors, corners: fit.corners, step: meas, fit, shape: geo.shape, n: fit.n };
}

// ---------- anchors: the fixed tiles (dotted). Fewer as the levels climb. ----------
function hgAnchors(geo, mode) {
  const cells = geo.cells, N = cells.length, set = new Set();
  const nearUV = (u, v, f = 0) => { let best = -1, bd = Infinity; cells.forEach((c, i) => { if (c.f !== f) return; const d = (c.u - u) ** 2 + (c.v - v) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  if (geo.field === "path") {
    const every = { frame: 3, half: 5, few: 8, corners: N }[mode] || 6;
    for (let i = 0; i < N; i += every) set.add(i);
    set.add(N - 1);
  } else if (geo.field === "loop") {
    const per = { frame: geo.n / 2, half: geo.n / 3, few: 4, corners: 2 }[mode] || 4, K = geo.K || 1;
    for (let s = 0; s < per; s++) { const m = Math.round(s * geo.n / per) % geo.n; set.add((K - 1) * geo.n + m); if (mode === "frame" || mode === "half") set.add(m); }
  } else {
    const fields = geo.shape === "weave" ? [0, 1] : [0];
    fields.forEach(f => [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([u, v]) => set.add(nearUV(u, v, f))));
    if (mode === "few") fields.forEach(f => [[.5, 0], [0, .5], [1, .5], [.5, 1]].forEach(([u, v]) => set.add(nearUV(u, v, f))));
    if (mode === "frame" || mode === "half") {
      // the hull: cells missing a lattice neighbor (around holes too)
      const maxNb = Math.max(...cells.map(c => (c.nb || []).length));
      const hull = cells.map((c, i) => [c, i]).filter(([c]) => (c.nb || []).length < maxNb).map(([, i]) => i);
      const cx = .5, cy = .5;
      hull.sort((a, b) => Math.atan2(cells[a].y + cells[a].h / 2 - cy, cells[a].x + cells[a].w / 2 - cx) - Math.atan2(cells[b].y + cells[b].h / 2 - cy, cells[b].x + cells[b].w / 2 - cx));
      hull.forEach((i, k) => { if (mode === "frame" || k % 2 === 0) set.add(i); });
    }
  }
  if (geo.twins) [...set].forEach(i => { if (geo.twins[i] != null) set.add(geo.twins[i]); });
  set.delete(-1);
  // always something to move
  if (set.size >= N - 1) return mode !== "corners" ? hgAnchors(geo, "corners") : [0, N - 1].filter(i => i >= 0);
  return [...set].sort((a, b) => a - b);
}

// ======================================================================
// Shuffles, moves, solved
// ======================================================================
// at[slot] = the cell whose home color sits there now. Anchors stay; the rest are dealt so none starts at home.
// how: "all" (default) | a number k (only k swaps of near neighbors: the teaching board, the Journey step)
function hgDeal(board, rnd, how = "all") {
  const N = board.geo.cells.length, at = Array.from({ length: N }, (_, i) => i), fixed = new Set(board.anchors), tw = board.geo.twins;
  const left = i => !tw || board.geo.cells[i].i < board.geo.n / 2;
  const free = at.filter(i => !fixed.has(i) && left(i));
  const swap = (a, b) => { [at[a], at[b]] = [at[b], at[a]]; if (tw) { const ta = tw[a], tb = tw[b]; [at[ta], at[tb]] = [at[tb], at[ta]]; } };
  if (typeof how === "number") {
    const used = new Set();
    for (let k = 0; k < how; k++) {
      const pool = free.filter(i => !used.has(i)), a = pool[Math.floor(rnd() * pool.length)];
      if (a == null) break;
      const nb = (board.geo.cells[a].nb || []).filter(j => free.includes(j) && !used.has(j)), b = nb.length ? nb[Math.floor(rnd() * nb.length)] : pool.find(j => j !== a);
      if (b == null) break;
      used.add(a); used.add(b); swap(a, b);
    }
    return at;
  }
  const order = free.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  free.forEach((slot, k) => { at[slot] = order[k]; });
  // nobody starts at home (a two-tile board just swaps)
  free.forEach((slot, k) => { if (at[slot] === slot && free.length > 1) { const other = free[(k + 1) % free.length]; [at[slot], at[other]] = [at[other], at[slot]]; } });
  if (tw) free.forEach(slot => { at[tw[slot]] = tw[at[slot]]; });
  return at;
}
// is every slot showing its own color? (equal colors count as home: two identical tiles are interchangeable)
const hgHome = (board, at, s) => at[s] === s || board.hex[at[s]] === board.hex[s];
const hgSolved = (board, at) => at.every((_, s) => hgHome(board, at, s));
// the fewest swaps that solve it (a mirror board's twin moves come free): misplaced tiles minus cycles
function hgPar(board, at) {
  const tw = board.geo.twins, seen = new Set();
  let swaps = 0;
  at.forEach((_, s) => {
    if (seen.has(s) || hgHome(board, at, s) || (tw && board.geo.cells[s].i >= board.geo.n / 2)) return;
    let len = 0, x = s;
    while (!seen.has(x)) { seen.add(x); len++; x = at[x]; }
    swaps += len - 1;
  });
  return swaps;
}
// one move: swap the tiles at slots a and b (a mirror board moves the twins too). Returns the slots that changed.
function hgSwap(board, at, a, b) {
  const tw = board.geo.twins, out = [a, b];
  [at[a], at[b]] = [at[b], at[a]];
  if (tw && tw[a] !== a && tw[b] !== b && tw[a] !== b) { [at[tw[a]], at[tw[b]]] = [at[tw[b]], at[tw[a]]]; out.push(tw[a], tw[b]); }
  return out;
}
// how a wrong drop is off: the axis that dominates the difference between the tile and the slot's true color
function hgAxis(hexA, hexB) {
  const [L1, C1, H1] = lch(hexA), [L2, C2, H2] = lch(hexB);
  let dh = H2 - H1; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const dH = Math.abs(2 * Math.sqrt(C1 * C2) * Math.sin(dh * Math.PI / 360)), dL = Math.abs(L2 - L1), dC = Math.abs(C2 - C1);
  return dL >= dC && dL >= dH ? "light" : dC >= dH ? "chroma" : "hue";
}

// ======================================================================
// Worlds, the ladder, difficulty
// ======================================================================
// Each world plays the same twenty-step ladder (stretched to its own length): shapes and sizes grow, anchors thin
// out, twists join. A level that brings a new twist is drawn easier (a bigger step), so novelty replaces pressure.
//   s shape · n size · a anchors · t twist · x step multiplier (× the eye threshold) · K rings/bands · m rows
const HG_LADDER = [
  { s: "rect", n: 4, a: "frame", x: 3.4 },
  { s: "rect", n: 5, a: "frame", x: 3.1 },
  { s: "diamond", n: 5, a: "frame", x: 3 },
  { s: "hex", n: 2, a: "frame", x: 2.9 },
  { s: "rect", n: 5, m: 6, a: "half", x: 2.7 },
  { s: "ring", n: 14, K: 2, a: "half", x: 2.8 },
  { s: "rect", n: 6, a: "half", t: "moves", x: 2.9 },
  { s: "arch", n: 9, K: 3, a: "half", x: 2.5 },
  { s: "heart", n: 8, a: "half", x: 2.4 },
  { s: "hex", n: 3, a: "half", t: "timer", x: 2.6 },
  { s: "holes", n: 7, a: "few", x: 2.2 },
  { s: "spiral", n: 26, a: "few", x: 2.3 },
  { s: "diamond", n: 7, a: "few", t: "onehue", x: 2.6 },
  { s: "weave", n: 6, a: "half", x: 2.5 },
  { s: "rect", n: 7, m: 8, a: "few", t: "onelight", x: 2.4 },
  { s: "mirror", n: 8, a: "few", x: 2.2 },
  { s: "rect", n: 5, a: "frame", t: "blind", x: 2.8 },
  { s: "leaf", n: 10, a: "few", x: 1.9 },
  { s: "hex", n: 4, a: "corners", t: "moves", x: 1.9 },
  { s: "rect", n: 10, a: "corners", x: 1.6 },
];
const HG_TWIST = {
  moves: { name: "Moves limit", line: "A limited number of moves." },
  timer: { name: "Against the clock", line: "A clock runs down." },
  onehue: { name: "One hue", line: "Every tile is the same hue: only lightness and strength change." },
  onelight: { name: "One lightness", line: "Every tile is equally light: only hue and strength change." },
  blind: { name: "Blind", line: "Look first. Then the tiles turn face down." },
  weave: { name: "Two gradients", line: "Two gradients woven row by row." },
  mirror: { name: "Mirror", line: "Each move is mirrored on the other side." },
};
// worlds: id, name, the line under it, how many levels, how much harder its ladder runs (size bump, step factor)
const HG_WORLDS = [
  { id: "painters", name: "Painters", line: "Four corners from famous paintings.", n: 20, sb: 0, wf: 1 },
  { id: "gardens", name: "Gardens", line: "Petals, leaves and stems.", n: 16, sb: 1, wf: .95 },
  { id: "gems", name: "Gems", line: "The colors of stones, light through crystal.", n: 18, sb: 1, wf: .9 },
  { id: "decades", name: "Decades", line: "A century of fashion, ten years at a time.", n: 15, sb: 2, wf: .86 },
  { id: "yours", name: "Your colors", line: "Boards from your favorites and kept palettes.", n: 15, sb: 1, wf: .9 },
];
const HG_OPEN_AT = 5;   // levels cleared in a world that open the next one
// level i of a world -> its rung of the ladder
const hgRung = (w, i) => HG_LADDER[Math.round(i * (HG_LADDER.length - 1) / Math.max(1, HG_WORLDS[w].n - 1))];
// the target step: your threshold × the rung × the world × your running form (k), never under the floor
const hgTarget = (th, x, wf = 1, k = 1) => clampHg((th > 0 ? th : 2.2) * x * wf * k, HG_MIN_STEP * 1.3, HG_STEP_MAX);
// the spec of level i in world w. src: { kind, id, title, line, pal, pal2? }, th: the eye threshold (ΔE00), k: form
function hgLevelSpec(w, i, src, th, k = 1, attempt = 0, diff = null) {
  const W = HG_WORLDS[w], R = hgRung(w, i), grow = ["rect", "holes", "weave", "mirror", "diamond", "heart", "leaf"].includes(R.s);
  const n = R.s === "hex" ? R.n + (W.sb >= 2 ? 1 : 0) : R.s === "ring" || R.s === "arch" ? R.n + W.sb * 2 : R.s === "spiral" ? R.n + W.sb * 4 : Math.min(12, R.n + (grow ? W.sb : 0));
  const tw = R.t || (R.s === "weave" ? "weave" : R.s === "mirror" ? "mirror" : null);
  return { id: W.id + ":" + i, world: w, i, shape: R.s, n, m: R.m ? Math.min(12, R.m + (grow ? W.sb : 0)) : undefined, K: R.K, anchors: R.a, twist: tw,
    mode: tw === "onehue" || tw === "onelight" ? tw : null, pal: src ? src.pal : null, pal2: src && src.pal2, T: diff && HG_DIFF[diff] ? hgDiffT(diff, w) : hgTarget(th, R.x, W.wf, k), diff: diff || null,
    seed: W.id + ":" + i + ":" + (src ? src.id : "") , deal: W.id + ":" + i + ":" + attempt, src };
}
// Choose mode (David, 2026-10-08: "an option to pick your difficulty and try a hard level from the start"): a fixed
// step for every board, whatever your eye; the ladder still sets shape, size and twist.
const HG_DIFF = { easy: { name: "Easy", T: 7 }, medium: { name: "Medium", T: 4.5 }, hard: { name: "Hard", T: 2.8 }, expert: { name: "Expert", T: 1.7 } };
const hgDiffT = (d, w = 0) => clampHg((HG_DIFF[d] || HG_DIFF.medium).T * Math.sqrt(HG_WORLDS[w] ? HG_WORLDS[w].wf : 1), HG_MIN_STEP * 1.3, HG_STEP_MAX);
// running form: a clean, efficient solve makes the next board finer; hints or a long search make it gentler
function hgForm(k, r) {
  const eff = r.par > 0 ? r.par / Math.max(r.moves, r.par) : 1;
  let nk = k;
  if (!r.solved) nk *= 1.12;
  else if (r.hints) nk *= 1.06;
  else if (eff >= .8) nk *= .92;
  else if (eff < .55) nk *= 1.06;
  return clampHg(nk, .6, 1.6);
}
// moves allowed, the few-moves star, the clock
const hgMoveCap = par => par + Math.max(4, Math.ceil(par * .35));
const hgFewMoves = par => par + Math.max(2, Math.ceil(par * .12));
const hgClock = movable => Math.round(18 + movable * 2.6);

// ---------- the daily board: one board a day, the same for everyone ----------
const HG_DAILY_START = "2026-10-08";
const hgDayNum = key => { const [a, b] = [HG_DAILY_START, key].map(x => { const [y, m, d] = x.split("-").map(Number); return Date.UTC(y, m - 1, d); }); return Math.round((b - a) / 864e5) + 1; };
const HG_DAILY = [{ s: "hex", n: 3 }, { s: "diamond", n: 7 }, { s: "ring", n: 18, K: 2 }, { s: "heart", n: 9 }, { s: "arch", n: 11, K: 3 }, { s: "holes", n: 8 }, { s: "spiral", n: 30 }, { s: "leaf", n: 10 }, { s: "rect", n: 7, m: 8 }];
// srcs: the sources every phone has (paintings, gardens, decades), in a fixed order
function hgDailySpec(key, srcs) {
  // sources go round in a fixed shuffled order and shapes in a cycle of nine, so no two days repeat for months
  const num = hgDayNum(key), mod = (a, b) => ((a % b) + b) % b, R = HG_DAILY[mod(num - 1, HG_DAILY.length)], ord = srcs.map((_, i) => i), rnd = hgRnd(hgHash("hg-daily-order"));
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  const src = srcs[ord[mod(num - 1, ord.length)]];
  return { id: "daily:" + key, daily: key, num, shape: R.s, n: R.n, m: R.m, K: R.K, anchors: "half", twist: null, mode: null, pal: src.pal, T: 3.6, seed: "daily:" + key, deal: "daily:" + key, src };
}
// the plain share line (no spoilers, no emoji): "ColorHub · Gradients #4 · Honeycomb: 31 moves (par 27), no hints"
function hgShareText(num, shape, r) {
  return `ColorHub · Gradients #${num} · ${HG_SHAPE_NAME[shape] || "Board"}: ${r.moves} move${r.moves === 1 ? "" : "s"} (par ${r.par})${r.hints ? `, ${r.hints} hint${r.hints === 1 ? "" : "s"}` : ", no hints"}`;
}

// ---------- the Gardens: flowers as screen approximations (petal light and deep, leaf, the shade between) ----------
// id = the plant's page in the botany wiki (#/botany/<id>). Colors are illustrative screen colors, not measured.
const HG_GARDENS = [
  { id: "marigold", title: "Marigold", sci: "Tagetes and Calendula", pal: ["#F6A21E", "#E57C04", "#FFD25A", "#9A3E0B", "#4E6B2A"] },
  { id: "cornflower", title: "Cornflower", sci: "Centaurea cyanus", pal: ["#6495ED", "#3A5BB8", "#A9C4F5", "#7E9468", "#2C3F7A"] },
  { id: "cerise", title: "Cherry", sci: "Prunus avium, blossom and fruit", pal: ["#F7D6DE", "#E8A0B4", "#DE3163", "#8E1B3A", "#5D4037"] },
  { id: "lavender", title: "Lavender", sci: "Lavandula angustifolia", pal: ["#C3B1E1", "#7E5BA6", "#8C9C86", "#4F5E4C", "#E8E0F0"] },
  { id: "orange", title: "Orange tree", sci: "Citrus × sinensis, blossom and fruit", pal: ["#FFA500", "#F28C28", "#FFF5E1", "#4F7A3A", "#FFD8A8"] },
  { id: "raspberry", title: "Raspberry", sci: "Rubus idaeus", pal: ["#E30B5C", "#B0254F", "#F28CA8", "#6B1532", "#7E9A5E"] },
  { id: "violet", title: "Sweet violet", sci: "Viola odorata", pal: ["#8F5FBF", "#5B2F8A", "#C6A6E0", "#F2D24B", "#3E6B35"] },
  { id: "lilac", title: "Lilac", sci: "Syringa vulgaris", pal: ["#C8A2C8", "#9F6FA8", "#E9D8EC", "#6F8F5E", "#3E5A37"] },
  { id: "peach", title: "Peach", sci: "Prunus persica, blossom and fruit", pal: ["#FFE5B4", "#F9B48A", "#E8875E", "#C4524A", "#9BB06A"] },
  { id: "orchid", title: "Orchid", sci: "Orchidaceae", pal: ["#DA70D6", "#B04FA8", "#F5D0F0", "#7A2C6F", "#8DA36A"] },
  { id: "apricot", title: "Apricot", sci: "Prunus armeniaca", pal: ["#FBCEB1", "#F4A261", "#E07A3F", "#B5532D", "#6F8B3A"] },
  { id: "mint", title: "Mint", sci: "Mentha, leaf and flower", pal: ["#C9E8C3", "#7FB77E", "#3E8E5A", "#B9A6D8", "#2F5D3A"] },
  { id: "plum", title: "Plum", sci: "Prunus domestica", pal: ["#8E4585", "#5B2A5E", "#B784A7", "#3E2246", "#9AAF7E"] },
  { id: "thistle", title: "Thistle", sci: "Cirsium and Onopordum", pal: ["#D8BFD8", "#A86FB5", "#7A4C8F", "#9AA893", "#5E7356"] },
  { id: "sage", title: "Sage", sci: "Salvia officinalis", pal: ["#B2AC88", "#8A9A72", "#5F6F52", "#B9A5D6", "#DAD7C5"] },
  { id: "moss", title: "Moss", sci: "Bryophytes", pal: ["#8A9A5B", "#5E7A2E", "#B7C77A", "#3F5223", "#A8A35F"] },
];
// the order of the other worlds' sources (ids into PAINTINGS, GEMS and FASHION.decades)
// the most vivid palettes first; the quiet, varnished ones (subtler steps) come later in the world
const HG_PAINTINGS = ["sunflowers", "composition-vii", "the-kiss", "water-lilies", "birth-of-venus", "starry-night", "the-scream", "houses-of-parliament", "mona-lisa", "pearl-earring",
  "milkmaid", "the-swing", "rouen-cathedral", "great-wave", "temeraire", "grande-jatte", "impression-sunrise", "woman-parasol", "japanese-footbridge", "whistlers-mother"];
const HG_GEMS = ["ruby", "sapphire", "emerald", "citrine", "amethyst", "turquoise", "tourmaline", "opal", "garnet", "topaz", "aquamarine", "peridot", "labradorite", "jade", "lapis-lazuli", "coral", "amber", "moonstone"];
const HG_DECADES = ["1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", ["1920s", "1970s"], "1970s", "1980s", "1990s", ["1950s", "1980s"], "2000s", "2010s", "2020s"];

if (typeof module !== "undefined") module.exports = {
  hgHash, hgRnd, hgOk, hgHex, hgLinRgb, hgInG, hgLch, hgFromLch, hgMaxC, HG_MIN_STEP, HG_MIN_PAIR, HG_EVEN, HG_STEP_MAX, HG_SHAPES, HG_SHAPE_NAME,
  hgGeo, hgFieldAt, hgWarp, hgPalette, hgSpread, hgCornerSets, hgModeCorners, hgPaint, hgMeasure, hgBuild, hgAnchors, hgDeal, hgHome, hgSolved, hgPar, hgSwap, hgAxis,
  HG_LADDER, HG_TWIST, HG_WORLDS, HG_OPEN_AT, hgRung, hgTarget, HG_DIFF, hgDiffT, hgLevelSpec, hgForm, hgMoveCap, hgFewMoves, hgClock, HG_DAILY_START, hgDayNum, HG_DAILY, hgDailySpec, hgShareText,
  HG_GARDENS, HG_PAINTINGS, HG_GEMS, HG_DECADES,
};
