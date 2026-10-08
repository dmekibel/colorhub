# Improve everything: the Train room and its games (2026-10-08)

Reviewer 3 of 5. Scope: the Train room (`js/rooms2.js`) and every game in it except Study the map. That covers Odd one out, Gradients, Painters' pairs, Whose palette?, Across the line, Today's color, Lightning, Squint, the Mix memory and ordering games, the drills, the check-in, the eye profile and the sounds the games make.

**Method.** I read the code. Then I rendered 30 states headless at 440×956 through `tools/_qa/frame.html` (`#shot=gx:…`, `dl:…`). That covers the Train home (fresh and played), the Odd one out map, the first round, levels 5 and 12 (a miss), results and Your eye; Across the line, Whose palette? and Pairs (a reveal); What changed?, Was it there?, Out of order, Rebuild and Imposter; the Gradients map and a board; Squint, Lightning, Colordle and Today's painting; the eye report, the check-in, a drill and its results. A few states (n-back, the level-5 answer) timed out in headless. For those, the findings come from the code only.

David's lenses, applied to every game:
- UX, function, form, dynamics, teaching value and simplicity;
- the goal, a verdict (hits / almost / misses), the ideal in one sentence, connections and a skeptic's pre-mortem.

---

## The diagnosis in one paragraph

Train has one great mechanic (**Odd one out**), one proven puzzle (**Gradients**) and one truly ColorHub idea (**Across the line**). Around them sit 13 more game tiles, 12 drills and 3 checks: **31 entries**. Five of them are the same three skills in other clothes:
- three ordering games: Gradients, Out of order and Rebuild;
- three name quizzes: Lightning, Imposter and Learn's own deck;
- three dailies on one screen: Today's painting, Today's color and Today's gradient.

The pieces don't talk to each other honestly:
- every perceptual miss is written into the Learner Model as a *naming* confusion;
- the weekly check-in still tests the retired Odd one out station, on a different level scale;
- there are two "Your eye" pages;
- the shared results screen tells a trivia game that "this is your eye working at its edge".

The perfect mechanic is close. It's **"find the difference, then learn what it's called"**: one board, any source (a painting, your words, your photos), whose answer is both a perceptual threshold *and* a word. Odd one out already holds the first half and Across the line the second. Most of the plan below moves the other games toward that, or out of the way.

---

## A. Annoyances (file:line, how to reproduce)

1. **Perceptual misses pollute the naming model.** `ooLogMiss` (`js/games/oo-ui.js:117-119`) logs every Odd one out, Mix and Gradients miss as `learnerLog({type:"confuse", a: hex, b: hex})`.
   - Two random colors 1.8% apart become a "mix-up".
   - `confusions(null, n)` sorts by count, then by recency, so after one level these hex-only pairs crowd the real ones out.
   - They then show up in the You page ("your mix-ups", `js/you.js:147`, which keeps any pair with a hex), in Learn's mix-up deck (`js/practice.js:1519,1530`) and in Study the map's seeds (`js/mapstudy.js:217`).
   - Hue-ui does the same (`js/games/hue-ui.js:239`).
   - Repro: play one Odd one out level and miss twice, then open You → mix-ups.
2. **Sound leaks the answer in the ordering games.** The delegated click (`js/sound.js:320-346`) plays a color's note on any `.oo-t` / `--c` tap, and pitch = L\* (14 pentatonic steps).
   - Gradients' tiles (`hue-ui.js:124`, `--c` on `.hg-s`) sing their lightness when you pick one up.
   - In the **Blind** twist, a face-down tile still plays its note, so you can solve it by ear.
   - The same leak hits Out of order chips and the Rebuild tray.
   - Odd one out is safe (the tap is the answer).
3. **The shared results screen lies for non-eye games.** `ooResults` (`oo-ui.js:523-560`) has a default lede, "Every round was drawn near your own limit, so this is your eye working at its edge", and always shows the CIEDE2000 fine print.
   - Painters' pairs (statistics trivia) and Whose palette? (knowledge) get both.
   - On a fail, Pairs says "You need 4 of 6. Every round is drawn near your own limit…".
4. **The stars are meaningless or broken outside the ladder.** They are always labeled Passed / Quick / No hints.
   - **Whose palette?** (`oo-mix.js:296-297`): stars are `[pass, 0, 0]`, so Quick and No hints can never be earned. The stars are *overwritten* on a worse run (no max with the old ones), and `pb:false` is hard-coded.
   - **Painters' pairs** (`pairs.js:89`): the stars are 4/5/6 right, but labeled "Quick" and "No hints".
   - **Across the line** (`line.js:89`): the third star is `finish` again, and the game has no hints.
   - All three pass `got:[1,1,1]`, so every star animates as "new" every time.
   - Pairs and Across never persist their stars.
5. **The weekly check-in is cut off from the games people play.**
   - `CI_STATIONS` (`gym-engine.js:199`) is the old station list, starting with `hue`, the retired Odd one out.
   - `triedKeys()` (`gym.js:59`) counts only old station history, so a new player who plays only Odd one out, Gradients and Across never unlocks a check-in. The Checks row says "After three drills" forever.
   - An old player gets "Check-in · Odd one out" as a grey 3×3 (`shot gx:checkin`), scored on the station scale. So "Odd one out level 9 · check-in" on the eye report sits beside "Level 13 of 20 is next for you" on the map: two different level 13s.
6. **Two "Your eye" pages.**
   - `ooEyePage` (`oo-ui.js:663`) shows thresholds per judgment and family.
   - `eyeReport` (`challenge.js:492`) shows station charts, the check-in and the confidence calibration.
   - The Train eye block routes to one or the other depending on whether `ooS().model` has data (`rooms2.js:197-202`).
   - On ooEyePage at 440 px the right-hand value column wraps "level 13" into "lev / el / 13" under each bar (shot `ooeye`).
7. **The feedback line names noise.** `eyeNamesLine` uses `nameOf()` with modifiers, so a 2.2% miss reads "The odd one was *Reddish antique ruby* among *Deep rose red*" (shot `oolv12miss`).
   - Two generated descriptions for nearly the same red teach random words, and they break the naming policy ("generated descriptions are not names").
   - At level 10+ most pairs share a Learn-layer word, and *that* is the lesson: "Both are rose red; this difference has no word".
8. **Lightning inflates its own count.** It shows "`${score}` named" (`gym.js:1135`), but after a 5-streak each answer adds 2 (`gym.js:1152`). Also:
   - it has no misses list;
   - questions come from the ~165 lesson colors (`ALL`), not the ~1,000 Learn words;
   - answers aren't logged to the Learner Model;
   - there's no For you / Choose (a craft-bar rule).
9. **The Pairs reveal caption** prints ", 1650" when the artist is blank (`pairs.js:49`, shot `pairsans`: "Loenersloot Castle on the Angstel / , 1650").
10. **The Train room buries today.**
    - 16 game tiles of identical anatomy come first: name, then "New" on 12 of them (`rooms2.js:90-106`).
    - On a 956 px screen, Today's painting, the eye line and the check-in banner are more than a full screen down.
    - "Gradients" and "Today's gradient" are two tiles with the same icon. Today's gradient is a third daily on the same screen as Today's painting and Today's color.
11. **Gradients still locks in For you.** Worlds open after 5 clears (`hue-engine.js:545`, `hgWorldOpen` in `hue-ui.js`), and levels open one by one. David said "nothing locked". Choose opens everything, but the default path still has gates.
12. **After a right answer, Odd one out auto-advances** at 1.3 s, or 1.9 s if `fb.html.length > 120` (`oo-ui.js:400`). The length includes the HTML markup of the two name links, so the threshold reflects the tags, not the words. There's no tap-to-continue. Reading two names plus a direction in 1.3 s is tight; lowering the timer isn't the fix (see 7).
13. **Whose palette? rounds can be unreadable.** Shot `whose`: five near-black chips against three strips of 12 browns, from Willem van de Velde (I), Shen Zhou and J.A. Jerichau (II). It's guesswork for anyone who isn't an art historian (see B).

## B. Games: goal, verdict, ideal, connections, skeptic

The format for each game:
- **Goal:** the perceptual skill it trains.
- **Verdict:** hits, almost or misses.
- **Ideal:** the version that clicks, in one sentence.
- **Connects:** to the rest of the app.
- **Skeptic:** "a month from now players quit because…", then the fix.

### Odd one out: KEEP, the heart
- **Goal:** discrimination threshold, the smallest difference you see, per axis (lightness, vividness, hue) and per family.
- **Verdict: hits.** It has a real skill, an honest ladder (`OO_GAPS`), layouts rotating inside a level, For you / Choose / Test out, and a hidden model that is calibrated across layouts. It's the best-built thing in Train.
- **Ideal:** the same board, cut from something real (today's painting, a palette you kept, your mix-up pair) more and more as you climb, with each answer named in your words.
- **Connects:**
  - It already feeds `eyeThreshold`.
  - It should *not* feed `confusions()` (A1).
  - It should feed the color page ("you see blues to 1.5%"), Today (the weak family) and the check-in (A5).
- **Skeptic:** "…because past level 14 nothing changes but the gap, and the gap stops being visible on my phone." The map's own minis "honestly look alike" at the top. The 20-level ladder plateaus where the screen does, and a plateau with no new content feels like failing.
  - **Fix:** past *your edge*, stop pushing the gap and widen the world.
  - Unlock source layouts (paintings, your photos, your saved palettes, flowers) and "count", "pair" and "which way" variants *at* your edge.
  - Make the next goal "level 13 in every family" (the eye map) instead of "level 14".
  - The ladder is the spine; breadth at your edge is the content.

### Gradients: KEEP, absorb the other ordering games
- **Goal:** seeing small steps in a 2D field, interpolating lightness, vividness and hue.
- **Verdict: hits.** It's I Love Hue, but with corners from real things, shapes and twists. It's the most "fun" game here.
- **Ideal:** every board's corners come from a real thing, and solving it *plays* the thing: the finished field rings as an arpeggio (see D) and opens the painting or flower.
- **Connects:** source pages (`hg-art data-src`), learnerLog seen and confuse events (the confuse should go, A1), Your colors world.
- **Skeptic:** "…because I solve it by lightness alone, or by ear, and it stops being about color." The sound leak (A2) is a real cheat. Lightness-only fields are trivial for anyone who squints.
  - **Fix:** mute the color notes while a board is unsolved.
  - Lean on `onehue` / `onelight` twists (where lightness is held constant), so hue and chroma do the work.
  - Remove the world gates in For you (A11). For you should *suggest* the next level, not lock the others.

### Out of order, and Rebuild: MERGE into Gradients
- **Goal:** ordering one strip; ordering it from memory.
- **Verdict: misses as separate tiles.** They are Gradients with one dimension and no source.
  - Out of order is a two-phase task (find it, then drag) where the "find" phase is the easy part (shot `mixooo`: one cyan in a wine-to-blue strip).
  - Rebuild duplicates Gradients' Blind twist.
- **Ideal:** Out of order becomes Gradients' 1D "strip" warm-up board, and Rebuild *is* Blind.
- **Skeptic:** "…because three tiles do the same thing and none goes deep." Cut both tiles; keep the renderers for `GAME_STEPS`.

### Across the line: KEEP, and make it click (the almost-perfect one)
- **Goal:** the edges of color words. It's the only game that trains *categories* rather than thresholds, and the only one that needs ColorHub's names to exist.
- **Verdict: almost.** The idea is exactly the app's thesis: a name is a region, and you can feel where it ends. The reveal strip, the tiles named and the tick where the word changes are beautiful. Four things stop it clicking:
  1. **No anchor.** "Three of these are *Teal*" doesn't show you teal, so a player who isn't sure what teal is guesses.
  2. **Arbitrary edges.** The boundary is ColorHub's nearest-name region, and when a round falls where two names are nearly tied, the right answer feels like the app's opinion.
  3. **Category words come from the 165 lesson colors** you've met (`ooLineCats`), not your Learn words.
  4. **Nothing follows the reveal.** The neighbor word you just discovered goes nowhere: no "learn it", and no Learner Model answer (only a hex confusion, A1).
- **Ideal:** "Where does *teal* end?". The word's own swatch sits as a small reference chip in the corner, the boards are drawn only where the edge is confident, and every reveal offers "Add *petrol* to your words".
- **Connects:**
  - a color page button "Where does it end?" (play eight rounds of that word against its neighbors);
  - the Learn sheet (add the neighbor);
  - the Learner Model (log `answer` with names, `by:"game"`; log `confuse` with *names*);
  - Study the map (the edge you just crossed is a border on the map).
- **Skeptic:** "…because I disagree with the answer and the app can't explain itself." Two fixes:
  - **Generator:** only draw rounds where the odd tile's nearest name wins by a margin (its ΔE to its own name is at least about 30% lower than to the category word), and where the in-category tiles are confidently in.
  - **Copy:** on a miss, say "In ColorHub's map, this side is *petrol*. Dictionaries draw the line a little differently". The honesty line already exists in the header comment; surface it.

### Painters' pairs: MERGE with Whose palette? into "Painter's eye"
- **Goal:** knowledge of which colors keep company in real paintings (harmony as practiced).
- **Verdict: almost, leaning misses.** The data is real and the reveal (three paintings that hold the pair) is lovely. But the question can't be learned: "Ash with sky blue, or grey with ash?" has no perceptual answer and no rule you can carry away, so it plays as a coin flip with a fact after it. It also isn't an eye game, yet it gets eye copy (A3).
- **Ideal:** "Finish the palette". Four colors from a real painting, and you pick the fifth the painter actually used from three candidates (one real; two decoys painters *avoided* with these colors, from the lift table). The reveal is the painting with the color found in it.
  - This uses the same pair statistics, but now the answer is *visible*: you judge harmony by eye, and you learn it.
- **Connects:** the painting page (the reveal opens it), the painter page, Looks ("finish the palette" for a Look), Studio (keep the palette).
- **Skeptic:** "…because it feels random." Ground every answer in a picture you can see, and say the rule when one exists ("painters paired this cool light with a warm dark 3× as often as chance").

### Whose palette?: MERGE into "Painter's eye" (famous painters first)
- **Goal:** recognizing a painter's color signature.
- **Verdict: misses as built.** It's solvable by construction (`tools/whose_build.js`) but not for humans: 5 chips against three 12-chip strips, from painters most players have never heard of (shot: van de Velde (I), Shen Zhou, Jerichau (II)), often all dark or brown. Stars can't be earned (A4).
- **Ideal:** you learn signatures before you're tested on them.
  - Start with about 30 painters people know (Vermeer, Van Gogh, Monet, Sargent, Rothko-era public domain…).
  - Show each choice as *one thumbnail* of their most typical painting, not a strip.
  - After each round, say the signature in words ("Sargent: deep blacks against one warm accent").
  - Widen to movements and decades, then to the long tail, as you get them right.
- **Connects:** painter pages (`whosePalette(slug)` already exists, so add the reverse: "Whose palette? from this painter" on every painter page, and the painter name in the reveal links to the page), movement and decade pages, the painter's "most typical painting".
- **Skeptic:** "…because I can't know these people." A curriculum of fame, plus thumbnails, plus a spoken signature fixes it.

### Today's color (Colordle): KEEP (one of the three dailies, folded)
- **Goal:** producing a name from a color (recall, not recognition), with warmer/colder clues.
- **Verdict: hits** as a daily ritual. It recalls before it reveals and logs to the learner (`colordle.js:124`).
- **Ideal:** the same game, with a seed that prefers words just past your Learn frontier, so the daily teaches one new word.
- **Skeptic:** "…because typing color names on a phone is fiddly, and synonyms ('sea green' vs 'seagreen') are marked wrong." Make sure the matcher accepts the Search layer (the ~4,300 alternates) and offers autocomplete chips after 2 letters. The players of a word game quit over a rejected right answer more than over anything else.

### Lightning round: REWORK into "Name it fast"
- **Goal:** fast recognition of names (speed of access).
- **Verdict: almost.** The 45-second format is fun, and it's the one timed thrill in Train. But:
  - it duplicates Learn's pick step and Imposter;
  - it draws from the old 165;
  - it teaches nothing after the buzzer (no misses);
  - it counts wrongly (A8);
  - it feeds nothing.
- **Ideal:** 45 seconds on swatches cut from today's painting and your photos. The decoys are your own confusions and look-alikes from the 1,000. The results list the misses as tappable pairs and offer "Practice these 4", and every answer is logged.
- **Connects:** the Learner Model (answers and confusions with names), Learn (the misses go into a deck), color pages.
- **Skeptic:** "…because once I know the 40 colors I've met, it's trivial." Draw from known words plus 20% next-up words (introduced with recall-safe decoys), and keep a For you / Choose pool size.

### Imposter: CUT (fold into Name it fast)
- **Goal:** name-to-color matching.
- **Verdict: misses.** The four colors are forced at least 12 ΔE apart, and the wrong label is 6 to 24 ΔE off, so it's usually obvious. Shot `miximp`: "Khaki" on a cream swatch beside "Tan". It's a weaker Lightning question.
- **Ideal:** one of Name it fast's question types ("which label is wrong?"), drawn from neighbor names only.

### What changed? and Was it there?: MERGE into one "Color memory"
- **Goal:** visual memory for color (change detection; recognition after a delay).
- **Verdict: almost.** Both are decent, and David asked for memory that gets harder (T1). As two tiles of random colors, though, they're interchangeable and soulless. The boards (shot `mixchanged`) are nine unrelated colors.
- **Ideal:** one Color memory game with Odd one out's model:
  - a ladder of gaps (the memory threshold is already in the eye model as `memory`);
  - layouts rotating inside a level (blink-change, newcomer, which-was-it);
  - boards cut from a painting you saw earlier today ("Do you remember? The Milkmaid's apron was…").
- **Connects:** today's painting (round 5 can be a memory round), the eye model's `memory` judgment, the check-in.
- **Skeptic:** "…because random squares are forgettable by design." Real sources make it worth remembering.

### Color n-back: CUT
- **Goal:** working memory.
- **Verdict: misses.** It's a brain-training genre the app itself disclaims ("It isn't brain training"). It's a single flashing chip for 13 s, its color value is incidental, and lures are the only color content. It has the least connection to the four goals.

### Squint: KEEP, move it to the drills and link it out
- **Goal:** value structure (seeing a painting as light and dark masses).
- **Verdict: almost.** It runs on real paintings with "hold to squint" (lovely). But ordering three ringed points is shallow, and it ends without showing you the painting's value structure.
- **Ideal:** order the masses, then the reveal is the painting's own value key (the Analysis tab already computes one) with a two-value "notan" slider.
- **Connects:** the painting page's Squint toggle and Analysis value key (link both ways).
- **Skeptic:** "…because after 22 paintings it repeats." `data/squint.js` holds 22. Generate the rounds from the analysis data across the archive.

### Today's gradient: FOLD into a single Today row (not its own tile)
- **Verdict: almost.** It's a good daily, but it's the third daily on one screen, with the same icon as Gradients.

### Today's painting (challenge.js): KEEP as Train's front door
- **Goal:** five lenses on one real painting a day.
- **Verdict: hits** (shot `dlpaint`: "Where does this color hide?" on the Milkmaid). It's the closest thing to the North Star in the ideas round.
- **Skeptic:** "…because it's below 16 tiles and I never scroll to it." See F1.

### The drills (12): KEEP, collapse into three groups
- The drills are: Which is lighter?, Lighter or darker (same hue), Neutral, Two looks, Vanish, Value scale, Big masses, Zorn, Kill the cast, Shot match, Kelvin and Afterimage.
- **Verdict: almost as a set.** Each is honest and staircased. As a flat list of 12 they read as a lab menu, and none has For you / Choose (the craft bar asks every game for both).
- **Ideal:** three rows, each opening a small shelf with one "For you" pick at the top.
  - **Light and dark:** Which is lighter, same hue, Value scale, Squint.
  - **Color in context:** Two looks, Vanish, Neutral, Kill the cast, Kelvin.
  - **The painter's bench:** Big masses, Zorn, Shot match.
  - Afterimage becomes a demo on the complementary-colors and afterimage pages, not a drill.
- **Skeptic:** "…because I can't tell 'Which is lighter?' from 'Lighter or darker, same hue'." Keep the two staircases separate underneath, but show one tile.

### The check-in: REBUILD on the new games (A5)
- **Goal:** the honest progress number (delayed, unassisted, same test each week).
- **Verdict: misses today.** Its principle is right, but it's wired to the retired stations and invisible to new players.
- **Ideal:** a 3-minute weekly board.
  - It's seeded by the week, with fixed gaps and no feedback.
  - It covers Odd one out across the three axes, plus 3 Across the line edges and 2 memory rounds.
  - It's scored on the *same* 1–20 gap ladder as the map.
  - It unlocks after two Odd one out sets.
  - Its result is the trend line on the one Your eye page.

### Your eye: MERGE the two pages into one
- **Ideal:**
  - the eye map (a 9 families × 3 axes grid, colored by threshold, each cell tappable to play *that* weak spot);
  - the check-in trend;
  - one calibration sentence ("when you're sure, you're right 91% of the time");
  - "History" behind a link.
- Fix the 440 px value-column wrap.

### Sound in games: KEEP the voice, fix the leak, add one signature moment
- **Verdict: almost.** The vocabulary is good (a climbing pentatonic streak, flourishes built from the screen's colors), but the color note on tap leaks answers (A2).
- The best musical idea is unused in play: **pitch = lightness means a solved gradient is a scale.** Play the finished field as a rising arpeggio: a solved board literally sounds in tune. That's iconic, and it teaches lightness by ear *after* the eye has done the work.

## C. Simplifications (cuts and merges in one table)

| Today (31 entries) | After (about 12) |
|---|---|
| Today's painting card + check-in banner (below the fold) + Today's gradient tile + Today's color tile | **Today row** at the top: three small cards (painting, color, gradient), each with a done tick and a streak |
| Odd one out | Odd one out |
| Gradients + Out of order + Rebuild | **Gradients** (strip warm-ups; Blind = Rebuild) |
| Across the line | Across the line |
| Study the map | Study the map (another lane) |
| Whose palette? + Painters' pairs | **Painter's eye** (Finish the palette; Whose painter, famous first) |
| What changed? + Was it there? | **Color memory** (one ladder, layouts rotate) |
| Lightning + Imposter | **Name it fast** |
| Color n-back | cut |
| Squint + 12 drills | **Drills**: three grouped rows (Light and dark, Context, Painter's bench) |
| Weekly check-in + Your screen + History + two eye pages | **Your eye** (one page; the check-in lives in it) + Your screen in Settings |

That leaves 7 game tiles in the grid: two rows plus one, which fits above the fold on a 440×956 screen, with Today above them.

## D. Fun upgrades (each small and specific)

1. **Hear it resolve.** On a Gradients solve, Odd one out mastery or a Color memory clean sweep, play the board's colors as an arpeggio sorted by lightness (`sfxChord`, which exists). It's the iconic moment: "a finished gradient is a scale".
2. **"Both are rose red."** At gaps under about 3%, the settle line names *one* Learn-layer word and says "this difference has no word, yet". When the two cross a Learn word, celebrate it: "You just saw the edge between *teal* and *petrol*", with a link into Across the line. That turns every Odd one out round into vocabulary without noise (it fixes A7).
3. **Your-eye bounty.** Today's row shows one weak cell from the eye map ("Hue in yellows: 3.2%. Three rounds?"). Tapping it plays an Odd one out set pinned to that family and axis (`ooSpec` already accepts a family).
4. **A board from your own photo.** Once you have photos in Studio, Odd one out and Gradients offer "a board from your photo" (the painting-tile code reads same-origin pixels, and object URLs work).
5. **Stars that mean something per game:**
   - Odd one out: Passed, Quick, No hints.
   - Gradients: Solved, Few moves, No hints.
   - Across: Passed, No misses at the edge, Fast.
   - Painter's eye: Passed, A streak of 4, A painter new to you.
   - Name it fast: Personal best, 10 in a row, No misses.
   Store them, and only animate the stars that are new (A4).
6. **The daily share** for the Today row is one card with three marks (painting, color, gradient), not three share sheets.

## E. Interconnections (what's missing)

1. **Learner Model.**
   - Split the events: perceptual misses go to the eye model only, as `src:"eye"`, or are not logged as `confuse` at all. Word-game answers go in as `answer` with *names* and `by:"game"` (Across, Name it fast, Colordle, Painter's eye).
   - `confusions()` should drop hex-only pairs. That's a one-line filter in `js/learner.js:196`, plus `ooLogMiss` passing `{n,h}` when a game has names (Across has them).
2. **Color page.**
   - "Your eye on blues: 1.5%" (`eyeThreshold` exists).
   - "Where does *teal* end?" opens eight Across rounds on that word.
   - "Remember it": a Color memory round with this color.
3. **Learn sheet.** "Add *petrol* to your words" from the Across and Name it fast reveals. Name it fast misses become a deck.
4. **The map (Study the map).** An Across round's edge is a border you can see on the map. After a round, "See this edge on the map" opens the map centered between the two words.
5. **Painter and painting pages.**
   - Painter's eye from any painter page (already half there).
   - Squint's reveal opens the painting's Analysis value key.
   - Pairs and Finish the palette open the painting.
6. **Today.** The Today row reads the eye model (the bounty), the Learner Model (the next word for Colordle) and your trail (Color memory from what you saw).

## F. Top 7 recommendations, ranked by impact over effort

**1. Rebuild the Train room: a Today row, 7 games, 3 drill rows (S-M, `js/rooms2.js` plus small hooks).**
- **Layout:** the title, then a **Today row** of three compact cards (Today's painting as the wide primary, Today's color, Today's gradient), each with a done tick, a streak and one share.
- **Under it, one line:** the eye bounty ("Hue in yellows is your soft spot. 3 rounds?") or the due check-in. Never a hero.
- **Games:** a 3-column grid of 7 tiles, in order: Odd one out, Gradients, Study the map, Across the line, Painter's eye, Color memory, Name it fast. Each has a *personal* meta ("Level 13", "12 of 20", "Best 6 of 8"), never "New" on a played-out screen. A first visit shows one gentle "Start here" on Odd one out only.
- **Drills:** three rows that each open a shelf.
- **Under the drills:** Your eye.
- **Cuts and merges:** the Mix tiles for n-back, Imposter, Out of order and Rebuild leave the room (their renderers stay for `GAME_STEPS`). Today's gradient leaves the grid.
- **Result:** it fits one phone screen to the drills, and today is the first thing you see.

**2. Make the results honest per game (S, `oo-ui.js` ooResults + line.js, pairs.js, oo-mix.js, gym.js).**
- `ooResults` takes a `kind` ("eye", "words", "art", "memory") that picks the lede, the fine print (CIEDE2000 only for eye games) and the three star labels.
- Persist the stars for Across, Pairs and Whose as a max with the old ones. Animate only the stars that are new.
- Fix the Whose overwrite and its hard-coded `pb:false`.
- Lightning: show the number named, with points separate, plus a misses row.
- Fix the Pairs caption when the artist is blank.

**3. Stop the Learner Model pollution and log the word games (S, `oo-ui.js:117`, `learner.js:196`, `line.js`, `gym.js` lightning, hue-ui.js:239).**
- `ooLogMiss` logs a `confuse` only when both colors carry names. Perceptual hex pairs go to `S.gymMiss` (the eye lane's list) instead.
- `confusions()` skips pairs without names.
- Across logs `answer` (with the category name) plus a named `confuse` (the category vs the neighbor).
- Lightning logs answers and confusions with names.
- **Effect:** You → mix-ups, Learn's mix-up deck and Study the map seeds show real word confusions again. Today they fill with two random reds after one Odd one out set.

**4. Fix the sound leak, and add "hear it resolve" (S, `sound.js` + hue-ui.js).**
- In the click listener, skip the color note when the target is inside an unsolved play board (`.hg-play .hg-s`, `.oo-ostrip`, `.oo-tray`, any `.oo-play` stage before its answer). Play the soft tap instead.
- On solve, roll the board's colors as an ascending `sfxChord` by L\* (rows, then columns, about 1.2 s).
- Odd one out mastery plays the level's base and odd notes as an interval that narrows as the levels climb.
- **Result:** no cheat, and the signature moment is "a solved gradient is a scale".

**5. Make Across the line click (M, `line.js`, `oo-engine.js` ooLineRound, `eye-names.js`, color page hook).**
- **The board:** show the category's swatch as a small labeled anchor chip above the board, and draw category words from your Learn words (the ~1,000) once you know 6.
- **Confident edges:** keep only rounds where the odd tile's nearest-name win margin is at least 30%.
- **On a miss:** "In ColorHub's map this side is *petrol*; dictionaries draw it a little differently".
- **After the reveal:** "Add *petrol* to your words" (Learn) and "See this edge on the map".
- **Entry point:** add "Where does it end?" on every color page, which opens eight rounds of that word against its nearest neighbors.
- **Shared with Odd one out:** apply the same Learn-layer naming to the settle line ("Both are rose red; this difference has no word"). That fixes A7 and makes every eye round a word round.
- **Why:** this is the mechanic that is uniquely ColorHub. It's almost there; the anchor and the confident edge are what make it fair.

**6. One eye, one honest check-in (M, `challenge.js` eyeReport, oo-ui.js ooEyePage, gym-engine.js check-in).**
- **One page:** merge the two eye pages into one, with:
  - the eye map (9 families × 3 axes, colored by threshold, each cell playable as a pinned set);
  - the check-in trend;
  - one calibration sentence;
  - History behind a link.
- **The check-in:** rebuild it as a weekly fixed-seed board of about 3 minutes. It covers Odd one out across the 3 axes at fixed gaps from the 1–20 ladder, plus 3 Across edges and 2 Color memory rounds, with no feedback. Unlock it after two Odd one out sets, not "three drills".
- **Retire the station check-ins.** Their history stays under History.
- Fix the 440 px wrap in the value column.
- **Result:** there's one level number in the whole app ("level 13" means one thing), and the weekly honest number covers the games people actually play.

**7. Painter's eye: merge Whose palette? and Painters' pairs into one art game (M, `oo-mix.js` whose, `pairs.js`, data builds).**
- **Two round types** share one setup screen (For you / Choose).
  - **Finish the palette:** four colors from a real painting, and you pick the fifth the painter used from three options. The decoys are colors painters avoided with these (from the existing lift table). The reveal is the painting with the color found in it, and the lift in plain words.
  - **Whose painter:** five colors, and three choices shown as *one thumbnail each* of their most typical painting. Start from about 30 famous painters and widen to movements and the long tail as accuracy grows. Each reveal says the painter's signature in a sentence and links to the painter page.
- **Result:** the art data stops being trivia and becomes something you can see and learn. It connects to painter pages, painting pages and Looks.

---

## Almost-perfect mechanics, and the one thing that makes each click
- **Across the line:** an anchor swatch plus confident edges only.
- **Painters' pairs:** ask "finish the palette", not "which statistic".
- **Whose palette?:** famous first, thumbnails instead of strips, the signature said out loud.
- **Lightning:** real swatches, decoys from your confusions, and the misses become a deck.
- **What changed? / Was it there?:** one ladder, and a source you saw earlier today.
- **Squint:** the reveal is the painting's value key.
- **The check-in:** the same ladder as the games, and unlocked by the games.
- **Sound:** silence while you solve, a scale when you finish.
