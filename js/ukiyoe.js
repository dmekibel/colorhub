"use strict";
// Ukiyo-e prints (World door, Archives lane, David 2026-10-09): Japanese woodblock prints, public domain, from
// the Art Institute of Chicago (aicu) and the Cleveland Museum of Art (cmau) -- both keyless CC0 APIs, built by
// tools/ukiyoe_corpus.py. Modeled on js/pulp.js and js/photography.js: a door in World (WORLD_SECTIONS), a grid
// reusing pin()/masonry() (js/explore.js), and the print's own page reusing paintingPage() whole for its hero,
// palette and credit -- exactly the same "painting"-shaped-node reuse those two files already prove out, plus
// the one small paintingPage() extension js/designobjects.js added (n.facts, a dt/dd row for Artist/Date/Series/
// Museum) which this file reuses rather than duplicating.
//
// Data: data/ukiyoe/prints.json (one file, ~1,700 selected prints after balancing -- small enough to fetch and
// hold whole, same reasoning pulp.js's own header comment gives for not needing the gallery's binary index).
//
// Images: cmau (Cleveland) hotlinks its own CDN directly (openaccess-cdn.clevelandart.org, already proven
// reachable with no special header by the design-objects lane). aicu (Art Institute of Chicago) needs the same
// AIC-User-Agent header design-objects' aicd source needs -- a header a plain <img> tag can never send -- so
// those thumbnails are self-hosted under img/ukiyoe/aicu/<id>.jpg (tools/ukiyoe_corpus.py's `images` step,
// copied into the served tree; see that file's own header comment for the exact reasoning, first established
// for data/design/objects' aicd source).
//
// Context, not myth: ukiyo-e printmakers worked from a historically narrow, largely plant- and mineral-based
// palette -- indigo (ai) for blue and blue-green, beni (a safflower-derived pink-red that fades fastest of all
// of them, so many surviving prints read cooler and more muted than they printed) and a handful of others --
// until the synthetic pigment Prussian blue reached Japan in quantity in the late 1820s. Hokusai's "Thirty-Six
// Views of Mount Fuji" (begun around 1830) is the print series most associated with that arrival, which is why
// so many of its skies and waves are Prussian blue rather than indigo. Said once, on the room page, not repeated
// per print.

const UK_SRC = "data/ukiyoe/prints.json";
let UK = null, UK_LOADING = null, UK_BY_ID = null;
let UK_WAIT_Q = [];
const UK_IMG_TPL = { cmau: i => i, aicu: (i, id) => `img/ukiyoe/aicu/${id}.jpg` };
const UK_SRC_LABEL = { aicu: "Art Institute of Chicago", cmau: "Cleveland Museum of Art" };
const UK_LICENSE = { aicu: "Public domain", cmau: "CC0" };

function ukImgUrl(o) {
  const f = UK_IMG_TPL[o.src];
  return f ? f(o.i, o.id) : null;
}
function ukFindingFor(o) {
  const bits = [];
  if (o.series) bits.push(`From the series "${o.series}."`);
  bits.push("Colors are as scanned or photographed: aged paper, pigments that have shifted or faded over 150-250 years (beni red fades fastest), and a photography pass all sit between the print and the hex shown.");
  return bits.join(" ");
}
function ukFactsFor(o) {
  const f = [];
  if (o.a) f.push({ label: "Artist", value: o.a });
  if (o.y) f.push({ label: "Date", value: String(o.y) });
  if (o.series) f.push({ label: "Series", value: o.series });
  f.push({ label: "Collection", value: UK_SRC_LABEL[o.src] || o.src });
  return f;
}
function ukNode(o) {
  const palette = (o.p || []).map(([h, share, ci]) => ({ h, share, name: (CORE_NAMES && CORE_NAMES[ci] && CORE_NAMES[ci].n) || h }));
  const decade = o.y != null ? Math.floor(o.y / 10) * 10 : null;
  return {
    id: "uk-" + o.id, kind: "painting", typeLabel: "Ukiyo-e print",
    title: o.t || "Untitled print", artist: o.a || null, year: o.y || null, decade,
    place: UK_SRC_LABEL[o.src] || o.src, series: o.series || null,
    img: ukImgUrl(o), palette, facts: ukFactsFor(o), note: ukFindingFor(o),
    commons: o.u || null, license: UK_LICENSE[o.src] || "Public domain", imgSrcLabel: UK_SRC_LABEL[o.src],
    src: o.src,
  };
}
function loadUkiyoe() {
  if (UK) return Promise.resolve(UK);
  if (UK_LOADING) return UK_LOADING;
  return UK_LOADING = Promise.all([loadCoreNames().catch(() => []), fetch(UK_SRC).then(r => { if (!r.ok) throw new Error("ukiyoe " + r.status); return r.json(); })])
    .then(([, rows]) => {
      UK = rows.map(ukNode);
      UK_BY_ID = new Map(UK.map(n => [n.id, n]));
      return UK;
    }).catch(e => { UK_LOADING = null; throw e; });
}
function ukWhen(fn) {
  if (UK) { fn(); return; }
  UK_WAIT_Q.push(fn);
  loadUkiyoe().then(() => { const q = UK_WAIT_Q; UK_WAIT_Q = []; q.forEach(f => f()); }).catch(() => {});
}
function ukOpenPrint(id) {
  if (!UK) { ukWhen(() => ukOpenPrint(id)); return; }
  const n = UK_BY_ID.get(id);
  if (!n) { if (typeof xToOrigin === "function") xToOrigin(); return; }
  paintingPage(n);
}

// ---------------------------------------------------------------- facets + filter state
let UK_FILTER = { artist: "", decade: null };
function ukFacets(rows) {
  const artists = new Map();
  rows.forEach(r => { if (r.artist) artists.set(r.artist, (artists.get(r.artist) || 0) + 1); });
  const decadeCounts = new Map();
  rows.forEach(r => { if (r.decade != null) decadeCounts.set(r.decade, (decadeCounts.get(r.decade) || 0) + 1); });
  return {
    artists: [...artists.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([a]) => a),
    decades: [...decadeCounts.entries()].sort((a, b) => a[0] - b[0]).map(([d]) => d),
  };
}
function ukFiltered() {
  return UK.filter(n => (!UK_FILTER.artist || n.artist === UK_FILTER.artist) && (UK_FILTER.decade == null || n.decade === UK_FILTER.decade));
}

// ---------------------------------------------------------------- the grid, #/ukiyoe
function ukGrid(push = true) {
  if (!UK) { ukWhen(() => ukGrid(push)); return; }
  UK_FILTER = { artist: "", decade: null };
  const el = show(`
    ${worldTop("Ukiyo-e prints")}
    <h1 class="p-title">Ukiyo-e prints</h1>
    <p class="p-dek">${UK.length.toLocaleString()} Japanese woodblock prints, public domain, from the Art Institute of Chicago and the Cleveland Museum of Art. A narrow natural palette — indigo, and a safflower pink-red that fades fastest — until Prussian blue arrived in the late 1820s.</p>
    <div class="art-bubbles" id="ukChips" role="tablist"></div>
    <div id="ukFeed"></div>
    <p class="fine">Colors are as scanned or photographed: aged paper, shifted and faded pigments, and the scan itself all sit between a print and the hex shown.</p>
  `, "article wd");
  // David, 2026-10-10 (js/designobjects.js carries the full note): ukGrid is ROUTED, so trail.js already
  // joined it as "r:ukiyoe" when show() ran just above -- pushing the same token again here duplicated it.
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  const draw = () => {
    const rows = ukFiltered(), { artists, decades } = ukFacets(UK);
    const chip = (label, on, attr) => `<button class="art-bubble pulp-chip${on ? " on" : ""}" ${attr}>${esc(label)}</button>`;
    const chips = el.querySelector("#ukChips");
    if (chips) chips.innerHTML = [
      chip("All artists", !UK_FILTER.artist, 'data-uf="artist" data-uv=""'),
      ...artists.map(a => chip(a, UK_FILTER.artist === a, `data-uf="artist" data-uv="${esc(a)}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All decades", UK_FILTER.decade == null, 'data-uf="decade" data-uv=""'),
      ...decades.map(d => chip(d + "s", UK_FILTER.decade === d, `data-uf="decade" data-uv="${d}"`)),
    ].join("");
    const feed = el.querySelector("#ukFeed");
    if (feed) feed.innerHTML = rows.length ? masonry(rows.map(n => pin(n))) : `<p class="fine">No prints match. Try fewer filters.</p>`;
  };
  el.querySelector("#ukChips").onclick = e => {
    const b = e.target.closest("[data-uf]"); if (!b) return;
    const key = b.dataset.uf, v = b.dataset.uv;
    UK_FILTER[key] = key === "decade" ? (v === "" ? null : +v) : v;
    buzz(6); draw();
  };
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = UK_BY_ID.get(p.dataset.pin); if (n) ukOpenPrint(n.id); }
  });
  draw();
}

// ---------------------------------------------------------------- the World door tile
function worldUkiyoeSection(host) {
  host.innerHTML = `<p class="x-sub">Japanese woodblock prints, public domain: Hokusai, Hiroshige, Utamaro, Sharaku and hundreds more, from the Art Institute of Chicago and the Cleveland Museum of Art.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="ukiyoe"><span class="wd-art">${wdBars(["#2E4A6B", "#C8373A", "#E0B04A", "#2F5C4A", "#3B3B3B"])}</span><b>Ukiyo-e prints</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadUkiyoe().then(rows => { if (sub) sub.textContent = `${rows.length.toLocaleString()} prints`; })
    .catch(() => { if (sub) sub.textContent = "Couldn't load"; });
  const b = host.querySelector('[data-wd="ukiyoe"]'); if (b) b.onclick = () => ukGrid();
}
WORLD_SECTIONS.push({ key: "ukiyoe", title: "Ukiyo-e prints", render: worldUkiyoeSection });

function ukShot(kind, arg) {
  if (kind === "ukiyoe") return ukGrid(false);
  if (kind === "ukiyoeprint") return ukWhen(() => ukOpenPrint(arg || (UK[0] && UK[0].id)));
}
