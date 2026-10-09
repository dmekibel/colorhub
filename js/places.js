"use strict";
// The Places menu and the one ⋯ More sheet (design/SIMPLIFY/PLAN.md §3.1/§3.4/§9, the day-0 contract).
// Replaces the left corner's old bubble-arc stem (js/core.js toggleStem, retired) and gives every screen the
// same ⋯ anatomy: search first, this screen's own groups, Settings last. Nothing here is modal-over-modal: a
// sub-page (moreSub) slides in INSIDE the same sheet, with its own ‹, never a second sheet stacked on top (PLAN
// §3.4's "never a second sheet on top").

// ---------- the Places sheet ----------
// Every place, in order (PLAN §3.1): the floor plus the four rooms that rise from it. Each row shows its own
// live art and note (js/core.js roomsBubbleArt/roomsNote, unchanged -- the same pictures the old stem used).
const PLACES_LIST = [["home", NAV_MAP], ...ROOMS_LIST];
const placesHere = () => { const r = document.querySelector(".room-sheet"); return r ? r.dataset.room : "home"; };

function placesRow(id, label, here) {
  return `<button class="pl-row" role="menuitem" data-pl-go="${id}">
    ${roomsBubbleArt(id)}<span class="pl-txt"><b>${esc(label)}</b><em>${esc(here ? "Here" : roomsNote(id))}</em></span>${here ? "" : ICON.chev}
  </button>`;
}
// "Pick up where you left off" (PLAN §3.5/§9, replaces the timed "Back to…" pill with a persistent row here
// and in the trail sheet): js/trail.js's TL_RECENT, the one stashed trail an explicit Close/place-pill leaves behind.
function placesRecentRow() {
  const r = typeof TL_RECENT !== "undefined" && TL_RECENT;
  if (!r || !r.stack.length) return "";
  const top = r.stack[r.stack.length - 1], m = (typeof tlMetaFor === "function" ? tlMetaFor(top) : null) || {};
  const title = r.title || m.title || "your last page";
  return `<button class="pl-recent" data-pl-recent>${typeof tlThumb === "function" ? tlThumb({ img: r.img, c: r.c, sw: r.sw }) : ""}
    <span class="pl-txt"><b>Pick up where you left off</b><em>${esc(title)}</em></span>${ICON.chev}</button>`;
}
// Every collection, as a picture tile, recent-first (PLAN §3.1/§3.4: "a directory of destinations... shows every
// destination as a picture", exempt from the ≤6 rule). js/collections.js owns COLLECTIONS/collRecent().
function placesCollTile(c) {
  return `<button class="pl-ctile" data-pl-coll="${esc(c.id)}" style="${c.pic ? `--c:${esc(c.pic)}` : ""}">
    <span class="pl-ctile-pic">${c.pic ? "" : ""}</span><b>${esc(c.t)}</b>${c.count ? `<small>${esc(c.count)}</small>` : ""}</button>`;
}
// Same corner, same empirically-observed quirk the old bubble-arc stem was fixed for (core.js stemJustClosed,
// David 2026-10-08: "clicking it again minimizes it, and then automatically it expands again by itself" -- a
// delayed synthetic click iOS can still fire on a button once whatever covered it is gone). A MutationObserver
// (not sheet()'s own close()) catches every way the sheet can leave -- scrim tap, swipe-down, Escape, a row --
// so the guard holds regardless of which one closed it.
let PLACES_CLOSED_AT = 0;
const placesJustClosed = () => Date.now() - PLACES_CLOSED_AT < 380;
function placesOpen() {
  if (document.querySelector(".sheet,.rooms-stem") || placesJustClosed()) return;
  buzz(6);
  const here = placesHere();
  const colls = typeof collRecent === "function" ? collRecent() : [];
  const html = `<div class="pl-sheet">
      <h2 class="title-2">Places</h2>
      ${placesRecentRow()}
      <ul class="pl-grid" role="menu" aria-label="Places">${PLACES_LIST.map(([id, label]) => placesRow(id, label, id === here)).join("")}</ul>
      ${colls.length ? `<h3 class="title-3 pl-coll-h">Collections</h3><ul class="pl-colls">${colls.map(placesCollTile).join("")}</ul>` : ""}
      <div class="pl-search"><button type="button" class="pl-search-row" data-pl-search>${ICON.search}<span>Search colors, paintings, collections…</span></button></div>
    </div>`;
  const { sh, close } = sheet(html, { lock: false });
  sh.classList.add("pl-sheet-wrap");
  // the common case (a tap outside, on the scrim) is caught the instant it happens, same as closeStem()'s own
  // STEM_CLOSED_AT; a MutationObserver is the fallback for the other ways out (swipe-down, Escape, a row) that
  // don't fire on the scrim at all, at the small cost of catching those only once the sheet actually leaves.
  const scrimEl = document.querySelector(".scrim");
  if (scrimEl) scrimEl.addEventListener("pointerdown", () => { PLACES_CLOSED_AT = Date.now(); }, { capture: true });
  const plMo = new MutationObserver(() => { if (!sh.isConnected) { PLACES_CLOSED_AT = Date.now(); plMo.disconnect(); } });
  plMo.observe(document.body, { childList: true });
  sh.addEventListener("click", e => {
    const r = e.target.closest("[data-pl-recent]");
    if (r) { close(); buzz(6); if (typeof tlResumeRecent === "function") tlResumeRecent(); return; }
    const s = e.target.closest("[data-pl-search]");
    if (s) { close(); if (typeof searchOpen === "function") searchOpen({ from: "places" }); return; }
    const p = e.target.closest("[data-pl-go]");
    if (p) {
      const id = p.dataset.plGo; close();
      if (id === here) return;
      buzz(8);
      if (id === "home") return typeof hmGoFloor === "function" ? hmGoFloor() : go("learn");
      return go(id);
    }
    const c = e.target.closest("[data-pl-coll]");
    if (c) { close(); buzz(8); if (typeof collOpen === "function") collOpen(c.dataset.plColl); return; }
  });
}

// ---------- the one ⋯ More sheet ----------
// moreRegister(ctx, groupsFn): a page or place registers its own ⋯ content, keyed by ctx (the route's first
// path segment for pages -- js/trail.js tlRouteKind() -- or a place id for room homes). groupsFn() returns an
// array of groups: { title, note, items: [{ t, n?, icon, run } | { chips:[...] } | { html }] }. Nothing is
// required to register: a context with nothing registered still gets Search + Settings, so ⋯ always works.
const MORE_REGISTRY = new Map();
function moreRegister(ctx, groupsFn) { if (ctx && typeof groupsFn === "function") MORE_REGISTRY.set(ctx, groupsFn); }
function moreGroupHTML(g, gi) {
  const rows = (g.items || []).slice(0, 6).map((it, i) => {
    if (it.html) return it.html;
    if (it.chips) return `<div class="mr-chips">${it.chips.map((c, ci) => `<button type="button" class="mr-chip" data-mr="${gi}:${i}:${ci}">${esc(c.t)}</button>`).join("")}</div>`;
    return `<button type="button" class="mn-row" data-mr="${gi}:${i}">${it.icon ? `<span class="mn-lead">${it.icon}</span>` : ""}<span class="mn-txt"><b>${esc(it.t)}</b>${it.n ? `<small>${esc(it.n)}</small>` : ""}</span>${it.href ? "" : `<span class="mn-chev">${ICON.chev}</span>`}</button>`;
  }).join("");
  const more = (g.items || []).length > 6 ? `<p class="mr-more">+${(g.items.length - 6)} more</p>` : "";
  return `<section class="mn-group">${g.title ? `<p class="mn-gnote">${esc(g.title)}</p>` : ""}${g.note ? `<p class="fine">${esc(g.note)}</p>` : ""}${rows}${more}</section>`;
}
// derives the registry key for the page currently on screen: the route's first path segment (trail.js, when
// loaded) or, for a room home, its own tab id -- so a lane registers once and both a direct address and a
// trail visit to the same screen find the same groups.
function moreCtxNow() {
  if (document.querySelector(".room-sheet")) return placesHere();
  return typeof tlRouteKind === "function" ? tlRouteKind() : "page";
}
function moreOpen(ctx) {
  if (document.querySelector(".sheet,.rooms-stem")) return;
  ctx = ctx || moreCtxNow();
  buzz(6);
  const groupsFn = MORE_REGISTRY.get(ctx);
  let groups = [];
  if (groupsFn) try { groups = groupsFn() || []; } catch (e) { groups = []; }
  const html = `<div class="mr-sheet">
    <button type="button" class="mr-search" data-mr-search>${ICON.search}<span>Search</span></button>
    ${groups.map(moreGroupHTML).join("")}
    <section class="mn-group"><button type="button" class="mn-row" data-mr-settings>${ICON.chev ? "" : ""}<span class="mn-txt"><b>Settings</b></span><span class="mn-chev">${ICON.chev}</span></button></section>
  </div>`;
  const { sh, close } = sheet(html);
  sh.classList.add("mr-sheet-wrap");
  sh.addEventListener("click", e => {
    if (e.target.closest("[data-mr-search]")) { close(); if (typeof searchOpen === "function") searchOpen({ from: ctx }); return; }
    if (e.target.closest("[data-mr-settings]")) { close(); if (typeof ymSettingsSheet === "function") ymSettingsSheet(); return; }
    const b = e.target.closest("[data-mr]"); if (!b) return;
    const [gi, ii, ci] = b.dataset.mr.split(":").map(Number);
    const it = groups[gi] && groups[gi].items[ii]; if (!it) return;
    if (it.chips) { const c = it.chips[ci]; close(); buzz(8); if (c && c.run) c.run(); return; }
    close(); buzz(8); if (it.run) it.run();
  });
}
