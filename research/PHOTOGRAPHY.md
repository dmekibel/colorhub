# Color photography by color: feasibility, sources and method

Built 2026-10-09 for ColorHub's photography lane. David: "Treat famous photographers and famous photos the same
way as paintings... except black-and-white photos, since this app is about color. Build an archive of color
photographs." Same pipeline shape as the painting corpus (`tools/corpus.py`) and the design corpus
(`tools/design_corpus.py`): keyless, resumable, public-domain-only, and every claim carries its n.

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
| 4 | **NASA / USGS** (Earthrise, Blue Marble, and similar single iconic images) | Not bulk-fetched; referenced by name/link only in this phase | A handful of globally famous PD color photographs that don't belong to any bulk category | Public domain (US government work) | **Noted, not yet ingested** -- see §4. Phase 2 candidate: a small hand-picked list, same treatment as a named Color-of-the-Year entry in `design/LEGAL-COLOR-DATA.md`. |
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

Final build (2026-10-09): **4,469 PD/CC0 candidate files**, **3,408 kept as real color photographs** after the
chroma test -- 178 dropped as plain black-and-white (mean C* < 2.0) and 883 dropped as a toned/near-monochrome
scan (mean C* < 14.0 with all palette clusters within a ~20° hue spread -- sepia, faded dye, heavy color shift),
so the drop rate (23.8% of candidates) is itself a finding: a meaningful share of "historic color photography"
on Commons is a scan that has gone, or always was, nearly one hue.

By process: **Prokudin-Gorsky 1,383**, **Kodachrome (FSA/OWI) 1,015**, **Autochrome 1,010**. By decade: the
1900s-1910s (2,074 combined, almost entirely Prokudin-Gorsky and early autochromes) and the 1940s (899, almost
entirely FSA/OWI) are the two real peaks; single-digit counts before 1890 and after 1950 are incidental (a handful
of Commons files mis-dated or mis-categorized, not a real trend -- this archive has no 1950-1999 color-photography
coverage at all, since no PD bulk source for that period was found).

Top photographers by kept-photograph count (after merging "Last, First, 1903-1986, photographer"-style LOC
catalog names and Cyrillic/Latin spelling variants to one form -- `_clean_photographer()` in
`tools/museums/photod.py`): **Sergey Prokudin-Gorsky 1,226**, Jack Delano 397, Russell Lee 261, Auguste Léon 186,
Marion Post Wolcott 176, Sarah Angelina Acland 85, Stéphane Passet 69, Arthur Rothstein 69, Jules
Gervais-Courtellemont 40, Léon Busy 27, plus about 20 more autochromists and FSA photographers each with 5-30
photographs (full list in `data/photography/index.json`, `top_photographers`).

Honest limits, same as every other corpus in this app: every color here is **as scanned** (glass-plate emulsions,
Kodachrome dye stability, decades of archival storage, and a digitization scanner's own color response all sit
between the original scene and the hex value shown), and a palette is a 6-color k-means of a ~200px image, so
shares are area shares, not exact pixel statistics. The same "screens are approximate" caveat on every other color
page in the app applies here too. The chroma thresholds (`mono_c`, `tint_c`, `tint_hue_spread`) are printed in
every build's `data/photography/index.json` so a later tightening is auditable against this one.
