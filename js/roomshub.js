"use strict";
// Rooms, as one system (David, 2026-10-25). A room is a way in to the paintings: a saved filter, a color, a time, a place, a curated
// combination, one of the painting map's vibe islands (js/subjectisl.js), or today's pick. Every room has a cover mosaic, a name, one measured
// line, a count, a palette band, and opens as the standard paintings page with Map and "Walk this room".
//   Art's Rooms rail: See all expands it in place (a 2-column grid; remembered), All rooms opens
//   #/museum/art/rooms           the hub: Yours, Today's room, By subject, By color, By time, By place, Curated, with search
//   #/museum/art/room/<id>       one room (ids: u<...> yours, s-<slug> subject, c-<color>, t-<century|movement>, p-<country>, k-<curated>, or an XB_ROOMS id)
// Measured lines come from the data (percentiles against the whole archive); nothing is invented.
const RH_KEY = "colorhub-rooms-open";
const RH = { reg: null, data: new Map(), today: null };
const rhNum = n => Number(n).toLocaleString("en-US");
const rhOpenNow = () => { try { return localStorage.getItem(RH_KEY) === "1"; } catch (e) { return false; } };
const rhSetOpen = v => { try { localStorage.setItem(RH_KEY, v ? "1" : "0"); } catch (e) {} };
const rhReduce = () => typeof reduceMotion !== "undefined" ? reduceMotion : matchMedia("(prefers-reduced-motion:reduce)").matches;

// ---------- the registry ----------
const RH_COLORS = [["blues", "Blues", "#2F5D9E", 12, 10], ["reds", "Reds", "#B3261E", 12, 10], ["greens", "Greens", "#4C7A3B", 14, 12], ["yellows", "Yellows and golds", "#D6A91E", 12, 8],
  ["oranges", "Oranges and ochres", "#C9772B", 12, 8], ["purples", "Purples", "#6B3F8C", 14, 6], ["pinks", "Pinks and roses", "#D98A9E", 12, 6], ["browns", "Browns", "#6B4A2E", 12, 35],
  ["greys", "Quiet greys", "#8A8A86", 8, 25, { chroma: 0 }], ["whites", "Whites and creams", "#EDE6D6", 8, 25], ["blacks", "Near blacks", "#16140F", 8, 35]];
const RH_CURATED = [   // filters only (color, time, place, mood); `isl` matches a vibe island by name and keeps the paintings that are also in it
  { id: "k-blue-hour", name: "Blue hour", f: { hexes: ["#27406E"], name: "Blue", tol: 15, cover: 10, key: 0 }, sort: "most" },
  { id: "k-winter-whites", name: "Winter whites", f: { hexes: ["#EDEDEA"], name: "White", tol: 7, cover: 25, temp: 0 }, sort: "most" },
  { id: "k-gold-and-black", name: "Gold and black", f: { hexes: ["#B8892B"], name: "Gold", tol: 10, cover: 8, key: 0 }, sort: "most" },
  { id: "k-forest-light", name: "Forest light", f: { hexes: ["#4F6B3A"], name: "Green", tol: 14, cover: 15, key: 0 }, sort: "most" },
  { id: "k-sunlit-water", name: "Sunlit water", isl: /^(seas|seascapes)|landscapes and rivers|cities and rivers/i, f: { key: 2, chroma: 2 }, sort: "date" },
  { id: "k-dark-interiors", name: "Dark interiors", isl: /interiors/i, f: { key: 0 }, sort: "date" },
  { id: "k-vivid-before-1800", name: "Vivid before 1800", f: { chroma: 2, y1: 1799 }, sort: "date" },
  { id: "k-impressionist-daylight", name: "Impressionist daylight", mvName: "Impressionism", f: { key: 2 }, sort: "date" },
  { id: "k-quiet-japan", name: "Japan, quiet", coName: "Japan", f: { chroma: 0 }, sort: "date" },
  { id: "k-hot-and-vivid", name: "Hot and vivid", f: { temp: 2, chroma: 2, contrast: 2 }, sort: "date" }];
function rhBuild() {
  const F = XBF, reg = new Map(), sec = { yours: [], subject: [], color: [], time: [], place: [], curated: [] };
  const put = (room, s) => { reg.set(room.id, room); sec[s].push(room); };
  xbUser().rooms.forEach(r => put({ id: r.id, kind: "yours", name: r.name, note: "Your room", f: r.f, sort: r.sort || "", view: r.view }, "yours"));
  if (SBI.d) SBI.d.islands.slice().sort((a, b) => b.n - a.n).forEach(o => put({ id: "s-" + o.slug, kind: "subject", name: o.name, note: o.sub, slug: o.slug, n: o.n, isle: o }, "subject"));
  RH_COLORS.forEach(([k, name, hex, tol, cover, extra]) => put({ id: "c-" + k, kind: "color", name, note: "", f: { hexes: [hex], name, tol, cover, ...(extra || {}) }, sort: "most" }, "color"));
  const dec = F.G.year, byC = new Map();
  for (let i = 0; i < F.N; i++) { const y = dec[i]; if (y !== GL_UNDATED) { const c = Math.floor(y / 100) * 100; byC.set(c, (byC.get(c) || 0) + 1); } }
  [...byC.entries()].filter(([c, n]) => c >= 1300 && c <= 2000 && n >= 300).sort((a, b) => a[0] - b[0]).forEach(([c]) => put({ id: "t-" + c, kind: "time", name: `The ${c}s`, note: "", f: { y0: c, y1: c + 99 }, sort: "date" }, "time"));
  const all = xbRun(F, xbFresh()).counts;
  const mvs = [...all.mv.entries()].filter(([i, n]) => i > 0 && n >= 700 && !/ painting$/i.test(F.meta.movements[i - 1])).sort((a, b) => b[1] - a[1]).slice(0, 8);
  mvs.forEach(([i]) => put({ id: "t-mv-" + routeSlug(F.meta.movements[i - 1]), kind: "time", name: F.meta.movements[i - 1], note: "Movement", f: { mv: i }, sort: "date" }, "time"));
  [...all.co.entries()].filter(([i, n]) => i > 0 && n >= 1200).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([i]) => put({ id: "p-" + routeSlug(F.meta.countries[i - 1]), kind: "place", name: F.meta.countries[i - 1], note: "", f: { co: i }, sort: "date", flag: F.meta.countries[i - 1] }, "place"));
  XB_ROOMS.filter(r => r.f && !r.special && !r.dyn && !r.recipe).forEach(r => put({ id: r.id, kind: "curated", name: r.name, note: r.note, f: r.f, sort: r.sort || "" }, "curated"));
  XB_ROOMS.filter(r => r.recipe).forEach(r => put({ id: r.id, kind: "curated", name: r.name, note: r.note, f: r.f, sort: r.sort || "" }, "curated"));
  RH_CURATED.forEach(c => {
    const room = { id: c.id, kind: "curated", name: c.name, note: "", f: { ...c.f }, sort: c.sort };
    if (c.mvName) { const k = F.meta.movements.indexOf(c.mvName) + 1; if (!k) return; room.f.mv = k; }
    if (c.coName) { const k = F.meta.countries.indexOf(c.coName) + 1; if (!k) return; room.f.co = k; }
    if (c.isl) { const o = SBI.d && SBI.d.islands.filter(x => c.isl.test(x.name)).sort((a, b) => b.n - a.n)[0]; if (!o) return; room.slug = o.slug; }
    put(room, "curated");
  });
  const rooms = [...sec.curated, ...sec.color, ...sec.time, ...sec.place, ...sec.subject], d = Math.floor(Date.now() / 864e5);
  return RH.reg = { reg, sec, pool: rooms.filter(r => r.kind !== "subject" || r.n > 1500), day: d };
}
const rhRegistry = () => RH.reg;
function rhLoad() {
  return Promise.all([xbLoad(), sbiLoad().catch(() => null)]).then(() => {
    if (!RH.reg || RH.yn !== xbUser().rooms.length) { RH.yn = xbUser().rooms.length; rhBuild(); }
    return RH.reg;
  });
}
const rhFilter = room => ({ ...xbFresh(), ...room.f, hexes: (room.f.hexes || []).slice() });
const rhWait = (fn, args) => {
  const tok = (waitScreen(), SHOW_N);
  rhLoad().then(() => { if (SHOW_N !== tok) return; ROUTE_REPLACE = true; fn(...args); })
    .catch(() => { if (SHOW_N === tok && typeof routeFailed === "function") routeFailed(() => rhWait(fn, args)); else toast("This page didn't load"); });
  return true;
};

// ---------- what a room holds ----------
function rhPct(sorted, v) { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / sorted.length); }
const rhMedian = (list, arr) => { const step = Math.max(1, Math.floor(list.length / 2500)), v = []; for (let q = 0; q < list.length; q += step) v.push(arr[list[q]]); v.sort((a, b) => a - b); return v[v.length >> 1]; };
function rhLine(F, list) {
  const G = F.G, n = list.length;
  if (n < 20) return n ? `${rhNum(n)} paintings` : "";
  const pL = rhPct(G.Ls, rhMedian(list, G.L)), pC = rhPct(G.Cs, rhMedian(list, G.C));
  if (pL >= 72) return `Its middle painting is lighter than ${pL}% of the archive`;
  if (pL <= 28) return `Its middle painting is darker than ${100 - pL}% of the archive`;
  if (pC >= 72) return `More vivid than ${pC}% of the archive`;
  if (pC <= 28) return `Quieter in color than ${100 - pC}% of the archive`;
  const ys = []; for (let q = 0; q < n; q += Math.max(1, Math.floor(n / 3000))) { const y = G.year[list[q]]; if (y !== GL_UNDATED) ys.push(y); }
  if (ys.length > 20) { ys.sort((a, b) => a - b); const a = Math.round(ys[Math.floor(ys.length * .1)] / 10) * 10, b = Math.round(ys[Math.floor(ys.length * .9)] / 10) * 10; return `Mostly ${a} to ${b}`; }
  return "";
}
function rhPick(list, sort) {   // three covers: from the heart of the list, not its extremes
  const n = list.length; if (!n) return [];
  const pos = sort === "most" ? [0, 2, 6] : [.5, .2, .8].map(p => Math.floor(n * p)), seen = new Set(), out = [];
  for (const p of pos) for (let d = 0; d < 40; d++) { const i = list[Math.min(n - 1, p + d)]; if (!seen.has(i)) { seen.add(i); out.push(i); break; } }
  return out;
}
function rhData(room) {
  const key = room.id + (room.f ? JSON.stringify(room.f) : "") + (room.dynKey || "");
  if (RH.data.has(key)) return RH.data.get(key);
  const F = XBF;
  const p = (room.kind === "subject" ? sbiMembers(room.isle) : room.slug ? sbiMembers(sbiOf(room.slug)) : Promise.resolve(null)).then(base => {
    let list;
    if (room.kind === "subject") list = base;
    else {
      const f = rhFilter(room), sort = room.sort || (f.hexes.length ? "most" : "date"), res = xbRun(F, f);
      list = xbSort(F, res, sort);
      if (base) { const set = new Set(base); list = Array.from(list).filter(i => set.has(i)); }
      if (room.dynCount != null) list = list.slice(0, room.dynCount);
    }
    list = Array.from(list);
    const sort = room.kind === "subject" ? "" : room.sort || "date";
    return { list, n: list.length, line: room.kind === "subject" ? room.note : rhLine(F, list), pal: list.length ? xbSetColors(F, list, 8).map(c => c.h) : [], covers: rhPick(list, sort) };
  });
  RH.data.set(key, p);
  return p;
}
function rhCoverImgs(idx, w) {   // [{i, url}] once their detail shards are here
  return Promise.all([...new Set(idx.map(i => Math.floor(i / GAL.shard)))].map(k => glShard(k).catch(() => null))).then(() => idx.map(i => { const d = glDetailNow(i); return d && d.img ? { i, url: d.img, t: d.t } : null; }).filter(Boolean));
}

// ---------- cards ----------
function rhCardHTML(room) {
  if (room.kind === "subject") return sbiCardHTML(room.isle);
  const flag = room.flag && typeof sqFlagHTML === "function" ? sqFlagHTML(room.flag) : "";
  return `<article class="sbi-card rh-card" data-rhcard="${esc(room.id)}">
    <button class="sbi-open" data-rh="${esc(room.id)}"><span class="sbi-mos m3"><span class="sbi-ph"></span><span class="sbi-ph"></span><span class="sbi-ph"></span></span>
      <span class="sbi-txt"><b>${flag ? `<span class="rh-flag" aria-hidden="true">${flag}</span>` : ""}${esc(room.name)}</b><span class="sbi-n" data-rhn>&nbsp;</span><span class="sbi-sub" data-rhl>${esc(room.note || "")}</span></span></button>
    <span class="sbi-colors rh-band" data-rhband></span>
    ${room.kind === "yours" ? `<button class="rh-more" data-rhmore="${esc(room.id)}" aria-label="Rename or delete ${esc(room.name)}">&#8943;</button>` : ""}
  </article>`;
}
function rhFillCard(el) {
  const room = RH.reg && RH.reg.reg.get(el.dataset.rhcard); if (!room || el.dataset.rhfilled) return; el.dataset.rhfilled = "1";
  rhData(room).then(d => {
    if (!el.isConnected) return;
    el.querySelector("[data-rhn]").textContent = `${rhNum(d.n)} ${d.n === 1 ? "painting" : "paintings"}`;
    if (d.line) el.querySelector("[data-rhl]").textContent = d.line;
    el.querySelector("[data-rhband]").innerHTML = d.pal.map(h => `<button data-swatch="${h}" style="--c:${h}" aria-label="${esc(nameOf(h).text)}"></button>`).join("");
    const phs = el.querySelectorAll(".sbi-ph");
    d.pal.slice(2, 5).forEach((h, k) => { if (phs[k]) phs[k].style.setProperty("--c", h); });
    if (d.n < 1) { el.classList.add("rh-empty"); return; }
    rhCoverImgs(d.covers).then(imgs => { imgs.forEach((x, k) => { if (phs[k]) { phs[k].innerHTML = sbiImg([0, "", x.url], k ? 180 : 360); } }); sbiFade(el); });
  }).catch(() => {});
}
function rhLazyCards(root) { const els = [...root.querySelectorAll("[data-rhcard]")]; if (els.length) xbLazy(els, rhFillCard, 700); }

// ---------- Art's Rooms rail: expand in place ----------
const rhChev = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function rhHeadHTML() {
  const open = rhOpenNow();
  return `<div class="sec-head xb-h rh-head"><b>Rooms</b><span class="rh-ctl"><button class="rh-b" data-rhexp aria-expanded="${open}"><span>${open ? "Fewer" : "See all"}</span>${rhChev}</button><button class="rh-b" data-rhall aria-label="All rooms, on a page of their own">All rooms</button></span></div>`;
}
function rhRailWire(host) {
  const wrap = host.querySelector(".xb-railwrap"), rail = host.querySelector(".xb-roomrail"), btn = host.querySelector("[data-rhexp]"), all = host.querySelector("[data-rhall]");
  if (!wrap || !rail || !btn) return;
  btn.onclick = () => {
    const open = !rail.classList.contains("open"); buzz(5);
    const h0 = wrap.offsetHeight; rhSetOpen(open);
    wrap.style.height = h0 + "px"; wrap.style.overflow = "hidden";
    rail.classList.toggle("open", open); rail.scrollLeft = 0;
    btn.setAttribute("aria-expanded", open); btn.firstChild.textContent = open ? "Fewer" : "See all";
    const h1 = rail.offsetHeight + parseFloat(getComputedStyle(rail).marginTop || 0), done = () => { wrap.style.height = ""; wrap.style.overflow = ""; wrap.style.transition = ""; };
    if (rhReduce() || Math.abs(h1 - h0) < 2) return done();
    wrap.getBoundingClientRect(); wrap.style.transition = "height .26s cubic-bezier(.32,.72,0,1)"; wrap.style.height = h1 + "px";
    wrap.addEventListener("transitionend", done, { once: true }); setTimeout(done, 400);
  };
  all.onclick = () => { buzz(6); rhPage(); };
}

// ---------- the hub page ----------
function rhSection(title, note, rooms, extra = "") {
  if (!rooms.length && !extra) return "";
  return `<div class="sec-head rh-sec"><b>${esc(title)}</b><span>${esc(note)}</span></div>${extra}${rooms.length ? `<div class="sbi-list">${rooms.map(rhCardHTML).join("")}</div>` : ""}`;
}
function rhToday(R) {
  const pool = R.pool; if (!pool.length) return null;
  return pool[R.day % pool.length];
}
function rhPage() {
  if (!RH.reg || RH.yn !== xbUser().rooms.length) return rhWait(rhPage, []);
  const R = RH.reg, S0 = R.sec, today = rhToday(R), hasView = typeof xbChips === "function" && XBF && xbChips(XBF, XB.f).length > 0;
  const yoursExtra = `<div class="rh-save"><p>${S0.yours.length ? "" : "Nothing saved yet. "}${hasView ? "The view you are on in Art can be kept as a room." : "Choose a color, a time or a painter in Art, then keep that view here."}</p><button class="btn${hasView ? " solid" : " ghost"}" data-rhsave>${hasView ? "Save this view as a room" : "Save a view from Art"}</button></div>`;
  const body = () => rhSection("Yours", `${S0.yours.length} saved`, S0.yours, yoursExtra)
    + (today ? `<div class="sec-head rh-sec"><b>Today's room</b><span>changes every day</span></div><div class="sbi-list">${rhCardHTML(today)}</div>` : "")
    + rhSection("By subject", `${S0.subject.length} kinds of painting`, S0.subject.slice(0, 6), "") + `<button class="rh-more-row" data-rhsubj>All ${S0.subject.length} subjects</button>`
    + rhSection("By color", "paintings that hold it", S0.color) + rhSection("By time", "centuries and movements", S0.time) + rhSection("By place", "where it was painted", S0.place) + rhSection("Curated", "combinations, measured", S0.curated);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Art</p><h1 class="p-title">Rooms</h1>
    <p class="p-dek">Ways in to ${rhNum(XBF.N)} paintings. Each room is a handful of choices (a color, a time, a place, a look) kept as one door.</p>
    <label class="search rh-search"><span>${ICON.search}</span><input data-rhq type="search" placeholder="Find a room" autocomplete="off" aria-label="Find a room"></label>
    <div data-rhbody>${body()}</div>`, "article sbi-page rh-page");
  el.querySelector("[data-back]").onclick = () => (typeof xBack === "function" && XSTACK.length ? xBack() : xToOrigin());
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) el.querySelector("[data-back]").click(); };
  const bodyEl = el.querySelector("[data-rhbody]"), q = el.querySelector("[data-rhq]");
  const draw = html => { bodyEl.innerHTML = html; sbiFade(bodyEl); rhLazyCards(bodyEl); };
  draw(body());
  q.addEventListener("input", () => {
    const s = q.value.trim();
    if (!s) return draw(body());
    const all = [...R.reg.values()].filter(r => r.kind !== "subject" || true);
    const hits = typeof sqFuzzyRank === "function" ? sqFuzzyRank(all, s, r => r.name + " " + (r.kind === "place" ? "country place" : r.kind === "time" ? "time century movement" : r.kind === "color" ? "color" : r.kind === "subject" ? "subject" : "")).hits : all.filter(r => r.name.toLowerCase().includes(s.toLowerCase()));
    draw(hits.length ? `<div class="sbi-list">${hits.slice(0, 30).map(rhCardHTML).join("")}</div>` : `<p class="fine rh-none">No room called that yet. Try a color, a century or a country.</p>`);
  });
  el.addEventListener("click", e => {
    if (e.target.closest("[data-swatch]")) return;
    const m = e.target.closest("[data-rhmore]"); if (m) return rhRoomMenu(m.dataset.rhmore);
    if (e.target.closest("[data-rhsave]")) return rhSaveView();
    if (e.target.closest("[data-rhsubj]")) { buzz(6); return sbiList(); }
    const o = e.target.closest("[data-rh]"); if (o) { buzz(6); return rhOpenRoom(o.dataset.rh); }
    const s = e.target.closest("[data-sbi]"); if (s) { buzz(6); sbiPage(s.dataset.sbi); }
  });
  // a long press on one of Yours: the same menu as the dots
  let lp = 0; el.addEventListener("pointerdown", e => { const c = e.target.closest(".rh-card"); const r = c && R.reg.get(c.dataset.rhcard); if (!r || r.kind !== "yours") return; lp = setTimeout(() => { lp = 0; buzz(8); rhRoomMenu(r.id); }, 520); });
  ["pointerup", "pointercancel", "pointermove"].forEach(t => el.addEventListener(t, () => { if (lp) { clearTimeout(lp); lp = 0; } }));
  if (typeof featureRegister === "function") featureRegister("art-rooms", { t: "Rooms", where: "Museum · Art · Rooms", words: ["rooms", "room", "ways in", "collections"], run: () => rhPage() });
}
function rhSaveView() {
  if (!XBF || !xbChips(XBF, XB.f).length) return toast("Choose a color, a time or a painter in Art first, then save it here");
  xbSaveRoom(); RH.reg = null; setTimeout(() => { if (document.querySelector(".rh-page")) rhLoad().then(() => rhPage()); }, 250);
}
function rhRoomMenu(id) {
  const room = RH.reg.reg.get(id); if (!room) return;
  const { sh, close } = sheet(`<h3>${esc(room.name)}</h3><p>Your room</p>
    <label class="search xb-namefield"><input data-rhname type="text" maxlength="40" value="${esc(room.name)}" aria-label="Room name"></label>
    <button class="btn solid" data-rhren>Rename ${ICON.arrow}</button><button class="btn ghost" data-rhdel>Delete this room</button>`);
  const redo = () => { close(); RH.reg = null; rhLoad().then(() => rhPage()); };
  sh.querySelector("[data-rhren]").onclick = () => { const r = xbUser().rooms.find(x => x.id === id), v = sh.querySelector("[data-rhname]").value.trim(); if (r && v) { r.name = v; save(); buzz(6); toast("Renamed"); redo(); } };
  sh.querySelector("[data-rhdel]").onclick = () => { const u = xbUser(); u.rooms = u.rooms.filter(x => x.id !== id); save(); buzz(6); toast(`Removed "${room.name}"`); redo(); };
}

// ---------- one room ----------
function rhOpenRoom(id) {
  if (!RH.reg) return rhWait(rhOpenRoom, [id]);
  const room = RH.reg.reg.get(id); if (!room) return xbOpenRoom ? xbOpenRoom(id) : null;
  if (room.kind === "subject") return sbiPage(room.slug);
  return rhRoomPage(id);
}
function rhRoomPage(id) {
  if (!RH.reg) return rhWait(rhRoomPage, [id]);
  const room = RH.reg.reg.get(id);
  if (!room) return routeMissing("room", id);
  if (room.kind === "subject") return sbiPage(room.slug);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-rhmap aria-label="Map: see this room on the painting map">${ICON.explore}<span>Map</span></button></header>
    <div class="sbi-hero rh-hero" data-rhhero></div>
    <p class="eyebrow p-type">${esc({ yours: "Your room", color: "By color", time: "By time", place: "By place", curated: "Curated" }[room.kind] || "Room")}</p><h1 class="p-title">${esc(room.name)}</h1>
    <p class="p-dek" data-rhdek>${esc(room.note || "")}&nbsp;</p>
    <span class="sbi-pal big" data-rhpal aria-hidden="true"></span>
    <div class="rh-walkrow"><button class="btn solid" data-rhwalk disabled>Walk this room ${ICON.arrow}</button></div>
    <div class="sbi-chips" role="tablist" aria-label="View"><button class="sbi-chip on" role="tab" aria-selected="true" data-sbitab="paintings">Paintings</button><button class="sbi-chip" role="tab" aria-selected="false" data-sbitab="overview">Overview</button></div>
    <div class="sbi-pane" data-sbipane="paintings"><div class="sbi-grid gl-grid" data-sbigrid>${sbiTileSkeleton()}</div><p class="fine">As photographed; colors on a screen are approximate.</p></div>
    <div class="sbi-pane" data-sbipane="overview" hidden data-rhov></div>`, "article sbi-page sbi-one rh-room");
  el.querySelector("[data-back]").onclick = () => (typeof xBack === "function" && XSTACK.length ? xBack() : xToOrigin());
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet") && !document.querySelector(".rh-walk")) el.querySelector("[data-back]").click(); };
  sbiOwnMap(el);
  let cur = null;
  rhData(room).then(d => {
    if (!el.isConnected) return; cur = d;
    el.querySelector("[data-rhdek]").innerHTML = `${rhNum(d.n)} ${d.n === 1 ? "painting" : "paintings"}${d.line ? " · " + esc(d.line) : ""}`;
    el.querySelector("[data-rhpal]").innerHTML = d.pal.map(h => `<i style="--c:${h}"></i>`).join("");
    el.querySelector("[data-rhov]").innerHTML = rhOverview(room, d);
    const grid = el.querySelector("[data-sbigrid]");
    if (!d.n) { grid.innerHTML = `<p class="fine">Nothing is in this room yet.</p>`; return; }
    el.querySelector("[data-rhwalk]").disabled = false;
    glGrid(grid, { list: d.list, cols: matchMedia("(min-width:700px)").matches ? 4 : 3, plain: true, exact: true, pinch: true }); grid.classList.add("live");
    const hero = el.querySelector("[data-rhhero]"); if (d.pal[3]) hero.style.setProperty("--c", d.pal[3]);
    rhCoverImgs(d.covers.slice(0, 1)).then(im => { if (im[0] && hero.isConnected) { hero.innerHTML = sbiImg([0, "", im[0].url], 480); sbiFade(hero); } });
  }).catch(() => { const g = el.querySelector("[data-sbigrid]"); if (g) g.innerHTML = `<p class="fine">This room didn't load. <button class="wl" data-sbiretry>Try again</button></p>`; });
  el.addEventListener("click", e => {
    if (e.target.closest("[data-swatch]")) return;
    const g = e.target.closest("[data-gi]"); if (g) { buzz(4); return galleryPage(+g.dataset.gi, true); }
    if (e.target.closest("[data-sbiretry]")) return rhRoomPage(id);
    if (e.target.closest("[data-rhmap]")) { buzz(6); return pmGo(room.slug ? `arr=look&lk=isl` : { arr: "color", f: rhFilter(room) }); }
    if (e.target.closest("[data-rhwalk]")) { if (cur && cur.n) rhWalk(cur.list, room.name); return; }
    const t = e.target.closest("[data-sbitab]");
    if (t) { el.querySelectorAll("[data-sbitab]").forEach(b => { const on = b === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }); el.querySelectorAll("[data-sbipane]").forEach(p => { p.hidden = p.dataset.sbipane !== t.dataset.sbitab; }); buzz(4); if (t.dataset.sbitab === "paintings") dispatchEvent(new Event("scroll")); return; }
    const op = e.target.closest("[data-sbigi]"); if (op) { buzz(4); galleryPage(+op.dataset.sbigi, true); }
  });
}
function rhOverview(room, d) {
  const F = XBF, G = F.G, list = d.list;
  if (!list.length) return "";
  const top = (arr, names, k) => { const c = new Map(); const step = Math.max(1, Math.floor(list.length / 6000)); for (let q = 0; q < list.length; q += step) { const v = arr[list[q]]; if (v) c.set(v, (c.get(v) || 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v, n]) => [names(v), n / Math.ceil(list.length / step)]); };
  const painters = top(F.artist, v => xbArtistName(F, v), 4), places = top(F.country, v => F.meta.countries[v - 1], 3), mvs = top(F.mv, v => F.meta.movements[v - 1], 2);
  const pct = n => `${Math.round(n * 100)}%`;
  const covers = d.covers.map(i => `<button class="sbi-t" data-sbigi="${i}" style="--c:${d.pal[2] || "#2a2822"}" aria-label="Open this painting"></button>`).join("");
  setTimeout(() => rhCoverImgs(d.covers).then(ims => { const host = document.querySelector("[data-rhov] .sbi-three"); if (!host) return; ims.forEach((x, k) => { const b = host.children[k]; if (b) b.insertAdjacentHTML("beforeend", sbiImg([0, "", x.url], 220)); }); sbiFade(host); }), 0);
  return `<div class="sbi-ov">
    ${d.covers.length ? `<div class="sec-head"><b>From the middle of it</b></div><div class="sbi-three">${covers}</div>` : ""}
    <div class="sec-head"><b>Its colors</b><span>pooled from ${rhNum(d.n)} paintings</span></div>
    <div class="sbi-sw">${d.pal.map(h => `<button data-swatch="${h}" style="--c:${h}"><span>${esc(nameOf(h).text)}</span></button>`).join("")}</div>
    ${painters.length ? `<div class="sec-head"><b>Most often</b></div><ul class="sbi-facts">${painters.map(([n, s]) => `<li>${esc(n)} <em>${pct(s)}</em></li>`).join("")}${places.map(([n, s]) => `<li>${esc(n)} <em>${pct(s)}</em></li>`).join("")}${mvs.map(([n, s]) => `<li>${esc(n)} <em>${pct(s)}</em></li>`).join("")}</ul>` : ""}
    <p class="fine">Shares are of this room's paintings. Percentiles compare with all ${rhNum(F.N)} paintings, as photographed.</p></div>`;
}

// ---------- Walk this room: a guided tour of eight paintings, each with one measured fact ----------
function rhWalkPicks(list) {
  const F = XBF, G = F.G, n = list.length, used = new Set(), out = [];
  const best = (score, why) => { let bi = -1, bs = -Infinity; for (let q = 0; q < n; q++) { const i = list[q]; if (used.has(i)) continue; const s = score(i); if (s > bs) { bs = s; bi = i; } } if (bi >= 0) { used.add(bi); out.push({ i: bi, why }); } };
  const mL = rhMedian(list, G.L), mC = rhMedian(list, G.C), mW = rhMedian(list, F.wf);
  best(i => -Math.hypot(G.L[i] - mL, (G.C[i] - mC) * 1.5, (F.wf[i] - mW) / 8), "typical");
  best(i => -G.L[i], "darkest"); best(i => G.L[i], "lightest"); best(i => G.C[i], "vivid"); best(i => -G.C[i], "muted");
  best(i => G.year[i] === GL_UNDATED ? -1e9 : -G.year[i], "earliest"); best(i => G.year[i] === GL_UNDATED ? -1e9 : G.year[i], "latest"); best(i => F.wf[i], "warm");
  return out.slice(0, 8);
}
function rhFact(F, w, n) {
  const G = F.G, i = w.i, num = rhNum(n);
  switch (w.why) {
    case "typical": return `The most typical of ${num}: closest to the room's middle in lightness, color and warmth`;
    case "darkest": return `The darkest of the ${num} here (lightness ${Math.round(G.L[i])} out of 100)`;
    case "lightest": return `The lightest of the ${num} here (lightness ${Math.round(G.L[i])} out of 100)`;
    case "vivid": return `The most vivid of the ${num} here, more than ${rhPct(G.Cs, G.C[i])}% of the archive`;
    case "muted": return `The quietest in color of the ${num} here, quieter than ${100 - rhPct(G.Cs, G.C[i])}% of the archive`;
    case "earliest": return `The earliest in this room, from ${G.year[i]}`;
    case "latest": return `The latest in this room, from ${G.year[i]}`;
    default: return `The warmest of the ${num} here: about ${Math.round(F.wf[i] * 4 / 10)}% of its area is warm color`;
  }
}
function rhWalk(list, title) {
  const F = XBF, picks = rhWalkPicks(list); if (!picks.length) return;
  const ov = document.createElement("div"); ov.className = "rh-walk"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Walk this room: " + title);
  ov.innerHTML = `<div class="rh-w-top"><button class="icon-btn glass" data-rhwx aria-label="Close the walk">${ICON.x}</button><span class="rh-w-count" data-rhwc>1 of ${picks.length}</span></div>
    <div class="rh-w-track" data-rhwt>${picks.map((w, k) => `<section class="rh-w-slide" data-k="${k}"><div class="rh-w-im" data-i="${w.i}"></div><div class="rh-w-t"><b data-t></b><span data-a></span><p>${esc(rhFact(F, w, list.length))}</p><button class="btn" data-rhwopen="${w.i}">Open this painting ${ICON.arrow}</button></div></section>`).join("")}</div>
    <div class="rh-w-dots" aria-hidden="true">${picks.map((w, k) => `<i${k ? "" : ' class="on"'}></i>`).join("")}</div>`;
  document.body.appendChild(ov); document.documentElement.classList.add("rh-lock");
  const track = ov.querySelector("[data-rhwt]"), cnt = ov.querySelector("[data-rhwc]"), dots = [...ov.querySelectorAll(".rh-w-dots i")];
  const G = F.G;
  Promise.all([...new Set(picks.map(w => Math.floor(w.i / GAL.shard)))].map(k => glShard(k).catch(() => null))).then(() => {
    picks.forEach((w, k) => {
      const d = glDetailNow(w.i), s = track.children[k]; if (!d || !s) return;
      s.querySelector("[data-t]").textContent = d.t; s.querySelector("[data-a]").textContent = [d.a, G.year[w.i] === GL_UNDATED ? "" : G.year[w.i]].filter(Boolean).join(" · ");
      const im = s.querySelector(".rh-w-im"); im.style.setProperty("--c", glPal(w.i)[0].h); im.innerHTML = sbiImg([0, "", d.img], 520); sbiFade(im);
    });
  });
  let cur = 0;
  const go = k => { k = Math.max(0, Math.min(picks.length - 1, k)); track.scrollTo({ left: k * track.clientWidth, behavior: rhReduce() ? "auto" : "smooth" }); };
  track.addEventListener("scroll", () => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (k !== cur) { cur = k; cnt.textContent = `${k + 1} of ${picks.length}`; dots.forEach((d, j) => d.classList.toggle("on", j === k)); buzz(3); } }, { passive: true });
  const close = () => { document.removeEventListener("keydown", key, true); ov.remove(); document.documentElement.classList.remove("rh-lock"); };
  const key = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } else if (e.key === "ArrowRight") go(cur + 1); else if (e.key === "ArrowLeft") go(cur - 1); };
  document.addEventListener("keydown", key, true);
  ov.addEventListener("click", e => {
    if (e.target.closest("[data-rhwx]")) return close();
    const o = e.target.closest("[data-rhwopen]"); if (o) { close(); galleryPage(+o.dataset.rhwopen, true); return; }
    const im = e.target.closest(".rh-w-im"); if (im) { const k = +im.closest(".rh-w-slide").dataset.k; if (k !== cur) go(k); else { close(); galleryPage(+im.dataset.i, true); } }
  });
  buzz(6); ov.querySelector("[data-rhwx]").focus({ preventScroll: true });
  return close;
}
