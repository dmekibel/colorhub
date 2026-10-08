"use strict";
// Gems: the minerals and organic gems behind ColorHub's colors, why each one is the color it is (impurity,
// charge transfer, color center or structure), three short essays on the chemistry and physics of gem color,
// and a curated palette of typical shades per entry. Data: data/gems.js (window.GEMS), loaded in the
// background, same pattern as js/botany.js and js/passages.js.
// Pushes a "Gems" entry onto js/world.js's shared WORLD_SECTIONS array ({ key, title, render(host) }, the
// same shape Fashion and Botany use) and adds an "In gems" row on color pages (gmRow(c), called once from
// js/explore.js's colorPage, alongside Fashion's "In fashion" and Botany's "In nature" rows — all three are
// independent and additive).
// All top-level names here are prefixed gm to stay out of everyone else's way (tools/check_names.js).
// Gem and essay pages render through the app's own generic wikiPage(n) (they're graph nodes shaped like any
// other wiki page, so pin()/closeup()/Saved/search all work on them for free); the one list screen (gmListPage)
// is its own small page, styled like js/world.js's own fashionList (.wd-tiles/.wd-list/.wd-card, worldTop,
// worldBackWire) — the same look js/botany.js's btListPage reuses.

const gmV = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w.-]+)/)) || [])[1] || "";
let gmOK = false, gmStale = false, gmGraphSeen = null;
const gmWaitQ = [];

// new page-type labels this file adds (TYPE_LABEL is graph.js's own shared, mutable map — extending it here
// is the same trick js/world.js-style files use for WORLD_SECTIONS)
Object.assign(TYPE_LABEL, { gem: "Gem", gemessay: "Gem science" });

(() => {
  const s = document.createElement("script");
  s.src = "data/gems.js" + (gmV ? "?v=" + gmV : "");
  s.onload = () => { gmOK = true; gmReady(); };
  s.onerror = () => { gmOK = false; };
  document.head.appendChild(s);
})();

function gmReady() {
  if (!window.GEMS) return;
  gmBuildNodes();
  gmWaitQ.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } });
  if (gmStale && document.getElementById("feed") && typeof exploreHome === "function") { const y = scrollY; exploreHome(); scrollTo(0, y); }
  gmStale = false;
}
// run fn now if the data's here, otherwise once it lands
function gmWhen(fn) { if (window.GEMS) { gmBuildNodes(); fn(); } else gmWaitQ.push(fn); }

// ---------- turn the data into graph nodes, once ----------
// Small enough (about 30 pages) to register all at once, unlike the hundreds of passages/films that only
// become nodes when first opened. Each node is shaped like a generic wiki page, so wikiPage(n) renders it
// for free: dek, swatches, facts, body (first paragraph open, the rest folds under "The full story"), and a
// "Colors" row from n.colors. kind "gems" (not "page") so router.js can give it its own #/gem/<id>.
function gmBuildNodes() {
  if (!window.GEMS) return;
  const g = graph();
  // loader.js sets G = null once the main wiki lands, so graph() returns a brand-new Map that wouldn't
  // otherwise include these nodes; re-add them whenever graph() hands back an object we haven't seen yet.
  if (g === gmGraphSeen) return;
  gmGraphSeen = g;
  const G = window.GEMS;
  const swFor = pairs => (pairs || []).map(([h, label]) => ({ h, label }));
  const factsFor = pairs => (pairs || []).map(([label, value]) => ({ label, value }));
  G.gems.forEach(gm => {
    const id = "gm:gem:" + gm.id;
    g.nodes.set(id, { kind: "gems", type: "gem", id, title: gm.title, dek: gm.dek,
      facts: factsFor(gm.facts), body: gm.body, colors: gm.colors, sources: gm.sources, swatches: swFor(gm.palette) });
  });
  G.essays.forEach(e => {
    const id = "gm:essay:" + e.id;
    g.nodes.set(id, { kind: "gems", type: "gemessay", id, title: e.title, dek: e.dek,
      body: e.body, colors: e.colors, sources: e.sources, swatches: [] });
  });
  // hotlinked Commons thumbnails: merge into the shared WIKI_IMAGES map (same shape data/images.js uses),
  // keyed by node id, so the generic figHTML()/wikiPage() picks them up with no changes to js/explore.js.
  // Re-merged every time graph() rebuilds (above), since loader.js replaces window.WIKI_IMAGES wholesale
  // once data/images.js lands, which would otherwise wipe this.
  if (G.images) window.WIKI_IMAGES = Object.assign(window.WIKI_IMAGES || {}, G.images);
  if (window.GEM_IMAGES) window.WIKI_IMAGES = Object.assign(window.WIKI_IMAGES || {}, window.GEM_IMAGES);   // data/gem-images.js: one photo for every other gem
}
const gmNode = id => graph().nodes.get(id);

// ---------- the World lens section (js/world.js: WORLD_SECTIONS is a shared, bare top-level array of
// { key, title, render(host) }; worldMount() calls render(host) into its own slot once per section) ----------
const GM_TILES = [["gems", "Gems", G => `${G.gems.length} gems and minerals`], ["essays", "Why they're colored", G => `${G.essays.length} short reads`]];
function gmWorldSection(host) {
  if (!window.GEMS) {
    host.innerHTML = `<p class="x-sub">Loading the gems behind the colors…</p>`;
    gmWhen(() => { if (host.isConnected) gmWorldSection(host); });
    return;
  }
  const G = window.GEMS;
  host.innerHTML = `<p class="x-sub">What gives a ruby its red and an opal its flashes of color — the chemistry and physics behind the names.</p>
    <div class="wd-tiles">${GM_TILES.map(([k, t, s]) => `<button class="wd-tile" data-gm="${esc(k)}"><b>${esc(t)}</b><span>${esc(s(G))}</span></button>`).join("")}</div>`;
  host.querySelectorAll("[data-gm]").forEach(b => b.onclick = () => gmListPage(b.dataset.gm));
}
WORLD_SECTIONS.push({ key: "gems", title: "Gems", render: gmWorldSection });

// ---------- the list screen (gems / essays), one card per entry, Fashion's and Botany's own look ----------
const GM_LIST_META = {
  gems: ["Gems and minerals", "What gives each one its color, the names it lent the world, and a palette of its typical shades."],
  essays: ["Why they're colored", "Short reads on the chemistry and physics behind gem color."]
};
const gmListTitle = kind => (GM_LIST_META[kind] || ["Gems"])[0];
function gmListNodes(kind) {
  const G = window.GEMS;
  if (kind === "essays") return G.essays.map(e => gmNode("gm:essay:" + e.id));
  return G.gems.map(g => gmNode("gm:gem:" + g.id));
}
function gmFallback() { xToOrigin(); }   // where the trail started (js/explore.js), never a guessed room
function gmListPage(kind, opts = {}) {
  if (!window.GEMS) return gmFallback();
  gmBuildNodes();
  const [title, dek] = GM_LIST_META[kind] || ["Gems", ""];
  const nodes = gmListNodes(kind);
  const el = show(`
    ${worldTop("Gems")}
    <h1 class="p-title">${esc(title)}</h1>
    <p class="p-dek">${esc(dek)}</p>
    ${masonry(nodes.map(n => pin(n)))}
    ${kind === "gems" ? `<p class="fine">${esc(window.GEMS.note)}</p>` : ""}
  `, "article bt-list");
  worldBackWire(el, opts, gmFallback);
  el.addEventListener("click", e => { const p = e.target.closest("[data-pin]"); if (p) closeup(graph().nodes.get(p.dataset.pin)); });
  return el;
}

// ---------- "In gems" row on a color page (js/explore.js colorPage calls gmRow(c)) ----------
// Two kinds of hit: a color this gem actually gave its name to (data/gems.js's own `colors` list), and a
// color that simply sits close (by CIEDE2000) to one of the gem's typical palette shades — the same
// proximity trick js/world.js's worldColorRow uses for Fashion's "In fashion" row.
function gmRowHits(c) {
  if (!window.GEMS) return [];
  const hits = [];
  window.GEMS.gems.forEach(gm => {
    const id = "gm:gem:" + gm.id;
    const named = (gm.colors || []).some(n => n.toLowerCase() === c.n.toLowerCase());
    let best = null;
    (gm.palette || []).forEach(([h]) => { const d = de2000(c.h, h); if (!best || d < best.d) best = { h, d }; });
    if (named || (best && best.d < 10)) hits.push({ id, title: gm.title, h: best ? best.h : c.h, named, d: best ? best.d : 0 });
  });
  return hits.sort((a, b) => (a.named === b.named ? a.d - b.d : a.named ? -1 : 1)).slice(0, 6);
}
function gmRowHTML(c) {
  const hits = gmRowHits(c);
  if (!hits.length) return "";
  return `<section class="arch-row gm-row"><h3>In gems</h3>${hits.map(h => `<button class="kin" data-to="${esc(h.id)}"><i style="--c:${h.h}"></i><b>${esc(h.title)}</b><span>${h.named ? "Named after this color" : "A close match to one of its shades"}</span></button>`).join("")}</section>`;
}
function gmRow(c) {
  const id = "gm-row-" + Math.random().toString(36).slice(2, 8);
  gmWhen(() => requestAnimationFrame(() => {
    const box = document.getElementById(id); if (!box) return;
    box.innerHTML = gmRowHTML(c);
    wireLinks(box);
  }));
  return `<div class="gm-rows" id="${id}"></div>`;
}

// ---------- opening a direct #/gem/<id> address (router.js) ----------
function gmOpenRoute(id) {
  XSTACK = [];
  gmWhen(() => {
    if (GM_LIST_META[id]) return gmListPage(id);
    const n = gmNode("gm:gem:" + id) || gmNode("gm:essay:" + id);
    if (n) openNode(n); else go(S.tab || "learn");
  });
}
