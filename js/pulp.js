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

// magazines, busiest first (the World door's own count line)
function pulpMags(rows) {
  const m = new Map(); rows.forEach(r => { if (r.mag) m.set(r.mag, (m.get(r.mag) || 0) + 1); });
  return [...m.keys()].sort((a, b) => m.get(b) - m.get(a));
}

// ---------------------------------------------------------------- the World door tile
function worldPulpSection(host) {
  host.innerHTML = `<p class="x-sub">Magazine and paperback cover art, 1890s-1960s: the newsstand's own vivid, high-contrast palette.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="pulp"><span class="wd-art">${wdBars(["#C8232C", "#F2C53D", "#1C2B3A", "#E7861A", "#2E5C3E"])}</span><b>Pulp covers</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadPulp().then(rows => { if (sub) sub.textContent = `${rows.length} covers, ${pulpMags(rows).length} magazines`; })
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
    <div data-ab-host></div>
  `, "article");
  // David, 2026-10-10 (js/designobjects.js carries the full note): pulpGrid is ROUTED, so trail.js already
  // joined it as "r:pulp" when show() ran just above -- pushing the same token again here duplicated it, and
  // the grid's own ‹ (one pop) silently redrew this same screen instead of leaving it.
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  // the grid: js/archbrowse.js's shared one (the painting map's Filter sheet: magazine, artist, a decade range,
  // color; Sort; Keep hearts; the map) -- David, 2026-10-11
  abMount(el.querySelector("[data-ab-host]"), "pulp", { fresh: push });
}
