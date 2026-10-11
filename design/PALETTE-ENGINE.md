# The Palette Engine

*A design for new ways to derive color palettes and to read art history through color. Synthesis of a panel run on 2026-10-11: seven specialists (mathematician, statistician, AI researcher, painter, art historian, web designer, fashion colorist), two critics (rigor and honesty; product and craft), and a systems inventor. Their full texts are in `design/PALETTE-ENGINE/`. This page is the moderator's synthesis and critique. Nothing here is built yet, and no number in it is a measured result unless it says where it came from.*

---

## 1. The thesis in one paragraph

Every palette tool in the world does some version of the same thing: cluster the pixels, keep the biggest clusters, show five chips. That gives you the *average* of a painting. David's complaint is exactly right ("not his boring dull colors"). A great palette is not an average: it's a **selection**, made for character, harmony and tension, the way a painter or a designer would make it. The panel's central finding is that "beautiful, harmonious, unique" can be written down as a **scoring function over whole palettes**. The best palette of any size is then something you compute, and the 3-, 5-, 8- and 12-color versions are nested versions of one answer. Around that core sits a stack of reusable layers: measurement (pools and, new, a cheap pixel map of where each color sits and what it touches), baselines (compared to what), objectives, selection, and an honesty layer. Combining those layers creates kinds of palettes nobody has made: palettes that know their own structure (analogous, complementary, a one-hue lightness ramp), the painter's palette for one era of their life, and the colors that vibrate where they actually touch on the canvas.

*Update, same day (David): segmentation is dropped as too expensive. Section 4 now describes the cheap pixel-map layer that replaces it. The panel's segmentation designs stay in `design/PALETTE-ENGINE/systems-inventor.md` for reference only.*

## 2. The architecture: one pipeline, every feature a path through it

All the panel's ideas turned out to be parts of one pipeline (the systems inventor's framing, adopted):

```
L0  Images        ~63,000 cached full-resolution paintings (research/_raw, build time only)
L1  Pool          24 measured colors + area share per painting (exists: data/gallery/d)
L1b Pixel map NEW each painting's pixels assigned to its own pool colors (the 200 px scale the pools are
                  already extracted at): which colors touch, where each sits; plain array math, no AI
L2  Per painting  stats, roles, findings (exists: data/analysis/paintings-*)
L3  Collections   swatch books, lift, decades, change points (exists: data/games/oo, data/analysis/artists)
                  + NEW adjacency (which colors touch, how often) per painter, decade and movement
L4  Maps          one shared distance (optimal transport), co-occurrence graph, painter map
L5  Engines       the Selector (flagship), career trajectory, role and ratio, vibration pairs
L6  Honesty       shrinkage, density gates, confidence badges, the "quiet palette" state
L7  Delivery      static, sharded, lazily loaded JSON (as today)
```

The point of the layers: each engine can be re-run on a sharper input without being rebuilt. The same Selector run on one painting, on one era of a career, or on a whole movement gives three different, honest palettes from one piece of code.

## 3. The flagship: the Selector (beauty × distinctiveness, any number of colors)

Every specialist proposed some version of this independently; both critics ranked it first. It's the direct answer to David's palette calculator.

**Candidates.** Real measured colors only: a painting's 24-color pool, or a painter's swatch book. No invented colors, ever.

**Structure first.** Before choosing, the Selector reads which structure the painting actually has, from its real colors and what touches what:
- **Analogous harmony:** close hues flowing into each other (Monet's water lilies: soft blues and greens, cream, a touch of pink).
- **Complementary tension:** opposing hues held against each other (van Gogh's blue against yellow and orange).
- **One-hue lightness ramp:** one hue from dark to light (O'Keeffe's Lake George, in the UX Planet article David shared, is one cyan through a wide range of brightness).
- **Light-led:** a strong light-and-dark structure carrying most of the effect (Rembrandt).

It then scores toward that structure. A painting can have more than one, and the engine shows each as a separate palette.

**The score of a whole palette P** (all terms on comparable scales, weights visible):

- **Vivid:** perceived saturation, meaning chroma as a share of the most the screen can show at that lightness and hue. (Raw chroma favors yellows; this was learned the hard way in Odd one out today.)
- **Distinctive:** how much more this collection uses the color's hue than its peers do. This is lift, **shrunk toward the baseline when the sample is small**, so a painter with 14 paintings can't win "signature" colors by luck. Peers means same decade and country first; movement is a looser, secondary baseline.
- **Structure:** one deep anchor, at least one light, and a real lightness range. David's three references all have this.
- **Fit to its structure:** for complementary tension, an opposing pair, at the same lightness if possible (that's the vibration, §5); for analogous harmony, a smooth run of neighboring hues; for a lightness ramp, one hue spread evenly from dark to light. Muddy near-clashes are penalized in all three. Pairs must actually *touch* on the canvas (measured on the pixel map), not just both appear somewhere.
- **Distinct:** no two colors closer than a visible step.
- **Real:** every color covers a minimum share of the canvas, and survives the extraction-stability check (§7).

**Variable count.** The palette is built greedily, one color at a time, always adding the color that raises the score most. So the 3-color palette is literally the first three of the 12, and the slider never reshuffles. A "natural" count, where adding one more color stops adding much, is suggested as a *range*, never a hard number.

**Roles.** Each chosen color gets a job: **Anchor** (the deep base), **Tension** (the opposing pair), **Support** (the bridges between them) and **Spark** (the rare accent). It also gets a plain-language proportion. This one presentation layer is what turns a list of hexes into something a designer, a painter or a decorator can use.

**The honest states.**
- When a painting has no real tension, the Selector never forces a fake complementary pair: it gives the structure the painting does have ("analogous harmony" for most of Monet's late water lilies). That's a first-class answer, not a fallback.
- When a painting is ordinary, it says that too, and says what *is* interesting about it (it's the most typical painting of its decade, for example). The median painting in a 42k archive is competent and unremarkable, and pretending otherwise is how tools get generic.

**My critique.** The weights are the weak point. Hand-set weights look like math but they're taste. The two critics' fix is right but not enough:
- Make the weights a visible "harmony ↔ drama" dial, rather than hidden constants.
- Then **learn** them (§6). Until there's data, say they're a starting point.

## 4. The spatial layer, without segmentation

Segmentation was David's idea, and the panel's designs for it are archived. It's dropped as too expensive. Most of its value comes from a much cheaper step: **assign each painting's pixels to its own 24 measured colors**, at the 200 px scale the pools are already extracted at, from the images already cached at build time. Plain array math, no AI. My rough estimate is tens of milliseconds an image; time it on a sample before committing to the whole archive.

What that map gives, without knowing what anything *is*:
- **Which colors touch, and how much.** This powers vibration pairs, true companions (grounded pairing, §5) and the Selector's rule that pairs must actually meet.
- **Where each color sits:** top or bottom, concentrated or spread across the canvas. A spread term in the Selector makes the palette represent every part of the picture, which is most of what region sampling promised (Wheatfield with Crows reads sky → wheat → path → verge).
- **Edges:** colors that sit along the boundary between two large color areas and differ from both, such as a rim of light or an outline. Kept only if they beat random strips taken from inside each area, which filters out JPEG halos.
- **Light and shadow pairs:** a color and its darker neighbor of the same hue, touching. "How Sargent darkens white silk."

The featured paintings already ship this kind of map (`img/paintings/*-map.png`, pixel value = palette index), so the format exists; the build step extends it to the archive as derived numbers (adjacency counts, positions), not images.

## 4b. A first measurement against human-picked palettes (2026-10-11)

ColorLisa (colorlisa.com, Ryan McGuire) hand-picks one 5-color palette per famous painting. It's the closest existing product to what this engine computes, and its palettes make a useful **independent benchmark**. Four of its I–P palettes are of paintings we have as featured pages. For each, we measured how close our colors get to the curator's five (CIEDE2000; about 2 is barely visible). The pool was re-extracted from our featured image with `tools/gallery.py extract_pool(k=24)`.

| Painting | Our 6 area colors (mean ΔE to the curator's 5) | Our measured pool (mean ΔE) |
|---|---|---|
| Woman with a Parasol | 11.8 | **5.3** (the green-gold 5.3, the dark green 3.6) |
| The Kiss (Klimt) | 13.9 | **4.7** (the gold 1.4, the violet 3.4) |
| Water Lilies (1906) | 16.3 | 14.5 (blues 2.8 and 4.3, but the red 35.5 and lavender 23.7 are missing) |
| The Scream | 18.0 | 14.6 (all five off) |

What it says:
1. **Where the colors are in the pool, it's purely a selection problem.** The curator's palette for The Kiss and Woman with a Parasol is almost entirely present in our 24 measured colors; the area palette just doesn't pick them. That's exactly what the Selector is for. Stage 1 test: pick 5 from the pool and land near these.
2. **Sometimes the pool is the bottleneck.** Water Lilies' small red and lavender accents aren't in our pool at all. Either the extractor's 200 px working size averages small vivid accents away, or the curator worked from a different photograph or crop. Both are testable: re-extract at higher resolution, with a seat reserved for small, high-saturation areas, and see whether they appear.
3. **Different photographs are different data.** Our Scream image is far more muted than whatever the curator used, and it may not even be the same version. Benchmarks must record which image each palette came from, and a mismatch is a finding about photography, not a failure of the engine.
4. **How we differ.** ColorLisa is hand-made, fixed at 5, one palette per painting, with no reasons, and mostly modern works. We can compute variable-count, structure-aware, explained palettes for 42,000 public-domain paintings, and use their palettes (and David's references) as the check.

The benchmark data itself stays out of the shipped app; it's an evaluation set, credited, used only to measure our own output.

## 4c. Reverse-engineering a curator's recipe (2026-10-11)

David pointed to a Pinterest board, "Painting Palettes" (in San Rin's "Colors to Marvel At"; 174 pins; the cards look like they come from an Instagram palette account), and recorded a screen video scrolling through it. Frames were extracted from the video at 4 per second. Each card (a painting plus five swatches, below it or down its right side) was detected and de-duplicated across frames: **171 unique cards** (36 in the tall-painting layout), all with five swatches, checked for duplicates and spot-checked by eye. Each swatch was measured against its own painting's pixels. That's 855 swatches. The extracted palettes stay in a scratch folder as an evaluation set; only these statistics are recorded here.

**How this curator picks** (medians; quartiles in brackets):

| | Finding |
|---|---|
| Real colors | nearest actual pixel ΔE00 1.0 (95% within 6.1): eyedropper work, nothing invented |
| Small areas | each pick's color (within ΔE 8) covers 2.9% of the canvas [0.6–9.7%] |
| The vivid version | the 81st chroma percentile within its own color family [58–93] |
| Lit, not shadow | the 76th lightness percentile of the canvas; the darkest pick sits ~16 L above the canvas's deepest 5%, the lightest at about its brightest 5% |
| Anchors are optional | 27% of palettes include a dark (L < 30); 4% a near-white |
| Distinct | closest pair in a palette ΔE 14.4 [11.8–17.5] |
| Vivid overall | palette mean chroma at the canvas's 82nd chroma percentile |
| Neutrals | 0.7 per palette (half have none) |
| Order | 70% of palettes run in hue order around the wheel; 13% by lightness |

**The recipe in code, tested honestly.** The recipe:
- bin the lit, chromatic pixels into 24 hue families;
- in each family, take a real pixel near a chroma percentile;
- add a light neutral when it's a real presence;
- pick five by area^a × chroma with a minimum ΔE between picks.

Its four dials were tuned on the 86 even-numbered cards, then scored on the **85 odd-numbered cards it never saw** (mean ΔE00 to the curator's five, matched one-to-one):

| Method | Test cards |
|---|---|
| Recipe (tuned: 92nd chroma percentile, skip the darkest 30% of pixels, ΔE ≥ 14 apart, area^0.3) | **14.6** (median 14.0) |
| Area k-means (what most tools do) | 16.2 |
| Our current Diverse mode (5 from the 24-color pool) | 17.4 |

The recipe beats Diverse on 68% of test cards and k-means on 64%. That's better, but 14 is still clearly a different color.

**Where the error comes from** (same test cards):
- **The photo isn't the limit.** The curator's colors exist in our copy of each painting to within ΔE **2.7**.
- **Candidate generation costs ~5.** Picking perfectly from the recipe's ~170 candidates could reach **8.1** at best.
- **Selection costs ~6.5** (8.1 → 14.6), and it's the bigger gap.

**Next step:** a learned selector. A ranker trained on which candidates the curator actually takes (features: area, chroma percentile within its family, lightness percentile, family size, distance to the colors already chosen), checked on held-out cards. Plus richer candidates (more shades per family) to close the 2.7 → 8.1 gap.

**A different style from David's van Gogh references.** Those keep a deep anchor; this curator does only 27% of the time. So the engine should offer *styles*, each learned from its own reference set: "lit and vivid" (this board), "structured with an anchor" (the UX Planet palettes), "by area" (what we have now).

## 4d. Many palettes per painting: the palette space (David, 2026-10-11)

David's reframe, which I think is the right frame for the whole engine: hand-picking from a painting doesn't yield *one* palette, it yields **10 or 20, each distinct, all derived from the painting**. Some are obviously the painting; some are a niche reading of it: just the violets of a water lily canvas, or one green and one blue plus every real color between them. And every one of them expands and contracts, from 3 to 20 colors.

So the unit isn't "the palette of a painting". It's **a space of palettes**, and each one is defined by:
1. **A lens (constraint):**
   - **whole painting;**
   - **a hue window** ("the violets", "the warm half");
   - **a lightness band** ("the lights", "the shadows");
   - **two anchors and the path between them** (pick a real green and a real blue; every real color near the OKLab path between them, ordered along it);
   - **one family's full range** (every blue in the painting, dark to light);
   - **a style** ("lit and vivid", "with an anchor").
2. **An objective:** the Selector's score, restricted to colors inside the lens.
3. **A size:** nested greedy selection, so any lens palette slides from 3 to 20 without reshuffling. For a two-anchor path, the order is the path itself, and adding colors fills the steps between.
4. **A seed:** near-equal choices take turns (the gallery's Shuffle already works this way), so "another one" is always available and always real.

Every palette in the space then carries two honest numbers:
- **How representative it is:** the optimal-transport distance between the palette and the painting's whole color distribution. Low means "yep, that's the painting"; high means a niche reading. The meter is shown, never hidden, and niche palettes are named for what they hold ("the violets of Water Lilies, 1906: 6 of its colors, 9% of the canvas").
- **How beautiful it is:** the Selector score, eventually learned from the swipe deck (§6) and from reference sets like the board above.

What it unlocks:
- A painting page that offers a *shelf* of palettes (the representative one first, then the niches).
- The game's two-similar-color gradients drawn straight from two-anchor paths.
- "Find every palette in the archive near this one" across 42,000 paintings.

## 4e. The palette explorer: a painting's colors as a living map (David, 2026-10-11)

**David's idea.** Open one painting and see its real colors floating on a color map, not in a line. Controls:
- **how many** (say 10);
- **which families** (only pinks, greens, blues and yellows);
- **a saturation range** (only the pastels).

The colors shown are always the best-related set *for what's on screen right now*. Tap them to build your own palette ("bloop, bloop"). Presets sit on top for people who don't want to drive. The explorer is the palette space (§4d) made visible and touchable.

**It joins two things the app already has:**
- **The palette honeycomb** (`js/palettehive.js`): every color in one thing, sized by area, with a count slider.
- **Studio's gamut wheel** (`js/studio.js`): a shape on a perceptual wheel selects colors.

Put a painting's measured colors *on* the gamut wheel, and the mask becomes the filter.

### The map itself (three layouts, one toggle)
1. **Color space: hue as angle, saturation as radius.** Each dot sits at its true hue and chroma and is sized by area, with lightness as the dot's own color. Filters become shapes on the wheel: family = a wedge, saturation range = a ring, "pastels" = a pale ring near the center. This is the gamut mask, used on a real painting.
2. **Light and color: lightness up, chroma across, one hue family at a time.** For seeing every blue in the painting from shadow to highlight. This is where two-anchor ramps live.
3. **The painting's own relationships: a force layout of the adjacency graph.** Colors that touch on the canvas pull together; colors that never meet drift apart. This isn't color space at all: it's *how the painter arranged color*, and it's new (§4f).

### How the auto-pick behaves
- Every visible color comes from one nested ordering under the current filters. The 10 shown are the top 10 of the Selector's greedy order *inside the filter*, so moving the count slider adds or removes one dot at a time and never reshuffles.
- When a filter changes, dots that survive stay put; new ones fade in, removed ones fade out. Calm, no jumping.
- "Best related" means the Selector's score computed against the colors currently on screen (harmony, distinctness, and touching, from §4f). Tapped colors are locked, and the rest re-pick around them, the way the gallery's Edit/Shuffle already handles locked slots.

### Presets: the sliders' default positions, as chips
Chips set the sliders, and the sliders are the deeper layer:
- Representative
- Vivid
- Pastels
- Shadows
- Just the warm half
- Neighbors
- Vibration
- Ramps
- The accents
- One family

Each chip names what it did ("Vivid: the 8 most saturated colors that sit well together").

### Pros
- **Honest and exploratory:** only real measured colors, and you see what the painting actually holds, which teaches seeing (the philosophy's "learn by seeing").
- **Infinite but real:** every filter combination is another true palette from the painting.
- **Expand and contract built in:** the count slider is the nested order.
- **Spatial understanding:** layout 3 shows something no tool shows.
- **It reuses the honeycomb, the gamut wheel, the locked-slot shuffle and one-tap color pages.**

### Cons, and what fixes each
- **Slider pile-up (breaks the calm-surface rule).**
  - The surface has one control (count) and a chip row.
  - Filters live under one Adjust button.
  - On the wheel, filters are direct manipulation (drag the wedge, pinch the ring) rather than more sliders.
- **Blank-canvas paralysis.** It opens on the Representative preset, already composed; customizing is optional.
- **A 2D map of 3D color always hides one dimension.** Each layout says which one it hides. Lightness is carried by the dot's own color on the wheel, and by position in layout 2.
- **Ten to twenty dots plus controls on a phone.**
  - Dots sized by area, with a minimum tap size.
  - Overlapping dots fan out on press.
  - The painting thumbnail stays visible, and tapping a dot lights where it lives on the canvas.
- **Filters can empty the map** ("pastels" on a dark Rembrandt). Design the empty state honestly: "This painting has no pastels. Its lightest colors are these three", offered as the nearest alternative.
- **Pool resolution.** A painting's 24 measured colors may be too few for fine filtering, and too coarse for small accents (the Water Lilies red, §4b). Ship a richer pool (40, which the extractor already supports) for the explorer.

## 4f. Adjacency: color as a spatial relationship (expanded)

**The idea.** Percentages say *how much* of each color a painting holds. Adjacency says *how the painter arranged it*: which colors touch, how much, and whether more than chance would predict. It comes from the cheap pixel map (§4): every pixel assigned to its painting's measured colors, then boundaries counted. No AI, no segmentation.

**The measurement.**
- For each pair of colors *i, j*: shared boundary length *B(i,j)*.
- The expected boundary if the same areas were scattered at random: roughly proportional to *area_i × area_j*.
- **Affinity = observed / expected**, shrunk toward 1 for small areas.
- Above 1 means the painter put them together on purpose; below 1 means kept apart.
- The result is a weighted graph per painting: colors are nodes, touching is edges.

**What the graph gives, all real and all derived:**
1. **Neighbors:** tap a color and see what the painter placed beside it, strongest first ("what van Gogh put next to this yellow").
2. **Vibration pairs:** touching, high affinity, near-equal lightness, opposite temperature. The Café Terrace shimmer, found where it actually happens.
3. **Ramps (the painter's own gradients):** chains of touching colors with small steps between them. These are how the painter actually blends, path by path. They're the honest source for the game's two-similar-color gradients, and the "two anchors and everything between" lens.
4. **Outlines:** dark colors touching many others along thin boundaries. Drawn contour lines (van Gogh, Klimt, Japanese prints) become measurable.
5. **Islands (accents):** colors that touch mostly one other color. The red poppy in the green field: the Spark role, found spatially rather than by rarity.
6. **The hub:** the color touching the most others. It's the glue color, and a spatial check on the "mother color" idea (§5).
7. **Neighborhoods without segmentation:** communities in the graph are groups of colors that mostly touch each other (sky colors, field colors). That's most of what region palettes promised, at no AI cost.
8. **The painter's habits:** affinities aggregated across a career, against peers ("puts violet beside orange far more than his peers": a lift, shrunk like every other lift), plus era changes in *arrangement*, not just in colors used.
9. **Arrangement styles:** the same palette arranged differently, finely interleaved (broken color, pointillism) versus large blocks versus soft blends, is measurable as boundary-per-area and ramp smoothness. That's a new axis for comparing painters and movements, with the usual caveat that photo resolution limits the finest strokes.

**On the explorer.**
- Edges between dots show touching (thickness = how much, glow = above chance).
- The Neighbors, Vibration, Ramps, Outlines and Accents presets come straight from the graph.
- Layout 3 is the graph itself.

**Tests that can fail.**
- Do vibration pairs found by adjacency land on the Café Terrace's cobalt and orange without being pointed there?
- Do the curator's picks on the 171-card board touch each other more than equally vivid alternatives from the same paintings? If adjacency predicts curator picks, it joins the learned selector (§4c) as a feature.
- Do graph neighborhoods line up with the obvious sky and ground on landscapes, judged blind by David?

**Cost.** Assigning pixels to colors and counting boundaries is plain array math at the pool's 200 px scale. Time it on a sample before the whole archive (a rough guess is tens of milliseconds an image). The output is a small matrix per painting.

## 5. The other systems that survive

Ranked by novelty × honesty × delight. Each line says what it combines.

1. **Vibration pairs** (painter's Albers idea × the pixel map). Warm against cool at the *same lightness*: the effect that makes Café Terrace's cobalt and orange shimmer. Measured where the colors actually touch, not on coincidences in the pool. It feeds the Selector's tension term, the painting page ("this canvas holds orange and blue at the same darkness, which is why they vibrate"), and a gorgeous new Odd one out board.
2. **Era palettes** (career change points × Selector). Run the Selector inside each detected period of a life, not over the whole career. This is how "van Gogh's most beautiful palettes come from his colorful years" becomes something the math *discovers* instead of something we hand-code, and it's falsifiable (§8).
3. **Light-led vs color-led** (painter's value-structure idea, renamed honestly). How much a painting's impact comes from light and dark versus from hue contrast. "Rembrandt builds with light; Matisse builds with color", measured per painting and per painter, with the black-and-white view one tap away. Honest at pool level as "tonal range"; the pixel map adds where the lights and darks sit.
4. **Grounded pairing** (co-occurrence graph × pixel-map adjacency). Which colors a painter puts *next to each other* far more than chance would predict. These are the real combinations, not hues that merely appear on the same canvas.
5. **Mother color, baseline-subtracted** (painter's idea × the painter's own catalogue). The tint that unifies a canvas, counted only when it's above that painter's usual cast. Otherwise it would mostly detect varnish.
6. **Career trajectory, density-gated** (statistician's change points × mathematician's velocity and curvature × historian's dated facts). Periods are found with an uncertainty band. Gaps show as gaps, never interpolated. A label appears only when a real dated fact exists; otherwise "the data shows a shift here; no known cause".
7. **One distance for everything** (optimal transport). Every "how similar" question routes through one honest metric: nearest painter, most typical painting, decade against decade. It stays invisible plumbing, never a diagram.
8. **The painter map** (embeddings × co-occurrence axes). Painters placed by color, with brightness and chroma factored out first, so the map isn't just "dark painters on the left". Axes are labeled by what they actually correlate with, and career paths are drawn on it.
9. **Role and ratio export** (web designer × fashion colorist). Any palette becomes a usable kit: background, surface, primary, accent, text, contrast-checked, with tints and shades built from the painting's *own* values. The same engine produces outfit and room proportions as plain recipes, never a shopping flow.
10. **Calibrated games** (one distance × Odd one out × the pixel map).
    - "Which painter's palette doesn't belong", with distractors picked at exactly the right distance.
    - Odd one out boards built from a painting's real vibration pairs and its own light-to-shadow ramps.
    - The serious math becomes play, and play teaches seeing.

## 6. The learning loop: so "beautiful" isn't just my guess

My biggest addition to the panel: the beauty score must be **learned**.

- **A swipe deck for palettes:** keep or skip, in the app's existing flashcard style. Every swipe is a labeled preference between real, measured palettes.
- **Fit, then personalize:** the Selector's weights are fitted to everyone's swipes (learning-to-rank), then nudged toward *your* swipes. Your palettes get more like you over time, and the app can say so honestly: "tuned to 140 of your choices".
- **A benchmark:** a reference set of hand-made palettes, starting with David's three van Gogh examples, scored by how close the Selector gets (color distance, matched by role).

## 7. Honesty rules that apply to every engine

The rigor critic's best catches, plus mine:

- **Shrink every lift** toward its baseline when the sample is small, and show confidence as three calm tiers (sure, likely, suppressed), never as error bars.
- **A false-discovery budget for the whole app,** not just per feature. Thousands of finding generators will otherwise produce a steady stream of plausible but spurious "discoveries".
- **Extraction stability:** re-extract each pool a few times with perturbed settings and keep only the colors that persist. Today every claim quietly trusts one run of one clustering algorithm.
- **A per-image cast check:** flag paintings whose overall cast is an outlier for their museum's photography, so one warm photograph doesn't become a "warm painter".
- **Decade and country before movement:** movement tags are sparse and partly inferred, so movement-level claims are a looser tier.
- **One canonical palette per context** (painting page, painter page, export). When two engines disagree, the page can say why ("by area vs by character").
- **Killed** (unanimous, and I agree):
  - De-varnishing to recover "original colors": no ground truth, so it would be screenshotted as fact.
  - Naming historical pigments from color alone: one arbitrary answer among many that fit equally well.
  - Glaze-vs-opaque guessing.
  - Workshop-vs-master authentication.
  - Skin-tone flattery.
  - Trend-forecast rhymes.
  - The "geodesic through art history" manifold as a public feature: its shape is mostly which museums digitized what.

## 8. Build stages, each with a test that can fail

**Stage 1: the Selector on pools (no segmentation).**
- Run it at five colors on Wheatfield with Crows, Café Terrace and Painter on the Road to Tarascon. It passes for each painting only if:
  - an anchor is present;
  - a tension pair falls in the blue-against-yellow/orange band;
  - all five colors are distinct;
  - the honesty gate does not call it "quiet".
- Nestedness: the 5-color palette must be exactly the first five of the 12.
- **The real test, David's own intuition:** score all of van Gogh's paintings. The top scorers must concentrate in his colorful years far more than a random draw would. If they don't, the score is wrong.
- **Monet, unchanged settings:** the gate should call many late water lilies "quiet", not invent oppositions.
- **Reject the build if** the weights that satisfy van Gogh make Monet's dull paintings score "beautiful" about as often as random ones.

**Stage 1 results (2026-10-11, `tools/palette_picker.py`).** Stage 1 became the *learned* picker (David's call), trained on the 171-card board (§4c).
- **Held-out test, 85 cards it never saw:** mean ΔE00 **13.1** (median 12.7) from the curator's five. For comparison on the same cards: hand-made rules 14.6, area k-means 16.2, our current Diverse mode 17.4.
  - The candidate ceiling (a perfect choice from its own candidates) is 5.5, so choosing remains the gap.
  - Honesty notes: the held-out cards were scored three times. Once for the first version (12.7). Once after one feature round chosen by cross-validation on the training cards only (also 12.7). Once after fixing a bug that let 7 palettes stop short of five colors, which flattered the score; 13.1 is the corrected, final number.
- **What it learned** (strongest weights): stay well apart from colors already chosen; take a color close to the most vivid in its family; prefer colors that cover some area; lean light; and avoid hue families that are huge on the canvas, in favor of distinct families.
- **Nested sizes:** the 5 are always the first 5 of the 10 or 20, and the spacing loosens step by step so every size fills.
- **Van Gogh check, a modest pass with a caveat.**
  - 48% of his 200 archive paintings are from 1888–90; 70% of his top-scoring 10% are (14 of 20, ×1.5).
  - Plain mean chroma gives the same 70%, so this doesn't yet show the score sees more than saturation, even though the two rank paintings almost independently (rank correlation 0.06).
  - 20 paintings is a small sample; by my rough calculation it's borderline significant.
- **Monet check, a fail as designed.** The structure rules call only 26% of his 27 water lilies "analogous" and 30% "complementary" (van Gogh 1888–90: 35% / 34%). The rules ignore area, so small pink lilies against green pads count as an opposing pair. **Area-aware rerun** (threshold fixed before running: each color's family must cover ≥ 5% of the canvas):
  - Monet's water lilies moved the expected way: analogous 37%, complementary 19%.
  - But van Gogh 1888–90 now reads analogous 46%, complementary 16%, so the rules still don't separate the two painters. Still a fail.
  - Likely causes: five picks are too few to read a painting's structure, and the rules are my intuition rather than learned.
  - Next: read structure from the painting's whole area-weighted color distribution, and judge it against a small set David labels by eye ("opposites" vs "neighbors"), not against my expectation.
- **Five famous held-out paintings, chosen before running** (picker vs our current Diverse; lower is closer):
  - *Café Terrace at Night* 7.9 vs 16.6 (nearly the curator's palette);
  - *Portrait of Félix Fénéon* 13.2 vs 18.2;
  - *Ophelia* 16.9 vs 17.6;
  - *Starry Night Over the Rhône* 17.7 vs 18.2 (it misses the small yellow lights);
  - *Bridge over a Pond of Water Lilies* 17.1 vs 16.2 (worse: it takes a dull grey the curator skipped).

**More human examples, and how much people agree (2026-10-11).** Gathered into gitignored `research/_raw/datasets/` (evaluation only):
- **Lin & Hanrahan, "Modeling How People Extract Color Themes from Images" (CHI 2013, Stanford).** 40 images (20 paintings: Monet, Seurat, Winslow Homer, Macke, Chikanobu; 20 photos). 40 Mechanical Turk workers each picked 5-color palettes per image, plus 11 artists on some images. People picked from a set of swatches offered per image. The official link is dead; the dataset came from the Internet Archive copy. No license stated, so it's used for testing only.
- **O'Donovan, Agarwala & Hertzmann, "Color Compatibility From Large Datasets" (SIGGRAPH 2011).** Human ratings of 5-color palettes (Kuler, COLOURlovers, MTurk). CC BY-NC-SA, non-commercial: research and testing only, and nothing trained on it ships if the app is commercial. Not used yet.
- **ColorLisa:** 133 unique hand-made 5-color palettes from 99 artists; 13–14 are paintings we hold (Mona Lisa, the Great Wave, Starry Night, Girl with a Pearl Earring, the Milkmaid, the Arnolfini Portrait, The Kiss, The Birth of Venus, La Grande Jatte, Monet's Water Lilies 1906 and Woman with a Parasol, The Scream).

**The key measurement: people don't agree with each other much.** On Lin & Hanrahan's 20 paintings (mean CIEDE2000, matched one-to-one):

| | Distance |
|---|---|
| one person vs another, same painting | **12.7** |
| artists vs Turk workers | 13.8 |
| area k-means vs each person | 13.8 |
| our learned picker vs each person | **16.9** |

What it means:
1. **Our 13.1 against the Pinterest curator is roughly the size of the disagreement between two people.** So the picker is close to "another person's take" on that curator's cards. (Different images and a different swatch method, so this is a rough comparison, not proof.)
2. **"Taste" is not one thing.** The picker learned one curator's lit, vivid style, and on ordinary people's palettes it does *worse* than plain area clustering (16.9 vs 13.8). The crowd's consensus is more representative; this curator is more selective.
3. **So the engine should offer styles** (a representative one, close to the crowd, and curated ones like this board), and **learn the user's own taste** (§6). No single "correct" palette exists to chase.

**Stage 2: the learning loop and vibration pairs.**
- Ship the swipe deck, log every component score, and refit the weights. Pass if the learned weights predict held-out swipes better than the hand-set ones.
- Vibration pairs: pass if Café Terrace's cobalt/orange is found without being pointed at.

**Stage 3: the pixel map.**
- Time it on 300 paintings first, then run it archive-wide only if the cost holds.
- Pass if adding "pairs must touch" and the spread term moves the Selector visibly closer to David's references (a blind side-by-side judged by David), and if vibration pairs found on the map beat the pool-only version.

**Stage 4: era palettes and edges.** Era palettes pass if they're stable for a well-documented painter (van Gogh) before being trusted on thinner ones. Edges pass if they beat the random-strip null on Café Terrace.

**Stage 5: cross-painter studies, the painter map, games and export,** each gated on the layers below it holding up.

## 9. Decisions for David

1. **Stage 1 first?** The pool-only Selector is the cheapest way to answer "does the math find van Gogh's colorful palettes?" It's my recommendation; the pixel map follows once it passes.
2. **The swipe deck.** It's the only honest way to make "beautiful" mean something beyond our taste. Where should it live: Learn, Explore, or Studio?
3. **The reference set.** More hand-made palettes you love, from any painter, make a better benchmark. Twenty would be a good start. ColorLisa's other pages (A–H, Q–Z) likely include van Gogh, Vermeer, Seurat and Turner, which would add more paintings we actually have. Should I gather those too, as an evaluation set only?
