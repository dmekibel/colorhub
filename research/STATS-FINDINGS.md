# Art history by color: the ColorHub corpus

Built 2026-10-07 by `tools/corpus.py`, with one adapter per newer museum in `tools/museums/`. Outputs: `data/corpus.json` (one row per painting, 6.5 MB) and `data/stats.js` (`window.STATS`, 0.56 MB). If a later run pushes the corpus past 8 MB, it is written as shards, `data/corpus/<src>-<n>.json` (about 2.5 MB each, same row format), and `data/corpus.json` is removed. Readers should accept both shapes: `load_corpus()` in `tools/corpus.py` and `corpus_rows()` in `tools/library.py` do. Raw metadata, images, palettes and hashes are cached in the gitignored `research/_raw/` (`aic/`, `cma/`, `met/`, `nga/`, `rijks/`, `smk/`, `corpus-palettes.jsonl`, `corpus-hashes.jsonl`). No image is in the repo.

**What it answers:** which colors a painter, decade, century, country or movement uses most, measured from the paintings themselves. It covers **14,447 public-domain paintings from six museums**, 6 colors each, named with the app's 101 color words. The first version (4,655 paintings, Chicago and Cleveland only) is compared in section 3.

---

## 1. Data

| Source (`src`) | Route | Candidates | In corpus | Notes |
|---|---|---|---|---|
| Art Institute of Chicago (`aic`) | api.artic.edu, CC0 metadata | 2,104 (Painting or Miniature Painting, public domain, image) | 1,889 | IIIF `full/200,`. 120 black-and-white photographs left out (new rule, see below). |
| Cleveland Museum of Art (`cma`) | openaccess-api.clevelandart.org, CC0 | 3,961 (Painting, CC0, image) | 2,611 | ~900 px web JPEG, kept at 200 px. |
| The Met, New York (`met`) | collectionapi.metmuseum.org (no key) + the Open Access CSV | 6,162 public-domain paintings with images | **165 (partial)** | The bot shield in front of the API and image server refuses this client after a few hundred requests (see Politeness). The paintings are fetched in a fixed shuffled order, so the 165 are a random sample. Resume with `--resume`. |
| National Gallery of Art, Washington (`nga`) | NGA open data on GitHub (CSV files), CC0 | 2,916 open-access paintings | 2,599 | IIIF at 400 px. George Catlin's 351 paintings capped to 50. |
| Rijksmuseum, Amsterdam (`rijks`) | data.rijksmuseum.nl OAI-PMH (EDM), no key | 4,367 public-domain paintings | 4,356 | IIIF (iiif.micr.io) at 400 px. 4 images would not load. |
| SMK, Copenhagen (`smk`) | api.smk.dk search API, no key | 4,637 public-domain paintings | 2,827 | 1,751 of SMK's images are old black-and-white photographs and are left out. |

**Rijksmuseum needed no key.** Its new Data Services offer two key-free routes. The Linked Art search API (`data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true`) finds the ~4,900 paintings but needs three more requests per painting to reach an image. The OAI-PMH endpoint returns whole Europeana (EDM) records for set 261208 ("schilderijen") 50 at a time: title, date, creator, rights, production place and IIIF image, in about 100 requests. The OAI route is used. Only records whose `edm:rights` is the Public Domain Mark or CC0 are kept; one in-copyright record was skipped.

**Licenses:** all metadata is CC0. Images are public domain or CC0: AIC (`is_public_domain`), CMA (`cc0`), the Met (`isPublicDomain`, Open Access), NGA (`openaccess` = 1 in `published_images.csv`), Rijksmuseum and SMK (Public Domain Mark). `STATS.meta.sources` lists name, route, license, count and fetch date per museum.

**Politeness.** Every request sends `ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)` (plus `AIC-User-Agent` for AIC), waits a fixed gap per museum, retries with backoff and caches what it gets.
- AIC: 1 request a second on one thread (its docs ask for that). CMA: about 2 a second.
- NGA, Rijksmuseum, SMK: at most 4 a second (3 threads sharing a 0.25 s gap).
- The Met documents 80 requests a second. Its Imperva shield refused us (HTTP 403) after about 80 requests at 8 a second, about 115 at 2 a second, and about 290 at 1 every 1.5 s, and after a 15-minute pause it refused again within about 60 requests. That looks like a quota per time window, not a rate. The adapter stops at a 403, stands back 15 minutes and returns 1.5 times slower, up to 8 times. It never tries to get around the shield. To ask the API only about paintings worth fetching, it first reads the Met's Open Access CSV (one ~320 MB download from GitHub): 6,162 of the 14,488 image-bearing search hits are public-domain paintings.
- The Met's paged search (`/v1.1/search`; the one-shot `/v1/search` was retired on 2026-10-01) stops at 10,000 results, so a larger result is split by department.

**What was dropped, and why.**
- **Text pages and big books (unchanged):** manuscript text and calligraphy pages are dropped, and one manuscript or album keeps at most 8 leaves. For the four newer museums, only records whose title names a leaf, folio, page or album are grouped by accession prefix. The Met's `29.100.5` is item 5 of the Havemeyer bequest, not leaf 5 of a book. No new record hit the cap.
- **Black-and-white photographs (new):** some museums still show an old monochrome photograph for a painting. Such an image has a mean chroma C\* of exactly 0, and a real grisaille or faded ink painting still has a tint (C\* ≥ 1). Rows under C\* 0.6 are left out: SMK 1,751, AIC 120, the Met 13. The AIC ones were in the first version too (Chinese hanging scrolls, Dutch and French paintings), where they counted as pure neutrals.
- **Near-duplicates (new, 29):** the same picture catalogued twice, such as CMA's whole-leaf and recto-only records of one Indian page, or NGA altarpiece panels that all use the whole altarpiece's photograph. Each image gets a 64-bit difference hash. A pair counts as a duplicate when the hashes differ in at most 2 bits, or in at most 6 bits with titles sharing most words. Their mean L\* and C\* must also be within 3, and the middle 70% of the two images within ΔE 5. That last test keeps apart two different sitters in identical gilt locket frames, which hash alike. The list is in `research/_raw/dups.tsv`.
- **Artist cap (new, 50 per artist):** a prolific painter could outweigh a country or a decade. Each artist keeps at most 50 paintings, evenly spread over the artist's works sorted by date. Capped: George Catlin (351 → 50), C.W. Eckersberg (75), Claude Monet (66), Nicolai Abildgaard (66), Christen Købke (61), Jens Juel (57), Gilbert Stuart (55), Rembrandt van Rijn (53), George Hendrik Breitner (53), Arnoud van Halen (52).
- **Not-by attributions (new):** "Workshop of", "Follower of", "Circle of", "After", "Copy after", "Style of" and similar mean someone else painted it, so the row keeps no artist. "Attributed to", "possibly" and "probably" keep the name. This also cleared a few AIC rows such as "After Jean Baptiste Joseph Pater".

## 2. Method

**Image.** Every painting is analyzed from a 200 px-wide copy. AIC's comes from its 200 px IIIF image; the other museums' ~400-900 px images are scaled down. The display URL in `img` is about 400 px for AIC, NGA, Rijksmuseum and most of SMK (IIIF). For the Met it is the ~450 px "mobile-large" JPEG, and for CMA the ~900 px web JPEG. About half of SMK's paintings have no IIIF image, only a fixed 1600 px JPEG, and that is their `img`.

The copy is trimmed of edge bands that are near-uniform *and* end in a clear step to the picture (frame, mat, scanner bed). Then comes a 2% inset and a reduction to about 120 px on the long side by area averaging. A flat neutral photo backdrop around shaped panels, ovals and lockets is masked out (223 paintings). Painted backgrounds that reach the edge fail the flatness test and are kept.

**Palette.** k-means with k = 6 in CIELAB (k-means++ seeding, best of 4 restarts). a\* and b\* are weighted 1.5x for the clustering only, so a small vivid area is not swallowed by large dark ones. Each palette color is the plain Lab mean of its pixels, and its share is its pixel area.

**Names.** Each palette color gets the nearest of the app's 101 names (11 basics plus 90 unit colors from `data/colors.js`) by CIEDE2000.

**Families: an LCh rule** on L\* (lightness 0-100), C\* (chroma) and h (hue angle) from CIELAB D65. Pure sRGB blue sits at h = 306, so the blue/purple line is at 305.

| Family | Rule (applied top to bottom) |
|---|---|
| Neutrals | C\* < 10; or L\* < 20 and C\* < 15 (near-blacks); or L\* > 90 and C\* < 25 (off-whites) |
| Browns | dark warm colors that are not saturated: L\* < 50 and h 37-100 with C\* < 1.5 L\* (sienna, umber, chocolate), or h 348-37 with C\* < 0.8 L\* (so a clear brick red stays red) |
| Browns, light | h 45-100, L\* ≥ 50, C\* < 32 (< 25 when L\* ≥ 80): tan, camel, beige, taupe; also h 20-45, L\* 50-65, C\* < 25 (rosy browns) |
| Pinks / Reds | h 348-20: pink if L\* ≥ 50, else red. h 20-45: pink if L\* ≥ 65 (salmon, baby pink), else red |
| Oranges / Yellows | h 45-78 / 78-100 |
| Greens / Blues / Purples | h 100-180 / 180-305 / 305-348 |

**Lightness and chroma.** L and C are the mean L\* and mean C\* over every pixel of the painting, not over the palette.

**Metadata.**
- *Year* is the start of the museum's date range. Where a museum writes a date text, it is the first year in it ("c. 1670" gives 1670), as for CMA. Centuries, periods and dynasties fall back to the museum's begin year with a wide span. Works dated more loosely than 20 years (3,279) are left out of decades, and those looser than 100 years (211) out of centuries.
- *Country* is the modern country where the work was made, where the museum says so. AIC gives a place of origin and CMA a culture. The Met gives a country or culture for non-Western works, else the artist's nationality. NGA and SMK give only the artist's nationality. For the Rijksmuseum it is the place of making when the record gives one (`dcterms:spatial`, the production place of the Linked Art record: "Haarlem", "Cologne", "Northern Netherlands"). Otherwise it is the museum's catalogue of Dutch 17th-century or Flemish paintings, else the artist's birthplace, walked up the Rijksmuseum's place hierarchy to a country.
  - Nationality is not place of making: Sisley (British) and van Gogh (Dutch) in France count under their nationality at the Met and NGA.
  - 808 rows have no country. Most are anonymous Rijksmuseum paintings without a recorded place (568).
  - New countries in the rule list: Poland, Czechia, Portugal, Canada, Turkey, Finland ("Finnish"), Scotland/Wales under the United Kingdom, and a few others.
- *Movement* is AIC's `style_title` where it names a movement or school, plus Indian schools stated in CMA's culture field and the Met's culture/period: Mughal, Rajput (the Met's "Rajasthan"), Pahari (the Met's "Punjab Hills"), Kalighat, Company School. The Met, NGA, Rijksmuseum and SMK have no style field, so European movement groups are still AIC's alone.
- *Artist:* generic attributions ("French", "Unknown", "anonymous", "anoniem", "Netherlandish (Antwerp Mannerist) Painters") become null. Spellings are merged across museums ("Paul Cezanne"/"Paul Cézanne"; the Met's "Rembrandt (Rembrandt van Rijn)" joins "Rembrandt van Rijn"), keeping the most-used form without brackets.

**Group statistics.** Each painting counts equally, and a group's family shares are the mean of its paintings' area shares.
- `top` lists the 8 app names with the largest mean share.
- `dist` lists the names the group uses more than the whole corpus does, ranked by share × ln(lift). Only names with at least 1% of the group's area and a lift of at least 1.25 count.
- `sample` lists the 6 paintings closest to the group's family mix.
- Groups are reported from these minimum sizes: century 10, decade 25, country 25, movement 20, artist 6. `byArtist` now has 484 entries, which is why `stats.js` grew from 0.18 to 0.56 MB.

**Findings** are computed by `findings()` from the rows. A comparison is kept only when the 95% bootstrap interval of the difference (2,000 resamples) excludes zero, so a re-run that breaks a claim drops it with a warning.

## 3. Findings (all 14 hold on this data; 95% intervals are in `STATS.findings[].numbers`)

The sample grew threefold and changed character. Dutch (3,715) and Danish (1,658) paintings now make up 37% of the corpus, against 4% before. That shift explains most of the moved numbers below. Old numbers (4,655 paintings, Chicago and Cleveland) are in brackets.

1. **Earth and shadow.** Browns and neutrals cover **86.6%** of the average painting's surface [85.5%]. Purples and pinks are the rarest families at **0.1%** each [0.1%]. *Area-weighting and aged varnish both push toward brown.* **Holds.**
2. **The most-used app color is now black** at **21.4%** of the average painting, then umber at **18.3%** [umber 15.1%, then black 12.6%]. Taupe, sepia, brown and camel follow at 6-8%. **Changed:** the Rijksmuseum's dark 17th-century portraits and still lifes moved black to first place. *Most of the app's names are brighter than real paint, so muted colors pile onto the few muted names.*
3. **Europe lightens.** Mean L\* of European paintings is **29.5** in the 1600s (n = 3,043), **39.7** in the 1800s (n = 3,574) and **44.3** in the 1900s (n = 644) [28.8 / 37.8 / 43.4, with n = 334 / 786 / 78]. The 1800s minus 1600s interval is +9.4 to +10.8. **Holds, on ten times the data.** *Old varnish and grime darken older pictures, so part of the gap is age, not the painter.*
4. **Blue arrives late.** Blues cover **0.8%** of the average European painting from the 1600s, **2.1%** in the 1800s and **5.0%** in the 1900s [1.2% / 3.1% / 7.6%]. **Holds;** the levels are lower because Danish and Dutch 19th-century painting is less blue than the French-heavy American collections. *Yellowed varnish turns old blues green-grey.*
5. **The Impressionist decades.** In French paintings, blues and greens together go from **13.4%** of the surface in the 1860s to **25.5%** in the 1880s, and L\* from **37.6 to 49.8** (n = 165 and 177) [11.1% → 21.6%, 33.8 → 45.9, n = 83 and 87]. **Holds.** *American museums collected French Impressionism heavily.*
6. **Impressionism vs Realism.** Impressionist paintings average L\* **49.1** with **8.4%** blue (n = 140). Realist paintings average **26.0** with **1.2%** blue (n = 38) [49.0 and 9.6%, n = 148]. **Holds.** The 8 fewer Impressionist works are black-and-white photographs now left out. *Movement labels still come only from AIC.*
7. **Monet's signature is cool and pale.** Blues cover **16.8%** of his 50 paintings, against **2.0%** for other European paintings of the 1800s, at L\* **54.5** against **39.5** [20.3% vs 2.6%, L\* 51.9 vs 37.3, n = 38]. His most-used colors are still grey, slate, taupe and silver, and viridian is still his mark (10 times the average). Cornflower dropped out of his distinctive list and ash came in. **Holds; numbers moved.** *66 Monets were found (Chicago, Cleveland, Washington, Amsterdam) and capped to 50.*
8. **Van Gogh leans green**: greens cover **40.3%** of his 25 paintings, against **9.8%** for other European paintings of the 1800s. **Changed:** he is no longer *the* greenest artist [42.4% of 11, greenest of 103]. Of the 484 artists with at least 6 works, Maurice Utrillo (77%, n = 6), Julian Alden Weir (66%, n = 6) and Geo Poggenbeek (47%, n = 9) are greener, all small groups.
9. **India is the most saturated country.** Indian paintings have a mean C\* of **23.7** against **14.7** for European paintings (n = 721 and 9,958) [23.8 vs 13.6]. Rajput court painting has the highest chroma of any school (**26.7**), with reds, oranges and yellows covering **28.2%** of the surface. **Holds.** *Unvarnished gouache kept in albums keeps its color far better than varnished oil.*
10. **East Asian paintings are light, and almost never blue.** Chinese and Japanese paintings average L\* **58.9** against **35.5** for European ones [59.0 vs 36.2]. Blue covers **0.1%** of the average Chinese painting. **Holds.** *Silk and paper brown with age, and mountings are often in the photograph.*
11. **Gold grounds.** Oranges and yellows cover **12.0%** of European paintings made before 1500, against **2.0%** in the 1600s (n = 515 and 3,043) [9.3% vs 0.9%, n = 191 and 334]. **Holds.** *Photographed gold often reads as brown instead.*
12. **Neutrals vs browns.** **90.5%** of European paintings give at least 5% of their surface to neutrals, against **57.8%** of Asian paintings. In Asian paintings browns and tans take that role: **95.2%** have at least 5% brown [93.7% / 58.2% / 94.8%]. **Holds.**
13. **The Netherlands is the black country.** The app color black covers **32.3%** of the average Dutch painting, the most of any country, against **21.4%** across the collection (n = 3,715) [35.2% vs 12.6%, n = 203]. 58% of these paintings are from the 1600s. **Holds, now on 18 times the Dutch sample.** The gap to the whole collection is smaller because the whole collection got darker.
14. **Extremes.** Of the 484 artists with at least 6 works, the darkest is **Cornelis van der Voort** (L\* 13.3, n = 7) and the lightest is still **Bian Shoumin** (L\* 82.1, n = 8). **Changed** [darkest was Eastman Johnson, 20.2, of 103 artists]. *Small groups: one museum's choice of works decides these extremes.*

## 4. Limits

- **Varnish.** Aged varnish yellows and darkens old paintings. Every "older is darker and browner" comparison is partly a measure of age.
- **Photographs, not paint.** This is screen color from museum photographs, and six museums photograph differently. Black-and-white photographs are now excluded, but a color photograph with a strong cast is not.
- **Six museums, not art history.** Four collections are American (strong in French Impressionism, American 19th-century painting, Indian, Chinese and Japanese painting). Two are national European collections, so Dutch and Danish painting are heavily represented: together 37% of rows, and they dominate the 1600s and the Northern 1800s. The Met is only a 165-painting sample until its fetch is resumed. Little after about 1920 is public domain.
- **Area-weighted palettes.** A large dull background outweighs a small bright accent the eye goes to first. Downsampling and six clusters blend broken-color brushwork.
- **Country is partly nationality.** For NGA, SMK and much of the Met, country is the artist's nationality, not where the picture was painted.
- **Groups mix regions.** `byCentury` is everyone. The findings compare within Europe where it matters.

  | Century | n | Europe | Asia | Americas |
  |---|---|---|---|---|
  | 1100s | 35 | 0 | 35 | 0 |
  | 1200s | 121 | 15 | 102 | 0 |
  | 1300s | 162 | 77 | 78 | 0 |
  | 1400s | 607 | 420 | 132 | 0 |
  | 1500s | 1,127 | 724 | 236 | 0 |
  | 1600s | 3,802 | 3,043 | 476 | 1 |
  | 1700s | 2,260 | 1,425 | 497 | 176 |
  | 1800s | 5,186 | 3,574 | 448 | 1,068 |
  | 1900s | 895 | 644 | 31 | 198 |

- **Mounts and frames.** Scrolls, albums and lockets are photographed with mounts or frames where the museum did so. Some Met and NGA photographs include the frame, and the edge trim catches most but not all.
- **Small groups.** Artist entries start at 6 works. Treat any artist or decade under about 15 as an anecdote.

## 5. Quality checks done

- **Per museum, 10 random new rows each** (Met, NGA, Rijksmuseum, SMK): every display `img` answered HTTP 200 `image/jpeg`. Years, artists and countries read sensibly (Wen Zhengming 1512 China; Cézanne 1870 France; Jan Steen 1667 Netherlands; L.A. Ring 1890 Denmark; Jan Adam Kruseman 1850 Netherlands).
- **Contact sheets** (image, palette bars, names, families) per museum were checked by eye, and the palettes match the pictures: Weie's olive-green trees, Ring's periwinkle fjord sky, a Chinese flower album's ecru ground with hunter green, slate and puce. The SMK sheet showed four greyscale photographs out of ten (C\* = 0.0). That led to the black-and-white rule, which also caught 120 AIC rows from the first version.
- **Near-duplicate pairs** were inspected. The first version of the test wrongly paired two different locket portraits in identical frames, and the centre-ΔE check was added for that.
- **Shards:** the writer was tested by forcing a 1 MB limit. It wrote 11 shards; `load_corpus()` and `tools/library.py` read back all rows, and then the single file was restored.
- `node tools/check.js` and `node tools/check_wiki.js` pass with 0 failures, and `node --check data/stats.js` passes.

## 6. Re-running and resuming

```
python3 tools/corpus.py status                  # what is cached per museum
python3 tools/corpus.py fetch met --resume      # continue the Met: metadata + images, quota-aware (hours; background it)
python3 tools/corpus.py fetch nga rijks smk --resume   # no-ops when complete; one process per museum can run in parallel
python3 tools/corpus.py palettes                # palettes for new images only (6 processes, ~13 a second)
python3 tools/corpus.py build                   # rows, dedupe, cap, stats, findings; shards automatically past 8 MB
python3 tools/corpus.py sheet 10 out.png 2026 smk   # contact sheet of 10 random paintings from one museum
```

Without `--resume`, `meta` asks each API again from scratch (the Met's id list, CSV and records too).

## 7. Field reference

**`data/corpus.json`** (or every `data/corpus/*.json` shard) is an array of rows:
- `id` is `<src>-<museum id>` (`aic-…`, `cma-…`, `met-…`, `nga-…`, `rijks-…` with the Rijksmuseum's numeric Linked Art id, `smk-…` with SMK's object number), and `src` is the source code.
- `t` is the title, cut at 90 characters, and `a` is the artist or null.
- `y` is the start year, negative for BCE.
- `co` is the country or null, and `mv` is the movement or school or null.
- `img` is the display image (sizes above).
- `p` lists up to 6 `[hex, area share, app name, family]` entries, largest first.
- `L` and `C` are the mean L\* and C\*.

**`data/stats.js`** sets `window.STATS` with:
- `meta`: sources (name, api, license, n, fetched), count, `files` (the corpus file or shards), method, `familyRule`, `minN`, caveats and fields.
- `families` and `familyAvg`.
- `byCentury`, `byDecade`, `byCountry`, `byMovement` and `byArtist`. Each entry is `{key, n, fam, top, dist, L, C, sample}`.
- `overall` and `findings`.
