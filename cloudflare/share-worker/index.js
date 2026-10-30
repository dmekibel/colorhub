// Share previews for Chromatlas paintings (David, 2026-10-28: a pasted link showed the app icon, not the painting).
// s.chromatlas.app/<gallery index> (the Worker's own subdomain, so the GitHub Pages site needs no proxy) answers with a tiny page whose Open Graph tags name THIS painting (title, painter, its own picture);
// a person who opens it is sent on to the app at #/gallery/<index>. Link-preview bots (Telegram, iMessage, WhatsApp, Slack...) never run
// the app, they only read these tags, which is why the single-page app could only show one generic card.
// Data comes from the same R2 files the app reads (data/gallery/d/<shard>.json, hosted.bin); nothing is stored in this Worker.
const DATA = "https://data.chromatlas.app/";
const APP = "https://chromatlas.app/", SHARE = "https://s.chromatlas.app/";
const SHARD = 100;                       // data/gallery/index.json "shard"
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
    const title = row && row[1] ? row[1] : "A painting";
    const painter = row && row[2] ? row[2] : "";
    const img = (row && (row[9] || row[5])) || (hosted ? `${DATA}thumb/${gi}.webp` : `${APP}og/default.png`);   // the 1200 px picture makes the big card
    const head = painter ? `${title} by ${painter}` : title;
    const desc = "See its colors, named and measured, on Chromatlas.";   // the message itself says "Check out this painting I found on Chromatlas" (js/sharecard.js)
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
