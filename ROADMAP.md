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
- Every one of the ~1,000 links to its nearest 1-2 of the 101 (David, 2026-10-08), where the deep history, stories and culture
  live: "Close to Teal and Slate · read their stories". It's in the color sheet too, so no color is a dead end. The dot that
  marks the 101 inside bigger honeycomb sets goes away once every color has a page.
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

**Why 1,000 and not 2,700 (measured 2026-10-08, tools/name_coverage.py, 20,000 painting palette colors, CIEDE2000):**

| names | median | 90th | within 3 | within 5 |
|---|---|---|---|---|
| 250 | 5.2 | 7.0 | 10% | 46% |
| 500 | 3.8 | 5.3 | 27% | 85% |
| 1,000 | 2.9 | 4.2 | 53% | 97% |
| 2,711 | 2.4 | 3.8 | 71% | 98% |

Going from 1,000 to 2,700 names cuts the median gap by only 0.5, which is below what museum photos and phone screens
already vary by. The modifiers cover the rest. The 2,700 stay as "also called" synonyms on tap.

**One naming system (David, 2026-10-08): every place that names a color uses the same function and the same list.**
- Data: one file holds the ~1,000 primary names (§13), each with its synonyms and cultural notes. The 2,700-name library
  becomes synonyms and info, never a separate naming source.
- One function, `nameOf(color)`, used everywhere: painting palettes, the camera, photo palettes, Studio, the honeycomb,
  look-alikes, Learn it, the mosaic and image analysis (§15-16). Nothing else picks names.
- Output by distance (CIEDE2000, tune the thresholds on real paintings):
  - very close (about ΔE < 3): the word alone, "Teal"
  - near (about 3-8): word + one modifier, "greyish teal", "deep olive", "pale salmon"
  - far: "between teal and slate"
  - tapping always shows the nearest 3-5 words with how close each is
- Modifiers are a small, fixed grammar, the same everywhere: light/pale, dark/deep, greyish/dusty, bright/vivid, and hue
  leans (reddish, yellowish, greenish, bluish, purplish). They're taught once, early in the path (Stage 1-2), as their own
  short lesson.
- Learning-aware display: the name is always the true nearest of the 1,000. Names you've learned are shown plainly; names
  you haven't met yet get a small "new word" mark that leads to Learn it.
- Gate: tools/check.js fails if any js file names colors any other way (no direct library lookups for display).

## 14. Stages and fields (approved 2026-10-08, sizes revised the same day; replaces the fixed 4-level ladder in §13)
No colored belts. The 11 basics are a placement check only, never taught. Counts are total words you know, basics
included. Stages grow fast at first, then level off at about +200 new words (about 3 weeks), so no stage drags on:
25 → 50 → 100 → 150 → 250 → 400 → 600 → 800 → 1,000 (new words: +14, +25, +50, +50, +100, +150, +200, +200, +200).
- **25.** Just above the average adult. In Lindsey & Brown (2014, free naming), men used ~9.7 words beyond the basics and
  women ~12.3, so a typical adult actively uses about 21-23. A win in 2-3 days. Placement skips it for people who already
  know these.
- **50.** The color-aware person (fashion, home, shopping): salmon, mauve, coral, khaki, rust, mint, burgundy...
- **100.** The "big crayon box" (Crayola's largest standard box is 120). Darwin described specimens with Werner's
  Nomenclature of Colours (110 names).
- **150.** About the 148 named colors in web code (CSS): the designer's everyday set.
- **250.** A word near every region of color space. The ISCC-NBS naming system splits all colors into 267 named blocks.
  Check with our data: the nearest-word ΔE should fall sharply by this point (move the stage if the drop is at 200 or 300).
- **400 / 600 / 800.** Field depth: the field paths differ most here (pigments, whites/greiges, film/skin tones, fabrics).
- **1,000: Master.** About the size of the xkcd survey's 954 most agreed names. Beyond that, people stop agreeing on
  names, so they become niche or brand names (library only).
Memory: the size of a session never changes (about 10 new words a day plus reviews, introduced a few at a time). Early stages
take days; from 400 on, each stage is about 3 weeks (goal-gradient: the end of the stage always stays in sight). Later words
are finer distinctions, so they go slower.
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
**The honeycomb uses the stages too (David, 2026-10-08):** the view panel's "How many" control snaps to the stages instead of a
free slider: Stage 1 (25) · 2 (50) · 3 (100) · 4 (150) · 5 (250) · 6 (400) · 7 (600) · 8 (800) · 9 (1,000), plus "Every name"
(the 2,700 library). Stage N shows the first N names of the ordered core list (data/core-names.json `rank` until the stage
ordering exists), so you can preview what any stage holds. The other views (Learned, Learning, New, traditions, search)
sit beside it.

## 15. Image analysis (approved in principle 2026-10-08)
Upload any image (your painting, a photo, a film still) and get a deep read of its color. The same screen also appears as an
"Analysis" section on every museum painting page. Layout follows the feature hierarchy: one summary card on top (3-4 headline
facts), every deeper layer opt-in below.
**Who it's closest to** (color only, and it says so; it can't judge brushwork or style): the nearest paintings in our archive
(~14k, ~23k after the Commons batch), plus the nearest artist, decade, country and movement, each found by comparing palette
features against an average for that artist, decade, country or movement, precomputed offline (gallery.py). Example: "Your
colors sit closest to Dutch painting, 1650s; nearest painter: Vermeer; nearest painting: ...". Show a confidence; when
nothing is close, say so.
**Stats** (pixels only, no data needed):
- value structure (darks/mids/lights %, 2- and 3-value notan, high/low/mid key)
- contrast range
- chroma (how much is muted)
- warm/cool balance
- hue spread with harmony detection (analogous, complementary, triad...)
- dominant/secondary/accent proportions (the 60-30-10 check)
- number of distinct colors
- where the focal pull is (peak contrast + chroma)
- percentiles against the archive ("more muted than 87% of the paintings here")
**Palettes** (one image, several readings):
- by area (proportional strip)
- accents (small, saturated, salient)
- lights vs shadows
- value-ordered
- hue wheel plot with a gamut-mask outline
- the dynamic 3-20 slider (§13)
- precise names on every swatch (tappable)
- "which limited palette fits" (Zorn, primaries, earth palette...)
**Views:** value only (squint), posterize to N, chroma map, temperature map, hue only.
**Fun facts:**
- your most-used color name and its story
- how rare this combination is in the archive
- pigment dating: "this violet wasn't on painters' palettes before the 1850s" (screen colors only approximate pigments,
  so hedge; reuses PIGMENT_SINCE)
**Build:** stats + views + palettes (M, Sonnet, client only); archive matching (M, Sonnet: feature vectors + centroids in
gallery.py, after the Commons batch); fun facts last (S). Not doing: style/brushwork matching (needs an ML model; out of
scope for now).

## 16. Palette engine, mosaic picker, cross-matching (approved in principle 2026-10-08; extends §15)
**Mosaic picker.** Any image (yours or any painting in the app) becomes a grid of averaged tiles with a slider from about 6
to 400 tiles. Average in linear light or OKLab, not raw sRGB (sRGB averages go muddy). Drag a finger across tiles to collect
colors into a palette tray (near-twins merge, every swatch named and tappable), or let it build the palette for you.
The mosaic can also be exported as an image.
**Palette engine.** One image gives a carousel of palette cards. Each card has a name, a one-line reason, and a shared size
control (3 / 5 / 10 / 20 / custom). Different rules for different sizes: 3 = dominant, secondary, accent; 5 = a theme;
10 = with a value ramp; 20+ = the full range, neutrals included.
Strategies:
- Extraction: by area (k-means / median cut); maximum spread (farthest-point in OKLab); accent-weighted (salient, small,
  saturated); one per hue family; lights vs shadows (painters' light family and shadow family); a value or gradient ramp
  (for UI scales); neutrals + one accent (60-30-10).
- Harmony math: fit the image's hues to Matsuda's harmonic hue templates (as used in Cohen-Or et al. 2006, "Color
  Harmonization"), then suggest the analogous, complementary, split, triad or square version. Golden-angle hue spacing for
  many distinct colors. Even OKLCH lightness steps.
- Learned beauty: O'Donovan, Agarwala & Hertzmann 2011 (a model of which 5-color themes people rate well, trained on large
  palette sites); Lin & Hanrahan 2013 (how people pull themes from images); Ou & Luo's two-color harmony model. Use these to
  rank cards, not to forbid anything.
- Traditions: Itten's seven contrasts (hue, light-dark, cold-warm, complementary, simultaneous, saturation, extension/
  proportion); Albers' interaction; Wada Sanzō's "Dictionary of Color Combinations" (1933-34; the original is public
  domain in Japan, a modern reprint isn't; an open dataset of its combinations exists, so check its license) as a
  reference set of good combinations.
- Painter recipes, measured from each painter's own paintings in our archive (their value key, chroma, hue spread and
  proportions), not invented: "Morandi" (muted, close values), "Monet" (high key, complementary shadows), "Warhol" (flat,
  high chroma, complementary pops), "Rothko" (2-3 neighbors, close values), "Vermeer" (yellow-blue among neutrals),
  "Hiroshige" (blue gradients), "Zorn" (limited palette). Present as "in the spirit of", never as the painter's real palette.
- Verify each paper before citing it in the app; research pass first: research/PALETTE-STRATEGIES.md (S, Sonnet).
**Harmony as music theory** (David's framing; it also gives the engine its vocabulary and a Train track):
- Interval: the step between two colors on 3 axes (hue angle, lightness step, chroma step). Name the intervals: "neighbor"
  (≈30°), "third" (≈90°), "complement" (180°), plus value steps.
- Chord: a palette built from intervals. Root: the dominant color. Triad, split, analogous run, square.
- Key: high key or low key, warm or cool. Voicing: where each color sits in value and chroma, and how much area it gets
  (Itten's proportion contrast, like how loud each note is).
- Tension and resolution: complements and saturation pops vs close neighbors and greys. A gradient works like a scale or
  progression.
- Train track, modeled on ear training: "name the interval" between two swatches, "build the chord" (complete a palette by
  a rule), "spot the wrong note" (one color breaks the harmony).
- Honesty: it's a teaching analogy, not physics. Light frequencies have no musical ratios, and Newton picked seven rainbow
  colors to match the scale (myth list). Never claim colors "are" notes.
**Cross-matching.** Compare any image's palette with flowers (Botany), gems, fashion decades and colors of the year, the
Looks archive and named films. Say "shares colors with peony, lilac and iris" or "close to a 1970s fashion palette", never
"influenced by" (color matching can't show influence). Precompute for every painting in the archive and show it on painting
pages ("Shares colors with: ...").
**Build:** palette-strategy research (S) → mosaic picker (S-M) → palette engine + cards (M-L) → cross-matching (S-M, after the
§15 feature vectors). Sonnet throughout.

## 17. Next build queue after the families job (David, 2026-10-08)
1. **Names cleanup (S-M, Sonnet):**
   - Every primary name in data/core-names.json is plain English a normal person can read: no parentheses ("Blue (Munsell)",
     "Silver (Crayola)"), and no technical Ridgway coinages as primaries ("Vinaceous-Brown", "rose doree").
   - Japanese names never appear as primary names. The color takes its English translation ("Ebizome (vine grape)" becomes
     "Vine grape"); the Japanese name, kanji and meaning stay as a cultural note on its page. A "Japanese traditional colors"
     collection lives in Explore/World.
   - Closeness wording is honest everywhere: when the nearest word is far, say "no close word; nearest is X", never
     "closest to X". Studio rows drop "lesson word" and use nameOf plus the family.
   - Rerun tools/name_coverage.py and report.
2. **The exploration trail (S-M, Sonnet):**
   - Uploaded photos are saved per user (IndexedDB on this device for now; synced once accounts exist): the downscaled image,
     its palettes, and the date. They appear in a "Your photos" shelf in Studio and get an address (#/photo/<id>).
   - Back works like Pinterest: every screen you open pushes one step and Back pops exactly one step, restoring that screen
     and its scroll position (photo, sheet, color page, painting). No "back" button jumps home. Screens opened from the
     honeycomb return to it.
3. **The palette engine (§16, M-L):** many palette strategies on photos and paintings (by area, accents, lights vs shadows,
   harmony fits, painter recipes, mosaic picker). Then the painting page upgrade (§13) and image analysis (§15).
4. **The design rebuild** from DESIGN-SYSTEM.md once David approves the second mockup pass.

## 18. Mix lab (David, 2026-10-08; inspired by "what do these two make" paint-mixing videos)
Pick two colors and watch them mix at 0 / 25 / 50 / 75 / 100% (or any ratio, with a slider), each step named (nameOf) and
tappable. It's beautiful to watch and teaches why "mixing" means different things.
- **Four ways to mix, same two colors side by side:**
  - **Light** (additive, like screens and stage lights: red + green light makes yellow)
  - **Digital average** (a straight blend in sRGB, as most apps do, vs a blend in OKLab, which looks even; show the
    difference)
  - **Print** (subtractive inks: multiply / CMYK overprint)
  - **Paint** (Kubelka-Munk pigment mixing, so blue + yellow really makes green and white tints go chalky)
  - Candidate library: spectral.js (open-source KM mixing in JS; check the license). Say plainly that paint results
    approximate real tubes.
- **The game (Train):**
  - predict the 50/50 mix (multiple choice among same-family neighbors)
  - name the mix
  - set the slider to hit a target
  - "which two made this?"
  - Each is played per mode, with a staircase on the gym engine.
- **Content tie-ins:**
  - myth-list corrections (pointillist dots average toward grey; red/yellow/blue are a convention)
  - famous mixes (Zorn palette mixes, the painter's earth greens)
- Size: M (Sonnet), after the palette engine.

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
