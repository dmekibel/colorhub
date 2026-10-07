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

const HM_QUICK = [["101", "All 101"], ["learned", "Learned"], ["learning", "Learning"], ["notmet", "Not met yet"]];
const hmSet = id => COLOR_SETS.find(s => s.id === id) || COLOR_SETS[0];
const hmLabel = id => { const q = HM_QUICK.find(x => x[0] === id); return q ? q[1] : hmSet(id).title; };

function hmHome() {
  if (!S.placed) return welcome();
  S.hm = S.hm || {};
  let setId = COLOR_SETS.some(s => s.id === S.hm.set) ? S.hm.set : "101";
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
    title.querySelector("span").textContent = hmLabel(setId);
    title.querySelector("small").textContent = loading ? "Loading…" : `${items.length.toLocaleString()} color${items.length === 1 ? "" : "s"} · swipe or tap`;
  }
  async function render(soft) {
    const g = ++gen, set = hmSet(setId);
    if (csNeedsLib(set.state) && !LONG_NAMES) { paintTitle(true); await loadLongNames(); if (!el.isConnected || g !== gen) return; }
    items = set.get();
    paintTitle();
    if (ctrl) ctrl.update({ items, soft });
    else ctrl = honeycomb(viewEl, { items, layout: "map", zoom: S.hm.zoom || 1, pick, onPeek,
      onZoom: z => { S.hm.zoom = Math.round(z * 100) / 100; save(); } });
    hmWireChrome();
  }
  function applySet(id) { setId = id; S.hm.set = id; save(); buzz(4); bodyBuilt = false; }

  // ---------- title: tap for the full chooser, swipe for the four quick views ----------
  async function chooser() {
    buzz(4);
    if (!LONG_NAMES) { title.classList.add("busy"); await loadLongNames(); title.classList.remove("busy"); if (!el.isConnected || document.querySelector(".sheet")) return; }
    const dotsFor = s => filterColors(csBase(s.state.base), { ...s.state, n: 5 });
    const row = (id, label) => { const s = hmSet(id); return `<button class="cx-opt${setId === id ? " on" : ""}" data-set="${id}">${cxDots(dotsFor(s))}<span class="cx-opt-t"><b>${esc(label)}</b></span><em>${s.get().length.toLocaleString()}</em></button>`; };
    const groups = {};
    COLOR_SETS.forEach(s => { if (HM_QUICK.some(q => q[0] === s.id)) return; (groups[s.group] = groups[s.group] || []).push(s); });
    const groupHtml = Object.entries(groups).map(([g, list]) => `
      <div class="cx-sec"><b>${esc(g)}</b></div>
      <div class="cx-chips">${list.map(s => `<button class="cx-chip${setId === s.id ? " on" : ""}" data-set="${s.id}">${cxDots(dotsFor(s))}<b>${esc(s.title)}</b></button>`).join("")}</div>`).join("");
    const { sh, close } = sheet(`<div class="cx-sh">
      <div class="cx-sh-head"><h3>What to show</h3></div>
      <div class="cx-sec"><b>Views</b><span>honestly, off your own reviews</span></div>
      ${HM_QUICK.map(([id, label]) => row(id, label)).join("")}
      ${groupHtml}
    </div>`);
    sh.classList.add("cx-sheet");
    sh.querySelectorAll("[data-set]").forEach(b => b.onclick = () => { close(); applySet(b.dataset.set); render(true); });
  }
  (() => {
    let x0 = 0, y0 = 0, moved = false;
    title.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; moved = false; });
    title.addEventListener("pointermove", e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) moved = true; });
    title.addEventListener("pointerup", e => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        let i = HM_QUICK.findIndex(q => q[0] === setId); if (i < 0) i = 0;
        i = (i + (dx < 0 ? 1 : -1) + HM_QUICK.length) % HM_QUICK.length;
        applySet(HM_QUICK[i][0]); render(true);
      } else if (!moved) chooser();
    });
  })();

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
      <div class="hm-show"><button class="hm-views" data-views><span>${esc(hmLabel(setId))}</span> <small>${items.length.toLocaleString()}</small> ${CX_ICON.down}</button><button class="link" data-find>${ICON.search} Search</button></div>
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
