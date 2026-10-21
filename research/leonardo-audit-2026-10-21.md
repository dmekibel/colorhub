# Leonardo da Vinci rows in the corpus (read-only audit, 2026-10-21)

Why: David saw the one-painter map for Leonardo as "a mess, lots of repeats and drawings mixed with paintings".
The map is NOT tiling: every row is drawn exactly once (231 rows, 231 tiles, 0 duplicate ids, 0 duplicate image URLs). The mess is in the rows.

## Counts (data/corpus/*.json, artist == "Leonardo da Vinci")
- 231 rows: 196 from zz-commons-leonardodavinci-1.json, 20 commons-3, 13 commons-1, 10 commons-2, 2 nga, 1 cma. (Jusepe Leonardo 6, Leonardo Alenza 3, Leonardoni 1, Agustin Leonardo 1 are other painters.)
- ~137 distinct works behind the 231 rows: ~94 extra rows are the same work again as another Commons file. Last Supper 39 rows, Baptism of Christ 20, Leda 9, Adoration of the Magi 5, Salvator Mundi 4, Mona Lisa 3, Lady with an Ermine 3, Virgin of the Rocks 3, Annunciation 3.
- ~27 drawings / studies / heads (title keywords study, design, head of, profile).
- 1 codex folio (Codex Atlanticus (F0033)); more drawings hide behind plain titles.
- ~16 museum-room / building photos or workshop / attributed pieces.
- 29 rows whose title is raw Wikidata markup (`...label QS:Les,"La Ultima Cena" label QS:Lhu,...`, `Italian: Battesimo di Cristo The Baptism of Christtitle QS:P1476,...`). These are most of the Baptism and Last Supper repeats.
- 121 of 231 have no year.
- Only ~164 look like a painting by title, and that still includes photos of the Last Supper wall and details.

## Ten examples per kind
- Same work again, Last Supper: The Last Supper (Q128910); The Last Supper label QS... (F109991468, F3032252, F30506948, F45321415); Leonardo da Vinci - Ultima cena - ca 1975 (F4789548); Leonarda da vinci, last supper 01 (F11231248); Santa Maria delle Grazie Milano (Cenacolo Vinciano) 12, 15, 21.
- Same work again, Baptism of Christ: Italian: Battesimo di Cristo The Baptism of Christtitle QS... x7 (F13523044, F164302456, F165179000, F58468552, F64292521, F79147962, F160044); The Baptism of Christ (F10996524); The Baptism of Christ (Battesimo di Cristo), Galleria degli Uffizi (F118161770); Verrocchio, leonardo e altri, battesimo di cristo (F146837291).
- Drawings / studies: Study for the Last Supper (F11230284); Study for a kneeling Leda (F15884507); Head of Leda (F10334016); RCIN 912515 The head of Leda; RCIN 970129 A study for Leda; Design for The Adoration of the Magi; Figural Studies for the Adoration of the Magi; Studies of nude male figures and of a hygrometer; Head of Christ; Head of a Woman.
- Manuscript folio: Codex Atlanticus (F0033).
- Museum-room / building photos: Sala delle Asse; Cenacolo Vinciano, Santuario di Santa Maria delle Grazie, Milano (3070, 3073, 3082); Santa Maria delle Grazie Milano (Cenacolo Vinciano) 12, 15, 21, 32, 35; Milano - Chiesa di Santa Maria delle Grazie - 2023.
- Attributed / workshop / collaborative: Verrocchio and Leonardo da Vinci (attrib) The Detroit Adoration 01; Leonardo da vinci nella bottega del verrocchio (attr.), san donato d'arezzo, 1475-76; Verrocchio, leonardo e altri, battesimo di cristo.

## Rules that would catch them (for the data lane)
1. Instance-of: keep Wikidata instance-of painting (Q3305213) only; drop drawing, study, manuscript page, photograph, building. commons-F* rows are file pages with no instance-of, so they cannot be proven paintings: treat them as suspects whenever a Q-item painting of the same title exists (e.g. commons-Q12418 Mona Lisa).
2. One row per work: when a Q-item painting exists, drop every commons-F* row whose normalized title matches it (last supper|cenacolo|ultima cena, battesimo|baptism of christ, mona lisa|gioconda, ...). This alone removes ~90 rows.
3. Title cleanup: cut at `label QS:` / `title QS:`, strip a leading `Italian:`, then dedupe on cleaned title + artist.
4. Drawing keywords: study|studies|studio per|sketch|drawing|disegno|design for|cartoon|caricature|codex|codice|folio|manuscript|head of|notes.
5. Room / photo / attribution keywords: sala|cenacolo vinciano|santa maria delle grazie|chiesa|museum|room|refectory|interior|IMG_|DSC_ in title or file name; "(copy)", "after ...", "workshop of", "school of", "follower", "(attrib)", "attr.".
6. The big batch zz-commons-leonardodavinci-1.json (196 rows) added most of the noise beside 34 older rows; re-run it through rules 1-5 (tools/artist_extra.py) rather than hand-fixing.
