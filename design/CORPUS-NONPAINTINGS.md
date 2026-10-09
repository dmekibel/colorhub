# Corpus non-painting audit (2026-10-09)

David's complaint: "Some Sargent paintings in the app are just photos of his letters; they don't belong." This
audits `data/corpus/*.json` (all museum sources, with extra attention to the Commons-sourced `commons-*.json`
shards and `commons-sargent-1.json`, the dedicated Sargent set pulled from Wikimedia Commons/Wikidata) for
non-paintings: letters, manuscripts, documents, signatures, photographs of the artist/studio, envelopes, printed
pages, catalogue/exhibition views, frames-only.

## Method

Each corpus row has only `t` (title), `a` (artist), `y`, `co`, `mv`, and the measured `L`/`C` (mean lightness and
chroma of the 6-color palette) — no Commons category or description text is stored in the corpus, so detection is
title-keyword matching, corroborated by the chroma heuristic the corpus already partly relies on (`BW_C` in
`tools/corpus.py` drops true black-and-white photographs of paintings at `C < 0.6`; our candidates sit above that
floor but still read as flat, nearly colorless paper, which is a second signal, not the only one).

Keyword pass: title matched against `letter|manuscript|document|signature|autograph|envelope|photograph|photo|
printed|catalogue|exhibition|postcard|stamp|correspondence|installation|studio view|carte de visite|facsimile`
across every `data/corpus/*.json` shard (9 files, ~14,500 rows) plus `commons-sargent-1.json` (250 rows). That
produced 61 raw hits, which were reviewed by hand (not auto-excluded — the keyword list is wide and catches real
paintings).

## False positives found and kept (why they stay)

The large majority of hits are genuine paintings whose *subject* is a letter, manuscript or document, not a
reproduction of one:
- **Paintings of people reading/writing letters** — Vermeer's *Girl Reading a Letter at an Open Window* and *Lady
  Writing a Letter with her Maid*, Frans van Mieris's two *Young Woman Writing a Letter* panels, Alfred Stevens's
  *The Breakup Letter* / *Pleasant Letter*, François Boucher's *The Love Letter*, Gari Melchers's *The Letter*,
  Karl Hofer's *The Letter*, and similar works by Pieter Thijs, Hans Memling, Chôbunsai Eishi, Teisai Hokuba,
  Tōensai Kanshi, Bernard Gaillot, Willem Cornelisz Duyster, Moritz Unna, Nicolai Abildgaard. These are the
  "real paintings of letters/readers" the brief warned against excluding.
- **Trompe l'oeil letter-rack paintings** — Cornelius Norbertus Gijsbrechts (4 at SMK) and John Frederick Peto's
  *The Blue Envelope*: the whole point of these paintings is a painted illusion of a letter rack/envelope. Kept.
- **Illuminated manuscript leaves/miniatures** (AIC, CMA, the Met) — e.g. "Page from a copy of the Shahnama of
  Firdausi," "Folio from a Kalpasutra Manuscript," Jain/Buddhist manuscript covers and colophons, Ragamala leaves.
  These are the actual painted/illuminated miniature, catalogued by the leaf it's on. They are paintings (the
  corpus's existing `TEXT_PAGE` regex in `tools/corpus.py` already drops *pure text/calligraphy* leaves from the
  same manuscripts — these remaining ones have a figural painting on the leaf). Kept.
- **George Catlin's "Facsimile of a ... Robe"** — painted facsimiles of painted hide robes, not photographic
  reproductions. Kept.
- **Harald Foss, "Tågen letter over skovene..."** — Danish *letter* ("lifts"), a false positive of the English
  keyword "letter" matching a different language. Kept (it's a landscape).
- **Rijksmuseum "Stamp Engraver"** — a portrait of a person whose job was stamp engraving, not a postage stamp.
  Kept.

## Confirmed non-paintings (excluded)

| id | artist | title | reason |
|---|---|---|---|
| `commons-Q139822861` | John Singer Sargent | "Letter to Albert de Belleroche from John Singer Sargent with a Sketch of Madame Gautreau…" | A literal letter (with a doodle on it), not a painting. This is the exact item behind David's report. Chroma C=2.5, L=54.7 — flat, near-neutral, consistent with a photographed handwritten page rather than a painted work. |
| `aic-271419` | Soga Shohaku | "Handwritten Letter" | Personal correspondence catalogued by the Art Institute of Chicago as an object associated with the painter, not a painting by him. Chroma C=11.2, L=77.3 — high lightness / low-moderate chroma consistent with paper and ink, not a worked palette. |
| `aic-271420` | Soga Shohaku | "Handwritten Letter" | Same as above (a second sheet from the same pair). C=12.8, L=76.3. |

**3 items removed, across 2 painters** (John Singer Sargent: 1; Soga Shohaku: 2 — he keeps 8 real paintings, well
above the painter-page threshold, so his page and slug `soga-shohaku` stay).

## Other painters checked

Every corpus row whose artist field or title mentions a painter known to have personal papers/letters digitized
by museums (the full keyword sweep above covers this) was checked. No other painter had a letter, manuscript
page, signature, photograph-of-the-artist, printed page, catalogue, or exhibition-view record masquerading as a
painting. In particular:
- All 37 John Singer Sargent rows outside `commons-sargent-1.json` (across `commons-1/3`, `aic-1`, `cma-1`, `nga-1`)
  are genuine Sargent paintings — none matched the keyword sweep.
- No "photograph of the artist," studio-view, exhibition-view, installation-view, catalogue-cover, or frame-only
  record was found in any source.

## Mechanism

The ids above are listed, with reasons, in `data/corpus-nonpaintings.json` (not inside `data/corpus/`, so it is
never picked up as a corpus shard). `tools/corpus.py`'s `select()` drops any row whose full id (`"{src}-{id}"`)
appears there, the same place the existing `TEXT_PAGE` manuscript-text filter lives, so a full rebuild (`python3
tools/corpus.py build`) regenerates `data/corpus/*.json` without them going forward. `tools/gallery.py`'s
`load_corpus()` also filters against the same file, and `tools/sargent_extra.py`'s `build_rows()` skips them too.
Shards are never hand-edited by a person, but this specific fix *was* applied as a direct, minimal text/binary
edit of the three ids out of the already-committed `data/corpus/*.json` and `data/gallery/*` outputs (see
"2026-10-09 redo" below) rather than by re-running `tools/corpus.py build`.

## 2026-10-09 redo: why a surgical fix, not a rebuild

The first pass ran `python3 tools/corpus.py build` (plus the full downstream pipeline) to apply the exclusion.
That rebuild did not just remove the 3 ids: comparing the rebuilt shards against the previously-committed ones
showed about 80 unrelated ids dropped and 10 added (23781 -> 23711), including real, still-referenced paintings
(e.g. NGA's Renoir *A Girl with a Watering Can*, several NGA/SMK/Rijks/AIC/CMA rows cited from `data/articles/`).
The cause: `tools/corpus.py`'s `select()` -> `dedupe()` -> `cap_artists()` chain re-runs near-duplicate detection,
manuscript-group capping and the per-artist cap against whatever is in `research/_raw/` *right now*, and that
cache had drifted from the exact state the committed shards were built from — so simply re-running `build()` is
not reproducible, independent of the 3-id exclusion. (An unrelated environment wrinkle made this build's cache
state differ further: this worktree's numpy, 1.26.4, lacks `np.bitwise_count`, used by `dedupe()`copy, so a
throwaway venv with numpy 2.0.2 was used to run it — not implicated in the id churn itself, but one more reason
a from-scratch `build()` is not the safe tool for a 3-row removal.)

The fix was reverted on main (commits reverting both the corpus change and the color-graph rebuild that followed
it) and redone surgically: the 3 rows were deleted directly, by exact text/line match, from `data/corpus/aic-1.json`
and `data/corpus/commons-sargent-1.json` (nothing else in either file touched), and the corresponding 3 entries
were removed from the already-built `data/gallery/*` outputs (`ids.txt`, `thumbs.txt`, the `d/*.json` detail
shards reflowed at the 100-per-shard boundary, `index.bin` and `metrics.bin` at `REC`/27 bytes per row) rather
than regenerating them from images. Only the downstream layers that are *supposed* to be recomputed from the
painting set every time (analysis, artist stats, facets, the art-wiki, richdata, the color graph) were rebuilt,
against this corrected, otherwise-untouched corpus.

**Verification**: a script diffs the full id set before and after. `old - new` must equal exactly the 3 ids
above; `new - old` must be empty. See the commit this file ships with for that script's output.

To add a future exclusion: add `{"id": "<src>-<id>", "reason": "..."}` to `data/corpus-nonpaintings.json`. For a
single-digit number of rows, prefer the same surgical approach (see above) over `tools/corpus.py build`, which
is not safe to re-run casually against drifted caches; a full, intentional corpus rebuild is a separate, planned
operation of its own.
