# Art history by color: the ColorHub corpus

Built 2026-10-07 by `tools/corpus.py`. Outputs: `data/corpus.json` (one row per painting, 2.1 MB) and `data/stats.js` (`window.STATS`, 0.18 MB). Raw metadata, images and palettes are cached in the gitignored `research/_raw/` (`aic/`, `cma/`, `corpus-palettes.jsonl`); no image is in the repo.

**What it answers:** which colors a painter, decade, century, country or movement uses most, measured from the paintings themselves: 4,655 public-domain paintings, 6 colors each, named with the app's 101 color words.

---

## 1. Data

| Source | API | Records fetched | Kept | Notes |
|---|---|---|---|---|
| Art Institute of Chicago (`aic`) | api.artic.edu, CC0 metadata | 2,104 (type Painting or Miniature Painting, public domain, has image) | 2,023 | Images: IIIF `full/200,` (a size the docs list for cache hits). 2,024 passed selection; one image would not decode. |
| Cleveland Museum of Art (`cma`) | openaccess-api.clevelandart.org, CC0 | 3,961 (type Painting, CC0, has image) | 2,632 | The ~900 px "web" JPEG was downloaded once and only a 200 px copy kept. |

**Politeness.** AIC's docs ask scrapers for at most one request a second on one thread, which is stricter than the 3-5 a second in the brief, so AIC ran at 1 per second. CMA ran at about 2 per second. Both sent a `ColorHub (https://github.com/dmekibel/colorhub)` agent (`AIC-User-Agent` for AIC). AIC's search refuses results past the first 1,000, so metadata is paged by id ("id > last id") instead of by page number.

**What was dropped, and why.**
- **Text pages (968):** museums catalogue manuscript text leaves as paintings. CMA's Kalpa-sutra and *Perfection of Wisdom* manuscripts alone have hundreds of "Text, folio 12 (verso)" leaves. Pure text, calligraphy and colophon pages are dropped. A painting with calligraphy on its back ("... (recto); Calligraphy (verso)") stays, since the image shows the painting.
- **Over-represented books (441 leaves):** one manuscript or album can be hundreds of records. CMA owns 654 leaves of the Tuti-nama. Each object group (the accession number up to its second dot) keeps at most 8 leaves, evenly spaced, so one book counts like a handful of paintings instead of like a whole century.

## 2. Method

**Image.** The 200 px copy is trimmed of edge bands that are near-uniform *and* end in a clear step to the picture (frame, mat, scanner bed). Without the step test, a portrait's dark painted background was being cut off. After the trim comes a 2% inset, then a reduction to about 120 px on the long side by area averaging. Shaped panels, ovals and lockets are photographed on a flat grey or black backdrop. When the edge ring is neutral, uniform and flat in all four corners, the backdrop pixels connected to the edge are masked (173 paintings). Painted backgrounds that reach the edge fail the flatness test and are kept.

**Palette.** k-means with k = 6 in CIELAB (k-means++ seeding, best of 4 restarts). a\* and b\* are weighted 1.5x for the clustering only, as in `tools/paintings.py`, so a small vivid area is not swallowed by large dark ones. Each palette color is the plain Lab mean of its pixels, and its share is its pixel area.

**Names.** Each palette color gets the nearest of the app's 101 names (11 basics plus 90 unit colors from `data/colors.js`) by CIEDE2000.

**Families: an LCh rule.** The colors are L\* (lightness 0-100), C\* (chroma) and h (hue angle) from CIELAB D65. The hue bands come from the hue angles of the app's own colors. Pure sRGB blue sits at h = 306 in CIELAB, so the blue/purple line is at 305. Checked against the 101 app names, every one lands where you would expect. Khaki and olive go to greens, indigo to blues, brick to browns, and cream and ivory to neutrals.

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
- *Year* is the museum's start date: AIC `date_start`, and for CMA the first year in `creation_date` ("c. 1670" gives 1670), falling back to `creation_date_earliest`. Works dated more loosely than 20 years (1,450) are left out of decades. Works dated more loosely than 100 years (168) are left out of centuries. Without this rule, an object dated just "18th century" (stored as 1701) would pile into the 1700s decade.
- *Country* is the modern country where the work was made. AIC's `place_of_origin` mixes countries, regions and towns ("Paris", "Rajasthan", "Prouts Neck"), and CMA's `culture` starts with a country, region or dynasty. Both run through one rule list (`COUNTRY_RULES`). Historic names go to today's country: Holland to the Netherlands, Flanders and "South Netherlands" to Belgium, England and Scotland to the United Kingdom. Tibet stays its own region, as both museums list it. A place that names two candidates ("Japan ... or Korea", "United States or England") or no country (Byzantium, Central Asia, "Middle East") gets none (36 works).
- *Movement* is AIC's `style_title` where it names a movement or school. Its centuries, cultures and countries ("18th Century", "Chinese (culture or style)") are not movements. Added to that are the schools CMA states in `culture`: Mughal, Rajput, Pahari, Kalighat and Company School. CMA has no style field, so its European paintings carry no movement.
- *Artist:* generic culture attributions ("French", "Mughal", "Unknown Artist", "Eastern Mediterranean") become null. Spellings are merged across museums ("Paul Cezanne" and "Paul Cézanne"), and the most-used spelling is kept.

**Group statistics.** Each painting counts equally, and a group's family shares are the mean of its paintings' area shares.
- `top` lists the 8 app names with the largest mean share.
- `dist` lists the names the group uses more than the whole corpus does, ranked by share × ln(lift), where lift is the group's share divided by the whole corpus's share. Only names with at least 1% of the group's area and a lift of at least 1.25 count. `top` says what a painter used most; `dist` says what sets the painter apart.
- `sample` lists the 6 paintings whose family mix is closest to the group's, preferring works with a named artist.
- Groups are reported from these minimum sizes: century 10, decade 25, country 25, movement 20, artist 6.

**Findings** are computed by `findings()` from the rows. Each sentence carries its numbers and group sizes. A comparison is kept only when the 95% bootstrap interval of the difference (2,000 resamples of paintings) excludes zero, so a re-run on other data drops a claim that no longer holds and prints a warning.

## 3. Findings (all 14 hold on this data; 95% intervals are in `STATS.findings[].numbers`)

1. **Earth and shadow.** Browns and neutrals cover **85.5%** of the average painting's surface (browns 50.5%, neutrals 35.0%; n = 4,655). Purples and pinks are the rarest families at **0.1%** each: they appear as accents, almost never as large areas. *Area-weighting and aged varnish both push toward brown.*
2. **The most-used app color is umber** at **15.1%** of the average painting, then black at **12.6%**, then taupe, camel, tan and sepia at 8-10% each. *Most of the app's 101 names are brighter than real paint, so muted colors pile onto the few muted names.*
3. **Europe lightens.** Mean L\* of European paintings is **28.8** in the 1600s (n = 334), **37.8** in the 1800s (n = 786) and **43.4** in the 1900s (n = 78). The 1800s minus 1600s interval is +7.5 to +10.5. *Old varnish and grime darken older pictures, so part of the gap is age, not the painter. The 1900s group is small because few 20th-century works are public domain.*
4. **Blue arrives late.** Blues cover **1.2%** of the average European painting from the 1600s, **3.1%** in the 1800s and **7.6%** in the 1900s. *Yellowed varnish turns old blues green-grey, which hides some of the blue in older works.*
5. **The Impressionist decades.** In French paintings, blues and greens together go from **11.1%** of the surface in the 1860s to **21.6%** in the 1880s, and L\* from **33.8 to 45.9** (n = 83 and 87). *Both museums collected French Impressionism heavily, so the 1880s sample leans to it.*
6. **Impressionism vs Realism.** Impressionist paintings average L\* **49.0** with **9.6%** blue (n = 148). Realist paintings, the generation before, average **26.0** with **1.2%** blue (n = 38). *Only AIC supplies movement labels, and subject matters: Impressionists painted more sky and water.*
7. **Monet's signature is cool and pale.** Blues cover **20.3%** of his 38 paintings, against **2.6%** for other European paintings of the 1800s, at L\* **51.9** against **37.3**. His most-used app colors are grey, slate, taupe and silver. Compared with the corpus, he uses viridian about **12 times** and cornflower about **42 times** as much as the average painting does. *33 of the 38 are in Chicago. A 6-color palette averages his broken strokes, so his lilac-greys come out as "grey" (the contact sheet shows a lilac-grey #91869A named grey but filed under purples).*
8. **Van Gogh is the greenest** of the 103 artists with at least 6 works. Greens cover **42.4%** of his paintings, against **10.2%** for other European paintings of the 1800s. *Only 11 paintings.*
9. **India is the most saturated country.** Indian paintings have a mean C\* of **23.8** against **13.6** for European paintings (n = 714 and 1,951). Rajput court painting has the highest chroma of any movement or school (**27.1**), with reds, oranges and yellows covering **28.7%** of the surface. *Unvarnished gouache kept in albums keeps its color far better than varnished oil, so this compares surviving surfaces, not intentions.*
10. **East Asian paintings are light, and almost never blue.** Chinese and Japanese paintings average L\* **59.0** against **36.2** for European ones, because ink and color on silk or paper leave the ground showing. Blue covers **0.1%** of the average Chinese painting. *Silk and paper brown with age, and scroll mountings are often in the photograph.*
11. **Gold grounds.** Oranges and yellows cover **9.3%** of European paintings made before 1500, against **0.9%** in the 1600s (n = 191 and 334). Gold leaf is the visible cause in the top cases (Berlinghiero, Lorenzo Monaco, Taddeo di Bartolo). *Photographed gold often reads as brown instead, and not every early panel is gilded.*
12. **Neutrals vs browns.** **93.7%** of European paintings give at least 5% of their surface to neutrals (greys, blacks, whites), against **58.2%** of Asian paintings. In Asian paintings browns and tans take that role: **94.8%** have at least 5% brown. *Dark varnished backgrounds count as near-black, whatever color they were painted.*
13. **The Netherlands is the black country.** The app color black covers **35.2%** of the average Dutch painting, the most of any country, against **12.6%** across the collection (n = 203). *59% of these paintings are from the 1600s, so this is mostly a portrait of that century: dark grounds, deep shadow and darkened varnish.*
14. **Extremes.** Of the 103 artists with at least 6 works, the darkest is **Eastman Johnson** (L\* 20.2, n = 7) and the lightest is **Bian Shoumin** (L\* 82.1, n = 8). *Small groups: one museum's choice of works decides these extremes.*

## 4. Limits

- **Varnish.** Aged varnish yellows and darkens old paintings. Every "older is darker and browner" comparison is partly a measure of age, not of the painter's choices.
- **Photographs, not paint.** This is screen color from museum photographs. Lighting, camera profiles and editing all shift it, and the two museums photograph differently.
- **Two museums, not art history.** The corpus reflects what Chicago and Cleveland collected, kept and released as public domain: strong in French Impressionism, Mughal and Rajput painting, Chinese and Japanese scrolls and American 19th-century painting, thin after about 1920 (copyright) and thin outside Europe, Asia and the US.
- **Area-weighted palettes.** A large dull background outweighs a small bright accent the eye goes to first. Downsampling to 120 px and averaging six clusters also blend broken-color brushwork (Impressionists come out greyer than they look).
- **Groups mix regions.** `byCentury` is everyone: the 1100s-1300s are almost all Asian works, and the 1800s are about half European, so century-to-century changes are partly changes in where the works come from. The findings above compare within Europe where it matters.

  | Century | n | Europe | Asia | Americas |
  |---|---|---|---|---|
  | 1100s | 33 | 0 | 33 | 0 |
  | 1200s | 109 | 8 | 101 | 0 |
  | 1300s | 98 | 22 | 72 | 0 |
  | 1400s | 288 | 159 | 123 | 0 |
  | 1500s | 410 | 170 | 234 | 0 |
  | 1600s | 814 | 334 | 472 | 0 |
  | 1700s | 930 | 389 | 493 | 41 |
  | 1800s | 1,564 | 786 | 430 | 343 |
  | 1900s | 215 | 78 | 32 | 101 |

- **Mounts and frames.** Hanging scrolls, albums and portrait lockets are photographed with their mounts, gold frames or stands where the museum did so, and those count as palette. The backdrop mask catches most lockets and shaped panels but not all. On the contact sheet, a locket and an Ethiopian triptych on a stand kept their grey backdrop.
- **Labels.** Movement labels exist only where a museum states them: AIC styles, plus CMA's Indian schools. Country follows place of making (AIC) or culture (CMA), which can differ for an artist working abroad.
- **Small groups.** Artist entries start at 6 works. Treat any artist or decade under about 15 as an anecdote.

## 5. Quality checks done

- Contact sheets of 10 random paintings (image, palette bars, names, families; two different draws) were checked by eye. The palettes match the pictures: Gauguin's *Arlésiennes* (hunter green, ochre, brick), Pontormo's black ground, a Mughal portrait's camel-and-tan paper border, Tarbell's blue-grey summer light, a Mughal prince's moss-green ground and Remington's camel desert. One borderline case: the red dress in Lungren's *In the Café* averages to a dark brick (#89371F), which the rule files under browns. The red/brown edge is where the family rule is least certain.
- A Monet sheet (7 random works) confirmed the signature: lilac-greys, slate blues and viridian water.
- Trim and backdrop masks were inspected on about 40 shaped panels and dark portraits. The first versions ate painted backgrounds and were tightened with the edge-step and corner-flatness tests.
- `node` loads `data/stats.js` and `data/corpus.json` cleanly.

## 6. Re-running

```
python3 tools/corpus.py meta       # refresh metadata from both APIs (~65 requests)
python3 tools/corpus.py images     # downloads only what is not cached; failures retry next run
python3 tools/corpus.py palettes   # only new images (6 processes, ~2 minutes for everything)
python3 tools/corpus.py build      # rows, stats, findings; prints places that got no country
python3 tools/corpus.py sheet 10 out.png 2026   # contact sheet for eyeballing
```

## 7. Field reference

**`data/corpus.json`** is an array of rows:
- `id` is `aic-<id>` or `cma-<id>`, and `src` is `aic` or `cma`.
- `t` is the title, cut at 90 characters, and `a` is the artist or null.
- `y` is the start year, negative for BCE.
- `co` is the country or null, and `mv` is the movement or school or null.
- `img` is the display image: AIC IIIF at 400 px; CMA has no IIIF, so its about-900 px web JPEG.
- `p` lists up to 6 `[hex, area share, app name, family]` entries, largest first. The family is a 4th element beyond the brief, so the app can filter without the color math.
- `L` and `C` are the mean L\* and C\*.

**`data/stats.js`** sets `window.STATS` with:
- `meta`: sources, count, dates, method, `familyRule`, `minN`, caveats and fields.
- `families`: the representative hex per family, which is the app's basic color.
- `familyAvg`: the area-weighted average color of each family across the corpus.
- `byCentury` (with `label`), `byDecade`, `byCountry`, `byMovement` and `byArtist` (with `years`). Each entry is `{key, n, fam, top, dist, L, C, sample}`.
- `overall`: the top 20 app names across the corpus.
- `findings`: `[{id, text, numbers, caveat}]`.
