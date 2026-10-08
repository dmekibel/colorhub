"use strict";
// Learning past the first units (lane L9a; David's #1 ask, "I want to be able to learn more colors").
// Three things live here:
//  1. Card ids for every learnable color. The first units keep their ids ("t2-blues:Teal"); any other core name
//     is "core:<slug>" and any library color is "lib:<slug>". cardIdFor(color) gives the id, colorForCard(id)
//     gives the color back ({ id, n, h, fam, unit, vs, d, … }), and every card stores its own n and h, so a
//     card resolves even before the name lists have loaded (core.js migrateState v3 backfills old cards).
//  2. The path past the first units: learnUnitsAll() = the units in data/colors.js, then generated units from
//     the learning order (useRank), in stages: 150 · 250 · 400 · Fluent (every real color word: 655 today) ·
//     Expert (plus their variations: all 984 core names) · Every learnable color (plus the library's learnable
//     cards, teach:false skipped: 1,225 today). The last checkpoint is the honest ceiling, sized from the data; an
//     extra cut at about 1,500 appears only if the data ever grows past it. Families mix inside a unit; compounds ("Light teal") are taught as variations of their base word, after it;
//     near-duplicates are never a second card.
//  3. Look-alikes from all ~1,000 names in the same family, never closer than LX_LOOK_MIN (so every pair is
//     solvable): lookalikes() (js/lookalikes.js), Learn it (js/learnit.js), Pick it (js/pickit.js) and Say it
//     (js/produce.js) all draw from lxLookPool().
// Honest by construction: a card only becomes "Yours" the usual way (a check a day or more later, js/pickit.js).
// The UI never calls the first units a special list: they're simply where the path starts.

// ---------- tunables ----------
const LX_UNIT_N = 8;          // new names per generated unit (the first units hold 6-10)
const LX_FAM_MAX = 2;         // at most this many from one family in a unit (the Journey's "mix families")
const LX_SPREAD = 10;         // CIEDE2000: two new names in one unit at least this far apart, or the later one waits
const LX_DUP = 2.5;           // CIEDE2000: a library color this close to one already on the path is the same card
const LX_LOOK_MIN = 5;        // look-alikes are at least 5% different (side by side, clearly two colors)
const LX_LOOK_MAX = 30;       // …and at most 30% (past that they aren't look-alikes)
const LX_ALL_NAME = "Every learnable color";   // the last checkpoint: the honest ceiling, sized from the data
// word-count checkpoints after the first units. 0 = "every real word" and "every variation": the real count.
const LX_STAGE_PLAN = [[150, ""], [250, ""], [400, ""], [0, "Fluent"], [0, "Expert"], [1500, ""], [0, LX_ALL_NAME]];
const LX_STAGE_GUESS = { Fluent: 655, Expert: 984, [LX_ALL_NAME]: 1225 };   // shown (as "about") until the lists have loaded

// ---------- small helpers ----------
const lxSlug = n => String(n).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const lxLab = c => c.lab || (c.lab = lab(c.h));
const lxLch = c => c._lch || (c._lch = lch(c.h));
const lxDe = (a, b) => de2000(lxLab(a), lxLab(b));
const lxNum = n => Number(n).toLocaleString("en-US");
// "Prussian blue" and "Payne's grey" keep their capital in running text; everything else reads lower case
const LX_PROPER = /^(?:[A-Z][a-z]+(?:ian|ese|'s|’s)|Paris|Naples|Kelly|Tiffany|Mars|Berlin|Brunswick|Cambridge|Oxford|Carolina|Columbia|Pacific|Windsor|Vandyke|Van|Sèvres|Sevres|Davy's|Hooker's|Payne's|Hansa|Alice|Lincoln|Kendal|Bristol|Tyrian|Egyptian|Prussian|Turkish|Spanish|French|English|Chinese|Japanese|Indian|Persian|Venetian|Pompeian|Pompeiian|Nile|Delft|Majorelle|Klein|Schweinfurt|Scheele's|Cooper)$/;
const lxLower = n => { const w = String(n).split(" "); return LX_PROPER.test(w[0]) ? [w[0], ...w.slice(1).map(s => s.toLowerCase())].join(" ") : String(n).toLowerCase(); };
// Families by perceived hue, for mixing a unit and for "same family" look-alikes (the same bands as js/gym.js)
function lxFam(h) {
  const [L, C, H] = lch(h);
  if (C < 12) return "Greys";
  if (H >= 345 || H < 40) return L > 70 ? "Pinks" : "Reds";
  if (H < 70) return L < 48 ? "Browns" : "Oranges";
  if (H < 100) return L < 55 ? "Browns" : "Yellows";
  if (H < 195) return "Greens";
  if (H < 290) return "Blues";
  return L > 72 ? "Pinks" : "Purples";
}
// Same family, read softly so a family edge never splits obvious look-alikes (teal and turquoise): two near-greys,
// a grey and a faint tint, or two hues within 40°.
function lxSameFam(a, b) {
  const [, Ca, Ha] = lxLch(a), [, Cb, Hb] = lxLch(b);
  if (Ca < 10 && Cb < 10) return true;
  if (Math.min(Ca, Cb) < 10) return Math.max(Ca, Cb) < 22;
  const g = Math.abs(((Ha - Hb) % 360 + 540) % 360 - 180);
  return g <= 40;
}

// ======================================================================
// 1. Learnable colors and card ids
// ======================================================================
// A learnable color outside the first units. kind: "core" | "lib". Its neighbor line (vs/d) is worked out the
// first time something reads it (lxNb), against a name you meet before it on the path.
function lxMake(kind, e) {
  const c = { id: kind + ":" + lxSlug(e.n), n: e.n, h: String(e.h).toUpperCase(), kind, rank: e.rank, useRank: e.useRank, teach: e.teach,
    src: e.src || [], also: e.also, notes: e.notes, lab: e.lab || lab(e.h), ord: Infinity, unit: null,
    compound: e.compound, baseSlug: e.base, field: e.field };   // compound/base (core) and field (library) come from the data (lane L15)
  c.fam = lxFam(c.h);
  c.unit = { title: c.fam, fam: true };
  ["vs", "d", "vsC"].forEach(k => Object.defineProperty(c, k, { get: () => lxNb(c)[k], enumerable: false, configurable: true }));
  // the meet page's second line: the other names the lists give this same color (honest, from the data)
  const also = (e.also || []).filter(a => !/[()0-9]/.test(a)).slice(0, 3);
  if (also.length) c.o = `Also called ${also.map(lxLower).join(", ")}${(e.also || []).length > also.length ? ", and more" : ""}.`;
  return c;
}
// The core list as learnable colors: the first units' own objects where the name is one of them, else a "core" color.
let LX_CORE = null;
function lxCore() {
  if (typeof CORE_NAMES === "undefined" || !CORE_NAMES || !CORE_NAMES.length) return null;
  if (LX_CORE && LX_CORE.src === CORE_NAMES) return LX_CORE;
  const bySlug = new Map(), list = [];
  CORE_NAMES.forEach(e => {
    const c = BYNAME.get(e.n.toLowerCase()) || lxMake("core", e);
    list.push(c); bySlug.set(lxSlug(e.n), c);
  });
  LX_CORE = { src: CORE_NAMES, list, bySlug };
  LX_PLAN = null;
  return LX_CORE;
}
// The library (js/graph.js loadLongNames): only colors that aren't already a core name, aren't crude, carry an English
// title (the data gives Japanese-sourced colors an English title; the Japanese name stays a note) and no source
// qualifier like "(Crayola)".
let LX_LIB_SRC = null, LX_LIB = null, LX_LIB_LOADING = null;
function lxLibLoad() {
  if (LX_LIB_SRC) return Promise.resolve(lxLib());
  if (typeof loadLongNames !== "function") return Promise.resolve(null);
  return LX_LIB_LOADING || (LX_LIB_LOADING = Promise.all([loadCoreNames(), loadLongNames()]).then(([, list]) => { LX_LIB_SRC = list || []; LX_PLAN = null; return lxLib(); }));
}
const lxLibOk = e => e && !e.crude && /^#[0-9a-f]{6}$/i.test(e.h) && !/[()0-9]/.test(e.n);
function lxLib() {
  if (!LX_LIB_SRC) return null;
  if (LX_LIB && LX_LIB.src === LX_LIB_SRC) return LX_LIB;
  const core = lxCore(), coreSet = new Set(core ? core.list.map(c => c.n.toLowerCase()) : []);
  const bySlug = new Map(), list = [];
  LX_LIB_SRC.forEach(e => {
    if (!lxLibOk(e) || coreSet.has(e.n.toLowerCase())) return;
    const s = lxSlug(e.n); if (bySlug.has(s)) return;
    const c = lxMake("lib", e); list.push(c); bySlug.set(s, c);
  });
  LX_LIB = { src: LX_LIB_SRC, list, bySlug };
  return LX_LIB;
}
// The id of any learnable color: one of the first units -> its unit id; a basic -> null (basics are placement only,
// never a card); any other core name -> "core:<slug>"; anything else -> "lib:<slug>". Accepts a color, an
// entry from the name lists ({ n, h, rank } or { n, h, fam }), or a name.
function cardIdFor(c) {
  if (!c) return null;
  if (typeof c === "string") c = { n: c };
  if (c.id && /^(core|lib):/.test(c.id)) return c.id;
  const t = c.n && BYNAME.get(String(c.n).toLowerCase());
  if (t) return t.basic ? null : t.id;
  if (!c.n) return c.id || null;
  const s = lxSlug(c.n), core = lxCore();
  if (core && core.bySlug.has(s)) return "core:" + s;
  if (core) return "lib:" + s;
  // before the core list has loaded: an entry from it carries a rank; a library entry carries a family label
  return (c.kind === "lib" || (c.rank == null && (c.fam || c.app))) ? "lib:" + s : "core:" + s;
}
// id -> the learnable color. Falls back on the card's own n/h (a card always resolves), else null.
let LX_BYID = null;
const LX_FALLBACK = new Map();
function colorForCard(id) {
  if (!id) return null;
  if (!LX_BYID) LX_BYID = new Map([...BASICS, ...ALL].map(c => [c.id, c]));
  const own = LX_BYID.get(id); if (own) return own;
  const m = /^(core|lib):(.+)$/.exec(id);
  if (m) {
    const src = m[1] === "core" ? lxCore() : lxLib();
    const hit = src && src.bySlug.get(m[2]);
    if (hit) return hit;
  }
  const st = typeof S !== "undefined" && S && S.cards && S.cards[id];
  if (!st || !st.n || !/^#[0-9a-f]{6}$/i.test(st.h || "")) return null;
  let fb = LX_FALLBACK.get(id);
  if (!fb || fb.h !== st.h.toUpperCase()) {
    fb = lxMake(m ? m[1] : "core", { n: st.n, h: st.h });
    fb.id = id;   // an old unit id whose color has left the data keeps its own id
    LX_FALLBACK.set(id, fb);
  }
  return fb;
}
// Find a learnable color by name (the peek door and the look-alike sheet use this for names past the first units)
function lxByName(n) {
  if (!n) return null;
  const k = String(n).toLowerCase(), t = BYNAME.get(k); if (t) return t;
  const s = lxSlug(n), core = lxCore(), lib = lxLib();
  return (core && core.bySlug.get(s)) || (lib && lib.bySlug.get(s)) || null;
}
// A learnable color for a name-list entry (a name page, a swatch sheet): the same object every time.
function lxLearnable(entry) {
  if (!entry || !entry.n || entry.shade) return null;   // a computed shade is a description, never a word to learn
  const t = BYNAME.get(entry.n.toLowerCase()); if (t) return t.basic ? null : t;
  return colorForCard(cardIdFor(entry)) || (entry.h ? lxMake(cardIdFor(entry).split(":")[0], entry) : null);
}
// A name can be renamed or merged in the data (data/aliases.json maps old slugs to the canonical one). A card whose
// slug no longer resolves moves to its canonical id, once the lists are in; if that id already has a card, the one
// with more progress stays and the other is kept aside in S.cardsMerged (never thrown away).
let LX_REKEYED = false;
function lxRekey() {
  if (LX_REKEYED || typeof S === "undefined" || !S || !S.cards || !lxCore()) return;
  // a slug that now names a different card (a name that joined the first units, or core <-> library): move it now
  Object.keys(S.cards).forEach(id => {
    const m = /^(core|lib):(.+)$/.exec(id); if (!m) return;
    const hit = lxCore().bySlug.get(m[2]) || (lxLib() && lxLib().bySlug.get(m[2]));
    if (!hit || !hit.id || hit.id === id || hit.basic) return;
    const st = S.cards[id], have = S.cards[hit.id];
    if (have) { S.cardsMerged = S.cardsMerged || {}; if ((st.b || 0) > (have.b || 0)) { S.cardsMerged[hit.id] = have; S.cards[hit.id] = st; } else S.cardsMerged[id] = st; }
    else S.cards[hit.id] = st;
    delete S.cards[id]; save();
  });
  const lost = Object.keys(S.cards).filter(id => { const m = /^(core|lib):(.+)$/.exec(id); return m && !(m[1] === "core" ? lxCore() : lxLib() || { bySlug: new Map() }).bySlug.has(m[2]) && (m[1] === "core" || lxLib()); });
  if (!lost.length) return;
  LX_REKEYED = true;
  fetch("data/aliases.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).then(a => {
    const map = a && a.slugs; if (!map) return;
    let moved = 0;
    lost.forEach(id => {
      const slug = id.split(":")[1], to = map[slug]; if (!to) return;
      const nid = lxCore().bySlug.has(to) ? (lxCore().bySlug.get(to).id) : "lib:" + to;
      if (!nid || nid === id) return;
      const st = S.cards[id], have = S.cards[nid];
      if (have) { S.cardsMerged = S.cardsMerged || {}; S.cardsMerged[(have.b || 0) >= (st.b || 0) ? id : nid] = (have.b || 0) >= (st.b || 0) ? st : have; if ((st.b || 0) > (have.b || 0)) S.cards[nid] = st; }
      else S.cards[nid] = st;
      const c = colorForCard(nid); if (c) { S.cards[nid].n = c.n; S.cards[nid].h = c.h; }
      delete S.cards[id]; moved++;
    });
    if (moved) save();
  }).catch(() => { LX_REKEYED = false; });
}
// Every card's color (never a basic): dueList(), ownedCount() and ownCounts() run over this, not just the first units.
function cardColors() {
  if (typeof S === "undefined" || !S || !S.cards) return [];
  const out = [];
  Object.keys(S.cards).forEach(id => { const st = S.cards[id]; if (!st || typeof st !== "object") return; const c = colorForCard(id); if (c && !c.basic) out.push(c); });
  return out;
}
// A new card, carrying its own name and hex (core.js learnUnit, js/learnit.js hmSchedule)
const cardNew = (c, t) => ({ b: 0, due: addDays(t, 1), since: t, own: false, n: c.n, h: c.h });

// ---------- the neighbor line, for a color past the first units ----------
// A variation is shown against its base word ("You know teal. This lighter one is light teal."). Any other name is
// shown against the nearest name in its family you meet before it (the first units and basics count as met).
function lxNb(c) {
  if (c._nb) return c._nb;
  let vsC = null, d = "";
  if (c.base) {
    vsC = c.base;
    const w = lookDiff(c.base, c);
    d = w === "almost the same" ? `Nearly ${lxLower(c.base.n)} itself: ${lxLower(c.n)} is another name for it.`
      : `You know ${lxLower(c.base.n)}. This ${w.replace(" and ", ", ")} one is ${lxLower(c.n)}.`;
  } else {
    const core = lxCore(), lib = c.kind === "lib" ? lxLib() : null;
    const pool = [...BASICS, ...ALL, ...(core ? core.list : []), ...(lib ? lib.list : [])];
    let best = null, bd = Infinity;
    for (const x of pool) {
      if (x === c || x.n === c.n || !(x.ord < c.ord || (x.ord === undefined && !x.kind))) continue;   // first units/basics: ord undefined, always met
      if (!lxSameFam(c, x)) continue;
      const dd = lxDe(c, x); if (dd >= 3 && dd < bd) { bd = dd; best = x; }
    }
    if (best) { vsC = best; const w = lookDiff(best, c); d = w === "almost the same" ? `Almost the same as ${lxLower(best.n)}.` : `${w.charAt(0).toUpperCase() + w.slice(1)} than ${lxLower(best.n)}.`; }
  }
  return (c._nb = { vsC, vs: vsC ? vsC.n : "", d });
}

// ======================================================================
// 2. The path past the first units
// ======================================================================
// The learning order: `useRank` once the data carries it (lane L15), else a usefulness proxy until then: how many
// independent lists carry the name (the survey and the web standard count extra), then the list's own rank.
const lxScore = c => { const s = c.src || []; return s.length + (s.includes("xkcd") ? 1 : 0) + (s.includes("css") ? .5 : 0); };
function lxOrderCmp(a, b) {
  const ua = a.useRank != null, ub = b.useRank != null;
  if (ua && ub) return a.useRank - b.useRank;
  if (ua !== ub) return ua ? -1 : 1;
  return lxScore(b) - lxScore(a) || (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.n.localeCompare(b.n);
}
// A compound's base word: "Light teal" -> Teal, "Pinkish" -> Pink, "Bluish green" -> Green, "Blue green" -> Green,
// "Lime green" -> Lime (the distinctive word plus a basic hue word is a repeat). has(lowercase name) -> color or null.
const LX_MODS = new Set(["light", "dark", "pale", "deep", "dull", "dusty", "bright", "vivid", "pastel", "soft", "muted", "faded", "medium", "neon", "electric", "dirty", "dusky", "darkish", "lightish", "greyish", "grayish", "very", "strong", "brilliant", "moderate", "weak", "grayed", "greyed"]);
const LX_HUES = new Set(["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "grey", "gray", "black", "white", "violet"]);
function lxIsh(w, has) {
  const m = /^(.+?)ish$/.exec(w); if (!m) return null;
  const s = m[1];
  for (const t of [s, s + "e", s.replace(/(.)\1$/, "$1")]) { const x = has(t); if (x) return x; }
  return null;
}
function lxBaseOf(name, has) {
  const w = String(name).toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean);
  if (w.length === 1) return lxIsh(w[0], has);
  let k = 0; while (k < w.length - 1 && LX_MODS.has(w[k])) k++;
  if (k > 0) { const b = has(w.slice(k).join(" ")); if (b) return b; }
  if (lxIsh(w[0], has)) { const b = has(w.slice(1).join(" ")); if (b) return b; }
  const last = w[w.length - 1], head = w.slice(0, -1).join(" ");
  if (w.length === 2 && LX_HUES.has(w[0]) && LX_HUES.has(last)) return has(last);
  if (LX_HUES.has(last)) { const b = has(head); if (b) return b; }
  return null;
}
// Split a list into units of about LX_UNIT_N, mixing families and keeping each unit's names apart.
// Looks ahead at most three units' worth, so the order still decides what comes first.
function lxChunk(list) {
  const pending = list.slice(), out = [];
  let k = Math.max(1, Math.round(list.length / LX_UNIT_N));
  while (pending.length) {
    const size = Math.ceil(pending.length / k--), win = pending.slice(0, size * 3), pick = [], fam = {};
    // a name passed over twice goes first, so the order bends but never breaks (at most two units late)
    win.filter(c => (c._skip || 0) >= 2).slice(0, size).forEach(c => { pick.push(c); fam[c.fam] = (fam[c.fam] || 0) + 1; });
    for (const pass of [0, 1, 2]) {   // 0: mixed and apart · 1: apart · 2: anything (a crowded corner of the list)
      for (const c of win) {
        if (pick.length >= size) break;
        if (pick.includes(c)) continue;
        if (pass < 1 && (fam[c.fam] || 0) >= LX_FAM_MAX) continue;
        if (pass < 2 && pick.some(x => lxDe(x, c) < LX_SPREAD)) continue;
        pick.push(c); fam[c.fam] = (fam[c.fam] || 0) + 1;
      }
    }
    win.slice(0, size).forEach(c => { if (!pick.includes(c)) c._skip = (c._skip || 0) + 1; });   // its turn came and it waited
    pick.forEach(c => { pending.splice(pending.indexOf(c), 1); delete c._skip; });
    out.push(pick);
  }
  return out;
}
// Library colors that duplicate a color already on the path (CIEDE2000 under LX_DUP) are skipped: you never learn
// the same color twice. Sorted by L* so each check only looks at a narrow window.
function lxDedupe(cands, placed) {
  const keep = [], pool = placed.map(lxLab).sort((a, b) => a[0] - b[0]);
  const near = L => {
    let lo = 0, hi = pool.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pool[m][0] < L[0] - 3) lo = m + 1; else hi = m; }
    for (let i = lo; i < pool.length && pool[i][0] <= L[0] + 3; i++) {
      const p = pool[i]; if (Math.hypot(p[0] - L[0], p[1] - L[1], p[2] - L[2]) < 8 && de2000(p, L) < LX_DUP) return true;
    }
    return false;
  };
  cands.forEach(c => {
    const L = lxLab(c); if (near(L)) return;
    keep.push(c);
    let i = pool.findIndex(p => p[0] > L[0]); if (i < 0) i = pool.length; pool.splice(i, 0, L);
  });
  return keep;
}
// Fields for the library stages (JOURNEY decision 1: "past 614, chapters are grouped by field"). Read from each
// library color's sources; a unit never mixes fields.
// The data names each library color's field (lane L15); a color without one is read from its sources.
const LX_FIELDS = [
  ["everyday", "Everyday names", s => !s.includes("ridgway") && !s.includes("werner") && s.some(x => x === "xkcd" || x === "css" || x === "wiki")],
  ["painter's pigments", "Painter's pigments", s => s.includes("pigment")],
  ["fashion and textiles", "Fashion and textiles", () => false],
  ["interiors and paint", "Interiors and paint", s => s.includes("ral")],
  ["design and print", "Design and print", s => s.includes("iscc-nbs")],
  ["nature", "Nature", s => s.includes("ridgway") || s.includes("werner")]];
const lxField = c => (c.field && LX_FIELDS.find(f => f[0] === c.field)) || LX_FIELDS.find(f => f[2](c.src || [])) || LX_FIELDS[LX_FIELDS.length - 1];

let LX_PLAN = null;
// The whole plan: { stages: [{ k, n, name, label, units, gen }], units: [all units in order], total }. The first two
// stages are the units in data/colors.js (as they are, ids and all); the rest are generated. Without the core list
// (not loaded yet) the generated stages are placeholders with no units.
function lxPlan() {
  const core = lxCore(), lib = lxLib();
  if (LX_PLAN && LX_PLAN.core === core && LX_PLAN.lib === lib) return LX_PLAN;
  const stages = [];
  // the first units, as two stages (everyday in-betweens, then the designer's words)
  let count = BASICS.length;
  [2, 3].forEach(tier => {
    const us = UNITS.filter(u => u.tier === tier);
    count += us.reduce((s, u) => s + u.colors.length, 0);
    stages.push({ k: stages.length, n: count, name: "", label: D.tiers[tier] ? D.tiers[tier].name : "", units: us, gen: false });
  });
  const first = count;
  const units = UNITS.slice();
  if (!core) {
    LX_STAGE_PLAN.filter(([n]) => !n || n < LX_STAGE_GUESS[LX_ALL_NAME]).forEach(([n, name]) => stages.push({ k: stages.length, n: n || LX_STAGE_GUESS[name], name, units: [], gen: true, approx: !n || n > 1000 }));
    return { core, lib, stages, units, total: 0, ready: false };
  }
  // the core names past the first units: real words, then the variations (each after its base)
  const known = new Set([...BASICS, ...ALL].map(c => c.n.toLowerCase()));
  const byName = new Map(core.list.map(c => [c.n.toLowerCase(), c]));
  const has = n => byName.get(n) || null;
  const rest = core.list.filter(c => !known.has(c.n.toLowerCase()) && c.teach !== false).sort(lxOrderCmp);
  const words = [], vars = [];
  // compounds: the data's own compound/base flags when it has them (lane L15), else read from the name
  const flagged = core.list.some(c => c.compound);
  const baseOf = c => flagged ? (c.compound && c.baseSlug ? core.bySlug.get(c.baseSlug) || lxBaseOf(c.n, has) : null) : lxBaseOf(c.n, has);
  rest.forEach(c => { const b = baseOf(c); if (b && b !== c) { c.base = b; vars.push(c); } else { delete c.base; words.push(c); } });
  // a variation of a variation waits for its own base
  const depth = c => { let d = 0, x = c; while (x.base && x.base.base && d < 4) { d++; x = x.base; } return d; };
  vars.sort((a, b) => depth(a) - depth(b));
  let ord = 0;
  const place = (list, n, name, extra = {}) => {
    if (!list.length) return;
    const chunks = lxChunk(list), from = count;
    count += list.length;
    const st = { k: stages.length, n: count, from, name, units: [], gen: true, ...extra };
    chunks.forEach(cs => {
      cs.forEach(c => { c.ord = ord++; c._nb = null; });
      const u = { id: "x:" + lxSlug(cs[0].n), i: units.length, gen: true, stage: st.k, colors: cs, field: extra.field || "" };
      u.title = lxTitle(cs);
      u.label = `Unit ${u.i + 1} · to ${st.name ? st.name + ", " : ""}${lxNum(st.n)} words`;
      cs.forEach(c => { c.unit = u; });
      st.units.push(u); units.push(u);
    });
    stages.push(st);
  };
  // stage cuts by count: 150, 250, 400, then every remaining real word (Fluent), then the variations (Expert)
  let wi = 0;
  LX_STAGE_PLAN.slice(0, 3).forEach(([n]) => { const take = Math.max(0, Math.min(words.length - wi, n - count)); place(words.slice(wi, wi + take), n, ""); wi += take; });
  place(words.slice(wi), 0, "Fluent");
  place(vars, 0, "Expert");
  // the library's learnable cards (teach:false ones are near-duplicates, obscure or crude: never a card), field by
  // field, cut at about 1,500; the rest is the last checkpoint, every learnable color
  if (lib) {
    const cands = lib.list.filter(c => c.teach !== false).sort((a, b) => LX_FIELDS.indexOf(lxField(a)) - LX_FIELDS.indexOf(lxField(b)) || lxOrderCmp(a, b));
    const keep = lxDedupe(cands, [...BASICS, ...ALL, ...rest]);
    const cut = Math.max(0, Math.min(keep.length, 1500 - count));
    const segs = cut >= LX_UNIT_N && keep.length - cut >= LX_UNIT_N ? [keep.slice(0, cut), keep.slice(cut)] : [keep];
    segs.forEach((seg, i) => {
      const name = i === segs.length - 1 ? LX_ALL_NAME : "";
      // inside a stage, a unit never mixes fields: chunk each field's run on its own
      const runs = [];
      seg.forEach(c => { const f = lxField(c)[0]; if (!runs.length || runs[runs.length - 1].f !== f) runs.push({ f, cs: [] }); runs[runs.length - 1].cs.push(c); });
      if (!seg.length) return;
      const from = count;
      const st = { k: stages.length, n: count + seg.length, from, name, units: [], gen: true, approx: i < segs.length - 1, lib: true };
      runs.forEach(r => {
        lxChunk(r.cs).forEach(cs => {
          cs.forEach(c => { c.ord = ord++; c._nb = null; });
          const u = { id: "x:" + lxSlug(cs[0].n), i: units.length, gen: true, stage: st.k, colors: cs, field: LX_FIELDS.find(f => f[0] === r.f)[1] };
          u.title = lxTitle(cs); u.label = `Unit ${u.i + 1} · ${u.field}`;
          cs.forEach(c => { c.unit = u; });
          st.units.push(u); units.push(u);
        });
      });
      count += seg.length;
      stages.push(st);
    });
  } else {
    // not loaded yet: the library stages stay as named placeholders
    [[LX_STAGE_GUESS[LX_ALL_NAME], LX_ALL_NAME]].forEach(([n, name]) => stages.push({ k: stages.length, n, name, units: [], gen: true, approx: true, lib: true }));
  }
  LX_PLAN = { core, lib, stages, units, total: count, first, ready: true, words: words.length, vars: vars.length };
  return LX_PLAN;
}
// "Puce, slate & rust": the unit's three most useful names (two if they're long)
function lxTitle(cs) {
  const ns = cs.slice(0, 3).map((c, i) => { const s = lxLower(c.n); return i ? s : s.charAt(0).toUpperCase() + s.slice(1); });
  const use = ns.join("").length > 30 ? ns.slice(0, 2) : ns;
  return use.length > 1 ? use.slice(0, -1).join(", ") + " & " + use[use.length - 1] : use[0];
}
// "150 words", "Fluent · 614 words", "about 1,600 words"
const lxStageWord = st => `${st.name ? st.name + " · " : ""}${st.approx ? "about " : ""}${lxNum(st.n)} words`;
// Every unit in path order: the first units, then the generated ones (once the core list has loaded).
function learnUnitsAll() { return lxPlan().units; }
// A generated unit is done once every one of its colors has a card (however it got one: the path, Learn it,
// placement). The first units keep their own S.done rule.
const lxUnitDone = u => u.gen ? u.colors.every(c => S.cards[c.id]) : !!S.done[u.id] || u.i < S.start;
// The next unit to learn (core.js nextUnit). A generated unit that's partly met already teaches only the rest.
function lxNextUnit() {
  const u0 = UNITS.find(u => u.i >= S.start && !S.done[u.id]); if (u0) return u0;
  const plan = lxPlan();
  for (const u of plan.units) {
    if (!u.gen) continue;
    const left = u.colors.filter(c => !S.cards[c.id]);
    if (!left.length) continue;
    // nearly at the end of the core names: start fetching the library, so the next stage is ready in time
    if (!plan.lib && plan.stages[u.stage] && plan.stages[u.stage].name === "Expert") lxLibLoad();
    return left.length === u.colors.length ? u : { ...u, colors: left, part: true };
  }
  return null;
}
// Is more of the path still on its way (a list not loaded yet)? Starts the load and resolves when it's in.
function lxPending() {
  const plan = lxPlan();
  if (!plan.ready) return loadCoreNames().then(() => true);
  if (!plan.lib && plan.units.filter(u => u.gen).every(lxUnitDone)) return lxLibLoad().then(() => true);
  return null;
}

// ---------- stage progress (the You page's checkpoint) ----------
// The next named checkpoint above what's yours: "27 of 650 · Fluent", then Expert, then every learnable color.
function lxCheckpoint(owned) {
  const plan = lxPlan();
  const named = plan.stages.filter(s => s.name);
  const st = named.find(s => s.n > owned) || named[named.length - 1];
  const stage = plan.stages.find(s => s.n > owned) || plan.stages[plan.stages.length - 1];
  return { n: st.n, name: st.name, approx: !plan.ready || (!plan.lib && st.lib), stage };
}

// ---------- Your words: one bar to the next stop (js/learn.js home()) ----------
// PLAN.md lane C: the stage rows and the 655-square collection grid fold into one bar. The next stop is the stage
// the path is in, named by size ("150 words", "Fluent · 655 words"). The bar holds every path name up to that stop,
// told in its own colors in hue order: yours solid, still learning faint, not met yet as the empty track. The map
// is the real collection, so the bar's one action opens it on the Learned (or Learning) view.
function lxWordsStop(nu) {
  const plan = lxPlan();
  let k = nu ? (nu.gen ? nu.stage : plan.stages.findIndex(st => st.units.some(u => u.id === nu.id))) : -1;
  if (k < 0 || !plan.stages[k]) k = plan.stages.length - 1;
  return plan.stages[k];
}
function lxWords(nu) {
  const plan = lxPlan(), st = lxWordsStop(nu);
  lxRekey();   // renamed or merged names move to their canonical card first (once the lists are in)
  const upTo = plan.stages.filter(s => s.k <= st.k).flatMap(s => s.units).flatMap(u => u.colors);
  const yours = [], learning = [];
  let left = 0;
  upTo.forEach(c => { const cd = S.cards[c.id]; if (!cd) left++; else (isMine(cd) ? yours : learning).push(c); });
  // a stage whose names haven't loaded yet has no units: count what's left to it from its size
  if (!st.units.length) left = Math.max(0, st.n - BASICS.length - yours.length - learning.length);
  return { st, yours, learning, left, owned: ownedCount(), last: st.k === plan.stages.length - 1 };
}
// The map's view for "See them on the map": the first map stage that holds the whole stop, on Learned when any are
// yours, else on Learning.
function lxWordsView(w) {
  const n = (typeof HM_STAGES !== "undefined" ? HM_STAGES : []).find(x => x >= w.st.n);
  return { src: n ? "stage:" + n : "every-name", filter: w.yours.length ? "learned" : "learning" };
}
function lxWordsHtml(nu) {
  const w = lxWords(nu), met = w.yours.length + w.learning.length, all = met + w.left;
  const hueKey = c => { const [L, C, H] = lch(c.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  const faint = h => /^#[0-9a-f]{6}$/i.test(h) ? h + "5c" : h;
  const segs = [...w.yours.sort((a, b) => hueKey(a) - hueKey(b)).map(c => c.h), ...w.learning.sort((a, b) => hueKey(a) - hueKey(b)).map(c => faint(c.h))];
  const grad = segs.length ? `linear-gradient(90deg,${segs.map((h, i) => `${h} ${(i * 100 / segs.length).toFixed(3)}% ${((i + 1) * 100 / segs.length).toFixed(3)}%`).join(",")})` : "none";
  const pct = all ? Math.max(met ? 1.5 : 0, met * 100 / all) : 100;
  const v = lxWordsView(w), done = !nu && !w.left;
  const stop = done ? "Every stop reached" : `Next stop · <b>${esc(lxStageWord(w.st))}</b>`;
  const foot = done ? `${lxNum(met)} names met. Reviews keep them yours.`
    : met ? `${lxNum(w.left)} ${w.left === 1 ? "name" : "names"} to go`
    : "Every name you learn lands here, and on the map.";
  return `<section class="lx-words" aria-label="Your words">
    <div class="lx-words-head"><h3 class="title-3">Your words</h3><span class="note">${stop}</span></div>
    <p class="lx-words-n"><b data-count="${w.owned}">${w.owned}</b><span>yours${w.learning.length ? ` · ${lxNum(w.learning.length)} learning` : ""}</span></p>
    <div class="lx-bar" role="img" aria-label="${met} of ${all} names met on the way to ${esc(lxStageWord(w.st))}"><i class="lx-bar-fill" style="width:${pct.toFixed(2)}%;background-image:${grad}"></i></div>
    <div class="lx-words-foot"><span class="note">${foot}</span>${met ? `<button class="lx-words-map" data-words-map data-src="${v.src}" data-filter="${v.filter}">See them on the map ${ICON.arrow}</button>` : ""}</div>
  </section>`;
}
function lxWordsWire(el) {
  const b = el.querySelector("[data-words-map]"); if (!b) return;
  b.onclick = () => {
    S.hm = S.hm || {}; S.hm.src = b.dataset.src; S.hm.filter = b.dataset.filter; save();
    buzz(6); hmHome();
  };
}

// ======================================================================
// 3. Look-alikes from all ~1,000 names
// ======================================================================
// The pool every look-alike, Pick it option and Say it match draws from: the whole core list once it has loaded
// (as learnable colors, so each has a card id), else the first units and the basics.
function lxLookPool() {
  const core = lxCore();
  return core ? core.list : [...BASICS, ...ALL];
}
// The nearest names in c's own family, LX_LOOK_MIN to LX_LOOK_MAX away (CIEDE2000), nearest first. If the family
// has fewer than two, the nearest names of any family in that range fill in, so a lone color still has company.
function lxLookalikes(c, n = 6) {
  const L = lxLab(c), me = String(c.n).toLowerCase();
  const all = lxLookPool().filter(x => x.n.toLowerCase() !== me).map(x => ({ x, d: de2000(L, lxLab(x)) }))
    .filter(o => o.d >= LX_LOOK_MIN && o.d <= LX_LOOK_MAX).sort((a, b) => a.d - b.d);
  const fam = all.filter(o => lxSameFam(c, o.x));
  return (fam.length >= 2 ? fam : all).slice(0, n);
}
// A Learn it group: c plus up to n look-alikes, every pair in the group at least LX_LOOK_MIN apart (solvable),
// never a basic (placement only).
function lxGroup(c, n = 4) {
  const out = [];
  for (const o of lxLookalikes(c, 14)) {
    const x = o.x;
    if (x.basic || !x.id) continue;
    if (out.some(y => lxDe(x, y) < LX_LOOK_MIN)) continue;
    out.push(x); if (out.length >= n) break;
  }
  return out;
}

// ---------- Bet on tomorrow (design/IDEAS-10X/learning.md idea 6) ----------
// At the end of a lesson: "How many of these will you name tomorrow?" One tap. The next review that recalls
// them settles it ("You bet 2 of 4. You named 3."): calibration, not a score. A low bet is never punished, a
// same-day answer never settles a bet, and nothing here touches Yours. S.bets[day] = { ids, n, got?, of? }.
function lxBetHtml(ids) {
  const n = ids.length; if (n < 2 || n > 12) return "";
  const opts = n <= 6 ? Array.from({ length: n + 1 }, (_, i) => i) : [0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n];
  return `<div class="lx-bet" data-lx-bet><p class="lx-bet-q">How many of these will you name tomorrow?</p>
    <div class="lx-bet-row">${opts.map(i => `<button class="lx-bet-b" data-n="${i}">${i}</button>`).join("")}</div>
    <p class="lx-bet-a note" aria-live="polite"></p></div>`;
}
function lxBetWire(el, ids) {
  const box = el.querySelector("[data-lx-bet]"); if (!box) return;
  const t = today(), prev = S.bets && S.bets[t];
  const mark = n => { box.querySelectorAll(".lx-bet-b").forEach(b => b.classList.toggle("on", +b.dataset.n === n)); box.querySelector(".lx-bet-a").textContent = `Noted: ${n} of ${ids.length}. Tomorrow's review settles it.`; };
  if (prev && prev.ids.join() === ids.join()) mark(prev.n);
  box.querySelectorAll(".lx-bet-b").forEach(b => b.onclick = () => {
    S.bets = S.bets || {}; S.bets[t] = { ids: ids.slice(), n: +b.dataset.n }; save(); buzz(8); mark(+b.dataset.n);
  });
}
// After a review: settle the oldest open bet from an earlier day whose colors came up today.
function lxBetSettle() {
  if (!S.bets) return "";
  const t = today(), day = Object.keys(S.bets).filter(d => d < t && S.bets[d] && S.bets[d].got == null).sort()[0];
  if (!day) return "";
  const bet = S.bets[day], seen = bet.ids.filter(id => S.cards[id] && S.cards[id].last === t);
  if (!seen.length) return "";
  bet.got = seen.filter(id => S.cards[id].b > 0).length; bet.of = seen.length; bet.at = t; save();
  const when = day === addDays(t, -1) ? "Yesterday" : "Last time";
  return `${when} you bet you'd name ${bet.n} of ${bet.ids.length}. You named ${bet.got}${bet.of < bet.ids.length ? ` of the ${bet.of} that came up` : ""}.`;
}

// ---------- routes and doors ----------
// #/learnit/<slug> for a name past the first units (js/router.js): the core list may still be loading.
function lxRouteLearnIt(slug) {
  return loadCoreNames().then(() => { const c = lxByName(slug.replace(/-/g, " ")) || (lxCore() && lxCore().bySlug.get(slug)); if (c && typeof hmLearnIt === "function") hmLearnIt(c); else go(S.tab || "learn"); });
}

// ---------- screenshot hooks: #shot=lx:<room|unit|meet|learnit|learnitpage|deck> ----------
// room: the Learn room 27 names in, partway through the 150 stage · unit: a unit past the first ones (meet cover)
// meet: its first page · learnit: Learn it on a name past the first units (Puce) · deck: that unit's swipe deck
function lxShot(arg = "room") {
  return loadCoreNames().then(() => {
    const t = today(), plan = lxPlan();
    S.done = {}; S.cards = {};
    UNITS.forEach(u => { S.done[u.id] = addDays(t, -30); u.colors.forEach(c => { S.cards[c.id] = { ...cardNew(c, addDays(t, -30)), b: 3, due: addDays(t, 5), own: true, ownBy: "pick" }; }); });
    const gen = plan.units.filter(u => u.gen);
    gen.slice(0, 2).forEach(u => u.colors.forEach((c, i) => { S.cards[c.id] = { ...cardNew(c, addDays(t, -6)), b: 1, due: addDays(t, 2), own: i % 2 === 0, ownBy: i % 2 === 0 ? "pick" : "swipe" }; }));
    const nu = nextUnit();
    if (arg === "room") return home();
    if (arg === "unit" || arg === "meet") { meet(nu); if (arg === "meet") setTimeout(() => { const p = document.getElementById("pager"); if (p) p.scrollTop = p.clientHeight; }, 300); return; }
    if (arg === "deck") { deck("learn", { unit: nu }); setTimeout(() => dispatchEvent(new KeyboardEvent("keydown", { key: " " })), 600); return; }
    if (arg === "done") return unitDone(nu, 6, 8);
    if (arg === "reviewdone") {
      const ids = gen[0].colors.slice(0, 4).map(x => x.id);
      S.bets = { [addDays(t, -1)]: { ids, n: 2 } };
      ids.forEach((id, i) => { S.cards[id].last = t; S.cards[id].b = i < 3 ? 2 : 0; });
      return reviewDone(7, 9);
    }
    const c = lxByName("Chestnut") || gen[3].colors[0];   // a name past the first units, not met yet
    if (arg === "ltdone") return hmLtDone([c, ...lxGroup(c)], c);
    if (arg === "learnit") return hmLearnIt(c);
    if (arg === "learnitpage") { hmLearnIt(c); setTimeout(() => { const p = document.querySelector("#ltPager"); if (p) p.scrollTop = p.clientHeight * 2; }, 300); return; }
    if ((arg === "edge" || arg === "edgedone") && typeof hmLtEdge === "function") {
      hmLtEdge([c, ...lxGroup(c)], c, () => {});
      if (arg === "edgedone") setTimeout(() => { const b = document.querySelectorAll(".lt-edge-b")[5]; if (b) b.click(); }, 400);
      return;
    }
    return home();
  });
}
