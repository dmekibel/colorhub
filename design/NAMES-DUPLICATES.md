# Names: duplicate-tile audit (2026-10-09)

Trigger: David clicked **Pebble Grey** and the app told him it's identical to **Quaker Drab** (both
`#858078`, dE2000 0). Policy (CLAUDE.md): **one swatch = one color tile**.

## What this actually was

The specific pairs first reported (Pebble Grey/Quaker Drab, Endive Blue/Light Blue Grey, Pale Greyish
Vinaceous/Shell Pink, Pearl Copper/Copper Brown, Pure Red/Signal Red, Dusty Blue/Glaucous, Dark Olive
Grey/Yellow Olive, Clay/Testaceous, Violet Blue/Violet-Blue (Crayola), Vinaceous-Fawn/Fawn, Ochraceous-
Salmon/Light Orange, Pale Black Shade/Pale Black Hue) are **not** graph-staleness artifacts in the way
first assumed — `data/graph` was stale (it still carried CRUDE/xkcd names already removed by
`tools/xkcd_audit_merge.py` and `tools/vague_ish_merge.py`, e.g. Poop, Shit, Vomit, Snot, Booger), but
rebuilding the graph alone does **not** fix these 12 pairs, because the real cause lives one layer
upstream: **`data/core-names.json` (the Learn layer) already renames and `also`-links a library.json
entry, but `data/library.json` (the Archive layer) still carries the aliased name as a full, independent
entry at the identical hex, and `tools/graph_build.py` gives every library.json entry its own graph node
and page regardless of any `also` link.** Net effect: one swatch, two live, independently addressable
color pages.

A full dE2000 scan of `data/library.json` ∪ `data/core-names.json` (pool de-duplicated by `(name, hex)`,
not by name alone — a name that collides between the two files with a *different* hex is a separate,
pre-existing data problem, see below) found:

- **97 pairs** already captured in the core entry's own `also` field (just needed the library-only
  standalone entry dropped and the graph rebuilt)
- **13 pairs** not yet linked, needing the `also` link added first — this set is exactly the 12 originally
  reported pairs plus one more the scan surfaced the same way (**Blue Green / Dark Viridian Green**, dE 0.49)
- **0 pairs** in the 1.0–2.0 manual-review band except one already-known case the graph itself flags as a
  `dup` edge after rebuild: **Lemon Yellow (Crayola) / Pastel Yellow** at dE 1.2 — reviewed and kept
  distinct (a Crayola-branded name vs. a generic descriptive one; not merged)

## Policy applied

Keep = the `core-names.json` entry (already the Learn-layer title, per CLAUDE.md's "prefer the Learn-layer
name" rule — every pair here has exactly one core-layer side, so there was no oldest-source tiebreak to
make). Drop = the `library.json`-only entry: removed as a standalone Archive page, kept only as a search
alias (`data/aliases.json`) and as an `also` entry on the kept core record (sources/dates merged).

Tool: `tools/dupe_merge.py` (new; same scoped-merge mechanics as `tools/vague_ish_merge.py` /
`tools/xkcd_audit_merge.py`, generalized to this dE2000-across-both-files scan and to article folding).
Re-runnable: `--report` for a dry run, no args to apply; already-merged names are skipped.

## Groups merged (110 total)

**Previously-unlinked (13, includes all 12 originally reported):**

| Keep | Dropped | dE2000 |
|---|---|---|
| Pebble grey | Quaker Drab | 0.00 |
| Light blue grey | Endive Blue | 0.00 |
| Shell pink | Pale Greyish Vinaceous | 0.00 |
| Copper brown | Pearl Copper | 0.00 |
| Signal red | Pure Red | 0.00 |
| Dusty blue | Glaucous | 0.00 |
| Dark olive grey | Yellow Olive | 0.00 |
| Clay | Testaceous | 0.00 |
| Violet blue | Violet-Blue (Crayola) | 0.00 |
| Fawn | Vinaceous-Fawn | 0.00 |
| Light orange | Ochraceous-Salmon | 0.00 |
| Pale black shade | Pale black hue | 0.00 |
| Blue Green | Dark Viridian Green | 0.49 |

**Already `also`-linked at the core layer, library-only duplicate dropped (97; full list in git history of
`tools/dupe_merge.py`'s `--report` output):** Antique rose/Deep Vinaceous, Ash rose/Dusty puce, Berry
pink/Rosolane Purple, Berry red/Maroon (X11), Biscuit/Vinaceous-Buff, Black brown/Very Dark Brown, Blue
slate/Violet-Slate, Brick rose/Dark Vinaceous, Bronze/Medal Bronze, Cerulean sea/Blue (NCS), Clay
pink/Russet-Vinaceous, Cool grey/Dark Grey, Cyan blue/Cendre Blue, Dark blue slate/Dark Violet-Slate, Dark
chocolate brown/Zinnwaldite Brown, Dark olive brown/Olive Drab #7, Dark peacock/Bluish petrol, Dark silver
pink/Pale Brownish Drab, Dark spruce/Bluish charcoal, Dark teal grey/Saccardo's Slate, Dark walnut/Pale
black, Deep jade/Diamine Green, Deep navy/Dusty midnight blue, Deep rose red/Solid Pink, Deep royal
blue/Royal Blue (Dark), Deep teal green/Anthracene Green, Deep terracotta/Terracota, Dusky mauve/Livid
Purple, Dusty cornflower/Neropalin Blue, Dusty plum/Naphthalene Violet, Dusty rose brown/Brownish Purple
Red, Dusty violet/Saccardo's Violet, Espresso/Black kite, Faded rosewood/Deep Livid Brown, Fallen leaf/Light
hazel, Floral lavender/Lavender (Floral), Graphite violet/Heliotrope-Slate, Greenish hospital green/Light
Cendre Green, Grey aqua/Dark ash, Grey celadon/Greenish sage, Grey teal/Glaucous-Blue, Greyish brownish
olive/Fuscous, Heather grey/Pearl Blackberry, Heather pink/Heather Violet, Khaki olive/Khaki Grey, Lagoon
blue/Blue (Munsell), Lemon Meringue/Seafoam Green, Light cinnamon/Vinaceous-Cinnamon, Light orchid/Light
Lavendar, Linen grey/Drab-Grey, Mauve brown/Reddish umber, Mauve grey/Vinaceous-Grey, Mauve rose/Vinaceous-
Lilac, Midnight navy/Greyish navy, Mint leaf/Cendre Green, Mole brown/Dark Vinaceous-Drab, Mushroom
brown/Brownish Drab, Oatmeal/Pale Vinaceous-Fawn, Old pink/Corinthian Pink, Olive mud/Field Drab, Orchid
pink/Rosolane Pink, Orchid purple/Amparo Purple, Pale blush/Light Vinaceous-Fawn, Pale flesh/Flesh Red, Pale
green grey/Greenish Glaucous, Pale lilac grey/Red Lilac Purple, Pale lime/Viridine Green, Pale oak/Dusty
sage, Pale olive grey/Yellowish Glaucous, Pale periwinkle/Pallid Violet, Pale sage/Pale Glaucous-Green, Pale
sea grey/Pale Dull Glaucous-Blue, Peach rose/Orange-Vinaceous, Pink orchid/Middle Purple, Plum
grey/Anthracene Purple, Purple slate/Lavender Purple, Red plum/Dusty cerise, Rose brown/Vinaceous-Brown,
Rust orange/Orange-Rufous, Sage grey/Glaucous-Grey, Sea teal/Light teal tone, Seafoam teal/Middle Blue
Green, Seaweed green/Codium fragile seaweed, Sky steel/Bluish steel blue, Slate grey/Dark Plumbeous, Slate
navy/Nigrosin Blue, Smoke/Vinaceous-Slate, Spring onion/Greenish pistachio, Spruce green/Pearl Green, Tawny
orange/Ochraceous-Tawny, Toffee/Gallstone Yellow, Vivid taupe brown/Dark Naphthalene Violet, Vivid
violet/Violet (RYB), Warm silver/Silver (Crayola), Wedgwood Blue/Wedgewood Blue, Wine brown/Dusty wine,
Wisteria blue/Perrywinkle.

## Counts before → after

- `data/library.json`: 1756 → 1646 entries (110 dropped)
- `data/core-names.json`: 912 entries (unchanged count; `also` gained the 13 new links)
- `data/aliases.json`: 261 merged pairs recorded (110 new + 151 pre-existing from earlier passes), 3176 slugs
- `data/graph` node count: 2037 → 1754 canonical colors after rebuild (`python3 tools/graph_build.py`);
  remaining `dup` edges: 1 (Lemon Yellow (Crayola)/Pastel Yellow, reviewed and kept)
- `data/analysis/articles-lite.json`: rebuilt, 1549 entries (`python3 tools/build_articles_lite.py`)
- Articles: 53 folded (both sides had an article — the dropped name's title added to the kept article's
  `aside.aka`, with its distinct source cited; the dropped article deleted), 11 renamed/promoted onto the
  kept slug (only the dropped name had an article — content kept, dropped name added to `aside.aka` instead
  of being thrown away), 46 groups had no article on either side (nothing to touch). Every surviving
  article's `[[slug]]` link pointing at a dropped slug was remapped to the kept slug (125 link fixes across
  115 files total, both merge passes). `data/articles/link-map.json` had 2 stale overrides (`mizu-iro`,
  `kon`) pointing at now-dropped slugs; repointed to their new targets.

## Known follow-up (not fixed here, out of scope for a duplicate-tile pass)

- **28 name collisions**: `core-names.json` and `library.json` disagree on the hex for the *same name*
  (e.g. core's "Pebble grey" is `#858078`, but library's own "Pebble Grey" entry is `#B9B9A8` — a
  genuinely different color that happens to share a title). `tools/graph_build.py` already resolves these
  through its own disambiguation-group mechanism (`data/graph/disambig.json`, 72 groups, 303 contested-hex
  names after rebuild) rather than them being a "two tiles, one swatch" bug, so they were left untouched —
  but they're worth a dedicated pass to decide whether the two colors should be distinguished in their
  titles (e.g. "Pebble Grey" vs "Pebble Grey (archive)").
- **16 pre-existing `tools/article_gate.py` link failures**, all dangling `[[links]]` to CRUDE/vague-ish
  names (vomit, snot, poo, puke, diarrhea, booger-green, orangeish, piss-yellow, greenish) that
  `tools/xkcd_audit_merge.py` / `tools/vague_ish_merge.py` deleted in an earlier pass without remapping the
  articles that linked to them. Predates this pass; flagged separately rather than folded into this diff.
