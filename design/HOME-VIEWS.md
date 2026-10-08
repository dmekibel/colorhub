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
| `families` | Families | one island per family, Greys in the middle | islands (hue × lightness inside) |
| `temp` | Warm and cool | warm left → cool right, light→dark down | grid (x = temperature, y = lightness) |
| `strength` | Muted to vivid | greys left → vivid right, light→dark down | grid (x = chroma, y = lightness) |
| `path` | Path rings | first words center, a ring per stage, hue around | rings (rank = useRank, angle = hue) + stage rings drawn on the ground |
| `known` | What you know | Learned center → Learning → New, hue around | rings (rank = knowledge tier then useRank) + tier rings |
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

## 5. The View sheet

One sheet, three parts, map always visible above it and recentered live:
1. Header: "View", a one-line summary ("Pinks · 166 colors"), Search, Surprise me, and a clear ✕.
2. **Arrange by**: a strip of live thumbnails, each drawn from the *actual* colors in the actual arrangement; the current one is ringed. One tap morphs the map.
3. Tabs **Colors** (How many · Family · Tone · Knowledge · Collections) and **Look** (Bubbles / Honeycomb / Magnifier, then Magnify, Spacing and Bubble size sliders with word ends, no numbers, a Reset, and the two map-edge toggles).

Leaving is always easy: ✕, a tap on the map above, a swipe down on the header or the grab bar, Escape, and Back. The sheet never dims the map (it's the thing you're adjusting).

## 6. The feel

`S.hm.feel = { mag, space, size }` (0–1). Defaults tuned at 440×956: mag .62 (a clear fisheye, the middle bubble ~3.5x the edge), space .2, size .5. Magnify drives the center-to-edge ratio (flat at 0), Spacing the seam, Bubble size both ends together. Reset returns to the defaults. Lab tweaks stay in the lab.
