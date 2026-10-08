# Design history by color: feasibility, sources and method

Built 2026-10-08 for ColorHub lane L19. David: "We can take it a step further and analyze design history somehow... having resources of paintings is easier than resources of design." Then: "Can we build up an archive of commercial design work as well?" (where do the vivid modern colors live?).

**Short answer: yes, for roughly 1800-1930, thinly after.** Open museums and archives give a solid, license-clean design corpus up to about 1930 (Cooper Hewitt alone has about 15,000 dated, CC0, imaged design objects from 1800-1929). After 1930 almost everything in copyright is, correctly, not open: the 1930-1979 cells rest on posters, stamps, covers and ads from Wikimedia Commons, the Rijksmuseum, the National Postal Museum and the Art Institute of Chicago, and they are small. The counts per cell are in `data/design/index.json` and printed in section 4; every claim in the app must carry its n.

Everything here is **as photographed or scanned** (studio light, yellowed paper, faded dyes), and a palette is a 6-color k-means of a 200 px image, so shares are area shares, not exact pixel statistics.

## 1. Sources, ranked (volume x license clarity x metadata)

"Keyless" means no sign-up of any kind: no api.data.gov key, no token. Nothing was signed up for.

| Rank | Source | Route used | What it gives | License | Metadata (date / category / maker) | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Cooper Hewitt, Smithsonian Design Museum** (via Smithsonian Open Access) | Public bulk dump on S3: `smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/chndm/00.txt..ff.txt` (256 files, 240 MB, line-delimited JSON). Images from `ids.si.edu/ids/deliveryService?id=<idsId>&max=300` (resized on request). | ~60,000 records, ~40,000 with images; four design departments (Drawings, Prints and Graphic Design; Textiles; Wallcoverings; Product Design and Decorative Arts). About 15,000 dated 1800-1979 with a design category. | CC0 for metadata and media (each record carries `usage.access: CC0`) | Date text, object type (controlled vocabulary), designer / manufacturer / maker with role, place, credit line | **Built** (`tools/museums/chndm.py`). Deep before 1920, thin after (in-copyright). |
| 2 | **Wikimedia Commons** (posters, stamps, magazine and book covers, advertisements, by year) | MediaWiki API: year categories `NNNN posters`, `NNNN stamps`, `NNNN magazine covers` ... and their country subcategories; `generator=categorymembers&prop=imageinfo` returns 50 files with license text per call | The only open source with real volume for 1930-1979 posters, stamps, covers | Per file: only PD (PD-old, PD-US, PD-US-not-renewed, PDM) and CC0 are kept; CC BY / CC BY-SA are dropped | Year (from the category), designer in the Artist field when short | **Built** (`commonsd.py`). Slow API (about 5-20 s a call). |
| 3 | **Rijksmuseum** design sets | OAI-PMH, keyless, EDM: sets 261131 affiches (7,828 posters), 261157 glas, 261228 textiel, 261195 sierpapier, 261142 tegels, 261233 porselein, 261119 kunstnijverheid. About 500 pages at 50 records. | Dutch posters 1890-1960 (Art Nouveau, De Stijl era), glass, textiles, tiles, decorated paper | Only records marked Public Domain Mark or CC0 are used (about 30% of affiches) | Date, creator, place | **Built** (`rijksd.py`). The old `data.rijksmuseum.nl` key rules do not apply to OAI-PMH. |
| 4 | **Art Institute of Chicago** | `api.artic.edu` search, keyless; images by IIIF with an `AIC-User-Agent` header (a 403 without it) | Textiles (6,900 PD with image in the whole museum), Applied Arts of Europe (4,990), Architecture and Design (276), posters, valentines | CC0 metadata, public-domain images (`is_public_domain`) | Date range, artist, place, classification | **Built** (`aicd.py`): 3,572 dated 1800-1979 with a design category. 1 request a second as the docs ask. |
| 5 | **Smithsonian National Postal Museum** (same bucket, `edan/npm`) | Bulk dump, 46 MB | 1,818 stamps with CC0 images, 1800-1979 | CC0 | Date, place | **Built** (`npmd.py`). Few stamps after 1940 have images. |
| 6 | **Cleveland Museum of Art** | `openaccess-api.clevelandart.org`, keyless | Textiles, ceramics, glass, metalwork, jewelry; 1,240 dated 1800-1979 | CC0 | Dates, creators, culture | **Built** (`cmad.py`). Mostly pre-1900 or non-Western. |
| 7 | **The Met Open Access** | Open Access CSV (CC0) for ids and classification; collection API for images | CSV: 75,900 public-domain objects dated 1800-1979 (Costume Institute 6,500, European Sculpture and Decorative Arts textiles 2,900, ephemera 7,500, American Wing 8,000) | CC0 | Classification, dates, maker | **Built, thin** (`metd.py`): the Imperva shield refuses this client after a few hundred requests (HTTP 403, 15-minute cooldown, see STATS-FINDINGS.md), so it is run slowly and only for a seeded sample of 1900-1979 objects. Only a few hundred came in. |
| 8 | **Smithsonian Libraries** trade literature, **NMAH** | Same bucket: `sil` (1.9 GB), `nmah` (2.5 GB) | Sheet-music covers, trade catalogs, advertisements, product design | CC0 where an image exists | Dates, types | **Rejected for now.** Probed one shard each: only 1-2% of records have CC0 images and almost all are book scans or non-design objects. A full pass is a 4 GB download for a few hundred usable objects. A later job could stream-filter them. |
| 9 | **Cooper Hewitt's GitHub repo** (`cooperhewitt/collection`) | n/a | A 1.1 GB mirror of the same records | none stated | Same | **Superseded.** Last pushed 2018 and no license file; the Smithsonian bucket is current and states CC0. |
| 10 | **Smithsonian `api.si.edu`** | Needs a free api.data.gov key | Same records as the bucket | CC0 | Same | **Not used** (key). The bulk bucket gives the same data keyless. |
| 11 | **Library of Congress** (WPA posters, ads, Prints and Photographs) | `loc.gov/collections/...?fo=json` | ~900 WPA posters and large ad holdings, public domain | PD | Good | **Blocked.** Requests from a script get a Cloudflare "Just a moment" challenge page. Getting past it would be bypassing bot detection, which we do not do. Worth a manual or sanctioned bulk route later. |
| 12 | **Boston Public Library, NYPL** public-domain ads and posters | Digital Commonwealth API; NYPL Digital Collections API (needs a token) | Large public-domain ad and ephemera holdings | PD | Good | **Not built** (NYPL needs a token; BPL not probed in time). Best next sources for 1900-1930 commercial work. |
| 13 | **Wikidata** P465 / P6364 / P462 | SPARQL, keyless | Colors of flags, parties and organizations as facts | CC0 | n/a | **Built** as graph facts (section 5). The generic colors carry pure screen values (blue 0000FF), so only named shades and party hexes are used as hex. |

## 2. How the corpus is built (same pipeline as the painting corpus)

`tools/design_corpus.py` imports `tools/corpus.py` (network, pacing, k-means, color math) and adds one adapter per source in `tools/museums/` (`chndm`, `rijksd`, `aicd`, `cmad`, `commonsd`, `npmd`, `metd`). Steps, all resumable and cached in the gitignored `research/_raw/`: `meta` (metadata), `select`, `images` (a 200 px copy per object; **no image is committed**), `palettes`, `build`.

- **Categories** (10): posters and advertisements, graphic design and print, textiles, wallpaper, ceramics and tiles, glass, furniture and lighting, product and industrial design, costume and jewelry, stamps. Each adapter maps its museum's own classification to these (the rules are in the adapter).
- **Decade** is the object's date, midpoint of a range of 25 years or less; "19th century", "1900s" (which can mean the century) and wider ranges are left out rather than guessed. This matters: Cooper Hewitt dates "19th century" for thousands of objects, and treating that as 1850 invented a fake spike.
- **Commercial** flag (`cm`): advertising, posters, packaging and labels, covers, trade literature, stamps, and product and industrial design, by a rule on category, type and title (`commercial()` in design_corpus.py). A rule, not a judgment.
- **Selection** balances categories and decades: per source at most 60 objects per category x decade cell, per cell at most 140, per maker at most 20 per category, in a fixed hash order (so a source's picks never depend on the others'). Trimming drops from whichever source has most in the cell.
- **Palette**: auto-trim of frames and scanner bed, 2% inset, area average to ~120 px, CIELAB k-means k=6 with a*/b* x1.5, share = pixel area. For objects photographed on a studio backdrop (ceramics, glass, furniture, product, costume) the backdrop is flood-filled out from the edge first. This works for most but not all studio sweeps: a few clear-glass pieces keep some grey, so neutral shares for glass and product are slightly high.
- **Naming**: each palette color is named by the nearest of the app's 1,000 core names by CIEDE2000 (`data/core-names.json`); the distance is not stored per color (median and 90th percentile are printed at build).
- **Rights**: every object's image is shown only through its source's own URL, and every source used is CC0 or public domain (`index.json` -> `sources[...].rights`). Objects under copyright are not in the corpus at all; if a later source adds them, they carry palette numbers and a link only, no image.

## 3. Analysis (`tools/analyze_design.py`)

Outputs in `data/design/`: `index.json`, `colors-index.json` and `colors-<k>.json` (per color: design share, painting share and lift, peak decade, decade curve for design and paintings, top categories, top designers, six example objects), `cells.json` (category x decade palettes and signatures), `makers.json`, `vivid.json`, `superlatives.json`.

**Weighting.** Museums hold very uneven amounts of each kind of object, so the headline share of a color is **category-balanced**: the mean of per-category mean shares over categories with at least 60 objects. The raw object-weighted share is stored next to it. The painting comparison uses the public-domain painting corpus (23,531 paintings), which thins out after 1900, so any "design before painting" claim carries that caveat.

## 4. What came out

See the end of this file (section 6), written from the final build with n on every line.

## 5. Flags, parties and organizations as facts (`tools/design_facts.py` -> `data/design/graph-facts.json`)

Source: **Wikidata** (CC0), plus the Wikimedia Commons flag files for rendering. For the Color Graph's "appears in" edges.
- **Flags**: Wikidata sovereign states with a flag image (P41) and no end date (about 197). Each flag file is read through Commons' own PNG rendering and its exact fill colors are counted (merged within dE2000 3, kept at 1.5% of the flag). They are the colors **as drawn on Commons**, not the legal specification; no image is stored. Each color is named by the nearest core name with its distance, so "Lapis appears in N national flags" counts only matches within dE 10.
- **Parties**: political parties (Q7278) with their own sRGB hex (P465) and at least 12 language editions. A fact about the party, entered by Wikidata editors.
- **Organizations**: bodies whose official color (P6364) is a named shade with its own hex (UN blue 009EDB, Pantone Reflex Blue for the EU). Generic colors (red, blue, white...) are skipped because Wikidata gives them the pure screen hex.
- **Trademarks are facts only**: a name, a color word and a hex. No logos, no images.

## 6. Findings

(Filled from the final build.)
