# David's notes: open items (2026-10-08)

Every note from David that isn't applied yet, where it's queued, and how big it is. Update the status as items ship.
Details live in ROADMAP.md (§ numbers).

## Building now
| Note | Where | Status |
|---|---|---|
| Honeycomb "alive": idle drift like the Watch, net physics when dragging, water ripple; the Globe layout (Runge's color sphere); only 5 curated styles shown (Original, Honeycomb, Sunflower, Globe, Magnifier); the center moves up above any open panel; separate Show and Look panels (Look compact, live); seamless wrapping only where colors truly continue | honeycomb agent | building |
| Import the 1955 ISCC-NBS dictionary (~7,500 public-domain names) into the library, as "also called" names or new colors only where none exist | import agent | building |

## Done 2026-10-08 (for reference)
names cleanup (plain English, Japanese as notes, honest closeness) · a page for every one of the 1,000 names + families ·
saved photos + Pinterest-style Back · equal-count taste pairs · honeycomb style lab, Tweak panel, cells with equal
seams, no overlap, real magnified honeycomb · crash fix for big sets · photo palettes that keep vivid colors ·
sheets close on swipe-down

## RESUME HERE (paused 2026-10-08, out of credits)
Two jobs were stopped mid-work. Their files are uncommitted in their worktrees, so nothing is lost:
- **Practice (~85%, screenshots mostly done):** `.claude/worktrees/agent-a647b2e173d35a651`. It has js/practice.js, css/practice.css, tools/practice_test.js, plus edits to index.html, js/learn.js and js/router.js. To finish:
  1. Run tools/practice_test.js and the gates.
  2. Screenshot at 375 px.
  3. Commit, then merge into main.
- **Rich pages for every color (~30%):** `.claude/worktrees/agent-a5d6b6e560ac09fa8`. Done so far: data/analysis/color-artists.json, color-pairs.json and tools/build_richdata.py. Still to do: the page sections in js/names.js and colorPage, per the brief in this session (≥8 sections for any color, no "101" links).
- **After both:** learning beyond the 101, then the Journey (waiting on David's 5 decisions in design/JOURNEY.md).

**Top (David, 2026-10-08: "I don't like that you're stuck on the 101 to learn"; "I want to be able to learn more colors"):** learning beyond the 101. Starts the moment the color page and Practice merge, since they share files:
- Learn it works on every one of the 1,000 names, with look-alikes drawn from the 1,000 within the family.
- Cards for those names get real ids (`core:<slug>`), and dueList() and review include them.
- The path continues past the 101 through the stages (150 / 250 / 400 / 600 / 800 / 1,000), in mixed lessons (ROADMAP §1).

| # | Note | Where | Size |
|---|---|---|---|
| 0 | Honeycomb up to ~9,000 (David, 2026-10-08: "Let's do 9k"; explorer's map only, lessons stay on the 1,000): the 1,000 core names + the ~2,700 library names + described colors built from the modifier grammar ("Pale salmon", "Deep teal", "Greyish lilac"), generated only where they fill real gaps (≥ ΔE 3 from every name), each one guaranteed to read back the same through nameOf(). Described names are labeled as descriptions, not established names. New scrubber stops after Stage 9: "Every name" (~2,700) and "Every shade" (~9,000). A gate fails if any shade doesn't read back its own name through nameOf(); block odd combos ("reddish teal"). Every name findable in search, alternate names open their color's page. Runs right after the names cleanup and the style lab (both touch the same files) | tools + data + home.js | M |
| 1 | Add the historical pigment names missing from the library (from the Pigment Compendium notes; colors from public sources) | library | S |
| 2 | Color info pass for every name: computed facts (painters/eras that use it, matches, harmony partners, text contrast, color-blind view, a mixing recipe), Wikidata (CC0) facts, word origins (Paterson notes, 1930 dictionary), then real-history stories for 200-400 colors in batches | names.js + data | M + M |
| 3 | Digitize Maerz & Paul 1930 (~4,000 public-domain names with their own measured colors) | tools | M-L |
| 4 | Clever palettes from any image: many strategies (area, accents, lights vs shadows, harmony fits, painter recipes), the mosaic picker (6-400 tiles, finger-swipe to collect) | §16 | M-L |
| 5 | Painting page: highlight the color you came from, 3-20 palette slider, tap the painting to name a spot | §13 | M |
| 6 | Image analysis for uploads and every painting: closest painter / era / country / painting by color, stats, views, fun facts; "shares colors with" flowers, gems, fashion eras | §15, §16 | M + S-M |
| 7 | (Folded into #4, the palette engine.) David's music metaphor is a way to THINK about the palette engine, not a separate feature: intervals, chords, keys, voicing and tension/resolution become one of the engine's strategies and its vocabulary for explaining a palette ("a warm triad in a low key, with one bright accent"). A Train track built on it is optional, later | §16 | in #4 |
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
- **Core-names quality pass:**
  - "Seafoam Green" is #E9E0B7, a pale cream (its alternate names include Lemon Meringue), so the name and the color disagree.
  - Typos: "Liliac", "Terracota".
  - About 386 compound names (Light X, Dark X, repeats).
  - The draft teaching order goes alphabetical after word ~140.
- **Maerz & Paul:** 825 chips are extracted, but OCR merged some neighboring cells into fake names ("Maracail Domingc"). Add a filter that catches text bleeding in from a neighboring cell, or do a manual pass, then run merge_maerz_paul() (a trial merge added 212 new colors).
- **The analysis engine is too dark for Sargent.** His 37 archive paintings are mostly dark portraits (no watercolors), so his signature reads "Ink". Add more sources, e.g. watercolors from the Brooklyn Museum and the Met.
- Globe style (lab only for now): colors bunch up on the sphere and leave bare patches. Fix: place points evenly (a Fibonacci sphere) and assign colors to them by hue → longitude, lightness → latitude, then bring it back to the home styles.
- Gamut wheel and saved-palette screens don't join the one-step Back yet; photos can't be renamed yet.
- Rerun "Every shade" after the dictionary import (the tool is ready; the stop appears when data exists).
- Paused earlier, unmerged: the Looks archive (fashion looks as palettes) and ~270 extra wiki images.
- Untested on a real iPhone: Say it keyboard cards, voice, camera white balance.
- One painting title is truncated ("The Fif").
- Static crawlable pages for the 1,000 name pages (tools/pages.py) were skipped.
- Artist-name splits (van Dyck, Renoir, Teniers, Cranach): David started a separate session for this.

## Later (approved, not scheduled)
- Multilingual names (the 1905 six-language atlas) and the Russian edition, after the English app is finished.
- Business: Plus subscription, a free atlas website; Colordle (a daily color word game).
- Shop in this color (David's sister's idea, 2026-10-08), one quiet "Get it in this color" row on color, palette and painting pages, with an affiliate disclosure. Order: (1) print-on-demand posters and cards of palettes, painting palettes and "your color" via Printful or Gelato; (2) art-supply affiliate links for real pigments and paints (Jackson's, Blick), paired with the Mix lab; (3) fashion and home affiliates (ShopStyle/LTK, Etsy via Awin) by matching product colors. Never sell trademarked colors (Tiffany blue, Pantone names). Say screen colors are approximate. Worth building once the crawlable pages bring traffic.
- Accounts (sync photos/progress across devices) + the anonymous scores service for world percentiles.
- Reaching out to Peter Donahue (Color Nerd) once the paint features ship (Claude drafts, David sends).

- **Film color archive (David, 2026-10-08; build when credits allow).** Directors get the same treatment as painters, e.g. Kubrick:
  - a palette for each film (one for the whole film, or 10 across its running time, in order);
  - his films compared with each other;
  - his color evolving from his first color film to his last;
  - signature colors and favorite combinations.

  **Copyright:** frames from films under copyright are not ours to host or re-publish, and screenshot sites (IMDb, film-stills and Blu-ray screenshot galleries) have terms against scraping. So we store only computed color data (palettes and stats, which are facts), never the frames, and link out to where the stills live.

  **Sources:** public-domain films (before 1930, plus some later ones whose copyright lapsed) can show frames. For others, frames we sample ourselves from a copy David owns, kept private and used only for analysis.

  Reuses the §21 analysis engine. Today data/films.js holds 32 films with written text and "colors discussed", no frame palettes.
- **The film strip (David, 2026-10-08):**
  - Every shot in order becomes a progression through the running time, the "movie barcode" idea. It is modular: show 1 color per shot (the most-used one), or a palette of 3, 5 or 10 per shot.
  - Zoom from the whole film down to one scene.
  - Also: acts and turning points visible as color shifts, the film's overall palette, and films compared side by side.
  - A shot-gallery page (e.g. Barry Lyndon on beautifulfilmframes.com, about 180 stills) is the kind of source, read for color only.

## Ideas only (not planned)
- Nail-polish style names: maybe a playful game or a fashion/beauty culture note; no brand catalogs.
- Multiplayer duels, seasonal skins: later.
- Russian edition: after the English app is finished.
