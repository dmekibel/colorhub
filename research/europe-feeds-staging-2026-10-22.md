# Europe and Latin America painting staging, 2026-10-22

Staged in `data/corpus-staging/zz-museum-<source>-1.json` (nothing in `data/corpus`, `data/gallery` or `index.html` was touched, no image downloaded). 33,089 new rows. Every row: `license` "PD", `url` to the record (Wikidata item, or the Nationalmuseum record), no duplicate id, no artist+title+year twin of `data/corpus` or of another staged file. Tools: `tools/stage/<source>.py`; shared Wikidata engine `tools/stage/wd.py`; `run_europe.sh` / `run_europe_rest.sh` ran them in order.

## Method
- **Wikidata collection query** (all sources except Nationalmuseum API): items with collection (P195) = the museum, instance of painting (or a subclass), and a Commons image (P18). Rows get id `commons-<QID>`, src `commons`, img `Special:FilePath/<file>?width=400` (a link, not downloaded). Wikidata metadata is CC0; the licence of the work is gated by us.
- **Public-domain gate:** the creator died in or before 1955; or no creator is recorded and the work is dated 1800 or earlier; or a creator is named with no death date and the work is dated 1850 or earlier. Everything else is dropped.
- **Real paintings only:** painting class, and titles naming a drawing, print, photograph, sculpture, object are dropped. Rows need a named artist or a date. Asian/Islamic/African works are set aside as in lib.py.
- **Politeness:** UA `Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)`, one request at a time, 2 s apart (Wikidata Query Service; no Commons API call was needed, so maxlag was not used). The Nationalmuseum crawl ran at 1 request per second.
- **Nationalmuseum (Sweden), official API** `api.nationalmuseum.se` (no key; no server-side filter, so all 2,084 pages were read): category "Målningar", image licence stated as "Public Domain", IIIF image. Attributions with a qualifier (school of, after, circle of) keep the row but not the artist name.
- **Cleanup:** the Wikidata query cache and the API crawl cache were deleted from scratch when done.

## Counts by source (new staged / source total / already held)
| Source script | New | Source total | Already held |
|---|---|---|---|
| prado (Museo del Prado) | 98 | 3,981 | 3,857 |
| thyssen (Thyssen + Carmen Thyssen) | 158 | 772 | 602 |
| spain_other (MNAC, Cordoba, Valencia, Sevilla, Bilbao, Lazaro Galdiano, Reina Sofia, ...) | 1,980 | 2,866 | 696 |
| mnaa (Museu Nacional de Arte Antiga) | 394 | 444 | 43 |
| portugal_other (Chiado, Gulbenkian, Soares dos Reis, Malhoa, ...) | 682 | 774 | 60 |
| nationalmuseum (official API) | 2,937 | 10,559 painting records | 0 |
| nationalmuseum_wd (Wikidata cross-check) | 964 | 7,005 | 4,407 |
| sweden_other (Portrait Gallery, Gothenburg, Hallwyl, Thiel, ...) | 792 | 2,656 | 793 |
| nasjonalmuseet (Norway) | 2,405 | 2,634 | 121 |
| norway_other (Munch, Oslo, KODE, Trondheim, Lillehammer, ...) | 1,597 | 2,382 | 400 |
| fng (Finnish National Gallery / Ateneum) | 2,424 | 2,708 | 110 |
| finland_other (Serlachius, Turku, Gallen-Kallela, ...) | 308 | 337 | 6 |
| mnw (National Museum Warsaw) | 4,867 | 6,669 | 1,338 |
| mnk (National Museum Krakow) | 1,210 | 1,875 | 550 |
| poland_other (Wilanow, Royal Castle, Poznan, Wroclaw, Wawel, ...) | 1,250 | 1,681 | 245 |
| czechia (National Gallery Prague, Moravian Gallery, ...) | 142 | 1,262 | 1,086 |
| hungary (Fine Arts Budapest, National Gallery, ...) | 1,132 | 1,377 | 155 |
| khm (Kunsthistorisches Museum) | 1,997 | 3,229 | 1,146 |
| belvedere | 7 | 2,732 | 2,719 |
| austria_other (Liechtenstein, Leopold, Academy, Salzburg, ...) | 455 | 739 | 243 |
| kunsthaus_zurich | 781 | 1,102 | 276 |
| switzerland_other (Basel, Bern, Geneva, Buhrle, Winterthur, ...) | 775 | 1,430 | 573 |
| baltics (Latvia, Estonia, Lithuania) | 1,280 | 2,388 | 927 |
| greece | 201 | 257 | 28 |
| ireland (National Gallery of Ireland, Hugh Lane) | 1,522 | 1,902 | 202 |
| latinamerica (Argentina, Brazil, Chile, Colombia, Mexico, Peru, Uruguay, Venezuela, Cuba) | 2,731 | 4,076 | 431 |

By country (new rows): Poland 7,327; Sweden 4,693; Norway 4,002; Finland 2,732; Latin America 2,731; Austria 2,459; Spain 2,236; Switzerland 1,556; Ireland 1,522; Hungary 1,132; Portugal 1,076; Baltics 1,280; Greece 201; Czechia 142.

## Blocked, skipped or weak
- **Finna API (Finnish National Gallery / Finnish museums):** `api.finna.fi` returns a Cloudflare "Just a moment" challenge (403); not bypassed. Finland came from Wikidata instead. `api.kansallisgalleria.fi` did not resolve.
- **DigitaltMuseum API (Norway):** the API host serves only its documentation page without an API key; Norway came from Wikidata (Nasjonalmuseet and others).
- **Europeana:** 403 without a key; not used.
- **Polona (Poland):** the site is reachable but has no open painting dump; Polish rows come from the Wikidata collections of the National Museums and others.
- **Prado, Belvedere, Czech National Gallery:** already almost fully in `data/corpus` (the old Commons pulls); very few new rows.
- **Not clearly public domain:** about 2,000 rows were dropped across sources because the creator died after 1955 (for example 1,135 at Nationalmuseum via Wikidata, 585 in Latin America). Nationalmuseum's API dropped 5,389 paintings whose image is not marked Public Domain.
- **Doubts:** Wikidata `P18` image files are Commons files; their own licence tags were not checked. Country `co` comes from the creator's citizenship and is empty for 10-20% of rows. Latin American historical collections (Museu Paulista, Museu Historico Nacional) include many historical-scene paintings by lesser-known artists. `src` is `commons` for Wikidata rows and `nm` for the Nationalmuseum API rows (the app may need a `nm` entry). Lithuania, Latvia, Greece and Czechia have few records on Wikidata; Hungary, Czechia and Slovakia-era collections beyond those listed were not queried.
