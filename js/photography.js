"use strict";
// Color photography (Museum → World, Phase 2; David: "treat famous photographers and famous photos... except
// black-and-white photos, since this app is about color"). Research, sources and the counts: research/PHOTOGRAPHY.md.
// A door in World (js/world.js WORLD_SECTIONS, same extension point pulp.js uses -- js/pulp.js's own header comment
// invites exactly this), reusing paintingPage(n) (js/explore.js) whole for every photograph's detail screen, and
// pin()/masonry() (js/explore.js) for the grid, same as pulp.js's covers.
//
// Data: data/photography/photos.json (built by tools/photos_corpus.py; Phase 1 commit); small enough (about
// 2.5 MB, ~3,400 photos) to fetch and hold whole, same reasoning as pulp.js. data/photography/photographers.json
// (Phase 2) carries precomputed per-photographer statistics (tools/photos_corpus.py cmd_photographers): this file
// only draws them, it never recomputes a percentile client-side.
// Routes: the grid is #/photography; a photo's own address is free from nodeRoute()'s "painting" case
// (#/painting/photod-<id>); a photographer's page is #/photographer/<slug> (router.js, this file: photographerPage,
// phGetName). "In photographs" on a color page comes from data/photography/colorindex/ + js/colorindex.js
// CI_SOURCES.photography + js/paintingsof.js's photography .pin renderer -- no code here; it's wired there.

const PH_SRC = "data/photography/photos.json";
const PH_STATS_SRC = "data/photography/photographers.json";
let PH = null, PH_LOADING = null, PH_BY_ID = null;
let PH_STATS = null, PH_STATS_LOADING = null, PH_STATS_BY_SLUG = null;

// ---------------------------------------------------------------- the three processes, in the visitor's own words
// Original prose from the facts of how each process makes color (not copied from any source); the one honest
// caveat (decades-old plates, dyes and a digitization scanner all sit between the scene and the hex shown) is
// added once by phProcessNote() rather than repeated in each paragraph (design/DESIGN-CANON.md's banned list:
// "caveat paragraphs on result screens... one 'as photographed' line per page").
const PH_PROCESS_NOTES = {
  "Prokudin-Gorsky glass-plate (RGB composite)": {
    short: "Three exposures, one plate, one scene",
    text: "Prokudin-Gorsky photographed each scene three times in quick succession on one glass plate, through red, green and blue filters: three black-and-white exposures. Recombined through matching filters (today, digitally), they reconstruct color. The three exposures weren't simultaneous, so anything that moved between them — water, people, blowing cloth — shows colored fringing. A restorer also has to align the three plates and choose a color balance by eye, which is why two combined versions of the same plate can differ a little in cast.",
  },
  Autochrome: {
    short: "Millions of dyed starch grains",
    text: "An autochrome plate carries a layer of millions of microscopic potato-starch grains, each dyed red-orange, green or violet-blue and packed on the glass at random, with a light-sensitive layer on top. Light passing through that dyed layer, both at exposure and at viewing, mixes the three colors the way a screen's subpixels do, just irregular and analog instead of a fixed grid. The result reads as soft-focus next to later film, and a century of aging has shifted many plates toward a warm or magenta cast.",
  },
  "Kodachrome (FSA/OWI)": {
    short: "Three dye layers, one complex process",
    text: "Kodachrome (Kodak, 1935) built color from three stacked emulsion layers, each sensitive to a different third of the spectrum, developed through a multi-bath process that added a dye to each layer afterward rather than mixing dyes into the film itself. It gave sharp, saturated, comparatively stable color — the reason FSA and OWI photographers reached for it in 1939-43 — but its dyes still shift with age and light, usually toward red or magenta, and the era's own film stock and printing give these pictures their recognizable warm, high-contrast look.",
  },
  "NASA/USGS photograph": {
    short: "A camera on a spacecraft",
    text: "Earthrise and the Blue Marble are ordinary color photographs, shot on standard film by astronauts on the Apollo 8 and Apollo 17 missions, not composites or renderings. Their famous blues and whites are close to what a color film camera actually recorded of the planet from space, limited only by the film stock, the camera's exposure and decades of scanning and reprinting since.",
  },
};
function phProcessNote(process) {
  const n = PH_PROCESS_NOTES[process];
  if (!n) return "";
  return `${n.text} These are scans of surviving plates, transparencies or prints, so the color you see is the process, its aging and the scan, not a lab-calibrated original.`;
}

// ---------------------------------------------------------------- loading + node shape
function loadPhotography() {
  if (PH) return Promise.resolve(PH);
  return PH_LOADING || (PH_LOADING = fetch(PH_SRC).then(r => { if (!r.ok) throw new Error("photography " + r.status); return r.json(); })
    .then(rows => {
      PH = rows.map(photographyNode);
      PH_BY_ID = new Map(PH.map(n => [n.id, n]));
      return PH;
    })
    .catch(e => { PH_LOADING = null; throw e; }));
}
function loadPhotographers() {
  if (PH_STATS) return Promise.resolve(PH_STATS);
  return PH_STATS_LOADING || (PH_STATS_LOADING = fetch(PH_STATS_SRC).then(r => { if (!r.ok) throw new Error("photographers " + r.status); return r.json(); })
    .then(rows => {
      PH_STATS = rows;
      PH_STATS_BY_SLUG = new Map(rows.map(s => [s.slug, s]));
      return PH_STATS;
    })
    .catch(e => { PH_STATS_LOADING = null; throw e; }));
}
function phSlug(name) { return String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
// photoNodeById / phGetName are the two hooks router.js and js/paintingsof.js call into (deferred: PH loads lazily,
// so these only answer once it has; both callers already handle "not found yet" the same way pulp.js's node does)
function photographyNodeById(id) { return PH_BY_ID ? PH_BY_ID.get(id) : null; }
function phGetName(slug) { return PH_STATS_BY_SLUG ? (PH_STATS_BY_SLUG.get(slug) || {}).name : null; }

function photographyNode(o) {
  const pal = (o.p || []).map(([h, share, name]) => ({ h, share, name: name || h }));
  const slug = o.a ? phSlug(o.a) : null;
  return {
    id: o.id, kind: "painting", title: o.t || "Photograph", artist: o.a || "Photographer unknown", year: o.y,
    typeLabel: "Photograph", place: o.co || null, img: o.img, palette: pal, note: phProcessNote(o.process),
    commons: o.url || null, license: o.lic || "Public domain", imgSrcLabel: "Wikimedia Commons",
    process: o.process || "", country: o.co || null, decade: o.y != null ? Math.floor(o.y / 10) * 10 : null,
    photographerSlug: slug, w: o.w, h: o.h,
  };
}

// ---------------------------------------------------------------- facets + filter state
let PH_FILTER = { process: "", decade: null, country: "", photographer: "" };
function phFacets(rows) {
  const by = (key, cap) => {
    const counts = new Map();
    rows.forEach(r => { const v = r[key]; if (v) counts.set(v, (counts.get(v) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap).map(([v]) => v);
  };
  // a decade with a handful of photographs (a mis-dated outlier, not a real era the archive covers) would just
  // clutter the filter row, so only a decade with a real sample (at least 1% of the kept archive) gets a chip
  const decadeMin = Math.max(5, Math.round(rows.length * 0.01));
  const decadeCounts = new Map();
  rows.forEach(r => { if (r.decade != null) decadeCounts.set(r.decade, (decadeCounts.get(r.decade) || 0) + 1); });
  return {
    processes: by("process", 6),
    decades: [...decadeCounts.entries()].filter(([, n]) => n >= decadeMin).map(([d]) => d).sort((a, b) => a - b),
    countries: by("country", 10),
    photographers: by("artist", 18).filter(a => a !== "Photographer unknown"),
  };
}
function phFiltered() {
  return (PH || []).filter(r =>
    (!PH_FILTER.process || r.process === PH_FILTER.process) &&
    (!PH_FILTER.country || r.country === PH_FILTER.country) &&
    (!PH_FILTER.photographer || r.artist === PH_FILTER.photographer) &&
    (PH_FILTER.decade == null || r.decade === PH_FILTER.decade));
}

// ---------------------------------------------------------------- the World door tile
function worldPhotographySection(host) {
  host.innerHTML = `<p class="x-sub">Public-domain color photography, 1905-1943: Prokudin-Gorsky's Russian Empire glass plates, autochromes, the FSA/OWI's wartime Kodachromes, and a couple of NASA's own. Famous names in color photography since (Eggleston, Shore, McCurry…) are still in copyright, so they're referenced by name only, never by image.</p>
    <div class="wd-tiles"><button class="wd-tile" data-wd="photography"><span class="wd-art">${wdBars(["#8A3B2E", "#C98A3C", "#2E4A5C", "#4B6B3A", "#6B5A8A"])}</span><b>Photography</b><span class="wd-sub">Loading…</span></button></div>`;
  const sub = host.querySelector(".wd-sub");
  loadPhotography().then(rows => { if (sub) sub.textContent = `${rows.length.toLocaleString()} photographs, 3 processes`; })
    .catch(() => { if (sub) sub.textContent = "Couldn't load"; });
  const b = host.querySelector('[data-wd="photography"]'); if (b) b.onclick = () => photographyGrid();
}
WORLD_SECTIONS.push({ key: "photography", title: "Photography", render: worldPhotographySection });

// ---------------------------------------------------------------- the grid screen, #/photography
function photographyGrid(push = true) {
  const el = show(`
    ${worldTop("Photography")}
    <h1 class="p-title">Photography</h1>
    <p class="p-dek">Public-domain color photographs, 1905-1943 and two from orbit. As scanned: aged plates, shifted dyes, a digitization's own color choices.</p>
    <div class="art-bubbles" id="phChips" role="tablist"></div>
    <div id="phFeed"><p class="fine">Loading the photographs…</p></div>
  `, "article");
  // David, 2026-10-10 (js/designobjects.js carries the full note): photographyGrid is ROUTED, so trail.js
  // already joined it as "r:photography" when show() ran just above -- pushing the same token again here
  // duplicated it, and the grid's own ‹ (one pop) silently redrew this same screen instead of leaving it.
  worldBackWire(el, {}, () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome()));
  el.querySelector("#phChips").onclick = e => {
    const b = e.target.closest("[data-pf]"); if (!b) return;
    const key = b.dataset.pf, v = b.dataset.pv;
    PH_FILTER[key] = key === "decade" ? (v === "" ? null : +v) : v;
    buzz(6); phDraw(el);
  };
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { const n = (PH || []).find(r => r.id === p.dataset.pin); if (n) paintingPage(n); return; }
    const pr = e.target.closest("[data-phr]"); if (pr) { const n = PH_PROCESS_NOTES[pr.dataset.phr]; if (n) phProcessSheet(pr.dataset.phr); return; }
    if (e.target.closest("[data-retry]")) photographyGrid(false);
  });
  loadPhotography().then(() => phDraw(el)).catch(() => {
    const feed = el.querySelector("#phFeed"); if (feed) feed.innerHTML = `<p class="fine">The photographs didn't load. <button class="wl" data-retry>Try again</button></p>`;
  });
}
function phProcessSheet(process) {
  const n = PH_PROCESS_NOTES[process]; if (!n) return;
  sheet(`<div class="gl-sh-top"><b>${esc(process)}</b></div><p class="aw-sub" style="max-width:none">${esc(phProcessNote(process))}</p>`);
}
function phDraw(el) {
  const rows = phFiltered(), { processes, decades, countries, photographers } = phFacets(PH || []);
  const chip = (label, on, attr) => `<button class="art-bubble pulp-chip${on ? " on" : ""}" ${attr}>${esc(label)}</button>`;
  const chips = el.querySelector("#phChips");
  if (chips) {
    chips.innerHTML = [
      chip("All processes", !PH_FILTER.process, 'data-pf="process" data-pv=""'),
      ...processes.map(p => chip(p.replace(/ \(.*\)$/, ""), PH_FILTER.process === p, `data-pf="process" data-pv="${esc(p)}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All decades", PH_FILTER.decade == null, 'data-pf="decade" data-pv=""'),
      ...decades.map(d => chip(d + "s", PH_FILTER.decade === d, `data-pf="decade" data-pv="${d}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("Everywhere", !PH_FILTER.country, 'data-pf="country" data-pv=""'),
      ...countries.map(c => chip(c, PH_FILTER.country === c, `data-pf="country" data-pv="${esc(c)}"`)),
    ].join("") + `<span style="width:10px"></span>` + [
      chip("All photographers", !PH_FILTER.photographer, 'data-pf="photographer" data-pv=""'),
      ...photographers.map(a => chip(a, PH_FILTER.photographer === a, `data-pf="photographer" data-pv="${esc(a)}"`)),
    ].join("");
  }
  const feed = el.querySelector("#phFeed");
  if (!feed) return;
  const notesRow = Object.keys(PH_PROCESS_NOTES).filter(p => rows.some(r => r.process === p)).length > 1 || !PH_FILTER.process ? "" :
    `<button class="aw-link" data-phr="${esc(PH_FILTER.process)}" style="margin:0 0 14px">How ${esc((PH_PROCESS_NOTES[PH_FILTER.process] || {}).short || "this process").toLowerCase()} ${ICON.arrow}</button>`;
  feed.innerHTML = rows.length ? notesRow + masonry(rows.map(n => pin(n))) : `<p class="fine">No photographs match. Try fewer filters.</p>`;
}

// ---------------------------------------------------------------- the photographer page, #/photographer/<slug>
function photographerPage(slug, push = true) {
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <div id="phpBody"><p class="fine">Loading…</p></div>
  `, "article aw-page");
  // David, 2026-10-10 (js/designobjects.js carries the full note): photographerPage is ROUTED, so trail.js
  // already joined it as "r:photographer/<slug>" when show() ran just above -- pushing the same token again
  // here duplicated it.
  const back = () => (typeof xToOrigin === "function" ? xToOrigin() : exploreHome());
  el.querySelector("[data-back]").onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  Promise.all([loadPhotography(), loadPhotographers()]).then(() => phpDraw(el, slug)).catch(() => {
    el.querySelector("#phpBody").innerHTML = `<p class="fine">This photographer's page didn't load.</p>`;
  });
}
function phpStatLine(s) {
  const bits = [];
  if (s.pctDarker >= 62 || s.pctDarker <= 38) bits.push(awBar(1 - s.pctDarker / 100, "Lightness", s.pctDarker >= 50 ? `Darker than ${s.pctDarker}% of the ${s.peers} photographers here` : `Lighter than ${100 - s.pctDarker}% of the ${s.peers} photographers here`));
  if (s.pctDuller >= 62 || s.pctDuller <= 38) bits.push(awBar(1 - s.pctDuller / 100, "Color", s.pctDuller >= 50 ? `Duller than ${s.pctDuller}% of the ${s.peers} photographers here` : `More vivid than ${100 - s.pctDuller}% of the ${s.peers} photographers here`));
  return bits;
}
function phpDraw(el, slug) {
  const s = PH_STATS_BY_SLUG.get(slug);
  const body = el.querySelector("#phpBody");
  if (!s) { body.innerHTML = `<p class="fine">No page yet for this photographer (fewer than 3 surviving photographs in the archive).</p>`; return; }
  const photos = (PH || []).filter(n => n.photographerSlug === slug);
  const typical = photographyNodeById(s.typical), leastTypical = photographyNodeById(s.leastTypical);
  // a handful of photographs carry a date that is really the depicted document's or building's own date, or a
  // restorer's edit timestamp, not when the photograph was taken (research/PHOTOGRAPHY.md); trimmed to the
  // middle 80% so one such outlier at either end can't stretch a working life into "1711-2022"
  const allYears = photos.map(n => n.year).filter(Boolean).sort((a, b) => a - b);
  const lo = Math.floor(allYears.length * 0.1), hi = Math.ceil(allYears.length * 0.9) - 1;
  const years = allYears.length > 4 ? allYears.slice(lo, hi + 1) : allYears;
  const span = years.length ? (years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`) : "";
  const procs = s.processes.map(([p, k]) => `${p.replace(/ \(.*\)$/, "")} (${k})`).join(", ");
  const bars = phpStatLine(s);
  const stat = bars.length ? `<div class="aw-pbars">${bars.join("")}</div>` : `<p class="aw-sub">Too close to the middle of the ${s.peers} photographers here to call a finding.</p>`;
  const notableProcess = s.processes[0] && s.processes[0][1] / s.n >= 0.8 ? s.processes[0][0] : null;
  body.innerHTML = `
    <div class="aw-head"><div><p class="eyebrow p-type">Photographer</p><h1 class="p-title">${esc(s.name)}</h1><p class="p-dek">${esc(span)}${span && procs ? " · " : ""}${esc(procs)}</p></div></div>
    ${typical ? `<section class="aw-hl">
      <button class="aw-hl-img" data-open-typical style="--c:${esc((typical.palette[0] || {}).h || "#222")};aspect-ratio:${typical.w && typical.h ? (typical.w / typical.h).toFixed(4) : 1}" aria-label="Open the most typical photograph"><img src="${esc(typical.img)}" alt="" loading="lazy"></button>
      <p class="aw-hl-cap"><em>Most typical</em><span>${esc(typical.title)}${typical.year ? ", " + typical.year : ""}</span></p>
      <div class="aw-hl-h"><b>A typical palette</b><span>closest to this photographer's own average</span></div>
      <div class="aw-hl-chips">${(typical.palette || []).slice(0, 5).map(c => `<button class="aw-hl-chip" data-swatch="${c.h}"><i style="--c:${c.h}"></i><b>${esc(c.name)}</b></button>`).join("")}</div>
    </section>` : ""}
    <div class="sec-head"><b>Measured</b><span>${s.n} surviving photographs</span></div>
    ${stat}
    ${notableProcess ? `<p class="aw-sub">Almost all of ${esc(s.name)}'s work here is ${esc(notableProcess)}. <button class="aw-link" data-phr="${esc(notableProcess)}">How that process shapes color ${ICON.arrow}</button></p>` : ""}
    <div class="sec-head"><b>Many palettes</b><span>${photos.length} photographs</span></div>
    <div id="phpGrid"></div>
    ${leastTypical && leastTypical.id !== (typical || {}).id ? `<div class="sec-head"><b>Least typical</b><span>furthest from the average</span></div>
      <div class="ph-single">${pin(leastTypical).html}</div>` : ""}
    <section class="srcs"><h3>Sources</h3><ul><li>Colors measured by ColorHub from Wikimedia Commons' own scans (${s.n} photographs by ${esc(s.name)} in the archive); every figure is as scanned, screen color only.</li></ul></section>
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "photographer:" + slug, title: s.name }) : ""}
  `;
  const grid = body.querySelector("#phpGrid"); if (grid) grid.innerHTML = masonry(photos.map(n => pin(n)));
  body.addEventListener("click", e => {
    const t = e.target.closest("[data-open-typical]"); if (t && typical) return paintingPage(typical);
    const p = e.target.closest("[data-pin]"); if (p) { const n = photographyNodeById(p.dataset.pin); if (n) paintingPage(n); return; }
    const pr = e.target.closest("[data-phr]"); if (pr) return phProcessSheet(pr.dataset.phr);
  });
  if (typeof wireLinks === "function") wireLinks(body);
}
