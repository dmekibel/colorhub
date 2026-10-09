# Looks archive: sources and method

The Looks archive (Explore > Ideas > Looks, data in `data/looks.js`, code in `js/looks.js`) collects visual styles: art movements, design eras, film and photo looks, and internet aesthetics. David's rule: a look is more than one palette, so every look has 2 to 3 named palettes (Seapunk has 1).

## Counts
- **104 looks** (October 2026 update, +35): 13 art movements, 21 design eras, 8 film and photo looks, 62 internet aesthetics (the `cat` field).
- **200 named palettes** across all looks, 4 to 7 colors each, with proportions.
- No photographs yet: no look carries an `img` list (the page code supports one: Commons images, public domain or CC0 only, with credit and file page).

## October 2026 expansion: harvesting the Aesthetics Wiki
David's brief was "we are the Aesthetics Wiki on steroids" — go deeper into internet aesthetics. This pass used the live Fandom MediaWiki API (`aesthetics.fandom.com/api.php`, polite one-request-per-second, a descriptive User-Agent) to:
1. List every page in `Category:Aesthetics Wiki Articles` (1,184 titles) — used only to confirm a slug is real before writing an `aw` link, same as the original 69.
2. Fetch the infobox wikitext (`action=parse&prop=wikitext`) for ~50 well-documented internet aesthetics, extracting structured facts only — `decade_of_origin`, `key_colours`, `key_motifs`, `related_aesthetics`, `other_names` — never prose. Those facts grounded each new look's era, origin note and palette; every sentence of essence/origin/fuzzy text is original, written for this archive, same method as research/LOOKS.md's existing rule. Nothing from the wiki's prose or images was copied; no wiki images were used.
3. Of those ~50, 35 had enough real, distinct color identity to become full looks (2-3 palettes each, 1 for a few thin ones); about 15 were skipped as too vague for an honest single-color-identity entry (Rustic, Lolita's broader parent page, Maximalism/Minimalism as movements rather than looks, etc.) or already covered by an existing look.
4. Every new palette's colors are named by the same nearest-`data/library.json`-entry script as the original 69 (CIEDE2000, `tools/colormath.js`); max distance in this batch is 4.4 ΔE, in line with the existing median.

This is a first pass toward David's larger "aesthetics wiki on steroids" vision (deeper per-aesthetic pages with many measured palettes, an aesthetic map/influence graph, image-derived palette clustering from the wiki's own photos, shareable palette cards). Those are each substantial builds of their own and are intentionally **not** attempted in this pass — flagged as follow-up work, not silently dropped.

## What each look holds
id, name, a one-line essence, era, origin note (where the term comes from and when it spread, hedged), an honest "how fuzzy is it" note, light quality, materials, motifs, mood words, related looks (links between looks), palettes, an optional Aesthetics Wiki page slug (`aw`), and optional Commons images (`img`).

## Palettes
- Every palette was chosen by hand for this archive, from the look's typical references (paintings, buildings, film stills, mood boards), not sampled from any one copyrighted image.
- Each color is stored as `[hex, name, share, dE]`. The name is the nearest entry in `data/library.json` (CIEDE2000), skipping names flagged crude. Within 1.5 ΔE of the nearest, a name that reads well wins over xkcd jokes, codes and bracketed names. Median distance to the name is 2.1 ΔE; 90% are within 3.6; the largest is 6.5 (very dark navy-violets for synthwave).
- Shares are rough area proportions, used for the stripe widths, the hero and the match weighting.
- Hex values are screen approximations; the look page says so.

## Matching
- **Palette distance**: for each color of palette A, the CIEDE2000 distance to its nearest color in B, weighted by A's shares; then the same from B to A; the two averaged. A palette that covers only half a look scores badly even when every color it has is in the look.
- **Score** = 100 · exp(−d / 30), so d = 0 is 100, d = 10 is 72, d = 25 is 43.
- **`lookMatch(hexes, shares?)`** returns the top 3 looks, each scored by its best palette. Sanity tests: a look's own palette scores 100; a slightly shifted Dark Academia palette scores 89 with Baroque chiaroscuro and Sepia next; Mondrian primaries find De Stijl, then Bauhaus and Swiss Style; three pinks find Barbiecore.
- **"Where to see it"** ranks the app's public-domain paintings (`data/paintings.js`) against the look the same way and shows the closest six with their score. Films and poems are included automatically if `window.FILMS` or `window.POEMS` ever exist with palettes and graph nodes.
- **"Your closest looks"** (after Find your palette): each look palette is run through the taste engine's own dial features (`TASTE.palItem(...).z`: contrast, vividness, warmth, hue spread, count, proportions); the score is exp(−rms z-distance / 1.2) to the person's saved dials, best palette per look.

## Honesty
- Every description is original prose. The Aesthetics Wiki (aesthetics.fandom.com, CC BY-SA) was used only as a pointer to what exists; nothing was copied, and no images come from it. Looks with a page there get a "See also: Aesthetics Wiki" link; slugs were checked against the wiki's API (57 of 69 have one).
- Origins are hedged where sources disagree ("usually traced to", "reportedly"). Internet aesthetics get their earliest known use and when they spread, not a single inventor, unless one is well documented (Frutiger Aero: Sofi Xian, CARI, 2017; Gorpcore: Jason Chen, The Cut, 2017; Coastal grandmother: Lex Nicoleta, 2022; Millennial pink: Véronique Hyland, The Cut, 2016; Solarpunk: Republic of the Bees blog, 2008; Steampunk: K. W. Jeter, 1987).
- Myths from CLAUDE.md are avoided. Pointillism says outright that the dots don't mix into brighter colors. Victorian parlour mentions aniline dyes without the "first synthetic dye" claim. Expressionism gives Franz Marc's color meanings as his view, not as fact.
- The "how fuzzy is it" line on each look says when a term is retroactive, a critic's joke, a marketing label, or contested (for example the criticism of "clean girl" and of dark academia's elitism).

## Origin sources checked (October 2026)
- Frutiger Aero: en.wikipedia.org/wiki/Frutiger_Aero; en.wikipedia.org/wiki/Consumer_Aesthetics_Research_Institute
- Y2K and McBling (CARI, Evan Collins): cari.institute/history; cari.institute/aesthetics/y2k-aesthetic
- Vaporwave: en.wikipedia.org/wiki/Chuck_Person%27s_Eccojams_Vol._1; en.wikipedia.org/wiki/Floral_Shoppe
- Synthwave: en.wikipedia.org/wiki/Synthwave
- Seapunk: en.wikipedia.org/wiki/Seapunk
- Cottagecore: en.wikipedia.org/wiki/Cottagecore; knowyourmeme.com/memes/cottagecore
- Dark academia: britannica.com/topic/What-Is-Dark-Academia; tandfonline.com/doi/full/10.1080/0013838X.2023.2170596
- Light academia: en.wikipedia.org/wiki/Light_academia
- Goblincore: en.wikipedia.org/wiki/Goblincore
- Liminal space and the Backrooms: en.wikipedia.org/wiki/Liminal_space_(aesthetic); en.wikipedia.org/wiki/The_Backrooms
- Dreamcore, weirdcore: en.wikipedia.org/wiki/Dreamcore_(aesthetic); en.wikipedia.org/wiki/Weirdcore_aesthetic
- Kidcore: nssmag.com/en/fashion/28762/kidcore
- Whimsigoth: en.wikipedia.org/wiki/Whimsigoth
- Coastal grandmother: npr.org/2022/07/31/1114780678/best-of-meet-tiktoks-coastal-grandmother
- Gorpcore: en.wikipedia.org/wiki/Gorpcore
- Old money and quiet luxury: en.wikipedia.org/wiki/Quiet_luxury; thenationalnews.com (2022-05-22)
- Clean girl: en.wikipedia.org/wiki/Clean_girl_aesthetic; i-d.co/article/tiktok-clean-girl-aesthetic
- Barbiecore: rebag.com/thevault/trend-report-barbiecore
- Millennial pink: mentalfloss.com/culture/generations/millennial-pink-color-facts-history
- Corporate Memphis: en.wikipedia.org/wiki/Corporate_Memphis
- Solarpunk: en.wikipedia.org/wiki/Solarpunk
- Mid-century modern (Cara Greenberg, 1984): britannica.com/story/what-is-mid-century-modern-design; atomic-ranch.com
- Art Deco (1966 exhibition, Hillier 1968): en.wikipedia.org/wiki/Art_Deco; en.wikipedia.org/wiki/Bevis_Hillier
- Tonalism (Wanda Corn, 1972): oxfordreference.com, Tonalism; sullivangoss.com
- Bleach bypass (Kazuo Miyagawa, Her Brother, 1960): en.wikipedia.org/wiki/Bleach_bypass; en.wikipedia.org/wiki/Kazuo_Miyagawa
- Teal and orange, digital intermediate: gizmodo.com (O Brother, first all-digital grade); Todd Miro's 2010 blog post, as cited in coverage
- The rest (Impressionism 1874 and Leroy; the Fauves at the 1905 Salon d'Automne; the Pre-Raphaelite Brotherhood 1848; Siegfried Bing's shop 1895; the Vienna Secession 1897; De Stijl 1917; Bauhaus 1919 to 1933; the Smithsons' New Brutalism 1953; the Memphis Group 1980 to 1988; Jencks 1977; Bethke's "Cyberpunk"; Kodachrome 1935 to 2009; SX-70 1972; Technicolor three-strip 1932; Nino Frank 1946) are standard art-history facts, stated with the usual hedges.

## Images
None shipped. The look page renders an `img` array if a look gets one: `{src, w, h, alt, caption, credit, commons}`; use only public-domain or CC0 Commons files and keep the credit.

## Rebuilding
`data/looks.js` was generated from a hand-written source by a scratch script that names each color from the library and merges the image list; the generated file is the source of truth now. To add a look, add an entry by hand with the same fields and name its colors with the Studio's palette view (the same nearest-name rule).

## October 2026, "aesthetics wiki on steroids": the KB layer and measured palettes
David's brief: go deeper than a palette and a blurb for internet aesthetics — origin, lineage, garments, media, what a look reacts against, its revivals, and real measured color, the way the app already does for painters. This pass:

- **Counts after this pass:** 104 looks (unchanged), **296 named palettes** (was 200, +96), **32 knowledge-base files** at `data/aesthetics/kb/<id>.json`.
- **Scope:** the 26 internet aesthetics that previously had only one hand-picked palette (seapunk, emo, glitchcore, gothic-lolita, health-goth, hypebeast, indie-sleaze, mermaidcore, normcore, pastel-goth, princesscore, riot-grrrl, royalcore, scene, tenniscore, traumacore, vsco-girl, visual-kei, witch-house, witchcore, afrofuturism, cozy-gamer, cybergoth, nu-goth, atompunk, cluttercore), plus 6 flagship looks that already had hand-picked palettes but got the KB/article treatment (dark-academia, y2k, vaporwave, cottagecore, barbiecore, cyberpunk). The other ~72 looks are unchanged; extending the KB to them is the natural next pass.
- **KB fields** (`data/aesthetics/kb/<id>.json`): `lineage` (`influenced_by`/`influences`, as look ids where one exists in the archive or a plain name otherwise), `eras`, `places`, `garments`, `media` (titled further-viewing with a one-line note, cited only where a title is confidently real — never invented), `figures`, `reacts_against`, `revivals`, `article` (original prose, written fresh for ColorHub; longer ~400-550 word pieces for the flagship looks and seapunk/indie-sleaze/vsco-girl, shorter structured entries for the rest), `wiki_facts` (decade/colours/motifs read from the Aesthetics Wiki infobox, facts only, via `action=parse&prop=wikitext` — never its prose), and `measured` (see below). `sources` always credits "Aesthetics Wiki (CC BY-SA)" with the article URL.
- **Measured palettes (the 26 single-palette looks):** for each look, fetched its own Aesthetics Wiki page's image list (`action=query&prop=images`) and image URLs (`action=query&prop=imageinfo`), downloaded up to 6 of the largest to a temp dir, ran k-means (7 clusters, Lab space, own small numpy implementation — no sklearn available) on each, merged near-duplicate clusters across all of a look's images (ΔE2000 < 6/7), then **deleted every downloaded file**. Nothing from these images is stored, committed or displayed — only the derived hex clusters and their weights. Colors were named with a Python re-implementation of `js/naming.js`'s `nameOf()` (same CIEDE2000 math, same core-name list, same light/dark/dusty/vivid modifier grammar) against `data/core-names.json`, so a measured swatch reads exactly the way a hand-picked one does. From the merged clusters: an "Measured overall" palette (top 6 by weight), plus "Measured darks" / "Measured lights" / "Measured accents" when those subsets were large and distinct enough to say something an "overall" palette wouldn't (not every look got all four). Plain-English findings (e.g. "dark — about 42% of the measured color... is below mid-lightness") came from the same weighted Lab stats, always captioned with the image count and the screen-color caveat.
- **Politeness:** one descriptive User-Agent, ≥1.15s between every Aesthetics Wiki API/image request, MediaWiki API only (`action=query`/`parse`), no HTML scraping, nothing cached beyond the run.
- **What didn't get measured:** the 6 flagship looks kept their existing hand-picked palettes (already 2-3 each) rather than adding a 4th measured one, since the brief's time budget didn't stretch to measuring the other ~72 looks too; all 32 KB files carry the lineage/media/article layer regardless of whether they got a measured palette.
- **Page:** `js/looks.js` lazy-fetches `data/aesthetics/kb/<id>.json` once the look page is open (never blocks first paint, per the design canon's "calm surface, deep layers") and renders, one tap under the existing summary: a Findings section (measured looks only), a Lineage-and-reach section (influenced-by/influenced chips that open other look pages when the archive has them, eras, places, garments, reacts-against, revivals, further viewing), an In-depth article section, and a credit line. Also added: a Share button next to Open in Studio (reuses `js/sharecard.js`'s generic `palette` card layout — swatches, names, look name, ColorHub), and a deterministic "Palette of the day" pin at the top of the Looks section in Explore > Ideas (same palette for everyone on a given day, picked by hashing the date across every look's every palette).

## October 2026, part 2: the other 72 looks, plus widening past 150
Continuing the same pass: every one of the original 104 looks now has a KB file, and 46 new internet/fashion aesthetics were drafted to widen the archive, 38 of which made it in with a real measured palette.

- **Counts after this round:** **150 looks** (104 → 150, +46 drafted / +38 shipped), **676 named palettes** (296 → 676), **150 KB files** (one per look — full coverage).
- **The 72:** measured and KB'd in five committed batches (~15 looks each) — 13 art movements, 21 design eras, 30 internet aesthetics, 8 film/photo looks. Of these, 3 art movements (neo-impressionism, tonalism, vienna-secession) and several design/film looks (seventies-earth, eighties-neon, technicolor, kodachrome, polaroid, sepia, bleach-bypass) have no Aesthetics Wiki page at all, so they were measured from a **Wikimedia Commons search** instead (e.g. "Pointillism painting", "Technicolor film still") — same k-means-in-Lab method, same delete-after-measuring rule, per David's go-ahead to use Commons for art/design looks the wiki doesn't cover. A few looks (scandinavian, millennial-pink, teal-and-orange) turned up no usable images on either source and kept their original hand-picked palette with a KB file but no `measured` block.
- **Widening to 150+:** 56 well-documented Aesthetics Wiki aesthetics not yet in the archive were identified (confirmed to exist via `action=query&titles=` before writing anything — never invented), covering fashion/music subculture eras (punk, disco, hippie, mod, rockabilly, new wave, rave…), J-fashion (kawaii, gyaru, mori kei…), 2020s TikTok coinages (regencycore, mob wife, dollette, baddie…), and design/interior terms (maximalism, minimalism, shabby chic…). 46 were drafted as full look entries (essence, origin, fuzzy, light, materials, motifs, mood, `related`, `aw`) and run through the same measurement pipeline; 38 got a real measured palette (Aesthetics Wiki first, Commons fallback second) and shipped, 8 (avant-garde, dark-mori, rainbowcore, earthcore, sailorcore, hospitalcore, grandpacore, farmcore, lighthousecore — actually 9) had no usable images on either source and were left out rather than shipped without real color data. All `related` ids were checked to resolve (a handful of dangling refs from dropped looks were cleaned up after the fact).
- New looks' KB files are lighter than the original 104's: lineage reuses the hand-written `related` list, and `article`/`media`/`figures`/`reacts_against` were left for a future pass rather than hand-written at the same depth, to fit the batch — the base look object (which the page always shows) still carries real, specific origin/fuzzy prose for every one of them.
- Category counts after this round: 13 art, 21 design, 108 net (internet aesthetics — now including the widened fashion-era and J-fashion entries), 8 film.

## October 2026, part 3: deepening the 46, recovering the 12 that had no measured palette, rebuilding the graph
- **Counts after this round: 159 looks, 708 palettes, 159 KB files (full coverage).**
- **Recovered all 12 looks that had no measured palette** (the 3 existing ones from part 2 — scandinavian, millennial-pink, teal-and-orange — plus all 9 previously-dropped new-look candidates) using more specific Commons search queries (e.g. "hospital interior medical ward" instead of a generic "hospitalcore" guess). All 12 succeeded; the 9 dropped candidates (avant-garde, dark-mori, rainbowcore, earthcore, sailorcore, hospitalcore, grandpacore, farmcore, lighthousecore) were added back as new looks. 150 → 159 looks.
- **Gave the 46 roster-widening looks the same KB depth as the original 104**: real original-prose articles (~250-450 words each), `media`/`figures` with real titles/people only (nothing invented — several entries have no media listed rather than a fabricated one), `reacts_against`, `revivals`, and lineage that goes beyond the base look's `related` list — distinct `influenced_by`/`influences` pointing at real historical events, records, films and people, not just other look ids. Done in 3 batches of ~15.
- **Rebuilt `data/aesthetics/graph.json`** (`node tools/build_aesthetics_graph.js`) now that every look has real KB lineage: KB-derived influence edges went from a handful (only 32 looks had lineage before this session) to 212 resolved edges across 159 looks, 1080 nodes / 3058 edges total.
- The 9 newly-recovered looks (avant-garde, dark-mori, etc.) still have the lighter KB treatment (lineage from `related`, no article) that the other 46 started with — the natural next step if this lane continues.
