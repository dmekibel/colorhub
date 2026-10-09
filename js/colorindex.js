"use strict";
// The finer color index (lane L26, tools/color_index.py): where a color lives in paintings, down to the pixel,
// for ANY color, any pair, any set. Data in data/colorindex/ (and any second corpus with the same format, e.g.
// data/design/): an inverted index, color cell -> the items that hold it, in shards that are read only near the
// color asked about. Read tools/color_index.py's docstring for the format and the rule below.
//
//   paintingsFor(hex, { tol, minCover, sort, source })           -> Promise<result>
//   paintingsWith([hex, ...], { tol, minCover, mode, sort, source }) -> Promise<result>
//        tol         "% different" (CIEDE2000, js/core.js pctDiff), 0 to 15. 0 = the color's own cell (~1.5% across).
//        minCover    % of the picture, 0.05 (a speck: ~25 px of the 200 px photo) to 50.  maxCover (optional): an upper
//                    bound, for "just an accent".
//        mode        "all" every color present (each within tol, each covering minCover) · "any" at least one ·
//                    "palette" the closest overall match, scored 0-1 (geometric mean of how well each color is met)
//        sort        "cover" (default) · "close" · "date"
//        source      "paintings" (default) · "design" · "both"; a source whose index isn't published is skipped
//   result = { count, n, per:[count per color], expected, lift, rows:[{ src, i, cover, covers, de, score? }], sources }
//        cover, covers, de are percents of the picture / "% different" of the closest cell that counted.
//   ciSetStats(result, hexes, o)  -> how it compares with chance, peak decades / painters / countries, earliest, a finding
//   ciAffinity(name)               -> { n, c: closest companions, a: colors it avoids } from the affinity table
// All math is on plain numbers so tools/color_index_test.js runs this file in Node unchanged.

const CI_DEFAULT = { tol: 3, minCover: 5, mode: "all", sort: "cover", source: "paintings" };
const CI_SOURCES = {
  paintings: { key: "paintings", dir: "data/colorindex/", label: "Paintings", item: "painting" },
  design: { key: "design", dir: "data/design/colorindex/", label: "Design", item: "design piece" },   // beside, not inside, the design corpus lane L19 writes to data/design/
  photography: { key: "photography", dir: "data/photography/colorindex/", label: "Photography", item: "photograph" },   // Phase 2: js/photography.js
};
const CI_BASE = "";
const CI_MAX_SOFT = 16;
let CI_LEAVES = new Map(), CI_OPEN = new Map(), CI_META = new Map(), CI_COV = new Map(), CI_AFF = new Map();

// ---------- color math on plain numbers ----------
const CI_RAD = Math.PI / 180, CI_P7 = 6103515625;
function ciLab(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const lin = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  const r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), b = lin(n & 255);
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((r * .4124 + g * .3576 + b * .1805) / .95047), y = f(r * .2126 + g * .7152 + b * .0722), z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000 (the same formula as de2000() in js/core.js and glDE() in js/gallery.js)
function ciDE(L1, a1, b1, L2, a2, b2) {
  const Cb = (Math.sqrt(a1 * a1 + b1 * b1) + Math.sqrt(a2 * a2 + b2 * b2)) / 2, c2 = Cb * Cb, c7 = c2 * c2 * c2 * Cb, G = .5 * (1 - Math.sqrt(c7 / (c7 + CI_P7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
  let h1p = b1 || a1p ? Math.atan2(b1, a1p) / CI_RAD : 0; if (h1p < 0) h1p += 360;
  let h2p = b2 || a2p ? Math.atan2(b2, a2p) / CI_RAD : 0; if (h2p < 0) h2p += 360;
  const dL = L2 - L1, dC = C2p - C1p, pr = C1p * C2p;
  let dh = 0; if (pr) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(pr) * Math.sin(dh * CI_RAD / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p; if (pr) { if (Math.abs(h1p - h2p) > 180) hb += hb < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * CI_RAD) + .24 * Math.cos(2 * hb * CI_RAD) + .32 * Math.cos((3 * hb + 6) * CI_RAD) - .2 * Math.cos((4 * hb - 63) * CI_RAD);
  const p2 = Cbp * Cbp, p7 = p2 * p2 * p2 * Cbp, Rc = 2 * Math.sqrt(p7 / (p7 + CI_P7)), e = (hb - 275) / 25, l5 = (Lb - 50) * (Lb - 50);
  const Sl = 1 + .015 * l5 / Math.sqrt(20 + l5), Sc = 1 + .045 * Cbp, Sh = 1 + .015 * Cbp * T, Rt = -Math.sin(60 * Math.exp(-e * e) * CI_RAD) * Rc;
  const x = dL / Sl, y = dC / Sc, z = dH / Sh;
  return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
}

// ---------- loading ----------
const ciGet = (url, kind) => fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r[kind](); });
// open one source: its index.json. Rejects when the source isn't published, so a switch can hide it.
function ciOpen(key = "paintings") {
  const def = CI_SOURCES[key];
  if (!def) return Promise.reject(new Error("no source " + key));
  if (!CI_OPEN.has(key)) {
    CI_OPEN.set(key, ciGet(CI_BASE + def.dir + "index.json", "json").then(head => {
      def.head = head; def.n = head.n; def.coarse = new Set(head.coarse || []);
      if (head.label) def.label = head.label;
      if (head.item) def.item = head.item;
      // a palette-only corpus ships its tiles' text with the index (items.json: [id, title, maker, year, category, [hexes]])
      return head.items ? ciGet(CI_BASE + def.dir + head.items, "json").then(items => { def.items = items; return def; }) : def;
    }).catch(e => { CI_OPEN.delete(key); throw e; }));
  }
  return CI_OPEN.get(key);
}
// the sources that exist, in order (the source switch shows one button for each)
function ciAvailable() {
  return Promise.all(Object.keys(CI_SOURCES).map(k => ciOpen(k).then(() => k, () => null))).then(a => a.filter(Boolean));
}
// year, artist, movement, country for each item (loaded when a date sort or a statistic needs it)
function ciMeta(src) {
  if (!CI_META.has(src.key)) {
    CI_META.set(src.key, Promise.all([ciGet(CI_BASE + src.dir + src.head.meta, "arrayBuffer"), ciGet(CI_BASE + src.dir + "meta.json", "json")]).then(([buf, lists]) => {
      const n = src.n, dv = new DataView(buf), year = new Int16Array(n), artist = new Uint16Array(n), mv = new Uint8Array(n), co = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const o = i * 6, y = dv.getUint16(o, true);
        year[i] = y ? y - 20000 : -32768; artist[i] = dv.getUint16(o + 2, true); mv[i] = dv.getUint8(o + 4); co[i] = dv.getUint8(o + 5);
      }
      return (src.meta = { year, artist, mv, co, lists });
    }).catch(e => { CI_META.delete(src.key); throw e; }));
  }
  return CI_META.get(src.key);
}
// coverage byte -> share of the picture (see tools/color_index.py)
const ciCovTable = head => Float32Array.from({ length: 256 }, (_, b) => b ? head.cov0 * (head.covMax / head.cov0) ** ((b - 1) / 254) : 0);
function ciDecode(buf, src) {
  const u = new Uint8Array(buf), nc = u[0] | u[1] << 8, T = src.covTable || (src.covTable = ciCovTable(src.head)), Q = src.head.Q, off = src.head.off;
  let p = 2;
  const lab = new Float32Array(nc * 3), cnt = new Uint32Array(nc), cell = new Uint8Array(nc * 3);
  let total = 0;
  for (let c = 0; c < nc; c++) {
    const L = u[p], a = u[p + 1], b = u[p + 2]; p += 3;
    cell[c * 3] = L; cell[c * 3 + 1] = a; cell[c * 3 + 2] = b;
    lab[c * 3] = L * Q + Q / 2; lab[c * 3 + 1] = (a - off) * Q + Q / 2; lab[c * 3 + 2] = (b - off) * Q + Q / 2;
    let v = 0, sh = 0, x;
    do { x = u[p++]; v |= (x & 127) << sh; sh += 7; } while (x & 128);
    cnt[c] = v; total += v;
  }
  const ids = new Uint32Array(total), cov = new Float32Array(total), start = new Uint32Array(nc + 1);
  let k = 0;
  for (let c = 0; c < nc; c++) {
    start[c] = k;
    let id = 0;
    for (let j = 0; j < cnt[c]; j++) {
      let v = 0, sh = 0, x;
      do { x = u[p++]; v |= (x & 127) << sh; sh += 7; } while (x & 128);
      id += v; ids[k + j] = id;
    }
    for (let j = 0; j < cnt[c]; j++) cov[k + j] = T[u[p++]];
    k += cnt[c];
  }
  start[nc] = k;
  return { nc, lab, cell, ids, cov, start };
}
function ciLeaf(src, li) {
  const key = src.key + ":" + li;
  if (!CI_LEAVES.has(key)) {
    CI_LEAVES.set(key, ciGet(CI_BASE + src.dir + src.head.leaves[li].f, "arrayBuffer").then(b => ciDecode(b, src)).catch(e => { CI_LEAVES.delete(key); throw e; }));
  }
  return CI_LEAVES.get(key);
}
// which shards can hold a cell within tol of the color: the nearest point of each shard's box to the color
// (clamped), in CIEDE2000, with a margin for the cell's own width. tools/color_index_test.js checks this against
// a scan of everything.
function ciNeedLeaves(src, lab, tol) {
  const { Q, off, leaves } = src.head, out = [], slack = 1 + .15 * tol;
  for (let li = 0; li < leaves.length; li++) {
    const l = leaves[li], lo0 = l.lo[0] * Q, hi0 = (l.hi[0] + 1) * Q, lo1 = (l.lo[1] - off) * Q, hi1 = (l.hi[1] - off + 1) * Q, lo2 = (l.lo[2] - off) * Q, hi2 = (l.hi[2] - off + 1) * Q;
    const L = Math.min(Math.max(lab[0], lo0), hi0), a = Math.min(Math.max(lab[1], lo1), hi1), b = Math.min(Math.max(lab[2], lo2), hi2);
    if (ciDE(lab[0], lab[1], lab[2], L, a, b) <= tol + slack) out.push(li);
  }
  return out;
}
const ciCellOf = (src, lab) => {
  const { Q, off } = src.head;
  return [Math.min(Math.max(Math.floor(lab[0] / Q), 0), 34), Math.min(Math.max(Math.floor(lab[1] / Q) + off, 0), 127), Math.min(Math.max(Math.floor(lab[2] / Q) + off, 0), 127)];
};

// ---------- one color's coverage of every item ----------
// { cov: Float32Array (share of the picture, 0-1), de: Float32Array (the closest cell that counted, ΔE00; Infinity if none) }
// soft: instead of "within tol", weigh each cell by its closeness, 1 - d/R, over radius R = tol (the palette mode).
function ciCoverage(src, hex, tol, soft = false) {
  const key = [src.key, hex.toUpperCase(), tol, soft ? 1 : 0].join("|");
  if (CI_COV.has(key)) return CI_COV.get(key);
  const lab = ciLab(hex), own = ciCellOf(src, lab), need = ciNeedLeaves(src, lab, tol);
  const p = Promise.all(need.map(li => ciLeaf(src, li))).then(leaves => {
    const cov = new Float32Array(src.n), de = new Float32Array(src.n).fill(Infinity), dlim = tol * 1.8 + 2;
    for (const lf of leaves) {
      for (let c = 0; c < lf.nc; c++) {
        const o = c * 3, isOwn = !soft && lf.cell[o] === own[0] && lf.cell[o + 1] === own[1] && lf.cell[o + 2] === own[2];
        if (!isOwn && Math.abs(lf.lab[o] - lab[0]) > dlim) continue;   // ΔE00 is at least |ΔL| / 1.75
        const d = ciDE(lab[0], lab[1], lab[2], lf.lab[o], lf.lab[o + 1], lf.lab[o + 2]);
        if (!isOwn && d > tol) continue;
        const w = soft ? 1 - d / tol : 1;
        for (let k = lf.start[c]; k < lf.start[c + 1]; k++) { const id = lf.ids[k]; cov[id] += lf.cov[k] * w; if (d < de[id]) de[id] = d; }
      }
    }
    return { cov, de };
  });
  CI_COV.set(key, p);
  if (CI_COV.size > 24) CI_COV.delete(CI_COV.keys().next().value);
  p.catch(() => CI_COV.delete(key));
  return p;
}

// ---------- the query ----------
const ciTolR = tol => Math.min(CI_MAX_SOFT, Math.max(6, tol * 2.5));
async function ciOne(key, hexes, o) {
  const src = await ciOpen(key), n = src.n, m = Math.max(o.minCover, .05) / 100 - 1e-9, hiM = o.maxCover ? o.maxCover / 100 + 1e-9 : Infinity, k = hexes.length;
  const hard = await Promise.all(hexes.map(h => ciCoverage(src, h, o.tol)));
  const per = hard.map(c => { let q = 0; for (let i = 0; i < n; i++) if (c.cov[i] >= m) q++; return q; });
  const rows = [];
  if (o.mode === "palette") {
    const R = ciTolR(o.tol), soft = await Promise.all(hexes.map(h => ciCoverage(src, h, R, true))), target = Math.max(m, .01);
    for (let i = 0; i < n; i++) {
      let g = 1, any = 0, de = 0;
      for (let j = 0; j < k && g > 0; j++) { const s = Math.min(1, soft[j].cov[i] / target); g *= s; de += soft[j].de[i]; any += hard[j].cov[i]; }
      if (g <= 0) continue;
      const score = Math.pow(g, 1 / k);
      rows.push({ src: key, i, cover: any / k * 100, covers: hard.map(c => c.cov[i] * 100), de: de / k, score });
    }
    const good = rows.filter(r => r.score >= .5);
    return { src, n, per, rows, count: good.length };
  }
  // "atleast": holds at least `need` of the k colors (a bigger palette, David 2026-10-09 — "Holds at least N of M
  // colors"), each of the `need` best-covered ones clearing the threshold. need===k is the same test as "all";
  // need===1 is the same test as "any" (both kept as their own branches below since they're the common case).
  if (o.mode === "atleast") {
    const need = Math.max(1, Math.min(k, o.atLeast || k));
    for (let i = 0; i < n; i++) {
      const covs = hard.map(c => c.cov[i]), order = covs.map((_, j) => j).sort((a, b) => covs[b] - covs[a]);
      const worst = covs[order[need - 1]];
      if (worst < m || worst > hiM) continue;
      let de = 0; for (let t = 0; t < need; t++) { const j = order[t]; if (hard[j].de[i] > de && isFinite(hard[j].de[i])) de = hard[j].de[i]; }
      rows.push({ src: key, i, cover: worst * 100, covers: covs.map(c => c * 100), de });
    }
    return { src, n, per, rows, count: rows.length };
  }
  for (let i = 0; i < n; i++) {
    let lo = Infinity, hi = 0, de = 0;
    for (let j = 0; j < k; j++) { const c = hard[j].cov[i]; if (c < lo) lo = c; if (c > hi) hi = c; if (hard[j].de[i] > de && isFinite(hard[j].de[i])) de = hard[j].de[i]; }
    const cover = o.mode === "any" ? hi : lo;
    if (cover < m || cover > hiM) continue;
    rows.push({ src: key, i, cover: cover * 100, covers: hard.map(c => c.cov[i] * 100), de });
  }
  return { src, n, per, rows, count: rows.length };
}
async function paintingsWith(hexes, opts = {}) {
  const o = { ...CI_DEFAULT, ...opts };
  hexes = (hexes || []).map(h => "#" + String(h).replace("#", "").toUpperCase()).filter(h => /^#[0-9A-F]{6}$/.test(h)).slice(0, 5);
  if (!hexes.length) return { count: 0, n: 0, per: [], expected: 0, lift: null, rows: [], sources: [], o };
  const keys = o.source === "both" ? await ciAvailable() : [o.source];
  const parts = await Promise.all(keys.map(k => ciOne(k, hexes, o)));
  let rows = parts.flatMap(p => p.rows);
  const N = parts.reduce((a, p) => a + p.n, 0), per = hexes.map((_, j) => parts.reduce((a, p) => a + p.per[j], 0));
  const count = parts.reduce((a, p) => a + p.count, 0);
  let expected = N, any = false;
  per.forEach(q => { expected *= q / (N || 1); });
  const lift = hexes.length > 1 && expected > 0 && o.mode === "all" ? count / expected : null;
  if (o.sort === "date") {
    const metas = {};
    await Promise.all(parts.map(p => ciMeta(p.src).then(m => { metas[p.src.key] = m; })));
    const yr = r => { const y = metas[r.src].year[r.i]; return y === -32768 ? 1e9 : y; };
    rows.sort((a, b) => yr(a) - yr(b) || b.cover - a.cover);
  } else if (o.mode === "palette") rows.sort((a, b) => b.score - a.score || b.cover - a.cover);
  else if (o.sort === "close") rows.sort((a, b) => a.de - b.de || b.cover - a.cover);
  else rows.sort((a, b) => b.cover - a.cover || a.de - b.de);
  return { count, n: N, per, expected, lift, rows, sources: parts.map(p => p.src), o, hexes };
}
// ---------- never empty: every picture ranked by how much of the color it holds ----------
// A painting's representation of a color = sum over its pool colors of share x max(0, 1 - dE/R) (the soft coverage
// the palette mode already uses). R is 16, and widens to 40 then 100 for a color no painting comes near, so the
// ranking always exists. ciClosest(hexes, res, o) returns the pictures that did NOT pass the sliders, best first,
// each with its honest numbers: the nearest patch (% different) and the share of the canvas within `tc`%.
const CI_WANT = 12, CI_RADII = [16, 40, 100];
const ciHexes = hs => (hs || []).map(h => "#" + String(h).replace("#", "").toUpperCase()).filter(h => /^#[0-9A-F]{6}$/.test(h)).slice(0, 5);
async function ciClosest(hexes, res, o = {}) {
  hexes = ciHexes(hexes);
  const opts = { ...CI_DEFAULT, ...(res && res.o || {}), ...o }, key = opts.source === "design" ? "design" : "paintings";
  if (!hexes.length) return { rows: [], tc: 0, R: 0, key };
  const src = await ciOpen(key), n = src.n, k = hexes.length, have = new Set(((res && res.rows) || []).filter(r => r.src === key).map(r => r.i));
  let soft = null, R = 0;
  for (const r of CI_RADII) {
    R = r; soft = await Promise.all(hexes.map(h => ciCoverage(src, h, r, true)));
    let best = 0;
    for (let i = 0; i < n; i++) { let g = 1; for (let j = 0; j < k && g > 0; j++) g *= soft[j].cov[i]; if (g > best) best = g; }
    if (Math.pow(best, 1 / k) >= .002) break;
  }
  const score = new Float32Array(n), any = opts.mode === "any";
  for (let i = 0; i < n; i++) {
    if (any) { let s = 0; for (let j = 0; j < k; j++) s += soft[j].cov[i]; score[i] = s; }
    else { let g = 1; for (let j = 0; j < k; j++) g *= soft[j].cov[i] + 1e-6; score[i] = Math.pow(g, 1 / k); }
  }
  const ord = [];
  for (let i = 0; i < n; i++) if (!have.has(i) && score[i] > 1e-5) ord.push(i);
  ord.sort((a, b) => score[b] - score[a]);
  const top = ord.slice(0, o.max || 48);
  const deOf = i => { let d = 0; for (let j = 0; j < k; j++) { const x = soft[j].de[i]; d = Math.max(d, isFinite(x) ? x : R); } return d; };
  const tc = top.length ? Math.min(R, Math.max(opts.tol || 0, Math.ceil(deOf(top[0])))) : 0;
  const hard = tc ? await Promise.all(hexes.map(h => ciCoverage(src, h, tc))) : [];
  const rows = top.map(i => {
    const covers = hard.map(c => c.cov[i] * 100);
    return { src: key, i, near: true, score: score[i], de: deOf(i), covers, cover: any ? Math.max(...covers) : Math.min(...covers), tc };
  });
  return { rows, tc, R, key };
}
// "nearest patch 7% away, 3% within 8%": the honest numbers on a fallback tile
function ciNearWords(r) {
  const f = c => c >= 10 ? Math.round(c) + "%" : c >= 1 ? (+c.toFixed(1)) + "%" : c >= .1 ? (+c.toFixed(2)) + "%" : "under 0.1%";
  return `nearest patch ${r.de < 1 ? "under 1" : Math.round(r.de)}% away, ${f(r.cover)} of the canvas within ${r.tc}%`;
}
// Auto: the tightest pair of sliders that still shows at least `want` pictures. tolList/minList are the slider stops.
// o.mode "any" needs 1 of k, "atleast" needs o.atLeast of k, anything else ("all") needs every one — the same
// "Nth highest coverage wins" test ciOne uses, so this agrees with what the sliders will actually show.
async function ciAuto(hexes, o, tolList, minList, want = CI_WANT) {
  hexes = ciHexes(hexes);
  const key = o && o.source && CI_SOURCES[o.source] ? o.source : "paintings", src = await ciOpen(key), n = src.n, k = hexes.length;
  const need = o && o.mode === "any" ? 1 : o && o.mode === "atleast" ? Math.max(1, Math.min(k, o.atLeast || k)) : k;
  let best = null;
  for (let ti = 0; ti < tolList.length; ti++) {
    const cs = await Promise.all(hexes.map(h => ciCoverage(src, h, tolList[ti])));
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) { const covs = []; for (let j = 0; j < k; j++) covs.push(cs[j].cov[i]); covs.sort((a, b) => b - a); v[i] = covs[need - 1]; }
    v.sort();
    const kth = v[Math.max(0, n - want)] * 100;
    let mi = -1; for (let m = 0; m < minList.length; m++) if (minList[m] <= kth + 1e-6) mi = m;
    if (mi < 0) continue;
    const cost = ti / Math.max(1, tolList.length - 1) + (minList.length - 1 - mi) / Math.max(1, minList.length - 1);
    if (!best || cost < best.cost) best = { cost, tol: tolList[ti], minCover: minList[mi], maxCover: null };
  }
  if (!best) best = { tol: tolList[tolList.length - 1], minCover: minList[0], maxCover: null };
  return { tol: best.tol, minCover: best.minCover, maxCover: null };
}
// paintingsFor(hex, { tol, minCover, sort }) is a Promise (the index loads lazily). Once a query has been answered,
// asking again returns that same Promise already carrying the answer's fields (count, n, rows, list, items), so a
// caller that renders synchronously (Explore's filter pass, js/browse*.js) can read r.items right away and simply
// re-render when the Promise settles the first time.
const CI_ANSWERED = new Map();
function paintingsFor(hex, opts = {}) {
  const key = JSON.stringify([String(hex).toUpperCase(), opts]);
  const hit = CI_ANSWERED.get(key);
  const p = hit ? Promise.resolve(hit) : paintingsWith([hex], opts).then(r => { r.list = r.items = r.rows; CI_ANSWERED.set(key, r); if (CI_ANSWERED.size > 16) CI_ANSWERED.delete(CI_ANSWERED.keys().next().value); return r; });
  if (hit) Object.assign(p, hit);
  return p;
}

// ---------- statistics for a set ----------
const CI_ADJ = { Italy: "Italian", France: "French", Netherlands: "Dutch", Germany: "German", Spain: "Spanish", "United Kingdom": "British", "United States": "American", Japan: "Japanese", China: "Chinese", Russia: "Russian", Belgium: "Belgian", Denmark: "Danish", Norway: "Norwegian", Sweden: "Swedish", Austria: "Austrian", Switzerland: "Swiss", India: "Indian", Iran: "Persian", Korea: "Korean", Nepal: "Nepali", Tibet: "Tibetan" };
const ciFmt = n => n >= 10 ? Math.round(n).toLocaleString("en-US") : n >= 1 ? (+n.toFixed(1)).toString() : (+n.toFixed(2)).toString();
// how often a group (decade, painter, country...) holds the match, against how often it holds anything
function ciTop(res, meta, of, label, minTotal, minHit, k) {
  const tot = new Map(), hit = new Map();
  const seen = new Set(res.rows.map(r => r.i));
  for (let i = 0; i < meta.year.length; i++) { const g = of(i); if (g == null) continue; tot.set(g, (tot.get(g) || 0) + 1); }
  seen.forEach(i => { const g = of(i); if (g != null) hit.set(g, (hit.get(g) || 0) + 1); });
  const rate = seen.size / meta.year.length, out = [];
  hit.forEach((h, g) => { const t = tot.get(g); if (h >= minHit && t >= minTotal) out.push({ g, label: label(g), hit: h, total: t, lift: h / t / rate }); });
  return out.sort((a, b) => b.lift - a.lift || b.hit - a.hit).slice(0, k);
}
async function ciSetStats(res, hexes, o = {}) {
  const st = { count: res.count, n: res.n, per: res.per, expected: res.expected, lift: res.lift, decades: [], painters: [], countries: [], movements: [], earliest: null, span: null };
  const one = res.sources && res.sources.length === 1 ? res.sources[0] : null;
  if (!one || !res.rows.length) return st;
  const meta = await ciMeta(one), L = meta.lists, rows = res.rows.filter(r => res.o.mode !== "palette" || r.score >= .5);
  const sub = { rows, o: res.o };
  const dec = i => { const y = meta.year[i]; return y === -32768 ? null : Math.floor(y / 10) * 10; };
  st.decades = ciTop(sub, meta, dec, g => g + "s", 40, 5, 4);
  st.painters = ciTop(sub, meta, i => meta.artist[i] || null, g => L.artists[g], 12, 4, 4);
  st.countries = ciTop(sub, meta, i => meta.co[i] || null, g => L.countries[g], 40, 6, 3);
  st.movements = ciTop(sub, meta, i => meta.mv[i] || null, g => L.movements[g], 30, 6, 3);
  let best = null;
  rows.forEach(r => { const y = meta.year[r.i]; if (y !== -32768 && (!best || y < meta.year[best.i])) best = r; });
  st.earliest = best ? { i: best.i, src: best.src, year: meta.year[best.i] } : null;
  // the run of neighboring decades around the peak whose rate is also at least 1.4x the archive's
  if (st.decades.length) {
    const rate = rows.length / meta.year.length, tot = new Map(), hit = new Map();
    for (let i = 0; i < meta.year.length; i++) { const d = dec(i); if (d != null) tot.set(d, (tot.get(d) || 0) + 1); }
    rows.forEach(r => { const d = dec(r.i); if (d != null) hit.set(d, (hit.get(d) || 0) + 1); });
    const ok = d => (hit.get(d) || 0) >= 2 && (tot.get(d) || 0) >= 20 && (hit.get(d) / tot.get(d)) / rate >= 1.4;
    let lo = st.decades[0].g, hi = lo;
    while (ok(lo - 10)) lo -= 10;
    while (ok(hi + 10)) hi += 10;
    st.span = [lo, hi + 9];
  }
  return st;
}
// one honest line about a set. names: what to call each color.
function ciFinding(names, res, st) {
  const k = names.length, list = k === 1 ? names[0] : names.length === 2 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names[k - 1];
  const item = res.sources && res.sources.length === 1 ? res.sources[0].item : "picture", plural = item + "s";
  const pct = res.n ? res.count / res.n * 100 : 0, pcts = pct < .1 ? "under 0.1" : pct < 1 ? (+pct.toFixed(1)).toString() : Math.round(pct).toString();
  const o = res.o || CI_DEFAULT, near = o.tol === 0 ? "exactly" : `within ${o.tol}%`;
  const cv = item === "painting" ? "canvas" : "piece", cover = o.maxCover ? `between ${o.minCover}% and ${o.maxCover}% of the ${cv}` : o.minCover <= .05 ? "even as a speck" : `covering at least ${o.minCover}% of the ${cv}`;
  const how = `${k > 1 && o.mode === "all" ? "each " : ""}${near}, ${cover}`;
  const N = n => n.toLocaleString("en-US");
  const n = res.count;
  let s;
  if (!n) return `Nothing at this setting holds ${k === 1 ? list : k === 2 ? "both " + list : "all of " + list}, ${how}. The closest ${plural} in the archive are ranked below.`;
  if (k === 1) s = `${N(n)} ${n === 1 ? item : plural} (${pcts}% of ${N(res.n)}) hold ${list}, ${how}.`;
  else if (o.mode === "any") s = `${N(n)} ${n === 1 ? item : plural} hold at least one of ${list}, ${how}.`;
  else if (o.mode === "palette") s = `${N(n)} ${n === 1 ? item : plural} match this palette closely.`;
  else {
    s = `${list} appear together in ${N(n)} ${n === 1 ? item : plural} (${how})`;
    if (res.lift != null && res.expected >= 1) {
      const l = res.lift;
      s += l >= 1.25 ? `, ${l >= 10 ? Math.round(l) : l.toFixed(1)}× more often than chance (about ${ciFmt(res.expected)} if they were scattered independently).`
        : l <= .8 ? `, ${(1 / l >= 10 ? Math.round(1 / l) : (1 / l).toFixed(1))}× less often than chance (about ${ciFmt(res.expected)} if they were scattered independently).`
        : `, about as often as chance (${ciFmt(res.expected)} if they were scattered independently).`;
    } else s += ".";
  }
  const bits = [];
  if (st && n >= 12) {
    if (st.span && st.decades.length) bits.push(st.span[0] === st.span[1] - 9 ? `peaks in the ${st.span[0]}s` : `peaks between ${st.span[0]} and ${st.span[1]}`);
    const c = st.countries[0]; if (c) bits.push(`is commonest in ${CI_ADJ[c.label] ? CI_ADJ[c.label] + " work" : "work from " + c.label}`);
    const p = st.painters[0]; if (p && p.hit >= 5) bits.push(`${p.label} reaches for it most (${p.hit} of ${p.total} works)`);
  }
  if (bits.length) s += " " + (k === 1 ? "It " : "The pair ") + (bits.length > 1 ? bits.slice(0, -1).join(", ") + ", and " + bits[bits.length - 1] : bits[0]) + ".";
  if (n < 15) s += n === 1 ? " Just the one, so take it as a curiosity, not a trend." : ` Only ${n}, so take it as a curiosity, not a trend.`;
  return s;
}


// ---------- pairs and chords (the masters' chords page, the pair page, and games) ----------
// Color-wheel theory's name for two colors, on the perceptual (CIELAB) wheel. Same rule as relation() in
// tools/color_index.py: neutral = chroma under 12; analogous = hues within 40 degrees; opposite = 150 or more apart.
const CI_REL = ["two neutrals", "a color with a neutral", "neighbors on the wheel", "in between on the wheel", "near-opposites"];
function ciTheory(a, b) {
  const lc = h => { const [L, A, B] = ciLab(h); return [L, Math.hypot(A, B), (Math.atan2(B, A) / CI_RAD + 360) % 360]; };
  const [, c1, h1] = lc(a), [, c2, h2] = lc(b);
  let r;
  if (c1 < 12 && c2 < 12) r = 0; else if (c1 < 12 || c2 < 12) r = 1;
  else { let d = Math.abs(h1 - h2) % 360; if (d > 180) d = 360 - d; r = d <= 40 ? 2 : d >= 150 ? 4 : 3; }
  return { code: r, text: CI_REL[r] };
}
const CI_STD = { tol: 4, minCover: 1, mode: "all", sort: "cover", source: "paintings" };
// everything about one pair at the standard definition (a painting has a color when something within 4% of it
// covers at least 1% of the canvas), so it agrees with the chords table and the affinity table.
async function pairStats(a, b, o = {}) {
  const res = await paintingsWith([a, b], { ...CI_STD, ...o });
  const st = await ciSetStats(res, [a, b]);
  const theory = ciTheory(a, b);
  return { a, b, count: res.count, n: res.n, perA: res.per[0], perB: res.per[1], expected: res.expected, lift: res.lift, theory, stats: st, res };
}
// one honest line: what theory predicts, what painters did
function ciTakeaway(nameA, nameB, ps) {
  const l = ps.lift, n = ps.count, th = ps.theory;
  const rel = { 0: "two neutrals", 1: `${nameA} and ${nameB} pair a color with a neutral`, 2: `${nameA} and ${nameB} are neighbors on the wheel`, 3: "sit a third of the way round the wheel from each other", 4: `${nameA} and ${nameB} are near-opposites on the wheel` }[th.code];
  const theoryLine = th.code === 4 ? `Theory calls near-opposites a vivid pairing${l != null && l < .9 ? ", but painters in this archive use it less than chance" : l != null && l > 1.25 ? ", and painters here do use it more than chance" : ""}.`
    : th.code === 2 ? `Theory calls neighbors on the wheel harmonious${l != null && l > 1.25 ? ", and painters here agree" : l != null && l < .9 ? ", yet this pair is rarer than chance here" : ""}.` : "";
  if (!n) return `Nothing holds both at this setting; the closest paintings are ranked below. ${theoryLine}`.trim();
  if (n < 5) return `${n === 1 ? "One painting holds" : n + " paintings hold"} both: too few to say anything about painters' habits.`;
  const head = l == null ? `${n.toLocaleString("en-US")} paintings hold both.`
    : l >= 1.5 ? `Painters really do reach for this pair: ${l >= 10 ? Math.round(l) : l.toFixed(1)}× more often than chance, ${n.toLocaleString("en-US")} paintings.`
    : l <= .7 ? `Painters keep these apart: ${(1 / l >= 10 ? Math.round(1 / l) : (1 / l).toFixed(1))}× less often than chance, only ${n.toLocaleString("en-US")} paintings.`
    : `About as common as chance: ${n.toLocaleString("en-US")} paintings.`;
  const era = ps.stats && ps.stats.span && n >= 12 ? ` Peak: ${ps.stats.span[0] === ps.stats.span[1] - 9 ? "the " + ps.stats.span[0] + "s" : ps.stats.span[0] + " to " + ps.stats.span[1]}.` : "";
  return `${head}${era} ${theoryLine}`.trim();
}
let CI_CHORDS = null;
function ciChords() {
  if (!CI_CHORDS) CI_CHORDS = ciGet(CI_BASE + CI_SOURCES.paintings.dir + "chords.json", "json").catch(e => { CI_CHORDS = null; throw e; });
  return CI_CHORDS;
}
// the pairs, triads or avoided pairs painters actually combine: topChords({ era: "c1500", n: 10, kind: "pairs" })
// era keys: all, c1400..c1900, it1500, nl1600, fr1800, jp, in, mvImpressionism, mvPost-Impressionism, mvRealism, mvRenaissance
async function topChords(o = {}) {
  const d = await ciChords(), sl = d.slices.find(x => x.k === (o.era || "all")) || d.slices[0], kind = o.kind || "pairs";
  const list = (sl[kind === "avoid" ? "avoid" : kind === "triads" ? "triads" : "pairs"] || []).slice(0, o.n || 10);
  return { slice: sl, kind, list, how: d.how, classes: d.classes };
}

// ---------- the affinity table (data/colorindex/affinity-<letter>.json) ----------
const ciSlug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function ciAffinity(name) {
  const slug = ciSlug(name), ch = /^[a-z]/.test(slug) ? slug[0] : "_";
  if (!CI_AFF.has(ch)) CI_AFF.set(ch, ciGet(CI_BASE + CI_SOURCES.paintings.dir + `affinity-${ch}.json`, "json").catch(() => { CI_AFF.delete(ch); return {}; }));
  return CI_AFF.get(ch).then(d => d[slug] || null);
}

// ---------- the arriving color on one painting ----------
// How much of painting i is within tol of hex, and how the painting's own colors rank. pool: [{h, share}] (the
// 24-color pool of the detail shard). The rank groups the pool's colors that are within tol of each other, then
// counts the groups bigger than the arriving color's share.
async function ciArrival(i, hex, tol, key = "paintings") {
  const src = await ciOpen(key), c = await ciCoverage(src, hex, tol);
  return { cover: c.cov[i] * 100, de: isFinite(c.de[i]) ? c.de[i] : null, coarse: src.coarse.has(i) };
}
function ciRank(pool, hex, tol, cover) {
  if (!pool || !pool.length) return null;
  const t = ciLab(hex), groups = [];
  pool.slice().sort((a, b) => b.share - a.share).forEach(p => {
    const l = ciLab(p.h), g = groups.find(x => ciDE(x.l[0], x.l[1], x.l[2], l[0], l[1], l[2]) <= Math.max(tol, 2));
    if (g) g.share += p.share; else groups.push({ l, share: p.share });
  });
  const mine = groups.filter(g => ciDE(t[0], t[1], t[2], g.l[0], g.l[1], g.l[2]) <= Math.max(tol, 2) * 1.5).reduce((a, g) => a + g.share, 0);
  const others = groups.filter(g => ciDE(t[0], t[1], t[2], g.l[0], g.l[1], g.l[2]) > Math.max(tol, 2) * 1.5);
  const target = Math.max(cover / 100, mine);
  return { rank: 1 + others.filter(g => g.share > target).length, of: others.length + 1 };
}

if (typeof module !== "undefined" && module.exports) module.exports = { ciClosest, ciAuto, ciNearWords, pairStats, topChords, ciTheory, ciTakeaway, ciChords, paintingsFor, paintingsWith, ciOpen, ciCoverage, ciLeaf, ciNeedLeaves, ciDecode, ciLab, ciDE, ciSetStats, ciFinding, ciAffinity, ciArrival, ciRank, ciMeta, CI_SOURCES, ciTolR, ciCellOf, ciSlug, ciAvailable };
