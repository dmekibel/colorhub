# Archive pages: painter, painting, decade, movement, country, museum (2026-10-08)

Research and proposal only, nothing built. Screens were rendered headless at 440x956 through `tools/_qa/frame.html` (Sargent, the 1880s, Impressionism, the art-history index, a Degas painting).

**The verdict.** The data is deep: clusters, signatures measured against the same museums, roles, change points, nearest painters and percentiles. The pages are the problem, in three ways:

1. **They lead with varnish.** The first thing on the 1880s page is eight near-black browns with hex codes, followed by a caption admitting it ("These are mostly the dark browns of aged varnish"). Sargent's "Colors in most of the work" opens with Blackish Brown and Smoky Black.
2. **There are almost no paintings on the painter, decade and movement pages.** You learn about Sargent's color without seeing a Sargent above the fold.
3. **The art wiki (`js/artwiki.js`) and Browse (`js/browse*.js`) are two parallel archives.** Each has its own painter list, timeline and filters. Browse already has the better tools (Grid, River, Wall, facet chips with counts), and the wiki pages can't use them.

So the fix is mostly merging and reordering, not adding.

---

## 1. Audit

| Surface | Goal | Hits | Almost | Misses | Skeptic pre-mortem |
|---|---|---|---|---|---|
| **Painter** (`awPainter`) | "What's special about his color", many palettes, measured | The barcode of every painting is a real idea. Palettes are named after their typical painting. Findings come with n. Signature colors are lifted against the same museums. Roles. Teacher and influence links. Compare. "Whose palette?" | The barcode has no scrubbing: you can tap a sliver, but you can't see which painting it is. Palette names fall back to "Palette 3" while titles load. Findings are dense sentences with stats ("in 12 of the 27 paintings that have it, against 20%"). | No paintings above the fold. The page runs through 7 stacked sections: findings, bio, you, palettes, colors (4 drawers), over time, compared. "Colors in most of the work" (`ptPainterColors`) re-surfaces varnish. | "It's a stats report about a painter, with no paintings." People scroll past the barcode as decoration. |
| **Painting** (`glPage`) | Many readings of one canvas | A full hero, "Look for" (accent, easy to miss, focal) with names, Stands out / By area, a 3–20 size control, coverage, tap-to-sample, the guided look, "More like this, by…" | The Analysis tiles state percentiles in words. There's no "where this sits" in the painter's life, its decade or its movement. | Little. It's the strongest page. | "Too long below the palette; the guided look, the analysis and twins compete." |
| **Decade / movement / country** (`awGroup`) | The color of a time, a school or a place | Signature colors against the same museums, a hue mix with archive hairlines, decade columns, key painters, prev/next decade | The movement caveat is honest, but it's a `<details>` at the top. | The hero is varnish (the screenshot above). No paintings at all. There's no museum page. The hue-mix bars are abstract. | "Every decade looks the same: brown." That's the exact opposite of "see the world through color". |
| **Index** (`awIndex`) | Doors into art history by color | Color bubbles, movement and country tiles with mini palettes, painter search | The tiles are good doors. | The "timeline of hue" renders as 60 near-identical rainbow bars, because lift normalisation flattens every decade and the band colors are synthetic, not real paint. It carries zero information at a glance. | "Pride flag ×60." |
| **Museum / Explore** (`explore.js`) | The front door, a feed | Pinterest-style pins and covers | | It doesn't hand off to the wiki pages, and there's no page for a museum as a thing. | |
| **Browse** (`browse.js`, `browse-ui.js`) | Any color × time × place × movement, with counts | Facet chips with live counts, removable breadcrumbs, zero-result loosening, 4 views (Grid, River, Wall, Painters), saved rooms | It's built and strong, but you only reach it from the Art color door. | It isn't the engine under the painter, decade and movement pages, although it could be. | "Two archives that disagree on counts." |
| **Paintings of a color, chords** (`paintingsof.js`, `chords.js`) | A color's life in art | The sliders (how close, how much), the arrival pin on the painting, pair affinity | | Painter pages don't use the color filter ("Sargent × rose" is impossible). | |
| **Design history** (`data/design`, 10,577 objects across 10 categories by decade) | Colors with a job | The data exists. | | It's only reachable through color search. Decade pages never mention that posters, textiles and stamps exist for the same decade. | A wasted dataset. |

---

## 2. Giants: what we steal (and skip)

Every idea that's kept says what it **replaces** or **merges**.

**Art and information**
- **Google Arts & Culture, Art Palette.** Search by a palette and land in centuries of art ([story](https://artsandculture.google.com/story/cQWRLHCd3edAIg), [Core77](https://www.core77.com/posts/76088/Experimental-Google-Tool-Lets-You-Search-Art-by-Palette)). *Steal:* any palette on any page (painter, decade, photo) gets one tap: "Paintings in these colors". *Merges* into Browse's color facet; no new screen. *Skip:* the AR gimmicks (Pocket Gallery, Art Projector, per [Google's blog](https://blog.google/outreach-initiatives/arts-culture/at-home-bring-the-great-artists-to-you/)).
- **Artsy, the Art Genome.** Graded "genes" (0–100), not binary tags, drive related artists ([Wikipedia](https://en.wikipedia.org/wiki/The_Art_Genome_Project), [Smithsonian](https://www.smithsonianmag.com/science-nature/mapping-the-art-genome-105201397/)). *Steal:* our color genes are already graded (L, C, warmth, vivid share, the lift of each signature). Show "Paints like" *with the reason* ("both reach for rose with black, ×3"). *Replaces* "palette distance 0.42".
- **Cooper Hewitt.** Up to 5 extracted colors snapped to a fixed palette make the collection browsable by color ([Labs](https://labs.cooperhewitt.org/2013/giv-do/)). *Lesson:* snapping to 116 CSS names is the thin version. We snap to about 1,000 learnable names, and our pages should say so.
- **Wikipedia infobox and "What links here".** *Steal:* a compact fact row at the top, plus "Appears in" at the bottom (this painter's colors show up on 14 color pages and 3 pair pages). *Merges* into the existing Connections section.
- **Letterboxd and IMDb.** A filmography is a filterable, sortable grid with a ratings histogram ([film page features](https://docs.anysite.io/api-reference/letterboxd/letterboxdfilms.md)). *Steal:* a painter's works *are* a Browse set pre-filtered to that painter. Sort by date, lightness or hue; a histogram doubles as a filter. *Skip:* star ratings.
- **Our World in Data, Grapher.** One chart with a time slider, an entity picker that persists across pages, and a table view with change over a range ([redesign notes](https://ourworldindata.org/redesigning-our-interactive-data-visualizations), [Grapher](https://ourworldindata.org/owid-grapher)). *Steal:* a persistent "compare with" picker. Once you add Vermeer while comparing, he stays as the ghost line on the next pages too.
- **Rijksstudio and WikiArt.** Deep zoom and collections. We already have the hero and saved rooms. *Skip:* WikiArt's dated style-tag directory.
- **Pinterest.** Visual "more like this", a back trail. Already done (`twins.js`, XSTACK). Nothing new needed.

**Outside art (the systems worth transplanting)**
- **Instagram and Snapchat Stories → Spotify Wrapped.** Tap-through vertical cards where each delivers one surprise, built for sharing ([storysoft](https://storysoft.io/data-storytelling-spotify-wrapped/)). *Steal:* "Sargent in 7 cards". *Replaces* the findings list and the "You and this painter" line on the surface.
- **Apple Photos scrubber and Weather's hourly chart.** Drag along time and the main view updates live. Weather's "Highlights" card gives the one thing to know first ([iOS 27 Weather](https://www.idropnews.com/ios-27/ios-27-weather-app-new-features/265491/)). *Steal:* scrub the barcode and the hero painting changes under your thumb. *Replaces* the static barcode, the decade columns and the sparkline (three widgets become one).
- **Spotify "Fans also like" plus Apple and Google Maps.** A place you can pan, with a bottom sheet for the selected pin. *Steal:* a **painter map**: 837 dots on a lightness × chroma plane, each dot tinted by that painter's own mean hue, you pinned. *Replaces* the five percentile bars and the "Paints like" list.
- **Lightroom's before/after split.** Drag a divider across two images. *Steal:* compare anything (two painters, two decades, a decade and its movement) as one split card. *Replaces* the side-by-side column lists in `awVsBody`.
- **Strava segments and Apple Fitness.** Where you rank, as a dot on a line, not prose. *Steal:* the painting's "In context" card: three dot rows (in his work, in its decade, in its movement). *Replaces* the Analysis tiles' percentile sentences.
- **Tinder and Instagram swipe adjacency.** Horizontal swipe goes to the neighbor. *Steal:* swipe between painters of the same movement and between decades. *Replaces* the "‹ 1870s | 1890s ›" links.
- **Notion database views.** One dataset, many views (table, board, gallery), with the filter saved as a page. *Steal:* **every archive page is a saved filter on Browse with a header card**. This is the main structural idea.
- **Apple Wallet.** A stack of cards, one expanded. *Steal:* palette families as stacked cards; tap one to expand into its paintings. *Replaces* the list of clusters plus the "rooms" row (two widgets become one).
- **Wordle and BeReal.** Skip the daily social mechanics here; Today owns them.

---

## 3. The ideal page: one template for every "thing"

Painter, decade, movement, country and museum share one structure (a painting is the leaf):

1. **Highlight card (above the fold, about 70% of the screen).** One real picture: the *most typical painting*, full width. One sentence: the strongest gated finding, in plain words with n ("Lighter than 88% of painters here; reaches for rose against black 3× more than the same museums. 287 paintings, as photographed"). Then 3–5 **signature chips** (lifted against the same museums, near-blacks out), never the area browns. Each chip opens its color page in one tap.
2. **The scrubber.** For a painter, the barcode of his life. For a decade or movement, a river of its years. Drag it and the hero repaints with that painting or year.
3. **The works (the Browse engine).** A view switch (Wall sorted by hue, the default; Grid by date; River; and Painters on a group page). Facet chips with counts (color, decade, mood, museum) combine with the page's own filter, so "Sargent × rose × 1880s" is two taps.
4. **Depth, one tap each, collapsed:** Palettes (the Wallet stack), Colors (signature, roles, darks and lights, avoided, chords), Compared (painter map plus Compare), Ties (teachers, students, influence), Sources.
5. **Connections, one row:** "Learn this palette (you can name 9 of 14)", "Whose palette?", "Study on the map", "Paintings in these colors".

Per type:
- **Painter:** the above, plus "Story" (the 7 cards) as a pill on the hero.
- **Painting:** keep the order. Add the *In context* card after "Look for", and make the painter link a swipe target.
- **Decade:** the hero is the most typical painting of the decade. Under the works, a toggle reads **"Paintings · Design"** (the same decade's posters, textiles and stamps from `data/design`). Swipe for prev/next.
- **Movement:** the honesty note shrinks to one line in the hero's n ("412 paintings; 61% tagged by museums"). Key painters show as the Painters view.
- **Country:** the same, with the nationality caveat in the n line.
- **Museum (new, for free):** a saved filter `museum=X`. Its finding is honest and unique: "This museum's photographs run warmer than the others'", which is exactly the varnish and camera bias explained, not hidden.

---

## 4. Top 10, ranked by impact over effort

**1. The highlight card replaces the varnish hero. S, about 3 h. Mockup: yes (with #2).** On `awPainter` and `awGroup`, delete the area palette strip and the 8 name rows at the top of the group pages. Delete the "Colors in most of the work" lead on painters, or move it into Colors. Render the typical painting (`P.typical`; for groups, the painting nearest the group centroid), the single best gated finding, and the signature chips. *Replaces:* the area hero, the varnish caption and the findings `<ul>` (it keeps one finding; the rest move to Story). *Files:* `js/artwiki.js` (`awPainter`, `awGroup`, `awPainterFindings`), `tools/` for typical-per-group if it's missing. *Phone test:* at 440x956 the first screen of `#/decade/1880` shows a real painting and colored signature chips. No hex code and no color with L* under 20 appears above the fold. One tap on a chip opens its color page.

**2. Every archive page is a saved Browse filter. M–L, about 1.5 days. Mockup: yes.** Under the highlight card, mount Browse's body with a locked base filter (`painter`, `decade`, `movement`, `country` or `museum`) plus user facets. Add `xbMount(host, baseFilter)` to `browse-ui.js`. The page's own section headers become the depth drawers. *Replaces:* the group decade columns, "Key painters", "Everything painted in…" and the separate Painters view entry. *Adds:* museum pages (`#/museum/<id>`, one ROUTED line). *Files:* `js/browse-ui.js`, `js/browse.js` (`xbRun` with a base filter), `js/artwiki.js`, `js/router.js`. *Phone test:* on `#/painter/john-singer-sargent`, tap Color → rose and the count updates live ("23 of 287"). Wall and Grid both work. Back unwinds the filter, then leaves the page. The counts match the painter's n.

**3. The barcode scrubber. M, about 5 h. Mockup: yes.** Drag across the barcode and a floating card shows that painting's thumbnail, title and year. Release opens it. On a group page the same control scrubs years. *Replaces:* the "Over time" decade columns and the sparkline (the change-point sentence moves under the scrubber as its caption). *Files:* `js/artwiki.js` (barcode block, `awTimeSection`). *Phone test:* a thumb drag over 287 slivers changes the preview at least every 2 px with no jank. The haptic ticks at decade boundaries. The year axis shows trusted years only (`awYearOk`).

**4. Story: "Sargent in 7 cards". M, about 6 h. Mockup: yes.** A full-screen tap-through, auto-built from the existing data: (1) the typical painting with its one sentence; (2) palette families as the Wallet stack; (3) the top signature, shown as ×lift, with the painting that uses it most; (4) how the palette changed, with the before and after paintings side by side; (5) the least typical painting ("the odd one out"); (6) paints like, with the shared colors; (7) "You can name 9 of 14 · Learn them" and "Whose palette?". The surprise of each card comes from measurement, with n on every card. *Replaces:* the findings list and the "You and this painter" line on the surface. *Files:* a new `js/story.js` (about 200 lines, one global prefix) and `js/artwiki.js` (a hero pill). *Phone test:* tap right and left to step, swipe down to close and return to the same scroll spot. The cards are full screen at 440x956 with no black bars.

**5. The painter map. M, about 5 h. Mockup: yes.** 837 dots, x = lightness, y = chroma, each dot tinted by that painter's own mean hue (the genes we already have). The current painter is pinned and his nearest five are ringed. A tap shows a bottom-sheet peek, a second tap opens the painter; a "Story" link opens the cards. It reuses Study-the-map's pan and zoom where it can. *Replaces:* the five percentile bars, the "Paints like" list and the index's painter list (the index keeps search). *Files:* a new section in `js/artwiki.js`, borrowing from `js/mapstudy.js`. *Phone test:* pinch-zoom works, the dots never sit under a control, and Sargent's five neighbors match `A.nearest`.

**6. Compare anything, as a split card. M, about 5 h. Mockup: yes.** Generalize `awVs` to any two things: painter, decade, movement, or a painting against its painter. The top is a Lightroom split (two typical paintings, drag the divider). Below it, the signature chips face each other, with "Both reach for" in the middle. A persistent compare chip (as in OWID) keeps the second item while you browse. *Replaces:* the column lists in `awVsBody` and the decade prev/next links. *Files:* `js/artwiki.js`, `js/router.js` (`#/vs/<kind>:<a>/<kind>:<b>`). *Phone test:* the 1660s against the 1880s shows two big paintings, not two small strips, and the divider drags smoothly.

**7. The index becomes three doors and the River. S, about 3 h. Mockup: no (the River exists).** Delete the rainbow lift timeline. Put Browse's River (real colors, scrubbable) in its place, followed by the movement tiles, the painter map and search. Add a "Surprise me" die that opens a random painter's Story. *Replaces:* `aw-timeline` rows and the band legend. *Files:* `js/artwiki.js` (`awIndex`), `js/browse-ui.js` (`xbRiver` mountable). *Phone test:* two adjacent centuries look visibly different at a glance, and a tap on a decade in the River opens that decade's page.

**8. The painting's "In context" card. S, about 2 h. Mockup: no.** Three Strava-style dot rows (lightness, chroma, warmth), each showing this painting's dot inside the spread of its painter's works, its decade and its movement. Tap a row for the comparison set in Browse. *Replaces:* the percentile prose in the Analysis tiles. *Files:* `js/artwiki.js` (`awAnalysis`). *Phone test:* the dots line up with the tile numbers, the n shows on each row, and a row is hidden when n is under 10.

**9. A decade's paintings and design together. S–M, about 4 h. Mockup: light.** A segmented toggle on decade pages, "Paintings · Design" (posters, textiles, stamps and more from `data/design`), with the same highlight-card logic and one cross-finding ("1920s posters are 3× more vivid than its paintings, n=…"). *Replaces:* nothing on the surface; it's a toggle, not a section. *Files:* `js/artwiki.js`, `js/colorindex.js` loaders. *Phone test:* the 1920s Design view shows real objects with their colors, and the counts appear.

**10. Swipe to the neighbor. S, about 2 h. Mockup: no.** A horizontal swipe on a painter page moves to the next painter in the same movement (by size). On a decade page it moves to the next decade. A peek shadow shows the neighbor's name. *Replaces:* the prev/next links. *Files:* `js/artwiki.js` (`awWire`). *Phone test:* the swipe doesn't fight vertical scrolling or the barcode scrubber (scrubbing only starts on the barcode itself), and Back returns to the previous neighbor.

**Kept but not in the top 10.** "The year this color arrived" belongs on color pages, not here: the first decade in which a color covers 1% or more in at least 1% of the paintings. Not built: the movement family tree (Wikidata's influence coverage is 96 of 837, which is too sparse to be honest).

**What leaves, in total.** The area-palette hero, the 8 hex rows, the findings `<ul>`, the decade columns, the sparkline, five percentile bars, "Paints like" text, the clusters list plus the rooms row (it becomes the stack), the rainbow timeline, the prev/next links, and the `awVs` column lists. Painter pages lose about 40% of their first-scroll length, and every archive page gains paintings.

---

## 5. The David critic (DAVID-MODEL §4) on this plan

| # | Question | Verdict |
|---|---|---|
| 1 | One tap opens any color, name or painting? | Pass: the chips, scrubber previews, map dots (on the second tap, after the peek) and story cards all open directly. Risk: the map's peek sheet is an in-between step. Allowed only because a dot is too small to read without it; flag it in the mockup. |
| 2 | Full screen at 440x956, no bars or covered buttons? | Story and split compare must be edge to edge. The scrubber must sit clear of the corner hexagon button. Check this in the mockups. |
| 3 | Expensive next to Duolingo or Apple? | The highlight card with real paintings is the upgrade. Today's hex-row heroes fail. |
| 4 | Comparison big and side by side? | #6 fixes `awVs` (two big paintings with a divider). #8 shows dots, not sentences. |
| 5 | Deletable text? | Yes, a lot: the varnish caption, the caveat paragraphs (now one n line), the method notes (moved to Sources). |
| 6 | Related things together? | Palettes and their paintings merge (the stack). Time widgets merge (the scrubber). Filters live with their results (#2). |
| 7 | One palette where it could be ten? | Pass: families, signatures, roles, change over time, typical and atypical, design versus painting. |
| 8 | Connected to the map, color pages, learning and painters? | The painter map, "Learn this palette" with coverage, "Whose palette?", and color pages via the chips and "Paintings in these colors". |
| 9 | Back to exactly where I came from? | #2 must unwind filters before leaving. Story closes to the same scroll spot. Add this to the smoke tests. |
| 10 | Could a fixed choice be a slider, live? | The scrubber (time) and the split divider. The Browse color filter keeps its how-close and how-much sliders. |
| 11 | Starts at my level, teaches by showing? | Story is the beginner path. The drawers and the map are the expert path. "Whose palette?" tests after showing. |
| 12 | Almost good or actually good; what breaks first? | What breaks first: (a) the scrubber against horizontal swipe (#3 against #10), solved by limiting the scrub to the barcode's hit area; (b) Browse counts disagreeing with the wiki's n (they use two indexes), so #2 must use one source of truth; (c) small painters (n under 10) get an empty Story, so they show three cards at most, with a "sketch, not a finding" line. What we lose: the hue-mix bars against the archive hairlines. They survive inside the Colors drawer. |

**Build order:** #1 → #7 → #8 (quick wins, about 1 day), then mock up #2–#6 together as one page system for David to approve before building.
