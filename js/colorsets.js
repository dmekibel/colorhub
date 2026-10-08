"use strict";
// Which colors, separate from how you see them.
//  - csItems(): every color the app can show: the 101 to learn ({ n, h, c: the app color, lib }) and the name library
//    ({ n, h, lib }), each with L, C, H (LCh), src and rank. rank is a farthest-point order in CIELAB, the 101 first,
//    so the first N of ANY filtered list are evenly spread: a count slider is just "take the first N".
//  - filterColors(items, { n, hue: [a, b], L: [a, b], C: [a, b], sources, q }): the live filter. Pure; reusable.
//    hue wraps (a > b means through red, e.g. [330, 40]); [0, 360] means every hue (greys only count then).
//  - COLOR_SETS: named starting points (presets) for that filter, grouped. getSet(id) -> items.
//  - COLOR_VIEWS: view modes { id, title, render(host, items, opts) -> { update, current, destroy } }. Add more here.
//  - colorExplorer({ focus, pick, back }): the explorer, a full-screen tool. The view fills the screen; the title is one
//    plain sentence naming what you see ("Blues · from every name ▾") and opens one sheet of choices (which colors,
//    one family, a feel, a tradition). A glass bar at the bottom names the color in the middle and holds Fine-tune
//    (hue ring, how many, lightness, strength, live behind a short sheet) and the Map/Wheel switch. Saved in S.cb.
//  - colorBrowser(host, { focus, pick }): the Explore "Colors" card, a quiet live preview that opens the explorer.

const CS_CMAX = 132;
const CS_SRC = [["jp", "Japanese"], ["werner", "Werner 1821"], ["ridgway", "Ridgway 1912"], ["ral", "RAL"], ["xkcd", "xkcd survey"], ["css", "Web colors"], ["wiki", "Common names"]];
const CS_FULL = { base: "all", n: 0, hue: [0, 360], L: [0, 100], C: [0, CS_CMAX], sources: [] };

// Color family by perceptual hue (same rule as family() in gym.js)
function setFamily(h) {
  const [L, C, H] = lch(h);
  if (C < 12) return "Greys";
  if (H >= 345 || H < 40) return L > 70 ? "Pinks" : "Reds";
  if (H < 70) return L < 48 ? "Browns" : "Oranges";
  if (H < 100) return L < 55 ? "Browns" : "Yellows";
  if (H < 195) return "Greens";
  if (H < 290) return "Blues";
  return L > 72 ? "Pinks" : "Purples";
}

// ---------- every color, with an evenly spread order ----------
let CS_ALL = null;
function csItems() {
  const k = LONG_NAMES ? LONG_NAMES.length : 0;
  if (CS_ALL && CS_ALL.k === k) return CS_ALL.items;
  const by = new Map((LONG_NAMES || []).map(x => [x.n.toLowerCase(), x]));
  const mk = (n, h, c, lib) => { const [L, C, H] = lch(h); return { n, h, c, lib, L, C, H, src: lib ? lib.src : ["app"] }; };
  const items = EVERY().map(c => mk(c.n, c.h, c, by.get(c.n.toLowerCase()) || null))
    .concat((LONG_NAMES || []).filter(x => !BYNAME.has(x.n.toLowerCase())).map(x => mk(x.n, x.h, null, x)));
  csRank(items);
  CS_ALL = { k, items };
  return items;
}
// greedy max-min (farthest point) order in CIELAB: the 101 first, then the library, each pick the color farthest
// from everything picked so far
function csRank(items) {
  const N = items.length, P = new Float64Array(N * 3), d = new Float64Array(N).fill(Infinity), done = new Uint8Array(N);
  items.forEach((it, i) => { const [L, a, b] = lab(it.h); P[i * 3] = L; P[i * 3 + 1] = a; P[i * 3 + 2] = b; });
  let r = 0;
  const take = i => {
    done[i] = 1; items[i].rank = r++;
    const L = P[i * 3], a = P[i * 3 + 1], b = P[i * 3 + 2];
    for (let j = 0; j < N; j++) if (!done[j]) { const e = (P[j * 3] - L) ** 2 + (P[j * 3 + 1] - a) ** 2 + (P[j * 3 + 2] - b) ** 2; if (e < d[j]) d[j] = e; }
  };
  const next = app => { let bi = -1, bd = -1; for (let j = 0; j < N; j++) if (!done[j] && (!app || items[j].c) && d[j] > bd) { bd = d[j]; bi = j; } return bi; };
  if (!N) return;
  take(Math.max(0, items.findIndex(it => it.c)));
  for (let j; (j = next(true)) >= 0;) take(j);
  for (let j; (j = next(false)) >= 0;) take(j);
}
const CS_INFO = new WeakMap();
function csInfo(it) {
  if (it.L !== undefined && it.src) return it;
  let x = CS_INFO.get(it); if (x) return x;
  const [L, C, H] = lch(it.h), lib = it.lib || (it.src ? it : null);
  x = { n: it.n, h: it.h, L, C, H, src: (lib && lib.src) || (it.c ? ["app"] : []), lib, rank: Infinity };
  CS_INFO.set(it, x);
  return x;
}

// ---------- the filter ----------
const hueIn = (H, [a, b]) => a <= b ? H >= a && H <= b : H >= a || H <= b;
const hueFull = h => !h || h[1] - h[0] >= 360;
function csMatch(x, q) {
  if (x.n.toLowerCase().includes(q) || x.h.toLowerCase().includes(q.replace(/^#?/, "#"))) return true;
  const lib = x.lib;
  if (!lib) return false;
  if ((lib.jp && (lib.jp.kanji + " " + lib.jp.meaning).toLowerCase().includes(q)) || srcLine(lib).toLowerCase().includes(q)) return true;
  // alternate names (e.g. ISCC-NBS 1955 synonyms attached to the nearest library color, js/library.py
  // merge_iscc_nbs()): searchable by any of them, same as the primary name
  return !!(lib.altn && lib.altn.some(a => a.n.toLowerCase().includes(q)));
}
function filterColors(items, f = {}) {
  const hue = hueFull(f.hue) ? null : f.hue, [l0, l1] = f.L || [0, 100], [c0, c1x] = f.C || [0, CS_CMAX], c1 = c1x >= CS_CMAX ? Infinity : c1x;
  const src = f.sources && f.sources.length ? f.sources : null, q = f.q ? String(f.q).trim().toLowerCase() : "";
  let out = items.filter(it => {
    const x = csInfo(it);
    return x.L >= l0 && x.L <= l1 && x.C >= c0 && x.C <= c1 && (!hue || (x.C >= 6 && hueIn(x.H, hue)))
      && (!src || src.some(s => x.src.includes(s))) && (!q || csMatch(x, q));
  });
  if (f.n && f.n < out.length) out = out.slice().sort((a, b) => csInfo(a).rank - csInfo(b).rank).slice(0, f.n);
  return out;
}
const searchColors = (items, q) => filterColors(items, { q });

// ---------- named starting points ----------
// The honeycomb home's progress views (js/home.js): Learned (yours, honestly), Learning (in reviews, not yet
// confirmed) and Not met yet (never scheduled). Each reads live off S.cards, same honesty rule as everywhere else.
const csBase = base => base === "101" ? csItems().filter(x => x.c)
  : base === "yours" ? csItems().filter(x => x.c && x.c.id && S.cards[x.c.id])
  : base === "learned" ? csItems().filter(x => x.c && x.c.id && isMine(S.cards[x.c.id]))
  : base === "learning" ? csItems().filter(x => x.c && x.c.id && S.cards[x.c.id] && !isMine(S.cards[x.c.id]))
  : base === "notmet" ? csItems().filter(x => x.c && !(x.c.id && S.cards[x.c.id]))
  : csItems();
const csNeedsLib = st => st.base === "all" || (st.sources && st.sources.length > 0);
function csApply(st) { return filterColors(csBase(st.base), st); }
const csSet = (id, title, group, o) => ({ id, title, group, state: { ...CS_FULL, ...o }, get() { return csApply(this.state); } });
const COLOR_SETS = [
  csSet("101", "On your path", "Collections", { base: "101" }),
  csSet("all", "Every name", "Collections", {}),
  csSet("spread", "Even 500", "Collections", { n: 500 }),
  csSet("yours", "Yours", "Collections", { base: "yours" }),
  csSet("learned", "Learned", "Progress", { base: "learned" }),
  csSet("learning", "Learning", "Progress", { base: "learning" }),
  csSet("notmet", "Not met yet", "Progress", { base: "notmet" }),
  csSet("pastels", "Pastels", "Character", { L: [78, 100], C: [8, 45] }),
  csSet("vivid", "Vivid", "Character", { C: [60, CS_CMAX] }),
  csSet("muted", "Muted", "Character", { L: [35, 78], C: [8, 28] }),
  csSet("darks", "Darks", "Character", { L: [0, 30] }),
  csSet("earth", "Earth tones", "Character", { hue: [25, 95], L: [20, 68], C: [8, 50] }),
  csSet("neutrals", "Neutrals", "Character", { C: [0, 8] }),
  csSet("reds", "Reds", "Families", { hue: [345, 40], L: [0, 72], C: [12, CS_CMAX] }),
  csSet("pinks", "Pinks", "Families", { hue: [290, 40], L: [70, 100], C: [12, CS_CMAX] }),
  csSet("oranges", "Oranges", "Families", { hue: [40, 70], L: [48, 100], C: [12, CS_CMAX] }),
  csSet("browns", "Browns", "Families", { hue: [40, 100], L: [0, 55], C: [12, CS_CMAX] }),
  csSet("yellows", "Yellows", "Families", { hue: [70, 105], L: [55, 100], C: [12, CS_CMAX] }),
  csSet("greens", "Greens", "Families", { hue: [100, 195], C: [12, CS_CMAX] }),
  csSet("blues", "Blues", "Families", { hue: [195, 290], C: [12, CS_CMAX] }),
  csSet("purples", "Purples", "Families", { hue: [290, 345], L: [0, 72], C: [12, CS_CMAX] }),
  csSet("greys", "Greys", "Families", { C: [0, 12] }),
  ...CS_SRC.map(([k, l]) => csSet("src-" + k, { jp: "Japanese traditional", werner: "Werner, 1821", ridgway: "Ridgway, 1912", ral: "RAL paint", css: "Web colors" }[k] || l, "Sources", { sources: [k] })),
];
const getSet = id => { const s = COLOR_SETS.find(x => x.id === id); return s ? s.get() : []; };

// ---------- view modes ----------
const COLOR_VIEWS = [
  { id: "map", title: "Map", render: (host, items, o) => honeycomb(host, { ...o, items, layout: "map" }) },
  { id: "wheel", title: "Wheel", render: (host, items, o) => honeycomb(host, { ...o, items, layout: "wheel" }) },
];

// ---------- the shell ----------
const CS_HUES = [[0, "rose"], [25, "red"], [50, "orange"], [75, "yellow"], [105, "green"], [150, "teal"], [215, "blue"], [290, "violet"], [315, "magenta"], [345, "rose"]];
const hueName = H => { let n = "rose"; for (const [a, w] of CS_HUES) if (H >= a) n = w; return n; };
const csRingHex = H => lchHex(66, 44, H);

// a horizontal slider with one or two knobs over a gradient track
function csRange(el, o) {
  el.innerHTML = `<i class="cb-track" style="background:${o.grad}"></i><i class="cb-dim cb-dl"></i><i class="cb-dim cb-dr"></i>${o.vals.map((_, i) => `<b class="cb-knob" data-i="${i}"></b>`).join("")}`;
  let vals = o.vals.slice(), drag = -1;
  const knobs = [...el.querySelectorAll(".cb-knob")], dl = el.querySelector(".cb-dl"), dr = el.querySelector(".cb-dr"), track = el.querySelector(".cb-track");
  const pct = v => (v - o.min) / (o.max - o.min) * 100;
  const paint = () => {
    knobs.forEach((k, i) => k.style.left = pct(vals[i]) + "%");
    dl.style.width = vals.length === 2 ? pct(vals[0]) + "%" : "0";
    dr.style.left = pct(vals[vals.length - 1]) + "%";
  };
  const valAt = e => { const r = el.getBoundingClientRect(); return Math.round(o.min + clamp((e.clientX - r.left) / r.width, 0, 1) * (o.max - o.min)); };
  const move = e => {
    const v = valAt(e);
    if (vals.length === 1) vals[0] = v; else if (drag === 0) vals[0] = Math.min(v, vals[1]); else vals[1] = Math.max(v, vals[0]);
    paint(); o.onInput(vals.slice());
  };
  el.addEventListener("pointerdown", e => {
    const v = valAt(e);
    drag = vals.length === 1 ? 0 : vals[0] === vals[1] ? (v < vals[0] ? 0 : 1) : Math.abs(v - vals[0]) <= Math.abs(v - vals[1]) ? 0 : 1;
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
    el.classList.add("on"); move(e);
  });
  el.addEventListener("pointermove", e => { if (drag >= 0) move(e); });
  const end = () => { if (drag < 0) return; drag = -1; el.classList.remove("on"); if (o.onEnd) o.onEnd(); };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  paint();
  return { set(v, grad) { if (drag < 0) { vals = v.slice(); paint(); } if (grad) track.style.background = grad; } };
}

// a ring of hues with two handles: drag a handle, drag the lit arc to turn it, tap a hue to take a slice, tap the middle for all
function csRing(el, o) {
  const stops = Array.from({ length: 13 }, (_, i) => `${csRingHex(i * 30)} ${i * 30}deg`).join(",");
  el.innerHTML = `<i class="cb-ring-c" style="background:conic-gradient(${stops})"></i>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="cb-ring-dim" cx="50" cy="50" r="42"/></svg>
    <b class="cb-th" data-t="0"></b><b class="cb-th" data-t="1"></b>
    <button class="cb-ring-mid" aria-label="All hues"><b></b><span></span></button>`;
  const dim = el.querySelector(".cb-ring-dim"), ths = [...el.querySelectorAll(".cb-th")], mid = el.querySelector(".cb-ring-mid"), LEN = 2 * Math.PI * 42;
  let h = o.value.slice(), drag = null;
  const full = () => hueFull(h), norm = a => ((a % 360) + 360) % 360, ad = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
  const paint = () => {
    const f = full(), a = f ? 0 : h[0], b = f ? 0 : h[1], un = f ? 0 : norm(a - b) / 360 * LEN;
    dim.style.strokeDasharray = `${un} ${LEN}`; dim.style.strokeDashoffset = -(b / 360 * LEN);
    [a, b].forEach((t, i) => { const r = t * Math.PI / 180; Object.assign(ths[i].style, { left: 50 + 42 * Math.sin(r) + "%", top: 50 - 42 * Math.cos(r) + "%", background: csRingHex(t), display: f ? "none" : "" }); });
    mid.querySelector("b").textContent = f ? "All" : hueName(a);
    mid.querySelector("span").textContent = f ? "hues" : "to " + hueName(b);
  };
  const angle = e => { const r = el.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; return { t: Math.round(norm(Math.atan2(x, -y) * 180 / Math.PI)), rr: Math.hypot(x, y) / (r.width / 2) }; };
  const emit = () => { paint(); o.onInput(h.slice()); };
  el.addEventListener("pointerdown", e => {
    if (e.target.closest(".cb-ring-mid")) return;
    const { t, rr } = angle(e); if (rr < .55) return;
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
    if (full()) { h = [norm(t - 30), norm(t + 30)]; drag = { k: "new", t0: t }; return emit(); }
    const d0 = ad(t, h[0]), d1 = ad(t, h[1]);
    if (Math.min(d0, d1) < 28) drag = { k: d0 <= d1 ? 0 : 1 };
    else if (hueIn(t, h)) drag = { k: "turn", t0: t, h0: h.slice() };
    else { drag = { k: d0 <= d1 ? 0 : 1 }; h[drag.k] = t; emit(); }
  });
  el.addEventListener("pointermove", e => {
    if (!drag) return;
    const { t } = angle(e);
    if (drag.k === "turn") { const dd = t - drag.t0; h = [norm(drag.h0[0] + dd), norm(drag.h0[1] + dd)]; }
    else if (drag.k === "new") { if (ad(t, drag.t0) > 8) { h = [drag.t0, t]; drag = { k: 1 }; } else return; }
    else h[drag.k] = t;
    if (h[0] === h[1]) h[1] = norm(h[1] + 1);
    emit();
  });
  const end = () => { if (drag && o.onEnd) o.onEnd(); drag = null; };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  mid.onclick = () => { h = [0, 360]; emit(); if (o.onEnd) o.onEnd(); };
  paint();
  return { set(v) { if (!drag) { h = v.slice(); paint(); } } };
}

// ---------- the choice: which colors, narrowed by at most one family, feel or tradition ----------
// ch = { which: "101" | "all" | "yours" | "spread", n: 50 | 200 | 500 (spread only), narrow: a COLOR_SETS id or null }.
// A tradition only exists in the name library, so it lifts "the 101" or "yours" to every name.
const CX_FAMS = [["reds", "#C23B30"], ["oranges", "#E07B39"], ["browns", "#7A4B2E"], ["yellows", "#E9C33F"], ["greens", "#3F8B4F"], ["blues", "#2F62B0"], ["purples", "#6E46A2"], ["pinks", "#E795B4"], ["greys", "#8C8A84"]];
const CX_FEELS = [["pastels", "Pastel", "Pastels"], ["vivid", "Vivid", "Vivid colors"], ["muted", "Dusty", "Dusty colors"], ["darks", "Dark", "Dark colors"], ["earth", "Earthy", "Earthy colors"], ["neutrals", "Neutral", "Neutrals"]];
const CX_TRADS = [["jp", "Japanese", "Japanese traditional colors"], ["werner", "Werner 1821", "Werner's 1821 colors"], ["ridgway", "Ridgway 1912", "Ridgway's 1912 colors"], ["ral", "RAL paint", "RAL paint colors"], ["xkcd", "xkcd survey", "Colors from the xkcd survey"], ["css", "Web colors", "Web colors"]];
const CX_SPREAD = [50, 200, 500];
const cxIsTrad = id => !!id && id.startsWith("src-");
function cxNorm(ch = {}) {
  const set = ch.narrow && COLOR_SETS.find(s => s.id === ch.narrow && s.group !== "Collections");
  const out = { which: ["101", "all", "yours", "spread"].includes(ch.which) ? ch.which : "101", n: CX_SPREAD.includes(+ch.n) ? +ch.n : 200, narrow: set ? set.id : null };
  if (cxIsTrad(out.narrow) && (out.which === "101" || out.which === "yours")) out.which = "all";
  return out;
}
function cxState(ch) {
  const set = ch.narrow && COLOR_SETS.find(s => s.id === ch.narrow);
  const st = JSON.parse(JSON.stringify(set ? set.state : CS_FULL));
  st.base = ch.which === "spread" ? "all" : ch.which; st.n = ch.which === "spread" ? ch.n : 0;
  return st;
}
const cxNoun = id => { const f = CX_FEELS.find(x => x[0] === id); if (f) return f[2]; const s = COLOR_SETS.find(x => x.id === id); return s ? s.title : ""; };
// one plain sentence naming what you see
// (fine-tuned: named by the hue slice when there is one, so the sentence never claims more than is shown)
function cxTitle(ch, st) {
  const trad = cxIsTrad(ch.narrow) && CX_TRADS.find(x => "src-" + x[0] === ch.narrow);
  if (trad) return trad[2] + (ch.which === "spread" ? ` · an even ${ch.n}` : "");
  if (st) {
    const base = cxState(ch), hue = !hueFull(st.hue) && (hueFull(base.hue) || st.hue[0] !== base.hue[0] || st.hue[1] !== base.hue[1]);
    const h = hue ? hueName(st.hue[0]) + " to " + hueName(st.hue[1]) : ch.narrow ? cxNoun(ch.narrow) : "Colors";
    return h.charAt(0).toUpperCase() + h.slice(1) + { "101": " you're learning", all: " · from every name", yours: " you know", spread: " · from an even spread" }[ch.which];
  }
  if (!ch.narrow) {
    const known = csBase("yours").length;
    return { "101": "The colors your lessons teach", all: LONG_NAMES ? `All ${csItems().length.toLocaleString()} names` : "Every name",
      yours: `The ${known} color${known === 1 ? "" : "s"} you know`, spread: `An even spread of ${ch.n}` }[ch.which];
  }
  return cxNoun(ch.narrow) + { "101": " you're learning", all: " · from every name", yours: " you know", spread: ` · an even ${ch.n}` }[ch.which];
}
// what was last chosen (S.cb), reading older saves ({ preset, state }) too
function cxSaved() {
  const s = S.cb || {};
  if (s.ch) return { ch: cxNorm(s.ch), tuned: !!(s.tuned && s.state), state: s.state };
  const set = s.preset && COLOR_SETS.find(x => x.id === s.preset);
  if (s.preset === "custom" && s.state) return { ch: cxNorm({ which: ["101", "yours"].includes(s.state.base) ? s.state.base : "all" }), tuned: true, state: s.state };
  if (!set) return { ch: cxNorm(), tuned: false };
  if (set.group === "Collections") return { ch: cxNorm(set.id === "spread" ? { which: "spread", n: 500 } : { which: set.id }), tuned: false };
  return { ch: cxNorm({ which: "all", narrow: set.id }), tuned: false };
}
const cxStateOf = m => m.tuned ? { ...CS_FULL, ...JSON.parse(JSON.stringify(m.state)) } : cxState(m.ch);
// the colors for a filter state: everything that matches (pre) and what's shown (the first n, evenly spread)
async function cxCompute(st) {
  if (csNeedsLib(st) && !LONG_NAMES) await loadLongNames();
  const pre = filterColors(csBase(st.base), { ...st, n: 0 });
  return { pre, items: st.n && st.n < pre.length ? filterColors(pre, { n: st.n }) : pre };
}
const CX_ICON = {
  map: sv('<circle cx="12" cy="12" r="2.3"/><circle cx="18" cy="12" r="2.3"/><circle cx="6" cy="12" r="2.3"/><circle cx="9" cy="6.8" r="2.3"/><circle cx="15" cy="6.8" r="2.3"/><circle cx="9" cy="17.2" r="2.3"/><circle cx="15" cy="17.2" r="2.3"/>', 20, 1.5),
  wheel: sv('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>', 20, 1.5),
  tune: sv('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>', 20, 1.6),
  down: sv('<path d="M6 9l6 6 6-6"/>', 14, 2.2),
};
const cxDots = list => `<span class="cx-dots">${list.map(x => `<i style="--c:${x.h}"></i>`).join("")}</span>`;

// ---------- the explorer: the honeycomb full screen, the title is the control ----------
// colorExplorer({ focus, pick, back, shot }): back() defaults to the Explore tab; pick(appColor) opens one of the 101.
// Opening one of the 101 leaves a note (CX_BACK) so Back from its page lands here again (see colorBrowser).
let CX_BACK = null;
function colorExplorer(opts = {}) {
  const m = cxSaved(), saved = S.cb || {}, zooms = { ...(saved.zoom || {}) };
  let ch = m.ch, tuned = m.tuned, st = cxStateOf(m);
  let viewId = COLOR_VIEWS.some(v => v.id === saved.view) ? saved.view : COLOR_VIEWS[0].id;
  let ctrl = null, cur = null, items = [], maxN = 0, frame = 0, saveT = 0, gen = 0, tune = null;
  CX_BACK = null;
  if (typeof XSTACK !== "undefined") XSTACK = [];
  const el = show(`
    <div class="cx-stage"><div class="cx-view"></div>
      <div class="cx-empty" hidden><p></p><button class="cx-pill" data-reset>Show your lesson colors again</button></div></div>
    <header class="cx-top">
      <button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <button class="cx-title glass-box" aria-haspopup="dialog" aria-label="Change which colors you see"><b><span></span>${CX_ICON.down}</b><small></small></button>
      <span class="cx-sp"></span>
    </header>
    <div class="cx-bar"><div class="cx-btns">
      <button data-tune>${CX_ICON.tune}<span>Fine-tune</span></button>
      <button data-view></button>
    </div></div>`, "fixed cx");
  const $ = s => el.querySelector(s), viewEl = $(".cx-view"), emptyEl = $(".cx-empty"), title = $(".cx-title");
  loadLongNames();

  const persist = (now) => {
    clearTimeout(saveT); saveT = 0;
    const w = () => { saveT = 0; S.cb = { ch, tuned, state: st, view: viewId, zoom: zooms, preset: tuned ? "custom" : ch.narrow || (ch.which === "spread" ? "spread" : ch.which) }; save(); };
    if (now) w(); else saveT = setTimeout(w, 300);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(true); }); };
  const openApp = c => { CX_BACK = { t: Date.now(), opts: { pick: opts.pick, back: opts.back } }; (opts.pick || (x => closeup(colorNode(x))))(c); };
  const pick = (it, fx) => {
    if (it.c) { if (fx && fx.morph) fx.morph(); return openApp(it.c); }
    colorSheet(it, openApp);
  };
  function paintTitle(loading) {
    title.querySelector("span").textContent = cxTitle(ch, tuned && st);
    title.querySelector("small").textContent = loading ? "Loading 2,700 names…" : `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"} · ${tuned ? "fine-tuned" : "tap to change"}`;
    const other = COLOR_VIEWS.find(v => v.id !== viewId) || COLOR_VIEWS[0];
    $("[data-view]").innerHTML = `${CX_ICON[other.id] || ""}<span>${esc(other.title)}</span>`;
    $("[data-view]").setAttribute("aria-label", "Show as a " + other.title.toLowerCase());
    el.classList.toggle("tuned", tuned);
  }
  async function render(soft) {
    const g = ++gen;
    if (csNeedsLib(st) && !LONG_NAMES) { paintTitle(true); await loadLongNames(); if (!el.isConnected || g !== gen) return; }
    const r = await cxCompute(st); if (!el.isConnected || g !== gen) return;
    maxN = r.pre.length; items = r.items;
    paintTitle(); if (tune) tune.paint();
    emptyEl.hidden = !!items.length; el.classList.toggle("none", !items.length);
    if (!items.length) {
      emptyEl.querySelector("p").textContent = st.base === "yours" && !tuned ? "Colors you know gather here. Learn a unit and come back after a night's sleep." : "No colors match. Widen a range or start again.";
      return;
    }
    const view = COLOR_VIEWS.find(v => v.id === viewId) || COLOR_VIEWS[0];
    if (ctrl && cur === view) return ctrl.update({ items, soft });
    const focus = (ctrl && ctrl.current()) || opts.focus;
    if (ctrl) ctrl.destroy();
    viewEl.innerHTML = ""; viewEl.className = "cx-view";
    ctrl = view.render(viewEl, items, { focus, pick, zoom: zooms[view.id] || 1, onZoom: z => { zooms[view.id] = Math.round(z * 100) / 100; persist(); } });
    cur = view;
    if (opts.shot && !shotDone) shoot();
  }
  function apply(nx) {
    ch = cxNorm(nx); tuned = false; st = cxState(ch);
    persist(); buzz(4); render(true);
  }

  // ---- the title sheet: one sheet, four plain questions ----
  async function chooser() {
    buzz(4);
    if (!LONG_NAMES) { title.classList.add("busy"); await loadLongNames(); title.classList.remove("busy"); if (!el.isConnected || document.querySelector(".sheet")) return; }
    const cnt = c => { const s = cxState(cxNorm(c)); return filterColors(csBase(s.base), s).length; };
    const pal = (c, k = 4) => { const s = cxState(cxNorm(c)); return filterColors(csBase(s.base), { ...s, n: k }); };
    const lib = csItems().filter(x => !x.c).slice().sort((a, b) => a.rank - b.rank).slice(0, 5);
    const known = csBase("yours").length, onW = w => !tuned && ch.which === w, onN = id => !tuned && ch.narrow === id;
    const row = (w, label, sub, dots, count) => `<button class="cx-opt${onW(w) ? " on" : ""}" data-which="${w}">${cxDots(dots)}<span class="cx-opt-t"><b>${label}</b><small>${sub}</small></span><em>${count}</em></button>`;
    const n0 = (k, x) => k ? "" : " off";
    const { sh, close } = sheet(`<div class="cx-sh">
      <div class="cx-sh-head"><h3>What to show</h3><button class="cx-link" data-reset>Reset</button></div>
      <div class="cx-sec"><b>Which colors</b></div>
      ${row("101", "On your path", "The words your path teaches now", pal({ which: "101" }, 5), 101)}
      ${LONG_NAMES ? row("all", "Every name", "The whole name library", lib, csItems().length.toLocaleString()) : ""}
      ${known ? row("yours", "The ones you know", "Every name you have learned, checked or not yet", pal({ which: "yours" }, 5), known) : ""}
      ${LONG_NAMES ? `<div class="cx-opt cx-spread${ch.which === "spread" && !tuned ? " on" : ""}"><span class="cx-opt-t"><b>An even spread</b><small>The widest range in fewer colors</small></span>
        <span class="cx-ns">${CX_SPREAD.map(n => `<button data-which="spread" data-n="${n}" class="${ch.which === "spread" && ch.n === n && !tuned ? "on" : ""}">${n}</button>`).join("")}</span></div>` : ""}
      <div class="cx-sec"><b>One family</b><span>within the colors above</span></div>
      <div class="cx-fams">${CX_FAMS.map(([id, hex]) => { const k = cnt({ ...ch, narrow: id }); return `<button class="cx-fam${onN(id) ? " on" : ""}${n0(k)}" data-narrow="${id}" style="--c:${hex}"><i></i><b>${esc(cxNoun(id))}</b><small>${k.toLocaleString()}</small></button>`; }).join("")}</div>
      <div class="cx-sec"><b>A feel</b><span>within the colors above</span></div>
      <div class="cx-chips">${CX_FEELS.map(([id, label]) => { const k = cnt({ ...ch, narrow: id }); return `<button class="cx-chip${onN(id) ? " on" : ""}${n0(k)}" data-narrow="${id}">${cxDots(pal({ ...ch, narrow: id }))}<b>${label}</b><small>${k.toLocaleString()}</small></button>`; }).join("")}</div>
      ${LONG_NAMES ? `<div class="cx-sec"><b>From a tradition</b><span>named lists from the library</span></div>
      <div class="cx-chips">${CX_TRADS.map(([k, label]) => { const id = "src-" + k, c = cnt({ which: "all", narrow: id }); return `<button class="cx-chip${onN(id) ? " on" : ""}${n0(c)}" data-narrow="${id}">${cxDots(pal({ which: "all", narrow: id }))}<b>${label}</b><small>${c.toLocaleString()}</small></button>`; }).join("")}</div>` : ""}
    </div>`);
    sh.classList.add("cx-sheet");
    sh.querySelectorAll("[data-which]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      const w = b.dataset.which, nx = { ...ch, which: w, n: +b.dataset.n || ch.n };
      if ((w === "101" || w === "yours") && cxIsTrad(ch.narrow)) nx.narrow = null;
      close(); apply(nx);
    });
    sh.querySelectorAll("[data-narrow]").forEach(b => b.onclick = () => { const id = b.dataset.narrow; close(); apply({ ...ch, narrow: ch.narrow === id && !tuned ? null : id }); });
    sh.querySelector("[data-reset]").onclick = () => { close(); apply({ which: "101" }); };
    return { sh, close };
  }

  // ---- the fine-tune sheet: short, so the view stays live above it ----
  function fineTune() {
    if (tune) return;
    buzz(4);
    const { sh, close } = sheet(`<div class="cx-sh cx-tune">
      <div class="cx-sh-head"><h3>Fine-tune</h3><span><button class="cx-link" data-undo>Reset</button><button class="cx-pill" data-done>Done</button></span></div>
      <div class="cx-hue"><div class="cb-ring"></div><p><b>Hue</b>Drag the two handles to keep a slice of the wheel. Tap the middle for every hue.</p></div>
      <div class="cx-f"><span><b>How many</b><i>fewer, still spread evenly</i><em data-o="n"></em></span><div class="cb-range" data-k="n"></div></div>
      <div class="cx-f"><span><b>Lightness</b><i>from dark to light</i><em data-o="L"></em></span><div class="cb-range" data-k="L"></div></div>
      <div class="cx-f"><span><b>Strength</b><i>from grey to vivid</i><em data-o="C"></em></span><div class="cb-range" data-k="C"></div></div>
    </div>`);
    sh.classList.add("cx-sheet", "cx-tune-sheet");
    const scrim = [...document.querySelectorAll(".scrim")].pop(); if (scrim) scrim.classList.add("cx-clear");
    const q = s => sh.querySelector(s);
    const changed = () => { tuned = true; persist(); schedule(); };
    // the count slider runs on a log scale: 10, 20, 50... up to everything that matches
    const nLo = () => Math.min(10, maxN), toN = p => p >= 1000 ? 0 : Math.round(nLo() * Math.pow(Math.max(1, maxN) / Math.max(1, nLo()), p / 1000));
    const toP = n => !n || n >= maxN || maxN <= nLo() ? 1000 : Math.round(1000 * Math.log(n / nLo()) / Math.log(maxN / nLo()));
    const midHue = () => hueFull(st.hue) ? 30 : (st.hue[0] + ((st.hue[1] - st.hue[0] + 360) % 360) / 2) % 360;
    const grads = {
      n: "linear-gradient(90deg,rgba(236,232,223,.16),rgba(236,232,223,.6))",
      L: () => `linear-gradient(90deg,${[0, 25, 50, 75, 100].map(L => lchHex(L, Math.min(18, L * .3), midHue())).join(",")})`,
      C: () => `linear-gradient(90deg,${[0, 30, 60, 90, 120].map(C => lchHex(58, C, midHue())).join(",")})`,
    };
    const sl = {
      n: csRange(q('[data-k="n"]'), { min: 0, max: 1000, vals: [toP(st.n)], grad: grads.n, onInput: ([p]) => { st.n = toN(p); changed(); }, onEnd: persist }),
      L: csRange(q('[data-k="L"]'), { min: 0, max: 100, vals: st.L, grad: grads.L(), onInput: v => { st.L = v; changed(); }, onEnd: persist }),
      C: csRange(q('[data-k="C"]'), { min: 0, max: CS_CMAX, vals: st.C, grad: grads.C(), onInput: v => { st.C = v; changed(); }, onEnd: persist }),
    };
    const ring = csRing(q(".cb-ring"), { value: st.hue, onInput: v => { st.hue = v; changed(); }, onEnd: persist });
    // a drag on a control is not a drag on the sheet
    sh.querySelectorAll(".cb-range,.cb-ring").forEach(x => x.addEventListener("pointerdown", e => e.stopPropagation()));
    const paint = () => {
      sl.n.set([toP(st.n)], grads.n); sl.L.set(st.L, grads.L()); sl.C.set(st.C, grads.C()); ring.set(st.hue);
      q('[data-o="n"]').textContent = items.length.toLocaleString() + (items.length < maxN ? " of " + maxN.toLocaleString() : "");
      q('[data-o="L"]').textContent = `${st.L[0]}–${st.L[1]}`;
      q('[data-o="C"]').textContent = `${st.C[0]}–${st.C[1] >= CS_CMAX ? "max" : st.C[1]}`;
      q("[data-undo]").disabled = !tuned;
    };
    const done = () => {
      if (!tune) return;
      tune = null; mo.disconnect(); el.classList.remove("tuning"); persist(true);
    };
    const mo = new MutationObserver(() => { if (!sh.isConnected) done(); });
    mo.observe(document.body, { childList: true });
    if (scrim) scrim.addEventListener("pointerdown", done);
    q("[data-done]").onclick = () => { done(); close(); };
    q("[data-undo]").onclick = () => { tuned = false; st = cxState(ch); persist(); buzz(4); render(true); };
    tune = { paint, close: () => { done(); close(); } };
    paint();
    // lift the view so its middle sits in the space above the sheet
    el.style.setProperty("--tune-h", sh.offsetHeight + "px"); el.classList.add("tuning");
  }

  // ---- wiring ----
  const back = () => { CX_BACK = null; if (tune) tune.close(); persist(true); (opts.back || xToOrigin)(); };
  $("[data-back]").onclick = back;
  title.onclick = () => chooser();
  $("[data-tune]").onclick = () => fineTune();
  $("[data-view]").onclick = () => { viewId = (COLOR_VIEWS.find(v => v.id !== viewId) || COLOR_VIEWS[0]).id; persist(); buzz(4); render(false); };
  $(".cx-empty [data-reset]").onclick = () => apply({ which: "101" });
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) back(); };
  cleanup.push(() => { cancelAnimationFrame(frame); if (saveT) persist(true); if (ctrl) ctrl.destroy(); });
  // screenshot hook (js/boot.js #shot=cx:<choice>:<act>): sheet | tune | tap | press | zoomin
  let shotDone = !opts.shot;
  const shoot = () => {
    shotDone = true;
    if (opts.shot === "sheet") return chooser();
    if (opts.shot === "tune") return fineTune();
    viewEl.dispatchEvent(new CustomEvent("honeyshot", { detail: opts.shot }));
  };
  render(false);
  return { items: () => items };
}

// ---------- the Colors lens card: a live, quiet preview of the explorer ----------
// colorBrowser(host, { focus, pick }) fills host with the card; a tap opens colorExplorer. Kept under this name for
// older callers. The preview never takes a touch (its canvas ignores pointers), so the page scrolls over it.
function colorBrowser(host, opts = {}) {
  // back from a color opened in the explorer: go straight back into the explorer
  if (CX_BACK && Date.now() - CX_BACK.t < 15 * 60e3) {
    const o = CX_BACK.opts; CX_BACK = null; app.innerHTML = "";
    return colorExplorer({ ...o, pick: o.pick || opts.pick });
  }
  CX_BACK = null;
  const m = cxSaved(), st = cxStateOf(m), view = S.cb && S.cb.view === "wheel" ? "wheel" : "map";
  host.classList.add("cx-prev");
  host.innerHTML = `<button class="cx-card" aria-label="Open the color explorer"><span class="cx-card-view"></span>
    <span class="cx-card-txt"><span class="eyebrow">${esc(cxTitle(m.ch, m.tuned && st))}${m.tuned ? " · fine-tuned" : ""}</span><b>Every color</b><span class="cx-open">Open the explorer ${ICON.arrow}</span></span></button>`;
  const viewEl = host.querySelector(".cx-card-view");
  let ctrl = null, items = [];
  host.querySelector(".cx-card").onclick = () => { buzz(4); colorExplorer({ focus: (ctrl && ctrl.current()) || opts.focus, pick: opts.pick }); };
  cxCompute(st).then(r => {
    if (!host.isConnected) return;
    items = r.items.length ? r.items : csBase("101");
    ctrl = honeycomb(viewEl, { items, layout: view, focus: opts.focus, zoom: .8 });
    if (opts.shot) viewEl.dispatchEvent(new CustomEvent("honeyshot", { detail: opts.shot }));
  });
  return { items: () => items };
}

// alternate names attached to a library entry (js/library.py merge_iscc_nbs(), e.g. ISCC-NBS 1955 synonyms
// that share this entry's color but aren't close enough to its own name to merge): "Also called X, Y (source)."
// Reached either by opening the entry directly or by searching one of the alternates themselves (csMatch above).
function altnLine(lib) {
  if (!lib || !lib.altn || !lib.altn.length) return "";
  const bySrc = new Map();
  lib.altn.forEach(a => { const k = a.src || ""; (bySrc.get(k) || bySrc.set(k, []).get(k)).push(a.n); });
  return [...bySrc].map(([src, names]) => `Also called ${names.map(esc).join(", ")} (${esc(SRC_LABEL[src] || src)}).`).join(" ");
}

// a library color (not one of the 101): big swatch, provenance, hex to copy, and the nearest color you can learn
function colorSheet(it, open) {
  const lib = it.lib || (it.src && it.src.length && it.n ? it : null), near = nameColor(it.h, 1).mine[0], app = near && BYNAME.get(near.n.toLowerCase());
  const also = altnLine(lib);
  const { sh, close } = sheet(`<div class="hc-sw" style="--c:${it.h}"></div>
    <div class="eyebrow">${esc((lib && srcLine(lib)) || "Name library")}</div>
    <h3>${esc(it.n)}</h3>
    ${lib && lib.note ? `<p class="hc-note">${esc(lib.note)}</p>` : ""}
    ${also ? `<p class="hc-note hc-also">${also}</p>` : ""}
    <button class="hc-hex" data-copy><span>${it.h}</span><small>Copy</small></button>
    ${app ? `<div class="eyebrow hc-near-h">Nearest names to learn</div>
    <button class="kin" data-near><i style="--c:${app.h}"></i><b>${esc(app.n)}</b><span>${closeness(near.d)} · ${pctDiff(near.d)}</span></button>` : ""}
    <div class="fine">Hex values are screen approximations.</div>`);
  sh.querySelector("[data-copy]").onclick = () => { try { navigator.clipboard.writeText(it.h); toast("Copied " + it.h); } catch (e) {} };
  const nb = sh.querySelector("[data-near]"); if (nb) nb.onclick = () => { close(); open(app); };
}
