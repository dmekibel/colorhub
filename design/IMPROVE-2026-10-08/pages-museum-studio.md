# Improve pass, 2026-10-08: color and name pages, articles, the Museum, design history, Studio

Reviewer 3 of 5. Read-only on code. Method: rendered every screen in my area headless through `tools/_qa/frame.html` at 440x956 (iPhone 16 Pro Max) and spot-checked at 375x812, read the DOM of each screen with a small probe page, then read the code behind what looked wrong. Every "repro" below was reproduced that way on `main` (b63caae). David's framing is applied per feature: **Goal / Verdict (hits, almost, misses) / Ideal (one sentence) / Connections / Skeptic** (a pre-mortem: "a month from now people ignore this because...").

The one-paragraph diagnosis: the data is excellent and the pages are honest, but most screens are **reports**, not **instruments**. They show a finished reading (six bars, a list of facts, a grid of numbers) instead of letting the eye do something and then confirming it. The perfect mechanic David is circling is: **any thing, held in your hand, read by your finger, then tested on your eye.** A painting, a look, a garment, a photo or a painter should all open with the same three verbs: **Look** (drag across it and the app names what's under your finger and lights where else it lives), **Guess** (before it tells you: "what's the color of her collar?", three same-family names), **Compare** (against its painter, its decade, its neighbors). That one interaction, built once, makes every surface in this area learnable, playful and connected to the Learner Model, and it is mostly assembled from parts that already exist (`isoSample` in namer.js, the veil highlight in article-refs/paintingsof `ptArrival`, the "guided look" on the painting page, `Whose palette?`).

---

## A. Annoyances (file:line, repro)

| # | What | Where | Repro |
|---|---|---|---|
| A1 | **Over half the color pages can't be reloaded or shared.** A tapped library color opens `#/name/frostbite`; reload or open that link and you land on Home (a new visitor gets the onboarding screen). `routeName` only searches the 984 core names, so the ~1,064 library-only names and every alias (e.g. `#/name/dull-blue`, now an alias of Stormy Blue) fall to `xToOrigin()`. Also breaks Back after an iOS PWA reload. | `js/router.js` `routeName` (const near line 150) and the `kind === "name"` branch of `openRoute` | Fresh profile: open `#/name/frostbite` or `#/name/dull-blue` → "Name the colors you see." |
| A2 | **Red's tier line reads "A basic color word · first recorded as a color word, -100000".** The graph's `since` for red is Blombos Cave red ochre (approx, a paint, not a word), and the year is printed raw. | `js/richpage.js:32` (`RP_FS.since`), `:36`; data `data/graph/nodes-r.json` (`since.y = -100000`, `approx: true`) | `#/color/red` |
| A3 | **Red's story is outsourced to Madder.** The twin block "Its story lives with Madder · Read its story 9 min" appears on Red, the most-storied basic word, because `rpTwinHTML` only checks `data/articles`, not the 101's own wiki facets. Red's real History/Symbolism/Science/Culture text sits collapsed at the very bottom, after field notes and the walk. Same for every one of the 101 without an article. | `js/richpage.js:179`; order in `js/explore.js:634-653` | `#/color/red`, scroll one screen |
| A4 | **Two "Also called" lines that contradict each other.** Prussian blue shows "Also called Atlantis, Bagdad, Bavarian Blue, Colonial Blue, Comet, Corsair, Dagestan, Dozer, Du Gueslin, Era Blue." (paint-chart brand names from the search layer) right above the article's own "Also called Berlin blue, Paris blue, Milori blue, iron blue, bero". | `js/names.js:143` (`np-also`), `js/explore.js:649` | `#/name/prussian-blue` |
| A5 | **The glance strip opens pigment pages with artifacts.** Prussian blue's first two cards: "1340, first seen 481 years before the name's earliest record" and "Peaks in the 1400s". Both are varnish look-alikes for a pigment invented about 1705, and the article directly below says 1705. Honest caveat text, wrong lead. | `js/richpage.js:92-93` (scores 90 and 65) | `#/name/prussian-blue` |
| A6 | **The definition of Red is "Darker than vermilion."** The differential definition runs for basic words that have an authored lead (`c.o`) and an ISCC-NBS descriptor at ΔE 8.2 (just over the 5 cut). | `js/richpage.js:41-47` | `#/color/red` cover |
| A7 | **Tapped cover says the match twice:** "Your color · 96% match" and "#2A7F86 · 96% match to Teal". The spec's "the name's own chip beside your color" isn't on the cover, so you can't see the difference you're being told about until you scroll. | `js/richpage.js:50`, `:71` | `#/name/teal?c=2a7f86` |
| A8 | **Painter page palette chips say "Room 3", the section below says "Palette 3",** and each chip is `<a href="#aw-pal">`: a tap rewrites the address to `#aw-pal` (the page is then not reloadable and Back needs an extra press). | `js/artwiki.js:213`, `:170` | `#/painter/john-singer-sargent`, tap the third chip |
| A9 | **Painter "Colors in most of the work" rail bleeds to the screen edge** (no 16 px gutter); the Name-any-color neighbor cards do the same and the second card is cut at 375. | artwiki rail CSS; namer neighbor row | shots at 440 and 375 |
| A10 | **Albers shows a raw slug:** "Josef Albers built a whole course on this (interaction-of-color)." | `js/labs.js:161` (`[[interaction-of-color]]` without a label) | `#/lab/contrast` |
| A11 | **Paintings-of lands empty by default.** From a strong red: "No painting holds Dusty crimson, within 3%, covering at least 5%" then "Nothing at this setting." The page knows the nearest non-empty setting (the loosen button exists further down) but makes you find it. | `js/paintingsof.js:144`, `:317` | `#/paintings-of/c41e3a` |
| A12 | **Masters' chords teaches nothing on its first screen:** 8 of the top 8 pairs are the same color twice (Maroon + Oxblood, Military + Lettuce Green, Caramel + Warm Brown), each tagged "neighbors on the wheel". That is k-means splitting one gradient, not a chord. | `js/chords.js` (sort/filter of `topChords`) | `#/chords` |
| A13 | **Naming policy still broken in Looks** (critique follow-up from this morning, still open): Dark Academia's palette is Kenpōzome, Café Noir, Coffee, Hair Brown, Khaki (Web), Onandocha. | `js/looks.js` palette naming | `#/look/dark-academia` |
| A14 | **Painting palettes name colors "Dark black", "Between mahogany and umber", "Between black and umber".** On a dark painting every row is a "between", so the palette reads as a shrug. | `js/gallery.js` palette rows | `#/gallery/12` |
| A15 | **"More like this" on dark paintings is varnish matching:** every twin of the van Dyck is "Near black to Smoky Black, Café Noir to Bistre, Smoky Black to Smoky Black", 2.1-2.5% apart. Five near-identical brown rectangles, no insight. | `js/gallery.js` More-like-this (overall palette) | `#/gallery/12`, end of page |
| A16 | **Painting page image is half-width at 440** with an empty right column holding one link; on the one screen where the picture is the point. | `js/gallery.js` glPage hero layout | `#/gallery/12` |
| A17 | **Harmony exists in four places with two different wheels:** Measured drawer (Harmonies), Connections (Harmony), Lab Harmony (CIELAB hue), Name any color (harmony marks), plus the Gamut wheel (OKLab), whose own footnote admits "their angles differ". | `js/richcolor.js`, `js/explore.js connSection`, `js/labs.js`, `js/namer.js`, `js/studio.js` | compare the screens |
| A18 | **Harmony lab is still the old design:** Georgia-style serif, lowercase mono "very close", xkcd names as primaries ("Windows Blue"), no Save or Export. | `js/labs.js` LAB.harmony | `#/lab/harmony` |
| A19 | **Article uses "units":** "the two swatches now sit 36 units apart". Against the percent rule. | `data/articles/prussian-blue.json` | `#/name/prussian-blue`, chapter 2 |
| A20 | **Painter "Paints like" is six-number math that surprises badly:** Sargent's second-nearest painter is Marsden Hartley. And his "Colors" section says "Nothing stands clearly above the same museums' baseline" for one of the great colorists. | `js/artwiki.js` | painter page |
| A21 | **Gamut wheel names a vivid #F33B5C "Dusty pink red"** and a dark brown "Vivid dark chocolate brown": the compound modifiers can contradict the color. | naming layer (compound variations) | `#/studio/wheel`, Warm |
| A22 | Hub page is still the raw list (212 rows, hero stripes in random order); this morning's critique scored it 2 and it hasn't moved. | `js/article.js` arHubPage | `#/hub/family:blues` |
| A23 | The Museum's "For you" cover sets its title in a different serif from every other screen. | explore.js pager cover CSS | `#/museum` |

## B. Confusing or redundant screens

1. **The 101's color page has three structures stacked:** the new rich page (glance, field-note drawers, walk), then the old wiki accordion (Contents: History, Language, Symbolism, Science, Culture, Kin, Nearest names, Also called, Codes), then "Connections" (Looks, Harmony, History, Ideas, Stories chips, about 40 links), then Sources. Neighbors appear four times (flower, Kin, Nearest names, Connections > Looks); harmony twice. A first-time reader on Red scrolls past Madder's story and two layers of drawers before reaching Red's own history.
2. **colorPage and namePage are still two functions** (`js/explore.js:591`, `js/names.js:98`), so the same page differs by where you came from: one has Share, one has the heart row; one shows "Also called" junk above the article, one inside an accordion; Nearest names is an accordion on one and an open list on the other. COLOR-PAGE-DESIGN §1 asked for one `colorDossier`.
3. **Art has three rows of controls before the first painting** (4 entry circles, 5 filter chips, Grid/River/Painters/Wall + Date), then "Rooms", then the grid starts at "Before 1200" with a blurry papyrus and an ostracon.
4. **Studio's "Make" groups a palette tool (Gamut wheel), a harmony toy (Harmony) and a perception lesson (Albers).** Albers is not making anything; it belongs with seeing (Train) or with the article on simultaneous contrast.
5. **Painting page vs painter page vs paintings-of** each re-explain "as photographed" in a paragraph. Say it once per screen in one line with a "why" link.

## C. Simplifications

- **One page function, one order** (see F1). Fold the old accordion into the drawers: History/Symbolism/Science/Culture become the 101's "story" (the same slot an article uses); Kin, Nearest names and Connections > Looks become the Walk; Connections > Harmony goes into Measured; Codes and Also called go into one "Names and codes" drawer.
- **One harmony tool:** delete Lab Harmony as a separate screen; the Gamut wheel gets a "Harmony" preset row (complement, triad, split, square) on its one OKLab wheel; the namer's harmony marks stay as an overlay of the same math. The color page's Measured drawer links to it seeded with that color.
- **One "as photographed" line** with a sheet that explains varnish, cameras and k-means once (shared component), replacing the per-screen paragraphs.
- **Art's controls collapse to one row:** a single search field that accepts a color, a painter, a decade or a mood, with the color circle at its left; Grid/River/Wall moves into the ⋯ menu; default sort is "For you" (most colorful and most famous first), not date.

## D. Fun and delight upgrades

- **Guess before reveal, everywhere a thing has colors** (F2): "Name her collar" on a painting, "Which is Sargent's?" on a painter, "Name these three" on a look or garment, "What's this called?" in the camera. Every guess is logged to the Learner Model. This is the "testing yourself on the colors of any thing" mechanic, done once.
- **The loupe** (F3): drag a finger across any image and the name rides under it, the matching palette chip lights, and every region of that color glows through a dim veil. Release on a spot to open its page. It turns "tapping a painting to see its colors" from a report into play.
- **The hidden color:** for every painting, the one color you'd miss (highest chroma relative to its surroundings, or the most atypical for the painter), shown as a card: "The green in her cheek. Look again." The analysis data already computes accents and hidden roles.
- **Walk with sound and memory:** the Walk flower keeps a trail of names you walked through (breadcrumbs as chips), and "Walk home" returns. Holding the cover already opens the flower; make it the default way to wander.
- **Resume reading:** articles remember the chapter you were on; the story door shows "Continue · chapter 3 · 6 min left".
- **The painter barcode becomes a scrubber:** drag along Sargent's 287-painting barcode and the painting under your finger appears above it with its year. It is the most beautiful thing on the page and it's inert.

## E. Interconnections

- **Learner Model ↔ every "thing" page:** guesses on paintings, looks, garments and photos log confusions ("you called her collar ecru; it's ivory"), and the color page's "You and this color" card cites them ("You met it in The Black Tent and called it ivory").
- **Painter ↔ painter:** "Taught by Carolus-Duran" already exists; add "Painted beside" (same decade, same city), "Most like / least like" on palettes that exclude near-blacks, and a two-painter duel (`#/painters/a/b` exists) offered from every pair.
- **Design corpus ↔ color pages:** "In design" becomes the sixth field-note drawer (see F6).
- **Articles ↔ everything:** auto-link any core color name in article prose (ultramarine, azurite, smalt, Naples yellow are unlinked in Prussian blue) with the same chip renderer; it's free depth.
- **Studio ↔ Museum:** every photo palette gets "Closest painting" and "Closest look" (lookMatch exists), and every painting gets "Use this palette" → Studio (keep, export).
- **Hubs ↔ the honeycomb:** a hub page is "the map, filtered": open it as the honeycomb lit with that family, with the list as the scroll-below.

---

## Feature by feature

Format: **Goal · Verdict · Ideal · Connections · Skeptic**.

### Color page (the 101 and every name)
- **Goal:** one place where a color is understood: what it is, where it lives, what it's near, and how to own it.
- **Verdict: almost.** The cover, the walk flower and the twin block are genuinely good. But the 101 have three stacked structures (B1), the cover's facts can be wrong or weak (A2, A5, A6), and Red borrows Madder's story while hiding its own (A3).
- **Ideal:** one `colorDossier` in a fixed order (cover → glance → the story, its own first → five drawers → walk → names and codes), where every section is drawn only when it has something true and specific to say.
- **Connections:** Learn it, the honeycomb (walk = local map), paintings, articles, Learner Model.
- **Skeptic:** a month from now people stop scrolling past the cover because the first card is a caveat ("not proof of the pigment") and the page is five screens of drawers they must open. Fix: glance cards for a page with an article come from the article's own sourced `glance[]` first; artifact cards only when nothing better exists, and never above a contradicting article.

### Name pages and addresses
- **Goal:** every one of ~2,700 archive names, and every alias, has a real address.
- **Verdict: misses** on addressing (A1), almost on content.
- **Ideal:** `#/name/<slug>` resolves core, then library, then alias (alias lands on its color with "Also called Dull Blue" as the relation line), and only then gives up with a "No color by that name; closest: ..." page, never Home.
- **Connections:** search, share links, crawlable pages (`tools/pages.py` only builds core).
- **Skeptic:** shared links are the growth loop; a friend opening a link and seeing onboarding is the worst first impression the app can make.

### Article reader
- **Goal:** the classical, sourced read, easy to reach, easy to leave and come back to.
- **Verdict: almost.** The writing is excellent and honest; the reader is inline in the page (an 8-minute Prussian blue article sits between the primary row and field notes), with no resume, and prose names other colors without linking them.
- **Ideal:** the article opens as a "book" from a door card (chapters as rows, minutes, resume state), reads full-screen with the color as a ribbon that fills as you read, and every color word and thing in it is a live chip.
- **Connections:** reference cards, hubs, Learn it (end-of-article "Learn the four blues it mentions"), check questions → Learner Model.
- **Skeptic:** inline long-form makes the color page feel endless, and readers who leave mid-way never find their place again. The door + resume solves both.

### Reference cards (article-refs)
- **Goal:** every gem, flower, painting, look mentioned shows itself when it's truly close.
- **Verdict: hits** (the ΔE 15 rule and "no picture is better than a far one" are right).
- **Ideal:** the same, plus the loupe veil on painting cards so the matching region glows, and a "Seen in" strip that is swipeable.
- **Skeptic:** cards appear unpredictably (some paragraphs get one, some don't) and readers may think links are broken. Keep the chip identical whether or not a card follows.

### Hubs and "Which" pages
- **Goal:** a family or an ambiguous word becomes a guided tour.
- **Verdict:** Hub **misses** (A22); Which **hits** after this morning's measured differences.
- **Ideal:** a hub is the honeycomb filtered to that family (beautiful, tappable, ordered light to dark), with a one-line intro, the Learn words first, and "Learn this family's 12 core words" as the primary.
- **Skeptic:** 212 rows is a phone book; no one scrolls it twice.

### The painting page: "see a painting through color" (special depth)
- **Goal:** leave the painting able to see more color in it than you did before, and in the next painting too.
- **Verdict: almost, and this is David's example.** You tap a painting and get a half-width image (A16), six area bars that on any old painting are 90% brown and black (Helena Tromper: 36% black, 31% mahogany, 22% black-umber), a list of "between X and Y" names (A14), a four-cell stats grid, then 5 near-identical varnish twins (A15). It describes the photo's average, which is the least interesting thing about a painting. The genuinely good seed is buried halfway down: "A guided look · 1 of 3 · Where does your eye land first? Pick the color that pulls hardest."
- **Ideal (the perfect interaction), in four beats:**
  1. **Full-bleed painting first.** The image fills the screen width; title and painter overlay the bottom; nothing else above the fold.
  2. **Look: the loupe.** Press and drag anywhere on the painting: a loupe above your finger shows the patch magnified, its name ("Ivory · lights"), and a soft veil dims everything that isn't that color, so the whole lace collar and both cuffs glow at once. Let go to keep it as a chip; tap the chip to open its page. Under the image, the palette bar is **by eye, not by area**: shadows, mid-tones and lights as three bands, plus the **accents** (highest chroma for their surroundings) pulled out as their own chips, so the 2% camel and the red lip get a voice the area bar gives them.
  3. **Guess before reveal.** Before any names show: "What color is her collar?" with three same-family options (Ivory / Cream / Bone), then the answer with its share and where else in the painting it sits. Three questions per painting: one light, one shadow, one hidden color ("the green in the skin"). Each answer logs to the Learner Model. This is the existing guided look turned into the page's spine.
  4. **Compare, in plain words.** "Darker than 93% of the archive and 84% of van Dyck's other 46" exists; add the decade and the movement and, crucially, **the painting's one atypical color for this painter** ("van Dyck rarely uses a camel this light"). More-like-this matches on **accents and value structure**, never on near-blacks, so twins mean something.
- **Connections:** loupe = `isoSample` (namer.js) + veil (paintingsof `ptArrival`, article-refs); guesses = Learner Model and the Learn deck ("Learn the 5 colors of this painting"); "Use this palette" → Studio; painter page; "Today's painting" challenge uses the same three-question format.
- **Skeptic:** "Users tap a painting, see six brown bars, and leave; the analysis grid feels like a lab report." The fix is ordering and verbs, not more data: image first, finger first, guess before numbers. Second risk: the loupe on a 200 px museum photo is blocky; sample from the crisp image when the museum allows CORS, else from the analysis map, and say "as photographed" once.

### The painter page (and painters connected to painters)
- **Goal:** a painter's color personality: his several palettes, his favorite pairs, his change over a life, his kin.
- **Verdict: almost.** The barcode is beautiful but inert; palettes are named after a typical painting ("The Black Tent palette") but two show "Palette 3/4/5" or "Room 3" (A8); "Colors in most of the work" is all varnish browns (Blackish Brown, Smoky Black, Broccoli Brown); "Colors" (signature) is empty for Sargent; "Paints like" surprises badly (A20). "Taught by Carolus-Duran" and "Whose palette? Guess Sargent" are excellent and hidden at the bottom.
- **Ideal:** a painter page opens with the scrubbable barcode (drag through his life, the painting under your finger appears), then three named palettes as **image triptychs** (the most typical painting of each family, not color names), then "his colors" measured **without the near-blacks and browns that everyone shares**, then "Guess which is his" as a one-tap game, then his people (taught by, taught, painted beside, most like by accents).
- **Connections:** painter vs painter (`#/painters/a/b`), Whose palette?, decades and movements, color pages ("Sargent's ivory").
- **Skeptic:** "Every painter looks the same because varnish dominates." Baseline every painter against his own museums and decade (already done for "Colors") and hide shared neutrals from every list by default, with a toggle "include darks".

### Movement, decade, country, Art history by color
- **Goal:** art history as a color story.
- **Verdict: almost.** Correct and honest, monotonous (70 near-identical rainbow bars); "Everything painted in..." offers only eight basic circles.
- **Ideal:** each decade row shows only what stands out (its two over-represented hues as chips with a word: "the 1880s: lilac and cobalt"), tap to open; "Everything painted in" accepts any color (the same picker as Art).
- **Skeptic:** a page of bars that all look alike gets one visit.

### Paintings of a color
- **Goal:** show where a color lives in art, and how much of it.
- **Verdict: almost.** Strong sliders and an honest edge strip; default lands empty (A11); the "Design / Both" toggle is the only place the 10,577-object design corpus reaches the UI.
- **Ideal:** opens at the tightest setting that returns at least 12 paintings and says so ("Widened to 6% to find 14 paintings"), and the grid uses the veil so you see where the color sits in each thumbnail.
- **Skeptic:** the first impression is "nothing", which reads as broken.

### Masters' chords and pairs
- **Goal:** which colors painters actually put together, versus wheel theory.
- **Verdict: misses on its first screen** (A12): the top pairs are the same color twice.
- **Ideal:** exclude pairs within 15% of each other by default (as COLOR-PAGE-DESIGN already does for "Often paired with"), lead with the real contrasts (a warm and a cool, a light and a dark accent), and show each chord on its best painting, not as two squares.
- **Skeptic:** a chord list without pictures is abstract; one painting thumbnail per row fixes it.

### Looks
- **Goal:** a style as a family of palettes.
- **Verdict: almost.** Rich page; palette names break the naming policy (A13).
- **Ideal:** palettes named from the Learn layer, each look offering "Name its colors" (guess) and "Wear it / use it" (Studio export), plus "Paintings in this look" via lookMatch on the gallery.
- **Skeptic:** "Kenpōzome" and "Khaki (Web)" make the app look auto-generated.

### Fashion and garments
- **Goal:** color in clothes across time.
- **Verdict: hits** after this morning's fixes; Japanese primary chip names remain (same naming fix).
- **Ideal:** the garment page gets the painting page's loupe and guess, same component.

### Design history (data/design, no home yet)
- **Goal:** answer "where do the vivid modern colors live?" with honest numbers.
- **Verdict: misses** (built, unseen): only reachable as the "Design" toggle in paintings-of. `colors-*.json` (design share, painting lift, peak decade, curves, makers, six examples), `vivid.json`, `superlatives.json`, `makers.json`, flags/parties/orgs in `graph-facts.json` are not read anywhere.
- **Ideal:** (1) a sixth field-note drawer on every color page, "In design", with its peak decade, top category and three object thumbnails ("Silver: glass and ceramics, peaks 1860s, 7x more in design than in paintings"); (2) one Museum essay-screen, "When color got loud", built from `vivid.json` (the 1800s-1970s curve, with the n per decade and the caveat that late decades are posters and stamps); (3) "In flags" as a world fact on the colors it applies to (White in 132 flags), facts only, no logos.
- **Connections:** color pages, paintings-of (already), Looks (Art Nouveau, Arts and Crafts makers), the fashion decades.
- **Skeptic:** example objects carry museum-language titles ("Kelkglas met geslepen elipsen"): show the English category and maker ("Cut-glass goblet, Rijksmuseum, 1862") instead; and never claim "the most Bauhaus color" (n=1).

### Studio home
- **Goal:** make and keep palettes from the world.
- **Verdict: almost.** Clear camera-first hierarchy; Make mixes three kinds of thing (B4); the palette engine and mosaic picker David asked for (R§16) aren't there.
- **Ideal:** three verbs on one screen: **Capture** (camera, photo), **Name** (any color), **Build** (one wheel with gamut and harmony presets), and your shelf below; Albers moves to Train or the simultaneous-contrast page.
- **Skeptic:** two wheels with two hue spaces will confuse anyone who uses both.

### Camera
- **Goal:** name the colors around you.
- **Verdict: hits** for naming; misses the game.
- **Ideal:** a "guess first" mode by default after the first week: the app hides the name until you pick one of three, then confirms; finds feed "You and this color".
- **Skeptic:** naming everything instantly is a novelty that wears off in a day; guessing is a habit.

### Name any color
- **Goal:** any color → its name and how it differs.
- **Verdict: hits.** Five pickers, live nearest names, "Yours is more vivid".
- **Ideal:** same, with the neighbor cards inside the gutter (A9) and the harmony row moved to the one wheel.
- **Skeptic:** two tab rows (pickers + harmony) above the picker is dense on a phone; collapse harmony into ⋯.

### Gamut wheel, Harmony lab, Albers
- **Gamut wheel: hits** (a real painter's idea, perceptual wheel, Keep it + Views & export). Ideal: also the home of harmony presets.
- **Harmony lab: misses** (old design, duplicate math, no keep/export). Ideal: retire into the wheel.
- **Albers: almost** (a lovely demo with a raw-slug bug A10). Ideal: an Albers *exercise* ("make these two different squares look the same") in Train, with the demo on the simultaneous-contrast page.
- **Skeptic:** three wheels with different rules make the app feel assembled, not designed.

### Photos, palette view, export
- **Goal:** keep what you capture and use it elsewhere.
- **Verdict: hits** on export (CSS, Tailwind, SVG, GPL, ASE, Procreate with names and roles); almost on the palette view, which doesn't connect outward.
- **Ideal:** every palette view ends with "Closest painting, closest look, closest garment" (one line each, one tap) and "Name its colors" (guess).
- **Skeptic:** a palette that leads nowhere is a dead end; one row of connections makes it the start of a walk.

---

## F. Top 7 recommendations, ranked by impact over effort

**1. One color page, in the right order (M).** Finish COLOR-PAGE-DESIGN §1: replace `colorPage` (explore.js) and `namePage` (names.js) with one `colorDossier(entry, opts)`. Order: cover → glance → **the story** (an article door, else for the 101 their own wiki facets as a short "story" with chapters, else the twin block) → five drawers → the walk → one "Names and codes" drawer (also-called split into "historical names" and a collapsed "paint-chart names (10)", the passport, codes). Fold Kin, Nearest names and Connections > Looks into the walk; move Connections > Harmony into Measured; drop the old accordion and the Connections dump. Fix the cover facts at the same time: negative or approximate `since` years print as "about 100,000 years ago (red ochre, Blombos Cave)" and are labeled by what they are (A2); basic words use their authored lead before a differential definition (A6); the twin block never shows when the page has its own story (A3); glance cards come from the article first and artifact cards never lead a pigment page (A5); the tapped cover shows the name's chip beside your color and says the match once (A7). This is the most-visited screen in the app and the one David keeps describing.

**2. "Name its colors": one guess-before-reveal component for any thing (M).** A reusable `thingQuiz(host, {image|palette, regions, colors})`: three questions (a light, a shadow, a hidden color), each with three same-family options from the ~1,000 names, reveal with the share and a veil over where it lives, log to the Learner Model (`learnerLog`), end with "Learn these 3" (prQuick). Mount it on paintings, garments, looks, photos and the camera (guess mode). It replaces the painting page's guided look, gives Whose palette? a sibling, and is the "testing yourself on the colors of any thing" mechanic David named. It obeys recall-before-reveal and same-family wrong answers by construction.

**3. The painting page rebuilt around the finger (M).** Full-bleed image first; the loupe (press and drag: magnified patch, live name, veil over every region of that color, let go to keep a chip; built from namer's `isoSample` and the paintingsof/article-refs veil); a palette by eye (shadows, mids, lights as bands, plus accents pulled out by relative chroma) instead of six area bars; then the thingQuiz (rec 2); then plain-word comparisons including "the color this painter rarely uses"; More-like-this matched on accents and value structure, near-blacks excluded. The analysis grid and findings move into one "Measured" drawer. This turns David's "almost" example into the app's signature interaction.

**4. Every address works (S).** `routeName` resolves core, then library (`data/library.json`), then alias (core `also` and the search layer), and an alias opens its color with "Also called Dull Blue" as the relation line; an unknown slug shows "No color by that name" with the closest three, never Home. Also: painter palette chips scroll in place without touching `location.hash` (A8), and `tools/pages.py` builds crawlable pages for the library names. Small code, and it protects every share link, every Back after a reload, and SEO.

**5. Painter pages that show a personality, not varnish (M).** Name every palette family after its most typical painting and show it as a three-image triptych (no "Palette 3" or "Room 3"); hide shared near-blacks and browns from "Colors in most of the work" by default (toggle to include); compute "Paints like" on accent and signature colors, not six global numbers; make the barcode a scrubber; lift "Taught by" and "Guess which is his" (Whose palette?) to the first screen; offer a painter-vs-painter duel from every "Paints like" row. Sargent's page should make you want to go look at Sargent.

**6. Give design history its home (S-M).** A sixth drawer "In design" on color pages from `data/design/colors-*.json` (peak decade, top category with its lift over paintings, three example objects with English category and maker, n on every line), one Museum essay-screen "When color got loud" from `vivid.json` with the per-decade n and the posters-and-stamps caveat, and "In N national flags" as a world fact from `graph-facts.json`. Never claim a movement's color where n is tiny (Bauhaus, Art Deco).

**7. One wheel, one harmony, a calmer Studio and Museum (S-M).** Retire Lab Harmony into the Gamut wheel as a preset row on the one OKLab wheel (and make the namer's marks use the same math); move Albers to an exercise in Train and a demo on the simultaneous-contrast page, fixing the raw slug (A10); Studio becomes Capture / Name / Build + your shelf. In the Museum, Art gets one search row instead of three control rows and opens on "For you" rather than "Before 1200"; paintings-of opens at the tightest setting that returns 12 or more (A11); chords exclude same-color pairs and show each chord on its best painting (A12); Looks and garment palettes name from the Learn layer (A13).

### Quick fixes worth batching into any lane (each S)
A2 negative years, A6 basic-word definitions, A7 double match, A8 Room/Palette + hash, A9 gutters, A10 Albers slug, A11 auto-widen, A19 "units" → percent, A23 Museum cover font.

---

Screens referenced were rendered to the reviewer's scratchpad (not committed). Probe used: an iframe page that loads the app at 440x956, waits, and returns `document.body.innerText` through `tools/smoke/run-chrome.js`.
