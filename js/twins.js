"use strict";
// Closest in the archive (design/IDEAS-10X/studio.md §6 A, plus David's metric switch, 2026-10-08).
// Any palette you make (a photo, the wheel, a saved palette) or any museum painting can be matched against the
// ~23,500 paintings, and you choose WHAT counts as close with a row of chips:
//   Overall palette   the whole palette with its areas: a two-way, area-weighted CIEDE2000 match (glSimilar's)
//   Dominant colors   only the three biggest colors
//   Accents           the small vivid colors (share under 12%, chroma 25 and up)
//   Mood              value key, chroma, contrast and warmth together (a standardized distance)
//   Light structure   the lightness histogram, compared as an earth mover's distance in L*
//   One color         one chosen swatch: the paintings with the most canvas near it (glNear)
//   Layout            where the colors sit, on a coarse 4 x 4 grid; only where an image can be read
// Each result says WHY it matched in plain words, with color-to-color threads (or a histogram, a pair of
// palettes, a pair of 4 x 4 mosaics, whichever shows that metric). Color only, as photographed: varnish browns
// old paintings, and a color twin is never an influence.
// Archive data: the six-color index (gallery), data/gallery/metrics.bin (tools/metrics_build.py: lightness and hue
// histograms and key/chroma/contrast per painting, from the 24-color pools), and thumbnails for Layout.

const TW_METRICS = [["overall", "Overall palette"], ["dominant", "Dominant colors"], ["accents", "Accents"], ["mood", "Mood"], ["light", "Light structure"], ["color", "One color"], ["layout", "Layout"]];
const TW_REC = 27;

// ---------- the matcher: an outside palette against the archive's six-color index ----------
// pal: [{ h, share? }] (up to 10 are used; no shares = equal). Returns null until the gallery index is loaded, else
// { list: [{ i, d, pairs: [{ yours, theirs, de, share }] }], era: { label, share, n } | null }.
// d is the mean area-weighted ΔE (both ways); pairs are the best match for each of your three biggest colors.
function glSimilarPal(pal, k = 5, o = {}) {
  const G = typeof GAL !== "undefined" && GAL;
  if (!G) return null;
  const P = pal.filter(p => p && p.h).slice(0, 10).map(p => ({ h: p.h, s: p.share == null ? 1 : Math.max(p.share, .001), lab: lab(p.h) }));
  if (!P.length) return null;
  const tot = P.reduce((a, p) => a + p.s, 0); P.forEach(p => { p.s /= tot; });
  const mL = P.reduce((a, p) => a + p.s * p.lab[0], 0), ma = P.reduce((a, p) => a + p.s * p.lab[1], 0), mb = P.reduce((a, p) => a + p.s * p.lab[2], 0);
  const N = G.n, m = G.mean, d0 = new Float32Array(N), Lb = G.lab, sh = G.sh;
  for (let j = 0; j < N; j++) { const a = m[j * 3] - mL, b = m[j * 3 + 1] - ma, c = m[j * 3 + 2] - mb; d0[j] = a * a + b * b + c * c; }
  if (o.exclude != null && o.exclude >= 0) d0[o.exclude] = Infinity;
  // the best 240 on average color: the 240th smallest value is the cut (a native sort of a copy, no comparator)
  const cut = d0.slice().sort()[Math.min(239, N - 1)], cand = [];
  for (let j = 0; j < N; j++) if (d0[j] <= cut && d0[j] !== Infinity) cand.push(j);
  const matched = j => {
    let a = 0, b = 0;
    for (const p of P) { let best = 1e9; for (let y = 0; y < 6; y++) { const o3 = (j * 6 + y) * 3, d = glDE(p.lab[0], p.lab[1], p.lab[2], Lb[o3], Lb[o3 + 1], Lb[o3 + 2]); if (d < best) best = d; } a += p.s * best; }
    for (let y = 0; y < 6; y++) { const o3 = (j * 6 + y) * 3; let best = 1e9; for (const p of P) { const d = glDE(Lb[o3], Lb[o3 + 1], Lb[o3 + 2], p.lab[0], p.lab[1], p.lab[2]); if (d < best) best = d; } b += sh[j * 6 + y] * best; }
    return (a + b) / 2;
  };
  const ranked = cand.map(j => [j, matched(j)]).sort((x, y) => x[1] - y[1]);
  return twFinish(ranked, P, k, o);
}
// pairs (your biggest colors to their nearest swatch) and the era lean, shared by every palette-type metric
function twFinish(ranked, P, k, o = {}) {
  const G = GAL, Lb = G.lab, top = P.slice().sort((a, b) => b.s - a.s).slice(0, 3);
  const list = ranked.slice(0, k).map(([j, d]) => ({
    i: j, d,
    pairs: o.pairs === false ? [] : top.map(p => twBestSwatch(j, p)),
  }));
  return { list, era: o.noEra ? null : twEra(ranked) };
}
function twBestSwatch(j, p, vividOnly) {
  const G = GAL, Lb = G.lab; let by = -1, bd = 1e9;
  for (let y = 0; y < 6; y++) { const o3 = (j * 6 + y) * 3; if (vividOnly && G.ch[j * 6 + y] < 18) continue; const dd = glDE(p.lab[0], p.lab[1], p.lab[2], Lb[o3], Lb[o3 + 1], Lb[o3 + 2]); if (dd < bd) { bd = dd; by = y; } }
  return by < 0 ? null : { yours: p.h, theirs: glHex(j, by), de: bd, share: p.s };
}
// which decade (or, if the nearest are spread out, which century) the nearest 200 lean toward
function twEra(ranked) {
  const G = GAL, near = ranked.slice(0, 200), dated = near.map(x => G.year[x[0]]).filter(y => y !== GL_UNDATED);
  if (dated.length < 100) return null;
  const tally = f => { const t = new Map(); dated.forEach(y => { const key = f(y); t.set(key, (t.get(key) || 0) + 1); }); return [...t].sort((a, b) => b[1] - a[1])[0]; };
  const dec = tally(y => Math.floor(y / 10) * 10), cen = tally(y => Math.floor(y / 100) * 100);
  return dec[1] / dated.length >= .2 ? { label: dec[0] + "s", share: dec[1] / dated.length } : { label: "the " + cen[0] + "s", share: cen[1] / dated.length };
}

// ---------- a picture's numbers: the same recipe for your palette and for every painting ----------
// pool: [{ h, s }] with s normalised. Returns light structure, hue structure and the mood numbers.
function twStats(pool) {
  const Lh = new Array(10).fill(0), hh = new Array(12).fill(0); let Lm = 0, Cm = 0;
  const byL = pool.map(p => ({ L: p.lch[0], s: p.s })).sort((a, b) => a.L - b.L);
  pool.forEach(p => { Lh[Math.max(0, Math.min(9, Math.floor(p.lch[0] / 10)))] += p.s; hh[Math.min(11, Math.floor(p.lch[2] / 30))] += p.s * p.lch[1]; Lm += p.s * p.lch[0]; Cm += p.s * p.lch[1]; });
  const pct = f => { let c = 0; for (const x of byL) { c += x.s; if (c >= f) return x.L; } return byL[byL.length - 1].L; };
  const ht = hh.reduce((a, b) => a + b, 0) || 1; hh.forEach((v, i) => { hh[i] = v / ht; });
  const p5 = pct(.05), p95 = pct(.95);
  return twMood({ Lh, hh, Lm, Cm, p5, p95, ct: p95 - p5 });
}
const twWarm = hh => { const w = hh[0] + hh[1] + hh[2] + hh[11], c = hh[6] + hh[7] + hh[8] + hh[9]; return w + c ? (w - c) / (w + c) : 0; };
const twMood = r => (r.warm = twWarm(r.hh), r);
let TW_MET = null, TW_MET_P = null;
function twLoadMetrics() {
  if (TW_MET) return Promise.resolve(TW_MET);
  return TW_MET_P || (TW_MET_P = fetch("data/gallery/metrics.bin").then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => (TW_MET = new Uint8Array(b))).catch(e => { TW_MET_P = null; throw e; }));
}
function twRec(i) {
  const b = TW_MET, o = i * TW_REC;
  let s = 0; for (let k = 0; k < 10; k++) s += b[o + k];
  const Lh = Array.from({ length: 10 }, (_, k) => b[o + k] / (s || 1)), hs = Array.from({ length: 12 }, (_, k) => b[o + 10 + k]), ht = hs.reduce((a, c) => a + c, 0) || 1;
  return twMood({ Lh, hh: hs.map(v => v / ht), Lm: b[o + 22], Cm: b[o + 23], ct: b[o + 24], p5: b[o + 25], p95: b[o + 26] });
}
const TW_SD = { Lm: 15.7, Cm: 7.2, ct: 15.6, warm: .39 };   // the archive's spread (tools/metrics_build.py output), so each axis counts alike
const twMoodDist = (a, b) => Math.hypot((a.Lm - b.Lm) / TW_SD.Lm, (a.Cm - b.Cm) / TW_SD.Cm, (a.ct - b.ct) / TW_SD.ct, .8 * (a.warm - b.warm) / TW_SD.warm);
function twEMD(a, b) { let c = 0, s = 0; for (let k = 0; k < 9; k++) { c += a[k] - b[k]; s += Math.abs(c); } return s * 10; }   // L* units: bins are 10 wide

// ---------- the query: what you are looking for, as numbers ----------
// pool: [{ h, share? }]; o: { self, img (element or fn), what }
function twQuery(pool, o = {}) {
  const P = pool.filter(c => c && c.h).map(c => ({ h: c.h.toUpperCase(), s: c.share == null ? 1 : Math.max(c.share, .0005), lab: lab(c.h), lch: lch(c.h) }));
  const tot = P.reduce((a, p) => a + p.s, 0) || 1; P.forEach(p => { p.s /= tot; });
  P.sort((a, b) => b.s - a.s);
  const q = { pool: P.slice(0, 24), pal: P.slice(0, 10), self: o.self == null ? -1 : o.self };
  q.stats = twStats(q.pool);
  q.accents = q.pool.filter(p => p.s < .12 && p.lch[1] >= 25).sort((a, b) => b.lch[1] - a.lch[1]).slice(0, 3);
  return q;
}

const twPal = q => q.pal.map(p => ({ h: p.h, share: p.s }));
// a finer pool for a picture on screen: the same 24-color recipe the archive paintings were measured with
function twRichPool(img) {
  if (!img || !img.naturalWidth) return null;
  const k = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return extractPalette(c, 24);
}

// ---------- the scorers: each returns ranked [[i, score]] (low is close) plus whatever its card needs ----------
function twRankAll(score, N, self) {
  const arr = new Float32Array(N);
  for (let j = 0; j < N; j++) arr[j] = j === self ? Infinity : score(j);
  const idx = Int32Array.from({ length: N }, (_, j) => j).filter(j => arr[j] !== Infinity).sort((a, b) => arr[a] - arr[b]).slice(0, 220);
  return Array.from(idx, j => [j, arr[j]]);
}
let TW_TOP3 = null;
function twDominantIdx() {
  if (TW_TOP3) return TW_TOP3;
  const G = GAL, t = new Uint8Array(G.n * 3);
  for (let j = 0; j < G.n; j++) { const o = [0, 1, 2, 3, 4, 5].sort((a, b) => G.sh[j * 6 + b] - G.sh[j * 6 + a]); t[j * 3] = o[0]; t[j * 3 + 1] = o[1]; t[j * 3 + 2] = o[2]; }
  return (TW_TOP3 = t);
}
function twScoreDominant(q) {
  const G = GAL, T = twDominantIdx(), Lb = G.lab, P = q.pool.slice(0, 3), tot = P.reduce((a, p) => a + p.s, 0); const W = P.map(p => ({ ...p, s: p.s / tot }));
  const mL = W.reduce((a, p) => a + p.s * p.lab[0], 0), ma = W.reduce((a, p) => a + p.s * p.lab[1], 0), mb = W.reduce((a, p) => a + p.s * p.lab[2], 0);
  const pre = twRankAll(j => { let L = 0, a = 0, b = 0, s = 0; for (let t = 0; t < 3; t++) { const y = T[j * 3 + t], w = G.sh[j * 6 + y], o3 = (j * 6 + y) * 3; L += w * Lb[o3]; a += w * Lb[o3 + 1]; b += w * Lb[o3 + 2]; s += w; } s = s || 1; return (L / s - mL) ** 2 + (a / s - ma) ** 2 + (b / s - mb) ** 2; }, G.n, q.self).slice(0, 200);
  const ranked = pre.map(([j]) => {
    let a = 0, b = 0, sb = 0; for (let t = 0; t < 3; t++) sb += G.sh[j * 6 + T[j * 3 + t]];
    for (const p of W) { let best = 1e9; for (let t = 0; t < 3; t++) { const o3 = (j * 6 + T[j * 3 + t]) * 3, d = glDE(p.lab[0], p.lab[1], p.lab[2], Lb[o3], Lb[o3 + 1], Lb[o3 + 2]); if (d < best) best = d; } a += p.s * best; }
    for (let t = 0; t < 3; t++) { const y = T[j * 3 + t], o3 = (j * 6 + y) * 3; let best = 1e9; for (const p of W) { const d = glDE(Lb[o3], Lb[o3 + 1], Lb[o3 + 2], p.lab[0], p.lab[1], p.lab[2]); if (d < best) best = d; } b += G.sh[j * 6 + y] / (sb || 1) * best; }
    return [j, (a + b) / 2];
  }).sort((x, y) => x[1] - y[1]);
  return { ranked, P: W };
}
function twScoreAccents(q) {
  const G = GAL, A = q.accents;
  if (!A.length) return { ranked: [], P: [] };
  const Lb = G.lab, ranked = twRankAll(j => {
    let s = 0;
    for (const p of A) {
      let best = 40;
      for (let y = 0; y < 6; y++) { const k = j * 6 + y; if (G.ch[k] < 18 || G.sh[k] > .3) continue; let dh = Math.abs(G.hu[k] - p.lch[2]); if (dh > 180) dh = 360 - dh; if (dh > 40) continue; const o3 = k * 3, d = glDE(p.lab[0], p.lab[1], p.lab[2], Lb[o3], Lb[o3 + 1], Lb[o3 + 2]); if (d < best) best = d; }
      s += best;
    }
    return s / A.length;
  }, G.n, q.self).map(x => x);
  return { ranked, P: A };
}
function twScoreMood(q) { const ranked = twRankAll(j => twMoodDist(q.stats, twRec(j)), GAL.n, q.self); return { ranked, P: q.pool.slice(0, 3) }; }
function twScoreLight(q) { const ranked = twRankAll(j => twEMD(q.stats.Lh, twRec(j).Lh), GAL.n, q.self); return { ranked, P: q.pool.slice(0, 3) }; }
function twScoreColor(q, hex) {
  const s = glNear(hex); if (q.self >= 0) s[q.self] = 0;
  const idx = Int32Array.from({ length: GAL.n }, (_, j) => j).filter(j => s[j] > .01).sort((a, b) => s[b] - s[a]).slice(0, 220);
  return { ranked: Array.from(idx, j => [j, 1 - s[j]]), P: [{ h: hex, s: 1, lab: lab(hex) }] };
}

// ---------- layout: a 4 x 4 grid of average colors ----------
function twGridOf(src) {
  const c = document.createElement("canvas"); c.width = c.height = 48;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, out = [];
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = gy * 12; y < gy * 12 + 12; y++) for (let xx = gx * 12; xx < gx * 12 + 12; xx++) { const p = (y * 48 + xx) * 4; r += GL_LIN[d[p]]; g += GL_LIN[d[p + 1]]; b += GL_LIN[d[p + 2]]; n++; }
    const e = v => Math.round(clamp(v / n > .0031308 ? 1.055 * (v / n) ** (1 / 2.4) - .055 : 12.92 * v / n, 0, 1) * 255).toString(16).padStart(2, "0");
    const h = ("#" + e(r) + e(g) + e(b)).toUpperCase(); out.push({ h, lab: lab(h) });
  }
  return out;
}
// can this image be read into a canvas here? (a photo yes; a museum image only on a CORS host or a local copy)
function twReadable(src) {
  if (!src) return false;
  try { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d"); x.drawImage(src, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; }
}
const twLoadThumb = d => new Promise(res => {
  const url = d.img, ok = glSmall(d) || glCORS(glBig(url));
  if (!ok) return res(null);
  const im = new Image(); if (!glSmall(d)) im.crossOrigin = "anonymous";
  const t = setTimeout(() => res(null), 7000);
  im.onload = () => { clearTimeout(t); res(twReadable(im) ? im : null); }; im.onerror = () => { clearTimeout(t); res(null); };
  im.src = glSmall(d) ? url : glBig(url);
});
async function twScoreLayout(q, grid, st) {
  const base = glSimilarPal(twPal(q), 40, { exclude: q.self, noEra: true, pairs: false });
  const rows = await Promise.all(base.list.map(async x => { const d = await glDetail(x.i), im = await twLoadThumb(d); return im ? [x.i, twGridOf(im)] : null; }));
  const got = rows.filter(Boolean);
  const ranked = got.map(([j, g]) => [j, g.reduce((a, c, k) => a + glDE(grid[k].lab[0], grid[k].lab[1], grid[k].lab[2], c.lab[0], c.lab[1], c.lab[2]), 0) / 16, g]).sort((a, b) => a[1] - b[1]);
  return { ranked, P: [], tried: base.list.length, read: got.length };
}

// ---------- plain words ----------
const twKeyWord = L => L < 30 ? "dark" : L < 48 ? "middle-key" : "light";
const twChromaWord = C => C < 12 ? "muted" : C < 24 ? "moderately colorful" : "vivid";
const twWarmWord = w => w > .6 ? "warm" : w < -.2 ? "cool" : "balanced in temperature";
function twWhy(metric, q, x, ctx) {
  const d = x.d;
  switch (metric) {
    case "overall": return `On average its colors sit ${pctDiff(d)} from yours, matched by area.`;
    case "dominant": return `Its three biggest colors are ${pctDiff(d)} from yours, on average.`;
    case "accents": return d >= 39 ? "It has no accent like yours." : `Its small vivid colors land ${pctDiff(d)} from yours.`;
    case "mood": {
      const r = twRec(x.i), a = q.stats, A = [twKeyWord(a.Lm), twChromaWord(a.Cm), twWarmWord(a.warm)], B = [twKeyWord(r.Lm), twChromaWord(r.Cm), twWarmWord(r.warm)];
      const same = A.filter((w, i) => w === B[i]), diff = B.filter((w, i) => w !== A[i]);
      return same.length ? `Both ${same.join(", ")}.${diff.length ? ` It is ${diff.join(", ")}.` : ""}` : `Yours is ${A.join(", ")}; it is ${B.join(", ")}.`;
    }
    case "light": { const r = twRec(x.i), dark = h => Math.round((h[0] + h[1] + h[2]) * 100); return `Light is laid out alike: its darks cover ${dark(r.Lh)}% (yours ${dark(q.stats.Lh)}%), within ${d.toFixed(1)} L* overall.`; }
    case "color": return `${Math.max(1, Math.round((1 - d) * 100))}% of its canvas is near ${nameOf(ctx.hex).n.toLowerCase()}.`;
    case "layout": return `The colors sit in the same places: ${pctDiff(d)} across the 16 zones.`;
  }
  return "";
}
const TW_LEAD = {
  overall: ["Paintings whose whole palette, with its areas, sits close to yours:", "Paintings that loosely share your palette:", d => d < 6, d => d < 10],
  dominant: ["Paintings built on the same three big colors:", "Paintings that loosely share your big colors:", d => d < 5, d => d < 9],
  accents: ["Paintings with accents like yours:", "Paintings with accents loosely like yours:", d => d < 8, d => d < 14],
  mood: ["Paintings with the same mood (key, color, contrast, warmth):", "Paintings with a loosely similar mood:", d => d < .6, d => d < 1.2],
  light: ["Paintings lit the same way (the same spread of darks and lights):", "Paintings lit loosely the same way:", d => d < 4, d => d < 8],
  color: ["Paintings with the most of this color:", "Paintings with a little of this color:", d => d < .8, d => d < .93],
  layout: ["Paintings whose colors sit in the same places:", "Paintings whose colors sit loosely in the same places:", d => d < 10, d => d < 16],
};

// ---------- the section ----------
let TW_REGISTRY = 0;
// cols: [{ h, share? }]. o: { self (painting index to leave out), what ("your photo"), img (element or function), rich (function returning a finer pool), key, title }
function twSection(host, cols, o = {}) {
  if (!host) return;
  const pool = cols.filter(c => c && c.h).map(c => ({ h: c.h, share: c.share }));
  const key = o.key || pool.map(c => c.h + (c.share == null ? "" : Math.round(c.share * 100))).join();
  if (pool.length < 3 || host.dataset.twKey === key) return;
  host.dataset.twKey = key;
  const prev = host._tw, st = host._tw = { o, pool, metric: prev && prev.metric || "overall", color: 0, tok: 0, q: null, grid: undefined, rich: prev && o.key && prev.richKey === o.key ? prev.rich : null, richKey: o.key };
  host.innerHTML = `<div class="sec-head"><b>${esc(o.title || "Closest in the archive")}</b><span>color only</span></div>
    <div class="tw-chips" role="tablist" aria-label="What counts as close"></div><div class="tw-pick" hidden></div><div class="tw-out"><p class="tw-wait">Finding paintings…</p></div>`;
  host.querySelector(".tw-chips").onclick = e => { const b = e.target.closest("[data-m]"); if (b && b.dataset.m !== st.metric) { st.metric = b.dataset.m; twChips(host); twRun(host); buzz(4); } };
  host.querySelector(".tw-pick").onclick = e => { const b = e.target.closest("[data-pick]"); if (b) { st.color = +b.dataset.pick; twPick(host); twRun(host); buzz(4); } };
  host.querySelector(".tw-out").onclick = e => { const b = e.target.closest("[data-tw]"); if (b) galleryPage(+b.dataset.tw, true, b.dataset.from || null); };
  twChips(host);
  loadGallery().then(() => new Promise(r => setTimeout(r, 30))).then(() => {
    if (!host.isConnected || host._tw !== st) return;
    let rich = st.rich; if (!rich && o.rich) { try { rich = o.rich(); } catch (e) { rich = null; } st.rich = rich; }
    st.q = twQuery(rich && rich.length >= 3 ? rich : pool, o);
    const im = typeof o.img === "function" ? o.img() : o.img; st.canLayout = !!im && twReadable(im);
    twChips(host); twPick(host); twRun(host);
  }).catch(() => { if (host._tw === st) host.querySelector(".tw-out").innerHTML = `<p class="tw-wait">The archive didn't load. Check your connection and reopen this page.</p>`; });
}
function twChips(host) {
  const st = host._tw;
  host.querySelector(".tw-chips").innerHTML = TW_METRICS.filter(([k]) => k !== "layout" || st.canLayout).map(([k, t]) => `<button role="tab" data-m="${k}" aria-selected="${k === st.metric}" class="${k === st.metric ? "on" : ""}">${t}</button>`).join("");
}
function twPick(host) {
  const st = host._tw, box = host.querySelector(".tw-pick");
  if (st.metric !== "color" || !st.q) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<span>Match which color?</span>` + st.q.pool.slice(0, 6).map((p, i) => `<button data-pick="${i}" class="${i === st.color ? "on" : ""}" style="--c:${p.h}" aria-label="${esc(nameOf(p.h).n)}" aria-pressed="${i === st.color}"></button>`).join("");
}
async function twRun(host) {
  const st = host._tw, q = st.q; if (!q) return;
  const tok = ++st.tok, out = host.querySelector(".tw-out"), m = st.metric, live = () => host.isConnected && host._tw === st && st.tok === tok;
  twPick(host);
  try {
    let res, ctx = {};
    if (m === "mood" || m === "light") {
      if (!TW_MET) { out.innerHTML = `<p class="tw-wait">Reading the archive's light and mood data…</p>`; await twLoadMetrics(); if (!live()) return; }
      res = m === "mood" ? twScoreMood(q) : twScoreLight(q);
    } else if (m === "layout") {
      const im = typeof st.o.img === "function" ? st.o.img() : st.o.img;
      if (!im || !twReadable(im)) { out.innerHTML = `<p class="tw-wait">Layout needs a picture this page can read.</p>`; return; }
      if (!st.grid) st.grid = twGridOf(im);
      out.innerHTML = `<p class="tw-wait">Looking at how the colors sit on the 40 closest palettes…</p>`;
      res = await twScoreLayout(q, st.grid, st); if (!live()) return;
      ctx.grid = st.grid; ctx.read = res.read; ctx.tried = res.tried;
    } else if (m === "color") { ctx.hex = q.pool[Math.min(st.color, q.pool.length - 1)].h; res = twScoreColor(q, ctx.hex); }
    else if (m === "dominant") res = twScoreDominant(q);
    else if (m === "accents") res = twScoreAccents(q);
    else { const r = glSimilarPal(twPal(q), 220, { exclude: q.self, pairs: false, noEra: true }); res = { ranked: r.list.map(x => [x.i, x.d]), P: q.pal }; }
    if (!live()) return;
    res.list = res.ranked.slice(0, 5).map(r => ({ i: r[0], d: r[1], grid: r[2] }));
    res.list.forEach(x => {
      if (m === "color") x.pairs = [twBestSwatch(x.i, res.P[0])].filter(Boolean);
      else if (m === "accents") x.pairs = res.P.map(p => twBestSwatch(x.i, p, true)).filter(Boolean);
      else if (m === "overall" || m === "dominant") x.pairs = q.pool.slice(0, 3).map(p => twBestSwatch(x.i, p)).filter(Boolean);
      else x.pairs = [];
    });
    res.era = res.ranked.length >= 100 ? twEra(res.ranked) : null;
    const ds = await Promise.all(res.list.map(x => glDetail(x.i))); if (!live()) return;
    twRender(host, res, ds, ctx);
  } catch (e) { if (live()) out.innerHTML = `<p class="tw-wait">That data didn't load. Check your connection and try again.</p>`; }
}
// small pictures of a metric
const twMini = pal => `<span class="tw-mini">${pal.map(c => `<i style="--c:${c.h};flex:${Math.max(c.share || c.s || .05, .05).toFixed(3)}"></i>`).join("")}</span>`;
function twHist(a, b) {
  const mx = Math.max(...a, ...b, .01);
  return `<span class="tw-hist" aria-hidden="true">${a.map((v, k) => `<span><i class="y" style="height:${Math.round(v / mx * 100)}%"></i><i class="t" style="height:${Math.round(b[k] / mx * 100)}%"></i></span>`).join("")}</span>`;
}
const twMosaic = g => `<span class="tw-mosaic" aria-hidden="true">${g.map(c => `<i style="--c:${c.h}"></i>`).join("")}</span>`;
function twRender(host, res, ds, ctx) {
  const st = host._tw, q = st.q, m = st.metric, out = host.querySelector(".tw-out"), what = st.o.what || "your palette";
  const [good, loose, isClose, isLoose] = TW_LEAD[m];
  if (!res.list.length) {
    out.innerHTML = m === "accents" ? `<p class="tw-lead">${esc(what.charAt(0).toUpperCase() + what.slice(1))} has no small vivid colors to match. Try Overall palette or Mood.</p>`
      : m === "layout" ? `<p class="tw-lead">None of the closest paintings has an image this page can read, so their layout can't be compared. Try another way of matching.</p>` : `<p class="tw-lead">Nothing matched.</p>`;
    return;
  }
  const best = res.list[0].d, lead = isClose(best) ? good : isLoose(best) ? loose : "Nothing in the archive is really close. The nearest, anyway:";
  const yearOf = i => { const y = glYear(i); return y ? " · " + y : ""; };
  const visual = x => {
    if (m === "light") { const r = twRec(x.i); return twHist(q.stats.Lh, r.Lh); }
    if (m === "mood") return twMini(q.pool.slice(0, 6)) + twMini(glPal(x.i));
    if (m === "layout") return `<span class="tw-pair">${twMosaic(ctx.grid)}${twMosaic(x.grid)}</span>`;
    const pairs = x.pairs.filter(p => p.de < 16);
    return `<div class="tw-threads">${pairs.map(p => `<div class="tw-thread"><button data-swatch="${p.yours}" style="--c:${p.yours}" aria-label="Your ${esc(nameOf(p.yours).n)}"></button><span class="tw-line"></span><button data-swatch="${p.theirs}" style="--c:${p.theirs}" aria-label="Its ${esc(nameOf(p.theirs).n)}"></button></div>
      <p class="tw-names">${esc(nameOf(p.yours).n)}<em>to</em>${esc(nameOf(p.theirs).n)}</p>`).join("")}</div>`;
  };
  const card = (x, k) => {
    const d = ds[k], from = (x.pairs[0] || {}).theirs || "";
    return `<div class="tw-card"><button class="tw-im" data-tw="${x.i}" data-from="${from}" style="--c:${glPal(x.i).reduce((a, b) => b.share > a.share ? b : a).h}" aria-label="Open ${esc(d.t)}"><img src="${esc(d.img)}" alt="" loading="lazy" decoding="async"></button>
      <b>${esc(d.t)}</b><small>${esc(d.a || d.co || "Artist unknown")}${yearOf(x.i)}</small>${visual(x)}<p class="tw-why">${esc(twWhy(m, q, x, ctx))}</p></div>`;
  };
  const wn = twWerner(q.pool), N = GAL.n.toLocaleString();
  out.innerHTML = `<p class="tw-lead">${lead}</p>
    <div class="tw-rail">${res.list.map(card).join("")}</div>
    ${m === "light" ? `<p class="tw-key"><i class="y"></i>${esc(st.o.what ? st.o.what.charAt(0).toUpperCase() + st.o.what.slice(1) : "Yours")} <i class="t"></i>the painting</p>` : ""}
    ${m === "layout" ? `<p class="tw-era">Compared among the ${ctx.read} of the ${ctx.tried} closest palettes whose pictures can be read here. Left square: yours; right: the painting.</p>` : ""}
    ${res.era ? `<p class="tw-era">The nearest 200 lean ${esc(res.era.label)} (${Math.round(res.era.share * 100)}% of those with a date).</p>` : ""}
    ${wn.length && m === "overall" ? `<div class="tw-werner">${wn.map(x => `<button data-swatch="${x.yours}"><i style="--c:${x.yours}"></i><span><b>Werner, 1821 · <em>${esc(x.w.name)}</em></b><small>${esc([x.w.animal, x.w.plant, x.w.mineral].filter(Boolean).join(" · "))}</small></span></button>`).join("")}</div>` : ""}
    <p class="fine">Matched across ${N} museum paintings by ${esc(TW_METRICS.find(t => t[0] === m)[1].toLowerCase())}. Old varnish browns many of them. A color twin isn't an influence.${m === "overall" && wn.length ? " Werner's printed chips have aged; our hex values for them are approximations." : ""}</p>`;
}

// ---------- Werner, 1821 ----------
function twWerner(pal) {
  const W = window.BOTANY && window.BOTANY.werner;
  if (!W) return [];
  const out = [], seen = new Set();
  pal.slice(0, 5).forEach(p => {
    const L = lab(p.h); let best = null, bd = 1e9;
    W.forEach(w => { const d = de2000(L, lab(w.hex.toUpperCase())); if (d < bd) { bd = d; best = w; } });
    if (best && bd <= 5 && !seen.has(best.name)) { seen.add(best.name); out.push({ yours: p.h, w: best, de: bd }); }
  });
  return out.slice(0, 3);
}

// ---------- the live twin in the camera ----------
// Five patches across the frame stand in for a palette (the middle one counts double). Twice a second, once the
// gallery's index is in memory, the closest painting's thumbnail sits in a corner of the viewfinder.
function twLive(vid, stage) {
  const host = stage.parentElement, now = performance.now();
  if (!host || !vid.videoWidth) return;
  let box = host.querySelector(".tw-live");
  if (!box) {
    box = document.createElement("button"); box.className = "tw-live"; box.hidden = true;
    box.innerHTML = `<img alt=""><span>Closest painting<b></b></span>`;
    box.onclick = () => { if (box.dataset.i) galleryPage(+box.dataset.i, true, null); };
    host.appendChild(box); box._at = now; box._busy = false;
  }
  if (typeof GAL === "undefined" || !GAL) {
    if (!box._loading && now - box._at > 2500) { box._loading = true; loadGallery().catch(() => {}); }   // the index is about 0.7 MB; fetched only once the camera has run a moment
    return;
  }
  if (box._busy || now - (box._last || 0) < 550) return;
  box._last = now; box._busy = true;
  const pts = [[.5, .5, 2], [.25, .3, 1], [.75, .3, 1], [.25, .7, 1], [.75, .7, 1]];
  const res = glSimilarPal(pts.map(([x, y, w]) => ({ h: isoSample(vid, x, y, { frac: .1 }), share: w / 6 })), 1, { pairs: false, noEra: true });
  const i = res && res.list[0] && res.list[0].i;
  if (i == null || String(i) === box.dataset.i) { box._busy = false; return; }
  glDetail(i).then(d => {
    box.dataset.i = i; box.querySelector("img").src = d.img; box.querySelector("b").textContent = d.t; box.hidden = false;
  }).catch(() => {}).then(() => { box._busy = false; });
}
