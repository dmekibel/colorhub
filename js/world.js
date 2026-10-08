"use strict";
// The World lens (Explore → World): color seen through the wider world, starting with Fashion. Other agents
// add Botany and Gems later by pushing another entry onto WORLD_SECTIONS (see worldMount below) — this file
// only owns the "fashion" entry and the fashion*() screens. Data lives in data/fashion.js (window.FASHION).
// Addresses: #/explore/world (the lens) and #/fashion/<slug> (decades, decade-<id>, coty, houses, house-<id>,
// history, history-<id>) via router.js. All top-level names here start with "world" or "fashion".

// Sections the World lens shows, each { key, title, render(host) }. Push more from other files, after load.
let WORLD_SECTIONS = [];

// ---------- link rendering: [[Color Name|label]] resolves through the color/wiki graph (graph.js);
// [[#history:<id>|label]] resolves to one of this file's own history pages. ----------
function worldLinkText(s) {
  if (!s) return "";
  const g = graph();
  return esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, l) => {
    t = t.trim();
    const label = l || t;
    if (t.startsWith("#history:")) return `<a class="wl" data-fashion-to="history:${esc(t.slice(9))}">${label}</a>`;
    const n = g.resolve(t.replace(/&amp;/g, "&"));
    if (!n) return label;
    if (n.kind === "color") return `<a class="wl wl-c" style="--c:${n.h}" data-to="${esc(n.id)}">${label}</a>`;
    return `<a class="wl" data-to="${esc(n.id)}">${label}</a>`;
  });
}
// Wires both kinds of link inside a screen. `selfRender` re-draws the current screen, so a fashion-history
// link clicked from inside it has somewhere sensible to go back to.
function worldWire(el, selfRender) {
  wireLinks(el);
  el.querySelectorAll("[data-fashion-to]").forEach(a => a.onclick = e => {
    e.preventDefault();
    const [kind, id] = a.dataset.fashionTo.split(":");
    fashionPage(kind + "-" + id, { back: selfRender || (() => fashionPage(kind)) });
  });
}
const worldTop = (title) => `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">${esc(title || "Fashion")}</span><span style="width:44px"></span></header>`;
function worldBackWire(el, opts, fallback) {
  const back = () => (opts && opts.back ? opts.back() : fallback());
  const b = el.querySelector("[data-back]"); if (b) b.onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  return back;
}
// A hotlinked Commons image (no local copy): { thumb, w, h, alt, caption, credit, licenseUrl, commons }.
function worldImgHTML(img) {
  if (!img) return "";
  return `<figure class="fig"><img src="${esc(img.thumb)}" alt="${esc(img.alt || "")}" loading="lazy"${img.w ? ` width="${img.w}" height="${img.h}"` : ""} referrerpolicy="no-referrer">
    <figcaption>${esc(img.caption || "")}<span>${img.commons ? `<a href="${esc(img.commons)}" target="_blank" rel="noopener">${esc(img.credit || "Wikimedia Commons")}</a>` : esc(img.credit || "")}${img.licenseUrl ? ` · <a href="${esc(img.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}</span></figcaption></figure>`;
}

// ---------------------------------------------------------------- the World lens itself
// Each section gets a heading and, if there's more than one, a contents row above them all.
function worldMount(host) {
  host.innerHTML = `
    ${WORLD_SECTIONS.length > 1 ? `<nav class="toc x-toc" aria-label="Contents"><span class="eyebrow">Contents</span>${WORLD_SECTIONS.map(s => `<a data-wd-jump="${esc(s.key)}">${esc(s.title)}</a>`).join("")}</nav>` : ""}
    ${WORLD_SECTIONS.map(s => `<div class="sec-head x-sec" id="wd-sec-${esc(s.key)}"><b>${esc(s.title)}</b></div><div data-wd-section="${esc(s.key)}"></div>`).join("")}
  `;
  WORLD_SECTIONS.forEach(s => { const b = host.querySelector(`[data-wd-section="${s.key}"]`); if (b) { try { s.render(b); } catch (e) {} } });
  host.querySelectorAll("[data-wd-jump]").forEach(a => a.onclick = () => { const t = host.querySelector("#wd-sec-" + a.dataset.wdJump); if (t) t.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); });
}

// ---------------------------------------------------------------- Fashion history (data/fashion-history.js, lazy)
// 25 pages in titled sections. Ten replace the shorter pages of the same id in data/fashion.js (their photos are kept);
// fifteen are new. Until the file arrives (or if it can't), the ten short pages are what the list shows.
DATA_SRC["fashion-history"] = "data/fashion-history.js";
const worldHistory = () => {
  const old = new Map(FASHION.history.map(h => [h.id, h]));
  if (!window.FASHION_HISTORY) return FASHION.history;
  const merged = window.FASHION_HISTORY.map(h => ({ ...(old.get(h.id) || {}), ...h, img: (old.get(h.id) || {}).img }));
  FASHION.history.forEach(h => { if (!merged.some(x => x.id === h.id)) merged.push(h); });
  return merged;
};
const worldWhenHistory = fn => window.FASHION_HISTORY ? fn() : loadData("fashion-history").then(() => fn());

// ---------------------------------------------------------------- Fashion: the section inside World
// A contents row of its own four parts; each opens a list screen, which opens a detail screen.
// A World tile is a small cover: a picture or a color graphic on top, the title and a line under it.
const wdTile = (attr, title, sub, art) => `<button class="wd-tile wd-cover" ${attr}><span class="wd-art">${art}</span><b>${esc(title)}</b><span class="wd-sub">${esc(sub)}</span></button>`;
const wdStripes = rows => `<span class="wd-rows">${rows.map(r => `<i>${r.map(h => `<em style="--c:${h}"></em>`).join("")}</i>`).join("")}</span>`;
const wdGrid = hexes => `<span class="wd-grid">${hexes.map(h => `<em style="--c:${h}"></em>`).join("")}</span>`;
const wdBars = hexes => `<span class="wd-bars">${hexes.map(h => `<em style="--c:${h}"></em>`).join("")}</span>`;
const wdImg = (src, fallback = "") => src ? `<img src="${esc(src)}" alt="" loading="lazy">` : fallback;
function worldFashionSection(host) {
  const histImg = ((FASHION.history.find(h => h.img) || {}).img || {}).thumb;
  const tiles = [
    ["decades", "Decades", `${FASHION.decades.length} decades, 1900s–2020s`, wdStripes(FASHION.decades.map(d => d.swatches.map(s => s[0])))],
    ["coty", "Color of the year", "Pantone's picks, 2000–present", wdGrid(FASHION.coty.map(c => c.hex))],
    ["houses", "Houses", `${FASHION.houses.length} signature colors`, wdBars(FASHION.houses.map(h => h.hex))],
    ["history", "History", `${FASHION.history.length} pages`, wdImg(histImg, wdBars(["#4B1E4F", "#16171A", "#F3EFE6", "#6B7A3A", "#1C2B5A"]))],
    ["garments", "Garments", "Museum pieces, searchable by color", wdBars(["#7A2C55", "#C9A54A", "#1C2B5A", "#A33B4B", "#6B7A3A", "#EFEBE3"])]
  ];
  host.innerHTML = `<p class="x-sub">${esc(FASHION.dek)}</p>
    <div class="wd-tiles">${tiles.map(([k, t, s, art]) => wdTile(`data-wd="${k}"`, t, s, art).replace("wd-tile", k === "garments" ? "wd-tile wd-wide" : "wd-tile")).join("")}</div>`;
  host.querySelectorAll("[data-wd]").forEach(b => b.onclick = () => fashionPage(b.dataset.wd));
  if (typeof fxTileArt === "function") fxTileArt(host.querySelector('[data-wd="garments"]'));   // js/fashion.js: photos and the count, once the archive is in
  worldWhenHistory(() => { const t = host.querySelector('[data-wd="history"] .wd-sub'); if (t && window.FASHION_HISTORY) t.textContent = `${worldHistory().length} pages`; });
}
WORLD_SECTIONS.push({ key: "fashion", title: "Fashion", render: worldFashionSection });

// ---------------------------------------------------------------- routing: fashionPage(slug) is the one
// screen function the router wraps (js/router.js ROUTED). slug: decades | decade-<id> | coty | houses |
// house-<id> | history | history-<id>.
function worldRouteTitle(slug) {
  const i = slug.indexOf("-"), kind = i < 0 ? slug : slug.slice(0, i), id = i < 0 ? null : slug.slice(i + 1);
  if (kind === "decades") return "Decades";
  if (kind === "decade") { const d = FASHION.decades.find(x => x.id === id); return d ? d.label : "Decade"; }
  if (kind === "coty") return "Pantone Color of the Year";
  if (kind === "houses") return "Houses and signature colors";
  if (kind === "house") { const h = FASHION.houses.find(x => x.id === id); return h ? h.house : "House"; }
  if (kind === "history" && !id) return "Fashion history";
  if (kind === "history") { const h = worldHistory().find(x => x.id === id); return h ? h.title : "Fashion history"; }
  if (kind === "garments") return "Garments";
  if (kind === "garment") { const r = typeof FX !== "undefined" && FX && FX.byId.get(id); return r ? r.t : "Garment"; }
  return "Fashion";
}
function fashionPage(slug, opts = {}) {
  if (!window.FASHION) return fashionFallback();
  const i = (slug || "").indexOf("-"), kind = i < 0 ? slug : slug.slice(0, i), id = i < 0 ? null : slug.slice(i + 1);
  if (kind === "decades") return fashionList("decade", opts);
  if (kind === "decade" && id) return fashionDecadeDetail(id, opts);
  if (kind === "coty") return fashionCoty(opts);
  if (kind === "houses") return fashionList("house", opts);
  if (kind === "house" && id) return fashionHouseDetail(id, opts);
  if (kind === "history" && !id) return fashionList("history", opts);
  if (kind === "history" && id) return fashionHistoryDetail(id, opts);
  if (kind === "garments" && typeof fxBrowser === "function") return fxBrowser(opts);   // js/fashion.js
  if (kind === "garment" && id && typeof fxGarment === "function") return fxGarment(id, opts);
  return fashionFallback();
}
function fashionFallback() { xToOrigin(); }   // where the trail started (js/explore.js), never a guessed room

// ---------------------------------------------------------------- list screens (decades / houses / history)
const FASHION_LIST_META = {
  decade: { title: "Decades", dek: "The defining colors of each decade's fashion, from the Edwardian 1900s to the still-unfinished 2020s." },
  house: { title: "Houses and signature colors", dek: "Fifteen colors fashion houses made their own, with the story behind each and how firm the claim really is." },
  history: { title: "Fashion history", dek: "How color in dress has carried law, rank, grief, war and fast-changing taste, from Roman purple to fast fashion." }
};
function fashionCardHTML(kind, it) {
  const sw = kind === "house" ? [[it.hex]] : it.swatches;
  const title = kind === "decade" ? it.label : kind === "house" ? it.house : it.title;
  const sub = kind === "decade" ? it.years : kind === "house" ? it.label : it.dek;
  const slug = (kind === "decade" ? "decade-" : kind === "house" ? "house-" : "history-") + it.id;
  return `<button class="wd-card" data-wd-open="${esc(slug)}">
    <span class="mini-pal">${sw.map(x => `<i style="--c:${x[0]}"></i>`).join("")}</span>
    <b>${esc(title)}</b><small>${esc(sub || "")}</small>
  </button>`;
}
function fashionList(kind, opts = {}) {
  if (kind === "history" && !window.FASHION_HISTORY) { const el = fashionListDraw(kind, opts); worldWhenHistory(() => { if (window.FASHION_HISTORY && el.isConnected) { const y = scrollY; fashionListDraw(kind, opts); scrollTo(0, y); } }); return el; }
  return fashionListDraw(kind, opts);
}
function fashionListDraw(kind, opts = {}) {
  const items = kind === "decade" ? FASHION.decades : kind === "house" ? FASHION.houses : worldHistory();
  const meta = FASHION_LIST_META[kind];
  const el = show(`
    ${worldTop("Fashion")}
    <h1 class="p-title">${esc(meta.title)}</h1>
    <p class="p-dek">${esc(meta.dek)}</p>
    <div class="wd-list">${items.map(it => fashionCardHTML(kind, it)).join("")}</div>
    ${kind === "decade" ? `<p class="fine">Palettes describe fashionable Paris, London and New York at their most photographed; they are not a record of what everyone wore.</p>` : ""}
  `, "article wd");
  worldBackWire(el, opts, fashionFallback);
  el.querySelectorAll("[data-wd-open]").forEach(b => b.onclick = () => fashionPage(b.dataset.wdOpen, { back: () => fashionList(kind, opts) }));
  return el;
}

// ---------------------------------------------------------------- detail: a decade
function fashionDecadeDetail(id, opts = {}) {
  const d = FASHION.decades.find(x => x.id === id);
  if (!d) return fashionList("decade", opts);
  const self = () => fashionDecadeDetail(id, opts);
  const el = show(`
    ${worldTop("Decades")}
    <div class="palette wd-dpal">${d.swatches.map(([h]) => `<button class="pal" data-swatch="${h}" style="--c:${h};flex:1" data-ink="${ink(h)}"></button>`).join("")}</div>
    <p class="eyebrow p-type">Fashion · Decade</p>
    <h1 class="p-title">${esc(d.label)}</h1>
    <p class="p-dek">${esc(d.years)}</p>
    <div class="pal-names">${d.swatches.map(([h, label]) => `<button class="pal-name" data-swatch="${h}"><i style="--c:${h}"></i><b>${esc(label)}</b><em class="mono">${esc(h)}</em></button>`).join("")}</div>
    <section class="wd-sec"><h3>Why these colors</h3><p>${worldLinkText(d.why)}</p></section>
    ${d.pieces && d.pieces.length ? `<section class="wd-sec"><h3>Iconic pieces</h3><ul class="wd-pieces">${d.pieces.map(p => `<li>${worldLinkText(p)}</li>`).join("")}</ul></section>` : ""}
    ${d.hedge ? `<p class="fine">${esc(d.hedge)}</p>` : ""}
    ${worldImgHTML(d.img)}
    ${sourcesHTML(d.sources)}
  `, "article wd");
  worldBackWire(el, opts, () => fashionList("decade", {}));
  worldWire(el, self);
  return el;
}

// ---------------------------------------------------------------- detail: a house
function fashionHouseDetail(id, opts = {}) {
  const h = FASHION.houses.find(x => x.id === id);
  if (!h) return fashionList("house", opts);
  const self = () => fashionHouseDetail(id, opts);
  const el = show(`
    ${worldTop("Houses")}
    <div class="z-hero z-color" data-swatch="${h.hex}" style="--c:${h.hex}" data-ink="${ink(h.hex)}"><span class="eyebrow">${esc(h.house)}</span><h1>${esc(h.label)}</h1><span class="mono">${esc(h.hex)}</span></div>
    ${h.body ? `<p class="z-sum">${worldLinkText(h.body)}</p>` : ""}
    ${h.hedge ? `<p class="fine">${esc(h.hedge)}</p>` : ""}
    ${sourcesHTML(h.sources)}
  `, "article wd");
  worldBackWire(el, opts, () => fashionList("house", {}));
  worldWire(el, self);
  return el;
}

// ---------------------------------------------------------------- detail: a history page
function fashionHistoryDetail(id, opts = {}) {
  if (!window.FASHION_HISTORY) {   // the long versions load lazily: draw the short page now, the full one when it lands
    const el = fashionHistoryDraw(id, opts);
    worldWhenHistory(() => { if (window.FASHION_HISTORY && el && el.isConnected) { const y = scrollY; ROUTE_REPLACE = true; fashionHistoryDraw(id, opts); scrollTo(0, y); } });
    return el;
  }
  return fashionHistoryDraw(id, opts);
}
function fashionHistoryDraw(id, opts = {}) {
  const h = worldHistory().find(x => x.id === id);
  if (!h) return fashionList("history", opts);
  const self = () => fashionHistoryDetail(id, opts);
  const sw = h.swatches || [];
  const el = show(`
    ${worldTop("Fashion history")}
    ${sw.length ? `<div class="p-hero">${sw.map(([hex, label]) => `<div style="--c:${hex}" data-swatch="${hex}" data-ink="${ink(hex)}" title="${esc(label)}"><span>${esc(label)}</span></div>`).join("")}</div>` : ""}
    <p class="eyebrow p-type">Fashion history</p>
    <h1 class="p-title">${esc(h.title)}</h1>
    ${h.dek ? `<p class="p-dek">${worldLinkText(h.dek)}</p>` : ""}
    ${worldImgHTML(h.img)}
    ${(h.lead || h.body || []).map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}
    ${(h.sections || []).map(x => `<section class="wd-sec"><h3>${esc(x.title)}</h3>${x.text.map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}</section>`).join("")}
    ${(h.colors || []).length ? `<section class="wd-sec"><h3>Colors in this story</h3><div class="chips-wrap">${h.colors.map(cn => { const x = graph().resolve(cn); return x ? `<button class="pchip" data-to="${esc(x.id)}"><i style="--c:${x.h}"></i>${esc(x.title)}</button>` : ""; }).join("")}</div></section>` : ""}
    ${h.facts && h.facts.length ? `<dl class="facts">${h.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    ${sourcesHTML(h.sources)}
  `, "article wd");
  worldBackWire(el, opts, () => fashionList("history", {}));
  worldWire(el, self);
  return el;
}

// ---------------------------------------------------------------- detail: Pantone Color of the Year
function fashionCoty(opts = {}) {
  const self = () => fashionCoty(opts);
  const el = show(`
    ${worldTop("Fashion")}
    <h1 class="p-title">Pantone Color of the Year</h1>
    <p class="p-dek">${worldLinkText(FASHION.cotyNote)}</p>
    <p class="fine">Approximate screen colors. Pantone® is a trademark of Pantone LLC; nothing here is an official published Pantone value.</p>
    <div class="pal-names wd-coty">${FASHION.coty.map(c => `<button class="pal-name" data-swatch="${esc(c.hex)}"><i style="--c:${esc(c.hex)}"></i><b>${esc(c.name)}</b><span>${worldLinkText(c.note)}</span><em class="mono">${c.year}</em></button>`).join("")}</div>
  `, "article wd");
  worldBackWire(el, opts, fashionFallback);
  worldWire(el, self);
  return el;
}

// ---------------------------------------------------------------- "In fashion" row on a color page
// Lazy: js/explore.js calls this if it exists, right after drawing colorPage's own sections.
function worldColorRow(el, n) {
  if (!n || n.kind !== "color" || !window.FASHION) return;
  const host = el.querySelector("[data-world-in]"); if (!host) return;
  const hits = [];
  const seenDecades = new Set(), seenHouses = new Set();
  FASHION.decades.forEach(d => { d.swatches.forEach(([h, label]) => { if (!seenDecades.has(d.id) && de2000(n.h, h) < 9) { seenDecades.add(d.id); hits.push({ slug: "decade-" + d.id, title: d.label, sub: label, h }); } }); });
  FASHION.houses.forEach(h => { if (!seenHouses.has(h.id) && de2000(n.h, h.hex) < 11) { seenHouses.add(h.id); hits.push({ slug: "house-" + h.id, title: h.house, sub: h.label, h: h.hex }); } });
  if (hits.length < 2) { if (typeof fxColorStrip === "function") fxColorStrip(host, n); return; }   // js/fashion.js adds the garments strip
  host.innerHTML = `<h3>In fashion</h3><p class="fx-in-sub">Decades and houses whose signature color is close to ${esc(n.title)}.</p>
    <div class="wd-in-strip">${hits.slice(0, 8).map(x => `<button class="wd-in" data-wd-open="${esc(x.slug)}"><i style="--c:${x.h}"></i><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div>`;
  host.querySelectorAll("[data-wd-open]").forEach(b => b.onclick = () => fashionPage(b.dataset.wdOpen, { back: () => openNode(n, false) }));
  if (typeof fxColorStrip === "function") fxColorStrip(host, n);
}

// ---------------------------------------------------------------- screenshot hooks (index.html#shot=...)
function worldShot(kind, arg) {
  if (kind === "world") { S.lens = "world"; return go("explore"); }
  if (kind === "fashiondecade") return fashionDecadeDetail(arg || FASHION.decades[2].id);
  if (kind === "fashioncoty") return fashionCoty();
  if (kind === "fashionhouse") return fashionHouseDetail(arg || FASHION.houses[0].id);
  if (kind === "fashionhistory") return fashionHistoryDetail(arg || FASHION.history[0].id);
  if (kind === "garments") { const c = arg && [...BASICS, ...ALL].find(x => x.n.toLowerCase() === arg.toLowerCase()); Object.assign(FX_UI, { color: c ? c.h : null, era: "all", g: "all", q: "", y: 0 }); return fxBrowser(); }   // js/fashion.js
  if (kind === "garment") return fxLoad().then(d => d && fxGarment(arg || d.rows[Math.floor(d.rows.length / 2)].id));
  if (kind === "fxcolor") { const n = graph().resolve(arg || "Crimson"); openNode(n); later(() => { const h = document.querySelector("[data-world-in]"); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 200); }, 900); }
}
