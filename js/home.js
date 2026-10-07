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
// What the honeycomb shows = a SOURCE (a stage, or one collection) x a FILTER (all / learned / learning / new) x a
// LAYOUT (map / wheel). One of each, never two sources at once (David: "All 101" next to stages made no sense).
const HM_FILTERS = [["all", "All"], ["learned", "Learned"], ["learning", "Learning"], ["new", "New"]];
const hmSet = id => COLOR_SETS.find(s => s.id === id) || null;
const hmCard = it => it.c && it.c.id ? S.cards[it.c.id] : null;
const HM_KEEP = { all: () => true, learned: it => isMine(hmCard(it)), learning: it => !!hmCard(it) && !isMine(hmCard(it)), new: it => !hmCard(it) };
function hmView() {   // the saved view, upgrading the old single "set" id
  const h = S.hm, old = h.set;
  if (!h.src) {
    h.src = /^stage:\d+$/.test(old || "") ? old : old && hmSet(old) && !["101", "learned", "learning", "notmet"].includes(old) ? old : "stage:100";
    h.filter = { learned: "learned", learning: "learning", notmet: "new" }[old] || "all";
  }
  if (!/^stage:\d+$/.test(h.src) && !hmSet(h.src)) h.src = "stage:100";
  h.filter = HM_KEEP[h.filter] ? h.filter : "all"; h.layout = h.layout === "wheel" ? "wheel" : "map";
  return h;
}
function hmViewLabel() {
  const v = hmView(), n = /^stage:/.test(v.src) ? +v.src.slice(6) : 0;
  const what = n ? `Stage ${HM_STAGES.indexOf(n) + 1}` : hmSet(v.src).title;
  return v.filter === "all" ? what : `${what} · ${HM_FILTERS.find(x => x[0] === v.filter)[1]}`;
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
  const pick = (o, fx) => { if (fx && fx.morph) fx.morph(); hmDismissHint(); o.c ? hmOpenColor(o.c) : colorSheet(o, c => hmOpenColor(c)); };
  function paintTitle(loading) {
    title.querySelector("span").textContent = hmViewLabel();
    title.querySelector("small").textContent = loading ? "Loading…" : `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"} · swipe or tap`;
  }
  async function render(soft) {
    const g = ++gen, v = hmView(), stage = /^stage:/.test(v.src) ? +v.src.slice(6) : 0, set = hmSet(v.src);
    if (stage) { if (!CORE_NAMES) { paintTitle(true); await loadCoreNames(); if (!el.isConnected || g !== gen) return; } items = hmStageItems(stage); }
    else {
      if (csNeedsLib(set.state) && !LONG_NAMES) { paintTitle(true); await loadLongNames(); if (!el.isConnected || g !== gen) return; }
      items = set.get();
    }
    items = items.filter(HM_KEEP[v.filter]);
    paintTitle();
    if (ctrl) ctrl.update({ items, soft, layout: v.layout });
    else ctrl = honeycomb(viewEl, { items, layout: v.layout, zoom: S.hm.zoom || 1, pick, onPeek, centerFirst: true, lens: S.hm.lens == null ? 1 : S.hm.lens,
      onZoom: z => { S.hm.zoom = Math.round(z * 100) / 100; save(); } });
    hmWireChrome();
  }
  function applyView(k, val) { S.hm[k] = val; save(); buzz(4); bodyBuilt = false; }

  // ---------- title: tap for the full chooser, swipe for the four quick views ----------
  async function chooser() {
    buzz(4);
    if (!LONG_NAMES || !CORE_NAMES) { await Promise.all([loadLongNames(), loadCoreNames()]); if (!el.isConnected || document.querySelector(".sheet")) return; }
    const v = hmView(), dotsFor = s => filterColors(csBase(s.state.base), { ...s.state, n: 5 });
    const seg = (key, opts) => `<div class="hm-seg" data-key="${key}">${opts.map(([id, label]) => `<button class="${v[key] === id ? "on" : ""}" data-val="${id}">${esc(label)}</button>`).join("")}</div>`;
    const groups = {};
    COLOR_SETS.forEach(s => { if (["101", "learned", "learning", "notmet"].includes(s.id)) return; (groups[s.group] = groups[s.group] || []).push(s); });
    const collHtml = Object.entries(groups).map(([g, list]) => `
      <div class="cx-sec hm-sub"><b>${esc(g)}</b></div>
      <div class="cx-chips">${list.map(s => `<button class="cx-chip${v.src === s.id ? " on" : ""}" data-src="${s.id}">${cxDots(dotsFor(s))}<b>${esc(s.title)}</b></button>`).join("")}</div>`).join("");
    const { sh, close } = sheet(`<div class="cx-sh hm-chooser">
      <div class="cx-sh-head"><h3>What to show</h3></div>
      <div class="cx-sec"><b>Stage</b><span>the colors each stage of the path teaches</span></div>
      <div class="cx-chips hm-stages">${HM_STAGES.map((n, i) => `<button class="cx-chip${v.src === "stage:" + n ? " on" : ""}" data-src="stage:${n}"><b>${i + 1}</b><em>${(n === 100 ? 101 : n).toLocaleString()}</em></button>`).join("")}</div>
      <div class="cx-sec"><b>Show</b><span>from your own reviews</span></div>
      ${seg("filter", HM_FILTERS)}
      <div class="cx-sec"><b>Layout</b></div>
      ${seg("layout", [["map", "Map"], ["wheel", "Wheel"]])}
      <div class="cx-sec"><b>Lens</b><span>how much the edges shrink</span></div>
      <label class="hm-lens"><span>Flat</span><input type="range" min="0" max="2" step=".05" value="${S.hm.lens == null ? 1 : S.hm.lens}" aria-label="Lens strength"><span>Strong</span></label>
      <div class="cx-sec"><b>Or a collection</b><span>instead of a stage</span></div>
      ${collHtml}
    </div>`);
    sh.classList.add("cx-sheet");
    const lensIn = sh.querySelector(".hm-lens input");
    lensIn.addEventListener("input", () => { S.hm.lens = +lensIn.value; if (ctrl && ctrl.lens) ctrl.lens(S.hm.lens); });
    lensIn.addEventListener("change", () => save());
    // every change applies at once and the panel stays open, so you can see what each control does
    sh.querySelectorAll("[data-src]").forEach(b => b.onclick = () => {
      applyView("src", b.dataset.src); sh.querySelectorAll("[data-src]").forEach(x => x.classList.toggle("on", x === b)); render(true);
    });
    sh.querySelectorAll(".hm-seg").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
      applyView(g.dataset.key, b.dataset.val); g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); render(true);
    }));
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
    loadLongNames().then(() => { if (!el.isConnected) return; const hits = searchColors(csItems(), q); if (ctrl) ctrl.update({ items: hits.length ? hits : items, soft: true }); });
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

// Opens an app color's full page directly (ROADMAP.md §12: no half-height card, no second tap), and makes Back
// (or the browser/swipe-back gesture, which reuses the same [data-back]) return to the honeycomb where it was —
// honey.js's own HONEY_PAN already restores the pan and zoom the next time hmHome() builds the same set of items.
function hmOpenColor(c) {
  XSTACK = [];
  openNode(colorNode(c));
  const btn = app.querySelector("[data-back]");
  if (btn) btn.onclick = () => hmHome();
  hmPullClose(app.firstElementChild, () => hmHome());
}

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
}
// ---------- screenshot hooks: #shot=home (bar fades, the default) · home:bar (forced back on) ----------
//   home:sheet · home:sheetfull · home:views · home:search
function hmShot(arg) {
  hmHome();
  if (arg === "bar") setTimeout(() => { const s = document.querySelector(".screen.hm"); if (s) s.classList.remove("chrome-hide"); }, 3200);
  if (arg === "sheet") setTimeout(() => hmTap(document.getElementById("hmGrab")), 150);
  if (arg === "sheetfull") setTimeout(() => { hmTap(document.getElementById("hmGrab")); setTimeout(() => hmTap(document.getElementById("hmGrab")), 500); }, 150);
  if (arg === "views") setTimeout(() => hmTap(document.querySelector(".hm-title")), 150);
  if (arg === "search") setTimeout(() => hmTap(document.querySelector("[data-search]")), 150);
}
