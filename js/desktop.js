"use strict";
// The desktop website layer (David, 2026-10-21: "the app should fully make sense as a website"). Only on a wide screen
// with a mouse or trackpad -- (min-width:900px) and (hover:hover) and (pointer:fine) -- never on a phone (an iPad gets it too, since 2026-10-25).
// It adds: html.desk (css/desktop.css lays everything out from it), a top navigation bar (wordmark, the places as
// text links with the active one marked, search), and a quiet footer on every page that reads like a web page.
// Nothing here changes a screen's own code: the bar lives outside #app, and the footer is appended to the finished screen.
const DESK_Q = "(min-width:900px) and (hover:hover) and (pointer:fine), (min-width:700px) and (min-height:640px) and (pointer:coarse)";   // second clause: an iPad, portrait or landscape (a phone turned sideways is under 640 tall)
const DESK_MQ = typeof matchMedia === "function" ? matchMedia(DESK_Q) : null;
// David, 2026-10-28: the feed is "Home" (first; Explore and Museum were redundant, the Museum pages live under Home > Boards), the map is "Map" (second)
const DESK_LINKS = [["daily", "Home", "#/feed"], ["home", "Map", "#/home"], ["learn", "Learn", "#/today"], ["train", "Train", "#/train"], ["studio", "Studio", "#/studio"]];
// which nav link a route belongs to (by its first address segment)
const DESK_SECTION = {
  home: "home", map: "home", paintings: "home", color: "home", name: "home", pair: "home", set: "home", hue: "home",
  museum: "daily", boards: "daily", explore: "daily", painting: "daily", painter: "daily", gallery: "daily", page: "daily", story: "daily", poem: "daily", poems: "daily",
  film: "daily", passage: "daily", gem: "daily", gems: "daily", botany: "daily", botanical: "daily", photographer: "daily", photography: "daily", pulp: "daily",
  look: "daily", decade: "daily", ukiyoe: "daily", subject: "daily", "paintings-of": "daily", brand: "daily", brands: "daily", design: "daily", source: "daily", fashion: "daily", hub: "daily",
  today: "learn", learnit: "learn", practice: "learn", welcome: "learn", learn: "learn", read: "learn",
  train: "train", lab: "train", taste: "train", challenge: "train", odd: "train", which: "train", whichway: "train", chords: "train",
  studio: "studio", photo: "studio", you: "studio",
  daily: "daily", feed: "daily",
};
const deskSection = () => { const seg = (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || "home").toLowerCase(); return DESK_SECTION[seg] || ""; };

function deskNavHTML() {
  return `<a class="dk-brand" href="#/home" aria-label="Chromatlas, the map">${typeof LOGO === "string" ? LOGO : ""}<span>Chromatlas</span></a>
  <nav class="dk-links" aria-label="Main">${DESK_LINKS.map(([id, label, href]) => `<a href="${href}" data-dk="${id}">${label}</a>`).join("")}</nav>
  <button class="dk-search" type="button" data-dk-search aria-label="Search">${typeof ICON === "object" ? ICON.search : ""}<span>Search colors, paintings, painters</span><kbd>/</kbd></button>
  <button class="dk-set" type="button" data-dk-settings aria-label="Profile and settings" title="Profile and settings">${typeof HM_GEAR_SVG === "string" ? HM_GEAR_SVG : ""}</button>`;
}
function deskMarkActive() {
  const cur = deskSection();
  document.querySelectorAll("#dk-nav [data-dk]").forEach(a => { const on = a.dataset.dk === cur; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
function deskFooterHTML() {
  return `<footer class="dk-foot"><div class="dk-foot-in">
    <div class="dk-foot-brand"><b>Chromatlas</b><span>The world, read through color.</span></div>
    <p class="dk-foot-note">Colors are measured from photographs of the work, so they are as photographed, not as the object itself. Colors on a screen are approximate.</p>
    <nav class="dk-foot-links" aria-label="Footer">${DESK_LINKS.map(([, label, href]) => `<a href="${href}">${label}</a>`).join("")}</nav>
  </div></footer>`;
}
// Breadcrumbs from the trail (js/trail.js): Explore > Painters > Monet. Every step but the last is a link that walks back
// to that page (tlJump), the first goes to where the trail started (tlToOrigin). Only a page that is on the trail gets one.
function deskCrumbs() {
  if (!document.documentElement.classList.contains("desk")) return;
  const scr = document.querySelector("#app .screen");
  if (!scr || scr.querySelector(".dk-crumbs") || !scr.dataset.tl || typeof XSTACK === "undefined" || !XSTACK.length || typeof tlMetaFor !== "function") return;
  const esc2 = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const last = XSTACK.length - 1, parts = [`<button type="button" data-dkc="o">${esc2(typeof tlOriginName === "function" ? tlOriginName() : "Home")}</button>`];
  // a long trail keeps where it started, one "…" and the last two steps; the whole trail is still a long-press on ‹ (js/trail.js tlSheet)
  const skipFrom = last > 2 ? 0 : -1, skipTo = last - 2;
  XSTACK.forEach((tok, i) => {
    if (i >= skipFrom && i < skipTo && skipFrom >= 0) { if (i === skipFrom) parts.push(`<button type="button" data-dkc="${skipTo - 1}" aria-label="Earlier steps">…</button>`); return; }
    const t = (tlMetaFor(tok) || {}).title || "Page";
    parts.push(i === last ? `<span aria-current="page">${esc2(t)}</span>` : `<button type="button" data-dkc="${i}">${esc2(t)}</button>`);
  });
  const nav = document.createElement("nav"); nav.className = "dk-crumbs"; nav.setAttribute("aria-label", "Breadcrumb");
  nav.innerHTML = parts.join('<i aria-hidden="true">›</i>');
  nav.addEventListener("click", e => { const b = e.target.closest("[data-dkc]"); if (!b) return; if (b.dataset.dkc === "o") tlToOrigin(); else tlJump(+b.dataset.dkc); });
  const top = scr.querySelector(":scope>.art-top");   // the Back row: the crumbs sit in it, so a page's own grid is never disturbed
  if (top && top.firstElementChild) { nav.classList.add("in-top"); top.firstElementChild.after(nav); } else scr.insertBefore(nav, scr.firstChild);
}
// A page gets the footer when it is a real page (a scrolling screen), not a map, a game or a full-bleed stage.
function deskFoot() {
  if (!document.documentElement.classList.contains("desk")) return;
  const scr = document.querySelector("#app .screen");
  if (!scr || scr.querySelector(".dk-foot")) return;
  if (/\b(fixed|cx|deck|drill|station|meet|eye|hm|booth)\b/.test(scr.className) || scr.querySelector(":scope>[data-close],:scope>header>[data-close]") || scr.querySelector("canvas.hc-cv,canvas.pmx-cv")) return;
  scr.insertAdjacentHTML("beforeend", deskFooterHTML());
}

// ---------- the color / painting / painter pages: one bar, and a slim right rail (2026-10-25) ----------
// The page's chip row (.fd-bar) sits under the hero. Once it reaches the top of the window it IS the bar: it gains the app mark and
// the page's swatch + name at the left and search at the right, and the top nav hides behind it (css/desktop.css). Nothing here moves
// the chips themselves, so js/feed.js and js/artwiki.js keep owning them.
const DK_NAV_H = 60;
function deskPageScreen() { const s = document.querySelector("#app .screen"); return s && s.matches(".cp-page,.gl-page,.aw-page") ? s : null; }
function deskPageInfo(s) {
  const t = sel => { const e = s.querySelector(sel); return e ? e.textContent.replace(/\s+/g, " ").trim() : ""; };
  const imgOf = sel => { const i = s.querySelector(sel); return i ? (i.currentSrc || i.src || "") : ""; };
  if (s.classList.contains("cp-page")) {
    const hero = s.querySelector(".cp-hero"), c = (hero && hero.style.getPropertyValue("--c")) || s.style.getPropertyValue("--c") || "";
    const hex = (/#[0-9a-f]{6}/i.exec((hero && hero.textContent) || "") || [""])[0];
    return { name: t("h1.rp-name") || t(".cp-hero h1"), color: c, img: "", meta: hex };
  }
  if (s.classList.contains("gl-page")) return { name: t(".gl-id .p-title"), color: "", img: imgOf(".gl-hero img"), meta: t(".gl-id .p-dek") };
  return { name: t(".aw-head .p-title, .aw-head h1"), color: "", img: imgOf(".aw-pt-hero img"), meta: t(".aw-head .p-dek") };
}
const dkEsc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dkSw = (info, cls) => { const bg = info.img ? `background-image:url('${info.img.replace(/'/g, "%27")}')` : info.color ? `--c:${info.color}` : ""; return `<i class="${cls}" style="${bg}"></i>`; };
function deskPageSync() {
  const s = deskPageScreen(); if (!s) { document.documentElement.classList.remove("dk-stuck"); return; }
  const info = deskPageInfo(s), bar = s.querySelector(".fd-bar");
  if (bar) {
    let l = bar.querySelector(":scope>.dk-pb-l"), r = bar.querySelector(":scope>.dk-pb-r");
    if (!l) {
      l = document.createElement("div"); l.className = "dk-pb-l";
      l.innerHTML = `<a class="dk-brand" href="#/home" aria-label="Chromatlas, the map">${typeof LOGO === "string" ? LOGO : ""}</a><button type="button" class="dk-pb-id" data-dk-top aria-label="Back to the top of this page"></button>`;
      bar.insertBefore(l, bar.firstChild);
    }
    if (!r) {
      r = document.createElement("div"); r.className = "dk-pb-r";
      r.innerHTML = `<button class="dk-search" type="button" data-dk-search aria-label="Search">${typeof ICON === "object" ? ICON.search : ""}<span>Search</span><kbd>/</kbd></button><button class="dk-set" type="button" data-dk-settings aria-label="Profile and settings" title="Profile and settings">${typeof HM_GEAR_SVG === "string" ? HM_GEAR_SVG : ""}</button>`;
      bar.appendChild(r);
    }
    const id = l.querySelector(".dk-pb-id"), sig = info.name + "|" + info.color + "|" + info.img;
    if (id.dataset.sig !== sig) { id.dataset.sig = sig; id.innerHTML = dkSw(info, "dk-pb-sw") + `<b>${dkEsc(info.name)}</b>`; }
  }
  // the rail: on the Overview pane only (the pane that is the reading column)
  const pane = s.querySelector(".rp-about, .gl-about, .aw-pane");
  if (pane) {
    let rail = pane.querySelector(":scope>.dk-rail");
    if (!rail) { rail = document.createElement("aside"); rail.className = "dk-rail"; rail.setAttribute("aria-label", "On this page"); pane.insertBefore(rail, pane.firstChild); }
    const heads = [...pane.querySelectorAll("h2, .sec-head>b")].filter(h => h.textContent.trim() && !h.closest(".dk-rail")).slice(0, 12);
    const sig = info.name + "|" + info.meta + "|" + info.img + "|" + info.color + "|" + heads.map(h => h.textContent.trim()).join("/");
    if (rail.dataset.sig !== sig) {
      rail.dataset.sig = sig; rail._heads = heads;
      rail.innerHTML = `${dkSw(info, "dk-rail-sw")}<b class="dk-rail-n">${dkEsc(info.name)}</b>${info.meta ? `<span class="dk-rail-m">${dkEsc(info.meta)}</span>` : ""}${heads.length ? `<span class="dk-rail-h">On this page</span><nav>${heads.map((h, i) => `<a data-dkr="${i}" role="link" tabindex="0">${dkEsc(h.textContent.trim())}</a>`).join("")}</nav>` : ""}`;
    }
  }
  deskStuck();
}
function deskStuck() {
  const root = document.documentElement, s = deskPageScreen(), bar = s && s.querySelector(".fd-bar");
  const on = !!bar && bar.getBoundingClientRect().top <= DK_NAV_H + .5 && scrollY > 4;
  if (root.classList.contains("dk-stuck") !== on) root.classList.toggle("dk-stuck", on);
}
function deskPageWire() {
  document.addEventListener("scroll", deskStuck, { passive: true, capture: true });
  addEventListener("resize", deskStuck);
  document.addEventListener("click", e => {
    const top = e.target.closest && e.target.closest("[data-dk-top]"); if (top) { scrollTo({ top: 0, behavior: "smooth" }); return; }
    const a = e.target.closest && e.target.closest(".dk-rail [data-dkr]"); if (!a) return;
    const rail = a.closest(".dk-rail"), h = rail && rail._heads && rail._heads[+a.dataset.dkr];
    if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches && e.target.matches(".dk-rail [data-dkr]")) e.target.click(); });
  // the Settings panel takes the right 420px (css): the feed beside it lays itself out again for the width it has left
  let hadPanel = false;
  new MutationObserver(() => { const has = !!document.querySelector(".sheet.fs-half"); if (has !== hadPanel) { hadPanel = has; setTimeout(() => dispatchEvent(new Event("resize")), 60); setTimeout(() => dispatchEvent(new Event("resize")), 320); } })
    .observe(document.body, { childList: true });
  // a page fills in over a second or two (the story, the picture, the tabs): look again shortly after it changes
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(deskPageSync, 250); };
  new MutationObserver(later).observe(document.getElementById("app"), { childList: true, subtree: true });
}

function deskInstall() {
  const root = document.documentElement;
  if (!DESK_MQ) return;
  const apply = () => {
    root.classList.toggle("desk", DESK_MQ.matches);
    let nav = document.getElementById("dk-nav");
    if (DESK_MQ.matches && !nav) {
      nav = document.createElement("header"); nav.id = "dk-nav"; nav.innerHTML = deskNavHTML(); document.body.appendChild(nav);
      deskMarkActive(); deskFoot();
    }
    if (!DESK_MQ.matches && nav) nav.remove();
  };
  if (DESK_MQ.addEventListener) DESK_MQ.addEventListener("change", apply); else if (DESK_MQ.addListener) DESK_MQ.addListener(apply);
  apply();
  if (!DESK_MQ.matches) return;
  // the footer follows every screen the app draws (#app is re-rendered on each show())
  new MutationObserver(() => { deskMarkActive(); deskFoot(); deskCrumbs(); deskPageSync(); }).observe(document.getElementById("app"), { childList: true });
  deskPageWire();
  addEventListener("hashchange", deskMarkActive);
  addEventListener("popstate", deskMarkActive);
  // on a painting map the nav search is that map's own search (painter, place, subject, years), not the general one
  const openSearch = () => {
    const pm = document.querySelector("[data-pmsearch]");
    if (pm) { pm.click(); return; }   // it exists only while a painting map is the screen; desktop CSS may hide the button itself
    if (typeof searchOpen === "function") searchOpen();
  };
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-dk-search]")) openSearch(); });
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-dk-settings]") && typeof ymSettingsSheet === "function" && !document.querySelector(".sheet")) ymSettingsSheet(); });
  document.addEventListener("keydown", e => {
    if (!root.classList.contains("desk")) return;
    const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) || ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey))) { e.preventDefault(); openSearch(); }
  });
}
deskInstall();
