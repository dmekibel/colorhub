# Improve: the learning loop (2026-10-08)

Reviewer 2 of 5. Area: the Learn room and path (`js/learn.js`, `js/learnmore.js`), placement (`js/pickit.js`), meet → swipe deck, spaced review, Learn it (`js/learnit.js`), the Learn sheet with Look and Study (`js/learnset.js`), Practice (`js/practice.js`), the Learner Model (`js/learner.js`), the You page (`js/you.js`) and streaks (`js/challenge.js`).

Method:
- I read every code path end to end.
- I rendered 16 states headless at 440×956 through `tools/_qa/frame.html`: `#shot=lx:room|unit|deck|done|reviewdone|learnit|ltdone`, `#lsshot=sheet|study|study:wrong|study:match|results|look:grid`, `#prshot=home`, `youPage()` and `#shot=welcome`.
- `#lsshot=look:pairs` failed to render in the harness. Worth a check, though the code looks fine.

---

## 0. The one thing: the mechanic we're dancing around

**What the app keeps reaching for: "learn the colors of anything."**

You can already start learning from a painting, a painter, a palette, a map view, a color page, a look, Colordle's misses or a photo. All of them go through `prQuick` → `lsOpen` (one door, good). But every one of those sessions is a **dead end**:

1. **Nothing is remembered.**
   - Study never puts a color into spaced review. `prRecord` → `prApply` (practice.js:345-353) returns `"none"` for any color without an `S.cards` entry. `lsStudy` never creates one (learnset.js:185-284; compare `hmSchedule`, learnit.js:217-221, and `learnUnit`, core.js:183).
   - So "All 8 *mastered*" after three minutes (`#lsshot=results`) leaves **no trace**. No review tomorrow, no "Yours", and no path progress (`lxUnitDone` needs `S.cards`, learnmore.js:428).
   - That breaks two CLAUDE.md learning rules at once: spaced review across days, and "progress means delayed, unassisted recall".
2. **The thing is forgotten.**
   - The set isn't saved. `ls.best` keeps only a boss time, keyed by the hexes.
   - The Learn room never says "Continue: *The Milkmaid*'s colors".
   - The painting never says "you can name 4 of its 6 colors".
3. **The two engines are inverted.**
   - The *real* path lesson is the thin one: a meet pager, then self-graded swipes (learn.js:92, 246 schedules only in review mode).
   - The *free* Learn sheet has the rich adaptive session (quiz → match → type → boss, combo, graduation), but it counts for nothing.

**What makes it click:** *the thing is the unit, and the thing comes back.*
- Every set you study is a **Set**: the painting, painter, palette, map region, look-alike cluster, or path unit. It goes through one session engine (lsStudy).
- At the end, its colors get review cards, and the set itself is kept, with its source.
- Tomorrow, review brings the *thing* back, not loose names: "*The Milkmaid*: 6 to recall", with the painting as the card back.
- The thing's own page then shows your coverage: "You can name 5 of its 6 colors · 1 to confirm tomorrow".

This is elaborative encoding (a name hooked to a place and a picture), and it makes the whole app the curriculum. The path is simply the app's *suggested* next Set, so path units, Learn it, custom sets and Practice decks all become one object with one engine and one memory.

Everything below hangs off this.

---

## 1. Feature by feature

Each feature gets:
- **Goal**: what it's for.
- **Verdict**: hits, almost or misses, and why.
- **Ideal**: the ideal version, in one sentence.
- **Links**: what it connects to.
- **Skeptic**: a pre-mortem ("a month from now users hate this because…") and the fix.

### 1.1 Learn room (`home()`, learn.js:443-508)
- **Goal:** one obvious next thing today, with your progress visible underneath.
- **Verdict: almost.**
  - The primary card is clean: "Cement, sand & *copper* · Begin".
  - Below it, there are seven stacked blocks:
    - plates;
    - the Today row (two dailies);
    - the Practice row;
    - the path (stage bands);
    - the collection quilt;
    - install and backup cards;
    - Settings (which now duplicates You).
  - Nothing reflects what you studied *elsewhere* in the app.
- **Ideal:** "Today" is one stack. It shows due recalls (grouped by the things they came from), then your open Sets, then the next path Set, then the dailies. The path and collection fold into one "Your words" band that opens the You page.
- **Links:** You page, dailies, Sets (§0), the honeycomb's Learned view.
- **Skeptic:** a month from now users skim past it because it never changes except the title.
  - The painting they studied yesterday isn't there.
  - The streak only counts dailies, not reviews (§1.9).
  - **Fix:** the top card is assembled from *your* things ("The Milkmaid · 6 to recall · then Puce, slate & rust"). Drop Settings from this room (You owns it).

### 1.2 Placement (`how()`, `pickPlace`, `placed()` learn.js:60-307)
- **Goal:** skip what you know, quickly and honestly.
- **Verdict: almost.**
  - It's objective, 60 s, and skipped colors are checked a week later (honest).
  - But it measures recognition only, once. It ends on a tier name ("The designer's vocabulary"), and it can't be replayed to show growth.
  - The welcome copy says "Find my level", and the result is a word you never see again.
- **Ideal:** placement is "Name what you can" (free naming of 12 swatches, IDEAS-10X idea 2). It can be retaken every stage, as a before/after on the same swatches.
- **Links:** the stage exam, the You page ("then vs now"), the Nameable Museum.
- **Skeptic:** a month from now nobody remembers their level, and power users feel the first units are too easy.
  - **Fix:** the result names a *number* ("You named 23 of 40 on sight") that reappears on You, plus "Jump here" test-outs on path rows (JOURNEY §7.3).

### 1.3 Meet the unit (`meet()`, learn.js:312-366)
- **Goal:** first exposure, each name beside its confusable neighbor.
- **Verdict: hits** as a screen (the fan cover is lovely, `#shot=lx:unit`).
- **Misses** as a step, because it's passive scrolling:
  - nothing is recalled;
  - the neighbor shown is the *global* neighbor (`neighbor(c)`), not the one in this unit.
- **Ideal:** meeting is a 1-second card *inside* the session. A new color flashes with its name and its difference from the nearest color already in play, then is asked two questions later.
- **Links:** Study ladder (a level −1 "meet"), Look (Carousel view is the same thing).
- **Skeptic:** a month from now people swipe through meet pages without reading, then guess in the deck.
  - **Fix:** fold meet into Study as level −1, and keep the fan only as the cover.

### 1.4 The swipe deck (`deck("learn"|"review")`, learn.js:89-272)
- **Goal:** fast, thumb-driven recall: "slightly addictive".
- **Verdict: almost.**
  - The feel is excellent: resistance before reveal (line 212), the fly-out, the stamps.
  - But in a lesson it is **self-graded only**, so day one has no objective check and no production.
  - Reviews mix in Pick it / Say it / Make it (good), still mostly swipes.
- **Ideal:** the swipe deck is the *review* surface (fast, many cards). A lesson is the Study ladder.
- **Links:** produce.js and pickit.js cards, `learnerLog` by "swipe".
- **Skeptic:** a month from now users notice that swiping right always "works", so the deck feels like honor-system busywork. David explicitly said "no honor system" (learn.js:65).
  - **Fix:** in reviews, a right swipe on a card not yet confirmed becomes a Pick it 30 % of the time. Show "Swipes are practice" once, not on every done screen.

### 1.5 Spaced review (`dueList`, `schedule`, core.js:183-209; `reviewDone`, learn.js:394)
- **Goal:** delayed recall that makes names yours.
- **Verdict: hits** on honesty: intervals 1, 3, 7, 16, 35 and 90 days, "yours" = a check a day or more later.
- **Misses** on reach: only path and Learn it colors ever enter it (§0).
- **Ideal:** every Set studied anywhere schedules, and a review session is grouped by source thing and shown in context.
- **Links:** Sets, Learner Model `confusions()` (review a confused pair together), the dailies (Today's color as a due card).
- **Skeptic:**
  - **The review pile.** Users who binge 5 Sets on day one get a review pile of 60 on day two. They quit.
    - **Fix:** cap new cards entering review at about 20 a day. The rest wait in "Next up" with their Set.
    - Interleave due cards by confusion pair (IDEAS-10X idea 17).
  - **No way to say "I know this".** There's no "I already know this" path, so known words clog review.
    - **Fix:** a right first-try Pick it on day one sets box 2.

### 1.6 Learn it (`hmLearnIt`, learnit.js:29-37)
- **Goal:** any color becomes a 2-minute lesson with its look-alikes.
- **Verdict: hits.** Meet → recall → edges → tell apart → done. It schedules honestly ("All 5 come back tomorrow", `#shot=lx:ltdone`), and the Bet on tomorrow is a delight.
- **But it's now buried.** It only appears as a "The full lesson" chip at the end of the Learn sheet's "Just one way" rail (learnset.js:48), while swatch.js:94, namer.js:95 and colorset.js:57 still call it directly. So the door depends on where you tapped.
- **Ideal:** Learn it is not a separate thing. It's the sheet's default Study when the source is "a color and its look-alikes", with Edges as a ladder step.
- **Links:** Learn sheet, Edges, Bet on tomorrow.
- **Skeptic:**
  - **Two "learn this color" experiences.** One schedules (Learn it) and one doesn't (Study), and they look different. Nobody can tell which "counts".
    - **Fix:** merge (Top-7 #1).
  - **The bypasses.** Route swatch.js:94, namer.js:95 and colorset.js:57 through `lsOpen`.

### 1.7 The Learn sheet (`lsOpen`, learnset.js:31-96)
- **Goal:** turn any thing into a learnable set in one tap, with control over size and difficulty.
- **Verdict: almost.**
  - The live preview and the "How close" slider (Twins → Wide) are genuinely clever; "Twins" is the nerd's game.
  - But "these colors" from a big source take the **first N in source order** (`these.slice(0, st.size)`, line 55). From the Home Study corner that is the first 10 of up to 400 bubbles in the current view (home.js:474), not the ones you don't know.
  - The sheet offers 4 entry choices plus 6 "Just one way" chips. The rail is cut off at 440 ("Odd o…", `#lsshot=sheet`).
- **Ideal:** the sheet picks the *best* N for you:
  - unknown first;
  - spread by ΔE so the set is solvable;
  - nearest the seed or the thing's dominant colors;
  - a line says why ("the 8 you can't name yet, from 20").
- **Links:** Learner Model `knowState`, Sets, the painting/palette pages, the honeycomb view.
- **Skeptic:**
  - **Already-known colors.** "I opened Learn on Sargent and it gave me 10 colors I already know."
    - **Fix:** rank by `knowState` (none > met > learning > yours), and show "3 you already know, left out".
  - **Choice overload.** "Too many knobs."
    - **Fix:** collapse the sliders under the preview: tap the count to change it. Move "Just one way" behind a "More ways" text link.

### 1.8 Look (`lsLook`, learnset.js:105-172)
- **Goal:** see the set before testing ("nothing hidden").
- **Verdict: hits.** Six real lenses; Pairs ("closest pairs first" with ΔE) and Paintings are the color-nerd depth CLAUDE.md asks for.
- **Ideal:** Look is the set's *home page*. It's also where your coverage shows ("5 of 8 yours · 2 you mix up"), with tiles carrying relation marks.
- **Links:** relation marks (`relMark`, learner.js:297), the Set object, `csOnMap`.
- **Skeptic:**
  - **Look-only use.** Users Look, feel they've learned, and leave. Look must never count.
    - **Fix:** the footer's primary is already "Test me". Add a quiet "Looking isn't learning: test yourself tomorrow" line only after the second Look-only visit.
  - **Six tabs is a lot at 375 px.** Keep the remembered view, and make Map and Paintings the defaults for sets from the map and from art.

### 1.9 Study, the mixed session (`lsStudy`, learnset.js:185-284)
- **Goal:** the fun, adaptive way to learn a set (Quizlet Learn, tuned).
- **Verdict: almost.** It's the best learning surface in the app:
  - four in play;
  - never the same kind twice;
  - Matching every 6;
  - a combo pill;
  - graduation chips;
  - a boss lightning match.

  But:
  1. **It has no memory** (§0).
  2. **"Mastered" after three right answers in one session** is the exact same-session inflation the learning KB warns about. Results say "All 8 *mastered*" while the You page still says 0 yours. That's two truths on one device.
  3. **Level 0 is a 4-way guess between unfamiliar names** before you've ever seen them (`lsKindFor`, line 179). For a novice, the first exposure to "Skobeloff green" is a wrong answer.
  4. **"Keep going" after stopping restarts everything from level 0** (line 322 calls `lsStudy(items, o)` with a fresh `lvOf`).
  5. **No end-of-session bridge to tomorrow:** no "they come back tomorrow", no bet.
- **Ideal:**
  - The ladder becomes meet → pick → produce. "Mastered" is renamed **"climbed"** or "ready for tomorrow".
  - The finish schedules every color and keeps the Set.
  - "Mastered" (solid segment) is earned only by tomorrow's recall. The results show it as an empty ring that fills overnight.
- **Links:** spaced review, Sets, Bet on tomorrow, `lxUnitDone`.
- **Skeptic:**
  - **Flat climb.** A month from now the combo and boss feel samey, because every set plays the same 4-step climb.
    - **Fix:** the ladder's top step varies by set kind:
      - Edges for look-alike sets;
      - "find it in the painting" for art sets;
      - "place it on the map" for map sets.
  - **The boss.** It needs every color climbed, so long sets (30) almost never reach it.
    - **Fix:** a boss at each 6 climbed.

### 1.10 Practice (`prHome`, practice.js:1397-1463)
- **Goal:** free play with your own deck (ledger F1: "first 50 or 100 shuffled, Quizlet modes").
- **Verdict: misses** as a destination.
  - It's a deck *builder* with seven chip rows (range, slider, family, list, order, ask, round) and 11 methods (`#prshot=home`).
  - It duplicates the Learn sheet's job with a different UI and vocabulary ("deck" vs "set", "Learn" method vs "Study").
  - Its "Learn" method (`PR_METHODS.learn`) is a third learning engine.
- **Ideal:** Practice becomes **Your sets**, a shelf:
  - smart sets: Due, Tricky, Mix-ups, Starred, Today's misses;
  - your saved Sets (paintings, palettes, path units);
  - "First 50/100/250" as presets.

  Each opens the one Learn sheet. The builder chips survive only inside the sheet's "From" row.
- **Links:** Learner Model confusions → the Mix-ups set, Colordle misses, Sets.
- **Skeptic:** a month from now nobody opens Practice, because the row says "Make your own deck", which sounds like work.
  - **Fix:** the row shows your most urgent set ("Tricky · 5", "Mix-ups · teal and cerulean").

### 1.11 Learner Model (`learner.js`)
- **Goal:** one owner of what you know, confuse, see and love.
- **Verdict: hits** as plumbing. It's honest (`knowState` "yours" needs a check on a later day), and it's compact.
- **Almost** as a product: it knows your confusions, but almost nothing *acts* on them.
  - You lists "You mix these up" with no button to fix them (you.js:179-183).
  - Study's wrong answers don't seed tomorrow's review pairing.
- **Ideal:** every reader has a matching verb:
  - confusions → "Untangle these" (a 2-color Study with Edges);
  - `edgeOfMap` → "Next words near what you know";
  - `seenIn` → "Learn the colors of what you looked at today".
- **Skeptic:** a month from now the Learner Model is a write-only log.
  - **Fix:** every list it powers ships with a one-tap action.

### 1.12 You page progress (`youPage`, you.js:142-235)
- **Goal:** the honest, beautiful mirror of what you've learned.
- **Verdict: almost.**
  - The count + "637 to Fluent" + learning / to recall / hearted is clear.
  - But the hero count rendered as "**–1** colors yours" in my 440 shot. It's probably the odometer (`countUp`, core.js:303) caught mid-flight, or a glyph. Verify on device.
  - There's no then-vs-now, no list of the things you've learned, and "to recall today" isn't tappable.
- **Ideal:** You shows your *things* (paintings and palettes you can name, with coverage), the mix-ups with "Untangle", and a tappable "6 to recall".
- **Skeptic:** "I learned 40 colors and You shows a number." People need to see *where* the words live.
  - **Fix:** a "You can name" strip of painting thumbnails with a coverage ring each (Nameable Museum v1).

### 1.13 Streaks and daily return (`chStreak`, challenge.js:25)
- **Goal:** a reason to come back tomorrow.
- **Verdict: misses** for learning. The only streak counts the two dailies (a perception game), not reviews or lessons. The You page's "Your week" counts any logged answer. That's two definitions on two screens.
- **Ideal:** one streak, "a day of color": finishing due reviews **or** a daily **or** a Study counts. It's drawn as the week of colors you won (IDEAS-10X idea 11), and shown on Learn and You.
- **Skeptic:** streak anxiety, and "I did my reviews and lost my streak".
  - **Fix:** count reviews, plus one free miss a week (JOURNEY's freeze), never punitive copy.

### 1.14 Bet on tomorrow (`lxBetHtml`, learnmore.js:530)
- **Verdict: hits.** It's calibration, it's tiny, and it builds the bridge to tomorrow.
- **Almost:** it only appears after path units and Learn it, not after Study (the sheet). Add it to `lsResults`.

---

## 2. A. Annoyances and friction (with repro)

1. **Study progress evaporates.**
   - Repro: Home → Study corner → Study 8 → finish "All 8 mastered" → You.
   - Result: still 0 learning from that set, nothing due tomorrow (learnset.js:185 never writes `S.cards`; practice.js:347).
2. **"Keep going" restarts levels.**
   - Repro: Study, ✕ after 5 questions → results → Keep going.
   - Result: every color is back to level 0 (learnset.js:322, a fresh `lvOf`).
3. **The Learn sheet picks the first N of the source, not the useful N** (learnset.js:55; home.js:474 passes up to 400 view hexes).
4. **Inconsistent doors.** swatch.js:94, namer.js:95 and colorset.js:57 skip the sheet. So "Learn" means Learn it in some places and the sheet in others.
5. **The "Just one way" rail is clipped at 440** ("Odd o…") with no affordance (`#lsshot=sheet`).
6. **Same-session "mastered"** contradicts the "Yours" count shown elsewhere (lsResults, learnset.js:300).
7. **Day-one lessons are swipe-only** (learn.js:246 schedules only in review). Nothing objective happens until tomorrow.
8. **Practice home** asks for 7 decisions before Start. The default "First 50 · shuffled · Flashcards" ignores what you know.
9. **Optimistic time estimates.** The path says about 2 min for 8 names (learn.js:463, 15 s/name). Study says about 2 min for 10 (learnset.js:74). The sample results took 3:12 for 8.
10. **The Learn room still has "Settings & more"** (learn.js:497), duplicating You's settings.
11. **Title Case leaks** on unit done chips ("Grey Brown", "Brown Red", `#shot=lx:done`) and Study results; Practice row titles mix casing.
12. **The streak ignores reviews** (challenge.js:25).

## 3. B. Confusing things: overlapping entry points

Today there are **six ways to "learn"**:
1. the Learn room's Begin (path unit = meet + swipes, or a review);
2. Learn it (meet → recall → edges → tell);
3. the Learn sheet → Study (adaptive ladder);
4. the Learn sheet → "Just one way" (Practice runners);
5. Practice home → 11 methods, including a "Learn" method;
6. the review deck (swipes + Pick/Say/Make).

Only 1, 2 and 6 touch memory. A user can't know which counts.

**How they should relate (one noun, one verb, one memory):**

| Noun | **Set**: any group of colors with a source (unit, painting, palette, map view, look-alikes, mix-ups) |
|---|---|
| Verbs | **Look** (see it, never counts) · **Study** (the ladder, schedules at the end) · **Review** (due cards, grouped by Set) · **Play** (the single-method games, practice only, never counts except as a due review) |
| Memory | `S.cards` + a saved Set record (`S.sets[key] = { title, src, hexes, at }`); the Learner Model logs everything |
| Path | the app's ordered list of suggested Sets; "next unit" = the next Set |
| Practice | the shelf of your Sets and smart Sets |

## 4. C. Simplifications and merges

1. **One lesson engine.** The path unit, Learn it and Study all run `lsStudy`:
   - the meet pager becomes the Set's cover plus level −1;
   - Learn it's Edges becomes a ladder step for look-alike sets;
   - delete Practice's `learn` method.
2. **Practice home → Your sets shelf.** Remove the 7-row builder; "First N", family and lists become sources inside the sheet.
3. **Rename "mastered"** to "climbed" (in session) and keep "Yours" as the only progress word.
4. **One streak** (§1.13).
5. **The Learn room loses Settings and the separate Practice row.** Your open Sets take their place.
6. **"Swipes are practice" + OWN_LINE** appears on every done screen (learn.js:378, 406). Show it once, then put it in About.

## 5. D. Fun upgrades (honest ones)

1. **Coverage rings on things.** A painting, painter or palette gets a ring that fills as its colors become yours ("5 of 6"). Closing a ring is the reward: real, visible, collectible.
2. **The overnight fill.** Study results show each climbed color as an empty ring, "fills when you name it tomorrow". The next morning's review fills it with a satisfying stamp: tomorrow is the payoff.
3. **Set-specific boss steps:**
   - art sets: "find these colors in the painting" (tap the region);
   - map sets: "place it in the honeycomb";
   - look-alike sets: Edges.

   Same combo, a new final act.
4. **Twins mode as a badge-free challenge.** "Twins" sets with a daily board ("Today's twins: 6 blues at ΔE 2.5"). Bests per set already exist (`ls.best`).
5. **Bet on tomorrow after Study,** settled with the overnight fill.
6. **Send a set** (IDEAS-10X idea 23). `lsResults` has Share text only. Make it a link (`#/set/<hexes>`) that opens the same Learn sheet for a friend, plus your boss time to beat.

## 6. E. Interconnections

- **Painting / painter / palette pages** get "You can name 4 of 6" (from `knowState`) and "Learn the other 2" (sheet preselects the unknown).
- **The honeycomb:**
  - The Study corner seeds from the view's *unknown* colors near the center.
  - A finished map Set offers "See them in the Learned view" (respecting X7: no dimming, a view toggle).
- **Color pages** show "In your sets: *The Milkmaid*, Teal look-alikes" and "You mixed it up with X → Untangle".
- **You:**
  - mix-ups get an Untangle action;
  - "to recall today" is tappable;
  - your Sets list with rings.
- **Dailies:**
  - Today's color, once named, offers "Add to review".
  - Today's painting's misses become a Set ("Today's misses" exists for Colordle only, colordle.js:257).
- **Learner Model `seenIn`/`trail`:** the Learn room offers "Learn the colors of what you looked at today" (one tap, a Set from your trail).

---

## 7. F. Top 7 recommendations (ranked by impact ÷ effort)

### 1. Study schedules, and the Set is kept (impact: very high · effort: S, about 2 h)
**Spec:** at the end of `lsStudy` (in `lsResults`, and on a stopped session for the colors that climbed at least one rung):
- Call the same rule as `hmSchedule`: every item with an `it.c` id and no `S.cards` entry gets `{ b: 0, due: tomorrow, since: today, own: false, n, h }`.
- Write `S.sets[lsSetKey] = { title, src: back route, hexes, at, climbed }` (migrateState: a new optional key, no step needed).
- Results change:
  - "*N* climbed · come back tomorrow to make them yours";
  - Bet on tomorrow;
  - "Mastered" chips become rings that fill only on tomorrow's recall.
- A first-try right Pick it at level 0 (a color you clearly knew) sets box 2, so known words don't clog review.

This one change makes "learn the colors of anything" real.

### 2. One door, one engine: the path and Learn it run on Study (impact: very high · effort: M, about 1 day)
**Spec:**
- `meet(u)` keeps its fan cover, and its "Start" opens `lsStudy(u.colors, { label: u.title, unit: u })`. On finish it calls `learnUnit(u)` and goes to `unitDone`.
- Study gains level −1 "meet": the name, the swatch and its difference from the nearest color in play, for 1.2 s and one tap, the first time a color with `knowState === "none"` enters play.
- Look-alike Sets add Edges as the step between pick and type.
- Route swatch.js:94, namer.js:95 and colorset.js:57 through `lsOpen`.
- Remove `PR_METHODS.learn`.
- The swipe deck stays the review surface.

Result: one way to learn, and day one includes objective checks.

### 3. The Learn sheet picks the right colors (impact: high · effort: S, about 2 h)
**Spec:** replace `these.slice(0, st.size)` (learnset.js:55) with a ranker:
1. `knowState` none, then met, then learning; yours is left out unless you ask;
2. then nearest the seed or the thing's largest-share colors;
3. greedy ΔE ≥ 5 so every pair is solvable.

The names line explains the choice: "The 8 you can't name yet, of 20 · 3 you know are left out". The Home Study corner passes the view's unknowns near the center, not its first 400.

### 4. Your Sets replace Practice's builder (impact: high · effort: M, about 1 day)
**Spec:** `prHome` becomes a shelf with three groups:
- **Due and smart sets:** Due · Tricky · Mix-ups · Starred · Today's misses, each with a count;
- **Your sets:** `S.sets`, newest first, each with plates, title, source and a coverage ring ("5 of 8 yours");
- **Presets:** First 50 / 100 / 250, by family.

Tapping any set opens the Learn sheet. The old chip builder survives as the sheet's "From" row.

The Learn room's Practice row becomes "Your sets · Tricky 5" (your most urgent one).

### 5. Coverage on things, and "Learn the rest" (impact: high · effort: M, about 4-6 h)
**Spec:** one helper, `setCoverage(hexes)` → `{ yours, learning, none }` via `knowState`.
- It's shown as a ring + "You can name 4 of 6" on painting Analysis, painter pages, palettes, looks and Look's header.
- The tap opens the Learn sheet preloaded with the unknown ones.
- Review cards from an art Set show the painting thumbnail on the card back ("from *The Milkmaid*").
- The You page gets a "You can name" strip of things with full rings.

This is the visible widening of what you can name (the IDEAS-10X north star), at small cost.

### 6. Act on the Learner Model: Untangle, and "what you looked at today" (impact: medium-high · effort: S, about 3 h)
**Spec:**
- Every mix-up pair on You (you.js:179), on color pages and in Study results gets **Untangle**: a 2-4 color Study (the pair plus its nearest third) with Edges and the Look Pairs view first.
- The Learn room gets one quiet row when `trail(14)` has 3 or more colors not yet known: "Learn the colors you looked at today" → the Learn sheet with those.
- Study wrong answers call `learnerLog("confuse")` already. Make review queue confused pairs adjacent (IDEAS-10X idea 17).

### 7. One honest streak, a Today stack, and the overnight fill (impact: medium-high · effort: S-M, about 4 h)
**Spec:**
- `chStreak` counts a day when any of these happens: due reviews cleared (or 10 or more answered), a daily finished, or a Study finished.
- One freeze a week. The same streak shows on Learn and on You ("Your week" uses the same rule).
- The Learn room's top block becomes a Today stack, in this order:
  1. "N to recall", grouped by Set ("*The Milkmaid* · 4, Teal look-alikes · 3");
  2. the open Set you didn't finish (resumes levels: also fix "Keep going" at learnset.js:322 to keep `lvOf` and only the unclimbed colors);
  3. the next path Set;
  4. the dailies.
- Settings leaves the Learn room.
- The first review of the morning plays the overnight fill on yesterday's rings.

---

## Screenshots reviewed (440×956)
Scratchpad only, not committed:
- Learn room, meet cover, path deck, unit done, review done;
- Learn sheet, Study (question, wrong, match), Study results, Look grid;
- Practice home, You, welcome, Learn it meet and done.

Notable visuals:
- Study and Learn it are the most polished screens in the area.
- Practice home is the busiest.
- The You hero count read "–1" (verify on device).
