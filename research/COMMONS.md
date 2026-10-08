# Wikimedia Commons: the seventh source

Added 2026-10-07 by `tools/museums/commons.py` (one adapter, called from `tools/corpus.py`), on top of the six
museums in `research/STATS-FINDINGS.md`. It brought in **9,106 public-domain paintings** (src `commons`), through
the Uffizi, the Prado, the Louvre, the Hermitage, the National Gallery London and the Musee d'Orsay, plus about 30
old masters most likely to be thin or missing in the six existing museums. The corpus is now **23,531 paintings**
and switched from one `data/corpus.json` to shards (`data/corpus/<src>-<n>.json`, ~1.9 MB each) past the 8 MB limit;
`data/stats.js` grew to 0.89 MB (`byArtist` now has 837 entries, up from 484).

**Revision, same day.** A first pass shipped with three real bugs (titles taken from the Commons filename instead
of the painting's own name, 79 rows with a raw Wikidata id as the artist, and every image URL using `http://`) plus
a country-field definition mismatch (citizenship of the painter instead of where the painting was made). All four
are fixed below (sections 1, 4 and 7) and the whole commons slice was rebuilt from scratch. The two title/artist
bugs shared one root cause, which is worth stating plainly since it is easy to hit again: a Wikidata statement whose
value is explicitly **unknown** (`snaktype: "somevalue"`, Wikidata's way of recording "yes, a creator is credited,
but we don't know who") surfaces through SPARQL's `wdt:` shortcut as a blank-node URI ending in a 32-character hex
hash, not a `Qnnn` id — code that takes "the last path segment of any binding URI" as a QID (this adapter did, at
first) silently accepts that hash as if it were a real artist, and *also* stops a later, real binding for the same
item from ever being recorded, because "a value was already seen" short-circuits the merge. See section 4.

## 1. Route

No key, two stages, both over HTTPS:

1. **Wikidata's SPARQL endpoint** (`query.wikidata.org/sparql`) for metadata. A first attempt ranked *all* Commons
   paintings by Wikipedia sitelink count (`wikibase:sitelinks`) as a fame proxy — even just counting how many
   paintings (`wd:Q3305213`) with an image (`P18`) exist timed out past WDQS's 60-second budget. Narrowing to an
   indexed join first (paintings whose collection, `P195`, is one of six target museums, **or** whose creator,
   `P170`, is one of ~30 named old masters) cut the candidate set to ~20,000 and made every later step fast (a few
   seconds to count, ~25s per page of 4,000 rows). `SERVICE wikibase:label` (fetching a label per row) was dropped
   for the same reason — 3,000 rows with inline labels took 60s.
2. **The plain `wbgetentities` REST call** (`www.wikidata.org/w/api.php`), 50 ids a call, for everything SPARQL
   didn't carry cheaply: every painting's own title (English label, falling back to another language, falling back
   to a cleaned filename — see section 4), creator and nationality labels, a live recheck of `P170` for items SPARQL
   returned with no creator at all, and `P495` ("country of origin") read from each item's claims directly (not
   worth adding to the big paged query — most items have no collection-adjacent claim to join on cheaply for it).
3. **Commons' own thumbnail server** via `Special:FilePath/<file>?width=N` (no key) for images: `?width=400` for
   the grid (corpus.py's generic pipeline then downsamples its own copy to 200px for the palette, as it does for
   every museum), `?width=1200` for the "hi" sharp copy on the painting page (set in `tools/gallery.py`). Every
   URL is rewritten to `https://` at ingestion — SPARQL returns `http://commons.wikimedia.org/...` for `P18`, and
   the site is served over https throughout.

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
for each artist already in the corpus, headroom = `50 - <their current count across the six existing museums>`; an
artist over that headroom keeps only an evenly-date-spaced subset of size `headroom` (the same spacing
`cap_artists()` uses), rows with no stated creator are always kept. This cut the candidate pool from **20,061 to
~9,180** (Monet alone: 1,154 candidates but 0 headroom — the existing corpus was already at the 50 cap — so 0 were
downloaded) before a single image was fetched. The real `cap_artists()` still runs at build time as the source of
truth; this is purely a download-time economy, and it landed the final commons count (9,106) inside the brief's
5,000-15,000 target without any further trimming. (Run twice: once before the title/artist/country fixes below, and
again after, since the fixes changed which items even have a creator at all, hence which artists' headroom applies
to which rows — the second run only needed 66 new images, everything else was already cached by id.)

## 4. Fields and known gaps

- `t` (title): the painting item's own Wikidata label, English preferred. If an item has no English label, a
  second pass (no language restriction) picks Wikidata's language-independent "mul" label when present (used
  increasingly for a proper name that doesn't vary by language — it recovered, for example, "Félix Vallotton" for
  an item with no English, French or German label at all, only `mul`), else a short list of major languages, else
  whatever is there. Only **2 of 20,061** items had no label in any language; those fall back to a cleaned Commons
  filename (strip the artist's name and surname, the six target museums' names, "Google Art Project", catalog
  codes like `WGA12399` or OCR'd `gemldde00kuns 0226`, inventory numbers, trailing "(2)"-style disambiguation).
  The *raw* filename text is still kept internally (`file_title`, not written to the corpus) purely to catch
  "(workshop)"/"after" qualifiers for the artist field below, since a Wikidata label usually drops them. One
  Wikidata label is itself a typo upstream ("The Fif", for Manet's *The Fifer*, Q26250) — left as Wikidata has it;
  fixing individual upstream label typos is out of scope.
- `a` (artist): the creator's resolved label, **unless the filename itself says someone else painted it** —
  `"(workshop)"`, `"(circle of)"`, `"(follower of)"`, `"(after)"`, `"(attributed to)"`, `"(manner of)"`,
  `"(copy after)"`, `"(school of)"` anywhere in the filename, or the same words as a bare leading phrase ("After
  Jheronimus Bosch 006 colour.jpg", reusing `museum_common.NOT_BY`, anchored to the start) — because Wikidata's
  `P170` often still points at the named master for a workshop piece, with the caveat only in the filename. Caught
  53 rows this way.
  **Fixed bug (see the top of this document): raw Wikidata ids as the artist, 79 rows.** `_qid()` took the last
  `/`-segment of any binding URI as a Qnnn id. For a painting whose only `P170` statement is explicitly "creator:
  unknown" (`snaktype: somevalue` — a real, common cataloguing choice, not a data gap), SPARQL's `wdt:` shortcut
  still binds `?creator` to something, but to a blank-node placeholder URI ending in a 32-character hex hash, not a
  Qnnn. `_qid()` returned that hash as if it were a real id, `wbgetentities` could not resolve it, and the labels
  cache fell back to storing the id itself as the "label" (the root of the Q123740 ×36 bug). It also meant a
  *second*, real `P170` value for the same item (some paintings carry both a confident attribution and a separate
  "or possibly unknown" statement, e.g. Rubens's *Francis of Assisi*) could never be recorded, because the
  first-seen-wins merge in `fetch_pages()` had already "filled" the creator slot with the bogus hash. Fixed by (a)
  validating the extracted id against `^Q\d+$` before accepting it, and (b) only marking an item's creator "known"
  once a real Qnnn is found, so a later, real binding is no longer blocked. This recovered real, correct attributions
  (Rubens, Klimt, Degas, Monet and others) for roughly 150-200 paintings that the first pass had wrongly shown as
  artist-less, on top of removing the 79 raw-id rows outright.
- **Short-label aliasing.** Wikidata's own English label is sometimes shorter than the spelling already dominant in
  the corpus from the six museums (`merge_artists()` in corpus.py only merges a `"Name (Other Name)"` shape, not an
  unrelated short form) — caught by scanning the built corpus for one artist name that is a substring of another
  with both having a real painting count, by hand confirming each pair is the same person (ruling out, for example,
  Anton Raphael Mengs as an "alias" of Raphael). One case came from Commons' own label and is fixed in
  `commons.py`'s `CREATOR_ALIAS`: `"Rembrandt"` to `"Rembrandt van Rijn"` (now the single most-capped artist in the
  corpus, 95 before capping to 50). Four more pairs are pre-existing fragmentation **between the other museums**,
  not touched by this change and out of scope for it: `"Sir Anthony van Dyck"` (NGA) vs `"Anthony van Dyck"`
  (everyone else), `"Auguste Renoir"` (NGA, the Met) vs `"Pierre-Auguste Renoir"` (AIC, CMA, Commons), `"David
  Teniers"` (CMA, Rijksmuseum, SMK) vs `"David Teniers the Younger"` (AIC, NGA, Commons), `"Lucas Cranach"` (CMA,
  Rijksmuseum, SMK) vs `"Lucas Cranach the Elder"` (AIC, the Met, NGA, Commons) — a separate follow-up task was
  filed for these. (Fixed later the same day by `ARTIST_ALIAS` in corpus.py, which now holds all five pairs for
  every source, so `CREATOR_ALIAS` here is redundant but harmless.)
- **How many of the "no artist" rows are really anonymous?** 709 of the 9,106 commons rows in the built corpus
  have no artist. Traced to source: **616 (87%)** are paintings where Wikidata explicitly records the creator as
  unknown (the `somevalue` case above — a real cataloguing judgment, e.g. "unknown Italian painter, 17th century");
  **44 (6%)** have no `P170` statement at all, which a live recheck (not just the SPARQL snapshot) confirmed is
  still true today, not a sync-lag gap; **53 (7%)** *do* have a named creator on Wikidata but are correctly excluded
  because the filename says workshop/copy/follower/after (the rule two bullets up) — these should not carry the
  master's name, so this is working as intended, not a gap. In short: **essentially all of them are genuinely
  anonymous or explicitly unattributed**, not a parsing gap — the 150-200 that *were* a gap (real attributions the
  first pass missed) are now fixed and counted as artists above, not in this anonymous group.
- `co` (country): **fixed to mean what every other source means by it** (corpus.py's own comment: "the modern
  country of the place a work was made"). `P495` ("country of origin"), a property of the *work*, is read live from
  each item's claims and preferred when present; only when a painting has no `P495` at all does this fall back to
  the creator's citizenship (`P27`), a property of the *person* and a weaker proxy (the same fallback NGA and SMK
  already use for every one of their paintings, which have no place-of-making field either) — resolved through the
  same `country_of()` either way. Coverage: only **657 of 20,061 (3.3%)** candidates have a stated `P495`; the rest
  fall back to citizenship, so for the large majority of commons rows country still means the painter's nationality,
  not strictly the picture's origin — flagged here, not hidden. Many Old Master citizenships are historical
  polities the existing `COUNTRY_RULES` list does not cover — "Crown of Aragon" (129), "Papal States" (106+3 from
  `P495` directly), "Holy Roman Empire" (57), "Crown of Castile" (38) and about twenty smaller ones are left with no
  country this build (full list printed by `corpus.py build`). Extending `COUNTRY_RULES` for these was judged out
  of scope here (it is a shared file read by every source, not a Commons-only change).
- `y` / `span`: Wikidata's inception (`P571`) read at its actual precision (year/decade/century, via the
  `psv:P571`/`wikibase:timePrecision` statement-value node, not just the plain `wdt:P571` shortcut, which loses
  precision) — a "16th century" painting is stored as 1501 with `span=100`, so it lands in century tables but is
  correctly excluded from decade ones, the same rule `common.year_span()` already applies to text dates elsewhere.
- `mv` (movement): always `None`. Wikidata's genre/movement statements were not mapped to the corpus's AIC-derived
  style vocabulary; this is the one field this source does not populate.
- `url`: the Commons file page (`https://commons.wikimedia.org/wiki/File:<name>`), set per-row and read first by
  `gallery.py`'s `record_url()` ahead of the `SOURCES["commons"]["rec"]` fallback pattern (a Wikidata item link),
  which is otherwise unused.
- `img` / `hi`: always `https://`, fixed from the `http://` SPARQL returns for `P18` (section 1).

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
  all `200 image/jpeg` over https, the 1200px copy 4-8x the bytes of the 400px one as expected. Two Commons file
  pages (the `url` field) also checked: both `200`.
- **Duplicate-artist scan**: every pair of artist names (>= 15 paintings each) where one is a substring of the
  other, to catch exactly the kind of split `CREATOR_ALIAS` fixes (and to rule out false positives like Mengs/Raphael).
  Re-run after the fixes: the same four pre-existing cross-museum pairs, no new ones. Also checked directly: 0 rows
  with a raw `Qnnn` artist string anywhere in the gallery output, 0 `http://` image or `hi` URLs.
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

`research/_raw/commons/` (gitignored, ~195 MB: `meta.json`, `pages/*.json`, `labels.json`, `origin.json`,
`creator-recheck.json`, `img/*.jpg`) caches every stage. Note `tools/corpus.py`'s own `fetch_meta()` wrapper skips
calling the adapter at all once `meta.json` exists and is marked complete — to force a genuine re-run of `meta()`
(picking up a code change like the ones in this document) with every cache still reused, call
`museums.commons.meta(corpus, resume=True)` directly rather than `python3 tools/corpus.py meta commons --resume`.
