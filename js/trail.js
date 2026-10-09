"use strict";
// One trail for everything (David, 2026-10-08: "every time you keep clicking a hyperlink, you should be able to go
// back to the previous one. But at any moment you should also be able to exit and go back to home").
//
//  - XSTACK (js/explore.js) is the one trail. Builders that know their own token push it (p:, z:, g:, aw:, ar:,
//    pt:, n:, poem:…). Any other screen with an address (router.js ROUTED) that didn't push gets an "r:<path>"
//    token here, with a closure that redraws it exactly, so looks, fashion, flower and gem lists, games and the
//    rest join the same trail instead of keeping a private "back" of their own.
//  - On a page that is on the trail, ‹ (the button, Escape, the browser and the iOS back gesture, which all press
//    it) is xBack(): one step, scroll restored (core.js SCROLL_BY_HASH). Each page's own back closure is bypassed.
//  - Long-press ‹ opens the trail sheet: where you've been, newest first, with a picture of each; tap one to jump.
//  - Every inner page gets a second control, top-right: Close (a labeled pill), straight to the map exactly where you
//    left it (honey.js HONEY_PAN), forgetting the whole chain. A pull down from the top of a page goes one step back.
//  - The trail lives in sessionStorage, so a reload keeps it.
// core.js show() calls tlNote() for every screen; router.js routeWrap() calls tlCallNote() for every addressed one.

const TL_META = new Map();     // trail token -> { hash, title, img, c, sw }
const TL_REPLAY = new Map();   // "r:" token -> the call that drew it
let TL_CALL = null;            // the addressed screen call in progress: { run, t }
let TL_PREV = "";              // the trail as it stood at the previous screen
let TL_KEEP = null;            // a replay that must not lose the trail behind it: { stack, root, t }
let TL_MAPKEEP = null;         // a page lit its colors on the map (csOnMap): the trail stays behind the map so the lit set can return: { stack, root, t }
let TL_SUPPRESS = 0;           // the click that ends a long press must not also go back
let TL_BOOTED = false;
const TL_KEY = "colorhub-trail";
// what each address is, in a word, for the trail sheet
const TL_KIND = { color: "Color", name: "Color", painting: "Painting", gallery: "Painting", painter: "Painter", painters: "Painters",
  movement: "Movement", decade: "Decade", country: "Country", arthistory: "Art history", hub: "Color family", which: "Which is which",
  pair: "A pair in paintings", paintings: "Painting map", "paintings-of": "In paintings", chords: "Masters' chords", look: "Look", fashion: "Fashion", gem: "Gems",
  botany: "Flowers and plants", poem: "Poem", passage: "Passage", film: "Film", photo: "Your photo", page: "Page", story: "Story",
  subject: "Subject",   // js/subjectview.js: #/subject/<kind>/<id>, PAGES-AUDIT.md plan item 3
  studio: "Studio", practice: "Practice", odd: "Odd one out", line: "Across the line", favorites: "Your colors", taste: "Taste",
  lab: "Lab", mapstudy: "Study the map", daily: "Color of the day", challenge: "Daily challenge", museum: NAV_MUSEUM, explore: NAV_MUSEUM };

function tlCallNote(fn, self, args) { TL_CALL = { run: () => fn.apply(self, args), t: performance.now() }; }

const tlBackBtn = scr => scr && scr.querySelector("[data-back]");
const tlPath = hash => String(hash || "").replace(/^#\//, "");
function tlKind(hash) {
  const p = tlPath(hash).split("?")[0].split("/");
  if (p[2] === "more" || p[1] === "more") return "More like this";
  return TL_KIND[p[0]] || "Page";
}
// a picture of the screen for its row: the hero's color, its first photograph, or a few of its colors
function tlCapture(el) {
  const h1 = el.querySelector("h1"), title = (h1 && h1.textContent.trim().replace(/\s+/g, " ")) || document.title.replace(/ · ColorHub$/, "");
  const hero = el.querySelector(".c-hero, .z-color");
  const c = hero ? (hero.style.getPropertyValue("--c") || "").trim() : "";
  const im = c ? null : [...el.querySelectorAll("img")].find(i => (i.currentSrc || i.src) && !/^data:/.test(i.src) && !i.closest("header"));
  const sw = [...el.querySelectorAll('[style*="--c:#"]')].map(e => e.style.getPropertyValue("--c").trim()).filter((h, i, a) => /^#[0-9a-f]{6}$/i.test(h) && a.indexOf(h) === i).slice(0, 5);
  return { title: title.slice(0, 80), c, img: im ? im.currentSrc || im.src : "", sw };
}

function tlSave() {
  try {
    sessionStorage.setItem(TL_KEY, JSON.stringify({ stack: XSTACK, root: X_ROOT, meta: XSTACK.filter(t => TL_META.has(t)).map(t => [t, TL_META.get(t)]) }));
  } catch (e) {}
}
// a reload of the page you were on brings the trail behind it back (only a reload: a fresh visit starts a fresh trail)
function tlRestore() {
  let nav = ""; try { nav = (performance.getEntriesByType("navigation")[0] || {}).type || ""; } catch (e) {}
  if (nav !== "reload") return;
  let d = null; try { d = JSON.parse(sessionStorage.getItem(TL_KEY) || "null"); } catch (e) {}
  if (!d || !Array.isArray(d.stack) || !d.stack.length) return;
  const meta = new Map(d.meta || []), top = d.stack[d.stack.length - 1];
  if (!meta.get(top) || meta.get(top).hash !== ROUTE_NOW) return;
  meta.forEach((v, k) => TL_META.set(k, v));
  XSTACK = d.stack.slice(); X_ROOT = d.root || null;
}

// Called by show() (core.js) once the screen is in the page.
function tlNote(el, tab, backNav) {
  const call = TL_CALL; TL_CALL = null;
  if (!el.classList.contains("hm") && !el.classList.contains("waiting")) TL_FORGOT = false;   // a new page: Back works as usual again
  // screenshot mode (#shot=…, boot.js) draws a screen as if it had been opened from its room
  if (typeof SHOT !== "undefined" && SHOT) { if (tab || el.classList.contains("hm")) X_ROOT = tab || "home"; else if (!X_ROOT) X_ROOT = S.tab || "learn"; tlDecorate(el); return; }
  // a loading placeholder (loader.js waitScreen): the real screen it stands in for is the one that joins the trail
  if (el.classList.contains("waiting")) { TL_CALL = call; return; }
  if (TL_KEEP) { if (performance.now() - TL_KEEP.t < 4000) { XSTACK = TL_KEEP.stack; X_ROOT = TL_KEEP.root; } TL_KEEP = null; }
  if (!TL_BOOTED) { TL_BOOTED = true; tlRestore(); }
  // the map opened BY a page (a painting's colors lit on it): the trail stays, so the lit set can go back to its source
  if (el.classList.contains("hm") && TL_MAPKEEP) {
    const k = TL_MAPKEEP; TL_MAPKEEP = null;
    if (performance.now() - k.t < 4000 && k.stack.length) { XSTACK = k.stack; X_ROOT = k.root; TL_UNDER = null; TL_PREV = ""; tlSave(); return; }
  }
  // a room or the map is where a trail starts: nothing behind it, and it's where the trail returns when it runs out
  if (tab || el.classList.contains("hm")) { XSTACK = []; X_ROOT = tab || "home"; TL_UNDER = null; TL_PREV = ""; tlSave(); return; }
  const back = tlBackBtn(el);
  // a part of the Museum (Art, For you, Ideas, World, Saved) starts trails too: running out comes back to it
  if (back && !call && !XSTACK.length && S.tab === "explore" && ROUTE_NOW.indexOf("#/" + TAB_ROUTE.explore[0]) === 0) X_ROOT = "explore";
  const sig = XSTACK.join("\n");
  if (!back) { TL_PREV = sig; return; }   // a task (✕) or a full-screen tool: it has its own way out
  let top = XSTACK[XSTACK.length - 1];
  const topMeta = top && TL_META.get(top);
  const changed = sig !== TL_PREV;
  // a page with its own address whose builder didn't push a token: it joins the trail here
  if (!backNav && !changed && call && performance.now() - call.t < 8000 && ROUTE_NOW && (!topMeta || topMeta.hash !== ROUTE_NOW)) {
    top = "r:" + tlPath(ROUTE_NOW);
    XSTACK.push(top); TL_REPLAY.set(top, call.run);
  }
  const onTrail = !!top && (changed || XSTACK.join("\n") !== sig || (TL_META.get(top) || {}).hash === ROUTE_NOW);
  if (onTrail) {
    TL_META.set(top, { ...tlCapture(el), hash: ROUTE_NOW });
    el.dataset.tl = "1";
    // pictures and titles that arrive a moment later (gallery shards, poems) still make it into the row
    later(() => { if (el.isConnected && XSTACK[XSTACK.length - 1] === top) { TL_META.set(top, { ...tlCapture(el), hash: ROUTE_NOW }); tlSave(); } }, 900);
    if (XSTACK.length >= 3 && !S.tlHint) { S.tlHint = 1; save(); later(() => { if (el.isConnected) toast("Hold ‹ to see your trail"); }, 1200); }
  }
  TL_PREV = XSTACK.join("\n");
  tlSave();
  tlDecorate(el);
  if (backNav) tlHoldScroll();
}

// ---------- the second control: Close (exit everything), top-right, beside whatever the header already holds ----------
const TL_EXIT_HTML = (cls = "") => `<button class="tl-exit${cls ? " " + cls : ""}" data-tl-exit aria-label="Close: back to the map, where you left it">${ICON.x}<span>Close</span></button>`;
// the map reached by Close: the chain behind it is forgotten, so Back (the browser's, the iOS swipe) stays on the map
// instead of walking into it again (core.js popstate asks tlForgot)
let TL_FORGOT = false;
const tlForgot = () => TL_FORGOT && !!app.querySelector(".screen.hm");
function tlDecorate(el) {
  const back = tlBackBtn(el);
  if (!back || el.querySelector("[data-tl-exit]") || document.documentElement.classList.contains("booth") || el.classList.contains("hm")) return;
  // David (2026-10-09): "there should be an easy way to exit everything, and it should forget the whole chain". The
  // hexagon alone read as a private icon, so the exit is a labeled, solid pill: ✕ Close, top right on every inner page
  // (and in a color page's pinned header). It goes straight to the map where you left it and forgets the trail.
  const html = TL_EXIT_HTML();
  const nav = back.closest(".nav-top");
  const bar = el.querySelector(".rp-bar");
  if (bar && !bar.querySelector("[data-tl-exit]")) bar.querySelector(".rp-bar-name").insertAdjacentHTML("afterend", TL_EXIT_HTML("tl-exit-bar"));
  if (back.classList.contains("cp-close")) back.insertAdjacentHTML("afterend", TL_EXIT_HTML("tl-exit-float"));   // a full-bleed hero: mirrored on the right
  else if (nav && nav.querySelector(".nav-r")) nav.querySelector(".nav-r").insertAdjacentHTML("beforeend", html);
  else {
    const hd = back.parentElement, last = hd.lastElementChild;
    // an empty spacer that only balanced the header gives its place to the glyph
    if (last && last !== back && last.tagName === "SPAN" && !last.children.length && !last.textContent.trim()) last.outerHTML = html;
    else hd.insertAdjacentHTML("beforeend", html);
    hd.classList.add("tl-x");
  }
  back.setAttribute("aria-description", "Hold to see your trail");
  // pull down from the top, or swipe back from the left edge: one step back, like closing a sheet (not on
  // full-screen tools, whose drags are their own) -- js/trail.js's own gesture, tlgWire below
  if (!el.classList.contains("fixed")) tlgWire(el);
}

// ---------- gesture-following back (David, 2026-10-09): "if I swipe down I don't need to see it shrink back
// into its original bubble, I just need to see the page swiped away downwards; if I swipe back, the zoom-out
// animation doesn't make sense in that context." Both directions track the finger 1:1 (with light resistance),
// show the destination already sitting underneath as you drag -- the honeycomb's own last frame for a return
// straight to the map (js/honey.js snapshot(): the one destination worth a real preview, since the live canvas
// can't be rebuilt mid-drag without risking a cancelled gesture having to undo it), a calm surface otherwise --
// and either spring back (release early) or carry on off-screen at the release velocity (release past the
// threshold), landing on the real screen only once that motion is done. TLG_SKIP stands down js/mapxfer.js's
// bubble grow/shrink and show()'s own crossfade/entrance for that one landing, since the gesture already did
// the motion; a deliberate tap (‹, Close, the map glyph) is untouched and keeps the bubble shrink.
// Reduced motion: this gesture isn't wired at all -- ‹ (already instant under reduceMotion) is the way back.
let TLG_SKIP = false;
let TLG_ANIM = null;   // the in-flight "continue off-screen" animation, if any (tools/smoke: force it to the end, same as MX.anims)
const TLG_PULL = 110, TLG_EDGE = 28, TLG_SLOP = 10, TLG_BORN = 350, TLG_REST = 700, TLG_FLING = .5, TLG_SPRING = 260, TLG_CAP = 320;
// the one destination with a cheap, honest preview: the map's last drawn frame, kept alive in HM_CTRL's own
// (possibly detached) canvas whether or not the map is on screen right now
function tlgSnapshot() {
  try { return typeof HM_CTRL !== "undefined" && HM_CTRL && HM_CTRL.snapshot ? HM_CTRL.snapshot(Math.round(innerWidth)) : null; } catch (e) { return null; }
}
// where releasing this gesture lands -- exactly what the back button already does (xBack if this page is on
// the trail, tlToOrigin otherwise) -- and whether that's the map, the one case worth a real backdrop. A page
// opened straight from the map still joins the trail as its own one-entry "r:" token (js/trail.js tlNote), so
// xBack() on it pops that single entry and lands on the origin anyway -- reachesOrigin covers that case too,
// not just the no-trail one.
function tlgDest(el) {
  const onTrail = !!el.dataset.tl, reachesOrigin = !onTrail || XSTACK.length <= 1, toMap = reachesOrigin && !xFallbackTab();
  return { toMap, go: () => { if (onTrail) xBack(); else tlToOrigin(); } };
}
function tlgCommit(dest) {
  TLG_SKIP = true;
  try { dest.go(); } finally { TLG_SKIP = false; }
}
function tlgFloor(toMap) {
  const d = document.createElement("div");
  d.className = "tlg-floor";
  const img = toMap && tlgSnapshot();
  if (img) { d.style.backgroundImage = `url(${img})`; d.classList.add("tlg-floor-img"); }
  document.body.appendChild(d);
  return d;
}
function tlgWire(el) {
  if (!el || reduceMotion) return;
  const born = performance.now(), blocked = e => e.target.closest && e.target.closest("canvas,input,textarea,select,[data-nopull]");
  let lastScroll = 0;
  const onScroll = () => { lastScroll = performance.now(); if (!el.isConnected) removeEventListener("scroll", onScroll); };
  addEventListener("scroll", onScroll, { passive: true, capture: true });
  let a = null;   // the live gesture: { id, axis, x0, y0, dest, floor, anim }
  const clean = () => {
    if (a && a.floor) a.floor.remove();
    if (a && a.anim) { try { a.anim.cancel(); } catch (e) {} if (TLG_ANIM === a.anim) TLG_ANIM = null; }
    el.style.transition = ""; el.style.transform = ""; el.style.willChange = "";
    a = null;
  };
  el.addEventListener("pointerdown", e => {
    if (!e.isPrimary || a || document.querySelector(".sheet") || performance.now() - born < TLG_BORN || blocked(e)) return;
    const vertOK = pageScrollTop() <= 0 && performance.now() - lastScroll >= TLG_REST, horizOK = e.clientX < TLG_EDGE;
    if (!vertOK && !horizOK) return;
    a = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, vertOK, horizOK, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), vx: 0, vy: 0, floor: null, anim: null };
  }, { passive: true });
  el.addEventListener("pointermove", e => {
    if (!a || e.pointerId !== a.id) return;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (!a.axis) {
      if (a.horizOK && dx > TLG_SLOP && dx > Math.abs(dy) * 1.6) a.axis = "x";
      else if (a.vertOK && dy > TLG_SLOP && dy > Math.abs(dx) * 1.6 && pageScrollTop() <= 0) a.axis = "y";
      else { if (Math.abs(dx) > 10 || Math.abs(dy) > 10) a = null; return; }
      a.dest = tlgDest(el);
      a.floor = tlgFloor(a.dest.toMap);
      el.style.willChange = "transform";
      try { el.setPointerCapture(a.id); } catch (er) {}
    }
    e.preventDefault();
    const now = performance.now(), dt = Math.max(1, now - a.lastT);
    const d = a.axis === "x" ? dx : dy, resisted = Math.max(0, d < 80 ? d * .55 : 44 + (d - 80) * .35);
    el.style.transition = "none";
    el.style.transform = a.axis === "x" ? `translateX(${resisted}px)` : `translateY(${resisted}px)`;
    const v = ((a.axis === "x" ? e.clientX - a.lastX : e.clientY - a.lastY)) / dt;
    if (a.axis === "x") a.vx = v; else a.vy = v;
    a.lastX = e.clientX; a.lastY = e.clientY; a.lastT = now; a.d = d; a.resisted = resisted;
  }, { passive: false });
  const release = e => {
    if (!a || e.pointerId !== a.id) return;
    if (!a.axis) { a = null; return; }
    const v = a.axis === "x" ? a.vx : a.vy, past = (a.d || 0) > TLG_PULL || v > TLG_FLING, dest = a.dest, floor = a.floor;
    const final = a.axis === "x" ? `translateX(${innerWidth + 60}px)` : `translateY(${innerHeight * .7 + 60}px)`;
    if (past) {
      const remaining = (a.axis === "x" ? innerWidth - a.resisted : innerHeight * .7 - a.resisted);
      const dur = Math.min(TLG_CAP, Math.max(120, remaining / Math.max(v, .35)));
      el.style.transition = "none";
      a.anim = TLG_ANIM = el.animate([{ transform: el.style.transform || "none" }, { transform: final }], { duration: dur, easing: "linear", fill: "forwards" });
      a.anim.onfinish = () => { TLG_ANIM = null; floor.remove(); tlgCommit(dest); };
    } else {
      el.style.transition = `transform ${TLG_SPRING}ms var(--spring)`;
      el.style.transform = "translate(0,0)";
      setTimeout(() => { if (floor) floor.remove(); el.style.transition = ""; el.style.transform = ""; el.style.willChange = ""; }, TLG_SPRING + 20);
    }
    a = null;
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", () => { clean(); });
  el.addEventListener("lostpointercapture", e => { if (a && a.id === e.pointerId && a.axis) release(e); });
}

// ---------- going back, jumping, exiting ----------
// A room page opened from a page (a color's "See it in Art"): the room page starts a trail of its own, but its ‹
// should still come back to the page that opened it. tlKeepUnder() notes that trail; backToPager() asks tlBackUnder().
let TL_UNDER = null;
function tlKeepUnder() { TL_UNDER = XSTACK.length ? { stack: XSTACK.slice(), root: X_ROOT } : null; }
function tlBackUnder() {
  const u = TL_UNDER; if (!u) return false;
  TL_UNDER = null; XSTACK = u.stack; X_ROOT = u.root; BACK_RENDER = true;
  xStep(XSTACK[XSTACK.length - 1]);
  return true;
}
// the page that lit the map's set (csOnMap), for the lit-set bar's ‹ and its picture. The trail behind it rides on the
// lit set (honey.js HONEY_HL.from), so after Learn these or Find them come back to a map whose own trail restarted,
// ‹ still lands on that page with its scroll kept. A set lit on the map itself (search) has no page to go back to.
function tlMapBack() {
  const lit = typeof HONEY_HL !== "undefined" && HONEY_HL;
  const from = lit ? lit.from : (XSTACK.length ? { stack: XSTACK, root: X_ROOT } : null);
  const tok = from && from.stack[from.stack.length - 1]; if (!tok) return null;
  const m = TL_META.get(tok) || {};
  return { title: m.title || "", img: m.img || "", c: m.c || "", sw: m.sw || [],
    go: () => { XSTACK = from.stack.slice(); X_ROOT = from.root; tlJump(XSTACK.length - 1); } };
}
function tlJump(i) {
  if (i < 0 || i >= XSTACK.length) return;
  XSTACK.length = i + 1;
  BACK_RENDER = true;
  xStep(XSTACK[i]);
}
// where the trail started: the map, or the room (or room page) it was opened from
function tlToOrigin() { XSTACK = []; BACK_RENDER = true; xStep(undefined); }
function tlExit(btn) {
  buzz(6);
  XSTACK = []; X_ROOT = null; TL_UNDER = null; TL_MAPKEEP = null; TL_FORGOT = true; tlSave();   // the whole chain is forgotten
  const scr = app.querySelector(".screen"), home = () => typeof hmHome === "function" ? hmHome() : go(S.tab || "learn");
  // a color's page goes back into its own bubble on the map instead (js/mapxfer.js, from hmHome)
  if (scr && btn && btn.isConnected && !(scr.querySelector(".cp-hero") && typeof mxLeave === "function")) shrinkTo(scr, btn, home); else home();
}
// the exact color that opened a color or name page as its nearest name ("Your color · 97% match"), so Back draws it
// the same way: it rode in the page's address as ?c=<hex> (router.js tappedQS)
function tlTapped(tok) { const m = TL_META.get(tok), q = m && /\?c=([0-9a-f]{6})/i.exec(m.hash || ""); return q ? "#" + q[1].toUpperCase() : null; }
function tlTol(tok) { const m = TL_META.get(tok), q = m && /[?&]t=(\d+(?:\.\d+)?)/.exec(m.hash || ""); return q ? +q[1] : null; }
// an "r:" token: draw that screen again, keeping the trail behind it
function tlReplay(tok) {
  TL_KEEP = { stack: XSTACK.slice(), root: X_ROOT, t: performance.now() };
  const f = TL_REPLAY.get(tok);
  if (f) { try { f(); return; } catch (e) {} }
  if (!openRoute("#/" + tok.slice(2))) { TL_KEEP = null; XSTACK.pop(); xStep(XSTACK[XSTACK.length - 1]); }
}
// a page whose content arrives after it's drawn (a gallery shelf, poems) can be too short for the remembered scroll
// on the first frame; keep trying for a moment, and stop the instant the reader touches the page
function tlHoldScroll() {
  const want = SCROLL_BY_HASH.get(ROUTE_NOW);
  if (!want) return;
  let n = 0, stop = false;
  const quit = () => { stop = true; };
  addEventListener("touchstart", quit, { once: true, passive: true }); addEventListener("wheel", quit, { once: true, passive: true });
  const tick = () => {
    if (stop || ++n > 12) return;
    if (Math.abs(scrollY - want) > 4) scrollTo(0, want);
    setTimeout(tick, 120);
  };
  setTimeout(tick, 80);
}

// ‹ on a trail page is one step down the trail (a tap, Escape, the browser's Back and the iOS back gesture, which
// all press it: core.js popstate). Capture phase, so it runs before the page's own handler, which it replaces.
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-back]");
  if (!b || !app.contains(b)) return;
  if (performance.now() < TL_SUPPRESS) { e.stopPropagation(); e.preventDefault(); TL_SUPPRESS = 0; return; }
  const scr = b.closest("[data-tl]");
  if (!scr || b !== tlBackBtn(scr)) return;
  e.stopPropagation(); e.preventDefault();
  xBack();
}, true);
document.addEventListener("click", e => {
  const x = e.target.closest && e.target.closest("[data-tl-exit]");
  if (x && app.contains(x)) { e.preventDefault(); tlExit(x); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.metaKey || e.ctrlKey || document.querySelector(".sheet,.rooms-stem")) return;
  const scr = app.querySelector(".screen[data-tl]");
  if (!scr) return;
  e.stopPropagation();
  xBack();
}, true);

// ---------- long-press ‹: the trail sheet ----------
let TL_LP = 0;
document.addEventListener("pointerdown", e => {
  const b = e.target.closest && e.target.closest("[data-back]");
  if (!b || !app.contains(b) || e.button > 0) return;
  clearTimeout(TL_LP);
  const x0 = e.clientX, y0 = e.clientY;
  const end = () => { clearTimeout(TL_LP); TL_LP = 0; if (TL_SUPPRESS === Infinity) TL_SUPPRESS = performance.now() + 500; off(); };
  const move = m => { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 10) end(); };
  const off = () => { removeEventListener("pointerup", end, true); removeEventListener("pointercancel", end, true); removeEventListener("pointermove", move, true); };
  addEventListener("pointerup", end, true); addEventListener("pointercancel", end, true); addEventListener("pointermove", move, true);
  TL_LP = setTimeout(() => { TL_LP = 0; TL_SUPPRESS = Infinity; tlSheet(); }, 450);
}, true);
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("[data-back]")) e.preventDefault(); });

function tlThumb(m) {
  if (m.img) return `<span class="tl-th"><img src="${esc(m.img)}" alt="" loading="lazy"></span>`;
  if (m.c) return `<span class="tl-th" style="background:${esc(m.c)}"></span>`;
  if (m.sw && m.sw.length) return `<span class="tl-th tl-th-sw">${m.sw.map(h => `<i style="background:${h}"></i>`).join("")}</span>`;
  return `<span class="tl-th tl-th-none"></span>`;
}
// a row whose page was never captured (it left before its screen was measured): the real title from what the token names,
// never a generic "A page you opened"
function tlMetaFor(tok) {
  const m = TL_META.get(tok); if (m && m.title) return m;
  let title = "", kind = "";
  try {
    const i = tok.indexOf(":"), pre = i < 0 ? tok : tok.slice(0, i), rest = i < 0 ? "" : tok.slice(i + 1);
    if ((pre === "p" || pre === "z") && typeof graph === "function") { const n = graph().nodes.get(rest); if (n) { title = n.title || n.n || ""; kind = n.kind || ""; } }
    else if (pre === "n") title = decodeURIComponent(rest);
    else if (pre === "aw") title = rest.split(":").pop().replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    else if (pre === "ar") title = rest.split("/").pop();
    else if (pre === "r") title = tlKind("#/" + rest);
    else if (pre === "g") kind = "gallery";
    else title = ({ favs: "Your colors", "favs-taste": "Your taste", chords: "Masters' chords", wheel: "Color wheel", wheelview: "Color wheel", namer: "Name any color", harmony: "Harmony", contrast: "Contrast" })[tok] || "";
  } catch (e) {}
  return { ...(m || {}), title: title || (kind && (TL_KIND[kind] || kind)) || "Earlier page", hash: (m && m.hash) || (kind ? "#/" + kind : "") };
}
const tlRow = (k, m, sub, here) => `<li><button class="tl-row${here ? " here" : ""}" data-tl-go="${k}"${here ? ' aria-current="page"' : ""}>${tlThumb(m)}<span class="tl-txt"><b>${esc(m.title || "A page")}</b><em>${esc(sub)}</em></span>${here ? "" : ICON.chev}</button></li>`;
function tlSheet() {
  if (document.querySelector(".sheet")) return;
  buzz(8);
  const scr = app.querySelector(".screen"), onTrail = !!(scr && scr.dataset.tl);
  const rows = [];
  if (!onTrail && scr) rows.push(tlRow("none", tlCapture(scr), "You're here", true));
  for (let i = XSTACK.length - 1; i >= 0; i--) {
    const tok = XSTACK[i], m = tlMetaFor(tok);
    const here = onTrail && i === XSTACK.length - 1;
    rows.push(tlRow(i, m, here ? `${tlKind(m.hash)} · You're here` : tlKind(m.hash), here));
  }
  // the foot: where this trail started, then the map itself if that wasn't it
  const room = xFallbackTab(), fromMap = !room, roomName = (ROOMS_LIST.find(r => r[0] === room) || [, "Learn"])[1];
  const mapRow = `<li><button class="tl-row tl-foot" data-tl-go="map"><span class="tl-th tl-th-map">${HOME_GLYPH}</span><span class="tl-txt"><b>${esc(NAV_MAP)}</b><em>${fromMap ? "Where you started · " : ""}${esc(NAV_MAP_NOTE)}</em></span>${ICON.chev}</button></li>`;
  const roomRow = fromMap ? "" : `<li><button class="tl-row tl-foot" data-tl-go="origin"><span class="tl-th tl-th-room">${typeof roomsBubbleArt === "function" ? roomsBubbleArt(room) : ""}</span><span class="tl-txt"><b>${esc(roomName)}</b><em>Where you started</em></span>${ICON.chev}</button></li>`;
  const { sh, close } = sheet(`<div class="tl-sheet"><h2 class="title-2">Your trail</h2><p class="note">${XSTACK.length > 1 ? `${XSTACK.length} pages, newest first` : "Every page you open from here joins it"}</p>
    <ol class="tl-list">${rows.join("")}${roomRow}${mapRow}</ol></div>`);
  sh.classList.add("tl-sheet-wrap");
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-tl-go]"); if (!b || b.classList.contains("here")) return;
    const k = b.dataset.tlGo;
    buzz(6); close();
    if (k === "map") return tlExit(null);
    if (k === "origin") return tlToOrigin();
    if (k !== "none") tlJump(+k);
  });
}
