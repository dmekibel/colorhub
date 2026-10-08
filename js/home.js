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
const HM_SLIDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>`;
// The nine stages of the path (ROADMAP §14): stage N shows the first N names of the core list (data/core-names.json,
// ordered by `rank` until the stage ordering exists), so you can preview what any stage holds.
const HM_STAGES = [25, 50, 100, 150, 250, 400, 600, 800, 1000];
function hmStageItems(n) {
  return (CORE_NAMES || []).slice().sort((a, b) => a.rank - b.rank).slice(0, n === 100 ? 101 : n)   // stage 3 = the 101 the path teaches today
    .map(e => ({ n: e.n, h: e.h, c: BYNAME.get(e.n.toLowerCase()) || null }))
    ;
}
// Two stops after Stage 9 (NOTES-TRACKER.md item 0): "Every name" (core + library, every primary and library
// name with no repeats) and "Every shade" (+ the computed shades, js/naming.js loadShades()). Browse views, not
// lessons — same honeycomb, no stage ordering. "Every shade" stays out of the chooser while data/shades.json is
// still empty (David, 2026-10-09: paused pending a library import of more real names).
const hmCoreNameSet = () => new Set((CORE_NAMES || []).map(e => e.n.toLowerCase()));
function hmCoreItems() {
  return (CORE_NAMES || []).map(e => ({ n: e.n, h: e.h, c: BYNAME.get(e.n.toLowerCase()) || null, rank: e.rank }));
}
function hmEveryNameItems() {
  const set = hmCoreNameSet();
  // library-only entries (never folded into a core primary): csItems() already shapes these as {n,h,c:null,lib}
  const libOnly = csItems().filter(x => !x.c && !set.has(x.n.toLowerCase()));
  return hmCoreItems().concat(libOnly);
}
function hmShadeItems() {
  return (SHADES || []).map(e => ({ n: e.n, h: e.h, c: null, shade: { base: e.base, mod: e.mod } }));
}
function hmEveryShadeItems() { return hmEveryNameItems().concat(hmShadeItems()); }
// What the honeycomb shows = a SOURCE (a stage, or one collection) x a FILTER (all / learned / learning / new) x a
// LAYOUT (map / wheel). One of each, never two sources at once (David: "All 101" next to stages made no sense).
const HM_FILTERS = [["all", "All"], ["learned", "Learned"], ["learning", "Learning"], ["new", "New"]];
const HM_EVERY = ["every-name", "every-shade"];   // the two stops after Stage 9, not a stage and not a COLOR_SETS id
const hmSet = id => COLOR_SETS.find(s => s.id === id) || null;
// a bubble past the first units has no app color, but can still have a card (js/learnmore.js cardIdFor)
const hmCard = it => { const id = it.c && it.c.id ? it.c.id : typeof cardIdFor === "function" && !it.shade ? cardIdFor(it) : null; return id ? S.cards[id] || null : null; };
const HM_KEEP = { all: () => true, learned: it => isMine(hmCard(it)), learning: it => !!hmCard(it) && !isMine(hmCard(it)), new: it => !hmCard(it) };
function hmView() {   // the saved view, upgrading the old single "set" id
  const h = S.hm, old = h.set;
  if (!h.src) {
    h.src = /^stage:\d+$/.test(old || "") ? old : old && hmSet(old) && !["101", "learned", "learning", "notmet"].includes(old) ? old : "stage:100";
    h.filter = { learned: "learned", learning: "learning", notmet: "new" }[old] || "all";
  }
  if (!/^stage:\d+$/.test(h.src) && !HM_EVERY.includes(h.src) && !hmSet(h.src)) h.src = "stage:100";
  h.filter = HM_KEEP[h.filter] ? h.filter : "all"; h.style = HONEY_STYLES[h.style] ? h.style : "original";
  return h;
}
function hmViewLabel() {
  const v = hmView(), n = /^stage:/.test(v.src) ? +v.src.slice(6) : 0;
  const what = n ? `Stage ${HM_STAGES.indexOf(n) + 1}` : v.src === "every-name" ? "Every name" : v.src === "every-shade" ? "Every shade" : hmSet(v.src).title;
  return v.filter === "all" ? what : `${what} · ${HM_FILTERS.find(x => x[0] === v.filter)[1]}`;
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
const HM_LAB_SIZES = [25, 50, 101, 150, 250, 400, 600, 1000, 2700];
async function labItems(n) {
  if (n <= 1000) { if (!CORE_NAMES) await loadCoreNames(); return hmStageItems(n === 101 ? 100 : n); }
  if (!LONG_NAMES) await loadLongNames();
  return csItems().slice().sort((a, b) => a.rank - b.rank).slice(0, n).map(e => ({ n: e.n, h: e.h, c: e.c || null, lib: e.lib || null }));
}
function labHoney() {
  S.hmLab = S.hmLab || {}; S.hm = S.hm || {};
  let pi = (window.HM_LAB_LAST_P || 0) % HONEY_STYLE_LIST.length, si = HM_LAB_SIZES.indexOf(window.HM_LAB_LAST_N || 101); if (si < 0) si = 2;
  const el = show(`<div class="hm-lab"><div class="hm-lab-view"></div>
    <button class="icon-btn glass hm-lab-back" data-back aria-label="Back">${ICON.back}</button>
    <div class="hm-lab-bar">
      <div class="hm-lab-row"><button class="hm-lab-step" data-p-1>${ICON.chev}</button><b data-p-label></b><button class="hm-lab-step" data-p1>${ICON.chev}</button></div>
      <div class="hm-lab-row"><button class="hm-lab-step" data-n-1>${ICON.chev}</button><b data-n-label></b><button class="hm-lab-step" data-n1>${ICON.chev}</button></div>
      <div class="hm-lab-row hm-lab-rate">
        <button class="hm-lab-heart" data-heart aria-label="Favorite">♥</button>
        <span class="hm-lab-stars" data-stars>${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}">★</button>`).join("")}</span>
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
  // The floor of the app (DESIGN-SYSTEM.md §2), not a tab: its own address, and S.tab is left alone so it keeps
  // pointing at whichever Room was last open (the Rooms corner's quick-resume, and every "go(S.tab)" fallback).
  ROUTE_NEXT = routed(NAV_MAP, "home"); ROUTE_REPLACE = true;

  const el = show(`
    <div class="cx-stage hm-stage"><div class="cx-view"></div></div>
    <header class="cx-top hm-top">
      <button class="cx-title glass-box hm-title" aria-haspopup="dialog" aria-label="Which colors you see"><b><span></span>${CX_ICON.down}</b><small></small></button>
    </header>
    <div class="hm-search" id="hmSearch" hidden>
      <label class="search"><span>${ICON.search}</span><input id="hmq" type="search" placeholder="sea, rust, Monet…" autocomplete="off" enterkeyhint="search"></label>
    </div>
    <button class="corner l" data-rooms-corner aria-label="Rooms">${ROOMS_GLYPH}</button>
    <button class="corner r" id="hmView" aria-label="View">${HM_SLIDERS}</button>
    ${typeof msHomeButton === "function" ? msHomeButton() : ""}
    ${typeof prQuick === "function" ? `<button class="corner r pr-study-corner" data-pr-study aria-label="Study">${PR_ICON.cards}</button>` : ""}
    ${typeof FV_HEART === "string" ? `<button class="corner r fv-corner" id="hmFav" aria-label="Pick favorites">${FV_HEART}</button>` : ""}
  `, "fixed cx hm");
  const $ = s => el.querySelector(s), viewEl = $(".cx-view"), title = $(".hm-title");
  loadLongNames();

  // ---------- the honeycomb itself ----------
  let items = [], ctrl = null, gen = 0;
  const onPeek = o => { if (o.c) peek(o.c); else if (typeof colorSheet === "function") colorSheet(o, c => hmOpenColor(c)); };
  // a tap opens the real page straight away (ROADMAP §13: every name has one now) — one of the 101, or its
  // own name page (js/names.js); a long press still shows the quick peek sheet above. The page itself grows
  // from the tapped bubble (David, 2026-10-07: "any color in home, you should be able to click it to make it
  // full screen"), via growFrom (js/core.js) when it's available; hmOpenColor/hmOpenName return their show()'d
  // root for exactly this. growFrom calls its renderFn synchronously, so an async open (a name not yet in
  // CORE_NAMES) just falls back to the old flying-chip morph — still a clean grow, never a hard cut.
  const pick = (o, fx) => {
    if (typeof hmDismissHint === "function") hmDismissHint();
    const src = fx && fx.srcEl && fx.srcEl();
    const open = () => (o.c ? hmOpenColor(o.c) : hmOpenName(o));
    // one of the 101 resolves synchronously, so growFrom's renderFn returns its root and the grow plays; a
    // library name waits on loadCoreNames() first (hmOpenName), so renderFn returns nothing yet and growFrom
    // quietly skips the animation — the page still opens, just with show()'s plain cross-fade instead.
    if (src && o.c && typeof growFrom === "function") growFrom(src, open);
    else { if (fx && fx.morph) fx.morph(); open(); }
    if (src) src.remove();
  };
  function paintTitle(loading) {
    title.querySelector("span").textContent = hmViewLabel();
    title.querySelector("small").textContent = loading ? "Loading…" : `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"} · swipe or tap`;
  }
  async function render(soft) {
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
    items = items.filter(HM_KEEP[v.filter]);
    paintTitle();
    if (ctrl) ctrl.update({ items, soft });
    else ctrl = honeycomb(viewEl, { items, style: v.style, tweak: hmTweakFor(v.style), zoom: S.hm.zoom || 1, pick, onPeek, centerFirst: true,
      onZoom: z => { S.hm.zoom = Math.round(z * 100) / 100; save(); } });
    window.HM_CTRL = ctrl;   // the map, for js/polish.js flyToMap()
    hmWireChrome();
    if (typeof fvHomeReady === "function") fvHomeReady(el, ctrl);   // js/favs.js: open straight into pick mode when asked
  }
  function applyView(k, val) { S.hm[k] = val; save(); buzz(4); }

  // ---------- title: tap for the full chooser, swipe for the four quick views ----------
  // Two tabs in one sheet (David: "being able to SEE the effect while choosing"): "Show" (what — stage/filter/
  // collection, can be tall and scroll) and "Look" (how it looks — the 5 styles as small chips, plus Fine-tune's
  // 4 sliders, capped compact with no scroll so the honeycomb above it stays visible live). Either way the
  // honeycomb recenters into whatever's left visible above the sheet (ctrl.setInset) and settles back when it closes.
  const HM_FINE_SPECS = [
    { key: "m0", label: "Center size", min: 1.2, max: 6, step: .05 },
    { key: "gap", label: "Gap", min: 0, max: .45, step: .01 },
    { key: "shape", label: "Shape", min: 0, max: 1, step: .02 },
    { key: "alive", label: "Alive", min: 0, max: 2, step: .1 },
  ];
  async function chooser(initialTab) {
    buzz(4);
    if (!LONG_NAMES || !CORE_NAMES || !SHADES) { await Promise.all([loadLongNames(), loadCoreNames(), loadShades()]); if (!el.isConnected || document.querySelector(".sheet")) return; }
    const v = hmView(), dotsFor = s => filterColors(csBase(s.state.base), { ...s.state, n: 5 });
    const everyNameCount = hmEveryNameItems().length, shadeCount = (SHADES || []).length;
    const seg = (key, opts) => `<div class="hm-seg" data-key="${key}">${opts.map(([id, label]) => `<button class="${v[key] === id ? "on" : ""}" data-val="${id}">${esc(label)}</button>`).join("")}</div>`;
    const groups = {};
    COLOR_SETS.forEach(s => { if (["101", "learned", "learning", "notmet"].includes(s.id)) return; (groups[s.group] = groups[s.group] || []).push(s); });
    const collHtml = Object.entries(groups).map(([g, list]) => `
      <div class="cx-sec hm-sub"><b>${esc(g)}</b></div>
      <div class="cx-chips">${list.map(s => `<button class="cx-chip${v.src === s.id ? " on" : ""}" data-src="${s.id}">${cxDots(dotsFor(s))}<b>${esc(s.title)}</b></button>`).join("")}</div>`).join("");
    const cfgNow = ctrl ? ctrl.getCfg() : null, tweakNow = (cfgNow && cfgNow.tweak) || {}, resolvedNow = (cfgNow && cfgNow.resolved) || HONEY_CFG_BASE;
    const twVal = k => tweakNow[k] != null ? tweakNow[k] : resolvedNow[k];
    const { sh, close } = sheet(`<div class="cx-sh hm-chooser">
      <div class="hm-chooser-top"><h3 class="title-2">View</h3><span class="hm-chooser-acts">
        <button class="iconq" data-search aria-label="Search">${ICON.search}</button>
        ${typeof NMR_ICON !== "undefined" ? `<button class="iconq" data-namer aria-label="Name any color">${NMR_ICON}</button>` : ""}
        <button class="iconq" data-surprise aria-label="Surprise me">${ICON.dice}</button>
      </span></div>
      <div class="hm-tabs" data-tabs><button class="on" data-tab="show">Show</button><button data-tab="look">Look</button></div>
      <p class="hm-count" data-count></p>
      <div class="hm-tab-panel" data-panel="show">
        <div class="cx-sh-head"><h3>What to show</h3></div>
        <div class="cx-sec"><b>Stage</b><span>the colors each stage of the path teaches</span></div>
        <div class="cx-chips hm-stages">${HM_STAGES.map((n, i) => `<button class="cx-chip${v.src === "stage:" + n ? " on" : ""}" data-src="stage:${n}"><b>${i + 1}</b><em>${(n === 100 ? 101 : n).toLocaleString()}</em></button>`).join("")}
          <button class="cx-chip${v.src === "every-name" ? " on" : ""}" data-src="every-name"><b>Name</b><em>${everyNameCount.toLocaleString()}</em></button>
          ${shadeCount ? `<button class="cx-chip${v.src === "every-shade" ? " on" : ""}" data-src="every-shade"><b>Shade</b><em>${(everyNameCount + shadeCount).toLocaleString()}</em></button>` : ""}</div>
        <div class="cx-sec"><b>Show</b><span>from your own reviews</span></div>
        ${seg("filter", HM_FILTERS)}
        <div class="cx-sec"><b>Or a collection</b><span>instead of a stage</span></div>
        ${collHtml}
      </div>
      <div class="hm-tab-panel hm-look-panel" data-panel="look" hidden>
        <div class="hm-look-row">${HM_HOME_STYLES.map(id => `<button class="hm-look-chip${v.style === id ? " on" : ""}" data-style="${id}"><i class="hm-look-ic hm-look-${id}"></i><b>${esc((HONEY_STYLES[id] || {}).title || id)}</b></button>`).join("")}</div>
        <div class="hm-look-sliders">${HM_FINE_SPECS.map(s => `<label class="hm-tweak-row" data-key="${s.key}"><span>${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${twVal(s.key)}"><b>${(+twVal(s.key)).toFixed(2)}</b></label>`).join("")}</div>
        <button class="link" data-lab-open>Rate every preset (honeycomb lab) →</button>
      </div>
    </div>`);
    sh.classList.add("cx-sheet", "hm-sheet-panel");
    const applyInset = () => requestAnimationFrame(() => { if (ctrl) { const r = sh.getBoundingClientRect(); ctrl.setInset({ bottom: Math.max(0, innerHeight - r.top) }); } });
    const mo = new MutationObserver(() => { if (!sh.isConnected) { if (ctrl) ctrl.setInset({ bottom: 0 }); mo.disconnect(); } });
    mo.observe(document.body, { childList: true });
    function setTab(tab) {
      sh.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
      sh.querySelectorAll(".hm-tab-panel").forEach(p => p.hidden = p.dataset.panel !== tab);
      sh.classList.toggle("hm-sheet-compact", tab === "look");
      applyInset();
    }
    sh.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));
    setTab(initialTab === "look" ? "look" : "show");
    // every change applies at once and the panel stays open, so you can see what each control does
    sh.querySelectorAll("[data-src]").forEach(b => b.onclick = () => {
      applyView("src", b.dataset.src); sh.querySelectorAll("[data-src]").forEach(x => x.classList.toggle("on", x === b));
      // a new set always starts at All: a leftover Learned/New filter made every set look stuck at a small count
      if (S.hm.filter !== "all") { applyView("filter", "all"); sh.querySelectorAll('.hm-seg[data-key="filter"] button').forEach(x => x.classList.toggle("on", x.dataset.val === "all")); }
      render(true).then(paintCount);
    });
    sh.querySelectorAll(".hm-seg").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
      applyView(g.dataset.key, b.dataset.val); g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); render(true).then(paintCount);
    }));
    paintCount();
    // one plain line under the tabs: how many colors the honeycomb holds right now, and the filter if one is on
    function paintCount() {
      const p = sh.querySelector("[data-count]"); if (!p || !p.isConnected) return;
      const f = hmView().filter, fl = (HM_FILTERS.find(x => x[0] === f) || [])[1];
      p.textContent = `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"} on the honeycomb${f !== "all" ? ` · ${fl} only` : ""}`;
    }
    const syncFineSliders = () => sh.querySelectorAll(".hm-look-sliders .hm-tweak-row").forEach(row => {
      const k = row.dataset.key, input = row.querySelector("input"), out = row.querySelector("b"), c = ctrl ? ctrl.getCfg() : null;
      const val = c ? (c.tweak && c.tweak[k] != null ? c.tweak[k] : c.resolved[k]) : +input.value;
      input.value = val; out.textContent = (+val).toFixed(2);
    });
    sh.querySelectorAll(".hm-look-chip").forEach(b => b.onclick = () => {
      applyView("style", b.dataset.style); sh.querySelectorAll(".hm-look-chip").forEach(x => x.classList.toggle("on", x === b));
      if (ctrl && ctrl.style) { ctrl.style(b.dataset.style, false); const tw2 = hmTweakFor(b.dataset.style); if (tw2 && ctrl.tweak) ctrl.tweak(tw2); }
      syncFineSliders();
    });
    sh.querySelectorAll(".hm-look-sliders .hm-tweak-row").forEach(row => {
      const k = row.dataset.key, input = row.querySelector("input"), out = row.querySelector("b");
      input.addEventListener("input", () => {
        const val = +input.value; out.textContent = val.toFixed(2);
        if (ctrl) { hmSetTweak(ctrl.getStyle(), { [k]: val }); ctrl.tweak({ [k]: val }); }
      });
    });
    sh.querySelector("[data-lab-open]").onclick = () => { close(); labHoney(); };
    sh.querySelector("[data-search]").onclick = () => { close(); openSearch(); };
    const nmBtn = sh.querySelector("[data-namer]"); if (nmBtn) nmBtn.onclick = () => { close(); XSTACK = []; X_ROOT = "home"; LAB.namer(); };   // Name any color (js/namer.js)
    sh.querySelector("[data-surprise]").onclick = () => { close(); hmDice(); };
    applyInset();
  }
  // ---------- search: a tap (from the View panel's header) reveals the field; typing filters the honeycomb ----------
  const searchBox = $("#hmSearch"), searchInput = $("#hmq");
  function openSearch() { searchBox.hidden = false; hmShowChrome(true); searchInput.focus(); }
  searchInput.addEventListener("blur", () => { if (!searchInput.value.trim()) { searchBox.hidden = true; render(true); } });
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    if (!q) return render(true);
    // every core name, every library name (an alternate/library hit opens its color's page, "also called" shown
    // there — js/names.js namePage) and every shade (dormant while data/shades.json is empty)
    Promise.all([loadLongNames(), loadCoreNames(), loadShades()]).then(() => {
      if (!el.isConnected) return;
      const hits = searchColors((SHADES || []).length ? hmEveryShadeItems() : hmEveryNameItems(), q);
      if (ctrl) ctrl.update({ items: hits.length ? hits : items, soft: true });
    });
  });

  // ---------- Surprise me: a random not-yet-met color, from the View panel's header (the camera now lives only
  // in Studio, DESIGN-SYSTEM §12 "Learn") ----------
  function hmDice() {
    if (!ctrl || !items.length) return;
    const unmet = items.filter(it => !(it.c && it.c.id && S.cards[it.c.id]));
    const pool = unmet.length ? unmet : items;
    buzz(6); if (typeof hmDismissHint === "function") hmDismissHint();
    ctrl.update({ items, focus: pool[Math.floor(Math.random() * pool.length)], soft: true });
  }

  // ---------- chrome fade: visible on a tap or a pause, hidden the instant you start dragging ----------
  let chromeT = 0;
  // Shown again as soon as the finger lifts, and it stays: no timer. (A 1.8 s auto-hide left the buttons drawn but
  // untappable, pointer-events off, so "no button in View works" — David.)
  function hmShowChrome() { el.classList.remove("chrome-hide"); clearTimeout(chromeT); }
  function hmWireChrome() {
    const cv = viewEl.querySelector("canvas"); if (!cv || cv.dataset.hmWired) return; cv.dataset.hmWired = "1";
    cv.addEventListener("pointerdown", () => { el.classList.add("chrome-hide"); clearTimeout(chromeT); });
    cv.addEventListener("pointerup", () => { hmShowChrome(); if (typeof hmDismissHint === "function") hmDismissHint(); });
    cv.addEventListener("pointercancel", () => hmShowChrome());
  }
  hmShowChrome();
  { const ms = $("#hmMapStudy"); if (ms) ms.onclick = () => { buzz(6); msOpen({ from: "home" }); }; }   // js/mapstudy.js

  // the Rooms corner (left, shared chrome: js/core.js toggleStem) raises the stem; the View corner (right)
  // opens the chooser — a tap for "Show", a long-press (480ms) jumps straight to "Look"
  { let holdT = 0, longFired = false;
    const viewBtn = $("#hmView");
    viewBtn.addEventListener("pointerdown", () => { longFired = false; clearTimeout(holdT); holdT = setTimeout(() => { longFired = true; buzz(6); chooser("look"); }, 480); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => viewBtn.addEventListener(ev, () => clearTimeout(holdT)));
    viewBtn.onclick = () => { if (longFired) { longFired = false; return; } chooser("show"); };
    const favBtn = $("#hmFav"); if (favBtn) favBtn.onclick = () => { if (typeof hmDismissHint === "function") hmDismissHint(); buzz(6); fvPickStart(el, ctrl); };   // js/favs.js: Pick favorites
  }
  { const study = $("[data-pr-study]"); if (study) study.onclick = () => { const mid = ctrl && ctrl.current(); prQuick({ seed: mid ? { n: mid.n, h: mid.h } : null, items: items.slice(0, 400).map(x => x.h), label: hmViewLabel(), source: mid ? "alike" : "these" }); }; }   // js/practice.js
  // swipe up from the bottom edge of Home opens Learn straight away (DESIGN-SYSTEM §2 "the shortcut"): the
  // honeycomb keeps a short drag (bubbles near the bottom stay tappable), but a real upward swipe wins.
  let edge = null;
  const EDGE = 120;
  viewEl.addEventListener("pointerdown", e => {
    edge = e.isPrimary && e.clientY > innerHeight - EDGE ? { x0: e.clientX, y0: e.clientY, on: false } : null;
  }, true);
  viewEl.addEventListener("pointermove", e => {
    if (!edge) return;
    const dx = e.clientX - edge.x0, dy = e.clientY - edge.y0;
    if (!edge.on) {
      if (dy < -14 && -dy > Math.abs(dx) * 1.5) {
        edge.on = true;
        const cv = viewEl.querySelector("canvas");   // end the honeycomb's own drag cleanly
        const ours = edge; edge = null;   // (so edgeEnd below ignores this synthetic cancel)
        if (cv) cv.dispatchEvent(new PointerEvent("pointercancel", { pointerId: e.pointerId, bubbles: true, clientX: e.clientX, clientY: e.clientY }));
        edge = ours;
      } else { if (Math.hypot(dx, dy) > 14) edge = null; return; }
    }
    e.stopPropagation();
  }, true);
  const edgeEnd = e => {
    if (!edge) return; const was = edge.on; edge = null;
    if (!was) return;
    e.stopPropagation();
    buzz(6);
    hmEdgeOpenLearn();
  };
  viewEl.addEventListener("pointerup", edgeEnd, true); viewEl.addEventListener("pointercancel", edgeEnd, true);
  // the signature motion needs a source shape; a swipe has none, so grow from a thin strip at the very bottom
  // edge — content rising up from where the finger was, same spirit as a bubble growing from where it was tapped
  function hmEdgeOpenLearn() {
    const src = document.createElement("div");
    Object.assign(src.style, { position: "fixed", left: "0", right: "0", bottom: "0", height: "2px" });
    document.body.appendChild(src);
    growFrom(src, () => go("learn"));
    src.remove();
  }

  window.HM_CHOOSER = chooser;   // #shot=home:look hook (tools/shots.sh): drive the Show/Look sheet without a tap
  render(false);
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
  hmHome();
  if (arg === "bar") setTimeout(() => { const s = document.querySelector(".screen.hm"); if (s) s.classList.remove("chrome-hide"); }, 3200);
  if (arg === "rooms") setTimeout(() => hmTap(document.querySelector("[data-rooms-corner]")), 150);
  if (arg === "views") setTimeout(() => hmTap(document.getElementById("hmView")), 150);
  if (arg === "look") setTimeout(() => window.HM_CHOOSER && window.HM_CHOOSER("look"), 150);   // the long-press shortcut, without the long-press
  if (arg === "search") setTimeout(() => { window.HM_CHOOSER && window.HM_CHOOSER("show"); setTimeout(() => hmTap(document.querySelector("[data-search]")), 150); }, 150);
}
