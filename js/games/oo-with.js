"use strict";
// Odd one out, played with one painter's (or movement's, decade's, look's) colors (David, 2026-10-11). The main
// game stays one tap; this is a way in from a painter, movement or painting page's ⋯, from the pause menu's
// "Play with…", or from an address (#/odd/painter/<slug>, #/odd/movement/<slug>, #/odd/decade/<1870>,
// #/odd/look/<id>). Every round's gradient comes from ONE of their paintings' own measured palette, a different
// painting each round, named in the reveal ("Round 7 · Claude Monet, Impression, Sunrise, 1872", tappable).
//
// The data: data/games/oo/ (tools/oo_collections.py). For each painter/movement/decade with enough paintings:
// a swatch book (area-weighted OKLab k-means over ALL their measured palettes), palette families (their paintings
// clustered on those swatches), and their works, each with its own six measured colors, its family, how typical
// it is of the collection, whether it's famous, and each color's weight in the collection's profile. Looks have
// no member paintings, so a look's "works" are its own named palettes (data/looks.js), one per round.
// oo-engine.js is untouched: a round still only sees a plain { colors, label, link } palette object.

const OO_W_DIR = "data/games/oo/";
const OO_W_KINDS = { painter: "Painter", movement: "Movement", decade: "Decade", look: "Look" };
let OO_W_INDEX = null, OO_W_INDEX_P = null;
const OO_W_CACHE = new Map();      // "kind/id" -> collection, or the pending fetch
const ooWv = () => (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "");

// ---------- loading ----------
// the searchable list: the built collections plus every look that has palettes. Resolves [] on failure, so a
// caller only ever has to handle "nothing found".
function ooWithIndex() {
  if (OO_W_INDEX) return Promise.resolve(OO_W_INDEX);
  if (!OO_W_INDEX_P) {
    try { if (typeof loadData === "function" && !window.LOOKS) loadData("looks"); } catch (e) {}
    OO_W_INDEX_P = fetch(OO_W_DIR + "index.json" + ooWv()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => (OO_W_INDEX = (j.c || []).map(c => ({ k: c[0], id: c[1], name: c[2], n: c[3], sw: c[4], fam: c[5], top: c[6] }))))
      .catch(e => { OO_W_INDEX_P = null; return []; });
  }
  return OO_W_INDEX_P;
}
const ooWithLooks = () => (Array.isArray(window.LOOKS) ? window.LOOKS : []).filter(l => (l.pals || []).some(p => (p.c || []).length >= 3))
  .map(l => ({ k: "look", id: l.id, name: l.name, n: l.pals.length, sw: 0, fam: 0, top: (l.pals[0].c || []).slice(0, 3).map(x => x[0]) }));
// a painter's collection by gallery painter name (the painting page knows the name, not always the slug)
const ooWithFind = (kind, idOrName) => (OO_W_INDEX || []).find(e => e.k === kind && (e.id === idOrName || e.name === idOrName)) || null;
// a ⋯ item for another lane's page: [] until the index is in (it kicks the load) or when there's no collection
function ooWithItem(kind, idOrName, o = {}) {
  if (!OO_W_INDEX) { ooWithIndex(); return []; }
  const e = ooWithFind(kind, idOrName);
  if (!e) return [];
  return [{ t: e.k === "decade" ? `Play with colors of the ${e.name.replace(/^The /, "")}` : `Play with ${ooWithWhose(e)} colors`, n: `Odd one out · a different ${kind === "decade" ? "painting from the " + e.name.replace(/^The /, "") : kind === "painter" ? "painting of theirs" : "painting"} each round`, run: () => ooWithStart(e.k, e.id, o) }];
}
const ooWithWhose = e => e.k === "look" ? `the ${e.name} look's` : `${e.name}'s`;

// a work, normalized: { gi (gallery index, -1 for a featured page or a look palette), title, year, artist, fam,
// typ (0-100), famous, colors (its 12-color Diverse palette, or a look palette's own): [{ h, share, pw }], thumb, pid, link }
function ooWithNorm(c, w) {
  const [gi, title, year, fam, typ, famous, cols, thumb, pid, artist] = w;
  return { gi, title, year, fam, typ, famous: !!famous, colors: cols.map(x => ({ h: x[0], share: x[1] / 1000, pw: x[2] })), thumb: thumb || "", pid: pid || "",
    artist: c.k === "painter" ? c.name : artist || "", link: gi >= 0 ? { kind: "gallery", id: gi } : pid ? { kind: "painting", id: pid } : null };
}
function ooWithLoad(kind, id) {
  const key = kind + "/" + id, have = OO_W_CACHE.get(key);
  if (have) return Promise.resolve(have);
  if (kind === "look") {
    const l = (window.LOOKS || []).find(x => x.id === id);
    if (!l) return (typeof loadData === "function" ? Promise.resolve(loadData("looks")) : Promise.resolve()).then(() => (window.LOOKS || []).find(x => x.id === id) ? ooWithLoad(kind, id) : null).catch(() => null);
    const works = (l.pals || []).filter(p => (p.c || []).length >= 3).map((p, i) => ({ gi: -1, title: p.n, year: "", artist: "", fam: 0, typ: 50, famous: false,
      colors: p.c.map(x => ({ h: x[0], share: +x[2] || 0, pw: 50 })), thumb: "", pid: "", link: { kind: "look", id: l.id } }));
    const col = { k: "look", id, name: l.name, n: works.length, sw: [], fam: [], works };
    OO_W_CACHE.set(key, col);
    return Promise.resolve(col);
  }
  return fetch(`${OO_W_DIR}${kind}/${encodeURIComponent(id)}.json${ooWv()}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(c => { const col = { ...c, works: c.works.map(w => ooWithNorm(c, w)) }; OO_W_CACHE.set(key, col); return col; })
    .catch(() => null);
}
// load, then play. From a page this lands on the pre-game picker (with the collection named on it); from the
// pause menu it skips straight to the board (the size was already chosen).
function ooWithStart(kind, id, o = {}) {
  return ooWithLoad(kind, id).then(col => {
    if (!col || !col.works.length) { toast("These colors couldn't load. Check your connection and try again."); return false; }
    ooMap({ with: col, skipPicker: !!o.skipPicker, zen: o.zen, first: o.first });
    return true;
  });
}

// four dots that say "this collection": its most characteristic vivid swatches -- weight x hue lift, chroma at
// least 25 and lightness at least 45 (CIELAB), then a softer 12 / 38 pass, hues 25° apart; the heaviest swatches alone are mostly varnish-grey
// ground, which isn't how anyone pictures Monet. The same rule as tools/oo_collections.py's search-list dots.
const ooWithDots = col => {
  const all = (col.sw || []).map(([h, w]) => { const [L, C, H] = lch(h); return { h, L, C, H, sc: w * ooWLift(col.lift, ooOklab(h)) }; }).sort((a, b) => b.sc - a.sc), out = [];
  // vivid first; then, for a narrow-palette painter (Rembrandt), lighter softer colors before any black
  [[25, 45], [12, 38]].forEach(([mC, mL]) => all.forEach(x => { if (out.length < 4 && x.C >= mC && x.L >= mL && !out.includes(x) && out.every(o => { const d = Math.abs(o.H - x.H) % 360; return Math.min(d, 360 - d) > 25; })) out.push(x); }));
  const hs = out.map(o => o.h);
  // fill any gap with each family's own color (then the first palette's), never replace what was found
  [...(col.fam || []).map(x => x[1] && x[1][0]), ...(col.works[0] ? col.works[0].colors.map(c => c.h) : [])].forEach(h => { if (h && hs.length < 4 && !hs.includes(h)) hs.push(h); });
  return hs;
};

// ---------- one round's stops from one work's palette ----------
// David, 2026-10-11: "I want Monet's vivid colors and gradients of two similar colors, not his boring dull
// colors -- that doesn't even feel like him." So a round is two SIMILAR, VIVID colors from one painting (a blue
// and the violet beside it, two greens of the same meadow), not its area-weighted ground: the candidates are the
// painting page's own 12-color Diverse palette (gallery.js glPoolDiverse, built by tools/oo_collections.py), each
// weighted by how vivid it looks, by how often the painter returns to that color across ALL their paintings (pw:
// the percentile of its nearest swatch among the collection's chromatic swatches), and by how much more than the
// whole archive this painter uses its hue (col.lift: the warm cast every varnished photograph shares doesn't
// lift, Monet's blues do), so the pair reads as theirs. Dark oranges and yellows (browns) never count as vivid.
// Similar = OKLab 0.035-0.16 apart and hues within 55° (close enough to sweep smoothly, far enough to see a
// sweep). Vivid = both stops at least 0.4 of the most saturated color the screen can show at their lightness
// and hue, one at least 0.55 (ooWRel), weighted ^1.5. The pair must also clear ooBeautyGood on its own and hold a
// light stop; a third color similar to both is
// added when one exists (the richer boards use three). outlier: one round in a few builds its pair around the
// painting's least-typical vivid color instead, for variety. Returns 2-3 hexes, or null.
const ooWL = h => { try { return lch(h)[0]; } catch (e) { return 0; } };
// how vivid a color LOOKS: its chroma as a share of the most this screen can show at that lightness and hue
// (CIELAB chroma alone runs far higher for yellows than for blues, so a Monet blue would lose to any ochre)
function ooWRel(L, C, H) {
  let lo = 0, hi = 160;
  const ca = Math.cos(H * Math.PI / 180), sa = Math.sin(H * Math.PI / 180);
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (inGamut(L, m * ca, m * sa)) lo = m; else hi = m; }
  return lo > 1 ? Math.min(1, C / lo) : 0;
}
// the collection's hue lift for an OKLab color (tools/oo_collections.py: its vivid-area share in that 30° hue
// bin over the whole archive's), clamped, so a hue the painter reaches for far more than everyone counts more
const ooWLift = (lift, ok) => { if (!lift) return 1; const H = (Math.atan2(ok[2], ok[1]) * 180 / Math.PI + 360) % 360; return clamp(lift[Math.floor(H / 30) % 12] || 1, .25, 4); };
function ooWithCands(work, soft, lift) {
  const seen = new Set(), out = [];
  work.colors.forEach(c => {
    if (seen.has(c.h) || c.share < .004) return; seen.add(c.h);
    const [L, C, H] = lch(c.h), ok = ooOklab(c.h);
    if (C < (soft ? 10 : 18) || L < 28 || L > 96) return;
    // a dark orange or yellow reads as brown, not as a vivid color, however saturated it measures
    if (!soft && H >= 40 && H <= 110 && L < 52) return;
    const rel = ooWRel(L, C, H);
    if (rel < (soft ? .2 : .4)) return;
    const lf = ooWLift(lift, ok);
    out.push({ h: c.h, L, C, H, ok, rel, lf, pw: c.pw, s: Math.pow(rel, 1.5) * Math.pow(lf, .8) * (.5 + c.pw / 100) * Math.pow(Math.max(c.share, .004), .2) });
  });
  return out;
}
const ooWDist = (a, b) => Math.hypot(a.ok[0] - b.ok[0], a.ok[1] - b.ok[1], a.ok[2] - b.ok[2]);
const ooWHue = (a, b) => { const d = Math.abs(a.H - b.H) % 360; return d > 180 ? 360 - d : d; };
const ooWSimilar = (a, b, soft) => { const d = ooWDist(a, b); return d >= .035 && d <= (soft ? .2 : .16) && ooWHue(a, b) <= (soft ? 70 : 55); };
function ooWithStops(work, outlier, soft, lift) {
  const cs = ooWithCands(work, soft, lift);
  if (cs.length < 2) return null;
  const odd = outlier ? cs.reduce((a, c) => (c.pw < a.pw ? c : a), cs[0]) : null;
  let best = null;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    if (odd && a !== odd && b !== odd) continue;
    if (!ooWSimilar(a, b, soft) || Math.max(a.L, b.L) < (soft ? 42 : 50)) continue;
    if (!soft && (!ooBeautyGood([a.h, b.h]) || Math.max(a.rel, b.rel) < .55)) continue;
    const sc = (a.s + b.s) * (ooWDist(a, b) <= .12 ? 1 : .85);
    if (!best || sc > best.sc) best = { sc, pair: a.s >= b.s ? [a, b] : [b, a] };
  }
  if (!best) return outlier ? ooWithStops(work, false, soft, lift) : null;
  const [a, b] = best.pair;
  const third = cs.filter(c => c !== a && c !== b && ooWSimilar(c, a, soft) && ooWSimilar(c, b, soft)).sort((x, y) => y.s - x.s)[0];
  const out = [a.h, b.h, ...(third ? [third.h] : [])];
  out.lift = Math.sqrt(a.lf * b.lf);   // how characteristic this pair's hues are of the collection (the rotation reads it)
  return out;
}
// the softer pass, for a collection whose canvases are mostly dark or muted as photographed: the same "two
// similar colors" rule with lower bars (a light enough stop, a little color), never the ground's greys
const ooWithLumStops = (work, lift) => ooWithStops(work, false, true, lift);
const ooWithLum = w => { const cs = ooWithCands(w, true, null); return cs.length ? Math.max(...cs.map(c => c.L)) + .5 * Math.max(...cs.map(c => c.C)) : 0; };

// ---------- the rotation: a different painting every round ----------
// Representative works come up most (typicality, squared), famous ones three times as often, works whose pair
// sits in the collection's lifted hues far more often (lift^1.5: Monet's blues and violets lead, the warm
// cast every varnished photo shares trails), every palette
// family takes its turn (a family played less so far is favored), nothing repeats within the last stretch of
// rounds, and one round in six reaches for one of their least typical works on purpose, for variety. next(n) is
// idempotent per round number (a live re-deal in the pause menu redraws the same painting, not a new one).
function ooWithSession(col, first) {
  const works = col.works;
  const ok = new Map(), lum = new Map();
  const lift = col.lift || null;
  works.forEach((w, i) => { const s = ooWithStops(w, false, false, lift); if (s) ok.set(i, s); });
  // a collection where too few works make a vivid pair (under 12, so the rotation would repeat) is topped up
  // with its most luminous works on the softer rule
  let luminous = false;
  if (ok.size < Math.min(12, works.length)) {
    const byLum = works.map((w, i) => [i, ooWithLum(w)]).sort((a, b) => b[1] - a[1]);
    const want = Math.max(12, Math.round(works.length * .3));
    for (const [i] of byLum) { if (ok.size + lum.size >= want) break; if (ok.has(i)) continue; const s = ooWithLumStops(works[i], lift); if (s) lum.set(i, s); }
    luminous = lum.size > 0;
  }
  // started from a painting's own page: that painting plays round 1, on the softer rule if it has to (a muted
  // canvas like Impression, Sunrise still has its sun), rather than quietly starting somewhere else
  const firstIdx = first != null ? works.findIndex(w => w.gi === first || w.pid === first) : -1;
  if (firstIdx >= 0 && !ok.has(firstIdx) && !lum.has(firstIdx)) { const s = ooWithLumStops(works[firstIdx], lift); if (s) lum.set(firstIdx, s); }
  const pool = [...ok.keys(), ...lum.keys()];
  const famPlays = {}, recent = [], byRound = new Map(), log = [];
  const memo = Math.max(1, Math.min(15, Math.floor(pool.length / 2)));
  const typRank = pool.slice().sort((a, b) => works[a].typ - works[b].typ);
  const lowTyp = new Set(typRank.slice(0, Math.max(1, Math.floor(typRank.length / 3))));
  function choose(n) {
    if (!pool.length) return null;
    if (n === 1 && firstIdx >= 0 && (ok.has(firstIdx) || lum.has(firstIdx))) return firstIdx;
    const fresh = pool.filter(i => !recent.includes(i));
    const cand = fresh.length ? fresh : pool;
    const variety = n % 6 === 0 && cand.some(i => lowTyp.has(i));
    const list = variety ? cand.filter(i => lowTyp.has(i)) : cand;
    const minF = Math.min(...list.map(i => famPlays[works[i].fam] || 0));
    // a work whose vivid pair sits in the hues this painter reaches for more than everyone else comes up more
    const wts = list.map(i => { const w = works[i], st = ok.get(i) || lum.get(i); return Math.pow(.3 + w.typ / 100, 2) * (w.famous ? 3 : 1) * Math.pow((st && st.lift) || 1, 1.5) / (1 + 1.5 * ((famPlays[w.fam] || 0) - minF)); });
    let t = Math.random() * wts.reduce((a, b) => a + b, 0);
    for (let j = 0; j < list.length; j++) { t -= wts[j]; if (t <= 0) return list[j]; }
    return list[list.length - 1];
  }
  function next(n) {
    if (byRound.has(n)) return byRound.get(n);
    const i = choose(n);
    if (i == null) return null;
    const w = works[i];
    const outlier = n % 5 === 0 && ok.has(i) ? ooWithStops(w, true, false, lift) : null;
    const stops = outlier || ok.get(i) || lum.get(i);
    const who = col.k === "painter" ? "" : w.artist ? w.artist + ", " : "";
    const pal = { colors: stops, label: `Round ${n} · ${col.k === "painter" ? col.name + ", " : col.k === "look" ? col.name + ": " : who}${w.title}${w.year ? ", " + w.year : ""}`,
      link: w.link, plain: true, work: i };
    famPlays[w.fam] = (famPlays[w.fam] || 0) + 1;
    recent.push(i); if (recent.length > memo) recent.shift();
    byRound.set(n, pal);
    return pal;
  }
  // an answer is filed against the painting it was drawn from (the end screen's mosaic)
  const answer = (pal, ok1) => { if (pal && pal.work != null) log.push({ work: pal.work, ok: !!ok1 }); };
  return { col, next, answer, log, luminous, poolSize: pool.length };
}

// ---------- the end screen: "Claude Monet's palette, played" ----------
// a gallery thumb from data/gallery/thumbs.txt's own compact code (the same mapping js/paintmap.js pmThumb uses)
function ooWithThumbURL(code) {
  if (!code) return "";
  if (/^img\//.test(code)) return code;   // a featured page's own thumb
  const k = code[0], a = code.slice(1);
  return k === "L" ? "img/gallery/" + a : k === "C" ? `https://commons.wikimedia.org/wiki/Special:FilePath/${a}?width=200`
    : k === "M" ? `https://iiif.micr.io/${a}/full/200,/0/default.jpg` : k === "N" ? `https://api.nga.gov/iiif/${a}/full/200,/0/default.jpg`
    : k === "V" ? "https://openaccess-cdn.clevelandart.org/" + a : k === "E" ? "https://images.metmuseum.org/CRDImages/" + a : a;
}
function ooWithOpenLink(link) {
  if (!link) return;
  if (link.kind === "gallery") location.hash = "#/gallery/" + link.id;
  else if (link.kind === "painting") location.hash = "#/painting/" + String(link.id).replace(/^painting-/, "");
  else if (link.kind === "look") location.hash = "#/look/" + link.id;
}
// the played paintings as a small mosaic, in play order (a painting played twice shows once, with its tally)
function ooWithEndHTML(sess, st) {
  const col = sess.col, seen = new Map();
  sess.log.forEach(x => { const s = seen.get(x.work) || { work: x.work, n: 0, ok: 0 }; s.n++; s.ok += x.ok ? 1 : 0; seen.set(x.work, s); });
  const tiles = [...seen.values()].map(s => {
    const w = col.works[s.work], url = ooWithThumbURL(w.thumb), dom = (w.colors[0] || {}).h || "#5F5F5F";
    const strip = w.colors.slice().sort((a, b) => b.share - a.share).slice(0, 5).map(c => `<i style="--c:${c.h}"></i>`).join("");
    const mark = s.ok === s.n ? "oo-wm-ok" : s.ok ? "oo-wm-half" : "oo-wm-miss";
    return `<button class="oo-wm ${mark}" data-wwork="${s.work}" style="--c:${dom}" aria-label="${esc(w.title)}${s.ok === s.n ? ", seen" : ", missed"}">
      ${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}<span class="oo-wm-strip">${strip}</span></button>`;
  }).join("");
  const right = sess.log.filter(x => x.ok).length, played = seen.size;
  const head = col.k === "painter" ? `${esc(col.name)}'s palette, <em>played.</em>` : col.k === "look" ? `The ${esc(col.name)} look, <em>played.</em>` : `${esc(col.name)}, <em>played.</em>`;
  const lede = sess.log.length ? `${right} of ${sess.log.length} right, across ${played} ${col.k === "look" ? "palette" : "painting"}${played === 1 ? "" : "s"}.` : "No rounds finished.";
  const book = col.sw && col.sw.length ? `Every round came from one painting's own measured colors, checked against ${col.k === "painter" ? "their" : "its"} ${col.sw.length}-color swatch book, built from all ${col.n} paintings here.` : col.k === "look" ? "Every round came from one of this look's named palettes." : "";
  return `<p class="eyebrow">Odd one out · ${OO_W_KINDS[col.k] || ""}</p>
    <h1>${head}</h1>
    <p class="lede">${esc(lede)}</p>
    ${tiles ? `<div class="oo-wmosaic">${tiles}</div>` : ""}
    ${book ? `<p class="fine">${esc(book)}${sess.luminous ? " Most of these canvases photograph dark, so this played their most luminous ones." : ""} Colors are as photographed (varnished paintings), and screens vary.</p>` : ""}`;
}
function ooWithWireEnd(root, sess) {
  root.querySelectorAll("[data-wwork]").forEach(b => b.onclick = () => ooWithOpenLink(sess.col.works[+b.dataset.wwork].link));
}

// ---------- the search sheet (inside the pause card) ----------
const ooWNorm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function ooWithSuggest() {
  const ix = OO_W_INDEX || [], pick = (k, n) => ix.filter(e => e.k === k).slice(0, n);
  const looks = ooWithLooks().filter(l => ["impressionism", "ukiyo-e", "art-nouveau", "fauvism"].includes(l.id));
  return [...pick("painter", 5), ...pick("movement", 2), ...looks.slice(0, 2), ...pick("decade", 0)];
}
function ooWithSearch(q) {
  const t = ooWNorm(q).trim();
  if (!t) return ooWithSuggest();
  const all = [...(OO_W_INDEX || []), ...ooWithLooks()];
  const score = e => { const n = ooWNorm(e.name), at = n.indexOf(t); if (at < 0) return /^\d{3,4}s?$/.test(t) && e.k === "decade" && n.includes(t.replace(/s$/, "")) ? 1 : -1; return (at === 0 || n[at - 1] === " " ? 3 : 1) + Math.min(1, e.n / 200); };
  return all.map(e => [e, score(e)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
}
function ooWithRowHTML(e) {
  // short enough for a 320px phone: a painter's line carries their swatch-book size, the others say what they are
  const meta = e.k === "look" ? `Look · ${e.n} palette${e.n === 1 ? "" : "s"}` : e.k === "painter" ? `${e.n.toLocaleString()} paintings · ${e.sw} colors` : `${OO_W_KINDS[e.k]} · ${e.n.toLocaleString()} paintings`;
  return `<button class="oo-with-row" data-wk="${e.k}" data-wid="${esc(e.id)}"><span class="oo-with-dots">${(e.top || []).slice(0, 3).map(h => `<i style="--c:${h}"></i>`).join("")}</span><span class="oo-with-txt"><b>${esc(e.name)}</b><small>${esc(meta)}</small></span>${ICON.chev}</button>`;
}
// fills `card` with the search; back() returns to the pause menu; cur is the collection playing now (or null)
function ooWithSheet(card, cur, back, onPick) {
  card.innerHTML = `
    <div class="oo-with-head"><button class="icon-btn" data-wback aria-label="Back">${ICON.back}</button><h2>Play with…</h2></div>
    <input class="oo-with-q" type="search" placeholder="Painter, movement, decade, look" aria-label="Search painters, movements, decades and looks" autocomplete="off" enterkeyhint="search">
    ${cur ? `<button class="oo-with-row oo-with-all" data-wall><span class="oo-with-txt"><b>All colors</b><small>Back to the usual mix</small></span>${ICON.chev}</button>` : ""}
    <div class="oo-with-list" aria-live="polite"><p class="oo-with-note">Loading…</p></div>`;
  const input = card.querySelector(".oo-with-q"), list = card.querySelector(".oo-with-list");
  card.querySelector("[data-wback]").onclick = back;
  const all = card.querySelector("[data-wall]"); if (all) all.onclick = () => onPick(null);
  const draw = () => {
    const res = ooWithSearch(input.value);
    list.innerHTML = res.length ? (input.value.trim() ? "" : `<p class="oo-with-note">A different painting's colors every round.</p>`) + res.map(ooWithRowHTML).join("")
      : `<p class="oo-with-note">${OO_W_INDEX && OO_W_INDEX.length ? "Nothing by that name with enough paintings here. Painters need at least 12 in the archive." : "The list couldn't load. Check your connection."}</p>`;
    list.querySelectorAll("[data-wk]").forEach(b => b.onclick = () => {
      if (b.classList.contains("busy")) return;
      b.classList.add("busy"); b.querySelector("small").textContent = "Loading…"; buzz(4);
      ooWithLoad(b.dataset.wk, b.dataset.wid).then(col => { if (!col) { b.classList.remove("busy"); b.querySelector("small").textContent = "Couldn't load. Tap to try again."; return; } onPick(col); });
    });
  };
  input.addEventListener("input", draw);
  ooWithIndex().then(() => { if (card.isConnected) draw(); });
}
