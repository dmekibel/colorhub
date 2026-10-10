"use strict";
// The painting map (David, 2026-10-08: "visualize multiple paintings by placing them next to each other, like we did
// with colors… as you pan, the one in the middle gets expanded, like the color map").
//
// Thousands of painting thumbnails on one pannable, pinchable canvas, seen through the color map's lens (js/honey.js):
// the painting in the middle is big and shows its whole picture at its own shape; the rest are square crops that
// shrink smoothly toward the edges. A tap on the middle one opens its page; a tap elsewhere glides it to the middle.
//
// Arrangements (what position means, always said in one line under the title):
//   color    lighter toward the top, hues left to right (columns of hue, light to dark inside), then a local pass that
//            swaps neighbors whenever that makes the two look more alike (mean and dominant color, CIELAB)
//   time     oldest at the top, one band per decade (centuries before 1500), lighter first inside a band
//   painter  one block per painter, the earliest painters first; inside a block, by date
//   similar  one painting in the middle; the rest spiral out by how close their colors are (js/gallery.js glSimilar's
//            matched-palette distance for the nearest 400, the average-color distance for the rest)
// Filters are this file's own pmRun() -- color (multi, any/all, hue family, lightness), a year range (presets +
// a decade histogram), multi-select country/region, movement, museum and painter -- plus "your favorites"
// (js/favs.js S.favArt), with live per-value counts. AND across facets, OR within one. The address carries all
// of it: #/paintings/map?arr=time&co=France,Italy&region=europe&y0=1850&y1=1900&hb=6
//
// Speed: one canvas; per frame only the cells inside the lens radius are visited (the layout is a dense grid, so
// that's a rectangle of lookups, never a pass over every painting). Thumbnails load only for tiles on screen and big
// enough to read, nearest the middle first, ten at a time; each is baked once into a small square canvas (frame
// cropped away, js/gallery.js glCropStyle's crop), and a bounded LRU recycles them. Until its picture lands, a tile
// is its painting's own dominant color, so the map reads as color from the first frame. Image addresses come from
// data/gallery/thumbs.txt (tools/paintmap_thumbs.py), not the 11 MB of detail shards.

// David, 2026-10-09: "the paintings view is missing the arrangement options the color view has" -- Rings and
// Spiral are both "around one painting" (they need a seed, same as the old "similar" did), split into two
// distinct reads of the same underlying similarity order (pmSimilarOrder): Rings is clean concentric square
// shells (nearer = a tighter ring); Spiral is a continuous golden-angle sweep (phyllotaxis, the sunflower-seed
// pattern) with no seams between ranks, so a painting just past one "ring" and one just before the next sit
// beside each other instead of in separate bands. Families groups by movement (pmLayGroup, the same shelf-
// packing as By painter, just grouped by F.mv instead of F.artist); Tones buckets by mood (Vivid/Light/Muted/
// Dark, the same honeyToneGroup split honey.js's own Tones shape uses) under whichever "Place by" color the
// painting's own position already comes from.
const PM_ARR = [["color", "By color"], ["time", "By time"], ["painter", "By painter"], ["families", "Families"], ["tones", "Tones"], ["rings", "Rings"], ["spiral", "Spiral"]];
const PM_NEEDS_SEED = new Set(["rings", "spiral"]);
const PM_WHY = {
  color: "Lighter toward the top, hues left to right",
  time: "Oldest at the top, a band for each decade",
  painter: "A block for each painter, earliest first",
  families: "A block for each movement, the biggest first",
  tones: "An island per mood: vivid, light, muted, dark",
  rings: "Concentric rings: the nearer the middle, the closer the colors",
  spiral: "A continuous spiral, nearest first, no seams between rings",
};
// David, 2026-10-09: "Place by" -- which of a painting's own colors decides WHERE it sits, for the two
// arrangements position actually comes from a color (color, time). The default (and the only option before this)
// was always the true pixel-weighted mean across the whole canvas; "Main color" instead uses the single biggest
// swatch of its 6-color palette (pmDom, same swatch a painting's own dominant-color tile uses before its picture
// loads), and "Standout" uses the most saturated of the 6 -- the one that would catch your eye in the frame, even
// if it's a small accent. Only meaningful where a painting's OWN color decides its position; "painter" (grouped
// by artist, ordered by date) and "similar" (whole-palette matching, already finer-grained than any one swatch)
// are unaffected and ignore it.
const PM_PLACE = [["avg", "Average"], ["main", "Main color"], ["standout", "Standout"]];
// David, 2026-10-10: every call here takes F now (js/paintmap-collections.js's dataset abstraction) -- F.G is
// GAL itself when the map is showing Paintings (the default, byte-for-byte what this used to hardcode), or an
// adapter's own GAL-shaped arrays when it's showing another collection (Design objects, Photography). Nothing
// about the paintings math changed; it just reads through F.G instead of the bare global.
function pmPlaceLab(i, place, F) {
  const G = (F && F.G) || GAL;
  if (!place || place === "avg") return [G.mean[i * 3], G.mean[i * 3 + 1], G.mean[i * 3 + 2]];
  const j = place === "main" ? pmDom(i, F) : (() => { let b = 0, bc = -1; for (let t = 0; t < 6; t++) { const c = G.ch[i * 6 + t]; if (c > bc) { bc = c; b = t; } } return b; })();
  const o = (i * 6 + j) * 3;
  return [G.lab[o], G.lab[o + 1], G.lab[o + 2]];
}
// David, 2026-10-09: "Center on" -- a quick way to land the (otherwise generic) "around one painting" arrangement
// on a painting chosen by some property of the CURRENT filtered list, not by having already found one yourself.
// Each returns a gallery index (or -1 if the list is empty / has no favorite in it). 2026-10-10: takes F now too.
const PM_CENTER = [
  ["vivid", "Most vivid", (list, F) => { const G = (F && F.G) || GAL; let b = -1, bv = -1; for (const i of list) if (G.C[i] > bv) { bv = G.C[i]; b = i; } return b; }],
  ["grey", "Greyest", (list, F) => { const G = (F && F.G) || GAL; let b = -1, bv = 1e9; for (const i of list) if (G.C[i] < bv) { bv = G.C[i]; b = i; } return b; }],
  ["light", "Lightest", (list, F) => { const G = (F && F.G) || GAL; let b = -1, bv = -1; for (const i of list) if (G.mean[i * 3] > bv) { bv = G.mean[i * 3]; b = i; } return b; }],
  ["dark", "Darkest", (list, F) => { const G = (F && F.G) || GAL; let b = -1, bv = 1e9; for (const i of list) if (G.mean[i * 3] < bv) { bv = G.mean[i * 3]; b = i; } return b; }],
  ["fav", "A favorite", (list, F) => { const ids = pmFavList(F); if (!ids.length) return -1; const want = new Set(ids.map(r => r.i)); for (const i of list) if (want.has(i)) return i; return -1; }],
];
const PM_ICON = {
  color: sv('<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="8" r="3.2"/><circle cx="12" cy="15.5" r="3.2"/>', 22, 1.7),
  time: sv('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4M14 10v4M10 16v4"/>', 22, 1.7),
  painter: sv('<rect x="3.5" y="4" width="7" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="4" rx="1.2"/><rect x="13.5" y="11" width="7" height="9" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/>', 22, 1.7),
  families: sv('<circle cx="7" cy="7" r="3.4"/><circle cx="16.5" cy="6.5" r="2.4"/><circle cx="7" cy="16.5" r="2.4"/><circle cx="17" cy="16" r="3"/>', 22, 1.7),
  tones: sv('<circle cx="7" cy="7" r="3.6"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="3.6"/>', 22, 1.7),
  rings: sv('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2.5 3"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="1.5 2.5"/>', 22, 1.6),
  spiral: sv('<path d="M12 12c0-1.2 1-2 2.2-2 1.8 0 3.3 1.6 3.3 3.5 0 2.6-2.2 4.8-4.8 4.8-3.3 0-6-2.8-6-6.1C6.7 7.7 10 4.6 14 4.6" stroke-linecap="round"/>', 22, 1.7),
  arrange: sv('<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 22, 1.6),
  filter: sv('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>', 22, 1.6),
  down: sv('<path d="M7 10l5 5 5-5"/>', 14, 2),
  // the "Colors" row back to the honeycomb (David, 2026-10-09): a small cluster of named bubbles
  colorsMode: sv('<circle cx="7" cy="8" r="3.4"/><circle cx="16" cy="7" r="2.6"/><circle cx="8.5" cy="16" r="2.8"/><circle cx="16.5" cy="15.5" r="2"/>', 22, 1.6),
  // the time scrubber's own Play/Pause (David, 2026-10-09): ICON.play (js/core.js) is the app-wide one; Pause doesn't exist yet elsewhere, so it's local here
  pause: sv('<path d="M9 5v14M15 5v14"/>', 20, 2.2),
};
// generic favorites across the keep store: paintings keep fvArtList() (keyed by gallery index i) unchanged;
// every other collection keeps fvItemList() filtered to its own kind (js/favs.js's generic id-keyed store) and
// is mapped to the SAME { i, ... } shape fvArtList() returns, so every caller above (favSet in draw(), the Filter
// sheet's "Yours" chip, Center on "A favorite") stays written once and works for any collection.
function pmFavList(F) {
  if (!F || !F.col || F.col === "paintings") return typeof fvArtList === "function" ? fvArtList() : [];
  return typeof fvItemList === "function" ? fvItemList(F.col).map(r => ({ ...r, i: F.ixOf ? F.ixOf(r.id) : -1 })).filter(r => r.i >= 0) : [];
}
const pmFavHas = (id, F) => (!F || !F.col || F.col === "paintings") ? (typeof fvArtHas === "function" && fvArtHas(id)) : (typeof fvItemHas === "function" && fvItemHas(id));
const pmFavSet = (i, d, on, F) => { if (!F || !F.col || F.col === "paintings") { if (typeof fvArtSet === "function") fvArtSet(i, d, on); } else if (typeof fvItemSet === "function") fvItemSet(F.col, d, on); };
// the bottom card's "d" (a detail row): paintings alone go through glDetailNow/glDetail's own lazy shard fetch
// (unchanged); every other collection is already whole in memory the instant F exists, so this just reshapes
// the node it already has into the same { id, t, a, co, img, crop } shape glDetailNow returns.
function pmDetailNow(i, F) {
  if (!F || !F.col || F.col === "paintings") return glDetailNow(i);
  const n = F.nodes && F.nodes[i]; if (!n) return null;
  return { id: n.id, t: n.title || "", a: n.artist || "", co: n.place || n.country || "", img: n.img || "", crop: null };
}
// the year as glYear(i) formats it ("1877", "480 BCE", "" for undated) -- for any collection, via its own F.G.
function pmYearStr(i, F) {
  if (!F || !F.col || F.col === "paintings") return glYear(i);
  const G = F.G, y = G.year[i];
  return y === GL_UNDATED ? "" : y < 0 ? `${-y} BCE` : String(y);
}
let PM_THUMBS = null, PM_THUMBS_P = null;
const PM_PAN = new Map();     // layout key -> { x, y, s }: where you were, so Back from a painting lands on it again
const PM_LAYOUTS = new Map(); // layout key -> layout (the color pass costs ~100 ms on 24,000 paintings: once is enough)
// David, 2026-10-09: "always-labeled landmark paintings" -- gallery indices from EVERY painter's own `famous`
// list (data/artists/portraits.json, tools/artwiki_portraits.py's Wikidata-reach signal, already built and
// already used for painter-page portraits/js/richcolor.js rcLoadPortraits -- the same definition of "famous"
// the rest of the app uses, not a new one invented here). Labeled by painter name (already in hand synchronously
// via F.artist, no extra fetch per cell) at a far lower size threshold than any other on-map text gets.
let PM_LANDMARKS = new Set();
// David, 2026-10-09: landmarks default OFF now ("make it less overwhelming") -- a "More options" toggle, not a
// forced-on overlay. The capability (and its collision-avoided, sans-font rendering, fixed earlier) stays.
let PM_LANDMARKS_ON = false;

// ---------- data ----------
// Paintings only: data/gallery/thumbs.txt, one line per gallery index. Another collection's own thumb URL is
// already sitting on its node (n.img, loaded whole by loadDesignObjects()/loadPhotography()) -- pmThumb() below
// branches on the active collection instead of fetching a second thumbs file for it.
function pmThumbsLoad(col) {
  if (col && col !== "paintings") return Promise.resolve(null);
  if (PM_THUMBS) return Promise.resolve(PM_THUMBS);
  const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  return PM_THUMBS_P || (PM_THUMBS_P = fetch("data/gallery/thumbs.txt" + v).then(r => { if (!r.ok) throw new Error("thumbs " + r.status); return r.text(); })
    .then(t => (PM_THUMBS = t.split("\n"))).catch(e => { PM_THUMBS_P = null; throw e; }));
}
// a tile's picture address, and its frame crop ([l, t, r, b] in thousandths of the photo) or null
function pmThumb(i, F) {
  if (F && F.col && F.col !== "paintings") {
    const n = F.nodes && F.nodes[i];
    return n && n.img ? { url: n.img, crop: null } : null;
  }
  const line = PM_THUMBS && PM_THUMBS[i]; if (!line) return null;
  const tab = line.indexOf("\t"), c = line.slice(0, tab < 0 ? undefined : tab), cr = tab < 0 ? "" : line.slice(tab + 1);
  const k = c[0], a = c.slice(1);
  const url = k === "L" ? "img/gallery/" + a : k === "C" ? `https://commons.wikimedia.org/wiki/Special:FilePath/${a}?width=400`
    : k === "M" ? `https://iiif.micr.io/${a}/full/400,/0/default.jpg` : k === "N" ? `https://api.nga.gov/iiif/${a}/full/400,/0/default.jpg`
    : k === "V" ? "https://openaccess-cdn.clevelandart.org/" + a : k === "E" ? "https://images.metmuseum.org/CRDImages/" + a : a;
  const crop = cr ? cr.split(",").map(Number) : null;
  return { url, crop: crop && crop.length === 4 ? crop : null };
}
const pmDom = (i, F) => { const G = (F && F.G) || GAL; let b = 0; for (let j = 1; j < 6; j++) if (G.sh[i * 6 + j] > G.sh[i * 6 + b]) b = j; return b; };
// a cell's own hex (the dominant swatch): paintings go through glHex (GAL's Lab -> hex, unchanged); every other
// collection already carries its swatches as real hex strings (js/designobjects.js doNode / js/photography.js
// photographyNode's .palette), so this reads the hex straight off the node instead of a lossy Lab round-trip.
const pmHex = (i, F) => {
  if (F && F.col && F.col !== "paintings") { const n = F.nodes && F.nodes[i], p = n && n.palette && n.palette[pmDom(i, F)]; return (p && p.h) || "#3A3630"; }
  return glHex(i, pmDom(i, F));
};

// ---------- the richer filter (David, 2026-10-10: "select multiple things -- a color range, a time range,
// multiple countries, or e.g. only Europe") ----------
// js/browse.js's xbFresh()/xbRun() are Explore's own filter (single-value painter/mv/co/mus, "closest of any
// hex") and are shared with js/browse-ui.js's whole screen -- widening THEIR shape to arrays would ripple
// through every chip/button there that reads f.co etc as one number. So paintmap keeps f's EXISTING fields at
// their "off" default (0 / -1) and adds its own array-shaped fields beside them for multi-select; pmRun() below
// (not xbRun) is paintmap's own single-pass query, AND across every facet below, OR within each one -- the
// legacy singles still work for any old link/caller (pmParse seeds a Set from them when nothing richer was
// given, so a painting page's existing data-pmap="arr=color&p=<slug>" keeps working unchanged).
//   coSet      country indices (1-based into F.meta.countries, xbFresh's own convention) -- OR'd with every
//              country inside f.region, if one is set (a region chip is a bulk toggle INTO this same set, not
//              a separate dimension -- see pmRegionToggle())
//   region     the last region chip tapped, purely so pmActiveChips() can show "Europe" instead of 20 country
//              names; matching itself only ever looks at coSet (already unioned in when the chip was tapped)
//   painterSet/mvSet/musSet   multi-select, same OR-within-facet idea, for Painter/Movement/Museum
//   colorMode  "any" (default: a painting counts if it's close to ANY picked hex) or "all" (close to EVERY one)
//   hueBand    one of XB_FAMS's 9 family indices (0=Reds..8=Greys), matched against a painting's DOMINANT swatch
//   l0/l1      a mean-lightness range (0-100, dark<->light), independent of any hex pick
const pmFilterFresh = () => ({ ...xbFresh(), coSet: [], region: null, painterSet: [], mvSet: [], musSet: [], colorMode: "any", hueBand: null, l0: null, l1: null });
// Western Europe / Northern Europe / Italy & Spain are deliberately tighter than "Europe" (which is every
// European country in the dataset) -- each is its own bulk-select, not a strict partition of the broad one.
const PM_REGIONS = [
  ["europe", "Europe", ["Austria", "Belgium", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Netherlands", "Norway", "Poland", "Portugal", "Russia", "Spain", "Sweden", "Switzerland", "United Kingdom"]],
  ["westEurope", "Western Europe", ["France", "Germany", "Belgium", "Netherlands", "Switzerland", "Austria", "United Kingdom", "Ireland"]],
  ["northEurope", "Northern Europe", ["Denmark", "Norway", "Sweden", "Finland", "Estonia"]],
  ["italySpain", "Italy & Spain", ["Italy", "Spain"]],
  ["americas", "Americas", ["Brazil", "Canada", "Cuba", "Guatemala", "Mexico", "Peru", "United States"]],
  ["eastAsia", "East Asia", ["China", "Japan", "Korea", "Mongolia", "Tibet"]],
  ["southAsia", "South Asia", ["India", "Nepal", "Pakistan", "Sri Lanka", "Afghanistan"]],
  ["middleEast", "Middle East", ["Egypt", "Iran", "Turkey", "Uzbekistan"]],
];
function pmRegionCountries(key, F) {
  const r = PM_REGIONS.find(x => x[0] === key); if (!r) return [];
  return r[2].map(name => F.meta.countries.indexOf(name) + 1).filter(v => v > 0);
}
// Renaissance/Baroque/1800s/Modern (David, 2026-10-10's own examples) -- the four quick presets for the Time
// range. Loosely art-historical, not a strict textbook split (this dataset spans far more than Western art).
const PM_TIME_PRESETS = [["ren", "Renaissance", 1400, 1600], ["baroque", "Baroque", 1600, 1750], ["1800s", "1800s", 1800, 1899], ["modern", "Modern", 1860, 1970]];
// a painting's own dominant-swatch hue family (reuses XB_FAMS/xbFamOf's 9-way split, the same one Explore's
// color chips already classify every painting by -- no new taxonomy, same "blues" a user already knows)
const pmHueBandOf = (i, F) => F.fam[i * 6 + F.dom[i]];
// per-hex, per-painting nearest ΔE2000 across its 6 swatches -- cached per hex (not per hex-LIST, unlike
// js/browse.js's xbDE) because colorMode "all" needs each hex's OWN distance, not just the nearest-of-any
let PM_DE1 = new Map();
function pmDE1(F, hex) {
  let e = PM_DE1.get(hex); if (e && e.N === F.N) return e.de;
  if (PM_DE1.size > 24) PM_DE1.clear();   // a session never picks more than a handful of distinct hexes at once
  const G = F.G, M = F.N * 6, de = new Float32Array(M).fill(1e3), Lb = G.lab, [tL, ta, tb] = lab(hex);
  for (let m = 0; m < M; m++) { const o = m * 3, dL = Lb[o] - tL; if (dL > 28 || dL < -28) continue; const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]); if (d < de[m]) de[m] = d; }
  e = { N: F.N, de }; PM_DE1.set(hex, e); return de;
}
// the one query pass: AND across facets, OR within one (every *Set is OR'd internally, then every facet ANDs
// with every other) -- same bitmask-exclusion trick js/browse.js's xbRun uses for live per-value counts, just
// extended to multi-select dims and the two new ones (hue band, lightness)
function pmRun(s, F) {
  const f = s.f, G = F.G, N = F.N;
  const coSet = f.coSet && f.coSet.length ? new Set(f.coSet) : (f.co ? new Set([f.co]) : null);
  const painterSet = f.painterSet && f.painterSet.length ? new Set(f.painterSet) : (f.painter ? new Set([f.painter]) : null);
  const mvSet = f.mvSet && f.mvSet.length ? new Set(f.mvSet) : (f.mv ? new Set([f.mv]) : null);
  const musSet = f.musSet && f.musSet.length ? new Set(f.musSet) : (f.mus >= 0 ? new Set([f.mus]) : null);
  const hasHex = f.hexes && f.hexes.length, mode = f.colorMode || "any";
  const perHex = hasHex ? f.hexes.map(h => pmDE1(F, h)) : null;
  const tol = f.tol;
  const when = f.y0 != null || f.y1 != null, y0 = f.y0 == null ? -1e5 : f.y0, y1 = f.y1 == null ? 1e5 : f.y1;
  const hasL = f.l0 != null || f.l1 != null, l0 = f.l0 == null ? -1e5 : f.l0, l1 = f.l1 == null ? 1e5 : f.l1;
  const counts = { when: new Int32Array(XB_NDEC + 1), painter: new Int32Array(F.meta.artists.length + 1), mv: new Int32Array(F.meta.movements.length + 1), co: new Int32Array(F.meta.countries.length + 1),
    mus: new Int32Array(G.src.length), hueBand: new Int32Array(9), color: 0, lightness: 0 };
  const out = new Int32Array(N); let n = 0;
  for (let i = 0; i < N; i++) {
    let fail = 0;
    if (hasHex) {
      let ok;
      if (mode === "all") { ok = true; for (const de of perHex) { let near = 1e3; for (let j = 0; j < 6; j++) { const d = de[i * 6 + j]; if (d < near) near = d; } if (near > tol) { ok = false; break; } } }
      else { let near = 1e3; for (const de of perHex) for (let j = 0; j < 6; j++) { const d = de[i * 6 + j]; if (d < near) near = d; } ok = near <= tol; }
      if (!ok) fail |= 1;
    }
    if (when) { const y = G.year[i]; if (y === GL_UNDATED || y < y0 || y > y1) fail |= 2; }
    if (painterSet && !painterSet.has(F.artist[i])) fail |= 4;
    if (mvSet && !mvSet.has(F.mv[i])) fail |= 8;
    if (coSet && !coSet.has(F.country[i])) fail |= 16;
    if (musSet && !musSet.has(G.mus[i])) fail |= 32;
    if (f.hueBand != null && pmHueBandOf(i, F) !== f.hueBand) fail |= 64;
    if (hasL) { const L = G.mean[i * 3]; if (L < l0 || L > l1) fail |= 128; }
    if (fail === 0) out[n++] = i;
    else if (fail & (fail - 1)) continue;
    if (!(fail & ~1)) counts.color++;
    if (!(fail & ~2)) { const d = F.dec[i]; counts.when[d < 0 ? XB_NDEC : d]++; }
    if (!(fail & ~4)) counts.painter[F.artist[i]]++;
    if (!(fail & ~8)) counts.mv[F.mv[i]]++;
    if (!(fail & ~16)) counts.co[F.country[i]]++;
    if (!(fail & ~32)) counts.mus[G.mus[i]]++;
    if (!(fail & ~64)) counts.hueBand[pmHueBandOf(i, F)]++;
    if (!(fail & ~128)) counts.lightness++;
  }
  return { list: out.slice(0, n), counts };
}

// ---------- the spec: what to show and how (the address's query) ----------
const pmFresh = () => ({ arr: "color", f: pmFilterFresh(), seed: -1, fav: 0, place: "avg", upToYear: null, mag: null, col: "paintings" });
// David, 2026-10-09: "a time scrubber with play (paintings appear decade by decade)" -- the dataset's own real
// year span (excluding undated), computed once and cached. The scrubber's slider runs across this, not a guess.
let PM_YEAR_RANGE = null;
const PM_COL_YEAR_RANGE = new Map();   // F.col (non-paintings) -> [lo, hi], cached the same way as PM_YEAR_RANGE
function pmYearRange(F) {
  const G = (F && F.G) || GAL, col = (F && F.col) || "paintings";
  if (col === "paintings" && PM_YEAR_RANGE) return PM_YEAR_RANGE;
  if (col !== "paintings" && PM_COL_YEAR_RANGE.has(col)) return PM_COL_YEAR_RANGE.get(col);
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < G.n; i++) { const y = G.year[i]; if (y === GL_UNDATED) continue; if (y < lo) lo = y; if (y > hi) hi = y; }
  if (lo > hi) { lo = 1900; hi = 1900; }   // a collection with no dated items at all (shouldn't happen, but pmYearRange must still return something finite)
  const range = [lo, hi];
  if (col === "paintings") PM_YEAR_RANGE = range; else PM_COL_YEAR_RANGE.set(col, range);
  return range;
}
function pmParse(q, F) {
  const s = pmFresh(), p = new URLSearchParams(String(q || "").replace(/^\?/, ""));
  s.col = (F && F.col) || "paintings";
  const a = p.get("arr"); if (PM_ARR.some(x => x[0] === a)) s.arr = a;
  const pl = p.get("pl"); if (PM_PLACE.some(x => x[0] === pl)) s.place = pl;
  const f = s.f, num = k => { const v = p.get(k); return v != null && v !== "" && isFinite(+v) ? +v : null; };
  const uy = num("uy"); if (uy != null) s.upToYear = uy;
  const mg = num("mag"); if (mg != null) s.mag = clamp(mg, 0, 1);
  if (p.get("c")) { f.hexes = p.get("c").split(",").filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => "#" + h.toUpperCase()); f.name = f.hexes.length === 1 ? nameOf(f.hexes[0]).text : ""; f.tol = num("t") || 8; f.cover = num("m") != null ? num("m") : 2; }
  if (p.get("cm") === "all") f.colorMode = "all";
  f.y0 = num("y0"); f.y1 = num("y1");
  const hb = num("hb"); if (hb != null && hb >= 0 && hb < 9) f.hueBand = hb;
  const l0 = num("l0"), l1 = num("l1"); if (l0 != null) f.l0 = l0; if (l1 != null) f.l1 = l1;
  const ix = (list, v) => v ? list.findIndex(x => routeSlug(x) === routeSlug(v)) + 1 : 0;
  const ixSet = (list, csv) => csv ? csv.split(",").map(v => ix(list, v)).filter(v => v > 0) : [];
  if (p.get("p")) f.painterSet = p.get("p").split(",").map(sl => F.slugIx.get(sl) || 0).filter(v => v > 0);
  f.coSet = ixSet(F.meta.countries, p.get("co")); f.mvSet = ixSet(F.meta.movements, p.get("mv"));
  const rg = p.get("region"); if (rg && PM_REGIONS.some(r => r[0] === rg)) { f.region = rg; pmRegionCountries(rg, F).forEach(v => { if (!f.coSet.includes(v)) f.coSet.push(v); }); }
  if (p.get("mus")) f.musSet = p.get("mus").split(",").map(k => F.G.src.findIndex(x => x.k === k)).filter(v => v >= 0);
  const sd = num("seed"); if (sd != null && sd >= 0 && sd < F.N) s.seed = sd;
  if (p.get("fav") === "1") s.fav = 1;
  if (PM_NEEDS_SEED.has(s.arr) && s.seed < 0) s.arr = "color";
  return s;
}
function pmQS(s, F) {
  const f = s.f, out = [["arr", s.arr]];
  const col = s.col || (F && F.col) || "paintings"; if (col !== "paintings") out.push(["col", col]);
  if (s.place && s.place !== "avg") out.push(["pl", s.place]);
  if (f.hexes.length) { out.push(["c", f.hexes.map(h => h.slice(1).toLowerCase()).join(",")], ["t", f.tol], ["m", f.cover]); if (f.hexes.length > 1 && f.colorMode === "all") out.push(["cm", "all"]); }
  if (f.y0 != null) out.push(["y0", f.y0]); if (f.y1 != null) out.push(["y1", f.y1]);
  if (f.hueBand != null) out.push(["hb", f.hueBand]);
  if (f.l0 != null) out.push(["l0", f.l0]); if (f.l1 != null) out.push(["l1", f.l1]);
  if (f.painterSet && f.painterSet.length && F) out.push(["p", f.painterSet.map(v => F.meta.artists[v - 1][1]).join(",")]);
  if (f.region) out.push(["region", f.region]);
  const extraCo = f.region ? (f.coSet || []).filter(v => !pmRegionCountries(f.region, F).includes(v)) : (f.coSet || []);
  if (extraCo.length && F) out.push(["co", extraCo.map(v => F.meta.countries[v - 1]).join(",")]);
  if (f.mvSet && f.mvSet.length && F) out.push(["mv", f.mvSet.map(v => F.meta.movements[v - 1]).join(",")]);
  if (f.musSet && f.musSet.length && F) out.push(["mus", f.musSet.map(v => F.G.src[v].k).join(",")]);
  if (PM_NEEDS_SEED.has(s.arr) && s.seed >= 0) out.push(["seed", s.seed]);
  if (s.fav) out.push(["fav", 1]);
  if (s.upToYear != null) out.push(["uy", s.upToYear]);
  if (s.mag != null) out.push(["mag", s.mag]);
  return out.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
}
// router.js ROUTED: the address and title of an open map. F is optional (the two live call sites inside
// pmMount -- the one engine every collection shares -- always pass their own already-loaded F); without it
// (router.js's cold routeWrapAll wrap, which only ever sees whatever args a caller passed pmOpen), this falls
// back to XBF for Paintings and to PM_COL_F_READY's synchronously-cached adapter for another collection, same
// idea as XBF but already resolved by the time a map is open enough to call this.
function pmRouteOf(spec, F) {
  const col = (typeof spec === "string" ? new URLSearchParams(spec.replace(/^\?/, "")).get("col") : spec && spec.col) || (F && F.col) || "paintings";
  if (!F) F = col === "paintings" ? XBF : PM_COL_F_READY.get(col);
  const q = typeof spec === "string" ? spec.replace(/^\?/, "") : F ? pmQS(spec, F) : (col !== "paintings" ? "col=" + encodeURIComponent(col) : "");
  const title = (PM_COLLECTIONS.find(c => c[0] === col) || PM_COLLECTIONS[0])[1];
  return { path: "paintings/map" + (q ? "?" + q : ""), title: col === "paintings" ? "Painting map" : title + " map" };
}
// a region chip toggles ALL its countries into or out of coSet at once (David, 2026-10-10: "region groups that
// select many at once") -- "on" if every one of them is already in, "off" (remove all of them) otherwise, so
// re-tapping an active region cleanly undoes it rather than just adding duplicates.
function pmRegionToggle(f, key, F) {
  const countries = pmRegionCountries(key, F), set = new Set(f.coSet || []);
  const allIn = countries.length > 0 && countries.every(v => set.has(v));
  if (allIn) { countries.forEach(v => set.delete(v)); f.region = f.region === key ? null : f.region; }
  else { countries.forEach(v => set.add(v)); f.region = key; }
  f.coSet = [...set];
}
const XB_HUE_WORDS = XB_FAMS;   // "Reds".."Greys" (js/browse.js) -- the same 9-way split a user already knows
// the filters in words: "France · 1880s · Monet"
function pmWords(s, F) {
  const c = pmActiveChips(s, F).map(x => x.text);
  return c;
}
// the active filters as removable chips (David, 2026-10-09: filter-by-example's companion; 2026-10-10: now one
// COMPACT chip per facet even when it holds several values -- "Europe" rather than 20 country names, "3
// painters" rather than 3 chips -- so "Europe · 1850-1900 · Blues ×" stays readable). dim here names the
// FACET (place/when/color/painter/mv/mus/fav), not one value inside it; clearing a chip clears the whole facet.
function pmActiveChips(s, F) {
  const f = s.f, c = [];
  if (s.fav) c.push({ dim: "fav", text: "Your favorites" });
  if (f.coSet && f.coSet.length) {
    const region = PM_REGIONS.find(r => r[0] === f.region);
    const exact = region && pmRegionCountries(f.region, F).length === f.coSet.length && pmRegionCountries(f.region, F).every(v => f.coSet.includes(v));
    const names = f.coSet.map(v => F.meta.countries[v - 1]);
    c.push({ dim: "co", text: exact ? region[1] : names.length === 1 ? names[0] : names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1}` });
  }
  if (f.y0 != null || f.y1 != null) {
    const preset = PM_TIME_PRESETS.find(p => p[2] === f.y0 && p[3] === f.y1);
    c.push({ dim: "when", text: preset ? preset[1] : `${f.y0 != null ? f.y0 : "…"}–${f.y1 != null ? f.y1 : "…"}` });
  }
  if (f.hexes.length) {
    const names = f.hexes.map(h => nameOf(h).text);
    c.push({ dim: "color", text: names.length === 1 ? names[0] : `${names.length} colors (${f.colorMode === "all" ? "all" : "any"})` });
  }
  if (f.hueBand != null) c.push({ dim: "hueBand", text: XB_HUE_WORDS[f.hueBand] });
  if (f.l0 != null || f.l1 != null) c.push({ dim: "l", text: f.l0 != null && f.l1 != null ? `L ${f.l0}–${f.l1}` : f.l0 != null ? `Lighter than ${f.l0}` : `Darker than ${f.l1}` });
  if (f.painterSet && f.painterSet.length) c.push({ dim: "painter", text: f.painterSet.length === 1 ? xbArtistName(F, f.painterSet[0]) : `${f.painterSet.length} painters` });
  if (f.mvSet && f.mvSet.length) c.push({ dim: "mv", text: f.mvSet.length === 1 ? F.meta.movements[f.mvSet[0] - 1] : `${f.mvSet.length} movements` });
  if (f.musSet && f.musSet.length) c.push({ dim: "mus", text: f.musSet.length === 1 ? F.G.src[f.musSet[0]].short : `${f.musSet.length} museums` });
  return c;
}
// the card's own three facets (David, 2026-10-09, the minimalist pass -- "filtering by example" stays, pared to
// the card's own 3-chip budget): Same painter / Same decade / Same place, only the ones that actually apply.
// Movement, museum and color-swatch filters still exist -- in the sheet's Filter group (More options), not here.
function pmFacetsOf(i, F) {
  const out = [];
  if (F.artist[i]) out.push({ dim: "painter", val: F.artist[i], label: "Same " + pmColLabel(F, "painter").toLowerCase() });
  const y = F.G.year[i];
  if (y !== GL_UNDATED) {
    const y0 = y < 1500 ? Math.floor(y / 100) * 100 : Math.floor(y / 10) * 10, y1 = y < 1500 ? y0 + 99 : y0 + 9;
    out.push({ dim: "when", val: [y0, y1], label: "Same decade" });
  }
  if (F.country[i]) out.push({ dim: "co", val: F.country[i], label: "Same " + pmColLabel(F, "co").toLowerCase() });
  return out;
}
// apply one facet to the filter spec in place -- a quick "narrow to exactly this" (so it REPLACES the facet's
// whole set, the one place in this file multi-select is deliberately overridden rather than added to)
function pmFacetApply(f, dim, val) {
  if (dim === "painter") { f.painterSet = [val]; f.painter = 0; }
  else if (dim === "co") { f.coSet = [val]; f.co = 0; f.region = null; }
  else if (dim === "mv") { f.mvSet = [val]; f.mv = 0; }
  else if (dim === "mus") { f.musSet = [val]; f.mus = -1; }
  else if (dim === "when") { f.y0 = val[0]; f.y1 = val[1]; }
  else if (dim === "color") { f.hexes = [val]; f.name = nameOf(val).text; f.tol = 8; f.cover = 5; f.colorMode = "any"; }
}
// clear exactly one active facet (the chip's own ✕) -- the multi-select complement of pmFacetApply's "set"
function pmChipClear(f, dim) {
  if (dim === "fav") return "fav";   // handled by the caller (s.fav lives outside f)
  if (dim === "co") { f.coSet = []; f.co = 0; f.region = null; }
  else if (dim === "when") { f.y0 = null; f.y1 = null; }
  else if (dim === "color") { f.hexes = []; f.name = ""; f.colorMode = "any"; }
  else if (dim === "hueBand") f.hueBand = null;
  else if (dim === "l") { f.l0 = null; f.l1 = null; }
  else if (dim === "painter") { f.painterSet = []; f.painter = 0; }
  else if (dim === "mv") { f.mvSet = []; f.mv = 0; }
  else if (dim === "mus") { f.musSet = []; f.mus = -1; }
}

// ---------- the list: the filters, then your favorites ----------
function pmList(s, F) {
  let list = pmRun(s, F).list;
  if (s.fav) {
    const ids = pmFavList(F);
    const want = new Set(ids.map(r => r.i));
    list = list.filter(i => want.has(i));
  }
  // the time scrubber (David, 2026-10-09): "paintings appear decade by decade" -- only ones dated at or before
  // the scrubbed year. Undated paintings have nothing honest to compare against a year, so they stay hidden
  // until the scrubber reaches the real end of the range (the same moment it stops meaning anything to filter).
  if (s.upToYear != null) {
    const G = (F && F.G) || GAL;
    const [, hi] = pmYearRange(F);
    if (s.upToYear < hi) list = list.filter(i => G.year[i] !== GL_UNDATED && G.year[i] <= s.upToYear);
  }
  return list;
}

// ---------- layouts: every painting gets one grid cell ----------
// lay = { key, n, items (k -> gallery index), x, y (cell per k), gx0, gy0, GW, GH, grid (cell -> k or -1), labels, start }
function pmGridOf(items, X, Y, labels, start) {
  const n = items.length; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k < n; k++) { if (X[k] < x0) x0 = X[k]; if (X[k] > x1) x1 = X[k]; if (Y[k] < y0) y0 = Y[k]; if (Y[k] > y1) y1 = Y[k]; }
  if (!n) { x0 = y0 = x1 = y1 = 0; }
  const GW = x1 - x0 + 1, GH = y1 - y0 + 1, grid = new Int32Array(GW * GH).fill(-1);
  for (let k = 0; k < n; k++) grid[(Y[k] - y0) * GW + X[k] - x0] = k;
  return { n, items, x: X, y: Y, gx0: x0, gy0: y0, GW, GH, grid, labels: labels || [], start: start || [0, 0] };
}
const pmAt = (lay, cx, cy) => { const x = cx - lay.gx0, y = cy - lay.gy0; return x < 0 || y < 0 || x >= lay.GW || y >= lay.GH ? -1 : lay.grid[y * lay.GW + x]; };
// mean color (CIELAB, by area) and dominant color, for the neighbor pass
function pmFeat(list, F) {
  const G = (F && F.G) || GAL, n = list.length, f = new Float32Array(n * 6);
  for (let k = 0; k < n; k++) {
    const i = list[k], d = pmDom(i, F), o = (i * 6 + d) * 3;
    f[k * 6] = G.mean[i * 3]; f[k * 6 + 1] = G.mean[i * 3 + 1]; f[k * 6 + 2] = G.mean[i * 3 + 2];
    f[k * 6 + 3] = G.lab[o]; f[k * 6 + 4] = G.lab[o + 1]; f[k * 6 + 5] = G.lab[o + 2];
  }
  return f;
}
const pmHueKey = (a, b) => { let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360; return (H - 330 + 360) % 360; };   // reds first, then oranges, browns, yellows, greens, blues, purples
function pmLayColor(list, place, F) {
  const n = list.length, cols = Math.max(1, Math.round(Math.sqrt(n / 1.55))), rows = Math.ceil(n / cols);
  const Lp = new Float32Array(n), Ap = new Float32Array(n), Bp = new Float32Array(n);
  for (let k = 0; k < n; k++) { const c = pmPlaceLab(list[k], place, F); Lp[k] = c[0]; Ap[k] = c[1]; Bp[k] = c[2]; }
  const L = k => Lp[k], A = k => Ap[k], B = k => Bp[k];
  const idx = Array.from({ length: n }, (_, k) => k);
  const chroma = idx.filter(k => Math.hypot(A(k), B(k)) >= 5).sort((p, q) => pmHueKey(A(p), B(p)) - pmHueKey(A(q), B(q)));
  const greys = idx.filter(k => Math.hypot(A(k), B(k)) < 5);
  // the near-neutral paintings go where the warm olives meet the greens (hue key ~140), not at either end
  const cut = chroma.findIndex(k => pmHueKey(A(k), B(k)) >= 140);
  const order = cut < 0 ? chroma.concat(greys) : chroma.slice(0, cut).concat(greys, chroma.slice(cut));
  const X = new Int32Array(n), Y = new Int32Array(n), items = new Int32Array(n);
  const ox = Math.floor(cols / 2), oy = Math.floor(rows / 2);
  let k2 = 0;
  for (let j = 0; j < cols && k2 < n; j++) {
    const col = order.slice(k2, k2 + rows).sort((p, q) => L(q) - L(p));
    col.forEach((k, r) => { const m = k2 + r; items[m] = list[k]; X[m] = j - ox; Y[m] = r - oy; });
    k2 += col.length;
  }
  const lay = pmGridOf(items, X, Y);
  pmSmooth(lay, 120, F);
  return lay;
}
// the neighbor pass: try swapping each cell with its right or lower neighbor; keep the swap when the two then look
// more like the cells around them (local, so the big light-to-dark and hue directions stay)
function pmSmooth(lay, budget, F) {
  const n = lay.n; if (n < 9) return;
  const f = pmFeat(lay.items, F), g = lay.grid, W = lay.GW, H = lay.GH;
  const d = (p, q) => { const a = p * 6, b = q * 6; let s = 0; for (let t = 0; t < 3; t++) { const e = f[a + t] - f[b + t]; s += e * e; } for (let t = 3; t < 6; t++) { const e = f[a + t] - f[b + t]; s += .5 * e * e; } return s; };
  const cost = (k, x, y, skip) => { let c = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = g[yy * W + xx]; if (q >= 0 && q !== skip) c += d(k, q); } return c; };
  const t0 = performance.now(); let seed = 9301;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // a time budget, and a cap on tries too (a clock that doesn't move while code runs, as in headless test runs, can't hang it)
  for (let round = 0, rounds = Math.ceil(n * 14 / 4000); round < rounds && performance.now() - t0 < budget; round++) {
    for (let it = 0; it < 4000; it++) {
      const c = Math.floor(rnd() * W * H), x = c % W, y = (c / W) | 0, right = rnd() < .5, x2 = right ? x + 1 : x, y2 = right ? y : y + 1;
      if (x2 >= W || y2 >= H) continue;
      const p = g[c], q = g[y2 * W + x2]; if (p < 0 || q < 0) continue;
      const before = cost(p, x, y, q) + cost(q, x2, y2, p), after = cost(q, x, y, q) + cost(p, x2, y2, p);
      if (after < before) {
        const ip = lay.items[p]; lay.items[p] = lay.items[q]; lay.items[q] = ip;   // k keeps its cell; the painting moves
        for (let t = 0; t < 6; t++) { const e = f[p * 6 + t]; f[p * 6 + t] = f[q * 6 + t]; f[q * 6 + t] = e; }
      }
    }
  }
}
// the year as a sortable number; undated last
const pmYr = (i, F) => { const G = (F && F.G) || GAL; return G.year[i] === GL_UNDATED ? 1e5 : G.year[i]; };
function pmBand(i, F) {
  const G = (F && F.G) || GAL, y = G.year[i];
  if (y === GL_UNDATED) return { key: 1e6, label: "Undated" };
  if (y < 1500) { const c = Math.floor(y / 100) * 100; return { key: c, label: c < 0 ? `${-c} BCE` : `${c}–${c + 99}` }; }
  const d = Math.floor(y / 10) * 10; return { key: d, label: d + "s" };
}
function pmLayTime(list, place, F) {
  const n = list.length, Wc = Math.max(3, Math.min(16, Math.round(Math.sqrt(n) / 2.2)));
  const bands = new Map();
  list.forEach(i => { const b = pmBand(i, F); if (!bands.has(b.key)) bands.set(b.key, { ...b, items: [] }); bands.get(b.key).items.push(i); });
  const keys = [...bands.keys()].sort((a, b) => a - b);
  const Lv = i => pmPlaceLab(i, place, F)[0], Av = i => pmPlaceLab(i, place, F)[1], Bv = i => pmPlaceLab(i, place, F)[2];
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let y = 0, m = 0, start = null, half = n / 2, seen = 0;
  keys.forEach(key => {
    const b = bands.get(key), its = b.items.sort((p, q) => Lv(q) - Lv(p));
    labels.push({ x: -ox, y, text: b.label, n: its.length, w: Wc });
    y++;
    for (let r = 0; r * Wc < its.length; r++) {
      const row = its.slice(r * Wc, r * Wc + Wc).sort((p, q) => pmHueKey(Av(p), Bv(p)) - pmHueKey(Av(q), Bv(q)));
      row.forEach((i, c) => { items[m] = i; X[m] = c - ox; Y[m] = y; m++; });
      y++;
    }
    if (!start && seen + its.length >= half) start = [0, y - Math.ceil(its.length / Wc) / 2 - .5];
    seen += its.length;
    y++;   // a quiet gap row between bands
  });
  return pmGridOf(items, X, Y, labels, start ? [Math.round(start[0]), Math.round(start[1])] : [0, 1]);
}
// David, 2026-10-09: the shelf-packer behind "By painter" generalized to take ANY grouping (families groups by
// movement instead of painter, same shelves) -- one block per group, each block's own internal order its own
// business (chronological for painter/movement blocks).
function pmLayGroup(list, o) {
  const n = list.length, Wc = Math.max(4, Math.min(18, Math.round(Math.sqrt(n) / 1.6)));
  const groups = new Map();
  list.forEach(i => { const g = o.groupOf(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
  groups.forEach(arr => arr.sort(o.sortWithin));
  let keys = o.order ? o.order.filter(k => groups.has(k)) : [...groups.keys()];
  if (!o.order) keys.sort((a, b) => (o.keyRank ? o.keyRank(a, groups.get(a)) - o.keyRank(b, groups.get(b)) : 0) || groups.get(b).length - groups.get(a).length);
  const items = new Int32Array(n), X = new Int32Array(n), Y = new Int32Array(n), labels = [];
  const ox = Math.floor(Wc / 2);
  let x = 0, y = 0, shelfH = 0, m = 0;
  keys.forEach(key => {
    const arr = groups.get(key), c = arr.length, bw = Math.min(Wc, Math.max(1, Math.ceil(Math.sqrt(c * 1.3)))), bh = Math.ceil(c / bw);
    if (x > 0 && x + bw > Wc) { y += shelfH + 2; x = 0; shelfH = 0; }
    labels.push({ x: x - ox, y, text: o.label(key, c), n: c, w: bw });
    arr.forEach((i, k) => { items[m] = i; X[m] = x + k % bw - ox; Y[m] = y + 1 + Math.floor(k / bw); m++; });
    shelfH = Math.max(shelfH, bh); x += bw + 1;
  });
  const L0 = labels[0];
  return pmGridOf(items, X, Y, labels, L0 ? [Math.round(L0.x + (L0.w - 1) / 2), L0.y + 1] : [0, 1]);
}
function pmLayPainter(list, F) {
  return pmLayGroup(list, {
    groupOf: i => F.artist[i], sortWithin: (p, q) => pmYr(p, F) - pmYr(q, F),
    keyRank: (a, arr) => { if (!a) return 2e5; const y = arr.map(i => pmYr(i, F)).sort((p, q) => p - q); return y[y.length >> 1]; },
    label: (a, c) => a ? xbArtistName(F, a) : (F.col === "design" ? "Maker unknown" : F.col === "photography" ? "Photographer unknown" : "Artist unknown"),
  });
}
// Families (David, 2026-10-09): the same shelves, grouped by movement instead of painter -- the biggest
// movements first (keyRank left at its default, so the group-size tiebreak alone decides order). Reused as-is
// for another collection's "Category" grouping (Design objects' cat, Photography's process) -- F.mv/F.meta.
// movements just hold different values than a painting's own movement, same shape throughout.
function pmLayFamilies(list, F) {
  return pmLayGroup(list, {
    groupOf: i => F.mv[i], sortWithin: (p, q) => pmYr(p, F) - pmYr(q, F),
    label: (mv, c) => mv ? F.meta.movements[mv - 1] : "Unclassified",
  });
}
// Tones (David, 2026-10-09): the same Vivid/Light/Muted/Dark split honey.js's own Tones shape uses
// (honeyToneGroup), applied to whichever color "Place by" already uses for position (pmPlaceLab) -- an island
// per mood, hue-ordered inside, so the painter/movement groupings aren't the only way to read the set.
const PM_TONE_ORDER = ["Vivid", "Light", "Muted", "Dark"];
function pmToneOf(i, place, F) { const [L, a, b] = pmPlaceLab(i, place, F), C = Math.hypot(a, b); return L < 40 ? "Dark" : L >= 78 ? "Light" : C >= 45 ? "Vivid" : "Muted"; }
function pmLayTones(list, place, F) {
  return pmLayGroup(list, {
    groupOf: i => pmToneOf(i, place, F),
    sortWithin: (p, q) => { const a = pmPlaceLab(p, place, F), b = pmPlaceLab(q, place, F); return pmHueKey(a[1], a[2]) - pmHueKey(b[1], b[2]); },
    order: PM_TONE_ORDER, label: k => k,
  });
}
// the shared ordering behind both "around one painting" shapes (Rings, Spiral): nearest-to-seed first, by the
// matched-palette distance for the 400 closest (js/gallery.js glSimilar's own technique), mean-color distance
// for the rest -- unchanged from the old single "similar" arrangement, just no longer tied to one fixed layout.
function pmSimilarOrder(list, seed, F) {
  const G = (F && F.G) || GAL, m = G.mean, q = seed * 3, Lb = G.lab;
  let L = Array.from(list).filter(i => i !== seed);
  const d0 = new Map();
  L.forEach(j => { const a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2], e = G.C[j] - G.C[seed]; d0.set(j, a * a + b * b + c * c + e * e); });
  L.sort((a, b) => d0.get(a) - d0.get(b));
  const half = (a, b) => { let s = 0; for (let x = 0; x < 6; x++) { const oa = (a * 6 + x) * 3; let best = 1e9; for (let y = 0; y < 6; y++) { const ob = (b * 6 + y) * 3, d = glDE(Lb[oa], Lb[oa + 1], Lb[oa + 2], Lb[ob], Lb[ob + 1], Lb[ob + 2]); if (d < best) best = d; } s += G.sh[a * 6 + x] * best; } return s; };
  const near = L.slice(0, 400).map(j => [j, (half(seed, j) + half(j, seed)) / 2]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  return [seed, ...near, ...L.slice(400)];
}
// Rings: concentric square shells (the old "similar" layout, unchanged) -- a clean, bands-you-can-count read.
function pmLayRings(list, seed, F) {
  const L = pmSimilarOrder(list, seed, F);
  const n = L.length, r = Math.ceil(Math.sqrt(n / Math.PI)) + 2, cells = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) cells.push([x, y, x * x + y * y, Math.atan2(y, x)]);
  cells.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  const items = Int32Array.from(L), X = new Int32Array(n), Y = new Int32Array(n);
  for (let k = 0; k < n; k++) { X[k] = cells[k][0]; Y[k] = cells[k][1]; }
  return pmGridOf(items, X, Y, [], [0, 0]);
}
// Spiral (David, 2026-10-09, "★ Spiral/Sunflower"): the SAME similarity order as Rings, but placed by golden-
// angle phyllotaxis (the sunflower-seed pattern: radius grows with sqrt(rank), angle advances by the golden
// angle every step) instead of grouping by fixed-radius shell -- a continuous weave with no seam between one
// rank and the next, rather than Rings' clean bands. Ideal positions are real numbers; snapped to the nearest
// free integer cell (this engine's grid needs one painting per cell), searching outward on the rare collision --
// phyllotaxis is specifically the pattern that packs points with the fewest collisions in the first place, so
// this almost always resolves within a ring or two.
// David, 2026-10-09 ("the Spiral view looks off because of all the empty space") then 2026-10-10 ("still looks
// bad... make Spiral as dense as Rings"): radius was first 1.6, then 0.62 -- both still left visible holes. The
// AREA formula (a disk of k unit cells has radius sqrt(k/pi) = 0.564*sqrt(k)) looks right for continuous points,
// but this engine snaps ideal continuous phyllotaxis positions to the nearest FREE INTEGER CELL, and that
// rounding+collision-avoidance systematically pushes points slightly outward (never inward), inflating the real
// footprint beyond the continuous radius. Measured empirically (not just derived): sweeping the constant and
// counting interior holes (unoccupied lattice cells well inside the filled disk, across n from a few hundred to
// the full ~23,778-painting dataset) bottoms out at essentially ZERO interior holes around 0.52-0.54 -- tighter
// than the continuous-area formula, not looser, because of that outward rounding bias. 0.53 lands in the middle
// of that zero-hole band with room either side, giving Spiral the same packing density Rings' own zero-gap
// shells have (Rings enumerates literally every cell in ring order, the tightest possible reference point).
function pmLaySpiral(list, seed, F) {
  const L = pmSimilarOrder(list, seed, F), n = L.length, GOLD = Math.PI * (3 - Math.sqrt(5));
  const occupied = new Set(), X = new Int32Array(n), Y = new Int32Array(n);
  const key = (x, y) => (x + 20000) * 50000 + (y + 20000);
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0;
    if (k > 0) {
      const rad = Math.sqrt(k) * .53, ang = k * GOLD;
      x = Math.round(rad * Math.cos(ang)); y = Math.round(rad * Math.sin(ang));
      if (occupied.has(key(x, y))) {
        outer: for (let ring = 1; ring < 30; ring++) {
          for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const xx = x + dx, yy = y + dy;
            if (!occupied.has(key(xx, yy))) { x = xx; y = yy; break outer; }
          }
        }
      }
    }
    occupied.add(key(x, y)); X[k] = x; Y[k] = y;
  }
  return pmGridOf(Int32Array.from(L), X, Y, [], [0, 0]);
}
function pmLayout(s, F) {
  const list = pmList(s, F), key = pmQS(s, F) + "|" + list.length + "|" + (s.fav ? pmFavList(F).map(r => r.i).join(",") : "");
  let lay = PM_LAYOUTS.get(key);
  if (!lay) {
    lay = s.arr === "time" ? pmLayTime(list, s.place, F) : s.arr === "painter" ? pmLayPainter(list, F)
      : s.arr === "families" ? pmLayFamilies(list, F) : s.arr === "tones" ? pmLayTones(list, s.place, F)
      : s.arr === "rings" ? pmLayRings(list, s.seed, F) : s.arr === "spiral" ? pmLaySpiral(list, s.seed, F)
      : pmLayColor(list, s.place, F);
    lay.key = key; lay.arr = s.arr;
    PM_LAYOUTS.set(key, lay); if (PM_LAYOUTS.size > 8) PM_LAYOUTS.delete(PM_LAYOUTS.keys().next().value);
  }
  return lay;
}

// ---------- thumbnails: load the few on screen, bake each once, recycle ----------
const PM_BAKE = 144, PM_CACHE_MAX = 650, PM_BIG_MAX = 36, PM_FLIGHT = 14;
// Canvas taint, corrected (2026-10-09, after measuring only ~62% of drawn cells showed a real photo and finding
// why): drawing a cross-origin image onto a canvas WITHOUT a crossorigin request the host actually honors does
// leave THAT canvas unreadable (toDataURL/getImageData throw), and the taint spreads to any other canvas it's
// later drawn onto -- but nothing in this file, or anywhere else in the app, ever reads pixels back off .pmx-cv
// or off a baked tile's own offscreen canvas (grepped: the only getImageData/toDataURL on a map canvas is
// js/honey.js's HM_CTRL.snapshot(), which reads honey.js's OWN separate honeycomb canvas -- a different element
// this file never touches). The original fix ported honey.js's real constraint onto a canvas that never needed
// it, so most of the corpus (Commons, Cleveland -- not in GL_CORS_HOSTS, and Commons' own Special:FilePath
// redirect chain fails an actual crossOrigin="anonymous" load even though its final CDN response does carry
// Access-Control-Allow-Origin: *, confirmed live) got a flat color tile instead of its photo, no matter the
// size or zoom. bake() now always draws the real pixels it already has in memory, safe host or not -- a tainted
// canvas is only a problem for code that tries to read it back, and nothing here does. crossOrigin is still
// only requested from hosts we know answer it correctly (pmSafeHost/GL_CORS_HOSTS): asking a host that doesn't
// support it would fail the LOAD entirely (gallery.js's own glCORS() comment covers the same ground), not just
// taint a canvas nothing reads.
function pmSafeHost(url) {
  try { return GL_CORS_HOSTS.has(new URL(url, location.href).hostname); } catch (e) { return false; }
}
function pmImages(onReady, F) {
  const cache = new Map(), bigs = new Map();   // i -> { st: 0 loading | 1 ready | 2 failed, bm, ar, used } ; i -> HTMLImageElement (kept for the big tiles)
  let flying = 0, frame = 0, dead = false;
  const bake = (i, img, crop) => {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (crop && crop[2] - crop[0] > 50 && crop[3] - crop[1] > 50) { sx = crop[0] / 1000 * nw; sy = crop[1] / 1000 * nh; sw = (crop[2] - crop[0]) / 1000 * nw; sh = (crop[3] - crop[1]) / 1000 * nh; }
    const src = { sx, sy, sw, sh }, m = Math.min(sw, sh);
    const cv = document.createElement("canvas"); cv.width = cv.height = PM_BAKE;
    const cx = cv.getContext("2d");
    cx.drawImage(img, sx + (sw - m) / 2, sy + (sh - m) / 2, m, m, 0, 0, PM_BAKE, PM_BAKE);
    return { cv, src };
  };
  function want(list) {   // list: gallery indices, most wanted first; also tells which ones need the full picture
    frame++;
    for (const [i, big] of list) {
      const e = cache.get(i);
      if (e) { e.used = frame; if (big && e.st === 1 && !bigs.has(i) && e.url) pmBigLoad(i, e); continue; }
      if (flying >= PM_FLIGHT) continue;
      const t = pmThumb(i, F); if (!t) { cache.set(i, { st: 2, used: frame }); continue; }
      const local = t.url.startsWith("img/gallery/"), safe = local || pmSafeHost(t.url);
      const ent = { st: 0, used: frame, url: t.url, crop: t.crop, safe };
      const img = new Image(); img.decoding = "async"; if (!local && safe) img.crossOrigin = "anonymous"; ent.img = img;
      cache.set(i, ent); flying++;
      img.onload = () => {
        flying--; ent.img = null; if (dead) return;
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => {
          if (dead) return;
          // bake() always draws the real pixels now (see the comment above pmSafeHost) -- "big" (the full,
          // less-cropped picture, kept for the always-biggest centered/magnified cell) is no longer reserved for
          // a CORS-answering host either; pmBigLoad just has to avoid requesting crossorigin from a host that
          // won't honor it (that would fail the load outright, not merely taint a canvas nothing reads).
          try { const b = bake(i, img, t.crop); ent.bm = b.cv; ent.src = b.src; ent.st = 1; ent.t0 = performance.now(); if (big) { bigs.set(i, img); trimBig(); } } catch (err) { ent.st = 2; }
          onReady();
        });
      };
      img.onerror = () => { if (ent.img) { flying--; ent.img = null; } ent.st = 2; };
      img.src = t.url;
    }
    // a picture still on its way for a tile you've panned past (not wanted for ~half a second) is dropped, so the
    // ones on screen now get the connections
    cache.forEach((e, i) => { if (e.st === 0 && e.img && frame - e.used > 30) { const im = e.img; e.img = null; im.onload = im.onerror = null; im.removeAttribute("src"); flying--; cache.delete(i); } });
    if (cache.size > PM_CACHE_MAX) {   // recycle the least recently wanted
      const old = [...cache.entries()].filter(([, e]) => e.st !== 0).sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < cache.size - PM_CACHE_MAX && k < old.length; k++) { cache.delete(old[k][0]); bigs.delete(old[k][0]); }
    }
  }
  function pmBigLoad(i, e) {
    if (e.bigLoading) return; e.bigLoading = true;
    const local = e.url.startsWith("img/gallery/");
    const img = new Image(); img.decoding = "async"; if (!local && e.safe) img.crossOrigin = "anonymous";   // only from a host that actually answers CORS -- requesting it elsewhere fails the load outright
    img.onload = () => { if (dead) return; bigs.set(i, img); trimBig(); onReady(); };
    img.onerror = () => { e.bigLoading = false; };
    img.src = e.url;
  }
  function trimBig() { while (bigs.size > PM_BIG_MAX) { const k = bigs.keys().next().value; bigs.delete(k); const e = cache.get(k); if (e) e.bigLoading = false; } }
  const stats = () => { let ok = 0, wait = 0, bad = 0; cache.forEach(e => e.st === 1 ? ok++ : e.st === 0 ? wait++ : bad++); return { ok, wait, bad, flying, bigs: bigs.size }; };
  return { get: i => cache.get(i), big: i => bigs.get(i), want, stats, destroy: () => { dead = true; cache.clear(); bigs.clear(); } };
}

// ---------- tier 0 / tier 1 sprite atlas ----------
// David, 2026-10-09: "a tiny version of every picture, and when you zoom in, it loads the bigger one" -- the
// per-painting streaming above (pmImages/want/bake) is a waterfall of thousands of requests once thousands of
// cells are ever on screen across a session, even though only a handful are EVER big enough to be worth a real
// fetch at once. tools/paintmap_atlas.py builds two cheap sheet tiers that cover everything else:
//   tier 0  data/paintmap/atlas0.webp -- every painting (~23,778), a TIER0_TILE-px center-cropped square, packed
//           into ONE shared sheet in gallery-index order. One fetch (+ the tiny manifest), loaded once at map
//           open; every cell can drawImage its own real tiny picture the instant it's ready, never a per-cell
//           request, so the overview reads as real color from the first frame tier 0 lands, not after it.
//   tier 1  data/paintmap/g<N>.webp -- the same idea at TIER1_TILE px, one sheet per manifest.tier1.groupSize-
//           painting range of gallery index (pmT1Group). Fetched on demand (pmAtlasTier1's want()), one request
//           per sheet, cached forever (LRU-evicted only past PM_T1_CACHE_MAX) -- there are only manifest.tier1.
//           numGroups of these total (16 at the build script's current GROUP_SIZE=1500), so even panning around
//           enough to touch most of the dataset costs well under twenty requests, not one per cell.
// Both tiers place a painting by PURE ARITHMETIC (pmT0Rect/pmT1Rect: sheet = i div perSheet, cell = i mod cols,
// x/y from that) -- no id->position index file, because gallery-index order is already the order the build
// script packed tiles in, same as data/gallery/thumbs.txt itself. Tier 2 (pmImages above) is unchanged except
// for WHEN it runs: gated to b.d >= PM_T2_MIN now (used to start at a few px) -- "the existing thumbnails, only
// for the few visible" per the design, with tier 0/1 covering every zoom level below that.
// atlas sheets, cached per collection (David, 2026-10-10: "Collection" on the map -- Paintings keeps its
// existing data/paintmap/ root untouched; another collection's own sheets live at data/paintmap/<col>/,
// built the same way by tools/paintmap_atlas.py's own --collection flag). PM_ATLAS_CACHE holds the resolved
// {man,bm0s} once a collection's tier-0 sheets land (synchronous after that, for pmAtlasTier1's `want()` and
// the QA hooks); PM_ATLAS_P tracks the in-flight promise per collection so a second mount of the same
// collection just awaits it instead of re-fetching.
const PM_ATLAS_CACHE = new Map(), PM_ATLAS_P = new Map();
const pmAtlasBase = col => (col && col !== "paintings") ? `data/paintmap/${col}/` : "data/paintmap/";
const PM_T1_MIN = 24, PM_T2_MIN = 120;
// a decoded tier-1 sheet (2000x2000 at the build script's own GROUP_SIZE/TIER1_TILE, since David's iPhone 16 Pro
// Max/2026-10-10: see tools/paintmap_atlas.py's GROUP_SIZE comment) costs ~16MB of raw bitmap memory --
// PM_T1_CACHE_MAX=6 caps that around ~96MB even if every sheet in the dataset gets touched in one session,
// comfortably inside what a phone browser (or a Home Screen app's tighter WKWebView budget) affords a
// background canvas, without thrashing on an ordinary pan
const PM_T1_CACHE_MAX = 6;
// iOS Safari (confirmed buggy pre-17, and createImageBitmap from a Blob can still fail under memory pressure on
// ANY version, which is exactly David's 2026-10-10 Home Screen app report -- "every painting is not loaded at
// once"): createImageBitmap has no partial-failure mode, so ONE failed decode used to leave PM_ATLAS null, and
// every tile's flat-color fallback (js/paintmap.js's own ctx.fillRect above tier 0, drawn first every frame)
// stayed up for the rest of the session with no retry. pmDecodeSheet() tries createImageBitmap first (cheaper,
// doesn't block the main thread) and falls back to the <img>+decode() path pmImages() already uses for tier 2
// -- an HTMLImageElement draws via ctx.drawImage exactly like an ImageBitmap, so nothing downstream needs to
// know which one it got.
function pmDecodeImgFallback(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), img = new Image(); img.decoding = "async";
    const done = ok => { URL.revokeObjectURL(url); ok ? resolve(img) : reject(new Error("img decode failed")); };
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => done(true));
    img.onerror = () => done(false);
    img.src = url;
  });
}
function pmDecodeSheet(url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error("sheet " + r.status + " " + url); return r.blob(); })
    .then(blob => (typeof createImageBitmap === "function" ? createImageBitmap(blob).catch(() => pmDecodeImgFallback(blob)) : pmDecodeImgFallback(blob)));
}
// atlas0 is the ONE thing every cell's base picture depends on -- a transient decode failure (the exact failure
// mode above) must retry rather than leave the whole map on flat colors forever. A handful of backed-off
// attempts, not infinite: a real 404/missing-build-output still surfaces the "didn't load" retry button
// (js/paintmap.js's pmOpen .catch) instead of looping silently.
const PM_ATLAS_RETRIES = 3;
function pmAtlasLoad(col) {
  col = col || "paintings";
  if (PM_ATLAS_CACHE.has(col)) return Promise.resolve(PM_ATLAS_CACHE.get(col));
  if (PM_ATLAS_P.has(col)) return PM_ATLAS_P.get(col);
  const base = pmAtlasBase(col), v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  const attempt = n => fetch(base + "manifest.json" + v).then(r => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
    .then(man => Promise.all(man.tier0.sheets.map(name => pmDecodeSheet(base + name + v)))
      .then(bm0s => { const atlas = { man, bm0s, missing: man.missing && man.missing.length ? new Set(man.missing) : null }; PM_ATLAS_CACHE.set(col, atlas); return atlas; }))
    .catch(e => {
      if (n < PM_ATLAS_RETRIES) return new Promise(res => setTimeout(res, 600 * Math.pow(2, n))).then(() => attempt(n + 1));
      PM_ATLAS_P.delete(col); throw e;
    });
  const p = attempt(0); PM_ATLAS_P.set(col, p); return p;
}
// tier 0: a painting's own cell -- which sheet (now several, each kept <= 2048px square for iOS/WebKit's safe
// decode ceiling -- see tools/paintmap_atlas.py) plus the cell inside it, pure arithmetic, no lookup
function pmT0Rect(man, i) {
  const t = man.tier0, sheet = Math.floor(i / t.perSheet), local = i % t.perSheet;
  return { sheet, x: (local % t.cols) * t.tile, y: Math.floor(local / t.cols) * t.tile, s: t.tile };
}
const pmT1Group = (man, i) => Math.floor(i / man.tier1.groupSize);
// tier 1: the group's own cols (the last group is usually a partial page, same ceil(sqrt) the build script used)
function pmT1Rect(man, i) {
  const t = man.tier1, g = pmT1Group(man, i), lo = g * t.groupSize, hi = Math.min(man.n, lo + t.groupSize);
  const cols = Math.max(1, Math.ceil(Math.sqrt(hi - lo))), local = i - lo;
  return { x: (local % cols) * t.tile, y: Math.floor(local / cols) * t.tile, s: t.tile, g };
}
// a small per-painting bag for tier-selection hysteresis flags and crossfade start-times, shared by pmT1Group's
// own gate and tier 0/1's first-appearance fade -- bounded by the dataset size (one tiny object per painting
// ever drawn, never freed for the life of a map session), trivial next to the sheets/bitmaps themselves
function pmTState(map, i) { let s = map.get(i); if (!s) { s = {}; map.set(i, s); } return s; }
function pmFadeAlpha(s, key, now, dur, rm) { if (s[key] == null) s[key] = now; return rm ? 1 : Math.min(1, (now - s[key]) / dur); }
// tier 1 sheet cache: one entry per group, fetched at most once, LRU-evicted only under real pressure
function pmAtlasTier1(onReady, col) {
  col = col || "paintings";
  const base = pmAtlasBase(col);
  const cache = new Map();   // group -> { st: 0 loading | 1 ready | 2 failed, bm, used }
  let frame = 0, dead = false;
  function want(groups) {
    frame++;
    const atlas = PM_ATLAS_CACHE.get(col); if (!atlas) return;
    const man = atlas.man;
    for (const g of groups) {
      const e = cache.get(g);
      if (e) { e.used = frame; continue; }
      if (g < 0 || g >= man.tier1.numGroups) continue;
      const ent = { st: 0, used: frame, bm: null };
      cache.set(g, ent);
      const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
      pmDecodeSheet(base + man.tier1.file.replace("{g}", g) + v)
        .then(bm => { if (dead) return; ent.bm = bm; ent.st = 1; onReady(); })
        .catch(() => { ent.st = 2; });
    }
    if (cache.size > PM_T1_CACHE_MAX) {
      const old = [...cache.entries()].filter(([, x]) => x.st !== 0 && x.used !== frame).sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < cache.size - PM_T1_CACHE_MAX && k < old.length; k++) {
        const [g, ent] = old[k]; if (ent.bm && ent.bm.close) ent.bm.close(); cache.delete(g);
      }
    }
  }
  return { get: g => cache.get(g), want, destroy: () => { dead = true; cache.forEach(e => e.bm && e.bm.close && e.bm.close()); cache.clear(); } };
}

// ---------- the dataset abstraction (David, 2026-10-10: "a more convenient way to view [the other archives],
// similar to paintings, with filters -- and even on a map") ----------
// PM_COLLECTIONS: every collection the map can lay out, Paintings first and unchanged. Each entry's build()
// returns a Promise<F> shaped exactly like xbLoad()'s own F (G, meta, N, artist, country, mv, dec, fam, dom,
// slugIx, col, nodes, ixOf) -- every function above (pmRun/pmList/pmLayout/pmPlaceLab/pmDom/pmHex/pmYr/pmBand/
// pmYearRange/pmFeat/pmSimilarOrder) already reads ONLY through F (or F.G) now, so a correctly-shaped F is the
// whole contract: nothing else in the engine needs to know which collection it's drawing.
const PM_COLLECTIONS = [
  ["paintings", "Paintings"],
  ["design", "Design objects"],
  ["photography", "Photography"],
];
// per-collection labels for the Filter sheet's row headers (David 2026-10-10: "facets adapted per collection" --
// same rows, renamed to fit: a design object has a Maker, not a Painter; Photography's "movement" row is really
// which of the three color PROCESSES made it).
const PM_COL_LABELS = {
  paintings: { painter: "Painter", mv: "Movement", co: "Place", mus: "Museum", noun: "painting", nounP: "paintings" },
  design: { painter: "Maker", mv: "Category", co: "Place", mus: "Source", noun: "object", nounP: "objects" },
  photography: { painter: "Photographer", mv: "Process", co: "Place", mus: "Source", noun: "photograph", nounP: "photographs" },
};
const pmColLabel = (F, key) => (PM_COL_LABELS[(F && F.col) || "paintings"] || PM_COL_LABELS.paintings)[key];
const PM_COL_F = new Map();   // col -> Promise<F>, loaded once per session (same lifetime as XBF itself)
const PM_COL_F_READY = new Map();   // col -> F, set once that promise resolves (pmRouteOf's sync fallback)
// xbFamOf (js/browse.js) needs a hue ANGLE in degrees -- GAL carries that pre-baked (G.hu); an adapter's own Lab
// array doesn't, so this derives it from a/b the same way pmHueKey's cousin elsewhere in this file already does.
function pmHueDeg(a, b) { let H = Math.atan2(b, a) * 180 / Math.PI; return H < 0 ? H + 360 : H; }
// builds a GAL-shaped G + xbBuild-shaped F from any array of "painting"-kind nodes (js/designobjects.js doNode /
// js/photography.js photographyNode both already produce exactly this shape: id, title, artist, year, place,
// img, palette ([{h,share,name}], up to 6, already real hex -- no Lab round-trip needed for color ITSELF, only
// for the position math every arrangement already does in Lab space), plus whatever cfg below reads for maker/
// place/category/museum. w/h when the node has them (Photography does; Design objects don't -- ar defaults to a
// square 1, same as a painting with no recorded size would).
function pmAdapterBuild(col, nodes, cfg) {
  const N = nodes.length;
  const mean = new Float32Array(N * 3), labArr = new Float32Array(N * 6 * 3), sh = new Float32Array(N * 6), ch = new Float32Array(N * 6);
  const C = new Float32Array(N), year = new Int32Array(N), ar = new Float32Array(N), mus = new Int32Array(N), dec = new Int16Array(N);
  const fam = new Uint8Array(N * 6), dom = new Uint8Array(N);
  const artist = new Uint16Array(N), country = new Uint16Array(N), mv = new Uint16Array(N);
  const artistIx = new Map(), countryIx = new Map(), mvIx = new Map(), srcIx = new Map();
  const artists = [], countries = [], movements = [], src = [];
  const slugIx = new Map(), byId = new Map();
  for (let i = 0; i < N; i++) {
    const n = nodes[i]; byId.set(n.id, i);
    const pal = (n.palette || []).slice(0, 6);
    let mL = 0, mA = 0, mB = 0, wsum = 0, bestSh = -1;
    for (let j = 0; j < 6; j++) {
      const p = pal[j], o = (i * 6 + j) * 3;
      if (p) {
        const [L, A, B] = lab(p.h);
        labArr[o] = L; labArr[o + 1] = A; labArr[o + 2] = B;
        sh[i * 6 + j] = p.share || 0; ch[i * 6 + j] = Math.hypot(A, B);
        fam[i * 6 + j] = xbFamOf(L, ch[i * 6 + j], pmHueDeg(A, B));
        if (sh[i * 6 + j] > bestSh) { bestSh = sh[i * 6 + j]; dom[i] = j; }
        mL += L * (p.share || 0); mA += A * (p.share || 0); mB += B * (p.share || 0); wsum += (p.share || 0);
      } else if (j > 0) {
        // pad an under-6 palette with its own first swatch, so pmDom/pmPlaceLab/pmFeat never index an empty slot
        labArr[o] = labArr[i * 18]; labArr[o + 1] = labArr[i * 18 + 1]; labArr[o + 2] = labArr[i * 18 + 2];
      }
    }
    if (wsum > 0) { mean[i * 3] = mL / wsum; mean[i * 3 + 1] = mA / wsum; mean[i * 3 + 2] = mB / wsum; }
    C[i] = Math.hypot(mean[i * 3 + 1], mean[i * 3 + 2]);
    year[i] = n.year != null ? n.year : GL_UNDATED;
    dec[i] = n.year != null ? clamp(Math.floor((n.year - XB_DEC0) / 10), 0, XB_NDEC - 1) : -1;
    ar[i] = n.w && n.h ? n.h / n.w : 1;
    const mkName = cfg.makerName(n), mkSlug = cfg.makerSlug(n) || (mkName ? routeSlug(mkName) : null);
    if (mkName) { let ix = artistIx.get(mkSlug); if (ix == null) { artists.push([mkName, mkSlug]); ix = artists.length; artistIx.set(mkSlug, ix); slugIx.set(mkSlug, ix); } artist[i] = ix; }
    const plName = cfg.placeName(n);
    if (plName) { let ix = countryIx.get(plName); if (ix == null) { countries.push(plName); ix = countries.length; countryIx.set(plName, ix); } country[i] = ix; }
    const catName = cfg.catName(n);
    if (catName) { let ix = mvIx.get(catName); if (ix == null) { movements.push(catName); ix = movements.length; mvIx.set(catName, ix); } mv[i] = ix; }
    const srcKey = cfg.srcKey(n), srcLabel = cfg.srcLabel(n);
    if (srcKey) { let ix = srcIx.get(srcKey); if (ix == null) { src.push({ k: srcKey, short: srcLabel }); ix = src.length - 1; srcIx.set(srcKey, ix); } mus[i] = ix; }
  }
  if (!src.length) src.push({ k: col, short: "—" });
  const G = { n: N, mean, lab: labArr, sh, ch, C, year, ar, src, mus, shard: N };
  const meta = { artists, countries, movements };
  return { G, meta, N, artist, country, mv, dec, fam, dom, slugIx, col, nodes, ixOf: id => { const v = byId.get(id); return v == null ? -1 : v; } };
}
const PM_COL_CFG = {
  design: {
    makerName: n => n.artist || null, makerSlug: n => n.makerSlug || null,
    placeName: n => n.place || null, catName: n => n.catLabel || n.cat || null,
    srcKey: n => n.src || "design", srcLabel: n => (typeof DO_SRC_LABEL !== "undefined" && DO_SRC_LABEL[n.src]) || n.imgSrcLabel || "Museum",
  },
  photography: {
    makerName: n => (n.artist && n.artist !== "Photographer unknown") ? n.artist : null, makerSlug: n => n.photographerSlug || null,
    placeName: n => n.country || null, catName: n => n.process ? n.process.replace(/ \(.*\)$/, "") : null,
    srcKey: () => "commons", srcLabel: () => "Wikimedia Commons",
  },
};
// loads (if needed) and returns the Promise<F> for a collection -- "paintings" defers to xbLoad() exactly as
// before (zero behavior change, same cached XBF); anything else loads its own module's data once (David's
// instruction: "keep the paintings dataset and all its behavior/URLs unchanged by default") and builds its
// adapter once, cached here for the life of the session.
function pmColLoad(col) {
  if (!col || col === "paintings") return xbLoad();
  if (PM_COL_F.has(col)) return PM_COL_F.get(col);
  const loader = col === "design" ? (typeof loadDesignObjects === "function" ? loadDesignObjects() : Promise.reject(new Error("design objects unavailable")))
    : col === "photography" ? (typeof loadPhotography === "function" ? loadPhotography() : Promise.reject(new Error("photography unavailable")))
    : Promise.reject(new Error("unknown collection " + col));
  const p = loader.then(nodes => { const F = pmAdapterBuild(col, nodes, PM_COL_CFG[col]); PM_COL_F_READY.set(col, F); return F; });
  PM_COL_F.set(col, p);
  return p;
}

// ---------- the screen ----------
let PM_NOW = null;   // { s, lay } of the open map
const PM_STATE = new Map();   // the address a map opened with -> its spec as you left it (filters and arrangement you changed)
function pmOpen(spec, o = {}) {
  // a fresh open (a tap on an entry point) starts from the spec; the same call again (Back, js/trail.js replaying it) finds
  // the map as you left it
  const from = typeof spec === "string" ? spec : JSON.stringify(spec || {}), fresh = o.fresh && !o._used;
  o._used = true;
  // David, 2026-10-10: the "Collection" choice -- a plain string spec (an address) carries it as its own col=
  // query param; an object spec (every other entry point) carries it as spec.col; default stays Paintings.
  const col = (typeof spec === "string" ? new URLSearchParams(spec.replace(/^\?/, "")).get("col") : spec && spec.col) || "paintings";
  const colTitle = (PM_COLLECTIONS.find(c => c[0] === col) || PM_COLLECTIONS[0])[1];
  const el = show(`
    <div class="pmx-stage"><canvas class="pmx-cv" aria-label="${esc(colTitle)} as a map: drag to browse, pinch to zoom, tap the middle one to open it"></canvas><p class="pmx-wait">Laying out the ${esc(colTitle.toLowerCase())}…</p></div>
    <header class="pmx-top">
      <button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <p class="pmx-title"><b>${esc(colTitle)}</b></p>
      <button class="corner r pmx-do" data-do-corner aria-label="Arrange or filter" aria-haspopup="dialog">${PM_ICON.arrange}</button>
    </header>
    ${col === "paintings" && typeof hmLayerSwitchHTML === "function" ? hmLayerSwitchHTML("paintings") : ""}
    <div class="pmx-chipbar" data-pmchipbar hidden></div>
    <div class="pmx-walk" data-pmwalk hidden></div>
    <div class="pmx-facets" data-pmfacets hidden></div>
    <div class="pmx-cap" data-pmcap hidden>
      <button class="pmx-cap-main" data-pmopen><b data-pmct></b><small data-pmcb></small></button>
      <button class="pmx-heart" data-pmheart aria-label="Add to your favorites"></button>
    </div>
  `, "fixed cx pmx");
  const back = el.querySelector("[data-back]");
  back.onclick = () => xBack();
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet,.rooms-stem")) xBack(); };
  // the top-center Colors|Paintings switch (js/home.js hmWireLayerSwitch): the only way to move between the two
  // layers now (David, 2026-10-09) -- the sheet's own "switch to the color map" icon is retired below. Only
  // meaningful for the Paintings collection (the color honeycomb has no "Design objects" layer of its own).
  if (col === "paintings" && typeof hmWireLayerSwitch === "function") hmWireLayerSwitch(el, "paintings", id => {
    if (id === "colors") { S.hm = S.hm || {}; S.hm.mode = "colors"; save(); if (typeof hmHome === "function") hmHome(); else xBack(); }
  });
  Promise.all([pmColLoad(col), pmThumbsLoad(col)]).then(([F]) => {
    if (!el.isConnected) return;
    const kept = !fresh && PM_STATE.get(from);
    // David, 2026-10-10: a spec OBJECT (not a URL string) can arrive from Explore's own single-value filter
    // (js/browse-ui.js's data-xbmap: f.co/f.painter/f.mv/f.mus as plain numbers) -- seed the new *Set fields from
    // whichever legacy singles it carries, the same back-compat pmParse already does for an old URL's p=/co=.
    const specF = (spec && spec.f) || {}, sf = { ...pmFilterFresh(), ...specF };
    if (!sf.coSet.length && specF.co) sf.coSet = [specF.co];
    if (!sf.painterSet.length && specF.painter) sf.painterSet = [specF.painter];
    if (!sf.mvSet.length && specF.mv) sf.mvSet = [specF.mv];
    if (!sf.musSet.length && specF.mus >= 0) sf.musSet = [specF.mus];
    const s = kept || (typeof spec === "string" ? pmParse(spec, F) : { ...pmFresh(), ...spec, f: sf });
    s.col = col;
    PM_STATE.set(from, s);
    pmMount(el, s, F);
  }).catch(err => {
    if (!el.isConnected) return;
    console.warn(err);
    el.querySelector(".pmx-wait").innerHTML = `The ${esc(colTitle.toLowerCase())} didn't load. <button class="wl" data-pmretry>Try again</button>`;
    el.querySelector("[data-pmretry]").onclick = () => pmOpen(spec, o);
  });
  return el;
}
function pmMount(el, s, F) {
  const cv = el.querySelector(".pmx-cv"), ctx = cv.getContext("2d"), wait = el.querySelector(".pmx-wait");
  const RM = reduceMotion, cap = el.querySelector("[data-pmcap]"), heart = el.querySelector("[data-pmheart]");
  const facets = el.querySelector("[data-pmfacets]"), chipbar = el.querySelector("[data-pmchipbar]"), walkBar = el.querySelector("[data-pmwalk]");
  let walk = [];   // "Walk from here" (David, 2026-10-09): the gallery indices visited this walk, in order; [] when none is active
  let scrubTimer = 0;   // the time scrubber's own Play timer (0 = not playing); lives here, not inside openSheet, so it survives a sheet close/reopen
  let lay = null, W = 0, H = 0, dpr = 1, base = 46;
  let P = [0, 0], Z = 1, V = [0, 0], glide = null, raf = 0, dead = false, centerK = -1, lastTick = 0, drawn = [];
  const ZMAX = 2.2, ZMIN_ABS = .002;   // a floor only to keep the zMin() search finite -- see its own comment
  const PM_TAP_ZOOM = 1.7;   // "large and centered" for a tapped painting's fly-to (David, 2026-10-10) -- never zooms OUT, only in if you're more zoomed out than this
  let pulseI = -1, pulseT0 = 0;   // the entry-point highlight ring (David, 2026-10-09): briefly rings whichever painting a seed just pinned the view to
  // David, 2026-10-09: "the name of the painting at the bottom isn't necessary -- we only need the name when we
  // tap it." The card used to track whatever's nearest the middle continuously, all through a pan -- now it only
  // opens for an explicit reason (a tap re-centers onto a painting, Walk/Center-on-presets/a facet chip land on
  // one, or a seeded entry point pins to one) and closes again the moment you start a new pan or tap empty space.
  let cardOpen = false;
  const PULSE_MS = 900;
  const imgs = pmImages(() => kick(), F);
  let atlas = null;   // this mount's own resolved {man,bm0s} once pmAtlasLoad(F.col) lands (see draw()'s tier 0/1 passes below)
  const t1 = pmAtlasTier1(() => kick(), F.col);
  const tierH = new Map();   // i -> { t1On, f0, f1 } (pmTState) -- tier 0/1 crossfade + hysteresis memory
  pmAtlasLoad(F.col).then(a => { atlas = a; if (!dead) kick(); }).catch(() => {});   // tier 0: one shared sheet, loaded once per session (idempotent -- a second mount just resolves immediately)
  if (!PM_LANDMARKS.size && typeof rcLoadPortraits === "function") {
    rcLoadPortraits().then(port => {
      if (dead || !port) return;
      const set = new Set();
      for (const slug in port) (port[slug].famous || []).forEach(gi => { if (gi != null && gi >= 0) set.add(gi); });
      PM_LANDMARKS = set; kick();
    }).catch(() => {});
  }
  // ---- the lens (js/honey.js's round fisheye): F(z) is how far from the middle a cell z cells away is drawn
  // far out, the lens softens (as on the color map), so the overview reads as one even mosaic
  // David, 2026-10-10: "a slider in Arrange for the zooming effect" -- the color map's own Magnify (js/home.js
  // HM_FEEL_SPECS, hmFeelTweak) controls exactly this ratio (center size vs edge size) over its own lens
  // formula; this is the paintmap-specific equivalent. s.mag is 0 (flat, no magnification) .. 1 (strong
  // fisheye), null meaning "never touched" -- a simple linear map onto M0N landing EXACTLY on today's old fixed
  // constant (4.6) at the slider's own midpoint (.5), so a session that never touches the slider looks
  // identical to before, and the default thumb position is an honest read of where the lens already sits.
  const PM_MAG_LO = 1, PM_MAG_HI = 8.2;   // M0N at mag=0 and mag=1; mag=.5 -> 4.6 (the old fixed value)
  const pmM0NOf = m => PM_MAG_LO + (m == null ? .5 : clamp(m, 0, 1)) * (PM_MAG_HI - PM_MAG_LO);
  let M0N = pmM0NOf(s.mag);
  const M1 = 1, SIG = 1.1;
  let M0 = M0N, A = (M0 - M1) * SIG * .8862;
  const lensAt = () => { M0 = M1 + (M0N - M1) * clamp((Z - .22) / .5, .3, 1); A = (M0 - M1) * SIG * .8862; };
  const erf = x => { const sg = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x); return sg * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
  const K = () => base * Z;
  const Fz = z => K() * (M1 * z + A * erf(z / SIG));
  const magR = z => M1 + (M0 - M1) * Math.exp(-((z / SIG) ** 2));
  const tanR = z => z < 1e-4 ? M0 : (M1 * z + A * erf(z / SIG)) / z;
  const Finv = r => { let lo = 0, hi = 600; for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (Fz(m) > r) hi = m; else lo = m; } return (lo + hi) / 2; };
  // a PURE version of Fz for an arbitrary candidate zoom zc (Fz/Finv above always read the live Z/A closure
  // state) -- needed below to search for the right zoom without disturbing what's actually on screen mid-frame
  const fzAt = (zc, gridDist) => { const m0 = M1 + (M0N - M1) * clamp((zc - .22) / .5, .3, 1), a = (m0 - M1) * SIG * .8862; return base * zc * (M1 * gridDist + a * erf(gridDist / SIG)); };
  // the zoom-out floor: the WHOLE current layout (every painting in this arrangement/filter) fits on screen with
  // a little margin -- like the color map's own finite-layout floor (js/honey.js zFloor()'s `lay.finite` branch:
  // "the whole cluster fits on screen... a big [layout] still gets room to zoom out and show more of itself").
  // David, 2026-10-10: "doesn't let me zoom out all the way to see everything" -- this used to hard-cap the fit
  // radius at 45 cells (~6,000 tiles) regardless of how much bigger the real layout was, a leftover from when a
  // fully zoomed-out view meant thousands of individual per-cell image requests. With the tiered sprite atlas
  // (tools/paintmap_atlas.py: tier 0 covers every cell from one decode, see js/paintmap.js's pmAtlasLoad) that's
  // no longer the bottleneck it was, so the cap is gone. Two more bugs came out while fixing that one: (1) it
  // sized the fit as one isotropic radius (the screen's own corner distance vs max(GW,GH)), which assumes the
  // content and the screen are both roughly square -- for a layout much taller than wide (pmLayColor's own
  // grid, e.g. 124x192) on a narrower-than-tall phone screen, that let the content's WIDTH overflow while its
  // height had room to spare, clipping part of the layout. (2) a naive per-axis `perUnit/base` (no lens term)
  // UNDER-estimated how far out Z needs to go, because the lens bulge (A above) never fully flattens even at low
  // zoom -- lensAt()'s own `.3` floor on its clamp keeps at least 30% of the bulge forever, which pushes every
  // cell's screen position outward by more than plain linear scaling accounts for. Binary-searching the real
  // (lens-correct) fzAt() per axis, like js/honey.js's own zFloor() `search()` does for the color map, fixes
  // both: each axis checked on its own terms, through the actual curve the draw loop uses, not an approximation
  // of it.
  const zMin = () => {
    if (!lay || !lay.GW || !lay.GH || !base) return .18;
    // the farthest the bbox's own edges are from the CURRENT pan center, per axis -- not just GW/2 and GH/2,
    // because P isn't always centered in the layout (David, 2026-10-10: "By painter" never re-centers P at
    // all, so a layout with gy0=1..4787 while P stays at [0,0] needs almost DOUBLE the naive half-extent to
    // reach its far edge -- halving Z from what a symmetric assumption would compute, same exact-2x gap the QA
    // bbox check below caught). Matches _qaBBoxFits()'s own corner math.
    const halfW = Math.max(Math.abs(lay.gx0 - P[0]), Math.abs(lay.gx0 + lay.GW - 1 - P[0])) + .7;
    const halfH = Math.max(Math.abs(lay.gy0 - P[1]), Math.abs(lay.gy0 + lay.GH - 1 - P[1])) + .7;
    const fits = zc => fzAt(zc, halfW) <= W / 2 && fzAt(zc, halfH) <= H / 2;
    if (fits(1)) return 1;   // already fits at the ordinary zoom (a small/sparse set) -- never force MORE zoom-out than that
    // fits(z) is true for SMALL z (zoomed out, content small on screen) and false for LARGE z (zoomed in,
    // content overflows) -- the opposite monotonicity from honey.js's own search() -- so the bisection here
    // grows `lo` (the largest z still known to fit) up toward the true/false boundary, not `hi` down to it.
    // a wildly elongated layout (By painter: thousands of painters each a short row, GW far smaller than GH)
    // can need a REALLY small z to fit its long axis. ZMIN_ABS used to be the search's hard starting floor, on
    // the assumption it was always low enough in practice -- the euro corpus expansion (23,778 -> 42,331
    // paintings, many more painters with few works each) broke that assumption: "By painter"'s GH grew past
    // 7,000 rows, which needs zc ~ .0013 to fit, BELOW ZMIN_ABS (.002), so the old `if (!fits(lo)) return lo`
    // silently settled for a zoom that still overflowed the view instead of searching lower. Now lo shrinks
    // (geometrically) until it actually fits, so the floor tracks whatever the real layout needs at any corpus
    // size, with only a true numerical floor (TRUE_FLOOR) to keep the loop finite -- that one is never expected
    // to be hit by real content, only to stop the halving if `base`/`fzAt` ever produced something degenerate.
    const TRUE_FLOOR = 1e-6;
    let lo = ZMIN_ABS, hi = 1;
    while (!fits(lo) && lo > TRUE_FLOOR) { hi = lo; lo /= 8; }
    if (!fits(lo)) return lo;   // even the smallest representable zoom can't fit this layout -- best we've got
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    return Math.min(1, lo);
  };
  // a gentle rubber band BELOW the floor (David, 2026-10-10, "keep a gentle rubber band below it") -- same shape
  // as js/honey.js's own rubber(): a power curve that lets an active pinch/wheel gesture overshoot past zMin()
  // a little rather than hard-stopping dead, but settle() (released touch, or the wheel's own idle timeout)
  // always glides back up to zMin() -- so it never STAYS past the floor, only visits it briefly while held.
  const rubberLo = (z, zmin) => z >= zmin ? z : Math.max(zmin * .55, zmin * Math.pow(Math.max(z, zmin * 1e-3) / zmin, .3));
  // David, 2026-10-09: "with only 4 results the layout floats tiny in the middle" -- fit the whole filtered set
  // to the view by default. Math.max(1, ...) is load-bearing: this ONLY ever zooms IN past the ordinary Z=1
  // default, never further out -- a dense set's own "fit" zoom comes out far below 1 (fitting a 124x192-cell
  // grid into one screen), and without the floor every open would start absurdly zoomed out instead of only the
  // genuinely sparse ones this was for.
  const fitZoomFor = l => {
    if (!l.GW || !l.GH || !base) return 1;
    const perUnit = Math.min(W / (l.GW + 1.4), H / (l.GH + 1.4));
    return clamp(Math.max(1, perUnit / base), zMin(), ZMAX);
  };
  function size() {
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    base = Math.max(34, Math.min(56, W / 9.5));
    kick();
  }
  // ---- what's in the middle
  const nearestK = (px, py) => {
    const cx = Math.round(px), cy = Math.round(py); let best = -1, bd = 1e9;
    for (let r = 0; r <= 6 && best < 0; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      const k = pmAt(lay, x, y); if (k < 0) continue; const d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  function setCenter(k) {
    if (k === centerK) return;
    centerK = k;
    const now = performance.now();
    if (k >= 0 && now - lastTick > 70 && touched) { lastTick = now; buzz(4); }
    caption();
  }
  let capTimer = 0;
  function caption() {
    if (centerK < 0 || !lay) { cap.hidden = true; facets.hidden = true; return; }
    const i = lay.items[centerK], a = F.artist[i], y = pmYearStr(i, F), by = [a ? xbArtistName(F, a) : "", y].filter(Boolean).join(" · ");
    cap.hidden = !cardOpen; facets.hidden = !cardOpen;
    const d = pmDetailNow(i, F);
    cap.querySelector("[data-pmct]").textContent = d ? d.t : " ";
    cap.querySelector("[data-pmcb]").textContent = by || (d && d.co) || "";
    cap.style.setProperty("--c", pmHex(i, F));
    paintHeart(i, d);
    if (!d && (!F.col || F.col === "paintings")) { clearTimeout(capTimer); capTimer = setTimeout(() => glDetail(i).then(() => { if (!dead && lay && lay.items[centerK] === i) caption(); }).catch(() => {}), 90); }
    PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z, cardOpen });
    paintFacets(i);
    facets.hidden = !cardOpen;   // paintFacets() always unhides itself when it (re)builds the chip row -- cardOpen has the final say
  }
  function showCard() { if (!cardOpen) { cardOpen = true; caption(); } }
  function hideCard() { if (cardOpen) { cardOpen = false; caption(); } }
  // "Walk from here" (David, 2026-10-09): step to the most similar painting by a DIFFERENT painter -- the point
  // is leaving your own painter's room each step, not drilling into one artist's own palette range -- excluding
  // anywhere the walk has already been too, so it can't loop back on itself. A cheap mean-color+chroma distance
  // (pmSimilarOrder's own first pass) over the current filtered list: fast enough for a one-off tap, and good
  // enough that "most similar" reads as true at a glance.
  function pmWalkCandidate(fromI, excludeSet) {
    const G = F.G, m = G.mean, q = fromI * 3, painter = F.artist[fromI];
    let best = -1, bd = Infinity;
    for (const j of pmList(s, F)) {
      if (j === fromI || excludeSet.has(j)) continue;
      if (painter && F.artist[j] === painter) continue;
      const a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2], e = G.C[j] - G.C[fromI];
      const d = a * a + b * b + c * c + e * e;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }
  function doWalk() {
    if (centerK < 0) return;
    const from = lay.items[centerK];
    if (!walk.length) walk = [from];
    const next = pmWalkCandidate(from, new Set(walk));
    if (next < 0) { toast("No different-painter match left to walk to", { low: true }); return; }
    buzz(8); walk.push(next); s.seed = next; s.arr = "spiral"; rebuild();
  }
  function paintWalk() {
    if (walk.length < 2) { walkBar.hidden = true; walkBar.innerHTML = ""; return; }
    walkBar.hidden = false;
    walkBar.innerHTML = `<button class="pmx-walk-x" data-pmwalkx aria-label="End the walk">${ICON.x}</button>${walk.map((i, k) => `<button class="pmx-walk-dot${k === walk.length - 1 ? " cur" : ""}" data-pmwalkto="${k}" style="--c:${pmHex(i, F)}" aria-label="Step ${k + 1} of the walk"></button>`).join("")}`;
    walkBar.querySelector("[data-pmwalkx]").onclick = () => { buzz(4); walk = []; paintWalk(); };
    walkBar.querySelectorAll("[data-pmwalkto]").forEach(b => b.onclick = () => {
      const k = +b.dataset.pmwalkto; if (k === walk.length - 1) return;
      buzz(5); walk = walk.slice(0, k + 1); s.seed = walk[k]; s.arr = "spiral"; rebuild();
    });
  }
  // the time scrubber (David, 2026-10-09): "paintings appear decade by decade." scrubTimer lives on pmMount
  // (not inside openSheet) so Play keeps running after the sheet closes -- the map itself is what's supposed to
  // visibly fill in, and scrubUpdateUI queries the DOM fresh each tick rather than holding a reference to any
  // one sheet instance, so it degrades to a no-op (not an error) whenever the sheet isn't open to show it.
  function scrubUpdateUI() {
    const inp = document.querySelector("[data-pmscrub]");
    const [lo, hi] = pmYearRange(F), cur = s.upToYear == null ? hi : s.upToYear;
    if (inp) inp.value = cur;
    const lab = document.querySelector("[data-pmscrublabel]");
    if (lab) lab.textContent = s.upToYear == null ? "Showing every year" : `Up to ${cur}${cur >= hi ? "" : " (undated paintings join at the end)"}`;
    const btn = document.querySelector("[data-pmscrubplay]");
    if (btn) { btn.classList.toggle("on", !!scrubTimer); btn.innerHTML = scrubTimer ? PM_ICON.pause : ICON.play; btn.setAttribute("aria-label", scrubTimer ? "Pause" : "Play"); }
  }
  function scrubStep() {
    const [lo, hi] = pmYearRange(F), cur = s.upToYear == null ? lo : s.upToYear;
    const next = cur + Math.max(5, Math.round((hi - lo) / 90));
    if (next >= hi) { s.upToYear = null; clearInterval(scrubTimer); scrubTimer = 0; } else s.upToYear = next;
    rebuild(); scrubUpdateUI();
  }
  function scrubPlay() {
    if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; scrubUpdateUI(); return; }
    const [lo, hi] = pmYearRange(F);
    if (s.upToYear == null || s.upToYear >= hi) s.upToYear = lo;
    rebuild(); scrubTimer = setInterval(scrubStep, 420); scrubUpdateUI();
  }
  // filter-by-example (David, 2026-10-09, the minimalist pass): up to 3 fixed "only this" chips (Same painter/
  // decade/place), Open, Arrange around this, and Walk from here.
  // David, 2026-10-10: a tap no longer seeds/rebuilds (it's a plain fly-to now -- see tap()'s own comment), so
  // "arrange the neighbors around this painting" needed its own explicit chip instead of riding along for free.
  function paintFacets(i) {
    const fs = pmFacetsOf(i, F);
    facets.hidden = false;
    facets.innerHTML = `${fs.map((fc, k) => `<button class="pmx-fchip" data-pmfacet="${k}">${esc(fc.label)}</button>`).join("")}<button class="pmx-fchip pmx-fchip-open" data-pmopen2>Open</button><button class="pmx-fchip pmx-fchip-arrange" data-pmarrange-go>Arrange around this</button><button class="pmx-fchip pmx-fchip-walk" data-pmwalk-go>Walk from here</button>`;
    facets.querySelector("[data-pmopen2]").onclick = () => openK(centerK);
    facets.querySelector("[data-pmarrange-go]").onclick = () => arrangeAround(i);
    facets.querySelector("[data-pmwalk-go]").onclick = () => doWalk();
    facets.querySelectorAll("[data-pmfacet]").forEach(b => b.onclick = () => {
      const fc = fs[+b.dataset.pmfacet]; buzz(6); pmFacetApply(s.f, fc.dim, fc.val); rebuild();
    });
    paintWalk();
  }
  function paintHeart(i, d) {
    const on = !!(d && pmFavHas(d.id, F));
    heart.hidden = !d;
    heart.classList.toggle("on", on); heart.setAttribute("aria-pressed", on);
    heart.setAttribute("aria-label", on ? "Remove from your favorites" : "Add to your favorites");
    heart.innerHTML = on ? FVA_HEART_ON : FVA_HEART;
  }
  function toggleHeart(only) {
    if (centerK < 0) return;
    const i = lay.items[centerK], d = pmDetailNow(i, F); if (!d) return;
    const on = !pmFavHas(d.id, F); if (only && !on) { buzz(6); return; }
    pmFavSet(i, d, on, F); buzz(on ? 10 : 4); paintHeart(i, d);
    heart.classList.remove("pop"); void heart.offsetWidth; if (on) heart.classList.add("pop");
    // low: this heart sits in the map's own corner bar, not the fixed top bar, but a top toast would still cover
    // it the same way (David, 2026-10-09)
    if (on) toast("In your favorites", { action: "See them", onAction: () => { if (!F.col || F.col === "paintings") { S.fvCat = "paintings"; save(); } XSTACK.push("favs"); favShelf(); }, low: true, ms: 3000 });
  }
  // ---- drawing
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  let touched = false, clock = 0, lastNow = 0, frameDt = 16;
  // the map's own clock: every frame moves it at least 8 ms (and at most 40), so a glide, a flick or a fade always
  // ends after a bounded number of frames, even where the wall clock stalls (a background tab, a headless test run)
  function frame() {
    const now = performance.now(); frameDt = lastNow ? clamp(now - lastNow, 8, 40) : 16; lastNow = now; clock += frameDt;
    const t = clock;
    raf = 0; if (dead || !lay || !W) return;
    let moving = false;
    if (glide) {
      const u = Math.min(1, (t - glide.t0) / glide.dur), e = RM ? 1 : 1 - Math.pow(1 - u, 3);
      P[0] = glide.a[0] + (glide.b[0] - glide.a[0]) * e; P[1] = glide.a[1] + (glide.b[1] - glide.a[1]) * e;
      if (glide.z) Z = glide.z[0] + (glide.z[1] - glide.z[0]) * e;
      if (u >= 1) glide = null; moving = true;
    } else if (!drag && (Math.abs(V[0]) > 1e-4 || Math.abs(V[1]) > 1e-4)) {
      const dt = frameDt; P[0] -= V[0] * dt; P[1] -= V[1] * dt;
      const k = Math.exp(-dt / 300); V[0] *= k; V[1] *= k; moving = true;
      if (Math.hypot(V[0], V[1]) < .0006) { V = [0, 0]; settle(); }
      clampPan();
    }
    draw(t);
    if (moving || fading || (pulseI >= 0 && t - pulseT0 < PULSE_MS)) kick();
  }
  let fading = false;
  function clampPan() {   // the finite map springs back inside its own edges
    const pad = 1;
    P[0] = clamp(P[0], lay.gx0 - pad, lay.gx0 + lay.GW - 1 + pad); P[1] = clamp(P[1], lay.gy0 - pad, lay.gy0 + lay.GH - 1 + pad);
  }
  function draw(t) {
    lensAt();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0E0D0B"; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Finv(Math.hypot(W, H) / 2 + 40), k0 = K();
    const map = (ex, ey) => { const z = Math.hypot(ex, ey), f = z < 1e-6 ? K() * M0 : Fz(z) / z; return [cx + ex * f, cy + ey * f]; };
    const x0 = Math.floor(P[0] - R), x1 = Math.ceil(P[0] + R), y0 = Math.floor(P[1] - R), y1 = Math.ceil(P[1] + R);
    // David, 2026-10-09: "your favorites glowing on the map" -- one Set built once a frame (fvArtList's own
    // {i,...} records already carry the gallery index), not a per-cell favorites lookup.
    const favSet = new Set(pmFavList(F).map(r => r.i));
    drawn = []; const wantImg = [], wantT1 = new Set();
    for (let y = Math.max(y0, lay.gy0); y <= Math.min(y1, lay.gy0 + lay.GH - 1); y++) {
      const row = (y - lay.gy0) * lay.GW;
      for (let x = Math.max(x0, lay.gx0); x <= Math.min(x1, lay.gx0 + lay.GW - 1); x++) {
        const k = lay.grid[row + x - lay.gx0]; if (k < 0) continue;
        const ex = x - P[0], ey = y - P[1], z = Math.hypot(ex, ey); if (z > R) continue;
        const [sx, sy] = map(ex, ey);
        // as big as its neighbors' places allow: the screen distance to the cell beside it and the one above or below
        // (the lens squeezes the two directions differently away from the middle), so the seams stay even
        const r = map(ex + 1, ey), l = map(ex - 1, ey), dn = map(ex, ey + 1), u = map(ex, ey - 1);
        // a tile fills its own place: halfway to each neighbor on every side (the lens pushes the near side farther away
        // than the far one), less an even seam, and never more oblong than 3:2
        const x0 = (l[0] + sx) / 2, x1 = (sx + r[0]) / 2, y0 = (u[1] + sy) / 2, y1 = (sy + dn[1]) / 2;
        let tw = x1 - x0, th = y1 - y0;
        // David, 2026-10-10 (zoomed all the way out to fit a ~23,778-painting layout): the flat ~1px seam below
        // used to eat the ENTIRE cell once cells shrank to a couple of px (a tiny cell minus a ~1px gap rounds
        // to nothing, so it got culled by the `d < 1.2` check right below -- most of a huge layout vanished at
        // its own fit-everything zoom instead of reading as the dense mosaic of tiny real colors tier 0 is
        // FOR). Capping the gap at a FRACTION of the cell's own size (never more than 15% of it) leaves a
        // visible seam at ordinary sizes exactly as before (15% only binds below ~10px, where the old flat
        // formula was already smaller than that) while guaranteeing a sub-10px cell still has real area left.
        const gap = Math.min(6, Math.min(tw, th) * .15, 1 + Math.min(tw, th) * .05);
        tw = Math.min(tw, th * 1.5) - gap; th = Math.min(th, (x1 - x0) * 1.5) - gap;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.max(tw, th);
        if (d < .6 || mx < -d || my < -d || mx > W + d || my > H + d) continue;
        const i = lay.items[k];
        const m = Math.exp(-((z / .5) ** 2));
        let w = tw, h = th;
        if (m > .02) {
          const ar = F.G.ar[i], B = d * (1 + .4 * m), cw = ar > 1 ? B / ar : B, ch = ar > 1 ? B : B * ar;
          w = tw + (cw - tw) * m; h = th + (ch - th) * m;
        }
        drawn.push({ k, i, x: mx, y: my, d, z, m, w, h });
      }
    }
    // David, 2026-10-09: reverted the spatial-hash anti-overlap clamp that used to live here. It genuinely
    // stopped cells from intersecting, but it did that by shrinking them away from their natural size whenever a
    // neighbor was close -- which reads as cells sitting too far apart, not as a fix. The original map (before
    // today's redesign) never clamped this at all: the near-center magnification above is allowed to overlap its
    // neighbors slightly, same as it always did -- "the overlap wasn't a problem if it was subtle."
    drawn.sort((a, b) => a.d - b.d);
    fading = false;
    // landmark labels and the <img> overlay are both collected here and placed/synced in a SEPARATE pass once
    // every cell is drawn (David, 2026-10-09: drawing either inline here let a later, bigger tile painted on top
    // blot out or clip an earlier cell's label/overlay -- drawn is sorted smallest-d-first specifically so
    // bigger/closer cells paint OVER smaller/farther ones, backwards for something that has to survive the pass)
    const landmarkCandidates = [];
    // David, 2026-10-09 ("zoom out and back in and the pictures start to jitter in place"): two causes, both
    // fixed here rather than chasing a single repro. (1) snap every tile's drawn rect to whole DEVICE pixels --
    // X/Y/W/H are continuous floats re-derived from P/Z every frame, and even when P/Z are themselves holding
    // perfectly still, antialiasing a rect whose edge sits a hair either side of a pixel boundary can render
    // a touch differently frame to frame (sub-pixel rounding "noise" that was never actually in the math, only
    // in how the rasterizer treats it) -- rounding the rect's edges to the nearest device pixel (snapPx) makes
    // every cell's rect bit-for-bit identical across frames when nothing is actually moving. (2) hysteresis on
    // which image source a cell draws from: "big" (the full picture, live-cropped every frame from e.src) and
    // the baked square (e.bm, a fixed 144x144 canvas) are NOT pixel-identical crops of the same photo, so a
    // cell sitting right at the old single b.d>92-or-m>.02 boundary used to flip between the two sources on
    // alternating frames as P/Z wobbled by a sub-pixel amount -- each flip is a real, visible jump in exactly
    // which pixels are drawn, which is what actually read as "jitter". closeScore combines both the size (d)
    // and lens-magnification (m) signals the original condition OR'd together into one normalized number (>=1
    // means "qualifies"); hysteresis() requires dropping notably BELOW 1 (not just under it) to disqualify
    // again, so a cell parked right on the boundary keeps showing whichever source it already committed to
    // instead of flapping every frame.
    const snapPx = v => Math.round(v * dpr) / dpr;
    const hysteresis = (e, key, score, off) => { const was = !!e[key]; const on = was ? score >= off : score >= 1; e[key] = on; return on; };
    for (const b of drawn) {
      const i = b.i, e = imgs.get(i), w0 = b.w, h0 = b.h, m = b.m;
      const X0 = b.x - w0 / 2, Y0 = b.y - h0 / 2;
      // snap the rect's two edges independently, then derive w/h -- keeps neighboring cells seamless (each
      // shared edge snaps to the same device pixel from both sides) instead of snapping a center + a width,
      // which can leave a 1px seam or overlap between a cell and the neighbor it's supposed to touch
      const X = snapPx(X0), Y = snapPx(Y0), w = snapPx(X0 + w0) - X, h = snapPx(Y0 + h0) - Y;
      if (m > .3) { ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8; ctx.fillStyle = pmHex(i, F); ctx.fillRect(X, Y, w, h); ctx.restore(); }
      else { ctx.fillStyle = pmHex(i, F); ctx.fillRect(X, Y, w, h); }
      // tier 0: the one shared atlas sheet, drawn for EVERY cell the instant it's loaded -- no per-cell request,
      // so the whole archive shows its real tiny colors/shapes from the first frame the sheet lands, not just
      // whichever few hundred cells have individually streamed in by then. The base picture layer every other
      // tier below crossfades on top of (drawImage over drawImage, alpha<1 blends with what's already there).
      // David, 2026-10-10 (euro corpus expansion): the atlas manifest only ever covers however many paintings it
      // was BUILT for (atlas.man.n) -- the shelf-packer, scale assumptions, and the search above are all always
      // run against the FULL current corpus, so a painting added after the atlas was last built (i >= man.n)
      // has a real cell here but no real tile in any sheet. pmT0Rect/pmT1Rect are pure modular arithmetic with
      // no bounds check of their own: for such an i they'd silently ALIAS onto some other, unrelated painting's
      // tile (wrap around the same sheet grid) rather than erroring -- a wrong sprite, not a missing one. Gate
      // both tiers on `i < atlas.man.n` so a too-new painting always falls through to the flat color swatch
      // (already drawn above) and tier 2's own per-painting loader (by real index, unaffected by this) instead.
      // David, 2026-10-10 (the tier-0/tier-1 desync fix): a painting whose build-time fetch failed is left out of
      // both sheet tiers (tier0_from_tier1() in tools/paintmap_atlas.py records it in manifest.missing rather
      // than drawing a blank or stale cell) -- treated exactly like "too new for this atlas" (i >= man.n) below:
      // fall through to the flat color swatch and tier 2's own per-painting loader, never a wrong/blank sprite.
      const inAtlas = atlas && atlas.man && i < atlas.man.n && !(atlas.missing && atlas.missing.has(i));
      if (inAtlas && atlas.bm0s) {
        const ts0 = pmTState(tierH, i), r0 = pmT0Rect(atlas.man, i), bm0 = atlas.bm0s[r0.sheet];
        const a0 = pmFadeAlpha(ts0, "f0", t, 220, RM); if (a0 < 1) fading = true;
        if (bm0) { ctx.globalAlpha = a0; ctx.drawImage(bm0, r0.x, r0.y, r0.s, r0.s, X, Y, w, h); ctx.globalAlpha = 1; }
      }
      // tier 1: a mid-size tile from its group's sheet (manifest.tier1.groupSize paintings share one sheet, one
      // request each, cached) once the cell reads as more than a speck -- replaces tier 0 by drawing over it.
      // hysteresis() (defined above for tier 2's own big/baked-square switch) keeps a cell parked near the
      // PM_T1_MIN boundary from flapping between tier 0 and tier 1 the same way it does for tier 2 below.
      if (inAtlas) {
        const ts1 = pmTState(tierH, i), g = pmT1Group(atlas.man, i);
        if (hysteresis(ts1, "t1On", b.d / PM_T1_MIN, .75)) {
          wantT1.add(g);
          const te = t1.get(g);
          if (te && te.st === 1) {
            const r1 = pmT1Rect(atlas.man, i);
            const a1 = pmFadeAlpha(ts1, "f1", t, 220, RM); if (a1 < 1) fading = true;
            ctx.globalAlpha = a1;
            const q = r1.s, sw = w >= h ? q : q * w / h, sh = h >= w ? q : q * h / w;
            ctx.drawImage(te.bm, r1.x + (q - sw) / 2, r1.y + (q - sh) / 2, sw, sh, X, Y, w, h);
            ctx.globalAlpha = 1;
          }
        }
      }
      // tier 2: the existing per-painting thumbnail/hi-res loader (pmImages above) -- now only for the few cells
      // actually big enough to show more than tier 1 already does (b.d >= PM_T2_MIN, used to start at a few px
      // and stream in every cell that ever scrolled by, which was the original "waterfall of thousands of
      // requests" this whole tiered system replaces). Drawn exactly as before, over tiers 0/1.
      if (b.d >= PM_T2_MIN) wantImg.push([i, b.d > 92 || m > .3]);
      if (e && e.st === 1 && b.d >= PM_T2_MIN) {
        if (e.fadeT == null) e.fadeT = t;
        const age = t - e.fadeT, a = RM ? 1 : Math.min(1, age / 260); if (a < 1) fading = true;
        ctx.globalAlpha = a;
        // the original condition was (b.d > 92 || m > .02); normalize each side of the OR to 1.0 at its own
        // boundary so a single hysteresis() call can gate both at once, with a shared ~25% dead zone below 1
        const closeScore = Math.max(b.d / 92, m / .02);
        const qualifies = hysteresis(e, "closeOn", closeScore, .75);
        const big = qualifies && imgs.big(i);
        if (big) {   // from the full picture: crop (frame away), then cover the tile's own shape
          const sr = e.src, ta = h / w; let sw = sr.sw, sh = sr.sh;
          if (sh / sw > ta) sh = sw * ta; else sw = sh / ta;
          ctx.drawImage(big, sr.sx + (sr.sw - sw) / 2, sr.sy + (sr.sh - sh) / 2, sw, sh, X, Y, w, h);
        } else if (qualifies) {   // still only the baked square: show it as the square crop at the middle size
          const s = Math.max(w, h); ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, h); ctx.clip(); ctx.drawImage(e.bm, b.x - s / 2, b.y - s / 2, s, s); ctx.restore();
        } else {   // the baked square, cover-cropped to the tile's shape
          const q = PM_BAKE, sw = w >= h ? q : q * w / h, sh = h >= w ? q : q * h / w;
          ctx.drawImage(e.bm, (q - sw) / 2, (q - sh) / 2, sw, sh, X, Y, w, h);
        }
        ctx.globalAlpha = 1;
      }
      if (b.d >= 40 && F.G.mean[i * 3] < 24) { ctx.strokeStyle = "rgba(236,232,223,.14)"; ctx.lineWidth = 1; ctx.strokeRect(X + .5, Y + .5, w - 1, h - 1); }
      // your favorites glow (the same pink the heart icon turns "on"), kept subtle: a thin ring, not a halo
      // David, 2026-10-10: "I don't like favorite paintings outlined in pink on the map" -- off; favorites still filter/sort
      if (false && favSet && favSet.size && b.d >= 7 && favSet.has(i)) {
        ctx.save(); const lw = Math.max(1.25, Math.min(2, b.d * .018));
        ctx.strokeStyle = "rgba(232,120,122,.85)"; ctx.lineWidth = lw;
        ctx.strokeRect(X + lw / 2, Y + lw / 2, w - lw, h - lw);
        ctx.restore();
      }
      // the entry-point highlight (David, 2026-10-09, "I don't even see the painting that brought me there"): a
      // soft ring that breathes once and fades, so the painting an entry point pinned the view to reads as "you're
      // here", not a silent jump cut. Reduced motion gets a brief steady ring instead of the breathing scale.
      if (pulseI >= 0 && i === pulseI) {
        const age = t - pulseT0;
        if (age >= PULSE_MS) pulseI = -1;
        else {
          const u = age / PULSE_MS, alpha = (1 - u) * .85;
          const breathe = RM ? 1 : 1 + Math.sin(u * Math.PI * 2.4) * (1 - u) * .4;
          const pad = Math.max(3, b.d * .05) * breathe;
          ctx.save();
          ctx.strokeStyle = `rgba(236,232,223,${alpha.toFixed(3)})`;
          ctx.lineWidth = Math.max(1.5, Math.min(3, b.d * .025));
          ctx.strokeRect(X - pad, Y - pad, w + pad * 2, h + pad * 2);
          ctx.restore();
        }
      }
      // always-labeled landmarks: a painter name, collected here, placed after the loop (see comment above)
      if (PM_LANDMARKS_ON && b.d >= 24 && PM_LANDMARKS.size && PM_LANDMARKS.has(i)) {
        const nm = F.artist[i] ? xbArtistName(F, F.artist[i]) : "";
        if (nm) landmarkCandidates.push({ x: b.x, y: Y + h + 4, d: b.d, text: nm });
      }
    }
    // landmark labels: a real sans font (not the mono the count-labels use), truncated with an ellipsis rather
    // than clipped, clamped inside the canvas width, and skipped (not stacked) when it would collide with an
    // already-placed one -- fewer, cleaner labels, biggest cells (most confidently legible) win a collision.
    if (landmarkCandidates.length) {
      landmarkCandidates.sort((a, b) => b.d - a.d);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const placed = [];
      for (const c of landmarkCandidates) {
        if (placed.length >= 14) break;
        const fs = Math.max(11, Math.min(14, c.d * .14));
        ctx.font = `500 ${fs}px "Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif`;
        let txt = c.text, tw2 = ctx.measureText(txt).width;
        const maxW = Math.min(140, W - 16);
        if (tw2 > maxW) { while (txt.length > 2 && ctx.measureText(txt + "…").width > maxW) txt = txt.slice(0, -1); txt += "…"; tw2 = ctx.measureText(txt).width; }
        const px = Math.min(W - 6 - tw2 / 2, Math.max(6 + tw2 / 2, c.x));
        const rx0 = px - tw2 / 2 - 6, rx1 = px + tw2 / 2 + 6, ry0 = c.y - 2, ry1 = c.y + fs + 4;
        if (ry1 < -8 || ry0 > H + 8) continue;
        if (placed.some(p => rx0 < p.rx1 && rx1 > p.rx0 && ry0 < p.ry1 && ry1 > p.ry0)) continue;
        placed.push({ rx0, rx1, ry0, ry1 });
        ctx.fillStyle = "rgba(14,13,11,.8)"; ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        ctx.fillStyle = "rgba(236,232,223,.96)"; ctx.fillText(txt, px, c.y);
      }
    }
    // band and painter labels, where there's room to read them
    if (lay.labels.length) {
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      for (const L of lay.labels) {
        const ex = L.x - .45 - P[0], ey = L.y + .3 - P[1], z = Math.hypot(ex, ey); if (z > R) continue;
        const f = z < 1e-6 ? 0 : Fz(z) / z, sx = cx + ex * f, sy = cy + ey * f, cell = k0 * Math.min(magR(z), tanR(z));
        if (cell < 15 || sx > W || sy < -20 || sy > H + 20) continue;
        const room = cell * (L.w + .6) - 4; if (room < 34) continue;
        const fs = Math.min(22, Math.max(13, cell * .42));
        ctx.font = `400 ${fs}px "Instrument Serif", Georgia, serif`;
        let txt = L.text;
        if (ctx.measureText(txt).width > room) { while (txt.length > 2 && ctx.measureText(txt + "…").width > room) txt = txt.slice(0, -1); txt += "…"; }
        ctx.fillStyle = "rgba(236,232,223,.92)"; ctx.fillText(txt, sx, sy);
        const tw = ctx.measureText(txt).width;
        if (room - tw > 40) { ctx.font = `500 ${Math.max(11, fs * .55)}px "Geist Mono", Menlo, monospace`; ctx.fillStyle = "rgba(163,158,146,.9)"; ctx.fillText(L.n.toLocaleString(), sx + tw + 8, sy); }
      }
    }
    // David, 2026-10-09: "zooming out doesn't load the stuff" -- this cap used to be 160, which silently excluded
    // every cell beyond the nearest ~160 from ever being requested at all, however long you waited: want()'s own
    // PM_FLIGHT (14 concurrent) and PM_CACHE_MAX (650) already bound real network/memory use, so the extra slice
    // here was only ever throttling visibility, not cost. 2000 is comfortably above what a phone screen can hold
    // at the 14px threshold above (zMin() also caps how far you can zoom out), so every on-screen eligible cell
    // now gets a turn in the queue, nearest the middle first, same as before.
    imgs.want(wantImg.reverse().slice(0, 2000));
    if (atlas) t1.want(wantT1);   // a handful of groups at most -- every cell on screen shares one of a few dozen sheets

    const c = nearestK(P[0], P[1]); setCenter(c);
  }
  // ---- gestures: drag to pan (the middle follows the thumb), pinch or wheel to zoom, flick to glide, a tap opens or brings
  const pts = new Map(); let drag = null, pinch = null, press = null;
  const toPlane = (dx, dy) => [dx / (K() * M0), dy / (K() * M0)];
  function settle() {
    const k = nearestK(P[0], P[1]); if (k < 0) return;
    glideTo([lay.x[k], lay.y[k]], 260, Z < zMin() ? zMin() : undefined);   // spring back up out of the rubber band
  }
  function glideTo(b, dur = 340, z) { glide = { a: P.slice(), b, t0: clock, dur, z: z ? [Z, z] : null }; V = [0, 0]; kick(); }
  cv.addEventListener("pointerdown", e => {
    touched = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    glide = null; V = [0, 0];
    if (pts.size === 1) {
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, hist: [[performance.now(), e.clientX, e.clientY]] };
      press = setTimeout(() => {   // a long press on the middle painting keeps it in your favorites
        press = null; if (!drag || drag.moved) return;
        const hit = hitAt(e.clientX, e.clientY);
        if (hit && hit.k === centerK) { drag.held = true; bloomAt(e.clientX, e.clientY); toggleHeart(true); }
      }, 480);
    } else if (pts.size === 2) {
      clearTimeout(press); press = null;
      const [a, b] = [...pts.values()]; pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: Z }; if (drag) drag.moved = true;
      hideCard();
    }
  });
  cv.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      Z = Math.min(ZMAX, rubberLo(pinch.z0 * d / Math.max(10, pinch.d0), zMin())); kick(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    if (!drag.moved) { drag.moved = true; clearTimeout(press); press = null; hideCard(); }
    const [u, v] = toPlane(dx, dy); P[0] -= u; P[1] -= v; clampPan();
    drag.x = e.clientX; drag.y = e.clientY;
    const now = performance.now(); drag.hist.push([now, e.clientX, e.clientY]); while (drag.hist.length > 2 && now - drag.hist[0][0] > 90) drag.hist.shift();
    kick();
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    clearTimeout(press); press = null;
    if (pinch) { if (pts.size < 2) { pinch = null; drag = null; if (!pts.size) settle(); } return; }
    const d = drag; drag = null; if (!d) return;
    if (d.held) return;
    if (!d.moved && e.type === "pointerup") return tap(e.clientX, e.clientY);
    const h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]);
    if (b[0] - a[0] > 0 && performance.now() - b[0] < 80) { const [u, v] = toPlane(b[1] - a[1], b[2] - a[2]); V = [u / dt, v / dt]; }
    if (Math.hypot(V[0], V[1]) < .0006) { V = [0, 0]; settle(); }
    kick();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", e => { e.preventDefault(); touched = true; Z = Math.min(ZMAX, rubberLo(Z * Math.exp(-e.deltaY * .0015), zMin())); kick(); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 180); }, { passive: false });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  function hitAt(x, y) {
    const r = cv.getBoundingClientRect(), px = x - r.left, py = y - r.top;
    for (let j = drawn.length - 1; j >= 0; j--) { const b = drawn[j]; if (Math.abs(px - b.x) <= b.w / 2 && Math.abs(py - b.y) <= b.h / 2) return b; }
    return null;
  }
  function bloomAt(x, y) {
    const bl = document.createElement("i"); bl.className = "fva-bloom pmx-bloom"; bl.innerHTML = FVA_HEART_ON;
    bl.style.left = x + "px"; bl.style.top = y + "px"; el.appendChild(bl); setTimeout(() => bl.remove(), 900);
  }
  // double-tap the centered painting to like it (Instagram-style, David 2026-10-09): opening it is delayed the
  // same ~280ms js/gallery.js and js/swatch.js use, so a quick second tap can be caught first and turned into
  // the heart burst + toggle instead of opening the page
  let lastTapAt = 0, tapTimer = 0;
  function tap(x, y) {
    const b = hitAt(x, y); if (!b) { hideCard(); return; }   // tap-away: empty space closes whatever's open
    if (b.k === centerK && b.z < .6) {
      showCard();   // a tap always shows the name, even on the already-centered painting about to open
      const now = performance.now();
      if (now - lastTapAt < 300) {
        clearTimeout(tapTimer); tapTimer = 0; lastTapAt = 0;
        bloomAt(x, y); toggleHeart(true);   // double-tap only adds, like the long press just above — never un-hearts
        if (typeof sfxColor === "function") sfxColor(pmHex(b.k, F));
        return;
      }
      lastTapAt = now;
      tapTimer = setTimeout(() => { lastTapAt = 0; if (!dead) openK(b.k); }, 280);
      return;
    }
    buzz(5);
    // David, 2026-10-10, twice: first "tapping a picture switches the map from Rings to Spiral" (fixed by
    // re-centering WITHIN the current arrangement instead of forcing Spiral), then "why does tapping change the
    // view so radically instead of just zooming into that area?" -- the re-center-by-reseeding itself was still
    // too much: a tap re-lays-out every neighbor around the tapped painting, which reads as the view changing
    // wholesale even when the arrangement name stays the same. A tap is just a fly-to now: zoom/pan to the
    // tapped painting wherever it ALREADY sits in the current layout (nothing re-seeds, nothing rebuilds) and
    // open its card. Actually re-arranging neighbors around a painting is its own explicit action on the card
    // now (arrangeAround(), wired to the "Arrange around this" chip in paintFacets() below).
    showCard(); glideTo([lay.x[b.k], lay.y[b.k]], 350, Math.max(Z, PM_TAP_ZOOM));
  }
  // the card's explicit "Arrange around this" (David, 2026-10-10) -- what tapping a painting USED to do by
  // itself: seed Rings/Spiral on it (staying in whichever of the two is already active, or defaulting to
  // Spiral from an unseeded arrangement) and rebuild every neighbor around it. A deliberate action now, not a
  // side effect of just looking at a painting.
  function arrangeAround(i) {
    buzz(8); s.seed = i; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "spiral"; rebuild();
  }
  function openK(k) {
    const i = lay.items[k];
    PM_PAN.set(lay.key, { x: lay.x[k], y: lay.y[k], s: Z, cardOpen: true });
    buzz(8);
    // David, 2026-10-10: Design objects and Photography are already fully loaded, whole nodes -- their own
    // page opener takes the node (or id) directly, no gallery index to resolve. Paintings keep the exact path
    // they always had, including carrying a whole color SET (?c=hex1,hex2…, from a pair/set page's "as a map"
    // link) onto the painting, not just the first one (David, 2026-10-08).
    if (F.col === "design" && typeof doOpenObject === "function") return doOpenObject(F.nodes[i].id);
    if (F.col === "photography" && typeof paintingPage === "function") return paintingPage(F.nodes[i]);
    galleryPage(i, true, s.f.hexes.length > 1 ? s.f.hexes : (s.f.hexes[0] || null), s.f.hexes.length ? s.f.tol : null);
  }
  el.querySelector("[data-pmopen]").onclick = () => { if (centerK >= 0) openK(centerK); };
  heart.onclick = () => toggleHeart(false);

  // ---- the chrome: back, the static title, one settings button; a removable chip for every active filter
  function chrome() {
    paintChipbar();
  }
  // removable active-filter chips atop the map (David, 2026-10-09): the primary way to SEE and UNDO a filter,
  // whichever way it got set (the Filter tab, or a tap on a painting's own facet) -- opening the sheet is no
  // longer required just to clear one thing.
  function paintChipbar() {
    const chips = pmActiveChips(s, F);
    chipbar.hidden = !chips.length;
    if (!chips.length) return;
    chipbar.innerHTML = chips.map((c, k) => `<button class="pmx-xchip" data-pmxclear="${k}">${esc(c.text)}<i>${ICON.x}</i></button>`).join("");
    chipbar.querySelectorAll("[data-pmxclear]").forEach(b => b.onclick = () => {
      const c = chips[+b.dataset.pmxclear]; buzz(5);
      if (c.dim === "fav") s.fav = 0; else pmChipClear(s.f, c.dim);
      rebuild();
    });
  }
  function build(keepPan) {
    const t0 = performance.now();
    lay = pmLayout(s, F); PM_NOW = { s, lay };
    wait.hidden = !!lay.n;
    if (!lay.n) wait.innerHTML = `Nothing matches all of that. <button class="wl" data-pmloosen>Clear the filters</button>`;
    const lz = wait.querySelector("[data-pmloosen]"); if (lz) lz.onclick = () => { s.f = pmFilterFresh(); s.fav = 0; rebuild(); };
    // David, 2026-10-09 ("Show it on the map opens at a different section, so I don't even see the painting that
    // brought me there"): caption() (below) keeps PM_PAN.set(lay.key, ...) up to date on EVERY center change,
    // including a plain pan with nothing opened -- so a seeded arrangement's remembered pan isn't "where you left
    // off reading", it's just "wherever you last panned to", and a SECOND visit to the exact same seeded spec
    // (tapping "Show it on the map" from the same painting's page again, or from a different painting that
    // resolves to an already-visited seed) silently overrode the one thing the entry point promised: that painting,
    // centered. A seed is an anchor, not a bookmark -- always trust it over any remembered pan. This never costs
    // the original "Back lands where you were" case PM_PAN exists for: the only way to open something other than
    // the seed is to tap it (which re-seeds onto it first, per tap()'s off-center branch), so by the time anything
    // opens, the seed already equals whatever's centered -- PM_PAN and lay.start agree. Unseeded arrangements
    // (color/time/painter, no single anchor) still use PM_PAN as before, so a big dense browse resumes correctly.
    const pinned = PM_NEEDS_SEED.has(s.arr) && s.seed >= 0;
    const mem = pinned ? null : PM_PAN.get(lay.key);
    if (mem && !keepPan) { P = [mem.x, mem.y]; Z = mem.s; }
    else if (!keepPan) { P = lay.start.slice(); Z = fitZoomFor(lay); const k = nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; }
    if (keepPan) { const k = nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; }
    Z = clamp(Z, zMin(), ZMAX);
    // the card itself (David, 2026-10-09): opens for a reason -- a seed just pinned the view to one painting
    // (a tap, Walk, a Center-on preset, a fresh entry point) -- and stays closed for a plain dense browse, same
    // as switching Arrange to Color/Time/Painter should clear whatever was open rather than leave it stranded.
    // David, 2026-10-10: "Back should restore the exact prior view... the card state" too -- an unseeded
    // arrangement's remembered pan (mem) now also remembers whether the card was open, so leaving a painting's
    // card open, opening a painting, then Back, lands back with that same card open (not silently closed just
    // because this arrangement has no single seed to open it reflexively like Rings/Spiral do).
    if (!keepPan) cardOpen = mem ? !!mem.cardOpen : pinned;
    centerK = -1; drawn = []; setCenter(lay.n ? nearestK(P[0], P[1]) : -1); chrome(); kick();
    // a brief highlight on the painting an entry point promised, so it reads as "you're here", not just a jump cut
    if (pinned && !keepPan && centerK >= 0) { pulseI = lay.items[centerK]; pulseT0 = clock; }
    if (window.PM_DEBUG) console.log("paintmap layout", s.arr, lay.n, Math.round(performance.now() - t0) + "ms");
  }
  function rebuild() {
    // the address follows (replace: a filter change is the same map, not a new page)
    try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
    build(false);
  }
  // ---- the corner and the title both open one compact, non-modal Arrange|Filter sheet (David, 2026-10-09: the
  // same Arrange+Filter parity the color map's chooser() has -- shapes/sort/place-by/center-on, live-applied,
  // no separate confirm step). Replaces the old radial stem menu and the standalone Filter-only sheet.
  const doBtn = el.querySelector(".pmx-do"); doBtn._html = doBtn.innerHTML;
  doBtn.onclick = () => openSheet("arrange");
  function openSheet(startTab) {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;   // a ghost click right after closing must not reopen it (js/core.js)
    let tab = startTab === "filter" ? "filter" : "arrange";
    let fopen = { co: false, painter: false, mv: false, mus: false }, fq = "", coq = "";
    const tabsHTML = `<div class="hm-ch-tabs pmx-tabs" role="tablist" aria-label="Arrange or filter the painting map">
        <button class="hm-ch-tab" data-tab="arrange" role="tab">Arrange</button>
        <button class="hm-ch-tab" data-tab="filter" role="tab">Filter</button>
      </div>`;
    // David, 2026-10-09: the "switch to the color map" icon here is retired -- the top-center Colors|Paintings
    // switch (hmWireLayerSwitch, wired in pmOpen) is the one way to move between layers now, not a second one
    // tucked inside this sheet too.
    const head = `<div class="hm-ch-head" data-sheet-grab>${tabsHTML}
        <button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>`;
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser" data-tab="${tab}">${head}
        <div class="hm-ch-scroll" data-pane="arrange" data-sheet-scroll></div>
        <div class="hm-ch-scroll" data-pane="filter" data-sheet-scroll><div data-pmbody></div></div>
      </div>`, { lock: false });
    // the color map's own compact, non-modal panel sizing (css/home.css .hm-sheet-panel: height min(40dvh,400px),
    // the map stays interactive underneath) -- the same bar this sheet is matching, not new CSS of its own.
    // .hm-sheet-arrange additionally goes height:auto there (the Arrange tab's content decides it); toggled to
    // match whichever tab is actually showing, same as home.js's own chooser() does on a tab switch.
    sh.classList.add("pmx-sheet", "hm-sheet-panel");
    sh.classList.toggle("hm-sheet-arrange", tab === "arrange");
    sh.setAttribute("aria-label", "Arrange or filter the painting map");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    const q$ = sel => sh.querySelector(sel), qa$ = sel => [...sh.querySelectorAll(sel)];
    const paneArr = q$('[data-pane="arrange"]'), paneFilt = q$('[data-pane="filter"]');
    const syncTab = () => {
      paneArr.hidden = tab !== "arrange"; paneFilt.hidden = tab !== "filter";
      qa$(".hm-ch-tab").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      sh.dataset.tab = tab;
      sh.classList.toggle("hm-sheet-arrange", tab === "arrange");
    };
    syncTab();
    qa$(".hm-ch-tab").forEach(b => b.onclick = () => { if (b.dataset.tab === tab) return; buzz(4); tab = b.dataset.tab; syncTab(); });
    qa$("[data-sheet-close]").forEach(b => b.onclick = () => { buzz(4); close(); });

    // ---- Arrange: shape, place by (only where a painting's own color decides position), center on, and the
    // arc's old "Around this one" is now "Center on this painting" (also on the bottom card) ----
    function renderArrange() {
      const mid = centerK >= 0 ? lay.items[centerK] : -1, md = mid >= 0 ? pmDetailNow(mid, F) : null;
      const list = pmList(s, F);
      paneArr.innerHTML = `
        <div class="cx-sec"><b>Collection</b></div>
        <div class="hm-seg pmx-col-seg" role="radiogroup" aria-label="Collection">${PM_COLLECTIONS.map(([k, t]) => `<button class="${(s.col || "paintings") === k ? "on" : ""}" data-pmcol="${k}">${esc(t)}</button>`).join("")}</div>
        <div class="cx-sec"><b>Shape</b></div>
        <div class="hm-arr pmx-arr" role="radiogroup" aria-label="Arrange by">${PM_ARR.map(([k, t]) => `
          <button class="hm-arr-b${s.arr === k ? " on" : ""}" data-pmarr="${k}" role="radio" aria-checked="${s.arr === k}">
            <span class="hm-arr-pic">${PM_ICON[k]}</span><b>${esc(t)}</b></button>`).join("")}</div>
        <p class="hm-arr-sub">${PM_NEEDS_SEED.has(s.arr) && md ? `Around ${esc(md.t)}` : esc(PM_WHY[s.arr])}</p>
        <div class="hm-feel"><label class="hm-feel-row" data-feel="mag"><span class="hm-feel-l">Magnify</span><span class="hm-feel-r"><i>Flat</i><input type="range" min="0" max="1" step="0.01" value="${s.mag == null ? .5 : s.mag}" data-pmmag aria-label="Magnify, flat to fisheye"><i>Fisheye</i></span></label></div>
        ${s.arr === "color" || s.arr === "time" || s.arr === "tones" ? `<div class="cx-sec"><b>Place by</b></div>
          <div class="hm-seg" role="radiogroup" aria-label="Place by">${PM_PLACE.map(([k, t]) => `<button class="${(s.place || "avg") === k ? "on" : ""}" data-pmplace="${k}">${esc(t)}</button>`).join("")}</div>` : ""}
        <div class="cx-sec"><b>Center on</b></div>
        <div class="hm-seg hm-seg-n pmx-center-seg">${PM_CENTER.map(([k, t]) => {
          const found = t === "A favorite" ? pmFavList(F).length : true;
          return `<button data-pmcenterk="${k}"${found ? "" : " disabled"}>${esc(t)}</button>`;
        }).join("")}</div>
        <div class="cx-sec"><b>When</b></div>
        <div class="pmx-scrub"><input type="range" min="${pmYearRange(F)[0]}" max="${pmYearRange(F)[1]}" step="5" value="${s.upToYear == null ? pmYearRange(F)[1] : s.upToYear}" data-pmscrub aria-label="Reveal paintings up to this year">
          <button class="pmx-scrub-play${scrubTimer ? " on" : ""}" data-pmscrubplay aria-label="${scrubTimer ? "Pause" : "Play"}">${scrubTimer ? PM_ICON.pause : ICON.play}</button></div>
        <p class="hm-arr-sub" data-pmscrublabel>${s.upToYear == null ? "Showing every year" : `Up to ${s.upToYear}${s.upToYear >= pmYearRange(F)[1] ? "" : " (undated paintings join at the end)"}`}</p>`;
      qa$("[data-pmcol]").forEach(b => b.onclick = () => {
        const col = b.dataset.pmcol; if (col === (s.col || "paintings")) return;
        buzz(6); close();
        // a collection switch is a fresh map, start to finish (new G/F, new facets, new everything the sheet's
        // own tabs show) -- re-opening with { fresh: true } re-mounts cleanly rather than trying to hot-swap
        // F/G under the running draw loop's closures (every function above reads F fresh on every call, but
        // THIS closure's own captured `F`/`s` can't be reassigned mid-session without re-running pmMount).
        pmOpen({ col, arr: "color", f: pmFilterFresh(), seed: -1, fav: 0, place: "avg", upToYear: null, mag: s.mag }, { fresh: true });
      });
      qa$("[data-pmarr]").forEach(b => b.onclick = () => {
        const id = b.dataset.pmarr; buzz(5);
        if (PM_NEEDS_SEED.has(id)) { if (mid < 0) return; s.seed = mid; s.arr = id; }
        else { if (s.arr === id) return; s.arr = id; s.seed = -1; } // a stale seed from a prior Rings/Spiral shouldn't linger into Color/Time/Painter
        rebuild(); renderArrange();
      });
      qa$("[data-pmplace]").forEach(b => b.onclick = () => {
        const p = b.dataset.pmplace; if ((s.place || "avg") === p) return; buzz(5); s.place = p; rebuild(); renderArrange();
      });
      qa$("[data-pmcenterk]").forEach(b => b.onclick = () => {
        const fn = PM_CENTER.find(c => c[0] === b.dataset.pmcenterk)[2], found = fn(list, F);
        if (found < 0) return; buzz(6); s.seed = found; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "spiral"; rebuild(); renderArrange();
      });
      q$("[data-pmscrub]").oninput = e => {
        if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; }
        const v = +e.target.value, [, hi] = pmYearRange(F); s.upToYear = v >= hi ? null : v; rebuild(); renderArrange();
      };
      q$("[data-pmscrubplay]").onclick = () => { buzz(6); scrubPlay(); renderArrange(); };
      // Magnify (David, 2026-10-10): live-applied without a full rebuild() -- M0N only feeds the lens (M0/A via
      // lensAt()), never the layout itself, so re-running pmLayout() on every drag tick would be pure waste (and
      // would even reset pan/zoom: lay.key folds in pmQS(), which now includes mag, so a never-seen mag value is
      // a "fresh" key with no PM_PAN entry yet). Direct Z re-clamp + redraw instead; the address updates once the
      // drag ends (change, not input) so a mid-drag value never clutters the URL/history.
      q$("[data-pmmag]").oninput = e => { s.mag = clamp(+e.target.value, 0, 1); M0N = pmM0NOf(s.mag); lensAt(); Z = clamp(Z, zMin(), ZMAX); kick(); };
      q$("[data-pmmag]").onchange = () => { try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {} };
    }
    // ---- Filter: every facet with its count, applied live (no separate confirm -- matches the color map's
    // non-modal Colors/Arrange sheet). David, 2026-10-10: "select multiple things -- a color range, a time
    // range, multiple countries, or e.g. only Europe" -- Country/Movement/Museum/Painter are now toggle-many
    // (OR within the facet); Color is a dual-handle year-free range already (f.y0/f.y1) now with presets and a
    // decade histogram; Color gets multi-pick + an Any/All toggle + a hue-family quick-pick + a lightness
    // range. pmRun() (not xbRun) does the actual matching and per-value counting for all of it.
    function renderFilter() {
      const res = pmRun(s, F), C = res.counts;
      let n = res.list.length;
      const favIds = pmFavList(F), favSet = new Set(favIds.map(r => r.i));
      if (s.fav) n = Array.from(res.list).filter(i => favSet.has(i)).length;
      const favN = Array.from(res.list).filter(i => favSet.has(i)).length;
      const chip = (attr, val, label, cnt, on) => `<button class="${on ? "on" : ""}" ${attr}="${esc(String(val))}"${!cnt && !on ? " disabled" : ""}>${esc(label)}${cnt != null ? `<em>${cnt.toLocaleString()}</em>` : ""}</button>`;
      const f = s.f;
      const topMulti = (names, countArr, selSet) => names.map((name, j) => ({ name, v: j + 1, n: countArr[j + 1] })).filter(x => x.n || selSet.has(x.v)).sort((a, b) => b.n - a.n);
      const [yrLo, yrHi] = pmYearRange(F);
      const y0 = f.y0 == null ? yrLo : f.y0, y1 = f.y1 == null ? yrHi : f.y1;
      const dLo = Math.max(0, Math.floor((yrLo - XB_DEC0) / 10)), dHi = Math.min(XB_NDEC - 1, Math.floor((yrHi - XB_DEC0) / 10));
      const decadeBars = Array.from({ length: dHi - dLo + 1 }, (_, k) => C.when[dLo + k]);
      const maxDecade = Math.max(1, ...decadeBars);
      const pct = y => clamp((y - yrLo) / (yrHi - yrLo) * 100, 0, 100);
      const activePreset = PM_TIME_PRESETS.find(p => p[2] === f.y0 && p[3] === f.y1);
      const cols = [...BASICS, ...ALL].filter(c => !c.basic || /^(Red|Blue|Green|Yellow|Pink|Purple|Orange|Brown)$/.test(c.n));
      const colsSorted = typeof glHueOrder === "function" ? glHueOrder(cols) : cols;
      const coSelSet = new Set(f.coSet || []), mvSelSet = new Set(f.mvSet || []), musSelSet = new Set(f.musSet || []), paSelSet = new Set(f.painterSet || []);
      const cos = topMulti(F.meta.countries, C.co, coSelSet), mvs = topMulti(F.meta.movements, C.mv, mvSelSet);
      const pas = topMulti(F.meta.artists.map(a => a[0]), C.painter, paSelSet);
      const musAll = F.G.src.map((m, k) => ({ name: m.short, v: k, n: C.mus[k] })).filter(x => x.n || musSelSet.has(x.v));
      const coList = coq ? cos.filter(x => x.name.toLowerCase().includes(coq.toLowerCase())).slice(0, 30) : cos.slice(0, fopen.co ? 44 : 10);
      const pList = fq ? pas.filter(x => x.name.toLowerCase().includes(fq.toLowerCase())).slice(0, 24) : pas.slice(0, fopen.painter ? 60 : 10);
      const regionRow = PM_REGIONS.map(([key, label, names]) => {
        const idx = names.map(nm => F.meta.countries.indexOf(nm) + 1).filter(v => v > 0);
        const on = idx.length > 0 && idx.every(v => coSelSet.has(v));
        const cnt = idx.reduce((s2, v) => s2 + (C.co[v] || 0), 0);
        return chip("data-pmregion", key, label, cnt, on);
      }).join("");
      const nounP = pmColLabel(F, "nounP"), isPaintings = !F.col || F.col === "paintings";
      const painterLab = pmColLabel(F, "painter"), coLab = pmColLabel(F, "co"), musLab = pmColLabel(F, "mus"), mvLab = pmColLabel(F, "mv");
      q$("[data-pmbody]").innerHTML = `
        <div class="pmx-sh-top"><b>Filter</b><span>${n.toLocaleString()} ${n === 1 ? pmColLabel(F, "noun") : nounP}</span><button class="pmx-reset" data-pmreset>Reset</button></div>
        ${favIds.length ? `<div class="pmx-row"><span class="pmx-lab">Yours</span><div class="pmx-chips">${chip("data-pmfav", 1, "Your favorites", favN, !!s.fav)}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">Color</span><div class="pmx-sw">${colsSorted.map(c => `<button data-pmhex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" class="${f.hexes.includes(c.h.toUpperCase()) ? "on" : ""}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
          ${f.hexes.length ? `<p class="pmx-cap2">${f.hexes.map(h => `<i style="--c:${h}"></i>`).join("")}${esc(f.hexes.length === 1 ? (f.name || nameOf(f.hexes[0]).text) : f.hexes.length + " colors")} <span>· within ${f.tol}%</span></p>
          <div class="pmx-scrub"><span class="pmx-lab2">Closeness</span><input type="range" min="1" max="30" step="1" value="${f.tol}" data-pmtol aria-label="Color closeness"></div>
          ${f.hexes.length > 1 ? `<div class="hm-seg pmx-colmode" role="radiogroup" aria-label="Match any or all colors"><button class="${(f.colorMode || "any") === "any" ? "on" : ""}" data-pmcolmode="any">Any</button><button class="${f.colorMode === "all" ? "on" : ""}" data-pmcolmode="all">All</button></div>` : ""}` : ""}
          <p class="pmx-lab2">Hue family</p>
          <div class="pmx-chips">${XB_HUE_WORDS.map((w, j) => chip("data-pmhue", j, w, C.hueBand[j], f.hueBand === j)).join("")}</div>
          <p class="pmx-lab2">Lightness</p>
          <div class="pmx-range2" style="--lo:${f.l0 == null ? 0 : f.l0}%;--hi:${f.l1 == null ? 100 : f.l1}%">
            <input type="range" min="0" max="100" value="${f.l0 == null ? 0 : f.l0}" data-pml0 aria-label="Darker than">
            <input type="range" min="0" max="100" value="${f.l1 == null ? 100 : f.l1}" data-pml1 aria-label="Lighter than"></div>
          <p class="pmx-cap3"><span>Dark</span><span>Light</span></p></div>
        <div class="pmx-row"><span class="pmx-lab">When</span>
          <div class="pmx-chips">${PM_TIME_PRESETS.map(([k, t, p0, p1]) => chip("data-pmpreset", k, t, null, activePreset && activePreset[0] === k)).join("")}</div>
          <div class="pmx-hist" aria-hidden="true">${decadeBars.map(n2 => `<i style="--h:${Math.max(.04, n2 / maxDecade)}"></i>`).join("")}</div>
          <div class="pmx-range2" style="--lo:${pct(y0)}%;--hi:${pct(y1)}%">
            <input type="range" min="${yrLo}" max="${yrHi}" step="1" value="${y0}" data-pmy0 aria-label="From year">
            <input type="range" min="${yrLo}" max="${yrHi}" step="1" value="${y1}" data-pmy1 aria-label="To year"></div>
          <p class="pmx-cap3"><span>${y0}</span><span>${y1}</span></p></div>
        <div class="pmx-row"><span class="pmx-lab">${esc(coLab)}</span>
          ${isPaintings ? `<p class="pmx-lab2">Regions</p>
          <div class="pmx-chips">${regionRow}</div>` : ""}
          <p class="pmx-lab2">${isPaintings ? "Countries" : coLab}</p>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmcoq type="search" placeholder="Find a ${esc(coLab.toLowerCase())}" value="${esc(coq)}" autocomplete="off"></label>
          <div class="pmx-chips">${coList.map(x => chip("data-pmco", x.v, x.name, x.n, coSelSet.has(x.v))).join("")}${!coq && !fopen.co && cos.length > 10 ? `<button class="pmx-more" data-pmmore="co">All ${cos.length}</button>` : ""}</div></div>
        ${mvs.length ? `<div class="pmx-row"><span class="pmx-lab">${esc(mvLab)}</span><div class="pmx-chips">${mvs.map(x => chip("data-pmmv", x.v, x.name, x.n, mvSelSet.has(x.v))).join("")}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">${esc(musLab)}</span><div class="pmx-chips">${musAll.map(x => chip("data-pmmus", x.v, x.name, x.n, musSelSet.has(x.v))).join("")}</div></div>
        <div class="pmx-row"><span class="pmx-lab">${esc(painterLab)}</span>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmq type="search" placeholder="Find a ${esc(painterLab.toLowerCase())}" value="${esc(fq)}" autocomplete="off"></label>
          <div class="pmx-chips">${pList.map(x => chip("data-pmp", x.v, x.name, x.n, paSelSet.has(x.v))).join("")}${!fq && !fopen.painter && pas.length > 10 ? `<button class="pmx-more" data-pmmore="painter">More ${esc(nounP)}</button>` : ""}</div></div>`;
      const inp = q$("[data-pmq]");
      inp.oninput = () => { fq = inp.value.trim(); const pos = inp.selectionStart; renderFilter(); const ni = q$("[data-pmq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
      const coInp = q$("[data-pmcoq]");
      coInp.oninput = () => { coq = coInp.value.trim(); const pos = coInp.selectionStart; renderFilter(); const ni = q$("[data-pmcoq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
      // live range sliders: 'input' (not the delegated click below) for drag feedback, kept from crossing past
      // each other the same way a dual-handle slider always must (y0 can't pass y1, l0 can't pass l1)
      const tolInp = q$("[data-pmtol]"); if (tolInp) tolInp.oninput = e => { f.tol = +e.target.value; buzz(2); rebuild(); renderFilter(); };
      q$("[data-pmy0]").oninput = e => { f.y0 = Math.min(+e.target.value, f.y1 == null ? yrHi : f.y1); buzz(2); rebuild(); renderFilter(); };
      q$("[data-pmy1]").oninput = e => { f.y1 = Math.max(+e.target.value, f.y0 == null ? yrLo : f.y0); buzz(2); rebuild(); renderFilter(); };
      q$("[data-pml0]").oninput = e => { f.l0 = Math.min(+e.target.value, f.l1 == null ? 100 : f.l1); buzz(2); rebuild(); renderFilter(); };
      q$("[data-pml1]").oninput = e => { f.l1 = Math.max(+e.target.value, f.l0 == null ? 0 : f.l0); buzz(2); rebuild(); renderFilter(); };
    }
    paneFilt.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const f = s.f, d = b.dataset;
      if (d.pmreset != null) { s.f = pmFilterFresh(); s.fav = 0; fq = ""; coq = ""; buzz(6); rebuild(); return renderFilter(); }
      if (d.pmmore) { fopen[d.pmmore] = true; return renderFilter(); }
      if (d.pmfav != null) s.fav = s.fav ? 0 : 1;
      else if (d.pmhex) { const h = d.pmhex.toUpperCase(), at = f.hexes.indexOf(h); if (at >= 0) { f.hexes.splice(at, 1); if (!f.hexes.length) f.name = ""; } else { f.hexes.push(h); if (f.hexes.length === 1) { f.name = d.name; f.tol = f.tol || 8; } } }
      else if (d.pmcolmode) f.colorMode = d.pmcolmode;
      else if (d.pmhue) f.hueBand = f.hueBand === +d.pmhue ? null : +d.pmhue;
      else if (d.pmpreset) { const p = PM_TIME_PRESETS.find(x => x[0] === d.pmpreset), on = f.y0 === p[2] && f.y1 === p[3]; f.y0 = on ? null : p[2]; f.y1 = on ? null : p[3]; }
      else if (d.pmregion) pmRegionToggle(f, d.pmregion, F);
      else if (d.pmco) { const v = +d.pmco, set = new Set(f.coSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.coSet = [...set]; f.region = null; }
      else if (d.pmmv) { const v = +d.pmmv, set = new Set(f.mvSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.mvSet = [...set]; }
      else if (d.pmmus) { const v = +d.pmmus, set = new Set(f.musSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.musSet = [...set]; }
      else if (d.pmp) { const v = +d.pmp, set = new Set(f.painterSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.painterSet = [...set]; }
      else return;
      buzz(5); rebuild(); renderFilter();
    });
    renderArrange(); renderFilter();
  }
  // ---- life cycle
  const ro = new ResizeObserver(() => size()); ro.observe(cv);
  // David, 2026-10-10: "Back should take me to that exact spot instead of reloading the position" -- this used
  // to save the SNAPPED cell position (lay.x[centerK], lay.y[centerK]) on the way out, rounding away whatever
  // precise mid-pan spot P was actually sitting at the moment you tapped a painting open. Save the real P/Z.
  cleanup.push(() => { dead = true; clearTimeout(tapTimer); clearInterval(scrubTimer); scrubTimer = 0; ro.disconnect(); cancelAnimationFrame(raf); imgs.destroy(); t1.destroy(); if (lay) PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z, cardOpen }); });
  size(); build(false);
  window.PM_CTRL = { get center() { return centerK >= 0 ? lay.items[centerK] : -1; }, get count() { return lay ? lay.n : 0; }, get drawn() { return drawn.length; }, images: () => imgs.stats(), get spec() { return s; }, glideTo: k => glideTo([lay.x[k], lay.y[k]], 300), lay: () => lay, zoom: z => { Z = clamp(z, zMin(), ZMAX); kick(); },
    // QA: the raw pan/zoom (David, 2026-10-10, "Back should restore the exact prior view") -- _qaSetPZ lets a
    // test establish an arbitrary pan deterministically (a real drag gesture would be slow and imprecise);
    // _qaPZ reads it back the same way, for the before/after comparison across a Back round trip
    _qaPZ: () => ({ P: P.slice(), Z, cardOpen }),
    _qaSetPZ: (x, y, z) => { P = [x, y]; Z = clamp(z, zMin(), ZMAX); centerK = -1; setCenter(lay.n ? nearestK(P[0], P[1]) : -1); PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z }); kick(); },
    // QA (tools/smoke paintmap group): a real network fetch of data/artists/portraits.json doesn't reliably
    // resolve inside the virtual-time test harness, so a forced override makes "landmarks label themselves" a
    // deterministic check rather than a timing bet.
    _qaLandmarks: arr => { PM_LANDMARKS = new Set(arr); PM_LANDMARKS_ON = true; kick(); },
    _qaRects: () => drawn.map(b => ({ i: b.i, x: b.x, y: b.y, w: b.w, h: b.h })),
    // true once that painting's own real pixels are baked (bake() no longer falls back to a flat color for a
    // non-CORS host -- see the comment above pmSafeHost), false only while still loading or on a genuine failure
    _qaImageReal: i => { const e = imgs.get(i); return !!(e && e.st === 1); },
    // QA (tier 0/1 atlas): whether the one shared tier-0 sheet has finished loading (every drawn cell gets its
    // own real tile the instant this is true -- see the draw loop's unconditional tier-0 pass), and how many of
    // the tier-1 groups the current view touched have loaded their sheet.
    _qaAtlasReady: () => !!(atlas && atlas.bm0s && atlas.bm0s.length),
    // QA: the zoom-out floor for the CURRENT layout -- PM_CTRL.zoom(_qaZMin()) should show the whole thing
    // (drawn === count), confirming zMin() isn't capped below what the layout actually needs (David, 2026-10-10)
    _qaZMin: () => zMin(),
    // forces one synchronous draw (lensAt() + draw()) without waiting on requestAnimationFrame -- the smoke
    // harness's own timing can starve rAF well past an ordinary sleep (same gap the tier-0 atlas scenario above
    // documents), so a direct PM_CTRL.zoom()-then-redraw check needs this rather than a real frame
    _qaForceDraw: () => { lensAt(); draw(performance.now()); },
    // QA: snaps an in-flight glide (tap-to-fly, Walk, Center on...) straight to its end state -- this harness's
    // own rAF gap (see _qaForceDraw's comment) can leave a real glide frozen mid-ease rather than failing to
    // start at all, so a test that cares about the FINAL position/zoom calls this instead of waiting on frames
    // that may never come.
    _qaSkipGlide: () => { if (glide) { P = glide.b.slice(); if (glide.z) Z = glide.z[1]; glide = null; } lensAt(); draw(performance.now()); },
    // QA: does the layout's own bounding box (all four corners) land within the canvas at the CURRENT zoom --
    // the literal "layout bbox fits inside the viewport" check (David, 2026-10-10), independent of the separate
    // tiny-cell draw cutoff (which is about whether an individual cell is worth a drawImage call, not about
    // whether the overall shape is on screen)
    _qaBBoxFits: () => {
      const cx = W / 2, cy = H / 2, corners = [[lay.gx0, lay.gy0], [lay.gx0 + lay.GW - 1, lay.gy0], [lay.gx0, lay.gy0 + lay.GH - 1], [lay.gx0 + lay.GW - 1, lay.gy0 + lay.GH - 1]];
      let maxX = 0, maxY = 0;
      for (const [gx, gy] of corners) {
        const ex = gx - P[0], ey = gy - P[1], z = Math.hypot(ex, ey), f = z < 1e-6 ? K() * M0 : Fz(z) / z;
        maxX = Math.max(maxX, Math.abs(ex * f)); maxY = Math.max(maxY, Math.abs(ey * f));
      }
      return { fits: maxX <= cx + 2 && maxY <= cy + 2, maxX, maxY, halfW: cx, halfH: cy };
    },
    _qaTier1Stats: () => { let have = 0, want = 0; const man = atlas && atlas.man; if (man) for (const b of drawn) { const g = pmT1Group(man, b.i); want++; const e = t1.get(g); if (e && e.st === 1) have++; } return { want, have }; } };
}

// this file can load after router.js (on first use): give pmOpen its address now
if (typeof routeWrapAll === "function") routeWrapAll();

// One search finds the paintings layer too (design/SIMPLIFY/PLAN.md §3.7/§9, Lane 2: "register map features in
// search... each arrangement and order"). js/search.js loads before this file (index.html), so this is safe at
// module load -- no runtime guard needed, just the typeof check in case that ever changes.
if (typeof featureRegister === "function") {
  featureRegister("paintings-floor", { t: "Paintings", where: "Map · ⋯ · Colors | Paintings", words: "paintings map archive gallery by color",
    run: () => { if (typeof S !== "undefined") { S.hm = S.hm || {}; S.hm.mode = "paintings"; } pmGo("arr=color"); } });
  PM_ARR.forEach(([id, title]) => featureRegister("pm-arr-" + id, { t: `Paintings: ${title}`, where: "Paintings · ⋯ · Arrange",
    words: "paintings arrange arrangement shape " + title.toLowerCase(), run: () => { if (typeof S !== "undefined") { S.hm = S.hm || {}; S.hm.mode = "paintings"; } pmGo("arr=" + id); } }));
}
