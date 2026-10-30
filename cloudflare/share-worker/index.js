// Share previews for Chromatlas paintings (David, 2026-10-28: a pasted link showed the app icon, not the painting).
// s.chromatlas.app/<gallery index> (the Worker's own subdomain, so the GitHub Pages site needs no proxy) answers with a tiny page whose Open Graph tags name THIS painting (title, painter, its own picture);
// a person who opens it is sent on to the app at #/gallery/<index>. Link-preview bots (Telegram, iMessage, WhatsApp, Slack...) never run
// the app, they only read these tags, which is why the single-page app could only show one generic card.
// Data comes from the same R2 files the app reads (data/gallery/d/<shard>.json, hosted.bin); nothing is stored in this Worker.
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
async function colorNames(row) {
  const [lib, core] = await Promise.all([getJSON(`${DATA}data/gallery/names.json`, 86400), CORE || getJSON(`${APP}data/core-names.json`, 86400)]);
  if (!lib || !core) return { main: [], accent: "" };
  CORE = core; core.forEach(c => { c.L = c.L || lab(c.h); });
  const pool = core.filter(c => c.rank < CARD_RANK && !plain(c.n));
  const cols = (row[7] || []).map((li, k) => ({ hex: lib[li] && lib[li][1], share: (row[8] || [])[k] || 0 })).filter(c => c.hex)
    .map(c => { const L = lab(c.hex); let best = null, bd = 1e9; for (const p of pool) { const d = de2000(L, p.L); if (d < bd) { bd = d; best = p.n; } } return { ...c, name: titleCase(best), C: Math.hypot(L[1], L[2]) }; })
    .sort((p, q) => q.share - p.share);
  const main = [];
  cols.forEach(c => { if (main.length < 3 && !main.includes(c.name)) main.push(c.name); });
  // the accent: the most vivid color left over, when it really is vivid (the pink flowers in a green garden)
  const rest = cols.filter(c => !main.includes(c.name) && c.C > 40).sort((p, q) => q.C - p.C);
  return { main, accent: rest.length ? rest[0].name : "" };
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

export default {
  async fetch(req) {
    const u = new URL(req.url);
    const m = u.pathname.match(/^\/(?:s\/)?(\d{1,7})\/?$/);
    if (!m) return Response.redirect(APP, 302);
    const gi = +m[1], app = `${APP}#/gallery/${gi}`;
    let row = null, hosted = false;
    try {
      const shard = await getJSON(`${DATA}data/gallery/d/${String(Math.floor(gi / SHARD)).padStart(3, "0")}.json`, 86400);
      row = shard && shard[gi % SHARD];
      const hb = await fetch(`${DATA}data/gallery/hosted.bin`, { cf: { cacheEverything: true, cacheTtl: 3600 } });
      if (hb.ok) { const b = new Uint8Array(await hb.arrayBuffer()); hosted = !!((b[gi >> 3] >> (gi & 7)) & 1); }
    } catch (e) {}
    let names = { main: [], accent: "" }, year = 0;
    try { [names, year] = await Promise.all([row ? colorNames(row) : names, yearOf(gi)]); } catch (e) {}
    const title = row && row[1] ? row[1] : "A painting";
    const painter = row && row[2] ? row[2] : "";
    const img = (row && (row[9] || row[5])) || (hosted ? `${DATA}thumb/${gi}.webp` : `${APP}og/default.png`);   // the 1200 px picture makes the big card
    const head = `${title}${year > 0 && year < 2100 && !/\b1\d{3}\b/.test(title) ? ` (${year})` : ""}${painter ? ` by ${painter}` : ""}`;
    const m3 = names.main, list = m3.length > 1 ? m3.slice(0, -1).join(", ") + " and " + m3[m3.length - 1] : m3.join("");
    const desc = m3.length ? `Its colors: ${list}${names.accent ? `, with a touch of ${names.accent}` : ""}.` : "Its colors, named and measured.";   // the card's top line already says Chromatlas (og:site_name)
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
