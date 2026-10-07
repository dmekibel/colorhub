# Color page plan: Read, Explore, Color Nerd, Art Wiki

Brainstorm + plan, 2026-10-08. No code. Numbers below are measured from the repo (see each section); nothing here claims a myth-list fact as true — see CLAUDE.md's myth list and `../color-kb/CONFLICTS.md` before any of this ships as prose.

**What's in the repo today (the baseline this plan builds on):**
- 101 color articles in `data/wiki-colors.js` (the 11 basics + 90 unit colors), averaging roughly 1,300 characters of source including markup — call it ~950-1,000 characters of running prose, matching ROADMAP §19's own count. Facet keys used today, by frequency: language (69), history (53), science (41), culture (39), art (23), design (20), symbolism (14), poetry (10), philosophy (4).
- 74 wiki nodes in `data/wiki-nodes.js`: pigment (21), person (18), concept (17), work (7), culture (6), tradition (3), movement (2, just "Impressionism" and the Bauhaus-adjacent one — thin).
- 0 stories currently populate `data/stories.js` (the file's schema is live, the shelf is empty — `data/stories.js` has only the header comment and one `two-blues` demo entry in the file's own words; treat Explore's story shelf as unbuilt, not "29 stories" — ROADMAP §19's "29 stories" count may be stale or counted elsewhere; worth a quick recheck before the writing batch starts).
- 1,000 names in `data/core-names.json`, 390 in `data/color-names.json`, 2,716 in `data/library.json` — three different name tiers already exist; "every other name, up to ~9,000" (ROADMAP §19) is future work, not yet ingested.
- 23,531 gallery paintings (`data/gallery/`, built 2026-10-07, 7 museum/Commons sources), with 837 distinct artists after the 50-per-artist cap (all 837 have n≥5; 439 have n≥10; 155 have n≥20). `byMovement` currently has only **8** movements with computed palette stats (Mughal, Impressionism, Pahari, Rajput, Kalighat, Post-Impressionism, Realism, Renaissance) — `mv` (movement) is `null` for every Commons row (research/COMMONS.md §4: "this is the one field this source does not populate"), so real movement coverage needs Wikidata P135, not the gallery alone.
- 22 hand-built `data/paintings.js` entries (the deep story paintings, each with a real k-means palette, a map image, and curator notes) vs. 23,531 gallery paintings with only a computed palette — two different depths already exist and the art wiki should reuse that split rather than invent a third.
- §6 of `research/COLORNERD-IDEAS.md` flagged 10 fixes against the channel. Grep shows the first three (complementary colors' three-map framing, the color-wheel "tradition" hedge, warm-and-cool calling green/violet "contested" not "cool") already read correctly in `data/wiki-nodes.js` today — likely fixed since the research pass, possibly on 2026-10-08 itself. Fix #5 (ambiguous "brighter") is **not** fixed: `tools/check.js:30` still accepts "brighter" for either a lightness or a chroma gap, and `data/colors.js` still uses "brighter" in at least 5 neighbor lines (Lavender, Violet, Rust, Cobalt, Mulberry). See §B below for the full checklist.

---

## A. The color page: two sides

Naming the two sides: **Read** and **Explore** are serviceable but Explore already names an entire room (Home → Explore, with its own "For you / Art / Ideas / World" covers per DESIGN-SYSTEM §2). Reusing it for a tab *inside* the color page invites "which Explore do you mean" confusion in writing and in analytics. Candidates for the in-page pair:

- **Read** / **Play with it** — concrete verb, says what the tab does.
- **Read** / **Try it** — shortest, but undersells the depth of some ideas (painting comparisons, timelines).
- **The page** / **The lab** — "lab" is overused (Studio already has "the harmony lab", ROADMAP §16/§17).
- **Recommendation: Read / Do.** One syllable each, parallel, no collision with room names. "Do" covers games, tools, and finds without overpromising depth. (Runner-up: **Read / Explore it**, which disambiguates from the Explore room by the trailing "it" but is weaker on a tab control at small width.)

The rest of this document uses **Read** and **Do**.

### A1. Read principles

1. **Grounded over buzzy.** No "You won't BELIEVE what this color used to be called." A Read article reads like a good museum wall label crossed with a dictionary entry: specific nouns, dates, named sources, no rhetorical questions as hooks. The existing Red/basic-color-terms prose in the repo is already close to the target voice — keep writing at that register, not looser.
2. **Numbered, sourced notes, visible uncertainty.** Every Read article carries a small numbered reference list (the `sources` array already exists on every `wiki-nodes.js` entry; `wiki-colors.js` entries don't yet carry per-fact citations — add them). Where books disagree (`../color-kb/CONFLICTS.md`), say so in the sentence, not in a buried footnote: "Accounts differ on who coined the name — usually credited to Verguin, per CLAUDE.md's hedge list" is itself the sentence, not a caveat added after.
3. **Long-text typography on a phone.** DESIGN-SYSTEM §4 already reserves Geist for "long reading text" and Instrument Serif for names/titles/labels only — Read should follow that split exactly: serif headline + facet titles, Geist body. Target measure: 60-75 characters per line at the phone's default type size (roughly 85-90% of a 375pt-wide screen's content column after the 20px gutter per §5). Paragraph length: 2-4 sentences; a facet that runs past ~600 characters gets a sub-break, not a wall.
4. Line-height: body text at 1.5, tighter heads at the existing `title-*` tokens' own line-heights (§4).
5. **Table of contents.** For any color past the "data-written" depth (i.e. Deep and Medium per ROADMAP §19), Read opens on a short contents strip: a horizontal row of facet chips (Etymology, Pigments, In painting, …) that jump-scroll, matching the "hub shelves with pictures" pattern the Color page archetype already uses (DESIGN-SYSTEM §12) rather than inventing a new component. Data-written colors skip the TOC (too short to need one) and go straight to sections.
6. **Reading time.** Compute from word count at ~200 wpm (silent reading of informational text skews slower than fiction; 200 is a defensible floor) and show it next to the TOC only when the article exceeds ~2 minutes — a 30-second data-written page showing "1 min read" is noise.

### A2. Facet catalog for Read

For each facet: what goes in it · source/data · which colors qualify · typical length.

| Facet | What goes in it | Source / data | Qualifies | Length |
|---|---|---|---|---|
| **Etymology & first use** | Where the name comes from, earliest attested use, false-etymology corrections | Maerz & Paul 1930 (dates), Paterson notes, OED-style fact-checking already underway (`research/FACTCHECK-ETYMOLOGY-2026-10-07.md`) | All named colors with a real origin story (not generated descriptive names like "Dusty rose 3") | 150-400 chars |
| **The color measured** | Munsell notation, ISCC-NBS category, nearest-neighbor deltas, how it differs from siblings (the existing `vs`/`d` fields in `data/colors.js`) | `data/colors.js`, `tools/check.js`'s own ΔE gates, ISCC-NBS 1955 | All 101 + any color with Munsell/ISCC-NBS data | 100-250 chars + a small data strip (no prose needed beyond the diff line) |
| **History** | When/where the color (as pigment, dye, or named convention) rose, who used it, price/rarity/trade | Field, Cennini, museum pigment-database facts via `../color-kb` (facts only, never copied text), Gage *Colour and Culture* | Legends and medium-tier names with a documented history | 300-900 chars |
| **Pigments & dyes** | Material, chemistry in plain terms, trade route, historical price, toxicity/fading notes | `../color-kb/atoms.jsonl`, pigment wiki-nodes (21 already exist) | Pigment-named colors (vermilion, ultramarine, Prussian blue…) | 300-700 chars |
| **In painting** | Real works from our own gallery, not generic "artists loved this color" | `data/paintings.js` (22 deep) + `data/gallery` (23,531 computed) — "painters and decades that use it most" per ROADMAP §19 | Any color with ≥1 gallery match above a confidence threshold | 1 hub shelf (thumbnails), no prose required for data-written tier; 1-2 sentences for Deep/Medium |
| **In literature** | A real poem line or passage that names the color | `data/poems.js`/`poems-index.json`, `research/PASSAGES-FILMS.md`, `research/POETRY.md` | Colors with a matched line | 1 quoted line (≤15 words per copyright rule) + attribution |
| **In fashion** | Named fashion-world uses (a decade's "it" color, a designer house color) | `data/fashion.js`, `research/FASHION.md` | Fashion-sourced or revived names | 150-350 chars |
| **In nature** | Werner 1821's animal/plant/mineral anchors | `data/botany.js`, `data/botany-images.js`, `../color-kb/werner.json`, `../color-kb/botanical.json` (already mapped for all 101) | All 101 at minimum; extend as botany ingestion grows | 1 small 3-item strip (animal/plant/mineral), ~100 chars of caption |
| **Gems & minerals** | A real stone or mineral that anchors the color | `data/gems.js`, `research/GEMS.md` | Colors with a real gem match (not every color has one — don't force it) | 100-250 chars |
| **Botany** | Flower/plant meanings (floriography), real plant pigmentation chemistry when known | `../color-kb/floriography.json` (712 flowers), `research/BOTANY.md` | Flower-named or flower-anchored colors | 150-350 chars |
| **Perception & science** | Munsell/CIELAB placement, how human vision registers the hue, cone response, relevant Color-Nerd-sourced facts once verified | `../color-kb/atoms.jsonl`, CIE/CIELAB facts already in `wiki-nodes.js`'s concept pages (trichromacy, simultaneous-contrast etc. — link out rather than re-explain) | All colors can carry at least a one-line measured fact; full facet only for colors with a real perceptual story (afterimages, Abney effect colors, etc.) | 150-500 chars, or a link-out to the relevant concept node |
| **Symbolism across cultures (hedged)** | What different traditions/eras associated with the color, explicitly marked as belief/convention, never "what this color means" | `../color-kb/SYNTHESIS.md` threads (Goethe's sensual-moral colors, Theosophy, alchemy, heraldry) — **facts about what a tradition taught**, never restated as true | Colors with a documented cross-cultural thread; thin/absent for most data-written names, and that's fine — don't pad | 200-500 chars, always framed as "X tradition held that…" |
| **In design** | A famous brand/product color (Tiffany Blue, Facebook Blue, International Klein Blue) | Existing design-history facts, `research/` as sourced | Iconic design colors only — a short, named list, not every color | 150-300 chars |
| **In film** | A matched passage from `research/PASSAGES-FILMS.md`, a famous color-grade or production-design color | `data/films.js`, `research/PASSAGES-FILMS.md` | Colors with a real match | 1 reference + 1 line of context |
| **Other languages / "say it in"** | How 2-4 languages name or split this color region (callback to the "two blues" story pattern already in `data/stories.js`) | Cross-linguistic color-naming sources, careful sourcing (per CLAUDE.md's "The Greeks couldn't see blue" myth guard) | Colors with a genuine cross-linguistic split or distinct word | 100-250 chars |
| **Variants** | Lighter/darker/historical variant names of the same color | `data/colors.js` neighbor data, `data/shades.js` | Colors with documented variants | A small chip row, little prose |
| **Myths corrected** | The CLAUDE.md myth-list entry for this color, stated as "here's the real story" | CLAUDE.md's myth list directly | Only colors that actually have a matching myth (don't invent one to fill the slot) | 150-350 chars |
| **References** | Numbered source list | Every other facet's sourcing, surfaced | All | List, no prose |

### A3. Three sample paragraphs (real colors, target voice, original prose)

These are drafted fresh for this plan, checked against the myth list and `data/wiki-colors.js`'s existing facts (not copied from either) — treat as *style samples*, not final copy; verify each fact again before shipping.

**Ultramarine — History facet:**
> Before the 1820s, ultramarine meant one thing: lapis lazuli, ground and refined from rock that came almost entirely from the Sar-e-Sang mines in what is now Afghanistan. The ore reached European painters by a long trade route, which is where the name comes from — "beyond the sea." Extracting usable pigment from the stone took days of kneading the powder in wax and resin to pull out the blue and leave the grey mineral behind, so a painter's ultramarine cost more by weight than gold through much of the 17th century. Vermeer is thought to have used it even in underpainting and shadow, where a cheaper blue would never show — a choice patrons, not instinct, probably made possible.

**Mauve (mauveine) — Etymology & first use facet, hedged per CLAUDE.md:**
> Mauveine is usually credited as the first commercially successful synthetic dye, made in 1856 when 18-year-old William Perkin was trying to synthesize quinine from coal-tar derivatives and isolated a vivid purple residue instead. Whether it was truly the *first* aniline dye at all is less settled — picric acid had already been dyeing Lyon silk yellow since 1845 — so "first aniline dye" isn't a safe claim, but "first to make its creator rich and start an industry" is. The color's name came after the chemistry: the French "mauve" (the mallow flower) was attached once Parisian fashion made the shade covetable.

**Petrol — The color measured facet, data-written style:**
> Petrol sits between teal and midnight blue: darker and less green than teal, bluer and less black than midnight blue, measured about 4.2 ΔE from its nearest neighbor in our library. In paintings across the gallery it shows up disproportionately in harbor scenes and factory-town skies — unsurprising for a name that borrowed its reference point, in English usage, from the sheen of refined oil. It has no widely used historical dye or pigment behind it; its presence in `data/colors.js` is a 20th-century color-matching convenience rather than an old craft name.

### A4. Depth tiers

Reuses ROADMAP §19's three-tier split exactly, because inventing a fourth tier here would fight the writing-pipeline plan already approved:

- **Deep** (the 101 + ~50 legends): the full facet catalog above, as many facets as genuinely apply, 2,500-4,000 characters, TOC shown.
- **Medium** (~300 names with a real history — pigments, dyes, gems, flowers, historic fashion colors): 6-10 facets, 800-1,500 characters, TOC shown only if >4 facets.
- **Data-written** (every other name, up to ~9,000 once Ridgway/M&P land): no prose facets at all except what the data itself writes — the measured-color strip (always), a Nature strip when Werner/botanical data matches, an In-painting shelf when the gallery has a real match above threshold, the nearest-neighbor diff line (`data/colors.js` already has this), and nothing else. **How a data-only color still reads as grounded, not padded:** never write a facet with no data behind it — an empty "History" header with "no notable history" is worse than no header at all. The page's honesty is structural: it shows exactly what's known and stops. A one-paragraph page that says precisely four true things beats a six-section page where two sections are filler.

### A5. Do: at least 40 ideas

Grouped per the brief: see it · make it · play with it · live with it · find it · remember it · connect it. Each: one line · why it's specific to color · data needed · effort S/M/L · wild flag.

**See it**
1. **Hue-plane slice.** This color's family plotted by lightness × chroma, with names placed in their region, this color marked. *Why specific:* makes the "names are regions, not points" idea (Color Nerd §2) visible on exactly this color. *Data:* `data/colors.js` Lab values (already computed for ΔE gates). *Effort:* M.
2. **Grayscale toggle.** One tap drains the page's hero swatch and every comparison to grayscale, to show true lightness. *Why specific:* most "which is lighter" confusion (the Helmholtz-Kohlrausch effect, Color Nerd §2 item 23-ish) is a color-specific illusion. *Data:* none beyond the hex. *Effort:* S.
3. **Color-blind preview.** Cycle protanopia/deuteranopia/tritanopia simulations of this color against its neighbors. *Why specific:* directly tests whether this color's "signature" survives the way most people actually see it. *Data:* standard CVD matrices. *Effort:* S.
4. **"Then vs now" fade.** For pigments/dyes known to fade or darken (smalt, Prussian blue, carmine, chrome yellow), a slider between the original and the aged color. *Why specific:* the fact only exists for specific pigments. *Data:* pigment-chemistry notes, estimate or cite a conservation source. *Effort:* M.
5. **Where it sits on Werner's 1821 anchors.** The animal/plant/mineral card as a small interactive flip, not just text. *Data:* `../color-kb/werner.json`. *Effort:* S.
6. **Spot it in a painting.** Open a real gallery painting with this color's regions highlighted (reuses the existing painting-page highlight-on-arrival feature per the 2026-10 commit log). *Data:* `data/gallery`, existing painting page. *Effort:* S (mostly reuse).
7. **The Abney drift animation.** For blues/violets specifically, show the hue visually drifting as lightness increases. *Why specific:* only true for this hue family. *Data:* a small canned animation, no live data needed. *Effort:* S. *Wild:* no — cheap and accurate.

**Make it**
8. **Mix it (paint).** Predict-then-reveal: pick two source paints that could make roughly this color, see the real Kubelka-Munk-model mix. *Data:* Mixbox (license check per Color Nerd §7 — CC BY-NC, commercial needs a license). *Effort:* L.
9. **Mix it (light).** The light mixer (Color Nerd idea #4): three flashlights, match this swatch. *Data:* none beyond RGB math. *Effort:* S.
10. **Build a string through this color.** Start here, pick a step (down one lightness, over two hues), get a 4-6 color string (Color Nerd idea #9). *Data:* Lab space + `data/colors.js`. *Effort:S.
11. **Tone chord from here.** Pick this color's "tone" (pale/vivid/muted/deep) and see it echoed across every hue (Color Nerd idea #3). *Data:* tone-bucket math over Lab. *Effort:* M.
12. **Nearest real name finder.** Nudge hue/lightness/chroma sliders from this color and watch the name change live, with the exact ΔE to the next name shown. *Why specific:* uses this color's own neighbor data. *Data:* `data/colors.js`, `data/library.json`. *Effort:* M.
13. **Export a palette seeded from this color.** One tap: 5 harmonious colors, CSS/Adobe/Procreate export (reuses Studio's planned export, ROADMAP §8). *Effort:* S (mostly reuse).

**Play with it**
14. **"When does it stop being this color?"** The lime-boundary game (Color Nerd idea #2), run from this color's own boundary. *Why specific:* literally this color's edge. *Data:* needs a crowd-result baseline eventually; ships fine without one at first (just show your own tap). *Effort:* M.
15. **Which way is it from its neighbor?** The "bluer/lighter/stronger" direction drill (Color Nerd idea #1), seeded with this color vs. its real neighbors. *Data:* `data/colors.js` `vs`/`d` fields, already structured for this. *Effort:* S.
16. **Odd one out, this family.** A game step scoped to this color's look-alike group (reuses the Train/Journey game grammar, ROADMAP §20). *Effort:* S (reuse).
17. **Afterimage hunt, this hue.** Stare at this color 15s, then pick the true ghost from three options (Color Nerd idea #6). *Data:* none beyond hue math. *Effort:* S.
18. **Daily dictionary guess.** A Webster's-Third-style written definition of this color (bluer than X, lighter than Y); guess the swatch (Color Nerd idea #15). *Data:* `data/colors.js` neighbor text, reworded. *Effort:* S.
19. **"Was it there?" memory round, seeded here.** This color hidden among 5 flashed swatches (Color Nerd §5's Memory family). *Effort:* S (reuse of gym engine).
20. **Imposter label.** Four swatches including this one, one label wrong — catch it. *Effort:* S (reuse).
21. **"Which hue plane?"** Given 4 colors from different families at matched lightness, say which one is this color's family — trains hue constancy. *Data:* Lab. *Effort:* S.

**Live with it**
22. **Pair it with your photos.** Upload or camera-scan a room/outfit photo, see how much of this color is already in your life. *Data:* camera + nearest-name matching (Studio's planned tool). *Effort:* M (shares Studio's camera work).
23. **Name it in the wild, scored.** A mission: find this exact color outdoors within a tolerance, logged to a personal atlas (Color Nerd idea #14). *Effort:* M.
24. **Outfit/room mockup.** Drop this color onto a poster, phone UI, room wall, or outfit mockup (ROADMAP §8 Studio mockups, pointed at this specific color). *Effort:* M (shares Studio work).
25. **"Add to my palette."** One tap saves this color into a personal working palette carried across the app. *Effort:* S.

**Find it**
26. **In paintings hub, deepened.** Not just a shelf — a "every painting with ≥8% of this color" filtered gallery view. *Data:* `data/gallery`'s computed `share` field already supports this exactly. *Effort:* S (mostly query, reuses existing shelf UI).
27. **In poems / in film, deepened the same way.** Same filtered-list treatment for `data/poems.js` / `data/films.js`. *Effort:* S each.
28. **Artist signature match.** "Artists whose palette leans hardest on this color" — ranked from `byArtist`'s `top`/`dist` fields (already computed, see §C). *Effort:* S (data exists, needs a query + list screen).
29. **Movement match.** Same, but by movement, once movement data is real (see §C sizing gap). *Effort:* M (blocked on movement data).
30. **Museum match.** "Seen most at the Hermitage" style credit, from gallery museum fields. *Effort:* S.
31. **Decade/century heatmap.** When this color peaked across art history, from `byDecade`/`byCentury`. *Effort:* S (data exists).
32. **Country/region match.** Where (by the country-of-origin caveats noted in COMMONS.md §4) this color shows up most. *Effort:* S, but caveat the data quality (COMMONS.md: country often means painter nationality, not place of making).

**Remember it**
33. **"Review it" shortcut from the page.** The existing Learn-it/Review-it button (DESIGN-SYSTEM §12) already covers this — list here only to confirm Read/Do shouldn't duplicate it.
34. **Spaced "name it again" card.** A one-tap recall check embedded at the bottom of Read, separate from the full Learn flow, for someone who's "yours since May" and just wants a refresher. *Effort:* S.
35. **"You've seen this X times."** A quiet personal-stats line: how many times you've visited, recalled correctly, or found this color in the wild. *Effort:* S (needs event logging, which may already exist for spaced review).

**Connect it**
36. **Neighbor web, not just a strip.** A small force-graph/radial view of this color's nearest names across all three name tiers (`core-names.json`, `color-names.json`, `library.json`), tap to jump. *Effort:* M.
37. **"Shares a pigment with…"** Link colors that historically came from the same source material (e.g. every color ever called out as coming from cochineal). *Data:* needs pigment-sourced tagging across colors — partially exists in wiki-nodes pigment pages. *Effort:* M.
38. **"Shares a myth with…"** Cross-link colors whose myth-corrected facets touch the same misconception (e.g. every "named after a king" legend). *Effort:* S once myth facets exist.
39. **Artist/movement deep link.** From a painting match, one tap into that artist's or movement's art-wiki profile (see §C). *Effort:* S once §C exists.
40. **"Same family, told differently."** Jump to a sibling color's own Myths/History facet to compare how two adjacent colors' stories diverge or share root causes. *Effort:* S.
41. **Wild — "Ask the color."** A constrained chat affordance scoped to this color's own facts (grounded only in its sourced facets, refuses speculation) — a mini-Q&A rather than open chat. **Wild flag: yes.** Real scope risk (answer quality, hallucination outside the sourced facets, moderation), but cheap to prototype behind a flag with a hard-coded "I only know what's in my sources" refusal pattern.
42. **Wild — "Mint a card."** Turn this color's full Read+Do page into a single shareable image card (like a trading card) with its name, hex, neighbor line and one fact. **Wild flag: yes** (production cost, and risks feeling like a different app's gimmick) but very shareable and cheap to mock up once.

### A6. How Read and Do share one page

**One gesture, a remembered default.** A horizontal swipe (or a two-segment control at the top of the content, styled as a quiet pill, not a boxed tab bar — DESIGN-SYSTEM §10/§12 already forbids "segmented tab rows" inside a Room, and the Article archetype should follow the same restraint) switches between Read and Do. The app remembers the last side visited *per user*, not per color — so someone who lives in Do stays in Do when they open the next color page, and the hero/compare-strip/primary-action area (DESIGN-SYSTEM §12 items 1-3) stays fixed above both sides, since that's identity, not content. Below the fixed hero: Read's TOC-and-facets or Do's game/tool grid, swapped by the gesture. This avoids a second full scroll-reset and keeps the page from feeling like two separate screens stapled together.

---

## B. Color Nerd, integrated deeper

### Where each idea fits

- **Color page Do side:** ideas 1, 2, 3, 4 ("bluer/lighter/stronger"), 5 (cross-hue lighter/darker, as a "try it here" link into the Train drill), 6 (afterimage), 9 (color strings), 10 (hue-plane view), 15 (daily dictionary guess), 17 (map a real palette, for artist/palette-archive colors). These are the ones genuinely tied to *one* color and belong on its own page (mapped into §A5's Do list above).
- **Train (Gym drills, §5 of COLORNERD-IDEAS):** cross-hue lighter/darker, vivid-looks-lighter traps, "which way," name boundary, same hue, more vivid, afterimage hunt, same gray/two worlds, light mixer, will-it-go-muddy, tone sort. All of §5 belongs in Train exactly as the research doc recommends — none belong in the flashcard loop (CLAUDE.md's own product rule, restated correctly by the research doc's §5 closing line).
- **The Journey (lessons, ROADMAP §1/§20):** idea 2 (lime boundary) and idea 20 (wheel of the week) work as a step-sized game or a story-card inside a lesson, not a full station. The "Task × Board × Twist × Content" grammar (ROADMAP §20) already has room for a "boundary" task type — flag that as a possible fifth task if idea 2 ships (not yet in the six listed: find/order/recall/name/match/make).
- **Read facets:** idea 1's Godlove/Webster's Third story (§4 seed "Bluer than fiesta") → Etymology or a new short "How we define colors here" explainer the Read side can link to once, not repeat per page. Story seeds in §4 (Margaret Godlove, the plant color atlas, warm/cool's invented history, the double-primary myth, Japan's tones, the Olo color, LEGO's secret colors) → History/Symbolism/Pigments facets on the specific colors they touch, and/or standalone concept pages in `wiki-nodes.js` the way `warm-and-cool` and `complementary-colors` already exist.
- **Not a good fit anywhere yet, flag for later:** idea 7 "will it go muddy" and idea 8 "myth-buster mixing" both need Mixbox, which is CC BY-NC — hold both until the license question (§7 of the research doc) is actually resolved, not just noted.

### §6 fixes: checklist (grepped against the repo 2026-10-08)

1. ~~Complementary colors page contradicts itself~~ — **appears already fixed.** `data/wiki-nodes.js`'s `complementary-colors` node now shows three explicit rows (painter's wheel, light/afterimage, CIELAB) with matching swatches and a facts table. Re-verify the "cancel toward a muddy grey-brown" line's nuance (transparent→black vs opaque→gray) is still oversimplified in the body text — it is; the body says "dull each other toward a neutral grey, brown or near-black, depending on the paints," which already hedges by "depending on the paints." Close enough; low priority to touch further.
2. ~~Color wheel presents warm/cool halves as a feature~~ — **appears already fixed/hedged.** Swatches are labeled `"RYB 'primary' (tradition)"`, not bare "primary." The Moses Harris date is hedged as "Around 1766" / "c. 1766" in both body and facts table — consistent with itself, though still worth a source check against the channel's "1769" claim (the repo's own Gage citation may simply disagree with the channel, which is fine — different scholarly dates exist; don't flip it without a primary source).
3. ~~Warm/cool page lists green and violet as cool~~ — **fixed.** The node now explicitly calls green and violet "contested," with swatch labels reading "Green · contested" / "Violet-purple · contested," and includes the two-light explanation and the Du Fresnoy-to-Hayter history thread.
4. **Harmony page: add character-first/tone-first view** — **not done.** `color-harmony` node still only covers geometry (analogous/complementary/triadic/split-complementary) plus the Schloss & Palmer "vary value more than hue" finding. No PCCS-style tone-first framing (generic tone words only, per the do-not-copy note) and no "three valid triads vs. one tone-matched palette" demonstration. Still open.
5. **"Brighter" is ambiguous in neighbor lines** — **not done.** `tools/check.js:30` still accepts "brighter" for either a lightness gap or a chroma gap (`brighter: (a, b) => a[1] > b[1] + M || a[0] > b[0] + M`). `data/colors.js` still uses "brighter" in at least Lavender, Violet, Rust, Cobalt, and Mulberry's neighbor lines. This is the cheapest fix on the list (a vocabulary + gate change, no new data) and should be prioritized — see §D.
6. **Eye score should track 3 axes, not 1 CIEDE2000 number** — belongs to Train's gym-engine design, not this page; defer to whoever owns `js/gym-engine.js`. Not checked here (out of this plan's scope).
7. **Home map is flat a\*b\*, no lightness view, CIELAB distorts blues** — a Home-screen/honeycomb concern, not a color-page concern; flag for the honeycomb owner, not actioned here.
8. **Names vs. everyday usage** — partially a Learn-copy concern. Worth adding a one-line "most people would call this X" aside on Read for the more technical 101 names (chartreuse, violet, magenta, etc.) — not yet present; low effort, add to the facet catalog's "The color measured" facet as an optional second line.
9. **Dark surround (`#121212`) may bias lightness/chroma perception in drills** — a Train/booth-grey design question (DESIGN-SYSTEM §3 already defines the booth-grey judged surface, which is *not* `#121212` — the ground token is `#0E0D0B`, closer to near-black, and the booth surface for judged screens is explicitly mid-grey `#5F5F5F`). On a second look this item in the research doc may already be resolved by the booth-grey system existing at all — recommend closing this as "handled by the existing booth/ground split" rather than carrying it forward, unless Train drills are confirmed to run on `--ground` rather than `--booth`.
10. **What's already right** (neighbor-based definitions, neutral surround, CIEDE2000 gates, hex-as-approximation, myth-busting stance) — no action; already true per the same grep.

### §7 do-not-copy, respected

Nothing in this plan proposes reproducing the channel's science-based disc, its Gumroad chart, the "Color Wheel Wednesday" name/format, its specific visual metaphors (pipe-cleaner helix, photon worksheet, LEGO CIELAB grid), or its video titles/phrasing. Mixbox and PCCS/Kobayashi licensing are called out wherever they're relevant above (A5 #8, B's "not a good fit yet"). Webster's Third and Stamper's *True Color* are referenced as facts-with-attribution only, never quoted past 15 words, matching CLAUDE.md's book-copyright rule and the research doc's own §7.

---

## C. Art wiki

### Sizing (measured from `data/gallery` and `data/stats.js`, 2026-10-07 build)

- **23,531 paintings**, 7 sources (6 museum APIs + Wikimedia Commons/Wikidata), capped at 50 paintings per artist.
- **837 distinct artists** survive the cap, and because the cap already requires enough paintings to be worth tracking, **all 837 currently have ≥5 paintings** (439 have ≥10, 155 have ≥20). There is effectively no long tail of 1-painting artists in the computed stats today — that tail exists in the raw corpus but doesn't reach `byArtist`.
- **Movement coverage is the real gap.** `byMovement` has only **8** entries (Mughal, Impressionism, Pahari, Rajput, Kalighat, Post-Impressionism, Realism, Renaissance), because the Commons adapter's `mv` field is `null` for every one of its 9,106 rows (COMMONS.md §4: "always None. Wikidata's genre/movement statements were not mapped... the one field this source does not populate"). An art wiki that wants real movement pages needs **Wikidata P135** pulled fresh per artist/work, not the existing gallery stats, which only cover the original 6-museum slice's AIC-derived style vocabulary.
- Each artist already carries, for free: a computed palette (`top` — raw top colors by share; `dist` — the colors most *distinctively* theirs by lift over the corpus baseline; `L`/`C` average lightness and chroma; a year span; a small sample of painting ids to pull thumbnails from). This is a genuinely good "palette signature" starting point with zero new computation needed — it's already built.

### Artist profiles

- **Bio, dates, movement, nationality, teachers, influences:** pull from Wikidata (CC0) — P569/P570 (birth/death), P135 (movement), P27 or P19/P20-derived nationality, P1066 (student of/teacher), P737 (influenced by), P18 (image). This is new ingestion work, not reuse — the gallery corpus doesn't carry biographical fields at all today (COMMONS.md's artist field is just a resolved name string).
- **Palette signature:** reuse `byArtist`'s existing `top`/`dist`/`L`/`C` fields directly — no new computation. Show both: `top` (what they actually painted most) and `dist` (what makes them distinctive vs. the corpus baseline) side by side, since they tell different stories (Sisley's `top` is mostly neutrals/browns like every landscape painter of his era; his `dist` — Ash, Grey, Silver with 5-9x lift — is what actually sets him apart).
- **Signature colors:** the `dist` array's top 3-5 entries, named.
- **Works in our gallery:** the `sample` array of painting ids, expandable to the full capped set (≤50) via a filtered gallery query.
- **Museums:** derivable from which gallery rows carry this artist, grouped by source museum.
- **Original prose bio:** written once per artist in the "full written bio" tier (below), sourced from Wikidata facts plus general-knowledge biographical facts, never from the private `../color-kb` book notes (those are facts-only, no prose reuse, and biography generally isn't their subject anyway).

### Movements

- **Dates, places, key artists, the movement's palette, how its color use changed over time:** same Wikidata-first approach (P135 reverse lookups, or a crawl of member-artist P135 claims), cross-referenced against `byMovement`'s existing 8 entries only where they already overlap (Impressionism, Post-Impressionism, Realism, Renaissance already have real computed palettes today — reuse those immediately as a pilot before building the Wikidata pipeline for the rest).
- **"How its color use changed":** the gallery's `byDecade`/`byCentury` stats already support a time-sliced palette for any movement whose member artists' works span enough decades — Impressionism (1860s-1900s) is the obvious first case, since the existing data already supports it without new ingestion.

### Other ways to organize art history

- **Timeline:** century/decade axis, using `byCentury`/`byDecade` (already computed) as the backbone, with movement bands overlaid once movement data is real.
- **Map:** by country/place-of-making, with the COMMONS.md §4 caveat surfaced honestly in the UI ("country" is painter nationality for ~97% of Commons rows, not place-of-making — don't present a precise-looking map without that caveat visible).
- **By museum:** trivial — `data/gallery`'s source field already supports "browse the Hermitage's paintings" today.
- **By palette/color:** "everything painted in ultramarine" — this is exactly §A5 idea #26 (the filtered-by-color-share gallery view) generalized across the whole corpus rather than scoped to one color page; build the query once, surface it from both places.
- **By subject:** not currently in the data at all (no subject/genre tagging exists in the gallery schema per the fields reviewed in COMMONS.md) — would need a new ingestion pass (Wikidata P921 "main subject," or Iconclass codes some museums already expose) — flag as a real gap, not a quick win.
- **Painter vs. painter:** a side-by-side of two artists' `top`/`dist`/`L`/`C` — pure reuse of existing computed fields, no new data needed. Cheapest "wow" feature on this whole list.

### Data sources

- **Wikidata (CC0):** birth/death, P135 movement, nationality, P1066 teacher, P737 influenced-by, P18 image. New ingestion, modeled closely on the pattern `tools/museums/commons.py` already established for paintings (SPARQL for the indexed join, `wbgetentities` for the per-entity detail) — reuse that adapter's hard-won lessons (validate `Qnnn` ids before trusting them; watch for the `somevalue`-as-blank-node trap documented in COMMONS.md §1/§4) rather than re-learning them.
- **Gallery-computed palettes:** reuse directly, zero new computation (`byArtist`, `byMovement`, `byDecade`/`byCentury`).
- **Original prose bios:** written once per full-bio artist (below), facts cross-checked, never copied from the private book notes.

### Tiering

- **155 artists have ≥20 gallery paintings** — a natural, already-measured candidate set for "clearly worth a full written bio," though the brief's "~100" target is smaller than that. Recommend: **full written bio for the top ~100 by gallery painting count** (a simple, defensible cut of the existing 155-at-≥20 and 439-at-≥10 pools — take the top 100 by raw `n`, which naturally favors the most historically major, most-collected artists already surfaced by 7 real museums' acquisition patterns).
- **The remaining ~737 (837 total minus the top 100):** a Wikidata-plus-data profile — name, dates, movement, nationality, the computed palette signature, works in the gallery — no original prose bio, clearly labeled as a data profile (not padded to look like a full article, per the Read-tier honesty principle in §A4).
- **Below ≥5 paintings (outside the current `byArtist` set entirely):** not profiled at all in v1 — they exist in the raw corpus but have no computed signature; revisit once/if the corpus grows or the cap policy changes.

### Links into color pages and the Journey

- **Color page → artist/movement:** the "In paintings" hub shelf (already planned, §A2) gets one more tier: tap a painting thumbnail → painting page (exists); tap the *artist's name* on that painting → artist profile (new); the §A5 idea #28/#29 ("artist signature match" / "movement match") lists surface the reverse direction, color → ranked artists/movements.
- **Journey:** a lesson's "Spot it in" step (ROADMAP §19's format list already proposes this) can pull from a specific artist or movement once the art wiki exists — e.g., a Reds-family lesson's painting step could specifically use a Renaissance painting given that movement already has real computed data today, rather than a random gallery pick.

---

## D. Recommended build order

Cheapest-high-value first. Each item sized; "wild" items pulled into their own list at the end rather than dropped.

1. **(S) Fix "brighter" ambiguity.** Split into lighter/darker and stronger/weaker (or more vivid/duller) in `data/colors.js`'s neighbor text and `tools/check.js`'s gate. No new data, closes an open §6 item, improves every existing color page immediately.
2. **(S) Painter-vs-painter comparison.** Pure reuse of existing `byArtist` fields (`top`/`dist`/`L`/`C`). Cheapest real "wow" in the whole plan.
3. **(S) Color → ranked artists/movements/museums/decades.** All backed by fields that already exist in `data/stats.js` today (§A5 ideas #28, #30, #31; movement ranking blocked until movement data improves, so ship artist/museum/decade first, movement later).
4. **(S) "By palette/color" cross-corpus filter** ("everything painted in ultramarine"), generalized once and surfaced from both the color page and a new art-wiki entry point.
5. **(S) Grayscale toggle + color-blind preview on the color page.** No new data, high clarity value, directly answers Color Nerd §6 item 7's legibility point.
6. **(M) Read side: facet catalog rollout for the Deep tier (101 + legends), batch by batch**, per ROADMAP §19's existing pipeline (fact cards → writer → adversarial fact-check → gate script → David spot-check). This plan's facet catalog (§A2) is the missing spec that pipeline needs before the first batch runs.
7. **(M) "Which way is it" / cross-hue direction drills, seeded per-color.** Reuses `data/colors.js`'s existing `vs`/`d` structure; ships in both Train (full station) and the color page's Do side (one scoped round).
8. **(M) Artist profile pages, data-profile tier (~737 artists).** Needs the new Wikidata ingestion adapter (modeled on `commons.py`) but no original prose — mechanical once the adapter exists.
9. **(M) Artist profile pages, full-bio tier (top 100).** Same ingestion, plus a writing pass per artist (a smaller, well-scoped version of the color-writing pipeline).
10. **(M) Movement pages for the 8 movements with real computed data today**, as a pilot before the larger Wikidata movement pipeline. Impressionism and Post-Impressionism are the obvious first two (richest existing data, richest existing wiki-node prose to link against).
11. **(M) Lime-boundary game + daily dictionary guess**, seeded from any color page, written against Color Nerd ideas #2 and #15.
12. **(L) Full Wikidata movement pipeline** (P135 reverse lookups across the full 837-artist set), unlocking real movement pages, movement-ranked color search, and the timeline/map views' movement overlays.
13. **(L) Mixbox-backed mixing features** (predict-then-reveal, myth-buster mixes) — gated on resolving the CC BY-NC commercial license question first; don't build the UI before the license question is actually closed.
14. **(L) Subject/genre tagging** (by-subject browsing) — needs new ingestion (Wikidata P921 or museum Iconclass fields), not currently supported by any existing field.

### Wild list (flagged, not dropped)

- **"Ask the color"** — a constrained, sourced-facts-only Q&A per color page (§A5 #41).
- **"Mint a card"** — shareable trading-card export of a color's Read+Do page (§A5 #42).
- **Two-light 3D scene toy** (Color Nerd idea #13) — a real still-life with draggable warm/cool lights; cool, but L-effort and tangential to the four product goals versus other L items above.
- **Colored-shadows toy** (Color Nerd idea #18) — delightful, but best placed as a story/Explore moment rather than a per-color Do feature; low urgency.
- **Photon-counter interactive** (Color Nerd idea #19) — strong teaching value but belongs to a general "how vision works" story, not a per-color page; flagged for Explore's Ideas cover, not this plan's build order.
- **Field atlas / personal color-finding log** (§A5 #23, Color Nerd idea #14) — real product value, but depends on camera infrastructure Studio is already building; worth doing once, shared, not duplicated per color.
