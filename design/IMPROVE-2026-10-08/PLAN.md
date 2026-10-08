# The plan: one loop, fewer doors (2026-10-08)

This plan combines the five reviews in this folder (home-map-nav, learning, train, pages-museum-studio, journey). The reviews hold the detail and the file:line evidence. This file holds the decisions. `MAP-STUDY-2.md` doesn't exist yet. Anything here that touches Study the map defers to that lane.

## 1. The thesis

1. **Every thing is a Set:** a handful of named colors with a source (a painting, painter, look, photo, today, a map region, a mix-up pair).
2. **The loop is Look → Learn → Recall → Find.** Look at the thing and guess before you're told; Learn its names in one engine that starts at once; Recall them tomorrow, with the source attached; Find them in a new thing, on the map or through the camera. (This joins journey's Meet/Name/Prove/Find, pages' Look/Guess/Compare, which is Look done well, and learning's "the thing comes back". Train sits beside the loop and sharpens the eye that Find needs.)
3. **One of each:** one Set object, one learning engine, one Learner Model writer, one Today, one ladder, one progress number, one name per concept.
4. **Start, don't configure; guess before reveal.** Every primary button starts something within a second, options sit one link deep ("Adjust"), and things are instruments, not reports.
5. **Everything lands on the map** as views and events, never marks or dimming (X7). The cut test: if a screen can't say which step of the loop it serves, it's cut or merged.

## 2. Conflicts between the reviews, and my call

| Conflict | My call |
|---|---|
| **What the map is called.** It's "Explore" in the stem and the trail, while the Museum still uses `#/explore`. | **"Map"** everywhere. `#/home` and `#/explore` stay as aliases. In Art, "Rooms · ways in" becomes "Collections". *(D1)* |
| **Home corners.** Home-map wants a labeled Do arc; journey wants one corner that shows the due count. | **Both, in one corner.** Rooms stays on the left. One right corner shows a small count when reviews are due, and tapping it opens a labeled arc: Recall N (only when due) · Learn these · Find them · Search · Favorites · View. This removes the hexagon, the cards, the heart and the magnifier row. *(D2, needs a mockup)* |
| **What happens to Practice.** Learning wants a "Your sets" shelf; journey wants it merged into Learn. | **Practice stops being a place.** "Your sets" (smart sets plus saved Sets) becomes one section of the Learn room. The 7-row builder survives only behind the sheet's "Adjust". `PR_METHODS.learn` is deleted. *(D3)* |
| **Learn it.** Learning wants it merged into Study; journey wants an instant 4-color lesson. | **Both.** "Learn it" = `lsQuick(seed)`: the color plus its 3 closest Learn-layer neighbors, starting immediately, about 90 s, scheduled at the end. `learnit.js` retires once Edges is a Study step. |
| **What Train keeps.** The train review keeps 7 tiles, including Study the map and Name it fast. | **5 eye games plus 3 drill rows:** Odd one out, Gradients, Across the line, Painter's eye, Color memory. Study the map moves to the map (names belong to the loop, per CLAUDE.md). Lightning becomes Study's boss round. Imposter, n-back, Out of order, Rebuild and the Today's gradient tile come off the grid; their renderers stay. *(D4)* |
| **"Today."** Train wants a row of three dailies; journey wants one object. | **One `todayPick()`: a color, a painting that holds it, and a board.** Each room quotes it. Train's Today row shows that same object's three parts (Look, Name it in six, the board), each with a tick. *(D5)* |
| **The painting page.** Pages wants the loupe and a guess; journey wants "Find the colors"; train wants "Finish the palette". | **One `thingQuiz` component** with two round kinds. *Name it:* a region is shown and you pick one of three same-family names. *Find it:* a name is shown and you tap where it lives. Finish the palette lives in Painter's eye. The loupe comes later (Wave 3). |
| **The difference unit.** Pages calls "units" a violation of the percent rule; journey wants "steps". | **Keep percent.** It's already everywhere and it's plain. Fix the leftover "units". *(D6)* |
| **The progress words.** | **Yours** = recalled on a later day. **Climbed** = done in a session (replaces "mastered"). **Favorites** = hearted, with one home on You. |

## 3. Skeptic pass: how this plan fails

1. **A review avalanche.** Every Set schedules, so a day-one binge means 60 cards on day two. *Guard:* at most 20 new cards a day (the rest wait in their Set as "Next up"); a right first try goes to box 2.
2. **Merging engines breaks saves and the path.** *Guard:* the swipe deck stays as the review surface; the path moves onto Study only in Wave 2, after "Study schedules" is proven on the phone; a `migrateState` step; `S.cards` semantics untouched.
3. **The new corner is another hidden menu.** *Guard:* mockup first; every capsule says what it acts on ("Learn these · 6 from The Milkmaid"); the count shows only when reviews are due.
4. **The Today ritual becomes a chore.** *Guard:* every step skippable, a "just the board" tap, the thing type rotates by weekday, and it never gates the map or the rooms.
5. **Guess-before-reveal nags people who just browse.** *Guard:* one quiet secondary button, never forced; "show me" is one tap; the Museum stays a pure browse.
6. **Find it on varnished, low-res images feels unfair.** *Guard:* only distinctive colors with 2%+ area and a confident mask; generous tolerance; "as photographed" once; a miss shows the region, never scolds.
7. **The cuts remove something someone loved.** *Guard:* games leave the grid but the code stays; Lightning lives on as the boss round; David plays the new Train for a day before any deletion.
8. **Parallel lanes collide.** *Guard:* each lane owns its files (Wave 1 table); only the conductor edits `index.html` and bumps `?v=`; new code goes in new files when a shared file is hot; `tools/smoke.sh` and colorhub-verify after every merge.

## 4. The roadmap

Wave 1 starts once the "already being fixed" lanes (section 5) have merged. Run Wave 1 two lanes at a time.

### Wave 1: high impact, low effort, no file overlap

| # | Item | Files (owned) | Size |
|---|---|---|---|
| 1 | Learn it starts now | `learnset.js` (add `lsQuick`), `practice.js` (`prQuick`), `swatch.js`, `namer.js`, `names.js` | S |
| 2 | Constellations become the map's subject | `honey.js` (pill → bar), `trail.js` (keep the stack), `colorset.js`, `home.js` (study seed) | M |
| 3 | One Today | new `today.js`, `graph.js`, `colordle.js`, `challenge.js`, `explore.js` (covers), `learn.js` (Today card) | S–M |
| 4 | Train room rebuild | `rooms2.js`, `core.js` (questionnaire wall only) | S–M |
| 5 | Paintings lead with their best colors | `gallery.js` | S–M |
| 6 | Across the line clicks | `games/line.js`, `games/oo-engine.js` (`ooLineRound`), `eye-names.js` | M |

**1. Learn it starts now.** `prQuick` calls `lsQuick(seed)` by default, so the color page needs no edit: the seed plus its 3 nearest Learn-layer names, in sentence case, straight into Study, with a quiet "Adjust" link to today's sheet. It ends "4 climbed · back tomorrow", runs `flyToMap()` and returns to the page. The direct `hmLearnIt` callers (swatch, namer, names) route through it. *Cuts* the form before every lesson. *Test:* Learn it on Teal shows a question within 1 s, and Teal is due tomorrow on You.

**2. Constellations become the map's subject.** A lit set gets a solid bar: source thumbnail and title, ‹ back to the source (scroll kept), Learn these (`lsQuick` on the lit set), Find them (Study the map on it), ✕. `tlNote` keeps the stack when `csOnMap` opens Home. Home's study seed is the lit set, else the unknown colors near the center, never Grey. *Cuts* the dead-end pill. *Test:* The Milkmaid → On the map → ‹ lands on the painting at the same scroll.

**3. One Today.** `todayPick()` returns `{color, painting, board}`: a color from the ~1,000 core names (weighted to ones with an article or painting) and the painting where it's most distinctive. `dailyColor`, `dnTarget`, `dpLoad` and the Museum covers all read it; Learn shows one card ("Today · Teal, in *View of Delft*"); the Ideas and World lines derive from it or go. *Cuts* seven "todays". *Test:* Learn, Train, Museum and the rooms menu name the same color and painting.

**4. Train room rebuild.** Top to bottom: the Today row (item 3's parts; reads the old dailies until it lands), one line for your weakest eye cell ("Hue in yellows · 3 rounds?"), 5 game tiles with a personal meta ("Level 13"), 3 drill rows that open shelves, then Your eye with a one-sentence empty state. The questionnaire wall goes (its two questions move to Settings). *Cuts* 31 entries to about 12. *Test:* at 440×956, Today through the drill rows fits one screen.

**5. Paintings lead with their best colors.** Distinctive-first palette (chroma × rarity for this painter × contrast), with "by area" as the second tab; the primary name is always a Learn-layer name ("between X and Y" drops to the subline); accents, hidden and focal move above the bars; the image is full width at 440; More like this matches accents with near-blacks excluded. *Cuts* "Dark black 36%" as the lead. *Test:* on `#/gallery/12` the first chips are the lace, the flesh and the accent.

**6. Across the line clicks.** An anchor chip of the category's swatch; rounds drawn only when the odd tile's nearest-name margin is 30%+; category words from your Learn words; a miss says "In ColorHub's map this side is *petrol*"; the reveal offers "Add *petrol* to your words"; answers logged with names. *Test:* 8 rounds with no answer David disputes.

### Wave 2: the spine (M each, mostly sequential)

- **Home corner, view label, search that answers** *(D1, D2; mockup first).* The one corner and arc from section 2; a 2-second view label ("Stage 3 · 100 colors"); search shows result rows instead of filtering the map, with Recent (from the trail) when empty; rename to "Map". Files: `home.js`, `core.js` (NAV_MAP), `menus2.css`, `practice.css`, `router.js`. Test: two corners on Home; "dusty pink" shows rows.
- **One ladder and "Next door".** `HM_STAGES` + Every name is the only ladder, defaulting to your placement stage; a "Next door" view from `edgeOfMap()`; the Show filter reads `knowState`. Files: `home.js`, `learner.js`, `learnset.js`; coordinate with MAP-STUDY-2 on `mapstudy.js`.
- **The path and Learn it on one engine.** A unit's Start runs `lsStudy` with "meet" as level −1 and Edges for look-alike sets; `learnit.js` retires. Files: `learn.js`, `learnmore.js`, `learnset.js`, `learnit.js`. Test: a day-one lesson has picks, not only swipes.
- **The Learn room as a Today stack, with Your sets** *(D3).* Due cards grouped by Set → your open Set (resumable) → the next path Set → Your sets (Due · Tricky · Mix-ups · saved). One streak that counts reviews. Removes the stage rows, the 655-square grid, Settings and the Practice row. Files: `learn.js`, `practice.js` (`prHome`), `challenge.js` (`chStreak`).
- **One Learner Model writer, one number.** Every engine calls `lmAnswer()`; "N yours · M on the way" reads the same everywhere; mapstudy's copy of `prApply` goes. Files: `learner.js`, `practice.js`, `you.js`.
- **Coverage on things (S–M).** `setCoverage(hexes)` gives "You can name 4 of 6" and a ring on painting, painter, look and palette pages; a tap learns the rest. Files: new `coverage.js`, one hook per page.
- **`thingQuiz` (Name it / Find it)** on paintings and Today's painting *(mockup first).* Three rounds per painting, each logged, then "Learn these 3". Files: new `thingquiz.js`, `gallery.js`, `challenge.js`.
- **One eye page, an honest check-in.** Merge the two eye pages; a fixed-seed weekly board on the same 1–20 ladder. Files: `challenge.js`, `games/oo-ui.js`, `gym-engine.js`.

### Wave 3: depth and delight (mockups first)

- **One color page (`colorDossier`, L):** its own story first, five drawers, the walk, then one "Names and codes" drawer.
- **The painting page as an instrument (L, CORS risk):** full-bleed image, the loupe, thingQuiz as its spine.
- **Train merges (M each):** Painter's eye (Finish the palette + Whose painter, famous first); Color memory (one ladder, boards from today's painting); Gradients absorbs Out of order and Rebuild.
- **Painter pages with a personality (M):** shared darks hidden, palettes as triptychs, a scrubbable barcode.
- **Design history (S–M):** an "In design" drawer and the essay "When color got loud".
- **One wheel (M):** Harmony folds into the Gamut wheel, Albers moves to Train, Studio becomes Capture / Name / Build.
- **Moments:** map dares, the overnight fill, "settled" mix-ups, the daily first arrival on the map, and a honeycomb welcome instead of the chip wall (the signature object, X25).
- **Launch (M):** bundle the 90 scripts into 3 files.

## 5. Already being fixed (dispatched; not in the waves)

- **Study:** saves progress (schedules at the end, keeps the Set, "climbed" wording, Keep going resumes) and picks smarter sets (unknown first, spread by ΔE).
- **Train bugs:** perceptual misses no longer pollute mix-ups; no color-note sound leak in ordering games; honest results and stars per game; Gradients' locks removed.
- **Home:** the trail (resume pill, one-step pull-down, no blank rows); instant taps (no 220 ms wait); the View sheet cleanup; icons (the two-hexagon clash).
- **Journey:** launch speed (cache-first `?v=`, non-blocking fonts), drafts hidden from readers, the 404 probes, the lead fact on color pages, "New" labels, Museum Art's default order.
- **Pages:** every `#/name/` address resolves; Red's cover (year, definition, its own story); chords without same-color pairs; Looks named from the Learn layer.

## 6. Six decisions for David

1. **Call the honeycomb "Map" everywhere** (stem, trail, address)? **Yes.** It ends the Explore/Museum confusion.
2. **One right corner on Home:** a due count that opens a labeled arc (Recall · Learn these · Find them · Search · Favorites · View), replacing the four round buttons? **Yes, after you approve a mockup.**
3. **Practice stops being a destination** and becomes "Your sets" inside the Learn room, with the deck builder behind "Adjust"? **Yes.**
4. **Train shrinks to 5 games plus 3 drill rows.** Study the map moves to the map, Lightning becomes Study's boss round, and Imposter, n-back, Out of order, Rebuild and the Today's gradient tile leave the grid (the code stays). **Yes.** Play it for a day before anything is deleted.
5. **One Today:** a color, a painting that holds it, and a short Look → Learn → Recall → Find ritual, quoted by every room and fully skippable? **Yes.**
6. **Keep "percent"** for color differences rather than switching to "steps"? **Keep percent.** It's plain and already everywhere; only fix the leftover "units".

## Decisions made (2026-10-08)
David delegated the big calls ("hard for me to decide"). The conductor took all six recommendations above. David can veto any of them.
- The honeycomb is called **Map** everywhere.
- **One right corner** on Home, with a mockup first.
- Practice becomes **Your sets** in the Learn room.
- **Train shrinks to 5 games and 3 drill rows.** David plays it for a day before any code is deleted.
- **One Today.**
- Color differences keep **percent**.
