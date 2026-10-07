# Botany: the plants behind the names, dye plants, why plants are colored, the language of flowers

Feature home (DESIGN.md rule 2): goal 3 (educate), tab Explore, lens **World** (shared with Fashion, js/world.js),
a second entry pushed onto `WORLD_SECTIONS`. Botany also adds an "In nature" row on color pages, additive to
and independent of Fashion's own "In fashion" row (`worldColorRow`).

## What's in the app

- **Explore → World → Botany**: a contents row of four tiles (Flowers & plants · Dye plants · Why plants are
  colored · Language of flowers), the same `.wd-tile` look Fashion uses. Code: `js/botany.js`, `css/botany.css`,
  data: `data/botany.js` (window.BOTANY), built by a one-off generator script (not checked in) from the
  private, read-only `color-kb/` described below.
- **Flowers and plants behind the names** (37 pages): every ColorHub color whose name traces to a plant
  (per `color-kb/botanical.json`'s own "named" tag) — Orange, Pink, Periwinkle, Maroon, Burgundy, Magenta,
  Lime, Mint, Sage, Olive, Lavender, Lilac, Mauve, Plum, Violet, Mustard, Tan, Chocolate, Charcoal,
  Cornflower, Cerise, Raspberry, Peach, Apricot, Tangerine, Marigold, Amber, Chartreuse, Pistachio, Moss,
  Thistle, Orchid, Mulberry, Aubergine, Ecru, Mahogany, Ash. Each page: the plant, why the color took its
  name (hedged dates), one surprising fact, and the plant's real color range versus the named color — all
  original prose, written from the facts in `color-kb/botanical.json` (itself drawn from public-domain
  sources) plus general reference. Magenta is flagged honestly as a battle name, not a plant name, with the
  fuchsine/fuchsia dye story told straight. Jade and Celadon are the two colors their own real plants would
  suggest but aren't, and Celadon's page (reached from its color page's "In nature" row) calls out the
  Celandine/celadon false-friend explicitly, per `botanical.json`'s own "false" tag.
- **Dye plants** (12 pages): madder, indigo and woad, weld, safflower, logwood, brazilwood, turmeric, henna,
  walnut, onion skins, rock lichens (orchil/cudbear/litmus), saffron. Each: what color(s) it gives, a
  hedged history, and an honest note (what replaced it, what it was really used for, a caveat). Original
  prose; madder/indigo/brazilwood/lichens/saffron are cross-referenced against `color-kb/botanical.json`'s
  own "dye" entries, the rest (weld, safflower, logwood, turmeric, henna, walnut, onion skins) from general
  reference, since `botanical.json` doesn't tag them to a specific ColorHub color.
- **Why plants are colored** (4 essays): chlorophyll and why autumn leaves change (carotenoids revealed,
  anthocyanins made fresh — grounded in `color-kb/atoms.jsonl`'s Goethe excerpts, which already described the
  pattern in 1810 without the chemistry); why true blue flowers are rare (anthocyanin chemistry, pH,
  co-pigments, also Goethe-grounded); flower color and pollinators (bees see ultraviolet and read red poorly;
  Grant Allen's 1879 "beacons for crude eyes" sketch, also in `atoms.jsonl`); structural color in plants
  (Pollia condensata, the most intense known natural blue, made with no blue pigment at all — standard,
  widely reported botany, not from the private modern-book notes).
- **The language of flowers** (`js/botany.js`'s `btFloriPage`): all 712 entries of `color-kb/floriography.json`
  (Kate Greenaway, *Language of Flowers*, 1884, public domain), searchable by flower name and filterable by
  color family (reusing `psgFam`/`PSG_FAMS` from js/passages.js); 196 of the 712 are matched to a ColorHub
  color and link straight to that color's page, the rest are listed by name and meaning only. Framed
  throughout as a Victorian parlor tradition that different 19th-century dictionaries disagreed on, per
  CLAUDE.md's honesty rule — never as a fact about flowers.
- **Werner's 1821 pairings**: `color-kb/werner.json` (Patrick Syme's edition of Werner's *Nomenclature of
  Colours*, public domain; 110 entries, each with an animal/plant/mineral example and its nearest ColorHub
  color by CIEDE2000) is embedded in `data/botany.js` in full. Rather than a separate page, Werner's plant
  pairing surfaces directly inside the "In nature" row on the matching color's own page (`botanical.json`'s
  "werner" tag already names the Werner color in its `detail` text, e.g. "Werner's Scarlet Red"), reaching
  42 of the 101 colors.
- **"In nature" row on a color page** (`btRow(c)`, hooked from `colorPage()` in js/explore.js, right next to
  Fashion's own `data-world-in` hook — the two are independent, additive sections, not a shared slot):
  built straight from `botanical.json`'s per-color entries (all tag types: named, dye, werner, flori,
  tradition, garden, false), not just the 49 colors with a deep-dive page. A "named" or "dye" entry links to
  its page when one exists; everything else (Werner's pairing, a Victorian meaning, a garden note, a false
  friend) renders as a plain, honest fact line with no invented link.
- **Addresses**: `#/botany/<id>` for the 37+12+4 deep-dive pages (`nodeRoute()` in router.js, one line,
  reusing the existing `["wikiPage", nodeRouted()]` wrap — these are ordinary graph nodes, so they also get
  Explore's search, Saved heart, and "More like this" pins for free) and `#/botany/plants|dyes|essays|flori`
  for the four list/index screens (two `ROUTED` lines wrapping `btListPage`/`btFloriPage`, mirroring
  `fashionPage`'s one-line pattern).
- **Screenshot hooks** (`index.html#shot=…`): `botany:world`, `botany:plants|dyes|essays`, `botany:flori`,
  `botany:plant:<id>`, `botany:dye:<id>`, `botany:essay:<id>` (`js/boot.js` → `js/botany.js`).

## Sources (all public domain unless noted)

- `color-kb/botanical.json` — plant/flower links for all 101 ColorHub colors, itself tabulated (by the
  private KB, read-only here) from: Patrick Syme's *Werner's Nomenclature of Colours* (1821), Kate
  Greenaway's *Language of Flowers* (1884), Cennino Cennini's *Il Libro dell'Arte* (c. 1400), Pliny's
  *Natural History* (1st c. CE), Gertrude Jekyll's *Colour in the Flower Garden* (1908), Robert Ridgway's
  *Color Standards and Color Nomenclature* (1912), George Field's *Chromatography* (1835), the
  pseudo-Aristotelian *On Colours*, Goethe's *Theory of Colours* (1810), Grant Allen's *The Colour-Sense*
  (1879), Edwin Babbitt's *The Principles of Light and Color* (1878). Two occult sources (Crowley's *777*,
  Waite's alchemical compilations) are cited only where the KB's own color-to-plant tag used them, and are
  labeled on the page as not scientific or historical sources.
- `color-kb/floriography.json` — Kate Greenaway, *Language of Flowers* (1884), public domain.
- `color-kb/werner.json` — Patrick Syme's 1821 edition of Werner's *Nomenclature of Colours*, public domain.
- `color-kb/atoms.jsonl` — claims excerpted from the public-domain classics above, used only for the four
  essays (chlorophyll/autumn, rare blue flowers, pollinators, structural color), rewritten in original prose.
- The private, copyrighted modern color books in `color-kb/books/` were **not** used for Botany's facts or
  prose, except where general, uncontested science (dye-plant history: weld, safflower, logwood, turmeric,
  henna, walnut, onion skins; structural color) was cross-checked against them for accuracy and then written
  independently, per CLAUDE.md's book rule.

## Honesty notes

- Dates are hedged ("recorded from the 1600s", "by the 1800s") wherever the KB itself didn't give a precise
  first-use year; nothing is stated more precisely than the source supports.
- Every plant/dye page states the real plant's or dye's actual color range against the single named
  ColorHub swatch, per CLAUDE.md's instruction not to flatten a living thing into one hex code.
- The language of flowers is introduced, and reintroduced on every screen that touches it, as a 19th-century
  parlor tradition whose dictionaries disagreed with each other — never as settled fact.
- Werner's and Greenaway's own occasional factual claims (e.g. the plant identification behind a given
  color) are reported as their claims, not independently re-verified beyond the private KB's own
  cross-checking against modern botanical names.
