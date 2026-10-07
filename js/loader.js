"use strict";
// Lazy content. Today, Train and Studio need only data/colors.js, so the first screen never waits for the
// wiki (~550 KB of articles, stories, painting palettes and photo credits). The wiki loads on first need
// (Explore, a color page, the peek panel, the color of the day) and is prefetched right after the first
// screen is up, so it's usually there before anyone taps.
//   loadData("stories") -> Promise<boolean>   one file, loaded once, never rejects (false = missing or offline)
//   loadWiki()          -> Promise<boolean>   every wiki file; rebuilds the color web when they land
//   wikiReady()         -> boolean
// Files load with the same ?v= tag as this script, so a phone never mixes new code with old data.

const DATA_SRC = { "wiki-colors": "data/wiki-colors.js", "wiki-nodes": "data/wiki-nodes.js", "stories": "data/stories.js", "paintings": "data/paintings.js", "images": "data/images.js" };
const WIKI_FILES = Object.keys(DATA_SRC);
const DATA_VER = ((document.currentScript && document.currentScript.src || "").match(/[?&]v=([^&]+)/) || [])[1] || "";
const DATA_LOADS = {}, DATA_DONE = {};
let WIKI_LOAD = null, WIKI_OK = false, WIKI_FORCE = false;

function loadData(name) {
  if (DATA_LOADS[name]) return DATA_LOADS[name];
  const src = DATA_SRC[name];
  if (!src) return Promise.resolve(false);
  return (DATA_LOADS[name] = new Promise(done => {
    const s = document.createElement("script");
    s.src = src + (DATA_VER ? "?v=" + DATA_VER : "");
    s.onload = () => { DATA_DONE[name] = true; done(true); };
    // a failed file (offline, not written yet) resolves false and may be retried later
    s.onerror = () => { delete DATA_LOADS[name]; s.remove(); done(false); };
    document.head.appendChild(s);
  }));
}
const wikiReady = () => WIKI_OK;
function loadWiki() {
  if (WIKI_OK) return Promise.resolve(true);
  return WIKI_LOAD || (WIKI_LOAD = Promise.all(WIKI_FILES.map(loadData)).then(oks => {
    // the color web was built from colors alone until now: rebuild it on next use
    G = null;
    WIKI_LOAD = null;
    WIKI_OK = oks.every(Boolean);   // if one failed, the next screen that needs it tries again
    return WIKI_OK;
  }));
}
// started once the first screen is on: by the time anyone taps Explore, it's usually loaded
function prefetchWiki() {
  if (WIKI_OK || WIKI_LOAD) return;
  requestAnimationFrame(() => setTimeout(loadWiki, 250));
}

// ---------- waiting gracefully ----------
// A screen that needs the wiki shows a quiet placeholder (same header, soft grey blocks) and is drawn
// for real when the data lands, unless the person has moved on by then.
let SHOW_N = 0;   // bumped by every show(): a later screen cancels a pending one
function waitScreen(tab) {
  const blocks = Array.from({ length: 6 }, (_, k) => `<i style="--k:${k};height:${[150, 210, 180, 240, 170, 200][k]}px"></i>`).join("");
  const body = tab === "explore"
    ? `<header class="x-head"><div class="x-row"><h1 class="tab-title">Explore</h1></div></header><div class="wait-grid">${blocks}</div>`
    : `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header><div class="wait-hero"></div><div class="wait-lines"><i></i><i></i><i></i><i></i></div>`;
  const el = show(`${body}<p class="wait-note" role="status">Loading the color wiki…</p>`, tab === "explore" ? "explore waiting" : "article waiting", tab || null);
  const b = el.querySelector("[data-back]"); if (b) b.onclick = () => go(S.tab || "learn");
  return el;
}
// Run a screen that needs the wiki: now if it's here, otherwise after a quiet placeholder.
function whenWiki(draw, tab) {
  if (WIKI_OK || WIKI_FORCE) return draw();
  waitScreen(tab);
  const tok = SHOW_N;
  loadWiki().then(() => {
    if (SHOW_N !== tok) return;   // they've gone somewhere else
    ROUTE_REPLACE = true;         // the placeholder's history entry becomes the real screen's
    // if a file failed (a blip, a page not written yet), draw with what arrived; the next visit retries
    WIKI_FORCE = true;
    try { draw(); } finally { WIKI_FORCE = false; }
  });
}
// Wrap a global screen function so it waits for the wiki. Node arguments (from a color web built before
// the wiki arrived) are swapped for the full node by id once it has. Overlays (the peek panel) skip the
// placeholder and just open when ready, if the screen underneath hasn't changed.
function needsWiki(name, opts = {}) {
  const host = opts.on || window, key = opts.key || name, orig = host[key];
  if (typeof orig !== "function") return;
  host[key] = function (...a) {
    if (WIKI_OK || WIKI_FORCE) return orig.apply(this, a);
    const again = () => host[key].apply(this, a.map(x => x && typeof x === "object" && x.kind && x.id ? graph().nodes.get(x.id) || x : x));
    if (!opts.overlay) return whenWiki(again, opts.tab);
    const tok = SHOW_N, slow = setTimeout(() => toast("Loading…"), 350);
    loadWiki().then(() => { clearTimeout(slow); if (SHOW_N !== tok) return; WIKI_FORCE = true; try { again(); } finally { WIKI_FORCE = false; } });
  };
}
