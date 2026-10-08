# Review 2: the map, pages, Studio and You (2026-10-08)

Read-only review of `main` (ebfced64). Every screen was rendered headless through `tools/_qa/frame.html` at 440x956, with spot checks at 375x812. Shots are in the session scratchpad and none were committed. Each screen got the 12-question critic (DAVID-MODEL §4), a skeptic pre-mortem and a borrow pass. Rule for borrowing (P22): take one great thing, and say what it **replaces**, so the screen gets calmer, not longer.

Already fixed since the 10-08 IMPROVE pass, so not repeated here: one right-corner menu, Colors and Arrange sheets, the lit-set bar with Learn these and Find them, instant taps (no 220 ms wait), pull-down going one step back, and "Learn these" seeded from `edgeOfMap`.

---

## Per screen

**1. Home map, first sight.** *Almost.* The object is beautiful, but a fresh open still centers on **Ash**, with Silver, Grey and Khaki around it. That's the dullest possible opener. The center bubble also prints a mono hex ("#B2BEB5") that nobody asked for (Q5). The skeptic says: every open starts beige-grey, and after a week it reads as a launcher, not a place.
**Borrow: Apple Weather.** The first screen *is* today. On the day's first open, the map glides (900 ms) to today's color (`todayPick()`), the bubble breathes once, and one line shows for 2 s: "Today: Celadon · 3 to recall". **Replaces** the default-center logic and the separate color-of-the-day card. Never center a grey by default. Drop the hex from the center bubble.

**2. The corner menu (Do arc).** *Hits, with a tidy needed.* There are six capsules, each a different width, so the right edge is ragged (P16). Search sits fourth, far from the thumb, even though it's the most-used verb.
**Borrow: iOS long-press app menus.** The verb you use most sits nearest your finger. Reorder bottom-up to Search, Learn these, Study the map, Favorites, Colors, Arrange, and align the capsules on one right edge. **Replaces** the stagger. The arc stays.

**3. Search.** *Misses on the surface.* Typing "dusty pink" still filters the map to one lonely bubble on black with a "Fly to" pill (`home.js:769-794`). Partial words reflow the whole honeycomb on every keystroke. There are no recents, no painting rows and no list.
**Borrow: Apple Maps / Spotlight.** Results appear as a list under the field: color rows, then "between" roads, painters, decades and paintings. When the field is empty it shows Recents (the trail plus your last searches) and three examples that really work. **Replaces** filter-as-you-type and the Fly-to pill. The map never reflows while you type.

**4. Colors sheet.** *Almost.* It's long: How many, Family (9), Tone, Your words, Collections. At 440 the "How many" chip row is cut off at "40…", and each stage chip repeats "Stage N" under its number.
**Borrow: the iOS Camera zoom dial.** One horizontal scrubber from 25 to every name, with detents at the stages and a small "you" tick at your Journey stage. The map recounts live as you drag. **Replaces** the 9 stage chips and the duplicate "Every name" collection (P12). Collections trim to the ones that teach (Pastels, Vivid, Muted, Yours), and sources go to a last row.

**5. Arrange sheet.** *Hits.* The live thumbnail strip, the line saying what position means, three Looks and worded sliders are the right shape. But nine arrangements is a menu. HOME-VIEWS' own table shows Sunflower and Your words with the worst neighbor scores (12.7, 11.7).
**Borrow: the Instagram filter strip.** A short strip of great options beats a long one. Curate 9 down to 7: cut Sunflower, and fold "Your words" into the Your words filter (choosing it offers the rings). **Replaces** two weak views.

**6. Lit-set bar (constellations).** *Almost; the key one.* The bar is right: title, "6 named colors · as photographed", Learn these, Find them, ✕. But on the 2,700-name map, Starry Night's six colors are tiny dots in a dark field, and one sits at the left edge. You can't see the painting's colors. There's no Share, and "6 named colors" is one palette (P7).
**Borrow: Google Earth / Apple Maps search pins.** Fly to fit: frame the camera to the lit set's bounds, and grow the lit bubbles to at least 44 px with names. Add Share (`csShare`) to the bar. **Replaces** the static dim-everything look, so dimming becomes framing.

**7. Rooms stem.** *Hits.* The live art and notes are good. The capsules are ragged widths like the Do arc, and "9 new names" and "18 yours" are counts nobody asked for.
**Borrow: Snapchat/iOS hold-and-slide.** Press the corner, slide up, release on a room. It sits beside the tap and **replaces** nothing, so it costs no space. Align the capsule edges.

**8. Back trail and navigation.** *Almost.* Pull-down now goes one step back, which is good. The trail is still invisible apart from long-press ‹, and in the iPhone Home Screen app there is no browser edge-swipe at all.
**Borrow: the iOS edge-swipe back** (every native app, plus Pinterest). A swipe from the left 20 px runs `xBack()` with the page sliding under your finger. **Replaces** reliance on the ‹ button and the long-press as the only ways back (P14). Long-press ‹ stays for the trail sheet.

**9. Color page (Teal).** *Almost.* Problems on the cover and glance strip:
- The cover is a flat field over 60% of the screen.
- The definition source still reads "ColorHub".
- The glance cards use mono lowercase labels ("the paintings", "the words").
- The first glance card is the caveat "First seen… not proof of the pigment".

What works: the article reads well, the sticky Contents bar ("2/7") helps, and "Not to be confused with Turquoise" is exactly right. But the article still renders inline before Field notes.
**Borrow: Albers inside the cover, via the Procreate/Halide quick toggle.** Tapping the cover cycles its ground (paper, black, mid grey, its complement), with one line: "Same hex. On black it looks lighter." **Replaces** the Albers lab tile in Studio, and makes the dead 60% the most educational pixel on the page. Also do the truth pass: never print "ColorHub" as a source, no caveat card in the lead, and serif labels with nouns.

**10. Name page / tapped color.** *Almost.* Frostbite's cover reads "A brand name · Duller than bright pink · Measured": thin and true, but empty above the fold. A tapped #967989 opens Mountbatten Pink with only "Duller than mauve" on the cover.
**Borrow: Shazam's match card.** For a tapped color, the cover splits: your color | the name, "97% match", plus one difference sentence ("Yours is a little greyer"). **Replaces** the small comparison strip lower down. For thin library names, the cover borrows one measured finding ("in 0 of 23,781 paintings; its nearest painted twin is…") rather than staying bare.

**11. Pair page (`#/pair/<a>+<b>`).** *Misses as a pair page.* It's the paintings-of search tool:
- 3 pill rows and 2 sliders sit above the result.
- First paint for Teal + Coral is "No painting holds both… within 4%".
- The title is in a condensed face the rest of the app doesn't use.

David's "a page dedicated to the two" isn't this.
**Borrow: Spotify Blend.** Two things, one page about their relationship. Lead with the two colors big and side by side (P8), then:
- their relation in words (contrast ratio, near-complement or not, which is lighter);
- "together in N paintings", auto-widened and saying so;
- "Learn the difference".

**Replaces** the control rows at the top. They move under one "Adjust" fold.

**12. Studio home.** *Almost.* Capture is a strong hero. Below it, Make holds three things: Gamut wheel, Harmony and Albers. Yours follows, then "Find your color / Find your palette" (taste tests). That's four kinds of thing on one screen.
**Borrow: Halide's single purpose (Shazam's one button).** Studio becomes **Capture · Name · Build** plus your shelf. **Replaces:** Harmony as a tile (it's already the wheel's Triad/Complement presets), Albers (moves to the color cover), and the taste tiles (move to You, where "What you love" lives).

**13. Name any color.** *Almost.* There are two rows of modes (Ring · Perceptual · Names · Type · Eyedrop, then Off · Complement · Analogous · Triad · Square) above an HSV ring that isn't perceptual. The 95% match cards cut off at the right edge ("Deep Bluish Grey-Gre…").
**Borrow: the Procreate color disc.** One wheel, one feel, everywhere. Use the Gamut wheel's OKLab disc here and drop the harmony row (the wheel owns it). **Replaces** two wheels with two hue spaces (the prior A17 skeptic).

**14. Gamut wheel.** *Hits* as a painter's idea. The compound names still contradict the color: "Dusty pink red" for a vivid #F33B5C, and "Vivid dark chocolate brown". Hexes are in mono under every row.
**Borrow: Coolors' row.** Name big, hex on tap. **Replaces** the always-on mono hex lines. Fix the contradicting modifiers in the naming layer.

**15. Harmony lab and Albers lab.** Harmony lab: *misses*. It's the old design, with xkcd primaries ("Windows Blue"), lowercase mono "very close" and no keep or export. Albers: *almost*. It's a lovely demo, and the slug bug is fixed. Both go (see CUT).

**16. Export.** *Hits* (CSS, Tailwind, SVG, GPL, ASE, Procreate with names). Keep it, no change.

**17. You page.** *Almost.* The spectrum bar is a great "you" object. Problems:
- The stats are a mono trio ("12 / 0 / 14").
- "about 637 to Fluent" is jargon.
- "Your eye profile fills in as you play" is an empty state with no action.
- The taste rows sit far from where people make taste.

**Borrow: Apple Fitness summary.** One sentence per ring: "18 colors yours · 12 on the way · 14 you love". **Replaces** the mono trio and the "to Fluent" line. The empty eye state gets one button, "A 60-second eye check". The taste tiles from Studio land under "What you love".

**18. Settings.** *Hits.* It's iOS-calm and grouped, with backup and restore. One borrow: **iCloud's backup nudge.** When "Back up your progress" says *Never* after 7 days of use, the row turns into a gentle paper card at the top of Settings. **Replaces** the fine-print line under the section.

**19. Share cards.** *Almost.* One renderer (`sharecard.js`, 4:5, Instrument Serif) is the right system. The 4:5 card fits feeds and messages, so no 9:16 Stories variant (P22). The gaps are reach and story: the lit-set bar, the pair page and Studio photo palettes don't use it.
**Borrow: Spotify's per-object share.** Every page whose subject is a set of colors shares *that* card. **Replaces** ad-hoc "copy link" paths.

**20. Onboarding / first run.** *Almost.* It's a static 100-swatch grid, then "Name the colors you see.", one paragraph and "Find my level · 60 sec". It's well written, but the first thing a new user touches is a picture, not the app (DAVID-MODEL §5: "the honeycomb should be the first thing you see"). Deep links work for new visitors (`#/color/teal` opens the page), which is good.
**Borrow: Duolingo's start-before-signup, with an Apple Watch-style live face.** The honeycomb drifts slowly behind the headline and responds to a drag, and "Find my level" sits over it. **Replaces** the static grid. Nothing is added.

---

## Curated top 10 (ranked by impact / effort)

**1. Search that answers (impact high, effort S–M).**
- **What:** a results list under the field, Recents when it's empty, and no reflow while typing. A color row flies the map; a painter, decade or painting row lights its set.
- **Files:** `js/home.js` (openSearch, the resolver at ~760–800, the filter branch).
- **Phone test:** type "sag". You get a list (Sage, Sage green, Sargent), the map doesn't move, and a tap flies there with one breathe.

**2. iOS edge-swipe back (impact high, effort S).**
- **What:** a swipe from the left 20 px runs `xBack()`, and the page tracks your finger.
- **Files:** `js/trail.js`, `css/menus2.css`.
- **Phone test:** in the Home Screen app, three pages deep, three edge-swipes return step by step. Horizontal carousels that start more than 20 px in never trigger it.

**3. Lit sets framed, grown and shareable (impact very high, effort S–M).**
- **What:** fly to fit the lit bounds, grow lit bubbles to at least 44 px with names, and add Share on the bar.
- **Files:** `js/honey.js` (677–760), `js/colorset.js` (`csShare`), `js/sharecard.js`.
- **Phone test:** a painting's colors on the map are all on screen, named and readable without a pinch, and Share sends the card.

**4. Studio = Capture · Name · Build (impact high, effort M).**
- **What:**
  - retire the Harmony lab tile (its presets live on the Gamut wheel);
  - the namer drops its harmony row and uses the OKLab disc;
  - the taste tiles move to You.
- **Files:** `js/rooms2.js` (`r2StudioHome`), `js/labs.js`, `js/namer.js`, `js/studio.js`, `js/you.js`.
- **Phone test:** Studio home is two screens or less, there's one wheel in the app, and "Windows Blue" appears nowhere.

**5. The color cover becomes a Look surface, plus the truth pass (impact high, effort S–M).**
- **What:** tapping the cover cycles its ground (paper, black, grey, complement) with one line. Also:
  - never print "ColorHub" as a source;
  - no artifact caveat card in the lead;
  - serif labels with nouns.
- **Files:** the color page renderers (`js/richpage.js`, `js/explore.js`), `js/labs.js` (Albers text reused).
- **Phone test:** on Teal, three taps show the same swatch read three ways. Read six covers aloud: no empty or false line.

**6. A real pair page (impact high, effort M).**
- **What:** the two colors big and split, their relation in words, "together in N paintings" (auto-widened, saying so), and "Learn the difference". The controls go under Adjust.
- **Files:** `js/paintingsof.js` (pair route), `js/router.js:272`.
- **Phone test:** `#/pair/008080+ff7f50` never opens on "No painting holds"; the first screen is the two colors.

**7. Daily arrival, and never a grey center (impact medium-high, effort S).**
- **What:** the first open of the day glides to `todayPick()` with a 2 s line, and the center bubble loses its hex.
- **Files:** `js/honey.js` (restore/centerFirst), `js/today.js`, `js/home.js`.
- **Phone test:** the first open each morning centers a chromatic color; Ash, Grey and Silver are never the default center.

**8. First run on the live map (impact medium-high, effort M).**
- **What:** `welcome()` draws over a slow-drifting honeycomb instead of the static grid.
- **Files:** `js/learn.js` (`welcome`), `js/honey.js`.
- **Phone test:** a fresh profile can drag the map before tapping "Find my level", and there's no layout jump at 375 or 440.

**9. The "How many" scrubber, with collections trimmed (impact medium, effort S–M).**
- **What:** one dial from 25 to every name, with stage detents and a "you" tick.
- **Files:** `js/home.js` (the Colors chooser), `js/colorsets.js`.
- **Phone test:** one thumb drag recounts the map live with no snap, and nothing is cut off at 440.

**10. You page in sentences (impact medium, effort S).**
- **What:** the Fitness-style summary line, no "to Fluent", a one-tap eye check in the empty state, and the taste tiles under "What you love".
- **Files:** `js/you.js`.
- **Phone test:** above the fold reads as three lines a non-builder understands, with no mono numbers.

Tidy (fold into whichever lane touches the file): align the Do arc and rooms capsules on one edge, put Search nearest the thumb, fix the namer's cut-off match cards, and fix the Gamut wheel's contradicting names.

---

## CUT list

- **The Harmony lab** (`#/lab/harmony`) as a screen. The Gamut wheel's presets replace it, and the route can redirect there.
- **The Albers lab as a Studio tile.** It becomes the color cover's Look, and later a Train exercise.
- **The namer's harmony mode row** (Off · Complement · Analogous · Triad · Square).
- **The taste tiles in Studio** ("Find your color", "Find your palette"). They move to You.
- **Arrangements Sunflower and Your words** (9 → 7). Your words lives on as the knowledge filter.
- **The hex under Home's center bubble**, and the always-on mono hex lines in the Gamut wheel list.
- **Filter-as-you-type and the "Fly to" pill** in search.
- **The 9 stage chips and the duplicate "Every name" collection.** The scrubber replaces both.
- **On the color cover:** "ColorHub" as a source, the artifact caveat card in the lead, and mono lowercase labels.
- **The paintings-of control rows at the top of the pair page.** They move under Adjust.
- **The static swatch grid on the welcome screen.**
- **"about 637 to Fluent"** and the mono stat trio on You.

Not cut, because they earn their place: Favorites pick mode, the Arrange sheet, the rooms stem, Export and Settings.
