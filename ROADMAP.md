# ColorHub roadmap (approved by David, 2026-10-07)

Everything here is approved in principle. Build it in small, verified steps: one or two Sonnet agents at a time,
each with a clear job and a size estimate (S/M/L) agreed before it starts. See also DESIGN.md (feature hierarchy)
and CLAUDE.md (honesty and copyright rules).

## Rejected or deferred (don't build)
- "Where's the seam" (a hidden step in a gradient): too weak.
- Ghost of yourself (racing last week's run).
- Head-to-head duels and other multiplayer: later.
- Rabbit-hole view: too close to the honeycomb.
- Mix with your paints (pick the tubes you own): good, but later.
- Seasonal skins.

## 1. The path (Duolingo-style, like ALTER's journey)
One linear journey of chapters and lessons. Today, Train, Explore and Studio stay as places to wander; the path is the
spine and always knows the next step. No lesson-picking (product rule), the swipe deck stays fast, and thinky drills
stay out of the deck: they run as separate short steps inside a lesson.

**A lesson** (3-5 min) is a short playlist of steps, e.g. "The blues":
1. Meet: 4 new names on the swipe cards.
2. See: odd one out with just those colors.
3. Sort: a 2D board of them.
4. Story: 3 slides (e.g. why ultramarine cost more than gold).
5. Make: build one of them on the wheel.
6. Mission (optional): find it in the world (see section 4).
Ends with a lesson score and Next.

**Chapters** (theme + skill focus):
1. Seeing light and dark (value: squint, lighter/darker)
2. Warm and cool (temperature, find neutral)
3-8. The families: blues, greens, reds and pinks, earths, purples, greys
9. Color next to color (Albers, make it vanish, one color two looks)
10. Memory and the real world (missions)
11. Painting (big masses, Zorn palette, master copies)
12. Screens and photos (colorist: casts, Kelvin, shot matching)

**Mechanics**
- Checkpoints every few lessons: a short no-hint test of everything so far (honest progress).
- Review lessons appear on their own when spaced reviews are due, mixed in.
- Legendary: replay a finished lesson harder to "gold" it.
- Test out: strong players can test out of a chapter with objective checks.

## 2. Odd one out: a family of games
**What you look for**
- Odd one (today's).
- Odd pair: two tiles differ; find both (forces a full scan).
- Odd group: 3-5 tiles form a hidden shape (line, L, letter) in a slightly different color.
- How many? 0-4 tiles differ; zero is sometimes right.
- Twins: every tile differs except two identical ones; find them.
- Which direction? After finding it, say how it differs: lighter, darker, warmer, cooler, more vivid, duller.

**Layout and context**
- Grid, ring, honeycomb, scattered mosaic, a single paint strip.
- Mixed tile sizes (size changes how color looks).
- Busy grounds: tiles on a colored or patterned ground (simultaneous contrast).
- Gradient boards: tiles already drift in a smooth gradient; one breaks the pattern.
- Real images: a painting cut into tiles with one slightly recolored; later photos (fabric, leaves).

**Time and attention**
- Flash: the board shows for about 1 s; tap where the odd one was.
- Growing board: each right answer adds tiles (3x3, 4x4, 5x5) until a miss.
- Speed tiers: a bonus round at half the time after a right answer, with a combo meter.

## 3. Rearrange: a family of puzzles
- 2D gradient: lightness down, hue across (or warmth across, vividness down); anchors fixed; drag tiles home.
- Ring: sort around the hue wheel (a Farnsworth-style test as a game).
- Two-sheet swap: two near-identical gradient boards with a few tiles swapped; send each back to its sheet.
- Repair: a correct gradient with 3 wrong tiles; find and fix them.
- Mixing ladder: given the two ends, choose the in-between steps from a tray.
- Painting strip: a sky or shadow from a real painting, cut and shuffled.
- Shapes beyond a strip: ring, 2D grid, spiral.
- Feedback: tiles in the right place lock in with a glow (Wordle-style, 3 tries); after the round, a heat map of how far each tile was off.
- Feel: a snap and tick as a tile lands; a ripple across the board when it's all correct.

## 4. Progression and flow
- One hidden skill estimate per judgment (lightness, hue, vividness, warmth, memory, context) and per color region,
  updated every round (Elo / item-response style); every puzzle has a difficulty on the same scale.
- The eye profile shows it honestly ("you see blues to 1.4, greens to 2.1"); weekly check-ins give the true trend.
- Flow: target about 80% right overall, but the difficulty breathes inside a set (easy, medium, hard, easy, harder,
  boss, easy). New kinds of rounds arrive at easy difficulty, so novelty replaces pressure.
- Streak-sensitive: three quick rights make the next round a little harder; a miss makes it a little gentler.
- Speed counts lightly: fast and right earns more, slow and right never costs.
- Worlds instead of numbers (Greys, Skin tones, Skies, Shadows), each with a final challenge; optional mastery stars
  (finish, fast, no-hints).
- Before and after: "last month you needed this much difference, now this much", shown with two real color pairs.
- A visible journey map per station: 20 levels with milestone lines ("Level 10: you can tell grey-greens apart").
- Daily three in Train: three short sets picked from weak spots, about 3 minutes, one tap.
- Replay your misses after a set, side by side.

## 5. Memory
- Memory tied to words: see a color, later pick its name (and the reverse).
- Real objects: remember the color of a fruit or fabric in a photo, then pick from swatches.
- Sequence mode: 3-5 colors flash in order; rebuild the order (Simon).
- Drift reveal: after a miss, show which way memory drifted (more vivid, lighter...).

## 6. Learning and Today
- Unit stories: each unit opens with a 3-slide "why these colors belong together".
- Varied examples: some cards show the color as a real object (a teal duck, a sienna hillside), not a flat swatch.
- World as review (missions): "Spotted teal today?" Take or upload a photo; the app itself checks whether that color,
  or anything close, appears anywhere in the picture (no pointing needed) and counts it as a review.
- A gentle weekly recap card: your names, your eye, your finds.

## 7. Explore
- Color pages as hubs: In paintings, In poems, In books, In films, In fashion, In nature, In gems.
- Today in color: an on-this-day note.
- Mood search ("sea at dusk") via the library and palettes.
- Merge Paintings and Poems into one "Art" filter (Explore has 6 filters; the rule says about 4).

## 8. Studio
- Palette critique: lightness spread, color-blind safety, contrast, with a "fix" button.
- Mockups: the palette on a poster, a phone screen, a room, an outfit.
- Exports: Procreate, Adobe (.ase), Figma, CSS.

## 9. Beauty and feel
- The motion pass: color floods on reveal, chips fly into pages, level bars fill.
- Sound design (optional): soft tones per hue, a chord on level-up.
- Haptic language: light tick per tile, firm for right, double for wrong.
- Typography polish: bigger hero names, consistent paper-chip labels.

## 10. Clever
- The color mind profile: one place that knows your words, eye, taste and finds; every tab reads it.
- Adaptive coach: "You confuse teal and cerulean: 3 cards, a 30-second story and a drill for that pair."
- Explain my miss: one sentence after any mistake on why the eye was fooled (vividness, surround, size).

## 11. Design: next level (approved 2026-10-07; the "everything is a paint chip" signature idea is NOT approved, signature object still open)
- A real design system: complete tokens (spacing, radius, type sizes, motion durations/easing, shadows, the two surrounds),
  a type scale with intent (one huge display size for names, one reading, one label), a custom icon set (20-30 icons, one grid
  and stroke, with a small family signature), a hidden component sheet showing every component in every state, and a
  design-QA checklist before every push.
- The path as the home screen: a winding single-column path of lesson markers in each chapter's colors (done ones filled,
  the current one pulsing, future ones outlined), chapter banners as wide swatches, bigger checkpoints, gold for legendary,
  a marker that slides on when a lesson ends.
- Moments: lesson complete (a short fan of the lesson's colors, the score counting up, a soft chord, a firm haptic; under 2 s,
  skippable); a new color owned (it flies into the collection, which shimmers once); level up (the ladder fills with rising
  ticks, the number flips like a departure board); a calm daily-goal ring filled with today's colors, not a flame.
- Motion language: three speeds (micro 100-150 ms, standard 250-350 ms, celebration 600-900 ms, rare), two easings (a soft
  spring for physical things, a calm ease for screens), every motion explains something.
- Sound and haptics as one language (optional sound; hue families may get their own pitch).
- Restraint: one idea and one filled button per screen, more space and fewer borders, less text, the squint test.
- Character without a mascot: a warm, curious, slightly witty voice; small drawn details in empty states and stories.
- Screen-by-screen: Today = the path; flashcards with paper texture and a felt stack; Train = a map of station worlds with
  progress rings and full-bleed drills; Explore = big editorial covers and color pages as hubs; Studio = a workbench where
  palettes are strips you can drag, with instant mockups; results = before/after color pairs.
- Order: design system first (M), the path home with the path (roadmap step 4), the moments pass with sound and haptics (S-M),
  then one tab at a time (S each). Ask David for 3-5 reference screenshots (Duolingo, ALTER, others) before the design system.

## 12. The honeycomb as the home screen (approved 2026-10-07; next build after the running agents)
- The app opens on the full-screen color explorer (the 101 you're learning by default); chrome fades while browsing.
- The honeycomb stays pure: true colors only, no progress rings, no dimming (every color must look exactly like its name).
- Progress is a view, not a marking: one-tap toggles in the title control: All 101 · Learned · Learning · Not met yet.
- Controls (David preferred this over the ALTER-style corner menus): almost nothing on screen but color.
  - One caption at the bottom names the color in the center as you drift ("Cerulean · a lesson word"), like a radio dial.
  - Controls appear only when needed: tap empty space or pause and a thin glass bar fades in; start dragging and it fades away.
  - The bottom sheet is the app: a small handle at the bottom edge. Pull it up partway = Today (Continue · Challenge · Today's
    color · a Train suggestion). Pull it all the way = four big doors: Learn · Train · Explore · Studio. Push it down = back to color.
  - No tab bar on the home screen; inside Learn/Train/Explore/Studio a slim back-to-honeycomb button sits top-left.
  - Title control at the top (shown with the bar): "The 101 you're learning ▾"; tap for views (All · Learned · Learning · Not met yet
    · Every name · families · traditions); swipe sideways on it to flick between All/Learned/Learning/Not met.
  - Pull down from the top for search ("sea", "rust", "Monet"): the honeycomb glides to the closest color or filters to matches.
  - A camera button in the bar: point at something and the honeycomb flies to the nearest name.
  - Small touches: a faint haptic tick as bubbles pass the center; long-press a bubble to peek (name + look-alikes); two-finger
    tap to zoom out to the whole view; a "surprise me" dice that glides to a color you haven't met.
  - First launch: the honeycomb drifting, one line: "Every color has a name. Tap one." First tap opens its page; first Learn it is guided.
- Tap a color: its FULL page opens directly (no half-height card, no second tap): the bubble grows into the page's swatch; the page has
  the story, look-alikes, In paintings/poems/nature/fashion, and a prominent Learn it button near the top. Back or swipe down returns
  to the honeycomb exactly where you were.
- Learn it = an instant ~2-minute lesson built around that color and its 3-4 closest look-alikes:
  Meet (swipe cards for the ones not yet known) → tell them apart (odd one out with only that group) → sort (strip or 2D board)
  → Pick it (name → choose among the look-alikes) → one memory round. Ends with "You learned teal, and how it differs from
  turquoise, petrol and cerulean"; every color in it joins spaced review.
- The path stays as the gentle default (the Continue pill); exploration is the other way in. Spaced review ties both together.
- Size: M (Sonnet), reusing deck, odd one out, sort, Pick it and memory.

## 13. Every color is a link; two-tier vocabulary (approved 2026-10-07)
**Painting palettes (next job after the Commons batch lands, M, Sonnet)**
- Arriving at a painting from a color search highlights the matching swatch: "≈ Aubergine · 5% of the canvas", with the precise
  library name under it (fixes "the color I came from isn't in the palette").
- Dynamic palette: a slider for how many colors (3 / 6 / 12 / up to ~20), precomputed offline from the cached small copies
  (stored per painting in the gallery detail shards, no extra phone download); tap anywhere on the painting to name that spot
  where the museum's image allows canvas reads (CORS), else the slider still works.
- App-wide rule: every swatch everywhere is tappable (paintings, fashion, looks, poems, botany, gems, palettes).
**The color link sheet**
- Several nearest words in both tiers, each with closeness and tappable: Core words (the 101) and Precise names (library,
  with provenance, e.g. Japanese kanji), plus the look-alike ring, "More paintings with this color", and Learn it.
**Library color pages**
- Every library color gets a generated page: names and sources, synonyms, look-alikes, paintings/poems/fashion containing it,
  nearest core word.
**One primary English name per distinct color (David, 2026-10-08)**
- The app teaches English color words. Every distinct color gets ONE primary English name: the most common English name for it
  (xkcd survey frequency and everyday usage first, then established trade/pigment names). Near-identical names are merged
  into that one color (below about ΔE00 2-3); alternates are shown only as small "also called" info on its page, never taught.
- Non-English names: if a distinct color HAS an English name, foreign names for it are cultural notes only (not taught).
  If a distinct color has NO English name, it uses the best non-English name as its primary name, romanized with a short
  meaning (e.g. "Ebizome (grape-vine purple)"), and it is learnable like any other color (English borrowed most color words:
  khaki, sepia, turquoise).
- Target: about 1,000 distinct, nameable colors in total; fewer is fine if that's what the distinct-English-names test yields.
**The vocabulary ladder (later job, M)**
- Level 1: the core 101 (today's path). Level 2: common English names people use (~300). Level 3: painter's and designer's
  English names (pigments, trade names; ~300). Level 4: the remaining distinct English names, up to ~1,000 in all.
- Built from look-alike groups; Learn it works on any ladder color.
- Progress shows both tiers: "Core 64/101 · Library 212/~1,000"; the top of the ladder = "master colorist".

## 14. Stages and fields (approved 2026-10-08, sizes revised the same day; replaces the fixed 4-level ladder in §13)
No colored belts. The 11 basics are a placement check only, never taught. Counts are total words you know, basics
included. Each stage roughly doubles the last (25 → 50 → 100 → 250 → 500 → 1,000), and each ends at a real-world benchmark:
- **Stage 1: 25.** Just above the average adult. In Lindsey & Brown (2014, free naming), men used ~9.7 words beyond the
  basics and women ~12.3, so a typical adult actively uses about 21-23. Short on purpose: a win in 2-3 days.
  Placement skips it for people who already know these words.
- **Stage 2: 50.** The color-aware person (fashion, home, shopping): salmon, mauve, coral, khaki, rust, mint, burgundy...
- **Stage 3: 100.** The "big crayon box" (Crayola's largest standard box is 120). Werner's Nomenclature of Colours
  (110 names) was what Darwin used to describe specimens.
- **Stage 4: 250.** A word near every region of color space. The ISCC-NBS naming system splits all colors into 267 named
  blocks. Check with our data: the nearest-word ΔE should fall sharply by this point. CSS's 148 named colors can be a
  milestone badge inside this stage.
- **Stage 5: 500.** Field depth: where the field paths differ most (pigments, whites/greiges, film/skin tones, fabrics).
- **Stage 6: Master, ~1,000.** About the size of the xkcd survey's 954 most agreed names. Beyond that, people stop agreeing
  on names, so they become niche or brand names (library only).
Memory: the size of a session never changes (about 10 new words a day plus reviews, introduced a few at a time). Only how long
a stage lasts grows: early stages take days, late ones weeks (goal-gradient: wins come early, then the end of each stage stays
in sight). Later words are finer distinctions, so they go slower.
Inside a stage you still learn about 10 at a time (the existing units); the stage is the chapter. Each stage ends with an
honest no-hint test (name + pick the colors, one eye drill with them, a camera mission to find some of them in the world).
**Ordering logic:** usefulness first (xkcd frequency, everyday usage), then coverage (each stage fills the biggest gaps in the
color map, so it fills evenly), then distinctness (no near-twins in one unit), niche/traditional last. Start from
research/COLOR-SELECTION.md.
**Fields** (asked at the start, editable any time, several allowed): painter · digital artist/illustrator · graphic/UI/brand
designer · filmmaker/photographer/colorist · interior designer/architect · fashion/textile · just curious.
- Trunk and branches: Stage 1 is shared by everyone; from Stage 2 each field's key words move earlier and its Train stations,
  Studio tools and World content get emphasis (painter: earth/pigment names, value, mixing, Zorn, masses; digital: screen
  colors, skin/sky, palettes; designer: neutrals, contrast, critique, exports; film/photo: skin, sky, teal-orange, casts,
  Kelvin, shot matching; interior: whites/off-whites/greiges, wood/stone, undertones, light; fashion: camel/burgundy/blush/
  nude/khaki/plum, seasonal palettes, fashion history).
- Several fields: blend and interleave their lists; shared words once; stages never get longer, only the mix changes.
- Applied tasks per field at the end of each stage (mix it, build a palette that passes contrast, grade toward it, pick the
  right white for a room...), plus the camera mission.
**Build:** the ordering (data, S-M, Sonnet) + stage UI/tests/field choice (M, Sonnet) as the chapters of the path (§1).

## Also queued
- World: Botany (in progress), then Gems.
- Color-list swaps from research/COLOR-SELECTION.md (Bistre, Stone, Green grey, Rose, Grape, Seafoam; Terracotta and Tangerine hex fixes; cross-unit near-twin check).
- Finish the paused work: Looks archive; the ~270 downloaded wiki images.
- Later: business (Plus, a free atlas site), Colordle, the Russian edition.

## Suggested build order (each step small enough to check on the phone in between)
1. Odd one out family, part 1: odd pair, how many, twins, which direction, flash, growing board + the breathing difficulty. (M, Sonnet)
2. Rearrange family, part 1: 2D gradient, ring, two-sheet swap, repair + Wordle-style hints and the heat map. (M, Sonnet)
3. Memory additions + replay misses + daily three. (S, Sonnet)
4. The path: lesson player and chapters 1-3, checkpoints, review lessons. (M-L, Sonnet, after a short spec review)
5. World as review (photo missions with automatic color finding). (S-M, Sonnet)
6. Color-page hubs, the Art filter merge, explain-my-miss. (S)
7. Studio critique, mockups, exports. (M)
8. Motion, sound, haptics pass. (M)
