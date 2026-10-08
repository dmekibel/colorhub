# Maerz & Paul, *A Dictionary of Color* (1930): source search and digitization

Research + build pass, 2026-10-07. Follows the plan in `research/NAME-SOURCES.md` ("Maerz & Paul 1930 ...
legally clear but not import-ready ... flag as a follow-on digitization project"). This is that project.
Extraction code: `tools/maerz_paul.py`. Merge into `data/library.json`: `merge_maerz_paul()` in `tools/library.py`.
Method, grid-detection and OCR detail live in `tools/maerz_paul.py`'s module docstring (not duplicated here);
this file covers the legal/source side and the final numbers.

## 1. Legal status

Maerz, A. & Paul, M. Rea, *A Dictionary of Color*, 1st edition, McGraw-Hill Book Company, 1930.

Public domain in the US since **2026-01-01**. The 1930 registration (A23794) was renewed 1957-08-08 (renewal
R197244), per the [Stanford Copyright Renewal Database](https://exhibits.stanford.edu/copyrightrenewals/catalog/R197244).
A renewed pre-1978 work gets the full 95-year term: 1930 + 95 = 2025, public domain from the following January 1.
(Already established in `research/NAME-SOURCES.md`; repeated here as the basis recorded in this file per the
task's legal rule.) The 2nd edition (1950) is a different, later-copyrighted work and is **not** used or implied
by anything here.

## 2. Finding a usable scan

Three candidates were checked, in the order the task names them:

| Candidate | Status | Used? |
|---|---|---|
| **Internet Archive**, item `dictionaryofcolo0000aloy` (archive.org/details/dictionaryofcolo0000aloy) | 1930 McGraw-Hill edition confirmed by IA's own metadata (`date: 1930`, `publisher: McGraw-Hill Book Company, Inc.`). 224 pages. **Yes** -- see below for which of IA's own derivatives | **Yes** |
| **HathiTrust**, two "Full view" PD copies from the University of Michigan (`mdp.39015014923059`, `mdp.39015002012303`) | Confirmed `rightsCode: pd`, `usRightsString: "Full view"` via HathiTrust's own bibliographic API. But every page-image and viewer endpoint (`babel.hathitrust.org/cgi/pt`, `.../cgi/imgsrv/image`) returns a Cloudflare "Just a moment..." bot challenge (HTTP 403) to a plain fetch. Per this project's standing rule against bypassing bot detection/CAPTCHAs, this was not pursued further | No |
| **Google Books**, two listings (`id=jnQ0AAAAIAAJ`, `id=Nj0O0gEACAAJ`) | The `books/content` page-image endpoint only serves a real image behind a session-signed `sig=` token minted by Google's own viewer JS; a direct request returns a generic "image not available" placeholder. Reverse-engineering that signature to pull page images in bulk would be circumventing Google's own access control on the same page content, so this was not pursued either | No |

No university digital-collection copy beyond HathiTrust's own (same Google-digitized University of Michigan
scan) was found.

### Internet Archive: the derivative is desaturated, the original is not

IA publishes two tiers of page image for this item:

- `dictionaryofcolo0000aloy_jp2.zip` ("Single Page Processed JP2 ZIP") and the `iiif.archive.org` endpoint built
  from it (what a plain `archive.org/details/...` reader sees). **Desaturated**: mean HSV saturation ~0.06-0.08
  across every plate page checked (9, 29, and six more), peak saturation under 0.33 even on Plate 9's
  yellow-to-orange gradient, which should be highly saturated. Every "color" chip renders as blank cream paper.
  Unusable for this project -- this is what a first look at the item would show, and it would be reasonable to
  stop here and report no usable color scan exists.
- `dictionaryofcolo0000aloy_orig_jp2.tar` ("Single Page Original JP2 Tar", 480MB, 224 pages) -- the **raw,
  unprocessed camera capture**, one file per page, before whatever correction produced the derivative above.
  Mean saturation 0.12-0.32 on the same plate pages; Plate 9's color page reads as a real yellow-orange gradient
  (confirmed by eye, see `research/_raw/maerz-paul/` thumbnails made during this pass, not committed). **This is
  the scan used.** Each raw page is the full, uncropped, unrotated camera frame (book cradle and all); the
  derivative's own orientation metadata (`_scandata.xml`, `handSide`/`rotateDegree` per leaf) was used to
  confirm the rotation rule `tools/maerz_paul.py` applies (even leaf = verso = rotate 90&deg;, odd leaf = recto
  = rotate 270&deg;), not to source any pixel data -- all color values come only from the original tar.

### A scanning gap: Plate 2 is missing

Leaf 38 (the physical page immediately after Plate 1's color page, leaf 37) is already printed "Plate 3", and
the book's own printed page numbers jump from 25 (Plate 1's color page) to 28 (Plate 3's key page) across that
one leaf-to-leaf step. Two physical pages -- almost certainly Plate 2's key and color pages -- were never
photographed, most likely two leaves turned together during the original IA scanning pass. This was checked
directly (reading each page's own printed "Plate N" label and page number by eye, not inferred), not assumed.
**55 of the 56 plates are recovered; Plate 2's names have no chip to measure and are not in the output.**

## 3. What was built

- `data/sources/maerz-paul-1930.json` -- `tools/maerz_paul.py`, one JSON object per line after a provenance
  header line (see that file's own `_fields` line and `research/LIBRARY.md` s9 for the exact numbers: chip and
  name counts, the color method, the spot-check error rate, and the library merge result).
- `merge_maerz_paul()` in `tools/library.py`, wired into `build()`, adds this source into `data/library.json`.

## 4. Known limitations (same honesty standard as the Ridgway/ISCC-NBS imports)

- **Plate 2 missing** (above) -- about 1/56 of the book's chips are simply not recoverable from this scan.
- **OCR recall is moderate, not complete.** The key-page grid is read directly (no separate alphabetical index
  needed -- see `tools/maerz_paul.py`), but a meaningful share of real printed names are dropped rather than
  risk inventing a name where none exists: the word-shape filter in `plausible_name()` rejects any OCR result
  that doesn't look like a real capitalized/ALL-CAPS word or a Maerz & Paul superscript code, which also throws
  out some genuinely-present names that OCR mangled past recognition. See `research/LIBRARY.md` s9 for the
  measured rate on a spot-checked sample.
- **No new per-chip calibration beyond the plate-level white balance.** Each plate is white-balanced once,
  against its own margin board (see `tools/maerz_paul.py`); no per-chip or cross-plate color-constancy
  correction is attempted, consistent with how Werner and Ridgway's "approximate, uncalibrated scan" values are
  already treated in this library.
- **Spelling correction is one-directional and single-word only** (`correct_spelling()` in
  `tools/maerz_paul.py`): it only fills in characters OCR dropped, against the ISCC-NBS Maerz & Paul name list,
  and only touches names with no space (a multi-word OCR result ending in a short suffix is almost always the
  book's own color-family code -- "Carnival R", "Clove Pk" -- not a truncation, and "fixing" it against a
  dictionary entry that spells the suffix out in full would replace a correct transcription with a wrong one).
  A small residual risk remains even for single-word names: an already-correct, already-complete OCR read can
  still be a *substring* of an unrelated, longer dictionary entry (the one found by spot-checking: "Black" was
  rewritten to "Ink Black" purely because it is a substring, with no actual evidence the plate's own print was
  truncated). This is rare -- most corrected names are unambiguous OCR truncations ("AUPE" -> "Taupe",
  "Briarwoc" -> "Briarwood") -- but not provably zero.

## 5. Calibration target: none exists in this scan

David asked whether the Internet Archive scan includes a color calibration target (a ColorChecker-style chart
or a grey scale) that could calibrate the scan with a fitted per-channel curve or 3x3 matrix before the
paper-margin white balance. It does not.

The book's own `_scandata.xml` tags exactly two of the 224 leaves `pageType: Color Card` -- IA's own scanning
software uses that label for a bookend reference card photographed before and after the book itself, not
necessarily a real multi-patch calibration target. Both were checked directly:

- **Leaf 0** (`cropBox` 1100x1100px, tiny): a uniform near-black rectangle. Sampled across three widely spaced
  regions, mean RGB (36-47, 34-46, 35-44) with no structure -- a plain black backing card, not a chart.
- **Leaf 223** (the last leaf): the book's own back inner cover board (cloth, tape, plastic wrap) -- also not a
  chart.

The two `Cover` leaves (1 and 222) were checked too, for completeness: front and back covers, not calibration
material. No ColorChecker, IT8, or grey-scale target exists anywhere in the 224-page scan. Without one, the only
available reference for white balance is each plate's own unprinted margin (the method already in `tools/maerz_paul.py`),
which is what the rest of this section validates against an independent 1955 source instead.

## 6. Independent accuracy check: the ISCC-NBS cross-reference

The 1955 ISCC-NBS dictionary (`data/sources/iscc-nbs-names.json`, already imported, s8 of this file's sibling
note in `research/LIBRARY.md`) sources many of its own entries to `"M"` (Maerz & Paul) directly from the real
physical chips, measured by Hamly/Kelly & Judd in the 1940s-50s -- a different copy of the book, a different
measurement method, two decades closer to 1930. That gives two independent things to check against:

1. **Color accuracy**: does *our* measured hex for a name land near the Munsell block ISCC-NBS assigned that
   same name? (`tools/maerz_paul.py --iscc-check`)
2. **Name accuracy**: does *our* OCR'd spelling match a name ISCC-NBS also lists? (`correct_spelling()`, s4)

**3,291 unique names** in the ISCC-NBS dictionary are sourced to Maerz & Paul; after spelling correction (s4),
**374 of our 825 extracted names (45%)** match one exactly by spelling, and those 374 are the final ground truth
(the full 3,291 is also used separately for spelling correction, s4). "Munsell boundaries" (rather than just
each block's centroid) were not available for this check -- only the centroid notations are digitized here
(`research/LIBRARY.md` s8); a true boundary-polygon check was out of scope.

**Result at the shipped setting (PAPER_GAMMA=1.5):** 37% of the 374 land within &Delta;E00 8 of their assigned
block's centroid (this library's own "near a block" threshold, `tools/library.py` `ISCC_DE`); median &Delta;E00
is 9.7. That's a real, meaningful disagreement rate -- most pairs land outside normal block-width noise -- not
just the coarse-centroid slack the ISCC-NBS import itself expects (`research/LIBRARY.md` s8 notes block
centroids are "already a coarse stand-in for an entire wedge of the Munsell solid"). The worst outliers
(&Delta;E00 30-55) are measured chips that read as near-neutral greys and browns against blocks ISCC-NBS assigns
to vivid, saturated hues (vivid pink, strong olive) -- partly the surviving plate's own 95-year fade in those
specific wedges, the same phenomenon `research/LIBRARY.md` s2 documents for Ridgway's aniline-dye plates ("Light
Blue-Violet off by &Delta;E 38"), and, per the direct spot-check in s7 below, partly genuine extraction errors
(a handful of merged/garbled OCR names) that this cross-check alone cannot distinguish from fade. **58 chips
(16% of the 374) beyond &Delta;E00 20 are marked `"uncertain"` in `data/sources/maerz-paul-1930.json`** and are
excluded from the library merge entirely (`tools/library.py` `merge_maerz_paul()`), rather than shipped as
either a new color or an alternate name.

**Paper-transmission-weighted correction (per David's physical-model request).** Printed ink is partly
transparent, so a light, thin-ink chip should carry nearly the full paper-yellowing cast and a dark, dense chip
very little of it; a single uniform white balance should over-correct dark chips. Implemented as
`white_balance(rgb, margin_rgb, gamma)` in `tools/maerz_paul.py`: a weight `w = clip(L_chip/L_paper, 0, 1)**gamma`
scales how much of the margin's correction is applied, so `gamma=0` reproduces the old uniform correction and
larger `gamma` increasingly spares dark chips. Fitted by grid search (`--fit-gamma`) against the 322-chip
ISCC-NBS ground truth available before the final spelling-correction pass below (the fit was not rerun against
the larger 374-chip set -- itself evidence of how little gamma moves the result either way):

| gamma | median &Delta;E00 | light chips (L&ge;70, n=47) | mid chips (40-70, n=187) | dark chips (L&lt;40, n=88) |
|---|---|---|---|---|
| 0.00 (uniform, old default) | 9.23 | 8.11 | 9.77 | 9.42 |
| 1.50 (shipped default) | 9.22 | 8.11 | 9.92 | 9.48 |
| 4.00 (grid-search best) | 9.08 | 8.11 | 9.92 | 9.39 |

**Honest finding: gamma barely matters for this particular scan**, and where it moves the needle it is within
noise -- the full 0-4 sweep only moves the overall median from 9.23 to 9.08, and the per-brightness breakdown
shows no clean monotonic improvement (dark chips get very slightly *worse* at gamma=1.5 before recovering at
gamma=4; light chips, where `w` is always &approx;1 regardless of gamma, are unchanged by construction). The
reason: this scan's margins are already close to neutral -- mean margin RGB across all 322 ground-truth plates
is (115.6, 114.5, 114.3), a cross-channel spread under 1.3 units out of 255 -- so there is very little
paper-yellowing cast for any weighting scheme to redistribute. The dominant source of the remaining &Delta;E00
~9 is the block-centroid comparison's own coarseness and 95-year fade (above), not calibration. `PAPER_GAMMA` is
still set to **1.5** (not 0) as a physically-motivated, do-no-harm default -- statistically indistinguishable
from uniform correction on this scan, but ready to matter on a future, more yellowed scan without forcing
another code change.

**Spelling correction, applied as part of this same cross-check (s4):** 52 of the 825 names were corrected
against the 3,291-name Maerz & Paul list (OCR truncations like "AUPE" -> "Taupe", "Briarwoc" -> "Briarwood",
"Zanziba" -> "Zanzibar") before the color check above ran, so the 37%/374 numbers already reflect the corrected
spellings.

## 7. 30-name spot check and the merge decision

A random 30-name sample (`tools/maerz_paul.py --spotcheck 30`) was read against what plausible Maerz & Paul
chip names should look like. Most read right -- "Crushed Berry", "Rose Ash", "Seaspray", "Cedarbark", "Zinnia",
"Blush Rose" are exactly the kind of compound floral/mineral names the book uses throughout. But the sample also
turned up at least two clear fabrications that the ISCC-NBS cross-check in s6 cannot catch (they have no
dictionary match to flag as `"uncertain"` in the first place): **"Maracail Domingc"** and **"Tanagra Castilian
Old Cedse"** -- both structurally plausible (every word passes `plausible_name()`'s shape check) but not real
names; almost certainly two different cells' OCR text run together by a crop that caught a neighbor's print.
"CANNC" (plate 32 A5) is also suspect, a probable truncation `correct_spelling()` didn't resolve. That's roughly
2-3 clear failures in 30, on top of the 58 chips already excluded as `"uncertain"` -- **this does not cleanly
"read right."**

Per the instruction to merge only if the spot check reads right and otherwise leave the library untouched:
**`data/library.json` was reverted to its pre-task state (2,711 entries) and the Maerz & Paul import was NOT
merged into it.** A trial merge was run earlier in this pass (on an intermediate, pre-spelling-correction version
of the extraction) and did produce a plausible-looking result -- 212 new distinct colors, 2,711 -> 2,923 entries
-- but that run predates both the spelling-correction pass and this spot check, so it does not reflect what's
actually being shipped here and was discarded along with the revert, not used as the final number.

**What ships from this pass:** `data/sources/maerz-paul-1930.json` (825 names, extracted, spelling-corrected and
ISCC-NBS-flagged, exactly as described above) and `merge_maerz_paul()` in `tools/library.py` (code only, tested
against synthetic fixtures, ready to run). **What's left undone:** either a tighter extraction filter that
specifically catches cross-cell text bleed (the "Maracail Domingc" failure mode -- a plausible next step would
be rejecting any name whose cell crop's OCR bounding box extends unusually far past the cell's own interior
region) or a manual pass over the 825 names before merging into the live library. Running `python3
tools/library.py --build` after either of those would perform the merge; it is not done as part of this pass.

## 8. Round 2 (2026-10-08): the Index of Color Names, a corrected grid, and a real color fit

Round 1 read only the names printed on the plate key pages. The book's **Index of Color Names** (printed pp. 189-207, leaves 199-217 of
the same Internet Archive scan) is the valuable part: every name with the **year it was first recorded**, a code for its trade
(textile, pigment, vegetable dye...), a translation when it is foreign, sometimes an etymology, and the plate, column and row of its chip.
Public domain, same legal basis as s1. Code: `tools/mp_index_ocr.py` (OCR), `tools/mp_parse.py` (entries), `tools/mp_chips.py` (all chips),
`tools/mp_dictionary.py` (mapping, color fit, outputs), `tools/mp_notes_data.py` (the Notes section, paraphrased by hand);
merge: `merge_maerz_paul_dictionary()` in `tools/library.py`.

**Text.** The Internet Archive's own OCR text interleaves the three columns line by line and misreads the bold plate references, so the
index was re-read from the original camera JP2s: deskew, find the column edges, cut each column into lines by its ink profile, and OCR
every line three ways with tesseract (the whole line, the date field, and a digits-and-A-L-only crop of the plate reference). 3,870 index
entries (2,783 point at a chip; 1,087 are obsolete synonyms with no chip), 4,014 rows once "Fesse, Fess" style lists are split.
Names are checked against the ISCC-NBS 1955 dictionary: 2,705 of 4,014 rows are names it also lists (flag `verified`).

**Plate references.** The two reads of each reference are compared; an impossible one (plate over 56, the bold 3 read as 8) is repaired
against the round-1 key-page name at that cell and the ISCC-NBS block color of the name. Entries whose reads agree are the
fit's ground truth, so the fit never depends on the color it is fitted to. 1,710 distinct chips carry a name; 87 rows point at
**plate 2, which is missing from the scan**: they keep name, date and note but no color.

**A grid bug in round 1.** Round 1's grid finder took the black edge of the book cradle for the first ruled line on most plates, so
all 12 columns were sampled about half a column to the left, and column A on 40 plates sampled the grey board strip (a flat
(120,120,118)). `tools/mp_chips.py` finds the 13 rules in each direction as a comb (dips of mean luminance plus dark-pixel mass,
sub-pixel pitch) and all 7,920 cells are re-sampled; every plate now has a 2,484-2,520 x 3,212-3,252 px grid (checked by overlay on
plates 4, 37, 56). Round-1 chip hexes in `maerz-paul-1930.json` are therefore off; the dictionary file supersedes them.

**Color fit.** 1,029 chips whose name is an ISCC-NBS name sourced to Maerz & Paul (block centroid = target; 40 name collisions of more
than dE00 25 trimmed). Model: a robust global affine in CIELAB plus a per-plate affine shrunk toward it (ridge 100), chosen by repeated
80/20 cross-validation over five alternatives. **Held-out 20% (205 chips): median dE00 8.18 before, 6.07 after** (cross-validated
8.53 to 6.30; all chips 8.44 to 5.52). The floor is the width of an ISCC-NBS block, not the scan: a centroid is not the chip. Chips more
than dE00 15 from their block are `uncertain` (also name, plate-reference or date doubts); 1,312 of 4,014 rows carry the flag and
`uncertain_why`.

**Merge** (naming policy, CLAUDE.md 2026-10-08). A name already a card gains the date and chip in its note; a name already an alternate
gains them on the alternate; a name whose own chip is >= dE00 2.5 from every card, verified and not foreign becomes a new card
(274, best first: ALL CAPS constant-use names, then traditional over trade-code names, older first); the rest become alternates on
the nearest card (foreign names only as alternates). Library 1,789 -> 1,934 cards (the 129 round-1 Maerz & Paul cards, whose hexes came
from the shifted grid, are replaced by 274 from the dictionary).
`data/sources/mp-etymology.json` holds 2,784 names: 2,746 with a first-recorded year, 1,140 with a short paraphrased origin
(the index's own translation / etymology / trade code, plus the hand-paraphrased Notes facts).

**Limits.** OCR of obscure obsolete words is the weak spot (a name with an unknown word is `suspect` and stays out of the library);
the date column is "earliest date found" by the authors, not an independent first attestation; two dates conflict-read are flagged;
`main`'s `python3 tools/library.py --paintings` already fails on a missing "Ink Black" card (not caused by this change).
