# The color page: every way to make it better (2026-10-08)

Read-only review. I rendered `main` (f369a366) headless through `tools/_qa/frame.html` at 440x956 and 375x812, and dumped each page's layout (section, y position, height, text). Pages checked: Red (basic), Teal (mid), Light Rosolane Purple (a niche Ridgway library name), `teal?c=2a7f86` (a tapped in-between color), Prussian Blue (dark, has an article) and Alabaster (very light). Another lane is building side-by-side harmonies and pairs, switchable palettes, and the pannable Walk neighborhood, so this review leaves those alone and builds on them.

**Diagnosis in one line:** the cover and the flower are lovely, but under them sit three page designs stacked on top of each other. Some facts are wrong or vague, and the articles now arriving will bury everything else.

What I measured:
- **Prussian Blue is 14,447 px tall.** Its article renders inline at 11,255 px, so Field notes start at 12,508 px. About 900 articles are landing now (`red.json` and `teal.json` are already in the working tree), so this will happen to every major color.
- **Red is 4,966 px tall.** It shows Madder's story ("Its story lives with Madder") above its own History, which sits in a 9-row accordion after the flower. Then comes a 1,454 px "Connections" dump. Neighbors appear four times: the flower, Kin, Nearest names, and Connections > Looks.
- **The cover facts:**
  - Prussian Blue's definition is "Dark blue." The article's first sentence directly below is far better.
  - Light Rosolane Purple's definition is "Deep purplish pink", which contradicts *Light*. Its tier line says "A described shade" while its footer says "A naturalist's name".
  - Teal's definition source reads "ColorHub".
  - Prussian Blue still shows paint-chart junk ("Also called Atlantis, Bagdad, Comet…") above the article.
- **The glance strip:**
  - Red's first card is "95%" with no noun.
  - Teal (named for a duck), Alabaster (a stone) and Prussian Blue all lead with "first seen 400–700 years before the name… not proof of the pigment".
- **The drawer headlines:**
  - "Poets and writers use it." appears on every page.
  - "Its twins: 1900s, 1940s, 1960s" (fashion decades read as twins) on Prussian Blue and Light Rosolane Purple.
  - "mad max: fury road" is lowercased.
- **The tapped color:** its comparison strip says only "greener".
- **Missing pieces:** there is no sticky color header (no sticky rule for the page in the CSS). Two back buttons (`.cp-close` and `.cp-close.tl-exit`) render at the same spot. The flower's labels are ~10 px mono text.

---

## Section by section

**Cover**
- **Goal:** the color itself, its name, what it is, and a reason to scroll.
- **Verdict:** hits on beauty; almost on truth.
- **Skeptic:** "Dark blue." and "ColorHub" read as filler on a page claiming depth. The top 60% of the screen is a flat field you can't do anything with.
- **Fix:**
  - Use this definition order: the article's `def`, then an authored lead, then ISCC-NBS (only when it doesn't contradict the name's own modifier), then a differential definition.
  - Never print "ColorHub" as a source.
  - Use one tier vocabulary everywhere.
  - Make the flat field useful (the Look control, #5 in the top 10).
- **Ideal:** a full-bleed color you can look *at* (on different grounds, through different eyes) whose few words are all true.
- **Connections:** Train's contrast lessons, the article, Learner Model status.

**Glance strip**
- **Goal:** three surprising, true numbers.
- **Verdict:** almost.
- **Skeptic:** the cards are caveats dressed as hooks, and a figure without a noun ("95%") reads as a bug.
- **Fix:**
  - Every figure carries its noun ("95% of matches are accents").
  - Artifact cards ("first seen before the name") never lead, and never appear on non-pigment names.
  - When there's an article, its sourced `glance[]` goes first.
  - Drop the lowercase mono labels and use the witness word in serif italic.
- **Ideal:** three facts you'd repeat to a friend, each one a door.
- **Connections:** paintings-of, articles, Versus.

**Primary row (Learn it, heart, share)**
- **Goal:** one obvious next step.
- **Verdict:** hits.
- **Skeptic:** on a page whose story is the best part, Learn it outranks Read.
- **Fix:** keep the rule from COLOR-PAGE-DESIGN §2.4, but when the name is already Yours the primary becomes "Begin reading".
- **Connections:** prQuick, the Journey.

**Teal's legacy strip and figure (Teal / Turquoise / Viridian plus the duck photo)**
- **Goal:** what it's confused with, and where the name comes from.
- **Verdict:** almost. It's useful, but it's a fourth neighbor list, and it reads "greener" alone on a tapped color.
- **Fix:**
  - Fold the confusion pair into "You and this color" (the duel) and into the flower.
  - The figure moves into the story door as its cover image.
  - The tapped strip becomes the split cover (#7).

**Story (article door / twin block)**
- **Goal:** the color's history, reachable and finishable.
- **Verdict:** misses at scale. The article renders inline (11,000 px), and Red borrows Madder's story while hiding its own.
- **Skeptic:** nobody scrolls 11,000 px to reach the paintings. Once 900 articles land, every big color becomes a wall of text.
- **Fix:**
  - Build the door from COLOR-PAGE-DESIGN §2.5: dek, chapter rows, minutes, resume.
  - A color's own article, or the 101's wiki facets as a short story, always beats a twin.
  - The twin block appears only when the color has no story of its own.
- **Ideal:** a book with a cover, opened on purpose, that remembers your page.
- **Connections:** reading roads, Check yourself, Journey story steps.

**You and this color**
- **Goal:** your history with this color, and a nudge.
- **Verdict:** almost. It's there, but low on the page and absent for strangers.
- **Fix:** one relation line on the cover ("Learning · you called it turquoise twice · review Fri") and the card only when there's more to show.
- **Connections:** the Learner Model, Train, camera found-events.

**Field notes (five drawers)**
- **Goal:** depth one tap away, each drawer headed by its best finding.
- **Verdict:** almost. The structure is right; the headlines are generic or wrong.
- **Skeptic:** "Poets and writers use it" teaches you to stop opening drawers.
- **Fix:**
  - **Headlines:** the paintings headline uses the role or the reach figure instead of a bare "Peaks in the 1400s". The words headline quotes the best line (≤15 words, attributed). The world headline lists only real twins (gems, flowers, films in title case) and leaves out fashion decades.
  - **New drawer:** add a sixth, "In design" (already specced in pages-museum-studio F6).
  - **Codes:** "Names and codes" becomes the last drawer, replacing the old Also called, Codes, passport and tier footer.
- **Connections:** paintings-of, Studio, poems, the design corpus, the camera.

**Walk from here (other lane)**
- **Goal:** walk color space by name.
- **Verdict:** hits as an idea.
- **Fix, to hand to that lane:**
  - Nothing smaller than 13 px in a hex.
  - Swallow "Nearest names" into the neighborhood, so neighbors appear exactly once.
  - Add a lighter↔darker ladder (idea 14) as one axis of the neighborhood, not a separate widget.

**Old accordion and Connections**
- **Goal:** none left that another section doesn't serve better.
- **Verdict:** misses.
- **Fix:** cut. History, Symbolism and the other facets become the 101's story; Kin goes into Family; Harmony goes to the other lane's harmony section; Ideas and Stories become a "Read next" row of three under the story door.

---

## Ideas (46)

**Cover and looking**
1. A Look control on the cover (one opaque button). It cycles the surround: white, black, mid grey, its complement. One line explains it, e.g. "Same hex. On black it looks lighter."
2. The same control's second row is Eyes: typical, protan, deutan, tritan, rendering the whole cover in that view, plus "Confused with: olive (deutan)".
3. Daylight vs. lamplight preview using a chromatic-adaptation approximation, labeled approximate.
4. The tapped color gets a split cover, your color | the name, with one difference sentence ("Yours is greener and a bit lighter").
5. A sticky 104 px color header with the name; tap it to return to the cover.
6. Section jump chips in the sticky header: Story · Paintings · Neighbors · Codes.
7. Pronunciation and etymology in one tier-line phrase ("from Middle English *tele*, the duck").
8. The definition comes from the article's first sentence when one exists.
9. Long-press the hex for every format (HEX, RGB, OKLCH, CSS var).
10. A dark-color hairline and light-color ink checks (spec §6); verify Alabaster's chrome.

**Seeing it in the world**
11. Find it: a live camera veil that glows where this color is, guess-first ("name it before the camera does"), built on namer's `isoSample`.
12. Find it in your photos: scan the camera roll (on device) and show the three best matches.
13. In use: three tiny honest previews: a painted wall, a woven fabric, and text set on it and in it (with an AA badge).
14. A lighter↔darker ladder whose stops snap to real names (one axis of the other lane's neighborhood).
15. Paint recipe: two or three tube pigments and ratios (`rcMixHTML`), with *Mix it* opening the Studio mixer seeded with them.
16. Print and screen: nearest RAL/Pantone/NCS-style standard as "screen approximation", plus CMYK behind "for print, rough".
17. A type-a-word contrast tester: your word on it, and it on paper and on black.
18. On the map: a mini honeycomb thumbnail with this bubble lit; tap pans the map there.

**Learning**
19. A one-line relationship on the cover: New / Learning / Yours / mixed up with X.
20. A Name it quiz when you arrive from the map: an opt-in veil over the name, three same-family options, recall before reveal.
21. Duel your mix-up: 5 trials against the neighbor you confuse it with (exists in the article; surface it).
22. Test your eye: "Can you tell teal from 2% bluer?", a single-hue sensitivity check feeding Train's eye profile.
23. A find-it task of the week from real twins ("in an old carpet's reds").
24. "Review it Fri" shown honestly when the color is due.
25. Check yourself at the end of the story (spec §3.6).

**Story and data**
26. The story door with chapters, minutes and resume.
27. For the 101 with no article, their wiki facets become a 4-chapter story instead of borrowing a twin's.
28. Its finest painting: the canvas where it matters most (share × prominence), with the veil showing where.
29. A timeline row: the name's first record, the pigment's invention, its peak in paintings, the standards that list it, and the crowd survey, all on one dated line.
30. Its painter: the artist who used it most beyond chance (n ≥ 10).
31. A myth trap card where `myths.json` has one.
32. Peers: "darker than most blues, more vivid than most teals" (within family, not all names).
33. In design: its peak decade, top object type, three objects.
34. In flags: "in 12 national flags" (facts only).
35. Read next: the three most related stories or ideas (replacing the 40-chip Connections).
36. Look-alikes that live here (the reverse of the twin block).

**Craft and UX**
37. One order for all 2,700 names (`colorDossier`).
38. Cut the 9-row accordion and Connections.
39. One "Names and codes" drawer: historical names, a collapsed "paint-chart names (10)", stamps, codes.
40. A share card: a generated image of the color full-bleed with the name and one fact.
41. Save as wallpaper: phone-sized, the color with the name small at the foot.
42. The trail (long-press ‹) and the walk thread on the map (spec §4).
43. Skeletons that reserve height, so nothing jumps when drawers fill.
44. One back button (remove the duplicate `.tl-exit`).
45. A one-line glossary for "ΔE" and "% different", tappable once.
46. A per-page honest footer: "Built from 23 sourced facts and 9 measurements."

---

## The ideal order

1. **Cover**, with the relation line and the Look control.
2. **Sticky header and jump chips.**
3. **Glance** (3 cards).
4. **Primary** (Learn it or Begin reading).
5. **The story:** the door; or the 101's own short story; or, failing both, the twin card.
6. **You and this color** (only when it has something).
7. **Field notes:** In paintings, Its company, In words, In the world, In design, Measured, Names and codes.
8. **Walk** (the other lane's neighborhood, absorbing Nearest names and Family chips).
9. **Read next** (3).
10. **Last line.**

**Cut:**
- the 9-row accordion
- Connections
- Teal's legacy strip
- the standalone Nearest names, Passport and Codes blocks
- "Also called" junk above the article
- the duplicate back button
- "Poets and writers use it"

---

## Top 10, ranked by impact over effort

**1. The story door and story-first (S–M).**
- **Spec:**
  - `articleRender` draws a card instead of the full text: a figure, the title with its italic turn, the dek, "8 min · 6 chapters", the first three chapters as rows, and Begin reading, opening `#/read/<slug>` (spec §3).
  - Under 600 words, the text stays inline.
  - The 101 without an article get their facets as chapters.
  - `rpTwinHTML` is skipped whenever the page has its own story.
  - Red stops showing Madder.
- **Success test:** on David's phone, Prussian Blue's Field notes are reached within 3 swipes of the door, and the page is under 5,000 px. Red's first story card is Red's own.

**2. One page, one order, the cuts (M).**
- **Spec:**
  - Finish `colorDossier` (COLOR-PAGE-DESIGN §1): `colorPage` and `namePage` render the same order.
  - Delete the accordion and `connSection` from the color page.
  - Their content moves: Kin to Family, Also called and Codes to the "Names and codes" drawer, Ideas and Stories to Read next (3).
- **Success test:** Red, Teal and a library name have identical section sequences, and neighbors are listed exactly once. Red drops from 4,966 px to about 3,200 px.

**3. The truth pass on the words (S).**
- **Spec:**
  - The definition order is article `def`, then lead, then a non-contradicting ISCC-NBS descriptor, then a differential definition.
  - Never print "ColorHub" as a source.
  - Use one tier vocabulary (the cover and the footer must agree).
  - Every glance figure gets a noun.
  - Artifact cards are capped below sourced cards and only allowed for pigment or dye tiers.
  - World headline: real twins in title case, never decades.
  - Words headline: the best attributed line or nothing.
  - "Also called" filters out paint-chart names.
- **Success test:** read the six covers aloud: no false, empty or contradictory sentence.

**4. The sticky color header and jump chips (S).**
- **Spec:**
  - A 56 px opaque bar in the color with the name in serif (ink-adaptive), then a chip row (Story · Paintings · Neighbors · Codes) for sections that exist.
  - A hairline when the color is close to the ground.
- **Success test:** on Prussian Blue and Alabaster, mid-page, you can always see which color you're on and reach Codes in one tap.

**5. The Look control: surround and eyes (S–M).**
- **Spec:**
  - One 44 px opaque button on the cover opens a two-row strip. Ground: as is / white / black / grey / complement, as an inset swatch of the color on that ground. Eyes: typical / protan / deutan / tritan (`rcSimulate`).
  - One plain sentence per state.
  - The state resets when you leave the page.
- **Success test:** David taps through grounds on Teal and sees it shift, and the deutan view names a real confusion partner.

**6. Find it in the world (M).**
- **Spec:**
  - A *Find it* verb in "You and this color" and in the In the world drawer opens the camera in guess-first mode for this color.
  - The veil glows on pixels within the match radius (namer's `isoSample`).
  - A capture logs a `found` event, which becomes "Found 9 Oct" on the page.
- **Success test:** pointing the phone at a teal mug lights the mug, and the color page then shows the find.

**7. The tapped-color cover (S).**
- **Spec:**
  - The hero is split diagonally: your color, then the name.
  - Write one sentence with `lookDiff` ("Yours is greener and a bit lighter than teal · 96% match").
  - Add Save your color.
  - Remove the legacy strip.
- **Success test:** from a photo palette chip, David sees the difference without scrolling.

**8. You, in one line, plus Test your eye (S–M).**
- **Spec:**
  - The relation line on the cover uses Learner Model data.
  - The card holds the duel against your top mix-up (5 trials) and a 20-second single-hue sensitivity check that writes to the Train eye profile.
  - Reuse lane A's Name it / Find it quiz component.
- **Success test:** after a wrong Train answer, the color page names the mix-up and offers the duel. Finishing it updates the line.

**9. Its finest painting and the timeline (M).**
- **Spec:**
  - At the top of In paintings: one full-width crop of the painting where this color matters most, with the veil, and its caption measured and caveated.
  - Above the drawers: one dated timeline row (first record, invention, peak, standards, survey), each dot a door.
- **Success test:** on Prussian Blue the hero is a real Prussian-blue-era painting (after 1705, not a 1340 artifact), and the timeline makes the 1705 date visible at a glance.

**10. A share card and wallpaper (S).**
- **Spec:**
  - ⋯ → Share makes a 1080×1350 image: the color full-bleed, the name in serif, one true finding, and a small "ColorHub".
  - Save as wallpaper makes 1290×2796.
  - Reuse the `og/` renderer's layout.
- **Success test:** David shares Teal to Messages and the preview is the image, not a bare link. The wallpaper's text sits clear of the iOS clock.

