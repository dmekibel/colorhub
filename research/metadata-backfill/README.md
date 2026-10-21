# Metadata backfill, phase 1 (fetch and prepare), 2026-10-21

Nothing under `data/` was touched. This folder holds what Wikidata (CC0) says about every painter and painting in the archive, and
`tools/apply_backfill.py` is the phase-2 tool that writes it into `data/corpus/*.json` (not yet run on `data/`; tested on two copied files).

## How country, movement and year are derived today
- `co`, `y`, `mv` are fields of each `data/corpus/*.json` row. `tools/gallery.py` copies them into `data/gallery/index.bin` (year) and
  `d/NNN.json` (country, movement); `tools/facets.py` turns them into `data/facets/facets.bin` + `facets.json` (the 46 countries, 19 movements).
- Museum rows (Rijks, SMK, AIC, Cleveland, NGA, Met) get `co` from the museum's place/culture/nationality field through `COUNTRY_RULES` in
  `tools/corpus.py` ("modern country where made"). Commons rows with a Wikidata item (`commons-Q...`) get `co` only from the painting's
  own country-of-origin (P495), which is rarely set, hence 36,956 of 46,821 older rows with none. Commons category rows (`commons-F...`, 31,719)
  have no country at all and 14,175 have no year. Movement comes from the AIC style only (803 rows); a separate painter-level
  `data/artists/movements-wd.json` feeds `tools/analyze.py` but never the row field.
- Year is already Wikidata P571 for QID rows, so P571 adds almost nothing there.

## What was fetched (all cached in the scratchpad, politely: UA `Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) python-requests`, maxlag=5, Retry-After honored, 1.7 req/s at most, 1-2 workers)
| Step | Script | Requests |
|---|---|---|
| gallery rows (114,046 unique ids; 67,890 distinct QIDs) | `p0_rows.py` | 0 |
| painting facts: P170 creator, P571, P135, P495, P195, P136 | `p1_paintings.py` | 1,358 wbgetentities x50 |
| painter QID = majority P170 creator of the label's QID rows; rest by exact en label / alias in SPARQL VALUES (60 per query), date-checked | `p2_painters.py` | about 90 SPARQL |
| second chance for spelling variants: wbsearchentities, occupation + life-dates check | `p2b_search.py` | 685 searches + 36 entity batches |
| painter entities (P19, P27, P135, P569/70, P21), places and countries (P17, climbing P131 past historical states), labels | `p2_painters.py` | about 300 wbgetentities |
| Commons-file dates (DateTimeOriginal) for rows without a Wikidata item or year | `p4_commons_dates.py` | about 710 Commons API calls |
| assemble outputs | `p3_build.py` | 0 (offline) |

Re-run any step: they resume from the cache (`BF_SCRATCH` env var sets the cache folder).

## Painter match rates (`painters.json`)
- 7,855 painter labels, **7,457 matched (94.9% of painters, 99.4% of the 108,330 named paintings)**.
  By route: 5,235 creator vote (confidence = share of the label's QID rows, mostly 1.0), 1,915 exact label/alias with life-dates check, 304 search, 13 weak ties.
  Sanity check: for 95.6% (creator) to 99.5% (label) of matched painters with years, at least 90% of their painting years sit inside birth+5..death+40.
- 388 unmatched (1,323 paintings). `top100_unmatched` in painters.json lists them by painting count: mostly diacritic/transliteration variants and
  CJK names (Xugu 16, Shibata Zeshin 15 in the first pass, Kawanabe Kyosai 9, Rembrandts skole 6), "school of" and anonymous masters; a manual alias list for the top 100 would add about 600 paintings.
- Fields on matched painters: country 7,061 (6,622 birth country directly, 372 via citizenship P27, 67 via a historical-state table or P131 climb), birth year 6,902, movement 1,475 (folded to the app's names with `fold_movement`), gender 7,364 (**338 women, 2,179 paintings = 2.0%**; the audit's 34 was only the page-level subset).
- `confidence` = match confidence x (1.0 for a clean birth country, 0.8 for fallbacks).

## Policy decisions made (override in apply with flags)
1. **Country = painter birth country (P19 -> P17, modern country), fallback citizenship** as in the audit. Known oddities this produces (all faithful to birthplace):
   Sargent -> Italy (Florence), Rubens -> Germany (Siegen), Pissarro -> United States (St Thomas), Kandinsky -> Russia, Hayez -> Italy. `painters.json` also carries
   `country_p27` (citizenship) so `--co-policy citizenship` is one flag; 7,812 blank-country rows would differ (examples in projection.json `birth_vs_citizenship`),
   and `--co-policy existing-majority` uses the painter's most common existing label instead.
2. **Existing names never relabeled, existing values never overwritten.** A painter whose rows already say Russia keeps Russia when Wikidata puts the birthplace
   in Ukraine/Belarus/the Baltics (Repin, Aivazovsky; 38 painters, `country_note`). Every other new-country painter gets the plain English name.
3. **New countries that appear** (clearly named, not in the app's 46): Ukraine 633, Belarus 291, Latvia 108, Lithuania 75, Slovakia 54, Philippines 9, Slovenia 9,
   Indonesia 9, Malta 3, Suriname 2, Chile 1, El Salvador 1, Guyana 1. David should confirm Ukraine/Belarus/Baltics before apply (the app currently counts them as Russia);
   the UI country lists/flags need the new names (tools/check.js will say).
4. Movements: painting P135 where it exists (3,959 rows), else the painter's movement ONLY when the painter has exactly one (54,604 rows, tagged `ms: "painter"`; `--mv painting` ignores these).
   Names are folded to the app's existing spelling ("Barbizon School"), so "Baroque", "Renaissance", "Impressionism", "Realism", "Romanticism", "Symbolism", "Rococo"... enter the movement list (the audit's missing ones).
5. Years: P571 with year precision, decade precision as a midpoint (`ya: 1`), nothing coarser. Non-QID rows: Commons file date (`ys: "commons-date"`), then a year printed at the end of the title (`ys: "title"`, weakest).
   Any year outside the painter's life (birth+6 .. death+3) is rejected (470 rejected). Disabled per source with `--years`.

## Projection (paintings.json, rows blank today -> filled)
114,046 rows. **Country 40,928 -> 111,247 (35.9% -> 97.5%)**; +70,319 rows. **Year 92,279 -> 94,230** (+1,951: 1,846 title, 82 Commons date, 23 P571; the rest of the 19.8k blanks have no date anywhere in Wikidata or the file name). **Movement 803 -> 59,366** (+3,959 painting, +54,604 painter-level).
Extra fields (new, not in rows): collection (P195) for 60,109 rows, genre (P136) for 40,498.

| Country | Before | After |
|---|---|---|
| Italy | 3,624 | 30,997 |
| France | 7,252 | 18,393 |
| Netherlands | 8,378 | 12,247 |
| Russia | 1,326 | 9,649 |
| United Kingdom | 1,830 | 5,360 |
| Germany | 1,879 | 5,178 |
| United States | 3,423 | 5,093 |
| Spain | 2,662 | 3,945 |
| Belgium | 1,190 | 3,142 |
| Sweden | 2,266 | 2,949 |
| Austria | 1,777 | 2,532 |
| Poland | 137 | 2,496 |
| Denmark | 1,895 | 2,115 |
| Norway | 245 | 1,140 |
| Estonia | 5 | 834 |
Top 15 before: Netherlands, France, Italy, United States, Spain, Sweden, Denmark, Germany, United Kingdom, Austria, Russia, Belgium, India 727, Japan 697, China 635 (India/Japan/China stay as they are; museum-labeled). Full numbers in `projection.json`.
Italy's 30,997 is the archive's real shape (the Italian batch plus Tintoretto, Titian...), not a labeling artifact; Britain and the USA stay low because we simply hold few of their paintings (audit: 9.5% and 6.5% recall).

## Disagreements (existing non-blank value vs Wikidata; never overwritten)
- Country vs painter birth country: 6,277 rows (top pairs: Netherlands->Belgium 2,810 (Flemish painters the Rijksmuseum labels Netherlands), Netherlands->Germany, France->Russia, France->Italy,
  Austria->Italy). Mostly "where made" (museum rule) versus "where born" (our policy). 20 examples in `projection.json`.
- Country vs painting's own P495: 4 rows. Year vs P571: 124 rows differing by more than 10 years. Movement vs P135: 0 rows (no row with an existing movement carries a different P135).

## Apply recipe (phase 2, needs David's go-ahead on the Ukraine/Belarus/Baltics decision first)
```
git pull origin main                                      # base on current main; row ids are stable
python3 tools/apply_backfill.py --selftest                # writer must be byte-identical with no changes
python3 tools/apply_backfill.py                           # dry run: counts per field (compare with the projection above)
python3 tools/apply_backfill.py --write --mv painting     # add --mv both to take painter-level movements as well
tools/rebuild_all.sh --atlas --skip-gallery               # rows keep their gallery positions; facets, analysis, painters, pages rebuild
node tools/check.js && node tools/check_ids.js            # plus the other gates and tools/smoke.sh
python3 tools/r2_sync.py                                  # BEFORE pushing a new ?v=
```
Notes for phase 2: `tools/gallery.py` must pick the changed `co`/`y`/`mv` up (the detail shards and index.bin year are rebuilt, positions do not move).
`tools/artist_extra.py` should reuse `painters.json` so future batches carry a country from the start. Remaining gaps after this: 388 unmatched painters,
about 19.8k rows with no year anywhere (Commons files without a dated description), and painters with no birth place in Wikidata (396 matched painters have no country).

## Files
`painters.json` (painter -> q, via, confidence, country, country_app, country_p27, country_src, birth, death, movements, gender, existing_co, n; plus stats and top100_unmatched),
`paintings.json` (row id -> fields to fill, key legend inside), `projection.json`, `wd.py` (shared helpers), `p0..p4` scripts, `../../tools/apply_backfill.py`.
