"use strict";
// Which colors, separate from how you see them.
//  - csItems(): every color the app can show: the 101 to learn ({ n, h, c: the app color, lib }) and the name library
//    ({ n, h, lib }), each with L, C, H (LCh), src and rank. rank is a farthest-point order in CIELAB, the 101 first,
//    so the first N of ANY filtered list are evenly spread: a count slider is just "take the first N".
//  - filterColors(items, { n, hue: [a, b], L: [a, b], C: [a, b], sources, q }): the live filter. Pure; reusable.
//    hue wraps (a > b means through red, e.g. [330, 40]); [0, 360] means every hue (greys only count then).
//  - COLOR_SETS: named starting points (presets) for that filter, grouped. getSet(id) -> items.
//  - COLOR_VIEWS: view modes { id, title, render(host, items, opts) -> { update, current, destroy } }. Add more here.
//  - colorBrowser(host, { focus, pick }): the shell: the view big, a one-line summary, and an Adjust panel
//    (presets, sources, hue ring, how many, lightness, strength). pick(appColor) opens one of the 101.

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
  return !!lib && ((lib.jp && (lib.jp.kanji + " " + lib.jp.meaning).toLowerCase().includes(q)) || srcLine(lib).toLowerCase().includes(q));
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
const csBase = base => base === "101" ? csItems().filter(x => x.c) : base === "yours" ? csItems().filter(x => x.c && x.c.id && S.cards[x.c.id]) : csItems();
const csNeedsLib = st => st.base === "all" || (st.sources && st.sources.length > 0);
function csApply(st) { return filterColors(csBase(st.base), st); }
const csSet = (id, title, group, o) => ({ id, title, group, state: { ...CS_FULL, ...o }, get() { return csApply(this.state); } });
const COLOR_SETS = [
  csSet("101", "The 101", "Collections", { base: "101" }),
  csSet("all", "Every name", "Collections", {}),
  csSet("spread", "Even 500", "Collections", { n: 500 }),
  csSet("yours", "Yours", "Collections", { base: "yours" }),
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

function colorBrowser(host, opts = {}) {
  const saved = S.cb || {}, setById = id => COLOR_SETS.find(s => s.id === id);
  let preset = saved.preset && (saved.preset === "custom" || setById(saved.preset)) ? saved.preset : "101";
  let st = { ...CS_FULL, ...(saved.state || setById(preset === "custom" ? "101" : preset).state) };
  let viewId = COLOR_VIEWS.some(v => v.id === saved.view) ? saved.view : COLOR_VIEWS[0].id;
  const zooms = { ...(saved.zoom || {}) };
  let ctrl = null, cur = null, items = [], maxN = 0, frame = 0, saveT = 0, gen = 0;
  const chip = s => `<button class="cb-chip" data-set="${s.id}">${esc(s.title)}</button>`;
  host.classList.add("cb");
  host.innerHTML = `<div class="cb-top">
      <button class="cb-sum" aria-label="Adjust which colors"><b></b><span></span></button>
      <div class="hc-seg cb-views" role="group" aria-label="View">${COLOR_VIEWS.map(v => `<button data-v="${v.id}">${esc(v.title)}</button>`).join("")}</div>
      <button class="cb-adj" aria-expanded="false">Adjust</button>
    </div>
    <div class="cb-stage"><div class="cb-view"></div><p class="cb-empty" hidden></p></div>
    <div class="cb-panel" aria-hidden="true"><div class="cb-panel-in">
      <div class="cb-row">${COLOR_SETS.filter(s => s.group !== "Sources").map(chip).join("")}</div>
      <div class="cb-row"><button class="cb-chip" data-src="">Any source</button>${CS_SRC.map(([k, l]) => `<button class="cb-chip" data-src="${k}">${esc(l)}</button>`).join("")}</div>
      <div class="cb-ctl">
        <div class="cb-ring"></div>
        <div class="cb-sl">
          <div class="cb-f"><span>How many<b data-o="n"></b></span><div class="cb-range" data-k="n"></div></div>
          <div class="cb-f"><span>Lightness<b data-o="L"></b></span><div class="cb-range" data-k="L"></div></div>
          <div class="cb-f"><span>Strength<b data-o="C"></b></span><div class="cb-range" data-k="C"></div></div>
        </div>
      </div>
    </div></div>`;
  const $ = s => host.querySelector(s), viewEl = $(".cb-view"), emptyEl = $(".cb-empty"), adj = $(".cb-adj"), panel = $(".cb-panel");

  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { S.cb = { preset, state: st, view: viewId, zoom: zooms }; save(); }, 300); };
  const custom = () => { preset = "custom"; persist(); schedule(); };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(true); }); };
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
    n: csRange($('[data-k="n"]'), { min: 0, max: 1000, vals: [1000], grad: grads.n, onInput: ([p]) => { st.n = toN(p); custom(); }, onEnd: persist }),
    L: csRange($('[data-k="L"]'), { min: 0, max: 100, vals: st.L, grad: grads.L(), onInput: v => { st.L = v; custom(); }, onEnd: persist }),
    C: csRange($('[data-k="C"]'), { min: 0, max: CS_CMAX, vals: st.C, grad: grads.C(), onInput: v => { st.C = v; custom(); }, onEnd: persist }),
  };
  const ring = csRing($(".cb-ring"), { value: st.hue, onInput: v => { st.hue = v; custom(); }, onEnd: persist });

  function summary() {
    const s = preset === "custom" ? "Custom" : setById(preset).title;
    const bits = [`${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"}`, hueFull(st.hue) ? "all hues" : `${hueName(st.hue[0])} to ${hueName(st.hue[1])}`];
    if (preset !== "custom") { $(".cb-sum b").textContent = s; $(".cb-sum span").textContent = bits.join(" · "); return; }
    if (st.L[0] > 0 || st.L[1] < 100) bits.push(st.L[0] >= 60 ? "light" : st.L[1] <= 40 ? "dark" : `lightness ${st.L[0]}–${st.L[1]}`);
    if (st.C[0] > 0 || st.C[1] < CS_CMAX) bits.push(st.C[1] <= 15 ? "greyed" : st.C[0] >= 50 ? "vivid" : st.C[1] <= 50 ? "soft" : `strength ${st.C[0]}–${Math.min(st.C[1], CS_CMAX)}`);
    if (st.sources.length) bits.push(st.sources.map(k => (CS_SRC.find(x => x[0] === k) || [k, k])[1]).join(", "));
    $(".cb-sum b").textContent = s; $(".cb-sum span").textContent = bits.join(" · ");
  }
  function paintPanel() {
    host.querySelectorAll("[data-set]").forEach(b => b.classList.toggle("on", b.dataset.set === preset));
    host.querySelectorAll("[data-src]").forEach(b => b.classList.toggle("on", b.dataset.src ? st.sources.includes(b.dataset.src) : !st.sources.length));
    host.querySelectorAll(".cb-views button").forEach(b => { b.classList.toggle("on", b.dataset.v === viewId); b.setAttribute("aria-pressed", b.dataset.v === viewId); });
    sl.n.set([toP(st.n)], grads.n); sl.L.set(st.L, grads.L()); sl.C.set(st.C, grads.C()); ring.set(st.hue);
    $('[data-o="n"]').textContent = items.length.toLocaleString() + (items.length < maxN ? " of " + maxN.toLocaleString() : "");
    $('[data-o="L"]').textContent = `${st.L[0]}–${st.L[1]}`;
    $('[data-o="C"]').textContent = `${st.C[0]}–${st.C[1] >= CS_CMAX ? "max" : st.C[1]}`;
  }
  const dflt = c => closeup(colorNode(c));
  const pick = (it, fx) => {
    if (it.c) { if (fx && fx.morph) fx.morph(); return (opts.pick || dflt)(it.c); }
    colorSheet(it, c => (opts.pick || dflt)(c));
  };
  async function render(soft) {
    const g = ++gen;
    if (csNeedsLib(st) && !LONG_NAMES) {
      $(".cb-sum span").textContent = "Loading 2,700 names…";
      await loadLongNames(); if (!host.isConnected || g !== gen) return;
    }
    const pre = filterColors(csBase(st.base), { ...st, n: 0 });
    maxN = pre.length;
    items = st.n && st.n < pre.length ? filterColors(pre, { n: st.n }) : pre;
    summary(); paintPanel();
    emptyEl.hidden = !!items.length;
    if (!items.length) { emptyEl.textContent = st.base === "yours" ? "Colors you learn gather here. Start a unit and come back." : "No colors match. Widen a range."; return; }
    const view = COLOR_VIEWS.find(v => v.id === viewId) || COLOR_VIEWS[0];
    if (ctrl && cur === view) return ctrl.update({ items, soft });
    const focus = (ctrl && ctrl.current()) || opts.focus;
    if (ctrl) ctrl.destroy();
    viewEl.className = "cb-view"; viewEl.innerHTML = "";
    ctrl = view.render(viewEl, items, { focus, pick, zoom: zooms[view.id], onZoom: z => { zooms[view.id] = Math.round(z * 100) / 100; persist(); } }); cur = view;
    if (!shotDone) shoot();
  }

  const toggle = on => {
    host.classList.toggle("adjusting", on); panel.setAttribute("aria-hidden", !on);
    adj.textContent = on ? "Done" : "Adjust"; adj.setAttribute("aria-expanded", on); buzz(4);
    // keep the whole browser (view and panel) on screen, above the tab bar
    if (on) setTimeout(() => {
      const r = host.getBoundingClientRect(), tab = document.querySelector(".tabbar"), limit = innerHeight - (tab ? tab.offsetHeight : 0) - 6;
      if (r.bottom > limit) scrollBy({ top: r.bottom - limit, behavior: reduceMotion || opts.shot ? "auto" : "smooth" });
    }, opts.shot ? 0 : 60);
  };
  adj.onclick = () => toggle(!host.classList.contains("adjusting"));
  $(".cb-sum").onclick = () => toggle(true);
  host.querySelectorAll("[data-set]").forEach(b => b.onclick = () => {
    const s = setById(b.dataset.set); preset = s.id; st = JSON.parse(JSON.stringify(s.state)); persist(); buzz(4); render(true);
  });
  host.querySelectorAll("[data-src]").forEach(b => b.onclick = () => {
    const k = b.dataset.src;
    st.sources = !k ? [] : st.sources.includes(k) ? st.sources.filter(x => x !== k) : st.sources.concat(k);
    buzz(4); custom();
  });
  host.querySelectorAll(".cb-views button").forEach(b => b.onclick = () => { if (b.dataset.v === viewId) return; viewId = b.dataset.v; persist(); buzz(4); render(false); });
  cleanup.push(() => { cancelAnimationFrame(frame); if (saveT) { clearTimeout(saveT); S.cb = { preset, state: st, view: viewId, zoom: zooms }; save(); } if (ctrl) ctrl.destroy(); });
  // screenshot hook (js/boot.js): opts.shot = "adjust" opens the panel; anything else goes to the view
  let shotDone = !opts.shot;
  const shoot = () => {
    shotDone = true;
    if (opts.shot === "adjust" || opts.shot === "custom") {
      panel.style.transition = "none"; toggle(true);
      if (opts.shot === "custom") { st.hue = [20, 95]; st.n = 120; custom(); }
      return;
    }
    viewEl.dispatchEvent(new CustomEvent("honeyshot", { detail: opts.shot }));
  };
  render(false);
  return { set(id) { const s = setById(id); if (s) { preset = id; st = JSON.parse(JSON.stringify(s.state)); render(true); } }, items: () => items };
}

// a library color (not one of the 101): big swatch, provenance, hex to copy, and the nearest color you can learn
function colorSheet(it, open) {
  const lib = it.lib || (it.src && it.src.length && it.n ? it : null), near = nameColor(it.h, 1).mine[0], app = near && BYNAME.get(near.n.toLowerCase());
  const { sh, close } = sheet(`<div class="hc-sw" style="--c:${it.h}"></div>
    <div class="eyebrow">${esc((lib && srcLine(lib)) || "Name library")}</div>
    <h3>${esc(it.n)}</h3>
    ${lib && lib.note ? `<p class="hc-note">${esc(lib.note)}</p>` : ""}
    <button class="hc-hex" data-copy><span>${it.h}</span><small>Copy</small></button>
    ${app ? `<div class="eyebrow hc-near-h">Nearest of the 101 to learn</div>
    <button class="kin" data-near><i style="--c:${app.h}"></i><b>${esc(app.n)}</b><span>${closeness(near.d)} · ΔE ${near.d.toFixed(1)}</span></button>` : ""}
    <div class="fine">Hex values are screen approximations.</div>`);
  sh.querySelector("[data-copy]").onclick = () => { try { navigator.clipboard.writeText(it.h); toast("Copied " + it.h); } catch (e) {} };
  const nb = sh.querySelector("[data-near]"); if (nb) nb.onclick = () => { close(); open(app); };
}
