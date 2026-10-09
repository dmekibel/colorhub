"use strict";
// One search (design/SIMPLIFY/PLAN.md §3.7/§9): reachable from every ⋯ (places.js moreOpen) and the Places
// sheet. Finds colors (the ~101 taught plus the ~2,700-name archive), every collection by name, and anything a
// lane tucked away behind ⋯ (featureRegister). Lane 2/3/4 call featureRegister to make their own tucked
// controls findable by the words people use for them ("eyedropper", "slideshow", "haptics"); nothing here
// reads lazily loaded data at load time (the lazy-wiki rule).

const FEATURE_REGISTRY = new Map();
// featureRegister(id, { t, where, words, run }): t is the label shown, where is a short breadcrumb ("Map ·
// More · Map tools"), words is an array of synonyms to match against, run() performs the action.
function featureRegister(id, o) { if (id && o && typeof o.run === "function") FEATURE_REGISTRY.set(id, o); }

const SEARCH_SCOPES = [["all", "All"], ["colors", "Colors"], ["collections", "Collections"], ["tools", "Tools"]];
function searchColorMatches(q) {
  const ql = q.toLowerCase();
  const pool = [...BASICS, ...ALL];
  const seen = new Set();
  const hits = pool.filter(c => { const k = c.n.toLowerCase(); if (!k.includes(ql) || seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.n.toLowerCase().indexOf(ql) - b.n.toLowerCase().indexOf(ql) || a.n.length - b.n.length).slice(0, 10);
  return hits;
}
function searchCollectionMatches(q) {
  if (typeof COLLECTIONS === "undefined") return [];
  const ql = q.toLowerCase();
  return COLLECTIONS.filter(c => c.t.toLowerCase().includes(ql)).slice(0, 8);
}
function searchFeatureMatches(q) {
  const ql = q.toLowerCase();
  return [...FEATURE_REGISTRY.entries()].filter(([, f]) => f.t.toLowerCase().includes(ql) || (f.words || []).some(w => w.toLowerCase().includes(ql))).slice(0, 8);
}
function searchResultsHTML(q) {
  if (!q) return `<p class="fine sr-empty">Search colors, paintings, collections, and anything tucked behind ⋯.</p>`;
  const colors = searchColorMatches(q), colls = searchCollectionMatches(q), feats = searchFeatureMatches(q);
  if (!colors.length && !colls.length && !feats.length) return `<p class="fine sr-empty">Nothing by that name.</p>`;
  let html = "";
  if (colors.length) html += `<h3 class="title-3 sr-h">Colors</h3><div class="sr-colors">${colors.map(c => `<button class="sr-color" data-sr-color="${esc(c.n)}" data-h="${c.h}"><i style="background:${c.h}"></i><b>${esc(c.n)}</b></button>`).join("")}</div>`;
  if (colls.length) html += `<h3 class="title-3 sr-h">Collections</h3><ul class="sr-list">${colls.map(c => `<li><button class="sr-row" data-sr-coll="${esc(c.id)}"><span class="sr-dot" style="background:${esc(c.pic || "#888")}"></span><b>${esc(c.t)}</b></button></li>`).join("")}</ul>`;
  if (feats.length) html += `<h3 class="title-3 sr-h">Tools &amp; settings</h3><ul class="sr-list">${feats.map(([id, f]) => `<li><button class="sr-row" data-sr-feat="${esc(id)}"><b>${esc(f.t)}</b>${f.where ? `<small>${esc(f.where)}</small>` : ""}</button></li>`).join("")}</ul>`;
  return html;
}
// searchOpen({ q, scope, from }): a full-screen search, opened over whatever's behind it. `from` is just a
// breadcrumb for callers/analytics -- it doesn't change what's searched (PLAN §3.7: scope chips sit on top,
// but the index itself is always the whole app).
function searchOpen(o = {}) {
  if (document.querySelector(".sheet,.rooms-stem")) return;
  const html = `<div class="sr-sheet">
    <div class="sr-field"><span>${ICON.search}</span><input type="search" class="sr-input" placeholder="Search colors, paintings, collections…" autocomplete="off" aria-label="Search" value="${esc(o.q || "")}"></div>
    <div class="sr-body">${searchResultsHTML(o.q || "")}</div>
  </div>`;
  const { sh, close } = sheet(html);
  sh.classList.add("sr-sheet-wrap");
  const inp = sh.querySelector(".sr-input"), body = sh.querySelector(".sr-body");
  const run = () => { body.innerHTML = searchResultsHTML(inp.value.trim()); };
  inp.addEventListener("input", run);
  setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
  sh.addEventListener("click", e => {
    const c = e.target.closest("[data-sr-color]");
    if (c) { close(); buzz(8); if (typeof openTappedColor === "function") openTappedColor(c.dataset.h); else if (typeof routeColor === "function") { const n = routeColor(c.dataset.srColor); if (n) location.hash = "#/color/" + routeSlug(n.n); } return; }
    const co = e.target.closest("[data-sr-coll]");
    if (co) { close(); if (typeof collOpen === "function") collOpen(co.dataset.srColl); return; }
    const f = e.target.closest("[data-sr-feat]");
    if (f) { close(); const feat = FEATURE_REGISTRY.get(f.dataset.srFeat); if (feat) { buzz(8); feat.run(); } return; }
  });
}
