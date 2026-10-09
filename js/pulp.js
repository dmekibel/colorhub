"use strict";
// Pulp magazine and paperback covers (design-history lane, added 2026-10-09; David: "Pulp covers can be part of the
// app — an archive of pulp art"). A door in World (js/world.js WORLD_SECTIONS, the same extension point its own
// comment invites: "other agents add Botany and Gems later by pushing another entry"), reusing two pieces whole
// rather than building new ones:
//   - paintingPage(n) (js/explore.js) for every cover's detail screen: palette, swatch names, who/when, the image
//     credit. Each cover becomes an ordinary graph-shaped "painting" node (id "pulp-<src>-<id>"); paintingPage,
//     closeup and the router's generic nodeRouted() wrapping all already handle a node that isn't registered in
//     graph() (connections() and g.out/g.back simply return nothing for an unknown id, so "More like this" shows
//     an empty, harmless state rather than crashing).
//   - pin()/masonry() (js/explore.js) for the grid: the same two-column card used for Art's paintings.
// Data: data/design/objects-pulp.json (built by tools/design_corpus.py + tools/museums/pulpc.py / pulpia.py; the
// corpus and its findings are research/DESIGN-HISTORY.md §7). Small enough (about 0.5 MB, 832 covers) to fetch and
// hold in memory whole, unlike the 14,447-painting gallery's binary-indexed loader (js/gallery.js) — no new index
// format needed. Route: the grid is #/pulp; a cover's own address comes free from nodeRoute()'s existing "painting"
// case, #/painting/pulp-<id>.

const PULP_SRC = "data/design/objects-pulp.json";
let PULP = null, PULP_LOADING = null;

function loadPulp() {
  if (PULP) return Promise.resolve(PULP);
  return PULP_LOADING || (PULP_LOADING = fetch(PULP_SRC).then(r => { if (!r.ok) throw new Error("pulp " + r.status); return r.json(); })
    .then(rows => (PULP = rows.map(pulpNode)))
    .catch(e => { PULP_LOADING = null; throw e; }));
}
function pulpNode(o) {
  const pal = (o.p || []).map(([h, share]) => ({ h, share, name: (typeof nameOf === "function" ? nameOf(h).text : "") || h }));
  return {
    id: "pulp-" + o.id, kind: "painting", title: o.t || o.mag || "Pulp cover", artist: o.a || null, year: o.y,
    place: o.mag ? `${o.mag}${o.y ? "" : ""}` : null, img: o.i, palette: pal, note: null,
    commons: o.u || null, license: o.lic || null, imgSrcLabel: o.src === "pulpia" ? "Internet Archive" : "Wikimedia Commons",
    mag: o.mag || "", src: o.src, decade: o.y != null ? Math.floor(o.y / 10) * 10 : null,
  };
}

let PULP_FILTER = { mag: "", decade: null, artist: "" };

function pulpFacets(rows) {
  const mags = [...new Set(rows.map(r => r.mag).filter(Boolean))].sort((a, b) => rows.filter(r => r.mag === b).length - rows.filter(r => r.mag === a).length).slice(0, 24);
  const decades = [...new Set(rows.map(r => r.decade).filter(d => d != null))].sort((a, b) => a - b);
  const artists = [...new Set(rows.map(r => r.artist).filter(Boolean))].sort((a, b) => rows.filter(r => r.artist === b).length - rows.filter(r => r.artist === a).length).slice(0, 20);
  return { mags, decades, artists };
}
function pulpFiltered() {
  return (PULP || []).filter(r => (!PULP_FILTER.mag || r.mag === PULP_FILTER.mag) && (!PULP_FILTER.artist || r.artist === PULP_FILTER.artist)
    && (PULP_FILTER.decade == null || r.decade === PULP_FILTER.decade));
}

// ---------------------------------------------------------------- the World door tile
function worldPulpSection(host) {
  host.innerHTML = `<p class="x-sub">Magazine and paperback cover art, 1890s-1960s: the newsstand's own vivid, high-contrast palette.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="pulp"><span class="wd-art">${wdBars(["#C8232C", "#F2C53D", "#1C2B3A", "#E7861A", "#2E5C3E"])}</span><b>Pulp covers</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadPulp().then(rows => { if (sub) sub.textContent = `${rows.length} covers, ${pulpFacets(rows).mags.length}+ magazines`; })
    .catch(() => { if (sub) sub.textContent = "Couldn't load"; });
  const b = host.querySelector('[data-wd="pulp"]'); if (b) b.onclick = () => pulpGrid();
}
WORLD_SECTIONS.push({ key: "pulp", title: "Pulp covers", render: worldPulpSection });

// ---------------------------------------------------------------- the grid screen, #/pulp
function pulpGrid(push = true) {
  const el = show(`
    ${worldTop("Pulp covers")}
    <h1 class="p-title">Pulp covers</h1>
    <p class="p-dek">Magazine and paperback cover art, public domain in the US (pre-1930, or marked public domain by its own source), from the Internet Archive's Pulp Magazine Archive and Wikimedia Commons. The paper is as scanned: yellowed stock, studio light, a few faded dyes.</p>
    <div class="art-bubbles" id="pulpChips" role="tablist"></div>
    <div id="pulpFeed"><p class="fine">Loading the covers…</p></div>
  `, "article");
  if (push && typeof XSTACK !== "undefined") XSTACK.push("r:pulp");
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  // wired once: redraws (pulpDraw) only replace innerHTML, so one delegated listener covers every filter click and pin tap
  el.querySelector("#pulpChips").onclick = e => {
    const b = e.target.closest("[data-pf]"); if (!b) return;
    const key = b.dataset.pf, v = b.dataset.pv;
    PULP_FILTER[key] = key === "decade" ? (v === "" ? null : +v) : v;
    buzz(6); pulpDraw(el);
  };
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = (PULP || []).find(r => r.id === p.dataset.pin); if (n) paintingPage(n); return; }
    if (e.target.closest("[data-retry]")) pulpGrid(false);
  });
  loadPulp().then(() => pulpDraw(el)).catch(() => {
    const feed = el.querySelector("#pulpFeed"); if (feed) feed.innerHTML = `<p class="fine">The covers didn't load. <button class="wl" data-retry>Try again</button></p>`;
  });
}
function pulpDraw(el) {
  const rows = pulpFiltered(), { mags, decades, artists } = pulpFacets(PULP || []);
  const chip = (label, on, attr) => `<button class="art-bubble pulp-chip${on ? " on" : ""}" ${attr}>${esc(label)}</button>`;
  const chips = el.querySelector("#pulpChips");
  if (chips) {
    chips.innerHTML = [
      chip("All magazines", !PULP_FILTER.mag, 'data-pf="mag" data-pv=""'),
      ...mags.map(m => chip(m, PULP_FILTER.mag === m, `data-pf="mag" data-pv="${esc(m)}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All decades", PULP_FILTER.decade == null, 'data-pf="decade" data-pv=""'),
      ...decades.map(d => chip(d + "s", PULP_FILTER.decade === d, `data-pf="decade" data-pv="${d}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All artists", !PULP_FILTER.artist, 'data-pf="artist" data-pv=""'),
      ...artists.map(a => chip(a, PULP_FILTER.artist === a, `data-pf="artist" data-pv="${esc(a)}"`)),
    ].join("");
  }
  const feed = el.querySelector("#pulpFeed");
  if (feed) feed.innerHTML = rows.length ? masonry(rows.map(n => pin(n))) : `<p class="fine">No covers match. Try fewer filters.</p>`;
}
