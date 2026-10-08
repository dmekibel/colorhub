# Train and every game, 10× (ideas round 2)

**Area:** the Train tab, the eye gym, and every mini game: `js/gym.js`, `js/gym-engine.js`, `js/match.js`, `js/challenge.js`, `js/taste.js`, the daily challenge and the color of the day, ROADMAP §2–5 and §20, COLORNERD-IDEAS §3 and §5.

**Builds on, and does not repeat:**
- **Genius panel round 1:**
  - boards from any set (`playSet`);
  - Whose palette?;
  - the three-axis eye profile;
  - the painting of the day (L16);
  - the mix-up atlas duel;
  - repaint a masterpiece;
  - the guess-first camera;
  - predict before you mix.
- **L10's Odd one out work in flight** (`.claude/worktrees/agent-aa578e91dc9550904/js/games/`):
  - a 24-level road in four mechanic worlds, with stars;
  - the Mix set: What changed?, Out of order, Rebuild, Was it there?, Imposter, n-back;
  - a random-color daily board;
  - painting-tile rounds;
  - the hidden eye model (`ooModel`, five judgments × family × axis);
  - `eyeThreshold()`, `ooLogMiss()`, `ooPlaySet()`, and Whose palette? rounds in `data/games/whose.js`.

Where an idea touches any of these, it says how it builds on them.

**Respects David's no's:**
- the seam game (X1) and Ghost of yourself (X2) are not here;
- duels and multiplayer are "later" (X3), so every social idea below is flagged and kept to the zero-backend minimum;
- no seasonal skins (X6);
- no marks or dimming on the home honeycomb (X7);
- one tap on any color opens its page (X14);
- never "the 101" (X19);
- no family-by-family drills (X22);
- recall before reveal (X29).

---

## 1. Diagnosis: what's boring, thin, confusing or ugly today

1. **Train is a lab menu, not a game.**
   - The Train home is a suggested card, an eye-profile block, then 19 near-identical tiles in six shelves (Foundations 5, In context 4, Applied 3, Colorist 3, Atelier 3, Game 1).
   - Every tile has the same anatomy (art, name, "Level N", a 20-segment ladder).
   - The one mechanic David's sister got hooked on is a single tile among 19, and it's always a 3×3 grid of flat squares for 12 trials.
   - Nothing on the screen says "play".
2. **Train never touches the two things that make ColorHub unique: names and paintings.**
   - `gym.js`, `challenge.js` and `match.js` never call `nameOf` or read the 1,000 core names.
   - Colors come from `metColors()`, the first taught colors, or from random LCh points.
   - The 23,531-painting archive enters only through Squint (22 paintings in `data/squint.js`) and Atelier's masses.
   - The eye is trained in a grey void and never told what it just saw.
3. **Feedback is a number, not a sighting.**
   - "The ringed one was off by 2.3%."
   - It never names the colors.
   - It never says whether that difference crosses a word ("teal" vs "petrol").
   - It never says where the pair lives in the world.
   - ROADMAP §10's "explain my miss" isn't built.
4. **Three dailies, none with content.**
   - `challenge.js` gives six grey-square rounds on a random color and shares 🟩⬛ (numbered from 2026-10-07).
   - L10 adds a second odd-one-out daily (numbered from 2026-10-08).
   - Round 1 proposed a third (Explore's painting of the day).
   - The color of the day (`daily()` in explore.js) is a fourth ritual: a 4-option pick among the first taught colors.
   - None of them teaches a painting, a word or a fact; each ends with "Sharp eyes." and a Back button.
5. **Three level systems that disagree.**
   - Station levels 1–20 from sessions, check-in levels, and now L10's thresholds plus stars plus worlds.
   - The suggested card can say "Level 9 of 20 · today 7".
   - The "Your eye" page is a stats dump: 9 station sections, two charts each, family bars, a calibration bar, and a 28-day challenge strip.
   - It's honest and well built, but nobody reads it twice.
6. **Duplicates once L10 lands.**
   - The old Odd one out station duplicates L10's #/odd.
   - "Color memory" duplicates the Mix set's memory games.
   - "Sort the strip" duplicates Out of order and Rebuild.
   - "Which is lighter?" and "Lighter or darker, same hue" read as the same thing to anyone but us.
7. **The check-in blocks the fun.** When it's due, it replaces the suggested card, so the first thing on Train is a no-feedback test.
8. **Lightning round is the only words game.** It's flat swatches from the first taught colors with a best score, and it feeds nothing.
9. **Nothing flows out.** Until L10's `ooLogMiss`, Train wrote nothing the rest of the app could use. The taste tests live in Studio and never come back into Train.
10. **Social stops at one emoji grid.** You can't send a friend *this* board, and there's no reason to come back tomorrow except a streak counter.

---

## 2. North star

**Train is where your eye meets the world's colors, one real thing at a time.**
- **Every board is cut from something real:** today's painting, the words you're learning, your mix-ups, your photos, the petals and gems in World.
- **Every answer names what you just saw,** and says whether the difference you found crosses a word.
- **One hidden model of your eye** (L10's) is the only skill number. Every game, the color pages and the Journey read it.
- **Train opens on today's painting, not a menu,** with a 3-minute workout composed from everything the app knows about you.
- **The games are few and deep:**
  - Odd one out stays the heart;
  - Across the line turns it into a vocabulary game;
  - Walk the map turns color space into a place;
  - the painting games turn 23,531 canvases into a gym;
  - the memory games remember *your* world, not random squares.
- **It's sister-proof:** 90 seconds a day, one shared painting, a grid that looks like the painting, and a link that lets a friend play the exact same board.

---

## 3. Ideas, ranked (★ = the five best)

### 1. ★ Today's painting: one daily, five lenses
- **What it is:** One painting a day, the same for everyone, seeded by the date. It replaces three of the daily mechanics.
- **The rounds:** Five rounds, each a different way of seeing that one picture, about 90 seconds in all:
  1. **Find the patch.** The painting cut into tiles, one patch recolored (L10's painting board).
  2. **Squint.** Which of two marked spots is lighter? Both share one photograph, so varnish can't fool it.
  3. **Across the line** (idea 2) on the painting's focal color.
  4. **The hidden color** (idea 5): tap where it lives.
  5. **Name it.** Its focal color, typed or from 4 same-family names.
- **The finish:**
  - The painting heals and fills the screen.
  - The **share grid is the painting's own palette as emoji squares**: the nearest of 🟥🟧🟨🟩🟦🟪🟫⬛⬜ to each of its five main colors. Hits keep their square and misses become ▫️, so *your grid looks like the painting*.
  - Example: "ColorHub · The Milkmaid · 4/5 · saw 1.8%".
  - One tap on the painting opens its page.
- **Why it's 10×:**
  - The daily becomes a ritual with content: you learn one masterpiece a day, through five lenses.
  - The share is beautiful and unmistakably ColorHub.
  - It folds the grey-grid challenge, L10's random daily and round 1's painting of the day into one.
- **Connections:**
  - **Painting and painter pages:** the reveal opens them.
  - **Learner Model:** `seen` for the painting; misses logged as pairs.
  - **Explore:** yesterday's painting becomes a For-you card.
  - **Journey:** lesson world steps reuse it (round 1, L9).
  - **Cabinet:** a 5/5 earns the painting's card.
  - **Today's three:** it's the first tile.
- **Effort:** M. A v0 is about 4 hours once L10 merges, on the 22 famous paintings that have local full images *and* color maps (`img/paintings/*.jpg`, `*-map.png`): 22 days of content, then the game set in §4.4.
- **Honesty:**
  - "As photographed" sits under the image.
  - Screens differ, so a grid compares people only loosely. Never call a score a percentile (NOTES-TRACKER #13 needs the opt-in service).
  - Each day's painting must pass the solvability gates in §4.4.

### 2. ★ Across the line: odd one out by name
- **What it is:** "Three of these are **Teal**. Which one isn't?"
  - The tiles vary *inside* one name's region, spread up to about 1.5× the round's difference.
  - One tile sits just across the boundary, in a neighbor name. It's often *closer* in ΔE to its nearest tile than the in-name tiles are to each other.
  - So the odd one isn't the most different tile. It's the one on the other side of a word.
- **The reveal:** after the tap, the board flattens onto a strip from Teal to Petrol with the boundary drawn as a tick and your tiles as dots. Both names are one tap from their pages.
- **Variants:**
  - **Find every teal:** count the in-name tiles.
  - **Where does teal end?:** COLORNERD #2's boundary walk. Tap when the name changes, then see your line beside ColorHub's and the ISCC-NBS block line.
  - **Not teal, in a painting:** the same question on painting tiles.
- **Why it's 10×:**
  - It's the sister's game turned into the app's first goal.
  - Discrimination games train the eye; this trains the *categories*, which is literally "a name is a lens".
  - It needs a 1,000-word naming system with real boundaries. Nobody else can build it.
- **Connections:**
  - **Naming** (`nameOf`, core names).
  - **Learner Model:** a wrong tap logs "you put petrol inside teal", which the Journey uses as a contrast partner.
  - **Color pages:** a line like "Your teal ends here", with the strip.
  - **Journey:** a 10-second step version.
  - **Honeycomb:** round 1's lightness-slice lens draws the same boundary.
- **Effort:** S–M (spec in §7).
- **Honesty:**
  - The boundaries are ColorHub's nearest-name regions. Dictionaries draw them differently, so show the ISCC-NBS line where it differs.
  - Never claim words change perception much: Winawer 2007 is real, but the effect is modest.
  - The category word is always one you've met; the neighbor's name is revealed only after the tap.

### 3. ★ Name today's color: a color Wordle with real words
- **What it is:** Today's color fills the screen.
  - Type a name, with type-ahead over the 1,000 core names and their aliases.
  - Each guess drops a row under the swatch:
    - the guess's own swatch;
    - three axis cells: *lighter / darker*, *bluer / greener / redder / yellower*, *stronger / weaker*;
    - a closeness bar.
  - You get six guesses, and the vocabulary is Godlove's split, so "brighter" and "warmer" never appear.
  - Solved or not, the color's page opens with its story.
- **Options:**
  - After 3 misses a "4 choices" button turns it into today's 4-option pick, so beginners always finish.
  - Hard mode hides the swatch and leaves only the arrows.
- **Share:** three squares per guess (lightness, hue, strength): 🟩 within tolerance, 🟨 close, ⬛ far. The name is never in the text.
- **Why it's 10×:**
  - It turns a passive 4-option pick into recall with graded feedback.
  - Every wrong word teaches where that word lives ("Cerulean: today's is darker and greener").
  - It's the neighbor-definition method of Webster's Third (COLORNERD #1, #15) as a game everyone already knows how to play.
- **Connections:**
  - **Naming.**
  - **Articles and stories:** the reveal.
  - **Learner Model:** wrong guesses within ΔE 10 become direction-tagged pairs.
  - **Journey:** an unmet target becomes a candidate new word, and tomorrow's review.
  - **Today's three:** it replaces `daily()`.
- **Effort:** S–M (spec in §7).
- **Honesty:**
  - The hue cell is suppressed when both colors have C* < 8, because hue isn't meaningful for near-greys.
  - The target pool is the common core words (by rank), so the day is never an obscure name.
  - The swatch is a screen approximation.

### 4. ★ Walk the map
- **What it is:** Start at **Lemon**, reach **Olive**.
  - Each turn the current color fills the screen, with six tiles around it as the steps: lighter, darker, more vivid, duller, hue one way, hue the other.
  - The steps are sized near your threshold (L10's model).
  - Pick the step that moves you toward the target.
  - Each step names where you are now ("Pale lemon… Chartreuse… Olive drab… Olive").
  - Par is the fewest steps (a BFS on the step grid).
- **Two modes:** *see the target* (the eye) or *only its name* (vocabulary: you must know where olive lives).
- **The finish:** your route draws itself on a hue plane or lightness slice, and "Lemon → Olive in 7 (par 6)" is shareable. A daily route is a natural Today's-three alternate.
- **Why it's 10×:**
  - Color space becomes a place you travel, and the direction words become physical.
  - It fuses L10's *chain* twist and *which way?* variant with the naming map, so every step teaches a word and an axis at once.
- **Connections:**
  - **Naming.**
  - **The map:** the route is a separate Train figure, never a mark on Home (X7).
  - **Color pages:** arriving opens the target.
  - **Learner Model:** wrong-direction steps feed the weak axis.
  - **Journey:** route endpoints are this week's new words.
- **Effort:** M.
- **Honesty:**
  - Steps are ΔE00 along LCh axes, and routes stay in gamut.
  - The regions are ColorHub's naming.
  - The hue steps say "bluer", never "cooler".

### 5. ★ The hidden color (Sample it, on 23,531 paintings)
- **What it is:** A painting and a swatch: "Somewhere in this portrait is this green. Tap where it lives."
  - The analysis already marks each painting's hidden colors (`hid`: low-chroma colors from a family that isn't the painting's dominant one, like the greens in the skin).
  - Its color map (`cm`, or the `*-map.png` for the famous 22) says where each pool color sits.
- **The reverse round (COLORNERD #12):**
  - A ring marks a spot that *looks* one way ("this shadow looks blue").
  - You pick its true color from 4 swatches.
  - Then the patch is cut out and shown on neutral grey.
- **Scoring:** by region, not by pixel.
- **Why it's 10×:**
  - It trains the painter's core skill (local color vs perceived color) and the curator's "the color nobody notices" on a real archive.
  - Nobody else has hidden-color indices for 23k paintings.
- **Connections:**
  - **Painting pages:** it's the practice mode of round 1's "guided look in three stops" (same `foc` / `hid` / `glu` data).
  - **Color pages:** "found hidden in N paintings".
  - **Learner Model:** `seen` and `found`.
  - **Cabinet.**
  - **The global squint key.**
- **Effort:** M.
- **Honesty:**
  - Every line says "in this photograph": a hidden green may be varnish or the camera.
  - Use only regions of at least 2% of the area that are compact enough to tap.
  - The cut-out reveal needs readable pixels (local copies, or Wikimedia with CORS); other paintings use precomputed region centroids only.

### 6. Today's workout (Train's front door)
- **What it is:** Train opens on one card: "3 minutes · 4 parts". It's composed from everything the app knows:
  1. a warm-up on your strongest judgment;
  2. your weak axis × weak family at your edge (L10's model);
  3. your worst mix-up pair as a board (Across the line, or the plain pair);
  4. a painting you opened in the last 3 days (idea 10, or a painting board).
- **Check-ins and the rest:** when the weekly check-in is due, it takes part 2's slot, labeled "no feedback today", instead of blocking the screen. All other games sit below as "All games".
- **Why it's 10×:**
  - No menu decision.
  - Interleaving and spacing by construction (KB #2, #8).
  - Every session is personal and connected to the rest of the app.
- **Connections:** Learner Model, L10's eye model, painting pages (`seen`), the Journey composer (the same composer, with Train's step pool).
- **Effort:** M.
- **Honesty:** warm-ups are easy on purpose, so levels move only from part 2 and check-ins.

### 7. Every miss has names
- **What it is:** After any eye-game answer, one line names both colors.
  - **Different names:** "You found **Deep teal** among **Teal**: darker and a touch bluer."
  - **Same name:** "Both are **Teal**. This difference has no word; it's 2.1% darker."
  - Both names are one tap from their pages.
- **Why it's 10×:**
  - Nine abstract stations become constant vocabulary exposure.
  - It teaches that names are regions.
  - It delivers ROADMAP §10's explain-my-miss.
- **Connections:** naming, color pages, Learner Model (named pairs), Across the line (the same helper).
- **Effort:** S (spec in §7).
- **Honesty:** use `nameOf`'s own modifiers and its "between X and Y" text for far matches. Name an axis only when it carries a real share of the difference.

### 8. Worlds made of the archive
- **What it is:** After L10's 24-level road (the mechanics tutorial), the open map is **worlds defined by where colors live in paintings**:
  - **Skies:** the top band of landscapes.
  - **Shadows:** the darkest band.
  - **Greens:** landscape mid-tones.
  - **Greys:** the glue tones (`glu`).
  - **Water.**
  - **Faces in paint:** the skin regions of portraits.
- **How a world plays:**
  - Each world draws its base colors from that world's archive distribution.
  - It mixes every mechanic.
  - It ends with a boss painting and one measured finding.
- **Why it's 10×:**
  - ROADMAP §4 asked for worlds like Greys, Skin tones, Skies and Shadows. The archive makes them real instead of arbitrary hue ranges.
  - "You can now tell sky colors 1.3% apart" means something; "level 14" doesn't.
- **Connections:**
  - **Analysis data:** top/bottom bands, value bands, `glu`.
  - **Painter pages:** the boss painting.
  - **Cabinet:** a world card.
  - **Learner Model:** per-world thresholds from family × lightness band.
- **Effort:** M–L.
- **Honesty:**
  - "Faces in paint" samples the full range of complexions, is named after paint rather than people, and never groups by ethnicity.
  - Skies are as photographed (varnish yellows them).
  - Each world needs n ≥ 200 paintings.

### 9. Name it in the wild (Lightning, upgraded)
- **What it is:** The same 45-second format, but each question is a patch ringed *inside* a real painting (later a petal or gem photo from World). Name it from 4 same-family names. After a miss, the flat swatch appears beside the patch in context.
- **Why it's 10×:**
  - Perceptual skills learn from varied examples (learning KB).
  - A word learned on flat swatches is brittle; "salmon" met in 30 paintings generalizes.
  - Today's Lightning is flat swatches from the first taught colors only.
- **Connections:** paintings, World (botany and gem images), naming, Learner Model.
- **Effort:** M.
- **Honesty:** the patch's name is `nameOf` on its measured mean. The gap between measured and seen is the lesson, so say both.

### 10. Do you remember? Memory from your own trail
- **What it is:** Delayed memory rounds built from things you actually saw in the app 1–7 days ago.
  - "On Tuesday you opened Hammershøi's *Interior*. What color was the door?" Pick from 5 close swatches on a ΔE ladder.
  - Also your saved photos and camera finds.
  - The reveal shows your drift ("you remembered it lighter and warmer").
- **Why it's 10×:**
  - Memory games on random squares are trivia. This is memory of *your* world, naturally spaced (KB §2).
  - It doubles as the "where have you seen this before?" transfer prompt.
- **Connections:** Learner Model (`lmSeen`), painting pages, Studio photos, Camera, Journey review.
- **Effort:** M (needs L19's seen log).
- **Honesty:** it tests the photograph you saw on your screen, and says so.

### 11. The Restorer
- **What it is:** A famous painting with one *region* shifted 3–8% along one axis.
  - The region is all the pixels of one palette cluster from its map PNG, like the Milkmaid's apron or Monet's sky.
  - Restore it with one slider, then a 2D pad.
  - The score is the region's ΔE to the museum photograph.
  - The reveal is Atelier's split view (`mtSplit`).
- **Why it's 10×:** it brings the *make* task to masterpieces. The region is a real thing (a cloth, a sky), not a square.
- **Connections:** painting pages, `match.js` (`mtSlider`, `mtSplit` reused), L10's eye model (the adjust judgment), Cabinet (a "restored" stamp).
- **Effort:** M.
- **Honesty:** you restore the museum's photograph, not the painter's original. Real restoration is conservation science.

### 12. Beat my board (async, zero backend). Needs David's yes (X3)
- **What it is:** Any finished set gets "Send this board".
  - The link carries the seed and level (`#/odd/b/<seed>.<lv>`) and, optionally, your hits as a few digits.
  - The friend plays the identical boards, then sees "Your sister: 5/6, saw 1.4%. You: 4/6."
- **Family round:** pass-and-play on one phone, with 2–4 first names typed locally and the same boards turn by turn.
- **Why it's 10×:** it harnesses the sister effect without accounts. It's fair because the boards are identical, built from L10's seeded `ooRnd`.
- **Connections:** L10's rounds, Today's painting, the share renderer, the router.
- **Effort:** S.
- **Honesty:**
  - No personal data in the URL, only the seed and score digits.
  - Screens differ, so "beat" is friendly, not science.
  - **David deferred duels.** This is the smallest version to *propose*, not to build without his OK.

### 13. Word gradient (names only)
- **What it is:** Five color names and no swatches. Drag them from light to dark, or around the wheel, or from dull to vivid.
  - Wordle-style lock-in: 3 tries, and correct tiles glow.
  - Then the swatches flood in under each word.
  - The words come from your met names and their neighbors.
- **Why it's 10×:**
  - It tests vocabulary as coordinates (ROADMAP §20).
  - It's the one §20 combination L10's Mix set doesn't cover.
- **Connections:** naming, Journey (a checkpoint step), Learner Model, Across the line.
- **Effort:** S.
- **Honesty:** the order is by L* (or LCh hue), and pairs within 2 L* are never asked.

### 14. Werner's field guide (1821)
- **What it is:**
  - Werner's *Nomenclature of Colours* defined each color by a real animal, plant and mineral, and `data/botany.js` already carries the plant side (source `syme-werners-nomenclature`).
  - The game shows a Werner swatch and three objects; pick the one Werner used ("Werner's Arterial Blood Red: corn poppy, …"). It also runs in reverse.
  - The reward is the plant's photo and its page.
- **Why it's 10×:**
  - It anchors colors to real objects (ROADMAP §5, memory of real objects).
  - It's a naturalist's method two centuries old, and only this app holds it next to a modern naming system.
- **Connections:** World/Botany, articles (the nature-named tier), Journey (real-object cards), Cabinet.
- **Effort:** S–M.
- **Honesty:**
  - The hand-painted swatches varied between copies, so the hexes approximate a reprint.
  - Check the Darwin and Beagle story in color-kb before saying it; otherwise leave it out.

### 15. Notan: the two-value painting
- **What it is:** A painting and three black-and-white two-value maps. Only one is that painting's real split at its median lightness. Pick it.
  - Later, three values.
  - Distractors are wrong thresholds, or a similar composition from the archive.
- **Why it's 10×:**
  - It's the value plan painters actually make.
  - It upgrades Squint from 22 paintings to thousands.
  - It's a natural partner for the global squint key.
- **Connections:** Squint, painting pages (the value-key stat), Atelier's value scale.
- **Effort:** S–M (precomputed offline from the color maps).
- **Honesty:** a notan is a reading with a chosen threshold. Say "a two-value reading".

### 16. Which palette is this painting?
- **What it is:** A painting thumbnail and four 5-color strips: its own, and three from its nearest paintings by palette (§21's `nearest`). Pick its palette.
  - Harder levels use the same painter's other works.
  - The bonus reveal: "its palette twin, 200 years earlier".
- **Why it's 10×:** you learn to read a picture's color without being fooled by its subject, and the archive's nearest-palette edges become play.
- **Connections:** painter pages, Studio's palette extraction, L10's Whose palette?, Cabinet.
- **Effort:** S (the data exists).
- **Honesty:** "close by color only, never influence". A solvability gate keeps the true strip measurably apart from each distractor.

### 17. One minute in another eye
- **What it is:** Six odd-one-out rounds under a protan, deutan or tritan simulation, chosen so some boards become impossible, then the same boards normally.
  - It ends with the corrections: most color-blind people see color but confuse some pairs.
  - Red-green CVD affects roughly 1 in 12 men of Northern European ancestry.
- **Why it's 10×:** it builds empathy and corrects a myth from CLAUDE.md's list.
- **Connections:** color pages (the CVD simulations, request C15), Studio palette critique, the perception wiki pages.
- **Effort:** S.
- **Honesty:**
  - The simulations (e.g. Machado 2009) are approximations.
  - It's not a test or a diagnosis.
  - The prevalence figure is hedged by population.

### 18. Older word?
- **What it is:** Two color words: which became an English color name first? Later, order four.
  - The reveal shows the dates and their source, plus one line ("magenta: named after the 1859 battle").
  - It draws on the graph's *first recorded* edges and the Ngram color-sense curves.
- **Why it's 10×:** history becomes play, and names feel like a timeline. It's a natural doorway into articles.
- **Connections:** Color Graph (L6), articles, round 1's "word vs paint" curves.
- **Effort:** S once L6 ships the dates.
- **Honesty:**
  - Dates depend on the source, so show it.
  - Skip any word whose dating the books dispute (the myth list's "Mauve Decade" and friends).

### 19. Your eye card, then and now
- **What it is:** A share card of your thresholds per family from L10's model, drawn as a small wheel: "On my screen I see blues to 1.4%".
  - Beside it, **Then and now**: the smallest pair you could tell apart in week 1 vs today, both drawn and named.
- **Why it's 10×:** the 16-year-old wants something about *me*, and ROADMAP §4 asked for a before-and-after with real pairs.
- **Connections:** L10's model, the one share-card renderer (L17), color pages (the `eyeThreshold` line), the weekly recap.
- **Effort:** S.
- **Honesty:** "on my screen", and levels come from check-ins. No percentile.

### 20. Same color, different stuff
- **What it is:** A board of real material photos: botany petals, gems, painting patches, fashion swatches. Find the two that share a named color, or the odd one whose name differs (measured from each photo's region). This is ROADMAP §20's texture edition.
- **Why it's 10×:** appearance vs material, and World's content becomes Train content.
- **Connections:** World (botany, gems, fashion), naming, Cabinet.
- **Effort:** M.
- **Honesty:**
  - Lighting and photography vary.
  - Use only pairs whose ΔE gap is far above the photo noise.

### 21. Famous colors from memory
- **What it is:** Pick the true color of things you've seen a thousand times from 5 close swatches: Tiffany's box blue, a US school bus, the Starry Night's sky.
  - The reveal shows your drift: "you remember these more vivid".
- **Why it's 10×:** memory color is real and surprising, and it uses goal 3's iconic design colors.
- **Connections:** articles (the institution and commercial tiers), paintings, Learner Model (drift direction).
- **Effort:** S.
- **Honesty:**
  - Brand hexes are approximations, and real objects vary by country.
  - Hedge the science: classic studies (Bartleson, 1960) found remembered colors of familiar objects shift, often toward more saturated, and individuals vary.

### 22. Afterimage hunt
- **What it is:** The Afterimage demonstration becomes a game (COLORNERD #6).
  - Stare at a color for 15 seconds.
  - On grey, pick the ghost from three close options.
  - Then see the painter's-wheel "complement" next to your eye's.
- **Why it's 10×:** it proves on your own retina that "complement" depends on the system, which corrects a myth.
- **Connections:** the complementary-colors wiki page (embed it there), Mix lab, Studio harmony.
- **Effort:** S.
- **Honesty:** afterimages vary by person and screen. Score as "your ghost was closest to…", never as right or wrong.

### 23. The weekly hunt (camera)
- **What it is:** One rare word a week to find in the world ("find something celadon"). Name it first, then the camera checks it within ΔE, with white balance. The Train twin of the Journey's photo missions (L9).
- **Why it's 10×:** it takes training outside.
- **Connections:** camera, Cabinet's finds drawer, Learner Model.
- **Effort:** S–M.
- **Honesty:** cameras shift color, so it's "a guess", and it counts only when you named the color first.

### 24. The eye map (a Train figure, not Home)
- **What it is:** In "Your eye", a hue plane or lightness slice shaded by your threshold, crisp where you're sharp and coarse where you're not. Tap a coarse area to train it.
- **Why it's 10×:** it draws the honest three-axis profile as territory. X7 keeps such marks off the home honeycomb, so it lives only here.
- **Connections:** L10's model, the honeycomb's lightness slice (L18), Today's workout targeting.
- **Effort:** M.
- **Honesty:** cells without enough rounds stay blank, and the screen caveat applies.

---

## 4. The five threads the brief asked for

### 4.1 Progression: one model, two kinds of worlds
- **One skill number.** L10's hidden model (hue, lightness, vividness, context, memory, with family and axis offsets) is the only estimate.
  - Old station levels become read-only history in "Your eye".
  - The adjust stations (neutral, vanish, match) can feed the *context* judgment later.
- **The road, then the open map.**
  - L10's 24-level road teaches the *mechanics* and earns stars (finish, fast, no hints).
  - After it, the archive worlds (idea 8) teach the *regions of color that matter*, each mixing every mechanic.
- **What you see:**
  - stars on the road;
  - world cards in the Cabinet;
  - the eye card (idea 19);
  - the weekly check-in as the honest trend.
  - No XP, no belts (X8), no currency.
- **Unlocks gate mechanics, never content.** Explore, pages and paintings are always open.
- **Difficulty breathes** (L10's tiers: easy, medium, hard, easy, harder, boss). New kinds arrive at intro difficulty, and the workout composes across games.
- **Mastery** uses the existing rule (two check-ins at level 15+ → maintenance spacing, `inMaintenance`), extended per judgment.
- **Streak:** only for the daily painting. It counts days played and never shames a miss.

### 4.2 Daily boards: one per goal
- **The eye daily is Today's painting** (idea 1).
  - Fixed round difficulties, not personal, so everyone's grid means the same thing.
  - One numbering from one start date.
  - `S.challenge` history migrates so the old 28-day strip still draws.
- **The words daily is Name today's color** (idea 3). It replaces the 4-option `daily()` on the same route (`#/daily`).
- **Today's three** become: Today's painting · Name today's color · Today's workout.
- Train's top card shows Today's painting until it's played, then the workout.
- **A walk-the-map daily route** is the one optional extra, kept for later.

### 4.3 Social and duels, inside David's "later" (X3)
- **Share artifacts, all from one renderer (L17):**
  - the painting grid (emoji palette);
  - the color-Wordle grid;
  - the eye card;
  - "Lemon → Olive in 7".
- **Zero-backend play-alikes (idea 12):** send this exact board, and the pass-and-play family round. Both need David's yes, and neither needs accounts.
- **World percentile** waits for the opt-in anonymous scores service (NOTES-TRACKER #13). Until then, show only reference values.
- **Never a leaderboard of thresholds across phones.** It would rank screens as much as eyes. Shared seeds make boards identical; they don't make screens identical, and the fine print says so.

### 4.4 How the games use real paintings: the pipeline and its rules
- **What we can read:**
  - **Pixel-readable today:**
    - the 22 famous paintings (`img/paintings/`, with color maps);
    - about 4,850 local museum thumbnails (`img/gallery/aic` and `smk`, ~200 px: fine for regions and rings, too small for tile boards);
    - Wikimedia images (about 9,100) via `crossOrigin="anonymous"`. Verify the CORS headers on a phone first.
  - **Not pixel-readable** (about 9,700 other museum URLs): these use only precomputed data (the 24-color pool with shares, `cm`, `foc` / `hid` / `glu` / `acc`).
- **A game set, built offline.** `tools/game_paint.py` → `data/games/paint.json`: about 300 paintings with sharp local copies at about 600 px (a budget of roughly 15 MB in `img/game/`). For each one:
  - region centroids and boxes per pool color;
  - value-map cuts (for Notan);
  - squint pairs with ΔL* ≥ the round level;
  - hidden and focal regions;
  - top and bottom bands (for the worlds);
  - a pass/fail flag for each game type.
- **Rules for every painting round:**
  1. **The within-painting lens only.** Judge relations inside one photograph (lighter of two spots, where a color lives), never "which painter used more ink", so varnish and museum cameras can't decide the answer (genius panel §2.4).
  2. **Solvability gates:** shown ΔE ≥ `SHOWN_MIN` and within 15% of the round's level; regions ≥ 2% of the area; squint pairs ≥ the round's ΔL*.
  3. **Credit and one tap:** title, painter, year and museum are on every round, and one tap opens the painting page.
  4. **Log it:** every painting round logs `seen` for the painting, so it can return in Do you remember? and in the Journey.
  5. **Say it:** "as photographed" is always visible.

### 4.5 Memory games: one map of them

| Game | What you hold | Delay | Owner |
|---|---|---|---|
| What changed? · Was it there? · Rebuild · n-back | abstract boards | seconds | L10 Mix set |
| Do you remember? (10) | a painting or photo *you* saw | 1–7 days | new |
| Famous colors (21) | lifelong memory colors | years | new |
| Werner's field guide (14) | object ↔ color anchors | spaced | new |
| Name it in the wild (9) | word ↔ appearance | instant | new |

Every memory game ends with the **drift reveal**: which way your memory moved (lighter, more vivid, warmer, bluer), using the same three-axis words as Colordle. Drift is logged as an axis signal for the eye model.

---

## 5. Kill list (surface that doesn't add seeing)

1. **`challenge.js`'s grey-grid daily → fold into Today's painting.**
   - Keep its seeded generator as the fallback when an image fails to load.
   - Keep `S.challenge` history and the streak.
2. **L10's random-color daily board →** reuse its engine as round 1 of Today's painting. One daily, not two.
3. **The old Odd one out station (`gym.js` `hue`, 3×3 only) → retire into `#/odd`.** Its per-family scores already seed L10's model (`eyeThreshold`'s fallback).
4. **"Color memory" and "Sort the strip" → their new homes are L10's Mix set** (What changed?, Rebuild, Out of order). History stays visible.
5. **Mixed sets (lightness, context) → replaced by Today's workout**, which interleaves by design.
6. **Lightning round, as a flat quiz on the first taught colors → becomes Name it in the wild.** Keep the 45-second format and the best score.
7. **One user-facing "Lighter?" station** with a same-hue mode, instead of two tiles that read as the same thing. The staircases can stay separate underneath.
8. **Dual numbers ("Level 9 · today 7") → one number per judgment.**
9. **The "Your eye" page →** the eye card, the eye map and the check-in trend. Calibration stays as one sentence; the nine station chart sections go to a "History" link.
10. **Colorist and Atelier →** keep them (David asked for them), but as one "Atelier" row with three tiles (Value scale, Big masses, Kill the cast). Shot matching and Kelvin eye sit behind "more".
11. **The Afterimage tile, as a demo → becomes Afterimage hunt,** plus an embed on the complementary-colors page.
12. **A standing rule, not a cut:** no new abstract-square mechanic ships unless its board can take a set (a painting, names, a photo, your mix-ups). Grey squares are for calibration, not for play.

---

## 6. The one "wow" in 60 seconds

**Tap Train. There's no menu: there's Vermeer's *The Milkmaid*, cut into nine tiles.**
- One tile, the apron, is 5% off. You tap it.
- The tiles slide back together into the whole painting with a soft ripple, and one line appears:
  > "That was the apron: **Oxford blue** in this photograph, shifted 5% lighter. Most people can see about 1% side by side. Round 2 of 5."
- "Oxford blue" is a link to its page.
- About 20 seconds in, a first-timer has met a masterpiece, found something their eye can do, and learned a precise word for a color they'd have called "dark blue".
- By round 3 (Across the line) they discover that a word has an edge.

The data exists: the Milkmaid's palette in `data/paintings.js` lists Oxford blue (#182A44, 6.5% of the canvas), with its color map in `img/paintings/milkmaid-map.png`.

---

## 7. Buildable today (each under 4 hours)

### A. Every miss has names (about 2 hours, S)

**Files and API:**
- A new file, `js/eye-names.js`, loaded after `js/naming.js`. Check its two globals with `check_names.js` (all js files share one scope).
- `eyeNames(baseHex, oddHex)` returns `{ same, a: {n, text, hex}, b: {n, text, hex}, dir }`. It uses `nameOf()` (core names, with modifiers).
- `eyeNamesLine(baseHex, oddHex, opts)` returns one HTML line. The names are color links to their pages, using the same link helper as `linkText`.

**The direction words (`dir`):**
- From ΔL*, ΔC*, and the hue change converted to a direction.
- **Hue words come from where the color moves on the a\*b\* plane:**
  - toward −b\* is "bluer"; toward −a\* is "greener"; toward +a\* is "redder"; toward +b\* is "yellower";
  - the word is the strongest of those four pulls.
- **Name an axis** only when it carries at least 30% of the ΔE00. Use "a touch" when its share is under 50%.
- **Never use** "brighter", "warmer" or "cooler" (COLORNERD §6.5).
- **Skip the hue word** when both C* < 8.

**The copy:**
- **Different names:** "You found **Deep teal** among **Teal**: darker and a touch bluer."
- **Same name:** "Both are **Teal**. This difference has no word; the odd one is 2.1% darker." (Use `pctFmt`.)

**Wire-up (additive, one call each):**
- `gym.js`: the `hue` drill's `tilePick` note (≈ line 733), and `missCard`.
- `challenge.js`: the miss line (≈ line 64).
- L10's `ooLine` once it's merged. Coordinate with L10: one call, no fork.

**Logging:** on a miss where the names differ, call `ooLogMiss(right, picked, { game })` if it exists, otherwise `learnerLog`.

**Test:** `tools/eye_names_test.js`, over 300 seeded pairs:
- same-name pairs never claim different names;
- the lightness word matches the sign of ΔL*;
- the banned words never appear;
- the output is deterministic.
- Then run `check.js`, `check_wiki.js`, `check_names.js`, and the smoke test.

**Screens to check:** a hit and a miss at 375×812, both the different-names and same-name copy.

### B. Across the line v0 (about 3.5 hours, S–M)

**Files:**
- `js/games/line.js` if L10 has merged (it reuses `ooRun` and the round renderer), otherwise a standalone `js/line-game.js` with a 2×2 / 3×2 grid on the `tilePick` pattern.
- A route `#/line`: one line in `ROUTED`, plus a case in `openRoute()`.
- The entry tile goes in L10's Mix set, or in the Train "Game" row next to Lightning.

**The generator, `lineRound(rnd, { lv })`:** pure, seeded and testable.
1. **The category N:** a met word (`S.cards` via `BYNAME`) whose core-name region is wide enough. Accept it if at least 3 jittered samples within ΔE 6 of `N.h` keep `nameOf(x).n === N` with `de < NEAR_DE`.
2. **The neighbor M:** `nameOf(N.h).near` gives the nearest other core name. March from `N.h` toward `M.h` in Lab until `nameOf` flips; that's the boundary point B.
3. **The odd tile:** B pushed past the line by `p(lv)` ΔE (8 at level 1 → 2 at level 12).
4. **One "trap" tile:** inside N, just inside the line, about `p(lv)` from the odd tile.
5. **The other tiles:** inside N, spread so that at least one in-name pair is further apart than the odd tile is from the trap. That makes pure "most different" fail.
6. **The gates:**
   - every in tile has `nameOf().n === N`, and the odd tile's is M;
   - the shown ΔE between the odd tile and the trap is ≥ `SHOWN_MIN` (`accuracy.js shownDE`);
   - otherwise reseed (at most 30 tries, then fall back to the next category).

**Play:**
- The prompt is "Three of these are **N**. Which one isn't?" (5 of 6 at size 3×2).
- M's name stays hidden until after the tap (recall before reveal).
- A short ladder: 8 rounds a set, and `p` follows a 2-down / 1-up staircase (`ooStair` if merged, else `stairNext`).

**Reveal:**
- Small name labels appear under every tile.
- One line: "This one crossed into **M**." Both names are color links.
- A strip figure: a 1D gradient from `N.h` to `M.h`, a tick at B, and the tiles as dots.

**Logging:** a wrong pick goes to `ooLogMiss(oddHex, pickedHex, { game: "line", judg: null })`.

**Test:** `tools/line_test.js`, over 500 seeded rounds:
- the name invariants;
- the shown ΔE gate;
- the trap condition holds in at least 80% of rounds;
- determinism by seed;
- no round takes more than 30 tries.

**Screens to check:** level 1, a level-10 round, and the reveal, at 375×812.

### C. Name today's color (about 3.5 hours, S–M)

**Files:**
- A rewrite of `daily()` in `js/explore.js`, or a new `js/colordle.js` that `daily()` delegates to.
- The route `#/daily` and the Today tile stay.

**Data and target:**
- `CORE_NAMES` (`data/core-names.json`, 1,000), loaded through `loadCoreNames` before input opens.
- The target is seeded by the date with the same FNV hash as `dailyColor`, from the core names with `rank` < 400, so it's always a common word with a page.
- `dailyColor()` stays for any other caller.

**State:** `S.daily[k] = { g: [names], ok, hint }`. The old `{ ok }` records keep working, since unknown keys are kept and no `migrateState` step is needed.

**Input:**
- A solid text field (X10) with type-ahead over core names and their `also` aliases: 6 suggestions, and an alias resolves to its primary name.

**A guess row:**
- the guess's swatch and name;
- three cells:
  - **lightness:** ↑ lighter or ↓ darker, ✓ when |ΔL*| < 3;
  - **hue:** bluer, greener, redder or yellower (the same helper as A), ✓ when |ΔH*| < 3, hidden when both C* < 8;
  - **strength:** stronger or weaker, ✓ when |ΔC*| < 3.
  - 🟨 means within 8.
- a closeness bar: `max(0, 100 − 4·ΔE00)`.

**Win and finish:**
- A win is the same core name, or ΔE00 < 1.5 to the target.
- After 3 misses, "4 choices" offers the old 4-option pick (decoys from `nearestCore`) and marks the result `hint`.
- At the end, the existing reveal path runs (the name on the swatch, the story text, Share), and the color page is one tap away.

**Share text:** "ColorHub · Today's color #N · 4/6", then one row of three squares per guess. Never the name.

**Logging:** wrong guesses within ΔE 10 → `ooLogMiss(target.h, guess.h, { game: "daily" })` or `learnerLog`.

**Test:** `tools/colordle_test.js`:
- over 1,000 random pairs, the arrow sign matches ΔL*, ΔC* and the hue direction;
- the banned words never appear;
- the target is deterministic per date;
- every target in the pool resolves to a page.

**Screens to check:** an empty state, 3 guesses, the hint state and the solved state, at 375×812.

**Next after these three:** Today's painting v0 (idea 1). It needs L10 merged (painting tiles and `ooRun`), plus A and B as its rounds 3 and 5. Start on the 22 local masterpieces.
