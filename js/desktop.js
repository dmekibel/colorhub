"use strict";
// The desktop website layer (David, 2026-10-21: "the app should fully make sense as a website"). Only on a wide screen
// with a mouse or trackpad -- (min-width:900px) and (hover:hover) and (pointer:fine) -- never on a phone or tablet.
// It adds: html.desk (css/desktop.css lays everything out from it), a top navigation bar (wordmark, the places as
// text links with the active one marked, search), and a quiet footer on every page that reads like a web page.
// Nothing here changes a screen's own code: the bar lives outside #app, and the footer is appended to the finished screen.
const DESK_Q = "(min-width:900px) and (hover:hover) and (pointer:fine)";
const DESK_MQ = typeof matchMedia === "function" ? matchMedia(DESK_Q) : null;
const DESK_LINKS = [["home", "Explore", "#/home"], ["museum", "Museum", "#/museum"], ["learn", "Learn", "#/today"], ["train", "Train", "#/train"], ["studio", "Studio", "#/studio"], ["daily", "Today", "#/daily"]];
// which nav link a route belongs to (by its first address segment)
const DESK_SECTION = {
  home: "home", map: "home", paintings: "home", color: "home", name: "home", pair: "home", set: "home", hue: "home",
  museum: "museum", explore: "museum", painting: "museum", painter: "museum", gallery: "museum", page: "museum", story: "museum", poem: "museum", poems: "museum",
  film: "museum", passage: "museum", gem: "museum", gems: "museum", botany: "museum", botanical: "museum", photographer: "museum", photography: "museum", pulp: "museum",
  look: "museum", decade: "museum", ukiyoe: "museum", subject: "museum", "paintings-of": "museum", brand: "museum", brands: "museum", design: "museum", source: "museum", fashion: "museum", hub: "museum",
  today: "learn", learnit: "learn", practice: "learn", welcome: "learn", learn: "learn", read: "learn",
  train: "train", lab: "train", taste: "train", challenge: "train", odd: "train", which: "train", whichway: "train", chords: "train",
  studio: "studio", photo: "studio", you: "studio",
  daily: "daily",
};
const deskSection = () => { const seg = (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || "home").toLowerCase(); return DESK_SECTION[seg] || ""; };

function deskNavHTML() {
  return `<a class="dk-brand" href="#/home" aria-label="Chromatlas, the map">${typeof LOGO === "string" ? LOGO : ""}<span>Chromatlas</span></a>
  <nav class="dk-links" aria-label="Main">${DESK_LINKS.map(([id, label, href]) => `<a href="${href}" data-dk="${id}">${label}</a>`).join("")}</nav>
  <button class="dk-search" type="button" data-dk-search aria-label="Search">${typeof ICON === "object" ? ICON.search : ""}<span>Search colors, paintings, painters</span><kbd>/</kbd></button>`;
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
// A page gets the footer when it is a real page (a scrolling screen), not a map, a game or a full-bleed stage.
function deskFoot() {
  if (!document.documentElement.classList.contains("desk")) return;
  const scr = document.querySelector("#app .screen");
  if (!scr || scr.querySelector(".dk-foot")) return;
  if (/\b(fixed|cx|deck|drill|station|meet|eye|hm|booth)\b/.test(scr.className) || scr.querySelector("canvas.hc-cv,canvas.pmx-cv")) return;
  scr.insertAdjacentHTML("beforeend", deskFooterHTML());
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
  new MutationObserver(() => { deskMarkActive(); deskFoot(); }).observe(document.getElementById("app"), { childList: true });
  addEventListener("hashchange", deskMarkActive);
  addEventListener("popstate", deskMarkActive);
  const openSearch = () => { if (typeof searchOpen === "function") searchOpen(); };
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-dk-search]")) openSearch(); });
  document.addEventListener("keydown", e => {
    if (!root.classList.contains("desk")) return;
    const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) || ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey))) { e.preventDefault(); openSearch(); }
  });
}
deskInstall();
