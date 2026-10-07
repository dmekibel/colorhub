# The Journey: ColorHub's learning path

Design and content map. Status: **draft for David's review (2026-10-08)**. Nothing here is built. Mockups are in `design/journey-mockups.html` (screenshots in `design/journey-shots/`). Coverage numbers come from `tools/journey_coverage.py`.

It replaces the family-by-family units ("the blues, then the reds") with one mixed, Duolingo-style journey. It follows ROADMAP §1 (the 2026-10-08 update), §14 (stages and fields), §19 (writing plan) and §20 (game grammar). It uses DESIGN-SYSTEM.md throughout: booth grey for every judged screen, one paper primary per screen, opaque controls, the lesson archetype, no uppercase, and mono only for numbers.

**In one paragraph.** You walk one path. It's made of chapters, and every chapter ends on a stage boundary (25, 50, 100 … 1,000 words). A lesson takes about 3 minutes and has about 15 quick steps. It brings in 3–4 new names from mixed families, sets each one against a look-alike you already know, weaves in what's due, and shows each color where it lives in the world: a painting, a poem line, a flower, a gem, a look or a film. Every color you meet adds its real painting, poem, flower and gem to your **Cabinet**. The one progress number, **Yours**, only grows when you name a color from memory a day or more later. Streaks, combos, gold replays and seals make it fun, but none of them can say you know something you don't.

---

## 0. The rules this rests on

Duolingo is a strong program (difficulty model, spacing, streaks) wrapped around a thin, recognition-heavy workout (KB, "How it started"). ColorHub keeps the program and makes the workout deep. Every design choice below cites the learning KB (`../learning-kb/EXPORT-learning-kb-for-claude-project.md`): a bare **§n** is the KB's convergent core, **X1** and **N1–N8** are its resolved clashes, and **A11–A17** are its ALTER questions. Sections of this document are written as "section n".

| Rule | What it means here | KB |
|---|---|---|
| Producing beats seeing | Within a lesson, steps climb from pick-it to say-it or type-it. By the last third, most steps are recall. | §1, §4 (fade the scaffolding), N6 |
| Space it, cross a night | Due reviews open the next day's lesson. Nothing becomes Yours the same day. | §2, §12 |
| Feeling isn't evidence | No XP. Yours, seals, exams and skill checks count only delayed, unassisted answers. | §3, A5, anti-claims |
| Guess first | One 10-second prediction per lesson, before the teaching. Quick, confident misses come back sooner. | §5, X1 |
| Never show the answer early | Feedback comes only after the attempt is finished. | §5, A11, N1 |
| Specific feedback, then use it | "Yours was lighter and bluer: that's lavender." The missed color comes back within 3 steps. | §6, N1 |
| Neighbors, not families | Each new name is tested against its own look-alike once it has been met. Variety across families is for fun only. | §8 (strong for neighbors, weak for unrelated mixing) |
| Many surfaces | The same name shows up as a flat swatch, a painting spot, a poem line, a gem and a fabric. | §9, N7 |
| One idea per step | One gesture and one question per screen. | §11, DESIGN-SYSTEM principle 4 |
| Use protects memory | Later lessons and games use earlier colors (as look-alikes, distractors and boards), which keeps them alive better than flat review. | §13, A12 |
| Struggle is normal | Every lesson intro says so in one line, and a miss never shames. | §15, A17 |
| Vary the shape | The same item comes back in different formats, so you can't pass it by its shape. | A13, N6 |
| Personalize through use | Interests choose which surfaces you see, never which colors you learn. | N3 |

---

## 1. The journey map

### 1.1 Structure
- **Stage** = a word count from ROADMAP §14: 25 · 50 · 100 · 150 · 250 · 400 · 600 · 800 · 1,000. Counts include the 11 basics, which are only ever checked at placement.
- **Chapter** = about 25 new words (7 lessons, 2 checkpoints and a seal). Its size is close to an ALTER chapter's 7–9 stones. Chapter boundaries always fall on stage boundaries, so a stage holds 1–8 chapters. That gives **40 chapters** to 1,000 words (stage 1: 1 · 2: 1 · 3: 2 · 4: 2 · 5: 4 · 6: 6 · 7–9: 8 each).
- **Stone** = one tap on the path (a lesson, review, checkpoint, deep dive, mission or seal).
- **Stage exam** = the end of a stage. It's the last stone of the stage's last chapter, and it gives you a share card.

### 1.2 Stage order (draft)
`data/core-names.json` doesn't have a teaching order yet. `rank` 0–100 is the old family-blocked units, and from 101 on it's alphabetical. So the coverage tool builds a **draft order**, used throughout this spec, until the ordering job in ROADMAP §14 lands:
1. The 11 basics first (placement only).
2. Then every other name by **usefulness**: its best xkcd survey rank, the same proxy COLOR-SELECTION.md uses.
3. Any name closer than CIEDE2000 6.5 to one already placed waits for a later pass, so the finer distinctions arrive later (COLOR-SELECTION rule b).
4. **Grammar-built names never take a word slot:**
   - modifier compounds ("Light blue", "Dull green", "Pinkish");
   - hue leans ("Blue purple", "Yellow green");
   - repeats of a word already on the list ("Lime green" after Lime, "Sky" after Sky blue).

   That's 386 of the 1,000 core names. They come free once the modifier grammar is taught (ROADMAP §13: one short lesson in chapter 1, hue leans in chapter 2) and show up as "you can build this" recognition items, never as lessons. **This is open question 1.**

Usefulness ordering mixes the families by itself. Chapter 1 is 4 greens, 3 blues, 3 purples, 3 reds and a yellow, with no family block anywhere.

### 1.3 The chapters

Lessons per chapter = new words ÷ 3.5. The strand columns are counts from `journey_coverage.py` for that chapter's new words (see section 8 for the definitions).

| Ch | Name | Stage | New words (draft order) | Skill focus (the braid, ROADMAP §1) | Leans on |
|---|---|---|---|---|---|
| 0 | **What you already know** | placement | The 11 basics plus an adaptive probe (section 7.1) | – | – |
| 1 | **First names** | 1 → 25 | Teal, Magenta, Sky blue, Lime, Violet, Turquoise, Lavender, Tan, Aqua, Forest green, Mauve, Maroon, Olive, Salmon (14) | **Light and dark** (value). The modifier grammar: light, dark, pale, deep. | Flowers 11, articles 14, poems 6, films 5 |
| 2 | **The wardrobe** | 2 → 50 | Beige, Royal blue, Navy, Lilac, Hot pink, Peach, Periwinkle, Sea, Indigo, Mustard, Rose, Burnt orange, Aquamarine, Grass green, Gold, Mint, Plum, Royal purple, Brick, Burgundy, Khaki, Seafoam, Kelly green, Taupe, Chartreuse (25) | **Warm and cool.** The hue leans: greenish, bluish, reddish. | Flowers 19, fashion 12, films 11, articles 19 |
| 3 | **Earth and sky** | 3 → 75 | Puce, Slate, Rust, Cerulean, Ochre, Crimson, Hunter green, Leaf, Eggplant, Steel blue, Robin's egg, Sage, Cream, Coral, Ocean, Midnight blue, Cornflower, Azure, Electric blue, Powder blue, Cobalt, Scarlet, Chocolate, Baby pink, Charcoal (25) | **Vivid and dull** (chroma). The painter's earths against the sky blues. | Paintings, poems 7, prose 12, films 11, articles 20 |
| 4 | **Fruit and jewels** | 3 → 100 | Pumpkin, Tangerine, Raspberry, Orchid, Emerald, Jade, Clay, Umber, Camo green, Mahogany, Aubergine, Evergreen, Ice, Wine red, Denim, Pea soup, Apricot, Cerise, Blush, Marigold, Bordeaux, Pistachio, Military green, Prussian blue, Golden brown (25) | **Neighbors.** Telling a pair apart (the look-alike games). | Museum paintings (10 with ≥10), gems 5, flowers 11 |
| 5 | **Kitchen and garden** | 4 → 125 | Easter green, Amber, Silver, Ecru, Mocha, Coffee, Canary, Camel, Cherry red, Mud brown, Minty green, Ivory, Celadon, Mulberry, Carolina blue, Watermelon, Bottle green, … (25) | **Color next to color.** Albers: one color looks different on different grounds. | Museum paintings, flowers 9 |
| 6 | **Leather and stone** | 4 → 150 | Amethyst, Fawn, Buff, Tomato, Carnation, Banana, Pear, Merlot, Grape, Viridian, Petrol, Warm brown, Racing green, Leather, Terracotta, Old rose, … (25) | **Memory.** Holding a color across a blink (What changed?, n-back). | Museum paintings. **Thin elsewhere:** 1 poem, 0 fashion. |
| 7–10 | **Every corner of the map** I–IV | 5 → 250 | The names that fill the empty regions: muted greens, greys, olive-browns, bistre, near-blacks. The draft list here is weak (see below). | **Masses**: painting's big shapes, squint; then **screens and photos** (casts). | Museum paintings: 71 of 100 have one, 51 have 10 or more. Almost no text strands. |
| 11–16 | Field chapters | 6 → 400 | Each field's key words move earlier (ROADMAP §14 trunk and branches): pigments for painters, whites and greiges for interiors, skin and sky for film and photo. | **Mixing** (Mix lab, §18) and **harmony as intervals** (§16). | Depends on the field |
| 17–40 | Field depth, then **Master** | 7 → 600 · 8 → 800 · 9 → 1,000 | Finer distinctions, about 3 weeks a stage (goal-gradient, §14) | Applied tasks per field at each stage's end | Museum archive throughout |

**Finding:** from about word 140 the draft order runs out of xkcd-ranked names and falls back to alphabetical. That's how Xanadu, Xumo and Fuzzy Wuzzy land in stage 5. The ordering job needs a second usefulness signal for those names (Ngram color-sense, Maerz & Paul, or COLOR-SELECTION rule c, "fills the space"). Two typos also turned up in core-names.json: **Liliac** and **Terracota**.

### 1.4 Stone kinds (borrowed from ALTER's stone system, made ColorHub's own)
| Stone | Looks like on the path | What it is | Gates? |
|---|---|---|---|
| **Lesson** | A 64 px disc split into its 3–4 new colors | About 15 steps, 3 minutes (section 2) | Yes. Lessons open in order. |
| **Review** | A 48 px disc of today's due colors, as stripes | The personal weak-spot lesson (section 7.6). It appears on its own when reviews are due, right where you are on the path. | No |
| **Checkpoint** | A 48 px rounded square in the colors so far | A no-hint test after every 3–4 lessons (section 7.2) | No. Its results feed Yours. |
| **Deep dive** | A 40 px disc showing the story's cover | Optional. A full story from `stories.js` plus 3 recall questions (A15: warmth needs a check). | Never |
| **Mission** | A 40 px disc with a camera glyph | Optional. Find 3 of the chapter's colors in the world (ROADMAP §6). Counts as review. | Never |
| **Seal** | A wide 72 × 48 plate of the chapter's colors | The delayed chapter check (section 7.4) | No. It marks the chapter "sealed". |
| **Exam** | A 96 px disc ringed in paper | The stage exam (section 7.7) with a share card | No |

**Three states**, the same for every kind:
- **Locked:** muted (`--surface-2` disc and a soft name). Named, never hidden. ALTER lets you see every chapter name all the way up.
- **Next:** the one glowing thing. It's 84 px, and a slow 2.8 s breathing scale of 1 → 1.03 is the only looping motion on the path.
- **Done:** lit in its own colors. A tap shows a recap and offers a gold replay; it never re-runs silently.

**Path rules:**
- Chapter N+1 opens when chapter N's lessons are done, never by date (ALTER §5).
- The seal is separate and never blocks, so you can be two chapters ahead while a seal waits for tomorrow (ALTER climb-v2's evidence meter).
- **Jump here** sits on every locked chapter banner (section 7.3).

### 1.5 The path on screen (mockup 01)
- Learn room, warm black. The top block is Today: the due plate, "3 to *recall*", and the paper primary "Continue".
- Below it, the path runs as a single column that sways gently left and right (±28 px, like ALTER's `tx` offsets). It's drawn with the honeycomb's own material: the stones are color discs, never icons.
- **Chapter banner:** a full-width band of the chapter's colors (12 px stripes), its name in `title-2`, and one `note` ("Stage 2 · 25 new words · warm and cool"). Tapping it opens the **chapter card**:
  - why the chapter matters;
  - its colors as plates;
  - its skill;
  - its Go deeper library (section 12);
  - Jump here, if it's locked.
- Locked chapters stay named, with an 8 px band at 30% opacity.
- The Cabinet and Skill check sit below the path. Interests are the last quiet row.

---

## 2. Lesson anatomy

### 2.1 Size
- About **15 steps** in about **3 minutes**. Each step takes 10 seconds or less: 4–10 s to answer, plus about 1 s of feedback.
- The KB has no tested minute figure for phone lessons (A1), so start at 3 minutes and tune from completion data. A lesson can't run past 18 steps, which caps a run of misses (a missed item comes back once, not forever).

### 2.2 What goes in
- **New:** 3–4 names, taken in stage order. The composer skips a name closer than ΔE 10 to another new name in the same lesson and keeps it for the next lesson, so each new name meets its look-alike as a name you already know (contrast, not blocking).
- **Look-alike:** for each new name, the nearest *known* name (basics included) by CIEDE2000, preferring the same hue family. The difference line is the curated one from `data/colors.js` if that pair exists. Otherwise it's computed from ΔL, ΔC and Δh in the fixed modifier grammar ("Darker and duller than lavender, and pinker"), and always phrased against the look-alike (CLAUDE.md: every color gets a line on how it differs from its neighbor).
- **Due:** 2–4 reviews, ordered by:
  1. confident misses first (§5);
  2. then overdue;
  3. then the spacing schedule (1 night → about 3 days → about 1 week → about 2–3 weeks → about 1–2 months, dropping one level on a miss; §2, A2).

  Reviews are always recall. A review color can also turn up as a look-alike, a distractor or a game tile; that's free use, §13.

### 2.3 The order rule
Four phases, interleaved once each name has been met:

| Phase | Steps | Share | What happens |
|---|---|---|---|
| **Wake** | 1–2 | ~10% | One due review as recall (a swipe card or typed). Then one 10-second **guess** about a new color, with a confidence tap. Never scored. (§2, §5, X1) |
| **Meet** | 3–8 | ~35% | A meet card for each new name (name + its look-alike + the difference), each followed within 2 steps by a recognition step with **same-family** options. The first world step goes here. |
| **Mix** | 8–11 | ~25% | One fitted game (§3), one story card, and a world step. Names now interleave, each against its neighbors (§8). |
| **Recall** | 12–15 | ~30% | Type it, say it, name it in the line, then the **recall run**: 3–5 swipe cards of today's new names in shuffled order. The core flashcard loop stays the finale. |

**Checks the composer enforces:**
- Every new name gets ≥4 touches: meet, ≥1 recognition, ≥2 recall, ≥1 non-swatch surface if the data has one.
- ≥6 distinct step kinds per lesson. No kind twice in a row. At most 2 world steps and 1 game.
- In the last third, ≥60% of scored steps are recall.
- A missed item comes back within 3 steps in a *different* format (A13). A confident miss is also flagged for tomorrow's wake step.
- The meet card is the only place a name is shown before an attempt (X1: explicit teaching first, then retrieval). After that, the name never appears before the answer (§5, A11).

### 2.4 Picking world steps
For each slot, the composer walks the new and due names and takes the first world step that clears four tests:
1. Its strand is **on** (section 9).
2. The data has an honest item for that color. A painting spot needs ≥5% of the canvas and nearest-name ΔE ≤ 5. Poem lines come from the vetted `best` lines. Gem and fashion swatches must be named or within ΔE 5.
3. It hasn't been used for that color in the last 3 lessons.
4. It fits the phase: recognition-style world steps (find it, the flower) go in Meet or Mix; name-it world steps (poem line, the look) go in Mix or Recall.

If nothing fits, the slot becomes a Practice step. The lesson never shrinks and never pads with filler.

### 2.5 Feedback and confidence
- **After every scored step, one line:** what it was, plus one fix framed against your answer ("It's mauve. Yours was lighter and bluer: that's lavender."). Right answers get a short line that teaches ("Right. Ochre is the darker, more orange one."). §6, N1.
- **Rings, not overlays.** A 3 px ring sits 3 px outside the right swatch (`--good`) or your pick (`--bad`), so you can keep comparing (DESIGN-SYSTEM §3).
- **Confidence:**
  - asked once per lesson, on the guess;
  - recall cards self-grade with swipe left or right;
  - elsewhere it's inferred: a wrong answer under 1.5 s counts as a *quick miss* and is treated like a confident miss (§5, §16).
- **Misses come back.** A missed color returns within 3 steps in another format, and the lesson-complete screen lists misses as pairs ("You mixed up mauve and lavender twice"), never as a score on you.

---

## 3. Games inside lessons (ROADMAP §20)

Every game is **Task × Board × Twist × Content**. A lesson uses the 10-second **step** size. Train keeps the full **station** with its level ladder. The gym's twist ladders in `js/gym-engine.js` drive both.

### 3.1 How a lesson picks its game (one per lesson)
The composer computes the lesson's colors (new + due) and takes the **first rule that fits**:

| If… | Game (step size) | Why it fits |
|---|---|---|
| A new name is within ΔE 10 of its look-alike | **Odd one out**, flat 3×3 board of the look-alike with one tile of the new name. Then the *which direction* twist: "lighter, bluer". | Telling neighbors apart is the strong form of interleaving (§8) |
| A new or due name has a featured painting spot (≥5%, ΔE ≤ 5) | **Odd one out on a painting board**: the painting cut into 3×3 tiles, one tile's color nudged toward the look-alike | Varied, real surfaces (§9) |
| The lesson's colors span ΔL ≥ 30 | **Word gradient**: put 3 names (no swatches) in order, light to dark | Real vocabulary recall, not matching (§1) |
| ≥3 due reviews | **What changed?**: 6 tiles of the review colors, a 300 ms blink, one tile swapped for its look-alike | Memory for color, change blindness |
| A gem or flower with a texture photo | **Texture edition**: same color, different materials; find the odd material color | Transfer across surfaces (§9) |
| Chapter skill is warm/cool | **Which direction?** only: warmer or cooler than the look-alike | Trains the chapter's skill inside its words |
| Otherwise | **Imposter**: 4 swatches labeled with names, one label wrong | Name ↔ color both ways |

Difficulty in a lesson is **easy**: about twice your current threshold from the eye profile, or ΔE ≈ 8 with no profile yet. New kinds of rounds always arrive easy (ROADMAP §4: novelty replaces pressure).

### 3.2 Harder variants by setting
| Setting | Variants and twists |
|---|---|
| Lesson | Odd one (9 tiles), painting board, What changed? (6 tiles, 1.5 s view), Word gradient (3), Imposter, Which direction? |
| Checkpoint | **Flash** (1 s, then tap where it was) · Odd pair · Word gradient (5) · Imposter with 6 · **Was it there?** (see 5, then find the one that wasn't) · typed answers, no options |
| Chapter seal | "**Find every** teal" (several taps) · "Which one is **NOT** slate?" · painting patch recolored · texture edition · Say them back (3) |
| Stage exam | **Boss boards** near your threshold · How many? (0–4, and zero is sometimes right) · **Illusion round** (the "odd" tile is identical, and "none" is right) · feature isolation (all differ in hue; find the one that differs in lightness) · **Rebuild** (see a gradient for 2 s, rebuild it) · Say them back (4, spoken) |
| Legendary | Everything at exam level with **3 lives** and no options anywhere |

Never inside lessons: n-back, Simon, survival, spirals, mixing puzzles. Those are thinky or long, so they live in Train (CLAUDE.md product rule).

---

## 4. Three example lessons, fully written

Real colors and real content from the data files. **Strands** shows which interest switch each world step needs.

### Lesson A · Chapter 1, lesson 3: "Aqua, forest green, mauve, maroon"
Known: the 11 basics plus Teal, Magenta, Sky blue, Lime (L1) and Violet, Turquoise, Lavender, Tan (L2, yesterday). Due: Teal, Turquoise (a quick miss yesterday: "you said teal"), Tan.

**Intro** (mockup 04):
- Four plates: aqua, forest green, mauve, maroon.
- *Aqua, forest green, mauve and maroon* (title-1).
- Note: "4 new · 3 to recall · about 3 minutes".
- Small line: "Misses are part of how this works. They come back until they stick."
- Primary: **Start**.

| # | Step | Content | Trains | KB |
|---|---|---|---|---|
| 1 | Recall · swipe card | Teal swatch. Flip, then swipe *knew it / not yet*. | Delayed free recall | §1, §2 |
| 2 | Guess (unscored) | Maroon swatch: "What would you call this?" Maroon · Burgundy · Brick, then *Sure / Guessing*. | Primes the meet | §5, X1 |
| 3 | Meet | **Maroon** \| Red. "Much darker than red, and browner." Note: "From French *marron*, chestnut." | Explicit teaching on a worked contrast | §4, X1 |
| 4 | Meet | **Mauve** \| Lavender. "Darker and duller than lavender, and pinker." Note: "French for the mallow flower." | Same | §4 |
| 5 | Pick the name | Mauve swatch → Mauve · Lavender · Magenta (all purples) | Recognition with same-family distractors | N6 (MC as probe) |
| 6 | Meet | **Aqua** \| Turquoise. "Brighter and bluer than turquoise. On screens it's the same as cyan." | Teaching | §4 |
| 7 | Meet | **Forest green** \| Green. "Darker than green, and a little more vivid." | Teaching | §4 |
| 8 | Game · Odd one out | A 3×3 grid of turquoise with one aqua tile: "Find the aqua tile." Afterwards: "It's brighter and bluer." | Telling neighbors apart (ΔE 8.6) | §8, ROADMAP §20 |
| 9 | **World · Name it in the line** (Poetry) | Sara Teasdale, *Sunset: St. Louis* (1920): "Of tawny gold and [▮] and misted turquoise." The chip is mauve. Mauve · Lavender · Magenta. Then the real line appears. | Name from color, in a new context | §9 |
| 10 | Pick the color | "Forest green" → three greens: Forest green · Green · Lime | Name → color | §1 (cued recall) |
| 11 | **World · Story, 2 slides** (History) | ① "In 1856 William Perkin, eighteen, tried to make quinine from coal tar and got black sludge. Cleaning the flask, he saw purple." ② "Paris was already wild for mauve, dyed with lichens and bird guano. Perkin's dye, the first aniline dye, rode the wave." Text link: *The whole story* (saved to the Cabinet). | Elaboration, motivation | A15, then step 13 checks |
| 12 | **World · Find it in the painting** (Paintings) | Botticelli, *The Birth of Venus*: "Tap the tan." (16% of the canvas; review from L2.) The area lights up. | The same name on a real surface | §9, §13 |
| 13 | Recall · Type it | Maroon swatch → type the name. A letter count shows, but no first letter. | Free recall | §1 |
| 14 | Recall · Say it | Turquoise swatch → say it (hands-free mic, typed fallback). Yesterday's quick miss. | Free recall of a confident miss | §5 |
| 15 | **Recall run** | Swipe cards: maroon, aqua, mauve, forest green, shuffled | The core loop, all four new names | §1, product rule |

**Done:**
- The fan of four.
- *You met aqua, forest green, mauve and maroon.*
- Pairs line: "You mixed up mauve and lavender once."
- Cabinet +3: Teasdale's line, the Perkin story, *Birth of Venus*.
- "They come back tomorrow, after a night's sleep."

**With Poetry and Paintings off:**
- Step 9 becomes a second Pick the name, for maroon.
- Step 12 becomes the **flower** step: the yew, Werner's example plant (Flowers strand). If Flowers is also off, it becomes Imposter.
- The colors don't change.

### Lesson B · Chapter 3, lesson 2: "Slate, rust, cerulean, ochre"
Lesson 1 brought puce, crimson, hunter green and eggplant (the order skips names too close to each other, so the lesson keeps its contrasts).
Strands on: Paintings, Poetry, Fashion, Design, Gems (Flowers and Film off). Due: Burgundy (a confident miss last week: "you said maroon"), Periwinkle, Khaki.

| # | Step | Content | Trains | KB |
|---|---|---|---|---|
| 1 | Recall · Type it | Burgundy swatch | Recall of a confident miss | §5 |
| 2 | Guess | Ochre swatch: Ochre · Mustard · Tangerine, then *Sure / Guessing* | Pretest | §5 |
| 3 | Meet | **Ochre** \| Mustard. "Darker and more orange than mustard." Note: "An iron-rich earth, one of the oldest paints." | Teaching | §4 |
| 4 | Meet | **Slate** \| Grey. "A darker grey with a blue tint." Note: "After slate rock, split into roof tiles." | Teaching | §4 |
| 5 | **World · Find it in the painting** (Paintings) | Van Gogh, *The Starry Night*: "Tap the slate." (19% of the canvas, ΔE 2.5.) The area lights up on the map. | Varied surface | §9 |
| 6 | Meet | **Rust** \| Burnt orange. "Darker and duller than burnt orange, leaning red." Note: "The color of iron oxide." | Teaching | §4 |
| 7 | **World · Name the look** (Fashion) | "The 1970s: two moods in one decade." The palette band: mustard, rust, burnt orange, olive, gold, black. One plate is ringed (rust): "Name the ringed one." Rust · Burnt orange · Brick. | Tell apart, in a real palette | §8, §9 |
| 8 | Meet | **Cerulean** \| Teal. "Bluer than teal, at the same lightness." Note: "Latin *caeruleus*, the blue of sky and sea." | Teaching | §4 |
| 9 | Game · Odd one out on a painting board | *The Starry Night* in 3×3 tiles. One tile's blues are nudged 6 ΔE toward cerulean: "Which tile was changed?" Then "It was bluer." | Detecting a real-surface shift | ROADMAP §20, §9 |
| 10 | **World · Name it in the line** (Poetry) | Oscar Wilde, *Impression du Matin* (1881): "A barge with [▮]-coloured hay." The chip is ochre. Ochre · Mustard · Tan. | Name from color, in context | §9 |
| 11 | **World · Story, 2 slides** (History) | ① "About 75,000 years ago, someone at Blombos Cave in South Africa scratched a crosshatch into a piece of ochre." ② "Heat yellow ochre and its goethite turns to hematite. The yellow becomes red: two colors from one earth." | Elaboration | A15 |
| 12 | **World · Design** | "Pantone's first Color of the Year (2000) was called Cerulean. Which of these is the painters' cerulean?" Two swatches: #007BA7 and Pantone's paler #9BB7D4 (marked approximate). | Name → color, and that names drift | §9 |
| 13 | Recall · Say it | Slate swatch | Free recall | §1 |
| 14 | Recall · Type it | Rust swatch | Free recall | §1 |
| 15 | Recall run | Ochre, cerulean, slate, rust, periwinkle | The core loop | §1 |

Fitted game: rule 2 (a new name with a featured painting spot), so it's the painting board.

### Lesson C · A personal review: "Teal and cerulean, and three more"
The learner's log: they called cerulean "teal" 3 times this week. Rust was a quick miss ("brick"). Lilac and Periwinkle are overdue. No new names. 12 steps, about 2½ minutes. It appears on the path as a Review stone: "You mix up *teal* and *cerulean*."

| # | Step | Content | KB |
|---|---|---|---|
| 1 | Recall · Type it | Lilac | §2 |
| 2 | Compare card (a meet card for a pair) | Teal \| Cerulean side by side: "Cerulean is bluer. Teal leans green. Same lightness." | §4: re-teach the exact confusion, once |
| 3 | Game · Odd one out | Teal 3×3 with one cerulean tile, then which direction | §8 |
| 4 | Game · Imposter | Four labeled swatches (teal, cerulean, turquoise, steel blue), one label wrong | N6, A13 |
| 5 | World · Find it in the painting | F. Sødring, *Young Woman Sitting in a Norwegian Landscape* (SMK, cerulean 11%): "Tap the cerulean." | §9 |
| 6 | Recall · Say it | Rust (the quick miss) | §5 |
| 7 | Game · What changed? | 6 tiles: teal, cerulean, rust, lilac, periwinkle, sky blue. A blink, then one tile swapped for its look-alike. | ROADMAP §20 (memory) |
| 8 | Recall · swipe cards | Teal, cerulean | §1 |
| 9 | World · Where have you seen this? | Periwinkle: three pieces from *your* Cabinet. Tap the one that holds it. | §9 ("where have we seen this before?") |
| 10 | Recall · Type it | Cerulean | §1 |
| 11 | Recall · Type it | Periwinkle | §1 |
| 12 | Recall · Type it | Teal (the pair ends on the harder side) | §1 |

**Done:**
- "Teal and cerulean: 4 of 4 from memory today. They come back in 3 days to see if it holds."
- Never "mastered" (§3).

---

## 5. Step catalog

Every step uses one contract: `render(container, item, ctx) → Promise<{ok, answer, ms}>`. The Practice steps are `PR_STEPS[kind]` from `js/practice.js`. World and game steps add `JR_STEPS[kind]`, plus `eligible(color, ctx) → item | null` so the composer can ask whether the data supports them.

### 5.1 Practice steps (from js/practice.js)
| Kind | You do | Trains | KB | Data |
|---|---|---|---|---|
| card | Flip, then swipe *knew it / not yet* | Free recall, self-graded | §1, N6 | Name, hex |
| quiz-name | Swatch → pick 1 of 3 names | Recognition (probe) | N6 | Hex + same-family neighbors |
| quiz-color | Name → pick 1 of 3 swatches | Cued recall of the look | §1 | Same |
| type | Swatch → type the name (letter count shown) | Free recall, production | §1 | Name, aliases |
| say | Swatch → say it (hands-free) | Free recall, faster than typing | §1 | Name, spoken variants |
| match | 3 swatches ↔ 3 names | Mapping both ways | §8 | 3 known names |
| pairs | Memory pairs, swatch ↔ name | Recall + location | §1 | 3–4 known names |
| blitz-yes-no | "Is this cerulean?", 3 quick ones | Fast discrimination | §8 | Name + look-alikes |
| rain | Falling swatches; catch the named one | Speed recognition | §8 | Name + neighbors |
| odd-one-out | 3×3, find the different tile | Perception of the pair | §8, N7 | Two hexes |

### 5.2 World steps (new, JR_STEPS)
| Kind | You do | Trains | KB | Data (honesty gate) |
|---|---|---|---|---|
| **find-in-painting** | Tap the named color's area on a painting; it lights up from the palette map | Name → look on a real surface | §9, N7 | `paintings.js` palette + `*-map.png` (≥5%, ΔE ≤ 5). Museum paintings (`gallery/`) once their maps exist. |
| **name-in-line** | A public-domain line with its color word replaced by a chip; pick or type the word, then see the real line | Name from color, in language | §1, §9 | `poems-index.json` `best` lines + shards (`m` gives the word's span). Prose from `passages.json`. |
| **flower** | A plant photo + its labeled swatch: "What color is this flower?" Then one line: Werner's example or a floriography meaning. | The name tied to a living thing | §9 | `botany.js` byColor (Werner, named, floriography; never dye sources), `werner`, `botany-images.js` |
| **gem** | A gem photo + its illustrative swatch: "This stone is…" (the name it lent, or the swatch's name) | Same, in minerals | §9 | `gems.js` `colors` + palettes (marked illustrative), `gem-images.js` |
| **name-the-look** | A fashion palette (decade, house, Color of the Year) with one plate ringed: name it | Tell apart in a real palette | §8, §9 | `fashion.js` decades, coty, houses (named or ΔE ≤ 5) |
| **film** | "In *Mad Max: Fury Road*, the cool sky that makes the desert pop" + the film's discussed colors: pick the named one. **No stills** for films under copyright: our text, our illustrative swatches and the real-place photo. Pre-1930 films can use a Commons frame. | Name in a described scene | §9 | `films.js` colors (app name, ΔE ≤ 5), images (places, not stills) |
| **story** | 2 slides, one fact each, big type. *The whole story* saves the full story to the Cabinet. | Elaboration and motivation; a later step checks it | A15, §11 | `stories.js`, `wiki-colors.js` facets (checked against the myth list) |
| **seen-before** ("Where have you seen this?") | A color + 3 pieces from your own Cabinet: tap the one that holds it | Transfer across contexts | §9 | The Cabinet (unlocked items only) |
| **design** | A real design use: CSS keyword, Color of the Year, a house color. "Which is the painters' cerulean?" | Names drift between fields | §9 | `fashion.js` coty and houses, `core-names.json` `src: css` |
| **science** | One "why": "Magenta isn't in the rainbow. Which one is magenta?" | Concept tied to the color | §10 | `wiki-nodes.js` concepts (extra-spectral, trichromacy, simultaneous contrast) |

### 5.3 Game steps (ROADMAP §20, at step size)
| Game | Task × Board × Twist | You do (≤10 s) | Trains | Used in |
|---|---|---|---|---|
| Odd one out | find × grid | Tap the different tile | Discrimination | Lessons → all |
| Odd one, painting board | find × painting tiles | Tap the recolored tile | Real-surface shift | Lessons, seals |
| Odd one, texture | find × textures | Same color, different material | Transfer | Lessons, seals |
| Which direction? | find + direction | Then: lighter, darker, warmer, duller… | The vocabulary of difference | Lessons |
| What changed? | recall × grid × blink | See 6, blink, tap the one that changed | Color memory | Lessons (review-heavy), checkpoints |
| Out of order | order × strip | One misplaced tile in a gradient: tap it | Order | Checkpoints |
| Word gradient | order × names | 3–5 names, light to dark | Vocabulary | Lessons (3), checkpoints (5) |
| Imposter | name × labeled grid | One label is wrong: tap it | Name ↔ color | Lessons, checkpoints |
| Was it there? | recall × set | See 5, find the one that wasn't there | Memory | Checkpoints |
| Rebuild | recall + order | Gradient for 2 s, then rebuild it | Memory + order | Exams |
| Say them back | name × memory | 3–4 flash; say them in order | Recall under load | Seals, exams |
| Find every X / NOT X | find × grid | Several taps, or the one that isn't | Category edges | Seals |
| How many? / illusion | find × grid | Count 0–4; sometimes "none" | Calibration (§16) | Exams |
| Bad mix | find × mixes | Which mix isn't blue + yellow? | Mixing intuition | Chapter 11+ (Mix lab) |
| Sky strip | order × painting strip | Put a real sky back in order | Value in paintings | Chapter 7+ |

---

## 6. A day on the path

- **Open Learn.** The top block is today:
  - the plate of colors due;
  - "3 to *recall*" (title-1);
  - the paper primary **Continue**.

  Continue always does the next right thing: the Review stone if ≥4 reviews are due, otherwise the next lesson.
- **Pace.**
  - Three lessons is about 10 new words and 10 minutes, the ROADMAP §14 session size.
  - The daily goal you chose (1–3 lessons) closes the ring. After that, the primary changes to "One more?", never anything stronger.
  - A fourth lesson in one day is allowed but labeled honestly: "New words stick better after a night's sleep. Review instead?" (§12).
- **The next morning.** Yesterday's colors open today's first lesson as recall (the wake step). The seal of a chapter finished yesterday glows.
- **Away for days.** The path waits where you left it. Reviews come back in escalating daily batches (section 7.6), and the streak line says "Welcome back".

## 7. Knowing what you know: the testing layer

Every test is unassisted (no hints, no names on screen before the answer). Only answers given **a night or more after you last saw that color** can make it Yours (§1's Roediger and Karpicke caveat, §3). Tests never take hearts. Legendary is the one place lives appear, and that's opt-in.

### 7.1 Placement: "What you already know" (replaces the current placement, mockup 03)
- **When:** first run, after "What do you love?". It can be retaken from the end of Learn.
- **Shape:**
  1. 11 basics as fast swatch → name (about 20 s).
  2. Then an **adaptive probe** over the stage order: start at stage 2's middle, ask 2 items per probe point, and move up a stage after 2 rights or down after a miss (a staircase). Stop when the bracket is one stage wide, or at 24 items (about 2 minutes).
- **Format:** recognition with same-family options. MC is the right tool for a probe (N6). The last 4 items are **typed**, to confirm the edge.
- **Result:** "You already know about 80 color words. We'll start you at *Earth and sky*." Primary: **Start there**. Text link: *Start from the beginning*.
- **What it counts:**
  - Placed words are **Yours (placed)**, since they're prior knowledge, recalled unassisted.
  - Each one is spot-checked in recall during the next week's reviews, and a miss moves it back to learning.
  - The chapters skipped are marked done, and their Cabinet items unlock.

### 7.2 Checkpoints (every 3–4 lessons, mockup 17)
- 12 items, about 2 minutes. Everything so far in the chapter, plus 3 from earlier chapters (cumulative quizzing, A2).
- Formats: typed and spoken recall, Imposter, Word gradient (5), one flash round. No options on half the items.
- Results:
  - items last seen ≥1 night ago count toward **Yours**;
  - items from today are labeled "today's" and go to review (honest about same-session scores);
  - misses build your next Review stone.
- Screen: "Checkpoint. No hints. What you get right from memory, a night or more after you learned it, becomes yours."

### 7.3 Jump here (test out, mockup 18)
- On any locked chapter banner, a quiet text button: *Jump here?*
- Opens a sheet:
  - the chapter's colors as plates;
  - "Know these already? Pass a 20-question test and the chapter is done.";
  - note: "No hints. About 4 minutes. 17 right to pass.";
  - primary: **Take the test**.
- **The test:**
  - 20 items stratified across the chapter's words, every word at most once;
  - recall-heavy: 14 typed or spoken, 6 games at checkpoint level;
  - plus the chapter's skill game once.
- **Pass (≥85%):**
  - the chapter and all chapters before it are marked done;
  - its colors become **Yours (tested)**, since this is prior knowledge recalled unassisted;
  - its Cabinet items unlock;
  - words you missed become a short lesson ("We'll teach the 3 you missed").
- **Fail:** "Not yet. You knew 12 of 20. We'll start the chapter with the 8 you didn't." Nothing is lost.

### 7.4 Chapter seal (the delayed check, mockup 19)
- Available from the morning after the chapter's last lesson.
- About 15 items, 3 minutes: **every** new word of the chapter once, in **varied surfaces** (a swatch, a painting spot, a poem chip, a texture), plus the chapter's skill game at seal level (Find every, NOT X).
- **Seal earned at ≥80%.** The banner's band turns solid and gets a small paper seal mark (the chapter's colors pressed into a disc).
- **Under 80%:** "Sealed in a few days. 4 colors need another look." Those go to review, and the seal stone waits. It never blocks the path.

### 7.5 Legendary (gold)
- On a sealed chapter: *Go for gold*. Same as the seal, but:
  - no options anywhere;
  - games at exam level;
  - 3 lives.
- **Win:** the chapter band gets a gold hairline and its stones a gold rim (`#C9A646`, used nowhere else).
- **Single lessons:** a lesson finished with every step right first try gets a small *clean* dot. Replaying it harder (typed only, games one level up, no mistakes) turns it gold. Gold is pride only; it never changes Yours.

### 7.6 Personal review lessons (mockup 16 shows one as a stone)
Built from the learner record (KB per-consumer verdict b):
1. **Confusion pairs:** you named A as B 2+ times in the last 14 days.
2. **Confident or quick misses.**
3. **Overdue.**

They use a compare card for the pair, the tell-apart game for that pair, Imposter, varied surfaces and recall (Lesson C).
- **When:** whenever ≥4 reviews are due, a Review stone appears just ahead of you on the path, titled after the top confusion ("You mix up *teal* and *cerulean*").
- **Caps:** at most one a day before the next lesson, and the daily goal counts it the same as a lesson.
- **Restart after a lapse:** after days away, reviews come back in escalating daily batches, not as a dumped backlog (P19). The welcome back says "Nothing is lost. 6 to recall today."

### 7.7 Stage exam + share card (mockup 20)
- At the end of each stage (25, 50, 100…), after that stage's chapters are sealed or ≥1 night after the last one.
- About 5 minutes, covering all of the stage's words:
  - typed or spoken recall of a sample (all of them up to stage 3);
  - one boss board near your threshold;
  - one illusion round;
  - Rebuild;
  - Say them back;
  - the camera mission (find 3 of the stage's colors around you; optional, adds a line to the card).
- **Result card** (shareable, rendered on device as a PNG, 1080 × 1350):
  - the stage's words as a small honeycomb of their colors;
  - "Stage 2 · 50 color words";
  - "47 of 50 named from memory, a day or more after learning them";
  - the date and "ColorHub".
- **Honesty:** never a percentile against other people (A16: compare to your past self). Optional line: "Last stage: 22 of 25."
- **Share** opens the system share sheet with the image. Nothing posts without the user's tap.

### 7.8 Skill check (mockup 15)
- In Learn, below the Cabinet.
- **Per family:** Blues 92% · Earths 61% · …, each a bar in that family's own colors.
- **Per surface:** On swatches 90% · In paintings 74% · In poem lines 81%.
- Every number = right ÷ tried over **delayed, unassisted** attempts in the last 60 days, with *n* shown in `code` ("from 48 checks").
- Fewer than 8 attempts shows "Not enough checks yet", never a guess (§3).
- One tap opens the weakest pair: "Your blues are strong. Earths: you mix up *umber* and *sepia*." Primary: **Practice that pair** (a 2-minute review).

---

## 8. Strand coverage: the first 250 words

Computed by `python3 tools/journey_coverage.py` (draft stage order; 239 taught words after the 11 basics). A strand counts only when the data can build an honest 10-second step:
- **painting:** a featured painting with the color covering ≥5% of the canvas, nearest name within ΔE 5.
- **museum:** paintings in the 23,531-painting archive with a ≥5% swatch whose nearest name is this one.
- **poem:** a vetted line in `poems-index.json`.
- **prose:** a passage in `passages.json`.
- **flower:** a plant whose own color it is (not a dye source).
- **gem:** a gem that lent the name, or a gem swatch within 5.
- **fashion:** a decade, Color of the Year or house color, by name or within 5.
- **film:** a film's discussed color.
- **article:** its own `wiki-colors.js` page.
- **story:** named in a story or wiki page.

"No world step" = none of painting, poem, flower, gem, fashion or film, and fewer than 10 museum paintings.

| Stage | New | Painting | Museum ≥1 | Museum ≥10 | Poem | Prose | Flower | Gem | Fashion | Film | Article | Story | **No world step** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (25) | 14 | 1 | 6 | 2 | 6 | 6 | 11 | 3 | 4 | 5 | 14 | 12 | **1** |
| 2 (50) | 25 | 4 | 13 | 6 | 4 | 8 | 19 | 2 | 12 | 11 | 19 | 14 | **4** |
| 3 (100) | 50 | 5 | 30 | 17 | 9 | 16 | 27 | 10 | 12 | 19 | 33 | 28 | **9** |
| 4 (150) | 50 | 5 | 29 | 15 | 5 | 6 | 11 | 6 | 3 | 9 | 12 | 8 | **23** |
| 5 (250) | 100 | 14 | 71 | 51 | 1 | 1 | 15 | 7 | 12 | 6 | 4 | 3 | **36** |
| **All** | **239** | **29** | **149** | **91** | **25** | **37** | **83** | **28** | **43** | **50** | **82** | **65** | **73** |

### What it says
1. **Stages 1–3 are well fed.** Only 14 of the first 89 words lack a world step, and every word has a meet line. Lessons in chapters 1–4 can run with every strand.
2. **Text strands stop at the old 101.**
   - Poems: 25 of 239. `poems-index.json` only indexes 59 color words, though the corpus holds 11,440 poems. **Cheapest big win:** rerun `tools/poetry.py` with the first 250 names (S, Sonnet) before writing anything new.
   - Articles: 82 of 239; stories: 65 of 239.
   - Both nearly vanish after word 100. This is the ROADMAP §19 writing plan's job, in stage order.
3. **Museum paintings carry stages 4–5.**
   - 71 of stage 5's 100 words have a museum painting, and 51 have 10 or more.
   - Featured paintings cover only 29 words, because their palettes are muted: honest, but few.
   - **Action:** generate palette maps for museum paintings (the `*-map.png` the find step needs) for the 500 most-used ones (S–M).
4. **Gems and fashion are thin** (28 and 43). They're good as variety but can't carry a strand alone. Interests that pick only Gems will see mostly Practice steps, and the "What do you love?" screen should say so ("Gems appear in some lessons").
5. **The gaps (no world step).** These names are the first jobs for ROADMAP §19 (medium articles, data-written sections) and for flower and gem tagging:
   - Stage 1: Aqua.
   - Stage 2: Sea, Rose, Royal purple, Seafoam.
   - Stage 3: Leaf, Eggplant, Robin's egg, Electric blue, Pumpkin, Evergreen, Wine red, Pea soup, Blush.
   - Stage 4 (23): Easter green, Minty green, Carolina blue, Watermelon, Easter purple, Shamrock, Grassy green, Tomato, Carnation, Banana, Pear, Green apple, Merlot, Grape purple, **Viridian**, Hot magenta, Vibrant purple, Twilight, **Petrol**, Mud green, Old pink, Racing green, Old rose.
   - Stage 5: 36, mostly the alphabetical tail the ordering job will replace.
6. **No article and no story mention:** 6 in stage 2, 17 in stage 3, 38 in stage 4 and 95 in stage 5 (full lists in the tool's output). This is the ROADMAP §19 queue in stage order.

`python3 tools/journey_coverage.py --json out.json` writes the per-word rows (with one example item per strand), which the ROADMAP §19 pipeline can take as its batch list.

---

## 9. Interests: "What do you love?"

### 9.1 First run (mockup 02)
- Comes after the welcome, before placement. It's one screen on warm black.
- Title: *What do you **love**?* (title-1).
- Note: "Every lesson teaches the same colors. These choose where you'll meet them."
- **Eight rows**, each with a 40 px picture of the strand drawn from real data and an iOS-style switch:
  - **Paintings** (Starry Night crop);
  - **Poetry** (a line set in serif with its color word in its color);
  - **Fashion** (the 1970s palette band);
  - **Flowers** (lilac);
  - **Gems** (turquoise);
  - **Film** (a real-place photo);
  - **Design** (Pantone-style chip);
  - **Science** (a spectrum strip).
- Defaults: all on except Science. That's open question 4.
- Primary: **Continue**. The count of strands on shows as the button's note ("6 on").
- Turning everything off is allowed. The note changes to "Just the colors: fast and focused."

### 9.2 Changing it later
- **Learn → the last quiet row "Your interests"** (with the current set as a `note`: "Paintings, Poetry, Flowers +3"). It opens the same eight rows as a sheet.
- **View panel → Settings** carries the same row.
- No in-lesson toggle (one gesture per screen). On the lesson-complete screen, a world step you skipped twice in a row prompts one quiet line: "Fewer flower steps?" with a *Turn off Flowers* text link.

### 9.3 What happens to a lesson
- Strands that are off never appear in lessons, checkpoints or seals. Their slots go to the next eligible on-strand, else to a Practice step (section 2.4). Lesson length and the colors stay the same.
- **The Cabinet keeps everything.** Items from off strands still unlock, quietly, into closed drawers. Turn the strand on later and the drawer opens full ("You already have 23 paintings"). Nothing a learner earned is ever lost.
- Field choice (ROADMAP §14) is separate: fields change **which words come earlier** from stage 2 on; interests change **which surfaces** you see.

---

## 10. Gamification that never lies

### 10.1 The pieces
| Piece | How it works | The honesty rule |
|---|---|---|
| **Streak** | A day counts when you finish one lesson or one review. A short day counts the same as a long one (ALTER: show-up pays the same). | It counts showing up, never skill, and it's labeled "days in a row", not "learning". |
| **Freeze** | Earn one per 7-day run and hold up to 2. Used automatically on a missed day. Never sold. | A missed day with no freeze resets the count, but your longest streak stays, and the return line is warm: "Welcome back. 6 to recall, nothing lost." (§15) |
| **Daily goal** | A ring that fills with **today's colors** as you finish steps (ROADMAP §11: "a calm daily-goal ring, not a flame"). Light (1 lesson) · Steady (2) · Keen (3), asked after the first lesson. | It measures effort, and says so. |
| **Combo** | First-try rights in a row. At 3, 5 and 8 the progress segments brighten and the haptic firms up (12 ms, then 10·30·20). The feedback line says "5 in a row". | A combo is a moment and doesn't change progress. A broken combo is never mentioned. |
| **Clean lesson** | Every step right first try → a small paper dot on the stone | Same session, so it's only a dot, never "mastered" |
| **Gold** | Replay a finished lesson or sealed chapter at legendary level (section 7.5) | Pride only. Yours doesn't move. |
| **Lesson complete** | The moment (section 10.2) | It says what you *met*, not what you *know* |
| **Chapter seals** | Earned only by the delayed check (section 7.4) | Delayed and unassisted |
| **Stage exams** | The share card (section 7.7) | Delayed, unassisted, never compared with other people |
| **Leagues (later, with accounts)** | Weekly, opt-in. Ranked by **colors recalled a day or more later**, not XP or time. | Rewards the right thing. Off by default for the first 2 weeks (A16). |
| **Yours** | The one progress number: "Yours · 64". A color becomes Yours when recalled unassisted ≥1 night after you last saw it (a review, delayed checkpoint item, seal, exam, test-out or placement recall). It can drop back to Learning after two misses in a row. | This is the only claim of knowing, and it's always delayed (§3). |

### 10.2 The lesson-complete moment (mockup 13)
On booth grey, under 2 seconds, and skippable by a tap:
1. **The fan:** the lesson's 4 new colors fan out from the center like paint chips (`--dur-4`, 700 ms), with the done haptic (10·30·20).
2. **The line** (title-1): "You met *mauve*, maroon, aqua and forest green."
3. **Three facts** in a row of `code` numbers with serif labels:
   - **13/15** first try;
   - **best combo 6**;
   - **streak 12 days** (the 12 flips like a departure board when it rises).
4. **The daily ring** fills with today's colors.
5. **Cabinet +3:** three small cards (the Teasdale line, the Perkin story, *The Birth of Venus*) fly into a drawer glyph, one at a time, 120 ms apart. The drawer shimmers once.
6. One `note`: "They come back tomorrow, after a night's sleep."
7. The paper primary **Continue** (back to the path, where the marker slides on to the next stone). A text link *Go deeper: mauve* opens the article; back returns here.

### 10.3 What never happens
- No points, XP, gems or currency of any kind. Nothing buys progress, and nothing is sold.
- No answer before the attempt is finished: no hint buttons, no first letters in typed recall, no names on swatches before the tap (§5, A11).
- No "mastered", "learned" or "you know" inside a session. Same-session scores under-report learning, and feeling isn't evidence (§1 caveat, §3).
- No progress bar that fills for time spent, and no fake "almost there".
- No hearts or lives in lessons, checkpoints, seals or exams (only opt-in Legendary).
- No comparison with others before leagues, and leagues rank delayed recall only.
- No guilt copy: no "you lost", no crying owl, no red counters (§15, ALTER "no visible low standing").
- No streak repair for money.

---

## 11. The Cabinet (mockup 14)

A collection of the real things the colors live in. It grows as you learn, and it's the main reward.
- **Unlock:**
  - When you **meet** a color (its lesson ends), its strand items unlock: its paintings (featured, plus up to 3 museum ones), its best poem line, its flower, gem, look and film, and its story.
  - When the color becomes **Yours**, every card holding it gets a small solid disc of the color on its corner (it's an outline until then).
  - So there are two moments of delight: the find, and the keep.
- **Drawers:**
  - one per strand: Paintings, Poems, Flowers, Gems, Looks, Films, Design, Science;
  - plus **Words**, a plate per color in the order you met them;
  - plus **To read**, the stories you saved mid-lesson.
- **Layout:**
  - Warm black. The room header is "Cabinet" (title-1) with the note "41 pieces · 18 yours".
  - Then each drawer as a horizontal shelf of cards (`--surface-2`, `--r-2`, image flush at the top, `title-3` title, `note` source).
  - A shelf shows its count, plus the next locked piece as a muted silhouette with one line: "Unlocks with *cerulean*".
  - That gives you a reason to come back that tells the truth.
- **Every card links to its page** with the signature grow: the painting page, the poem (with its line highlighted), the gem or flower page, the film page, the color page. Every page shows "In your Cabinet" when collected, and the colors in the card are tappable (the color sheet).
- **Sharing:** a card can be shared as an image with its credit line (CC BY images keep their credit).

---

## 12. The braid: how articles, wiki pages and stories hook in

ALTER braids theory and practice in one path. ColorHub braids **the words** (lessons) with **the world** (articles, stories, archive):

1. **Inside a lesson,** at most one 2-slide story card. It goes after the Meet phase, as a breather.
   - It's built from a `wiki-colors.js` facet or a `stories.js` story about one of the lesson's colors, and only if that color has a checked fact. Colors without a real history get none (CLAUDE.md: only colors with a real history get a signature story).
   - Its text link *The whole story* **saves** to the Cabinet's To read drawer. It never leaves the lesson mid-flow.
2. **At lesson complete,** one *Go deeper: mauve* text link opens the full color article. Back returns to the complete screen, then the path. One layer down, one layer up (DESIGN-SYSTEM §2).
3. **The chapter card** (tap a banner) holds the chapter's **Go deeper library**: 3–6 wiki pages and stories matched to its colors and skill.
   - Ch1: Basic color terms, Value, Two blues one word.
   - Ch2: Warm and cool, Pink and blue.
   - Ch3: Earth pigments, A blue as precious as gold, Cobalt blue.
   - Each item can be read now or saved.
4. **Deep-dive stones** (optional) put the best stories on the path itself: the full story, then 3 recall questions about it (A15). They count toward the daily goal and never gate.
5. **Color pages know the path.**
   - A color's page shows where it sits: "On your path: *Earth and sky*, lesson 2", "Yours since 3 Oct", or "Coming in stage 4".
   - **Learn it** (the focused look-alike flow) still lives on every color page. Colors learned there count toward the path, and the path skips them (they appear as review).
6. **The Cabinet links everywhere** (section 11), and every page links back to the Cabinet card that holds it.
7. **Explore stays a place to wander.** Nothing in Explore is gated. The path only adds a "you've met this" layer to what's already there.

---

## 13. Build notes (for the Sonnet build, after approval)

- **State** (additive, with a `migrateState()` step; never wipe `colorhub-v1`):
  - `S.journey = { v, chapter, stone, stones: {id: {done, clean, gold, sealed}}, interests: {paintings, poetry, fashion, flowers, gems, film, design, science}, goal, streak: {n, best, last, freezes}, ring: {day, steps} }`
  - `S.items[name] = { met, yours, ivl, due, log: [{t, kind, ok, ms, conf, as}] }`. Here `as` is what you answered, which is what feeds the confusion pairs.
  - `S.cabinet = { cardId: t }`
  - The migration maps today's learned units to `met`, and to `yours` where a successful review exists ≥1 day after first sight.
- **Routes** (one line each in router.js `ROUTED`): `#/learn`, `#/lesson/<ch>.<n>`, `#/review`, `#/checkpoint/<ch>.<n>`, `#/seal/<ch>`, `#/exam/<stage>`, `#/placement`, `#/jump/<ch>`, `#/cabinet[/<drawer>]`, `#/skills`, `#/interests`.
- **Data:**
  - an offline build step (an extension of `journey_coverage.py`) writes `data/journey.json`: the stage order, chapters, and per-word strand item ids (not text);
  - the app joins those ids to the existing data files at run time;
  - `needsWiki()` wraps lesson screens that need stories or articles.
- **Composer:** a pure function `composeLesson(record, chapter, interests, today) → steps[]`. Put it in tests with fixed seeds, so every lesson is checked against section 2.3's rules (≥4 touches, ≥6 kinds, recall share, distractor family).
- **Order of work:**
  1. composer + player with Practice steps only;
  2. world steps;
  3. game steps (shared with the Train redesign);
  4. tests (placement, checkpoint, seal, jump, exam);
  5. Cabinet;
  6. moments pass.

---

## 14. Open questions for David

1. **Words vs grammar.** The draft order leaves 386 of the 1,000 core names out of lesson slots because the modifier grammar builds them ("Light blue", "Dull green", "Lime green" after Lime). Should these count toward the 1,000 and toward Yours once you can produce them, or should the stages count only the ~614 real words, with the grammar taught once?
2. **Chapter size.** About 25 new words a chapter gives 40 chapters to 1,000, each with a seal. The alternative is one long chapter per stage (9 chapters, up to 57 lessons each). I recommend 25.
3. **When the Cabinet unlocks.** At meeting a color, with the "Yours" disc added later (recommended: two moments of delight)? Or only once the color is Yours (stricter, slower)?
4. **Default interests.** All on except Science? Or ask with everything off, so each switch is a real choice?
5. **Film without stills.** For copyrighted films, the film step uses our text, our illustrative swatches and a real-place photo, never a frame. Is that enough of a "film" step to keep it in lessons, or should Film live only in Explore and the Cabinet?

---

## 15. Mockups

`design/journey-mockups.html` is one self-contained page: fonts and images are inlined, and it works offline. It shows phone frames at 375 × 812. The switches, the Pick the name answers and the path's stones respond to taps. Add `?h=667` to see every frame at iPhone SE height; all 22 fit without clipping. `?solo=f05` shows one frame alone. Screenshots, one per frame at 2x, are in `design/journey-shots/`.

| Frame | Shows |
|---|---|
| f01 | The path: Today, chapter 3's stones, the next lesson, locked ahead, chapter 4 with *Jump here?* |
| f02 | What do you love? (first run, working switches) |
| f03 | Placement intro |
| f04 | Lesson intro (Lesson A) |
| f05 | Meet (mauve against lavender) |
| f06 | Pick the name (tap for right or wrong) |
| f07 | World step: name it in the line (Teasdale, Poetry) |
| f08 | World step: find it in the painting (slate in *The Starry Night*, Paintings) |
| f09 | World step: name the look (the 1970s palette, Fashion) |
| f10 | Recall: type it |
| f11 | Game step: What changed? |
| f12 | Game step: odd one out on a painting board |
| f13 | Right |
| f14 | Wrong |
| f15 | Lesson complete (combo, streak ring, Cabinet +3) |
| f16 | The Cabinet |
| f17 | Skill check |
| f18 | Checkpoint |
| f19 | Jump here? |
| f20 | Chapter seal check (*Find every*) |
| f21 | Stage exam share card |
| f22 | A personal review (Review stone intro) |
