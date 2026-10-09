"use strict";
// Museum collections that had no door at all before this lane (design/SIMPLIFY/PLAN.md §3.1/§9: "the Ideas
// lens split into its own collections"). Each wraps an existing section builder (lkSections, filmsSection,
// the page-kind filters explore.js's old Ideas lens used, poemsPanel) in its own addressable screen, reusing
// explore.js's shared pin()/masonry()/feedSectionsHTML()/wirePartBack()/partHeader() so these read exactly
// like the rest of the Museum. Nothing here edits looks.js/films.js/passages.js/poems.js/artwiki.js — only
// calls their existing exports, so this file can't conflict with whoever else is touching those.
//
// Gating: a wiki-backed collection (Stories, Pigments & ideas) is safe to build immediately -- exploreHome()
// is wrapped in needsWiki() (router.js WIKI_SCREENS), so by the time someone can tap a Museum tile the wiki
// is already loaded. Looks (data/looks.js) and the archive (data/passages.json, data/films.js) are each
// their OWN lazy load, not the wiki's, so those two wait on lkWhen()/archWhen() like every other entry point.

// ---------- Stories ----------
function museStories() {
  XSTACK = [];
  const g = graph(), stories = g.stories || [];
  const SECS = [{ title: "Stories", sub: "Short reads, a few swipes each.", pins: stories.map(n => pin(n)) }];
  const el = show(`${partHeader("Stories")}<p class="p-dek">${stories.length} short reads, a few swipes each.</p><div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
  wirePartBack(el); wireFeedSections(el);
}

// ---------- Pigments & ideas ----------
function musePigments() {
  XSTACK = [];
  const g = graph(), pages = [...g.nodes.values()].filter(n => n.kind === "page" && !n.stub);
  const sys = pages.filter(p => (p.swatches || []).length >= 3);
  const ideas = pages.filter(p => !sys.includes(p) && ["concept", "person", "work", "tradition", "culture"].includes(p.type));
  const SECS = [
    { title: "Color systems", sub: "Traditions that gave each color a meaning.", pins: sys.map(n => pin(n, { system: true })) },
    { title: "Ideas and people", pins: seeded(ideas, today()).map(n => pin(n)) },
  ].filter(s => s.pins.length);
  const el = show(`${partHeader("Pigments & ideas")}<p class="p-dek">Traditions, concepts and the people behind them, read through color.</p><div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
  wirePartBack(el); wireFeedSections(el);
}

// ---------- Aesthetics (the 159 looks, plus the family tree) ----------
// window.LOOKS is its own lazy load (lkWhen), separate from the wiki -- lkSections() kicks the fetch off as a
// side effect the first time it's called, but its own built-in redraw-when-ready only fires for S.lens
// === "ideas" (its old home), so this page polls for itself instead of touching looks.js.
function museAesthetics() {
  XSTACK = [];
  const render = () => (typeof lkSections === "function" ? lkSections() : []).filter(x => x.pins && x.pins.length);
  let SECS = render();
  const el = show(`${partHeader("Aesthetics")}<p class="p-dek">Visual styles, from Baroque to Barbiecore. Each look is a family of palettes.</p>
    <div class="x-feed" id="museAesFeed">${SECS.length ? feedSectionsHTML(SECS) : `<p class="fine">Loading the archive…</p>`}</div>`, "article");
  wirePartBack(el);
  const wire = () => {
    const feed = el.querySelector("#museAesFeed"); if (!feed) return;
    feed.addEventListener("click", e => {
      const b = e.target.closest("[data-lk]"); if (b) return lkOpen(b.dataset.lk, { pi: +(b.dataset.lkp || 0), back: museAesthetics });
      const t = e.target.closest("[data-taste]"); if (t) return tasteIntro(t.dataset.taste);
    });
  };
  wire();
  if (!SECS.length) {
    const poll = () => {
      if (!el.isConnected) return;
      SECS = render();
      if (!SECS.length) return setTimeout(poll, 350);
      const feed = el.querySelector("#museAesFeed"); if (feed) { feed.innerHTML = feedSectionsHTML(SECS); wire(); }
    };
    setTimeout(poll, 350);
  }
}

// ---------- Films ----------
function museFilms() {
  XSTACK = [];
  archWhen(() => {
    const SECS = (typeof filmsSection === "function" ? filmsSection() : []).filter(s => s.pins && s.pins.length);
    const el = show(`${partHeader("Films")}<p class="p-dek">How directors use color. Short pieces of our own -- no stills under copyright.</p><div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
    wirePartBack(el);
  });
}

// ---------- Poems ----------
// poemsPanel(el) already is a complete browse-by-color-word UI (js/poems.js); it just never had a page of its
// own (its only caller was a dead lens branch). This gives it a header and an address.
function musePoems() {
  XSTACK = [];
  const el = show(partHeader("Poems"), "article");
  const body = document.createElement("div"); body.className = "x-feed muse-poems";
  el.appendChild(body);
  wirePartBack(el);
  poemsPanel(body);
}
