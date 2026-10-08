# The plan: one loop, fewer doors (2026-10-08)

This plan combines the five reviews in this folder (home-map-nav, learning, train, pages-museum-studio, journey). The reviews hold the detail and the file:line evidence. This file holds the decisions. Study the map is being redesigned in its own lane (worktree agent-a8a8731e, `design/MAP-STUDY-2.md` there); anything here that touches it defers to that lane.

## 1. The thesis

1. **Every thing is a Set:** a handful of named colors with a source (a painting, painter, look, photo, today, a map region, a mix-up pair).
2. **The loop is Look → Learn → Recall → Find.** Look at the thing and guess before you're told; Learn its names in one engine that starts at once; Recall them tomorrow, with the source attached; Find them in a new thing, on the map or through the camera. (This joins journey's Meet/Name/Prove/Find, pages' Look/Guess/Compare, which is Look done well, and learning's "the thing comes back". Train sits beside the loop and sharpens the eye that Find needs.)
3. **One of each:** one Set object, one learning engine, one Learner Model writer, one Today, one ladder, one progress number, one name per concept.
4. **Start, don't configure; guess before reveal.** Every primary button starts something within a second, options sit one link deep ("Adjust"), and things are instruments, not reports.
5. **Everything lands on the map** as views and events, never marks or dimming (X7). The cut test: if a screen can't say which step of the loop it serves, it's cut or merged.

## 2. Conflicts between the reviews, and my call

| Conflict | My call |
|---|---|
| **What the map is called.** It's "Explore" in the stem and the trail, while the Museum still uses `#/explore`. | **"Map"** everywhere. `#/home` and `#/explore` stay as aliases. In Art, "Rooms · ways in" becomes "Collections". *(decision 1)* |
| **Home corners.** Home-map wants a labeled Do arc; journey wants one corner that shows the due count. | **Both, in one corner.** Rooms stays on the left. One right corner shows a small count when reviews are due, and tapping it opens a labeled arc: Recall N (only when due) · Learn these · Find them · Search · Favorites · View. This removes the hexagon, the cards, the heart and the magnifier row. *(decision 2; glance mockup)* |
| **What happens to Practice.** Learning wants a "Your sets" shelf; journey wants it merged into Learn. | **Practice stops being a place.** "Your sets" (smart sets plus saved Sets) becomes one section of the Learn room. The 7-row builder survives only behind the sheet's "Adjust". `PR_METHODS.learn` is deleted. *(decision 3)* |
| **Learn it.** Learning wants it merged into Study; journey wants an instant 4-color lesson. | **Both.** "Learn it" = `lsQuick(seed)`: the color plus its 3 closest Learn-layer neighbors, starting immediately, about 90 s, scheduled at the end. `learnit.js` retires once Edges is a Study step. |
| **What Train keeps.** The train review keeps 7 tiles; journey moves Study the map out of Train. | **5 eye games, plus Study the map, plus 3 drill rows:** Odd one out, Gradients, Across the line, Painter's eye, Color memory, and Study the map. David calls Study the map "one of the most genius features in Train" (MAP-STUDY-2), so it stays a Train tile *and* is the map's "Find them" verb, on one engine. Lightning becomes Study's boss round. Imposter, n-back, Out of order, Rebuild and the Today's gradient tile come off the grid; their code stays. *(decision 4)* |
| **"Today."** Train wants a row of three dailies; journey wants one object. | **One `todayPick()`: a color, a painting that holds it, and a board.** Each room quotes it. Train's Today row shows that same object's three parts (Look, Name it in six, the board), each with a tick. *(decision 5)* |
| **The painting page.** Pages wants the loupe and a guess; journey wants "Find the colors"; train wants "Finish the palette". | **One `thingQuiz` component** with two round kinds. *Name it:* a region is shown and you pick one of three same-family names. *Find it:* a name is shown and you tap where it lives. Finish the palette lives in Painter's eye. The loupe comes later (Wave 3). |
| **The difference unit.** Pages calls "units" a violation of the percent rule; journey wants "steps". | **Keep percent.** It's already everywhere and it's plain. Fix the leftover "units". *(decision 6)* |
| **The progress words.** | **Yours** = recalled on a later day. **Climbed** = done in a session (replaces "mastered"). **Favorites** = hearted, with one home on You. |

## 3. Skeptic pass: how this plan fails

1. **A review avalanche.** Every Set schedules, so a day-one binge means 60 cards on day two. *Guard:* at most 20 new cards a day (the rest wait in their Set as "Next up"); a right first try goes to box 2.
2. **Merging engines breaks saves and the path.** *Guard:* the swipe deck stays as the review surface; the path moves onto Study only in Wave 2, after "Study schedules" is proven on the phone; a `migrateState` step; `S.cards` semantics untouched.
3. **The new corner is another hidden menu.** *Guard:* mockup first; every capsule says what it acts on ("Learn these · 6 from The Milkmaid"); the count shows only when reviews are due.
4. **The Today ritual becomes a chore.** *Guard:* every step skippable, a "just the board" tap, the thing type rotates by weekday, and it never gates the map or the rooms.
5. **Guess-before-reveal nags people who just browse.** *Guard:* one quiet secondary button, never forced; "show me" is one tap; the Museum stays a pure browse.
6. **Find it on varnished, low-res images feels unfair.** *Guard:* only distinctive colors with 2%+ area and a confident mask; generous tolerance; "as photographed" once; a miss shows the region, never scolds.
7. **The cuts remove something someone loved.** *Guard:* games leave the grid but the code stays; Lightning lives on as the boss round; David plays the new Train for a day before any deletion.
8. **Parallel lanes collide.** *Guard:* each lane owns its files and the hot-file list is enforced (Wave 1); only the conductor edits `index.html` and bumps `?v=`; new code goes in new files when a shared file is hot; `tools/smoke.sh` and colorhub-verify after every merge.

## 4. The roadmap

### Wave 1: start now, in parallel worktrees

**Ground rules for every Wave 1 lane:**
- Branch from current `main`. Touch only the files your lane owns. You may *call* any function, but don't edit another lane's files.
- Each new file needs a `<script>` or `<link>` tag. Don't edit `index.html`: list the tag in your report, and the conductor adds it and bumps `?v=` at merge.
- Add smoke scenarios as one new `scenario("<lane>", …)` block at the very end of `tools/smoke/scenarios.js`. The conductor resolves the append-only conflicts.
- Guard a cross-lane dependency with `typeof fn === "function"`, so each lane ships alone.
- Run `colorhub-verify` before reporting, with screenshots at 440×956 and 375×812.

**Hot files: off-limits until their lane merges.** These are the six dispatched lanes, read from their worktrees:
- **Home quick fixes:** `home.js`, `honey.js`, `trail.js`, `colorset.js`, `home.css`, `practice.css`.
- **Study saves:** `learnset.js`, `practice.js`, `colordle.js`, `core.js`, `namer.js`, `swatch.js`, `learnset.css`.
- **Train bugs:** `games/oo-ui.js`, `games/hue-ui.js`, `games/line.js`, `games/oo-mix.js`, `games/pairs.js`, `gym.js`, `learner.js`, `sound.js`.
- **Pages quick fixes:** `richpage.js`, `router.js`, `artwiki.js`, `chords.js`, `labs.js`, `paintingsof.js`.
- **Journey quick fixes:** `index.html`, `sw.js`, `article.js`, `browse*.js`, `rooms2.js`.
- **MAP-STUDY-2:** `mapstudy.js`, `mapstudy.css`.

Before Lane A starts, the conductor confirms that the `l26-color-in-paintings` worktree (which has uncommitted edits to `gallery.js`, `explore.js`, `names.js` and `router.js`) is merged or dead.

#### Wave 1a: four lanes that can start this minute

| Lane | Item | Owns | Size |
|---|---|---|---|
| A | The painting page leads with its best colors, plus the Name it / Find it quiz | `gallery.js`, new `thingquiz.js`, new `css/thingquiz.css` | M |
| B | One Today | new `today.js`, `graph.js`, `challenge.js`, `explore.js` | S–M |
| C | The Learn room, decluttered | `learn.js`, `learnmore.js` | S–M |
| D | Coverage, and a You page that acts | new `coverage.js`, `you.js` | S–M |

**A. The painting page.**
- **The palette** in `glPage` defaults to distinctive-first: score = chroma × (1 − this painter's mean share of the hue) × ΔE from the painting's mean, then fill by area. "By area" becomes the second tab.
- **Names:** the chip's primary name is the nearest Learn-layer name; "between X and Y" moves to the subline.
- **Layout:** accents, hidden and focal sit above the bars, and the image is full width at 440.
- **More like this** matches on the accent palette, with colors at L\* < 20 excluded.
- **`thingquiz.js` exports `thingQuiz(host, {img, regions, colors, src})`:** three rounds per painting.
  - Two *Name it* rounds: a region pulses and you pick from three same-family names.
  - One *Find it* round: a name is shown and you tap the image. The tap is checked against the L26 per-painting color mask, with a tolerance of 1 cell.
  - Each answer calls `learnerLog`. The end offers "Learn these 3" via `prQuick`.
  - It's mounted as one quiet "Name its colors" button under the image, never forced.
- **Test:** on `#/gallery/12`, the first chips are the lace, the flesh and the accent; the quiz runs three rounds and logs them.
- *Glance mockup:* the first screen of the painting page.

**B. One Today.**
- **`today.js` exports `todayPick(dayKey)` → `{color, painting, board}`.** It's seeded by the date.
  - The color comes from the ~1,000 core names, weighted ×3 for names with an article and ×2 for names with an L26 painting at 2%+ share.
  - The painting is the one where that color is most distinctive.
  - The board is `{seed: color.hex, painting: painting.id}`.
- **Who reads it:** `dailyColor()` (graph.js) returns `todayPick().color`; `dpLoad()` (challenge.js) uses `todayPick().painting`; the Museum covers in `explore.js` (around lines 188–224) quote both, and the Ideas and World "Today" lines are dropped.
- **Follow-ups:** after Study saves merges, the conductor makes a one-line change so `dnTarget` (colordle.js) reads it. Lanes C and G read it behind a `typeof` guard.
- **Test:** the Museum, the rooms menu and Today's painting all name the same color and painting.

**C. The Learn room, decluttered.**
- **Placement** ends on the map (`learn.js:304` calls `hmHome()`; it doesn't edit it) and sets a first-run flag for a one-line "Tap any color" hint.
- **Remove:** "Settings & more", the six stage rows and the 655-square grid. In their place, one progress bar with the next stop named, plus "See them on the map".
- **Cut copy:** "and N more units to 101 words" (`learnmore.js:485`), and the stale "⋯ menu" line (`learn.js:44`).
- **Today:** the two Today rows become one card from `todayPick()`, falling back to the current pair.
- **Test:** after placement you land on the map; the day-one Learn room has 5 blocks or fewer.

**D. Coverage, and a You page that acts.**
- **`coverage.js` exports `setCoverage(hexes)` → `{yours, learning, none, total}`** via `knowState`, and `coverageRing(cov)` → an SVG ring.
- **On `you.js`:**
  - "to recall today" is tappable and starts the review;
  - each mix-up gets **Untangle** (`prQuick` on the pair plus its nearest third);
  - the hero count is fixed (it showed "–1");
  - a "You can name" strip of saved Sets and paintings, each with its ring.
- Wave 1b and Wave 2 mount the ring on painting, painter and look pages.
- **Test:** You → Untangle on a pair starts a 3-color lesson.

#### Wave 1b: start the moment the named lane merges

| Lane | Item | Waits for | Owns | Size |
|---|---|---|---|---|
| E | Learn it starts now | Study saves | `learnset.js` (add `lsQuick`), `practice.js` (`prQuick`), `swatch.js`, `namer.js`, `names.js`, `colordle.js` (the `dnTarget` line) | S |
| F | Constellations become the map's subject | Home quick fixes, MAP-STUDY-2 | `honey.js`, `trail.js`, `colorset.js`, `home.js` | M |
| G | Train room rebuild | Journey quick fixes, Train bugs | `rooms2.js`, `core.js` (the questionnaire wall only) | S–M |
| H | Across the line clicks | Train bugs | `games/line.js`, `games/oo-engine.js` (`ooLineRound`), `eye-names.js` | M |

**E. Learn it starts now.**
- `prQuick(seed)` calls `lsQuick(seed)`: the seed plus its 3 nearest Learn-layer names (sentence case), straight into Study, with a quiet "Adjust" link that opens the current sheet.
- It ends with "4 climbed · back tomorrow", then `flyToMap()`, then a return to the page.
- `hmLearnIt` callers route through it.
- **Test:** Learn it on Teal shows a question within 1 s, and Teal is due tomorrow.

**F. Constellations become the map's subject.**
- The pill becomes a bar: the source thumbnail and title, ‹ back to the source (scroll kept), Learn these (`lsQuick` on the lit set), Find them (Study the map on the lit set), ✕.
- `tlNote` keeps the stack when `csOnMap` opens Home.
- The study seed is the lit set, else the unknown colors near the center, never Grey.
- **Test:** The Milkmaid → On the map → ‹ lands on the painting.

**G. Train room rebuild.**
- **Order, top to bottom:**
  - the Today row (`todayPick()`'s painting, color and board, each with a tick);
  - one weak-spot line;
  - 6 tiles: Odd one out, Gradients, Study the map, Across the line, Painter's eye, Color memory. The last two open the existing Whose palette? and What changed? until Wave 3 merges them;
  - 3 drill rows that each open a shelf;
  - Your eye, with a one-sentence empty state.
- **The questionnaire wall** is removed from `core.js`.
- *Glance mockup.*
- **Test:** at 440×956, Today through the drills fits one screen.

**H. Across the line clicks.**
- An anchor chip of the category's swatch.
- A round is drawn only when the odd tile's nearest-name margin is at least 30%.
- Category words come from your Learn words.
- Honest copy on a miss: "In ColorHub's map this side is *petrol*".
- The reveal offers "Add *petrol* to your words".
- Answers are logged with names.
- **Test:** 8 rounds with no answer David disputes.

### Wave 2: the spine (M each, mostly sequential)

- **Home corner, view label, search that answers** *(decisions 1 and 2; glance mockup).* The one corner and arc from section 2; a 2-second view label ("Stage 3 · 100 colors"); search shows result rows instead of filtering the map, with Recent (from the trail) when empty; rename to "Map". Files: `home.js`, `core.js` (NAV_MAP), `menus2.css`, `practice.css`, `router.js`. Test: two corners on Home; "dusty pink" shows rows.
- **One ladder and "Next door".** `HM_STAGES` + Every name is the only ladder, defaulting to your placement stage; a "Next door" view from `edgeOfMap()`; the Show filter reads `knowState`. Files: `home.js`, `learner.js`, `learnset.js`; coordinate with MAP-STUDY-2 on `mapstudy.js`.
- **The path and Learn it on one engine.** A unit's Start runs `lsStudy` with "meet" as level −1 and Edges for look-alike sets; `learnit.js` retires. Files: `learn.js`, `learnmore.js`, `learnset.js`, `learnit.js`. Test: a day-one lesson has picks, not only swipes.
- **The Learn room as a Today stack, with Your sets.** Due cards grouped by Set → your open Set (resumable) → the next path Set → Your sets (Due · Tricky · Mix-ups · saved) *(decision 3)*. One streak that counts reviews. Removes the Practice row (Lane C already removed the stage rows, the grid and Settings). Files: `learn.js`, `practice.js` (`prHome`), `challenge.js` (`chStreak`).
- **One Learner Model writer, one number.** Every engine calls `lmAnswer()`; "N yours · M on the way" reads the same everywhere; mapstudy's copy of `prApply` goes. Files: `learner.js`, `practice.js`, `you.js`.
- **Coverage rings on things (S).** Mount `coverageRing` (from Lane D) with "You can name 4 of 6" on the painting, painter, look and palette pages; a tap learns the rest. Put the thingQuiz (from Lane A) on Today's painting, garments and looks.
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

## 6. Decisions made (David can veto)

David delegated these calls. Each one stands unless he vetoes it. Anything that changes how the app looks or feels at first glance gets a quick mockup for him to glance at before it ships. A mockup is not a question.

1. **The honeycomb is called "Map" everywhere** (the stem, the trail, `#/map`, with the old addresses kept as aliases). Three names for two places is the biggest confusion new users hit.
2. **Home has one right corner:** a due count that opens a labeled arc (Recall · Learn these · Find them · Search · Favorites · View), replacing the four round buttons. Labeled verbs are quieter than four mystery icons. *Glance mockup first.*
3. **Practice stops being a place** and becomes "Your sets" in the Learn room, with the builder behind "Adjust". It was a third learning engine, and nobody could tell whether it counted.
4. **Train is 5 eye games, plus Study the map, plus 3 drill rows.** Lightning becomes Study's boss round, and Imposter, n-back, Out of order, Rebuild and the Today's gradient tile leave the grid. The code stays until David has played the new room for a day. Thirty-one entries hide the four that are great. *Glance mockup first.*
5. **One Today:** one color, one painting that holds it and one board, quoted by every room. The ritual is fully skippable. Two "colors of the day" on one day is a bug of meaning.
6. **Color differences keep percent** (the leftover "units" get fixed). It's plain, and it's already everywhere.
7. **"Yours" means recalled on a later day, "climbed" means done in a session, "Favorites" means hearted.** One word per concept ends the six counters that disagree.
