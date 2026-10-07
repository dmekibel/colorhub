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
