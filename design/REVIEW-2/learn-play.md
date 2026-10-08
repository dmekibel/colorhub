# Review 2: every learning and play screen (2026-10-08)

**Method.** I read DAVID-MODEL (the rubric, the personas and P22), IMPROVE learning.md and train.md, and PLAN.md. I rendered 50 states of current `main` at 440x956, and the key ones again at 375x812, through `tools/_qa/frame.html`. The states cover lx, ls, pr, gx, oo, hue, dl and you.

Each screen got the 12-question critic (failures are cited as "Q4" and so on) and a pre-mortem. I took from other apps only what fits "see the world through color", and every borrowed idea **replaces or merges** something, so screens get shorter.

**What's already landed.** Study now schedules and says "climbed". The sheet picks the colors you can't name yet. You has Untangle. Across has an anchor chip. Today's painting is one object, and the big miss compare exists.

**Still open on main.**
- The Train room is still 16 tiles, and Practice is still the builder.
- Study's first question is still a blind 4-way guess (`lsKindFor`: level 0 is `quiz-name`).
- There are still two eye pages.
- The miss compare can read "Butterscotch and Butterscotch are almost the same color" (`misscompare.js` `mcLine` at level 12, when both colors get the same name).

**Not borrowed, on purpose:**
- XP;
- leagues and leaderboards;
- hearts or lives;
- badges for their own sake;
- guilt notifications;
- random-time pings (BeReal);
- loot boxes.

All of them are fake progress, and the learning KB rules them out.

---

## Part 1: screen by screen

### Learn

**1. Welcome and placement (`welcome`, `how`).**
- **Verdict: almost.**
  - The grid hero is static, and after it comes a second "How it works" screen with three numbered rows before you play anything.
  - Fails Q5 (removable text) and Q11 (teach by showing).
- **Pre-mortem:** people bounce on the explainer.
- **Borrow:** Wordle (play first, never explain). The welcome *is* the first placement card: "Teal: tap its color". The rules are learned by doing. **Replaces** the `how()` screen and the pitch paragraph.

**2. The Learn room.**
- **Verdict: almost, and much calmer since lane C.**
  - What works: the primary card, a lovely Today card (the Milkmaid with today's color as a chip), then "Your words".
  - But "Practice · Make your own deck" still sounds like homework. Studied sets don't come back here.
  - The rooms button sits over the "Your words" bar at 440.
- **Pre-mortem:** the screen never changes, so people stop reading it.
- **Borrow:** Apple Wallet's stacked cards. The Today stack is one pile, with the most urgent card in front:
  1. "The Milkmaid · 4 to recall"
  2. an open set you didn't finish
  3. the next unit
  4. the dailies

  Tap to fan the pile. It **replaces** the separate primary card, the Practice row and the Today card, which become cards in the stack.

**3. Meet the unit (fan cover + vertical pager).**
- **Verdict:** the cover hits. The step misses: it's passive swipe-up reading, and the neighbor shown isn't one from this unit.
- **Borrow:** Instagram Stories. Tap the right side to advance, segmented progress at the top, hold to pause.
  - Each story is one big color with its name and its difference from the color before it.
  - It runs *inside* Study as level −1 (see Top 10 #3).
  - It **replaces** the "Swipe up to meet them" pager and its separate screen.

**4. The swipe deck (lesson and review).**
- **Verdict:** it hits as feel, and it's the Tinder transplant done right. As a lesson it's honor-system only.
- **Keep it as the review surface only.** Lessons move to Study (PLAN decision).
- **Small borrow:** Tinder's rewind. One undo for a mis-swipe, shown as a quiet ↺ after a swipe. It **replaces** nothing, but it costs only one control and kills the most common annoyance.

**5. Unit done, Review done, Study results, Learn it done.**
- **Verdict:** four different "done" screens:
  - a grid with a paragraph;
  - a black void with 7/9 and 99;
  - a 2x2 stat grid with ring chips and pairs;
  - a list of 4 with a bet.

  "Yours = …" and "Swipes are practice" repeat on each one. Fails Q3, Q5 and Q12 (one system).
- **Borrow:** Strava's activity card plus Spotify Wrapped's one-big-fact. One shared end card has four parts:
  1. the session's colors as big named tiles;
  2. one headline number ("6 of 8 first try");
  3. the Bet on tomorrow;
  4. one CTA.

  "Pairs you mixed up" sits one tap down. It **replaces** all four layouts, and the footnotes appear once in About.

**6. The Learn sheet (`lsOpen`).**
- **Verdict: almost.**
  - The live preview and the "How close" slider are great (P12).
  - But it still asks before it plays: Look and Study, a checkbox and a "Just one way" rail that's clipped at both 375 and 440 ("Odd o…").
  - Fails Q13 (convenience) and P4 (start, don't configure).
- **Borrow:** Spotify's "Play" button over a playlist. Tapping Learn anywhere *starts* Study within a second (`lsQuick`). The sheet becomes "Adjust" behind a link. It **replaces** the rail, the checkbox and the Look/Study fork (Look becomes the first card of the session; see 7).

**7. Look (6 tabs).**
- **Verdict: hits** for depth, but six tabs overflow at 440 ("Carousel" is cut off).
- **Curate to 3:** Grid, Pairs (closest first) and Paintings.
  - Strip is just a Grid sort.
  - Map already exists as "On the map".
  - Carousel is the new Stories meet.
- **Borrow:** Apple Photos' pinch-to-change grid density (pinch out on Grid to see the pairs). Optional; the cut is what matters.

**8. Study, the session.**
- **Verdict:** the best learning surface. The big side-by-side on a wrong answer (`#lsshot=study:wrong`) is exactly P8.
- **Two problems:**
  1. **Blind first guess.** Level 0 is a 4-way name guess, so the first time you meet "Skobeloff green" you meet it as a wrong answer.
  2. **Crowded header.** It shows "0 of 8 climbed · 3 getting there", plus "5 in a row", plus a pill, plus a 2-line grey explainer on every question (Q5).
- **Borrow, part 1:** Duolingo's new-word card (picture plus word, shown once, before the first test). That's the Stories meet from #3.
- **Borrow, part 2:** Duolingo's single progress bar that *is* the state.
  - The per-color segments already exist. Drop both text lines and keep only the combo pill when it's 3 or more.
  - It **replaces** the explainer and the two counters.

**9. Learn it (meet → recall → edges → done).**
- **Verdict:** it hits as a lesson, but the cover is a grey void with a small strip at the bottom (`lx:learnit`). Fails Q2.
- **Edges** ("Tap the last one you'd still call chestnut") is the *same skill* as Across the line, built twice.
- **Merge:** Learn it = `lsQuick` (already planned), and Edges becomes one shared component with Across (see 15).

**10. Practice (`prHome`).**
- **Verdict: misses.** Seven chip rows before Start, and the rows overflow at the right edge. Fails Q5, Q10 and Q13.
- **Borrow:** Apple Music's "Made for You" smart playlists. The shelf holds:
  - smart sets: Due, Tricky, Mix-ups, Today's misses;
  - your kept sets, with coverage rings;
  - First 50/100/250.

  One tap = Study. It **replaces** the whole builder (the builder lives on behind "Adjust").

**11. You (progress).**
- **Verdict: almost.**
  - Good: "18 colors yours", the week dots, mix-ups with Untangle.
  - But the hero is a decorative rainbow bar (Q7: whose colors?), and the empty state is a wall of rows.
- **Borrow:** a Pokédex or collection book with Apple Fitness rings. "You can name" is a shelf of the *things* you studied, each with a coverage ring ("The Milkmaid 5/6").
  - It **replaces** the rainbow hero bar.
  - The empty state becomes one ghosted shelf ("Your first painting goes here").

### Play

**12. The Train room.**
- **Verdict: misses as built.**
  - 16 identical tiles, 12 of them "New".
  - The rooms button covers "Color n-back".
  - The dailies hide behind the grid.
  - It fails Q2, Q3 and Q6, and P22 above all.
- **Borrow:** the NYT Games home screen.
  - Today's puzzles sit as cards at the top, with done-ticks and a streak.
  - The games sit below as a short, quiet list with your personal meta.
- It **replaces** 9 tiles (see the CUT list), the "New" tags and the separate daily tiles.

**13. Odd one out map.**
- **Verdict: almost.** The ladder is honest, but it's a 20-row list under two italic explainer lines and a "Your eye" line. Fails Q5.
- **Borrow:** Duolingo's checkpoint path. Show *your band*: the level you've cleared, the next one and one stretch level, big. "All 20 levels" sits behind a link.
- It **replaces** the explainer lines and the wall of rows. "Play level 13" stays the single CTA.

**14. Odd one out round and miss compare.**
- **Verdict:** the board hits; the miss compare almost does.
  - It's full screen and side by side (P8 solved).
  - But both halves say "Butterscotch", the sentence says "Butterscotch and Butterscotch are almost the same color", and the labels are mono ALL-CAPS ("YOU PICKED / THE ODD ONE"). That's the shouting-mono-label rule.
- **Borrow:** a photo editor's before/after split with a draggable divider. Drag across the seam to feel a 1.7% gap.
- **Copy:** "Both are butterscotch. This difference has no word, yet." When the two cross a Learn word: "You just saw the edge between teal and petrol."
- It **replaces** the caps labels, the duplicated names and the sentence.

**15. Across the line.**
- **Verdict: almost, and the most ColorHub game.**
- But the intro screen is three lines of instructions, plus For you/Choose, plus a lone button, with **half the screen empty black** (Q2, Q5). The shot harness never advanced past the intro, so round states need a device check.
- **Borrow:** Wordle's "the board is the instructions". The intro shows a live sample board, already playable.
- **Merge:** Learn it's Edges strip becomes Across's second round type ("drag to where *teal* ends", a slider: P12). The color page gets "Where does it end?". That gives one edge engine, not two.

**16. Gradients.**
- **Verdict: hits.** The painter worlds are lovely.
- **Leftovers:** For you still says "Levels open one by one" (gates). The sound leak on unsolved tiles needs checking against the Train-bugs lane.
- **Borrow:** I Love Hue's solve moment, plus Monument Valley's resolve. The finished board plays as an arpeggio by lightness, then dissolves into the painting it came from. It **replaces** the static "solved" state.

**17. Whose palette? and Painters' pairs.**
- **Verdict: misses / almost.**
  - Whose: five near-black chips against Xugu, Paul Signac and Jacopo Bassano strips.
  - Pairs: "Ash with sky blue, or hunter green with mustard?" is a coin flip, then a fact. Fails Q11 (it doesn't teach before it tests).
- **Borrow:** GeoGuessr, from outside education. You guess from a picture and get partial credit by distance.
  - **Painter's eye:** a crop of a famous painting, plus its colors. You pick from 3 thumbnails of famous painters.
  - The score is partial: right movement, close decade.
  - The reveal states the signature in one sentence.
- It **replaces** both tiles and the strip UI.

**18. What changed? and Was it there?**
- **Verdict: almost.** "Which tile changed?" shows nine unrelated colors, which are soulless by design.
- **Borrow:** Apple Photos "Memories" resurfacing. One Color memory game whose boards come from what *you* looked at today ("The Milkmaid's apron was…").
- It **replaces** two tiles with one.

**19. Lightning, Imposter, n-back, Out of order, Rebuild and the Today's gradient tile.**
- **Verdict: cut from the grid.**
  - Lightning becomes Study's boss round.
  - Out of order and Rebuild become Gradients' warm-up and Blind modes.
  - Imposter becomes a question type.
  - n-back goes (brain-training, no color value).

**20. Study the map, the setup sheet.**
- **Verdict:** the game is a jewel (David's word: "genius"). The sheet is a cockpit: 5 modes × 7 level chips × 5 color sources × difficulty before Start. Fails P4 (start, don't configure).
- **Borrow:** Spotify DJ. One Start that picks the mode and level for you, with "Choose" holding today's sheet.
- It **replaces** the configure-first default.

**21. Today's painting.**
- **Verdict: hits.** It's the North Star: "Where does this color hide?" on the Milkmaid, and the end shows five named chips plus a "lighter than 79% of 1600s paintings" finding.
- **One fix:** the chip captions (Hidden, Focal, Spot, Most canvas, Decade) are jargon. Name the colors instead, with the role in the subline.
- **Borrow:** nothing. The Wordle share grid is already there.

**22. Colordle (Today's color).**
- **Verdict: hits.**
  - "Named in four" lists each guess with % and direction chips, which is honest and teaches.
  - The input screen has 40% dead grey under the field (Q2).
- **Borrow:** search-style autocomplete chips after 2 letters, from the ~4,300 alternate names. Show your previous guesses as color bars in that space; that's Wordle's board-as-memory.

**23. The results screens (`ooResults`, the gym's "Eyes trained").**
- **Verdict: misses Q4, Q5 and Q12.**
  - `ooResults`: misses as tiny 40 px squares with mono numbers, a CIEDE2000 paragraph, and "your eye at its edge" copy on trivia games.
  - "Eyes trained" next to "Level 13 → 12", with a "New at level" list.
- **Borrow:** Strava's summary. One number (your gap today vs your best), then the misses as a Stories pager of full-screen split compares (see 14).
- The fine print goes behind an "i", and the headline is honest when the level drops ("A harder day. Level 12").
- It merges into the shared end card (5).

**24. Your eye (two pages) and the check-in.**
- **Verdict: misses.**
  - Two pages.
  - `ooEyePage` wraps "lev/el/13" in the value column at 440.
  - The check-in is still the old grey station 3x3.
- **Borrow:** Apple Health "Highlights" plus a GitHub-style heatmap.
  - One sentence finding ("You see blues to 1.2%; yellows are your soft spot").
  - A 9 families × 3 axes grid of cells; tap a cell to play that weak spot.
  - The check-in trend under it.
- It **replaces** both pages and the bar list.

**25. Drills (12).**
- **Verdict: almost.** They're honest staircases in a lab menu.
- **Curate** into three shelves: Light and dark, Color in context, The painter's bench.
- No borrow needed.

---

## Part 2: curated Top 10 (impact ÷ effort)

The test for each one is on David's iPhone (440x956).

**1. Train room as the NYT Games home. Impact: very high · Effort: S.**
- **What:** a Today row (painting, color, board, each ticked), one weak-spot line, then 6 tiles: Study the map, Odd one out, Gradients, Across the line, Painter's eye, Color memory. Then 3 drill shelves, then Your eye.
- **Files:** `js/rooms2.js`.
- **Test:** Today's painting is visible without scrolling, there are no "New" tags, and nothing sits under the rooms button.

**2. Start, don't configure. Impact: very high · Effort: S–M.**
- **What:** "Learn" on any color or set, and Study the map's Start, play within 1 s; the sheets move behind "Adjust" or "Choose". Cut the "Just one way" rail and the checkbox.
- **Files:** `js/learnset.js` (`lsQuick`), `js/practice.js` (`prQuick`), `js/mapstudy.js`.
- **Test:** tap Learn on Teal and a card is on screen in under a second. One tap from Train starts Study the map.

**3. Meet before test (a Stories intro inside Study). Impact: very high · Effort: M.**
- **What:** level −1 is a tap-through card (big color, name, its difference from the previous color) the first time a color with `knowState` none enters play. Path units run on Study, and the meet pager retires; the fan cover stays.
- **Files:** `js/learnset.js` (`lsKindFor`, `lsStudy`), `js/learn.js` (`meet`).
- **Test:** a new name is never first seen inside a 4-way question.

**4. One shared end card. Impact: high · Effort: M.**
- **What:** big named tiles, one number, the Bet, one CTA. Misses sit one tap down. "Yours =" is shown once ever.
- **Files:** a new `js/donecard.js`, used by `learn.js` (`unitDone`, `reviewDone`), `learnset.js` (`lsResults`), `learnit.js`, `games/oo-ui.js` (`ooResults`) and `gym.js` (`finishStation`).
- **Test:** each of the 6 done screens has 2 lines or fewer of grey text, and the "Eyes trained" + level-drop contradiction is gone.

**5. The miss compare as the lesson. Impact: high · Effort: S.**
- **What:**
  - Fix same-name copy: when both names match, say "Both are X; this difference has no word".
  - Make the labels sentence case.
  - Add a draggable split divider.
  - Show results misses as a full-screen pager.
- **Files:** `js/misscompare.js` (`mcLine`, `mcSide`), `js/eye-names.js`, `js/games/oo-ui.js`.
- **Test:** a level-12 miss never reads "X and X". Every miss pair on results is at least 45% of the screen width.

**6. Your sets replaces the Practice builder. Impact: high · Effort: M.**
- **What:** smart sets plus kept sets with rings. The Learn room's row shows the most urgent one.
- **Files:** `js/practice.js` (`prHome`), `js/learn.js`.
- **Test:** the row reads "Tricky · 5", and one tap is a question.

**7. One edge engine: Across the line + Edges. Impact: high · Effort: M.**
- **What:**
  - Across the line gets a second round type, "drag to where *teal* ends", on a strip.
  - Learn it's Edges calls the same component.
  - The intro shows a live board, with no black half.
  - The color page gets "Where does it end?".
- **Files:** `js/games/line.js`, `js/learnit.js` (`hmLtEdge`), the color page hook.
- **Test:** the intro has no empty half-screen, and both doors render the same strip.

**8. Painter's eye (GeoGuessr). Impact: medium-high · Effort: M.**
- **What:** famous-first thumbnails, partial credit by movement and decade, and the signature said in one sentence. It merges Whose palette? and Painters' pairs.
- **Files:** `js/games/oo-mix.js`, `js/games/pairs.js`, the data build.
- **Test:** David gets 4 or more of his first 6 rounds right and can say why.

**9. One Your eye. Impact: medium · Effort: M.**
- **What:** the heatmap of cells you can play, one sentence, and a check-in rebuilt on the Odd one out ladder.
- **Files:** `js/challenge.js` (`eyeReport`), `js/games/oo-ui.js` (`ooEyePage`), `js/gym-engine.js`.
- **Test:** there's one eye page, no "lev/el" wrap at 440, and "level 13" means the same thing everywhere.

**10. The collection shelf with coverage rings. Impact: medium-high · Effort: S** (`coverage.js` exists).
- **What:** "You can name" thing cards on You, replacing the rainbow hero, plus the same ring on painting pages.
- **Files:** `js/you.js`, `js/gallery.js`.
- **Test:** study the Milkmaid's set, recall it tomorrow, and its ring fills on both You and the painting page.

---

## Part 3: CUT list

**Train tiles:**
- Color n-back.
- Imposter.
- Out of order and Rebuild (they become Gradients modes).
- Lightning (it becomes Study's boss round).
- Today's gradient (it moves to the Today row).
- Squint (it moves to the drills).
- Whose palette? and Painters' pairs (they become Painter's eye).
- What changed? and Was it there? (they become Color memory).

**Labels:** "New" tags on played-out rooms, and mono ALL-CAPS labels.

**Learn sheet:**
- the "Just one way" rail;
- the "Ask me to type" checkbox (adaptive decides, and Choose keeps it);
- the Look/Study fork as the default.

**Look:** the Strip, Map and Carousel tabs.

**Practice:** the 7-row builder and `PR_METHODS.learn`.

**Meet:** the vertical pager and "Swipe up to meet them".

**Placement:** the `how()` explainer screen.

**Repeated copy:**
- the "Yours = …" and "Swipes are practice" footnotes on every done screen;
- Study's two header lines;
- the two italic explainer lines on the Odd one out map;
- the CIEDE2000 paragraph on results (it moves behind an "i").

**Eye:** the second eye page and the station check-in.

**Results:** the "Eyes trained." headline on a level drop.

**Caveats:**
- The Across and Mix in-round states and the Study the map round were not reached in headless rendering. Verify them on the device.
- Rendered on 2026-10-08 from `main` at `ebfced64`.
