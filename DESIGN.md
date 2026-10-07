# ColorHub design log

The design is built from proven decisions in real products, not invented from scratch. Each choice below names its source.

## The big idea
**The color is the interface.** Every screen gives the swatch as much room as possible and keeps everything else neutral grey.

## Decisions and sources

| Decision | Source | Why |
|---|---|---|
| Surround: a neutral mid-grey (`#5F5F5F`, L\* 40) wherever a swatch is judged (the flashcard deck, meet-the-unit pages, the color of the day, every Train drill and the screen check); the warm near-black (`#0E0D0B`) everywhere else. No colored UI near a swatch. No film grain over test swatches. | The photographer's grey card and the painter's mid-grey ground; the ISO 3664 viewing standard (a neutral surround); photo editors such as Lightroom and Photoshop, which offer a medium-grey surround for judging color | A color is judged against what surrounds it (simultaneous contrast), and lightness most of all. On near-black, browns and olives read lighter and brighter than they are (brown only looks brown next to something lighter) and pale colors glare. A neutral grey near the middle of the lightness range pushes no hue and lets dark and light colors read as themselves. L\* 40 rather than 50 so the captions stay readable (light text at 5:1 or better). The warm black stays for the editorial screens, where nothing is being judged. Rules live in `css/booth.css`. |
| Swipe card with tilt, a "Got it / Again" stamp, and ✕ / ✓ buttons | Tinder | Everyone already knows the gesture. It's fast and thumb-driven, and it's the core loop. |
| The next card grows as you drag the top one away | Tinder | The deck feels physical, and the next color is already arriving. |
| Revealed card turns into a paint chip: color on top, a paper label with the name and hex below | Pantone chips, paint-store sample cards | You keep seeing the color while you read its name. It looks like a real swatch. |
| Color names set in a serif (Instrument Serif); hex codes in a mono font | Farrow & Ball and Pantone print cards (serif names); developer tools (mono codes) | The serif feels editorial and premium. Mono sets codes apart. |
| A drag before the reveal barely moves the card and asks you to tap first | Anki's rule: no grading before you see the answer | Recall before reveal: you can't swipe a card you haven't tried. |
| Reverse cards: the name first, then the color floods in from where you tapped | iOS tap ripple, Material ink ripple | Reverse recall (name to color) feels like paint landing. |
| A segmented progress bar where each segment fills with its card's color once you know it | Instagram Stories | Progress you can read at a glance. A finished unit becomes its palette. |
| A 60-second draining timer bar for placement | Instagram Stories, quiz apps | Placement stays short and low-stakes. |
| "Meet the unit" as a full-screen vertical pager | TikTok, Instagram Reels | One color per screen, swipe up. No menus. |
| Each color shown beside its nearest neighbor | Paint-store chip strips, teaching by contrast | Words are learned at their boundaries: teal only means something next to turquoise. |
| Unit cover as a fanned deck of paint strips, light to dark | Pantone Formula Guide fan deck | Shows the whole family at once and sets the theme. |
| Today: one primary card (review, else the next unit) with the screen's only filled button, then "Today's three" (daily challenge · color of the day · one suggested Train station) as equal quiet tiles with a done dot, then the collection quilt | Duolingo's single path; Apple Fitness's three rings (same weight, done or not at a glance) | One clear path, reachable by thumb. The daily extras are visible but never compete with it. |
| Show before asking: welcome, then straight to the placement deck; the two profile questions wait until the first visit to Train (and live in the ⋯ menu) | Apple onboarding guidance (value first, permissions in context) | The first real color is on screen two taps in. Nobody answers a form before seeing the product. |
| Every tab opens with the same line: brand left, the tab's actions and the ⋯ menu right. Every inner screen: back (or close, for a task) left, title centered, optional action right | iOS navigation bars | Settings are reachable from anywhere, always in the same corner. |
| Motion signature: wherever a color opens, its chip grows into the new page's swatch (under 400 ms; off with Reduce Motion) | iOS app-launch zoom, Material container transform | The color you tapped is the color you land on; the transition says "this is the same thing, bigger". |
| Path track: one segment per unit, filled with that unit's gradient once done | Duolingo path, GitHub contribution graph | Shows where you are without opening a menu. |
| Welcome screen: a wall of every color sorted into strips by hue | Paint-store chip walls | The product's promise in one image. |
| Add to Home Screen, fullscreen, safe-area aware | iOS web apps (ALTER uses the same setup) | Most use is on David's phone. |

## What we left out on purpose
- No XP, coins or streak flames. Progress is a number of names **owned**: recalled right a day or more after learning (learning-kb rule).
- No light mode. The surround is chosen for seeing color: mid-grey where a color is judged, warm near-black elsewhere.
- No colored backgrounds behind swatches, for the same reason.

## Color accuracy (2026-10-07)
- **Scores measure what was drawn.** Drills build colors in Lab, but the screen shows 8-bit hex codes; every drill and the daily challenge measures ΔE00 (or ΔL\*) between the hex codes actually shown, logs that, and redraws a pair that rounding collapsed below about one code step (`js/accuracy.js`).
- **Screen check.** Before the first Train session and the first weekly check-in: brightness up, Night Shift and True Tone off, two quick visual tests. A chip on the check-in card stays until it's confirmed.
- **Honest labels.** CMYK is marked rough (no print profile); paint people see CIELAB LCh, not a fake Munsell. Harmony says CIELAB hue, the gamut wheel says OKLab hue. The color-blind setting is a simple adjustment, not a simulation.

## Tunables worth testing on David's phone
- Card corner radius (30px), stamp angle (±10°), and swipe threshold (100px, or a fast flick past 36px).
- The color-opening morph (360 ms, `runMorph` in core.js) and the dimming of done tiles in "Today's three" (`.tday.done`, 55%).
- Booth grey (`css/booth.css`, now `#5F5F5F`): try L\* 40 to 50 on the phone; lighter shows browns best, darker keeps text readable.

## Feature hierarchy: many features, never a mess (David, 2026-10-07)
ColorHub can have a lot of features. It must never feel like a lot. Every feature gets a tier, and the tier decides where it lives and how loud it is.

| Tier | What | Where it shows | How loud |
|---|---|---|---|
| 1. The daily loop | Today's review or next unit, the daily challenge, the color of the day | Top of Today | The one filled button on the screen |
| 2. The four jobs | Learn (Today), Train, Explore, Studio | The tab bar | One tab each; never a fifth tab |
| 3. Tools and modes | Gym stations, Studio tools, Explore views, taste tests | Inside their tab, as tiles | Quiet tiles; at most about 5 above the fold, the rest under "More" |
| 4. Depth | Options, extra layers, nerd data (other color systems, sources) | Inside a tool, behind a chip, a sheet or a long press | Off by default |

Rules:
1. **One primary action per screen.** One filled button; everything else is quiet.
2. **A new feature needs a home, not a menu item.** Before building, name its goal (one of the four), its tab, its tier, and its one-sentence purpose. If it can't name all four, it waits.
3. **Defaults over options.** Every tool opens already doing something good. Options are collapsed chips.
4. **The app grows with you.** Tools unlock as progress makes them meaningful (stations by level, Studio tools after the first palette). A new thing gets a small "New" tag once, then none.
5. **Today is the curator.** New or seasonal features are introduced by appearing once on Today, not by adding entry points.
6. **Same thing, same look.** One card style per kind: tool tile, station tile, reading pin, daily card. One header pattern for every inner screen: back on the left, title in the middle.
7. **Two levels deep at most** from a tab, and every inner screen has a way straight back to its tab.
8. **Profile reorders, never hides.** A painter sees paint things first; a designer sees codes first; nobody loses anything.
9. **Prune.** If a tile is rarely opened, it moves under "More" or merges into another tool.

## The honeycomb as the home screen (built 2026-10-08, ROADMAP.md §12)
The Today tab now opens on the full-screen honeycomb (js/home.js), not the flat Today list: the color is the
interface, taken to its limit. Chrome (the title/search/camera/dice row) fades while you drag and returns on a
tap or a pause; the honeycomb itself stays pure (true colors, no rings, no dimming — judging a color needs to see
it plainly). The title is also the progress switch: tap for every set (reusing js/colorsets.js's COLOR_SETS,
extended with three honest, S.cards-driven views — Learned, Learning, Not met yet), or swipe it sideways to flick
between the four views David asked for. A bottom sheet, always reachable by its handle, holds the rest: pulled up
partway it's the old Today card (Continue, Challenge, today's color, a Train suggestion); pulled all the way it's
four doors to Learn (the classic Today screen), Train, Explore and Studio. Tapping a bubble opens that color's
full page directly, with the same chip-grows-into-the-swatch morph as everywhere else; back returns to the
honeycomb exactly where you were. Every color page now carries a **Learn it** button: an instant ~2-minute lesson
(js/learnit.js) built from that color and its closest taught look-alikes — meet, tell apart, sort, Pick it, one
memory round — ending with every color in it freshly in spaced review. Inside Train, Explore and Studio, the
brand mark at the top-left of the header is the one consistent way back to the honeycomb (tabHead, js/core.js) —
simpler than adding a second button next to it on every tab.
