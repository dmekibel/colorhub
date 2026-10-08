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
