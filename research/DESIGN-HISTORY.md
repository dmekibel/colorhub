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

Final build: **10,577 design objects**, 619 of the app's colors appear in at least 5 of them. Sources: Cooper Hewitt 4,270; Art Institute of Chicago 1,938; Wikimedia Commons 1,837; Rijksmuseum 980; Cleveland 880; National Postal Museum 548; the Met 124 (thin, see section 1). By category: graphic and print 1,854, textiles 1,620, posters and ads 1,267, product design 1,187, ceramics 1,178, stamps 943, costume 930, wallpaper 766, glass 646, furniture 186. By decade: 1800s 463 ... 1890s 759, 1900s 1,144, 1910s 797, 1920s 535, 1930s 389, 1940s 385, 1950s 321, 1960s 285, 1970s 279. About 4,270 objects are flagged commercial (advertising, posters, packaging and covers, stamps, product design). Not reached: the Commons fetch was capped (about 2,200 of 2,800 selected images; the rest thin the 1930-1979 poster, cover and ad cells, which hold 100-180 each), and the Rijksmuseum fashion plates, ex libris and big ceramics sets were left out.

**The question: when do the vivid modern colors reach design?** "Vivid" = a palette color of CIELAB chroma 60 or more. Share of design area in vivid colors, category-balanced, with commercial design alone and the paintings of the corpus (n per decade is in `data/design/vivid.json`):

| Decade | Design (n) | Commercial only (n) | Paintings (n) |
|---|---|---|---|
| 1800s-1890s | 0.2-0.8% (460-800 each) | under 1% (75-260) | 0.05-1.4% (440-1,200) |
| 1900s | 0.6% (1,144) | 1.6% (477) | 0.3% (754) |
| 1920s | 1.2% (535) | 2.3% (402) | 0.4% (214) |
| 1940s | 2.5% (385) | 2.7% (349) | 0.5% (28, too few) |
| 1960s | 5.4% (285) | 6.0% (283) | none |
| 1970s | 8.5% (279) | 8.6% (272) | none |

- Vivid color is a **20th-century commercial story, and it builds slowly**: roughly flat under 1% until 1900, a first step in commercial print (posters, stamps, labels) in the 1900s, about 2% by the 1920s, then 5-9% of the area of 1960s-70s posters, covers and stamps. Objects with at least 10% of their area in vivid colors: 1% in the 1800s, 2.6% in the 1900s, 10.8% in the 1930s, 22.9% in the 1970s (n above).
- **Caveat that matters:** the late decades are posters, stamps, covers and ads (what is open), not plastics, packaging or neon (in copyright, so absent). So the curve shows commercial print, and it is probably a floor for the real world of products and signs. The 1930s-1970s cells are 280-390 objects each, small next to the 1800s-1900s.
- **Named vivid colors** (area of at least 5% in an object, n is the number of such objects): Magenta first appears 1826 and 1887 (3 objects, probably a dyed textile and a print) and then 1944; Lime only in 1967 (n=1); Vermilion from 1900 (n=32, median 1952); Orange 1845 then mostly from the 1920s (n=12, median 1954); Turquoise 1954 (n=2); Cerise 1966 (n=1). Electric Blue, Hot Pink and Chartreuse are not in any object. These are single-digit counts: say "first seen in our archive", never "first used".
- **286 of the 1,000 named colors never reach 1% of any of the 23,306 dated paintings; 64 of them reach 5% of at least 3 design objects**, nearly all earlier tints and dyes of textiles and prints (Royal plum, Indigo, Merlot, Baby pink), not neon. The modern neon colors are the ones missing from both.
- Commercial design is over-represented in light warm greys and silvers (Greige 2.7x, Warm silver 2.7x, Biscuit 2.3x versus other design), which is paper, tin and card, not vividness. Posters and advertisements are the most saturated kind of object (mean chroma 20.4, n=1,267); glass the most muted (10.9, n=646).
- Paper tone is left out of poster and graphic shares (section 3); stamps keep theirs, so "platinum" (a pale grey) tops 1930-69 stamps (4.8%, n=236).
- Arts and Crafts (5 makers, n=38), Art Nouveau (13 makers, n=82) have palettes in `superlatives.json`; Bauhaus and Art Deco have n=1 each (in copyright), so there is no "most Bauhaus color" and the app must not claim one.
- Flags (Wikidata, 197 national flags): the most common colors by nearest name are White (132 flags), Smoky Black (43), Lava (41), Gold (34), Lipstick Red (22). 1,303 notable parties with their own hex and 59 organizations with a named shade are in `graph-facts.json`.
