"use strict";
// The painting gallery: every painting in the corpus (data/gallery/, built by tools/gallery.py), browsable and
// searchable by color. It is the Paintings lens in Explore (after the hand-built "Featured" pages), a lite page per
// painting, and an "In paintings" row on color pages. Sized for ~40,000 paintings:
//  - index.json + index.bin (about 30 bytes a painting: year, museum, aspect, L, C, six colors with their shares)
//    load in one go the first time something needs them. Detail shards (title, artist, image, record) load
//    only for the paintings on screen. Every swatch's name comes from nameOf()/familyOf() (js/naming.js), the
//    app's one naming system (ROADMAP.md §13) — not from tools/gallery.py's own names.json, which nothing
//    reads anymore now that palette rows show one name and a family (js/names.js).
//  - A search is one pass over typed arrays. The grid is a virtualized two-column masonry: every pin's height is
//    known from the index, so pins are placed absolutely and only the ones near the screen exist.
// Palettes are computed (k-means on the museum's small photo), and every screen that shows one says so.

const GAL_DIR = "data/gallery/";
let GAL = null, GAL_LOADING = null;
const GL_SHARDS = new Map();           // detail shard number -> rows, or the pending fetch
const GL_UNDATED = -32768;
const GL_R = 12;                       // "near a color" = within CIEDE2000 12, weighted by closeness
const GL_TXT = 59;                     // fixed height of a pin's palette bar + title + byline (see css/gallery.css)
const GL_ERAS = [["Before 1400", -1e5, 1400], ["1400s", 1400, 1500], ["1500s", 1500, 1600], ["1600s", 1600, 1700], ["1700s", 1700, 1800], ["1800s", 1800, 1900], ["1900s", 1900, 1e5]];
const GL_PRESETS = [["blue", "Mostly blue"], ["dark", "Darkest"], ["vivid", "Most colorful"], ["pink", "Pink accents"], ["taste", "Matches your taste"]];
const glFresh = () => ({ hex: null, name: "", custom: false, preset: "", eras: [], mus: -1, L: [0, 1], C: [0, 1] });
let GLQ = glFresh();                   // the current search (kept for the session)
let GLV = null;                        // where to put the grid when Explore comes back: { key, y } or { key, head }
let GL_CTRL = null;                    // the live grid
const glKey = q => JSON.stringify(q);
const GL_ICON_ADJ = sv('<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.2"/><circle cx="9.5" cy="17" r="2.2"/>', 16, 1.8);
const GL_ICON_MAP = sv('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>', 20, 1.7);
const GL_ICON_OUT = sv('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>', 14, 1.8);
// a small crosshair/target glyph: "Where this color sits on the painting" (the strip chip's secondary, explicit
// locate gesture -- David, relayed 2026-10-09: tapping a chip opens its page; locating it on the canvas moves
// to this small control so the two never compete for the same tap)
const GL_WHERE_ICON = sv('<circle cx="12" cy="12" r="5.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>', 13, 1.9, true);

// ---------- loading ----------
function loadGallery() {
  if (GAL) return Promise.resolve(GAL);
  const get = (f, kind) => fetch(GAL_DIR + f).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r[kind](); });
  return GAL_LOADING || (GAL_LOADING = Promise.all([get("index.json", "json"), get("index.bin", "arrayBuffer")])
    .then(([head, buf]) => (GAL = glBuild(head, new Uint8Array(buf))))
    .catch(e => { GAL_LOADING = null; throw e; }));
}
// sRGB -> linear, as a table (same formula as lab() in core.js)
const GL_LIN = Float32Array.from({ length: 256 }, (_, v) => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
function glBuild(head, b) {
  const N = head.n, R = head.rec;
  const year = new Int16Array(N), mus = new Uint8Array(N), ar = new Float32Array(N), L = new Float32Array(N), C = new Float32Array(N);
  const rgb = new Uint8Array(N * 18), sh = new Float32Array(N * 6), lb = new Float32Array(N * 18), ch = new Float32Array(N * 6), hu = new Float32Array(N * 6), mean = new Float32Array(N * 3);
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  for (let i = 0; i < N; i++) {
    const o = i * R, y = b[o] | b[o + 1] << 8;
    year[i] = y ? y - head.year0 : GL_UNDATED;
    mus[i] = b[o + 2]; ar[i] = Math.exp(b[o + 3] / 255 * 3.2 - 1.6); L[i] = b[o + 4] / 2.5; C[i] = b[o + 5] / 3;
    let tot = 0, mL = 0, ma = 0, mb = 0;
    for (let j = 0; j < 6; j++) {
      const p = o + 6 + j * 4, k = i * 6 + j, r = GL_LIN[b[p]], g = GL_LIN[b[p + 1]], bl = GL_LIN[b[p + 2]];
      rgb[k * 3] = b[p]; rgb[k * 3 + 1] = b[p + 1]; rgb[k * 3 + 2] = b[p + 2];
      const x = f((r * .4124 + g * .3576 + bl * .1805) / .95047), yy = f(r * .2126 + g * .7152 + bl * .0722), z = f((r * .0193 + g * .1192 + bl * .9505) / 1.08883);
      const l = 116 * yy - 16, a = 500 * (x - yy), bb = 200 * (yy - z), s = b[p + 3] / 250;
      lb[k * 3] = l; lb[k * 3 + 1] = a; lb[k * 3 + 2] = bb; sh[k] = s;
      ch[k] = Math.sqrt(a * a + bb * bb); const H = Math.atan2(bb, a) * 180 / Math.PI; hu[k] = H < 0 ? H + 360 : H;
      tot += s; mL += s * l; ma += s * a; mb += s * bb;
    }
    tot = tot || 1; mean[i * 3] = mL / tot; mean[i * 3 + 1] = ma / tot; mean[i * 3 + 2] = mb / tot;
  }
  return { head, n: N, shard: head.shard, src: head.sources, app: head.app, year, mus, ar, L, C, rgb, sh, lab: lb, ch, hu, mean, Ls: L.slice().sort(), Cs: C.slice().sort() };
}
function glShard(k) {
  const have = GL_SHARDS.get(k);
  if (have) return Array.isArray(have) ? Promise.resolve(have) : have;
  const p = fetch(`${GAL_DIR}d/${String(k).padStart(3, "0")}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(rows => { GL_SHARDS.set(k, rows); return rows; }).catch(e => { GL_SHARDS.delete(k); throw e; });
  GL_SHARDS.set(k, p);
  return p;
}
const glRowObj = r => r && { id: r[0], t: r[1] || "Untitled", a: r[2], co: r[3], mv: r[4], img: r[5], rec: r[6], li: r[7], wi: r[8], hi: r[9] || "", pl: r[10] || "", crop: r[11] || null };
const glDetailNow = i => { const s = GL_SHARDS.get(Math.floor(i / GAL.shard)); return Array.isArray(s) ? glRowObj(s[i % GAL.shard]) : null; };
const glDetail = i => glShard(Math.floor(i / GAL.shard)).then(rows => glRowObj(rows[i % GAL.shard]));

// ---------- small helpers ----------
const glHex = (i, j) => { const k = (i * 6 + j) * 3, c = GAL.rgb; return "#" + ((1 << 24) | c[k] << 16 | c[k + 1] << 8 | c[k + 2]).toString(16).slice(1).toUpperCase(); };
const glPal = i => Array.from({ length: 6 }, (_, j) => ({ h: glHex(i, j), share: GAL.sh[i * 6 + j] }));
const glAR = i => clamp(GAL.ar[i], .55, 1.9);          // pin boxes crop extreme scrolls and panoramas
// The painting inside its frame, wall or margin (tools/crop_paintings.py): d.crop = [left, top, right, bottom] in thousandths
// of the museum photo, and GAL.ar[i] is already the CROPPED shape (h/w). The <img> keeps the photo's own shape and is scaled
// and shifted inside its box (aspect ab, h/w) so only the crop shows, covering the box when the box was clamped. "" = no crop.
function glCropStyle(i, d, ab) {
  const c = d && d.crop; if (!c || c.length !== 4) return "";
  const l = c[0] / 1000, t = c[1] / 1000, cw = (c[2] - c[0]) / 1000, ch = (c[3] - c[1]) / 1000;
  if (!(cw > .05 && ch > .05)) return "";
  const arF = GAL.ar[i] * cw / ch;                        // the whole photo's h/w
  const W = Math.max(100 / cw, 100 / ch * ab / arF), H = W * arF / ab;   // the photo's size as a % of the box
  const L = -l * W - (cw * W - 100) / 2, T = -t * H - (ch * H - 100) / 2;
  const f = v => v.toFixed(3);
  return ` style="inset:auto;max-width:none;object-fit:fill;width:${f(W)}%;height:${f(H)}%;left:${f(L)}%;top:${f(T)}%"`;
}
const glYear = i => { const y = GAL.year[i]; return y === GL_UNDATED ? "" : y < 0 ? `${-y} BCE` : String(y); };
// artist (or country) and year; the name gives way before the year does
const glByline = (i, d) => { const who = d.a || d.co || "", y = glYear(i); return `<span>${esc(who)}</span>${y ? `<em>${who ? " · " : ""}${y}</em>` : ""}`; };
// a bigger copy for the painting page: IIIF servers take any width; other museums' URLs are used as they are
// our own small copies (img/gallery/...) are only 200px wide: shown smaller so they stay crisp, or swapped for a big image
const glSmall = d => /^img\/gallery\//.test(d.img || "");
const glBig = url => String(url || "").replace(/\/full\/!?\d*,\d*\/0\/default\.jpg$/, "/full/843,/0/default.jpg");

// ---------- the dynamic palette (ROADMAP §13, 3/6/12/20): a pool of up to 24 colors per painting
// (tools/gallery.py's extract_pool(), the same over-cluster-then-greedy-pick method as js/studio.js
// extractPalette, ported to Python so it runs once offline), base64'd into the detail shard as 4 raw bytes a
// color (R, G, B, share x 250 — the same byte scheme index.bin uses for its own six). glPoolPick() re-runs just
// the "pick k of them" step live, in OKLab, so any slider size comes from the one small download already on
// screen. A painting with no cached image at build time ships an empty pool; the control simply doesn't show.
function glPoolDecode(b64) {
  if (!b64) return [];
  let bin; try { bin = atob(b64); } catch (e) { return []; }
  const out = [];
  for (let i = 0; i + 3 < bin.length; i += 4) {
    const r = bin.charCodeAt(i), g = bin.charCodeAt(i + 1), b = bin.charCodeAt(i + 2), s = bin.charCodeAt(i + 3);
    out.push({ h: "#" + ((1 << 24) | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase(), share: s / 250 });
  }
  return out.sort((a, b) => b.share - a.share);
}
// a self-contained OKLab forward transform (Bjoern Ottosson, 2020): gallery.js draws its own dynamic palette
// without reaching into js/studio.js, which other agents are editing.
const GLP_LIN8 = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
function glpOk(hex) {
  const n = parseInt(hex.slice(1), 16), r = GLP_LIN8(n >> 16 & 255), g = GLP_LIN8(n >> 8 & 255), b = GLP_LIN8(n & 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
// pick k of the pool: the same share^0.6 x vividness x distinctness-from-what's-picked greedy rule as the
// Python port's step 2 (and js/studio.js extractPalette's own step 2). Shares are renormalized over the picked
// set only (the pool has no raw pixels left to re-assign against, so this is the closest honest approximation).
function glPoolPick(pool, k) {
  if (!pool.length) return [];
  if (k >= pool.length) return pool.slice();
  const withOk = pool.map(p => ({ h: p.h, share: p.share, ok: glpOk(p.h) }));
  const chroma = ok => Math.hypot(ok[1], ok[2]);
  const picked = [], left = withOk.slice();
  while (picked.length < k && left.length) {
    let bi = 0, bs = -1;
    left.forEach((g, i) => {
      const near = picked.length ? Math.sqrt(Math.min(...picked.map(p => (p.ok[0] - g.ok[0]) ** 2 + (p.ok[1] - g.ok[1]) ** 2 + (p.ok[2] - g.ok[2]) ** 2))) : 1;
      const s = Math.pow(g.share, .6) * (.5 + 3 * chroma(g.ok)) * Math.pow(Math.min(1, near / .14), 1.5);
      if (s > bs) { bs = s; bi = i; }
    });
    picked.push(left.splice(bi, 1)[0]);
  }
  const tot = picked.reduce((a, p) => a + p.share, 0) || 1;
  return picked.map(p => ({ h: p.h, share: p.share / tot })).sort((a, b) => b.share - a.share);
}
// ---------- By area / Diverse (David, 2026-10-09 audit -- Gari Melchers' "Maternity": the palette finder never
// registered the mother's lilac sleeve, in ANY mode): the pipeline fix (tools/gallery.py extract_pool, the hue-
// floor diversity pass) means a genuinely-present, locally concentrated color family now actually survives into
// the shipped pool -- but a naive top-k-by-share slice can still bury it at the tail. These two picks give it
// two honest ways to surface: true area order (for when area really is the question), and a pick that GUARANTEES
// coverage of every distinct hue family in the pool above a small floor (for when it isn't).
// By area: literal top-k by share -- "every color sized by how much of the canvas it covers," no vividness
// weighting, no distinctness game. Near-duplicates (ΔE00 < 6, the painter's-own-palette threshold elsewhere in
// this file) are merged into the larger share first, so a cluster split across two adjacent picks by the offline
// pipeline doesn't cost the ranking two slots for one real color.
function glPoolByArea(pool, k) {
  if (!pool.length) return [];
  const merged = [];
  pool.slice().sort((a, b) => b.share - a.share).forEach(p => {
    const near = merged.find(m => de2000(m.h, p.h) < 6);
    if (near) near.share += p.share; else merged.push({ h: p.h, share: p.share });
  });
  merged.sort((a, b) => b.share - a.share);
  return merged.slice(0, k);
}
// Diverse: farthest-point sampling in OKLab (max-min / MMR) -- start from the single biggest color, then
// repeatedly add whichever remaining pool color is farthest from everything already picked. This structurally
// guarantees every distinct hue family present above a small area gets a seat as k grows, independent of area
// or chroma ranking (objective iii, David's palette-engine brief, 2026-10-09: "the lilac must appear"). Shares
// are re-measured against the final picks (every pool color goes to its nearest pick), same honesty rule as
// glPoolPick. Ordered hue-then-lightness ("beautifully", not a jumbled share-sort) since this mode's whole point
// is showing the painting's distinct families side by side.
function glPoolDiverse(pool, k) {
  if (!pool.length) return [];
  if (k >= pool.length) return pool.slice();
  const withOk = pool.map(p => ({ h: p.h, share: p.share, ok: glpOk(p.h) }));
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const start = withOk.reduce((a, b) => b.share > a.share ? b : a);
  const picked = [start], left = withOk.filter(p => p !== start);
  while (picked.length < k && left.length) {
    let bi = 0, bd = -1;
    left.forEach((g, i) => { const near = Math.min(...picked.map(p => d2(p.ok, g.ok))); if (near > bd) { bd = near; bi = i; } });
    picked.push(left.splice(bi, 1)[0]);
  }
  const PC = picked;
  const area = picked.map(() => 0), tot = withOk.reduce((a, p) => a + p.share, 0) || 1;
  withOk.forEach(p => { let b = 0, bd = Infinity; PC.forEach((q, j) => { const dd = d2(p.ok, q.ok); if (dd < bd) { bd = dd; b = j; } }); area[b] += p.share; });
  return picked.map((p, j) => ({ h: p.h, share: area[j] / tot, ok: p.ok }))
    .sort((a, b) => { const ha = Math.atan2(a.ok[2], a.ok[1]), hb = Math.atan2(b.ok[2], b.ok[1]); return ha !== hb ? ha - hb : b.ok[0] - a.ok[0]; })
    .map(p => ({ h: p.h, share: p.share }));
}
// the nearest swatch in a displayed palette to an arrival color, for "≈ Aubergine · 5% of the canvas · nearest
// swatch" (ROADMAP §13, "arrive from a color and see it") — honest when nothing is close (NEAR_DE, js/naming.js).
function glNearestSwatch(pal, hex) {
  if (!pal.length) return null;
  const [L, a, b] = lab(hex);
  let best = null, bd = Infinity;
  pal.forEach((p, i) => { const d = de2000([L, a, b], lab(p.h)); if (d < bd) { bd = d; best = i; } });
  return best == null ? null : { i: best, de: bd };
}

// CIEDE2000 on plain numbers: the same formula as de2000() in core.js, without arrays, for the search loops
const GL_P7 = 6103515625, GL_RAD = Math.PI / 180;
function glDE(L1, a1, b1, L2, a2, b2) {
  const Cb = (Math.sqrt(a1 * a1 + b1 * b1) + Math.sqrt(a2 * a2 + b2 * b2)) / 2, c2 = Cb * Cb, c7 = c2 * c2 * c2 * Cb, G = .5 * (1 - Math.sqrt(c7 / (c7 + GL_P7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
  let h1p = b1 || a1p ? Math.atan2(b1, a1p) / GL_RAD : 0; if (h1p < 0) h1p += 360;
  let h2p = b2 || a2p ? Math.atan2(b2, a2p) / GL_RAD : 0; if (h2p < 0) h2p += 360;
  const dL = L2 - L1, dC = C2p - C1p, pr = C1p * C2p;
  let dh = 0; if (pr) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(pr) * Math.sin(dh * GL_RAD / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p; if (pr) { if (Math.abs(h1p - h2p) > 180) hb += hb < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * GL_RAD) + .24 * Math.cos(2 * hb * GL_RAD) + .32 * Math.cos((3 * hb + 6) * GL_RAD) - .2 * Math.cos((4 * hb - 63) * GL_RAD);
  const p2 = Cbp * Cbp, p7 = p2 * p2 * p2 * Cbp, Rc = 2 * Math.sqrt(p7 / (p7 + GL_P7)), e = (hb - 275) / 25, l5 = (Lb - 50) * (Lb - 50);
  const Sl = 1 + .015 * l5 / Math.sqrt(20 + l5), Sc = 1 + .045 * Cbp, Sh = 1 + .015 * Cbp * T, Rt = -Math.sin(60 * Math.exp(-e * e) * GL_RAD) * Rc;
  const x = dL / Sl, y = dC / Sc, z = dH / Sh;
  return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
}

// ---------- scoring: one pass each ----------
// How much of each painting is a color: the shares of its palette colors within ΔE 12, each weighted by closeness
// (all of it at the color, none at 12). This is the number on the pins and the sort order.
function glNear(hex) {
  const G = GAL, N = G.n, [tL, ta, tb] = lab(hex), s = new Float32Array(N), Lb = G.lab, sh = G.sh;
  for (let i = 0; i < N; i++) {
    let w = 0;
    for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, o = k * 3, dL = Lb[o] - tL;
      if (dL > 21 || dL < -21) continue;   // ΔE00 is at least |ΔL| / 1.75, so this one can't be within 12
      const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]);
      if (d < GL_R) { const q = d / GL_R; w += sh[k] * (1 - q * q); }
    }
    s[i] = w;
  }
  return s;
}
// Never empty: when fewer than 12 paintings hold a color at the usual measure, every painting is ranked, those
// that hold it first (by share), then the rest by how near their closest patch comes (the same order the "In
// paintings" fallback shows). Cached per color.
const GL_NEAR_RANK = new Map();
function glNearRanked(hex) {
  const k = hex.toUpperCase();
  if (GL_NEAR_RANK.has(k)) return GL_NEAR_RANK.get(k);
  const G = GAL, N = G.n, s = glNear(hex);
  let have = 0; for (let i = 0; i < N; i++) if (s[i] >= .02) have++;
  if (have >= 12) { GL_NEAR_RANK.set(k, { key: s, min: .02 }); return GL_NEAR_RANK.get(k); }
  const [tL, ta, tb] = lab(hex), Lb = G.lab, out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let bd = 1e9;
    for (let j = 0; j < 6; j++) { const o = (i * 6 + j) * 3, d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]); if (d < bd) bd = d; }
    out[i] = s[i] > 0 ? 1 + s[i] : 1 / (2 + bd);   // holders first, then nearest patch
  }
  GL_NEAR_RANK.set(k, { key: out, min: 0, ranked: true, floor: have });
  if (GL_NEAR_RANK.size > 8) GL_NEAR_RANK.delete(GL_NEAR_RANK.keys().next().value);
  return GL_NEAR_RANK.get(k);
}
// Family shares by the corpus's LCh rule (research/STATS-FINDINGS.md): blue = not neutral, hue 180-305.
// Pink accents: light, rosy hues (330-30), at least a little colorful.
const glBlue = (L, C, H) => C >= 10 && !(L < 20 && C < 15) && !(L > 90 && C < 25) && H >= 180 && H < 305;
const glPink = (L, C, H) => L >= 45 && C >= 12 && (H >= 330 || H < 30);
function glFam(test) {
  const G = GAL, N = G.n, out = new Float32Array(N);
  for (let k = 0; k < N * 6; k++) if (test(G.lab[k * 3], G.ch[k], G.hu[k])) out[(k / 6) | 0] += G.sh[k];
  return out;
}
// A new mix every day: a weighted shuffle (Efraimidis-Spirakis) where more colorful paintings surface a little sooner
let GL_DAILY = null;
function glDaily() {
  const day = today(), G = GAL;
  if (GL_DAILY && GL_DAILY.day === day && GL_DAILY.n === G.n) return GL_DAILY.key;
  const key = new Float32Array(G.n); let s = hash("gallery" + day) | 1;
  for (let i = 0; i < G.n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; key[i] = Math.log(((s >>> 0) + .5) / 4294967296) / (.6 + G.C[i] / 22); }
  GL_DAILY = { day, n: G.n, key };
  return key;
}
// Your taste (js/tastemodel.js): the palette model scores each painting's whole palette; the color model scores its
// colors, weighted by area. With both, each is put on a common scale and added.
const glTasteOK = () => { const t = S.taste || {}, T = typeof TASTE !== "undefined" && TASTE;
  return !!T && !!((t.palette && Array.isArray(t.palette.mu) && t.palette.mu.length === T.PAL_PRIOR.length) || (t.color && Array.isArray(t.color.mu) && t.color.mu.length === T.COLOR_PRIOR.length)); };
let GL_TASTE = null;
function glTaste() {
  if (!glTasteOK()) return null;
  const G = GAL, N = G.n, t = S.taste, T = TASTE, sig = JSON.stringify([t.palette && t.palette.mu, t.color && t.color.mu, N]);
  if (GL_TASTE && GL_TASTE.sig === sig) return GL_TASTE.key;
  const out = new Float32Array(N), part = new Float32Array(N);
  const add = () => { let m = 0, v = 0; for (let i = 0; i < N; i++) m += part[i]; m /= N; for (let i = 0; i < N; i++) v += (part[i] - m) ** 2; const sd = Math.sqrt(v / N) || 1; for (let i = 0; i < N; i++) out[i] += (part[i] - m) / sd; };
  if (t.palette && Array.isArray(t.palette.mu) && t.palette.mu.length === T.PAL_PRIOR.length) {
    for (let i = 0; i < N; i++) { const p = glPal(i); part[i] = T.dot(t.palette.mu, T.palItem(p.map(x => x.h), p.map(x => x.share)).x); }
    add();
  }
  if (t.color && Array.isArray(t.color.mu) && t.color.mu.length === T.COLOR_PRIOR.length) {
    for (let i = 0; i < N; i++) { let u = 0; for (let j = 0; j < 6; j++) { const k = i * 6 + j; u += G.sh[k] * T.dot(t.color.mu, T.colorFeat(G.lab[k * 3], G.ch[k], G.hu[k])); } part[i] = u; }
    add();
  }
  GL_TASTE = { sig, key: out };
  return out;
}

// ---------- a search: filter, then sort ----------
function glRun(q) {
  const G = GAL, N = G.n, at = (arr, p) => arr[Math.round(p * (arr.length - 1))];
  const Llo = q.L[0] > 0 ? at(G.Ls, q.L[0]) : -1, Lhi = q.L[1] < 1 ? at(G.Ls, q.L[1]) : 1e3;
  const Clo = q.C[0] > 0 ? at(G.Cs, q.C[0]) : -1, Chi = q.C[1] < 1 ? at(G.Cs, q.C[1]) : 1e3;
  const eras = q.eras.map(k => GL_ERAS[k]);
  let key = null, min = -Infinity, max = Infinity, asc = false, badge = null;
  if (q.hex) {
    const nr = glNearRanked(q.hex); key = nr.key; min = nr.min;
    badge = nr.ranked ? i => key[i] >= 1 ? `${Math.max(1, Math.round((key[i] - 1) * 100))}% ${q.custom ? "this color" : q.name}` : `nearest patch ${Math.round(1 / key[i] - 2)}% away` : i => `${Math.max(1, Math.round(key[i] * 100))}% ${q.custom ? "this color" : q.name}`;
  }
  else if (q.preset === "blue") { key = glFam(glBlue); min = .05; badge = i => `${Math.round(key[i] * 100)}% blue`; }
  else if (q.preset === "pink") { key = glFam(glPink); min = .01; max = .2; badge = i => `${Math.max(1, Math.round(key[i] * 100))}% pink`; }
  else if (q.preset === "dark") { key = G.L; asc = true; }
  else if (q.preset === "vivid") key = G.C;
  else if (q.preset === "taste") key = glTaste();
  if (!key) key = glDaily();
  const out = new Int32Array(N); let n = 0;
  for (let i = 0; i < N; i++) {
    if (q.mus >= 0 && G.mus[i] !== q.mus) continue;
    const L = G.L[i], C = G.C[i];
    if (L < Llo || L > Lhi || C < Clo || C > Chi) continue;
    if (eras.length) { const y = G.year[i]; if (y === GL_UNDATED || !eras.some(e => y >= e[1] && y < e[2])) continue; }
    const v = key[i]; if (v < min || v > max) continue;
    out[n++] = i;
  }
  return { list: out.slice(0, n).sort(asc ? (a, b) => key[a] - key[b] : (a, b) => key[b] - key[a]), badge };
}
// The paintings that most resemble one palette: a quick pass on average color, then a matched distance on the
// best 240 (each color's area times its distance to the nearest color of the other palette, both ways).
function glSimilar(i, k = 5) {
  const G = GAL, N = G.n, m = G.mean, q = i * 3, d0 = new Float32Array(N), Lb = G.lab;
  for (let j = 0; j < N; j++) { const a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2], e = G.C[j] - G.C[i]; d0[j] = a * a + b * b + c * c + e * e; }
  d0[i] = Infinity;
  const cand = Int32Array.from({ length: N }, (_, j) => j).sort((a, b) => d0[a] - d0[b]).slice(0, Math.min(N - 1, 240));
  const half = (a, b) => { let s = 0; for (let x = 0; x < 6; x++) { const oa = (a * 6 + x) * 3; let best = 1e9; for (let y = 0; y < 6; y++) { const ob = (b * 6 + y) * 3, d = glDE(Lb[oa], Lb[oa + 1], Lb[oa + 2], Lb[ob], Lb[ob + 1], Lb[ob + 2]); if (d < best) best = d; } s += G.sh[a * 6 + x] * best; } return s; };
  return [...cand].map(j => [j, (half(i, j) + half(j, i)) / 2]).filter(x => x[1] > .3).sort((a, b) => a[1] - b[1]).slice(0, k).map(x => x[0]);
}

// ---------- pins ----------
// Every pin is drawn from the index at once (its dominant color holds the place); the title and image arrive with
// its detail shard. Text has a fixed height, so a pin's height never changes.
function glPinHTML(i, o = {}) {
  const d = glDetailNow(i), pal = glPal(i), dom = pal.reduce((a, b) => b.share > a.share ? b : a);
  const box = o.imH ? `height:${o.imH}px` : `aspect-ratio:${(1 / glAR(i)).toFixed(3)}`;
  return `<button class="gl-pin${d ? "" : " wait"}" data-gi="${i}"${o.pos ? ` style="${o.pos}"` : ""}><span class="gl-im" style="--c:${dom.h};${box}">${d ? `<img src="${esc(d.img)}" alt="" loading="lazy" decoding="async"${glCropStyle(i, d, glAR(i))}>` : ""}${o.badge ? `<span class="gl-badge">${esc(o.badge)}</span>` : ""}</span>`
    + `<span class="mini-pal">${pal.map(c => `<i style="--c:${c.h};flex:${c.share.toFixed(3)}"></i>`).join("")}</span><b>${d ? esc(d.t) : ""}</b><small>${d ? glByline(i, d) : ""}</small></button>`;
}
// fill in the pins under root that are still waiting for their shard
function glFill(root) {
  const want = new Map();
  root.querySelectorAll(".gl-pin.wait").forEach(el => { const k = Math.floor(+el.dataset.gi / GAL.shard); if (!want.has(k)) want.set(k, []); want.get(k).push(el); });
  want.forEach((els, k) => glShard(k).then(() => els.forEach(el => {
    if (!el.isConnected || !el.classList.contains("wait")) return;
    const i = +el.dataset.gi, d = glDetailNow(i); if (!d) return;
    el.classList.remove("wait");
    el.querySelector(".gl-im").insertAdjacentHTML("afterbegin", `<img src="${esc(d.img)}" alt="" loading="lazy" decoding="async"${glCropStyle(i, d, glAR(i))}>`);
    el.querySelector("b").textContent = d.t; el.querySelector("small").innerHTML = glByline(i, d);
  })).catch(() => {}));
}
// The virtualized masonry: two columns, each pin in the shorter one. Pins are placed in order and each goes to the
// shorter column, so their tops never decrease: a binary search finds the first pin near the screen.
function glGrid(host, res) {
  const list = res.list, n = list.length, gap = 14, vgap = 22, live = new Map();
  let W = 0, colW = 0, top, col, hh;
  const layout = () => {
    W = host.clientWidth || Math.min(innerWidth, 540) - 44; colW = (W - gap) / 2;
    top = new Float32Array(n); col = new Uint8Array(n); hh = new Float32Array(n);
    let c0 = 0, c1 = 0;
    for (let k = 0; k < n; k++) {
      const h = Math.round(colW * glAR(list[k])) + GL_TXT; hh[k] = h;
      if (c0 <= c1) { top[k] = c0; c0 += h + vgap; } else { top[k] = c1; col[k] = 1; c1 += h + vgap; }
    }
    host.style.height = Math.max(0, Math.max(c0, c1) - vgap) + "px";
  };
  const draw = () => {
    if (!host.isConnected || host.offsetParent === null) return;
    const r = host.getBoundingClientRect(), y0 = -r.top - 600, y1 = -r.top + innerHeight + 1000;
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (top[m] < y0 - 900) lo = m + 1; else hi = m; }
    const want = new Set(); let last = lo;
    for (let k = lo; k < n && top[k] <= y1; k++) { if (top[k] + hh[k] >= y0) want.add(k); last = k; }
    live.forEach((el, k) => { if (!want.has(k)) { el.remove(); live.delete(k); } });
    const add = [...want].filter(k => !live.has(k));
    if (add.length) {
      const tmp = document.createElement("div");
      tmp.innerHTML = add.map(k => glPinHTML(list[k], { imH: hh[k] - GL_TXT, badge: res.badge && res.badge(list[k]), pos: `left:${col[k] ? colW + gap : 0}px;top:${top[k]}px;width:${colW}px;height:${hh[k]}px` })).join("");
      [...tmp.children].forEach((el, j) => { live.set(add[j], el); host.appendChild(el); });
      glFill(host);
    }
    for (let k = last + 1; k < Math.min(n, last + 30); k++) glShard(Math.floor(list[k] / GAL.shard)).catch(() => {});   // the next screen's details
  };
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  const onResize = () => { if (Math.abs((host.clientWidth || W) - W) > 1) { layout(); live.forEach(el => el.remove()); live.clear(); } draw(); };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  const destroy = () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); cancelAnimationFrame(raf); live.clear(); };
  cleanup.push(destroy);
  host.innerHTML = "";
  layout(); draw();
  return { draw, destroy };
}

// ---------- the Paintings lens ----------
function galleryMount(host) {
  host.innerHTML = `
    <div class="sec-head x-sec"><b>The gallery</b><span data-glcount></span></div>
    <p class="x-sub">Public-domain paintings from open museum collections, six colors measured from each.</p>
    <div class="gl-bar"><button class="gl-adj" data-gladj>${GL_ICON_ADJ}<span>Adjust</span></button><span class="gl-sum" data-glsum></span><button class="gl-x" data-glclear aria-label="Clear the search" hidden>${ICON.x}</button></div>
    <div class="gl-grid" data-glgrid><p class="fine">Loading the gallery…</p></div>
    <p class="fine">Palettes are computed from each museum's small photo, so they are screen approximations: old varnish and photography shift color.</p>`;
  host.onclick = e => {
    const p = e.target.closest("[data-gi]");
    if (p) { GLV = { key: glKey(GLQ), y: scrollY }; return galleryPage(+p.dataset.gi, true, GLQ.hex || null); }
    if (e.target.closest("[data-gladj]")) return glAdjust(host);
    if (e.target.closest("[data-glclear]")) { GLQ = glFresh(); return glRender(host, true); }
    if (e.target.closest("[data-glretry]")) return galleryMount(host);
  };
  loadGallery().then(() => { if (host.isConnected) { glRender(host); glFloat(host); } })
    .catch(() => { const g = host.querySelector("[data-glgrid]"); if (g) g.innerHTML = `<p class="fine">The gallery didn't load. <button class="wl" data-glretry>Try again</button></p>`; });
}
// what the search is, in a few words
function glSummary(q) {
  const out = [];
  if (q.hex) out.push((q.custom ? "≈ " : "") + q.name);
  if (q.preset) out.push((GL_PRESETS.find(p => p[0] === q.preset) || ["", ""])[1]);
  q.eras.slice().sort((a, b) => a - b).forEach(k => out.push(GL_ERAS[k][0]));
  if (q.mus >= 0 && GAL) out.push(GAL.src[q.mus].short);
  if (q.L[0] > 0 || q.L[1] < 1) out.push(q.L[1] <= .5 ? "Dark" : q.L[0] >= .5 ? "Light" : "Value");
  if (q.C[0] > 0 || q.C[1] < 1) out.push(q.C[1] <= .5 ? "Muted" : q.C[0] >= .5 ? "Vivid" : "Chroma");
  return out;
}
function glRender(host, toTop) {
  const G = GAL, res = glRun(GLQ), grid = host.querySelector("[data-glgrid]"), sum = glSummary(GLQ);
  host.querySelector("[data-glcount]").textContent = res.list.length === G.n ? G.n.toLocaleString() : `${res.list.length.toLocaleString()} of ${G.n.toLocaleString()}`;
  host.querySelector("[data-glsum]").innerHTML = sum.length ? `${GLQ.hex ? `<i style="--c:${GLQ.hex}"></i>` : ""}${esc(sum.join(" · "))}` : "A new mix every day";
  host.querySelector("[data-glclear]").hidden = !sum.length;
  if (GL_CTRL) GL_CTRL.destroy();
  GL_CTRL = null;
  if (!res.list.length) { grid.style.height = ""; grid.innerHTML = `<p class="fine">Nothing matches every filter at once. Loosen one.</p>`; }
  else GL_CTRL = glGrid(grid, res);
  const key = glKey(GLQ);
  if (GLV && GLV.key === key) {
    const v = GLV; GLV = null;
    if (v.head) glToHead(host); else { scrollTo(0, v.y); if (GL_CTRL) GL_CTRL.draw(); }   // before the first paint: no jump
  } else if (toTop) glToHead(host);
  host.dispatchEvent(new CustomEvent("glcount", { detail: res.list.length }));
  return res;
}
// bring the top of the results up under the sticky Explore header
function glToHead(host) {
  const head = document.querySelector(".x-head"), bar = host.querySelector(".gl-bar");
  if (!bar) return;
  const y = scrollY + bar.getBoundingClientRect().top - (head ? head.offsetHeight - 30 : 0);
  scrollTo(0, Math.max(0, y));
  if (GL_CTRL) GL_CTRL.draw();
}
// a floating Adjust button once the bar has scrolled away
function glFloat(host) {
  const pill = document.createElement("button");
  pill.className = "gl-float glass-pill"; pill.hidden = true;
  document.body.appendChild(pill);
  pill.onclick = () => glAdjust(host);
  let raf = 0, txt = "";
  const check = () => {
    raf = 0;
    if (!host.isConnected) return;
    const bar = host.querySelector(".gl-bar"), grid = host.querySelector("[data-glgrid]"), head = document.querySelector(".x-head");
    const hb = head ? head.getBoundingClientRect().bottom : 0;
    pill.hidden = host.offsetParent === null || !!document.querySelector(".gl-sheet") || bar.getBoundingClientRect().bottom > hb || grid.getBoundingClientRect().bottom < innerHeight * .7;
    const t = glSummary(GLQ).join(" · ") || "Adjust";
    if (t !== txt) { txt = t; pill.innerHTML = `${GL_ICON_ADJ}<span>${esc(t)}</span>`; }
  };
  const on = () => { if (!raf) raf = requestAnimationFrame(check); };
  addEventListener("scroll", on, { passive: true });
  host.addEventListener("glcount", on);
  host.addEventListener("glsheet", on);
  cleanup.push(() => { removeEventListener("scroll", on); cancelAnimationFrame(raf); pill.remove(); });
  check();
}

// ---------- Adjust: one compact sheet; results update live behind it ----------
function glHueOrder(list) {
  const k = c => { const [L, C, H] = lch(c.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  return list.slice().sort((a, b) => k(a) - k(b));
}
function glAdjust(host) {
  if (!GAL || document.querySelector(".gl-sheet")) return;
  const G = GAL, day = dailyColor(), cols = [day, ...glHueOrder([...BASICS, ...ALL].filter(c => c.n !== day.n))];
  const presets = GL_PRESETS.filter(p => p[0] !== "taste" || glTasteOK());
  // the app's sheet (core.js: a tap outside or a drag down closes it), with a lighter scrim so the results show
  const { sh, close: shut } = sheet(`
    <div class="gl-sh-top"><b>Adjust</b><span data-glshn></span><button class="gl-reset" data-glreset>Reset</button></div>
    <div class="gl-row"><span class="gl-lab">Color</span><div class="gl-sw">${cols.map((c, k) => `<button data-hex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" aria-label="${esc(c.n)}${k ? "" : ", today's color"}"${k ? "" : ' class="today"'}></button>`).join("")}<button class="gl-any" data-glany aria-label="Any color"></button></div></div>
    <p class="gl-cap" data-glcap></p>
    <div class="gl-picker" data-glpicker hidden></div>
    <div class="gl-row"><span class="gl-lab">Quick</span><div class="gl-chips">${presets.map(([k, t]) => `<button data-pre="${k}">${t}</button>`).join("")}</div></div>
    <div class="gl-row"><span class="gl-lab">Era</span><div class="gl-chips">${GL_ERAS.map((e, k) => `<button data-era="${k}">${e[0]}</button>`).join("")}</div></div>
    ${G.src.length > 1 ? `<div class="gl-row"><span class="gl-lab">Museum</span><div class="gl-chips"><button data-mus="-1">All</button>${G.src.map((s, k) => `<button data-mus="${k}">${esc(s.short)}</button>`).join("")}</div></div>` : ""}
    <div class="gl-row"><span class="gl-lab">Value</span><div class="gl-range" data-glr="L"></div></div>
    <div class="gl-row"><span class="gl-lab">Chroma</span><div class="gl-range" data-glr="C"></div></div>
    <button class="btn solid gl-go" data-gldone></button>`);
  sh.classList.add("gl-sheet"); sh.setAttribute("aria-label", "Adjust the gallery");
  // no scroll lock here: the live results behind the sheet may scroll into view. The scrim still catches touches.
  unlockScroll();
  if (sh.previousElementSibling) sh.previousElementSibling.classList.add("gl-scrim");
  host.dispatchEvent(new Event("glsheet"));
  let picker = null, timer = 0;
  const close = () => { shut(); host.dispatchEvent(new Event("glsheet")); };
  const count = e => {
    if (!sh.isConnected) return host.removeEventListener("glcount", count);
    const n = e.detail;
    sh.querySelector("[data-glshn]").textContent = `${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}`;
    sh.querySelector("[data-gldone]").textContent = n ? `Show ${n.toLocaleString()} ${n === 1 ? "painting" : "paintings"}` : "Nothing matches";
  };
  host.addEventListener("glcount", count);
  const sync = () => {
    sh.querySelectorAll("[data-hex]").forEach(b => b.classList.toggle("on", !GLQ.custom && b.dataset.hex === GLQ.hex));
    sh.querySelector("[data-glany]").classList.toggle("on", GLQ.custom);
    sh.querySelectorAll("[data-pre]").forEach(b => b.classList.toggle("on", b.dataset.pre === GLQ.preset));
    sh.querySelectorAll("[data-era]").forEach(b => b.classList.toggle("on", GLQ.eras.includes(+b.dataset.era)));
    sh.querySelectorAll("[data-mus]").forEach(b => b.classList.toggle("on", +b.dataset.mus === GLQ.mus));
    sh.querySelector("[data-glcap]").innerHTML = GLQ.hex ? `<i style="--c:${GLQ.hex}"></i><b>${esc((GLQ.custom ? "≈ " : "") + GLQ.name)}</b><span>${GLQ.hex === day.h && !GLQ.custom ? "Today's color. " : ""}Paintings with the most of it first</span>`
      : GLQ.preset ? `<b>${esc(GL_PRESETS.find(p => p[0] === GLQ.preset)[1])}</b><span>${{ blue: "The most canvas in blues first", dark: "The lowest average value first", vivid: "The highest average chroma first", pink: "A touch of pink: 1 to 20% of the canvas", taste: "Ranked by your taste tests" }[GLQ.preset]}</span>`
      : `<span>Tap a color to find the paintings with the most of it.</span>`;
  };
  const apply = (now = true) => { sync(); clearTimeout(timer); if (now) glRender(host, true); else timer = setTimeout(() => glRender(host, true), 140); };
  // the two range sliders run on quantiles, so each tenth of the track holds a tenth of the paintings
  const at = (arr, p) => arr[Math.round(p * (arr.length - 1))];
  const ramps = {
    L: { lo: "dark", hi: "light", stops: p => lchHex(at(G.Ls, p), 0, 0) },
    C: { lo: "muted", hi: "vivid", stops: p => lchHex(58, Math.min(at(G.Cs, p) * 1.4, 70), 35) },
  };
  sh.querySelectorAll("[data-glr]").forEach(el => glRange(el, GLQ[el.dataset.glr], ramps[el.dataset.glr], v => { GLQ[el.dataset.glr] = v; apply(false); }));
  sh.onclick = e => {
    const sw = e.target.closest("[data-hex]");
    if (sw) {
      const same = !GLQ.custom && GLQ.hex === sw.dataset.hex;
      Object.assign(GLQ, { hex: same ? null : sw.dataset.hex, name: same ? "" : sw.dataset.name, custom: false, preset: "" });
      buzz(6); return apply();
    }
    if (e.target.closest("[data-glany]")) {
      const box = sh.querySelector("[data-glpicker]");
      box.hidden = !box.hidden;
      if (!box.hidden && !picker) picker = colorPicker(box, { hex: GLQ.hex || day.h, onChange: hex => { const [near] = nearestColors(hex, 1); Object.assign(GLQ, { hex, name: near ? near[0].n : hex, custom: true, preset: "" }); apply(false); } });
      if (!box.hidden) { const hex = picker.get(), [near] = nearestColors(hex, 1); Object.assign(GLQ, { hex, name: near ? near[0].n : hex, custom: true, preset: "" }); apply(); }
      return;
    }
    const pre = e.target.closest("[data-pre]");
    if (pre) { const k = pre.dataset.pre; Object.assign(GLQ, { preset: GLQ.preset === k ? "" : k, hex: null, name: "", custom: false }); buzz(6); return apply(); }
    const era = e.target.closest("[data-era]");
    if (era) { const k = +era.dataset.era; GLQ.eras = GLQ.eras.includes(k) ? GLQ.eras.filter(x => x !== k) : [...GLQ.eras, k]; return apply(); }
    const mu = e.target.closest("[data-mus]");
    if (mu) { GLQ.mus = +mu.dataset.mus; return apply(); }
    if (e.target.closest("[data-glreset]")) { GLQ = glFresh(); sh.querySelectorAll("[data-glr]").forEach(el => el._set && el._set(GLQ[el.dataset.glr])); return apply(); }
    if (e.target.closest("[data-gldone]")) return close();
  };
  // dragging the color wheel must not drag the sheet down
  sh.querySelector("[data-glpicker]").addEventListener("pointerdown", e => e.stopPropagation());
  sync();
  count({ detail: glRun(GLQ).list.length });
  onKey = e => { if (e.key === "Escape") close(); };
  const on = sh.querySelector(".gl-sw .on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
}
// a two-handle slider over 0..1 (painted with what it filters)
function glRange(el, val, ramp, onInput) {
  const v = val.slice();
  el.innerHTML = `<span>${ramp.lo}</span><div class="gl-tr" style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(ramp.stops).join(",")})"><i class="gl-dim l"></i><i class="gl-dim r"></i><i class="gl-kn"></i><i class="gl-kn"></i></div><span>${ramp.hi}</span>`;
  const tr = el.querySelector(".gl-tr"), kn = tr.querySelectorAll(".gl-kn"), dl = tr.querySelector(".l"), dr = tr.querySelector(".r");
  const place = () => { kn[0].style.left = v[0] * 100 + "%"; kn[1].style.left = v[1] * 100 + "%"; dl.style.width = v[0] * 100 + "%"; dr.style.width = (1 - v[1]) * 100 + "%"; };
  el._set = x => { v[0] = x[0]; v[1] = x[1]; place(); };
  tr.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();   // a slider drag is not a sheet drag
    tr.setPointerCapture(e.pointerId);
    const pos = ev => { const r = tr.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1); };
    const p0 = pos(e), which = Math.abs(p0 - v[0]) < Math.abs(p0 - v[1]) || (p0 < v[0]) ? 0 : 1;
    const move = ev => {
      const p = Math.round(pos(ev) * 20) / 20;
      if (which === 0) v[0] = Math.min(p, v[1] - .1); else v[1] = Math.max(p, v[0] + .1);
      v[0] = clamp(v[0], 0, .9); v[1] = clamp(v[1], .1, 1);
      place(); onInput(v.slice());
    };
    move(e);
    tr.onpointermove = move;
    tr.onpointerup = tr.onpointercancel = () => { tr.onpointermove = null; buzz(4); };
  });
  place();
}

// ---------- "Stands out" first (design/IMPROVE-2026-10-08/PLAN.md, Wave 1a Lane A) ----------
// The area palette of an old painting is varnish: "Dark black 36%, mahogany 31%…". The page now leads with the
// colors that make the painting itself: score = chroma x (1 - this painter's mean share of the hue) x the color's
// distance from the painting's mean, with a little weight for size and a penalty for repeating a pick. Half the
// slots go to those; the rest fill by area so the ground is still there. Each pick's share is then the area of
// every pool color nearest to it, so the percentages stay honest ("of the canvas", as photographed).
const glHueBin = (C, H) => C < 8 ? 12 : Math.floor(H / 30) % 12;   // 12 hue bins of 30°, plus the neutrals

// ---------- "Where is this color on the painting": a shared soft mask (David's audit, 2026-10-09, on Madrazo's
// "La Marquise d'Hervey Saint-Denys en Diane": "coarse blocky pixel clusters... reads as a glitch") ----------
// A real fix is superpixel segmentation (SLIC or similar, run once per painting and cached) or an ML object mask
// (SAM-style); both are evaluated separately (design/ -- too large to fold into this pass without a dedicated
// prototype). This is the achievable-now upgrade to the pixel-level read every painting already supports: a
// finer grid (litBuild, 320px not 140), a smooth ΔE falloff instead of a hard cut (so a mask edge fades rather
// than stair-steps), a one-pass speckle filter (an "on" pixel with fewer than 2 of 8 neighbors also "on" is
// almost always a stray misclustered pixel, not a real patch), then a small box blur on the alpha so the grid's
// own cell edges soften into the brushwork. Used by js/gallery.js's litDraw/litDrawHex and js/paintzoom.js's
// "Where" -- one mask, not two slightly-different copies.
function glMaskAlpha(P, hex) {
  const t = lab(hex), n = P.w * P.h, w = P.w, h = P.h, a = new Float32Array(n);
  const inner = 11, outer = 24;   // full match inside inner ΔE, faded out by outer ΔE, same radii the old hard cut used
  for (let j = 0; j < n; j++) {
    const dd = Math.hypot(P.L[j * 3] - t[0], P.L[j * 3 + 1] - t[1], P.L[j * 3 + 2] - t[2]);
    a[j] = dd <= inner ? 1 : dd >= outer ? 0 : 1 - (dd - inner) / (outer - inner);
  }
  const b = a.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x; if (b[j] <= .5) continue;
    let near = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && b[yy * w + xx] > .5) near++;
    }
    if (near < 2) a[j] = 0;   // an isolated "on" pixel: noise, not a patch -- drop it before the blur can smear it
  }
  const blur1 = (src, horiz) => {
    const out = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let d = -1; d <= 1; d++) {
        const xx = horiz ? x + d : x, yy = horiz ? y : y + d;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += src[yy * w + xx]; c++; }
      }
      out[y * w + x] = s / c;
    }
    return out;
  };
  return blur1(blur1(a, true), false);
}
// paints cv (sized to P) dark-and-dim everywhere except near hex -- "dim, not black" (David's audit): 170 max
// alpha over near-ink (14,13,11), not the old near-opaque 205, so the rest of the canvas stays legible underneath
function glPaintMask(cv, P, hex) {
  cv.width = P.w; cv.height = P.h;
  const x = cv.getContext("2d"), out = x.createImageData(P.w, P.h), a = glMaskAlpha(P, hex);
  for (let j = 0; j < P.w * P.h; j++) {
    const o = j * 4; out.data[o] = 14; out.data[o + 1] = 13; out.data[o + 2] = 11; out.data[o + 3] = Math.round((1 - a[j]) * 170);
  }
  x.putImageData(out, 0, 0);
}

// ---------- regions (Option A, David's palette-engine brief, 2026-10-09): SLIC + RAG-merge color regions,
// precomputed offline (tools/regions_build.py) into data/regions/d/NNN.json, same shard/order as data/gallery/
// so a painting's regions live at the same index. Each shard entry is null (no cached image, or nothing cleared
// the area floor) or { w, h, rle, regions: [{a: share, p: base64 pool (gallery.py's pack_pool scheme)}] }.
// Labels stay honest: "this area" -- a Background/Figure split was tested (region centroid vs the image center/
// border) and dropped, see the big comment at the top of regions_build.py for why (a surrounding background's
// centroid reads as "central" too, and unsupervised segmentation splits one person into several same-colored
// pieces rather than one "figure" blob) -- not reliable enough to name.
const GL_REGIONS_CACHE = new Map();   // shard index -> Promise<array>
function glRegionsShard(i) {
  const shard = Math.floor(i / GAL.shard);
  if (!GL_REGIONS_CACHE.has(shard)) {
    const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
    GL_REGIONS_CACHE.set(shard, fetch(`data/regions/d/${String(shard).padStart(3, "0")}.json${v}`).then(r => r.ok ? r.json() : null).catch(() => null));
  }
  return GL_REGIONS_CACHE.get(shard);
}
function glRegionsFor(i) {
  return glRegionsShard(i).then(arr => (arr && arr[i % GAL.shard]) || null);
}
// base64 bytes of (label, runlen) pairs -> a flat Uint8Array of w*h labels (tools/regions_build.py's rle_encode, mirrored)
function glRleDecode(b64, w, h) {
  let bin; try { bin = atob(b64); } catch (e) { return null; }
  const out = new Uint8Array(w * h);
  let o = 0;
  for (let i = 0; i + 1 < bin.length && o < out.length; i += 2) {
    const v = bin.charCodeAt(i), run = bin.charCodeAt(i + 1);
    for (let k = 0; k < run && o < out.length; k++) out[o++] = v;
  }
  return out;
}
// paints cv (sized to rd.w/rd.h, the small stored grid -- upsampled by the canvas's own CSS object-fit:contain,
// same trick glPaintMask relies on) dim everywhere except region regionLabel (1-based; grid value 0 = no region)
function glPaintRegionMask(cv, rd, regionLabel) {
  const w = rd.w, h = rd.h, labels = glRleDecode(rd.rle, w, h); if (!labels) return false;
  const n = w * h, a = new Float32Array(n);
  for (let j = 0; j < n; j++) a[j] = labels[j] === regionLabel ? 1 : 0;
  // a small box blur so the (already-small) grid's own cell edges don't stair-step when upsampled to screen size
  const blur1 = (src, horiz) => {
    const out = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let d = -1; d <= 1; d++) {
        const xx = horiz ? x + d : x, yy = horiz ? y : y + d;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += src[yy * w + xx]; c++; }
      }
      out[y * w + x] = s / c;
    }
    return out;
  };
  const sm = blur1(blur1(a, true), false);
  cv.width = w; cv.height = h;
  const x = cv.getContext("2d"), out = x.createImageData(w, h);
  for (let j = 0; j < n; j++) {
    const o = j * 4; out.data[o] = 14; out.data[o + 1] = 13; out.data[o + 2] = 11; out.data[o + 3] = Math.round((1 - sm[j]) * 170);
  }
  x.putImageData(out, 0, 0);
  return true;
}
// which region (1-based label, or 0 = none) sits at a fraction (fx,fy) of the image, 0..1 each way
function glRegionAt(rd, fx, fy) {
  const labels = glRleDecode(rd.rle, rd.w, rd.h); if (!labels) return 0;
  const x = Math.min(rd.w - 1, Math.max(0, Math.floor(fx * rd.w))), y = Math.min(rd.h - 1, Math.max(0, Math.floor(fy * rd.h)));
  return labels[y * rd.w + x];
}
// A region's own compact palette sheet (By area / Diverse / Stands out, the shared slider, every chip opening
// its color page in one tap) -- js/paintzoom.js's Region tool opens this once a tap lands on a region. The
// label always reads "this area": no Background/Figure guess (see tools/regions_build.py's own comment for why
// that was tested and dropped -- not reliable enough to name). onClose fires once, however the sheet closes
// (my own call, a swipe, or a scrim tap), so the caller can clear its highlight either way.
function glRegionSheet(region, onClose) {
  const pool = glPoolDecode(region.p);
  let curK = Math.min(6, pool.length), mode = "area", kCtl = null;
  const flatPrior = new Array(13).fill(0);   // a region has no painter/archive hue context, same fallback as js/studio.js's PV_FLAT_PRIOR
  const modeSet = (m, k) => {
    if (m === "area") return { pal: glPoolByArea(pool, k) };
    if (m === "diverse") return { pal: glPoolDiverse(pool, k) };
    if (m === "out") return { pal: glStandOut(pool, k, flatPrior) };
    return null;
  };
  const curSet = () => modeSet(mode, Math.min(curK, pool.length)) || modeSet("area", curK);
  const { sh, close } = sheet(`
    <div class="rgs-head"><b>This area</b><span>${Math.round(region.a * 100)}% of the canvas</span></div>
    <div class="seg rgs-modes" role="group" aria-label="Palette type">
      <button data-rgm="area" aria-pressed="true">By area</button>
      <button data-rgm="diverse" aria-pressed="false">Diverse</button>
      <button data-rgm="out" aria-pressed="false">Stands out</button>
    </div>
    <div class="pr-slide gl-slide rgs-slide" data-rgslide hidden><input type="range" data-rgk aria-label="How many colors"><span class="gl-kn-t" data-rgkn></span></div>
    <div class="palette gl-strip" data-rgswatches></div>
    <div class="pal-names" data-rgrows></div>
    <p class="fine">This painting's photograph, read just inside this one area. Regions are found by color, not by what they show -- so "this area" is honest where a guessed object name wouldn't be.</p>
  `, { lock: false });
  sh.classList.add("rgs-sheet", "gl-pal-ui");   // inherits the painting page's own slider/stepper/strip styling
  const draw = () => {
    const set = curSet(), pal = set.pal || [];
    sh.querySelectorAll("[data-rgm]").forEach(b => { const on = b.dataset.rgm === mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const slide = sh.querySelector("[data-rgslide]"), inp = slide.querySelector("input"), max = Math.max(2, Math.min(pool.length, 8)), kk = Math.min(Math.max(curK, 2), max);
    slide.hidden = pool.length <= 2;
    if (!slide.hidden) {
      if (!kCtl) kCtl = countify(inp, { min: 2, max, value: kk, out: sh.querySelector("[data-rgkn]"), onSet: (v, final) => { curK = v; draw(); if (final) buzz(5); } });
      else { kCtl.range(2, max); kCtl.set(kk); }
    }
    sh.querySelector("[data-rgkn]").textContent = kk + " colors";
    sh.querySelector("[data-rgswatches]").innerHTML = pal.map(p => `<button class="pal" data-swatch="${p.h}" style="--c:${p.h};flex:${(Math.max(p.share, .08) * 100).toFixed(1)}" data-ink="${ink(p.h)}" aria-label="${esc(nameOf(p.h).n)}"><span>${p.share < .005 ? "<1%" : Math.round(p.share * 100) + "%"}</span></button>`).join("");
    sh.querySelector("[data-rgrows]").innerHTML = pal.map(p => {
      const nm = glName(p.h), fam = !nm.sub && typeof familyOf === "function" && familyOf(p.h);
      const sub = [nm.sub ? nm.sub.charAt(0).toUpperCase() + nm.sub.slice(1) : fam ? fam.head.n + " family" : "", glPctTxt(p.share)].filter(Boolean).join(" · ");
      return `<button class="pal-name" data-swatch="${p.h}"><i style="--c:${p.h}" data-ink="${ink(p.h)}"></i><b>${esc(nm.t)}</b><span>${esc(sub)}</span><em class="mono">${p.h}</em></button>`;
    }).join("");
  };
  sh.querySelector(".rgs-modes").onclick = e => { const b = e.target.closest("[data-rgm]"); if (!b || b.dataset.rgm === mode) return; mode = b.dataset.rgm; buzz(5); draw(); };
  draw();
  if (onClose) {
    const mo = new MutationObserver(() => { if (!sh.isConnected) { mo.disconnect(); onClose(); } });
    mo.observe(document.body, { childList: true });
  }
  return close;
}

// ---------- a plain color readout, no quiz (David's palette-engine brief, 2026-10-09, D+E): "the press-and-
// slide loupe doesn't exist on the painting page" / "selecting a color takes you directly to a guessing game;
// it should just let me select any color". Wired from js/eyedrop.js's onPick on the painting's main image and
// in Look closer (js/paintzoom.js) -- the same small sheet either way. The guessing game (js/isolate.js isoOpen)
// stays reachable only from the explicit "Test yourself" fold, never from a plain tap or drag any more.
// ctx: { i, d, pool, pal, picks, onAdd(hex), locateHex(hex) } -- all optional; the sheet degrades gracefully
// (no "add"/"where" buttons) when a caller doesn't have a palette or a paintable canvas to offer them against.
function glColorReadout(hex, ctx = {}) {
  hex = String(hex).toUpperCase();
  const nm = typeof nameOf === "function" ? nameOf(hex) : null;
  const near = ctx.pal && ctx.pal.length ? glNearestSwatch(ctx.pal, hex) : null;
  const matchPct = near && near.de < NEAR_DE ? Math.max(1, Math.round((1 - near.de / NEAR_DE) * 100)) : null;
  const title = nm && nm.n ? nm.n : "Your color";
  const descLine = nm && nm.between ? `Between ${esc(nm.between.a.toLowerCase())} and ${esc(nm.between.b.toLowerCase())}`
    : nm && nm.mod ? esc(nm.text) : "";
  const { sh, close } = sheet(`
    <div class="pk-hero" style="--c:${hex}" data-ink="${ink(hex)}"></div>
    <div class="cp-sheet-title"><h2>${esc(title)}</h2><span class="mono">${hex}</span></div>
    ${descLine ? `<p class="cp-sheet-desc">${descLine}</p>` : ""}
    ${matchPct != null ? `<p class="cp-sheet-desc">${matchPct}% match to ${esc(nameOf(ctx.pal[near.i].h).n)} in this painting's palette</p>` : ""}
    <button class="cp-primary cp-sheet-primary" data-gcr-open>${nm && nm.n ? `Open ${esc(nm.n)}` : "See this color"}${ICON.arrow}</button>
    <div class="cp-sheet-links">
      ${ctx.locateHex ? `<button class="cp-link" data-gcr-where>Where else in this painting</button>` : ""}
      ${ctx.onAdd ? `<button class="cp-link" data-gcr-add>Add to this palette</button>` : ""}
      <button class="cp-link" data-gcr-copy>Copy hex</button>
    </div>
    <p class="fine">Sampled from the museum's photograph; screen colors are approximate.</p>`);
  sh.classList.add("sw-sheet", "gcr-sheet");
  sh.querySelector("[data-gcr-open]").onclick = () => { close(); if (typeof openTappedColor === "function") openTappedColor(hex); };
  const whereBtn = sh.querySelector("[data-gcr-where]");
  if (whereBtn) whereBtn.onclick = () => { buzz(5); ctx.locateHex(hex); close(); };
  const addBtn = sh.querySelector("[data-gcr-add]");
  if (addBtn) addBtn.onclick = () => { buzz(5); ctx.onAdd(hex); addBtn.textContent = "Added"; addBtn.disabled = true; };
  const copyBtn = sh.querySelector("[data-gcr-copy]");
  if (copyBtn) copyBtn.onclick = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(hex).catch(() => {});
    copyBtn.textContent = "Copied"; setTimeout(() => { copyBtn.textContent = "Copy hex"; }, 1400);
  };
}
let GL_HUE_ALL = null;
const GL_HUE_PAINTER = new Map();     // painter slug -> mean hue-bin shares over their paintings (null while loading)
function glHueShares(list) {
  const acc = new Array(13).fill(0); let n = 0;
  for (const i of list) { for (let j = 0; j < 6; j++) { const k = i * 6 + j; acc[glHueBin(GAL.ch[k], GAL.hu[k])] += GAL.sh[k]; } n++; }
  return acc.map(v => v / (n || 1));
}
const glHueAll = () => GL_HUE_ALL || (GL_HUE_ALL = glHueShares(Array.from({ length: GAL.n }, (_, i) => i)));
// this painter's hue habits (data/artists/p/<slug>.json lists their paintings), loaded through js/artwiki.js when it's there
function glPainterHue(name) {
  if (!name || typeof awLoad !== "function" || typeof awPainterLoad !== "function") return Promise.resolve(null);
  const slug = routeSlug(name);
  if (GL_HUE_PAINTER.has(slug)) return Promise.resolve(GL_HUE_PAINTER.get(slug));
  return awLoad().then(() => typeof awHasPainter === "function" && awHasPainter(slug) ? awPainterLoad(slug) : null)
    .then(x => { const ix = x && x.P && x.P.ix; const h = ix && ix.length >= 3 ? glHueShares(ix.filter(i => i >= 0 && i < GAL.n)) : null; GL_HUE_PAINTER.set(slug, h); return h; })
    .catch(() => null);
}
function glStandOut(pool, k, prior) {
  if (!pool.length) return [];
  const P = pool.map(p => { const l = lab(p.h), c = lch(p.h); return { h: p.h, share: p.share, lab: l, L: c[0], C: c[1], bin: glHueBin(c[1], c[2]) }; });
  const tot = P.reduce((a, p) => a + p.share, 0) || 1, m = [0, 1, 2].map(x => P.reduce((a, p) => a + p.share * p.lab[x], 0) / tot);
  const pr = prior || glHueAll(), picked = [], nOut = Math.min(Math.ceil(k / 2), k);
  const nearest = p => picked.length ? Math.min(...picked.map(q => de2000(q.lab, p.lab))) : 99;
  const left = P.filter(p => p.L >= 20 || p.C >= 25);   // never a near-black as a "stands out" pick
  while (picked.length < nOut && left.length) {
    let bi = -1, bs = 0;
    left.forEach((p, j) => {
      const near = nearest(p); if (near < 10) return;
      const away = Math.hypot(p.lab[0] - m[0], p.lab[1] - m[1], p.lab[2] - m[2]);
      const s = (p.C + 10) * (1 - Math.min(.9, pr[p.bin])) * away * Math.pow(Math.max(p.share, .001), .2) * Math.min(1, near / 25);
      if (s > bs) { bs = s; bi = j; }
    });
    if (bi < 0) break;
    picked.push(Object.assign(left.splice(bi, 1)[0], { out: true }));
  }
  const rest = P.filter(p => !picked.includes(p)).sort((a, b) => b.share - a.share);
  for (const minDE of [6, 0]) for (const p of rest) { if (picked.length >= k) break; if (!picked.includes(p) && nearest(p) >= minDE) picked.push(p); }
  // each pick's area: every pool color goes to its nearest pick
  const area = picked.map(() => 0);
  P.forEach(p => { let b = 0, bd = Infinity; picked.forEach((q, j) => { const d = de2000(q.lab, p.lab); if (d < bd) { bd = d; b = j; } }); area[b] += p.share; });
  return picked.map((p, j) => ({ h: p.h, share: area[j] / tot, out: !!p.out }));
}
// the chip's name: the nearest Learn-layer name (never "between X and Y", which moves to the subline), and no
// modifier that says nothing ("Dark black", "Pale white")
function glName(h) {
  const nm = nameOf(h);
  if (nm.between) return { t: nm.n, sub: `between ${nm.between.a.toLowerCase()} and ${nm.between.b.toLowerCase()}`, n: nm.n };
  let t = nm.text;
  if (nm.mod) { const L = lch(nm.h)[0]; if ((L < 22 && /^(dark|deep|pale|light)$/.test(nm.mod)) || (L > 90 && /^(pale|light|dark|deep)$/.test(nm.mod))) t = nm.n; }
  return { t, sub: "", n: nm.n };
}
const glPctTxt = s => s < .005 ? "under 1%" : Math.round(s * 100) + "%";
// js/thingquiz.js + css/thingquiz.css: listed in index.html once the conductor adds the tags; until then (and if a
// cached index.html lacks them) they load here, once, the moment a painting page opens
let GL_TQ = null;
function glQuizLoad() {
  if (typeof thingQuiz === "function") return Promise.resolve();
  const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  return GL_TQ || (GL_TQ = new Promise((res, rej) => {
    if (!document.querySelector('link[href^="css/thingquiz.css"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/thingquiz.css" + v; document.head.appendChild(l); }
    const s = document.createElement("script"); s.src = "js/thingquiz.js" + v; s.onload = res; s.onerror = () => { GL_TQ = null; rej(new Error("thingquiz")); }; document.head.appendChild(s);
  }));
}

// ---------- palette types: many palettes from one painting (David, 2026-10-08) ----------
// Each type is a different question asked of the same measured pool: the shares are always the colors' share of the
// whole canvas, as photographed. glModeSet() returns { pal, max, fixed?, cap? } or null when this painting has none.
// [key, chip label, the full caption (a tap on the one-line caption opens it), the one-line caption]
const GL_MODES = [
  ["out", "Stands out", "The colors that make this painting itself: vivid, rare for this painter and far from the picture's average.", "Vivid and rare for this painter"],
  ["area", "By area", "Every color sized by how much of the picture it covers.", "Sized by how much of the canvas each covers"],
  ["diverse", "Diverse", "One color from every distinct family in the picture, however small — nothing gets crowded out.", "One from every distinct family, however small"],
  ["lights", "Lights", "Only the light colors: highlights and pale grounds.", "Only the lights: highlights and pale grounds"],
  ["mids", "Mid-tones", "Only the middle values, between the lights and the darks.", "Only the middle values"],
  ["shadows", "Shadows", "Only the dark colors.", "Only the dark colors"],
  ["accents", "Accents", "Small, vivid areas set against the bigger colors.", "Small, vivid areas against the bigger colors"],
  ["hidden", "Hidden colors", "Quiet and rare, from another family than the rest, like the greens under skin.", "Quiet, rare, from another family"],
  ["focal", "Focal", "The color where the eye lands first, with its closest neighbors.", "Where the eye likely lands first, and its kin"],
  ["skin", "Skin tones", "The flesh colors, where there is a figure.", "The flesh colors"],
  ["warm", "Warm only", "Only the warm colors: reds, oranges and yellows.", "Only reds, oranges and yellows"],
  ["cool", "Cool only", "Only the cool colors: greens, blues and violets.", "Only greens, blues and violets"],
  ["ladder", "Value ladder", "Five steps from light to dark, each the average of the colors in that band.", "Five value steps, light to dark"],
  ["harmony", "Harmony", "The painting's main hue with its strongest partners.", "The main hue and its strongest partners"],
  ["pick", "Pick from it", "", ""],
];
// which palette types are worth a chip for THIS painting: Stands out, By area and Pick from it always pin (they
// are general-purpose, not readings), plus up to two readings scored by how distinct/meaningful they are here —
// a night scene's Shadows and Hidden colors beat a daylit scene's, a portrait's Skin and Focal beat a still
// life's. Everything else sits behind "More" so the row never again shows all 14 at once (David, 2026-10-09).
const GL_PINNED_MODES = ["out", "area", "diverse", "pick"];
function glChipScore(key, row) {
  const st = row && row.stat;
  switch (key) {
    case "accents": return row && row.acc && row.acc.length ? 9 : 2;
    case "hidden": return row && row.hid && row.hid.length ? 9 : 1;
    case "focal": return row && row.foc != null ? 8 : 0;
    case "skin": return 7;
    case "shadows": return st ? (st.key === "low" ? 7 : 2) : 3;
    case "lights": return st ? (st.key === "high" ? 7 : 2) : 3;
    case "warm": case "cool": return st ? Math.round(Math.abs(st.wf / 1000 - .5) * 12) : 3;
    case "harmony": return 4;
    case "ladder": return 3;
    case "mids": return 1;
  }
  return 0;
}
function glPickChips(have, row, open) {
  if (open) return { shown: have, moreCount: 0 };
  const pinned = have.filter(m => GL_PINNED_MODES.includes(m[0]));
  const rest = have.filter(m => !GL_PINNED_MODES.includes(m[0])).map(m => ({ m, s: glChipScore(m[0], row) })).sort((a, b) => b.s - a.s);
  const topKeys = new Set(rest.slice(0, 5 - pinned.length).map(r => r.m[0]));
  const shown = have.filter(m => GL_PINNED_MODES.includes(m[0]) || topKeys.has(m[0]));
  return { shown, moreCount: have.length - shown.length };
}
function glModeSet(m, pool, k, row) {
  if (!pool.length) return null;
  const P = pool.map(p => { const c = lch(p.h); return { h: p.h, share: p.share, L: c[0], C: c[1], H: c[2] }; });
  const tot = P.reduce((a, p) => a + p.share, 0) || 1;
  const warm = p => p.C >= 8 && (p.H >= 330 || p.H < 100), cool = p => p.C >= 8 && p.H >= 100 && p.H < 330;
  const sub = (f, min) => { const S = P.filter(f); return S.length >= 2 && S.reduce((a, p) => a + p.share, 0) / tot >= min ? S : null; };
  const fromSub = S => {
    if (!S) return null;
    const picks = glPoolPick(S.map(p => ({ h: p.h, share: p.share })), Math.min(k, S.length)), area = picks.map(() => 0);
    S.forEach(p => { let b = 0, bd = 1e9; picks.forEach((q, j) => { const dd = de2000(q.h, p.h); if (dd < bd) { bd = dd; b = j; } }); area[b] += p.share; });
    return { pal: picks.map((q, j) => ({ h: q.h, share: area[j] / tot })).sort((a, b) => b.share - a.share), max: Math.min(S.length, 24) };
  };
  const raw = (arr, cap) => arr.length ? { pal: arr.map(p => ({ h: p.h, share: p.share / tot })), max: arr.length, fixed: true, cap } : null;
  switch (m) {
    case "lights": return fromSub(sub(p => p.L >= 65, .03));
    case "mids": return fromSub(sub(p => p.L >= 35 && p.L < 65, .03));
    case "shadows": return fromSub(sub(p => p.L < 35, .03));
    case "warm": return fromSub(sub(warm, .03));
    case "cool": return fromSub(sub(cool, .03));
    case "skin": return fromSub(sub(p => p.C >= 10 && p.C <= 50 && p.H >= 15 && p.H <= 65 && p.L >= 30 && p.L <= 88, .04));
    // Accents and Hidden colors (David's palette-engine brief, 2026-10-09: "a slider for all of them", objectives
    // v and vi): live-filtered and sliced to k, like every other mode now, rather than a fixed small list. The
    // offline analysis's own short pick (row.acc/row.hid, 2-3 indices) still seeds the ordering when it's there
    // (it's a slightly pickier read -- against the painter's own habits, not just this canvas) but never caps it.
    case "accents": {
      const seed = row && row.acc ? row.acc.map(j => P[j]).filter(Boolean) : [];
      const rest = P.filter(p => p.C >= 24 && p.share < .08 && p.L >= 18 && !seed.includes(p)).sort((x, y) => y.C * (1 - y.share) - x.C * (1 - x.share));
      const a = [...seed, ...rest];
      return a.length ? { pal: a.slice(0, k).map(p => ({ h: p.h, share: p.share / tot })), max: Math.min(a.length, 20),
        cap: "Small, vivid areas set against the bigger colors." } : null;
    }
    case "hidden": {
      const domFam = row && row.stat && row.stat.df;
      const seed = row && row.hid ? row.hid.map(j => P[j]).filter(Boolean) : [];
      const rest = P.filter(p => p.C >= 6 && p.C < 26 && p.share < .1 && !seed.includes(p) && (!domFam || (typeof familyOf !== "function" || !familyOf(p.h) || familyOf(p.h).head.n !== domFam)))
        .sort((x, y) => x.share - y.share);
      const h = [...seed, ...rest];
      return h.length ? { pal: h.slice(0, k).map(p => ({ h: p.h, share: p.share / tot })), max: Math.min(h.length, 20),
        cap: "Quiet and rare, from another family than the rest, like the greens under skin." } : null;
    }
    case "focal": {
      const f = row && row.foc != null && P[row.foc]; if (!f) return null;
      const near = P.filter(p => p !== f && de2000(p.h, f.h) < 22).sort((x, y) => de2000(x.h, f.h) - de2000(y.h, f.h)).slice(0, 4);
      return raw([f, ...near], "The color where the eye lands first (a computed guess, not eye-tracking), with its closest neighbors.");
    }
    case "ladder": {
      const bands = [[80, 101], [60, 80], [40, 60], [20, 40], [-1, 20]], pal = [];
      bands.forEach(([lo, hi]) => {
        const S = P.filter(p => p.L >= lo && p.L < hi), t = S.reduce((a, p) => a + p.share, 0); if (!S.length || t / tot < .004) return;
        const l = S.reduce((a, p) => { const x = lab(p.h); return [a[0] + x[0] * p.share, a[1] + x[1] * p.share, a[2] + x[2] * p.share]; }, [0, 0, 0]).map(v => v / t);
        pal.push({ h: labHex(l[0], l[1], l[2]), share: t / tot });
      });
      return pal.length >= 3 ? { pal, max: 5, fixed: true } : null;
    }
    // Harmony: now k-driven too (objective vii, ATLAS chord ideas) -- the dominant hue and its strongest
    // complement always come first when there is one, then as many more well-spaced, strong partners (by share x
    // chroma) as k and the pool allow: a short count stays a clean pair/triad, a long one grows into a fuller
    // analogous-plus-complement chord rather than just repeating the same two colors.
    case "harmony": {
      const C = P.filter(p => p.C >= 14); if (C.length < 2) return null;
      const dom = C.reduce((a, p) => p.share > a.share ? p : a), dh = p => { const x = Math.abs(p.H - dom.H) % 360; return x > 180 ? 360 - x : x; };
      const strong = (f) => C.filter(f).sort((x, y) => y.share * y.C - x.share * x.C);
      const comp = strong(p => dh(p) >= 145)[0], pal = [dom];
      if (comp) pal.push(comp);
      strong(p => p !== dom && p !== comp).forEach(p => { if (pal.length < k && pal.every(q => de2000(q.h, p.h) > 8)) pal.push(p); });
      if (pal.length < 2) return null;
      return { pal: pal.map(p => ({ h: p.h, share: p.share / tot })), max: Math.min(C.length, 20),
        cap: `The main hue (${nameOf(dom.h).n.toLowerCase()})${comp ? ", its strongest complement" : ", with no strong complement in this one"}, and the neighbors that sit beside it on the wheel.` };
    }
  }
  return null;
}

// ---------- the lite painting page ----------
// fromHex: the color the visitor arrived from (a search, a color page's "In paintings", a name page, or the
// color sheet's "More paintings with this color") — ROADMAP §13 "arrive from a color and see it". Carried in
// the address (?c=<hex>, js/router.js) so it survives reload and Back. Arriving from a pair/set page
// (js/setpage.js) it is an array, the whole set: ptArrival (js/paintingsof.js) measures and shows every one.
// "On the painting" (David, 2026-10-08): one control for where each palette color sits. Markers put a numbered dot
// at each color's main places; Highlight dims everything else. Remembered across paintings in S.glWhere.
// The painting page dropped this switch (David, 2026-10-09: redundant once a swatch tile locates itself on tap —
// see toggleLocate/litDraw in glPage); js/studio.js's photo palette still uses the constant and its own markers.
const GL_WHERE = [["off", "Off"], ["mark", "Markers"], ["lit", "Highlight"]];
// a scrolling chip row fades only at the edge where more chips are hiding
function glFadeEdges(wrap, row) {
  if (!wrap || !row) return;
  const max = row.scrollWidth - row.clientWidth;
  wrap.classList.toggle("fl", row.scrollLeft > 4);
  wrap.classList.toggle("fr", row.scrollLeft < max - 4);
}
function galleryPage(i, push = true, fromHex = null, tol = null) {
  if (!GAL) return loadGallery().then(() => galleryPage(i, push, fromHex, tol)).catch(() => toast("The gallery didn't load"));
  if (!(i >= 0 && i < GAL.n)) return;
  // already loaded (always the case going back): draw now, so the phone's back gesture handling stays in step
  const now = glDetailNow(i);
  if (now) { if (push) XSTACK.push("g:" + i); return glPage(i, now, fromHex, tol); }
  glDetail(i).then(d => {
    if (push) XSTACK.push("g:" + i);
    glPage(i, d, fromHex, tol);
  }).catch(() => toast("This painting didn't load"));
}
function glPage(i, d, fromHex, tol) {
  // fromHex is one hex, or (arriving from a pair/set page) the whole set: keep the array for ptArrival
  // (js/paintingsof.js), but a single hex for anything here that only ever highlighted one swatch.
  const fromPrimary = Array.isArray(fromHex) ? fromHex[0] : fromHex;
  const G = GAL, src = G.src[G.mus[i]] || { name: "Museum", short: "Museum", credit: "" }, pal6 = glPal(i), yr = glYear(i), ar = G.ar[i];
  const pool = glPoolDecode(d.pl);
  let curK = 6;   // the "How many colors" slider; every palette type draws that many (up to what it has)
  let kCtl = null;   // the countify() controller for [data-glk], built once, re-ranged per mode (js/core.js)
  let mode = "out";   // the palette type (GL_MODES); "out" = stands out first (the default)
  let prior = null;    // this painter's hue habits once they load (glPainterHue); the archive's until then
  let row = null;      // this painting's analysis row once it loads (accents, hidden, focal)
  const picks = [];    // "Pick from the painting": colors the visitor tapped
  const lit = { ok: false, img: null, pix: null };   // the photo's pixels, once the host lets a canvas read them
  let capOpen = false;
  let modesOpen = false;   // "at most 5 chips, chosen per painting, plus More" (David, 2026-10-09)
  let locate = null;       // a palette swatch tapped on the strip: { j, hex } — dims the rest, glows where it sits
  let painterOrder = null, painterRank = -1;   // this painter's paintings (chronological if dated), once loaded — swipe the picture to move along it
  const modeSet = (m, k) => {
    if (m === "out") return { pal: glStandOut(pool.length ? pool : pal6, pool.length ? k : 6, prior), max: pool.length ? Math.min(pool.length, 20) : 6 };
    if (m === "area") return { pal: pool.length ? glPoolByArea(pool, k) : pal6, max: pool.length ? Math.min(pool.length, 20) : 6 };
    if (m === "diverse") return { pal: pool.length ? glPoolDiverse(pool, k) : pal6, max: pool.length ? Math.min(pool.length, 20) : 6 };
    if (m === "pick") return { pal: picks.map(h => ({ h, share: 1 / picks.length, pick: true })), max: 12, fixed: true,
      cap: !lit.ok ? "This museum's image can't be read here, so tapping the painting can't pick colors from it. Every other palette type still works." : picks.length ? "Colors you took from the painting. Tap the picture for more, a swatch to open its page." : "Tap the painting to take a color, up to 12." };
    return glModeSet(m, pool, k, row);
  };
  const curSet = () => modeSet(mode, curK) || modeSet("out", curK);
  const curPal = () => curSet().pal;
  // the ColorSet verbs (js/colorset.js): this painting's palette, at whatever size the slider shows. Declared
  // early so both the action row and the coverage row's Learn button (David, 2026-10-09) can use it.
  const glSet = () => colorSet({ kind: "painting", id: "g" + i, title: d.t, colors: curPal().map(p => ({ h: p.h, share: p.share })), src: "gallery/" + i,
    ...(pool.length > 3 && (mode === "out" || mode === "area") && typeof csPoolPick === "function" ? { pick: csPoolPick(pool), max: pool.length } : {}) });
  const dom = pal6.reduce((a, b) => b.share > a.share ? b : a).h;
  // the surround behind the picture (when it doesn't fill the full width) tints with the painting's own average
  // color, not black (David's rebuild brief, 2026-10-09) — G.mean is the true pixel-weighted mean, in Lab
  const avg = (typeof G.mean !== "undefined" && G.mean) ? labHex(G.mean[i * 3], G.mean[i * 3 + 1], G.mean[i * 3 + 2]) : dom;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><div class="art-top-r">${d.rec ? `<a class="glass-pill" href="${esc(d.rec)}" target="_blank" rel="noopener">${GL_ICON_OUT}<span>${esc(src.short)}</span></a>` : ""}${typeof fvArtHeart === "function" ? fvArtHeart(d.id) : ""}</div></header>
    <div class="gl-pal-wrap">
    <div class="gl-hero gl-full-w" style="--c:${avg}"><span style="width:min(100%, calc(62dvh / ${ar.toFixed(3)}));aspect-ratio:${(1 / ar).toFixed(4)}"><img src="${esc(glBig(d.img))}" alt="${esc(d.t)}${d.a ? " by " + esc(d.a) : ""}"${glCropStyle(i, d, ar)}${d.hi ? ` data-hi="${esc(d.hi)}"` : ""}${glCORS(glBig(d.img))}><canvas class="gl-lit-cv" data-gllitcv aria-hidden="true"${glCropStyle(i, d, ar)}></canvas>
    <button class="gl-closer" data-glcloser>${ICON.search}<span>Look closer</span></button>
    <button class="gl-closer gl-pick-btn" data-glpickbtn hidden aria-pressed="false">${icon("pipette", 17)}<span>Pick a color</span></button></span></div>
    <div class="gl-id">
    <p class="eyebrow p-type">Painting${yr ? " · " + yr : ""}</p>
    <h1 class="p-title">${esc(d.t)}</h1>
    <p class="p-dek">${esc([d.a || "Artist unknown", d.co, d.mv].filter(Boolean).join(" · "))}</p>
    <p class="gl-id-src">${d.rec ? `<a href="${esc(d.rec)}" target="_blank" rel="noopener">${esc(src.name)}</a>` : esc(src.name)}</p>
    <div class="gl-why" data-glwhy hidden></div>
    </div>
    <div class="gl-pal-ui">
    <div class="palette gl-strip" data-glswatches></div>
    <div class="gl-modes-f" data-glfade><div class="gl-modes" data-glorder role="group" aria-label="Palette type"></div></div>
    <div class="pr-slide gl-slide" data-glslide hidden><input type="range" data-glk aria-label="How many colors"><span class="gl-kn-t" data-glkn>6 colors</span></div>
    <p class="gl-locate" data-gllocate hidden></p>
    <p class="gl-cap" data-glcap></p>
    <div class="pal-names" data-glrows></div>
    <div class="pt-arrive gl-arrive" data-glarrive hidden></div>
    <div class="gl-cov" data-glcov></div>
    <div data-csacts></div>
    ${!S.pmMapHintSeen ? `<p class="gl-pmap-hint" data-glpmhint><i aria-hidden="true"></i><span>New: browse paintings by how alike their colors are</span></p>` : ""}
    <button class="gl-pmap gl-pmap-top" data-pmap="arr=spiral&seed=${i}">${GL_ICON_MAP}<span>Similar paintings on the map</span>${ICON.chev}</button>
    </div></div>
    <div class="gl-under">${glSmall(d) && !d.hi && d.rec ? `<a class="gl-full" href="${esc(d.rec)}" target="_blank" rel="noopener">Full size at the museum ↗</a>` : ""}</div>
    <div class="gl-finds"><div class="sec-head"><b>Findings</b><span>as photographed</span></div>
    <div class="gl-roles" data-glroles></div>
    <div class="aw-cx" data-glctx></div>
    <p class="fine">Computed by ColorHub, not by the museum, from its photograph. Names are the nearest of about 1,000. Old varnish and the photograph shift color, and screens differ.</p>
    <details class="gl-finds-more"><summary>More</summary><div data-awan></div></details></div>
    <div class="gl-morepainter" data-glmorepainter></div>
    ${typeof twSection === "function" ? `<div data-glsim></div>` : `<div class="sec-head gl-sim-h"><b>Similar palettes</b><span>by color, not subject</span></div>
    <div class="gl-rail" data-glsim></div>`}
    <button class="gl-pmap" data-pmap="arr=spiral&seed=${i}">${GL_ICON_MAP}<span>Similar paintings, on the map</span>${ICON.chev}</button>
    <section class="srcs"><h3>Image and data</h3><ul><li>${d.rec ? `<a href="${esc(d.rec)}" target="_blank" rel="noopener">${esc(src.name)}</a>` : esc(src.name)}${src.credit ? ` · ${esc(src.credit)}` : ""}</li><li>Palette and color names computed by ColorHub from the museum's image</li></ul></section>
    <details class="gl-quiz-fold"><summary>Test yourself</summary><div class="gl-quiz" data-glquiz></div></details>
  `, "article gl-page");
  const route = "#/gallery/" + i, heroSpan = el.querySelector(".gl-hero > span");
  // first-run hint (David, 2026-10-09: "it should be more prominent"), once -- same "fades out at the first touch
  // anywhere" pattern as the honeycomb's own first-run hint (js/learn.js lrMapHint), but inline beside the button
  // itself (not position:fixed) since this page scrolls and the button isn't pinned to one spot on screen
  const pmHint = el.querySelector("[data-glpmhint]");
  if (pmHint) {
    S.pmMapHintSeen = 1; save();   // shown once ever, not "until dismissed" -- a later open never shows it again
    const dismiss = () => {
      document.removeEventListener("pointerdown", dismiss, true);
      if (!pmHint.isConnected) return;
      pmHint.classList.add("out"); later(() => pmHint.remove(), reduceMotion ? 0 : 320);
    };
    document.addEventListener("pointerdown", dismiss, true);
  }
  // "You can name 4 of 6" (js/coverage.js) for the colors on screen, one name each, and "Learn the rest"
  const drawCov = pal => {
    const host = el.querySelector("[data-glcov]");
    if (!host || typeof setCoverage !== "function" || typeof coverageRing !== "function") return;
    const seen = new Set(), items = [];
    pal.forEach(p => { const nm = nameOf(p.h); if (nm.n && nm.de < NEAR_DE && !seen.has(nm.n)) { seen.add(nm.n); items.push({ n: nm.n, h: p.h }); } });
    if (items.length < 2) { host.innerHTML = ""; return; }
    const cov = setCoverage(items), rest = items.filter(x => { try { return typeof knowState !== "function" || knowState(x) !== "yours"; } catch (e) { return true; } });
    // a quiet row right by the palette, not a boast (David's rebuild brief, 2026-10-09). Learn lives here now,
    // not in the action row below — and targets whatever's actually left to learn, known or not yet started
    host.innerHTML = `${coverageRing(cov, { size: 40, stroke: 4 })}<span><b>Learn the colors here</b><em>${cov.yours === cov.total ? "Every name here is yours." : `${cov.yours} of ${cov.total} so far — the rest, once recalled on a later day.`}</em></span>${rest.length && typeof prQuick === "function" ? `<button class="gl-cov-go" data-glrest>${cov.yours ? "Learn the rest" : "Learn"}</button>` : ""}`;
    const go = host.querySelector("[data-glrest]");
    if (go) go.onclick = () => prQuick({ items: rest.map(x => x.h), label: d.t, src: "painting", route });
  };
  // the palette strip + named rows + arrival line, redrawn whenever the slider's size changes
  const drawPalette = () => {
    const set = curSet(), pal = set.pal;
    drawModes(set);
    const near = fromPrimary ? glNearestSwatch(pal, fromPrimary) : null;
    // the strip swatch locates (dims the rest, glows where it sits); its NAME, below, still opens the color page
    // (app rule kept, just split between the two halves of the same chip — David's rebuild brief, 2026-10-09)
    // Each strip chip now opens its color's page in one tap, the app-wide rule (CLAUDE.md "one tap on any color
    // opens its page"; David, relayed 2026-10-09: "usually tapping a color should open the color, not the
    // segmentation of it") -- data-swatch hands that straight to the global delegate (js/swatch.js), no local
    // code needed. "Where this sits on the painting" moves to the small glyph in the corner, a second, explicit
    // gesture (swatch.js's own long-press is already claimed app-wide for "add to a set" -- js/settray.js -- so
    // this can't reuse that slot): tapping it toggles the dim-and-glow locate view, same as the whole chip used to.
    // the locate glyph carries the index on data-locate itself (NOT a second data-glj) -- a chip's own [data-glj]
    // must stay a one-element-per-color selector; tools/smoke/scenarios.js and this file's own curPal-size
    // checks both count by it
    el.querySelector("[data-glswatches]").innerHTML = pal.map((p, j) => `<button class="pal${near && near.i === j ? " on" : ""}${p.out ? " gl-out" : ""}${locate && locate.j === j ? " loc" : ""}" data-glj="${j}" data-swatch="${p.h}" style="--c:${p.h};flex:${(Math.max(p.share, .08) * 100).toFixed(1)}" data-ink="${ink(p.h)}" aria-label="${esc(nameOf(p.h).n)}"><span>${p.pick ? "" : p.share < .005 ? "<1%" : Math.round(p.share * 100) + "%"}</span><i class="pal-where" data-locate="${j}" tabindex="0" role="button" aria-pressed="${locate && locate.j === j}" aria-label="Where ${esc(nameOf(p.h).n)} is on the painting">${GL_WHERE_ICON}</i></button>`).join("");
    el.querySelector("[data-glrows]").innerHTML = pal.map((p, j) => {
      const nm = glName(p.h), fam = !nm.sub && !p.out && typeof familyOf === "function" && familyOf(p.h);
      const sub = [p.out ? "Stands out" : nm.sub ? nm.sub.charAt(0).toUpperCase() + nm.sub.slice(1) : fam ? fam.head.n + " family" : "", p.pick ? "Picked" : glPctTxt(p.share)].filter(Boolean).join(" · ");
      return `<button class="pal-name${near && near.i === j ? " on" : ""}" data-swatch="${p.h}" data-glj="${j}"><i style="--c:${p.h}" data-ink="${ink(p.h)}"></i><b>${esc(nm.t)}</b><span>${esc(p.out && nm.sub ? sub + " · " + nm.sub : sub)}</span><em class="mono">${p.h}</em></button>`;
    }).join("");
    drawCov(pal);
    const arrive = el.querySelector("[data-glarrive]");
    if (typeof ptArrival === "function") { /* the arriving color is drawn by js/paintingsof.js (L26) */ }
    else if (!fromHex) { arrive.hidden = true; }
    else if (near && near.de < NEAR_DE) {
      const p = pal[near.i], nm = nameOf(p.h);
      arrive.hidden = false; arrive.innerHTML = `<i style="--c:${p.h}" class="gl-arrive-sw"></i>≈ ${esc(nm.text)} · ${Math.round(p.share * 100)}% of the canvas · nearest swatch`;
    } else {
      const nm = near ? nameOf(pal[near.i].h) : null;
      arrive.hidden = false; arrive.textContent = nm ? `No close swatch; the nearest is ${nm.text}, ${pctDiff(near.de)}.` : "No close swatch in this palette.";
    }
    if (el._awPal && pal.length) el._awPal(pal);   // the Analysis readings follow the palette on screen (js/artwiki.js)
    litDraw(pal); drawLocate(pal);
    const acts = el.querySelector("[data-csacts]"); if (acts) acts.hidden = !pal.length;
  };
  // the palette types as one row of chips, only the ones this painting has; the slider and caption follow the type
  const drawModes = set => {
    const have = GL_MODES.filter(m => m[0] === "out" || m[0] === "area" || m[0] === "pick" || (m[0] === "diverse" && pool.length > 1) || (pool.length && glModeSet(m[0], pool, 6, row)));
    const { shown, moreCount } = glPickChips(have, row, modesOpen);
    const host = el.querySelector("[data-glorder]"), key = shown.map(m => m[0]).join() + "|" + moreCount;
    if (host.dataset.k !== key) {
      host.dataset.k = key;
      host.innerHTML = shown.map(m => `<button data-glo="${m[0]}" aria-pressed="false">${m[1]}</button>`).join("")
        + (moreCount ? `<button data-glmore>More (${moreCount})</button>` : modesOpen && have.length > 5 ? `<button data-glmore>Fewer</button>` : "");
    }
    host.querySelectorAll("[data-glo]").forEach(b => { const on = b.dataset.glo === mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const slide = el.querySelector("[data-glslide]"), inp = slide.querySelector("input"), kk = Math.min(Math.max(curK, 2), set.max);
    // Every mode that reads from the pool gets the same 2-20 "how many colors" slider now (David's palette-engine
    // brief, 2026-10-09: "a slider for all of them" -- only the structurally-fixed readings stay without one: a
    // value ladder is always 5 bands, Focal is always 1 color plus its neighbors, Pick is however many you tapped).
    slide.hidden = !!set.fixed || set.max <= 2;
    if (!slide.hidden) {
      if (!kCtl) kCtl = countify(inp, { min: 2, max: Math.max(2, set.max), value: kk, out: el.querySelector("[data-glkn]"),
        onSet: (v, final) => { curK = v; locate = null; drawPalette(); if (final) buzz(5); } });
      else { kCtl.range(2, Math.max(2, set.max)); kCtl.set(kk); }
    }
    el.querySelector("[data-glkn]").textContent = kk + " colors";
    // one line under the controls; a tap opens the full sentence (the painting stays the focus)
    const def = GL_MODES.find(m => m[0] === mode), full = set.cap || def[2], short = mode === "pick" ? full : def[3] || full;
    const cap = el.querySelector("[data-glcap]");
    cap.classList.toggle("open", capOpen || short === full);
    cap.innerHTML = `<button class="gl-cap-t" data-glcapt aria-expanded="${capOpen}"${short === full ? " disabled" : ""}>${esc(capOpen ? full : short)}</button>` + (mode === "pick" && picks.length ? `<button class="aw-link" data-glclear>Start over</button>` : "");
    const sel = host.querySelector(".on"); if (sel && host.scrollWidth > host.clientWidth) { const l = sel.offsetLeft - (host.clientWidth - sel.offsetWidth) / 2; host.scrollTo ? host.scrollTo({ left: l }) : (host.scrollLeft = l); }
    glFadeEdges(el.querySelector("[data-glfade]"), host);
  };
  // "Show on painting": the painting dimmed everywhere except where one of these colors lives (a read of the
  // photo at 320px on the long side -- up from 140, David's audit 2026-10-09: "coarse blocky pixel clusters...
  // reads as a glitch" on the Madrazo portrait -- only where the image host allows a canvas read)
  const litBuild = () => {
    if (lit.pix || !lit.img) return lit.pix;
    try {
      const im = lit.img, k = 320 / Math.max(im.naturalWidth, im.naturalHeight), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
      const px = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h * 3);
      for (let j = 0; j < w * h; j++) { const l = lab("#" + ((1 << 24) | px[j * 4] << 16 | px[j * 4 + 1] << 8 | px[j * 4 + 2]).toString(16).slice(1)); L[j * 3] = l[0]; L[j * 3 + 1] = l[1]; L[j * 3 + 2] = l[2]; }
      return lit.pix = { w, h, L };
    } catch (e) { lit.ok = false; return null; }
  };
  // a located swatch dims the rest of the painting and glows where it sits — the whole job this canvas does now
  // that the three-way "On the painting" switch is gone (David, 2026-10-09: redundant with tap-to-locate); the
  // actual mask math is glPaintMask() below, shared with js/paintzoom.js's own "Where" and with litDrawHex
  const litDraw = pal => {
    const cv = el.querySelector("[data-gllitcv]");
    if (!cv) return;
    const locHex = adHocHex || (locate && pal[locate.j] && pal[locate.j].h);
    if (!locHex) { cv.classList.remove("on"); return; }
    const P = litBuild(); if (!P) { cv.classList.remove("on"); return; }
    glPaintMask(cv, P, locHex); cv.classList.add("on");
  };
  // "Where else in this painting" for a color that ISN'T necessarily one of the palette chips (an eyedropped
  // pixel from glColorReadout's readout card, D+E of the same brief) — same paint, no palette index needed; a
  // later drawPalette() naturally clears it since litDraw() only looks at adHocHex/locate, never both at once
  let adHocHex = null;
  const litDrawHex = hex => {
    const cv = el.querySelector("[data-gllitcv]"); if (!cv) return;
    const P = litBuild(); if (!P) return;
    adHocHex = hex; locate = null; glPaintMask(cv, P, hex); cv.classList.add("on");
  };
  // where a color's pixels sit, as a fraction of the image (0..1 each way) — the same coarse photo litBuild()
  // already reads for "On the painting", reused here for the locate caption and the "Look closer" crops
  const glHexCentroid = hex => {
    const P = litBuild(); if (!P) return null;
    const t = lab(hex); let w = 0, sx = 0, sy = 0;
    for (let j = 0; j < P.w * P.h; j++) {
      const dd = Math.hypot(P.L[j * 3] - t[0], P.L[j * 3 + 1] - t[1], P.L[j * 3 + 2] - t[2]);
      if (dd >= 13) continue;
      const wt = 1 - dd / 13, y = (j / P.w) | 0, x = j - y * P.w;
      w += wt; sx += wt * x; sy += wt * y;
    }
    return w < 1 ? null : { fx: sx / w / P.w, fy: sy / w / P.h };
  };
  const glRegionOf = hex => {
    const c = glHexCentroid(hex); if (!c) return null;
    const vi = c.fy < .33 ? 0 : c.fy < .66 ? 1 : 2, hi = c.fx < .33 ? 0 : c.fx < .66 ? 1 : 2;
    const V = ["upper", "", "lower"], H = ["left", "center", "right"];
    if (vi === 1 && hi === 1) return "near the center";
    if (vi === 1) return "on the " + H[hi];
    if (hi === 1) return "in the " + V[vi] + " area";
    return "in the " + V[vi] + " " + H[hi];
  };
  const drawLocate = pal => {
    const cap = el.querySelector("[data-gllocate]");
    if (!cap) return;
    const p = locate && pal[locate.j];
    if (!p) { cap.hidden = true; return; }
    cap.hidden = false;
    const region = lit.ok ? glRegionOf(p.h) : null;
    const share = p.share < .005 ? "under 1% of the canvas" : Math.round(p.share * 100) + "% of the canvas";
    cap.innerHTML = `<i style="--c:${p.h}"></i><span>${esc(nameOf(p.h).n)} · ${share}${region ? ", mostly " + esc(region) : ""}.</span>`;
  };
  // toggling a located swatch is the one overlay the picture shows now (David, 2026-10-09: the old three-way
  // "On the painting" switch — Off/Markers/Highlight — is gone; locate replaces it; it still steps the arriving
  // color's own map aside, same as the switch used to, so only one overlay ever shows at once)
  const toggleLocate = j => {
    const pal = curPal(); if (!pal[j]) return;
    adHocHex = null;
    locate = locate && locate.j === j ? null : { j, hex: pal[j].h };
    if (locate && arrival && arrival.mapOff) arrival.mapOff();
    drawPalette();
  };
  drawPalette();
  if (typeof awPaintingHook === "function") awPaintingHook(el, i, d, { pool, curPal });
  // the ColorSet verbs (js/colorset.js): one compact row, not the full six-wide grid (David, 2026-10-09 polish
  // pass) — Learn moved to live in "Learn the colors here" (drawCov) instead, and Play only shows once a real
  // game is wired to a set (typeof playSet, not the generic hue-drill fallback csPlay falls back to today).
  if (typeof colorSet === "function") {
    learnerLog({ type: "seen", set: glSet(), src: "painting" });
    const actsRow = csActions(glSet, { only: ["keep", "share", "map", ...(typeof playSet === "function" ? ["play"] : [])], back: () => galleryPage(i, false) });
    // Keep, Share, On the map, in that reading order (David's polish pass, 2026-10-09) — csActions itself always
    // orders by CS_ACTS, shared by every other page that calls it, so this page alone re-sorts its own row
    const acOrder = ["keep", "share", "map", "play"];
    [...actsRow.children].sort((a, b) => acOrder.indexOf(a.dataset.cs) - acOrder.indexOf(b.dataset.cs)).forEach(b => actsRow.appendChild(b));
    el.querySelector("[data-csacts]").appendChild(actsRow);
  }
  // the How-many slider is wired by countify() itself (built lazily inside drawModes, see kCtl) -- its onSet
  // already updates curK, clears locate and redraws, same as this used to do by hand
  el.querySelector("[data-glswatches]").onclick = e => {
    // only the small "Where" glyph toggles locate now; a tap anywhere else on the chip is a plain [data-swatch]
    // and js/swatch.js's own capture-phase delegate already opened its color page before this ever runs
    const loc = e.target.closest("[data-locate]"); if (!loc) return;
    buzz(5); toggleLocate(+loc.dataset.locate);
  };
  el.querySelector("[data-glswatches]").addEventListener("keydown", e => {
    const loc = e.target.closest("[data-locate]"); if (!loc || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault(); buzz(5); toggleLocate(+loc.dataset.locate);
  });
  el.querySelector("[data-glorder]").onclick = e => {
    if (e.target.closest("[data-glmore]")) { modesOpen = !modesOpen; buzz(5); drawPalette(); return; }
    const b = e.target.closest("[data-glo]"); if (!b || b.dataset.glo === mode) return;
    mode = b.dataset.glo; locate = null;
    capOpen = false;
    clearDots(); if (mode === "pick") picks.forEach(addDot);
    buzz(5); drawPalette();
  };
  el.querySelector("[data-glorder]").onscroll = () => glFadeEdges(el.querySelector("[data-glfade]"), el.querySelector("[data-glorder]"));
  el.querySelector("[data-glcap]").onclick = e => {
    if (e.target.closest("[data-glclear]")) { picks.length = 0; clearDots(); buzz(5); drawPalette(); return; }
    if (e.target.closest("[data-glcapt]")) { capOpen = !capOpen; buzz(4); drawPalette(); }
  };
  // the painter's own hue habits sharpen "stands out" (a camel that's rare for van Dyck), quietly, once they load
  glPainterHue(d.a).then(h => { if (h && el.isConnected) { prior = h; if (mode === "out") drawPalette(); } });
  // accents, the color you'd miss, and the focal color (data/analysis, the same reading as the Analysis drawer), above the bars
  if (pool.length >= 6 && typeof awShard === "function") awShard(i).then(rows => {
    const r = rows && rows[i % 100], host = el.querySelector("[data-glroles]");
    if (!r || r.id !== d.id || !host || !host.isConnected) return;
    row = r; drawPalette();   // the accents / hidden / focal palette types come from this row
    const roles = [["Accent", (r.acc || []).map(k => pool[k]).find(Boolean), "small and vivid"], ["Easy to miss", (r.hid || []).map(k => pool[k]).find(Boolean), "muted, another family"], ["Focal", pool[r.foc], "stands apart"]].filter(x => x[1]);
    if (!roles.length) return;
    // "Look closer": an automatic crop around where each role color actually sits (lit.ok once the photo's
    // pixels can be read here), labeled with its name — point 4 of David's rebuild brief, 2026-10-09, folded
    // into Findings along with the old flat "Look for" swatches (point 5: "fold the old roles section in")
    const crop = p => {
      const c = lit.ok ? glHexCentroid(p.h) : null;
      if (!c) return `<i style="--c:${p.h}"></i>`;
      const zoom = 280;
      return `<i style="background-image:url(${esc(glBig(d.img))});background-size:${zoom}% auto;background-position:${(c.fx * 100).toFixed(1)}% ${(c.fy * 100).toFixed(1)}%"></i>`;
    };
    host.innerHTML = `<p class="gl-roles-h">Look closer</p><div class="gl-roles-row">${roles.map(([t, p, why]) => `<button class="gl-role" data-swatch="${p.h}" aria-label="${esc(t)}: ${esc(glName(p.h).n)}">${crop(p)}<span><em>${esc(t)}</em><b>${esc(glName(p.h).n)}</b><small>${esc(why)}</small></span></button>`).join("")}</div>`;
  }).catch(() => {});
  // "More by this painter", with where this painting sits in their timeline, right above "More like this"
  // (David's rebuild brief, 2026-10-09, point 7)
  if (d.a && typeof awLoad === "function") {
    const slug = routeSlug(d.a);
    awLoad().then(() => {
      if (!el.isConnected || !awHasPainter(slug)) return;
      return awPainterLoad(slug).then(x => {
        const host = el.querySelector("[data-glmorepainter]");
        if (!host || !host.isConnected) return;
        const all = (x.P.ix || []).filter(j => j >= 0), dated = all.filter(j => G.year[j] !== GL_UNDATED);
        if (all.length < 2) return;
        const order = dated.slice().sort((a, b) => G.year[a] - G.year[b]);
        const rank = order.indexOf(i), idxOf = new Map(order.map((j, k) => [j, k]));
        // swiping the picture moves along this same sequence (chronological when dated, else just the painter's list)
        painterOrder = rank >= 0 ? order : all; painterRank = rank >= 0 ? rank : all.indexOf(i);
        // the nearest in time read as "where this painting sits" better than a random sample of the painter's works
        const near = rank >= 0
          ? order.filter(j => j !== i).sort((a, b) => Math.abs(idxOf.get(a) - rank) - Math.abs(idxOf.get(b) - rank)).slice(0, 6)
          : all.filter(j => j !== i).slice(0, 6);
        const posTxt = rank >= 0 ? `#${rank + 1} of ${order.length} dated works by ${esc(d.a)}, by year${yr ? ", painted " + esc(yr) : ""}.` : "";
        host.innerHTML = `<div class="sec-head"><b>More by ${esc(d.a)}</b><span>${all.length.toLocaleString()} here</span></div>
          ${posTxt ? `<p class="gl-mp-sub">${posTxt}</p>` : ""}
          <div class="gl-rail">${near.map(j => glPinHTML(j, {})).join("")}</div>
          <button class="aw-link" data-awpainter="${esc(slug)}">See all ${all.length.toLocaleString()} by ${esc(d.a)} ↗</button>`;
        host.onclick = e => { const g = e.target.closest("[data-gi]"); if (g) galleryPage(+g.dataset.gi, true); };
        glFill(host);
      });
    }).catch(() => {});
  }
  // Name its colors (js/thingquiz.js): guess before you're told, one quiet button under the picture, never forced
  glQuizLoad().then(() => {
    const host = el.querySelector("[data-glquiz]"); if (!host || !host.isConnected || typeof thingQuiz !== "function") return;
    thingQuiz(host, { img: () => sampleImg, crop: d.crop, colors: glStandOut(pool.length ? pool : pal6, pool.length ? 12 : 6, prior), pool: pool.length ? pool : pal6,
      title: d.t, kind: "painting", src: route, learn: null, label: "Name its colors" });
  }).catch(() => {});
  // swap in the big image when it arrives (SMK's server is slow; the small copy shows meanwhile). A Commons URL
  // goes through glCommonsResolve first (its own Special:FilePath can't be read with crossorigin — see glCORS
  // above); crossOrigin is set on both the loader and the visible <img> before either gets a src, so the swap
  // lands in the readable (CORS) cache partition, not the plain one the small copy already used (David, 2026-10-09).
  const hiImg = el.querySelector("img[data-hi]");
  if (hiImg) {
    const swap = (url, cors) => {
      const big = new Image(); if (cors) big.crossOrigin = "anonymous";
      big.onload = () => {
        if (!hiImg.isConnected) return;
        if (cors) hiImg.crossOrigin = "anonymous";
        hiImg.src = big.src; hiImg.classList.add("hi"); armSample(hiImg);
      };
      big.onerror = () => {};   // quietly keep the small copy if even the fallback fails
      big.src = url;
    };
    const hiUrl = hiImg.dataset.hi, commonsFn = glCommonsFilename(hiUrl);
    if (commonsFn) glCommonsResolve(hiUrl, 1200).then(resolved => swap(resolved || hiUrl, !!resolved));
    else swap(hiUrl, !!glCORS(hiUrl));
  }
  // tap the painting to name a spot (ROADMAP §13): only where the image's host allows a canvas read (local
  // copies under img/gallery/, and CORS-enabled hosts like Wikimedia). Tested once per image; the affordance
  // (cursor, marker) simply never appears where it's blocked — no error, no explanation needed on screen.
  // heroSpan: declared under show() above, the markers need it on the first draw
  let sampleImg = el.querySelector(".gl-hero img"), canSample = false, arrival = null;
  const testSample = img => { try { const c = document.createElement("canvas"); c.width = c.height = 1; const cx = c.getContext("2d"); cx.drawImage(img, 0, 0, 1, 1); cx.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } };
  // Eyedropper on the painting's main image (David's palette-engine brief, 2026-10-09, D+E, revised: "pressing
  // on the picture should make it full screen, instead of instantly starting the color picker" -- a plain tap
  // opens Look closer; the eyedropper is explicit now, armed by the "Pick a color" button (or a long-press
  // shortcut), and ONLY THEN does a press-and-drag show the magnified loupe (js/eyedrop.js eyedropAttach) and
  // open the plain color readout on release -- never js/isolate.js's guessing game, which stays reachable only
  // from the explicit "Test yourself" fold.
  let eyd = null, pickArmed = false;
  const openLookCloser = () => { buzz(5); glZoomOpen({ src: glBig(d.img), alt: d.t, title: d.t, pal: curPal(), pix: lit.ok ? litBuild() : null, galleryIndex: i }); };
  const syncEyd = () => {
    if (eyd) { eyd.detach(); eyd = null; }
    if (pickArmed && canSample && typeof eyedropAttach === "function") {
      eyd = eyedropAttach(sampleImg, {
        onMove: () => { swipeStart = null; },   // a color-sampling drag is never a swipe-to-next-painting
        onPick: (hex, pt) => {
          buzz(6);
          heroSpan.querySelectorAll(".gl-tap-dot").forEach(nd => nd.remove());
          const r = sampleImg.getBoundingClientRect(), sr = heroSpan.getBoundingClientRect();
          const dot = document.createElement("span"); dot.className = "gl-tap-dot";
          dot.style.left = (r.left - sr.left + pt.x / sampleImg.naturalWidth * r.width) + "px";
          dot.style.top = (r.top - sr.top + pt.y / sampleImg.naturalHeight * r.height) + "px";
          heroSpan.appendChild(dot);
          if (typeof glColorReadout === "function") glColorReadout(hex, { i, d, pool, pal: curPal(), picks, onAdd: h => { if (!picks.includes(h) && picks.length < 12) { picks.push(h); drawPalette(); } }, locateHex: litDrawHex });
        },
      });
    }
    const btn = el.querySelector("[data-glpickbtn]");
    if (btn) { btn.classList.toggle("on", pickArmed); btn.setAttribute("aria-pressed", pickArmed); btn.hidden = !canSample; }
  };
  function armSample(img) {
    sampleImg = img; canSample = testSample(img); heroSpan.classList.toggle("gl-tap", canSample); if (arrival) arrival.image(img, canSample);
    lit.ok = canSample; lit.img = img; lit.pix = null;
    syncEyd();
    drawPalette();
  }
  // "Look closer": the same picture, full screen, with pinch-zoom/pan and Value/Squint/Where (js/paintzoom.js)
  const closerBtn = el.querySelector("[data-glcloser]");
  if (closerBtn) closerBtn.onclick = openLookCloser;
  // "Pick a color" (David, relayed 2026-10-09): the explicit way into the eyedropper now -- arms pickArmed,
  // which syncEyd() (above) turns into a live eyedropAttach() on the hero image
  const pickBtn = el.querySelector("[data-glpickbtn]");
  if (pickBtn) pickBtn.onclick = () => { pickArmed = !pickArmed; buzz(5); syncEyd(); };
  // "Pick from the painting": a small ring where each color was taken (the page's own tap-dot, kept)
  const dotAt = [];
  function clearDots() { heroSpan.querySelectorAll(".gl-pick-dot").forEach(n => n.remove()); }
  function addDot(h) { const q = dotAt.find(o => o.h === h); if (!q) return; const dot = document.createElement("span"); dot.className = "gl-tap-dot gl-pick-dot"; dot.style.left = q.x + "px"; dot.style.top = q.y + "px"; dot.style.background = h; heroSpan.appendChild(dot); }
  const sampleHex = (x, y) => {
    const c = document.createElement("canvas"), W = sampleImg.naturalWidth, H = sampleImg.naturalHeight; c.width = W; c.height = H;
    const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(sampleImg, 0, 0);
    const r = sampleImg.getBoundingClientRect(), px = Math.round(x / r.width * W), py = Math.round(y / r.height * H), half = 3;
    const bx = clamp(px - half, 0, W - 1), by = clamp(py - half, 0, H - 1), bw = Math.min(half * 2 + 1, W - bx), bh = Math.min(half * 2 + 1, H - by);
    const data = cx.getImageData(bx, by, bw, bh).data; let rr = 0, gg = 0, bb = 0, n = 0;
    for (let k = 0; k < data.length; k += 4) { rr += data[k]; gg += data[k + 1]; bb += data[k + 2]; n++; }
    return "#" + [rr, gg, bb].map(v => clamp(Math.round(v / n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  // the arriving color: pinned above the palette, with how much of this canvas it covers and where (js/paintingsof.js, L26)
  if (fromHex && typeof ptArrival === "function") arrival = ptArrival(el, { i, hex: fromHex, tol, pool, heroSpan, getImg: () => sampleImg, onMap: () => { if (locate) { locate = null; drawPalette(); } }, why: "This museum's image server doesn't let ColorHub read its pixels, so the map isn't available for this painting." });
  if (typeof fvArtWire === "function") fvArtWire(el, i, d, heroSpan);   // the heart action lives in the top bar now; a long press or a double-tap on the picture keeps it too (js/favs.js)
  if (sampleImg.complete && sampleImg.naturalWidth) armSample(sampleImg); else sampleImg.addEventListener("load", () => armSample(sampleImg), { once: true });
  // Double-tap to like (Instagram-style, David 2026-10-09): since a single tap on the painting already does
  // something (names a spot, picks a color, selects a map place), it waits ~280ms for a second tap before
  // acting — the same delay js/swatch.js uses for [data-dbltap] — so a quick double tap can be caught first and
  // turned into a heart burst + the favorite toggle (js/favs.js "fva-dbltap") instead of firing twice.
  let glTapAt = 0, glTapT = 0;
  const heroTap = e => {
    if (arrival && arrival.tap(e)) return;
    if (mode === "pick") {
      if (!canSample) return;
      const r0 = sampleImg.getBoundingClientRect(), s0 = heroSpan.getBoundingClientRect();
      if (e.clientX < s0.left || e.clientY < s0.top || e.clientX > s0.right || e.clientY > s0.bottom) return;
      try {
        const hex = sampleHex(e.clientX - r0.left, e.clientY - r0.top);
        if (!picks.includes(hex) && picks.length < 12) { picks.push(hex); dotAt.push({ h: hex, x: e.clientX - s0.left, y: e.clientY - s0.top }); addDot(hex); }
        buzz(6); drawPalette();
      } catch (er) { canSample = false; lit.ok = false; heroSpan.classList.remove("gl-tap"); drawPalette(); }
      return;
    }
    if (e.target.closest("a")) return;
    // David, relayed 2026-10-09 ("pressing on the picture should make it full screen, instead of instantly
    // starting the color picker"): a plain tap always opens Look closer now. While the eyedropper is armed
    // (pickArmed, the "Pick a color" button), eyedropAttach (armSample's syncEyd) already owns the gesture on
    // pointerdown/up directly, well before this delayed click fires -- so this branch steps aside for it.
    if (pickArmed) return;
    openLookCloser();
  };
  // swipe the picture left/right to move to the next/previous painting by the same painter (trail-aware: a
  // normal galleryPage navigation, so Back works) — David's rebuild brief, 2026-10-09, point 7
  let swipeStart = null;
  // a long-press on the picture arms the eyedropper directly, a shortcut past the "Pick a color" button (David,
  // relayed 2026-10-09). Only while NOT already armed -- once pickArmed, eyedropAttach owns pointerdown itself.
  let pressT = 0;
  heroSpan.addEventListener("pointerdown", e => {
    swipeStart = { x: e.clientX, y: e.clientY };
    if (!pickArmed && canSample) pressT = setTimeout(() => { pressT = 0; pickArmed = true; buzz(8); syncEyd(); }, 500);
  });
  heroSpan.addEventListener("pointerup", e => {
    if (pressT) { clearTimeout(pressT); pressT = 0; }
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y; swipeStart = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (!painterOrder || painterRank < 0) return;
    const nextRank = painterRank + (dx < 0 ? 1 : -1);
    if (nextRank < 0 || nextRank >= painterOrder.length) return;
    buzz(6); galleryPage(painterOrder[nextRank], true);
  });
  heroSpan.addEventListener("pointermove", e => {
    if (pressT && swipeStart && Math.hypot(e.clientX - swipeStart.x, e.clientY - swipeStart.y) > 8) { clearTimeout(pressT); pressT = 0; }
  });
  heroSpan.addEventListener("pointercancel", () => { swipeStart = null; if (pressT) { clearTimeout(pressT); pressT = 0; } });
  heroSpan.addEventListener("click", e => {
    const now = performance.now();
    if (now - glTapAt < 300) {
      clearTimeout(glTapT); glTapT = 0; glTapAt = 0;
      heroSpan.dispatchEvent(new CustomEvent("fva-dbltap", { detail: { x: e.clientX, y: e.clientY } }));
      if (typeof sfxColor === "function") sfxColor(dom);
      return;
    }
    glTapAt = now;
    glTapT = setTimeout(() => { glTapAt = 0; heroTap(e); }, 280);
  });
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-to]");
    if (a) { e.preventDefault(); return openNode(graph().nodes.get(a.dataset.to)); }
    const p = e.target.closest("[data-gi]"); if (p) return galleryPage(+p.dataset.gi);
  });
  later(() => {
    const rail = el.querySelector("[data-glsim]"); if (!rail || !rail.isConnected) return;
    // "More like this, by…": the metric switch from js/twins.js (overall palette, dominant colors, accents, mood, light, one color, layout)
    // matched on the accents by default, near-blacks (L* < 20) left out: every old painting shares the varnish browns,
    // so twins by overall palette were five near-identical dark rectangles (IMPROVE-2026-10-08 A15)
    if (typeof twSection === "function") {
      const lit = (pool.length >= 3 ? pool : pal6).filter(p => lab(p.h)[0] >= 20);
      const cols = lit.length >= 3 ? lit : (pool.length >= 3 ? pool : pal6);
      const ct = cols.reduce((a, p) => a + (p.share || 0), 0) || 1;
      if (cols.some(p => lch(p.h)[1] >= 25 && (p.share || 0) / ct < .12) && !rail._tw) rail._tw = { metric: "accents" };   // twins.js keeps a preset metric
      return twSection(rail, cols, { self: i, what: "this painting", title: "More like this, by…", img: () => canSample ? sampleImg : null });
    }
    rail.innerHTML = glSimilar(i, 5).map(j => glPinHTML(j)).join(""); glFill(rail);
  }, 40);
}
// crossorigin="anonymous" lets a canvas read the image later (tap-to-name), but it only helps — and only loads
// at all — on a host that actually answers every hop with Access-Control-Allow-Origin (checked by hand, 2026-10,
// with curl -I and an Origin header against each museum's real image URL): NGA, the Rijksmuseum's IIIF host, the
// Met and SMK all do, directly, no redirect. Commons' own image host (upload.wikimedia.org / thumb.wikimedia.org)
// sends the header too, but the URL stored in the corpus is commons.wikimedia.org's Special:FilePath, which
// redirects through a hop that does NOT send it — a browser's CORS check needs every hop in a crossorigin
// fetch to pass, so that fails the whole load (confirmed: ERR_FAILED, "blocked by CORS policy"). Rather than
// give up on ~40% of the corpus, glCommonsResolve() below gets the real, already-CORS-safe URL a different way.
// The Art Institute's local copies (img/gallery/aic/) are same-origin, so they just work with no entry here at
// all. Cleveland is the one source still genuinely stuck: re-checked 2026-10-09 (David asked whether their Open
// Access API exposes a CORS path, the way Commons' MediaWiki API did) — neither openaccess-api.clevelandart.org
// (the JSON API itself) nor any size on openaccess-cdn.clevelandart.org (web/print/full) sends
// Access-Control-Allow-Origin, with or without an Origin header, so there's no door in anywhere in that chain.
const GL_CORS_HOSTS = new Set(["api.nga.gov", "iiif.micr.io", "images.metmuseum.org", "api.smk.dk", "iip-thumb.smk.dk"]);
function glCORS(url) {
  try { return GL_CORS_HOSTS.has(new URL(String(url || ""), location.href).hostname) ? ' crossorigin="anonymous"' : ""; }
  catch (e) { return ""; }
}
// Commons' own Special:FilePath URL can't be read with crossorigin (see above), but the MediaWiki API supports
// CORS directly (the documented &origin=* pattern) and hands back the already-resolved thumb URL on
// upload.wikimedia.org / thumb.wikimedia.org — which answers with Access-Control-Allow-Origin itself, no redirect
// left to fail. Verified by hand, 2026-10-09 (David: a Velázquez from Commons couldn't be read for Pick from it).
// One request per file+width, cached; width is a request only — Commons may hand back a nearby size it already
// has rendered, not that exact number, so the caller should trust whatever comes back and read it at its own size.
const GL_COMMONS_CACHE = new Map();
function glCommonsFilename(url) {
  try {
    const u = new URL(String(url || ""), location.href);
    if (u.hostname !== "commons.wikimedia.org") return null;
    const m = u.pathname.match(/\/wiki\/Special:FilePath\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch (e) { return null; }
}
function glCommonsResolve(url, width) {
  const fn = glCommonsFilename(url);
  if (!fn) return Promise.resolve(null);
  const key = fn + "@" + width;
  if (GL_COMMONS_CACHE.has(key)) return GL_COMMONS_CACHE.get(key);
  const api = "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=" + encodeURIComponent(width) +
    "&titles=" + encodeURIComponent("File:" + fn) + "&format=json&origin=*";
  const p = fetch(api).then(r => r.ok ? r.json() : null).then(j => {
    const pages = j && j.query && j.query.pages, page = pages && Object.values(pages)[0];
    const info = page && page.imageinfo && page.imageinfo[0];
    return (info && (info.thumburl || info.url)) || null;
  }).catch(() => null);
  GL_COMMONS_CACHE.set(key, p);
  return p;
}

// ---------- "In paintings" on a color page ----------
// The section itself lives in js/paintingsof.js (lane L26): the finer color index, the two sliders and "Often paired
// with". This stays as the name explore.js calls; the old six-color row is the fallback if that file didn't load.
function galleryColorRow(host, c) {
  if (typeof paintingsOfSection === "function") return paintingsOfSection(c.h, host, { name: c.n });
  const head = `<h3>In paintings</h3>`;
  const draw = () => {
    if (!host.isConnected) return;
    const s = glNear(c.h), list = [];
    for (let i = 0; i < GAL.n; i++) if (s[i] >= .02) list.push(i);
    list.sort((a, b) => s[b] - s[a]);
    host.innerHTML = head + (list.length ? `<p class="gl-in-sub">Where a color close to ${esc(c.n)} covers the most of the canvas. Matched by color in the museum photos, not by pigment.</p>
      <div class="gl-rail">${list.slice(0, 6).map(i => glPinHTML(i, { badge: `${Math.max(1, Math.round(s[i] * 100))}%` })).join("")}</div>
      ${list.length > 6 ? `<button class="btn ghost gl-all" data-glall>See all ${list.length.toLocaleString()} in the gallery ${ICON.arrow}</button>` : ""}`
      : `<p class="fine">Nothing in the gallery holds much of this color.</p>`);
    glFill(host);
  };
  host.onclick = e => {
    const p = e.target.closest("[data-gi]"); if (p) return galleryPage(+p.dataset.gi, true, c.h);
    if (e.target.closest("[data-glall]")) return galleryOpenColor(c.h, c.n);
    const ld = e.target.closest("[data-glload]");
    if (ld) { ld.outerHTML = `<p class="fine">Loading the gallery…</p>`; loadGallery().then(draw).catch(() => { host.innerHTML = head + `<p class="fine">The gallery didn't load.</p>`; }); }
  };
  if (GAL) { host.innerHTML = head + `<p class="fine">Finding paintings…</p>`; later(draw, 80); }
  else {
    // load the gallery on its own when the row scrolls near the screen (the button stays as a fallback)
    host.innerHTML = head + `<button class="btn ghost gl-all" data-glload>Show paintings with this color ${ICON.arrow}</button>`;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); const b = host.querySelector("[data-glload]"); if (b) b.click(); }, { rootMargin: "400px 0px" });
      io.observe(host); cleanup.push(() => io.disconnect());
    }
  }
}
// open Art (js/explore.js) searched by one color: the Paintings lens merged into it (DESIGN-SYSTEM §12),
// so the old GLQ/GLV gallery-search state no longer applies here — Art picks its color from its own bubble row.
function galleryOpenColor(hex, name) { artOpenColor(hex, name); }

// ---------- screenshot hooks (index.html#shot=gallery..., see js/boot.js) ----------
function galleryShot(arg) {
  const [spec, down] = String(arg || "").replace(/^:/, "").split("@"), [k, v] = spec.split("=");
  const lens = () => artOpenColor(GLQ.hex || null, GLQ.name || "");
  const after = (f, ms = 500) => loadGallery().then(() => setTimeout(f, ms));
  if (down) after(() => scrollBy(0, +down), 1100);   // "...@600": then scroll down 600px
  if (!k) return lens();
  if (k === "scroll") { lens(); return after(() => { const g = document.querySelector("[data-glgrid]"); if (g) scrollTo(0, scrollY + g.getBoundingClientRect().top - 60 + (+v || 0)); }); }
  if (k === "color" || k === "adjust" || k === "preset") {
    const c = k !== "preset" && v && BYNAME.get(v.toLowerCase());
    if (c) GLQ = { ...glFresh(), hex: c.h, name: c.n };
    if (k === "preset") GLQ = { ...glFresh(), preset: v };
    if (v === "taste" && !glTasteOK()) S.taste = { color: { at: today(), mu: TASTE.COLOR_PRIOR.map((_, i) => [-.6, -.9, .2, .1, .4, -.3, .6, -.2, 0, 0][i]) } };   // sample: likes clear blues
    if (c || k === "preset") GLV = { key: glKey(GLQ), head: true };
    lens();
    if (k === "adjust") after(() => { const h = document.getElementById("gallery"); if (h) glAdjust(h); const a = v === "any" && document.querySelector(".gl-sheet [data-glany]"); if (a) a.click(); }, 700);   // adjust=any opens the picker
    return;
  }
  if (k === "page") return loadGallery().then(G => galleryPage(v && /^\d+$/.test(v) ? +v : (() => { let b = 0; for (let i = 1; i < G.n; i++) if (G.C[i] > G.C[b]) b = i; return b; })()));
  // a color page's "In paintings" row: cpage=Name with the gallery loaded, cpage0=Name before it is
  if (k === "cpage" || k === "cpage0") {
    const open = () => { XSTACK = []; openNode(colorNode(BYNAME.get((v || "Cobalt").toLowerCase()))); setTimeout(() => { const r = document.querySelector("[data-glin]"); if (r) scrollTo(0, scrollY + r.getBoundingClientRect().top - 90); }, 700); };
    return k === "cpage" ? loadGallery().then(open) : open();
  }
}
