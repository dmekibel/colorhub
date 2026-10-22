# Non-Western and women painters, staging, 2026-10-22

Staged in `data/corpus-staging/` on branch `worktree-agent-a93f2082a1df011f4` (built on `origin/staging/us-uk-cc0` plus commit 3e591c9e6, which holds `tools/stage/`). Nothing in `data/corpus`, `data/gallery` or `index.html` was touched and no image was downloaded. Row schema is the existing one (id, src, t, a, y, co, mv, img, license, url, span). Every row has a title and an approximate date; paintings only (scrolls, screens, album and manuscript leaves count; prints, drawings, ceramics, textiles, photographs do not). Dedupe is by id and by artist+title+year twin (within 3 years) against `data/corpus` and every other staging file. Scripts: `tools/stage/nw.py` (shared), `nw_met.py`, `nw_si.py` (+ `si_shards.py`), `nw_aic.py`, `nw_cma.py`, `nw_wd.py` (modes `women`, `nw`, `japan`), `wdq.py`. Total **15,569 new rows**.

| File | Rows | Source / licence |
|---|---|---|
| `zz-museum-met-asia-1.json` | 2,731 | Met Open Access, Asian Art / Islamic / Africa-Oceania-Americas departments, CC0 |
| `zz-museum-freer-sackler-1.json` | 1,003 | Smithsonian Open Access, National Museum of Asian Art (+ African Art, none kept), CC0 |
| `zz-museum-cleveland-nw-1.json` | 188 | Cleveland: the non-Western Painting rows set aside earlier, plus illustrated Indian/Islamic/Japanese Manuscript leaves, CC0 |
| `zz-museum-aic-nw-1.json` | 36 | Art Institute of Chicago, Asia/Americas/Africa departments, public domain |
| `zz-commons-japan-1.json` | 659 | Wikidata + Commons, Japanese-creator paintings, PD |
| `zz-commons-nonwestern-1.json` | 2,959 | Wikidata + Commons, 16 country groups (below), PD |
| `zz-commons-women-1/2.json` | 7,993 | Wikidata + Commons, women painters, PD (1,475 named painters) |

## Non-Western by country (the six non-women files)
Japan 2,475; Brazil 1,411; China 1,295; India 622; Australia 320; New Zealand 268; Mexico 199; Argentina 170; Iran 124; Tibet 104; Venezuela 78; Korea 74; Uruguay 72; Turkey 70; Peru 70; Nepal 33; Chile 30; Philippines 21; Cuba 19; Lebanon 17; Afghanistan 13; Sri Lanka 10; Ethiopia 10; Thailand 9; South Africa 9; Indonesia 8; Iraq 8; Egypt 8; Myanmar 7; Mongolia 4; Syria 4; Ecuador 4; Bolivia 3; Colombia 3; Vietnam 2; Pakistan 1; Haiti 1. (Total 7,576.)

## Women
7,993 rows, 1,475 painters (1,996 women painters who died by 1955 have an imaged work on Wikidata; 1,557 had rows before the artist-name join). Biggest: Marianne North 806 (Kew botanical oils), Angelica Kauffman 237, Rosa Bonheur 221, Vigee Le Brun 183, Anna Ancher 150, Schjerfbeck 96, Modersohn-Becker 85, Valadon 83, Anguissola 29, Hilma af Klint 19, Leyster 4, Artemisia 7 (most of her, and Morisot, Cassatt, Kahlo, were already in `data/corpus`). Countries: France 2,078, UK 1,720, Finland 473, Netherlands 465, Germany 386, US 368. Gabriele Munter (d. 1962) and other post-1955 women are not public domain, so were left out: 898 such women painters have imaged works; a licence check per file on Commons would be needed to add any.

## Rules and drops
- **Dates:** free text parsed ("15th century" -> 1400 span 100, "ca. 1550", "1625-1650"). Rows with no year, with years before 1000 (matches `lib.clean`) or whose only date is a period longer than 200 years ("Edo period") are dropped. That removed 313 Met, 254 Freer rows and most Chinese Commons items (9,266 China-group items have no inception date).
- **Met:** 3,436 public-domain painting-class objects in the four non-Western departments; the shared cache held 2,641, the other 795 were fetched at 1 request/s. Egyptian Art and Musical Instruments were left out. **Overlap:** 1,635 of these ids are already in `zz-museum-met-1.json` on the branch (an early unfiltered run left ~1,970 Asian Art rows in it). When merging, keep these rows from one file only.
- **Freer|Sackler:** 1,430 Painting records; 62 over the 8-leaf album cap, 83 Western (Whistler etc.), 21 twins.
- **Cleveland:** the 1,329 rows dropped by the earlier 8-per-group leaf cap stay dropped. Western illuminated manuscript leaves (Italy, France, Germany ~280) are out of scope.
- **AIC:** 794 of 921 candidates were already held.
- **Commons rows:** `license` is "PD" (creator died 1955 or earlier, or an anonymous work dated 1900 or earlier), `url` is the Wikidata item, `img` is `Special:FilePath/<file>?width=400`. Items held by Met, AIC, Cleveland, NGA, Rijks, SMK, Walters, SAAM, Freer, Yale or NMAfA (collection property) are skipped so the museum's own row is the only copy (1,415 + 1,690 + 1,091 items). Instance-of must be a painting type, not drawing/print/photo/sculpture.
- **Latin America and Oceania** were included because the brief lists them; Brazil, Argentina, Australia and New Zealand are mostly European-tradition painters (Visconti, Parreiras, Tom Roberts), so drop them if "non-Western" should mean cultural tradition. Aboriginal paintings: none found with a free image.

## Not available or not done
- **LACMA:** no machine-readable open feed exists (no GitHub repo, no API); only its Wikidata items with a Commons image could come through the Commons files.
- **Rijksmuseum:** its paintings set has no Asian holdings beyond the 10 rows already held (Indonesia 6, China 3, India 1), so nothing new.
- **Walters:** its Asian rows (China 49, Japan 46, Ethiopia 10) are already in `zz-museum-walters-1.json` on `staging/us-uk-cc0`.
- **Smithsonian NMAI** (Native American) was out of the requested scope; NMAfA had 15 paintings, none with a CC0 image.
- Hokusai and other ukiyo-e painters: print rows are not touched (`data/ukiyoe`); their paintings come via the Met, Freer and Cleveland rows and deduped by twin test.

## Doubts
- Freer artist names carry attribution qualifiers stripped; about half of Asian rows have no artist (anonymous or school).
- Some Wikidata titles of portrait items read "Name (1843-1911), artist, ...".
- Commons image URLs and Smithsonian `ids.si.edu` and Met `mobile-large` URLs were not downloaded or probed.
