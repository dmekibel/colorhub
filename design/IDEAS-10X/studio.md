# Ideas 10×: Studio, camera, photos, palettes, Mix lab, Taste, exports

Area panel, round 2 (2026-10-08). Scope: `js/studio.js` (home, gamut wheel, `extractPalette`, `paletteView`, share card), `js/camera.js`, `js/photos.js`, `js/taste.js` + `js/tastemodel.js`, the Harmony and Albers labs in `js/labs.js`, the Zorn model in `js/match-model.js`, ROADMAP §8, §15, §16, §18, and the print-shop note in NOTES-TRACKER.

Builds on GENIUS-PANEL-1 and doesn't repeat it. Panel 1 already proposed these for this area, and this file treats them as the foundation: *Your photo's twin painting* (moment 1), *Words you didn't have* (2), *Name it before the camera does* (7), *Masters' chords* (9), "As painters paired it", "Every palette is a lesson and a board", one `intervalOf()`, and the Mix lab's myth presets, limited-palette reach and predict-before-mix. Where an idea below extends one of these, it says so.

Respects the rejections: no 101 status anywhere (X19), never one palette (X23), no "trivial find your color" tools (X26), no mixing with your own tubes for now (X5), solid controls (X10), one tap opens a color's page (X14).

---

## 1. Diagnosis: what's thin, boring, confusing or ugly today

**Studio home is a drawer of nine unrelated doors.** It has three capture tiles (wheel, camera, photo), two lab tiles (Harmony, Albers), two taste tiles, a photo rail and a palette list. None of them knows the others exist. A photo doesn't offer the wheel, the wheel doesn't offer the photo, and the taste result doesn't touch the photos. It reads like a toolbox, not a room with one idea in it.

**A photo gets one reading, three ways.** `paletteView` shows k-means at 3, 6 or 10 colors, as stripes, by area or as chips. That's one palette at three zoom levels, which is exactly what the philosophy forbids. The painting pages already have far richer readings in `data/analysis/paintings-*.json`: `acc` (accents), `hid` (hidden colors), `foc` (focal), `glu` (glue tone), the value key, the harmony fit `hf` and archive percentiles. A user's own photo gets none of them, so the photo and the painting are two different kinds of object when they should be one.

**`extractPalette` is good engineering with no voice.** It over-clusters, weights by vividness and adds accents. But the user never learns *why* a color was picked, and the fine print ("k-means in OKLab") is the only explanation. The counts are fixed at 3, 6 and 10, while ROADMAP §13 promised a 3–20 slider.

**The camera is a name-reader, not a teacher.** It reads the center patch live and names it. That's a great first trick, but it's also where learning ends. There's no guess-first mode and nothing that turns a find into a lesson. The white-balance button corrects readings silently, though the cast itself is the most interesting thing in the frame. **It still leaks the 101.** `camera.js:60` shows "Nearest lesson word" from `nearestColors()`, which searches only `EVERY() = BASICS + ALL` (the lesson set), and `:58` says "A lesson word". That breaks CLAUDE.md's rule and ROADMAP §17 job 1 ("Studio rows drop 'lesson word'").

**The labs leak the 101 too, and break one-tap.** Harmony (`labs.js:127`) and Albers (`:155`) name colors with `appName()`, which is the nearest *lesson* color, shown as "≈ Teal". Harmony's rows are `data-copy` buttons with no `data-swatch`, so tapping a color copies a hex instead of opening its page. The same row pattern in `paletteView` and the gamut wheel copies on a row tap and opens the page only from the small chip. That's two behaviors for one gesture.

**The gamut wheel is a lovely toy with no consequence.** Five preset masks named by mood (Warm, Cool, Triad, Muted, Complement) aren't connected to any painter, photo or mix, though a gamut mask is *literally* the hull of what a limited palette can mix (the Zorn station in `match-model.js` already computes this!). Its "Names" toggle labels 7 basic hues. It's a fixed-lightness slice of a 3D solid, and nothing says so. It uses OKLab hue while Harmony uses CIELAB hue, and the fine print apologizes for the mismatch instead of fixing it.

**Taste is clever math with a dead end.** The Bradley-Terry model (`tastemodel.js`) is genuinely smart. But its painter match reads `STATS.byArtist` from two museums ("In two museums' collections"), while the app owns 23,531 paintings and 837 analyzed painters. "Find your color" and "Find your palette" are two separate 20-tap tests with two result screens. Neither result feeds the Learner Model, the gallery's "Matches your taste" preset is buried in Explore, and the test never asks again to see whether your taste moved. "Spot the master" fakes are hue-rotated copies, which trains "spot the weird hue", not seeing.

**Exports are two clipboard buttons.** "Copy as CSS" and "Copy hex list". ROADMAP §8 approved Procreate, .ase, Figma and CSS; none exist. Saved palettes have no roles, no names in the file and no tints.

**The Mix lab doesn't exist, and its model half already does.** `match-model.js` has a 10-band spectral model (Wyman-Sloan-Shirley observer fit, D65 light, a Burns-style weighted geometric mean, hand-drawn reflectance curves for 4 paints), but it's locked inside one Train station. Mixbox is CC BY-NC, so the plan has to grow this in-house model, not license one.

**Dead and duplicate surface.** `LAB.namer` (`labs.js:169`) has no tile pointing to it anymore. It's a second "name a color with the camera" that averages *raw* sRGB (the camera correctly averages linear light), so it would give a different answer for the same patch. Photos (IndexedDB), palettes (`S.palettes`) and taste (`S.taste`) are three separate collections.

---

## 2. North star

**Studio is where your world becomes a color dataset, read the way the archive reads a masterpiece.** Anything you point at, upload or open (a photo, the camera, a painting, a flower, a decade) arrives as the same object and gets the same honest readings as a Vermeer: its accents, its hidden colors, its focal pull, its key, its twins across 23,531 paintings, and the words for every color in it. Then Studio lets you *play the palette like an instrument*: transpose it, invert it, re-voice it, mix it in four physics, clip it into a painter's gamut, export it into the tools designers actually use. Every operation is named, every color opens its page, and every guess you make before a reveal teaches the Learner Model what you see and what you miss. A first-time user should leave Studio unable to look at a "white" wall the same way again.

---

## 3. Ideas, ranked (★ = the five best)

Format: **What** · **Why 10×** · **Connects** (two or more systems) · **Effort** · **Honesty risk**.

### 1. ★ The Isolator: "you'd call it white"
- **What:** Tap any spot on any image (your photo, the frozen camera, any of the 23,531 paintings). First you guess its name from four same-family options; one distractor is always *the color its surroundings suggest* (the classic error). Then the rest of the image falls away to the booth's neutral grey and the patch stands alone, large, with its precise name: "You'd call it white. Alone, it's Lavender grey." Hold to bring the context back; release to isolate again.
- **Why 10×:** This is the single deepest seeing lesson a painter learns (color is relative to its surround; shadows on snow aren't white), done in two seconds with your own world as the material. It's Albers' lab moved out of a demo and into everything you photograph. It's guess-first, so it counts as honest recall, and the reveal is a genuine surprise almost every time.
- **Connects:** Albers lab (absorbs it), Train (the booth surround from `css/booth.css`; the `iso` misses feed a "context" weak axis), Learner Model (`recall_ok`/`pick_wrong` with `as` = the context name, `surf: "photo"|"camera"|"painting"`), painting pages (works on every painting through the image; the `hid` colors become one-tap "isolate this" suggestions), camera.
- **Effort:** S–M (spec in §6). **Honesty:** the patch is "as photographed". Phone cameras auto-white-balance, so offer WB first when the frame is strongly cast. The surround-grey is a fixed L* 50, and the fine print says why (a neutral surround, as color matchers use).

### 2. ★ Twins with threads: your photo in the archive, color by color
- **What:** Extends panel 1's *Your photo's twin painting*. Every photo, camera frame or saved palette gets a "Closest in the archive" row: the 5 nearest of 23,531 paintings by matched palette distance (the same two-way, area-weighted matching as `glSimilar`, but taking an outside palette). Each twin shows **threads**: your sky ↔ his sea, your wall ↔ her apron, as pairs of named chips. Tapping a twin opens the painting with the matched color highlighted (`galleryPage(i, true, fromHex)` already does this). Under the row: "Your nearest 200 paintings lean 1880s (34%), mostly landscapes", or honestly, "Nothing in the archive is close; here are the nearest anyway." **Live twin:** in the camera, a small corner thumbnail of the current nearest painting, updating twice a second as you pan the room.
- **Why 10×:** It answers the Teen's question ("which painter does my life look like?") with measured color, not vibes. The threads turn a fun result into a seeing lesson: you learn that your grey kitchen and a Hammershøi share a *specific* grey, by name. Pointing the camera around a room and watching the twin change is the most shareable thing Studio could do.
- **Connects:** painter and painting pages, Color Graph (*appears in*), Cabinet (save a twin pair as one card), Explore (Paintings search seeded by your photo), Learner Model (`seen` events for the paintings), Journey (a twin is a ready-made world step for any unknown name in your photo).
- **Effort:** M (the core is buildable today, §6). **Honesty:** "Color only, as photographed. Not style, not influence." Archive colors skew brown (varnish), so a twin is a color twin of a photograph. Show a confidence and never round a weak match up.

### 3. ★ The Score: a palette you can play
- **What:** David's music framing made into *verbs*, not decoration. Every palette (from a photo, the wheel, a painting, your taste) can be shown as a score. Vertical position is lightness (a palette's "register"), width is area (how long and loud each note is), and the gap between neighbors is labeled with the shared `intervalOf()` words (neighbor, third, complement, value step). It carries a one-line reading: "A warm triad in a low key, one bright accent." Then the operations every musician knows:
  - **Transpose:** rotate every hue by the same angle and keep every interval. The palette stays "the same tune" in a new key, which shows that harmony lives in the relationships, not the hues.
  - **Invert:** flip lightness (light ↔ dark) and keep hue and chroma. The same chord in a night voicing.
  - **Re-voice:** redistribute area (60-30-10 vs an even split vs one-note-loud) and keep the colors.
  - **Change key:** compress or stretch the value range (high key, low key, full range).
  - **Resolve:** pull the most tense color (the biggest chroma or complement pop) one step toward its neighbors and show the tension meter fall.
  Each result is named with `nameOf`, every chip opens its page, and "Keep" saves the variation with its derivation ("transposed +40° from your kitchen photo").
- **Why 10×:** Today Harmony is a scheme picker (complementary, triadic…) like every color app. The Score teaches the one idea those apps never teach: *a palette is a set of relationships you can move as a whole.* It makes the music framing pay off as a real tool while staying honest about being an analogy.
- **Connects:** Harmony lab (absorbed; its schemes become chord shapes), Train (the "name the interval" and "spot the wrong note" stations from ROADMAP §16 use the same vocabulary and boards), articles (the harmony wiki node links in), Masters' chords (panel 1; real archive chords appear as "standards" you can transpose), exports (the derivation travels with the file).
- **Effort:** M–L. **Honesty:** the fine print says it's an analogy: light has no musical ratios, and Newton chose seven rainbow colors to match the scale (myth list). Lightness-as-pitch is *our* mapping, chosen because both are ordered scales. No sound (see the kill list).

### 4. ★ One gamut, three meanings: gamut wheel 2.0
- **What:** The gamut mask becomes the place where *what a painter used*, *what a palette can mix* and *what an image contains* are drawn as the same kind of shape on the same wheel.
  - **Fit to anything:** overlay the hue/chroma scatter of your photo, one painting, a painter's whole archive (their pooled colors) or your Cabinet. "Fit mask" wraps it, giving you "Vermeer's measured gamut, as photographed".
  - **Mix hull:** pick a limited palette (Zorn, an earth palette, a classic primaries set) and the wheel draws the hull of every 2- and 3-paint mix from the in-house spectral model. You see at once why Zorn has no true blue.
  - **Clip:** apply any mask to a photo. Colors outside the shape are pulled to the mask's nearest edge, and you see your world painted within that gamut.
  - **Slice:** a lightness slider turns the wheel into a moving slice of the 3D solid. Yellow shrinks to nothing at low lightness and blue's reach changes, which is the Color Nerd's "the wheel is one slice" point made touchable. The names toggle shows where real color names sit on *this* slice, not 7 fixed labels.
  - **One hue space:** the wheel, Harmony and the Score all switch to OKLCH, and the apology in the fine print goes.
- **Why 10×:** It joins three things that are separate today (painters' measured palettes, the Mix lab and the wheel), and it teaches the most practical idea in color for painters: work inside a gamut. It's also beautiful: a painter's hull glowing on the wheel next to yours is a portrait.
- **Connects:** painter pages (each painter page gets "their gamut" as a figure), Mix lab (hulls from the model), Train (the Zorn station's out-of-range targets become visible), honeycomb (the lightness slice is the same lens panel 1 asked L18 for), photos.
- **Effort:** M. **Honesty:** painter gamuts come from photographs of varnished paintings, so label them "as photographed", default to the within-painting lens and require n ≥ 12 paintings. Mix hulls come from approximate reflectance curves, so they're "roughly".

### 5. ★ Mix walks: one pair, four physics, every step named
- **What:** The Mix lab (ROADMAP §18), built on our own model. Pick two colors. Four lanes run side by side from 0 to 100%:
  - **Light:** additive, linear RGB.
  - **Screen average:** a naive sRGB blend, beside an OKLab blend, so you see the muddy dip that most apps make.
  - **Print:** subtractive multiply.
  - **Paint:** spectral, using the in-house model.

  Above the lanes, each mix is drawn as a **path on the hue-chroma disc**: light runs straight, the sRGB average sags toward grey, and paint curves, swinging blue + yellow through real greens. Every step is named, so a walk reads like a sentence: "In paint, Ultramarine to Cadmium yellow passes through Teal, Fern, Moss and Olive." One tap opens any name's page. Guess-first: before the reveal, you predict the 50/50 point from three same-family options (panel 1's predict-before-mix, logged per pair).
  - **The model, ours:**
    1. Reconstruct a smooth reflectance curve for any sRGB color with Scott Burns' published least-slope method; reimplement it from his paper and check the terms before reusing any code.
    2. Mix with proper Kubelka-Munk (K/S added by concentration), with a separate scattering term so white tints go chalky.
    3. Keep the existing 10-band machinery in `match-model.js` (observer fit, D65, band weights).
    4. A small pigment shelf (titanium white, ivory black, ultramarine, phthalo blue, cadmium-like yellow, quinacridone magenta, yellow ochre, burnt sienna, viridian) with hand-drawn curves that follow typical published shapes, labeled as approximations, the same policy the Zorn station already uses.
  - Spectral.js (MIT, if its license checks out) can be a test oracle, never the source.
- **Why 10×:** "What do these two make?" videos are hypnotic because the answer surprises you. Four physics side by side make the surprise *explain itself*. The named path turns mixing into vocabulary: you learn Fern and Moss by watching paint travel through them.
- **Connects:** articles (myth presets at `#/mix/<a>+<b>/<mode>`: pointillist dots average toward grey; red, yellow and blue are a convention), Train (predict the mix, name the mix, which two made this, all on the gym engine's staircase), color pages ("How to mix it" recipe, idea 15), gamut wheel (hulls), Learner Model (per-pair misses).
- **Effort:** M–L. **Honesty:** paint results approximate real tubes, and the copy says so on every screen. The Burns method assumes a smooth reflectance curve; real pigments aren't that smooth, which is exactly why the shelf uses curated curves for named paints.

### 6. Palette swap: your world in a painter's palette, and back
- **What:** One transfer engine, two directions. (a) **Your photo in Morandi's palette:** match your photo's color pool to a painter's measured cluster with an optimal assignment in OKLab (lightness order kept, so the value structure survives), then recolor. (b) **A painting in your palette:** recolor any archive painting with your saved palette or taste palette through its color map (`cm`). Every swap comes with a measured "what changed" line: "Morandi's palette took 62% of the chroma out of your kitchen and closed your values to three steps."
- **Why 10×:** Watching a painter's palette land on your own room is the fastest way to *feel* what a palette does, apart from subject and brushwork. The measured line turns the trick into a lesson.
- **Connects:** painter pages ("Try his palette on your photo"), Taste (your palette on a masterpiece), the Score (a swapped result can be transposed), Cabinet (save the pair), mockups (replaces the abstract poster mockup with a real one).
- **Effort:** M. **Honesty:** "in the spirit of"; the painter's palette is measured from photographs and is one of their clusters, never "their palette". It must use painter clusters, not one average (X23).

### 7. The Readings: one image, every honest reading
- **What:** ROADMAP §15, shaped by the philosophy. A photo opens to a calm summary card (key, its top 3 named colors, its twin), then a vertical stack of readings, each one gesture deep: *By area · Accents · Lights and shadows (two families) · Hidden colors · Focal color · Glue tone · Value plan (2- and 3-value notan) · Warm and cool map · Harmony fit · Archive percentiles* ("more muted than 87% of the archive"). Each reading has one "see it yourself" line ("Squint: the darks merge into three shapes"). Crucially, photos compute **the same fields as the painting analysis** (`acc`, `hid`, `foc`, `glu`, `stat`), so a photo and a painting are one object and every painting-page feature works on photos for free. The count control becomes the shared 3–20 slider.
- **Why 10×:** It turns the philosophy's "never one palette" into a habit you carry out the door. Making photos and paintings the same shape is the structural win, because every future painting feature lands on photos too.
- **Connects:** painting pages (shared renderer), Train (the squint and value stations link from the value plan), Color Graph, photos (store the analysis in the IndexedDB record), Journey (hidden colors are perfect "find it" steps).
- **Effort:** M. **Honesty:** camera white balance shifts everything, so offer WB and say "as photographed". Percentiles compare a phone photo with photographed varnished paintings, which says something about color but nothing about quality.

### 8. What did you notice? Your eye's bias, measured
- **What:** On any image, you collect 5 colors by hand first (finger-drag on the mosaic, idea 12). Then the engine shows its readings beside yours: "You picked the accents. The image is 70% these three muted greens you skipped." Over many images, the Learner Model learns your **noticing bias** (you over-pick chroma, under-pick darks, never pick neutrals) and shows its trend.
- **Why 10×:** It measures *attention*, which is what "learning to see" actually changes, and no other app can because none pairs your picks with a measured reading.
- **Connects:** Learner Model (a new `noticed` event with the chroma and lightness of your picks vs the area-weighted truth), Train (a weak "neutrals" axis triggers greys stations), painting pages (the daily painting becomes a noticing round), the You page.
- **Effort:** S–M. **Honesty:** this is a bias in *picking*, not perception. Say "you tend to pick", never "you can't see".

### 9. In Werner's words: your colors in the naturalists' guide
- **What:** Every palette color within ΔE00 5 of one of Werner's 110 colors (Syme's 1821 *Werner's Nomenclature of Colours*, already in `BOTANY.werner` with hex, animal, plant and mineral) gets a field-guide line: "Werner, 1821: *Scotch blue*. Throat of the blue titmouse; blue copper ore." Next to it, the cross-matches ROADMAP §16 asks for: the nearest flowers (botany), gems, fashion decades (`FASHION.decades` swatches) and the Pantone Color of the Year, as "shares colors with".
- **Why 10×:** It's a delight that only a color archive with public-domain natural history can offer: your phone photo described like a 19th-century naturalist's specimen. It's also a quiet lesson that names come from looking at nature.
- **Connects:** Botany, Gems, Fashion (World), articles (the Werner essay; "nature-named" tier), Cabinet (a "field guide" card), Journey (nature-named lessons get a real-object anchor).
- **Effort:** S. **Honesty:** Werner's printed chips have aged and our hexes are approximations; say so. "Shares colors with", never "inspired by". Check the well-known claim that Darwin used Werner on the *Beagle* against a source before writing it anywhere.

### 10. Color hunts: the camera as a field guide
- **What:** Extends panel 1's moments 2 and 7 and the ledger's liked T9 ("spotted teal today"). Each day the camera carries one **hunt**: a color you're learning, chosen from the Learner Model, or the same seeded color for everyone. Point, freeze and *name first*. The camera confirms only if the sample sits inside that name's region (nearest-name, not just ΔE). Finds are dated photos in a *Your finds* drawer and count as unassisted review. A hunt can also be "three colors in this room you can't name yet", which become tomorrow's words.
- **Why 10×:** It sends the lesson out into the world, which is the KB's transfer rule, and gives the camera a reason to open daily.
- **Connects:** Journey (finds are world steps and missions), Learner Model (`found`), Cabinet (finds drawer), Home map (finds light their spot), Today.
- **Effort:** S–M. **Honesty:** a find counts toward Yours only when you named it first (panel 1's guardrail). Offer WB before a hunt under warm light.

### 11. Acquired taste: a short course in a color you dislike
- **What:** The taste model already knows your least-favorite region. Acquired taste picks one (say olive), then shows 5 archive masterpieces where it carries the picture (by area, or as the glue tone), its article, two poems that use the word, and a flower or mineral that wears it. A week later, 5 taps re-test only that region and show whether your dial moved.
- **Why 10×:** It turns Taste from a personality quiz into growth: you learn to see beauty you were blind to, and the model measures the change honestly.
- **Connects:** Taste, painter pages, articles, Poems, Botany, Learner Model, Journey (a spaced re-test).
- **Effort:** M. **Honesty:** report only the measured change in your choices. No claims about permanence or about "training taste" in general.

### 12. The mosaic as a squint dial
- **What:** ROADMAP §16's mosaic picker (6–400 tiles, averaged in OKLab or linear light), framed as the painter's squint. At 6 tiles you see the masses; at 400, detail. Finger-drag collects tiles into a tray, and near-twins merge at **your own eye threshold** for that family, from the gym ("merged: below your blue threshold, 2.2"). It works on any of the 23,531 paintings too. Export the mosaic as an image.
- **Why 10×:** The slider *is* a lesson in seeing big shapes first, and merging at your own threshold makes the eye gym visible in a design tool.
- **Connects:** Train (thresholds; the big-masses station), painting pages, idea 8 (picks feed noticing bias), the Score.
- **Effort:** S–M. **Honesty:** with no gym data, use a stated default (ΔE 2.3, a commonly cited just-noticeable difference) and say so.

### 13. The crit: palette critique against the archive
- **What:** ROADMAP §8's critique, made specific: lightness spread, contrast pairs (AA/AAA for text), three color-blind simulations and a value-only squint, each measured against the archive ("Your 5 colors span 38 L*; 80% of paintings span more than 55"). Every "fix" is one of the Score's verbs (change key, re-voice, resolve), so a fix is also a lesson.
- **Why 10×:** It's critique with a real reference set behind it, and the fixes teach the operations instead of quietly "improving" your palette.
- **Connects:** the Score, archive stats, Train (squint), articles (color-blindness and contrast nodes), exports (contrast pairs travel with the file).
- **Effort:** M. **Honesty:** archive percentiles describe paintings, not good UI; say which reference is used for which check (WCAG for text, the archive for range).

### 14. Exports that carry meaning
- **What:** One Export sheet replaces the two copy buttons. Formats:
  - CSS with hex *and* `oklch()` and a name comment per color;
  - a Tailwind snippet;
  - an SVG swatch card that pastes straight into Figma;
  - Adobe .ase;
  - Procreate .swatches;
  - GIMP .gpl;
  - plain hex.
  Every file carries the precise names and the roles (dominant, secondary, accent, with shares). Optionally it adds an OKLCH tint ramp per color for UI scales.
- **Why 10×:** Designers are goal 4's audience, and a palette that arrives in Procreate *with its names* keeps teaching after it leaves the app.
- **Connects:** palette engine (roles), the Score (the derivation goes in the file's metadata), color pages (names), the crit (contrast pairs).
- **Effort:** S–M (spec in §6). **Honesty:** say screen colors are approximate. Never write trademarked names (Pantone, Tiffany) as swatch names.

### 15. "How to mix it" on every color page
- **What:** Once the Mix lab model exists, every color page gets a recipe from a standard 8-paint shelf and from the Zorn palette: "About 3 white : 1 phthalo blue : a touch of burnt sienna (≈ ΔE 2.1). Zorn can't reach it; the closest is a cool grey." One tap opens the Mix lab preloaded.
- **Why 10×:** It's the field note painters actually want, computed for all ~2,700 colors at no writing cost.
- **Connects:** color pages and articles (field notes item 7 in the master plan), Mix lab, gamut wheel (in or out of a palette's hull), the later art-supply affiliate row (NOTES-TRACKER).
- **Effort:** S once idea 5 lands. **Honesty:** "approximate, on screen"; never brand-specific.

### 16. The pigment time machine: could this be painted in 1500?
- **What:** Each pigment on the shelf carries an availability date (from the article engine's fact cards: ultramarine, lead white, vermilion early; Prussian blue 1700s; cobalt, synthetic ultramarine and viridian 1800s; cadmiums and mauveine mid-1800s). Pick a year and the wheel shows that era's approximate mix hull. Your photo is hatched where no pigment of that year reaches.
- **Why 10×:** It joins the pigment epics (the article engine's top tier) with your own photo: history you can see.
- **Connects:** articles (pigment dates come from fact cards, not invented), gamut wheel, Mix lab, painting pages (a "pigment check" fun fact, ROADMAP §15).
- **Effort:** M–L. **Honesty:** the highest risk in this file. Screen colors only approximate pigments, availability isn't use, and the dates need fact-card sources (books disagree on several, see CONFLICTS.md). Ship only with hedged copy ("roughly", "available by").

### 17. Era key: your photo at the 1650s' lightness
- **What:** Match your photo's lightness and chroma distributions (hue untouched) to a decade's measured distribution (`index.json` trend, `groups.json` byDecade), so you see your photo "in the archive's 1650s key". Then the caveat as the lesson: "Much of this darkness is varnish and museum photography, not the painters' choice."
- **Why 10×:** It makes the brown archive *visible and teachable* instead of a hidden bias. It also explains why old paintings look the way they do on screen.
- **Connects:** Explore (decade pages), painting pages, the two-lens honesty guardrail (panel 1 §2.4), photos.
- **Effort:** S–M. **Honesty:** frame it as "as photographed" every time. It's a lesson about the archive, never "how people painted".

### 18. White balance as a lesson
- **What:** When you set WB, the camera shows the cast it removed: a split frame (as shot | corrected), the estimated light ("warm, roughly incandescent") and the white wall's two names ("as shot: Buttermilk · corrected: White smoke").
- **Why 10×:** Color constancy is one of the most surprising facts about seeing, and you're standing in it.
- **Connects:** Train (the Colorist shelf: kill the cast, Kelvin eye), the Isolator, articles (color constancy node).
- **Effort:** S. **Honesty:** a Kelvin estimate from one grey reference is rough; show a range and a word, not a precise number.

### 19. Your year in color
- **What:** Saved photos and finds, laid out as a calendar strip of each day's dominant colors. Seasons and trips show up ("October went ochre"). Tap a day to open its photos.
- **Why 10×:** It's a quiet, personal reason to keep shooting, and it makes the light of the seasons visible.
- **Connects:** photos, Cabinet (a drawer view), posters (idea 20), the Learner Model (finds by date).
- **Effort:** S–M. **Honesty:** only your own saved photos; local to the device until accounts exist.

### 20. Posters only ColorHub can print
- **What:** The print shop note, made of data nobody else has, all from the one share-card renderer (panel 1):
  - **A painter's life in color:** every archive painting as a vertical stripe, by year.
  - **A decade in 12 colors.**
  - **Your color's biography:** swatch, name, first recorded, the archive's peak decade, a Werner line.
  - **Your walk or your year** (idea 19).
  - **A twin pair:** your photo's palette beside its painting's, with threads.

  Print-on-demand (Printful or Gelato) comes later, as NOTES-TRACKER says.
- **Why 10×:** Posters that teach something are worth hanging and worth sharing, and they're the honest path to revenue.
- **Connects:** share-card renderer, painter pages, Cabinet, Taste, Explore decades.
- **Effort:** M for the renderers, L for the shop. **Honesty:** outward-facing, so David confirms. Public-domain painting *palettes* are measured facts; images of paintings need each museum's license checked. No trademarked colors. "Screen colors approximate; ink differs."

### 21. Taste from the archive
- **What:** The palette taste test draws its pairs from *real archive palettes*, chosen by the same information rule (pairs that differ mostly on one dial), instead of generated ones. Results land directly on 23,531 paintings and 837 painters (replacing the two-museum `STATS`), and the gallery's "Matches your taste" preset moves next to the result.
- **Why 10×:** Every tap is also a look at a real painting's color, and "your painters" becomes believable.
- **Connects:** Taste, gallery and painter pages, the You page (panel 1 merges taste, eye and vocabulary), Explore For you.
- **Effort:** S–M. **Honesty:** real palettes vary on several dials at once, so the model's dial readings get wider error bars. Show "faded" dials honestly, as today.

### 22. Light mixer and colored shadows
- **What:** The Mix lab's Light mode as two toys from the Color Nerd research. (a) Three lamps at off, half or full; match the target through a window; each solved target names itself. (b) Drag an object in front of red, green and blue lights and watch cyan, magenta and yellow shadows appear.
- **Why 10×:** Additive mixing is the one most people have never felt, and these are 20-second delights.
- **Connects:** Mix lab, Train (a light-mixer station with halves, then quarters, then eighths), articles (additive mixing; the "RGB primaries" myth correction).
- **Effort:** S–M. **Honesty:** a screen *is* additive light, so this one is nearly exact. Say that's why.

### 23. Mix the master's glue
- **What:** Extends panel 1's "reach this painting with a limited palette" and the Zorn station. Each day, one archive painting's *glue tone* (`glu`, its unifying mid-tone) is the target. Mix it from a limited palette, then see where that grey-brown sits in the painting (isolated, idea 1).
- **Why 10×:** Painters' greys are the hardest and most useful thing to mix, and the archive hands us thousands of real ones.
- **Connects:** painting pages, Mix lab, Train (Atelier shelf), the Isolator, Learner Model.
- **Effort:** S–M. **Honesty:** the glue tone is "as photographed", so varnish can make it browner than the painter mixed. Say so in the reveal.

---

## 4. Kill list (surface without seeing)

1. **The 101 leaks in Studio.** Remove the camera's "Nearest lesson word" row and "A lesson word" label (`camera.js:58-60`). Switch Harmony and Albers from `appName()`/`nearestColors()` to `nameOf()` (`labs.js:127, 155`). This one is a rule violation, not a taste call.
2. **`LAB.namer`** (`labs.js:169`): orphaned, and it averages raw sRGB. The camera covers it. Delete.
3. **Studio's nine doors → one capture bar plus one shelf.** The home becomes:
   - one "Point · Pick a photo · Pick a painting" bar;
   - the Make tools as verbs that appear *on* a palette (wheel, Score, mix, swap, export), not as tiles;
   - one "Yours" shelf where photos, palettes and taste live together (feeding the Cabinet, per panel 1 §7.4).
4. **Harmony lab → the Score.** Its schemes become chord shapes; its fixed SVG poster becomes the mockup in idea 6.
5. **Albers lab → the Isolator.** Keep "two grounds" as one Isolator mode; drop the standalone tile.
6. **"Find your color" + "Find your palette" → one taste test** with one result, inside the You page (panel 1).
7. **Gamut presets named by mood** (Warm, Cool, Triad, Muted, Complement) → three classic shapes plus "fit to…" a photo or painter. Mood names imply rules the wheel doesn't follow.
8. **The Stripes / By area / Chips segmented control** and the fixed 3/6/10 counts → the Readings stack and the shared 3–20 slider.
9. **Row-tap-copies-hex, everywhere.** One tap on a color opens its page (X14). Copying moves to a long-press and to Export.
10. **"Spot the master" with hue-rotated fakes.** It teaches spotting odd hues. Replace it with panel 1's "Whose palette?" in Train, where the distractors are other painters' real palettes.
11. **Don't build sonification.** Playing a palette as notes would imply colors *are* notes (the myth list's Newton entry). The Score stays visual.
12. **Don't build "style match".** Brushwork and style need a model we don't have, and color twins must never be read as influence (ROADMAP §15).

---

## 5. The 60-second wow

**"Your white wall isn't white."** A first-time user taps Studio, which opens straight onto the live camera (no tile menu). They point at their room. The name changes as they pan (today's trick). The hint says "Freeze, then tap a shadow." They tap the shadow on the wall. Four options appear: *White · Lavender grey · Pale grey · Cream*. They pick White. The room fades to neutral grey; the patch hangs alone, plainly bluish-violet: **"Alone, it's Lavender grey. Your eye corrected it to white because it knows the wall."** Hold to see the room again; the patch "turns white" in front of them. One line under it: "Painters call this seeing the color, not the thing." Then, beneath, the real nearest match (for a grey room it may well be one of the archive's Hammershøi interiors): *Closest in the archive: [painting], which shares your grey*, with the thread drawn between the two greys. Under a minute, and they will look at shadows differently on the way out.

---

## 6. Buildable today (each under 4 hours)

### A. "Closest in the archive" on every photo and palette (twins, threads, Werner)
- **Files:**
  - `js/gallery.js`: add `glSimilarPal(pal, k = 5)`. It's `glSimilar` with an outside palette of up to 6 `{h, share}`. Compute the palette's mean Lab and C, run the same prefilter (best 240), then the same two-way, area-weighted `glDE` matching against `GAL.lab`/`GAL.sh`. Return `[{i, d, pairs: [{yours, theirs, de}]}]`, where `pairs` is the best match for each of your top 3 colors. For the era line, also return `glEraLean(top200)`: the century or decade mode among the nearest 200, with its share (from `GAL.year`).
  - New `js/twins.js` (prefix `tw`, one global scope): `twSection(host, pal)`. It loads the gallery (`loadGallery()`), renders 5 pins with `glPinHTML`, and under each pin draws up to 3 threads (chip → chip, both `data-swatch`, names via `nameOf`). Tapping a pin calls `galleryPage(i, true, pairs[0].theirs)`, so the matched color is highlighted on arrival. A confidence word: mean d < 6 is "close", < 10 is "loosely", otherwise "Nothing in the archive is really close; nearest:".
  - Werner line in the same section: lazy-load `data/botany.js` the way `js/botany.js` does. For each palette color, take the nearest `BOTANY.werner` entry by `de2000` and show it only if ΔE ≤ 5: "Werner, 1821 · *Scotch blue* · throat of the blue titmouse".
  - `js/studio.js`, `paletteView`: when `hasImg` or there are ≥ 3 colors, append `<section id="twins">` and call `twSection` with the current `colsNow()`. Rerun it when the count changes.
  - CSS in `app.css` (the Studio section): a thread row is two 22 px chips joined by a hairline.
- **Copy:** "Closest in the archive · color only, as photographed". The fine print: "Matched on palette and area across 23,531 museum paintings. Old varnish browns many of them. A color twin isn't an influence."
- **Connections:** painting pages (highlight on arrival), Werner/Botany, and the Learner Model when it lands (`lmLog({k: "seen", ref: "painting:" + i, surf: "photo"})`, guarded by `typeof lmLog === "function"`).
- **Check:** `node tools/check.js`, `check_wiki.js`, `check_names.js` and the undefined-name scan; then screenshots at 375×812 of a photo page with twins (a bright photo, a dark photo, and a flat grey card, which must show "Nothing really close").

### B. The Isolator
- **Files:**
  - New `js/isolate.js` (prefix `iso`) and `css/isolate.css`.
  - `isoSample(canvas, fx, fy)` is the camera's linear-light patch average, lifted out of `eye()`'s closure; `camera.js` then calls this one so there's a single sampler.
  - `isoOpen({src, fx, fy, from, ref})`, where `src` is a canvas or an `<img>` (draw it to a canvas; museum images need `glCORS`, and on a tainted canvas fall back to the painting's `cm` color map at that point).
- **Flow:**
  1. A ring appears at the tap.
  2. A bottom card asks "What would you call it?" with 4 options:
     - the true `nameOf(h).text`;
     - the **context distractor**: the name of the average of a ring around the patch (radius 3× to 6× the patch), unless it equals the truth;
     - two same-family neighbors from `nameOf(h).near` with ΔE between 4 and 15 and distinct from each other.
  3. On a pick, the image gets a CSS mask: everything but a 9%-width disc animates to the booth grey (`#777` ≈ L* 50, the same token as `booth.css`) over 450 ms. Reduced motion is an instant cut.
  4. The card reveals "Alone, it's **Lavender grey**" (a link: one tap opens its page). If you picked the context name: "Your eye corrected it toward its surroundings."
  5. Press and hold the image to bring the context back.
  - "Isolate another" just taps again.
- **Hooks (three tiny edits):**
  - `paletteView`: a tap on `.pv-img` opens the Isolator.
  - `camera.js`: when frozen, add an "Isolate" chip to the eye card. Today's frozen tap names the spot; Isolate runs the guess-first flow on that spot.
  - `gallery.js` `glPage`: the hero image's "tap to name a spot" becomes the Isolator. The painting's `hid` colors appear as "Try: the hidden green" chips that pre-place the ring.
- **Data:** none new. Log `recall_ok` / `pick_wrong` with `as` and `surf` if `lmLog` exists. Otherwise keep a small `S.iso = {n, ctx}` counter, migrated through `migrateState()` (a new step, keeping unknown keys).
- **Check:** the gates, plus screenshots at 375×812 of each step (ring, options, isolated, held) on a photo, the frozen camera and one painting.

### C. The Export sheet
- **Files:** new `js/export.js` (prefix `ex`) and `tools/export_test.js` (node, no DOM).
- **What it writes:**
  - `exCSS(cols)`: `--name: #hex; /* oklch(L C h) · role · share */`.
  - `exTailwind(cols)`.
  - `exSVG(cols)`: a swatch card with names, which pastes into Figma.
  - `exGPL(cols)`.
  - `exASE(cols)`: the community-documented ASE binary: the `ASEF` header, version 1.0, then per color a block `0x0001` with a UTF-16BE name, `RGB ` and three float32 values, type 2 = normal.
  - `exProcreate(cols, title)`: a `.swatches` file, which is a ZIP holding `Swatches.json` (`[{name, swatches: [{hue, saturation, brightness, alpha: 1, colorSpace: 0}]}]`, HSB in 0–1). Write a tiny store-only ZIP writer with CRC32 (about 60 lines); no library needed.
  - Roles come from shares: the largest is dominant; the next is secondary if its share is ≥ 15%; anything under 5% is an accent. Names come from `nameOf()`.
  - An optional "Add tints" toggle adds 5 OKLCH lightness steps per color.
- **UI:** in `paletteView`, "Copy as CSS" and "Copy hex list" become one **Export** button that opens a sheet of format rows. Each row shares the file through `navigator.share({files})`, falling back to a download; CSS, Tailwind and SVG also offer "Copy". The gamut wheel and taste result use the same sheet.
- **Test:** `tools/export_test.js` round-trips the ASE (parse the bytes back and compare hexes), checks ZIP CRCs and the JSON shape, and checks that names contain no trademarked terms (a small deny-list: Pantone, Tiffany). David should import one `.swatches` and one `.ase` on his iPhone and iPad before calling it done, since Procreate's format is community-documented, not official.
- **Connections:** the palette engine and the Score later write their derivation into the file (CSS comment, ASE group name); the crit's contrast pairs can be appended to the CSS output.
