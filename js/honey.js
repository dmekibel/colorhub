"use strict";
// The honeycomb: one view mode of the color browser (js/colorsets.js), and the engine behind the honeycomb home
// (js/home.js). It shows ANY list of colors as bubbles on a hex lattice seen through a lens, drawn on one canvas so
// even the 2,700-name library stays smooth on a phone.
//
// A layout only wraps/tiles in a direction where the colors on both sides of the seam actually continue into one
// another; otherwise it stays finite (one cluster, spring-back at the edge):
//  - layout "mapWide" / "mapTall": hue runs left to right and wraps around — the hue sweep's own start and end sit
//    right next to each other (both near 15°), so the seam is a smooth hue step. Greys have no hue, so they're
//    spliced into the INTERIOR of the hue sweep, never at that wrap seam (a grey-to-saturated jump happens once,
//    not on every repeat). Lightness runs top to bottom and tiles mirrored (light, dark, light...), which is smooth
//    by construction (a reflection), so that direction keeps wrapping. "mapWide" is the original, wider tile;
//    "mapTall" (today's shipped look) is taller, like a phone.
//  - layout "wheel": greys in the middle, hue around, strength outward. Always finite — the hexagon-shaped wheel's
//    own cut edges don't match a neighboring copy's, so it doesn't tile.
//  - layout "sunflower": a golden-angle phyllotaxis disc, sorted by hue (angle) then lightness (radius). Always
//    finite — one cluster at every set size, 25 to 2,700.
//  - layout "globe": Runge's 1810 color sphere (hue = longitude, lightness = latitude, chroma = nearness to the
//    surface). A closed sphere has no edges at all, so there's nothing to seam — hue wraps around it for free.
//  Small sets (under HONEY_FINITE colors) on the map layout don't wrap either: they sit as one compact cluster and
//  spring back if you pull away.
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
  const hued = items.filter(it => it.C >= 7).sort((a, b) => honeyHueKey(a) - honeyHueKey(b));
  const greySeq = grey.map((it, i) => [i % gc, i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  // Greys go in the INTERIOR of the hue sweep, never appended at its end: honeyHueKey's own start and end are
  // already two close hues (both near 15°), which is exactly what should sit at the tile's wrap seam. A grey run
  // is a real jump (no hue to continue), so it happens once in the middle of a tile, not on every repeat.
  const mid = Math.floor(hued.length / 2);
  const order = hued.slice(0, mid).concat(greySeq, hued.slice(mid));
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
// ---------- Globe: Runge's 1810 color sphere. Hue = longitude (a sphere has no edge, so it wraps for free),
// lightness = latitude (y = -1 at the black pole, +1 at the white pole; greys sit on the axis through the
// middle), chroma pushes a color out toward the surface at that latitude (surf = the sphere's own radius there).
// Always finite — a closed surface, nothing to tile.
const HONEY_CHROMA_REF = 62;
// a stable (not random) hash of a name, for nudging apart points that would otherwise land exactly on top of
// each other: true greys all share r=0 regardless of hue, and honeyCells deliberately skips a pair it finds at
// ~0 distance (no direction to clip a seam along), so two coincident points would otherwise overlap outright.
function honeyNameHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function honeySphere(items) {
  const seen = new Map(), pts = [];
  for (const it of items) {
    const y = clamp((it.L - 50) / 50, -1, 1), surf = Math.sqrt(Math.max(0, 1 - y * y));
    let r = Math.min(1, it.C / HONEY_CHROMA_REF) * surf, lon = it.H * Math.PI / 180;
    // near-zero chroma: give it a small real radius (greys still read as "near the axis") and spread its angle
    // by a hash of its name, so a library's many near-identical greys at similar lightness don't collapse onto
    // the exact same point (atan2(b,a) returns 0 for every a=b=0 grey alike)
    if (r < .03) { r = .02 + .025 * Math.min(1, it.C); lon = honeyNameHash(it.n) * 6.283185307; }
    const key = Math.round(lon * 40) + "|" + Math.round(y * 60);
    const n = seen.get(key) || 0; seen.set(key, n + 1);
    if (n > 0) lon += n * .19 + .05;   // any remaining exact/near-exact tie: step it apart deterministically
    pts.push({ it, lon, y, r });
  }
  return { pts, globe: true, finite: true, ext: 1 };
}
const HONEY_MAP_K = { mapWide: 1 / 2.4, mapTall: .63 };
function honeyLayout(raw, layoutKey) {
  let hs = 2166136261; for (const o of raw) for (let i = 0; i < o.n.length; i++) { hs ^= o.n.charCodeAt(i); hs = Math.imul(hs, 16777619); }
  const key = `${layoutKey}|${raw.length}|${hs >>> 0}`;
  const hit = HONEY_LAYOUTS.get(key); if (hit && hit.raw === raw) return hit;
  const items = raw.map(honeyNorm);
  let lay;
  if (layoutKey === "globe") lay = honeySphere(items);
  else if (layoutKey === "sunflower") lay = honeySunflower(items);
  // the wheel's own cut edges never match a neighboring copy's, so (David's wrap rule) it stays finite always,
  // not just for small sets
  else if (layoutKey === "wheel") lay = Object.assign(honeyWheel(items), { finite: true });
  else if (items.length < HONEY_FINITE) lay = honeyCluster(items);
  else lay = honeyMap(items, HONEY_MAP_K[layoutKey] || HONEY_MAP_K.mapTall);
  if (lay.finite) { if (!lay.globe) lay.ext = Math.max(.5, ...lay.pts.map(p => Math.hypot(p.x, p.y))); }
  else { const [A, B] = [lay.A, lay.B], det = A[0] * B[1] - B[0] * A[1]; lay.inv = [B[1] / det, -B[0] / det, -A[1] / det, A[0] / det]; lay.per = Math.min(Math.hypot(...A), Math.hypot(...B)); lay.perX = lay.perX || lay.per; lay.perY = lay.perY || lay.per; }
  Object.assign(lay, { key, raw, items });
  if (HONEY_LAYOUTS.size > 24) HONEY_LAYOUTS.clear();
  HONEY_LAYOUTS.set(key, lay);
  return lay;
}

// ---------- the eight presets ----------
// Every field here is also a Tweak-panel slider (js/home.js hmTweakPanel): m0/m1/sig (Center/Outer/Falloff),
// fill, gap, shape, zMinUser (Zoom-out limit), vig (Vignette), labelMin, drift, lensMode, layout.
// gap: the seam between neighboring cells, in units of 20 px (.05 = 1 px), equal everywhere (honeyCells).
// far: how the style changes as you zoom all the way out. Each value is ADDED to the near value, scaled by how far
// out you are (0 at the starting zoom, 1 at the zoom-out limit), so a user's Tweak moves both ends together.
// alive: the one Motion slider David asked for (0 still, 1 default, 2 lively) — scales idle drift, the net's
// finger-lag flex and the water breathing/ripple together. Everything else (fill, vig, drift's base speed...)
// stays a lab-only knob.
const HONEY_CFG_BASE = { layout: "mapTall", lensMode: "round", m0: 3.7, m1: .82, sig: 1.9, fill: .5, gap: .05, shape: 0,
  zMinUser: null, vig: 1, labelMin: 26, drift: 1, flat: .7, alive: 1 };
const HONEY_STYLES = {
  original: { title: "Original", cfg: { layout: "mapWide", m0: 3.7, m1: 1.05, sig: 2.1, gap: .05, zMinUser: .11, labelMin: 24 },
    far: { m0: -.9, labelMin: -5, gap: -.02 } },
  current: { title: "Current", cfg: { layout: "mapTall", m0: 3.7, m1: 1.1, sig: 2.2, gap: .05, zMinUser: .1, labelMin: 23 },
    far: { m0: -.9, labelMin: -5, gap: -.02 } },
  edges: { title: "Edges", cfg: { layout: "mapTall", lensMode: "edges", flat: .68, gap: .05, zMinUser: .15, labelMin: 25 },
    far: { labelMin: -4 } },
  sunflower: { title: "Sunflower", cfg: { layout: "sunflower", m0: 2.3, m1: 1, sig: 2.4, gap: .06, zMinUser: .18, labelMin: 24, vig: 0 },
    far: { m0: .4, gap: -.03, labelMin: -4 } },
  wheel: { title: "Wheel", cfg: { layout: "wheel", m0: 3.4, m1: 1, sig: 2, gap: .05, zMinUser: .12, labelMin: 25 },
    far: { m0: -.7, labelMin: -4, gap: -.02 } },
  tapestry: { title: "Tapestry", cfg: { layout: "mapTall", m0: 3, m1: 1.3, sig: 2.6, gap: .04, shape: .45, zMinUser: .06, labelMin: 32, drift: .6 },
    far: { shape: .35, gap: -.02, m0: -.6 },
    sizeTune: N => ({ }), initialZoom: N => N >= 600 ? .22 : N >= 150 ? .32 : .42 },
  magnifier: { title: "Magnifier", cfg: { layout: "mapTall", m0: 5.6, m1: .6, sig: 1.2, gap: .05, zMinUser: .25, labelMin: 22 },
    far: { m0: -1.8, sig: .5, labelMin: -4 } },
  honeycomb: { title: "Honeycomb", cfg: { layout: "mapTall", lensMode: "round", m0: 2.6, m1: 1, sig: 2.4, shape: 1, gap: .03, zMinUser: .08, labelMin: 30, drift: .4, vig: .6 },
    far: { m0: -.8, gap: -.02, labelMin: -6 } },
  globe: { title: "Globe", cfg: { layout: "globe", lensMode: "none", gap: .05, shape: 0, zMinUser: .5, labelMin: 32, vig: 0 },
    far: { labelMin: -8 } },
};
const HONEY_MAX_DRAWN = 3000;   // phones stay smooth and safe; see the draw loop
// motion (net lag + water breathe/ripple) is skipped past this many drawn bubbles, so it stays fast at the
// biggest, most zoomed-out sets too — idle drift is unaffected (it only ever moves one pan value, not per-bubble)
const HONEY_MOTION_BUDGET = Math.round(HONEY_MAX_DRAWN * .5);
const HONEY_ALIVE_MAX = 1500;   // above this many drawn bubbles: no idle drift or water at all (see the loop)
// the five styles the home's View panel shows (ROADMAP: "fewer choices, chosen well"); the rest (Current, Edges,
// Wheel, Tapestry) stay reachable only from the honeycomb lab (#/lab/honey), which still steps through all of them
// The Globe stays in the lab until its colors are spread evenly over the sphere (today they bunch up and leave
// bare patches); see NOTES-TRACKER.md.
const HM_HOME_STYLES = ["original", "honeycomb", "sunflower", "magnifier"];
const HONEY_STYLE_LIST = Object.keys(HONEY_STYLES).map(id => ({ id, title: HONEY_STYLES[id].title }));
function honeyResolveCfg(styleId, tweak, N) {
  const preset = HONEY_STYLES[styleId] || HONEY_STYLES.current;
  let cfg = { ...HONEY_CFG_BASE, ...preset.cfg };
  if (preset.sizeTune) cfg = { ...cfg, ...preset.sizeTune(N) };
  if (tweak) cfg = { ...cfg, ...tweak };
  cfg.far = preset.far || {};
  cfg.fill = clamp(+cfg.fill, 0, 1); cfg.shape = clamp(+cfg.shape, 0, 1); cfg.gap = clamp(+cfg.gap, 0, .5);
  cfg.vig = clamp(+cfg.vig, 0, 1); cfg.drift = Math.max(0, +cfg.drift); cfg.alive = clamp(+cfg.alive, 0, 2);
  return cfg;
}
// a compact summary of a resolved cfg, for the lab screen's "Copy my ratings" / Tweak panel's "Copy settings"
function honeyCfgSummary(styleId, tweak) { return { style: styleId, tweak: tweak || null }; }

// ---------- the lens ----------
const honeyEaseS = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);   // smoothstep: 0 and 0-slope at both ends
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
    return [u ? `Unit ${u.i + 1}` : "A basic word", s ? (isMine(s) ? "you know it" : "learning") : ""].filter(Boolean).join(" · ");
  }
  return (it.lib && srcLine(it.lib)) || "Name library";
}
// a regular hexagon's radial boundary at angle theta (radians), apothem = r (so flat-to-flat width = 2r, and the
// hexagon's vertices reach out to r/cos(30°)). Fixed lattice orientation (pointy-top), the same for every bubble.
// r = the hexagon's apothem (center to the middle of a side). Sides face 0°, 60°, 120°... which is where the lattice's
// neighbors sit, so neighboring hexagons meet side to side (corners toward neighbors left triangular gaps and overlaps).
function honeyHexR(theta, r) {
  const seg = Math.PI / 3; let a = (theta + seg / 2) % seg; if (a < 0) a += seg; a -= seg / 2;
  return r / Math.cos(a);
}
// how far a bubble's outline reaches from its center toward angle theta (circle, hexagon or the blend between)
const honeyExtent = (theta, r, shapeAmt) => shapeAmt <= .02 ? r : r * (1 - shapeAmt) + honeyHexR(theta, r) * shapeAmt;
// Cells, not separately sized bubbles. Each bubble's area is its Voronoi cell: the part of the screen closer to its
// center than to any neighbor's, clipped back from every neighbor by half the gap. So neighbors meet along a seam of
// exactly `gapPx` everywhere, at the center and at the edges alike, and whatever the lens does to the spacing:
//   shape 1 = the cell itself (a true honeycomb, corners included, following the magnification)
//   shape 0 = the largest circle that fits in the cell (touching its nearest neighbors across the same gap)
//   between = the circle blended toward the cell, so the corners round off
// A bubble at the edge of what's drawn (neighbors culled) is also bounded by its own lens size, so it never balloons.
function honeyCells(drawn, gapPx, shapeAmt = 0, grow = .52) {   // grow: how far a bubble may swell past its own lens size, as a fraction of its diameter
  if (!drawn.length) return;
  // Speed: the grid is sized to a TYPICAL bubble (not the biggest, which put thousands of tiny ones in every lookup),
  // and each bubble searches only as many cells as its own size needs. Tiny bubbles (under ~7 px) skip the cell
  // clipping altogether: at that size a slightly smaller circle is indistinguishable and costs nothing.
  const ds = drawn.map(b => b.d).sort((a, c) => a - c), typ = ds[Math.floor(ds.length / 2)] || 8, maxD = ds[ds.length - 1] || 8;
  const cell = Math.max(4, typ * 1.3), grid = new Map(), key = (i, j) => i * 100003 + j;
  drawn.forEach((b, n) => { const k = key(Math.floor(b.x / cell), Math.floor(b.y / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); });
  const half = gapPx / 2;
  drawn.forEach((b, n) => {
    if (b.d < 7) { b.poly = null; b.rin = Math.max(0, b.d * .44 - half); b.d0 = b.d; b.d = 2 * b.rin; return; }
    const reach = Math.min(12, Math.ceil((b.d + maxD) * .75 / cell));
    // start from a 16-gon a little bigger than the bubble's own lens size
    const R0 = b.d * Math.max(.62, grow * 1.2); let poly = [];
    const ci0 = Math.floor(b.x / cell), cj0 = Math.floor(b.y / cell);
    // circles (shape 0) only need the cell's inscribed circle: the nearest bisector. No polygon clipping, which is
    // most of the cost on big sets (and what made panning 2,700 colors janky on a phone).
    if (shapeAmt <= .02) {
      let r = R0 * .98;
      for (let i = ci0 - reach; i <= ci0 + reach; i++) for (let j = cj0 - reach; j <= cj0 + reach; j++) {
        const a = grid.get(key(i, j)); if (!a) continue;
        for (const m of a) {
          if (m === n) continue;
          const o = drawn[m], dist = Math.hypot(o.x - b.x, o.y - b.y);
          if (dist < 1e-6 || dist > (b.d + o.d) * .75) continue;
          (b.nb || (b.nb = [])).push([m, dist]);
          if (dist / 2 - half < r) r = dist / 2 - half;
        }
      }
      b.poly = null; b.rin = Math.max(0, r); b.d0 = b.d; b.d = 2 * b.rin; return;
    }
    for (let i = 0; i < 16; i++) { const t = i / 16 * 6.283185307; poly.push([Math.cos(t) * R0, Math.sin(t) * R0]); }
    const ci = Math.floor(b.x / cell), cj = Math.floor(b.y / cell);
    for (let i = ci - reach; i <= ci + reach && poly.length; i++) for (let j = cj - reach; j <= cj + reach && poly.length; j++) {
      const a = grid.get(key(i, j)); if (!a) continue;
      for (const m of a) {
        if (m === n) continue;
        const o = drawn[m], vx = o.x - b.x, vy = o.y - b.y, dist = Math.hypot(vx, vy);
        if (dist < 1e-6 || dist > (b.d + o.d) * .75) continue;
        (b.nb || (b.nb = [])).push([m, dist]);
        const ux = vx / dist, uy = vy / dist, lim = dist / 2 - half;
        // keep the side of the bisector (moved back by half the gap) that faces this bubble
        const out = [];
        for (let k = 0; k < poly.length; k++) {
          const p = poly[k], q = poly[(k + 1) % poly.length], dp = p[0] * ux + p[1] * uy - lim, dq = q[0] * ux + q[1] * uy - lim;
          if (dp <= 0) out.push(p);
          if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
        }
        poly = out;
      }
    }
    // the inscribed circle: the nearest edge line to the center
    let rin = Infinity;
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], len = Math.hypot(ex, ey);
      if (len < 1e-9) continue;
      rin = Math.min(rin, Math.abs(p[0] * ey - p[1] * ex) / len);
    }
    b.poly = poly.length >= 3 ? poly : null; b.rin = isFinite(rin) && b.poly ? rin : 0; b.d0 = b.d; b.d = 2 * b.rin;
  });
  // Circles: a small bubble leaves room in its cell that its bigger neighbor can use (the Magnifier's center next to
  // its smaller first ring). Grow each circle, center outward, until it meets its neighbors across the gap, never past
  // its own lens size. Every step keeps r_a + r_b <= distance - gap, so circles still never overlap.
  if (shapeAmt <= .02) {
    const cx = drawn.reduce((t, b) => t + b.x, 0) / drawn.length, cy = drawn.reduce((t, b) => t + b.y, 0) / drawn.length;
    const order = drawn.map((b, n) => n).sort((a, c) => Math.hypot(drawn[a].x - cx, drawn[a].y - cy) - Math.hypot(drawn[c].x - cx, drawn[c].y - cy));
    for (let pass = 0; pass < 2; pass++) for (const n of order) {
      const b = drawn[n]; if (!b.nb) continue;
      let lim = b.d0 * grow;
      for (const [m, dist] of b.nb) lim = Math.min(lim, dist - gapPx - drawn[m].rin);
      b.rin = Math.max(0, lim); b.d = 2 * b.rin;
    }
  }
}
// distance from the cell's center to its edge toward angle t (a ray against the convex polygon)
function honeyRay(poly, t) {
  const dx = Math.cos(t), dy = Math.sin(t); let best = Infinity;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const s = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den;
    if (s > 0 && u >= -1e-9 && u <= 1 + 1e-9 && s < best) best = s;
  }
  return isFinite(best) ? best : 0;
}
// the bubble outline from its cell: the inscribed circle (shape 0), the cell (shape 1), or the blend
function honeyCellPath(ctx, b, shapeAmt, grow = 1) {
  ctx.beginPath();
  const r = b.rin * grow;
  if (!b.poly || shapeAmt <= .02 || r < 3) { ctx.arc(b.x, b.y, Math.max(0, r), 0, 6.2832); return; }
  if (shapeAmt >= .98) { b.poly.forEach((p, i) => { const x = b.x + p[0] * grow, y = b.y + p[1] * grow; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); return; }
  const n = r > 36 ? 36 : r > 14 ? 24 : 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n * 6.283185307, rr = (b.rin * (1 - shapeAmt) + honeyRay(b.poly, t) * shapeAmt) * grow;
    const x = b.x + Math.cos(t) * rr, y = b.y + Math.sin(t) * rr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
// Select mode (L23, js/favs.js): a picked bubble glows white and carries a small paper heart. Drawn after every
// bubble, so a ring is never covered by its neighbor.
function honeyPicked(ctx, b, shapeAmt, a) {
  const d = b.d, r = d / 2;
  ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = "round";
  honeyCellPath(ctx, b, shapeAmt, 1);
  ctx.shadowColor = "rgba(255,255,255,.6)"; ctx.shadowBlur = Math.max(6, d * .2);
  ctx.lineWidth = Math.max(2.5, d * .05); ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
  ctx.shadowBlur = 0;
  const br = Math.max(6.5, Math.min(15, d * .15)), bx = b.x + r * .6, by = b.y - r * .6, s = br * .52;
  ctx.fillStyle = "#EFEBE3"; ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.2832); ctx.fill();
  ctx.fillStyle = "#141311"; ctx.beginPath(); ctx.moveTo(bx, by + s * .95);
  ctx.bezierCurveTo(bx - s * 1.4, by + s * .1, bx - s * 1, by - s, bx, by - s * .38);
  ctx.bezierCurveTo(bx + s * 1, by - s, bx + s * 1.4, by + s * .1, bx, by + s * .95); ctx.fill();
  ctx.restore();
}
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

// ---- a highlighted constellation (js/colorset.js csOnMap): any set of hexes lights up on the honeycomb home ----
// honeyHighlight(hexes, { title }) dims every bubble but the nearest one to each hex; honeyHighlight(null) clears it.
// Only the home honeycomb (inside .hm) listens; a pill at the bottom names the set and clears it on tap.
let HONEY_HL = null, HONEY_HL_REV = 0;
const HONEY_LIVE = new Set();
function honeyHighlight(hexes, o = {}) {
  const hs = (hexes || []).map(h => String(h).toUpperCase()).filter(h => /^#[0-9A-F]{6}$/.test(h));
  HONEY_HL = hs.length ? { hexes: hs, title: o.title || "", rev: ++HONEY_HL_REV, fresh: true } : null;
  HONEY_LIVE.forEach(f => { if (f() === false) HONEY_LIVE.delete(f); });
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
  if (opts.layout) liveTweak = { ...(liveTweak || {}), layout: ["wheel", "sunflower", "globe"].includes(opts.layout) ? opts.layout : "mapTall" };
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
  // ---- "alive" motion state: idle drift (wanders after a pause), the net's finger-lag (Plag chases P, always),
  // water's tap ripples, and the panel inset (ctrl.setInset, so a bottom sheet never covers the magnified middle)
  let Plag = [0, 0], lastInput = performance.now(), driftT0 = 0, driftTeff = 0, driftAnchor = [0, 0], touchXY = null, ripples = [];
  let insetBottom = 0, insetCur = 0;
  // per-bubble size memory, so a bubble never snaps to a new size (cells change as neighbors come and go): sizes ease
  let sizeMem = new Map(), sizeT = 0, sizeRaf = 0, glided = null;   // glided: the item a tap last brought to the middle
  const vy = () => Math.max(60, Hh - insetCur);   // the visible height above whatever panel is inset
  const vcy = () => vy() / 2;

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
    return { s, a: e, m0: zc("m0") * br, m1: zc("m1"), sig: zc("sig"), K: base * s * M * br, inner: inner() };
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
    if (cfg.lensMode === "round") return Finv(Math.hypot(W, vy()) / 2 + 40, l);
    const um = l.inner + 3 * (1 - l.inner); return Math.hypot(um * W / 2, um * vy() / 2) / l.K + 1;
  };
  const pack = () => 1;   // spacing now comes from the cells (honeyCells); this only bounds bubbles at the drawn edge
  const gapPx = () => clamp(zc("gap"), 0, .45) * 20;   // the seam between neighbors, in px (0-9), equal everywhere
  // a style value at the current zoom: the near value plus its "far" change, scaled by how far out you are
  function zc(k) {
    const d = cfg.far && cfg.far[k]; if (!d) return cfg[k];
    const p = HONEY_STYLES[styleId], zs = p && p.initialZoom ? p.initialZoom(lay ? lay.raw.length : 101) : 1;
    const z0 = Math.max(ZMIN + .01, Math.min(ZMAX, zs)), t = clamp((z0 - Z) / Math.max(.01, z0 - ZMIN), 0, 1);
    const v = cfg[k] + d * t;
    return k === "shape" ? clamp(v, 0, 1) : k === "m0" ? Math.max(cfg.m1 + .05, v) : Math.max(0, v);
  }
  // zoom limits for a wrapping set. A manual zMinUser (preset or Tweak "Zoom-out limit") is a hard floor: once
  // reached it does not rubber-band back to a closer zoom ("stays that far out").
  const zFloor = () => {
    if (!lay || !W) return .4;
    if (lay.globe) return .5;   // a sphere's own math (not F/Finv) sizes it; a fixed, generous range is enough
    const search = ok => { let lo = .03, hi = ZMAX; if (!ok(hi)) return ZMAX; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } return hi; };
    // a finite (non-wrapping) cluster has no "repeats" to hide, so its floor is just "the whole cluster fits on
    // screen with a little margin" — never so far out that 25 bubbles become a speck, but a big sunflower disc
    // (large N) still gets room to zoom out and show more of itself.
    if (lay.finite) {
      const R = lay.ext + 1.2;
      if (cfg.lensMode === "round") return clamp(search(z => Finv(Math.hypot(W, vy()) / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= R), ABS_ZMIN, .95);
      return clamp(search(z => Math.hypot(W, vy()) / 2 / (base * z * M) <= R), ABS_ZMIN, .95);
    }
    const fits = f => z => Finv(W / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= lay.perX * f && Finv(vy() / 2, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= lay.perY * f;
    const a = inner(), u30 = a + 1.2 * (1 - a);
    const need = f => Math.max(u30 * W / 2 / (lay.perX * f), u30 * vy() / 2 / (lay.perY * f)) / (base * M);
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
    const dx = sx - W / 2, dy = sy - vcy();
    if (cfg.lensMode === "round") { const r = Math.hypot(dx, dy); if (r < 1e-6) return [0, 0]; const z = Finv(r, l); return [dx / r * z, dy / r * z]; }
    const tx = dx / (W / 2), ty = dy / (vy() / 2);
    return [Math.sign(tx) * unwarp(Math.abs(tx), l.inner) * W / 2 / l.K, Math.sign(ty) * unwarp(Math.abs(ty), l.inner) * vy() / 2 / l.K];
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
  // Flat layouts (map/wheel/sunflower, round or edges lens): the existing fisheye/warp math, unchanged.
  function buildFlatDrawn(l, t) {
    const R = reach(l), cx = W / 2, cy = vcy(), hx = W / 2, hy = vy() / 2, ia = l.inner, round = cfg.lensMode === "round", pk = pack();
    drawn = []; let tinyN = 0, cbest = Infinity, cItem = null;
    for (const p of lay.pts) copies(p, P, R, (ex, ey) => {
      const z = Math.hypot(ex, ey);
      let x, y, d;
      if (round) { const k = z ? F(z, l) / z : base * l.s * l.m0; x = cx + ex * k; y = cy + ey * k; d = base * l.s * localScale(z, l) * pk; }
      else {
        const ux = Math.abs(ex * l.K / hx), uy = Math.abs(ey * l.K / hy), dwx = dwarp(ux, ia), dwy = dwarp(uy, ia);
        x = cx + Math.sign(ex) * warp(ux, ia) * hx; y = cy + Math.sign(ey) * warp(uy, ia) * hy;
        d = l.K * pk * (Math.min(dwx, dwy) * (1 - cfg.fill) + Math.sqrt(dwx * dwy) * cfg.fill);
      }
      if (x < -d || y < -d || x > W + d || y > Hh + d) return;
      if (d < 2.2) { tinyN++; return; }
      if (z < cbest) { cbest = z; cItem = p.it; }
      drawn.push({ it: p.it, x, y, d, z, k: p.it.n + "|" + Math.round((P[0] + ex) * 8) + "|" + Math.round((P[1] + ey) * 8) });
    });
    // Safety: never draw more than ~5,000 bubbles. Far out on a big set some styles reached 50,000-120,000, which ran
    // a phone out of memory (a white or black screen). Past the budget, the zoom-out limit moves in to this zoom.
    // and never so far out that the screen is mostly specks too small to draw: move the limit in instead
    if (tinyN > drawn.length * 3 && tinyN > 800 && Z < ZMAX) { ZMIN = Math.min(ZMAX, Math.max(ZMIN, Z * 1.25)); if (Z < ZMIN) { Z = ZMIN; zAnim = null; requestAnimationFrame(() => draw()); } }
    if (drawn.length > HONEY_MAX_DRAWN) { ZMIN = Math.min(ZMAX, Math.max(ZMIN, Z * Math.sqrt(drawn.length / HONEY_MAX_DRAWN))); drawn.length = HONEY_MAX_DRAWN; if (Z < ZMIN) { Z = ZMIN; zAnim = null; requestAnimationFrame(() => draw()); } }
    cItemCur = cItem;
  }
  // Globe: an orthographic projection of Runge's sphere (honeyLayout's honeySphere). P doubles as [yaw, pitch]
  // (radians) here instead of a plane offset — see the pointer handlers and zoomAround below, which branch on
  // lay.globe. Foreshortening toward the rim needs no extra size math: honeyCells sizes every bubble from its
  // real neighbor spacing in screen space, and projection alone already packs the rim's neighbors tighter.
  let cItemCur = null;
  function buildGlobeDrawn(l, t) {
    const cx = W / 2, cy = vcy(), Rpx = Math.min(W, vy()) * .42 * Z;
    const yaw = P[0], pitch = clamp(P[1], -1.5, 1.5);
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const seedD = Math.max(10, Rpx * .17);
    drawn = []; let cbest = -Infinity, cItem = null;
    for (const p of lay.pts) {
      // lon=0 faces the camera (at yaw=pitch=0): X=sin(lon), Z=cos(lon), so it projects to screen-center with
      // maximal depth — not the sphere's side. The camera sits on +Z looking toward the origin; a point is on
      // the visible near hemisphere when its rotated Z (z2) is positive.
      const x0 = p.r * Math.sin(p.lon), z0 = p.r * Math.cos(p.lon), y0 = p.y;
      const x1 = x0 * cosY + z0 * sinY, z1 = -x0 * sinY + z0 * cosY;
      const y2 = y0 * cosP - z1 * sinP, z2 = y0 * sinP + z1 * cosP;
      if (z2 < 0) continue;   // the far hemisphere stays hidden
      const sx = cx + x1 * Rpx, sy = cy - y2 * Rpx;
      if (sx < -seedD || sy < -seedD || sx > W + seedD || sy > Hh + seedD) continue;
      if (z2 > cbest) { cbest = z2; cItem = p.it; }
      drawn.push({ it: p.it, x: sx, y: sy, d: seedD, z: Math.hypot(sx - cx, sy - cy) });
    }
    cItemCur = cItem;
  }
  // net (the finger-lag flex) + water (the breathing wave and tap ripples): shared by every layout, applied to
  // the final screen positions/sizes before honeyCells, so the no-gap/no-overlap guarantee always still holds.
  // Skipped past HONEY_MOTION_BUDGET bubbles, and for the net, on the globe (its rotation has no flat "pan" to lag).
  // Calibrated to David's "subtle, beautiful, calm — never jittery" pass: net lag caps at 4% of a bubble's own
  // spacing (8% at alive 2), water breathes at most 1% (2% at alive 2) over an 9s period, and a tap's ripple is
  // one soft +3% pulse confined to the tapped bubble's immediate neighbors (a Gaussian sized to its own
  // footprint), fully gone by ~0.6s — not a wave that travels the whole field. Nothing here is per-bubble random;
  // every term is a smooth function of shared state (the lag vector, time, or distance from one shared point), so
  // the field moves as one coherent sheet, never bubbles shaking independently.
  function applyMotion(l, t) {
    ripples = ripples.filter(r => t - r.t0 < 650);
    if (RM || SHOOT || cfg.alive <= 0 || !drawn.length || drawn.length > HONEY_MOTION_BUDGET) return;
    const lagX = P[0] - Plag[0], lagY = P[1] - Plag[1], kk = centerK(l);
    const lvx = lagX * kk, lvy = lagY * kk;
    const doNet = !lay.globe && Math.hypot(lvx, lvy) > .02;
    const fx = touchXY ? touchXY[0] : W / 2, fy = touchXY ? touchXY[1] : vcy(), half = Math.max(W, Hh) * .5;
    const per = 9, waterK = .55, amp = .01 * cfg.alive;
    for (const b of drawn) {
      if (doNet) {
        const dist = Math.hypot(b.x - fx, b.y - fy), factor = clamp(dist / half, 0, 1);
        let ox = -lvx * factor, oy = -lvy * factor;
        const cap = Math.max(1, b.d * .04 * cfg.alive), mag = Math.hypot(ox, oy);
        if (mag > cap) { const s = cap / mag; ox *= s; oy *= s; }
        b.x += ox; b.y += oy;
      }
      let mult = 1 + amp * Math.sin(t / 1000 * (2 * Math.PI / per) - b.z * waterK);
      for (const rp of ripples) {
        const age = t - rp.t0; if (age > 600) continue;
        const dist = Math.hypot(b.x - rp.x, b.y - rp.y), spatial = Math.exp(-(dist * dist) / (2 * rp.sigma * rp.sigma)), fade = 1 - age / 600;
        mult *= 1 + .03 * cfg.alive * spatial * fade;
      }
      b.d *= mult;
    }
  }
  // the render tail every layout shares: cells, fill/stroke/labels, the pressed lift, the ghost crossfade, the
  // repeat-seam vignette (only for a wrapping layout — a finite one, globe included, has no seam to hide) and caption
  function finishFrame(l, t) {
    const shapeAmt = zc("shape");
    applyMotion(l, t);
    honeyCells(drawn, gapPx(), shapeAmt);
    // No snapping (David): a bubble's size eases to its new value over ~120 ms instead of jumping when its cell
    // changes. New bubbles (just entered the screen) start at their size; growth eases too.
    const dt = sizeT ? Math.min(100, t - sizeT) : 0; sizeT = t;
    // Only growth eases: a bubble whose cell just got smaller (a slider, a zoom) takes its new size at once, so two
    // bubbles never overlap mid-change (David: sliding the center size overlapped until the next pan). And while
    // any bubble is still growing toward its size, keep drawing frames so it finishes even when nothing else moves.
    const ease = RM ? 1 : 1 - Math.exp(-dt / 120), mem = new Map();
    let easing = false;
    for (const b of drawn) {
      if (!b.k) continue;
      const prev = sizeMem.get(b.k);
      if (prev != null && dt > 0 && prev < b.rin) {
        const r = prev + (b.rin - prev) * ease, f = b.rin > 0 ? r / b.rin : 1;
        if (b.rin - r > .3) easing = true;
        if (b.poly && Math.abs(f - 1) > .001) b.poly = b.poly.map(q => [q[0] * f, q[1] * f]);
        b.rin = r; b.d = 2 * r;
      }
      mem.set(b.k, b.rin);
    }
    sizeMem = mem;
    if (easing && !sizeRaf) sizeRaf = requestAnimationFrame(() => { sizeRaf = 0; if (!raf) draw(); });
    let pb = null;
    if (pressed) { const i = drawn.findIndex(b => b.it === pressed.it && Math.abs(b.x - pressed.x) < 3 && Math.abs(b.y - pressed.y) < 3); if (i >= 0) { pb = drawn.splice(i, 1)[0]; drawn.push(pb); } }
    const hlSet = hlItems();
    for (const b of drawn) {
      const it = b.it, d = b.d * (b === pb ? 1 + .12 * pressK : 1), r = d / 2;
      honeyCellPath(ctx, b, shapeAmt, b === pb ? 1 + .12 * pressK : 1); ctx.fillStyle = it.h; ctx.fill();
      if (hlSet) { if (!hlSet.has(it)) { ctx.fillStyle = "rgba(14,13,11,.8)"; ctx.fill(); continue; } ctx.lineWidth = Math.max(1.5, d * .03); ctx.strokeStyle = "rgba(239,235,227,.95)"; ctx.stroke(); }
      if (d < 8) continue;
      if (it.L < 26) { ctx.lineWidth = Math.max(1, d * .025); ctx.strokeStyle = `rgba(236,232,223,${it.L < 14 ? .34 : .24})`; ctx.stroke(); }
      const la = Math.min(1, Math.max(0, (d - zc("labelMin")) / 5));
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
    if (sel) for (const b of drawn) if (b.d >= 10 && sel.isOn(b.it.o)) honeyPicked(ctx, b, shapeAmt, l.a);
    if (ghost) {
      const a = 1 - (t - ghostT0) / 240;
      if (a > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(ghost, 0, 0); ctx.globalAlpha = 1; } else ghost.on = false;
      if (!ghost.on) ghost = null;
    }
    if (lay && !lay.finite) {
      const round = cfg.lensMode === "round", ia = l.inner, hx = W / 2, hy = vy() / 2;
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
    if (cItemCur !== center) { center = cItemCur; caption(); }
  }
  function draw(t = performance.now()) {
    if (!lay || !W || dead) return;
    const l = lens(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh); ctx.globalAlpha = l.a;
    if (lay.globe) buildGlobeDrawn(l, t); else buildFlatDrawn(l, t);
    finishFrame(l, t);
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
    // big sets stay still unless touched: every animated frame recomputes thousands of cells (2,700 felt janky)
    const ALIVE = !RM && !SHOOT && cfg.alive > 0 && drawn.length <= HONEY_ALIVE_MAX && (lay ? lay.raw.length : 0) <= 1200;
    // Idle drift: after ~4s with no touch, wander around where you left it, easing in over ~1.5s. Calm by
    // design (David: "gently floating", never "moving a lot") — the speed is driven directly (not a position
    // formula's derivative, which can spike mid-ease), so it's hard-bounded at ~4.2px/s at alive 1, ~8.4px/s at
    // alive 2, measured in tools/_qa/drift_check.js. A globe instead just spins slowly (no wandering off a tilt).
    // Any touch changes `phase` away from "idle"/"drift" immediately, which stops this.
    if (phase === "idle" && ALIVE && !down && !pinch && (t - lastInput) > 4000) { phase = "drift"; driftT0 = t; driftTeff = 0; driftAnchor = P.slice(); }
    if (zAnim) {
      const nz = Math.abs(zAnim.to - Z) < .003 ? zAnim.to : Z + (zAnim.to - Z) * Math.min(1, dt * (RM ? 60 : 11));
      zoomAround(nz, zAnim.sx, zAnim.sy);
      if (nz === zAnim.to) { zAnim = null; if (opts.onZoom) opts.onZoom(Z); if (!down && !pinch && !lay.globe) snap(); } else more = true;
    }
    if (phase === "spring") {
      const s = spring, tau = (t - s.t0) / 1000, e = Math.exp(-s.w * tau);
      let off = 0;
      for (let k = 0; k < 2; k++) { const q = (s.A[k] + s.B[k] * tau) * e; P[k] = s.X[k] + q; off = Math.max(off, Math.abs(q)); }
      if (off < .002 && tau > .05) { P = s.X.slice(); phase = "idle"; spring = null; draw(t); settle(); } else more = true;
    } else if (phase === "drift") {
      if (!ALIVE) phase = "idle";
      else {
        // time-warp, not amplitude-scale: the ease factor advances an internal clock (driftTeff) rather than
        // scaling a sine's amplitude, so by the chain rule the ON-SCREEN SPEED is the raw formula's own speed
        // times ease(τ) — never higher than the raw formula's max, so there's no mid-ramp spike to bound separately.
        const ease = honeyEaseS(clamp((t - driftT0) / 1500, 0, 1));
        driftTeff += ease * cfg.alive * dt;
        if (lay.globe) { P = [driftAnchor[0] + .035 * driftTeff, driftAnchor[1]]; }
        else {
          const te = driftTeff, k = Math.max(8, centerK(lens(t)));
          const wx = 54 * Math.sin(.052 * te) + 25 * Math.sin(.023 * te + 1.3);
          const wy = 47 * Math.sin(.045 * te + .4) + 22 * Math.sin(.019 * te + 2);
          let wxw = wx / k, wyw = wy / k;
          if (lay.finite) { const cap = Math.max(.15, (lay.ext || 1) * .3), m = Math.hypot(wxw, wyw); if (m > cap) { const s = cap / m; wxw *= s; wyw *= s; } }
          P = [driftAnchor[0] + wxw, driftAnchor[1] + wyw];
        }
      }
      more = true;
    }
    // the net's lag (Plag chases P) and water's breathing run all the time ALIVE is on, not just while idle
    if (ALIVE) {
      const tau = .1, a = 1 - Math.exp(-dt / tau);
      Plag = [Plag[0] + (P[0] - Plag[0]) * a, Plag[1] + (P[1] - Plag[1]) * a];
      more = true;
    } else Plag = P.slice();
    if (insetCur !== insetBottom) {
      if (RM) insetCur = insetBottom; else { insetCur += (insetBottom - insetCur) * Math.min(1, dt * 9); if (Math.abs(insetCur - insetBottom) < .4) insetCur = insetBottom; }
      more = true;
    }
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
  // Globe versions: glideToGlobe brings a tapped item's hue/lightness to face the camera, front and center (the
  // same centerFirst idea, in yaw/pitch); spinRelease just lets the drag's momentum decay like friction (no
  // lattice point to snap to on a sphere) — B:[0,0] makes the spring a pure exponential decay, no oscillation.
  function glideToGlobe(it) {
    const p = lay.pts.find(q => q.it === it); if (!p) return;
    const targetPitch = clamp(Math.asin(clamp(p.y, -1, 1)), -1.5, 1.5);
    let dyaw = ((-p.lon - P[0] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const X = [P[0] + dyaw, targetPitch], A = [P[0] - X[0], P[1] - X[1]], w = RM ? 40 : 13;
    spring = { t0: performance.now(), X, A, B: [w * A[0], w * A[1]], w }; phase = "spring"; buzz(4); kick();
  }
  function spinRelease(V) {
    const w = RM ? 30 : 4.5, X = [P[0] + V[0] / w, clamp(P[1] + V[1] / w, -1.5, 1.5)], A = [P[0] - X[0], P[1] - X[1]];
    spring = { t0: performance.now(), X, A, B: [0, 0], w }; phase = "spring"; kick();
  }
  function zoomAround(z, sx, sy) {
    if (lay && lay.globe) { Z = z; return; }   // the globe always centers at screen middle; nothing to re-anchor
    const l0 = lens(0), o0 = offAt(sx, sy, l0); Z = z;
    const o1 = offAt(sx, sy, lens(0));
    P = [P[0] + o0[0] - o1[0], P[1] + o0[1] - o1[1]];
  }
  const zoomTo = (to, sx = W / 2, sy = Hh / 2) => { phase = phase === "drift" ? "idle" : phase; spring = null; zAnim = { to: clamp(to, ZMIN, ZMAX), sx, sy }; kick(); };
  const rubber = z => z > ZMAX ? ZMAX * Math.pow(z / ZMAX, .3) : z < ZMIN ? ZMIN * Math.pow(z / ZMIN, .3) : z;

  // ---- input: drag with momentum, pinch or ctrl-wheel to zoom, double-tap to zoom in (again to reset) ----
  let down = null, pinch = null, lastTap = null, tapTimer = 0;
  // select mode (honeySelectMode below): a tap toggles a bubble; hold still ~260ms, then drag, to sweep a run of them.
  let sel = null, paint = null, holdT = 0;
  const selSet = (it, on) => { if (!sel || sel.isOn(it.o) === on) return; sel.onToggle(it.o, on); buzz(4); draw(); };
  const ptrs = new Map();
  const hit = (x, y) => { let best = null, bd = Infinity; for (const b of drawn) { const d = Math.hypot(b.x - x, b.y - y); if (d < b.d / 2 + 4 && d / b.d < bd) { bd = d / b.d; best = b; } } return best; };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const GLOBE_ROT_K = 150;
  cv.addEventListener("pointerdown", e => {
    if (!lay) return;
    lastInput = performance.now();
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]); touchXY = [x, y];
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (phase === "spring" || zAnim) loop(performance.now());
    phase = "drag"; spring = null; zAnim = null; touched = true;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = lay.globe ? [0, 0] : offAt(mid[0], mid[1], lens(0));
      pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), Z0: Z, W0: [P[0] + o[0], P[1] + o[1]], t0: performance.now(), moved: false };
      pressed = null; down = null; paint = null; clearTimeout(holdT); clearTimeout(tapTimer); kick(); return;
    }
    if (ptrs.size > 2 || pinch) return;
    const b = hit(x, y);
    pressed = b ? { it: b.it, x: b.x, y: b.y, b } : null;
    down = { x, y, P0: P.slice(), moved: false, hist: [[performance.now(), P[0], P[1]]] };
    clearTimeout(holdT);
    if (sel && pressed) holdT = setTimeout(() => {
      if (!sel || !down || down.moved || !pressed) return;
      paint = { on: !sel.isOn(pressed.it.o) }; down.painted = true; buzz(8); selSet(pressed.it, paint.on);
    }, 260);
    kick();
  });
  cv.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]); touchXY = [x, y];
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (Math.abs(d - pinch.d0) > 8) pinch.moved = true;
      Z = rubber(pinch.Z0 * d / pinch.d0);
      if (!lay.globe) { const o = offAt(mid[0], mid[1], lens(0)); P = [pinch.W0[0] - o[0], pinch.W0[1] - o[1]]; }
      draw(); return;
    }
    if (!down) return;
    if (paint) { const pb = hit(x, y); if (pb) selSet(pb.it, paint.on); return; }
    const dx = x - down.x, dy = y - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 10) { down.moved = true; pressed = null; glided = null; clearTimeout(holdT); kick(); }
    if (!down.moved) return;
    const now = performance.now();
    if (lay.globe) { P = [down.P0[0] + dx / GLOBE_ROT_K, clamp(down.P0[1] - dy / GLOBE_ROT_K, -1.5, 1.5)]; }
    else {
      const k = centerK(lens(0));
      P = [down.P0[0] - dx / k, down.P0[1] - dy / k];
      if (lay.finite) {
        const r = Math.hypot(P[0], P[1]), ext = lay.ext + .6;
        if (r > ext) { const s = (ext + (r - ext) * .35) / r; P = [P[0] * s, P[1] * s]; }
      }
    }
    down.hist.push([now, P[0], P[1]]); while (down.hist.length > 2 && now - down.hist[0][0] > 100) down.hist.shift();
    draw();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    lastInput = performance.now();
    const at = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (pinch) {
      if (ptrs.size) return;
      const p = pinch; pinch = null; phase = "idle";
      if (!p.moved && performance.now() - p.t0 < 260) return zoomTo(1);
      if (Z < ZMIN || Z > ZMAX) return zoomTo(clamp(Z, ZMIN, ZMAX), at[0], at[1]);
      if (opts.onZoom) opts.onZoom(Z);
      return lay.globe ? void 0 : snap();
    }
    if (!down) return;
    const d = down; down = null; phase = "idle"; clearTimeout(holdT);
    if (d.painted || paint) { paint = null; pressed = null; kick(); return; }
    if (!d.moved) {
      const now = performance.now(), p = pressed, held = now - d.hist[0][0];
      if (sel && p && e.type === "pointerup") { pressed = null; selSet(p.it, !sel.isOn(p.it.o)); kick(); return; }
      if (p && opts.onPeek && held >= 480) { pressed = null; kick(); return opts.onPeek(p.it.o); }
      if (lastTap && now - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 36) {
        clearTimeout(tapTimer); lastTap = null; pressed = null; kick();
        return zoomTo(Z > 1.25 ? 1 : 2.1, d.x, d.y);
      }
      lastTap = { t: now, x: d.x, y: d.y };
      if (p && e.type === "pointerup") {
        if (!RM && !SHOOT && cfg.alive > 0) { ripples.push({ x: p.x, y: p.y, t0: now, sigma: Math.max(22, p.b.d * .85) }); if (ripples.length > 4) ripples.shift(); }
        // centerFirst: a tap on an off-center bubble glides it to the middle; a tap on the middle one opens it.
        // "The middle one" is the bubble the view itself calls its center (the caption's), or the one we just glided
        // there. Distance alone wasn't enough: idle drift, the panel inset and the lens could leave the centered
        // bubble a few px off, so a tap on it only glided again and never opened (David).
        // The open zone (David): the center bubble AND the ring touching it open on one tap; only bubbles further out
        // glide to the middle first. The ring's reach is measured from the center bubble's edge, one tapped-bubble wide.
        const cb = drawn.find(q => q.it === center), cd = cb ? cb.d : p.b.d;
        const reach = Math.max(cd * .5 + p.b.d * .95, Math.min(W, vy()) * .16);
        const far = opts.centerFirst && p.it !== center && p.it !== glided && Math.hypot(p.x - W / 2, p.y - vcy()) > reach;
        tapTimer = setTimeout(() => { pressed = null; kick(); if (far) { glided = p.it; lay.globe ? glideToGlobe(p.it) : glideTo(p.x, p.y); } else { glided = null; open(p.it, p.b); } }, far ? 0 : 220);
        return;
      }
      pressed = null; kick();
      return lay.globe ? void 0 : snap();
    }
    const h = d.hist, a = h[0], b = h[h.length - 1], dt = (b[0] - a[0]) / 1000;
    let V = performance.now() - b[0] > 70 || dt < .008 ? [0, 0] : [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
    const sp = Math.hypot(V[0], V[1]); if (sp > 40) V = [V[0] * 40 / sp, V[1] * 40 / sp];
    if (lay.globe) return spinRelease(V);
    snap(V);
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  let wheelT = 0;
  cv.addEventListener("wheel", e => {
    if (!lay) return;
    lastInput = performance.now();
    const [x, y] = local(e);
    if (e.ctrlKey) { e.preventDefault(); touched = true; phase = "idle"; spring = null; zAnim = null; zoomAround(rubber(clamp(Z * Math.exp(-e.deltaY * .012), ZMIN * .8, ZMAX * 1.2)), x, y); }
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault(); touched = true; phase = "idle"; spring = null;
      if (lay.globe) P = [P[0] + e.deltaX / GLOBE_ROT_K, clamp(P[1] + e.deltaY / GLOBE_ROT_K, -1.5, 1.5)];
      else { const k = centerK(lens(0)); P = [P[0] + e.deltaX / k, P[1] + e.deltaY / k]; }
    }
    else return;
    draw(); clearTimeout(wheelT);
    wheelT = setTimeout(() => { if (Z < ZMIN || Z > ZMAX) zoomTo(clamp(Z, ZMIN, ZMAX), x, y); else { if (opts.onZoom) opts.onZoom(Z); if (!lay.globe) snap(); } }, 160);
  }, { passive: false });
  cap.onclick = () => { if (center) open(center, drawn.find(b => b.it === center)); };

  function open(it, b) {
    remember();
    // a small positioned element standing in for the tapped bubble — the honeycomb itself is a canvas, so
    // there's no real DOM element at the bubble's spot for growFrom()/morphFrom() to read a rect from.
    const mkSrc = () => {
      if (!b) return null;
      const m = document.createElement("div"), r = b.d * 1.06;
      m.className = "hc-morph"; Object.assign(m.style, { left: b.x - r / 2 + "px", top: b.y - r / 2 + "px", width: r + "px", height: r + "px", background: it.h });
      cv.parentNode.appendChild(m);
      return m;
    };
    const morph = () => { const m = mkSrc(); if (m) { morphFrom(m); m.remove(); } };
    if (opts.pick) opts.pick(it.o, { morph, srcEl: mkSrc });
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
    if (lay.globe) {
      // P means [yaw, pitch] here, not a plane offset — see the pointer handlers above
      if (how === "restore" && HONEY_PAN && HONEY_PAN.key === lay.key) { P = [HONEY_PAN.x, HONEY_PAN.y]; if (!opts.zoom && HONEY_PAN.z) Z = HONEY_PAN.z; }
      else {
        const f = focus && (focus.h ? focus : BYNAME.get(String(focus.n || "").toLowerCase())), p = f && lay.pts.find(q => q.it.n === f.n);
        P = p ? [-p.lon, clamp(Math.asin(clamp(p.y, -1, 1)), -1.5, 1.5)] : [0, 0];
      }
    } else if (how === "restore" && HONEY_PAN && HONEY_PAN.key === lay.key) { P = [HONEY_PAN.x, HONEY_PAN.y]; if (!opts.zoom && HONEY_PAN.z) Z = HONEY_PAN.z; }
    else {
      const f = focus && (focus.h ? focus : BYNAME.get(String(focus.n || "").toLowerCase()));
      let p = f && lay.pts.find(q => q.it.n === f.n);
      if (!p && f && f.h) { const L = lab(f.h); let bd = Infinity; for (const q of lay.pts) { const dd = (q.it.lab[0] - L[0]) ** 2 + (q.it.lab[1] - L[1]) ** 2 + (q.it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; p = q; } } }
      if (lay.finite && how !== "soft") p = null;
      if (!p && lay.finite) p = lay.pts.reduce((m, q) => Math.hypot(q.x, q.y) < Math.hypot(m.x, m.y) ? q : m, lay.pts[0]);
      p = p || lay.pts[0];
      P = [p.x, p.y];
    }
    Plag = P.slice(); lastInput = performance.now();
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
  // QA readout: a visible on-page strip (not just document.title/fetch — a --screenshot run exits as soon as
  // virtual time is up, often before an in-flight fetch's response lands) so a plain headless screenshot is
  // enough to read the result back.
  function qaReadout(text) {
    let r = document.getElementById("hc-qa"); if (!r) { r = document.createElement("div"); r.id = "hc-qa"; Object.assign(r.style, { position: "fixed", left: "0", right: "0", top: "0", zIndex: 99999, background: "#000", color: "#0f0", font: "12px monospace", padding: "4px 6px", whiteSpace: "pre-wrap" }); document.body.appendChild(r); }
    r.textContent = text; document.title = text;
    fetch(text.split(" ")[0] + "?" + encodeURIComponent(text)).catch(() => {});
  }
  host.addEventListener("honeyshot", e => {
    const act = e.detail, b = center && drawn.find(x => x.it === center);
    if (act === "tap" && center) open(center, b);
    if (act === "press" && b) { phase = "idle"; pressed = { it: center, x: b.x, y: b.y, b }; pressK = 1; draw(); }
    if (act === "zoomin") { Z = 2.3; draw(); }
    if (/^bench/.test(act)) {
      phase = "idle"; bloom = 1; if (act === "benchout") Z = ZMIN;
      const t0 = performance.now(), n = 240; for (let i = 0; i < n; i++) { P[0] += .037; P[1] += .021; draw(); }
      qaReadout(`bench ${((performance.now() - t0) / n).toFixed(2)}ms/frame, zoom ${Z}, ${drawn.length} drawn of ${lay.pts.length}`);
    }
    // QA: scan the currently-drawn bubbles for any pair closer than the sum of their radii (minus the gap) —
    // the no-gap/no-overlap guarantee honeyCells makes, checked numerically instead of by eye
    if (act === "overlap") {
      let bad = 0, worst = 0;
      for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
        const a = drawn[i], b2 = drawn[j], dist = Math.hypot(a.x - b2.x, a.y - b2.y), lim = (a.d + b2.d) / 2 - .3;
        if (dist < lim) { bad++; worst = Math.max(worst, lim - dist); }
      }
      qaReadout(`overlap ${bad} bad of ${drawn.length} drawn, worst ${worst.toFixed(2)}px`);
    }
    if (act === "debug") {
      const Rpx = Math.min(W, vy()) * .42 * Z;
      qaReadout(`debug W=${W} Hh=${Hh} dpr=${dpr} Z=${Z} ZMIN=${ZMIN} inset=${insetCur} Rpx=${Rpx.toFixed(1)} globe=${!!(lay && lay.globe)} drawn=${drawn.length}`);
    }
  });
  resize();
  if (opts.style) { const p = HONEY_STYLES[styleId]; if (p && p.initialZoom && !opts.zoom) Z = p.initialZoom((opts.items && opts.items.length) || 101); }
  // the highlighted constellation (honeyHighlight above): the nearest bubble to each hex, worked out once per set of items
  const hlOn = !!(host.closest && host.closest(".hm"));
  let hlMemo = null;
  function hlItems() {
    if (!hlOn || !HONEY_HL || !lay) { if (hlPill) { hlPill.remove(); hlPill = null; } return null; }
    if (hlMemo && hlMemo.lay === lay && hlMemo.rev === HONEY_HL.rev) return hlMemo.set;
    const its = [...new Set(lay.pts.map(q => q.it).filter(Boolean))], set = new Set();
    HONEY_HL.hexes.forEach(h => { const L = lab(h); let best = null, bd = Infinity; for (const it of its) { const dd = (it.lab[0] - L[0]) ** 2 + (it.lab[1] - L[1]) ** 2 + (it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; best = it; } } if (best) set.add(best); });
    hlMemo = { lay, rev: HONEY_HL.rev, set };
    hlShowPill();
    return set;
  }
  let hlPill = null;
  function hlShowPill() {
    if (hlPill || !host.parentElement) return;
    hlPill = document.createElement("button"); hlPill.className = "cs-hl-pill"; hlPill.setAttribute("aria-label", "Show every color again");
    hlPill.innerHTML = `<span>${esc(HONEY_HL.title || "Your set")}</span>${ICON.x}`;
    hlPill.onclick = e => { e.stopPropagation(); buzz(4); honeyHighlight(null); };
    host.parentElement.appendChild(hlPill);
  }
  if (hlOn) HONEY_LIVE.add(() => { if (dead) return false; hlMemo = null; draw(); return true; });
  let hlFocus = null;
  if (hlOn && HONEY_HL && HONEY_HL.fresh) { HONEY_HL.fresh = false; hlFocus = { h: HONEY_HL.hexes[0] }; }
  if (hlFocus) setItems(opts.items, opts.focus || hlFocus, "");
  else setItems(opts.items, opts.focus || (HONEY_PAN && { n: HONEY_PAN.name }), "restore");
  // ---- the Tweak panel's API: live overrides on top of the active preset, saved by the caller (S.hm.tweak) ----
  function applyTweak(partial) {
    liveTweak = { ...(liveTweak || {}), ...partial };
    cfg = honeyResolveCfg(styleId, liveTweak, lay ? lay.raw.length : 101);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  return {
    update(o = {}) {
      if (o.layout) liveTweak = { ...(liveTweak || {}), layout: ["wheel", "sunflower", "globe"].includes(o.layout) ? o.layout : "mapTall" };
      if (o.style && HONEY_STYLES[o.style]) styleId = o.style;
      setItems(o.items || (lay && lay.raw), o.focus || (center && center.o), o.soft ? "soft" : "");
    },
    zoom: (z, animate = true) => animate ? zoomTo(z) : (Z = clamp(z, ZMIN, ZMAX), draw()),
    // so a bottom sheet never covers the magnified middle: the lens center, the "center" bubble and the
    // vignette all recenter into whatever's still visible above it. Animated (~300ms; see loop()'s insetCur tween).
    setInset({ bottom } = {}) { insetBottom = Math.max(0, +bottom || 0); kick(); },
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
    // Select mode (L23, js/favs.js "Pick favorites"): o = { isOn(item) -> bool, onToggle(item, on) } with item = the
    // original { n, h, c?, lib? }. Off (null/false) clears it. Panning and pinch-zoom keep working; a tap toggles a
    // bubble instead of opening it; hold still, then drag, to sweep a run (it turns ON, or OFF if the first bubble was on).
    selectMode(on, o) { sel = on && o ? o : null; paint = null; clearTimeout(holdT); draw(); },
    honeySelectMode(on, onToggle, isOn) { return this.selectMode(on, { onToggle, isOn }); },
    redraw: () => draw(),
    getStyle: () => styleId,
    getCfg: () => ({ style: styleId, tweak: liveTweak, resolved: cfg }),
    getTweak: () => liveTweak,
    current: () => center && center.o,
    destroy,
  };
}
