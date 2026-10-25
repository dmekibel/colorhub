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
// Third field = where it makes sense: omitted = every map, "multi" = only when the map holds many painters (By painter and
// Families are one block when it holds one), "solo" = only when the map is scoped to ONE painter (David, 2026-10-20: the
// painter page's map). One list, filtered by pmArrFor(); the sheet is never forked.
const PM_ARR = [["color", "By color"], ["time", "By time"], ["painter", "By painter", "multi"], ["families", "Families", "multi"], ["museum", "By museum", "solo"], ["subject", "By subject"], ["look", "By vibe"], ["tones", "Tones"], ["rings", "Rings"], ["spiral", "Spiral"]];
const pmSolo = s => !!(s && s.f && s.f.painterSet && s.f.painterSet.length === 1);
const pmArrFor = s => PM_ARR.filter(a => (!a[2] || (a[2] === "solo") === pmSolo(s)) && (a[0] !== "subject" || (s.col || "paintings") === "paintings") && (a[0] !== "look" || pmLookShown(s)));
// "By look" may still be unknown (a shared address opens it before look.json has answered): keep it until it has said no
const pmArrOk = s => s.arr === "look" ? (s.col || "paintings") === "paintings" && PM_LOOK.st !== 3 : pmArrFor(s).some(a => a[0] === s.arr);
const PM_NEEDS_SEED = new Set(["rings", "spiral"]);
const PM_WHY = {
  color: "Lighter toward the top, hues left to right",
  time: "Oldest at the top, a band for each decade",
  painter: "A block for each painter, earliest first",
  families: "A block for each movement, the biggest first",
  museum: "A block for each museum, the biggest collection first",
  subject: "A block for each kind of picture: portraits, landscapes, still lifes, the biggest first",
  tones: "An island per mood: vivid, light, muted, dark",
  rings: "Concentric rings: the nearer the middle, the closer the colors",
  spiral: "A continuous spiral, nearest first, no seams between rings",
  look: "By vibe, from an image model. Paintings with a similar vibe sit together. The picture model's view of vibe: subject, style, mood and color.",
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
  museum: sv('<path d="M3.5 9.5L12 4l8.5 5.5M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 19.5h17"/>', 22, 1.7),
  subject: sv('<rect x="3.5" y="4" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="4" width="7.5" height="7.5" rx="3.75"/><path d="M3.5 20l3.75-6.5L11 20zM13 20h7.5"/>', 22, 1.7),
  families: sv('<circle cx="7" cy="7" r="3.4"/><circle cx="16.5" cy="6.5" r="2.4"/><circle cx="7" cy="16.5" r="2.4"/><circle cx="17" cy="16" r="3"/>', 22, 1.7),
  tones: sv('<circle cx="7" cy="7" r="3.6"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="3.6"/>', 22, 1.7),
  rings: sv('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2.5 3"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="1.5 2.5"/>', 22, 1.6),
  spiral: sv('<path d="M12 12c0-1.2 1-2 2.2-2 1.8 0 3.3 1.6 3.3 3.5 0 2.6-2.2 4.8-4.8 4.8-3.3 0-6-2.8-6-6.1C6.7 7.7 10 4.6 14 4.6" stroke-linecap="round"/>', 22, 1.7),
  look: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', 22, 1.7),
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
//   subjSet    subject tags (data/gallery/subjects.json via js/gallery.js loadSubjects): a painting matches if ANY of its tags (authority, title or detected) is in the set; paintings only
//   colorMode  "any" (default: a painting counts if it's close to ANY picked hex), "all" (close to EVERY one: "Holds every color") or
//              "overall" ("Same overall palette": the whole palette within tol of the picked one, an earth mover's distance weighted by
//              f.shares, see pmPalAsync)
//   hueBand    one of XB_FAMS's 9 family indices (0=Reds..8=Greys), matched against a painting's DOMINANT swatch
//   l0/l1      a mean-lightness range (0-100, dark<->light), independent of any hex pick
const pmFilterFresh = () => ({ ...xbFresh(), coSet: [], region: null, painterSet: [], mvSet: [], musSet: [], tySet: [], subjSet: [], colorMode: "any", shares: null, hueBand: null, l0: null, l1: null });
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
// ---------- Phase H: a color or a palette as a FILTER (David, 2026-10-24) ----------
// "i want only the ones that exist to be visible": the map shows ONLY the paintings that hold the color (never glow-and-dim).
//   Holds every color   f.colorMode "all": each picked color must be in the painting within f.tol (CIEDE2000, pmDE1 above).
//   Same overall palette   f.colorMode "overall": the cost of turning one whole palette into the other, in CIELAB, weighted by
//   how much of the canvas each color covers (an earth mover's distance over the six colors and their shares).
// Both need a table over every painting (a first color: 206,000 x 6 distances, ~150 ms; a palette: ~1.3M comparisons plus a small
// transport problem for the plausible ones, seconds). That is more than a frame, so the tables are built in short time slices
// (~10 ms, yielding between) and the map you are on stays alive under a quiet "Matching ... 40%" line. Tables are cached; a
// closer palette setting only computes the paintings that can pass, and loosening the slider only computes the extra ones.
// (No Worker: a copy of the 25 MB color table would cost more memory than the slices cost time, and iOS is memory-bound.)
const PM_PAL_MAX = 14;   // the loosest "Same overall palette" goes (CIELAB units): beyond it tens of thousands of paintings match
let PM_PAL = null;      // { key, lb: Float32Array, dist: Float32Array, upTo } the last palette asked for
const pmYieldQ = [], pmYieldCh = typeof MessageChannel === "function" ? new MessageChannel() : null;
if (pmYieldCh) pmYieldCh.port1.onmessage = () => { const r = pmYieldQ.shift(); if (r) r(); };
const pmYield = () => new Promise(res => { if (pmYieldCh) { pmYieldQ.push(res); pmYieldCh.port2.postMessage(0); } else setTimeout(res, 0); });
const pmPalKey = (F, f) => F.N + "|" + f.hexes.join(",") + "|" + (f.shares || []).map(x => (+x).toFixed(3)).join(",");
const pmPalDist = (F, f) => (PM_PAL && PM_PAL.key === pmPalKey(F, f) ? PM_PAL.dist : null);
// is the table this filter needs already built?
function pmMatchReady(F, f) {
  if (!f.hexes || !f.hexes.length) return true;
  if (f.colorMode === "overall") return !!(PM_PAL && PM_PAL.key === pmPalKey(F, f) && PM_PAL.upTo >= Math.min(PM_PAL_MAX, Math.ceil(f.tol)));
  return f.hexes.every(h => { const e = PM_DE1.get(h); return e && e.N === F.N; });
}
// the exact earth mover's distance of two small palettes (w: K weights, v: M weights, each summing to 1; D[a*6+m] the distances):
// successive cheapest augmenting paths in the flow network source -> query colors -> painting colors -> sink
const EMD_F = new Int8Array(120), EMD_T = new Int8Array(120), EMD_C = new Float64Array(120), EMD_W = new Float64Array(120), EMD_ND = new Float64Array(16), EMD_PV = new Int16Array(16);
function pmEMD(w, K, v, M, D) {
  let ne = 0; const T = K + M + 1;
  const add = (a, b, cap, cost) => { EMD_F[ne] = a; EMD_T[ne] = b; EMD_C[ne] = cap; EMD_W[ne] = cost; ne++; EMD_F[ne] = b; EMD_T[ne] = a; EMD_C[ne] = 0; EMD_W[ne] = -cost; ne++; };
  for (let a = 0; a < K; a++) add(0, 1 + a, w[a], 0);
  for (let a = 0; a < K; a++) for (let m = 0; m < M; m++) add(1 + a, 1 + K + m, 9, D[a * 6 + m]);
  for (let m = 0; m < M; m++) add(1 + K + m, T, v[m], 0);
  let cost = 0, flow = 0;
  for (let it = 0; it < 60 && flow < 1 - 1e-7; it++) {
    EMD_ND.fill(1e9, 0, T + 1); EMD_ND[0] = 0;
    for (let pass = 0; pass <= T; pass++) {
      let ch = false;
      for (let e = 0; e < ne; e++) if (EMD_C[e] > 1e-9 && EMD_ND[EMD_F[e]] + EMD_W[e] < EMD_ND[EMD_T[e]] - 1e-12) { EMD_ND[EMD_T[e]] = EMD_ND[EMD_F[e]] + EMD_W[e]; EMD_PV[EMD_T[e]] = e; ch = true; }
      if (!ch) break;
    }
    if (EMD_ND[T] >= 1e8) break;
    let f = 9; for (let x = T; x !== 0; x = EMD_F[EMD_PV[x]]) f = Math.min(f, EMD_C[EMD_PV[x]]);
    for (let x = T; x !== 0; x = EMD_F[EMD_PV[x]]) { EMD_C[EMD_PV[x]] -= f; EMD_C[EMD_PV[x] ^ 1] += f; }
    flow += f; cost += f * EMD_ND[T];
  }
  return cost;
}
// the table of one color: the nearest swatch distance (CIEDE2000) of every painting, built in slices. alive() false -> abandon.
async function pmDE1Async(F, hex, onPct, alive) {
  const have = PM_DE1.get(hex); if (have && have.N === F.N) return true;
  const G = F.G, M = F.N * 6, de = new Float32Array(M).fill(1e3), Lb = G.lab, [tL, ta, tb] = lab(hex);
  let m = 0;
  while (m < M) {
    const t0 = performance.now();
    while (m < M) {
      const o = m * 3, dL = Lb[o] - tL;
      if (dL <= 28 && dL >= -28) { const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]); if (d < de[m]) de[m] = d; }
      m++; if ((m & 1023) === 0 && performance.now() - t0 > 10) break;
    }
    if (onPct) onPct(m / M);
    if (m < M) { await pmYield(); if (alive && !alive()) return false; }
  }
  if (PM_DE1.size > 24) PM_DE1.clear();
  PM_DE1.set(hex, { N: F.N, de }); return true;
}
// the table of one palette: first a cheap lower bound for every painting (each side's weighted nearest-color distance), then the exact
// distance only for paintings whose bound is within the closeness asked for (f.tol); a looser tol later adds the paintings in between.
async function pmPalAsync(F, f, onPct, alive) {
  const key = pmPalKey(F, f), G = F.G, N = F.N, Lb = G.lab, sh = G.sh, K = f.hexes.length;
  const q = f.hexes.map(h => lab(h)), w = new Float64Array(6), sw = (f.shares && f.shares.length === K ? f.shares : f.hexes.map(() => 1)).reduce((a, b) => a + b, 0) || 1;
  for (let a = 0; a < K; a++) w[a] = ((f.shares && f.shares.length === K ? f.shares[a] : 1) || 0) / sw;
  if (!PM_PAL || PM_PAL.key !== key) PM_PAL = { key, lb: null, dist: new Float32Array(N).fill(999), upTo: 0 };
  const T = PM_PAL, D = new Float64Array(36), vv = new Float64Array(6), idx = new Int8Array(6), colMin = new Float64Array(6);
  // one painting: fills D/vv/idx, returns M (0 when it has no measured colors); and its bound through lbOut[0]
  const lbOut = new Float64Array(1);
  const prep = i => {
    const j0 = i * 6; let tot = 0; for (let j = 0; j < 6; j++) tot += sh[j0 + j];
    if (!(tot > 0)) return 0;
    let M = 0; for (let j = 0; j < 6; j++) if (sh[j0 + j] > 0) { idx[M] = j; vv[M] = sh[j0 + j] / tot; colMin[M] = 9e9; M++; }
    let lb1 = 0, lb2 = 0;
    for (let a = 0; a < K; a++) {
      let rowMin = 9e9;
      for (let m = 0; m < M; m++) {
        const o = (j0 + idx[m]) * 3, dL = q[a][0] - Lb[o], da = q[a][1] - Lb[o + 1], db = q[a][2] - Lb[o + 2], d = Math.sqrt(dL * dL + da * da + db * db);
        D[a * 6 + m] = d; if (d < rowMin) rowMin = d; if (d < colMin[m]) colMin[m] = d;
      }
      lb1 += w[a] * rowMin;
    }
    for (let m = 0; m < M; m++) lb2 += vv[m] * colMin[m];
    lbOut[0] = Math.max(lb1, lb2); return M;
  };
  const sliced = async (from, body, lo, hi) => {   // run body(i) over [0, N) in slices, reporting progress in [lo, hi]
    let i = 0;
    while (i < N) {
      const t0 = performance.now();
      while (i < N) { body(i); i++; if ((i & 255) === 0 && performance.now() - t0 > 10) break; }
      if (onPct) onPct(lo + (hi - lo) * i / N);
      if (i < N) { await pmYield(); if (alive && !alive()) return false; }
    }
    return true;
  };
  if (!T.lb) {
    const lb = new Float32Array(N).fill(999);
    if (!await sliced(0, i => { if (prep(i)) lb[i] = lbOut[0]; }, 0, .3)) return false;
    T.lb = lb;
  }
  const want = Math.min(PM_PAL_MAX, Math.ceil(f.tol)), from = T.upTo, lb = T.lb, dist = T.dist;
  if (want > from) {
    if (!await sliced(0, i => { const b = lb[i]; if (b > from && b <= want) { const M = prep(i); if (M) dist[i] = pmEMD(w, K, vv, M, D); } }, .3, 1)) return false;
    T.upTo = want;
  }
  return true;
}
// make the tables this filter needs ready; resolves true when they are, false when asked to stop (alive() false)
async function pmMatchCompute(F, f, onPct, alive) {
  if (pmMatchReady(F, f)) return true;
  if (f.colorMode === "overall") return pmPalAsync(F, f, onPct, alive);
  const miss = f.hexes.filter(h => { const e = PM_DE1.get(h); return !(e && e.N === F.N); });
  for (let k = 0; k < miss.length; k++) if (!await pmDE1Async(F, miss[k], p => { if (onPct) onPct((k + p) / miss.length); }, alive)) return false;
  return true;
}
// how well a painting matches the picked color(s): lower is closer (the best match opens the map)
function pmMatchScore(F, f) {
  if (f.colorMode === "overall") { const pd = pmPalDist(F, f); return pd ? i => pd[i] : null; }
  const per = f.hexes.map(h => pmDE1(F, h)), all = f.colorMode === "all" || f.hexes.length === 1;
  return i => { let out = all ? 0 : 1e9; for (const de of per) { let near = 1e9; for (let j = 0; j < 6; j++) { const d = de[i * 6 + j]; if (d < near) near = d; } out = all ? Math.max(out, near) : Math.min(out, near); } return out; };
}
// the cell in this layout that matches the filter's color(s) best (-1 when none)
function pmBestMatch(lay, f, F) {
  if (!f.hexes || !f.hexes.length || !lay.n) return -1;
  const sc = pmMatchScore(F, f); if (!sc) return -1;
  let best = -1, bd = Infinity; for (let k = 0; k < lay.n; k++) { const d = sc(lay.items[k]); if (d < bd) { bd = d; best = k; } }
  return best;
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
  const tySet = F.ty && f.tySet && f.tySet.length ? new Set(f.tySet) : null;   // object type (Design objects only, F.ty)
  const subjOn = !!SUBJ && (F.col || "paintings") === "paintings" && N <= SUBJ.N;
  const subjFlag = subjOn && f.subjSet && f.subjSet.length ? subjFlags(f.subjSet) : null;
  const hasHex = f.hexes && f.hexes.length, mode = f.colorMode || "any";
  const overall = hasHex && mode === "overall", pd = overall ? pmPalDist(F, f) : null;   // Same overall palette: the distance table must already be computed (pmMount waits for it)
  const perHex = hasHex && !overall ? f.hexes.map(h => pmDE1(F, h)) : null;
  const tol = f.tol;
  const when = f.y0 != null || f.y1 != null, y0 = f.y0 == null ? -1e5 : f.y0, y1 = f.y1 == null ? 1e5 : f.y1;
  const hasL = f.l0 != null || f.l1 != null, l0 = f.l0 == null ? -1e5 : f.l0, l1 = f.l1 == null ? 1e5 : f.l1;
  const counts = { when: new Int32Array(XB_NDEC + 1), painter: new Int32Array(F.meta.artists.length + 1), mv: new Int32Array(F.meta.movements.length + 1), co: new Int32Array(F.meta.countries.length + 1),
    mus: new Int32Array(G.src.length), ty: new Int32Array(((F.meta.types || []).length) + 1), hueBand: new Int32Array(9), color: 0, lightness: 0, subj: subjOn ? new Int32Array(SUBJ.tags.length) : null };
  const out = new Int32Array(N); let n = 0;
  const hid = (F.col || "paintings") === "paintings" && G.hid && G.hid.length === N ? G.hid : null;
  for (let i = 0; i < N; i++) {
    let fail = 0;
    if (hasHex) {
      let ok;
      if (overall) ok = !!pd && pd[i] <= tol;
      else if (mode === "all") { ok = true; for (const de of perHex) { let near = 1e3; for (let j = 0; j < 6; j++) { const d = de[i * 6 + j]; if (d < near) near = d; } if (near > tol) { ok = false; break; } } }
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
    if (subjFlag && !subjHas(i, subjFlag)) fail |= 256;
    if (tySet && !tySet.has(F.ty[i])) fail |= 512;
    if (hid && hid[i]) fail |= 1024;   // not an artwork (tools/hide_nonart.py): off every list and count
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
    if (F.ty && !(fail & ~512)) counts.ty[F.ty[i]]++;
    if (subjOn && !(fail & ~256)) for (let k = SUBJ.off[i], e = SUBJ.off[i + 1]; k < e; k++) counts.subj[SUBJ.tg[k]]++;
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
// One painter's own span (David, 2026-10-20): the year slider, its histogram and the quick ranges of a one-painter map
// run across THAT painter's real dates, not 1400-2000. Cached per painter. total = every painting of theirs on the map.
const PM_SOLO_YEARS = new Map();
function pmSoloYears(a, F) {
  const key = (F.col || "paintings") + ":" + a;
  let e = PM_SOLO_YEARS.get(key); if (e && e.N === F.N) return e;
  const G = F.G, ys = []; let total = 0;
  for (let i = 0; i < F.N; i++) { if (F.artist[i] !== a) continue; total++; if (G.year[i] !== GL_UNDATED) ys.push(G.year[i]); }
  ys.sort((p, q) => p - q);
  // a lone stray date (one Van Gogh dated 1658 in the data) must not stretch the slider across three centuries: trim
  // an end that sits more than 25 years outside the 2nd/98th percentile
  let lo = ys.length ? ys[0] : 1900, hi = ys.length ? ys[ys.length - 1] : 1900;
  if (ys.length > 20) { const a2 = ys[Math.floor(ys.length * .02)], b2 = ys[Math.ceil(ys.length * .98) - 1]; if (lo < a2 - 25) lo = a2; if (hi > b2 + 25) hi = b2; }
  e = { N: F.N, total, ys, r: [lo, hi] };
  if (PM_SOLO_YEARS.size > 12) PM_SOLO_YEARS.clear();
  PM_SOLO_YEARS.set(key, e); return e;
}
// three quick ranges that each hold about a third of the painter's dated works (so "Late" is never empty)
function pmSoloPresets(e) {
  const n = e.ys.length, [lo, hi] = e.r;
  if (n < 9 || hi - lo < 3) return [];
  const q1 = e.ys[Math.floor(n / 3)], q2 = e.ys[Math.floor(2 * n / 3)], qm = e.ys[Math.floor(n / 2)];
  if (lo < q1 && q1 < q2 && q2 < hi) return [["early", "Early years", lo, q1], ["middle", "Middle years", q1 + 1, q2], ["late", "Late years", q2 + 1, hi]];
  if (lo < qm && qm < hi) return [["early", "Early years", lo, qm], ["late", "Late years", qm + 1, hi]];   // the work is bunched into few years: halves
  return [];
}
// a dot of each hue family's own color on its chip (the same nine names as XB_FAMS)
const PM_HUE_DOT = ["#C0392B", "#E8A0B4", "#E07B1F", "#8A5A2B", "#E8C547", "#5B8C3A", "#3A6EA5", "#7D5BA6", "#8A8A8A"];
function pmParse(q, F) {
  const s = pmFresh(), p = new URLSearchParams(String(q || "").replace(/^\?/, ""));
  s.col = (F && F.col) || "paintings";
  const a = p.get("arr"); if (PM_ARR.some(x => x[0] === a)) s.arr = a;
  const pl = p.get("pl"); if (PM_PLACE.some(x => x[0] === pl)) s.place = pl;
  const f = s.f, num = k => { const v = p.get(k); return v != null && v !== "" && isFinite(+v) ? +v : null; };
  const uy = num("uy"); if (uy != null) s.upToYear = uy;
  const mg = num("mag"); if (mg != null) s.mag = clamp(mg, 0, 1);
  if (p.get("lk") === "isl" || p.get("lk") === "grid") s.lkl = p.get("lk");   // By look settings (the address wins over this phone's saved choice)
  const lsp = num("lsp"); if (lsp != null) s.lks = clamp(lsp, 0, 1);
  if (/^(0|30|60)$/.test(p.get("lc") || "")) s.lkc = +p.get("lc");
  if (p.get("lb") === "0" || p.get("lb") === "1") s.lkb = +p.get("lb");
  if (p.get("c")) { f.hexes = p.get("c").split(",").filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => "#" + h.toUpperCase()); f.name = f.hexes.length === 1 ? (p.get("nm") ? p.get("nm").slice(0, 60) : nameOf(f.hexes[0]).text) : ""; f.tol = num("t") || 8; f.cover = num("m") != null ? num("m") : 2; }
  if (p.get("cm") === "all") f.colorMode = "all";
  if (p.get("cm") === "overall" && f.hexes.length) {
    f.colorMode = "overall"; f.tol = Math.min(f.tol, PM_PAL_MAX); if (p.get("at") === "1") f.auto = 1; if (p.get("nm")) f.name = p.get("nm").slice(0, 60);
    const sh = (p.get("sh") || "").split(",").map(Number).filter(x => isFinite(x) && x >= 0);
    f.shares = sh.length === f.hexes.length ? sh : f.hexes.map(() => 1 / f.hexes.length);
  }
  const on = num("on"); if (on != null && on >= 0 && F && on < F.N) s.on = on;   // a painting page's chip: open the map with THIS painting in the middle (never written back to the address)
  if (p.get("hit") === "1") s.hit = 1;   // an entry point from a color or a palette: open centered on the closest match (never written back to the address)
  f.y0 = num("y0"); f.y1 = num("y1");
  const hb = num("hb"); if (hb != null && hb >= 0 && hb < 9) f.hueBand = hb;
  const l0 = num("l0"), l1 = num("l1"); if (l0 != null) f.l0 = l0; if (l1 != null) f.l1 = l1;
  const ix = (list, v) => v ? list.findIndex(x => routeSlug(x) === routeSlug(v)) + 1 : 0;
  const ixSet = (list, csv) => csv ? csv.split(",").map(v => ix(list, v)).filter(v => v > 0) : [];
  if (p.get("p")) f.painterSet = p.get("p").split(",").map(sl => F.slugIx.get(sl) || 0).filter(v => v > 0);
  f.coSet = ixSet(F.meta.countries, p.get("co")); f.mvSet = ixSet(F.meta.movements, p.get("mv"));
  const rg = p.get("region"); if (rg && PM_REGIONS.some(r => r[0] === rg)) { f.region = rg; pmRegionCountries(rg, F).forEach(v => { if (!f.coSet.includes(v)) f.coSet.push(v); }); }
  if (p.get("mus")) f.musSet = p.get("mus").split(",").map(k => F.G.src.findIndex(x => x.k === k)).filter(v => v >= 0);
  if (p.get("type") && F.meta.types) f.tySet = p.get("type").split(",").map(v => F.meta.types.findIndex(t => routeSlug(t) === v) + 1).filter(v => v > 0);
  if (p.get("subj") && SUBJ) f.subjSet = p.get("subj").split(",").map(k => SUBJ.tags.findIndex(n => routeSlug(n) === k)).filter(v => v >= 0);
  if (p.get("rnd") === "1") s.rnd = 1;   // a cold start: js/boot.js asks for a random cluster of the big map (never written back to the address)
  const sd = num("seed"); if (sd != null && sd >= 0 && sd < F.N) s.seed = sd;
  if (p.get("walk") === "1" && s.seed >= 0) s.walkStart = 1;   // the painting page's "Walk from here": take the first step on arrival
  if (p.get("fav") === "1") s.fav = 1;
  if (PM_NEEDS_SEED.has(s.arr) && s.seed < 0) s.arr = "color";
  if (!pmArrOk(s)) s.arr = "color";   // By painter / Families mean nothing for one painter; By museum only means something for one
  return s;
}
function pmQS(s, F) {
  const f = s.f, out = [["arr", s.arr]];
  const col = s.col || (F && F.col) || "paintings"; if (col !== "paintings") out.push(["col", col]);
  if (s.place && s.place !== "avg") out.push(["pl", s.place]);
  if (s.arr === "look") { const o = pmLk(s); out.push(["lk", o.lay], ["lsp", +o.sp.toFixed(2)], ["lc", o.col], ["lb", o.lab]); }
  if (f.hexes.length) { out.push(["c", f.hexes.map(h => h.slice(1).toLowerCase()).join(",")], ["t", f.tol], ["m", f.cover]); if (f.hexes.length > 1 && f.colorMode === "all") out.push(["cm", "all"]); if (f.colorMode === "overall") { out.push(["cm", "overall"], ["sh", (f.shares || []).join(",")]); if (f.name) out.push(["nm", f.name]); } else if (f.hexes.length === 1 && f.name && f.name !== nameOf(f.hexes[0]).text) out.push(["nm", f.name]); }   // a color keeps the name it was opened with (an archive name, "Your color") across reloads and shares
  if (f.y0 != null) out.push(["y0", f.y0]); if (f.y1 != null) out.push(["y1", f.y1]);
  if (f.hueBand != null) out.push(["hb", f.hueBand]);
  if (f.l0 != null) out.push(["l0", f.l0]); if (f.l1 != null) out.push(["l1", f.l1]);
  if (f.painterSet && f.painterSet.length && F) out.push(["p", f.painterSet.map(v => F.meta.artists[v - 1][1]).join(",")]);
  if (f.region) out.push(["region", f.region]);
  const extraCo = f.region ? (f.coSet || []).filter(v => !pmRegionCountries(f.region, F).includes(v)) : (f.coSet || []);
  if (extraCo.length && F) out.push(["co", extraCo.map(v => F.meta.countries[v - 1]).join(",")]);
  if (f.mvSet && f.mvSet.length && F) out.push(["mv", f.mvSet.map(v => F.meta.movements[v - 1]).join(",")]);
  if (f.musSet && f.musSet.length && F) out.push(["mus", f.musSet.map(v => F.G.src[v].k).join(",")]);
  if (f.tySet && f.tySet.length && F && F.meta.types) out.push(["type", f.tySet.map(v => routeSlug(F.meta.types[v - 1])).join(",")]);
  if (f.subjSet && f.subjSet.length && SUBJ) out.push(["subj", f.subjSet.map(v => routeSlug(SUBJ.tags[v])).join(",")]);
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
  const q = typeof spec === "string" ? spec.replace(/^\?/, "").replace(/(^|&)rnd=1(?=&|$)/, "").replace(/^&/, "") : F ? pmQS(spec, F) : (col !== "paintings" ? "col=" + encodeURIComponent(col) : "");
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
    c.push({ dim: "color", text: names.length === 1 ? (f.name || names[0]) : f.name ? f.name : f.colorMode === "overall" ? `Palette of ${names.length} colors` : f.colorMode === "all" ? `Holds all ${names.length} colors` : `Any of ${names.length} colors` });
  }
  if (f.hueBand != null) c.push({ dim: "hueBand", text: XB_HUE_WORDS[f.hueBand] });
  if (f.l0 != null || f.l1 != null) c.push({ dim: "l", text: f.l0 != null && f.l1 != null ? `Lightness ${f.l0}–${f.l1}` : f.l0 != null ? `Lighter than ${f.l0}` : `Darker than ${f.l1}` });
  if (f.painterSet && f.painterSet.length) c.push({ dim: "painter", text: f.painterSet.length === 1 ? xbArtistName(F, f.painterSet[0]) : `${f.painterSet.length} painters` });
  if (f.mvSet && f.mvSet.length) c.push({ dim: "mv", text: f.mvSet.length === 1 ? F.meta.movements[f.mvSet[0] - 1] : `${f.mvSet.length} movements` });
  if (f.musSet && f.musSet.length) c.push({ dim: "mus", text: f.musSet.length === 1 ? F.G.src[f.musSet[0]].short : `${f.musSet.length} museums` });
  if (f.tySet && f.tySet.length && F.meta.types) c.push({ dim: "ty", text: f.tySet.length === 1 ? F.meta.types[f.tySet[0] - 1] : `${f.tySet.length} types` });
  if (f.subjSet && f.subjSet.length && SUBJ) c.push({ dim: "subj", text: subjSetLabel(f.subjSet) });
  return c;
}
// ---------- Phase B: presets under a painting (David, 2026-10-24) ----------
// "pre-built filters ... everything by this painter, painters from the same country, from the same era". Each is a patch on
// the ordinary filter spec (the same facets the Filter sheet sets), so every preset narrows the map, shows as the usual
// removable chip, goes through Phase A's focus rule, and a second tap on it removes it. A preset knows how to apply itself,
// how to undo itself and whether it is on right now.
const pmSameSet = (a, b) => !!a && a.length === b.length && b.every(x => a.includes(x));
const pmIsEst = (i, F) => !!(F.G === GAL && typeof glYearEst === "function" && glYearEst(i));
// the years around a painting: +-half, widened by half the estimate's own range when the year is only estimated (honest: "around")
function pmEraSpan(i, F, half) {
  const y = F.G.year[i]; if (y === GL_UNDATED) return null;
  const sp = F.G === GAL && GAL.yspan ? GAL.yspan[i] || 0 : 0, w = half + Math.ceil(sp / 2);
  return [y - w, y + w];
}
function pmDecadeSpan(i, F) {
  const y = F.G.year[i]; if (y === GL_UNDATED) return null;
  const y0 = y < 1500 ? Math.floor(y / 100) * 100 : Math.floor(y / 10) * 10;
  return [y0, y < 1500 ? y0 + 99 : y0 + 9];
}
// a painting's own palette as a search: its (up to six) swatches and their shares
function pmPaletteOf(i, F) {
  if (F.col && F.col !== "paintings") return null;
  const G = F.G, hexes = [], shares = [];
  for (let j = 0; j < 6; j++) { const sh = G.sh[i * 6 + j]; if (!(sh > 0)) continue; hexes.push(glHex(i, j).toUpperCase()); shares.push(sh); }
  const tot = shares.reduce((a, b) => a + b, 0) || 1;
  return hexes.length ? { hexes, shares: shares.map(x => Math.round(x / tot * 1000) / 1000) } : null;
}
const PM_PAL_CLOSE = PM_PAL_MAX;   // where a painting's own palette starts (f.auto then tightens it to the smallest setting that still leaves ~48 paintings)
function pmTogglesOf(i, F) {
  const out = [], G = F.G, lbl = k => pmColLabel(F, k).toLowerCase();
  const a = F.artist[i], c = F.country[i], mv = F.mv ? F.mv[i] : 0, mus = G.mus ? G.mus[i] : -1;
  const est = pmIsEst(i, F), aroundOr = (t) => est ? t.replace(/^Same/, "Around the same") : t;
  const when = (sp) => ({ patch: f => { f.y0 = sp[0]; f.y1 = sp[1]; }, clear: f => { f.y0 = null; f.y1 = null; }, on: f => f.y0 === sp[0] && f.y1 === sp[1] });
  if (a) out.push({ id: "painter", group: "who", label: "Same " + lbl("painter"), sub: xbArtistName(F, a), patch: f => { f.painterSet = [a]; f.painter = 0; }, clear: f => { f.painterSet = []; f.painter = 0; }, on: f => pmSameSet(f.painterSet, [a]) });
  if (c) out.push({ id: "co", group: "where", label: !F.col || F.col === "paintings" ? "Same country" : "Same " + lbl("co"), sub: F.meta.countries[c - 1], patch: f => { f.coSet = [c]; f.region = null; }, clear: f => { f.coSet = []; f.co = 0; f.region = null; }, on: f => pmSameSet(f.coSet, [c]) });
  if (mv && F.meta.movements) out.push({ id: "mv", group: "where", label: "Same " + lbl("mv"), sub: F.meta.movements[mv - 1], patch: f => { f.mvSet = [mv]; f.mv = 0; }, clear: f => { f.mvSet = []; f.mv = 0; }, on: f => pmSameSet(f.mvSet, [mv]) });
  if (mus >= 0 && G.src && G.src[mus]) out.push({ id: "mus", group: "where", label: "Same " + lbl("mus"), sub: G.src[mus].short, patch: f => { f.musSet = [mus]; f.mus = -1; }, clear: f => { f.musSet = []; f.mus = -1; }, on: f => pmSameSet(f.musSet, [mus]) });
  const dec = pmDecadeSpan(i, F);
  if (dec) out.push({ id: "decade", group: "when", label: aroundOr("Same decade"), sub: dec[0] < 1500 ? `${dec[0]}s–${dec[1]}` : `${dec[0]}–${dec[1]}`, ...when(dec) });
  return out;
}
const PM_WITHIN = [10, 25, 50, 100];
// the three chips under a painting, by what applies
function pmPresetsOf(i, F) {
  const out = [], a = F.artist[i], c = F.country[i], est = pmIsEst(i, F), near = pmEraSpan(i, F, 25), far = pmEraSpan(i, F, 50);
  if (a) out.push({ id: "painter", label: "Same " + pmColLabel(F, "painter").toLowerCase(), patch: f => { f.painterSet = [a]; f.painter = 0; }, clear: f => { f.painterSet = []; f.painter = 0; }, on: f => pmSameSet(f.painterSet, [a]) });
  if (near && c) out.push({ id: "erahere", label: est ? "Around the same era here" : "Same era here", patch: f => { f.coSet = [c]; f.region = null; f.y0 = near[0]; f.y1 = near[1]; }, clear: f => { f.coSet = []; f.co = 0; f.region = null; f.y0 = null; f.y1 = null; }, on: f => pmSameSet(f.coSet, [c]) && f.y0 === near[0] && f.y1 === near[1] });
  if (far) out.push({ id: "era", label: est ? "Around the same era" : "Same era", patch: f => { f.y0 = far[0]; f.y1 = far[1]; }, clear: f => { f.y0 = null; f.y1 = null; }, on: f => f.y0 === far[0] && f.y1 === far[1] });
  return out;
}
const PM_COUNT_CACHE = new Map();
// how many paintings a patch would leave, on top of the filters already on (a live count; cached per filter state)
function pmPatchCount(s, F, p, i) {
  const key = i + "|" + p.id + "|" + JSON.stringify([s.f, s.fav, s.upToYear]) + "|" + F.N;
  if (PM_COUNT_CACHE.has(key)) return PM_COUNT_CACHE.get(key);
  const sp = pmCloneSpec(s); p.patch(sp.f);
  const n = pmList(sp, F).length;
  if (PM_COUNT_CACHE.size > 80) PM_COUNT_CACHE.clear();
  PM_COUNT_CACHE.set(key, n); return n;
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
  else if (dim === "color") { f.hexes = []; f.name = ""; f.colorMode = "any"; f.shares = null; }
  else if (dim === "hueBand") f.hueBand = null;
  else if (dim === "l") { f.l0 = null; f.l1 = null; }
  else if (dim === "painter") { f.painterSet = []; f.painter = 0; }
  else if (dim === "mv") { f.mvSet = []; f.mv = 0; }
  else if (dim === "mus") { f.musSet = []; f.mus = -1; }
  else if (dim === "ty") f.tySet = [];
  else if (dim === "subj") f.subjSet = [];
}

// ---------- Phase A: the painting you are on stays put (David, 2026-10-24) ----------
// A settings change never moves you away from the painting you are looking at. build() lands on it again through one
// choke point (pmMount's focusLand); these are its pure parts.
// The painting in the new list that looks most like gallery item i: the mean color (CIELAB, by area), ties by year.
function pmNearestInColor(lay, i, F) {
  const G = (F && F.G) || GAL, m = G.mean, q = i * 3, y0 = G.year[i] === GL_UNDATED ? null : G.year[i];
  let best = -1, bd = Infinity;
  for (let k = 0; k < lay.n; k++) {
    const j = lay.items[k], a = m[j * 3] - m[q], b = m[j * 3 + 1] - m[q + 1], c = m[j * 3 + 2] - m[q + 2];
    let d = a * a + b * b + c * c;
    if (y0 != null && G.year[j] !== GL_UNDATED) d += Math.abs(G.year[j] - y0) * 1e-4;   // a tie-break only: color decides
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
const pmCloneSpec = s => ({ ...s, f: JSON.parse(JSON.stringify(s.f)) });
// Why gallery item i is not in the list, and the smallest change that brings it back (one step per filter facet).
// -> { text: "1750–1850", fix(s) } or null when it is already there.
function pmOutsideWhy(s, F, i) {
  const G = (F && F.G) || GAL, has = sp => pmList(sp, F).includes(i);
  if (has(s)) return null;
  const y = G.year[i], chips = pmActiveChips(s, F);
  if (s.upToYear != null) chips.push({ dim: "uy", text: "Up to " + s.upToYear });
  const widen = {
    when: sp => { const f = sp.f; if (y === GL_UNDATED) { f.y0 = null; f.y1 = null; } else { if (f.y0 != null) f.y0 = Math.min(f.y0, y); if (f.y1 != null) f.y1 = Math.max(f.y1, y); } },
    uy: sp => { if (y === GL_UNDATED) sp.upToYear = null; else sp.upToYear = Math.max(sp.upToYear, y); },
    co: sp => { const f = sp.f; f.coSet = [...new Set([...(f.coSet || []), F.country[i]].filter(Boolean))]; f.region = null; },
    painter: sp => { const f = sp.f; f.painterSet = [...new Set([...(f.painterSet || []), F.artist[i]].filter(Boolean))]; },
    mv: sp => { const f = sp.f; f.mvSet = [...new Set([...(f.mvSet || []), F.mv[i]].filter(Boolean))]; },
    mus: sp => { const f = sp.f; f.musSet = [...new Set([...(f.musSet || []), G.mus[i]])]; }
  };
  const drop = (sp, dim) => { if (dim === "uy") sp.upToYear = null; else if (dim === "fav") sp.fav = 0; else pmChipClear(sp.f, dim); };
  const copyInto = (t, sp) => { const nx = pmCloneSpec(sp); t.f = nx.f; t.fav = nx.fav; t.upToYear = nx.upToYear; };
  for (const c of chips) {
    const sp = pmCloneSpec(s);
    if (widen[c.dim]) widen[c.dim](sp); else drop(sp, c.dim);
    if (!has(sp)) { sp.f = pmCloneSpec(s).f; sp.upToYear = s.upToYear; sp.fav = s.fav; drop(sp, c.dim); }   // widening was not enough: remove that one filter
    if (has(sp)) return { text: c.text, fix: t => copyInto(t, sp) };
  }
  const sp = pmCloneSpec(s); chips.forEach(c => { if (!has(sp)) drop(sp, c.dim); });
  return { text: "your filters", fix: t => copyInto(t, sp) };
}

// ---------- the smarter map search (David, 2026-10-20) ----------
// "Russia 1860-80s", "Dutch Baroque", "Monet 1890s": a query is split into pieces the map already has facets for
// (country, movement, years, painter), each shown as a tappable suggestion row with a live count, and applied as
// the same removable filter chips the Filter tab makes. Pure parsing here; counting and the sheet live in openFind().
const PMQ_DEMONYMS = {
  "Afghanistan": ["afghan"], "Austria": ["austrian"], "Belgium": ["belgian", "flemish"], "Brazil": ["brazilian"], "Canada": ["canadian"],
  "China": ["chinese"], "Cuba": ["cuban"], "Czechia": ["czech", "bohemian"], "Denmark": ["danish", "dane"], "Egypt": ["egyptian"],
  "Estonia": ["estonian"], "Finland": ["finnish"], "France": ["french"], "Germany": ["german"], "Greece": ["greek"],
  "Guatemala": ["guatemalan"], "Hungary": ["hungarian"], "India": ["indian"], "Iran": ["iranian", "persian", "persia"], "Ireland": ["irish"],
  "Italy": ["italian"], "Japan": ["japanese"], "Korea": ["korean"], "Mexico": ["mexican"], "Mongolia": ["mongolian"],
  "Nepal": ["nepalese", "nepali"], "Netherlands": ["dutch", "holland", "netherlandish"], "Norway": ["norwegian"], "Pakistan": ["pakistani"],
  "Peru": ["peruvian"], "Poland": ["polish"], "Portugal": ["portuguese"], "Romania": ["romanian"], "Russia": ["russian"],
  "Spain": ["spanish"], "Sri Lanka": ["sri lankan", "ceylon"], "Sweden": ["swedish", "swede"], "Switzerland": ["swiss"], "Tibet": ["tibetan"],
  "Turkey": ["turkish", "ottoman"], "United Kingdom": ["british", "english", "britain", "england", "uk", "scottish", "scotland", "welsh"],
  "United States": ["american", "america", "usa", "us"], "Uzbekistan": ["uzbek"], "Australia": ["australian"], "Algeria": ["algerian"], "Ethiopia": ["ethiopian"]
};
const PMQ_STOP = new Set(["paintings", "painting", "art", "artwork", "artworks", "works", "by", "from", "in", "of", "the", "and", "between", "painters", "painter", "during", "around", "circa", "a", "an", "to", "until", "through"]);
// where a movement tag is sparse or missing on the map, its textbook era still answers the question (shown as its own row)
const PMQ_ERAS = { baroque: [1600, 1750, "Baroque era"], renaissance: [1400, 1600, "Renaissance"], rococo: [1730, 1790, "Rococo era"], romantic: [1800, 1850, "Romantic era"], neoclassic: [1760, 1830, "Neoclassical era"] };
const PMQ_ORDER = { painter: 0, co: 1, mv: 2, subj: 2.5, when: 3 };
const pmqKey = w => String(w).toLowerCase().replace(/[^a-z0-9]/g, "");
const pmqStem = k => { const r = k.replace(/(ical|istic|ists|ist|ism|ic|al)$/, ""); return r.length >= 4 ? r : k; };
const pmqCache = new WeakMap();
function pmqTables(F) {
  let T = pmqCache.get(F); if (T) return T;
  const co = new Map(), cname = new Map(), mv = new Map();
  F.meta.countries.forEach((n, j) => {
    const dm = PMQ_DEMONYMS[n] || [];
    co.set(pmqKey(n), j + 1); cname.set(j + 1, dm[0] ? dm[0][0].toUpperCase() + dm[0].slice(1) : n);
    dm.forEach(d => { if (!co.has(pmqKey(d))) co.set(pmqKey(d), j + 1); });
  });
  F.meta.movements.forEach((n, j) => { const st = pmqStem(pmqKey(n)); if (!mv.has(st)) mv.set(st, j + 1); });
  const rg = new Map(PM_REGIONS.map(r => [pmqKey(r[1]), r]));
  rg.set("european", PM_REGIONS[0]);
  pmqCache.set(F, T = { co, cname, mv, rg }); return T;
}
const pmqYr = (a, b) => ({ y0: a, y1: b, label: a === b ? String(a) : `${a}–${b}` });
// years: 1888 / 1880s / 1800s / 1860-80 / 1860–80s / 1860 to 1880 / 19th century / late 1800s / early 1880s
function pmqYears(t) {
  let m;
  const part = (a, c, n) => n === 10 ? (c === "early" ? [a, a + 3] : c === "mid" ? [a + 4, a + 6] : [a + 7, a + 9]) : c === "early" ? [a, a + Math.round(n * .33) - 1] : c === "mid" ? [a + Math.round(n * .33), a + Math.round(n * .67) - 1] : [a + Math.round(n * .67), a + n - 1];
  if ((m = t.match(/\b(early|mid|late)[ -]+(?:(\d{1,2})(?:st|nd|rd|th)[ -]+century|(1\d{3}|20\d{2})s)\b/))) {
    const cen = m[2] ? (+m[2] - 1) * 100 : +m[3], span = m[2] || +m[3] % 100 === 0 ? 100 : 10;
    const [y0, y1] = part(cen, m[1], span);
    return { ...pmqYr(y0, y1), rest: t.replace(m[0], " ") };
  }
  if ((m = t.match(/\b(1\d{3}|20\d{2})(s)?\s*(?:-|to|until|through)\s*(1\d{3}|20\d{2}|\d{2})(s)?\b/))) {
    const a = +m[1]; let b = +m[3];
    if (m[3].length === 2) { b = Math.floor(a / 100) * 100 + b; if (b < a) b += 100; }
    if (m[4] && b % 10 === 0) b += 9;
    if (b >= a) return { ...pmqYr(a, b), rest: t.replace(m[0], " ") };
  }
  if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)[ -]+century\b/))) { const c = (+m[1] - 1) * 100; return { ...pmqYr(c, c + 99), rest: t.replace(m[0], " ") }; }
  if ((m = t.match(/\b(1\d{3}|20\d{2})s\b/))) { const a = +m[1]; return { ...pmqYr(a, a + (a % 100 === 0 && a < 2000 ? 99 : 9)), rest: t.replace(m[0], " ") }; }
  if ((m = t.match(/\b(1\d{3}|20\d{2})\b/))) return { ...pmqYr(+m[1], +m[1]), rest: t.replace(m[0], " ") };
  return null;
}
// -> { pieces: [{kind:"when"|"co"|"mv", label, ...}], rest }   (a painter is added by the caller from what is left in rest)
function pmqParse(q, F) {
  let t = " " + q.toLowerCase().replace(/[‐-―−]/g, "-").replace(/[,;:!?()"“”]/g, " ") + " ";
  const pieces = [], yr = pmqYears(t);
  if (yr) { t = yr.rest; pieces.push({ kind: "when", y0: yr.y0, y1: yr.y1, label: yr.label }); }
  const T = pmqTables(F), words = t.split(/\s+/).filter(Boolean), used = words.map(() => false);
  for (let i = 0; i < words.length; i++) {
    if (used[i]) continue;
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      const k = pmqKey(words.slice(i, i + len).join("")); if (!k) continue;
      let hit = null;
      if (T.co.has(k)) { const ix = T.co.get(k); hit = { kind: "co", vals: [ix], label: F.meta.countries[ix - 1], adj: T.cname.get(ix) }; }
      else if (T.rg.has(k)) { const r = T.rg.get(k); hit = { kind: "co", vals: pmRegionCountries(r[0], F), region: r[0], label: r[1], adj: r[1] }; }
      else {
        const st = pmqStem(k), ix = T.mv.get(st), era = PMQ_ERAS[st];
        if (ix || era) hit = { kind: "mv", val: ix || 0, era: era || null, label: ix ? F.meta.movements[ix - 1] : era[2] };
      }
      if (!hit && (F.col || "paintings") === "paintings" && typeof subjFind === "function") {   // a subject: "boats", "dogs", "still life", "portraits"
        const sj = subjFind(words.slice(i, i + len));
        if (sj) hit = { kind: "subj", vals: sj.tags, label: sj.label };
      }
      if (!hit || (hit.kind === "co" && !hit.vals.length)) continue;
      const prev = (hit.kind === "co" || hit.kind === "subj") && pieces.find(p => p.kind === hit.kind);
      if (prev && hit.kind === "subj") { prev.vals = [...new Set([...prev.vals, ...hit.vals])]; prev.label += " + " + hit.label; }
      else if (prev && !prev.region && !hit.region) { prev.vals.push(...hit.vals); prev.label += " + " + hit.label; prev.adj += " or " + hit.adj; }
      else if (!pieces.some(p => p.kind === hit.kind)) pieces.push(hit);
      for (let j = 0; j < len; j++) used[i + j] = true;
      i += len - 1; break;
    }
  }
  let left = words.filter((w, i) => !used[i]);
  if (pieces.length) left = left.filter(w => !PMQ_STOP.has(w));
  return { pieces, rest: left.join(" ").trim() };
}
// put one piece on a filter spec (in place); the Filter tab's own fields, so the usual removable chips appear
function pmqApply(f, p) {
  if (p.kind === "when") { f.y0 = p.y0; f.y1 = p.y1; }
  else if (p.kind === "co") { f.coSet = p.vals.slice(); f.co = 0; f.region = p.region || null; }
  else if (p.kind === "mv") { f.mvSet = [p.val]; f.mv = 0; }
  else if (p.kind === "painter") { f.painterSet = [p.val]; f.painter = 0; }
  else if (p.kind === "subj") f.subjSet = p.vals.slice();
}

// ---------- the list: the filters, then your favorites ----------
const pmHidN = F => GAL && GAL.hidIdx && (!F || (F.col || "paintings") === "paintings") ? GAL.hidIdx.length : 0;   // hidden non-artworks (hidden.json) never reach a list
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
  // a desktop window is landscape: a small map (one painter, a filtered set) is framed like the window, not like a phone
  // (html.desk, js/desktop.js; the whole museum's map keeps its own shape, its thumbnails are cut for it)
  const n = list.length, deskA = n <= 4000 && document.documentElement.classList.contains("desk") ? Math.min(1.7, innerWidth / Math.max(320, innerHeight - 70)) : 0;
  const cols = Math.max(1, Math.round(deskA ? Math.sqrt(n * deskA) : Math.sqrt(n / 1.55))), rows = Math.ceil(n / cols);
  const Lp = new Float32Array(n), Ap = new Float32Array(n), Bp = new Float32Array(n);
  for (let k = 0; k < n; k++) { const c = pmPlaceLab(list[k], place, F); Lp[k] = c[0]; Ap[k] = c[1]; Bp[k] = c[2]; }
  const L = k => Lp[k], A = k => Ap[k], B = k => Bp[k];
  const idx = Array.from({ length: n }, (_, k) => k);
  // the near-neutral paintings (chroma under 5) used to sit in one block mid-sequence, which read as a grey stripe cutting the hue
  // order in two (David, 2026-10-21). Now the hue order runs unbroken (warm to greens to blues to purples) and the greys form their
  // own band at the far right edge. The band is ordered cool-to-warm by the slight tint they do have (so the cool end meets the purples), which
  // keeps every grey column a full light-to-dark column like its neighbours: no white or black column, no hard edge.
  const isGrey = k => Math.hypot(A(k), B(k)) < 5;
  const chroma = idx.filter(k => !isGrey(k)).sort((p, q) => pmHueKey(A(p), B(p)) - pmHueKey(A(q), B(q)));
  const greys = idx.filter(isGrey).sort((p, q) => B(p) - B(q));
  const order = chroma.concat(greys);
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
function pmBand(i, F, yearly) {
  const G = (F && F.G) || GAL, y = G.year[i];
  if (y === GL_UNDATED) return { key: 1e6, label: "Undated" };
  if (yearly && y >= 1500) return { key: y, label: String(y) };
  if (y < 1500) { const c = Math.floor(y / 100) * 100; return { key: c, label: c < 0 ? `${-c} BCE` : `${c}–${c + 99}` }; }
  const d = Math.floor(y / 10) * 10; return { key: d, label: d + "s" };
}
function pmLayTime(list, place, F, wide) {
  // wide (a one-painter map): ~1,000 works in 14 columns made a 14x78 sliver on a phone; ~sqrt(n) columns frames it
  const n = list.length, Wc = wide ? Math.max(6, Math.min(30, Math.round(Math.sqrt(n) * .9))) : Math.max(3, Math.min(16, Math.round(Math.sqrt(n) / 2.2)));
  const bands = new Map();
  // a one-painter map whose work sits in a few decades gets a band per YEAR (a decade-only band would be one big block)
  const yearly = !!wide && new Set(Array.from(list, i => pmBand(i, F).key)).size <= 4;
  list.forEach(i => { const b = pmBand(i, F, yearly); if (!bands.has(b.key)) bands.set(b.key, { ...b, items: [] }); bands.get(b.key).items.push(i); });
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
  const n = list.length, Wc = o.wc ? o.wc(n) : Math.max(4, Math.min(18, Math.round(Math.sqrt(n) / 1.6)));
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
// By museum (one-painter maps): the same shelves, one block per museum holding the painter's works, the biggest first.
function pmLayMuseum(list, F) {
  return pmLayGroup(list, {
    groupOf: i => F.G.mus[i], sortWithin: (p, q) => pmYr(p, F) - pmYr(q, F),
    label: (m, c) => F.G.src[m] ? F.G.src[m].short : "Elsewhere",
  });
}
// By subject: one block per genre (portraits, landscapes, still lifes...), the biggest first, "Other subjects" last. A painting is filed
// under its first genre tag, authority and title before detected (js/gallery.js subjGenreOf).
function pmLaySubject(list, F) {
  return pmLayGroup(list, {
    groupOf: i => subjGenreOf(i), sortWithin: (p, q) => pmYr(p, F) - pmYr(q, F),
    keyRank: g => g < 0 ? 1 : 0,
    wc: n => Math.max(8, Math.round(Math.sqrt(n) * 1.3)),   // a few big blocks side by side, not one tall column (74,000 paintings at 18 across is 4,000 rows)
    label: g => subjGenreLabel(g),
  });
}
// By look (David, 2026-10-24: "a map arranged by vibe"). The image model's own distances (CLIP, 512-d -> UMAP, tools/look_layout.py) put
// paintings it finds alike near each other. Two layouts of the same cloud, both built offline:
//   Islands (default)  data/gallery/look-islands.bin: the cloud's natural clusters, each a compact roundish blob of even cells, set apart
//                      at their UMAP centroids with plain empty space between (nothing is drawn there). Names come from look.json.
//   Even grid          data/gallery/look.bin: one even rectangle, every painting one cell.
// "Photo-format effect: Reduce" swaps in look-reduced*.json/.bin (same pipeline, vectors centered per museum). Everything loads lazily:
// look.json (small, has the island table) when a painting map opens, a .bin only when its layout is first drawn.
// A missing, short or stale file (n or hash not matching) hides the option; a shared address that names it falls back to color.
const PM_LOOK = { st: 0, meta: null, pm: null, rp: null, V: { keep: null, c30: null, c60: null } };   // st: 0 unknown, 2 ready, 3 unavailable. V[v] = { meta, grid, isl, bad }
const PM_LK_DEF = { lay: "isl", sp: .05, col: 30, lab: 1 };
// the window shape the island cloud is stretched to (a phone is tall, a desktop wide), in quarter steps so a resize does not relay out every frame
const pmLookAsp = () => clamp(Math.round(innerWidth / Math.max(300, innerHeight) * 4) / 4, .4, 2);
const PM_LK_KEY = "pm-look-opts";
function pmLkSaved() { try { const o = JSON.parse(localStorage.getItem(PM_LK_KEY)); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function pmLkSave(o) { try { localStorage.setItem(PM_LK_KEY, JSON.stringify(o)); } catch (e) {} }
// The four By look settings, resolved: the address (s.lk*) wins, then what this phone last chose, then the defaults.
// col = Color influence: 0 None, 30 Some, 60 A lot (the weight of the painting's own colors against the image model's view when the cloud was laid out)
function pmLk(s) {
  const sv = pmLkSaved(), pick = (a, b, d) => a != null ? a : b != null ? b : d;
  const col = +pick(s.lkc, sv.col, PM_LK_DEF.col);
  return { lay: pick(s.lkl, sv.lay, PM_LK_DEF.lay) === "grid" ? "grid" : "isl", sp: clamp(+pick(s.lks, sv.sp, PM_LK_DEF.sp), 0, 1),
    col: col >= 45 ? 60 : col >= 15 ? 30 : 0, lab: +pick(s.lkb, sv.lab, PM_LK_DEF.lab) ? 1 : 0 };
}
const PM_LOOK_FILES = { keep: { json: "look.json", grid: "look.bin", isl: "look-islands.bin" }, c30: { json: "look-c30.json", isl: "look-islands-c30.bin" }, c60: { json: "look-c60.json", isl: "look-islands-c60.bin" } };
const PM_LOOK_COLS = [[0, "None", "keep"], [30, "Some", "c30"], [60, "A lot", "c60"]];
// the data variant a spec actually uses for Islands (a color variant that is missing or broken quietly falls back to None)
function pmLookV(s) { const w = pmLk(s).col, v = w ? "c" + w : "keep", D = PM_LOOK.V[v]; return D && D.meta && !D.dead ? v : "keep"; }
function pmLookKind(s) {
  const D = PM_LOOK.V[pmLookV(s)];
  return pmLk(s).lay === "isl" && D && D.meta && D.meta.islands && !D.bad.isl ? "isl" : "grid";
}
const pmLookHave = s => { const k = pmLookKind(s), D = PM_LOOK.V[k === "isl" ? pmLookV(s) : "keep"]; return !!D && !!D[k]; };
const pmLookReady = s => PM_LOOK.st === 2 && pmLookHave(s);
const pmLookShown = s => (s.col || "paintings") === "paintings" && !!PM_LOOK.meta && PM_LOOK.st !== 3;
const pmLookColsOn = () => PM_LOOK_COLS.filter(c => { const D = PM_LOOK.V[c[2]]; return D && D.meta && !D.dead && !D.bad.isl; });
const pmLookHasIsl = () => !!(PM_LOOK.V.keep && PM_LOOK.V.keep.meta && PM_LOOK.V.keep.meta.islands && !PM_LOOK.V.keep.bad.isl);
function pmLookProbeOne(F, v) {
  return fetch("data/gallery/" + PM_LOOK_FILES[v].json).then(r => r.ok ? r.json() : null).then(m => {
    if (m && m.v === 1 && m.n === F.N) PM_LOOK.V[v] = { meta: m, grid: null, isl: null, bad: {}, pb: {}, dead: false }; else m = null;
    return m;
  });
}
function pmLookProbe(F) {   // the small files: is there a look map for exactly this gallery?
  if (PM_LOOK.pm) return PM_LOOK.pm;
  PM_LOOK.rp = Promise.all(["c30", "c60"].map(v => pmLookProbeOne(F, v).catch(() => null)));   // the optional Color influence variants, in parallel
  return PM_LOOK.pm = pmLookProbeOne(F, "keep").then(m => { if (m) PM_LOOK.meta = m; else PM_LOOK.st = 3; return PM_LOOK.meta; }).catch(() => { PM_LOOK.pm = null; return null; });
}
function pmLookBin(F, v, kind) {   // one .bin into typed arrays; false when it is missing or does not match
  const D = PM_LOOK.V[v], m = D.meta;
  if (D[kind]) return Promise.resolve(true);
  if (D.bad[kind]) return Promise.resolve(false);
  return D.pb[kind] || (D.pb[kind] = fetch("data/gallery/" + PM_LOOK_FILES[v][kind]).then(r => r.ok ? r.arrayBuffer() : null).then(b => {
    const dv = b && new DataView(b), hs = parseInt(m.hash, 16);
    if (kind === "grid") {
      if (!b || b.byteLength !== 24 + m.n * 4) throw 0;
      if (dv.getUint32(0, true) !== 0x4B4F4F4C || dv.getUint32(8, true) !== m.n || dv.getUint32(12, true) !== m.w || dv.getUint32(16, true) !== m.h || dv.getUint32(20, true) !== hs) throw 0;   // "LOOK", n, W, H, ids hash
      const x = new Uint16Array(m.n), y = new Uint16Array(m.n);
      for (let i = 0, o = 24; i < m.n; i++, o += 4) { x[i] = dv.getUint16(o, true); y[i] = dv.getUint16(o + 2, true); }
      D.grid = { n: m.n, W: m.w, H: m.h, x, y };
    } else {
      const K = m.islands.length;
      if (!b || b.byteLength !== 20 + m.n * 3) throw 0;
      if (dv.getUint32(0, true) !== 0x4C53494C || dv.getUint32(8, true) !== m.n || dv.getUint32(12, true) !== K || dv.getUint32(16, true) !== hs) throw 0;   // "LISL", n, islands, ids hash
      D.isl = { id: new Uint8Array(b, 20, m.n), lx: new Uint8Array(b, 20 + m.n, m.n), ly: new Uint8Array(b, 20 + 2 * m.n, m.n) };
    }
    return true;
  }).catch(() => { D.bad[kind] = true; return false; }));
}
function pmLookEnsure(F, s) {   // resolves true when By look can be drawn with this spec's settings
  s = s || {};
  if (PM_LOOK.st === 3) return Promise.resolve(false);
  if (PM_LOOK.st === 2 && pmLookReady(s)) return Promise.resolve(true);
  return pmLookProbe(F).then(m => {
    if (!m) { PM_LOOK.st = 3; return false; }
    return (pmLk(s).col ? PM_LOOK.rp : Promise.resolve(null)).then(() => {
      const kind = pmLookKind(s), v = kind === "isl" ? pmLookV(s) : "keep";
      return pmLookBin(F, v, kind).then(ok => {
        if (!ok && v !== "keep") PM_LOOK.V[v].dead = true;
        if (!ok) return pmLookBin(F, "keep", kind === "isl" ? "isl" : "grid").then(ok2 => ok2 || pmLookBin(F, "keep", "grid"));
        return true;
      });
    });
  }).then(ok => {
    if (ok && pmLookHave(s)) { PM_LOOK.st = 2; return true; }
    if (ok) return pmLookEnsure(F, s);   // the first choice failed and the fallback has now loaded: re-evaluate once
    if (!(PM_LOOK.V.keep && (PM_LOOK.V.keep.grid || PM_LOOK.V.keep.isl))) PM_LOOK.st = 3;
    return false;
  });
}
// Quickselect by rank so the median split below is linear per level: idx[lo..hi) is reordered so idx[k] holds the k-th smallest by c (all distinct).
// a random painting with a real neighborhood: well away from the edge of the layout, and with most of the cells around it filled
function pmRandomCluster(lay) {
  let best = -1, bestN = -1;
  for (let t = 0; t < 30; t++) {
    const k = Math.floor(Math.random() * lay.n), x = Math.round(lay.x[k]), y = Math.round(lay.y[k]);
    if (x - lay.gx0 < 14 || lay.gx0 + lay.GW - 1 - x < 14 || y - lay.gy0 < 14 || lay.gy0 + lay.GH - 1 - y < 14) continue;
    let n = 0; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (pmAt(lay, x + dx, y + dy) >= 0) n++;
    if (n > bestN) { best = k; bestN = n; }
    if (n >= 100) break;
  }
  return best >= 0 ? best : Math.floor(Math.random() * lay.n);
}
function pmSelect(idx, lo, hi, k, c) {
  let l = lo, r = hi - 1;
  while (l < r) {
    const pv = c[idx[(l + r) >> 1]]; let i = l, j = r;
    while (i <= j) { while (c[idx[i]] < pv) i++; while (c[idx[j]] > pv) j--; if (i <= j) { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; i++; j--; } }
    if (k <= j) r = j; else if (k >= i) l = i; else break;
  }
}
// The same recursive median split tools/look_layout.py uses: the W-wide raster of n cells is cut along its longer side, the points at the
// same proportion along the matching axis, down to one cell each. A filtered set therefore refills a compact, void-free grid and
// keeps the neighbors the full map had.
function pmEvenGrid(px, py, W) {
  const n = px.length, H = Math.ceil(n / W), X = new Int32Array(n), Y = new Int32Array(n), idx = new Int32Array(n);
  const cx = new Float64Array(n), cy = new Float64Array(n);
  for (let i = 0; i < n; i++) { idx[i] = i; cx[i] = px[i] * 262144 + i; cy[i] = py[i] * 262144 + i; }   // ties go by position in the list: deterministic
  const full = Math.floor(n / W), rem = n % W;
  const cells = (x0, x1, y0, y1) => { let t = Math.max(0, Math.min(y1, full) - y0) * (x1 - x0); if (y1 > full && full >= y0 && rem) t += Math.max(0, Math.min(x1, rem) - x0); return t; };
  const st = [[0, n, 0, W, 0, H]];
  while (st.length) {
    const [lo, hi, x0, x1, y0, y1] = st.pop();
    if (hi <= lo) continue;
    if (x1 - x0 === 1 && y1 - y0 === 1) { X[idx[lo]] = x0; Y[idx[lo]] = y0; continue; }
    let a, A, B, c;
    if (x1 - x0 >= y1 - y0 && x1 - x0 > 1) { const m = (x0 + x1) >> 1; a = cells(x0, m, y0, y1); A = [x0, m, y0, y1]; B = [m, x1, y0, y1]; c = cx; }
    else { const m = (y0 + y1) >> 1; a = cells(x0, x1, y0, m); A = [x0, x1, y0, m]; B = [x0, x1, m, y1]; c = cy; }
    if (a > 0 && lo + a < hi) pmSelect(idx, lo, hi, lo + a, c);
    st.push([lo, lo + a, ...A], [lo + a, hi, ...B]);
  }
  return { X, Y, H };
}
function pmLayLookGrid(list, L, F) {
  const n = list.length, items = Int32Array.from(list);
  let X, Y, W, H;
  if (n === L.n - pmHidN()) {   // the whole museum (minus the few hidden non-artworks): the stored cells as they are
    W = L.W; H = L.H; X = new Int32Array(n); Y = new Int32Array(n);
    for (let k = 0; k < n; k++) { X[k] = L.x[list[k]]; Y[k] = L.y[list[k]]; }
  } else {   // any filter: the same neighborhoods, refilled into a compact grid shaped like the other arrangements'
    const deskA = n <= 4000 && document.documentElement.classList.contains("desk") ? Math.min(1.7, innerWidth / Math.max(320, innerHeight - 70)) : 0;
    W = Math.max(1, Math.round(deskA ? Math.sqrt(n * deskA) : Math.sqrt(n / 1.55)));
    const px = new Float64Array(n), py = new Float64Array(n);
    for (let k = 0; k < n; k++) { px[k] = L.x[list[k]]; py[k] = L.y[list[k]]; }
    const g = pmEvenGrid(px, py, W); X = g.X; Y = g.Y; H = g.H;
  }
  const ox = W >> 1;
  for (let k = 0; k < n; k++) X[k] -= ox;
  return pmGridOf(items, X, Y, [], [0, Math.round(H / 2)]);
}
// ---- Islands. The same blob and the same recursive split tools/look_islands.py uses, so a filtered island refills as a compact blob.
// The n cells nearest the middle of a rotated, wavy ellipse, as {x, y} arrays shifted to start at 0.
function pmBlob(n, ang, aspect, seed) {
  const R = Math.floor(Math.sqrt(n / Math.PI) * aspect * 1.45) + 6, S = 2 * R + 1, tot = S * S;
  const c = Math.cos(ang), s = Math.sin(ang), sa = Math.sqrt(aspect), ph = [0, 1, 2].map(j => { const v = Math.sin(seed * 12.9898 + j * 78.233) * 43758.5453; return (v - Math.floor(v)) * 6.2832; });
  const d = new Float64Array(tot), ix = new Int32Array(tot);
  for (let t = 0; t < tot; t++) {
    const gx = (t % S) - R, gy = Math.floor(t / S) - R, u = (gx * c + gy * s) / sa, v = (-gx * s + gy * c) * sa, th = Math.atan2(v, u);
    d[t] = Math.hypot(u, v) / (1 + .09 * Math.sin(2 * th + ph[0]) + .06 * Math.sin(3 * th + ph[1]) + .035 * Math.sin(5 * th + ph[2])) * 4096 + t * 1e-6;   // ties by position
    ix[t] = t;
  }
  pmSelect(ix, 0, tot, n - 1, d);
  const cx = new Int32Array(n), cy = new Int32Array(n);
  let x0 = 1e9, y0 = 1e9;
  for (let k = 0; k < n; k++) { const t = ix[k]; cx[k] = (t % S) - R; cy[k] = Math.floor(t / S) - R; if (cx[k] < x0) x0 = cx[k]; if (cy[k] < y0) y0 = cy[k]; }
  for (let k = 0; k < n; k++) { cx[k] -= x0; cy[k] -= y0; }
  return { x: cx, y: cy };
}
// Points (px, py: small ints) onto the same number of cells (cx, cy): cut the cell set along its longer side and the points at the same
// count along the same axis, down to single cells. Returns the cell index for each point.
function pmSplitCells(px, py, cx, cy) {
  const m = px.length, out = new Int32Array(m), pi = new Int32Array(m), ci = new Int32Array(m);
  const kpx = new Float64Array(m), kpy = new Float64Array(m), kcx = new Float64Array(m), kcy = new Float64Array(m);
  for (let i = 0; i < m; i++) { pi[i] = ci[i] = i; kpx[i] = px[i] * 262144 + i; kpy[i] = py[i] * 262144 + i; kcx[i] = cx[i] * 4096 + cy[i]; kcy[i] = cy[i] * 4096 + cx[i]; }
  const st = [[0, m]];
  while (st.length) {
    const [lo, hi] = st.pop();
    if (hi - lo === 1) { out[pi[lo]] = ci[lo]; continue; }
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let t = lo; t < hi; t++) { const c = ci[t]; if (cx[c] < a0) a0 = cx[c]; if (cx[c] > a1) a1 = cx[c]; if (cy[c] < b0) b0 = cy[c]; if (cy[c] > b1) b1 = cy[c]; }
    const useX = a1 - a0 >= b1 - b0, h = (hi - lo) >> 1, k = lo + h;
    pmSelect(ci, lo, hi, k, useX ? kcx : kcy); pmSelect(pi, lo, hi, k, useX ? kpx : kpy);
    st.push([lo, k], [k, hi]);
  }
  return out;
}
// Push circles apart (centers p, radii r) until every pair is clear by gap (gapSib between islands that share a parent). In place.
function pmIslRelax(px, py, r, par, gap, gapSib) {
  const K = r.length;
  for (let it = 0; it < 400; it++) {
    let bad = 0;
    for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) {
      const dx = px[j] - px[i], dy = py[j] - py[i], d = Math.hypot(dx, dy) + 1e-9, need = r[i] + r[j] + (par[i] === par[j] ? gapSib : gap);
      if (d < need - .01) { const sh = (need - d) / 2 + .001, ux = dx / d, uy = dy / d; px[j] += ux * sh; py[j] += uy * sh; px[i] -= ux * sh; py[i] -= uy * sh; bad++; }
    }
    if (!bad) break;
  }
}
function pmLayLookIsl(list, D, o, withLabels, asp) {
  const m = D.meta, I = m.islands, K = I.length, d = D.isl, n = list.length, f = 1 + o.sp * 1.6, GAP = m.gap || 7, GAPS = m.gapSib || 3;
  const items = Int32Array.from(list), X = new Int32Array(n), Y = new Int32Array(n), cnt = new Int32Array(K);
  const whole = n === m.n - pmHidN();
  for (let t = 0; t < n; t++) cnt[d.id[list[t]]]++;
  const cx = new Float64Array(K), cy = new Float64Array(K), r = new Float64Array(K), par = I.map(q => q.par);
  let cellX = null, cellY = null, slot = null;
  // the cloud's own shape is stretched to the window's (centers only), then pushed apart again where that made islands touch
  const stretch = rr => { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (let k = 0; k < K; k++) if (cnt[k]) { a0 = Math.min(a0, I[k].cx - rr[k]); a1 = Math.max(a1, I[k].cx + rr[k]); b0 = Math.min(b0, I[k].cy - rr[k]); b1 = Math.max(b1, I[k].cy + rr[k]); }
    return clamp(Math.sqrt((asp || 1) / Math.max(.2, (a1 - a0) / Math.max(1, b1 - b0))), .5, 2.2); };
  if (whole) {   // the stored cells; centers scale with the spread
    const g = stretch(Array.from(I, q => q.r)), qx = Float64Array.from(I, q => q.cx * g), qy = Float64Array.from(I, q => q.cy / g);
    for (let k = 0; k < K; k++) r[k] = I[k].r;
    pmIslRelax(qx, qy, r, par, GAP, GAPS);
    for (let k = 0; k < K; k++) { cx[k] = qx[k] * f; cy[k] = qy[k] * f; }
    for (let t = 0; t < n; t++) { const i = list[t], k = d.id[i]; X[t] = Math.round(d.lx[i] + cx[k] - I[k].mx); Y[t] = Math.round(d.ly[i] + cy[k] - I[k].my); }
  } else {   // a filter: each island's remaining paintings refill a smaller blob of their own; islands that emptied are gone
    const frac = Math.sqrt(n / m.n), at = new Int32Array(K + 1), pl = new Int32Array(n);
    for (let k = 0; k < K; k++) at[k + 1] = at[k] + cnt[k];
    const fill = new Int32Array(K);
    for (let t = 0; t < n; t++) { const k = d.id[list[t]]; pl[at[k] + fill[k]++] = t; }
    cellX = new Array(K); cellY = new Array(K);
    const px = new Float64Array(K), py = new Float64Array(K), live = [];
    for (let k = 0; k < K; k++) {
      const c = cnt[k]; if (!c) continue;
      const b = pmBlob(c, I[k].an, I[k].as, k);
      const a = pl.subarray(at[k], at[k + 1]), qx = new Int32Array(c), qy = new Int32Array(c);
      for (let j = 0; j < c; j++) { qx[j] = d.lx[list[a[j]]]; qy[j] = d.ly[list[a[j]]]; }
      const cell = pmSplitCells(qx, qy, b.x, b.y);
      let sx = 0, sy = 0; for (let j = 0; j < c; j++) { sx += b.x[j]; sy += b.y[j]; }
      const mx = sx / c, my = sy / c; let rr = 0;
      for (let j = 0; j < c; j++) rr = Math.max(rr, Math.hypot(b.x[j] - mx, b.y[j] - my));
      cellX[k] = { a, cell, b, mx, my }; r[k] = rr + .5; live.push(k);
    }
    const g = stretch(r);
    for (const k of live) { px[k] = I[k].cx * frac * g; py[k] = I[k].cy * frac / g; }
    const lx = Float64Array.from(live, k => px[k]), ly = Float64Array.from(live, k => py[k]), lr = Float64Array.from(live, k => r[k]);
    pmIslRelax(lx, ly, lr, live.map(k => par[k]), GAP, GAPS);
    live.forEach((k, j) => { cx[k] = lx[j] * f; cy[k] = ly[j] * f; });
    for (const k of live) { const q = cellX[k]; for (let j = 0; j < q.a.length; j++) { const t = q.a[j], c = q.cell[j]; X[t] = Math.round(q.b.x[c] + cx[k] - q.mx); Y[t] = Math.round(q.b.y[c] + cy[k] - q.my); } }
    cellX = cellY = null;
  }
  // frame: the middle of everything sits at 0,0; each island's box (for its label and for finding the way back from the gaps)
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const bx0 = new Float64Array(K).fill(1e9), by0 = new Float64Array(K).fill(1e9), bx1 = new Float64Array(K).fill(-1e9), by1 = new Float64Array(K).fill(-1e9);
  for (let t = 0; t < n; t++) {
    const k = d.id[list[t]], x = X[t], y = Y[t];
    if (x < bx0[k]) bx0[k] = x; if (x > bx1[k]) bx1[k] = x; if (y < by0[k]) by0[k] = y; if (y > by1[k]) by1[k] = y;
  }
  for (let k = 0; k < K; k++) if (cnt[k]) { x0 = Math.min(x0, bx0[k]); x1 = Math.max(x1, bx1[k]); y0 = Math.min(y0, by0[k]); y1 = Math.max(y1, by1[k]); }
  const sx = n ? Math.round((x0 + x1) / 2) : 0, sy = n ? Math.round((y0 + y1) / 2) : 0;
  for (let t = 0; t < n; t++) { X[t] -= sx; Y[t] -= sy; }
  const isl = [];
  for (let k = 0; k < K; k++) if (cnt[k]) isl.push({ k, n: cnt[k], x0: bx0[k] - sx, x1: bx1[k] - sx, y0: by0[k] - sy, y1: by1[k] - sy, text: withLabels && whole ? I[k].lab : "" });
  const big = isl.reduce((a, q) => !a || q.n > a.n ? q : a, null);
  const lay = pmGridOf(items, X, Y, [], [0, 0]);   // the middle of the whole cloud: the first view frames every island
  lay.islands = isl;
  return lay;
}
function pmLayLook(list, F, s) {
  const o = pmLk(s);
  return pmLookKind(s) === "isl" ? pmLayLookIsl(list, PM_LOOK.V[pmLookV(s)], o, !!o.lab, pmLookAsp()) : pmLayLookGrid(list, PM_LOOK.V.keep.grid, F);
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
  const list = pmList(s, F), key = pmQS(s, F) + "|" + list.length + (s.arr === "look" ? "|a" + pmLookAsp() : "") + "|" + (s.fav ? pmFavList(F).map(r => r.i).join(",") : "");
  let lay = PM_LAYOUTS.get(key);
  if (!lay) {
    const arr = s.arr === "look" && !pmLookReady(s) ? "color" : s.arr;   // look.bin not here yet (the caller loads it and rebuilds): never cache the stand-in
    lay = arr === "look" ? pmLayLook(list, F, s) : s.arr === "time" ? pmLayTime(list, s.place, F, pmSolo(s)) : s.arr === "painter" ? pmLayPainter(list, F)
      : s.arr === "museum" ? pmLayMuseum(list, F)
      : s.arr === "subject" && SUBJ ? pmLaySubject(list, F)
      : s.arr === "families" ? pmLayFamilies(list, F) : s.arr === "tones" ? pmLayTones(list, s.place, F)
      : s.arr === "rings" ? pmLayRings(list, s.seed, F) : s.arr === "spiral" ? pmLaySpiral(list, s.seed, F)
      : pmLayColor(list, s.place, F);
    lay.key = key; lay.arr = s.arr;
    if (arr === s.arr) PM_LAYOUTS.set(key, lay); if (PM_LAYOUTS.size > 8) PM_LAYOUTS.delete(PM_LAYOUTS.keys().next().value);
  }
  return lay;
}

// ---------- thumbnails: load the few on screen, bake each once, recycle ----------
const PM_BAKE = 144, PM_CACHE_MAX = 650, PM_BIG_MAX = 36, PM_FLIGHT = 14;
// full pictures held at once: 36 on a phone (a 440x956 or smaller window), growing with a larger window's area up to 72
const pmBigMaxFor = (w, h) => Math.max(PM_BIG_MAX, Math.min(72, Math.round(PM_BIG_MAX * (w || 0) * (h || 0) / (440 * 956))));
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
// David, 2026-10-21 ("most pictures are jittering at this distance", desktop painting map): the full-picture cache (bigs) holds
// PM_BIG_MAX pictures, but a desktop window shows far more tiles that want one than that (71 wanted at the default close zoom,
// 36 held). Every load evicted the oldest, which was still wanted, the next frame re-requested it, its load evicted another...
// an endless load/evict loop: ~15 redraws a second at REST, each tile flipping between its full picture and its 144px baked
// square (whole-canvas pixel diff 243/255 between frames of a still map). Now want() works out which tiles may hold a full
// picture (the biggest PM_BIG_MAX, or bigMax() on a window larger than a phone), only those are ever requested, and eviction
// drops a picture that is no longer in that set first. A set that fits settles and the map goes quiet.
function pmImages(onReady, F, bigMax) {
  const cache = new Map(), bigs = new Map(); let keepBig = new Set();   // i -> { st: 0 loading | 1 ready | 2 failed, bm, ar, used } ; i -> HTMLImageElement (kept for the big tiles)
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
    const cap = bigMax ? bigMax() : PM_BIG_MAX; keepBig = new Set();
    for (const [i, big] of list) if (big && keepBig.size < cap) keepBig.add(i);   // list is biggest-first
    for (const [i] of list) {
      const e = cache.get(i), big = keepBig.has(i);
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
          try { const b = bake(i, img, t.crop); ent.bm = b.cv; ent.src = b.src; ent.st = 1; ent.t0 = performance.now(); if (big) { bigs.set(i, img); trimBig(); if (!bigs.has(i)) ent.bigLoading = false; } } catch (err) { ent.st = 2; }
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
  function trimBig() {   // over the cap: drop pictures nothing wants any more first (oldest first), a wanted one only if it must
    const cap = bigMax ? bigMax() : PM_BIG_MAX;
    while (bigs.size > cap) {
      let k = null; for (const j of bigs.keys()) if (!keepBig.has(j)) { k = j; break; }
      if (k === null) k = bigs.keys().next().value;
      bigs.delete(k); const e = cache.get(k); if (e) e.bigLoading = false;
    }
  }
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
// David, 2026-10-24: iOS killed the WebContent process ("A problem repeatedly occurred") once tier 0 alone decoded to
// ~333 MB (20 sheets x 16.6 MB at 206k paintings). Total decoded budget (tier 0 + tier 1 + tier 2) is now computed and
// logged (pmMemReport); tier 0 is laid out at 12 px tiles (0.58 KB a painting); tier 1 keeps small per-cell bitmaps, never
// whole decoded sheets (see pmAtlasTier1). Everything is released shortly after the map unmounts or the tab is hidden.
const PM_LOWMEM = (() => { try { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (navigator.deviceMemory && navigator.deviceMemory <= 4); } catch (e) { return false; } })();
const PM_T0_BUDGET_MB = 120;   // tier-0 decoded bytes above this are a bug (tools/smoke/scenarios.js asserts it)
const pmBmBytes = bm => bm ? (bm.width || 0) * (bm.height || 0) * 4 : 0;
// decoded bytes per tier of the live map (tier 2 = the few big per-painting images pmImages holds)
function pmMemReport(atlas, t1) {
  let b0 = 0, b1 = 0;
  if (atlas && atlas.bm0s) atlas.bm0s.forEach(bm => { b0 += pmBmBytes(bm); });
  if (t1 && t1.bytes) b1 = t1.bytes();
  return { tier0MB: +(b0 / 1048576).toFixed(1), tier1MB: +(b1 / 1048576).toFixed(1), totalMB: +((b0 + b1) / 1048576).toFixed(1), budgetMB: PM_T0_BUDGET_MB };
}
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
// decode the sheets a few at a time (not all at once: fetched blobs + decoded bitmaps both live during the peak)
function pmDecodeAll(urls, conc) {
  const out = new Array(urls.length); let next = 0, failed = null;
  const worker = () => { if (failed || next >= urls.length) return Promise.resolve(); const k = next++;
    return pmDecodeSheet(urls[k]).then(bm => { out[k] = bm; return worker(); }); };
  return Promise.all(Array.from({ length: Math.min(conc, urls.length) }, worker)).then(() => out)
    .catch(e => { failed = e; out.forEach(bm => bm && bm.close && bm.close()); throw e; });
}
// users of a collection's decoded tier 0; the last one leaving schedules the release (a quick return, e.g. Back from a
// painting, cancels it), so a closed map never keeps ~100 MB of bitmaps alive behind the rest of the app
const PM_ATLAS_USERS = new Map(), PM_ATLAS_REL = new Map();
function pmAtlasAcquire(col) { col = col || "paintings"; PM_ATLAS_USERS.set(col, (PM_ATLAS_USERS.get(col) || 0) + 1); clearTimeout(PM_ATLAS_REL.get(col)); PM_ATLAS_REL.delete(col); }
function pmAtlasRelease(col, delay) {
  col = col || "paintings"; const n = (PM_ATLAS_USERS.get(col) || 1) - 1; PM_ATLAS_USERS.set(col, n);
  if (n > 0) return;
  clearTimeout(PM_ATLAS_REL.get(col));
  PM_ATLAS_REL.set(col, setTimeout(() => pmAtlasDrop(col), delay == null ? 15000 : delay));
}
function pmAtlasDrop(col) {
  if (PM_ATLAS_USERS.get(col) > 0) return;
  const a = PM_ATLAS_CACHE.get(col); if (a && a.bm0s) a.bm0s.forEach(bm => bm && bm.close && bm.close());
  PM_ATLAS_CACHE.delete(col); PM_ATLAS_P.delete(col); PM_ATLAS_REL.delete(col);
}
function pmAtlasLoad(col) {
  col = col || "paintings";
  if (PM_ATLAS_CACHE.has(col)) return Promise.resolve(PM_ATLAS_CACHE.get(col));
  if (PM_ATLAS_P.has(col)) return PM_ATLAS_P.get(col);
  const base = pmAtlasBase(col), v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  const attempt = n => fetch(base + "manifest.json" + v).then(r => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
    .then(man => pmDecodeAll(man.tier0.sheets.map(name => base + name + v), PM_LOWMEM ? 2 : 4)
      .then(bm0s => { const atlas = { man, bm0s, missing: man.missing && man.missing.length ? new Set(man.missing) : null }; PM_ATLAS_CACHE.set(col, atlas);
        try { console.info("[paintmap] tier 0 decoded", JSON.stringify(pmMemReport(atlas, null))); } catch (e) {} return atlas; }))
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
// tier 1, per CELL (David, 2026-10-24). A tier-1 sheet is 2000x2000 (~16 MB decoded) holding 625 paintings in GALLERY order,
// but the map lays paintings out by color/painter/time, so the cells on one phone screen come from dozens of different
// sheets (measured: ~90 sheets, 1.5 GB decoded, in Color at ~60px cells) -- that, not tier 0, is what made iOS kill the
// page. So a sheet is only ever decoded TRANSIENTLY: fetched (HTTP-cached), decoded, each wanted 80x80 cell copied out to
// its own small bitmap (25 KB), the sheet closed. Resident memory is the cell LRU: at most max(PM_T1_CELLS, 1.3 x what is
// on screen) cells. A few sheets (PM_T1_CONC) are processed at once, the groups with the most wanted cells first.
const PM_T1_CELLS = PM_LOWMEM ? 700 : 1200, PM_T1_CELLS_HARD = PM_LOWMEM ? 1500 : 3200;
const PM_T1_CONC = PM_LOWMEM ? 3 : 4;   // sheets decoded at once (each is ~16 MB for a moment, then closed)
function pmCutCell(src, x, y, s) {
  if (typeof createImageBitmap === "function") return createImageBitmap(src, x, y, s, s).catch(() => pmCutCanvas(src, x, y, s));
  return Promise.resolve(pmCutCanvas(src, x, y, s));
}
function pmCutCanvas(src, x, y, s) { const cv = document.createElement("canvas"); cv.width = cv.height = s; cv.getContext("2d").drawImage(src, x, y, s, s, 0, 0, s, s); return cv; }
function pmAtlasTier1(onReady, col) {
  col = col || "paintings";
  const base = pmAtlasBase(col);
  const cells = new Map();   // painting index -> { bm, used } (ready tiles only)
  const need = new Map();    // group -> Set of painting indices wanted and not yet cut
  const failed = new Set();  // groups whose sheet failed (retried at most twice, a few seconds apart)
  const born = performance.now();
  const tries = new Map(), inflight = new Set(), rank = new Map();   // rank: group -> the best (lowest) place any of its wanted paintings has in the priority list
  let frame = 0, dead = false, running = 0, wantedNow = 1;
  function pump() {
    // the opening seconds of a map may run more sheets at once on a roomy device (every visible tile sharpens sooner); phones keep their own cap
    const conc = !PM_LOWMEM && performance.now() - born < 12000 ? PM_T1_CONC + 2 : PM_T1_CONC;
    while (!dead && running < conc) {
      const atlas = PM_ATLAS_CACHE.get(col); if (!atlas) return;
      let best = -1, bestR = 1e12;
      need.forEach((set, g) => { const r = rank.get(g); if (r < bestR) { best = g; bestR = r; } });   // the group holding the painting nearest the middle goes first (center -> visible -> the ring around it)
      if (best < 0) return;
      running++; inflight.add(best);
      const man = atlas.man, set = need.get(best); need.delete(best);
      const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
      const lo = best * man.tier1.groupSize, hi = Math.min(man.n, lo + man.tier1.groupSize), cols = Math.max(1, Math.ceil(Math.sqrt(hi - lo))), T = man.tier1.tile;
      pmDecodeSheet(base + man.tier1.file.replace("{g}", best) + v).then(sheet => {
        const idx = [...set].filter(i => !cells.has(i));
        return Promise.all(idx.map(i => pmCutCell(sheet, ((i - lo) % cols) * T, Math.floor((i - lo) / cols) * T, T).then(bm => { if (dead) { bm.close && bm.close(); return; } cells.set(i, { bm, used: frame }); })))
          .then(() => { if (sheet.close) sheet.close(); });
      }).catch(() => { const n = (tries.get(best) || 0) + 1; tries.set(best, n); if (n >= 2) failed.add(best); })
        .then(() => { running--; inflight.delete(best); if (!dead) { trim(); onReady(); pump(); } });
    }
  }
  function trim() {
    const cap = Math.min(PM_T1_CELLS_HARD, Math.max(PM_T1_CELLS, Math.round(wantedNow * 1.3)));
    if (cells.size <= cap) return;
    const old = [...cells.entries()].filter(([, e]) => e.used !== frame).sort((a, b) => a[1].used - b[1].used);
    for (let k = 0; k < cells.size - cap && k < old.length; k++) { const e = old[k][1]; if (e.bm.close) e.bm.close(); cells.delete(old[k][0]); }
  }
  // list: painting indices that want a tier-1 picture this frame
  // list: painting indices, nearest the middle FIRST; ring: the paintings just around the screen (after the visible ones, so
  // they never delay the first picture), nearest first too
  function want(list, ring) {
    if (ring && ring.length) list = list.concat(ring);
    frame++; wantedNow = list.length;
    const atlas = PM_ATLAS_CACHE.get(col); if (!atlas) return;
    const man = atlas.man;
    // groups no longer on screen drop out of the queue (they were queued by an earlier view)
    const fresh = new Map(); rank.clear();
    for (let r = 0; r < list.length; r++) {
      const i = list[r], c = cells.get(i); if (c) { c.used = frame; continue; }
      const g = pmT1Group(man, i); if (g < 0 || g >= man.tier1.numGroups || failed.has(g) || inflight.has(g)) continue;
      let s = fresh.get(g); if (!s) { fresh.set(g, s = new Set()); rank.set(g, r); } s.add(i);
    }
    need.clear(); fresh.forEach((s, g) => need.set(g, s));
    trim(); pump();
  }
  return { cell: i => { const c = cells.get(i); return c ? c.bm : null; }, want,
    bytes: () => { let b = 0; cells.forEach(e => { b += pmBmBytes(e.bm); }); return b; }, size: () => cells.size,
    drop: () => { cells.forEach(e => e.bm.close && e.bm.close()); cells.clear(); need.clear(); },
    destroy: () => { dead = true; cells.forEach(e => e.bm.close && e.bm.close()); cells.clear(); need.clear(); } };
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
  const artists = [], countries = [], movements = [], src = [], types = [];
  const tyIx = new Map(), ty = new Uint16Array(N);
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
    const tyName = cfg.typeName ? cfg.typeName(n) : null;
    if (tyName) { let ix = tyIx.get(tyName); if (ix == null) { types.push(tyName); ix = types.length; tyIx.set(tyName, ix); } ty[i] = ix; }
    const srcKey = cfg.srcKey(n), srcLabel = cfg.srcLabel(n);
    if (srcKey) { let ix = srcIx.get(srcKey); if (ix == null) { src.push({ k: srcKey, short: srcLabel }); ix = src.length - 1; srcIx.set(srcKey, ix); } mus[i] = ix; }
  }
  if (!src.length) src.push({ k: col, short: "—" });
  const G = { n: N, mean, lab: labArr, sh, ch, C, year, ar, src, mus, shard: N };
  const meta = { artists, countries, movements };
  if (types.length) meta.types = types;
  return { G, meta, N, artist, country, mv, dec, ty: types.length ? ty : null, fam, dom, slugIx, col, nodes, ixOf: id => { const v = byId.get(id); return v == null ? -1 : v; } };
}
const PM_COL_CFG = {
  design: {
    makerName: n => n.artist || null, makerSlug: n => n.makerSlug || null, typeName: n => n.objType || null,
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
      <span class="pmx-sp" aria-hidden="true"></span>
    </header>
    <button class="hm-top-search pmx-search" data-pmsearch aria-label="Search paintings and painters">${ICON.search}</button>
    <button class="corner l pl-corner" data-rooms-corner aria-label="Places">${ROOMS_GLYPH}<span>Places</span></button>
    <button class="corner r hm-do pmx-do" data-do-corner aria-label="More" aria-haspopup="dialog">${ICON.more}</button>
    ${col === "paintings" && typeof hmLayerSwitchHTML === "function" ? hmLayerSwitchHTML("paintings") : ""}
    <button class="pmx-count" data-pmcount hidden></button>
    <div class="pmx-chipbar" data-pmchipbar hidden></div>
    <div class="pmx-note" data-pmnote role="status" hidden></div>
    <div class="pmx-walk" data-pmwalk hidden></div>
    <div class="pmx-scrim" data-pmscrim aria-hidden="true"></div>
    <div class="pmx-facets" data-pmfacets hidden></div>
    <div class="pmx-cap" data-pmcap hidden>
      <button class="pmx-cap-main" data-pmopen aria-label="Open this painting"><b data-pmct></b><small data-pmcb></small><i class="pmx-cap-go" aria-hidden="true">${ICON.chev}</i></button>
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
  const wantSubj = col === "paintings" && /subj/.test(typeof spec === "string" ? spec : JSON.stringify(spec || {}));   // an address or a spec that names a subject needs its data before the first layout
  Promise.all([pmColLoad(col), pmThumbsLoad(col), wantSubj ? loadSubjects().catch(() => null) : null]).then(([F]) => {
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
    if (/(^|[&?])rnd=1/.test(from) && typeof hmHome === "function") return hmHome();   // a cold start that cannot load the map opens the old home instead
    el.querySelector(".pmx-wait").innerHTML = `The ${esc(colTitle.toLowerCase())} didn't load. <button class="wl" data-pmretry>Try again</button>`;
    el.querySelector("[data-pmretry]").onclick = () => pmOpen(spec, o);
  });
  return el;
}
function pmMount(el, s, F) {
  const cv = el.querySelector(".pmx-cv"), ctx = cv.getContext("2d"), wait = el.querySelector(".pmx-wait");
  const RM = reduceMotion, cap = el.querySelector("[data-pmcap]"), heart = el.querySelector("[data-pmheart]");
  const facets = el.querySelector("[data-pmfacets]"), chipbar = el.querySelector("[data-pmchipbar]"), walkBar = el.querySelector("[data-pmwalk]");
  const scopedFresh = () => ({ ...pmFilterFresh(), painterSet: pmSolo(s) ? s.f.painterSet.slice() : [] });   // "clear the filters" must never drop the one-painter scope
  const yrRange = () => pmSolo(s) ? pmSoloYears(s.f.painterSet[0], F).r : pmYearRange(F);   // the scrubber's span: one painter's own years, or the whole dataset's
  let walk = [];   // "Walk from here" (David, 2026-10-09): the gallery indices visited this walk, in order; [] when none is active
  if (s.walkStart) { s.walkStart = 0; const from0 = s.seed, nx = from0 >= 0 ? pmWalkCandidate(from0, new Set([from0])) : -1; if (nx >= 0) { walk = [from0, nx]; s.seed = nx; s.arr = "spiral"; } }
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
  const imgs = pmImages(() => kick(), F, () => pmBigMaxFor(W, H));
  let atlas = null;   // this mount's own resolved {man,bm0s} once pmAtlasLoad(F.col) lands (see draw()'s tier 0/1 passes below)
  const t1 = pmAtlasTier1(() => kick(), F.col);
  const tierH = new Map();   // i -> { t1On, f0, f1 } (pmTState) -- tier 0/1 crossfade + hysteresis memory
  // The ring (David, 2026-10-25: "and ideally the stuff around it"): the paintings in about one extra screen on every side of
  // what is showing, nearest first, so a small pan finds them sharp already. Bounded by the tile cache (a fraction of
  // PM_T1_CELLS), recomputed only when the view has really moved, and handed to t1.want after the visible ones.
  let ringFrames = 0, ringKey = "", ringList = [];
  function ringCells() {
    if (!lay || !lay.n || !atlas || lay.islands) return null;
    const key = lay.key + "|" + Math.round(P[0] / 2) + "," + Math.round(P[1] / 2) + "|" + Z.toFixed(2) + "|" + Math.round(W) + "x" + Math.round(H) + "|" + drawn.length;
    if (key === ringKey) return ringList;
    ringKey = key; ringList = [];
    let hw = 0, hh = 0; const seen = new Set();
    for (const b of drawn) { seen.add(b.k); hw = Math.max(hw, Math.abs(lay.x[b.k] - P[0])); hh = Math.max(hh, Math.abs(lay.y[b.k] - P[1])); }
    if (!seen.size || seen.size > 700) return ringList;   // zoomed far out: no tier-1 tiles to warm
    hw = hw * 3 + 1; hh = hh * 3 + 1;
    const cx = Math.round(P[0]), cy = Math.round(P[1]), out = [], man = atlas.man;
    for (let y = Math.max(Math.floor(cy - hh), lay.gy0); y <= Math.min(Math.ceil(cy + hh), lay.gy0 + lay.GH - 1); y++) {
      for (let x = Math.max(Math.floor(cx - hw), lay.gx0); x <= Math.min(Math.ceil(cx + hw), lay.gx0 + lay.GW - 1); x++) {
        const k = lay.grid[(y - lay.gy0) * lay.GW + x - lay.gx0]; if (k < 0 || seen.has(k)) continue;
        const i = lay.items[k]; if (i >= man.n || (atlas.missing && atlas.missing.has(i))) continue;
        out.push([(x - P[0]) ** 2 + (y - P[1]) ** 2, i]);
      }
    }
    out.sort((a, b) => a[0] - b[0]);
    const room = Math.max(0, Math.floor(PM_T1_CELLS * .75) - seen.size);
    ringList = out.slice(0, room).map(q => q[1]);
    return ringList;
  }
  pmAtlasAcquire(F.col);
  const coldOpen = !!s.rnd;   // a cold start (js/boot.js): if the pictures cannot load at all, the old home is the better first screen
  const loadAtlas = () => pmAtlasLoad(F.col).then(a => { atlas = a; if (!dead) kick(); }).catch(() => { if (coldOpen && !dead && !atlas && typeof hmHome === "function") hmHome(); });
  loadAtlas();
  // a hidden tab (Instagram's browser, the Home Screen app in the background) frees its decoded sheets after 20 s and
  // re-decodes them from the HTTP cache on return; iOS kills the biggest backgrounded WebContent first
  let hideTimer = 0, released = false;
  const onVis = () => {
    clearTimeout(hideTimer);
    if (document.hidden) hideTimer = setTimeout(() => { if (dead || !document.hidden) return; t1.drop(); atlas = null; released = true; pmAtlasRelease(F.col, 0); }, 20000);
    else if (!dead && released) { released = false; pmAtlasAcquire(F.col); loadAtlas(); }
  };
  document.addEventListener("visibilitychange", onVis);   // tier 0: one shared sheet, loaded once per session (idempotent -- a second mount just resolves immediately)
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
  const zFit = () => {
    if (!lay || !lay.GW || !lay.GH || !base) return .18;
    // the farthest the bbox's own edges are from the CURRENT pan center, per axis -- not just GW/2 and GH/2,
    // because P isn't always centered in the layout (David, 2026-10-10: "By painter" never re-centers P at
    // all, so a layout with gy0=1..4787 while P stays at [0,0] needs almost DOUBLE the naive half-extent to
    // reach its far edge -- halving Z from what a symmetric assumption would compute, same exact-2x gap the QA
    // bbox check below caught). Matches _qaBBoxFits()'s own corner math.
    let halfW = Math.max(Math.abs(lay.gx0 - P[0]), Math.abs(lay.gx0 + lay.GW - 1 - P[0])) + .7;
    let halfH = Math.max(Math.abs(lay.gy0 - P[1]), Math.abs(lay.gy0 + lay.GH - 1 - P[1])) + .7;
    if (lay.islands) { halfW = (lay.GW / 2) * 1.05 + .7; halfH = (lay.GH / 2) * 1.05 + .7; }   // islands: always framed from the middle of the cloud, with a modest margin
    const inset = pmSolo(s) ? soloInset() : 0;   // one-painter map: keep the layout below the filter chip row (symmetric, so it stays centered)
    const fits = zc => fzAt(zc, halfW) <= W / 2 && fzAt(zc, halfH) <= H / 2 - inset;
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
  // David, 2026-10-21: "it doesn't let you zoom out past a certain point ... now the limit is too close." zFit() above is
  // where the whole layout just fits the window (or Z = 1 for a small set that already fits); that used to BE the zoom-out
  // limit, so a small or filtered set could never be pushed back to sit small in the middle of the window, and a big one
  // stopped at wall-to-wall. The floor is now PM_ZOOM_OUT of the fit: the whole layout shrinks to about a quarter-to-a-third
  // of the window, whatever the item count. Fit flights (a new arrangement, Show it on the map) still land at zFit()/fitZoomFor.
  const PM_ZOOM_OUT = .28;
  const zMin = () => zFit() * PM_ZOOM_OUT;
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
    // one painter's map (a few hundred to ~1,500 works): open with the WHOLE oeuvre in frame, not a 100-tile window onto it
    if (l.islands) return Math.min(ZMAX, zFit() * (W < 700 ? 1.7 : 1));   // islands: the whole cloud in frame (a phone starts a step closer, so the biggest islands carry their names)
    if (pmSolo(s)) { const zm = zFit(); if (zm < 1) return zm; }
    const perUnit = Math.min(W / (l.GW + 1.4), H / (l.GH + 1.4));
    return clamp(Math.max(1, perUnit / base), zFit(), ZMAX);
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
    if (best < 0 && lay.islands && lay.islands.length) {   // out in the empty space between islands: the nearest island's painting along the way in
      let q = null, qd = 1e18;
      for (const i of lay.islands) { const dx = Math.max(i.x0 - px, 0, px - i.x1), dy = Math.max(i.y0 - py, 0, py - i.y1), d = dx * dx + dy * dy; if (d < qd) { qd = d; q = i; } }
      if (q) {
        const tx = (q.x0 + q.x1) / 2, ty = (q.y0 + q.y1) / 2, L = Math.hypot(tx - px, ty - py) || 1;
        for (let t = 0; t <= L; t++) { const k = pmAt(lay, Math.round(px + (tx - px) * t / L), Math.round(py + (ty - py) * t / L)); if (k >= 0) return k; }
      }
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
  // a title or byline that doesn't fit on one line takes a second one (never cut mid-word), and the chip rows above lift
  // by the extra height. Measured after layout (the card may only just have been unhidden), so it runs a frame later.
  function fitCap() {
    if (dead) return;
    cap.classList.remove("two"); el.style.removeProperty("--cap-x");
    if (cap.hidden) return;
    const cb = cap.querySelector("[data-pmct]"), cs = cap.querySelector("[data-pmcb]"), h0 = cap.offsetHeight;
    if (cb.scrollWidth > cb.clientWidth + 1 || cs.scrollWidth > cs.clientWidth + 1) { cap.classList.add("two"); el.style.setProperty("--cap-x", Math.max(0, cap.offsetHeight - h0) + "px"); }
  }
  function caption() {
    if (centerK < 0 || !lay) { cap.hidden = true; facets.hidden = true; return; }
    const i = lay.items[centerK], a = F.artist[i], y = pmYearStr(i, F), by = [a ? xbArtistName(F, a) : "", y].filter(Boolean).join(" · ");
    cap.hidden = !cardOpen; facets.hidden = !cardOpen; el.classList.toggle("pmx-cardopen", !!cardOpen);
    const d = pmDetailNow(i, F);
    cap.querySelector("[data-pmct]").textContent = d ? d.t : " ";
    cap.querySelector("[data-pmcb]").textContent = by || (d && d.co) || "";
    let lt = cap.querySelector("[data-pmclook]");
    if (s.arr === "look") { if (!lt) { lt = document.createElement("small"); lt.className = "pmx-look-tag"; lt.dataset.pmclook = ""; cap.querySelector(".pmx-cap-main").appendChild(lt); } lt.textContent = "By vibe, from an image model"; } else if (lt) lt.remove();
    cap.style.setProperty("--c", pmHex(i, F));
    requestAnimationFrame(fitCap);
    paintHeart(i, d);
    if (!d && (!F.col || F.col === "paintings")) { clearTimeout(capTimer); capTimer = setTimeout(() => glDetail(i).then(() => { if (!dead && lay && lay.items[centerK] === i) caption(); }).catch(() => {}), 90); }
    PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z, cardOpen });
    paintFacets(i);
    facets.hidden = !cardOpen;   // paintFacets() always unhides itself when it (re)builds the chip row -- cardOpen has the final say
  }
  // By look settings (David, 2026-10-24): Layout, Island spread, Photo-format effect, Labels. Each applies live and is remembered on this
  // phone (pmLkSave); the address carries them too. rebuild() keeps the painting you are on in the middle.
  function lookSettingsHTML() {
    const o = pmLk(s), isl = pmLookKind(s) === "isl" || (o.lay === "isl" && pmLookHasIsl());
    const seg = (k, opts, cur, label) => `<div class="hm-seg" role="radiogroup" aria-label="${label}">${opts.map(([v, t]) => `<button class="${String(cur) === String(v) ? "on" : ""}" data-pmlk="${k}" data-v="${v}" role="radio" aria-checked="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
    const filtered = pmList(s, F).length !== F.N - pmHidN(F);
    return `${pmLookHasIsl() ? `<div class="cx-sec"><b>Layout</b></div>${seg("lay", [["isl", "Islands"], ["grid", "Even grid"]], o.lay, "Layout")}
        <p class="hm-arr-sub">${o.lay === "isl" ? "The clusters the image model found, each its own island." : "One even block, every painting the same distance apart."}</p>` : ""}
        ${isl ? `<div class="hm-feel"><label class="hm-feel-row"><span class="hm-feel-l">Spread</span><span class="hm-feel-r"><i>Tight</i><input type="range" min="0" max="1" step="0.01" value="${o.sp}" data-pmlksp aria-label="Island spread, tight to wide"><i>Wide</i></span></label></div>` : ""}
        ${isl && pmLookColsOn().length > 1 ? `<div class="cx-sec"><b>Color influence</b></div>${seg("col", pmLookColsOn().map(c => [c[0], c[1]]), o.col, "Color influence")}
        <p class="hm-arr-sub">${o.col ? "The paintings' colors also shape where they sit, so colors flow across the map." : "Placed only by what the image model sees: subject, style and mood."}</p>` : ""}
        ${isl ? `<div class="cx-sec"><b>Labels</b></div>${seg("lab", [[1, "On"], [0, "Off"]], o.lab, "Island labels")}
        <p class="hm-arr-sub">${filtered && o.lab ? "Names describe the whole museum, so they hide while a filter is on." : "Named from the image model's reading of what each island holds."}</p>` : ""}`;
  }
  function lookSet(k, v, live, redraw) {
    const o = pmLk(s), nv = k === "sp" ? +v : k === "lay" ? v : +v;
    if (k !== "sp" && String(o[k]) === String(nv)) return;
    buzz(live ? 0 : 5);
    s[{ lay: "lkl", sp: "lks", col: "lkc", lab: "lkb" }[k]] = nv;
    pmLkSave(Object.assign(pmLkSaved(), { [k]: nv }));
    const go = () => { if (dead) return; rebuild(); if (!live && redraw) redraw(); };
    if (pmLookReady(s)) go(); else pmLookEnsure(F, s).then(ok => { if (!ok) toast("The vibe map didn't load", { low: true }); go(); });
  }
  // First time By vibe is chosen, one honest line about where the order comes from (never claimed as fact)
  function lookHint() {
    let seen = 0; try { seen = localStorage.getItem("pm-look-seen"); localStorage.setItem("pm-look-seen", "1"); } catch (e) {}
    if (!seen) toast("The picture model's view of vibe: subject, style, mood and color. Paintings it finds alike sit together; island names come from what each one holds.", { low: true, ms: 5200 });
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
    const [lo, hi] = yrRange(), cur = s.upToYear == null ? hi : s.upToYear;
    if (inp) inp.value = cur;
    const lab = document.querySelector("[data-pmscrublabel]");
    if (lab) lab.textContent = s.upToYear == null ? "Showing every year" : `Up to ${cur}${cur >= hi ? "" : " (undated paintings join at the end)"}`;
    const btn = document.querySelector("[data-pmscrubplay]");
    if (btn) { btn.classList.toggle("on", !!scrubTimer); btn.innerHTML = scrubTimer ? PM_ICON.pause : ICON.play; btn.setAttribute("aria-label", scrubTimer ? "Pause" : "Play"); }
  }
  function scrubStep() {
    const [lo, hi] = yrRange(), cur = s.upToYear == null ? lo : s.upToYear;
    const next = cur + Math.max(pmSolo(s) ? 2 : 5, Math.round((hi - lo) / 90));
    if (next >= hi) { s.upToYear = null; clearInterval(scrubTimer); scrubTimer = 0; } else s.upToYear = next;
    rebuild({ nofocus: true }); scrubUpdateUI();
  }
  function scrubPlay() {
    if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; scrubUpdateUI(); return; }
    const [lo, hi] = yrRange();
    if (s.upToYear == null || s.upToYear >= hi) s.upToYear = lo;
    rebuild({ nofocus: true }); scrubTimer = setInterval(scrubStep, 420); scrubUpdateUI();
  }
  // filter-by-example (David, 2026-10-09, the minimalist pass): up to 3 fixed "only this" chips (Same painter/
  // decade/place), Open, Arrange around this, and Walk from here.
  // David, 2026-10-10: a tap no longer seeds/rebuilds (it's a plain fly-to now -- see tap()'s own comment), so
  // "arrange the neighbors around this painting" needed its own explicit chip instead of riding along for free.
  // Phase B (David, 2026-10-24): the row under a painting is three presets and "More". Each preset carries a live count
  // ("Same era here · 412"), filled in a beat after the row appears so the card never waits on it; a second tap removes it.
  let facetTok = 0;
  function paintFacets(i) {
    const pr = pmPresetsOf(i, F), tok = ++facetTok;
    facets.hidden = false;
    const chipHTML = (p, k) => { const on = p.on(s.f); return `<button class="pmx-fchip pmx-fpre${on ? " on" : ""}" data-pmpre="${k}" aria-pressed="${on}"><span>${esc(p.label)}</span><em data-pmprec></em></button>`; };
    facets.innerHTML = `<div class="pmx-frow">${pr.map(chipHTML).join("")}<button class="pmx-fchip pmx-fmore" data-pmmore2>More</button></div>`;
    facets.querySelector("[data-pmmore2]").onclick = () => { buzz(4); openMore(i); };
    facets.querySelectorAll("[data-pmpre]").forEach(b => b.onclick = () => {
      if (b.disabled) return;
      const p = pr[+b.dataset.pmpre]; buzz(6);
      if (p.on(s.f)) p.clear(s.f); else p.patch(s.f);
      rebuild({ focus: { i, z: Z, open: true } });   // the painting these chips were made for stays in the middle (a glide may still be settling onto it)
    });
    if (cardOpen) pr.forEach((p, k) => setTimeout(() => {
      if (dead || tok !== facetTok || !cardOpen) return;
      const b = facets.querySelector(`[data-pmpre="${k}"]`); if (!b) return;
      const on = p.on(s.f), n = on ? lay.n : pmPatchCount(s, F, p, i);
      b.querySelector("[data-pmprec]").textContent = n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 && innerWidth <= 460 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : n.toLocaleString();
      b.setAttribute("aria-label", `${p.label}: ${n.toLocaleString()} ${n === 1 ? pmColLabel(F, "noun") : pmColLabel(F, "nounP")}${on ? ", on. Tap to remove" : ""}`);
      if (!on && n <= 1) { b.disabled = true; b.classList.add("none"); }
    }, 30 + k * 40));
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
  // ---- the zoomed-out mosaic (David, 2026-10-21: "on desktop, zooming out all the way makes the app work way too slowly").
  // Fully out, the whole archive (114k cells) is on screen at ~2-6px each; drawing it as 114k tiles (a lens-mapped rect,
  // a fillRect and a drawImage apiece) cost ~500ms a frame. Where cells are that small a tile carries no more than its
  // color, so everything farther from the middle than zS (where a cell shrinks below rasterThr() px) is rendered ONCE PER
  // FRAME as pixels instead: each screen pixel inverts the SAME lens (a radius table built from Fz) to the grid cell under
  // it and reads that cell's color from a typed array -- W*H lookups no matter how many cells there are, no per-cell
  // objects, no canvas state changes -- then one drawImage puts the bitmap under the tiles. The seam between cells is
  // reproduced per pixel from the same formula the tile path uses, so the two zones read as one mosaic. Cells nearer the
  // middle (and every cell at ordinary zoom, where nothing is below the threshold) still go through the tile loop as before.
  let rz = { zS: Infinity, R: 0, rS: 0 };   // the raster zone of the last draw (hitAt + the QA counters read it)
  let rb = null, rbLay = null, rbCol = null;
  const RASTER_PX = 1400000;   // raster pixel budget per frame; a bigger canvas renders at a lower scale and is stretched
  function rasterColors() {
    if (rbCol && rbLay === lay) return rbCol;
    const n = lay.n, c = new Uint32Array(n);
    for (let k = 0; k < n; k++) { const h = pmHex(lay.items[k], F), v = parseInt(h.slice(1, 7), 16) || 0; c[k] = (0xFF000000 | (v & 255) << 16 | (v >> 8 & 255) << 8 | v >> 16) >>> 0; }
    rbLay = lay; rbCol = c; return c;
  }
  const rasterThr = () => clamp(Math.sqrt(W * H / 30000), 5, 12);
  // the plane distance zS beyond which a cell is smaller than the threshold (Infinity = no raster zone at this zoom)
  function rasterEdge(R) {
    if (!lay || lay.n < 4000) return Infinity;
    const thr = rasterThr(), kk = K(), cs = z => kk * Math.min(magR(z), tanR(z));
    if (cs(R) >= thr) return Infinity;
    if (cs(0) <= thr) return 0;
    let lo = 0, hi = R; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (cs(m) > thr) lo = m; else hi = m; }
    return hi;
  }
  const smoothSeam = cs => cs >= 16 ? 1 : cs <= 3 ? 0 : (u => u * u * (3 - 2 * u))((cs - 3) / 13);
  function rasterDraw(zS, R) {
    const col = rasterColors(), kk = K(), cx = W / 2, cy = H / 2;
    const rS = zS > 0 ? Fz(zS) : 0, rMax = Math.hypot(W, H) / 2 + 2, TS = .5, nT = Math.ceil((rMax - rS) / TS) + 2;
    const sc = Math.min(1, Math.sqrt(RASTER_PX / (W * H))), rw = Math.max(1, Math.round(W * sc)), rh = Math.max(1, Math.round(H * sc));
    if (!rb || rb.w !== rw || rb.h !== rh) {
      const c = document.createElement("canvas"); c.width = rw; c.height = rh;
      const id = c.getContext("2d").createImageData(rw, rh); rb = { c, w: rw, h: rh, id, u32: new Uint32Array(id.data.buffer), zt: new Float32Array(0), gt: new Float32Array(0) };
    }
    if (rb.zt.length < nT + 2) { rb.zt = new Float32Array(nT + 64); rb.gt = new Float32Array(nT + 64); }
    const zt = rb.zt, gt = rb.gt;
    for (let j = 0, zlo = zS; j < nT + 2; j++) {   // radius r_j = rS + j*TS -> plane distance (monotone, so each bisection starts at the last answer)
      const r = rS + j * TS; let lo = zlo, hi = Math.max(R + 2, zlo + 1);
      for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (Fz(m) > r) hi = m; else lo = m; }
      const z = (lo + hi) / 2; zt[j] = z; zlo = lo;
      const cs = kk * Math.min(magR(z), tanR(z)), sm = smoothSeam(cs);
      gt[j] = Math.min(6, cs * .15, 1 + cs * .05) * sm / Math.max(cs, 1e-3) * .5;   // half the seam, as a fraction of a cell
    }
    const u32 = rb.u32, GW = lay.GW, GH = lay.GH, grid = lay.grid, inv = 1 / sc, BG = 0xFF0B0D0E | 0;   // BG: #0E0D0B as ABGR
    const ox = P[0] - lay.gx0 + .5, oy = P[1] - lay.gy0 + .5, iTS = 1 / TS;   // plane coords shifted so a floor is a plain |0 (the grid index) while the point is inside the grid
    let o = 0;
    for (let py = 0; py < rh; py++) {
      const dy = (py + .5) * inv - cy, dy2 = dy * dy;
      for (let px = 0; px < rw; px++, o++) {
        const dx = (px + .5) * inv - cx, r = Math.sqrt(dx * dx + dy2);
        if (r < rS) { u32[o] = 0; continue; }
        const ti = (r - rS) * iTS, j = ti | 0, z = zt[j] + (zt[j + 1] - zt[j]) * (ti - j);
        if (z > R) { u32[o] = BG; continue; }
        const q = r < 1e-6 ? 0 : z / r, fx = ox + dx * q, fy = oy + dy * q;
        if (fx < 0 || fy < 0) { u32[o] = BG; continue; }
        const gx = fx | 0, gy = fy | 0;
        if (gx >= GW || gy >= GH) { u32[o] = BG; continue; }
        const k = grid[gy * GW + gx]; if (k < 0) { u32[o] = BG; continue; }
        const e = .5 - gt[j], ux = fx - gx - .5, uy = fy - gy - .5;
        u32[o] = (ux > e || ux < -e || uy > e || uy < -e) ? BG : col[k];
      }
    }
    rb.c.getContext("2d").putImageData(rb.id, 0, 0);
    const sm0 = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rb.c, 0, 0, rw, rh, 0, 0, W, H);
    ctx.imageSmoothingEnabled = sm0;
    rz = { zS, R, rS };
  }
  // a cell the raster zone drew, as hitAt()'s record (the tile path pushes these into `drawn`; the raster zone has none)
  function rasterHit(px, py) {
    if (!lay || rz.zS === Infinity) return null;
    const dx = px - W / 2, dy = py - H / 2, r = Math.hypot(dx, dy); if (r < rz.rS) return null;
    lensAt(); const z = Finv(r), q = r < 1e-6 ? 0 : z / r, ix = Math.round(P[0] + dx * q), iy = Math.round(P[1] + dy * q);
    if (ix < lay.gx0 || iy < lay.gy0 || ix >= lay.gx0 + lay.GW || iy >= lay.gy0 + lay.GH) return null;
    const k = lay.grid[(iy - lay.gy0) * lay.GW + ix - lay.gx0]; if (k < 0) return null;
    const ex = ix - P[0], ey = iy - P[1], zc = Math.hypot(ex, ey), f = zc < 1e-6 ? K() * M0 : Fz(zc) / zc, cs = K() * Math.min(magR(zc), tanR(zc));
    return { k, i: lay.items[k], x: W / 2 + ex * f, y: H / 2 + ey * f, d: cs, z: zc, m: 0, w: cs, h: cs };
  }
  // how many cells the raster zone shows right now (PM_CTRL.drawn / QA: "every cell is on screen" stays checkable)
  function rasterCount() {
    if (!lay || rz.zS === Infinity) return 0;
    lensAt(); let n = 0; const cx = W / 2, cy = H / 2;
    for (let k = 0; k < lay.n; k++) {
      const ex = lay.x[k] - P[0], ey = lay.y[k] - P[1], z = Math.hypot(ex, ey); if (z <= rz.zS || z > rz.R) continue;
      const f = Fz(z) / z, sx = cx + ex * f, sy = cy + ey * f;
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) n++;
    }
    return n;
  }
  // the raster zone's cells as {key, x, y, d} records, thinned by a fixed stride so at most ~limit come back (QA only)
  function rasterCells(limit) {
    if (!lay || rz.zS === Infinity || limit <= 0) return [];
    lensAt(); const cx = W / 2, cy = H / 2, all = [];
    for (let k = 0; k < lay.n; k++) {
      const ex = lay.x[k] - P[0], ey = lay.y[k] - P[1], z = Math.hypot(ex, ey); if (z <= rz.zS || z > rz.R) continue;
      const f = Fz(z) / z, sx = cx + ex * f, sy = cy + ey * f;
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) all.push({ key: k, x: sx, y: sy, d: K() * Math.min(magR(z), tanR(z)) });
    }
    if (all.length <= limit) return all;
    const stride = Math.ceil(all.length / limit); return all.filter((_, j) => j % stride === 0);
  }
  function draw(t) {
    lensAt();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2, R = Finv(Math.hypot(W, H) / 2 + 40), k0 = K();
    const zS = rasterEdge(R), Rt = Math.min(R, zS);   // tiles only within Rt of the middle; the far, tiny cells are pixels (see rasterDraw)
    ctx.fillStyle = "#0E0D0B";
    if (zS === Infinity) ctx.fillRect(0, 0, W, H);
    else { const rr = Fz(zS) + 3; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }   // the raster paints its own background everywhere outside the tile disc
    const map = (ex, ey) => { const z = Math.hypot(ex, ey), f = z < 1e-6 ? K() * M0 : Fz(z) / z; return [cx + ex * f, cy + ey * f]; };
    const x0 = Math.floor(P[0] - Rt), x1 = Math.ceil(P[0] + Rt), y0 = Math.floor(P[1] - Rt), y1 = Math.ceil(P[1] + Rt);
    // David, 2026-10-09: "your favorites glowing on the map" -- one Set built once a frame (fvArtList's own
    // {i,...} records already carry the gallery index), not a per-cell favorites lookup.
    const favSet = new Set(pmFavList(F).map(r => r.i));
    if (zS < Infinity) rasterDraw(zS, R); else rz.zS = Infinity;
    drawn = []; const wantImg = [], wantT1 = [];
    for (let y = Math.max(y0, lay.gy0); y <= Math.min(y1, lay.gy0 + lay.GH - 1); y++) {
      const row = (y - lay.gy0) * lay.GW;
      for (let x = Math.max(x0, lay.gx0); x <= Math.min(x1, lay.gx0 + lay.GW - 1); x++) {
        const k = lay.grid[row + x - lay.gx0]; if (k < 0) continue;
        const ex = x - P[0], ey = y - P[1], z = Math.hypot(ex, ey); if (z > R || z > zS) continue;
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
        // David, 2026-10-21 (fully zoomed out the dark seams read as a black screen-door grid): the seam itself now
        // fades to nothing between ~16px cells (unchanged above that) and ~3px cells (butted together), and below
        // that the tile bleeds a half pixel past its place and drops the 3:2 cap so no dark backing or bar is left;
        // at 16px+ `sm` is exactly 1, so ordinary zoom is pixel-identical to before.
        const cs = Math.min(tw, th), sm = cs >= 16 ? 1 : cs <= 3 ? 0 : (u => u * u * (3 - 2 * u))((cs - 3) / 13);
        const gap = Math.min(6, cs * .15, 1 + cs * .05) * sm, bleed = .5 * (1 - sm), cap = 1.5 + 8.5 * (1 - sm);
        tw = Math.min(tw, th * cap) - gap + bleed; th = Math.min(th, (x1 - x0) * cap) - gap + bleed;
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
        const ts1 = pmTState(tierH, i);
        if (hysteresis(ts1, "t1On", b.d / PM_T1_MIN, .75)) {
          wantT1.push(i);
          const te = t1.cell(i);
          if (te) {
            const a1 = pmFadeAlpha(ts1, "f1", t, 220, RM); if (a1 < 1) fading = true;
            ctx.globalAlpha = a1;
            const q = atlas.man.tier1.tile, sw = w0 >= h0 ? q : q * w0 / h0, sh = h0 >= w0 ? q : q * h0 / w0;   // the shape from the unsnapped size: a 1px snap step must not rescale the crop
            ctx.drawImage(te, (q - sw) / 2, (q - sh) / 2, sw, sh, X, Y, w, h);
            ctx.globalAlpha = 1;
          }
        }
      }
      // tier 2: the existing per-painting thumbnail/hi-res loader (pmImages above) -- now only for the few cells
      // actually big enough to show more than tier 1 already does (b.d >= PM_T2_MIN, used to start at a few px
      // and stream in every cell that ever scrolled by, which was the original "waterfall of thousands of
      // requests" this whole tiered system replaces). Drawn exactly as before, over tiers 0/1.
      // the tier-2 layer has the same dead zone as tier 1 (David, 2026-10-21): a tile that dwells at ~120px used to swap
      // its sharper picture in and out as its size crossed PM_T2_MIN by a pixel or two while panning (tiles of 100-300px
      // are exactly this band on a desktop window); now it turns on at PM_T2_MIN and off only below 75% of it
      if (b.d >= PM_T2_MIN || (e && e.t2On)) wantImg.push([i, b.d > 92 || m > .3]);
      if (e && e.st === 1 && hysteresis(e, "t2On", b.d / PM_T2_MIN, .75)) {
        if (e.fadeT == null) e.fadeT = t;
        const age = t - e.fadeT, a = RM ? 1 : Math.min(1, age / 260); if (a < 1) fading = true;
        ctx.globalAlpha = a;
        // the original condition was (b.d > 92 || m > .02); normalize each side of the OR to 1.0 at its own
        // boundary so a single hysteresis() call can gate both at once, with a shared ~25% dead zone below 1
        const closeScore = Math.max(b.d / 92, m / .02);
        const qualifies = hysteresis(e, "closeOn", closeScore, .75);
        const big = qualifies && imgs.big(i);
        if (big) {   // from the full picture: crop (frame away), then cover the tile's own shape
          const sr = e.src, ta = h0 / w0; let sw = sr.sw, sh = sr.sh;
          if (sh / sw > ta) sh = sw * ta; else sw = sh / ta;
          // the source rect follows the SNAPPED dest rect at the same scale (pixels of picture per screen pixel stay what the
          // unsnapped size says), so a 1px snap step moves the edge of the picture, never rescales it (the shimmer while moving)
          const sc = sw / w0, scy = sh / h0, ow = w * sc, oh = h * scy;
          const ox = Math.max(0, Math.min(big.naturalWidth - ow, sr.sx + (sr.sw - sw) / 2 + (X - X0) * sc)), oy = Math.max(0, Math.min(big.naturalHeight - oh, sr.sy + (sr.sh - sh) / 2 + (Y - Y0) * scy));
          ctx.drawImage(big, ox, oy, ow, oh, X, Y, w, h);
        } else if (qualifies) {   // still only the baked square: show it as the square crop at the middle size
          const s = Math.max(w, h); ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, h); ctx.clip(); ctx.drawImage(e.bm, b.x - s / 2, b.y - s / 2, s, s); ctx.restore();
        } else {   // the baked square, cover-cropped to the tile's shape
          const q = PM_BAKE, sw = w0 >= h0 ? q : q * w0 / h0, sh = h0 >= w0 ? q : q * h0 / w0;
          const sc = sw / w0, scy = sh / h0, ow = w * sc, oh = h * scy;
          ctx.drawImage(e.bm, Math.max(0, Math.min(q - ow, (q - sw) / 2 + (X - X0) * sc)), Math.max(0, Math.min(q - oh, (q - sh) / 2 + (Y - Y0) * scy)), ow, oh, X, Y, w, h);
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
    // By look islands: each island's name sits just above its top edge, centered; only where the island is wide enough on screen to
    // carry it (so a label never names a speck), biggest islands first, and a label that would overlap one already placed is skipped.
    if (lay.islands && lay.islands.some(q => q.text)) {
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
      const placedI = []; islRects = placedI;
      for (const q of lay.islands) {
        if (!q.text) continue;
        const ex = (q.x0 + q.x1) / 2 - P[0], ey = q.y0 - .7 - P[1], z = Math.hypot(ex, ey); if (z > R) continue;
        const f = z < 1e-6 ? 0 : Fz(z) / z, sx = cx + ex * f, sy = cy + ey * f, cell = k0 * Math.min(magR(z), tanR(z));
        const wpx = (q.x1 - q.x0 + 1) * cell;
        if (wpx < 58 || sx < -wpx || sx > W + wpx || sy < 150 || sy > H - 100) continue;   // clear of the count pill above and the buttons below
        const fs = Math.min(22, Math.max(15, wpx / 12));
        ctx.font = `400 ${fs}px "Instrument Serif", Georgia, serif`;
        const txt = q.text;
        const tw = ctx.measureText(txt).width; if (tw > Math.max(190, wpx * 1.8)) continue;   // a whole name or none, never a cut one
        const rx0 = sx - tw / 2 - 6, rx1 = sx + tw / 2 + 6, ry0 = sy - fs - 3, ry1 = sy + 6;
        if (rx0 < 4 || rx1 > W - 4) continue;   // never cut by the edge
        if (placedI.some(p => rx0 < p.rx1 && rx1 > p.rx0 && ry0 < p.ry1 && ry1 > p.ry0)) continue;
        placedI.push({ rx0, rx1, ry0, ry1 });
        ctx.fillStyle = "rgba(14,13,11,.8)"; ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        ctx.fillStyle = "rgba(236,232,223,.96)"; ctx.fillText(txt, sx, sy);
      }
      ctx.textAlign = "left";
    }
    // David, 2026-10-09: "zooming out doesn't load the stuff" -- this cap used to be 160, which silently excluded
    // every cell beyond the nearest ~160 from ever being requested at all, however long you waited: want()'s own
    // PM_FLIGHT (14 concurrent) and PM_CACHE_MAX (650) already bound real network/memory use, so the extra slice
    // here was only ever throttling visibility, not cost. 2000 is comfortably above what a phone screen can hold
    // at the 14px threshold above (zMin() also caps how far you can zoom out), so every on-screen eligible cell
    // now gets a turn in the queue, nearest the middle first, same as before.
    imgs.want(wantImg.reverse().slice(0, 2000));
    if (atlas) { wantT1.reverse(); t1.want(wantT1, wantT1.length && ++ringFrames > 2 ? ringCells() : null); }   // nearest the middle first; the ring around the screen joins from the third frame on, so it never delays the first picture. // the cells that want a tier-1 picture; each sheet is decoded once, transiently, and cut into per-cell bitmaps

    const c = nearestK(P[0], P[1]); setCenter(c);
  }
  // ---- gestures: drag to pan (the middle follows the thumb), pinch or wheel to zoom, flick to glide, a tap opens or brings
  const pts = new Map(); let drag = null, pinch = null, press = null;
  const toPlane = (dx, dy) => [dx / (K() * M0), dy / (K() * M0)];
  // Anchor-fixed zoom (David, 2026-10-21): the map is drawn through the round lens (draw(): screen = middle + e * Fz(|e|)/|e|,
  // e = cell - P), so "the point under the fingers" is found by inverting that lens, and after a zoom P is re-solved so the
  // same plane point sits under the same screen point again. Screen points are canvas-local px.
  const planeAt = (sx, sy) => {
    lensAt(); const vx = sx - W / 2, vy = sy - H / 2, r = Math.hypot(vx, vy);
    if (r < 1e-6) return [P[0], P[1]];
    const z = Finv(r); return [P[0] + vx / r * z, P[1] + vy / r * z];
  };
  const anchorAt = (q, sx, sy) => {   // set P so plane point q is drawn at screen (sx, sy) at the CURRENT Z
    lensAt(); const vx = sx - W / 2, vy = sy - H / 2, r = Math.hypot(vx, vy), z = r < 1e-6 ? 0 : Finv(r);
    P = r < 1e-6 ? [q[0], q[1]] : [q[0] - vx / r * z, q[1] - vy / r * z]; clampPan();
  };
  const localXY = (x, y) => { const r = cv.getBoundingClientRect(); return [x - r.left, y - r.top]; };
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
      const [a, b] = [...pts.values()], m = localXY((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); glide = null; V = [0, 0];
      pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: Z, q: planeAt(m[0], m[1]) }; if (drag) drag.moved = true;
      hideCard();
    }
  });
  // desktop hover: a pointer cursor over a painting and, after ~400ms still, a quiet caption (title, painter, year) by the cursor
  let tip = null, tipT = 0, tipK = -1;
  function hideTip() { clearTimeout(tipT); tipT = 0; tipK = -1; if (tip) { tip.remove(); tip = null; } cv.classList.remove("hov"); }
  function hoverTip(e) {
    if (!DESKM() || e.pointerType !== "mouse" || e.buttons) { if (tip || tipK >= 0) hideTip(); return; }
    const b = hitAt(e.clientX, e.clientY);
    cv.classList.toggle("hov", !!b);
    if (!b) { if (tip || tipK >= 0) hideTip(); return; }
    if (tip) { tip.style.left = Math.min(innerWidth - 340, e.clientX + 16) + "px"; tip.style.top = Math.min(innerHeight - 70, e.clientY + 18) + "px"; }
    if (b.k === tipK) return;
    clearTimeout(tipT); if (tip) { tip.remove(); tip = null; } tipK = b.k;
    const x = e.clientX, y = e.clientY;
    tipT = setTimeout(async () => {
      if (dead || tipK !== b.k) return;
      const i = lay.items[b.k]; let d = pmDetailNow(i, F);
      if (!d && (!F.col || F.col === "paintings")) { try { d = await glDetail(i); } catch (er) {} if (dead || tipK !== b.k) return; }
      if (!d) return;
      const a = F.artist[i], yr = pmYearStr(i, F), by = [a ? xbArtistName(F, a) : "", yr].filter(Boolean).join(" \u00b7 ");
      tip = document.createElement("div"); tip.className = "pmx-tip"; tip.innerHTML = `<b>${esc(d.t)}</b>${by ? `<span>${esc(by)}</span>` : ""}`;
      tip.style.left = Math.min(innerWidth - 340, x + 16) + "px"; tip.style.top = Math.min(innerHeight - 70, y + 18) + "px"; document.body.appendChild(tip);
    }, 400);
  }
  cv.addEventListener("pointerleave", hideTip);
  cv.addEventListener("pointerdown", hideTip);
  cv.addEventListener("wheel", hideTip, { passive: true });
  cv.addEventListener("pointermove", hoverTip);
  cv.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      Z = Math.min(ZMAX, rubberLo(pinch.z0 * d / Math.max(10, pinch.d0), zMin()));
      const m = localXY((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); anchorAt(pinch.q, m[0], m[1]);   // zoom about, and pan with, the fingers' midpoint
      kick(); return;
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
  cv.addEventListener("wheel", e => {
    e.preventDefault(); touched = true; glide = null; V = [0, 0];
    const m = localXY(e.clientX, e.clientY), q = planeAt(m[0], m[1]), kind = wheelKind(e);
    if (kind === "pad") {   // two-finger scroll pans, 1:1: the plane point under the cursor moves by -delta (Figma / Google Maps)
      anchorAt(q, m[0] - wheelPx(e, e.deltaX), m[1] - wheelPx(e, e.deltaY)); hideCard();
    } else {   // zoom about the cursor (trackpad pinch = ctrl+wheel, much finer steps; a notched mouse wheel)
      const dy = wheelPx(e, e.deltaY || e.deltaX);
      Z = Math.min(ZMAX, rubberLo(Z * Math.exp(-dy * (kind === "pinch" ? .01 : .0015)), zMin())); anchorAt(q, m[0], m[1]);
    }
    kick(); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 180); }, { passive: false });
  // desktop Safari pinch (gesture events): zoom about the cursor, never the page
  let gz0 = 1;
  cv.addEventListener("gesturestart", e => { e.preventDefault(); gz0 = Z; glide = null; V = [0, 0]; });
  cv.addEventListener("gesturechange", e => {
    e.preventDefault(); touched = true; const m = localXY(e.clientX, e.clientY), q = planeAt(m[0], m[1]);
    Z = Math.min(ZMAX, rubberLo(gz0 * e.scale, zMin())); anchorAt(q, m[0], m[1]); kick(); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 180);
  });
  cv.addEventListener("gestureend", e => e.preventDefault());
  cv.addEventListener("contextmenu", e => e.preventDefault());
  function hitAt(x, y) {
    const r = cv.getBoundingClientRect(), px = x - r.left, py = y - r.top;
    for (let j = drawn.length - 1; j >= 0; j--) { const b = drawn[j]; if (Math.abs(px - b.x) <= b.w / 2 && Math.abs(py - b.y) <= b.h / 2) return b; }
    return rasterHit(px, py);
  }
  function bloomAt(x, y) {
    const bl = document.createElement("i"); bl.className = "fva-bloom pmx-bloom"; bl.innerHTML = FVA_HEART_ON;
    bl.style.left = x + "px"; bl.style.top = y + "px"; el.appendChild(bl); setTimeout(() => bl.remove(), 900);
  }
  // double-tap the centered painting to like it (Instagram-style, David 2026-10-09): opening it is delayed the
  // same ~280ms js/gallery.js and js/swatch.js use, so a quick second tap can be caught first and turned into
  // the heart burst + toggle instead of opening the page
  let lastTapAt = 0, tapTimer = 0;
  // Desktop (David, 2026-10-21, correcting the two-step: "I don't want the painting zoomed in when you click it in the map"): a
  // click on a painting opens its PAGE straight away, no glide and no card; the map stays exactly as it is, so Back lands on it.
  // The zoom viewer is a click on the picture on that page (js/gallery.js). A phone keeps the card and its taps below.
  const DESKM = () => document.documentElement.classList.contains("desk");
  function tap(x, y) {
    const b = hitAt(x, y); if (!b) { hideCard(); return; }   // tap-away: empty space closes whatever's open
    if (DESKM()) { hideTip(); buzz(5); openK(b.k, true); return; }
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
  function openK(k, keepView) {
    const i = lay.items[k];
    PM_PAN.set(lay.key, keepView ? { x: P[0], y: P[1], s: Z, cardOpen: false } : { x: lay.x[k], y: lay.y[k], s: Z, cardOpen: true });
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
    paintChipbar(); syncDo(); paintCount();
  }
  // the quiet count in the top-center, under the Colors|Paintings switch (David, 2026-10-21: the map should always say how
  // many paintings you are looking at). Same number the Filter sheet shows (lay.n = pmRun's list, favorites and the time
  // scrubber applied): "104,726 paintings", and once something narrows it "1,326 of 104,726 paintings". The one-painter map
  // already has this as the chip beside the painter's name (paintChipbar), so it stays hidden there. A tap opens Filter.
  let cntShown = -1, cntRaf = 0;
  function paintCount() {
    const b = el.querySelector("[data-pmcount]"); if (!b) return;
    const nounP = pmColLabel(F, "nounP"), nounS = pmColLabel(F, "noun"), total = (F.N | 0) - pmHidN(F);
    b.hidden = pmSolo(s) || !lay || !total || !lay.n && !pmActiveChips(s, F).length;
    el.classList.toggle("pmx-hascount", !b.hidden);
    if (b.hidden) { cntShown = -1; return; }
    const n = lay.n, narrowed = n !== total;
    const put = v => { b.innerHTML = `<span class="pmx-cnum">${Math.round(v).toLocaleString()}</span>${narrowed ? ` of ${total.toLocaleString()}` : ""} ${total === 1 || (!narrowed && n === 1) ? esc(nounS) : esc(nounP)}`; };
    b.setAttribute("aria-label", `${n.toLocaleString()}${narrowed ? " of " + total.toLocaleString() : ""} ${n === 1 && !narrowed ? nounS : nounP}. Open Filter`);
    b.dataset.n = n;
    cancelAnimationFrame(cntRaf);
    const from = cntShown, t0 = performance.now(), D = 320;
    cntShown = n;
    if (RM || from < 0 || from === n) { put(n); return; }
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); put(from + (n - from) * e); if (k < 1) cntRaf = requestAnimationFrame(step); else put(n); };
    cntRaf = requestAnimationFrame(step);
  }
  el.querySelector("[data-pmcount]").onclick = () => { buzz(4); openSheet("filter"); };
  // the bottom edge of the chip row (it wraps to two lines when several filters are on), plus a little air
  function soloInset() { if (chipbar.hidden) return 0; const r = chipbar.getBoundingClientRect(), c = cv.getBoundingClientRect(); return Math.max(0, r.bottom - c.top) + 8; }
  function syncDo() {}   // the corner is the same "⋮" on every map now (the color map's look); kept as a hook for chrome()
  // removable active-filter chips atop the map (David, 2026-10-09): the primary way to SEE and UNDO a filter,
  // whichever way it got set (the Filter tab, or a tap on a painting's own facet) -- opening the sheet is no
  // longer required just to clear one thing.
  // the color / palette chip: swatches, its name, the live count, and a tap on it opens the closeness panel; its own x removes it
  function colorChipHTML(c, k) {
    const f = s.f, n = lay ? lay.n : 0, noun = pmColLabel(F, n === 1 ? "noun" : "nounP");
    const dots = f.hexes.slice(0, 6).map(h => `<i class="pmx-xdot" style="--c:${h}"></i>`).join("");
    return `<span class="pmx-xchip pmx-xcolor"><button class="pmx-xcl-main" data-pmxclose aria-label="${esc(c.text)}: ${n.toLocaleString()} ${esc(noun)}. Change how close">${dots}<b>${esc(c.text)}</b><span> · ${n.toLocaleString()} ${esc(noun)}</span>${PM_ICON.filter}</button><button class="pmx-xcl-x" data-pmxclear="${k}" aria-label="Remove ${esc(c.text)} and show every painting"><i>${ICON.x}</i></button></span>`;
  }
  function paintChipbar() {
    const chips = pmActiveChips(s, F), solo = pmSolo(s);
    // one-painter map: the painter is the scope, not a filter (no ✕); a quiet count says how much of their work you're
    // looking at ("212 of 975 paintings", a tap opens Filter); the time scrubber shows up as a chip too; Clear removes
    // every filter at once while keeping the painter.
    let total = 0;
    if (solo) {
      chips.sort((p, q) => (q.dim === "painter") - (p.dim === "painter"));   // the scope first, then what narrows it
      if (s.upToYear != null && s.upToYear < yrRange()[1]) chips.push({ dim: "uy", text: "Up to " + s.upToYear });
      total = pmSoloYears(s.f.painterSet[0], F).total;
    }
    if (!solo) chips.sort((p, q) => (q.dim === "color") - (p.dim === "color"));   // a color or a palette is the question you asked: it leads
    chipbar.hidden = !chips.length;
    if (!chips.length) { chipbar.innerHTML = ""; return; }
    const nf = solo ? chips.filter(c => c.dim !== "painter").length : 0;
    chipbar.classList.toggle("pmx-chipbar-wrap", solo);
    chipbar.innerHTML = chips.map((c, k) => solo && c.dim === "painter"
      ? `<button class="pmx-xchip pmx-xscope" data-pmxclear="${k}" aria-label="${esc(c.text)}: show every ${esc(pmColLabel(F, "painter").toLowerCase())}">${esc(c.text)}<i>${ICON.x}</i></button><button class="pmx-xchip pmx-xcount" data-pmxfilter aria-label="Filter: ${lay.n.toLocaleString()} of ${total.toLocaleString()} ${esc(pmColLabel(F, "nounP"))}">${lay.n === total ? total.toLocaleString() : lay.n.toLocaleString() + " of " + total.toLocaleString()} ${esc(pmColLabel(F, total === 1 ? "noun" : "nounP"))}${PM_ICON.filter}</button>`
      : c.dim === "color" && s.f.hexes.length ? colorChipHTML(c, k)
      : `<button class="pmx-xchip" data-pmxclear="${k}">${esc(c.text)}<i>${ICON.x}</i></button>`).join("")
      + (nf > 1 ? `<button class="pmx-xchip pmx-xall" data-pmxall>Clear all</button>` : "");
    chipbar.querySelectorAll("[data-pmxclear]").forEach(b => b.onclick = () => {
      const c = chips[+b.dataset.pmxclear]; buzz(5);
      if (c.dim === "uy") { if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; } s.upToYear = null; }
      else if (c.dim === "fav") s.fav = 0; else pmChipClear(s.f, c.dim);
      rebuild();
    });
    const cf = chipbar.querySelector("[data-pmxfilter]"); if (cf) cf.onclick = () => { buzz(4); openSheet("filter"); };
    const cc = chipbar.querySelector("[data-pmxclose]"); if (cc) cc.onclick = () => { buzz(4); openClose(); };

    const ca = chipbar.querySelector("[data-pmxall]"); if (ca) ca.onclick = () => { buzz(6); if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; } s.f = scopedFresh(); s.fav = 0; s.upToYear = null; rebuild(); };
  }
  function build(keepPan, fo) {
    const t0 = performance.now();
    if (!pmArrOk(s)) { s.arr = "color"; s.seed = -1; }   // e.g. the painter scope was cleared while By museum was showing
    lay = pmLayout(s, F); PM_NOW = { s, lay };
    if (pmSolo(s)) paintChipbar();   // its real height (one line or two) decides the top inset the fit below uses
    wait.hidden = !!lay.n; wait.classList.remove("pmx-wait-empty"); if (lay.n) wait.textContent = "";
    if (!lay.n) {
      if (pmSolo(s)) {
        const parts = pmActiveChips(s, F).filter(c => c.dim !== "painter").sort((p, q) => (p.dim === "when") - (q.dim === "when")).map(c => c.text);
        if (s.upToYear != null) parts.push("up to " + s.upToYear);
        wait.innerHTML = `${parts.length ? `Nothing in ${esc(parts.join(", "))}.` : "No paintings here."} <button class="wl" data-pmloosen>Loosen the range</button>`;
      } else if (s.f.hexes.length) {   // a color or a palette that nothing holds this closely: say so, and offer the one step that helps
        const ov = s.f.colorMode === "overall", maxTol = ov ? PM_PAL_MAX : 30, can = s.f.tol < maxTol;
        wait.classList.add("pmx-wait-empty");
        wait.innerHTML = `<span class="pmx-empty-t">No ${esc(pmColLabel(F, "nounP"))} hold ${ov ? "this palette" : s.f.hexes.length > 1 ? "all of these colors" : "this color"} that closely.</span><span class="pmx-empty-a">${can ? `<button class="pmx-ebtn" data-pmloosen2>Loosen the closeness</button>` : ""}<button class="pmx-ebtn${can ? " ghost" : ""}" data-pmloosen>${pmActiveChips(s, F).length > 1 ? "Clear the filters" : "Show every painting"}</button></span>`;
        const l2 = wait.querySelector("[data-pmloosen2]"); if (l2) l2.onclick = () => { s.f.tol = Math.min(maxTol, s.f.tol + (ov ? 3 : 6)); rebuild({ focus: lastFocus }); };
      } else wait.innerHTML = `Nothing matches all of that. <button class="wl" data-pmloosen>Clear the filters</button>`;
    }
    const lz = wait.querySelector("[data-pmloosen]"); if (lz) lz.onclick = () => { s.f = scopedFresh(); s.fav = 0; if (pmSolo(s)) s.upToYear = null; rebuild(); };
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
    // Phase A (David, 2026-10-24: "if I adjust the settings, the painting that I'm on would stay in the middle"): every
    // rebuild() hands build() the painting you were on (fo). If it is still in the new list it lands in the middle at your
    // zoom; if the settings filtered it out, the closest painting in color does, and a quiet line offers it back. A seed
    // (Rings, Spiral, Walk, Center on) is its own anchor and keeps its own rule.
    let foc = null;
    if (s.hit && lay.n && s.f.hexes.length) {   // an entry point from a color or a palette: land on the painting that matches best, at a zoom that shows its neighborhood
      s.hit = 0;
      // a palette that came from a painting (on=<index>): that painting is the palette's parent, so it sits in the middle
      // (if the filter happens to drop it, the closest in color lands there instead and the quiet line offers it back)
      if (s.on != null && s.on >= 0) { fo = { i: s.on, z: .8, open: false }; s.on = -1; }
      else { const bk = pmBestMatch(lay, s.f, F); if (bk >= 0) fo = { i: lay.items[bk], z: .8, open: false }; }
    }
    // A cold start (js/boot.js): land on a random cluster of the whole map, at the ordinary opening zoom (z 0 = fitZoomFor, the
    // same distance a plain open uses), with no card and no ring around the painting
    if (s.rnd) { s.rnd = 0; if (lay.n > 300 && !lay.islands && !fo && !keepPan) fo = { i: lay.items[pmRandomCluster(lay)], z: 0, open: false, quiet: true }; }
    if (s.on != null && s.on >= 0 && lay.n && !fo) { fo = { i: s.on, z: 0, open: true }; s.on = -1; }   // z 0: fit the whole filtered set (a one-painter map opens whole)
    if (fo && lay.n && !pinned && !keepPan) {
      let fk = -1; for (let q = 0; q < lay.n; q++) if (lay.items[q] === fo.i) { fk = q; break; }
      const out = fk < 0;
      if (out) fk = pmNearestInColor(lay, fo.i, F);
      if (fk >= 0) foc = { k: fk, out, fo };
    }
    const mem = pinned || foc ? null : PM_PAN.get(lay.key);
    if (foc) { P = [lay.x[foc.k], lay.y[foc.k]]; Z = fo.z > 0 ? fo.z : fitZoomFor(lay); const zf = zFit(); if (Z < zf) Z = zf; }   // keep your zoom, unless the new layout is smaller than the window at it
    else if (mem && !keepPan) { P = [mem.x, mem.y]; Z = mem.s; }
    else if (!keepPan) { P = pmSolo(s) ? [lay.gx0 + (lay.GW - 1) / 2, lay.gy0 + (lay.GH - 1) / 2] : lay.start.slice(); Z = fitZoomFor(lay); const k = lay.islands ? -1 : nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; if (pmSolo(s) && !pinned) { const zm = zFit(); if (zm < 1) Z = zm; } }   // (the snap above moved P a little: re-fit from where it actually sits)
    if (keepPan && !lay.islands) { const k = nearestK(P[0], P[1]); if (k >= 0) P = [lay.x[k], lay.y[k]]; }
    Z = clamp(Z, zMin(), ZMAX);
    // the card itself (David, 2026-10-09): opens for a reason -- a seed just pinned the view to one painting
    // (a tap, Walk, a Center-on preset, a fresh entry point) -- and stays closed for a plain dense browse, same
    // as switching Arrange to Color/Time/Painter should clear whatever was open rather than leave it stranded.
    // David, 2026-10-10: "Back should restore the exact prior view... the card state" too -- an unseeded
    // arrangement's remembered pan (mem) now also remembers whether the card was open, so leaving a painting's
    // card open, opening a painting, then Back, lands back with that same card open (not silently closed just
    // because this arrangement has no single seed to open it reflexively like Rings/Spiral do).
    if (!keepPan) cardOpen = foc ? (fo.open && !foc.out) : mem ? !!mem.cardOpen : pinned;
    centerK = -1; drawn = []; setCenter(lay.n ? nearestK(P[0], P[1]) : -1); chrome(); kick();
    const why = foc && foc.out ? pmOutsideWhy(s, F, fo.i) : null;
    paintNote(why ? { i: fo.i, ...why } : null);
    if (foc && !fo.quiet) { pulseI = lay.items[foc.k]; pulseT0 = clock; }
    if (foc) lastFocus = { i: lay.items[foc.k], z: Z, open: cardOpen };
    // a brief highlight on the painting an entry point promised, so it reads as "you're here", not just a jump cut
    if (pinned && !keepPan && centerK >= 0) { pulseI = lay.items[centerK]; pulseT0 = clock; }
    if (window.PM_DEBUG) console.log("paintmap layout", s.arr, lay.n, Math.round(performance.now() - t0) + "ms");
  }
  // The painting you are on, captured BEFORE a settings change (Phase A). centerK is always the cell nearest the middle; a
  // glide in flight counts at its destination. lastFocus survives an empty result so loosening comes back to the same painting.
  let lastFocus = null, islRects = [];
  function focusNow() {
    if (lay && lay.n && centerK >= 0) {
      let k = centerK;
      if (glide) { const gk = nearestK(glide.b[0], glide.b[1]); if (gk >= 0) k = gk; }
      lastFocus = { i: lay.items[k], z: glide && glide.z ? glide.z[1] : Z, open: cardOpen };
    }
    return lastFocus;
  }
  // o.focus: land on this painting instead (an entry point, Bring it back); o.nofocus: a cinematic step (the time Play) that is allowed to move
  function rebuild(o) {
    const fo = o && o.nofocus ? null : o && o.focus ? o.focus : focusNow();
    // the address follows (replace: a filter change is the same map, not a new page)
    try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
    if (!pmMatchReady(F, s.f)) return palWait(() => build(false, fo));
    build(false, fo);
  }
  // A color or palette needs its distance table first (pmMatchCompute, in time slices): the map you were on stays up and alive
  // under a quiet "Matching 206,345 paintings · 40%" line, then lands (the first open shows the same line over the empty stage)
  let palSeq = 0;
  function palWait(then) {
    const my = ++palSeq, f = s.f, noun = pmColLabel(F, "nounP");
    const say = pct => {
      if (!lay) { wait.hidden = false; wait.textContent = `Finding ${noun} with this palette · ${Math.round(pct * 100)}%`; return; }
      noteEl.hidden = false; noteEl.className = "pmx-note pmx-note-busy";
      noteEl.innerHTML = `<span>Matching ${F.N.toLocaleString()} ${esc(noun)} · ${Math.round(pct * 100)}%</span>`;
      const ref = !chipbar.hidden ? chipbar : null; noteEl.style.top = ref ? ref.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 8 + "px" : "";
    };
    say(0);
    pmMatchCompute(F, f, p => { if (my === palSeq && !dead) say(p); }, () => my === palSeq && !dead).then(ok => {
      if (dead || my !== palSeq) return;
      noteEl.className = "pmx-note"; noteEl.hidden = true; noteEl.innerHTML = "";
      if (!ok) return;
      // "close" for a painting's own palette: the tightest setting that still leaves a map to look at (a distinctive palette has few
      // near twins, a common one has hundreds), never looser than where it started
      if (s.f.auto && s.f.colorMode === "overall") {
        s.f.auto = 0; const pd = pmPalDist(F, s.f);
        if (pd) { const cnt = new Int32Array(PM_PAL_MAX + 2); for (let i = 0; i < pd.length; i++) { const d = Math.ceil(pd[i]); if (d <= PM_PAL_MAX) cnt[d]++; } let acc = 0, pick = s.f.tol; for (let tt = 1; tt <= s.f.tol; tt++) { acc += cnt[tt]; if (acc >= 48) { pick = tt; break; } } s.f.tol = Math.max(3, pick); }
        try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
      }
      then();
    });
  }
  // the quiet line when the painting you were on is outside the new settings: "Your painting is outside 1750–1850 · Bring it back"
  const noteEl = el.querySelector("[data-pmnote]");
  function paintNote(n) {
    if (!noteEl) return;
    if (!n) { if (noteEl.classList.contains("pmx-note-busy")) return; noteEl.hidden = true; noteEl.innerHTML = ""; return; }
    noteEl.className = "pmx-note"; noteEl.hidden = false;
    noteEl.innerHTML = `<span>Your painting is outside ${esc(n.text)}</span><button class="pmx-note-go" data-pmnotego>Bring it back</button><button class="pmx-note-x" data-pmnotex aria-label="Dismiss">${ICON.x}</button>`;
    const ref = !chipbar.hidden ? chipbar : el.querySelector("[data-pmcount]");
    const top = ref && !ref.hidden ? ref.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 8 : 0;
    noteEl.style.top = top ? top + "px" : "";
    noteEl.querySelector("[data-pmnotex]").onclick = () => { buzz(3); paintNote(null); };
    noteEl.querySelector("[data-pmnotego]").onclick = () => {
      buzz(8); n.fix(s); s.fav = s.fav || 0; paintNote(null);
      rebuild({ focus: { i: n.i, z: Z, open: true } });
    };
  }
  // ---- the corner and the title both open one compact, non-modal Arrange|Filter sheet (David, 2026-10-09: the
  // same Arrange+Filter parity the color map's chooser() has -- shapes/sort/place-by/center-on, live-applied,
  // no separate confirm step). Replaces the old radial stem menu and the standalone Filter-only sheet.
  const doBtn = el.querySelector(".pmx-do"); doBtn._html = doBtn.innerHTML;
  doBtn.onclick = () => openSheet("arrange");
  el.querySelector("[data-pmsearch]").onclick = () => openFind();
  // ---- the corners must come back to exactly where they were after a search (David, 2026-10-20: after the keyboard
  // went up and down, Places and the dots sat low, nearly off the bottom). Root cause: js/core.js clampCorners() runs on
  // every window resize and on every sheet close; with the keyboard up, innerHeight is short, so it sees the corners
  // "overflowing" and writes an inline bottom (0) that nothing clears if no later resize fires. While the keyboard is up
  // the corners must keep their CSS position, so any inline override is wiped then; with it down the normal clamp
  // (short landscape screens) runs again. Heals on resize, visualViewport changes, focus leaving the field and whenever
  // a sheet is removed from the page.
  let ihMax = innerHeight, iwWas = innerWidth;
  const kbUp = () => { if (innerWidth !== iwWas) { iwWas = innerWidth; ihMax = innerHeight; } ihMax = Math.max(ihMax, innerHeight); return innerHeight < ihMax - 120; };
  const healCorners = () => {
    if (dead || !el.isConnected) return;
    if (kbUp()) el.querySelectorAll(".corner").forEach(b => { b.style.bottom = ""; });
    else if (typeof clampCorners === "function") clampCorners();
  };
  const healSoon = () => { healCorners(); [120, 360, 800].forEach(ms => setTimeout(healCorners, ms)); };
  addEventListener("resize", healCorners);
  if (window.visualViewport) visualViewport.addEventListener("resize", healCorners);
  el.addEventListener("focusout", healSoon, true);
  const sheetWatch = new MutationObserver(() => { if (!document.querySelector(".sheet")) healSoon(); });
  sheetWatch.observe(document.body, { childList: true });
  cleanup.push(() => { removeEventListener("resize", healCorners); if (window.visualViewport) visualViewport.removeEventListener("resize", healCorners); sheetWatch.disconnect(); });
  // ---- the round search button (the color map's own, js/home.js #hmTopSearch): painters and paintings in one field.
  // A painter scopes the map to them (the same painterSet the Filter tab's chips set); a painting is centered and its
  // card opened. Painting titles come from the detail shards already loaded for this map (the gallery fetches titles
  // lazily, js/gallery.js), so it finds what you have been looking at; painters are always the whole list.
  let artN = null;
  function findPainters(q) {
    if (!artN) { artN = new Int32Array(F.meta.artists.length + 1); for (let i = 0; i < F.N; i++) artN[F.artist[i]]++; }
    const ql = q.toLowerCase();
    const strict = F.meta.artists.map((a, j) => ({ v: j + 1, name: a[0], n: artN[j + 1] })).filter(x => x.n && (" " + x.name.toLowerCase().replace(/[-'’.]/g, " ")).includes(" " + ql))   // word starts only: "monet" must not find "Simonet"
      .sort((a, b) => (b.name.toLowerCase().startsWith(ql) - a.name.toLowerCase().startsWith(ql)) || b.n - a.n).slice(0, 6);
    if (strict.length || typeof sqFuzzyRank !== "function") return strict;
    return sqFuzzyRank(F.meta.artists.map((a, j) => ({ v: j + 1, name: a[0], n: artN[j + 1] })).filter(x => x.n), q, x => x.name, 6).hits;   // typos: "van goh", "sargnet"
  }
  function findWorks(q) {
    if (!lay) return [];
    const ql = q.toLowerCase(), out = [];
    for (let k = 0; k < lay.n && out.length < 8; k++) {
      const i = lay.items[k], d = pmDetailNow(i, F);
      if (d && d.t && d.t.toLowerCase().includes(ql)) out.push({ k, i, t: d.t, a: F.artist[i] ? xbArtistName(F, F.artist[i]) : "", y: pmYearStr(i, F), c: pmHex(i, F) });
    }
    return out;
  }
  function openFind() {
    if (document.querySelector(".sheet,.rooms-stem")) return;
    const painterLab = pmColLabel(F, "painter"), nounP = pmColLabel(F, "nounP"), nounS = pmColLabel(F, "noun");
    const { sh, close } = sheet(`<div class="sr-sheet"><div class="sr-field"><span>${ICON.search}</span><input type="search" class="sr-input" placeholder="Painter, place, subject or years" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search the map"></div><div class="sr-body" data-pmfb></div></div>`);
    sh.classList.add("sr-sheet-wrap", "pmx-findsheet");
    const inp = sh.querySelector(".sr-input"), body = sh.querySelector("[data-pmfb]");
    const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
    const cache = new Map();
    let rows = [];
    // the live count of one suggestion: the map's own filter pass, with this suggestion's pieces laid over the filters already on
    const countOf = ps => {
      const key = JSON.stringify([ps.map(p => [p.kind, p.val, p.vals, p.y0, p.y1]), s.f.y0, s.f.y1, s.f.coSet, s.f.mvSet, s.f.painterSet, s.f.hexes, s.f.hueBand, s.f.l0, s.f.l1, s.f.musSet, s.f.tySet, s.f.subjSet, !!SUBJ]);
      if (cache.has(key)) return cache.get(key);
      const f = { ...s.f }; ps.forEach(p => pmqApply(f, p));
      const n = pmRun({ f }, F).list.length; cache.set(key, n); return n;
    };
    const nLine = n => `${n.toLocaleString()} ${n === 1 ? esc(nounS) : esc(nounP)}`;
    const rowHTML = (r, k) => `<li><button class="sr-row" data-pmq="${k}"><b>${esc(r.ps.slice().sort((a, b) => PMQ_ORDER[a.kind] - PMQ_ORDER[b.kind]).map(p => p.label).join(" · "))}</b><small>${nLine(r.n)}</small></button></li>`;
    const addRow = (ps) => { const n = countOf(ps); if (!n) return null; if (rows.some(r => r.ps.length === ps.length && r.ps.every((p, i) => p.label === ps[i].label && p.kind === ps[i].kind))) return null; const r = { ps, n }; rows.push(r); return r; };
    const run = () => {
      const q = inp.value.trim(); rows = [];
      if (!q) { body.innerHTML = `<p class="fine sr-empty">Try a ${esc(painterLab.toLowerCase())}, a title, or mix a place, a style and years: “Russia 1860–80s”, “Dutch Baroque”, “Monet boats”, “portraits 1880s”.</p>`; return; }
      let { pieces, rest } = pmqParse(q, F);
      // a painter's name that happens to hold a subject word ("Man Ray"): the whole query names a painter, so it is one
      if (pieces.length && !rest && pieces.every(p => p.kind === "subj") && findPainters(q).length) { pieces = []; rest = q; }
      let html = "", note = "";
      let title = rest || q;
      if (pieces.length) {
        // what is left over may name a painter: it joins the pieces as one more piece
        const hits = rest ? findPainters(rest) : [];
        const base = pieces.slice();
        const mvp = base.find(p => p.kind === "mv"), hasYr = base.some(p => p.kind === "when");
        const sets = [];   // each: the pieces of one combined suggestion
        const withEra = (arr) => arr.map(p => p.kind === "mv" ? { kind: "when", y0: p.era[0], y1: p.era[1], label: p.era[2] } : p);
        const tagSet = base.filter(p => !(p.kind === "mv" && !p.val));
        const eraSet = mvp && mvp.era && !hasYr ? withEra(base) : null;
        const painterPiece = hits[0] ? { kind: "painter", val: hits[0].v, label: hits[0].name } : null;
        const mk = arr => painterPiece ? [...arr, painterPiece] : arr;
        if (tagSet.length) sets.push(mk(tagSet));
        if (eraSet) sets.push(mk(eraSet));
        sets.sort((a, b) => countOf(b) - countOf(a));   // the fuller answer first (a sparse movement tag vs. its whole era)
        // all of it first, then each piece alone
        sets.forEach(a => addRow(a));
        const singles = base.length > 1 || painterPiece ? [...base.filter(p => !(p.kind === "mv" && !p.val)), ...(painterPiece ? [painterPiece] : [])] : [];
        if (singles.length > 1) singles.forEach(p => addRow([p]));
        if (eraSet && !rows.length) addRow(withEra(base));
        const allOf = sets.some(a => countOf(a) > 0);
        if (rows.length) html += `<h3 class="title-3 sr-h">${allOf ? "Filter the map" : "Closest matches"}</h3><ul class="sr-list">${rows.map(rowHTML).join("")}</ul>`;
        if (mvp && !mvp.val && hasYr) note += `<p class="fine sr-empty">${esc(cap(mvp.label.replace(/ era$/, "")))} isn't a tag on this map, so only the years were used.</p>`;
        if (!allOf) {
          // a designed empty state: say exactly what was asked for, and what to loosen
          const bits = base.filter(p => p.kind !== "when" && p.kind !== "subj"), yrs = base.find(p => p.kind === "when"), sjp = base.find(p => p.kind === "subj");
          const who = bits.map(p => p.kind === "co" ? (p.adj || p.label) : p.label).join(" ");
          const hasOther = pmActiveChips(s, F).some(c => !["when", "co", "mv", "painter"].includes(c.dim));
          note = `<p class="fine sr-empty"><b class="sr-none">No ${esc(who ? who + " " : "")}${esc(nounP)}${sjp ? " of " + esc(sjp.label.toLowerCase()) : ""}${painterPiece ? " by " + esc(painterPiece.label) : ""}${yrs ? " from " + esc(yrs.label) : ""}.</b> ${yrs ? "Try a wider range." : "Try dropping a word."}${hasOther ? " Some of your other filters are still on." : ""}</p>`;
        }
        if (hits.length > (painterPiece ? 1 : 0)) {
          const more = hits.slice(1).map(x => { const pr = { kind: "painter", val: x.v, label: x.name }; const r = addRow([...base.filter(p => !(p.kind === "mv" && !p.val)), pr]); return r; }).filter(Boolean);
          if (more.length) html += `<h3 class="title-3 sr-h">${esc(painterLab)}s</h3><ul class="sr-list">${more.map(r => rowHTML(r, rows.indexOf(r))).join("")}</ul>`;
        }
        title = hits.length ? "" : rest;
      }
      const ps2 = !pieces.length && q ? findPainters(q) : [];
      const ws = title ? findWorks(title) : [];
      if (!pieces.length) {
        if (!ps2.length && !ws.length) { body.innerHTML = `<p class="fine sr-empty"><b class="sr-none">Nothing matches “${esc(q)}”.</b> Try a ${esc(painterLab.toLowerCase())}, a country, a style like Impressionism, or years like 1880s.</p>`; return; }
        html += (ps2.length ? `<h3 class="title-3 sr-h">${esc(painterLab)}s</h3><ul class="sr-list">${ps2.map(x => `<li><button class="sr-row" data-pmfp="${x.v}"><b>${esc(x.name)}</b><small>${x.n.toLocaleString()} ${x.n === 1 ? esc(nounS) : esc(nounP)}</small></button></li>`).join("")}</ul>` : "");
      } else if (rest && !ws.length && !(rest && findPainters(rest).length)) {
        note += `<p class="fine sr-empty">No ${esc(painterLab.toLowerCase())} or title matches “${esc(rest)}”, so it was left out.</p>`;
      }
      html += (ws.length ? `<h3 class="title-3 sr-h">${esc(cap(nounP))}</h3><ul class="sr-list">${ws.map(x => `<li><button class="sr-row" data-pmfw="${x.k}"><span class="sr-dot" style="background:${x.c}"></span><b>${esc(x.t)}</b><small>${esc([x.a, x.y].filter(Boolean).join(" · "))}</small></button></li>`).join("")}</ul>` : "");
      body.innerHTML = note + html;
    };
    run();
    if ((F.col || "paintings") === "paintings" && !SUBJ) loadSubjects().then(() => { if (inp.isConnected && inp.value.trim()) { cache.clear(); run(); } }).catch(() => {});
    inp.addEventListener("input", run);
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
    sh.addEventListener("click", e => {
      const p = e.target.closest("[data-pmfp]"), w = e.target.closest("[data-pmfw]"), g = e.target.closest("[data-pmq]");
      if (g) { const r = rows[+g.dataset.pmq]; if (!r) return; buzz(6); close(); r.ps.forEach(pc => pmqApply(s.f, pc)); s.fav = 0; rebuild(); return; }
      if (p) { buzz(6); close(); s.f.painterSet = [+p.dataset.pmfp]; s.fav = 0; rebuild(); return; }
      if (w) { const k = +w.dataset.pmfw; buzz(6); close(); cardOpen = true; glideTo([lay.x[k], lay.y[k]], 420, Math.max(Z, PM_TAP_ZOOM)); setTimeout(() => { if (!dead) { setCenter(k); caption(); } }, 440); }
    });
  }
  // "More" under a painting (Phase B): toggles that combine (AND), each with a live count, applied live while the map stays
  // visible behind a docked panel. Teacher / students / influences are left out: that data (the Wikidata links) is not
  // loaded in the browser for this map, so there is nothing honest to count.
  function openMore(i) {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;
    const d = pmDetailNow(i, F), name = d && d.t ? d.t : "this painting";
    const tg = pmTogglesOf(i, F), pal = pmPaletteOf(i, F), est = pmIsEst(i, F);
    const palT = pal && { id: "palette", label: "Close palette", sub: "Paintings with nearly the same colors", patch: f => { f.hexes = pal.hexes.slice(); f.shares = pal.shares.slice(); f.colorMode = "overall"; f.tol = PM_PAL_CLOSE; f.auto = 1; f.cover = 0; f.name = "This painting's palette"; }, clear: f => { f.hexes = []; f.shares = null; f.name = ""; f.colorMode = "any"; f.auto = 0; }, on: f => f.colorMode === "overall" && pmSameSet(f.hexes, pal.hexes) };
    const withinT = N => { const sp = pmEraSpan(i, F, N); return sp && { id: "w" + N, label: `Within ${N} years`, patch: f => { f.y0 = sp[0]; f.y1 = sp[1]; }, clear: f => { f.y0 = null; f.y1 = null; }, on: f => f.y0 === sp[0] && f.y1 === sp[1] }; };
    const within = PM_WITHIN.map(withinT).filter(Boolean);
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser pmx-more">
        <div class="hm-ch-head" data-sheet-grab><b class="pmx-more-t" title="${esc(name)}">Around this painting</b><button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>
        <div class="hm-ch-scroll" data-sheet-scroll><div class="pmx-more-acts"><button class="pmx-act" data-pmarrange-go><b>Around this painting</b><small>Arrange the neighbors by how alike they are</small></button><button class="pmx-act" data-pmwalk-go><b>Walk from here</b><small>Step to the most similar painter, again and again</small></button></div><div class="pmx-more-top"><span data-pmmoren></span><button class="pmx-reset" data-pmmoreclear>Clear these</button></div><div data-pmmorebody></div></div>
      </div>`, { lock: false });
    sh.classList.add("pmx-sheet", "pmx-moresheet", "hm-sheet-panel", "hm-sheet-arrange");
    sh.setAttribute("aria-label", "Narrow the map around this painting");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    const body = sh.querySelector("[data-pmmorebody]"), nEl = sh.querySelector("[data-pmmoren]"), clr = sh.querySelector("[data-pmmoreclear]");
    sh.querySelector("[data-sheet-close]").onclick = () => { buzz(4); close(); };
    sh.querySelector("[data-pmarrange-go]").onclick = () => { close(); arrangeAround(i); };
    sh.querySelector("[data-pmwalk-go]").onclick = () => { close(); doWalk(); };
    const noun = n => n === 1 ? pmColLabel(F, "noun") : pmColLabel(F, "nounP");
    const all = () => [...tg, ...within, ...(palT ? [palT] : [])];
    let tok = 0;
    const row = (p, on) => `<button class="pmx-tg${on ? " on" : ""}" data-tg="${p.id}" role="switch" aria-checked="${on}"><span class="pmx-tg-t"><b>${esc(p.label)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ""}</span><em data-tgn="${p.id}"></em><i class="pmx-tg-sw" aria-hidden="true"></i></button>`;
    function render() {
      const my = ++tok, f = s.f, onW = within.find(p => p.on(f)), anyOn = all().some(p => p.on(f));
      const grp = g => tg.filter(p => p.group === g).map(p => row(p, p.on(f))).join("");
      const dec = tg.find(p => p.id === "decade");
      body.innerHTML = `${grp("who")}${grp("where")}
        ${dec || within.length ? `<p class="pmx-more-h">${est ? "Around the same time" : "Same time"}</p>${dec ? row(dec, dec.on(f)) : ""}
        ${within.length ? `<div class="hm-seg pmx-within" role="radiogroup" aria-label="Within this many years">${within.map(p => `<button class="${p.on(f) ? "on" : ""}" data-tg="${p.id}" role="radio" aria-checked="${p.on(f)}">${p.label.replace("Within ", "").replace(" years", " yrs")}</button>`).join("")}</div>` : ""}` : ""}
        ${palT ? `<p class="pmx-more-h">Colors</p>${row(palT, palT.on(f))}` : ""}`;
      nEl.textContent = `${lay.n.toLocaleString()} ${noun(lay.n)}`;
      clr.hidden = !anyOn;
      const todo = all().filter(p => !within.includes(p) || p === onW);
      (function next() {
        if (dead || my !== tok || !sh.isConnected) return;
        const p = todo.shift(); if (!p) return;
        const on = p.on(s.f), n = on ? lay.n : p.id === "palette" ? null : pmPatchCount(s, F, p, i);
        const el2 = body.querySelector(`[data-tgn="${p.id}"]`);
        if (el2 && n != null) { el2.textContent = n.toLocaleString(); const b = el2.closest("button"); if (n <= 1 && !on) { b.disabled = true; b.classList.add("none"); } }
        setTimeout(next, 16);
      })();
    }
    body.addEventListener("click", e => {
      const b = e.target.closest("[data-tg]"); if (!b || b.disabled) return;
      const p = all().find(x => x.id === b.dataset.tg); if (!p) return;
      buzz(5);
      if (p.on(s.f)) p.clear(s.f);
      else { if (p.id === "decade" || p.id[0] === "w") { s.f.y0 = null; s.f.y1 = null; } p.patch(s.f); }   // a decade and a "within" window are two ways to say the same dimension
      rebuild({ focus: { i, z: Z, open: true } }); render();
    });
    clr.onclick = () => { buzz(6); all().forEach(p => { if (p.on(s.f)) p.clear(s.f); }); rebuild({ focus: { i, z: Z, open: true } }); render(); };
    render();
  }
  // the closeness panel of a color or a palette (Phase H): how close a painting must be, from exact to loose, with the number of
  // paintings it leaves updating as you drag; two plain modes once there are several colors. The map stays visible behind it.
  function openClose() {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;
    const f = s.f; if (!f.hexes.length) return;
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser pmx-close">
        <div class="hm-ch-head" data-sheet-grab><b class="pmx-more-t" data-pmcname></b><button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>
        <div class="hm-ch-scroll" data-sheet-scroll><div data-pmcbody></div></div>
      </div>`, { lock: false });
    sh.classList.add("pmx-sheet", "pmx-moresheet", "hm-sheet-panel", "hm-sheet-arrange");
    sh.setAttribute("aria-label", "How close a painting must be");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    sh.querySelector("[data-sheet-close]").onclick = () => { buzz(4); close(); };
    const body = sh.querySelector("[data-pmcbody]");
    const render = () => {
      const f2 = s.f; if (!f2.hexes.length) { close(); return; }
      const many = f2.hexes.length > 1, ov = f2.colorMode === "overall", n = lay ? lay.n : 0, noun = pmColLabel(F, n === 1 ? "noun" : "nounP");
      sh.querySelector("[data-pmcname]").innerHTML = `${f2.hexes.slice(0, 6).map(h => `<i class="pmx-xdot" style="--c:${h}"></i>`).join("")}${esc(pmActiveChips(s, F).find(c => c.dim === "color").text)}`;
      body.innerHTML = `<p class="pmx-close-n"><b data-pmcn>${n.toLocaleString()}</b> ${esc(noun)}</p>
        ${many ? `<div class="hm-seg pmx-close-mode" role="radiogroup" aria-label="How the colors are matched"><button class="${ov ? "" : "on"}" data-pmcmode="all" role="radio" aria-checked="${!ov}">Holds every color</button><button class="${ov ? "on" : ""}" data-pmcmode="overall" role="radio" aria-checked="${ov}">Same overall palette</button></div>
        <p class="pmx-close-why">${ov ? "The closest whole palettes: how much of the canvas each color covers matters." : "Each color must appear in the painting, in any amount."}</p>` : ""}
        <p class="pmx-close-word" data-pmcword>${ov ? (f2.tol <= 4 ? "Nearly the same palette" : f2.tol <= 9 ? "A close palette" : "Related palettes") : (f2.tol <= 4 ? "Almost exactly this color" : f2.tol <= 12 ? "A close match" : "Anything related")}</p>
        <label class="pmx-close-row"><span class="pmx-lab2">How close</span><span class="pmx-close-ends"><i>Exact</i><input type="range" min="1" max="${ov ? PM_PAL_MAX : 30}" step="1" value="${Math.min(f2.tol, ov ? PM_PAL_MAX : 30)}" data-pmctol aria-label="Closeness, exact to loose"><i>Loose</i></span></label>
        ${!ov && (!F.col || F.col === "paintings") ? `<button class="pmx-ebtn ghost pmx-close-list" data-pmclist>See them as a list</button>` : ""}`;
      const tol = body.querySelector("[data-pmctol]");
      const lst = body.querySelector("[data-pmclist]"); if (lst) lst.onclick = () => { buzz(5); close(); if (typeof S !== "undefined") { S.paintDoor = "list"; save(); } if (typeof paintingsOfPage === "function") paintingsOfPage(f2.hexes, { tol: Math.min(f2.tol, 12), mode: "all", push: true }); };
      tol.oninput = e => { f2.tol = +e.target.value; const w = body.querySelector("[data-pmcword]"); if (w) w.textContent = ov ? (f2.tol <= 4 ? "Nearly the same palette" : f2.tol <= 9 ? "A close palette" : "Related palettes") : (f2.tol <= 4 ? "Almost exactly this color" : f2.tol <= 12 ? "A close match" : "Anything related"); buzz(2); rebuild(); const nn = body.querySelector("[data-pmcn]"); if (nn && lay) nn.textContent = lay.n.toLocaleString(); };
      body.querySelectorAll("[data-pmcmode]").forEach(b => b.onclick = () => {
        const m = b.dataset.pmcmode; if ((f2.colorMode === "overall" ? "overall" : "all") === m) return; buzz(5);
        f2.colorMode = m; f2.tol = m === "overall" ? PM_PAL_CLOSE : 8;
        if (m === "overall" && !(f2.shares && f2.shares.length === f2.hexes.length)) f2.shares = f2.hexes.map(() => 1 / f2.hexes.length);
        rebuild(); render();
      });
    };
    render();
    // the number keeps up while the table of a new palette is still being computed
    const poll = setInterval(() => { if (!sh.isConnected) { clearInterval(poll); return; } const nn = body.querySelector("[data-pmcn]"); if (nn && lay) nn.textContent = lay.n.toLocaleString(); }, 400);
  }
  function openSheet(startTab) {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;   // a ghost click right after closing must not reopen it (js/core.js)
    let tab = startTab === "filter" ? "filter" : "arrange";
    let fopen = { co: false, painter: false, mv: false, mus: false, subj: false }, fq = "", coq = "", curPresets = PM_TIME_PRESETS;
    const tabsHTML = `<div class="hm-ch-tabs pmx-tabs" role="tablist" aria-label="Arrange or filter the painting map">
        <button class="hm-ch-tab" data-tab="arrange" role="tab">Arrange</button>
        <button class="hm-ch-tab" data-tab="filter" role="tab">Filter</button>
      </div>`;
    // David, 2026-10-09: the "switch to the color map" icon here is retired -- the top-center Colors|Paintings
    // switch (hmWireLayerSwitch, wired in pmOpen) is the one way to move between layers now, not a second one
    // tucked inside this sheet too.
    const head = `<div class="hm-ch-head" data-sheet-grab>${tabsHTML}
        <button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>`;
    // David, 2026-10-25: the map is a lens on a feed. When the page before it has one (a color or a painting), the ⋯ sheet leads with one
    // button back to it, to the same tile; Feed is never a word you tap on the way in.
    const prevTok = typeof XSTACK !== "undefined" && XSTACK.length >= 2 ? String(XSTACK[XSTACK.length - 2]) : "";
    const toFeed = /^(p:|n:|g:|z:|aw:painter:)/.test(prevTok) ? `<button type="button" class="pmx-tofeed" data-pmtofeed>${ICON.back}<span>Back to the feed</span></button>` : "";
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser" data-tab="${tab}">${head}${toFeed}
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
    const tf = q$("[data-pmtofeed]"); if (tf) tf.onclick = () => { buzz(6); close(); setTimeout(() => { if (typeof xBack === "function") xBack(); }, 60); };
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
        ${!pmSolo(s) && s.arr === "color" && (s.col || "paintings") === "paintings" ? `<button type="button" class="pmx-tofeed" data-pmshuffle><span>Shuffle to another cluster</span></button>` : ""}
        ${pmSolo(s) ? "" : `<div class="cx-sec"><b>Collection</b></div>
        <div class="hm-seg pmx-col-seg" role="radiogroup" aria-label="Collection">${PM_COLLECTIONS.map(([k, t]) => `<button class="${(s.col || "paintings") === k ? "on" : ""}" data-pmcol="${k}">${esc(t)}</button>`).join("")}</div>`}
        <div class="cx-sec"><b>Shape</b></div>
        <div class="hm-arr pmx-arr" role="radiogroup" aria-label="Arrange by">${pmArrFor(s).map(([k, t]) => `
          <button class="hm-arr-b${s.arr === k ? " on" : ""}" data-pmarr="${k}" role="radio" aria-checked="${s.arr === k}">
            <span class="hm-arr-pic">${PM_ICON[k]}</span><b>${esc(t)}</b></button>`).join("")}</div>
        <p class="hm-arr-sub">${PM_NEEDS_SEED.has(s.arr) && md ? `Around ${esc(md.t)}` : esc(PM_WHY[s.arr])}</p>
        ${s.arr === "look" ? lookSettingsHTML() : ""}
        <div class="hm-feel"><label class="hm-feel-row" data-feel="mag"><span class="hm-feel-l">Magnify</span><span class="hm-feel-r"><i>Flat</i><input type="range" min="0" max="1" step="0.01" value="${s.mag == null ? .5 : s.mag}" data-pmmag aria-label="Magnify, flat to fisheye"><i>Fisheye</i></span></label></div>
        ${s.arr === "color" || s.arr === "time" || s.arr === "tones" ? `<div class="cx-sec"><b>Place by</b></div>
          <div class="hm-seg" role="radiogroup" aria-label="Place by">${PM_PLACE.map(([k, t]) => `<button class="${(s.place || "avg") === k ? "on" : ""}" data-pmplace="${k}">${esc(t)}</button>`).join("")}</div>` : ""}
        <div class="cx-sec"><b>Center on</b></div>
        <div class="hm-seg hm-seg-n pmx-center-seg">${PM_CENTER.map(([k, t]) => {
          const found = t === "A favorite" ? pmFavList(F).length : true;
          return `<button data-pmcenterk="${k}"${found ? "" : " disabled"}>${esc(t)}</button>`;
        }).join("")}</div>
        <div class="cx-sec"><b>${pmSolo(s) ? "Watch it grow" : "When"}</b></div>
        <div class="pmx-scrub"><input type="range" min="${yrRange()[0]}" max="${yrRange()[1]}" step="${pmSolo(s) ? 1 : 5}" value="${s.upToYear == null ? yrRange()[1] : s.upToYear}" data-pmscrub aria-label="Reveal paintings up to this year"${pmSolo(s) ? ' data-solo' : ""}>
          <button class="pmx-scrub-play${scrubTimer ? " on" : ""}" data-pmscrubplay aria-label="${scrubTimer ? "Pause" : "Play"}">${scrubTimer ? PM_ICON.pause : ICON.play}</button></div>
        <p class="hm-arr-sub" data-pmscrublabel>${s.upToYear == null ? "Showing every year" : `Up to ${s.upToYear}${s.upToYear >= yrRange()[1] ? "" : " (undated paintings join at the end)"}`}</p>`;
      const shf = q$("[data-pmshuffle]"); if (shf) shf.onclick = () => { buzz(6); close(); s.rnd = 1; s.f = scopedFresh(); s.fav = 0; s.upToYear = null; if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; } rebuild({ nofocus: true }); };   // another random cluster of the whole map, at the ordinary opening distance
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
        if (id === "look" && !pmLookReady(s)) { pmLookEnsure(F, s).then(ok => { if (dead) return; if (!ok) { toast("The vibe map didn't load", { low: true }); renderArrange(); return; } s.arr = id; s.seed = -1; lookHint(); rebuild(); renderArrange(); }); return; }
        if (id === "look") lookHint();
        if (id === "subject" && !SUBJ) { loadSubjects().then(() => { if (dead) return; s.arr = id; s.seed = -1; rebuild(); renderArrange(); }).catch(() => toast("Subjects didn't load")); return; }
        if (PM_NEEDS_SEED.has(id)) { if (mid < 0) return; s.seed = mid; s.arr = id; }
        else { if (s.arr === id) return; s.arr = id; s.seed = -1; } // a stale seed from a prior Rings/Spiral shouldn't linger into Color/Time/Painter
        rebuild(); renderArrange();
      });
      qa$("[data-pmlk]").forEach(b => b.onclick = () => lookSet(b.dataset.pmlk, b.dataset.v, false, renderArrange));
      const lsp = q$("[data-pmlksp]");
      if (lsp) {
        let raf = 0;
        lsp.oninput = e => { const v = +e.target.value; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { raf = 0; lookSet("sp", v, true); }); };
        lsp.onchange = () => { try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {} };
      }
      qa$("[data-pmplace]").forEach(b => b.onclick = () => {
        const p = b.dataset.pmplace; if ((s.place || "avg") === p) return; buzz(5); s.place = p; rebuild(); renderArrange();
      });
      qa$("[data-pmcenterk]").forEach(b => b.onclick = () => {
        const fn = PM_CENTER.find(c => c[0] === b.dataset.pmcenterk)[2], found = fn(list, F);
        if (found < 0) return; buzz(6); s.seed = found; if (!PM_NEEDS_SEED.has(s.arr)) s.arr = "spiral"; rebuild(); renderArrange();
      });
      q$("[data-pmscrub]").oninput = e => {
        if (scrubTimer) { clearInterval(scrubTimer); scrubTimer = 0; }
        const v = +e.target.value, [, hi] = yrRange(); s.upToYear = v >= hi ? null : v; rebuild(); renderArrange();
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
      const chip = (attr, val, label, cnt, on, dot) => `<button class="${on ? "on" : ""}" ${attr}="${esc(String(val))}"${cnt != null && !cnt && !on ? " disabled" : ""}>${dot ? `<i class="pmx-dot" style="--c:${dot}"></i>` : ""}${esc(label)}${cnt != null ? `<em>${cnt.toLocaleString()}</em>` : ""}</button>`;
      const f = s.f;
      const topMulti = (names, countArr, selSet) => names.map((name, j) => ({ name, v: j + 1, n: countArr[j + 1] })).filter(x => x.n || selSet.has(x.v)).sort((a, b) => b.n - a.n);
      const solo = pmSolo(s), sy = solo ? pmSoloYears(f.painterSet[0], F) : null;
      const [yrLo, yrHi] = yrRange();
      const y0 = f.y0 == null ? yrLo : f.y0, y1 = f.y1 == null ? yrHi : f.y1;
      const dLo = Math.max(0, Math.floor((yrLo - XB_DEC0) / 10)), dHi = Math.min(XB_NDEC - 1, Math.floor((yrHi - XB_DEC0) / 10));
      const decadeBars = Array.from({ length: dHi - dLo + 1 }, (_, k) => C.when[dLo + k]);
      const maxDecade = Math.max(1, ...decadeBars);
      const pct = y => clamp((y - yrLo) / Math.max(1, yrHi - yrLo) * 100, 0, 100);
      curPresets = solo ? pmSoloPresets(sy) : PM_TIME_PRESETS;
      const activePreset = curPresets.find(p => p[2] === f.y0 && p[3] === f.y1);
      const cols = [...BASICS, ...ALL].filter(c => !c.basic || /^(Red|Blue|Green|Yellow|Pink|Purple|Orange|Brown)$/.test(c.n));
      const colsSorted = typeof glHueOrder === "function" ? glHueOrder(cols) : cols;
      const coSelSet = new Set(f.coSet || []), mvSelSet = new Set(f.mvSet || []), musSelSet = new Set(f.musSet || []), paSelSet = new Set(f.painterSet || []);
      const cos = topMulti(F.meta.countries, C.co, coSelSet), mvs = topMulti(F.meta.movements, C.mv, mvSelSet);
      const pas = topMulti(F.meta.artists.map(a => a[0]), C.painter, paSelSet);
      const tySelSet = new Set(f.tySet || []), tys = F.meta.types ? topMulti(F.meta.types, C.ty, tySelSet).sort((a, b) => (a.name === "Other") - (b.name === "Other") || b.n - a.n) : [];
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
      // the pieces, composed in the usual order for a map of many painters, or in the order a one-painter map wants
      const hueChips = XB_HUE_WORDS.map((w, j) => chip("data-pmhue", j, w, C.hueBand[j], f.hueBand === j, solo ? PM_HUE_DOT[j] : null)).join("");
      const lightHTML = `<div class="pmx-range2" style="--lo:${f.l0 == null ? 0 : f.l0}%;--hi:${f.l1 == null ? 100 : f.l1}%">
            <input type="range" min="0" max="100" value="${f.l0 == null ? 0 : f.l0}" data-pml0 aria-label="Darker than">
            <input type="range" min="0" max="100" value="${f.l1 == null ? 100 : f.l1}" data-pml1 aria-label="Lighter than"></div>
          <p class="pmx-cap3"><span>Dark</span><span>Light</span></p>`;
      const swHTML = `<div class="pmx-sw">${colsSorted.map(c => `<button data-pmhex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" class="${f.hexes.includes(c.h.toUpperCase()) ? "on" : ""}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
          ${f.hexes.length ? `<p class="pmx-cap2">${f.hexes.map(h => `<i style="--c:${h}"></i>`).join("")}${esc(f.hexes.length === 1 ? (f.name || nameOf(f.hexes[0]).text) : f.hexes.length + " colors")} <span>· within ${f.tol}%</span></p>
          <div class="pmx-scrub"><span class="pmx-lab2">Closeness</span><input type="range" min="1" max="30" step="1" value="${f.tol}" data-pmtol aria-label="Color closeness"></div>
          ${f.hexes.length > 1 ? `<div class="hm-seg pmx-colmode" role="radiogroup" aria-label="Match any or all colors"><button class="${(f.colorMode || "any") === "any" ? "on" : ""}" data-pmcolmode="any">Any</button><button class="${f.colorMode === "all" ? "on" : ""}" data-pmcolmode="all">All</button></div>` : ""}` : ""}`;
      const whenHTML = `${curPresets.length ? `<div class="pmx-chips">${curPresets.map(([k, t2]) => chip("data-pmpreset", k, t2, null, activePreset && activePreset[0] === k)).join("")}</div>` : ""}
          <div class="pmx-hist" aria-hidden="true">${decadeBars.map(n2 => `<i style="--h:${Math.max(.04, n2 / maxDecade)}"></i>`).join("")}</div>
          <div class="pmx-range2" style="--lo:${pct(y0)}%;--hi:${pct(y1)}%">
            <input type="range" min="${yrLo}" max="${yrHi}" step="1" value="${y0}" data-pmy0 aria-label="From year">
            <input type="range" min="${yrLo}" max="${yrHi}" step="1" value="${y1}" data-pmy1 aria-label="To year"></div>
          <p class="pmx-cap3"><span>${y0}</span><span>${y1}</span></p>`;
      const musSorted = solo ? musAll.slice().sort((p, q) => q.n - p.n) : musAll, musShow = solo && !fopen.mus ? musSorted.filter((x, k) => k < 8 || musSelSet.has(x.v)) : musSorted;
      const musMore = solo && !fopen.mus && musSorted.length > musShow.length ? `<button class="pmx-more" data-pmmore="mus">All ${musSorted.length}</button>` : "";
      // Subject: this scope's own top subjects with counts ("Portrait 22 · Landscape 9"); a detected tag counts like any other
      const sjSel = new Set(f.subjSet || []);
      const sjAll = C.subj ? SUBJ.tags.map((nm, t) => ({ t, nm, n: C.subj[t] })).filter(x => !SUBJ.hide[x.t] && (x.n || sjSel.has(x.t))).sort((p, q) => (sjSel.has(q.t) - sjSel.has(p.t)) || q.n - p.n) : [];
      const sjShow = fopen.subj ? sjAll.slice(0, 80) : sjAll.filter((x, k) => k < 10 || sjSel.has(x.t));
      const subjHTML = sjAll.length ? `<div class="pmx-row"><span class="pmx-lab">Subject</span><div class="pmx-chips">${sjShow.map(x => chip("data-pmsubj", x.t, subjCap(x.nm), x.n, sjSel.has(x.t))).join("")}${!fopen.subj && sjAll.length > sjShow.length ? `<button class="pmx-more" data-pmmore="subj">More subjects</button>` : ""}</div></div>` : "";
      const favRow = favIds.length ? `<div class="pmx-row"><span class="pmx-lab">Yours</span><div class="pmx-chips">${chip("data-pmfav", 1, "Your favorites", favN, !!s.fav)}</div></div>` : "";
      if (solo) q$("[data-pmbody]").innerHTML = `
        <div class="pmx-sh-top"><b>Filter</b><span>${n === sy.total ? n.toLocaleString() : n.toLocaleString() + " of " + sy.total.toLocaleString()} ${sy.total === 1 ? pmColLabel(F, "noun") : nounP}</span><button class="pmx-reset" data-pmreset>Reset</button></div>
        ${n ? "" : `<p class="pmx-none">Nothing matches all of that. Loosen a range, or Reset.</p>`}
        ${favRow}
        <div class="pmx-row"><span class="pmx-lab">Color family</span><div class="pmx-chips">${hueChips}</div>
          <p class="pmx-lab2">Lightness</p>${lightHTML}</div>
        ${yrHi > yrLo ? `<div class="pmx-row"><span class="pmx-lab">Years</span>${whenHTML}</div>` : ""}
        ${subjHTML}
        <div class="pmx-row"><span class="pmx-lab">A color you pick</span>${swHTML}</div>
        ${musSorted.length > 1 ? `<div class="pmx-row"><span class="pmx-lab">${esc(musLab)}</span><div class="pmx-chips">${musShow.map(x => chip("data-pmmus", x.v, x.name, x.n, musSelSet.has(x.v))).join("")}${musMore}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">Add another ${esc(painterLab.toLowerCase())}</span>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmq type="search" placeholder="Find a ${esc(painterLab.toLowerCase())}" value="${esc(fq)}" autocomplete="off"></label>
          <div class="pmx-chips">${pList.map(x => chip("data-pmp", x.v, x.name, x.n, paSelSet.has(x.v))).join("")}</div></div>`;
      else q$("[data-pmbody]").innerHTML = `
        <div class="pmx-sh-top"><b>Filter</b><span>${n === F.N - pmHidN(F) ? n.toLocaleString() : n.toLocaleString() + " of " + (F.N - pmHidN(F)).toLocaleString()} ${F.N === 1 || (n === F.N && n === 1) ? pmColLabel(F, "noun") : nounP}</span><button class="pmx-reset" data-pmreset>Reset</button></div>
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
        ${subjHTML}
        <div class="pmx-row"><span class="pmx-lab">${esc(coLab)}</span>
          ${isPaintings ? `<p class="pmx-lab2">Regions</p>
          <div class="pmx-chips">${regionRow}</div>` : ""}
          <p class="pmx-lab2">${isPaintings ? "Countries" : coLab}</p>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmcoq type="search" placeholder="Find a ${esc(coLab.toLowerCase())}" value="${esc(coq)}" autocomplete="off"></label>
          <div class="pmx-chips">${coList.map(x => chip("data-pmco", x.v, x.name, x.n, coSelSet.has(x.v))).join("")}${!coq && !fopen.co && cos.length > 10 ? `<button class="pmx-more" data-pmmore="co">All ${cos.length}</button>` : ""}</div></div>
        ${tys.length ? `<div class="pmx-row"><span class="pmx-lab">Object type</span><div class="pmx-chips">${tys.map(x => chip("data-pmty", x.v, x.name, x.n, tySelSet.has(x.v))).join("")}</div></div>` : ""}
        ${mvs.length ? `<div class="pmx-row"><span class="pmx-lab">${esc(mvLab)}</span><div class="pmx-chips">${mvs.map(x => chip("data-pmmv", x.v, x.name, x.n, mvSelSet.has(x.v))).join("")}</div></div>` : ""}
        <div class="pmx-row"><span class="pmx-lab">${esc(musLab)}</span><div class="pmx-chips">${musAll.map(x => chip("data-pmmus", x.v, x.name, x.n, musSelSet.has(x.v))).join("")}</div></div>
        <div class="pmx-row"><span class="pmx-lab">${esc(painterLab)}</span>
          <label class="search pmx-find"><span>${ICON.search}</span><input data-pmq type="search" placeholder="Find a ${esc(painterLab.toLowerCase())}" value="${esc(fq)}" autocomplete="off"></label>
          <div class="pmx-chips">${pList.map(x => chip("data-pmp", x.v, x.name, x.n, paSelSet.has(x.v))).join("")}${!fq && !fopen.painter && pas.length > 10 ? `<button class="pmx-more" data-pmmore="painter">More ${esc(nounP)}</button>` : ""}</div></div>`;
      const inp = q$("[data-pmq]");
      if (inp) inp.oninput = () => { fq = inp.value.trim(); const pos = inp.selectionStart; renderFilter(); const ni = q$("[data-pmq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
      const coInp = q$("[data-pmcoq]");
      if (coInp) coInp.oninput = () => { coq = coInp.value.trim(); const pos = coInp.selectionStart; renderFilter(); const ni = q$("[data-pmcoq]"); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
      // live range sliders: 'input' (not the delegated click below) for drag feedback, kept from crossing past
      // each other the same way a dual-handle slider always must (y0 can't pass y1, l0 can't pass l1)
      const tolInp = q$("[data-pmtol]"); if (tolInp) tolInp.oninput = e => { f.tol = +e.target.value; buzz(2); rebuild(); renderFilter(); };
      const yIn = q$("[data-pmy0]"); if (yIn) yIn.oninput = e => { f.y0 = Math.min(+e.target.value, f.y1 == null ? yrHi : f.y1); buzz(2); rebuild(); renderFilter(); };
      if (yIn) q$("[data-pmy1]").oninput = e => { f.y1 = Math.max(+e.target.value, f.y0 == null ? yrLo : f.y0); buzz(2); rebuild(); renderFilter(); };
      q$("[data-pml0]").oninput = e => { f.l0 = Math.min(+e.target.value, f.l1 == null ? 100 : f.l1); buzz(2); rebuild(); renderFilter(); };
      q$("[data-pml1]").oninput = e => { f.l1 = Math.max(+e.target.value, f.l0 == null ? 0 : f.l0); buzz(2); rebuild(); renderFilter(); };
    }
    paneFilt.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const f = s.f, d = b.dataset;
      if (d.pmreset != null) { s.f = scopedFresh(); s.fav = 0; if (pmSolo(s)) s.upToYear = null; fq = ""; coq = ""; buzz(6); rebuild(); return renderFilter(); }
      if (d.pmmore) { fopen[d.pmmore] = true; return renderFilter(); }
      if (d.pmfav != null) s.fav = s.fav ? 0 : 1;
      else if (d.pmhex) {
        const h = d.pmhex.toUpperCase(), at = f.hexes.indexOf(h);
        if (at >= 0) { f.hexes.splice(at, 1); if (f.shares) f.shares.splice(at, 1); if (!f.hexes.length) { f.name = ""; f.colorMode = "any"; f.shares = null; } }
        else { f.hexes.push(h); if (f.shares) f.shares.push(1 / Math.max(1, f.hexes.length)); if (f.hexes.length === 1) { f.name = d.name; f.tol = f.tol || 8; } }
      }
      else if (d.pmcolmode) f.colorMode = d.pmcolmode;
      else if (d.pmhue) f.hueBand = f.hueBand === +d.pmhue ? null : +d.pmhue;
      else if (d.pmpreset) { const p = curPresets.find(x => x[0] === d.pmpreset), on = f.y0 === p[2] && f.y1 === p[3]; f.y0 = on ? null : p[2]; f.y1 = on ? null : p[3]; }
      else if (d.pmregion) pmRegionToggle(f, d.pmregion, F);
      else if (d.pmco) { const v = +d.pmco, set = new Set(f.coSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.coSet = [...set]; f.region = null; }
      else if (d.pmmv) { const v = +d.pmmv, set = new Set(f.mvSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.mvSet = [...set]; }
      else if (d.pmty) { const v = +d.pmty, set = new Set(f.tySet || []); if (set.has(v)) set.delete(v); else set.add(v); f.tySet = [...set]; }
      else if (d.pmmus) { const v = +d.pmmus, set = new Set(f.musSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.musSet = [...set]; }
      else if (d.pmsubj) { const v = +d.pmsubj, set = new Set(f.subjSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.subjSet = [...set]; }
      else if (d.pmp) { const v = +d.pmp, set = new Set(f.painterSet || []); if (set.has(v)) set.delete(v); else set.add(v); f.painterSet = [...set]; }
      else return;
      buzz(5); rebuild(); renderFilter();
    });
    renderArrange(); renderFilter();
    if (!SUBJ && (s.col || "paintings") === "paintings") loadSubjects().then(() => { if (sh.isConnected) renderFilter(); }).catch(() => {});
  }
  // ---- life cycle
  const ro = new ResizeObserver(() => size()); ro.observe(cv);
  // David, 2026-10-10: "Back should take me to that exact spot instead of reloading the position" -- this used
  // to save the SNAPPED cell position (lay.x[centerK], lay.y[centerK]) on the way out, rounding away whatever
  // precise mid-pan spot P was actually sitting at the moment you tapped a painting open. Save the real P/Z.
  cleanup.push(() => { dead = true; hideTip(); clearTimeout(tapTimer); clearInterval(scrubTimer); scrubTimer = 0; ro.disconnect(); cancelAnimationFrame(raf); imgs.destroy(); t1.destroy(); clearTimeout(hideTimer); document.removeEventListener("visibilitychange", onVis); if (!released) pmAtlasRelease(F.col); if (lay) PM_PAN.set(lay.key, { x: P[0], y: P[1], s: Z, cardOpen }); });
  const firstBuild = () => { if (pmMatchReady(F, s.f)) build(false); else palWait(() => build(false)); };
  size();
  if ((s.col || "paintings") === "paintings") pmLookProbe(F);   // the tiny look.json: decides whether the Arrange sheet offers By look
  if (s.arr === "look" && !pmLookReady(s)) pmLookEnsure(F, s).then(ok => { if (dead) return; if (!ok) s.arr = "color"; firstBuild(); }); else firstBuild();
  if (s.f.subjSet && s.f.subjSet.length) { try { ROUTE_NOW = "#/" + pmRouteOf(s, F).path; history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {} }   // opened from a painting's subject tap: the address names the filter
  window.PM_CTRL = { get islLabels() { return islRects; }, get Z() { return Z; }, zFit: () => zFit(), rebuild: o => rebuild(o), get center() { return centerK >= 0 ? lay.items[centerK] : -1; }, get count() { return lay ? lay.n : 0; }, get drawn() { return drawn.length + rasterCount(); }, images: () => imgs.stats(), get spec() { return s; }, glideTo: k => glideTo([lay.x[k], lay.y[k]], 300), lay: () => lay, zoom: z => { Z = clamp(z, zMin(), ZMAX); kick(); },
    // QA: the raw pan/zoom (David, 2026-10-10, "Back should restore the exact prior view") -- _qaSetPZ lets a
    // test establish an arbitrary pan deterministically (a real drag gesture would be slow and imprecise);
    // _qaPZ reads it back the same way, for the before/after comparison across a Back round trip
    _qaPZ: () => ({ P: P.slice(), Z, cardOpen }),
    _qaBubbles: (n = 400) => { draw(clock); const out = drawn.slice(0, n).map(b => ({ key: b.k, x: b.x, y: b.y, d: b.d })); return out.length < n ? out.concat(rasterCells(n - out.length)) : out; },   // QA: where cells are drawn right now (the pinch-anchor test); the pixel zone's cells follow, thinned to fit n
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
    _qaMem: () => pmMemReport(atlas, t1),
    _qaAtlasReady: () => !!(atlas && atlas.bm0s && atlas.bm0s.length),
    // QA: the zoom-out floor for the CURRENT layout -- PM_CTRL.zoom(_qaZMin()) should show the whole thing
    // (drawn === count), confirming zMin() isn't capped below what the layout actually needs (David, 2026-10-10)
    _qaZMin: () => zMin(),
    _qaZ: () => Z,
    _qaCard: () => showCard(),   // QA: open the painting card for whatever is in the middle (a real tap needs frames the headless run may not give)
    _qaHitAt: (x, y) => { const b = hitAt(x, y); return b ? { i: b.i, k: b.k, d: b.d } : null; },   // QA: what a tap at client (x, y) would hit (tile or raster zone)
    _qaZFit: () => zFit(),   // where the whole layout just fits (the old zoom-out floor); zMin() is PM_ZOOM_OUT of it
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
    _qaTier1Stats: () => { let have = 0, want = 0; const man = atlas && atlas.man; if (man) for (const b of drawn) { want++; if (t1.cell(b.i)) have++; } return { want, have }; } };
}

// this file can load after router.js (on first use): give pmOpen its address now
if (typeof routeWrapAll === "function") routeWrapAll();

// One search finds the paintings layer too (design/SIMPLIFY/PLAN.md §3.7/§9, Lane 2: "register map features in
// search... each arrangement and order"). js/search.js loads before this file (index.html), so this is safe at
// module load -- no runtime guard needed, just the typeof check in case that ever changes.
if (typeof featureRegister === "function") {
  featureRegister("paintings-floor", { t: "Paintings", where: "Map · ⋯ · Colors | Paintings", words: "paintings map archive gallery by color",
    run: () => { if (typeof S !== "undefined") { S.hm = S.hm || {}; S.hm.mode = "paintings"; } pmGo("arr=color"); } });
  PM_ARR.filter(a => a[2] !== "solo").forEach(([id, title]) => featureRegister("pm-arr-" + id, { t: `Paintings: ${title}`, where: "Paintings · ⋯ · Arrange",
    words: "paintings arrange arrangement shape " + title.toLowerCase(), run: () => { if (typeof S !== "undefined") { S.hm = S.hm || {}; S.hm.mode = "paintings"; } pmGo("arr=" + id); } }));
}
