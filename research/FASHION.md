# Fashion: decades, Pantone's Color of the Year, houses, history

David (2026-10-07): "Fashion can be more about color trends in fashion, like the 90s. Every year there's new
color trends, famous high-fashion pieces, but also couture and fashion history. All of that is interesting."

Feature home (DESIGN.md rule 2): goals 3 (educate) and 4 (archive palettes), tab Explore, new lens **World**
(tier 2.5: a lens beside Colors/Paintings/Poems/Ideas, not a fifth tab), Fashion is its first section. Botany
and Gems are meant to join the same lens later from other files, each pushing one entry onto `WORLD_SECTIONS`
(see `js/world.js`).

## What's in the app

- **Explore → World → Fashion**: a contents row of four parts (Decades · Color of the year · Houses ·
  History), each a quiet tile. Code: `js/world.js`, `css/world.css`, data: `data/fashion.js`.
- **Decades** (13, 1900s–2020s): a named 5-7 color palette, a paragraph on why those colors (dyes, film,
  economy, war), 2-3 iconic pieces described in words, and a hedge where the "decade palette" is a
  simplification (which is often).
- **Pantone Color of the Year**: the full 2000–2026 list (name, approximate hex, one-line context), clearly
  labeled approximate and that Pantone® is a trademark of Pantone LLC, plus a short note on how trend
  forecasting actually works (mills, fiber fairs, WGSN, Pantone's own Color Institute) and its real limits
  (nothing measures whether a pick is "right"; it is announced after fabric choices are mostly already made).
  This is a second, denser, year-by-year treatment alongside the existing `color-of-the-year` page in
  `data/wiki-nodes.js`, which the two cross-link.
- **Houses** (15 signature colors): Schiaparelli, Valentino, Hermès, Tiffany & Co., Chanel, Yves Saint
  Laurent, Dior, Balenciaga, Missoni, Pucci, Lanvin, Christian Louboutin, Bottega Veneta, Barbiecore
  (Mattel/Valentino), Gucci (Tom Ford era). Each: the color, the story, a hedge where the claim is soft, and
  sources. Tiffany and Louboutin are described as trademark holders, never implied to be the official
  published color value.
- **Fashion history** (10 pages): purple and the law (Rome/Byzantium), Tudor/Elizabethan sumptuary law, Edo
  Japan's "forty-eight browns, a hundred greys", Heian kasane (layered colors), mourning dress in the 1800s,
  the aniline-dye craze, arsenic-green dresses, khaki/field grey/camouflage, denim as workwear first, pink
  and blue for babies.
- **"In fashion" row** on a color page: decades and houses whose signature color sits close (CIEDE2000) to
  that color, lazily matched in `worldColorRow` (js/world.js), hooked from `colorPage()` in `js/explore.js`.
- **Addresses**: `#/explore/world` (the lens; `LENS_ROUTE.world` in `js/router.js`) and `#/fashion/<slug>`
  (`decades`, `decade-<id>`, `coty`, `houses`, `house-<id>`, `history`, `history-<id>`), via one `ROUTED` line
  wrapping `fashionPage` and one `simple.fashion` case in `openRoute()`.
- **Screenshot hooks** (`index.html#shot=…`): `world`, `fashiondecade[:id]`, `fashioncoty`,
  `fashionhouse[:id]`, `fashionhistory[:id]` (`js/boot.js` → `worldShot`, `js/world.js`).

## Honesty notes (CLAUDE.md myth list)

- "Queen Victoria started the white wedding dress" is not stated; the pink-for-girls and jeans-as-rebel myths
  are covered only to correct them (`pink-blue-babies`, `denim-workwear`), citing Del Giudice (2012, 2017)
  and Paoletti (2012) for the pink/blue reversal, and Pastoureau (2001) for jeans only picking up a rebel
  meaning in Europe from the late 1960s.
- Chanel is explicitly **not** credited with inventing the black dress (the "little black dress" entries in
  the 1920s decade and the Chanel house page both say evening black predates 1926), and the "Chanel's Ford"
  Vogue nickname is flagged as a famous line of uncertain origin.
- Mauveine is called "the first aniline dye", never "the first synthetic dye" (picric acid dyed Lyon silk in
  the 1840s) — `aniline-craze`.
- Napoleon and arsenic wallpaper is called unproven, with the stomach-cancer explanation given as the
  researchers' preferred one — `arsenic-green`.
- The navy-uniform "king's favorite" story, Mary Quant vs. Courrèges vs. John Bates on the miniskirt's
  origin, who coined "millennial pink", and the Fra Angelico story behind Lanvin blue are all hedged as
  popular but unverifiable/contested claims, not fact.
- Pantone® and Tiffany Blue/the Louboutin red sole are named as trademarks; no hex anywhere is presented as
  an official published value — every swatch says "approximate" in its own section intro.
- Barbiecore and "quiet luxury" (2020s decade, Barbiecore house entry) are flagged as a short, still-unsettled
  media trend rather than a historical house signature, and the whole 2020s decade entry carries a hedge that
  the decade isn't over yet.

## Sources

Facts were checked against `../color-kb/books/notes.jsonl` (claims from 25 color books) where a claim
appears there, and against general fashion-history scholarship (Pastoureau, Paoletti, Garfield, Ball,
Matthews David, Steele/Kyoto Costume Institute, Metropolitan Museum of Art Heilbrunn Timeline, museum
object records) via web search for the rest, cited per entry in `data/fashion.js`. No text is copied from
`../color-kb/books/`; prose is original, and no quoted line runs 15 words or more.

## Images

Light, per the brief: public-domain pre-1929 Wikimedia Commons images only, hotlinked (no local copies),
at most one per page, with credit and license. Verified individually (license + direct file path) before use:

| Page | File | License |
|---|---|---|
| Decade: 1920s | *Thayaht – Gazette du bon ton – Un manteau de Madeleine Vionnet* (1922) | CC0 (Museum of Fine Arts, Boston) |
| History: Tudor sumptuary law | *Elizabeth I, the "Darnley Portrait"* (c. 1575) | Public Domain Mark 1.0 (National Portrait Gallery) |
| History: Edo browns and greys | *Kitagawa Utamaro ukiyo-e woodblock print* (bijin-ga) | PD-old-100 |
| History: mourning dress | *Fashion Plate (Evening Mourning Dress)*, Rudolph Ackermann, Dec. 1810 | Public domain (LACMA) |
| History: pink and blue for babies | Thomas Gainsborough, *The Blue Boy* (c. 1770) | Public Domain Mark 1.0 (The Huntington Library) |

Thumbnail URLs use Wikimedia's fixed `$wgThumbnailSteps` widths (20/40/60/120/250/330/500/960/1280/1920/3840
px) — arbitrary widths now 400 with "Use thumbnail sizes listed on https://w.wiki/GHai", so every image here
requests **500px**. All five were checked with a direct HTTP request before being written into the data file.

## Checks run

`node tools/check.js`, `node tools/check_wiki.js`, `node tools/check_names.js` (0 failures on all three;
`data/fashion.js` isn't read by `check_wiki.js`, by design — it has its own shape, not the wiki-node schema),
`node --check` on every `.js` file, and a handful of direct HTTP checks on the five hotlinked image URLs
above (first attempt used non-standard widths and got Wikimedia 400s; fixed to the 500px step).

---

## Second fashion job, merged in (recovered 2026-10-08)

A second, separate fashion job (David: "fashion history ... can be a very complicated, nuanced thing") was cut off before it committed. It had 25 history pages as wiki nodes, a garment archive from museum open access, and its own Ideas section. It overlapped this one: ten of its pages are the same ten as above. The merge kept the World screens above as the one place for fashion and added what was new.

### What the merge added

Fashion lives in **Explore → World → Fashion** (`js/world.js`, data `data/fashion.js`): Decades, Pantone Color of the Year, Houses and History. This recovery merged a second, separate fashion job into those screens instead of adding a duplicate section.

- **History** (`data/fashion-history.js`, lazy): the 25 fashion pages below, in titled sections, chronological. Ten of them are the same pages the first job wrote into `data/fashion.js` (same ids; the longer version replaces the shorter one and the existing photos are kept); fifteen are new. Links in the text use the color web (`[[Name|label]]`) and `[[#history:id|label]]` between pages.
- **Garments** (`js/fashion.js`, `css/fashion.css`, `data/fashion/garments.json`, lazy): a fifth tile in World's Fashion section. The browser searches 991 museum pieces by color (a ribbon of the app's colors; the score is how much of the garment's measured area lies within CIEDE2000 6 of the color, fading to zero at 16), era and culture group, and text. The grid is virtualized. A garment page shows the photograph (hotlinked from the museum), six measured colors with shares (each one tap to its color page), date, culture, medium, maker, museum credit and record link, and similar palettes.
- **"In fashion" row** on every color page now holds both: decades and houses close to the color (`worldColorRow`), then a strip of garments where that color covers the most cloth (score 0.3 or more).
- Addresses: `#/fashion/garments`, `#/fashion/garment-<id>`, `#/fashion/history-<id>`. Screenshot hooks: `garments[:Color]`, `garment[:id]`, `fxcolor[:Color]`, `fashionhistory[:id]`.

#### The 25 history pages (ids in data/fashion-history.js)

1. Purple and the law (Rome, Byzantium) · 2. Who could wear scarlet (medieval and Tudor sumptuary law) ·
3. Forty-eight browns, a hundred greys (Edo) · 4. Kasane: colors in layers (Heian) · 5. Imperial yellow and the dragon
robe · 6. Indian cotton: chintz, madder and indigo · 7. Batik and ikat · 8. Wax prints · 9. Kente and adinkra ·
10. Andean cloth · 11. Black in fashion · 12. White: muslin, laundry and the wedding dress · 13. Mourning dress in the
1800s · 14. The aniline craze · 15. Arsenic green dresses · 16. Khaki, field grey and camouflage · 17. Navy blue and
the uniform · 18. Denim: work clothes first · 19. Pink and blue for babies · 20. Schiaparelli and shocking pink ·
21. Dior's New Look and postwar color · 22. 1960s: mod, space age and psychedelia · 23. Punk and black ·
24. Who decides next year's colors? (forecasting) · 25. Fast fashion and the cost of dye.

Skipped: **hijab and modest-fashion color**. There was not enough solid, citable scholarship on color specifically
(as opposed to modest fashion generally) to write an honest page; it waits for better sources.

#### Honesty notes
- Myths from CLAUDE.md are only stated to be corrected: "Queen Victoria started the white wedding dress" (she
  popularized it; Mary, Queen of Scots wore white in 1558 and French and Italian brides wore white in the 1830s,
  per Pastoureau), "pink was always for girls" (Paoletti; Del Giudice 2012 on the thin evidence for a full reversal),
  "jeans were always rebel clothing" (Pastoureau), Napoleon and arsenic wallpaper (unproven), mauveine as "first
  synthetic dye" (only "first aniline dye"), the navy-blue "king's favorite" story (legend), the "half the world wears
  jeans" line (not used).
- Hedged: Edo "48 browns, 100 greys" is a saying (numbers mean "countless"); kasane lists were written down after the
  Heian period and disagree; kente color-meaning lists are recent and loose (Ross); the adinkra Gyaman legend vs. the
  1817 Bowdich cloth; the denim and jeans etymologies; the Gold Coast soldiers as one factor in wax-print taste;
  Chanel did not invent the black dress; the "20% of industrial water pollution" figure is widely cited but poorly
  sourced; Pantone's influence is unmeasured.
- Facts come from the private book notes (`../color-kb/books/notes.jsonl`) where two books agree, and from web checks
  for the rest (kasane, Edo edicts, Qing 1759 regulations, wax-print history, adinkra, khaki 1846, Royal Navy 1748,
  Schiaparelli 1937, Pink/blue 1918 and Del Giudice, EMF 2017). Prose is original; no quotation over 15 words.

### The garment archive (tools/fashion.py → data/fashion/garments.json)

Run `python3 tools/fashion.py ids | meta | images | palettes | build | figs | check`. Raw caches live in
`research/_raw/fashion/` (gitignored). Every request sends `ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)`.

| Source | Route | License kept | Notes |
|---|---|---|---|
| The Met | Collection API: v1.1 search (60 queries across cultures), then /objects/{id} | isPublicDomain + image | Its Incapsula bot shield returned 403 to 6 and then 2 parallel threads; the tool now runs one thread with a 2 s gap and pauses 10 minutes on a 403. That pace (~17 records a minute) limited how many of the 6,773 candidate ids were fetched (see counts). Images: "mobile-large" (~360px) for analysis and grids, "web-large" on the garment page. |
| Cleveland Museum of Art | Open Access API, type Textile, cc0, has_image | CC0 | 2,137 textiles; capped per culture group so fragments don't swamp the set. Mummy wrappings dropped. |
| Art Institute of Chicago | API search (7,485 PD textiles and costume) | — | **Off.** Its IIIF image server now answers scripts with a Cloudflare bot challenge (403, `cf-mitigated: challenge`); the tool does not try to get past it. |
| Rijksmuseum, Cooper Hewitt, Smithsonian, LACMA | — | — | Skipped: no simple key-free image route (Rijksmuseum), API key required (Cooper Hewitt, Smithsonian), no public API (LACMA). No accounts were created. |

Selection: Met records must be public domain with an image, a garment or textile by object name (accessories such as
shoes, hats, fans, jewelry, buttons, bags, prints and dolls are dropped), and a fabric medium. Culture group comes from
the culture, country, region, period and dynasty fields (regex table `GROUP_RX`), falling back to the department
(Costume Institute → Europe and North America) or the search that found it. Era is the mid-point of the date range.

#### Palette method (and how the studio backdrop is removed)
Reuses `tools/corpus.py` (color math, `autotrim`, k-means). Per image: trim uniform border bands, shrink to 120px on the
long side by area averaging, convert to CIELAB (D65). Garment photographs are mostly a dress on a form against flat
studio paper (white, grey or black, often with a soft gradient), so the backdrop is estimated and masked before
clustering (`backdrop()`):

1. **Ring test.** The backdrop color is the median of the outer 2-pixel ring. A real backdrop is flat: at least 70% of
   ring pixels within ΔE76 10 of the median and a median distance under 6. Textiles shot edge to edge have a busy ring
   and get no mask (a 2% inset is dropped instead, as corpus.py does).
2. **Region growing.** Seeds are ring pixels within 10 of the median. The region grows to 4-neighbors whose color is
   within ΔE 2.6 of the neighbor that reached them (so a smooth light-to-dark sweep of paper is followed) and within 20
   of the ring median (so it never wanders deep into a garment of similar color). Garment edges are a sharp step, so
   growth stops there.
3. **Sanity.** Masks under 3% are ignored. Over 88% means a pale garment leaked into a pale backdrop: the growth is redone
   with half the limits, and if it still covers over 88%, no mask.

Then k-means (k = 6, k-means++ seeding, best of 4, a*/b* weighted 1.5 for clustering only); each color is the plain Lab
mean of its pixels, share = pixel area. Contact sheets (`python3 tools/fashion.py sheet`) show image | kept mask |
palette for spot checks. Known limits: dress forms, stands and shadows can survive as greys or browns; faded or
discolored textiles are measured as they look now; museum photo lighting varies.

### Counts
- 991 garments and textiles: 825 from the Cleveland Museum of Art (CC0), 166 from the Met (public domain). Culture groups: Europe and North America 343, Indigenous Americas 163, India 160, Middle East and Central Asia 90, China 90, Japan 90, Indonesia and Southeast Asia 53, Africa 14, Korea 5. Africa and Korea are thin: the open-access collections hold little there.
- 17 rows whose titles name a mummy (linen wrappings, bundles, masks) were removed at recovery: they are human remains, and the method above says they are dropped. `tools/fashion.py` is not changed, so a rebuild would bring them back unless its title filter is tightened.
- `data/fashion/garments.json` is 0.56 MB, fetched on first use of Garments or a color page's garments strip, never at start.

### Known gaps after the merge
- `tools/fashion.py figs` and the page half of `check` were written for the pages as wiki nodes (`data/wiki-nodes.js` plus photographs in `data/images.js`). The pages now live in `data/fashion-history.js`. Only the four that already had a Commons photograph in `data/fashion.js` (Tudor scarlet, Edo, mourning dress, pink and blue) show one; the rest have none yet. The garment half of the tool (`ids`, `meta`, `images`, `palettes`, `build`) is unaffected.

---

## Measured eras -> measured decades (2026-10-09, after David: "A couple palettes from a couple garments is not true archive data")

The first "Measured eras" pass (1700s/1800-1849/1850-1899, 991-piece CC0 corpus only) was too thin, and had
nothing for 1900s-2020s at all: the Met + Cleveland corpus's western-group rows are almost entirely pre-1900
(343 rows total; 15 of those fall 1900-1959). Rather than invent 1900s-2020s coverage the CC0/PD sources don't
have, a second source was added under the rights rule in the brief (CC0/PD = display; anything else = measure
only, never store the image):

### `tools/fashion_va.py` — Victoria and Albert Museum, measure-only
- API: `https://api.vam.ac.uk/v2/objects/search` — no key, no account, generously rate-limited (the Collections
  API Guide at developers.vam.ac.uk documents `year_made_from`/`year_made_to`, free-text `q`, and
  `_images._primary_thumbnail` directly in search results, so no per-object lookup is needed).
- Rights: V&A photographs are **(c) Victoria and Albert Museum, London**, not CC0/public domain (confirmed via
  `GET /v2/object/<id>`, whose `meta.images._images_meta[].copyright` field names the museum, not a CC0/PD
  mark). Per the rights rule, this tool never stores or displays a V&A image: `measure()` fetches each small
  thumbnail to a worker-local temp file, runs `tools/fashion.py`'s `palette_of()` (the same backdrop-removal +
  k-means built for studio garment photography) on it, deletes the file in a `finally` block, and keeps only
  hex values + catalogue metadata (object type, date text, place, maker, V&A record URL — no image URL).
- Search: 1700-2020 in 10-year steps x nine garment-type terms (dress, coat, suit, waistcoat, gown, shawl,
  uniform, blouse, trousers), capped at 260 ids per decade after dedup, one page per (decade, term) query —
  5,798 ids found, every decade 1700s-2020s landing between 101 and 260.
- Measure: thumbnail fetch + palette extraction, 5 worker threads (paced individually, so aggregate load on
  the V&A's image CDN — framemark.vam.ac.uk, built to serve many concurrent thumbnails — stays moderate; the
  search API itself is hit far less, one request per (decade, term)). UA names the bot and states "measure-
  only, no image retained". Resumable: reruns skip ids already in `research/_raw/fashion/va/palettes.jsonl`.
- Output: `data/fashion/va-measured.json` — hex palette + metadata only, no `img` field on any row, so the
  Garments browser and any image-rendering code can never accidentally display one (it only reads
  `garments.json`, the CC0/PD file, for photos).

### `tools/fashion_measure.py` — rewritten for real per-decade counts
Buckets every row from both `garments.json` (CC0/PD) and `va-measured.json` (measure-only) into its actual
decade, 1700-2020 (`decade_of(year)`), and reports the **real combined count per decade**, labeled `bare`
(<8), `thin` (8-59) or `thick` (60+) rather than padded to look uniform. A garment-kind split (dress /
menswear / accessory / other, via object type for V&A rows, title regex for CC0 rows) is only computed where
that slice has >=8 pieces. Output: `data/fashion/measured-decades.json`, with both a `decades` array (33
entries) and an `eras` array (the same three 1700s/1800-1849/1850-1899 bands as before, now combining both
sources) so the "Deep reads" long-form pages and the per-decade Decades pages share one source of truth.

### Sources not pursued, and why
- **Smithsonian Open Access** (`api.si.edu`, key-free `DEMO_KEY` works): National Museum of American History
  costume records return, but `content.descriptiveNonRepeating.online_media` came back empty on every record
  tried (including ones the search marked `online_media_type:Images`) — not enough budget in this pass to dig
  further into why; worth another look.
- **Rijksmuseum, Europeana, NYPL Digital Collections, Cooper Hewitt**: each needs a registered API key via a
  web form; no key was available in this session and none could be obtained without a human completing that
  signup, so these were skipped rather than scraped around.
- **Art Institute of Chicago**: metadata API is open and CC0, but its IIIF image server (`www.artic.edu/iiif`)
  still answers a plain request with a 403 (tested again 2026-10-09) — the same Cloudflare bot challenge noted
  in the first pass. Metadata without images isn't useful for a color corpus, so still off.
- **Fashion plates and magazine scans** (NYPL, Internet Archive, HathiTrust): not attempted. A full scanned
  page isn't a cropped garment photo — extracting a reliable garment-only palette from a plate or a magazine
  spread needs real crop/segmentation work this pass didn't have time for, so it's a gap, not a dead end.

