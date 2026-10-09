"use strict";
// The painting map (David, 2026-10-08: "visualize multiple paintings by placing them next to each other, like we did
// with colors… as you pan, the one in the middle gets expanded, like the color map").
//
// Thousands of painting thumbnails on one pannable, pinchable canvas, seen through the color map's lens (js/honey.js):
// the painting in the middle is big and shows its whole picture at its own shape; the rest are square crops that
// shrink smoothly toward the edges. A tap on the middle one opens its page; a tap elsewhere glides it to the middle.
//
// Arrangements (what position means, always said in one line under the title):
//   color    lighter toward the top, hues left to right (columns of hue, light to dark inside), then a local pass that
//            swaps neighbors whenever that makes the two look more alike (mean and dominant color, CIELAB)
//   time     oldest at the top, one band per decade (centuries before 1500), lighter first inside a band
//   painter  one block per painter, the earliest painters first; inside a block, by date
//   similar  one painting in the middle; the rest spiral out by how close their colors are (js/gallery.js glSimilar's
//            matched-palette distance for the nearest 400, the average-color distance for the rest)
// Filters are js/browse.js's (xbRun: color, years, painter, movement, country, museum), plus "your favorites"
// (js/favs.js S.favArt), with live counts. The address carries all of it: #/paintings/map?arr=time&co=France&y0=1880&y1=1889
//
// Speed: one canvas; per frame only the cells inside the lens radius are visited (the layout is a dense grid, so
// that's a rectangle of lookups, never a pass over every painting). Thumbnails load only for tiles on screen and big
// enough to read, nearest the middle first, ten at a time; each is baked once into a small square canvas (frame
// cropped away, js/gallery.js glCropStyle's crop), and a bounded LRU recycles them. Until its picture lands, a tile
// is its painting's own dominant color, so the map reads as color from the first frame. Image addresses come from
// data/gallery/thumbs.txt (tools/paintmap_thumbs.py), not the 11 MB of detail shards.

// David, 2026-10-09: "the paintings view is missing the arrangement options the color view has" -- Rings and
// Spiral are both "around one painting" (they need a seed, same as the old "similar" did), split into two
// distinct reads of the same underlying similarity order (pmSimilarOrder): Rings is clean concentric square
// shells (nearer = a tighter ring); Spiral is a continuous golden-angle sweep (phyllotaxis, the sunflower-seed
// pattern) with no seams between ranks, so a painting just past one "ring" and one just before the next sit
// beside each other instead of in separate bands. Families groups by movement (pmLayGroup, the same shelf-
// packing as By painter, just grouped by F.mv instead of F.artist); Tones buckets by mood (Vivid/Light/Muted/
// Dark, the same honeyToneGroup split honey.js's own Tones shape uses) under whichever "Place by" color the
// painting's own position already comes from.
const PM_ARR = [["color", "By color"], ["time", "By time"], ["painter", "By painter"], ["families", "Families"], ["tones", "Tones"], ["rings", "Rings"], ["spiral", "Spiral"]];
const PM_NEEDS_SEED = new Set(["rings", "spiral"]);
const PM_WHY = {
  color: "Lighter toward the top, hues left to right",
  time: "Oldest at the top, a band for each decade",
  painter: "A block for each painter, earliest first",
  families: "A block for each movement, the biggest first",
  tones: "An island per mood: vivid, light, muted, dark",
  rings: "Concentric rings: the nearer the middle, the closer the colors",
  spiral: "A continuous spiral, nearest first, no seams between rings",
};
// David, 2026-10-09: "Place by" -- which of a painting's own colors decides WHERE it sits, for the two
// arrangements position actually comes from a color (color, time). The default (and the only option before this)
// was always the true pixel-weighted mean across the whole canvas; "Main color" instead uses the single biggest
// swatch of its 6-color palette (pmDom, same swatch a painting's own dominant-color tile uses before its picture
// loads), and "Standout" uses the most saturated of the 6 -- the one that would catch your eye in the frame, even
// if it's a small accent. Only meaningful where a painting's OWN color decides its position; "painter" (grouped
// by artist, ordered by date) and "similar" (whole-palette matching, already finer-grained than any one swatch)
// are unaffected and ignore it.
const PM_PLACE = [["avg", "Average"], ["main", "Main color"], ["standout", "Standout"]];
function pmPlaceLab(i, place) {
  if (!place || place === "avg") return [GAL.mean[i * 3], GAL.mean[i * 3 + 1], GAL.mean[i * 3 + 2]];
  const j = place === "main" ? pmDom(i) : (() => { let b = 0, bc = -1; for (let t = 0; t < 6; t++) { const c = GAL.ch[i * 6 + t]; if (c > bc) { bc = c; b = t; } } return b; })();
  const o = (i * 6 + j) * 3;
  return [GAL.lab[o], GAL.lab[o + 1], GAL.lab[o + 2]];
}
// David, 2026-10-09: "Center on" -- a quick way to land the (otherwise generic) "around one painting" arrangement
// on a painting chosen by some property of the CURRENT filtered list, not by having already found one yourself.
// Each returns a gallery index (or -1 if the list is empty / has no favorite in it).
const PM_CENTER = [
  ["vivid", "Most vivid", list => { let b = -1, bv = -1; for (const i of list) if (GAL.C[i] > bv) { bv = GAL.C[i]; b = i; } return b; }],
  ["grey", "Greyest", list => { let b = -1, bv = 1e9; for (const i of list) if (GAL.C[i] < bv) { bv = GAL.C[i]; b = i; } return b; }],
  ["light", "Lightest", list => { let b = -1, bv = -1; for (const i of list) if (GAL.mean[i * 3] > bv) { bv = GAL.mean[i * 3]; b = i; } return b; }],
  ["dark", "Darkest", list => { let b = -1, bv = 1e9; for (const i of list) if (GAL.mean[i * 3] < bv) { bv = GAL.mean[i * 3]; b = i; } return b; }],
  ["fav", "A favorite", list => { const ids = typeof fvArtList === "function" ? fvArtList() : []; if (!ids.length) return -1; const want = new Set(ids.map(r => r.i)); for (const i of list) if (want.has(i)) return i; return -1; }],
];
const PM_ICON = {
  color: sv('<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="8" r="3.2"/><circle cx="12" cy="15.5" r="3.2"/>', 22, 1.7),
  time: sv('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4M14 10v4M10 16v4"/>', 22, 1.7),
  painter: sv('<rect x="3.5" y="4" width="7" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="4" rx="1.2"/><rect x="13.5" y="11" width="7" height="9" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/>', 22, 1.7),
  families: sv('<circle cx="7" cy="7" r="3.4"/><circle cx="16.5" cy="6.5" r="2.4"/><circle cx="7" cy="16.5" r="2.4"/><circle cx="17" cy="16" r="3"/>', 22, 1.7),
  tones: sv('<circle cx="7" cy="7" r="3.6"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="3.6"/>', 22, 1.7),
  rings: sv('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2.5 3"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="1.5 2.5"/>', 22, 1.6),
  spiral: sv('<path d="M12 12c0-1.2 1-2 2.2-2 1.8 0 3.3 1.6 3.3 3.5 0 2.6-2.2 4.8-4.8 4.8-3.3 0-6-2.8-6-6.1C6.7 7.7 10 4.6 14 4.6" stroke-linecap="round"/>', 22, 1.7),
  arrange: sv('<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 22, 1.6),
  filter: sv('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>', 22, 1.6),
  down: sv('<path d="M7 10l5 5 5-5"/>', 14, 2),
  // the "Colors" row back to the honeycomb (David, 2026-10-09): a small cluster of named bubbles
  colorsMode: sv('<circle cx="7" cy="8" r="3.4"/><circle cx="16" cy="7" r="2.6"/><circle cx="8.5" cy="16" r="2.8"/><circle cx="16.5" cy="15.5" r="2"/>', 22, 1.6),
};
let PM_THUMBS = null, PM_THUMBS_P = null;
const PM_PAN = new Map();     // layout key -> { x, y, s }: where you were, so Back from a painting lands on it again
const PM_LAYOUTS = new Map(); // layout key -> layout (the color pass costs ~100 ms on 24,000 paintings: once is enough)

// ---------- data ----------
function pmThumbsLoad() {
  if (PM_THUMBS) return Promise.resolve(PM_THUMBS);
  const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  return PM_THUMBS_P || (PM_THUMBS_P = fetch("data/gallery/thumbs.txt" + v).then(r => { if (!r.ok) throw new Error("thumbs " + r.status); return r.text(); })
    .then(t => (PM_THUMBS = t.split("\n"))).catch(e => { PM_THUMBS_P = null; throw e; }));
}
// a tile's picture address, and its frame crop ([l, t, r, b] in thousandths of the photo) or null
function pmThumb(i) {
  const line = PM_THUMBS && PM_THUMBS[i]; if (!line) return null;
  const tab = line.indexOf("\t"), c = line.slice(0, tab < 0 ? undefined : tab), cr = tab < 0 ? "" : line.slice(tab + 1);
  const k = c[0], a = c.slice(1);
  const url = k === "L" ? "img/gallery/" + a : k === "C" ? `https://commons.wikimedia.org/wiki/Special:FilePath/${a}?width=400`
    : k === "M" ? `https://iiif.micr.io/${a}/full/400,/0/default.jpg` : k === "N" ? `https://api.nga.gov/iiif/${a}/full/400,/0/default.jpg`
    : k === "V" ? "https://openaccess-cdn.clevelandart.org/" + a : k === "E" ? "https://images.metmuseum.org/CRDImages/" + a : a;
  const crop = cr ? cr.split(",").map(Number) : null;
  return { url, crop: crop && crop.length === 4 ? crop : null };
}
const pmDom = i => { let b = 0; for (let j = 1; j < 6; j++) if (GAL.sh[i * 6 + j] > GAL.sh[i * 6 + b]) b = j; return b; };
const pmHex = i => glHex(i, pmDom(i));

// ---------- the spec: what to show and how (the address's query) ----------
const pmFresh = () => ({ arr: "color", f: xbFresh(), seed: -1, fav: 0, place: "avg" });
function pmParse(q, F) {
  const s = pmFresh(), p = new URLSearchParams(String(q || "").replace(/^\?/, ""));
  const a = p.get("arr"); if (PM_ARR.some(x => x[0] === a)) s.arr = a;
  const pl = p.get("pl"); if (PM_PLACE.some(x => x[0] === pl)) s.place = pl;
  const f = s.f, num = k => { const v = p.get(k); return v != null && v !== "" && isFinite(+v) ? +v : null; };
  if (p.get("c")) { f.hexes = p.get("c").split(",").filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => "#" + h.toUpperCase()); f.name = f.hexes.length ? nameOf(f.hexes[0]).text : ""; f.tol = num("t") || 8; f.cover = num("m") != null ? num("m") : 2; }
  f.y0 = num("y0"); f.y1 = num("y1");
  if (p.get("p")) f.painter = F.slugIx.get(p.get("p")) || 0;
  const ix = (list, v) => v ? list.findIndex(x => routeSlug(x) === routeSlug(v)) + 1 : 0;
  f.co = ix(F.meta.countries, p.get("co")); f.mv = ix(F.meta.movements, p.get("mv"));
  if (p.get("mus")) f.mus = F.G.src.findIndex(x => x.k === p.get("mus"));
  const sd = num("seed"); if (sd != null && sd >= 0 && sd < F.N) s.seed = sd;
  if (p.get("fav") === "1") s.fav = 1;
  if (PM_NEEDS_SEED.has(s.arr) && s.seed < 0) s.arr = "color";
  return s;
}
function pmQS(s, F) {
  const f = s.f, out = [["arr", s.arr]];
  if (s.place && s.place !== "avg") out.push(["pl", s.place]);
  if (f.hexes.length) { out.push(["c", f.hexes.map(h => h.slice(1).toLowerCase()).join(",")], ["t", f.tol], ["m", f.cover]); }
  if (f.y0 != null) out.push(["y0", f.y0]); if (f.y1 != null) out.push(["y1", f.y1]);
  if (f.painter && F) out.push(["p", F.meta.artists[f.painter - 1][1]]);
  if (f.co && F) out.push(["co", F.meta.countries[f.co - 1]]);
  if (f.mv && F) out.push(["mv", F.meta.movements[f.mv - 1]]);
  if (f.mus >= 0 && F) out.push(["mus", F.G.src[f.mus].k]);
  if (PM_NEEDS_SEED.has(s.arr) && s.seed >= 0) out.push(["seed", s.seed]);
  if (s.fav) out.push(["fav", 1]);
  return out.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
}
// router.js ROUTED: the address and title of an open map
function pmRouteOf(spec) {
  const q = typeof spec === "string" ? spec.replace(/^\?/, "") : XBF ? pmQS(spec, XBF) : "";
  return { path: "paintings/map" + (q ? "?" + q : ""), title: "Painting map" };
}
// the filters in words: "France · 1880s · Monet"
function pmWords(s, F) {
  const c = xbChips(F, s.f).map(x => x.dim === "color" ? x.text : x.text);
  if (s.fav) c.unshift("Your favorites");
  return c;
}
// the active filters as removable chips (David, 2026-10-09: filter-by-example's companion -- wherever a filter
// came from, a chip here undoes exactly that one dimension). xbChips already knows every dimension's current
// value and label; xbWithout already knows how to clear exactly one. "Your favorites" isn't an xbRun filter at
// all (s.fav lives beside s.f), so it's synthesized as its own chip with dim "fav".
function pmActiveChips(s, F) {
  const c = xbChips(F, s.f).map(x => ({ dim: x.dim, text: x.text }));
  if (s.fav) c.unshift({ dim: "fav", text: "Your favorites" });
  return c;
}
// a painting's own facets, as tappable "only these" chips (David, 2026-10-09: "filtering by example" -- the
// bottom card for whatever's centered shows painter, country, decade, movement, museum and its 2-3 main colors;
// tapping one narrows the whole map to it). Undated paintings get no "when" chip (nothing honest to filter by).
function pmFacetsOf(i, F) {
  const out = [];
  if (F.artist[i]) out.push({ dim: "painter", val: F.artist[i], label: xbArtistName(F, F.artist[i]) });
  if (F.country[i]) out.push({ dim: "co", val: F.country[i], label: F.meta.countries[F.country[i] - 1] });
  const y = F.G.year[i];
  if (y !== GL_UNDATED) {
    const y0 = y < 1500 ? Math.floor(y / 100) * 100 : Math.floor(y / 10) * 10, y1 = y < 1500 ? y0 + 99 : y0 + 9;
    out.push({ dim: "when", val: [y0, y1], label: `${y0}s` });
  }
  if (F.mv[i]) out.push({ dim: "mv", val: F.mv[i], label: F.meta.movements[F.mv[i] - 1] });
  out.push({ dim: "mus", val: F.G.mus[i], label: F.G.src[F.G.mus[i]].short });
  glPal(i).slice(0, 3).forEach(c => out.push({ dim: "color", val: c.h, label: nameOf(c.h).text }));
  return out;
}
// apply one facet to the filter spec in place (mirrors xbWithout's per-dim shape, the "set" half)
function pmFacetApply(f, dim, val) {
  if (dim === "painter") f.painter = val;
  else if (dim === "co") f.co = val;
  else if (dim === "mv") f.mv = val;
  else if (dim === "mus") f.mus = val;
  else if (dim === "when") { f.y0 = val[0]; f.y1 = val[1]; }
  else if (dim === "color") { f.hexes = [val]; f.name = nameOf(val).text; f.tol = 8; f.cover = 5; }
}

// ---------- the list: the filters, then your favorites ----------
function pmList(s, F) {
  let list = xbRun(F, s.f).list;
  if (s.fav) {
    const ids = typeof fvArtList === "function" ? fvArtList() : [];
    const want = new Set(ids.map(r => r.i));
    list = list.filter(i => want.has(i));
  }
  return list;
}

// ---------- layouts: every painting gets one grid cell ----------
// lay = { key, n, items (k -> gallery index), x, y (cell per k), gx0, gy0, GW, GH, grid (cell -> k or -1), labels, start }
function pmGridOf(items, X, Y, labels, start) {
  const n = items.length; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k < n; k++) { if (X[k] < x0) x0 = X[k]; if (X[k] > x1) x1 = X[k]; if (Y[k] < y0) y0 = Y[k]; if (Y[k] > y1) y1 = Y[k]; }
  if (!n) { x0 = y0 = x1 = y1 = 0; }
  const GW = x1 - x0 + 1, GH = y1 - y0 + 1, grid = new Int32Array(GW * GH).fill(-1);
  for (let k = 0; k < n; k++) grid[(Y[k] - y0) * GW + X[k] - x0] = k;
  return { n, items, x: X, y: Y, gx0: x0, gy0: y0, GW, GH, grid, labels: labels || [], start: start || [0, 0] };
}
const pmAt = (lay, cx, cy) => { const x = cx - lay.gx0, y = cy - lay.gy0; return x < 0 || y < 0 || x >= lay.GW || y >= lay.GH ? -1 : lay.grid[y * lay.GW + x]; };
// mean color (CIELAB, by area) and dominant color, for the neighbor pass
function pmFeat(list) {
  const G = GAL, n = list.length, f = new Float32Array(n * 6);
  for (let k = 0; k < n; k++) {
    const i = list[k], d = pmDom(i), o = (i * 6 + d) * 3;
    f[k * 6] = G.mean[i * 3]; f[k * 6 + 1] = G.mean[i * 3 + 1]; f[k * 6 + 2] = G.mean[i * 3 + 2];
    f[k * 6 + 3] = G.lab[o]; f[k * 6 + 4] = G.lab[o + 1]; f[k * 6 + 5] = G.lab[o + 2];
  }
  return f;
}
const pmHueKey = (a, b) => { let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360; return (H - 330 + 360) % 360; };   // reds first, then oranges, browns, yellows, greens, blues, purples
function pmLayColor(list, place) {
  const n = list.length, cols = Math.max(1, Math.round(Math.sqrt(n / 1.55))), rows = Math.ceil(n / cols);
  const Lp = new Float32Array(n), Ap = new Float32Array(n), Bp = new Float32Array(n);
  for (let k = 0; k < n; k++) { const c = pmPlaceLab(list[k], place); Lp[k] = c[0]; Ap[k] = c[1]; Bp[k] = c[2]; }
  const L = k => Lp[k], A = k => Ap[k], B = k => Bp[k];
  const idx = Array.from({ length: n }, (_, k) => k);
  const chroma = idx.filter(k => Math.hypot(A(k), B(k)) >= 5).sort((p, q) => pmHueKey(A(p), B(p)) - pmHueKey(A(q), B(q)));
  const greys = idx.filter(k => Math.hypot(A(k), B(k)) < 5);
  // the near-neutral paintings go where the warm olives meet the greens (hue key ~140), not at either end
  const cut = chroma.findIndex(k => pmHueKey(A(k), B(k)) >= 140);
  const order = cut < 0 ? chroma.concat(greys) : chroma.slice(0, cut).concat(greys, chroma.slice(cut));
  const X = new Int32Array(n), Y = new Int32Array(n), items = new Int32Array(n);
  const ox = Math.floor(cols / 2), oy = Math.floor(rows / 2);
  let k2 = 0;
  for (let j = 0; j < cols && k2 < n; j++) {
    const col = order.slice(k2, k2 + rows).sort((p, q) => L(q) - L(p));
    col.forEach((k, r) => { const m = k2 + r; items[m] = list[k]; X[m] = j - ox; Y[m] = r - oy; });
    k2 += col.length;
  }
  const lay = pmGridOf(items, X, Y);
  pmSmooth(lay, 120);
  return lay;
}
// the neighbor pass: try swapping each cell with its right or lower neighbor; keep the swap when the two then look
// more like the cells around them (local, so the big light-to-dark and hue directions stay)
function pmSmooth(lay, budget) {
  const n = lay.n; if (n < 9) return;
  const f = pmFeat(lay.items), g = lay.grid, W = lay.GW, H = lay.GH;
  const d = (p, q) => { const a = p * 6, b = q * 6; let s = 0; for (let t = 0; t < 3; t++) { const e = f[a + t] - f[b + t]; s += e * e; } for (let t = 3; t < 6; t++) { const e = f[a + t] - f[b + t]; s += .5 * e * e; } return s; };
  const cost = (k, x, y, skip) => { let c = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = g[yy * W + xx]; if (q >= 0 && q !== skip) c += d(k, q); } return c; };
  const t0 = performance.now(); let seed = 9301;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // a time budget, and a cap on tries too (a clock that doesn't move while code runs, as in headless test runs, can't hang it)
  for (let round = 0, rounds = Math.ceil(n * 14 / 4000); round < rounds && performance.now() - t0 < budget; round++) {
    for (let it = 0; it < 4000; it++) {
      const c = Math.floor(rnd() * W * H), x = c % W, y = (c / W) | 0, right = rnd() < .5, x2 = right ? x + 1 : x, y2 = right ? y : y + 1;
      if (x2 >= W || y2 >= H) continue;
      const p = g[c], q = g[y2 * W + x2]; if (p < 0 || q < 0) continue;
      const before = cost(p, x, y, q) + cost(q, x2, y2, p), after = cost(q, x, y, q) + cost(p, x2, y2, p);
      if (after < before) {
        const ip = lay.items[p]; lay.items[p] = lay.items[q]; lay.items[q] = ip;   // k keeps its cell; the painting moves
        for (let t = 0; t < 6; t++) { const e = f[p * 6 + t]; f[p * 6 + t] = f[q * 6 + t]; f[q * 6 + t] = e; }
      }
    }
  }
}
// the year as a sortable number; undated last
const pmYr = i => GAL.year[i] === GL_UNDATED ? 1e5 : GAL.year[i];
function pmBand(i) {
  const y = GAL.year[i];
  if (y === GL_UNDATED) return { key: 1e6, label: "Undated" };
  if (y < 1500) { const c = Math.floor(y / 100) * 100; return { key: c, label: c < 0 ? `${-c} BCE` : `${c}–${c + 99}` }; }
  const d = Math.floor(y / 10) * 10; return { key: d, label: d + "s" };
}
function pmLayTime(list, place) {
  const n = list.length, Wc = Math.max(3, Math.min(16, Math.round(Math.sqrt(n) / 2.2)));
  const bands = new Map();
  list.forEach(i => { const b = pmBand(i); if (!bands.has(b.key)) bands.set(b.key, { ...b, items: [] }); bands.get(b.key).items.push(i); });
  const keys = [...bands.keys()].sort((a, b) => a - b);
  const Lv = i => pmPlaceLab(i, place)[0], Av = i => pmPlaceLab(i, place)[1], Bv = i => pmPlaceLab(i, place)[2];
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let y = 0, m = 0, start = null, half = n / 2, seen = 0;
  keys.forEach(key => {
    const b = bands.get(key), its = b.items.sort((p, q) => Lv(q) - Lv(p));
    labels.push({ x: -ox, y, text: b.label, n: its.length, w: Wc });
    y++;
    for (let r = 0; r * Wc < its.length; r++) {
      const row = its.slice(r * Wc, r * Wc + Wc).sort((p, q) => pmHueKey(Av(p), Bv(p)) - pmHueKey(Av(q), Bv(q)));
      row.forEach((i, c) => { items[m] = i; X[m] = c - ox; Y[m] = y; m++; });
      y++;
    }
    if (!start && seen + its.length >= half) start = [0, y - Math.ceil(its.length / Wc) / 2 - .5];
    seen += its.length;
    y++;   // a quiet gap row between bands
  });
  return pmGridOf(items, X, Y, labels, start ? [Math.round(start[0]), Math.round(start[1])] : [0, 1]);
}
// David, 2026-10-09: the shelf-packer behind "By painter" generalized to take ANY grouping (families groups by
// movement instead of painter, same shelves) -- one block per group, each block's own internal order its own
// business (chronological for painter/movement blocks).
function pmLayGroup(list, o) {
  const n = list.length, Wc = Math.max(4, Math.min(18, Math.round(Math.sqrt(n) / 1.6)));
  const groups = new Map();
  list.forEach(i => { const g = o.groupOf(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
  groups.forEach(arr => arr.sort(o.sortWithin));
  let keys = o.order ? o.order.filter(k => groups.has(k)) : [...groups.keys()];
  if (!o.order) keys.sort((a, b) => (o.keyRank ? o.keyRank(a, groups.get(a)) - o.keyRank(b, groups.get(b)) : 0) || groups.get(b).length - groups.get(a).length);
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let x = 0, y = 0, shelfH = 0, m = 0;
  keys.forEach(key => {
    const arr = groups.get(key), c = arr.length, bw = Math.min(Wc, Math.max(1, Math.ceil(Math.sqrt(c * 1.3)))), bh = Math.ceil(c / bw);
    if (x > 0 && x + bw > Wc) { y += shelfH + 2; x = 0; shelfH = 0; }
    labels.push({ x: x - ox, y, text: o.label(key, c), n: c, w: bw });
    arr.forEach((i, k) => { items[m] = i; X[m] = x + k % bw - ox; Y[m] = y + 1 + Math.floor(k / bw); m++; });
    shelfH = Math.max(shelfH, bh); x += bw + 1;
  });
  const L0 = labels[0];
  return pmGridOf(items, X, Y, labels, L0 ? [Math.round(L0.x + (L0.w - 1) / 2), L0.y + 1] : [0, 1]);
}
function pmLayPainter(list, F) {
  return pmLayGroup(list, {
    groupOf: i => F.artist[i], sortWithin: (p, q) => pmYr(p) - pmYr(q),
    keyRank: (a, arr) => { if (!a) return 2e5; const y = arr.map(pmYr).sort((p, q) => p - q); return y[y.length >> 1]; },
    label: (a, c) => a ? xbArtistName(F, a) : "Artist unknown",
  });
}
// Families (David, 2026-10-09): the same shelves, grouped by movement instead of painter -- the biggest
// movements first (keyRank left at its default, so the group-size tiebreak alone decides order).
function pmLayFamilies(list, F) {
  return pmLayGroup(list, {
    groupOf: i => F.mv[i], sortWithin: (p, q) => pmYr(p) - pmYr(q),
    label: (mv, c) => mv ? F.meta.movements[mv - 1] : "Unclassified",
  });
}
// Tones (David, 2026-10-09): the same Vivid/Light/Muted/Dark split honey.js's own Tones shape uses
// (honeyToneGroup), applied to whichever color "Place by" already uses for position (pmPlaceLab) -- an island
// per mood, hue-ordered inside, so the painter/movement groupings aren't the only way to read the set.
const PM_TONE_ORDER = ["Vivid", "Light", "Muted", "Dark"];
function pmToneOf(i, place) { const [L, a, b] = pmPlaceLab(i, place), C = Math.hypot(a, b); return L < 40 ? "Dark" : L >= 78 ? "Light" : C >= 45 ? "Vivid" : "Muted"; }
function pmLayTones(list, place) {
  return pmLayGroup(list, {
    groupOf: i => pmToneOf(i, place),
    sortWithin: (p, q) => { const a = pmPlaceLab(p, place), b = pmPlaceLab(q, place); return pmHueKey(a[1], a[2]) - pmHueKey(b[1], b[2]); },
    order: PM_TONE_ORDER, label: k => k,
  });
}
// the shared ordering behind both "around one painting" shapes (Rings, Spiral): nearest-to-seed first, by the
// matched-palette distance for the 400 closest (js/gallery.js glSimilar's own technique), mean-color distance
// for the rest -- unchanged from the old single "similar" arrangement, just no longer tied to one fixed layout.
function pmSimilarOrder(list, seed) {
  const G = GAL, m = G.mean, q = seed * 3, Lb = G.lab;
  let L = Array.from(list).filter(i => i !== seed);
  const d0 = new Map();
  L.forEach(j => { const a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2], e = G.C[j] - G.C[seed]; d0.set(j, a * a + b * b + c * c + e * e); });
  L.sort((a, b) => d0.get(a) - d0.get(b));
  const half = (a, b) => { let s = 0; for (let x = 0; x < 6; x++) { const oa = (a * 6 + x) * 3; let best = 1e9; for (let y = 0; y < 6; y++) { const ob = (b * 6 + y) * 3, d = glDE(Lb[oa], Lb[oa + 1], Lb[oa + 2], Lb[ob], Lb[ob + 1], Lb[ob + 2]); if (d < best) best = d; } s += G.sh[a * 6 + x] * best; } return s; };
  const near = L.slice(0, 400).map(j => [j, (half(seed, j) + half(j, seed)) / 2]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  return [seed, ...near, ...L.slice(400)];
}
// Rings: concentric square shells (the old "similar" layout, unchanged) -- a clean, bands-you-can-count read.
function pmLayRings(list, seed) {
  const L = pmSimilarOrder(list, seed);
  const n = L.length, r = Math.ceil(Math.sqrt(n / Math.PI)) + 2, cells = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) cells.push([x, y, x * x + y * y, Math.atan2(y, x)]);
  cells.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  const items = Int32Array.from(L), X = new Int32Array(n), Y = new Int32Array(n);
  for (let k = 0; k < n; k++) { X[k] = cells[k][0]; Y[k] = cells[k][1]; }
  return pmGridOf(items, X, Y, [], [0, 0]);
}
// Spiral (David, 2026-10-09, "★ Spiral/Sunflower"): the SAME similarity order as Rings, but placed by golden-
// angle phyllotaxis (the sunflower-seed pattern: radius grows with sqrt(rank), angle advances by the golden
// angle every step) instead of grouping by fixed-radius shell -- a continuous weave with no seam between one
// rank and the next, rather than Rings' clean bands. Ideal positions are real numbers; snapped to the nearest
// free integer cell (this engine's grid needs one painting per cell), searching outward on the rare collision --
// phyllotaxis is specifically the pattern that packs points with the fewest collisions in the first place, so
// this almost always resolves within a ring or two.
function pmLaySpiral(list, seed) {
  const L = pmSimilarOrder(list, seed), n = L.length, GOLD = Math.PI * (3 - Math.sqrt(5));
  const occupied = new Set(), X = new Int32Array(n), Y = new Int32Array(n);
  const key = (x, y) => (x + 20000) * 50000 + (y + 20000);
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0;
    if (k > 0) {
      const rad = Math.sqrt(k) * 1.6, ang = k * GOLD;
      x = Math.round(rad * Math.cos(ang)); y = Math.round(rad * Math.sin(ang));
      if (occupied.has(key(x, y))) {
        outer: for (let ring = 1; ring < 30; ring++) {
          for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const xx = x + dx, yy = y + dy;
            if (!occupied.has(key(xx, yy))) { x = xx; y = yy; break outer; }
          }
        }
      }
    }
    occupied.add(key(x, y)); X[k] = x; Y[k] = y;
  }
  return pmGridOf(Int32Array.from(L), X, Y, [], [0, 0]);
}
function pmLayout(s, F) {
  const list = pmList(s, F), key = pmQS(s, F) + "|" + list.length + "|" + (s.fav ? (typeof fvArtList === "function" ? fvArtList().map(r => r.i).join(",") : "") : "");
  let lay = PM_LAYOUTS.get(key);
  if (!lay) {
    lay = s.arr === "time" ? pmLayTime(list, s.place) : s.arr === "painter" ? pmLayPainter(list, F)
      : s.arr === "families" ? pmLayFamilies(list, F) : s.arr === "tones" ? pmLayTones(list, s.place)
      : s.arr === "rings" ? pmLayRings(list, s.seed) : s.arr === "spiral" ? pmLaySpiral(list, s.seed)
      : pmLayColor(list, s.place);
    lay.key = key; lay.arr = s.arr;
    PM_LAYOUTS.set(key, lay); if (PM_LAYOUTS.size > 8) PM_LAYOUTS.delete(PM_LAYOUTS.keys().next().value);
  }
  return lay;
}

// ---------- thumbnails: load the few on screen, bake each once, recycle ----------
const PM_BAKE = 144, PM_CACHE_MAX = 650, PM_BIG_MAX = 36, PM_FLIGHT = 14;
// Canvas taint (map lane's audit, 2026-10-09): a thumbnail drawn onto a canvas WITHOUT a crossorigin request
// that the host actually honors leaves that canvas "not origin-clean" forever -- every later toDataURL/
// getImageData on it throws SecurityError, and the taint propagates to any OTHER canvas it's later drawn onto
// (js/honey.js's own HM_CTRL.snapshot() reads the shared honeycomb canvas, which these baked tiles are drawn
// onto). Most of the corpus (AIC, Cleveland, Commons -- tools/gallery.py's own GL_CORS_HOSTS-equivalent list,
// js/gallery.js's GL_CORS_HOSTS) isn't on a host that answers a CORS request, so requesting crossorigin from
// them would just fail the LOAD entirely (gallery.js's own glCORS() comment covers the same ground). The fix
// here is the other half of that same rule: request crossorigin from the hosts that do support it (NGA, the
// Rijksmuseum's IIIF host, the Met, SMK) so those tiles stay readable, and for every other remote host, never
// draw the real pixels onto a canvas at all -- fill with the painting's own dominant color instead (already
// computed, pmHex()), which keeps the honeycomb's shared canvas genuinely readable for snapshot() no matter
// which paintings happen to be on screen, at the cost of a plain color tile for most non-local paintings. Our
// own local copies (img/gallery/<path>, the "L" code in thumbs.txt) are same-origin and always safe either way.
function pmSafeHost(url) {
  try { return GL_CORS_HOSTS.has(new URL(url, location.href).hostname); } catch (e) { return false; }
}
function pmImages(onReady) {
  const cache = new Map(), bigs = new Map();   // i -> { st: 0 loading | 1 ready | 2 failed, bm, ar, used } ; i -> HTMLImageElement (kept for the big tiles)
  let flying = 0, frame = 0, dead = false;
  const bake = (i, img, crop, safe) => {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (crop && crop[2] - crop[0] > 50 && crop[3] - crop[1] > 50) { sx = crop[0] / 1000 * nw; sy = crop[1] / 1000 * nh; sw = (crop[2] - crop[0]) / 1000 * nw; sh = (crop[3] - crop[1]) / 1000 * nh; }
    const src = { sx, sy, sw, sh }, m = Math.min(sw, sh);
    const cv = document.createElement("canvas"); cv.width = cv.height = PM_BAKE;
    const cx = cv.getContext("2d");
    if (safe) cx.drawImage(img, sx + (sw - m) / 2, sy + (sh - m) / 2, m, m, 0, 0, PM_BAKE, PM_BAKE);
    else { cx.fillStyle = pmHex(i); cx.fillRect(0, 0, PM_BAKE, PM_BAKE); }
    return { cv, src };
  };
  function want(list) {   // list: gallery indices, most wanted first; also tells which ones need the full picture
    frame++;
    for (const [i, big] of list) {
      const e = cache.get(i);
      if (e) { e.used = frame; if (big && e.safe && e.st === 1 && !bigs.has(i) && e.url) pmBigLoad(i, e); continue; }
      if (flying >= PM_FLIGHT) continue;
      const t = pmThumb(i); if (!t) { cache.set(i, { st: 2, used: frame }); continue; }
      const local = t.url.startsWith("img/gallery/"), safe = local || pmSafeHost(t.url);
      const ent = { st: 0, used: frame, url: t.url, crop: t.crop, safe };
      const img = new Image(); img.decoding = "async"; if (!local && safe) img.crossOrigin = "anonymous"; ent.img = img;
      cache.set(i, ent); flying++;
      img.onload = () => {
        flying--; ent.img = null; if (dead) return;
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => {
          if (dead) return;
          // never hand an unsafe-host image to ctx.drawImage() directly (that's what taints the shared canvas,
          // js/trail.js's HM_CTRL.snapshot() included) -- only the baked square (itself safe: see bake()) goes
          // up for those; "big" stays reserved for a host we know answers a real CORS request
          try { const b = bake(i, img, t.crop, safe); ent.bm = b.cv; ent.src = b.src; ent.st = 1; ent.t0 = performance.now(); if (big && safe) { bigs.set(i, img); trimBig(); } } catch (err) { ent.st = 2; }
          onReady();
        });
      };
      img.onerror = () => { if (ent.img) { flying--; ent.img = null; } ent.st = 2; };
      img.src = t.url;
    }
    // a picture still on its way for a tile you've panned past (not wanted for ~half a second) is dropped, so the
    // ones on screen now get the connections
    cache.forEach((e, i) => { if (e.st === 0 && e.img && frame - e.used > 30) { const im = e.img; e.img = null; im.onload = im.onerror = null; im.removeAttribute("src"); flying--; cache.delete(i); } });
    if (cache.size > PM_CACHE_MAX) {   // recycle the least recently wanted
      const old = [...cache.entries()].filter(([, e]) => e.st !== 0).sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < cache.size - PM_CACHE_MAX && k < old.length; k++) { cache.delete(old[k][0]); bigs.delete(old[k][0]); }
    }
  }
  function pmBigLoad(i, e) {
    if (e.bigLoading || !e.safe) return; e.bigLoading = true;   // unsafe hosts never get a raw drawImage -- the baked square (e.bm) covers them
    const local = e.url.startsWith("img/gallery/");
    const img = new Image(); img.decoding = "async"; if (!local) img.crossOrigin = "anonymous";
    img.onload = () => { if (dead) return; bigs.set(i, img); trimBig(); onReady(); };
    img.src = e.url;
  }
  function trimBig() { while (bigs.size > PM_BIG_MAX) { const k = bigs.keys().next().value; bigs.delete(k); const e = cache.get(k); if (e) e.bigLoading = false; } }
  const stats = () => { let ok = 0, wait = 0, bad = 0; cache.forEach(e => e.st === 1 ? ok++ : e.st === 0 ? wait++ : bad++); return { ok, wait, bad, flying, bigs: bigs.size }; };
  return { get: i => cache.get(i), big: i => bigs.get(i), want, stats, destroy: () => { dead = true; cache.clear(); bigs.clear(); } };
}

// ---------- the screen ----------
let PM_NOW = null;   // { s, lay } of the open map
const PM_STATE = new Map();   // the address a map opened with -> its spec as you left it (filters and arrangement you changed)
function pmOpen(spec, o = {}) {
  // a fresh open (a tap on an entry point) starts from the spec; the same call again (Back, js/trail.js replaying it) finds
  // the map as you left it
  const from = typeof spec === "string" ? spec : JSON.stringify(spec || {}), fresh = o.fresh && !o._used;
  o._used = true;
  const el = show(`
    <div class="pmx-stage"><canvas class="pmx-cv" aria-label="Paintings as a map: drag to browse, pinch to zoom, tap the middle one to open it"></canvas><p class="pmx-wait">Laying out the paintings…</p></div>
    <header class="pmx-top">
      <button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <button class="pmx-title" data-pmfilter aria-haspopup="dialog"><b><span data-pmt>Paintings</span>${PM_ICON.down}</b><small data-pmsub></small></button>
      <span class="pmx-sp"></span>
    </header>
    <p class="pmx-why" data-pmwhy></p>
    <div class="pmx-chipbar" data-pmchipbar hidden></div>
    <div class="pmx-facets" data-pmfacets hidden></div>
    <div class="pmx-cap" data-pmcap hidden>
      <button class="pmx-cap-main" data-pmopen><b data-pmct></b><small data-pmcb></small></button>
      <button class="pmx-center" data-pmcenter aria-label="Center the map on this painting">${PM_ICON.similar}</button>
      <button class="pmx-heart" data-pmheart aria-label="Add to your favorites"></button>
    </div>
    <button class="corner r pmx-do" data-do-corner aria-label="Arrange and filter" aria-haspopup="menu" aria-expanded="false">${PM_ICON.arrange}</button>
  `, "fixed cx pmx");
  const back = el.querySelector("[data-back]");
  back.onclick = () => xBack();
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet,.rooms-stem")) xBack(); };
  Promise.all([xbLoad(), pmThumbsLoad()]).then(([F]) => {
    if (!el.isConnected) return;
    const kept = !fresh && PM_STATE.get(from);
    const s = kept || (typeof spec === "string" ? pmParse(spec, F) : { ...pmFresh(), ...spec, f: { ...xbFresh(), ...(spec && spec.f || {}) } });
    PM_STATE.set(from, s);
    pmMount(el, s, F);
  }).catch(err => {
    if (!el.isConnected) return;
    console.warn(err);
    el.querySelector(".pmx-wait").innerHTML = `The paintings didn't load. <button class="wl" data-pmretry>Try again</button>`;
    el.querySelector("[data-pmretry]").onclick = () => pmOpen(spec, o);
  });
  return el;
}
function pmMount(el, s, F) {
  const cv = el.querySelector(".pmx-cv"), ctx = cv.getContext("2d"), wait = el.querySelector(".pmx-wait");
  const RM = reduceMotion, cap = el.querySelector("[data-pmcap]"), heart = el.querySelector("[data-pmheart]");
  const centerBtn = el.querySelector("[data-pmcenter]"), facets = el.querySelector("[data-pmfacets]"), chipbar = el.querySelector("[data-pmchipbar]");
  let lay = null, W = 0, H = 0, dpr = 1, base = 46;
  let P = [0, 0], Z = 1, V = [0, 0], glide = null, raf = 0, dead = false, centerK = -1, lastTick = 0, drawn = [];
  const ZMAX = 2.2;
  const imgs = pmImages(() => kick());
  // ---- the lens (js/honey.js's round fisheye): F(z) is how far from the middle a cell z cells away is drawn
  // far out, the lens softens (as on the color map), so the overview reads as one even mosaic
  const M0N = 4.6, M1 = 1, SIG = 1.1;
  let M0 = M0N, A = (M0 - M1) * SIG * .8862;
  const lensAt = () => { M0 = M1 + (M0N - M1) * clamp((Z - .22) / .5, .3, 1); A = (M0 - M1) * SIG * .8862; };
  const erf = x => { const sg = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x); return sg * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
  const K = () => base * Z;
  const Fz = z => K() * (M1 * z + A * erf(z / SIG));
  const magR = z => M1 + (M0 - M1) * Math.exp(-((z / SIG) ** 2));
  const tanR = z => z < 1e-4 ? M0 : (M1 * z + A * erf(z / SIG)) / z;
  const Finv = r => { let lo = 0, hi = 600; for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (Fz(m) > r) hi = m; else lo = m; } return (lo + hi) / 2; };
  // the zoom-out floor: never more than ~45 cells from the middle to the corner (about 6,000 tiles), and never past
  // the point where the whole set already fits
  const zMin = () => {
    const D = Math.hypot(W, H) / 2 + 30, fit = lay ? Math.max(lay.GW, lay.GH) * .62 + 2 : 45, R = Math.min(45, Math.max(5, fit));
    return Math.max(.18, Math.min(1, D / (R + A) / base));
  };
  function size() {
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    base = Math.max(34, Math.min(56, W / 9.5));
    kick();
  }
  // ---- what's in the middle
  const nearestK = (px, py) => {
    const cx = Math.round(px), cy = Math.round(py); let best = -1, bd = 1e9;
    for (let r = 0; r <= 6 && best < 0; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      const k = pmAt(lay, x, y); if (k < 0) continue; const d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  function setCenter(k) {
    if (k === centerK) return;
    centerK = k;
    const now = performance.now();
    if (k >= 0 && now - lastTick > 70 && touched) { lastTick = now; buzz(4); }
    caption();
  }
  let capTimer = 0;
  function caption() {
    if (centerK < 0 || !lay) { cap.hidden = true; facets.hidden = true; return; }
    const i = lay.items[centerK], a = F.artist[i], y = glYear(i), by = [a ? xbArtistName(F, a) : "", y].filter(Boolean).join(" · ");
    cap.hidden = false;
    const d = glDetailNow(i);
    cap.querySelector("[data-pmct]").textContent = d ? d.t : " ";
    cap.querySelector("[data-pmcb]").textContent = by || (d && d.co) || "";
    cap.style.setProperty("--c", pmHex(i));
    paintHeart(i, d);
    if (!d) { clearTimeout(capTimer); capTimer = setTimeout(() => glDetail(i).then(() => { if (!dead && lay && lay.items[centerK] === i) caption(); }).catch(() => {}), 90); }
    PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z });
    paintFacets(i);
  }
  // filter-by-example (David, 2026-10-09): the centered painting's own facets as tappable "only these" chips,
  // plus "More like this" (the same whole-palette matching as the "similar" arrangement, seeded here)
  function paintFacets(i) {
    const fs = pmFacetsOf(i, F);
    facets.hidden = false;
    facets.innerHTML = `<button class="pmx-fchip pmx-fchip-more" data-pmmore>More like this</button>${fs.map((fc, k) => `<button class="pmx-fchip" data-pmfacet="${k}">${fc.dim === "color" ? `<i style="--c:${fc.val}"></i>` : ""}${esc(fc.label)}</button>`).join("")}`;
    facets.querySelector("[data-pmmore]").onclick = () => { buzz(6); s.seed = i; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "rings"; rebuild(); };
    facets.querySelectorAll("[data-pmfacet]").forEach(b => b.onclick = () => {
      const fc = fs[+b.dataset.pmfacet]; buzz(6); pmFacetApply(s.f, fc.dim, fc.val); rebuild();
    });
  }
  function paintHeart(i, d) {
    const on = !!(d && typeof fvArtHas === "function" && fvArtHas(d.id));
    heart.hidden = !d || typeof fvArtSet !== "function";
    heart.classList.toggle("on", on); heart.setAttribute("aria-pressed", on);
    heart.setAttribute("aria-label", on ? "Remove from your favorites" : "Add to your favorites");
    heart.innerHTML = on ? FVA_HEART_ON : FVA_HEART;
  }
  function toggleHeart(only) {
    if (centerK < 0) return;
    const i = lay.items[centerK], d = glDetailNow(i); if (!d || typeof fvArtSet !== "function") return;
    const on = !fvArtHas(d.id); if (only && !on) { buzz(6); return; }
    fvArtSet(i, d, on); buzz(on ? 10 : 4); paintHeart(i, d);
    heart.classList.remove("pop"); void heart.offsetWidth; if (on) heart.classList.add("pop");
    // low: this heart sits in the map's own corner bar, not the fixed top bar, but a top toast would still cover
    // it the same way (David, 2026-10-09)
    if (on) toast("In your favorites", { action: "See them", onAction: () => { S.fvCat = "paintings"; save(); XSTACK.push("favs"); favShelf(); }, low: true, ms: 3000 });
  }
  // ---- drawing
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  let touched = false, clock = 0, lastNow = 0, frameDt = 16;
  // the map's own clock: every frame moves it at least 8 ms (and at most 40), so a glide, a flick or a fade always
  // ends after a bounded number of frames, even where the wall clock stalls (a background tab, a headless test run)
  function frame() {
    const now = performance.now(); frameDt = lastNow ? clamp(now - lastNow, 8, 40) : 16; lastNow = now; clock += frameDt;
    const t = clock;
    raf = 0; if (dead || !lay || !W) return;
    let moving = false;
    if (glide) {
      const u = Math.min(1, (t - glide.t0) / glide.dur), e = RM ? 1 : 1 - Math.pow(1 - u, 3);
      P[0] = glide.a[0] + (glide.b[0] - glide.a[0]) * e; P[1] = glide.a[1] + (glide.b[1] - glide.a[1]) * e;
      if (glide.z) Z = glide.z[0] + (glide.z[1] - glide.z[0]) * e;
      if (u >= 1) glide = null; moving = true;
    } else if (!drag && (Math.abs(V[0]) > 1e-4 || Math.abs(V[1]) > 1e-4)) {
      const dt = frameDt; P[0] -= V[0] * dt; P[1] -= V[1] * dt;
      const k = Math.exp(-dt / 300); V[0] *= k; V[1] *= k; moving = true;
      if (Math.hypot(V[0], V[1]) < .0006) { V = [0, 0]; settle(); }
      clampPan();
    }
    draw(t);
    if (moving || fading) kick();
  }
  let fading = false;
  function clampPan() {   // the finite map springs back inside its own edges
    const pad = 1;
    P[0] = clamp(P[0], lay.gx0 - pad, lay.gx0 + lay.GW - 1 + pad); P[1] = clamp(P[1], lay.gy0 - pad, lay.gy0 + lay.GH - 1 + pad);
  }
  function draw(t) {
    lensAt();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0E0D0B"; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Finv(Math.hypot(W, H) / 2 + 40), k0 = K();
    const map = (ex, ey) => { const z = Math.hypot(ex, ey), f = z < 1e-6 ? K() * M0 : Fz(z) / z; return [cx + ex * f, cy + ey * f]; };
    const x0 = Math.floor(P[0] - R), x1 = Math.ceil(P[0] + R), y0 = Math.floor(P[1] - R), y1 = Math.ceil(P[1] + R);
    drawn = []; const wantImg = [];
    for (let y = Math.max(y0, lay.gy0); y <= Math.min(y1, lay.gy0 + lay.GH - 1); y++) {
      const row = (y - lay.gy0) * lay.GW;
      for (let x = Math.max(x0, lay.gx0); x <= Math.min(x1, lay.gx0 + lay.GW - 1); x++) {
        const k = lay.grid[row + x - lay.gx0]; if (k < 0) continue;
        const ex = x - P[0], ey = y - P[1], z = Math.hypot(ex, ey); if (z > R) continue;
        const [sx, sy] = map(ex, ey);
        // as big as its neighbors' places allow: the screen distance to the cell beside it and the one above or below
        // (the lens squeezes the two directions differently away from the middle), so the seams stay even
        const r = map(ex + 1, ey), l = map(ex - 1, ey), dn = map(ex, ey + 1), u = map(ex, ey - 1);
        // a tile fills its own place: halfway to each neighbor on every side (the lens pushes the near side farther away
        // than the far one), less an even seam, and never more oblong than 3:2
        const x0 = (l[0] + sx) / 2, x1 = (sx + r[0]) / 2, y0 = (u[1] + sy) / 2, y1 = (sy + dn[1]) / 2;
        let tw = x1 - x0, th = y1 - y0;
        const gap = Math.min(6, 1 + Math.min(tw, th) * .05);
        tw = Math.min(tw, th * 1.5) - gap; th = Math.min(th, (x1 - x0) * 1.5) - gap;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.max(tw, th);
        if (d < 1.2 || mx < -d || my < -d || mx > W + d || my > H + d) continue;
        drawn.push({ k, x: mx, y: my, d, z, tw, th });
      }
    }
    drawn.sort((a, b) => a.d - b.d);
    fading = false;
    for (const b of drawn) {
      const i = lay.items[b.k], e = imgs.get(i);
      let w = b.tw, h = b.th;
      // the middle one takes its own shape, whole and uncropped, a little bigger than its cell
      const m = Math.exp(-((b.z / .5) ** 2));
      if (m > .02) {
        const ar = GAL.ar[i], B = b.d * (1 + .4 * m), cw = ar > 1 ? B / ar : B, ch = ar > 1 ? B : B * ar;
        w = b.tw + (cw - b.tw) * m; h = b.th + (ch - b.th) * m;
      }
      const X = b.x - w / 2, Y = b.y - h / 2;
      b.w = w; b.h = h;
      if (m > .3) { ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8; ctx.fillStyle = pmHex(i); ctx.fillRect(X, Y, w, h); ctx.restore(); }
      else { ctx.fillStyle = pmHex(i); ctx.fillRect(X, Y, w, h); }
      if (b.d >= 14) wantImg.push([i, b.d > 92 || m > .3]);
      if (e && e.st === 1 && b.d >= 7) {
        if (e.fadeT == null) e.fadeT = t;
        const age = t - e.fadeT, a = RM ? 1 : Math.min(1, age / 260); if (a < 1) fading = true;
        ctx.globalAlpha = a;
        const big = (b.d > 92 || m > .02) && imgs.big(i);
        if (big) {   // from the full picture: crop (frame away), then cover the tile's own shape
          const sr = e.src, ta = h / w; let sw = sr.sw, sh = sr.sh;
          if (sh / sw > ta) sh = sw * ta; else sw = sh / ta;
          ctx.drawImage(big, sr.sx + (sr.sw - sw) / 2, sr.sy + (sr.sh - sh) / 2, sw, sh, X, Y, w, h);
        } else if (m > .02) {   // still only the baked square: show it as the square crop at the middle size
          const s = Math.max(w, h); ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, h); ctx.clip(); ctx.drawImage(e.bm, b.x - s / 2, b.y - s / 2, s, s); ctx.restore();
        } else {   // the baked square, cover-cropped to the tile's shape
          const q = PM_BAKE, sw = w >= h ? q : q * w / h, sh = h >= w ? q : q * h / w;
          ctx.drawImage(e.bm, (q - sw) / 2, (q - sh) / 2, sw, sh, X, Y, w, h);
        }
        ctx.globalAlpha = 1;
      }
      if (b.d >= 40 && GAL.mean[i * 3] < 24) { ctx.strokeStyle = "rgba(236,232,223,.14)"; ctx.lineWidth = 1; ctx.strokeRect(X + .5, Y + .5, w - 1, h - 1); }
    }
    // band and painter labels, where there's room to read them
    if (lay.labels.length) {
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      for (const L of lay.labels) {
        const ex = L.x - .45 - P[0], ey = L.y + .3 - P[1], z = Math.hypot(ex, ey); if (z > R) continue;
        const f = z < 1e-6 ? 0 : Fz(z) / z, sx = cx + ex * f, sy = cy + ey * f, cell = k0 * Math.min(magR(z), tanR(z));
        if (cell < 15 || sx > W || sy < -20 || sy > H + 20) continue;
        const room = cell * (L.w + .6) - 4; if (room < 34) continue;
        const fs = Math.min(22, Math.max(13, cell * .42));
        ctx.font = `400 ${fs}px "Instrument Serif", Georgia, serif`;
        let txt = L.text;
        if (ctx.measureText(txt).width > room) { while (txt.length > 2 && ctx.measureText(txt + "…").width > room) txt = txt.slice(0, -1); txt += "…"; }
        ctx.fillStyle = "rgba(236,232,223,.92)"; ctx.fillText(txt, sx, sy);
        const tw = ctx.measureText(txt).width;
        if (room - tw > 40) { ctx.font = `500 ${Math.max(11, fs * .55)}px "Geist Mono", Menlo, monospace`; ctx.fillStyle = "rgba(163,158,146,.9)"; ctx.fillText(L.n.toLocaleString(), sx + tw + 8, sy); }
      }
    }
    // David, 2026-10-09: "zooming out doesn't load the stuff" -- this cap used to be 160, which silently excluded
    // every cell beyond the nearest ~160 from ever being requested at all, however long you waited: want()'s own
    // PM_FLIGHT (14 concurrent) and PM_CACHE_MAX (650) already bound real network/memory use, so the extra slice
    // here was only ever throttling visibility, not cost. 2000 is comfortably above what a phone screen can hold
    // at the 14px threshold above (zMin() also caps how far you can zoom out), so every on-screen eligible cell
    // now gets a turn in the queue, nearest the middle first, same as before.
    imgs.want(wantImg.reverse().slice(0, 2000));

    const c = nearestK(P[0], P[1]); setCenter(c);
  }
  // ---- gestures: drag to pan (the middle follows the thumb), pinch or wheel to zoom, flick to glide, a tap opens or brings
  const pts = new Map(); let drag = null, pinch = null, press = null;
  const toPlane = (dx, dy) => [dx / (K() * M0), dy / (K() * M0)];
  function settle() {
    const k = nearestK(P[0], P[1]); if (k < 0) return;
    glideTo([lay.x[k], lay.y[k]], 260);
  }
  function glideTo(b, dur = 340, z) { glide = { a: P.slice(), b, t0: clock, dur, z: z ? [Z, z] : null }; V = [0, 0]; kick(); }
  cv.addEventListener("pointerdown", e => {
    touched = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    glide = null; V = [0, 0];
    if (pts.size === 1) {
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, hist: [[performance.now(), e.clientX, e.clientY]] };
      press = setTimeout(() => {   // a long press on the middle painting keeps it in your favorites
        press = null; if (!drag || drag.moved) return;
        const hit = hitAt(e.clientX, e.clientY);
        if (hit && hit.k === centerK) { drag.held = true; bloomAt(e.clientX, e.clientY); toggleHeart(true); }
      }, 480);
    } else if (pts.size === 2) {
      clearTimeout(press); press = null;
      const [a, b] = [...pts.values()]; pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: Z }; if (drag) drag.moved = true;
    }
  });
  cv.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      Z = clamp(pinch.z0 * d / Math.max(10, pinch.d0), zMin(), ZMAX); kick(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    if (!drag.moved) { drag.moved = true; clearTimeout(press); press = null; }
    const [u, v] = toPlane(dx, dy); P[0] -= u; P[1] -= v; clampPan();
    drag.x = e.clientX; drag.y = e.clientY;
    const now = performance.now(); drag.hist.push([now, e.clientX, e.clientY]); while (drag.hist.length > 2 && now - drag.hist[0][0] > 90) drag.hist.shift();
    kick();
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    clearTimeout(press); press = null;
    if (pinch) { if (pts.size < 2) { pinch = null; drag = null; if (!pts.size) settle(); } return; }
    const d = drag; drag = null; if (!d) return;
    if (d.held) return;
    if (!d.moved && e.type === "pointerup") return tap(e.clientX, e.clientY);
    const h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]);
    if (b[0] - a[0] > 0 && performance.now() - b[0] < 80) { const [u, v] = toPlane(b[1] - a[1], b[2] - a[2]); V = [u / dt, v / dt]; }
    if (Math.hypot(V[0], V[1]) < .0006) { V = [0, 0]; settle(); }
    kick();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", e => { e.preventDefault(); touched = true; Z = clamp(Z * Math.exp(-e.deltaY * .0015), zMin(), ZMAX); kick(); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 180); }, { passive: false });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  function hitAt(x, y) {
    const r = cv.getBoundingClientRect(), px = x - r.left, py = y - r.top;
    for (let j = drawn.length - 1; j >= 0; j--) { const b = drawn[j]; if (Math.abs(px - b.x) <= b.w / 2 && Math.abs(py - b.y) <= b.h / 2) return b; }
    return null;
  }
  function bloomAt(x, y) {
    const bl = document.createElement("i"); bl.className = "fva-bloom pmx-bloom"; bl.innerHTML = FVA_HEART_ON;
    bl.style.left = x + "px"; bl.style.top = y + "px"; el.appendChild(bl); setTimeout(() => bl.remove(), 900);
  }
  // double-tap the centered painting to like it (Instagram-style, David 2026-10-09): opening it is delayed the
  // same ~280ms js/gallery.js and js/swatch.js use, so a quick second tap can be caught first and turned into
  // the heart burst + toggle instead of opening the page
  let lastTapAt = 0, tapTimer = 0;
  function tap(x, y) {
    const b = hitAt(x, y); if (!b) return;
    if (b.k === centerK && b.z < .6) {
      const now = performance.now();
      if (now - lastTapAt < 300) {
        clearTimeout(tapTimer); tapTimer = 0; lastTapAt = 0;
        bloomAt(x, y); toggleHeart(true);   // double-tap only adds, like the long press just above — never un-hearts
        if (typeof sfxColor === "function") sfxColor(pmHex(b.k));
        return;
      }
      lastTapAt = now;
      tapTimer = setTimeout(() => { lastTapAt = 0; if (!dead) openK(b.k); }, 280);
      return;
    }
    buzz(5); glideTo([lay.x[b.k], lay.y[b.k]], 360);
  }
  function openK(k) {
    const i = lay.items[k];
    PM_PAN.set(lay.key, { x: lay.x[k], y: lay.y[k], s: Z });
    // the map's color filter can hold a whole set (?c=hex1,hex2…, from a pair/set page's "as a map" link); carry
    // all of it onto the painting, not just the first one (David, 2026-10-08).
    buzz(8); galleryPage(i, true, s.f.hexes.length > 1 ? s.f.hexes : (s.f.hexes[0] || null), s.f.hexes.length ? s.f.tol : null);
  }
  el.querySelector("[data-pmopen]").onclick = () => { if (centerK >= 0) openK(centerK); };
  heart.onclick = () => toggleHeart(false);
  // "Center on this painting" (David, 2026-10-09, part of the Arrange parity with the color map): the quickest
  // way to pivot to "around one painting" is the one you're already looking at, right from its own bottom card
  centerBtn.onclick = () => {
    if (centerK < 0) return;
    const i = lay.items[centerK]; buzz(6);
    if (PM_NEEDS_SEED.has(s.arr) && s.seed === i) return;
    s.seed = i; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "rings"; rebuild();
  };

  // ---- the chrome: the title says what's showing (tap: filter), one line says what position means, the corner arranges
  function chrome() {
    const n = lay ? lay.n : 0, words = pmWords(s, F);
    el.querySelector("[data-pmt]").textContent = PM_ARR.find(a => a[0] === s.arr)[1];
    el.querySelector("[data-pmsub]").textContent = `${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}${words.length ? " · " + words.join(" · ") : ""}`;
    let why = PM_WHY[s.arr];
    el.querySelector("[data-pmwhy]").textContent = why;
    paintChipbar();
  }
  // removable active-filter chips atop the map (David, 2026-10-09): the primary way to SEE and UNDO a filter,
  // whichever way it got set (the Filter tab, or a tap on a painting's own facet) -- opening the sheet is no
  // longer required just to clear one thing.
  function paintChipbar() {
    const chips = pmActiveChips(s, F);
    chipbar.hidden = !chips.length;
    if (!chips.length) return;
    chipbar.innerHTML = chips.map((c, k) => `<button class="pmx-xchip" data-pmxclear="${k}">${esc(c.text)}<i>${ICON.x}</i></button>`).join("");
    chipbar.querySelectorAll("[data-pmxclear]").forEach(b => b.onclick = () => {
      const c = chips[+b.dataset.pmxclear]; buzz(5);
      if (c.dim === "fav") s.fav = 0; else s.f = xbWithout(s.f, c.dim);
      rebuild();
    });
  }
  function build(keepPan) {
    const t0 = performance.now();
    lay = pmLayout(s, F); PM_NOW = { s, lay };
    wait.hidden = !!lay.n;
    if (!lay.n) wait.innerHTML = `Nothing matches all of that. <button class="wl" data-pmloosen>Clear the filters</button>`;
    const lz = wait.querySelector("[data-pmloosen]"); if (lz) lz.onclick = () => { s.f = xbFresh(); s.fav = 0; rebuild(); };
    const mem = PM_PAN.get(lay.key);
    if (mem && !keepPan) { P = [mem.x, mem.y]; Z = mem.s; }
    else if (!keepPan) { P = lay.start.slice(); Z = 1; const k = nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; }
    if (keepPan) { const k = nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; }
    Z = clamp(Z, zMin(), ZMAX);
    centerK = -1; drawn = []; setCenter(lay.n ? nearestK(P[0], P[1]) : -1); chrome(); kick();
    if (window.PM_DEBUG) console.log("paintmap layout", s.arr, lay.n, Math.round(performance.now() - t0) + "ms");
  }
  function rebuild() {
    // the address follows (replace: a filter change is the same map, not a new page)
    try { ROUTE_NOW = "#/" + pmRouteOf(s).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
    build(false);
  }
  // ---- the corner and the title both open one compact, non-modal Arrange|Filter sheet (David, 2026-10-09: the
  // same Arrange+Filter parity the color map's chooser() has -- shapes/sort/place-by/center-on, live-applied,
  // no separate confirm step). Replaces the old radial stem menu and the standalone Filter-only sheet.
  const doBtn = el.querySelector(".pmx-do"); doBtn._html = doBtn.innerHTML;
  doBtn.onclick = () => openSheet("arrange");
  el.querySelector("[data-pmfilter]").onclick = () => openSheet("filter");
  function openSheet(startTab) {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;   // a ghost click right after closing must not reopen it (js/core.js)
    let tab = startTab === "filter" ? "filter" : "arrange";
    let fopen = { co: false, painter: false }, fq = "";
    const tabsHTML = `<div class="hm-ch-tabs pmx-tabs" role="tablist" aria-label="Arrange or filter the painting map">
        <button class="hm-ch-tab" data-tab="arrange" role="tab">Arrange</button>
        <button class="hm-ch-tab" data-tab="filter" role="tab">Filter</button>
      </div>`;
    const head = `<div class="hm-ch-head" data-sheet-grab>${tabsHTML}
        <button class="iconq" data-pmcolors aria-label="Switch to the color map">${PM_ICON.colorsMode}</button>
        <button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>`;
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser" data-tab="${tab}">${head}
        <div class="hm-ch-scroll" data-pane="arrange" data-sheet-scroll></div>
        <div class="hm-ch-scroll" data-pane="filter" data-sheet-scroll><div data-pmbody></div></div>
      </div>`, { lock: false });
    // the color map's own compact, non-modal panel sizing (css/home.css .hm-sheet-panel: height min(40dvh,400px),
    // the map stays interactive underneath) -- the same bar this sheet is matching, not new CSS of its own.
    // .hm-sheet-arrange additionally goes height:auto there (the Arrange tab's content decides it); toggled to
    // match whichever tab is actually showing, same as home.js's own chooser() does on a tab switch.
    sh.classList.add("pmx-sheet", "hm-sheet-panel");
    sh.classList.toggle("hm-sheet-arrange", tab === "arrange");
    sh.setAttribute("aria-label", "Arrange or filter the painting map");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    const q$ = sel => sh.querySelector(sel), qa$ = sel => [...sh.querySelectorAll(sel)];
    const paneArr = q$('[data-pane="arrange"]'), paneFilt = q$('[data-pane="filter"]');
    const syncTab = () => {
      paneArr.hidden = tab !== "arrange"; paneFilt.hidden = tab !== "filter";
      qa$(".hm-ch-tab").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      sh.dataset.tab = tab;
      sh.classList.toggle("hm-sheet-arrange", tab === "arrange");
    };
    syncTab();
    qa$(".hm-ch-tab").forEach(b => b.onclick = () => { if (b.dataset.tab === tab) return; buzz(4); tab = b.dataset.tab; syncTab(); });
    q$("[data-pmcolors]").onclick = () => { buzz(6); S.hm = S.hm || {}; S.hm.mode = "colors"; save(); if (typeof hmHome === "function") hmHome(); else xBack(); };
    qa$("[data-sheet-close]").forEach(b => b.onclick = () => { buzz(4); close(); });

    // ---- Arrange: shape, place by (only where a painting's own color decides position), center on, and the
    // arc's old "Around this one" is now "Center on this painting" (also on the bottom card) ----
    function renderArrange() {
      const mid = centerK >= 0 ? lay.items[centerK] : -1, md = mid >= 0 ? glDetailNow(mid) : null;
      const list = pmList(s, F);
      paneArr.innerHTML = `
        <div class="cx-sec"><b>Shape</b></div>
        <div class="hm-arr pmx-arr" role="radiogroup" aria-label="Arrange by">${PM_ARR.map(([k, t]) => `
          <button class="hm-arr-b${s.arr === k ? " on" : ""}" data-pmarr="${k}" role="radio" aria-checked="${s.arr === k}">
            <span class="hm-arr-pic">${PM_ICON[k]}</span><b>${esc(t)}</b></button>`).join("")}</div>
        <p class="hm-arr-sub">${PM_NEEDS_SEED.has(s.arr) && md ? `Around ${esc(md.t)}` : esc(PM_WHY[s.arr])}</p>
        ${s.arr === "color" || s.arr === "time" || s.arr === "tones" ? `<div class="cx-sec"><b>Place by</b></div>
          <div class="hm-seg" role="radiogroup" aria-label="Place by">${PM_PLACE.map(([k, t]) => `<button class="${(s.place || "avg") === k ? "on" : ""}" data-pmplace="${k}">${esc(t)}</button>`).join("")}</div>` : ""}
        <div class="cx-sec"><b>Center on</b></div>
        <div class="hm-seg hm-seg-n pmx-center-seg">${PM_CENTER.map(([k, t]) => {
          const found = t === "A favorite" ? (typeof fvArtList === "function" && fvArtList().length) : true;
          return `<button data-pmcenterk="${k}"${found ? "" : " disabled"}>${esc(t)}</button>`;
        }).join("")}</div>`;
      qa$("[data-pmarr]").forEach(b => b.onclick = () => {
        const id = b.dataset.pmarr; buzz(5);
        if (PM_NEEDS_SEED.has(id)) { if (mid < 0) return; s.seed = mid; s.arr = id; }
        else { if (s.arr === id) return; s.arr = id; }
        rebuild(); renderArrange();
      });
      qa$("[data-pmplace]").forEach(b => b.onclick = () => {
        const p = b.dataset.pmplace; if ((s.place || "avg") === p) return; buzz(5); s.place = p; rebuild(); renderArrange();
      });
      qa$("[data-pmcenterk]").forEach(b => b.onclick = () => {
        const fn = PM_CENTER.find(c => c[0] === b.dataset.pmcenterk)[2], found = fn(list);
        if (found < 0) return; buzz(6); s.seed = found; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "rings"; rebuild(); renderArrange();
      });
    }
    // ---- Filter: every chip with its count, applied live (no separate confirm -- matches the color map's
    // non-modal Colors/Arrange sheet) ----
    function renderFilter() {
      const res = xbRun(F, s.f), C = res.counts;
      let n = res.list.length;
      const favIds = typeof fvArtList === "function" ? fvArtList() : [], favSet = new Set(favIds.map(r => r.i));
      if (s.fav) n = Array.from(res.list).filter(i => favSet.has(i)).length;
      const favN = Array.from(res.list).filter(i => favSet.has(i)).length;
      const chip = (attr, val, label, cnt, on) => `<button class="${on ? "on" : ""}" ${attr}="${esc(String(val))}"${!cnt && !on ? " disabled" : ""}>${esc(label)}${cnt != null ? `<em>${cnt.toLocaleString()}</em>` : ""}</button>`;
      const f = s.f, top = (arr, k) => arr.map((name, j) => ({ name, v: j + 1, n: C[k][j + 1] })).filter(x => x.n || f[k] === x.v).sort((a, b) => b.n - a.n);
      const cent = new Map(); for (let d = 0; d < XB_NDEC; d++) { const c = Math.floor((XB_DEC0 + d * 10) / 100) * 100; cent.set(c, (cent.get(c) || 0) + C.when[d]); }
      const cOn = f.y0 != null && f.y1 != null ? Math.floor(f.y0 / 100) * 100 : null, decOn = f.y0 != null && f.y1 - f.y0 === 9;
      const cents = [...cent.entries()].filter(([c, v]) => v || c === cOn).filter(([c]) => c >= 1300);
      const decs = cOn != null ? Array.from({ length: 10 }, (_, j) => cOn + j * 10).map(y => ({ y, n: C.when[(y - XB_DEC0) / 10] || 0 })) : [];
      const cols = [...BASICS, ...ALL].filter(c => !c.basic || /^(Red|Blue|Green|Yellow|Pink|Purple|Orange|Brown)$/.test(c.n));
      const colsSorted = typeof glHueOrder === "function" ? glHueOrder(cols) : cols;
      const cos = top(F.meta.countries, "co"), mvs = top(F.meta.movements, "mv"), pas = top(F.meta.artists.map(a => a[0]), "painter");
      const pList = fq ? pas.filter(x => x.name.toLowerCase().includes(fq.toLowerCase())).slice(0, 24) : pas.slice(0, fopen.painter ? 40 : 10);
      q$("[data-pmbody]").innerHTML = `
        <div class="pmx-sh-top"><b>Filter</b><span>${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}</span><button class="pmx-reset" data-pmreset>Reset</button></div>
        ${favIds.length ? `<div class="pmx-row"><span class="pmx-lab">Yours</span><div class="pmx-chips">${chip("data-pmfav", 1, "Your favorites", favN, !!s.fav)}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">Color</span><div class="pmx-sw">${colsSorted.map(c => `<button data-pmhex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" class="${f.hexes[0] === c.h.toUpperCase() ? "on" : ""}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
          ${f.hexes.length ? `<p class="pmx-cap2"><i style="--c:${f.hexes[0]}"></i>${esc(f.name || nameOf(f.hexes[0]).text)} <span>· within ${f.tol}% · at least ${f.cover}% of the painting</span></p>` : ""}</div>
        <div class="pmx-row"><span class="pmx-lab">When</span><div class="pmx-chips">${cents.map(([c, v]) => chip("data-pmcent", c, c + "s", v, cOn === c && !decOn)).join("")}</div>
          ${decs.length ? `<div class="pmx-chips pmx-sub">${decs.map(d => chip("data-pmdec", d.y, d.y + "s", d.n, decOn && f.y0 === d.y)).join("")}</div>` : ""}</div>
        <div class="pmx-row"><span class="pmx-lab">Country</span><div class="pmx-chips">${(fopen.co ? cos : cos.slice(0, 10)).map(x => chip("data-pmco", x.v, x.name, x.n, f.co === x.v)).join("")}${cos.length > 10 && !fopen.co ? `<button class="pmx-more" data-pmmore="co">All ${cos.length}</button>` : ""}</div></div>
        ${mvs.length ? `<div class="pmx-row"><span class="pmx-lab">Movement</span><div class="pmx-chips">${mvs.map(x => chip("data-pmmv", x.v, x.name, x.n, f.mv === x.v)).join("")}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">Museum</span><div class="pmx-chips">${F.G.src.map((m, k) => chip("data-pmmus", k, m.short, C.mus[k], f.mus === k)).join("")}</div></div>
        <div class="pmx-row"><span class="pmx-lab">Painter</span>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmq type="search" placeholder="Find a painter" value="${esc(fq)}" autocomplete="off"></label>
          <div class="pmx-chips">${f.painter && !pList.some(x => x.v === f.painter) ? chip("data-pmp", f.painter, xbArtistName(F, f.painter), C.painter[f.painter], true) : ""}${pList.map(x => chip("data-pmp", x.v, x.name, x.n, f.painter === x.v)).join("")}${!fq && !fopen.painter && pas.length > 10 ? `<button class="pmx-more" data-pmmore="painter">More painters</button>` : ""}</div></div>`;
      const inp = q$("[data-pmq]");
      inp.oninput = () => { fq = inp.value.trim(); const pos = inp.selectionStart; renderFilter(); const ni = q$("[data-pmq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
    }
    paneFilt.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const f = s.f, d = b.dataset;
      if (d.pmreset != null) { s.f = xbFresh(); s.fav = 0; fq = ""; buzz(6); rebuild(); return renderFilter(); }
      if (d.pmmore) { fopen[d.pmmore] = true; return renderFilter(); }
      if (d.pmfav != null) s.fav = s.fav ? 0 : 1;
      else if (d.pmhex) { const same = f.hexes[0] === d.pmhex.toUpperCase(); f.hexes = same ? [] : [d.pmhex.toUpperCase()]; f.name = same ? "" : d.name; f.tol = 8; f.cover = 5; }
      else if (d.pmcent) { const c = +d.pmcent, on = f.y0 === c && f.y1 === c + 99; f.y0 = on ? null : c; f.y1 = on ? null : c + 99; }
      else if (d.pmdec) { const y = +d.pmdec, on = f.y0 === y && f.y1 === y + 9; const c = Math.floor(y / 100) * 100; f.y0 = on ? c : y; f.y1 = on ? c + 99 : y + 9; }
      else if (d.pmco) f.co = f.co === +d.pmco ? 0 : +d.pmco;
      else if (d.pmmv) f.mv = f.mv === +d.pmmv ? 0 : +d.pmmv;
      else if (d.pmmus) f.mus = f.mus === +d.pmmus ? -1 : +d.pmmus;
      else if (d.pmp) f.painter = f.painter === +d.pmp ? 0 : +d.pmp;
      else return;
      buzz(5); rebuild(); renderFilter();
    });
    renderArrange(); renderFilter();
  }
  // ---- life cycle
  const ro = new ResizeObserver(() => size()); ro.observe(cv);
  cleanup.push(() => { dead = true; clearTimeout(tapTimer); ro.disconnect(); cancelAnimationFrame(raf); imgs.destroy(); if (lay && centerK >= 0) PM_PAN.set(lay.key, { x: lay.x[centerK], y: lay.y[centerK], s: Z }); });
  size(); build(false);
  window.PM_CTRL = { get center() { return centerK >= 0 ? lay.items[centerK] : -1; }, get count() { return lay ? lay.n : 0; }, get drawn() { return drawn.length; }, images: () => imgs.stats(), get spec() { return s; }, glideTo: k => glideTo([lay.x[k], lay.y[k]], 300), lay: () => lay, zoom: z => { Z = clamp(z, zMin(), ZMAX); kick(); } };
}

// this file can load after router.js (on first use): give pmOpen its address now
if (typeof routeWrapAll === "function") routeWrapAll();
