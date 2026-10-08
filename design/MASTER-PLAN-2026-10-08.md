# ColorHub master plan: the one-day build (2026-10-08, until the 05:00 reset)

The conductor's score. Every agent reads its lane section, plus the Soul and the Rules. The conductor (this session) owns merges, versions and this file. The progress log at the bottom is the source of truth.

---

## 1. The soul (everything follows from this)

**ColorHub teaches people to see.** The world is made of color, and almost nobody has the words or the eyes for it. ColorHub gives you both. It is an archive, a museum and a gym for color, all in one.

Five convictions:
1. **A name is a lens.** Each new color word lets you notice something you walked past yesterday. Learning names is learning to see.
2. **Every color has a biography.** Where the word came from, who made it and from what, who painted with it, what it cost, what it meant, and where you'll meet it today. Some are 2,000-year epics (Tyrian purple), some are one-line facts (a Crayola name from 1990). Each gets its true depth, and none is padded.
3. **Everything is a color dataset.** Every painting, painter, decade, flower, gem, film, poem and photo is read for color. We never show one palette; we show every honest reading.
4. **Everything is connected.** A color links to the paintings that use it, the painters who loved it, the pigment it came from, the words that named it, its look-alikes and its opposites. Those link back. The links are the product, and the fun is following them.
5. **Honest wonder.** Real facts, sourced. Myths only to correct them. Progress you can trust. Delight comes from what's true, not from hype.

**The one-sentence test for any feature:** does it make someone see more color in the real world, or understand how colors relate? If not, cut it.

---

## 2. The architecture that makes everything work together

The 10× move is to stop building separate cool things and build **one Color Graph and one Learner Model** that every screen reads and writes.

### The Color Graph (data, built offline, lazy-loaded)
- **Node types:** color (the ~3,700 named colors, plus any hex), word/etymology, pigment/dye/material, painting (23,531), painter (837+), movement, decade/era, place, poem/passage, flower, gem, film, fashion look, institution or brand, person (namesakes), source (dictionary, standard, book).
- **Edge types:**
  - *look-alike* (distance, with the direction words);
  - *same pigment, different name* (Konjō-iro = Prussian blue = Berlin blue);
  - *named after* (mauve ← mallow flower; Skobeloff ← General Skobelev);
  - *derived from* (Light X ← X);
  - *appears in*, with share and role (in a painting: shadow, highlight or accent);
  - *favored by* (with lift vs peers);
  - *paired with* (co-occurrence lift);
  - *complement / analogous* (with which wheel);
  - *same mineral*;
  - *first recorded* (date and source);
  - *standardized by* (ISCC-NBS, CSS/X11, Crayola, NCS, Pantone ≈).
- **Every page is a view of the graph.** Articles, lessons, games, Explore, Cabinet and search all draw on the same edges, so improving the graph improves everything at once.

### The Learner Model (localStorage now, accounts later)
- What you know (delayed recall), what you confuse (pairs), your eye thresholds per family and per judgment, your interests (strands), what you've seen (articles, paintings) and your Cabinet.
- Every surface uses it:
  - articles point out "you mix this up with X";
  - lessons pull world steps from the articles you've read;
  - Explore's For you is built from your weak spots and interests;
  - games target your confusions;
  - the Cabinet fills from everything you meet.

**This is the cleverness:** one place where your eye, your vocabulary and the world's colors meet.

---

## 3. The article engine (David's top priority): every color, at its true depth

David's tiers, expanded. Each color is classified by the origin of its name, and that sets its article's shape:

| Tier | Examples | Shape | Target length |
|---|---|---|---|
| Pigment / mineral / dye | Cobalt, Cerulean, Lapis, Prussian, Alizarin, Indigo, Madder, Cochineal, Verdigris | Epic: chemistry, discovery, trade, price, the painters, conservation, fading, modern equivalents | 1,500–3,000 words |
| Japanese and other traditional systems | Konjō-iro, Ruri-iro, Hanada, Kon, Shinbashi-iro; also Chinese, French and Russian traditions where sources exist | Dye history, poetry, period, sibling links across languages | 600–1,500 |
| Nature-named | Mauve, Lilac, Salmon, Robin's egg, Moss, Amber (Werner 1821: animal, plant, mineral) | What it was named after, when, why the name stuck, the real thing vs the color | 400–1,200 |
| Places and institutions | Yale, Oxford, UN Blue, Delft, Paris, Air Superiority Blue | The institution, why it chose this shade, where you see it | 300–900 |
| People | Skobeloff, Leitch's Blue, Isabelline (myth-corrected), Perkin's mauve | Biography plus how the name attached | 300–900 |
| Standards and systems | CSS/X11 (Dark Slate Grey), NCS, Process Cyan, ISCC-NBS block names | Technical lineage, where you meet it daily, why it looks odd | 200–600 |
| Commercial | Crayola (B'dazzled Blue), paint brands, marketing names | Brand, date, campaign idea, and honest "origin undocumented" where true | 150–400 |
| Descriptive / modifier | Light X, Pale X, Dusty X | No article of its own: a section on its parent, plus its computed field notes | (Field notes only) |

### Field notes: research nobody else has (computed for EVERY color, from our own data)
1. **In the archive:**
   - the paintings where this exact color covers the most canvas;
   - its first appearance in our archive;
   - its rise and fall by century and decade;
   - the role it plays (shadow, mid-tone, highlight, accent), from its lightness rank inside each painting;
   - the painter most devoted to it (with lift);
   - the countries and movements where it peaks.
2. **Its company:** the colors it shares canvases with more than chance would predict (pairs and chords); the colors it's never seen with.
3. **The word over time:** Google Books Ngram frequency curves (research/_raw/ngrams), plus first-recorded dates (Maerz & Paul 1930 dictionary, ISCC-NBS, Paterson). For example, when "mauve" exploded after 1859.
4. **In words:** poem lines and prose passages that use the word, with their authors and dates.
5. **Twins in the world:** the flowers, gems, minerals, fashion decades and film moments closest to it.
6. **Family tree:** parents (what it was named after or derived from), siblings (the same pigment or mineral under other names and languages), children (the modifiers), look-alikes (with direction words), disambiguation ("Sapphire" vs "Sapphire Blue" vs "Sapphire (Crayola)").
7. **The color measured:**
   - all codes (Hex, RGB, HSL, CMYK, Lab, LCh, OKLCH, nearest Munsell and ISCC-NBS block);
   - lightness and chroma percentiles among named colors;
   - text contrast on white and on black (AA/AAA);
   - three color-blind simulations;
   - complement and analogous colors (per wheel);
   - a mixing recipe;
   - near-duplicates in other naming systems.
8. **Sources:** every source list the name appears in, with its date. "Origin undocumented" is said plainly when true.

### Book research: everything from the 29 books, per color (David: "take a lot more from all the books")
- **Concordance** (building now): every mention of every color name, alias and sibling across all 29 full texts, as context windows with page numbers. Kept private in color-kb and never put in the repo.
- **Fact cards** (per color, private): researcher agents read a color's concordance and turn it into atomic facts. Each card holds the claim, the book and page, a confidence, a theme (etymology, chemistry, trade, art, culture, science, myth) and any conflicts with other books. Cards are checked against CONFLICTS.md and the myth list.
- **Articles** (in the repo, data/articles/<slug>.json): original prose written only from fact cards and computed field notes. Numbered source notes. Quotes are rare and under 15 words. A "books disagree" line wherever they do.
- **Pipeline per batch of about 12 colors:**
  1. Researcher, Opus: concordance → fact cards.
  2. Writer, Opus: cards + field notes → article in the tier's shape.
  3. Adversarial fact-checker, Sonnet: every sentence traces to a card; myth list; hedges.
  4. Gate script: length per tier, plain English, quote limits, links resolve.
  5. The conductor samples one article per batch.
- **Order:**
  1. A pilot of one per tier (8 articles); David approves the voice.
  2. The concordance's richest ~150 (the epics).
  3. The rest of the 1,000 core names, in stage order.
  4. The library.
  5. Hub pages: "Japanese traditional blues", "Colors named after people", "Crayola colors", "University colors", "Pigments that changed painting", "Lost colors", "Colors that killed" (myth-checked), and others.
  6. Disambiguation pages.

### On the page
The full-screen color, then a one-line definition with its source, then the **Read** side (the article with a table of contents and numbered notes) and the **Do** side (field notes, games for this color and its look-alikes, palettes, mix it, find it with the camera, practice its deck), then the family tree, hubs and sources. A calm summary first, every layer one tap deeper.

---

## 4. Lanes (parallel workstreams, each with file ownership so merges don't collide)

| # | Lane | Owns | Model | Wave |
|---|---|---|---|---|
| L0 | Conductor: merges, versions, smoke, log | index.html `?v=`, this file | (this session) | all day |
| L1 | Ledger of every request | design/REQUESTS-LEDGER.md | Sonnet | 0 ✅ running |
| L2 | Book concordance → fact cards | ../color-kb/concordance, facts/ | Sonnet, then Opus | 0 ✅ running → 1 |
| L3 | Smoke harness + undefined-name scan | tools/smoke*, tools/undef_scan.js | Sonnet | 0 ✅ running |
| L4 | Practice (finish) | js/practice.js, css/practice.css | Opus | 0 ✅ resuming |
| L5 | Rich computed color pages (finish) | js/names.js, colorPage sections, data/analysis/color-*.json | Sonnet | 0 ✅ resuming |
| L6 | Color Graph builder | tools/graph_build.py → data/graph/*.json (edges above), etymology and source dates, Ngram curves | Sonnet | 1 |
| L7 | Article engine (research → write → check) | data/articles/*.json, tools/article_gate.py, hubs | Opus writers, Sonnet checkers | 1 pilot → 2 scale |
| L8 | Article UI: Read/Do, family tree, hubs, disambiguation, notes | css/article.css, js/article.js | Sonnet (Opus design pass) | 1 |
| L9 | Learning beyond the 101 + the Journey | js/journey.js, css/journey.css; card ids for all names | Opus | 1 (after L4) |
| L10 | Train: Odd one out deepened + game grammar (§20) + progression (§4) | js/games/*.js, gym-engine twists | Sonnet, Opus design | 1 |
| L11 | Painter, painting, movement pages (§21 analysis UI) + art wiki (Wikidata) | js/artwiki.js, css/artwiki.css, data/artists/* | Sonnet | 1 |
| L12 | Design lead: polish every screen to "iconic" (rooms header, corner overlap, motion, type, empty states) | app.css tokens, per-screen CSS | Opus | 1–3 |
| L13 | Studio: palette engine (music framing), mosaic picker, image analysis, cross-matching | js/palette-engine.js, js/mosaic.js | Sonnet | 2 |
| L14 | Mix lab (own mixing model, no Mixbox) | js/mixlab.js | Sonnet | 2 |
| L15 | Data quality: core names (Seafoam, typos, compounds), Maerz & Paul filter + merge, "brighter" wording, more museums (Sargent watercolors) | tools/*, data/*.json | Sonnet | 1 |
| L16 | Explore 2.0: For you from the Learner Model, mood search, hubs in Explore, Cabinet, **aesthetics as palettes** (cottagecore, dark academia, vaporwave…, from David's Aesthetics Wiki ask: names and ideas only, palettes built from our own color data) | js/explore.js sections | Sonnet | 2 |
| L17 | Crawlable pages for all names and articles (SEO) | tools/pages.py output | Sonnet | 3 |
| L18 | Honeycomb polish (Globe Fibonacci, lens, styles) | js/honey.js | Sonnet | 2 |

**Concurrency:** up to about 8–10 agents at once. Each runs in its own worktree, creates new files where it can, and touches shared files (router.js, index.html, core.js) only through tiny additive edits.

---

## 5. Rules for every agent (pasted into every brief)
1. Read CLAUDE.md (The philosophy + product rules + myths), this file's Soul and §2, then your lane.
2. Quality bar: archive grade. Real, sourced depth. No cute filler. Honest caveats. Myths only to correct them.
3. **One tap on any color opens its page. Never show "the 101". Never one palette.**
4. Merge main into your worktree before you start and again before you finish. Keep both sides of any conflict.
5. Before finishing, run: node tools/check.js, check_wiki.js, check_names.js, the feature tests, and **tools/smoke.sh** (once it exists).
6. Screenshot every changed screen at 375×812 using an iframe wrapper (headless Chrome won't go below ~500 px). Look at every shot.
7. Commit with explicit paths. Never `git add -A`, never research/_raw, never book text. Don't push. Don't bump `?v=`; the conductor does that at merge.
8. Report in at most 20 lines: what shipped, what's left, screenshot paths.
9. **The genius check (David, standing rule):** before building, ask "how can this be more clever, more genius, and work with every other part of the app?" and build at least two real connections to other systems (the Color Graph, the Learner Model, articles, Journey, Train, Explore, Studio, painters, the Cabinet). Put the connections in your report.

## 6. Conductor protocol
- **Merge cadence:** merge each finished lane right away, in arrival order. Then: resolve index.html as ours plus the new tags, bump `?v=`, run gates and smoke, push. Then tell David what's live.
- **Self-correction:** every ~2 hours, re-rank the lanes against the ledger's top open items and David's latest messages. Kill or re-scope a lane that's stuck.
- **Context:** the conductor never reads agent transcripts, only their reports. If the conductor's context fills, a fresh session resumes from this file's log plus NOTES-TRACKER.
- **David's role:** react to pilots (article voice, design frames, game feel). Everything else is decided by recommendation (memory: follow my recs).

## 7. Schedule (start ≈ 12:00; hard stop 05:00)
- **Wave 0 (now → ~13:30):** L1–L5 running. Write the Soul into CLAUDE.md once David approves.
- **Wave 1 (~13:00 → ~19:00):**
  - L6 graph, L7 article pilot (8 articles for David's review), L8 article UI, L9 Journey, L10 Train games, L11 art wiki, L12 design lead, L15 data quality.
  - About 9 agents in flight.
- **Wave 2 (~19:00 → ~01:00):**
  - L7 at scale (batches stream in), L13 Studio, L14 Mix lab, L16 Explore 2.0, L18 honeycomb.
  - L12 continues screen by screen.
- **Wave 3 (~01:00 → 04:30):**
  - L17 SEO pages; a full smoke and screenshot review of every screen; fix pass; final push.
  - Update HANDOFF.md and NOTES-TRACKER.md.

## 8. Decisions David can make now (or say "go with your recs")
1. **Journey (from design/JOURNEY.md):** stages count only the ~614 real words (compounds taught as variations); about 25 words per chapter; Cabinet unlocks on *meeting* a color; interests default to all on except Science; films in lessons as text and swatches.
2. **Models today:** Opus for writing, research and design (quality), Sonnet for building and checking.
3. **Article voice:** encyclopedic and grounded (the Read side), with field notes as the playful, data-rich side.

---

## Launch queue (start as slots free; 20 subagents can run at once)
0. R1 competitor teardown (design/lanes/R1-competitors.md): first free slot.
0c. L18 Honeycomb 10× build (design/IDEAS-10X/home-map.md specs H1 family names when zoomed out, **an optional toggle in Look, off by default** (David: he likes seeing all the tiny colors too); **zoomed-out tap rule (David): when bubbles are tiny, a tap zooms in to that bubble and centers it, and the next tap opens its page; the normal-zoom rules (glide to center, center ring opens) stay**; H3 stage glide, H4 on the map for any painting, H5 learning spiral, B1 Placement 2.0, B2 live stem + real floor, B3 pull-down search 2.0). Start after L23 and L24 merge, since they share honey.js.
0d. L27 image lens + deep analysis for any image (design/lanes/L27-image-lens.md). Start after L13 merges.
0b. L16 Explore 2.0 browsing (design/lanes/L16-explore-browse.md): the color dial, facet chips with counts, views (grid with a jump bar, Decade River, by painter, wall), smart collections. Second free slot; pairs with L26.
1. L22 Maerz & Paul round 2: the dictionary index (~4,000 names, plate/cell, origin and date), per-plate color correction, a clean merge.
2. L9 learning beyond the 101 + the Journey, after Practice (L4) merges.
3. Ideas synthesis, after the 7 IDEAS-10X panels report.
4. L7 article engine at scale, after David approves the pilot voice.
6. L26 color in paintings (design/lanes/L26-color-in-paintings.md): tolerance and coverage sliders, a finer per-painting color index, the arriving color pinned, a where-it-lives mask.
5. L23 taste and favorites (design/lanes/L23-taste.md): honeycomb multi-select, a favorites shelf, rankings that aren't tournaments, a taste profile.

## Progress log
- 14:4x: David approved the article voice ("keep it as is: grounded, encyclopedic, sourced") and likes the name **The Color Library** (trademark and domain checks not done). The article workflow is launched: 190 batches (110 epic, 45 medium, 35 short; 944 colors), Opus writers plus Sonnet adversarial checkers. Articles land uncommitted in data/articles/, and the conductor commits and ships them periodically.
- 13:xx: David chose "go with your recs" on the 5 Journey decisions (recorded at the top of design/JOURNEY.md). L9 is unblocked once Practice merges.
- 12:4x: L1 ledger landed (design/REQUESTS-LEDGER.md: 111 done, 43 partial, 45 not started). ECC patterns adopted as files (no plugin). L19 design-history corpus started. L6 also computes per-color superlatives (rarest, peak decade, loyal painters).
- 12:0x: Wave 0 launched: L1 ledger, L2 concordance, L3 smoke harness, L4 Practice resume, L5 rich pages resume.
- 12:1x: Wave 1 started early (no dependencies): L6 graph, L15 data quality, L10 Train games, L11 art wiki, L12 design lead. The genius panel is reviewing this plan (design/GENIUS-PANEL-1.md). An ECC study agent is writing design/ECC-ADAPT.md (patterns only; no plugin installed mid-sprint).
