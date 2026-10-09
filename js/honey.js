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
let HONEY_PAN = null;                 // where you were on the Home map: { key, x, y, z, name }
let HONEY_PAN_ALT = null;             // the same, for every other honeycomb (browse views, favorites)
// The map's exact view at the moment a bubble opened a page (David, 2026-10-08: "it should return to the exact spot
// where you were"): the pan (a glide's destination if one was in flight), the zoom, and the tapped color with its
// screen point. Only the Home map writes it. On the way back setItems() restores it as is (no snap, no glide); when
// the set of colors changed meanwhile, the tapped color goes back under the same screen point instead.
let HONEY_RET = null;                 // { key, x, y, z, n, h, sx, sy } (sx, sy: canvas px, null when it was mid-glide)
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
// The Map's own hue key (HONEY_SORT below): low-chroma colors read as near-noise by hue -- two near-blacks can
// land on wildly different, meaningless hue angles -- and used to come out scattered among vivid colors that
// happened to round to the same bucket. David, 2026-10-09, two screenshots: a near-black blue sitting amid vivid
// blues; grey/taupe islands amid oranges and yellows. Below HONEY_NEUTRAL_C they get ONE dedicated region instead
// (sorted before every real hue, so they fill the map's own first columns), by lightness among themselves --
// chroma falls off toward that one edge, the hue wheel stays unbroken for everything that actually reads as a hue.
const HONEY_NEUTRAL_C = 16;
const honeyGridHueKey = it => it.C < HONEY_NEUTRAL_C ? -1000 + (100 - it.L) : (it.H - 15 + 360) % 360;
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
// L18 (David, 2026-10-08: zooming in "increases the distance between things too much"): past the normal zoom the
// plane spreads at 60% of the pinch, so a zoom-in enlarges the middle without flinging its neighbors apart.
// Zoomed out (z <= 1) is untouched, so every floor and preset stays exactly where it was.
const l18Spread = z => z <= 1 ? z : 1 + (z - 1) * .6;
// and the lens widens its calm middle as you zoom in: the fisheye packs each ring tighter outward than around, and
// that difference is what opened wide seams between neighbors when zoomed in. At z <= 1 nothing changes (the round
// Apple Watch fisheye stays exactly as approved); at the double-tap zoom the ring spacing is within ~10% of even.
const l18Flat = z => z <= 1 ? 1 : 1 + (z - 1) * .55;
const L18_GROW = .52;
function honeySunflower(items) {
  const N = items.length, c = .56;   // tuned so neighbor spacing (by index) is close to the lattice's unit spacing
  const ordered = items.slice().sort((a, b) => honeyHueKey(a) - honeyHueKey(b) || b.L - a.L);
  const pts = ordered.map((it, i) => { const r = c * Math.sqrt(i + .5), a = i * HONEY_GA; return { it, x: r * Math.cos(a), y: r * Math.sin(a) }; });
  return { pts, finite: true };
}
// L18 H5: the learning spiral. The same golden-angle disc, but ordered by how early the path teaches a name (rank,
// i.e. useRank: the first words in the middle, rarer ones further out), so the stages are rings you can see.
function honeySpiral(items) {
  const c = .56, rk = it => it.o.rank != null ? +it.o.rank : 1e9;
  const ordered = items.slice().sort((a, b) => rk(a) - rk(b) || honeyHueKey(a) - honeyHueKey(b));
  const pts = ordered.map((it, i) => { const r = c * Math.sqrt(i + .5), a = i * HONEY_GA; return { it, x: r * Math.cos(a), y: r * Math.sin(a) }; });
  return { pts, finite: true, spiral: true };
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
// ---------- arrangements (design/HOME-VIEWS.md §3): where each color goes, separate from how it looks ----------
// The rule: position means something, and a bubble's neighbors are its relatives. Every arrangement places each
// color exactly once and is finite, so switching between them is a glide (each bubble flies to its new place).
// Two engines: a GRID (columns by one key, rows by another, on the hex lattice) and RINGS (hex rings filled in order
// of one key, each ring's colors placed at the angle of their hue). "Families" is islands of small grids.
// The angle a color takes on a ring. Hued colors: their hue. Greys have no hue to go by (David, 2026-10-08: "black
// next to white, kinda weird, no?" when every grey shared one spoke and landed in any order), so a grey's angle is its
// LIGHTNESS, on the wheel's own lightness: white at the top (where the pale yellows are), black at the bottom (the deep
// violets), mid greys at the sides (the mid reds and teals), each grey on the side nearer its own faint hue. A ring
// that is all greys then runs white down both sides to black (no wrap seam), rings line up by lightness, and the
// ramp meets the hues of matching lightness. Muted colors (chroma 3 to 17) blend the two by how much hue they have.
const honeyLAngle = (L, near) => {
  const s = (100 - Math.max(0, Math.min(100, L))) * 1.8, a1 = (90 + s) % 360, a2 = (450 - s) % 360;
  const ad = a => { const d = Math.abs(a - near) % 360; return d > 180 ? 360 - d : d; };
  return ad(a1) <= ad(a2) ? a1 : a2;
};
function honeyAngleOf(it) {
  if (it.ang != null) return it.ang;
  const hk = (it.H - 15 + 360) % 360, w = Math.max(0, Math.min(1, (it.C - 3) / 14));
  if (w >= 1) return (it.ang = hk);
  const la = honeyLAngle(it.L, hk) * Math.PI / 180, ha = hk * Math.PI / 180;
  const x = w * Math.cos(ha) + (1 - w) * Math.cos(la), y = w * Math.sin(ha) + (1 - w) * Math.sin(la);
  return (it.ang = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
}
function honeyCenterPts(pts) {
  const cx = pts.reduce((t, q) => t + q.x, 0) / (pts.length || 1), cy = pts.reduce((t, q) => t + q.y, 0) / (pts.length || 1);
  return pts.map(q => ({ it: q.it, x: q.x - cx, y: q.y - cy, g: q.g }));
}
// GRID: xKey picks the column (sorted, cut into even columns), yKey orders each column top to bottom. k: rows per
// column ~ sqrt(N * k), so k > 1 is taller than wide (phone-shaped).
function honeyGridArr(items, xKey, yKey, k = 1.9) {
  const N = items.length; if (!N) return { pts: [], finite: true };
  const H = Math.max(1, Math.min(N, Math.round(Math.sqrt(N * k)))), W = Math.ceil(N / H), e = W * H - N;
  // ties (greys share one warmth, one hue key...) break light to dark, so a run of greys is a lightness ramp
  const order = items.slice().sort((a, b) => xKey(a) - xKey(b) || yKey(a) - yKey(b) || b.L - a.L), pts = [];
  for (let j = 0, k2 = 0; j < W; j++) {
    const short = Math.floor((j + 1) * e / W) > Math.floor(j * e / W), col = order.slice(k2, k2 + (short ? H - 1 : H)).sort((a, b) => yKey(a) - yKey(b) || b.L - a.L);
    k2 += col.length;
    col.forEach((it, r) => pts.push({ it, x: j + (r & 1 ? .5 : 0), y: r * HONEY_SQ3 }));
  }
  return { pts: honeyCenterPts(pts), finite: true };
}
// RINGS: hex rings from the middle out, filled in rank order; within a ring each color takes the free cell nearest
// its hue's angle, keeping hue order (so a ring reads as a hue circle and neighboring rings line up by hue).
// groupOf (optional) names a group per color (a stage, Learned/Learning/New): the seams between groups are drawn
// on the ground (lay.bounds, one smooth closed curve per seam, following where the groups really meet).
function honeyRingArr(items, rankOf, groupOf) {
  const N = items.length; if (!N) return { pts: [], finite: true };
  let n = 0; while (3 * n * n + 3 * n + 1 < N) n++;
  const rings = honeyRings(n), ordered = items.slice().sort((a, b) => rankOf(a) - rankOf(b) || honeyAngleOf(a) - honeyAngleOf(b)), pts = [];
  for (let d = 0, k = 0; d <= n && k < N; d++) {
    const cells = rings[d].slice().sort((a, b) => a.a - b.a), c = cells.length, m = Math.min(c, N - k);
    const grp = ordered.slice(k, k + m).sort((a, b) => honeyAngleOf(a) - honeyAngleOf(b)); k += m;
    // ideal cell for each color, then the nearest order-keeping placement (forward pass, then pull back from the end)
    const p = grp.map(it => Math.min(c - 1, Math.round(honeyAngleOf(it) / 360 * c)));
    for (let i = 1; i < m; i++) p[i] = Math.max(p[i], p[i - 1] + 1);
    if (m && p[m - 1] > c - 1) { p[m - 1] = c - 1; for (let i = m - 2; i >= 0; i--) p[i] = Math.min(p[i], p[i + 1] - 1); }
    grp.forEach((it, i) => { const cell = cells[p[i]]; pts.push({ it, x: cell.x, y: cell.y, g: groupOf ? groupOf(it) : 0 }); });
  }
  const lay = { pts, finite: true };
  if (groupOf) lay.bounds = honeyGroupBounds(pts, groupOf);
  return lay;
}
// the seams between radial groups (stages, Learned/Learning/New), one smooth closed curve each: per angle bucket,
// halfway between the outermost color of the inner groups and the innermost color of the outer ones
function honeyGroupBounds(pts, groupOf) {
  const g = new Map(pts.map(q => [q.it, groupOf(q.it)])), gs = [...new Set(g.values())].sort((a, b) => a - b), B = 72, out = [];
  for (const gi of gs.slice(0, -1)) {
    const inR = new Array(B).fill(-1), outR = new Array(B).fill(Infinity);
    for (const q of pts) {
      const b = Math.floor(((Math.atan2(q.y, q.x) / (2 * Math.PI) + 1) % 1) * B), r = Math.hypot(q.x, q.y);
      if (g.get(q.it) <= gi) inR[b] = Math.max(inR[b], r); else outR[b] = Math.min(outR[b], r);
    }
    if (inR.every(v => v < 0) || outR.every(v => v === Infinity)) continue;
    let rr = inR.map((v, b) => v < 0 ? (outR[b] < Infinity ? outR[b] - .5 : null) : outR[b] < Infinity ? (v + outR[b]) / 2 : v + .5);
    const fill = rr.filter(v => v != null), avg = fill.reduce((t, v) => t + v, 0) / (fill.length || 1);
    rr = rr.map(v => v == null ? avg : v);
    for (let pass = 0; pass < 3; pass++) rr = rr.map((v, b) => (rr[(b + B - 1) % B] + 2 * v + rr[(b + 1) % B]) / 4);
    out.push(rr);
  }
  return out;
}
// SUNFLOWER: the golden-angle disc, filled from the middle out in rank order like the rings. The disc is cut into
// bands one lattice unit wide; each band takes the next colors in rank order, and inside a band the colors go round
// by hue (the best rotation of hue order onto the band's seeds), so the middle-vs-edge meaning and a hue circle
// both read, in the sunflower's own packing.
function honeySunArr(items, rankOf, groupOf) {
  const N = items.length; if (!N) return { pts: [], finite: true };
  const c = .56, seeds = [];
  for (let i = 0; i < N; i++) { const r = c * Math.sqrt(i + .5), a = i * HONEY_GA, x = r * Math.cos(a), y = r * Math.sin(a); let t = Math.atan2(-y, x) * 180 / Math.PI; if (t < 0) t += 360; seeds.push({ x, y, t, band: Math.floor(r) }); }
  const ordered = items.slice().sort((a, b) => rankOf(a) - rankOf(b) || honeyAngleOf(a) - honeyAngleOf(b)), pts = [];
  const ad = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  for (let i0 = 0; i0 < N;) {
    let i1 = i0; while (i1 < N && seeds[i1].band === seeds[i0].band) i1++;
    const cells = seeds.slice(i0, i1).sort((a, b) => a.t - b.t), m = cells.length;
    const grp = ordered.slice(i0, i1).sort((a, b) => honeyAngleOf(a) - honeyAngleOf(b));
    let bo = 0, bc = Infinity;
    for (let o = 0; o < m; o++) { let s = 0; for (let k = 0; k < m && s < bc; k++) s += ad(honeyAngleOf(grp[k]), cells[(k + o) % m].t); if (s < bc) { bc = s; bo = o; } }
    grp.forEach((it, k) => { const s = cells[(k + bo) % m]; pts.push({ it, x: s.x, y: s.y, g: groupOf ? groupOf(it) : 0 }); });
    i0 = i1;
  }
  const lay = { pts, finite: true };
  if (groupOf) lay.bounds = honeyGroupBounds(pts, groupOf);
  return lay;
}
// a family per region: each family a small grid of its own (sub(items) -> a finite layout), the regions laid out three
// across like the pages of a book (read left to right, top to bottom), with a one-cell sea between them. Each region
// is snapped to the lattice (whole columns, an even number of rows), so its cells stay on the honeycomb.
// read around the middle (Greys) clockwise from the top left: Pinks, Reds, Oranges, Browns, Yellows, Greens, Blues, Purples
const HONEY_PAGE_ORDER = ["Pinks", "Reds", "Oranges", "Purples", "Greys", "Browns", "Blues", "Greens", "Yellows"];
function honeyRegions(items, sub, order = HONEY_PAGE_ORDER) {
  const by = new Map();
  for (const it of items) { const f = csFamily(it); let a = by.get(f); if (!a) by.set(f, a = []); a.push(it); }
  const regs = order.filter(f => by.has(f)).map(f => {
    const g = sub(by.get(f)), xs = g.pts.map(q => q.x), ys = g.pts.map(q => q.y);
    return { f, g, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const COLS = regs.length > 4 ? 3 : 2, gap = 1.1, colW = [], rowH = [];
  regs.forEach((r, i) => { const c = i % COLS, rw = Math.floor(i / COLS); colW[c] = Math.max(colW[c] || 0, r.x1 - r.x0 + 1); rowH[rw] = Math.max(rowH[rw] || 0, r.y1 - r.y0 + HONEY_SQ3); });
  const cx = [0], cy = [0];
  for (let c = 1; c < colW.length; c++) cx[c] = cx[c - 1] + colW[c - 1] + gap;
  for (let r = 1; r < rowH.length; r++) cy[r] = cy[r - 1] + rowH[r - 1] + gap;
  const pts = [];
  regs.forEach((r, i) => {
    const c = i % COLS, rw = Math.floor(i / COLS);
    // centered in its cell of the book, then snapped to the lattice
    const ox = Math.round(cx[c] + (colW[c] - (r.x1 - r.x0 + 1)) / 2 - r.x0), oy = Math.round((cy[rw] + (rowH[rw] - (r.y1 - r.y0 + HONEY_SQ3)) / 2 - r.y0) / (2 * HONEY_SQ3)) * 2 * HONEY_SQ3;
    // a region's own sub-groups (Sort by: First met keeps met and not-yet-met apart) stay apart inside the family
    r.g.pts.forEach(q => pts.push({ it: q.it, x: q.x + ox, y: q.y + oy, g: r.f + "|" + (q.g || 0) }));
  });
  return { pts: honeyCenterPts(pts), finite: true, regions: true };
}
// warm (+1, orange-yellow) to cool (-1, blue), scaled by strength so greys sit in the seam
const honeyTemp = it => it.C < 6 ? 0 : it.C / (it.C + 18) * Math.cos((it.H - 60) * Math.PI / 180);
const honeyTier = it => { const c = typeof hmCard === "function" ? hmCard(it.o) : null; return !c ? 2 : typeof isMine === "function" && isMine(c) ? 0 : 1; };
const honeyRankOf = it => it.o.rank != null ? +it.o.rank : 1e9;
// the stage each color falls in (by its place in rank order, so a stage is exactly its round number)
function honeyStageGroups(items) {
  const st = typeof HM_STAGES !== "undefined" ? HM_STAGES : [25, 50, 100, 150, 250, 400, 600, 800, 1000], ord = items.slice().sort((a, b) => honeyRankOf(a) - honeyRankOf(b)), m = new Map();
  ord.forEach((it, i) => { let s = 0; while (s < st.length && i >= st[s]) s++; m.set(it, s); });
  return it => m.get(it) || 0;
}
// ---- how often a color turns up in the 23,781 paintings (data/colorindex/painted.json, built from the affinity
// table by tools/painted_counts.js: paintings holding the color within 4% different over at least 1% of the picture).
// Names outside the table borrow the count of their nearest name that has one. Loaded only when a view asks.
let HONEY_PAINTED = null, HONEY_PAINTED_P = null;
function honeyLoadPainted() {
  if (HONEY_PAINTED) return Promise.resolve(HONEY_PAINTED);
  return HONEY_PAINTED_P = HONEY_PAINTED_P || fetch("data/colorindex/painted.json").then(r => r.json()).then(d => {
    const m = new Map(), ref = [];
    for (const [n, h, k] of d.c) { m.set(n.toLowerCase(), k); ref.push({ h, k, ok: null }); }
    return HONEY_PAINTED = { m, ref, n: d.n };
  }).catch(e => { HONEY_PAINTED_P = null; throw e; });
}
function honeyPainted(it) {
  if (it.pc != null) return it.pc;
  const P = HONEY_PAINTED; if (!P) return 0;
  const k = P.m.get(it.n.toLowerCase()); if (k != null) return (it.pc = k);
  const o = honeyOk(it); let best = 0, bd = Infinity;
  for (const r of P.ref) { const q = r.ok || (r.ok = honeyOk(r)), d = (q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 + (q[2] - o[2]) ** 2; if (d < bd) { bd = d; best = r.k; } }
  return (it.pc = best);
}
// when you first met a color (its card's start date); colors you haven't met sort after every one you have
const honeyMet = it => { const c = typeof hmCard === "function" ? hmCard(it.o) : null; return c && c.since ? Date.parse(c.since) || 0 : null; };

// ---------- SHAPE x ORDER (David, 2026-10-08: "in one arrangement all the greys are in the middle and it doesn't make
// sense why… give options for different placements within a single shape and style") ----------
// A shape is the geometry (rings, the sunflower, the map's grid, the family book, the warm-and-cool plane). An ORDER
// says what decides where a color goes inside it:
//  - radial shapes: CENTER ON (what sits in the middle; the rest ring outward in that order, hue going round)
//  - grid shapes:   SORT BY (what runs left to right; each column runs light to dark, or by hue when lightness leads)
// A layout key is "shape~order" (and "~#hex" for Around a color); the Hue map's own key stays its Look's map shape,
// so the default map is exactly the one David approved.
const honeyDistTo = hex => { const o = honeyOk({ h: hex }); return it => { const q = honeyOk(it); return Math.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]); }; };
// rank(it, items, param) -> lower = nearer the middle; group (optional) -> the seams drawn on the ground
const HONEY_CENTER = {
  vivid: { t: "Vivid", mid: "the most vivid", edge: "greys", rank: () => it => -it.C },
  muted: { t: "Greys", mid: "greys", edge: "the most vivid", rank: () => it => it.C },
  light: { t: "Light", mid: "white", edge: "black", rank: () => it => -it.L },
  dark: { t: "Dark", mid: "black", edge: "white", rank: () => it => it.L },
  known: { t: "Your words", mid: "words you know", edge: "new ones", sig: items => items.map(honeyTier).join(""),
    rank: () => it => honeyTier(it) * 1e7 + Math.min(1e7 - 1, honeyRankOf(it)), group: () => honeyTier },
  common: { t: "Everyday", mid: "the everyday names", edge: "the rarest, a ring per stage", rank: () => honeyRankOf, group: items => honeyStageGroups(items) },
  painted: { t: "Painted", mid: "the most painted", edge: "rarely painted", needs: "painted", rank: () => it => -honeyPainted(it) },
  today: { t: "Today's color", mid: "", edge: "the least like it", rank: (items, hex) => honeyDistTo(hex || "#808080") },
  near: { t: "Around a color", mid: "", edge: "the least like it", rank: (items, hex) => honeyDistTo(hex || "#808080") },
};
// x(it) runs left to right; y(it) top to bottom inside a column; g (optional) keeps groups apart in the smoothing
const HONEY_SORT = {
  hue: { t: "Hue", line: "hue across, light to dark down", x: honeyGridHueKey, y: it => 100 - it.L },
  light: { t: "Lightness", line: "light to dark across, hue down", x: it => 100 - it.L, y: honeyGridHueKey },
  chroma: { t: "Vividness", line: "muted to vivid across, light to dark down", x: it => it.C, y: it => 100 - it.L },
  warm: { t: "Warmth", line: "warm to cool across, light to dark down", x: it => -honeyTemp(it), y: it => 100 - it.L },
  painted: { t: "Painted", line: "most painted to rarely painted across", needs: "painted", x: it => -honeyPainted(it), y: it => 100 - it.L },
  met: { t: "First met", line: "the order you met them, then the rest by hue", sig: items => items.map(it => honeyMet(it) || 0).join(","),
    x: it => { const m = honeyMet(it); return m == null ? 1e15 + honeyHueKey(it) : m; }, y: it => 100 - it.L, g: it => honeyMet(it) == null ? 1 : 0 },
};
// a grid by one sort: columns by x, each column by y (groups stay apart when the sort has them)
function honeySortGrid(items, s, k) {
  const lay = honeyGridArr(items, s.x, s.y, k);
  if (s.g) lay.pts.forEach(q => { q.g = s.g(q.it); });
  return lay;
}
// id -> { title, kind ("radial" | "grid" | ""), def (the default order, and why in design/HOME-VIEWS.md §8), sub, make(items, order, param) }
const HONEY_ARR = {
  map: { title: "Map", kind: "grid", def: "hue", sub: "Hue across, light to dark down",
    make: (items, ord) => honeySortGrid(items, HONEY_SORT[ord] || HONEY_SORT.light, 1.9) },
  rings: { title: "Rings", kind: "radial", def: "light", sub: "Rings from the middle out, hue going round",
    make: (items, ord, p) => { const o = HONEY_CENTER[ord] || HONEY_CENTER.light; return honeyRingArr(items, o.rank(items, p), o.group && o.group(items)); } },
  sunflower: { title: "Sunflower", kind: "radial", def: "vivid", sub: "A golden spiral from the middle out, hue going round",
    make: (items, ord, p) => { const o = HONEY_CENTER[ord] || HONEY_CENTER.vivid; return honeySunArr(items, o.rank(items, p), o.group && o.group(items)); } },
  families: { title: "Families", kind: "grid", def: "hue", sub: "A region per family, greys in the middle", fit: true,
    make: (items, ord) => { const s = HONEY_SORT[ord] || HONEY_SORT.hue; return honeyRegions(items, a => honeySortGrid(a, s, 2.4)); } },   // tall regions: the book is phone-shaped
  // the color plane seen from above (lightness set aside): warm left, cool right, greens up, magentas down
  temp: { title: "Warm and cool", kind: "", sub: "Warm left, cool right, greys in the middle", make: items => honeyGridArr(items, it => -honeyTemp(it), it => -(it.C < 6 ? 0 : it.C / (it.C + 18) * Math.sin((it.H - 60) * Math.PI / 180)), 1.25) },
};
const HONEY_ARR_IDS = Object.keys(HONEY_ARR);
// the orders a shape offers, in chip order
const honeyOrdersOf = id => { const a = HONEY_ARR[id]; return !a ? [] : a.kind === "radial" ? Object.keys(HONEY_CENTER) : a.kind === "grid" ? Object.keys(HONEY_SORT) : []; };
const honeyOrderSpec = (id, ord) => { const a = HONEY_ARR[id]; return !a ? null : a.kind === "radial" ? HONEY_CENTER[ord] || HONEY_CENTER[a.def] : a.kind === "grid" ? HONEY_SORT[ord] || HONEY_SORT[a.def] : null; };
// "rings~vivid" -> { id: "rings", ord: "vivid", p: undefined }; "rings~near~#AABBCC" -> p "#AABBCC"
function honeyParseKey(k) { const [id, ord, p] = String(k || "").split("~"); return { id, ord: ord || (HONEY_ARR[id] ? HONEY_ARR[id].def : ""), p }; }
// older saves: the arrangements that are now a shape plus an order
const HONEY_ARR_OLD = { wheel: ["rings", "muted"], light: ["rings", "light"], path: ["rings", "common"], known: ["rings", "known"], pages: ["families", "chroma"] };
const honeyIsLayout = k => ["wheel", "sunflower", "globe", "spiral", "mapTall", "mapWide"].includes(k) || !!(HONEY_ARR[honeyParseKey(k).id] && HONEY_ARR[honeyParseKey(k).id].make);
// a small live picture of an arrangement, drawn from the actual colors (the View sheet's strip): every color a dot
// at its place, fitted to the canvas. Uses the same layout cache as the map, so the tap that follows is instant.
function honeyPreview(cv, raw, layoutKey) {
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  if (!raw || !raw.length) return;
  const lay = honeyLayout(raw, layoutKey), pts = lay.pts; if (!pts.length) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  const pad = w * .08, s = Math.min((w - 2 * pad) / Math.max(1, x1 - x0 + 1), (h - 2 * pad) / Math.max(1, y1 - y0 + 1));
  const r = Math.max(.7, s * .5), ox = w / 2 - (x0 + x1) / 2 * s, oy = h / 2 - (y0 + y1) / 2 * s;
  for (const q of pts) { ctx.fillStyle = q.it.h; ctx.beginPath(); ctx.arc(ox + q.x * s, oy + q.y * s, r, 0, 6.2832); ctx.fill(); }
}
// ---------- the layout-quality pass (David, 2026-10-08: "does Niagara Green really belong in that spot?") ----------
// Every arrangement first places colors by its own rule (hue, lightness, rank...). Then each color should sit among
// colors like it: measure each bubble's mean OKLab difference (x100) to its touching neighbors, and swap nearby pairs
// (neighbors and neighbors' neighbors) whenever that lowers the total. Swaps are local, so each arrangement's meaning
// holds (a color moves a cell or two, never across the map), and never cross a group (a stage, a family, a tier).
// Time-boxed and cached with the layout. lay.quality = { before, after, worst: [[name, mean dE], ...10] }.
function honeyOk(it) {
  if (it.ok) return it.ok;
  const h = it.h, f = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  const r = f(parseInt(h.slice(1, 3), 16)), g = f(parseInt(h.slice(3, 5), 16)), b = f(parseInt(h.slice(5, 7), 16));
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return (it.ok = [100 * (.2104542553 * l + .793617785 * m - .0040720468 * s), 100 * (1.9779984951 * l - 2.428592205 * m + .4505937099 * s), 100 * (.0259040371 * l + .7827717662 * m - .808675766 * s)]);
}
const HONEY_DL_OK = 30, HONEY_DL_W = 3, HONEY_DL_BAD = 35;
function honeySmooth(lay, budgetMs = 120) {
  const P = lay.pts, n = P.length;
  if (n < 8 || lay.globe || new Set(P.map(q => q.it)).size !== n) return;   // a tiled map repeats colors: leave it
  // neighbors: everything within 1.25 lattice units (the six around a cell; a spiral's nearest too), as flat arrays
  const R = 1.25, cell = new Map(), key = (i, j) => i * 100003 + j, nbs = [];
  P.forEach((q, k) => { const kk = key(Math.floor(q.x / R), Math.floor(q.y / R)); let a = cell.get(kk); if (!a) cell.set(kk, a = []); a.push(k); });
  P.forEach((q, k) => {
    const ci = Math.floor(q.x / R), cj = Math.floor(q.y / R), out = [];
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const m of cell.get(key(i, j)) || []) {
      if (m !== k && Math.hypot(P[m].x - q.x, P[m].y - q.y) <= R) out.push(m);
    }
    nbs.push(out);
  });
  // colors as OKLab triples in one array; col[k] = which color sits at place k
  const its = P.map(q => q.it), O = new Float64Array(n * 3), Ls = new Float64Array(n), col = new Int32Array(n), grp = P.map(q => q.g == null ? 0 : q.g);
  its.forEach((it, i) => { const o = honeyOk(it); O[i * 3] = o[0]; O[i * 3 + 1] = o[1]; O[i * 3 + 2] = o[2]; Ls[i] = it.L; col[i] = i; });
  // David, 2026-10-08 ("black next to white, kinda weird, no?"): a lightness jump is the one difference the eye can't
  // forgive between touching cells, so beyond HONEY_DL_OK (L*) every extra step costs HONEY_DL_W times a plain one.
  // White never touches black wherever any swap within reach can prevent it.
  const lOf = k => {
    const c = col[k] * 3, L = O[c], A = O[c + 1], B = O[c + 2], LL = Ls[col[k]], nb = nbs[k]; let t = 0;
    for (let i = 0; i < nb.length; i++) {
      const m = col[nb[i]], d = m * 3, x = O[d] - L, y = O[d + 1] - A, z = O[d + 2] - B, dl = Math.abs(Ls[m] - LL);
      t += Math.sqrt(x * x + y * y + z * z) + (dl > HONEY_DL_OK ? (dl - HONEY_DL_OK) * HONEY_DL_W : 0);
    }
    return t;
  };
  const local = k => {
    const c = col[k] * 3, L = O[c], A = O[c + 1], B = O[c + 2], nb = nbs[k]; let t = 0;
    for (let i = 0; i < nb.length; i++) { const d = col[nb[i]] * 3, x = O[d] - L, y = O[d + 1] - A, z = O[d + 2] - B; t += Math.sqrt(x * x + y * y + z * z); }
    return t;
  };
  const mean = () => { let t = 0, c = 0; for (let k = 0; k < n; k++) if (nbs[k].length) { t += local(k) / nbs[k].length; c++; } return c ? t / c : 0; };
  // candidates: neighbors and neighbors' neighbors in the same group (worked out once)
  const cands = nbs.map((nb, k) => { const s = new Set(nb); for (const m of nb) for (const m2 of nbs[m]) if (m2 !== k) s.add(m2); return [...s].filter(m => m > k && grp[m] === grp[k]); });
  const before = mean(), t0 = performance.now();
  for (let pass = 0; pass < 14; pass++) {
    let moved = 0;
    for (let k = 0; k < n; k++) for (const m of cands[k]) {
      const b0 = lOf(k) + lOf(m);
      let tmp = col[k]; col[k] = col[m]; col[m] = tmp;
      if (lOf(k) + lOf(m) < b0 - .05) { moved++; continue; }
      tmp = col[k]; col[k] = col[m]; col[m] = tmp;
    }
    if (!moved || performance.now() - t0 > budgetMs) break;
  }
  // repair: a cell still touching a lightness jump (> HONEY_DL_BAD) looks farther afield, up to three cells away in its
  // own group, for the swap that helps most. Few cells qualify, so this is cheap; it unsticks what pairwise swaps can't.
  const bad = k => { const LL = Ls[col[k]]; for (const m of nbs[k]) if (Math.abs(Ls[col[m]] - LL) > HONEY_DL_BAD) return true; return false; };
  const t1 = performance.now();
  for (let rep = 0; rep < 6; rep++) {
    let fixed = 0;
    for (let k = 0; k < n; k++) {
      if (!bad(k)) continue;
      const q = P[k], ci = Math.floor(q.x / R), cj = Math.floor(q.y / R);
      let best = -1, gain = .05;
      for (let i = ci - 4; i <= ci + 4; i++) for (let j = cj - 4; j <= cj + 4; j++) for (const m of cell.get(key(i, j)) || []) {
        if (m === k || grp[m] !== grp[k] || Math.hypot(P[m].x - q.x, P[m].y - q.y) > 4.4) continue;
        const b0 = lOf(k) + lOf(m);
        let tmp = col[k]; col[k] = col[m]; col[m] = tmp;
        const g = b0 - lOf(k) - lOf(m);
        tmp = col[k]; col[k] = col[m]; col[m] = tmp;
        if (g > gain) { gain = g; best = m; }
      }
      if (best >= 0) { const tmp = col[k]; col[k] = col[best]; col[best] = tmp; fixed++; }
    }
    if (!fixed || (rep >= 1 && performance.now() - t1 > budgetMs / 3)) break;   // two rounds always, even on a slow phone
  }
  const after = mean();
  P.forEach((q, k) => { q.it = its[col[k]]; });
  const worst = P.map((q, k) => [q.it.n, nbs[k].length ? local(k) / nbs[k].length : 0]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([a, b]) => [a, +b.toFixed(1)]);
  lay.quality = { before: +before.toFixed(2), after: +after.toFixed(2), ms: Math.round(performance.now() - t0), worst };
}
let HONEY_ENDLESS = false;   // L18: the endless mirrored map, opt-in (js/home.js sets it from S.hm.endless)
const HONEY_MAP_K = { mapWide: 1 / 2.4, mapTall: .63 };
function honeyLayout(raw, layoutKey) {
  let hs = 2166136261; for (const o of raw) for (let i = 0; i < o.n.length; i++) { hs ^= o.n.charCodeAt(i); hs = Math.imul(hs, 16777619); }
  const pk = honeyParseKey(layoutKey), arr = HONEY_ARR[pk.id] && HONEY_ARR[pk.id].make ? HONEY_ARR[pk.id] : null, spec = arr ? honeyOrderSpec(pk.id, pk.ord) : null;
  const items0 = spec && spec.sig ? raw.map(honeyNorm) : null;
  // an order that depends on your progress (Your words, First met) or on data still loading (Painted) keys on it too
  const key = `${layoutKey}|${HONEY_ENDLESS ? "e" : "b"}|${raw.length}|${hs >>> 0}${items0 ? "|" + honeyNameHash(spec.sig(items0)) : ""}${spec && spec.needs === "painted" ? (HONEY_PAINTED ? "|P" : "|p") : ""}`;
  const hit = HONEY_LAYOUTS.get(key); if (hit && hit.raw === raw) return hit;
  const items = items0 || raw.map(honeyNorm);
  let lay;
  if (arr) lay = arr.make(items, pk.ord, pk.p);
  else if (layoutKey === "globe") lay = honeySphere(items);
  else if (layoutKey === "sunflower") lay = honeySunflower(items);
  else if (layoutKey === "spiral") lay = honeySpiral(items);
  // the wheel's own cut edges never match a neighboring copy's, so (David's wrap rule) it stays finite always,
  // not just for small sets
  else if (layoutKey === "wheel") lay = Object.assign(honeyWheel(items), { finite: true });
  else if (items.length < HONEY_FINITE) lay = honeyCluster(items);
  else {
    // bounded, the map is one tile shaped like the phone (taller than the endless strip, which mirrored it)
    lay = honeyMap(items, HONEY_ENDLESS ? HONEY_MAP_K[layoutKey] || HONEY_MAP_K.mapTall : 1.9);
    // L18 (David: endless mirroring "makes it harder to find the color you need"): by default the map is ONE bounded
    // world, each color exactly once, centered; panning rubber-bands at the edges and zoom-out fits the whole map.
    // The old endless tiling stays behind HONEY_ENDLESS (View > Look, off by default).
    if (!HONEY_ENDLESS) {
      const one = lay.pts.filter(q => q.y >= 0), cx = one.reduce((t, q) => t + q.x, 0) / one.length, cy = one.reduce((t, q) => t + q.y, 0) / one.length;
      lay = { pts: one.map(q => ({ it: q.it, x: q.x - cx, y: q.y - cy })), finite: true };
    }
  }
  if (lay.finite && !lay.globe && !lay.spiral) honeySmooth(lay);   // every color among colors like it
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
  spiral: { title: "Spiral", cfg: { layout: "spiral", m0: 2.3, m1: 1, sig: 2.4, gap: .06, zMinUser: .18, labelMin: 24, vig: 0 },
    far: { m0: .4, gap: -.03, labelMin: -4 } },
  globe: { title: "Globe", cfg: { layout: "globe", lensMode: "none", gap: .05, shape: 0, zMinUser: .5, labelMin: 32, vig: 0 },
    far: { labelMin: -8 } },
};
// David, 2026-10-09: raised from 3000 so the biggest sets (every name, every shade) can actually reach a whole-map
// zoom-out -- a tiny cell past r<3 already skips the hex-poly path and its label (honeyCellPath, finishFrame), so
// the per-bubble cost out here is one cheap fill, not the full draw; phones stay smooth and safe; see the draw loop
const HONEY_MAX_DRAWN = 5000;
// motion (net lag + water breathe/ripple) is skipped past this many drawn bubbles, so it stays fast at the
// biggest, most zoomed-out sets too — idle drift is unaffected (it only ever moves one pan value, not per-bubble)
const HONEY_MOTION_BUDGET = Math.round(HONEY_MAX_DRAWN * .5);
const HONEY_ALIVE_MAX = 1500;   // above this many drawn bubbles: no idle drift or water at all (see the loop)
// Home's View sheet offers three Looks (js/home.js HM_LOOKS: Bubbles, Honeycomb, Magnifier); where the colors go is an
// arrangement now (HONEY_ARR above). The rest stay reachable from the honeycomb lab (#/lab/honey). The Globe stays in
// the lab until its colors are spread evenly over the sphere (today they bunch up and leave bare patches).

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
function honeyCells(drawn, gapPx, shapeAmt = 0, grow = .52, clipAll = false) {   // clipAll (L18 glide): clip even tiny bubbles   // grow: how far a bubble may swell past its own lens size, as a fraction of its diameter
  if (!drawn.length) return;
  // Speed: the grid is sized to a TYPICAL bubble (not the biggest, which put thousands of tiny ones in every lookup),
  // and each bubble searches only as many cells as its own size needs. Tiny bubbles (under ~7 px) skip the cell
  // clipping altogether: at that size a slightly smaller circle is indistinguishable and costs nothing.
  const ds = drawn.map(b => b.d).sort((a, c) => a - c), typ = ds[Math.floor(ds.length / 2)] || 8, maxD = ds[ds.length - 1] || 8;
  const cell = Math.max(4, typ * 1.3, maxD * 1.5 / 12), grid = new Map(), key = (i, j) => i * 100003 + j;
  drawn.forEach((b, n) => { const k = key(Math.floor(b.x / cell), Math.floor(b.y / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); });
  const half = gapPx / 2;
  drawn.forEach((b, n) => {
    if (b.d < 7 && !clipAll) { b.poly = null; b.rin = Math.max(0, b.d * .44 - half); b.d0 = b.d; b.d = 2 * b.rin; return; }
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

// ---- map study marks (js/mapstudy.js): calm rings over named bubbles, drawn after the bubbles themselves.
// pulse: a slow breathing ring (the one to name) · right: a soft green glow that blooms out and fades (~0.9s) ·
// wrong: a thin warm ring · true: a bright ring that stays (where the answer was) · ring: a quiet hairline (part of
// this round) · start / goal: a ring with a small dot. Never a fill, never a dim: the bubble's own color stays true.
const HONEY_MARK_ANIM = { pulse: Infinity, right: 900, true: 420 };
function honeyStudyAnimating(marks, t) { for (const m of marks.values()) if (HONEY_MARK_ANIM[m.kind] && t - m.t0 < HONEY_MARK_ANIM[m.kind]) return true; return false; }
function honeyStudyMarks(ctx, drawn, marks, t) {
  ctx.save();
  for (const b of drawn) {
    const m = marks.get(b.it.n); if (!m || b.rin < 2) continue;
    const age = t - m.t0, r = b.rin;
    ctx.beginPath();
    if (m.kind === "pulse") {
      const k = .5 + .5 * Math.sin(age / 1000 * Math.PI * 2 / 1.8);
      ctx.arc(b.x, b.y, r + 3 + 3 * k, 0, 6.2832); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(239,235,227,${.55 + .4 * k})`; ctx.stroke();
    } else if (m.kind === "right") {
      const u = Math.max(0, Math.min(1, age / 900)), e = 1 - Math.pow(1 - u, 3);
      ctx.arc(b.x, b.y, r + 2 + 10 * e, 0, 6.2832); ctx.lineWidth = 3 * (1 - u) + .5; ctx.strokeStyle = `rgba(154,212,174,${.95 * (1 - u)})`; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, r + 2.5, 0, 6.2832); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(154,212,174,.9)"; ctx.stroke();
    } else if (m.kind === "wrong") {
      ctx.arc(b.x, b.y, r + 2.5, 0, 6.2832); ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(240,154,134,.9)"; ctx.stroke(); ctx.setLineDash([]);
    } else if (m.kind === "true") {
      const u = Math.max(0, Math.min(1, age / 420));
      ctx.arc(b.x, b.y, r + 3 + 8 * (1 - u), 0, 6.2832); ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(239,235,227,${.4 + .55 * u})`; ctx.stroke();
    } else if (m.kind === "ring") {
      ctx.arc(b.x, b.y, r + 2, 0, 6.2832); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(239,235,227,.5)"; ctx.stroke();
    } else if (m.kind === "start" || m.kind === "goal") {
      ctx.arc(b.x, b.y, r + 3, 0, 6.2832); ctx.lineWidth = 2.2; ctx.strokeStyle = m.kind === "goal" ? "rgba(239,235,227,.95)" : "rgba(239,235,227,.55)"; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y - r - 3, 3.2, 0, 6.2832); ctx.fillStyle = m.kind === "goal" ? "#EFEBE3" : "rgba(239,235,227,.6)"; ctx.fill();
    }
  }
  ctx.restore();
}
// ---- a highlighted constellation (js/colorset.js csOnMap): any set of hexes lights up on the honeycomb home ----
// honeyHighlight(hexes, { title, set, from }) dims every bubble but the nearest one to each hex; honeyHighlight(null)
// clears it. Only the home honeycomb (inside .hm) listens. The lit set becomes the map's subject (PLAN.md Wave 1b,
// lane F): a solid bar at the bottom names it and its source, with ‹ back to the source, Learn these, Find them, ✕.
//   set:  the ColorSet it came from (names, shares, kind), so Learn these and Find them work on exactly these colors
//   from: the trail behind the page that lit it ({ stack, root }), so ‹ still finds that page after a lesson or a
//         round of Study the map comes back to a map whose own trail restarted (js/trail.js tlMapBack)
let HONEY_HL = null, HONEY_HL_REV = 0;
const HONEY_LIVE = new Set();
function honeyHighlight(hexes, o = {}) {
  const hs = (hexes || []).map(h => String(h).toUpperCase()).filter(h => /^#[0-9A-F]{6}$/.test(h));
  HONEY_HL = hs.length ? { hexes: hs, title: o.title || "", set: o.set || null, from: o.from || null, rev: ++HONEY_HL_REV, fresh: true, hv: 0 } : null;
  HONEY_LIVE.forEach(f => { if (f() === false) HONEY_LIVE.delete(f); });
}
// How many (David, 2026-10-08: "it shows only 6 colors, an arbitrary number"): a set drawn from a bigger pool lights
// its k biggest colors. The bar stays (same rev); the lit bubbles follow at once (hv), and frame = true reframes them.
const HONEY_LIT_MIN = 3;
function honeyLitSize(k, frame) {
  const s = HONEY_HL && HONEY_HL.set; if (!s || !s.pick) return;
  k = Math.max(HONEY_LIT_MIN, Math.min(s.max, k | 0));
  const cs = s.pick(k).filter(c => c && c.h); if (!cs.length) return;
  s.colors = cs; s.k = k; HONEY_HL.hexes = cs.map(c => String(c.h).toUpperCase()); HONEY_HL.hv++;
  if (frame) HONEY_HL.reframe = true;
  HONEY_LIVE.forEach(f => { if (f() === false) HONEY_LIVE.delete(f); });
}
// the lit set's colors as { h, n?, share? }, biggest share first (the set's own order when it has no shares)
function honeyLitColors() {
  if (!HONEY_HL) return [];
  const cs = HONEY_HL.set && HONEY_HL.set.colors && HONEY_HL.set.colors.length ? HONEY_HL.set.colors : HONEY_HL.hexes.map(h => ({ h }));
  return cs.some(c => c.share != null) ? cs.slice().sort((a, b) => (b.share || 0) - (a.share || 0)) : cs.slice();
}
// "The Starry Night · 6 named colors · as photographed" -> a title and a subline. A bare title gets its count, and a
// painting, painter or decade says "as photographed" once (the colors are photographs of varnished paint).
const HONEY_PHOTO_KINDS = ["painting", "painter", "decade", "movement", "century", "country", "museum"];
function honeyLitLabel() {
  if (!HONEY_HL) return { title: "", sub: "" };
  const parts = String(HONEY_HL.title || "").split(" · ").map(x => x.trim()).filter(Boolean), n = honeyLitColors().length;
  const kind = HONEY_HL.set && HONEY_HL.set.kind;
  let sub = parts.slice(1).join(" · ");
  const photo = HONEY_PHOTO_KINDS.includes(kind);
  if (!sub) sub = `${n} ${photo ? "named " : ""}color${n === 1 ? "" : "s"}${photo ? " · as photographed" : ""}`;
  // David: "say it in the chip subtitle" -- which arrangement the map auto-picked to keep the selection together
  // (js/home.js hmBestArrangeFor, set on HONEY_HL.why), so "scattered" never has to be taken on faith
  if (HONEY_HL.why) sub = sub ? `${sub} · ${HONEY_HL.why}` : HONEY_HL.why;
  return { title: parts[0] || "Your set", sub };
}
// Learn these: the Learn sheet (js/learnset.js) on exactly the lit colors, with their source; it comes back to the map
function honeyLearnLit() {
  if (!HONEY_HL) return;
  const cs = honeyLitColors(), { title } = honeyLitLabel(), src = (HONEY_HL.set && HONEY_HL.set.kind) || "map";
  HONEY_HL.fresh = true;   // the map it comes back to frames the set again (a lesson's own honeycomb moves the shared pan)
  if (typeof lsOpen === "function") return lsOpen({ items: cs.map(c => c.h), label: title, src, back: "#/home" });
  if (typeof prQuick === "function") return prQuick({ items: cs.map(c => c.h), label: title, src, source: "these" });
}
// Find them: Study the map's Find it (js/mapstudy.js) on exactly the lit colors, straight into the first round
const HONEY_FIND_MIN = 3;
function honeyFindLit() {
  if (!HONEY_HL || typeof msOpen !== "function") return;
  const cs = honeyLitColors(), { title } = honeyLitLabel();
  HONEY_HL.fresh = true;   // Study the map's honeycomb moves the shared pan; coming back frames the set again
  msOpen({ set: { title, colors: cs }, mode: "find", from: "home", autostart: true });
}
// the bar itself (Home's honeycomb asks for one per lit set). Two rows: ‹, the source's picture, its title and
// subline, ✕; then the two verbs. ‹ only shows while the page that lit the set can still be reached.
function honeyLitBar() {
  const bar = document.createElement("div");
  bar.className = "cs-hl-pill cs-hl-bar"; bar.setAttribute("role", "region");
  const bk = typeof tlMapBack === "function" ? tlMapBack() : null, { title, sub } = honeyLitLabel(), cs = honeyLitColors();
  bar.setAttribute("aria-label", `On the map: ${title}`);
  const sw = (bk && bk.sw && bk.sw.length ? bk.sw : cs.map(c => c.h)).slice(0, 4);
  const thumb = bk && bk.img ? `<span class="cs-hl-th"><img src="${esc(bk.img)}" alt="" loading="lazy"></span>`
    : bk && bk.c ? `<span class="cs-hl-th" style="background:${esc(bk.c)}"></span>`
    : `<span class="cs-hl-th cs-hl-sw">${sw.map(h => `<i style="background:${esc(h)}"></i>`).join("")}</span>`;
  const canFind = typeof msOpen === "function" && cs.length >= HONEY_FIND_MIN;
  const set = HONEY_HL && HONEY_HL.set, canSize = !!(set && set.pick && set.max > HONEY_LIT_MIN);
  bar.innerHTML = `<div class="cs-hl-head">
      ${bk ? `<button class="cs-hl-back" aria-label="Back to ${esc(bk.title || title)}">${ICON.back}</button>` : ""}
      ${thumb}<span class="cs-hl-t"><b>${esc(title)}</b><i class="cs-hl-sep"> · </i><small>${esc(sub)}</small></span>
      <button class="cs-hl-x" aria-label="Show every color again">${ICON.x}</button>
    </div>
    ${canSize ? `<div class="cs-hl-n"><label class="cs-hl-nl"><span>How many</span><input type="range" min="${HONEY_LIT_MIN}" max="${set.max}" step="1" value="${cs.length}" aria-label="How many colors"><b data-hl-k>${cs.length}</b></label>
      <div class="cs-hl-cols" data-hl-cols></div></div>` : ""}
    <div class="cs-hl-acts">
      <button class="cs-hl-act on" data-hl-learn>Learn these</button>
      ${canFind ? `<button class="cs-hl-act" data-hl-find>Find them</button>` : ""}
    </div>`;
  const on = (sel, f) => { const b = bar.querySelector(sel); if (b) b.onclick = e => { e.stopPropagation(); f(); }; };
  on(".cs-hl-back", () => { buzz(6); honeyHighlight(null); bk.go(); });
  on(".cs-hl-x", () => { buzz(4); honeyHighlight(null); });
  on("[data-hl-learn]", () => { buzz(6); honeyLearnLit(); });
  on("[data-hl-find]", () => { buzz(6); honeyFindLit(); });
  if (canSize) {
    // each lit color by name with its share of the canvas, biggest first; one tap opens its page
    const cols = bar.querySelector("[data-hl-cols]"), kOut = bar.querySelector("[data-hl-k]"), input = bar.querySelector(".cs-hl-n input");
    const paint = () => {
      const now = honeyLitColors(), lab0 = honeyLitLabel();
      kOut.textContent = now.length;
      bar.querySelector(".cs-hl-t small").textContent = lab0.sub;
      cols.innerHTML = now.map(c => { const nm = c.n || (typeof nameOf === "function" ? nameOf(c.h).text : c.h), pc = c.share != null ? c.share * 100 : null;
        return `<button class="cs-hl-c" data-h="${esc(c.h)}" data-n="${esc(nm)}"><i style="background:${esc(c.h)}"></i><span>${esc(nm)}</span>${pc != null ? `<em>${pc >= 9.5 ? Math.round(pc) : pc >= .95 ? pc.toFixed(1).replace(/\.0$/, "") : "<1"}%</em>` : ""}</button>`; }).join("");
    };
    paint();
    // stops on a long range, every number on a short one, and −/+ for an exact count (countify, core.js)
    countify(input, { min: HONEY_LIT_MIN, max: set.max, value: cs.length, out: kOut, onSet: (v, final) => { honeyLitSize(v, final); paint(); if (final) buzz(3); } });
    cols.addEventListener("click", e => {
      const b = e.target.closest(".cs-hl-c"); if (!b) return; e.stopPropagation(); buzz(4);
      if (typeof openTappedColor === "function") openTappedColor(b.dataset.h, b.dataset.n);
      else if (typeof colorPage === "function") colorPage(b.dataset.n);
    });
  }
  // the bar is solid: a drag that starts on it never pans the map underneath
  bar.addEventListener("pointerdown", e => e.stopPropagation());
  return bar;
}
// where the tapped color sits in a rebuilt layout (setItems, HONEY_RET): the same name, else the nearest color
function honeyRetPoint(lay, ret) {
  if (!lay || !lay.pts.length) return null;
  let p = lay.pts.find(q => q.it.n === ret.n);
  if (!p && ret.h) { const L = lab(ret.h); let bd = Infinity; for (const q of lay.pts) { const dd = (q.it.lab[0] - L[0]) ** 2 + (q.it.lab[1] - L[1]) ** 2 + (q.it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; p = q; } } }
  return p || null;
}
function honeycomb(host, opts = {}) {
  host.classList.add("hc");
  host.innerHTML = `<div class="hc-box"><div class="hc-vig"></div><canvas class="hc-cv" aria-label="Colors as bubbles: drag to browse, pinch to zoom, tap one to open it"></canvas></div>
    <button class="hc-cap"><i></i><span><b></b><small></small></span><em></em></button>`;
  const vig = host.querySelector(".hc-vig"), cv = host.querySelector("canvas"), ctx = cv.getContext("2d"), cap = host.querySelector(".hc-cap");
  const RM = reduceMotion, SHOOT = typeof SHOT !== "undefined" && !!SHOT, ZMAX = 2.5, ABS_ZMIN = .04, M = 2.2;
  const isHome = !!(host.closest && host.closest(".hm"));   // the Home map: the one whose view a page returns to
  let springTo = null, zTo = null;   // the glide (and zoom) a touch interrupted, while that touch is still a tap
  let frozen = 0;   // when a bubble opened a page (0: none): the view saved at that moment must not be overwritten on the way out
  let vigK = -1, vigOpSet = -1;
  let styleId = typeof opts.style === "string" ? opts.style : "current", liveTweak = opts.tweak ? { ...opts.tweak } : null;
  // back-compat: callers that still pass layout/lens/lensMode directly (colorsets.js, and any legacy caller).
  // These fold into liveTweak (not a one-off cfg mutation) so they survive setItems()'s re-resolve on every call.
  if (opts.layout) liveTweak = { ...(liveTweak || {}), layout: honeyIsLayout(opts.layout) ? opts.layout : "mapTall" };
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
  // ---- map study hooks (js/mapstudy.js), all inert until ctrl.study() sets them. hit(o, at): a tap answers instead
  // of gliding/opening (and idle drift stays off); label(o) -> false hides that bubble's name; fog(o) -> false veils
  // it (the opt-in "your map" view only, never a default); marks: name -> { kind, t0 } rings drawn over the bubbles.
  const ST = { hit: null, label: null, fog: null, marks: new Map() };
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
    const s = (.72 + .28 * e) * l18Spread(Z);
    return { s, a: e, m0: zc("m0") * br, m1: zc("m1"), sig: zc("sig") * l18Flat(Z), K: base * s * M * br, inner: inner() };
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
      // David, 2026-10-09: "the app doesn't let you zoom out more... you should be able to simply zoom out and
      // see the whole map." The preset's own zMinUser is tuned to avoid a periodic moire texture, which for a
      // big set (every name, every shade) sits well short of "the whole non-repeating tile fits" -- whichever
      // asks for MORE zoom-out (the smaller Z) wins, so a small/typical set keeps its tuned floor untouched, but
      // a big one can still go all the way out to its own whole-map view.
      const whole = cfg.lensMode === "round" ? clamp(search(fits(1.1)), ABS_ZMIN, ZMAX) : clamp(need(1.1), ABS_ZMIN, ZMAX);
      return Math.min(clamp(+cfg.zMinUser, ABS_ZMIN, ZMAX), whole);
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
    if (tinyN > drawn.length * 5 && tinyN > 1500 && Z < ZMAX) { ZMIN = Math.min(ZMAX, Math.max(ZMIN, Z * 1.25)); if (Z < ZMIN) { Z = ZMIN; zAnim = null; requestAnimationFrame(() => draw()); } }
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
    if (pinch) return;   // L18: two fingers own the sheet; no lag or water wobble under them (David: pinch "wiggles")
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
    honeyCells(drawn, gapPx(), shapeAmt, L18_GROW, !!morph);
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
      if (prev != null && dt > 0 && prev < b.rin && !pinch && b.rin - prev > Math.max(1.2, prev * .1)) {   // L18: jumps ease; motion's own small steps don't
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
    if (lay.spiral && !hlSet) l18StageRings(l);
    else if (lay.bounds && !hlSet && !morph) honeyBoundsDraw(l);
    for (const b of drawn) {
      const it = b.it, d = b.d * (b === pb ? 1 + .12 * pressK : 1), r = d / 2;
      honeyCellPath(ctx, b, shapeAmt, b === pb ? 1 + .12 * pressK : 1); ctx.fillStyle = it.h; ctx.fill();
      if (ST.fog && !ST.fog(it.o)) { ctx.fillStyle = "rgba(14,13,11,.8)"; ctx.fill(); continue; }
      if (ST.label && !ST.label(it.o)) { if (d >= 8 && it.L < 26) { ctx.lineWidth = Math.max(1, d * .025); ctx.strokeStyle = "rgba(236,232,223,.24)"; ctx.stroke(); } continue; }
      if (hlSet) { if (!hlSet.has(it)) { ctx.fillStyle = "rgba(14,13,11,.8)"; ctx.fill(); continue; } ctx.lineWidth = Math.max(1.5, d * .03); ctx.strokeStyle = "rgba(239,235,227,.95)"; ctx.stroke(); }
      if (d < 8) continue;
      // David, 2026-10-09: "any way to prevent these ugly holes between the colors?" -- at the magnified focus,
      // where sizes vary most, two neighboring cells' own independently-blended shapes (honeyCellPath's circle/
      // polygon mix) don't always meet pixel-exact, leaving a sliver of the background between them. The cheap
      // fallback (true shared-edge Voronoi is its own, riskier pass): a thin seam stroked on every cell's own
      // edge, light on a dark cell and dark on a light one, reads as a deliberate boundary either way and masks
      // a stray sliver instead of leaving it bare. Was dark-cells-only; now every cell at a readable size gets one.
      ctx.lineWidth = Math.max(1, d * .018); ctx.strokeStyle = it.L < 50 ? `rgba(236,232,223,${it.L < 14 ? .34 : it.L < 26 ? .24 : .14})` : `rgba(14,13,11,${it.L > 86 ? .16 : .1})`; ctx.stroke();
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
    if (ST.marks.size) honeyStudyMarks(ctx, drawn, ST.marks, t);
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
    if (lay.globe) buildGlobeDrawn(l, t); else { buildFlatDrawn(l, t); if (morph) l18MorphApply(t); }
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
    if (phase === "idle" && ALIVE && !ST.hit && !down && !pinch && (t - lastInput) > 4000) { phase = "drift"; driftT0 = t; driftTeff = 0; driftAnchor = P.slice(); }
    if (fly && flyStep(t)) more = true;
    if (zAnim) {
      const nz = Math.abs(zAnim.to - Z) < .003 ? zAnim.to : Z + (zAnim.to - Z) * Math.min(1, dt * (RM ? 60 : 11));
      zoomAround(nz, zAnim.sx, zAnim.sy);
      if (nz === zAnim.to) { zAnim = null; if (opts.onZoom) opts.onZoom(Z); if (!down && !pinch && !lay.globe && phase !== "spring") snap(); } else more = true;
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
    if (ALIVE && !pinch) {
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
    if (ST.marks.size && honeyStudyAnimating(ST.marks, t)) more = true;
    if (bloom < 1) { bloom = Math.min(1, (t - bloomT0) / 700); more = true; }
    if (ghost || morph) more = true;
    draw(t);
    if (more) kick();
  }
  // (each kind of map keeps its own: a browse view or a favorites map never overwrites where you were on Home)
  const remember = () => { if (!lay || frozen) return; const v = { key: lay.key, x: P[0], y: P[1], z: Z, name: center && center.n }; if (isHome) HONEY_PAN = v; else HONEY_PAN_ALT = v; };
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
  // ---- L18 fly: one calm move of pan AND zoom together (the zoomed-out tap rule, and search 2.0's "fly there").
  // Zoom eases on a log scale (so a 10x zoom feels even); dip > 0 pulls back a little mid-flight so you see the
  // distance traveled. A touch cancels it (pointerdown below), and it never snaps: honeyEaseS has 0 slope at both ends.
  let fly = null;
  function flyTo(X, z1, o = {}) {
    if (!lay || lay.globe) return;
    z1 = clamp(z1 == null ? Z : z1, ZMIN, ZMAX);
    const dist = Math.hypot(X[0] - P[0], X[1] - P[1]);
    fly = { t0: performance.now(), dur: RM ? 1 : o.dur || clamp(420 + dist * 14, 480, 900), P0: P.slice(), X: X.slice(), Z0: Z, Z1: z1, dip: RM ? 0 : o.dip || 0 };
    spring = null; zAnim = null; phase = "fly"; if (o.buzz !== false) buzz(4);
    if (SHOOT) { flyStep(fly.t0 + fly.dur); return; }   // screenshot/test runs land at once (headless has no frames)
    kick();
  }
  function flyStep(t) {
    const f = fly, u = clamp((t - f.t0) / f.dur, 0, 1), e = honeyEaseS(u);
    const zz = f.Z0 * Math.pow(f.Z1 / f.Z0, e) * (1 - f.dip * Math.sin(Math.PI * u));
    Z = Math.max(ZMIN, zz);
    P = [f.P0[0] + (f.X[0] - f.P0[0]) * e, f.P0[1] + (f.X[1] - f.P0[1]) * e];
    if (u < 1) return true;
    fly = null; phase = "idle"; P = f.X.slice(); Z = clamp(f.Z1, ZMIN, ZMAX);
    if (opts.onZoom) opts.onZoom(Z);
    draw(t); settle();
    return false;
  }
  // the zoomed-out tap rule (David, MASTER-PLAN 0c): when the map is zoomed out and bubbles are tiny, a tap zooms
  // in to that bubble and centers it; the next tap (it's now the center) opens its page.
  const L18_TINY_D = 46;
  function l18ZoomedOut() {
    // the center's own copy (a wrapping map repeats it; a far copy is always tiny): the biggest one on screen
    let cd = 0; for (const q of drawn) if (q.it === center && q.d > cd) cd = q.d;
    return cd > 0 && cd < Math.max(L18_TINY_D, zc("labelMin") * 1.8);
  }
  function l18ZoomOnto(p) {
    const o = offAt(p.x, p.y, lens(0)), X = [P[0] + o[0], P[1] + o[1]];
    const pz = HONEY_STYLES[styleId], z0 = pz && pz.initialZoom ? pz.initialZoom(lay.raw.length) : 1;
    flyTo(X, Math.max(Z * 1.6, Math.min(1, Math.max(z0, .7))));
  }
  // ---- L18 H3: the stage glide. Kept bubbles slide from where they were to where they now belong (shrinking
  // a little mid-flight, so nothing collides), removed ones shrink away in the first 250 ms, then new ones bloom in
  // between. Positions only: honeyCells still sizes every bubble from its real neighbors each frame, so the
  // no-overlap guarantee holds at every moment of the glide.
  let morph = null, l18ForceMorph = false;
  const L18_MORPH_MS = 450, L18_ARRANGE_MS = 680;
  let morphMs = L18_MORPH_MS;
  function l18Snapshot() {
    const old = new Map();
    for (const b of drawn) { if (b.d < 1) continue; let a = old.get(b.it.n); if (!a) old.set(b.it.n, a = []); a.push({ x: b.x, y: b.y, d: b.d, it: b.it }); }
    return old;
  }
  const l18MorphStart = old => ({ t0: performance.now(), old });
  function l18MorphApply(t) {
    const m = morph, u = clamp((t - m.t0) / morphMs, 0, 1);
    if (u >= 1) { morph = null; return; }
    const e = honeyEaseS(u), shrink = 1 - .15 * Math.sin(Math.PI * u), grow = honeyEaseS(clamp((u - .56) / .44, 0, 1));
    const used = new Set();
    for (const b of drawn) {
      const a = m.old.get(b.it.n);
      let o = null, bd = Infinity;
      if (a) for (const q of a) { if (used.has(q)) continue; const d = (q.x - b.x) ** 2 + (q.y - b.y) ** 2; if (d < bd) { bd = d; o = q; } }
      // new here: blooms in between once the leaving colors have gone (a new color often lands on the exact spot a
      // leaving one held, so the two never share it)
      if (!o) { b.d *= grow; continue; }
      used.add(o);
      // a gentle arc, not a straight line: two colors trading places curve past each other instead of meeting
      // head-on in the middle (and it reads as flight)
      const dx = b.x - o.x, dy = b.y - o.y, arc = .14 * Math.sin(Math.PI * u);
      b.x = o.x + dx * e - dy * arc; b.y = o.y + dy * e + dx * arc; b.d = (o.d + (b.d - o.d) * e) * shrink;
      b.k = null;   // mid-glide sizes are the glide's, not the size memory's
    }
    if (grow <= 0) drawn = drawn.filter(b => b.d > 0);
    // removed colors (and kept ones whose new place is off screen) shrink away where they were
    const gu = 1 - honeyEaseS(clamp(u * morphMs / 250, 0, 1));
    if (gu > 0) {
      const here = new Set(); for (const b of drawn) here.add(b.it.n);
      const n0 = drawn.length;
      m.old.forEach((a, n) => { if (!here.has(n)) for (const o of a) drawn.push({ it: o.it, x: o.x, y: o.y, d: o.d * gu, z: 1e9 }); });
      if (drawn.length > HONEY_MAX_DRAWN) drawn.length = Math.max(n0, HONEY_MAX_DRAWN);
    }
  }
  // QA (tools/smoke map group): glide to a new set and scan for overlaps at u = .25, .5 and .75
  function l18MorphCheck(items) {
    l18ForceMorph = true; setItems(items, center && center.o, "soft"); l18ForceMorph = false;
    const m = morph; if (!m) return { ok: false, why: "no glide" };
    const out = [];
    for (const u of [.25, .5, .75]) {
      m.t0 = performance.now() - u * morphMs; morph = m; draw(performance.now());
      let bad = 0;
      for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
        const a = drawn[i], c = drawn[j], dd = Math.hypot(a.x - c.x, a.y - c.y); if (dd < (a.d + c.d) / 2 - .3) { bad++; if (bad < 4) out.ex = (out.ex || []).concat([[a.it.n, c.it.n, +dd.toFixed(2), +a.d.toFixed(2), +c.d.toFixed(2), a.z === 1e9, c.z === 1e9, !!a.poly, !!c.poly]]); }
      }
      out.push({ u, drawn: drawn.length, bad, ex: out.ex }); out.ex = null;
    }
    morph = null; draw();
    return { ok: out.every(r => !r.bad), out };
  }
  // L18 H4: a freshly lit constellation is framed: centered on its middle and zoomed out just enough to hold it all
  function l18FrameLit() {
    if (!lay || lay.globe || !W) return;
    const set = hlItems(); if (!set || set.size < 2) return;
    const pts = [...set].map(l18WorldOf).filter(Boolean); if (pts.length < 2) return;
    // the middle is the lit bubble closest to all the others (never an empty patch between them); the zoom holds
    // the nearer two thirds big enough to read, and the outliers still show, smaller, toward the edge
    const sum = p => pts.reduce((t, q) => t + Math.hypot(p[0] - q[0], p[1] - q[1]), 0), mid = pts.reduce((m, p) => sum(p) < sum(m) ? p : m, pts[0]);
    const [cx, cy] = mid, ds = pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)).sort((a, b) => a - b);
    const dmax = ds[Math.min(ds.length - 1, Math.ceil(ds.length * .67))] + .8, R = Math.min(W, vy()) / 2 - 34;
    const fits = z => cfg.lensMode === "round" ? F(dmax, { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig }) <= R : dmax * base * z * M <= R;
    let lo = ZMIN, hi = Math.max(ZMIN, Z);
    if (!fits(lo)) hi = lo; else for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    P = [cx, cy]; Plag = P.slice(); Z = clamp(Math.min(Z, lo), ZMIN, ZMAX); center = null; draw(); settled = center;
  }
  // L18 H5: the stage rings, on the ground between bubbles: a thin circle where each stage ends (the bubble at
  // index i sits at .56*sqrt(i + .5), so a ring at .56*sqrt(n) falls in the seam between stage n's last name and the
  // next one), mapped through the lens like everything else. No numbers: a label would have to sit on a bubble, and
  // nothing marks a bubble (X7); the View sheet's stage chips name the rings.
  function l18StageRings(l) {
    if (typeof HM_STAGES === "undefined" || !lay.pts.length) return;
    const N = lay.pts.length, cx = W / 2, cy = vcy(), round = cfg.lensMode === "round";
    const scr = (wx, wy) => {
      const ex = wx - P[0], ey = wy - P[1], z = Math.hypot(ex, ey);
      if (round) { const k = z ? F(z, l) / z : base * l.s * l.m0; return [cx + ex * k, cy + ey * k]; }
      return [cx + ex * l.K, cy + ey * l.K];
    };
    ctx.save(); ctx.lineWidth = 1.25; ctx.strokeStyle = "rgba(236,232,223,.3)";
    HM_STAGES.forEach(n => {
      if (n >= N) return;
      const R = .56 * Math.sqrt(n);
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) { const a = i / 96 * 6.2832, q = scr(R * Math.cos(a), R * Math.sin(a)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
    });
    ctx.restore();
  }
  // the seams between groups on a rings arrangement (Path rings: one per stage; What you know: Learned | Learning |
  // New), on the ground between bubbles, mapped through the lens. Thin and quiet; never a mark on a bubble (X7).
  function honeyBoundsDraw(l) {
    const cx = W / 2, cy = vcy(), round = cfg.lensMode === "round", B = 72;
    const scr = (wx, wy) => {
      const ex = wx - P[0], ey = wy - P[1], z = Math.hypot(ex, ey);
      if (round) { const k = z ? F(z, l) / z : base * l.s * l.m0; return [cx + ex * k, cy + ey * k]; }
      return [cx + ex * l.K, cy + ey * l.K];
    };
    // the layout was centered after the rings were measured: the curves are around the layout's own origin shift
    const o = lay.boundsAt || [0, 0];
    ctx.save(); ctx.lineWidth = 1.25; ctx.strokeStyle = "rgba(236,232,223,.32)"; ctx.setLineDash([5, 5]);
    for (const rr of lay.bounds) {
      ctx.beginPath();
      for (let i = 0; i <= B; i++) { const a = ((i % B) + .5) / B * 2 * Math.PI, r = rr[i % B], q = scr(o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // where an item sits in the plane, the copy nearest the current pan (a wrapping map repeats every item)
  function l18WorldOf(it) {
    let best = null, bd = Infinity;
    const R = lay.finite ? 1e9 : Math.max(2, lay.per) * 1.5;
    for (const p of lay.pts) if (p.it === it) copies(p, P, R, (ex, ey) => { const d = ex * ex + ey * ey; if (d < bd) { bd = d; best = [P[0] + ex, P[1] + ey]; } });
    return best;
  }
  function l18Nearest(x, y, rad) {
    let best = null, bd = rad;
    for (const q of drawn) { const d = Math.hypot(q.x - x, q.y - y) - q.d / 2; if (d < bd) { bd = d; best = q; } }
    return best;
  }
  function l18ItemNear(h) {
    if (!lay) return null;
    const H = String(h || "").toUpperCase(), L = lab(H);
    let best = null, bd = Infinity;
    for (const it of lay.items) { if (String(it.h).toUpperCase() === H) return it; const d = (it.lab[0] - L[0]) ** 2 + (it.lab[1] - L[1]) ** 2 + (it.lab[2] - L[2]) ** 2; if (d < bd) { bd = d; best = it; } }
    return best;
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
  // A bubble opens on pointerup, so the page is already under the finger when a phone sends the tap's own click
  // a moment later: that click must not land on the new page (it pressed whatever sat at the bubble's spot).
  const swallowClick = e => {
    if (e.pointerType === "mouse") return;
    const x = e.clientX, y = e.clientY, t0 = performance.now();
    const eat = ev => { if (performance.now() - t0 < 600 && Math.hypot(ev.clientX - x, ev.clientY - y) < 30) { ev.preventDefault(); ev.stopPropagation(); } done(); };
    const done = () => { removeEventListener("click", eat, true); clearTimeout(tm); };
    const tm = setTimeout(done, 600);
    addEventListener("click", eat, true);
  };
  const GLOBE_ROT_K = 150;
  cv.addEventListener("pointerdown", e => {
    if (!lay) return;
    if (frozen && performance.now() - frozen > 1500) frozen = 0;   // still here long after an open that never left: the view is yours again
    lastInput = performance.now();
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]); touchXY = [x, y];
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (phase === "spring" || zAnim) loop(performance.now());
    // a tap that catches a glide opens where the glide was going (open() saves that view, not the half-way one)
    springTo = phase === "spring" && spring ? spring.X.slice() : null; zTo = zAnim ? zAnim.to : null;
    phase = "drag"; spring = null; zAnim = null; fly = null; touched = true;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = lay.globe ? [0, 0] : offAt(mid[0], mid[1], lens(0));
      pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), Z0: Z, W0: [P[0] + o[0], P[1] + o[1]], t0: performance.now(), moved: false };
      pressed = null; down = null; paint = null; clearTimeout(holdT); clearTimeout(tapTimer); kick(); return;
    }
    if (ptrs.size > 2 || pinch) return;
    // zoomed out, bubbles are smaller than a fingertip: the nearest one within a finger's reach counts (L18)
    const b = hit(x, y) || (!sel && l18ZoomedOut() ? l18Nearest(x, y, 22) : null);
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
      const [a, b] = [...ptrs.values()], mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      // L18: a light low-pass on the fingers (half a frame of lag), so pixel jitter never shakes the whole map
      pinch.sd = pinch.sd == null ? d0 : pinch.sd + (d0 - pinch.sd) * .55;
      pinch.sm = pinch.sm ? [pinch.sm[0] + (mid0[0] - pinch.sm[0]) * .55, pinch.sm[1] + (mid0[1] - pinch.sm[1]) * .55] : mid0;
      const d = pinch.sd, mid = pinch.sm;
      if (Math.abs(d0 - pinch.d0) > 8) { pinch.moved = true; if (fitMode) fitUserOverride = true; }
      Z = rubber(pinch.Z0 * d / pinch.d0);
      if (!lay.globe) { const o = offAt(mid[0], mid[1], lens(0)); P = [pinch.W0[0] - o[0], pinch.W0[1] - o[1]]; }
      draw(); return;
    }
    if (!down) return;
    if (paint) { const pb = hit(x, y); if (pb) selSet(pb.it, paint.on); return; }
    const dx = x - down.x, dy = y - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 10) { down.moved = true; if (fitMode) fitUserOverride = true; springTo = zTo = null; pressed = null; glided = null; clearTimeout(holdT); kick(); }
    if (!down.moved) return;
    const now = performance.now();
    if (lay.globe) { P = [down.P0[0] + dx / GLOBE_ROT_K, clamp(down.P0[1] - dy / GLOBE_ROT_K, -1.5, 1.5)]; }
    else {
      const k = centerK(lens(0));
      P = [down.P0[0] - dx / k, down.P0[1] - dy / k];
      if (lay.finite) {
        const r = Math.hypot(P[0], P[1]), ext = lay.ext + .6;
        if (r > ext) { const s = Math.min(ext + (r - ext) * .35, ext + 1.5) / r; P = [P[0] * s, P[1] * s]; }   // L18: a soft rubber band with a hard stop
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
      if (ST.hit) {   // map study: a tap is an answer, at once (no double-tap wait, no glide, no peek)
        pressed = null; kick();
        if (p && e.type === "pointerup") { if (!RM && !SHOOT) ripples.push({ x: p.x, y: p.y, t0: now, sigma: Math.max(22, p.b.d * .85) }); ST.hit(p.it.o, { x: p.x, y: p.y, d: p.b.d }); }
        return;
      }
      if (sel && p && e.type === "pointerup") { pressed = null; selSet(p.it, !sel.isOn(p.it.o)); kick(); return; }
      if (p && opts.onPeek && held >= 480) { pressed = null; kick(); return opts.onPeek(p.it.o); }
      // double-tap zoom is for empty space only: a tap on a bubble never waits to see whether a second one follows
      if (!p && lastTap && now - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 36) {
        clearTimeout(tapTimer); lastTap = null; pressed = null; kick();
        return zoomTo(Z > 1.25 ? 1 : 2.1, d.x, d.y);
      }
      lastTap = p ? null : { t: now, x: d.x, y: d.y };
      if (p && e.type === "pointerup") {
        if (!RM && !SHOOT && cfg.alive > 0) { ripples.push({ x: p.x, y: p.y, t0: now, sigma: Math.max(22, p.b.d * .85) }); if (ripples.length > 4) ripples.shift(); }
        // centerFirst: a tap on an off-center bubble glides it to the middle; a tap on the middle one opens it.
        // "The middle one" is the bubble the view itself calls its center (the caption's), or the one we just glided
        // there. Distance alone wasn't enough: idle drift, the panel inset and the lens could leave the centered
        // bubble a few px off, so a tap on it only glided again and never opened (David).
        // The open zone (David): the center bubble AND the ring touching it open on one tap; only bubbles further out
        // glide to the middle first. The ring's reach is measured from the center bubble's edge, one tapped-bubble wide.
        // zoomed out (L18): a tap on a tiny bubble zooms in onto it first; the next tap opens it
        if (opts.centerFirst && !lay.globe && p.it !== glided && l18ZoomedOut()) {
          glided = p.it; pressed = null; kick(); return l18ZoomOnto(p);
        }
        const cb = drawn.find(q => q.it === center), cd = cb ? cb.d : p.b.d;
        const reach = Math.max(cd * .5 + p.b.d * .95, Math.min(W, vy()) * .16);
        const far = opts.centerFirst && p.it !== center && p.it !== glided && Math.hypot(p.x - W / 2, p.y - vcy()) > reach;
        pressed = null; kick();
        if (far) { glided = p.it; lay.globe ? glideToGlobe(p.it) : glideTo(p.x, p.y); } else { glided = null; swallowClick(e); open(p.it, p.b); }
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
    lastInput = performance.now(); fly = null;
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

  // A drawn bubble's exact on-screen shape, for the bubble-becomes-its-page move (js/mapxfer.js): its center in
  // viewport px, its outline as 72 rays (circle, true hexagon or the blend between, exactly as honeyCellPath draws it)
  // and its label as drawn (lines, size, ink), or null when it is too small to carry one.
  function geoOf(b) {
    if (!b || !(b.d > 0)) return null;
    const r = cv.getBoundingClientRect(), shp = zc("shape"), rays = [];
    for (let i = 0; i < 72; i++) { const t = i / 72 * 6.283185307; rays.push(b.poly && shp > .02 && b.rin >= 3 ? b.rin * (1 - shp) + honeyRay(b.poly, t) * shp : b.rin); }
    const it = b.it, la = (b.d - zc("labelMin")) / 5;
    let label = null;
    if (la > .5 && !(ST.label && !ST.label(it.o))) { const w = honeyWrap(ctx, it.n), fs = Math.min(w.fs * b.d, 30); label = { lines: w.lines, fs, lh: fs * 1.02, ink: it.ink }; }
    return { x: r.left + b.x, y: r.top + b.y, d: b.d, rays, label, h: it.h, n: it.n };
  }
  function open(it, b) {
    if (frozen && isHome) return;   // one tap, one page: a second tap while the first page is on its way does nothing
    // the exact view at this moment (a glide in flight counts as where it was going), kept as is until the map is
    // built again: nothing on the way out (a settling spring, destroy) may overwrite it
    const gliding = !!(phase === "spring" && spring) || !!springTo, at = phase === "spring" && spring ? spring.X.slice() : springTo ? springTo.slice() : P.slice(), z = zAnim ? zAnim.to : zTo != null ? zTo : Z;
    springTo = zTo = null;
    if (lay && isHome) {
      HONEY_PAN = { key: lay.key, x: at[0], y: at[1], z, name: it.n };
      HONEY_RET = { key: lay.key, x: at[0], y: at[1], z, n: it.n, h: it.h, sx: b && !gliding ? b.x : null, sy: b && !gliding ? b.y : null };
      frozen = performance.now();
    } else remember();
    // a small positioned element standing in for the tapped bubble — the honeycomb itself is a canvas, so
    // there's no real DOM element at the bubble's spot for growFrom()/morphFrom() to read a rect from.
    const mkSrc = () => {
      if (!b) return null;
      cv.parentNode.querySelectorAll(".hc-morph").forEach(n => n.remove());   // only ever one, and only for this tap
      const m = document.createElement("div"), r = b.d * 1.06;
      m.className = "hc-morph"; Object.assign(m.style, { left: b.x - r / 2 + "px", top: b.y - r / 2 + "px", width: r + "px", height: r + "px", background: it.h });
      cv.parentNode.appendChild(m);
      setTimeout(() => m.remove(), 700);   // a stand-in lives for one tap; it can never stay stuck on the map
      return m;
    };
    const morph = () => { const m = mkSrc(); if (m) { morphFrom(m); m.remove(); } };
    if (opts.pick) opts.pick(it.o, { morph, srcEl: mkSrc, geo: () => geoOf(b) });
  }

  // ---- contents ----
  function setItems(raw, focus, how) {
    raw = raw && raw.length ? raw : EVERY().map(c => ({ n: c.n, h: c.h, c }));
    // L18 H3: a soft change between flat layouts glides instead of crossfading (Reduced Motion keeps the crossfade)
    const snap0 = how === "soft" && W && !RM && (!SHOOT || l18ForceMorph) && lay && !lay.globe && drawn.length ? l18Snapshot() : null;
    morph = null;
    if (how === "soft" && W && !RM && !snap0) {
      ghost = ghost || document.createElement("canvas"); ghost.on = true;
      if (ghost.width !== cv.width || ghost.height !== cv.height) { ghost.width = cv.width; ghost.height = cv.height; }
      const g = ghost.getContext("2d"); g.clearRect(0, 0, ghost.width, ghost.height); g.drawImage(cv, 0, 0); ghostT0 = performance.now();
    }
    cfg = honeyResolveCfg(styleId, liveTweak, raw.length);
    lay = honeyLayout(raw, cfg.layout);
    if (snap0 && !lay.globe) morph = l18MorphStart(snap0);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX);
    const PAN = isHome ? HONEY_PAN : HONEY_PAN_ALT;
    // a return from a page a bubble opened (HONEY_RET, saved in open()): used once, by the Home map only
    const ret = how === "restore" && isHome && HONEY_RET ? HONEY_RET : null;
    if (ret) HONEY_RET = null;
    let restored = false;
    if (lay.globe) {
      // P means [yaw, pitch] here, not a plane offset — see the pointer handlers above
      if (how === "restore" && PAN && PAN.key === lay.key) { P = [PAN.x, PAN.y]; if (PAN.z) Z = clamp(PAN.z, ZMIN, ZMAX); restored = true;   /* L18: the last zoom you left, always */ }
      else {
        const f = focus && (focus.h ? focus : BYNAME.get(String(focus.n || "").toLowerCase())), p = f && lay.pts.find(q => q.it.n === f.n);
        P = p ? [-p.lon, clamp(Math.asin(clamp(p.y, -1, 1)), -1.5, 1.5)] : [0, 0];
      }
    } else if (how === "restore" && PAN && PAN.key === lay.key) {
      // exactly the view you left (David, 2026-10-08): no re-centering and no snap to the nearest bubble. A tap made
      // mid-glide saved the glide's destination (open()), so this is never a half-way pan.
      P = [PAN.x, PAN.y]; if (PAN.z) Z = clamp(PAN.z, ZMIN, ZMAX);   /* L18: the last zoom you left, always */
      restored = true;
    } else if (ret && (ret.p = honeyRetPoint(lay, ret))) {
      // the set changed while you were away (a filter, a word you learned): the color you tapped goes back under the
      // same screen point, at the same zoom
      if (ret.z) Z = clamp(ret.z, ZMIN, ZMAX);
      const o = ret.sx != null && W ? offAt(ret.sx, ret.sy, lens(0)) : [0, 0];
      P = [ret.p.x - o[0], ret.p.y - o[1]];
      restored = true;
    }
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
    // a restored view stays put (idle drift resumes after the usual pause); a fresh one may float at once, from here
    // (it used to drift from a stale anchor at the origin, which pulled a restored map away from where you left it)
    phase = touched || restored ? "idle" : "drift"; spring = null;
    if (phase === "drift") { driftT0 = performance.now(); driftTeff = 0; driftAnchor = P.slice(); }
    // coming back to the view you left: no bloom (the page is shrinking back into its bubble, which is already there)
    if (ret && restored) bloom = 1;
    else if (how !== "soft" && !RM && !SHOOT) { bloom = 0; bloomT0 = performance.now(); }
    kick();
  }

  // ---- size, visibility, teardown ----
  function resize() {
    // L18 (David: panning "goes completely white and breaks"): 2x is as sharp as a phone can show for bubbles, and
    // a 3x full-screen canvas is 12 MB a copy; iOS blanks every canvas once their total passes its limit
    // the layout size, not the painted one: a map caught mid-zoom by a page transition (js/mapxfer.js scales the screen)
    // must not measure itself 12% bigger
    const r = cv.clientWidth ? { width: cv.clientWidth, height: cv.clientHeight } : cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; Hh = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    base = clamp(W / 13, 26, 34); ghost = null; ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  // L18: a canvas whose context the browser dropped (memory pressure) comes back drawn, not blank
  cv.addEventListener("contextlost", e => e.preventDefault());
  cv.addEventListener("contextrestored", () => { sizeMem = new Map(); draw(); });
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting && !document.hidden; if (visible) kick(); }) : null;
  if (io) io.observe(host);
  const vis = () => { visible = !document.hidden; if (visible) kick(); };
  document.addEventListener("visibilitychange", vis);
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('16px "Instrument Serif"'), document.fonts.load('500 12px "Geist Mono"')]).then(() => { HONEY_WRAP.clear(); draw(); }).catch(() => {});
  function destroy() {
    if (dead) return;
    remember(); dead = true; clearTimeout(tapTimer); clearTimeout(wheelT);
    cancelAnimationFrame(raf); raf = 0; ro.disconnect(); if (io) io.disconnect();
    // L18: give the canvas memory back now (iOS only frees it on a later GC, and every Home rebuild made a new one)
    setTimeout(() => { try { cv.width = cv.height = 0; if (ghost) ghost.width = ghost.height = 0; ghost = null; } catch (e) {} }, 600);
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
    if (hlMemo && hlMemo.lay === lay && hlMemo.rev === HONEY_HL.rev && hlMemo.hv === HONEY_HL.hv) return hlMemo.set;
    const its = [...new Set(lay.pts.map(q => q.it).filter(Boolean))], set = new Set();
    HONEY_HL.hexes.forEach(h => { const L = lab(h); let best = null, bd = Infinity; for (const it of its) { const dd = (it.lab[0] - L[0]) ** 2 + (it.lab[1] - L[1]) ** 2 + (it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; best = it; } } if (best) set.add(best); });
    hlMemo = { lay, rev: HONEY_HL.rev, hv: HONEY_HL.hv, set };
    hlShowPill();
    return set;
  }
  let hlPill = null;
  function hlShowPill() {
    if (!host.parentElement || (hlPill && +hlPill.dataset.rev === HONEY_HL.rev)) return;
    if (hlPill) hlPill.remove();   // a new set lit while the map is open (search lights a painter): its own bar
    hlPill = honeyLitBar(); hlPill.dataset.rev = HONEY_HL.rev;
    host.parentElement.appendChild(hlPill);
  }
  if (hlOn) HONEY_LIVE.add(() => { if (dead) return false; hlMemo = null; if (HONEY_HL && HONEY_HL.reframe) { HONEY_HL.reframe = false; l18FrameLit(); } else draw(); return true; });
  let hlFocus = null;
  if (hlOn && HONEY_HL && HONEY_HL.fresh) { HONEY_HL.fresh = false; hlFocus = { h: HONEY_HL.hexes[0] }; }
  if (hlFocus) { setItems(opts.items, opts.focus || hlFocus, ""); l18FrameLit(); }
  else { const PAN = isHome ? HONEY_PAN : HONEY_PAN_ALT; setItems(opts.items, opts.focus || (PAN && { n: PAN.name }), "restore"); }
  // ---- the Tweak panel's API: live overrides on top of the active preset, saved by the caller (S.hm.tweak) ----
  function applyTweak(partial) {
    liveTweak = { ...(liveTweak || {}), ...partial };
    cfg = honeyResolveCfg(styleId, liveTweak, lay ? lay.raw.length : 101);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  // ---- fit mode (David, 2026-10-09: the Arrange sheet covers the middle of the map, so zoomed in "you can
  // barely see the difference between views" when a setting changes it): while it's on, the map flies to frame
  // the WHOLE current layout's bounds -- every cell's actual world (x,y), not zFloor's radial "whole book"
  // approximation, which under- or over-zoomed for anything that isn't roughly circular (Families' three-wide
  // grid, the Map's own tall tile) -- into whatever's left above the sheet (vcy()/vy() already track the inset,
  // itself measured from the sheet's own getBoundingClientRect().top by js/home.js chooser's applyInset), with a
  // real ~16px margin on every side. Re-fit happens only on an actual arrangement/order/style change (o.arrange),
  // not on every soft update -- and not at all once the user has panned or pinched manually (fitUserOverride),
  // so choosing an arrangement doesn't fight a view they just set up themselves; it resumes on the NEXT
  // arrangement change, a deliberate action. The pan and zoom from before fitting are remembered and restored
  // (not just reset to default) when it turns off.
  let fitMode = false, fitSaved = null, fitUserOverride = false;
  const boundsFit = () => {
    if (!lay || lay.globe || !lay.pts.length || !W) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of lay.pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, halfW = Math.max(.15, (maxX - minX) / 2), halfH = Math.max(.15, (maxY - minY) / 2);
    // insetBottom (the target the sheet's own height was just measured to), not vy()/insetCur: the inset eases in
    // over ~300ms (honey.js's own loop() tween), so fitting against the CURRENT (still mid-tween) value would aim
    // for wherever the sheet happened to be a moment ago, not where it's about to settle.
    // David, 2026-10-09: "the original view is now too far away" -- the disk floated at ~45% of the available
    // width instead of filling it edge to edge. Two things compounded to cause that: (1) the margin reserved for
    // the fisheye's magnified middle bubble was counted TWICE (once as extra margin scaled by base*m0, again as a
    // 1.35x inflation of R below) -- now just the plain ~16px margin David asked for, plus one small (1.08x)
    // allowance for the magnified middle bubble's drawn radius sticking a little past the raw lattice points'
    // bounding box; and (2) fitting a single circumscribed-circle R (the content's half-diagonal) into the
    // available rect's own half-diagonal only matches when the content's aspect happens to match the available
    // rect's -- a lopsided shape (a tall, narrow region into a wide-and-short rect, or back) is under-constrained
    // on its tighter axis, so one axis can overflow well past the sheet while the other still has room to spare.
    // Checking width and height as two independent constraints on the SAME z (both must hold, so the smaller --
    // more zoomed out -- survives) fixes both axes at once; js/honey.js's own zFloor() does the same AND-of-two-
    // axes trick already (the `fits` helper a little above this function).
    // David, 2026-10-09: "width ~= screen width minus ~16px margins" -- just the plain margin, no extra safety
    // factor on top of it. The per-point check below already uses each point's own REAL drawn position (the
    // same F(r,l)/r radial transform the renderer itself uses, not an approximation of where the magnified
    // middle bubble might land), so there is nothing left to pad for.
    const margin = 16, pad = 1;
    const availW = Math.max(40, W - margin * 2), availH = Math.max(40, Hh - insetBottom - margin * 2);
    // fit mode wants the OPPOSITE search direction from zFloor()'s own `search` a little above (its own
    // minimum-zoom floor): here we want the LARGEST zoom that still keeps everything in bounds, so the content
    // fills as much of the available rect as it can without overflowing it.
    const searchMax = bad => {
      let lo = ABS_ZMIN, hi = ZMAX;
      if (!bad(hi)) return hi;
      if (bad(lo)) return lo;
      for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (bad(m)) hi = m; else lo = m; }
      return lo;
    };
    let zt;
    if (cfg.lensMode === "round") {
      // the real draw transform (buildFlatDrawn's round branch, just above): a world offset (ex,ey) from the
      // layout's own center draws at screen offset (ex,ey) * F(r,l)/r, r = hypot(ex,ey) -- a radial warp, not a
      // separable per-axis one. So (unlike fitting a single circumscribed circle, or checking width/height as
      // independent axes) the true screen extent has to be checked against every point's own direction: a point
      // near the diagonal needs neither the plain half-width nor the plain half-height, but the warp still
      // amplifies it by its own (larger) radial distance from center, same as every other point that far out.
      zt = searchMax(z => {
        const l = { s: z, m0: cfg.m0, m1: cfg.m1, sig: cfg.sig };
        for (const p of lay.pts) {
          const ex = p.x - cx, ey = p.y - cy, r = Math.hypot(ex, ey);
          if (!r) continue;
          const k = F(r, l) / r;
          if (Math.abs(ex * k) * pad > availW / 2 || Math.abs(ey * k) * pad > availH / 2) return true;
        }
        return false;
      });
    } else {
      zt = Math.min(availW / 2 / (base * M * halfW * pad), availH / 2 / (base * M * halfH * pad));
    }
    return { cx, cy, z: clamp(zt, ABS_ZMIN, ZMAX) };
  };
  const flyToFit = (animate = true) => {
    const f = boundsFit(); if (!f) return;
    // flyTo() clamps its target to [ZMIN, ZMAX] -- ZMIN is the ordinary pinch-out floor (zFloor(), tuned to avoid
    // a moire texture on a wrapping set), which exists to stop the USER zooming out too far, not to cap how far
    // IN fit mode is allowed to go to show the whole layout above the sheet. A fit target below it must lower it
    // first, or flyTo silently re-clamps back up to ZMIN and fit mode zooms in instead of out.
    if (f.z < ZMIN) ZMIN = f.z;
    if (animate) flyTo([f.cx, f.cy], f.z, { buzz: false });
    else { P = [f.cx, f.cy]; Plag = P.slice(); Z = f.z; draw(); }
  };
  return {
    update(o = {}) {
      if (o.layout) liveTweak = { ...(liveTweak || {}), layout: honeyIsLayout(o.layout) ? o.layout : "mapTall" };
      if (o.tweak) liveTweak = { ...(liveTweak || {}), ...o.tweak };
      if (o.style && HONEY_STYLES[o.style]) styleId = o.style;
      // a new arrangement is a longer, calmer glide (each bubble flies across the map to its new place)
      morphMs = o.arrange ? L18_ARRANGE_MS : L18_MORPH_MS;
      setItems(o.items || (lay && lay.raw), o.focus || (center && center.o), o.soft ? "soft" : "");
      // regions (Families, Hue pages) read best whole: the arrival eases out until most of the book is in view
      const arr = HONEY_ARR[honeyParseKey(cfg.layout).id];
      // fit mode (the Arrange sheet is open) wins over every other arrival, but only re-fits on an actual
      // arrangement change (a new layout has new bounds) -- not a soft/filter update. Picking a new arrangement
      // is itself a deliberate action, so it always re-fits and clears any pan/pinch override from before; a
      // soft update (a feel slider, say) respects whatever view the user is already looking at.
      if (fitMode && o.arrange) { fitUserOverride = false; flyToFit(true); }
      else if (fitMode) {}
      else if (o.arrange && hlOn && HONEY_HL) l18FrameLit();
      else if (o.arrange && arr && arr.fit && !lay.globe) { P = [0, 0]; Plag = P.slice(); zoomTo(Math.max(ZMIN, Math.min(Z, ZMIN * 1.3)), W / 2, vcy()); }
      // a new order travels to the middle (for Center on, where the chosen color now sits)
      else if (o.recenter && lay.finite && !lay.globe && lay.pts.length) { const c = lay.pts.reduce((m, q) => Math.hypot(q.x, q.y) < Math.hypot(m.x, m.y) ? q : m, lay.pts[0]); P = [c.x, c.y]; Plag = P.slice(); draw(); }
    },
    zoom: (z, animate = true) => animate ? zoomTo(z) : (Z = clamp(z, ZMIN, ZMAX), draw(), remember(), opts.onZoom && opts.onZoom(Z)),
    // so a bottom sheet never covers the magnified middle: the lens center, the "center" bubble and the
    // vignette all recenter into whatever's still visible above it. Animated (~300ms; see loop()'s insetCur tween).
    setInset({ bottom } = {}) { insetBottom = Math.max(0, +bottom || 0); kick(); },
    // the Arrange sheet (js/home.js chooser("look")): enterFit() remembers the pan/zoom you had and flies to the
    // whole-map view (flyToFit, above); every update() while it's on flies back there so a setting change is
    // visible at once. exitFit() flies back to what you had -- not just a reset -- when the sheet closes.
    enterFit() {
      if (!lay || lay.globe) return;
      const first = !fitMode;
      if (first) { fitSaved = [P[0], P[1], Z]; fitMode = true; }
      // a re-entry (the sheet's own height changed, say) respects a pan/pinch the user already made; only the
      // very first entry (opening Arrange) and an actual arrangement change (honey.js update(), above) override it
      if (first || !fitUserOverride) flyToFit(true);
    },
    exitFit() {
      if (!fitMode) return; fitMode = false; fitUserOverride = false;
      const s = fitSaved; fitSaved = null;
      if (s) flyTo([s[0], s[1]], s[2], { buzz: false });
      ZMIN = zFloor();   // fit mode may have lowered it past the ordinary pinch-out floor; restore the real one
    },
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
    // L18: fly the map to a color (a hex, or an item with .h) — the nearest bubble lands in the middle, ready to
    // open on the next tap. o.zoom (default: in to at least the normal size), o.dip (the mid-flight pull-back).
    flyToColor(h, o = {}) {
      if (!lay || lay.globe) return null;
      const it = l18ItemNear(h && h.h ? h.h : h); if (!it) return null;
      const X = l18WorldOf(it); if (!X) return null;
      glided = it;
      flyTo(X, o.zoom != null ? o.zoom : Math.max(Z, .9), { dip: o.dip != null ? o.dip : .22 });
      return it.o;
    },
    zoomValue: () => Z,
    panValue: () => [P[0], P[1], Z],   // QA: the pan a return to Home must keep
    // QA (tools/smoke map-return): finish a spring or zoom in flight at once (headless frames don't always run)
    _settle() { if (phase === "spring" && spring) { P = spring.X.slice(); spring = null; phase = "idle"; } if (zAnim) { Z = zAnim.to; zAnim = null; } insetCur = insetBottom; Plag = P.slice(); draw(); return [P[0], P[1], Z]; },
    _morphCheck: items => l18MorphCheck(items),
    // QA (tools/smoke map group): the median seam between each readable bubble and its nearest neighbor, in px
    _gapStat() {
      const big = drawn.filter(b => b.d >= 12), gs = [];
      for (const b of big) { let g = Infinity; for (const o of drawn) { if (o === b) continue; const v = Math.hypot(o.x - b.x, o.y - b.y) - b.d / 2 - o.d / 2; if (v < g) g = v; } if (isFinite(g)) gs.push(g); }
      gs.sort((x, y) => x - y);
      return { n: drawn.length, w: cv.width, h: cv.height, gap: gs.length ? +gs[Math.floor(gs.length / 2)].toFixed(2) : null, p90: gs.length ? +gs[Math.floor(gs.length * .9)].toFixed(2) : null };
    },
    // QA (tools/smoke map group): every currently-drawn bubble's own screen rect (CSS px, cv's own box, not the
    // backing store), so a caller can check "does fit mode actually keep everything above the sheet" numerically
    _drawnBounds() {
      if (!drawn.length) return null;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const b of drawn) { const r = b.d / 2; if (b.x - r < minX) minX = b.x - r; if (b.x + r > maxX) maxX = b.x + r; if (b.y - r < minY) minY = b.y - r; if (b.y + r > maxY) maxY = b.y + r; }
      return { n: drawn.length, minX, maxX, minY, maxY, W, Hh };
    },
    // L18 B2: a small JPEG of the map as it looks right now (the rooms' floor strip shows it under a solid scrim)
    snapshot(w = 390) {
      if (!W || !cv.width) return null;
      try { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(Hh * w / W); const g = c.getContext("2d"); g.fillStyle = "#0E0D0B"; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .7); } catch (e) { return null; }
    },
    isZoomedOut: () => l18ZoomedOut(),
    // ---- map study (js/mapstudy.js) ----
    study(o = {}) {
      ["hit", "label", "fog"].forEach(k => { if (k in o) ST[k] = typeof o[k] === "function" ? o[k] : null; });
      if ("marks" in o) { const t0 = performance.now(); ST.marks = new Map((o.marks || []).map(m => [m.n, { kind: m.kind, t0: m.t0 || t0 }])); }
      draw(); kick();
    },
    // glide (the same spring a tap uses) so the nearest copy of o sits in the middle; z optionally eases the zoom too.
    // o may also be a lattice point { x, y } (from studyPoints), e.g. the middle of a small cluster.
    studyFlyTo(o, z) {
      if (!lay || lay.globe || !o) return false;
      let best = o.n == null && isFinite(o.x) && isFinite(o.y) ? [o.x, o.y] : null, bd = Infinity;
      const R = lay.finite ? 1e9 : Math.max(2, lay.per * 1.5);
      if (!best) for (const p of lay.pts) if (p.it.n === o.n) copies(p, P, R, (ex, ey) => { const dd = ex * ex + ey * ey; if (dd < bd) { bd = dd; best = [P[0] + ex, P[1] + ey]; } });
      if (!best) return false;
      if (z) zAnim = { to: clamp(z, ZMIN, ZMAX), sx: W / 2, sy: vcy() };
      const A = [P[0] - best[0], P[1] - best[1]], w = RM ? 40 : 9;
      spring = { t0: performance.now(), X: best, A, B: [w * A[0], w * A[1]], w }; phase = "spring"; glided = null; kick();
      return true;
    },
    // ease the zoom about the middle without cancelling a glide in flight (ctrl.zoom would drop the spring)
    studyZoom(z) { if (!lay || lay.globe) return; zAnim = { to: clamp(z, ZMIN, ZMAX), sx: W / 2, sy: vcy() }; kick(); },
    // the lattice itself, for neighbors and paths: every point (an item can sit at two), and how the plane repeats
    studyPoints() {
      if (!lay || lay.globe) return null;
      return { pts: lay.pts.map(p => ({ o: p.it.o, n: p.it.n, x: p.x, y: p.y })), finite: !!lay.finite, A: lay.A || null, B: lay.B || null };
    },
    // where a color sits on screen right now (js/polish.js flyToMap): the biggest drawn bubble with that hex, in viewport px
    // a color's bubble as drawn right now, fully on screen and big enough to aim at (js/mapxfer.js shrinks a page back
    // into it): the copy nearest `near` (viewport px) if given, else the biggest; null when there is none
    geoOf(h, near) {
      const H = String(h).toUpperCase(), r = cv.getBoundingClientRect();
      const ok = drawn.filter(x => String(x.it.h).toUpperCase() === H && x.d >= 6 && x.x - x.d / 2 >= 0 && x.y - x.d / 2 >= 0 && x.x + x.d / 2 <= W && x.y + x.d / 2 <= Hh);
      if (!ok.length) return null;
      const b = near ? ok.sort((p, q) => Math.hypot(r.left + p.x - near.x, r.top + p.y - near.y) - Math.hypot(r.left + q.x - near.x, r.top + q.y - near.y))[0] : ok.sort((p, q) => q.d - p.d)[0];
      return geoOf(b);
    },
    locate(h) { const H = String(h).toUpperCase(), b = drawn.filter(x => String(x.it.h).toUpperCase() === H).sort((x, y) => y.d - x.d)[0]; if (!b) return null; const r = cv.parentNode.getBoundingClientRect(); return { x: r.left + b.x, y: r.top + b.y, d: b.d }; },
    destroy,
  };
}
