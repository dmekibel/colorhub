# Color photography by color: feasibility, sources and method

Built 2026-10-09 for ColorHub's photography lane (Phase 1: research + data; Phase 2: the Museum room, photographer
pages, "In photographs", process notes). David: "Treat famous photographers and famous photos the same way as
paintings... except black-and-white photos, since this app is about color. Build an archive of color
photographs." Phase 2: "treat photos exactly like paintings... a Photography room/door in the Museum... each
photo opens through the existing paintingPage()... photographer pages like painter pages... a short honest note
on each process... add NASA/USGS iconic PD images if they fit cleanly." Same pipeline shape as the painting
corpus (`tools/corpus.py`) and the design corpus (`tools/design_corpus.py`): keyless, resumable,
public-domain-only, and every claim carries its n.

**Short answer: yes, but almost none of it comes from loc.gov directly, and almost none of it is the famous names.**
Eggleston, Shore, Leiter, McCurry, Meyerowitz and nearly every other name associated with "fine-art color
photography" are in copyright, so this archive is built entirely from three pre-1950 historic color *processes* --
Prokudin-Gorsky's Russian Empire glass plates, autochromes, and the FSA/OWI's wartime Kodachromes -- read through
Wikimedia Commons, which mirrors the Library of Congress's and several national archives' PD holdings with
per-file license metadata already attached. Famous photographers of the color era (post-1950) are covered by name
and link only, never by image.

## 1. Sources, ranked

"Keyless" means no sign-up of any kind: no api.data.gov key, no token.

| Rank | Source (as reached) | Route used | What it gives | License | Verdict |
|---|---|---|---|---|---|
| 1 | **Library of Congress, via Wikimedia Commons** -- "Photographs by Sergey Prokudin-Gorsky" tree | MediaWiki API, recursive category walk (`tools/museums/photod.py`) | Prokudin-Gorsky's 1905-1915 Russian Empire glass-plate color photographs (RGB composites), the collection's own digitization, already assembled and uploaded by LOC/Commons volunteers | Public domain (pre-1923 Russian Empire work; LOC's own PD-marked scans) | **Built.** This IS the Library of Congress collection -- see §2 on why loc.gov itself could not be queried directly. |
| 2 | **Wikimedia Commons, "Autochromes" tree** (including "Autochromes in the musée départemental Albert-Kahn", "Autochromes by author") | Same recursive walk | Autochrome plates 1907-1930s from many countries and photographers, including a large slice of the Albert Kahn "Archives of the Planet" collection (the Kahn museum's own PD release) | Per-file: only PD-old / PD-US / PDM / CC0 kept | **Built.** The single richest tree for photographer and country variety; many subcats are per-photographer. |
| 3 | **Library of Congress FSA/OWI color transparencies, via Wikimedia Commons** -- "Color photographs from the Farm Security Administration" | Same recursive walk | The famous 1939-1943 US government Kodachromes (Jack Delano, Russell Lee, John Vachon et al.), 1,000+ files already on Commons with LOC's own PD-USGov metadata | Public domain (US government work) | **Built.** Second half of the collection the task named by name. |
| 4 | **NASA / USGS** (Earthrise, Blue Marble) | `tools/museums/photod.py` `meta_nasa()`: a short hand-picked list, read through Commons the same way as everything else | Two globally famous PD color photographs | Public domain (US government work) | **Tried, excluded by the same honest test everything else goes through** -- see §5. Both are correctly public domain and genuinely in color, but the chroma test that drops black-and-white and toned scans also drops these: Earthrise is mostly black space and grey lunar surface (mean C* 1.5, under the mono threshold of 2.0); the Blue Marble's black space plus white cloud cover pulls its mean chroma to 12.1, under the 14.0 toned-scan threshold, with the remaining color concentrated in one blue hue band. A special crop just for these two would have let them in, but that would be bending the rule for two famous names rather than applying it evenly -- the more honest choice, and the one taken here, is to let the same test decide and say why. |
| 5 | **loc.gov / loc.gov/photos** direct API (`?fo=json`) | Attempted first, as `research/DESIGN-HISTORY.md` §1 rank 11 already found for WPA posters | `fo=json` structured metadata, full resolution images | PD | **Blocked.** A script request gets a Cloudflare "Just a moment" interstitial (same block noted in DESIGN-HISTORY.md for the WPA poster collection). Getting past it would be bypassing bot detection, which this project does not do. |
| 6 | **Famous color photographers in copyright** (Eggleston, Shore, Leiter, McCurry, Meyerowitz, Steele-Perkins, Franklin, Haas, etc.) | n/a | Nothing fetchable | All rights reserved | **Not ingested, by design.** See §4: name-and-link reference only, exactly the Pantone/RAL treatment in `design/LEGAL-COLOR-DATA.md` ("facts yes, libraries no" extended to "mentions yes, images no"). |

## 2. Why Commons instead of loc.gov directly

`research/DESIGN-HISTORY.md` §1 already flagged `loc.gov/collections/...?fo=json` as blocked by a Cloudflare
challenge for the WPA poster collection; the same block applies to `loc.gov/photos` for Prokudin-Gorsky and the
FSA/OWI color transparencies (confirmed 2026-10-09: a plain `curl` with a UA string gets the same "Just a moment"
interstitial page, not JSON). Both of the named LOC collections are, however, mirrored on Wikimedia Commons by
LOC's own staff and by volunteers who OCR and geotag the glass-plate inventory numbers, each file carrying
Commons' own `LicenseShortName` field. Reading those mirrors through the plain MediaWiki API (the same route
`tools/museums/commonsd.py` already uses for posters and stamps) gets the same public-domain images and most of
the same metadata (date, author/photographer field, a description that usually keeps the LOC catalog number)
without touching the blocked endpoint. This is the same workaround `research/DESIGN-HISTORY.md` recommends but
never built out ("Worth a manual or sanctioned bulk route later" -- §1 rank 11); this lane is that route, applied
to photography.

## 3. How the corpus is built

`tools/museums/photod.py` (metadata) + `tools/photos_corpus.py` (orchestration, images, palettes, build) --
imports `tools/corpus.py` for network pacing, image handling, CIELAB k-means and CIEDE2000 naming, exactly as
`tools/design_corpus.py` does.

1. **meta**: a recursive breadth-first walk of three named Commons root categories (`ROOTS` in `photod.py`):
   `Photographs by Sergey Prokudin-Gorsky`, `Color photographs from the Farm Security Administration`,
   `Autochromes`. Each subcategory is visited once and cached; a short deny-list (`SKIP_SUBCAT`) prunes
   maintenance categories, "unidentified"/"needing categorization" branches, modern colorized recreations and
   stereoscopic duplicates. A per-root cap (2,200 files) and a per-tree visit cap (260 categories) keep one huge
   branch (autochromes has 50+ per-photographer subcategories) from starving the other two collections.
2. **Kept**: only files whose Commons `LicenseShortName` reads as PD-old / PD-US / PD-USGov / Public domain / PDM /
   CC0 (the same `OPEN`/`BAD` regex `commonsd.py` already uses for posters and stamps). CC BY / CC BY-SA files are
   dropped even where Commons allows them, matching the project's existing CC BY-SA policy
   (`design/LEGAL-COLOR-DATA.md` §7a: never redistribute ShareAlike text or images as if they were ours to give away
   freely -- images here are shown only through Commons' own thumbnail URL, never copied into the repo).
3. **images**: a ~200px analysis copy per kept candidate, cached like every other source in `research/_raw/`
   (gitignored; no image is committed).
4. **The color/black-and-white test (David's rule)**: a metadata-only filter is not reliable -- plenty of true
   autochromes and Kodachromes have titles that say nothing about color, and a few faded autochrome plates have
   gone to near-monochrome -- so the real downloaded pixels decide. Reusing `tools/corpus.py`'s 6-color CIELAB
   k-means palette, a candidate is dropped when:
   - its pixel-weighted mean chroma C* is below 2.0 (a plain black-and-white scan), or
   - its mean C* is below 14.0 **and** its cluster hues sit within a 20°-equivalent circular spread of each other
     (a single-hue wash: sepia toning, a faded or heavily color-shifted scan, cyanotype blue) -- this second test
     is what catches a toned monochrome that chroma alone would miss, since sepia and cyanotype both carry real,
     nonzero chroma.
   Both thresholds are printed in `data/photography/index.json` (`thresholds`) alongside the drop counts, so a
   later tightening or loosening is auditable against the same build.
5. **Naming and palette**: identical to the painting corpus -- auto-trim, 2% inset, ~120px area average, CIELAB
   k-means k=6 (a*/b* ×1.5 for clustering only), each palette color named by nearest of the app's core names
   (CIEDE2000), family assigned by the same `family()` hue/lightness/chroma rule.
6. **Output**: `data/photography/photos.json` (one row per kept photograph: `id, src, t (title), a (photographer),
   y (year), co (country), process, p (palette: [hex, share, name, family]), L, C, img, url, lic, category`) and
   `data/photography/index.json` (counts by process, decade, source category and photographer, plus the
   black-and-white/toned-monochrome drop counts and thresholds).

## 4. Famous photographers: what's usable and what isn't

Per `design/LEGAL-COLOR-DATA.md`'s R1 ("facts yes, libraries no") extended to images: a photographer's *name*,
*dates*, *what they're known for*, and a *link to their work elsewhere* are all facts we can state freely, same as
naming a Pantone color in context. Their actual photographs are not — almost the entire canon of color
photography as an art form is still in copyright (most photographers worked from the 1960s on, and US copyright
runs to 70 years past death or 95-120 years for a corporate work). The practical line, same shape as the Pantone
table in `design/LEGAL-COLOR-DATA.md` §8.7:

| Who | Mention by name, with dates/known-for | Show our own image | Why |
|---|---|---|---|
| Sergey Prokudin-Gorsky | ✅ | ✅ (PD, built here) | Died 1944; Russian Empire work, pre-1923 |
| FSA/OWI photographers (Delano, Lee, Vachon, Rothstein, Wolcott, Collier, Collins) | ✅ | ✅ (PD, built here) | US government work |
| Jules Gervais-Courtellemont, other named autochromists | ✅ | ✅ when their plates are in the PD "Autochromes" tree | Pre-1950s process, many already PD by date |
| William Eggleston, Stephen Shore, Saul Leiter, Steve McCurry, Joel Meyerowitz, Fred Herzog, Ernst Haas, Franklin McMahon, Harry Gruyaert | ✅ as history/context ("Eggleston's early-1970s dye-transfer prints are often credited with legitimizing color as a fine-art medium") | ❌ never | In copyright; no image anywhere, including a thumbnail, crop or AI "in the style of" |
| NASA/USGS-credited astronaut photographs (Earthrise, Blue Marble) | ✅ | Noted as a Phase 2 candidate (not yet in `data/photography/`) | US government work, genuinely PD, but single named images rather than a bulk category -- see §5 |

## 5. What's excluded and why

- **Everything black-and-white or sepia/cyanotype-toned**: by the chroma test in §3.4, counted and reported per
  build in `data/photography/index.json` (`dropped_black_and_white`, `dropped_toned_monochrome`).
- **Modern Kodachrome snapshots** (`Category:Kodachrome`, `Category:Photographs taken on Kodachrome film` and
  similar general film-stock categories): not walked at all. Those trees are overwhelmingly 1960s-2000s amateur
  and semi-pro work under CC BY-SA from Flickr uploads, not historic PD material, and mixing them in would both
  violate the CC BY-SA/no-redistribution rule and dilute the "historic process" framing David asked for.
- **loc.gov direct access**: blocked (§2); not pursued further, consistent with the project's standing rule never
  to bypass bot detection.
- **Famous in-copyright photographers' actual images**: never (see §4).
- **NASA/USGS iconic single images**: not yet built (needs a short hand-curated list rather than a category walk,
  since "Earthrise" and "Blue Marble" don't live in a clean PD-only bulk category on Commons without also pulling
  in unrelated, non-iconic NASA photos). Left for Phase 2 or a small follow-up pass.
- **Stereoscopic images, digital reconstructions/restorations/colorizations, and "unidentified"/maintenance
  categories**: pruned at the category-walk level (`SKIP_SUBCAT` in `tools/museums/photod.py`) since a colorized
  or AI-restored black-and-white photo is not a color photograph in the sense David means, and a maintenance
  category is not a collection.

## 6. Findings

Final build (2026-10-09, after the thumbnail width was raised from 320px to 800px for Phase 2's painting-page
hero images -- see §7): **4,471 PD/CC0 candidate files** (the three Commons collections plus the two hand-picked
NASA images), **3,465 kept as real color photographs** after the chroma test -- 176 dropped as plain
black-and-white (mean C* < 2.0, which is where both NASA candidates landed too, see §1 row 4) and 828 dropped as a
toned/near-monochrome scan (mean C* < 14.0 with all palette clusters within a ~20° hue spread -- sepia, faded dye,
heavy color shift), so the drop rate (22.7% of candidates) is itself a finding: a meaningful share of "historic
color photography" on Commons is a scan that has gone, or always was, nearly one hue.

By process: **Prokudin-Gorsky 1,390**, **Kodachrome (FSA/OWI) 1,042**, **Autochrome 1,033**. By decade: the
1900s-1910s (2,095 combined, almost entirely Prokudin-Gorsky and early autochromes) and the 1940s (927, almost
entirely FSA/OWI) are the two real peaks; single-digit counts before 1890 and after 1950 are incidental (a handful
of Commons files mis-dated or mis-categorized, not a real trend -- this archive has no 1950-1999 color-photography
coverage at all, since no PD bulk source for that period was found).

Top photographers by kept-photograph count (after merging "Last, First, 1903-1986, photographer"-style LOC
catalog names and Cyrillic/Latin spelling variants to one form -- `_clean_photographer()` in
`tools/museums/photod.py`): **Sergey Prokudin-Gorsky 1,232**, Jack Delano 408, Russell Lee 270, Auguste Léon 189,
Marion Post Wolcott 178, Sarah Angelina Acland 88, Stéphane Passet 69, Arthur Rothstein 69, Jules
Gervais-Courtellemont 42, Léon Busy 28, plus about 20 more autochromists and FSA photographers each with 5-30
photographs (full list in `data/photography/index.json`, `top_photographers`). 54 photographers reach the 3-photo
minimum for a photographer page (`tools/photos_corpus.py` `PHOTOGRAPHER_MIN_N`); `data/photography/photographers.json`.

Honest limits, same as every other corpus in this app: every color here is **as scanned** (glass-plate emulsions,
Kodachrome dye stability, decades of archival storage, and a digitization scanner's own color response all sit
between the original scene and the hex value shown), and a palette is a 6-color k-means of a ~200px image, so
shares are area shares, not exact pixel statistics. The same "screens are approximate" caveat on every other color
page in the app applies here too. The chroma thresholds (`mono_c`, `tint_c`, `tint_hue_spread`) are printed in
every build's `data/photography/index.json` so a later tightening is auditable against this one.

## 7. Phase 2: the Museum room, photographer pages, "In photographs", process notes

- **Museum door** (`js/photography.js`, `worldPhotographySection`): a tile in Museum → World, the same
  `WORLD_SECTIONS` extension point `js/pulp.js` already uses for pulp covers. Opens `#/photography`, a grid with
  filter chips for process, decade, country and photographer (same facet-chip pattern as `js/pulp.js`'s
  magazine/decade/artist chips); each tile opens the photo through `paintingPage()` (`js/explore.js`) unmodified
  in its core, with one small additive change: a photo's byline is a tappable link to its photographer's page
  when `n.photographerSlug` is set (every other node kind is unaffected, since that field is only ever present on
  a photography node).
- **Photographer pages** (`photographerPage()`, `#/photographer/<slug>`): built the way a simplified painter page
  is, reusing `js/artwiki.js`'s own generic helpers (`awBar`, `awChipName`, the `.aw-hl`/`.aw-page` styling) so the
  visual language matches the painter pages David already approved, rather than inventing a new one. Each page
  shows the photographer's most typical photograph (closest to their own mean lightness/chroma) and its palette,
  a "measured" section with percentile findings against the other 53+ photographers here ("darker than N%",
  "more vivid than N%" -- `tools/photos_corpus.py` `cmd_photographers()`, only stated when the percentile is past
  the middle third, same "not a middling percentile" judgment call `awExtreme()` makes for painters), every one
  of their photographs as a palette grid, and their least-typical photograph. Statistics are precomputed in
  Python at build time (never recomputed client-side), the same "measure, then tell" discipline as the painting
  corpus.
- **"In photographs"** (`data/photography/colorindex/`, `tools/color_index.py --items`, same mechanism
  `CI_SOURCES.design` already uses for the main design corpus): a color page's existing "In paintings" section
  (`js/paintingsof.js`) gains a "Photography" source automatically once `CI_SOURCES.photography` is registered
  (`js/colorindex.js`) -- no new section was built; the existing source switch just grows a third tab. A
  photograph's tile in that section is clickable (`js/paintingsof.js` `CI_SOURCES.photography.pin`,
  `ptOpenPhoto()`), unlike a design piece's tile, which still has no page to open.
- **Process notes** (`PH_PROCESS_NOTES` in `js/photography.js`): one short, original paragraph per process --
  Prokudin-Gorsky's three-filter sequential exposures, an autochrome's dyed starch-grain filter layer, Kodachrome's
  three stacked dye-coupled emulsion layers, and NASA's "it's just a camera" -- each ending in the same one-line
  caveat (decades-old plates/dyes/scans, not a lab original), shown behind a tap ("How &lt;process&gt; shapes
  color") rather than printed inline on every page, per the design doctrine's ban on repeated caveat paragraphs.
- **NASA/USGS**: see §1 row 4 and §6 -- tried, correctly excluded by the same chroma test as everything else.
- **A year-extraction bug found and fixed while building the grid's decade filter**: `photod.py`'s `_year_of()`
  originally searched a file's EXIF `DateTimeOriginal` before its title, and without digit-boundary checks on the
  year regex. That let LOC catalog numbers ("Gorskii 01700u"), Flickr source IDs ("4381579599") and even
  Rijksmuseum accession numbers ("RP-F-2000-21-61", where 2000 is the year the OBJECT entered the collection, not
  when the photograph was taken) masquerade as years, and let a Commons volunteer's 2010-2011 restoration-edit
  timestamp outrank the archival caption's real date. Fixed by reading the title first (where a curated archival
  caption states the real date), adding digit boundaries to the year regex, and stripping recognized
  accession-number shapes before searching. The decade chip row (`js/photography.js` `phFacets`) also filters out
  any decade under 1% of the kept archive, so a handful of remaining outliers (a document's own 1705, a church's
  construction year quoted in a caption) can't clutter the filter -- the single worst case this surfaced, a
  photographer's working-life span computed from raw min/max years, is trimmed to the middle 80% in
  `js/photography.js` `phpDraw()` for the same reason.
