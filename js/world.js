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
// The bar is navigation only now (design/SIMPLIFY/PLAN.md §3.5): back, ⋯ and the place pill, same as every
// other page. It used to also carry the page's eyebrow and a balancing spacer -- harmless on their own, but
// js/trail.js's crowded check (anything past the back button) read that as "this header has its own button"
// and withheld ⋯ from every page built with worldTop (botany, gems, fashion, pulp, photography, design
// objects, ukiyo-e, botanical & bird plates, brands, looks -- everywhere this helper is used). The eyebrow
// moves to the body, right where every other page in the app already puts one (gallery.js, richpage.js,
// artwiki.js: an `eyebrow p-type` just above the `h1.p-title` that already follows this call everywhere).
const worldTop = (title) => `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header><p class="eyebrow p-type">${esc(title || "Fashion")}</p>`;
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

// ---------------------------------------------------------------- Measured stats (every decade 1700s-2020s)
// data/fashion/measured-decades.json (built by tools/fashion_measure.py) combines two sources: the CC0/
// public-domain Met + Cleveland corpus (tools/fashion.py, shown as photos) and the V&A Collections API
// (tools/fashion_va.py, measure-only -- colors kept, no image ever stored, since V&A photos are not CC0/PD).
// Feeds both Decades (fashionDecadeDetail, per-decade) and the three "Deep reads" long-form articles in
// data/fashion-eras.js (window.FASHION_ERAS, lazy), which read FX_DECADE_STATS.eras instead of .decades.
DATA_SRC["fashion-eras"] = "data/fashion-eras.js";
let FX_DECADE_STATS = null, FX_DECADE_LOADING = null;
function fxDecadeStatsLoad() {
  if (FX_DECADE_STATS) return Promise.resolve(FX_DECADE_STATS);
  return FX_DECADE_LOADING || (FX_DECADE_LOADING = fetch("data/fashion/measured-decades.json" + (DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).then(d => {
    FX_DECADE_LOADING = null;
    return (FX_DECADE_STATS = d);
  }).catch(() => { FX_DECADE_LOADING = null; return null; }));
}
const worldWhenEras = fn => window.FASHION_ERAS ? fn() : loadData("fashion-eras").then(() => fn());

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
    ["decades", "Decades", "33 decades, 1700s–2020s, measured", wdStripes(FASHION.decades.map(d => d.swatches.map(s => s[0])))],
    ["eras", "Deep reads", "Three long-form eras, 1700s–1899", wdStripes([["#A89D89", "#9C9274", "#71755A"], ["#CECFC9", "#CDB598", "#DBD1AA"], ["#D5D5D6", "#16171A", "#8A4F48"]])],
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
  if (kind === "decade") { const d = fashionDecadeMerged(id); return d ? d.label : "Decade"; }
  if (kind === "coty") return "Pantone Color of the Year";
  if (kind === "houses") return "Houses and signature colors";
  if (kind === "house") { const h = FASHION.houses.find(x => x.id === id); return h ? h.house : "House"; }
  if (kind === "history" && !id) return "Fashion history";
  if (kind === "history") { const h = worldHistory().find(x => x.id === id); return h ? h.title : "Fashion history"; }
  if (kind === "garments") return "Garments";
  if (kind === "garment") { const r = typeof FX !== "undefined" && FX && FX.byId.get(id); return r ? r.t : "Garment"; }
  if (kind === "eras") return "Deep reads";
  if (kind === "era") { const e = (window.FASHION_ERAS || []).find(x => x.id === id); return e ? e.title : "Measured era"; }
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
  if (kind === "eras") return fashionEraList(opts);
  if (kind === "era" && id) return fashionEraDetail(id, opts);
  return fashionFallback();
}
function fashionFallback() { xToOrigin(); }   // where the trail started (js/explore.js), never a guessed room

// ---------------------------------------------------------------- list screens (decades / houses / history)
const FASHION_LIST_META = {
  decade: { title: "Decades", dek: "Every decade 1700s–2020s, measured from a combined corpus of Met + Cleveland Museum of Art (CC0/public domain) and V&A Collections (colors measured from the catalogue, no image stored) garments — real counts, not one palette per decade." },
  house: { title: "Houses and signature colors", dek: "Fifteen colors fashion houses made their own, with the story behind each and how firm the claim really is." },
  history: { title: "Fashion history", dek: "How color in dress has carried law, rank, grief, war and fast-changing taste, from Roman purple to fast fashion." }
};
// Decades 1700s-2020s: 1900s-2020s have curated articles (FASHION.decades); 1700s-1890s exist only as
// measured entries (no curated prose yet) until measured-decades.json loads.
function fashionDecadeMerged(id) {
  const cur = FASHION.decades.find(x => x.id === id);
  if (cur) return cur;
  const dec = parseInt(id, 10);
  if (!dec || dec < 1700 || dec > 2020) return null;
  return { id, label: id, years: dec === 2020 ? "2020–" : `${dec}–${dec + 9}`, synthetic: true };
}
function fashionEraIdFor(decadeId) {
  const dec = parseInt(decadeId, 10);
  if (dec < 1800) return "1700s";
  if (dec < 1850) return "1800-1849";
  return "1850-1899";
}
function fashionAllDecadeIds() {
  const out = [];
  for (let dec = 1700; dec <= 2020; dec += 10) out.push(dec + "s");
  return out;
}
function fashionCardHTML(kind, it) {
  if (kind === "decade") {
    const st = fashionDecadeStatsFor(it.id);
    const sw = st && st.coverage !== "bare" ? st.palette.slice(0, 6).map(c => [c.hex]) : (it.swatches || []);
    const sub = st ? `${st.n.toLocaleString()} measured${st.coverage === "bare" ? " (too few to show a palette)" : ""}` : (it.years || "");
    return `<button class="wd-card" data-wd-open="decade-${esc(it.id)}">
      <span class="mini-pal">${sw.length ? sw.map(x => `<i style="--c:${x[0]}"></i>`).join("") : `<i style="background:var(--surface-2)"></i>`}</span>
      <b>${esc(it.label)}</b><small>${esc(sub)}</small>
    </button>`;
  }
  const sw = kind === "house" ? [[it.hex]] : it.swatches;
  const title = kind === "house" ? it.house : it.title;
  const sub = kind === "house" ? it.label : it.dek;
  const slug = (kind === "house" ? "house-" : "history-") + it.id;
  return `<button class="wd-card" data-wd-open="${esc(slug)}">
    <span class="mini-pal">${sw.map(x => `<i style="--c:${x[0]}"></i>`).join("")}</span>
    <b>${esc(title)}</b><small>${esc(sub || "")}</small>
  </button>`;
}
function fashionList(kind, opts = {}) {
  if (kind === "history" && !window.FASHION_HISTORY) { const el = fashionListDraw(kind, opts); worldWhenHistory(() => { if (window.FASHION_HISTORY && el.isConnected) { const y = scrollY; fashionListDraw(kind, opts); scrollTo(0, y); } }); return el; }
  if (kind === "decade") {
    const el = fashionListDraw(kind, opts);
    if (!FX_DECADE_STATS) fxDecadeStatsLoad().then(() => { if (FX_DECADE_STATS && el.isConnected) { const y = scrollY; fashionListDraw(kind, opts); scrollTo(0, y); } });
    return el;
  }
  return fashionListDraw(kind, opts);
}
function fashionListDraw(kind, opts = {}) {
  const items = kind === "decade" ? fashionAllDecadeIds().map(fashionDecadeMerged) : kind === "house" ? FASHION.houses : worldHistory();
  const meta = FASHION_LIST_META[kind];
  const el = show(`
    ${worldTop("Fashion")}
    <h1 class="p-title">${esc(meta.title)}</h1>
    <p class="p-dek">${esc(meta.dek)}</p>
    <div class="wd-list">${items.map(it => fashionCardHTML(kind, it)).join("")}</div>
    ${kind === "decade" ? `<p class="fine">A V&A-measured color is kept as hex values only; its photograph is (c) Victoria and Albert Museum and was never stored. Thin decades (fewer pieces) are labeled honestly, not padded.</p>` : ""}
  `, "article wd");
  worldBackWire(el, opts, fashionFallback);
  el.querySelectorAll("[data-wd-open]").forEach(b => b.onclick = () => fashionPage(b.dataset.wdOpen, { back: () => fashionList(kind, opts) }));
  return el;
}

// ---------------------------------------------------------------- detail: a decade
// Merges curated prose (FASHION.decades, 1900s-2020s only) with measured stats (measured-decades.json,
// every decade 1700s-2020s). A decade with real coverage shows the MEASURED palette as primary; a curated
// decade with thin/bare coverage keeps its documented swatches, clearly labeled as documented, not measured.
function fashionDecadeStatsFor(id) { return FX_DECADE_STATS && FX_DECADE_STATS.decades.find(x => x.id === id); }
const FASHION_COVERAGE_LABEL = { thick: "well measured", thin: "thinly measured — small sample", bare: "not enough measured pieces yet" };
function fashionDecadeDetail(id, opts = {}) {
  const d = fashionDecadeMerged(id);
  if (!d) return fashionList("decade", opts);
  const self = () => fashionDecadeDetail(id, opts);
  if (!FX_DECADE_STATS) {
    const el = fashionDecadeDetailDraw(d, null, opts, self);
    // the redraw goes back through fashionPage() (router.js's ROUTED entry, which only wraps that public name),
    // not fashionDecadeDetail() directly -- a bare recursive call here skipped ROUTE_NEXT and left the address
    // bar on whatever tab was open before this page, a real bug a cold #/fashion/decade-<id> link would hit
    // every time (PAGES-AUDIT.md's page-system lane, found verifying plan item 1's fashion wiring)
    fxDecadeStatsLoad().then(() => { if (el.isConnected) { ROUTE_REPLACE = true; fashionPage("decade-" + id, opts); } });
    return el;
  }
  return fashionDecadeDetailDraw(d, fashionDecadeStatsFor(id), opts, self);
}
function fashionDecadeDetailDraw(d, st, opts, self) {
  const measured = st && st.coverage !== "bare";
  const docSwatches = d.swatches || [];
  const el = show(`
    ${worldTop("Decades")}
    ${measured
      ? `<section class="wd-sec" id="dpal-sec"><h3>Measured palette <span class="fine">${esc(FASHION_COVERAGE_LABEL[st.coverage])} · n=${st.n}</span></h3>${fashionEraPaletteTabs(st, "all").html}</section>`
      : docSwatches.length
        ? `<div class="palette wd-dpal">${docSwatches.map(([h]) => `<button class="pal" data-swatch="${h}" style="--c:${h};flex:1" data-ink="${ink(h)}"></button>`).join("")}</div>`
        : `<p class="fine">${st ? "Not enough measured pieces yet (n=" + st.n + ") for a palette here." : "Loading…"}</p>`}
    <p class="eyebrow p-type">Fashion · Decade</p>
    <h1 class="p-title">${esc(d.label)}</h1>
    <p class="p-dek">${esc(d.years || "")}</p>
    ${!measured && docSwatches.length ? `<div class="pal-names">${docSwatches.map(([h, label]) => `<button class="pal-name" data-swatch="${h}"><i style="--c:${h}"></i><b>${esc(label)}</b><em class="mono">${esc(h)}</em></button>`).join("")}</div><p class="fine">Documented, not corpus-measured — ${st ? "this decade has " + st.n + " measured pieces so far (" + FASHION_COVERAGE_LABEL[st.coverage] + ")." : "measuring…"}</p>` : ""}
    ${st && st.findings && st.findings.length ? `<section class="wd-sec"><h3>What the measurements show</h3><ul class="wd-pieces">${st.findings.map(f => `<li>${esc(f)}</li>`).join("")}</ul></section>` : ""}
    ${d.why ? `<section class="wd-sec"><h3>Why these colors</h3><p>${worldLinkText(d.why)}</p></section>` : ""}
    ${d.pieces && d.pieces.length ? `<section class="wd-sec"><h3>Iconic pieces</h3><ul class="wd-pieces">${d.pieces.map(p => `<li>${worldLinkText(p)}</li>`).join("")}</ul></section>` : ""}
    ${d.hedge ? `<p class="fine">${esc(d.hedge)}</p>` : ""}
    ${worldImgHTML(d.img)}
    ${st ? fashionEraGalleryHTML(st) : ""}
    ${d.synthetic ? `<p class="fine"><a class="wl" data-fashion-to="era:${esc(fashionEraIdFor(d.id))}">Read the longer piece on this period →</a></p>` : ""}
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "fashion:decade-" + d.id, title: d.label }) : ""}
    ${d.sources ? sourcesHTML(d.sources) : `<p class="fine">Sources: Metropolitan Museum of Art and Cleveland Museum of Art open-access collection data (CC0/public domain); Victoria and Albert Museum Collections API (colors measured, images not stored).</p>`}
  `, "article wd");
  worldBackWire(el, opts, () => fashionList("decade", {}));
  worldWire(el, self);
  if (measured) {
    const palSection = el.querySelector("#dpal-sec");
    const wireEraTabs = () => palSection.querySelectorAll("[data-era-tab]").forEach(b => b.onclick = () => {
      const t = fashionEraPaletteTabs(st, b.dataset.eraTab);
      palSection.innerHTML = `<h3>Measured palette <span class="fine">${esc(FASHION_COVERAGE_LABEL[st.coverage])} · n=${st.n}</span></h3>${t.html}`;
      wireEraTabs();
    });
    if (palSection) wireEraTabs();
  }
  el.querySelectorAll("[data-era-open]").forEach(b => b.onclick = () => fashionPage("garment-" + b.dataset.eraOpen, { back: self }));
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
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "fashion:house-" + h.id, title: h.house }) : ""}
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
    // same fix as fashionDecadeDetail above: back through fashionPage() so the route actually commits
    worldWhenHistory(() => { if (window.FASHION_HISTORY && el && el.isConnected) { const y = scrollY; ROUTE_REPLACE = true; fashionPage("history-" + id, opts); scrollTo(0, y); } });
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
    <h1 class="p-title">${esc(h.title)}</h1>
    ${h.dek ? `<p class="p-dek">${worldLinkText(h.dek)}</p>` : ""}
    ${worldImgHTML(h.img)}
    ${(h.lead || h.body || []).map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}
    ${(h.sections || []).map(x => `<section class="wd-sec"><h3>${esc(x.title)}</h3>${x.text.map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}</section>`).join("")}
    ${(h.colors || []).length ? `<section class="wd-sec"><h3>Colors in this story</h3><div class="chips-wrap">${h.colors.map(cn => { const x = graph().resolve(cn); return x ? `<button class="pchip" data-to="${esc(x.id)}"><i style="--c:${x.h}"></i>${esc(x.title)}</button>` : ""; }).join("")}</div></section>` : ""}
    ${h.facts && h.facts.length ? `<dl class="facts">${h.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "fashion:history-" + h.id, title: h.title }) : ""}
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

// ---------------------------------------------------------------- Measured eras: list + detail
// Needs two lazy sources: the written article (data/fashion-eras.js, window.FASHION_ERAS) and the stats
// (data/fashion/measured-decades.json, fxDecadeStatsLoad). Draws whatever's ready, then redraws once both land —
// the same "quiet placeholder, redraw in place" pattern fashionList(history) already uses.
function fashionEraReady() { return !!(window.FASHION_ERAS && FX_DECADE_STATS); }
function fashionEraWhenReady(cb) {
  if (fashionEraReady()) return;
  Promise.all([loadData("fashion-eras"), fxDecadeStatsLoad()]).then(() => { if (fashionEraReady()) cb(); });
}
function fashionEraStatsFor(id) { return FX_DECADE_STATS && FX_DECADE_STATS.eras.find(x => x.id === id); }
function fashionEraList(opts = {}) {
  const el = fashionEraListDraw(opts);
  if (!fashionEraReady()) fashionEraWhenReady(() => { if (el.isConnected) { const y = scrollY; fashionEraListDraw(opts); scrollTo(0, y); } });
  return el;
}
function fashionEraListDraw(opts = {}) {
  const items = window.FASHION_ERAS || [{ id: "1700s", title: "The 1700s", dek: "" }, { id: "1800-1849", title: "1800–1849", dek: "" }, { id: "1850-1899", title: "1850–1899", dek: "" }];
  const el = show(`
    ${worldTop("Fashion")}
    <h1 class="p-title">Deep reads</h1>
    <p class="p-dek">Three long-form pieces on the centuries before mass photography made the Decades pages possible — the same measured corpus as Decades (Met + Cleveland Museum of Art, plus V&A colors), read as one continuous story instead of ten-year slices.</p>
    <div class="wd-list">${items.map(it => {
      const st = fashionEraStatsFor(it.id);
      const sw = st ? st.palette.slice(0, 6) : null;
      return `<button class="wd-card" data-wd-open="era-${esc(it.id)}">
        <span class="mini-pal">${sw ? sw.map(c => `<i style="--c:${c.hex}"></i>`).join("") : `<i style="background:var(--surface-2)"></i>`}</span>
        <b>${esc(it.title)}</b><small>${st ? `${st.n.toLocaleString()} measured pieces` : esc(it.dek || "")}</small>
      </button>`;
    }).join("")}</div>
    <p class="fine">Combines CC0/public-domain photographs (Met, Cleveland) with colors measured from the V&A's catalogue (no image stored); not a random sample of what everyone wore, and these percentages describe this corpus, not a census. For 1900s–2020s decade by decade, see Decades.</p>
  `, "article wd");
  worldBackWire(el, opts, fashionFallback);
  el.querySelectorAll("[data-wd-open]").forEach(b => b.onclick = () => fashionPage(b.dataset.wdOpen, { back: () => fashionEraList(opts) }));
  return el;
}
const FX_KIND_LABEL = { dress: "Dresses", menswear: "Menswear", accessory: "Accessories", other: "Other textiles" };
function fashionEraPaletteTabs(st, uiKey) {
  const kinds = Object.keys(st.byKind || {});
  const tabs = [["all", "All pieces", st.palette, st.n]].concat(kinds.map(k => [k, FX_KIND_LABEL[k] || k, st.byKind[k].palette, st.byKind[k].n]));
  if (tabs.length < 2) return { html: fashionEraPaletteHTML(st.palette) };
  const active = tabs.find(t => t[0] === uiKey) ? uiKey : "all";
  const html = `
    <div class="fx-chips wd-era-tabs">${tabs.map(([k, label, , n]) => `<button class="${k === active ? "on" : ""}" data-era-tab="${esc(k)}">${esc(label)} <span class="mono">${n}</span></button>`).join("")}</div>
    <div data-era-pal>${fashionEraPaletteHTML(tabs.find(t => t[0] === active)[2])}</div>`;
  return { html };
}
function fashionEraPaletteHTML(pal) {
  if (!pal || !pal.length) return `<p class="fine">Not enough measured pieces for a separate palette here.</p>`;
  return `<div class="pal-names wd-era-pal">${pal.map(c => `<button class="pal-name" data-swatch="${esc(c.hex)}"><i style="--c:${esc(c.hex)}"></i><b>${esc(c.name)}</b><span>${c.pctGarments}% of pieces · ${(c.shareOfCloth * 100).toFixed(1)}% of measured cloth</span><em class="mono">${esc(c.hex)}</em></button>`).join("")}</div>`;
}
function fashionEraGalleryHTML(st) {
  if (!st.gallery || !st.gallery.length) return "";
  const thumb = g => g.mu === "met" ? g.img.replace("/web-large/", "/mobile-large/") : g.img;
  return `<section class="wd-sec"><h3>From the archive</h3>
    <div class="fx-strip">${st.gallery.map(g => `
      <button class="fx-mini" data-era-open="${esc(g.id)}">
        <span class="fx-img"><img src="${esc(thumb(g))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('ld')"></span>
        <span class="mini-pal">${g.p.slice(0, 6).map(c => `<i style="--c:${c[0]};flex:${c[1]}"></i>`).join("")}</span>
        <small>${esc(g.t)}${g.cul ? " · " + esc(g.cul) : ""}</small>
      </button>`).join("")}</div>
    <p class="fine">Tap a piece to open it in Garments, with its museum credit and record.</p></section>`;
}
function fashionEraDetail(id, opts = {}) {
  const self = () => fashionEraDetail(id, opts);
  if (!fashionEraReady()) {
    const el = show(`${worldTop("Fashion")}<h1 class="p-title">Loading…</h1>`, "article wd");
    worldBackWire(el, opts, () => fashionEraList({}));
    // same fix as fashionDecadeDetail above: back through fashionPage() so the route actually commits
    fashionEraWhenReady(() => { if (el.isConnected) { ROUTE_REPLACE = true; fashionPage("era-" + id, opts); } });
    return el;
  }
  const era = window.FASHION_ERAS.find(x => x.id === id);
  const st = fashionEraStatsFor(id);
  if (!era || !st) return fashionEraList(opts);
  const uiKey = "all";
  const tabs = fashionEraPaletteTabs(st, uiKey);
  const el = show(`
    ${worldTop("Fashion · Measured era")}
    <h1 class="p-title">${esc(era.title)}</h1>
    <p class="p-dek">${esc(era.dek || "")}</p>
    <p class="fine mono">${st.n.toLocaleString()} measured pieces${st.nCc0 != null ? ` · ${st.nCc0.toLocaleString()} photographed (Met + Cleveland)` : ""}${st.nVa != null ? ` · ${st.nVa.toLocaleString()} measured only (V&A, no image)` : ""}</p>
    <section class="wd-sec"><h3>Measured palette</h3>${tabs.html}</section>
    ${st.findings && st.findings.length ? `<section class="wd-sec"><h3>What the measurements show</h3><ul class="wd-pieces">${st.findings.map(f => `<li>${esc(f)}</li>`).join("")}</ul></section>` : ""}
    ${(era.lead || []).map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}
    ${(era.sections || []).map(x => `<section class="wd-sec"><h3>${esc(x.title)}</h3>${x.text.map(p => `<p class="wd-p">${worldLinkText(p)}</p>`).join("")}</section>`).join("")}
    ${fashionEraGalleryHTML(st)}
    ${era.hedge ? `<p class="fine">${esc(era.hedge)}</p>` : ""}
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "fashion:era-" + id, title: era.title }) : ""}
    ${sourcesHTML(era.sources)}
  `, "article wd");
  worldBackWire(el, opts, () => fashionEraList({}));
  worldWire(el, self);
  const palSection = [...el.querySelectorAll(".wd-sec")].find(s => s.querySelector(".wd-era-tabs, .wd-era-pal"));
  const wireEraTabs = () => palSection.querySelectorAll("[data-era-tab]").forEach(b => b.onclick = () => {
    const t = fashionEraPaletteTabs(st, b.dataset.eraTab);
    palSection.innerHTML = `<h3>Measured palette</h3>${t.html}`;
    wireEraTabs();
  });
  if (palSection) wireEraTabs();
  el.querySelectorAll("[data-era-open]").forEach(b => b.onclick = () => fashionPage("garment-" + b.dataset.eraOpen, { back: self }));
  return el;
}

// ---------------------------------------------------------------- "In fashion" row on a color page
// Lazy: js/explore.js calls this if it exists, right after drawing colorPage's own sections.
// ΔE caps widened from 9/11 to 13/15 and a family fallback added (David, 2026-10-08: "a random color shouldn't
// land on an almost empty page") -- fashion's own lists (decades, houses) are only ~35 entries total, so a
// tight cap left most of the library's names with nothing here at all.
function worldFashionHits(hex, title) {
  const hits = [];
  const seenDecades = new Set(), seenHouses = new Set();
  FASHION.decades.forEach(d => { d.swatches.forEach(([h, label]) => { if (!seenDecades.has(d.id) && de2000(hex, h) < 13) { seenDecades.add(d.id); hits.push({ slug: "decade-" + d.id, title: d.label, sub: label, h }); } }); });
  FASHION.houses.forEach(h => { if (!seenHouses.has(h.id) && de2000(hex, h.hex) < 15) { seenHouses.add(h.id); hits.push({ slug: "house-" + h.id, title: h.house, sub: h.label, h: h.hex }); } });
  return hits;
}
function worldColorRow(el, n, famC) {
  if (!n || n.kind !== "color" || !window.FASHION) return;
  const host = el.querySelector("[data-world-in]"); if (!host) return;
  let hits = worldFashionHits(n.h, n.title), note = "";
  if (hits.length < 2 && famC && famC.n.toLowerCase() !== n.title.toLowerCase()) {
    const famHits = worldFashionHits(famC.h, famC.n);
    if (famHits.length >= 2) { hits = famHits; note = `<p class="fine">Nothing of ${esc(n.title.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}, does.</p>`; }
  }
  if (hits.length < 2) { if (typeof fxColorStrip === "function") fxColorStrip(host, n); return; }   // js/fashion.js adds the garments strip
  host.innerHTML = `<h3>In fashion</h3><p class="fx-in-sub">Decades and houses whose signature color is close to ${esc(note ? famC.n : n.title)}.</p>${note}
    <div class="wd-in-strip">${hits.slice(0, 8).map(x => `<button class="wd-in" data-wd-open="${esc(x.slug)}"><i style="--c:${x.h}"></i><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div>`;
  host.querySelectorAll("[data-wd-open]").forEach(b => b.onclick = () => fashionPage(b.dataset.wdOpen, { back: () => openNode(n, false) }));
  if (typeof fxColorStrip === "function") fxColorStrip(host, n);
}

// ---------------------------------------------------------------- screenshot hooks (index.html#shot=...)
function worldShot(kind, arg) {
  if (kind === "world") { S.lens = "world"; return go("explore"); }
  if (kind === "fashiondecades") return fashionList("decade");
  if (kind === "fashiondecade") return fashionDecadeDetail(arg || FASHION.decades[2].id);
  if (kind === "fashionera") return fashionEraDetail(arg || "1850-1899");
  if (kind === "fashioncoty") return fashionCoty();
  if (kind === "fashionhouse") return fashionHouseDetail(arg || FASHION.houses[0].id);
  if (kind === "fashionhistory") return fashionHistoryDetail(arg || FASHION.history[0].id);
  if (kind === "garments") { const c = arg && [...BASICS, ...ALL].find(x => x.n.toLowerCase() === arg.toLowerCase()); Object.assign(FX_UI, { color: c ? c.h : null, era: "all", g: "all", q: "", y: 0 }); return fxBrowser(); }   // js/fashion.js
  if (kind === "garment") return fxLoad().then(d => d && fxGarment(arg || d.rows[Math.floor(d.rows.length / 2)].id));
  if (kind === "fxcolor") { const n = graph().resolve(arg || "Crimson"); openNode(n); later(() => { const h = document.querySelector("[data-world-in]"); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 200); }, 900); }
}
