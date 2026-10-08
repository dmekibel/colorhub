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
const GL_SIZES = [3, 6, 12, 20];
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
  if (q.hex) { key = glNear(q.hex); min = .02; badge = i => `${Math.max(1, Math.round(key[i] * 100))}% ${q.custom ? "this color" : q.name}`; }
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
  if (!res.list.length) { grid.style.height = ""; grid.innerHTML = `<p class="fine">No painting matches all of that. Loosen a filter.</p>`; }
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

// ---------- the lite painting page ----------
// fromHex: the color the visitor arrived from (a search, a color page's "In paintings", a name page, or the
// color sheet's "More paintings with this color") — ROADMAP §13 "arrive from a color and see it". Carried in
// the address (?c=<hex>, js/router.js) so it survives reload and Back.
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
  const G = GAL, src = G.src[G.mus[i]] || { name: "Museum", short: "Museum", credit: "" }, pal6 = glPal(i), yr = glYear(i), ar = G.ar[i];
  const pool = glPoolDecode(d.pl);
  let curK = 6;   // the dynamic-palette control's current size; 6 with a pool shows the same algorithm as 3/12/20
  let order = "out";   // "out" = stands out first (the default), "area" = by area
  let prior = null;    // this painter's hue habits once they load (glPainterHue); the archive's until then
  const curPal = () => order === "area" ? (pool.length ? glPoolPick(pool, curK) : pal6) : glStandOut(pool.length ? pool : pal6, pool.length ? curK : 6, prior);
  const dom = pal6.reduce((a, b) => b.share > a.share ? b : a).h;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>${d.rec ? `<a class="glass-pill" href="${esc(d.rec)}" target="_blank" rel="noopener">${GL_ICON_OUT}<span>${esc(src.short)}</span></a>` : ""}</header>
    <div class="gl-hero gl-full-w"><span style="--c:${dom};width:min(100%, calc(82dvh / ${ar.toFixed(3)}));aspect-ratio:${(1 / ar).toFixed(4)}"><img src="${esc(glBig(d.img))}" alt="${esc(d.t)}${d.a ? " by " + esc(d.a) : ""}"${glCropStyle(i, d, ar)}${d.hi ? ` data-hi="${esc(d.hi)}"` : ""}${glCORS(glBig(d.img))}></span></div>
    <div class="gl-under"><div class="gl-quiz" data-glquiz></div>${glSmall(d) && !d.hi && d.rec ? `<a class="gl-full" href="${esc(d.rec)}" target="_blank" rel="noopener">Full size at the museum ↗</a>` : ""}${typeof fvArtHeart === "function" ? fvArtHeart(d.id) : ""}</div>
    <p class="eyebrow p-type">Painting${yr ? " · " + yr : ""}</p>
    <h1 class="p-title">${esc(d.t)}</h1>
    <p class="p-dek">${esc([d.a || "Artist unknown", d.co, d.mv].filter(Boolean).join(" · "))}</p>
    <div class="gl-roles" data-glroles></div>
    <div class="sec-head gl-pal-h"><b>Its colors</b><span data-glpaln>as photographed</span></div>
    <div class="gl-ctl"><div class="seg gl-order" data-glorder><button class="on" data-glo="out">Stands out</button><button data-glo="area">By area</button></div>
    ${pool.length ? `<div class="seg gl-sizes" data-glsizes aria-label="How many colors">${GL_SIZES.map(k => `<button class="${k === curK ? "on" : ""}" data-glk="${k}">${k}</button>`).join("")}</div>` : ""}</div>
    <div class="pt-arrive gl-arrive" data-glarrive hidden></div>
    <div class="palette" data-glswatches></div>
    <div class="pal-names" data-glrows></div>
    <div class="gl-cov" data-glcov></div>
    <div data-csacts></div>
    <p class="fine">Computed by ColorHub, not by the museum, from its photograph: "Stands out" leads with the colors that are vivid, rare for this painter and far from the painting's average; "By area" sizes each by its share of the picture. Names are the nearest of about 1,000. Old varnish and the photograph shift color, and screens differ.</p>
    <div data-awan></div>
    ${typeof twSection === "function" ? `<div data-glsim></div>` : `<div class="sec-head gl-sim-h"><b>Similar palettes</b><span>by color, not subject</span></div>
    <div class="gl-rail" data-glsim></div>`}
    <button class="gl-pmap" data-pmap="arr=similar&seed=${i}">${GL_ICON_MAP}<span>Similar paintings, on the map</span>${ICON.chev}</button>
    <section class="srcs"><h3>Image and data</h3><ul><li>${d.rec ? `<a href="${esc(d.rec)}" target="_blank" rel="noopener">${esc(src.name)}</a>` : esc(src.name)}${src.credit ? ` · ${esc(src.credit)}` : ""}</li><li>Palette and color names computed by ColorHub from the museum's image</li></ul></section>
  `, "article gl-page");
  const route = "#/gallery/" + i;
  // "You can name 4 of 6" (js/coverage.js) for the colors on screen, one name each, and "Learn the rest"
  const drawCov = pal => {
    const host = el.querySelector("[data-glcov]");
    if (!host || typeof setCoverage !== "function" || typeof coverageRing !== "function") return;
    const seen = new Set(), items = [];
    pal.forEach(p => { const nm = nameOf(p.h); if (nm.n && nm.de < NEAR_DE && !seen.has(nm.n)) { seen.add(nm.n); items.push({ n: nm.n, h: p.h }); } });
    if (items.length < 2) { host.innerHTML = ""; return; }
    const cov = setCoverage(items), rest = items.filter(x => { try { return typeof knowState !== "function" || knowState(x) !== "yours"; } catch (e) { return true; } });
    host.innerHTML = `${coverageRing(cov, { size: 40, stroke: 4 })}<span><b>${esc(typeof covLabel === "function" ? covLabel(cov) : "")}</b><em>${cov.yours === cov.total ? "Every name here is yours." : "Yours once recalled on a later day."}</em></span>${cov.yours && rest.length && typeof prQuick === "function" ? `<button class="gl-cov-go" data-glrest>Learn the rest</button>` : ""}`;
    const go = host.querySelector("[data-glrest]");
    if (go) go.onclick = () => prQuick({ items: rest.map(x => x.h), label: d.t, src: "painting", route });
  };
  // the palette strip + named rows + arrival line, redrawn whenever the slider's size changes
  const drawPalette = () => {
    const pal = curPal();
    const near = fromHex ? glNearestSwatch(pal, fromHex) : null;
    el.querySelector("[data-glswatches]").innerHTML = pal.map((p, j) => `<button class="pal${near && near.i === j ? " on" : ""}${p.out ? " gl-out" : ""}" data-swatch="${p.h}" style="--c:${p.h};flex:${Math.max(p.share, .08).toFixed(3)}" data-ink="${ink(p.h)}"><span>${p.share < .005 ? "<1" : Math.round(p.share * 100)}%</span></button>`).join("");
    el.querySelector("[data-glrows]").innerHTML = pal.map((p, j) => {
      const nm = glName(p.h), fam = !nm.sub && !p.out && typeof familyOf === "function" && familyOf(p.h);
      const sub = [p.out ? "Stands out" : nm.sub ? nm.sub.charAt(0).toUpperCase() + nm.sub.slice(1) : fam ? fam.head.n + " family" : "", glPctTxt(p.share)].filter(Boolean).join(" · ");
      return `<button class="pal-name${near && near.i === j ? " on" : ""}" data-swatch="${p.h}"><i style="--c:${p.h}"></i><b>${esc(nm.t)}</b><span>${esc(p.out && nm.sub ? sub + " · " + nm.sub : sub)}</span><em class="mono">${p.h}</em></button>`;
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
    if (el._awPal) el._awPal(pal);   // the Analysis readings follow the 3/6/12/20 size (js/artwiki.js)
  };
  drawPalette();
  if (typeof awPaintingHook === "function") awPaintingHook(el, i, d, { pool, curPal });
  // the ColorSet verbs (js/colorset.js): this painting's palette, at whatever size the slider shows
  if (typeof colorSet === "function") {
    const glSet = () => colorSet({ kind: "painting", id: "g" + i, title: d.t, colors: curPal().map(p => ({ h: p.h, share: p.share })), src: "gallery/" + i });
    learnerLog({ type: "seen", set: glSet(), src: "painting" });
    el.querySelector("[data-csacts]").appendChild(csActions(glSet, { back: () => galleryPage(i, false) }));
  }
  if (pool.length) el.querySelector("[data-glsizes]").onclick = e => {
    const b = e.target.closest("[data-glk]"); if (!b) return;
    curK = +b.dataset.glk;
    el.querySelectorAll("[data-glsizes] button").forEach(x => x.classList.toggle("on", x === b));
    buzz(5); drawPalette();
  };
  el.querySelector("[data-glorder]").onclick = e => {
    const b = e.target.closest("[data-glo]"); if (!b || b.dataset.glo === order) return;
    order = b.dataset.glo;
    el.querySelectorAll("[data-glorder] button").forEach(x => x.classList.toggle("on", x === b));
    buzz(5); drawPalette();
  };
  // the painter's own hue habits sharpen "stands out" (a camel that's rare for van Dyck), quietly, once they load
  glPainterHue(d.a).then(h => { if (h && el.isConnected) { prior = h; if (order === "out") drawPalette(); } });
  // accents, the color you'd miss, and the focal color (data/analysis, the same reading as the Analysis drawer), above the bars
  if (pool.length >= 6 && typeof awShard === "function") awShard(i).then(rows => {
    const r = rows && rows[i % 100], host = el.querySelector("[data-glroles]");
    if (!r || r.id !== d.id || !host || !host.isConnected) return;
    const roles = [["Accent", (r.acc || []).map(k => pool[k]).find(Boolean), "small and vivid"], ["Easy to miss", (r.hid || []).map(k => pool[k]).find(Boolean), "muted, another family"], ["Focal", pool[r.foc], "stands apart"]].filter(x => x[1]);
    if (!roles.length) return;
    host.innerHTML = `<p class="gl-roles-h">Look for</p><div class="gl-roles-row">${roles.map(([t, p, why]) => `<button class="gl-role" data-swatch="${p.h}" aria-label="${esc(t)}: ${esc(glName(p.h).n)}"><i style="--c:${p.h}"></i><span><em>${esc(t)}</em><b>${esc(glName(p.h).n)}</b><small>${esc(why)}</small></span></button>`).join("")}</div>`;
  }).catch(() => {});
  // Name its colors (js/thingquiz.js): guess before you're told, one quiet button under the picture, never forced
  glQuizLoad().then(() => {
    const host = el.querySelector("[data-glquiz]"); if (!host || !host.isConnected || typeof thingQuiz !== "function") return;
    thingQuiz(host, { img: () => sampleImg, crop: d.crop, colors: glStandOut(pool.length ? pool : pal6, pool.length ? 12 : 6, prior), pool: pool.length ? pool : pal6,
      title: d.t, kind: "painting", src: route, learn: null, label: "Name its colors" });
  }).catch(() => {});
  // swap in the big image when it arrives (SMK's server is slow; the small copy shows meanwhile)
  const hiImg = el.querySelector("img[data-hi]");
  if (hiImg) {
    const big = new Image(); if (glCORS(hiImg.dataset.hi)) big.crossOrigin = "anonymous";
    big.onload = () => { if (hiImg.isConnected) { hiImg.src = big.src; hiImg.classList.add("hi"); armSample(hiImg); } };
    big.src = hiImg.dataset.hi;
  }
  // tap the painting to name a spot (ROADMAP §13): only where the image's host allows a canvas read (local
  // copies under img/gallery/, and CORS-enabled hosts like Wikimedia). Tested once per image; the affordance
  // (cursor, marker) simply never appears where it's blocked — no error, no explanation needed on screen.
  const heroSpan = el.querySelector(".gl-hero > span");
  let sampleImg = el.querySelector(".gl-hero img"), canSample = false, arrival = null;
  const testSample = img => { try { const c = document.createElement("canvas"); c.width = c.height = 1; const cx = c.getContext("2d"); cx.drawImage(img, 0, 0, 1, 1); cx.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } };
  function armSample(img) { sampleImg = img; canSample = testSample(img); heroSpan.classList.toggle("gl-tap", canSample); if (arrival) arrival.image(img, canSample); }
  // the arriving color: pinned above the palette, with how much of this canvas it covers and where (js/paintingsof.js, L26)
  if (fromHex && typeof ptArrival === "function") arrival = ptArrival(el, { i, hex: fromHex, tol, pool, heroSpan, getImg: () => sampleImg, why: "This museum's image server doesn't let ColorHub read its pixels, so the map isn't available for this painting." });
  if (typeof fvArtWire === "function") fvArtWire(el, i, d, heroSpan);   // the heart under the picture; a long press on it keeps it too (js/favs.js)
  if (sampleImg.complete && sampleImg.naturalWidth) armSample(sampleImg); else sampleImg.addEventListener("load", () => armSample(sampleImg), { once: true });
  heroSpan.addEventListener("click", e => {
    if (arrival && arrival.tap(e)) return;
    if (!canSample || e.target.closest("a")) return;
    // r = the whole photo (a cropped painting's <img> is bigger than the box that shows it), sr = what is on screen
    const r = sampleImg.getBoundingClientRect(), sr = heroSpan.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (e.clientX < sr.left || e.clientY < sr.top || e.clientX > sr.right || e.clientY > sr.bottom || !sampleImg.naturalWidth) return;
    if (typeof isoOpen === "function") {   // guess its name, then see it alone on grey (js/isolate.js); the reveal is one tap from its page
      const k = Math.min(r.width / sampleImg.naturalWidth, r.height / sampleImg.naturalHeight), dw = sampleImg.naturalWidth * k, dh = sampleImg.naturalHeight * k;
      const fx = (x - (r.width - dw) / 2) / dw, fy = (y - (r.height - dh) / 2) / dh;
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) { buzz(6); isoOpen({ src: sampleImg, fx, fy, from: "painting", ref: "painting:" + i }); }
      return;
    }
    try {
      const c = document.createElement("canvas"); c.width = sampleImg.naturalWidth; c.height = sampleImg.naturalHeight;
      const cx = c.getContext("2d"); cx.drawImage(sampleImg, 0, 0);
      const px = Math.round(x / r.width * c.width), py = Math.round(y / r.height * c.height), half = 3;
      const bx = clamp(px - half, 0, c.width - 1), by = clamp(py - half, 0, c.height - 1);
      const bw = Math.min(half * 2 + 1, c.width - bx), bh = Math.min(half * 2 + 1, c.height - by);
      const data = cx.getImageData(bx, by, bw, bh).data;
      let rr = 0, gg = 0, bb = 0, n = 0;
      for (let k = 0; k < data.length; k += 4) { rr += data[k]; gg += data[k + 1]; bb += data[k + 2]; n++; }
      const hex = "#" + [rr, gg, bb].map(v => clamp(Math.round(v / n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
      heroSpan.querySelectorAll(".gl-tap-dot").forEach(nd => nd.remove());
      const dot = document.createElement("span"); dot.className = "gl-tap-dot"; dot.style.left = (e.clientX - sr.left) + "px"; dot.style.top = (e.clientY - sr.top) + "px";
      heroSpan.appendChild(dot);
      buzz(6); openTappedColor(hex);   // David, 2026-10-07: tap anywhere on the painting opens that color's page, not the sheet
    } catch (e) { canSample = false; heroSpan.classList.remove("gl-tap"); }   // tainted after all: quietly give up
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
// Met and SMK all do, directly, no redirect. Commons looks CORS-enabled too (upload.wikimedia.org itself sends
// the header) but the stored `img` URL is commons.wikimedia.org's Special:FilePath, which 302s through a page
// that does NOT send the header -- a browser's CORS check runs on every redirect hop, so crossorigin there
// fails the whole fetch (confirmed in headless Chrome: ERR_FAILED, "blocked by CORS policy", no image at all).
// Rather than risk that for ~40% of the corpus, Commons is left off this list; the Art Institute already blocks
// hotlinking outright (img/gallery/aic/ local copies stand in for it), and Cleveland's CDN sends no CORS header
// at all -- those paintings simply get no tap-to-name affordance, same as Commons.
const GL_CORS_HOSTS = new Set(["api.nga.gov", "iiif.micr.io", "images.metmuseum.org", "api.smk.dk", "iip-thumb.smk.dk"]);
function glCORS(url) {
  try { return GL_CORS_HOSTS.has(new URL(String(url || ""), location.href).hostname) ? ' crossorigin="anonymous"' : ""; }
  catch (e) { return ""; }
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
      : `<p class="fine">No painting in the gallery has much of this color.</p>`);
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
