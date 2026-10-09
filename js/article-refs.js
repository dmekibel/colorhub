"use strict";
// Reference cards for the article reader (David, 2026-10-08: "Every reference to every other thing should be part of the
// article. If it's referencing a gem, put the image of that gem, as long as it's close percentage-wise to that gem.").
// js/article.js turns [[gem:<id>]] [[flower:<id>]] [[painting:<id | gallery n>]] [[look:<id>]] [[garment:<id>]] [[film:<id>]]
// [[painter:<slug>]] (and the older [[art:<painting id>]]) into small inline chips, and calls arfEnhance(root, art, self) once
// the article is on screen. This file then:
//   1. EXPLICIT: for every paragraph that holds a reference, loads the thing and, when it is close to the article's color,
//      puts a figure card after the paragraph: the image, its name, and "94% match to Fiery Rose" (pctMatch of the thing's
//      closest palette color). One tap opens it; Back returns to the article.
//   2. AUTO: pulls the article's nearest twins from data/graph (gems, films, the paintings that hold the color) plus the
//      closest flowers/dye plants and looks, keeps the ones inside the threshold, and places at most one per kind, at most
//      one per section (painting -> "Art", gem -> "Gems"...), the rest in one "Seen in" strip before the Family tree.
// Close enough = the thing's closest palette color is within CIEDE2000 15 of the article's color (ARF_DE: an 85% match);
// paintings must also cover at least 2% of the canvas. Otherwise the chip stands alone: no picture is better than a far one.
// Paintings highlight where the color sits (a soft veil over everything else) when the museum's server allows reading the
// picture; films get a strip of the colors the text discusses (we show no stills); looks get their palette strip.
// Everything is asynchronous and optional: a missing dataset, a slow network or a bad id leaves the chip as plain text.
// Top-level names start with arf / ARF (one shared global scope).

const ARF_DE = 15;                                  // CIEDE2000 distance that still counts as close (pctMatch 85%)
const ARF_LIMIT = { look: 8 };                      // a look is a palette of many colors, so its single closest one must be nearer
const ARF_MIN_COVER = .02;                          // a painting must hold at least 2% of the canvas in that color
const ARF_MAX_AUTO = 5, ARF_MAX_END = 3, ARF_MAX_PER_P = 2;
const ARF_WAIT_MS = 9000;                           // how long to wait for a lazily loaded dataset
const ARF_WORD = { gem: "Gem", flower: "Flower", painting: "Painting", look: "Look", garment: "Garment", film: "Film", painter: "Painter" };
const ARF_ORDER = ["painting", "gem", "flower", "look", "garment", "film", "painter"];
// which section a kind of figure belongs after, by the section's id and title
const ARF_SECTION = {
  painting: /\b(art|arts|paint\w*|canvas|museum|studio|portrait|masters?|galler\w*)\b/i, painter: /\b(painters?|artists?|masters?)\b/i,
  gem: /\b(gems?|jewel\w*|stones?|minerals?|crystals?)\b/i, flower: /\b(plants?|flowers?|botan\w*|garden\w*|bloom\w*|petals?|material|roots?|nature)\b/i,
  look: /\b(fashion|dress\w*|cloth\w*|textiles?|craze|wear|styles?|looks?)\b/i, garment: /\b(fashion|dress\w*|cloth\w*|textiles?|garments?|craze|wear)\b/i,
  film: /\b(films?|cinema|movies?|screen)\b/i
};
const arfCfg = () => (typeof arCfg === "function" ? arCfg() : {});
const arfPoll = (test, ms = ARF_WAIT_MS) => new Promise(done => {
  const t0 = Date.now(), tick = () => { let v = null; try { v = test(); } catch (e) {} if (v) done(v); else if (Date.now() - t0 > ms) done(null); else setTimeout(tick, 120); };
  tick();
});
const arfFetchText = url => fetch(url + (typeof arVer === "function" ? arVer() : "")).then(r => r.ok ? r.text() : null).catch(() => null);
const arfWin = k => (typeof window !== "undefined" ? window[k] : undefined);

// ---------- closeness ----------
function arfDE(a, b) { return de2000(a, b); }
// the palette color nearest to `hex`: { h, i, de } or null
function arfBest(hex, pal) {
  let best = null;
  (pal || []).forEach((h, i) => { if (!/^#[0-9a-f]{6}$/i.test(h || "")) return; const d = arfDE(hex, h); if (!best || d < best.de) best = { h, i, de: d }; });
  return best;
}
const arfPctText = de => typeof pctMatch === "function" ? pctMatch(de) : `${Math.max(0, Math.round(100 - de))}% match`;
const arfLimit = kind => ARF_LIMIT[kind] || ARF_DE;
// a loaded thing (palette, optional cover) against the article's color
function arfScore(base, hex) {
  const best = arfBest(hex, base.pal), cover = typeof base.cover === "function" ? base.cover(hex) : null;
  const de = best ? best.de : 99;
  return { ...base, best, de, cover, pctText: arfPctText(de), ok: !!best && de <= arfLimit(base.kind) && (cover == null || cover >= ARF_MIN_COVER) };
}

// ---------- the datasets ----------
const ARF_CACHE = new Map();      // "kind:id" -> Promise<base | null>
let ARF_IDS = null;               // painting id -> gallery index
const arfIds = () => ARF_IDS || (ARF_IDS = arfFetchText(arfCfg().galleryIds || "data/gallery/ids.txt").then(t => {
  if (!t) { ARF_IDS = null; return new Map(); }
  return new Map(t.split("\n").map((id, i) => [id, i]).filter(x => x[0]));
}));
const arfHex = name => { const c = typeof arColor === "function" ? arColor(name) : null; return c ? c.h : null; };
const arfImgOK = im => im && /^(https?:\/\/|img\/)/.test(im.src || "") ? im : null;
// credit data the source requires: { credit, url, licenseUrl }
const arfImgCredit = im => im ? { credit: String(im.credit || (im.commons ? "Wikimedia Commons" : "")).replace(/^Anonymous\s*(?=Unknown author)/, "").replace(/\s*\(https?:[^)]*\)/g, ""), url: im.commons || "", licenseUrl: im.licenseUrl || "" } : null;

function arfGem(id) {
  return arfPoll(() => arfWin("GEMS")).then(G => {
    const gm = G && G.gems.find(g => g.id === id); if (!gm) return null;
    const nid = "gm:gem:" + id, im = arfImgOK(((G.images || {})[nid] || [])[0] || ((arfWin("GEM_IMAGES") || {})[nid] || [])[0] || gm.img);
    return { kind: "gem", id, name: gm.title, sub: "", pal: (gm.palette || []).map(p => p[0]), palNames: (gm.palette || []).map(p => p[1]),
      img: im && { src: im.src }, credit: arfImgCredit(im), open: self => { if (typeof gmBuildNodes === "function") gmBuildNodes(); openNode(gmNode(nid)); } };
  });
}
function arfFlower(id) {
  return arfPoll(() => arfWin("BOTANY")).then(B => {
    if (!B) return null;
    const p = (B.plants || []).find(x => x.id === id), d = !p && (B.dyes || []).find(x => x.id === id);
    if (!p && !d) return null;
    const nid = (p ? "bt:plant:" : "bt:dye:") + id, im = arfImgOK(((arfWin("BOTANY_IMAGES") || {})[nid] || [])[0]);
    const names = p ? [p.color] : d.colors || [], pal = [], palNames = [];
    names.forEach(n => { const h = arfHex(n); if (h) { pal.push(h); palNames.push(n); } });
    return { kind: "flower", id, name: p ? p.plant.replace(/\s*\(.*\)\s*$/, "") : d.title, sub: p ? "" : "Dye plant", pal, palNames,
      img: im && { src: im.src }, credit: arfImgCredit(im), open: self => { if (typeof btBuildNodes === "function") btBuildNodes(); openNode(btNode(nid)); } };
  });
}
// the four dynamic loaders below only exist in the browser; in the node test they resolve to null
function arfLook(id) {
  const ready = arfWin("LOOKS") ? Promise.resolve(true) : typeof loadData === "function" ? loadData("looks") : Promise.resolve(false);
  return ready.then(() => {
    const look = (arfWin("LOOKS") || []).find(l => l.id === id); if (!look) return null;
    const pal = [], palNames = [], shares = [];
    look.pals.forEach(p => p.c.forEach(c => { pal.push(c[0]); palNames.push(c[1] + (look.pals.length > 1 ? " in " + p.n : "")); shares.push(c[2]); }));
    return { kind: "look", id, name: look.name, sub: [typeof LK_CAT_ONE !== "undefined" && LK_CAT_ONE[look.cat], look.era].filter(Boolean).join(" · "), pal, palNames, shares, img: null, credit: null, note: "One of its palettes, as we chose it",
      open: self => lkOpen(id, { back: arfReturn(self) }) };
  });
}
function arfGarment(id) {
  if (typeof fxLoad !== "function") return Promise.resolve(null);
  return fxLoad().then(d => {
    const r = d && d.byId.get(id); if (!r) return null;
    const mu = fxMuseum(r), img = r.img ? { src: fxThumb(r), noref: true } : null;
    return { kind: "garment", id, name: r.t, sub: fxSub(r), pal: r.p.map(c => c[0]), palNames: r.p.map(c => c[2]), shares: r.p.map(c => c[1]), img,
      credit: img ? { credit: mu.name + (mu.license ? " · " + mu.license : ""), url: r.url || "", licenseUrl: "" } : null,
      open: self => typeof fashionPage === "function" && window.FASHION ? fashionPage("garment-" + id, { back: arfReturn(self) }) : fxGarment(id, { back: arfReturn(self) }) };
  });
}
function arfFilm(id) {
  return arfPoll(() => arfWin("FILMS")).then(F => {
    const f = F && F.find(x => x.id === id); if (!f) return null;
    const cols = (f.palette && f.palette.length ? f.palette.map(c => ({ h: c.h, name: c.app || c.name, share: c.share })) : f.colors.map(c => ({ h: c.h, name: c.name, share: 1 })));
    return { kind: "film", id, name: f.title, sub: [f.year, f.director].filter(Boolean).join(" · "), pal: cols.map(c => c.h), palNames: cols.map(c => c.name), shares: cols.map(c => c.share),
      img: null, credit: null, note: f.early && f.palette && f.palette.length ? "Sampled from the scan" : "The colors the text discusses, chosen by name: no stills", open: self => { if (typeof archWhen === "function") archWhen(() => archOpen(archNode("film", f))); } };
  });
}
function arfPainting(id) {
  if (typeof loadGallery !== "function") return Promise.resolve(null);
  return loadGallery().then(G => {
    const find = /^\d+$/.test(String(id)) ? Promise.resolve(+id) : arfIds().then(m => m.get(id));
    return find.then(i => {
      if (!(i >= 0 && i < G.n)) return null;
      const pal = glPal(i), src = G.src[G.mus[i]] || { name: "Museum" };
      const yr = typeof glYear === "function" ? String(glYear(i) || "") : "", year = yr ? (/BCE/.test(yr) ? -parseInt(yr, 10) : parseInt(yr, 10)) : null;
      const base = { kind: "painting", id, i, year, name: "A painting", sub: "", pal: pal.map(p => p.h), shares: pal.map(p => p.share), img: null, credit: null,
        // the same weighting as the gallery's own badges: each palette color within 12 counts, fading to nothing at 12
        cover: hex => pal.reduce((t, p) => { const d = arfDE(hex, p.h); return d < 12 ? t + p.share * (1 - (d / 12) ** 2) : t; }, 0),
        open: self => galleryPage(i, true, self.h),
        // the title, picture and credit come from the detail shard: loaded only for a painting that is close enough to be shown
        fill: () => glDetail(i).then(d => {
          base.name = d.t; base.sub = [d.a || d.co, glYear(i)].filter(Boolean).join(" · ");
          // d.hi (the detail shard's own high-res field, same one js/gallery.js glPage swaps in after the small
          // copy): without it, a lead picture backed by a local thumbnail (img/gallery/...) stayed at that
          // thumbnail's own small size forever, stretched to the lead box's full width -- blurry (David,
          // 2026-10-09). arfLead below does the same progressive swap glPage does.
          base.img = d.img ? { src: d.img, hi: d.hi || "", cors: /^img\//.test(d.img) || (typeof glCORS === "function" && glCORS(d.img) !== ""), crop: d.crop || null } : null;
          base.credit = { credit: src.name + (src.credit ? " · " + src.credit : ""), url: d.rec || "", licenseUrl: "" };
        }) };
      return base;
    });
  });
}
function arfPainter(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return Promise.resolve(null);
  return arfFetchJSON((arfCfg().analysis || "data/analysis/artists/") + slug + ".json").then(A => {
    if (!A || !Array.isArray(A.clusters)) return null;
    const pal = [], palNames = [], typ = [], shares = [];
    A.clusters.forEach(cl => (cl.colors || []).forEach((n, k) => { const h = arfHex(n); if (h && !pal.includes(h)) { pal.push(h); palNames.push(n); typ.push(cl.typical); shares.push(cl.pct / 100 / Math.max(1, (cl.colors || []).length)); } }));
    if (!pal.length) return null;
    const base = { kind: "painter", id: slug, name: A.name, sub: [A.country, A.n ? A.n + " paintings" : ""].filter(Boolean).join(" · "), pal, palNames, shares, typ, img: null, credit: null,
      open: self => awPainter(slug),
      // the picture is the most typical painting of the family of palettes that holds the closest color
      fill: hex => {
        const b = arfBest(hex, pal), pid = b && typ[b.i]; if (!pid) return Promise.resolve();
        const key = "painting:" + pid;
        return arfFor(key, hex, "light").then(() => ARF_CACHE.get(key)).then(p => p && p.fill ? p.fill().then(() => { base.img = p.img; base.credit = p.credit; }) : null);
      } };
    return base;
  });
}
const ARF_LOADERS = { gem: arfGem, flower: arfFlower, painting: arfPainting, look: arfLook, garment: arfGarment, film: arfFilm, painter: arfPainter };
// "kind:id" + the article's color -> the thing scored against it (and, when it will be shown, filled in), or null
// opt: "light" never loads names and pictures; "always" also loads a painting's title when it is not close (for its chip)
function arfFor(key, hex, opt) {
  const m = /^([a-z]+):(.+)$/.exec(String(key)); if (!m || !ARF_LOADERS[m[1]]) return Promise.resolve(null);
  if (!ARF_CACHE.has(key)) ARF_CACHE.set(key, Promise.resolve().then(() => ARF_LOADERS[m[1]](m[2])).catch(() => null));
  return ARF_CACHE.get(key).then(base => {
    if (!base) return null;
    const t = arfScore(base, hex); t.key = key;
    if (opt === "light" || !base.fill || !(t.ok || (opt === "always" && base.kind === "painting"))) return t;
    return Promise.resolve(base.fill(hex)).catch(() => {}).then(() => arfScore(base, hex)).then(u => { u.key = key; return u; });
  });
}
const arfFetchJSON = url => fetch(url + (typeof arVer === "function" ? arVer() : "")).then(r => r.ok ? r.json() : null).catch(() => null);

// ---------- the twins in data/graph ----------
// data/graph/nodes-<s>.json and edges-<s>.json are parallel arrays: nodes[i].s is the slug, edges[i] its edges
// (tw = twins {gems, films, botany, fashion}: [id, label, dE]; ap = appears in: [paintingId, photo share %, role, weight %]).
const ARF_SHARDS = new Map();
function arfGraphRow(slug) {
  const s = /^[a-z]/.test(slug) ? slug[0] : "_", base = arfCfg().graph || "data/graph/";
  if (!ARF_SHARDS.has(s)) ARF_SHARDS.set(s, Promise.all([arfFetchJSON(base + "nodes-" + s + ".json"), arfFetchJSON(base + "edges-" + s + ".json")]).then(([n, e]) => Array.isArray(n) && Array.isArray(e) ? { n, e } : null));
  return ARF_SHARDS.get(s).then(sh => { if (!sh) return null; const i = sh.n.findIndex(x => x.s === slug); return i >= 0 ? sh.e[i] || null : null; });
}
// every kind:id worth scoring for this article. The twins nominate gems, films and paintings; the nearest flowers and looks are
// found by distance (the botany twins are Werner's 1821 plant pairings, which have no pictures).
async function arfAutoKeys(art, self) {
  const slugs = [...new Set([...(art.names || []).map(n => routeSlug(n)), art.slug, self.slug].filter(Boolean))], keys = [];
  for (const sl of slugs) {
    const e = await arfGraphRow(sl); if (!e) continue;
    const tw = e.tw || {};
    (tw.gems || []).slice(0, 3).forEach(t => keys.push("gem:" + t[0]));
    (tw.films || []).slice(0, 4).forEach(t => keys.push("film:" + String(t[0]).replace(/^film:/, "")));
    (e.ap || []).slice(0, 4).forEach(a => keys.push("painting:" + a[0]));
  }
  const B = await arfPoll(() => arfWin("BOTANY"), 3000);
  if (B) { const imgs = arfWin("BOTANY_IMAGES") || {}; (B.plants || []).forEach(p => { if (imgs["bt:plant:" + p.id]) keys.push("flower:" + p.id); }); (B.dyes || []).forEach(d => { if (imgs["bt:dye:" + d.id]) keys.push("flower:" + d.id); }); }
  const ready = arfWin("LOOKS") ? true : typeof loadData === "function" ? await loadData("looks") : false;
  if (ready) (arfWin("LOOKS") || []).forEach(l => keys.push("look:" + l.id));
  return [...new Set(keys)];
}

// ---------- planning (pure) ----------
// cands: scored things that are ok, any order. secs: [{ id, title }]. taken: ids of sections that already hold a figure,
// skip: keys already shown. Returns { place: { sectionId: [thing] }, end: [thing] }: at most one per kind, one per section,
// ARF_MAX_AUTO in all and ARF_MAX_END in the closing strip.
function arfPlan(secs, cands, taken, skip) {
  const used = new Set(taken || []), seen = new Set(skip || []), kinds = new Set(), place = {}, end = [];
  const rank = t => [ARF_ORDER.indexOf(t.kind), t.kind === "painting" ? -(t.cover || 0) : t.de];
  const sorted = (cands || []).filter(t => t && t.ok).sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1]; });
  let n = 0;
  for (const t of sorted) {
    if (n >= ARF_MAX_AUTO) break;
    if (kinds.has(t.kind) || seen.has(t.key)) continue;
    const re = ARF_SECTION[t.kind], sec = re && secs.find(s => s.id !== "field" && !used.has(s.id) && re.test(s.id + " " + s.title));
    if (sec) { used.add(sec.id); (place[sec.id] = place[sec.id] || []).push(t); }
    else if (end.length < ARF_MAX_END) end.push(t);
    else continue;
    kinds.add(t.kind); seen.add(t.key); n++;
  }
  return { place, end };
}

// ---------- drawing ----------
const arfHttp = u => /^https?:\/\//.test(u || "") ? u : "";
function arfCreditHTML(c) {
  if (!c || !c.credit) return "";
  const t = esc(c.credit), link = arfHttp(c.url) ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${t}</a>` : t;
  return `<figcaption class="ar-fig-cr">${link}${arfHttp(c.licenseUrl) ? ` · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}</figcaption>`;
}
// the picture box: always 112 x 112 (CSS), so nothing moves when the image lands
function arfPicHTML(t) {
  if (t.img && t.img.src) {
    const noref = /^https?:/.test(t.img.src) ? ` referrerpolicy="no-referrer"` : "";
    return `<span class="ar-fig-im" style="--c:${t.best.h}"><img src="${esc(t.img.src)}" alt="" loading="lazy" decoding="async"${t.img.cors ? ` crossorigin="anonymous"` : ""}${noref} onload="this.classList.add('ld')">${t.kind === "painting" || t.kind === "painter" ? `<canvas class="ar-fig-hl" width="1" height="1" aria-hidden="true"></canvas>` : ""}</span>`;
  }
  const sh = t.shares || [], tot = (sh.reduce((a, b) => a + b, 0)) || 1;
  const order = t.pal.map((h, i) => i).sort((a, b) => (sh[b] || 1) - (sh[a] || 1)).slice(0, 8).sort((a, b) => a - b);
  return `<span class="ar-fig-im ar-fig-strip" aria-hidden="true">${order.map(i => `<i style="--c:${t.pal[i]};flex:${Math.max(.06, (sh[i] || 1) / tot).toFixed(3)}"${i === t.best.i ? ` class="on"` : ""}></i>`).join("")}</span>`;
}
// o.wide: a picture that breaks up the text: the full measure, a fixed 4:3 box cropped to where the color sits, the words under it
function arfFigHTML(t, self, o) {
  const wide = !!(o && o.wide && t.img && t.img.src);
  const word = ARF_WORD[t.kind] || "", nm = t.best && t.palNames && t.palNames[t.best.i];
  const sub = [word, t.sub].filter(Boolean).join(" · ");
  const near = t.kind === "painting" || !nm || String(nm).toLowerCase() === String(self.n).toLowerCase() ? "" : ` · ${esc(nm)}`;
  const cov = t.kind === "painting" && t.cover != null ? `<span class="ar-fig-c">${esc(arfCoverPhrase(t.cover))}</span>` : "";
  const aria = `${t.name}${t.sub ? ", " + t.sub : ""}. ${t.pctText} to ${self.n}. Open`;
  return `<figure class="ar-fig${wide ? " ar-wide" : ""}" data-kind="${t.kind}" data-ar-fig="${esc(t.key)}"${o && o.gap ? " data-ar-gap" : ""}>
    <button type="button" class="ar-fig-b" data-ar-ref="${esc(t.key)}" aria-label="${esc(aria)}">${arfPicHTML(t)}
      <span class="ar-fig-tx"><small class="ar-fig-k">${esc(sub)}</small><b class="ar-fig-n">${esc(t.name)}</b>
        <span class="ar-fig-m"><span class="ar-fig-d" aria-hidden="true"><i style="--c:${self.h}"></i><i style="--c:${t.best.h}"></i></span><span>${esc(t.pctText)} to ${esc(self.n)}${near}</span></span>${cov}</span></button>
    ${arfCreditHTML(t.credit) || (!(t.img && t.img.src) && t.note ? `<figcaption class="ar-fig-cr">${esc(t.note)}</figcaption>` : "")}</figure>`;
}
// Where the color sits in a painting: a soft veil over every pixel that is not close to it. Only when the picture can be read
// (our own copies, or a museum server that sends CORS headers); a tainted canvas throws and the card simply stays as it is.
function arfHighlight(fig, hex) {
  const img = fig.querySelector(".ar-fig-im img"), cv = fig.querySelector(".ar-fig-hl");
  if (!img || !cv || !img.getAttribute("crossorigin") && /^https?:/.test(img.getAttribute("src") || "")) return;
  const draw = () => {
    try {
      const box = img.parentNode.getBoundingClientRect(), W = 64, H = Math.max(16, Math.round(64 * (box.height || 1) / (box.width || 1)));
      const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
      const x = tmp.getContext("2d", { willReadFrequently: true }), iw = img.naturalWidth, ih = img.naturalHeight; if (!iw || !ih) return;
      const tl = lab(hex), near = (d, i) => de2000(tl, lab("#" + ((1 << 24) | d[i] << 16 | d[i + 1] << 8 | d[i + 2]).toString(16).slice(1)));
      // a wide box crops the picture: center the crop on where the color sits (its centroid in the whole picture)
      let fx = .5, fy = .5;
      if (fig.classList.contains("ar-wide")) {
        const S = 40, a = document.createElement("canvas"); a.width = S; a.height = S;
        const ax = a.getContext("2d", { willReadFrequently: true }); ax.drawImage(img, 0, 0, S, S);
        const d = ax.getImageData(0, 0, S, S).data; let sx = 0, sy = 0, n = 0;
        for (let i = 0; i < S * S; i++) if (near(d, i * 4) < 9) { sx += i % S + .5; sy += Math.floor(i / S) + .5; n++; }
        if (n >= S * S * .01) { fx = sx / n / S; fy = sy / n / S; img.style.objectPosition = `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`; }
      }
      const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
      x.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
      const px = x.getImageData(0, 0, W, H).data, out = cv.getContext("2d"), o = out.createImageData(W, H);
      let hit = 0;
      for (let i = 0; i < W * H; i++) {
        const d = near(px, i * 4), a = d < 7 ? 0 : d > 18 ? 168 : Math.round((d - 7) / 11 * 168);
        if (d < 7) hit++;
        o.data[i * 4] = 16; o.data[i * 4 + 1] = 15; o.data[i * 4 + 2] = 14; o.data[i * 4 + 3] = a;
      }
      if (hit < W * H * .01) return;   // the color is only in the palette, not visibly in the picture: leave the painting as it is
      cv.width = W; cv.height = H; out.putImageData(o, 0, 0); cv.classList.add("on");
    } catch (e) { /* a tainted canvas: no highlight */ }
  };
  if (img.complete && img.naturalWidth) draw(); else img.addEventListener("load", draw, { once: true });
}
// insert without moving what the reader is looking at: a figure that lands above the viewport pushes the scroll down by its height
function arfInsert(root, put) {
  const sc = typeof arScroller === "function" ? arScroller() : null, h0 = sc ? sc.scrollHeight : 0, y0 = sc ? sc.scrollTop : 0;
  const el = put(); if (!el || !sc) return el;
  const above = el.getBoundingClientRect().bottom <= (sc === document.body ? 0 : sc.getBoundingClientRect().top);
  if (above && y0 > 0) sc.scrollTop = y0 + (sc.scrollHeight - h0);
  return el;
}
function arfPutFig(root, t, self, where, o) {
  const tpl = document.createElement("template"); tpl.innerHTML = arfFigHTML(t, self, o).trim();
  const fig = tpl.content.firstElementChild;
  arfInsert(root, () => { where(fig); return fig; });
  if (t.kind === "painting" || t.kind === "painter") arfHighlight(fig, self.h);
  return fig;
}

// chips: the real name replaces a guess; a reference that resolves to nothing becomes plain text
function arfFixChips(root, resolved) {
  root.querySelectorAll("[data-ar-ref]").forEach(ch => {
    if (!ch.classList.contains("ar-ref")) return;
    const key = ch.dataset.arRef;
    if (!resolved.has(key)) return;
    const t = resolved.get(key);
    if (!t) { const sp = document.createElement("span"); sp.className = "ar-ref ar-x"; sp.textContent = ch.textContent; ch.replaceWith(sp); return; }
    if (ch.hasAttribute("data-ar-guess")) { const s = ch.querySelector("span"); if (s) s.textContent = t.name; ch.removeAttribute("data-ar-guess"); }
  });
}
const arfInTime = art => {
  const since = art.tier === "pigment" ? +((String((art.aside && art.aside.origin && art.aside.origin.first_recorded) || "").match(/\b(1[5-9]\d\d)\b/) || [])[1] || 0) : 0;
  return t => !(since && t && t.kind === "painting" && t.year != null && t.year < since - 10);
};
async function arfEnhance(root, art, self) {
  if (!root || !self || !/^#[0-9a-f]{6}$/i.test(self.h || "")) return;
  const alive = () => root.isConnected;
  const shown = new Set(), secsWith = new Set(), shownIdx = new Set();   // shownIdx: gallery indexes already on the page
  const lead = root.__lead ? await root.__lead.catch(() => null) : null;   // the lead picture (arfLead) is already on the page: never show it twice
  if (lead && lead.key) { shown.add(lead.key); if (lead.i != null) shownIdx.add(lead.i); }
  const secOf = el => { const s = el.closest("[data-ar-sec]"); return s ? s.dataset.arSec : null; };
  // 1. explicit references
  const ps = [...root.querySelectorAll("p[data-ar-refs]")];
  const keys = [...new Set(ps.flatMap(p => p.dataset.arRefs.split(/\s+/).filter(Boolean)))];
  const got = new Map();
  await Promise.all(keys.map(k => arfFor(k, self.h, "always").then(t => got.set(k, t))));
  if (!alive()) return;
  arfFixChips(root, got);
  ps.forEach(p => {
    const list = p.dataset.arRefs.split(/\s+/).map(k => got.get(k)).filter(t => t && t.ok && !shown.has(t.key)).slice(0, ARF_MAX_PER_P);
    let at = p;
    list.forEach(t => { shown.add(t.key); if (t.i != null) shownIdx.add(t.i); const prev = at; at = arfPutFig(root, t, self, f => prev.after(f), { wide: true }); });
    if (list.length) { const s = secOf(p); if (s) secsWith.add(s); }
  });
  // 2. the nearest twins, placed in the section they belong to
  const cand = await arfAutoKeys(art, self);
  if (!alive()) return;
  // a pigment's story shows no painting made before the pigment was (a 1474 panel in a Prussian-blue-like color would read as a claim)
  const inTime = arfInTime(art);
  const things = (await Promise.all(cand.filter(k => !shown.has(k)).map(k => arfFor(k, self.h, "light")))).filter(t => t && inTime(t));
  if (!alive()) return;
  const plan = arfPlan(art.sections.filter(s => s.title).map(s => ({ id: s.id, title: s.title })), things, secsWith, shown);
  const chosen = [...Object.values(plan.place).flat(), ...plan.end];
  const filled = new Map();
  await Promise.all(chosen.map(t => arfFor(t.key, self.h).then(u => filled.set(t.key, u))));   // the full pass loads names and pictures for the few that will show
  if (!alive()) return;
  Object.entries(plan.place).forEach(([sid, list]) => {
    const sec = root.querySelector(`[data-ar-sec="${CSS.escape(sid)}"]`); if (!sec) return;
    list.forEach(t0 => {
      const t = filled.get(t0.key); if (!t || !t.ok) return;
      shown.add(t.key); if (t.i != null) shownIdx.add(t.i);
      const gap = arfGaps(sec)[0];   // inside the chapter's first long run of text, else at its end
      arfPutFig(root, t, self, f => { if (gap) return gap.after(f); const acts = sec.querySelector(".ar-acts"); acts ? acts.before(f) : sec.append(f); }, { wide: true });
    });
  });
  // 3. pictures for the long runs of text that are left (David, 2026-10-08: "any picture breaks it up"): the twins that would
  //    have waited for the closing strip, then the paintings that hold this color most, interleaved, each still inside the threshold
  let endList = plan.end.map(t => filled.get(t.key)).filter(t => t && t.ok);
  const gaps = arfGaps(root).slice(0, ARF_GAP_MAX);
  if (gaps.length) {
    let paint = [];
    if (typeof loadGallery === "function" && typeof npGalleryHits === "function") {
      try { await loadGallery(); paint = npGalleryHits(self.h, 6).filter(h => !shownIdx.has(h[0]) && inTime({ kind: "painting", year: parseInt(glYear(h[0]), 10) || null })).slice(0, gaps.length + 3).map(h => "painting:" + h[0]); } catch (e) { paint = []; }
    }
    if (!alive()) return;
    const extra = things.filter(t => t.ok && !shown.has(t.key) && !chosen.some(c => c.key === t.key) && t.kind !== "painting").sort((a, b) => a.de - b.de).slice(0, 4).map(t => t.key);
    const others = [...endList.map(t => t.key), ...extra];
    const order = []; for (let k = 0; k < Math.max(paint.length, others.length); k++) { if (paint[k]) order.push(paint[k]); if (others[k]) order.push(others[k]); }
    const pool = (await Promise.all(order.slice(0, gaps.length + 4).map(k => arfFor(k, self.h)))).filter(t => t && t.ok && inTime(t) && !(t.kind === "painting" && (!t.img || shownIdx.has(t.i))));
    if (!alive()) return;
    const seenNames = new Set();
    gaps.forEach(g => {
      let t = pool.shift();
      while (t && t.kind === "painting" && seenNames.has(t.name)) t = pool.shift();   // one picture per painting, even when the archive holds two photographs of it
      if (!t || !g.isConnected) return;
      if (t.kind === "painting") { seenNames.add(t.name); shownIdx.add(t.i); }
      shown.add(t.key);
      arfPutFig(root, t, self, f => g.after(f), { wide: true, gap: true });
    });
    endList = endList.filter(t => !shown.has(t.key));
  }
  if (endList.length) {
    const host = document.createElement("section"); host.className = "ar-seen"; host.setAttribute("aria-label", "Seen in");
    host.innerHTML = `<h3 class="ar-seen-h">Seen in</h3>`;
    const before = root.querySelector(".ar-fam, .ar-you, .ar-qs, .ar-notes");
    arfInsert(root, () => { before ? before.before(host) : root.append(host); return host; });
    endList.forEach(t => arfPutFig(root, t, self, f => host.append(f)));
  }
}
// The long runs of plain text in a chapter: the paragraphs after which a picture should go. A run ends at anything that isn't a
// paragraph (a figure, a plate, a quotation, a callout). A picture goes after the 2nd paragraph of a run when 2 more follow,
// else after the 3rd when one more follows: about one picture every 2-3 paragraphs, never right before a heading.
const ARF_GAP_MAX = 10;
function arfGaps(scope) {
  const out = [], secs = scope.matches && scope.matches(".ar-sec") ? [scope] : [...scope.querySelectorAll(".ar-sec")];
  secs.forEach(sec => {
    const kids = [...sec.children], isP = el => !!el && el.tagName === "P" && !el.classList.contains("ar-chk");
    let run = 0;
    kids.forEach((el, i) => {
      if (isP(el)) {
        run++;
        let k = 0; for (let j = i + 1; isP(kids[j]); j++) k++;
        if ((run >= 2 && k >= 2) || (run >= 3 && k >= 1)) { out.push(el); run = 0; }
      } else if (el.tagName !== "H2" && !el.classList.contains("ar-chk")) run = 0;
    });
  });
  return out;
}


// ---------- the lead picture (David, 2026-10-08: articles almost always open with a picture) ----------
// In order: the color's own image (data/images.js), else the painting that holds the color most, else the closest gem or flower.
// Same honesty rule as the figures above (ΔE <= 15, paintings >= 2% of the canvas, nothing from before a pigment existed);
// when nothing qualifies there is no lead, never a far match.
const ARF_LEAD_AB = .625;   // the box's height / width (16:10): fixed, so nothing moves when the picture lands
function arfLeadOwn(art, self) {
  const W = arfWin("WIKI_IMAGES") || {};
  const keys = [self.n, art.name, ...(art.names || []), self.slug, art.slug].filter(Boolean);
  for (const k of keys) {
    const f = arfImgOK((W[k] || [])[0]); if (!f) continue;
    return { kind: "own", lead: "own", key: "", name: self.n, img: { src: f.src }, credit: arfImgCredit(f), caption: f.caption || "", best: { h: self.h, i: 0, de: 0 } };
  }
  return null;
}
// painting keys worth scoring: the twins' paintings (data/graph) plus the nearest in the whole gallery
async function arfLeadPaintings(art, self, row) {
  const keys = ((row && row.ap) || []).slice(0, 6).map(a => "painting:" + a[0]);
  try {
    if (typeof loadGallery === "function") await loadGallery();
    if (typeof npGalleryHits === "function") npGalleryHits(self.h, 6).slice(0, 8).forEach(h => keys.push("painting:" + h[0]));
  } catch (e) {}
  return [...new Set(keys)];
}
async function arfLeadPick(art, self) {
  if (!art || !self || !/^#[0-9a-f]{6}$/i.test(self.h || "")) return null;
  if (typeof loadWiki === "function") { try { await loadWiki(); } catch (e) {} }
  // self.tapped (js/article.js articleRenderSplit's leadSelf): an in-between color's own lead should match the
  // exact hex the visitor tapped, not the named color's unrelated contextual photo (David, 2026-10-09: "the
  // lead picture should match the user's color, and say which") -- skip straight to the scored painting/gem/
  // flower search below, which already keys off self.h (here, the tapped hex).
  const own = self.tapped ? null : arfLeadOwn(art, self); if (own) return own;
  const inTime = arfInTime(art);
  let row = null;
  for (const sl of [...new Set([art.slug, self.slug, ...(art.names || []).map(n => routeSlug(n))].filter(Boolean))]) { row = await arfGraphRow(sl); if (row) break; }
  // 1. the painting that holds this color most (and has a picture)
  const pk = await arfLeadPaintings(art, self, row);
  const ps = (await Promise.all(pk.map(k => arfFor(k, self.h, "light")))).filter(t => t && t.ok && inTime(t)).sort((a, b) => (b.cover || 0) - (a.cover || 0));
  for (const c of ps.slice(0, 5)) {
    const t = await arfFor(c.key, self.h);
    if (t && t.ok && t.img && t.img.src) { t.lead = "painting"; return t; }
  }
  // 2. the closest gem or flower that has a picture
  const keys = [];
  const G = await arfPoll(() => arfWin("GEMS"), 3000);
  if (G) (G.gems || []).forEach(g => keys.push("gem:" + g.id));
  const B = await arfPoll(() => arfWin("BOTANY"), 3000);
  if (B) { (B.plants || []).forEach(p => keys.push("flower:" + p.id)); (B.dyes || []).forEach(d => keys.push("flower:" + d.id)); }
  const cs = (await Promise.all(keys.map(k => arfFor(k, self.h, "light")))).filter(t => t && t.ok && t.img && t.img.src).sort((a, b) => a.de - b.de);
  if (cs[0]) { cs[0].lead = cs[0].kind; return cs[0]; }
  return null;
}
// A museum label (David, 2026-10-09): the painting's own title and painter/year (t.sub, from the gallery's
// detail shard), then how much of the canvas and how close a match -- "a small accent, about 1% of the canvas"
// below ARF_MIN_COVER's own honesty line, otherwise "about 18% of the canvas". Same line for every painting
// figure (arfFigHTML below reuses arfCoverPhrase), so the color page never shows two different captions for the
// same kind of fact.
const arfCoverPct = c => Math.max(1, Math.round(c * 100));
function arfCoverPhrase(c) { return c == null ? "" : c < .02 ? `a small accent, about ${arfCoverPct(c)}% of the canvas` : `about ${arfCoverPct(c)}% of the canvas`; }
const arfCapFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
function arfLeadHTML(t, self) {
  const own = t.kind === "own", src = t.img.src;
  const big = t.kind === "painting" && typeof glBig === "function" ? glBig(src) : src;
  // Plain object-fit:cover, always (David, 2026-10-09: the computed crop transform left a white strip on one
  // edge when a photo's real aspect didn't exactly match the lead box's 16:10 -- not worth the risk box-wide).
  const noref = /^https?:/.test(big) ? ` referrerpolicy="no-referrer"` : "";
  // data-hi: the real, full-size museum image (same field js/gallery.js glPage swaps in after this small copy);
  // arfLead below wires the swap once the figure is actually in the page.
  const hiAttr = t.img.hi ? ` data-hi="${esc(t.img.hi)}"` : "";
  const im = `<span class="ar-lead-im" style="--c:${t.best.h}"><img src="${esc(big)}" alt="${own ? esc(t.caption || self.n) : ""}" loading="lazy" decoding="async"${noref}${hiAttr} onload="this.classList.add('ld')"></span>`;
  const covLine = t.kind === "painting" && t.cover != null ? arfCoverPhrase(t.cover) : "";
  // t.pctText (arfPctText -> pctMatch) already reads "98% match" on its own -- appending a second literal
  // "match" after it read as "98% match match" (David, 2026-10-09). Always say what it's a match *to*, so a
  // tapped color's own lead (self.n "your color") reads unambiguously, not just implied by page context.
  const matchTxt = covLine ? `${esc(arfCapFirst(covLine))} · ${esc(t.pctText)} to ${esc(self.n)}` : `${esc(t.pctText)} to ${esc(self.n)}`;
  // Title first (what you're looking at), then who/when, then the match line -- a museum label reads top to
  // bottom in that order; this used to lead with "Painting · <artist> · <year>" ahead of the title itself,
  // which read as a run-on (David, 2026-10-09).
  const cap = own ? `<span class="ar-lead-n">${esc(t.caption || self.n)}</span>`
    : `<b class="ar-lead-n">${esc(t.name)}</b>${t.sub ? `<span class="ar-lead-k">${esc(t.sub)}</span>` : (ARF_WORD[t.kind] ? `<span class="ar-lead-k">${esc(ARF_WORD[t.kind])}</span>` : "")}<span class="ar-lead-m"><span class="ar-fig-d" aria-hidden="true"><i style="--c:${self.h}"></i><i style="--c:${t.best.h}"></i></span>${matchTxt}</span>`;
  const credit = arfCreditHTML(t.credit).replace("ar-fig-cr", "ar-lead-cr");
  const aria = ` aria-label="${esc(`${t.name}${t.sub ? ", " + t.sub : ""}. ${covLine ? arfCapFirst(covLine) + ". " : ""}${t.pctText} to ${self.n}. Open`)}"`;
  return `<figure class="ar-lead" data-kind="${t.kind}" data-ar-lead="${esc(t.key || "own")}">${own ? im + `<div class="ar-lead-tx">${cap}</div>`
    : `<button type="button" class="ar-lead-b" data-ar-ref="${esc(t.key)}"${aria}>${im}<span class="ar-lead-tx">${cap}</span></button>`}${credit}</figure>`;
}
// Finds and places the lead picture. place(fig) puts the element in the page (return false to cancel). Resolves to the picked thing, or null.
function arfLead(place, art, self) {
  return arfLeadPick(art, self).catch(() => null).then(t => {
    if (!t) return null;
    const tpl = document.createElement("template"); tpl.innerHTML = arfLeadHTML(t, self).trim();
    const fig = tpl.content.firstElementChild;
    fig.addEventListener("click", e => { const b = e.target.closest("[data-ar-ref]"); if (b) { e.stopPropagation(); arfOpen(b.dataset.arRef, self); } });
    const r = arfInsert(null, () => { const ok = place(fig); return ok === false ? null : fig; });
    // swap in the big image when it arrives, same as js/gallery.js glPage does for the painting page itself
    // (David, 2026-10-09: the lead picture "is blurry -- a low-res thumbnail upscaled to full width"). A
    // Commons URL goes through glCommonsResolve first (its own Special:FilePath can't be read with crossorigin).
    if (r) {
      const hiImg = fig.querySelector("img[data-hi]");
      if (hiImg && typeof glCommonsFilename === "function") {
        const swap = (url, cors) => {
          const big = new Image(); if (cors) big.crossOrigin = "anonymous";
          big.onload = () => { if (hiImg.isConnected) { if (cors) hiImg.crossOrigin = "anonymous"; hiImg.src = big.src; } };
          big.onerror = () => {};   // quietly keep the small copy if even the fallback fails
          big.src = url;
        };
        const hiUrl = hiImg.dataset.hi, commonsFn = glCommonsFilename(hiUrl);
        if (commonsFn) glCommonsResolve(hiUrl, 1200).then(resolved => swap(resolved || hiUrl, !!resolved));
        else swap(hiUrl, !!(typeof glCORS === "function" && glCORS(hiUrl)));
      }
    }
    return r ? t : null;
  });
}

// ---------- opening ----------
// where the Back button of a page that keeps no trail of its own (a look, a garment) returns to: the article's color
const arfReturn = self => () => { try { if (typeof XSTACK !== "undefined") XSTACK.pop(); } catch (e) {} if (typeof arOpenColor === "function") arOpenColor(self.slug); };
function arfOpen(key, self) {
  const m = /^([a-z]+):(.+)$/.exec(String(key)); if (!m || !ARF_LOADERS[m[1]]) return;
  if (!ARF_CACHE.has(key)) arfFor(key, self.h, "light");
  if (typeof buzz === "function") buzz(4);
  ARF_CACHE.get(key).then(base => {
    if (!base) return typeof toast === "function" ? toast("That one isn't in the collection yet") : undefined;
    return base.open(self);
  }).catch(() => { if (typeof toast === "function") toast("That page didn't load"); });
}
