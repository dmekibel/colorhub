"use strict";
// Addresses. Every meaningful screen has a hash route, so it can be shared, bookmarked and reloaded:
//   #/today  #/train  #/studio  #/museum  #/museum/<art|ideas|world|saved>  #/home (the map)
//   (the Museum was called Explore until 2026-10-08: every #/explore… address still opens it)
//   (older #/explore/paintings and #/explore/poems open Art; #/explore/colors and #/explore/spectrum open
//   the pager itself — js/explore.js dropped the "Colors" lens and merged Paintings + Poems into Art)
//   #/color/<slug>  #/page/<id>  #/painting/<slug>  #/story/<id>     (add /more for the "More like this" closeup)
//   #/photo/<id>  a photo saved in Studio (js/photos.js, IndexedDB on this device)
//   #/studio/wheel  the gamut wheel · #/studio/palette/<id>  a saved palette (js/studio.js, in S.palettes)
//   #/daily  #/challenge  #/taste/<color|palette>  #/lab/<harmony|contrast>  #/gallery/<n> (a museum painting)
//   #/poem/<id>  #/passage/<id>  #/film/<id>   (js/poems.js, js/passages.js, js/films.js)
//   #/practice  #/practice/<method>   build your own deck and study it (js/practice.js)
//   #/pair/<a>+<b>  #/set/<a>-<b>-<c>…   a page for any pair or set of colors (js/setpage.js; canonical order dark to light)
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
const TAB_ROUTE = { learn: ["today", "Learn"], gym: ["train", "Train"], explore: ["museum", NAV_MUSEUM], studio: ["studio", "Studio"], you: ["you", "You"] };   // you: js/you.js
const LENS_ROUTE = { art: "art", ideas: "ideas", world: "world", saved: "saved" };   // "For you" (the pager) is plain #/explore
const LENS_TITLE = { art: "Art", ideas: "Ideas", world: "World", saved: "Saved" };
// legacy lens tokens, from before Paintings/Poems merged into Art and Colors was dropped (links, bookmarks, S.lens left over from an old save)
const LENS_LEGACY = { paintings: "art", poems: "art", colors: "all", spectrum: "all" };
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
  if (tab === "explore" && LENS_ROUTE[S.lens]) return { path: path + "/" + LENS_ROUTE[S.lens], title: LENS_TITLE[S.lens] || title };
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
  if (typeof orig !== "function" || orig.__routed) return;   // not defined yet (a later script), or already wrapped
  host[key] = function (...a) {
    let r = null; try { r = toRoute(...a); } catch (e) {}
    if (r) { ROUTE_NEXT = r; if (typeof tlCallNote === "function") tlCallNote(host[key], this, a); }   // js/trail.js: how to draw it again
    try { return orig.apply(this, a); } finally { if (r) ROUTE_NEXT = null; }
  };
  host[key].__routed = true;
}
// Screens that need the wiki wait for it (loader.js); the placeholder already carries the address.
const WIKI_SCREENS = [["exploreHome", { tab: "explore" }], ["closeup"], ["colorPage"], ["wikiPage"], ["paintingPage"], ["storyPlayer"], ["daily"],
  ["peek", { overlay: true }], ["tzMaster"], ["tzPalResult"]];
WIKI_SCREENS.forEach(([name, o]) => needsWiki(name, o));
// screen function -> (its arguments) -> { title, path }
// a tapped-but-not-quite-this-color hex (js/swatch.js openTappedColor, David 2026-10-07) rides along as
// ?c=<hex> on the color/name address, so Back and a shared link reproduce the same "Your color" view.
const tappedQS = tapped => tapped ? "?c=" + String(tapped).replace("#", "").toLowerCase() : "";
const ROUTED = [["colorPage", (n, tapped) => n && n.id ? routed(n.title, nodeRoute(n) + tappedQS(tapped)) : null], ["wikiPage", nodeRouted()], ["paintingPage", nodeRouted()], ["storyPlayer", nodeRouted()],
  ["closeup", nodeRouted("/more")],
  ["daily", () => routed("Today's color", "daily")],   // js/colordle.js: Name today's color
  ["challenge", () => routed("Today's painting", "challenge")], ["challengeDone", () => routed("Today's painting", "challenge")],   // js/challenge.js
  ["favShelf", () => routed("Your colors", "favorites")], ["favTaste", () => routed("Your taste", "favorites/taste")],   // js/favs.js, js/favprofile.js
  ["frStart", (m, c) => routed("Rank your colors", "favorites/rank/" + (m || "bws"))],   // js/favrank.js
  ["tasteIntro", k => k === "palette" ? routed("Find your palette", "taste/palette") : routed("Find your color", "taste/color")],
  ["glPage", (i, d, fromHex, tol) => routed(d && d.t || "Painting", "gallery/" + i + (fromHex ? "?c=" + String(fromHex).replace("#", "").toLowerCase() + (tol != null ? "&t=" + tol : "") : ""))],
  ["paintingsOfPage", (hexes, o) => { const h = typeof ptHexList === "function" ? ptHexList(hexes) : []; return h.length ? routed("Color in paintings", ptPath(h, { ...PT_PREF, mode: "all", sort: "cover", source: "paintings", ...(o || {}) })) : null; }],   // js/paintingsof.js (L26)
  ["chordsPage", () => routed("Masters' chords", "chords")],
  ["spPage", hexes => { const h = typeof spCanon === "function" ? spCanon(hexes) : []; return h.length >= 2 ? routed(spTitle(h), spPath(h)) : null; }],   // js/setpage.js: a pair or a set   // js/chords.js (L26)
  ["poemPage", id => id != null ? routed("Poem", "poem/" + id) : null],   // js/poems.js   // a museum painting (js/gallery.js); i = its place in the gallery index
  ["passagePage", p => p && p.id ? routed(p.title, "passage/" + p.id) : null],
  ["filmPage", f => f && f.id ? routed(f.title, "film/" + f.id) : null],   // js/passages.js, js/films.js
  ["namePage", (entry, push, tapped) => entry && entry.n ? routed(entry.n, "name/" + routeSlug(entry.n) + tappedQS(tapped)) : null],   // js/names.js: a library color that isn't one of the 101
  ["phOpenRecord", (id, rec) => id != null ? routed(rec && (rec.title || rec.from) || "Your photo", "photo/" + id) : null],   // js/photos.js
  ["lkOpen", id => { const l = typeof lkGet === "function" && lkGet(id); return l ? routed(l.name, "look/" + id) : null; }],   // js/looks.js
  ["fashionPage", slug => typeof worldRouteTitle === "function" ? routed(worldRouteTitle(slug), "fashion/" + slug) : null],   // js/world.js
  ["btListPage", kind => typeof btListTitle === "function" ? routed(btListTitle(kind), "botany/" + kind) : null],   // js/botany.js (plant/dye/essay detail pages route via wikiPage above)
  ["btFloriPage", () => routed("The language of flowers", "botany/flori")],   // js/botany.js
  ["awPainter", slug => slug ? routed(awTitle("painter", slug), "painter/" + slug) : null],   // js/artwiki.js: the art wiki
  ["awGroup", (kind, key) => kind && key != null ? routed(awTitle(kind, key), kind + "/" + (kind === "decade" ? key : routeSlug(key))) : null],
  ["awIndex", () => routed("Art history by color", "arthistory")],
  ["awVs", (a, b) => routed("Painter against painter", "painters" + (a ? "/" + a + (b ? "/" + b : "") : ""))],
  ["gmListPage", kind => typeof gmListTitle === "function" ? routed(gmListTitle(kind), "gem/" + kind) : null],   // js/gems.js (gem/essay detail pages route via wikiPage above)
  ["labHoney", () => routed("Honeycomb lab", "lab/honey")], ["sndLab", () => routed("Sounds", "lab/sounds")],   // js/sound.js   // js/home.js: rate every preset at every set size
  ["msOpen", () => routed("Study the map", "mapstudy")],   // js/mapstudy.js
  ["gamutWheel", () => routed("Gamut wheel", "studio/wheel")],   // js/studio.js
  ["openSavedPalette", id => routed("Your palette", "studio/palette/" + id)],   // js/studio.js
  ["prHome", () => routed("Practice", "practice")], ["prPlay", m => PR_METHODS[m] ? routed(PR_METHODS[m].t, "practice/" + m) : null],   // js/practice.js
  ["r2DrillsPage", () => routed("Drills", "train/drills")], ["r2EyePage", () => routed("Your eye", "train/eye")],   // js/rooms2.js: Train's two rows
  ["ooMap", () => routed("Odd one out", "odd")], ["ooEyePage", () => routed("Your eye", "odd/eye")],   // js/games/oo-ui.js
  ["hgMap", () => routed("Gradients", "hue")], ["hgDaily", () => routed("Today's gradient", "hue/daily")],   // js/games/hue-ui.js
  ["ooWhose", () => routed("Whose palette?", "odd/whose")], ["ooAcross", () => routed("Across the line", "line")], ["ooPairs", () => routed("Painters' pairs", "odd/pairs")],
  ["pmOpen", spec => typeof pmRouteOf === "function" ? pmRouteOf(spec) : null],   // js/paintmap.js: #/paintings/map?arr=…&co=…
  ["arHubPage", id => id ? routed(arPretty(id), "hub/" + id) : null], ["arWhichPage", name => name ? routed(arPretty(name), "which/" + name) : null],
  ["arReadPage", (slug, ch) => slug ? routed(AR_READING.has(slug) ? AR_READING.get(slug).art.name : arPretty(slug), "read/" + slug + (ch ? "/" + ch : "")) : null]];   // js/article.js: the book, #/read/<slug>[/<chapter>]   // js/article.js: #/hub/<id>, #/which/<name>
// Scripts loaded after router.js (artwiki.js, article.js, looks.js, fashion.js...) aren't defined yet when this runs, so boot.js
// calls routeWrapAll() again before the first address opens (without it a typed #/painter/<slug> lost its address).
function routeWrapAll() { ROUTED.forEach(([name, f]) => routeWrap(window, name, f)); }
routeWrapAll();
routeWrap(LAB, "contrast", () => routed("Albers", "lab/contrast"));
routeWrap(LAB, "namer", () => routed("Name any color", "studio/namer"));   // js/namer.js

// ---------- opening an address ----------
const routeColor = slug => [...BASICS, ...ALL].find(c => routeSlug(c.n) === slug) || null;
// a library color that isn't one of the 101 (js/names.js): CORE_NAMES loads lazily, so this only resolves once it has
const routeName = slug => (CORE_NAMES || []).find(e => routeSlug(e.n) === slug) || null;
// Any address #/name/<slug> must open: the ~1,000 core names, then the 2,700-name library, then an alias (a synonym
// slug in data/aliases.json, or an "also called" of a core or library name), which opens its color with the alias
// as the first "Also called". Resolves { color } (one of the 101), { entry } or null.
let ROUTE_ALIASES = null;
function routeNameAsync(slug) {
  const aliases = ROUTE_ALIASES || (ROUTE_ALIASES = fetch("data/aliases.json").then(r => r.ok ? r.json() : {}).catch(() => ({})));
  return Promise.all([loadCoreNames(), loadLongNames(), aliases]).then(([, long, al]) => {
    const core = routeName(slug), lib = !core && findLongName(slug);
    if (core) return { entry: core };
    if (lib) return { entry: npEntryFor({ n: lib.n, h: lib.h, lib }) };
    const open = (target, alias) => {
      const t = routeSlug(target), c = routeColor(t), e = routeName(t), l = !e && findLongName(t);
      if (c) return { color: c };
      const entry = e || (l && npEntryFor({ n: l.n, h: l.h, lib: l }));
      return entry ? { entry: alias ? { ...entry, also: [alias, ...(entry.also || []).filter(a => routeSlug(a) !== routeSlug(alias))] } : entry } : null;
    };
    const to = al && al.slugs && al.slugs[slug];
    if (to) {
      const nm = (Object.keys(al.names || {}).find(k => routeSlug(k) === slug) || slug.replace(/-/g, " ")).replace(/\b\w/g, m => m.toUpperCase());
      const r = open(to, nm); if (r) return r;
    }
    const has = e => (e.also || []).find(a => routeSlug(a) === slug);
    const host = (CORE_NAMES || []).find(has) || (long || []).find(has);
    if (host) { const r = open(host.n, has(host)); if (r) return r; }
    return null;
  });
}
// an address that matches no color: say so, with the closest names, never Home
function routeNoName(slug) {
  const words = slug.split("-").filter(w => w.length > 2);
  const list = (CORE_NAMES || []).map(e => ({ e, k: words.filter(w => routeSlug(e.n).includes(w)).length })).filter(x => x.k).sort((a, b) => b.k - a.k || (a.e.rank || 0) - (b.e.rank || 0)).slice(0, 3).map(x => x.e);
  ROUTE_NEXT = routed("No color by that name", "name/" + slug); ROUTE_REPLACE = true;
  const el = show(`<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Color</span><span style="width:44px"></span></header>
    <h2 style="margin:24px 16px 8px">No color by that name</h2>
    <p class="fine" style="margin:0 16px 16px">We don't have a color called "${esc(slug.replace(/-/g, " "))}".${list.length ? " These are the closest names." : ""}</p>
    ${list.length ? `<div class="lk-list">${list.map(e => `<button class="lk-row" data-nn="${esc(e.n)}" data-h="${e.h}"><i style="--c:${e.h}"></i><b>${esc(e.n)}</b></button>`).join("")}</div>` : ""}`, "article");
  el.querySelectorAll("[data-nn]").forEach(b => b.onclick = () => openCoreName(b.dataset.h, b.dataset.nn));
  const bk = el.querySelector("[data-back]"); if (bk) bk.onclick = () => xBack();
}
// initial: first load. The address is opened on top of its tab's home, so Back lands somewhere sensible.
function openRoute(hash, initial = false) {
  if (!/^#\/./.test(hash || "")) return false;
  const parts = decodeURIComponent(hash.slice(2)).split("/").filter(Boolean);
  let [kind, id, more] = parts;
  // ?c=<hex> (js/swatch.js openTappedColor, David 2026-10-07): the exact color that opened this page as its
  // nearest name but isn't quite it — same "?c=" convention the gallery route already used for a painting
  // palette tap. Lives inside the hash fragment itself (there's no true query string here), so it's just the
  // tail of `id` once split off, same as "gallery/12?c=aabbcc" below.
  let tappedHex = null, tappedTol = null;
  if (id && id.includes("?c=")) {
    const [clean, qs] = id.split("?c="), [hx, ...rest] = qs.split("&");
    id = clean; tappedHex = "#" + hx.toUpperCase();
    const t = rest.map(x => x.match(/^t=(\d+(?:\.\d+)?)$/)).find(Boolean); tappedTol = t ? +t[1] : null;   // &t=<tol> rides with a painting's ?c=
  }
  // "learn" is kept as a working alias for "today" (DESIGN-SYSTEM.md §2: Learn is the room's real name now;
  // #/today still opens it, since that address is already shared and bookmarked).
  // "museum" is the room's address now (core.js NAV_MUSEUM); the older #/explore… addresses still open it
  const tabs = { today: "learn", learn: "learn", train: "gym", studio: "studio", explore: "explore", museum: "explore", you: "you" };
  // hoisted above the tabs[kind] check below, since studio/wheel and studio/palette/<id> are Studio sub-screens,
  // not the tab home itself, and need it too (js/studio.js)
  const base = () => {
    X_ROOT = "home";   // a page opened from an address: Back unwinds to the map (js/trail.js), not to a room
    if (!initial) return;
    try { history.replaceState({ ch: 1, tab: S.tab || "learn" }, "", "#/" + tabRoute(S.tab || "learn").path); } catch (e) {}
    ROUTE_REPLACE = false;   // the screen itself goes on top
  };
  if (kind === "studio" && id === "namer" && typeof LAB.namer === "function") { base(); XSTACK = []; LAB.namer(tappedHex); return true; }
  if (kind === "studio" && id === "wheel" && typeof gamutWheel === "function") { base(); XSTACK = []; gamutWheel(); return true; }
  if (kind === "studio" && id === "palette" && more && typeof openSavedPalette === "function") { base(); XSTACK = []; openSavedPalette(more); return true; }
  // the floor (the honeycomb, js/home.js): not a tab, so it's its own address
  if (kind === "home" && typeof hmHome === "function") { base(); XSTACK = []; hmHome(); return true; }
  if (kind === "map" && id && more != null && typeof hmMapRoute === "function") { base(); XSTACK = []; hmMapRoute(id, more); return true; }   // js/home.js: #/map/gallery/<i>, #/map/painting/<slug>
  if (kind === "train" && id === "drills" && typeof r2DrillsPage === "function") { base(); XSTACK = []; r2DrillsPage(); return true; }   // js/rooms2.js
  if (kind === "train" && id === "eye" && typeof r2EyePage === "function") { base(); XSTACK = []; r2EyePage(); return true; }
  if (tabs[kind]) {
    if (kind === "explore" || kind === "museum") S.lens = LENS_LEGACY[id] || Object.keys(LENS_ROUTE).find(k => LENS_ROUTE[k] === id) || "all";
    go(tabs[kind]);
    return true;
  }
  const node = () => kind === "color" ? (routeColor(id) ? colorNode(routeColor(id)) : null)
    : graph().nodes.get(kind === "painting" ? "painting-" + id : kind === "story" ? "s:" + id : id) || null;
  if (["color", "page", "painting", "story"].includes(kind) && id) {
    if (kind === "color" && !routeColor(id)) return false;
    base();
    ROUTE_NEXT = routed(kind === "color" ? routeColor(id).n : "", parts.slice(0, more === "more" ? 3 : 2).join("/"));
    whenWiki(() => {
      const n = node();
      if (!n) return xToOrigin();
      XSTACK = [];
      if (more === "more") return closeup(n);
      return n.kind === "story" ? storyPlayer(n) : openNode(n, true, kind === "color" ? tappedHex : null);
    });
    return true;
  }
  if (kind === "poem" && id && typeof poemPage === "function") {
    base(); XSTACK = []; poemPage(id); return true;
  }
  if (kind === "passage" && id && typeof passagePage === "function") {
    base(); XSTACK = []; archWhen(() => { const p = PSG && PSG.byId.get(id); if (p) passagePage(p); else xToOrigin(); }); return true;
  }
  if (kind === "film" && id && typeof filmPage === "function") {
    base(); XSTACK = []; archWhen(() => { const f = (window.FILMS || []).find(x => x.id === id); if (f) filmPage(f); else xToOrigin(); }); return true;
  }
  if (kind === "look" && id && typeof lkOpenRoute === "function") { base(); XSTACK = []; lkOpenRoute(id); return true; }   // js/looks.js
  if (kind === "botany" && id && typeof btOpenRoute === "function") { base(); btOpenRoute(id); return true; }   // js/botany.js
  if (kind === "gem" && id && typeof gmOpenRoute === "function") { base(); gmOpenRoute(id); return true; }   // js/gems.js
  if (kind === "name" && id) {
    // an app color's slug opens its own deep page instead (ROADMAP.md §13): same address family, same rule
    // as routeColor above for "color/<slug>".
    const c = routeColor(id);
    if (c) { base(); whenWiki(() => { XSTACK = []; openNode(colorNode(c), true, tappedHex); }); return true; }
    base();
    if (!CORE_NAMES) { ROUTE_NEXT = routed("", "name/" + id); waitScreen(); ROUTE_REPLACE = true; }
    XSTACK = [];
    routeNameAsync(id).then(r => {
      if (r && r.color) { XSTACK = []; openNode(colorNode(r.color), true, tappedHex); }
      else if (r && r.entry) namePage(r.entry, true, tappedHex);
      else routeNoName(id);
    });
    return true;
  }
  if (kind === "line" && typeof ooAcross === "function") { base(); XSTACK = []; ooAcross(); return true; }   // js/games/line.js
  if (kind === "odd" && typeof ooOpenRoute === "function") { base(); XSTACK = []; ooOpenRoute(id); return true; }   // js/games/oo-ui.js: #/odd, #/odd/eye, #/odd/whose, #/odd/pairs
  if (kind === "hue" && typeof hgOpenRoute === "function") { base(); XSTACK = []; hgOpenRoute(id); return true; }   // js/games/hue-ui.js: #/hue, #/hue/daily
  if (kind === "photo" && id && typeof photoPage === "function") { base(); XSTACK = []; photoPage(id); return true; }
  if (kind === "hub" && id && typeof arHubPage === "function") { base(); XSTACK = []; arHubPage(id); return true; }   // js/article.js
  if (kind === "which" && id && typeof arWhichPage === "function") { base(); XSTACK = []; arWhichPage(id); return true; }
  if (kind === "read" && id && typeof arReadPage === "function") { base(); XSTACK = []; arReadPage(id, more || null); return true; }   // js/article.js: a story, opened as a book
  if (kind === "gallery" && /^\d+$/.test(id || "") && typeof galleryPage === "function") {
    // #/gallery/<n>?c=<hex>&t=<tol>: the color that brought you, and how close it had to be (stripped into tappedHex/tappedTol above)
    const fromHex = tappedHex || null;
    base();
    if (!GAL) { ROUTE_NEXT = routed("Painting", "gallery/" + id + (fromHex ? "?c=" + fromHex.slice(1).toLowerCase() : "")); waitScreen(); ROUTE_REPLACE = true; }   // the painting replaces the placeholder
    XSTACK = [];
    galleryPage(+id, true, fromHex, tappedTol);
    return true;
  }
  if (kind === "paintings" && /^map\b/.test(id || "")) { base(); XSTACK = []; pmGo(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "", true); return true; }   // the painting map (js/paintmap.js)
  if (kind === "chords" && typeof chordsPage === "function") { base(); XSTACK = []; chordsPage(); return true; }   // js/chords.js (L26)
  if ((kind === "pair" || kind === "set") && id && typeof spPage === "function") {   // js/setpage.js: #/pair/<a>+<b>, #/set/<a>-<b>-<c>…
    const hs = spCanon(id);
    if (hs.length >= 2) { base(); XSTACK = []; spPage(hs, { push: true }); return true; }
    return false;
  }
  if (kind === "paintings-of" && id && typeof paintingsOfPage === "function") {   // js/paintingsof.js (L26): #/paintings-of/<hex>[+<hex>…]?t=3&m=5
    const q = ptParse(id);
    base(); XSTACK = [];
    if (q.hexes.length) { paintingsOfPage(q.hexes, { ...q.st, push: true }); return true; }
    return false;
  }
  if (["painter", "movement", "decade", "country", "arthistory", "painters"].includes(kind) && typeof awOpenRoute === "function") { base(); XSTACK = []; awOpenRoute(kind, id, more); return true; }   // js/artwiki.js
  const simple = { daily: () => daily(), challenge: () => challenge(),
    taste: () => tasteIntro(id === "palette" ? "palette" : "color"),
    favorites: () => typeof favShelf !== "function" ? xToOrigin() : id === "taste" ? favTaste() : id === "rank" ? frStart(more || "bws", "all") : favShelf(),   // js/favs.js
    lab: () => id === "sounds" && typeof sndLab === "function" ? sndLab() : id === "honey" && typeof labHoney === "function" ? labHoney() : (LAB[id] && ["harmony", "contrast"].includes(id) ? LAB[id] : LAB.harmony)(),
    fashion: () => typeof fashionPage === "function" && fashionPage(id),
    mapstudy: () => typeof msOpen === "function" ? msOpen() : xToOrigin(),   // js/mapstudy.js
    // the honeycomb home's instant mini-lesson (js/learnit.js): #/learnit/<color>
    learnit: () => { const c = id && routeColor(id); if (c && typeof hmLearnIt === "function") hmLearnIt(c); else if (id && typeof lxRouteLearnIt === "function") lxRouteLearnIt(id); else xToOrigin(); },
    practice: () => typeof prOpenRoute === "function" ? prOpenRoute(id) : xToOrigin() };   // js/practice.js: #/practice, #/practice/<method>
  if (simple[kind]) { base(); simple[kind](); return true; }
  return false;
}
// ---------- the painting map (js/paintmap.js + css/paintmap.css) ----------
// Listed in index.html once the conductor adds the tags; until then (and for a cached index.html) both load here,
// once, on first use. pmGo(spec): spec is the map's query ("arr=color&co=France&y0=1880&y1=1889") or a spec object.
// Any element with data-pmap="<query>" opens it (the Art cover, Art's views, painter pages, a painting, a color's paintings).
let PM_LOAD = null;
function pmLoad() {
  if (typeof pmOpen === "function") return Promise.resolve();
  const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
  return PM_LOAD || (PM_LOAD = new Promise((res, rej) => {
    if (!document.querySelector('link[href^="css/paintmap.css"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/paintmap.css" + v; document.head.appendChild(l); }
    const s = document.createElement("script"); s.src = "js/paintmap.js" + v; s.onload = res; s.onerror = () => { PM_LOAD = null; s.remove(); rej(new Error("paintmap")); }; document.head.appendChild(s);
  }));
}
function pmGo(spec, fromAddress) {
  return pmLoad().then(() => pmOpen(spec, { address: !!fromAddress, fresh: true })).catch(e => { console.warn(e); toast("The painting map didn't load"); if (fromAddress) xToOrigin(); });
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-pmap]"); if (!b) return;
  e.preventDefault(); e.stopPropagation(); buzz(6); pmGo(b.dataset.pmap);
}, true);

// a typed or linked #/ address while the app is open (Back between our own entries is handled in core.js)
addEventListener("hashchange", () => {
  if (SHOT || location.hash === ROUTE_NOW || !/^#\/./.test(location.hash)) return;
  ROUTE_REPLACE = true;   // the browser already made the history entry
  if (!openRoute(location.hash)) xToOrigin();
});
