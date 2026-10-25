"use strict";
// Keep exploring (David, 2026-10-24): "when you click on a painting, when you scroll all the way down, it should show all the
// similar paintings, and you can pick filters like similar by color, and the first one you see is the most similar by color;
// keep scrolling to find paintings related, so you can quickly go from one to the next. Or filter by similar in terms of
// painter, location, time, subject maybe."
//
// The feed sits at the very bottom of every painting page (js/gallery.js glPage mounts it): a sticky row of chips (Color,
// Painter, Era, Place) over a masonry of paintings, closest first, 24 more each time you near the end.
//  - One ranking per painting + chip (+ metric), cached (FD_CACHE, 12 at a time); the feed pages through the top ~300.
//    Color reuses js/twins.js exactly (glSimilarPal and the tw*Score scorers behind the "More like this, by…" switch);
//    Painter, Era and Place are plain passes over the index (year) and the facets (js/browse.js: painter, country, movement).
//  - The chosen chip is remembered for the session (FD_ST), so opening any tile lands on the next painting with the same
//    chip still on. Back puts the feed exactly where it was (FD_MEMO + js/trail.js tlHoldScroll), anchored on a tile.
//  - Every tile's box is fixed from the index's aspect byte before any image or title arrives (no layout jumps). Only the
//    tiles near the screen exist (and never more than FD_LIVE_MAX); a tile that scrolls far away loses its <img> entirely.
//    The images asked for are the smallest copy a host serves that is still sharp at that width (fdSrc).
//  - THE SEAM for Subject and Vibe: add ["subject", "Subject"] to FD_CHIPS, one function to FD_RANK (same shape as the
//    others: (ctx, st) => { items: [{ j, cap }] } or { empty: "plain reason" }, maybe a Promise), and one line to
//    FD_OFF if it can be unavailable for a painting. Nothing else in this file knows which chips exist.

const FD_PAGE = 24, FD_LIVE_MAX = 40, FD_KEEP = 300;
// Density (David, 2026-10-24: "the explore page should be able to zoom out similar to the other painting scroll"): 1 to 6 tiles across on a
// phone, up to 10 on a desktop window; pinch / ctrl+wheel / + - (js/gridzoom.js, shared with the painter page) change it, and the choice is
// remembered per feed (colorhub-feed-view, colorhub-feed-view-color) and per device kind (cols for a phone, dcols for a wide window).
// 5+ across, or any tile narrower than FD_DENSE_W px, shows the match percent only (a tile too narrow for words); a long-press shows all of it.
// The live-picture budget grows with the density (smaller tiles, more of them on screen), and the page size with it so the scroll fills the screen.
const FD_DENSE_W = 100, FD_LIVE_CAP = 120;
const fdLiveMax = cols => cols <= 3 ? FD_LIVE_MAX : Math.min(FD_LIVE_CAP, FD_LIVE_MAX + 20 * (cols - 3));
const fdMaxCols = () => typeof glDesk === "function" && glDesk() ? 10 : 6;
const fdGapsFor = (cols, W) => cols <= 2 ? [12, 18] : cols <= 4 ? (W >= 860 && cols <= 5 ? [16, 22] : [10, 16]) : cols <= 6 ? [6, 10] : [4, 8];
const fdPctOnly = cap => { const m = /(\d+)%/.exec(cap || ""); return m ? m[1] + "%" : ""; };
const FD_CHIPS = [["color", "Color"], ["vibe", "Vibe"], ["painter", "Painter"], ["era", "Era"], ["place", "Place"]];
const FD_SHORT = { overall: "Overall", dominant: "Dominant", accents: "Accents", mood: "Mood", light: "Light", color: "One color", layout: "Layout" };
const FD_METRIC_HELP = { overall: "The whole palette, matched by area", dominant: "Only the three biggest colors", accents: "The small vivid colors", mood: "Key, color, contrast and warmth together",
  light: "Where the darks and lights sit", color: "The most canvas near one of its colors", layout: "Where the colors sit in the picture" };
const FD_LEAD = { color: m => ({ overall: "Closest palette first", dominant: "Closest big colors first", accents: "Closest accents first", mood: "Closest mood first", light: "Closest light first", color: "Most of that color first", layout: "Closest layout first" })[m],
  vibe: () => fdVibeSeen() ? "Closest vibe first" : "Vibe: how alike the picture model finds them (subject, style, mood, color)",
  painter: () => "Same painter first, then painters kindred in place and era", era: () => "Nearest in year first", place: () => "Same country first, then the region, nearest in time" };
let FD_ST = (() => { try { const s = JSON.parse(sessionStorage.getItem("colorhub-feed") || "null"); if (s && s.chip && s.chip !== "about") return { chip: s.chip, metric: s.metric || "overall", color: s.color | 0 }; } catch (e) {} return { chip: "color", metric: "overall", color: 0 }; })();
const fdSaveState = () => { try { sessionStorage.setItem("colorhub-feed", JSON.stringify(FD_ST)); sessionStorage.setItem("colorhub-feed-color", JSON.stringify(FDC_ST)); } catch (e) {} };   // the painting feed's chip and the color feed's chip are remembered separately
const FD_CACHE = new Map();      // "subject|chip|metric|color" -> { items } (oldest dropped past 24)
const FD_MEMO = new Map();       // painting (or "c:#HEX" for a color page) -> { shown, ak, ay }: how far the feed was opened, and the tile at the top of the screen when you left
const fdHasMemo = i => FD_MEMO.has(i);
let FD_SHARDS = [];              // the detail shards the feed pulled in, oldest first: trimmed so a long browse never holds them all (fdTrim)
let FD_LAST = null;              // { chip, metric, ms, n }: how long the last ranking took (for the smoke test and for measuring)

// ---------- words ----------
const fdPct = d => Math.min(99, Math.max(0, Math.round(100 - d)));
function fdShortName(n) {
  n = String(n || "").replace(/\(.*?\)/g, "").trim();
  if (n.length <= 14) return n;
  const t = n.split(/\s+/); let k = t.length - 1;
  while (k > 0 && /^(van|von|de|der|den|da|di|del|della|le|la|du|dos|ter|ten|el|al)$/i.test(t[k - 1])) k--;
  return t.slice(k).join(" ");
}
const fdRel = (dy, later) => dy === 0 ? "same year" : `${dy} yr${dy === 1 ? "" : "s"} ${later ? "later" : "earlier"}`;
// a painting's palette strip under a tile: every color the same width by default, sized by area only when asked (David, 2026-10-25)
const fdPalArea = () => { try { return localStorage.getItem("colorhub-pal-area") === "1"; } catch (x) { return false; } };
if (fdPalArea()) document.documentElement.classList.add("pal-area");
const fdCap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- the rankers: each returns { items: [{ j, cap }] } or { empty: reason }, now or as a Promise ----------
function fdCapColor(m, ctx, d, hex) {
  switch (m) {
    case "overall": return `${fdPct(d)}% alike`;
    case "dominant": return `Big colors · ${fdPct(d)}%`;
    case "accents": return `Close accents · ${fdPct(d)}%`;
    case "mood": return d < .6 ? "Very close mood" : d < 1.2 ? "Close mood" : "Loose mood";
    case "light": return `Lit alike · ${fdPct(d)}%`;
    case "color": return `${Math.max(1, Math.round((1 - d) * 100))}% near ${nameOf(hex).n.toLowerCase()}`;
    case "layout": return `Same layout · ${fdPct(d)}%`;
  }
  return "";
}
async function fdRankColor(ctx, st) {
  const q = ctx.q(), m = st.metric;
  let ranked, hex = null;
  if (m === "mood" || m === "light") { await twLoadMetrics(); ranked = (m === "mood" ? twScoreMood(q) : twScoreLight(q)).ranked; }
  else if (m === "layout") {
    const im = ctx.o.img && ctx.o.img();
    if (!im || !twReadable(im)) return { empty: "Layout needs a picture this page can read. Try another way of matching.", alt: true };
    const res = await twScoreLayout(q, twGridOf(im), null);
    if (!res.ranked.length) return { empty: "None of the closest palettes has a picture this page can read, so their layout can't be compared.", alt: true };
    ranked = res.ranked;
  }
  else if (m === "color") { hex = q.pool[Math.min(st.color, q.pool.length - 1)].h; ranked = twScoreColor(q, hex).ranked; }
  else if (m === "dominant") ranked = twScoreDominant(q).ranked;
  else if (m === "accents") { ranked = twScoreAccents(q).ranked; if (!ranked.length) return { empty: "This painting has no small vivid colors to match. Try Overall palette.", alt: true }; }
  else ranked = glSimilarPal(twPal(q), 300, { exclude: ctx.i, pairs: false, noEra: true, cands: 300 }).list.map(x => [x.i, x.d]);
  const res = { items: ranked.map(([j, d]) => ({ j, cap: fdCapColor(m, ctx, d, hex) })) };
  if (GAL.mean) {   // past the closest palettes: everything else, by how near its average color is (a quiet tail, no percent)
    const t = m === "color" && hex ? lab(hex) : [GAL.mean[ctx.i * 3], GAL.mean[ctx.i * 3 + 1], GAL.mean[ctx.i * 3 + 2]], used = new Set(ranked.map(r => r[0])); used.add(ctx.i);
    fdPaged(res, fdCursor(fdMeanScores(t[0], t[1], t[2]), used), (s, j) => ({ j, cap: "" }));
  }
  return res;
}
// the squared distance between two paintings' average colors: a cheap tie-break so the nearest in time are also the nearest in color
const fdMeanD = (G, i, j) => { const m = G.mean, a = m[j * 3] - m[i * 3], b = m[j * 3 + 1] - m[i * 3 + 1], c = m[j * 3 + 2] - m[i * 3 + 2]; return Math.min(99, Math.sqrt(a * a + b * b + c * c)) / 1000; };
function fdRankEra(ctx) {
  const G = GAL, i = ctx.i, y0 = G.year[i];
  if (y0 === GL_UNDATED) return { empty: "This painting has no year, so there is no time to be near." };
  const sc = new Float32Array(G.n), est0 = glYearEst(i);
  for (let j = 0; j < G.n; j++) { const y = G.year[j]; sc[j] = j === i ? Infinity : y === GL_UNDATED ? 1e4 + fdMeanD(G, i, j) : Math.abs(y - y0) + fdMeanD(G, i, j); }
  const items = Array.from(twTopK(sc, FD_KEEP), j => {
    const dy = Math.floor(sc[j]), est = est0 || glYearEst(j), r = fdRel(dy, G.year[j] > y0);
    return { j, cap: fdCap1(est && dy ? "about " + r : r) };
  });
  const res = { items, end: "That is every painting from around this time that has a picture." }, used = new Set(items.map(x => x.j)); used.add(i);
  return fdPaged(res, fdCursor(sc, used), (s, j) => { const y = G.year[j]; if (y === GL_UNDATED) return { j, cap: "No year" }; const dy = Math.floor(s), est = est0 || glYearEst(j), r = fdRel(dy, y > y0); return { j, cap: fdCap1(est && dy ? "about " + r : r) }; });
}
// painter, country and movement come from the facets (js/browse.js xbLoad): loaded on first use
async function fdFacets() { const F = await xbLoad(); if (!F || F.G !== GAL) throw new Error("facets out of step"); return F; }
function fdRegions(F, co) {   // the tightest, then the widest, of paintmap.js's regions that hold this country (as country indices)
  if (typeof PM_REGIONS === "undefined") return [];
  const name = F.meta.countries[co - 1], hit = PM_REGIONS.filter(r => r[2].includes(name)).sort((a, b) => a[2].length - b[2].length);
  return [...new Set([hit[0], hit[hit.length - 1]].filter(Boolean))].map(r => new Set(pmRegionCountries(r[0], F)));
}
async function fdRankPlace(ctx) {
  const F = await fdFacets(), G = GAL, i = ctx.i, co = F.country[i], y0 = G.year[i], dated0 = y0 !== GL_UNDATED;
  if (!co) return { empty: "There is no country on record for this painting." };
  const tiers = fdRegions(F, co), sc = new Float32Array(G.n);   // tier 0 = the same country, 1 = the tightest region, 2 = the widest
  for (let j = 0; j < G.n; j++) {
    const c = F.country[j]; if (j === i) { sc[j] = Infinity; continue; } if (!c) { sc[j] = 5000 + fdMeanD(G, i, j); continue; }
    let tier = 0;
    if (c !== co) { tier = -1; for (let k = 0; k < tiers.length; k++) if (tiers[k].has(c)) { tier = k + 1; break; } if (tier < 0) tier = 4; }   // 4: the rest of the world
    const y = G.year[j], dy = !dated0 ? 0 : y === GL_UNDATED ? 400 : Math.abs(y - y0);
    sc[j] = tier * 1000 + Math.min(dy, 900) + fdMeanD(G, i, j);
  }
  const items = Array.from(twTopK(sc, FD_KEEP), j => {
    const y = G.year[j], place = F.meta.countries[F.country[j] - 1];
    return { j, cap: dated0 && y !== GL_UNDATED ? `${place} · ${fdRel(Math.abs(y - y0), y > y0)}` : place };
  });
  const res = { items, end: "That is every painting in the archive." }, used = new Set(items.map(x => x.j)); used.add(i);
  return fdPaged(res, fdCursor(sc, used), (s, j) => { const y = G.year[j], c = F.country[j], place = c ? F.meta.countries[c - 1] : "";
    return { j, cap: place && dated0 && y !== GL_UNDATED ? `${place} · ${fdRel(Math.abs(y - y0), y > y0)}` : place }; });
}
async function fdRankPainter(ctx) {
  const F = await fdFacets(), G = GAL, i = ctx.i, a0 = F.artist[i], co0 = F.country[i], mv0 = F.mv[i], y0 = G.year[i], dated0 = y0 !== GL_UNDATED;
  if (!a0) return { empty: "There is no painter on record for this painting." };
  const so = new Float32Array(G.n), sk = new Float32Array(G.n);   // the same painter's other works; painters kindred in movement, country and era
  for (let j = 0; j < G.n; j++) {
    so[j] = sk[j] = Infinity; if (j === i) continue;
    const y = G.year[j], dy = dated0 && y !== GL_UNDATED ? Math.abs(y - y0) : 300, tie = fdMeanD(G, i, j);
    if (F.artist[j] === a0) { so[j] = Math.min(dy, 300) + tie; continue; }
    const cm = mv0 && F.mv[j] === mv0, cc = co0 && F.country[j] === co0;
    if (cm || cc) sk[j] = (cm ? 0 : 60) + (cc ? 0 : 120) + Math.min(dy, 300) / 2 + tie;
  }
  const name = F.meta.artists[a0 - 1][0], short = fdShortName(name), per = new Map(), kin = [];
  const own = Array.from(twTopK(so, 150), j => ({ j, cap: "Also " + short, byTitle: 1 }));
  for (const j of twTopK(sk, 700)) {   // at most 3 from any one painter, so the kindred are many hands, not one
    const a = F.artist[j], n = per.get(a) || 0; if (n >= 3) continue; per.set(a, n + 1);
    const y = G.year[j], cm = mv0 && F.mv[j] === mv0, cc = co0 && F.country[j] === co0, place = F.meta.countries[F.country[j] - 1] || "";
    kin.push({ j, cap: cm ? (cc ? "Same movement · " + place : F.meta.movements[mv0 - 1]) : `${place}${y !== GL_UNDATED ? " · " + Math.floor(y / 10) * 10 + "s" : ""}` });
  }
  const items = own.concat(kin).slice(0, 400), used = new Set(items.map(x => x.j)); used.add(i);
  const sa = new Float32Array(G.n);   // after them: their other works and kindred hands that were left out, then everyone else, nearest in time first
  for (let j = 0; j < G.n; j++) { if (j === i) { sa[j] = Infinity; continue; } const y = G.year[j], dy = dated0 && y !== GL_UNDATED ? Math.abs(y - y0) : 300; sa[j] = so[j] !== Infinity ? so[j] : sk[j] !== Infinity ? 400 + sk[j] : 2000 + Math.min(dy, 900) + fdMeanD(G, i, j); }
  return fdPaged({ items }, fdCursor(sa, used), (s, j) => { const a = F.artist[j], nm = a ? F.meta.artists[a - 1][0] : "";
    return { j, cap: s < 400 ? "Also " + short : nm ? fdShortName(nm) : "", byTitle: s < 400 ? 1 : 0 }; });
}
// Vibe (js/vibe.js: the picture model's fingerprints, behind the map's By vibe): the painting's 60 nearest, closest first. The model gives a
// similarity, never a percentage worth showing, so a tile says only how close the band is. Nothing here is ranked by us.
const FD_VIBE_KEY = "colorhub-vibe-explained";
const fdVibeSeen = () => { try { return localStorage.getItem(FD_VIBE_KEY) === "1"; } catch (e) { return true; } };
const fdVibeMark = () => { try { localStorage.setItem(FD_VIBE_KEY, "1"); } catch (e) {} };
const fdVibeCap = sim => "";   // the tab already says it: a caption that repeats the tab's meaning is dropped (David, 2026-10-25)
const FD_VIBE_NONE = "The picture model hasn't looked at this painting yet, so Vibe has nothing to compare.";
async function fdRankVibe(ctx) {
  const pg = typeof vibeNeighbors === "function" ? fdVibePager(ctx.i) : null, first = pg ? await pg(60) : [];
  const items = first.map(n => ({ j: n.j, cap: fdVibeCap(n.sim), sim: n.sim }));
  if (!items.length) { ctx.vibeOff = true; return { empty: FD_VIBE_NONE }; }
  const res = { items, end: "That is everything the model can reach from this one", map: `arr=look&on=${ctx.i}`, moreDone: false };
  res.next = async () => { const page = await pg(FD_TAIL); if (!page.length) { res.moreDone = true; return; } page.forEach(n => res.items.push({ j: n.j, cap: "" })); };
  return res;
}
const FD_RANK = { color: fdRankColor, vibe: fdRankVibe, painter: fdRankPainter, era: fdRankEra, place: fdRankPlace };
// can this chip work for this painting? [reason when it can't]. Year is in the index; country and painter are known from the detail row
// at once (d.co, d.a) and checked against the facets when those load.
const FD_OFF = {
  vibe: ctx => ctx.vibeOff ? FD_VIBE_NONE : "",
  era: ctx => GAL.year[ctx.i] === GL_UNDATED ? "No year is known for this painting, so Era has nothing to measure from." : "",
  place: ctx => ctx.F && !ctx.F.country[ctx.i] || (!ctx.F && !ctx.d.co) ? "No country is known for this painting, so Place has nothing to measure from." : "",
  painter: ctx => ctx.F && !ctx.F.artist[ctx.i] || (!ctx.F && !ctx.d.a) ? "No painter is known for this painting." : "",
};

// ---------- never-ending lists (David, 2026-10-25): every feed is the whole archive ranked by closeness, in pages ----------
// A ranker returns its first page ({ items }) and may add res.next: an async function that pushes the next page of less and less close
// paintings onto res.items (and sets res.moreDone when nothing is left). The feed asks for it as you near the end, so a list never stops;
// the end line shows only when a Settings filter leaves nothing more. The state lives on res, so FD_CACHE and a Back restore keep it.
// fdCursor: the rest of a score array (Infinity = never), closest first, n at a time. One linear scan per page (about a millisecond for 200,000),
// no sort of the whole archive. used = indexes already listed; ok(j) is a hard filter; take(j) hears each pick.
function fdCursor(sc, used, ok, take) {
  const N = sc.length; let lastS = -Infinity;
  return n => {
    const best = []; let worst = Infinity;
    for (let j = 0; j < N; j++) {
      const s = sc[j]; if (s === Infinity || s < lastS || (best.length >= n && s >= worst) || used.has(j) || (ok && !ok(j))) continue;
      let p = best.length; while (p > 0 && best[p - 1][0] > s) p--;
      best.splice(p, 0, [s, j]); if (best.length > n) best.pop();
      if (best.length >= n) worst = best[best.length - 1][0];
    }
    if (best.length) lastS = best[0][0];
    best.forEach(([s, j]) => { used.add(j); if (take) take(j); });
    return best;
  };
}
const FD_TAIL = FD_PAGE * 3;
// res.next from a cursor: mk(score, j) makes the tile
function fdPaged(res, cursor, mk) {
  res.moreDone = false;
  res.next = async () => { const page = cursor(FD_TAIL); if (!page.length) { res.moreDone = true; return; } page.forEach(([s, j]) => res.items.push(mk(s, j))); };
  return res;
}
// Vibe past the model's 60 nearest: best-first through the neighbors' own neighbors, so a path of close looks is followed outward
function fdVibePager(i) {
  const heap = [[1, i]], seen = new Set([i]), out = [];
  const pop = () => { let b = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] > heap[b][0]) b = k; const t = heap[b]; heap[b] = heap[heap.length - 1]; heap.pop(); return t; };
  return async n => {
    const got = [];
    while (got.length < n && heap.length) {
      const [p, j] = pop();
      if (j !== i) got.push({ j, sim: p });
      const nb = await vibeNeighbors(j, j === i ? VIBE_K : 24);
      nb.forEach(x => { if (x.i >= 0 && x.i < GAL.n && x.sim > 0 && !seen.has(x.i)) { seen.add(x.i); heap.push([p * x.sim, x.i]); } });
    }
    return got;
  };
}
// squared-free Lab distance of every painting's average color from one color: the quiet tail of a color list
function fdMeanScores(tl, ta, tb) {
  const G = GAL, m = G.mean, sc = new Float32Array(G.n);
  for (let j = 0; j < G.n; j++) { const a = m[j * 3] - tl, b = m[j * 3 + 1] - ta, c = m[j * 3 + 2] - tb; sc[j] = Math.sqrt(a * a + b * b + c * c); }
  return sc;
}

// ---------- images: the smallest sufficient copy ----------
// px = the width the tile needs on this screen. Hosts that serve any width get exactly it (rounded up to 100); Commons only serves its
// standard steps; the Art Institute only 400 / 600 / 843. Anything unknown gets the page's own "mid" copy. If a small copy fails the
// tile asks for the mid copy once before giving up.
function fdSrc(d, w) {
  const u = String(d.img || ""), mid = glSized(u, "mid");
  if (d.crop || glSmall(d)) return mid;   // a cropped frame needs the whole photo; our own copies are 200 px already
  const px = Math.ceil(w * Math.min(2.5, window.devicePixelRatio || 1) / 100) * 100;
  if (/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(u)) { const st = [330, 500, 960, 1280].find(s => s >= px) || 1280; return u.replace(/\?width=\d+$/, "") + "?width=" + st; }
  const m = u.match(/^(https?:\/\/([^/]+)\/.*)\/full\/[^/]*\/0\/default\.jpg$/);
  if (m) {
    if (m[2] === "iiif.micr.io" || m[2] === "api.nga.gov") return px >= 843 ? mid : m[1] + `/full/${Math.max(300, px)},/0/default.jpg`;
    if (m[2] === "www.artic.edu") return m[1] + `/full/${px <= 400 ? 400 : px <= 600 ? 600 : 843},/0/default.jpg`;
    return mid;
  }
  if (/^https:\/\/ids\.si\.edu\/ids\/deliveryService\?/.test(u)) return mid.replace(/([?&]max=)\d+/, "$1" + Math.min(800, Math.max(400, px)));
  return mid;
}
// the detail shards the feed has pulled in: drop the oldest ones nothing on screen needs, so a long browse keeps memory flat
function fdTrim(keep) {
  while (FD_SHARDS.length > 60) {
    const k = FD_SHARDS.shift();
    if (keep.has(k)) { FD_SHARDS.push(k); if (FD_SHARDS.every(x => keep.has(x))) return; continue; }
    if (Array.isArray(GL_SHARDS.get(k))) GL_SHARDS.delete(k);
  }
}

// ---------- Map and the Settings glyph (David, 2026-10-25) ----------
// Settings = the active chip tapped again (a small slider glyph says so). Map = a small opaque button at the top right of the page's hero
// (.fd-mapb-hero, made by each page) and, once the hero has scrolled away, at the right end of the sticky chip row (.fd-mapw).
const FD_ICON_TUNE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>`;
const FD_ICON_MAP = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>`;
const fdMapBtnHTML = cls => `<button type="button" class="fd-mapb ${cls}" data-fdmap aria-label="Map: see this list on the map">${FD_ICON_MAP}<span>Map</span></button>`;
function fdBarTools(bar) {
  if (!bar || bar.querySelector(".fd-mapw")) return;
  const w = document.createElement("div"); w.className = "fd-mapw"; w.innerHTML = fdMapBtnHTML("in-bar");
  const r = bar.querySelector(":scope>.dk-pb-r"); if (r) bar.insertBefore(w, r); else bar.appendChild(w);
}
// The page's top bar on a phone is ONE opaque bar: back, the page's name (once the hero has scrolled away), ⋯, and Map at the right. The place pill
// that named the map ("Map", "Similar") is the same door as Map, so it goes; the long-press trail and the pull-down still lead home.
function fdTopBar(scr, name) {
  const hd = scr && scr.querySelector(":scope > .art-top"); if (!hd || hd.querySelector(".art-top-name")) return;
  hd.querySelectorAll("[data-glsimilar]").forEach(b => b.remove());
  if (typeof tlOriginName === "function" && typeof NAV_MAP !== "undefined") hd.querySelectorAll("[data-tl-exit]").forEach(b => { if (tlOriginName() === NAV_MAP) b.remove(); });
  const nm = document.createElement("span"); nm.className = "art-top-name"; nm.textContent = name || "";
  const anchor = hd.querySelector(":scope > [data-fva]") || hd.querySelector(":scope > [data-back]");
  if (anchor) anchor.insertAdjacentElement("afterend", nm); else hd.insertBefore(nm, hd.firstChild);
  hd.insertAdjacentHTML("beforeend", fdMapBtnHTML("in-top"));
}
// bar.fd-stuck (and .screen.fd-stuck): the chip row has reached its pinned place (so the hero is gone and the in-bar Map shows)
function fdStickWire(bar) {
  let raf = 0;
  const run = () => { raf = 0; if (!bar.isConnected) return; const t = parseFloat(getComputedStyle(bar).top) || 0, on = scrollY > 4 && bar.getBoundingClientRect().top <= t + 1.5; if (bar.classList.contains("fd-stuck") !== on) { bar.classList.toggle("fd-stuck", on); const sc = bar.closest(".screen"); if (sc) sc.classList.toggle("fd-stuck", on); } };
  const h = () => { if (!raf) raf = requestAnimationFrame(run); };
  addEventListener("scroll", h, { passive: true }); addEventListener("resize", h);
  cleanup.push(() => { removeEventListener("scroll", h); removeEventListener("resize", h); });
  setTimeout(run, 60);
  fdHideWire(bar);
}
// Hide the pinned stack (top bar + chip row) on scroll down, show it on scroll up (David, 2026-10-25). Phone only; transform only via
// html.fd-hid (css/gallery.css), the safe-area band stays painted (html::before). Never hides on Overview near the top, with a sheet open,
// or when the page is barely longer than the screen.
function fdHideWire(bar0) {
  let bar = bar0;
  const root = document.documentElement;
  let last = scrollY, up = 0, down = 0, hid = false, raf = 0;
  const topBar = () => document.querySelector(".gl-page > .art-top, .aw-page > .art-top, .rp-bar.on");
  const set = on => {
    if (on === hid) return;
    if (on) {
      const a = topBar(); if (!a) return;
      const ah = Math.round(a.getBoundingClientRect().height), bh = Math.round(bar.getBoundingClientRect().height);
      root.style.setProperty("--fd-ah", (a.classList.contains("rp-bar") ? 0 : Math.max(0, ah - 1)) + "px"); root.style.setProperty("--fd-bh", (a.classList.contains("rp-bar") ? ah + bh : bh + 1) + "px");
      root.style.setProperty("--fd-band", a.classList.contains("rp-bar") ? getComputedStyle(a).backgroundColor : "");
    }
    hid = on; root.classList.toggle("fd-hid", on);
  };
  const pinY = () => { const p = bar.parentElement; return p ? p.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(bar).top) || 0) : 0; };
  const run = () => {
    raf = 0; if (!bar.isConnected) bar = document.querySelector(".fd-bar:not(.fd-pre)"); if (!bar) return;
    if (root.classList.contains("desk")) { set(false); return; }
    const y = scrollY, dy = y - last; last = y;
    if (dy > 0) { down += dy; up = 0; } else if (dy < 0) { up -= dy; down = 0; }
    const py = pinY(), about = !!bar.querySelector(".fd-chip.on[data-fc='about'],.fd-chip.on[data-awtab='about'],.fd-chip.on[data-awtab='overview']");
    const long = root.scrollHeight > innerHeight * 1.4, sheetOpen = !!document.querySelector(".sheet");
    if (sheetOpen || !long || y <= py + 24 || (about && y < py + 240)) { set(false); return; }
    if (!hid && down > 12) set(true); else if (hid && up >= 8) set(false);
  };
  const h = () => { if (!raf) raf = requestAnimationFrame(run); };
  addEventListener("scroll", h, { passive: true });
  cleanup.push(() => { removeEventListener("scroll", h); hid = false; root.classList.remove("fd-hid"); });
}

// ---------- the feed ----------
function fdMount(host, o) {
  if (!host || !GAL) return;
  const sub = o.sub || null, isColor = !!sub, i = isColor ? -1 : o.i, d = o.d, G = GAL, SKEY = isColor ? "c:" + sub.hex : i, memo = o.backNav ? FD_MEMO.get(SKEY) : null;
  const CHIPS = o.about ? [["about", "Overview"], ...(isColor ? FDC_CHIPS : FD_CHIPS)] : isColor ? FDC_CHIPS : FD_CHIPS, RANK = isColor ? FDC_RANK : FD_RANK, LEADS = isColor ? FDC_LEAD : FD_LEAD, STORE = isColor ? FDC_ST : FD_ST, FALL = isColor ? "paintings" : "color";
  const st = { ...(memo && memo.chip ? { chip: memo.chip, metric: memo.metric, color: memo.color | 0 } : STORE) };   // re-read from FD_ST when the feed is built (start)   // this page's chip; a Back brings back the chip the feed was left on
  // a painting page with a chip row: whichever tab is on is remembered at once (not only when a tile is tapped), so a Back from a palette color or
  // the painter lands on the same tab (a tile tap overwrites this with the exact position, leave() below)
  const remember = () => { if (o.about && !isColor) FD_MEMO.set(SKEY, { shown: FD_PAGE, ak: -1, ay: 0, chip: st.chip, metric: st.metric, color: st.color }); };
  const save = () => { Object.assign(STORE, st); fdSaveState(); remember(); };
  const ctx = { i, d, o, sub, kind: isColor ? "color" : "painting", key: SKEY, F: typeof XBF !== "undefined" && XBF && XBF.G === GAL ? XBF : null, _q: null, q() { return this._q || (this._q = twQuery(o.cols, { self: i })); } };
  let curRes = null, moreBusy = false, memoFilled = false, lastN = 0, onCount = null, curEnd = "", curMap = "", curLead = "", eff = st.chip, items = [], shown = 0, tok = 0, built = false, gone = false, fk = 0;
  let W = 0, cols = 2, colW = 0, gap = 12, vgap = 18, txt = 52, top = null, col = null, hh = null, ends = [], pinSkew = null, dense = false, capPct = false, zoom = null;
  const VKEY = isColor ? "colorhub-feed-view-color" : "colorhub-feed-view";
  const viewLoad = () => { try { const v = JSON.parse(localStorage.getItem(VKEY) || "null") || {}; return { cols: v.cols | 0, dcols: v.dcols | 0, caps: !!v.caps }; } catch (e) { return { cols: 0, dcols: 0, caps: false }; } };
  const view = viewLoad();
  const viewSave = () => { try { localStorage.setItem(VKEY, JSON.stringify(view)); } catch (e) {} };
  const wide = () => typeof glDesk === "function" && glDesk();
  const live = new Map(), wantShard = new Map();
  const off = k => isColor ? (FDC_OFF.get(SKEY) || {})[k] || "" : (FD_OFF[k] ? FD_OFF[k](ctx) : "");
  const abOf = it => it.sk || it.card || it.head ? it.ab : Math.min(2.3, Math.max(.4, G.ar[it.j]));
  const aboutEl = o.about || null; if (aboutEl) aboutEl.remove();   // the article tab survives the feed being drawn around it
  host.innerHTML = `<div class="sec-head"><b>Keep exploring</b><span>closest first</span></div>
    <div class="fd-bar"><div class="fd-chips" role="tablist" aria-label="What counts as related"></div></div>
    <p class="fd-lead" aria-live="polite"></p>
    <div class="fd-grid" role="group" aria-label="${isColor ? "Paintings and more that hold this color" : "Related paintings, closest first"}"></div>
    <div class="fd-state"></div>`;
  const bar = host.querySelector(".fd-bar"), chipsEl = host.querySelector(".fd-chips"), lead = host.querySelector(".fd-lead"), grid = host.querySelector(".fd-grid"), state = host.querySelector(".fd-state");
  if (aboutEl) bar.insertAdjacentElement("afterend", aboutEl);
  if (isColor && typeof tlOriginName === "function" && typeof NAV_MAP !== "undefined" && tlOriginName() === NAV_MAP) document.querySelectorAll("body > .rp-bar [data-tl-exit], .cp-page .cp-hero [data-tl-exit]").forEach(b => b.remove());   // the "Map" place pill is the same door as the Map button
  fdBarTools(bar); fdStickWire(bar);   // Map rides at the right end of the bar once the page's hero has scrolled away
  const artTop = () => document.querySelector(isColor ? ".rp-bar" : ".gl-page > .art-top");   // the bar the chips sit under: a painting's back bar, or a color page's pinned name bar
  const setBarTop = () => { if (glDesk()) { bar.style.top = ""; return; }   // on a wide window the fixed top bar is the one to sit under (css)
    const a = artTop(); bar.style.top = (a ? Math.round(a.getBoundingClientRect().height) - 1 : 0) + "px"; };

  // ----- the About tab (a color page): the article is the first chip; the feed's own parts hide while it shows -----
  const secHead = host.querySelector(".sec-head");
  if (aboutEl && secHead) secHead.remove();   // its heading words are hidden on a color page, and the tools now ride in the bar
  const showAbout = on => { if (!aboutEl) return; aboutEl.hidden = !on; lead.hidden = on; grid.hidden = on; state.hidden = on; if (secHead) secHead.hidden = on; host.dataset.fdTab = on ? "about" : eff; };
  // a tab change keeps the chips where they are: if you had scrolled below the top of this section, it lands on its top
  const pinY = () => { const a = artTop(), ah = glDesk() || !a ? 0 : a.getBoundingClientRect().height; return Math.max(0, Math.round(host.getBoundingClientRect().top + scrollY - ah)); };   // the scroll at which the chip row sits pinned at the top
  const tabTop = force => { const y = pinY(); if (force || scrollY > y + 4) scrollTo(0, y); };
  const pinTabs = () => {
    scrollTo({ top: pinY(), behavior: reduceMotion ? "auto" : "smooth" });
    let moved = false; const q = () => { moved = true; }; addEventListener("touchstart", q, { once: true, passive: true }); addEventListener("wheel", q, { once: true, passive: true });
    setTimeout(() => { removeEventListener("touchstart", q); removeEventListener("wheel", q); if (!gone && !moved && Math.abs(scrollY - pinY()) > 3) scrollTo(0, pinY()); }, 560);
  };
  // a door from the page (js/richcolor.js): open a feed tab, on a chosen decade (Era: 188 = the 1880s) or country (Place: its 1-based index)
  host.fdOpen = (k, pick) => {
    if (off(k)) { toast(off(k)); return; }
    const was = eff;
    st.chip = k; st.color = pick | 0; save(); buzz(4);
    if (was === "about") showAbout(false);
    rerank(false); tabTop(true); setTimeout(() => tabTop(true), 60); setTimeout(() => tabTop(true), 400);
  };
  host.fdChip = k => { const b = chipsEl.querySelector(`[data-fc="${k}"]`); if (b) b.click(); };

  // ----- chips -----
  const effective = () => { const k = st.chip; return !off(k) ? k : FALL; };
  const chipsDraw = () => {
    eff = effective();
    const sheetOn = !!document.querySelector(".fs-sheet");
    chipsEl.innerHTML = CHIPS.map(([k, t]) => {
      const dis = !!off(k), on = k === eff, tune = on && k !== "about", lab = !isColor && k === "color" && on && st.metric !== "overall" ? `Color · ${FD_SHORT[st.metric]}` : t;   // the by… switch: Overall is the default, so it needs no word
      return `<button class="fd-chip${on ? " on" : ""}${tune && sheetOn ? " fd-open" : ""}${dis ? " dis" : ""}" role="tab" data-fc="${k}" aria-selected="${on}"${dis ? ` aria-disabled="true"` : ""}${tune ? ` aria-haspopup="dialog" aria-label="${esc(t)}, settings"` : ""}>${lab}${tune ? `<span class="fd-tune" aria-hidden="true">${FD_ICON_TUNE}</span><i class="fd-dot" hidden></i>` : ""}</button>`;
    }).join("");
    SUBDOT();
  };
  const leadDraw = (reason) => {
    const miss = st.chip !== eff ? off(st.chip) : "";   // the chip you chose can't work for this painting: say why, and what you are seeing instead
    const t = reason || (miss ? miss + (isColor ? " Showing paintings instead." : " Showing color instead.") : curLead || (LEADS[eff] ? LEADS[eff](st.metric) : ""));
    lead.textContent = t; lead.classList.toggle("why", !!(reason || miss));
  };
  // Settings are the active chip tapped again (David, 2026-10-25); any other chip switches tab and brings the chip row to the top of the screen,
  // so the feed fills it (Overview: the top of the article, just under the chips)
  const closeSettings = () => { const x = document.querySelector(".sheet.fs-half .fs-x"); if (x) x.click(); };
  const toggleSettings = () => { if (document.querySelector(".sheet.fs-half")) { buzz(4); closeSettings(); } else { buzz(4); openSettings(); } };
  chipsEl.onclick = e => {
    const b = e.target.closest("[data-fc]"); if (!b) return;
    const k = b.dataset.fc, why = off(k);
    if (why) { buzz(4); leadDraw(why); return; }
    if (k === eff) { if (k === "about") { pinTabs(); return; } return toggleSettings(); }
    closeSettings();
    if (aboutEl && k === "about") { st.chip = "about"; save(); buzz(4); chipsDraw(); showAbout(true); pinTabs(); return; }
    if (aboutEl && eff === "about") showAbout(false);
    st.chip = k; if (isColor) st.color = 0; save(); buzz(4); rerank(false); pinTabs();
  };

  // ----- Color's metric switch (js/twins.js): a block inside that tab's Settings -----
  const metricHTML = () => {
    const q = ctx.q(), canLayout = !!(o.img && o.img() && twReadable(o.img()));
    const rows = TW_METRICS.filter(([k]) => k !== "layout" || canLayout).map(([k, t]) => {
      const nope = k === "accents" && !q.accents.length;
      return `<button class="fd-opt${k === st.metric ? " on" : ""}" data-m="${k}"${nope ? " disabled" : ""} role="radio" aria-checked="${k === st.metric}"><b>${t}</b><span>${nope ? "This painting has no small vivid colors" : FD_METRIC_HELP[k]}</span></button>`;
    }).join("");
    return `<div class="fs-c"><div class="fs-row"><p>Match color by</p></div><div class="fd-opts" role="radiogroup" aria-label="How colors are matched">${rows}</div>
      <div class="fd-pick" ${st.metric === "color" ? "" : "hidden"}><span>Which color?</span>${q.pool.slice(0, 6).map((p, k) => `<button data-pick="${k}" class="${k === st.color ? "on" : ""}" style="--c:${p.h}" aria-label="${esc(nameOf(p.h).n)}" aria-pressed="${k === st.color}"></button>`).join("")}</div></div>`;
  };
  const metricClick = (e, sh) => {
    const p = e.target.closest("[data-pick]"), b = e.target.closest("[data-m]");
    if (p) { st.metric = "color"; st.color = +p.dataset.pick; sh.querySelectorAll("[data-pick]").forEach(x => { x.classList.toggle("on", x === p); x.setAttribute("aria-pressed", x === p); }); }
    else if (b && !b.disabled) { st.metric = b.dataset.m; sh.querySelectorAll("[data-m]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); sh.querySelector(".fd-pick").hidden = st.metric !== "color"; }
    else return false;
    st.chip = "color"; save(); buzz(4); chipsDraw(); rerank(false); return true;
  };

  // ----- layout (a masonry whose boxes are known from the index before anything loads) -----
  const colsFor = w => { const want = wide() ? view.dcols : view.cols; return want >= 1 ? Math.min(fdMaxCols(), want) : w < 560 ? 3 : w < 860 ? 3 : wide() && w >= 900 ? Math.max(5, Math.min(8, Math.floor(w / 230))) : Math.max(3, Math.min(5, Math.floor((w + 14) / 254))); };   // a wide window: edge to edge, 5 to 8 across by its width (1440 -> 6, 1920 -> 8)
  const sizeDraw = () => { const b = host.querySelector("[data-fdsize]"); if (!b) return; b.textContent = `${cols} across`; b.setAttribute("aria-label", `Size: ${cols} across. Tap for another size, or pinch.`); };
  const bare = () => !view.caps;
  const dense0 = () => false;   // every grid is edge to edge, pictures first (David, 2026-10-25); the byline only adds a line under each
  const relayout = () => {
    grid.classList.add("bare");
    W = grid.clientWidth || Math.min(innerWidth, 540) - 40;
    cols = colsFor(W); [gap, vgap] = fdGapsFor(cols, W);
    colW = (W - gap * (cols - 1)) / cols;
    if (!dense0()) { gap = 2; vgap = bare() ? 2 : 6; colW = (W - gap * (cols - 1)) / cols; }
    dense = (cols >= 5 && colW < 150) || colW < FD_DENSE_W;   // 5+ across on a phone; a wide window's 5 across still has room for words
    txt = bare() ? 0 : dense ? (capPct ? 28 : 0) : 22; grid.classList.toggle("narrow", !dense && !bare() && colW < 146);   // a 320 px screen: the caption may take two lines, so the number is never cut off
    grid.classList.toggle("dense", dense); grid.classList.toggle("nocap", bare() || (dense && !capPct)); sizeDraw();
    top = new Float32Array(items.length); col = new Uint8Array(items.length); hh = new Float32Array(items.length);
    ends = new Array(cols).fill(0);
    place(0);
  };
  const keepCap = it => it.card || /^(Used most|Also used) by|^\d{3}0s$/.test(it.cap || "") || (isColor && !!it.cap && !/%/.test(it.cap));   // a color page's plain-words captions (a country, a painter, a decade) stay
  const txOf = it => !txt || dense ? txt : keepCap(it) ? (colW < 146 ? 72 : 50) : txt;   // a tile with no caption line (Vibe, "Also ...") keeps just its byline
  const place = k0 => {
    if (top && top.length < items.length) {   // the list grew (a next page was appended): the position arrays must too, or the new tiles get no place
      const cap = Math.ceil(items.length * 1.5), grow2 = (A, T) => { const B = new T(cap); B.set(A); return B; };
      top = grow2(top, Float32Array); col = grow2(col, Uint8Array); hh = grow2(hh, Float32Array);
    }
    for (let k = k0; k < shown; k++) {
      if (items[k].head) { const t = Math.max(...ends), h = items[k].sub ? 44 : 60; top[k] = t; col[k] = 0; hh[k] = h; ends.fill(t + h + vgap); continue; }   // a divider or a group's name: the full width, below everything above it
      const h = Math.round(colW * abOf(items[k])) + txOf(items[k]); hh[k] = h;
      let c = 0; for (let j = 1; j < cols; j++) if (ends[j] < ends[c]) c = j;
      top[k] = ends[c]; col[k] = c; ends[c] += h + vgap;
    }
    grid.style.height = (shown ? Math.max(...ends) - vgap : 0) + "px";
  };
  const gridTop = () => grid.getBoundingClientRect().top + scrollY;

  // ----- tiles -----
  const domOf = j => { let b = 0; for (let y = 1; y < 6; y++) if (G.sh[j * 6 + y] > G.sh[j * 6 + b]) b = y; return glHex(j, b); };
  const capOf = it => dense ? fdPctOnly(it.cap) : keepCap(it) ? it.cap : "";   // no percents or tab words under a tile: just painter and year (David, 2026-10-25)
  function tileHTML(k) {
    const it = items[k], pos = `left:${col[k] * (colW + gap)}px;top:${top[k]}px;width:${colW}px;height:${hh[k]}px`;
    if (it.head) return `<div class="fd-head${it.sub ? " sub" : ""}" style="top:${top[k]}px;height:${hh[k]}px"${it.sub ? ` role="heading" aria-level="3"` : ` role="separator" aria-label="${esc(it.text)}"`}>${it.sub ? `<i style="--c:${it.h}"></i>` : ""}<span>${esc(it.text)}</span></div>`;
    if (it.card) return `<button class="fd-tile fd-card" data-fk="${k}" tabindex="${k === fk ? 0 : -1}" style="${pos}" aria-label="${esc(it.title + ". " + it.cap + (it.sub ? ", " + it.sub : ""))}"><span class="fd-im" data-ink="${ink(it.h)}" style="--c:${it.h};height:${hh[k] - txOf(it)}px"><span class="fd-ct" style="color:${ink(it.h) === "dark" ? "#141311" : "#fff"}">${esc(it.title)}</span></span><span class="fd-cap">${esc(capOf(it))}</span><span class="fd-by"><span>${esc(it.sub || "")}</span></span></button>`;
    if (it.sk) return `<div class="fd-tile sk" style="${pos}" aria-hidden="true"><span class="fd-im" style="height:${hh[k] - txOf(it)}px"></span><span class="fd-cap"></span><span class="fd-by"></span></div>`;
    return `<button class="fd-tile wait" data-fk="${k}" tabindex="${k === fk ? 0 : -1}" style="${pos}"><span class="fd-im" style="--c:${domOf(it.j)};height:${hh[k] - txOf(it)}px"><span class="fd-ov"></span></span><span class="fd-cap">${esc(capOf(it))}</span><span class="fd-by"></span></button>`;
  }
  function fillCard(el, k) {   // a thing that isn't a painting (a gem, a film, a color): its own color is the tile; a photo covers it when there is one
    const it = items[k]; if (!it.img || el.querySelector("img")) return;
    const im = el.querySelector(".fd-im"), img = document.createElement("img"); img.alt = ""; img.decoding = "async"; img.draggable = false; img.referrerPolicy = "no-referrer";
    img.onload = () => { img.classList.add("ld"); im.classList.add("has-img"); }; img.onerror = () => img.remove();
    img.src = it.img; im.insertBefore(img, im.firstChild);
  }
  let badT = 0, okImgs = 0, droppedN = 0; const failed = new Set();
  function dropBad(k) {
    const it = items[k]; if (!it || it.bad || droppedN >= 60) return; it.bad = 1; droppedN++;
    clearTimeout(badT); badT = setTimeout(() => {
      if (gone) return;
      for (let q = items.length - 1; q >= 0; q--) if (items[q].bad) { items.splice(q, 1); if (q < shown) shown--; }
      lastN = items.filter(x => !x.head).length; if (onCount) onCount(lastN);
      fk = Math.min(fk, Math.max(0, items.length - 1)); relayoutAll(); stateDraw(); if (!items.some(x => !x.head)) state.innerHTML = `<p class="fd-end">None of these pictures could be loaded just now.</p>`;
    }, 400);
  }
  function fill(el, k) {   // title, byline and picture, once this painting's shard is in
    const it = items[k], dd = glDetailNow(it.j); if (!dd || !el.isConnected || !el.classList.contains("wait")) return;
    el.classList.remove("wait");
    const title = dd.t, who = dd.a || dd.co || "";
    el.setAttribute("aria-label", `${title}${who ? ", " + who : ""}. ${it.cap}`);
    el.querySelector(".fd-by").innerHTML = it.byTitle ? `<span>${esc(title)}</span>${glYear(it.j) ? `<em> · ${esc(glYear(it.j))}</em>` : ""}` : glByline(it.j, dd);   // "Also Monet" already names the painter: the line below gives the picture's title instead
    el.querySelector(".fd-ov").innerHTML = `<b>${esc(title)}</b><small>${esc(who)}${glYear(it.j) ? " · " + esc(glYear(it.j)) : ""}</small>`;
    el.dataset.pk = `${title}\n${who}${glYear(it.j) ? " · " + glYear(it.j) : ""}\n${it.cap}`;   // what a long-press shows when the tile is too small to say it
    const im = el.querySelector(".fd-im"), img = document.createElement("img"), mid = glSized(dd.img, "mid");
    img.alt = ""; img.decoding = "async"; img.draggable = false;
    const crop = glCropStyle(it.j, dd, abOf(it)), mm = /style="([^"]*)"/.exec(crop); if (mm) img.style.cssText = mm[1];
    if (k < 8) img.fetchPriority = "high";
    img.onload = () => { img.classList.add("ld"); okImgs++; if (okImgs >= 8 && failed.size) { failed.forEach(dropBad); failed.clear(); } };
    img.onerror = () => {
      if (img.src !== mid && !img.dataset.retry) { img.dataset.retry = 1; img.src = mid; return; }
      img.remove(); im.classList.add("err");   // a picture that never comes: its tile is taken out of the list once any other picture has loaded (so it is a broken link, not a lost connection), never shown as words
      failed.add(k); if (okImgs >= 8) dropBad(k);
    };
    img.src = fdSrc(dd, colW);
    im.insertBefore(img, im.firstChild);
  }
  function want(k) { if (items[k].card || items[k].head) return; const s = Math.floor(items[k].j / G.shard); if (!wantShard.has(s)) wantShard.set(s, []); wantShard.get(s).push(k); }
  function shards(ks) {
    ks.forEach(want);
    wantShard.forEach((list, s) => {
      wantShard.delete(s);
      if (!FD_SHARDS.includes(s)) FD_SHARDS.push(s);
      glShard(s).then(() => list.forEach(k => { const el = live.get(k); if (el) fill(el, k); }), () => { list.forEach(k => { const el = live.get(k); if (el && !el.querySelector(".fd-err")) { el.classList.remove("wait"); el.querySelector(".fd-im").classList.add("err"); el.querySelector(".fd-im").insertAdjacentHTML("beforeend", `<span class="fd-err">Didn't load</span>`); } }); });
    });
  }
  const liveShards = () => new Set([...live.keys()].filter(k => items[k] && !items[k].sk && !items[k].card && !items[k].head).map(k => Math.floor(items[k].j / G.shard)).concat(isColor ? [] : [Math.floor(i / G.shard)]));
  function draw() {
    if (gone || !grid.isConnected || !shown || !top) return;
    const cw = grid.clientWidth; if (cw > 40 && Math.abs(cw - W) > 1) { relayoutAll(); return; }
    const r = grid.getBoundingClientRect(), dn = cols >= 5, y0 = -r.top - innerHeight * (dn ? .5 : .7), y1 = -r.top + innerHeight * (dn ? 1.4 : 1.7), liveMax = fdLiveMax(cols);
    let lo = 0, hi = shown;
    while (lo < hi) { const m = (lo + hi) >> 1; if (top[m] < y0 - 900) lo = m + 1; else hi = m; }
    let wantSet = [], last = lo;
    for (let k = lo; k < shown && top[k] <= y1; k++) { if (top[k] + hh[k] >= y0) wantSet.push(k); last = k; }
    if (wantSet.length > liveMax) {   // never more than the budget of live pictures (40, more as the tiles shrink): keep the ones nearest the middle of the screen
      const mid = -r.top + innerHeight / 2; wantSet.sort((a, b) => Math.abs(top[a] + hh[a] / 2 - mid) - Math.abs(top[b] + hh[b] / 2 - mid)); wantSet = wantSet.slice(0, liveMax);
    }
    const ws = new Set(wantSet);
    live.forEach((el, k) => { if (!ws.has(k)) { const im = el.querySelector("img"); if (im) im.removeAttribute("src"); el.remove(); live.delete(k); } });
    const add = wantSet.filter(k => !live.has(k)).sort((a, b) => a - b);
    if (add.length) {
      const tmp = document.createElement("div"); tmp.innerHTML = add.map(tileHTML).join("");
      const waiting = [];
      [...tmp.children].forEach((el, n) => { const k = add[n]; live.set(k, el); grid.appendChild(el); if (items[k].head) {} else if (items[k].card) fillCard(el, k); else if (!items[k].sk) { if (glDetailNow(items[k].j)) fill(el, k); else waiting.push(k); } });
      if (waiting.length) shards(waiting);
    }
    // the roving tab stop: the tile that last had focus, else the first one on screen
    const tabbable = [...live.keys()].filter(k => !items[k].head);
    if (!live.has(fk)) { const f = Math.min(...tabbable); live.forEach((el, k) => { if (!items[k].head) el.tabIndex = k === f ? 0 : -1; }); } else live.forEach((el, k) => { if (!items[k].sk && !items[k].head) el.tabIndex = k === fk ? 0 : -1; });
    // the next few tiles' details, so they are ready before they arrive
    const nx = []; for (let k = last + 1; k < Math.min(shown, last + 13); k++) if (!items[k].sk && !items[k].card && !items[k].head) { const s = Math.floor(items[k].j / G.shard); if (!Array.isArray(GL_SHARDS.get(s))) nx.push(k); }
    if (nx.length) { nx.forEach(k => { const s = Math.floor(items[k].j / G.shard); if (!FD_SHARDS.includes(s)) FD_SHARDS.push(s); glShard(s).catch(() => {}); }); }
    fdTrim(liveShards());
    // near the end of what is shown: 24 more (the boxes are known from the index, so nothing moves)
    const nearEnd = r.bottom - innerHeight < innerHeight * (dn ? 1.1 : 1.6);
    if (nearEnd && shown < items.length) grow();
    if (nearEnd && items.length - shown < FD_PAGE * 2) fetchMore();   // the list never ends: the next page of less close paintings is asked for before it is needed
  }
  function more() { const k0 = shown; shown = Math.min(items.length, shown + FD_PAGE * Math.max(1, Math.ceil(cols / 2))); place(k0); stateDraw(); }   // a page is 24 tiles at 2 across, more as they shrink, so one page always fills a screen   // 24 more tiles: only their boxes, appended below
  function grow() { more(); requestAnimationFrame(draw); }
  function relayoutAll() { const keep = shown; live.forEach(el => el.remove()); live.clear(); relayout(); shown = keep; draw(); }
  // the next page of the ranking (res.next, above): appended to the same list, so the feed only ever ends when nothing is left to rank
  function fetchMore() {
    const res = curRes; if (!res || !res.next || res.moreDone || moreBusy || gone) return;
    moreBusy = true; const mine = tok;
    Promise.resolve().then(() => res.next()).catch(() => { res.moreDone = true; }).then(() => {
      moreBusy = false; if (gone || mine !== tok || res !== curRes) return;
      lastN = Math.max(lastN, items.filter(x => !x.head).length); stateDraw(); draw();
    });
  }
  function stateDraw() {
    if (!items.length || items[0].sk) { state.innerHTML = ""; return; }
    const moreComing = !!(curRes && curRes.next && !curRes.moreDone);
    state.innerHTML = shown >= items.length && !moreComing ? (isColor ? `<p class="fd-end">${esc(curEnd || "That is everything close to this color.")}</p>${fdChanged() ? `<button class="fd-up" data-fdreset>Reset the settings</button>` : ""}<button class="fd-up" data-fdup>Back to the top of this color</button>` : `<p class="fd-end">${esc(curEnd || "That is everything close to this one.")}</p>${curMap ? `<button class="fd-up" data-pmap="${esc(curMap)}">See them on the map</button> ` : ""}<button class="fd-up" data-fdup>Back to this painting</button>`) : "";
  }
  state.onclick = e => {
    if (e.target.closest("[data-fdup]")) { buzz(4); scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); return; }
    if (e.target.closest("[data-fdalt]")) { st.metric = "overall"; save(); buzz(4); chipsDraw(); rerank(true); return; }
    if (e.target.closest("[data-fdretry]")) { buzz(4); rerank(false); }
  };

  // ----- ranking -----
  const SK = [1.3, .78, 1.0, 1.45, .9, 1.2, .85, 1.1];
  function skeleton() {
    items = SK.map(ab => ({ sk: 1, ab })); shown = items.length; fk = 0; live.forEach(el => el.remove()); live.clear(); relayout(); state.innerHTML = ""; draw();
  }
  const key = () => `${SKEY}|${eff}|${st.metric}|${st.color}${isColor ? "|" + fdsSig(eff) : ""}`;
  function apply(res, ms) {
    if (res.empty) {
      curLead = ""; items = []; shown = 0; live.forEach(el => el.remove()); live.clear(); grid.style.height = "0px";
      state.innerHTML = `<p class="fd-empty">${esc(res.empty)}</p>${res.alt ? `<button class="fd-up" data-fdalt>Match by overall palette</button>` : ""}${res.reset ? `<button class="fd-up" data-fdreset>Reset the settings</button>` : ""}`;
      leadDraw(""); return;
    }
    curRes = res; curLead = res.lead || ""; curEnd = res.end || ""; curMap = res.map || ""; items = res.items; if (!items.length) { apply({ empty: "Nothing else in the archive is close to this one in that way." }); return; }
    live.forEach(el => el.remove()); live.clear(); lastN = res.n != null ? res.n : items.filter(x => !x.head).length; if (onCount) onCount(lastN);
    capPct = false;   // David, 2026-10-24: zoomed out, the percent under each tile "looks ugly": dense tiles are bare pictures (a long-press still shows everything)
    const want0 = memo ? memo.shown : FD_PAGE;
    shown = Math.min(items.length, Math.max(FD_PAGE, want0)); fk = Math.max(0, items.findIndex(x => !x.head));
    relayout(); stateDraw(); leadDraw(""); draw();
    if (eff === "vibe" && !isColor) fdVibeMark();   // the one-line explainer is shown once, the first time Vibe is on screen
    FD_LAST = { chip: eff, metric: st.metric, ms: Math.round(ms), n: items.length };
  }
  function rerank(scrollUp) {
    const mine = ++tok, was = scrollUp && built && gridTop() < scrollY + 80;   // you were down in the old list: land at the new first tile, just under the chips
    chipsDraw(); leadDraw("");
    if (aboutEl && eff === "about") { tok++; showAbout(true); return; }
    showAbout(false);
    const k = key(), hit = FD_CACHE.get(k), t0 = performance.now();
    const done = res => {
      if (mine !== tok || gone) return;
      // a Back to a list that was opened far down: ask for pages until it is as long as it was, so the tile you left is there to land on
      if (memo && !memoFilled && res.next && !res.moreDone && res.items && res.items.length < memo.shown) {
        memoFilled = true;
        (async () => { while (res.items.length < Math.min(memo.shown, 6000) && !res.moreDone) { try { await res.next(); } catch (e) { res.moreDone = true; } if (mine !== tok || gone) return; } done(res); })();
        return;
      }
      if (res.items) { FD_CACHE.set(k, res); if (FD_CACHE.size > 24) FD_CACHE.delete(FD_CACHE.keys().next().value); }
      if (!isColor && res.empty && eff === "vibe" && ctx.vibeOff) { chipsDraw(); return rerank(false); }   // no vibe for this painting: the chip goes dim with the reason, and Color shows instead
      if (isColor && res.empty && eff !== FALL && !res.alt && !res.reset) { fdcOff(SKEY, eff, res.empty); chipsDraw(); return rerank(false); }   // this chip has nothing for this color: it is disabled from now on, with the reason, and Paintings shows instead
      apply(res, performance.now() - t0);
      if (was) scrollTo(0, Math.max(0, gridTop() - bar.getBoundingClientRect().height - (artTop() ? artTop().getBoundingClientRect().height : 0) - 8));
      afterBuild();
    };
    if (hit) return done(hit);
    skeleton(); state.innerHTML = "";
    const run = () => Promise.resolve().then(() => RANK[eff](ctx, { metric: st.metric, color: st.color })).then(done, e => {
      if (mine !== tok || gone) return;
      items = []; shown = 0; live.forEach(el => el.remove()); live.clear(); grid.style.height = "0px";
      state.innerHTML = `<p class="fd-empty">That didn't load. Check your connection and try again.</p><button class="fd-up" data-fdretry>Try again</button>`;
    });
    if (memo) run(); else setTimeout(run, 24);   // let the skeleton paint first (a Back builds it at once)
  }
  // once the feed is up: the facets, loaded quietly, decide whether Painter and Place apply to this painting
  let facetsAsked = false, vibeAsked = false;
  function afterBuild() {
    if (isColor) { if (!facetsAsked) { facetsAsked = true; setTimeout(() => fdcProbe(ctx).then(() => { if (!gone) { const was = eff; chipsDraw(); if (was !== eff) rerank(false); } }), 600); } return; }
    if (!vibeAsked && typeof vibeNeighbors === "function") { vibeAsked = true; setTimeout(() => vibeNeighbors(i, 1).then(r => { if (gone || r.length) return; ctx.vibeOff = true; const was = eff; chipsDraw(); if (was !== eff) rerank(false); }), 500); }
    if (facetsAsked || ctx.F) return; facetsAsked = true;
    setTimeout(() => xbLoad().then(F => { if (gone || F.G !== GAL) return; ctx.F = F; const was = eff; chipsDraw(); if (was !== eff) rerank(false); }).catch(() => {}), 700);
  }

  // ----- zoom: pinch, trackpad pinch, ctrl+wheel and + / - (js/gridzoom.js, the same module as the painter page's grid) -----
  // the density changes with the tile under (fx, fy) kept exactly where it is (toY: where it should end up, when the fingers have moved)
  const setCols = (c, fx, fy, toY) => {
    c = Math.max(1, Math.min(fdMaxCols(), c)); if (c === cols || !shown) return false;
    const r = grid.getBoundingClientRect(), vy = fy == null ? innerHeight / 2 : fy, y = vy - r.top, x = (fx == null ? W / 2 : fx) - r.left;
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / (colW + gap))));
    let a = Math.max(0, items.findIndex(z => !z.head)); for (let k = 0; k < shown; k++) if (!items[k].head && col[k] === cx && top[k] <= y) a = k;
    const frac = hh[a] ? Math.max(0, Math.min(1, (y - top[a]) / hh[a])) : 0;
    if (wide()) view.dcols = c; else view.cols = c; viewSave();
    relayoutAll();
    const r2 = grid.getBoundingClientRect(); scrollBy(0, r2.top + top[a] + frac * hh[a] - (toY == null ? vy : toY));
    draw(); return true;
  };
  // a tile too small to say anything: a long press shows its title, painter, year and the whole caption
  let peekEl = null, peekT = 0, peekXY = null, peeked = 0;
  const peekOff = () => { clearTimeout(peekT); if (peekEl) { peekEl.remove(); peekEl = null; } };
  grid.addEventListener("pointerdown", e => {
    const t = e.target.closest(".fd-tile[data-fk]"); if (!t || e.isPrimary === false) return;
    peekXY = [e.clientX, e.clientY]; clearTimeout(peekT);
    peekT = setTimeout(() => {
      if (!t.dataset.pk) return; const q = t.getBoundingClientRect(); peeked = Date.now(); buzz(5);
      peekEl = document.createElement("div"); peekEl.className = "fd-peek"; peekEl.setAttribute("role", "status");
      const [a, b, c] = t.dataset.pk.split("\n"); peekEl.innerHTML = `<b>${esc(a)}</b><span>${esc(b)}</span><em>${esc(c)}</em>`;
      document.body.appendChild(peekEl);
      const w = peekEl.offsetWidth, h = peekEl.offsetHeight, x = Math.max(8, Math.min(innerWidth - w - 8, q.left + q.width / 2 - w / 2)), y = q.top - h - 8 >= 8 ? q.top - h - 8 : q.bottom + 8;
      peekEl.style.left = x + "px"; peekEl.style.top = y + "px";
    }, 420);
  });
  grid.addEventListener("pointermove", e => { if (peekXY && Math.hypot(e.clientX - peekXY[0], e.clientY - peekXY[1]) > 8) { peekXY = null; if (!peekEl) clearTimeout(peekT); } });
  ["pointerup", "pointercancel"].forEach(ev => addEventListener(ev, () => { peekXY = null; clearTimeout(peekT); if (peekEl) setTimeout(peekOff, 900); }));
  addEventListener("scroll", peekOff, { passive: true });
  grid.addEventListener("contextmenu", e => { if (e.target.closest(".fd-tile")) e.preventDefault(); });

  // ----- keys, taps, position -----
  grid.onclick = e => {
    if (Date.now() - peeked < 700) { e.preventDefault(); return; }   // the tap that ended a long-press is not an open
    const t = e.target.closest(".fd-tile[data-fk]"); if (!t) return;
    const it = items[+t.dataset.fk]; buzz(6); leave(); if (it.card) it.open(); else galleryPage(it.j, true, isColor ? sub.hex : null);
  };
  grid.addEventListener("focusin", e => { const t = e.target.closest(".fd-tile[data-fk]"); if (t) fk = +t.dataset.fk; });
  function focusK(n) {
    if (n < 0 || n >= items.length) return;
    while (n >= shown && shown < items.length) more();
    const y = gridTop() + top[n], vh = innerHeight, bh = bar.getBoundingClientRect().height + (artTop() ? artTop().getBoundingClientRect().height : 0);
    if (y < scrollY + bh + 8 || y + hh[n] > scrollY + vh - 8) scrollTo(0, Math.max(0, y - vh / 2 + hh[n] / 2));
    fk = n; draw(); const el = live.get(n); if (el) el.focus({ preventScroll: true });
  }
  grid.addEventListener("keydown", e => {
    const t = e.target.closest(".fd-tile[data-fk]"); if (!t) return;
    const k = +t.dataset.fk; let n = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { const s = e.key === "ArrowDown" ? 1 : -1; for (let m = k + s; m >= 0 && m < items.length && Math.abs(m - k) <= cols * 6; m += s) { while (m >= shown && shown < items.length) more(); if (col[m] === col[k] && !items[m].head) { n = m; break; } } }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const c = col[k] + (e.key === "ArrowRight" ? 1 : -1); if (c < 0 || c >= cols) return;
      const mid = top[k] + hh[k] / 2; let best = 1e9;
      for (let m = Math.max(0, k - cols * 4); m < Math.min(shown, k + cols * 4); m++) if (col[m] === c && !items[m].head) { const dd = Math.abs(top[m] + hh[m] / 2 - mid); if (dd < best) { best = dd; n = m; } }
    } else if (e.key === "Home") n = Math.max(0, items.findIndex(x => !x.head));
    if (n < 0) return;
    e.preventDefault(); focusK(n);
  });
  // leaving for a tile: remember how far the feed was opened and which tile was at the top of the screen, so Back can put it back exactly
  function leave() {
    const bh = bar.getBoundingClientRect().bottom; let ak = -1, ay = 0;
    live.forEach((el, k) => { const r = el.getBoundingClientRect(); if (r.bottom > bh && (ak < 0 || k < ak)) { ak = k; ay = r.top; } });
    FD_MEMO.set(SKEY, { shown, ak, ay, chip: st.chip, metric: st.metric, color: st.color });
  }
  // coming Back: the tile that was at ay is put at ay again, whatever above it has grown or shrunk since (the page above loads for a moment)
  function pin() {
    if (!memo || memo.ak < 0) return;
    let n = 0, stop = false, ro = null; const quit = () => { stop = true; if (ro) ro.disconnect(); };
    addEventListener("touchstart", quit, { once: true, passive: true }); addEventListener("wheel", quit, { once: true, passive: true }); addEventListener("keydown", quit, { once: true });
    const set = () => {
      if (stop || gone || !items.length || items[0].sk || memo.ak >= shown) return;   // (the ranking may not have landed yet: a cache miss)
      const y = gridTop() + top[memo.ak] - memo.ay;
      if (y > 0) { try { SCROLL_BY_HASH.set(ROUTE_NOW, y); } catch (e) {} if (Math.abs(scrollY - y) > 2) scrollTo(0, y); draw(); }
    };
    const tick = () => { if (stop || gone || ++n > 60) return quit(); set(); setTimeout(tick, 100); };
    // anything above the feed that grows or shrinks while the page settles moves the tile: re-pin on every height change
    try { ro = new ResizeObserver(set); ro.observe(document.documentElement); } catch (e) {}
    tick();
  }

  // ----- Settings and the Feed / Map lens -----
  const sizeWord = n => n === 1 ? "1 across, big" : `${n} across`;
  const TOLW = ["", "Exact", "Exact", "Nearly exact", "Very close", "Very close", "Close", "Close", "Close", "Close", "Fairly close", "Fairly close", "Loose", "Loose", "Loose", "Loose", "Very loose", "Very loose", "Very loose", "Its whole family", "Its whole family"];
  const REACHW = ["Just this country", "Its neighbors", "Its region", "Its continent", "The whole world"];
  const fdChanged = () => isColor ? fdsChanged(eff) : eff === "color" && st.metric !== "overall";
  const SUBDOT = () => { const d = chipsEl.querySelector(".fd-dot"); if (d) d.hidden = !fdChanged(); };   // the active chip's mark that its Settings are not the defaults
  // Map: the same list as the painting map, the painting nearest the top of the screen in the middle, the same choices as filters
  const topPainting = () => {
    const bh = bar.getBoundingClientRect().bottom; let ak = -1;
    live.forEach((el, k) => { const r = el.getBoundingClientRect(); if (!items[k].head && !items[k].card && r.bottom > bh && (ak < 0 || k < ak)) ak = k; });
    if (ak < 0) ak = items.findIndex(x => !x.head && !x.card);
    return ak >= 0 ? items[ak].j : -1;
  };
  async function openMap() {
    if (typeof pmGo !== "function") return;
    let seed = topPainting();
    if (seed < 0 && isColor) { const b0 = await fdcBase(sub).catch(() => null); if (b0 && b0.rows.length) seed = b0.rows[0].i; }   // Overview (no list on screen): this color's own paintings
    if (seed < 0 && !isColor) seed = i;
    if (seed < 0) return;
    let spec = `arr=spiral&seed=${seed}`;
    if (!isColor) {   // the arrangement follows the tab: Vibe -> By look, centered on this painting; Painter -> this painter's paintings; Era -> its years; Place -> its country
      const y = G.year[i];
      if (eff === "vibe" && curMap) spec = curMap;
      else if (eff === "painter" && d && d.a) spec = `arr=spiral&seed=${i}&p=${routeSlug(d.a)}`;
      else if (eff === "era" && y !== GL_UNDATED) spec = `arr=spiral&seed=${i}&y0=${y - 25}&y1=${y + 25}`;
      else if (eff === "place") { const F = await fdFacets().catch(() => null); const c = F && F.country[i]; if (c) spec = `arr=spiral&seed=${i}&co=${encodeURIComponent(F.meta.countries[c - 1])}`; }
      else spec = `arr=spiral&seed=${i}`;
    }
    if (isColor) {
      if (eff === "painters") {   // the painters on the list: the map filtered to them
        const F0 = await fdFacets().catch(() => null), slugs = [];
        if (F0) items.forEach(it => { if (it.j == null || it.head || it.card) return; const a = F0.artist[it.j]; if (a && F0.meta.artists[a - 1]) { const sl = routeSlug(F0.meta.artists[a - 1][0]); if (!slugs.includes(sl)) slugs.push(sl); } });
        if (slugs.length) spec += `&p=${slugs.slice(0, 24).join(",")}`;
      }
      const S = FDS.paintings, win = FDS.era.win, y = G.year[seed];
      spec += `&c=${sub.hex.slice(1).toLowerCase()}&cm=all&t=${eff === "paintings" ? Math.max(2, S.tol) : 8}&m=0&nm=${encodeURIComponent(sub.tapped && typeof rpYoursName === "function" ? rpYoursName(sub.name, sub.hex, sub.tapped) : sub.name)}`;
      if (eff === "paintings" && (S.y0 > 1300 || S.y1 < 2000)) spec += `&y0=${S.y0}&y1=${S.y1}`;
      if (eff === "era" && y !== GL_UNDATED) spec += `&y0=${Math.floor(y / 10) * 10 - win}&y1=${Math.floor(y / 10) * 10 + win}`;
      if (eff === "place") { const F = await fdFacets().catch(() => null); const c = F && F.country[seed]; if (c) spec += `&co=${encodeURIComponent(F.meta.countries[c - 1])}`; }
    }
    leave(); buzz(6); pmGo(spec);
  }
  [...(host.closest(".screen") || host).querySelectorAll("[data-fdmap]"), ...(isColor ? document.querySelectorAll("body > .rp-bar [data-fdmap]") : [])].forEach(b => { b.onclick = openMap; });
  // the Settings sheet is a half-height panel with no dimming (same shape as the painting map's View sheet): the feed above stays visible and scrolls, so each change shows live
  function fsHalf(sh) {
    sh.classList.add("fs-half");
    const sc = sh.previousElementSibling; if (sc && sc.classList.contains("scrim")) sc.classList.add("hm-scrim-clear");
    const x = document.createElement("button"); x.type = "button"; x.className = "iconq fs-x"; x.setAttribute("aria-label", "Close"); x.innerHTML = ICON.x;
    x.onclick = () => { buzz(4); const c = document.querySelector(".scrim.hm-scrim-clear"); if (c) c.dispatchEvent(new PointerEvent("pointerdown")); };
    sh.querySelector(".fs-head").appendChild(x);
  }
  function openSettings() {
    if (document.querySelector(".fs-sheet")) return;
    const kind = isColor ? fdsKind(eff) : "none", S = FDS[kind] || {}, mx = fdMaxCols();
    chipsEl.querySelectorAll(".fd-chip.on").forEach(c => c.classList.add("fd-open"));
    const rng = (k, label, min, max, step, ends) => `<div class="fs-c"><div class="fs-row"><p>${label}</p><b data-fs-out="${k}"></b></div><input type="range" min="${min}" max="${max}" step="${step || 1}" value="${S[k]}" data-fs="${k}" aria-label="${label}">${ends ? `<div class="fs-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>` : ""}</div>`;
    const seg = (k, label, opts) => `<div class="fs-c"><div class="fs-row"><p>${label}</p></div><div class="fs-seg" data-fsseg="${k}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${S[k] === v}">${t}</button>`).join("")}</div></div>`;
    const sw = (k, label) => `<div class="fs-c fs-tg"><p>${label}</p><button type="button" class="fs-switch" role="switch" aria-checked="${!!S[k]}" data-fssw="${k}"><i></i></button></div>`;
    let body = "";
    const RSTAT = kind === "paintings" && typeof rsRoleStats === "function" ? rsRoleStats(sub.hex) : null;   // how painters use this color: each part it plays, as a share of the paintings that hold it
    const roleDo = v => `${Math.max(1, Math.round(RSTAT.roles[v].length / RSTAT.n * 100))}%`;
    if (kind === "paintings") body = rng("tol", "How close a match", 1, 20, 1, ["Exact", "Loose"]) + rng("cov", "Covers at least", 0, 40, 1, ["Any speck", "Most of it"])
      + `<div class="fs-c"><div class="fs-row"><p>The part it plays</p><b data-fs-out="roles"></b></div><div class="fs-multi" data-fsmulti="roles">${[["main", "Main"], ["shadow", "Shadow"], ["mid", "Mid-tone"], ["light", "Light"], ["accent", "Accent"]].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${S.roles.includes(v)}">${t}${RSTAT ? `<small>${roleDo(v)}</small>` : ""}</button>`).join("")}</div><p class="fs-say" data-fs-say aria-live="polite"></p></div>`
      + `<div class="fs-c"><div class="fs-row"><p>Painted between</p><b data-fs-out="yrs"></b></div><div class="fs-dual"><div class="fs-track"><i data-fs-fill></i></div><input type="range" min="1300" max="2000" step="10" value="${S.y0}" data-fs="y0" aria-label="From year"><input type="range" min="1300" max="2000" step="10" value="${S.y1}" data-fs="y1" aria-label="To year"></div></div>`
      + seg("shape", "Shape", [["", "Any"], ["tall", "Tall"], ["wide", "Wide"], ["square", "Square"]])
      + `<div class="fs-c"><div class="fs-row"><p>Order</p></div><label class="fs-select"><select data-fssel="order" aria-label="Order">${[["close", "Closest color first"], ["cover", "Most of the color first"], ["old", "Oldest first"], ["new", "Newest first"]].map(([v, t]) => `<option value="${v}"${S.order === v ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>`
      + sw("onePer", "One painting per painter");
    else if (kind === "era") body = rng("win", "How wide a window", 10, 200, 10, ["Just the decade", "Two centuries"]) + seg("where", "Where", [["any", "Anywhere"], ["country", "Same country"], ["region", "Same region"]]);
    else if (kind === "place") body = rng("reach", "How far out", 0, 4, 1, ["Just the country", "The whole world"]) + sw("near", "Stay close in time") + `<div data-fsbox="win"${S.near ? "" : " hidden"}>${rng("win", "Within", 10, 200, 10)}</div>`;
    else if (!isColor && eff === "color") body = metricHTML();
    else body = `<p class="fs-note">This list has no filters. Size and captions are below.</p>`;
    const capsSw = `<div class="fs-c fs-tg"><p>Show painter and year</p><button type="button" class="fs-switch" role="switch" aria-checked="${!!view.caps}" data-fscaps><i></i></button></div>`;
    const palSw = `<div class="fs-c fs-tg"><p>Size palette strips by area</p><button type="button" class="fs-switch" role="switch" aria-checked="${fdPalArea()}" data-fspalarea><i></i></button></div>`;
    const size = capsSw + palSw + `<div class="fs-c"><div class="fs-row"><p>Size</p><b data-fs-out="size"></b></div><input type="range" min="1" max="${mx}" step="1" value="${cols}" data-fssize aria-label="Size"><div class="fs-prev" data-fs-prev></div></div>`;
    const title = ((CHIPS.find(c => c[0] === eff) || [])[1]) || "Keep exploring";
    const { sh, close } = sheet(`<div class="fs-sheet"><div class="fs-head"><h3>${title}</h3><span class="fs-count" data-fs-count aria-live="polite"></span><button type="button" class="fs-reset" data-fs-reset${kind === "none" ? " hidden" : ""}>Reset</button></div><div class="fs-scroll">${body}${size}</div></div>`, { lock: false });
    fsHalf(sh);
    const q = s2 => sh.querySelector(s2), out = (k, t) => { const o = q(`[data-fs-out="${k}"]`); if (o) o.textContent = t; };
    const fill = r => { const lo = +r.min, hi = +r.max; r.style.setProperty("--p", ((r.value - lo) / (hi - lo) * 100) + "%"); };
    const countEl = q("[data-fs-count]"), showCount = n => { if (countEl) countEl.textContent = (eff === "paintings" || eff === "era" || eff === "place" || !isColor) && n ? `${n.toLocaleString("en-US")} paintings` : ""; };
    onCount = showCount; showCount(lastN);
    let rt = 0; const later2 = () => { clearTimeout(rt); rt = setTimeout(() => { fdsSave(); SUBDOT(); rerank(false); }, 180); };
    const paint = () => {
      sh.querySelectorAll("input[type=range]").forEach(fill);
      if (kind === "paintings") {
        out("tol", TOLW[S.tol]); out("cov", S.cov === 0 ? "Any speck" : `${S.cov}% of the canvas`);
        out("roles", S.roles.length ? (S.roles.length > 2 ? `${S.roles.length} picked` : S.roles.map(r => ({ main: "Main", shadow: "Shadow", mid: "Mid-tone", light: "Light", accent: "Accent" })[r]).join(", ")) : "Any");
        out("yrs", `${S.y0} to ${S.y1}`);
        const f = q("[data-fs-fill]"); if (f) { f.style.left = (S.y0 - 1300) / 7 + "%"; f.style.right = (2000 - S.y1) / 7 + "%"; }
      } else if (kind === "era") out("win", `${S.win} years either side`);
      else if (kind === "place") { out("reach", REACHW[S.reach]); out("win", `${S.win} years either side`); }
      out("size", sizeWord(cols));
      const pv = q("[data-fs-prev]"); if (pv) { pv.style.gridTemplateColumns = `repeat(${cols},1fr)`; pv.innerHTML = Array.from({ length: Math.min(cols * 2, 12) }, (_, k) => `<i style="--k:${k % 3}"></i>`).join(""); }
    };
    sh.addEventListener("input", e => {
      const r = e.target.closest("[data-fs]"), z = e.target.closest("[data-fssize]");
      if (z) { if (zoom) zoom.step(+z.value - cols); paint(); return; }
      if (!r) return;
      const k = r.dataset.fs; S[k] = +r.value;
      if (k === "y0" && S.y0 > S.y1 - 20) { S.y0 = S.y1 - 20; r.value = S.y0; }
      if (k === "y1" && S.y1 < S.y0 + 20) { S.y1 = S.y0 + 20; r.value = S.y1; }
      paint(); later2();
    });
    sh.addEventListener("change", e => { const o = e.target.closest("[data-fssel]"); if (o) { S[o.dataset.fssel] = o.value; buzz(4); later2(); } });
    sh.addEventListener("click", e => {
      if (!isColor && eff === "color" && metricClick(e, sh)) return;
      const pa = e.target.closest("[data-fspalarea]");
      if (pa) { const on = !fdPalArea(); try { localStorage.setItem("colorhub-pal-area", on ? "1" : "0"); } catch (x) {} document.documentElement.classList.toggle("pal-area", on); pa.setAttribute("aria-checked", on); buzz(4); return; }
      const cp = e.target.closest("[data-fscaps]");
      if (cp) { view.caps = !view.caps; viewSave(); cp.setAttribute("aria-checked", view.caps); buzz(4); relayoutAll(); return; }
      const m = e.target.closest("[data-fsmulti] button"), g = e.target.closest("[data-fsseg] button"), w = e.target.closest("[data-fssw]"), rs = e.target.closest("[data-fs-reset]");
      if (m) { const k = m.parentNode.dataset.fsmulti, v = m.dataset.v, i = S[k].indexOf(v); i < 0 ? S[k].push(v) : S[k].splice(i, 1); m.setAttribute("aria-pressed", i < 0); buzz(4); roleSay(); paint(); later2(); }
      else if (g) { const k = g.parentNode.dataset.fsseg; S[k] = g.dataset.v; g.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === g)); buzz(4); later2(); }
      else if (w) { const k = w.dataset.fssw; S[k] = !S[k]; w.setAttribute("aria-checked", S[k]); const bx = q('[data-fsbox="win"]'); if (bx && k === "near") bx.hidden = !S[k]; buzz(4); later2(); }
      else if (rs) { FDS[kind] = JSON.parse(JSON.stringify(FDS_DEF[kind])); fdsSave(); SUBDOT(); buzz(5); close(); rerank(false); setTimeout(openSettings, 120); }
    });
    function roleSay() {   // the one-line meaning of the part picked last
      const el = q("[data-fs-say]"); if (!el) return;
      const v = S.roles && S.roles[S.roles.length - 1], r = v && RS_ROLES.find(x => x[0] === v);
      el.textContent = r ? `${r[2].charAt(0).toUpperCase() + r[2].slice(1)}${RSTAT ? `: in ${roleDo(v)} of the ${RSTAT.n.toLocaleString("en-US")} paintings that hold it` : ""}.` : "";
    }
    roleSay(); paint();
    const prevClose = close; sh.addEventListener("close", () => { onCount = null; });
    const obs = new MutationObserver(() => { if (!sh.isConnected) { onCount = null; obs.disconnect(); chipsEl.querySelectorAll(".fd-chip.fd-open").forEach(c => c.classList.remove("fd-open")); } }); obs.observe(document.body, { childList: true, subtree: true });
  }
  host.addEventListener("click", e => { if (e.target.closest("[data-fdreset]")) { const kd = fdsKind(eff); FDS[kd] = JSON.parse(JSON.stringify(FDS_DEF[kd])); fdsSave(); SUBDOT(); rerank(false); } });

  // ----- go -----
  // the next frame, or 60 ms later if no frame comes (a background or throttled page never runs its animation frames: the window would stay as it was and the screen would show no tiles)
  const onScroll = (() => { let pending = false; const run = () => { if (!pending) return; pending = false; draw(); }; return () => { if (pending) return; pending = true; requestAnimationFrame(run); setTimeout(run, 60); }; })();
  const onResize = () => { setBarTop(); if (Math.abs((grid.clientWidth || W) - W) > 1) relayoutAll(); };
  function start() {
    if (built || gone) return; built = true;
    zoom = gzAttach(grid, { cols: () => cols, min: () => 1, max: fdMaxCols, colW: () => colW, setCols });
    if (!memo) { Object.assign(st, STORE); if (aboutEl && o.startChip) st.chip = !isColor ? o.startChip : o.startChip === "paintings" && STORE.chip !== "about" && FDC_CHIPS.some(c => c[0] === STORE.chip) ? STORE.chip : o.startChip; }
    setBarTop(); chipsDraw(); if (!memo) remember();
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onResize);
    rerank(false);
    if (memo) pin();
  }
  // built once the bottom is near (within ~1.6 screens): a scroll listener, not an IntersectionObserver, which a hidden tab may never run
  const near = () => { if (!built && host.getBoundingClientRect().top < innerHeight * 2.6) { removeEventListener("scroll", near); start(); } };
  const destroy = () => { gone = true; tok++; peekOff(); if (zoom) zoom.destroy(); removeEventListener("scroll", near); removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); live.clear(); };
  cleanup.push(destroy);
  if (!host.style.minHeight) host.style.minHeight = "1px";   // never undo fdJump's taller one
  // the page may settle AFTER this is mounted (a wide window's two columns, late images, fonts) and bring the feed up to the screen with no scroll
  // event at all, so a scroll listener alone never starts it (the desktop bug of 2026-10-24: heading, zero tiles): also look every 400 ms until built
  const poll = setInterval(() => { if (built || gone || !host.isConnected) clearInterval(poll); else near(); }, 400);
  if (memo) start(); else { addEventListener("scroll", near, { passive: true }); near(); }
  return { start, destroy };
}

// ======================================================================
// The same feed, with a COLOR as its subject (David, 2026-10-24: "on the color page, when you scroll all the way down, it should
// show a similar infinite scroll of paintings and stuff, also with different filters"). rpFeedMount (js/richpage.js) mounts it at
// the foot of every color page: a named color, an in-between color (the tapped color, "Your color") or an archive color.
//  - fdMount takes { sub: { hex, name, tapped } } instead of a painting; everything else (masonry, 24 per page, at most 40 live
//    pictures, session chip, Back to the exact tile) is the same code. A tile is either a painting ({ j, cap }) or a "card"
//    ({ card, h, title, sub, cap, open, ab, img? }): a thing that is not a painting, drawn in its own color.
//  - ONE base query per color (fdcBase): every painting that holds it, closest first (the "closeness beats coverage" order the
//    In paintings rail sorts "Closest" by: the nearest patch decides, an exact speck outranks a big off-color area). Paintings,
//    Era and Place are passes over that list; Painters reuses color-artists.json ("Painters who use it"); Other worlds reuses
//    the rows the page builds (gems, nature, design, fashion, films, books, poems); Close colors are the look-alike names.
//  - A chip with nothing for this color is disabled with a plain reason (FDC_OFF), found quietly after the first tiles.
// ======================================================================
const FDC_CHIPS = [["paintings", "Paintings"], ["painters", "Painters"], ["era", "Era"], ["place", "Place"], ["worlds", "Other worlds"], ["close", "Close colors"]];
const FDC_LEAD = { paintings: () => "Closest to this color first", painters: () => "Painters who use this color most", era: () => "Nearest in time to the era with the most of it", place: () => "The country with the most of it first, then its region",
  worlds: () => "Gems, flowers, films, fashion, design and words that hold this color", close: () => "The names that sit closest to this color" };
let FDC_ST = (() => { try { const s = JSON.parse(sessionStorage.getItem("colorhub-feed-color") || "null"); if (s && s.chip && FDC_CHIPS.some(c => c[0] === s.chip)) return { chip: s.chip, metric: "overall", color: 0 }; } catch (e) {} return { chip: "paintings", metric: "overall", color: 0 }; })();
// a painting qualifies only if the color's neighborhood (matched colors summed, within the match tolerance) is a visible part of it:
// at least FDC_MIN_SHARE percent of the canvas, never a speck. Fewer than ~300 qualifying is said honestly (the end line), not padded.
const FDC_TOL = 6, FDC_MIN_SHARE = 2, FDC_FLOOR_SHARE = 2, FDC_BONUS = .3;
const FDC_OFF = new Map();       // "c:#HEX" -> { chip: plain reason }
const FDC_BASE = new Map();      // "#HEX" -> Promise<{ rows: [{ i, de, cover }], near }>
const fdcOff = (key, chip, why) => { const m = FDC_OFF.get(key) || {}; m[chip] = why; FDC_OFF.set(key, m); };

// every painting that holds this color visibly, closest first: matched palette colors within ΔE 6 covering at least 2% of the canvas, never a speck, never a wider reach. Only if nothing qualifies at all, the soft-coverage ranking (js/colorindex.js ciClosest) so the list is never empty. Cached per color.
const FDC_THIN = 60, FDC_NB_SHARE = 4;   // a neighbor must be plainly present (4%) in its own paintings: it is already one step away   // fewer than this qualify strictly: the same scroll goes on with the neighbors' own paintings
// the named colors nearest this one (learnable names and the archive's), nearest first: for an in-between color its own page's winner is among them
async function fdcNearNames(sub, n, maxDe) {
  const { hex, name, tapped } = sub;
  if (typeof loadLongNames === "function") await loadLongNames().catch(() => {});
  const core = CORE_NAMES || coreFallback(), learn = new Set(core.map(e => e.n.toLowerCase()));
  const pool = core.concat((LONG_NAMES || []).filter(e => !learn.has(e.n.toLowerCase()))); pool.forEach(e => { if (!e.lab) e.lab = lab(e.h); });
  const seen = new Set();
  return nearestCore(lab(hex), pool, n * 3 + 30).filter(x => { const k = x.n.toLowerCase(); if ((!tapped && k === name.toLowerCase()) || seen.has(k) || (maxDe && x.de > maxDe)) return false; seen.add(k); return true; }).slice(0, n);
}
// WHY THIS READS THE GALLERY AND NOT data/colorindex: that index was built 2026-10-09 for 23,778 paintings, in the gallery order of that day, and
// the gallery has since grown to 200,000+ and been re-ordered, so ids >= ~12,000 name the wrong painting (a dark Henner portrait "held" 5% of a
// periwinkle: it was another painting's pixels) and 90% of the archive was never in it. The gallery's own six-color palettes (GAL.lab / GAL.sh,
// the data every painting page and js/twins.js read) are aligned with the paintings by construction.
// fdcScan: for every painting, the share of its canvas in palette colors within tol (ΔE2000) of the color, and the REAL nearest palette
// color's distance. Never a bin center: GAL.lab are the paintings' own cluster colors.
function fdcScan(hex, tol, minShare) {
  const G = GAL, N = G.n, [tL, ta, tb] = lab(hex), Lb = G.lab, sh = G.sh, out = [], lim = tol * 1.75 + .5;
  for (let i = 0; i < N; i++) {
    let cover = 0, best = 99;
    for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, o = k * 3, dL = Lb[o] - tL;
      if (sh[k] <= 0) continue;
      if (dL > lim || dL < -lim) { const d0 = Math.abs(dL) / 1.75; if (d0 < best) best = d0; continue; }   // ΔE00 is at least |ΔL| / 1.75: far past any tolerance
      const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]);
      if (d < best) best = d;
      if (d <= tol) { const q = d / (tol * 1.25); cover += sh[k] * 100 * (1 - q * q); }   // a cluster is a blob around its mean: its share counts fully at the color and fades toward the edge (as glNear does)
    }
    if (cover >= minShare && cover > 0) out.push({ i, de: best, cover });
  }
  return out;
}
// ---------- Settings (David, 2026-10-25: "a settings button for what dictates which list is shown"): one persisted set of choices per kind of
// list. Paintings: how close, how much of the canvas, the part it plays, years, shape, order, one per painter. Era: how wide a window,
// and where. Place: how far out, and how close in time. A change re-ranks at once; the cache is keyed by the choices, so going back is instant.
const FDS_KEY = "colorhub-feed-set";
const FDS_DEF = { paintings: { tol: 6, cov: 2, roles: [], y0: 1300, y1: 2000, shape: "", order: "close", onePer: false }, era: { win: 50, where: "any" }, place: { reach: 2, near: true, win: 50 } };
let FDS = (() => { try { const v = JSON.parse(localStorage.getItem(FDS_KEY) || "null") || {}; return { paintings: { ...FDS_DEF.paintings, ...v.paintings }, era: { ...FDS_DEF.era, ...v.era }, place: { ...FDS_DEF.place, ...v.place } }; } catch (e) { return JSON.parse(JSON.stringify(FDS_DEF)); } })();
const fdsSave = () => { try { localStorage.setItem(FDS_KEY, JSON.stringify(FDS)); } catch (e) {} };
const fdsKind = chip => chip === "era" ? "era" : chip === "place" ? "place" : "paintings";
const fdsSig = chip => chip === "paintings" || chip === "era" || chip === "place" ? JSON.stringify(FDS[fdsKind(chip)]) : "";
const fdsChanged = chip => chip === "paintings" || chip === "era" || chip === "place" ? JSON.stringify(FDS[fdsKind(chip)]) !== JSON.stringify(FDS_DEF[fdsKind(chip)]) : false;
// the filters on a ranked list of { i, de, cover }: years, shape, the part it plays, order, one per painter
function fdcApply(rows, S, hex, F) {
  const G = GAL; let out = rows;
  const narrowed = S.y0 > 1300 || S.y1 < 2000;
  if (narrowed) out = out.filter(r => { const y = G.year[r.i]; return y !== GL_UNDATED && y >= S.y0 && y <= S.y1; });
  if (S.shape) out = out.filter(r => { const a = G.ar[r.i]; return S.shape === "tall" ? a > 1.2 : S.shape === "wide" ? a < .85 : a >= .85 && a <= 1.2; });
  if (S.roles && S.roles.length && typeof rsRoleStats === "function") {
    const R = rsRoleStats(hex), ok = new Set();
    if (R) { S.roles.forEach(k => (R.roles[k] || []).forEach(x => ok.add(x[0]))); out = out.filter(r => ok.has(r.i)); }
  }
  if (S.order === "cover") out = out.slice().sort((a, b) => b.cover - a.cover);
  else if (S.order === "old" || S.order === "new") {
    const dir = S.order === "old" ? 1 : -1, yr = r => { const y = G.year[r.i]; return y === GL_UNDATED ? null : y; };
    out = out.slice().sort((a, b) => { const x = yr(a), y = yr(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x - y) * dir; });
  }
  if (S.onePer && F) { const seen = new Set(); out = out.filter(r => { const a = F.artist[r.i]; if (!a) return true; if (seen.has(a)) return false; seen.add(a); return true; }); }
  return out;
}
// fdcFar: for EVERY painting, the distance (ΔE2000) from this color to its nearest palette color. Computed in slices of about 10 ms so the page
// never stalls (200,000 paintings), cached for the last few colors. The tail of every color list is a cursor over it.
const FDC_FAR = new Map();
function fdcFar(hex) {
  hex = hex.toUpperCase(); if (FDC_FAR.has(hex)) return FDC_FAR.get(hex);
  const p = (async () => {
    await loadGallery();
    const G = GAL, N = G.n, [tL, ta, tb] = lab(hex), Lb = G.lab, sh = G.sh, out = new Float32Array(N);
    for (let i = 0; i < N;) {
      const t0 = performance.now();
      for (; i < N; i++) {
        if (!(i & 127) && performance.now() - t0 > 10) break;
        let best = 99;
        for (let j = 0; j < 6; j++) {
          const k = i * 6 + j, o = k * 3; if (sh[k] <= 0) continue;
          const dL = Lb[o] - tL; if (Math.abs(dL) / 1.75 >= best) continue;   // ΔE00 is at least |ΔL| / 1.75
          const d = glDE(tL, ta, tb, Lb[o], Lb[o + 1], Lb[o + 2]); if (d < best) best = d;
        }
        out[i] = best;
      }
      await new Promise(r => setTimeout(r, 0));
    }
    return out;
  })();
  FDC_FAR.set(hex, p); if (FDC_FAR.size > 3) FDC_FAR.delete(FDC_FAR.keys().next().value);
  p.catch(() => FDC_FAR.delete(hex));
  return p;
}
// the hard filters of Settings as a test on one painting (years, shape, the part it plays, one per painter): the tail of a list obeys them too
function fdcFilter(S, hex, F, used) {
  const G = GAL, narrowed = S.y0 > 1300 || S.y1 < 2000, R = S.roles && S.roles.length && typeof rsRoleStats === "function" ? rsRoleStats(hex) : null;
  let rolesOk = null; if (R) { rolesOk = new Set(); S.roles.forEach(k => (R.roles[k] || []).forEach(x => rolesOk.add(x[0]))); }
  const artists = new Set(); if (S.onePer && F) used.forEach(j => { const a = F.artist[j]; if (a) artists.add(a); });
  const ok = j => {
    if (narrowed) { const y = G.year[j]; if (y === GL_UNDATED || y < S.y0 || y > S.y1) return false; }
    if (S.shape) { const a = G.ar[j]; if (!(S.shape === "tall" ? a > 1.2 : S.shape === "wide" ? a < .85 : a >= .85 && a <= 1.2)) return false; }
    if (rolesOk && !rolesOk.has(j)) return false;
    if (S.onePer && F) { const a = F.artist[j]; if (a && artists.has(a)) return false; }
    return true;
  };
  const take = j => { if (S.onePer && F) { const a = F.artist[j]; if (a) artists.add(a); } };
  return { ok, take };
}
function fdcBase(sub, o) {
  const hex = sub.hex.toUpperCase(), tol = o && o.tol ? o.tol : FDC_TOL, minShare = o && o.min != null ? o.min : FDC_MIN_SHARE, bkey = tol === FDC_TOL && minShare === FDC_MIN_SHARE ? hex : `${hex}|${tol}|${minShare}`;
  if (FDC_BASE.has(bkey)) return FDC_BASE.get(bkey);
  const q = async (h, min) => ({ rows: fdcScan(h, tol, min) });
  // closeness dominates; presence (sqrt of the share, capped) breaks ties and demotes anything barely there
  const sc = r => r.de - FDC_BONUS * Math.min(Math.sqrt(Math.max(0, r.cover)), 3);
  const keep = (rs, seen) => rs.filter(r => !seen.has(r.i)).map(r => ({ i: r.i, de: r.de, cover: r.cover })).sort((a, b) => sc(a) - sc(b));
  const p = (async () => {
    await loadGallery();
    // presence is measured at the match tolerance (ΔE 6), never wider: a wider reach would count greys and browns as "the color"
    let res = await q(hex, minShare), seen = new Set(), rows = keep(res.rows, seen).slice(0, 3000).map(r => ({ ...r, g: -1 })), near = false;
    rows.forEach(r => seen.add(r.i));
    const groups = [];
    // too few to be a feed: carry on with the next-nearest named colors, one at a time, each held to the same rule against ITS OWN color
    const custom = bkey !== hex;   // your own closeness or presence: the list is exactly what matches, never padded with neighbors
    if (rows.length < FDC_THIN && !custom) {
      for (const x of await fdcNearNames(sub, 14, 12)) {
        if (rows.length >= 150) break;
        if (de2000(x.h, hex) < 1) continue;
        const rs = keep((await q(x.h, FDC_NB_SHARE)).rows, seen).slice(0, 60); if (!rs.length) continue;
        rs.forEach(r => seen.add(r.i)); groups.push({ n: x.n, h: x.h });
        rows = rows.concat(rs.map(r => ({ ...r, g: groups.length - 1 })));
      }
    }
    if (!rows.length && !custom) { rows = fdcScan(hex, 99, 0).sort((a, b) => a.de - b.de).slice(0, 300).map(r => ({ ...r, g: -1 })); near = true; }   // nothing holds it visibly: the nearest patches, named for what they are
    return { rows, near, groups };
  })();
  FDC_BASE.set(bkey, p); if (FDC_BASE.size > 6) FDC_BASE.delete(FDC_BASE.keys().next().value);
  p.catch(() => FDC_BASE.delete(bkey));
  return p;
}

async function fdcRankPaintings(ctx) {
  const S = FDS.paintings, F = S.onePer ? await fdFacets().catch(() => null) : null;
  return fdcBase(ctx.sub, { tol: S.tol, min: S.cov }).then(b => {
    if (!b.rows.length) return { empty: "No painting in the archive holds this color yet." };
    const plain = S.order === "close" && !S.roles.length && !S.shape && S.y0 <= 1300 && S.y1 >= 2000 && !S.onePer;
    const rows = fdcApply(b.rows, S, ctx.sub.hex, F);
    if (!rows.length) return { empty: "Nothing matches these settings. Loosen one, or reset them." , reset: 1 };
    const items = []; let g = -1;
    for (const r of rows.slice(0, FD_KEEP)) {
      if (plain && r.g !== g && r.g >= 0) {   // a new neighbor: its name, once, calmly (the first also gets the divider)
        if (g === -1) items.push({ head: 1, text: "Close colors" });
        items.push({ head: 1, sub: 1, text: b.groups[r.g].n, h: b.groups[r.g].h });
      }
      g = plain ? r.g : -2;
      items.push({ j: r.i, cap: plain && r.g >= 0 ? b.groups[r.g].n : "" });
    }
    const res = b.groups.length && plain ? { items, n: rows.length, lead: "Closest to this color first, then the paintings of its neighbors", end: "That is everything close to this color and its neighbors." } : { items, n: rows.length };
    // after the matches: the rest of the archive, nearest color first (how close the top is is the setting; nothing cuts the list off). Only an
    // order that is not by closeness, or a minimum share of the canvas, makes the list exactly what matches.
    if (S.order === "close" && S.cov <= FDC_MIN_SHARE) {
      const used = new Set(items.filter(x => x.j != null).map(x => x.j)), fl = fdcFilter(S, ctx.sub.hex, F, used);
      res.end = fdsChanged("paintings") ? "That is everything that matches your settings." : "That is every painting in the archive.";
      fdPaged(res, null, null);
      res.next = async () => {
        const far = await fdcFar(ctx.sub.hex); res._cur = res._cur || fdCursor(far, used, fl.ok, fl.take);
        const page = res._cur(FD_TAIL); if (!page.length) { res.moreDone = true; return; }
        page.forEach(([, j]) => res.items.push({ j, cap: "" }));
      };
    } else res.end = fdsChanged("paintings") ? "That is everything that matches your settings." : res.end;
    return res;
  });
}
async function fdcRankPainters(ctx) {
  const { hex, name } = ctx.sub, [b, F] = await Promise.all([fdcBase(ctx.sub), fdFacets()]);
  await rcLoadArtists();
  let rows = (RC_ARTISTS || {})[name];
  if (!rows || !rows.length) { const near = rcNearestWith(hex, name, n => ((RC_ARTISTS || {})[n] || []).length); rows = near ? RC_ARTISTS[near.n] : []; }
  const idx = new Map(F.meta.artists.map((a, k) => [a[0], k + 1])), best = new Map(), cnt = new Map();
  b.rows.forEach((r, n) => { const a = F.artist[r.i]; if (!a) return; if (!best.has(a)) best.set(a, r); if (n < 1500) cnt.set(a, (cnt.get(a) || 0) + 1); });
  const items = [], seen = new Set();
  for (const r of rows) {   // "Painters who use it": lifted over their peers; the picture of theirs that holds this color best
    const a = idx.get(r.a); let j = a && best.has(a) ? best.get(a).i : null;
    if (j == null) { const gi = await rcPainterTypicalGi(r.s || routeSlug(r.a)).catch(() => null); if (gi != null) j = gi; }
    if (j == null || (a && seen.has(a))) continue; if (a) seen.add(a);
    items.push({ j, cap: "Used most by " + fdShortName(r.a), byTitle: 1 });
  }
  [...cnt.entries()].filter(([a, n]) => !seen.has(a) && n >= 2).sort((x, y) => y[1] - x[1]).slice(0, 80).forEach(([a]) => { seen.add(a); items.push({ j: best.get(a).i, cap: "Also used by " + fdShortName(F.meta.artists[a - 1][0]), byTitle: 1 }); });
  if (!items.length) return { empty: "No painter in the archive stands out for this color yet." };
  const res = { items, end: "That is every painter in the archive.", moreDone: false };
  res.next = async () => {   // then every other painter, by the picture of theirs nearest this color
    if (!res._cur) {
      const far = await fdcFar(hex), A = F.meta.artists.length + 1, bd = new Float32Array(A).fill(Infinity), bj = new Int32Array(A).fill(-1);
      for (let j = 0; j < far.length; j++) { const a = F.artist[j]; if (a && far[j] < bd[a]) { bd[a] = far[j]; bj[a] = j; } }
      seen.forEach(a => { bd[a] = Infinity; }); bd[0] = Infinity;
      res._bj = bj; res._cur = fdCursor(bd, new Set());
    }
    const page = res._cur(FD_TAIL); if (!page.length) { res.moreDone = true; return; }
    page.forEach(([, a]) => res.items.push({ j: res._bj[a], cap: "Nearest in " + fdShortName(F.meta.artists[a - 1][0]), byTitle: 1 }));
  };
  return res;
}
async function fdcRankEra(ctx, st) {
  const hex = ctx.sub.hex, b = await fdcBase(ctx.sub), G = GAL, S = FDS.era, F = S.where !== "any" ? await fdFacets().catch(() => null) : null;
  let pool = b.rows.filter(r => G.year[r.i] !== GL_UNDATED);
  if (F) {   // "where": only the country (or region) that holds the most of this color in its biggest decade
    const cn = new Map(); pool.slice(0, 300).forEach(r => { const c = F.country[r.i]; if (c) cn.set(c, (cn.get(c) || 0) + 1); });
    const co = [...cn.entries()].sort((x, y) => y[1] - x[1])[0];
    if (co) { const ok = S.where === "country" ? new Set([co[0]]) : (() => { const t = fdRegions(F, co[0]); return t.length ? new Set([co[0], ...t[t.length - 1]]) : new Set([co[0]]); })(); pool = pool.filter(r => ok.has(F.country[r.i])); }
  }
  if (pool.length < 30) return { empty: "Too few paintings that hold this color or its neighbors have a year, so there is no era to read." };
  const dec = new Map(); pool.slice(0, 300).forEach(r => { const d = Math.floor(G.year[r.i] / 10); dec.set(d, (dec.get(d) || 0) + 1); });
  const picked = !!(st && st.color > 0), top = picked ? st.color : [...dec.entries()].sort((a, b2) => b2[1] - a[1] || a[0] - b2[0])[0][0], y0 = top * 10 + 5;
  const sc = pool.filter(r => Math.abs(G.year[r.i] - y0) <= S.win).map(r => [r, Math.abs(G.year[r.i] - y0) + r.de * 2]).sort((a, b2) => a[1] - b2[1]).slice(0, FD_KEEP);
  if (!sc.length) return { empty: "Nothing from that window holds this color. Widen the window, or reset the settings.", reset: 1 };
  const res = { lead: picked ? `Nearest the ${top * 10}s, closest to this color first` : `Nearest the ${top * 10}s, the decade with the most of this color`, n: sc.length, items: sc.map(([r]) => ({ j: r.i, cap: `${Math.floor(G.year[r.i] / 10) * 10}s` })), end: S.where === "any" ? "That is every painting in the archive." : "That is everything that matches your settings.", moreDone: S.where !== "any" };
  if (S.where === "any") {   // then every other painting, by how far its year is from this window and how far its color is: years outward
    const used = new Set(res.items.map(x => x.j));
    res.next = async () => {
      if (!res._cur) { const far = await fdcFar(hex), sa = new Float32Array(G.n); for (let j = 0; j < G.n; j++) { const y = G.year[j]; sa[j] = (y === GL_UNDATED ? 1e4 : Math.abs(y - y0)) + 2 * far[j]; } res._cur = fdCursor(sa, used); }
      const page = res._cur(FD_TAIL); if (!page.length) { res.moreDone = true; return; }
      page.forEach(([, j]) => res.items.push({ j, cap: G.year[j] === GL_UNDATED ? "No year" : `${Math.floor(G.year[j] / 10) * 10}s` }));
    };
  }
  return res;
}
async function fdcRankPlace(ctx, st) {
  const [b, F] = await Promise.all([fdcBase(ctx.sub), fdFacets()]), pool = b.rows.filter(r => F.country[r.i]);
  if (pool.length < 30) return { empty: "Too few paintings that hold this color or its neighbors have a country on record, so there is no place to read." };
  const cn = new Map(); pool.slice(0, 300).forEach(r => cn.set(F.country[r.i], (cn.get(F.country[r.i]) || 0) + 1));
  const G = GAL, S = FDS.place, picked = !!(st && st.color > 0 && F.meta.countries[st.color - 1]), co = picked ? st.color : [...cn.entries()].sort((a, b2) => b2[1] - a[1] || a[0] - b2[0])[0][0], tiers = fdRegions(F, co), items = [];
  const maxTier = S.reach >= 4 ? 99 : S.reach <= 0 ? 0 : S.reach === 1 ? 1 : tiers.length;   // 0 the country, 1 its neighbors, 2-3 its region, 4 the world
  const cy = (() => { const r0 = pool.find(r => F.country[r.i] === co && G.year[r.i] !== GL_UNDATED); return r0 ? G.year[r0.i] : null; })();
  for (const r of pool) {
    const c = F.country[r.i]; let tier = 0;
    if (c !== co) { tier = -1; for (let k = 0; k < tiers.length; k++) if (tiers[k].has(c)) { tier = k + 1; break; } if (tier < 0) { if (maxTier < 99) continue; tier = 50; } if (tier > maxTier) continue; }
    if (S.near && cy != null) { const y = G.year[r.i]; if (y === GL_UNDATED || Math.abs(y - cy) > S.win) continue; }
    items.push([r, tier * 100 + r.de]);
  }
  if (!items.length) return { empty: "Nothing there holds this color within those settings. Widen them, or reset.", reset: 1 };
  items.sort((a, b2) => a[1] - b2[1]);
  const res = { n: items.length, lead: picked ? `${F.meta.countries[co - 1]} first, then its region, closest to this color first` : `${F.meta.countries[co - 1]} first, the country with the most of this color, then its region`, items: items.slice(0, FD_KEEP).map(([r]) => ({ j: r.i, cap: F.meta.countries[F.country[r.i] - 1] })), end: "That is every painting in the archive.", moreDone: false };
  const used = new Set(res.items.map(x => x.j));
  res.next = async () => {   // then the rest of the world: its country, its neighbors, its region, everywhere else, each nearest this color first
    if (!res._cur) {
      const far = await fdcFar(ctx.sub.hex), sa = new Float32Array(G.n);
      const tierOf = new Map(); const tr = c => { if (c === co) return 0; if (tierOf.has(c)) return tierOf.get(c); let t = 50; for (let k = 0; k < tiers.length; k++) if (tiers[k].has(c)) { t = k + 1; break; } tierOf.set(c, t); return t; };
      for (let j = 0; j < G.n; j++) { const c = F.country[j]; sa[j] = (c ? tr(c) * 100 : 6000) + far[j]; }
      res._cur = fdCursor(sa, used);
    }
    const page = res._cur(FD_TAIL); if (!page.length) { res.moreDone = true; return; }
    page.forEach(([, j]) => res.items.push({ j, cap: F.country[j] ? F.meta.countries[F.country[j] - 1] : "" }));
  };
  return res;
}

// ---------- Other worlds: one card per thing, a few from each world in turn ----------
// a closeness you can feel instead of a percent (the same four words as the color page's figure cards)
const fdCloseWord = de => de < 2 ? "Nearly identical" : de < 5 ? "Very close" : de < 10 ? "Close" : "Related";
const fdcNode = id => { const g = graph(); return g.nodes.get(id) || (/^gm:/.test(id) && typeof gmNode === "function" ? gmNode(id) : null) || (/^bt:/.test(id) && typeof btNode === "function" ? btNode(id) : null); };
const fdcOpenNode = id => () => { const n = fdcNode(id); if (n) openNode(n); };
const fdcPlain = html => { const t = document.createElement("div"); t.innerHTML = html; return (t.textContent || "").trim(); };
async function fdcWorldLists(ctx) {
  const { hex, name } = ctx.sub, c = { n: name, h: hex }, W = [], add = (kind, arr) => { if (arr.length) W.push(arr.slice(0, 10).map(x => ({ card: 1, ab: 1.05, cap: kind, ...x }))); };
  const when = f => new Promise(res => { if (typeof f !== "function") return res(); let done = false; const fin = () => { if (!done) { done = true; res(); } }; try { f(fin); } catch (e) { fin(); } setTimeout(fin, 4000); });
  await Promise.all([when(typeof gmWhen === "function" ? gmWhen : null), when(typeof btWhen === "function" ? btWhen : null), when(typeof bdWhen === "function" ? bdWhen : null), when(typeof doWhen === "function" ? doWhen : null), when(typeof archWhen === "function" ? archWhen : null)]);
  // the thing's own picture when the archive has one (David, 2026-10-25: "these are lacking their pictures"): gem and plant photos live in
  // WIKI_IMAGES under the node id, a design object carries its own img; a card without one stays a block of its color
  const pic = id => { const im = ((window.WIKI_IMAGES || {})[id] || [])[0] || ((window.GEM_IMAGES || {})[id] || [])[0] || ((window.BOTANY_IMAGES || {})[id] || [])[0]; return im && im.src ? im.src : null; };
  try { if (typeof gmRowHits === "function") add("In gems", gmRowHits(c).map(h => ({ title: h.title, h: h.h, img: pic(h.id), sub: h.named ? "Named after this color" : "Close to one of its shades", open: fdcOpenNode(h.id) }))); } catch (e) {}
  try {
    const ents = ((window.BOTANY || {}).byColor || {})[name] || [], pid = typeof btPlantByColor !== "undefined" ? btPlantByColor.get(name) : null;
    add("In nature", ents.map(e => {
      if (e.link === "named" && pid) { const n = btNode(pid), sw = n && n.swatches[0]; return { title: e.plant, h: sw ? sw.h : hex, img: pic(pid), sub: e.detail, open: fdcOpenNode(pid) }; }
      if (e.link === "dye" && typeof btDyeForPlant === "function") { const dd = btDyeForPlant(e.plant); if (dd) return { title: e.plant, h: hex, img: pic("bt:dye:" + dd.id), sub: e.detail, open: fdcOpenNode("bt:dye:" + dd.id) }; }
      return null;
    }).filter(Boolean));
  } catch (e) {}
  try { if (typeof bdBrandsNear === "function") add("In design", bdBrandsNear(hex, 15, 10).map(h => ({ title: h.b.name, h: h.h, sub: fdCloseWord(h.d), open: () => bdPage(h.b.id) }))); } catch (e) {}
  try { if (typeof doNearest === "function") add("In design objects", doNearest(hex, 10, 10).map(({ n, d }) => ({ title: n.title, h: n.palette[0].h, img: n.img || null, sub: fdCloseWord(d), open: () => doOpenObject(n.id) }))); } catch (e) {}
  try { if (window.FASHION && typeof worldFashionHits === "function") add("In fashion", worldFashionHits(hex, name).map(x => ({ title: x.title, h: x.h, sub: x.sub, open: () => fashionPage(x.slug) }))); } catch (e) {}
  try {
    if (typeof fxLoad === "function") { const d = await fxLoad(); if (d) add("In fashion", fxByColor(hex, d.rows, .3).slice(0, 10).map(([r, s]) => ({ title: r.t, h: r.p[0][0], img: fxThumb(r), ab: 1.2, sub: `${Math.round(Math.min(1, s) * 100)}% of the cloth · ${r.d}`, open: () => fashionPage("garment-" + r.id) }))); }
  } catch (e) {}
  try {
    const hits = (window.FILMS || []).filter(f => f.colors.some(x => x.app === name)).slice(0, 10);
    add("In films", hits.map(f => ({ title: f.title, h: (f.colors.find(x => x.app === name) || f.colors[0]).h, sub: `${f.director} · ${f.year}`, open: () => archOpen(archNode("film", f)) })));
  } catch (e) {}
  try { if (typeof psgForColor === "function") add("In books", psgForColor(name, 10).map(({ p, ms }) => ({ title: fdcPlain(psgExcerpt(p, ms[0], 90, false).html), h: (p.colors[0] || {}).h || hex, ab: 1.3, sub: `${p.author}, ${p.work}`, open: () => archOpen(archNode("passage", p)) }))); } catch (e) {}
  try {
    if (typeof loadPoemIndex === "function") {
      const ix = await loadPoemIndex(), ci = ix && ix.colorByName.get(name.toLowerCase()), best = ci != null && ix.best[ci];
      if (best) add("In poems", best.filter(x => x.length > 2).map(([id, li, text]) => { const p = ix.byId.get(id); return p ? { title: String(text).trim(), h: ix.colors[ci][1] || hex, ab: 1.3, sub: `${p.poet} · ${p.title}`, open: () => { POEM_ORIGIN = "explore"; poemPage(id); } } : null; }).filter(Boolean));
    }
  } catch (e) {}
  return W;
}
async function fdcRankWorlds(ctx) {
  const W = await fdcWorldLists(ctx), items = [];
  for (let n = 0; W.some(l => n < l.length); n++) W.forEach(l => { if (l[n]) items.push(l[n]); });   // one from each world in turn, so the first screen is varied
  return items.length ? { items } : { empty: "No gem, flower, film, garment, design piece or poem in the archive holds this color yet." };
}

// ---------- Close colors: the names that sit nearest (the "It could also be called" ranking for an in-between color) ----------
async function fdcRankClose(ctx) {
  const { hex, name, tapped } = ctx.sub, me = { h: hex, n: tapped ? "Your color" : name }, rows = await fdcNearNames(ctx.sub, 60, 0);
  if (!rows.length) return { empty: "No other name sits close to this color." };
  return { items: rows.map(r => ({ card: 1, ab: .95, h: r.h, title: r.n, cap: pctMatch(r.de), sub: lookDiff(me, { h: r.h, n: r.n }), open: () => rpOpenNameAs(r.n, r.h, tapped || null) })) };
}
const FDC_RANK = { paintings: fdcRankPaintings, painters: fdcRankPainters, era: fdcRankEra, place: fdcRankPlace, worlds: fdcRankWorlds, close: fdcRankClose };

// find out, quietly, which chips have nothing for this color (not Other worlds: it wakes datasets nothing else on the page needs).
// Results land in FD_CACHE so a chip that works opens at once; one that doesn't is disabled with its reason.
async function fdcProbe(ctx) {
  const key = ctx.key;
  for (const k of ["painters", "era", "place", "close"]) {
    if ((FDC_OFF.get(key) || {})[k] || FD_CACHE.has(`${key}|${k}|overall|0`)) continue;
    try { const r = await FDC_RANK[k](ctx, {}); if (r.empty && !r.reset) fdcOff(key, k, r.empty); else FD_CACHE.set(`${key}|${k}|overall|0`, r); } catch (e) {}
    await new Promise(res => setTimeout(res, 30));
  }
  while (FD_CACHE.size > 24) FD_CACHE.delete(FD_CACHE.keys().next().value);
}
// the color page's mount: waits for the bottom to come near, then the gallery (the tiles are paintings), then the feed
// "Explore" jump (David, 2026-10-24: "take you where Keep exploring is at the TOP so the paintings take up the full screen").
// Root cause of the old short landing: the feed is built lazily and its host was ~8px tall when the smooth scroll began, so the
// document was too short to scroll the host to the top and the browser stopped with the heading at the bottom of the screen.
// So: give the host a real height (the visible area under the pinned bar) first, aim at the host's top just under the bar, and
// re-aim twice after the feed has mounted and settled unless the reader has taken over with a finger, wheel or key.
function fdJump(host) {
  if (!host) return;
  const hb = () => { const a = document.querySelector(".rp-bar") || document.querySelector(".gl-page > .art-top"); return typeof glDesk === "function" && glDesk() ? 60 : (a && a.offsetHeight || 56); };
  const top = () => host.getBoundingClientRect().top - hb();
  host.style.transition = "none";   // a global "transition: all" otherwise eases min-height 1px -> full and a stuck transition leaves the page too short to scroll
  host.style.minHeight = Math.max(240, innerHeight - hb()) + "px";
  let manual = false; const evs = ["wheel", "touchstart", "keydown", "mousedown"];
  const cleanupIn = () => evs.forEach(e => removeEventListener(e, stop, true)), stop = () => { manual = true; cleanupIn(); };
  evs.forEach(e => addEventListener(e, stop, { capture: true, passive: true }));
  const go = beh => scrollTo({ top: Math.max(0, scrollY + top()), behavior: reduceMotion ? "auto" : beh });
  go("smooth");
  [1100, 2200].forEach((ms, n) => setTimeout(() => { if (!manual && host.isConnected && Math.abs(top()) > 4) go("smooth"); if (n) cleanupIn(); }, ms));
}
function fdMountColor(host, o) {
  if (!host) return;
  let started = false;
  const go = () => fdMount(host, o);
  const wait = () => { started = true; if (GAL) go(); else loadGallery().then(go).catch(() => { host.insertAdjacentHTML("beforeend", `<p class="fine">The paintings didn't load.</p>`); }); };
  if (o.about) return wait();   // the feed is the body of the page now (chips right under the hero): draw it at once
  // the page is still filling in when it is drawn, so "near" also needs the reader to have started scrolling (or a page too short to scroll)
  const near = () => { if (host.getBoundingClientRect().top < innerHeight * 2.6 && (scrollY > 200 || document.documentElement.scrollHeight < innerHeight * 1.3)) { removeEventListener("scroll", near); wait(); } };
  if (!host.style.minHeight) host.style.minHeight = "1px";
  if (o.backNav && FD_MEMO.has("c:" + o.sub.hex)) return wait();
  addEventListener("scroll", near, { passive: true });
  const poll = setInterval(() => { if (!host.isConnected || started) clearInterval(poll); else near(); }, 400);   // the page settles after mount with no scroll event: look again until it starts
  cleanup.push(() => { removeEventListener("scroll", near); clearInterval(poll); }); near();
}
