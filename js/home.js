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
const hmCard = it => it.c && it.c.id ? S.cards[it.c.id] : null;
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
function hmOpenTweak(ctrl) {
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
  requestAnimationFrame(() => panel.classList.add("on"));
  const close = () => { panel.classList.remove("on"); setTimeout(() => panel.remove(), reduceMotion ? 0 : 260); };
  panel.querySelector("[data-close]").onclick = close;
  panel.querySelectorAll(".hm-tweak-row").forEach(row => {
    const k = row.dataset.key, input = row.querySelector("input"), out = row.querySelector("b");
    input.addEventListener("input", () => {
      const v = +input.value; out.textContent = v.toFixed(2);
      S.hm.tweak = { ...(S.hm.tweak || {}), [k]: v }; save();
      ctrl.tweak({ [k]: v });
    });
  });
  panel.querySelector(".hm-tweak-lens").querySelectorAll("button").forEach(b => b.onclick = () => {
    panel.querySelectorAll(".hm-tweak-lens button").forEach(x => x.classList.toggle("on", x === b));
    S.hm.tweak = { ...(S.hm.tweak || {}), lensMode: b.dataset.val }; save();
    ctrl.tweak({ lensMode: b.dataset.val });
  });
  panel.querySelector("[data-reset]").onclick = () => {
    S.hm.tweak = null; save(); ctrl.resetTweak(); buzz(4); close();
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
  async function build(soft) {
    loading = true;
    window.HM_LAB_LAST_P = pi; window.HM_LAB_LAST_N = HM_LAB_SIZES[si];
    const items = await labItems(HM_LAB_SIZES[si]);
    if (!el.isConnected) return;
    loading = false;
    const id = HONEY_STYLE_LIST[pi].id;
    if (ctrl) { ctrl.destroy(); viewEl.innerHTML = ""; }
    ctrl = honeycomb(viewEl, { items, style: id, tweak: S.hm.tweak, centerFirst: true });
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
  el.querySelector("[data-tweak]").onclick = () => { if (ctrl) hmOpenTweak(ctrl); };
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
  S.tab = "learn"; ROUTE_REPLACE = true; save();   // the Today tab's own home: replace its history entry, no tab bar

  const el = show(`
    <div class="cx-stage hm-stage"><div class="cx-view"></div></div>
    <header class="cx-top hm-top">
      <button class="cx-title glass-box hm-title" aria-haspopup="dialog" aria-label="Which colors you see"><b><span></span>${CX_ICON.down}</b><small></small></button>
      <button class="icon-btn glass hm-search-btn" data-search aria-label="Search colors">${ICON.search}</button>
    </header>
    <div class="hm-search" id="hmSearch" hidden>
      <label class="search"><span>${ICON.search}</span><input id="hmq" type="search" placeholder="sea, rust, Monet…" autocomplete="off" enterkeyhint="search"></label>
    </div>
    <button class="hm-corner hm-corner-l" id="hmToday" aria-label="Today">${HM_SUN}</button>
    <button class="hm-corner hm-corner-r" id="hmView" aria-label="What to show">${HM_SLIDERS}</button>
    <div class="hm-sheet" id="hmSheet">
      <button class="hm-grab" id="hmGrab" aria-label="Open Today"><i></i></button>
      <div class="hm-sheet-body" id="hmBody"></div>
    </div>
  `, "fixed cx hm");
  const $ = s => el.querySelector(s), viewEl = $(".cx-view"), title = $(".hm-title");
  loadLongNames();

  // ---------- the honeycomb itself ----------
  let items = [], ctrl = null, gen = 0;
  const onPeek = o => { if (o.c) peek(o.c); else if (typeof colorSheet === "function") colorSheet(o, c => hmOpenColor(c)); };
  // a tap opens the real page straight away (ROADMAP §13: every name has one now) — one of the 101, or its
  // own name page (js/names.js); a long press still shows the quick peek sheet above.
  const pick = (o, fx) => { if (fx && fx.morph) fx.morph(); hmDismissHint(); o.c ? hmOpenColor(o.c) : hmOpenName(o); };
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
    else ctrl = honeycomb(viewEl, { items, style: v.style, tweak: S.hm.tweak, zoom: S.hm.zoom || 1, pick, onPeek, centerFirst: true,
      onZoom: z => { S.hm.zoom = Math.round(z * 100) / 100; save(); } });
    hmWireChrome();
  }
  function applyView(k, val) { S.hm[k] = val; save(); buzz(4); bodyBuilt = false; }

  // ---------- title: tap for the full chooser, swipe for the four quick views ----------
  async function chooser() {
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
    const { sh, close } = sheet(`<div class="cx-sh hm-chooser">
      <div class="cx-sh-head"><h3>What to show</h3></div>
      <div class="cx-sec"><b>Stage</b><span>the colors each stage of the path teaches</span></div>
      <div class="cx-chips hm-stages">${HM_STAGES.map((n, i) => `<button class="cx-chip${v.src === "stage:" + n ? " on" : ""}" data-src="stage:${n}"><b>${i + 1}</b><em>${(n === 100 ? 101 : n).toLocaleString()}</em></button>`).join("")}
        <button class="cx-chip${v.src === "every-name" ? " on" : ""}" data-src="every-name"><b>Name</b><em>${everyNameCount.toLocaleString()}</em></button>
        ${shadeCount ? `<button class="cx-chip${v.src === "every-shade" ? " on" : ""}" data-src="every-shade"><b>Shade</b><em>${(everyNameCount + shadeCount).toLocaleString()}</em></button>` : ""}</div>
      <div class="cx-sec"><b>Show</b><span>from your own reviews</span></div>
      ${seg("filter", HM_FILTERS)}
      <div class="cx-sec"><b>Style</b><span>how the honeycomb looks</span></div>
      <div class="cx-chips hm-styles">${HONEY_STYLE_LIST.map(s => `<button class="cx-chip${v.style === s.id ? " on" : ""}" data-style="${s.id}"><b>${esc(s.title)}</b></button>`).join("")}</div>
      <button class="hm-tweak-row" data-tweak-open><span>Tweak…</span>${CX_ICON.down}</button>
      <button class="link" data-lab-open>Rate every preset (honeycomb lab) →</button>
      <div class="cx-sec"><b>Or a collection</b><span>instead of a stage</span></div>
      ${collHtml}
    </div>`);
    sh.classList.add("cx-sheet");
    // every change applies at once and the panel stays open, so you can see what each control does
    sh.querySelectorAll("[data-src]").forEach(b => b.onclick = () => {
      applyView("src", b.dataset.src); sh.querySelectorAll("[data-src]").forEach(x => x.classList.toggle("on", x === b)); render(true);
    });
    sh.querySelectorAll(".hm-seg").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
      applyView(g.dataset.key, b.dataset.val); g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); render(true);
    }));
    sh.querySelectorAll("[data-style]").forEach(b => b.onclick = () => {
      applyView("style", b.dataset.style); sh.querySelectorAll("[data-style]").forEach(x => x.classList.toggle("on", x === b));
      if (ctrl && ctrl.style) ctrl.style(b.dataset.style);
    });
    sh.querySelector("[data-tweak-open]").onclick = () => { if (ctrl) hmOpenTweak(ctrl); };
    sh.querySelector("[data-lab-open]").onclick = () => { close(); labHoney(); };
  }
  // ---------- search: a tap reveals the field; typing filters the honeycomb to matches (searchColors, colorsets.js) ----------
  const searchBox = $("#hmSearch"), searchInput = $("#hmq");
  $("[data-search]").onclick = () => {
    searchBox.hidden = !searchBox.hidden;
    if (!searchBox.hidden) { hmShowChrome(true); searchInput.focus(); } else { searchInput.value = ""; render(true); }
  };
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

  // ---------- the camera (js/camera.js's eye()) and the dice: both live in the sheet, next to "Surprise me" ----------
  function hmCamera() { if (typeof eye === "function") eye(); }
  function hmDice() {
    if (!ctrl || !items.length) return;
    const unmet = items.filter(it => !(it.c && it.c.id && S.cards[it.c.id]));
    const pool = unmet.length ? unmet : items;
    buzz(6); hmDismissHint(); setState("peek");
    ctrl.update({ items, focus: pool[Math.floor(Math.random() * pool.length)], soft: true });
  }

  // ---------- chrome fade: visible on a tap or a pause, hidden the instant you start dragging ----------
  let chromeT = 0;
  function hmShowChrome(hold) { el.classList.remove("chrome-hide"); clearTimeout(chromeT); if (!hold) chromeT = setTimeout(() => el.classList.add("chrome-hide"), 1800); }
  function hmWireChrome() {
    const cv = viewEl.querySelector("canvas"); if (!cv || cv.dataset.hmWired) return; cv.dataset.hmWired = "1";
    cv.addEventListener("pointerdown", () => { el.classList.add("chrome-hide"); clearTimeout(chromeT); });
    cv.addEventListener("pointerup", () => { hmShowChrome(); hmDismissHint(); });
    cv.addEventListener("pointercancel", () => hmShowChrome());
  }
  hmShowChrome();

  // first-launch hint: gone on the first real interaction, never shown again
  function hmDismissHint() { if (S.hm.seenHint) return; S.hm.seenHint = true; save(); const h = $("#hmHint"); if (h) h.remove(); }

  // ---------- the bottom sheet: peek (just the handle) · mid (Today) · full (the four doors), one scrolling body ----------
  const sheetEl = $("#hmSheet"), grab = $("#hmGrab"), bodyEl = $("#hmBody");
  // two corner buttons, under the thumbs: Today (left) opens the sheet with everything; the view button (right) opens the chooser
  $("#hmToday").onclick = () => { if (!S.hm.opened) { S.hm.opened = true; save(); } setState(sheetState === "peek" ? "full" : "peek"); };
  $("#hmView").onclick = () => { setState("peek"); chooser(); };
  const HM_PEEK = 0;   // at rest the sheet is fully hidden: nothing but colors on screen
  let H = { peek: HM_PEEK, mid: Math.round(innerHeight * .46), full: Math.round(innerHeight * .88) };
  sheetEl.style.height = H.full + "px";
  let revealed = H.peek, sheetState = "peek", sheetLocked = false, bodyBuilt = false;
  function paintSheet(anim) {
    sheetEl.style.transition = anim && !reduceMotion ? "transform .4s var(--ease)" : "none";
    sheetEl.style.transform = `translateY(${H.full - revealed}px)`;
    bodyEl.style.opacity = revealed > H.peek + 8 ? "1" : "0";
    sheetEl.style.visibility = revealed > 0 ? "visible" : "hidden";
  }
  function setState(s, anim = true) {
    sheetState = s; revealed = H[s]; paintSheet(anim);
    el.classList.toggle("hm-sheet-open", s !== "peek");
    grab.setAttribute("aria-label", s === "peek" ? "Open Today" : "Close");
    if (s !== "peek") { if (!sheetLocked) { lockScroll(); sheetLocked = true; } hmRenderBody(); buzz(s === "full" ? 6 : 4); }
    else if (sheetLocked) { unlockScroll(); sheetLocked = false; }
  }
  function hmRenderBody() {
    if (bodyBuilt) return; bodyBuilt = true;
    const due = dueList(), nu = nextUnit(), dc = dailyColor(), dAns = S.daily[today()], chD = chToday(), tr = todayTrain(), chR = challengeRounds();
    const ctaLabel = due.length ? (due.length === 1 ? "One to recall" : `${due.length} to recall`) : nu ? `Continue: ${esc(nu.title)}` : "All caught up";
    bodyEl.innerHTML = `
      <div class="hm-show"><button class="hm-views" data-views><span>${esc(hmViewLabel())}</span> <small>${items.length.toLocaleString()}</small> ${CX_ICON.down}</button><button class="link" data-find>${ICON.search} Search</button></div>
      <p class="eyebrow hm-sec">Today</p>
      <button class="btn hm-cta" data-continue>${ctaLabel} ${ICON.arrow}</button>
      <div class="trio">
        <button class="tday${chD ? " done" : ""}" data-challenge><span class="tday-art tday-ch">${chR.map((x, i) => `<i style="--c:${x.base}"${chD ? ` class="${chD.hits[i] ? "hit" : "miss"}"` : ""}></i>`).join("")}</span><b>Challenge</b><span class="tday-st">${chD ? `${chD.hits.filter(Boolean).length} of 6 right` : (chStreak() ? `${chStreak()}-day streak` : "6 rounds")}</span></button>
        <button class="tday${dAns ? " done" : ""}" data-daily><span class="tday-art" data-morph-src style="background:${dc.h}"></span><b>Today's color</b><span class="tday-st">${dAns ? esc(dc.n) : "Name it"}</span></button>
        <button class="tday${tr.done ? " done" : ""}" data-train><span class="tday-art tday-sa">${tr.art}</span><b>Train</b><span class="tday-st">${tr.done ? "Trained today" : esc(tr.what)}</span></button>
      </div>
      <div class="hm-go-row"><p class="eyebrow hm-sec hm-go">Go</p><span class="hm-go-links"><button class="link" data-camera>${ICON.camera} Camera</button><button class="link" data-surprise>${ICON.dice} Surprise me</button></span></div>
      <div class="hm-doors">
        <button class="hm-door" data-door="learn">${ICON.learn}<b>Learn</b></button>
        <button class="hm-door" data-door="gym">${ICON.gym}<b>Train</b></button>
        <button class="hm-door" data-door="explore">${ICON.explore}<b>Explore</b></button>
        <button class="hm-door" data-door="studio">${ICON.palette}<b>Studio</b></button>
      </div>`;
    bodyEl.querySelector("[data-continue]").onclick = () => due.length ? deck("review") : nu ? meet(nu) : null;
    bodyEl.querySelector("[data-challenge]").onclick = () => chToday() ? challengeDone() : challenge();
    bodyEl.querySelector("[data-daily]").onclick = () => daily();
    bodyEl.querySelector("[data-train]").onclick = tr.open;
    bodyEl.querySelector("[data-views]").onclick = () => { setState("peek"); chooser(); };
    bodyEl.querySelector("[data-find]").onclick = () => { setState("peek"); searchBox.hidden = false; searchInput.focus(); };
    bodyEl.querySelector("[data-camera]").onclick = () => hmCamera();
    bodyEl.querySelector("[data-surprise]").onclick = () => hmDice();
    bodyEl.querySelectorAll("[data-door]").forEach(b => b.onclick = () => b.dataset.door === "learn" ? home() : go(b.dataset.door));
  }
  function snapNearest() {
    const d = [["peek", H.peek], ["mid", H.mid], ["full", H.full]].map(([k, v]) => [k, Math.abs(revealed - v)]).sort((a, b) => a[1] - b[1]);
    setState(d[0][0]);
  }
  let dragY0 = null, dragR0 = 0, dragMoved = false;
  grab.addEventListener("pointerdown", e => { dragY0 = e.clientY; dragR0 = revealed; dragMoved = false; try { grab.setPointerCapture(e.pointerId); } catch (er) {} });
  grab.addEventListener("pointermove", e => {
    if (dragY0 == null) return;
    const dy = e.clientY - dragY0; if (Math.abs(dy) > 4) dragMoved = true;
    revealed = clamp(dragR0 - dy, H.peek, H.full); paintSheet(false);
  });
  const grabEnd = () => {
    if (dragY0 == null) return; dragY0 = null;
    if (!dragMoved) { const order = ["peek", "mid", "full"]; setState(order[(order.indexOf(sheetState) + 1) % order.length]); }
    else snapNearest();
  };
  grab.addEventListener("pointerup", grabEnd); grab.addEventListener("pointercancel", grabEnd);
  grab.addEventListener("click", e => e.preventDefault());   // the pointerup above already decides; a synthetic click would double-fire
  // a tap on the honeycomb while the sheet is up just puts it away again, rather than also picking a bubble
  viewEl.addEventListener("pointerdown", e => { if (sheetState !== "peek") { e.stopPropagation(); setState("peek"); } }, true);
  // swipe up from the bottom of the screen: the sheet follows the finger. Short of a swipe, the honeycomb keeps the
  // touch, so bubbles near the bottom stay tappable.
  let edge = null;
  const EDGE = 120;
  viewEl.addEventListener("pointerdown", e => {
    edge = sheetState === "peek" && e.isPrimary && e.clientY > innerHeight - EDGE ? { x0: e.clientX, y0: e.clientY, on: false } : null;
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
    revealed = clamp(-dy - 14, 0, H.full); paintSheet(false);
  }, true);
  const edgeEnd = e => {
    if (!edge) return; const was = edge.on; edge = null;
    if (!was) return;
    e.stopPropagation();
    setState(revealed < 40 ? "peek" : revealed > H.mid * 1.25 ? "full" : "mid");
    if (!S.hm.opened) { S.hm.opened = true; save(); }
  };
  viewEl.addEventListener("pointerup", edgeEnd, true); viewEl.addEventListener("pointercancel", edgeEnd, true);
  setState("peek", false);
  // until the sheet has been opened once, it rises a little and settles back on the first few visits, so the swipe is
  // discoverable without a permanent bar
  if (!S.hm.opened && (S.hm.teach || 0) < 3 && !reduceMotion) {
    S.hm.teach = (S.hm.teach || 0) + 1; save();
    setTimeout(() => { if (!el.isConnected || sheetState !== "peek" || edge) return; hmRenderBody(); revealed = 64; paintSheet(true); el.classList.add("hm-teach");
      setTimeout(() => { if (!el.isConnected || sheetState !== "peek") return; revealed = 0; paintSheet(true); el.classList.remove("hm-teach"); }, 1600); }, 900);
  }

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
  XSTACK = [];
  openNode(colorNode(c));
  hmPullClose(app.firstElementChild, hmBackOneStep);
}
// Same, for a bubble that isn't one of the 101: its own name page (js/names.js), not the small color sheet
// (ROADMAP.md §13: every one of the ~1,000 names has a real page now).
function hmOpenName(o) {
  XSTACK = [];
  loadCoreNames().then(() => {
    namePage(npEntryFor(o));
    hmPullClose(app.firstElementChild, hmBackOneStep);
  });
}
// whatever the current screen's own Back button does (one step, same as a tap); the pull-down gesture uses
// this too, so it never skips straight to the honeycomb when there's a nearer screen to land on
function hmBackOneStep() { const btn = app.querySelector("[data-back]"); if (btn) btn.click(); else hmHome(); }

// Pull down from the top of a page to close it, like a sheet: the page follows the finger, and past ~110px (or a quick
// flick) it slides away and close() runs. Anywhere below the top, a downward drag is just normal scrolling.
function hmPullClose(screen, close) {
  if (!screen) return;
  let y0 = null, x0 = 0, dy = 0, t0 = 0, on = false;
  const reset = () => { screen.style.transition = "transform .35s var(--ease)"; screen.style.transform = ""; };
  screen.addEventListener("touchstart", e => {
    if (e.touches.length !== 1 || scrollY > 0 || document.querySelector(".sheet")) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; on = false; t0 = performance.now();
  }, { passive: true });
  screen.addEventListener("touchmove", e => {
    if (y0 == null) return;
    const d = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!on) {
      if (d > 8 && d > Math.abs(dx) * 1.3 && scrollY <= 0) on = true;
      else if (Math.abs(dx) > 10 || d < -6) { y0 = null; return; } else return;
    }
    e.preventDefault();
    dy = Math.max(0, d); screen.style.transition = "none"; screen.style.transform = `translateY(${dy * .9}px)`;
  }, { passive: false });
  screen.addEventListener("touchend", () => {
    if (y0 == null || !on) { y0 = null; return; }
    y0 = null;
    const fast = dy > 40 && dy / (performance.now() - t0) > .6;
    if (dy > 110 || fast) {
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
//   home:sheet · home:sheetfull · home:views · home:search
function hmShot(arg) {
  hmHome();
  if (arg === "bar") setTimeout(() => { const s = document.querySelector(".screen.hm"); if (s) s.classList.remove("chrome-hide"); }, 3200);
  if (arg === "sheet") setTimeout(() => hmTap(document.getElementById("hmGrab")), 150);
  if (arg === "sheetfull") setTimeout(() => { hmTap(document.getElementById("hmGrab")); setTimeout(() => hmTap(document.getElementById("hmGrab")), 500); }, 150);
  if (arg === "views") setTimeout(() => hmTap(document.getElementById("hmView")), 150);   // the title itself is hidden in the full-screen design; the corner button opens the same chooser
  if (arg === "search") setTimeout(() => hmTap(document.querySelector("[data-search]")), 150);
}
