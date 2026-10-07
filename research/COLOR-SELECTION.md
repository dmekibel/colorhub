# Which colors the path teaches: selection rules and a re-check

Written 2026-10-07. Research only: no app file was changed. It checks the 90 unit colors in `data/colors.js` (12 units), with the 11 basic terms as context, against five explicit rules. Data used: `data/library.json` (2,711 named colors; the 28 crude survey names are left out, so 2,683), `data/corpus.json` (4,655 paintings × 6 palette colors = 27,930 colors with area shares), the xkcd survey file cached at `research/_raw/library/xkcd-rgb.txt`, and Google Books Ngram (corpus `en`, 1900–2019, 596 terms in about 60 requests, one request per 1.2 s, cached in the gitignored `research/_raw/ngrams/`). All color distances are CIEDE2000 on the sRGB hex values (D65), with the same formula as `tools/colormath.js` and `tools/library.py`.

## Summary

| Rule | Test | Pass mark | Where the 90 stand |
|---|---|---|---|
| (a) Common word | Frequency band from the xkcd survey rank and the Ngram color-sense rate | Tier 2: band A or B. Tier 3: band B, or band C with a painting or design reason | Tier 2: 40 of 42 pass (Ivory and Silver only miss because material words are judged on xkcd alone). Tier 3: 27 of 48 are band A/B; 18 are C, 2 are D (Oxblood, Byzantium), 1 unmeasured (Ash) |
| (b) Visibly distinct | ΔE00 to every other taught color | Floor 6.5 everywhere, not only inside a unit; 6.5–8 is "watch" | 6 colors in 3 pairs fail (Maroon–Carmine 6.0, Charcoal–Gunmetal 6.0, Salmon–Terracotta 6.3), plus Rust–Sienna at 6.45. 7 more sit under 6.0 from a placement swatch (Gold is 3.9 from Yellow) |
| (c) Fills the space | Share of colors within ΔE 10 of a taught or basic color; share each color "owns" | Library ≥ 90% and painted area ≥ 90% within ΔE 10; each color owns ≥ 0.5% of the library or of painted area | Library 87.2%, painted area **80.1%**. The empty fifth of painted area is dark olive-browns, olive-greys and greenish greys |
| (d) Useful across fields | Painting / design / fashion / everyday tags, scored 0–3 | Score ≥ 2 | 11 colors score 0–1 (Oxblood, Cerise, Malachite, Viridian, Thistle, Amethyst, Mulberry, Byzantium, Umber, Ash, Gunmetal) |
| (e) One agreed hex | The hex matches a named source (CSS, Wikipedia's list, xkcd centroid) within ΔE 3, and is shown as approximate | Named source, or a written reason for a "pick" | 17 "pick" hexes; 2 of them sit within ΔE 3 of a named source (Lavender, Jade); 13 colors are > ΔE 15 from what people call that name in the xkcd survey |

**A color stays when it passes (b) and (e) and at least two of (a), (c) and (d).** Thirteen of the 90 fail that "two of three" test: Ivory, Carmine, Oxblood, Cerise, Malachite, Viridian, Bottle green, Thistle, Amethyst, Mulberry, Byzantium, Ash and Gunmetal. (Ivory only fails because it sits on top of White.)

**Top swaps** (evidence in §2.6). Together they raise painted-area coverage within ΔE 10 from 80.1% to 91.9%, and to 94.2% with the optional seventh. Library coverage goes from 87.2% to 90.1% (90.5% with it). They also clear every taught-to-taught pair below 6.5 except Rust–Sienna, which sits exactly on the floor at 6.45:
1. **Add Bistre** (#3D2B1F, Wikipedia) for the brown-black of old paintings: +7.9 points of painted area on its own, the biggest single gap. It is a rare word, so it is taught as a painting term, glossed "brown-black".
2. **Gunmetal → Green grey** (#5B6259, RAL/xkcd): fixes Charcoal–Gunmetal 6.0 and names the greenish greys (+2.5 points of painted area).
3. **Add Stone** (#ADA587, xkcd #552) for the light greige of grounds and plaster (+3.7 points within ΔE 8).
4. **Carmine → Rose** (#CF6275, xkcd #49): fixes Maroon–Carmine 6.0 and swaps a band-C word for a band-A one. Carmine moves to the planned pigment tier.
5. **Byzantium → Grape** (#6C3461, xkcd #139): the same spot (ΔE 3.2) with a word people actually use. Byzantium has zero adjective use in the Ngram data and is not an xkcd name.
6. **Malachite → Seafoam** (#80F9AD, xkcd #70 as "seafoam green"): drops a rare, crowded vivid green (8.1 from Emerald) for an everyday pale cyan-green that the set lacks.
7. *Optional:* **Add Black olive** (#3B3C36, Wikipedia/RAL) for olive-black shadows, +2.3 more points of painted area. The word is rare (band C).

Two hex fixes, no new words: **Terracotta → xkcd #CA6641** (clears Salmon, 6.3 → 13.7) and **Tangerine → xkcd #FF9408** (clears the Orange swatch, 4.9 → 8.8).

---

## 1. The rules

### (a) Common word: frequency

**Two sources, because each one fails differently.**
- **xkcd color survey (Munroe, 2010).** About 5 million color namings by roughly 222,000 people on random monitor colors. Only color uses count, so there is no noun ambiguity. `rgb.txt` lists the 949 most-used names with their average color. **Rank = position from the end of the file.** The file has no counts. Its order was read as "fewest answers first" because its last lines are purple, green, blue, pink, brown and red. That reading is inferred, not documented. A name gets its best variant: Navy is ranked as "navy blue" (#34), Lime as "lime green" (#15), Sienna as "burnt sienna" (#122). Bias: casual, online, US-heavy, and limited to screen colors.
- **Google Books Ngram (English 2019 corpus).** The mean yearly rate in 2000–2019, in occurrences per million words.
  - Raw counts are useless for words like *rose* (a flower and the past tense of *rise*: 50 per million), *gold*, *orange*, *olive*, *salmon*, *navy* and *slate*. So the **color-sense rate** counts only uses the tagger marks as adjectives (`olive_ADJ`) plus color compounds: *olive* = `olive_ADJ` + "olive green"; *teal* = `teal_ADJ` + "teal blue" + "teal green". Spelling variants are pooled: ochre + ocher, vermilion + vermillion, terracotta + "terra cotta", grey + gray, bistre + bister.
  - Two-word names use the plain phrase ("royal blue", "burnt orange").
  - Hyphenated and possessive forms (off-white, Payne's grey) returned nothing from the endpoint and are unmeasured.
- **Known biases of the Ngram rate.**
  - Color nouns ("dressed in teal") are not counted, so newer noun-like words read low (teal 0.08, taupe 0.02).
  - For **material and food words** (gold, silver, ivory, stone, steel, brick, slate, charcoal, cream, chocolate, amber, jade, emerald, denim…), the adjective tag mostly catches "a gold ring" or "a stone wall". Those rows carry a `*`, and their band comes from xkcd alone.
  - Books lag speech and fashion. Oxblood and greige are common in shop listings and nearly absent from books before 2019.

**Bands.** **A** = xkcd rank ≤ 100 or Ngram ≥ 1.0 per million. **B** = xkcd ≤ 300 or Ngram ≥ 0.2. **C** = in the xkcd file at all, or Ngram ≥ 0.03. **D** = neither.

**Test.** Tier 2 ("everyday in-betweens") needs A or B. Tier 3 needs B, or C with a field reason: a real paint name (P) or a standard design term. A D word needs a strong case under (c) and is flagged.

**Trends worth knowing** (color-sense rate, 1950–69 → 2000–19):
- Rising: burgundy 0.04 → 0.31, hot pink 0.02 → 0.16, golden brown 0.37 → 1.05, and teal, more than doubled from a small base.
- Falling: vermilion 0.79 → 0.37, ultramarine 0.45 → 0.12, bistre 0.16 → 0.02, green-grey 0.51 → 0.07, olive-brown 0.28 → 0.05.
- Stable: beige 0.87 → 0.90, mauve 0.39 → 0.30.

The muted compound words painters once used are fading from print, which is part of why they feel obscure now.

### (b) Visibly distinct from every other taught color

**Test:** ΔE00 from the color to its nearest taught neighbor, in any unit. **Floor 6.5. Watch band 6.5–8. Comfortable ≥ 8.** A taught color under 6 from a placement swatch is flagged too.

Why 6.5 and not the 6 the brief suggested, or the 2–3 of a side-by-side test:
1. **The deck is a memory task, not a side-by-side one.** One swatch fills the screen and must call up one name. ΔE00 ≈ 1 is a just-noticeable difference side by side, and around 2–3 two colors look the same on an uncalibrated screen. Matching from memory is much coarser than side by side, so a pair the eye can split next to each other can still be confused alone.
2. **Screens differ.** Phones vary in white point (True Tone, Night Shift) and gamut, so the same hex can move a few ΔE from one phone to the next. Two names 5 apart can swap places across devices.
3. **Spaced review mixes units.** `tools/check.js` enforces 6.5 inside a unit, but review decks mix every unit learned. The rule has to hold across units, and today it doesn't (§2.3).
4. **An empirical anchor.** Among the 30 most-used xkcd names, the nearest-neighbor ΔE00 between their average colors has a median of 12.0, a 10th percentile of 6.1 and a minimum of 5.5. Among the top 50 the 25th percentile is 6.5. Words people treat as different everyday names sit about 6 or more apart. Below that, names are near-synonyms (taupe vs. greige).
5. **The current set agrees.** The median nearest-neighbor ΔE of the 90 is 8.6. Only 6 colors are under 6.5 and 24 are between 6.5 and 8, so 6.5 keeps the set as it is apart from real collisions.

**Placement swatches** are categories, not points. Red has to sit between Vermilion and Crimson, which are only 9.2 apart, so Red ends up about 5 from each. A taught color under 6 from its basic's swatch is flagged "watch", not failed. It means the card can't show "how it differs" well, and either swatch could be nudged.

### (c) Fills the color space

**Measures** (ΔE 10 = clearly a different color, the cut LIBRARY.md uses):
- *Library coverage*: the share of the 2,683 library names within ΔE 10 of a taught or basic color. It stands for named color space: design, fashion and screen.
- *Painted-area coverage*: the share of corpus palette area within ΔE 10. It stands for where paintings actually land.
- *Owns*: the share of library names, or of painted area, whose nearest app color is this one, within ΔE 10.
- *Unique*: the painted area that would fall beyond ΔE 10 of every app color if this one were removed.

**Test:** the whole set reaches ≥ 90% on both coverages. Each color owns ≥ 0.5% of the library or of painted area, or is band A.

| Set | Library ≤6 / ≤8 / ≤10 | Painted area ≤6 / ≤8 / ≤10 | Random sRGB ≤10 | Painted median ΔE |
|---|---|---|---|---|
| 11 basics alone | 7.9 / 15.2 / 24.5% | 7.1 / 15.0 / 25.0% | 19.6% | 13.7 |
| 90 taught colors | 42.3 / 66.5 / 85.3% | 28.7 / 53.2 / 72.6% | 88.5% | 7.7 |
| 90 + 11 basics (today) | 46.2 / 70.1 / **87.2%** | 34.8 / 61.5 / **80.1%** | 89.5% | 7.3 |
| Proposed swaps 1–6 + 2 hex fixes (92 + 11) | – / 73.9 / **90.1%** | – / 75.4 / **91.9%** | 90.7% | 6.5 |
| … plus Black olive (93 + 11) | – / 74.6 / **90.5%** | – / 80.8 / **94.2%** | 90.8% | 6.3 |

Today 19.9% of painted area and 12.8% of library names are more than ΔE 10 from every app color. The hue circle is well covered. The empty part is low-chroma color (§2.4), as LIBRARY.md §7 also found.

**Caveat:** painted area is skewed toward dark and brown by aged varnish and museum photography (STATS-FINDINGS §4). The dark olive-brown gap is partly a gap in naming *photographed old varnish*. It is still what a learner sees on a painting page.

### (d) Useful across fields: 0–3

One tag per field where the word is in active use:
- **P**, painting/art: an artists' paint or art material (cerulean, umber, charcoal), or standard painting talk.
- **D**, design: CSS/web, graphic, interiors, product, a Pantone Color of the Year.
- **F**, fashion, textiles, cosmetics.
- **E**, everyday: computed, = xkcd rank ≤ 200 or Ngram color-sense ≥ 0.2 per million (material words by xkcd only; Silver and Ivory set by hand).

**Score = min(3, number of tags). Test: ≥ 2.** P, D and F are judgment calls. Each one is short and shown in the table, so it can be argued with.

### (e) One agreed hex from a named source, marked approximate

**Test:** each color carries exactly one hex.
- `src` names where it came from: `css` (CSS Color 4), `wiki` (Wikipedia "List of colors", with that row's own cited source), or `xkcd` (survey average). A future pigment tier adds `ridgway` / `werner` / `iscc`.
- A `pick` must say which source it is closest to and why it departs. A pick within ΔE 3 of a named source should just cite that source.
- The UI says the value is a screen approximation; `data/colors.js` already says so in its header.
- **Secondary check:** ΔE to the xkcd average for the same name. Above 15 means people picture the name differently from the stored hex. That's not a failure, since CSS magenta *is* magenta, but the card's "how it differs" line should not rely on it.

---

## 2. The re-check

### 2.1 The 90 taught colors

How to read the columns:
- **Freq**: band · best xkcd rank · Ngram color-sense rate per million (2000–19). `*` = a material/food word, judged on xkcd only.
- **Nearest taught**: the closest of the other 89.
- **Closer basic**: shown when a placement swatch is closer still.
- **Owns**: % of library names / % of painted area for which this is the nearest app color, within ΔE 10.
- **Unique paint**: painted area lost to ΔE > 10 if this color were removed.
- **Fields**: tags and score.
- **Hex**: `src`, and for picks the nearest named source.

| Color | Unit | Freq: band · xkcd rank · Ngram | Nearest taught (ΔE) | Closer basic | Owns: lib / paint % | Unique paint % | Fields | Hex | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Navy | t2-blues | A · #34 · 1.02 | Midnight blue (8.6) |  | 0.71 / 0.09 | 0.05 | DFE 3 | #1C2B5A pick, xkcd at 7.1 | keep |
| Royal blue | t2-blues | A · #33 · 0.22 | Azure (9.4) | Blue (5.1) | 0.67 / 0.0 | 0.0 | DFE 3 | #4169E1 css; xkcd centroid 25.5 away | watch: 5.1 from Blue swatch; CSS value is much lighter than what people call royal blue (xkcd 25.5 away) |
| Sky blue | t2-blues | A · #13 · 0.26 | Powder blue (9.2) |  | 0.93 / 0.03 | 0.02 | DFE 3 | #87CEEB css | keep |
| Periwinkle | t2-blues | A · #43 · 0.02 | Lavender (8.6) |  | 0.71 / 0.01 | 0.0 | DFE 3 | #A3A8EE pick, wiki at 10.3 | keep |
| Turquoise | t2-blues | A · #19 · 0.35 | Aqua (8.6) |  | 0.41 / 0.0 | 0.0 | DFE 3 | #40E0D0 css | keep |
| Teal | t2-blues | A · #8 · 0.08 | Viridian (9.4) |  | 0.82 / 0.03 | 0.02 | DFE 3 | #008080 css | keep |
| Aqua | t2-blues | A · #24 · 0.06 | Turquoise (8.6) |  | 0.34 / 0.0 | 0.0 | DE 2 | #00FFFF css | keep |
| Scarlet | t2-reds | B · #181 · 0.79 | Vermilion (7.2) |  | 0.75 / 0.0 | 0.0 | PFE 3 | #FF2400 wiki; xkcd centroid 16.4 away | keep |
| Crimson | t2-reds | B · #102 · 0.97 | Cerise (9.2) | Red (5.6) | 0.78 / 0.03 | 0.0 | PDE 3 | #DC143C css; xkcd centroid 17.4 away | watch: 5.6 from Red swatch |
| Maroon | t2-reds | A · #29 · 0.23 | Carmine (6.0) |  | 0.3 / 0.02 | 0.0 | DFE 3 | #800000 css | watch: 6.0 from Carmine (fixed by the Carmine swap) |
| Burgundy | t2-reds | A · #67 · 0.31 | Carmine (6.6) |  | 0.48 / 0.03 | 0.01 | DFE 3 | #800020 wiki | keep |
| Coral | t2-reds | B · #125 · 0.61 | Terracotta (8.2) |  | 0.82 / 0.01 | 0.0 | DFE 3 | #FF7F50 css | keep |
| Salmon | t2-reds | A · #31 · 0.09 | Terracotta (6.3) |  | 1.01 / 0.0 | 0.0 | DFE 3 | #FA8072 css | watch: 6.3 from Terracotta (fix Terracotta's hex) |
| Baby pink | t2-reds | B · #186 · 0.02 | Thistle (11.6) |  | 1.45 / 0.04 | 0.04 | DFE 3 | #F4C2C2 wiki | keep |
| Hot pink | t2-reds | A · #37 · 0.16 | Orchid (10.9) | Pink (8.0) | 0.97 / 0.0 | 0.0 | DFE 3 | #FF69B4 css | keep |
| Magenta | t2-reds | A · #11 · 0.26 | Orchid (10.2) |  | 0.56 / 0.0 | 0.0 | PDE 3 | #FF00FF css; xkcd centroid 23.1 away | watch: CSS full magenta; people's magenta is darker (xkcd 23 away) |
| Lime | t2-greens | A · #15 · 0.59 | Chartreuse (7.4) |  | 0.97 / 0.0 | 0.0 | DFE 3 | #BFFF00 wiki | keep |
| Mint | t2-greens | A · #62 · 0.09 | Celadon (7.9) |  | 0.86 / 0.0 | 0.0 | DFE 3 | #A8EBC4 pick, xkcd at 8.7 | keep |
| Kelly green | t2-greens | A · #71 · 0.03 | Malachite (9.3) |  | 0.41 / 0.0 | 0.0 | DFE 3 | #4CBB17 wiki | keep |
| Emerald | t2-greens | B · #213 · 0.86* | Malachite (8.1) |  | 0.56 / 0.0 | 0.0 | PF 2 | #50C878 wiki | keep |
| Sage | t2-greens | B · #120 · 0.48 | Moss (9.2) |  | 1.01 / 0.85 | 0.3 | DFE 3 | #9CAF88 pick, xkcd at 6.3 | keep |
| Olive | t2-greens | A · #30 · 0.77 | Moss (13.3) |  | 0.6 / 0.29 | 0.26 | DFPE 3 | #808000 css | keep |
| Forest green | t2-greens | A · #25 · 0.12 | Jade (13.6) | Green (7.6) | 0.56 / 0.0 | 0.0 | DFE 3 | #228B22 css; xkcd centroid 22.6 away | watch: 7.6 from Green swatch; people picture it much darker (xkcd 22.6 away) |
| Lavender | t2-purples | A · #20 · 0.11 | Periwinkle (8.6) |  | 0.41 / 0.0 | 0.0 | DFE 3 | #BFA2E8 pick ≈ xkcd (≤3) | keep |
| Lilac | t2-purples | A · #35 · 0.22 | Thistle (8.2) |  | 0.48 / 0.0 | 0.0 | DFE 3 | #C8A2C8 wiki | keep |
| Mauve | t2-purples | A · #26 · 0.30 | Puce (9.0) |  | 0.89 / 0.04 | 0.03 | DFE 3 | #A8778F pick, xkcd at 4.7 | keep |
| Plum | t2-purples | A · #63 · 0.08 | Byzantium (9.6) | Purple (9.0) | 1.42 / 0.01 | 0.01 | DFE 3 | #8E4585 wiki; xkcd centroid 17.3 away | keep |
| Violet | t2-purples | A · #17 · 1.29 | Amethyst (16.8) | Purple (13.2) | 0.93 / 0.0 | 0.0 | PDE 3 | #8000FF wiki | keep |
| Indigo | t2-purples | A · #46 · 0.17 | Midnight blue (7.1) |  | 0.56 / 0.0 | 0.0 | PFE 3 | #3D2B8E pick, xkcd at 7.4 | keep |
| Gold | t2-earths | A · #61 · 3.16* | Canary (7.3) | Yellow (3.9) | 0.63 / 0.0 | 0.0 | PDFE 3 | #FFD700 css | watch: 3.9 from the Yellow placement swatch; on screen it is a yellow |
| Mustard | t2-earths | A · #47 · 0.28 | Marigold (8.0) |  | 1.08 / 0.29 | 0.04 | DFE 3 | #CFA41C pick, xkcd at 6.2 | keep |
| Khaki | t2-earths | A · #68 · 0.08 | Moss (12.0) |  | 1.45 / 0.69 | 0.1 | DFE 3 | #BDB76B css | keep |
| Tan | t2-earths | A · #22 · 0.36 | Camel (7.5) |  | 0.71 / 8.43 | 0.84 | DFE 3 | #D2B48C css | keep |
| Rust | t2-earths | A · #94 · 0.25* | Sienna (6.5) |  | 0.19 / 0.03 | 0.0 | DFE 3 | #B7410E wiki | watch: 6.45 from Sienna, just under the floor |
| Chocolate | t2-earths | B · #183 · 0.24* | Sienna (11.5) | Brown (8.3) | 0.19 / 0.23 | 0.01 | DFE 3 | #7B3F00 wiki; xkcd centroid 16.6 away | keep |
| Ivory | t2-neutrals | C · #445 · 1.19* | Ecru (6.7) | White (5.2) | 0.22 / 0.05 | 0.0 | DFE 3 | #FFFFF0 css | watch: 5.2 from White swatch |
| Cream | t2-neutrals | B · #124 · 0.37* | Ivory (9.2) |  | 1.19 / 0.03 | 0.0 | DFE 3 | #FFFDD0 wiki | keep |
| Beige | t2-neutrals | A · #32 · 0.90 | Ecru (6.7) |  | 1.45 / 3.32 | 0.01 | DFE 3 | #E6D5B0 pick, xkcd at 4.8 | keep |
| Taupe | t2-neutrals | A · #74 · 0.02 | Sepia (10.1) |  | 1.38 / 8.6 | 4.72 | DFE 3 | #8E7F71 pick, xkcd at 13.5 | watch: sources disagree (Wikipedia #483C32 is 24.6 away); the app's mid value is the common one |
| Silver | t2-neutrals | C · #390 · 4.59* | Ash (7.8) |  | 1.9 / 2.69 | 0.41 | DFE 3 | #C0C0C0 css | keep |
| Slate | t2-neutrals | A · #92 · 0.48* | Steel blue (10.6) | Grey (8.5) | 0.93 / 0.64 | 0.32 | DE 2 | #708090 css | keep |
| Charcoal | t2-neutrals | B · #187 · 0.16* | Gunmetal (6.0) |  | 1.53 / 1.06 | 0.32 | PDFE 3 | #36454F wiki | watch: 6.0 from Gunmetal (fixed by the Gunmetal swap) |
| Powder blue | t3-blues | B · #149 · 0.09 | Sky blue (9.2) |  | 0.93 / 0.01 | 0.0 | DFE 3 | #B0E0E6 css; xkcd centroid 15.4 away | keep |
| Cornflower | t3-blues | B · #141 · 0.04 | Azure (7.9) |  | 0.82 / 0.05 | 0.0 | DE 2 | #6495ED css | keep |
| Azure | t3-blues | B · #144 · 0.13 | Steel blue (6.9) |  | 0.22 / 0.0 | 0.0 | DE 2 | #007FFF wiki | keep |
| Cerulean | t3-blues | A · #97 · 0.15 | Steel blue (7.0) |  | 0.37 / 0.01 | 0.0 | PDFE 3 | #007BA7 wiki | keep |
| Cobalt | t3-blues | B · #155 · 0.29 | Denim (9.7) |  | 0.89 / 0.02 | 0.0 | PDFE 3 | #0047AB pick, xkcd at 3.7 | keep |
| Steel blue | t3-blues | B · #115 · 0.04 | Azure (6.9) |  | 0.63 / 0.03 | 0.0 | DE 2 | #4682B4 css | keep |
| Denim | t3-blues | B · #262 · 0.10* | Cobalt (9.7) | Blue (6.5) | 1.6 / 0.17 | 0.05 | DF 2 | #3B638C xkcd | keep |
| Petrol | t3-blues | C · #713 · 0.01 | Teal (12.6) |  | 0.97 / 0.14 | 0.1 | DF 2 | #005F6A xkcd | watch: fuel sense dominates; xkcd #713. Mostly UK/EU fashion |
| Midnight blue | t3-blues | B · #131 · 0.12 | Indigo (7.1) |  | 0.56 / 0.02 | 0.01 | DFE 3 | #191970 css | keep |
| Vermilion | t3-reds | B · #375 · 0.37 | Scarlet (7.2) | Red (5.1) | 0.93 / 0.28 | 0.0 | PDE 3 | #E34234 wiki | watch: 5.1 from Red swatch; not in xkcd under either spelling as a top name |
| Carmine | t3-reds | C · #783 · 0.005 | Maroon (6.0) |  | 0.45 / 0.02 | 0.0 | PF 2 | #960018 wiki | swap → **Rose**; move Carmine to the pigment tier |
| Oxblood | t3-reds | D · – · 0.001 | Burgundy (11.1) |  | 0.3 / 0.17 | 0.09 | F 1 | #4A0000 wiki | watch: rare in books and not in xkcd; a rising fashion word. Keep only with the leather/fashion line |
| Brick | t3-reds | A · #65 · 0.40* | Carmine (8.2) |  | 1.23 / 0.36 | 0.02 | DE 2 | #A03623 xkcd | keep |
| Cerise | t3-reds | C · #305 · 0.005 | Crimson (9.2) |  | 1.12 / 0.0 | 0.0 | F 1 | #DE3163 wiki | watch: rare in books |
| Raspberry | t3-reds | B · #196 · 0.02 | Burgundy (12.0) |  | 0.86 / 0.03 | 0.02 | DFE 3 | #B00149 xkcd | keep |
| Peach | t3-oranges | A · #40 · 0.15 | Apricot (8.9) |  | 0.89 / 0.07 | 0.0 | DFE 3 | #FFCBA4 wiki | keep |
| Apricot | t3-oranges | C · #303 · 0.08 | Peach (8.9) |  | 0.75 / 0.01 | 0.0 | DF 2 | #FFB16D xkcd | keep |
| Tangerine | t3-oranges | B · #193 · 0.03 | Ochre (8.1) | Orange (4.9) | 0.48 / 0.01 | 0.0 | DFE 3 | #F28500 wiki | watch: 4.9 from the Orange placement swatch |
| Burnt orange | t3-oranges | A · #52 · 0.06 | Rust (8.3) |  | 0.63 / 0.12 | 0.0 | DFE 3 | #CC5500 wiki | keep |
| Ochre | t3-oranges | A · #100 · 0.35 | Tangerine (8.1) | Orange (7.3) | 0.97 / 0.29 | 0.12 | PDFE 3 | #CC7722 wiki | keep |
| Marigold | t3-oranges | C · #323 · 0.001 | Mustard (8.0) |  | 0.97 / 0.24 | 0.0 | DF 2 | #EAA221 wiki | watch: rare as a color word; 8.0 from Mustard |
| Amber | t3-oranges | C · #384 · 0.40* | Gold (8.1) | Yellow (5.7) | 0.71 / 0.02 | 0.0 | DF 2 | #FFBF00 wiki | watch: 5.7 from Yellow swatch |
| Canary | t3-oranges | B · #404 · 0.24 | Gold (7.3) |  | 1.45 / 0.0 | 0.0 | FE 2 | #FFEF00 wiki | watch: 7.3 from Gold, 4.5 from a pure yellow; Lemon (2.2 away) is the commoner word |
| Chartreuse | t3-greens | A · #77 · 0.04 | Lime (7.4) |  | 1.23 / 0.0 | 0.0 | DFE 3 | #7FFF00 css | keep |
| Pistachio | t3-greens | C · #345 · 0.01 | Emerald (9.1) |  | 0.75 / 0.01 | 0.0 | DF 2 | #93C572 wiki | watch: rare as a color word |
| Celadon | t3-greens | C · #459 · 0.008 | Mint (7.9) |  | 0.82 / 0.07 | 0.01 | PD 2 | #ACCFB0 pick, wiki at 6.4 | watch: rare; ceramics word |
| Jade | t3-greens | B · #216 · 0.15* | Emerald (10.1) | Green (6.2) | 1.01 / 0.0 | 0.0 | DF 2 | #00A86B pick ≈ xkcd (≤3) | watch: 6.2 from Green swatch |
| Malachite | t3-greens | C · – · 0.08 | Emerald (8.1) |  | 0.56 / 0.0 | 0.0 | P 1 | #0BDA51 wiki | swap → **Seafoam** |
| Viridian | t3-greens | C · #646 · 0.02 | Teal (9.4) |  | 1.19 / 0.14 | 0.09 | P 1 | #40826D wiki | watch: rare outside painting |
| Moss | t3-greens | B · #116 · 0.19 | Sage (9.2) |  | 1.23 / 0.67 | 0.43 | DFE 3 | #8A9A5B wiki | keep |
| Hunter green | t3-greens | B · #104 · 0.04 | Bottle green (8.0) |  | 0.97 / 0.4 | 0.36 | DFE 3 | #355E3B wiki | keep |
| Bottle green | t3-greens | C · #473 · 0.02 | Hunter green (8.0) |  | 0.45 / 0.01 | 0.0 | DF 2 | #006A4E pick, ridgway at 10.0; xkcd centroid 15.7 away | watch: rare in US books; 8.0 from Hunter green |
| Thistle | t3-purples | C · – · 0.03 | Lilac (8.2) |  | 0.6 / 0.0 | 0.0 | D 1 | #D8BFD8 css | watch: CSS-only word; rare; owns little |
| Orchid | t3-purples | B · #205 · 0.008 | Magenta (10.2) |  | 0.71 / 0.0 | 0.0 | DF 2 | #DA70D6 css | keep |
| Amethyst | t3-purples | C · #558 · 0.01 | Orchid (13.2) |  | 0.71 / 0.0 | 0.0 | F 1 | #9966CC wiki | watch: rare as a color word |
| Puce | t3-purples | A · #85 · 0.02 | Mauve (9.0) | Pink (7.9) | 1.3 / 0.04 | 0.02 | FE 2 | #CC8899 wiki; xkcd centroid 26.7 away | watch: people disagree what puce is: xkcd puce is a brown (26.7 away) |
| Mulberry | t3-purples | C · #463 · 0.008 | Cerise (11.6) |  | 1.08 / 0.01 | 0.0 | F 1 | #C54B8C wiki; xkcd centroid 17.4 away | watch: rare as a color word |
| Byzantium | t3-purples | D · – · 0.000 | Plum (9.6) |  | 1.19 / 0.0 | 0.0 | – 0 | #702963 wiki | swap → **Grape** (same spot, ΔE 3.2) |
| Aubergine | t3-purples | B · #244 · 0.004 | Byzantium (12.5) |  | 0.52 / 0.0 | 0.0 | DF 2 | #3D0734 xkcd | keep |
| Ecru | t3-earths | C · #398 · 0.005 | Ivory (6.7) |  | 0.89 / 2.46 | 0.01 | DF 2 | #F0E6D2 pick, xkcd at 11.8 | watch: rare; 6.7 from Ivory and Beige |
| Camel | t3-earths | C · #411 · 0.03 | Tan (7.5) |  | 1.19 / 8.34 | 2.6 | DF 2 | #C19A6B wiki | keep |
| Terracotta | t3-earths | B · #176 · 0.18 | Salmon (6.3) |  | 1.08 / 0.22 | 0.11 | PDE 3 | #E2725B wiki | watch: 6.3 from Salmon; xkcd terracotta #CA6641 is earthier and clears it (8.3 from Burnt orange) |
| Sienna | t3-earths | B · #122 · 0.14 | Rust (6.5) |  | 0.93 / 0.75 | 0.14 | PE 2 | #A0522D css | watch: 6.45 from Rust, just under the floor |
| Sepia | t3-earths | C · #402 · 0.10 | Taupe (10.1) | Brown (8.8) | 1.42 / 7.34 | 2.0 | PD 2 | #8A6A4F pick, xkcd at 8.7 | keep |
| Umber | t3-earths | B · #226 · 0.12 | Sepia (12.5) | Brown (10.6) | 1.79 / 9.13 | 6.63 | P 1 | #635147 wiki; xkcd centroid 24.1 away | watch: xkcd 'umber' is an orange-brown (24 away); the paint is right. Most useful color for paintings |
| Mahogany | t3-earths | B · #243 · 0.60* | Maroon (8.5) |  | 1.04 / 1.18 | 0.55 | DF 2 | #6C2E1F pick, xkcd at 11.3 | keep |
| Ash | t3-earths | ? · – · 0.15* | Silver (7.8) |  | 1.23 / 2.01 | 0.28 | F 1 | #B2BEB5 wiki | watch: not an xkcd top name; ashes/tree sense dominates |
| Gunmetal | t3-earths | C · #516 · 0.05 | Charcoal (6.0) |  | 0.86 / 3.04 | 0.81 | D 1 | #2A3439 wiki; xkcd centroid 15.4 away | swap → **Black olive** (or drop) |

### 2.2 The 11 basics (placement only, for context)

The frequency column for basics is raw adjective use. Grey pools grey and gray.

| Basic | Freq | Nearest taught (ΔE) | Owns: lib / paint % | Unique paint % | Hex vs xkcd centroid |
|---|---|---|---|---|---|
| Red | A · #6 · 75.58 | Vermilion (5.1) | 1.04 / 0.22 | 0.01 | #D62F2F, 6.7 |
| Orange | A · #9 · 7.88 | Tangerine (4.9) | 0.71 / 0.03 | 0.0 | #F07A1A, 2.4 |
| Yellow | A · #12 · 27.20 | Gold (3.9) | 0.93 / 0.06 | 0.0 | #F2C81F, 14.7 |
| Green | A · #2 · 50.66 | Jade (6.2) | 0.6 / 0.01 | 0.0 | #2E9A4F, 10.4 |
| Blue | A · #3 · 53.89 | Royal blue (5.1) | 0.15 / 0.0 | 0.0 | #2563C9, 10.7 |
| Purple | A · #1 · 8.64 | Plum (9.0) | 0.75 / 0.0 | 0.0 | #7B3FA0, 5.9 |
| Pink | A · #4 · 13.23 | Puce (7.9) | 0.86 / 0.0 | 0.0 | #F28DB2, 5.1 |
| Brown | A · #5 · 30.04 | Chocolate (8.3) | 1.12 / 3.34 | 0.4 | #7A5230, 9.7 |
| Grey | A · #14 · 40.28 | Slate (8.5) | 1.79 / 1.82 | 0.79 | #8C9096, 5.8 |
| Black | A · #36 · 116.26 | Gunmetal (9.8) | 0.75 / 8.77 | 6.34 | #16171A, 5.1 |
| White | A · #118 · 125.00 | Ivory (5.2) | 0.82 / 0.4 | 0.0 | #F7F6F2, 2.7 |

### 2.3 Pairs that are too close

**Taught to taught.** `tools/check.js` only checks pairs inside one unit, and every pair below is in different units:

| Pair | ΔE00 | Units | Fix |
|---|---|---|---|
| Maroon – Carmine | 6.0 | t2-reds / t3-reds | Carmine → Rose (swap 4) |
| Charcoal – Gunmetal | 6.0 | t2-neutrals / t3-earths | Gunmetal → Green grey (swap 2) |
| Salmon – Terracotta | 6.3 | t2-reds / t3-earths | Terracotta hex → xkcd #CA6641 (13.7 from Salmon, 8.3 from Burnt orange) |
| Rust – Sienna | 6.45 | t2-earths / t3-earths | Watch. Sienna's CSS value sits between rust and brown. The "how it differs" line already says "duller and browner" |

**Watch band, 6.5–8.**
- Burgundy–Carmine 6.6
- Ivory–Ecru 6.7, Beige–Ecru 6.7 (Ecru is squeezed from both sides)
- Azure–Steel blue 6.9, Cerulean–Steel blue 7.0, Cornflower–Azure 7.9 (four mid blues in one unit)
- Indigo–Midnight blue 7.1
- Scarlet–Vermilion 7.2
- Gold–Canary 7.3
- Lime–Chartreuse 7.4
- Tan–Camel 7.5
- Silver–Ash 7.8
- Mint–Celadon 7.9

These pass, but they should not be a learner's first interleaved review pair, and each needs a strong "how it differs" line. Most already have one.

**Taught to placement swatch, under 6.5.**
- Gold–Yellow 3.9
- Tangerine–Orange 4.9 (fixed by moving Tangerine to xkcd #FF9408: 8.8 from Orange, 8.2 from Marigold)
- Royal blue–Blue 5.1
- Vermilion–Red 5.1
- Ivory–White 5.2
- Crimson–Red 5.6
- Amber–Yellow 5.7
- Jade–Green 6.2
- Denim–Blue 6.5

Gold is the only one that is really a problem. CSS gold #FFD700 is a clean yellow on a screen, and the placement Yellow #F2C81F is a golden yellow. One of them should move. The xkcd gold #DBB40C is 4.9 from Mustard, so it doesn't help. The cleaner option is to make the Yellow swatch a purer, lighter yellow. Royal blue has its own problem: CSS `royalblue` is far lighter than what people call royal blue (the xkcd average is 25.5 away). Moving Royal blue toward xkcd #0504AA would also clear Blue, but has to be checked against Cobalt and Indigo first.

### 2.4 Empty regions, and the best names for them

**Weighted by paintings.** Gap colors are corpus palette colors more than ΔE 10 from all 101 app colors: 19.9% of painted area. They were grouped greedily (radius ΔE 8, weighted by area). "Share" is the share of *all* painted area. Candidate names are library names that could be learned (the `learnable()` filter in `tools/library.py`, plus two-word survey names), within ΔE 7 of the center, commonest first.

| Region center | Looks like | Share of all painted area | Nearest app color | Best names (ΔE to center; xkcd rank) |
|---|---|---|---|---|
| #3A2F20 | very dark olive-brown ("warm black") | **7.9%** | Umber 13.0 | Bistre 5.1 (not in xkcd; Ngram band D), Café Noir 5.9. No common word. *Olive drab* in Wikipedia's #7 shade (#3C341F) is 4.1 away, but its sources disagree by ΔE > 25 (§2.6) |
| #5C5A45 | dark greyish olive | **3.1%** | Umber 12.2 | Only Ridgway/RAL/Japanese names (Fuscous, NATO Olive, Rikyūnezumi); Green grey 7.1. Plain English: "dark olive" / "olive grey" |
| #797B62 | mid greyish olive | 1.3% | Taupe 11.8 | Brown Grey 6.8 (#676), Reed Green (Ridgway) |
| #331F15 | very dark red-brown | 1.2% | Oxblood 13.6 | Bistre 4.1, Chocolate Brown 6.7 (#259) |
| #2F321F | very dark green-black | 1.0% | Gunmetal 13.9 | Brown Green 4.8 (#336), Black olive 7.7 |
| #A59D89 | light greige | 0.9% | Taupe 11.2 | Cement 3.3 (#938), **Stone** 4.2 (#552), Putty, Mushroom |
| #636966 | dark neutral grey | 0.9% | Slate 13.1 | **Green grey** 4.4 (#300), Granite grey 4.1, Nickel 5.2 |
| #665C2E | dark muted olive-yellow | 0.8% | Brown 13.0 | Antique Bronze 3.6 (Wikipedia only) |
| #967B41 | golden brown | 0.6% | Sepia 11.4 | Green Brown 4.8 (#294), Honey Yellow 5.2, **Golden brown** (Ngram band A, #380) is 6.3 away |
| #AB7667 | rosy brown | 0.3% | Terracotta 11.5 | Clay 6.2 (#224) |

**Weighted by named color space** (library entries more than ΔE 10 from all 101: 12.8% of names):

| Region center | Looks like | Share of all library names | Best names |
|---|---|---|---|
| #5A6157 | dark greyish green | 1.0% | **Green grey** 0.6 (#300) |
| #93595A | dusty rose-brown | 0.9% | Rose Taupe 1.8 (Wikipedia only), Copper Rose 4.5. *Dusty rose* (#133) is nearby |
| #574E74 | dusky violet | 0.8% | Dusk 5.7 (#600) |
| #643F49 | brownish plum | 0.7% | **Eggplant** 3.4 (#114), but it is a synonym of the taught Aubergine, and the two hexes are 16.0 apart, so the two "eggplants" disagree; Purple Brown 3.7 |
| #63A89D | muted sea-green | 0.6% | Cadet Blue 6.1 (#253), Dull Teal 3.6 |
| #7D6B89 | greyish purple | 0.6% | Grey Purple 1.5 (#250), Dusty Purple 5.8 |
| #3E2C2A | dark brown-black | 0.6% | Chocolate Brown 2.6 (#259), Old Burgundy 1.4, Bistre 5.9 |
| #6E7247 | muted olive green | 0.5% | Muddy Green 5.7, Military Green 6.6 |
| #9F7D2F | dark mustard | 0.5% | Honey Yellow 3.1, Mustard Brown 4.9 |
| #9CB718 | yellow-green | 0.5% | Pea Green 3.7 (#73), Avocado 4.0 (#277), Acid Green 3.9 |

**Random screen colors.** 89.5% are within ΔE 10 already. The largest gaps are a vivid blue-violet ("blurple", xkcd #295), acid yellow-green, vivid purple-magenta ("Byzantine", Wikipedia) and pale cyan-green (seafoam).

**Reading.** Every big gap is low in chroma: olive-blacks, olive-greys, greige and green-greys. The only clear hue gaps are the pale cyan-green (seafoam/aquamarine) and the vivid blue-violet. Painting colors land in exactly the region where English has few common single words. That is why the best names are either rare art terms (bistre) or plain compounds (green grey, olive grey, brown-black).

### 2.5 Obscure picks

- **Band D (neither an xkcd name nor measurable in books):** Byzantium (0 adjective uses per million; the raw word is the empire) and Oxblood (0.001 per million).
  - Oxblood has a real fashion life, in shoes and leather, that 2000–2019 books miss. Keep it only if the card leans on that.
  - Byzantium has no field use at all (score 0).
- **Band C and score ≤ 1 (rare, and only one field):**
  - Cerise (fashion only)
  - Malachite (a pigment, but the hex #0BDA51 is a screen-vivid green, unlike the dull malachite pigment)
  - Thistle (a CSS keyword, almost never said)
  - Amethyst and Mulberry (gem and fruit; as colors they are rare)
  - Gunmetal (also too close to Charcoal)
- **Rare but earning their place:**
  - Umber is the most-used app color in paintings (it owns 9.1% of painted area, and 6.6% is unique to it).
  - Viridian: Monet uses it about 12 times as much as the average painting does.
  - Sepia owns 7.3% of painted area and Camel 8.3%; camel is a staple fashion word that the adjective count misses.
  - Ecru and Celadon are rare but are textile and ceramics terms.
  - These should keep a painting or design line on their cards.
- **Contested meanings.** People disagree about what these names mean, so the card should say which meaning it teaches:
  - Puce: the xkcd average is a brown, 26.7 from the app's dusty pink. Historically puce was a brownish purple.
  - Taupe: Wikipedia's #483C32 is 24.6 away.
  - Umber: the xkcd average is an orange-brown.
  - Mulberry, Plum and Magenta are all darker in the survey.

### 2.6 Suggested swaps and additions

| # | Change | Frequency | Distinctness after | Coverage effect (alone) | Fields | Hex source |
|---|---|---|---|---|---|---|
| 1 | **Add Bistre** #3D2B1F, in an "Earths & shadows" unit, glossed "brown-black" | D (Ngram 0.02/M, falling; not in xkcd). An honest exception: no common word exists for this region | Umber 12.7, Mahogany 14.3 (Black olive 12.4 if added) | Painted area ≤10: 80.1 → **88.0%** (+7.9); ≤8: +8.5; median 7.27 → 6.86 | P (soot-brown drawing ink/pigment) | Wikipedia (single source) |
| 2 | **Gunmetal → Green grey** #5B6259 | B (xkcd "greenish grey" #217, "green grey" #300) | Charcoal 6.0 gone; Green grey's nearest is Hunter green 14.6 | Painted area +2.5 (82.6%); library +1.1 | P D (painters' grey-greens, RAL) | RAL 7009 / xkcd |
| 3 | **Add Stone** #ADA587 | B–C (xkcd #552; a material word, so Ngram is over-counted) | Tan 10.0, Sage 10.5 | Painted area ≤8: 61.5 → 65.2 (+3.7); ≤10: +1.0 | D F (interiors, outdoor clothing) | xkcd |
| 4 | **Carmine → Rose** #CF6275; Carmine goes to the pigment tier | A (xkcd #49; Ngram adjective 1.38 per million, but *rose* is mostly flower or verb) | Maroon–Carmine 6.0 gone; Rose: Cerise 8.1, Puce 10.7 | Library +0.2 | D F E | xkcd average. Wikipedia "Rose" #FF0080 is a vivid pink and disagrees; the card should say which "rose" |
| 5 | **Byzantium → Grape** #6C3461 | B (xkcd #139) vs D | Plum 9.2, Aubergine 13.2 | Unchanged (same spot, ΔE 3.2) | D F E vs none | xkcd |
| 6 | **Malachite → Seafoam** #80F9AD | A (xkcd #70 as "seafoam green") vs C | Mint 8.8, Emerald 11.8 | Library +0.6; random sRGB +0.5 | D F E vs P | xkcd |
| 7 | *Optional:* **add Black olive** #3B3C36 | C (Ngram 0.05/M, also the food) | Charcoal 10.7, Bistre 12.4 | Painted area +2.3 on top of 1–6 (94.2%) | D | Wikipedia / RAL 6015 |
| fix | **Terracotta hex → #CA6641** (xkcd "terracotta") | – | Salmon 6.3 → 13.7 | – | – | xkcd; earthier, closer to fired clay |
| fix | **Tangerine hex → #FF9408** (xkcd) | – | Orange 4.9 → 8.8, Marigold 8.2 | – | – | xkcd |

**All together** (swaps 1–6 and both hex fixes, 92 colors):
- Library ≤10: 87.2 → **90.1%**. Painted area ≤10: 80.1 → **91.9%**. Painted median ΔE 7.27 → 6.51.
- No taught pair is below 6.5 except Rust–Sienna at 6.45.
- Adding Black olive brings painted area to 94.2%.

**Considered and not recommended:**
- **Olive drab** (xkcd #157) would cover the warm-black region well, but only in Wikipedia's "#7" shade. CSS `olivedrab` #6B8E23 and xkcd #6F7632 are a mid green, more than ΔE 25 away, so it fails rule (e).
- **Canary → Lemon** (Lemon is xkcd #313, 2.2 away). The same spot; neither word is clearly commoner. Dropping Canary instead loses only 0.7% of library coverage.
- **Thistle → Heather**: heather is rarer (xkcd #633) and means a mottled grey in knitwear. Dropping Thistle loses 0.3% of library coverage.
- **Oxblood → Wine**: wine (#722F37) is 8.2 from Burgundy and gains no coverage.
- **Eggplant**: a synonym of the taught Aubergine.
- **Sand**: 6.4 from Khaki.
- **Cyan, Fuchsia**: the same hex as Aqua and Magenta. Mention them on those cards as synonyms; don't give them their own cards.
- **Nude**: band A in books, but it assumes one skin tone; skip it.
- **Golden brown** (Ngram 1.05/M, band A) fits the golden-brown painting gap, but adds only +0.2 points. A good later word for the same earths unit.

---

## 3. Caveats

- **Screen hexes are approximations.** Every value here is an sRGB screen value on an uncalibrated display. CSS keywords are exact by definition but often not what people picture. xkcd averages are crowd means over random monitor colors. Ridgway, Werner and RAL values in the library are scans or published approximations. ΔE numbers inherit all of that; a difference under about 2 is noise.
- **Frequency is noisy.**
  - Book counts mix senses (rose the flower, navy the service, slate the rock, petrol the fuel, Byzantium the empire). Adjective tags and color compounds reduce that but don't remove it, and they miss color nouns ("in teal").
  - xkcd ranks are inferred from file order and come from one 2010 online crowd.
  - Neither source measures fashion retail, where oxblood, greige and sage are everyday words.
  - Treat the bands as tiers, not exact rankings.
- **Painted-area weighting** comes from photographs of two museums' collections (Chicago and Cleveland), with aged varnish. It pulls hard toward browns and warm blacks (STATS-FINDINGS §1, §4). The bistre and olive gaps are real on the screen, but partly an effect of age.
- **Fields scores (P, D, F)** are judgment calls. They are listed so they can be argued with.
- **Reproducing.** The analysis scripts were throwaway, kept in the session scratchpad and not committed. The inputs are all in the repo, or cached under `research/_raw/` (`library/xkcd-rgb.txt` and `ngrams/`, one JSON per term with its 1900–2019 series). The method above is enough to rebuild them: CIEDE2000 from `tools/library.py`, the `learnable()` filter, ΔE 10 coverage and greedy grouping at ΔE 8.
