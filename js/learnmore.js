"use strict";
// Learning past the first units (lane L9a; David's #1 ask, "I want to be able to learn more colors").
// Three things live here:
//  1. Card ids for every learnable color. The first units keep their ids ("t2-blues:Teal"); any other core name
//     is "core:<slug>" and any library color is "lib:<slug>". cardIdFor(color) gives the id, colorForCard(id)
//     gives the color back ({ id, n, h, fam, unit, vs, d, … }), and every card stores its own n and h, so a
//     card resolves even before the name lists have loaded (core.js migrateState v2 backfills old cards).
//  2. The path past the first units: learnUnitsAll() = the units in data/colors.js, then generated units from
//     the learning order, in stages: 150 · 250 · 400 · Fluent (every real color word, about 614) · Expert (their
//     variations, about 1,000) · about 1,600 · about 2,200 · Master (every distinct library color, about 2,700).
//     Families mix inside a unit; compounds ("Light teal") are taught as variations of their base word, after it;
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
// word-count checkpoints after the first units. 0 = "every real word" and "every variation": the real count.
const LX_STAGE_PLAN = [[150, ""], [250, ""], [400, ""], [0, "Fluent"], [0, "Expert"], [1600, ""], [2200, ""], [0, "Master"]];
const LX_STAGE_GUESS = { Fluent: 614, Expert: 1000, Master: 2700 };   // shown until the lists have loaded

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
    src: e.src || [], also: e.also, notes: e.notes, lab: e.lab || lab(e.h), ord: Infinity, unit: null };
  c.fam = lxFam(c.h);
  c.unit = { title: c.fam, fam: true };
  ["vs", "d", "vsC"].forEach(k => Object.defineProperty(c, k, { get: () => lxNb(c)[k], enumerable: false, configurable: true }));
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
// title (a Japanese-only name is secondary, never a title: CLAUDE.md naming policy) and no source qualifier like "(Crayola)".
let LX_LIB_SRC = null, LX_LIB = null, LX_LIB_LOADING = null;
function lxLibLoad() {
  if (LX_LIB_SRC) return Promise.resolve(lxLib());
  if (typeof loadLongNames !== "function") return Promise.resolve(null);
  return LX_LIB_LOADING || (LX_LIB_LOADING = Promise.all([loadCoreNames(), loadLongNames()]).then(([, list]) => { LX_LIB_SRC = list || []; LX_PLAN = null; return lxLib(); }));
}
const lxLibOk = e => e && !e.crude && /^#[0-9a-f]{6}$/i.test(e.h) && !/[()0-9]/.test(e.n) && !((e.src || []).length === 1 && e.src[0] === "jp");
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
    for (const pass of [0, 1, 2]) {   // 0: mixed and apart · 1: apart · 2: anything (a crowded corner of the list)
      for (const c of win) {
        if (pick.length >= size) break;
        if (pick.includes(c)) continue;
        if (pass < 1 && (fam[c.fam] || 0) >= LX_FAM_MAX) continue;
        if (pass < 2 && pick.some(x => lxDe(x, c) < LX_SPREAD)) continue;
        pick.push(c); fam[c.fam] = (fam[c.fam] || 0) + 1;
      }
    }
    pick.forEach(c => pending.splice(pending.indexOf(c), 1));
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
const LX_FIELDS = [
  ["everyday", "Everyday and screen names", s => !s.includes("ridgway") && !s.includes("werner") && s.some(x => x === "xkcd" || x === "css" || x === "wiki")],
  ["paint", "Paint and pigments", s => s.includes("ral") || s.includes("pigment")],
  ["nature", "The naturalists' charts", s => s.includes("ridgway") || s.includes("werner")],
  ["standard", "The color standard's names", () => true]];
const lxField = c => LX_FIELDS.find(f => f[2](c.src || [])) || LX_FIELDS[LX_FIELDS.length - 1];

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
    LX_STAGE_PLAN.forEach(([n, name]) => stages.push({ k: stages.length, n: n || LX_STAGE_GUESS[name], name, units: [], gen: true, approx: !n || n > 1000 }));
    return { core, lib, stages, units, total: 0, ready: false };
  }
  // the core names past the first units: real words, then the variations (each after its base)
  const known = new Set([...BASICS, ...ALL].map(c => c.n.toLowerCase()));
  const byName = new Map(core.list.map(c => [c.n.toLowerCase(), c]));
  const has = n => byName.get(n) || null;
  const rest = core.list.filter(c => !known.has(c.n.toLowerCase()) && c.teach !== false).sort(lxOrderCmp);
  const words = [], vars = [];
  rest.forEach(c => { const b = lxBaseOf(c.n, has); if (b && b !== c) { c.base = b; vars.push(c); } else { delete c.base; words.push(c); } });
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
      u.label = `Unit ${u.i + 1} · ${lxStageWord(st)}`;
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
  // the library: field by field, then cut at about 1,600 and 2,200; the rest is Master
  if (lib) {
    const cands = lib.list.slice().sort((a, b) => LX_FIELDS.indexOf(lxField(a)) - LX_FIELDS.indexOf(lxField(b)) || lxOrderCmp(a, b));
    const keep = lxDedupe(cands, [...BASICS, ...ALL, ...rest]);
    const cuts = [1600, 2200].map(n => Math.max(0, n - count));
    const segs = [keep.slice(0, cuts[0]), keep.slice(cuts[0], cuts[1]), keep.slice(cuts[1])];
    segs.forEach((seg, i) => {
      const name = i === 2 ? "Master" : "";
      // inside a stage, a unit never mixes fields: chunk each field's run on its own
      const runs = [];
      seg.forEach(c => { const f = lxField(c)[0]; if (!runs.length || runs[runs.length - 1].f !== f) runs.push({ f, cs: [] }); runs[runs.length - 1].cs.push(c); });
      if (!seg.length) return;
      const from = count;
      const st = { k: stages.length, n: count + seg.length, from, name, units: [], gen: true, approx: i < 2, lib: true };
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
    [[1600, ""], [2200, ""], [LX_STAGE_GUESS.Master, "Master"]].forEach(([n, name]) => stages.push({ k: stages.length, n, name, units: [], gen: true, approx: true, lib: true }));
  }
  LX_PLAN = { core, lib, stages, units, total: count, first, ready: true, words: words.length, vars: vars.length };
  return LX_PLAN;
}
// "Puce, slate & rust": the unit's three most useful names (two if they're long)
function lxTitle(cs) {
  const ns = cs.slice(0, 3).map((c, i) => i ? lxLower(c.n) : c.n);
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

// ---------- stage progress (the Learn room's collection) ----------
// The next named checkpoint above what's yours: "27 of 614 · Fluent", then Expert, then Master.
function lxCheckpoint(owned) {
  const plan = lxPlan();
  const named = plan.stages.filter(s => s.name);
  const st = named.find(s => s.n > owned) || named[named.length - 1];
  const stage = plan.stages.find(s => s.n > owned) || plan.stages[plan.stages.length - 1];
  return { n: st.n, name: st.name, approx: !plan.ready || (!plan.lib && st.lib), stage };
}

// ---------- the path, drawn (js/learn.js home()) ----------
// Finished stages fold into one band each; the current stage shows its finished units as one band, the next
// unit large, and the two after it; later stages are named and waiting (locked, never hidden).
function lxPathHtml(nu) {
  const plan = lxPlan();
  const band = (cols, cls) => `<div class="path-band ${cls}">${cols.map(h => `<i style="background:${h}"></i>`).join("")}</div>`;
  const sample = (cs, n) => { if (cs.length <= n) return cs; const out = []; for (let i = 0; i < n; i++) out.push(cs[Math.floor(i * cs.length / n)]); return out; };
  const stageDone = st => st.units.length && st.units.every(lxUnitDone);
  const curK = nu ? (nu.gen ? nu.stage : plan.stages.findIndex(st => st.units.some(u => u.id === nu.id))) : -1;
  const rows = [];
  plan.stages.forEach(st => {
    const head = st.label || lxStageWord(st);
    if (st.k < curK || (curK < 0 && stageDone(st))) {
      const cs = st.units.flatMap(u => u.colors);
      rows.push(`<div class="path-row path-done lx-stage-done">${band(sample(cs, 28).map(c => c.h), "path-band-done")}<div class="path-cap"><span class="title-3">${esc(head)}</span><span class="note">${lxNum(cs.length)} names met</span></div></div>`);
      return;
    }
    if (st.k === curK) {
      rows.push(`<p class="lx-stage-h"><span>${esc(st.k < 2 ? head : "To " + lxStageWord(st).replace(/^(\w+) · /, "") + (st.name ? " · " + st.name : ""))}</span><span class="note">${st.units.filter(lxUnitDone).length} of ${st.units.length} units</span></p>`);
      const done = st.units.filter(u => u.id !== nu.id && lxUnitDone(u)), after = st.units.filter(u => u.id !== nu.id && !lxUnitDone(u));
      if (done.length) rows.push(`<div class="path-row path-done">${band(sample(done.flatMap(u => u.colors), 28).map(c => c.h), "path-band-done")}<div class="path-cap"><span class="title-3">${done.length === 1 ? esc(done[0].title) : `${done.length} units`}</span><span class="note">Met</span></div></div>`);
      const cur = st.units.find(u => u.id === nu.id) || nu;
      rows.push(`<div class="path-row path-current">${band(cur.colors.map(c => c.h), "path-band-current")}<div class="path-cap"><span class="title-2">${esc(nu.title)}</span><span class="note">Next, about ${Math.max(2, Math.round(nu.colors.length * 15 / 60))} min</span></div></div>`);
      after.slice(0, 2).forEach(u => rows.push(`<div class="path-row path-future">${band(u.colors.map(c => c.h), "path-band-future")}<div class="path-cap"><span class="title-3 path-future-name">${esc(u.title)}</span></div></div>`));
      if (after.length > 2) rows.push(`<p class="note lx-more">and ${after.length - 2} more unit${after.length - 2 === 1 ? "" : "s"} to ${lxStageWord(st).replace(/^\w+ · /, "")}</p>`);
      return;
    }
    // a stage still ahead: its name and a thin band of what it holds (or a quiet one, before the lists load)
    const cs = st.units.flatMap(u => u.colors);
    rows.push(`<div class="path-row path-future lx-stage-next">${cs.length ? band(sample(cs, 28).map(c => c.h), "path-band-future") : `<div class="path-band path-band-future lx-band-wait"></div>`}<div class="path-cap"><span class="title-3 path-future-name">${esc(head)}</span><span class="note">${st.units.length ? `${st.units.length} units` : st.k < 2 ? "" : "Waiting"}</span></div></div>`);
  });
  return rows.join("");
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
    const c = lxByName("Puce") || gen[0].colors[0];
    if (arg === "learnit") return hmLearnIt(c);
    if (arg === "learnitpage") { hmLearnIt(c); setTimeout(() => { const p = document.querySelector("#ltPager"); if (p) p.scrollTop = p.clientHeight * 2; }, 300); return; }
    if (arg === "edge" && typeof hmLtEdge === "function") return hmLtEdge([c, ...lxGroup(c)], c, () => {});
    return home();
  });
}
