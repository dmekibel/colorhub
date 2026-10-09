"use strict";
// Design objects (World door, Archives lane, David 2026-10-09): posters, textiles, wallpaper, ceramics, glass,
// furniture, product design, costume and jewelry, and postage stamps, 1800-1979 -- 10,577 objects whose palettes
// were already measured offline (tools/design_corpus.py) but never wired to any page (PAGES-AUDIT.md #34,
// "Design objects (orphaned)... zero code references these files"). Built the same way js/pulp.js and
// js/photography.js were: a door in World (WORLD_SECTIONS), a grid that reuses pin()/masonry() (js/explore.js),
// and the object's own page reusing paintingPage() whole for its hero/palette/credit (same reasoning both of
// those files give — these are "painting"-shaped nodes to the rest of the app). Two small, additive extensions
// to the shared template make the reuse honest instead of thin (both in js/explore.js, both backward compatible
// since existing nodes never set these fields): paintingPage() now renders n.facts (the same dt/dd row
// wikiPage() already draws) for "Maker · Date · Category · Museum", and ptSimilarPool()/ptArtistLinkHTML() grew
// one more case each, exactly like the pulp/photography cases already there, so "Similar palettes" and a
// linkable maker byline came for free. A count control (3-6, the most this corpus's 6-color palette supports)
// and a "Paintings in these colors" door are appended after paintingPage() renders (doEnhanceObjectPage).
//
// Data: data/design/objects-<cat>.json (10 files, ~4.3 MB total — fetched once, lazily, the first time the
// World door opens, same tradeoff pulp.js/photography.js already made at a smaller scale), data/design/index.json
// (category x decade matrix), makers.json (122 makers with 3+ attributed objects, precomputed palette + signature
// colors), superlatives.json (24 "colors of..." finding cards), colors-index.json (top named colors overall),
// cells.json (per-category averages, used for the one honest measured-finding line per object).
//
// Images: six of the seven sources (chndm/npmd via ids.si.edu, rijksd via iiif.micr.io, metd via
// images.metmuseum.org -- all three already CORS-cleared in js/gallery.js's GL_CORS_HOSTS -- plus cmad and
// commonsd, whose own "i" field is already a full hotlinkable URL) are hotlinked directly: verified 2026-10-09,
// each answers 200 with no special header. The seventh, aicd (Art Institute of Chicago, 1,938 objects), answers
// 403 to a plain <img> request -- it requires an AIC-User-Agent header a browser's own <img> tag can never send
// -- so those thumbnails are fetched once by tools/design_fetch_aicd_images.py into img/design/aicd/<id>.jpg,
// the same self-hosting the existing painting gallery already does for its own AIC holdings (img/gallery/aic/).
//
// "In design objects" on a color page (js/richpage.js calls doRow(entry, famC), exactly where it already calls
// btRow/gmRow/bdRow) uses the colorindex engine already built for this corpus (js/colorindex.js CI_SOURCES.design
// -> data/design/colorindex/, a 1,078-object sample) rather than a new one-off nearest-color scan.

const DO_CATS = ["poster", "graphic", "textile", "wallpaper", "ceramics", "glass", "furniture", "product", "costume", "stamps"];
const DO_CAT_LABEL = { poster: "Posters & advertisements", graphic: "Graphic design & print", textile: "Textiles", wallpaper: "Wallpaper",
  ceramics: "Ceramics & tiles", glass: "Glass", furniture: "Furniture & lighting", product: "Product & industrial design",
  costume: "Costume, fashion & jewelry", stamps: "Postage stamps" };
const DO_SRC_LABEL = { chndm: "Cooper Hewitt, Smithsonian Design Museum", aicd: "Art Institute of Chicago", cmad: "Cleveland Museum of Art",
  rijksd: "Rijksmuseum", metd: "The Metropolitan Museum of Art", npmd: "National Postal Museum", commonsd: "Wikimedia Commons" };
const DO_LICENSE = { chndm: "CC0", npmd: "CC0", cmad: "CC0", metd: "CC0", aicd: "Public domain", rijksd: "Public domain", commonsd: "Public domain" };
const DO_IMG_TPL = {
  chndm: i => `https://ids.si.edu/ids/deliveryService?id=${encodeURIComponent(i)}&max=300`,
  npmd: i => `https://ids.si.edu/ids/deliveryService?id=${encodeURIComponent(i)}&max=300`,
  rijksd: i => `https://iiif.micr.io/${i}/full/400,/0/default.jpg`,
  metd: i => `https://images.metmuseum.org/CRDImages/${i}`,
  cmad: i => i, commonsd: i => i,
  aicd: (i, id) => `img/design/aicd/${id}.jpg`,
};
const DO_URL_TPL = {
  chndm: u => `https://collection.cooperhewitt.org/view/objects/asitem/id/${u}`,
  aicd: u => `https://www.artic.edu/artworks/${u}`,
  rijksd: u => `https://www.rijksmuseum.nl/en/collection/${u}`,
  cmad: u => `https://www.clevelandart.org/art/${u}`,
  metd: u => `https://www.metmuseum.org/art/collection/search/${u}`,
  npmd: u => u, commonsd: u => u,
};
function doImgUrl(o) {
  const f = DO_IMG_TPL[o.src];
  return f && o.i ? f(o.i, o.id) : null;
}
function doSourceUrl(o) {
  const f = DO_URL_TPL[o.src];
  return f && o.u ? f(o.u) : null;
}

// ---------------------------------------------------------------- loading
let DO = null, DO_LOADING = null, DO_BY_ID = null;
let DO_INDEX = null, DO_MAKERS = null, DO_MAKER_BY_SLUG = null, DO_SUPERLATIVES = null, DO_COLORS_INDEX = null, DO_CELLS = null;
const doJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
const doSlug = s => (typeof routeSlug === "function" ? routeSlug(s) : String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"));
function doColorName(ci) { return CORE_NAMES && CORE_NAMES[ci] ? CORE_NAMES[ci].n : null; }
function doColorHex(ci) { return CORE_NAMES && CORE_NAMES[ci] ? CORE_NAMES[ci].h : "#888"; }

// Measured findings: one honest sentence per object, from its own L*/C* (stored at build time) against its
// category's average (data/design/cells.json), plus a richer decade-level line when superlatives.json happens
// to cover this exact category x decade (24 of them do, out of ~140 possible cells — never invented, just used
// when it's there).
function doFindingFor(o, catLabel, decade) {
  const bits = [];
  const cell = DO_CELLS && DO_CELLS.cells && DO_CELLS.cells[o.cat];
  if (cell && o.L != null && o.C != null) {
    const dL = o.L - cell.L, dC = o.C - cell.C;
    const lWord = Math.abs(dL) < 4 ? "about as light as" : dL > 0 ? (dL > 12 ? "much lighter than" : "lighter than") : (dL < -12 ? "much darker than" : "darker than");
    const cWord = Math.abs(dC) < 3 ? "about as vivid as" : dC > 0 ? (dC > 10 ? "far more vivid than" : "more vivid than") : (dC < -10 ? "far duller than" : "duller than");
    bits.push(`Measured against ${cell.n.toLocaleString()} ${catLabel.toLowerCase()}: ${lWord} the average, and ${cWord} the average.`);
  }
  const key = `colors-${o.cat}-${decade}`;
  const sup = (DO_SUPERLATIVES || []).find(s => s.key === key);
  if (sup) bits.push(sup.text);
  bits.push("Colors are as photographed: museum photography, aging dyes and glazes, and a screen approximation all sit between this object and the hex shown.");
  return bits.join(" ");
}
function doFactsFor(o, catLabel, museum) {
  const f = [];
  if (o.a) f.push({ label: "Maker", value: o.a });
  if (o.y) f.push({ label: "Date", value: String(o.y) });
  f.push({ label: "Category", value: catLabel });
  if (o.co) f.push({ label: "Place", value: o.co });
  if (museum) f.push({ label: "Collection", value: museum });
  return f;
}
function doNode(o) {
  const palette = (o.p || []).map(([h, share, ci]) => ({ h, share, name: doColorName(ci) || h }));
  const catLabel = DO_CAT_LABEL[o.cat] || o.cat;
  const museum = DO_SRC_LABEL[o.src] || o.src;
  const makerSlug = o.a ? doSlug(o.a) : null;
  const decade = o.y != null ? Math.floor(o.y / 10) * 10 : null;
  return {
    id: "do-" + o.id, kind: "painting", typeLabel: "Design object",
    title: o.t || catLabel, artist: o.a || null, makerSlug,
    year: o.y || null, decade,
    place: [o.co, museum].filter(Boolean).join(" · "),
    img: doImgUrl(o), w: null, h: null, palette,
    facts: doFactsFor(o, catLabel, museum),
    note: doFindingFor(o, catLabel, decade),
    commons: doSourceUrl(o), license: DO_LICENSE[o.src] || "Public domain", imgSrcLabel: museum,
    cat: o.cat, catLabel, src: o.src,
  };
}
function loadDesignObjects() {
  if (DO) return Promise.resolve(DO);
  if (DO_LOADING) return DO_LOADING;
  return DO_LOADING = Promise.all([
    loadCoreNames().catch(() => []),
    Promise.all(DO_CATS.map(c => doJSON(`data/design/objects-${c}.json`).catch(() => []))),
    doJSON("data/design/index.json").catch(() => null),
    doJSON("data/design/makers.json").catch(() => []),
    doJSON("data/design/superlatives.json").catch(() => []),
    doJSON("data/design/colors-index.json").catch(() => []),
    doJSON("data/design/cells.json").catch(() => null),
  ]).then(([, cats, index, makers, superlatives, colorsIndex, cells]) => {
    DO_INDEX = index; DO_SUPERLATIVES = superlatives; DO_COLORS_INDEX = colorsIndex; DO_CELLS = cells;
    DO = cats.flat().map(doNode);
    DO_BY_ID = new Map(DO.map(n => [n.id, n]));
    DO_MAKERS = makers;
    DO_MAKER_BY_SLUG = new Map(makers.map(m => [doSlug(m.a), m]));
    return DO;
  }).catch(e => { DO_LOADING = null; throw e; });
}
// Synchronous when the data is already cached (same contract as js/brands.js bdWhen / js/gems.js gmWhen), so a
// routed screen's own show() call still runs inside the ROUTED wrapper's synchronous call stack (router.js
// routeWrap sets ROUTE_NEXT, calls the function, then clears it in a `finally` the instant that call returns --
// a screen that only calls show() later, inside its own .then(), would always miss that window and fall back to
// the current tab's address). Each top-level screen below (doGrid/doCategory/doMakerPage) checks `if (!DO)`
// itself and re-enters through here only to wait; once DO exists, it renders synchronously, same as every other
// kind in the app.
let DO_WAIT_Q = [];
function doWhen(fn) {
  if (DO) { fn(); return; }
  DO_WAIT_Q.push(fn);
  loadDesignObjects().then(() => { const q = DO_WAIT_Q; DO_WAIT_Q = []; q.forEach(f => f()); }).catch(() => {});
}
function doHasMaker(slug) { return !!(DO_MAKER_BY_SLUG && DO_MAKER_BY_SLUG.get(slug)); }
function doMakerTitle(slug) { const m = DO_MAKER_BY_SLUG && DO_MAKER_BY_SLUG.get(slug); return m ? m.a : null; }

// ---------------------------------------------------------------- "In design objects" on a color page
// (js/richcolor.js/js/richpage.js call doRow(entry, famC) right where they already call bdRow/gmRow/btRow)
function doNearest(hex, maxDe = 10, limit = 8) {
  if (!DO) return [];
  const hits = [];
  for (const n of DO) {
    const top = n.palette[0]; if (!top) continue;
    const d = de2000(hex, top.h);
    if (d <= maxDe) hits.push({ n, d });
  }
  return hits.sort((a, b) => a.d - b.d).slice(0, limit);
}
function doRowHTML(c, famC) {
  let hits = doNearest(c.h), note = "";
  if (!hits.length && famC && famC.n.toLowerCase() !== c.n.toLowerCase()) {
    hits = doNearest(famC.h);
    if (hits.length) note = `<p class="fine">Nothing of ${esc(c.n.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}, does.</p>`;
  }
  if (!hits.length) return "";
  return `<section class="arch-row do-row"><h3>In design objects</h3><p class="fine">Posters, textiles, ceramics, glass and other design objects, 1800-1979, whose dominant color is close to this one.</p>${note}
    <div class="wd-in-strip">${hits.map(({ n, d }) => `<button class="wd-in" data-do-open="${esc(n.id)}"><i style="--c:${n.palette[0].h}"></i><b>${esc(n.title)}</b><small>${pctFmt(Math.max(0, 100 - d * 4))}% match</small></button>`).join("")}</div></section>`;
}
function doRow(c, famC) {
  const id = "do-row-" + Math.random().toString(36).slice(2, 8);
  doWhen(() => requestAnimationFrame(() => {
    const box = document.getElementById(id); if (!box) return;
    box.innerHTML = doRowHTML(c, famC);
    box.querySelectorAll("[data-do-open]").forEach(b => b.onclick = () => { const n = DO_BY_ID.get(b.dataset.doOpen); if (n) doOpenObject(n.id); });
  }));
  return `<div class="bd-rows" id="${id}"></div>`;
}

// ---------------------------------------------------------------- the object page: paintingPage() reused whole,
// then a count control (3-6) and a "Paintings in these colors" door appended (neither fits the generic template,
// both are specific to this corpus having a fixed 6-color pool instead of paintings' 24-color one).
function doEnhanceObjectPage(el, n) {
  if (!el || !n.palette.length) return;
  const palRow = el.querySelector(".palette"), nameRow = el.querySelector(".pal-names");
  if (palRow && n.palette.length > 3) {
    const sizes = [3, 4, 5, 6].filter(s => s <= n.palette.length);
    const row = document.createElement("div");
    row.className = "chips-wrap do-size-row";
    row.innerHTML = sizes.map(s => `<button class="art-bubble pulp-chip${s === n.palette.length ? " on" : ""}" data-do-size="${s}">${s} colors</button>`).join("");
    palRow.before(row);
    const apply = k => {
      [...palRow.children].forEach((c, i) => c.style.display = i < k ? "" : "none");
      if (nameRow) [...nameRow.children].forEach((c, i) => c.style.display = i < k ? "" : "none");
      row.querySelectorAll("[data-do-size]").forEach(b => b.classList.toggle("on", +b.dataset.doSize === k));
    };
    row.querySelectorAll("[data-do-size]").forEach(b => b.onclick = () => { buzz(6); apply(+b.dataset.doSize); });
  }
  const findings = el.querySelector(".p-body");
  const hexes = n.palette.slice(0, 3).map(p => p.h);
  if (findings && hexes.length && typeof paintingsOfPage === "function") {
    const btn = document.createElement("button");
    btn.className = "wl"; btn.style.cssText = "display:block;margin-top:10px";
    btn.textContent = "See paintings in these colors";
    btn.onclick = () => paintingsOfPage(hexes, { back: () => doOpenObject(n.id) });
    findings.after(btn);
  }
  // delegated, not a direct handler on the node found right now: paintingPage() re-renders .p-dek's innerHTML
  // asynchronously once the art wiki finishes loading (its own "upgrade the byline in place" step), which would
  // silently replace a directly-wired button and drop its listener before a visitor ever gets to tap it.
  el.addEventListener("click", e => {
    const mk = e.target.closest("[data-domaker]"); if (!mk) return;
    e.stopPropagation();
    doMakerPage(mk.dataset.domaker, { back: () => doOpenObject(n.id) });
  });
}
function doOpenObject(id, opts = {}) {
  if (!DO) { doWhen(() => doOpenObject(id, opts)); return; }
  const n = DO_BY_ID.get(id);
  if (!n) { if (typeof xToOrigin === "function") xToOrigin(); return; }
  paintingPage(n);   // void (js/explore.js) -- it draws via show() straight onto #app, same as every ROUTED screen
  doEnhanceObjectPage(app.firstElementChild, n);
}

// ---------------------------------------------------------------- maker pages, #/design/maker/<slug>
function doMakerPage(slug, opts = {}) {
  if (!DO) { doWhen(() => doMakerPage(slug, opts)); return; }
  const m = DO_MAKER_BY_SLUG.get(slug);
  if (!m) { if (typeof xToOrigin === "function") xToOrigin(); return; }
  const objs = DO.filter(n => n.makerSlug === slug);
  const pal = (m.pal || []).slice(0, 8).map(([ci, pct]) => ({ h: doColorHex(ci), name: doColorName(ci) || "—", pct }));
  const sig = (m.sig || []).map(([ci, lift]) => ({ h: doColorHex(ci), name: doColorName(ci) || "—", lift }));
  const el = show(`
    ${worldTop("Design objects")}
    <p class="eyebrow p-type">Maker${(m.cat || []).length ? " · " + m.cat.map(c => DO_CAT_LABEL[c] || c).join(", ") : ""}</p>
    <h1 class="p-title">${esc(m.a)}</h1>
    <p class="p-dek">${m.n.toLocaleString()} object${m.n === 1 ? "" : "s"} in the archive${m.y ? `, ${m.y[0]}–${m.y[1]}` : ""}.</p>
    ${pal.length ? `<div class="palette">${pal.map(p => `<button class="pal" data-swatch="${p.h}" style="--c:${p.h};flex:${Math.max(p.pct, 1.5)}"><span>${p.pct}%</span></button>`).join("")}</div>
    <div class="pal-names">${pal.map(p => `<button class="pal-name" data-swatch="${p.h}"><i style="--c:${p.h}"></i><b>${esc(p.name)}</b></button>`).join("")}</div>` : ""}
    ${sig.length ? `<div class="sec-head"><b>Signature colors</b><span>used more than other makers here</span></div>
    <div class="chips-wrap">${sig.map(s => `<button class="pchip" data-swatch="${s.h}"><i style="--c:${s.h}"></i>${esc(s.name)}<em>${s.lift}× lift</em></button>`).join("")}</div>` : ""}
    <p class="fine">Palette measured across ${m.n} objects, as photographed.</p>
    <div class="sec-head"><b>Objects</b><span>${objs.length}</span></div>
    <div id="doMakerFeed">${masonry(objs.map(n => pin(n)))}</div>
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "do:maker:" + slug, title: m.a }) : ""}
  `, "article wd");
  worldBackWire(el, opts, () => doGrid(false));
  el.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => { const n = objs.find(x => x.id === b.dataset.pin); if (n) doOpenObject(n.id, { back: () => doMakerPage(slug, opts) }); });
  // [data-swatch] needs no handler here: js/swatch.js's one delegated document click listener already opens
  // any swatch's color page, for every data-swatch element in the app.
  if (typeof wireLinks === "function") wireLinks(el);
}

// ---------------------------------------------------------------- category grid, #/design/cat/<cat>
let DO_FILTER = { decade: null, maker: "" };
function doCatFacets(rows) {
  const decadeCounts = new Map();
  rows.forEach(r => { if (r.decade != null) decadeCounts.set(r.decade, (decadeCounts.get(r.decade) || 0) + 1); });
  const makers = new Map();
  rows.forEach(r => { if (r.artist) makers.set(r.artist, (makers.get(r.artist) || 0) + 1); });
  return {
    decades: [...decadeCounts.entries()].sort((a, b) => a[0] - b[0]).map(([d]) => d),
    makers: [...makers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([a]) => a),
  };
}
function doCatFiltered(cat) {
  return DO.filter(n => n.cat === cat && (DO_FILTER.decade == null || n.decade === DO_FILTER.decade) && (!DO_FILTER.maker || n.artist === DO_FILTER.maker));
}
function doCategory(cat, push = true) {
  if (!DO) { doWhen(() => doCategory(cat, push)); return; }
  DO_FILTER = { decade: null, maker: "" };
  const label = DO_CAT_LABEL[cat] || cat;
  const el = show(`
    ${worldTop("Design objects")}
    <h1 class="p-title">${esc(label)}</h1>
    <p class="p-dek">${DO.filter(n => n.cat === cat).length.toLocaleString()} objects, 1800-1979.</p>
    <div class="art-bubbles" id="doCatChips" role="tablist"></div>
    <div id="doCatFeed"></div>
  `, "article wd");
  if (push && typeof XSTACK !== "undefined") XSTACK.push("r:design/cat/" + cat);
  worldBackWire(el, {}, () => doGrid(false));
  const draw = () => {
    const rows = doCatFiltered(cat), { decades, makers } = doCatFacets(DO.filter(n => n.cat === cat));
    const chip = (label, on, attr) => `<button class="art-bubble pulp-chip${on ? " on" : ""}" ${attr}>${esc(label)}</button>`;
    const chips = el.querySelector("#doCatChips");
    if (chips) chips.innerHTML = [
      chip("All decades", DO_FILTER.decade == null, 'data-df="decade" data-dv=""'),
      ...decades.map(d => chip(d + "s", DO_FILTER.decade === d, `data-df="decade" data-dv="${d}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All makers", !DO_FILTER.maker, 'data-df="maker" data-dv=""'),
      ...makers.map(a => chip(a, DO_FILTER.maker === a, `data-df="maker" data-dv="${esc(a)}"`)),
    ].join("");
    const feed = el.querySelector("#doCatFeed");
    if (feed) feed.innerHTML = rows.length ? masonry(rows.map(n => pin(n))) : `<p class="fine">No objects match. Try fewer filters.</p>`;
  };
  el.querySelector("#doCatChips").onclick = e => {
    const b = e.target.closest("[data-df]"); if (!b) return;
    const key = b.dataset.df, v = b.dataset.dv;
    DO_FILTER[key] = key === "decade" ? (v === "" ? null : +v) : v;
    buzz(6); draw();
  };
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = DO_BY_ID.get(p.dataset.pin); if (n) doOpenObject(n.id); }
  });
  draw();
}

// ---------------------------------------------------------------- the room, #/design
function doShelfHTML(cat) {
  const rows = DO.filter(n => n.cat === cat).slice(0, 10);
  if (!rows.length) return "";
  return `<div class="sec-head"><b>${esc(DO_CAT_LABEL[cat] || cat)}</b><span>${DO.filter(n => n.cat === cat).length.toLocaleString()}</span></div>
    <div class="do-shelf" data-do-shelf="${esc(cat)}">${rows.map(n => `<button class="do-shelf-item" data-pin="${esc(n.id)}"><img src="${esc(n.img || "")}" alt="" loading="lazy"${n.img ? "" : " style=\"display:none\""}>
      <span class="mini-pal">${n.palette.slice(0, 5).map(p => `<i style="--c:${p.h};flex:${p.share}"></i>`).join("")}</span></button>`).join("")}
      <button class="do-shelf-more" data-do-cat="${esc(cat)}">See all ${DO.filter(n => n.cat === cat).length.toLocaleString()} ›</button></div>`;
}
function doFindingCardsHTML() {
  if (!DO_SUPERLATIVES || !DO_SUPERLATIVES.length) return "";
  const picks = DO_SUPERLATIVES.slice(0, 8);
  return `<div class="sec-head"><b>Findings</b><span>measured across the corpus</span></div>
    <div class="masonry"><div>${picks.map((s, i) => i % 2 === 0 ? doFindingCard(s) : "").join("")}</div><div>${picks.map((s, i) => i % 2 === 1 ? doFindingCard(s) : "").join("")}</div></div>`;
}
function doFindingCard(s) {
  return `<div class="pin pin-page" style="cursor:default"><span class="pp-body"><span class="eyebrow">${s.n.toLocaleString()} objects</span><b>${esc(s.title)}</b><small>${esc(s.text)}</small></span></div>`;
}
function doOverviewColorsHTML() {
  if (!DO_COLORS_INDEX || !DO_COLORS_INDEX.length) return "";
  const top = DO_COLORS_INDEX.slice(0, 14);
  return `<div class="sec-head"><b>Most common colors</b><span>across ${(DO_INDEX && DO_INDEX.n || DO.length).toLocaleString()} objects</span></div>
    <div class="chips-wrap">${top.map(r => `<button class="pchip" data-do-color="${esc(r[2])}"><i style="--c:${esc(r[2])}"></i>${esc(r[1])}</button>`).join("")}</div>`;
}
function doMakersHTML() {
  if (!DO_MAKERS || !DO_MAKERS.length) return "";
  const top = [...DO_MAKERS].sort((a, b) => b.n - a.n).slice(0, 12);
  return `<div class="sec-head"><b>Makers</b><span>by objects in the archive</span></div>
    <div class="chips-wrap">${top.map(m => `<button class="pchip" data-do-maker="${esc(doSlug(m.a))}">${esc(m.a)}<em>${m.n}</em></button>`).join("")}</div>`;
}
function doGrid(push = true) {
  if (!DO) { doWhen(() => doGrid(push)); return; }
  const el = show(`
    ${worldTop("Design objects")}
    <h1 class="p-title">Design objects</h1>
    <p class="p-dek">${DO.length.toLocaleString()} posters, textiles, ceramics, glass, furniture, costume, graphic design and postage stamps, 1800-1979, measured and named like every painting in the archive — a job always had a color, long before art did.</p>
    ${doOverviewColorsHTML()}
    ${doFindingCardsHTML()}
    ${DO_CATS.map(doShelfHTML).join("")}
    ${doMakersHTML()}
    <p class="fine">Colors are as photographed: museum photography, aging dyes and glazes, and a screen approximation all sit between an object and the hex shown. Images and metadata from the Smithsonian's Cooper Hewitt and National Postal Museum (CC0), the Art Institute of Chicago, the Cleveland Museum of Art (CC0), the Rijksmuseum, the Metropolitan Museum of Art (CC0) and Wikimedia Commons — public domain or CC0 only.</p>
  `, "article wd");
  if (push && typeof XSTACK !== "undefined") XSTACK.push("r:design");
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = DO_BY_ID.get(p.dataset.pin); if (n) doOpenObject(n.id); return; }
    const c = e.target.closest("[data-do-cat]"); if (c) { doCategory(c.dataset.doCat); return; }
    const m = e.target.closest("[data-do-maker]"); if (m) { doMakerPage(m.dataset.doMaker); return; }
    const col = e.target.closest("[data-do-color]"); if (col) { if (typeof openTappedColor === "function") openTappedColor(col.dataset.doColor); return; }
  });
}

// ---------------------------------------------------------------- the World door tile
function worldDesignSection(host) {
  host.innerHTML = `<p class="x-sub">Posters, textiles, wallpaper, ceramics, glass, furniture, product design, costume and postage stamps, 1800-1979: color read the same way as a painting, from public-domain and CC0 museum collections.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="design"><span class="wd-art">${wdBars(["#8A5A3C", "#C9A04A", "#3C5A4A", "#B5523C", "#44546B"])}</span><b>Design objects</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadDesignObjects().then(rows => { if (sub) sub.textContent = `${rows.length.toLocaleString()} objects, ${DO_CATS.length} kinds`; })
    .catch(() => { if (sub) sub.textContent = "Couldn't load"; });
  const b = host.querySelector('[data-wd="design"]'); if (b) b.onclick = () => doGrid();
}
WORLD_SECTIONS.push({ key: "design", title: "Design objects", render: worldDesignSection });

// ---------------------------------------------------------------- screenshot hooks (index.html#shot=...)
function doShot(kind, arg) {
  if (kind === "design") return doGrid(false);
  if (kind === "designcat") return doCategory(arg || "poster", false);
  if (kind === "designobject") return doWhen(() => doOpenObject(arg || (DO[0] && DO[0].id)));
  if (kind === "designmaker") return doWhen(() => doMakerPage(arg || (DO_MAKERS[0] && doSlug(DO_MAKERS[0].a))));
}
