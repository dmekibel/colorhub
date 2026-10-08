# The ColorHub reference library

Built 2026-10-07 by `tools/library.py`. Output: `data/library.json`, 2,711 named colors in 431 KB, one compact JSON object per line. Every download is cached in the gitignored `research/_raw/library/`. (Same day, later: the ISCC-NBS import in §8 below added 4,340 more searchable alternate names to those same 2,711 colors, 792 KB.)

**Why it exists.** The app teaches 101 curated color words (`data/colors.js`). Painting palettes were named with the nearest of those 101 and of the 390-name `data/color-names.json`, and many of those matches were far off: the median painting color sat ΔE 7.3 from its nearest app word and ΔE 5.4 from the 390 list. This library is the second layer, the reference behind the learnable words. Each entry can get an auto-generated page and be searched, and each painting swatch now carries its true nearest library name.

```
python3 tools/library.py              # build data/library.json, then add lib/libDE to data/paintings.js
python3 tools/library.py --build      # library only
python3 tools/library.py --paintings  # painting names only (add --dry -v to print every pick and its candidates)
python3 tools/library.py --report     # the coverage, gap and next-word numbers in this file
```

**Re-run order.** `tools/paintings.py` regenerates `data/paintings.js` and does not know about `lib`/`libDE`. After any `paintings.py` run, run `python3 tools/library.py --paintings` again.

---

## 1. Sources

| `src` | Source | Rows read | Entries that include it | License / provenance | How exact |
|---|---|---|---|---|---|
| `app` | ColorHub's own 101 colors, `data/colors.js` | 101 | 101 | ours | the app's chosen hex. It wins whenever a name is shared, so a library page never contradicts the learnable color |
| `css` | CSS Color Module Level 4 named colors (from X11) | 148 keywords | 141 (the 7 gray/grey spelling pairs are one entry each) | W3C standard; the keywords are facts | exact by definition, though some are odd (CSS `darkgray` is lighter than `gray`) |
| `wiki` | Wikipedia "List of colors" A–F, G–M, N–Z (raw wikitext) | 911 rows, 888 kept | 879 | Wikipedia text is CC BY-SA 4.0. A name-to-hex pair is a fact; credit Wikipedia on any page that shows them. The row's own cited source (Maerz and Paul, ISCC-NBS, Crayola…) is kept in `note` | as cited; 646 rows cite nothing |
| `werner` | Werner's Nomenclature of Colours, 2nd ed. (Syme, 1821) | 110 | 110 | Book: public domain. Hex: Nicholas Rougeux's 2018 digitization (c82.net/werner), via the Graphics-ColorNames-Werner package (CC0 1.0). Table and animal/vegetable/mineral examples from `../color-kb/werner.json` | approximate: sampled from scans of aged, hand-tinted swatches |
| `ridgway` | Ridgway, Color Standards and Color Nomenclature (1912) | 1,117 | 806 | Book: public domain. Hex: the swatch digitization at github.com/davo/Color-Standards-and-Color-Nomenclature (dominant color of each swatch in the Project Gutenberg #63087 plate scans). The repo has no license file; the values are measurements of public-domain scans, and every one was re-measured here (§2) | approximate: uncalibrated scans of 110-year-old plates |
| `jp` | Wikipedia "Traditional colors of Japan" | 228 | 226 | Wikipedia, CC BY-SA 4.0 | as listed. Name = romaji; `jp` holds kanji, romaji and the English meaning. One row's RGB column disagrees with its hex swatch (Sakuranezumi); the hex is used and the difference is in `note` |
| `ral` | Wikipedia "List of RAL colours", RAL Classic section only | 217 | 217 | RAL Classic is a paint standard of RAL gGmbH; names and the approximate screen values are widely published (here, Wikipedia, CC BY-SA). Not official values | approximate; every entry says so in `note` |
| `xkcd` | xkcd color survey (Randall Munroe, 2010), `rgb.txt` | 949 | 923 | CC0 1.0 (stated in the file) | crowd names: real usage, often casual. 28 crude ones ("puke green") are kept with `"crude": 1` so the app can hide them |

**Left out.**
- **Pantone:** proprietary. The 23 Wikipedia rows whose cited source is Pantone are dropped, including the "(Pantone)" variants and names like African violet and Artichoke green whose only value came from Pantone.
- **French and Chinese traditional lists:** optional, and not added in this pass. English Wikipedia has no clean list with documented values for either.
- **Nothing was scraped** from any site whose terms forbid it. The only fetches were Wikipedia raw wikitext, xkcd's published file, GitHub raw files, and one Internet Archive copy used to check Ridgway.

## 2. Ridgway: which hex values are trustworthy

Ridgway's plates fade and differ from copy to copy, and no museum-grade measurement of all 1,115 colors is openly published. The best open digitization is davo's: each swatch was cut from the Gutenberg plate scans and given its dominant color. Three checks were run on it, and a name is kept only if it passes all three:

1. **Re-measurement.** For every swatch image, the median color of the central 70% (in CIELAB) is within ΔE 3 of the published hex. All 1,117 pass (the largest difference is 1.7), so the extraction is sound.
2. **One swatch, one name.** 16 names share an identical hex with another name, which shows that one crop was assigned to two names. For example, Neutral Gray has the same hex as White, and Indulin Blue the same as Venetian Blue. All 16 are dropped.
3. **Independent agreement.** Kelly & Judd's *ISCC-NBS Dictionary of Color Names* (NBS Circular 553, 1955; US government, public domain) assigns each Ridgway name to one or more of the 267 ISCC-NBS color categories. Those assignments rest on Hamly's 1949 Munsell measurements of the actual plates. The check uses D. Mundie's and J. C. Foster's digitization of the dictionary, with Foster's centroid colors (Internet Archive copy of tx4.us/isccnam.htm). It is used here only as a check and is not redistributed. A Ridgway hex is kept when it is within ΔE 10 of a centroid the dictionary assigns to that name, or when that centroid is one of the 2 nearest of all 267. The second test is needed because vivid centroids are clipped in sRGB.
   - 72 names are not in the dictionary, mostly the numbered duplicates like "Blackish Brown (3)". They are dropped.
   - 223 names disagree and are dropped. Most of them are blues and violets from the aniline-dye plates, which have shifted (Light Blue-Violet is off by ΔE 38, Salvia Blue by 37), plus the plate-LIII greys and the misplaced crop Light Corinthian Red.

**Result:** 806 Ridgway names are kept, every one marked "scan of an aged plate, approximate" in `note`, with its plate, hue and tone. They help most in the dull browns, drabs and olive-greys, which is exactly where paintings live.

## 3. Merge rules

- **Names** are title-cased, with minor words lower case ("Café au Lait", "Bleu de France"), internal capitals kept ("YInMn Blue") and "Gray" spelled "Grey", as in the app. Japanese romaji keep their own form ("Momo-iro").
- **Same name, same entry.** Two rows are the same color name if they match after dropping case, accents, spaces, hyphens, slashes and apostrophes, and treating gray as grey. So xkcd's "blue grey", "bluegrey" and "blue/grey" join Wikipedia's "Blue-gray" and RAL's "Blue grey" in one entry, Blue-Grey; and Olive Green carries Wikipedia, Werner, Ridgway, RAL and xkcd, with the four hexes that differ in `alts`. The display spelling comes from the highest-priority source, and within one source a spaced name beats a slashed or run-together one.
- **Which hex wins:** app > css > wiki > werner > ridgway > jp > ral > xkcd. Every source is listed in `src`. Any other source whose hex differs from the winner by more than CIEDE2000 3 is kept in `alts` as `[src, hex]`. 383 entries have alts; for example Plum keeps CSS's pale #DDA0DD (also Wikipedia's "Plum (web)") next to the app's #8E4585.
- **Wikipedia qualifiers.** "(web)" and "(X11)" are dropped when the plain name is a CSS keyword with the same hex, so the row merges with css. Otherwise they stay, because the value differs: "Purple (X11)", "Maroon (X11)". Other qualifiers stay too: "Red (Munsell)", "Lavender (Floral)". Synonym parentheses are resolved ("Ocher (Ochre)" becomes Ochre).
- **Different names for nearly the same color all stay.** They are synonyms, and searching any of them should work.
- **Computed for every entry:** CIELAB (D65), and from it `lch` = [L\*, C\*, h°] (rounded). `fam` is the app's rule from `js/gym.js` (`family`), with its "Greys" called "Neutrals". `app` is the nearest of the 101 app colors with its CIEDE2000.
- **Order:** by family (Reds, Pinks, Oranges, Browns, Yellows, Greens, Blues, Purples, Neutrals), then hue, with Reds and Pinks unwrapped across 0°. Neutrals are sorted light to dark, since their hue angle is mostly noise.

**Record format** (`data/library.json`):

```
{"n":"Tile Red","h":"#C76B4A","src":["werner"],"fam":"Oranges","lch":[55,48,46],"app":["Terracotta",6.8],
 "werner":{"animal":"Breast of the Cock Bullfinch","vegetable":"Shrubby Pimpernel","mineral":"Porcelain Jasper"},
 "note":"Werner no. 82 (Reds), aged swatch, approximate"}
```

Optional fields: `alts`, `werner` {animal, vegetable, mineral}, `jp` {kanji, romaji, meaning}, `note` (provenance: Wikipedia's cited source, Werner number, Ridgway plate/hue/tone, RAL number), `crude`.

| Family | Entries | | Sources per entry | Entries |
|---|---|---|---|---|
| Greens | 589 | | 1 | 2,278 |
| Reds | 416 | | 2 | 254 |
| Neutrals | 400 | | 3 | 112 |
| Purples | 335 | | 4 | 54 |
| Blues | 268 | | 5 | 13 |
| Yellows | 259 | | | |
| Oranges | 223 | | | |
| Browns | 155 | | | |
| Pinks | 66 (the app's rule only calls light reds and light purples pink) | | | |

## 4. Paintings: the true nearest name

All 137 swatches of the 22 painting pages now carry `lib` (the nearest library name) and `libDE`, next to the existing `name`/`dE` and `vocab`/`vocabDE`, which are unchanged. The median distance falls from ΔE 5.5 (curated `name`) to **2.6**, and the worst case from 12.4 to 9.3. That worst case is a near-black olive in the Arnolfini Portrait, a region with no close name anywhere (§6).

The nearest name is used unless it is a poor label on a painting page. In that case the closest good name within ΔE +2 of it is used instead. Poor labels are:
- crude survey names;
- Wikipedia-only brand, crayon and novelty names (the BLOCK list in `tools/paintings.py`, e.g. Quick Silver, Prairie Gold, Ming);
- variants with qualifiers ("Grey (X11 Grey)");
- RAL signage and effect paints (Traffic Black, Telegrey 2, Pearl Gold);
- casual survey forms (Greyish, Bluey Grey);
- CSS "Dark Grey", which is lighter than Grey.

Japanese names are kept for the Hokusai and are second choice on Western works. Pigment names newer than the work are skipped (the `PIGMENT_SINCE` list in `tools/paintings.py`), and no name is used twice in one palette.

Every place where the plain nearest name was passed over has a trailing `// lib: rule: …` comment in `data/paintings.js` (26 swatches). The 6 hand overrides have a `// lib: hand: …` comment and are listed in `LIB_OVERRIDES` in `tools/library.py`. Four of them settle ties or near-ties in favor of the plainer name: Bistre Brown over Sand Dune, Golden Brown over Dresden Brown, Moss Green over Turtle Green, Sage Green over Deep Malachite Green. Taupe replaces Pearl Beige, which is a pearlescent car paint. Ink Black replaces the purple names on the Mona Lisa's dress, the same call `paintings.py` made. `node tools/check_wiki.js` reports 0 failures.

Most picks are Ridgway and Werner names (Gendarme Blue, Buffy Brown, Hay's Russet, Pale Drab-Grey), because those books named exactly the muted colors paintings are made of. Where no English name comes close, a Japanese one sometimes wins on a Western painting: Sumi-iro (ink black) for the dark background of the Girl with a Pearl Earring, ΔE 4.4 against Bistre's 7.7. That was left as is. It is accurate, and a library page can explain it.

## 5. Coverage

Distance from a color to the nearest name in each set (CIEDE2000). Lower is better. A distance of about 2 is "the same color" on a screen; at 5 you can clearly see a difference.

**2,000 random sRGB colors** (uniform in the RGB cube, seed 7):

| Name set | median | p75 | p90 | p95 | max | ≤2 | ≤3 | ≤5 | ≤10 |
|---|---|---|---|---|---|---|---|---|---|
| Reference library, all sources (2,711) | 2.3 | 3.1 | 3.9 | 4.3 | 8.4 | 38% | 72% | 98% | 100% |
| Library without xkcd (2,105) | 2.8 | 3.8 | 4.7 | 5.4 | 8.4 | 27% | 55% | 93% | 100% |
| color-names.json (390) | 4.3 | 5.7 | 7.0 | 7.9 | 11.2 | 9% | 24% | 63% | 99% |
| App words (101) | 6.4 | 8.4 | 10.0 | 11.1 | 15.9 | 3% | 9% | 30% | 90% |

**28,067 painting palette colors** (the 4,655 corpus paintings × 6, plus the 22 painting pages):

| Name set | median | p75 | p90 | p95 | max | ≤2 | ≤3 | ≤5 | ≤10 |
|---|---|---|---|---|---|---|---|---|---|
| Reference library, all sources (2,711) | 2.3 | 3.0 | 3.7 | 4.1 | 9.8 | 37% | 75% | 98% | 100% |
| Library without xkcd (2,105) | 2.4 | 3.1 | 3.8 | 4.3 | 10.0 | 34% | 71% | 98% | 100% |
| color-names.json (390) | 5.4 | 7.0 | 8.5 | 9.4 | 14.1 | 5% | 14% | 44% | 97% |
| App words (101) | 7.3 | 9.4 | 11.5 | 12.7 | 18.8 | 1% | 5% | 21% | 80% |

On paintings, the crowd names barely matter: without xkcd the median only moves from 2.3 to 2.4, because Ridgway and Werner already cover the muted range. On random screen colors xkcd helps more (2.3 against 2.8), since it names many vivid screen colors.

## 6. Gaps: where no name is close yet

**Random sRGB.** 7.7% of 40,000 random colors are over ΔE 4 from every name, and 0.4% are over ΔE 6. The uncovered regions are almost all vivid screen colors that no paint or dye book names:

| Region centre | Uncovered colors | Looks like | Nearest name (ΔE) |
|---|---|---|---|
| #5318AC | 220 | dark vivid purple | Blue Purple (5.7) |
| #3BDEB6 | 173 | light strong cyan-green | Medium Aquamarine (5.1) |
| #37B2C0 | 122 | light muted cyan-blue | Bremen Blue (5.1) |
| #356A28 | 99 | dark strong green | Pakistan Green (5.7) |
| #78ECE5 | 97 | very light strong cyan | Turquoise (5.5) |
| #8DD975 | 95 | light strong green | Light Green (5.2) |
| #977EE9 | 78 | mid vivid purple | Medium Purple (4.7) |
| #CB17B7 | 73 | mid vivid magenta | Purpley Pink (3.5) |
| #F8A6EC | 72 | light strong magenta | Rose-Purple (4.2) |
| #4E1E6A | 67 | very dark strong purple | Petunia (4.6) |

**Paintings.** Only 1.6% of painting colors (460 of 28,067) are over ΔE 5 from every name. Almost all of them are **very dark, slightly colored blacks**: the brown-black and olive-black of old varnished backgrounds and shadows.

| Region centre | Palette colors | Looks like | Nearest name (ΔE) |
|---|---|---|---|
| #252012 | 217 | very dark olive-brown black | Sumi-iro (6.6) |
| #3D2A0E | 77 | very dark warm brown | Café Noir (5.0) |
| #353519 | 49 | very dark olive | Olive Drab #7 (6.2) |
| #192113 | 26 | very dark green-black | Dark Jungle Green (6.5) |
| #46250F | 22 | very dark orange-brown | Seal Brown (5.8) |

No source names this "warm black" band well; the nearest English names (Bistre, Black Olive) are ΔE 7 to 10 away. A future tier could teach the plain-English pair *brown-black* / *olive-black* for it, and the library could add a sourced name here if one turns up.

## 7. The 40 most useful next learnable words

**Question:** which words would name the most painting color that the 101 app words leave unnamed?

**Method** (`report()` in `tools/library.py`):
1. Take all 28,067 palette colors and keep those over ΔE 8 from every app word: 40% of colors, 39% of painted area.
2. Draw candidates from the learnable names: at most two words; not a lightness or strength modifier on a color ("Dark Olive", "Greyish Blue"); not silly, a variant, a crayon-only name or a brand; not already an app word, and at least ΔE 6 from every app word. The name must also be in Wikipedia's list or CSS, or in two sources, or be a one-word survey noun ("Cement", "Clay"). A name found only in Ridgway, Werner, RAL or the Japanese list is a fine reference name but not yet everyday vocabulary. That leaves 201 candidates.
3. Pick greedily. Each round takes the word that covers the most still-uncovered painted area. A word covers a color when it is within ΔE 6 of it and closer to it than any app word. Each new word must also be at least ΔE 6 from the words already picked, so all 40 can be told apart.

Together the 40 cover 53% of the uncovered painted area. The column "area" is the share of all painted area that the word newly covers; "paintings" counts the works that contain such a color.

| # | Word | Hex | Family | Area | Paintings | Nearest app word (ΔE) | Sources | Review |
|---|---|---|---|---|---|---|---|---|
| 1 | **Bistre** | #3D2B1F | Browns | 4.74% | 955 | Umber (12.7) | wiki | The soot-brown of old drawings and dark grounds. The biggest single gap |
| 2 | **Black Olive** | #3B3C36 | Neutrals | 2.46% | 592 | Gunmetal (8.1) | wiki, ral | The olive-black of shadows |
| 3 | **Cement** | #A5A391 | Neutrals | 2.07% | 600 | Ash (9.8) | xkcd | Greenish light grey; *stone* is the nearby alternative |
| 4 | **Granite Grey** | #676767 | Neutrals | 1.18% | 391 | Umber (11.7) | wiki, ral | A plain mid grey; the app has no neutral mid grey |
| 5 | **Green Brown** | #887142 | Browns | 1.16% | 336 | Sepia (8.5) | ral, xkcd | Plain compound; painters say *raw umber* for this side |
| 6 | **Olive-Brown** | #715F4A | Browns | 1.02% | 327 | Umber (7.2) | ridgway, ral, xkcd | |
| 7 | **Mocha** | #9D7651 | Oranges | 0.89% | 240 | Sepia (6.1) | xkcd | *Café au lait* (ΔE 3.4) works too |
| 8 | **Green Grey** | #5B6259 | Neutrals | 0.89% | 281 | Hunter green (14.6) | ral, xkcd | Plain compound |
| 9 | **Liver Brown** | #513E32 | Browns | 0.83% | 231 | Umber (6.5) | werner, ridgway | |
| 10 | **Mushroom** | #BA9E88 | Oranges | 0.67% | 218 | Camel (7.6) | xkcd | Interior-design word |
| 11 | Davy's Grey | #555555 | Neutrals | 0.51% | 141 | Umber (9.6) | wiki | A paint name (Davy's grey is made from powdered slate) |
| 12 | Oil Green | #AB924B | Yellows | 0.41% | 138 | Camel (9.0) | werner, ridgway | Archaic |
| 13 | Antique Bronze | #665D1E | Browns | 0.39% | 119 | Olive (14.3) | wiki | |
| 14 | Leaf Green | #607059 | Greens | 0.31% | 97 | Hunter green (11.3) | ridgway, ral, xkcd | |
| 15 | Honey Yellow | #A77D35 | Yellows | 0.30% | 106 | Ochre (10.9) | werner, ridgway, ral | |
| 16 | Redwood | #A45A52 | Reds | 0.28% | 126 | Sienna (10.5) | wiki | |
| 17 | Grey Brown | #3F3A3A | Neutrals | 0.25% | 60 | Gunmetal (9.2) | ral, xkcd | Plain compound |
| 18 | Clay | #B66A50 | Oranges | 0.23% | 108 | Terracotta (9.3) | xkcd | |
| 19 | Battleship Grey | #848482 | Neutrals | 0.23% | 73 | Grey (6.1) | wiki, xkcd | |
| 20 | Sand | #C2B280 | Yellows | 0.16% | 44 | Khaki (6.4) | wiki, xkcd | |
| 21 | Bole | #79443B | Reds | 0.15% | 73 | Mahogany (7.3) | wiki | The red clay under gilding: a good art-history word |
| 22 | Duck Green | #33431E | Greens | 0.14% | 39 | Hunter green (10.3) | werner, ridgway | Archaic |
| 23 | Sage Green | #80967B | Greens | 0.13% | 46 | Sage (8.6) | ridgway, xkcd | Close to the app's Sage; could replace or sit beside it |
| 24 | Payne's Grey | #536878 | Blues | 0.11% | 42 | Denim (8.2) | wiki, ridgway | A paint name every watercolourist knows |
| 25 | Golden Brown | #996515 | Browns | 0.10% | 36 | Sepia (11.6) | wiki, xkcd | |
| 26 | Cadet Grey | #91A3B0 | Neutrals | 0.10% | 26 | Grey (7.7) | wiki, ridgway | |
| 27 | Seal Brown | #59260B | Browns | 0.10% | 37 | Mahogany (6.3) | wiki, ridgway | |
| 28 | Old Burgundy | #43302E | Neutrals | 0.07% | 23 | Umber (11.7) | wiki | |
| 29 | Copper Rose | #996666 | Reds | 0.07% | 34 | Mauve (11.6) | wiki | |
| 30 | Silver Pink | #C4AEAD | Neutrals | 0.06% | 14 | Silver (10.1) | wiki | |
| 31 | Rosy Brown | #BC8F8F | Reds | 0.05% | 20 | Puce (7.4) | css, wiki | |
| 32 | Cinereous | #98817B | Neutrals | 0.05% | 17 | Taupe (6.6) | wiki, ridgway | Latin "ash-coloured"; obscure |
| 33 | Fern Green | #4F7942 | Greens | 0.04% | 12 | Forest green (10.1) | wiki, ral, xkcd | |
| 34 | Ochre Yellow | #EFCC83 | Yellows | 0.04% | 13 | Beige (8.9) | werner, ral | |
| 35 | Cool Grey | #8C92AC | Blues | 0.04% | 7 | Grey (8.6) | wiki, xkcd | |
| 36 | Phthalo Green | #123524 | Greens | 0.04% | 10 | Hunter green (13.8) | wiki | Pigment from 1938: only for modern works |
| 37 | Raw Sienna | #D68A59 | Oranges | 0.03% | 13 | Ochre (8.6) | wiki, ridgway, xkcd | A classic earth pigment |
| 38 | Hazel | #8E7618 | Browns | 0.03% | 9 | Olive (8.1) | xkcd | |
| 39 | Winter Green | #6A8F69 | Greens | 0.03% | 11 | Moss (10.1) | ridgway, xkcd | *Russian green* is ΔE 1.8 away |
| 40 | Old Lavender | #796878 | Neutrals | 0.03% | 8 | Mauve (13.2) | wiki | The violet-grey of Monet's London skies |

`Pullman Brown` (UPS brown) came out 13th in an earlier run and is excluded as a brand color (`LEARN_SKIP`).

**What this says about the curriculum.** The gaps are not in hue. They are in the **dull, dark and greyish** range: warm blacks, olive-greys, drab browns and mid greys. The app has rich hue words (cerulean, vermilion) but only Umber, Taupe, Sepia, Charcoal, Gunmetal, Slate and Grey to cover the half of painting color that is muted. The first ten words alone (Bistre to Mushroom) newly name 15.9% of all painted area, about 40% of the area the app words leave unnamed. A third-tier unit like "Earths and shadows" (bistre, black olive, olive-brown, liver, mocha, mushroom, granite grey, cement) would do more for naming paintings than any further hue word.

## 8. ISCC-NBS import (2026-10-07)

Added by `tools/iscc_nbs.py` (extraction) + `merge_iscc_nbs()` in `tools/library.py` (merge), per the plan in `research/NAME-SOURCES.md`. Source: NBS Circular 553 (Kelly & Judd, 1955), public domain — see `tools/iscc_nbs.py`'s module docstring for the full extraction method, the OCR-cleanup evidence for the 267 block centroids, and the spot-check result.

**Extraction.** `data/sources/iscc-nbs-names.json`: 8,790 raw name/source/block rows kept (2,580 dropped for no block number — mostly pure "(see X)" redirects with no designation of their own; 807 dropped for no recognizable source code; 192 dropped as implausible names (including 2 rare column-slicing clips -- see tools/iscc_nbs.py TRUNCATED_WORD_START)), grouped into **5,657 unique dictionary names**, each with its primary ISCC-NBS block (1-267), every distinct block it's cited under, and the source code(s) (M/R/P/T/TC/A/B/F/H/MUP/PSP/RC/S/SC). `data/sources/iscc-nbs-centroids.json`: all 267 official Munsell block centroids, converted to sRGB (62 fall outside the gamut and are clamped, mostly vivid/peripheral blocks).

**Merge rule** (`merge_iscc_nbs()`, CIEDE2000 attach threshold 8): of the 267 blocks, 247 had at least one dictionary name pointing at them (20 blocks — mostly narrow compound modifiers like "very deep yellowish pink" — have none).

| | names | result |
|---|---|---|
| 1. Already in the library (name match) | 1,297 | that entry's `src` gains `"iscc-nbs"`, `note` gains an "ISCC-NBS 1955 block N (codes)" fragment. No new bubble. |
| 2. Not a name match, existing color within ΔE00 8 of the block centroid | 4,340 | attached to that entry's `altn` (alternate names), each `{n, src: "iscc-nbs", note}`. No new bubble. |
| 3. Neither | 0 | would have created one new entry at the block centroid — never needed; the library was already dense enough (median ΔE 2.3 to nearest name, see §5 above) that every one of the 267 blocks had an existing color within 8 of its centroid. |

**Before -> after:**

| | before | after |
|---|---|---|
| Distinct colors (bubbles) | 2,711 | **2,711 — unchanged** |
| Searchable names (primary + alternates) | 2,711 | **7,051** (2,711 primary + 4,340 ISCC-NBS alternates) |
| `data/library.json` size | 431 KB | 792 KB |
| `tools/name_coverage.py`, 2,711-name row | median ΔE 2.4, 98% within 5 | **identical** (no new colors were added, so color-coverage distances don't move; this import added names and provenance, not new hues) |

The honeycomb itself is unchanged (same 2,711 bubbles); 1,297 of them now carry 1955 government provenance in their `note`, and 4,340 historical names (Jonquil, Navaho, Persimmon Orange, Aurantiacus, Kis Kilim…) are newly searchable and show "Also called …" on the colors they're synonyms of (`js/colorsets.js` `csMatch()`/`colorSheet()`/`altnLine()`).

**Spot-check and known limitation.** Extracted entries were checked by eye against rendered page images (`pdftoppm`) across 12 randomly chosen dictionary pages, ~190 individual name/source/block triples. Every block number that came through was correct, with one exception found this way: a handful of names whose designation got OCR'd with the munsell modifier letters "l"/"O" misread as the digits "1"/"0" ("l.Ol 106" → "1.01 106") picked up a false extra block ("1", i.e. "vivid pink") ahead of the real one -- `block_numbers()` now only accepts a bare, whitespace-delimited digit token as a block number, which fixed the great majority of these (e.g. Citrine: was wrongly block 1, is now correctly block 106, "light olive"). One rarer variant survives this fix: an entry whose designation is itself truncated by a page or column edge right after the source code, with an unrelated later line's number getting pulled in as if it were confirmation (e.g. "Glaucous", `src: M`, kept block 1 instead of the correct 121 from its own `R`-sourced listing). Found by eye, not systematically; a general positional rule for it was tried and reverted (it broke more legitimate multi-line layouts than it fixed, given how differently entries wrap across physical lines). Affects roughly 19 of 5,657 names (0.3%) by rough estimate -- a known, accepted residual, consistent with "prefer dropping uncertain entries over importing garbage" where it could be caught, and left documented where it couldn't.

## 9. Historical pigment names (2026-10-09)

Added by `load_pigments()` in `tools/library.py`, per the plan in NOTES-TRACKER.md. Source of the NAMES: David's private notes on the pigment compendium and Chromatopia (`../color-kb/books/notes/pigment-compendium.jsonl`, `chromatopia-coles.jsonl`) -- every pigment name mentioned in either file was checked against the library as it stood before this pass (both primary names and ISCC-NBS `altn` synonyms). Only names present in *neither* were candidates.

**Hex values never come from the books** (CLAUDE.md's copyright "Book rule"): each candidate was checked against Wikidata's P465 ("sRGB color hex triplet") and, failing that, a standalone Wikipedia article with its own color infobox (distinct from the "List of colors" pages `wiki` already scrapes). Only **5 of roughly 30 candidate names** turned out to have a public, citable value; the rest are real pigments with no public swatch value anywhere checked, so they were left out rather than guessed:

| Name | Hex | Public source |
|---|---|---|
| Egyptian Blue | #1034A6 | Wikidata P465, wikidata.org/wiki/Q253181 |
| Smalt | #003399 | Wikidata P465, wikidata.org/wiki/Q898977 |
| Titanium White | #FFFEEF | Wikidata P465, wikidata.org/wiki/Q3639460 |
| Brunswick Green | #1B4D3E | Wikipedia color infobox, en.wikipedia.org/wiki/Spring_green |
| Green Earth | #DADD98 | Wikipedia color infobox, en.wikipedia.org/wiki/Green_earth |

Checked and skipped for having no public hex anywhere (Wikipedia article, Wikipedia "List of colors", or Wikidata P465): Orpiment, Realgar, Antimony Vermilion, Asphaltum, Atacamite, Azurite, Bice, Bideford Black, Chrysocolla, Flake White, Garancine, Greenockite, Han Blue, Han Purple, Iodine Scarlet, Lazurite, Lead White, Lead-Tin Yellow, Manganese Blue, Mauveine (no hex distinct from Mauve), Potter's Pink, Pyrrole Red, Vantablack, Vine Black, Bone Black/Ivory Black. Several of these (Orpiment, Realgar, Egyptian Blue, Smalt before this pass) were already *searchable* only as ISCC-NBS `altn` synonyms attached to an unrelated nearby color by block-centroid proximity, not a value sourced to that pigment specifically -- adding Egyptian Blue and Smalt as their own entries let the next `--build` reattach their ISCC-NBS block citation to the real pigment color instead (see each entry's `note`).

**Before -> after:** 2,711 -> **2,716** entries (+5), 792 KB -> 794 KB.

## 10. Maerz & Paul 1930 plate digitization (2026-10-07) -- extracted, not yet merged

Follows the plan in this file's own §1 recommendation and `research/NAME-SOURCES.md` ("flag as a future
digitization project"). Full detail -- the source hunt (the only usable scan is IA's *un*processed original JP2
tar, not its own desaturated derivative), the grid-reading and white-balance method, the ISCC-NBS independent
accuracy check, the paper-transmission gamma fit, and the spot check -- is in `research/MAERZ-PAUL.md`.
Extraction: `tools/maerz_paul.py` -> `data/sources/maerz-paul-1930.json`. Merge code: `merge_maerz_paul()` in
`tools/library.py` (same 3-way rule as ISCC-NBS's own merge, but with a tighter ΔE00 2.5 "new color" threshold,
since these are real per-chip measurements rather than coarse block centroids).

**55 of 56 plates recovered** (Plate 2 is missing from the only available scan -- two physical pages never
photographed), **825 named chips extracted**, **374 independently cross-checked** against the 1955 ISCC-NBS
dictionary's own Maerz & Paul-sourced names: 37% agree within ΔE00 8 of their assigned block, median ΔE00 9.7;
58 chips (16% of the 374) are flagged `"uncertain"` and excluded from any merge. A direct 30-name spot check
(`research/MAERZ-PAUL.md` §7) found a handful of plausible-looking but fabricated names the ISCC-NBS check
cannot catch (two different cells' text merged by OCR, e.g. "Maracail Domingc") — **this import did not cleanly
pass its own "reads right" bar, so `data/library.json` was left untouched (still 2,711 entries) rather than
merged.** The extraction, its documentation and the merge code all ship from this pass; running the merge is
left for a follow-up once the extraction has either a tighter cross-cell-bleed filter or a manual review pass.
