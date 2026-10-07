# David's notes: open items (2026-10-08)

Every note from David that isn't applied yet, where it's queued, and how big it is. Update the status as items ship.
Details live in ROADMAP.md (§ numbers).

## Building now
| Note | Where | Status |
|---|---|---|
| Honeycomb: no black gaps, outer bubbles bigger with names, zoom-out that stays, circle-to-hexagon shape, style presets, a Tweak panel with sliders and "Copy settings" | style lab agent | building |
| Plain-English names only; Japanese names become English with a cultural note; honest "close / not close" wording; Studio drops "lesson word" | names cleanup | DONE 2026-10-08 |

## Next (in order)
| # | Note | Where | Size |
|---|---|---|---|
| 0 | Honeycomb up to ~9,000 (David, 2026-10-08: "Let's do 9k"; explorer's map only, lessons stay on the 1,000): the 1,000 core names + the ~2,700 library names + described colors built from the modifier grammar ("Pale salmon", "Deep teal", "Greyish lilac"), generated only where they fill real gaps (≥ ΔE 3 from every name), each one guaranteed to read back the same through nameOf(). Described names are labeled as descriptions, not established names. New scrubber stops after Stage 9: "Every name" (~2,700) and "Every shade" (~9,000). A gate fails if any shade doesn't read back its own name through nameOf(); block odd combos ("reddish teal"). Every name findable in search, alternate names open their color's page. Runs right after the names cleanup and the style lab (both touch the same files) | tools + data + home.js | M |
| 1 | Uploaded photos saved per user ("Your photos" in Studio, each with an address) | §17.2 | S-M |
| 2 | Pinterest-style Back: one step at a time, back to the photo/sheet/page you came from, same scroll | §17.2 | S-M |
| 3 | Find your palette: pairs show the same number of colors; say "Same colors · which balance?" when only proportions change | taste.js | S |
| 4 | Clever palettes from any image: many strategies (area, accents, lights vs shadows, harmony fits, painter recipes), the mosaic picker (6-400 tiles, finger-swipe to collect) | §16 | M-L |
| 5 | Painting page: highlight the color you came from, 3-20 palette slider, tap the painting to name a spot | §13 | M |
| 6 | Image analysis for uploads and every painting: closest painter / era / country / painting by color, stats, views, fun facts; "shares colors with" flowers, gems, fashion eras | §15, §16 | M + S-M |
| 7 | Color harmony taught like music (intervals, chords, keys) + a Train track (name the interval, build the chord, spot the wrong note) | §16 | M |
| 8 | Mix lab: two colors at every ratio in light / digital / print / paint, with prediction games | §18 | M |
| 9 | Design rebuild to DESIGN-SYSTEM.md, in testable batches: rooms + navigation (Today folds into Learn), Learn it on the flashcards (fixes the cut-off and ugly steps), color page, Explore covers, Train stations, the bubble-to-page motion | DESIGN-SYSTEM.md | L, batched |
| 10 | Stages as the learning path (25 / 50 / 101 / 150 / 250 / 400 / 600 / 800 / 1,000) with fields (painter, designer, colorist...) and end-of-stage tests | §14 | M + M |
| 11 | More painting stories: real fact-checked stories in batches (next 30 famous paintings) + a short data-based note for every painting | content | M per batch + S |
| 12 | Train results screen after every session: % right, count, your threshold in plain words ("you can tell apart colors about 1.5 ΔE apart, close to the limit of human vision"), every miss shown side by side with what you picked, "replay my misses", and your trend vs your own past sessions | gym.js / gym-engine.js | S-M |
| 13 | World percentile ("better than 82% of people"): needs a small anonymous scores service (Supabase; opt-in, no personal data). Until then, show your threshold against the standard reference values for human color discrimination, labeled as reference values, not other players | backend + gym | M |
| 14 | Train families from the brainstorm: odd-one-out family, rearrange family (2D gradients), memory additions, photo missions | ROADMAP build order | M each |

## Everything else approved (ROADMAP §1-11), grouped. Built after the queue above, in testable batches
**Train: odd one out family (§2)**
- odd pair, odd group (hidden shape), how many (0-4), twins, which direction
- boards: grid, ring, honeycomb, mosaic, strip; mixed tile sizes; busy colored grounds; gradient boards; painting tiles
- flash (1 s), growing board, speed tiers with a combo meter

**Train: rearrange family (§3)**
- 2D gradient board, hue ring (Farnsworth-style), two-sheet swap, repair 3 wrong tiles, mixing ladder, painting strip,
  spiral boards
- Wordle-style lock-in (3 tries), a heat map of how far each tile was off; snap and ripple feel

**Train: progression and flow (§4)**
- a hidden skill estimate per judgment and per color region
- an honest eye profile ("you see blues to 1.4")
- difficulty that breathes inside a set (~80% right)
- streak-sensitive difficulty; speed counts lightly
- worlds instead of numbers (Greys, Skin tones, Skies, Shadows), each with a final challenge and mastery stars
- a before/after with real color pairs
- a journey map per station
- daily three in Train
- replay misses (also #12 above)

**Train: memory (§5)**
- name ↔ color recall; remembering real objects' colors; Simon-style sequences; drift reveal after a miss

**Learning (§1, §6, §14)**
- the path: chapters and 3-5 minute lessons (meet, see, sort, story, make, mission); checkpoints; review lessons;
  "legendary" replays; testing out
- unit stories; real-object cards (a teal duck); photo missions ("spotted teal today?", auto-checked); a weekly recap
- the stages and fields as the path's chapters

**Explore and Studio (§7, §8)**
- color pages as hubs (done); today in color; mood search ("sea at dusk"); Paintings + Poems merged into Art
- Studio: palette critique (lightness spread, color-blind safety, contrast, "fix"); mockups (poster, phone, room, outfit);
  exports (Procreate, .ase, Figma, CSS)

**Beauty and clever (§9, §10, §11, DESIGN-SYSTEM.md)**
- motion pass and moments (lesson complete, new color owned, level up)
- the bubble-to-page signature motion
- optional sound; a haptic language
- the color mind profile; an adaptive coach ("you confuse teal and cerulean"); explain my miss

## Smaller fixes noted
- One painting title is truncated ("The Fif").
- Static crawlable pages for the 1,000 name pages (tools/pages.py) were skipped.
- Artist-name splits (van Dyck, Renoir, Teniers, Cranach): David started a separate session for this.

## Ideas only (not planned)
- Nail-polish style names: maybe a playful game or a fashion/beauty culture note; no brand catalogs.
- Multiplayer duels, seasonal skins: later.
- Russian edition: after the English app is finished.
