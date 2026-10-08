# Home views: arrangements, filters and the View sheet (2026-10-08)

David: "The views can be improved, and the View menu UI on Home is still kind of ugly. Changing the view is not
convenient. Come up with a lot more views… the whole point is to have the colors be related." Plus: family filters
are wrong (Pinks shows only pastel pinks), the menu is hard to leave, and the lens magnification feel was lost.

The rule every arrangement must pass: **position means something, and a bubble's neighbors are its relatives.**
If you can't say in one sentence why two touching bubbles touch, the arrangement is cut.

---

## 1. Audit of what Home had

| View (old "Look" style) | What position meant | Neighbors related? | Verdict |
|---|---|---|---|
| **Original** (map) | hue left→right, light→dark down | yes, on both axes | **Keep** as "Hue map", the default |
| **Honeycomb** | same map, hexagon cells | yes | **Keep, as a Look** (a shape, not an arrangement) |
| **Magnifier** | same map, strong lens | yes | **Keep, as a Look** (a lens, not an arrangement) |
| **Sunflower** | golden-angle disc, sorted by hue then lightness | partly: index neighbors sit 137° apart, but the spiral's visible arms (every 8th/13th/21st name) are close hues | **Keep, demoted** to the end of the strip |
| **Spiral** (learning spiral) | golden-angle disc sorted by useRank | **no**: rank order says nothing about color, so touching bubbles are unrelated (David's complaint) | **Cut and replaced** by "Path rings": same rings (first words in the middle, stages as rings), but hue now runs around each ring, so neighbors share a hue |
| Wheel (lab only) | greys middle, chroma outward, hue around; outer ring padded with duplicates | yes, but duplicates break "each color once" | **Rebuilt** without duplicates and brought to Home |
| Globe (lab only) | Runge's sphere | yes, but bunches and leaves bare patches; can't morph (different pan model) | **Stays in the lab** |
| Edges / Current / Tapestry (lab only) | the map with other lenses | yes | lab only |

Also found:
- "Style" mixed two different things: *where* colors go (layout) and *how* they look (lens, shape). The new sheet splits them: **Arrange by** and **Look**.
- Old per-style lab tweaks (`S.hm.tweaks`) still applied on Home after the sliders were removed, so a low "Center size" saved during the lab era kept the lens flat with no way to undo it. That is the "zero scaling" David felt. Home now uses its own three friendly sliders (`S.hm.feel`) and ignores the lab tweaks.
- Family sets were hue boxes with hard lightness cut-offs: Pinks = hue 290–40 **and L ≥ 70**, so Hot pink, Rose, Fuchsia, Cerise, Dusky rose and every dark or vivid pink fell into Reds or Purples. 166 names say "pink/rose/fuchsia/magenta" and most of them sat at L 45–70.

## 2. Brainstorm: 30 distributions where position means something

Two-axis sheets (a grid: x and y each mean one thing)
1. **Hue map**: hue across, light to dark down (today's default).
2. **Warm and cool**: temperature across (warm left, cool right, greys in the seam), light to dark down.
3. **Muted to vivid**: chroma across (greys at the left edge), light to dark down. A "page of the Munsell book" for every hue at once.
4. **One hue's page**: for a chosen family, chroma × lightness only (the true Munsell page). (Later: needs a family picked first.)
5. **Hue × chroma**: hue across, vivid at the top, muted at the bottom (lightness ignored).
6. **Lightness ladder strip**: one long vertical strip, white at the top, black at the bottom, hue sorted within each rung.
7. **Temperature × chroma**: warm/cool across, strength down (an "energy" chart).

Rings and wheels (a radius and an angle)
8. **Color wheel**: greys in the middle, hue around, stronger outward.
9. **Light to dark**: white in the middle, black at the rim, hue around (a sun).
10. **Dark to light**: the inverse (black core, the night sky); a toggle on 9.
11. **Path rings** (fixes the spiral): the first words in the middle, each stage one ring further out, hue around.
12. **What you know**: Learned in the middle, Learning around it, New at the frontier, hue around.
13. **Sunflower**: golden-angle disc by hue then lightness.
14. **Complement wheel**: each color opposite its complement (the perceptual one, honestly labeled).
15. **Distance from a center color**: tap any color and everything re-rings by ΔE from it (a "neighborhood" lens).

Regions (clusters with a sea between them)
16. **Families**: one island per family (Reds, Pinks, Oranges, Yellows, Browns, Greens, Blues, Purples), Greys in the middle, each island hue × lightness inside, islands in hue order around.
17. **Tones**: four islands (Light, Vivid, Muted, Dark), hue × lightness inside each.
18. **Sources**: islands by where a name comes from (Werner, Ridgway, RAL, xkcd, Japanese, Web, Common).
19. **Language/origin**: islands by the language a name comes from (English, French, Japanese, Persian…). (Needs etymology data.)
20. **Pigments vs dyes vs digital vs nature**: islands by what the name was first a color *of*. (Needs material data.)
21. **Your favorites**: hearted colors as one island, their nearest relatives around it.

Time and culture
22. **Decade first recorded**: a timeline left to right, hue down (needs first-attested dates per name).
23. **How common in paintings**: most-used colors in the middle (from the 23,781-painting analysis), rarest at the edge.
24. **A painting expanded**: a painting's palette in the middle, each of its colors ringed by its named neighbors.
25. **A painter's life**: palettes by year across, hue down.
26. **Movements**: islands per art movement, by their measured colors.

Learning
27. **Confusions**: the pairs you mix up placed side by side, the rest of the map around them.
28. **Next door**: what you know in the middle, the 12 names next door ringed, the rest faint behind.
29. **Name length / word frequency**: most-used words in the middle (useRank), the rare jargon at the frontier (this is 11).
30. **Basic terms**: the 11 Berlin-Kay basics as centers, every name gathered around the basic it falls under.

## 3. Chosen for this build (9 arrangements)

Picked for: strong meaning, neighbors always related, works from 25 to 2,700 names, cheap enough to switch live, and no new data needed. In strip order:

| id | Name | Position means | Engine |
|---|---|---|---|
| `map` | Hue map | hue across, light→dark down | existing bounded map |
| `wheel` | Color wheel | greys center, hue around, stronger outward | rings (rank = chroma, angle = hue) |
| `light` | Light to dark | white center → black rim, hue around (greys form one quiet spoke) | rings (rank = 100 − L, angle = hue) |
| `families` | Families | a region per family, Greys in the middle, the rest clockwise in hue order | regions of small grids (hue × lightness inside) |
| `pages` | Hue pages | a page per family: muted→vivid across, light→dark down (the Munsell book) | regions of small grids |
| `temp` | Warm and cool | the color plane from above: warm left → cool right, greens up, magentas down, greys in the middle | grid (x = temperature, y = the other hue axis) |
| `path` | Path rings | first words center, a ring per stage, hue around | rings (rank = useRank, angle = hue) + stage rings drawn on the ground |
| `known` | Your words | Learned center → Learning → New, hue around | rings (rank = knowledge tier then useRank) + tier rings |
| `sunflower` | Sunflower | golden-angle disc, hue then lightness | existing |

Every arrangement places each color exactly once (bounded, finite), so switching is a **morph**: each bubble keeps its identity and flies from where it was to its new place (`l18MorphApply`, 650 ms for an arrangement change), the middle color stays in the middle.

Next candidates (need data or a second step): 4 One hue's page, 15 Distance from a color, 23 How common in paintings, 24 A painting expanded, 28 Next door.

## 4. Filters that tell the truth

- **Families** use one shared rule (`csFamily` in js/colorsets.js) for the map's filters, the explorer's family sets and the zoomed-out family pills:
  1. the name's head word decides when it names a family ("Salmon pink" → Pinks, "Pinkish orange" → Oranges, "Deep rose red" → Reds);
  2. otherwise LCh decides, with pink/red split by lightness *and* chroma (vivid magenta-pinks like Fuchsia and Hot pink stay pink at L 55);
  3. a filter also includes a color whose name carries the family word when its LCh family is a neighbor ("Rose dawn" shows under Pinks and Oranges). Counts say how many.
- **Tone** (Light, Vivid, Muted, Dark) narrows any family or stage.
- **Knowledge** (All, Learned, Learning, New) combines with both.
- Every chip shows its count with the other filters applied, so a choice never lands on an empty map; an empty result says so and offers "Clear filters".

## 5. One corner, two focused sheets (as built)

- **One right-corner button** (four dots, the due count in a paper badge) opens a labeled arc, the rooms stem's mirror:
  Recall (only when due) · Learn these · Study the map · Favorites · Search · Colors · Arrange. A tap outside, Escape and Back close it (it rides the stem's own STEM_OPEN / closeStem). The study-cards, Study the map, View and heart buttons are gone from Home.
- **Colors** sheet: How many · Family · Tone · Your words · Collections, every chip counted, Clear filters. Search, Name any color and Surprise me in its header.
- **Arrange** sheet: the strip of live pictures, a line saying what position means, then the Look (Bubbles / Honeycomb / Magnifier), Magnify / Spacing / Bubble size with words at the ends, Reset the feel, and the map's Edges.
- No tabs. Both sheets leave the map clear above them (no dim), recentered live; ✕, a tap on the map, a swipe down on the header, Escape and Back close them.
- The zoomed-out family-name pills and their toggle are removed (David: "they don't add anything"). Where direction means something, a quiet edge caption says so (Warm and cool: "Warmer" / "Cooler").

## 6. The feel

`S.hm.feel = { mag, space, size }` (0 to 1). Defaults: mag .62 (a clear fisheye), space .15, size .5. Magnify drives the middle-to-edge size ratio (flat at 0, the Look's preset at .5), Spacing the seam (0 to 8 px), Bubble size both ends. Families and Hue pages use a gentler start (x .45) so the whole book reads. Lab tweaks (`S.hm.tweaks`) stay in the lab; on Home they had silently kept an old low "Center size", the flat feel David noticed.

## 7. Layout quality (neighbor similarity)

After each arrangement places its colors, a local swap pass (neighbors and neighbors' neighbors, never across a stage, tier or family) lowers each bubble's mean OKLab difference (x100) to the bubbles touching it. 11 to 25 ms on 2,020 names (desktop), cached with the layout. Mean neighbor dE, every name, before → after:

| Arrangement | before | after |
|---|---|---|
| Hue map | 8.0 | 5.4 |
| Color wheel | 18.1 | 9.6 |
| Light to dark | 7.6 | 5.7 |
| Families | 8.6 | 5.8 |
| Hue pages | 7.4 | 5.1 |
| Warm and cool | 17.9 | 9.0 |
| Path rings | 20.8 | 12.9 |
| Your words | 20.8 | 11.7 |
| Sunflower | 21.2 | 12.7 |

Worst remaining outliers are the extreme near-blacks and near-whites (Rich Black FOGRA29/39, Almost Black, Ghost White) in the ring and spiral arrangements, where few neighbors are like them. Niagara Green now sits between Dark Bluish Glaucous (2.9), Ash (5.1), Celandine Green (5.7) and Hathi Grey (8.1); two vivid greens still touch it at the grey block's edge.


## 8. Shape × order (2026-10-08, second pass)

David: "A single view style and shape could still have many ways to arrange the colors. In one arrangement all the greys are in the middle and it doesn't make sense why. In the flower, something is in the middle and something on the outskirts and it's not clear why."

The nine arrangements were really a few **shapes** each locked to one **order**. They are split now (`HONEY_ARR` = shape, `HONEY_CENTER` / `HONEY_SORT` = order, in js/honey.js; a layout key is `shape~order`):

| Shape | Order control | Choices |
|---|---|---|
| Map (grid) | **Sort by** (what runs left to right; each column light to dark, or by hue when Lightness leads) | Hue · Lightness · Vividness · Warmth · Painted · First met |
| Rings (hex rings) | **Center on** (what sits in the middle; the rest ring outward in that order, hue going round each ring) | Vivid · Greys · Light · Dark · Your words · Everyday · Painted · Today's color · Around this color |
| Sunflower (golden spiral) | **Center on**, same choices; the disc is cut into one-unit bands filled in that order, hue round each band | as Rings |
| Families (a region per family) | **Sort by**, inside each family | as Map |
| Warm and cool | none: both axes are the color itself | |

The old arrangements are all still here: Color wheel = Rings · Greys, Light to dark = Rings · Light, Path rings = Rings · Everyday (stage seams still drawn), Your words = Rings · Your words (tier seams), Hue pages = Families · Vividness. Old saves upgrade (`HONEY_ARR_OLD`), and each shape keeps its own order (`S.hm.ord`).

- **Painted** = how many of the 23,781 paintings hold the color (within 4% different over at least 1% of the picture), from `data/colorindex/painted.json` (984 names, built by `tools/painted_counts.js` from the affinity table). Other names borrow the count of their nearest counted name. Loaded only when chosen.
- **First met** = the date on your card; colors you haven't met follow, by hue, kept apart from the met ones.
- **Around this color** centers on whatever is in the middle of the map when you tap it ("Around Ivory"), and everything rings out by OKLab distance. **Today's color** does the same around today's color.

**Defaults, and why**
- Map → **Hue**: the approved map, unchanged (same layout key, same endless option). Hue is the first thing people group color names by.
- Rings → **Light** (white middle, black rim): lightness is the axis everyone reads without being told, and it gives Rings its calmest neighbors (5.7 against 9.6 for greys in the middle, the order David found arbitrary).
- Sunflower → **Vivid** (the brightest colors at the heart, fading to greys at the petals): a bloom, so the flower means something different from the rings, and the lens magnifies the most colorful part.
- Families → **Hue** inside each family (as before).

**Legible meaning.** The sheet says it in one line under the chips ("Rings · Middle: the most vivid. Edge: greys."; "Map · Warm to cool across, light to dark down."). On the map, a radial shape shows the same line at the top for 4.5 s after Home opens or the order changes, then it fades; a sorted grid gets quiet edge captions (Lighter / Darker, Muted / Vivid, Warmer / Cooler, Most painted / Rarely painted, Met first / Not met yet). A new order glides (the arrangement morph) and travels to the middle.

**Mean neighbor ΔE (OKLab ×100), every name (2,020), before → after the swap pass, and layout time (desktop Chrome)**

| Layout | before | after | ms |
|---|---|---|---|
| Map · Hue | 8.0 | 5.4 | 36 |
| Map · Lightness | 7.4 | 5.0 | 36 |
| Map · Vividness | 10.9 | 6.3 | 26 |
| Map · Warmth | 10.5 | 6.4 | 29 |
| Map · Painted | 12.4 | 8.1 | 38 |
| Map · First met | 8.0 | 5.8 | 45 |
| Rings · Vivid | 19.0 | 10.0 | 27 |
| Rings · Greys | 18.1 | 9.6 | 26 |
| Rings · Light | 7.6 | 5.7 | 25 |
| Rings · Dark | 7.4 | 5.4 | 30 |
| Rings · Your words | 20.8 | 11.7 | 51 |
| Rings · Everyday | 20.8 | 12.9 | 23 |
| Rings · Painted | 18.2 | 10.5 | 25 |
| Rings · Around a color | 13.9 | 8.2 | 31 |
| Sunflower · Vivid | 18.4 | 9.9 | 33 |
| Sunflower · Greys | 18.3 | 9.8 | 27 |
| Sunflower · Light | 7.5 | 5.5 | 20 |
| Sunflower · Dark | 7.5 | 5.4 | 20 |
| Sunflower · Your words | 20.4 | 11.6 | 44 |
| Sunflower · Everyday | 20.4 | 12.5 | 20 |
| Sunflower · Painted | 18.5 | 10.5 | 25 |
| Sunflower · Around a color | 13.7 | 8.4 | 24 |
| Families · Hue | 8.3 | 5.8 | 28 |
| Families · Lightness | 7.7 | 6.0 | 21 |
| Families · Vividness | 6.8 | 4.8 | 19 |
| Families · Warmth | 8.0 | 5.5 | 20 |
| Families · Painted | 8.6 | 5.8 | 21 |
| Families · First met | 8.3 | 5.8 | 34 |
| Warm and cool | 17.9 | 9.0 | 30 |

Layout runs once per change and is cached; drawing is unchanged (a pan frame stays ~1–2 ms on desktop). Orders by chroma, rank or progress are noisier by nature (a vivid ring holds every hue at the same strength); lightness orders are the calmest.

## 9. Look and Magnify (2026-10-08)

David: magnification should apply to either tile style. The Look is now **Bubbles | Honeycomb**; **Magnify** (Flat → Fisheye) is the one lens control for both. Above .75 it climbs on to the old Magnifier's strength (about 9× middle to edge, with its tighter falloff) at 1. An old "Magnifier" save becomes Bubbles with Magnify .92.

## 10. A lit set: How many (2026-10-08)

David: a painting on the map showed 6 colors, "an arbitrary number". A set drawn from a bigger pool (a museum painting's ~24 measured colors, a painter's palettes) carries `pick(k)` (js/colorset.js `csPoolPick`: biggest share first, merged by nearest name). The lit-set bar gets **How many** (3 → the pool, up to 30): the lit bubbles follow live, release reframes them, and a row of chips names each one with its share of the canvas ("Near black 19%"); one tap opens its page. The subline keeps "as photographed". The Arrange sheet works while a set is lit (any shape, order or Look), and the set stays framed after each change.
