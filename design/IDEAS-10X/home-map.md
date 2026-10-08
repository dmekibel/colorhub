# Ideas 10×: Home, the map, the rooms, search and the first 60 seconds (2026-10-08)

Area: the honeycomb home (`js/honey.js`, `js/home.js`, `css/honey.css`, the View panel, the stages), navigation and the rooms (`js/core.js` `roomChrome` / `toggleStem` / `growFrom`, DESIGN-SYSTEM §2), search, onboarding and placement (`js/learn.js` `welcome` / `how` / `placed`, `js/pickit.js` `pickPlace`), and the first 60 seconds.

Read before writing: CLAUDE.md, MASTER-PLAN, GENIUS-PANEL-1 (built on, not repeated; credited where an idea extends it), REQUESTS-LEDGER (every honeycomb verdict), DESIGN-SYSTEM §1, §2 and §12, and the code. The app was run in screenshot mode (`#shot=home`, `home:rooms`) at 390 × 844.

Section 4 is the **Honeycomb 10×** section the coordinator asked for (57 ideas in five groups, 10 ★, and 5 buildable today).

---

## 0. The honeycomb constitution (David's verdicts; every idea below obeys them)

| Rule | Source |
|---|---|
| No progress marks on bubbles. No dimming or muting, ever. Progress is a **view** (what's shown), never a **mark** (how a bubble looks). | X7 |
| No gaps, no uneven seams, no overlap at any setting, including mid-slide. | X16, X17, Q2 |
| Nothing snaps. Sizes ease. Motion is subtle and beautiful, never wiggly. This applies to all panning. | X18, P13, H21 |
| The round fisheye (Apple Watch feel) is the default. Edges is an alternate. | H13, X13 |
| Zoom-out stays where you leave it. Repeats at the edges are fine. | H10 |
| Tile only where the colors truly continue across the seam. | honey.js wrap rule |
| Alive, but calm: drift, finger-lag, ripple. | H25 |
| Slide to center. The center and its ring open on a tap; a farther bubble glides to center first. | H7 |
| Show (what) and Look (how) are separate panels. | H19 |
| Words on every bubble, wherever they fit. | H22 |
| One tap opens the page. No in-between sheet. | X14, N3 |
| The 101 have no special status, and the UI never says "101". | X19 |
| No glass, no blur, no title island naming the center color. | X10, X11 |
| The rabbit-hole view was rejected for being too close to the honeycomb. | X4 |

**A correction to round 1.** GENIUS-PANEL-1 proposed L18 "Your map" (Yours lit, unmet dim, mix-ups threaded) and L12 relation marks on honeycomb bubbles. **Both break X7.** Below, they become *views* (idea 4.14, "Yours ↔ Everything") and an explicit *Study session* (ideas 4.48–4.53). The resting Home map never marks or dims a bubble. The coordinator's "fog of war" and "your map lit by what you know" are handled the same way, and each one is flagged where it appears.

---

## 1. Diagnosis (blunt)

**The map isn't a map.**
- Every set gets a fresh layout (`honeyLayout` recomputes per item list), so a color has no address. Teal sits in one place at stage 3, another at stage 5, another in "Blues". You can't learn where anything lives, and "one map of all color" (the panel's organizing idea) is false today.
- At stage 3, neighbors read as a bead jar, not a geography. The greys are spliced into the middle of the hue sweep, so the center of the default Home is *Malachite | Grey*, *Lime | Ash | Celadon*, *Baby pink | Terracotta*.
- The mirrored vertical tiling puts Burgundy, Oxblood, Gunmetal and Aubergine **twice on one phone screen** (top and bottom of the default view). That's fine at the edges, per H10, but it reads as a bug when both copies are in view.
- There are no region names, no compass and no sense of "you are here". Zoomed out, it's confetti.

**Home has one verb: tap to open.**
- Nothing on the map teaches by itself. You can't study on it, compare on it, collect on it or test yourself on it.
- It's a beautiful launcher for pages. The soul says "teach people to see", and the floor of the app currently teaches nothing.

**The rooms stem says nothing about today.**
- Train and Studio are the *same* rainbow conic gradient. Explore is a fixed blue-to-cream gradient.
- The notes are generic: "Browse by color", "Wheel, camera, palettes".
- DESIGN-SYSTEM §2 promised "what's inside today" (today's cover image, today's station, the gamut wheel). Only Learn delivers it.
- The "you're still on top of Home" strip above every room is 16 fake decorative bars (`ROOM_PEEK_BARS`), not the honeycomb.

**The View panel built is not the View panel specced.**
- DS §12 asked for one huge count with a 9-detent scrubber, then three quiet rows.
- What shipped:
  - 11 stage chips;
  - 4 filter segments;
  - about 25 collection chips in five groups (including Werner, Ridgway, RAL, xkcd and Web colors);
  - a Look tab of raw engine sliders (Center size, Gap, Shape, Alive);
  - "Rate every preset (honeycomb lab) →", a developer link in a user panel.
- It's the most crowded surface in the app, sitting on the calmest one.

**Search is buried, and its placeholder overpromises.**
- It's two taps deep (View → magnifier).
- It filters the honeycomb but doesn't fly to the color.
- The placeholder says "sea, rust, Monet…", but Monet returns nothing that's Monet's (N6 is PARTIAL). That placeholder makes a claim the code can't keep.

**X19 leaks.**
- "Lesson colors" is a collection.
- Stage 3 is hard-coded to exactly 101 (`n === 100 ? 101 : n`), and its chip reads "101".
- The title reads "Stage 3 · 101 colors · swipe or tap", and "swipe or tap" is an instruction that never goes away.

**Onboarding explains instead of showing.**
- The first screen is a static paint-store grid, not the honeycomb that is the app.
- It has uppercase "COLORHUB" and "· 60 SEC" (DS §4: no uppercase anywhere).
- Its copy says "Learn them a family at a time", which is the lesson style David rejected (X22).
- Then `how()` spends a whole screen describing three steps before you do one.
- Placement measures only two tiers of the lesson list for 60 seconds. It outputs a tier name ("Your starting point: *In-betweens*") that means nothing to a newcomer and says nothing on the 1,000-name scale the Journey now uses.
- The result drops you onto a 101-bubble map with no next step.
- **In the first 60 seconds, a new user never sees one thing they couldn't see before.** That's the soul's whole promise, and it's missing at the door.

**The profile screen points at a menu that no longer exists** ("Change these any time from the ⋯ menu").

---

## 2. North star

Home becomes **the one map of all color that you learn to read.**
- Every one of the ~7,000 names has a permanent address in a perceptual geography. Blues always live up and to the right of greens; teal always sits between them.
- Learning shows up as **resolution**: as your stage grows, new names bloom *between* the ones you know, and the map gets finer the way your eye does.
- Pinch out and you see regions (Blues, Earths, Violets). Pinch in on a color and it opens into its page under your fingers.
- Anything in the app, from a painting or a painter to your photo, a decade or a poem, can be laid onto the map as a constellation at those same addresses. You see *where* Hammershøi lives (a tight grey archipelago) and where Matisse lives (everywhere).
- The map is also a study table: find teal blind, name the glowing bubble, walk the road between two colors you confuse, light up five new words a day, drop one color on another to compare them.
- The rooms rise from it, each showing what's really waiting today. Search is a pull-down that flies you anywhere.
- The first minute shows a newcomer that one word ("blue") hides four colors they walked past. It measures honestly how many names they already have, then blooms the map from *theirs* to *everything they're about to see*.

---

## 3. Ideas for the area (Home, rooms, search, onboarding): 22, ranked

The honeycomb's own ideas (layouts, lenses, study modes, gestures) are in section 4. Five of the best below are ★.

### 3.1 ★ "A word splits the blue": the opening 10 seconds
- **What:**
  - The app opens on one real archive painting (a sky or a sea, e.g. a public-domain Turner or Hokusai already in `paintings.js`), cropped to a region.
  - One plain caption: *Blue.*
  - Then the region splits: four or five leader lines draw out to where its named colors actually sit ("cerulean · powder blue · slate · periwinkle"), one every 400 ms.
  - Then one line: *Every name is a new way to see.*
- **Why 10×:** it's the soul in one beat, and it costs the user zero effort. They *see* that they were missing something before being asked to do anything.
- **Connects:** painting analysis (`cm` color map, `acc`/`hid`, nearest-of-1,000 names), the naming engine (`nameOf`), Explore (the painting opens later with the same highlight), and placement (next screen).
- **Effort:** S–M.
- **Honesty:** the names are nearest names to *photographed* colors. Add a small "as photographed" credit line. Pick a painting where the named spots are ≥ 5% of the region and ≥ 6 ΔE apart, so the split is real and visible.

### 3.2 ★ Placement as an honest vocabulary-size estimate, ending in the bloom
- **What:**
  - The same 60-second pick-the-color format, but sampled across the whole 1,000-name order (2 words from each of 10 rank bands), with same-family options.
  - It ends with a number and a range: **"You can pick about 140 of the 1,000 names, give or take 30."**
  - Then the map shows *your* ~140 and blooms out to all 1,000: "About 860 to learn."
- **Why 10×:** a real number on the real scale. Newcomers get a striking, shareable fact about themselves, and the Journey gets a starting stage. Every wrong pick is also logged *with what you picked*, so the confusion map exists from minute one.
- **Connects:** Journey (sets the stage), Learner Model (`pick_wrong` events with `as` from day one), the honeycomb (the bloom), and the share card.
- **Effort:** M. A buildable version is in §6.
- **Honesty:**
  - It measures *recognition among four same-family options*, not naming. Say so.
  - It's corrected for guessing.
  - The rank order is approximate (GENIUS L15: alphabetical after ~140) until the `use` score lands, so the range must be honest and wide.
  - Never compare with "most people".

### 3.3 ★ Pull down to search, swipe up to learn
- **What:**
  - A pull-down from the top of Home opens one search field that understands:
    - colors and hex;
    - modifiers ("dusty pink", "pale teal");
    - painters ("Sargent");
    - decades ("1880s");
    - "between teal and navy";
    - a photo.
  - A color result **flies** the map there (with a slight zoom-out mid-flight so you see the distance traveled). A set result lays a constellation on the map.
  - It mirrors the existing swipe up for Learn: two symmetric edge gestures, no buttons.
- **Why 10×:** search becomes travel across a geography you're learning, not a filter.
- **Connects:** the Color Graph (resolution), painters (`data/analysis/artists/*`), decades (`groups.json`), Studio (photo → set), and Train (the road between two colors becomes an ordering board).
- **Effort:** M. A buildable core is in §6.
- **Honesty:** painter and decade sets carry "as photographed · n paintings". Modifier parsing is approximate, so show the resolved name ("dusty pink ≈ Ash rose").

### 3.4 ★ A live stem and the real floor
- **What:** each stem bubble shows what's really inside today:
  - **Explore:** today's painting cropped into the circle.
  - **Train:** today's station tile in its own colors, with the note "Odd one out · level 9 · 3 min".
  - **Studio:** your last palette as stripes, or the gamut wheel if you have none.
  - **Learn:** due stripes (already done).

  And the strip above every room is a real, dimmed snapshot of the honeycomb exactly as you left it (an opaque scrim, no blur).
- **Why 10×:** the stem goes from a menu to a window. DS §2's promise is kept, and Home really is "underneath everything".
- **Connects:** Explore (daily cover), Train (`todayTrain`), Studio (saved palettes), and the honeycomb (snapshot).
- **Effort:** S. Spec in §6.
- **Honesty:** none.

### 3.5 ★ One map, stable addresses, learning as resolution (cross-listed: §4 ideas 24 and 25)
The single structural change that makes every other map idea work. It's listed here because it changes what Home *is*.

### 3.6 The first screen is the floor
- **What:**
  - Retire the paint-store wall and `how()`.
  - First launch shows the honeycomb itself, drifting (the opener of 3.1 plays over it). One line, *How many of these can you name?*, and one paper button.
  - The placement's first card *is* the explanation; there's no instruction screen.
- **Why:** you meet the app's real floor in second one. Show, don't tell.
- **Connects:** honeycomb, placement.
- **Effort:** S.
- **Risk:** none.

### 3.7 Fields as bubbles
- **What:**
  - After placement, one screen of seven bubbles: Paint, Screens, Interiors, Fashion, Film & photo, Print, Just to see. Pick any.
  - They become the Journey's interest strands and reorder Explore.
  - The color-vision question moves here too (it's currently asked on the first Train visit), and the stale ⋯ reference goes.
- **Connects:** Journey strands (L7), Explore For you, Train (CVD-fair drills), Studio (print → CMYK).
- **Effort:** S.
- **Risk:** CVD is "not a test or a diagnosis" (keep that line).

### 3.8 The day's first arrival
- **What:**
  - The first open each day doesn't resume where you left. It glides (one calm flight) to the neighborhood of today's first new word, and that bubble lifts once (the existing press-lift, no mark) as the map settles.
  - Every later open that day resumes where you left (HONEY_PAN).
- **Why:** Home quietly points at today without a caption island (X11).
- **Connects:** Journey (today's words), honeycomb (flight).
- **Effort:** S.
- **Risk:** must not feel like a pushy pulse. One lift, then still.

### 3.9 Hold-and-slide the stem
- **What:** press and hold the Rooms corner, slide up the curve, release on a room (like iOS long-press menus). One gesture, no second tap. The plain tap still works.
- **Why:** it feels like an instrument, and it's faster for daily use.
- **Connects:** rooms, haptics (a 4 ms tick per bubble).
- **Effort:** S.

### 3.10 Rooms reopen where you left them
- **What:** each room remembers its scroll and inner screen across sessions. Re-entering lands you there, with one quiet "Start of Explore ↑" link.
- **Connects:** Pinterest Back (N1), the router.
- **Effort:** S.

### 3.11 The search placeholder tells the truth
- **What:** the placeholder lists only what works today ("a color, a hex…"), and grows as each resolver ships ("…a painter, a decade").
- **Effort:** S.
- **Why:** the current "Monet" promise is a small lie at the most-used field.

### 3.12 Search history as a constellation
- **What:** recent searches and recently opened colors form a "Where you've been" set in View: your trail, laid on the map.
- **Connects:** Learner Model (`seen`), honeycomb, Cabinet.
- **Effort:** S.

### 3.13 Ask by photo from Home
- **What:** the search field has a camera button. A photo becomes a constellation on the map (Studio's pipeline), and the names you don't have yet are offered as tomorrow's words (panel moment 2).
- **Connects:** Studio, Journey, Learner Model, Camera.
- **Effort:** M.
- **Honesty:** "the camera guesses". White balance is untested on iPhone (Q8).

### 3.14 Map addresses you can share
- **What:**
  - `#/map/<slug>[/<set>][/z<zoom>]` opens Home centered on a color, inside a set, at a zoom.
  - "Share this view" lives in View.
  - A color page's crawlable copy links to its map address.
- **Connects:** router, L17 static pages, share cards.
- **Effort:** S.

### 3.15 Placement doubles as the first lesson
- **What:** the three placement misses closest to your estimated frontier become the first "Learn it" group, met right after the bloom ("Three you almost had").
- **Why:** the first lesson is *personal* and comes from your own confusions.
- **Connects:** Journey composer, Learner Model pairs, Learn it.
- **Effort:** S once 3.2 exists.

### 3.16 One Home control row, settled
- **What:** View becomes the DS §12 panel at last:
  - one huge count and a 9-detent scrubber;
  - three rows: Show, Look, Collection;
  - Settings, Backup and Retake placement at the end.
  - The engine sliders and lab link move to `#/lab/honey` only, after David picks a default from his ratings.
- **Connects:** honeycomb, Journey stages.
- **Effort:** S–M.

### 3.17 Stage labels that speak about you
- **What:** stage chips read "1 · 2 · 3 … 9 · Every name", and the one under your current stage gets a note, "you are here". Never "101" (X19). The count beside the scrubber is just "colors".
- **Effort:** S.

### 3.18 Landing from a room shows where you were
- **What:**
  - When a room shrinks back to the floor, the honeycomb settles exactly where you left it (already done).
  - If you opened a color *inside* a room (from a painting, say), Home glides to that color's address as the room shrinks, so the room's discovery lands on the map.
- **Connects:** every room, stable geography.
- **Effort:** S (after 4.24).

### 3.19 First-week hints that retire
- **What:**
  - Three one-time coach moments on the map: pinch, drop one color on another, pull down to search.
  - Each retires the first time you do it unprompted.
  - "swipe or tap" leaves the title for good.
- **Effort:** S.

### 3.20 Install nudge at the right moment
- **What:** move the Home Screen nudge to just after the first "Yours" confirmation (day 2), when there's a reason to come back.
- **Connects:** Learner Model, Learn.
- **Effort:** S.

### 3.21 A daily "seen today" line in Learn, written from the map
- **What:** "Yesterday you opened 6 colors on the map; 2 are new words." It turns browsing into a light retrieval cue the next day.
- **Connects:** Learner Model `seen`, Journey world steps.
- **Effort:** S.

### 3.22 Retake placement as a progress check
- **What:** retaking placement a month later shows *two* estimates side by side ("Oct: about 140 · Nov: about 310"). It's the only number in the app that measures delayed, unassisted knowledge of the whole vocabulary, which makes it the honest progress number (learning rule: progress = delayed recall, not XP).
- **Connects:** Journey, Learner Model, share card.
- **Effort:** S once 3.2 exists.
- **Honesty:** recognition ≠ naming. Keep the range.

---

## 4. Honeycomb 10×: 57 ideas in five groups (10 ★)

Format: **name** (effort): what · why it's 10× · connections · risk.

### 4A. Visuals: lenses, materials, light, motion, labels, beauty at 2,700

1. ★ **Semantic zoom: three altitudes** (M)
   - **Far:** family regions named on paper pills ("Blues", "Earths", "Violets"), with the lattice as one continuous color field.
   - **Mid:** names (today).
   - **Near:** when a bubble passes ~60% of the width, it shows its hex, and its six neighbors show *direction words* toward it ("darker", "greener", "duller").
   - **Why:** the zoom gesture becomes the depth gesture. Far view = orientation, near view = a lesson in how neighbors differ.
   - **Connects:** look-alikes (`pickWhy` / direction words), color pages, Learn it.
   - **Risk:** direction words must use the "brighter" fix (C16): say lighter or more vivid, never "brighter".

2. **Pinch into a color to open it** (S–M)
   - Keep pinching on the center bubble and it grows into its page under your fingers, the signature motion driven by the finger. Release early and it springs back.
   - **Why:** the most physical "a bubble becomes its page" possible.
   - **Connects:** `growFrom`, color pages.
   - **Risk:** must not fight zoom-out-stays (H10). Only past max zoom, only on the center bubble.

3. **Judge view** (S)
   - A Look option that puts the map on booth grey (#5F5F5F), with no vignette and no drift, for when you actually want to compare colors.
   - **Why:** DS principle 5 ("judge on grey") applied to the floor. Black surround inflates lightness and chroma.
   - **Connects:** Train, color pages' compare strip.
   - **Risk:** none.

4. **A color field at zoom-out** (S–M)
   - Seams scale with bubble size (`gapPx` today is fixed in pixels), so at 2,700 the far view reads as one smooth painting of all color, not confetti.
   - Above ~1,500 drawn, paint from a cached bitmap per zoom band.
   - **Why:** beauty at scale, and the true shape of color space becomes visible.
   - **Connects:** "Every name", Explore covers, share poster.
   - **Risk:** keep X16 (no gaps) and X17 (no overlap).

5. **Labels placed like a cartographer's** (S)
   - When names don't all fit, label an evenly spread subset (the farthest-point `rank` already exists), and fade the rest in as you zoom.
   - **Why:** no clutter, and every region is always readable.
   - **Connects:** `csRank`.
   - **Risk:** H22 still holds wherever there's room.

6. **Depth without tint** (S)
   - The center bubble gets a 1 px shadow ring *outside* its edge and a 2% lift. Never a highlight or sheen *on* the swatch.
   - **Why:** physicality without lying about the color.
   - **Risk:** never alter the fill.

7. **One motion grammar** (S)
   - Drift (exists) · tap ripple (exists) · set swap = glide (4.25) · stage change = bloom between (4.25) · search = flight with a mid-flight zoom-out (3.3) · open = grow · close = shrink.
   - Written into DS §8 as the only seven motions the map makes.
   - **Why:** the map feels like one instrument.
   - **Risk:** every motion obeys "no snapping".

8. **Rest state** (S)
   - After ~20 s untouched, drift slows to near stillness, and wakes on touch.
   - **Why:** calmer, and kinder to the battery.
   - **Connects:** H25 "alive", tuned.

9. **Poster export** (S–M)
   - Render the current view at 4K with a small caption ("Every name · 7,051 colors · ColorHub"), or a constellation ("Sargent · 37 paintings · as photographed").
   - **Connects:** the share-card renderer (L17), Cabinet.
   - **Risk:** keep painter sets honestly labeled.

10. **Dark-bubble care at scale** (S)
    - The L* < 26 hairline exists. Extend it to "near-twin" seams: two adjacent bubbles under ΔE 2 get the hairline too, so they stay separable at a glance.
    - **Why:** at 7,051, near-twins melt together.
    - **Connects:** the alias table (panel 2.3) flags true twins.

### 4B. Views and lenses that TEACH

11. **Lightness slice (extends panel L18)** (M)
    - A thin value scrubber on the right edge. The map shows only names within ±3 L* of the slice, laid out hue × chroma.
    - Scrubbing is an MRI through color space: "at this lightness, these are all the colors that exist".
    - **Why:** value is the painter's hardest skill, and this makes "same value, different hue" visible.
    - **Connects:** Train value stations, the squint key (L12), articles' "color measured".
    - **Risk:** none.

12. **Hue plane (extends panel L18)** (M)
    - One hue's lightness × chroma triangle: every name of that hue from navy to baby blue, grey to vivid. Yellow's plane is tall and peaks high, and blue's peaks low.
    - **Why:** it explains why dark yellow is olive and brown is dark orange.
    - **Connects:** the brown and olive articles, Train hue stations.

13. **Chroma rings** (S)
    - In the Wheel layout, faint concentric guides on the ground (not on bubbles) labeled *grey · muted · clear · vivid*.
    - **Why:** it teaches the missing word family (saturation) that every direction line uses.
    - **Connects:** C16 wording fix, lessons.

14. **Yours ↔ Everything (the X7-safe "map lit by what you know")** (S–M)
    - Swipe the title between two views.
    - Going to Yours, the bubbles that aren't yours drift outward off-screen and yours re-pack at the same relative geography. Going back, they return.
    - A third view, **Next**, shows only the next stage's new words.
    - **Why:** progress as territory, without marking or dimming a single bubble.
    - **Connects:** Journey, Learner Model, Cabinet.
    - **Risk:** this replaces the panel's L18 shading (X7).

15. **The century lens** (L)
    - A year scrubber from 1400 to 1950. The map holds the named colors that served as **accents** (`acc`, which is relative within each painting) in that era's paintings, ordered by how often.
    - The caption: "1660s · 820 paintings · as photographed".
    - **Why:** you watch history's palette change: vivid accents grow scarce in the dark decades and multiply in the 1870s–90s.
    - **Connects:** painter pages, Explore decades, article field notes.
    - **Risk: high.** The raw `byDecade.top` is all Ink and Bistre (varnish plus museum cameras). Ship only on the within-painting lens plus per-museum normalization (panel 2.4, L15). Show n, and never say "painters used".

16. **The archive lens** (M)
    - The set of names that cover ≥ 5% of ≥ 20 paintings, laid as a spiral by count (center = the most painted).
    - A long-press peek reads "in 1,204 paintings".
    - **Why:** "which colors does art actually use?" answered on the map.
    - **Connects:** color-page field notes, Explore.
    - **Risk:** "as photographed". Size stays with the fisheye, so order encodes the count.

17. **The word over time** (M–L)
    - A scrubber from 1800 to 2019. A name *enters* the map when its color sense becomes established in print, from Ngram `_ADJ` and first-recorded dates. You can watch the mauve family arrive after 1859.
    - **Why:** "a name is a lens", shown historically: people saw more as they named more.
    - **Connects:** Graph *first recorded* edges, articles, panel moment 5.
    - **Risk:** ambiguous words (rose, orange, amber, cream, salmon) are excluded or noted. Use the `_ADJ` series only.

18. **Standards and design history** (M)
    - Scrub through the years: RAL (1927), ISCC-NBS (1955), X11 (1987) and CSS (2001), Crayola by the year each name was added.
    - **Why:** the colors on your screen have a lineage, and this shows it.
    - **Connects:** hub pages (L7 list hubs), Explore.
    - **Risk:** brand hexes are screen approximations (say so). No trademarked palettes are reproduced as products.

19. **The origin lens** (M)
    - The map grouped by where names come from: pigments and minerals, nature, places, people, standards, commercial (the article tiers in MASTER-PLAN §3).
    - **Why:** you see that a huge share of color words are flowers, fruit and stones.
    - **Connects:** article tiers, Graph *named after* edges.
    - **Risk:** "origin undocumented" is its own honest group.

20. ★ **Your eye's map** (M–L)
    - The map as *your* eye resolves it.
    - Within each family, names closer together than your measured Train threshold merge into one bubble ("to your eye today, these 6 blues are one"). Families you see finely show every name.
    - As your thresholds drop, bubbles split apart.
    - **Why:** the most personal, truest picture of learning to see. It's also a reason to train.
    - **Connects:** Train eye profile (`famHits`, staircases), Learner Model, Journey ("late words wait for a finer eye", panel L5).
    - **Risk:** show n trials per family. With too few, show "not measured yet" rather than guessing.

21. **Mix-up threads view (extends panel moment 4)** (S once `lmPairs` exists)
    - Only your confusion pairs, laid out as pairs at their addresses. Tap a pair for its duel (4.52).
    - **Connects:** Learner Model, Train.

22. **Color-blind views** (S)
    - Run the whole map through protan, deutan or tritan simulation. Names that collapse into one visible color pile together: "to about 1 in 12 men, these 14 names look alike".
    - If your profile says CVD, offer the reverse: "the names you can tell apart".
    - **Why:** empathy for designers, and fairness for CVD users.
    - **Connects:** color pages' CVD sims (C15), profile, Studio palettes.
    - **Risk:** simulations are approximations, and the copy says so.

23. **Print gamut view** (M)
    - Names outside a typical print gamut gather into one outer ring: "these won't print as you see them".
    - **Connects:** print profile, Studio exports.
    - **Risk:** an approximate gamut hull. Say "typical coated paper, approximate".

### 4C. Distributions and layouts

24. ★ **Stable geography: one master map, torus-trained** (L)
    - Train a self-organizing map once, offline, of all ~7,051 names onto a **hex torus** (OKLab distances).
    - On a torus SOM *every* neighbor pair is similar in both directions, so it tiles seamlessly in both axes *legitimately*. "Seamless only where colors continue" becomes true by construction, and there's no mirrored duplicate.
    - Each name gets permanent coordinates (`data/map.json`, ~120 KB). Any set is placed by coarsening the master map: sort by master coordinates, then pack without gaps (the same sweep `honeyMap` already does, with master keys instead of LCh).
    - **Why:** a color finally has an address. Spatial memory, recall by position, constellations and search flights all depend on this.
    - **Connects:** every lens below, search (3.3), study modes (4E), painters (constellations).
    - **Risk:** small sets need the coarsening to stay gap-free (X16). Fall back to `honeyCluster` under 48.

25. ★ **Learning as resolution: the stage bloom** (M)
    - Moving from stage 3 to 4, the bubbles you had glide apart and the new names **bloom in the gaps between their nearest known neighbors**.
    - The same motion runs backward when you go down a stage, and it's the motion of the placement reveal (3.2).
    - **Why:** "a name is a lens" made literal. The map gets finer as you do.
    - **Connects:** Journey stages, View scrubber, onboarding.
    - **Risk:** no overlap mid-glide (X17). Moving bubbles shrink slightly through the middle of the tween, and new ones grow from 0. A screen-space version is buildable today (H3).

26. **Families as islands** (S)
    - A horizontal pager: one family per page at high resolution (all 600 greens), swipe to the next family. It's a browsing view, not a lesson (X22 is about lessons).
    - **Why:** the real skill is distinctions *within* a family.
    - **Connects:** Train family drills, Learn it groups.

27. **The learning spiral** (S)
    - A sunflower ordered by stage order instead of hue: the center holds the first words (red, orange, yellow…) and each ring outward is later.
    - Faint ground circles mark where each stage ends ("1 · 2 · 3 …"). They're guides on the ground, not marks on bubbles.
    - **Why:** you see your journey's shape and where you stand on it.
    - **Connects:** Journey, View stages, placement estimate.
    - **Risk:** the order is approximate until L15's `use` score.
    - **Buildable today** (H5).

28. **By rarity** (S)
    - The same spiral ordered by how common the word is (Ngram color sense plus naming sources), from "red" in the middle out to "Isabelline" at the rim.
    - **Connects:** Graph, articles ("rarest" superlatives from L6).
    - **Risk:** frequency of the color *sense* only.

29. **The timeline ribbon** (M)
    - A horizontally scrolling honeycomb band: x = year first recorded, y = lightness. Swipe through 400 years of color words.
    - **Connects:** Graph *first recorded*, articles.
    - **Risk:** dates only where sourced. Otherwise the name sits in an "undated" coda.

30. **The sphere done right** (M)
    - Runge's sphere with an even Fibonacci spread and true chroma depth.
    - Tap the equator to **cut it open** and see the greys inside, which doubles as the lightness slice in 3D.
    - **Connects:** Runge history (an article), 4.11.
    - **Risk:** stays in the lab until it encodes the axes clearly (panel cut Globe as decoration).

31. **True proportions** (M)
    - Bubble area by how much of color space a name "owns" (its OKLab Voronoi volume): lonely names are big, crowded names small.
    - **Why:** you see where cultures bothered to make fine distinctions (pinks, browns) and where they didn't.
    - **Connects:** naming sources, articles.
    - **Risk:** depends on which name lists are included (say which). It's a Look option with the lens off, since the fisheye owns size.

32. ★ **Constellations at their addresses** (M, extends panel L18 overlay)
    - Any set (a painting, a painter, a photo, a poem, a flower, a decade) lands at its stable addresses. The rest of the map **flies outward** (no dimming), and the set's names re-pack in place.
    - **Compare two:** two constellations share the screen. Colors in both sit in the middle, and each set's own colors sit on its side.
    - **Why:** you see *where* a painting lives in color space, and how two painters differ, at a glance.
    - **Connects:** painters, painting pages, Studio photos, Cabinet, Explore.
    - **Risk:** "as photographed". Close, never influenced (panel §8).

33. **Spread by your taste** (S)
    - Order the map by the taste model's utility (Studio's taste engine): the colors you're drawn to sit in the middle, and the ones you avoid at the rim.
    - **Connects:** `tastemodel.js`, Studio.
    - **Risk:** "from 20 taps" is shown on screen, and it claims nothing about personality.

34. **The poem map** (M)
    - A poem's color words, as a constellation in reading order (a path from the first color word to the last).
    - **Connects:** poems (11,440), articles' "In words".
    - **Risk:** only real color words, and ambiguous words are skipped.

35. **Your photo roll as a galaxy** (M)
    - All your saved photos' palettes merged into one constellation, sized by how often each name recurs: "your camera roll lives in greens and warm greys".
    - **Connects:** Studio photos, Cabinet, panel moment 1 (twin painting).
    - **Risk:** local only, and private by default.

### 4D. Functionality

36. ★ **Search that flies and understands** (M; core buildable today)
    - Resolves:
      - hex and RGB;
      - names and aliases;
      - modifiers ("dusty pink" → base + shift → nearest name);
      - painters (their signature colors as a constellation);
      - decades;
      - "between A and B" (the road);
      - a photo.
    - A color result is a flight with a mid-zoom-out. A set result is a constellation.
    - **Connects:** Graph, painters, `groups.json`, Studio, Train.
    - **Risk:** "≈" for resolved modifiers, and "as photographed" on painters and decades.

37. ★ **Drop one color on another** (M)
    - Long-press lifts a bubble (the peek stays on a plain release). Drag it onto another bubble and you get:
      - the two side by side on booth grey;
      - the direction line ("Petrol is darker and greener than teal");
      - ΔE;
      - **the road between them** (the named colors along the OKLab line, in order);
      - "Learn the pair" (a 2-minute duel);
      - "Paintings with both".
    - **Why:** comparison is *the* act of seeing, and here it's one physical gesture on the map.
    - **Connects:** Learn it, Train (the road becomes an ordering board), painters (co-occurrence), Learner Model (logs the pair you checked).
    - **Risk:** "paintings with both" is as photographed, with support ≥ 10.

38. **Collect mode: hearts and runs (the queued favorites lane)** (M, coordinate)
    - Tap to heart. Drag across a run to select a gradient.
    - The selection *is a ColorSet* (panel 2.2), so it gets every verb: save, learn, play, palette, share.
    - **Connects:** Cabinet, Studio, Journey.
    - **Risk:** this file owns no code in that lane. It only asks that the selection become a set.

39. **Palette by touch** (S on top of 38)
    - In Collect mode a paper tray holds the chips, with a live readout: the interval words (panel L13's "neighbor · third · complement" plus value steps) and the minimum ΔE between chips ("all distinct").
    - "Make palette" sends the tray to Studio.
    - **Connects:** Studio palette engine, Train interval vocabulary.

40. **On the map, from anywhere** (S–M; buildable today for paintings)
    - Every painting, painter, photo, poem, flower and gem page gets one quiet "On the map" icon. It lands on Home as a constellation, and Back returns you to the page.
    - **Connects:** painters, Studio, Explore, the router.

41. **Live viewfinder** (M)
    - A search mode where the camera's center sample steers the map in real time: the map flies to the nearest name as you sweep the room.
    - In study mode it waits for you to name the color first (panel moment 7).
    - **Connects:** Camera, Learner Model.
    - **Risk:** white balance (Q8). It counts toward Yours only when you named it first.

42. **Places** (S)
    - Save a map view (set, center, zoom) as a named place ("My blues", "Sargent's darks"). Places live in View, one tap away.
    - **Connects:** Cabinet drawers, share addresses (3.14).

43. **Two-finger ruler** (S–M)
    - Rest two fingers on two bubbles and a thin line appears between them, labeled with ΔE and the direction words. Lift and it's gone.
    - **Why:** the quickest possible "how different are these?"
    - **Connects:** look-alikes, Train thresholds ("you can see this: your blue threshold is 2.2", panel L5).
    - **Risk:** must not collide with pinch. Trigger only when both fingers are still on bubbles for 300 ms.

44. **Wander** (M)
    - The dice, made meaningful. A slow guided flight through 6–7 colors linked by graph edges (named after → same pigment → paired with), with one caption line each. A 60-second documentary on the map.
    - **Connects:** Graph, articles, painters.
    - **Risk:** captions come from fact cards only.

45. **Where you've been** (S)
    - The last 30 opened colors as a set (also 3.12).
    - **Connects:** Learner Model `seen`.

46. **Map addresses** (S)
    - Covered in 3.14.

47. **Center readout on demand** (S)
    - A long-press on empty ground (or a two-finger tap) shows the center color's codes for 2 s in a solid pill at the bottom. It never shows otherwise (X11 stays).
    - **Connects:** codes on color pages.

### 4E. Studying on the map

(Each of these is an explicit *session* with its own start and end. When it ends, the map returns to its normal, unmarked state. That's how they stay X7-safe.)

48. ★ **Find it** (M; buildable today)
    - The map's names hide for the round; every bubble stays full color.
    - A paper card says *Find teal*. You pan and tap.
    - Neighbors are same-family by construction, so the product rule "wrong options are same-family neighbors" comes free.
    - A miss names what you tapped ("That's petrol") and glides to the answer.
    - **Why:** spatial memory (method of loci) plus recognition, on the app's own floor.
    - **Connects:** Learner Model (`pick_wrong` with `as`), Journey reviews, stable geography.
    - **Risk:** only targets whose nearby bubbles are ≥ 6 ΔE away (a solvability gate).

49. ★ **Name the glowing bubble** (M; buildable today)
    - One bubble gets the DS feedback ring *outside* its edge (no dimming of anything else) and its name hidden.
    - You recall the name, then answer by Say it, typing, or picking from its *physical neighbors'* names.
    - **Why:** recall before reveal, anchored in place, and it counts toward Yours under the delayed rule.
    - **Connects:** `produce.js` (Say it), `pickit.js`, Learner Model, Journey.
    - **Risk:** honest counting. A pick counts like a Pick-it check; a recall typed or said counts like Say it.

50. **Fog of names (the X7-safe "fog of war")** (M)
    - Inside a Study session only, names you haven't met are hidden. Bubbles stay full color.
    - Each correct recall *inks* the name back onto its bubble with a small write-on animation.
    - The session ends and every name returns.
    - **Why:** the thrill of filling in a map, without ever dimming the Home map.
    - **Connects:** Journey, Learner Model.
    - **Risk:** needs David's OK. It's the closest any idea here comes to X7, and it's allowed only because it's a timed session, not the resting map.

51. ★ **Light up five** (M)
    - Every day, five unmet names that sit *between* colors you already own (`lmEdge`) become a route on the map.
    - Fly to each and meet it: its name, plus how it differs from its known neighbor. A Find it round closes the session.
    - Tomorrow, after a night's sleep, they're recalled.
    - **Why:** new words always arrive anchored to known places, which is the best-supported way to grow a vocabulary.
    - **Connects:** Journey (new words), Learner Model, Cabinet (cards unlock on meeting).
    - **Risk:** it must *be* the Journey's daily new words (one composer), not a second path. Otherwise it breaks "one clear learning path".

52. **Confusion duel on the map** (M)
    - The map zooms to your worst mix-up pair, which usually sits side by side. Then rapid "which is teal?" taps on the two with names hidden, then a walk of the road between them.
    - **Connects:** `lmPairs`, Train odd one out, Learn it's Tell apart.

53. **Blind walk (recall by position)** (S after 48)
    - Every visible name is hidden. Tap any bubble, say its name, then tap again to check. A memory-palace self-test.
    - **Connects:** Learner Model, stable geography (it only works once addresses are stable).

54. **Map routes (a Train station)** (M)
    - Drag one path from the lightest to the darkest of five glowing bubbles. Ordering is thinky, so it lives in Train, per the product rule.
    - **Connects:** Train, value skills.

55. **Neighborhood run** (M)
    - Pick a region. You have 90 seconds to name every bubble in view. Clearing it earns that region's share card (no mark on the map).
    - **Connects:** Cabinet, Journey stage exams.

56. **Review on the map** (M)
    - An *option* for the daily review: fly to each due color with its name hidden, recall, reveal. The swipe deck stays the core loop, and this is a second way in.
    - **Connects:** Learn, spaced review.
    - **Risk:** recall before reveal, same scheduler.

57. **Daily Find-it sprint** (S after 48)
    - The same seeded list of 10 for everyone each day, 60 seconds, with a shareable grid (`challenge.js` seed and share).
    - **Connects:** challenge, share card.
    - **Risk:** a stable map is required, or the seed isn't the same board for everyone.

**The 10 ★:**

| # | Idea |
|---|---|
| 1 | Semantic zoom |
| 20 | Your eye's map |
| 24 | Stable geography (torus SOM) |
| 25 | Learning as resolution (stage bloom) |
| 32 | Constellations at their addresses |
| 36 | Search that flies |
| 37 | Drop one color on another |
| 48 | Find it |
| 49 | Name the glowing bubble |
| 51 | Light up five |

### 4F. Honeycomb: buildable today (5 specs, each under 4 hours)

**H1. Family names at far zoom (semantic zoom, level 1).** About 2 h, all in `js/honey.js`.
- **Normalize:**
  - In `honeyNorm`, add `fam: setFamily(o.h)` (`setFamily` lives in `colorsets.js` and is loaded globally before honey runs; otherwise inline its 8 lines as `honeyFam`).
- **Draw** (in `finishFrame`, after the bubble loop):
  - Run only when the median drawn `d` is under `zc("labelMin")`, i.e. when names are hidden.
  - Bin the drawn bubbles in the central 80% of the screen by family, using a coarse 3 × 4 screen grid so that repeated copies of a family form separate bins.
  - For each family, keep the one bin with ≥ 12 bubbles nearest the screen center, and take its centroid.
  - Draw a paper pill there: fill `#EFEBE3`, text `#141311`, Instrument Serif 18 px, radius 999, 10 px horizontal padding.
- **Fade:**
  - Alpha = `1 - la` of the median bubble, so family names fade out exactly as the bubble names fade in. Nothing snaps.
- **Cost:**
  - One pass over ≤ 3,000 drawn bubbles. Cache the result while `!down && !anim`.
- **Shots:**
  - `#shot=honey:current:1000:out` and `#shot=home` at stage 9 zoomed out.
  - Check that pills never overlap each other (drop the smaller family's pill if two would).

**H2. Study the map: Find it + Name the glowing bubble.** About 4 h. New `js/mapstudy.js`, a tiny `honey.js` addition, and one router line.
- **Entry:**
  - A row "Study the map" in the View panel's Show tab.
  - A `ROUTED` line `#/study/map` with an `openRoute` case.
- **Engine addition** (`honey.js`):
  - `opts.ring` (an item, or null), plus `ctrl.ring(item)`.
  - In `finishFrame`, stroke a 3 px paper ring at a 3 px offset around that item's bubble (the DS §3 feedback ring: outside the swatch, never over it).
  - Hiding names needs no engine change: `ctrl.tweak({ labelMin: 9999 })`.
- **Session** (`mapStudy()`):
  - Build a honeycomb of the current Home set with `pick` intercepted: taps answer the question and never open pages.
  - Run 10 rounds, alternating Find it and Name it.
  - **Target choice:** prefer cards in review (`S.cards`, not `isMine`), then met colors, then random.
  - **Solvability gate:** skip a target if any bubble within 2 lattice steps is under `PICK_GAP` (6 ΔE) from it.
  - **Find it:**
    - A bottom paper card reads "Find *teal*".
    - Right: ring the bubble, `buzz(12)`, and write its name for 1 s.
    - Wrong: show the tapped bubble's name for 1.2 s, then glide to the answer (`ctrl.update({ focus, soft: true })`) and ring it.
  - **Name it:**
    - Glide a target to center and ring it.
    - Offer four paper buttons: the answer plus three names from `pickNear(c, currentItems)`.
    - The options appear only after a 1.5 s "think first" beat, so recall happens before recognition.
- **Logging:**
  - Use `pickOwn(st, ok, "pick", today())` only when the card exists and `st.since < today()`. That's the same honesty rule as Pick-it checks.
  - Wrong answers append `{c, as, surf: "map"}` to `S.lmPending` (or `lmLog` once L19 lands).
- **End:**
  - "8 of 10", with misses shown as pairs (the chip pair plus `pickWhy`).
  - "Done" shrinks back to the map. Names return, and the ring clears.
- **Tests and shots:**
  - Add a `#shot=study:find` hook.
  - Screenshot a right answer, a wrong answer and the end screen at 375 × 812.

**H3. The stage glide (screen-space version of the resolution bloom).** About 3 h, in `js/honey.js` `setItems`.
- **Record:**
  - On `update({ items, soft: true })` with a flat layout before and after, record `oldPos = Map(name → {x, y, d})` from the current `drawn`.
- **Tween** (after the new layout and the first `build*Drawn`), for 450 ms with `honeyEaseS`:
  - **Kept items:** interpolate x and y from old to new, with the diameter multiplied by `1 - .15·sin(πu)`. That's a slight shrink mid-flight, so moving bubbles never overlap (X17).
  - **New items:** grow from 0 starting at u = .3, the bloom between.
  - **Removed items:** shrink to 0 over the first 250 ms.
- **Replaces and keeps:**
  - It replaces the ghost crossfade on this path only.
  - Reduced Motion keeps the crossfade.
- **Used by:** stage changes in View, Yours ↔ Everything (4.14) and the placement reveal (3.2).
- **QA:** run the existing overlap check (`#shot=honey:…:overlap`) at u = .25, .5 and .75.

**H4. On the map, for any painting.** About 2.5 h. `js/home.js`, `js/gallery.js` `glPage`, `js/explore.js` `paintingPage` and `js/router.js`.
- **Home** (`home.js`):
  - `hmHome(opts)` accepts `opts.temp = { title, items, back }`: a one-shot source that is never saved to `S.hm`.
  - `render()` uses `temp.items` when present.
  - The title shows `temp.title`.
  - A small paper "✕" in the title clears it back to the saved view.
- **Items:**
  - The painting's six measured colors (from `data/gallery/index.bin`, already loaded on painting pages), named with `nameOf`.
  - De-duplicate by name, add the shares, and order by share.
  - Under 48 colors, the existing `honeyCluster` makes one compact cluster. No new layout.
- **Entry:**
  - A quiet icon button "On the map" on `glPage` and `paintingPage`, sitting beside the existing palette.
- **Title:**
  - "*Water Lilies* · 6 named colors · as photographed".
  - Bubbles open their pages as usual. Back returns to the painting through `XSTACK` with `X_ROOT = "painting"`.
- **Router:** `#/map/painting/<i>`.
- **Next step:** once 4.24 lands, the same call places them at their stable addresses with "Show among all".

**H5. The learning spiral layout.** About 1.5–2 h, in `js/honey.js` and `js/home.js`.
- **Layout** (`honey.js`):
  - `honeySpiral(items)`, a copy of `honeySunflower` that sorts by `it.o.rank` (ascending; missing rank goes last) instead of hue.
  - Add `"spiral"` to `honeyLayout` and to the back-compat layout list, and mark it finite.
- **Ground circles:**
  - After the bubble loop, when `cfg.layout === "spiral"`, draw a 1 px `rgba(236,232,223,.12)` circle at the radius where each stage ends: radius of index `HM_STAGES[k]` = `.56·√(n)` in lattice units, mapped through the lens.
  - Label each one at its right end in `note` style: "1", "2", "3"…
  - These sit on the ground, between bubbles, never on them (X7).
- **Items** (`home.js`):
  - `hmStageItems` passes `rank` through (`{ n, h, c, rank: e.rank }`).
- **Look panel:**
  - Add one Look chip, "Spiral", as a layout choice (Look, not Show: H19).
- **Shot:** stage 9 in Spiral at 375 × 812, checking that every stage ring falls in a seam.

---

## 5. Kill list (surface that doesn't add seeing)

1. **The welcome paint-store wall and its copy.**
   - "Learn them a family at a time" contradicts X22.
   - Uppercase "COLORHUB" and "· 60 SEC" break DS §4.
   - Replace it with the floor (3.6) and the opener (3.1).
2. **`how()`, the instruction screen.** The first placement card teaches by doing.
3. **"Lesson colors" in View, the 101 hard-code in stage 3 (`n === 100 ? 101 : n`), and its "101" chip.** X19. Stage 3 becomes 100, like every other round number.
4. **Developer controls in the user's View.**
   - "Rate every preset (honeycomb lab) →", "Copy settings", and the Center size / Gap / Shape / Alive sliders.
   - Move them to `#/lab/honey` once David picks a default from his ratings.
   - Look becomes the DS §12 version: two picture tiles, one strength slider, Map or Wheel.
5. **The Sources group in View** (Japanese, Werner, Ridgway, RAL, xkcd, Web colors). These are reading, not viewing, so they move to Explore hubs, where each gets its story.
6. **The 16 fake floor-peek bars.** Replace them with the real snapshot (§6, B2).
7. **The identical rainbow conics for Train and Studio**, and the generic stem notes (B2).
8. **"swipe or tap" in the Home title.** It's a permanent instruction. Hints should retire (3.19).
9. **The "Every shade" stop code path** while `shades.json` holds only 108 shades. Bring it back with real Maerz & Paul / Ridgway shades (H11).
10. **Globe on Home** until it encodes the axes (4.30). The panel agrees.
11. **Round-1 proposals that break X7 on the honeycomb:** L18 "Your map" shading and L12 relation marks *on bubbles*. Keep the relation mark on chips elsewhere. On the map, use 4.14 and the study sessions.
12. **The profile screen's "⋯ menu" line.** That menu no longer exists.
13. **The placement result's tier name and uppercase eyebrow** ("Your starting point · *In-betweens*"). Replace them with the estimate (3.2).

---

## 6. The first-60-seconds wow, and the 3 buildable-today items for the area

### The wow (one continuous minute)

| Time | What happens |
|---|---|
| 0–10 s | **A word splits the blue** (3.1). A real sky from the archive, captioned *Blue*, then four named colors draw out to where they sit. *Every name is a new way to see.* |
| 10–15 s | The painting shrinks into one bubble and the honeycomb drifts in around it (the floor, 3.6). *How many of these can you name?* One paper button. |
| 15–50 s | Placement: 20 quick picks across the 1,000-name order, with same-family options (3.2). |
| 50–60 s | **"You can pick about 140 of the 1,000 names, give or take 30."** Then the map shows your ~140 and **blooms** (H3) out to all 1,000 as the new names open between yours. *About 860 to learn. Here are your first three*, the near-misses (3.15). |

The user leaves the first minute having *seen* something they couldn't before, holding an honest number about themselves, and looking at the whole territory they're about to learn.

### B1. Placement 2.0: the vocabulary estimate and the bloom (about 3.5 h)
- **Files:** `js/pickit.js` (new `placeSize()`), `js/learn.js` (`welcome` → straight into `placeSize`; `placed()` result), `js/home.js` (one-shot intro), `tools/pickit_test.js`.
- **Items:**
  - After `loadCoreNames()`, bin `CORE_NAMES` by `rank` into 10 bands of 100, and take 2 random names per band (20 items, easy bands first).
  - **Options:** `pickNear(c, CORE_NAMES)` (same family, ≥ 6 ΔE apart). Rendered with `pickBoard(card, c, { opts, tag: "Which is it?" })`.
  - 60 s timer (`PLACE_SECS`). If time runs out, unanswered bands count as unknown, and the result says so.
- **Estimate:**
  - Per band, `p = right / asked`, then `p* = max(0, (p − .25) / .75)` (correction for guessing among four).
  - `est = Σ p*·100`.
  - The range comes from 200 bootstrap resamples of the 20 answers (2.5th–97.5th percentile), rounded to 10.
  - Store `S.vocab = { est, lo, hi, at, ans: [{ n, ok, as }] }`. This is additive and needs a `migrateState` step (bump `STATE_V`).
  - The wrong picks' `as` values seed the Learner Model's first confusion pairs.
- **Tier (keeps the current path working):**
  - `pass2 = p*` averaged over bands 1–2 ≥ .75 → tier 3 and `placeSkip(2)` as today. Otherwise tier 2.
  - `S.placed` is unchanged in shape.
- **Result screen:**
  - "about **140**" in the `display` style (72 px serif), with the `note` "of the 1,000 names, give or take 30".
  - The 20 chips with ✓/✕ (the existing `.chips`).
  - One `small` line: "Measured by picking among four close colors. Naming them comes next."
  - Primary: **See them on the map**.
- **Bloom:**
  - `hmHome({ intro: S.vocab })` first renders `stage:<smallest stage ≥ est>`.
  - After 1.2 s it calls `ctrl.update({ items: hmStageItems(1000), soft: true })`, which uses the H3 glide if merged, or the crossfade otherwise.
  - It shows `toast("About 860 to learn")`.
  - The intro never repeats (`S.vocab.shown = true`).
- **Tests:** in `pickit_test.js`, all right gives ≈ 1,000; all wrong gives 0; 25% random over 1,000 simulations has a mean under 60; the range always contains `est`.
- **Honesty:** the copy never says "you know"; it says "you can pick". No population comparison.

### B2. Live stem bubbles and the real floor (about 2 h)
- **Files:** `js/core.js` (`roomsBubbleArt`, `roomsNote`, `roomChrome`, `toggleStem`), `js/home.js`, `css/` (rooms).
- **Explore bubble:**
  - Today's painting, using the same daily pick as Explore's Art cover. If no shared function exists, add `todayPainting()` = `PAINTINGS[hash(today()) % PAINTINGS.length]` (`paintings.js` is in index.html already).
  - Render it as an `<img>` with `object-fit: cover` inside `.rm-art`.
  - Note: the short title ("Hokusai, *The Great Wave*").
- **Train bubble:**
  - `todayTrain().art` (the station tile HTML), scaled to fill.
  - Note: `${what}`, plus the level when known ("Odd one out · level 9").
- **Studio bubble:**
  - The last saved palette's colors as stripes (from `S.palettes`; read the newest).
  - Note: "Your last palette · 5 colors". If there's none, show the gamut wheel and "Make a palette from a photo".
- **Real floor:**
  - On Home, `hmHome` sets `window.HM_SNAP = () => downscale(canvas, 390 wide).toDataURL("image/jpeg", .7)`.
  - `toggleStem` and `pick()` call it into `ROOM_FLOOR_IMG` just before leaving the floor.
  - `roomChrome` renders the peek strip as `background-image` positioned to the bottom of that snapshot, under a solid `var(--scrim)` overlay (no blur, X10). It falls back to the bars if there's no snapshot.
  - The canvas holds only drawn shapes, so it isn't tainted.
- **Shots:** `#shot=home:rooms`, plus a room with the peek, at 375 × 812.

### B3. Search 2.0: pull down, fly, and understand (about 3.5 h)
- **Files:** `js/home.js`, one small data file, and one line in `tools/analyze.py`.
- **Gesture:**
  - A pull-down that starts in the top 100 px of Home opens `#hmSearch`, focused.
  - It reuses the swipe-up edge code (`EDGE`), mirrored.
  - View's magnifier stays as the second way in.
- **Resolver** (`hmResolve(q)`), in order:
  1. **Hex or rgb():** fly to the nearest name (`nameOf`) via `ctrl.update({ items, focus, soft: true })`.
  2. **One strong name or alias hit** (`searchColors` returns one match, or the exact name): fly. Several hits filter, as today.
  3. **Modifiers:**
     - Recognize the leading words pale, light, dark, deep, dusty, muted, greyish, bright→vivid, warm and cool.
     - Each is a fixed Lab shift (for example dusty: C × .6; pale: L + 15, C × .5; deep: L − 12, C × 1.15; warm/cool: rotate hue 15° toward 60° or 250°).
     - Apply it to the resolved base name to get a target hex, fly to its nearest name, and `toast("dusty pink ≈ Ash rose")`.
  4. **Decade** (`/^(1[3-9]\d0)s?$/`):
     - Take `groups.json` `byDecade[d].distinctive` names, mapped through `BYNAME` or the library to items.
     - Temp source (as in H4) titled "1660s · 820 paintings · as photographed".
  5. **Painter:**
     - A new `data/analysis/artists/index.json` (`[{ slug, name, n }]`, about 40 KB, written by a few lines at the end of `tools/analyze.py`; regenerate it there).
     - Fuzzy-match the painter's name, fetch `artists/<slug>.json`, and build a temp set from `signature` plus cluster colors.
     - Title: "Sargent · 37 paintings · as photographed". Painters with n < 15 add the note "few paintings".
  6. **Otherwise:** filter, as today.
- **Placeholder:** "a color, a hex, a painter, a decade…" (truthful once 4 and 5 ship).
- **Shots:** "dusty pink", "1660s" and "Sargent" at 375 × 812.

**Ship order for the area:** B2 (smallest, visible on every room trip), then H1 and H5 (map wayfinding), then B1 with H3 (the first-minute wow), then B3, H4 and H2. Every one of them runs `colorhub-verify` (the checks, the undefined-name scan, smoke, and 375 × 812 shots) before the report.
