# Ideas 10×: Learning (the path, the deck, Learn it, Practice, voice, streaks, rewards, the Cabinet, tests)

Panel brief: `design/IDEAS-10X/BRIEF.md`. Builds on `design/GENIUS-PANEL-1.md` and doesn't repeat it. These ideas assume its L19 Learner Model (`lmLog` and its readers) and its ColorSet verbs exist. Its ideas aren't restated here: world steps from your trail, personal look-alikes, photo missions, "words you didn't have", the guess-first camera, "Learn this painting", "repaint a masterpiece", the mix-up atlas, Color DNA and "fly to the map".

Grounded in the code as of `main` f943617:
- `js/learn.js`, `learnit.js`, `pickit.js`, `produce.js` and `core.js`;
- Practice (`js/practice.js`, 1,478 lines, unmerged, in worktree `agent-a647b2e…`);
- `design/JOURNEY.md`, ROADMAP §1, §14 and §20, and the learning KB.

New numbers in this file were computed today from `data/corpus/*.json` (23,531 paintings, top-6 palettes with area shares) and `data/core-names.json`. The scripts are in this session's scratchpad. The repo was not touched.

---

## 1. Diagnosis: what's boring, thin, confusing or ugly today

1. **The path is still the 101, in family blocks.**
   - Learn's `home()` draws `UNITS` from `data/colors.js` as "Reds & *pinks*"-style units. That's exactly the "just the blues, then the reds" David called boring (ledger X22).
   - Past the last unit, the path stops: "The path is *complete*. More tiers are coming."
   - Being stuck on the 101 is David's #1 open ask (ledger L8, Top-25 #1).
2. **The 101 is shown as a special list,** against the CLAUDE.md rule.
   - The Learn room's collection quilt reads `n/101` (`<small>/${ALL.length}</small>`).
   - The welcome screen still says "Learn them a family at a time".
   - The placement result names a "tier".
3. **About 900 core names can't be learned at all.**
   - `names.js` only offers *Learn it* when `BYNAME.get(name)` finds one of the 101.
   - `hmLearnGroup()` only draws look-alikes from `BASICS + ALL`.
   - `S.cards`, `dueList()`, `ownedCount()` and `pickMix()` all iterate `ALL`.
   - Practice (unmerged) can drill all 1,000 names, but by design an unlearned color never touches scheduling. You can practice *puce* forever and it will never come due and never become Yours.
4. **A lesson is one gesture repeated about 10 times.**
   - `meet(u)` is a vertical pager, then `deck("learn")`, which is self-graded swipes, then a text Done screen.
   - The objective checks (Pick it, Say it, Make it) appear only in *review* sessions.
   - A lesson has no guess-first, no world step, no game, and no recall climb.
   - Producing a name never happens on day one.
5. **Placement measures the wrong thing, once.**
   - It's 60 seconds of "tap this name's color among four shades": recognition only, and only for tiers 2 and 3.
   - It ends with a tier name.
   - Nothing about it can be retaken later to show growth.
6. **The Learn room competes with itself.** Under one primary card sit:
   - "Today's three" (Challenge, Today's color, Train);
   - the path;
   - the quilt;
   - an install card;
   - a backup card;
   - Settings.

   The app's only streak today is the Challenge's (`chStreak()`), and that's a perception game, not learning.
7. **Rewards don't exist yet.**
   - The Cabinet, lesson-complete moment, seals, exams, Skill check and streak are all on paper (JOURNEY §10–11).
   - Today a lesson ends in a sentence and a count.
   - "Yours · 64" is honest, but it's abstract: 64 of what, and what does word 65 buy you?
8. **Voice is half there and confusingly named.**
   - In `produce.js`, "Say it" means *type* the name.
   - Practice's `say` uses the mic and handles "I don't know", "skip" and "stop", but it isn't merged and hasn't been tested on an iPhone (ledger Q8).
   - Nothing helps you *pronounce* a word you've only read (ecru, taupe, gamboge).
9. **JOURNEY.md risks becoming a mechanics zoo.** It lists streak, freeze, daily ring, combo, clean dot, gold, legendary, seals, checkpoints, jump-here, exams, skill check, leagues and the Cabinet. That's 14 systems. Meanwhile the thing that should be the emotional center, *seeing more*, has no picture anywhere.
10. **One finding from today's computation sets a guardrail for everything below.**
    - Naively ranked by how much archive canvas they'd newly name, the best words to teach after the current 101 are:
      1. *Ink* (+11% of all paint area)
      2. *Bistre* (+9%)
      3. *Dark walnut* (+9%)
      4. *Café Noir* (+8%)
    - That's varnish and museum cameras talking, not usefulness.
    - Any data-driven learning feature has to measure each "world" separately and use the within-painting lens (see idea 8).

---

## 2. North star

**Learning in ColorHub becomes the visible widening of what you can name.**
- **Every word you earn shows up in the world.** The museum gets more nameable, your own photos repaint themselves in your words, and a painting you couldn't describe yesterday has a word in it today.
- **The path is one spine, but the whole app can pull words into it.** Anything you meet in Explore, Studio, the camera or an article can become your next word, taught in the place you found it.
- **Every test is a real act of naming,** a day or more later, without help: free naming, edges, recall in a painting, out loud.
- **The rewards are true things:**
  - paintings you can now fully name;
  - a diary of the colors you won;
  - a Cabinet whose labels are your own provenance.
- **Words and eyes grow together.** A name you can't yet see waits for your eye, and the grammar of difference ("a little bluer than teal") lets you name the 3,700 colors between your words.

---

## 3. Ideas, ranked

★ marks the five best. Effort is S (under a day), M (1–3 days) or L (more). "Connections" lists the systems each idea feeds and reads.

### 1. ★ The Nameable Museum (your words, painted)

**What it is:**
- **Your words, painted.** Any painting, and later your own photos, is redrawn using *only the words you own*. Each patch is filled with its nearest word's color.
  - Hold to see the real canvas.
  - Tap a patch to open that word's page (one tap, no sheet).
  - A three-stop control switches between *Everyday words* (the 11 basics), *Your words* and *Every name*.
- **Paintings you can fully name.** A live count over all 23,531 paintings of how many have all six main colors close to a word you own. Explore gets a shelf of them, newest first.

**Why it's 10×:** it turns "Yours · 64" into what a word buys you, as a picture. Computed today (draft order, "close" = CIEDE2000 ≤ 6, as photographed):

| Words you own | Archive paint area close to one of your words | Paintings fully nameable |
|---|---|---|
| 11 basics | 12% | 0 |
| 100 | 29% | 37 |
| 250 | 54% | 1,088 |
| 1,000 | 99% | 22,351 |

- *The Starry Night*: not one of its six main colors is close to a basic word. Its share covered goes 0% (basics) → 75% (the current 101) → 100% (1,000).
- *The Kiss*: 0% → 9% → 72% at 250 words.
- Every lesson visibly changes a canvas: "Mauve now names 3% of *The Birth of Venus*."

**Connections:**
- Learner Model (your word set);
- painting pages ("See it in your words");
- Explore (the shelf);
- Journey (lesson complete shows the patch that changed);
- Cabinet (newly nameable paintings drop into Paintings);
- Studio photos (your photo in your words);
- the stage-exam share card (before and after).

**Effort:** S for the featured paintings (local images, client-side); M for the archive count (lazy corpus shards plus a worker).

**Honesty risk:**
- It measures *words*, not eyesight. The copy never says "you can see 54% of art".
- Everything is "as photographed".
- The brown archive makes the basics look worse than they would on a sunny street, so say that.
- The 600-word jump in the draft order is partly the alphabetical tail. Recompute once the real stage order lands.

### 2. ★ Free naming, before and after

**What it is:**
- **The test.** 12 swatches in about 90 seconds. Name each one any way you like: typed, spoken, or "I don't know".
- **Scoring.** It counts distinct, accurate words beyond the basics. *Accurate* means a real name, or a correct modifier phrase, within a stated tolerance of the swatch.
- **Three forms.** A, B and C are matched in difficulty and rotate, so you never retake the same 12.
- **Where it runs.** It opens the app (as placement) and closes every stage exam.
- **The result.** It's always shown beside your first run: "Day 1: 6 words. Today: 19, all from memory."

**Why it's 10×:**
- It's the most honest learning measure there is: free, unassisted, delayed production (KB §1, §3).
- It has a published anchor: Lindsey & Brown (2014), where adults freely naming used roughly 10–12 words beyond the basics.
- It replaces a recognition placement with a production one.
- It gives the stage-exam card a true before and after: the thing people actually want to share.

**Connections:**
- Journey (start point and stage exams);
- Learner Model (an accurate free word for a word you've met, a night or more later, counts as a delayed recall; unmet words you clearly know become "placed");
- the difference keyboard (idea 3: phrases count);
- the Nameable Museum (it re-renders with the words you just proved);
- the one share-card renderer.

**Effort:** S–M.

**Honesty risk:**
- Never compare with other users. The study norm is labeled as one study (verify the figure before shipping).
- The matcher must be forgiving on spelling but strict on meaning: the word must be a real name close to the swatch.
- Screens vary, so add the usual approximate-color note.

### 3. ★ The difference keyboard (the grammar between the words)

**What it is:** a fixed keyboard of the direction words `lookDiff()` already uses: lighter · darker · more vivid · duller · redder · yellower · greener · bluer · purpler, plus "a little" and "much". Three uses:
- **Describe:** two swatches, one of them named. Tap how the other one differs ("a little darker, bluer than teal"), graded against the measured LCh.
- **Build:** a phrase ("dusty pink") → pick the color.
- **Name anything:** a camera, photo or painting color you have no word for gets named relative to one you own.

Spoken phrases ("bluer than teal") go through the Say-it matcher, which covers David's "abbreviation or phrase" ask (ledger F3).

**Why it's 10×:**
- Words cover points; grammar covers the space between them. One small, fluent skill makes all ~3,700 names, and every unnamed color, describable.
- It answers JOURNEY open question 1: the 386 grammar-built core names ("Light blue", "Dull green") become *producible* instead of memorized.
- It trains the eye gym's three axes through language.

**Connections:**
- Train (the "Which direction?" twist uses the same chips, and misses feed the 3-axis profile);
- Learner Model (axis errors);
- camera (describe a find);
- color pages (look-alike rows read in keyboard words, and a chip hops to the neighbor);
- Journey (chapter 1–2 skills, value and warm/cool, are taught *as* this keyboard).

**Effort:** M.

**Honesty risk:**
- The hue words are a convention (Webster's Third and Godlove); say so once.
- Tolerances per axis are stated.
- "Warmer/cooler" appears only as painter's shorthand, defined explicitly. Never claim that warm colors advance (myth list).

### 4. ★ Edges: where a name ends

**What it is:**
- A strip of 9 steps runs from a word to its nearest neighbor (teal → cerulean).
- The prompt: "Tap the last one you'd still call *teal*."
- The reveal:
  - labels every step with its nearest name from the full list, which exposes the in-between words that live there;
  - marks where the two names' colors meet halfway;
  - adds one line about your border ("your teal reaches a step further toward cerulean").
- Over time it builds *your* border map, and every confusion pair gets an edge round at the exact zone you dispute.

**Why it's 10×:**
- Naming is categorization. The skill isn't knowing teal's center but knowing where teal stops.
- Category boundaries trained with feedback are the strong form of interleaving neighbors (KB §8) and perceptual learning (N7).
- The reveal is a doorway to new words ("step 6 has a name of its own: *peacock blue*"), which feeds idea 5.

**Connections:**
- Learner Model (a boundary bias per pair);
- Journey (a 10-second step right after meeting a pair; a seal variant);
- Train (an *Edges* station with a staircase);
- color pages ("Where teal ends", a strip of tappable steps);
- Color Graph (look-alike edges choose the pairs).

**Effort:** S as a step inside Learn it; M as a station.

**Honesty risk:**
- There is no true boundary: names are fuzzy and lists disagree. The reference is "where most name lists switch", never "you're wrong".
- It's a judgment, not a recall, so it never counts toward Yours.

### 5. ★ Words you asked for (the whole app pulls into the path)

**What it is:**
- Wherever a name you haven't met appears, a small, consistent *Learn next* mark sits beside it:
  - a painting finding;
  - an article;
  - a poem line;
  - a camera reading;
  - an Edge reveal;
  - a photo palette.
- It adds the word to a 6-slot *Up next* shelf.
- Your next lesson teaches those words first, and uses *the very painting, line or photo where you found it* as that word's world step.
- It works for all ~1,000 core names, and later the library.

**Why it's 10×:**
- The path pushes, and this lets the whole app pull.
- Words learned at the moment of need stick (KB N3, "personalize through use"; Badass's just-in-time teaching).
- The place you found a word is its best retrieval cue (§9).
- It finally ends "stuck on the 101" in a way that feels like curiosity, not a bigger list.
- It's still not lesson-picking: the path composes the lesson.

**Connections:**
- Explore, painters, articles, poems, camera and Studio photos (the sources);
- the Journey composer;
- Learner Model (`ref` = where you found it);
- Cabinet (the source piece becomes that word's first card).

**Effort:** M. It needs card ids for all names, which is L9's job.

**Honesty risk:**
- It's capped at 6 on the shelf and 2 per lesson, so the stage order still teaches the useful core.
- Words you ask for still need delayed recall to become Yours.

### 6. Bet on tomorrow

**What it is:**
- At lesson complete: "How many of these 4 will you name tomorrow?" One tap, 0–4.
- Tomorrow's wake step ends with "You bet 2. You named 4."
- After a few weeks the Skill check shows a calibration line: "When you feel sure, you're right 9 times in 10. When you guess, 4 in 10."

**Why it's 10×:**
- It turns the KB's most important finding into a game: how learning feels isn't evidence of learning (§3), and calibration can be trained (§16).
- It gives a truthful reason to come back: curiosity, not guilt.

**Connections:** Learner Model (`conf` vs `ok`), Journey (wake step), Skill check, the color diary (idea 11).

**Effort:** S.

**Honesty risk:** low. A low bet is never punished, and same-day answers never settle a bet.

### 7. Chapters with a home

**What it is:**
- From chapter 5 on, each chapter's ~25 words (still taken from the stage order) are grouped by where they **live together** in the archive, using paired-with lift.
- Each chapter is hosted by a painter or movement: "Hammershøi's greys", "Corot's greens", "Venetian reds".
- Meet cards, world steps and the seal are set in the host's paintings. The seal is "name 8 colors in this room".

**Why it's 10×:**
- JOURNEY §8 shows text strands vanishing after word 100, and museum paintings carrying stages 4–5: 71 of stage 5's 100 words have one.
- This makes the archive the curriculum's home instead of a fallback.
- Every late chapter ends with a painter's palette you can name.

**Connections:**
- Color Graph (pairs);
- painter pages (the host's card unlocks at the seal);
- Cabinet;
- Nameable Museum ("You can now name every main color in 14 Hammershøis");
- Journey.

**Effort:** M (offline grouping in the journey build).

**Honesty risk:**
- Use the within-painting lens and the per-museum baseline, with pair support of at least 10.
- Say "where these colors live together", never "his favorite colors".

### 8. Every world, its own coverage ("why this word, now")

**What it is:**
- The ordering job and each meet card get a *why this word* line.
- It's measured as coverage gain in **separate worlds**, each capped:
  - flowers;
  - gems;
  - fashion decades;
  - paintings (within-painting lens);
  - Ngram color-sense usage;
  - privately, your own photos.
- Example: "Why ochre now: it names a color in 1 of 9 of these paintings and 3 of the decade palettes you'll meet."

**Why it's 10×:**
- It gives the stage order a second, honest signal and ends the alphabetical tail (Xanadu in stage 5).
- It exposes the Ink problem (diagnosis 10) instead of hiding it.
- Every new word arrives with a reason you can see.

**Connections:** Color Graph, Journey order, Nameable Museum, Studio photos, Explore's For you ("words that would name most of what you saved").

**Effort:** M.

**Honesty risk:**
- The line always names its world.
- Your photo coverage is shown only to you.
- Never one blended "usefulness" number.

### 9. The namesake beside the name

**What it is:**
- For colors named after things (mauve and the mallow, lilac, salmon, lapis and ultramarine, amber, jade, celadon glaze, robin's egg), the meet card shows a photo of the real thing beside the swatch.
- It asks one question: "Is the color darker, lighter, or about the same as the flower?" Then it gives the measured answer.

**Why it's 10×:**
- It teaches you to *look*: the color named for the mallow isn't the mallow.
- The etymology becomes both a memory hook (elaboration) and an observation exercise.

**Connections:**
- Color Graph (*named after* edges);
- `botany-images.js` and `gem-images.js`;
- articles (the nature-named tier);
- Cabinet (a namesake card);
- camera ("find a real lilac").

**Effort:** S–M.

**Honesty risk:**
- Photos vary, so compare against the measured region of that photo.
- Use only named-after links that have a fact card. No "isabelline = unwashed linen".

### 10. Color dialects (fields as registers)

**What it is:** David's Fields ask (ledger L7), done as **dialects**.
- The same color is *burnt umber* to a painter, *saddlebrown* to a web designer, *mocha* in fashion, and "greige" in an interior.
- Each word card shows its siblings in other dialects.
- One step asks "Say it like a painter".
- Your field reorders the words *and* chooses which dialect shows first.

**Why it's 10×:**
- Only this app has every name tagged by source (`src`: css, xkcd, iscc-nbs, pigments, Crayola, RAL, Werner).
- It teaches that names are tools of a trade, not trivia.

**Connections:**
- Color Graph (*same pigment, different name*);
- Practice (dialect decks);
- Journey (the field chapters);
- articles (the standards tier).

**Effort:** M.

**Honesty risk:**
- Registers are tendencies drawn from source lists.
- Pantone and RAL hexes are approximate.
- No trademark claims.

### 11. The color diary (a streak made of color)

**What it is:**
- The streak is a strip of days. Each day's cell is filled with **the color you won hardest that day**: the one you missed and then got right, or a camera find you named first.
- A missed day is blank paper, never red.
- After a year it's a 365-cell quilt, "Your year in color", shareable.

**Why it's 10×:**
- A streak that's beautiful and personal instead of a flame.
- It replaces the Challenge's separate streak with one learning streak.
- It's the natural share object.

**Connections:** Learner Model, camera, Journey, the share-card renderer, Cabinet (a Diary drawer).

**Effort:** S–M.

**Honesty risk:**
- Label it "days in a row you practiced", never skill.
- Freeze rules as in JOURNEY §10.

### 12. Provenance labels, and your own line

**What it is:**
- **Labels.** Every Cabinet word card carries a museum-style label written from your own log: "Mauve. Met 3 Oct in Teasdale's *Sunset: St. Louis*. Yours since 5 Oct. First found: your scarf photo, 9 Oct."
- **Your line.** Once a word is Yours, one optional prompt asks "Where have you seen mauve?" You write a few words, which stay private and local. Your line comes back on a later review, *after* the attempt.

**Why it's 10×:**
- Elaboration in your own words (*Make It Stick*; KB N4: once competent, self-author).
- Transfer: "where have we seen this before?" (§9).
- The Cabinet becomes a memoir of seeing, not a sticker book.

**Connections:** Learner Model, Cabinet, camera, Studio photos, color pages ("You and this color").

**Effort:** S–M.

**Honesty risk:** the dates are real events. The note never appears before an answer (A11).

### 13. One name, many colors

**What it is:**
- A step, plus an Explore hub, for names that mean different colors in different systems:
  - Cerulean (the pigment vs Pantone's 2000 Color of the Year);
  - Magenta (the dye vs process ink vs CSS);
  - Sapphire (the gem vs Crayola);
  - Puce;
  - Cerise.
- The step asks "Which one is the painters' cerulean?", then shows all the versions side by side, with sources and dates.

**Why it's 10×:**
- Names are agreements with histories, and this inoculates against "the" hex.
- It makes the panel's disambiguation pages playable.

**Connections:** Color Graph (disambiguation), articles, Practice, Journey (the design step).

**Effort:** S.

**Honesty risk:** low. Screen approximations, with a source and date for every variant.

### 14. Pronounce it

**What it is:**
- A small speaker on meet cards and color pages (the browser's `speechSynthesis`) for the names people stumble on: ecru, taupe, puce, cerise, celadon, gamboge, vermilion, chartreuse, sienna, coquelicot, glaucous.
- Say it accepts what the recognizer writes for those words ("taupe" heard as *tope*, "ecru" as *a crew*).

**Why it's 10×:**
- Say it is unfair for a word you've only read.
- This makes the voice modes work for adults learning names from print.

**Connections:** voice (Say it, RAN), color pages, Journey meet step, articles (the definition line).

**Effort:** S.

**Honesty risk:**
- Device voices vary.
- Give both pronunciations where usage splits (mauve: "mohv" or "mawv").

### 15. Color RAN (fluency, out loud)

**What it is:**
- Rapid automatized naming: a 4 × 5 grid of 20 of your Yours colors.
- Say them in order as fast as you can, and the recognizer checks the sequence.
- You see your time and errors against your own last runs.

**Why it's 10×:**
- Knowing a word isn't having it fluent (KB §10: prerequisites must be fluent).
- Fluency is what makes "salmon" arrive when you look at a sunset.
- It's also a 20-second voice game that's fun to repeat.

**Connections:**
- voice;
- Learner Model (latency per word);
- Train (a station);
- stage exams (a fluency line on the card);
- Practice.

**Effort:** M. Continuous recognition is flaky on iOS, so the fallback is tapping the names in order.

**Honesty risk:** compare only with your past self. Forgive recognizer errors with a manual correct button.

### 16. Memory drift

**What it is:**
- *Make it* (build the color from memory) already records each attempt. Add the direction of every miss.
- Per family it reveals your drift: "You remember blues bluer and greens more vivid than they are."
- A drift check step brings the drifting word back.

**Why it's 10×:**
- Memory for color is biased, and seeing your own bias teaches the eye.
- It uses data the app already gathers.

**Connections:** Train (the memory station), Learner Model (3 axes), color pages, Journey review steps.

**Effort:** S–M.

**Honesty risk:**
- Show only your measured drift, with n.
- Describe the general effect as "for many people", with no fixed numbers.

### 17. Crowded words come back sooner

**What it is:**
- Review intervals adapt to three things:
  - how crowded a word's neighborhood is (known words within a close match);
  - how common the word is (xkcd, Ngram);
  - your misses against its neighbors.
- It's a half-life model in the spirit of Duolingo's, kept simple enough to test.

**Why it's 10×:**
- Today's fixed ladder (1, 3, 7, 16, 35, 90 days) treats teal and fuchsia alike.
- Words with close neighbors decay faster.

**Connections:** Color Graph (look-alike density), Learner Model, Journey review stones, Practice's Tricky list.

**Effort:** M.

**Honesty risk:**
- Start conservative.
- Log predicted vs actual recall (developer view).
- Never claim "optimal".

### 18. Today's color becomes your wake step

**What it is:** the daily *Today's color* tile stops being a random name-it. It becomes one of your **due** words, shown on a real surface (a flower, a gem, a painting crop or a fashion plate): the first and best recall of the day.

**Why it's 10×:** one fewer side-quest, and one more varied-surface, delayed recall (§2, §9) that keeps the one-tap daily habit.

**Connections:** Journey, botany, gems, painters, Learner Model, the color diary.

**Effort:** S.

**Honesty risk:** the same rules as review.

### 19. Word-family decks

**What it is:** Practice decks built from the names themselves. Each deck opens with one line about its root.
- every *rose* (old rose, rose taupe, rosewood, rose quartz);
- every *-marine*;
- every *royal*, *sea* or *sky*;
- every name from a mineral;
- every name from French.

**Why it's 10×:** morphology makes 1,000 names feel like about 150 roots plus a grammar, which is how vocabulary really scales.

**Connections:** Practice, Color Graph (*derived from*), articles (etymology), the difference keyboard.

**Effort:** S.

**Honesty risk:** roots come from fact cards, never folk etymology (no "guarantee" from *garance*).

### 20. Nameless finds

**What it is:**
- When the camera or a photo meets a color with no name in the whole library within a close match, it says so: "English barely has a word for this. The nearest is slate, 9% away."
- Describe it with the difference keyboard and keep it in a *Nameless finds* drawer.

**Why it's 10×:** a collectible that teaches where words run out, and sends people hunting for the gaps.

**Connections:** camera, Studio photos, Cabinet, the difference keyboard, Color Graph.

**Effort:** S.

**Honesty risk:** say "nameless in our ~3,700-name list", not "in English" or "in any language".

### 21. Words wait for your eye

**What it is:**
- In stages 7–9, the finest distinctions wait until Train shows you can see them: two words closer together than your measured threshold for that family.
- The path says so plainly and offers the station.

**Why it's 10×:**
- A name you can't see is a label, not a lens.
- This ties vocabulary to perception, the app's two halves.

**Connections:** Train (thresholds), Journey order, Learner Model, color pages ("Can you see the difference?", from the panel).

**Effort:** M.

**Honesty risk:**
- Thresholds need enough trials, and hold "on this screen".
- Never gate the early stages.

### 22. The ones that stick

**What it is:**
- Confident or quick misses (from the guess step and from answers under 1.5 s) get a quiet mark and return first tomorrow.
- Lesson complete frames them positively: "2 confident misses. These are the ones that stick."

**Why it's 10×:** hypercorrection is one of the KB's strongest levers (§5, verdict a.3), and the copy makes error feel like progress.

**Connections:** Learner Model, Journey (wake step), Bet on tomorrow, Skill check.

**Effort:** S.

**Honesty risk:** low. Keep the line descriptive, never "you're improving".

### 23. Send a lesson

**What it is:**
- Any set (a painting, a palette, your photo's palette, a word family) becomes a 3-minute lesson link.
- The set is encoded in the URL, so no accounts are needed.
- A friend plays it, and nothing posts without a tap.

**Why it's 10×:** the app spreads by teaching, not by boasting.

**Connections:** ColorSet `learnSet`, Practice, Studio, router, the share card.

**Effort:** M.

**Honesty risk:** no score comparison (duels are deferred, ledger X3). The friend's progress stays on their phone.

### 24. Field exams as real jobs

**What it is:** every stage exam ends with one applied task in your field, built from our data:
- **Painter:** name the 5 earths in this Corot, then order them by value.
- **Designer:** name a palette, then pick the pair that passes text contrast.
- **Interiors:** name the whites in this room photo.
- **Film and photo:** name the skin and the sky in a public-domain photograph.

**Why it's 10×:** the KB's reliability bar ("given a real situation, I can…") turns a vocabulary into a working skill.

**Connections:** Fields (idea 10), painters, Studio, Train, Journey exams.

**Effort:** M–L.

**Honesty risk:** "as photographed". Contrast uses the WCAG formula, stated.

---

## 4. Kill list (surface that doesn't add seeing)

1. **The 101 family-unit path** (`UNITS` units titled by family) and its "More tiers are coming" ending. Replace it with the Journey's stage order across all ~1,000 core names.
2. **The `n/101` quilt** on the Learn room. Replace it with "Yours · n" and the Nameable Museum card. It breaks the "never the 101" rule.
3. **The welcome copy** "Learn them a family at a time" (contradicts ledger X22). Also drop the word "tier" from placement results.
4. **The 60-second tier placement** (pick the color from four). Replace it with free naming (idea 2), followed by the JOURNEY §7.1 adaptive probe.
5. **"Today's three" as tiles competing with Continue:**
   - Challenge moves to Train;
   - Today's color becomes the wake step (idea 18);
   - Train stays as one quiet row.
6. **Same-session reward signals in JOURNEY §10:**
   - Cut the *clean-lesson dot* and the *combo* meter: same-session scores under-report learning (§1 caveat), so they're noise dressed as progress.
   - Keep the haptic on a run of rights.
   - Keep streak (as the diary), seals, exams and gold.
7. **The "what do you make" media question** in `profileSetup()`. Fold it into Fields and dialects (idea 10), so there's one setup screen, not two.
8. **Practice's 11 method buttons shown at once.**
   - Lead with Flashcards, Quiz, Type it, Say it, Match and Test.
   - Put Pairs, Color rain and Blitz under one *Games* row.
   - Blitz yes/no never schedules anything and a coin flip gets half, so it adds speed, not seeing.
9. **The name clash between *Say it* (which types) and Practice's *Say it* (which uses the mic).** Rename the typed one *Type it*, everywhere.
10. **The self-test experiment toggle** (`expUnit` and friends). Move it to a developer flag, not the user menu.
11. **Shading the honeycomb by learning status** (panel 1, L18's "Your map"). David rejected progress marks and dimming on bubbles (ledger X7: "true colors only; progress is a view toggle"). The Nameable Museum is where progress becomes visible instead.

---

## 5. The wow moment (first 60 seconds)

1. **Second 0.** First open of Learn. *The Starry Night* fills the screen, painted only in the 11 everyday words: a flat, wrong poster in brown, blue, black and yellow.
2. **The line:** "This is *The Starry Night* in the words everyone knows. None of its six main colors is a close match."
3. **The first gesture.** Hold, or drag the divider, and the real painting blooms back.
4. **The next line:** "Painters and designers have a word for each of these. Let's see how many you have."
5. **Seconds 10–70.** Free naming: 12 swatches, any words you like.
6. **The payoff.** The painting re-renders in *your* words. You watch it gain the patches you just proved you can name: "Your 17 words name 41% of this canvas."
7. **The primary button:** "Learn the next ones". The first lesson's new words are the ones that light up the most of that very canvas, honestly capped per world.

**Why it works:**
- It's true, measured and beautiful.
- It shows the app's soul (a name is a lens) before any explanation.
- The same before/after closes every stage exam.

---

## 6. Buildable today (each under 4 hours)

All three are additive and use only merged code (`main`):
- Prefix every global name (all scripts share one scope).
- Run `node tools/check.js`, `check_wiki.js`, `check_names.js`, the undefined-name scan and the `colorhub-verify` skill.
- Take screenshots at 375 × 812.
- Don't bump `?v=`: the conductor does that.

### B1. Your words, painted (Nameable Museum v1, featured paintings), about 3 h

**Files:**
- new `js/wordspaint.js` (prefix `wp`);
- new `css/wordspaint.css`;
- one script tag and one link tag in `index.html`;
- one `ROUTED` line in `js/router.js` plus an `openRoute()` case for `#/words` and `#/words/<painting-id>`;
- one card in `learn.js home()`, placed above "The path" (additive; it doesn't remove the quilt yet).

**Data (all already loaded):**
- `window.PAINTINGS`: 22 featured paintings with **local, same-origin** images in `img/paintings/`, so the canvas can read their pixels;
- `BASICS`;
- `ALL` with `S.cards` (*met*) and `isMine()` (*Yours*);
- `loadCoreNames()` → `CORE_NAMES` (each entry already carries `lab`) for *Every name*.

**Algorithm:**
1. Draw the image to an offscreen canvas about 220 px wide and read `getImageData`.
2. Quantize each pixel's RGB to 5 bits a channel, giving a lazy lookup table of 32,768 buckets.
3. For each bucket's center: Lab → nearest word in the active set by `de2000` (word labs precomputed) → store the word index and the distance.
4. Paint each pixel in its word's hex. Show the canvas scaled up with smoothing, for a soft poster.
5. **Coverage** = the share of pixels whose nearest word is within CIEDE2000 6.
6. Cache the result per painting × word set in memory.

On a phone this is about 3,000 used buckets × at most 1,000 words, well under a second. Show a 200 ms fade.

**Screen:**
- Warm black, with the title and artist as a `note`.
- The canvas in your words. Press and hold to see the real painting (a divider drag is v2).
- Below it, an opaque 3-stop segmented control: *Everyday words* · *Your words (n)* · *Every name*.
- One line: "Your n words name 41% of this canvas". The copy never shows ΔE.
- A footnote: "As photographed. Each patch is the nearest word in this set."
- **Tap any patch:** open that word's page (`hmOpenColor` or the name route, one tap, no sheet).
- **Swipe left or right:** the next painting, ordered by the biggest gap between your words and *Every name* ("the painting your words see least" first).

**Test:** `tools/wordspaint_test.js`. A pure `wpCover(palette, words)` on the paintings.js palettes must match today's Python numbers within 1 point, for example *The Starry Night*: 0% (basics) and 100% (every name).

**Screenshot hook:** `#shot=words:basics|yours|all`.

### B2. Free naming, before and after (v1), about 3.5 h

**Files:**
- new `js/freename.js` (prefix `fn`);
- new `css/freename.css`;
- new `tools/freename_forms.py` → `data/freename-forms.json`;
- route `#/freename`;
- one quiet row in the Learn room: "How many colors can you name? · 90 seconds".

**The forms:** three forms of 12 hexes each, chosen offline from `core-names.json`.
- Spread them by farthest-point sampling in CIELAB, 2 per family.
- Each swatch has a precise core name within CIEDE2000 4, so a specific word exists.
- Each swatch is at least 10 from its nearest basic, so "blue" alone is a basic answer, not the precise one.
- Match the three forms on mean distance-to-nearest-basic.

**Screen:**
- One swatch fills most of the screen, with a text field and the keyboard up. Enter means next.
- A quiet *I don't know* link.
- A mic button when `speechCtor()` exists (from `produce.js`).
- No visible clock, and no feedback until the end: it's a test (KB N1).

**Scoring, a pure `fnScore(hex, text, names)`:**
1. Normalize with `sayNorm()`.
2. Strip known modifiers (light, dark, pale, deep, dusty, bright, muted, *-ish*, greyish…).
3. Match the head word with `sayDist()` tolerance against the core names and their `also` aliases, plus the library.
4. **Accurate** if the matched name's hex is within CIEDE2000 12 of the swatch (generous, because names are fuzzy), and any modifier points the right way (e.g. "dark" needs the swatch darker than the head word).
5. The score is the number of distinct accurate head words that aren't basics. Basics and blanks are reported separately.

**Result:**
- The 12 swatches, each with what you called it.
- An inaccurate answer is never red. It gets a note: "most lists call this *teal*". Every swatch is tappable and opens its page.
- The big line: "9 different color words, used accurately."
- One reference line, citing Lindsey & Brown 2014, with the figure checked before shipping.
- If a run exists from at least 7 days ago, the two runs sit side by side.

**State:** an optional new key, `S.freeName = [{t, form, ans: [[text, head, ok]]}]`. No migration is needed (`migrateState()` keeps unknown keys).

**Learner Model hook:** an accurate answer naming a color already in `S.cards`, last seen at least 1 night ago, calls `schedule(c, true, "say")`. That's a delayed, unassisted production, so it may make the name Yours (`pickit.js` rules).

**Test:** `tools/freename_test.js`. It covers typos, gray/grey, "it's a kind of teal", "dusty pink", aliases, and an empty answer.

### B3. Edges inside Learn it, about 2.5 h

**Files:**
- `js/learnit.js` (additive): a new `hmLtEdge(group, c, next)`, chained in `hmLearnIt()` between Recall and Tell apart;
- `css/learnit.css`;
- new `tools/edges_test.js`.

**Step:**
- **The rounds.** Use `(c, near[0])`, plus a second round with `near[1]` when it exists.
- **The strip.** Nine full-height bands on the booth grey, interpolated in Lab from c to the neighbor with `labHex()`. The two names sit under the end bands.
- **The prompt** (title-2): "Tap the last one you'd still call *teal*."
- **The tap** draws a 3 px ring on your band (opaque, no glass).
- **The reveal:**
  - every band gets a tiny label: its nearest core name (`nameOf`, once `loadCoreNames()` has resolved);
  - a hairline marks the midpoint, the first band nearer the neighbor than c by `de2000`;
  - one line: "Most name lists switch at step 5. Yours: step 6, so your teal reaches a little further toward cerulean."
- **An in-between name.** If any band's nearest name is neither of the two, the line adds "Step 5 has a name of its own: *Peacock blue*". That name is tappable and opens its page.
- **Next** goes on to Tell apart.

**State:**
- `S.edges[pairKey] = [[t, tap, mid]]` (optional key).
- It never counts toward Yours: it's a judgment, not a recall.

**Pure function:** `edgeStrip(aHex, bHex, n = 9) → {hexes, mid}`, unit-tested for symmetry, n bands, and a midpoint in range.

**Screenshot hook:** `#shot=learnit:edge`.

**Later:** the same render is exported as `PR_STEPS.edge` once Practice merges, and becomes the "Where it ends" strip on color pages.

**Runner-up (S, about 2 h):** Bet on tomorrow (idea 6). Add one tap row to `unitDone()` and `hmLtDone()` that stores `S.bets[day] = {ids, n}`, and one line at the end of the next `reviewDone()`.
