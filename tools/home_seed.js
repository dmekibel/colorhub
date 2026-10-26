// Rebuild data/home-seed.json (the Today feed's instant first screen; js/homefeed.js hfSeedRiver). Run in the browser console on the app (#/feed) once the feed has drawn, then POST
// the result to a tiny local file sink, or copy it into data/home-seed.json. It keeps the most beautiful paintings (hfBeauty), at most two per painter, 18 per movement,
// 40 per hue family, portrait-to-landscape shapes only, 1400 or later, and records the picture URL, title, painter, year, shape and main color for each.
(async () => {
  await hfFacets(); await hfBeautyReady(); const F = HF_F, idx = [];
  for (let i = 0; i < GAL.n; i++) { if (hfHid(i)) continue; const ar = GAL.ar[i], y = GAL.year[i]; if (ar > .62 && ar < 1.7 && y !== GL_UNDATED && y >= 1400) idx.push(i); }
  idx.sort((a, b) => hfBeauty(b) - hfBeauty(a));
  const perP = new Map(), perM = new Map(), hue = new Array(12).fill(0), picks = [];
  for (const i of idx.slice(0, 6000)) {
    const a = F.artist[i], m = F.mv[i]; if ((perP.get(a) || 0) >= 2 || (perM.get(m) || 0) >= 18) continue;
    const d = hfDom(i), hb = d ? Math.floor(d[0] / 30) % 12 : 0; if (hue[hb] >= 40) continue;
    perP.set(a, (perP.get(a) || 0) + 1); perM.set(m, (perM.get(m) || 0) + 1); hue[hb]++; picks.push(i); if (picks.length >= 320) break;
  }
  await Promise.all([...new Set(picks.map(i => Math.floor(i / GAL.shard)))].map(k => glShard(k).catch(() => null)));
  const items = [];
  for (const i of picks) { const d = glDetailNow(i); if (!d || !d.img) continue; const dom = glPal(i).reduce((a, b) => (b.share > a.share ? b : a)); items.push({ g: i, i: d.img, a: +glAR(i).toFixed(3), c: dom.h, t: d.t.length > 46 ? d.t.slice(0, 45) + "…" : d.t, p: d.a || "", y: GAL.year[i] }); }
  window.__seed = JSON.stringify({ v: 1, n: GAL.n, items: items.slice(0, 170) });
  console.log("home seed:", items.length, "kept 170,", window.__seed.length, "bytes in window.__seed");
})();
