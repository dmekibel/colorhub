# More color names for the honeycomb: candidate sources

Research pass, 2026-10-07. Looks for real, legally-usable color names beyond
the 2,711 already in `data/library.json` (xkcd, Wikipedia, Ridgway 1912,
Werner 1821, Japanese traditional colors, RAL, CSS/X11, the app's own 101 —
see `research/LIBRARY.md` for how that library was built and merged).
Nothing in this pass touches `data/` or any app code; it's findings only.

**Method.** WebSearch + WebFetch only (no browser pane, no scraping of
sites whose terms forbid it). Every legal claim below is cited. Where a
claim rests on a general rule rather than a source-specific finding, that's
said plainly. "New-name" counts are spot-sample estimates, not full
extractions — see each row's evidence.

## Summary table

| Source | License status (evidence) | Name count | New vs. library (sample) | Values available? | Quality | Recommendation |
|---|---|---|---|---|---|---|
| **ISCC-NBS Dictionary of Color Names** (NBS Circular 553, 1955, + NBS Special Publication 440, 1976, "Color: Universal Language and Dictionary of Names") | **Public domain, confirmed.** U.S. government work. The companion NIST paper states outright "papers are in the public domain and are not subject to copyright in the United States" ([Kelly 1958, J. Res. NBS 61(5)](https://nvlpubs.nist.gov/nistpubs/jres/61/jresv61n5p427_A1b.pdf)); Circular 553 itself is posted by the U.S. Government Publishing Office ([govinfo.gov](https://www.govinfo.gov/app/details/GOVPUB-C13-65f63ba398aa703418c5e0881f2985ab)) and the 1976 update carries a DOI at NIST ([doi.org/10.6028/NBS.SP.440](https://doi.org/10.6028/NBS.SP.440), [archive.org copy](https://archive.org/details/coloruniversalla440kell)) | ~7,500 synonym entries across the two editions (widely cited figure; confirmed by direct inspection — the dictionary section of Circular 553 runs the entire back half of a 172-page OCR'd scan, roughly 8,000 three-column lines, letters A–Z) | **~58% new** in a 43-name spot sample across three letter-ranges (A, I–K, Y–Z): 25 new, 18 already in `library.json` via existing Wikipedia/xkcd/CSS entries. See `research/name-sources/overlap-sample.csv` | **Yes, but coarse.** Each entry maps a real historical/commercial name to one of 267 ISCC-NBS "color-name blocks." The 267 block centroids have an *official* Munsell H V/C notation published directly by NIST ([Kelly 1958, Table 1](https://nvlpubs.nist.gov/nistpubs/jres/61/jresv61n5p427_A1b.pdf); also on [Wikisource](https://en.wikisource.org/wiki/Central_Notations_for_the_Revised_ISCC-NBS_Color-name_Blocks), tagged `{{PD-USGov}}`), convertible to sRGB with standard, openly published Munsell-to-XYZ tables. Every name in the dictionary gets its block's centroid hex — not its own distinct shade | **Real names, uneven obscurity.** Alice Blue, Ivory, Jade, Jonquil, International Orange sit next to Abyss, Acanthe, Zaffre Blue, Yule Tree, Kis Kilim. Each entry also names its *origin* (M=Maerz & Paul, R=Ridgway, P=Plochere, T=Textile Color Card Assn., TC=Army Transportation Corps, F=Federal/AN specs, H=Horticultural Colour Chart…), which is useful provenance text in its own right | **Use.** This is the single best find of the pass: thousands of new, real, well-provenanced names, cleanly public domain, with a legitimate (if coarse) path to color values that doesn't depend on any third party's unlicensed re-digitization |
| **The 267 ISCC-NBS centroid blocks themselves** (names like "vivid pink", "deep yellowish brown") | Same as above — public domain | 267 | Low value as *names* — these are lightness/strength compounds, the same kind the app already treats as non-primary vocabulary, not collectible words | Yes, official Munsell notations (see above) | Functional, not charming | **Use as a value source only**, not as app-facing names |
| **Maerz & Paul, *A Dictionary of Color*, 1st ed. (1930)** | **Public domain as of Jan 1, 2026 — now confirmed, not just assumed.** The 1930 registration (A23794) was renewed Aug 8, 1957 (renewal R197244) per the [Stanford Copyright Renewal Database](https://exhibits.stanford.edu/copyrightrenewals/catalog/R197244). A renewed pre-1978 work gets the full 95-year term, so 1930 + 95 = 2025 → public domain from 2026-01-01. Full text and page scans at [Internet Archive](https://archive.org/details/dictionaryofcolo0000aloy) (full-text, unrestricted) and [HathiTrust](https://babel.hathitrust.org/cgi/pt?id=mdp.39015014923059) | 56 color charts; exact name count not found in this pass (dictionary front matter wasn't fully read) | Not sampled — no digitized name-to-value dataset exists yet to compare against | **No.** No existing open digitization of the actual color chips/plates was found (unlike Ridgway, which has `github.com/davo/Color-Standards-and-Color-Nomenclature`). Wikipedia already cites Maerz & Paul for 35 entries already in `library.json` (hex values Wikipedia itself derived); going beyond that needs a new plate-digitization project, the same kind of effort `davo` did for Ridgway | Unknown until digitized — Maerz & Paul is generally regarded as a serious, systematic reference | **Maybe.** Legally clear, but turning it into names+hex is a real project (crop and sample ~56 plates, same risk profile as the Ridgway work already done), not a quick import. Worth flagging as a future project, not this pass |
| **Maerz & Paul, 2nd ed. (1950)** | **Avoid — presumptively still under copyright.** 1950 + 95 = protected through 2045 if renewed (not checked in this pass; if it was *not* renewed around 1977–78 it could already be PD, but that wasn't confirmed either way) | — | — | — | — | **Avoid** until a renewal check specifically for the 1950 edition is done. Don't assume the 1930 finding carries over |
| **Colour Index generic names** (Society of Dyers and Colourists / AATCC) | **Avoid — proprietary.** The live database (27,400+ generic names) is a paid subscription product, £37/user/year ([v3.colour-index.com](https://v3.colour-index.com/)) | 27,400+ | n/a | n/a | n/a (these are material-science pigment codes like "PR 254", not consumer color-name vocabulary anyway) | **Avoid** |
| **meodai/color-name-lists** (GitHub aggregator) | **Mixed — code is MIT, but content provenance is uneven and the repo doesn't audit it.** The repo's own license is MIT ([color-names/LICENSE](https://github.com/meodai/color-names/blob/main/LICENSE)), but that's David Aerne's compilation code/license, not a representation that every underlying list is clear. Per-list sources are named in the [README](https://raw.githubusercontent.com/meodai/color-name-lists/main/README.md): several are Apple's OS X Crayons (Apple's own proprietary picker), Le Corbusier's 63 architectural colors (a living Swiss paint company's trademarked range, lescouleurs.ch), a single author's personal blog list ("The Color Thesaurus," Ingrid Sundberg), NTC.js (2007, "collected from various sources," unverifiable chain), and Risograph ink names (tied to specific commercial paper stock codes). Only its Ridgway, Werner, Wikipedia, RAL and xkcd lists have a clear public-domain/CC/CC0 basis — and **ColorHub already sources all five of those directly**, not through meodai | Aggregate ~30,000+ across all lists; the genuinely new sub-lists (China, Le Corbusier, Crayons, Thesaurus, NTC) are much smaller, low hundreds to low thousands each | Not sampled — see per-list caveats | Yes for most lists (they carry hex) | Variable; several (China traditional colors, Le Corbusier) are good quality but tied to unclear or no license | **Avoid the aggregator as a bulk import.** The parts we don't already have directly are exactly the parts with the shakiest rights. See line below for the one list worth a second look |
| ↳ **Traditional Colors of China** (one meodai sub-list, CSV at `github.com/ItMarki/files`) | **Avoid — no stated license anywhere**, and the content (Chinese + pinyin names, no English) reads as pulled from a specific commercially-published book, *中国传统色：故宫里的色彩美学* ("Traditional Colors of China: Color Aesthetics in the Forbidden City"). The GitHub repo has no LICENSE file and no README (confirmed: 404 on both) | 383 names+hex (confirmed by direct download) | Not checked — no English names to compare | Yes, hex given | Good names, but pinyin-only and of unclear origin | **Avoid** without verifying the book's status and getting real attribution/permission |
| **Répertoire de couleurs pour aider à la détermination des couleurs des fleurs, des feuillages et des fruits** (Oberthür & Dauthenay, Société française des chrysanthémistes, 1905) | **Public domain, confirmed.** Marked `NOT_IN_COPYRIGHT` by the [Biodiversity Heritage Library](https://www.biodiversitylibrary.org/bibliography/27481); full scans at [Internet Archive](https://archive.org/details/rpertoiredecou01soci), [HathiTrust](https://catalog.hathitrust.org/Record/001985462), and [Gallica](https://gallica.bnf.fr/ark:/12148/bpt6k937984j) | 2 editions: 733 and 718 color samples respectively, 1,385 shades across 365 plates total per a later reprint's count; names given in **French, Latin, German, English, Spanish and Italian** | Not sampled — no existing digitization with values was found | **No.** No digitized name-to-hex dataset was found anywhere (checked GitHub and general web search). This would be a from-scratch plate-digitization project, same scope as the Ridgway work, and in French-led plates that are over a century old | Likely good — it's a serious horticultural reference still cited in modern color books, and gives English equivalents directly | **Maybe — a real find, but a future project, not this pass.** Worth a line to David: it exists, it's clean, nobody's digitized it yet |
| **A Nomenclature of Colors for Naturalists** (Ridgway, 1886 — Ridgway's *earlier*, smaller book, distinct from the 1912 one already in the library) | Public domain (1886) | 186 colors | Likely mostly superseded — most 1886 names carried forward into the 1912 edition the library already uses, but not confirmed | No digitized hex dataset found | Smaller, earlier version of what's already used | **Avoid / low priority** — the 1912 successor is already in the library and is strictly larger |
| **Federal Standard 595** (US GSA paint-color standard) | The standard itself (numeric codes) is a US government work, but **the colors have no official names** — only five-digit codes. Any name you see ("Air Superiority Blue," "International Orange") is a third-party vendor's informal label, not part of the standard, per [Wikipedia](https://en.wikipedia.org/wiki/Federal_Standard_595) | n/a (codes, not names) | n/a | Yes (official sRGB approximations exist for the codes) | Low — these aren't real "names people use," they're paint-chip numbers with ad hoc nicknames | **Avoid** |
| **xkcd, Wikipedia, Ridgway 1912, Werner 1821, RAL, CSS/X11, Japanese traditional colors** | Already in `data/library.json` | — | — | — | — | *(already done — included for completeness, not re-researched)* |

## What's new here vs. `research/LIBRARY.md`

`LIBRARY.md` already used the ISCC-NBS dictionary once, but only as a
**quality check** on Ridgway's digitized hex values, explicitly *not
redistributed* ("used here only as a check and is not redistributed")
because the specific digitization it leaned on (Mundie & Foster's
`tx4.us/isccnam.htm` copy) has no stated license. That caution was correct
for that specific third-party copy. But the underlying government
dictionary and the official NIST centroid table are both clean public
domain in their own right — so a fresh pass straight from the Circular
553 / SP 440 text and the NIST Research Paper 2911 table (not through
Mundie/Foster) is on much firmer ground, and is the recommendation below.

## Recommended import plan

1. **ISCC-NBS synonym dictionary (Circular 553 + SP 440), first.** Re-OCR
   or hand-transcribe the ~7,500-entry dictionary (the raw `pdftotext`
   dump used for this research, `research/name-sources/nbs553-dictionary-sample.txt`,
   is NOT clean enough to import directly — it has real OCR errors).
   Assign each name its block's sRGB centroid, computed independently from
   the official NIST Munsell notations (`research/name-sources/iscc-nbs-267-centroids-raw-ocr.txt`,
   also needs a clean re-transcription), using an open Munsell→sRGB
   conversion (e.g. the published Munsell renotation data, not copying any
   one project's derived hex table). Mark every entry's hex as "approximate:
   block centroid, not the name's own measured shade" the same way Ridgway
   entries are marked "approximate: scan of an aged plate" — this is
   consistent with the existing library's honesty convention. At a ~58%
   new rate on the sample, this alone could plausibly add **several
   thousand** names.
2. **De-dupe against the existing 2,711** using the same merge rule
   already in `LIBRARY.md` §3 (case/accent/hyphen-insensitive match).
   Expect many merges where an ISCC-NBS entry names a color already in
   the library from Wikipedia/xkcd/Ridgway/Werner, which is fine — those
   become `alts`.
3. **Maerz & Paul 1930 and the 1905 Répertoire de couleurs are legally
   clear but not import-ready** — flag both as follow-on digitization
   projects (crop-and-sample the plates, the same method `davo` used for
   Ridgway), not part of this round.
4. **Skip** Colour Index, the 1950 Maerz & Paul edition, Federal Standard
   595, Ridgway 1886, and the meodai aggregator's unclear sub-lists
   (China, Le Corbusier, Crayons, Thesaurus, NTC.js, Risograph).

**Estimated final size:** 2,711 existing + perhaps 2,500–4,500 new,
non-duplicate ISCC-NBS names (the 58% sample rate applied to a ~7,500-entry
dictionary, discounted for the fact that spot samples skew toward the more
"notable" letters picked for the check) → roughly **5,500–7,000 names**
once ISCC-NBS alone is done. Maerz & Paul and the Répertoire would each add
more on top if digitized later.

## Open questions for David

1. **Is a coarse, shared "block centroid" hex an acceptable value for
   thousands of ISCC-NBS names**, given the honeycomb currently shows ~9,000
   distinct colors? Many ISCC-NBS synonyms would share an identical hex
   with dozens of other names in the same block (by design — that's what
   the block system is). Worth deciding before importing: does a shared,
   coarse value undermine the "established names, not generated ones"
   goal, or is real provenance enough even at low color precision?
2. **Is the Maerz & Paul / Répertoire de couleurs digitization worth a
   dedicated future pass?** Both are legally clear now, but turning either
   into a name+hex dataset is comparable in effort to the Ridgway
   digitization already done, and nobody has done it yet for either book.
3. **Should the 1950 Maerz & Paul edition's renewal status be checked
   properly** (Stanford database, by specific title/date/claimant) before
   ruling it out entirely, or is it fine to just wait until 2046?
4. **Is multilingual naming (French, Spanish, Hindi, German, Chinese) a
   future direction worth pursuing**, even though most of those lists found
   in this pass had patchy or no licensing? If yes, the Répertoire de
   couleurs (1905, public domain, gives English/French/German/Spanish/
   Italian names together) is a better starting point than the meodai
   per-language lists.

## Files

- `research/name-sources/nbs553-dictionary-sample.txt` — ~100-line spot
  sample of the Circular 553 dictionary (letters A, I–K, Y–Z), with full
  provenance header. OCR, not clean.
- `research/name-sources/iscc-nbs-267-centroids-raw-ocr.txt` — the 267
  official centroid block notations, OCR'd from the NIST paper. Also OCR,
  not clean.
- `research/name-sources/overlap-sample.csv` — the 43-name hand-checked
  sample behind the "58% new" estimate above.
