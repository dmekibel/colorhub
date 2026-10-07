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
