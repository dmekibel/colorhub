"use strict";
// Addresses. Every meaningful screen has a hash route, so it can be shared, bookmarked and reloaded:
//   #/today  #/train  #/studio  #/explore  #/explore/<colors|paintings|ideas|saved>
//   #/color/<slug>  #/page/<id>  #/painting/<slug>  #/story/<id>     (add /more for the "More like this" closeup)
//   #/daily  #/challenge  #/taste/<color|palette>  #/lab/<harmony|contrast>  #/gallery/<n> (a museum painting)
//   #/poem/<id>  #/passage/<id>  #/film/<id>   (js/poems.js, js/passages.js, js/films.js)
//   #/learnit/<color>   the honeycomb home's instant mini-lesson (js/home.js, js/learnit.js). #/today itself
//   already opens the honeycomb home: go("learn") does (js/core.js), and "today" is routed through go() below.
// How it works: show() (core.js) calls routeCommit(tab). A tab home replaces the current history entry with
// its route; an inner screen pushes one. Screen functions don't know their own address, so this file wraps
// them (the ROUTED list below): the wrapper notes the route, then the screen's show() writes it to the URL and the
// title. Screens without an address (decks, drills, results) keep the address of their tab.
// Opening an address (first load or a typed/linked one) goes through openRoute(). #shot=… (screenshot
// mode, boot.js) is left alone. Crawlable copies of the color, wiki and painting pages live at
// c/<slug>/, p/<id>/ and art/<slug>/ (tools/pages.py); shareURL() hands those out so links get previews.

const routeSlug = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const APP_BASE = () => location.origin + location.pathname.replace(/[^/]*$/, "");
const TAB_ROUTE = { learn: ["today", "Today"], gym: ["train", "Train"], explore: ["explore", "Explore"], studio: ["studio", "Studio"] };
const LENS_ROUTE = { spectrum: "colors", paintings: "paintings", poems: "poems", ideas: "ideas", world: "world", saved: "saved" };   // "For you" is plain #/explore
let ROUTE_NEXT = null, ROUTE_REPLACE = false, ROUTE_NOW = "";

function nodeRoute(n) {
  if (!n) return null;
  if (n.kind === "color") return "color/" + routeSlug(n.title);
  if (n.kind === "painting") return "painting/" + String(n.id).replace(/^painting-/, "");
  if (n.kind === "story") return "story/" + (n.sid || String(n.id).replace(/^s:/, ""));
  if (n.kind === "botany") return "botany/" + String(n.id).replace(/^bt:(plant|dye|essay):/, "");   // js/botany.js
  if (n.kind === "gems") return "gem/" + String(n.id).replace(/^gm:(gem|essay):/, "");   // js/gems.js
  return "page/" + n.id;
}
function tabRoute(tab) {
  const [path, title] = TAB_ROUTE[tab] || TAB_ROUTE.learn;
  if (tab === "explore" && LENS_ROUTE[S.lens]) return { path: path + "/" + LENS_ROUTE[S.lens], title: S.lens === "saved" ? "Saved" : title };
  return { path, title };
}
const routeURL = path => APP_BASE() + "#/" + path;
// The best link to share: the crawlable copy (with a title, a description and a preview image) where one
// exists, otherwise the app address.
function shareURL(path) {
  const [kind, id, more] = String(path || "").split("/"), dir = { color: "c", page: "p", painting: "art" }[kind];
  if (dir && id && !more) {
    const n = kind === "color" ? routeColor(id) && colorNode(routeColor(id)) : graph().nodes.get(kind === "painting" ? "painting-" + id : id);
    if (n && !n.stub) return APP_BASE() + dir + "/" + id + "/";
  }
  return routeURL(path);
}

// Called by show() for every screen: history entry, address and title.
function routeCommit(tab) {
  SHOW_N++;
  const r = tab ? tabRoute(tab) : ROUTE_NEXT || tabRoute(S.tab || "learn");
  ROUTE_NEXT = null;
  const replace = !!tab || HIST_POP || ROUTE_REPLACE;
  ROUTE_REPLACE = false;
  const url = SHOT ? undefined : "#/" + r.path;
  try { history[replace ? "replaceState" : "pushState"](tab ? { ch: 1, tab } : { ch: 1 }, "", url); } catch (e) {}
  if (url) ROUTE_NOW = url;
  document.title = r.title ? `${r.title} · ColorHub` : "ColorHub";
}

// ---------- wrapping the screens ----------
const routed = (title, path) => path ? { path, title } : null;
const nodeRouted = (more = "") => n => n && n.id ? routed(n.title, nodeRoute(n) + more) : null;
function routeWrap(host, key, toRoute) {
  const orig = host[key];
  if (typeof orig !== "function") return;
  host[key] = function (...a) {
    let r = null; try { r = toRoute(...a); } catch (e) {}
    if (r) ROUTE_NEXT = r;
    try { return orig.apply(this, a); } finally { if (r) ROUTE_NEXT = null; }
  };
}
// Screens that need the wiki wait for it (loader.js); the placeholder already carries the address.
const WIKI_SCREENS = [["exploreHome", { tab: "explore" }], ["closeup"], ["colorPage"], ["wikiPage"], ["paintingPage"], ["storyPlayer"], ["daily"],
  ["peek", { overlay: true }], ["tzMaster"], ["tzPalResult"]];
WIKI_SCREENS.forEach(([name, o]) => needsWiki(name, o));
// screen function -> (its arguments) -> { title, path }
const ROUTED = [["colorPage", nodeRouted()], ["wikiPage", nodeRouted()], ["paintingPage", nodeRouted()], ["storyPlayer", nodeRouted()],
  ["closeup", nodeRouted("/more")],
  ["daily", () => routed("Color of the day", "daily")],
  ["challenge", () => routed("Daily challenge", "challenge")], ["challengeDone", () => routed("Daily challenge", "challenge")],
  ["tasteIntro", k => k === "palette" ? routed("Find your palette", "taste/palette") : routed("Find your color", "taste/color")],
  ["glPage", (i, d) => routed(d && d.t || "Painting", "gallery/" + i)],
  ["poemPage", id => id != null ? routed("Poem", "poem/" + id) : null],   // js/poems.js   // a museum painting (js/gallery.js); i = its place in the gallery index
  ["passagePage", p => p && p.id ? routed(p.title, "passage/" + p.id) : null],
  ["filmPage", f => f && f.id ? routed(f.title, "film/" + f.id) : null],   // js/passages.js, js/films.js
  ["namePage", entry => entry && entry.n ? routed(entry.n, "name/" + routeSlug(entry.n)) : null],   // js/names.js: a library color that isn't one of the 101
  ["fashionPage", slug => typeof worldRouteTitle === "function" ? routed(worldRouteTitle(slug), "fashion/" + slug) : null],   // js/world.js
  ["btListPage", kind => typeof btListTitle === "function" ? routed(btListTitle(kind), "botany/" + kind) : null],   // js/botany.js (plant/dye/essay detail pages route via wikiPage above)
  ["btFloriPage", () => routed("The language of flowers", "botany/flori")],   // js/botany.js
  ["gmListPage", kind => typeof gmListTitle === "function" ? routed(gmListTitle(kind), "gem/" + kind) : null],   // js/gems.js (gem/essay detail pages route via wikiPage above)
  ["labHoney", () => routed("Honeycomb lab", "lab/honey")]];   // js/home.js: rate every preset at every set size
ROUTED.forEach(([name, f]) => routeWrap(window, name, f));
routeWrap(LAB, "harmony", () => routed("Harmony", "lab/harmony"));
routeWrap(LAB, "contrast", () => routed("Albers", "lab/contrast"));

// ---------- opening an address ----------
const routeColor = slug => [...BASICS, ...ALL].find(c => routeSlug(c.n) === slug) || null;
// a library color that isn't one of the 101 (js/names.js): CORE_NAMES loads lazily, so this only resolves once it has
const routeName = slug => (CORE_NAMES || []).find(e => routeSlug(e.n) === slug) || null;
// initial: first load. The address is opened on top of its tab's home, so Back lands somewhere sensible.
function openRoute(hash, initial = false) {
  if (!/^#\/./.test(hash || "")) return false;
  const parts = decodeURIComponent(hash.slice(2)).split("/").filter(Boolean), [kind, id, more] = parts;
  const tabs = { today: "learn", train: "gym", studio: "studio", explore: "explore" };
  if (tabs[kind]) {
    if (kind === "explore") S.lens = Object.keys(LENS_ROUTE).find(k => LENS_ROUTE[k] === id) || "all";
    go(tabs[kind]);
    return true;
  }
  const base = () => {
    if (!initial) return;
    try { history.replaceState({ ch: 1, tab: S.tab || "learn" }, "", "#/" + tabRoute(S.tab || "learn").path); } catch (e) {}
    ROUTE_REPLACE = false;   // the screen itself goes on top
  };
  const node = () => kind === "color" ? (routeColor(id) ? colorNode(routeColor(id)) : null)
    : graph().nodes.get(kind === "painting" ? "painting-" + id : kind === "story" ? "s:" + id : id) || null;
  if (["color", "page", "painting", "story"].includes(kind) && id) {
    if (kind === "color" && !routeColor(id)) return false;
    base();
    ROUTE_NEXT = routed(kind === "color" ? routeColor(id).n : "", parts.slice(0, more === "more" ? 3 : 2).join("/"));
    whenWiki(() => {
      const n = node();
      if (!n) return go(S.tab || "learn");
      XSTACK = [];
      if (more === "more") return closeup(n);
      return n.kind === "story" ? storyPlayer(n) : openNode(n);
    });
    return true;
  }
  if (kind === "poem" && id && typeof poemPage === "function") {
    base(); XSTACK = []; poemPage(id); return true;
  }
  if (kind === "passage" && id && typeof passagePage === "function") {
    base(); XSTACK = []; archWhen(() => { const p = PSG && PSG.byId.get(id); if (p) passagePage(p); else go(S.tab || "learn"); }); return true;
  }
  if (kind === "film" && id && typeof filmPage === "function") {
    base(); XSTACK = []; archWhen(() => { const f = (window.FILMS || []).find(x => x.id === id); if (f) filmPage(f); else go(S.tab || "learn"); }); return true;
  }
  if (kind === "botany" && id && typeof btOpenRoute === "function") { base(); btOpenRoute(id); return true; }   // js/botany.js
  if (kind === "gem" && id && typeof gmOpenRoute === "function") { base(); gmOpenRoute(id); return true; }   // js/gems.js
  if (kind === "name" && id) {
    // an app color's slug opens its own deep page instead (ROADMAP.md §13): same address family, same rule
    // as routeColor above for "color/<slug>".
    const c = routeColor(id);
    if (c) { base(); whenWiki(() => { XSTACK = []; openNode(colorNode(c)); }); return true; }
    base();
    if (!CORE_NAMES) { ROUTE_NEXT = routed("", "name/" + id); waitScreen(); ROUTE_REPLACE = true; }
    XSTACK = [];
    loadCoreNames().then(() => { const e = routeName(id); if (e) namePage(e); else go(S.tab || "learn"); });
    return true;
  }
  if (kind === "gallery" && /^\d+$/.test(id || "") && typeof galleryPage === "function") {
    base();
    if (!GAL) { ROUTE_NEXT = routed("Painting", "gallery/" + id); waitScreen(); ROUTE_REPLACE = true; }   // the painting replaces the placeholder
    XSTACK = [];
    galleryPage(+id);
    return true;
  }
  const simple = { daily: () => daily(), challenge: () => chToday() ? challengeDone() : challenge(),
    taste: () => tasteIntro(id === "palette" ? "palette" : "color"),
    lab: () => id === "honey" && typeof labHoney === "function" ? labHoney() : (LAB[id] && ["harmony", "contrast"].includes(id) ? LAB[id] : LAB.harmony)(),
    fashion: () => typeof fashionPage === "function" && fashionPage(id),
    // the honeycomb home's instant mini-lesson (js/learnit.js): #/learnit/<color>
    learnit: () => { const c = id && routeColor(id); if (c && typeof hmLearnIt === "function") hmLearnIt(c); else go(S.tab || "learn"); } };
  if (simple[kind]) { base(); simple[kind](); return true; }
  return false;
}
// a typed or linked #/ address while the app is open (Back between our own entries is handled in core.js)
addEventListener("hashchange", () => {
  if (SHOT || location.hash === ROUTE_NOW || !/^#\/./.test(location.hash)) return;
  ROUTE_REPLACE = true;   // the browser already made the history entry
  if (!openRoute(location.hash)) go(S.tab || "learn");
});
