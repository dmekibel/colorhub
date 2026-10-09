"use strict";
// The honeycomb as the home screen (ROADMAP.md §12). hmHome() is what the Today tab now shows: the full-screen
// honeycomb (js/honey.js, via the same pieces as the color explorer in js/colorsets.js), a one-line title control
// that is also the progress view switch, and a bottom sheet that holds everything the old flat Today screen had.
// Reused, not rebuilt: colorExplorer's screen chrome (the .cx CSS, css/honey.css), COLOR_SETS/filterColors/csBase
// (js/colorsets.js — extended with three progress-based sets), honeycomb() itself, searchColors, peek(), colorSheet,
// openNode(colorNode(c)) + the existing morph (core.js), and the Today tiles' own data (dueList, nextUnit,
// dailyColor, challengeRounds, todayTrain). New here: the quick-view swipe, the search pulldown-as-button, the
// three-state bottom sheet, and the camera/dice touches.
//
// Decision (David's "pick the simplest consistent option" in the brief): the Today TAB shows this honeycomb
// (go("learn") -> hmHome()); js/learn.js's home() is still the classic flat Today screen, reachable as the
// sheet's "Learn" door and from every deep "Home" button after a deck, review, daily or challenge (unchanged,
// so that change stays small). The one consistent way back to the honeycomb from Train / Explore / Studio is
// the brand button at the top-left of their own headers (tabHead, js/core.js) — the thing already there.

const HM_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>`;
// the right corner's one button: four quiet dots (a menu), the due count beside it when reviews wait
const HM_DO_GLYPH = icon("grid", 22);
const HM_SLIDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>`;
// The nine stages of the path (ROADMAP §14): stage N shows the first N names of the core list (data/core-names.json,
// ordered by `rank` until the stage ordering exists), so you can preview what any stage holds.
const HM_STAGES = [25, 50, 100, 150, 250, 400, 600, 800, 1000];
// The order is useRank (data/core-names.json: usefulness for learning; the path's own first words keep their
// place), so every stage is exactly its round number, stage 3 included (X19: no list has special status).
const hmUseRank = e => e.useRank != null ? e.useRank : e.rank != null ? e.rank : 1e9;
function hmStageItems(n) {
  return (CORE_NAMES || []).slice().sort((a, b) => hmUseRank(a) - hmUseRank(b)).slice(0, n)
    .map(e => ({ n: e.n, h: e.h, c: BYNAME.get(e.n.toLowerCase()) || null, rank: hmUseRank(e) }));
}
// Two stops after Stage 9 (NOTES-TRACKER.md item 0): "Every name" (core + library, every primary and library
// name with no repeats) and "Every shade" (+ the computed shades, js/naming.js loadShades()). Browse views, not
// lessons — same honeycomb, no stage ordering. "Every shade" stays out of the chooser while data/shades.json is
// still empty (David, 2026-10-09: paused pending a library import of more real names).
const hmCoreNameSet = () => new Set((CORE_NAMES || []).map(e => e.n.toLowerCase()));
function hmCoreItems() {
  return (CORE_NAMES || []).map(e => ({ n: e.n, h: e.h, c: BYNAME.get(e.n.toLowerCase()) || null, rank: hmUseRank(e) }));
}
function hmEveryNameItems() {
  const set = hmCoreNameSet();
  // library-only entries (never folded into a core primary): csItems() already shapes these as {n,h,c:null,lib}
  const libOnly = csItems().filter(x => !x.c && !set.has(x.n.toLowerCase())).map(x => ({ ...x, rank: 1e6 + (x.rank || 0) }));   // after every core name (the spiral's order)
  return hmCoreItems().concat(libOnly);
}
function hmShadeItems() {
  return (SHADES || []).map(e => ({ n: e.n, h: e.h, c: null, shade: { base: e.base, mod: e.mod } }));
}
function hmEveryShadeItems() { return hmEveryNameItems().concat(hmShadeItems()); }
// What the honeycomb shows = a SOURCE (a stage, every name, or one collection) x a FAMILY x a TONE x what you KNOW
// (all / learned / learning / new), all combinable, each with its count (design/HOME-VIEWS.md §4). Where the colors go
// is the ARRANGEMENT (S.hm.arr, js/honey.js HONEY_ARR); how they look is the LOOK (S.hm.style) and the FEEL sliders.
const HM_FILTERS = [["all", "All"], ["learned", "Learned"], ["learning", "Learning"], ["new", "New"]];
const HM_EVERY = ["every-name", "every-shade"];   // the two stops after Stage 9, not a stage and not a COLOR_SETS id
const hmSet = id => COLOR_SETS.find(s => s.id === id) || null;
// a bubble past the first units has no app color, but can still have a card (js/learnmore.js cardIdFor)
const hmCard = it => { const id = it.c && it.c.id ? it.c.id : typeof cardIdFor === "function" && !it.shade ? cardIdFor(it) : null; return id ? S.cards[id] || null : null; };
const HM_KEEP = { all: () => true, learned: it => isMine(hmCard(it)), learning: it => !!hmCard(it) && !isMine(hmCard(it)), new: it => !hmCard(it) };
// the Looks Home offers (the lens and the cell shape; where colors go is the arrangement now)
// (David, 2026-10-08: magnification applies to either, so the Magnifier is no longer a Look: it's the Magnify slider
// turned up, and an old "Magnifier" save becomes Bubbles with a strong Magnify)
const HM_LOOKS = [["original", "Bubbles"], ["honeycomb", "Honeycomb"]];
// ---- the Arrange sheet's pictures (David, 2026-10-08: "the previews need to be simple icon versions"): one flat,
// iconic diagram per arrangement, same 64 px grid, same dot size, a fixed calm palette (never the live colors, which
// read as noise at this size). Short one-line labels; the full title and its line show under the strip. ----------
const HM_ARR_SHORT = { map: "Map", rings: "Rings", sunflower: "Spiral", families: "Families", temp: "Warm–cool" };
const hmHue = (h, l = 60, c = 62) => `hsl(${Math.round(h)} ${c}% ${l}%)`;
function hmArrIcon(id) {
  const dot = (x, y, r, f, extra = "") => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${f}"${extra}/>`;
  const ring = (n, R, r, fill, a0 = -90) => Array.from({ length: n }, (_, i) => { const a = (a0 + i * 360 / n) * Math.PI / 180; return dot(32 + R * Math.cos(a), 32 + R * Math.sin(a), r, fill(i)); }).join("");
  const G = "hsl(40 6% 62%)";
  let b = "";
  if (id === "map") {   // hue across, light to dark down
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) b += `<rect x="${7 + c * 10.4}" y="${11 + r * 10.4}" width="8.4" height="8.4" rx="2.6" fill="${hmHue(c * 62, 78 - r * 15, 58)}"/>`;
  } else if (id === "wheel") {   // a ring of hues, muted inside, grey at the heart
    b = ring(12, 22, 4.2, i => hmHue(i * 30)) + ring(6, 11.5, 3.6, i => hmHue(i * 60, 62, 26)) + dot(32, 32, 3.6, G);
  } else if (id === "light") {   // white in the middle, black at the rim
    b = dot(32, 32, 4.6, "hsl(40 30% 96%)") + ring(6, 11.5, 3.9, i => hmHue(i * 60, 80, 45)) + ring(12, 22, 4.2, i => hmHue(i * 30, 30, 55));
  } else if (id === "families") {   // a region per family, greys in the middle
    const fam = [[0, 14, 14], [45, 42, 12], [120, 46, 40], [210, 16, 42], [290, 30, 52]];
    fam.forEach(([h, x, y]) => { b += dot(x, y, 4.2, hmHue(h, 56)) + dot(x + 7.6, y + 1, 3.2, hmHue(h, 72)) + dot(x + 2.6, y + 7.4, 3.2, hmHue(h, 40)); });
    b += dot(30, 31, 3.4, G) + dot(35.5, 28, 2.6, "hsl(40 6% 78%)");
  } else if (id === "pages") {   // a small page per family
    [[0, 8, 8], [45, 34, 8], [150, 8, 34], [225, 34, 34]].forEach(([h, x, y]) => {
      b += `<rect x="${x}" y="${y}" width="22" height="22" rx="4" fill="rgba(236,232,223,.07)"/>`;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) b += `<rect x="${x + 3 + c * 8.5}" y="${y + 3 + r * 8.5}" width="7" height="7" rx="2" fill="${hmHue(h, 72 - r * 26, 30 + c * 36)}"/>`;
    });
  } else if (id === "temp") {   // warm left, cool right, greys down the middle
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = 12 + c * 10, y = 17 + r * 10;
      b += dot(x, y, 3.8, c === 2 ? `hsl(40 5% ${76 - r * 12}%)` : c < 2 ? hmHue(4 + c * 24 + r * 6, 72 - r * 9) : hmHue(170 + (c - 3) * 44 + r * 6, 72 - r * 9));
    }
  } else if (id === "path" || id === "rings") {   // rings from the middle out, hue going round
    b = `<circle cx="32" cy="32" r="11.5" fill="none" stroke="rgba(236,232,223,.18)" stroke-width="1"/><circle cx="32" cy="32" r="22" fill="none" stroke="rgba(236,232,223,.18)" stroke-width="1"/>`
      + dot(32, 32, 4.4, hmHue(24, 64)) + ring(6, 11.5, 3.4, i => hmHue(30 + i * 60, 62)) + ring(12, 22, 3.4, i => hmHue(i * 30 + 15, 60));
  } else if (id === "known") {   // learned in the middle, then learning, then new
    b = dot(32, 32, 5, "#9AD4AE") + ring(6, 12, 3.6, () => "rgba(236,232,223,.9)")
      + Array.from({ length: 12 }, (_, i) => { const a = (-90 + i * 30) * Math.PI / 180; return dot(32 + 22.5 * Math.cos(a), 32 + 22.5 * Math.sin(a), 3.2, "none", ` stroke="rgba(236,232,223,.5)" stroke-width="1.3"`); }).join("");
  } else if (id === "sunflower") {   // a golden-angle spiral by hue
    for (let i = 1; i <= 40; i++) { const a = i * 137.508 * Math.PI / 180, R = 3.75 * Math.sqrt(i); b += dot(32 + R * Math.cos(a), 32 + R * Math.sin(a), (2.5 + i / 40 * 1.1).toFixed(2), hmHue(i * 9, 62)); }
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${b}</svg>`;
}
// the Look icons in the same style: bubbles of mixed size, seven hexes, a grid swelling in the middle
function hmLookIcon(id) {
  const d = (x, y, r, h) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hmHue(h, 60)}"/>`;
  let b = "";
  if (id === "original") b = d(13, 16, 6, 10) + d(28, 12, 5, 45) + d(24, 28, 8, 140) + d(10, 31, 4.5, 290) + d(35, 30, 4.5, 210);
  else if (id === "honeycomb") {
    const hex = (cx, cy, h) => `<path d="${Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + 30) * Math.PI / 180; return (i ? "L" : "M") + (cx + 6.2 * Math.cos(a)).toFixed(1) + " " + (cy + 6.2 * Math.sin(a)).toFixed(1); }).join("")}Z" fill="${hmHue(h, 58)}"/>`;
    b = hex(22, 22, 40) + [0, 60, 120, 180, 240, 300].map((a, i) => hex(22 + 11.4 * Math.cos(a * Math.PI / 180), 22 + 11.4 * Math.sin(a * Math.PI / 180), i * 60 + 10)).join("");
  } else {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = 6 + c * 8, y = 6 + r * 8, dd = Math.hypot(c - 2, r - 2); b += d(x, y, Math.max(1.4, 4.3 - dd * 1.15).toFixed(1), c * 50 + r * 18); }
  }
  return `<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">${b}</svg>`;
}
// the three friendly sliders (0..1). Defaults tuned at 440x956: a clear fisheye (the middle ~4x the edge), thin seams.
const HM_FEEL0 = { mag: .62, space: .15, size: .5 };
// the old one-set-per-view saves: a family or character collection becomes a filter over every name
const HM_OLD_TONE = { pastels: "light", vivid: "vivid", muted: "muted", darks: "dark" };
function hmView() {   // the saved view, upgrading older saves in place (unknown keys kept)
  const h = S.hm, old = h.set;
  if (!h.src) {
    h.src = /^stage:\d+$/.test(old || "") ? old : old && hmSet(old) && !["101", "learned", "learning", "notmet"].includes(old) ? old : "stage:100";
    h.filter = { learned: "learned", learning: "learning", notmet: "new" }[old] || "all";
  }
  if (h.src === "all") h.src = "every-name";   // the old "Every name" collection is the stage chip now: one entry, one count
  const st = hmSet(h.src);
  if (st && st.group === "Families") { h.fam = st.title; h.src = "every-name"; }
  else if (h.src === "neutrals") { h.fam = "Greys"; h.src = "every-name"; }
  else if (HM_OLD_TONE[h.src]) { h.tone = HM_OLD_TONE[h.src]; h.src = "every-name"; }
  if (!/^stage:\d+$/.test(h.src) && !HM_EVERY.includes(h.src) && !hmSet(h.src)) h.src = "stage:100";
  h.filter = HM_KEEP[h.filter] ? h.filter : "all";
  h.fam = CS_FAMS.includes(h.fam) ? h.fam : "";
  h.tone = CS_TONES.some(t => t[0] === h.tone) ? h.tone : "";
  // the learning spiral and the sunflower were Looks; they're arrangements now
  if (!HONEY_ARR[h.arr] && !HONEY_ARR_OLD[h.arr]) h.arr = h.style === "spiral" ? "path" : h.style === "sunflower" ? "sunflower" : "map";
  // shape x order: the old arrangements that were really one shape in one order (Color wheel = Rings centered on
  // greys, Path rings = Rings centered on everyday words, Hue pages = Families sorted by vividness...)
  h.ord = h.ord && typeof h.ord === "object" ? h.ord : {};
  if (HONEY_ARR_OLD[h.arr]) { const [id, ord] = HONEY_ARR_OLD[h.arr]; h.arr = id; h.ord[id] = ord; }
  for (const id of Object.keys(h.ord)) if (!honeyOrdersOf(id).includes(h.ord[id])) delete h.ord[id];
  if (h.style === "magnifier") { h.style = "original"; h.feel = { ...(h.feel || HM_FEEL0), mag: Math.max(.92, +((h.feel || {}).mag) || 0) }; }
  if (!HM_LOOKS.some(l => l[0] === h.style)) h.style = "original";
  delete h.famNames;   // the zoomed-out family names are gone (David, 2026-10-08: "they don't add anything")
  const f = h.feel || {}; h.feel = { mag: clamp(+(f.mag ?? HM_FEEL0.mag), 0, 1), space: clamp(+(f.space ?? HM_FEEL0.space), 0, 1), size: clamp(+(f.size ?? HM_FEEL0.size), 0, 1) };
  return h;
}
// a source's own name ("Stage 3", "Every name", "Earth tones")
function hmSrcLabel(src) {
  const n = /^stage:/.test(src) ? +src.slice(6) : 0;
  return n ? `Stage ${HM_STAGES.indexOf(n) + 1}` : src === "every-name" ? "Every name" : src === "every-shade" ? "Every shade" : (hmSet(src) || {}).title || "";
}
const hmToneWord = t => (CS_TONES.find(x => x[0] === t) || [])[1] || "";
// "Vivid pinks · Every name · Learning": the family and tone lead, then the source, then what you know
function hmViewLabel() {
  const v = hmView(), fam = v.fam ? (v.tone ? `${hmToneWord(v.tone)} ${v.fam.toLowerCase()}` : v.fam) : v.tone ? hmToneWord(v.tone) : "";
  const parts = [fam, hmSrcLabel(v.src)].filter(Boolean);
  if (v.filter !== "all") parts.push(HM_FILTERS.find(x => x[0] === v.filter)[1]);
  return parts.join(" · ");
}
// the filters on top of a source's items (any of them can be overridden, for the chips' counts)
function hmFiltered(base, o = {}) {
  const v = hmView(), fam = "fam" in o ? o.fam : v.fam, tone = "tone" in o ? o.tone : v.tone, filter = "filter" in o ? o.filter : v.filter, keep = HM_KEEP[filter] || HM_KEEP.all;
  return base.filter(it => (!fam || csFamilyHas(it, fam)) && (!tone || csTone(it, tone)) && keep(it));
}
// the feel sliders as lens settings over the Look's own preset. Magnify: the middle-to-edge size ratio (flat at 0,
// the preset's own ratio at .5, and past .75 on up to the old Magnifier's strong lens, about 9x with a tighter
// falloff, for either Look); Bubble size: both ends together; Spacing: the seam (0 to 8 px).
function hmFeelTweak(style, feel) {
  const p = { ...HONEY_CFG_BASE, ...((HONEY_STYLES[style] || HONEY_STYLES.original).cfg) }, f = feel || HM_FEEL0;
  const pr = Math.max(1.2, p.m0 / p.m1), sz = .72 + f.size * .56, m1 = p.m1 * sz;
  const hi = Math.max(0, (f.mag - .75) / .25), ratio = 1 + (pr - 1) * Math.pow(f.mag / .5, 1.25) + hi * hi * Math.max(0, 9.3 - (1 + (pr - 1) * 2.38));
  const out = { m1, m0: Math.max(m1 + .05, m1 * ratio), gap: f.space * .4 };
  out.sig = p.sig + (1.2 - p.sig) * hi;
  return out;
}
// the order a shape is in (your choice for that shape, else its default), and the color "Around a color" circles
const hmOrd = (arr, v = hmView()) => { const o = v.ord && v.ord[arr]; return honeyOrdersOf(arr).includes(o) ? o : (HONEY_ARR[arr] || {}).def || ""; };
function hmNear(v = hmView()) {
  const n = v.near;
  if (n && /^#[0-9a-f]{6}$/i.test(n.h || "")) return n;
  const d = typeof dailyColor === "function" ? dailyColor() : null;   // until you pick one: today's color
  return d ? { h: d.h, n: d.n } : { h: "#808080", n: "Grey" };
}
// the layout a shape in an order asks for: "rings~vivid", "rings~near~#2A9D8F"; the Hue map in hue order keeps its
// Look's own map shape (the approved one, endless edges and all)
function hmLayoutKey(arr, style, ord) {
  if (!HONEY_ARR[arr]) arr = "map";
  ord = ord || hmOrd(arr);
  if (arr === "map" && ord === "hue") return ((HONEY_STYLES[style] || {}).cfg || {}).layout || "mapTall";
  if (!HONEY_ARR[arr].kind) return arr;
  if (ord === "today" && typeof dailyColor === "function") return `${arr}~today~${dailyColor().h.toUpperCase()}`;
  return ord === "near" ? `${arr}~near~${hmNear().h.toUpperCase()}` : `${arr}~${ord}`;
}
// the shape and its order in a few words: "Rings · Vivid", "Map" (the default Hue map), "Families · Vividness"
function hmArrLabel(v = hmView()) {
  const a = HONEY_ARR[v.arr] || HONEY_ARR.map, ord = hmOrd(v.arr, v), sp = honeyOrderSpec(v.arr, ord);
  if (!sp) return a.title;
  return `${a.title} · ${ord === "near" ? "Around " + hmNear(v).n : sp.t}`;
}
// what position means right now, in words -- the Arrange sheet's one descriptive line under the shape/order chips
// (David, 2026-10-09: "I don't like the colder/warmer labels" -- the map used to float this same wording as edge
// captions over the honeycomb itself, via hmAxes(); that's gone, this sentence-form description in the sheet stays)
function hmMeaning(v = hmView()) {
  const a = HONEY_ARR[v.arr] || HONEY_ARR.map, ord = hmOrd(v.arr, v), spec = honeyOrderSpec(v.arr, ord);
  if (a.kind === "radial") {
    const mid = ord === "near" ? hmNear(v).n : ord === "today" && typeof dailyColor === "function" ? `today's color, ${dailyColor().n}` : spec.mid;
    return { line: `Middle: ${mid}. Edge: ${spec.edge}.` };
  }
  if (a.kind === "grid") {
    if (v.arr === "map" && ord === "hue") return { line: a.sub + "." };
    const line = spec.line.charAt(0).toUpperCase() + spec.line.slice(1);
    return { line: v.arr === "families" ? `Inside each family: ${spec.line}.` : line + "." };
  }
  return { line: a.sub + "." };
}
// regions (Families, Hue pages) read as a whole book, so the lens is gentler there: a strong fisheye shrank the outer
// regions to specks. Your Magnify still moves it, from a calmer start.
const hmLiveTweak = v => { const a = HONEY_ARR[v.arr], feel = a && a.fit ? { ...v.feel, mag: v.feel.mag * .45 } : v.feel; return { ...hmFeelTweak(v.style, feel), layout: hmLayoutKey(v.arr, v.style, hmOrd(v.arr, v)) }; };

// ---------- selection mode's own arrangement choice (David, 2026-10-09: "I don't like when the selected colors
// are scattered... pick the appropriate view so they're minimally scattered"). Among a handful of candidate
// arrangements, hmBestArrangeFor lays the WHOLE current item set out each way (honeyLayout, the same builder the
// live map uses) and keeps whichever one packs the SELECTED colors into the smallest bounding box -- a cheap,
// honest proxy for "minimally scattered" that needs no canvas. The radial shapes are centered on the selection's
// own average color (hmAvgHex), which usually wins outright for anything that was already one family or palette.
function hmAvgHex(hexes) {
  const labs = hexes.map(h => lab(h));
  const L = labs.reduce((s, v) => s + v[0], 0) / labs.length, a = labs.reduce((s, v) => s + v[1], 0) / labs.length, b = labs.reduce((s, v) => s + v[2], 0) / labs.length;
  return labHex(L, a, b);
}
const HM_SEL_CANDIDATES = [
  ["map", "hue", "arranged by hue so they sit together"],
  ["map", "light", "arranged by lightness so they sit together"],
  ["map", "chroma", "arranged by vividness so they sit together"],
  ["families", "hue", "grouped by family so they sit together"],
  ["rings", "near", "centered on their own average color"],
  ["sunflower", "near", "centered on their own average color"],
];
function hmBestArrangeFor(items, hexes) {
  if (!hexes || hexes.length < 2 || !items || !items.length) return null;
  // a selection's own hexes (a painting's measured palette, say) rarely land exactly on a named bubble's hex, so
  // match each one to its NEAREST point in Lab, the same way honey.js hlItems() finds the lit bubbles themselves
  const labs = hexes.map(h => lab(h));
  let near = null;
  try { near = hmAvgHex(hexes); } catch (e) {}
  let best = null;
  for (const [arr, ord, why] of HM_SEL_CANDIDATES) {
    if (!HONEY_ARR[arr] || (ord === "near" && !near)) continue;
    const key = ord === "near" ? `${arr}~near~${near.toUpperCase()}` : `${arr}~${ord}`;
    let lay; try { lay = honeyLayout(items, key); } catch (e) { continue; }
    if (!lay.pts.length) continue;
    const seen = new Set(), matched = [];
    for (const L of labs) {
      let bp = null, bd = Infinity;
      for (const p of lay.pts) { const it = p.it, dd = (it.lab[0] - L[0]) ** 2 + (it.lab[1] - L[1]) ** 2 + (it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; bp = p; } }
      if (bp && !seen.has(bp)) { seen.add(bp); matched.push(bp); }
    }
    if (matched.length < Math.min(2, hexes.length)) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of matched) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const area = Math.max(.02, maxX - minX) * Math.max(.02, maxY - minY);
    if (!best || area < best.area) best = { arr, ord, why, area, near: ord === "near" ? { h: near, n: "" } : null };
  }
  return best;
}

// ---------- the Tweak panel: live sliders over whatever preset is active, saved in S.hm.tweak ----------
// A compact, opaque, non-modal sheet (~45dvh): the honeycomb above it keeps running and repainting as the
// sliders move, so the effect of each one is immediate. Shared by the home's View panel ("Tweak…" row) and the
// #/lab/honey screen, since both just hold a honeycomb() controller.
const HM_TWEAK_SPECS = [
  { key: "m0", label: "Center size", min: 1.2, max: 6, step: .05 },
  { key: "m1", label: "Outer size", min: .15, max: 2.5, step: .05 },
  { key: "sig", label: "Falloff", min: .4, max: 4, step: .05 },
  { key: "fill", label: "Fill", min: 0, max: 1, step: .02 },
  { key: "gap", label: "Gap", min: 0, max: .45, step: .01 },
  { key: "shape", label: "Shape", min: 0, max: 1, step: .02 },
  { key: "zMinUser", label: "Zoom-out limit", min: .04, max: .8, step: .01 },
  { key: "vig", label: "Vignette", min: 0, max: 1, step: .05 },
  { key: "labelMin", label: "Label size threshold", min: 14, max: 60, step: 1 },
  { key: "drift", label: "Drift", min: 0, max: 2, step: .1 },
];
// Tweaks are kept per style (S.hm.tweaks[styleId]): switching style switches to that style's own tweaks.
function hmTweakFor(styleId) { const t = S.hm && S.hm.tweaks; return (t && t[styleId]) || null; }
function hmSetTweak(styleId, patch) { S.hm.tweaks = S.hm.tweaks || {}; S.hm.tweaks[styleId] = patch ? { ...(S.hm.tweaks[styleId] || {}), ...patch } : null; save(); }
function hmOpenTweak(ctrl, opts = {}) {
  if (document.querySelector(".hm-tweak-panel")) return;
  buzz(4);
  const cur = ctrl.getCfg(), tw = cur.tweak || {}, resolved = cur.resolved;
  const val = k => tw[k] != null ? tw[k] : resolved[k];
  const panel = document.createElement("div");
  panel.className = "hm-tweak-panel";
  panel.innerHTML = `<div class="hm-tweak-grab"></div>
    <div class="hm-tweak-head"><b>Tweak</b><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button></div>
    <div class="hm-tweak-scroll">
      <div class="hm-seg hm-tweak-lens" data-key="lensMode">${[["round", "Round"], ["edges", "Edges"], ["none", "None"]].map(([m, l]) => `<button class="${resolved.lensMode === m ? "on" : ""}" data-val="${m}">${l}</button>`).join("")}</div>
      ${HM_TWEAK_SPECS.map(s => `<label class="hm-tweak-row" data-key="${s.key}"><span>${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${val(s.key)}"><b>${(+val(s.key)).toFixed(2)}</b></label>`).join("")}
    </div>
    <div class="hm-tweak-foot"><button class="link" data-reset>Reset to preset</button><button class="cx-pill" data-copy>Copy settings</button></div>`;
  document.body.appendChild(panel);
  // recenters the honeycomb above this panel too (David: see the effect while choosing); on close, restores
  // whatever inset the caller had going (the lab's own permanent bar), or 0 if none was given
  requestAnimationFrame(() => { panel.classList.add("on"); requestAnimationFrame(() => { const r = panel.getBoundingClientRect(); ctrl.setInset({ bottom: Math.max(0, innerHeight - r.top) }); }); });
  const close = () => {
    panel.classList.remove("on"); if (opts.restoreInset) opts.restoreInset(); else ctrl.setInset({ bottom: 0 });
    setTimeout(() => panel.remove(), reduceMotion ? 0 : 260);
  };
  panel.querySelector("[data-close]").onclick = close;
  panel.querySelectorAll(".hm-tweak-row").forEach(row => {
    const k = row.dataset.key, input = row.querySelector("input"), out = row.querySelector("b");
    input.addEventListener("input", () => {
      const v = +input.value; out.textContent = v.toFixed(2);
      hmSetTweak(ctrl.getStyle(), { [k]: v });
      ctrl.tweak({ [k]: v });
    });
  });
  panel.querySelector(".hm-tweak-lens").querySelectorAll("button").forEach(b => b.onclick = () => {
    panel.querySelectorAll(".hm-tweak-lens button").forEach(x => x.classList.toggle("on", x === b));
    hmSetTweak(ctrl.getStyle(), { lensMode: b.dataset.val });
    ctrl.tweak({ lensMode: b.dataset.val });
  });
  panel.querySelector("[data-reset]").onclick = () => {
    hmSetTweak(ctrl.getStyle(), null); ctrl.resetTweak(); buzz(4); close();
  };
  panel.querySelector("[data-copy]").onclick = () => {
    const c = ctrl.getCfg(), text = JSON.stringify({ style: c.style, tweak: c.tweak || {} });
    try { navigator.clipboard.writeText(text); toast("Copied settings"); } catch (e) { toast("Couldn't copy"); }
  };
  return { close };
}

// ---------- the honeycomb lab (#/lab/honey): one preset and one size at a time, so David can rate each on his
// phone. Ratings (a heart + 1-5) save in S.hmLab, keyed "style|size". "Copy my ratings" puts a compact JSON
// summary on the clipboard to paste back to us. The Tweak panel (above) opens here too, over the same honeycomb. ----------
const HM_LAB_SIZES = [25, 50, 100, 150, 250, 400, 600, 1000, 2700];
async function labItems(n) {
  if (n <= 1000) { if (!CORE_NAMES) await loadCoreNames(); return hmStageItems(n); }
  if (!LONG_NAMES) await loadLongNames();
  return csItems().slice().sort((a, b) => a.rank - b.rank).slice(0, n).map(e => ({ n: e.n, h: e.h, c: e.c || null, lib: e.lib || null }));
}
function labHoney() {
  S.hmLab = S.hmLab || {}; S.hm = S.hm || {};
  let pi = (window.HM_LAB_LAST_P || 0) % HONEY_STYLE_LIST.length, si = HM_LAB_SIZES.indexOf(window.HM_LAB_LAST_N || 100); if (si < 0) si = 2;
  const el = show(`<div class="hm-lab"><div class="hm-lab-view"></div>
    <button class="icon-btn glass hm-lab-back" data-back aria-label="Back">${ICON.back}</button>
    <div class="hm-lab-bar">
      <div class="hm-lab-row"><button class="hm-lab-step" data-p-1>${ICON.chev}</button><b data-p-label></b><button class="hm-lab-step" data-p1>${ICON.chev}</button></div>
      <div class="hm-lab-row"><button class="hm-lab-step" data-n-1>${ICON.chev}</button><b data-n-label></b><button class="hm-lab-step" data-n1>${ICON.chev}</button></div>
      <div class="hm-lab-row hm-lab-rate">
        <button class="hm-lab-heart" data-heart aria-label="Favorite">${ICON.heartOn}</button>
        <span class="hm-lab-stars" data-stars>${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">${ICON.starOn}</button>`).join("")}</span>
      </div>
      <div class="hm-lab-row"><button class="link" data-tweak>Tweak…</button><button class="cx-pill" data-copy>Copy my ratings</button></div>
    </div>
  </div>`, "fixed hm-lab-screen");
  const viewEl = el.querySelector(".hm-lab-view");
  let ctrl = null, loading = false;
  const keyOf = () => `${HONEY_STYLE_LIST[pi].id}|${HM_LAB_SIZES[si]}`;
  function paintBar() {
    el.querySelector("[data-p-label]").textContent = HONEY_STYLE_LIST[pi].title;
    el.querySelector("[data-n-label]").textContent = HM_LAB_SIZES[si].toLocaleString();
    const r = S.hmLab[keyOf()] || {};
    el.querySelector("[data-heart]").classList.toggle("on", !!r.heart);
    el.querySelectorAll("[data-star]").forEach(b => b.classList.toggle("on", +b.dataset.star <= (r.rating || 0)));
  }
  // the rating bar is permanently on screen here, so the honeycomb stays recentered above it the whole time
  const applyLabInset = () => { if (!ctrl) return; const r = el.querySelector(".hm-lab-bar").getBoundingClientRect(); ctrl.setInset({ bottom: Math.max(0, innerHeight - r.top) }); };
  async function build(soft) {
    loading = true;
    window.HM_LAB_LAST_P = pi; window.HM_LAB_LAST_N = HM_LAB_SIZES[si];
    const items = await labItems(HM_LAB_SIZES[si]);
    if (!el.isConnected) return;
    loading = false;
    const id = HONEY_STYLE_LIST[pi].id;
    if (ctrl) { ctrl.destroy(); viewEl.innerHTML = ""; }
    ctrl = honeycomb(viewEl, { items, style: id, tweak: hmTweakFor(id), centerFirst: true });
    applyLabInset();
    paintBar();
  }
  el.querySelector("[data-back]").onclick = () => { if (ctrl) ctrl.destroy(); hmHome(); };
  el.querySelector("[data-p-1]").onclick = () => { pi = (pi - 1 + HONEY_STYLE_LIST.length) % HONEY_STYLE_LIST.length; buzz(4); build(); };
  el.querySelector("[data-p1]").onclick = () => { pi = (pi + 1) % HONEY_STYLE_LIST.length; buzz(4); build(); };
  el.querySelector("[data-n-1]").onclick = () => { si = Math.max(0, si - 1); buzz(4); build(); };
  el.querySelector("[data-n1]").onclick = () => { si = Math.min(HM_LAB_SIZES.length - 1, si + 1); buzz(4); build(); };
  el.querySelector("[data-heart]").onclick = () => {
    const k = keyOf(); S.hmLab[k] = { ...(S.hmLab[k] || {}), heart: !(S.hmLab[k] || {}).heart }; save(); buzz(6); paintBar();
  };
  el.querySelectorAll("[data-star]").forEach(b => b.onclick = () => {
    const k = keyOf(), n = +b.dataset.star; S.hmLab[k] = { ...(S.hmLab[k] || {}), rating: (S.hmLab[k] || {}).rating === n ? 0 : n }; save(); buzz(4); paintBar();
  });
  el.querySelector("[data-tweak]").onclick = () => { if (ctrl) hmOpenTweak(ctrl, { restoreInset: applyLabInset }); };
  el.querySelector("[data-copy]").onclick = () => {
    const out = Object.entries(S.hmLab).filter(([, v]) => v && (v.heart || v.rating)).map(([k, v]) => { const [style, size] = k.split("|"); return { style, size: +size, heart: !!v.heart, rating: v.rating || 0 }; });
    const text = JSON.stringify(out);
    try { navigator.clipboard.writeText(text); toast("Copied " + out.length + " rating" + (out.length === 1 ? "" : "s")); } catch (e) { toast("Couldn't copy"); }
  };
  build();
}

function hmHome() {
  if (!S.placed) return welcome();
  S.hm = S.hm || {};
  hmView();
  // leaving a color's page: its color takes over now, the map is built a frame later underneath it, and the color
  // shrinks back into its bubble once the map is drawn (js/mapxfer.js)
  const back = typeof mxLeave === "function" ? mxLeave(hmHome) : null;
  if (back && !back.building) return;
  // The floor of the app (DESIGN-SYSTEM.md §2), not a tab: its own address, and S.tab is left alone so it keeps
  // pointing at whichever Room was last open (the Rooms corner's quick-resume, and every "go(S.tab)" fallback).
  ROUTE_NEXT = routed(NAV_MAP, "home"); ROUTE_REPLACE = true;

  const el = show(`
    <div class="cx-stage hm-stage"><div class="cx-view"></div></div>
    <header class="cx-top hm-top">
      <button class="cx-title glass-box hm-title" aria-haspopup="dialog" aria-label="Which colors you see"><b><span></span>${CX_ICON.down}</b><small></small></button>
    </header>
    <div class="hm-search" id="hmSearch" hidden>
      <label class="search"><span>${ICON.search}</span><input id="hmq" type="search" placeholder="a color, a hex, a painter, a decade…" autocomplete="off" enterkeyhint="go"></label>
      <button class="hm-l18-hint" id="hmqHint" hidden></button>
    </div>
    <button class="corner l" data-rooms-corner aria-label="Rooms">${ROOMS_GLYPH}</button>
    <button class="corner r hm-do" id="hmDo" data-do-corner aria-label="Menu" aria-haspopup="menu" aria-expanded="false"></button>
  `, "fixed cx hm");
  const $ = s => el.querySelector(s), viewEl = $(".cx-view"), title = $(".hm-title");
  loadLongNames();
  // the placement result's one-line hint ("Tap any color to open it", js/learn.js lrMapHint/S.mapHint): shown
  // once right after placement, but if the app closed before that first touch, S.mapHint is still pending, so
  // the next time Home opens shows it again. hmDismissHint is every other real interaction's way to clear it
  // (a bubble opened, a drag, the corner menu) -- belt and suspenders beside lrMapHint's own pointerdown listener.
  if (typeof lrMapHint === "function") lrMapHint();
  function hmDismissHint() {
    if (!S.mapHint) return;
    delete S.mapHint; save();
    const tip = $(".lr-maphint"); if (!tip) return;
    tip.classList.add("out"); later(() => tip.remove(), typeof reduceMotion !== "undefined" && reduceMotion ? 0 : 320);
  }

  // ---------- the honeycomb itself ----------
  let items = [], ctrl = null, gen = 0;
  const onPeek = o => { if (o.c) peek(o.c); else if (typeof colorSheet === "function") colorSheet(o, c => hmOpenColor(c)); };
  // a tap opens the real page straight away (ROADMAP §13: every name has one now) — one of the 101, or its
  // own name page (js/names.js); a long press still shows the quick peek sheet above. The page itself grows
  // from the tapped bubble (David, 2026-10-07: "any color in home, you should be able to click it to make it
  // full screen"; 2026-10-08: "it should fully expand until it transitions into the color page"): mxGrow
  // (js/mapxfer.js) grows the bubble's exact outline into the page's cover. Back shrinks it home (hmHome below).
  const pick = (o, fx) => {
    if (typeof MX !== "undefined" && MX && MX.dir === "in") return;   // a bubble is already becoming its page: one tap, one page
    hmDismissHint();
    const open = () => (o.c ? hmOpenColor(o.c) : hmOpenName(o));
    // the bubble becomes its page (js/mapxfer.js): it grows from its exact shape into the cover, sync or async page alike
    const geo = fx && fx.geo && typeof mxGrow === "function" ? fx.geo() : null;
    if (geo) return mxGrow(geo, open);
    const src = fx && fx.srcEl && fx.srcEl();
    // (no geometry: the older grow from a stand-in element; a library name opens async, so it gets the flying chip)
    // finally: the stand-in bubble goes even if opening the page throws (it used to stay, stuck over the map)
    try {
      if (src && o.c && typeof growFrom === "function") growFrom(src, open);
      else { if (fx && fx.morph) fx.morph(); open(); }
    } finally { if (src) src.remove(); }
  };
  let hlAll = false, selPrevArr = null;   // selPrevArr: the arrangement a selection (HONEY_HL) displaced, restored when it clears
  if (typeof HONEY_LIVE !== "undefined") HONEY_LIVE.add(() => { if (!el.isConnected) return false; if (hlAll && !HONEY_HL) { hlAll = false; render(true); } return true; });
  let baseItems = [];   // the source's colors before the family / tone / knowledge filters (the chips count from these)
  function paintTitle(loading) {
    title.querySelector("span").textContent = hlAll ? "Every name" : hmViewLabel();
    title.querySelector("small").textContent = loading ? "Loading…" : `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"}`;
  }
  async function render(soft, ro = {}) {
    HONEY_ENDLESS = !!S.hm.endless;
    const g = ++gen, v = hmView(), stage = /^stage:/.test(v.src) ? +v.src.slice(6) : 0, every = HM_EVERY.includes(v.src), set = !stage && !every ? hmSet(v.src) : null;
    if (stage) { if (!CORE_NAMES) { paintTitle(true); await loadCoreNames(); if (!el.isConnected || g !== gen) return; } items = hmStageItems(stage); }
    else if (every) {
      const needShades = v.src === "every-shade";
      if (!CORE_NAMES || !LONG_NAMES || (needShades && !SHADES)) {
        paintTitle(true);
        await Promise.all([loadCoreNames(), loadLongNames(), needShades ? loadShades() : Promise.resolve()]);
        if (!el.isConnected || g !== gen) return;
      }
      items = needShades ? hmEveryShadeItems() : hmEveryNameItems();
    } else {
      if (csNeedsLib(set.state) && !LONG_NAMES) { paintTitle(true); await loadLongNames(); if (!el.isConnected || g !== gen) return; }
      items = set.get();
    }
    // L18 H4: a fresh constellation (a painting, a painter, a decade...) lights up among every name, so each of its
    // colors finds its own bubble instead of all collapsing onto the few a small stage holds. Not saved; clearing the
    // constellation (its bar's ✕) brings your own view back. It stays among every name while it's lit, so coming
    // back from Learn these, Find them or a color page finds the same constellation, not one collapsed onto a stage.
    if (typeof HONEY_HL !== "undefined" && HONEY_HL && (HONEY_HL.fresh || HONEY_HL.every) && !every) {
      if (!LONG_NAMES || !CORE_NAMES) { await Promise.all([loadCoreNames(), loadLongNames()]); if (!el.isConnected || g !== gen) return; }
      items = hmEveryNameItems(); hlAll = true; HONEY_HL.every = true;
      // David: "pick the appropriate view for the list of colors so they're minimally scattered." Chosen once per
      // distinct selection (HONEY_HL.rev), not on every reframe (Learn these/Find them set .fresh again on the way
      // back) -- the arrangement a selection displaces is remembered in selPrevArr and restored the moment it clears.
      if (HONEY_HL.arrRev !== HONEY_HL.rev) {
        HONEY_HL.arrRev = HONEY_HL.rev;
        if (!selPrevArr) selPrevArr = { arr: S.hm.arr, ord: { ...(S.hm.ord || {}) }, near: S.hm.near };
        const picked = typeof hmBestArrangeFor === "function" ? hmBestArrangeFor(items, HONEY_HL.hexes) : null;
        if (picked) {
          S.hm.arr = picked.arr; S.hm.ord = { ...(S.hm.ord || {}), [picked.arr]: picked.ord };
          if (picked.near) S.hm.near = picked.near;
          HONEY_HL.why = picked.why;
        }
      }
    } else if (!(typeof HONEY_HL !== "undefined" && HONEY_HL)) {
      hlAll = false;
      if (selPrevArr) { S.hm.arr = selPrevArr.arr; S.hm.ord = selPrevArr.ord; if (selPrevArr.near) S.hm.near = selPrevArr.near; selPrevArr = null; }
    }
    baseItems = items;
    if (!hlAll) {
      let out = hmFiltered(items);
      // never an empty map: loosen the narrowest filter first (tone, then what you know, then family) and say so
      if (!out.length && items.length) {
        const was = hmViewLabel();
        for (const k of ["tone", "filter", "fam"]) { if (!v[k] || v[k] === "all") continue; S.hm[k] = k === "filter" ? "all" : ""; out = hmFiltered(items); if (out.length) break; }
        save(); toast(`Nothing here for ${was}. Showing ${hmViewLabel()}`);
      }
      items = out.length ? out : items;
    }
    // an order that reads the painting counts (Painted) waits for them the first time (a small file)
    { const vv = hmView(), sp = honeyOrderSpec(vv.arr, hmOrd(vv.arr, vv)); if (sp && sp.needs === "painted" && !HONEY_PAINTED) { await honeyLoadPainted().catch(() => {}); if (!el.isConnected || g !== gen) return; } }
    paintTitle();
    if (typeof paintDo === "function") paintDo();
    const tw = hmLiveTweak(hmView());
    if (ctrl) ctrl.update({ items, soft, arrange: !!ro.arrange, tweak: tw, style: hmView().style });
    else ctrl = honeycomb(viewEl, { items, style: v.style, tweak: tw, zoom: S.hm.zoom || 1, pick, onPeek, centerFirst: true,
      onZoom: z => { S.hm.zoom = Math.round(z * 100) / 100; save(); } });
    window.HM_CTRL = ctrl;   // the map, for js/polish.js flyToMap()
    hmWireChrome();
    // David: "if I change something about the map, the bottom corner buttons disappear, and I can't get them back."
    // Every chooser setting (stage, family, tone, filter, a collection, Arrange's shape/order/Look/feel/edges) ends
    // in a render(): cornersBack() used to run only from a sheet/menu CLOSE or a pan's finger-lift, so a stray
    // chrome-hide (or a faded inline style from a transition in flight when the setting changed) could survive a
    // render and never get undone until something else happened to close a sheet. A sheet still open afterward
    // still visually covers the corners as before — this only clears a stuck fade, never the sheet's own layout.
    cornersBack();
    if (typeof fvHomeReady === "function") fvHomeReady(el, ctrl);   // js/favs.js: open straight into pick mode when asked
  }
  function applyView(k, val) { S.hm[k] = val; save(); buzz(4); }

  // ---------- two focused sheets (design/HOME-VIEWS.md §5), each opened straight from the right corner's menu, no tabs:
  //  Colors  (which colors: how many, family, tone, your words, collections; every chip counted)
  //  Arrange (where they go: a strip of live pictures; then how they look: the Look, three friendly sliders, the edges)
  // The map stays visible above either one, recentered live (ctrl.setInset), and is never dimmed: it's the thing you're
  // adjusting. Leaving is always one move: ✕, a tap on the map, a swipe down on the header or grab bar, Escape, or Back
  // (js/core.js sheet() and its popstate). chooser("show") opens Colors; chooser("look") opens Arrange. ----------
  const HM_FEEL_SPECS = [["mag", "Magnify", "Flat", "Fisheye"], ["space", "Spacing", "Tight", "Airy"], ["size", "Bubble size", "Small", "Large"]];
  const HM_COLLECTIONS = ["yours", "earth", ...CS_SRC.map(([k]) => "src-" + k)];
  // David, 2026-10-09: "maybe Colors and Arrange should be combined into one menu with a tab on top." One sheet,
  // one entry on the Do menu; both panes are built and wired up front (not re-rendered on switch) and a
  // segmented control swaps which one shows, remembering the last tab (S.hm.chooserTab). Non-modal (the scrim
  // stays pointer-events:none) and the map staying recentered above the sheet apply in both tabs; the Arrange
  // tab's own full fit-mode (zoom out to the whole layout) only makes sense there, so it engages and disengages
  // with the tab itself, not just the sheet's own open/close.
  async function chooser(which) {
    if (document.querySelector(".hm-chooser")) return;
    let tab = which === "look" || which === "arrange" ? "arrange" : which === "show" || which === "colors" ? "colors" : (S.hm.chooserTab === "arrange" ? "arrange" : "colors");
    buzz(4);
    if (!LONG_NAMES || !CORE_NAMES || !SHADES) { await Promise.all([loadLongNames(), loadCoreNames(), loadShades()]); if (!el.isConnected || document.querySelector(".sheet")) return; }
    const v = hmView(), everyNameCount = hmEveryNameItems().length, shadeCount = (SHADES || []).length;
    const tabsHTML = `<div class="hm-ch-tabs" role="tablist" aria-label="Colors or Arrange">
        <button class="hm-ch-tab" data-tab="colors" role="tab">Colors</button>
        <button class="hm-ch-tab" data-tab="arrange" role="tab">Arrange</button>
      </div>`;
    const head = acts => `<div class="hm-ch-head" data-sheet-grab>
        ${tabsHTML}
        <span class="hm-chooser-acts" data-colors-acts>${acts}</span>
        <span class="hm-chooser-acts" data-arrange-acts hidden></span>
        <button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button>
      </div>
      <p class="hm-count" data-count></p>`;
    let body, arrangePane, colorsPane;
    {
      arrangePane = `<div class="hm-ch-scroll" data-pane="arrange" data-sheet-scroll>
        <div class="hm-arr" role="radiogroup" aria-label="Arrange by">${HONEY_ARR_IDS.map(id => `<button class="hm-arr-b${v.arr === id ? " on" : ""}" data-arr="${id}" role="radio" aria-checked="${v.arr === id}" aria-label="${esc(HONEY_ARR[id].title)}: ${esc(HONEY_ARR[id].sub)}"><span class="hm-arr-pic">${hmArrIcon(id)}</span><b>${esc(HM_ARR_SHORT[id] || HONEY_ARR[id].title)}</b></button>`).join("")}</div>
        <div class="hm-ladder hm-ord" data-ord-row role="radiogroup"></div>
        <p class="hm-arr-sub" data-arr-sub></p>
        <div class="cx-sec"><b>Look</b></div>
        <div class="hm-look-row" role="radiogroup" aria-label="Look">${HM_LOOKS.map(([id, t]) => `<button class="hm-look-chip${v.style === id ? " on" : ""}" data-style="${id}" role="radio" aria-checked="${v.style === id}"><i class="hm-look-ic">${hmLookIcon(id)}</i><b>${esc(t)}</b></button>`).join("")}</div>
        <div class="hm-feel">${HM_FEEL_SPECS.map(([k, label, lo, hi]) => `<label class="hm-feel-row" data-feel="${k}"><span class="hm-feel-l">${label}</span><span class="hm-feel-r"><i>${lo}</i><input type="range" min="0" max="1" step="0.01" value="${v.feel[k]}" aria-label="${label}"><i>${hi}</i></span></label>`).join("")}
          <button class="hm-feel-reset" data-feel-reset>Reset the feel</button></div>
        <div class="cx-sec"><b>Edges</b></div>
        <div class="hm-seg hm-l18-fam" aria-label="Map edges">${[["", "One map"], ["1", "Endless"]].map(([k, l]) => `<button class="${!!S.hm.endless === !!k ? "on" : ""}" data-endless="${k}">${l}</button>`).join("")}</div>
      </div>`;
      const rung = (src, big, small) => `<button class="hm-rung${v.src === src ? " on" : ""}" data-src="${src}"><b>${big}</b><small>${small}</small></button>`;
      const coll = HM_COLLECTIONS.map(hmSet).filter(Boolean);
      const dotsFor = s => filterColors(csBase(s.state.base), { ...s.state, n: 5 });
      const famBtn = f => `<button class="hm-fam${v.fam === f ? " on" : ""}" data-famv="${f}"><span class="hm-fam-dots" data-dots></span><b>${f || "All"}</b><em data-n></em></button>`;
      const segN = (key, opts) => `<div class="hm-seg hm-seg-n" data-key="${key}">${opts.map(([id, label]) => `<button class="${(v[key] || "") === id ? "on" : ""}" data-val="${id}"><span>${esc(label)}</span><em data-n></em></button>`).join("")}</div>`;
      colorsPane = `<div class="hm-ch-scroll" data-pane="colors" data-sheet-scroll>
        <div class="cx-sec"><b>How many</b></div>
        <div class="hm-ladder">${HM_STAGES.map((n, i) => rung("stage:" + n, n.toLocaleString(), "Stage " + (i + 1))).join("")}${rung("every-name", everyNameCount.toLocaleString(), "Every name")}${shadeCount ? rung("every-shade", (everyNameCount + shadeCount).toLocaleString(), "Every shade") : ""}</div>
        <div class="cx-sec"><b>Family</b></div>
        <div class="hm-fams">${["", ...CS_FAMS].map(famBtn).join("")}</div>
        <div class="cx-sec"><b>Tone</b></div>
        ${segN("tone", [["", "Any"], ...CS_TONES.map(t => [t[0], t[1]])])}
        <div class="cx-sec"><b>Your words</b></div>
        ${segN("filter", HM_FILTERS)}
        <button class="hm-clear" data-clear hidden>Clear filters</button>
        <div class="cx-sec"><b>Collections</b></div>
        <div class="cx-chips">${coll.map(s => `<button class="cx-chip${v.src === s.id ? " on" : ""}" data-src="${s.id}">${cxDots(dotsFor(s))}<b>${esc(s.title)}</b></button>`).join("")}</div>
      </div>`;
      const colorsActs = `<button class="iconq" data-search aria-label="Search">${ICON.search}</button>
          ${typeof NMR_ICON !== "undefined" ? `<button class="iconq" data-namer aria-label="Name any color">${NMR_ICON}</button>` : ""}
          <button class="iconq" data-surprise aria-label="Surprise me">${ICON.dice}</button>
          ${typeof ssOpen === "function" ? `<button class="iconq" data-slideshow aria-label="Slideshow">${ICON.play}</button>` : ""}`;
      body = `${head(colorsActs)}${colorsPane}${arrangePane}`;
    }
    const { sh, close } = sheet(`<div class="cx-sh hm-chooser" data-which="colors-arrange" data-tab="${tab}">${body}</div>`);
    sh.classList.add("cx-sheet", "hm-sheet-panel", "hm-sheet-colors-arrange", tab === "arrange" ? "hm-sheet-arrange" : "hm-sheet-colors");
    // David, 2026-10-09 (both tasks together): "tapping the top half instantly closes Arrange... I need to pan
    // and zoom the map while choosing" + "combine Colors and Arrange into one menu with a tab." Non-modal in
    // both tabs now (the scrim is pointer-events:none throughout, not just while Arrange happens to be active),
    // so the map above stays fully interactive whichever tab is open.
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    const q = s2 => sh.querySelector(s2), qa = s2 => [...sh.querySelectorAll(s2)];
    const paneC = q('[data-pane="colors"]'), paneA = q('[data-pane="arrange"]');
    const syncTab = () => {
      paneC.hidden = tab !== "colors"; paneA.hidden = tab !== "arrange";
      q("[data-colors-acts]").hidden = tab !== "colors"; q("[data-arrange-acts]").hidden = tab !== "arrange";
      qa(".hm-ch-tab").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      sh.dataset.tab = tab;
      sh.classList.toggle("hm-sheet-arrange", tab === "arrange"); sh.classList.toggle("hm-sheet-colors", tab === "colors");
    };
    syncTab();
    qa(".hm-ch-tab").forEach(b => b.onclick = () => {
      if (b.dataset.tab === tab) return;
      buzz(4); tab = b.dataset.tab; S.hm.chooserTab = tab; save(); syncTab(); paintCount();
      if (ctrl) { if (tab === "arrange") ctrl.enterFit(); else ctrl.exitFit(); }
      applyInset();
    });
    // David, 2026-10-09: "the middle of the screen is covered by the sheet... zoomed in you can barely see the
    // difference between views." For Arrange, once the inset has finished easing in (~300ms, honey.js's own
    // insetCur tween), ctrl.enterFit() flies the map to show the whole thing centered above the sheet, and every
    // setting change re-fits (js/honey.js update()) so the change reads at a glance; exitFit() below flies back
    // to the pan/zoom you had, on any way the sheet closes.
    const measureInset = () => { if (ctrl && sh.isConnected) { const r = sh.getBoundingClientRect(); ctrl.setInset({ bottom: Math.max(0, viewEl.getBoundingClientRect().bottom - r.top) }); } };   // measured to the map's own bottom (it reaches past innerHeight on an iPhone Home Screen app)
    // David, 2026-10-09: "the FIRST fit on opening the sheet is wrong... the refit after a Look change is
    // right." The sheet's own entrance is a CSS animation (css/polish.css .sheet{animation:sheetIn var(--grow)
    // ...}), and --grow is 420ms (app.css) -- a full 120ms longer than the flat 300ms this used to wait before
    // its first real measurement, so the open path was fitting against a still-mid-slide-up rect every time.
    // Wait for the sheet's own animationend (whatever its real duration turns out to be, reduced motion
    // included, where it's instant) instead of guessing a number, with the old 300ms only as a backstop if the
    // event never arrives for some reason.
    // Both the real animationend and the backstop timer are allowed to fire (not a one-shot guard): whichever
    // one actually lands AFTER the sheet has truly finished moving is the one whose measurement sticks, so an
    // environment where the backstop's timer can race ahead of the animation itself (a virtual/sped-up clock
    // that doesn't drive CSS animations in step with its own timers -- true of this project's own smoke harness)
    // still self-corrects once the real event arrives, instead of being stuck with whichever fired first.
    let settled = false;
    const onSettled = () => { if (!sh.isConnected) return; settled = true; measureInset(); if (tab === "arrange" && ctrl) ctrl.enterFit(); };
    sh.addEventListener("animationend", onSettled, { once: true });
    setTimeout(onSettled, reduceMotion ? 0 : 500);   // backstop: never wait forever if the event doesn't fire
    const applyInset = () => requestAnimationFrame(() => {
      if (!ctrl) return;
      measureInset();   // an immediate (possibly still-mid-entrance) read, so the map starts recentering right away
      // a LATER applyInset (the sheet's own height changing after it's already settled: a chip wrapping, a tab
      // switch) re-fits at once -- the settle-wait above is only for the very first, still-animating open.
      if (settled && tab === "arrange" && ctrl) ctrl.enterFit();
    });
    // David: "when I open Arrange it doesn't zoom out enough and doesn't center everything in the top half" --
    // re-measure (and for Arrange, re-fit) whenever the sheet's own height changes, not just once at open: a
    // chip wrapping to a second line, a family list growing, the keyboard, all change where its top really is.
    const ro = new ResizeObserver(applyInset); ro.observe(sh);
    const mo = new MutationObserver(() => { if (!sh.isConnected) { ro.disconnect(); if (ctrl) { if (tab === "arrange") ctrl.exitFit(); ctrl.setInset({ bottom: 0 }); } mo.disconnect(); } });
    mo.observe(document.body, { childList: true });
    qa("[data-sheet-close]").forEach(b => b.onclick = () => { buzz(4); close(); });
    // David: "tapping the top half instantly closes Arrange... I need to pan and zoom the map while choosing
    // arrangements... close it by double-tapping the map, the ✕, or swiping the sheet down." The scrim above the
    // sheet is pointer-events:none (css/home.css .hm-scrim-clear) in both tabs, so every tap/pan/pinch reaches
    // the canvas normally; a double-tap specifically closes the sheet instead of the canvas's own double-tap-to-
    // zoom (captured here, ahead of honey.js's own canvas listeners, and stopped from reaching them). Non-modal
    // in both tabs now, not just Arrange, per the same combined-sheet request.
    let lastTapT = 0;
    const dblClose = e => {
      if (e.pointerType && e.pointerType !== "touch" && e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - lastTapT < 350) { e.stopPropagation(); buzz(6); close(); lastTapT = 0; return; }
      lastTapT = now;
    };
    viewEl.addEventListener("pointerup", dblClose, true);
    cleanup.push(() => viewEl.removeEventListener("pointerup", dblClose, true));
    const fmt = n => n.toLocaleString();
    function paintCount() {
      const p = q("[data-count]"); if (!p || !p.isConnected) return;
      p.textContent = tab === "arrange" ? `${fmt(items.length)} color${items.length === 1 ? "" : "s"} · ${hmArrLabel()}`
        : `${fmt(items.length)} color${items.length === 1 ? "" : "s"}${hlAll ? "" : " · " + hmViewLabel()}`;
    }
    paintCount();

    {
      // ---- Arrange by: flat iconic pictures (hmArrIcon), drawn once with the sheet ----
      // ---- the order inside the shape: Center on (radial shapes) or Sort by (grids), one row of small chips ----
      const ordRow = q("[data-ord-row]");
      const paintOrd = () => {
        const vv = hmView(), a = HONEY_ARR[vv.arr], ids = honeyOrdersOf(vv.arr), cur = hmOrd(vv.arr, vv);
        ordRow.hidden = !ids.length;
        if (!ids.length) { ordRow.innerHTML = ""; return; }
        ordRow.setAttribute("aria-label", a.kind === "radial" ? "Center on" : "Sort by");
        const dot = h => `<i class="hm-ord-dot" style="background:${esc(h)}"></i>`;
        ordRow.innerHTML = `<span class="hm-ord-l">${a.kind === "radial" ? "Center on" : "Sort by"}</span>` + ids.map(id => {
          const sp = honeyOrderSpec(vv.arr, id), on = id === cur;
          const t = id === "near" ? (on ? `Around ${hmNear(vv).n}` : "Around this color") : sp.t;
          const sw = id === "near" && on ? dot(hmNear(vv).h) : id === "today" && typeof dailyColor === "function" ? dot(dailyColor().h) : "";
          return `<button class="hm-rung${on ? " on" : ""}" data-ord="${id}" role="radio" aria-checked="${on}">${sw}<b>${esc(t)}</b></button>`;
        }).join("");
        qa("[data-ord]").forEach(b => b.onclick = () => pickOrd(b.dataset.ord, b));
        const onB = ordRow.querySelector(".on"); if (onB) onB.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      const pickOrd = async (id, b) => {
        const vv = hmView(), arr = vv.arr;
        if (id === "near") {   // the color in the middle of the map right now is the new middle
          const c = ctrl && ctrl.current(), it = c && (c.o || c);
          if (!it || !it.h) return;
          if (hmOrd(arr, vv) === "near" && vv.near && vv.near.h === it.h) return;
          S.hm.near = { h: it.h, n: it.n };
        } else if (hmOrd(arr, vv) === id) return;
        const spec = honeyOrderSpec(arr, id);
        if (spec && spec.needs === "painted") { b.classList.add("on"); try { await honeyLoadPainted(); } catch (e) { b.classList.remove("on"); toast("Couldn't load the painting counts. Try again in a moment."); return; } if (!sh.isConnected) return; }
        S.hm.ord = { ...(S.hm.ord || {}), [arr]: id }; save(); buzz(4);
        paintOrd(); paintArr();
        if (ctrl) ctrl.update({ items, soft: true, arrange: true, recenter: true, tweak: hmLiveTweak(hmView()) });
        if (typeof vbFix === "function") setTimeout(vbFix, 450);   // David: the black bar after choosing a new arrangement/order (see the [data-arr] handler's own comment)
      };
      const paintArr = () => {
        const a = hmView().arr;
        qa("[data-arr]").forEach(b => { const on = b.dataset.arr === a; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
        q("[data-arr-sub]").innerHTML = `<b>${esc(HONEY_ARR[a].title)}</b> · ${esc(hmMeaning().line)}`;
        paintCount();
      };
      qa("[data-arr]").forEach(b => b.onclick = async () => {
        if (hmView().arr === b.dataset.arr) return;
        applyView("arr", b.dataset.arr); paintArr(); paintOrd();
        b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        const spec = honeyOrderSpec(b.dataset.arr, hmOrd(b.dataset.arr));
        if (spec && spec.needs === "painted") await honeyLoadPainted().catch(() => {});
        if (ctrl) ctrl.update({ items, soft: true, arrange: true, tweak: hmLiveTweak(hmView()) });
        // David: "if I open Arrange and choose a new arrangement, the black bar at the bottom comes back" (an
        // iPhone Home Screen app, --vb/--app-full, js/core.js vbFix). Whatever resize path causes it, re-running
        // vbFix() once the arrangement's own fly/zoom settles is the same self-healing the corner watchdog does.
        if (typeof vbFix === "function") setTimeout(vbFix, 450);
      });
      paintOrd();
      { const cur = q(".hm-arr-b.on"); if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" }); }
      paintArr();
      // ---- Look: the lens and the cells, then the feel ----
      qa(".hm-look-chip").forEach(b => b.onclick = () => {
        applyView("style", b.dataset.style); qa(".hm-look-chip").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
        if (ctrl) ctrl.update({ items, soft: true, style: b.dataset.style, tweak: hmLiveTweak(hmView()) });
      });
      let saveT = 0;
      const feelNow = () => { const t = hmLiveTweak(hmView()); delete t.layout; return t; };
      qa("[data-feel]").forEach(row => {
        const k = row.dataset.feel, input = row.querySelector("input");
        input.style.setProperty("--p", input.value);   // the filled part of the track (css/home.css)
        input.addEventListener("input", () => {
          input.style.setProperty("--p", input.value);
          S.hm.feel = { ...S.hm.feel, [k]: +input.value };
          if (ctrl) ctrl.tweak(feelNow());
          clearTimeout(saveT); saveT = setTimeout(save, 250);
        });
        input.addEventListener("change", () => buzz(3));
      });
      q("[data-feel-reset]").onclick = () => {
        S.hm.feel = { ...HM_FEEL0 }; save(); buzz(6);
        qa("[data-feel]").forEach(row => { const inp = row.querySelector("input"); inp.value = HM_FEEL0[row.dataset.feel]; inp.style.setProperty("--p", inp.value); });
        if (ctrl) ctrl.tweak(feelNow());
      };
      qa("[data-endless]").forEach(b => b.onclick = () => {
        applyView("endless", !!b.dataset.endless); qa("[data-endless]").forEach(x => x.classList.toggle("on", x === b)); render(true);
      });
    }
    {
      // ---- Colors: every change applies at once, and every chip says how many it would show ----
      const refresh = () => {
        if (!sh.isConnected) return;
        const vv = hmView();
        paintCount();
        qa("[data-src]").forEach(b => b.classList.toggle("on", b.dataset.src === vv.src));
        // families: count and three real samples (lightest, middle, darkest), so you see the family's whole range
        qa("[data-famv]").forEach(b => {
          const f = b.dataset.famv, list = hmFiltered(baseItems, { fam: f }), n = list.length;
          b.querySelector("[data-n]").textContent = fmt(n);
          b.classList.toggle("on", vv.fam === f); b.classList.toggle("off", !n && vv.fam !== f);
          const byL = list.map(it => [it, lch(it.h)[0]]).sort((x, y) => y[1] - x[1]), pick = byL.length ? [byL[0], byL[byL.length >> 1], byL[byL.length - 1]] : [];
          b.querySelector("[data-dots]").innerHTML = [...new Set(pick.map(x => x[0].h))].map(h => `<i style="background:${esc(h)}"></i>`).join("");
        });
        ["tone", "filter"].forEach(key => qa(`.hm-seg[data-key="${key}"] button`).forEach(b => {
          const val = b.dataset.val, n = hmFiltered(baseItems, { [key]: val }).length, on = (vv[key] || "") === val;
          b.querySelector("[data-n]").textContent = fmt(n);
          b.classList.toggle("on", on); b.classList.toggle("off", !n && !on);
        }));
        q("[data-clear]").hidden = !(vv.fam || vv.tone || vv.filter !== "all");
      };
      const after = () => render(true).then(refresh);
      qa("[data-src]").forEach(b => b.onclick = () => {
        applyView("src", b.dataset.src);
        if (typeof HONEY_HL !== "undefined" && HONEY_HL) honeyHighlight(null);   // the view you chose becomes the map's subject
        after();
      });
      qa("[data-famv]").forEach(b => b.onclick = () => { applyView("fam", b.dataset.famv); after(); });
      qa(".hm-seg-n").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => { applyView(g.dataset.key, b.dataset.val); after(); }));
      q("[data-clear]").onclick = () => { S.hm.fam = ""; S.hm.tone = ""; S.hm.filter = "all"; save(); buzz(6); after(); };
      refresh();
      q("[data-search]").onclick = () => { close(); openSearch(); };
      q("[data-surprise]").onclick = () => { close(); hmDice(); };
      const nmBtn = q("[data-namer]"); if (nmBtn) nmBtn.onclick = () => { close(); XSTACK = []; X_ROOT = "home"; LAB.namer(); };   // Name any color (js/namer.js)
      const ssBtn = q("[data-slideshow]"); if (ssBtn) ssBtn.onclick = () => { close(); if (typeof ssOpen === "function") ssOpen(); };   // js/slideshow.js
    }
    applyInset();
  }
  // ---------- search: a tap (from the View panel's header) reveals the field; typing filters the honeycomb ----------
  const searchBox = $("#hmSearch"), searchInput = $("#hmq"), searchHint = $("#hmqHint");
  function openSearch() { searchBox.hidden = false; hmShowChrome(true); searchInput.focus(); }
  searchInput.addEventListener("blur", () => { if (!searchInput.value.trim()) { searchBox.hidden = true; l18Pending = null; searchHint.hidden = true; if (l18Filtered) { l18Filtered = false; render(true); } } });
  // ---- L18 B3: search 2.0. Typing still filters; Return travels: a color (a name, a hex, "dusty pink", "between
  // teal and navy") flies the map there, a decade or a painter lights up as a constellation (csOnMap). ----
  let l18Pending = null, l18Filtered = false, l18Seq = 0;
  const l18ShowHint = r => { l18Pending = r; searchHint.hidden = !r; if (r) searchHint.innerHTML = r.hint; };
  searchInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); l18Go(); } });
  function l18Go() {
    const r = l18Pending; if (!r || !ctrl) return;
    buzz(6); searchInput.blur(); searchBox.hidden = true; searchInput.value = ""; searchHint.hidden = true; l18Pending = null;
    // David, 2026-10-09: a subject (a painter, a decade, a movement, a look) opens js/subjectview.js's palette
    // view -- a count slider up to its real distinct colors, measures, filters, arrangements -- instead of lighting
    // a fixed handful straight on the map; r.set stays as the fallback if that script hasn't loaded.
    if (r.subject) return typeof svOpen === "function" ? svOpen(r.subject) : (r.set && csOnMap(r.set));
    if (r.set) return csOnMap(r.set);
    const fly = () => { const o = ctrl.flyToColor(r.h); if (o) toast(r.say(o)); };
    if (l18Filtered) { l18Filtered = false; ctrl.update({ items, focus: { h: r.h }, soft: true }); const o = ctrl.current(); if (o) toast(r.say(o)); }
    else fly();
  }
  searchHint.addEventListener("click", l18Go);
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim(), seq = ++l18Seq;
    l18ShowHint(null);
    if (!q) { l18Filtered = false; return render(true); }
    l18Resolve(q).then(r => { if (seq === l18Seq && el.isConnected && r) l18ShowHint(r); });
    // every core name, every library name (an alternate/library hit opens its color's page, "also called" shown
    // there — js/names.js namePage) and every shade (dormant while data/shades.json is empty)
    Promise.all([loadLongNames(), loadCoreNames(), loadShades()]).then(() => {
      if (!el.isConnected) return;
      const hits = searchColors((SHADES || []).length ? hmEveryShadeItems() : hmEveryNameItems(), q);
      if (seq !== l18Seq || /^#?[0-9a-f]{3,6}$|^rgb|^between /i.test(q)) return;   // a hex or a road filters nothing; Return flies
      l18Filtered = !!hits.length;
      if (ctrl) ctrl.update({ items: hits.length ? hits : items, soft: true });
    });
  });

  // ---------- Surprise me: a random not-yet-met color, from the View panel's header (the camera now lives only
  // in Studio, DESIGN-SYSTEM §12 "Learn") ----------
  function hmDice() {
    if (!ctrl || !items.length) return;
    const unmet = items.filter(it => !(it.c && it.c.id && S.cards[it.c.id]));
    const pool = unmet.length ? unmet : items;
    buzz(6); hmDismissHint();
    ctrl.update({ items, focus: pool[Math.floor(Math.random() * pool.length)], soft: true });
  }

  // ---------- chrome fade: visible on a tap or a pause, hidden the instant you start dragging ----------
  let chromeT = 0;
  // Shown again as soon as the finger lifts, and it stays: no timer. (A 1.8 s auto-hide left the buttons drawn but
  // untappable, pointer-events off, so "no button in View works" — David.)
  function hmShowChrome() { el.classList.remove("chrome-hide"); clearTimeout(chromeT); }
  let hmDragging = false;   // true only while a real drag/pinch on the canvas is live (the watchdog below must not fight it)
  function hmWireChrome() {
    const cv = viewEl.querySelector("canvas"); if (!cv || cv.dataset.hmWired) return; cv.dataset.hmWired = "1";
    // L18 (David: "everything disappears except the flashcards"): every corner fades together (css/home.css), only
    // once a drag really moves (a tap never blinks them), and they return a beat after the finger lifts
    let p0 = null;
    cv.addEventListener("pointerdown", e => { p0 = [e.clientX, e.clientY]; clearTimeout(chromeT); });
    cv.addEventListener("pointermove", e => { if (p0 && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 10) { el.classList.add("chrome-hide"); hmDragging = true; clearTimeout(chromeT); } });
    const lift = () => { p0 = null; hmDragging = false; clearTimeout(chromeT); chromeT = setTimeout(() => { el.classList.remove("chrome-hide"); if (!document.querySelector(".sheet") && !STEM_OPEN) cornersBack(); }, 220); };
    cv.addEventListener("pointerup", () => { lift(); hmDismissHint(); });
    cv.addEventListener("pointercancel", lift);
    // David: "sometimes the bottom corner buttons disappear". A pan whose finger lifts off the canvas (over a corner, a
    // sheet, outside the window) never sent the canvas its pointerup, so the corners stayed faded and untappable. The
    // lift is heard on the window too, and losing focus or the page counts as a lift (cornersBack in js/core.js is the
    // one place every sheet and menu close also brings them back).
    const winLift = () => { if (p0 || el.classList.contains("chrome-hide")) lift(); };
    ["pointerup", "pointercancel", "blur"].forEach(k => addEventListener(k, winLift, true));
    document.addEventListener("visibilitychange", winLift);
    cleanup.push(() => { ["pointerup", "pointercancel", "blur"].forEach(k => removeEventListener(k, winLift, true)); document.removeEventListener("visibilitychange", winLift); });
  }
  // David (repeatedly): "the buttons on the map still disappear." render()'s own cornersBack() and every sheet/
  // stem close already call it, but there's no way to enumerate every path that could leave a stray chrome-hide
  // or a faded inline style behind -- a bfcache restore (iOS backgrounding and returning, pageshow with
  // event.persisted), a resize/orientation change mid-transition, a visibilitychange the lift() closure above
  // missed because the canvas wasn't wired yet, or something not yet found. So corner visibility is made a pure,
  // self-healing function of state instead of trusting every event path to call cornersBack() correctly: a cheap
  // watchdog says so whenever Home is the active screen, no sheet or stem is up, and no drag/pinch is live --
  // which is also exactly the condition cornersBack() itself is safe to call under.
  function hmCornerWatch() {
    if (!el.isConnected || hmDragging || document.querySelector(".sheet,.scrim") || STEM_OPEN) return;
    // a position:fixed corner is fixed to the nearest transformed ancestor, not necessarily the viewport: a
    // lingering transform (a finished-but-still-"filling" animation -- js/mapxfer.js mxLand's map-shrink is one,
    // js/polish.js's screen-entrance "enter" animation is another) can leave it positioned against the WRONG box
    // even while every opacity/pointer-events style cornersBack() checks says "visible" -- getComputedStyle, not
    // el.style, since a Web Animations API effect (fill:"both") never shows up as an inline style. Both call
    // sites clean up after themselves now, but this is the backstop: once no sheet/stem/drag says el should still
    // be moving, nothing is allowed to still be animating it either.
    // only a FINISHED-but-filling animation is stale (a still-RUNNING one is a legitimate transition in progress,
    // which this must never interrupt)
    if (typeof el.getAnimations === "function") { try { el.getAnimations().forEach(a => { if (a.playState === "finished") a.cancel(); }); } catch (e) {} }
    cornersBack();
    // David's screenshot: a ~130pt black band under the honeycomb on an iPhone Home Screen app. --vb/--app-full
    // (js/core.js vbFix -- the strip a standalone iOS app's translucent status bar leaves the reported viewport
    // short by, which .screen.fixed.cx{height:var(--app-full,100dvh)} reaches through) are computed once at
    // script load plus a few fixed points (load, a 600ms timeout, resize, orientationchange); if the real device
    // hadn't settled its own viewport yet at any of those moments, the map's screen could be sized from a stale
    // measurement forever after. The same events this watchdog already listens to are reasons to recompute it too.
    if (typeof vbFix === "function") vbFix();
  }
  const hmWatchEvents = ["pageshow", "resize", "orientationchange"];
  hmWatchEvents.forEach(k => addEventListener(k, hmCornerWatch));
  document.addEventListener("visibilitychange", hmCornerWatch);
  const hmWatchTimer = setInterval(hmCornerWatch, 1000);
  cleanup.push(() => { hmWatchEvents.forEach(k => removeEventListener(k, hmCornerWatch)); document.removeEventListener("visibilitychange", hmCornerWatch); clearInterval(hmWatchTimer); });
  hmShowChrome(); cornersBack();   // every way into Home starts with both corners drawn and tappable
  // ---------- the right corner: ONE button (PLAN.md decision #2; David: "Study the map is a mini game that belongs with
  // learning, inside a menu, not its own button"). It shows how many names are due, and opens a labeled arc of verbs,
  // the rooms stem's mirror: Study the map · Favorites · Search · Colors & Arrange. The arc is the stem's own
  // machinery (STEM_OPEN, .rm-scrim, closeStem), so a tap outside, Escape and Back all close it.
  // David, 2026-10-09: "this menu is too long... Recall doesn't belong here, it's already in the left menu" (the
  // Rooms corner's Learn room, which leads with the due check-in) -- dropped. "Learn these and Study the map
  // overlap" -- folded into one: Study the map (the instant deck, what the old "Learn these" actually opened),
  // its own subtitle now carrying the "names near the middle" default scope the separate mapstudy.js games
  // screen used to own alone. Colors and Arrange are one combined sheet now (chooser, below) with its own tab
  // switch, so they're one door here too. Four items, not seven. ----------
  const doBtn = $("#hmDo");
  function paintDo() {
    const due = typeof dueList === "function" ? dueList().length : 0;
    doBtn.innerHTML = `${HM_DO_GLYPH}${due ? `<em class="hm-do-n" aria-hidden="true">${due > 99 ? "99+" : due}</em>` : ""}`;
    doBtn.setAttribute("aria-label", due ? `Menu, ${due} to recall` : "Menu");
    doBtn._html = doBtn.innerHTML;
  }
  paintDo();
  function doMenu() {
    if (STEM_OPEN) { buzz(4); return closeStem(); }
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;   // a ghost click right after closing must not reopen it (js/core.js)
    if (document.querySelector(".sheet,.scrim")) return;
    document.querySelectorAll(".rooms-stem,.rm-scrim").forEach(n => n.remove());
    hmDismissHint();
    buzz(4);
    STEM_OPEN = true; document.body.classList.add("stem-open");
    const v = hmView(), lit = typeof HONEY_HL !== "undefined" && HONEY_HL;
    const ic = svg => `<span class="rm-art hm-do-ic">${svg}</span>`;
    const dots = hs => `<span class="rm-art hm-do-ic hm-do-dots">${hs.slice(0, 4).map(h => `<i style="background:${esc(h)}"></i>`).join("")}</span>`;
    const sample = items.filter((_, i) => i % Math.max(1, Math.floor(items.length / 4)) === 0).map(it => it.h);
    // top to bottom as read; the thumb's nearest (the bottom) are the map's own controls
    const rows = [
      typeof prQuick === "function" && { id: "learn", t: "Study the map", n: lit ? honeyLitLabel().title : "Names near the middle", art: ic(PR_ICON.cards), attr: "data-pr-study" },
      typeof fvPickStart === "function" && { id: "fav", t: "Favorites", n: "Colors you love", art: ic(FV_HEART), attr: 'id="hmFav"' },
      { id: "search", t: "Search", n: "A color, a hex, a painter, a decade", art: ic(ICON.search), attr: "data-do-search" },
      { id: "colors", t: "Colors & Arrange", n: `${hlAll ? "Every name" : hmViewLabel()} · ${hmArrLabel()}`, art: dots(sample), attr: "data-do-colors" },
    ].filter(Boolean);
    const n = rows.length;
    const scrim = document.createElement("div"); scrim.className = "rm-scrim rm-scrim-r";
    scrim.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); buzz(4); closeStem(); });
    scrim.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
    scrim.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
    const stem = document.createElement("div");
    stem.className = "rooms-stem hm-do-stem"; stem.setAttribute("role", "menu"); stem.setAttribute("aria-label", "Home menu");
    stem.style.setProperty("--n", n);
    stem.innerHTML = rows.map((r, k) => {
      const i = n - 1 - k;   // a straight stack up the right edge (David preferred it over the tile panel), pictures centered over the corner
      return `<button class="rm-bubble" role="menuitem" data-do="${r.id}" ${r.attr || ""} style="--i:${i}">
        ${r.art}<span class="rm-label"><b>${esc(r.t)}</b><em>${esc(r.n)}</em></span></button>`;
    }).join("");
    document.body.append(scrim, stem);
    doBtn.classList.add("on"); doBtn.innerHTML = ICON.x; doBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); stem.classList.add("on"); }));
    STEM_KEY = e => { if (e.key === "Escape") { e.stopPropagation(); closeStem(); } };
    addEventListener("keydown", STEM_KEY, true);
    const acts = {
      // "Study the map": the instant deck seeded with whatever's lit, else the middle of the map (the old
      // "Learn these"). Recall itself lives only in the left menu's Learn room now (its own due check-in).
      learn: () => hmStudyCorner(ctrl, items),
      fav: () => fvPickStart(el, ctrl),
      search: () => openSearch(),
      colors: () => chooser(S.hm.chooserTab === "arrange" ? "arrange" : "colors"),   // Colors & Arrange, one sheet, last tab remembered
    };
    stem.querySelectorAll("[data-do]").forEach(b => b.onclick = () => { buzz(8); closeStem(true); acts[b.dataset.do](); });
  }
  doBtn.onclick = doMenu;
  // (the swipe-up-from-the-bottom shortcut to Learn is gone: David, 2026-10-08, a scroll near the bottom kept landing
  // in Learn. The rooms button is the way in.)
  // L18 B3: the mirror gesture, a pull down from the top of Home opens search (View's magnifier stays the second way in)
  let l18Pull = null;
  viewEl.addEventListener("pointerdown", e => { l18Pull = e.isPrimary && e.clientY < viewEl.getBoundingClientRect().top + 100 ? { x0: e.clientX, y0: e.clientY, on: false } : null; }, true);
  viewEl.addEventListener("pointermove", e => {
    if (!l18Pull) return;
    const dx = e.clientX - l18Pull.x0, dy = e.clientY - l18Pull.y0;
    if (!l18Pull.on) {
      if (dy > 34 && dy > Math.abs(dx) * 1.5) {
        l18Pull.on = true;
        const cv = viewEl.querySelector("canvas"), ours = l18Pull; l18Pull = null;
        if (cv) cv.dispatchEvent(new PointerEvent("pointercancel", { pointerId: e.pointerId, bubbles: true, clientX: e.clientX, clientY: e.clientY }));
        l18Pull = ours;
      } else { if (Math.hypot(dx, dy) > 34 || dy < -10) l18Pull = null; return; }
    }
    e.stopPropagation();
  }, true);
  const l18PullEnd = e => { if (!l18Pull) return; const was = l18Pull.on; l18Pull = null; if (!was) return; e.stopPropagation(); buzz(6); openSearch(); };
  viewEl.addEventListener("pointerup", l18PullEnd, true); viewEl.addEventListener("pointercancel", l18PullEnd, true);

  window.HM_SEARCH = q => { openSearch(); searchInput.value = q; searchInput.dispatchEvent(new Event("input")); };   // #shot=home:find:<q>
  window.HM_CHOOSER = chooser;   // #shot=home:look hook (tools/shots.sh): drive the Show/Look sheet without a tap
  const drawn = render(false);
  // David: "the transition gets stuck in the middle for a couple of seconds too long" going back to the map from
  // a color page. mxLand (js/mapxfer.js, the shrink-into-the-bubble animation) used to wait for render() to fully
  // resolve first -- on a slow connection or the first Home of a session, render() awaits loadCoreNames/
  // loadLongNames/loadShades (and honeyLoadPainted for a "Painted" order), which is exactly the network/data wait
  // the shrink must never be gated on. A hard cap starts it within 300ms regardless: mxLand itself already
  // degrades gracefully with no bubble geometry yet (it dissolves the color into the map instead of a precise
  // shrink-to-bubble), which is an honest fallback, never a stuck screen.
  if (back) { const cap = new Promise(res => later(res, 300)); Promise.race([Promise.resolve(drawn), cap]).then(() => mxLand(back), () => mxLand(back)); }
}

// Opens an app color's full page directly (ROADMAP.md §12: no half-height card, no second tap). Back (the
// button, the browser/swipe-back gesture, or the pull-down-to-close below) goes one step at a time, same as
// anywhere else (ROADMAP.md §17 job #2, Pinterest-style Back): colorPage's own back is xStep/xBack
// (js/explore.js wireArticle), which pops XSTACK and, once a chain opened from here finally runs out, falls
// back to the honeycomb specifically (S.tab stays "learn" the whole time, so xFallbackTab() resolves to it) —
// not a hard override on just the first screen, which used to make every deeper page (a family's own page,
// say) jump straight home instead of to the page that opened it.
// honey.js's own HONEY_PAN restores the pan and zoom the next time hmHome() builds the same set of items.
function hmOpenColor(c) {
  XSTACK = []; X_ROOT = "home";
  return openNode(colorNode(c));   // (the pull-down, the map glyph and the trail come from js/trail.js, on every page)   // growFrom's renderFn (js/home.js pick, js/core.js) grows the page from the tapped bubble
}
// Same, for a bubble that isn't one of the 101: its own name page (js/names.js), not the small color sheet
// (ROADMAP.md §13: every one of the ~1,000 names has a real page now).
function hmOpenName(o) {
  XSTACK = []; X_ROOT = "home";
  loadCoreNames().then(() => {
    namePage(npEntryFor(o));
  });
  // (async: no root to return synchronously, so this path never grows from the bubble — see pick() above)
}

// Pull down from the top of a page to close it, like a sheet: the page follows the finger, a "Release to close" pill
// appears past the threshold, and letting go there slides it away and close() runs. Anywhere below the top, a downward
// drag is just normal scrolling. David (2026-10-08): reading and scrolling back up must never close an article, so it
// arms only after the page has RESTED at the top for 700 ms (a scroll-up that just reached the top is still scrolling),
// there is no quick-flick shortcut, and the pull has to be long and deliberate (200px of finger travel).
function hmPullClose(screen, close) {
  if (!screen) return;
  let y0 = null, x0 = 0, dy = 0, t0 = 0, on = false, lastScroll = 0;
  const born = performance.now();
  const onScroll = () => { lastScroll = performance.now(); if (!screen.isConnected) removeEventListener("scroll", onScroll); };
  addEventListener("scroll", onScroll, { passive: true, capture: true });
  const REST = 700, PULL = 200;
  let pill = null;
  const hint = show => {
    if (show && !pill) { pill = document.createElement("div"); pill.className = "hm-pullpill"; pill.textContent = "Release to close"; document.body.appendChild(pill); }
    if (pill) pill.classList.toggle("on", !!show);
  };
  const reset = () => { screen.style.transition = "transform .35s var(--ease)"; screen.style.transform = ""; hint(false); };
  screen.addEventListener("touchstart", e => {
    // arm only when the page is resting at the top: not mid-fling (a scroll in the last 180 ms means the finger is
    // catching a page that's still moving), and not in the first moments after the page opened
    if (e.touches.length !== 1 || pageScrollTop() > 0 || e.target.closest("canvas,input,textarea,select,[data-nopull]") || document.querySelector(".sheet") || performance.now() - lastScroll < REST || performance.now() - born < 350) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; on = false; t0 = performance.now();
  }, { passive: true });
  screen.addEventListener("touchmove", e => {
    if (y0 == null) return;
    const d = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!on) {
      if (d > 24 && d > Math.abs(dx) * 2 && pageScrollTop() <= 0 && performance.now() - lastScroll >= REST) on = true;
      else if (Math.abs(dx) > 10 || d < -6) { y0 = null; return; } else return;
    }
    e.preventDefault();
    // the page follows with resistance, so a small pull looks small and only a deliberate one carries it away
    dy = Math.max(0, d); screen.style.transition = "none"; screen.style.transform = `translateY(${dy < 60 ? dy * .4 : 24 + (dy - 60) * .6}px)`;
    const past = dy > PULL; if (past && !(pill && pill.classList.contains("on"))) buzz(4); hint(past);
  }, { passive: false });
  screen.addEventListener("touchend", () => {
    if (y0 == null || !on) { y0 = null; return; }
    y0 = null;
    hint(false);
    if (dy > PULL) {
      buzz(6);
      screen.style.transition = reduceMotion ? "none" : "transform .25s var(--ease), opacity .25s";
      screen.style.transform = `translateY(${innerHeight * .4}px)`; screen.style.opacity = "0";
      setTimeout(close, reduceMotion ? 0 : 200);
    } else reset();
  });
  screen.addEventListener("touchcancel", () => { if (on) reset(); y0 = null; });
}

// A tap, as a real pointer sequence: the grab handle and the title read pointerdown/up, not click.
// ---------- L18 B3: search 2.0's resolver. l18Resolve(q) -> Promise of null, a color to fly to { h, hint, say(o) },
// or a set to light up { set, hint }. Modifiers are fixed Lab shifts, so the result is approximate and says so
// ("dusty pink ≈ Ash rose"). Painter and decade sets are measured from photographs of paintings: "as photographed".
const L18_MOD = { pale: { dL: 15, k: .5 }, light: { dL: 10, k: .85 }, dark: { dL: -14, k: 1 }, deep: { dL: -12, k: 1.15 }, dusty: { k: .6 },
  muted: { k: .55 }, greyish: { k: .4 }, grayish: { k: .4 }, bright: { dL: 3, k: 1.3 }, vivid: { dL: 2, k: 1.35 }, warm: { to: 60 }, cool: { to: 250 } };
const l18Get = p => fetch(p + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).catch(() => null);
let L18_NAMES = null, L18_PAINTERS = null, L18_GROUPS = null;
function l18NameMap() {
  const key = (CORE_NAMES || []).length + "|" + (LONG_NAMES ? 1 : 0);
  if (L18_NAMES && L18_NAMES.key === key) return L18_NAMES.m;
  const m = new Map();
  hmEveryNameItems().forEach(e => { const k = e.n.toLowerCase(); if (!m.has(k)) m.set(k, { n: e.n, h: e.h }); });
  (CORE_NAMES || []).forEach(e => (e.also || []).forEach(a => { const k = String(a).toLowerCase(); if (!m.has(k)) m.set(k, { n: e.n, h: e.h }); }));
  L18_NAMES = { key, m };
  return m;
}
const l18Color = q => l18NameMap().get(String(q).toLowerCase().trim()) || null;
function l18Hex(q) {
  let m = /^#?([0-9a-f]{6})$/i.exec(q); if (m) return "#" + m[1].toUpperCase();
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(q); if (m) return ("#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase();
  m = /^rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i.exec(q);
  if (m && [m[1], m[2], m[3]].every(v => +v <= 255)) return "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
}
const l18Sw = hs => `<span class="hm-l18-sw">${hs.slice(0, 6).map(h => `<i style="background:${h}"></i>`).join("")}</span>`;
const l18Hexes = names => [...new Set(names.map(n => (l18Color(n) || {}).h).filter(Boolean))];
async function l18Resolve(q) {
  await Promise.all([loadCoreNames(), loadLongNames()]);
  const ql = q.toLowerCase().replace(/\s+/g, " ").trim();
  const hx = l18Hex(ql);
  if (hx) return { h: hx, hint: `${l18Sw([hx])}<span>Fly to <b>${hx}</b></span>`, say: o => `${hx} ≈ ${o.n}` };
  let m = /^between (.+?) and (.+)$/.exec(ql);
  if (m) {
    const a = l18Color(m[1]), b = l18Color(m[2]); if (!a || !b) return null;
    const A = lab(a.h), B = lab(b.h), road = Array.from({ length: 7 }, (_, i) => labHex(...A.map((v, k) => v + (B[k] - v) * i / 6)));
    const mid = road[3], colors = [mid].concat(road.filter(h => h !== mid)).map(h => ({ h }));
    return { set: colorSet({ kind: "road", id: a.n + "|" + b.n, title: `Between ${a.n} and ${b.n}`, colors }), hint: `${l18Sw(road)}<span>The road from <b>${esc(a.n)}</b> to <b>${esc(b.n)}</b></span>` };
  }
  m = /^(1[3-9]\d0)s?$/.exec(ql);
  if (m) {
    L18_GROUPS = L18_GROUPS || await l18Get("data/analysis/groups.json");
    const g = L18_GROUPS && L18_GROUPS.byDecade && L18_GROUPS.byDecade[m[1]]; if (!g) return null;
    const hs = l18Hexes((g.distinctive || []).concat(g.top || []).map(x => x.name)); if (!hs.length) return null;
    const title = `${m[1]}s · ${g.n.toLocaleString()} painting${g.n === 1 ? "" : "s"} · as photographed`;
    // David, 2026-10-09: a subject opens js/subjectview.js's palette view (count slider up to its real distinct
    // colors, measures, filters, arrangements) instead of a fixed handful lit on the map; set stays as a fallback.
    return { set: colorSet({ kind: "decade", id: m[1], title, colors: hs.map(h => ({ h })) }), subject: { kind: "decade", id: m[1], label: `${m[1]}s` }, hint: `${l18Sw(hs)}<span>Light up the <b>${m[1]}s</b></span>` };
  }
  const exact = l18Color(ql);
  if (exact) return { h: exact.h, hint: `${l18Sw([exact.h])}<span>Fly to <b>${esc(exact.n)}</b></span>`, say: o => o.n.toLowerCase() === exact.n.toLowerCase() ? exact.n : `${exact.n} · nearest here: ${o.n}` };
  const words = ql.split(" "), mod = L18_MOD[words[0]], base = mod && words.length > 1 && l18Color(words.slice(1).join(" "));
  if (base) {
    let [L, C, H] = lch(base.h);
    if (mod.dL) L = clamp(L + mod.dL, 2, 98);
    if (mod.k) C *= mod.k;
    if (mod.to != null) { const d = ((mod.to - H + 540) % 360) - 180; H += Math.sign(d) * Math.min(15, Math.abs(d)); }
    const h = lchHex(L, C, H);
    return { h, hint: `${l18Sw([h])}<span>Fly to <b>${esc(ql)}</b></span>`, say: o => `${ql} ≈ ${o.n}` };
  }
  if (ql.length < 3) return null;
  // movements and looks (David, 2026-10-09: "could the same apply to a decade, a style, or anything else" -- yes):
  // a subject match opens js/subjectview.js's palette view instead of lighting a fixed handful. A real painting
  // movement in the archive (data/analysis/groups.json byMovement) comes before a hand-curated look (data/looks.js
  // window.LOOKS -- an aesthetic, a design era, a film look), since the movement is measured from more paintings.
  L18_GROUPS = L18_GROUPS || await l18Get("data/analysis/groups.json");
  const mv = L18_GROUPS && L18_GROUPS.byMovement && Object.keys(L18_GROUPS.byMovement).find(k => k.toLowerCase() === ql || k.toLowerCase().startsWith(ql));
  if (mv) {
    const g = L18_GROUPS.byMovement[mv], hs = l18Hexes((g.top || []).concat(g.distinctive || []).map(x => x.name));
    if (hs.length) return { subject: { kind: "movement", id: mv, label: mv }, hint: `${l18Sw(hs)}<span>Light up <b>${esc(mv)}</b></span>` };
  }
  if (!window.LOOKS) await loadData("looks");
  const look = (window.LOOKS || []).find(x => x.name.toLowerCase() === ql)
    || (window.LOOKS || []).find(x => x.id.replace(/-/g, " ") === ql || x.name.toLowerCase().startsWith(ql));
  if (look && (look.pals || []).length) {
    return { subject: { kind: "look", id: look.id, label: look.name }, hint: `${l18Sw(look.pals[0].c.map(c => c[0]))}<span>Light up <b>${esc(look.name)}</b></span>` };
  }
  L18_PAINTERS = L18_PAINTERS || await l18Get("data/artists/meta.json").then(d => d && d.a ? Object.entries(d.a).map(([slug, a]) => ({ slug, n: a.n, k: a.k || 0, w: a.n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s.-]+/) })) : []);
  const qw = ql.normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ");
  const p = L18_PAINTERS.filter(a => qw.every(x => a.w.some(w => w.startsWith(x)))).sort((a, b) => b.k - a.k)[0];
  if (!p) return null;
  const A = await l18Get(`data/analysis/artists/${p.slug}.json`); if (!A) return null;
  const names = (A.signature || []).map(x => x.name).concat(...(A.clusters || []).map(c => c.colors || []));
  const hs = l18Hexes(names); if (!hs.length) return null;
  const short = p.n.split(" ").slice(-1)[0], n = A.n || p.k;
  const title = `${short} · ${n.toLocaleString()} painting${n === 1 ? "" : "s"} · as photographed${n < 15 ? " · few paintings" : ""}`;
  return { set: colorSet({ kind: "painter", id: p.slug, title, colors: hs.map(h => ({ h })) }), subject: { kind: "painter", id: p.slug, label: p.n }, hint: `${l18Sw(hs)}<span>Light up <b>${esc(p.n)}</b>'s colors</span>` };
}

// ---------- the Study corner: "Learn these" means what you're looking at (PLAN.md lane F; home-map-nav.md A6) ----------
// The lit set when one is lit; else the middle bubble and its look-alikes, when it's a name you can still learn; else
// next door to what you know (learner.js edgeOfMap); else the names you can't name yet nearest the middle. Never seeded
// from a basic: Grey sits in the middle of a fresh map, and ten greys was a newcomer's first lesson.
function hmStudyCorner(ctrl, items) {
  if (typeof HONEY_HL !== "undefined" && HONEY_HL && typeof honeyLearnLit === "function") return honeyLearnLit();
  const mid = ctrl && ctrl.current();
  const basic = x => { const a = x && x.n && BYNAME.get(String(x.n).toLowerCase()); return !!(a && a.basic); };
  const unknown = x => typeof knowState !== "function" || knowState({ n: x.n, h: x.h }) !== "yours";
  if (mid && mid.n && !basic(mid) && unknown(mid)) return prQuick({ seed: { n: mid.n, h: mid.h }, src: "map", source: "alike", sheet: true });
  const edge = typeof edgeOfMap === "function" ? edgeOfMap(10) : [];
  if (edge.length >= 3) return prQuick({ items: edge.map(x => ({ n: x.n, h: x.h })), label: "Next door to what you know", src: "map", source: "these" });
  // nearest on the map itself (the bubbles you see around the middle); by color distance when the layout can't say.
  // Around a basic in the middle (Grey, Black, White...), only colors with some hue, so it isn't more of the same.
  const hueOnly = mid && basic(mid), sp = ctrl && ctrl.studyPoints && ctrl.studyPoints();
  let dist = null;
  if (sp && mid) {
    const c = sp.pts.find(p => p.n === mid.n);
    if (c) { dist = new Map(); sp.pts.forEach(p => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (!dist.has(p.n) || d < dist.get(p.n)) dist.set(p.n, d); }); }
  }
  const m = mid && mid.h ? lab(mid.h) : null;
  const near = [];
  for (const { x } of items.filter(x => x && x.n && x.h && (!hueOnly || lch(x.h)[1] >= 12))
    .map(x => ({ x, d: dist ? (dist.has(x.n) ? dist.get(x.n) : Infinity) : m ? de2000(m, lab(x.h)) : 0 })).sort((a, b) => a.d - b.d)) {
    if (!basic(x) && unknown(x)) near.push(x);
    if (near.length >= 10) break;
  }
  if (near.length >= 3) return prQuick({ items: near.map(x => ({ n: x.n, h: x.h })), label: mid && !hueOnly ? `Near ${mid.n.toLowerCase()}` : "Near the middle", src: "map", source: "these" });
  toast("You can name every color here. Grow the map in View.");
}

// ---------- L18 H4: any painting on the map. Its measured colors, merged by name (shares added), biggest first, lit as
// a constellation on Home (csOnMap). Addresses: #/map/gallery/<i> (a museum painting), #/map/painting/<slug>. ----------
function hmPaintingSet(n) {
  const by = new Map();
  (n.palette || []).forEach(p => { const nm = p.name || (typeof nameOf === "function" ? nameOf(p.h).text : p.h), o = by.get(nm); if (o) o.share += p.share || 0; else by.set(nm, { h: p.h, n: nm, share: p.share || 0 }); });
  const colors = [...by.values()].sort((a, b) => b.share - a.share);
  // the full measured pool when there is one (a museum painting's ~24 colors), so the map's How many can show more
  const pool = n.pool && n.pool.length > colors.length ? n.pool : null;
  return colorSet({ kind: "painting", id: n.id || n.title, title: pool ? n.title : `${n.title} · ${colors.length} named color${colors.length === 1 ? "" : "s"} · as photographed`, colors, src: n.src || "painting/" + routeSlug(String(n.id || "").replace(/^painting-/, "")),
    ...(pool ? { pick: csPoolPick(pool), max: pool.length } : {}) });
}
function hmMapRoute(kind, id) {
  if (kind === "gallery" && /^\d+$/.test(id) && typeof loadGallery === "function") {
    const i = +id;
    return loadGallery().then(() => glDetail(i)).then(d => {
      const pal = glPal(i).map(p => ({ ...p, name: nameOf(p.h).text }));
      const pool = typeof glPoolDecode === "function" ? glPoolDecode(d.pl) : [];
      csOnMap(hmPaintingSet({ id: "g" + i, title: d.t || "Painting", palette: pal, pool, src: "gallery/" + i }));
    }).catch(() => { hmHome(); toast("That painting didn't load"); });
  }
  if (kind === "painting") return loadWiki().then(() => { const n = graph().nodes.get("painting-" + id); if (n && (n.palette || []).length) csOnMap(hmPaintingSet(n)); else hmHome(); });
  hmHome();
}

// ---------- L18 B2: the real floor. Just before a room rises over Home, keep a snapshot of the map exactly as you
// left it; the strip above every room (js/core.js roomChrome) shows it, dimmed by a solid scrim, never blurred. ----------
let ROOM_FLOOR_IMG = null;
function hmSnapFloor() {
  const c = window.HM_CTRL; if (!c || !c.snapshot || !document.querySelector(".screen.hm canvas")) return;
  const u = c.snapshot(390); if (u) ROOM_FLOOR_IMG = u;
}
// the stem's live art (js/core.js roomsBubbleArt/roomsNote ask here first): today's painting for Explore, today's
// station for Train, your last palette (or the gamut wheel) for Studio
// "Jan van Eyck" -> "van Eyck", "Claude Monet" -> "Monet"
function l18Surname(full) {
  const w = String(full || "").trim().split(/\s+/); if (!w[0]) return "";
  let i = w.length - 1; while (i > 0 && /^(van|von|de|der|den|da|del|della|di|du|la|le|ter)$/i.test(w[i - 1])) i--;
  return w.slice(i).join(" ");
}
function hmStemToday() {
  const out = {};
  try {
    let art = null;
    try { art = typeof coverData === "function" ? coverData().art : null; } catch (e) { art = null; }
    if (!art && window.PAINTINGS && PAINTINGS.length && typeof seeded === "function") art = seeded(PAINTINGS.filter(p => p.thumb || p.img), "artcover" + today())[0];
    if (art) out.explore = { art: `<span class="rm-art rm-art-img"><img src="${esc(art.thumb || art.img)}" alt="" loading="lazy"></span>`, note: [l18Surname(art.artist), art.title].filter(Boolean).join(", ") };
  } catch (e) {}
  try { const tt = typeof todayTrain === "function" ? todayTrain() : null; if (tt && tt.art) out.gym = { art: `<span class="rm-art rm-art-station">${tt.art}</span>`, note: tt.what }; } catch (e) {}
  const pal = (S.palettes || [])[0], cols = pal && (pal.cols || pal.colors || []).map(c => typeof c === "string" ? c : c && c.h).filter(Boolean);
  if (cols && cols.length) out.studio = { art: `<span class="rm-art rm-art-strip">${cols.slice(0, 8).map(h => `<i style="background:${h}"></i>`).join("")}</span>`, note: `Your last palette · ${cols.length} color${cols.length === 1 ? "" : "s"}` };
  else out.studio = { note: "Make a palette from a photo" };
  return out;
}

function hmTap(el) {
  if (!el) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, o = { bubbles: true, clientX: x, clientY: y, pointerId: 1 };
  el.dispatchEvent(new PointerEvent("pointerdown", o));
  el.dispatchEvent(new PointerEvent("pointerup", o));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));   // a real tap also fires click; a plain .onclick button (not a raw pointer listener) needs this one too
}
// ---------- screenshot hooks: #shot=home (bar fades, the default) · home:bar (forced back on) ----------
//   home:rooms (the stem) · home:views · home:look · home:search
function hmShot(arg) {
  // L18: home:far (stage 9, all the way out) · home:fam (the same, with family names on)
  if (arg === "far") S.hm = Object.assign(S.hm || {}, { src: "stage:1000", filter: "all", zoom: .01 });
  if (arg === "zin") S.hm = Object.assign(S.hm || {}, { zoom: 2.1 });   // L18: the double-tap zoom-in level
  if (/^spiral/.test(arg)) S.hm = Object.assign(S.hm || {}, { src: "stage:1000", filter: "all", arr: "path", zoom: arg === "spiral:out" ? .01 : 1 });   // L18 H5, now Path rings
  // design/HOME-VIEWS.md: home:arr:<id>[:<src>] (an arrangement, optionally on a source), home:fam:<Family>[:<tone>]
  if (/^arr:/.test(arg)) { const [, id, src] = arg.split(":"); S.hm = Object.assign(S.hm || {}, { arr: id, src: src || (S.hm && S.hm.src) || "stage:100", filter: "all", fam: "", tone: "" }); }
  if (/^fam:/.test(arg)) { const [, f, tone] = arg.split(":"); S.hm = Object.assign(S.hm || {}, { src: "every-name", fam: f, tone: tone || "", filter: "all" }); }
  hmHome();
  if (arg === "bar") setTimeout(() => { const s = document.querySelector(".screen.hm"); if (s) s.classList.remove("chrome-hide"); }, 3200);
  if (arg === "floor") setTimeout(() => { hmSnapFloor(); go("gym"); }, 600);   // L18 B2: a room over the real floor
  if (/^route:/.test(arg)) setTimeout(() => openRoute("#" + arg.slice(6)), 300);   // e.g. home:route:/map/painting/starry-night
  // home:subject:<kind>:<id>[:<label>] -- js/subjectview.js's palette view, for design review screenshots
  if (/^subject:/.test(arg)) setTimeout(() => { const [, kind, id, label] = arg.split(":"); if (typeof svOpen === "function") svOpen({ kind, id, label: label ? decodeURIComponent(label) : id }); }, 300);
  if (/^find:/.test(arg)) setTimeout(() => window.HM_SEARCH && window.HM_SEARCH(arg.slice(5)), 300);
  if (arg === "rooms") setTimeout(() => hmTap(document.querySelector("[data-rooms-corner]")), 150);
  if (arg === "views") setTimeout(() => window.HM_CHOOSER && window.HM_CHOOSER("show"), 150);   // the Colors sheet
  if (arg === "arrange") setTimeout(() => window.HM_CHOOSER && window.HM_CHOOSER("look"), 150);   // the Arrange sheet
  if (arg === "do") setTimeout(() => { const b = document.getElementById("hmDo"); if (b) b.click(); }, 150);   // the right corner's menu
  if (arg === "look") setTimeout(() => window.HM_CHOOSER && window.HM_CHOOSER("look"), 150);   // the long-press shortcut, without the long-press
  if (arg === "search") setTimeout(() => { window.HM_CHOOSER && window.HM_CHOOSER("show"); setTimeout(() => hmTap(document.querySelector("[data-search]")), 150); }, 150);
}
