# Medieval and ancient painting staging, 2026-10-23

**14,717 new measured rows** in `data/corpus-staging/zz-medieval-ancient-*.json` (all with p/L/C, six colours each). Nothing in `data/corpus`, `data/gallery` or `index.html` was touched; no image was kept (thumbnails were fetched only to measure, then the cache was deleted). Scripts: `tools/stage/medieval_ancient.py` (Wikidata), `ma_commons.py` (Commons categories), `ma_met.py`, `ma_cma.py`, `ma_fsg.py`, `ma_finalize.py`, `ma_common.py`.

| File | Rows | Source |
|---|---|---|
| `cf-1..3` | 8,701 | Commons categories with {{Artwork}} metadata read from the API: the Yorck Project PD-Art files (10.7k files seen), Fayum portraits, Pompeii frescoes, Egyptian paintings, Book of the Dead, Byzantine/Coptic/other icons, Gothic and "N-century paintings" 13th c. BCE to 15th c. (86,560 files seen). Id `cf-<pageid>`, url = Commons file page. |
| `wd-1..2` | 5,596 | Wikidata items (painting, mural, wall painting, fresco, icon, panel painting, Fayum portrait, miniature, thangka ...) with P18 image and P571 before 1500; CC0 metadata. Id `commons-<QID>` (`commonscc-<QID>` for CC BY / CC BY-SA files). |
| `cma-1` | 228 | Cleveland open access, Painting + illustrated manuscript leaves before 1500 (Chinese, Indian, Islamic, Egyptian, Byzantine, European). |
| `met-1` | 192 | Met Open Access, every department, painting classes before 1500 (Asian scrolls, Roman wall paintings, Cloisters panels, Egyptian). |

Freer|Sackler gave 1 new row (148 of 149 pre-1500 paintings are already in the sibling non-Western staging), and it was grey, so no file.

## By period (measured rows)
BCE 1,061; 1-499 CE 829; 500-999 286; 1000s 214; 1100s 734; 1200s 1,609; 1300s 2,919; 1400s 7,065. Before 1400: 7,652; 1400-1499: 7,065.

## By country (as far as known)
No country 8,381 (Yorck and Commons-category files rarely carry one; filled from the artist's country elsewhere in the corpus for 2,296 rows, the rest left null). Italy 3,741; Germany 456; France 394; Egypt 385; Spain 202; Netherlands 188; India 150; China 149; Belgium 138; Japan 102; Tibet 45; UK 41; Austria 40; US 31; Hungary 29; Poland 28; Greece 24; Portugal 23; Russia 21; Peru 20; Turkey 20. Artist unknown for 7,492 rows (anonymous icons, frescoes, Fayum, Pompeii). Licences: PD 11,558; CC0 2,007; CC BY-SA 4.0/3.0 793; CC BY 359.

## Dedupe
Against `data/corpus` plus every `data/corpus-staging` directory found in the sibling worktrees (a93f non-Western/women, the artist-extra and museum stagings) and nga/saam/walters from origin/staging/us-uk-cc0: by id, by artist+title+year twin (3 years), and by Commons file name. Wikidata: 4,061 items already held by id, 409 by file name, 399 twins. Commons categories: 2,451 file names already held, 2,503 twins. Met 897 + 95, Cleveland 470 + 5. Between my own files the same rules apply (cf checked against wd/met/cma).

## Skipped and why
- Date missing, or vaguer than a century (Wikidata precision below century): 508 (wd) + 6,085 files with no usable date (cf). Date span over 200 years: 4 + 489 + 24 (Met/Cleveland) + 159 (Freer).
- Outside -3500..1499: 57,684 category files (the century categories hold later work).
- Details, crops and non-painting file names: 4,035. Titles naming drawings, prints, sculpture, vases, coffins, mosaics, boxes, masks, jars: 777 + 432 + 454. Manuscript leaves and book illustrations (psalters, Decameron, chronicles, hours; only stand-alone paintings kept): 1,618 + 1,256.
- Licence not CC0/PD/CC BY(-SA) on Commons: 74 + 170. Creator died after 1955: 52. No label: 321.
- Measure step: 669 grey / black-and-white images, 756 images with fewer than 6 distinct colours (flat parchment), 44 downloads failed. These were removed so every kept row has p/L/C.

## Notes and doubts
- **gallery.py needs a source entry for `commonscc`** (CC BY / CC BY-SA rows; same pattern as `staedelcc`). `commons`, `met`, `cma` exist; `cf-` rows use src `commons` with a Commons file-page url.
- Dates for ancient work are approximate: Pompeii frescoes carry "1st century BCE/CE" and sit around -100 with span 100; Fayum portraits about 1-300 CE.
- Wikidata century-precision dates were taken at the stored year with span 100.
- Yorck rows: file names do not say "Yorck", so the Yorck-origin count is only the 1,472 found before pruning; many Yorck pre-1500 paintings were already held (by title/artist twin or Wikidata id).
- Egyptian tomb paintings and Book of the Dead papyri appear only where Commons categories had dated files; Etruscan tomb paintings, Ethiopian and Russian icon categories were nearly empty on Commons (Wikidata items carry most of them).
- WDQS was very slow (504/429 constantly); item lists came from small per-class, per-date-range queries and all other data from wbgetentities with maxlag=600.
- Only direct P31 painting classes were queried; items typed only with a rarer subclass are missed.
