# Wikimedia Commons: the seventh source

Added 2026-10-07 by `tools/museums/commons.py` (one adapter, called from `tools/corpus.py`), on top of the six
museums in `research/STATS-FINDINGS.md`. It brought in **9,117 public-domain paintings** (src `commons`), through
the Uffizi, the Prado, the Louvre, the Hermitage, the National Gallery London and the Musee d'Orsay, plus about 30
old masters most likely to be thin or missing in the six existing museums. The corpus is now **23,545 paintings**
and switched from one `data/corpus.json` to shards (`data/corpus/<src>-<n>.json`, 2.5 MB each) past the 8 MB limit;
`data/stats.js` grew to 0.89 MB (`byArtist` now has 830 entries, up from 484).

## 1. Route

No key, two stages, both over HTTPS:

1. **Wikidata's SPARQL endpoint** (`query.wikidata.org/sparql`) for metadata. A first attempt ranked *all* Commons
   paintings by Wikipedia sitelink count (`wikibase:sitelinks`) as a fame proxy — even just counting how many
   paintings (`wd:Q3305213`) with an image (`P18`) exist timed out past WDQS's 60-second budget. Narrowing to an
   indexed join first (paintings whose collection, `P195`, is one of six target museums, **or** whose creator,
   `P170`, is one of ~30 named old masters) cut the candidate set to ~20,000 and made every later step fast (a few
   seconds to count, ~25s per page of 4,000 rows). `SERVICE wikibase:label` (fetching a label per row) was dropped
   for the same reason — 3,000 rows with inline labels took 60s — in favor of resolving the ~3,100 distinct creator
   and nationality ids afterward, 50 at a time, via the plain `wbgetentities` REST call. A painting's title comes
   from its Commons filename, not a Wikidata label (no per-item lookup needed).
2. **Commons' own thumbnail server** via `Special:FilePath/<file>?width=N` (no key) for images: `?width=400` for
   the grid (corpus.py's generic pipeline then downsamples its own copy to 200px for the palette, as it does for
   every museum), `?width=1200` for the "hi" sharp copy on the painting page (set in `tools/gallery.py`).

**Target museums** (`TARGET_COLLECTIONS` in commons.py): Uffizi Gallery, Museo del Prado, Louvre Museum, State
Hermitage Museum, National Gallery (London), Musee d'Orsay.

**Notable artists** (`NOTABLE_ARTISTS`, ~30 ids): the artists named in the brief (Caravaggio, Velazquez, Vermeer,
Goya, Turner, Constable, Friedrich, Monet, van Gogh, Klimt) plus the painters usually named alongside them (Rembrandt,
Titian, Raphael, Botticelli, El Greco, Rubens, Bruegel the Elder, Bosch, van Eyck, Durer, Leonardo, Munch, Courbet,
Manet, Cezanne, Renoir, Degas, Toulouse-Lautrec, Gauguin, Gentileschi), as a safety net for a minor painting the
museum half misses. A wrong id here just contributes zero rows (harmless) — this is how **Hokusai** ended up with
no bonus rows: his Edo-period work is catalogued on Wikidata as prints (`wd:Q18688`), not instance-of painting
(`wd:Q3305213`), so the painting-only query never reaches him. Adding a second "or a print by this one creator"
branch was judged out of scope for one additional clause with an uncertain payoff; noted here rather than guessed at.

**Excluded** (`EXCLUDE_COLLECTIONS`): the six museums already in the corpus (Art Institute of Chicago, Cleveland
Museum of Art, the Met, NGA Washington, the Rijksmuseum, SMK), via `FILTER NOT EXISTS` on `P195` — a painting
already catalogued there is not re-added from Commons. This is on top of, not instead of, corpus.py's own
image-hash + title-similarity de-duplication (37 near-duplicates were dropped across the whole corpus this build;
`research/_raw/dups.tsv`).

## 2. Public domain

Kept when the creator's date of death (`P570`) is before 1956, or — when no creator death date is on Wikidata — the
painting's inception (`P571`) is before 1929, both well inside "PD-old" and checked server-side in the SPARQL
`FILTER` before any image is fetched (and re-checked in Python, belt-and-suspenders). Commons files for paintings
this old are routinely tagged `{{PD-Art}}`; this adapter does not itself read or depend on that template, relying
on the date test instead, which is simpler and already conservative (a work can be PD-Art on other grounds too, so
this picks a subset, never a superset, of what Commons marks public domain).

## 3. Economizing before the download

The ~20,000 candidates were **not** all downloaded. `tools/corpus.py` already caps one artist at 50 paintings
(`ARTIST_CAP`) across the *whole* corpus, applied once at build time after every image is fetched — so without a
pre-filter, every extra Monet or Renoir image fetched and palette-measured here would just be thrown away at
`cap_artists()`. Before running `images commons`, the cached `research/_raw/commons/meta.json` was trimmed in place:
for each artist already in the corpus, headroom = `50 - <their current count in data/corpus.json>`; an artist over
that headroom keeps only an evenly-date-spaced subset of size `headroom` (the same spacing `cap_artists()` uses),
rows with no stated creator are always kept (823 of them). This cut the candidate pool from **20,061 to 9,194**
(Monet alone: 1,154 candidates but 0 headroom — the existing corpus was already at the 50 cap — so 0 were
downloaded) before a single image was fetched. The real `cap_artists()` still runs at build time as the source of
truth; this is purely a download-time economy, and it landed the final commons count (9,117) inside the brief's
5,000-15,000 target without any further trimming.

## 4. Fields and known gaps

- `t` (title): from the Commons filename (extension stripped, underscores to spaces), since no per-item label
  lookup was made. Expect catalog-system noise in a few titles ("... gemldde00kuns 0226").
- `a` (artist): the creator's resolved label, **unless the filename itself says someone else painted it** —
  `"(workshop)"`, `"(circle of)"`, `"(follower of)"`, `"(after)"`, `"(attributed to)"`, `"(manner of)"`,
  `"(copy after)"`, `"(school of)"` anywhere in the title, or the same words as a bare leading phrase ("After
  Jheronimus Bosch 006 colour.jpg", reusing `museum_common.NOT_BY`, anchored to the start) — because Wikidata's
  `P170` often still points at the named master for a workshop piece, with the caveat only in the filename. Caught
  52 rows this way. A handful of co-painted works (two Flemish specialists collaborating, one for figures and one
  for flowers) may still show whichever of the two creators' Wikidata statement happened to be read first, which
  need not match the filename's primary name — a real and disclosed ambiguity, not a parsing bug.
- **Short-label aliasing.** Wikidata's own English label is sometimes shorter than the spelling already dominant in
  the corpus from the six museums (`merge_artists()` in corpus.py only merges a `"Name (Other Name)"` shape, not an
  unrelated short form) — caught by scanning the built corpus for one artist name that is a substring of another
  with both having a real painting count, by hand confirming each pair is the same person (ruling out, for example,
  Anton Raphael Mengs as an "alias" of Raphael). One case came from Commons' own label and is fixed in
  `commons.py`'s `CREATOR_ALIAS`: `"Rembrandt"` to `"Rembrandt van Rijn"` (41 rows moved under the existing name,
  which is now the most-capped artist in the corpus at 94 before capping to 50). Four more pairs are pre-existing
  fragmentation **between the other museums**, not touched by this change and out of scope for it: `"Sir Anthony
  van Dyck"` (NGA) vs `"Anthony van Dyck"` (everyone else), `"Auguste Renoir"` (NGA, the Met) vs `"Pierre-Auguste
  Renoir"` (AIC, CMA, Commons), `"David Teniers"` (CMA, Rijksmuseum, SMK) vs `"David Teniers the Younger"` (AIC,
  NGA, Commons), `"Lucas Cranach"` (CMA, Rijksmuseum, SMK) vs `"Lucas Cranach the Elder"` (AIC, the Met, NGA,
  Commons) — flagged as a follow-up, not fixed here.
- `co` (country): the creator's citizenship (`P27`) through corpus.py's own `country_of()`. Many Old Master
  portraits on Wikidata simply have no stated `P27` (citizenship was not really a category before modern
  nation-states) and get no country, same as the existing rule already does for Byzantium or Central Asia. Where a
  citizenship *is* stated it is sometimes a historical polity the existing `COUNTRY_RULES` list does not cover —
  "Crown of Aragon" (137), "Papal States" (115), "Holy Roman Empire" (60), "Crown of Castile" (41), "Northern Low
  Countries" (16) and about twenty smaller ones are left with no country this build (full list printed by
  `corpus.py build`). Extending `COUNTRY_RULES` for these was judged out of scope here (it is a shared file read by
  every source, not a Commons-only change) and is a reasonable follow-up.
- `y` / `span`: Wikidata's inception (`P571`) read at its actual precision (year/decade/century, via the
  `psv:P571`/`wikibase:timePrecision` statement-value node, not just the plain `wdt:P571` shortcut, which loses
  precision) — a "16th century" painting is stored as 1501 with `span=100`, so it lands in century tables but is
  correctly excluded from decade ones, the same rule `common.year_span()` already applies to text dates elsewhere.
- `mv` (movement): always `None`. Wikidata's genre/movement statements were not mapped to the corpus's AIC-derived
  style vocabulary; this is the one field this source does not populate.
- `url`: the Commons file page (`https://commons.wikimedia.org/wiki/File:<name>`), set per-row and read first by
  `gallery.py`'s `record_url()` ahead of the `SOURCES["commons"]["rec"]` fallback pattern (a Wikidata item link),
  which is otherwise unused.

## 5. Licenses

Metadata: CC0 (Wikidata). Images: public domain by the date test above (section 2); most are also tagged `PD-Art`
on Commons by its own editors, which this adapter does not depend on. `STATS.meta.sources` carries this automatically
once `commons` rows exist (no manual edit needed) — generated from `tools/museums/commons.py`'s `INFO` dict.

## 6. Spot checks done

- **Contact sheet**, 15 random commons rows (seed 42): image, 6-color palette, year, artist, country all checked by
  eye. Palettes matched the pictures (Giordano's viridian horse-blanket, Schedoni's warm dusk). One row's year
  ("Maria Manuela, Princess of Portugal and Asturias", 1501) looked wrong at a glance but is Wikidata's own
  century-precision encoding of "16th century" (span correctly flagged at 100, so it is excluded from decade
  tables) — not an error.
- **HTTP**, 6 more random rows (12 URLs: `?width=400` and `?width=1200` each) with a desktop Chrome user agent:
  all `200 image/jpeg`, the 1200px copy 4-8x the bytes of the 400px one as expected. Two Commons file pages
  (the `url` field) also checked: both `200`.
- **Duplicate-artist scan**: every pair of artist names (>= 15 paintings each) where one is a substring of the
  other, to catch exactly the kind of split `CREATOR_ALIAS` fixes (and to rule out false positives like Mengs/Raphael).
- `node tools/check.js`, `node tools/check_wiki.js`, `node tools/check_names.js`: 0 failures (unrelated to this
  change — they gate `data/colors.js` and `js/`). `node --check data/stats.js`: passes.

## 7. Re-running

```
python3 tools/corpus.py meta commons --resume      # SPARQL pages + label resolution, cached (a few minutes)
python3 tools/corpus.py images commons              # 9,194 images at ~8 req/s to Commons' CDN; Commons throttled
                                                     # some of this run with HTTP 429 (absorbed by corpus.py's
                                                     # existing backoff) — about 66 minutes in practice, not the
                                                     # ~18 the request rate alone suggested
python3 tools/corpus.py palettes                    # new images only
python3 tools/corpus.py build                       # rows, dedupe, cap, stats, findings
python3 tools/gallery.py --raw research/_raw         # or any shared research/_raw with the other museums' caches
```

`research/_raw/commons/` (gitignored, ~195 MB: `meta.json`, `pages/*.json`, `labels.json`, `img/*.jpg`) caches every
stage; `--resume` on `meta` reuses the SPARQL pages and skips the whole query on a re-run.
