# ColorHub legibility audit (2026-10-09)

Crawled with `node tools/check_legibility.js --full` (tools/legibility-audit.js + tools/legibility-routes.js) at 375x812 and 440x956.
88 screens, 30572 visible text nodes checked, 494 findings (0 hard failures, 494 reported-only).

Rules: reading text (>2 chars) under 13px always fails. Text under 24px needs >=4.5:1. "Large" text (>=24px, or >=19px bold) needs >=3:1 (reported, not gated). Italic Instrument Serif under 17px is flagged as hard to read. Paragraphs (>40 chars) with line-height/font-size < 1.4 are flagged. Text sitting directly on an `<img>`/`<canvas>` with no scrim layer found over it is reported as `text-over-image-no-scrim` with `bg: uncertain` (contrast can't be computed honestly without a real screenshot; these need a human look).

### across-the-line

- `p.eyebrow.scr-cap` “Test 1 · these should all look plain gre” — 375x812, 17px/400 italic, contrast 5.8:1 — **tight-line-height**
- `p.eyebrow.scr-cap` “Test 2 · you should see five dark square” — 375x812, 17px/400 italic, contrast 5.8:1 — **tight-line-height**
- `p.eyebrow.scr-cap` “Test 1 · these should all look plain gre” — 440x956, 17px/400 italic, contrast 5.8:1 — **tight-line-height**
- `p.eyebrow.scr-cap` “Test 2 · you should see five dark square” — 440x956, 17px/400 italic, contrast 5.8:1 — **tight-line-height**

### challenge-paint

- `span` “J.C. Spengler. Warden of the Royal Cabin” — 375x812, 17px/400, contrast 17.64:1 — **tight-line-height**
- `span` “J.C. Spengler. Warden of the Royal Cabin” — 440x956, 17px/400, contrast 5.8:1 — **tight-line-height**

### color-page-data

- `p.rp-tier` “Named from nature · first recorded as a ” — 375x812, 19px/400 italic, contrast 4.77:1 — **tight-line-height**
- `p.rp-def` “Teal is a dark greenish blue named after” — 375x812, 20px/400, contrast 4.77:1 — **tight-line-height**
- `span.ar-lead-n` “A male Eurasian teal. The color is named” — 375x812, 18px/400, contrast 13.61:1 — **tight-line-height**
- `span` “Louis Le Nain” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “9.9× more than his or her peers, from 7 ” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span.pm-q-line` “Shimmer of waters with fish in them, the” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “Flag --sunny flag, with the orbs of nigh” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `em` “The cool sky that makes the warm desert ” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Control panel · imagined 1970s–80s futur” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.rp-tier` “Named from nature · first recorded as a ” — 440x956, 19px/400 italic, contrast 4.77:1 — **tight-line-height**
- `p.rp-def` “Teal is a dark greenish blue named after” — 440x956, 20px/400, contrast 4.77:1 — **tight-line-height**
- `span.ar-lead-n` “A male Eurasian teal. The color is named” — 440x956, 18px/400, contrast 13.61:1 — **tight-line-height**
- `span` “Louis Le Nain” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “9.9× more than his or her peers, from 7 ” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span.pm-q-line` “Shimmer of waters with fish in them, the” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “Flag --sunny flag, with the orbs of nigh” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `em` “The cool sky that makes the warm desert ” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Control panel · imagined 1970s–80s futur” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### daily

- `p.note.dn-left` “Six guesses. Each one tells you which wa” — 375x812, 14px/400 italic, contrast 14.69:1 — **italic-serif-too-small, tight-line-height**
- `p.note.dn-left` “Six guesses. Each one tells you which wa” — 440x956, 14px/400 italic, contrast 14.69:1 — **italic-serif-too-small, tight-line-height**

### favorites

- `p.note.fv-sub` “28 hearted · order mostly settled” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `small` “Spend ten drops of paint on your favorit” — 375x812, 13.5px/400, contrast 6.23:1 — **tight-line-height**
- `p.note.fv-sub` “28 hearted · order mostly settled” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `small` “Spend ten drops of paint on your favorit” — 440x956, 13.5px/400, contrast 6.23:1 — **tight-line-height**

### hue-gradients

- `p.note` “Swap tiles until the colors flow. Each b” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `em` “Diamond, the same board for everyone tod” — 375x812, 16px/400, contrast 6.23:1 — **tight-line-height**
- `span` “Four corners from famous paintings.” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Petals, leaves and stems.” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The colors of stones, light through crys” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “A century of fashion, ten years at a tim” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “Boards from your favorites and kept pale” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.note.hg-empty` “Heart a few colors, or keep a palette fr” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.note` “Swap tiles until the colors flow. Each b” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `em` “Diamond, the same board for everyone tod” — 440x956, 16px/400, contrast 6.23:1 — **tight-line-height**
- `span` “Four corners from famous paintings.” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Petals, leaves and stems.” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The colors of stones, light through crys” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “A century of fashion, ten years at a tim” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “Boards from your favorites and kept pale” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.note.hg-empty` “Heart a few colors, or keep a palette fr” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**

### lab-harmony

- `p.gw-hint` “Drag the shape to move it. Drag a corner” — 375x812, 17px/400 italic, contrast 5.94:1 — **tight-line-height**
- `p.gw-hint` “Drag the shape to move it. Drag a corner” — 440x956, 17px/400 italic, contrast 5.94:1 — **tight-line-height**

### learnit-done

- `p.lx-bet-q` “How many of these will you name tomorrow” — 375x812, 15px/400, contrast 17.64:1 — **tight-line-height**
- `p.lx-bet-q` “How many of these will you name tomorrow” — 440x956, 15px/400, contrast 17.64:1 — **tight-line-height**

### mapstudy

- `small` “Veil the colors you haven't met yet. A v” — 375x812, 14px/400, contrast 6.82:1 — **tight-line-height**
- `small` “Veil the colors you haven't met yet. A v” — 440x956, 14px/400, contrast 6.82:1 — **tight-line-height**

### meet-the-unit

- `p.eyebrow` “Unit 2 · In-betweens” — 375x812, 15px/400 italic, contrast 14.69:1 — **italic-serif-too-small**
- `p.eyebrow` “Unit 2 · In-betweens” — 440x956, 15px/400 italic, contrast 14.69:1 — **italic-serif-too-small**

### museum-art

- `small` “Blues over an eighth of the canvas, befo” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “The same palette, a century or more apar” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Every look, movement, subculture and pai” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Vivid paintings with an eighth or more i” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Named colors no painting here comes clos” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Our recipe: light key, muted, soft contr” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Blues over an eighth of the canvas, befo” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “The same palette, a century or more apar” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Every look, movement, subculture and pai” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Vivid paintings with an eighth or more i” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Named colors no painting here comes clos” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Our recipe: light key, muted, soft contr” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**

### museum-ideas

- `small` “1500s roots; Western term 1990s · 5 pale” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Danish word; English boom 2016 · 6 palet” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots 19th c. naval uniform; recurring f” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “19th c. roots; recurring fashion revival” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring, mid-20th century roots · 3 pa” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in 19th-20th c. expedition dress; ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring, named from 19th c. military t” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “2000s (as a named trend), rooted in 1960” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “mid-2000s–early 2010s revival 2020s · 4 ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “design roots 1960s; lifestyle trend peak” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “named in reaction to 2010s minimalism · ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “19th c. roots; American form from 1868; ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in traditional riding dress; recur” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “mid-20th century, codified 1980 (The Off” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “1988–1995 (UK "Second Summer of Love") ·” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring since 19th c. logging culture;” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “2010s–present (Japan-originated) · 2 pal” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in traditional fishing workwear; 2” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Russian splits blue in two. Does that ch” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “For centuries English had orange things ” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Emperors' purple came from sea snails, t” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Europe's finest blue came from one mount” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A rainbow is a smooth blur. Newton count” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “You and a friend both call a tomato red.” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Blue and black, or white and gold? One p” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “John Dalton studied his own color blindn” — 375x812, 13px/400, contrast 20.3:1 — **tight-line-height**
- `small` “Black for grief feels natural. For Frenc” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A botched batch of red in a Berlin lab g” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Tapestry weavers said their black dye wa” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Kandinsky was sure every shape had its o” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Tiffany owns a blue and Owens Corning a ” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A teenage poet gave every vowel a color.” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Shakespeare made jealousy a green-eyed m” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Languages gain color words in a surprisi” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “In Japan the go light is called ao, blue” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A teenager tried to make a malaria drug ” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Some of history's best colors came from ” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Germany's greatest poet spent decades in” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Reddish yellow is orange, bluish red is ” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “The same color can look like two differe” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Famous studies say red helps athletes an” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A famous 1918 quote says pink was for bo” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Van Gogh borrowed a chemist's law of col” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Old masters painted shadows brown. The I” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “One artist mixed a blue so intense he pu” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Not market research: its founder is red-” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Homer never calls the sea blue. A future” — 375x812, 13px/400, contrast 20.29:1 — **tight-line-height**
- `span.sys-row` “Light and afterimage · its opposite, cya” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Tiffany Blue · trademark since 1998 (app” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Klein blue · recorded, never patented (a” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Owens Corning pink · first US color mark” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Leuco-indigo bath · yellow-green (approx” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Copper resinate · browned with age (appr” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Saffron threads · dried stigmas (approx.” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Gold · the monogolds (gold leaf, approx.” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `b` “Kandinsky's Concerning the Spiritual in ” — 375x812, 25px/400, contrast 15.89:1 — **tight-line-height**
- `span.sys-row` “Baker-Miller pink · didn't calm (approx.” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “White · Chinese mourning; medieval queen” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Natural ultramarine · the Virgin's robe ” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Klein blue · synthetic ultramarine (appr” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Darkened vermilion · light damage (appro” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Gobelins black · looked weak and reddish” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Impression, Sunrise · the orange sun (ap” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Impression, Sunrise · blue-grey harbor (” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Bluer lilies after 1923 surgery (approx.” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Green · Night Café billiard table (appro” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Pale violet · Bedroom walls as painted (” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Blue-violet edge · light running into da” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Red-yellow edge · dark running into ligh” — 375x812, 13px/400, contrast 12.75:1 — **tight-line-height**
- `b` “Sanzo Wada's A Dictionary of Color Combi” — 375x812, 24px/400, contrast 15.89:1 — **tight-line-height**
- `small` “c. 100,000 BCE · Red ochre paint made at” — 375x812, 17px/400 italic, contrast 4.88:1 — **tight-line-height**
- `small` “c. 30,000 BCE · Charcoal drawings on the” — 375x812, 17px/400 italic, contrast 17.92:1 — **tight-line-height**
- `small` “c. 4,000 BCE · Egyptians mining malachit” — 375x812, 17px/400 italic, contrast 9.87:1 — **tight-line-height**
- `small` “c. 3,250 BCE · Egyptian blue, the first ” — 375x812, 17px/400 italic, contrast 5.67:1 — **tight-line-height**
- `small` “c. 75,000 BCE · Engraved ochre at Blombo” — 375x812, 17px/400 italic, contrast 5.51:1 — **tight-line-height**
- `small` “c. 15,000 BCE · Yellow ochre painted on ” — 375x812, 17px/400 italic, contrast 11.54:1 — **tight-line-height**
- `small` “c. 4,700 BCE · Hongshan culture carving ” — 375x812, 17px/400 italic, contrast 6.02:1 — **tight-line-height**
- `small` “c. 1,950 BCE · Egyptian temple to Hathor” — 375x812, 17px/400 italic, contrast 11.31:1 — **tight-line-height**
- `small` “c. 250 BCE · Ptolemaic emerald mines in ” — 375x812, 17px/400 italic, contrast 8.73:1 — **tight-line-height**
- `small` “c. 100 · Proto-celadon glazes in Eastern” — 375x812, 17px/400 italic, contrast 10.88:1 — **tight-line-height**
- `small` “1289 · Vermilion first recorded as a col” — 375x812, 17px/400 italic, contrast 4.5:1 — **tight-line-height**
- `small` “c. 1400 · Crimson enters English from Me” — 375x812, 17px/400 italic, contrast 4.99:1 — **tight-line-height**
- `small` “1513 · Coral first used as a color word ” — 375x812, 17px/400 italic, contrast 7.43:1 — **tight-line-height**
- `small` “1502 · First use of orange as a color wo” — 375x812, 17px/400 italic, contrast 6.63:1 — **tight-line-height**
- `small` “c. 1520 · Spain begins importing cochine” — 375x812, 17px/400 italic, contrast 9.09:1 — **tight-line-height**
- `small` “c. 1650 · Powder blue: ground cobalt gla” — 375x812, 17px/400 italic, contrast 12.95:1 — **tight-line-height**
- `small` “c. 1680 · Pink first used as a color nam” — 375x812, 17px/400 italic, contrast 8.16:1 — **tight-line-height**
- `small` “1650 · Burnt umber first used as a color” — 375x812, 17px/400 italic, contrast 7.5:1 — **tight-line-height**
- `small` “1705 · Lavender first used as a color wo” — 375x812, 17px/400 italic, contrast 8.44:1 — **tight-line-height**
- `small` “1760 · Sienna first used as a color name” — 375x812, 17px/400 italic, contrast 5.62:1 — **tight-line-height**
- `small` “c. 1775 · Puce in fashion at the court o” — 375x812, 17px/400 italic, contrast 6.67:1 — **tight-line-height**
- `small` “1776 · Salmon first used as a color word” — 375x812, 17px/400 italic, contrast 7.42:1 — **tight-line-height**
- `small` “c. 1705 · Chinese potters develop the ox” — 375x812, 17px/400 italic, contrast 16.26:1 — **tight-line-height**
- `small` “1748 · Royal Navy officers get dark blue” — 375x812, 17px/400 italic, contrast 13.61:1 — **tight-line-height**
- `small` “1775 · Lilac first used as a color word ” — 375x812, 17px/400 italic, contrast 8.36:1 — **tight-line-height**
- `small` “1789 · Maroon first used as a color word” — 375x812, 17px/400 italic, contrast 10.95:1 — **tight-line-height**
- `small` “1802 · Thénard invents cobalt blue pigme” — 375x812, 17px/400 italic, contrast 8.44:1 — **tight-line-height**
- `small` “1810 · Forest green first used as a colo” — 375x812, 17px/400 italic, contrast 4.39:1 — **tight-line-height**
- `small` “1848 · Khaki uniforms made official for ” — 375x812, 17px/400 italic, contrast 8.97:1 — **tight-line-height**
- `small` “c. 1859 · Fuchsine dye made in France, s” — 375x812, 17px/400 italic, contrast 5.92:1 — **tight-line-height**
- `small` “1881 · Burgundy first used as a color wo” — 375x812, 17px/400 italic, contrast 10.83:1 — **tight-line-height**
- `small` “1884 · Chartreuse first used as a color ” — 375x812, 17px/400 italic, contrast 14.33:1 — **tight-line-height**
- `small` “1887 · Beige first used as a color word ” — 375x812, 17px/400 italic, contrast 12.83:1 — **tight-line-height**
- `small` “1846 · Taupe listed among fashionable gr” — 375x812, 17px/400 italic, contrast 4.8:1 — **tight-line-height**
- `small` “1856 · Perkin makes mauveine, the first ” — 375x812, 17px/400 italic, contrast 5.04:1 — **tight-line-height**
- `small` “1858 · Cerise in The Times, the OED's fi” — 375x812, 17px/400 italic, contrast 4.44:1 — **tight-line-height**
- `small` “c. 1860 · Rowney sells cerulean blue pai” — 375x812, 17px/400 italic, contrast 4.78:1 — **tight-line-height**
- `small` “1873 · Riveted blue jeans patented in th” — 375x812, 17px/400 italic, contrast 6.27:1 — **tight-line-height**
- `small` “c. 1883 · Lime green first used as a col” — 375x812, 17px/400 italic, contrast 15.49:1 — **tight-line-height**
- `small` “1884 · Moss green first used as a color ” — 375x812, 17px/400 italic, contrast 6.06:1 — **tight-line-height**
- `small` “1915 · Burnt orange first used as a colo” — 375x812, 17px/400 italic, contrast 4.31:1 — **tight-line-height**
- `small` “1917 · Teal first used as a color word i” — 375x812, 17px/400 italic, contrast 4.77:1 — **tight-line-height**
- `small` “1937 · Schiaparelli launches shocking pi” — 375x812, 17px/400 italic, contrast 7.01:1 — **tight-line-height**
- `small` “1500s roots; Western term 1990s · 5 pale” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Danish word; English boom 2016 · 6 palet” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots 19th c. naval uniform; recurring f” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “19th c. roots; recurring fashion revival” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring, mid-20th century roots · 3 pa” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in 19th-20th c. expedition dress; ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring, named from 19th c. military t” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “2000s (as a named trend), rooted in 1960” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “mid-2000s–early 2010s revival 2020s · 4 ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “design roots 1960s; lifestyle trend peak” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “named in reaction to 2010s minimalism · ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “19th c. roots; American form from 1868; ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in traditional riding dress; recur” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “mid-20th century, codified 1980 (The Off” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “1988–1995 (UK "Second Summer of Love") ·” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “recurring since 19th c. logging culture;” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “2010s–present (Japan-originated) · 2 pal” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “roots in traditional fishing workwear; 2” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Russian splits blue in two. Does that ch” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “For centuries English had orange things ” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Emperors' purple came from sea snails, t” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Europe's finest blue came from one mount” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A rainbow is a smooth blur. Newton count” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “You and a friend both call a tomato red.” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Blue and black, or white and gold? One p” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “John Dalton studied his own color blindn” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Black for grief feels natural. For Frenc” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A botched batch of red in a Berlin lab g” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Tapestry weavers said their black dye wa” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Kandinsky was sure every shape had its o” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Tiffany owns a blue and Owens Corning a ” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A teenage poet gave every vowel a color.” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Shakespeare made jealousy a green-eyed m” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Languages gain color words in a surprisi” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “In Japan the go light is called ao, blue” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A teenager tried to make a malaria drug ” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Some of history's best colors came from ” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Germany's greatest poet spent decades in” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Reddish yellow is orange, bluish red is ” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “The same color can look like two differe” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Famous studies say red helps athletes an” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “A famous 1918 quote says pink was for bo” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Van Gogh borrowed a chemist's law of col” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Old masters painted shadows brown. The I” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “One artist mixed a blue so intense he pu” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Not market research: its founder is red-” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `small` “Homer never calls the sea blue. A future” — 440x956, 13px/400, contrast 20.29:1 — **tight-line-height**
- `span.sys-row` “Light and afterimage · its opposite, cya” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Tiffany Blue · trademark since 1998 (app” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Klein blue · recorded, never patented (a” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Owens Corning pink · first US color mark” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Leuco-indigo bath · yellow-green (approx” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Copper resinate · browned with age (appr” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Saffron threads · dried stigmas (approx.” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Gold · the monogolds (gold leaf, approx.” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `b` “Kandinsky's Concerning the Spiritual in ” — 440x956, 25px/400, contrast 15.89:1 — **tight-line-height**
- `span.sys-row` “Baker-Miller pink · didn't calm (approx.” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “White · Chinese mourning; medieval queen” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Natural ultramarine · the Virgin's robe ” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Klein blue · synthetic ultramarine (appr” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Darkened vermilion · light damage (appro” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Gobelins black · looked weak and reddish” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Impression, Sunrise · the orange sun (ap” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Impression, Sunrise · blue-grey harbor (” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Bluer lilies after 1923 surgery (approx.” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Green · Night Café billiard table (appro” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Pale violet · Bedroom walls as painted (” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Blue-violet edge · light running into da” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `span.sys-row` “Red-yellow edge · dark running into ligh” — 440x956, 13px/400, contrast 12.75:1 — **tight-line-height**
- `b` “Sanzo Wada's A Dictionary of Color Combi” — 440x956, 24px/400, contrast 15.89:1 — **tight-line-height**
- `small` “c. 100,000 BCE · Red ochre paint made at” — 440x956, 17px/400 italic, contrast 4.88:1 — **tight-line-height**
- `small` “c. 30,000 BCE · Charcoal drawings on the” — 440x956, 17px/400 italic, contrast 17.92:1 — **tight-line-height**
- `small` “c. 4,000 BCE · Egyptians mining malachit” — 440x956, 17px/400 italic, contrast 9.87:1 — **tight-line-height**
- `small` “c. 3,250 BCE · Egyptian blue, the first ” — 440x956, 17px/400 italic, contrast 5.67:1 — **tight-line-height**
- `small` “c. 75,000 BCE · Engraved ochre at Blombo” — 440x956, 17px/400 italic, contrast 5.51:1 — **tight-line-height**
- `small` “c. 15,000 BCE · Yellow ochre painted on ” — 440x956, 17px/400 italic, contrast 11.54:1 — **tight-line-height**
- `small` “c. 4,700 BCE · Hongshan culture carving ” — 440x956, 17px/400 italic, contrast 6.02:1 — **tight-line-height**
- `small` “c. 1,950 BCE · Egyptian temple to Hathor” — 440x956, 17px/400 italic, contrast 11.31:1 — **tight-line-height**
- `small` “c. 250 BCE · Ptolemaic emerald mines in ” — 440x956, 17px/400 italic, contrast 8.73:1 — **tight-line-height**
- `small` “c. 100 · Proto-celadon glazes in Eastern” — 440x956, 17px/400 italic, contrast 10.88:1 — **tight-line-height**
- `small` “1289 · Vermilion first recorded as a col” — 440x956, 17px/400 italic, contrast 4.5:1 — **tight-line-height**
- `small` “c. 1400 · Crimson enters English from Me” — 440x956, 17px/400 italic, contrast 4.99:1 — **tight-line-height**
- `small` “1513 · Coral first used as a color word ” — 440x956, 17px/400 italic, contrast 7.43:1 — **tight-line-height**
- `small` “1502 · First use of orange as a color wo” — 440x956, 17px/400 italic, contrast 6.63:1 — **tight-line-height**
- `small` “c. 1520 · Spain begins importing cochine” — 440x956, 17px/400 italic, contrast 9.09:1 — **tight-line-height**
- `small` “c. 1650 · Powder blue: ground cobalt gla” — 440x956, 17px/400 italic, contrast 12.95:1 — **tight-line-height**
- `small` “c. 1680 · Pink first used as a color nam” — 440x956, 17px/400 italic, contrast 8.16:1 — **tight-line-height**
- `small` “1650 · Burnt umber first used as a color” — 440x956, 17px/400 italic, contrast 7.5:1 — **tight-line-height**
- `small` “1705 · Lavender first used as a color wo” — 440x956, 17px/400 italic, contrast 8.44:1 — **tight-line-height**
- `small` “1760 · Sienna first used as a color name” — 440x956, 17px/400 italic, contrast 5.62:1 — **tight-line-height**
- `small` “c. 1775 · Puce in fashion at the court o” — 440x956, 17px/400 italic, contrast 6.67:1 — **tight-line-height**
- `small` “1776 · Salmon first used as a color word” — 440x956, 17px/400 italic, contrast 7.42:1 — **tight-line-height**
- `small` “c. 1705 · Chinese potters develop the ox” — 440x956, 17px/400 italic, contrast 16.26:1 — **tight-line-height**
- `small` “1748 · Royal Navy officers get dark blue” — 440x956, 17px/400 italic, contrast 13.61:1 — **tight-line-height**
- `small` “1775 · Lilac first used as a color word ” — 440x956, 17px/400 italic, contrast 8.36:1 — **tight-line-height**
- `small` “1789 · Maroon first used as a color word” — 440x956, 17px/400 italic, contrast 10.95:1 — **tight-line-height**
- `small` “1802 · Thénard invents cobalt blue pigme” — 440x956, 17px/400 italic, contrast 8.44:1 — **tight-line-height**
- `small` “1810 · Forest green first used as a colo” — 440x956, 17px/400 italic, contrast 4.39:1 — **tight-line-height**
- `small` “1848 · Khaki uniforms made official for ” — 440x956, 17px/400 italic, contrast 8.97:1 — **tight-line-height**
- `small` “c. 1859 · Fuchsine dye made in France, s” — 440x956, 17px/400 italic, contrast 5.92:1 — **tight-line-height**
- `small` “1881 · Burgundy first used as a color wo” — 440x956, 17px/400 italic, contrast 10.83:1 — **tight-line-height**
- `small` “1884 · Chartreuse first used as a color ” — 440x956, 17px/400 italic, contrast 14.33:1 — **tight-line-height**
- `small` “1887 · Beige first used as a color word ” — 440x956, 17px/400 italic, contrast 12.83:1 — **tight-line-height**
- `small` “1846 · Taupe listed among fashionable gr” — 440x956, 17px/400 italic, contrast 4.8:1 — **tight-line-height**
- `small` “1856 · Perkin makes mauveine, the first ” — 440x956, 17px/400 italic, contrast 5.04:1 — **tight-line-height**
- `small` “1858 · Cerise in The Times, the OED's fi” — 440x956, 17px/400 italic, contrast 4.44:1 — **tight-line-height**
- `small` “c. 1860 · Rowney sells cerulean blue pai” — 440x956, 17px/400 italic, contrast 4.78:1 — **tight-line-height**
- `small` “1873 · Riveted blue jeans patented in th” — 440x956, 17px/400 italic, contrast 6.27:1 — **tight-line-height**
- `small` “c. 1883 · Lime green first used as a col” — 440x956, 17px/400 italic, contrast 15.49:1 — **tight-line-height**
- `small` “1884 · Moss green first used as a color ” — 440x956, 17px/400 italic, contrast 6.06:1 — **tight-line-height**
- `small` “1915 · Burnt orange first used as a colo” — 440x956, 17px/400 italic, contrast 4.31:1 — **tight-line-height**
- `small` “1917 · Teal first used as a color word i” — 440x956, 17px/400 italic, contrast 4.77:1 — **tight-line-height**
- `small` “1937 · Schiaparelli launches shocking pi” — 440x956, 17px/400 italic, contrast 7.01:1 — **tight-line-height**

### museum-world

- `span.wd-sub` “12 plants that colored the world before ” — 375x812, 17px/400 italic, contrast 5.57:1 — **tight-line-height**
- `span.wd-sub` “12 plants that colored the world before ” — 440x956, 17px/400 italic, contrast 5.57:1 — **tight-line-height**

### name-page

- `span.ar-lead-n` “A Livonian man's shirt of unbleached lin” — 375x812, 18px/400, contrast 13.61:1 — **tight-line-height**
- `span` “Shitao” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Min Zhen” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “India” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Xugu” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Bian Shoumin” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Willem van de Velde the Elder” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Thorvald Niss” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “32.8× more than his or her peers, from 8” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “32.7× more than his or her peers, from 8” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “23.0× more than his or her peers, from 8” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “10.1× more than his or her peers, from 7” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “9.6× more than his or her peers, from 12” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span.pm-q-line` “A half-burnt match, an block, three book” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “And -limbed, grey-eyed, with look of pri” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “Outstretched upon your peace, as on a be” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “And glowed in the top of cream-coloured ” — 375x812, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.psg-ex` “…He loved the of the sunstone, and the m” — 375x812, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…a treasure-heap, it seems, partly of , ” — 375x812, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…The bright satins and soft-tinted silks” — 375x812, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…Parallel with his eyebrows was attached” — 375x812, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span` “ecru = raw linen, spun from flax: the sa” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `p.fx-in-sub` “Decades and houses whose signature color” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `em` “The bust Karol carries as a stand-in for” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Country palette · recurring, mid-20th ce” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span.ar-lead-n` “A Livonian man's shirt of unbleached lin” — 440x956, 18px/400, contrast 13.61:1 — **tight-line-height**
- `span` “Shitao” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Min Zhen” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “India” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Xugu” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Bian Shoumin” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Willem van de Velde the Elder” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Thorvald Niss” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “32.8× more than his or her peers, from 8” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “32.7× more than his or her peers, from 8” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “23.0× more than his or her peers, from 8” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “10.1× more than his or her peers, from 7” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “9.6× more than his or her peers, from 12” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span.pm-q-line` “A half-burnt match, an block, three book” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “And -limbed, grey-eyed, with look of pri” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “Outstretched upon your peace, as on a be” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.pm-q-line` “And glowed in the top of cream-coloured ” — 440x956, 21px/400 italic, contrast 14.48:1 — **tight-line-height**
- `span.psg-ex` “…He loved the of the sunstone, and the m” — 440x956, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…a treasure-heap, it seems, partly of , ” — 440x956, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…The bright satins and soft-tinted silks” — 440x956, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span.psg-ex` “…Parallel with his eyebrows was attached” — 440x956, 20px/400, contrast 14.33:1 — **tight-line-height**
- `span` “ecru = raw linen, spun from flax: the sa” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `p.fx-in-sub` “Decades and houses whose signature color” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `em` “The bust Karol carries as a stand-in for” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `small` “Country palette · recurring, mid-20th ce” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### odd-one-out

- `p.note` “Find the tile that's different. Each rig” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.oo-pk-note` “Starts at level 1, a 12% gap, just below” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a clear difference in any a” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a difference that takes a s” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “Opens once level 8 is passed or cleared:” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `em` “See the board, a blink, then tap the til” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “One tile in the gradient is misplaced: f” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “See a gradient, it scrambles: put it bac” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Remember four colors, then tap the newco” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Four names on four colors: one name is o” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Colors come one at a time: tap when one ” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Three lives. The board grows and the gap” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Every right answer adds tiles, until a m” — 375x812, 14px/400, contrast 6.23:1 — **tight-line-height**
- `span` “You can find a difference most people mi” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a difference at the edge of” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.note` “Find the tile that's different. Each rig” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.oo-pk-note` “Starts at level 1, a 12% gap, just below” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a clear difference in any a” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a difference that takes a s” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “Opens once level 8 is passed or cleared:” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `em` “See the board, a blink, then tap the til” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “One tile in the gradient is misplaced: f” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “See a gradient, it scrambles: put it bac” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Remember four colors, then tap the newco” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Four names on four colors: one name is o” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Colors come one at a time: tap when one ” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Three lives. The board grows and the gap” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `em` “Every right answer adds tiles, until a m” — 440x956, 14px/400, contrast 6.23:1 — **tight-line-height**
- `span` “You can find a difference most people mi” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “You can find a difference at the edge of” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### odd-whose-palette

- `p.oo-pk-note` “Adapts: the other painters get closer to” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.oo-pk-note` “Adapts: the other painters get closer to” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### painter-page

- `span` “John Singer Sargent” — 375x812, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `b` “Mountain View at Bormio (from Switzerlan” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Ortler Spitz from Summit of Stelvio Pass” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Bay of Uri, Brunnen (from Switzerland 18” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Jungfrau (from "Splendid Mountain Waterc” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-find` “None of the 19 colors in these palettes ” — 375x812, 18px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-hl-line` “Lighter than 82% of the 840 painters her” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-cl-t` “The Study for "The Coming of the America” — 375x812, 22px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-cl-t` “The Ena and Betty, Daughters of Asher an” — 375x812, 22px/400, contrast 15.89:1 — **tight-line-height**
- `span` “Lighter than 82% of the 840 painters her” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More colorful than 51% of the 840 painte” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More contrast than 62% of the 840 painte” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More vivid color than 57% of the 840 pai” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `button.btn.ghost` “Whose palette? Guess Sargent from five c” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “John Singer Sargent” — 440x956, 13px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `b` “Mountain View at Bormio (from Switzerlan” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Ortler Spitz from Summit of Stelvio Pass” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Bay of Uri, Brunnen (from Switzerland 18” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Jungfrau (from "Splendid Mountain Waterc” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-find` “None of the 19 colors in these palettes ” — 440x956, 18px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-hl-line` “Lighter than 82% of the 840 painters her” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-cl-t` “The Study for "The Coming of the America” — 440x956, 22px/400, contrast 15.89:1 — **tight-line-height**
- `p.aw-cl-t` “The Ena and Betty, Daughters of Asher an” — 440x956, 22px/400, contrast 15.89:1 — **tight-line-height**
- `span` “Lighter than 82% of the 840 painters her” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More colorful than 51% of the 840 painte” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More contrast than 62% of the 840 painte” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `span` “More vivid color than 57% of the 840 pai” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `button.btn.ghost` “Whose palette? Guess Sargent from five c” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### painting-page

- `span` “The edge of “within 5%”: these colors ju” — 375x812, 13px/400, contrast 7.27:1 — **tight-line-height**
- `p.xb-tune-sum` “106 paintings within 5%, covering at lea” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.xb-set-cap` “The colors of these 106 paintings, poole” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span` “The edge of “within 5%”: these colors ju” — 440x956, 13px/400, contrast 7.27:1 — **tight-line-height**
- `p.xb-tune-sum` “106 paintings within 5%, covering at lea” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.xb-set-cap` “The colors of these 106 paintings, poole” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### practice

- `span` “Names on the left, colors on the right. ” — 375x812, 17px/400 italic, contrast 6.23:1 — **tight-line-height**
- `span` “Names on the left, colors on the right. ” — 440x956, 17px/400 italic, contrast 6.23:1 — **tight-line-height**

### slideshow

- `span.note` “Friday” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note.lh-hero-n` “3 next door to silver · 6 new at your le” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span.note` “12 on the way” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The first 53 words · 14 of 42 met” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “J.C. Spengler. Warden of the Royal Cabin” — 375x812, 24px/400 italic, contrast 15.89:1 — **tight-line-height**
- `p#lrTcSub.note.lr-tc-sub` “J.L. Lund, 1834” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.note` “Friday” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note.lh-hero-n` “3 next door to silver · 6 new at your le” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span.note` “12 on the way” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The first 53 words · 14 of 42 met” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “J.C. Spengler. Warden of the Royal Cabin” — 440x956, 24px/400 italic, contrast 15.89:1 — **tight-line-height**
- `p#lrTcSub.note.lr-tc-sub` “J.L. Lund, 1834” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**

### slideshow-family

- `span.note` “Friday” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note.lh-hero-n` “3 next door to silver · 6 new at your le” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span.note` “12 on the way” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The first 53 words · 14 of 42 met” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “J.C. Spengler. Warden of the Royal Cabin” — 375x812, 24px/400 italic, contrast 15.89:1 — **tight-line-height**
- `p#lrTcSub.note.lr-tc-sub` “J.L. Lund, 1834” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.note` “Friday” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note.lh-hero-n` “3 next door to silver · 6 new at your le” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span.note` “12 on the way” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The first 53 words · 14 of 42 met” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “J.C. Spengler. Warden of the Royal Cabin” — 440x956, 24px/400 italic, contrast 15.89:1 — **tight-line-height**
- `p#lrTcSub.note.lr-tc-sub` “J.L. Lund, 1834” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**

### studio

- `span.note` “Make your own” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.note` “camera or photo” — 375x812, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.r2-hn` “The camera names the color in the middle” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span.note` “any color, about 1,000 words” — 375x812, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “Drag, type or eyedrop. The nearest names” — 375x812, 17px/400 italic, contrast 6.23:1 — **tight-line-height**
- `span.note` “palettes from scratch” — 375x812, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.r2-tm` “Lay a shape on the wheel, or start from ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Heart the colors you love, then rank the” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span.note` “Make your own” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.note` “camera or photo” — 440x956, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.r2-hn` “The camera names the color in the middle” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `span.note` “any color, about 1,000 words” — 440x956, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `em` “Drag, type or eyedrop. The nearest names” — 440x956, 17px/400 italic, contrast 6.23:1 — **tight-line-height**
- `span.note` “palettes from scratch” — 440x956, 15px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span.r2-tm` “Lay a shape on the wheel, or start from ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `small` “Heart the colors you love, then rank the” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**

### studio-photo-palette

- `p.pv-tapnote` “Tap the photo to guess a spot's name, th” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.tw-lead` “Nothing in the archive is really close. ” — 375x812, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `b` “Arion on a Sea Horse and Bacchante on a ” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Man Seated in a European Chair Smoking a” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Madonna and Child with Saint Jerome, Sai” — 375x812, 19px/400, contrast 15.89:1 — **tight-line-height**
- `p.pv-tapnote` “Tap the photo to guess a spot's name, th” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `p.tw-lead` “Nothing in the archive is really close. ” — 440x956, 17px/400 italic, contrast 7.27:1 — **tight-line-height**
- `b` “Arion on a Sea Horse and Bacchante on a ” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Man Seated in a European Chair Smoking a” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**
- `b` “Madonna and Child with Saint Jerome, Sai” — 440x956, 19px/400, contrast 15.89:1 — **tight-line-height**

### taste-color

- `h1.tz-reading` “You love deep, vivid teals, and steer cl” — 375x812, 36px/400, contrast 15.89:1 — **tight-line-height**
- `h1.tz-reading` “You love deep, vivid teals, and steer cl” — 440x956, 42px/400, contrast 15.89:1 — **tight-line-height**

### train-gym

- `p.note` “Every board's corners come from somethin” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `em` “Diamond, the same board for everyone tod” — 375x812, 16px/400, contrast 6.23:1 — **tight-line-height**
- `span` “Four corners from famous paintings.” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Petals, leaves and stems.” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The colors of stones, light through crys” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “A century of fashion, ten years at a tim” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “Boards from your favorites and kept pale” — 375x812, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `p.note` “Every board's corners come from somethin” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `em` “Diamond, the same board for everyone tod” — 440x956, 16px/400, contrast 6.23:1 — **tight-line-height**
- `span` “Four corners from famous paintings.” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “Petals, leaves and stems.” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `span` “The colors of stones, light through crys” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “A century of fashion, ten years at a tim” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `span` “Boards from your favorites and kept pale” — 440x956, 16px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**

### you

- `span.note` “Since October 9” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note` “Color on 5 of the last 7 days · daily ch” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `small` “By family and by lightness, vividness, h” — 375x812, 14px/400, contrast 6.82:1 — **tight-line-height**
- `small` “Starts on its own after a minute, on the” — 375x812, 14px/400, contrast 6.82:1 — **tight-line-height**
- `span.note` “Since October 9” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note` “Color on 5 of the last 7 days · daily ch” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `small` “By family and by lightness, vividness, h” — 440x956, 14px/400, contrast 6.82:1 — **tight-line-height**
- `small` “Starts on its own after a minute, on the” — 440x956, 14px/400, contrast 6.82:1 — **tight-line-height**

### you-card

- `span.note` “Since October 9” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note` “Color on 5 of the last 7 days · daily ch” — 375x812, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `small` “By family and by lightness, vividness, h” — 375x812, 14px/400, contrast 6.82:1 — **tight-line-height**
- `small` “Starts on its own after a minute, on the” — 375x812, 14px/400, contrast 6.82:1 — **tight-line-height**
- `span.note` “Since October 9” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small**
- `p.note` “Color on 5 of the last 7 days · daily ch” — 440x956, 14px/400 italic, contrast 7.27:1 — **italic-serif-too-small, tight-line-height**
- `small` “By family and by lightness, vividness, h” — 440x956, 14px/400, contrast 6.82:1 — **tight-line-height**
- `small` “Starts on its own after a minute, on the” — 440x956, 14px/400, contrast 6.82:1 — **tight-line-height**
