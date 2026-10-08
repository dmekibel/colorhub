"use strict";
// Study the map (#/mapstudy): games that use only the honeycomb itself. Version 2 (design/MAP-STUDY-2.md, 2026-10-08).
//
// Modes, one screen. The map is always the honeycomb (js/honey.js) and the panel at the foot changes:
//   find    "Find celadon": tap it on the map. From 12 to pick from upward, a first miss is "warmer" (its
//           neighborhood lights up and the words say which way); a second miss reveals it, naming the colors between.
//   name    one bubble breathes; pick its name from names in the field (3, 4, then 6), typed only at the top.
//   hood    a ringed corner with its names hidden: tap each bubble and match it to one of the ring's own names.
//   light   "Today's five": five new colors placed on your map each day, then found again from memory.
//   wander  no score: every name on, tap to hear a color's note and read how it differs from the last.
// (v1's Path is gone: map neighbors come from how the layout packs, not from how we see.)
//
// Two dials replace v1's levels and difficulty words:
//   How many colors (the field): 10 ... 614 (the Learn layer) and every name, in the core list's stage order.
//   How much help (the board): 3, 4, 6, 8, 12 or 20 to pick from, or the whole field.
// For you (the default) moves the help dial itself: two right in a row step up, a miss steps down, kept per field;
// and once 90% of a field is found it offers to grow the field. Choose shows both dials and a test-out.
//
// Honest progress: Practice's policy (js/practice.js prApply when it's on main, a copy here otherwise). Objective
// answers on learned cards that are due count as their review; a miss on a learned card makes it due tomorrow;
// nothing else touches scheduling. Only the first answer per color per session counts.
//
// The honeycomb's verdicts (design/REQUESTS-LEDGER.md) hold: no snapping, the user's own style and fisheye, no
// marks or dimming except the study rings during play and the opt-in "your map" fog, which is never on by default.

// ---------- tunables ----------
const MS_LEVELS = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 614, "all"];
const MS_HELP = [3, 4, 6, 8, 12, 20, Infinity];      // bubbles to pick from at help step 0..6 (6 = the whole field)
const MS_WHOLE = MS_HELP.length - 1;
const MS_WARM = 4;                                    // from this step a first miss is "warmer", not wrong
const MS_ROUNDS = 10;
const MS_MIN_DE = 4;                                  // distractors at least this far (ΔE00) from the answer and each other
const MS_CLOSE_DE = 5;                                // "next door": a map neighbor, or this close
const MS_MODES = [
  ["find", "Find it", "We name a color. You tap it on the map."],
  ["name", "Name it", "One bubble breathes. You pick its name."],
  ["hood", "Neighborhood", "A corner of the map with its names hidden. Match each one."],
  ["light", "Today's five", "Five new colors placed on your map, every day."],
  ["wander", "Wander", "No score. Every name showing: tap to hear and compare."],
];
const MS_FAMS = ["Reds", "Pinks", "Oranges", "Browns", "Yellows", "Greens", "Blues", "Purples", "Greys"];
// three honeycomb cells, one of them marked: "find this one on the map". Never the single hexagon, which is the way back to the map (core.js HOME_GLYPH)
const MS_ICON = sv('<path d="M7.9 4.2l3.64 2.1v4.2l-3.64 2.1-3.64-2.1V6.3z"/><path d="M16.1 4.2l3.64 2.1v4.2l-3.64 2.1-3.64-2.1V6.3z"/><path d="M12 11.3l3.64 2.1v4.2L12 19.7l-3.64-2.1v-4.2z"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>', 24, 1.5);
const MS_HOOD = [4, 5, 6, 7, 8, 10, 12];              // neighborhood size by help step

// ======================================================================
// Pure parts (no DOM). Unit-tested by tools/mapstudy_test.js.
// ======================================================================
const msLow = s => String(s || "").toLowerCase();
const msFam = h => family(h);                         // js/gym.js: Reds, Pinks, ... Greys
function msRnd(seed) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0, ((s ^ (s >>> 13)) >>> 0) / 4294967296); }
function msShuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function msUniq(items) { const seen = new Set(); return items.filter(it => it && it.n && !seen.has(msLow(it.n)) && seen.add(msLow(it.n))); }

// the level's items, in stage order. src = { core: [{ n, h, rank, ... }], every: () => [...] } (injected for tests)
function msLevelItems(level, src) {
  if (level === "all") return msUniq(src.every());
  const core = src.core.slice().sort((a, b) => a.rank - b.rank);
  return core.slice(0, +level);
}
const msLevelLabel = l => l === "all" ? "Every name" : `${l}`;
const msLevelWord = l => l === "all" ? "every name" : `${l} colors`;
const msNextLevel = l => { const i = MS_LEVELS.indexOf(l); return i >= 0 && i < MS_LEVELS.length - 1 ? MS_LEVELS[i + 1] : null; };
// For you's first help step for a field: small fields start with few bubbles, big ones a little wider
const msHelpStart = l => l === "all" || l >= 300 ? 3 : l >= 100 ? 2 : l >= 30 ? 1 : 0;
// the board actually on screen: never more bubbles than the field holds
const msBoardSize = (h, fieldN) => { const b = MS_HELP[Math.max(0, Math.min(MS_WHOLE, h | 0))]; return b >= fieldN ? Infinity : b; };
const msHelpWord = (h, fieldN = Infinity) => { const b = msBoardSize(h, fieldN); return b === Infinity ? "the whole field" : `${b} to pick from`; };
// the staircase: two right in a row step up, a miss steps down (For you only; Choose stays where you put it)
function msHelpNext(h, ok, streak, adapt = true) {
  if (!adapt) return h;
  if (!ok) return Math.max(0, h - 1);
  return streak > 0 && streak % 2 === 0 ? Math.min(MS_WHOLE, h + 1) : h;
}
// a field counts as cleared when a test-out above it passed, or nearly all its colors are found
const msCleared = (M, l, n) => !!(M.cleared && M.cleared[msLevelKey(l)]) || (n > 0 && (M.found[msLevelKey(l)] || []).length >= n * .9);

// Same-family neighbors (CLAUDE.md: "three blues", never obviously different colors), each at least MS_MIN_DE from
// the answer and from each other so every round is fair: nearest first, then a little shuffle among the closest.
function msDistractors(t, pool, k, rnd = Math.random) {
  const fam = msFam(t.h), tl = msLow(t.n), picked = [];
  const scored = msUniq(pool).filter(x => msLow(x.n) !== tl && x.h.toUpperCase() !== t.h.toUpperCase())
    .map(x => ({ x, d: de2000(t.h, x.h), f: msFam(x.h) === fam })).filter(s => s.d >= MS_MIN_DE);
  const take = list => {
    const near = list.sort((a, b) => a.d - b.d).slice(0, Math.max(k * 3, 8));
    for (const s of msShuffle(near, rnd).sort((a, b) => Math.round(a.d / 6) - Math.round(b.d / 6))) {
      if (picked.length >= k) break;
      if (picked.every(p => de2000(p.h, s.x.h) >= MS_MIN_DE)) picked.push(s.x);
    }
  };
  take(scored.filter(s => s.f));
  if (picked.length < k) take(scored.filter(s => !s.f && !picked.includes(s.x)));
  return picked.slice(0, k);
}
// where wrong options come from: the field you're studying (names you can know), topped up from the first names
// of the core list only when the field is too small to make a fair round
const msOptPool = (field, core, k) => field.length >= k * 3 + 1 ? field : msUniq(field.concat(core.slice(0, Math.max(60, k * 6))));
// "lighter and greener": how a differs from b, in the app's own words (js/produce.js colorDiff / MORE)
function msDir(a, b) {
  const p = colorDiff(a.h, b.h).slice(0, 2);
  return p.length ? p.map(x => MORE[x.w]).join(" and ") : "almost the same color";
}
// a tap on the map: right, next door (a map neighbor or nearly the same color, only on big boards), or wrong
function msGrade(picked, t, nbrs, open) {
  if (msLow(picked.n) === msLow(t.n)) return "right";
  if (open && ((nbrs && nbrs.has(msLow(picked.n))) || de2000(picked.h, t.h) < MS_CLOSE_DE)) return "close";
  return "wrong";
}
const msStars = (r, n) => !n ? 0 : r / n >= .9 ? 3 : r / n >= .7 ? 2 : r / n >= .4 ? 1 : 0;
// fog is a view, never a default and never during play
const msFogFor = (spec, where, known) => spec && spec.fog === true && where === "preview" && known ? (o => known.has(msLow(o.n))) : null;

// The map's own graph, from honey's lattice (ctrl.studyPoints()): neighbors are the bubbles touching each other,
// across the wrap seam too. Returns Map(lowercase name -> Set(lowercase names)).
function msGraph(sp) {
  const g = new Map(), pts = sp.pts, cs = 1.5, grid = new Map(), key = (i, j) => i * 100003 + j;
  const shifts = sp.finite || !sp.A ? [[0, 0]] : [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => [i * sp.A[0] + j * sp.B[0], i * sp.A[1] + j * sp.B[1]]));
  pts.forEach((p, n) => shifts.forEach(([dx, dy]) => { const x = p.x + dx, y = p.y + dy, k = key(Math.floor(x / cs), Math.floor(y / cs)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push([n, x, y]); }));
  // the lattice unit: the typical nearest-neighbor distance (1 on the hex maps; looser on the sunflower)
  const near = [];
  pts.forEach((p, n) => {
    const ci = Math.floor(p.x / cs), cj = Math.floor(p.y / cs); let bd = Infinity;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const [m, x, y] of grid.get(key(i, j)) || []) {
      if (m === n && Math.abs(x - p.x) < 1e-6 && Math.abs(y - p.y) < 1e-6) continue;
      const d = Math.hypot(x - p.x, y - p.y); if (d > 1e-6 && d < bd) bd = d;
    }
    near.push(bd);
  });
  const u = near.filter(isFinite).sort((a, b) => a - b)[Math.floor(near.length / 2)] || 1, lim = u * 1.2;
  pts.forEach(p => { if (!g.has(msLow(p.n))) g.set(msLow(p.n), new Set()); });
  pts.forEach((p, n) => {
    const me = msLow(p.n), ci = Math.floor(p.x / cs), cj = Math.floor(p.y / cs), r = Math.ceil(lim / cs);
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (const [m, x, y] of grid.get(key(i, j)) || []) {
      const d = Math.hypot(x - p.x, y - p.y), o = msLow(pts[m].n);
      if (d > 1e-6 && d <= lim && o !== me) g.get(me).add(o);
    }
  });
  return g;
}
function msBfs(g, from) {
  const dist = new Map([[msLow(from), 0]]), q = [msLow(from)];
  for (let i = 0; i < q.length; i++) for (const nb of g.get(q[i]) || []) if (!dist.has(nb)) { dist.set(nb, dist.get(q[i]) + 1); q.push(nb); }
  return dist;
}
// a neighborhood: the center and its nearest map neighbors, ring by ring
function msHood(g, center, k) { return [...msBfs(g, center).entries()].sort((a, b) => a[1] - b[1]).slice(0, k).map(e => e[0]); }
// the colors between two bubbles on the map (the reveal path after a miss): the shortest walk's inner steps,
// thinned evenly to at most max so the words stay short
function msBetween(g, from, to, max = 4) {
  const d = msBfs(g, to), a = msLow(from), b = msLow(to);
  if (!d.has(a) || a === b) return [];
  const way = []; let cur = a;
  while (cur !== b && way.length < 60) { const k = d.get(cur), nx = [...(g.get(cur) || [])].find(n => d.get(n) === k - 1); if (!nx) break; if (nx !== b) way.push(nx); cur = nx; }
  if (way.length <= max) return way;
  return Array.from({ length: max }, (_, i) => way[Math.round((i + 1) * (way.length + 1) / (max + 1)) - 1]);
}
// the session's targets: due cards first, then this set's earlier misses, then never found, then the rest
function msQueue(targets, n, o = {}, rnd = Math.random) {
  const rank = it => o.due && o.due.has(msLow(it.n)) ? 0 : o.miss && o.miss.has(msLow(it.n)) ? 1 : o.found && !o.found.has(msLow(it.n)) ? 2 : 3;
  const b = [[], [], [], []]; msShuffle(msUniq(targets), rnd).forEach(it => b[rank(it)].push(it));
  return [].concat(...b).slice(0, Math.min(n, targets.length));
}
// Practice's policy (js/practice.js, top of file), used directly when Practice is on main
function msApply(it, ok, by) {
  if (typeof prApply === "function") return prApply(it, ok, by, false);
  if (!by || !it || !it.c) return "none";
  const st = S.cards[it.c.id]; if (!st) return "none";
  const t = today();
  if (st.due <= t) { schedule(it.c, ok, by); return "review"; }
  if (!ok) { st.due = addDays(t, 1); save(); return "tomorrow"; }
  return "none";
}
// sound (js/sound.js): an explicit effect, or a color's own note; both quiet no-ops when sound isn't loaded
const msSfx = (name, arg) => { if (typeof sfx === "function") try { sfx(name, arg); } catch (e) {} };
const msNote = h => { if (typeof sfxColor === "function") try { sfxColor(h); } catch (e) {} };

// ======================================================================
// State (S.mapstudy). Unknown keys survive migrateState, so this needs no migration step.
// ======================================================================
function msState() {
  const m = S.mapstudy = S.mapstudy || {};
  // fill defaults in place: the open screen holds this same spec object, so it must never be swapped for a copy
  const d = { mode: "find", level: 10, set: "level", diff: "you", help: 1, fog: false };
  if (!m.spec || typeof m.spec !== "object") m.spec = {};
  for (const k in d) if (!(k in m.spec)) m.spec[k] = d[k];
  if (!MS_LEVELS.includes(m.spec.level)) m.spec.level = 10;
  if (!MS_MODES.some(x => x[0] === m.spec.mode)) m.spec.mode = "find";          // v1's Path is gone
  if (m.spec.diff !== "you" && m.spec.diff !== "pick") m.spec.diff = "you";        // v1's Easy...Edge words
  if (!(m.spec.help >= 0 && m.spec.help <= MS_WHOLE)) m.spec.help = 1;
  m.spec.help = Math.round(m.spec.help);
  ["best", "lit", "mix", "found", "miss", "help", "cleared"].forEach(k => { if (!m[k] || typeof m[k] !== "object") m[k] = {}; });
  return m;
}
const msLevelKey = l => "L" + l;
// For you's help step at a field: where you left it, else where the field starts
const msHelpOf = (M, l) => { const v = M.help[msLevelKey(l)]; return v >= 0 && v <= MS_WHOLE ? Math.round(v) : msHelpStart(l); };
// "on your map": lit here, taught by the path, or anything the Learner Model says you've met or better
function msKnown() {
  const m = msState(), k = new Set(Object.keys(m.lit));
  ALL.forEach(c => { if (S.cards[c.id]) k.add(msLow(c.n)); });
  BASICS.forEach(c => k.add(msLow(c.n)));
  if (typeof knowState === "function") msCore().forEach(e => { if (!k.has(msLow(e.n)) && knowState(e.n) !== "none") k.add(msLow(e.n)); });
  return k;
}
let MS_CORE = null, MS_CORE_SRC = null;
function msCore() {
  if (MS_CORE && MS_CORE_SRC === CORE_NAMES) return MS_CORE;
  MS_CORE_SRC = CORE_NAMES;
  return (MS_CORE = (CORE_NAMES || []).slice().sort((a, b) => a.rank - b.rank).map(e => ({ n: e.n, h: e.h, rank: e.rank, also: e.also || [], c: BYNAME.get(msLow(e.n)) || null })));
}
const msSrc = () => ({ core: msCore(), every: () => typeof hmEveryNameItems === "function" ? hmEveryNameItems().map(x => ({ n: x.n, h: x.h, c: x.c || null, lib: x.lib || null })) : msCore() });
function msItemOf(n, h) {
  const k = msLow(n), core = msCore().find(e => msLow(e.n) === k);
  if (core) return core;
  if (!h) return null;
  // a palette or favorite that isn't a core name: its nearest core name stands in for it on the map
  let best = null, bd = Infinity; for (const e of msCore()) { const d = de2000(h, e.h); if (d < bd) { bd = d; best = e; } }
  return best;
}
// the confusions the rest of the app knows about (js/learner.js when it's on main) plus the ones logged here
function msMixNames() {
  const out = [];
  if (typeof confusions === "function") {
    try { (confusions(null, 40) || []).forEach(e => [].concat(Array.isArray(e) ? e : [e.a, e.b, e.n, e.m, e.x, e.y, e.with]).forEach(v => { if (typeof v === "string") out.push(v); else if (v && v.n) out.push(v.n); })); } catch (e) {}
  }
  Object.entries(msState().mix).sort((a, b) => b[1] - a[1]).forEach(([k]) => out.push(...k.split("|")));
  return [...new Set(out.map(msLow))];
}
// favorites: S.favs when a lane keeps one, plus every color you've liked (the Learner Model's "like" events)
function msFavNames() {
  const f = S.favs, out = [];
  if (Array.isArray(f)) f.forEach(x => { const n = typeof x === "string" ? x : x && (x.n || x.name); if (n) out.push(n); });
  else if (f && typeof f === "object") out.push(...Object.keys(f));
  if (typeof lnIndex === "function") { try { Object.values(lnIndex().c || {}).forEach(x => { if (x && x.l > 0 && x.n) out.push(x.n); }); } catch (e) {} }
  return [...new Set(out)];
}
// any ColorSet (js/colorset.js) can be studied on the map: msOpen({ set: colorSet(...) }) -> set "custom"
let MS_CUSTOM = null;
// the targets a set asks about (null set or "level" = the level itself)
function msSetItems(spec, levelItems) {
  const s = spec.set || "level";
  if (s === "level") return levelItems;
  if (s === "today") { const t = today(); return msUniq(ALL.filter(c => { const st = S.cards[c.id]; return st && (st.since === t || st.due <= t); }).map(c => msItemOf(c.n, c.h))); }
  if (s === "mix") return msUniq(msMixNames().map(n => msItemOf(n)).filter(Boolean));
  if (s === "favs") return msUniq(msFavNames().map(n => msItemOf(n)).filter(Boolean));
  if (s === "custom") return msUniq((MS_CUSTOM ? MS_CUSTOM.colors : []).map(c => msItemOf(c.n || "", c.h)).filter(Boolean));
  if (s.startsWith("fam:")) return levelItems.filter(it => msFam(it.h) === s.slice(4));
  if (s.startsWith("ptg:")) {
    const p = (window.PAINTINGS || []).find(x => x.id === s.slice(4));
    return p ? msUniq(p.palette.map(e => msItemOf(e.name, e.h)).filter(Boolean)) : [];
  }
  return levelItems;
}
function msSetLabel(s) {
  if (!s || s === "level") return "All in the field";
  if (s === "today") return "Today's words";
  if (s === "mix") return "Your mix-ups";
  if (s === "favs") return "Your favorites";
  if (s === "custom") return MS_CUSTOM && MS_CUSTOM.title || "Your set";
  if (s.startsWith("fam:")) return s.slice(4);
  if (s.startsWith("ptg:")) { const p = (window.PAINTINGS || []).find(x => x.id === s.slice(4)); return p ? p.title : "A painting"; }
  return "All in the field";
}
// today's five new colors: the next core names you haven't met, in stage order, fixed for the day
function msToday5() {
  const m = msState(), t = today();
  if (m.day && m.day.d === t) return m.day;
  const known = msKnown(), next = msCore().filter(e => !known.has(msLow(e.n))).slice(0, 5).map(e => e.n);
  m.day = { d: t, names: next, done: false }; save();
  return m.day;
}
// the Learner Model (js/learner.js): every answer, every mix-up, every color met
function msLog(type, color, o = {}) {
  if (typeof learnerLog !== "function" || !color) return;
  try { learnerLog({ type, color: { n: color.n, h: color.h }, src: "mapstudy", ...o }); } catch (e) {}
}

// ======================================================================
// The screen
// ======================================================================
const msStarRow = n => `<span class="ms-stars" aria-label="${n} of 3">${[0, 1, 2].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
const msChip = it => `<button class="ms-chip" data-open="${esc(it.n)}"><i style="--c:${it.h}"></i><b>${esc(it.n)}</b></button>`;
function msOpenColor(o) {
  if (!o) return;
  if (o.c && typeof hmOpenColor === "function") return hmOpenColor(o.c);
  if (typeof hmOpenName === "function") return hmOpenName(o);
}


function msOpen(o = {}) {
  const M = msState(), spec = M.spec;
  if (o.mode && MS_MODES.some(m => m[0] === o.mode)) spec.mode = o.mode;
  if (o.set && o.set.colors && o.set.colors.length) { MS_CUSTOM = { title: o.set.title || "", colors: o.set.colors.slice(0, 60) }; spec.set = "custom"; if (spec.mode === "light" || spec.mode === "wander") spec.mode = "find"; }
  else if (spec.set === "custom" && !MS_CUSTOM) spec.set = "level";
  const from = o.from || (S.tab === "gym" ? "gym" : "home");
  const el = show(`
    <div class="cx-stage ms-stage"><div class="cx-view"></div></div>
    <header class="ms-top">
      <button class="iconq ms-x" data-close aria-label="Close">${ICON.x}</button>
      <div class="ms-ask" aria-live="polite"></div>
      <span class="ms-prog"></span>
    </header>
    <section class="ms-panel" role="region" aria-label="Study the map"></section>
  `, "fixed cx ms");
  const $ = s => el.querySelector(s), viewEl = $(".cx-view"), panel = $(".ms-panel"), ask = $(".ms-ask"), prog = $(".ms-prog");
  let ctrl = null, mapItems = [], levelItems = [], targets = [], G = null, gen = 0, P = null, shownItems = null;   // P: the session in play
  const style = (S.hm && HONEY_STYLES[S.hm.style]) ? S.hm.style : "original";

  // the honeycomb sits above the panel (the magnified middle is never under it)
  const ro = new ResizeObserver(() => { if (ctrl) ctrl.setInset({ bottom: panel.offsetHeight }); });
  ro.observe(panel); cleanup.push(() => ro.disconnect());
  $("[data-close]").onclick = () => { buzz(4); if (from === "gym") go("gym"); else if (typeof hmHome === "function") hmHome(); else go(S.tab || "learn"); };

  function mapUpdate(items, soft = true) {
    if (ctrl && items === shownItems) return;
    shownItems = items;
    if (!ctrl) {
      ctrl = honeycomb(viewEl, { items, style, tweak: typeof hmTweakFor === "function" ? hmTweakFor(style) : null, zoom: 1, centerFirst: true,
        pick: x => msOpenColor(x) });
      ctrl.setInset({ bottom: panel.offsetHeight });
    } else ctrl.update({ items, soft });
    G = null;
  }
  const graph = () => G || (G = ctrl && ctrl.studyPoints() ? msGraph(ctrl.studyPoints()) : new Map());
  const itemOf = k => (shownItems || mapItems).find(it => msLow(it.n) === k) || mapItems.find(it => msLow(it.n) === k) || null;
  // glide to the middle of the cluster (a board is one small cluster), a little closer for fewer bubbles: a calm
  // slide, never a jump
  function centerBoard(n) {
    const sp = ctrl.studyPoints(); if (!sp || !sp.pts.length) return;
    const k = sp.pts.length, x = sp.pts.reduce((s, p) => s + p.x, 0) / k, y = sp.pts.reduce((s, p) => s + p.y, 0) / k;
    ctrl.studyFlyTo({ x, y }, n <= 4 ? 1.2 : n <= 8 ? 1.1 : 1);
  }
  function setAsk(html) { ask.innerHTML = html; ask.hidden = !html; }
  function setProg(html) { prog.innerHTML = html || ""; }
  const reveal = new Set();   // names shown on the map during play (answered, landmarks, or the answer to a miss)
  const labelFn = x => reveal.has(msLow(x.n));

  async function load() {
    const g = ++gen;
    setAsk(""); setProg("");
    panel.innerHTML = `<div class="ms-load"><span class="ms-spin"></span><p>Laying out the map…</p></div>`;
    await Promise.all([loadCoreNames(), spec.level === "all" ? loadLongNames() : null]);
    if (!el.isConnected || g !== gen) return false;
    if (!msCore().length) {
      panel.innerHTML = `<div class="ms-empty"><h3 class="title-2">The map didn't load</h3><p>The color names couldn't be fetched. Check the connection and try again.</p><button class="btn" data-retry>Try again ${ICON.arrow}</button></div>`;
      panel.querySelector("[data-retry]").onclick = () => { CORE_LOADING = null; setup(); };
      return false;
    }
    levelItems = msLevelItems(spec.level, msSrc());
    return true;
  }

  // ---------------------------------------------------------------- setup (one tap to start)
  async function setup() {
    if (!(await load())) return;
    P = null; reveal.clear();
    if (ctrl) ctrl.study({ hit: null, label: null, marks: [], fog: null });
    const light = spec.mode === "light";
    targets = light ? [] : msSetItems(spec, levelItems);
    mapItems = msUniq(levelItems.concat(spec.mode === "wander" ? [] : targets));
    mapUpdate(mapItems);
    const fog = msFogFor(spec, "preview", msKnown());
    ctrl.study({ fog, hit: null, label: null, marks: [] });
    paintSetup();
  }
  const helpNow = () => testing ? MS_WHOLE : spec.diff === "you" ? msHelpOf(M, spec.level) : spec.help;
  const helpLine = h => {
    const b = msBoardSize(h, mapItems.length);
    if (spec.mode === "name") return b === Infinity ? "Type or say the name, from memory." : `${h <= 0 ? 3 : h <= 2 ? 4 : 6} names to choose from, all from this field.`;
    if (spec.mode === "hood") return `A corner of ${MS_HOOD[h]}; ${h >= MS_WHOLE ? "type each name" : "match each to its name"}.`;
    return b === Infinity ? "Search the whole field. A first miss gets a warmer hint." : `${b} bubbles to pick from${h >= MS_WARM ? "; a first miss gets a warmer hint" : ""}.`;
  };
  function paintSetup() {
    const mode = spec.mode, light = mode === "light", wander = mode === "wander", day = light ? msToday5() : null, known = msKnown();
    const best = M.best[`${mode}|${spec.level}|${spec.set}`];
    const li = MS_LEVELS.indexOf(spec.level), lk = msLevelKey(spec.level), foundN = (M.found[lk] || []).length;
    const mixN = msMixNames().length, favN = msFavNames().length, t = today();
    const todayN = ALL.filter(c => { const st = S.cards[c.id]; return st && (st.since === t || st.due <= t); }).length;
    const setChip = (id, label, n) => `<button class="ms-set${spec.set === id ? " on" : ""}" data-set="${id}"><b>${esc(label)}</b>${n != null ? `<small>${n}</small>` : ""}</button>`;
    const ptgs = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length && p.thumb && !p.stub).slice(0, 14);
    const sOpen = spec.set.startsWith("fam:") ? "fam" : spec.set.startsWith("ptg:") ? "ptg" : "";
    const nT = targets.length, empty = !light && !wander && nT < 3;
    const emptyLine = { today: "Nothing learned or due today yet. Today's words fill in as you learn and review.",
      mix: "No mix-ups yet. Play a few rounds; any two colors you confuse land here.",
      favs: "No favorites yet. Heart a color on its page and it lands here." }[spec.set] || "Too few colors in this set for a round. Slide to more colors or pick another set.";
    const lightLine = day && (day.done ? `Today's five are on your map. Five more tomorrow.` : day.names.length ? `Today: ${day.names.length} new color${day.names.length > 1 ? "s" : ""} to place. About two minutes.` : `You've met every core name. Every one is on your map.`);
    const rounds = mode === "find" || mode === "name" ? `${Math.min(MS_ROUNDS, nT)} rounds` : mode === "hood" ? "one corner" : "";
    const h = helpNow(), you = spec.diff === "you";
    const fieldRow = `<label class="ms-slide"><span class="ms-sl-t">How many</span><input type="range" min="0" max="${MS_LEVELS.length - 1}" step="1" value="${li}" data-field aria-label="How many colors"><b class="ms-sl-v" data-fieldv>${spec.level === "all" ? "All" : spec.level}</b></label>
      <p class="ms-hint" data-fieldhint>${msCleared(M, spec.level, levelItems.length) ? "Cleared. Slide right to grow the map." : foundN ? `${foundN.toLocaleString()} of ${levelItems.length.toLocaleString()} found here so far.` : spec.level === "all" ? "Every name, about 2,700. The deep end." : "The first names of the Learn list, in order."}</p>`;
    panel.innerHTML = `<div class="ms-setup">
      <div class="ms-grab"></div>
      <div class="ms-head"><h2 class="title-2">Study the map</h2><span>${known.size ? `${known.size.toLocaleString()} on your map` : ""}</span></div>
      <div class="ms-modes" role="radiogroup" aria-label="Mode">${MS_MODES.map(([id, name]) => `<button class="ms-mode${mode === id ? " on" : ""}" data-mode="${id}" role="radio" aria-checked="${mode === id}">${name}</button>`).join("")}</div>
      <p class="ms-what">${esc((MS_MODES.find(m => m[0] === mode) || MS_MODES[0])[2])}</p>
      ${light ? `<p class="ms-line">${esc(lightLine)}</p>` : wander ? fieldRow : `
      <div class="ms-sec"><b>Colors</b><span>${esc(msSetLabel(spec.set))} · ${nT.toLocaleString()}</span></div>
      <div class="ms-sets">
        ${setChip("level", "All in the field", null)}${setChip("today", "Today's words", todayN)}${setChip("mix", "Mix-ups", mixN)}${favN || spec.set === "favs" ? setChip("favs", "Favorites", favN) : ""}
        <button class="ms-set${sOpen === "fam" ? " on" : ""}" data-open-sub="fam"><b>A family</b></button><button class="ms-set${sOpen === "ptg" ? " on" : ""}" data-open-sub="ptg"><b>A painting</b></button>
      </div>
      <div class="ms-sub" data-sub="fam"${sOpen === "fam" ? "" : " hidden"}>${MS_FAMS.map(f => `<button class="ms-set${spec.set === "fam:" + f ? " on" : ""}" data-set="fam:${f}"><b>${f}</b></button>`).join("")}</div>
      <div class="ms-sub ms-ptgs" data-sub="ptg"${sOpen === "ptg" ? "" : " hidden"}>${ptgs.map(p => `<button class="ms-ptg${spec.set === "ptg:" + p.id ? " on" : ""}" data-set="ptg:${esc(p.id)}" aria-label="${esc(p.title)}"><img src="${esc(p.thumb)}" alt="" loading="lazy"><span>${p.palette.slice(0, 5).map(e => `<i style="--c:${e.h}"></i>`).join("")}</span></button>`).join("")}</div>
      <div class="ms-sec"><b>The field</b><span>the map you search</span></div>
      ${fieldRow}
      <div class="ms-sec"><b>Help</b><span>${you ? "adapts to you" : "your choice"}</span></div>
      <div class="hm-seg ms-diff" role="radiogroup" aria-label="Help">${[["you", "For you"], ["pick", "Choose"]].map(([m, l]) => `<button class="${(m === "you") === you ? "on" : ""}" role="radio" aria-checked="${(m === "you") === you}" data-dm="${m}">${l}</button>`).join("")}</div>
      ${you ? `<p class="ms-what">Right now: ${esc(msHelpWord(h, mapItems.length))}. Two right in a row widens it; a miss narrows it.</p>`
        : `<label class="ms-slide"><span class="ms-sl-t">Pick from</span><input type="range" min="0" max="${MS_WHOLE}" step="1" value="${spec.help}" data-help aria-label="How many bubbles to pick from"><b class="ms-sl-v" data-helpv>${spec.help >= MS_WHOLE ? "All" : MS_HELP[spec.help]}</b></label>
      <p class="ms-hint" data-helphint>${esc(helpLine(spec.help))}</p>`}`}
      <label class="ms-fog"><span><b>Your map</b><small>Veil the colors you haven't met yet. A view only; off unless you turn it on.</small></span><input type="checkbox" switch data-fog${spec.fog ? " checked" : ""}></label>
      ${empty ? `<p class="ms-line ms-warn">${esc(emptyLine)}</p>` : ""}
      ${best && !light && !wander ? `<p class="ms-best">Best here ${msStarRow(best.stars || 0)} ${best.r} of ${best.n}${best.streak > 2 ? ` · ${best.streak} in a row` : ""}</p>` : ""}
      <div class="ms-foot"><button class="btn ms-go" data-go${empty || (light && day && (!day.names.length)) ? " disabled" : ""}>${light ? (day && day.done ? "Find today's five again" : "Light up 5") : wander ? "Wander" : "Start"} ${rounds ? `<small>${esc(rounds)}</small>` : ""}${ICON.arrow}</button>${!light && !wander && !you && li > 0 && (mode === "find" || mode === "name") ? `<button class="btn ghost ms-test" data-test>Test out: 3 with no help clears every field below</button>` : ""}</div>
    </div>`;
    const re = (k, v) => { spec[k] = v; save(); buzz(4); };
    panel.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { re("mode", b.dataset.mode); setup(); });
    panel.querySelectorAll("[data-set]").forEach(b => b.onclick = () => { re("set", b.dataset.set); setup(); });
    panel.querySelectorAll("[data-open-sub]").forEach(b => b.onclick = () => { const s = panel.querySelector(`[data-sub="${b.dataset.openSub}"]`); panel.querySelectorAll(".ms-sub").forEach(x => { if (x !== s) x.hidden = true; }); s.hidden = !s.hidden; buzz(4); });
    panel.querySelectorAll("[data-dm]").forEach(b => b.onclick = () => { if (b.dataset.dm === "pick" && spec.diff === "you") spec.help = msHelpOf(M, spec.level); re("diff", b.dataset.dm); paintSetup(); });
    // the dials: a live label while dragging (a tick per stop), the map follows when you let go
    const fr = panel.querySelector("[data-field]");
    if (fr) {
      fr.oninput = () => { const l = MS_LEVELS[+fr.value]; panel.querySelector("[data-fieldv]").textContent = l === "all" ? "All" : l; panel.querySelector("[data-fieldhint]").textContent = l === "all" ? "Every name, about 2,700. The deep end." : `The first ${l} names of the Learn list.`; buzz(3); };
      fr.onchange = () => { re("level", MS_LEVELS[+fr.value]); setup(); };
    }
    const hr = panel.querySelector("[data-help]");
    if (hr) {
      const paint = () => { const v = +hr.value; panel.querySelector("[data-helpv]").textContent = v >= MS_WHOLE ? "All" : MS_HELP[v]; panel.querySelector("[data-helphint]").textContent = helpLine(v); };
      hr.oninput = () => { paint(); buzz(3); };
      hr.onchange = () => { re("help", +hr.value); paint(); };
    }
    const tb = panel.querySelector("[data-test]"); if (tb) tb.onclick = () => { buzz(8); start(true); };
    panel.querySelector("[data-fog]").onchange = e => { spec.fog = !!e.target.checked; save(); buzz(4); ctrl.study({ fog: msFogFor(spec, "preview", msKnown()) }); };
    panel.querySelector("[data-go]").onclick = () => { buzz(8); start(); };
  }

  // ---------------------------------------------------------------- play
  let testing = false;
  function newSession(kind, list, extra = {}) {
    const lk = msLevelKey(spec.level);
    P = { kind, list, i: 0, first: new Map(), right: 0, close: 0, streak: 0, bestStreak: 0, help: helpNow(), test: testing, t0: performance.now(), lk, ...extra };
    reveal.clear();
    ctrl.study({ fog: null, label: labelFn, marks: [], hit: (x, at) => onHit(x, at) });
    return P;
  }
  function start(test) {
    testing = test === true;
    if (spec.mode === "light") return lightUp();
    if (spec.mode === "wander") return wander();
    if (spec.mode === "hood") return hood();
    const due = new Set(dueList().map(c => msLow(c.n))), miss = new Set(Object.keys(M.miss[msLevelKey(spec.level)] || {})), found = new Set(M.found[msLevelKey(spec.level)] || []);
    newSession(spec.mode, msQueue(targets, testing ? 3 : MS_ROUNDS, { due, miss, found }));
    round();
  }
  // first answer per color per session counts (scheduling, found, mix-ups, the learner log)
  function record(it, res, by, said) {
    const k = msLow(it.n), ok = res === "right";
    if (P.first.has(k)) return false;
    msLog("answer", it, { ok, by: by || "game", ms: Math.round(performance.now() - (P.tq || P.t0)) });
    if (said && !ok && said.h) { msLog("confuse", it, { b: { n: said.n, h: said.h } }); const pair = [k, msLow(said.n)].sort().join("|"); M.mix[pair] = (M.mix[pair] || 0) + 1; }
    P.first.set(k, { it, res });
    msApply(it.c ? it : { ...it, c: BYNAME.get(k) || null }, ok, by);
    const f = M.found[P.lk] = M.found[P.lk] || [], ms = M.miss[P.lk] = M.miss[P.lk] || {};
    if (ok) { if (!f.includes(k)) f.push(k); delete ms[k]; } else ms[k] = today();
    save();
    return true;
  }
  // For you widens and narrows the help as you go; Choose and a test-out stay put
  function streakAfter(ok) {
    P.streak = ok ? P.streak + 1 : 0; P.bestStreak = Math.max(P.bestStreak, P.streak);
    const h0 = P.help; P.help = msHelpNext(P.help, ok, P.streak, spec.diff === "you" && !testing);
    return P.help > h0 ? "up" : P.help < h0 ? "down" : "";
  }
  function dots() {
    const n = P.list.length;
    return `<span class="ms-dots">${P.list.map((it, i) => { const f = P.first.get(msLow(it.n)); return `<i class="${i === P.i ? "now" : f ? f.res === "right" ? "ok" : f.res === "close" ? "near" : "no" : ""}"></i>`; }).join("")}</span><span class="ms-n">${Math.min(P.i + 1, n)} of ${n}${P.streak >= 3 ? ` · ${P.streak} in a row` : ""}</span>`;
  }
  const liftWord = (lift, kind) => !lift ? "" : `<span class="ms-lift">${lift === "up"
    ? (kind === "name" ? (msBoardSize(P.help, mapItems.length) === Infinity ? "Now from memory: type or say it." : "More names to choose from next.") : `The map opens up: ${msHelpWord(P.help, mapItems.length)} next.`)
    : (kind === "name" ? "Fewer names next." : `A little more help next: ${msHelpWord(P.help, mapItems.length)}.`)}</span>`;
  const optPool = k => msOptPool(mapItems, msCore(), k);
  // landmarks: on a big board, the colors you've already found here keep their names (never the one asked)
  function landmarks(t) {
    if (P.help < MS_WARM || P.test) return;
    const found = M.found[P.lk] || [], on = new Set((shownItems || mapItems).map(it => msLow(it.n)));
    found.forEach(k => { if (k !== msLow(t.n) && on.has(k)) reveal.add(k); });
  }

  // ---- find it / name it rounds
  function round() {
    if (P.i >= P.list.length) return finish();
    const t = P.list[P.i]; P.t = t; P.tq = performance.now(); P.answered = false; P.hinted = null;
    reveal.clear();
    if (P.kind === "find") {
      const size = msBoardSize(P.help, mapItems.length);
      if (size !== Infinity) {
        const board = msShuffle([t].concat(msDistractors(t, optPool(size), size - 1)));
        P.board = board; mapUpdate(board); centerBoard(board.length);
      } else if (P.board || !P.mapShown) { P.board = null; P.mapShown = true; mapUpdate(mapItems); }
      landmarks(t);
      ctrl.study({ label: labelFn, marks: [] });
      setAsk(`<small>Find</small><b><span>${esc(t.n)}</span></b>`);
      const n = P.board ? P.board.length : 0;
      panel.innerHTML = `<div class="ms-play"><p class="ms-say">${P.i === 0 && !M.seenFind ? `Tap ${esc(t.n.toLowerCase())} on the map. Drag to look around, pinch to zoom.` : n ? `One of these ${n}.${reveal.size ? " The names showing are ones you've found before." : ""}` : `Somewhere on the map.${reveal.size ? " Names you've found before are showing as landmarks." : " Drag and pinch to search."}`}</p>
        <div class="ms-acts"><button class="btn ghost" data-show>Show me</button></div></div>`;
      panel.querySelector("[data-show]").onclick = () => answerFind(null);
    } else {
      if (!P.mapShown || P.board) { P.board = null; P.mapShown = true; mapUpdate(mapItems); }
      // context: with the most help, its neighbors keep their names while you choose
      const typed = msBoardSize(P.help, mapItems.length) === Infinity;
      if (P.help <= 2 && !P.test) (graph().get(msLow(t.n)) || []).forEach(k => reveal.add(k));
      ctrl.study({ label: labelFn, marks: [{ n: t.n, kind: "pulse" }] });
      ctrl.studyFlyTo(t, typed ? 1.05 : 1.2);
      setAsk(`<small>Name the color</small><b>that breathes</b>`);
      nameUI(t, typed);
    }
    setProg(dots());
  }
  function nameUI(t, typed) {
    if (!typed) {
      const k = P.help <= 0 ? 2 : P.help <= 2 ? 3 : 5;
      const opts = msShuffle([t].concat(msDistractors(t, optPool(k), k)));
      panel.innerHTML = `<div class="ms-play"><p class="ms-say">${reveal.size ? "Its neighbors' names are showing. Which one is it?" : "Which name is it?"}</p><div class="ms-opts n${opts.length}">${opts.map(o => `<button class="ms-opt" data-n="${esc(o.n)}">${esc(o.n)}</button>`).join("")}</div>
        <div class="ms-acts"><button class="btn ghost" data-show>Show me</button></div></div>`;
      panel.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { const o = opts.find(x => x.n === b.dataset.n); answerName(o, "pick", b); });
    } else {
      const SR = typeof speechCtor === "function" ? speechCtor() : null;
      panel.innerHTML = `<div class="ms-play"><form class="say-form ms-form" autocomplete="off">
          <input class="say-in" type="text" enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Name this color" aria-label="Color name">
          ${SR ? `<button class="say-mic" type="button" data-mic aria-label="Say it out loud">${ICON_MIC}</button>` : ""}
          <button class="say-go" type="submit" aria-label="Check">${ICON.arrow}</button></form>
        <div class="ms-acts"><button class="btn ghost" data-show>Show me</button></div></div>`;
      const form = panel.querySelector("form"), inp = form.querySelector("input");
      const judge = v => { const pool = msCore().map(e => ({ n: e.n, h: e.h })); const j = sayJudge(v, { n: t.n, h: t.h }, pool); if (j.r === "wrong" && !j.said) { const alt = (t.also || []).find(a => sayNorm(a) === sayNorm(v)); if (alt) return { r: "right" }; } return j; };
      form.onsubmit = e => {
        e.preventDefault();
        const j = judge(inp.value);
        if (j.r === "empty") { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); return; }
        inp.blur();
        answerName(j.r === "right" ? t : j.nb || j.said || { n: inp.value.trim(), h: null }, "say", null, j.r === "close");
      };
      const mic = form.querySelector("[data-mic]");
      if (mic) mic.onclick = () => msListen(mic, alts => {
        const rank = { right: 3, close: 2, wrong: 1, empty: 0 }, best = alts.map(a => ({ a, j: judge(a) })).sort((p, q) => rank[q.j.r] - rank[p.j.r])[0];
        if (best && best.j.r !== "empty") { inp.value = best.a; form.requestSubmit(); }
      });
      if (matchMedia("(pointer: fine)").matches) setTimeout(() => inp.focus({ preventScroll: true }), 80);
    }
    panel.querySelector("[data-show]").onclick = () => answerName(null, "pick");
  }
  // the honeycomb answers here during play
  function onHit(x, at) {
    if (!P) return;
    if (P.kind === "find") {
      if (P.answered) { if (msLow(x.n) === msLow(P.t.n)) next(); else buzz(4); return; }
      return answerFind(x);
    }
    if (P.kind === "name") { if (P.answered && msLow(x.n) === msLow(P.t.n)) next(); else if (!P.answered) { buzz(4); say(`Name the breathing one: ${msBoardSize(P.help, mapItems.length) === Infinity ? "type or say it below" : "pick its name below"}.`); } return; }
    if (P.kind === "hood") return hoodTap(x);
    if (P.kind === "light") return lightTap(x);
    if (P.kind === "wander") return wanderTap(x);
  }
  const say = html => { const s = panel.querySelector(".ms-say"); if (s) { s.innerHTML = html; s.classList.remove("in"); void s.offsetWidth; s.classList.add("in"); } };
  function answerFind(x) {
    const t = P.t;
    if (x) msNote(x.h);
    const big = P.help >= MS_WARM && !P.test;
    const nb = big ? graph().get(msLow(t.n)) : null;
    let res = x ? msGrade(x, t, nb, big) : "wrong";
    // warmer: on a big board the first miss lights the answer's corner and says which way, instead of failing
    if (x && res !== "right" && big && !P.hinted) {
      P.hinted = x;
      const ring = [...(nb || [])].map(itemOf).filter(Boolean);
      ctrl.study({ marks: ring.map(it => ({ n: it.n, kind: "ring" })).concat([{ n: t.n, kind: "ring" }, { n: x.n, kind: "wrong" }]) });
      reveal.add(msLow(x.n)); ctrl.study({ label: labelFn });
      // glide to a ringed neighbor, not to the answer itself (the middle of the screen would give it away)
      ctrl.studyFlyTo(ring.length ? ring[Math.random() * ring.length | 0] : t);
      msSfx("near"); buzz([6, 30, 6]);
      say(`<b>Warmer.</b> ${esc(t.n)} is ${esc(msDir(t, x))} than ${esc(x.n.toLowerCase())}. It's one of the ringed ones.`);
      return;
    }
    if (P.hinted && res === "right") res = "close";   // found after a hint: next door, not a first-try right
    P.answered = true; M.seenFind = 1;
    record(t, res, "pick", x && res !== "right" ? x : P.hinted || null);   // "Show me" is a miss, as in Practice
    if (res === "right") P.right++; else if (res === "close") P.close++;
    const lift = streakAfter(res === "right");
    reveal.add(msLow(t.n)); if (x) reveal.add(msLow(x.n));
    const marks = [{ n: t.n, kind: res === "right" ? "right" : "true" }];
    // the reveal path: from your tap to the answer, the colors in between get their names and a quiet ring
    const wrongAt = res === "right" ? null : (x && msLow(x.n) !== msLow(t.n) ? x : P.hinted);
    let between = [];
    if (wrongAt) {
      marks.push({ n: wrongAt.n, kind: "wrong" });
      between = msBetween(graph(), wrongAt.n, t.n, 4).map(itemOf).filter(Boolean);
      between.forEach(b => { reveal.add(msLow(b.n)); marks.push({ n: b.n, kind: "ring" }); });
    }
    ctrl.study({ marks, label: labelFn });
    setProg(dots());
    const lw = liftWord(lift, "find");
    if (res === "right") {
      msSfx(P.streak >= 3 && P.streak % 3 === 0 ? "combo" : "right"); buzz(12);
      panel.innerHTML = `<div class="ms-play ms-res ok"><p class="ms-say in"><b>${esc(t.n)}.</b> ${P.streak >= 3 ? `${P.streak} in a row.` : "Right."}</p>${lw}</div>`;
      later(next, lift ? 1500 : 950);
      return;
    }
    msSfx(res === "close" ? "near" : "wrong"); buzz(res === "close" ? [8, 30, 8] : [10, 40, 10]);
    ctrl.studyFlyTo(t, between.length > 1 ? .85 : undefined);   // a little wider when there's a path to read
    const path = between.length ? ` On the way: ${between.map(b => esc(b.n.toLowerCase())).join(", ")}.` : "";
    const line = res === "close" && P.hinted && x && msLow(x.n) === msLow(t.n) ? `Found with the hint. ${esc(t.n)} is ${esc(msDir(t, P.hinted))} than ${esc(P.hinted.n.toLowerCase())}.`
      : !wrongAt ? `Here it is. Look at its neighbors: that's where it lives.`
      : res === "close" ? `You picked ${esc(wrongAt.n.toLowerCase())}, right next door: ${esc(t.n.toLowerCase())} is ${esc(msDir(t, wrongAt))}.`
      : `You picked ${esc(wrongAt.n.toLowerCase())}. ${esc(t.n)} is ${esc(msDir(t, wrongAt))}.${path}`;
    panel.innerHTML = `<div class="ms-play ms-res ${res === "close" ? "near" : "no"}"><p class="ms-say in"><b>${res === "close" ? "Next door." : `${esc(t.n)} is here.`}</b> ${line}</p>${lw}
      <div class="ms-acts"><button class="btn" data-next>Next ${ICON.arrow}</button></div><p class="ms-fine">Or tap ${esc(t.n.toLowerCase())} to go on.</p></div>`;
    panel.querySelector("[data-next]").onclick = next;
    // a miss comes back once, a few rounds later (it still counts as missed; only the first answer counts)
    P.requeued = P.requeued || new Set();
    if (!P.requeued.has(msLow(t.n)) && P.list.length - P.i > 3) { P.requeued.add(msLow(t.n)); P.list.splice(P.i + 4, 0, t); }
  }
  function answerName(o, by, btn, close) {
    if (P.answered) return;
    const t = P.t; P.answered = true;
    const res = o && msLow(o.n) === msLow(t.n) ? "right" : close ? "close" : "wrong";
    const said = o && res !== "right" && o.h ? o : null;
    record(t, res, by, said);
    if (res === "right") P.right++;
    const lift = streakAfter(res === "right");
    reveal.add(msLow(t.n)); if (said) reveal.add(msLow(said.n));
    const marks = [{ n: t.n, kind: res === "right" ? "right" : "true" }]; if (said) marks.push({ n: said.n, kind: "wrong" });
    ctrl.study({ marks, label: labelFn });
    panel.querySelectorAll("[data-n]").forEach(b => { b.disabled = true; if (msLow(b.dataset.n) === msLow(t.n)) b.classList.add("ok"); else if (b === btn) b.classList.add("no"); });
    setProg(dots());
    const lw = liftWord(lift, "name");
    const body = res === "right" ? `<b>${esc(t.n)}.</b> ${P.streak >= 3 ? `${P.streak} in a row.` : "Right."}`
      : !o ? `<b>This is ${esc(t.n.toLowerCase())}.</b>`
      : said ? `<b>This is ${esc(t.n.toLowerCase())}.</b> ${esc(said.n)} is ${esc(msDir(said, t))}${res === "close" ? ", its neighbor" : ""}.`
      : `<b>This is ${esc(t.n.toLowerCase())}.</b> You wrote “${esc(String(o.n).slice(0, 28))}”.`;
    msSfx(res === "right" ? (P.streak >= 3 && P.streak % 3 === 0 ? "combo" : "right") : res === "close" ? "near" : "wrong");
    buzz(res === "right" ? 12 : [10, 40, 10]);
    const resEl = document.createElement("div");
    resEl.className = `ms-res ${res === "right" ? "ok" : res === "close" ? "near" : "no"}`;
    resEl.innerHTML = `<p class="ms-say in">${body}</p>${lw}${res === "right" ? "" : `<div class="ms-acts"><button class="btn" data-next>Next ${ICON.arrow}</button></div>`}`;
    const play = panel.querySelector(".ms-play"); play.querySelectorAll(".ms-acts,form,.ms-say").forEach(n => n.remove()); play.appendChild(resEl);
    if (res === "right") later(next, lift ? 1500 : 1000); else resEl.querySelector("[data-next]").onclick = next;
    // a wrong name: the one you chose and the one it was fill the screen, once the map has shown where they sit
    if (said && res !== "right" && typeof mcShow === "function") { const i0 = P.i; later(() => { if (P && P.i === i0 && P.kind !== "done") mcShow({ you: { n: said.n, h: said.h }, was: { n: t.n, h: t.h }, label: "Next", go: next }); }, 1100); }
  }
  function next() { if (!P || P.kind === "done") return; P.i++; round(); }

  function finish() {
    const n = P.first.size, r = [...P.first.values()].filter(f => f.res === "right").length, stars = msStars(r + P.close * .5, n);
    const key = `${spec.mode}|${spec.level}|${spec.set}`, old = M.best[key], isBest = !old || r > old.r || (r === old.r && P.bestStreak > (old.streak || 0));
    if (isBest && !P.test) M.best[key] = { r, n, streak: P.bestStreak, stars, at: today() };
    // For you keeps where the help ended; a passed test-out (all 3 right) clears every field below this one
    if (!P.test && spec.diff === "you") M.help[P.lk] = P.help;
    const li0 = MS_LEVELS.indexOf(spec.level), tpass = P.test && n >= 3 && r === n;
    if (tpass) MS_LEVELS.slice(0, li0).forEach(l => { M.cleared[msLevelKey(l)] = 1; });
    save();
    const misses = [...P.first.values()].filter(f => f.res !== "right").map(f => f.it);
    const lvAll = levelItems.length, foundL = M.found[P.lk] || [], found = foundL.length, cleared = msCleared(M, spec.level, lvAll), nextLv = msNextLevel(spec.level);
    // the area you've conquered: every color found so far in this field, named and ringed; this round's on top
    if (P.board) { P.board = null; mapUpdate(mapItems); }
    reveal.clear(); foundL.forEach(k => reveal.add(k)); P.list.forEach(it => reveal.add(msLow(it.n)));
    const sess = new Set(P.list.map(it => msLow(it.n)));
    const marks = foundL.filter(k => !sess.has(k)).map(k => itemOf(k)).filter(Boolean).map(it => ({ n: it.n, kind: "ring" }))
      .concat(P.list.map(it => ({ n: it.n, kind: (P.first.get(msLow(it.n)) || {}).res === "right" ? "right" : "true" })));
    ctrl.study({ hit: null, label: labelFn, marks });
    ctrl.studyZoom(.75);
    setAsk(`<small>${spec.mode === "find" ? "Find it" : "Name it"} · ${esc(msLevelWord(spec.level))}</small><b>${r === n ? "Every one" : `${r} of ${n}`}</b>`);
    setProg("");
    P.kind = "done";
    const nextStep = P.test ? "" : spec.diff === "you" ? (cleared && nextLv ? `This field is ${found >= lvAll ? "all" : "nearly all"} found. Ready to grow it.` : `Next time: ${msHelpWord(P.help, mapItems.length)}.`) : "";
    panel.innerHTML = `<div class="ms-end">
      <div class="ms-end-top">${msStarRow(stars)}${isBest && old ? `<span class="ms-new">New best</span>` : ""}</div>
      <h3 class="title-2">${P.test ? (tpass ? `Every field below ${esc(msLevelWord(spec.level))} is cleared.` : "Not this time: all three to clear the fields below.") : r === n ? "A clean sweep." : `${r} of ${n} on the first try`}</h3>
      <p class="ms-line">${P.close ? `${P.close} next door. ` : ""}${P.bestStreak > 1 ? `Longest run: ${P.bestStreak}. ` : ""}${found.toLocaleString()} of ${lvAll.toLocaleString()} in this field found so far; they're ringed on the map.</p>
      ${nextStep ? `<p class="ms-line ms-good">${esc(nextStep)}</p>` : ""}
      ${misses.length ? `<div class="ms-sec"><b>Look again</b><span>tap one for its page</span></div><div class="ms-chips">${misses.map(msChip).join("")}</div>` : ""}
      ${cleared && nextLv && !P.test ? `<button class="btn" data-nextlv>Grow the map to ${esc(msLevelWord(nextLv))} ${ICON.arrow}</button>` : ""}
      <button class="btn${cleared && nextLv && !P.test ? " ghost" : ""}" data-again>Again <small>new colors first</small>${ICON.arrow}</button>
      <div class="ms-acts"><button class="btn ghost" data-setup>Change</button></div>
    </div>`;
    wireEnd();
    const hexes = P.list.map(it => it.h);
    msSfx(stars >= 2 ? "complete" : "settle", hexes); if (isBest && old && stars >= 2) later(() => msSfx("best", hexes), 700);
    buzz(stars >= 3 ? [12, 60, 12] : 10);
    testing = false;
  }
  function wireEnd() {
    panel.querySelectorAll("[data-open]").forEach(b => b.onclick = () => msOpenColor(msItemOf(b.dataset.open) || mapItems.find(x => x.n === b.dataset.open)));
    const a = panel.querySelector("[data-again]"); if (a) a.onclick = () => { buzz(8); setup().then(() => start()); };
    const nl = panel.querySelector("[data-nextlv]"); if (nl) nl.onclick = () => { const nx = msNextLevel(spec.level); if (!nx) return; spec.level = nx; save(); buzz(8); msSfx("levelup"); setup(); };
    const st = panel.querySelector("[data-setup]"); if (st) st.onclick = () => { buzz(4); setup(); };
  }

  // ---- neighborhood: a matching game in one corner of the map
  function hood() {
    if (!P || !P.mapShown || P.board) mapUpdate(mapItems);
    const g = graph(), h0 = helpNow();
    const found = new Set(M.found[msLevelKey(spec.level)] || []);
    const centers = msShuffle(targets.filter(it => g.has(msLow(it.n))));
    const center = centers.find(it => !found.has(msLow(it.n))) || centers[0];
    if (!center) { toast("This set is too small for a neighborhood"); return setup(); }
    const names = msHood(g, center.n, Math.min(MS_HOOD[h0], mapItems.length));
    const region = names.map(itemOf).filter(Boolean);
    newSession("hood", region, { center, region: new Set(names), cur: null, done: new Map(), help: h0, mapShown: true });
    ctrl.studyFlyTo(center, region.length > 6 ? 1.15 : 1.35);
    hoodPaint();
    setAsk(`<small>Neighborhood</small><b>Name these ${region.length}</b>`);
    panel.innerHTML = `<div class="ms-play"><p class="ms-say in">${!M.seenHood ? "Tap a ringed bubble, then pick its name." : "Tap a ringed bubble to name it."}</p>
      <div class="ms-opts ms-hood-opts"></div>
      <div class="ms-acts"><button class="btn ghost" data-reveal>Show the rest</button></div></div>`;
    panel.querySelector("[data-reveal]").onclick = () => hoodEnd(true);
    hoodProg();
  }
  function hoodPaint() {
    ctrl.study({ label: labelFn, marks: P.list.map(it => { const k = msLow(it.n), d = P.done.get(k); return { n: it.n, kind: P.cur && msLow(P.cur.n) === k ? "pulse" : d ? (d === "right" ? "right" : "true") : "ring" }; }) });
  }
  function hoodProg() { setProg(`<span class="ms-n">${P.done.size} of ${P.list.length} named</span>`); }
  function hoodTap(x) {
    const k = msLow(x.n);
    if (!P.region.has(k)) { buzz(4); say(`That one's outside the ring. ${P.list.length - P.done.size} left inside.`); return; }
    if (P.done.has(k)) { buzz(4); msNote(x.h); say(`<b>${esc(x.n)}</b>, already named.`); return; }
    P.cur = itemOf(k) || x; P.tq = performance.now(); buzz(6); msNote(P.cur.h); hoodPaint();
    // the names still to place: the ring's own names, so it's a matching game; one decoy keeps the last fair
    const typed = P.help >= MS_WHOLE;
    let opts = null;
    if (!typed) {
      const left = P.list.filter(it => !P.done.has(msLow(it.n)));
      const extra = left.length < 3 ? msDistractors(P.cur, optPool(3), 3 - left.length).filter(d => !left.some(l => msLow(l.n) === msLow(d.n))) : [];
      opts = msShuffle(left.concat(extra));
    }
    const box = panel.querySelector(".ms-hood-opts");
    say(opts ? "Which name is it?" : "Type or say its name.");
    if (opts) {
      box.className = `ms-opts ms-hood-opts n${Math.min(opts.length, 6)}`;
      box.innerHTML = opts.map(o => `<button class="ms-opt" data-n="${esc(o.n)}">${esc(o.n)}</button>`).join("");
      box.querySelectorAll("[data-n]").forEach(b => b.onclick = () => hoodAnswer(opts.find(o => o.n === b.dataset.n)));
    } else {
      box.className = "ms-hood-opts";
      box.innerHTML = `<form class="say-form ms-form" autocomplete="off"><input class="say-in" type="text" enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Its name" aria-label="Color name"><button class="say-go" type="submit" aria-label="Check">${ICON.arrow}</button></form>`;
      const f = box.querySelector("form"), inp = f.querySelector("input");
      f.onsubmit = e => { e.preventDefault(); const j = sayJudge(inp.value, { n: P.cur.n, h: P.cur.h }, msCore().map(c => ({ n: c.n, h: c.h }))); if (j.r === "empty") return; inp.blur(); hoodAnswer(j.r === "right" ? P.cur : j.nb || j.said || null, j.r === "close"); };
      setTimeout(() => inp.focus({ preventScroll: true }), 60);
    }
  }
  function hoodAnswer(o, close) {
    const t = P.cur; if (!t) return;
    const k = msLow(t.n), res = o && msLow(o.n) === k ? "right" : close ? "close" : "wrong";
    record(t, res, P.help < MS_WHOLE ? "pick" : "say", o && res !== "right" ? o : null);
    P.done.set(k, res); reveal.add(k); if (res === "right") P.right++;
    P.cur = null; hoodPaint(); hoodProg();
    msSfx(res === "right" ? "right" : "wrong"); buzz(res === "right" ? 12 : [10, 40, 10]);
    const box = panel.querySelector(".ms-hood-opts"); box.innerHTML = ""; box.className = "ms-opts ms-hood-opts";
    say(res === "right" ? `<b>${esc(t.n)}.</b> Right. ${P.list.length - P.done.size ? "Tap the next ringed one." : ""}` : `<b>That's ${esc(t.n.toLowerCase())}.</b> ${o ? `${esc(o.n)} is ${esc(msDir(o, t))}.` : ""}`);
    if (P.done.size >= P.list.length) later(() => hoodEnd(false), 900);
  }
  function hoodEnd(early) {
    const n = P.list.length, r = P.right, stars = early ? Math.min(1, msStars(r, n)) : msStars(r, n);
    const key = `hood|${spec.level}|${spec.set}`, old = M.best[key]; if (!old || r / n > old.r / old.n) M.best[key] = { r, n, stars, at: today() };
    M.seenHood = 1;
    // For you: a clean corner (80%+) widens the next one, half or worse (or giving up) narrows it
    if (spec.diff === "you") M.help[P.lk] = early || r / n < .5 ? Math.max(0, P.help - 1) : r / n >= .8 ? Math.min(MS_WHOLE, P.help + 1) : P.help;
    save();
    P.list.forEach(it => reveal.add(msLow(it.n)));
    // everything nearby gets its name too: the neighborhood in context
    msHood(graph(), P.center.n, P.list.length + 12).forEach(k => reveal.add(k));
    ctrl.study({ hit: null, label: labelFn, marks: P.list.map(it => ({ n: it.n, kind: P.done.get(msLow(it.n)) === "right" ? "right" : "true" })) });
    ctrl.studyZoom(.95);
    P.kind = "done";
    setAsk(`<small>Neighborhood</small><b>${r} of ${n} named</b>`); setProg("");
    const miss = P.list.filter(it => P.done.get(msLow(it.n)) !== "right");
    panel.innerHTML = `<div class="ms-end">
      <div class="ms-end-top">${msStarRow(stars)}</div>
      <h3 class="title-2">${r === n ? "You know this corner." : early ? "Here they all are." : `${r} of ${n} named`}</h3>
      <p class="ms-line">Every name nearby is showing now. Drag around: each one sits between the colors it's made of.</p>
      ${miss.length ? `<div class="ms-sec"><b>Look again</b><span>tap one for its page</span></div><div class="ms-chips">${miss.map(msChip).join("")}</div>` : ""}
      <button class="btn" data-again>Another corner ${ICON.arrow}</button>
      <div class="ms-acts"><button class="btn ghost" data-setup>Change</button></div></div>`;
    wireEnd();
    panel.querySelector("[data-again]").onclick = () => { buzz(8); P = null; hood(); };
    msSfx(stars >= 2 ? "complete" : "settle", P.list.map(it => it.h));
    buzz(stars >= 3 ? [12, 60, 12] : 10);
  }

  // ---- wander: no score, every name on; a tap plays the color's note and compares it with the last one
  function wander() {
    if (P && P.board) mapUpdate(mapItems);
    newSession("wander", [], { last: null, seen: new Set(), mapShown: true });
    mapItems.forEach(it => reveal.add(msLow(it.n)));
    ctrl.study({ label: labelFn, marks: [] });
    ctrl.studyZoom(.9);
    setAsk(`<small>Wander</small><b>${esc(msLevelWord(spec.level))}</b>`);
    setProg("");
    panel.innerHTML = `<div class="ms-play"><p class="ms-say in">Tap any bubble to hear it. Tap two in a row and you'll read how they differ.</p>
      <div class="ms-acts"><button class="btn ghost" data-setup>Done</button></div></div>`;
    panel.querySelector("[data-setup]").onclick = () => { buzz(4); setup(); };
  }
  function wanderTap(x) {
    const it = itemOf(msLow(x.n)) || x, last = P.last;
    msNote(it.h); buzz(6);
    if (!P.seen.has(msLow(it.n))) { P.seen.add(msLow(it.n)); msLog("seen", it); }
    ctrl.study({ marks: (last ? [{ n: last.n, kind: "start" }] : []).concat([{ n: it.n, kind: "pulse" }]) });
    ctrl.studyFlyTo(it);
    P.last = it;
    const cmp = last && msLow(last.n) !== msLow(it.n) ? ` ${esc(msDir(it, last)).replace(/^./, c => c.toUpperCase())} than ${esc(last.n.toLowerCase())}.` : "";
    panel.innerHTML = `<div class="ms-play"><p class="ms-say in"><b>${esc(it.n)}</b>${cmp ? `<br>${cmp.trim()}` : ""}</p>
      <div class="ms-acts"><button class="btn" data-open="${esc(it.n)}">Its page ${ICON.arrow}</button><button class="btn ghost" data-setup>Done</button></div></div>`;
    panel.querySelector("[data-open]").onclick = () => msOpenColor(it);
    panel.querySelector("[data-setup]").onclick = () => { buzz(4); setup(); };
    setProg(`<span class="ms-n">${P.seen.size} looked at</span>`);
  }

  // ---- today's five
  function lightUp() {
    const day = msToday5();
    const items = day.names.map(n => msItemOf(n)).filter(Boolean);
    if (!items.length) return setup();
    // the field: the Learn layer, or the whole core when today's names sit past it
    const maxRank = Math.max(...items.map(it => it.rank || 0));
    mapItems = msUniq(msCore().slice(0, maxRank < 614 ? 614 : msCore().length).concat(items));
    mapUpdate(mapItems);
    const known = msKnown();
    newSession("light", items, { stage: day.done ? "find" : "meet", known, mapShown: true });
    if (P.stage === "find") return lightFind();
    lightMeet();
  }
  function lightMeet() {
    if (P.i >= P.list.length) { P.i = 0; P.stage = "find"; return lightFind(); }
    const t = P.list[P.i]; msLog("seen", t); msNote(t.h);
    const g = graph(), nb = [...(g.get(msLow(t.n)) || [])].map(itemOf).filter(Boolean);
    const anchors = nb.filter(x => P.known.has(msLow(x.n))).concat(nb.filter(x => !P.known.has(msLow(x.n)))).slice(0, 2);
    // your map so far keeps its names; today's new one shows its own
    // (the two neighbors it's described against show their names and a quiet ring, so the words point somewhere)
    reveal.clear(); P.known.forEach(k => reveal.add(k)); P.list.slice(0, P.i + 1).forEach(it => reveal.add(msLow(it.n))); anchors.forEach(a => reveal.add(msLow(a.n)));
    ctrl.study({ label: labelFn, marks: P.list.slice(0, P.i).map(it => ({ n: it.n, kind: "start" })).concat(anchors.map(a => ({ n: a.n, kind: "ring" })), [{ n: t.n, kind: "pulse" }]) });
    ctrl.studyFlyTo(t, 1.35);
    setAsk(`<small>New on your map · ${P.i + 1} of ${P.list.length}</small><b>${esc(t.n)}</b>`);
    setProg(`<span class="ms-dots">${P.list.map((x, i) => `<i class="${i < P.i ? "ok" : i === P.i ? "now" : ""}"></i>`).join("")}</span>`);
    const where = anchors.length ? anchors.map(a => `${msDir(t, a)} than ${a.n.toLowerCase()}`).join("; ") : "";
    panel.innerHTML = `<div class="ms-play"><p class="ms-say in"><b>${esc(t.n)}</b>${where ? ` sits here: ${esc(where)}.` : "."}</p>
      <div class="ms-acts"><button class="btn" data-next>${P.i < P.list.length - 1 ? "Next" : "Now find them"} ${ICON.arrow}</button><button class="btn ghost" data-open="${esc(t.n)}">Its page</button></div></div>`;
    panel.querySelector("[data-next]").onclick = () => { buzz(6); P.i++; lightMeet(); };
    panel.querySelector("[data-open]").onclick = () => msOpenColor(t);
  }
  function lightTap(x) {
    if (P.stage === "meet") { if (msLow(x.n) === msLow(P.list[P.i].n)) { buzz(6); P.i++; lightMeet(); } else { buzz(4); msNote(x.h); say(`That's ${P.known.has(msLow(x.n)) ? esc(x.n.toLowerCase()) : "one you haven't met yet"}. Tap ${esc(P.list[P.i].n.toLowerCase())} or Next.`); } return; }
    if (P.answered) { if (msLow(x.n) === msLow(P.t.n)) lightNext(); else buzz(4); return; }
    msNote(x.h);
    const t = P.t, res = msGrade(x, t, graph().get(msLow(t.n)), true);
    P.answered = true; P.first.set(msLow(t.n), { it: t, res });
    if (res === "right") P.right++;
    reveal.add(msLow(t.n)); if (res !== "right") reveal.add(msLow(x.n));
    const marks = [{ n: t.n, kind: res === "right" ? "right" : "true" }]; if (res !== "right") marks.push({ n: x.n, kind: "wrong" });
    ctrl.study({ marks });
    msLog("answer", t, { ok: res === "right", by: "pick" }); if (res !== "right") msLog("confuse", t, { b: { n: x.n, h: x.h } });
    if (res === "right") { msSfx("right"); buzz(12); say(`<b>${esc(t.n)}.</b> On your map.`); later(lightNext, 950); return; }
    msSfx(res === "close" ? "near" : "wrong"); buzz([10, 40, 10]); ctrl.studyFlyTo(t);
    say(`<b>${res === "close" ? "Next door." : `${esc(t.n)} is here.`}</b> You picked ${esc(x.n.toLowerCase())}: ${esc(t.n.toLowerCase())} is ${esc(msDir(t, x))}.`);
    const acts = panel.querySelector(".ms-acts"); acts.innerHTML = `<button class="btn" data-next>Next ${ICON.arrow}</button>`; acts.querySelector("[data-next]").onclick = lightNext;
  }
  function lightFind() {
    if (P.i >= P.list.length) return lightEnd();
    const t = P.t = P.list[P.i]; P.answered = false;
    reveal.clear(); P.known.forEach(k => reveal.add(k));
    P.list.forEach((it, i) => { if (i < P.i) reveal.add(msLow(it.n)); });
    ctrl.study({ label: labelFn, marks: [] });
    if (P.i === 0) ctrl.studyZoom(.85);
    setAsk(`<small>Find, from memory</small><b>${esc(t.n)}</b>`);
    setProg(`<span class="ms-dots">${P.list.map((x, i) => { const f = P.first.get(msLow(x.n)); return `<i class="${i === P.i ? "now" : f ? f.res === "right" ? "ok" : "no" : ""}"></i>`; }).join("")}</span>`);
    panel.innerHTML = `<div class="ms-play"><p class="ms-say in">Your named colors are showing. Today's five aren't.</p><div class="ms-acts"><button class="btn ghost" data-skip>Show me</button></div></div>`;
    panel.querySelector("[data-skip]").onclick = () => { P.answered = true; P.first.set(msLow(t.n), { it: t, res: "wrong" }); reveal.add(msLow(t.n)); ctrl.study({ marks: [{ n: t.n, kind: "true" }] }); ctrl.studyFlyTo(t); buzz(6); say(`<b>${esc(t.n)} is here.</b>`); const a = panel.querySelector(".ms-acts"); a.innerHTML = `<button class="btn" data-next>Next ${ICON.arrow}</button>`; a.querySelector("[data-next]").onclick = lightNext; };
  }
  function lightNext() { P.i++; lightFind(); }
  function lightEnd() {
    const day = msToday5(), first = !day.done;
    P.list.forEach(it => { if (!M.lit[msLow(it.n)]) M.lit[msLow(it.n)] = today(); });
    day.done = true; M.days = (M.days || 0) + (first ? 1 : 0); save();
    const r = P.right, n = P.list.length, total = msKnown().size;
    P.list.forEach(it => reveal.add(msLow(it.n)));
    ctrl.study({ hit: null, label: labelFn, marks: P.list.map(it => ({ n: it.n, kind: (P.first.get(msLow(it.n)) || {}).res === "right" ? "right" : "true" })) });
    ctrl.studyZoom(.7);
    P.kind = "done";
    setAsk(`<small>Today's five</small><b>${n} lit today</b>`); setProg("");
    panel.innerHTML = `<div class="ms-end">
      <div class="ms-end-top">${msStarRow(msStars(r, n))}</div>
      <h3 class="title-2">Your map holds ${total.toLocaleString()} color${total === 1 ? "" : "s"} now.</h3>
      <p class="ms-line">${r} of ${n} found again from memory. Five more tomorrow${M.days > 1 ? `; ${M.days} days of lighting so far` : ""}.</p>
      <label class="ms-fog"><span><b>See your map</b><small>Veil everything you haven't met.</small></span><input type="checkbox" switch data-fog-end></label>
      <div class="ms-chips" data-lit>${P.list.map(msChip).join("")}</div>
      <button class="btn" data-done>Put them on my map ${ICON.arrow}</button>
      <div class="ms-acts"><button class="btn ghost" data-setup>Study more</button></div></div>`;
    panel.querySelector("[data-fog-end]").onchange = e => { buzz(4); ctrl.study({ fog: e.target.checked ? (o => msKnown().has(msLow(o.n))) : null, marks: [] }); };
    const lit = P.list.slice();
    panel.querySelector("[data-done]").onclick = () => {
      buzz(8);
      if (typeof flyToMap === "function") flyToMap(lit.map(it => ({ n: it.n, h: it.h })), [...panel.querySelectorAll("[data-lit] .ms-chip i")]);
      else $("[data-close]").click();
    };
    wireEnd();
    msSfx("complete", lit.map(it => it.h));
    buzz([12, 60, 12]);
  }

  // speech: the best of the recognizer's guesses (the same approach as js/produce.js sayCard)
  function msListen(btn, onAlts) {
    const SR = speechCtor(); if (!SR) return;
    if (btn.rec) { try { btn.rec.stop(); } catch (e) {} return; }
    try {
      const rec = btn.rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 5;
      rec.onresult = ev => onAlts([...ev.results[0]].map(a => a.transcript));
      rec.onerror = ev => { if (ev.error !== "aborted") toast(ev.error === "not-allowed" ? "Microphone is off" : "Didn't catch that"); };
      rec.onend = () => { btn.rec = null; btn.classList.remove("on"); };
      rec.start(); btn.classList.add("on"); buzz(6);
      cleanup.push(() => { if (btn.rec) try { btn.rec.abort(); } catch (e) {} });
    } catch (e) { btn.rec = null; btn.remove(); }
  }

  window.MS_DEBUG = { get P() { return P; }, get ctrl() { return ctrl; }, start, setup, onHit: (x, at) => onHit(x, at), get mapItems() { return mapItems; } };
  setup().then(() => { if (o.autostart) start(); });
}

// ---------- entry points: Home's chrome (js/home.js) and a Train tile (js/gym.js) ----------
function msHomeButton() { return `<button class="corner ms-corner" id="hmMapStudy" aria-label="Study the map">${MS_ICON}</button>`; }
function msTrainShelf() {
  const M = msState(), lvl = M.spec.level, f = (M.found[msLevelKey(lvl)] || []).length, day = M.day && M.day.d === today() && M.day.done;
  const art = ["#7FA88A", "#B9C9A7", "#4E7A6A", "#A8C3BC", "#D5D9B0", "#5C8C78", "#93B39A"].map(h => `<i style="--c:${h}"></i>`).join("");
  return `<div class="sec-head"><b>The map</b><span>study on the honeycomb</span></div>
    <div class="gs-grid"><button class="gs-tile ms-tile" data-mapstudy><span class="sa ms-art">${art}</span><span class="gs-name">Study the map</span>
      <span class="gs-meta"><span>${f ? (lvl === "all" ? `${f.toLocaleString()} names found` : `${f.toLocaleString()} of ${lvl} found`) : "New"}</span></span><span class="ladder blank"></span>
      <span class="gs-best">${day ? "Today's five are lit" : "Find, name and wander the colors"}</span></button></div>`;
}
function msWireTrain(el) { const b = el.querySelector("[data-mapstudy]"); if (b) b.onclick = () => msOpen({ from: "gym" }); }
