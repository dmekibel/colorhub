"use strict";
// The Places menu and the one ⋯ More sheet (design/SIMPLIFY/PLAN.md §3.1/§3.4/§9, the day-0 contract).
// ⋯ (moreOpen/moreRegister, below) is unchanged and still the one sheet every PAGE's ⋯ opens. The Places
// MENU itself (placesOpen, below) was restored to its earlier form on 2026-10-10 -- David's verdict on the
// Simplify pass: "the bottom-left Collections shouldn't make the menu full screen; it should be a button like
// the other rows above it... the way it worked before, both bottom-left and bottom-right buttons expanded
// upward along the side without going full screen." So it's the old bubble-arc stem again (js/core.js's
// retired toggleStem: STEM_OPEN/closeStem/cornersBack/growFrom/roomToFloor/stemJustClosed, all still there,
// unchanged -- the map's right corner, js/home.js hmDoMenu, rides the exact same machinery), just with new
// rows: the 5 places, then one more row, Collections, that opens the Museum's own grid of every collection
// (js/explore.js museumHome) as its own screen -- never inline in this menu, which is the thing David objected to.

// ---------- the Places stem ----------
// Every place, in order (PLAN §3.1): the floor plus the four rooms that rise from it. Each row shows its own
// live art and note (js/core.js roomsBubbleArt/roomsNote, unchanged -- the same pictures the old stem used).
const PLACES_LIST = [["home", NAV_MAP], ...ROOMS_LIST];
const placesHere = () => { const r = document.querySelector(".room-sheet"); return r ? r.dataset.room : "home"; };
// Collections' own row art: a small mosaic of 4 covers (David, 2026-10-10), not a swatch dot -- a plain,
// recognizable "many small pictures" glyph, distinct from every room's single live picture. Real, not a
// placeholder: the 4 hexes come from COLLECTIONS' own `pic` (js/collections.js, the same curated color every
// collection's tile falls back to while its real cover loads), recent-first so the mosaic reflects what you
// actually opened -- never four arbitrary colors with no connection to the data.
const PLACES_COLL_FALLBACK = ["#5E4A3A", "#211D16", "#6B4C7A", "#1A1A2E"];   // Paintings/Poems/Gems/Films -- only if COLLECTIONS hasn't loaded
function placesCollArt() {
  const list = typeof collRecent === "function" ? collRecent() : [];
  const hexes = (list.length ? list : (typeof COLLECTIONS !== "undefined" ? COLLECTIONS : [])).slice(0, 4).map(c => c.pic).filter(Boolean);
  while (hexes.length < 4) hexes.push(PLACES_COLL_FALLBACK[hexes.length] || "#3A3226");
  return `<span class="rm-art pl-coll-art">${hexes.map(h => `<i style="background:${esc(h)}"></i>`).join("")}</span>`;
}
// Every collection, as a picture tile, recent-first (PLAN §3.1/§3.4: "a directory of destinations... shows every
// destination as a picture", exempt from the ≤6 rule). js/collections.js owns COLLECTIONS/collRecent().
// David, 2026-10-09: "Add a picture to each one of these squares." A tile shows its own cover photo (c.img,
// object-fit:cover, loading="lazy") when it has one, a drawn SVG cover (c.cover(), inline and crisp -- "type as
// image" for the bottom 6, which only had generic swatch mosaics before 2026-10-10) when it builds one, or a
// small real-color mosaic (c.swatches) when a photo would be dishonest (Brands: no logos). c.pic is the
// loading/fallback wash either way, and onerror on the <img> removes it so a broken hotlink just falls back to
// that wash instead of a dead gap.
function placesCollTile(c) {
  const got = typeof c.cover === "function" ? (c.cover() || {}) : {};
  const img = got.img || c.img, svg = got.svg;
  const cover = svg ? `<span class="pl-ctile-svg" aria-hidden="true">${svg}</span>`
    : img ? `<img class="pl-ctile-img" src="${esc(img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
    : c.swatches && c.swatches.length ? `<span class="pl-ctile-mosaic">${c.swatches.map(h => `<i style="background:${esc(h)}"></i>`).join("")}</span>` : "";
  return `<button class="pl-ctile${cover ? " has-cover" : ""}" data-pl-coll="${esc(c.id)}" style="${c.pic ? `--c:${esc(c.pic)}` : ""}">
    ${cover}<b>${esc(c.t)}</b>${c.count ? `<small>${esc(c.count)}</small>` : ""}</button>`;
}
// Same corner, same empirically-observed quirk the old bubble-arc stem was fixed for (core.js stemJustClosed,
// David 2026-10-08: "clicking it again minimizes it, and then automatically it expands again by itself" -- a
// delayed synthetic click iOS can still fire on a button once whatever covered it is gone). The stem now rides
// core.js's own STEM_OPEN/closeStem/STEM_CLOSED_AT/stemJustClosed -- the same guard the right corner's
// hm-do-stem uses -- so this file no longer needs its own copy. Kept as a function (always false) only because
// js/core.js's click delegator for [data-rooms-corner] still calls it defensively.
const placesJustClosed = () => false;
function placesOpen() {
  if (STEM_OPEN) { buzz(4); return closeStem(); }
  if (stemJustClosed() || document.querySelector(".sheet,.scrim,.rooms-stem")) return;
  buzz(4);
  if (!document.querySelector(".room-sheet") && typeof hmSnapFloor === "function") hmSnapFloor();   // L18 B2: the floor as you leave it
  STEM_OPEN = true; document.body.classList.add("stem-open");
  document.querySelectorAll(".rooms-stem,.rm-scrim").forEach(n => n.remove());   // one still sinking from a fast double tap
  const here = placesHere();
  const rows = PLACES_LIST.map(([id, label]) => ({ id, label, cur: id === here }))
    .concat([{ id: "colls", label: "Collections", coll: true }]);
  const n = rows.length;
  const scrim = document.createElement("div"); scrim.className = "rm-scrim rm-scrim-l";
  scrim.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); buzz(4); closeStem(); });
  scrim.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
  scrim.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
  const stem = document.createElement("div");
  stem.className = "rooms-stem"; stem.setAttribute("role", "menu"); stem.setAttribute("aria-label", "Places");
  stem.style.setProperty("--n", n);
  // a straight stack up the left edge, nearest-first (David, 2026-10-08: "straight up along the side"): Map
  // leads (you're usually a tap from it), then Learn/Train/Museum/Studio, Collections furthest (least-used).
  stem.innerHTML = rows.map((r, i) => r.coll
    ? `<button class="rm-bubble" role="menuitem" data-pl="colls" style="--i:${i}">
        ${placesCollArt()}<span class="rm-label"><b>Collections</b><em>Every painting, poem, gem and look</em></span></button>`
    : `<button class="rm-bubble${r.cur ? " cur" : ""}" role="menuitem" data-pl="${r.id}" style="--i:${i}">
        ${roomsBubbleArt(r.id)}<span class="rm-label"><b>${esc(r.label)}</b><em>${esc(r.cur ? "You're here" : roomsNote(r.id))}</em></span></button>`
  ).join("");
  document.body.append(scrim, stem);
  document.querySelectorAll("[data-rooms-corner]").forEach(b => { b.classList.add("on"); b.innerHTML = ICON.x; b.setAttribute("aria-expanded", "true"); });
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); stem.classList.add("on"); }));
  STEM_KEY = e => { if (e.key === "Escape") { e.stopPropagation(); closeStem(); } };
  addEventListener("keydown", STEM_KEY, true);
  stem.querySelectorAll("[data-pl]").forEach(b => b.onclick = () => {
    const id = b.dataset.pl, art = b.querySelector(".rm-art");
    buzz(8);
    if (id === "colls") {
      closeStem();
      // the Museum's own grid of every collection (museumHome, js/explore.js) -- its own full screen, never
      // rendered inline in this menu (David's objection to the Simplify pass's full-screen Collections panel).
      S.lens = "all"; save();
      return growFrom(art, () => go("explore"));
    }
    if (id === here) return closeStem();
    b.classList.add("go");
    closeStem();
    if (id === "home") return roomToFloor(art);
    growFrom(art, () => go(id));
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
