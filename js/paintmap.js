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

const PM_ARR = [["color", "By color"], ["time", "By time"], ["painter", "By painter"], ["similar", "Around one painting"]];
const PM_WHY = {
  color: "Lighter toward the top, hues left to right",
  time: "Oldest at the top, a band for each decade",
  painter: "A block for each painter, earliest first",
  similar: "The nearer the middle, the closer the colors",
};
const PM_ICON = {
  color: sv('<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="8" r="3.2"/><circle cx="12" cy="15.5" r="3.2"/>', 22, 1.7),
  time: sv('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4M14 10v4M10 16v4"/>', 22, 1.7),
  painter: sv('<rect x="3.5" y="4" width="7" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="4" rx="1.2"/><rect x="13.5" y="11" width="7" height="9" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/>', 22, 1.7),
  similar: sv('<rect x="9" y="9" width="6" height="6" rx="1.2"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="2.5 3"/>', 22, 1.7),
  arrange: sv('<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 22, 1.6),
  filter: sv('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>', 22, 1.6),
  down: sv('<path d="M7 10l5 5 5-5"/>', 14, 2),
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
const pmFresh = () => ({ arr: "color", f: xbFresh(), seed: -1, fav: 0 });
function pmParse(q, F) {
  const s = pmFresh(), p = new URLSearchParams(String(q || "").replace(/^\?/, ""));
  const a = p.get("arr"); if (PM_ARR.some(x => x[0] === a)) s.arr = a;
  const f = s.f, num = k => { const v = p.get(k); return v != null && v !== "" && isFinite(+v) ? +v : null; };
  if (p.get("c")) { f.hexes = p.get("c").split(",").filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => "#" + h.toUpperCase()); f.name = f.hexes.length ? nameOf(f.hexes[0]).text : ""; f.tol = num("t") || 8; f.cover = num("m") != null ? num("m") : 2; }
  f.y0 = num("y0"); f.y1 = num("y1");
  if (p.get("p")) f.painter = F.slugIx.get(p.get("p")) || 0;
  const ix = (list, v) => v ? list.findIndex(x => routeSlug(x) === routeSlug(v)) + 1 : 0;
  f.co = ix(F.meta.countries, p.get("co")); f.mv = ix(F.meta.movements, p.get("mv"));
  if (p.get("mus")) f.mus = F.G.src.findIndex(x => x.k === p.get("mus"));
  const sd = num("seed"); if (sd != null && sd >= 0 && sd < F.N) s.seed = sd;
  if (p.get("fav") === "1") s.fav = 1;
  if (s.arr === "similar" && s.seed < 0) s.arr = "color";
  return s;
}
function pmQS(s, F) {
  const f = s.f, out = [["arr", s.arr]];
  if (f.hexes.length) { out.push(["c", f.hexes.map(h => h.slice(1).toLowerCase()).join(",")], ["t", f.tol], ["m", f.cover]); }
  if (f.y0 != null) out.push(["y0", f.y0]); if (f.y1 != null) out.push(["y1", f.y1]);
  if (f.painter && F) out.push(["p", F.meta.artists[f.painter - 1][1]]);
  if (f.co && F) out.push(["co", F.meta.countries[f.co - 1]]);
  if (f.mv && F) out.push(["mv", F.meta.movements[f.mv - 1]]);
  if (f.mus >= 0 && F) out.push(["mus", F.G.src[f.mus].k]);
  if (s.arr === "similar" && s.seed >= 0) out.push(["seed", s.seed]);
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
function pmLayColor(list) {
  const G = GAL, n = list.length, cols = Math.max(1, Math.round(Math.sqrt(n / 1.55))), rows = Math.ceil(n / cols);
  const L = k => G.mean[list[k] * 3], A = k => G.mean[list[k] * 3 + 1], B = k => G.mean[list[k] * 3 + 2];
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
function pmLayTime(list) {
  const n = list.length, Wc = Math.max(3, Math.min(16, Math.round(Math.sqrt(n) / 2.2)));
  const bands = new Map();
  list.forEach(i => { const b = pmBand(i); if (!bands.has(b.key)) bands.set(b.key, { ...b, items: [] }); bands.get(b.key).items.push(i); });
  const keys = [...bands.keys()].sort((a, b) => a - b), G = GAL;
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let y = 0, m = 0, start = null, half = n / 2, seen = 0;
  keys.forEach(key => {
    const b = bands.get(key), its = b.items.sort((p, q) => G.mean[q * 3] - G.mean[p * 3]);
    labels.push({ x: -ox, y, text: b.label, n: its.length, w: Wc });
    y++;
    for (let r = 0; r * Wc < its.length; r++) {
      const row = its.slice(r * Wc, r * Wc + Wc).sort((p, q) => pmHueKey(G.mean[p * 3 + 1], G.mean[p * 3 + 2]) - pmHueKey(G.mean[q * 3 + 1], G.mean[q * 3 + 2]));
      row.forEach((i, c) => { items[m] = i; X[m] = c - ox; Y[m] = y; m++; });
      y++;
    }
    if (!start && seen + its.length >= half) start = [0, y - Math.ceil(its.length / Wc) / 2 - .5];
    seen += its.length;
    y++;   // a quiet gap row between bands
  });
  return pmGridOf(items, X, Y, labels, start ? [Math.round(start[0]), Math.round(start[1])] : [0, 1]);
}
function pmLayPainter(list, F) {
  const n = list.length, Wc = Math.max(4, Math.min(18, Math.round(Math.sqrt(n) / 1.6)));
  const groups = new Map();
  list.forEach(i => { const a = F.artist[i]; if (!groups.has(a)) groups.set(a, []); groups.get(a).push(i); });
  const med = arr => { const y = arr.map(pmYr).sort((a, b) => a - b); return y[y.length >> 1]; };
  const order = [...groups.entries()].map(([a, arr]) => ({ a, arr: arr.sort((p, q) => pmYr(p) - pmYr(q)), m: a ? med(arr) : 2e5 })).sort((p, q) => p.m - q.m || q.arr.length - p.arr.length);
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let x = 0, y = 0, shelfH = 0, m = 0;
  order.forEach(g => {
    const c = g.arr.length, bw = Math.min(Wc, Math.max(1, Math.ceil(Math.sqrt(c * 1.3)))), bh = Math.ceil(c / bw);
    if (x > 0 && x + bw > Wc) { y += shelfH + 2; x = 0; shelfH = 0; }
    labels.push({ x: x - ox, y, text: g.a ? xbArtistName(F, g.a) : "Artist unknown", n: c, w: bw });
    g.arr.forEach((i, k) => { items[m] = i; X[m] = x + k % bw - ox; Y[m] = y + 1 + Math.floor(k / bw); m++; });
    shelfH = Math.max(shelfH, bh); x += bw + 1;
  });
  const L0 = labels[0];
  return pmGridOf(items, X, Y, labels, L0 ? [Math.round(L0.x + (L0.w - 1) / 2), L0.y + 1] : [0, 1]);
}
function pmLaySimilar(list, seed) {
  const G = GAL, m = G.mean, q = seed * 3, Lb = G.lab;
  let L = Array.from(list).filter(i => i !== seed);
  const d0 = new Map();
  L.forEach(j => { const a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2], e = G.C[j] - G.C[seed]; d0.set(j, a * a + b * b + c * c + e * e); });
  L.sort((a, b) => d0.get(a) - d0.get(b));
  // the nearest 400 by the matched palette distance (each color's area times its distance to the other palette's nearest)
  const half = (a, b) => { let s = 0; for (let x = 0; x < 6; x++) { const oa = (a * 6 + x) * 3; let best = 1e9; for (let y = 0; y < 6; y++) { const ob = (b * 6 + y) * 3, d = glDE(Lb[oa], Lb[oa + 1], Lb[oa + 2], Lb[ob], Lb[ob + 1], Lb[ob + 2]); if (d < best) best = d; } s += G.sh[a * 6 + x] * best; } return s; };
  const near = L.slice(0, 400).map(j => [j, (half(seed, j) + half(j, seed)) / 2]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  L = [seed, ...near, ...L.slice(400)];
  const n = L.length, r = Math.ceil(Math.sqrt(n / Math.PI)) + 2, cells = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) cells.push([x, y, x * x + y * y, Math.atan2(y, x)]);
  cells.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  const items = Int32Array.from(L), X = new Int32Array(n), Y = new Int32Array(n);
  for (let k = 0; k < n; k++) { X[k] = cells[k][0]; Y[k] = cells[k][1]; }
  return pmGridOf(items, X, Y, [], [0, 0]);
}
function pmLayout(s, F) {
  const list = pmList(s, F), key = pmQS(s, F) + "|" + list.length + "|" + (s.fav ? (typeof fvArtList === "function" ? fvArtList().map(r => r.i).join(",") : "") : "");
  let lay = PM_LAYOUTS.get(key);
  if (!lay) {
    lay = s.arr === "time" ? pmLayTime(list) : s.arr === "painter" ? pmLayPainter(list, F) : s.arr === "similar" ? pmLaySimilar(list, s.seed) : pmLayColor(list);
    lay.key = key; lay.arr = s.arr;
    PM_LAYOUTS.set(key, lay); if (PM_LAYOUTS.size > 8) PM_LAYOUTS.delete(PM_LAYOUTS.keys().next().value);
  }
  return lay;
}

// ---------- thumbnails: load the few on screen, bake each once, recycle ----------
const PM_BAKE = 144, PM_CACHE_MAX = 650, PM_BIG_MAX = 36, PM_FLIGHT = 14;
function pmImages(onReady) {
  const cache = new Map(), bigs = new Map();   // i -> { st: 0 loading | 1 ready | 2 failed, bm, ar, used } ; i -> HTMLImageElement (kept for the big tiles)
  let flying = 0, frame = 0, dead = false;
  const bake = (i, img, crop) => {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (crop && crop[2] - crop[0] > 50 && crop[3] - crop[1] > 50) { sx = crop[0] / 1000 * nw; sy = crop[1] / 1000 * nh; sw = (crop[2] - crop[0]) / 1000 * nw; sh = (crop[3] - crop[1]) / 1000 * nh; }
    const src = { sx, sy, sw, sh }, m = Math.min(sw, sh);
    const cv = document.createElement("canvas"); cv.width = cv.height = PM_BAKE;
    cv.getContext("2d").drawImage(img, sx + (sw - m) / 2, sy + (sh - m) / 2, m, m, 0, 0, PM_BAKE, PM_BAKE);
    return { cv, src };
  };
  function want(list) {   // list: gallery indices, most wanted first; also tells which ones need the full picture
    frame++;
    for (const [i, big] of list) {
      const e = cache.get(i);
      if (e) { e.used = frame; if (big && e.st === 1 && !bigs.has(i) && e.url) pmBigLoad(i, e); continue; }
      if (flying >= PM_FLIGHT) continue;
      const t = pmThumb(i); if (!t) { cache.set(i, { st: 2, used: frame }); continue; }
      const ent = { st: 0, used: frame, url: t.url, crop: t.crop };
      const img = new Image(); img.decoding = "async"; ent.img = img;
      cache.set(i, ent); flying++;
      img.onload = () => {
        flying--; ent.img = null; if (dead) return;
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => {
          if (dead) return;
          try { const b = bake(i, img, t.crop); ent.bm = b.cv; ent.src = b.src; ent.st = 1; ent.t0 = performance.now(); if (big) { bigs.set(i, img); trimBig(); } } catch (err) { ent.st = 2; }
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
    if (e.bigLoading) return; e.bigLoading = true;
    const img = new Image(); img.decoding = "async";
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
    <div class="pmx-cap" data-pmcap hidden><button class="pmx-cap-main" data-pmopen><b data-pmct></b><small data-pmcb></small></button><button class="pmx-heart" data-pmheart aria-label="Add to your favorites"></button></div>
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
    if (centerK < 0 || !lay) { cap.hidden = true; return; }
    const i = lay.items[centerK], a = F.artist[i], y = glYear(i), by = [a ? xbArtistName(F, a) : "", y].filter(Boolean).join(" · ");
    cap.hidden = false;
    const d = glDetailNow(i);
    cap.querySelector("[data-pmct]").textContent = d ? d.t : " ";
    cap.querySelector("[data-pmcb]").textContent = by || (d && d.co) || "";
    cap.style.setProperty("--c", pmHex(i));
    paintHeart(i, d);
    if (!d) { clearTimeout(capTimer); capTimer = setTimeout(() => glDetail(i).then(() => { if (!dead && lay && lay.items[centerK] === i) caption(); }).catch(() => {}), 90); }
    PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z });
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
    if (on) toast("In your favorites", { action: "See them", onAction: () => { S.fvCat = "paintings"; save(); XSTACK.push("favs"); favShelf(); } });
  }
  // ---- drawing
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  let touched = false;
  function frame(t) {
    raf = 0; if (dead || !lay || !W) return;
    let moving = false;
    if (glide) {
      const u = Math.min(1, (t - glide.t0) / glide.dur), e = RM ? 1 : 1 - Math.pow(1 - u, 3);
      P[0] = glide.a[0] + (glide.b[0] - glide.a[0]) * e; P[1] = glide.a[1] + (glide.b[1] - glide.a[1]) * e;
      if (glide.z) Z = glide.z[0] + (glide.z[1] - glide.z[0]) * e;
      if (u >= 1) glide = null; moving = true;
    } else if (!drag && (Math.abs(V[0]) > 1e-4 || Math.abs(V[1]) > 1e-4)) {
      const dt = Math.min(40, t - (frame.t || t)); P[0] -= V[0] * dt; P[1] -= V[1] * dt;
      const k = Math.exp(-dt / 300); V[0] *= k; V[1] *= k; moving = true;
      if (Math.hypot(V[0], V[1]) < .0006) { V = [0, 0]; settle(); }
      clampPan();
    }
    frame.t = t;
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
      if (b.d >= 20) wantImg.push([i, b.d > 92 || m > .3]);
      if (e && e.st === 1 && b.d >= 7) {
        const age = t - (e.t0 || 0), a = RM ? 1 : Math.min(1, age / 260); if (a < 1) fading = true;
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
    imgs.want(wantImg.reverse().slice(0, 160));   // nearest the middle first (drawn is smallest first)
    const c = nearestK(P[0], P[1]); setCenter(c);
  }
  // ---- gestures: drag to pan (the middle follows the thumb), pinch or wheel to zoom, flick to glide, a tap opens or brings
  const pts = new Map(); let drag = null, pinch = null, press = null;
  const toPlane = (dx, dy) => [dx / (K() * M0), dy / (K() * M0)];
  function settle() {
    const k = nearestK(P[0], P[1]); if (k < 0) return;
    glideTo([lay.x[k], lay.y[k]], 260);
  }
  function glideTo(b, dur = 340, z) { glide = { a: P.slice(), b, t0: performance.now(), dur, z: z ? [Z, z] : null }; V = [0, 0]; kick(); }
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
  function tap(x, y) {
    const b = hitAt(x, y); if (!b) return;
    if (b.k === centerK && b.z < .6) return openK(b.k);
    buzz(5); glideTo([lay.x[b.k], lay.y[b.k]], 360);
  }
  function openK(k) {
    const i = lay.items[k];
    PM_PAN.set(lay.key, { x: lay.x[k], y: lay.y[k], s: Z });
    buzz(8); galleryPage(i, true, s.f.hexes[0] || null, s.f.hexes.length ? s.f.tol : null);
  }
  el.querySelector("[data-pmopen]").onclick = () => { if (centerK >= 0) openK(centerK); };
  heart.onclick = () => toggleHeart(false);

  // ---- the chrome: the title says what's showing (tap: filter), one line says what position means, the corner arranges
  function chrome() {
    const n = lay ? lay.n : 0, words = pmWords(s, F);
    el.querySelector("[data-pmt]").textContent = PM_ARR.find(a => a[0] === s.arr)[1];
    el.querySelector("[data-pmsub]").textContent = `${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}${words.length ? " · " + words.join(" · ") : ""}`;
    let why = PM_WHY[s.arr];
    el.querySelector("[data-pmwhy]").textContent = why;
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
    centerK = -1; chrome(); kick();
    if (window.PM_DEBUG) console.log("paintmap layout", s.arr, lay.n, Math.round(performance.now() - t0) + "ms");
  }
  function rebuild() {
    // the address follows (replace: a filter change is the same map, not a new page)
    try { ROUTE_NOW = "#/" + pmRouteOf(s).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
    build(false);
  }
  // ---- the corner: the arrangements as a labeled arc (Home's right-corner menu, js/home.js doMenu), plus Filter
  const doBtn = el.querySelector(".pmx-do"); doBtn._html = doBtn.innerHTML;
  doBtn.onclick = () => {
    if (STEM_OPEN) { buzz(4); return closeStem(); }
    if (document.querySelector(".sheet,.scrim")) return;
    document.querySelectorAll(".rooms-stem,.rm-scrim").forEach(n => n.remove());
    buzz(4); STEM_OPEN = true; document.body.classList.add("stem-open");
    const mid = centerK >= 0 ? lay.items[centerK] : -1, md = mid >= 0 ? glDetailNow(mid) : null;
    const rows = [
      { id: "filter", t: "Filter", n: pmWords(s, F).join(" · ") || "Country, decade, painter, color…", art: PM_ICON.filter },
      ...PM_ARR.map(([k, t]) => ({ id: k, t: k === "similar" ? "Around this one" : t, n: k === "similar" ? (md ? md.t : "The painting in the middle") : PM_WHY[k], art: PM_ICON[k], cur: s.arr === k && (k !== "similar" || s.seed === mid) })).reverse(),
    ];
    const n = rows.length;
    const scrim = document.createElement("div"); scrim.className = "rm-scrim";
    scrim.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); buzz(4); closeStem(); });
    const stem = document.createElement("div");
    stem.className = "rooms-stem hm-do-stem pmx-stem"; stem.setAttribute("role", "menu"); stem.setAttribute("aria-label", "Arrange the map");
    stem.style.setProperty("--n", n);
    stem.innerHTML = rows.map((r, k) => { const i = n - 1 - k, t = (i + 1) / n;
      return `<button class="rm-bubble${r.cur ? " cur" : ""}" role="menuitem" data-pmdo="${r.id}" style="--i:${i};--x:${(26 * t * t).toFixed(1)}px"${r.cur ? ' aria-current="true"' : ""}>
        <span class="rm-art hm-do-ic">${r.art}</span><span class="rm-label"><b>${esc(r.t)}</b><em>${esc(r.n)}</em></span></button>`; }).join("");
    document.body.append(scrim, stem);
    doBtn.classList.add("on"); doBtn.innerHTML = ICON.x; doBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); stem.classList.add("on"); }));
    STEM_KEY = e => { if (e.key === "Escape") { e.stopPropagation(); closeStem(); } };
    addEventListener("keydown", STEM_KEY, true);
    stem.querySelectorAll("[data-pmdo]").forEach(b => b.onclick = () => {
      const id = b.dataset.pmdo; buzz(8); closeStem(true);
      if (id === "filter") return pmFilterSheet(s, F, () => rebuild());
      if (id === "similar") { if (mid < 0) return; s.seed = mid; s.arr = "similar"; return rebuild(); }
      if (s.arr === id) return;
      // keep the painting you were looking at in the middle of the new arrangement
      s.arr = id; const keep = mid; rebuild();
      if (keep >= 0) { const k = lay.items.indexOf(keep); if (k >= 0) { P = [lay.x[k], lay.y[k]]; kick(); } }
    });
  };
  el.querySelector("[data-pmfilter]").onclick = () => pmFilterSheet(s, F, () => rebuild());
  // ---- life cycle
  const ro = new ResizeObserver(() => size()); ro.observe(cv);
  cleanup.push(() => { dead = true; ro.disconnect(); cancelAnimationFrame(raf); imgs.destroy(); if (lay && centerK >= 0) PM_PAN.set(lay.key, { x: lay.x[centerK], y: lay.y[centerK], s: Z }); });
  size(); build(false);
  window.PM_CTRL = { get center() { return centerK >= 0 ? lay.items[centerK] : -1; }, get count() { return lay ? lay.n : 0; }, get drawn() { return drawn.length; }, images: () => imgs.stats(), get spec() { return s; }, glideTo: k => glideTo([lay.x[k], lay.y[k]], 300), lay: () => lay, zoom: z => { Z = clamp(z, zMin(), ZMAX); kick(); } };
}

// ---------- Filter: one sheet, every chip with its count; the map follows when you close it ----------
function pmFilterSheet(s, F, onDone) {
  if (document.querySelector(".sheet")) return;
  const before = pmQS(s, F) + s.fav;
  const { sh, close: shut } = sheet(`<div class="pmx-sh"><div class="pmx-sh-top" data-sheet-grab><b>Filter</b><span data-pmn></span><button class="pmx-reset" data-pmreset>Reset</button></div><div data-pmbody></div></div>
    <button class="btn solid pmx-go" data-pmgo></button>`);
  sh.classList.add("pmx-sheet"); sh.setAttribute("aria-label", "Filter the painting map");
  if (sh.previousElementSibling) sh.previousElementSibling.classList.add("pmx-scrim");
  let open = { co: false, painter: false }, q = "";
  const close = () => { shut(); if (pmQS(s, F) + s.fav !== before) onDone(); };
  // the sheet's own close (a tap outside, a drag down) also applies what changed
  const mo = new MutationObserver(() => { if (!sh.isConnected) { mo.disconnect(); if (pmQS(s, F) + s.fav !== before && !sh._applied) { sh._applied = true; onDone(); } } });
  mo.observe(document.body, { childList: true });
  const chip = (attr, val, label, n, on) => `<button class="${on ? "on" : ""}" ${attr}="${esc(String(val))}"${!n && !on ? " disabled" : ""}>${esc(label)}${n != null ? `<em>${n.toLocaleString()}</em>` : ""}</button>`;
  function render() {
    const res = xbRun(F, s.f), C = res.counts;
    let n = res.list.length;
    const favIds = typeof fvArtList === "function" ? fvArtList() : [], favSet = new Set(favIds.map(r => r.i));
    if (s.fav) n = Array.from(res.list).filter(i => favSet.has(i)).length;
    const favN = Array.from(res.list).filter(i => favSet.has(i)).length;
    sh.querySelector("[data-pmn]").textContent = `${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}`;
    const go = sh.querySelector("[data-pmgo]"); go.textContent = n ? `Show ${n.toLocaleString()} on the map` : "Nothing matches"; go.disabled = !n;
    const f = s.f, top = (arr, k) => arr.map((name, j) => ({ name, v: j + 1, n: C[k][j + 1] })).filter(x => x.n || f[k] === x.v).sort((a, b) => b.n - a.n);
    // when: centuries, and the decades of the chosen one
    const cent = new Map(); for (let d = 0; d < XB_NDEC; d++) { const c = Math.floor((XB_DEC0 + d * 10) / 100) * 100; cent.set(c, (cent.get(c) || 0) + C.when[d]); }
    const cOn = f.y0 != null && f.y1 != null ? Math.floor(f.y0 / 100) * 100 : null, decOn = f.y0 != null && f.y1 - f.y0 === 9;
    const cents = [...cent.entries()].filter(([c, v]) => v || c === cOn).filter(([c]) => c >= 1300);
    const decs = cOn != null ? Array.from({ length: 10 }, (_, j) => cOn + j * 10).map(y => ({ y, n: C.when[(y - XB_DEC0) / 10] || 0 })) : [];
    const cols = [...BASICS, ...ALL].filter(c => !c.basic || /^(Red|Blue|Green|Yellow|Pink|Purple|Orange|Brown)$/.test(c.n));
    const colsSorted = typeof glHueOrder === "function" ? glHueOrder(cols) : cols;
    const cos = top(F.meta.countries, "co"), mvs = top(F.meta.movements, "mv"), pas = top(F.meta.artists.map(a => a[0]), "painter");
    const pList = q ? pas.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 24) : pas.slice(0, open.painter ? 40 : 10);
    sh.querySelector("[data-pmbody]").innerHTML = `
      ${favIds.length ? `<div class="pmx-row"><span class="pmx-lab">Yours</span><div class="pmx-chips">${chip("data-pmfav", 1, "Your favorites", favN, !!s.fav)}</div></div>` : ""}
      <div class="pmx-row"><span class="pmx-lab">Color</span><div class="pmx-sw">${colsSorted.map(c => `<button data-pmhex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" class="${f.hexes[0] === c.h.toUpperCase() ? "on" : ""}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
        ${f.hexes.length ? `<p class="pmx-cap2"><i style="--c:${f.hexes[0]}"></i>${esc(f.name || nameOf(f.hexes[0]).text)} <span>· within ${f.tol}% · at least ${f.cover}% of the painting</span></p>` : ""}</div>
      <div class="pmx-row"><span class="pmx-lab">When</span><div class="pmx-chips">${cents.map(([c, v]) => chip("data-pmcent", c, c + "s", v, cOn === c && !decOn)).join("")}</div>
        ${decs.length ? `<div class="pmx-chips pmx-sub">${decs.map(d => chip("data-pmdec", d.y, d.y + "s", d.n, decOn && f.y0 === d.y)).join("")}</div>` : ""}</div>
      <div class="pmx-row"><span class="pmx-lab">Country</span><div class="pmx-chips">${(open.co ? cos : cos.slice(0, 10)).map(x => chip("data-pmco", x.v, x.name, x.n, f.co === x.v)).join("")}${cos.length > 10 && !open.co ? `<button class="pmx-more" data-pmmore="co">All ${cos.length}</button>` : ""}</div></div>
      ${mvs.length ? `<div class="pmx-row"><span class="pmx-lab">Movement</span><div class="pmx-chips">${mvs.map(x => chip("data-pmmv", x.v, x.name, x.n, f.mv === x.v)).join("")}</div></div>` : ""}
      <div class="pmx-row"><span class="pmx-lab">Museum</span><div class="pmx-chips">${F.G.src.map((m, k) => chip("data-pmmus", k, m.short, C.mus[k], f.mus === k)).join("")}</div></div>
      <div class="pmx-row"><span class="pmx-lab">Painter</span>
        <label class="search pmx-find"><span>${ICON.search}</span><input data-pmq type="search" placeholder="Find a painter" value="${esc(q)}" autocomplete="off"></label>
        <div class="pmx-chips">${f.painter && !pList.some(x => x.v === f.painter) ? chip("data-pmp", f.painter, xbArtistName(F, f.painter), C.painter[f.painter], true) : ""}${pList.map(x => chip("data-pmp", x.v, x.name, x.n, f.painter === x.v)).join("")}${!q && !open.painter && pas.length > 10 ? `<button class="pmx-more" data-pmmore="painter">More painters</button>` : ""}</div></div>`;
    const inp = sh.querySelector("[data-pmq]");
    inp.oninput = () => { q = inp.value.trim(); const pos = inp.selectionStart; render(); const ni = sh.querySelector("[data-pmq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
  }
  sh.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const f = s.f, d = b.dataset;
    if (d.pmgo != null) { sh._applied = true; return close(); }
    if (d.pmreset != null) { s.f = xbFresh(); s.fav = 0; q = ""; buzz(6); return render(); }
    if (d.pmmore) { open[d.pmmore] = true; return render(); }
    if (d.pmfav) s.fav = s.fav ? 0 : 1;
    else if (d.pmhex) { const same = f.hexes[0] === d.pmhex.toUpperCase(); f.hexes = same ? [] : [d.pmhex.toUpperCase()]; f.name = same ? "" : d.name; f.tol = 8; f.cover = 5; }
    else if (d.pmcent) { const c = +d.pmcent, on = f.y0 === c && f.y1 === c + 99; f.y0 = on ? null : c; f.y1 = on ? null : c + 99; }
    else if (d.pmdec) { const y = +d.pmdec, on = f.y0 === y && f.y1 === y + 9; const c = Math.floor(y / 100) * 100; f.y0 = on ? c : y; f.y1 = on ? c + 99 : y + 9; }
    else if (d.pmco) f.co = f.co === +d.pmco ? 0 : +d.pmco;
    else if (d.pmmv) f.mv = f.mv === +d.pmmv ? 0 : +d.pmmv;
    else if (d.pmmus) f.mus = f.mus === +d.pmmus ? -1 : +d.pmmus;
    else if (d.pmp) f.painter = f.painter === +d.pmp ? 0 : +d.pmp;
    else return;
    buzz(5); render();
  });
  render();
}

// this file can load after router.js (on first use): give pmOpen its address now
if (typeof routeWrapAll === "function") routeWrapAll();
