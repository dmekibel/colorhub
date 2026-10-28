# Painting map: stay on your painting, presets, kindred painters, a painter map

Planned 2026-10-24 (Opus) from David's request. Build lanes run on Sonnet. Read CLAUDE.md, design/DESIGN-CANON.md §5
and design/DAVID-MODEL.md before any UI work. Screenshot 440x956, 375x812, 1440x900.

David's words: "If I adjust things in the settings, like the time ... the painting that I'm on would stay in the middle.
Or if I change the settings so it's rearranged by average color versus main color ... same thing. There should be
pre-built filters ... everything by this painter, painters from the same country, from the same era ... it should be
convenient to explore painters that are similar in place and time. Maybe we could even make a painter map."

## What exists today (verified in code)
- js/paintmap.js: every settings change calls `rebuild()` -> `build(false)`, 25 call sites. For unseeded
  arrangements (color, time, painter, families, tones, subject) build() restores `PM_PAN.get(lay.key)` or the
  layout's start. **The painting you were on is lost.** Only `PM_NEEDS_SEED` (rings, spiral) keep it.
- The card already has filter-by-example chips (`pmFacetsOf`: Same painter / Same decade / Same place) plus
  Open, Around this, Walk from here. Decade for years before 1500 is a century.
- Painter data: data/artists/meta.json (3,806 painters: n, co, y0-y1 active span, L, C, warm fraction, birth/death
  for ~1,790, nationality, Wikidata id, portrait file for ~1,500), data/analysis/artists/<slug>.json (signature and
  avoided colors, byDecade, typical/atypical paintings, `nearest` painters by palette), teacher (663) and
  influencedBy (157) links in the Wikidata pass. artwiki.js already shows `nearest` on the painter page.
- Known data problem: raw museum artist strings survive as painter names, e.g.
  "Artist: John Henry Niemeyer (American, born Germany, 1839–1932, M.A. (Hon.) 1874)". They split one painter into
  two and would show up on any painter map.

## Phase A — the painting you're on stays put (bug fix, lane 1)
Rule: **a settings change never moves you away from the painting you are looking at.**
- Focus = the painting whose card is open, else the painting at screen center (centerK). Keep its gallery index
  `focusI` across `rebuild()`.
- After any rebuild (Arrange, Place by, year range, filters, chips, presets, collection-preserving changes):
  1. focusI still in the new list -> center on it at the current zoom (clamped to the new layout's limits), card
     stays as it was (open stays open), a short pulse so it reads as "still here".
  2. focusI filtered out -> center on the painting in the new list closest to it in color (OKLab of the mean,
     tie-break by year distance), card closed, one quiet line in the chip bar: "Your painting is outside
     1750–1850 · Bring it back" (Bring it back widens just enough to include it, one step).
  3. No focus (plain browse, nothing centered) -> keep the painting nearest to the old center the same way, so
     the view never teleports to the layout start.
- PM_PAN keeps its job for Back (restore the exact prior view); seeded arrangements keep their own rule.
- Zoom: keep the current zoom unless the new layout is smaller than the screen at that zoom (then fit).
- Smoke: one scenario per change class (year range, Arrange switch color->time->color, Place by, a filter chip,
  a preset): the centered painting key before == after; plus the filtered-out case lands on a near-color painting
  and shows "Bring it back".

## Phase B — presets under a painting (lane 1, same file, after A)
The card keeps a calm row: **three chips + "More"**. Chips carry live counts ("Same era here · 412").
- Default three, picked by what applies: **Same painter** · **Same era here** (same country, ±25 years) ·
  **Same era** (±50 years). With an estimated year the era chips widen to the estimate's range and say
  "Around the same era".
- "More" opens a small sheet of toggles that combine (AND), each with a live count, applied live:
  Same country · Same movement · Same museum · Same decade · Within [10 · 25 · 50 · 100] years · The painter's whole
  career (one-painter map) · Teacher, students, influences (only when links exist) · Close palette (nearest in color).
- The active scope shows as the removable top chip that already exists; a second tap on a chip removes it.
- Presets go through Phase A's focus rule, so the painting stays in the middle while the map narrows around it.
- Smoke: each preset narrows the count, keeps the focus, and is removable.

## Phase C — painters around a painter (lane 2: data + painter page)
C0. **Painter name cleanup first.** tools/clean_artist_names.py: strip museum boilerplate ("Artist:", "(American,
  born Germany, 1839–1932, ...)", "attributed to", "workshop of" kept as a role, not part of the name), fold to the
  Wikidata label when the Q-id matches, write data/artists/aliases.json entries (gallery.py already folds aliases).
  Report the merges; never merge two different people who share a name (check life dates).
C1. tools/painter_kin.py -> data/analysis/painter-kin.json: per painter the top 12 kindred painters, scored by
  overlap of active years, same country or neighboring region, palette distance (existing `nearest` d), and
  teacher / student / influence links; each pair keeps its reasons.
C2. Painter page: a row "Painters around them" (portrait or typical painting, name, years) with one plain reason
  each: "Same decades in Paris", "Close palette", "Her teacher". Tap opens that painter. A button "See them
  together on the map" scopes the painting map to this painter plus the kin.
C3. Painting card "More" gets "Painters like this" (the same list, from the painting's painter).

## Phase D — the painter map (design first: Opus mockups, David approves, then Sonnet builds)
One cell per painter, on the same map engine as paintings, photographs and design (a new "painters" collection).
- Who: painters with at least 5 works (search still finds everyone).
- Cell face (recommendation): the painter's most typical painting (analysis `typical`) with a thin band of their
  signature colors along the bottom. Every painter has one, it is color-true, and it reads at small sizes.
  Portraits stay on the painter page (only ~1,500 painters have one).
- Arrange by: **Palette** (painters with similar palettes sit together, a 2D layout of mean color + signature),
  **Time** (left to right by active years, rows by palette), **Place** (a rough map of countries, Europe given
  room), **Movement** (clusters), **Lineage** (teacher -> student trees where the links exist).
- Tap a painter: card with name, years, country, signature colors, count; chips "Their paintings", "Painters
  around them", "Open page".
- Entry points: painter page ("See on the painter map"), the Museum room, the painting card's More.
- Built from data already on disk: tier-1 atlas cells of each painter's typical painting can be copied into a
  painters atlas locally (no refetch). Respect the memory budget the painting map now has (tools/smoke paintmap
  memory scenario).
- Mockups first: the cell at 3 sizes, the five arrangements on a phone, the card. David approves before building.

## Phase E — time views you can read (lane 1, after B; design pass first)
David: "Van Gogh shows me them by decade. But the name of the decade is super tiny on the top left ... scrolling
through it sometimes you don't see which decade it is ... organize not just by decade, but other ways. And not just
in a row downwards, but to the right or other ways."
- **Always know when you are.** A large, legible era label pinned at the top while you pan (like the year headers in
  iOS Photos), updating as you cross a band, plus a thin time rail on the right edge with decade ticks you can drag
  (a haptic tick per decade, the label grows while dragging). Text at least body size (CLAUDE.md legibility rule).
- **Pre-built time views** (one Arrange "Time" entry, a small view picker inside it):
  1. Decades down (today's rows, with the new label and rail).
  2. Timeline across: one horizontal river, x = year, paintings stacked by color; pinch from centuries to single
     years. Reads like a scroll of history.
  3. Life chapters (one-painter map): bands named by the painter's own periods where the data has a change point
     (analysis `changePoint`), else by decade: "Dark Dutch years 1880–85", "Paris 1886–88". Names only from real
     data, never invented.
  4. Color over time: each year a column of its paintings' main colors, so the palette visibly shifts (the
     painter's barcode, data already in analysis `barcode`); tap a column to open that year.
  5. By age: x = the painter's age when painting (needs birth year; only when known), so two painters can be
     compared at 25 vs 25.
  6. Then and now: two eras side by side with synced zoom (e.g. Monet 1870s vs 1900s).
- Estimated years sit in their band but drawn slightly apart under a quiet "estimated" caption, so time views stay
  honest.

## Phase F — a real article for every painter (lane 3: writing, reuses the color article engine)
What exists: 3,806 painter pages (js/artwiki.js) with deep color statistics (signature and avoided colors, river of
color, palette over time, against the whole archive, darks and lights, findings). A bio slot is already wired
(`data/artists/bios/<slug>.json`, rendered as lead + paragraphs + sources) but **no bios exist yet**. Color pages
have 1,909 articles built by an engine (data/articles/SCHEMA.md, tools/article_gate.py, article_lint.py). There are
no crawlable static painter pages (tools/pages.py makes c/, p/, art/ only).

Plan:
- **Tiered, honest writing.**
  - Tier 1, the ~300 most important painters (by works held + Wikipedia sitelinks): a full article. Life in a few
    paragraphs, how color worked in their painting (written FROM our measured findings, each claim linked to the
    paintings that show it), what changed over their life, who they learned from and who they shaped (kin data),
    where to see the work. Original prose from sourced facts (Wikidata, museum records, Wikipedia as a fact source,
    never copied text; Wikipedia prose is CC BY-SA). Sources listed.
  - Tier 2, everyone else with 5+ works: a short lead built from facts (years, places, movement, teacher) plus a
    color story generated from the statistics by template ("Her palette is lighter than 80% of Danish painters of
    the 1890s; she used rose far more than her peers"). No invented biography.
  - Tier 3, painters with too few works: facts only, and a plain line that the archive holds few works.
- **Same gates as color articles:** schema, lint, the color-myths list in CLAUDE.md, the book rule, a fact check
  pass (a second agent verifies every date and claim against the source before publish).
- **Page structure like a color page:** title, years and places, portrait, lead, a calm summary of the color story
  first; then the article, painters around them (Phase C), their map, the statistics layers one tap deeper.
- **Crawlable painter pages:** tools/pages.py gains `painter/<slug>/` static copies (title, description, Open
  Graph image from their typical painting + signature colors, the lead text), added to sitemap.xml. Every painter
  becomes a search landing page, which matters for growth.
- **Cost control:** Tier 1 written by Sonnet in batches of ~25 painters, fact-checked by a cheaper pass; Tier 2 and
  3 are templates (no model cost). Start with 25 painters, David reviews 3, then scale.

## Phase G — search that understands you (lane 4)
David: "writing paris 1880s should be enough ... it should account for misspelling ... or writing russia and paris
1800s should work."
What exists (js/paintmap.js pmqParse/pmqYears, map search only): years in many forms (1888, 1880s, 1860-80, 19th
century, late 1800s), countries + demonyms ("Russian"), regions, several countries joined (OR), movements and eras,
subjects ("boats", "portraits"), and painters from the leftover words. So "russia 1880s" works today. What fails:
- **Cities:** "paris" finds nothing: the corpus has countries, not cities.
- **Misspellings:** every match is exact ("rembrant", "monnet", "rusia" fail).
- **One search only:** this parser lives in the painting map; the app's other searches don't share it.

Plan:
1. **One query grammar for the whole app**, moved into its own file (js/query.js): the painting map, the global
   search (js/search.js), the color map and painter pages all use it. Same words, same result everywhere.
2. **Typo-tolerant matching:** every word that matches nothing exactly is matched against the whole vocabulary
   (countries, demonyms, regions, cities, movements, eras, subjects, painters and their aliases, museums, color
   names) with accent folding, doubled letters and an edit distance of 1 for short words, 2 for long ones.
   The suggestion row says "Showing Rembrandt" and keeps the typed word one tap away. Painters by last name alone.
3. **Cities, honestly:** a place layer from Wikidata: where each painter worked or lived (work location P937,
   residence P551) and, where known, where a painting was made (P1071) or what place it shows (depicts P180).
   "Paris" then means "painted in Paris, by painters working in Paris, or showing Paris", and the row says which.
   With no city data for a painting, never guess; offer the country ("No city data here · all of France").
   Data fetch belongs to lane 2 (data), the matching to this lane.
4. **Natural grammar:** places joined by and / or / commas are alternatives ("russia and paris" = Russia or Paris);
   different kinds narrow each other ("... 1800s" = and in the 1800s). "not" / "without" excludes ("france not
   impressionism"). Colors work too: "blue paris 1880s" adds a hue filter.
5. **Show the reading before you commit:** each suggestion is a row with its live count and three thumbnails, e.g.
   "Paris or Russia · 1800–1899 · 6,214 paintings". Ambiguous words get two rows (Georgia the country, Georgia
   the US state).
6. **Mobile:** big field, recent searches, a few example chips on first open ("Paris 1880s", "Russian winters",
   "Venice in gold"). **Desktop:** ⌘K or / opens search anywhere, arrows pick, Enter opens.
7. **Era words people actually use** (today's list is Renaissance, Baroque, Rococo, Romantic, Neoclassical ...):
   add middle ages / medieval, ancient / antiquity / classical, early christian, byzantine, gothic, early and high
   renaissance, golden age (Dutch), victorian, belle époque, fin de siècle, edo, ming, mughal, modern, "old masters".
   Each maps to a year range and, where it is a place-bound era, to its region (Dutch golden age = Netherlands
   1588-1720; Edo = Japan 1603-1868). "Europe middle ages" = European countries, 500-1500. "Ancient art" = before 500.
8. **Color words are generous families, not one hex** (David: "pink should cover a wide range like stuff a bit
   closer to red or purple but still could be part of pink"). A color word matches a band of hue, lightness and
   chroma built from all the library names in that family (pink = rose, salmon pink, blush, hot pink, magenta-ish
   pinks, dusty rose ...), with soft edges, so near-red and near-purple pinks count. Paintings rank by how much and
   how close (an exact speck beats a big off-color area, the closeness-beats-coverage rule), never one average.
   One shared hue vocabulary with the naming code (hueZoneWord). Modifiers work: "pale pink", "deep blue",
   "muted green", "gold", "black and gold".
9. **A test table:** tools/search_test.js with 60+ queries and their expected reading, run by the gates before every
   push. It includes David's own examples: "paris 1880s", "russia and paris 1800s", "europe middle ages",
   "ancient art", "france pink", plus typos ("rembrant", "monnet", "rusia", "impresionism"), "dutch golden age
   interiors", "venice gold", "night scenes 1890s scandinavia", "portraits by women 1700s", "blue and orange".

## Phase H — from a color to its place on the painting map (lane 1, with A's focus model)
David: "pick a color in the named colors and then when u press paintings it shows u the area of the painting map
with the same color."
What exists: a color page's "Paintings" door opens a separate list/grid page (`paintingsOfPage([hex])`), and the
browse color dial has "Find paintings in this color" (a filter). Neither takes you to WHERE that color lives on the
painting map.
Plan (a color becomes a focus, like a painting):
- The color page's Paintings door opens the **painting map, arranged By color, flown to that color's neighborhood**:
  centered on the painting whose placement color is closest to the named color, at a zoom where you see the
  neighborhood (a few hundred paintings), with a short pulse.
- **Only matching paintings stay on the map** (David, 2026-10-24: "i want only the ones that exist to be visible cuz some
  paintings glowing out of 200k would not be visible"). The color works as a filter: the map re-lays out with just
  the paintings that hold this color (closeness beats coverage), arranged By color, centered on the closest one. No
  glow-and-dim anywhere. A removable top chip says "Salmon pink · 2,340 paintings"; ✕ brings everything back and
  keeps you on the same painting (Phase A).
- Under the chip, one tap switches between **Where it lives** (the map) and **As a list** (today's page, ranked by
  closeness). The choice is remembered.
- Works from everywhere a color appears: color pages, a palette chip on a painting page (long-press: "Find this color
  on the map"), the color map (a color's card: "Paintings in this color"), the camera's picked color, and search
  ("salmon pink", "france pink" from Phase G, using the generous color families).
- Changing Place by (main color vs average) re-centers on the same color (Phase A's rule, color focus).
- Desktop: the same, with the list in the side panel next to the map. Mobile: the switch sits in thumb reach.

**Search by palette, with a closeness setting** (David: "search painting map by color or by palette so u can see
art that are mathematically closest to this palette with settings for how close it has to be"):
- Start from any palette: a painting's palette, a saved palette, the palette archive, a photo or the camera, or 1-6
  colors picked by hand (the browse color dial already picks one color; extend it to a palette tray).
- Two match modes, named plainly:
  - **Holds every color** (the default for 2-3 colors): the painting must contain each color within the closeness
    setting. This is the existing rule for set matches (memory: pair/trio paintings must hold every color; widen
    only through visible sliders).
  - **Same overall palette**: the closest whole palettes, measured as the cost of turning one palette into the other
    in OKLab, weighted by how much of the canvas each color covers (an earth mover's distance over the six colors
    and their shares). Best for 4-6 colors and "find paintings like this one".
- **Closeness slider** from "exact" to "loose", with the live count updating as you drag ("312 paintings within this
  closeness"), plus optional "ignore how much, only whether" for accents.
- Results become the map: only the matching paintings are shown (no glow-and-dim), and they rank in the list, each with its match
  explained: the painting's own palette in equal swatches next to yours (memory rule), and a match score in words
  ("very close", "close", "related").
- Reuse what exists before writing new math: the set-match code (js/colorset.js / js/match.js / js/twins.js) and the
  pool palettes in the gallery detail shards. Precompute nothing new unless the speed test on a phone fails
  (206k paintings x 6 colors is ~1.2M comparisons per query, fine in a worker; tune before indexing).
- Every painting page gets "Find paintings with this palette", which opens this with the closeness set to "close".

## Phase I — an unnamed color shows all its near names (lane 4, js/richpage.js)
David: "the article should also contain all the runner-ups for the closest colors that have names. And what would the
name of this color be if it was labeled under that color, like ... this is either dark red or muddy cerulean."
What exists: an in-between color's page uses the nearest name, a descriptive title from it (rpYoursName: "Deep dusty
pink orchid") and one sentence (rpYoursLine: "Yours is greener and a bit lighter than teal · 96% match").
Add one calm section right under the cover (David: "close to the beginning, just in case you ... chose the wrong article"), "It could also be called": the next 4-6 nearest names (from all ~1,000 learnable
names plus the archive, never "the 101"), each as its own descriptive name built the same way ("Dusky cerulean",
"Deep brick red"), with its match % and swatch side by side with yours (equal swatches). Only names within a sensible
distance (dE2000 <= 12, like rpYoursName); one tap opens that name's page with your exact color shown. Sorted by
closeness; the first line restates the winner so the reader sees why it won.
Also verify the winner is truly the closest name: a test over sample colors that the page opened from a tapped color
is the minimum-dE2000 name across all learnable + archive names (same distance as the list below it), never a
different pick from another code path.

## v2: how this plan gets better (self-review, mobile + desktop)

### The big upgrade: one "focus" for the whole app
Phase A fixes focus inside one map. Go further: **the thing you are looking at is the app's focus, and every view is
a lens on it.** A painting, a painter or a color stays the focus when you switch maps (painting map -> painter map
-> color map), arrangements, time views or rooms. Switching is "look at this differently", never "start over".
- One shared `FOCUS` (kind + id) in core, written by every map and page, read on every mount.
- The painter map opens centered on the focused painting's painter; the color map on its main color; the painting
  map on the painting. Back still restores exact prior views (trail).
- Implementation: Phase A lives in ONE choke point (build() captures focus before, restores after), not 25 call sites.

### One filter grammar everywhere
Presets, card chips, the Filter sheet, search suggestions and share links all produce the same filter spec. So every
preset is shareable as a link (routes already encode the spec), counts are computed one way, and a new filter
appears in all places at once.

### Reuse, so each piece pays three times
- The time axis (label, rail, bands) is one component: painting map time views, the painter page palette river,
  and the color map's history overlay.
- Painter kinship (Phase C) feeds the painter map layout (kin sit together), the card's "Painters like this", and
  the games (fair but hard distractors from kin painters).
- Estimates honesty (est.json) flows into every time view, statistic and game, never shown as exact.

### Mobile specifics
- Thumb reach: presets and the time-view picker live at the bottom; the era label sits at the top but small enough
  to never cover the art (a translucent pill that grows while you scroll fast, shrinks at rest).
- The time rail on the RIGHT edge, starting well inside the edge (left edge is iOS Back; the bottom is Home).
- Long-press a painting = the quick preset menu (one gesture, discoverable through a one-time hint). Avoid new
  multi-finger gestures: discoverability beats cleverness.
- Haptics: iOS Safari has no vibration API, so the decade "tick" is visual (label pop + rail notch) on the web and
  real haptics only in the App Store wrapper. Say so in the spec.
- Memory budget for every map on real devices (iOS Simulator + David's phone), including older iPhones (4-6 GB).
- Bottom sheets with two heights (peek / full) for More presets, so the map stays visible.

### Desktop specifics
- Hover a cell: it lifts and shows name, painter, year (no click needed); click opens, as today.
- Keyboard: arrows walk to neighboring paintings, [ and ] shrink/grow the time window, 1-6 switch time views,
  / search, F filters, Esc back. A "?" sheet lists keys.
- Presets and the time-view picker live in the docked side panel (the Arrange panel pattern), map stays full size.
- The time rail becomes a full-width labeled timeline along the bottom; trackpad pinch zooms time horizontally.
- Shift-drag lasso selects an area: a stats panel (counts, decades, countries, palette) slides in on the right.
- Compare views (two paintings, two painters, two eras) use the width side by side.

### Process upgrades
- **Mockups for every UI phase, not only the painter map:** a quick static mockup at 440x956 and 1440x900 for B
  (presets), E (time label, rail, views) and C2 (painters row) before building. David approves in one look.
- **Labs flag:** new views ship behind `#lab` first, so David tries them on his phone before they become default.
- **Know what people use:** a cookie-free, privacy-friendly counter (e.g. Cloudflare Web Analytics, free) before
  building more screens. Outward-facing: needs David's yes.
- **Test like a phone:** real taps in the iOS Simulator for gestures and memory, not only headless Chrome.
- **Ship small:** each phase is its own push with its own smoke scenarios; no phase waits on a data rebuild unless it
  needs one (only lane 2 does).
- **Build what makes great videos first:** time views (a painter's colors changing over a life), color paths and
  Read this painting are the most filmable; schedule them with the cutroom launch.
- **Credits:** Sonnet builds; Opus only for mockups, plan review and the craft critique.

### Risks to watch
- Re-layout cost on 206k paintings when every chip tap rebuilds: keep it under ~150 ms on a phone or debounce.
- Phase A for arrangements where position means something else (By museum, Families): focus still wins.
- The painter map's quality depends on clean names (C0) and on painters with few works: show only painters with 5+
  works and say so.

## Order and lanes
1. Lane 1 (Sonnet): Phase A, then B. Files: js/paintmap.js, css, tools/smoke/scenarios.js.
2. Lane 2 (Sonnet, in parallel): Phase C0 then C1-C3. Files: tools/, data/artists, data/analysis, js/artwiki.js.
   Only lane 2 touches data/. Data changes need a gallery rebuild (tools/rebuild_all.sh) before shipping.
3. Phase D: Opus mockups now, build after David approves and after C0 (clean names) lands.
Every lane: craft critique before merge, gates + smoke, screenshots, short report.
