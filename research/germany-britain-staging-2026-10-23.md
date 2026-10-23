# Germany / Britain staging (2026-10-23)

Script: `tools/stage/de_gb.py`. Output: `data/corpus-staging/zz-museum-{staedel,bsb,smb,wales}-*.json`, all rows measured (p/L/C present). Not merged into data/corpus or gallery.

## Counts (measured rows kept)
| src | Wikidata paintings with image | already in archive | staged | kept after measuring |
|---|---|---|---|---|
| staedel | 1,077 | 1,030 | 28 | 14 |
| bsb (Alte/Neue Pinakothek, Schack, PdM) | 9,674 | 999 | 8,169 | 2,384 PD/CC0 + 72 `bsbcc` |
| smb (Gemäldegalerie, Alte Nationalgalerie, Nationalgalerie, Berggruen) | 2,769 | 1,852 | 883 | 492 + 18 `smbcc` |
| wales | 725 | 140 | 545 | 532 |
Total 3,512 rows. Unmeasurable rows were pruned: 6,113 black-and-white scans (chroma below the gate; most of BSB's Commons uploads are old b/w photographs) plus a few failures.

## How, and what was blocked
- Städel OAI-PMH needs a registered account (creating one is not something a helper may do); Pinakothek, SMB and Museum Wales have no public API or the host refused (imagelibrary.museumwales.ac.uk and api.smb.museum did not answer). So each museum's collection was read from Wikidata (P195, CC0 metadata) with the Commons image (P18). No museum site was scraped.
- Image licence is read per file from Commons (LicenseShortName). Kept: PD, CC0, CC BY, CC BY-SA; anything else dropped (12 BSB files). PD gate: creator died <= 1955, or anonymous and dated <= 1800/1850. Twins (artist + title + year +-3) dropped against data/corpus, nga/saam/walters staging and each other. Non-Western set aside, as in the other staging lanes.
- Result: almost every Commons file of these museums is PD or CC0, not CC BY-SA. Only 95 rows carry an attribution licence (CC BY-SA 4.0 x24, BY-SA 3.0 x45, BY 4.0 x8, BY 3.0 x13, before pruning).

## Doubts
- The Städel's own images are CC BY-SA 4.0 per its 2020 release, but its Commons copies are mostly PD-Art, and 1,030 of its paintings are already in the archive; only 14 new measured rows.
- Wikidata attribution of "Netherlands/Russia" countries comes from the creator's citizenship, not the museum.
- BSB has 2,316 staged rows with no country (anonymous/unknown artist). 92 Wales rows likewise.
- Commons licence field is free text; unusual wording was dropped, not guessed.

## Credit line
tools/gallery.py SOURCES gained rows `staedel`, `bsb`, `smb`, `wales` (credit "public domain image (Wikimedia Commons) · CC0 data") and `bsbcc`, `smbcc`, `walescc`, `staedelcc` (credit "image CC BY or CC BY-SA, licence and author on its Commons file page (the museum link) · CC0 data"), appended after the `*2` loop so no gallery index moves. js/gallery.js is unchanged: the painting page already prints "<museum name> · <credit>" with the name linked to the row's `url`. For `*cc` rows the staged `url` is the Commons file page, which names the exact licence and author. The painting page therefore reads, for example: "Bavarian State Painting Collections · image CC BY or CC BY-SA, licence and author on its Commons file page (the museum link) · CC0 data". Per-row licence (e.g. "CC BY-SA 3.0") stays in the staged JSON `license` field only; the gallery format has no per-row licence column, so exact version is shown by the linked file page.
