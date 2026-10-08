# Systems review: the app as one machine (2026-10-08)

Meta-level companion to the screen reviews. Evidence is from code on `main` at ebfced64 (router.js ROUTED, core.js ROOMS_LIST, rooms2.js, you.js, learn.js, explore.js, colorset.js, learner.js). It builds on IMPROVE-2026-10-08/PLAN.md and doesn't repeat it: where PLAN already decided something that hasn't shipped, this says so.

**The verdict in one line.** The parts are good and the shared systems exist (ColorSet, the Learner Model, todayPick, trail, coverage), but most screens still talk to their own private copies of them. The result is six rooms, three "keep" stores, two color pages, two painting pages and four learning entries. The fix isn't more features: it's routing every screen through the five systems that already exist and deleting the copies.

---

## 1. The app map

### Places (what you can reach from the stem)
The stem (core.js `ROOMS_LIST`) offers **the map ("Explore") + Learn, Train, Museum, Studio, You**: six places. The map's right corner adds 7 more verbs (Recall, Learn these, Study the map, Favorites, Search, Colors, Arrange).

| Place | Gets there from | Goes to | Reads / writes |
|---|---|---|---|
| **Map** `#/home` | first launch, stem, every "On the map" | color page (tap twice), Learn these, Study the map, search, favorites | reads knowState, edgeOfMap, todayPick; writes trail |
| **Learn** `#/today` | stem | review deck, meet/unit, Today card (painting + Name it in six), Practice, word ladder | reads/writes S.cards; Today via todayPick + chToday + dnDone |
| **Practice** `#/practice` | Learn row only (`prEntry`) | 7-row builder, Study | its own S.palettes/S.saved reads; learnerLog |
| **Train** `#/train` | stem | 7 game tiles + Today's color + Lightning + drills list + check-in / screen / history | eye thresholds; per-game bests in S.best, S.gym, oo state |
| **Museum** `#/museum` | stem | 5 covers (For you, Art, Ideas, World, Saved) → Art browse, painters, decades, chords, paintings-of, stories, hubs, poems, films, passages, fashion, looks, gems, botany | writes S.saved (its own keep); learnerLog "seen" |
| **Studio** `#/studio` | stem | camera, namer, wheel, Harmony, Albers, photos, palettes, taste, favorites, export | writes S.palettes, photos (IndexedDB), S.fav |
| **You** `#/you` | stem | review, Untangle, You can name rings, What you love, Your eye, made & kept, lately, settings | reads confusions, coverage, trail, S.favs, S.palettes |

### Thing pages (where the links land)
color `#/color` (101 colors, `colorPage`) · name `#/name` (the other ~2,600, `namePage`) · painting `#/painting` (wiki node, `paintingPage`) · gallery `#/gallery/<n>` (museum painting, `galleryPage`) · painter, movement, decade, country · story, hub, which · poem, passage, film · fashion, look · gem, botany · photo, saved palette · paintings-of / pair / chords.

### Findings

**Duplicates (two screens, one job)**
1. **Two color pages.** `colorPage` (explore.js) for the 101 and `namePage` (names.js) for every other name. That's the "special list" David rejected (P17) baked into the router, and why depth varies by which list a name is in.
2. **Two painting pages.** `paintingPage` (wiki node) and `galleryPage` (museum record). Only the gallery one got Lane A's distinctive-first palette and the Name it / Find it quiz.
3. **Three "keep" stores:** S.favs (hearted colors), S.saved (Museum things), S.palettes (Studio). Surfaced in four places: the map's Favorites, Museum Saved, Studio Yours and You's "What you love" / "What you made and kept".
4. **Four ways to learn a handful:** Learn it (`hmLearnIt` / learnit.js, still called from 9 files), `prQuick`, `csLearn`, and Practice's builder. `lsQuick` from PLAN Lane E doesn't exist yet.
5. **Two Todays, still.** Learn's Today card combines `todayPick`, `chToday` and `dnDone`; Train has its own "Today's color" tile; the Museum cover quotes todayPick. One object, three presentations.
6. **Three searches:** the map's pull-down (home.js), `exploreSearchSheet` (explore.js) and `awSearchHTML` (artwiki.js), plus the namer, which is a search by hex.
7. **"Your eye" in three places:** Train's eye line plus History, `ooEyePage` (#/odd/eye), and You's "Your eye" section.
8. **Harmony and Albers** sit in Studio and are also "eye" exercises; the Gamut wheel already does what Harmony does.

**Orphans and near-orphans**
- `lab/honey` and `lab/sounds` are dev screens with public routes. Hide them behind a debug flag.
- `interests()` and `seenIn()` in learner.js have **no readers**. The Learner Model records what you look at, and nothing uses it. The Museum's "For you" doesn't read it.
- `csCompare`, `csPalette` and `csShare` are defined but are only reachable through `csActions` rows, and `csActions` is missing from looks, films, poems, passages, gems, botany, fashion and photos.
- `edgeOfMap()` only seeds the map's study. It's the best "what to learn next" signal in the app, and Learn doesn't use it.

**Dead ends** (a page with no outward verb): poem, passage, film, gem and botany detail pages have color links but no set verbs (Learn these / On the map / Play). You can read about vermilion's pigment and not learn the four colors on the page.

**Important things more than two taps deep:** Painter against painter (Museum → Art → painter → button), Art history by color, Masters' chords, Untangle a mix-up (bottom half of You), the weekly check-in (Train's drill list), Export (Studio, and only once you've saved something), Settings and backup (the end of You).

**Inconsistent names**
- The map is "Explore" in the stem; PLAN decision 1 ("Map") hasn't shipped.
- "Find them", "Study the map" and "Find and name" are one verb with three names.
- "Learn these", "Learn it", "Practice" and "Begin" overlap.
- "Recall" and "Review" mean the same thing.
- "Favorites", "Saved", "Your colors", "What you love" and "Yours" all mean keeping something. "Yours" is also the *learning* word (PLAN decision 7). That last clash is the worst one.

---

## 2. Information architecture

### The critique
Six top-level places is two too many for a one-thumb app, and the buckets mix two different axes:
- **By activity:** Learn (words), Train (eye), Studio (make).
- **By content:** the Museum (the world's color), the map (every color).
- **By owner:** You.

So "where is my saved painting?" has four answers, and "where do I practice blues?" has three (Learn, Practice, Train). The map does double duty as the content index *and* home, which is right. But the Museum is a second content index competing with it.

The test: **the Look → Learn → Recall → Find loop** from PLAN. Each top-level place should own one step of it, or be the floor.

### Proposed IA: one floor, three rooms, one mirror

| Place | Owns | Absorbs |
|---|---|---|
| **The Map** (floor) | every color; the subject of any Set lit on it; search | Search (one search for everything), Favorites (as a map filter), "Colors" and "Arrange" (as View) |
| **Look** (was Museum) | the world read through color: paintings, painters, decades, ideas, poems, films, looks, gems, flowers | Ideas and World merge into one feed with facet chips; Saved moves to Yours |
| **Learn** | words: Today, the path, your Sets, review | Practice (as "Your sets" with Adjust); Learn it, as one engine |
| **Train** | the eye: 5 games, Study the map, the check-in, your eye | Harmony and Albers move here (as eye drills); the Today's color tile is dropped (it's Today's) |
| **You** (the mirror, not a room) | Yours: kept things, Sets, taste, eye profile, settings | Studio's "Yours", Museum Saved, the favShelf |

**Studio dissolves into verbs.**
- Capture (the camera) becomes a primary button on the map's corner and on Look's header: "Point at anything" is a way *in* to a Set, not a room.
- Name (the namer) merges into the one search: type, drag or eyedrop.
- Make (the gamut wheel) becomes the Palette verb on any Set: "Build from this".
- Export is the Share verb on a kept palette.

That's 4 stem entries plus the floor, and every verb lives on the thing it acts on.

### Skeptic pass
- **"Studio is a destination for designers."** It is, for the camera. Mitigation: keep `#/studio` as an alias that opens the camera full-screen, with "Your palettes" as its second panel. Designers keep one door; the room stops pretending to be four tools.
- **"Renaming Museum to Look churns names again** (it was Explore this morning)." True, and David hates churn (P21). Alternative: keep **Museum**. The structural merge (Saved out, Ideas + World together) is what matters, so the rename is optional. *Recommendation: keep "Museum".*
- **"Merging the keep stores breaks saves."** `migrateState` copies them into one collection, and the old keys stay for one version.
- **"Fewer rooms means longer rooms" (P22).** Each room gets one hero and at most 4 blocks. Everything else is a verb on a thing, which is the point.
- **"Harmony in Train is odd."** Albers belongs in Train (it's an eye illusion). Harmony belongs to the wheel (PLAN Wave 3 "One wheel"), which becomes the Palette verb. Neither needs a room.

---

## 3. Unifying systems

Each one is named with what it replaces, what gets simpler, and the migration path. Most already exist half-built.

### U1. The Thing: one object, one page template
**What it is.** Every node (color, name, painting, gallery record, painter, decade, movement, look, film, poem, gem, flower, photo, palette) becomes `thing({kind, id})` → `{title, hero, set, readings[], facts[], links[]}`. One `thingPage(t)` renders it:
1. the full-bleed hero;
2. the Set band, named and tappable;
3. the coverage ring and the verb row;
4. readings (the palette switcher: area, accents, lights/shadows, warm/cool, by decade);
5. "Measured" findings with percentiles;
6. the kind's own sections;
7. "Connected": the shelves of other Things.

**What it replaces.** colorPage + namePage; paintingPage + galleryPage; the bespoke headers in artwiki, world, gems, botany, films, passages and poems.

**What gets simpler.** Every Thing gets a palette switcher, verbs and connections for free. That fixes the dead ends, P7 ("never one palette") and P17 (one color page for all ~2,700 names).

**Migration.**
1. Write `thing.js` with adapters that call the existing renderers for each kind's own sections.
2. Move color + name first (merge namePage into colorPage's deep sections), then the two painting pages (galleryPage wins; the wiki node adapts to it).
3. Move the rest kind by kind.

### U2. The Set, everywhere, with five verbs
`colorSet` already exists. Make it the only currency, with five verbs: **Learn · Find (on the map / camera) · Play · Compare · Keep** (Share sits inside Keep).

- **What it replaces.** Learn it / prQuick / csLearn / Practice's builder all become `learnSet(set)` (Lane E's `lsQuick`). "Study the map", "Find them" and "Find and name" become **Find**.
- **Migration.** Mount `csActions` through the Thing template (U1), so the 8 missing page kinds get it at once. Then retire `hmLearnIt` callers one file at a time behind `learnSet`.

### U3. One Keep: Collections
One store, `S.kept = [{set, kind, id, at, note}]`.
- A heart on a color keeps a 1-color Set. A heart on a painting keeps its Set and a link. A saved palette is a Set you built.
- "Your sets" (Learn), Saved (Museum), Studio Yours and favShelf are all **views** of it, filtered by kind.

**What it replaces:** S.favs, S.saved and S.palettes, plus four keep screens.

**Words:** "Kept" for this; "Yours" is reserved for "recalled on a later day" (PLAN decision 7).

**Migration:** a `migrateState` step that merges the three keys (keeping the old ones), then readers switch one at a time.

### U4. One progress writer, one ladder
`lmAnswer(set, color, result)` is the only writer: decks, games, the quiz, Study the map and Colordle all call it, and it fans out to S.cards, confusions and thresholds.

**One number:** "N yours · M on the way". **One ladder:** HM_STAGES.

**What it replaces:** 19 files calling `learnerLog` with their own semantics, the practice and mapstudy copies of `prApply`, and the 6 counters that disagree.

**Payoff:** the unread `interests()` and `seenIn()` start feeding For you, Today and Learn's "Next door" (from `edgeOfMap`).

### U5. One Today and one return loop
`todayPick()` exists. Make **Today a Set** (`today:<date>`: the color, its painting, and two of its look-alikes). Its three parts are Look (the painting quiz), Name (Colordle) and Find (a map or camera hunt). The streak counts any one of them.

**Return loop:** one daily nudge (a home-screen badge or a reminder, when PWA notifications are allowed) that names the color: "Today: *verdigris*, in a Vermeer". Plus a weekly "your week in color" card on You.

**What it replaces:** Train's Today's color tile, Learn's ad-hoc chToday/dnDone composite, Ideas' and World's own "Today" lines.

### U6. One Search that answers
Type a name, a hex, a painter, a decade or a phrase ("dusty pink", "Monet blues", "1880s"). Results are typed Thing rows, with Recent from the trail when the field is empty, and an eyedropper and the camera as inputs.

**What it replaces:** the three searches plus the namer's text field. The map keeps a "show on map" result action instead of its own filter-search.

### U7. One Compare mechanic
`csCompare(a, b)` becomes a page, `#/vs/<thingA>/<thingB>`: both Sets side by side and big (P8), shared colors, what only one has, lighter / warmer / stronger, and "learn the difference".

**What it replaces:** awVs (painter against painter), the pair page, misscompare's static view (it becomes a compact Compare), and the color page's look-alike split.

**Entry:** a "Compare" verb on every Thing, plus long-press on any two.

### U8. One "this feels off" loop
A tiny, solid flag on every Thing and every game result: "Wrong name / Wrong color / Doesn't make sense / Broken". It writes `{route, thing, note, build}` to a local queue that exports with backup (accounts later).

**What it replaces:** David's screenshot-plus-one-line workflow. The conductor reads the queue as a ledger.

**Why it's a system:** it turns P20 (be a skeptic) into data. Every data-quality lane (names, palettes, myths) gets a work list.

---

## 4. New systems that multiply value (each one replaces something)

**N1. Trails: guided walks through the graph.** A Trail is a short sequence of Things joined by one color idea. Examples: "Prussian blue: Berlin 1706 → Hokusai's wave → blueprints"; "How Sargent used black"; "The 1860s go aniline". Each stop is a Thing page with one highlighted reading. The Trail ends in `learnSet` on the colors you met and a Find on the map.
- *It replaces:* storyPlayer, the hub pages and the Ideas cover (they become Trails), and the "Next" logic scattered across the article pages.
- *Why it multiplies:* it's how the graph's links become a story without a wall of text. The 763 articles become the stops' Read layer.

**N2. Seek: the real-world loop.** Today's Set (or any kept Set) becomes a hunt. Point the camera; when a pixel cluster lands within tolerance of a target, the target fills in, with "found in *your kitchen*". It logs `find` events (already a Learner Model type) and the photo becomes a kept Thing.
- *It replaces:* Studio's standalone camera hero and the map-only meaning of "Find".
- *Why it multiplies:* it's the one feature that directly passes the soul test ("see more color in the real world"). It also gives the return loop a reason that isn't a streak.

**N3. Ask the archive: findings as answers.** Search (U6) learns a small grammar: `<thing> vs <thing>`, `<color> in <decade|movement|country>`, `rarest / most / first`. It answers with a Compare page (U7) or a Findings card: "Sargent uses black with rose 4× more than his peers"; "Vermilion peaks in the 1640s". It's built only from the precomputed graph stats.
- *It replaces:* awIndex, chordsPage and paintings-of as separate destinations. They become answer types.
- *Why it multiplies:* the statistics David asks for (pattern 6) stop being buried four taps deep.

**N4. The Passport: one profile of your eye, words and taste.** One page on You with three panels: **Words** (your ladder position and coverage by family), **Eye** (thresholds per family and axis, honest percentiles, the weekly check-in), and **Taste** (hearted colors and your palette). Each panel has the one next action: Untangle, a weak-family game, or Next door.
- *It replaces:* ooEyePage, Train's History, You's scattered Eye / Love / Can-name sections, and favTaste.
- *Why it multiplies:* it closes the loop between Train and Learn. Your eye's weakest family picks Train's game, and your mix-ups pick Learn's next Set.

---

## 5. Curation: cut or hide

**Cut from the surface.** The code stays until David has played without them for a day.
1. Practice as a place. Its builder sits behind Adjust (PLAN decision 3, not yet shipped).
2. Train tiles: Lightning (it becomes Study's boss round), Today's color (it's Today's), Painters' pairs (it becomes a Compare answer), Weekly check-in and History as tiles (they move to the Passport), and "Your screen" (it moves into Settings).
3. Studio as a room: Capture moves to the corners and Look, Name to Search, Make to the Palette verb, and Yours to You.
4. Museum's Saved cover (it moves to You); Ideas and World become one cover with facets.
5. The map corner shrinks from 7 verbs to 5: Recall (only when due), Learn these, Find, Search, View. Favorites becomes a View filter, and "Colors" and "Arrange" merge into View.
6. Routed dev screens: `lab/honey`, `lab/sounds`, and the `#…shot=` hooks stay unlisted.
7. Learn it as its own engine (learnit.js), replaced by `learnSet`.

**Rename for one word per concept.**
- Map (not Explore). Find (not Study the map or Find them). Recall (not review). Kept (not Saved or Favorites). Yours (learning only).
- Museum stays.

**Hide behind one tap.**
- Codes and sources on Thing pages.
- Every caveat paragraph on results (one "as photographed" note per page).
- Settings, which live at the end of the Passport.

---

## 6. Phased plan, with file-aware lanes

Hot files that only the conductor touches: `index.html`, `core.js` (ROOMS_LIST and NAV names), `router.js` (one ROUTED line per lane, appended).

### Phase 1: one vocabulary, one Keep, verbs everywhere (low risk, high calm)

| Lane | Work | Owns |
|---|---|---|
| P1-a | Names: Map, Find, Recall, Kept (strings only); the map corner down to 5 | `home.js`, `honey.js` labels, `menus2.css`; conductor edits `core.js` NAV_MAP |
| P1-b | One Keep: `kept.js` + a migrateState step; favShelf, Saved and Studio Yours become views | new `kept.js`, `favs.js`, `explore.js` (Saved only), `rooms2.js` (Studio Yours) |
| P1-c | csActions on the 8 dead-end kinds (looks, films, poems, passages, gems, botany, fashion, photos) | `looks.js`, `films.js`, `poems.js`, `passages.js`, `gems.js`, `botany.js`, `fashion.js`, `photos.js` |
| P1-d | Ship PLAN Lane E (`learnSet` = lsQuick) and retire the hmLearnIt callers | `learnset.js`, `practice.js`, `swatch.js`, `namer.js`, `names.js` |
| P1-e | The feels-off flag and queue | new `flag.js`, `css/flag.css` |

P1-b and P1-d both touch practice data, so run P1-d after P1-b merges, or keep `practice.js` edits in P1-d only.

### Phase 2: the spine (Thing, progress, Today, search)

| Lane | Work | Owns |
|---|---|---|
| P2-a | `thing.js` + the template; color + name merged first | new `thing.js`, `explore.js` (colorPage), `names.js`, `richpage.js`, `richcolor.js` |
| P2-b | The two painting pages merged (galleryPage wins); thingQuiz on both | `gallery.js`, `explore.js` (paintingPage only, after P2-a), `thingquiz.js` |
| P2-c | `lmAnswer` single writer; interests/seenIn wired to For you; Learn's "Next door" | `learner.js`, `learn.js`, `learnmore.js`, `mapstudy.js` (prApply copy) |
| P2-d | Today as a Set; Train's Today's color tile removed; the return-loop card | `today.js`, `challenge.js`, `colordle.js`, `rooms2.js` (Train today row) |
| P2-e | One search (U6); the namer's text field folded in | new `search.js`, `home.js` (search box), `artwiki.js` (awSearch), `namer.js` |

Serialize P2-a then P2-b (both touch `explore.js`). P2-c and P2-d share `learn.js`: P2-d touches only `lrToday*`.

### Phase 3: rooms and new systems

| Lane | Work | Owns |
|---|---|---|
| P3-a | Studio dissolves (`#/studio` becomes a camera alias); Albers moves to Train; Harmony folds into the wheel | `studio.js`, `rooms2.js`, `labs.js`, `camera.js` |
| P3-b | Compare page (U7) + Ask grammar (N3); awVs, chords and pairs become answers | new `compare.js`, `search.js`, `artwiki.js`, `chords.js` |
| P3-c | Trails (N1): stories and hubs converted | new `trails.js`, `article.js`, `labs.js` (storyPlayer) |
| P3-d | Seek (N2) | new `seek.js`, `camera.js` (after P3-a) |
| P3-e | The Passport (N4); ooEyePage and History folded in | `you.js`, `games/oo-ui.js` (eye page), `gym.js` (history) |

Every lane runs colorhub-verify, with 440×956 shots and a craft critique before merge. Every UI change gets a glance mockup first.
