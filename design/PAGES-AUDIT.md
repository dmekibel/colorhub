# Pages audit (2026-10-09)

David: "We've improved the pages for colors, paintings, painters, and the sources colors come from... Now let's improve the pages of everything else in the app, so the entire app has this nuanced approach to gathering information and presenting it, with hyperlinks consistent across the app... This app needs respect for information: like Wikipedia, but on steroids."

**Method.** Read-only audit. Walked `js/router.js` (`ROUTED` + `openRoute`), `js/trail.js` (trail tokens), and every builder file that renders a destination a link can open. Verified real instances in headless Chrome at 440×956 (not the built-in browser pane, per instructions) for color, painting (curated + archive), painter, movement, source, gem, botany, photographer and poem; the rest were verified by reading the builder and its data file in full. Screenshots lived in a scratch folder under the session scratchpad and have been discarded. No app code was changed.

---

## 1. Inventory: every page kind

"Real article text" means original, sourced prose written for that specific instance — not just facts pulled from a data table.

| # | Kind | Route(s) | Builder (file) | Data source(s) | Instances | Real article text |
|---|---|---|---|---|---|---|
| 1 | Color | `#/color/<slug>` | `colorPage` → `js/explore.js`/`js/richpage.js` | `data/colors.js`, `core-names.json` (912), `library.json` (1,646), `data/articles/*.json` | ~2,700 named colors | **1,908** have a full sourced article (chapters); the rest get wiki-facet "field notes" |
| 2 | Name / alias | `#/name/<slug>` | `namePage` → `js/names.js` | same as above, plus `data/aliases.json` | subset of the ~2,700 not in the core "learn" set | Same article pool as colors — a name page is the same dossier, shorter when no chapters exist |
| 3 | Painting — curated | `#/painting/<slug>` | `paintingPage` → `js/explore.js` (L737) | `data/paintings.js` | **22** | Yes — each has a `note` field of original prose |
| 4 | Painting — archive | `#/gallery/<n>` | `glPage` → `js/gallery.js`, same `paintingPage` renderer | `data/gallery/*` (binary index), `data/analysis/paintings-*.json` | **23,756** (23,778 ids minus the 22 curated) | **No.** `n.note` is empty for every archive painting; only palette + museum/artist facts show |
| 5 | Painter | `#/painter/<slug>` | `awPainter` → `js/artwiki.js` | `data/artists/meta.json`, `data/artists/p/<slug>.json`, `data/analysis/artists/<slug>.json`, bios | **840** with full meta + measured stats; a bio paragraph where the article engine has written one | Partial — measured stats and "most famous/typical/atypical" are generated; a prose bio exists for a subset |
| 6 | Movement | `#/movement/<slug>` | `awGroup` → `js/artwiki.js` | `data/analysis/groups.json` (`byMovement`) | **23** reach the 20-painting threshold for a real page (far more are tagged but thin) | No prose — measured findings only ("cooler than 91% of the 23 movements here"), honestly captioned |
| 7 | Decade | `#/decade/<n>` | `awGroup` | `groups.json` (`byDecade`) | **60** | Same as movement: measured, no prose |
| 8 | Country | `#/country/<slug>` | `awGroup` | `groups.json` (`byCountry`) | **21** | Same as movement: measured, no prose |
| 9 | Art history index | `#/arthistory` | `awIndex` | `groups.json` | 1 (an index) | N/A — a list page |
| 10 | Painters vs. | `#/painters/<a>/<b>` | `awVs` | `data/artists/*` | Generated for any pair | A comparison, not an article |
| 11 | Source / standard | `#/source/<id>` | `sourcePage` → `js/sources.js` | Hand-written `SOURCE_SYSTEMS` object | **13** | Yes — who/when/why/how/caveat, original prose per system |
| 12 | Pair / Set | `#/pair/<hex+hex>`, `#/set/<hex-hex-…>` | `spPage` → `js/setpage.js` | Computed from `colors.js` at request time | Unbounded (any 2–8 colors) | No prose — generated relationships (harmony, "together in paintings," masters' chords) |
| 13 | Color family / hub | `#/hub/<id>` | `arHubPage` → `js/article.js` | Article-engine-built `AR_HUBS` | One per family (dozens) | No — an index of members, not an article |
| 14 | Which (disambiguation) | `#/which/<name>` | `arWhichPage` → `js/article.js` | `AR_HUBS`/`AR_WHICH` | One per ambiguous name | No — a list with one generated differentiator line each |
| 15 | Read (the article as a book) | `#/read/<slug>[/<chapter>]` | `arReadPage` → `js/article.js` | Same 1,908 color articles, chaptered | 1,908 | Yes — same text as #1, in a reading view |
| 16 | Story / guided idea deck | `#/story/<id>` | `storyPlayer` → `js/labs.js` | `data/stories.js` | **58** | Yes — short original slide decks, sourced |
| 17 | Wiki / concept page | `#/page/<id>` | `wikiPage` → `js/explore.js` | `data/wiki-nodes.js` | **74** (17 concept, 3 tradition, 6 culture, 2 movement, 21 pigment, 18 person, 7 work) | Yes — original prose with `[[links]]` |
| 18 | Museum (lens feeds) | `#/museum`, `/art`, `/ideas`, `/world`, `/saved` | `exploreHome` → `js/explore.js` | Aggregates all the kinds below | 4 lenses | N/A — a feed, not an article |
| 19 | Gem | `#/gem/<id>` | `wikiPage` via `gmBuildNodes`/`gmListPage` → `js/gems.js` | `data/gems.js` | **29** gems + 3 essays = 32 | Yes — facts + "the full story" prose, sourced |
| 20 | Botany (plant / dye / essay) | `#/botany/<id>` | `btOpenRoute` → `js/botany.js` | `data/botany.js` | **37 plants + 12 dyes + 4 essays** + 1 flori index = 54 | Yes — facts + original prose |
| 21 | Brand | `#/brand/<id>` | `bdPage` → `js/brands.js` | `data/design/brands.json` | **129** | No prose — a hero, nearest-named-color list and a color-history timeline; no narrative |
| 22 | Photographer | `#/photographer/<slug>` | `photographerPage` → `js/photography.js` | `data/photography/photographers.json` | **54** | No prose — measured stats (lightness/vividness percentiles vs. the other 54), typical/atypical photo |
| 23 | Photo (in the photographer's archive) | `#/photo/<id>` via `#/gallery` plumbing | `paintingPage` reused | `data/photography/photos.json` | **3,465** | No — same generic painting-page renderer, no note |
| 24 | Fashion — decade / house / history / era | `#/fashion/<slug>` | `fashionPage` → `js/world.js` | `data/fashion.js`, `data/fashion-eras.js` | **13 decades + 15 houses + 10 history pages + 3 measured eras ≈ 41** | History pages (10) have prose; decades/houses/eras are measured-only |
| 25 | Film | `#/film/<id>` | `filmPage` → `js/films.js` | `data/films.js` | **32** (12 pre-1930 with real stills + sampled palette; 20 copyright-era with "colors discussed," no stills) | Yes — original prose with facts, images, sources |
| 26 | Poem | `#/poem/<id>` | `poemPage` → `js/poems.js` | `data/poems/s*.json` + `data/poems-index.json` | **11,440** poems | The poem text itself (public-domain), plus per-color-word context; no curatorial essay |
| 27 | Passage (literature) | `#/passage/<id>` | `passagePage` → `js/passages.js` | `data/passages.json` | **225** | Yes — "Why it matters" original prose per passage, sourced |
| 28 | Look / aesthetic | `#/look/<id>` | `lkOpen` → `js/looks.js` | `data/looks.js` + `data/aesthetics/kb/<id>.json` | **159** | Yes — lineage, eras, places, garments, figures, measured findings, original article |
| 29 | Pulp cover | `#/painting/pulp-<id>` (grid at `#/pulp`) | `pulpGrid`/`paintingPage` reused → `js/pulp.js` | `data/design/objects-pulp.json` | **832** | **No.** Reuses the bare painting-page renderer with `note: null`; not a graph node, so "More like this" / Connections render empty |
| 30 | Your photo | `#/photo/<id>` (own uploads) | `phOpenRecord` → `js/photos.js` | User's own camera captures, IndexedDB | 0 until the user adds one | N/A — user content |
| 31 | Saved palette | `#/studio/palette/<id>` | `openSavedPalette` → `js/studio.js` | User's own saves | Per user | Tool, not a content page |
| 32 | Aesthetics family tree | `#/web`, `#/web/focus/<id>`, `#/web/node/<id>` | `agOpenRoute` → `js/aesthetics-graph.js` | The 159 looks' lineage data | 1 interactive graph | A visualization, not a page per node |
| 33 | **Subject palette view** | **none** — `svOpen({kind,id,label})` only | `js/subjectview.js` | `data/analysis/groups.json`, `data/analysis/artists/<id>.json`, `data/looks.js` | Opens for any painter/decade/movement/country/museum/look | **Has no `#/` address at all** — only reachable from the map's Search. Not in `router.js` `ROUTED`, not bookmarkable, not shareable, not crawlable, not in the trail system the rest of the app uses |
| 34 | Design objects (ceramics, costume, furniture, glass, graphic, poster) | — | **none** | `data/design/objects-ceramics.json`, `-costume.json`, `-furniture.json`, `-glass.json`, `-graphic.json`, `-poster.json` | Unknown row counts — **zero code references these files** | Orphaned data: built, never wired to any page or route |

Tool/game pages (Practice, Odd one out, Gradients, the gamut wheel, Taste, Daily, Challenge, Map study, the Honeycomb lab, Favorites) are out of scope for this audit — they're interactions, not "a subject's page," per the task's framing.

**Headline number:** across the ~24 genuine subject-page kinds there are roughly **44,000 addressable instances**. Of those, **~27,400 (painting archive + photos + pulp covers, ~62% of all pages in the app)** render through one generic template with no original text and, for archive paintings and pulp, no connections at all. The other ~38% (colors, painters, movements/decades/countries, gems, botany, brands, photographers, fashion, films, poems, passages, looks, sources, stories, wiki pages) have real measured data or real prose, in varying depth.

---

## 2. The Page Standard

The bar color, painting (curated), painter and source pages now meet, defined so it's checkable against any kind:

1. **Calm hero** — one clear subject, one eyebrow, a title that matches the tap that opened it, nothing competing for attention.
2. **Original, sourced article** — prose written for this instance (not a facts table alone), with sources cited.
3. **Seen through color** — palettes *measured* from real data, many readings where the subject supports it (not one palette), findings stated in plain English with an **n** and a comparison ("compared to what?").
4. **Pictures** — public-domain or CC0 images, captioned and credited, never a stock photo or an invented one.
5. **Connections out** — every mention of another thing is a link; one consistent link style app-wide; related pages of *other* kinds shown, not just more of the same kind.
6. **Connections in** — what links here: which colors, paintings, painters etc. point to this page.
7. **Interactive layer where it fits** — a slider, a game, a map highlight; not bolted on.
8. **Honest metadata** — sources, dates, "as photographed"/"screen approximation" caveats stated once, plainly.
9. **One-tap colors** — every swatch, chip or color mention opens its own page in one tap, never a sheet in between.
10. **Trail / Back behavior** — the page joins the one shared trail (`js/trail.js`), Back returns exactly, Close forgets the chain correctly.
11. **No dead ends** — every page has somewhere else to go.
12. **Night Gallery design + states** — warm black / booth grey / paper button / serif display (design/DESIGN-CANON.md §5); first-time, empty, loading and error states are designed, not just the happy path.

---

## 3. Score matrix (0–3 per item)

0 = absent · 1 = token/placeholder · 2 = present but thin or inconsistent · 3 = meets the bar

| Page kind (grouped) | Hero | Article | Color-read | Pictures | Conn. out | Conn. in | Interactive | Honest | 1-tap | Trail | No dead end | States |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Color / Name (reference bar) | 3 | 3 | 3 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 |
| Painting — curated (22) | 3 | 2 | 2 | 3 | 2 | 1 | 2 | 2 | 3 | 3 | 2 | 2 |
| **Painting — archive (23,756)** | 2 | **0** | 1 | 3 | **0** | **0** | 1 | 2 | 3 | 3 | **0** | 1 |
| Painter (840) | 3 | 1 | 3 | 3 | 2 | 1 | 2 | 3 | 3 | 3 | 2 | 2 |
| Movement / Decade / Country (104) | 2 | 0 | 3 | 2 | 2 | 0 | 1 | 3 | 3 | 3 | 2 | 2 |
| Source (13) | 2 | 2 | 1 | **0** | 1 | 0 | 0 | 3 | 2 | 3 | 1 | 2 |
| Pair / Set (unbounded) | 2 | 0 | 2 | 1 | 2 | 0 | 2 | 2 | 3 | 3 | 2 | 2 |
| Hub / Which (index pages) | 2 | 0 | 1 | 0 | 2 | 0 | 0 | 1 | 3 | 2 | 2 | 1 |
| Story / idea deck (58) | 2 | 3 | 2 | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 | 2 |
| Wiki / concept page (74) | 2 | 3 | 1 | 1 | 2 | 0 | 0 | 2 | 3 | 3 | 2 | 2 |
| Gem (32) | 2 | 3 | 2 | 1* | 2 | 0 | 0 | 3 | 3 | 3 | 2 | 2 |
| Botany (54) | 1 | 3 | 1 | 1* | 2 | 0 | 0 | 3 | 3 | 3 | 2 | 2 |
| Brand (129) | 2 | 0 | 1 | 0 | 1 | 0 | 0 | 2 | 2 | 3 | 1 | 1 |
| Photographer (54) | 3 | 0 | 3 | 3 | 1 | 0 | 0 | 3 | 3 | 3 | 1 | 2 |
| Photo (3,465) | 2 | 0 | 1 | 3 | 1 | 0 | 1 | 2 | 3 | 3 | 1 | 1 |
| Fashion (41) | 2 | 1 | 2 | 1 | 1 | 0 | 0 | 2 | 2 | 3 | 1 | 1 |
| Film (32) | 2 | 3 | 1 | 2 | 2 | 1 | 0 | 3 | 3 | 3 | 2 | 2 |
| Poem (11,440) | 2 | 1 | 1 | 0 | 1 | 0 | 0 | 2 | 2 | 3 | 1 | 1 |
| Passage (225) | 2 | 3 | 1 | 1 | 2 | 1 | 0 | 3 | 3 | 3 | 2 | 2 |
| Look / aesthetic (159) | 2 | 3 | 2 | 1 | 2 | 0 | 1 | 2 | 2 | 3 | 2 | 2 |
| **Pulp cover (832)** | 2 | **0** | 1 | 2 | **0** | **0** | 1 | 1 | 3 | 3 | **0** | 1 |
| **Subject view (0 — no route)** | 2 | 0 | 2 | 0 | 1 | 0 | 3 | 2 | 2 | **0** | 1 | 1 |
| Design objects (orphaned) | — | — | — | — | — | — | — | — | — | — | — | — |

\* Gem and botany pages carry real photo data (`data/gem-images.js`, `data/botany-images.js` with Wikimedia credits), but the hero itself is a flat color swatch, not the photo — the photo appears lower on the page if at all, so it's scored thin rather than zero.

**Column averages (excluding orphaned rows), roughly worst to best:** Connections in (0.3), Interactive (0.8), Article text (1.3), No dead ends (1.5), Pictures (1.4), Connections out (1.5).

---

## 4. The worst gaps

1. **Connections in don't exist as a structural feature.** There is no "what links here" anywhere in the app except one ad hoc case: a color's "appears in" list of paintings (`js/article-refs.js`, the `ap` field). A painter page doesn't say which colors, movements or stories cite it; a movement page doesn't link back to the painters who define it beyond its own member grid; a gem or botany page doesn't show which colors or paintings reference it. This is the single most "Wikipedia" feature missing, and it's missing everywhere, not just on weak kinds.

2. **The painting-archive and pulp-cover dead end (24,588 pages, >55% of the app's addressable pages).** `paintingPage()` (`js/explore.js` L737) is the renderer for curated paintings, the 23,756 archive paintings, the 3,465 photographer photos and the 832 pulp covers alike. Only the 22 curated paintings carry a `note`. For everything else, `connSection(n)` calls `connections(n)`, which (per `js/pulp.js`'s own comment) "simply return[s] nothing for an unknown id" — so the majority of paintings in the app, the thing the whole archive and most "In paintings" links point at, open onto a page with a palette, a few facts, and literally nothing else to click through to. This is the opposite of "the links are the product."

3. **Pulp covers have zero identity of their own.** 832 magazine/paperback covers get no prose, no "designer/illustrator" article, no movement/decade grouping, no connections — they're visually gated behind a nice grid (`js/pulp.js` is well-built for browsing) but the destination page is empty. Same gap as #2, called out separately because it's a whole page *kind* that was added with no article plan at all (its own code comment explicitly documents this as the chosen shortcut).

4. **Subject view has no address.** `js/subjectview.js` is the newest, richest interactive view in the app (real per-subject palettes, a count slider, measure/filter controls, "never invents a color") — but it only opens via `svOpen()` from the map's Search, never through `router.js`. It has no `#/` route, isn't in `ROUTED`, can't be bookmarked or shared, isn't crawlable, and doesn't join the one shared trail the rest of the app uses. A rich page that nobody can link to.

5. **Source pages are honest but isolated.** All 13 read well (who/when/why/how/caveat) but have no pictures, and — confirmed live — Pantone's page says "We don't have any of our colors tagged to this source yet," a real dead end on a page that otherwise looks finished. No source cross-links to another source, no connection to a painter/era that used it.

6. **Brand, photographer, fashion and poem pages skip the article entirely.** These four kinds are built entirely from measured facts or borrowed text (poems are public-domain originals, which is right) with no original curatorial writing — closest in spirit to a spec sheet, not a Wikipedia-on-steroids page. Of these, photographer pages are the best built (strong color-read: percentiles against the other 54 photographers, a typical/atypical photo) but still textless.

7. **Design-object data (ceramics, costume, furniture, glass, graphic, poster) is built and orphaned.** Six JSON files exist under `data/design/` with no code anywhere referencing them. Either they're a page kind that was planned and never wired, or dead weight; either way it's unaccounted-for work.

8. **Link-style consistency** — within the kinds that do link out (`data-arch`, `data-to`, `data-awpainter`, `data-bd-open`, `data-arch`, `[[wikilinks]]` via `linkText()`), the *mechanism* is consistent (one tap always opens, never a sheet — David's P2/P3 are respected everywhere checked), but the *visual signifier* is not: color words get a colored underline treatment (`archInk`/`poemWord`), painter names get a plain `.aw-link` button, brand/gem/botany "near matches" get swatch+button rows, and plain-text mentions inside generic facts (e.g., a movement name inside a painter's dek, or a museum name in a painting's `place` string) are **not linked at all** — confirmed on painter and movement screenshots, where "United States," "Impressionism" are links from the painter page but museum names and sitter/subject names elsewhere are plain text.

---

## 5. Ranked upgrade plan

Ranked by (centrality in the link graph — how many other pages point at or would point at this kind) × (gap size from the matrix), then effort.

### 1. Give every page kind "What links here" (connections in) — template work, not content
The single missing structural feature, and it touches every kind at once. `graph()` (`js/graph.js`) already holds every node and its outgoing edges; a backlink index is a one-time inversion of that map (built lazily, cached), not new data collection. Surfacing it as a shared `connectionsIn(node)` call next to the existing `connSection()` turns every kind's score on this column from 0–1 to 2–3 in one pass. **Effort: medium** (one new shared component + one index build pass; no new content). Highest leverage in the whole audit because it compounds every other kind's score.

### 2. Fix the painting-archive and pulp dead end (the 62%-of-the-app problem)
Can't write 24,588 original essays. The honest, scalable fix:
- **Template work (do first):** make `connSection(n)` degrade gracefully instead of emptily — every painting, archive or pulp, should always get a "By [artist/magazine]," "From [movement/decade/country]," and "Colors in this painting also appear in" rail, computed from the same data `js/subjectview.js` already proves out (no new writing, just wiring the generic painting node into the graph instead of leaving it unregistered). This alone fixes the literal dead end for all 24,588 pages.
- **Content work (second, smaller target):** expand the *curated* set (22 → a few hundred) by centrality — the paintings already most linked-to from painter, movement and color pages (the ones used as "most famous"/"most typical"/"most atypical" elsewhere) get real notes first, via the article workflow below.
- **Effort: medium for the template fix, large but boundable for the curated expansion** (a few hundred short notes, not thousands).

### 3. Address and wire Subject View into the router and trail
`svOpen({kind,id,label})` → add `routeWrap`/`ROUTED` entries (`#/subject/<kind>/<id>`) exactly the way every other kind in `router.js` already works, so it's bookmarkable, shareable, crawlable and joins `XSTACK`. This is close to free: the screen already exists and is well-built; it's a routing/trail gap, not a design gap. **Effort: small.**

### 4. Pictures on gem and botany pages
The photo data already exists (`data/gem-images.js`, `data/botany-images.js`, Wikimedia-sourced, credited) but isn't used as the hero the way painter and film pages use theirs. Swap the flat-color hero for the real photo (falling back to the swatch only when no photo exists), matching the "Albers strip" pattern DESIGN-CANON.md §4 already prescribes. **Effort: small** (data exists; it's a template change in `js/gems.js`/`js/botany.js`).

### 5. Original articles for brand, photographer and fashion pages
These three kinds have the richest *measured* data of the whole "weak" tier (photographer pages already run real percentile comparisons) but no narrative voice at all — the biggest "thin, not nuanced" gap David will feel browsing. Brand color histories and photographer bios are naturally short (a paragraph or two per instance, 129 + 54 + 41 ≈ 224 instances) — small enough for the article workflow below to clear in a bounded pass, unlike the painting archive. **Effort: large but boundable** (≈224 short articles, writers + checkers, not a redesign).

### Doing content at scale, honestly (the workflow already implied by the data shapes)
The kinds that already have real prose (color, gem, botany, film, passage, look, story, wiki page) were clearly built by the same repeatable pipeline: **measure first** (palettes, stats, percentiles — computed, never invented), **write second** (original prose grounded in those numbers plus real sources), **check third** (facts matched against sources, color myths screened against CLAUDE.md's anti-claims list, links validated). Scaling the remaining kinds should reuse that pipeline rather than inventing a new one:
1. A **writer pass** drafts from the measured data + sources already on file (brand histories, photographer bios, a few hundred painting notes) — original prose, 15-word-quote-max discipline per CLAUDE.md's book rule.
2. A **checker pass** (a second, fresh-context agent) verifies every fact against its cited source and every `[[link]]` against a real page, the same role the design doc's "checkers" play for the color-article pipeline.
3. **`tools/article_lint.py`** (propose, if it doesn't exist yet under that name — `tools/check_wiki.js` is the closest existing gate) runs the same structural checks `check_wiki.js`/`check_names.js` already run for color articles: every `[[link]]` resolves, every source is a real URL, no banned myth phrasing, caveats present.
This keeps the honesty bar (CLAUDE.md's myths list, "as photographed," n-and-caveat) structural rather than per-writer discipline.

---

## 6. The shared PAGE TEMPLATE

Right now every kind has its own builder file reimplementing hero/article/connections from scratch (`paintingPage`, `bdPage`, `filmPage`, `passagePage`, `gmListPage`→`wikiPage`, `sourcePage`...), which is exactly why consistency is per-page instead of structural. One component set, used by every kind, with each kind supplying only its own data:

```
PageTemplate({
  hero:        { image|swatch, eyebrow, title, dek },                 // §1 Calm hero
  article:     { body[], sources[] } | null,                           // §2 Original article (null -> honest "not yet written" state, not a blank page)
  colorRead:   { palettes[], findings[{text, n, caveat}] } | null,     // §3 Seen through color
  gallery:     { images[{src, alt, caption, credit, licenseUrl}] },    // §4 Pictures
  connectionsOut: { byKind: Map<kind, node[]> },                       // §5 — already exists as connSection()/CONN_LENSES; make it the default, not opt-in
  connectionsIn:  { byKind: Map<kind, node[]> },                       // §6 — NEW, the graph-inversion component from plan item 1
  interactive: Component | null,                                       // §7 — slider/game/map-highlight slot
  metadata:    { sources[], caveats[], asOf },                         // §8 Honest metadata
  trail:       { kind, title, thumb },                                 // §9/§10 — feeds js/trail.js's existing TL_KIND/tlCapture
})
```

- **Hero, metadata, trail** are already effectively standardized (every kind goes through `show()`/`tlNote()`), so this is naming what exists, not inventing it.
- **connectionsOut** already exists as `connSection()`/`CONN_LENSES` for graph nodes — the fix is making every kind register as a real graph node (closing gap #2) and calling this consistently, not building something new.
- **connectionsIn** is the one genuinely new shared piece (plan item 1) — once built once, every kind gets it for free.
- **colorRead** and **article** being nullable-but-labeled (rather than silently blank) is what turns "we haven't written this yet" into an honest empty state instead of a dead end — consistent with DESIGN-CANON's "no almost-empty pages" rule already applied ad hoc in `js/passages.js`/`js/films.js`'s family-fallback rows.

Building this as one shared module (e.g. `js/pagekit.js`) that `paintingPage`, `bdPage`, `photographerPage`, `fashionPage` etc. call into, instead of each hand-rolling its own markup, is what makes "hyperlinks consistent across the app" structural rather than a per-file discipline to remember.

---

## Summary

- **34 page kinds inventoried** (24 genuine content kinds + tool/game pages + 2 structural gaps: no-route and orphaned-data).
- **5 weakest page kinds:**
  1. **Painting — archive (23,756 instances):** no article, no connections, literal dead end on >half the app's pages.
  2. **Pulp covers (832):** same dead end, plus no identity of its own as a kind.
  3. **Subject view (0 addressable — not a route at all):** the richest new screen in the app, unlinkable and unshareable.
  4. **Brand (129) / Fashion (41):** honest data, zero narrative voice.
  5. **Source pages (13):** well-written but isolated — no pictures, no cross-links, at least one live dead end (Pantone).
- **Top 5 recommended upgrades, in order:**
  1. Build a shared "connections in" (what-links-here) component off the existing graph — touches every kind at once.
  2. Wire every painting/pulp node into the graph with a graceful connections rail, then expand the curated-note set by centrality.
  3. Give Subject View a real `#/subject/<kind>/<id>` route and trail entry.
  4. Promote the existing Wikimedia photo data into the hero on gem and botany pages.
  5. Run the writer → checker → lint pipeline (already proven on colors/gems/botany/films) on brand, photographer and fashion pages.
