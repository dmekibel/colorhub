"use strict";
// Botanical & bird plates (World door, Archives lane, David 2026-10-09): hand-colored natural-history
// illustrations, public domain, from Wikimedia Commons -- Audubon's "The Birds of America" (Robert Havell's
// engravings after Audubon's watercolors, 1827-1838), Curtis's Botanical Magazine (via the Biodiversity
// Heritage Library's own Flickr stream, re-hosted and marked PD on Commons) and Pierre-Joseph Redouté's flower
// and rose plates. Built by tools/botanical_corpus.py. Modeled on js/pulp.js / js/photography.js / js/ukiyoe.js:
// a door in World, a grid reusing pin()/masonry(), the plate's own page reusing paintingPage() whole (plus the
// n.facts extension js/designobjects.js added). Prefix "bp" (not "bt" -- js/botany.js already owns that prefix
// for the color-word plant-origin pages this file links out to).
//
// Data: data/botanical/plates.json (one file, ~800-900 selected plates). Images are Commons' own thumbnail URLs
// (upload.wikimedia.org/thumb.wikimedia.org), hotlinked -- never self-hosted, the same choice the app already
// makes for botany/gem/fashion photos (js/world.js worldImgHTML's own comment).
//
// Cross-links: a plate's subject (the plant or bird name, read from its Commons title) is matched against
// data/botany.js's 37 plant-origin pages (window.BOTANY.plants, each a color word named after a plant -- e.g.
// "Orange", "Lavender", "Saffron", "Peach", "Olive", "Violet") by a plain case-insensitive whole-word match
// against that plant's own color word. This is deliberately narrow (most of the ~890 plates' species have no
// color-word page to link to) rather than invented: when it hits, it is a real match; when it doesn't, the
// plate page simply has no "Also a color name" row, which is the honest result, not a padded one. There is no
// bird dataset anywhere else in the app to cross-link bird plates to (confirmed by inspection), so that half of
// David's request ("link plates to... bird pages where species match") has nothing to link to yet.

const BP_SRC = "data/botanical/plates.json";
let BP = null, BP_LOADING = null, BP_BY_ID = null;
let BP_WAIT_Q = [];
const BP_SRC_LABEL = { audubon: "Wikimedia Commons (The Birds of America)", curtis: "Wikimedia Commons (Curtis's Botanical Magazine)",
  "redoute-fleurs": "Wikimedia Commons (Choix des plus belles fleurs)", "redoute-roses": "Wikimedia Commons (Les Roses)" };
const BP_KIND_LABEL = { bird: "Bird plate", plant: "Botanical plate" };

// ---------------------------------------------------------------- cross-links to data/botany.js's color-word plants
let BP_PLANT_RX = null;
// Plants only: a bird's name can share a plain English word with a color ("Violet-green Swallow") with no
// causal connection at all, so a match there would be a wrong fact, not a sparse-but-real one. The word must
// also not sit inside a hyphenated compound ("Violet-green"), so a false positive like that one can't pass
// even on a plant plate. Two ways to match, since this corpus's plates are mostly titled by Latin binomial
// (Curtis's, Redouté), not the English name botany.js writes its color-word pages around:
//   1. the color's own English word appears in the plate's subject as a whole word ("Sweet violet" matches Violet)
//   2. the plant's genus (the first Latin word botany.js already carries in parens, e.g. "Viola odorata" -> Viola)
//      is the plate's own genus (the plate subject's own first word) -- a real taxonomic match, not a text scan.
function bpBuildPlantRX() {
  return window.BOTANY.plants.map(p => {
    const m = /\(([A-Z][a-z]+)\b/.exec(p.plant || "");
    return { p, rx: new RegExp("(?<![\\w-])" + p.color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])", "i"), genus: m ? m[1] : null };
  });
}
function bpBotanyMatch(subject, kind) {
  if (kind !== "plant" || !window.BOTANY || !window.BOTANY.plants) return null;
  if (!BP_PLANT_RX) BP_PLANT_RX = bpBuildPlantRX();
  const subjGenus = (/^([A-Z][a-z]+)\b/.exec(subject) || [])[1];
  const word = BP_PLANT_RX.find(x => x.rx.test(subject));
  if (word) return { p: word.p, via: "word" };
  const genus = BP_PLANT_RX.find(x => x.genus && subjGenus && x.genus === subjGenus);
  return genus ? { p: genus.p, via: "genus" } : null;
}
function bpFindingFor(o) {
  const bits = [];
  const match = bpBotanyMatch(o.t, o.kind);
  if (match) bits.push(match.via === "genus"
    ? `${o.t} is in the same genus as the plant the color name "${match.p.color}" comes from.`
    : `${o.t} is also where the color name "${match.p.color}" comes from.`);
  bits.push(o.kind === "bird"
    ? "Colors are as scanned or photographed: an engraved plate, hand-colored by a team of colorists against a reference, then aged paper and a photography pass, all before the hex shown."
    : "Colors are as scanned or photographed: hand-applied watercolor over an engraving or lithograph, never perfectly consistent plate to plate, plus aged paper and a photography pass.");
  return bits.join(" ");
}
function bpFactsFor(o) {
  const f = [];
  if (o.a) f.push({ label: "Artist", value: o.a });
  if (o.y) f.push({ label: "Date", value: String(o.y) });
  f.push({ label: "Collection", value: BP_SRC_LABEL[o.src] || "Wikimedia Commons" });
  return f;
}
function bpNode(o) {
  const palette = (o.p || []).map(([h, share, ci]) => ({ h, share, name: (CORE_NAMES && CORE_NAMES[ci] && CORE_NAMES[ci].n) || h }));
  const match = bpBotanyMatch(o.t, o.kind);
  return {
    id: "bp-" + o.id, kind: "painting", typeLabel: BP_KIND_LABEL[o.kind] || "Plate",
    title: o.t || "Untitled plate", artist: o.a || null, year: o.y || null,
    decade: o.y != null ? Math.floor(o.y / 10) * 10 : null,
    place: BP_SRC_LABEL[o.src] || "Wikimedia Commons", img: o.img, w: o.w, h: o.h, palette,
    facts: bpFactsFor(o), note: bpFindingFor(o), botanyMatch: match ? match.p.id : null,
    commons: o.u || null, license: "Public domain", imgSrcLabel: "Wikimedia Commons",
    src: o.src, kindRaw: o.kind,
  };
}
// data/botany.js (window.BOTANY) is self-loaded by js/botany.js (its own injected <script> tag, not the
// DATA_SRC/loadData lazy mechanism); btWhen(fn) is the function it exports for "run this once BOTANY exists".
// js/botany.js's own s.onerror never flushes its wait queue (a dropped/failed request there just leaves
// btOK false forever), so a bare btWhen(res) here could hang this room's entire load on a botany.js failure
// that has nothing to do with botanical plates -- a 4s timeout guard means a slow or failed botany.js only
// costs the color cross-links (bpBotanyMatch degrades to "no match" when BOTANY never arrives), never the room.
function bpWhenBotany() {
  return new Promise(res => {
    if (typeof btWhen !== "function") { res(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; res(); } };
    btWhen(go);
    setTimeout(go, 4000);
  });
}
function loadBotanical() {
  if (BP) return Promise.resolve(BP);
  if (BP_LOADING) return BP_LOADING;
  return BP_LOADING = Promise.all([loadCoreNames().catch(() => []), bpWhenBotany().catch(() => null),
    fetch(BP_SRC).then(r => { if (!r.ok) throw new Error("botanical " + r.status); return r.json(); })])
    .then(([, , rows]) => {
      BP = rows.map(bpNode);
      BP_BY_ID = new Map(BP.map(n => [n.id, n]));
      return BP;
    }).catch(e => { BP_LOADING = null; throw e; });
}
function bpWhen(fn) {
  if (BP) { fn(); return; }
  BP_WAIT_Q.push(fn);
  loadBotanical().then(() => { const q = BP_WAIT_Q; BP_WAIT_Q = []; q.forEach(f => f()); }).catch(() => {});
}
function bpOpenPlate(id) {
  if (!BP) { bpWhen(() => bpOpenPlate(id)); return; }
  const n = BP_BY_ID.get(id);
  if (!n) { if (typeof xToOrigin === "function") xToOrigin(); return; }
  paintingPage(n);
  if (n.botanyMatch && typeof btOpenRoute === "function") {
    const el = app.firstElementChild, findings = el && el.querySelector(".p-body");
    if (findings) {
      const btn = document.createElement("button");
      btn.className = "wl"; btn.style.cssText = "display:block;margin-top:10px";
      btn.textContent = `See the color "${window.BOTANY.plants.find(p => p.id === n.botanyMatch).color}"`;
      btn.onclick = () => { XSTACK = []; btOpenRoute(n.botanyMatch); };
      findings.after(btn);
    }
  }
}

// ---------------------------------------------------------------- facets + filter state
let BP_FILTER = { kind: "", decade: null };
function bpFacets(rows) {
  const decadeCounts = new Map();
  rows.forEach(r => { if (r.decade != null) decadeCounts.set(r.decade, (decadeCounts.get(r.decade) || 0) + 1); });
  return { decades: [...decadeCounts.entries()].sort((a, b) => a[0] - b[0]).map(([d]) => d) };
}
function bpFiltered() {
  return BP.filter(n => (!BP_FILTER.kind || n.kindRaw === BP_FILTER.kind) && (BP_FILTER.decade == null || n.decade === BP_FILTER.decade));
}

// ---------------------------------------------------------------- the grid, #/botanical
function bpGrid(push = true) {
  if (!BP) { bpWhen(() => bpGrid(push)); return; }
  BP_FILTER = { kind: "", decade: null };
  const nBird = BP.filter(n => n.kindRaw === "bird").length, nPlant = BP.length - nBird;
  const el = show(`
    ${worldTop("Botanical & bird plates")}
    <h1 class="p-title">Botanical &amp; bird plates</h1>
    <p class="p-dek">${BP.length.toLocaleString()} hand-colored natural-history plates, public domain, from Wikimedia Commons: ${nBird.toLocaleString()} birds (Audubon's "The Birds of America"), ${nPlant.toLocaleString()} botanical (Curtis's Botanical Magazine and Pierre-Joseph Redouté). Painted, then engraved and hand-colored plate by plate — no two copies are quite identical.</p>
    <div class="art-bubbles" id="bpChips" role="tablist"></div>
    <div id="bpFeed"></div>
    <p class="fine">Colors are as scanned or photographed: hand-applied color over a printed plate, aged paper, and a photography pass all sit between a plate and the hex shown.</p>
  `, "article wd");
  // David, 2026-10-10 (js/designobjects.js carries the full note): bpGrid is ROUTED, so trail.js already
  // joined it as "r:botanical" when show() ran just above -- pushing the same token again here duplicated it.
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  const draw = () => {
    const rows = bpFiltered(), { decades } = bpFacets(BP);
    const chip = (label, on, attr) => `<button class="art-bubble pulp-chip${on ? " on" : ""}" ${attr}>${esc(label)}</button>`;
    const chips = el.querySelector("#bpChips");
    if (chips) chips.innerHTML = [
      chip("All", !BP_FILTER.kind, 'data-bf="kind" data-bv=""'),
      chip("Birds", BP_FILTER.kind === "bird", 'data-bf="kind" data-bv="bird"'),
      chip("Botanical", BP_FILTER.kind === "plant", 'data-bf="kind" data-bv="plant"'),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All decades", BP_FILTER.decade == null, 'data-bf="decade" data-bv=""'),
      ...decades.map(d => chip(d + "s", BP_FILTER.decade === d, `data-bf="decade" data-bv="${d}"`)),
    ].join("");
    const feed = el.querySelector("#bpFeed");
    if (feed) feed.innerHTML = rows.length ? masonry(rows.map(n => pin(n))) : `<p class="fine">No plates match. Try fewer filters.</p>`;
  };
  el.querySelector("#bpChips").onclick = e => {
    const b = e.target.closest("[data-bf]"); if (!b) return;
    const key = b.dataset.bf, v = b.dataset.bv;
    BP_FILTER[key] = key === "decade" ? (v === "" ? null : +v) : v;
    buzz(6); draw();
  };
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = BP_BY_ID.get(p.dataset.pin); if (n) bpOpenPlate(n.id); }
  });
  draw();
}

// ---------------------------------------------------------------- the World door tile
function worldBotanicalSection(host) {
  host.innerHTML = `<p class="x-sub">Hand-colored natural-history plates, public domain: Audubon's birds, Curtis's Botanical Magazine and Redouté's flowers, from Wikimedia Commons.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="botanical"><span class="wd-art">${wdBars(["#4A6B3C", "#C96B4A", "#7A5C9E", "#3C6B6B", "#A8873C"])}</span><b>Botanical &amp; bird plates</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadBotanical().then(rows => { if (sub) sub.textContent = `${rows.length.toLocaleString()} plates`; })
    .catch(() => { if (sub) sub.textContent = "Couldn't load"; });
  const b = host.querySelector('[data-wd="botanical"]'); if (b) b.onclick = () => bpGrid();
}
WORLD_SECTIONS.push({ key: "botanical", title: "Botanical & bird plates", render: worldBotanicalSection });

function bpShot(kind, arg) {
  if (kind === "botanical") return bpGrid(false);
  if (kind === "botanicalplate") return bpWhen(() => bpOpenPlate(arg || (BP[0] && BP[0].id)));
}
