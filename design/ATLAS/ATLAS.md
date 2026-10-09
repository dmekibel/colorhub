# The Color Atlas (design, 2026-10-09)

A painter's whole life, one painting, two painters side by side, or the whole archive, read as color data and laid out in space, in the map's own visual language (bubbles, honeycomb, sunflower, rings), with time as a slider.

- **Prototype:** `design/ATLAS/prototype.html` is v2 (real data; how to run it is in section 12). The 7-tab v1 is kept at `prototype-v1.html`, for its extra views: river, butterfly-only, time rings, hue and warm–cool maps.
- **Corpus findings:** `design/ATLAS/mine.py` writes `design/ATLAS/data/findings.json`.
- **Screens:** `design/ATLAS/shots/`, 440x956.
- **Best entry:** `prototype.html#p=vincent-van-gogh&w=nga-106382`.

---

## v2: one experience (2026-10-09, after David: "a good start… could be improved a lot")

**What v1 got wrong.** It was a chart deck: seven tabs, each resetting its own dock, with no thread from a career down to one relationship (critique by a fresh-context designer).

**What v2 does.** It is one vertical walk, with the controls that belong to whatever is on screen anchored under the thumb.

1. **Pick.** A serif title and one search field covering all 840 painters. A big "start here" card shows a real painting; eight featured painters each carry their career palette strip.
2. **The painting dances** (the hero).
   - The real painting is rendered in WebGL at full resolution. Each pixel's membership in each of the nine notes is a softmax in OKLab, computed in the shader. A selection is a weight per note, so every move between selections is an eased crossfade at 60 fps. The Canvas 2D fallback is the same math, precomputed.
   - It plays itself in a musical order:
     1. one family alone ("The yellows alone");
     2. a duet;
     3. their values, as a wipe that leaves the color on the left and the values on the right, with tags, so the comparison is side by side;
     4. the other relationships;
     5. the whole painting.
   - The dock holds play, a step dot per relationship and "2 of 7 · Yellows and blues". Swipe the painting to step.
   - Tap the painting to pick the color under your finger; tap more to build a duet or a chord. The caption names the relationship, its contact against chance and whether it is a discord.
   - Every named color is a chip that opens its color page in one tap.
   - One hint ("Tap the painting to pick its colors") appears once, after the first pass.
3. **Two more lenses on the same painting:**
   - **Tiles:** a honeycomb mosaic that keeps the composition; tap to isolate; "Sort" flies the tiles into color order and back.
   - **Shape:** where each color lives and which way it runs.
4. **Woven "What art says."** Under the painting comes the archive finding that fits it, measured on this painting:
   - a portrait: its center against its edges, against the lit-sitter rate for its era;
   - a landscape: top against bottom;
   - otherwise: whether it is one of the rare opposite-hue paintings.
   - Below them, all its relationships in plain words ("Side by side, opposite hues make each other look more intense"); a tap replays that one in the dance.
5. **Go wider** into the career:
   - **A computed headline.** It groups career colors by what they look like (yellows, ochres, olives…), not raw hue bins, and finds the sharpest peak, for example "Van Gogh's greens peak in Saint-Rémy, 1890" or "Monet's greens peak in Argenteuil, 1873". The cells it names are ringed. On first arrival, the years play from the start to that peak.
   - **The dock becomes the time scrubber:**
     - play;
     - a works-per-year histogram in each year's mean color;
     - life-event ticks, with a label when the thumb is on one;
     - momentum, settling on events and painted years, with a haptic tick for each year that has paintings;
     - window 1, 2 or 4 years, or All.
   - While you scrub, the headline speaks for the year in view: the year, the place, and which colors take the most. Relationship links are drawn in a lighter cousin of each color so they read on the dark ground.
   - **Tap a color** for its readout: plate, name and share; when it appears; the paintings where it is strongest; and one paper button, "See it in Still Life of Oranges…, 1889". That button opens the dance with that color already lit, so career leads back to painting.
6. **The arc.** It shows only the measures that changed (permutation-tested), names the turn ("Vividness turns up in 1887: 39 → 63, p = .04") and lists events near the turn. Steady measures collapse to one line. "We measure the color; any link to the life is yours to judge."
7. **Surprises:**
   - *Most Van Gogh:* the closest to his own average.
   - *Least Van Gogh:* with the reason, e.g. "darker than 42 of the other 47".
   - *Broke the habit:* a color used in at most two paintings, at its biggest.
8. **Relationships, year by year.** A bar per painting for the top four chords, with "mostly 1885–1889", plus the archive's opposites finding set against this painter's own rate.
9. **Compare** is one gesture: chips for Monet or Van Gogh, the painter's five nearest palettes in the archive, or "Any painter…". It produces:
   - a computed headline ("Van Gogh uses 4.4× the ochres");
   - side-by-side or overlap maps;
   - "Same years" to remove the era;
   - a shared-ground card (53%);
   - the live fingerprint: how many paintings 24 colors alone assign to the right painter.

**Works for any painter in the archive** (840 with 6+ works), with honest thin-data states:
- under 12 paintings: "read this as a sketch";
- under 8: no change points;
- under 6: no career;
- impossible dates set aside and counted;
- a museum whose images can't be read pixel by pixel: the painting still shows, with a plain note.

The dance uses whichever of the painter's works a CORS-friendly museum holds (NGA, Rijksmuseum, local copies).

**Every state is in the address:** `p`, `w`, `step` or `sel`, `lens`, `t`, `win`, `c`, `vs`, `cm`, `same`, `at`. Back and forward work, and `&still=1` freezes motion for screenshots. Legibility: reading text 16 px or more, captions 13 px or more, and every text color 4.5:1 or better (`--soft` #A9A497 is 7.8:1 on the ground and 6.7:1 on the raised surface). Targets are 44 px or more, the primary controls 52 px.

**Critique loop.**
- **v1 critique:** biggest mistake was "a chart deck, not one experience".
- **v2 critique: REVISE, average 3.7/5.** Fixed since:
  - a fade where content meets the dock;
  - Color/Values tags on the split;
  - lighter, thicker relationship links;
  - the shared-ground stat as a card with a bar;
  - the dock caption naming the current step;
  - a quieter year watermark;
  - placeholder contrast;
  - a headless paint bug that blanked the dock.
- **Kept, as the critic asked:** the honesty layer, the dotted-ring selection motif and the thin-data framing.

**Still open:**
- the "All at once" pulse mode;
- the periodic table of chords as a front door;
- the duet scrubber (two careers in lockstep);
- an offline pixel grid, so the dance works for every museum (phase 2, lane C);
- measuring the WebGL frame rate on a real iPhone (it runs fine on SwiftShader).

---

## Top 10 to build first

Ranked by wow × honesty × feasibility. Each is prototyped unless marked.

1. **The dance.** A real painting at full size. One color family lights up and the rest drops to a dim grey: just Van Gogh's yellows. Then the light slides to the yellows and blues, then to their values only, then to the next relationship, each with its name and strength. Tap the painting to build your own selection; swipe to step. (Prototyped: One painting → Dance.)
2. **Time is a slider.** Any body of work (a painter, a movement, a century) as a bubble field whose cells re-weight as you scrub years, with a play button, a window width (1, 2 or 4 years, or the whole career) and life events marked on the track. (Prototyped: Career, Van Gogh and Monet.)
3. **Relationships drawn as links that live in time.** Opposites, warm against cool and accent-on-field pairs, detected inside each painting, are drawn as links between the career's color cells. They thicken, fade and re-form as the scrubber plays. (Prototyped: the lines in Career.)
4. **The color chord taxonomy.** Twelve measurable relationships (opposites, equal-light pair, split opposites, triad, analogous run, value ladder, one hue at many strengths, warm against cool, solo accent, tonal, light against dark, discord), plus four voices (ground, bass, light, lead). Detected per painting with a strength from 0 to 100. (Prototyped.)
5. **The arc.** Every work in order as a filmstrip, with six measured curves (lightness, vividness, warm minus cool, contrast, distinct colors, hue spread). A permutation-tested change point is marked, and sourced life events sit beside the curves. The link between them is left to you. (Prototyped: Arc. It finds Van Gogh's lightening from 1886, his Paris move: 43 → 62, p = .05.)
6. **The butterfly.** Two painters on one coordinate system: hue families as rows, lightness as columns, mirrored around a spine. Agreement reads as symmetry, and a missing wing is a color one of them never used. "54% of their color falls in the same cells." (Prototyped: Compare.)
7. **The mosaic.** The painting as honeycomb tiles that keep the composition. Tap a tile to isolate its color; tap a second to see where the two touch, with the contact count against chance. "Sort" flies the tiles into color order and back: where it lives ⇄ how much there is. (Prototyped.)
8. **What art says.** Harmony learned from 23,778 paintings, not wheel math. Every finding has its n, an effect size, a null baseline and a 95% interval, and it surfaces as a "What art says" card on color pages and in a pairing tool. (Prototyped with 8 real findings, including "blue at the top, red at the bottom" and "the lit sitter on a dark ground rose and fell".)
9. **Geometry of color.** Each color's center, spread and main axis drawn on the painting, the angle between colors ("the yellows sit above and right of the blues"), and rose diagrams of which way each color's edges run. This is the honest, public-domain version of "the angles in a Pollock". (Prototyped: Geometry.)
10. **The chord progression.** Each chord as a barcode across a career in date order, so you can see when it arrives and leaves. "Tonal: 38% of his paintings before 1888, 15% after." (Prototyped: Chords.) *Next step, not built:* a "periodic table" of chords as the entry point to the whole taxonomy.

---

## 1. Principles

- **Many readings, never one palette.** Every subject gets a field, a timeline, its relationships, its geometry and its comparisons. The surface shows one calm summary; every layer is one tap down.
- **Time is a slider, and so is any variable.** Any view of a body of work can be scrubbed through time with the thumb, with play, a window width and life events marked. The same control generalizes: scrub lightness (show only colors above L), chroma threshold, the museum, the count of colors or the painting's own value bands. The arrangement stays spatial and only the weights move.
- **The color is the interface.** Bubbles and tiles carry the color. The chrome is warm black, opaque and quiet (Night Gallery). Nothing in the UI is brighter than the paint.
- **Measure, then tell.** Every sentence on screen comes from a number with a reference and an n. The doc's thresholds are the code's thresholds.
- **Never read psychology from color.** "Each color triggers one fixed emotion" is on the myths list. The arc shows the measured shift, places sourced biography beside it, and says: *we measure the color; the biography is from [source]; the link is yours to judge.*
- **Honest about the picture.** These are photographs of varnished paintings, taken by six museums' cameras. The archive holds 48 Van Goghs and 50 Monets, not their whole output. That is said once per page, not on every card.

---

## 2. Data model: what we can honestly measure

**What exists today** (no new pipeline needed):

| Source | Per painting | Coverage |
|---|---|---|
| `data/gallery/index.bin` | year, museum, aspect, mean L*, C*, six colors with area shares | 23,778 |
| `data/gallery/d/*.json` | title, artist, image URL, a **24-color pool** (RGB + area share), frame crop | 23,778 (all have pools) |
| `data/analysis/paintings-*.json` | nearest core name per pool color, accents, hidden, focal and glue colors, value key, L histogram, hue histogram, entropy, harmony fit, percentiles | 23,778 |
| `data/analysis/artists/<slug>.json` | clusters of paintings, signature and avoided colors vs the same museums, pair lift, by-decade, change point, typical/atypical | 840 painters with 6+ works |
| `data/artists/meta.json` | birth, death, movements, teachers (Wikidata) | 840 |
| Local 200 px images (`img/gallery/aic`, `smk`) | real pixels, same-origin | 4,850 |
| Remote IIIF (NGA, Rijksmuseum, Commons…) | real pixels at ~850 px when the server sends CORS headers (NGA does) | most of the rest |

**Per painting** (from the pool, OKLab/OKLCH):
- *Area shares* of k notes (k = 3–24, re-picked live from the pool, every pool color re-assigned to its nearest note, so shares always sum to the canvas).
- *Distributions:* lightness histogram, chroma distribution (muted / moderate / vivid), share-and-chroma-weighted hue histogram, warm and cool shares (OKLab a/b projected on the 60° orange-yellow axis).
- *Value structure:* key (high, mid, low), 5–95% lightness range (contrast), the lights-vs-shadows split.
- *Diversity:* effective number of colors (exp of the entropy of shares), the Gini index of shares, hue spread (circular standard deviation, chroma-weighted).
- *Relationships:* the chords (section 3), voices, and pair metrics (hue angle, ΔL, chroma ratio, area ratio).

**Per painting, from pixels** (the image itself; screen-size buffer about 400 px wide, plus a 150 px statistics copy):
- *Placement:* each note's centroid, spread (covariance), principal axis, and its share of the top, middle and bottom thirds.
- *Adjacency:* how often two notes share an edge, as a lift over what their areas predict (`A_ij / (T · p_i · p_j)`).
- *Edge direction:* a structure-tensor rose per note (Sobel gradients on L, doubled-angle mean, coherence).
- *Soft membership* of every pixel in every note (softmax over OKLab distance, τ = 0.0022). This drives the dance's feathered masks.

**Per body of work** (a painter, a period, a movement):
- *Career colors:* weighted k-means in OKLab over every pool color of every work, where each painting counts equally and hue axes are weighted ×1.35. Each cell carries its share, its presence (in how many works), its weighted mean year, the years it appears in, and the per-work shares behind it.
- *Windowed shares:* Gaussian windows over years (σ = window/2), which drive the scrubber.
- *Relationship links:* each painting's chords, with notes mapped to career cells, summed per window.
- *Series:* the six arc metrics per work, with a change point.
- *Comparison bins:* hue family × lightness band, with each painter's own mean color in each cell.

**What is not honest yet:** pixel-level statistics for paintings whose museum blocks cross-origin reads. Those get "contact and placement aren't measured for this one" on the page, and the offline fix is in phase 2.

---

## 3. The color chord taxonomy

Notes are a painting's k picked colors with OKLCH L (0–1), C and h. "Hued" means C ≥ .05 and at least 2% of the canvas, unless stated otherwise. Strength runs from 0 to 1 (shown as 0–100), and each formula is in `detectChords()` in the prototype.

| Chord | Rule | Strength grows with |
|---|---|---|
| **Opposites** | Two hued notes 150–210° apart | the weaker one's chroma, the smaller one's area, and closeness to 180°. The card reports the area ratio and, from pixels, their contact lift. |
| **Equal-light pair** | Hues ≥ 90° apart, ΔL ≤ 0.04, C ≥ .06, ≥ 1.5% each | flatter ΔL and higher chroma. The edge between them shimmers (equiluminance). |
| **Split opposites** | A key note, plus two partners each 120–175° from it and 20–110° from each other | the minimum chroma and area of the three |
| **Triad** | Three hued notes, every pair ≥ 85° apart | the minimum chroma and area |
| **Analogous run** | ≥ 3 notes (C ≥ .04, ≥ 1%), consecutive hues ≤ 25° apart, total span ≤ 75° | the run's area and length |
| **Value ladder** | ≥ 4 notes of one 40° hue band (or of the greys), lightness span ≥ 0.32, no gap over 2.4× the mean gap | span and number of steps |
| **One hue, many strengths** | ≥ 3 notes within ±13° of hue and 0.16 of lightness, max C ≥ .07, max/min C ≥ 2.5 | top chroma and count |
| **Warm against cool** | ≥ 12% of the canvas warm and ≥ 12% cool (warmth > ±0.02, C ≥ .035) | balance (min/max) and coverage |
| **Solo accent** | One note with C ≥ .09, ≥ 2.2× the canvas's mean chroma, 0.4–6% of the area, on a field ≥ 55% muted | the chroma ratio and how muted the field is |
| **Tonal** | ≥ 75% of the canvas at C < .045 | the muted share. It reports the warm-grey vs cool-grey split. |
| **Light against dark** | ≥ 20% of the canvas at L < .32, ≥ 12% at L > .68, ≤ 35% in the middle band | the extremes' area, discounted by the middle |
| **Discord** | Two hued notes ≥ 60° apart, where the hue that is naturally lighter (by OKLCH lightness at maximum sRGB chroma: yellow light, blue dark) is painted ≥ 0.08 darker than the naturally darker one | the reversal size and chroma (Denman Ross's classical "discord") |

**Voices** (who carries the painting):
- *Ground:* the largest area.
- *Bass:* the darkest note with ≥ 4%.
- *Light:* the lightest note with ≥ 2%.
- *Lead:* where the eye likely lands, scored by chroma × |L − the canvas mean| × area^0.25.

**Progressions** (over a career):
- Each chord's presence per painting, in date order, shown as a barcode.
- The before/after split at the median year, with the biggest change named in the lede.
- *Key changes:* the dominant hue family shifting, at the change point.
- *Modulation:* the strongest link in the career field changing between windows.

**Learned chords** (section 7): cluster every painting's note set (hue intervals, lightness steps, area ratios) to find empirical chord types, then compare them with this rule-based list.

---

## 4. Spatial views (the eight required, plus the ones the prototype adds)

For each view: what you see, what your thumb does, and what lands in the first three seconds.

| # | View | Position / size / order | Thumb | First 3 seconds | Built |
|---|---|---|---|---|---|
| 1 | **Career sunflower** | Golden-angle disc; most-used colors in the middle, angle = hue (greys by lightness); size = share of the surface | Arrangement chips; Colors slider (8–72); tap a cell to trace it across years | "Ochres and darks carry Van Gogh; the five biggest colors cover 27%." | Yes |
| 2 | **Time-lapse field** | Same cells, sized by share inside a moving window of years; links = relationships | Play/pause, scrub, window 1/2/4 years, life-event ticks | The blues swell and yellow–blue links appear around 1888 | Yes |
| 3 | **Time rings** | Radius = the color's weighted mean year (earliest in the middle); rings labeled by year | Same | Which colors arrive late (they sit at the rim) | Yes (Time) |
| 4 | **Hue × lightness field** | x = hue (greys at the left), y = lightness | Same | Where a painter lives in color space | Yes (Hue map) |
| 5 | **Warm–cool plane** | x = warmth, y = lightness | Same | "52% warm, 21% cool" | Yes |
| 6 | **Palette river** | Years down the page; each family a band as wide as its share, painted in the painter's own average of it | Paintings / River; per-painting Colors slider; sort by hue, light or area | "Darks shrink from 28% before 1888 to 5% after." | Yes (Years) |
| 7 | **Butterfly compare** | Rows = hue families, columns = lightness, mirrored at a spine; each painter's own mean color per cell | Butterfly / Overlap; Detail slider (3–7 columns); "Same years" | "Monet lives lighter; Van Gogh is 1.5× as vivid; 54% shared." | Yes |
| 8 | **Overlap honeycomb** | One grid, each cell split: Monet left half, Van Gogh right | Same | Asymmetry: half-cells with no partner | Yes |
| 9 | **Chord progression** | Rows = chords, columns = paintings by date, colored by the chord's own two notes | Notes slider; tap a chord for its rule | When a relationship arrives and leaves | Yes |
| 10 | **Single-painting symphony** | A wheel of notes (angle = hue, radius = chroma, size = area), relationship lines, voices, chord cards | Notes slider (3–16); Wheel / Value; tap two notes | The relationship, named, with five measured facts | Yes |
| 11 | **The dance** | The painting itself, masked by relationship | Play, swipe, dots, tap to choose | "The yellows alone" … "Yellows and blues" … "Their values" | Yes |
| 12 | **Mosaic** | Hex tiles that keep the composition; sort morph | Tiles slider (12–72), tap to isolate, Sort | Where a color lives, then how much there is | Yes |
| 13 | **Geometry overlay** | Centroids, 1σ ellipses, axes, constellation, edge roses | Notes slider | "The yellows sit above and right of the blues" | Yes |
| 14 | **Arc** | Filmstrip plus six curves over years, change points, events | Tap a dot to open the painting | "Lightness shifts up from 1886" | Yes |
| 15 | **What art says** | Finding cards with their own chart grammar | Scroll | "Blue at the top, red at the bottom" | Yes |
| 16 | **Chord diagram of co-occurring pairs** | Career cells on a circle; ribbons = pair lift across paintings | Tap a ribbon to list paintings | The painter's habitual partners | Design only |
| 17 | **Period brush** | A two-thumb year range with a histogram of works colored by each year's mean | Drag, or tap a named period | Restrict any view to "Arles to Auvers" | Yes (Years, Chords) |

### Fifteen-plus ways to *show* it on a phone (discovery, not charts)

| Form | What you see | Thumb | In 3 seconds |
|---|---|---|---|
| A palette that breathes (built) | The career field swelling and shrinking as years play | Play / scrub | A painter's color life as a pulse |
| The dance (built) | Light moving across the real painting, relationship by relationship | Swipe / tap | The painting's structure, one voice at a time |
| Mosaic morph (built) | Tiles fly from picture to color-sorted blocks | Tap Sort | Where versus how much |
| Butterfly (built) | Two painters as wings of one creature | Detail slider | Symmetry is agreement |
| Constellation (built, Geometry) | Color centers as stars joined by lines on the painting | Notes slider | Where each color lives |
| Edge roses (built) | A petal flower per color, showing its grain | — | Swirling versus straight |
| River (built) | Families as braided bands down the years | Scroll | A family growing or dying |
| Barcode progression (built) | A chord's presence in every painting | Tap a chord | When a habit starts |
| Terrain flyover | The hue × lightness field as a landscape: share = elevation; drag to fly; two painters as two islands | Drag, pinch | Mountains are habits, valleys are avoided colors |
| Tree of inheritance | Palettes as a phylogeny (teacher → pupil, movement → movement), branches colored by their signature cells | Tap a branch | Who inherited whose browns |
| Loom | Paintings as warp threads (date order) and colors as weft; a cell glows where a color is used, so co-occurrence becomes woven patterns | Scrub the loom | Repeating motifs across a career |
| Periodic table of chords | 12 chord tiles; each shows its strongest painting in the archive, its frequency by century and a live example | Tap a tile → the dance on that painting | A vocabulary of relationships |
| Palette weather | A day-by-day "forecast" strip of a painter's year (where dates are fine-grained, e.g. Monet's series) | Scrub the months | Light changing within one subject |
| Duet scrubber | Two painters' time-lapses on one field, two cell outlines per color | Two scrubbers, or lock them to the same year | Who got to blue first |
| Your mirror | Your favorites (the Learner Model) drawn as a field beside the painter whose field is nearest | Tap "whose palette is yours" | "Your palette is 71% Monet, 1890s" |
| Remove one color | The painting with one note swapped to its neighbors; the chords that collapse are listed | Tap a note → Remove | A note's load-bearing score |
| Fisheye on a career | The honeycomb lens over the time-ordered sunflower; magnify one year | Drag the lens | Detail without losing the whole |
| Map overlay | The archive map (Home) with a painter's cells lit in place | Toggle "his colors on the map" | Where in all color a painter lives |

---

## 5. Controls

- **Calm surface:** one hero view, one lede sentence computed from the data, and a caption with the n.
- **The dock** (thumb zone, opaque e1 panel), with at most four rows:
  - the arrangement (Most used · Time · Hue map · Warm–cool · Light);
  - time (play button, scrubber with a works-per-year histogram in each year's mean color and life-event ticks);
  - window (Whole career · 1 · 2 · 4 years);
  - count (Colors 8–72, Notes 3–16, Tiles 12–72, Detail 3–7).
- **Filters:** years (scrubber or two-thumb brush, plus named periods), museum (next phase: per-camera bias is known in `groups.json`, so the filter can also offer "correct for camera cast"), family (tap a row in the butterfly or a band in the river).
- **Compare:** any two bodies of work, with "Same years" to remove the era confound.
- **Center on:** reuses the map's ideas: Vivid, Greys, Light, Dark, Most used, Time.
- **Depth one tap away:** tap a cell → a readout in place (plate, name, share, years, thumbnails); tap a chord → its rule; tap a dot in the arc → the painting.
- **Tap rule (decided by David, 2026-10-09):** in the Atlas analysis views, tapping a color *selects* it: it lights the color, or builds a pair or chord. The color's name chip (or the named plate in a readout) opens its color page in one tap. Every other color tap in the app stays "one tap opens".

---

## 6. The animated readings

**Across time** (Career, prototyped):
- Colors are found once over the whole career, so cells keep their identity, and they are packed at the largest size they reach in any window, so scrubbing never overlaps them.
- At each moment, cell size is the share inside a Gaussian window. A cell fades to nothing when a color isn't used and swells back when it returns.
- Every painting's chords are mapped to career cells, and those links are summed in the window.
  - Line style: solid = opposites (including split opposites, equal-light pairs and discords), dashed = warm against cool, dotted = an accent on its field.
  - Each link is a gradient from one cell's color to the other's, and its width is the windowed strength.
- The lede names the year, any life event within six months, and the strongest vivid relationship at that moment.
- Reduced motion: the player steps a year at a time.

**Across one painting** (the dance, prototyped):
- The base is the painting desaturated and dimmed, never hidden. Over it sits a canvas holding the painting's own pixels, with alpha set by each pixel's soft membership in the selected notes. Edges are feathered by the softmax, not cut.
- Each step is a crossfade of the mask and of "valueness" (color → greyscale value) over 1.2 s, eased, then a 2.3 s hold.
- The sequence is ordered as a musical arc:
  1. *Single voice:* the most vivid family.
  2. *Duet:* add its strongest partner chord.
  3. *Values:* the same selection in greyscale, with the lightness gap stated.
  4. The remaining relationships by strength (ladders and light-against-dark are shown as values).
  5. *Coda:* the whole painting.
- Tap to pause and choose: a tap picks the note under your finger (up to four), and the caption names the relationship. Swipe to step; dots act as a scrub bar.
- "All at once" mode (next): every chord pulses with its strength, which needs WebGL for 60 fps at full resolution.
- Performance: about 250k pixels per frame in Canvas 2D, interpolating precomputed masks. Measure it on an iPhone. WebGL is the phase-2 path (the Lab-per-pixel texture plus a membership shader).

**How the dance and the mosaic connect:**
- They are two renderings of the same selection (`S.pair`): the dance is the picture, the mosaic is the counted tiles.
- The step dots should appear in both, and "Sort" in the mosaic is the dance's "how much" beat.
- Merge with what exists:
  - Studio's Isolator (reveal alone) becomes the dance's Choose mode.
  - paintzoom's Look closer "Where" mode becomes the mosaic.
  - palettes.js clusters become the notes.

---

## 7. Harmony learned from art

An empirical layer mined from the corpus. Code: `design/ATLAS/mine.py`. Output: `data/findings.json`.

**Rules:**
- A minimum n per claim.
- A null baseline that keeps the confounds: shuffles are stratified by museum × century, so camera cast and varnish stay in the null.
- 95% intervals: bootstrap, or Wilson for proportions.
- A claim is dropped when its interval includes the null.
- Every card says "as photographed".

**Real findings (computed, n stated):**

1. **Painters keep hues close; true opposites are rarer than chance.** Within a painting, two *distinct* notes (OKLab distance ≥ .08) 0–15° apart co-occur **1.59×** as often as when paired with a random painting from the same museum and century (95% 1.57–1.61). Near-opposites (165–180°) co-occur **0.65×** (0.60–0.69). The pull toward close hues grows from **1.36×** before 1500 to **2.15×** in the 1900s. n = 21,218 paintings. *The wheel's complementary rule is the exception in museums, not the habit.*
2. **Blue at the top, red at the bottom.** Median height on the canvas (0 = top), over paintings where the family covers ≥ 2%:

   | Family | All paintings | Landscapes |
   |---|---|---|
   | Blues | .26 | .17 |
   | Deep blues | .29 | |
   | Pales | .39 | |
   | Greys | .46 | |
   | Ochres | .52 | |
   | Darks | .52 | .66 |
   | Browns | .55 | |
   | Reds | .59 | |

   n = 4,656 local images (Chicago and Copenhagen).
3. **The lit sitter on a dark ground rose and fell.** Portraits whose middle is lighter than their edges:

   | Period | Share | 95% interval | n |
   |---|---|---|---|
   | Before 1700 | 67% | 60–74 | 179 |
   | 1700s | 89% | 84–92 | 205 |
   | 1800–1849 | 92% | 85–95 | 118 |
   | 1850–1899 | 56% | 42–69 | 50 |
   | 1900s | 44% | 29–59 | 39 |

   Center box vs outer band; the null is 50%.
4. **Light above, dark below, except in portraits.** Top third lighter than the bottom third: landscapes **84%** (81–87, n = 696), portraits **44%** (40–48, n = 591), everything else 58%.
5. **Warm lights belong to portraits.** The lightest fifth of pixels is warmer than the darkest fifth in **92%** of portraits (89–94) and **50%** of landscapes (46–53). Caveat: yellowed varnish warms lights.
6. **A palette dates a painting, roughly.** From palette features alone (25-nearest-neighbor median year, 5-fold cross-validated), half of 23,129 paintings are dated within **±86 years**; guessing the archive's median year gives ±112. It works best in the 1600s (±50) and worst for gold-ground panels, which read as 1800s. That misfit is itself the finding: gold photographs like 19th-century warm light.
7. **Whose palette is it?** Among 158 painters with 20+ works, the nearest painter-average palette is right **6.6%** of the time (top five 20.7%), against 0.63% chance (n = 5,734, leave-one-out). Monet against Van Gogh is computed live in the prototype.
8. **Partners art actually chooses.** Once museum × century rates are taken out, few cross-hue pairs beat chance. They are mostly a deep red or olive against near-black: seal brown with smoky black **1.35×** (n = 1,175); maroon with smoky black 1.5× (n = 61). *Art's habitual pairs are value pairs, not wheel pairs.*
9. **Does one color rule the canvas?** The median Gini of area shares rises from .39 (before 1500) to .48 (1600s) and falls back to .39 (1900s). The 1600s are the most "one-color-dominated" century (partly varnish merging dark clusters).
10. *Non-finding, shown as one:* the light flesh note at the center of portraits barely moves across four centuries (#A88462 → #AB886C, n = 393). Photographed flesh is remarkably stable.
11. *Kept out of the UI:* family adjacency lifts (darks almost never touch pales directly, 0.01×) mostly measure gradients and downsampling, not choices. They stay in the JSON with that caveat.

**Methods still to run** (each with the same null and n rules):
- **Association rules** ("if a painting has X and Y it likely has Z"), with support ≥ 50 and lift CI > 1, mined per movement and era.
- **Empirical chord types:** cluster each painting's note set by its intervals (hue steps, ΔL ladder, area ratios), then compare the clusters with the rule taxonomy. Report how much of the corpus each classical harmony explains (expect: analogous and value structures dominate; complementary is rare).
- **Skin-tone families:** cluster flesh notes in portraits (the flesh band from mine.py), then measure what surrounds them (ground hue and value) by era and country.
- **Region and era palettes:** lift of names by country × century, using `groups.json`'s camera-bias correction.
- **Figure versus ground via saliency:** replace center-weighting with a contrast-saliency map once full-resolution grids exist.

**How it surfaces in the app:**
- A **"What art says" card** on every color page: "Goes with, in paintings: …" (lift, n), "Usually sits: top third (sky)", "Most often as: a shadow note."
- **Finding cards** in the Museum room.
- A **pairing tool** in Studio that suggests partners from art statistics ("painters pair this with…") beside the wheel math, and shows both.

---

## 8. Divergent passes: analysis ideas

Scored as **W**ow / **H**onesty / **F**easibility, each out of 3. ★ means kept for the roadmap. Each kept idea gives the method, the data it needs, a sample finding sentence and its visualization.

**Round 1: borrowed from other fields (32)**

| # | Idea | Method · data · sample · viz | W/H/F |
|---|---|---|---|
| 1 ★ | Color embeddings (linguistics) | word2vec on paintings-as-sentences of names; pools + names · "Vermilion is used like a lead, not like other reds" · map of colors by context | 3/2/3 |
| 2 ★ | Palette analogies | vector arithmetic on embeddings · "Monet : Van Gogh :: slate : ochre" · analogy cards | 3/1/3 |
| 3 ★ | Diversity indices (ecology) | Shannon/Simpson of shares; pools · "His palette's richness doubles in Paris" · arc curve | 2/3/3 |
| 4 ★ | Endangered colors | names whose share falls across centuries; index.bin · "Lead-tin-like yellows vanish after 1750" · red-list cards | 3/2/3 |
| 5 ★ | Chords (music) | the taxonomy; pools · section 3 · chord cards | 3/3/3 |
| 6 | Tension and resolution | the accent-to-field ratio along the eye path; pixels · weak | 2/1/2 |
| 7 ★ | Rhythm along a line | color sequence sampled along a diagonal or horizon; pixels · "Six beats of yellow across the field" · strip | 2/3/2 |
| 8 ★ | The painting's key | dominant hue + value key (like a musical key); pools · "In ochre minor" · key badge | 2/2/3 |
| 9 ★ | Gini / Lorenz (economics) | inequality of shares; pools · finding 9 · Lorenz curve | 2/3/3 |
| 10 ★ | Palette phylogeny (genetics) | tree from palette distance + Wikidata teachers; artists · "Mauve's greys run through Van Gogh's Hague years" · tree | 3/2/2 |
| 11 | Borrowing between movements | signature-color transfer over decades; groups.json | 2/2/2 |
| 12 ★ | Spatial frequency of color | per-note texture energy (where the busy color lives); pixels · "Blues are calm fields, yellows are busy" · energy bars | 2/3/2 |
| 13 ★ | Temperature gradient top→bottom | warmth by row; pixels · "Cool skies, warm earth in 78% of landscapes" · gradient strip | 3/3/3 |
| 14 ★ | Center of mass per color | centroid + PCA axis; pixels · finding 2, Geometry · constellation | 3/3/3 |
| 15 ★ | Contrast at edges vs fields | ΔE at label boundaries vs inside regions; pixels · "He puts his strongest contrasts on edges" · edge map | 2/3/2 |
| 16 ★ | Painting as terrain (geography) | L as elevation; pixels · "The light is a ridge across the middle" · 3D terrain | 3/3/2 |
| 17 ★ | Co-occurrence network | colors as nodes, lift as edges; pools · "Smoky black is the hub" · network | 3/2/3 |
| 18 ★ | Communities and bridge colors | modularity on that graph · "Olive bridges the Dutch and French palettes" · communities | 3/2/2 |
| 19 ★ | The most un-Monet Monet (anomaly) | distance from the painter centroid; pools · built live · two cards | 3/3/3 |
| 20 ★ | Dating from palette | kNN regression · finding 6 · the misfit gallery | 3/3/3 |
| 21 ★ | Style fingerprint | nearest centroid · finding 7 · "whose palette" game | 3/3/3 |
| 22 ★ | Surprise | −log P(color \| painter's base rate) per note · "This violet is a 1-in-200 note for him" · surprise halos | 3/3/3 |
| 23 | Seasonality / plein air | month-level dates are rare in metadata · too thin | 2/2/1 |
| 24 ★ | Varnish as a measurable confound | museumBias + yellowing model; groups.json · "Corrected for camera, the Rijksmuseum's 1600s are 3 points lighter" · before/after toggle | 2/3/2 |
| 25 | Survival analysis | how long a color stays in a painter's use; needs dense dating | 2/2/1 |
| 26 ★ | Markov chains of adjacency | which color follows which across edges; pixels · "Yellow is usually framed by green" · flow diagram | 2/3/2 |
| 27 | Granger causality between movements | far too few time points · dropped | 1/0/1 |
| 28 ★ | Information content (bits per palette) | entropy vs archive · "His most information-dense year: 1888" · arc curve | 2/3/3 |
| 29 ★ | PCA of the archive | principal axes of palette space · "The archive's first axis is 'varnish'" · a 2D atlas of all paintings | 3/2/3 |
| 30 | Benford-like regularities in shares | meaningless here · dropped | 0/1/3 |
| 31 ★ | Changepoints (statistics) | permutation-tested best split · built (Arc) | 3/3/3 |
| 32 ★ | Fractal dimension per color (Pollock) | box-counting on each note's mask; pixels · contested research line (Taylor et al.; disputed by Jones-Smith & Mathur) · shown as "how space-filling" with that caveat | 2/1/2 |

**Round 2: genuinely new (22), avoiding everything above**

| # | Idea | Method · sample · viz | W/H/F |
|---|---|---|---|
| 33 ★ | Load-bearing score | remove a note (re-assign its pixels to their next-nearest) and count the chords that collapse · "Remove the orange beard and three relationships vanish" · Remove button | 3/3/3 |
| 34 ★ | Palette transplant (counterfactual) | optimal-transport map of this painting's notes onto another painter's career cells · "Farmhouse in Provence in Monet's palette" · side-by-side | 3/2/2 |
| 35 ★ | Eye path through accents | order accents by saliency proxy (chroma × local contrast); pixels · "The eye goes beard → eyes → hand" · numbered path | 3/1/2 |
| 36 ★ | Directional co-occurrence | which color tends to be above/left of which across a career (centroid vectors) · "His yellows sit above his blues in 70% of paintings" · arrows | 3/3/3 |
| 37 ★ | Edge orientation roses | structure tensor per note · built · roses | 3/3/3 |
| 38 | Layering / occlusion | T-junction heuristics on boundaries; low confidence at 150 px | 2/1/1 |
| 39 ★ | A year in a life | within-year variance vs between-year · "His 1888 alone spans more color than all of Holland" · nested rings | 3/3/3 |
| 40 ★ | Which painter's palette is yours | the Learner Model's favorites vs painter centroids · "You're nearest Monet, 1890s" · your mirror | 3/2/3 |
| 41 ★ | Your eye vs art history | colors you favor vs the archive's lift · "You love what the 1600s avoided" · two fields | 2/2/3 |
| 42 ★ | Games that are analyses | "Which decade?" (dating), "Whose palette?" (fingerprint), "Find the opposite in this painting" (chords) · each round adds a labeled data point | 3/3/3 |
| 43 ★ | Cross-domain lenses | measure fashion, film, photography, pulp covers and gems with the same notes/chords/geometry · "Pulp covers use opposites 4× more than paintings" · same views, any corpus | 3/2/2 |
| 44 ★ | Series grammar (Monet's grainstacks) | the same subject at different times: hold composition, compare notes · "The snow effect is a value ladder; the sunset a split opposite" · small multiples | 3/3/2 |
| 45 | Echoes | the same note reused in distant parts of a canvas (rhyme) · "This red rhymes three times" · lines on the picture | 2/2/2 |
| 46 ★ | Rarity map of the archive | which hue × lightness cells are rare across all art · "Bright violets: 0.1% of all painted surface" · map overlay | 3/3/3 |
| 47 | Restoration twins | the same painting before and after cleaning, where both photos exist · rare data | 3/3/1 |
| 48 ★ | Painting "keys" over the archive | key distribution by century · "Minor keys rule the 1600s" · ring chart | 2/2/3 |
| 49 ★ | Color half-life in a career | how long a newly adopted color stays · "His blues outlive his greens" · lifelines | 2/3/2 |
| 50 | Prices and provenance | not in our data | 1/2/0 |
| 51 ★ | Shared-subject comparisons | all "Water Lilies" or all "Self-Portraits" across painters · "Self-portraits are 9 points darker than the painter's mean" · grid | 3/3/2 |
| 52 ★ | Negative space | what a painter never uses inside his own range (holes in the field) · "Monet never uses a dark red" · the butterfly's empty wing | 3/3/3 |
| 53 | Weather and light metadata | no reliable source | 1/1/0 |
| 54 ★ | "Fake or not" teaching set | atypical-for-painter scoring on known misattributions (the data already caught one: a 1658 "Van Gogh") · catalog QA plus a game | 2/3/3 |

**Round 3: combinations**

| Combo | What it becomes |
|---|---|
| Embeddings × time | **Color meaning drift:** a color's nearest "context neighbors" per century ("crimson moved from the robes to the lips") |
| Phylogeny × geography | **Palette migration map:** signature cells moving from Antwerp to Paris to Arles, over a map |
| Time-lapse × chords | **Chord weather:** the career field's links forming and fading (built) |
| Geometry × career | **Where his yellows live, over time:** centroid drift per year ("the yellows climb from the ground into the sky after 1888") |
| Mosaic × game | **"Find the opposite":** tap the two tiles that form the opposite pair; scored against the detector |
| Load-bearing × dance | **The collapse:** remove a note in the dance and watch the relationships go dark one by one |
| Dating × anomaly | **The time-traveler gallery:** paintings that look a century out of time, with the reason (gold ground, unfinished, a museum's camera) |
| Your mirror × arc | **Your arc:** your own favorites over months, beside the painter you most resemble |
| Butterfly × time | **The duet scrubber:** two painters' fields scrubbed together on one timeline |
| Cross-domain × What art says | **"Art says / fashion says / film says":** the same card, three corpora |

**Ranking for the build** (wow × honesty × feasibility): the dance; time slider + links; chords; arc with change points; butterfly; mosaic; What art says; geometry; surprise; load-bearing; dating game; directional co-occurrence; series grammar; rarity map; embeddings.

---

## 9. Honest caveats (one line on screen, the rest here)

- **As photographed:**
  - Varnish yellows and darkens, more on old pictures.
  - Six museums' cameras differ: per-source casts are in `groups.json`'s museumBias.
  - Screens differ again.
- **Coverage:**
  - 48 Van Goghs and 50 Monets (Monet was capped at 50), so this is not the catalogue raisonné.
  - Monet's cataract years hold 2 paintings, so the prototype says that rather than measure.
  - A misdated "Van Gogh" from 1658 is set aside and the count says so. It is a catalog error worth fixing upstream: `commons-Q121545841`, actually Pieter Thijs.
- **Archive bias:** Dutch, Danish and American holdings dominate. Spatial findings use the 4,656 local images (Chicago and Copenhagen) only.
- **Resolution:** pixel statistics run at 150 px (statistics) and about 400 px (the dance), so edge roses show the grain of the brushwork, not strokes.
- **Statistics:**
  - Small groups are anecdotes (n under about 15).
  - Change points need about 8+ works.
  - Every finding has a stratified null.
- **Copyright:** Pollock (d. 1956) and Rothko (d. 1970) are in copyright, so no images. Showing measured-only statistics for in-copyright works (no reproduction) needs a separate legal check before we compute or publish anything about them. The prototype uses only public-domain works.
- **Psychology:** never inferred from color. Life events are placed beside the curves with their source, and the viewer judges.

---

## 10. Build plan (3 phases, with lanes)

**Where the subject palette view goes next.** The parallel Sonnet lane's generic "subject palette view" (count slider, measures, filters, arrangements) becomes the Atlas's *surface*: the career field and its dock. Its next steps:
1. Run it on career cells, not one merged palette.
2. Add the time row (play, scrub, window).
3. Add the relationship links.
4. Make it the entry to Arc, Chords and Compare for any subject (painter, movement, decade, museum, your favorites).

**Phase 1: the painter atlas** (2 lanes, about a week):
- **Lane A, Engine** (`js/atlas-engine.js`):
  - career colors (weighted k-means), windowed shares, chord detection, voices, change points;
  - pure functions, unit-tested against this prototype's outputs (Van Gogh 36 colors; "Ochres and darks carry…").
- **Lane B, Painter page:**
  - Career (sunflower + time row + links), Arc and Chords on `#/painter/<slug>`, reusing the honeycomb's packing and glide;
  - addresses: `#/painter/<slug>/atlas`, `/arc`, `/chords`.

**Phase 2: one painting, fully** (2 lanes):
- **Lane C, Pixels:**
  - an offline `tools/pixels.py` writes a 160 px Lab grid per painting (about 25 KB each, lazy) for every museum, so contact, geometry and the mosaic work everywhere, not only on CORS hosts;
  - WebGL dance (a membership texture plus a crossfade shader).
- **Lane D, Painting page:**
  - Dance, Mosaic and Geometry on `#/gallery/<n>`;
  - merge Studio's Isolator (into Choose), paintzoom "Where" (into Mosaic) and palettes.js clusters (into notes).

**Phase 3: compare and learn from art** (2 lanes):
- **Lane E, Compare:** butterfly, overlap and duet scrubber for any two subjects (painters, decades, movements, you vs a painter).
- **Lane F, What art says:**
  - mine.py into `tools/`;
  - findings with CI gates in CI;
  - color-page cards;
  - the pairing tool;
  - the "Whose palette" and "Which decade" games.

Every lane screenshots each state at 440x956 and 375x812 and gets a fresh-context craft critique before merge.

---

## 11. States to design (beyond the prototype)

- **First time:** the dance plays itself once (taught by doing), then stops on the whole painting with "Tap any color in the painting".
- **Loading:** the career field's cells fade in by share. The dance shows the dimmed painting at once and the light arrives when the pixels are ready.
- **Empty:** a window with no paintings says "No paintings near 1882 in the archive" (built).
- **Error:** "This museum's image can't be read here" (built).
- **Come back tomorrow:** "Today's painting" opens on the dance.
- **Few works:** fewer than 6 paintings shows the painting list, not a field. Fewer than 8 hides change points.

---

## 12. The prototype

- **Run:** from the repo root, `python3 -m http.server 8813` (any port but 8791), then open `http://127.0.0.1:8813/design/ATLAS/prototype.html#p=vincent-van-gogh&w=nga-106382`.
  - v2 addresses: `#p=<painter>&w=<painting>&step=<n>|sel=<i,j>&lens=dance|tiles|shape&t=<year>&win=1|2|4|0&c=<cell>&vs=<painter>&at=career|arc|surp|compare`.
  - `&test=1` drives the real controls as a self-test and reports into `#out`.
  - The v1 addresses still work in `prototype-v1.html`.
- **Data:** nothing is mocked. It reads `data/gallery`, `data/artists`, `data/analysis/artists` (nearest palettes), `data/core-names.json` and `findings.json`.
  - The dance reads museum IIIF images that send CORS headers (NGA, Rijksmuseum) at about 850 px.
  - Chicago and Copenhagen images are local but only 200 px wide.
- **Known gaps:**
  - The frame rate isn't measured on an iPhone (WebGL, with a Canvas 2D fallback).
  - No museum filter.
  - The periodic table, terrain, tree and loom are design only.
  - Haptics use `navigator.vibrate`, which does nothing on iOS.

## 13. Critique log (fresh-context critic, CRAFT-RUBRIC + DAVID-MODEL, 2026-10-09)

**First pass: REVISE.** Scores (1–5):

| Line | Score |
|---|---|
| First 10 s | 4 |
| Depth | 5 |
| Disclosure | 4 |
| Feedback | 4 |
| States | 2 |
| Honesty | 5 |
| Return | 3 |
| Clean | 3 |
| Polish | 3 |
| Delight | 4 (the dance) |

**Must not regress:** the computed serif lede on every view; no white flips, glass or mono; the dance.

**Fixed:**
1. The view rail looked cut off. It now has an edge fade and end padding.
2. The "Blue at the top" chart had overlapping labels. It is now a canvas frame with dots at their true height and relaxed, leader-lined labels on the right.
3. Text was hidden under the dock. The painting header is compacted (the painting's title is now the page title, with smaller thumbnails), the Wheel/Value toggle moved inline, and the page gets bottom padding.
4. The chord barcodes were tiny. Strips are now 34 px with 2 px gaps, and each row leads with "n of N · mostly 1887–1889".
5. Butterfly absences were near-invisible. They are now dashed rings, with a 3.5 px minimum dot.
6. Career links cut through labels. Links now run behind the cells, edge to edge, and are only drawn between cells that still show the relationship, so no "green against blue: opposites".
7. The readout's name now shows "›", saying it opens the color page in one tap.

**Still open:**
- **States** (first-run hint, loading skeleton for the field) are designed in section 11 but only partly built.
- **Tap-to-select in analysis views:** decided by David, 2026-10-09 (see section 5).
