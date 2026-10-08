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
//  - Every inner page gets a second control, top-right: the map glyph, straight to the honeycomb with its pan
//    and zoom kept (honey.js HONEY_PAN). A pull down from the top of a page goes to wherever the trail started.
//  - The trail lives in sessionStorage, so a reload keeps it.
// core.js show() calls tlNote() for every screen; router.js routeWrap() calls tlCallNote() for every addressed one.

const TL_META = new Map();     // trail token -> { hash, title, img, c, sw }
const TL_REPLAY = new Map();   // "r:" token -> the call that drew it
let TL_CALL = null;            // the addressed screen call in progress: { run, t }
let TL_PREV = "";              // the trail as it stood at the previous screen
let TL_KEEP = null;            // a replay that must not lose the trail behind it: { stack, root, t }
let TL_SUPPRESS = 0;           // the click that ends a long press must not also go back
let TL_BOOTED = false;
const TL_KEY = "colorhub-trail";
// what each address is, in a word, for the trail sheet
const TL_KIND = { color: "Color", name: "Color", painting: "Painting", gallery: "Painting", painter: "Painter", painters: "Painters",
  movement: "Movement", decade: "Decade", country: "Country", arthistory: "Art history", hub: "Color family", which: "Which is which",
  pair: "A pair in paintings", "paintings-of": "In paintings", chords: "Masters' chords", look: "Look", fashion: "Fashion", gem: "Gems",
  botany: "Flowers and plants", poem: "Poem", passage: "Passage", film: "Film", photo: "Your photo", page: "Page", story: "Story",
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
  if (typeof SHOT !== "undefined" && SHOT) { tlDecorate(el); return; }
  // a loading placeholder (loader.js waitScreen): the real screen it stands in for is the one that joins the trail
  if (el.classList.contains("waiting")) { TL_CALL = call; return; }
  if (TL_KEEP) { if (performance.now() - TL_KEEP.t < 4000) { XSTACK = TL_KEEP.stack; X_ROOT = TL_KEEP.root; } TL_KEEP = null; }
  if (!TL_BOOTED) { TL_BOOTED = true; tlRestore(); }
  // a room or the map is where a trail starts: nothing behind it
  if (tab || el.classList.contains("hm")) { XSTACK = []; TL_PREV = ""; tlSave(); return; }
  const back = tlBackBtn(el);
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

// ---------- the second control: the map glyph, top-right, beside whatever the header already holds ----------
function tlDecorate(el) {
  const back = tlBackBtn(el);
  if (!back || el.querySelector("[data-tl-exit]") || document.documentElement.classList.contains("booth") || el.classList.contains("hm")) return;
  const html = `<button class="${esc(back.className)} tl-exit" data-tl-exit aria-label="Back to the map">${HOME_GLYPH}</button>`;
  const nav = back.closest(".nav-top");
  if (back.classList.contains("cp-close")) back.insertAdjacentHTML("afterend", html);   // a full-bleed hero: mirrored on the right
  else if (nav && nav.querySelector(".nav-r")) nav.querySelector(".nav-r").insertAdjacentHTML("beforeend", html);
  else {
    const hd = back.parentElement, last = hd.lastElementChild;
    // an empty spacer that only balanced the header gives its place to the glyph
    if (last && last !== back && last.tagName === "SPAN" && !last.children.length && !last.textContent.trim()) last.outerHTML = html;
    else hd.insertAdjacentHTML("beforeend", html);
    hd.classList.add("tl-x");
  }
  back.setAttribute("aria-description", "Hold to see your trail");
  // pull down from the top: back to where this trail started (not on full-screen tools, whose drags are their own)
  if (!el.classList.contains("fixed") && typeof hmPullClose === "function") hmPullClose(el, tlToOrigin);
}

// ---------- going back, jumping, exiting ----------
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
  XSTACK = []; X_ROOT = null;
  const scr = app.querySelector(".screen"), home = () => typeof hmHome === "function" ? hmHome() : go(S.tab || "learn");
  if (scr && btn && btn.isConnected) shrinkTo(scr, btn, home); else home();
}
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
const tlRow = (k, m, sub, here) => `<li><button class="tl-row${here ? " here" : ""}" data-tl-go="${k}"${here ? ' aria-current="page"' : ""}>${tlThumb(m)}<span class="tl-txt"><b>${esc(m.title || "A page")}</b><em>${esc(sub)}</em></span>${here ? "" : ICON.chev}</button></li>`;
function tlSheet() {
  if (document.querySelector(".sheet")) return;
  buzz(8);
  const scr = app.querySelector(".screen"), onTrail = !!(scr && scr.dataset.tl);
  const rows = [];
  if (!onTrail && scr) rows.push(tlRow("none", tlCapture(scr), "You're here", true));
  for (let i = XSTACK.length - 1; i >= 0; i--) {
    const tok = XSTACK[i], m = TL_META.get(tok) || { title: "A page you opened" };
    const here = onTrail && i === XSTACK.length - 1;
    rows.push(tlRow(i, m, here ? `${tlKind(m.hash)} · You're here` : tlKind(m.hash), here));
  }
  // the foot: where this trail started, then the map itself if that wasn't it
  const fromMap = X_ROOT === "home", room = xFallbackTab(), roomName = (ROOMS_LIST.find(r => r[0] === room) || [, "Learn"])[1];
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
