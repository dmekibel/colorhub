# US depth staging, 2026-10-23

Goal: more US museum paintings, no API key. Staged and measured (every row has p/L/C). Nothing in data/corpus, data/gallery or index.html was touched.
Files: `data/corpus-staging/zz-museum-yuag-1.json`, `zz-museum-us-si-1.json`, `zz-museum-us-wd-{1,2,3}.json`. Tools: `tools/stage/yuag.py`, `si_us.py`, `us_wd.py` (wdq.py now reads `WD_MAXLAG`).

## Counts (final, after measuring and cross-dedupe)
| Source | Rows kept | Notes |
|---|---|---|
| Yale University Art Gallery (LUX, CC0 data) | 1,490 | 4,152 painting hits in the American, European and Modern/Contemporary sets; artist died <= 1955 kept (1,535 living/later/unknown dropped), 296 twins |
| Smithsonian Open Access | 559 | NPG 541, Cooper Hewitt 18 (oil sketches). CC0 metadata + CC0 image is the gate |
| Wikidata collection + Commons (PD, creator d. <= 1955) | 9,905 | per museum before measuring: MFA Boston 1,373, NY Historical 1,332, Harvard 1,019, DIA 843, Brooklyn 677, LACMA 536, Minneapolis 534, Philadelphia 445, Indianapolis 392, Princeton 368, MFA Houston 310, FAMSF 257, SLAM 236, Getty 234, Gardner 211, Dallas 211, Cincinnati 188, Crystal Bridges 159, Toledo 138, Worcester 132, Buffalo AKG 121, Phillips 115, High 101, rest under 100 |
| Total | 11,954 | co: United States 7,855 (artist's nationality otherwise: France 1,249, Netherlands 1,014, UK 631, Italy 516, Germany 183) |

Measure: 18 + 1,064 rows had no usable image (fetch failure or grey/b&w) and were removed so no row lacks p.

## Dedupe
Against data/corpus on origin/main: id, artist+normalized title+year (+-3) twin (lib.Held), Commons file name (6,209 Wikidata rows dropped as already held). Cross-file twins removed (yuag > Smithsonian > Wikidata).

## Blocked / not done
- Philadelphia Museum of Art: no public CC0 data dump exists (no repository found under the museum's GitHub accounts); covered through Wikidata only (445 rows).
- Getty and Harvard: no key-free bulk dump used; covered through Wikidata + Commons (234 and 1,019).
- Hirshhorn: 159 painting records, metadata not CC0, all dropped. Archives of American Art, NMAAHC, NMAH: no CC0-imaged paintings.
- Wikidata items without an inception date (4,879) or with several creators were dropped; living artists are excluded by the PD gate (401 dropped).
- Met American Wing: 94 PD paintings are cached in scratch but not in data/corpus (probably staged on another branch); not re-staged here.
- Wikidata maxlag=600 was used for label lookups; the SPARQL endpoint was queried one request at a time with no 429s.
- Commons images measure slowly (~1.5 images/s); LUX item fetch was throttled at first.

Caches (Smithsonian shards 4.5 GB, Wikidata, LUX) deleted from scratch. The research/_raw/measure-img image cache is gitignored.
