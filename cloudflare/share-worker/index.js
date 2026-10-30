// Share previews for Chromatlas paintings (David, 2026-10-28: a pasted link showed the app icon, not the painting).
// s.chromatlas.app/<gallery index> (the Worker's own subdomain, so the GitHub Pages site needs no proxy) answers with a tiny page whose Open Graph tags name THIS painting (title, painter, its own picture);
// a person who opens it is sent on to the app at #/gallery/<index>. Link-preview bots (Telegram, iMessage, WhatsApp, Slack...) never run
// the app, they only read these tags, which is why the single-page app could only show one generic card.
// Data comes from the same R2 files the app reads (data/gallery/d/<shard>.json). The picture (/c/<n>.jpg: the painting with its palette
// strip) is drawn by Cloudflare Images on the first share and kept in R2 at card/v<CARD_V>/<n>.jpg. Bindings: IMAGES, DATA (bucket chromatlas-data).
const DATA = "https://data.chromatlas.app/";
const APP = "https://chromatlas.app/", SHARE = "https://s.chromatlas.app/";
const SHARD = 100;                       // data/gallery/index.json "shard"
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// CIEDE2000 over data/core-names.json, the names the app shows (nameOf in js/naming.js), filtered for a card (see CARD_RANK below)
const lab = hex => {
  const f = v => (v /= 255) > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92, n = parseInt(hex.slice(1), 16), r = f(n >> 16), g = f(n >> 8 & 255), b = f(n & 255);
  const t = v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116, x = t((r * .4124 + g * .3576 + b * .1805) / .95047), y = t(r * .2126 + g * .7152 + b * .0722), z = t((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = .5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const A1 = a1 * (1 + G), A2 = a2 * (1 + G), c1 = Math.hypot(A1, b1), c2 = Math.hypot(A2, b2);
  const h1 = (Math.atan2(b1, A1) / rad + 360) % 360, h2 = (Math.atan2(b2, A2) / rad + 360) % 360;
  const dL = L2 - L1, dC = c2 - c1; let dh = c1 * c2 ? h2 - h1 : 0; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh / 2 * rad), Lm = (L1 + L2) / 2, cm = (c1 + c2) / 2;
  let hm = h1 + h2; if (c1 * c2) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const T = 1 - .17 * Math.cos((hm - 30) * rad) + .24 * Math.cos(2 * hm * rad) + .32 * Math.cos((3 * hm + 6) * rad) - .2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + .015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + .045 * cm, SH = 1 + .015 * cm * T;
  const RT = -2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
let CORE = null;
// Card names (David, 2026-10-30): always an interesting name, never the obvious one. Out: the plain basics (Red, Green, Blue, Grey...) and
// names built only from basics and modifiers (Pale Pink, Reddish Brown, Bluish Grey); out too: the rare tail (rank >= CARD_RANK, e.g. Hathi Grey).
const CARD_RANK = 450, BASIC = new Set("red orange yellow green blue purple pink brown grey gray black white violet".split(" "));
const MOD = new Set("pale light dark deep pastel bright medium dull vivid soft very".split(" "));
const plain = n => n.toLowerCase().split(/[\s-]+/).every(w => BASIC.has(w) || MOD.has(w) || /ish$/.test(w));
const titleCase = n => n.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
// names for the strip's colors, in the same order: the nearest interesting name, the next one when two would share a name
async function namesFor(cols) {
  const core = CORE || await getJSON(`${APP}data/core-names.json`, 86400);
  if (!core) return [];
  CORE = core; core.forEach(c => { c.L = c.L || lab(c.h); });
  const pool = core.filter(c => c.rank < CARD_RANK && !plain(c.n)), taken = new Set();
  return cols.map(col => {
    const ranked = pool.map(p => [de2000(col.L, p.L), p.n]).sort((x, y) => x[0] - y[0]);
    const pick = (ranked.find(([d, n]) => !taken.has(n) && d <= ranked[0][0] + 4) || ranked[0])[1];
    taken.add(pick); return titleCase(pick);
  });
}
// ---- the share card picture: the painting with its palette underneath (David, 2026-10-30, mockup version 3) ----
// Palette: the same chooser as the Instagram carousels (social/instagram/palette.py extract): start from the biggest area,
// then add whichever candidate is most unlike everything chosen (CIEDE2000, two near-greys count as closer), favoring vivid
// colors and lightly weighting area, never closer than 8 to a chosen one. Candidates: the painting's pool from the detail
// shard (row[10], up to 24 real colors by area, tools/gallery.py extract_pool). Ordered warm to cool, then quiet colors light to dark.
function poolDecode(b64) {
  if (!b64) return [];
  let bin; try { bin = atob(b64); } catch (e) { return []; }
  const out = [];
  for (let i = 0; i + 3 < bin.length; i += 4) {
    const h = "#" + [0, 1, 2].map(k => bin.charCodeAt(i + k).toString(16).padStart(2, "0")).join("").toUpperCase();
    out.push({ hex: h, share: bin.charCodeAt(i + 3) / 250 });
  }
  return out;
}
function pickPalette(pool, n = 6, minDE = 8) {
  const cand = pool.filter(c => c.share >= .006).map(c => { const L = lab(c.hex); return { ...c, L, C: Math.hypot(L[1], L[2]) }; });
  if (!cand.length) return [];
  const chosen = [cand.reduce((a, b) => b.share > a.share ? b : a)];
  const gap = (a, b) => { const d = de2000(a.L, b.L); return a.C < 16 && b.C < 16 ? d - 8 : d; };
  while (chosen.length < n) {
    let best = null, bs = -1, bd = 0;
    for (const c of cand) {
      if (chosen.includes(c)) continue;
      const d = Math.min(...chosen.map(q => gap(c, q))), s = d * c.share ** .15 * (1 + c.C / 60);
      if (s > bs) { bs = s; best = c; bd = d; }
    }
    if (!best || bd < minDE) break;
    chosen.push(best);
  }
  const hue = c => (Math.atan2(c.L[2], c.L[1]) * 180 / Math.PI + 360 - 20) % 360;   // 20 degrees (a warm red) first
  return chosen.sort((a, b) => (a.C < 12) - (b.C < 12) || (a.C < 12 ? b.L[0] - a.L[0] : hue(a) - hue(b)));
}
// a W x H indexed PNG: black above `top`, then the swatches side by side in equal widths. Every row but the first of each band
// is filter "Up" with zero bytes, so the 2 MB raw image deflates to almost nothing.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8, c = 0xFFFFFFFF) => { for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return c; };
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer), t = new TextEncoder().encode(type);
  dv.setUint32(0, data.length); out.set(t, 4); out.set(data, 8);
  dv.setUint32(8 + data.length, (crc32(data, crc32(t)) ^ 0xFFFFFFFF) >>> 0);
  return out;
}
async function stripPNG(W, H, top, hexes) {
  const raw = new Uint8Array((W + 1) * H), row = W + 1;
  for (let y = 0; y < H; y++) raw[y * row] = y === 0 || y === top ? 0 : 2;
  for (let x = 0; x < W; x++) raw[top * row + 1 + x] = 1 + Math.min(hexes.length - 1, Math.floor(x * hexes.length / W));
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ihdr.set([8, 3, 0, 0, 0], 8);
  const plte = new Uint8Array(3 * (hexes.length + 1));
  hexes.forEach((h, i) => { const v = parseInt(h.slice(1), 16); plte.set([v >> 16, v >> 8 & 255, v & 255], 3 * (i + 1)); });
  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", z), chunk("IEND", new Uint8Array())]);
}

// ---- the palette, read from the picture itself (David, 2026-10-30: "the lady in the white dress was more white, cream and yellow") ----
// Cloudflare Images shrinks the painting to a small PNG; this decodes it and runs the Instagram carousel chooser on its pixels
// (social/instagram/palette.py extract): k-means in Lab, plus the most saturated pixels clustered on their own so a moon or a red hat
// is not averaged into mud; then start from the biggest area and add whichever color is most unlike everything chosen, favoring vivid
// ones, never closer than 8. One addition: a big light area (a white dress, a pale sky) always gets a swatch.
async function decodePNG(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer);
  let p = 8, W = 0, H = 0, ct = 0, idat = [];
  while (p < u8.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(...u8.subarray(p + 4, p + 8));
    if (type === "IHDR") { W = dv.getUint32(p + 8); H = dv.getUint32(p + 12); ct = u8[p + 17]; if (u8[p + 16] !== 8 || u8[p + 20]) throw new Error("png"); }
    else if (type === "IDAT") idat.push(u8.subarray(p + 8, p + 8 + len));
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[ct]; if (!bpp) throw new Error("png type " + ct);
  const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
  const stride = W * bpp, px = new Uint8Array(H * stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0, v = raw[src + x];
      let r = v;
      if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[o + x] = r & 255;
    }
  }
  const out = [];
  for (let i = 0; i < W * H; i++) { const o = i * bpp; out.push(bpp >= 3 ? [px[o], px[o + 1], px[o + 2]] : [px[o], px[o], px[o]]); }
  return out;
}
const hexOf = rgb => "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const labToHex = ([L, a, b]) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = inv(fx) * .95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const g = v => 255 * (v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v);
  return hexOf([g(3.2406 * X - 1.5372 * Y - .4986 * Z), g(-.9689 * X + 1.8758 * Y + .0415 * Z), g(.0557 * X - .204 * Y + 1.057 * Z)]);
};
function kmeans(pts, k, iters = 10) {
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cen = [pts[Math.floor(rnd() * pts.length)]];
  while (cen.length < k) {   // k-means++
    const w = pts.map(p => Math.min(...cen.map(c => d2(p, c)))), tot = w.reduce((s, v) => s + v, 0);
    let r = rnd() * tot, i = 0; while (i < pts.length - 1 && (r -= w[i]) > 0) i++; cen.push(pts[i]);
  }
  let lbl = new Int32Array(pts.length);
  for (let it = 0; it < iters; it++) {
    pts.forEach((p, i) => { let b = 0, bd = Infinity; cen.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; b = j; } }); lbl[i] = b; });
    const sum = cen.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const s = sum[lbl[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sum.forEach((s, j) => { if (s[3]) cen[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const share = cen.map(() => 0); lbl.forEach(l => share[l]++);
  return cen.map((c, j) => ({ L: c, share: share[j] / pts.length }));
}
function extractPalette(rgbs, n = 6) {
  const pts = rgbs.map(c => lab(hexOf(c)));
  let cand = kmeans(pts, 14);
  const chroma = pts.map(p => Math.hypot(p[1], p[2])), cut = chroma.slice().sort((a, b) => a - b)[Math.floor(chroma.length * .94)];
  const viv = pts.filter((p, i) => chroma[i] >= cut);
  if (viv.length > 50) cand = cand.concat(kmeans(viv, 4).map(c => ({ L: c.L, share: pts.filter(p => Math.hypot(p[0] - c.L[0], p[1] - c.L[1], p[2] - c.L[2]) < 12).length / pts.length })));
  cand = cand.filter(c => c.share >= .006).map(c => ({ ...c, C: Math.hypot(c.L[1], c.L[2]) }));
  if (!cand.length) return [];
  const gap = (a, b) => { const d = de2000(a.L, b.L); return a.C < 16 && b.C < 16 ? d - 8 : d; };
  const chosen = [cand.reduce((a, b) => b.share > a.share ? b : a)];
  // a big light area always gets its swatch (Repin's white dress): the lightest cluster holding 6%+ of the canvas
  const light = cand.filter(c => c.L[0] > 78 && c.share >= .06).sort((a, b) => b.L[0] - a.L[0])[0];
  if (light && !chosen.includes(light)) chosen.push(light);
  while (chosen.length < n) {
    let best = null, bs = -1, bd = 0;
    for (const c of cand) {
      if (chosen.includes(c)) continue;
      const d = Math.min(...chosen.map(q => gap(c, q))), s = d * c.share ** .15 * (1 + c.C / 60);
      if (s > bs) { bs = s; best = c; bd = d; }
    }
    if (!best || bd < 8) break;
    chosen.push(best);
  }
  const hue = c => (Math.atan2(c.L[2], c.L[1]) * 180 / Math.PI + 360 - 20) % 360;
  return chosen.sort((a, b) => (a.C < 12) - (b.C < 12) || (a.C < 12 ? b.L[0] - a.L[0] : hue(a) - hue(b)))
    .map(c => ({ hex: labToHex(c.L), L: c.L, C: c.C }));
}

async function yearOf(gi) {   // data/gallery/index.bin: 30-byte records, the first two bytes are year + year0 (20000), 0 = undated
  const r = await fetch(`${DATA}data/gallery/index.bin`, { headers: { Range: `bytes=${gi * 30}-${gi * 30 + 1}` } });
  if (r.status !== 206) return 0;
  const b = new Uint8Array(await r.arrayBuffer()), y = b[0] | b[1] << 8;
  return y ? y - 20000 : 0;
}

async function getJSON(url, ttl) {
  const r = await fetch(url, { cf: { cacheEverything: true, cacheTtl: ttl } });
  return r.ok ? r.json() : null;
}

const CARD_V = 2;   // bump to redraw every stored card (R2 card/v<CARD_V>/<n>.jpg and .json)
const shardRow = async gi => { const sh = await getJSON(`${DATA}data/gallery/d/${String(Math.floor(gi / SHARD)).padStart(3, "0")}.json`, 86400); return sh && sh[gi % SHARD]; };
const UA = { "User-Agent": "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) share-card" };

// the palette: read once from the picture (extractPalette), kept in R2 next to the card; the pool pick is only the fallback
async function paletteOf(gi, row, env) {
  const key = `card/v${CARD_V}/${gi}.json`, have = await env.DATA.get(key);
  if (have) return have.json();
  const src = row && (row[9] || row[5]);
  let cols = [];
  try {
    const small = await env.IMAGES.input((await fetch(src, { headers: UA, cf: { cacheEverything: true, cacheTtl: 86400 } })).body)
      .transform({ width: 48, height: 48, fit: "scale-down" }).output({ format: "image/png" });
    cols = extractPalette(await decodePNG(await small.response().arrayBuffer())).map(c => ({ hex: c.hex, L: c.L }));
  } catch (e) {}
  if (cols.length < 3) return pickPalette(poolDecode(row && row[10])).map(c => ({ hex: c.hex, L: c.L }));
  await env.DATA.put(key, JSON.stringify(cols), { httpMetadata: { contentType: "application/json" } });
  return cols;
}

// the picture: stored in R2 after the first share, drawn by Cloudflare Images (no pixel work in this Worker)
async function cardImage(gi, env) {
  const key = `card/v${CARD_V}/${gi}.jpg`, have = await env.DATA.get(key);
  const head = { "content-type": "image/jpeg", "cache-control": "public, max-age=604800" };
  if (have) return new Response(have.body, { headers: head });
  const row = await shardRow(gi);
  const src = row && (row[9] || row[5]);
  if (!src) return Response.redirect(`${APP}og/default.png`, 302);
  const cols = await paletteOf(gi, row, env);
  const get = () => fetch(src, { headers: UA, cf: { cacheEverything: true, cacheTtl: 86400 } });
  if (cols.length < 3) return Response.redirect(src, 302);
  try {
    const info = await env.IMAGES.info((await get()).body);
    const W = Math.min(1200, info.width), H = Math.round(info.height * W / info.width), S = Math.round(W * .12);
    const base = await stripPNG(W, H + S, H, cols.map(c => c.hex));
    const out = await env.IMAGES.input(base.stream())
      .draw(env.IMAGES.input((await get()).body).transform({ width: W, height: H, fit: "scale-down" }), { top: 0, left: 0 })
      .output({ format: "image/jpeg", quality: 85 });
    const bytes = await out.response().arrayBuffer();
    await env.DATA.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
    return new Response(bytes, { headers: head });
  } catch (e) { return Response.redirect(src, 302); }
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const c = u.pathname.match(/^\/c\/(\d{1,7})\.jpg$/);
    if (c) return cardImage(+c[1], env);
    const m = u.pathname.match(/^\/(?:s\/)?(\d{1,7})\/?$/);
    if (!m) return Response.redirect(APP, 302);
    const gi = +m[1], app = `${APP}#/gallery/${gi}`;
    let row = null, names = [], year = 0;
    try { row = await shardRow(gi); } catch (e) {}
    try { [names, year] = await Promise.all([row ? paletteOf(gi, row, env).then(namesFor) : [], yearOf(gi)]); } catch (e) {}
    const title = row && row[1] ? row[1] : "A painting";
    const painter = row && row[2] ? row[2] : "";
    const img = row && (row[9] || row[5]) ? `${SHARE}c/${gi}.jpg` : `${APP}og/default.png`;
    const head = `${title}${year > 0 && year < 2100 && !/\b1\d{3}\b/.test(title) ? ` (${year})` : ""}${painter ? ` by ${painter}` : ""}`;
    const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names.join("");
    const desc = names.length ? `Its colors: ${list}.` : "Its colors, named and measured.";   // the same colors as the strip under the picture; the card's top line already says Chromatlas
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(head)} · Chromatlas</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:site_name" content="Chromatlas"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(head)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(SHARE + gi)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(head)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(app)}"><link rel="canonical" href="${esc(app)}"></head>
<body><script>location.replace(${JSON.stringify(app)})</script><p><a href="${esc(app)}">Open ${esc(title)} on Chromatlas</a></p></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
  },
};
