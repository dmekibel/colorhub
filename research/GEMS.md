# Gems: the minerals behind the colors, why gems are colored, play of color, color change

Feature home (DESIGN.md rule 2): goal 3 (educate), tab Explore, lens **World** (shared with Fashion and
Botany, `js/world.js`), a third entry pushed onto `WORLD_SECTIONS`. Gems also adds an "In gems" row on color
pages, additive to and independent of Fashion's "In fashion" row and Botany's "In nature" row.

## What's in the app

- **Explore → World → Gems**: a contents row of two tiles (Gems · Why they're colored), the same `.wd-tile`
  look Fashion and Botany use. Code: `js/gems.js`, `css/gems.css`, data: `data/gems.js` (window.GEMS), loaded
  lazily the same way `data/botany.js` is (a `<script>` tag `js/gems.js` creates itself, not in index.html).
- **Gems and minerals** (29 pages): ruby and sapphire (corundum: chromium vs. iron+titanium charge
  transfer), emerald, aquamarine, morganite (beryl family), amethyst, citrine (quartz), garnet (the
  pyralspite series), peridot, topaz, tourmaline (incl. watermelon, Paraíba), spinel (the Black Prince's Ruby),
  opal, pearl, coral, jet, lapis lazuli, turquoise, jade (jadeite vs. nephrite), malachite, azurite,
  cinnabar, amber, diamond and colored diamonds (the Hope Diamond's boron blue), alexandrite, tanzanite,
  moonstone, labradorite, rose quartz. Each page: the mineral (or material), the element/structure that
  causes its color, a hedged slice of history and culture, a myths line where one applies, a curated palette
  of 2–4 typical shades, and — for the six entries ColorHub's own 101 colors are literally named after
  (Emerald, Jade, Amber, Turquoise, Malachite, Amethyst, Coral) — a short page that links to the existing,
  fuller color-page writeup rather than duplicating it, plus whatever the gems-specific angle adds (the
  beryl-family chemistry behind emerald, the pyrite-not-gold myth for lapis lazuli, and so on). All original
  prose, written from facts (not copied text) in `color-kb/books/notes.jsonl` (source `jewels-finlay`, Victoria
  Finlay's *Jewels: A Secret History*, 2006 — 84 notes covering amber, jet, pearl, opal, peridot, beryl,
  corundum, diamond, alexandrite, garnet, jade, azurite and tourmaline) plus general web reference (GIA, Mindat,
  Smithsonian, Wikipedia — see each page's own Sources).
- **Three essays**: "Why gems are colored" (idiochromatic vs. allochromatic color, charge transfer, color
  centers — ties together ruby/emerald/alexandrite's shared chromium, sapphire's iron-titanium pair, and
  amethyst/topaz/diamond's radiation-made color centers), "Play of color" (structural color with no pigment
  at all — opal's ordered silica spheres, labradorite's and moonstone's thin-film interference, pearl's
  nacre), "Color change and pleochroism" (two distinct effects often confused: alexandrite's light-source-
  dependent color change vs. tanzanite/tourmaline/ruby's viewing-angle-dependent pleochroism).
- **"In gems" row on a color page** (`gmRow(c)`, hooked from `colorPage()` in js/explore.js, right next to
  Botany's own `btRow(c)` hook — the two are independent, additive sections): two kinds of hit, a color one
  of the 29 gems is literally named after (`data/gems.js`'s own per-gem `colors` list, only populated for the
  six true matches) and a color that simply sits close, by CIEDE2000, to one of a gem's curated palette
  shades — the same proximity trick `js/world.js`'s `worldColorRow` uses for Fashion's "In fashion" row.
- **Addresses**: `#/gem/<id>` for the 29+3 detail pages (`nodeRoute()` in router.js, one line, reusing the
  existing `["wikiPage", nodeRouted()]` wrap — these are ordinary graph nodes, so they also get Explore's
  search, Saved heart, and "More like this" pins for free) and `#/gem/gems` / `#/gem/essays` for the two
  list screens (one `ROUTED` line wrapping `gmListPage`, mirroring `fashionPage`'s and `btListPage`'s own
  one-line pattern), plus one line in `openRoute()`'s kind dispatch.
- **Images**: seven of the 29 gem pages carry one hotlinked Wikimedia Commons thumbnail each (ruby, the Hope
  Diamond, precious opal, labradorite, alexandrite's color-change pair, the Imperial State Crown for spinel's
  Black Prince's Ruby, and lazurite/pyrite/calcite for lapis lazuli), each public domain or CC BY/BY-SA with
  credit and a license link. Rather than a bespoke figure renderer, the image entries (`data/gems.js`'s
  `images` map, `{ src, w, h, alt, caption, credit, license, licenseUrl, commons }`, keyed by graph node id)
  are merged into the shared `window.WIKI_IMAGES` object by `gmBuildNodes()` in js/gems.js, so the app's own
  generic `figHTML()`/`wikiPage()` picks them up with no changes to js/explore.js at all — the merge re-runs
  on every graph rebuild so it survives `data/images.js` later replacing `WIKI_IMAGES` wholesale. The other
  22 entries have no image (economical, "light images" per the brief): a curated palette carries the color
  story instead.
- **Screenshot hooks** (`index.html#shot=…`): `gems:world`, `gems:gems`, `gems:essays`, `gems:gem:<id>`,
  `gems:essay:<id>` (`js/boot.js` → `js/gems.js`, mirroring the existing `botany:…` cases inline).

## Sources

- `color-kb/books/notes.jsonl`, source `jewels-finlay` (Victoria Finlay, *Jewels: A Secret History*, 2006) —
  84 fact notes, confidence-tagged (`solid` / `author-says-uncertain` / `contested`), used for history,
  etymology and culture throughout. Per `CLAUDE.md`'s book rule, the book itself is copyrighted and was never
  read or copied into this repo — only the extracted facts in `notes.jsonl` were used, rewritten as original
  prose, with the one exception of Cennino Cennini's and Thomas Nicols's own centuries-old (public-domain)
  quoted lines, same as the existing `ultramarine-pigment`/`malachite-pigment` wiki pages already do.
- GIA (gia.edu) description and quality-factor pages for corundum, sapphire, topaz, spinel, tourmaline, and
  GIA research notes on pink/blue diamond color causes and the alexandrite effect.
- Mindat.org and academic sources (ScienceDirect, MDPI, PMC/NCBI) for the chemistry/physics facts the book
  doesn't cover in enough depth to check: lazurite's S₃⁻ chromophore, turquoise's Cu²⁺ chromophore,
  labradorescence and adularescence as thin-film interference in feldspar, nacre's aragonite/conchiolin
  structure, the pyralspite garnet series, amethyst/citrine's iron oxidation states, jadeite-vs-nephrite
  chemistry, and Paraíba tourmaline's unique copper color.
- Smithsonian (si.edu, naturalhistory.si.edu) for the Hope Diamond and tanzanite/zoisite specimen pages.
- Wikipedia, used throughout for names, dates and mineral-family structure, cross-checked against the above
  rather than relied on alone for anything contested.
- `CLAUDE.md`'s own myth list and `color-kb/books/CONFLICTS.md` for every hedge: the lapis-flecks-are-pyrite
  correction (`lapis-lazuli` entry), amber's dinosaur-DNA age mismatch (`amber` entry, with the Jurassic-Park-
  specific math from `jewels-finlay-8`), Nero's disputed "emerald sunglasses" story (left to the existing,
  already-hedged `Emerald` color page rather than repeated), and tanzanite's Titanic "Heart of the Ocean" film
  lore (flagged explicitly as film lore from a single source, not a documented fact, per `CONFLICTS.md`'s own
  note on `jewels-finlay-56`).
- Wikimedia Commons (upload.wikimedia.org) for the seven hotlinked photographs; each image's license, artist
  credit and Commons file page are recorded in `data/gems.js`'s `images` map and rendered with every
  appearance, per `CLAUDE.md`'s image-sourcing rule.

## What's *not* duplicated

Six gem entries (Emerald, Jade, Amber, Turquoise, Malachite, Amethyst — Coral too, though it isn't a mineral)
already have a deep-dive page elsewhere in the wiki: a `WIKI_COLORS` facet page for the color itself (all
six — e.g. `Emerald`'s own page already covers the Nero-sunglasses myth, Ptolemaic mines and the Emerald
City), plus a dedicated `pigment`-type page in `data/wiki-nodes.js` for two of them (`ultramarine-pigment`
for lapis lazuli, `malachite-pigment` for malachite). Each gems.js entry for these six is deliberately short:
it states the mineralogy (what a botany/history page wouldn't cover — beryl's chromium-vs-iron-vs-manganese
family chemistry, copper's role in turquoise and malachite, lazurite's S₃⁻ chromophore), then links out with
`[[Emerald]]`, `[[Jade]]`, `[[ultramarine-pigment|ultramarine]]`, etc. for the rest, exactly as the brief
asked.
