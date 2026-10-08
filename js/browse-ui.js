"use strict";
// Explore 2.0, the screen (lane L16). The query layer (facets, counts, sections, the jump-bar map) is js/browse.js;
// this file draws Art from it: the color row, facet chips and their sheets, the sticky breadcrumb with the count,
// rooms, the four views (Grid, River, Painters, Wall), the color dial and the special rooms (twins, the unpainted).

let XB = { f: xbFresh(), view: "grid", sort: "", seed: 1, hist: [], show: {}, y: 0, back: false, room: "", special: "", wall: { level: 0, at: -1 } };
const XB_VIEWS = [["grid", "Grid"], ["river", "River"], ["painters", "Painters"], ["wall", "Wall"]];
const XB_SORTS = [["most", "Most of this color"], ["closest", "Closest"], ["date", "Date"], ["painter", "Painter"], ["shuffle", "Shuffle"]];
const xbUser = () => {
  if (!S.xb || typeof S.xb !== "object") S.xb = {};
  if (!Array.isArray(S.xb.recent)) S.xb.recent = [];
  if (!Array.isArray(S.xb.rooms)) S.xb.rooms = [];
  return S.xb;
};
const xbSortNow = () => {
  const s = XB.sort, col = XB.f.hexes.length > 0;
  if (s && (col || (s !== "most" && s !== "closest"))) return s;
  return col ? "most" : "date";
};
const xbNum = n => Number(n).toLocaleString("en-US");
const xbPaint = n => `${xbNum(n)} ${n === 1 ? "painting" : "paintings"}`;
const xbCopy = f => ({ ...f, hexes: f.hexes.slice() });

// change the filter: remember the old one (Back unwinds it), and give the phone's back gesture an entry to pop
function xbSet(f, o = {}) {
  XB.hist.push({ f: xbCopy(XB.f), special: XB.special, room: XB.room, view: XB.view, sort: XB.sort });
  if (XB.hist.length > 60) XB.hist.shift();
  XB.f = f; XB.show = {}; XB.special = o.special || ""; XB.room = o.room || "";
  if (o.view) XB.view = o.view;
  if (o.sort !== undefined) XB.sort = o.sort;
  if (f.hexes.length && f.hexes.length < 4 && !o.noRecent) xbRemember(f.hexes[0], f.name);
  try { history.pushState({ ch: 1 }, "", typeof ROUTE_NOW !== "undefined" && ROUTE_NOW ? ROUTE_NOW : undefined); } catch (e) {}
  buzz(6);
  xbRender(true);
}
function xbBack() {
  const prev = XB.hist.pop();
  if (!prev) return typeof backToPager === "function" ? backToPager() : go("explore");
  Object.assign(XB, { f: prev.f, special: prev.special, room: prev.room, view: prev.view, sort: prev.sort, show: {} });
  buzz(4);
  xbRender(true);
}
function xbRemember(hex, name) {
  const u = xbUser();
  u.recent = [{ h: hex, n: name || "" }, ...u.recent.filter(r => r.h !== hex)].slice(0, 8);
  save();
}
// apply one color (or a set of colors) as the color facet, keeping the other filters
function xbPickColor(hexes, name, o = {}) {
  const f = xbCopy(XB.f);
  f.hexes = (Array.isArray(hexes) ? hexes : [hexes]).map(h => String(h).toUpperCase());
  f.name = name || (f.hexes.length === 1 ? nameOf(f.hexes[0]).text : "");
  if (o.tol) f.tol = o.tol;
  xbSet(f, { sort: "" });
}

// the Art screen (explore.js artHome() hands over to this)
function xbHome() {
  XSTACK = [];
  if (typeof ART_UI !== "undefined" && ART_UI && ART_UI.hex) {   // arrived from a color page's "In paintings", or a shot
    XB.f = { ...xbFresh(), hexes: [String(ART_UI.hex).toUpperCase()], name: ART_UI.name || "" };
    XB.hist = []; XB.special = ""; XB.room = ""; XB.show = {}; XB.sort = ""; XB.view = "grid";
    xbRemember(XB.f.hexes[0], XB.f.name);
    ART_UI = { hex: null, name: "" };
  }
  const el = show(`
    <div class="art-band xb-band" data-xbband>
      <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="icon-btn glass" data-search aria-label="Search">${ICON.search}</button></header>
      <h1 class="p-title">Art</h1>
      <p class="p-dek" data-xbdek>${XB.f.hexes.length && XB.f.name ? `In ${esc(XB.f.name.toLowerCase())}, from ${GAL ? xbNum(GAL.n) : "over 23,000"} paintings.` : `${GAL ? xbNum(GAL.n) : "Over 23,000"} paintings and 11,440 poems, found by their colors.`}</p>
      <div class="xb-pick" data-xbpick></div>
    </div>
    <div class="xb-facets" data-xbfacets></div>
    <div class="xb-tune" data-xbtune></div>
    <div class="xb-bar" data-xbbar><p class="xb-count"><b>Loading the paintings…</b></p></div>
    <div class="xb-rooms" data-xbrooms></div>
    <div class="xb-views" data-xbviews></div>
    <div class="xb-body" data-xbbody>${xbSkeleton()}</div>
  `, "article xb-screen");
  el.querySelector("[data-back]").onclick = xbBack;
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) xbBack(); };
  el.querySelector("[data-search]").onclick = () => exploreSearchSheet();
  el.addEventListener("click", xbClick);
  xbLoad().then(() => { if (el.isConnected) xbRender(false); })
    .catch(() => { const b = el.querySelector("[data-xbbody]"); if (b) b.innerHTML = `<div class="xb-empty"><b>The paintings didn't load.</b><p>Check the connection, then try again.</p><button class="btn ghost" data-xbretry>Try again</button></div>`; });
}
const xbSkeleton = () => `<div class="xb-skel" aria-hidden="true">${Array.from({ length: 12 }, () => "<i></i>").join("")}</div>`;

// one delegated click handler for the whole screen
function xbClick(e) {
  const t = e.target;
  if (t.closest("[data-swatch]")) return;   // js/swatch.js opens the color page
  const gi = t.closest("[data-gi]");
  if (gi) { XB.y = xbSY(); XB.back = true; return galleryPage(+gi.dataset.gi, true, XB.f.hexes[0] || null); }
  const x = t.closest("[data-xbx]"); if (x) { e.stopPropagation(); return xbSet(xbWithout(XB.f, x.dataset.xbx)); }
  const fc = t.closest("[data-xbfacet]"); if (fc) return xbFacetSheet(fc.dataset.xbfacet);
  const bub = t.closest("[data-xbhex]"); if (bub) return xbPickColor(bub.dataset.xbhex, bub.dataset.xbname || "");
  if (t.closest("[data-xbdial]")) return xbDial();
  if (t.closest("[data-xbtype]")) return xbDial({ type: true });
  const ph = t.closest("[data-xbphoto]"); if (ph) return xbPhoto(ph.dataset.xbphoto === "camera");
  const v = t.closest("[data-xbview]"); if (v) { if (XB.view === v.dataset.xbview) return; XB.view = v.dataset.xbview; XB.wall = { level: 0, at: -1 }; buzz(5); return xbRender(false, true, true); }
  if (t.closest("[data-xbsort]")) return xbSortSheet();
  const rm = t.closest("[data-xbroom]"); if (rm) return xbOpenRoom(rm.dataset.xbroom);
  if (t.closest("[data-xbsave]")) return xbSaveRoom();
  if (t.closest("[data-xbunsave]")) return xbUnsaveRoom();
  if (t.closest("[data-xbclear]")) return xbSet(xbFresh(), { sort: "" });
  const more = t.closest("[data-xbmore]"); if (more) { const k = more.dataset.xbmore; XB.show[k] = (XB.show[k] || +more.dataset.base) + (+more.dataset.step || 60); buzz(4); return xbRender(false, true, true); }
  const only = t.closest("[data-xbonly]"); if (only) return xbOnlySection(only.dataset.xbonly);
  const lo = t.closest("[data-xbloosen]"); if (lo) return xbSet(JSON.parse(lo.dataset.xbloosen));
  const pr = t.closest("[data-xbpainter]"); if (pr) return xbOpenPainter(+pr.dataset.xbpainter);
  const pm = t.closest("[data-poem]"); if (pm) { POEM_ORIGIN = "explore"; XB.y = xbSY(); XB.back = true; return poemPage(pm.dataset.poem); }
  if (t.closest("[data-xbretry]")) return xbHome();
  if (t.closest("[data-xbshuffle]")) { XB.seed = (XB.seed * 48271 + 11) % 2147483647 || 7; XB.sort = "shuffle"; XB.view = "grid"; XB.show = {}; buzz(6); return xbRender(false, false, true); }
}

// The page scrolls either the window or <body> (app.css: html and body both overflow-x:hidden with body at
// height:100%, which makes body the scroller in Chrome), so every read, write and listener here handles both.
const xbSY = () => window.scrollY || document.body.scrollTop || 0;
function xbTo(y) { y = Math.max(0, y); window.scrollTo(0, y); if (document.body.scrollHeight > document.body.clientHeight + 1) document.body.scrollTop = y; }

// ---------- render: everything below the header redraws from XB in one go ----------
let XB_RES = null;
function xbRender(toTop, bodyOnly = false, keepScroll = false) {
  const el = document.querySelector(".xb-screen"); if (!el || !XBF) return;
  const F = XBF, f = XB.f, t0 = performance.now();
  const res = xbQuery(F, f);
  XB_RES = res;
  const n = res.list.length, y = xbSY();
  if (!bodyOnly) {
    el.querySelector("[data-xbband]").style.setProperty("--tint", f.hexes.length ? tintFromHex(f.hexes[0]) : "var(--ground)");
    el.querySelector("[data-xbdek]").textContent = f.hexes.length
      ? `In ${(f.name || nameOf(f.hexes[0]).text).toLowerCase()}, from ${xbNum(F.N)} paintings.`
      : `${xbNum(F.N)} paintings and 11,440 poems, found by their colors.`;
    el.querySelector("[data-xbpick]").innerHTML = xbPickRow();
    el.querySelector("[data-xbfacets]").innerHTML = xbFacetRow(F, f);
    xbTune(el.querySelector("[data-xbtune]"), F, f, res);
    el.querySelector("[data-xbbar]").innerHTML = xbBarHTML(F, f, n);
    xbRooms(el.querySelector("[data-xbrooms]"), F);
  }
  el.querySelector("[data-xbviews]").innerHTML = XB.special || !n ? "" : xbViewsHTML();
  const body = el.querySelector("[data-xbbody]");
  xbJumpOff();
  if (XB.special === "twins") xbTwins(body, F);
  else if (XB.special === "unpainted") xbUnpainted(body, F);
  else if (!n) xbZero(body, F, f);
  else if (XB.view === "river") xbRiver(body, F, res);
  else if (XB.view === "painters") xbPainters(body, F, res);
  else if (XB.view === "wall") xbWall(body, F, res);
  else xbGrid(body, F, res);
  XB.ms = Math.round(performance.now() - t0);
  if (document.documentElement.classList.contains("sheet-open")) return;   // a sheet holds the page still; leave the scroll alone
  if (XB.back) { XB.back = false; const to = XB.y; requestAnimationFrame(() => xbTo(to)); }
  else if (keepScroll) xbTo(y);
  else if (toTop) { const fa = el.querySelector("[data-xbfacets]"); const top = fa ? xbSY() + fa.getBoundingClientRect().top - 8 : 0; if (xbSY() > top) xbTo(top); }
}
// the query, with L26's paintingsFor() standing in for the six-color coverage when it exists
function xbQuery(F, f) {
  let cov = null;
  if (f.hexes.length === 1 && typeof paintingsFor === "function") {
    try {
      const r = paintingsFor(f.hexes[0], { tol: f.tol, minCover: 0, sort: "cover" });
      const items = r && (r.list || r.items);
      if (Array.isArray(items) && items.length && (items[0].i != null || items[0].gi != null)) {
        cov = { cov: new Float32Array(F.N), near: new Float32Array(F.N).fill(1e3) };
        items.forEach(x => { const i = x.i != null ? x.i : x.gi, c = x.cover != null ? x.cover : x.coverage || 0; cov.cov[i] = c > 1 ? c / 100 : c; cov.near[i] = x.de != null ? x.de : x.closest != null ? x.closest : 0; });
      }
    } catch (e) { cov = null; }
  }
  return xbRun(F, f, cov ? { cov } : {});
}
// ---------- the color row: dial, type, photo, camera, then recent and favorite colors ----------
const XB_RING = `<span class="xb-ring" aria-hidden="true"></span>`;
const XB_IC_TYPE = sv('<path d="M4 18l5-12 5 12M5.8 14h6.4M15 9.5h5M17.5 9.5V18"/>', 20, 1.8);
const XB_IC_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 20, 1.8);
const XB_IC_DOWN = sv('<path d="M7 10l5 5 5-5"/>', 14, 2);
function xbFavorites() {
  const out = [], seen = new Set(), add = (h, n) => { h = String(h).toUpperCase(); if (!seen.has(h)) { seen.add(h); out.push({ h, n }); } };
  (S.saved || []).forEach(id => { const m = /^c:(.+)$/.exec(id); const c = m && BYNAME.get(m[1].toLowerCase()); if (c) add(c.h, c.n); });
  ALL.forEach(c => { if (S.cards && S.cards[c.id] && typeof isMine === "function" && isMine(S.cards[c.id])) add(c.h, c.n); });
  return out;
}
// the Learner Model's "learning": colors in your reviews that aren't yours yet (js/learner.js knowState)
function xbLearning() {
  return ALL.filter(c => S.cards && S.cards[c.id] && (typeof knowState === "function" ? knowState(c) === "learning" : true)).map(c => ({ h: c.h, n: c.n }));
}
function xbPickRow() {
  const u = xbUser(), cur = XB.f.hexes.length === 1 ? XB.f.hexes[0] : null;
  const seen = new Set(), bubbles = [];
  [...u.recent, ...xbFavorites()].forEach(c => { if (bubbles.length < 10 && !seen.has(c.h)) { seen.add(c.h); bubbles.push(c); } });
  return `<button class="xb-tool" data-xbdial aria-label="Pick any color on the dial">${XB_RING}<span>Any color</span></button>
    <button class="xb-tool" data-xbtype aria-label="Type a color name">${XB_IC_TYPE}<span>Type</span></button>
    <button class="xb-tool" data-xbphoto="photo" aria-label="Colors from a photo">${XB_IC_PHOTO}<span>Photo</span></button>
    <button class="xb-tool" data-xbphoto="camera" aria-label="Colors from the camera">${ICON.camera}<span>Camera</span></button>
    ${bubbles.length ? `<i class="xb-sep" aria-hidden="true"></i>` : ""}
    ${bubbles.map(c => `<button class="xb-bub${c.h === cur ? " on" : ""}" data-xbhex="${c.h}" data-xbname="${esc(c.n || "")}" style="--c:${c.h}" aria-label="${esc(c.n || nameOf(c.h).text)}"></button>`).join("")}`;
}

// ---------- facet chips (each opens its own small sheet with live counts) ----------
function xbFacetRow(F, f) {
  const c = xbChips(F, f), val = dim => { const x = c.find(z => z.dim === dim); return x ? x.text : ""; };
  const moodOn = ["key", "chroma", "temp", "contrast"].filter(k => f[k] >= 0).map(k => val(k));
  const chip = (dim, label, on, sw) => `<button class="xb-fc${on ? " on" : ""}" data-xbfacet="${dim}">${sw ? `<i style="--c:${sw}"></i>` : ""}<span>${esc(on || label)}</span>${XB_IC_DOWN}</button>`;
  return [chip("color", "Color", f.hexes.length ? (f.name || nameOf(f.hexes[0]).text) : "", f.hexes[0]), chip("when", "When", val("when")), chip("painter", "Painter", val("painter")),
    chip("mood", "Mood", moodOn.join(", ")), chip("size", "Palette", val("size")), chip("mus", "Museum", val("mus")),
    chip("co", "Country", val("co")), chip("mv", "Movement", val("mv"))].join("");
}
// the sticky bar: where you are (the breadcrumb, each filter removable) and how many paintings it holds
const xbMoodDim = d => ["key", "chroma", "temp", "contrast"].includes(d) ? "mood" : d;
function xbBarHTML(F, f, n) {
  const chips = xbChips(F, f), room = XB.room ? xbRoomById(XB.room) : null;
  const special = XB.special === "twins" ? "Twins across time" : XB.special === "unpainted" ? "The unpainted" : "";
  const what = special ? `<b>${special}</b>` : `<b data-xbn>${xbNum(n)}</b> <span>${n === 1 ? "painting" : "paintings"}</span>`;
  const crumbs = chips.map(c => `<span class="xb-cr"><button data-xbfacet="${xbMoodDim(c.dim)}">${c.sw ? `<i style="--c:${c.sw[0]}"></i>` : ""}${esc(c.text)}</button><button class="xb-crx" data-xbx="${c.dim}" aria-label="Remove ${esc(c.text)}">${ICON.xS}</button></span>`).join("");
  const act = special ? `<button class="xb-link" data-xbclear>All paintings</button>`
    : chips.length ? (room && room.mine ? `<button class="xb-link" data-xbunsave>Remove this room</button>` : `<button class="xb-link" data-xbsave>Save as a room</button>`) + `<button class="xb-link" data-xbclear>Clear</button>`
    : `<button class="xb-link" data-xbshuffle>Shuffle</button>`;
  return `${room && !special ? `<p class="xb-roomname">${esc(room.name)}${room.recipe ? ` <em>· our recipe</em>` : ""}</p>` : ""}${crumbs ? `<div class="xb-crumbs">${crumbs}</div>` : ""}<p class="xb-count">${what}<span class="xb-acts">${act}</span></p>`;
}
function xbViewsHTML() {
  const sort = xbSortNow(), sortName = { most: "Most of it", closest: "Closest", date: "Date", painter: "Painter", shuffle: "Shuffle" }[sort] || "";
  return `<div class="xb-seg" role="tablist">${XB_VIEWS.map(([k, t]) => `<button role="tab" aria-selected="${XB.view === k}" class="${XB.view === k ? "on" : ""}" data-xbview="${k}">${t}</button>`).join("")}</div>
    ${XB.view === "grid" ? `<button class="xb-sortbtn" data-xbsort aria-label="Sort: ${esc(sortName)}">${esc(sortName)}${XB_IC_DOWN}</button>` : ""}`;
}

// ---------- the color's two sliders: how close, how much of the painting (the L26 stand-in for ptSliders) ----------
const xbTolText = v => v <= 1 ? "Exact, 1% different" : `Within ${v}% different`;
const xbCovText = v => v <= 0 ? "Any amount, a single touch" : v >= 50 ? "Half the canvas or more" : `At least ${v}% of the canvas`;
function xbTune(host, F, f, res) {
  if (!f.hexes.length) { host.innerHTML = ""; return; }
  const one = f.hexes.length === 1, nm = f.name || nameOf(f.hexes[0]).text;
  const preset = (XB_PRESETS.find(p => p[2].tol === f.tol && p[2].cover === f.cover && p[2].coverMax === f.coverMax) || [""])[0];
  host.innerHTML = `
    <div class="xb-tune-head">${one ? `<button class="xb-tune-sw" data-swatch="${f.hexes[0]}" style="--c:${f.hexes[0]}" aria-label="Open ${esc(nm)}"></button>` : `<span class="xb-tune-set">${f.hexes.slice(0, 8).map(h => `<button data-swatch="${h}" style="--c:${h}" aria-label="${esc(nameOf(h).text)}"></button>`).join("")}</span>`}
      <span><b>${esc(nm)}</b>${one ? `<em class="mono">${f.hexes[0]}</em>` : `<em>${f.hexes.length} colors, any of them</em>`}</span></div>
    <div class="xb-sl" data-xbsl="tol"></div>
    <div class="xb-sl" data-xbsl="cover"></div>
    <div class="xb-presets">${XB_PRESETS.map(([k, t]) => `<button class="${k === preset ? "on" : ""}" data-xbpreset="${k}">${t}</button>`).join("")}</div>
    <p class="xb-tune-sum" data-xbsum>${xbTuneSum(f, res.list.length)}</p>`;
  let pre = null, timer = 0;
  const live = () => { clearTimeout(timer); timer = setTimeout(() => xbLive(), 70); };
  const start = () => { if (!pre) pre = xbCopy(XB.f); };
  const commit = () => {
    if (!pre) return;
    XB.hist.push({ f: pre, special: XB.special, room: XB.room, view: XB.view, sort: XB.sort }); pre = null;
    try { history.pushState({ ch: 1 }, "", typeof ROUTE_NOW !== "undefined" && ROUTE_NOW ? ROUTE_NOW : undefined); } catch (e) {}
    clearTimeout(timer); xbLive(true);
  };
  xbStepper(host.querySelector('[data-xbsl="tol"]'), { title: "How close", stops: XB_TOLS, value: f.tol, text: xbTolText, ends: ["exact", "loose"], ramp: one ? xbTolRamp(f.hexes[0]) : null },
    v => { start(); XB.f.tol = v; live(); }, commit);
  xbStepper(host.querySelector('[data-xbsl="cover"]'), { title: "How much of the painting", stops: XB_COVERS, value: f.cover, text: xbCovText, ends: ["a touch", "half"] },
    v => { start(); XB.f.cover = v; if (XB.f.coverMax < 100 && v >= XB.f.coverMax) XB.f.coverMax = 100; live(); }, commit);
  host.querySelector(".xb-presets").onclick = e => {
    const b = e.target.closest("[data-xbpreset]"); if (!b) return;
    const p = XB_PRESETS.find(x => x[0] === b.dataset.xbpreset);
    xbSet({ ...xbCopy(XB.f), ...p[2] }, { room: XB.room, noRecent: true });
  };
}
// a strip of the color drifting away from itself, so "how close" is something you can see
function xbTolRamp(hex) {
  const [L, C, H] = lch(hex);
  return [0, 4, 8, 12, 16].map(d => lchHex(clamp(L + d * .55, 0, 100), Math.max(0, C - d * .35), H + d * 1.4));
}
const xbTuneSum = (f, n) => `${xbPaint(n)} ${f.tol <= 1 ? "with this exact color" : `within ${f.tol}%`}${f.cover > 0 ? `, covering at least ${f.cover}%` : ""}${f.coverMax < 100 ? ` and under ${f.coverMax}%` : ""}. Measured from six colors per painting, as photographed.`;
// a slider move: recount and redraw the results, without a history entry until the finger lifts
function xbLive(full) {
  const el = document.querySelector(".xb-screen"); if (!el || !XBF) return;
  if (full) return xbRender(false, false, true);
  const res = xbQuery(XBF, XB.f); XB_RES = res;
  const n = res.list.length;
  const sum = el.querySelector("[data-xbsum]"); if (sum) sum.textContent = xbTuneSum(XB.f, n);
  el.querySelector("[data-xbbar]").innerHTML = xbBarHTML(XBF, XB.f, n);
  el.querySelectorAll(".xb-presets [data-xbpreset]").forEach(b => { const p = XB_PRESETS.find(x => x[0] === b.dataset.xbpreset)[2]; b.classList.toggle("on", p.tol === XB.f.tol && p.cover === XB.f.cover && p.coverMax === XB.f.coverMax); });
  const y = xbSY(), body = el.querySelector("[data-xbbody]");
  el.querySelector("[data-xbviews]").innerHTML = n ? xbViewsHTML() : "";
  xbJumpOff();
  if (!n) xbZero(body, XBF, XB.f);
  else if (XB.view === "river") xbRiver(body, XBF, res);
  else if (XB.view === "painters") xbPainters(body, XBF, res);
  else if (XB.view === "wall") xbWall(body, XBF, res);
  else xbGrid(body, XBF, res);
  xbTo(y);
}
// one discrete slider: a track of stops, one knob, a tick at each stop. o: { title, stops, value, text, ends, ramp }
function xbStepper(el, o, onInput, onCommit) {
  let k = Math.max(0, o.stops.indexOf(o.value)); if (o.stops.indexOf(o.value) < 0) k = o.stops.reduce((b, v, i) => Math.abs(v - o.value) < Math.abs(o.stops[b] - o.value) ? i : b, 0);
  const last = o.stops.length - 1;
  el.innerHTML = `<div class="xb-sl-top"><span>${esc(o.title)}</span><b data-v>${esc(o.text(o.stops[k]))}</b></div>
    <div class="xb-tr" role="slider" tabindex="0" aria-label="${esc(o.title)}" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${k}" aria-valuetext="${esc(o.text(o.stops[k]))}">
      ${o.ramp ? `<span class="xb-tr-ramp" style="background:linear-gradient(90deg,${o.ramp.join(",")})"></span>` : `<span class="xb-tr-line"></span>`}
      <span class="xb-tr-fill"></span>${o.stops.map((_, i) => `<i style="left:${i / last * 100}%"></i>`).join("")}<span class="xb-kn"></span></div>
    <div class="xb-sl-ends"><span>${esc(o.ends[0])}</span><span>${esc(o.ends[1])}</span></div>`;
  const tr = el.querySelector(".xb-tr"), kn = tr.querySelector(".xb-kn"), fill = tr.querySelector(".xb-tr-fill"), v = el.querySelector("[data-v]");
  const place = () => { const p = k / last * 100; kn.style.left = p + "%"; fill.style.width = p + "%"; v.textContent = o.text(o.stops[k]); tr.setAttribute("aria-valuenow", k); tr.setAttribute("aria-valuetext", o.text(o.stops[k])); };
  const setK = nk => { nk = clamp(nk, 0, last); if (nk === k) return; k = nk; place(); buzz(4); onInput(o.stops[k]); };
  tr.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    tr.setPointerCapture(e.pointerId); tr.classList.add("drag");
    const at = ev => { const r = tr.getBoundingClientRect(); return Math.round(clamp((ev.clientX - r.left) / r.width, 0, 1) * last); };
    setK(at(e));
    tr.onpointermove = ev => setK(at(ev));
    tr.onpointerup = tr.onpointercancel = () => { tr.onpointermove = null; tr.classList.remove("drag"); onCommit(); };
  });
  tr.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { setK(k + 1); onCommit(); e.preventDefault(); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setK(k - 1); onCommit(); e.preventDefault(); } });
  place();
}

// ---------- rooms: smart collections as ways in ----------
const XB_ROOMS = [
  { id: "learning", name: "Colors you're learning", note: "Paintings that hold the colors in your reviews", dyn: () => { const L = xbLearning(); return L.length ? { hexes: L.slice(0, 12).map(c => c.h), name: "Colors you're learning", tol: 8, cover: 2 } : null; }, sort: "most" },
  { id: "favorites", name: "In your favorite colors", note: "The colors you saved and made yours", dyn: () => { const L = xbFavorites(); return L.length ? { hexes: L.slice(0, 12).map(c => c.h), name: "Your favorite colors", tol: 8, cover: 2 } : null; }, sort: "most" },
  { id: "blue1700", name: "Blue before 1700", note: "Blues over a tenth of the canvas, before 1700", f: { hexes: ["#3A5A8C"], name: "Blue", tol: 15, cover: 10, y1: 1699 }, sort: "date" },
  { id: "twins", name: "Twins across time", note: "The same palette, a century or more apart", special: "twins" },
  { id: "mono", name: "Monochrome masterpieces", note: "The fewest effective colors, and muted", f: { size: 0, chroma: 0 }, sort: "date" },
  { id: "reds", name: "The loudest reds", note: "Vivid paintings with a tenth or more of red", f: { hexes: ["#B3261E"], name: "Red", tol: 12, cover: 10, chroma: 2 }, sort: "most" },
  { id: "unpainted", name: "The unpainted", note: "Named colors no painting here comes close to", special: "unpainted" },
  { id: "dark-academia", name: "Dark academia", note: "Dark key, warmer, muted", f: { key: 0, temp: 2, chroma: 0 }, recipe: true, sort: "date" },
  { id: "nocturne", name: "Nocturne", note: "Dark key, cooler", f: { key: 0, temp: 0 }, recipe: true, sort: "date" },
  { id: "chiaroscuro", name: "Chiaroscuro", note: "Dark key, strong contrast", f: { key: 0, contrast: 2 }, recipe: true, sort: "date" },
  { id: "pastel", name: "Pastel hush", note: "Light key, muted, soft contrast", f: { key: 2, chroma: 0 }, recipe: true, sort: "date" },
  { id: "golden", name: "Golden hour", note: "Warmer and vivid", f: { temp: 2, chroma: 2, key: 1 }, recipe: true, sort: "date" },
  { id: "cool-day", name: "Cool daylight", note: "Light key, cooler", f: { key: 2, temp: 0 }, recipe: true, sort: "date" },
];
function xbRoomById(id) {
  const mine = xbUser().rooms.find(r => r.id === id);
  if (mine) return { ...mine, mine: true };
  return XB_ROOMS.find(r => r.id === id) || null;
}
const xbRoomF = r => r.dyn ? r.dyn() : r.f ? { ...xbFresh(), ...r.f, hexes: (r.f.hexes || []).slice() } : null;
function xbOpenRoom(id) {
  const r = xbRoomById(id); if (!r) return;
  if (r.special) return xbSet(xbFresh(), { special: r.special, room: r.id });
  const f = xbRoomF(r); if (!f) return toast("Nothing here yet");
  xbSet({ ...xbFresh(), ...f }, { room: r.id, view: r.view || "grid", sort: r.sort || "", noRecent: true });
}
function xbRooms(host, F) {
  const f = XB.f;
  if (XB.special || xbChips(F, f).length) { host.innerHTML = ""; return; }
  const list = [...xbUser().rooms.map(r => ({ ...r, mine: true })), ...XB_ROOMS.filter(r => !r.dyn || r.dyn())];
  host.innerHTML = `<div class="sec-head xb-h"><b>Rooms</b><span>ways in</span></div>
    <div class="xb-roomrail">${list.map(r => `<button class="xb-room" data-xbroom="${esc(r.id)}"><span class="xb-room-im" data-xbroomim="${esc(r.id)}"></span><span class="xb-room-band" data-xbroomband="${esc(r.id)}"></span><b>${esc(r.name)}</b><small>${r.mine ? "Your room" : r.recipe ? "Our recipe: " + esc(r.note.toLowerCase()) : esc(r.note)}</small><em class="mono" data-xbroomn="${esc(r.id)}"></em></button>`).join("")}</div>`;
  // counts, color bands and a cover painting arrive just after the first paint
  later(() => {
    if (!host.isConnected) return;
    list.forEach(r => {
      const im = host.querySelector(`[data-xbroomim="${CSS.escape(r.id)}"]`), band = host.querySelector(`[data-xbroomband="${CSS.escape(r.id)}"]`), cnt = host.querySelector(`[data-xbroomn="${CSS.escape(r.id)}"]`);
      if (!im) return;
      let cover = -1, cols = [];
      if (r.special === "twins") { const t = F.twins[0]; if (t) { cover = t[0]; xbRoomImg(im, t[1], true); } cnt.textContent = `${F.twins.length} pairs`; cols = t ? glPal(t[0]).map(p => ({ h: p.h, share: p.share })) : []; }
      else if (r.special === "unpainted") { cols = F.unpainted.slice(0, 8).map(u => ({ h: u[1], share: 1 })); cnt.textContent = `${F.unpainted.length} colors`; im.classList.add("flat"); im.innerHTML = cols.slice(0, 4).map(c => `<i style="--c:${c.h}"></i>`).join(""); }
      else {
        const rf = r.mine ? { ...xbFresh(), ...r.f, hexes: (r.f.hexes || []).slice() } : xbRoomF(r); if (!rf) return;
        const res = xbRun(F, rf), sorted = xbSort(F, res, rf.hexes.length ? "most" : "date");
        if (!res.list.length && !r.mine) { const card = im.closest(".xb-room"); if (card) card.remove(); return; }   // a room with nothing in it isn't a way in
        cnt.textContent = xbNum(res.list.length);
        cover = sorted.length ? sorted[Math.min(sorted.length - 1, rf.hexes.length ? 0 : Math.floor(sorted.length / 2))] : -1;
        cols = xbSetColors(F, res.list, 6);
      }
      band.innerHTML = cols.slice(0, 6).map(c => `<i style="--c:${c.h};flex:${Math.max(.08, c.share || 1).toFixed(3)}"></i>`).join("");
      if (cover >= 0) xbRoomImg(im, cover);
    });
  }, 60);
}
function xbRoomImg(host, i, second) {
  glShard(Math.floor(i / GAL.shard)).then(() => {
    const d = glDetailNow(i); if (!d || !d.img || !host.isConnected) return;
    host.insertAdjacentHTML("beforeend", `<img src="${esc(d.img)}" alt="" loading="lazy" decoding="async"${second ? ' class="two"' : ""}>`);
  }).catch(() => {});
}
function xbSaveRoom() {
  const F = XBF, f = XB.f, chips = xbChips(F, f);
  const def = chips.map(c => c.text).slice(0, 3).join(", ");
  const { sh, close } = sheet(`<h3>Save as a room</h3><p>A room keeps these filters, so you can come back to them from Art.</p>
    <label class="search xb-namefield"><input data-xbroomname type="text" maxlength="40" value="${esc(def)}" aria-label="Room name"></label>
    <button class="btn solid" data-xbroomok>Save the room ${ICON.arrow}</button>`);
  const inp = sh.querySelector("[data-xbroomname]");
  sh.querySelector("[data-xbroomok]").onclick = () => {
    const name = inp.value.trim() || def || "My room", id = "u" + Date.now().toString(36);
    xbUser().rooms.unshift({ id, name, f: xbCopy(f), view: XB.view, sort: XB.sort });
    save(); XB.room = id; close(); buzz(8); toast(`Saved "${name}" to your rooms`);
    xbRender(false, false, true);
  };
}
function xbUnsaveRoom() {
  const u = xbUser(), r = u.rooms.find(x => x.id === XB.room); if (!r) return;
  u.rooms = u.rooms.filter(x => x.id !== XB.room); save(); XB.room = ""; buzz(6); toast(`Removed "${r.name}"`);
  xbRender(false, false, true);
}
// ======================================================================
// Views
// ======================================================================
// what these paintings are made of: their pooled colors, each opening its page, and the ColorSet verbs
function xbSetBlock(F, list) {
  const f = XB.f;
  if (!xbChips(F, f).length || list.length < 2) return "";
  const cols = xbSetColors(F, list, 8);
  if (!cols.length) return "";
  XB.setCols = cols;
  const tot = cols.reduce((s, c) => s + c.share, 0) || 1;
  return `<div class="xb-set"><div class="xb-set-strip">${cols.map(c => `<button data-swatch="${c.h}" style="--c:${c.h};flex:${Math.max(.07, c.share / tot).toFixed(3)}" aria-label="${esc(nameOf(c.h).text)}"></button>`).join("")}</div>
    <p class="xb-set-cap">The colors of ${list.length === F.N ? "the whole archive" : `these ${xbPaint(list.length)}`}, pooled and named: ${cols.slice(0, 3).map(c => esc(nameOf(c.h).text.toLowerCase())).join(", ")}…</p><div data-xbacts></div></div>`;
}
function xbWireSet(host) {
  const box = host.querySelector("[data-xbacts]"); if (!box || typeof csActions !== "function") return;
  const F = XBF, title = xbChips(F, XB.f).map(c => c.text).slice(0, 3).join(", ") || "Paintings";
  const set = () => colorSet({ kind: "search", id: xbChips(F, XB.f).map(c => c.dim + ":" + c.text).join("|"), title, colors: (XB.setCols || []).map(c => ({ h: c.h, share: c.share })), src: "explore/art" });
  box.appendChild(csActions(set, { only: ["map", "learn", "play"], back: () => { XB.back = false; xbHome(); } }));
}

// Lazy work for elements near the screen. A scroll listener, not IntersectionObserver: body{overflow-x:hidden}
// makes the body a clipping box, so an observer's rootMargin never reaches below the fold (js/gallery.js glGrid
// works the same way). els are in document order, so the walk stops at the first one past the screen.
function xbLazy(els, fn, margin) {
  let pending = els.slice(), raf = 0;
  const check = () => {
    raf = 0;
    if (!pending.length || !pending[0].isConnected) return off();
    const lo = -margin, hi = innerHeight + margin, keep = [];
    for (let k = 0; k < pending.length; k++) {
      const el = pending[k], r = el.getBoundingClientRect();
      if (r.top > hi) { keep.push(...pending.slice(k)); break; }
      if (r.bottom >= lo) fn(el); else keep.push(el);
    }
    pending = keep;
    if (!pending.length) off();
  };
  const on = () => { if (!raf) raf = requestAnimationFrame(check); };
  const off = () => { removeEventListener("scroll", on, true); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  addEventListener("scroll", on, { passive: true, capture: true }); addEventListener("resize", on);
  cleanup.push(off);
  check();
}

// ---------- Grid: sticky sections, a jump bar, paged sections ----------
let XB_JUMP = null;
function xbJumpOff() { if (XB_JUMP) { XB_JUMP(); XB_JUMP = null; } const j = document.querySelector("[data-xbjump]"); if (j) j.hidden = true; }
function xbTileHTML(i, F, res) {
  const G = F.G, d = glDetailNow(i), dom = glHex(i, F.dom[i]);
  const badge = res.col ? `<em class="mono">${Math.max(1, Math.round(res.col.cov[i] * 100))}%</em>` : "";
  return `<button class="xb-t${d ? "" : " wait"}" data-gi="${i}" style="--c:${dom}" aria-label="${d ? esc(d.t) : "Painting"}">${d && d.img ? `<img src="${esc(d.img)}" alt="" loading="lazy" decoding="async">` : ""}<span class="xb-t-pal">${glPal(i).map(p => `<i style="--c:${p.h};flex:${p.share.toFixed(3)}"></i>`).join("")}</span>${badge}</button>`;
}
function xbFillTiles(root) {
  const want = new Map();
  root.querySelectorAll(".xb-t.wait").forEach(el => { const k = Math.floor(+el.dataset.gi / GAL.shard); if (!want.has(k)) want.set(k, []); want.get(k).push(el); });
  want.forEach((els, k) => glShard(k).then(() => els.forEach(el => {
    if (!el.isConnected || !el.classList.contains("wait")) return;
    const d = glDetailNow(+el.dataset.gi); if (!d) return;
    el.classList.remove("wait"); el.setAttribute("aria-label", d.t + (d.a ? ", " + d.a : ""));
    if (d.img) el.insertAdjacentHTML("afterbegin", `<img src="${esc(d.img)}" alt="" loading="lazy" decoding="async">`);
  })).catch(() => {}));
}
function xbGrid(body, F, res) {
  const sort = xbSortNow(), secs = xbSections(F, res, sort, XB.seed);
  const W = body.clientWidth || Math.min(innerWidth, 540) - 40, cols = W >= 470 ? 4 : 3, gap = 4, tile = (W - gap * (cols - 1)) / cols;
  const base = secs.length === 1 ? 60 : 12;
  const sectional = secs.length > 1;
  const secHTML = (s, k) => {
    const shown = Math.min(s.items.length, XB.show[s.key] || base), rows = Math.ceil(shown / cols), h = rows * tile + Math.max(0, rows - 1) * gap;
    const left = s.items.length - shown;
    return `<section class="xb-sec" data-xbsec="${k}">${sectional ? `<h3 class="xb-sec-h"><b>${esc(s.label)}</b><span>${xbNum(s.items.length)}</span></h3>` : ""}
      <div class="xb-tiles" data-xbtiles="${k}" style="--cols:${cols};height:${h.toFixed(1)}px"></div>
      ${left > 0 || (sectional && s.items.length > 24 && sort !== "painter" || sectional && sort === "painter" && s.key[0] === "a" && s.items.length > 24) ? `<div class="xb-sec-more">
        ${left > 0 ? `<button class="xb-link" data-xbmore="${esc(s.key)}" data-base="${base}">Show ${Math.min(60, left)} more</button>${left > 60 ? `<span class="xb-left">${xbNum(left)} left</span>` : ""}` : ""}
        ${sectional && s.items.length > 24 && (sort === "date" || sort === "painter" && s.key[0] === "a") ? `<button class="xb-link" data-xbonly="${esc(s.key)}">Only ${esc(s.label)}</button>` : ""}</div>` : ""}
    </section>`;
  };
  body.innerHTML = xbSetBlock(F, res.list) + `<div class="xb-grid">${secs.map(secHTML).join("")}</div>` + `<div data-xbpoems></div>`
    + `<p class="fine">Palettes are measured from each museum's small photo: screen approximations, through old varnish. Sorted by ${esc((XB_SORTS.find(s => s[0] === sort) || ["", "date"])[1].toLowerCase())}.</p>`;
  xbWireSet(body);
  const bar = document.querySelector(".xb-screen [data-xbbar]");
  document.querySelector(".xb-screen").style.setProperty("--xbstick", (bar ? bar.offsetHeight : 0) + "px");
  // fill a section's tiles when it comes near the screen
  const fill = el => {
    if (el.dataset.done) return; el.dataset.done = 1;
    const s = secs[+el.dataset.xbtiles], shown = Math.min(s.items.length, XB.show[s.key] || base);
    el.innerHTML = s.items.slice(0, shown).map(i => xbTileHTML(i, F, res)).join("");
    xbFillTiles(el);
  };
  const tilesEls = [...body.querySelectorAll("[data-xbtiles]")];
  xbLazy(tilesEls, fill, 900);
  xbJumpBar(body, secs);
  xbPoemsRail(body.querySelector("[data-xbpoems]"));
}
function xbOnlySection(key) {
  const f = xbCopy(XB.f);
  if (key[0] === "d") { const d = +key.slice(1); f.y0 = d; f.y1 = d + 9; }
  else if (key[0] === "a") { f.painter = +key.slice(1); }
  else return;
  xbSet(f);
}
// the jump bar: labels down the right edge, iOS-style; drag along it to fly through the sections
function xbJumpBar(body, secs) {
  // fixed to the viewport, so it lives on body: .screen animates a transform, which would trap a fixed child
  let nav = document.querySelector("body > [data-xbjump]");
  if (!nav) { nav = document.createElement("nav"); nav.className = "xb-jump"; nav.dataset.xbjump = ""; nav.setAttribute("aria-label", "Jump to a section"); nav.hidden = true; document.body.appendChild(nav); cleanup.push(() => nav.remove()); }
  const targets = xbJumpTargets(secs);
  if (secs.length < 5 || targets.length < 3) { nav.hidden = true; return; }
  // more than ~22 labels won't fit: keep every nth label, but every label still maps to its own section
  const step = Math.ceil(targets.length / 22), shown = targets.filter((_, k) => k % step === 0);
  nav.innerHTML = `${shown.map(t => `<span data-sec="${t.sec}">${esc(t.label.length > 5 ? t.label.slice(0, 3) : t.label)}</span>`).join("")}<b class="xb-jump-bub" hidden></b>`;
  const bub = nav.querySelector(".xb-jump-bub");
  const go = (clientY) => {
    const r = nav.getBoundingClientRect(), p = clamp((clientY - r.top) / r.height, 0, .9999), t = targets[Math.floor(p * targets.length)];
    if (!t || t.sec === nav._at) return;
    nav._at = t.sec;
    const el = body.querySelector(`[data-xbsec="${t.sec}"]`); if (!el) return;
    const stick = parseFloat(getComputedStyle(document.querySelector(".xb-screen")).getPropertyValue("--xbstick")) || 0;
    xbTo(xbSY() + el.getBoundingClientRect().top - stick + 1);
    bub.hidden = false; bub.textContent = secs[t.sec].label; bub.style.top = (clientY - r.top) + "px";
    buzz(4);
  };
  nav.onpointerdown = e => { e.preventDefault(); nav.setPointerCapture(e.pointerId); nav.classList.add("on"); nav._at = -1; go(e.clientY); nav.onpointermove = ev => go(ev.clientY); };
  nav.onpointerup = nav.onpointercancel = () => { nav.onpointermove = null; nav.classList.remove("on"); setTimeout(() => { bub.hidden = true; }, 350); };
  // only while the grid is on screen
  let raf = 0;
  const vis = () => { raf = 0; if (!body.isConnected) return; const r = body.getBoundingClientRect(); nav.hidden = !(r.top < innerHeight * .5 && r.bottom > innerHeight * .6); };
  const on = () => { if (!raf) raf = requestAnimationFrame(vis); };
  addEventListener("scroll", on, { passive: true, capture: true });
  XB_JUMP = () => { removeEventListener("scroll", on, true); cancelAnimationFrame(raf); nav.hidden = true; nav.onpointerdown = null; };
  cleanup.push(() => { if (XB_JUMP) XB_JUMP(); });
  vis();
}
// poems naming the picked color (js/poems.js), as one quiet rail after the paintings
function xbPoemsRail(host) {
  if (!host || XB.f.hexes.length !== 1 || !XB.f.name || typeof artPoemPins !== "function") return;
  artPoemPins(XB.f.name).then(pins => {
    if (!host.isConnected || !pins.length) return;
    host.innerHTML = `<div class="sec-head xb-h"><b>In poems</b><span>${esc(XB.f.name.toLowerCase())}, named in verse</span></div><div class="xb-poems">${pins.slice(0, 6).map(p => p.html).join("")}</div>`;
  }).catch(() => {});
}
// nothing matches: say so, and offer the nearest loosenings with their counts
function xbZero(body, F, f) {
  const tries = xbLoosen(F, f);
  body.innerHTML = `<div class="xb-empty"><b>No painting matches all of that.</b><p>${tries.length ? "The nearest ways back:" : "Try fewer filters."}</p>
    ${tries.map(t => `<button class="xb-loosen" data-xbloosen='${esc(JSON.stringify(t.f))}'><span>${esc(t.label)}</span><em class="mono">${xbNum(t.n)}</em></button>`).join("")}</div>`;
}
// ---------- River: five centuries of color, scrubbed ----------
// Bands are the nine families (by CIELAB hue), each tinted per decade by that family's own average color there.
// A band's thickness follows how many paintings the decade has here, so collecting bias stays visible.
const XB_RIVER_ORDER = [8, 3, 0, 1, 7, 6, 5, 4, 2];   // greys at the bottom, then browns, reds, pinks, purples, blues, greens, yellows, oranges
function xbRiver(body, F, res) {
  const G = F.G, list = res.list, D = XB_NDEC;
  const n = new Int32Array(D), fs = new Float32Array(D * 9), fc = new Float32Array(D * 27);
  for (let q = 0; q < list.length; q++) {
    const i = list[q], d = F.dec[i]; if (d < 0) continue;
    n[d]++;
    for (let j = 0; j < 6; j++) { const m = i * 6 + j, fm = F.fam[m], s = G.sh[m], o = (d * 9 + fm) * 3; fs[d * 9 + fm] += s; fc[o] += G.rgb[m * 3] * s; fc[o + 1] += G.rgb[m * 3 + 1] * s; fc[o + 2] += G.rgb[m * 3 + 2] * s; }
  }
  let d0 = n.findIndex(v => v >= 3), d1 = D - 1; while (d1 > 0 && n[d1] < 3) d1--;
  if (d0 < 0 || d1 - d0 < 4) { body.innerHTML = `<div class="xb-empty"><b>Not enough time here for a river.</b><p>These paintings span ${d0 < 0 ? "too few dated works" : "under fifty years"}. The river needs at least five decades.</p><button class="btn ghost" data-xbview="grid">See them in the grid</button></div>`; return; }
  const W = body.clientWidth || 335, H = 190, span = d1 - d0, x = d => (d - d0) / span * W, max = Math.max(...n.slice(d0, d1 + 1));
  const th = d => n[d] ? H * .94 * (.16 + .84 * Math.sqrt(n[d] / max)) : H * .04;
  const share = (d, fm) => { let t = 0; for (let k = 0; k < 9; k++) t += fs[d * 9 + k]; return t ? fs[d * 9 + fm] / t : 0; };
  const sm = (d, fm) => { const a = share(Math.max(d0, d - 1), fm), b = share(d, fm), c = share(Math.min(d1, d + 1), fm); return (a + 2 * b + c) / 4; };
  const famHex = (d, fm) => { const s = fs[d * 9 + fm], o = (d * 9 + fm) * 3; return s > 1e-4 ? "#" + [fc[o], fc[o + 1], fc[o + 2]].map(v => clamp(Math.round(v / s), 0, 255).toString(16).padStart(2, "0")).join("") : null; };
  let defs = "", paths = "";
  const lower = new Float32Array(D);
  for (let d = d0; d <= d1; d++) lower[d] = H / 2 - th(d) / 2;
  XB_RIVER_ORDER.forEach((fm, k) => {
    const top = [], bot = [], stops = [];
    let fall = null;
    for (let d = d0; d <= d1; d++) { const h = famHex(d, fm); if (h) { fall = fall || h; } }
    for (let d = d0; d <= d1; d++) {
      const t = th(d), y0 = lower[d], y1 = y0 + sm(d, fm) * t;
      bot.push([x(d), y0]); top.push([x(d), y1]); lower[d] = y1;
      stops.push(`<stop offset="${((d - d0) / span).toFixed(4)}" stop-color="${famHex(d, fm) || fall || "#555"}"/>`);
    }
    if (!fall) return;
    defs += `<linearGradient id="xbrg${k}" x1="0" x2="1" y1="0" y2="0">${stops.join("")}</linearGradient>`;
    const pts = [...top, ...bot.reverse()].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
    paths += `<polygon points="${pts}" fill="url(#xbrg${k})"/>`;
  });
  // thin decades (under 25 paintings here) are hatched over: read them lightly
  let hatch = "";
  for (let d = d0; d <= d1; d++) if (n[d] < 25) hatch += `<rect x="${(x(d) - W / span / 2).toFixed(1)}" y="0" width="${(W / span).toFixed(1)}" height="${H}" fill="url(#xbhatch)"/>`;
  const ticks = []; for (let d = d0; d <= d1; d++) if ((XB_DEC0 + d * 10) % 100 === 0) ticks.push(d);
  const tickStep = ticks.length > 7 ? 2 : 1;
  const best = (() => { let b = d0; for (let d = d0; d <= d1; d++) if (n[d] > n[b]) b = d; return b; })();
  let sel = XB.riverSel != null && XB.riverSel >= d0 && XB.riverSel <= d1 && n[XB.riverSel] ? XB.riverSel : best;
  body.innerHTML = xbSetBlock(F, list) + `
    <div class="xb-river" data-xbriver>
      <svg viewBox="0 0 ${W} ${H + 22}" width="${W}" height="${H + 22}" aria-label="Color families by decade, ${XB_DEC0 + d0 * 10}s to ${XB_DEC0 + d1 * 10}s">
        <defs>${defs}<pattern id="xbhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="rgba(14,13,11,.18)"/><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(236,232,223,.12)" stroke-width="1.2"/></pattern></defs>
        ${paths}${hatch}
        ${ticks.filter((_, k) => k % tickStep === 0).map(d => `<text x="${x(d).toFixed(1)}" y="${H + 16}" text-anchor="middle">${XB_DEC0 + d * 10}</text>`).join("")}
        <line class="xb-rv-line" data-xbrvline x1="0" x2="0" y1="0" y2="${H}"/>
      </svg>
      <span class="xb-rv-knob" data-xbrvknob></span>
    </div>
    <p class="xb-rv-hint">Drag along the river to move through time.</p>
    <div class="xb-rv-panel" data-xbrvpanel></div>
    <p class="fine">Each band is a family of colors (grouped by hue), tinted by its own average color in that decade, as photographed through old varnish. A band's thickness follows how many paintings that decade has here, which says as much about what museums collected as about what painters used. Hatched decades have fewer than 25 paintings.</p>`;
  xbWireSet(body);
  const base = xbCellShares(F, list);
  const river = body.querySelector("[data-xbriver]"), line = body.querySelector("[data-xbrvline]"), knob = body.querySelector("[data-xbrvknob]"), panel = body.querySelector("[data-xbrvpanel]");
  const draw = d => {
    sel = d; XB.riverSel = d;
    line.setAttribute("x1", x(d)); line.setAttribute("x2", x(d)); knob.style.left = x(d) + "px";
    const yr = XB_DEC0 + d * 10, items = xbSort(F, { list: list.filter(i => F.dec[i] === d), col: res.col }, res.col ? "most" : "date");
    // the decade's makeup, so collecting bias stays visible: its biggest country and its biggest museum
    const top = (arr, skip0) => { const c = new Map(); items.forEach(i => { const v = arr[i]; if (!(skip0 && !v)) c.set(v, (c.get(v) || 0) + 1); }); const e = [...c.entries()].sort((a, b) => b[1] - a[1])[0]; return e ? { k: e[0], pct: Math.round(e[1] / items.length * 100) } : null; };
    const tc = top(F.country, true), tm = top(G.mus, false);
    const mk = items.length ? [tc ? `${tc.pct}% from ${esc(F.meta.countries[tc.k - 1])}` : "", tm ? `${tm.pct}% from ${esc(G.src[tm.k].name)}` : ""].filter(Boolean).join("; ") : "";
    const dist = items.length ? xbSetColors(F, items, 5, base) : [];
    panel.innerHTML = `<div class="xb-rv-head"><b>${yr}s</b><span>${xbPaint(items.length)}</span></div>
      ${mk ? `<p class="xb-rv-mk">${mk.charAt(0).toUpperCase() + mk.slice(1)}.${items.length < 25 ? ` Only ${items.length} here, so read this decade lightly.` : ""}</p>` : ""}
      ${dist.length ? `<p class="xb-rv-sub">Colors this decade holds more of than the rest:</p><div class="xb-rv-cols">${dist.map(c => `<button class="xb-chip" data-swatch="${c.h}"><i style="--c:${c.h}"></i><span>${esc(nameOf(c.h).text)}</span><em class="mono">${c.lift >= 10 ? "10×+" : c.lift.toFixed(1) + "×"}</em></button>`).join("")}</div>` : `<p class="xb-rv-sub">No color stands out from the rest here.</p>`}
      <div class="xb-rail">${items.slice(0, 12).map(i => xbTileHTML(i, F, res)).join("")}</div>
      ${items.length > 1 ? `<button class="btn ghost" data-xbonly="d${yr}">Only the ${yr}s, in the grid ${ICON.arrow}</button>` : ""}`;
    xbFillTiles(panel);
  };
  const at = clientX => { const r = river.getBoundingClientRect(); let d = Math.round(d0 + clamp((clientX - r.left) / r.width, 0, 1) * span); if (!n[d]) { let k = 1; while (k < span && !n[clamp(d + k, d0, d1)] && !n[clamp(d - k, d0, d1)]) k++; d = n[clamp(d - k, d0, d1)] ? clamp(d - k, d0, d1) : clamp(d + k, d0, d1); } return d; };
  let raf = 0, want = sel;
  river.addEventListener("pointerdown", e => {
    river.setPointerCapture(e.pointerId); river.classList.add("drag");
    const mv = ev => { const d = at(ev.clientX); if (d === want) return; want = d; buzz(4); if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(want); }); };
    mv(e); river.onpointermove = mv;
    river.onpointerup = river.onpointercancel = () => { river.onpointermove = null; river.classList.remove("drag"); };
  });
  draw(sel);
}

// ---------- Painters: a row each, with a strip of their paintings' colors in date order ----------
function xbPainters(body, F, res) {
  const G = F.G, by = new Map();
  let unknown = 0;
  res.list.forEach(i => { const a = F.artist[i]; if (!a) { unknown++; return; } if (!by.has(a)) by.set(a, []); by.get(a).push(i); });
  const rows = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);
  if (!rows.length) { body.innerHTML = `<div class="xb-empty"><b>No named painter here.</b><p>All ${xbPaint(unknown)} in this selection are by unknown artists.</p></div>`; return; }
  const shown = Math.min(rows.length, XB.show.painters || 30);
  const yrs = items => { const ys = items.map(i => G.year[i]).filter(y => y !== GL_UNDATED); return ys.length ? (Math.min(...ys) === Math.max(...ys) ? String(Math.min(...ys)) : `${Math.min(...ys)}–${Math.max(...ys)}`) : "undated"; };
  body.innerHTML = xbSetBlock(F, res.list) + `<p class="xb-pr-lead">${xbNum(rows.length)} ${rows.length === 1 ? "painter" : "painters"}, most paintings here first. Each strip is one painter's paintings in date order, every column one painting with its colors stacked by share, dark at the bottom.</p>
    <div class="xb-prs">${rows.slice(0, shown).map(([a, items]) => {
      const m = F.meta.artists[a - 1], co = F.country[items[0]];
      return `<button class="xb-pr" data-xbpainter="${a}"><canvas class="xb-strip" data-xbstrip="${a}" aria-hidden="true"></canvas><span class="xb-pr-t"><b>${esc(m[0])}</b><small>${xbPaint(items.length)} here${m[2] > items.length ? ` of ${m[2]}` : ""} · ${yrs(items)}${co ? " · " + esc(F.meta.countries[co - 1]) : ""}</small></span>${ICON.chev}</button>`;
    }).join("")}</div>
    ${rows.length > shown ? `<button class="xb-link xb-more-rows" data-xbmore="painters" data-base="30" data-step="30">Show ${Math.min(30, rows.length - shown)} more painters</button>` : ""}
    <p class="fine">${unknown ? `${xbPaint(unknown)} by unknown artists are not listed. ` : ""}The archive keeps at most 50 paintings per painter, so a strip is a sample of a life's work, as photographed.</p>`;
  xbWireSet(body);
  const map = new Map(rows);
  const draw = cv => {
    const a = +cv.dataset.xbstrip, items = (map.get(a) || []).slice().sort((p, q) => (G.year[p] === GL_UNDATED ? 1e5 : G.year[p]) - (G.year[q] === GL_UNDATED ? 1e5 : G.year[q]));
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 300, h = cv.clientHeight || 40;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const cx = cv.getContext("2d"), cols = Math.min(items.length, Math.floor(w / 3)), cw = cv.width / Math.max(cols, 1);
    for (let k = 0; k < cols; k++) {
      const i = items[Math.floor(k * items.length / cols)], pal = glPal(i).sort((p, q) => lch(q.h)[0] - lch(p.h)[0]);
      let y = 0; const tot = pal.reduce((s, p) => s + p.share, 0) || 1;
      pal.forEach(p => { const hh = p.share / tot * cv.height; cx.fillStyle = p.h; cx.fillRect(Math.floor(k * cw), Math.floor(y), Math.ceil(cw) - (cols > 40 ? 0 : 1), Math.ceil(hh)); y += hh; });
    }
  };
  xbLazy([...body.querySelectorAll("[data-xbstrip]")], draw, 400);
}
// a painter: their page (L11's painter pages) when it exists, else this archive filtered to them
function xbOpenPainter(a) {
  const F = XBF, m = F && F.meta.artists[a - 1]; if (!m) return;
  if (m[3] && typeof awPainter === "function") { XB.y = xbSY(); XB.back = true; return awPainter(m[1]); }   // L11's art wiki, #/painter/<slug>
  if (m[3] && typeof painterPage === "function") { XB.y = xbSY(); XB.back = true; return painterPage(m[1]); }
  const f = xbCopy(XB.f); f.painter = a;
  xbSet(f, { view: "grid", sort: "date" });
}

// ---------- Wall: the whole set as one mosaic sorted by hue; tap to look closer ----------
function xbHueOrder(F, list) {
  const G = F.G, key = new Float32Array(list.length);
  list.forEach((i, q) => { const m = i * 6 + F.dom[i], L = G.lab[m * 3], C = G.ch[m], H = G.hu[m]; key[q] = C < 9 ? 1000 + (100 - L) : (H + 340) % 360 + (100 - L) / 300; });
  return Array.from(list.keys()).sort((a, b) => key[a] - key[b]).map(q => list[q]);
}
function xbWall(body, F, res) {
  const order = xbHueOrder(F, Array.from(res.list)), N = order.length, W = body.clientWidth || 335;
  const close = XB.wall.level === 1;
  const cols = close ? (W >= 470 ? 10 : 8) : Math.max(24, Math.floor(W / (N > 6000 ? 6 : N > 1500 ? 9 : 14))), cell = W / cols, rows = Math.ceil(N / cols);
  body.innerHTML = xbSetBlock(F, res.list) + `<div class="xb-wall-head"><p>${close ? `Each tile is one painting's six colors, sized by share. Tap one to open it.` : `${xbPaint(N)}, one square each in its main color, sorted by hue. Tap anywhere to look closer.`}</p>${close ? `<button class="xb-link" data-xbwallout>Back to the whole wall</button>` : ""}</div>
    <div class="xb-wall" data-xbwall style="height:${(rows * cell).toFixed(1)}px"></div><p class="fine">Main colors as photographed. Greys and near-neutrals sit at the end, light to dark.</p>`;
  xbWireSet(body);
  const wall = body.querySelector("[data-xbwall]"), G = F.G, dpr = Math.min(2, devicePixelRatio || 1);
  const CH = close ? 30 : rows;   // rows per canvas chunk (one canvas for the overview)
  const drawChunk = (cv, r0) => {
    const r1 = Math.min(rows, r0 + CH), h = (r1 - r0) * cell;
    cv.width = Math.round(W * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + "px";
    const cx = cv.getContext("2d"); cx.scale(dpr, dpr);
    for (let r = r0; r < r1; r++) for (let c = 0; c < cols; c++) {
      const q = r * cols + c; if (q >= N) break;
      const i = order[q], x = c * cell, y = (r - r0) * cell;
      if (!close) { cx.fillStyle = glHex(i, F.dom[i]); cx.fillRect(x, y, cell + .5, cell + .5); continue; }
      const pal = glPal(i); let yy = y + 1; const inner = cell - 2;
      pal.forEach(p => { const hh = p.share * inner; cx.fillStyle = p.h; cx.fillRect(x + 1, yy, inner, hh + .5); yy += hh; });
    }
  };
  const chunks = Math.ceil(rows / CH);
  wall.innerHTML = Array.from({ length: chunks }, (_, k) => `<canvas data-r0="${k * CH}" style="top:${(k * CH * cell).toFixed(1)}px"></canvas>`).join("");
  xbLazy([...wall.querySelectorAll("canvas")], cv => drawChunk(cv, +cv.dataset.r0), 700);
  wall.onclick = e => {
    const r = wall.getBoundingClientRect(), c = Math.floor((e.clientX - r.left) / cell), rr = Math.floor((e.clientY - r.top) / cell), q = rr * cols + c;
    if (c < 0 || c >= cols || q < 0 || q >= N) return;
    if (close) { XB.y = xbSY(); XB.back = true; buzz(6); return galleryPage(order[q], true, XB.f.hexes[0] || null); }
    XB.wall = { level: 1, at: q }; buzz(6);
    xbRender(false, true, true);
    const w2 = document.querySelector("[data-xbwall]"); if (!w2) return;
    const cols2 = W >= 470 ? 10 : 8, cell2 = W / cols2, y = w2.getBoundingClientRect().top + xbSY() + Math.floor(q / cols2) * cell2 - innerHeight / 2;
    xbTo(Math.max(0, y));
  };
  const out = body.querySelector("[data-xbwallout]");
  if (out) out.onclick = () => { const at = XB.wall.at; XB.wall = { level: 0, at: -1 }; buzz(5); xbRender(false, true, true); const w2 = document.querySelector("[data-xbwall]"); if (w2 && at >= 0) { const c2 = Math.max(24, Math.floor(W / (N > 6000 ? 6 : N > 1500 ? 9 : 14))); xbTo(Math.max(0, w2.getBoundingClientRect().top + xbSY() + Math.floor(at / c2) * (W / c2) - innerHeight / 2)); } };
}

// ---------- the special rooms ----------
function xbTwins(body, F) {
  const G = F.G, shown = Math.min(F.twins.length, XB.show.twins || 12);
  const yr = i => glYear(i) || "undated";
  body.innerHTML = `<p class="xb-pr-lead">Paintings made a century or more apart whose palettes nearly match: the same colors in nearly the same amounts. Tap either one to open it.</p>
    <div class="xb-twins">${F.twins.slice(0, shown).map(([a, b, d]) => `<div class="xb-twin">
      <div class="xb-twin-pair">${[a, b].map(i => `<button class="xb-t wait" data-gi="${i}" style="--c:${glHex(i, F.dom[i])}"><span class="xb-t-pal">${glPal(i).map(p => `<i style="--c:${p.h};flex:${p.share.toFixed(3)}"></i>`).join("")}</span></button>`).join("")}</div>
      <div class="xb-twin-yrs"><b>${yr(a)}</b><span class="mono">${pctDiff(d)}</span><b>${yr(b)}</b></div></div>`).join("")}</div>
    ${F.twins.length > shown ? `<button class="xb-link xb-more-rows" data-xbmore="twins" data-base="12" data-step="12">Show ${Math.min(12, F.twins.length - shown)} more pairs</button>` : ""}
    <p class="fine">Paired by palette only, as photographed. Not influence: two painters can arrive at the same colors for different reasons. Both paintings in a pair are colorful and not dark-keyed, so the match isn't just shared brown varnish.</p>`;
  xbFillTiles(body);
}
function xbUnpainted(body, F) {
  body.innerHTML = `<p class="xb-pr-lead">${F.unpainted.length} named colors that no painting here comes within 8% of, checked against 24 measured colors in every one of the ${xbNum(F.N)} paintings. Most are electric violets, purples and acid greens: screen colors that these photographed, varnished paintings never reach. Tap one to open its page.</p>
    <div class="xb-unp">${F.unpainted.map(([n, h, d]) => `<button class="xb-unp-t" data-swatch="${h}" style="--c:${h}" data-ink="${ink(h)}"><b>${esc(n)}</b><small>nearest painting color ${pctDiff(d)}</small></button>`).join("")}</div>
    <p class="fine">As photographed: a painting's real colors under a fresh light may reach further than its museum photograph does. Screen colors are approximate.</p>`;
}
// ======================================================================
// Sheets: one per facet, each with live counts; results behind them update as you choose
// ======================================================================
const XB_MOOD_NOTE = "Compared with the rest of this archive, as photographed. Most of it is dark and warm (old varnish yellows and darkens paint), so \"cooler\" means cooler than most paintings here.";
function xbFacetSheet(dim) {
  if (!XBF || document.querySelector(".xb-sheet")) return;
  if (dim === "color") return xbDial({ hex: XB.f.hexes.length === 1 ? XB.f.hexes[0] : null });
  const F = XBF, titles = { when: "When", painter: "Painter", mood: "Mood", size: "Palette size", mus: "Museum", co: "Country", mv: "Movement" };
  const { sh, close } = sheet(`<div class="xb-sh-top"><b>${titles[dim] || ""}</b><span data-xbshn></span></div><div class="xb-sh" data-xbsh></div><button class="btn xb-sh-go" data-xbshgo></button>`);
  sh.classList.add("xb-sheet");
  let q = "";
  const opt = (d, v, label, cnt, on) => `<button class="xb-opt${on ? " on" : ""}${!cnt && !on ? " zero" : ""}" data-xbopt="${d}" data-v="${v}"><span>${esc(label)}</span><em class="mono">${xbNum(cnt)}</em></button>`;
  const draw = () => {
    const res = xbQuery(F, XB.f), c = res.counts, f = XB.f, n = res.list.length, box = sh.querySelector("[data-xbsh]");
    sh.querySelector("[data-xbshn]").textContent = xbPaint(n);
    sh.querySelector("[data-xbshgo]").innerHTML = n ? `Show ${xbPaint(n)} ${ICON.arrow}` : "Nothing matches yet";
    if (dim === "when") return xbWhenBox(box, F, f, c, draw);
    if (dim === "painter") {
      const norm = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const all = F.meta.artists.map((a, k) => ({ a: k + 1, name: a[0], n: c.painter[k + 1], tot: a[2] }));
      const hits = (q ? all.filter(x => norm(x.name).includes(norm(q))) : all.filter(x => x.n > 0)).sort((x, y) => (y.n - x.n) || (y.tot - x.tot)).slice(0, 60);
      const keep = box.querySelector("[data-xbpq]");
      if (!keep) box.innerHTML = `<label class="search"><span>${ICON.search}</span><input data-xbpq type="search" placeholder="Search ${xbNum(F.meta.artists.length)} painters" autocomplete="off"></label><div data-xbplist></div>`;
      const list = box.querySelector("[data-xbplist]");
      list.innerHTML = (f.painter ? opt("painter", 0, "Any painter", n, false) : "") + (hits.length ? hits.map(x => opt("painter", x.a, x.name, x.n, f.painter === x.a)).join("") : `<p class="xb-none">No painter by that name here.</p>`);
      if (!keep) { const inp = box.querySelector("[data-xbpq]"); inp.addEventListener("input", () => { q = inp.value.trim(); draw(); }); }
      return;
    }
    if (dim === "mood") {
      const row = (d, labels) => `<div class="xb-optrow"><p>${{ key: "Value key", chroma: "Color strength", temp: "Temperature", contrast: "Contrast" }[d]}</p><div>${labels.map((t, v) => opt(d, v, t, c[d][v], f[d] === v)).join("")}</div></div>`;
      box.innerHTML = row("key", ["Dark", "Mid", "Light"]) + row("chroma", ["Muted", "Middling", "Vivid"]) + row("temp", ["Cooler", "Middling", "Warmer"]) + row("contrast", ["Soft", "Middling", "Strong"])
        + `<div class="xb-optrow"><p>Recipes for a look (ours)</p><div class="xb-recipes">${XB_ROOMS.filter(r => r.recipe).map(r => `<button class="xb-opt" data-xbrecipe="${r.id}"><span>${esc(r.name)}</span><em>${esc(r.note.toLowerCase())}</em></button>`).join("")}</div></div>
        <p class="fine">${XB_MOOD_NOTE}</p>`;
      return;
    }
    if (dim === "size") {
      box.innerHTML = `<div class="xb-optrow"><div>${XB_SIZE.map((t, v) => opt("size", v, ["Minimal", "Balanced", "Rich"][v], c.size[v], f.size === v)).join("")}</div></div>
        <p class="fine">Palette size is the effective number of colors (from the entropy of each painting's 24-color pool): a minimal painting spends most of its canvas on a few colors; a rich one spreads it across many. Thirds of this archive.</p>`;
      return;
    }
    const lists = { mus: [G => G.src.map((s, k) => [k, s.name]), "mus", -1], co: [() => F.meta.countries.map((s, k) => [k + 1, s]), "co", 0], mv: [() => F.meta.movements.map((s, k) => [k + 1, s]), "mv", 0] };
    const [mk, key, none] = lists[dim];
    const items = mk(F.G).map(([v, name]) => ({ v, name, n: c[key][v] })).filter(x => x.n > 0 || f[key] === x.v).sort((a, b) => b.n - a.n);
    box.innerHTML = (f[key] !== none ? opt(key, none, `Any ${titles[dim].toLowerCase()}`, n, false) : "") + items.map(x => opt(key, x.v, x.name, x.n, f[key] === x.v)).join("")
      + (dim === "co" ? `<p class="fine">Usually the painter's nationality, not where the painting was made.</p>` : dim === "mv" ? `<p class="fine">Movements are labeled for only a few museums' paintings, so most of the archive has none.</p>` : "");
  };
  sh.addEventListener("click", e => {
    const o = e.target.closest("[data-xbopt]");
    if (o) {
      const d = o.dataset.xbopt, v = +o.dataset.v, f = xbCopy(XB.f), none = xbFresh()[d];
      f[d] = f[d] === v ? none : v;
      xbSet(f, { room: "" }); return draw();
    }
    const r = e.target.closest("[data-xbrecipe]");
    if (r) { const room = xbRoomById(r.dataset.xbrecipe); const f = xbCopy(XB.f); ["key", "chroma", "temp", "contrast"].forEach(k => { f[k] = room.f[k] != null ? room.f[k] : -1; }); xbSet(f, { room: room.id, noRecent: true }); return draw(); }
    if (e.target.closest("[data-xbshgo]")) return close();
  });
  onKey = e => { if (e.key === "Escape") close(); };
  draw();
}
// when: a histogram of the decades (counted with every other filter on) under a two-handled range
function xbWhenBox(box, F, f, c, redraw) {
  let lo = c.when.findIndex((v, d) => d < XB_NDEC && v > 0), hi = XB_NDEC - 1; while (hi > 0 && !c.when[hi]) hi--;
  if (lo < 0) { box.innerHTML = `<p class="xb-none">None of these paintings is dated.</p>`; return; }
  if (f.y0 != null) lo = Math.min(lo, Math.floor((f.y0 - XB_DEC0) / 10)); if (f.y1 != null) hi = Math.max(hi, Math.floor((f.y1 - XB_DEC0) / 10));
  lo = clamp(lo, 0, XB_NDEC - 1); hi = clamp(hi, lo + 1, XB_NDEC - 1);
  const span = hi - lo + 1, max = Math.max(1, ...c.when.slice(lo, hi + 1));
  let a = f.y0 != null ? clamp(Math.floor((f.y0 - XB_DEC0) / 10), lo, hi) : lo, b = f.y1 != null ? clamp(Math.floor((f.y1 - XB_DEC0) / 10), lo, hi) : hi;
  const cents = []; for (let d = lo; d <= hi; d++) if ((XB_DEC0 + d * 10) % 100 === 0 || d === lo) cents.push(Math.floor((XB_DEC0 + d * 10) / 100) * 100);
  const uniq = [...new Set(cents)];
  box.innerHTML = `<p class="xb-when-v" data-xbwv></p>
    <div class="xb-hist" data-xbhist>${Array.from({ length: span }, (_, k) => `<i style="height:${Math.max(2, Math.sqrt(c.when[lo + k] / max) * 100).toFixed(1)}%"></i>`).join("")}<span class="xb-hk" data-k="0"></span><span class="xb-hk" data-k="1"></span></div>
    <div class="xb-hist-ax"><span>${XB_DEC0 + lo * 10}</span><span>${XB_DEC0 + hi * 10 + 9}</span></div>
    <div class="xb-cents">${uniq.map(y => `<button data-xbcent="${y}" class="${f.y0 === y && f.y1 === y + 99 ? "on" : ""}">${y}s</button>`).join("")}</div>
    ${c.when[XB_NDEC] ? `<p class="fine">${xbPaint(c.when[XB_NDEC])} here are undated; a date range leaves them out.</p>` : ""}`;
  const hist = box.querySelector("[data-xbhist]"), ks = hist.querySelectorAll(".xb-hk"), bars = hist.querySelectorAll("i"), v = box.querySelector("[data-xbwv]");
  const place = () => {
    ks[0].style.left = (a / span * 100) + "%"; ks[1].style.left = ((b + 1) / span * 100) + "%";
    bars.forEach((el, k) => el.classList.toggle("in", lo + k >= a && lo + k <= b));
    v.innerHTML = `<b>${XB_DEC0 + a * 10}–${XB_DEC0 + b * 10 + 9}</b>`;
  };
  const commit = () => {
    const g = xbCopy(XB.f);
    if (a === lo && b === hi && f.y0 == null && f.y1 == null) return;
    g.y0 = XB_DEC0 + a * 10; g.y1 = XB_DEC0 + b * 10 + 9;
    xbSet(g, { room: "" }); redraw();
  };
  hist.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation(); hist.setPointerCapture(e.pointerId);
    const at = ev => { const r = hist.getBoundingClientRect(); return lo + clamp(Math.floor((ev.clientX - r.left) / r.width * span), 0, span - 1); };
    const d0 = at(e), which = Math.abs(d0 - a) <= Math.abs(d0 - b) ? 0 : 1;
    const mv = ev => { const d = at(ev); const na = which ? a : Math.min(d, b), nb = which ? Math.max(d, a) : b; if (na !== a || nb !== b) { a = na; b = nb; place(); buzz(4); } };
    mv(e); hist.onpointermove = mv;
    hist.onpointerup = hist.onpointercancel = () => { hist.onpointermove = null; commit(); };
  });
  hist.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });
  box.querySelector(".xb-cents").onclick = e => {
    const bt = e.target.closest("[data-xbcent]"); if (!bt) return;
    const y = +bt.dataset.xbcent, g = xbCopy(XB.f), on = g.y0 === y && g.y1 === y + 99;
    g.y0 = on ? null : y; g.y1 = on ? null : y + 99;
    xbSet(g, { room: "" }); redraw();
  };
  place();
}
function xbSortSheet() {
  if (document.querySelector(".xb-sheet")) return;
  const col = XB.f.hexes.length > 0, cur = xbSortNow();
  const { sh, close } = sheet(`<div class="xb-sh-top"><b>Sort</b></div><div class="xb-sh">${XB_SORTS.filter(s => col || (s[0] !== "most" && s[0] !== "closest")).map(([k, t]) => `<button class="xb-opt${k === cur ? " on" : ""}" data-xbs="${k}"><span>${t}</span><em>${{ most: "grouped by share of the canvas", closest: "grouped by how close", date: "grouped by decade", painter: "grouped A to Z", shuffle: "a new order each time" }[k]}</em></button>`).join("")}</div>`);
  sh.classList.add("xb-sheet");
  sh.onclick = e => {
    const b = e.target.closest("[data-xbs]"); if (!b) return;
    if (b.dataset.xbs === "shuffle") XB.seed = (XB.seed * 48271 + 11) % 2147483647 || 7;
    XB.sort = b.dataset.xbs; XB.show = {}; buzz(6); close(); xbRender(true, true);
  };
}

// ---------- the color dial: hue ring x a lightness/strength square, nearest name live; type a name; your colors ----------
const XB_LMIN = 6, XB_LMAX = 97;
let XB_CMAX = null;   // per whole degree of hue: the strongest in-gamut chroma at any lightness
function xbCmax(H) {
  if (!XB_CMAX) XB_CMAX = new Float32Array(360);
  const k = Math.round(H) % 360;
  if (XB_CMAX[k]) return XB_CMAX[k];
  let best = 20;
  for (let L = XB_LMIN; L <= XB_LMAX; L += 3) { let lo = 0, hi = 140; while (hi - lo > 1) { const m = (lo + hi) / 2; if (inGamut(L, m * Math.cos(k * Math.PI / 180), m * Math.sin(k * Math.PI / 180))) lo = m; else hi = m; } if (lo > best) best = lo; }
  return (XB_CMAX[k] = best);
}
function xbDial(o = {}) {
  if (document.querySelector(".xb-sheet")) return;
  loadCoreNames();
  const start = o.hex || (XB.f.hexes.length === 1 ? XB.f.hexes[0] : "#3E6B8A");
  let [L, C, H] = lch(start);
  L = clamp(L, XB_LMIN, XB_LMAX);
  const fav = xbFavorites(), learning = xbLearning(), recent = xbUser().recent;
  const chips = (list, label, setName) => list.length ? `<div class="xb-dial-row"><p>${label}</p><div class="xb-dial-chips">${setName && list.length > 1 ? `<button class="xb-chip xb-chip-set" data-xbdset="${esc(setName)}" data-hexes="${list.slice(0, 12).map(c => c.h).join(",")}"><span class="xb-chip-pie">${list.slice(0, 4).map(c => `<i style="--c:${c.h}"></i>`).join("")}</span><span>All ${Math.min(12, list.length)} together</span></button>` : ""}${list.slice(0, 12).map(c => `<button class="xb-chip" data-xbdhex="${c.h}" data-n="${esc(c.n || "")}"><i style="--c:${c.h}"></i><span>${esc(c.n || nameOf(c.h).text)}</span></button>`).join("")}</div></div>` : "";
  const { sh, close } = sheet(`
    <div class="xb-dial-top"><span class="xb-dial-sw" data-xbdsw></span><div><b data-xbdname></b><em class="mono" data-xbdhex></em></div></div>
    <div class="xb-dial" data-xbdialbox><canvas data-xbring></canvas><canvas data-xbsq></canvas><i class="xb-dk" data-xbdkr></i><i class="xb-dk" data-xbdks></i></div>
    <p class="xb-dial-help">Turn the ring for the hue. In the square, up is lighter and right is stronger.</p>
    <button class="btn" data-xbdgo>Find paintings in this color ${ICON.arrow}</button>
    ${XB.f.hexes.length ? `<button class="btn ghost" data-xbdoff>Any color: remove the color filter</button>` : ""}
    <label class="search xb-dial-q"><span>${ICON.search}</span><input data-xbq type="search" placeholder="Type a color name" autocomplete="off" autocapitalize="off"></label>
    <div data-xbqres></div>
    <div class="xb-dial-src"><button class="xb-tool" data-xbdphoto="photo">${XB_IC_PHOTO}<span>From a photo</span></button><button class="xb-tool" data-xbdphoto="camera">${ICON.camera}<span>From the camera</span></button></div>
    ${chips(learning, "Colors you're learning", "Colors you're learning")}${chips(fav, "Your favorites", "Your favorite colors")}${chips(recent, "Recent", "")}`);
  sh.classList.add("xb-sheet", "xb-dial-sheet");
  const box = sh.querySelector("[data-xbdialbox]"), ring = sh.querySelector("[data-xbring]"), sq = sh.querySelector("[data-xbsq]"), kr = sh.querySelector("[data-xbdkr]"), ks = sh.querySelector("[data-xbdks]");
  const S0 = Math.min(264, (sh.clientWidth || 340) - 48), R = S0 / 2, TH = 24, side = Math.floor((R - TH - 8) * Math.SQRT2), dpr = Math.min(2, devicePixelRatio || 1);
  box.style.width = box.style.height = S0 + "px";
  ring.width = ring.height = Math.round(S0 * dpr); ring.style.width = ring.style.height = S0 + "px";
  sq.width = sq.height = Math.round(side * dpr); Object.assign(sq.style, { width: side + "px", height: side + "px", left: (R - side / 2) + "px", top: (R - side / 2) + "px" });
  // the ring: each hue at its strongest, at a middle lightness
  {
    const cx = ring.getContext("2d"); cx.scale(dpr, dpr);
    for (let a = 0; a < 360; a++) {
      const c = Math.min(xbCmax(a) * .8, 75);
      cx.beginPath(); cx.strokeStyle = lchHex(64, Math.min(c, (() => { let lo = 0, hi = c; while (hi - lo > .5) { const m = (lo + hi) / 2; if (inGamut(64, m * Math.cos(a * Math.PI / 180), m * Math.sin(a * Math.PI / 180))) lo = m; else hi = m; } return lo; })()), a);
      cx.lineWidth = TH; cx.arc(R, R, R - TH / 2, (-a - .6) * Math.PI / 180, (-a + .6) * Math.PI / 180); cx.stroke();
    }
  }
  const drawSq = () => {
    const cx = sq.getContext("2d"), w = sq.width, img = cx.createImageData(w, w), d = img.data, cm = xbCmax(H), cos = Math.cos(H * Math.PI / 180), sin = Math.sin(H * Math.PI / 180);
    for (let y = 0; y < w; y++) {
      const l = XB_LMAX - (XB_LMAX - XB_LMIN) * y / (w - 1);
      for (let x = 0; x < w; x++) {
        const c = cm * x / (w - 1), rgbv = labRgb(l, c * cos, c * sin), o = (y * w + x) * 4;
        if (rgbv.every(v => v >= -.002 && v <= 1.002)) { d[o] = clamp(rgbv[0], 0, 1) * 255; d[o + 1] = clamp(rgbv[1], 0, 1) * 255; d[o + 2] = clamp(rgbv[2], 0, 1) * 255; d[o + 3] = 255; }
      }
    }
    cx.putImageData(img, 0, 0);
  };
  const fit = () => { const cm = xbCmax(H); C = clamp(C, 0, cm); while (C > 0 && !inGamut(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180))) C -= .5; C = Math.max(0, C); };
  const hexNow = () => lchHex(L, C, H);
  const paint = () => {
    const hex = hexNow(), nm = nameOf(hex);
    sh.querySelector("[data-xbdsw]").style.background = hex;
    sh.querySelector("[data-xbdname]").textContent = nm.text || hex;
    sh.querySelector("[data-xbdhex]").textContent = hex;
    const a = H * Math.PI / 180, rr = R - TH / 2;
    Object.assign(kr.style, { left: (R + rr * Math.cos(a)) + "px", top: (R - rr * Math.sin(a)) + "px", background: lchHex(64, Math.min(xbCmax(H) * .8, 60), H) });
    Object.assign(ks.style, { left: (R - side / 2 + C / xbCmax(H) * side) + "px", top: (R - side / 2 + (XB_LMAX - L) / (XB_LMAX - XB_LMIN) * side) + "px", background: hex });
  };
  fit(); drawSq(); paint();
  let raf = 0, mode = "";
  const onMove = e => {
    const r = box.getBoundingClientRect(), x = e.clientX - r.left - R, y = e.clientY - r.top - R;
    if (mode === "ring") { H = (Math.atan2(-y, x) * 180 / Math.PI + 360) % 360; fit(); if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawSq(); paint(); }); }
    else { const cm = xbCmax(H); C = clamp((x + side / 2) / side, 0, 1) * cm; L = XB_LMAX - clamp((y + side / 2) / side, 0, 1) * (XB_LMAX - XB_LMIN); fit(); paint(); }
  };
  box.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation(); box.setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect(), dist = Math.hypot(e.clientX - r.left - R, e.clientY - r.top - R);
    mode = dist > R - TH - 6 ? "ring" : "sq"; buzz(4); onMove(e);
    box.onpointermove = onMove; box.onpointerup = box.onpointercancel = () => { box.onpointermove = null; buzz(4); };
  });
  box.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });
  // typing a name: the app's colors, the ~1,000 core names with their aliases, and the 2,700-name library
  const inp = sh.querySelector("[data-xbq]"), out = sh.querySelector("[data-xbqres]");
  let IX = null;
  const index = () => {
    if (IX) return IX;
    const rows = [], seen = new Set(), add = (n, h, note) => { const k = n.toLowerCase() + h; if (!seen.has(k) && /^#[0-9a-f]{6}$/i.test(h)) { seen.add(k); rows.push({ n, h: h.toUpperCase(), note, s: n.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase() }); } };
    EVERY().forEach(c => add(c.n, c.h, "ColorHub"));
    (CORE_NAMES || []).forEach(e => { add(e.n, e.h, ""); (e.also || []).forEach(a => add(a, e.h, `another name for ${e.n}`)); });
    // the 2,700-name library, through js/colorsets.js's csItems() (the naming gate keeps the raw list in naming/graph)
    (typeof csItems === "function" ? csItems() : []).forEach(e => { if (!e.c) add(e.n, e.h, ((e.lib && e.lib.src) || []).filter(s => s !== "app").map(s => (typeof SRC_LABEL !== "undefined" && SRC_LABEL[s]) || s).slice(0, 1).join("")); });
    return (IX = rows);
  };
  const search = () => {
    const s = inp.value.trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!s) { out.innerHTML = ""; return; }
    const rows = index(), starts = [], words = [], inside = [];
    rows.forEach(r => { if (r.s.startsWith(s)) starts.push(r); else if (r.s.includes(" " + s)) words.push(r); else if (r.s.includes(s)) inside.push(r); });
    const hits = [...starts.sort((a, b) => a.s.length - b.s.length), ...words, ...inside].slice(0, 24);
    out.innerHTML = hits.length ? `<p class="xb-qn">${xbNum(starts.length + words.length + inside.length)} ${starts.length + words.length + inside.length === 1 ? "name" : "names"} of ${xbNum(rows.length)}</p>${hits.map(r => `<button class="xb-qr" data-xbdhex="${r.h}" data-n="${esc(r.n)}"><i style="--c:${r.h}"></i><b>${esc(r.n)}</b><small>${esc(r.note)}</small></button>`).join("")}` : `<p class="xb-none">No color by that name. Try the dial.</p>`;
  };
  inp.addEventListener("input", search);
  Promise.all([loadCoreNames(), typeof loadLongNames === "function" ? loadLongNames() : null]).then(() => { IX = null; if (sh.isConnected) { paint(); if (inp.value) search(); } }).catch(() => {});
  sh.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-xbdgo]")) { const hex = hexNow(); close(); return xbPickColor(hex, nameOf(hex).text); }
    if (t.closest("[data-xbdoff]")) { close(); return xbSet(xbWithout(XB.f, "color")); }
    const h = t.closest("[data-xbdhex]"); if (h) { close(); return xbPickColor(h.dataset.xbdhex, h.dataset.n || ""); }
    const st = t.closest("[data-xbdset]"); if (st) { close(); return xbPickColor(st.dataset.hexes.split(","), st.dataset.xbdset, { tol: 4 }); }
    const ph = t.closest("[data-xbdphoto]"); if (ph) { close(); return xbPhoto(ph.dataset.xbdphoto === "camera"); }
  });
  onKey = e => { if (e.key === "Escape") close(); };
  if (o.type) setTimeout(() => inp.focus(), 260);
}
// a photo or the camera: six colors from it (js/studio.js extractPalette), pick one or all six
function xbPhoto(camera) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*"; if (camera) inp.setAttribute("capture", "environment");
  inp.style.display = "none"; document.body.appendChild(inp);
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; inp.remove();
    if (!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const pal = typeof extractPalette === "function" ? extractPalette(c, 6) : [];
      if (!pal.length) return toast("No colors found in that photo");
      const { sh, close } = sheet(`<div class="xb-sh-top"><b>Your photo's colors</b></div>
        <div class="xb-photo"><img src="${c.toDataURL("image/jpeg", .8)}" alt="Your photo"></div>
        <div class="xb-photo-pal">${pal.map(p => `<button data-xbph="${p.h}" style="--c:${p.h};flex:${Math.max(.08, p.share).toFixed(3)}" aria-label="${esc(nameOf(p.h).text)}"></button>`).join("")}</div>
        <div class="xb-sh">${pal.map(p => `<button class="xb-opt" data-xbph="${p.h}"><span><i style="--c:${p.h}"></i>${esc(nameOf(p.h).text)}</span><em class="mono">${Math.round(p.share * 100)}%</em></button>`).join("")}</div>
        <button class="btn" data-xbphall>Paintings with all six ${ICON.arrow}</button>
        <p class="fine">Pick one color, or find paintings that share any of the six. The photo stays on this phone.</p>`);
      sh.classList.add("xb-sheet");
      sh.onclick = e => {
        const b = e.target.closest("[data-xbph]"); if (b) { close(); return xbPickColor(b.dataset.xbph, nameOf(b.dataset.xbph).text); }
        if (e.target.closest("[data-xbphall]")) { close(); return xbPickColor(pal.map(p => p.h), "Your photo's colors", { tol: 5 }); }
      };
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("That photo didn't open"); };
    img.src = url;
  };
  inp.click();
}
