# Chromatlas: next-level brainstorm (2026-10-24, Opus)

The base is strong: two maps (color, paintings) plus photographs and design, 206k measured paintings, painter pages
with real statistics, Learn, Train, Studio, Museum rooms, Today feed. The next level is not more screens. It is
**seeing**: new ways to look at the same data that make a person notice something about color they could not see
before (CLAUDE.md's philosophy). Each idea names the data it uses, so nothing is invented.

Ranked within each area by payoff. ★ = my top picks overall.

## 1. Painting map
- ★ Stay on your painting through every settings change; one-tap presets with counts (plan Phases A-B).
- ★ Time you can read: big pinned era label, a draggable time rail, six time views (plan Phase E).
- **Lenses on the whole map:** recolor every cell by one measure without moving anything: lightness, chroma,
  warm vs cool, one hue's share ("where is ultramarine?"). The map becomes a heat map you can read in a glance.
- **Color path:** pick two paintings, the map draws the smoothest path of paintings between them, a walk from
  Vermeer's blue to Turner's gold. Shareable.
- **Brush to filter:** draw a lasso on any area of the map and get its statistics ("80% after 1850, mostly French,
  cool and pale") and a palette of the selection.

## 2. Color map
- **History overlay:** a year slider recolors the color map by how often each color shows up in paintings of that
  decade, so you watch color arrive (Prussian blue in the 1700s, mauve and chrome yellow in the 1800s; pigment
  dates already in tools/paintings.py PIGMENT_SINCE).
- **Color neighborhoods as places:** a named color's page shows "the street it lives on": the painters who use it
  most, the decade it peaked, its look-alikes, the films and gems it lives in, on one swipeable strip.

## 3. Painting page and Look closer
- ★ **Read this painting** (one tap, layered, calm surface): value study (grayscale), two-value notan, where each
  palette color sits (a soft heat overlay per chip), lights vs shadows palettes, warm vs cool split, and the hidden
  colors (greens in skin). Each layer is a toggle over the picture, not a new screen.
- ★ **This painting vs its world:** percentile findings in plain words, "darker than 90% of his work, warmer than
  most of the 1880s", with the photographs-of-varnish caveat. Data: analysis + metrics already built.
- **Side by side:** compare any two paintings with synced zoom and their palettes in equal swatches (memory rule).
- **Color walk:** Look closer auto-glides from color to color in the painting, naming each, like an audio guide
  without audio.

## 4. Painter page
- ★ Painters around them (plan Phase C) and the painter map (plan Phase D).
- **Palette river:** the painter's colors as a flowing band across their life (barcode data), chapters labeled where
  the change point is real.
- **Signature and avoided colors as a story:** "uses rose with black 4x more than peers, almost never pure green",
  each claim tappable to the paintings that prove it.
- **Then and now:** first and last paintings, most and least typical, side by side.

## 5. Learn and Train (the gym)
- ★ **Guess the decade** from a palette alone; **Who painted this palette?** (four painters, same-family distractors,
  the learning rule). Real skill, real data, replayable with a daily board.
- **Find it in the painting:** a color name appears, tap where it is in a painting. Trains the eye on real art.
- **Mix to match** a swatch taken from a painting (paint-mixing simulator, goal 2).
- Every game feeds the eye profile, so Train shows honest progress per skill.

## 6. Today and Museum rooms
- **One great look a day:** a single painting read deeply (the Read-this-painting layers), with one finding, not a
  feed of thumbnails. The feed stays for browsing.
- **Exhibitions made from data:** "The year blue got cheap", "Painters who avoided green", "Night in 1890s
  Scandinavia". Auto-assembled from the statistics, curated by a human pass.
- **World by color:** each country as its palette over time (data: country + year + palette), on the world view.

## 7. You, saving and sharing
- **Boards:** save paintings and colors into named boards (Pinterest-like), each board gets its own palette and
  statistics automatically.
- **Your eye profile and taste:** what your hearts say about you ("you love low chroma blues of the 1890s"), and
  paintings you have not seen that match.
- ★ **Share cards that travel:** painting + palette + one finding, sized for Instagram stories and Reels covers,
  feeding the cutroom launch videos. A link opens the exact view (routes exist).

## 8. Camera and the real world
- **Point at anything, find its paintings:** the camera's averaged color goes straight to the paintings and painters
  that use it most, closeness over coverage (memory rule). Connects Studio to the whole archive.
- **Color-blind lens:** see any painting as people with each common color vision deficiency do. Honest and
  educational.

## 9. Desktop
- Two-pane compare everywhere (two paintings, two painters, two decades), keyboard navigation (arrow keys walk the
  map, space opens), a wide time river that uses the whole screen.

## 10. Foundations that make all of this feel premium
- ★ **Speed and memory:** the painting map just crashed iPhones at 206k paintings; budget every map (done for tier
  0/1, add for photographs/design), lazy everything, and an offline bundle for the App Store build.
- **Data quality pass:** clean painter names (raw museum strings), same-painting duplicates across museums, wrong
  attributions, black-and-white scans that slipped through. Quality beats volume now.
- **Image quality floor:** flag sources under ~800 px; prefer the HD copy everywhere a picture is big.

## My recommended order
1. Plan Phases A + B (stay on your painting, presets): small, fixes a real annoyance.
2. Phase E part 1 (big era label + time rail) and the Life chapters / Timeline across views.
3. Read this painting (layers) + This painting vs its world: the deepest "see through color" payoff per hour.
4. Painter name cleanup + Painters around them (Phase C), then the painter map design (Phase D).
5. Guess the decade / Who painted this palette games.
6. Share cards that travel, timed with the cutroom launch videos.
