"use strict";
// Explore 2.0: Art, browsing 23,531 paintings without getting lost (lane L16, design/lanes/L16-explore-browse.md).
// Art's old long row of ~100 color bubbles and its one endless feed are replaced by:
//  - reaching any color in two seconds: a color dial (hue ring x a lightness/chroma square, nearest name live),
//    typing a name (app colors, ~1,000 core names and their aliases, the 2,700-name library), a photo or the
//    camera, your favorites, the colors you're learning, and recent colors;
//  - facets as chips with live counts, combinable: color (how close, how much of the painting), when (a decade
//    range over a histogram), painter, movement, country, museum, mood (key, muted/vivid, warmer/cooler, contrast)
//    and palette size. Active filters are a removable breadcrumb with the count always visible; Back unwinds one
//    filter at a time; zero results offers the nearest loosening; any filter can be saved as a room;
//  - four views of the same set: Grid (sticky sections by decade, painter or closeness, a jump bar on the edge,
//    paged "Show 60 more"), River (five centuries of color you can scrub), Painters (rows with a life strip) and
//    Wall (the whole set as one mosaic sorted by hue, tap to zoom in);
//  - rooms (smart collections) as entry points, the twins across time, the unpainted colors, aesthetics as recipes.
// Data: js/gallery.js's index (GAL: year, museum, six colors a painting) plus data/facets/ (tools/facets.py: nine
// bytes a painting for painter, country, movement and the mood stats, loaded lazily on first use). A query is
// one pass over typed arrays (~2 ms); a new color costs one CIEDE2000 pass over the 141k palette colors (~15 ms),
// cached, so moving the two sliders afterwards is a threshold, not a recompute.
// L26 (paintingsFor, ptSliders) and L11 (painterPage, lifeStrip) are being built in parallel: this file calls
// them when they exist and otherwise uses the thin stand-ins below with the same shape (xbCoverage, xbSliders,
// xbStrip), so swapping in the real ones later is a one-line change each.

const XB_DIR = "data/facets/";
let XBF = null, XBF_LOADING = null;
const XB_FAMS = ["Reds", "Pinks", "Oranges", "Browns", "Yellows", "Greens", "Blues", "Purples", "Greys"];
const XB_DEC0 = 1000, XB_NDEC = 100;          // decade buckets 1000s..1990s; before 1000 folds into the first
const XB_TOLS = [1, 2, 3, 5, 8, 10, 12, 15];  // "how close": % different (ΔE00 reads directly as %, js/core.js pctDiff)
const XB_COVERS = [0, 1, 2, 5, 10, 20, 35, 50];   // "how much of the painting": % of the canvas; 0 = a single touch
const XB_PRESETS = [["exact", "Exact", { tol: 2, cover: 0, coverMax: 100 }], ["close", "Close", { tol: 5, cover: 2, coverMax: 100 }], ["family", "Family", { tol: 12, cover: 5, coverMax: 100 }],
  ["accent", "Accent", { tol: 5, cover: 0, coverMax: 10 }], ["dominant", "Dominant", { tol: 8, cover: 35, coverMax: 100 }]];

// ---------- loading ----------
function xbLoad() {
  if (XBF) return Promise.resolve(XBF);
  const get = (f, kind) => fetch(XB_DIR + f).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r[kind](); });
  return XBF_LOADING || (XBF_LOADING = Promise.all([loadGallery(), get("facets.json", "json"), get("facets.bin", "arrayBuffer")])
    .then(([G, meta, buf]) => (XBF = xbBuild(G, meta, new Uint8Array(buf))))
    .catch(e => { XBF_LOADING = null; throw e; }));
}
// a color's family by its CIELAB hue band (blue reaches ~310° in CIELAB: pure #0000FF sits at 306°)
function xbFamOf(L, C, H) {
  if (C < 7 || (C < 11 && (L < 16 || L > 90))) return 8;
  if (H >= 35 && H < 85 && L < 56 && C < 50) return 3;
  if (H >= 345 || H < 50) return L >= 66 || (L >= 56 && C < 34) ? 1 : 0;
  if (H < 75) return 2;
  if (H < 108) return 4;
  if (H < 200) return 5;
  if (H < 312) return 6;
  return L >= 68 && C < 55 ? 1 : 7;
}
function xbBuild(G, meta, b) {
  const N = G.n, R = meta.rec;
  if (meta.n !== N || b.length < N * R) throw new Error("facets out of step with the gallery");
  const artist = new Uint16Array(N), country = new Uint8Array(N), mv = new Uint8Array(N), key = new Uint8Array(N), Cm = new Uint8Array(N), wf = new Uint8Array(N), ct = new Uint8Array(N), ef = new Uint8Array(N);
  const fam = new Uint8Array(N * 6), dom = new Uint8Array(N), dec = new Int16Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * R;
    artist[i] = b[o] | b[o + 1] << 8; country[i] = b[o + 2]; mv[i] = b[o + 3]; key[i] = b[o + 4]; Cm[i] = b[o + 5]; wf[i] = b[o + 6]; ct[i] = b[o + 7]; ef[i] = b[o + 8];
    let best = 0;
    for (let j = 0; j < 6; j++) { const k = i * 6 + j; fam[k] = xbFamOf(G.lab[k * 3], G.ch[k], G.hu[k]); if (G.sh[k] > G.sh[i * 6 + best]) best = j; }
    dom[i] = best;
    const y = G.year[i];
    dec[i] = y === GL_UNDATED ? -1 : clamp(Math.floor((y - XB_DEC0) / 10), 0, XB_NDEC - 1);
  }
  const slugIx = new Map();
  meta.artists.forEach((a, k) => slugIx.set(a[1], k + 1));
  const cut = meta.cuts;
  const band = (v, c) => v < c[0] ? 0 : v >= c[1] ? 2 : 1;
  const chB = new Uint8Array(N), tB = new Uint8Array(N), cB = new Uint8Array(N), sB = new Uint8Array(N);
  for (let i = 0; i < N; i++) { chB[i] = band(Cm[i], cut.Cm); tB[i] = band(wf[i], cut.wf); cB[i] = band(ct[i], cut.ct); sB[i] = band(ef[i], cut.ef); }
  return { G, meta, N, artist, country, mv, key, Cm, wf, ct, ef, fam, dom, dec, chB, tB, cB, sB, slugIx, twins: meta.twins || [], unpainted: meta.unpainted || [] };
}

// ---------- the query: one filter state, one pass ----------
// f: { hexes: [..] (one color, or a set: "colors you're learning"), name, tol, cover, coverMax, y0, y1, painter,
//      mv, co, mus, key, chroma, temp, contrast, size }. -1 / "" / null = off. Bands are 0 low · 1 middle · 2 high.
const xbFresh = () => ({ hexes: [], name: "", tol: 5, cover: 2, coverMax: 100, y0: null, y1: null, painter: 0, mv: 0, co: 0, mus: -1, key: -1, chroma: -1, temp: -1, contrast: -1, size: -1 });
const XB_DIMS = ["color", "when", "painter", "mv", "co", "mus", "key", "chroma", "temp", "contrast", "size"];
// per palette color: its smallest CIEDE2000 to any of the hexes. Cached on the hex list.
let XB_DE = null;
function xbDE(F, hexes) {
  const k = hexes.join(",");
  if (XB_DE && XB_DE.k === k && XB_DE.N === F.N) return XB_DE.de;
  const G = F.G, M = F.N * 6, de = new Float32Array(M).fill(1e3), Lb = G.lab;
  hexes.forEach(h => {
    const [tL, ta, tb] = lab(h);
    for (let m = 0; m < M; m++) {
      const o = m * 3, dL = Lb[o] - tL;
      if (dL > 28 || dL < -28) continue;   // ΔE00 >= |ΔL|/1.75, so nothing past 16% can come from here
      const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]);
      if (d < de[m]) de[m] = d;
    }
  });
  XB_DE = { k, N: F.N, de };
  return de;
}
// coverage (share of the canvas within tol) and the closest color's distance, per painting. The L26 stand-in:
// six measured colors a painting. When L26's paintingsFor() lands with its finer histogram, it replaces this.
function xbCoverage(F, f) {
  const N = F.N, cov = new Float32Array(N), near = new Float32Array(N).fill(1e3);
  if (!f.hexes.length) return { cov, near };
  const de = xbDE(F, f.hexes), sh = F.G.sh, tol = f.tol;
  for (let i = 0; i < N; i++) {
    let c = 0, n = 1e3;
    for (let j = 0; j < 6; j++) { const k = i * 6 + j, d = de[k]; if (d < n) n = d; if (d <= tol) c += sh[k]; }
    cov[i] = c; near[i] = n;
  }
  return { cov, near };
}
function xbRun(F, f, o = {}) {
  const G = F.G, N = F.N;
  const col = f.hexes.length ? (o.cov || xbCoverage(F, f)) : null;
  const lo = f.cover / 100, hi = f.coverMax / 100 + 1e-6;
  const when = f.y0 != null || f.y1 != null, y0 = f.y0 == null ? -1e5 : f.y0, y1 = f.y1 == null ? 1e5 : f.y1;
  const counts = { when: new Int32Array(XB_NDEC + 1), painter: new Int32Array(F.meta.artists.length + 1), mv: new Int32Array(F.meta.movements.length + 1), co: new Int32Array(F.meta.countries.length + 1),
    mus: new Int32Array(G.src.length), key: new Int32Array(3), chroma: new Int32Array(3), temp: new Int32Array(3), contrast: new Int32Array(3), size: new Int32Array(3), color: 0 };
  const out = new Int32Array(N); let n = 0;
  for (let i = 0; i < N; i++) {
    let fail = 0;
    if (col) { const c = col.cov[i]; if (!(c > 0 && c >= lo && c <= hi)) fail |= 1; }
    if (when) { const y = G.year[i]; if (y === GL_UNDATED || y < y0 || y > y1) fail |= 2; }
    if (f.painter && F.artist[i] !== f.painter) fail |= 4;
    if (f.mv && F.mv[i] !== f.mv) fail |= 8;
    if (f.co && F.country[i] !== f.co) fail |= 16;
    if (f.mus >= 0 && G.mus[i] !== f.mus) fail |= 32;
    if (f.key >= 0 && F.key[i] !== f.key) fail |= 64;
    if (f.chroma >= 0 && F.chB[i] !== f.chroma) fail |= 128;
    if (f.temp >= 0 && F.tB[i] !== f.temp) fail |= 256;
    if (f.contrast >= 0 && F.cB[i] !== f.contrast) fail |= 512;
    if (f.size >= 0 && F.sB[i] !== f.size) fail |= 1024;
    if (fail === 0) out[n++] = i;
    else if (fail & (fail - 1)) continue;   // fails two or more: counts toward nothing
    // a facet's counts: the paintings that pass every OTHER filter, by this facet's value
    if (!(fail & ~1)) counts.color++;
    if (!(fail & ~2)) { const d = F.dec[i]; counts.when[d < 0 ? XB_NDEC : d]++; }
    if (!(fail & ~4)) counts.painter[F.artist[i]]++;
    if (!(fail & ~8)) counts.mv[F.mv[i]]++;
    if (!(fail & ~16)) counts.co[F.country[i]]++;
    if (!(fail & ~32)) counts.mus[G.mus[i]]++;
    if (!(fail & ~64)) counts.key[F.key[i]]++;
    if (!(fail & ~128)) counts.chroma[F.chB[i]]++;
    if (!(fail & ~256)) counts.temp[F.tB[i]]++;
    if (!(fail & ~512)) counts.contrast[F.cB[i]]++;
    if (!(fail & ~1024)) counts.size[F.sB[i]]++;
  }
  return { list: out.slice(0, n), counts, col };
}

// ---------- sorting and sections ----------
// every sort groups into sections: decades (date), painters A-Z (painter), coverage bands (most), closeness
// bands (closest), or one shuffled run. Each section: { key, label, short (jump bar), items }.
const XB_COV_BANDS = [[.5, "Over half the canvas", "½+"], [.25, "A quarter to a half", "¼"], [.1, "A tenth to a quarter", "10%"], [.05, "5 to 10% of it", "5%"], [0, "Under 5%", "<5"]];
const XB_NEAR_BANDS = [[1, "Exact, under 1% different", "1%"], [3, "Within 3%", "3%"], [5, "Within 5%", "5%"], [10, "Within 10%", "10%"], [1e9, "Within 15%", "15%"]];
const xbArtistName = (F, a) => a ? F.meta.artists[a - 1][0] : "";
function xbSort(F, res, sort, seed = 0) {
  const G = F.G, list = Array.from(res.list), col = res.col;
  const yr = i => G.year[i] === GL_UNDATED ? 1e5 : G.year[i];
  if (sort === "most" && col) list.sort((a, b) => col.cov[b] - col.cov[a] || col.near[a] - col.near[b]);
  else if (sort === "closest" && col) list.sort((a, b) => col.near[a] - col.near[b] || col.cov[b] - col.cov[a]);
  else if (sort === "painter") list.sort((a, b) => (F.artist[a] || 1e6) - (F.artist[b] || 1e6) || yr(a) - yr(b));
  else if (sort === "shuffle") { let s = (seed | 0) || 1; const key = new Float32Array(G.n); list.forEach(i => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; key[i] = (s >>> 0) / 4294967296; }); list.sort((a, b) => key[a] - key[b]); }
  else list.sort((a, b) => yr(a) - yr(b) || a - b);
  return list;
}
function xbSections(F, res, sort, seed) {
  const G = F.G, list = xbSort(F, res, sort, seed), secs = [], col = res.col;
  const push = (key, label, short, i) => { let s = secs[secs.length - 1]; if (!s || s.key !== key) { s = { key, label, short, items: [] }; secs.push(s); } s.items.push(i); };
  if (sort === "shuffle") { if (list.length) secs.push({ key: "all", label: "Shuffled", short: "", items: list }); return secs; }
  // painters: one section each, or one per letter when there are too many painters to scroll past
  const byLetter = sort === "painter" && new Set(list.map(i => F.artist[i])).size > 300;
  list.forEach(i => {
    if (sort === "most" && col) { const b = XB_COV_BANDS.findIndex(x => col.cov[i] >= x[0]); push("c" + b, XB_COV_BANDS[b][1], XB_COV_BANDS[b][2], i); }
    else if (sort === "closest" && col) { const b = XB_NEAR_BANDS.findIndex(x => col.near[i] < x[0]); push("n" + b, XB_NEAR_BANDS[b][1], XB_NEAR_BANDS[b][2], i); }
    else if (sort === "painter") {
      const a = F.artist[i], L = a ? xbLetter(xbArtistName(F, a)) : "?";
      if (byLetter) push("l" + L, a ? L : "Artist unknown", L, i);
      else push("a" + a, a ? xbArtistName(F, a) : "Artist unknown", L, i);
    }
    else {   // decades; the thin early centuries (a few hundred works before 1200) share one section
      const y = G.year[i];
      if (y === GL_UNDATED) push("u", "Undated", "?", i);
      else if (y < 1200) push("e", "Before 1200", "<1200", i);
      else { const d = Math.floor(y / 10) * 10; push("d" + d, d + "s", String(Math.floor(y / 100) * 100), i); }
    }
  });
  return secs;
}
// the first letter a painter files under (accents folded: "Édouard" under E)
const xbLetter = s => { const c = String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
// the jump bar: one target per distinct short label, in section order (A-Z for painters, centuries for dates)
function xbJumpTargets(secs) {
  const out = [];
  secs.forEach((s, k) => { if (s.short && (!out.length || out[out.length - 1].label !== s.short)) out.push({ label: s.short, sec: k }); });
  return out;
}

// ---------- what a filter is, in words ----------
const XB_KEY = ["Dark key", "Mid key", "Light key"], XB_CHROMA = ["Muted", "Middling color", "Vivid"], XB_TEMP = ["Cooler", "Middling warmth", "Warmer"], XB_CONTRAST = ["Soft contrast", "Middling contrast", "Strong contrast"], XB_SIZE = ["Minimal palette", "Balanced palette", "Rich palette"];
const xbYears = f => f.y0 != null && f.y1 != null ? (f.y1 - f.y0 === 9 && f.y0 % 10 === 0 ? `${f.y0}s` : f.y1 - f.y0 === 99 && f.y0 % 100 === 0 ? `${f.y0}s` : `${f.y0}–${f.y1}`) : f.y0 != null ? `From ${f.y0}` : f.y1 != null ? `Before ${f.y1 + 1}` : "";
function xbChips(F, f) {
  const out = [];
  if (f.hexes.length) out.push({ dim: "color", text: f.name || nameOf(f.hexes[0]).text, sw: f.hexes, sub: `within ${f.tol}%${f.cover ? `, ${f.cover}%+ of it` : ""}${f.coverMax < 100 ? `, under ${f.coverMax}%` : ""}` });
  if (f.y0 != null || f.y1 != null) out.push({ dim: "when", text: xbYears(f) });
  if (f.painter) out.push({ dim: "painter", text: xbArtistName(F, f.painter) });
  if (f.mv) out.push({ dim: "mv", text: F.meta.movements[f.mv - 1] });
  if (f.co) out.push({ dim: "co", text: F.meta.countries[f.co - 1] });
  if (f.mus >= 0) out.push({ dim: "mus", text: F.G.src[f.mus].short });
  if (f.key >= 0) out.push({ dim: "key", text: XB_KEY[f.key] });
  if (f.chroma >= 0) out.push({ dim: "chroma", text: XB_CHROMA[f.chroma] });
  if (f.temp >= 0) out.push({ dim: "temp", text: XB_TEMP[f.temp] });
  if (f.contrast >= 0) out.push({ dim: "contrast", text: XB_CONTRAST[f.contrast] });
  if (f.size >= 0) out.push({ dim: "size", text: XB_SIZE[f.size] });
  return out;
}
// clear one dimension
function xbWithout(f, dim) {
  const g = { ...f, hexes: f.hexes.slice() }, z = xbFresh();
  if (dim === "color") Object.assign(g, { hexes: [], name: "", tol: z.tol, cover: z.cover, coverMax: z.coverMax });
  else if (dim === "when") Object.assign(g, { y0: null, y1: null });
  else g[dim] = z[dim];
  return g;
}
// zero results: the single change that brings back the most paintings, removing one filter or widening the color
function xbLoosen(F, f) {
  const tries = [];
  xbChips(F, f).forEach(c => tries.push({ label: `Without ${c.dim === "color" ? c.text.toLowerCase() : c.text}`, f: xbWithout(f, c.dim) }));
  if (f.hexes.length && f.tol < 15) tries.push({ label: `Widen to ${Math.min(15, f.tol * 2)}% different`, f: { ...f, tol: Math.min(15, f.tol * 2) } });
  if (f.hexes.length && f.cover > 0) tries.push({ label: "Any amount of the color", f: { ...f, cover: 0 } });
  if (f.y0 != null && f.y1 != null) tries.push({ label: `Widen to ${Math.max(0, f.y0 - 50)}–${f.y1 + 50}`, f: { ...f, y0: Math.max(0, f.y0 - 50), y1: f.y1 + 50 } });
  return tries.map(t => ({ ...t, n: xbRun(F, t.f).list.length })).filter(t => t.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
}
// the colors of a whole result set: palette colors pooled into coarse Lab cells, each cell's share-weighted mean,
// biggest first, then de-duplicated so two near-identical browns don't both make the strip
function xbSetColors(F, list, k = 8, against = null) {
  const G = F.G, cells = new Map();
  const add = (map, i, w) => { for (let j = 0; j < 6; j++) { const m = i * 6 + j, o = m * 3, s = G.sh[m] * w; const key = (Math.round(G.lab[o] / 9) * 64 + Math.round(G.lab[o + 1] / 12) + 32) * 64 + Math.round(G.lab[o + 2] / 12) + 32; let c = map.get(key); if (!c) map.set(key, c = [0, 0, 0, 0]); c[0] += s; c[1] += G.rgb[m * 3] * s; c[2] += G.rgb[m * 3 + 1] * s; c[3] += G.rgb[m * 3 + 2] * s; } };
  const step = Math.max(1, Math.floor(list.length / 4000));   // a sample past 4,000 is plenty for a strip
  let tot = 0;
  for (let q = 0; q < list.length; q += step) { add(cells, list[q], 1); tot++; }
  let rows = [...cells.entries()].map(([key, c]) => ({ key, share: c[0] / Math.max(1, tot), h: "#" + [c[1], c[2], c[3]].map(v => clamp(Math.round(v / c[0]), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase() }));
  if (against) {   // distinctive: lift against a baseline set's cells (the River's "this decade's colors")
    rows = rows.filter(r => r.share > .004).map(r => ({ ...r, lift: r.share / Math.max(.0005, (against.get(r.key) || 0)) })).filter(r => r.lift > 1.25).sort((a, b) => b.lift * Math.sqrt(b.share) - a.lift * Math.sqrt(a.share));
  } else rows.sort((a, b) => b.share - a.share);
  const out = [];
  for (const r of rows) { if (out.length >= k) break; if (out.every(x => de2000(x.h, r.h) > 7)) out.push(r); }
  return out;
}
function xbCellShares(F, list) {
  const G = F.G, cells = new Map(), step = Math.max(1, Math.floor(list.length / 6000));
  let tot = 0;
  for (let q = 0; q < list.length; q += step) { const i = list[q]; tot++; for (let j = 0; j < 6; j++) { const m = i * 6 + j, o = m * 3; const key = (Math.round(G.lab[o] / 9) * 64 + Math.round(G.lab[o + 1] / 12) + 32) * 64 + Math.round(G.lab[o + 2] / 12) + 32; cells.set(key, (cells.get(key) || 0) + G.sh[m]); } }
  cells.forEach((v, k) => cells.set(k, v / Math.max(1, tot)));
  return cells;
}
