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
//  - Close doesn't destroy the chain, just forgets it from the live trail's point of view: it's stashed as
//    TL_RECENT, offered back as a small "Back to…" pill on the very next map draw (tlRecentPill, ~8s or until a
//    pan) and afterwards as "Your last trail" in the long-press sheet, until a new trail replaces it.
//  - The trail lives in sessionStorage, so a reload keeps it.
// core.js show() calls tlNote() for every screen; router.js routeWrap() calls tlCallNote() for every addressed one.

const TL_META = new Map();     // trail token -> { hash, title, img, c, sw }
const TL_REPLAY = new Map();   // "r:" token -> the call that drew it
let TL_CALL = null;            // the addressed screen call in progress: { run, t }
let TL_PREV = "";              // the trail as it stood at the previous screen
let TL_KEEP = null;            // a replay that must not lose the trail behind it: { stack, root, t }
let TL_MAPKEEP = null;         // a page lit its colors on the map (csOnMap): the trail stays behind the map so the lit set can return: { stack, root, t }
// David, 2026-10-09: "don't lose all my progress just because I [explicitly closed]." tlExit() (✕ "Close", the
// map glyph on an ordinary page) still forgets the chain outright -- the browser/iOS Back staying on the map
// after it is deliberate and already relied on (see TL_FORGOT below) -- but it no longer destroys it silently:
// the chain is stashed here first, one at a time, offered back as a pill on the very next map draw (tlRecentPill)
// and, afterwards, as "Your last trail" in the long-press sheet (tlSheet), until a genuinely new trail replaces it.
let TL_RECENT = null;          // { stack, root, meta: [[tok,metaObj]...], scroll: [[hash,y]...], title, img, c, sw, t }
let TL_SUPPRESS = 0;           // the click that ends a long press must not also go back
let TL_BOOTED = false;
const TL_KEY = "colorhub-trail", TL_RECENT_KEY = "colorhub-trail-recent";
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
  const h1 = el.querySelector("h1"), title = (h1 && h1.textContent.trim().replace(/\s+/g, " ")) || document.title.replace(/ · Chromatlas$/, "");
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
// the stashed "last trail" (tlExit): sessionStorage is cheap enough to make it survive a reload too, same as the
// live trail above -- try/catch throughout, since losing this is never worse than the Close it came from
function tlRecentSave() {
  try { if (TL_RECENT) sessionStorage.setItem(TL_RECENT_KEY, JSON.stringify(TL_RECENT)); else sessionStorage.removeItem(TL_RECENT_KEY); } catch (e) {}
}
function tlRecentRestore() {
  try { const raw = sessionStorage.getItem(TL_RECENT_KEY); if (raw) TL_RECENT = JSON.parse(raw); } catch (e) {}
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
  if (!TL_BOOTED) { TL_BOOTED = true; tlRestore(); tlRecentRestore(); }
  // the map opened BY a page (a painting's colors lit on it): the trail stays, so the lit set can go back to its source
  if (el.classList.contains("hm") && TL_MAPKEEP) {
    const k = TL_MAPKEEP; TL_MAPKEEP = null;
    if (performance.now() - k.t < 4000 && k.stack.length) { XSTACK = k.stack; X_ROOT = k.root; TL_UNDER = null; TL_PREV = ""; tlSave(); return; }
  }
  // a room or the map is where a trail starts: nothing behind it, and it's where the trail returns when it runs out
  if (tab || el.classList.contains("hm")) {
    XSTACK = []; X_ROOT = tab || "home"; TL_UNDER = null; TL_PREV = ""; tlSave();
    // the pill (David, 2026-10-09): only on the very next map draw after an explicit Close stashed one -- not
    // every later visit to the map while it's still sitting there waiting in the trail sheet
    if (el.classList.contains("hm") && TL_RECENT && performance.now() - TL_RECENT.t < 1500) tlRecentPill(el);
    // first-run orientation, steps 1 and 3 (PLAN §5, js/orient.js): the live map, first time and again later
    if (el.classList.contains("hm") && typeof orientMapStep === "function") orientMapStep(el);
    return;
  }
  const back = tlBackBtn(el);
  // a genuinely new trail has started: not just glancing at one fresh page from the map (extremely common, and
  // tossing the stash the instant that happens would make "stays reachable" nearly worthless), but a second step
  // taken on a path that isn't the stashed one -- tlResumeRecent() always leaves XSTACK identical to what it
  // resumed, so this really is the reader building something new, not tapping back into the old chain
  if (TL_RECENT && XSTACK.length > 1 && XSTACK.join("\n") !== TL_RECENT.stack.slice(0, XSTACK.length).join("\n")) { TL_RECENT = null; tlRecentSave(); }
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

// ---------- the one top bar (PLAN §3.5, §9): "‹ <previous page>" · ⋯ · the place pill ----------
// the route's first path segment, for moreRegister/moreOpen keys (places.js) -- "color", "painting", "gallery"...
function tlRouteKind() { return (ROUTE_NOW || "").replace(/^#\//, "").split(/[/?]/)[0] || "page"; }
const tlRoomLabel = room => (ROOMS_LIST.find(r => r[0] === room) || [, NAV.learn])[1];
// where ‹ ultimately lands when the trail runs out, named -- the same destination the place pill closes to
function tlOriginName() { const room = xFallbackTab(); return room ? tlRoomLabel(room) : NAV_MAP; }
const TL_TRUNC = s => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > 14 ? s.slice(0, 13).trimEnd() + "…" : s; };
// the previous page's title, for ‹'s own label (PLAN §3.5: "‹ Periwinkle")
function tlBackLabel() {
  if (XSTACK.length >= 2) { const m = tlMetaFor(XSTACK[XSTACK.length - 2]); if (m && m.title) return /^untitled\b/i.test(m.title.trim()) ? "" : TL_TRUNC(m.title); }   // a page with no real title: just the chevron
  return TL_TRUNC(tlOriginName());
}
// the icon for the place ‹ ultimately leads to, and the place pill names (core.js ICON keys)
const TL_ROOM_ICON = { learn: "learn", gym: "train", explore: "museum", studio: "palette" };
function tlOriginIcon() { const room = xFallbackTab(); return ICON[TL_ROOM_ICON[room] || "map"] || ICON.map; }
// "The bar never shows two buttons that do the same thing" (PLAN §3.5/rule 8): when the current page is the
// first (or only) step on the trail, ‹ already lands on the same place the pill would close to, so it hides.
const tlPillHides = () => XSTACK.length <= 1;
const tlPillHTML = (cls = "") => `<button class="tl-exit${cls ? " " + cls : ""}" data-tl-exit aria-label="${esc(tlOriginName())}: close back to where you started">${tlOriginIcon()}<span>${esc(tlOriginName())}</span></button>`;
const TL_MORE_HTML = `<button class="tl-more" data-tl-more aria-label="More">${ICON.more}</button>`;
// the map reached by the place pill: the chain behind it is forgotten, so Back (the browser's, the iOS swipe) stays on the map
// instead of walking into it again (core.js popstate asks tlForgot)
let TL_FORGOT = false;
const tlForgot = () => TL_FORGOT && !!app.querySelector(".screen.hm");
function tlDecorate(el) {
  const back = tlBackBtn(el);
  if (!back || el.querySelector("[data-tl-exit],[data-tl-more]") || document.documentElement.classList.contains("booth") || el.classList.contains("hm")) return;
  const nav = back.closest(".nav-top");
  const bar = el.querySelector(".rp-bar");
  const hd = back.parentElement;
  // an ad-hoc header that already carries its own button (a painter page's "Compare", Art's "Surprise me"...)
  // has no reserved room for more: it keeps just the place pill, today's exact footprint, until Lane 4 moves
  // that button into the page's own action row (PLAN §3.5/§4) and frees the bar up for the rest too. A bare
  // ad-hoc header (back alone) has the room, same as a .nav-top with its reserved .nav-r. One exception: a
  // [data-fva] heart (David, relayed 2026-10-10: "make the heart on any painting much closer up... visible
  // without scrolling" -- js/favs.js fvArtHeart on the painting page) is one of the bar's allowed slots, same
  // as the color page's own hero heart -- it doesn't make the header "crowded" on its own.
  const heartSlot = hd.querySelector(":scope > [data-fva]");
  const crowded = !nav && !bar && !back.classList.contains("cp-close") && hd.children.length > (heartSlot ? 2 : 1);
  // the named ‹ (PLAN §3.5): a small label beside the chevron, only where there's reserved or spare room --
  // CSS-only (css/trail.css [data-back]:has(.tl-back-label)), so it works the same in every header shape
  // without any of those headers' own files changing. A crowded ad-hoc header, a float over a full-bleed hero
  // or the pinned color bar keep the icon alone; its aria-label still names the destination either way.
  const roomy = (nav && nav.querySelector(".nav-r")) || (!nav && !bar && !back.classList.contains("cp-close") && !crowded);
  if (roomy && tlBackLabel() && !back.querySelector(".tl-back-label")) back.insertAdjacentHTML("beforeend", `<span class="tl-back-label">${esc(tlBackLabel())}</span>`);
  back.setAttribute("aria-label", tlBackLabel() ? `Back to ${esc(tlBackLabel())}` : "Back");
  // a painting page (David, 2026-10-20): the top-right pill opens the painting map arranged around THIS painting
  // ("Similar") instead of closing back to the color map; Back, the pull-down and the trail sheet still go home
  const simGi = el.querySelector("[data-similar-gi]") ? el.querySelector("[data-similar-gi]").dataset.similarGi : null;
  const pillHtml = simGi != null && typeof GL_ICON_MAP !== "undefined"
    ? `<button class="tl-exit" data-glsimilar="${simGi}" aria-label="Similar paintings on the map">${GL_ICON_MAP}<span>Similar</span></button>`
    : tlPillHides() ? "" : tlPillHTML();
  const bothHtml = TL_MORE_HTML + pillHtml;
  // a richpage.js page carries BOTH headers at once (the full-bleed .cp-hero and the pinned .rp-bar that slides
  // in once you scroll past it) -- not an either/or, so this stays two independent checks, same as the Close
  // pill did before it (merging them into one if/else-if was the bug that silently dropped the cp-hero copy).
  if (bar && !bar.querySelector("[data-tl-exit],[data-tl-more]")) bar.querySelector(".rp-bar-name").insertAdjacentHTML("afterend", TL_MORE_HTML.replace('class="tl-more"', 'class="tl-more tl-more-bar"') + (pillHtml ? tlPillHTML("tl-exit-bar") : ""));
  if (back.classList.contains("cp-close")) back.insertAdjacentHTML("afterend", TL_MORE_HTML.replace('class="tl-more"', 'class="tl-more tl-more-float"') + (pillHtml ? tlPillHTML("tl-exit-float") : ""));
  else if (nav && nav.querySelector(".nav-r")) nav.querySelector(".nav-r").insertAdjacentHTML("beforeend", bothHtml);
  else {
    const last = hd.lastElementChild, addHtml = crowded ? pillHtml : bothHtml;
    if (addHtml) {
      // an empty spacer that only balanced the header gives its place to the new controls
      if (last && last !== back && last.tagName === "SPAN" && !last.children.length && !last.textContent.trim()) last.outerHTML = addHtml;
      else hd.insertAdjacentHTML("beforeend", addHtml);
    }
    hd.classList.add("tl-x");
  }
  back.setAttribute("aria-description", "Hold to see your trail");
  el.querySelectorAll("[data-tl-more]").forEach(b => { if (b._tlWired) return; b._tlWired = true; b.onclick = e => { e.stopPropagation(); if (typeof moreOpen === "function") moreOpen(tlRouteKind()); }; });
  // pull down from the top, or swipe back from the left edge: pull-down now closes the whole pile, like the
  // place pill (PLAN §3.5); the edge swipe stays one step back, like ‹ -- js/trail.js's own gesture, tlgWire below
  if (!el.classList.contains("fixed")) tlgWire(el);
  // first-run orientation, step 2 (PLAN §5, js/orient.js): the first page opened off the map
  if (typeof orientPageStep === "function") orientPageStep(el);
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
// where releasing this gesture lands. The edge swipe (axis "x") is ‹: exactly what the back button already
// does (xBack if this page is on the trail, tlToOrigin otherwise). The pull-down (axis "y") is now the place
// pill (PLAN §3.5: "a pull-down from the top of the page does the same" as the pill -- closes the whole pile,
// not one step), via tlExit so it also stashes "Pick up where you left off" the same way a tap on the pill
// would. Either way, `toMap` says whether that's the map, the one case worth a real backdrop (tlgFloor). A page
// opened straight from the map still joins the trail as its own one-entry "r:" token (js/trail.js tlNote), so
// xBack() on it pops that single entry and lands on the origin anyway -- reachesOrigin covers that case too,
// not just the no-trail one.
function tlgDest(el, axis) {
  // a painting page (David, 2026-10-25, Pinterest): the pull-down closes ONE step, back to the page it was opened from (the list, same tab and
  // tile via FD_MEMO); the jump to the origin lives on in a long-press on ‹ and the trail sheet
  if (axis === "y" && el.classList.contains("gl-page")) axis = "x";
  if (axis === "y") {
    // David, 2026-10-20: a painting opened from the PAINTING map pulls down back to that painting map, where you left
    // it (its pan is kept in PM_PAN), not all the way out to the color map; any other trail closes to its origin as before
    let pm = -1;
    for (let k = XSTACK.length - 2; k >= 0; k--) if (String(XSTACK[k]).startsWith("r:paintings/map")) { pm = k; break; }
    if (pm >= 0) return { toMap: false, go: () => tlJump(pm) };
    const toMap = !xFallbackTab(); return { toMap, go: () => tlExit(null) };
  }
  const onTrail = !!el.dataset.tl, reachesOrigin = !onTrail || XSTACK.length <= 1, toMap = reachesOrigin && !xFallbackTab();
  return { toMap, go: () => { if (onTrail) xBack(); else tlToOrigin(); } };
}
// The screen a painting page replaced, kept alive (detached) so a pull-down shows the real page underneath, exactly as left (David, 2026-10-25:
// "behind it should not be a black screen but the actual page that was before"). core.js show() calls tlgStash for every screen; only ONE is
// ever held, and it is let go as soon as the next non-painting screen is drawn. A swipe to the next painting replaces the page but not what is
// underneath (TLG_KEEP_PREV), so the backdrop stays the list you came from.
let TLG_PREV = null, TLG_KEEP_PREV = false, TLG_HOLD = null;
// the map's last frame, taken as it is left (its canvas is torn down by the screen swap); null for any other screen
function tlgLeavingMap() { const o = typeof app !== "undefined" && app.firstElementChild; return o && o.classList.contains("hm") ? tlgSnapshot() : null; }
function tlgStash(old, top, hash, el, mapImg, sy) {
  if (TLG_KEEP_PREV) return;
  if (!el || !el.classList.contains("gl-page")) { TLG_PREV = null; return; }
  if (old && old.classList.contains("hm")) { TLG_PREV = { map: true, img: mapImg || null }; return; }   // the color map: its last drawn frame is the backdrop (tlgBackdrop)
  if (!old || old === el || (old.classList.contains("fixed") && !old.classList.contains("pmx"))) { TLG_PREV = null; return; }   // (the painting map is fixed too, but its canvas keeps its last frame)
  if (old.classList.contains("gl-page") && hash === ROUTE_NOW) return;   // the same painting redrawn: what was under it is still under it
  TLG_PREV = { el: old, y: top || 0, sy: sy || 0 };
}
// mounts the held screen as a fixed layer behind #app (z-index:1), scrolled to where it was left, dimmed a little until the page leaves
// what sits under a dragged page: for a painting page the map's frame, or the screen it replaced (the layer); else the old floor
function tlgBackdrop(el, dest) {
  const p = el.classList.contains("gl-page") ? TLG_PREV : null;
  if (p && p.map) return tlgFloor(true, p.img);
  if (p && p.el && (!dest.toMap || !tlgSnapshot())) { const l = tlgPrevLayer(); if (l) return l; }
  return tlgFloor(dest.toMap);
}
function tlgPrevLayer() {
  const p = TLG_PREV; if (!p || !p.el) return null;
  const d = document.createElement("div"), dim = document.createElement("i");
  d.className = "tlg-back"; dim.className = "tlg-dim";
  p.el.style.animation = "none";
  d.appendChild(p.el); d.appendChild(dim); d._dim = dim;
  document.body.insertBefore(d, document.getElementById("app"));
  d.scrollTop = p.y;
  const sc = p.sy ? p.el.querySelector && p.el.querySelector(".screen") : null; if (sc) sc.scrollTop = p.sy;   // the room's own screen, back where it was
  return d;
}
function tlgDropLayer(layer, soft) {
  if (TLG_HOLD === layer) TLG_HOLD = null;
  if (!layer || !layer.isConnected) return;
  if (!soft || reduceMotion) return layer.remove();
  try { layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-out" }).onfinish = () => layer.remove(); } catch (e) { layer.remove(); }
  setTimeout(() => layer.remove(), 400);
}
// after a commit the real page is drawn under the layer (its scroll comes back a frame or two later): let the layer go once it has
function tlgLetGo(layer, el) {
  let n = 0;
  const tick = () => { if (++n < 4 || (el.isConnected && n < 60)) return requestAnimationFrame(tick); tlgDropLayer(layer, true); };
  requestAnimationFrame(tick);
}
function tlgCommit(dest) {
  TLG_SKIP = true;
  try { dest.go(); } finally { TLG_SKIP = false; }
}
function tlgFloor(toMap, snap) {
  const d = document.createElement("div");
  d.className = "tlg-floor";
  const img = snap || (toMap && tlgSnapshot());
  if (img) { d.style.backgroundImage = `url(${img})`; d.classList.add("tlg-floor-img"); }
  document.body.appendChild(d);
  return d;
}
// Painting pull-down, the whole motion (David, 2026-10-25, second pass: "the IMAGE of the painting follows the finger while the REST FADES AWAY"): the
// picture alone follows the finger (a copy of it, fixed above everything: .tlg-pic, 1:1 on y, half on x, shrinking and rounding as it goes) while the
// whole page behind it fades out in the first ~80px with ONE compositor opacity on the page element and a see-through ground, so the screen it came
// from shows through and brightens. On release it flies into the tile it was opened from and minimizes into it; before the threshold it springs back
// and the page fades back in. Everything heavy is set ONCE when the drag is armed (tlgArm); each move is one rAF that writes the picture's transform,
// the page's opacity and the dim; the tile's rectangle is measured once (tlgTile), never while moving.
const TLG_FLY = 300, TLG_COMMIT_D = 90, TLG_R = 24, TLG_FADE_D = 80;
function tlgScale(d) { return 1 - .15 * Math.min(1, d / 250); }
function tlgRad(d) { return 2 + (TLG_R - 2) * Math.min(1, d / 150); }
function tlgXf(d, dx) { return `translate(${(dx * .5).toFixed(1)}px,${d.toFixed(1)}px) scale(${tlgScale(d).toFixed(4)})`; }
function tlgArm(el) {
  const s = el.style, sp = el.querySelector(".gl-hero > span"), im = sp && sp.querySelector("img");
  // the page is clipped to one screen (it is at the top: only the first screen can show), so the opacity layer stays small; its ground is see-through
  s.willChange = "opacity"; s.height = s.minHeight = s.maxHeight = innerHeight + "px"; s.overflow = "hidden"; s.background = "transparent"; s.transition = "none";
  el.classList.add("tlg-armed");   // css: the real picture is hidden (the copy replaces it), its frame goes clear
  if (!sp) return;
  const r = sp.getBoundingClientRect(), pic = document.createElement("div");
  pic.className = "tlg-pic";
  pic.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:${getComputedStyle(sp).backgroundColor};border-radius:2px`;
  if (im) { const c = im.cloneNode(false); if (im.currentSrc) c.src = im.currentSrc; pic.appendChild(c); }
  document.body.appendChild(pic);
  el._tlgPic = pic; el._tlgR = { x: r.left, y: r.top, w: r.width, h: r.height };
}
function tlgDisarm(el) {
  const s = el.style;
  if (el._tlgPic) { el._tlgPic.remove(); el._tlgPic = null; }
  el.classList.remove("tlg-armed");
  s.transition = ""; s.transform = ""; s.willChange = ""; s.borderRadius = ""; s.background = ""; s.overflow = ""; s.opacity = ""; s.height = s.minHeight = s.maxHeight = ""; s.transformOrigin = "";
}
// one frame of a painting pull: the copy of the picture under the finger, the page fading, the page underneath lifting its dim
function tlgPaintGl(el, a) {
  a.raf = 0;
  const pic = el._tlgPic, d = Math.max(0, a.d || 0);
  if (pic) { pic.style.transform = tlgXf(d, a.dx || 0); pic.style.borderRadius = tlgRad(d).toFixed(1) + "px"; }
  el.style.opacity = Math.max(0, 1 - d / TLG_FADE_D).toFixed(3);
  if (a.floor && a.floor._dim) a.floor._dim.style.opacity = (.14 * (1 - Math.min(1, d / 120))).toFixed(3);
}
// the rectangle of the painting's tile in the kept page underneath (one layout read, at arm time); null when it is not on screen there
function tlgTile(layer) {
  const m = /\/gallery\/(\d+)/.exec(location.hash || ""); if (!m || !layer || !layer.querySelector) return null;
  const t = layer.querySelector(`[data-gi="${m[1]}"]`); if (!t) return null;
  const r = t.getBoundingClientRect(), H = innerHeight;
  if (r.width < 8 || r.height < 8 || r.bottom < 24 || r.top > H - 24 || r.right < 0 || r.left > innerWidth) return null;
  const im = t.querySelector("img"), src = im && im.complete && im.naturalWidth ? (im.currentSrc || im.src) : "";
  return { x: r.left, y: r.top, w: r.width, h: r.height, src, rad: parseFloat(getComputedStyle(t).borderTopLeftRadius) || 6, node: t };
}
// the flight: the picture runs on from where the finger let go to the tile's centre at the tile's width and rounds to its corners while it fades; the
// tile's thumbnail (an overlay at the tile's rectangle) fades in over it, so the picture seems to shrink into the tile. No tile on screen: it shrinks
// toward the top-centre and fades. The page itself (already nearly gone) finishes fading.
function tlgFly(el, a, tile) {
  const W = innerWidth, pic = el._tlgPic, r = el._tlgR || { x: 0, y: 0, w: W, h: W }, d = Math.max(0, a.d || 0);
  let sc, cx, cy, ov = null, rad = 8;
  if (tile) { sc = Math.max(.1, Math.min(.6, tile.w / r.w)); cx = tile.x + tile.w / 2; cy = tile.y + tile.h / 2; rad = tile.rad / sc; }
  else { sc = .3; cx = W / 2; cy = innerHeight * .28; }
  const to = `translate(${(cx - (r.x + r.w / 2)).toFixed(1)}px,${(cy - (r.y + r.h / 2)).toFixed(1)}px) scale(${sc.toFixed(4)})`;
  if (tile && tile.src) {
    ov = document.createElement("div");
    ov.style.cssText = `position:fixed;left:${tile.x}px;top:${tile.y}px;width:${tile.w}px;height:${tile.h}px;border-radius:${tile.rad}px;background:#222 center/cover url("${tile.src.replace(/"/g, "%22")}");z-index:100000;pointer-events:none;opacity:0;will-change:opacity`;
    document.body.appendChild(ov);
    try { ov.animate([{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1 }], { duration: TLG_FLY, easing: "linear", fill: "forwards" }); } catch (e) { ov.style.opacity = 1; }
  }
  el.style.transition = "none";
  try { el.animate([{ opacity: +el.style.opacity || 0 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" }); } catch (e) { el.style.opacity = 0; }
  const from = tlgXf(d, a.dx || 0);
  const anim = pic
    ? pic.animate([{ transform: from, borderRadius: tlgRad(d) + "px", opacity: 1 }, { opacity: 1, offset: .55 }, { transform: to, borderRadius: rad + "px", opacity: ov ? 0 : 0 }], { duration: TLG_FLY, easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" })
    : el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: TLG_FLY, fill: "forwards" });
  return { anim, ov };
}
function tlgWire(el) {
  if (!el || reduceMotion) return;
  const born = performance.now(), blocked = e => e.target.closest && e.target.closest("canvas,input,textarea,select,[data-nopull]");
  let lastScroll = 0;
  const onScroll = () => { lastScroll = performance.now(); if (!el.isConnected) removeEventListener("scroll", onScroll); };
  addEventListener("scroll", onScroll, { passive: true, capture: true });
  let a = null;   // the live gesture: { id, axis, x0, y0, dest, floor, anim, touch }
  const isLayer = f => !!(f && f.classList.contains("tlg-back"));
  const dropFloor = f => { if (isLayer(f)) tlgDropLayer(f); else f.remove(); };
  const isGl = el.classList.contains("gl-page");
  // the floor under a dragged page: for a painting page the real screen it was opened from (kept by tlgStash), unless that is the map (its
  // last frame is the better, cheaper picture) or nothing was kept; otherwise the map's frame / a calm ground
  const prep = () => {
    if (a.floor) return;
    a.dest = tlgDest(el, a.axis || "y");
    a.floor = tlgBackdrop(el, a.dest);
    if (isGl && a.vertOK) { tlgArm(el); a.tile = isLayer(a.floor) ? tlgTile(a.floor) : null;
      if (a.tile && a.tile.node) a.tile.node.style.visibility = "hidden";   // the spot is empty (just the ground) until the picture flies into it: no second copy of it in the list
      a.paint = () => tlgPaintGl(el, a); }
  };
  const clean = () => {
    if (a && a.floor) dropFloor(a.floor);
    if (a && a.anim) { try { a.anim.cancel(); } catch (e) {} if (TLG_ANIM === a.anim) TLG_ANIM = null; }
    if (a && a.raf) cancelAnimationFrame(a.raf);
    if (a && a.ov) a.ov.remove();
    tlgDisarm(el);
    a = null;
  };
  // ---- the gesture proper, fed by pointer events (mouse, pen, scripted) or by touch events (a real finger; see below) ----
  const down = (id, x, y, target, isPrimary) => {
    if (!isPrimary || a || document.querySelector(".sheet") || performance.now() - born < TLG_BORN || blocked({ target })) return false;
    const vertOK = pageScrollTop() <= 0 && performance.now() - lastScroll >= TLG_REST, horizOK = x < TLG_EDGE;
    if (!vertOK && !horizOK) return false;
    a = { id, x0: x, y0: y, axis: null, vertOK, horizOK, lastX: x, lastY: y, lastT: performance.now(), vx: 0, vy: 0, floor: null, anim: null, touch: false };
    return true;
  };
  const move = (x, y, e) => {
    const dx = x - a.x0, dy = y - a.y0;
    if (!a.axis) {
      // the backdrop is mounted a few pixels before the lock, so the very first frame of the drag already has the page underneath
      if (a.vertOK && !a.floor && dy > 3 && dy > Math.abs(dx) && isGl) prep();
      if (a.horizOK && dx > TLG_SLOP && dx > Math.abs(dy) * 1.6) a.axis = "x";
      else if (a.vertOK && dy > TLG_SLOP && dy > Math.abs(dx) * 1.6 && pageScrollTop() <= 0) a.axis = "y";
      else { if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clean(); return; }
      a.dest = tlgDest(el, a.axis);
      if (!a.floor) a.floor = a.axis === "y" ? tlgBackdrop(el, a.dest) : tlgFloor(a.dest.toMap);
      if (!a.paint) el.style.willChange = "transform";
      if (!a.touch) { try { el.setPointerCapture(a.id); } catch (er) {} }
    }
    if (e && e.cancelable) e.preventDefault();
    const now = performance.now(), dt = Math.max(1, now - a.lastT);
    const d = a.axis === "x" ? dx : dy, resisted = Math.max(0, d < 80 ? d * .55 : 44 + (d - 80) * .35);
    if (a.axis === "y" && a.paint) {   // one rAF per frame writes the picture, the fade and the dim; nothing else here touches the page
      a.d = d; a.dx = dx; if (!a.raf) a.raf = requestAnimationFrame(a.paint);
    } else {
      el.style.transition = "none";
      el.style.transform = a.axis === "x" ? `translateX(${resisted}px)` : `translateY(${resisted}px)`;
    }
    const v = ((a.axis === "x" ? x - a.lastX : y - a.lastY)) / dt;
    if (a.axis === "x") a.vx = v; else a.vy = v;
    a.lastX = x; a.lastY = y; a.lastT = now; a.d = d; a.dx = dx; a.resisted = resisted;
  };
  const release = (cancelled) => {
    if (!a) return;
    if (!a.axis) { if (a.floor) dropFloor(a.floor); if (a.raf) cancelAnimationFrame(a.raf); tlgDisarm(el); a = null; return; }
    const gl = !!a.paint, v = a.axis === "x" ? a.vx : a.vy, past = !cancelled && ((a.d || 0) > (gl ? TLG_COMMIT_D : TLG_PULL) || v > TLG_FLING), dest = a.dest, floor = a.floor;
    if (a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; }
    if (gl) tlgPaintGl(el, a);
    const final = a.axis === "x" ? `translateX(${innerWidth + 60}px)` : `translateY(${innerHeight * .7 + 60}px)`;
    if (past) {
      el.style.transition = "none";
      let fly = null;
      if (gl) { fly = tlgFly(el, a, a.tile); a.anim = TLG_ANIM = fly.anim; }
      else {
        const remaining = (a.axis === "x" ? innerWidth - a.resisted : innerHeight * .7 - a.resisted);
        const dur = Math.min(TLG_CAP, Math.max(120, remaining / Math.max(v, .35)));
        a.anim = TLG_ANIM = el.animate([{ transform: el.style.transform || "none" }, { transform: final }], { duration: dur, easing: "linear", fill: "forwards" });
      }
      const ov = fly && fly.ov, pic = el._tlgPic;
      // something else (a native back winning a race against our own tracking -- iOS doesn't reliably send a pointerup/pointercancel once it's
      // claimed the touch) may already have navigated and redrawn the screen while this animation was still running: el is this gesture's own
      // page, so if it's no longer in the document, that already happened. Committing anyway would double the back, so there is nothing to finish.
      const gone = () => { if (pic) pic.remove(); if (ov) { try { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out" }).onfinish = () => ov.remove(); } catch (er) {} setTimeout(() => ov.remove(), 600); } };
      a.anim.onfinish = () => {
        TLG_ANIM = null;
        if (isLayer(floor)) { if (el.isConnected) { TLG_HOLD = floor; tlgCommit(dest); tlgLetGo(floor, el); } else tlgDropLayer(floor); gone(); return; }
        floor.remove(); if (el.isConnected) tlgCommit(dest); gone();
      };
    } else if (gl) {
      // back to its place: the picture springs home, the page fades back in
      const pic = el._tlgPic, t = `${TLG_SPRING}ms var(--spring)`;
      if (pic) { pic.style.transition = `transform ${t}, border-radius ${t}`; pic.style.transform = "translate(0,0) scale(1)"; pic.style.borderRadius = "2px"; }
      el.style.transition = `opacity ${Math.min(TLG_SPRING, 200)}ms ease-out`; el.style.opacity = "1";
      if (floor && floor._dim) { floor._dim.style.transition = `opacity ${TLG_SPRING}ms ease-out`; floor._dim.style.opacity = ".14"; }
      setTimeout(() => { if (floor) dropFloor(floor); tlgDisarm(el); }, TLG_SPRING + 20);
    } else {
      el.style.transition = `transform ${TLG_SPRING}ms var(--spring)`;
      el.style.transform = "translate(0,0)";
      if (floor && floor._dim) floor._dim.style.opacity = ".14";
      setTimeout(() => { if (floor) dropFloor(floor); tlgDisarm(el); }, TLG_SPRING + 20);
    }
    a = null;
  };
  el.addEventListener("pointerdown", e => { down(e.pointerId, e.clientX, e.clientY, e.target, e.isPrimary); }, { passive: true });
  el.addEventListener("pointermove", e => { if (a && !a.touch && e.pointerId === a.id) move(e.clientX, e.clientY, e); }, { passive: false });
  el.addEventListener("pointerup", e => { if (a && !a.touch && e.pointerId === a.id) release(false); });
  // pointercancel: with a finger the browser sends it as it takes the drag for its own scroll; the touch events below keep driving the gesture
  el.addEventListener("pointercancel", () => { if (a && !a.touch) clean(); });
  el.addEventListener("lostpointercapture", e => { if (a && !a.touch && a.id === e.pointerId && a.axis) release(false); });
  // A real finger (iOS Safari above all) takes a downward drag at the top of the page for its own scroll / rubber band and then CANCELS the pointer
  // events, so the pointer path alone never followed the finger. Touch events are not cancelled that way, and calling preventDefault on the first
  // downward touchmoves (nothing to scroll there anyway) keeps the drag ours. Once a touch has started, it alone drives the gesture; scripted /
  // mouse pointers (no touch events) keep the pointer path above.
  let tid = null;
  el.addEventListener("touchstart", e => {
    if (e.touches.length > 1) { if (a && a.touch) clean(); tid = null; return; }
    if (!a || a.touch) return;
    const t = e.touches[0]; tid = t.identifier; a.touch = true; a.x0 = t.clientX; a.y0 = t.clientY; a.lastX = t.clientX; a.lastY = t.clientY;
  }, { passive: true });
  el.addEventListener("touchmove", e => {
    if (!a || !a.touch || e.touches.length !== 1) return;
    const t = e.touches[0]; if (t.identifier !== tid) return;
    const dx = t.clientX - a.x0, dy = t.clientY - a.y0;
    // claim a downward (or edge) drag from its first pixels, before the browser commits to scrolling; an upward or sideways one is left alone
    if (!a.axis && !(a.vertOK && dy > 2 && dy > Math.abs(dx) && pageScrollTop() <= 0) && !(a.horizOK && dx > 2 && dx > Math.abs(dy))) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clean();
      return;
    }
    move(t.clientX, t.clientY, e);
  }, { passive: false });
  const tend = cancelled => () => { if (a && a.touch) { tid = null; release(cancelled); } };
  el.addEventListener("touchend", tend(false));
  el.addEventListener("touchcancel", tend(true));
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
// the pill (David, 2026-10-09): "Back to <last page>", bottom-left, directly above the Rooms corner -- the one
// map draw right after an explicit Close stashed TL_RECENT. A real pan (pointerdown + real movement, anywhere
// but the pill itself) or ~8s of nobody touching it ends it early; tapping it resumes the whole stashed trail.
// It's a child of the map screen itself (el), not document.body, so a plain screen swap (opening anything else)
// clears it for free -- same reason js/honey.js's own cs-hl-pill lives there instead of being position:fixed
// (css/menus2.css's own containing-block note on .screen's entrance animation applies here too).
const TL_PILL_MS = 8000;
function tlRecentPill(el) {
  const r = TL_RECENT; if (!r || !r.stack.length || el.querySelector(".tl-recent-pill")) return;
  const title = r.title || tlMetaFor(r.stack[r.stack.length - 1]).title || "your last page";
  const btn = document.createElement("button");
  btn.className = "tl-recent-pill";
  btn.setAttribute("aria-label", `Back to ${title}`);
  btn.innerHTML = `${ICON.back}${tlThumb({ img: r.img, c: r.c, sw: r.sw })}<span class="tl-recent-txt">Back to <b>${esc(title)}</b></span>`;
  el.appendChild(btn);
  let gone = false;
  const clean = () => {
    el.removeEventListener("pointerdown", onDown, true);
    removeEventListener("pointermove", onMove, true);
    removeEventListener("pointerup", onUp, true);
    clearTimeout(timer);
  };
  const remove = () => {
    if (gone) return; gone = true; clean();
    btn.classList.remove("in");
    setTimeout(() => btn.remove(), 220);
  };
  let x0 = 0, y0 = 0;
  const onMove = e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) remove(); };
  const onUp = () => { removeEventListener("pointermove", onMove, true); removeEventListener("pointerup", onUp, true); };
  // a pan starting anywhere on the map but the pill itself: the honeycomb's own pan handling isn't touched
  // (no preventDefault/stopPropagation here), this only watches for real movement to know the pill should go
  const onDown = e => {
    if (btn.contains(e.target)) return;
    x0 = e.clientX; y0 = e.clientY;
    addEventListener("pointermove", onMove, true); addEventListener("pointerup", onUp, true);
  };
  el.addEventListener("pointerdown", onDown, true);
  const timer = setTimeout(remove, TL_PILL_MS);
  btn.onclick = e => { e.stopPropagation(); buzz(6); remove(); tlResumeRecent(); };
  requestAnimationFrame(() => btn.classList.add("in"));
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
  // stash it first (David, 2026-10-09): the chain is still forgotten from the live trail's own point of view
  // (XSTACK=[] below, TL_FORGOT so Back stays on the map -- both unchanged, and the existing "map glyph exits...
  // the trail wasn't cleared" smoke scenario still checks exactly that) -- just not thrown away: tlRecentPill()
  // offers it back on the very next map draw, and tlSheet() keeps offering it after that, until a new one replaces it
  if (XSTACK.length) {
    const top = XSTACK[XSTACK.length - 1], m = TL_META.get(top) || {};
    TL_RECENT = {
      stack: XSTACK.slice(), root: X_ROOT,
      meta: XSTACK.filter(t => TL_META.has(t)).map(t => [t, TL_META.get(t)]),
      scroll: XSTACK.map(t => { const mt = TL_META.get(t); const y = mt && mt.hash ? SCROLL_BY_HASH.get(mt.hash) : null; return mt && mt.hash && y != null ? [mt.hash, y] : null; }).filter(Boolean),
      title: m.title || "", img: m.img || "", c: m.c || "", sw: m.sw || [],
      t: performance.now(),
    };
    tlRecentSave();
  }
  XSTACK = []; X_ROOT = null; TL_UNDER = null; TL_MAPKEEP = null; TL_FORGOT = true; tlSave();   // the whole chain is forgotten
  const scr = app.querySelector(".screen"), home = () => typeof hmHome === "function" ? hmHome() : go(S.tab || "learn");
  // a color's page goes back into its own bubble on the map instead (js/mapxfer.js, from hmHome)
  if (scr && btn && btn.isConnected && !(scr.querySelector(".cp-hero") && typeof mxLeave === "function")) shrinkTo(scr, btn, home); else home();
}
// resume a stashed trail (the map's "Back to…" pill, or a "Your last trail" row in the sheet): toIndex truncates
// to that point (same semantics as tlJump), defaulting to the whole stashed stack -- its own top page
function tlResumeRecent(toIndex) {
  const r = TL_RECENT; if (!r || !r.stack.length) return;
  r.scroll.forEach(([h, y]) => SCROLL_BY_HASH.set(h, y));
  r.meta.forEach(([k, v]) => TL_META.set(k, v));
  const i = toIndex != null ? Math.max(0, Math.min(toIndex, r.stack.length - 1)) : r.stack.length - 1;
  XSTACK = r.stack.slice(0, i + 1); X_ROOT = r.root;
  TL_RECENT = null; tlRecentSave();
  BACK_RENDER = true;
  xStep(XSTACK[XSTACK.length - 1]);
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
  if (!SCROLL_BY_HASH.get(ROUTE_NOW)) return;
  let n = 0, stop = false;
  const quit = () => { stop = true; };
  addEventListener("touchstart", quit, { once: true, passive: true }); addEventListener("wheel", quit, { once: true, passive: true });
  const tick = () => {
    if (stop || ++n > 12) return;
    const want = SCROLL_BY_HASH.get(ROUTE_NOW);   // read each time: a page that knows better (the painting feed anchors on a tile, js/feed.js) updates it
    if (want && Math.abs(scrollY - want) > 4) scrollTo(0, want);
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
  const sim = e.target.closest && e.target.closest("[data-glsimilar]");
  if (sim) { e.preventDefault(); buzz(6); location.hash = "#/paintings/map?arr=spiral&seed=" + sim.dataset.glsimilar; return; }
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
  // David, 2026-10-09: a trail an explicit Close just stashed (TL_RECENT) stays offered here too -- its own,
  // clearly separate list, so it never reads as part of the live trail above it -- until a genuinely new trail
  // replaces it (tlNote, js/trail.js)
  const recentRows = TL_RECENT ? TL_RECENT.stack.map((tok, i) => tlRow("recent:" + i, tlMetaFor(tok), tlKind(tlMetaFor(tok).hash), false)).reverse().join("") : "";
  const recentBlock = TL_RECENT ? `<h2 class="title-2 tl-recent-h">Your last trail</h2><p class="note">${TL_RECENT.stack.length} ${TL_RECENT.stack.length === 1 ? "page" : "pages"}, from before you closed</p>
    <ol class="tl-list">${recentRows}</ol>` : "";
  const { sh, close } = sheet(`<div class="tl-sheet"><h2 class="title-2">Your trail</h2><p class="note">${XSTACK.length > 1 ? `${XSTACK.length} pages, newest first` : "Every page you open from here joins it"}</p>
    <ol class="tl-list">${rows.join("")}${roomRow}${mapRow}</ol>${recentBlock}</div>`);
  sh.classList.add("tl-sheet-wrap");
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-tl-go]"); if (!b || b.classList.contains("here")) return;
    const k = b.dataset.tlGo;
    buzz(6); close();
    if (k === "map") return tlExit(null);
    if (k === "origin") return tlToOrigin();
    if (k.startsWith("recent:")) return tlResumeRecent(+k.slice(7));
    if (k !== "none") tlJump(+k);
  });
}
