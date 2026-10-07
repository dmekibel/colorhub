# Poetry archive: sources, licenses, method

Built by `python3 tools/poetry.py fetch` (downloads, cached in `research/_raw/poetry`, gitignored) and `python3 tools/poetry.py build`.
Output: `data/poems-index.json` (~780 KB, loaded when the Poems lens, a color page or the Today card needs it) and
`data/poems/s0.json … s101.json` (~170 KB each, one loaded per poem opened). `python3 tools/poetry.py sample 30` prints random color mentions for a precision check.

## Counts (build of 2026-10-07)
- 11,440 poems by 429 poets in 11 traditions: English 8,875 · Italian 545 · Chinese 530 · Persian 322 · Latin 314 · German 235 · Bengali 197 · French 159 · Japanese 106 · Hindi 104 · Ancient Greek 53.
- 212 poems show the **original beside the translation**: Japanese 106 (the full Hyakunin Isshu plus 6 haiku), Persian 38 (Khayyam quatrains), Ancient Greek 27 (Sappho, Homer), Chinese 25 (Tang and one Han poem), Latin 7, French 3, Italian 3, German 3.
- 13,534 color mentions (13,288 in English text, 246 in originals); 4,526 poems name at least one color. 63 original-language color words carry a one-line note.

## Copyright rule
Only US public domain. Every English text and every translation was published before 1930; every original is centuries old
(Rilke's Neue Gedichte 1907/08, Rimbaud 1871/1883, Gautier 1852 are the youngest). Modern poems are not included at all.
30 poems use **"ColorHub's plain translation"**: our own literal versions of public-domain originals (Tang poems Pound didn't translate, the haiku, Rimbaud's "Voyelles", Rilke's two hydrangea poems). They are labeled as ours on the page.

## Sources
- **Project Gutenberg**, fetched from the PGLAF mirror (`gutenberg.pglaf.org`), as gutenberg.org asks bulk downloaders to do; the catalog came from the official `pg_catalog.csv` feed. One download per book, 1.5 s apart, cached. The ~100 books are listed in `BOOKS` in `tools/poetry.py` with poet, edition year and translator; the poem page links each poem to its ebook.
- **The Oxford Book of English Verse 1250–1900** (Quiller-Couch, 1900; Gutenberg #66619) fills in poets the single-author books miss (Wyatt, Herbert, Marvell, Vaughan, Tennyson…); its poems that duplicate a single-author book are skipped.
- **Wikisource** (API, cached, 1 s apart) for originals and scan-based translations:
  - ja: 小倉百人一首 (all 100 waka with kana readings); おくのほそ道 and 野ざらし紀行 (haiku).
  - en: William N. Porter, *A Hundred Verses from Old Japan* (1909), paired by poem number; E. H. Whinfield, *Quatrains of Omar Khayyám* (1883), paired with fa: رباعیات خیام (تصحیح وینفیلد) by quatrain number.
  - zh: each Tang poem's page (main reading where the page gives variants).
  - el: Sappho in H. T. Wharton's numbering (Επιγράμματα Σαπφούς), paired with Wharton's literal prose (1885, Gutenberg #57390); Homer from Monro and Allen's Oxford text (1920), paired with Lang, Leaf and Myers's Iliad (1883) and Butcher and Lang's Odyssey (1879).
  - la: Ovid, Metamorphoses IV (with Riley's 1851 prose). fr: Rimbaud, Gautier. de: Rilke, Goethe.
- Latin Horace, Virgil and Italian Dante come from Gutenberg Latin/Italian editions, paired with Conington (1863), the Gutenberg #230 Eclogues (translator not named in that edition) and Longfellow (1867).
- Allison Parrish's Gutenberg Poetry Corpus was not used: it gives lines, not poem boundaries.

## Method
1. **Splitting books into poems** (`segment`): paragraphs → headings (capitals, roman numerals, title-case lines after a gap) start poems; numbered parts of a titled poem stay in it; prose paragraphs (wrapped at ~70 characters, many lowercase line starts), contents lists, editorial notes, imprints, speaker names in plays and Latin originals printed beside translations are dropped. Per-book settings handle sonnet sequences, prose poems (Tagore, Kabir) and long poems (Dante, Homer, Milton). Duplicates (same poet and opening, or same distinctive title) are dropped. Messy annotated editions were left out (Donne/Grierson, Chaucer/Purves, Keats 1820/Robertson, Pope's Iliad/Buckley, the Greek Anthology/Mackail, Redhouse's Mesnevi).
2. **English color words** (`find_colors`): the 101 app colors and basics with their forms (redder, greening, whiteness…), plus poetic words mapped to the nearest app or library color (rosy → Pink, sable/ebon → Black, argent → Silver, hoary → Ash, azure, vermeil, russet, tawny, auburn, saffron, sapphire, ruby, sanguine…). Heuristics: a capital mid-sentence is a name (Mr Brown, the Red Sea); "violet/lilac/lavender" after a determiner and before a pause is the flower; "gold/silver" count only when they describe something or sit beside another color (otherwise they're usually money); "orange grove" is a tree; "sanguine" after "so/is/was" is a mood; bare "rose", "olive", "lime", "jade", "navy", "sage", "tan" are left out.
3. **Original-language color words** (`find_orig`, `GLOSS`): stems for Greek (accents stripped: κυαν-, πορφυρ-, χλωρ-, οἰνοπ-…) and Latin (purpure-, caerule-, candid-…), characters for Chinese and Japanese (青, 紅, 碧, 翠, 白妙, 紅葉…, with names like 白帝 excluded), suffix-aware tokens for Persian, word lists for French, Italian and German. Each note is hedged and avoids the myths in CLAUDE.md (e.g. oinops doesn't show the Greeks couldn't see blue).
4. **Index**: per poem id, title, poet, year (with a flag when approximate), tradition, palette (colors in order of first mention, with counts), line count, shard, and whether it has an original. Per color, up to 40 best lines (short, complete-looking lines; well-known poets and world poems first; at most two per poet), the first 8 with their text.

## Precision
Two random samples of color mentions after the final rules: 37/40 and 28/30 correct, about 93%. Remaining errors are mostly
flower senses ("with the rose and violet") and figurative gold ("golden sovereignty"). Segmentation is good but not perfect:
some book front matter and first-line titles slip through, and a few poems are split at internal headings.
