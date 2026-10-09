# The DEPTH WAVE: writer brief

> David, 2026-10-08: "The Aero article feels too short. Maybe there are other articles that could be
> expanded." Facts: 1,906 articles, median ~250 words; ~1,300 under 300 words, ~1,600 under 500.

## Diagnosis (why so many articles are short)

Two separate causes, and the fix is different for each:

1. **The default word count is a tier default, not a material limit.** `tools/article_gate.py`'s
   `TIER_DEPTH` gives `standard`→short (200-600), `commercial`→brief (150-400), `descriptive`→none,
   `nature`→long (600-1500) — but most writers wrote to the *default*, not to what the color actually
   has. The gate only enforces the **declared** `depth`'s word bounds, not the tier's default: an
   article can declare `"depth": "long"` on a `standard` or `commercial` color and the gate is happy, as
   long as the words fit 600-1,500. Nothing stopped Aero (`tier: standard`) from being `long`; nobody
   tried. Tiffany Blue, named explicitly in CLAUDE.md as an "iconic design color," is `commercial` /
   `brief`, 276 words — the tier default capped it, not the material.
2. **Writers weren't shown most of the material that exists.** `design/ARTICLE-VOICE.md`'s source list
   (29 books, public-domain classics, `tools/article_field.py`, Ngram) is real but partial. A color's
   own graph node and edges (`data/graph/`) carry a real 1930-dictionary *origin paraphrase*, a real
   1955 ISCC-NBS filing, look-alike edges with qualitative differences, archive paintings with roles,
   and fashion/film/gem "twins" — all computed, all sitting unused. Aero's own node already had the
   dictionary's answer to the one thing the live article punted on ("Textile-trade name.", not
   confirmed/unconfirmed) — nobody had looked.

So: **the fix is not "write more words." It's "look at what we already have, per color, before writing
anything,"** and only then pick a depth the real material supports. An obscure name with no book history
still has Lab/LCh/Munsell numbers, a real look-alike neighborhood with qualitative differences, archive
paintings, and (often) fashion/film/gem twins — that is real depth, and it is honest to say "undocumented"
about the one thing (usually: why this exact name) nobody recorded, while still being long because of
everything else that is recorded.

## The tool: `tools/depth_kit.py`

    python3 tools/depth_kit.py <slug>                 # one color's kit, printed as JSON
    python3 tools/depth_kit.py <slug> --out kit.json
    python3 tools/depth_kit.py <slug> --field          # + the slower article_field.py lens

Assembles, read-only, everything in the repo (plus `../color-kb` concordance **metadata only** — never
book text) for one slug: the node (hex, Lab/LCh/Munsell, computed-nearest ISCC block, first-recorded
year+source, free-text note), the 1930 dictionary entry and etymology note, the REAL 1955 ISCC-NBS
filing (kept separate from the node's own computed-nearest block — seconds below), the real look-alike
edges with qualitative differences, family (named variants, cross-system aliases, traditional-system
siblings), three computed color wheels, the archive fieldnotes engine's own numbers *and* its
ready-made, pre-verified sentences, resolved gem/film twins with ready `[[gem:id|…]]` / `[[film:id|…]]`
references, computed look/garment candidates (ΔE2000 ≤ 8, the SCHEMA.md closeness rule) with ready
references, the archive paintings that carry it with ready `[[painting:id|…]]` references, the
library.json entry, color-kb concordance hit counts + locators (metadata only — read the real passage in
`../color-kb/books/text/<book>.txt` yourself before writing a sentence from it), any pre-existing
`../color-kb/facts/<slug>.jsonl` fact cards, a scan for CLAUDE.md myth-list keywords in the gathered
material, and a 0-100 material score with a suggested depth bucket. **The suggested depth is a hint, not
a mandate** — never write to fill a bucket; write to what the kit actually supports, and say so when it
doesn't (rule 15 below).

### The two traps `tools/article_lint.py` already catches — now avoidable before writing

- **`la` vs `app`.** `kit['la']` is the real graph look-alike edges (ΔE2000 + a qualitative difference,
  e.g. "almost the same", "purpler and more vivid"). `library.json`'s own `app` field is the OLD
  101-curriculum nearest name — `depth_kit.py` omits it on purpose and says why. Use `kit['la']`, never
  `library_entry['app']` (it isn't even in the kit) or `core-names.json`'s `near`.
- **Computed-nearest ISCC block vs the real 1955 filing.** `kit['iscc_computed_nearest_block']` is our
  own nearest-block *computation* for this hex. `kit['iscc_real_1955_filing']` is the actual 1955
  dictionary entry *for this exact name*, if Maerz/Ridgway/the ISCC-NBS committee filed it — a different
  thing, and the two can disagree (Hathi Grey: computed nearest is block 155 "greenish gray"; a cross-
  reference in Ridgway's own 1912 plate note points at 154). Never write "filed by the ISCC-NBS system
  in 1955" using the computed block's name; that is pattern 2 in `article_lint.py`'s docstring, a real
  mistake two Opus audits found in the wave-2/3 drafts.
- **`tw.botany` and `tw.fashion` are not reference-card ids.** `tw.gems` and `tw.films` resolve straight
  to `data/gems.js` / `data/films.js` ids — real `[[gem:id|…]]` / `[[film:id|…]]` material.
  `tw.botany` is Werner's 1821 nomenclature comparison (ids like `werner-7`, not a `data/botany.js`
  plant/dye id); `tw.fashion` is Pantone-Color-of-the-Year / fashion-decade/fashion-house entries (ids
  like `coty:2000`, not a `data/looks.js` look id). Both are real prose material ("Werner's Nomenclature
  placed this beside the snow-drop"; "Pantone named it Cerulean, Color of the Year 2000") — just never
  turn them into a `[[flower:…]]` or `[[look:…]]` card. For an actual `[[look:id]]` or `[[garment:id]]`
  card, use `kit['look_and_garment_candidates']` (computed the correct way: palette ΔE2000 ≤ 8). For an
  actual `[[flower:id]]`, prefer a real `data/botany.js` plant/dye id from
  `kit['flower_candidates']['linkable_flower_ids']` whose plant is thematically the color's source (e.g.
  Pompeian Red → no dye plant; Scheele's Green → no dye plant either; a real pigment's actual source
  plant always beats a same-family guess) — never a `werner-N` id.

### Research-first order (adds to, does not replace, `design/ARTICLE-RESEARCH-FIRST.md`)

1. Run `python3 tools/depth_kit.py <slug> --field > kit.json` for the pilot (the slow `--field` lens
   mostly matters for an archive-heavy field section; skip `--field` for a quick look).
2. Read `kit['books']['n_hits']` and `kit['books']['sample']` (book + locator + matched phrase, no book
   text). If `n_hits` > 0, go read the real passages in `../color-kb/books/text/<book>.txt` around those
   locators, and check `../color-kb/facts/<slug>.jsonl` for an existing fact-card pass (several already
   exist: Pompeian Red, Van Dyke Brown, Tiffany Blue, Battleship Grey, Ruber, Grey-Green, among others).
   If `n_hits` is 0, the color's depth has to come from the kit's other sections, not the books — say so.
3. For a human/institutional story with no book coverage (Rebecca Purple, a modern commercial name), web
   sources are allowed under `design/ARTICLE-VOICE.md` rule 6, hedged, with a `web` note and a real url.
4. Write fact cards (if none exist) the way `ARTICLE-RESEARCH-FIRST.md` already describes.
5. Write the article from the kit + fact cards only, following the voice rules below and in
   `design/ARTICLE-VOICE.md`. Pick the depth the material supports (`kit['suggested_depth']` is a floor
   hint, not a target): an *epic* name with 70-plus book hits (Van Dyke Brown, Scheele's Green) earns
   1,500-2,000 words honestly; a *compound descriptive* name with zero book hits (Grey-Green) should stay
   nearer medium/long even if its measured-data score is high, because padding measured data past what
   it is actually saying is still padding.
6. `python3 tools/depth_kit.py <slug>` again is cheap — re-run after drafting to double check every
   number you quoted still matches (the kit is a point-in-time snapshot, the live graph doesn't move,
   but your own transcription can drift).
7. `python3 tools/article_lint.py <slug>` then `python3 tools/article_gate.py <slug> --write-words`,
   loop until both pass.
8. Independent fact-check: a fresh-context pass (no access to the writer's reasoning) rereads the kit,
   the fact cards, CLAUDE.md's myth list, and the article side by side, line by line, and reports
   PASS/REVISE with specifics (`design/ARTICLE-RESEARCH-FIRST.md` step 4). Fix, re-run lint+gate.

## Depth rules specific to this wave

9. **Never write to fill a depth bucket.** The target word counts below are what the *pilot's own
   material* supported, not a formula. A color with a thin kit stays short and says so (rule 15,
   `ARTICLE-VOICE.md`) — "undocumented" at 280 words beats three padded sections.
10. **`depth` is a free field, not tied to tier.** Declare whatever depth bucket the real word count
    lands in; the gate checks the declared bucket's bounds, not the tier default. A `commercial` or
    `standard` color with real material can be `medium` or `long`.
11. **Two legitimate archive lenses, never blended silently.** `kit['archive_fieldnotes']` (the two-lens
    engine, with ready sentences in `facts[].t`) and `kit['field_compute']` (`article_field.py`'s own
    pass, dE≤6/5% cover, only with `--field`) can give slightly different numbers for the same claim
    (different thresholds). Say which one a field claim used if you quote raw numbers instead of the
    ready sentence, and never average or "round to agree" the two.
12. **A disagreement between two real sources is material, not a problem.** Payne's grey: Wikipedia's
    original formula is Prussian blue + yellow ochre + crimson lake; Balfour-Paul's *Indigo* gives lake +
    raw sienna + indigo. Both are real, sourced claims — name both, say they disagree, don't silently
    pick one (`ARTICLE-VOICE.md` rule 4).
13. **A measured-only color (no book, no dictionary origin) is still a real article.** Lean on: the real
    look-alike neighborhood with *why* each neighbor differs (not just the number), the archive's ready
    field-note sentences, any real paintings/gem/film twins, the three color wheels for a genuine
    "what goes with this" answer, and the honest "the name's own origin is undocumented in the sources
    here" line. That is depth from data, not from invented history.
14. **Myths found by the scan get corrected, not avoided.** Scheele's Green legitimately touches the
    Napoleon-arsenic-wallpaper story (the pigment is the one actually implicated) — mention it, say it is
    unproven, give what is documented instead (Scheele's own 1777 letter warning a friend; the 1860s
    wallpaper and paint poisoning cases). Don't dodge a myth just because it is adjacent; dodge it only
    when it has no real connection to this exact color.

## The pilot (12 colors, spanning every tier in SCHEMA.md)

| Slug | Tier | Before | Material found | After (words) |
|---|---|---|---|---|
| `aero` | standard | 260 | dictionary origin ("Textile-trade name"), real vs. computed ISCC block, la/paintings/twins | ~800 |
| `scheele-s-green` | pigment | 322 | 96 book hits (Ball, Finlay, Garfield, Coles, Paterson, St Clair) | ~1,750 |
| `payne-s-grey` | pigment | 291 | 25 book hits + web (Wikipedia/William Payne); two disagreeing formulas | ~1,600 |
| `van-dyke-brown` | pigment | — | 77 book hits under `vandyke-brown` (a slug the naive lookup misses) | ~1,750 |
| `hathi-grey` | standard | — | real origin is Ridgway 1912, not Maerz 1930; "hathi" = elephant (Hindi/Urdu, web) | ~800 |
| `tiffany-blue` | commercial | 276 | 7 book hits + existing fact cards; CLAUDE.md names it explicitly | ~800 |
| `rebecca-purple` | person | 273 | 0 book hits; real, well-documented web story (meyerweb.com primary source) | ~750 |
| `ash-rose` | nature | 327 | 0 book hits; garment/film/gem twins, fashion-history prose material | ~800 |
| `battleship-grey` | commercial | 389 | 7 book hits + existing fact cards (US Navy, barium sulphate) | ~950 |
| `pompeian-red` | place | — | 9 book hits + 16 existing fact cards; books disagree on how dark it is | ~1,150 |
| `ruber` | traditional | 352 | 16 book hits (Pastoureau); Roman color-term linguistics | ~900 |
| `grey-green` | descriptive | 519 | 25 book hits (mostly incidental), 0 dedicated history; measured-data-only case | ~620 |

The last row is the control case for rule 9: `grey-green` scores high on the cheap material score (lots
of incidental book mentions, rich measured data) but has no dedicated history of its own, so it stays
leaner than its score alone would suggest — proof the rule is followed, not just stated.

## Lint rules recap (what blocks a merge)

Run both, in order, until both are clean:

- `python3 tools/article_lint.py <slug>` — the 5 systematic patterns found in two Opus audits: wrong
  nearest-neighbor source (`la` vs `app`), computed-vs-real ISCC-NBS filing, unverified comparative
  look-alike prose, leftover pipeline wording ("this batch", "the 101"), and field-note numbers whose
  *meaning* drifted from the data (wrong denominator, no sample size on a superlative, a dropped
  "floor, not a first" or "as photographed" caveat).
- `python3 tools/article_gate.py <slug> --write-words` — the mechanical schema gate: JSON shape, word
  count vs. declared depth, every `[n]` has a note, every myth-list phrase has a correcting frame, no
  "the 101", every `[[link]]` and reference card resolves, 2-3 questions, ≥4 connections, ≥3 field keys.

Both read-only except `--write-words`, which only ever edits the one `words` key.
