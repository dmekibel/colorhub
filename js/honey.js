"use strict";
// The honeycomb: one view mode of the color browser (js/colorsets.js), and the engine behind the honeycomb home
// (js/home.js). It shows ANY list of colors as bubbles on a hex lattice seen through a lens, drawn on one canvas so
// even the 2,700-name library stays smooth on a phone.
//  - layout "mapWide" / "mapTall": hue runs left to right and wraps around (greys get their own band at the seam);
//    lightness runs top to bottom and tiles mirrored (light, dark, light...), so the plane has no seams. "mapWide" is
//    the original, wider tile; "mapTall" (today's shipped look) is taller, like a phone.
//  - layout "wheel": greys in the middle, hue around, strength outward; the hexagon-shaped wheel tiles the plane.
//    Every lattice cell always gets a color (leftover cells in the outermost ring duplicate their nearest neighbor)
//    so the wheel never shows an empty hole.
//  - layout "sunflower": a golden-angle phyllotaxis disc, sorted by hue (angle) then lightness (radius). It never
//    wraps: it's one finite cluster at every set size, 25 to 2,700.
//  Small sets (under HONEY_FINITE colors) on the map/wheel layouts don't wrap either: they sit as one compact
//  cluster and spring back if you pull away.
//
// ---- the preset system (ROADMAP: "a honeycomb David can find the perfect look in") ----
// Every visual choice is one `cfg` object: layout, lensMode ("round" fisheye | "edges" warp | "none" flat), the
// lens shape (m0 center size, m1 outer size, sig falloff), fill (0-1: how much bubble size follows the local
// TANGENTIAL spacing rather than just the radial derivative — the fix for the black gaps a pure-radial fisheye
// leaves between outer bubbles), gap (seam width; pack = 1-gap), shape (0 circle - 1 true hexagon, rounded in
// between), vig (vignette strength), labelMin (smallest bubble that still shows a name), drift (speed, 0 = off),
// and zMinUser (an explicit zoom-out floor; once set there's no rubber-band back past it — "stays that far out").
// HONEY_STYLES holds eight named presets; honeycomb()'s opts.style picks one (by id or inline object), and
// opts.tweak layers live overrides on top (js/home.js's Tweak panel, saved in S.hm.tweak). The returned controller's
// .tweak(partial), .style(id) and .getCfg() drive that panel; .lens(k)/.lensMode(m) stay as thin back-compat shims
// for any older caller.
//
// honeycomb(host, { items, layout, style, tweak, focus, pick, zoom, onZoom })
//   -> { update({ items, layout, focus, soft }), zoom(z), tweak(partial), style(id), getCfg(), current(), destroy() }
//   items  [{ n, h, c?, lib? }]  c = the app color (one of the 101), lib = its data/library.json entry.
//          Defaults to the 101 app colors as { n, h, c }.
//   focus  an item (or anything with .n or .h) to center first.   pick(item, { morph }) on tap; morph() flies the bubble.
//   onPeek(item)  optional: a long still press (480ms) calls this instead of pick (js/home.js: peek.js's quick look).

const HONEY_SQ3 = Math.sqrt(3) / 2, HONEY_FINITE = 48;
let HONEY_PAN = null;                 // where you were: { key, x, y, z, name }
const HONEY_NORM = new WeakMap();     // original item -> normalized item (Lab, LCh, ink)
const HONEY_LAYOUTS = new Map();      // layout cache by contents

function honeyNorm(o) {
  let it = HONEY_NORM.get(o); if (it) return it;
  const [L, a, b] = lab(o.h), C = Math.hypot(a, b);
  let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360;
  it = { o, n: o.n, h: o.h, c: o.c || null, lib: o.lib || (o.src ? o : null), lab: [L, a, b], L, C, H,
    ink: ink(o.h) === "dark" ? "rgba(20,19,17,.86)" : "rgba(255,255,255,.93)" };
  HONEY_NORM.set(o, it);
  return it;
}

// ---------- layouts: base points on the unit hex lattice (+ the two vectors the plane repeats along) ----------
const honeyHueKey = it => it.C < 7 ? 400 + (100 - it.L) / 100 : (it.H - 15 + 360) % 360;
// k tunes the tile's aspect: smaller k = more rows, taller tile (today's shipped "mapTall"); bigger k = fewer
// rows, wider tile (the original "mapWide").
function honeyMap(items, k) {
  const N = items.length, h0 = Math.max(2, Math.round(Math.sqrt(N * k)));
  let best = null;
  for (let H = Math.max(2, h0 - 3); H <= h0 + 3; H++) {
    const W = Math.ceil(N / H), e = W * H - N, score = e + Math.abs(H - h0) * .6;
    if (!best || score < best.score) best = { H, W, e, score };
  }
  const { H, W, e } = best, half = Math.floor(W / 2);
  const grey = items.filter(it => it.C < 7).sort((a, b) => b.L - a.L), gc = Math.max(1, Math.round(grey.length / H));
  const order = items.filter(it => it.C >= 7).sort((a, b) => honeyHueKey(a) - honeyHueKey(b))
    .concat(grey.map((it, i) => [i % gc, i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]));
  const pts = [];
  for (let j = 0, k2 = 0; j < W; j++) {
    const short = Math.floor((j + 1) * e / W) > Math.floor(j * e / W), col = order.slice(k2, k2 + (short ? H - 1 : H)).sort((a, b) => b.L - a.L);
    k2 += col.length;
    col.forEach((it, r) => {
      const x = j + (r & 1 ? .5 : 0), y = r * HONEY_SQ3;
      pts.push({ it, x, y });
      if (r > 0 && r < H - 1) pts.push({ it, x: x + half, y: -y });
    });
  }
  return { pts, A: [W, 0], B: [0, 2 * (H - 1) * HONEY_SQ3], perX: Math.max(2, half), perY: 2 * (H - 1) * HONEY_SQ3 };
}
// cells of a hexagon of radius n, ring by ring, each with its angle
function honeyRings(n) {
  const rings = [];
  for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) {
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (d > n) continue;
    const x = q + r / 2, y = r * HONEY_SQ3; let a = Math.atan2(-y, x) * 180 / Math.PI; if (a < 0) a += 360;
    (rings[d] = rings[d] || []).push({ x, y, a });
  }
  return rings;
}
// the hexagon-ring wheel. Every cell in rings 0..n gets a color: any cell the main pass doesn't reach (the
// outermost ring, when N isn't a "centered hexagonal number") is filled by duplicating its nearest placed
// neighbor, so the tiled plane never shows an empty hole (David: "the wheel has ugly empty gaps").
function honeyWheel(items) {
  const N = items.length;
  let n = 0; while (3 * n * n + 3 * n + 1 < N) n++;
  const rings = honeyRings(n), byC = items.slice().sort((a, b) => a.C - b.C), pts = [];
  const ad = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const meta = [];
  for (let d = 0, k = 0; d <= n && k < N; d++) {
    const cells = rings[d].sort((a, b) => a.a - b.a), m = Math.min(cells.length, N - k);
    const grp = byC.slice(k, k + m).sort((a, b) => a.H - b.H); k += m;
    const sel = grp.map((_, i) => Math.floor(i * cells.length / m));
    let bo = 0, bc = Infinity;
    for (let o = 0; o < cells.length; o++) {
      let c = 0; for (let i = 0; i < m && c < bc; i++) c += ad(grp[i].H, cells[(sel[i] + o) % cells.length].a);
      if (c < bc) { bc = c; bo = o; }
    }
    const used = new Set();
    grp.forEach((it, i) => { const idx = (sel[i] + bo) % cells.length; used.add(idx); const cell = cells[idx]; pts.push({ it, x: cell.x, y: cell.y }); meta.push({ x: cell.x, y: cell.y, it }); });
    cells.forEach((cell, idx) => { if (!used.has(idx)) meta.push({ x: cell.x, y: cell.y, it: null }); });
  }
  const empties = meta.filter(c => !c.it), filled = meta.filter(c => c.it);
  empties.forEach(e => {
    let best = null, bd = Infinity;
    for (const f of filled) { const dd = (f.x - e.x) ** 2 + (f.y - e.y) ** 2; if (dd < bd) { bd = dd; best = f; } }
    if (best) pts.push({ it: best.it, x: e.x, y: e.y });
  });
  const cart = (q, r) => [q + r / 2, r * HONEY_SQ3];
  return { pts, A: cart(2 * n + 1, -n), B: cart(n, n + 1) };
}
// golden-angle phyllotaxis disc: every item placed once, ordered by hue (so hue sweeps smoothly as the spiral
// grows) then lightness (so lightness reads along the radius too). Never wraps — one cluster at any size.
const HONEY_GA = Math.PI * (3 - Math.sqrt(5));
function honeySunflower(items) {
  const N = items.length, c = .56;   // tuned so neighbor spacing (by index) is close to the lattice's unit spacing
  const ordered = items.slice().sort((a, b) => honeyHueKey(a) - honeyHueKey(b) || b.L - a.L);
  const pts = ordered.map((it, i) => { const r = c * Math.sqrt(i + .5), a = i * HONEY_GA; return { it, x: r * Math.cos(a), y: r * Math.sin(a) }; });
  return { pts, finite: true };
}
// a small set as one compact cluster: hue across, light to dark down, each color in the nearest free cell
function honeyCluster(items) {
  const N = items.length, cells = honeyRings(8).flat().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.a - b.a).slice(0, N);
  const R = Math.max(.5, ...cells.map(c => Math.hypot(c.x, c.y)));
  const byHue = items.slice().sort((a, b) => honeyHueKey(a) - honeyHueKey(b)), Ls = items.map(it => it.L);
  const lo = Math.min(...Ls), span = Math.max(1, Math.max(...Ls) - lo);
  const tg = byHue.map((it, i) => ({ it, x: (N > 1 ? i / (N - 1) - .5 : 0) * 2 * R, y: ((100 - it.L) - (100 - lo - span)) / span * 2 * R - R }));
  const pairs = [];
  tg.forEach((t, i) => cells.forEach((c, j) => pairs.push([(t.x - c.x) ** 2 + (t.y - c.y) ** 2, i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const ti = new Set(), cj = new Set(), pts = [];
  for (const [, i, j] of pairs) { if (ti.has(i) || cj.has(j)) continue; ti.add(i); cj.add(j); pts.push({ it: tg[i].it, x: cells[j].x, y: cells[j].y }); }
  return { pts, finite: true, ext: R };
}
const HONEY_MAP_K = { mapWide: 1 / 2.4, mapTall: .63 };
function honeyLayout(raw, layoutKey) {
  let hs = 2166136261; for (const o of raw) for (let i = 0; i < o.n.length; i++) { hs ^= o.n.charCodeAt(i); hs = Math.imul(hs, 16777619); }
  const key = `${layoutKey}|${raw.length}|${hs >>> 0}`;
  const hit = HONEY_LAYOUTS.get(key); if (hit && hit.raw === raw) return hit;
  const items = raw.map(honeyNorm);
  let lay;
  if (layoutKey === "sunflower") lay = honeySunflower(items);
  else if (items.length < HONEY_FINITE) lay = layoutKey === "wheel" ? Object.assign(honeyWheel(items), { finite: true }) : honeyCluster(items);
  else if (layoutKey === "wheel") lay = honeyWheel(items);
  else lay = honeyMap(items, HONEY_MAP_K[layoutKey] || HONEY_MAP_K.mapTall);
  if (lay.finite) lay.ext = Math.max(.5, ...lay.pts.map(p => Math.hypot(p.x, p.y)));
  else { const [A, B] = [lay.A, lay.B], det = A[0] * B[1] - B[0] * A[1]; lay.inv = [B[1] / det, -B[0] / det, -A[1] / det, A[0] / det]; lay.per = Math.min(Math.hypot(...A), Math.hypot(...B)); lay.perX = lay.perX || lay.per; lay.perY = lay.perY || lay.per; }
  Object.assign(lay, { key, raw, items, mixed: items.some(it => it.c) && items.some(it => !it.c) });
  if (HONEY_LAYOUTS.size > 24) HONEY_LAYOUTS.clear();
  HONEY_LAYOUTS.set(key, lay);
  return lay;
}

// ---------- the eight presets ----------
// Every field here is also a Tweak-panel slider (js/home.js hmTweakPanel): m0/m1/sig (Center/Outer/Falloff),
// fill, gap, shape, zMinUser (Zoom-out limit), vig (Vignette), labelMin, drift, lensMode, layout.
const HONEY_CFG_BASE = { layout: "mapTall", lensMode: "round", m0: 3.7, m1: .82, sig: 1.9, fill: .5, gap: .1, shape: 0,
  zMinUser: null, vig: 1, labelMin: 26, drift: 1, flat: .7 };
const HONEY_STYLES = {
  original: { title: "Original", cfg: { layout: "mapWide", m0: 3.7, m1: 1.05, sig: 2.1, fill: .4, gap: .1, zMinUser: .11, labelMin: 24 } },
  current: { title: "Current", cfg: { layout: "mapTall", m0: 3.7, m1: 1.1, sig: 2.2, fill: .55, gap: .09, zMinUser: .1, labelMin: 23 } },
  edges: { title: "Edges", cfg: { layout: "mapTall", lensMode: "edges", flat: .68, fill: .6, gap: .1, zMinUser: .15, labelMin: 25 } },
  sunflower: { title: "Sunflower", cfg: { layout: "sunflower", m0: 2.3, m1: 1, sig: 2.4, fill: .3, gap: .12, zMinUser: .18, labelMin: 24, vig: 0 } },
  wheel: { title: "Wheel", cfg: { layout: "wheel", m0: 3.4, m1: 1, sig: 2, fill: .7, gap: .08, zMinUser: .12, labelMin: 25 } },
  tapestry: { title: "Tapestry", cfg: { layout: "mapTall", m0: 3, m1: 1.3, sig: 2.6, fill: 1, gap: .07, shape: .45, zMinUser: .06, labelMin: 32, drift: .6 },
    sizeTune: N => ({ }), initialZoom: N => N >= 600 ? .22 : N >= 150 ? .32 : .42 },
  magnifier: { title: "Magnifier", cfg: { layout: "mapTall", m0: 5.6, m1: .6, sig: 1.2, fill: .5, gap: .12, zMinUser: .25, labelMin: 22 } },
  honeycomb: { title: "Honeycomb", cfg: { layout: "mapTall", lensMode: "none", flat: .999, shape: 1, gap: .03, zMinUser: .08, labelMin: 30, drift: .4, vig: .6 } },
};
const HONEY_STYLE_LIST = Object.keys(HONEY_STYLES).map(id => ({ id, title: HONEY_STYLES[id].title }));
function honeyResolveCfg(styleId, tweak, N) {
  const preset = HONEY_STYLES[styleId] || HONEY_STYLES.current;
  let cfg = { ...HONEY_CFG_BASE, ...preset.cfg };
  if (preset.sizeTune) cfg = { ...cfg, ...preset.sizeTune(N) };
  if (tweak) cfg = { ...cfg, ...tweak };
  cfg.fill = clamp(+cfg.fill, 0, 1); cfg.shape = clamp(+cfg.shape, 0, 1); cfg.gap = clamp(+cfg.gap, 0, .5);
  cfg.vig = clamp(+cfg.vig, 0, 1); cfg.drift = Math.max(0, +cfg.drift);
  return cfg;
}
// a compact summary of a resolved cfg, for the lab screen's "Copy my ratings" / Tweak panel's "Copy settings"
function honeyCfgSummary(styleId, tweak) { return { style: styleId, tweak: tweak || null }; }

// ---------- the lens ----------
const honeyErf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
const HONEY_WRAP = new Map();
function honeyWrap(ctx, name) {
  let w = HONEY_WRAP.get(name); if (w) return w;
  const maxW = 76, words = name.split(" ");
  for (let fs = 19; fs >= 10; fs -= .5) {
    ctx.font = `${fs}px "Instrument Serif",Georgia,serif`;
    const lines = []; let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = wd; } }
    lines.push(cur);
    w = { fs: fs / 100, lines };
    if (lines.length <= 3 && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  HONEY_WRAP.set(name, w);
  return w;
}
function honeyWhere(it) {
  if (it.c) {
    const u = UNITS.find(u => u.colors.includes(it.c)), s = it.c.id && S.cards[it.c.id];
    return [u ? `Unit ${u.i + 1} of the 101` : "A basic word", s ? (isMine(s) ? "you know it" : "learning") : ""].filter(Boolean).join(" · ");
  }
  return (it.lib && srcLine(it.lib)) || "Name library";
}
// a regular hexagon's radial boundary at angle theta (radians), apothem = r (so flat-to-flat width = 2r, and the
// hexagon's vertices reach out to r/cos(30°)). Fixed lattice orientation (pointy-top), the same for every bubble.
function honeyHexR(theta, r) {
  const seg = Math.PI / 3; let a = theta % seg; if (a < 0) a += seg; a -= seg / 2;
  return r / Math.cos(a);
}
// the bubble outline: a plain circle (shape 0) blended toward a true hexagon (shape 1), rounding the corners
// in between for free (the blend's own smooth transition from a constant radius to the hexagon's peaked one).
function honeyPath(ctx, cx, cy, r, shapeAmt) {
  ctx.beginPath();
  if (shapeAmt <= .02 || r < 3) { ctx.arc(cx, cy, r, 0, 6.2832); return; }
  const n = r > 36 ? 30 : r > 14 ? 18 : 10;
  for (let i = 0; i <= n; i++) {
    const phi = i / n * 6.283185307, rr = r * (1 - shapeAmt) + honeyHexR(phi, r) * shapeAmt;
    const x = cx + Math.cos(phi) * rr, y = cy + Math.sin(phi) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function honeycomb(host, opts = {}) {
  host.classList.add("hc");
  host.innerHTML = `<div class="hc-box"><div class="hc-vig"></div><canvas class="hc-cv" aria-label="Colors as bubbles: drag to browse, pinch to zoom, tap one to open it"></canvas></div>
    <button class="hc-cap"><i></i><span><b></b><small></small></span><em></em></button>`;
  const vig = host.querySelector(".hc-vig"), cv = host.querySelector("canvas"), ctx = cv.getContext("2d"), cap = host.querySelector(".hc-cap");
  const RM = reduceMotion, SHOOT = typeof SHOT !== "undefined" && !!SHOT, ZMAX = 2.5, ABS_ZMIN = .04, M = 2.2;
  let vigK = -1, vigOpSet = -1;
  let styleId = typeof opts.style === "string" ? opts.style : "current", liveTweak = opts.tweak ? { ...opts.tweak } : null;
  // back-compat: callers that still pass layout/lens/lensMode directly (colorsets.js, and any legacy caller).
  // These fold into liveTweak (not a one-off cfg mutation) so they survive setItems()'s re-resolve on every call.
  if (opts.layout) liveTweak = { ...(liveTweak || {}), layout: opts.layout === "wheel" ? "wheel" : opts.layout === "sunflower" ? "sunflower" : "mapTall" };
  if (opts.lensMode) liveTweak = { ...(liveTweak || {}), lensMode: opts.lensMode === "edges" ? "edges" : opts.lensMode === "none" ? "none" : "round" };
  if (opts.lens != null && !(liveTweak && liveTweak.m0 != null)) {
    const base0 = HONEY_STYLES[styleId] ? HONEY_STYLES[styleId].cfg : {}, pm0 = base0.m0 != null ? base0.m0 : HONEY_CFG_BASE.m0, pm1 = base0.m1 != null ? base0.m1 : HONEY_CFG_BASE.m1, lk = clamp(+opts.lens, 0, 2);
    liveTweak = { ...(liveTweak || {}), m0: pm1 + (pm0 - pm1) * Math.max(.12, lk) };
  }
  let cfg = honeyResolveCfg(styleId, liveTweak, (opts.items && opts.items.length) || 101);
  let lay = null, P = [0, 0], W = 0, Hh = 0, dpr = 1, base = 30, dead = false;
  let Z = clamp(+opts.zoom || 1, .04, ZMAX), zAnim = null, ghost = null, ghostT0 = 0;
  let phase = "idle", spring = null, touched = RM || SHOOT, visible = true, raf = 0, last = 0;
  let bloom = RM || SHOOT ? 1 : 0, bloomT0 = performance.now(), pressed = null, pressK = 0, drawn = [], center = null, settled = null;
  let ZMIN = .4;

  // ---- geometry ----
  // lensMode "round": a radial fisheye, biggest in the middle, shrinking smoothly all the way out (Apple Watch style).
  // "edges"/"none": the plane is flat; each screen axis is warped near its own edges (or, at flat=~1, not at all —
  //   "none" is just "edges" with the flat region stretched past the screen, i.e. uniform zoom, no distortion).
  const inner = () => cfg.lensMode === "none" ? .999 : clamp(cfg.flat, .25, .95);
  const warp = (u, a) => u <= a ? u : a + (1 - a) * (1 - Math.exp(-(u - a) / (1 - a)));
  const dwarp = (u, a) => u <= a ? 1 : Math.exp(-(u - a) / (1 - a));
  const unwarp = (v, a) => v <= a ? v : v >= .9999 ? 40 : a - (1 - a) * Math.log(1 - (v - a) / (1 - a));
  const lens = t => {
    const e = 1 - Math.pow(1 - bloom, 3), br = phase === "drift" ? 1 + .028 * Math.sin(t / 1000 * Math.PI * 2 / 3.8) : 1;
    const s = (.72 + .28 * e) * Z;
    return { s, a: e, m0: cfg.m0 * br, m1: cfg.m1, sig: cfg.sig, K: base * s * M * br, inner: inner() };
  };
  const F = (z, l) => base * l.s * (l.m1 * z + (l.m0 - l.m1) * l.sig * .8862 * honeyErf(z / l.sig));
  const magR = (z, l) => l.m1 + (l.m0 - l.m1) * Math.exp(-((z / l.sig) ** 2));            // radial derivative (F')
  const tanR = (z, l) => z ? (l.m1 * z + (l.m0 - l.m1) * l.sig * .8862 * honeyErf(z / l.sig)) / z : l.m0;   // tangential (F(z)/z, bare)
  // local bubble scale: blended between the radial derivative (fill 0, the old look — gaps open up in the outer
  // rings because the tangential spacing stays wider than the radial size) and the tangential spacing (fill 1).
  const localScale = (z, l) => Math.pow(magR(z, l), 1 - cfg.fill) * Math.pow(tanR(z, l), cfg.fill);
  const Finv = (r, l) => { let lo = 0, hi = 400; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (F(m, l) > r) hi = m; else lo = m; } return (lo + hi) / 2; };
  const centerK = l => cfg.lensMode === "round" ? base * l.s * l.m0 : l.K;
  const reach = l => {
    if (cfg.lensMode === "round") return Finv(Math.hypot(W, Hh) / 2 + 40, l);
    const um = l.inner + 3 * (1 - l.inner); return Math.hypot(um * W / 2, um * Hh / 2) / l.K + 1;
  };
  const pack = () => clamp(1 - cfg.gap, .55, 1);
  // zoom limits for a wrapping set. A manual zMinUser (preset or Tweak "Zoom-out limit") is a hard floor: once
  // reached it does not rubber-band back to a closer zoom ("stays that far out").
  const zFloor = () => {
    if (!lay || !W) return .4;
    const search = ok => { let lo = .03, hi = ZMAX; if (!ok(hi)) return ZMAX; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } return hi; };
    // a finite (non-wrapping) cluster has no "repeats" to hide, so its floor is just "the whole cluster fits on
    // screen with a little margin" — never so far out that 25 bubbles become a speck, but a big sunflower disc
    // (large N) still gets room to zoom out and show more of itself.
    if (lay.finite) {
      const R = lay.ext + 1.2;
      if (cfg.lensMode === "round") return clamp(search(z => Finv(Math.hypot(W, Hh) / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= R), ABS_ZMIN, .95);
      return clamp(search(z => Math.hypot(W, Hh) / 2 / (base * z * M) <= R), ABS_ZMIN, .95);
    }
    const fits = f => z => Finv(W / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= lay.perX * f && Finv(Hh / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= lay.perY * f;
    const a = inner(), u30 = a + 1.2 * (1 - a);
    const need = f => Math.max(u30 * W / 2 / (lay.perX * f), u30 * Hh / 2 / (lay.perY * f)) / (base * M);
    if (cfg.zMinUser != null) {
      // a small tile has too few unique bubbles per repeat: pushed past "clean" its copies line up into a
      // strongly periodic ring/moire (David: no eye-shaped artifact) rather than the glowing texture a big
      // tile gives. Below ~180 lattice points, cap the zoom-out at the ordinary clean-ish floor instead.
      if (lay.pts.length < 180) return cfg.lensMode === "round" ? clamp(search(fits(1.8)), .12, ZMAX) : clamp(need(1.8), .12, ZMAX);
      return clamp(+cfg.zMinUser, ABS_ZMIN, ZMAX);
    }
    if (cfg.lensMode === "round") return clamp(search(fits(1.5)), .15, search(fits(.5)));
    return clamp(need(1.5), ABS_ZMIN, clamp(need(.5), .15, ZMAX));
  };
  const offAt = (sx, sy, l) => {
    const dx = sx - W / 2, dy = sy - Hh / 2;
    if (cfg.lensMode === "round") { const r = Math.hypot(dx, dy); if (r < 1e-6) return [0, 0]; const z = Finv(r, l); return [dx / r * z, dy / r * z]; }
    const tx = dx / (W / 2), ty = dy / (Hh / 2);
    return [Math.sign(tx) * unwarp(Math.abs(tx), l.inner) * W / 2 / l.K, Math.sign(ty) * unwarp(Math.abs(ty), l.inner) * Hh / 2 / l.K];
  };
  function copies(p, Q, R, fn) {
    const dx = p.x - Q[0], dy = p.y - Q[1], R2 = R * R;
    if (lay.finite) { if (dx * dx + dy * dy < R2) fn(dx, dy); return; }
    const [a, b, c, d] = lay.inv, A = lay.A, B = lay.B;
    const al = Math.round(a * dx + b * dy), be = Math.round(c * dx + d * dy), K = Math.min(12, Math.ceil(R / lay.per) + 1);
    for (let i = al - K; i <= al + K; i++) for (let j = be - K; j <= be + K; j++) {
      const ex = dx - i * A[0] - j * B[0], ey = dy - i * A[1] - j * B[1];
      if (ex * ex + ey * ey < R2) fn(ex, ey);
    }
  }
  function nearestTo(Q) {
    let best = null, bd = Infinity;
    const R = lay.finite ? 1e9 : Math.max(2, lay.per);
    for (const p of lay.pts) copies(p, Q, R, (ex, ey) => { const d = ex * ex + ey * ey; if (d < bd) { bd = d; best = { p, x: Q[0] + ex, y: Q[1] + ey }; } });
    return best;
  }

  // ---- drawing ----
  function draw(t = performance.now()) {
    if (!lay || !W || dead) return;
    const l = lens(t), R = reach(l), cx = W / 2, cy = Hh / 2, hx = W / 2, hy = Hh / 2, ia = l.inner, round = cfg.lensMode === "round", pk = pack(), shapeAmt = cfg.shape;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    ctx.globalAlpha = l.a;
    drawn = [];
    let cbest = Infinity, cItem = null;
    for (const p of lay.pts) copies(p, P, R, (ex, ey) => {
      const z = Math.hypot(ex, ey);
      let x, y, d;
      if (round) { const k = z ? F(z, l) / z : base * l.s * l.m0; x = cx + ex * k; y = cy + ey * k; d = base * l.s * localScale(z, l) * pk; }
      else {
        const ux = Math.abs(ex * l.K / hx), uy = Math.abs(ey * l.K / hy), dwx = dwarp(ux, ia), dwy = dwarp(uy, ia);
        x = cx + Math.sign(ex) * warp(ux, ia) * hx; y = cy + Math.sign(ey) * warp(uy, ia) * hy;
        d = l.K * pk * (Math.min(dwx, dwy) * (1 - cfg.fill) + Math.sqrt(dwx * dwy) * cfg.fill);
      }
      if (x < -d || y < -d || x > W + d || y > Hh + d || d < 1.6) return;
      if (z < cbest) { cbest = z; cItem = p.it; }
      drawn.push({ it: p.it, x, y, d });
    });
    let pb = null;
    if (pressed) { const i = drawn.findIndex(b => b.it === pressed.it && Math.abs(b.x - pressed.x) < 3 && Math.abs(b.y - pressed.y) < 3); if (i >= 0) { pb = drawn.splice(i, 1)[0]; drawn.push(pb); } }
    for (const b of drawn) {
      const it = b.it, d = b.d * (b === pb ? 1 + .12 * pressK : 1), r = d / 2;
      honeyPath(ctx, b.x, b.y, r, shapeAmt); ctx.fillStyle = it.h; ctx.fill();
      if (d < 8) continue;
      if (it.L < 26) { ctx.lineWidth = Math.max(1, d * .025); ctx.strokeStyle = `rgba(236,232,223,${it.L < 14 ? .34 : .24})`; ctx.stroke(); }
      const la = Math.min(1, Math.max(0, (d - cfg.labelMin) / 5));
      if (la > 0) {
        const w = honeyWrap(ctx, it.n), fs = Math.min(w.fs * d, 30), lh = fs * 1.02;
        const sub = Math.min(1, Math.max(0, (d - 150) / 30)), subH = sub ? fs * .9 : 0;
        const y0 = b.y - (w.lines.length - 1) * lh / 2 + fs * .06 - subH / 2;
        ctx.font = `${fs}px "Instrument Serif",Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = it.ink; ctx.globalAlpha = l.a * la;
        w.lines.forEach((s, i) => ctx.fillText(s, b.x, y0 + i * lh));
        if (sub) {
          ctx.globalAlpha = l.a * sub * .72; ctx.font = `500 ${Math.min(13, d * .055)}px "Geist Mono",ui-monospace,monospace`;
          ctx.fillText(it.h, b.x, y0 + (w.lines.length - 1) * lh + fs * 1.05);
        }
        ctx.globalAlpha = l.a;
      }
    }
    ctx.globalAlpha = 1;
    if (ghost) {
      const a = 1 - (t - ghostT0) / 240;
      if (a > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(ghost, 0, 0); ctx.globalAlpha = 1; } else ghost.on = false;
      if (!ghost.on) ghost = null;
    }
    if (lay && !lay.finite) {
      const by = round ? Math.max(0, hy - F(lay.perY * .5, l)) : hy * (1 - warp(lay.perY * .5 * l.K / hy, ia)), bx = round ? Math.max(0, hx - F(lay.perX * .5, l)) : hx * (1 - warp(lay.perX * .5 * l.K / hx, ia));
      const key = Math.round(by) * 4096 + Math.round(bx);
      if (key !== vigK) {
        vigK = key;
        // the band grows to cover wherever the repeat seam actually falls (never capped to a thin edge strip):
        // at a shallow zoom-out the seam sits just past the edge and the band stays a soft frame; pushed far
        // out for a small set (David: no "eye-shaped lens on a tall phone"), the band can grow to the center so
        // the seam is never left showing as a bright, sharply bounded ring.
        vig.style.setProperty("--vy", clamp(by > 1 ? by + 110 : 0, 120, Hh * .5) + "px"); vig.style.setProperty("--vx", clamp(bx > 1 ? bx + 80 : 0, 56, W * .5) + "px");
      }
    }
    if (cfg.vig !== vigOpSet) { vigOpSet = cfg.vig; vig.style.opacity = cfg.vig; }
    if (cItem !== center) { center = cItem; caption(); }
  }
  function caption() {
    const it = center; if (!it) return;
    cap.querySelector("i").style.setProperty("--c", it.h);
    cap.querySelector("b").textContent = it.n;
    cap.querySelector("small").textContent = honeyWhere(it);
    cap.querySelector("em").textContent = it.h;
  }

  // ---- motion ----
  const kick = () => { if (!raf && visible && !dead) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  function loop(t) {
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (t - last) / 1000)); last = t;
    let more = false;
    if (zAnim) {
      const nz = Math.abs(zAnim.to - Z) < .003 ? zAnim.to : Z + (zAnim.to - Z) * Math.min(1, dt * (RM ? 60 : 11));
      zoomAround(nz, zAnim.sx, zAnim.sy);
      if (nz === zAnim.to) { zAnim = null; if (opts.onZoom) opts.onZoom(Z); if (!down && !pinch) snap(); } else more = true;
    }
    if (phase === "spring") {
      const s = spring, tau = (t - s.t0) / 1000, e = Math.exp(-s.w * tau);
      let off = 0;
      for (let k = 0; k < 2; k++) { const q = (s.A[k] + s.B[k] * tau) * e; P[k] = s.X[k] + q; off = Math.max(off, Math.abs(q)); }
      if (off < .002 && tau > .05) { P = s.X.slice(); phase = "idle"; spring = null; draw(t); settle(); } else more = true;
    } else if (phase === "drift") { if (!lay.finite) P[0] += .2 * cfg.drift * dt; more = true; }
    const pt = pressed ? 1 : 0;
    if (Math.abs(pressK - pt) > .01) { pressK += (pt - pressK) * Math.min(1, dt * 18); more = true; } else pressK = pt;
    if (bloom < 1) { bloom = Math.min(1, (t - bloomT0) / 700); more = true; }
    if (ghost) more = true;
    draw(t);
    if (more) kick();
  }
  const remember = () => { if (lay) HONEY_PAN = { key: lay.key, x: P[0], y: P[1], z: Z, name: center && center.n }; };
  function settle() {
    if (center && settled && center !== settled) buzz(4);
    settled = center; remember();
  }
  function snap(V = [0, 0]) {
    if (!lay) return;
    const sp = Math.hypot(V[0], V[1]), w = RM ? 30 : sp < 1.5 ? 9 : 2.7;
    const n = nearestTo([P[0] + V[0] / w, P[1] + V[1] / w]); if (!n) return;
    const X = [n.x, n.y], A = [P[0] - X[0], P[1] - X[1]];
    spring = { t0: performance.now(), X, A, B: [V[0] + w * A[0], V[1] + w * A[1]], w };
    phase = "spring"; kick();
  }
  function glideTo(sx, sy) {
    const o = offAt(sx, sy, lens(0)), X = [P[0] + o[0], P[1] + o[1]], A = [P[0] - X[0], P[1] - X[1]], w = RM ? 40 : 13;
    spring = { t0: performance.now(), X, A, B: [w * A[0], w * A[1]], w }; phase = "spring"; buzz(4); kick();
  }
  function zoomAround(z, sx, sy) {
    const l0 = lens(0), o0 = offAt(sx, sy, l0); Z = z;
    const o1 = offAt(sx, sy, lens(0));
    P = [P[0] + o0[0] - o1[0], P[1] + o0[1] - o1[1]];
  }
  const zoomTo = (to, sx = W / 2, sy = Hh / 2) => { phase = phase === "drift" ? "idle" : phase; spring = null; zAnim = { to: clamp(to, ZMIN, ZMAX), sx, sy }; kick(); };
  const rubber = z => z > ZMAX ? ZMAX * Math.pow(z / ZMAX, .3) : z < ZMIN ? ZMIN * Math.pow(z / ZMIN, .3) : z;

  // ---- input: drag with momentum, pinch or ctrl-wheel to zoom, double-tap to zoom in (again to reset) ----
  let down = null, pinch = null, lastTap = null, tapTimer = 0;
  const ptrs = new Map();
  const hit = (x, y) => { let best = null, bd = Infinity; for (const b of drawn) { const d = Math.hypot(b.x - x, b.y - y); if (d < b.d / 2 + 4 && d / b.d < bd) { bd = d / b.d; best = b; } } return best; };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", e => {
    if (!lay) return;
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]);
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (phase === "spring" || zAnim) loop(performance.now());
    phase = "drag"; spring = null; zAnim = null; touched = true;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = offAt(mid[0], mid[1], lens(0));
      pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), Z0: Z, W0: [P[0] + o[0], P[1] + o[1]], t0: performance.now(), moved: false };
      pressed = null; down = null; clearTimeout(tapTimer); kick(); return;
    }
    if (ptrs.size > 2 || pinch) return;
    const b = hit(x, y);
    pressed = b ? { it: b.it, x: b.x, y: b.y, b } : null;
    down = { x, y, P0: P.slice(), moved: false, hist: [[performance.now(), P[0], P[1]]] };
    kick();
  });
  cv.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]);
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (Math.abs(d - pinch.d0) > 8) pinch.moved = true;
      Z = rubber(pinch.Z0 * d / pinch.d0);
      const o = offAt(mid[0], mid[1], lens(0)); P = [pinch.W0[0] - o[0], pinch.W0[1] - o[1]];
      draw(); return;
    }
    if (!down) return;
    const dx = x - down.x, dy = y - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 7) { down.moved = true; pressed = null; kick(); }
    if (!down.moved) return;
    const k = centerK(lens(0)), now = performance.now();
    P = [down.P0[0] - dx / k, down.P0[1] - dy / k];
    if (lay.finite) {
      const r = Math.hypot(P[0], P[1]), ext = lay.ext + .6;
      if (r > ext) { const s = (ext + (r - ext) * .35) / r; P = [P[0] * s, P[1] * s]; }
    }
    down.hist.push([now, P[0], P[1]]); while (down.hist.length > 2 && now - down.hist[0][0] > 100) down.hist.shift();
    draw();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    const at = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (pinch) {
      if (ptrs.size) return;
      const p = pinch; pinch = null; phase = "idle";
      if (!p.moved && performance.now() - p.t0 < 260) return zoomTo(1);
      if (Z < ZMIN || Z > ZMAX) return zoomTo(clamp(Z, ZMIN, ZMAX), at[0], at[1]);
      if (opts.onZoom) opts.onZoom(Z);
      return snap();
    }
    if (!down) return;
    const d = down; down = null; phase = "idle";
    if (!d.moved) {
      const now = performance.now(), p = pressed, held = now - d.hist[0][0];
      if (p && opts.onPeek && held >= 480) { pressed = null; kick(); return opts.onPeek(p.it.o); }
      if (lastTap && now - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 36) {
        clearTimeout(tapTimer); lastTap = null; pressed = null; kick();
        return zoomTo(Z > 1.25 ? 1 : 2.1, d.x, d.y);
      }
      lastTap = { t: now, x: d.x, y: d.y };
      if (p && e.type === "pointerup") {
        const far = opts.centerFirst && Math.hypot(p.x - W / 2, p.y - Hh / 2) > p.b.d * .55;
        tapTimer = setTimeout(() => { pressed = null; kick(); if (far) glideTo(p.x, p.y); else open(p.it, p.b); }, far ? 0 : 240);
        return;
      }
      pressed = null; kick();
      return snap();
    }
    const h = d.hist, a = h[0], b = h[h.length - 1], dt = (b[0] - a[0]) / 1000;
    let V = performance.now() - b[0] > 70 || dt < .008 ? [0, 0] : [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
    const sp = Math.hypot(V[0], V[1]); if (sp > 40) V = [V[0] * 40 / sp, V[1] * 40 / sp];
    snap(V);
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  let wheelT = 0;
  cv.addEventListener("wheel", e => {
    if (!lay) return;
    const [x, y] = local(e);
    if (e.ctrlKey) { e.preventDefault(); touched = true; phase = "idle"; spring = null; zAnim = null; zoomAround(rubber(clamp(Z * Math.exp(-e.deltaY * .012), ZMIN * .8, ZMAX * 1.2)), x, y); }
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); touched = true; phase = "idle"; spring = null; const k = centerK(lens(0)); P = [P[0] + e.deltaX / k, P[1] + e.deltaY / k]; }
    else return;
    draw(); clearTimeout(wheelT);
    wheelT = setTimeout(() => { if (Z < ZMIN || Z > ZMAX) zoomTo(clamp(Z, ZMIN, ZMAX), x, y); else { if (opts.onZoom) opts.onZoom(Z); snap(); } }, 160);
  }, { passive: false });
  cap.onclick = () => { if (center) open(center, drawn.find(b => b.it === center)); };

  function open(it, b) {
    remember();
    const morph = () => {
      if (!b) return;
      const m = document.createElement("div"), r = b.d * 1.06;
      m.className = "hc-morph"; Object.assign(m.style, { left: b.x - r / 2 + "px", top: b.y - r / 2 + "px", width: r + "px", height: r + "px", background: it.h });
      cv.parentNode.appendChild(m); morphFrom(m); m.remove();
    };
    if (opts.pick) opts.pick(it.o, { morph });
  }

  // ---- contents ----
  function setItems(raw, focus, how) {
    raw = raw && raw.length ? raw : EVERY().map(c => ({ n: c.n, h: c.h, c }));
    if (how === "soft" && W && !RM) {
      ghost = ghost || document.createElement("canvas"); ghost.on = true;
      if (ghost.width !== cv.width || ghost.height !== cv.height) { ghost.width = cv.width; ghost.height = cv.height; }
      const g = ghost.getContext("2d"); g.clearRect(0, 0, ghost.width, ghost.height); g.drawImage(cv, 0, 0); ghostT0 = performance.now();
    }
    cfg = honeyResolveCfg(styleId, liveTweak, raw.length);
    lay = honeyLayout(raw, cfg.layout);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX);
    if (how === "restore" && HONEY_PAN && HONEY_PAN.key === lay.key) { P = [HONEY_PAN.x, HONEY_PAN.y]; if (!opts.zoom && HONEY_PAN.z) Z = HONEY_PAN.z; }
    else {
      const f = focus && (focus.h ? focus : BYNAME.get(String(focus.n || "").toLowerCase()));
      let p = f && lay.pts.find(q => q.it.n === f.n);
      if (!p && f && f.h) { const L = lab(f.h); let bd = Infinity; for (const q of lay.pts) { const dd = (q.it.lab[0] - L[0]) ** 2 + (q.it.lab[1] - L[1]) ** 2 + (q.it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; p = q; } } }
      if (lay.finite && how !== "soft") p = null;
      if (!p && lay.finite) p = lay.pts.reduce((m, q) => Math.hypot(q.x, q.y) < Math.hypot(m.x, m.y) ? q : m, lay.pts[0]);
      p = p || lay.pts[0];
      P = [p.x, p.y];
    }
    center = null; draw(); settled = center;
    phase = touched ? "idle" : "drift"; spring = null;
    if (how !== "soft" && !RM && !SHOOT) { bloom = 0; bloomT0 = performance.now(); }
    kick();
  }

  // ---- size, visibility, teardown ----
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(3, devicePixelRatio || 1);
    W = r.width; Hh = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    base = clamp(W / 13, 26, 34); ghost = null; ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting && !document.hidden; if (visible) kick(); }) : null;
  if (io) io.observe(host);
  const vis = () => { visible = !document.hidden; if (visible) kick(); };
  document.addEventListener("visibilitychange", vis);
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('16px "Instrument Serif"'), document.fonts.load('500 12px "Geist Mono"')]).then(() => { HONEY_WRAP.clear(); draw(); }).catch(() => {});
  function destroy() {
    if (dead) return;
    remember(); dead = true; clearTimeout(tapTimer); clearTimeout(wheelT);
    cancelAnimationFrame(raf); raf = 0; ro.disconnect(); if (io) io.disconnect();
    document.removeEventListener("visibilitychange", vis);
  }
  cleanup.push(destroy);
  host.addEventListener("honeyshot", e => {
    const act = e.detail, b = center && drawn.find(x => x.it === center);
    if (act === "tap" && center) open(center, b);
    if (act === "press" && b) { phase = "idle"; pressed = { it: center, x: b.x, y: b.y, b }; pressK = 1; draw(); }
    if (act === "zoomin") { Z = 2.3; draw(); }
    if (/^bench/.test(act)) {
      phase = "idle"; bloom = 1; if (act === "benchout") Z = ZMIN;
      const t0 = performance.now(), n = 240; for (let i = 0; i < n; i++) { P[0] += .037; P[1] += .021; draw(); }
      document.title = `bench ${((performance.now() - t0) / n).toFixed(2)}ms/frame, zoom ${Z}, ${drawn.length} drawn of ${lay.pts.length}`;
      fetch("bench?" + encodeURIComponent(document.title)).catch(() => {});
    }
  });
  resize();
  if (opts.style) { const p = HONEY_STYLES[styleId]; if (p && p.initialZoom && !opts.zoom) Z = p.initialZoom((opts.items && opts.items.length) || 101); }
  setItems(opts.items, opts.focus || (HONEY_PAN && { n: HONEY_PAN.name }), "restore");
  // ---- the Tweak panel's API: live overrides on top of the active preset, saved by the caller (S.hm.tweak) ----
  function applyTweak(partial) {
    liveTweak = { ...(liveTweak || {}), ...partial };
    cfg = honeyResolveCfg(styleId, liveTweak, lay ? lay.raw.length : 101);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  return {
    update(o = {}) {
      if (o.layout) liveTweak = { ...(liveTweak || {}), layout: o.layout === "wheel" ? "wheel" : o.layout === "sunflower" ? "sunflower" : "mapTall" };
      if (o.style && HONEY_STYLES[o.style]) styleId = o.style;
      setItems(o.items || (lay && lay.raw), o.focus || (center && center.o), o.soft ? "soft" : "");
    },
    zoom: (z, animate = true) => animate ? zoomTo(z) : (Z = clamp(z, ZMIN, ZMAX), draw()),
    // legacy back-compat shims (the pre-preset "Lens strength" / "Lens mode" controls, if anything still calls them)
    lens: k => { if (!(liveTweak && liveTweak.m0 != null)) { const base0 = (HONEY_STYLES[styleId] || HONEY_STYLES.current).cfg, pm0 = base0.m0 != null ? base0.m0 : HONEY_CFG_BASE.m0, pm1 = base0.m1 != null ? base0.m1 : HONEY_CFG_BASE.m1; applyTweak({ m0: pm1 + (pm0 - pm1) * Math.max(.12, clamp(+k, 0, 2)) }); } },
    lensMode: m => applyTweak({ lensMode: m === "edges" ? "edges" : m === "none" ? "none" : "round" }),
    tweak: applyTweak,
    resetTweak() { liveTweak = null; cfg = honeyResolveCfg(styleId, null, lay ? lay.raw.length : 101); ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw(); },
    style(id, keepTweak = true) {
      styleId = HONEY_STYLES[id] ? id : styleId;
      if (!keepTweak) liveTweak = null;
      const p = HONEY_STYLES[styleId];
      if (p && p.initialZoom) Z = p.initialZoom(lay ? lay.raw.length : 101);
      setItems(lay && lay.raw, center && center.o, "soft");
    },
    getStyle: () => styleId,
    getCfg: () => ({ style: styleId, tweak: liveTweak, resolved: cfg }),
    getTweak: () => liveTweak,
    current: () => center && center.o,
    destroy,
  };
}
