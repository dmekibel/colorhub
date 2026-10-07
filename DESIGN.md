# ColorHub design log

The design is built from proven decisions in real products, not invented from scratch. Each choice below names its source.

## The big idea
**The color is the interface.** Every screen gives the swatch as much room as possible and keeps everything else neutral grey.

## Decisions and sources

| Decision | Source | Why |
|---|---|---|
| Neutral dark grey chrome (`#121212`), with no colored UI near a swatch | Color-grading suites (DaVinci Resolve, Lightroom) and the ISO 3664 viewing standard | Colored surroundings shift how a color looks (simultaneous contrast). A neutral surround keeps the swatch true. |
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
| Home hero: every color name plotted by hue on the CIELAB a\*b\* plane, lighting up as you own it | CIELAB chromaticity diagrams; Apple Fitness rings (fill as you progress) | Honest, beautiful progress: you see which parts of color space you can name. |
| One "next step" card at the bottom of home, with review first and then the next unit | Duolingo's single path and big bottom button | One clear path, reachable by thumb. No lesson-picking. |
| Path track: one segment per unit, filled with that unit's gradient once done | Duolingo path, GitHub contribution graph | Shows where you are without opening a menu. |
| Welcome screen: a wall of every color sorted into strips by hue | Paint-store chip walls | The product's promise in one image. |
| Add to Home Screen, fullscreen, safe-area aware | iOS web apps (ALTER uses the same setup) | Most use is on David's phone. |

## What we left out on purpose
- No XP, coins or streak flames. Progress is a number of names **owned**: recalled right a day or more after learning (learning-kb rule).
- No light mode. The neutral dark surround is part of seeing color accurately.
- No colored backgrounds behind swatches, for the same reason.

## Tunables worth testing on David's phone
- Card corner radius (30px), stamp angle (±10°), and swipe threshold (100px, or a fast flick past 36px).
- Map size (`.map` width `37dvh`) and dot sizes (5, 6 and 7 px radius for new, learning and owned).

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
