# Ideas 10×: Explore, Art, the art wiki, World and the archives (2026-10-08)

Area: Explore (`js/explore.js` covers, the Art feed, Ideas, World, `css/explore-covers.css`), the art wiki (L11, ROADMAP §21, `research/ANALYSIS.md`), the 23,531-painting gallery (`js/gallery.js`), poems (`js/poems.js`), fashion, gems and botany (`js/world.js`, `js/gems.js`, `js/botany.js`), films (`data/films.js`, NOTES-TRACKER film archive), design history (L19) and aesthetics-as-palettes.

This builds on GENIUS-PANEL-1 and does not repeat it. Already proposed there, and assumed here: Learn this painting, the guided look (focal, hidden, glue), You and this painter, Whose palette?, the painting of the day, search returns a constellation, your photo's twin painting, Word vs paint, Masters' chords, Repaint with your words, the two lenses (as photographed / within the painting) and alias merging.

Everything below was checked against the real data on 2026-10-08. The numbers come from scripts run over `data/analysis/` and `data/gallery/`.

---

## 1. Diagnosis (blunt)

**The archive is huge, and Explore shows almost none of it.**
- **No code reads `data/analysis/`.** That's 15 MB of findings, clusters, signatures, decades and nearest paintings, built and shipped, and `grep "analysis/" js/` returns nothing. Painters have no pages. On a painting page the artist's name is plain text. The 837 painter files are unreachable.
- **You can't find a painter.** The search sheet only matches graph node titles: the 22 hand-built "Featured" paintings, the colors and the wiki pages. Typing "Vermeer" or "Sargent" finds nothing, though they're in the gallery. The gallery query (`glRun`) filters by color, era, museum, lightness and chroma, but never by artist. Artist names only exist in the detail shards.
- **Two painting pages.** `paintingPage()` serves the 22 Featured nodes (with stories) and `glPage()` serves the 23,531. They look different, and the Featured rail is a separate shelf from the archive it belongs to.

**The For you cover isn't for you.**
- `dailyColor()` picks from `ALL` (the 101). The For you feed is a daily shuffle of those same colors, with a painting, story or page every third pin.
- So it isn't personal, and it treats the 101 as the special list (rule X19).
- Art's color picker is also `[...BASICS, ...ALL]`: about 100 unlabeled bubbles in a sideways scroll.

**Stale and wrong copy.**
- The Art cover and Art header say "Fourteen thousand paintings and eleven thousand poems". The real counts are 23,531 and 11,440.
- The Harmony lens labels CIELAB +180° pairs "Opposites… across the wheel" without saying which wheel. That brushes against the myth "every color has one true complement".
- `CONN_LENSES` labels the look-alike lens "Looks", which will collide with the Looks archive.

**The findings layer would embarrass us if shown today.**
- **58% of paintings** (13,545 of 23,531) carry "Only 0% of this canvas is truly vivid." That's a rounding bug, and it's trivially true of a varnished archive anyway.
- **Hundreds of "glow" findings pair a color with itself:** "Ink and Ink sit at nearly the same lightness" (432×), "Smoky Black and Smoky Black" (398×).
- **Harmony fit says "analogous" for 80%** (18,804). It tells you nothing.
- **Pigment hints fire on 1 painting of 23,531.**
- **Painter signatures are the varnish.** For most of the 837 painters, signature #1 is a near-black or brown: Near black 37, Black 36, Dark olive brown 36, Dark Jungle Green 30…
- **Pair "favorites" rest on 3 paintings.**
- **Barcodes repeat names** ("Dark walnut, Dark walnut").

**Thin samples, and the UI must say so.**
- The corpus is capped at 50 paintings per painter.
- The median painter has 10 paintings here. Only 81 have 30 or more, and none has 100.
- Clusters exist for 338 painters.
- Movements are AIC-only: 8 of them, and 6 have fewer than 150 paintings.
- "Country" is mostly the painter's nationality.
- An honest art wiki has full depth for roughly 150 painters and a data card for the rest.

**Ideas is a junk drawer.**
- It holds stories, color systems (repeated under Symbols), ideas and people, passages, films, and a second copy of the History lens labeled "Through history ·".
- There's no shape and no reason to come back.

**World is three brochures.**
- Fashion (13 decades, 27 Colors of the Year, 15 houses, 10 history pages), Gems (29) and Botany sit side by side with no link to the paintings, to each other or to you.
- Films: 32 entries, 0 with images, "colors discussed" chosen by us. Nothing to see.
- The Looks archive (69 looks, 155 hand-picked palettes) is built but unmerged in a worktree.

**Controls break the design system.**
- The Explore cover's search button uses `backdrop-filter: blur`. That's glass, which David rejected (X10).

---

## 2. North star

Explore becomes **the reading room of the world's color**: a museum where every collection has the same honest grammar. Whether it's a painter, a decade, a museum, a poem, a flower, a gem, a film, a look or a design object, you get:
- what it is;
- its colors measured several ways;
- what's surprising about them, in one plain sentence with its sample size;
- how it compares with its neighbors in time and place;
- a verb that turns it into seeing (learn it, find it, play it, take it to Studio).

The archive is the curriculum and the curator. A painter's whole life shows as one strip of color. The centuries flow as a river you can scrub. An internet aesthetic finds its ancestors among 23,531 paintings. The colors that do jobs in your street (school-bus yellow, safety orange, the post-box red) get their history and a camera hunt.

Every number is labeled *as photographed*, and every comparison says *color only, not influence*. The app explains *why* the archive is brown instead of hiding it, so even the caveat teaches you to see.

---

## 3. Ideas, ranked (★ = the five best)

### 1 ★ The Life Strip: painter pages that show a whole life of color at once
**What.** Each painter's page opens on a horizontal strip, with one thin column per painting in date order. Each column stacks that painting's colors by share, dark at the bottom.
- Below it: decade ticks, and the change-point marked where the data has one ("lightens after the 1880s, from 37 paintings here").
- Then the palette families as **rooms**: each cluster is named after its most typical painting ("the *Madame X* room"), with its paintings shown and its 5 colors as chips that open color pages.
- Then "paints most like" and "paints least like".
- Tap any column to open that painting.

**Why 10×.** It answers David's "never one palette" in one glance, and it's beautiful enough to screenshot. It turns 837 dead JSON files into the most-wanted feature in the ledger (A1, E3; ledger top-25 #5 and #18).

**Connections.** Gallery (artist byline becomes a link; columns open paintings) · color pages (room chips; "painters most devoted to this color" links back) · search (painter names) · Decade River (#4: a painter's span is highlighted) · Cabinet (save a room) · Train's Whose palette? (GP1 answers open here).

**Effort.** M (S for a v0; see §6).

**Honesty.**
- Show "n paintings here (the archive keeps at most 50 per painter)" and "as photographed".
- No finding sentences until #2 lands.
- Rooms only for n ≥ 12; signatures only with the within-painting lens.
- Full page for n ≥ 20 (~155 painters); a data card for the rest.

### 2 ★ The honest-surprise findings engine
**What.** Rebuild `find` in `tools/analyze.py` as a gate rather than a generator.
- Every candidate finding is scored for surprise: a percentile at or below 5 / at or above 95 against the right baseline (painter, same museum and decade, archive); a lift of at least 2 with support of at least 10; non-analogous harmony with a high score.
- A painting shows at most 3 findings and says nothing when nothing clears the bar.
- Kill the bugs:
  - "0% vivid" (13,545 paintings);
  - self-pair "glow" (Ink and Ink);
  - repeated barcode names;
  - "darker than 98%" on paintings that are merely in a dark museum's photos. Use a same-source baseline.
- Add a findings check to `tools/analyze_test.py`: no finding may be true of more than 15% of the archive.

**Why 10×.** It's the difference between a curator and a spreadsheet. One silly sentence repeated on 13,545 pages would poison trust in every true one. Rare, real findings ("The brightest thing in this painting covers 2% of it") are what make people look again.

**Connections.** Painting pages · painter pages (#1) · Today's exhibition (#6, which picks the day's strongest findings) · L7 article "data-born hooks" (same surprise score) · L17 crawlable pages (findings as text).

**Effort.** M.

**Honesty.** This *is* the honesty work. Pair it with GP1 §2.3 (alias merge) before rerunning.

### 3 ★ Looks as recipes, measured by the archive (aesthetics-as-palettes, done honestly)
**What.** Merge the unmerged Looks archive (69 looks, 155 hand-picked palettes), then add a second, measured reading for each look.
- A look gets an editorial **recipe** in measurable terms. Dark academia = low key, warm, muted, browns plus bottle green, cream accents, low entropy. The recipe is labeled as our definition.
- The archive answers. The 23,531 paintings are ranked by fit, the look's measured palettes are the cluster centroids of the top 200 fits (named with `nameOf`), and its **ancestry** is where those paintings come from: e.g. "found in N paintings, mostly Dutch, 1630–1670" (illustrative; the real N and origin are computed).
- The page shows both readings: *the look as people describe it* (hand palette) and *the look as the archive finds it* (measured).
- The gap is itself a finding, of the kind "this look as described is pinker than any painting it resembles" (only stated when measured).

**Why 10×.** It answers David's Aesthetics Wiki ask (S11) with something no aesthetics site can do. Internet aesthetics get real art-historical roots, measured. Teens get the hook ("which century is my feed?"), and the archive gets a reason to be browsed.

**Connections.**
- Studio palette engine: recipes become strategies ("in the spirit of dark academia").
- Camera/photos: "your photo's closest looks".
- Taste model: "your closest looks", already in LOOKS.md.
- Gallery: a look is a preset filter.
- Fashion decades: looks link to their decade.
- Cabinet: save a look.

**Effort.** M (merge S, recipes plus measuring M).

**Honesty.**
- "Color resemblance, not lineage."
- Recipes are editorial and labeled.
- The Aesthetics Wiki (CC BY-SA) stays a pointer only, as LOOKS.md already does.
- Fuzzy looks keep their "how fuzzy is it" line.

### 4 ★ The Decade River: scrub five centuries of color
**What.** One full-screen view.
- A streamgraph of color-family shares per decade, 1400s to 1920s, from `groups.json` `byDecade` (60 decades). A thumb scrubs through time.
- As you scrub, the river shows that decade's top paintings, its *distinctive* colors (lift vs the archive) and **"born this decade"**: the color words first recorded then (Maerz & Paul / ISCC-NBS / L6 first-recorded dates).
- Fashion's decades (1900s on) dock under the river where they overlap: "the 1900s on canvas, the 1900s on the street".
- A toggle switches to the within-painting lens (relative lightness ranks), so the brown varnish flattens out and the real structure shows.

**Why 10×.** It's the one picture of "how color changed" that only this app can draw, because it holds 23k dated paintings, dated words and fashion at once. It also replaces two thin lenses (History and "Through history") with one living timeline.

**Connections.** Color pages (a "first recorded" date jumps to its decade) · painter pages (spans highlighted) · fashion decades · L6 Ngram/first-recorded data (GP1's Word vs paint, at decade scale) · Journey world steps ("a painting from the decade your word was born").

**Effort.** M.

**Honesty.**
- Show each decade's makeup (computed per decade, e.g. "the 1650s here are mostly Dutch, mostly from one museum"), so collecting bias is visible.
- Thin decades (n < 25) are drawn hatched.
- "As photographed"; "born" = first recorded in our sources.
- Hedged dates for the myth-list items (the Mauve Decade, magenta).

### 5 ★ Colors with a job (design history as the colors in your street)
**What.** L19's design history, organized around the standardized and designed colors people pass every day. Each is a dated node with:
- a hex approximation;
- who chose it and why;
- what it replaced;
- where you'll see it today;
- a **camera hunt**: find it, then name it before the camera does (GP1 #7).

Rooms:
- **Safety** (ISO 3864 safety colors; RAL 3000 fire red, already in our RAL data).
- **Transport** (school-bus yellow and the 1939 standards conference; London Transport red; US interstate green).
- **Landmarks** (International Orange on the Golden Gate, chosen by consulting architect Irving Morrow).
- **Books** (Penguin's 1935 color code: orange fiction, green crime, dark blue biography).
- **Objects** (Bakelite browns to the 1950s pastels to the 1998 iMac).
- **Systems** (Pantone 1963, RAL 1927).

**Why 10×.** It hits goal 3 ("iconic design colors") and the soul ("see more color in the real world") at once. Your commute becomes a field trip. And these colors are *dated design decisions*, so each one is a tiny, true story.

**Connections.** Camera (hunts, finds logged to the Learner Model) · Cabinet ("Your finds" drawer) · color pages (an "In design" row) · Decade River (objects dock on the timeline) · Looks (Bauhaus, Swiss Style, Memphis, Frutiger Aero link to their objects) · articles (the Standards tier).

**Effort.** M (research-first per `design/ARTICLE-RESEARCH-FIRST.md`; 40 nodes for v1).

**Honesty.**
- Every hex is "≈, screen approximation".
- Trademarked colors (Tiffany, brand blues) can be *discussed*, never sold (Shop rule).
- Each story sourced. "Reportedly" where only one source exists.
- No "red makes you hungry" psychology (myth list).

### 6 Today's exhibition (the For you cover, rebuilt)
**What.** Each day the For you cover is a small, auto-curated **show** instead of a shuffled color.
- A theme (a hidden color, a decade, a look, two painters, a museum's blues, a poem's colors), 8 works, the 3 strongest findings from #2, one poem line, one object from #5, and a wall text written from templates over measured facts.
- When the Learner Model exists, the theme comes from your edge (GP1 `lmEdge()`): "three greens you haven't met, in 8 paintings."

**Why 10×.** It gives a reason to open Explore daily, and a "museum" feel that isn't random. Each show is a ColorSet, so learn, play and save come free.

**Connections.** Learner Model · findings engine (#2) · painter pages · Cabinet (save the show) · `challenge.js` seed (the same show for everyone, shareable).

**Effort.** M.

**Honesty.** Wall texts only from measured fields and sourced facts; no runtime LLM prose.

### 7 Twins across time
**What.** Pairs of paintings centuries apart whose palettes are nearly identical, from the `nn` field (10,144 paintings have a cross-century nearest). Filtered to colorful pairs (both mean chroma ≥ 22, not low-key): **794 qualify**.
- Shown as two thumbnails with their years set large ("1650 · 1890") and one shared palette band.
- A painting page gets an "Its twin across time" row.

**Why 10×.** It's an instant "huh!" made from existing data, and it trains the eye to see palette apart from subject and style.

**Connections.** Gallery · Decade River (a pair spans two decades) · Train (later: "Which one is older?") · Cabinet (save a pair).

**Effort.** S (buildable today, §6).

**Honesty.** "Paired by palette only, as photographed. Not influence."

### 8 Why the archive is brown: the varnish slider
**What.** A small lab page.
- A bright painting, with a slider that ages it under a simple yellowed-varnish model (warm multiply, lifted blacks, compressed contrast).
- Its live palette re-names itself as you drag: "sky blue" becomes "greyish teal" becomes "olive grey".
- A second tab runs it in reverse on an archive painting: "roughly lift the varnish".
- Every "as photographed" caveat in the app links here.

**Why 10×.** It turns the archive's biggest weakness into a lesson in seeing. Color depends on the light and the surface, and names shift with small changes. It's honest by construction.

**Connections.** Gallery and painter caveats · Train (a future white-balance / color-constancy station) · color pages (why a painting's "ink" may have been a blue-black) · articles on varnish and conservation.

**Effort.** S (buildable today, §6).

**Honesty.** "A rough simulation, not conservation science. Real varnish ages unevenly, and cameras and lights shift color too." Don't claim any specific painting was brighter.

### 9 Search that knows painters, museums, decades and poets
**What.**
- A 60 KB client index of the 837 painters (name, n, gallery indices), plus the 7 museums, 60 decades and 429 poets.
- Typing "Sarg" shows the painter, his rooms and a strip preview; "1650s" shows the decade; "Rijks" shows the museum shelf; "Keats" shows the poet.
- Then it falls through to GP1's constellation search.

**Why 10×.** Today the biggest archive in the app is unfindable by the first thing people type.

**Connections.** Painter pages · Decade River · poems · gallery.

**Effort.** S.

**Honesty.** None.

### 10 Schools by place and time (honest movements)
**What.**
- Until Wikidata P135 lands, replace "movements" (8, AIC-only) with **schools** defined by country × decade window: Dutch 1630–1670, the Danish Golden Age 1810–1850 (SMK's 2,822 paintings make this strong), Mughal, Pahari, French 1860–1900.
- Each gets a page: its palettes, distinctive colors, typical painting, painters and its spot on the river.

**Why 10×.** Real, populated pages now instead of 8 thin ones, and they're the units people actually think in.

**Connections.** Decade River · painter pages · Looks (#3: a look's ancestry points to a school) · Journey world steps.

**Effort.** S–M.

**Honesty.**
- Labeled "place and time, not a movement".
- Country = nationality, said once on the page.

### 11 Lost in translation: one old word, many swatches
**What.**
- For the poems with originals (Greek, Latin, Japanese, Chinese, Persian), take one source color word (Greek *chlōros*, Japanese *ao*, Latin *purpureus*) and show every English word translators used for it.
- Each English word gets its swatch, so one ancient word spreads into a fan of colors.
- The 63 gloss notes in `poems-index.json` seed it.

**Why 10×.** It shows that color categories are drawn differently across languages, and it corrects the myth that the Greeks couldn't see blue, with real lines as evidence.

**Connections.** Color pages (the Language facet) · articles (word origins) · Journey (a story step) · Learner Model (a "you named this *green*; Homer's word also covers…" moment).

**Effort.** M.

**Honesty.**
- The myth list applies ("the Greeks couldn't see blue" only to correct it).
- The Winawer effect is modest; say so.
- Translators' choices are theirs; show the translator.

### 12 Ekphrasis by color: a poem beside its painting
**What.**
- Each poem page gets the painting from within ±40 years of it whose palette best matches the poem's named colors: "Read Keats beside a painting of his decade that wears his colors."
- It also works in reverse on painting pages.

**Why 10×.** Two archives (11,440 poems and 23,531 paintings) meet through color, which is exactly the "links are the product" rule.

**Connections.** Poems · gallery · decades · Cabinet (save the pair).

**Effort.** S–M.

**Honesty.**
- "Paired by color only."
- The poem's colors are words, not pigments; match only on named colors, never on mood.

### 13 Two walls: painter vs painter
**What.**
- Any two painters' Life Strips stacked, with their rooms side by side.
- "Where they overlap" (shared colors) and "where they part": the colors only one uses, with lift.
- The entry point is "paints most like" on a painter page.

**Why 10×.** It's the cheapest wow in COLOR-PAGE-PLAN §C, and comparison is how curators teach.

**Connections.** Painter pages · Whose palette? (GP1) · Studio (the overlap as a palette).

**Effort.** S (after #1).

**Honesty.** n and "as photographed" on both sides.

### 14 One element, three gems
**What.**
- A World/Gems feature on chromium: it makes ruby red (in corundum), emerald green (in beryl, sometimes with vanadium) and alexandrite's color change (in chrysoberyl).
- The alexandrite card has an illuminant slider, daylight to candlelight, that swaps its color live.

**Why 10×.** One true fact upends "a color is a substance". It teaches that surroundings and light make the color, which is the core of learning to see.

**Connections.** Gems · color pages (ruby, emerald) · Train (illuminant and white-balance stations) · articles (the "why is it that color" essays).

**Effort.** S.

**Honesty.**
- Well established.
- Say the slider is an illustration of the effect, not a measurement.

### 15 Color relay: follow one color through six worlds
**What.**
- A 60-second game. It starts on a painting swatch; you hop to the poem, the flower, the gem, the dress and the design object that hold that color.
- At each hop you pick which of 3 candidates holds it (same-family distractors; product rule).
- The final screen draws your path across the six domains.

**Why 10×.** It's "many lenses, one color" as play. It trains recognizing one color across materials and lighting, the varied examples that perceptual learning needs.

**Connections.** Graph (the hops are edges) · gallery, poems, botany, gems, fashion and #5 · Learner Model (results logged) · Train game grammar (a board drawn from a set).

**Effort.** M.

**Honesty.**
- Every hop is within the graph's ΔE threshold.
- Show the ΔE on the reveal.
- Note: this is a game, not the rejected rabbit-hole *view*.

### 16 Plant a Jekyll border
**What.**
- Gertrude Jekyll's *Colour in the Flower Garden* (1908, public domain; already in `color-kb/sources/`) grades a long border from cool, pale ends to a hot center.
- A rearrange puzzle: place 9 real flowers from Botany into a border. The app scores the value and temperature rhythm and shows her own principle afterward.

**Why 10×.** It's real garden design history, teaches gradation and value rhythm, and grounds the Rearrange family in a craft.

**Connections.** Botany · Train Rearrange family (§3) · Studio (the border as a palette) · camera (find a graded border in a real garden).

**Effort.** M.

**Honesty.** Describe the principle as hers; original prose only.

### 17 Werner's walk
**What.**
- Werner's 1821 nomenclature pairs each of its 110 colors with an animal, a plant and a mineral (Darwin reportedly carried Syme's edition on the Beagle).
- One page per color shows its three natural referents, and a hunt asks you to find one of them outdoors.

**Why 10×.** It's the original "see the world through color" field guide, it's public domain, and it's already in `color-kb/werner.json`.

**Connections.** Botany · gems/minerals · camera hunts · color pages (Werner names already in `CS_SRC`).

**Effort.** S–M.

**Honesty.** Hedge the Darwin line; Werner's swatches are approximations of a printed book.

### 18 The silent tint code
**What.**
- Public-domain silent films (before 1930) were often tinted by convention: blue for night, amber for lamplit interiors, red for fire.
- A page shows real Commons frames from public-domain prints with their measured tints and the convention behind each.
- This is the honest first step for the film archive: frames we may show.

**Why 10×.** Films finally have something to *see*, and it's a forgotten color language.

**Connections.** Films · Decade River (the 1910s–20s) · color pages ("In film") · Studio (a tint as a palette).

**Effort.** S–M.

**Honesty.** "Common conventions, not rules; prints vary and have faded."

### 19 Director strips (the film archive, computed only)
**What.**
- `tools/filmstrip.py` runs over a copy David owns, kept private. It detects shots and stores only the computed palette per shot (1, 3, 5 or 10 colors), never frames.
- In the app: the film as a barcode, zoom to an act, compare films, and a director gets a Life Strip like a painter's (#1).

**Why 10×.** It's FA1 and FA2 (asked twice), and it reuses the Life Strip and the findings engine.

**Connections.** Life Strip · findings engine · Looks (film looks) · Decade River (later decades).

**Effort.** L.

**Honesty.**
- Store only computed data.
- Link out for stills.
- Say "computed by ColorHub from a private copy".

### 20 Le Corbusier's keyboards
**What.**
- His *Polychromie architecturale* (1931 and 1959) organized colors into "keyboards" meant to be played together.
- An instrument page: tap combinations on a keyboard, and see them on a simple room elevation.
- The page corrects the myth that his architecture was all white.

**Why 10×.** It's a real designer's palette *system*, playable, and a myth correction in one.

**Connections.** Design history (#5) · Studio palette engine (a strategy) · Looks (Modernism) · the myth list.

**Effort.** M.

**Honesty.**
- Hex values ≈ from published references.
- Don't reproduce the commercial swatch books.

### 21 Questions the archive can answer
**What.** Ideas gets a shelf of 20 chart cards, each a question answered from `groups.json` with its caveat:
- "When did paintings get lighter?"
- "Which country's painters used the most blue?"
- "Is the 1880s really darker, or is it the museums?"

**Why 10×.** It gives Ideas a spine, and teaches reading data honestly.

**Connections.** Decade River · findings engine · articles (L7 hooks) · L17 pages.

**Effort.** M.

**Honesty.** Each card shows n and its bias line.

### 22 Your wing
**What.** Saved paintings, looks and shows become a personal museum wing with a computed wall text: "Your saved paintings lean cool and mid-key; 60% are Dutch, 1600s; the room you keep returning to is blue-grey."

**Why 10×.** You see your own taste as a curator would.

**Connections.** Cabinet / Saved · taste model · Looks (#3) · painter pages.

**Effort.** S.

**Honesty.** It describes your picks, nothing more.

### 23 Dress the decade
**What.** Fashion decades and Colors of the Year render on a simple garment and room mockup with 60-30-10 proportions (Studio mockups, R§8 approved). One tap sends it to Studio.

**Why 10×.** Fashion stops being a list and becomes a palette you try on.

**Connections.** Fashion · Studio mockups · Looks.

**Effort.** S–M.

**Honesty.** Pantone names are discussed, never sold.

### 24 Poet pages
**What.** Like painter pages, but for words. A poet's named-color palette and their colors by decade of writing, with a translation toggle (original vs translator) for non-English poets.

**Why 10×.** It gives the 11,440 poems the depth of the paintings.

**Connections.** Poems · Lost in translation (#11) · Ekphrasis (#12) · color pages.

**Effort.** M.

**Honesty.** Translated colors belong to the translator, and say so.

---

## 4. Kill list (surface that doesn't add seeing)

1. **Stale counts.** "Fourteen thousand paintings and eleven thousand poems" on the Art cover and header → 23,531 and 11,440. Better: read `GAL.n` and the poem index count, so the copy can't go stale.
2. **For you as a shuffle of the 101.** Both `dailyColor()` (`ALL`) and the For you feed. Replace with Today's exhibition (#6). This also clears X19.
3. **Art's 101-bubble picker.** Use one row of 9 families, then that family's shades from the ~1,000 names, plus "any color" through the picker or camera.
4. **Two painting templates.** Retire `paintingPage()` and the "Featured · with stories" rail. The 22 stories become a "has a story" section inside `glPage()`.
5. **Duplicate shelves in Ideas.** "Color systems" (also under Symbols) and "Through history ·" (also the History lens). The Decade River (#4) replaces History, and Ideas becomes Stories, Questions (#21) and Systems.
6. **"Opposites" that don't say which wheel.** Label it "on the CIELAB hue circle; a painter's wheel would pair differently", or move it into Studio's harmony tool.
7. **The "Looks" label on the look-alike lens** in `CONN_LENSES`. Rename it "Look-alikes" before the Looks archive merges.
8. **Glass on the Explore search button** (`.xp-search` backdrop blur). Make it solid (X10, DS rule 2).
9. **The current findings strings, until #2 lands.** Don't render `find` at all. Hide harmony fit whenever it says "analogous".
10. **Three link sections on the color page.** Kin, the Connections chip wall and the closeup's More like this become one graph-driven section.
11. **"Movement" pages built on 8 AIC-only labels.** Use Schools (#10) until Wikidata P135 is ingested.
12. **Films' "colors discussed" inside palette matching.** The Looks matcher auto-includes `window.FILMS` palettes. Exclude chosen-not-measured colors from any "closest" computation.

---

## 5. The 60-second wow

**Open Explore → tap the Art cover → tap any painting → tap the painter's name.**

The Life Strip draws itself left to right, one column per painting in date order. You *watch* the palette change. For Sargent the dark 1880s columns give way to lighter ones after 1890, and one plain line confirms it: "His palette lightens after the 1880s (from 37 paintings here, as photographed)." Tap the brightest column and that painting opens.

It takes three taps, nothing needs to be explained, and no other app can show it.

---

## 6. Buildable today (each under 4 hours, Sonnet)

### A. Twins across time (S, ~2.5 h)
**Data:** `tools/twins.py` (new).
- Read `data/analysis/paintings-*.json`, which is positional with `data/gallery/d/`. Take every record with `nn`.
- Keep pairs where both paintings have `stat.Cm ≥ 22` and `stat.key != "low"`. Drop symmetric duplicates.
- Confirm each pair with the same two-way area-weighted ΔE that `glSimilar()` uses on the 6-color index palettes. Drop any pair whose distance is ≥ 6.
- Sort by distance and keep the top 150.
- Write `data/analysis/twins.json` as `[[giA, giB, dist, yearA, yearB]]`, about 6 KB.
- 794 candidates qualify today.

**UI:**
- **`js/explore.js` `artHome()`.** When no color is picked, insert a "Twins across time" rail above the feed. Each pair pin shows two thumbnails, their years in the serif, and one merged 6-swatch band.
- **Tapping a pin** opens `galleryPage(giA)`.
- **`js/gallery.js` `glPage()`.** If `i` is in the twins map, add an "Its twin across time" row above Similar palettes.
- **Fine print:** "Paired by palette only, as photographed. Not influence."

**Connections:** gallery, Art, Saved (`toggleSave` on a pair id), and later Decade River and Train.

**Verify:** `colorhub-verify` and 375×812 screenshots of Art and of a twin painting page.

### B. Why the archive is brown: the varnish slider (S, ~3 h)
**Files:** `js/varnish.js` (new) and `css/varnish.css`.

**Route:** `#/lab/varnish`. Add one `ROUTED` line and an `openRoute()` case in `js/router.js`.

**Screen:**
- **Image:** a bright, locally hosted public-domain painting from `img/gallery/aic/` (same-origin, so a canvas can read it). Draw it into a canvas downscaled to 480 px.
- **Slider:** "Varnish (simulated)", 0 to 1. Per pixel, in linear RGB:
  - multiply by `[1, .86, .55]^t`;
  - lift blacks by `+.04t`;
  - compress contrast around mid-grey by `(1 − .25t)`.
- **Palette:** every 150 ms, re-run `extractPalette` (from `js/studio.js`) on the canvas, k = 6. Show swatches with `nameOf()` names that change live. One tap opens a color's page.
- **Tab 2, "Lift it":** the inverse transform on any gallery painting whose host allows a canvas read (reuse `glCORS`/`testSample` from `glPage`).
- **Copy:** "A rough simulation, not conservation science. Real varnish ages unevenly; cameras and lights shift color too."

**Entry points:** a "Why?" link after the "Screen approximations; old varnish and the photograph shift color" line in `glPage()`, plus a card in Ideas.

**Connections:** gallery, color pages (one tap per swatch), and a future Train white-balance station.

### C. The Life Strip, v0 (M−, ~3.5 h; hand to L11 if its painter pages are still in flight, as their hero)
**Data:** `tools/artist_index.py` (new) writes `data/analysis/artists/index.json` as `{slug: [name, n, [gi…]]}`.
- `gi` = gallery positions sorted by year, matched by id between the artist files' `barcode` and the analysis shards (positional with the gallery).
- 837 entries, under 120 KB, loaded lazily.

**Component:** `js/lifestrip.js`, `lifeStrip(host, slug)`.
- `loadGallery()`, then draw one column per painting, `width = max(6px, 100%/n)` (horizontal scroll if needed).
- Each column stacks `glPal(gi)` by share, sorted dark at the bottom. Decade ticks sit underneath.
- If the artist file has `changePoint` and n ≥ 10, mark it with the plain sentence.
- Columns animate in by year (none under reduced motion). Tapping a column calls `galleryPage(gi)`.

**Page:** `#/painter/<slug>`, a new `ROUTED` line.
- Name, n, span and country, with "(nationality)".
- The Life Strip.
- Palette families: `clusters[]`, each with its typical painting's thumbnail and its 5 colors as chips. Look up each hex in `CORE_NAMES`; one tap opens the color page.
- "Paints most like": `nearest[0..2]`, linked.
- **No finding sentences** until the findings gate (#2) lands.
- Caveat line: "n paintings here (the archive keeps at most 50 per painter) · as photographed".

**Links:**
- In `glPage()` the artist byline becomes a button when its slug is in the index.
- `exploreSearchSheet()` adds a "Painters" section that matches index names.

**Connections:** gallery, color pages, search, and the Whose palette? answer screen (GP1).

---

## Notes for the synthesis

- **Conflict to resolve.** GP1 L18 and §5 propose shading the honeycomb by Learner status ("Yours lit, met outlined, unmet dim"). David rejected progress marks and any dimming on the honeycomb (ledger X7: "true colors only; progress is a view toggle"). Keep it as an opt-in view toggle, never the default map.
- **Order matters.** Alias merge (GP1 §2.3) → findings gate (#2) → anything that shows findings. The Life Strip, Twins and the varnish slider show measurements, not sentences, so they can ship before that.
- **L19 design history corpus.** No files are visible yet in main or the worktrees. Idea #5 is a proposed organizing frame for it, and #20 is a candidate first exhibit.
