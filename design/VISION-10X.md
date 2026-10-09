# ColorHub, ten times: the vision (2026-10-09)

David asked for a brainstorm on how to make every part of the app ten times better, using his newest ideas: color through art statistics, harmony learned from paintings, animated relationships, a painter's career as data, the aesthetics wiki with its influence graph, and pages "better than Wikipedia". He also asked what the app could become, who it helps, how it earns money, and how it changes what an encyclopedia is.

This file is the answer. It builds on GENIUS-PANEL-1, REVIEW-2/SYSTEMS, IDEAS-10X, ROADMAP §13–21 and the ATLAS prototype, and doesn't repeat them. When an idea is already specced there, it says so and points to it.

**How to read it.** The five moves are first. Each section after that is short and can be read alone. Example findings are marked **(measured)** when the number is real and from our own data (see the appendix), and **(illustrative)** when they only show the shape of a finding we haven't computed yet. Never ship an illustrative number.

---

## The five moves (read this first)

These five do the most for the most people, and each one makes the others stronger. They were adjusted after the skeptic pass (§10).

### 1. Findings with receipts: one evidence unit on every page
Every page gets one to three plain-English findings. Each finding is one sentence, opens to show the actual paintings, posters or photos it comes from, and gives its n, what it was compared against, and one caveat. One component, used on color, painting, painter, decade, aesthetic and pair pages.
- Example (measured): *"In 92% of portraits here, the lights are warmer than the shadows. In landscapes it's a coin toss (50%)."* Tap: 12 portraits and 12 landscapes, the lightest and darkest fifth of each marked, n = 591 and 696, "old varnish warms the lights".
- **Why it's leverage:** this is the thing Wikipedia can't do (its rules forbid original research), and it turns 23,778 measured paintings into something a person can read in five seconds. Every other move uses it.
- **Adjusted:** the picture comes first and the number second. A finding ships only if it beats its null baseline, its confidence interval excludes that baseline, and a person would actually say "huh". At most three per page.
- First step: S–M. Seed it from ATLAS's 11 findings and data/design/superlatives.json.

### 2. Read anything through color: one reading screen for every image
Paintings, your photos, a room, an outfit, a film still: one screen. On top is a calm summary card with three facts. Under it, in layers: many palettes, value and temperature maps, percentiles against the archive, the "dance of colors" walkthrough, what it shares colors with across paintings, decades, aesthetics, flowers and garments, and the words in it you can't name yet, with a "Learn these" button.
- **Why it's leverage:** it's the hook (people photograph things), the everyday tool (the camera names colors), and the bridge into the archive and into Learn.
- **Adjusted:** matching by palette is weak. In our archive, the nearest painter-average names the right painter only 7% of the time (measured). So matches are worded "shares colors with" and show three results with their shared colors drawn between them. They never say "your style is Vermeer". The reading itself is the star; the matches are a side note.
- First step: M. L27 (the image lens) and the subject palette view already spec and half-build this. The move is to finish it as one screen that painting pages and photos share.

### 3. Time as a dimension everywhere
One scrubber gesture, used in many places:
- a painter's career as a barcode you can play;
- decade pages that cut across paintings, posters, garments and early color photos;
- an era lens on the map, where bubble size follows how much each color was used in that decade;
- two careers on one time axis.
- **Why it's leverage:** David's new ideas (career as data, time sliders, how harmony changes) all need it. It makes the archive feel alive instead of filed.
- **Adjusted:** the archive is uneven in time (6,394 paintings from the 1600s, 1,433 from before 1500). Every scrubber prints n per decade, fades thin decades, and starts *within* a painter's career, where museum mix matters least, before making archive-wide claims.
- First step: M. The painter career barcode is first, using ATLAS's "two careers".

### 4. Every page teaches you to see
Each thing page ends with one quiet line: *"See it · 30 seconds"*. It's a tiny exercise built from that page:
- on a color: find it among its look-alikes;
- on a painting: point to where the red sits, then the dance reveals it;
- on a decade: real or made-up palette;
- on an aesthetic: which of these rooms fits.

A second line, *"Find it today"*, sends the page's colors into Seek (camera hunts).
- **Why it's leverage:** this is what makes ColorHub an encyclopedia that changes your eyes, and it's the return loop that isn't a streak.
- **Adjusted:** it never sits above the fold and never interrupts reading. It only appears where we have a solid generator: colors, pairs, paintings and decades first.
- First step: M. It reuses Learn it, odd one out and the set-page verbs.

### 5. Open the doors: measured pages, share cards, open data
- Crawlable static pages at scale: every painter, decade, aesthetic and color pair, each with a measured finding and its OG card (tools/pages.py already does colors, pages and paintings).
- A share card for every finding, reading and comparison, with the exact view's link.
- A first open dataset release of our computed palettes and findings under CC BY. It comes with a method page and a weekly "Finding of the week".
- **Why it's leverage:** the encyclopedia is worthless if nobody finds it. Measured findings are what people share, journalists quote and researchers link to.
- **Adjusted:** a page is only generated when it clears a data bar (enough n and at least one valid finding). Thin auto-pages hurt search and trust. The data is open; the reading and learning experience is the moat.
- First step: S–M per page type.

**The thesis in one line:** ColorHub is the encyclopedia of the visible world, read through color. It measures how people have actually used color and teaches you to see it yourself.

**The money in one line:** free atlas, paid instruments. The encyclopedia and core learning stay free forever. A membership (Plus for people, Pro for makers) pays for sync, deep personal tools and exports with provenance. Classrooms and museums come later (§6).

---

## 1. What ColorHub really is

**The thesis.** Wikipedia tells you that ultramarine was precious. ColorHub shows you where it sits in 23,778 paintings, how its share changed by decade, what painters put beside it, how its name and hex differ across six sources, and the three look-alikes you'll confuse it with. Then it trains your eye to tell them apart and sends you out to find it on the street. It's an encyclopedia of the visible world, read through color: paintings, painters, posters, garments, gems, flowers, poems, early color photos and your own camera roll. Its claims are measured, not asserted, and stated with their n and their caveats. Its pages teach you to see.

### Four directions it could become

**A. The Color Atlas (the reference)**
- *For:* the curious, students, designers who search "Monet palette", writers, journalists.
- *Why it wins:* nobody else has measured pages. Encycolorpedia has a page per hex with no art; Wikipedia has prose with no data; ColourLex has pigments and a small corpus. Search traffic compounds.
- *Weak spot:* reference sites get one visit and no habit. It's hard to earn money from it without ads.

**B. The Eye Gym (Duolingo for seeing)**
- *For:* art students, painters, designers, and adults who think they're "bad at color".
- *Why it wins:* subscriptions for daily skill apps are proven, and nobody combines names, perception and real art (I Love Hue is beautiful but teaches nothing to carry outside).
- *Weak spot:* casual puzzle games are crowded and cheap, and the encyclopedia becomes decoration.

**C. The Maker's Instrument (color intelligence for work)**
- *For:* designers, illustrators, interior and fashion people.
- *Why it wins:* "palettes with receipts" (every palette backed by real paintings and objects) and exports with provenance are things Coolors and Adobe can't offer. Makers pay for tools.
- *Weak spot:* it pulls toward utility and away from the soul, and Adobe and Coolors own the workflow.

**D. The Classroom and Museum Companion**
- *For:* art and design schools, teachers, museum visitors.
- *Why it wins:* the measured archive is a ready curriculum ("how paintings are built", "the 1860s go synthetic"), and museums want engagement with their open-access collections.
- *Weak spot:* the sales cycles are slow, and it means bespoke work for a solo founder.

### Recommendation
**Build A as the spine, B as the heartbeat, C as the business, and D later.** The Atlas is what ColorHub *is* (free, crawlable, measured). The Gym and Learn are why you *come back* (the daily loop, the eye profile). The Maker's tools are what people *pay for*, because they're useful at work and grow out of the same engine. Classrooms and museums come once the product proves itself with individuals. One rule holds it together: **every feature reads from the same archive and writes to the same Learner Model.** That's what keeps it one app instead of four.

---

## 2. Ten times, area by area

Tags on each idea: **Impact** H/M/L · **Effort** S (a day or two), M (a week), L (more) · **Honesty risk** low/med/high.

### 2.1 The map (Explore, the honeycomb)
*Now:* a full-screen fisheye honeycomb of about 900 core names (up to 2,700), with views, Arrange, search and Learn it from any bubble.
- **The era lens.** A year scrubber along the bottom edge. Bubbles keep their true colors (no dimming, per the honeycomb rule), but their size follows each color's share of that decade's paintings, objects and garments. Drag from 1600 to 1900 and watch what grows (illustrative until measured). n per decade under the scrubber. *H · M · med*
- **The gamut horizon.** A soft drawn outline on the map: the colors a painter's documented pigments could reach in 1500, 1700, 1860 and today. Outside the line is what history hadn't made yet. *H · M · high* (pigment dates are contested and mixing extends the reach, so label it "approximate, from first documented use").
- **Constellations.** Pick any thing (Sargent, Art Deco, the 1970s, your photo), and its colors get an outline ring on the map, with thin lines between the pairs it uses together. Outline only, never dimming. *H · S–M · low*
- **The two-finger chord.** Touch two bubbles at once and their pair page opens: how often art puts them together against chance, the paintings that hold both, the single best example. Three fingers opens the trio. *M · S · low*
- **Ask the map.** Type "sea at dusk", "1970s kitchen" or "Hokusai", and the map glides and outlines the region. Builds on mood search and SYSTEMS N3. *M · M · med*

### 2.2 Color pages
*Now:* one tap opens a full page with a big swatch, an article (about 1,900 written or data-written), look-alikes, hubs (in paintings, poems, fashion, nature, gems) and Learn it.
- **A name is a region, not a point.** Show where six sources put "teal" (the xkcd survey, ISCC-NBS 1955, Maerz & Paul 1930, CSS, Werner 1821, our pick) as dots on a small patch of the map, with the cloud of what people call teal around them. One line: how far the sources spread and which one we use. Wikipedia shows one hex as if it were settled. *H · S · low* (the data is already in data/sources/)
- **Where it lives: twelve real crops.** A grid of close-ups from paintings, posters, garments, autochromes and flowers where this exact color sits. Each opens the item zoomed to that spot. It's the varied-examples rule (CANON E3) made into a page. *H · M · low* (needs crop coordinates; start with the 4,656 locally held images)
- **Its life in numbers.** A small lifeline: its share of the archive by decade, the date its name was first recorded (Maerz & Paul's dictionary), and the word's frequency in books (Ngram) laid over it. GENIUS-PANEL #5, "Word vs paint", placed in the hero. *H · M · med*
- **Partners, measured.** What art puts beside it, showing only partners that still beat chance after the museum-and-century control, each with n. When none do, it says so: "No partner beats chance here; painters used it with everything." ATLAS found this is the usual case, which is itself a finding. *M · S · med*
- **The color in context.** A swipe strip: the color on black, on white, beside its nearest neighbor, beside its complement, small and large (Albers). Every page teaches simultaneous contrast with its own color. *M · S · low*
- **Make it, three ways.** As light (RGB), as print (CMYK, approximate) and as paint (a three-tube Kubelka-Munk mix, approximate). *M · M · med*

### 2.3 Paintings and painters
*Now:*
- 23,778 paintings, each with a measured 24-color pool, palettes, Analysis and the Pick-from-it eyedropper.
- 840 painter pages with a portrait hero, a famous-works rail and a sortable life's work.
- The ATLAS prototype (chords, the dance, two careers) sits unmerged in a worktree.

Ideas:
- **A career as a barcode.** Every painting is a vertical stripe at its year, its colors stacked by area. Where the palette shifts, a period is marked and named after its most typical painting ("Sargent's four palettes", ROADMAP §21). Scrub to play the life, and the hero painting changes as you go. *H · M · low–med*
- **The dance of colors.** A "Read this painting" button plays a 30-second guided look: each color family lights up in turn while the rest drops to grey, with one sentence each. For example: "This red is 4% of the canvas and all of the attention" (illustrative). Pause, scrub, or share it as a short vertical video. ATLAS has a working version. *H · M · low*
- **Two careers on one axis.** Painter against painter: where their palettes meet and part, year by year. Add teacher-to-student lines from Wikidata (already in the graph as "studied under") with how much of the palette they share. Always "shares", never "inherited". *H · M · med*
- **The outlier.** Every painter page shows the most typical painting and the one least like the rest, plus what makes it odd. *M · S · low*
- **Misfits.** The palette model dates some works absurdly. Wang Meng's 1308 scroll reads as 1877 by color (measured), because ink on paper doesn't look like oil under varnish. A "Misfits" shelf explains each one. It's fun, and it teaches the method's limits in public. *M · S · low*
- **The house rules, on the painting.** Base rates as quiet overlays: "Lighter at the top, like 84% of the landscapes here" (measured, n = 696). Or the opposite, which is more interesting: "One of the 16% of landscapes that are darker at the top." *M · S · med*

### 2.4 The other archives (fashion, design objects, early color photos, pulp, gems, flowers, poems, films)
*Now:* separate shelves:
- 6,140 garments from the 1700s to the 2020s;
- 11,409 design objects (posters, pulp covers, textiles, stamps, ceramics, glass, wallpaper, products);
- 3,465 early color photographs;
- gems and flowers;
- 11,440 poems;
- films (color data only).

Ideas:
- **Decade pages across every medium.** "The 1920s in color": that decade's paintings, posters, garments, wallpaper and autochromes, each medium's measured palette as a strip, then what they share and what they don't. *H · M · med* (n per medium shown)
- **Measured vs remembered.** The internet's Art Deco is black and gold. The 1920s posters in our archive are mostly light ivory and tan (measured, n = 148), partly because paper ages. Every era gets this honest double reading: the remembered palette beside the measured one, with the reasons they differ. *H · S · med*
- **What each medium can do.** The value and chroma range of oil paintings, pulp covers, stamps, Kodachrome and silk, side by side, with the physics behind each: pigments, inks, dyes and film stocks. *M · S · low*
- **Echoes across time.** Palette twins across media and centuries: a 1960s poster beside a 15th-century altarpiece with the same five colors. Worded "shares colors with", never "influenced by". It makes a perfect share card. *M · S · low*
- **Nature against art.** Flowers and gems are colors nature makes; paintings are colors people could make. Which flower colors are rare in painting before synthetic pigments? (illustrative; it needs measuring and a hedge). *M · M · med*
- **The color photos as a time machine.** 1,033 autochromes, 1,390 Prokudin-Gorsky plates and 1,042 wartime Kodachromes show the real world in color. Pair "a 1910 street" with "a 1910 painting". *M · M · high*: early processes shifted color, and the Prokudin-Gorsky images are modern composites of three plates. Say so on every one.

### 2.5 The aesthetics wiki and the influence graph
*Now:* 159 aesthetics with lineage, eras, places, figures, revivals and articles, plus a graph of 1,080 nodes and 3,058 typed edges (lineage, influence, member of, revival, same era, same place, shared colors).
- **The river of styles.** Time runs left to right. Each aesthetic is a stream in its own palette, influences flow in as tributaries, and revivals loop back to their source. Tap a stream to open its page. It's the influence graph as something you can read at a glance. *H · M · low–med*
- **Two palettes for every aesthetic.** "As its community describes it" next to "as the real things of its era and place measure", drawn from our objects, garments and paintings. When they disagree, that's the story. *H · M · med*
- **Typed links in the prose.** Every link carries a tiny glyph for its type (influenced by, reacts against, revival of, shares a palette with). A long press shows the one-sentence why and its source. The graph already stores "why" and "source" on every edge. *H · S · low*
- **Which aesthetic is this?** Point the camera at a room or an outfit and get the three nearest aesthetics by palette, color only, with the shared colors drawn. *M · S · med*
- **Revival pairs.** An original beside its revival, measured: what the revival kept, brightened or dropped. *M · S · med*

### 2.6 Learn
*Now:*
- placement, meet cards and the swipe deck;
- spaced review with Pick it, Say it and Make it;
- Learn it from any color, and stages up to about 1,000 words;
- mixed Duolingo-style lessons, approved but not built.

Ideas:
- **Learn anything you look at.** A "Learn these" button on any painting, decade, aesthetic, photo or garment builds a two-minute lesson from its colors, with the thing itself as the world step. The archive becomes the curriculum. This generalizes GENIUS-PANEL #10. *H · M · low*
- **Purpose paths.** One question at the start: "What do you make?" (paint, design screens, clothes, rooms, writing, just curious). The ladder stays the same, but examples and precise names lean that way. A painter meets burnt sienna as a tube; a decorator meets it as a wall. This is DAVID-MODEL invention #11. *H · M · low*
- **Name your week.** Every Sunday, five of your own photos from the week come back with the names hidden. You name them first, then see the reading. That's delayed, unassisted recall on your own life, the strongest honest progress signal we can get. *H · S · low*
- **How paintings are built.** A chapter that teaches the measured house rules (light above, warm lights in portraits, close hues, one dominant mass), each with its counterexamples. You learn what painters actually did, not what a wheel says. *H · M · med*
- **Words in a sentence.** Each new word comes with one real use: a public-domain poem line, an old trade-catalogue entry, a fashion caption. *M · S · low*

### 2.7 Train
*Now:* an eye gym on a level engine (levels 1–20, staircases), the odd-one-out family, Rearrange, memory, and the Colorist and Atelier shelves (kill the cast, Kelvin eye, value scale, Zorn).
- **Real or made up?** Four palettes: one is from a real painting, and three use the same colors with the wrong proportions, values or spacing. You slowly absorb how real pictures are built. Difficulty is how good the fakes are. This is "harmony learned from art" as a game. *H · S–M · low*
- **Date it.** A palette (later the whole painting) goes on a year slider. You play against the archive's model, which dates half the paintings within 86 years overall and within 50 for the 1600s (measured). Beat the machine. *H · S · low*
- **Whose palette, done fairly.** Guess the painter from five colors, but only among painters whose palettes are measurably distinct. The fingerprint test shows most aren't, and a fair game respects that. *M · S · low*
- **The wrong note, judged by art.** One chip in a real palette has been swapped; find it. "Wrong" means against the archive's statistics for that kind of picture, with the wheel's verdict shown beside it. *M · M · med*
- **The light booth.** The same object photographed under candle, overcast sky, noon, shade and a phone screen: pick its true color. It trains color constancy, using real photo pairs, and grows out of the Kelvin eye. *M · M · med*
- **Your eye against published norms.** The weekly no-feedback check, placed against published hue-test norms. It's never a diagnosis. *M · M · high*

### 2.8 Studio and the camera
*Now:* a camera that names colors (with white balance), the shared eyedropper, photo palettes, the subject palette view, Harmony, Albers, taste tests and set pages. Exports are on the roadmap.
- **Read anything** (move 2; spec in §3).
- **Palettes with receipts.** Every palette the engine makes carries its evidence, for example "this combination appears in 214 paintings, most of them France in the 1880s" (illustrative), with the three best examples. Exports keep a source line. No palette tool can do this. *H · M · med*
- **The live name lens.** Subtitles for color: pan the camera and names float on the surfaces, in place. Tap one to freeze it and open its page. *H · M–L · med* (white balance, lighting)
- **Paint it.** For any color, a mix from three tubes in a set you choose (Zorn, primaries, your own six), approximated with Kubelka-Munk, plus a "test it on a scrap first" note. *M · M · med*
- **Light and eyes.** Your palette under candle, north light and office LED, and as people with the three common kinds of color-vision deficiency see it, side by side. *M · S · med*
- **The room reader.** Photograph a room: is it all mid-tones? What's the dominant/accent split (the 60-30-10 check)? Which accents does art put beside its main color? *M · M · med*

### 2.9 You and collections
*Now:* hearts, sets (ColorSets with verbs), a "Your photos" shelf, and a You page with eye, words and taste pieces.
- **The Passport** (SYSTEMS N4): one page with your Words, Eye and Taste, each ending in one next action. Build it as specced.
- **Your color year.** Once a year, with a small monthly version: the colors you learned, found and loved, your territory on the map, the painter whose palette sits nearest your hearts, and your hardest pair. It's about what you can now see, never about time spent in the app. *H · S–M · low*
- **The field journal.** Your found colors on a calendar, so you can watch your own year move from spring greens to autumn ochres, if it does. *M · S · low*
- **Exhibitions.** Any set becomes a small exhibition: a title, a cover, a note per item, and a link. Public ones get crawlable pages once accounts exist. *H · M · med* (moderation)
- **Taste against history.** "Your hearted palettes sit closest to Nordic painting of the 1890s" (the form; built from the taste model and archive centroids). Color only, and it says so. *M · S · med*

### 2.10 Sharing
*Now:* shareURL deep links, an OG image per static page, and share cards (js/sharecard.js).
- **Every finding is a card.** Any finding, reading or comparison exports as a clean card with its evidence thumbnails, its n and a link to that exact view. Sized for Instagram stories and r/dataisbeautiful. *H · S · low*
- **The daily board.** One seeded game a day with a spoiler-free result grid in the colors you saw (CANON D5). *H · S · low*
- **Send a test.** A link gives a friend the same 30-second eye check you took. The results show side by side, encoded in the link, with no accounts. It's asynchronous, not a duel (duels stay deferred). *M · S · low*
- **Embeds.** A palette, a painter barcode or a finding card embeds on any blog with an attribution link, which brings backlinks. *M · S · low*
- **The video.** The dance of colors exports as a 15-second vertical video. *H · M · low*

---

## 3. Mechanics that cut across the app

Each of these is one piece of machinery that shows up in many places. That's how ten times more stays calm.

1. **Read anything through color.** One screen for any image. The summary card holds three facts: the key (high, mid or low), how much is truly vivid, and the one color doing the work. Below it, in layers:
   - many palettes;
   - value, chroma and temperature maps;
   - percentiles against the archive;
   - the dance;
   - what it shares colors with (painting, decade, aesthetic, flower, garment);
   - the words in it you can't name yet;
   - then Learn these, Save, Compare and Share.

   The spec is L27 plus ROADMAP §15–16.
2. **The time scrubber.** One component and one gesture (drag sideways along the bottom), used on the map, painter pages, color lifelines, decade pages and the aesthetics river. It always shows n.
3. **Compare anything.** "X vs Y" for any two things: two painters, two decades, your photo and a Vermeer, an aesthetic and its revival. One template: two columns, shared colors drawn as threads, and the findings that separate them. This is SYSTEMS U7, extended to every kind of thing.
4. **The finding unit** (move 1). A sentence, the evidence, n, the baseline and a caveat. Tap to see the items; long-press to see the method. It's the atom of the encyclopedia.
5. **The daily ritual, in three beats.**
   - Morning: today's color, its twist in 20 seconds and one painting.
   - Day: Seek, where the camera ticks it off when you find it in the world.
   - Evening: a 60-second review.

   Gentle, skippable, and never loss-framed (CANON D3).
6. **Museum mode.** Standing in front of a real painting, search it or point the camera at its label. Its page opens with the dance ready and a narrated version for headphones. For visitors, and a door to museum partnerships.
7. **Trails.** Guided walks through the graph (SYSTEMS N1), such as "Prussian blue: Berlin 1706 → Hokusai's wave → blueprints". Each Trail ends in Learn these and a Seek hunt.
8. **Shared collections** (later, with accounts). A class, a studio team or a family keeps one set together, and everyone's finds land in it.
9. **AR, later and small.** The name lens first. Later, "hang it": a painting's palette as wall-paint patches in your room, through the camera.
10. **Open data and a creator API.** The measured archive (palettes, findings, painter centroids) as a CC BY dataset with a method page, and later an API: free for low volume, paid for heavy use. Researchers and tool-makers become a distribution channel.

---

## 4. A better encyclopedia than Wikipedia

### What Wikipedia structurally can't do (and we can)
- **Measured data on every page.** Wikipedia forbids original research. We do it in the open: computed from a named corpus, with the method, n, baseline and caveats on the page, and deterministic scripts anyone could rerun.
- **Live visual evidence.** A claim shows its proof. "Painters keep hues close" opens the paintings, with the hues drawn on them.
- **Interactive pages.** Sliders (3 to 20 colors), time scrubbers, the dance, the context strip. A page is a dataset with views, not a column of prose.
- **Typed links.** Every Wikipedia link means "related somehow". Ours say *how*: looks like, studied under, reacts against, revival of, shares a palette with, pigment of. Each one has a why-sentence and a source, and they're shown in the prose.
- **One thing, one page, one name, everywhere.** Every mention of a color, painter or aesthetic links to the same page automatically, through the link map and nameOf().
- **Pages that know you.** The Learner Model knows you already have teal, so the cerulean page leads with how it differs from teal. Depth adapts: a newcomer gets the swatch and the twist; a nerd gets the method.
- **Pages that teach you to see.** Every page ends with "See it · 30 seconds" (move 4). Knowledge that changes perception, not only memory.
- **Uncertainty is shown.** Confidence on every claim, "Books disagree" boxes, myth corrections in place (the CLAUDE.md list), and "as photographed" said once and meant everywhere.
- **Never one answer.** Many palettes, many readings, many sources for one name. Wikipedia picks a hex; we show the spread.

### What we copy from Wikipedia
- **Sourcing.** Every fact is a fact card with a source (ROADMAP §19). No source, no claim.
- **Neutral voice.** Plain, grounded, no hype (DAVID-MODEL P19).
- **A visible correction process.** "Report a problem" on every claim, and a public changelog of fixes.
- **History.** "Last checked" dates on articles, and old versions kept.
- **Stable addresses.** Every page has a permanent URL (router plus static pages).
- **Licensing discipline.** Book prose is never copied, Wikipedia text is never pasted (it would pull in ShareAlike), images are public domain or properly credited, and modern art is data only.

### Governance, in three stages
- **Now (no accounts).** A "Something's off?" link on every finding and claim. It files a report tied to the fact card's ID (a GitHub issue or a simple form). David or an agent checks it against the sources. Every fix lands in a public "Corrections" page with the date. An AI policy page says it plainly: AI helps research and draft; every claim traces to a checkable source or to our own measured data; data-written sections are labeled; no image is ever generated.
- **Later (accounts).** Contributors propose fact cards (claim plus source), new aesthetics (five real items plus a palette) or crops for "where it lives". Editors approve them, and contributors are credited by name on the page.
- **Later still.** Named expert reviewers (conservators, color scientists, art historians) put "Reviewed by" on pages in their field. Disputes go on a talk tab, never into the prose.
- **Licensing call.** Release the computed data (palettes, findings, centroids) under CC BY 4.0 so people can cite and reuse it, with attribution that brings links back. Keep our prose under our copyright for now, which keeps a book open as an option. Revisit once there's a contributor community.

---

## 5. Who it helps

**Painters and illustrators**
- *The job:* see value and temperature better; understand how masters built color; mix what they see.
- *Killer feature:* a painter's career barcode plus "Paint it" recipes, and "How paintings are built".
- *Watch:* paint recipes are approximations, so say so.

**Designers (brand, UI, product)**
- *The job:* palettes that work and that they can defend to a client.
- *Killer feature:* palettes with receipts, plus exports (Figma, ASE, CSS tokens) that carry their provenance. Contrast and color-blind checks included.
- *Watch:* never claim a palette will "convert better".

**Fashion and interior people**
- *The job:* know what an era really looked like; read a room or an outfit.
- *Killer feature:* decade pages (measured against remembered), the room reader, and "Which aesthetic is this?".
- *Watch:* seasonal color analysis is a popular styling system with little research behind it. If we touch it, separate what's measurable (contrast with your hair and skin in a photo) from lore.

**Students (art history, design foundations)**
- *The job:* understand movements and periods, and pass the course.
- *Killer feature:* Compare anything, the aesthetics river, Trails, and Date it.
- *Watch:* findings come from one archive's open-access paintings, not "all of art". Teach that too.

**Teachers**
- *The job:* a lesson that makes 25 people look harder at a painting.
- *Killer feature:* the dance of colors on a projector, "Real or made up?" as a class game, and shared class sets (later).
- *Watch:* no accounts for minors without proper consent; start with university and adult programs.

**People with color-vision deficiency** (about 1 in 12 men of Northern European descent)
- *The job:* "what color is this shirt?" and "does this match?".
- *Killer feature:* the live name lens and camera naming, plus simulation so their designer friends can check their work.
- *Watch:* the eye checks aren't a diagnosis, and the training games must never feel like a test they're doomed to fail. Offer a CVD-aware mode.

**Museum visitors**
- *The job:* get more out of the painting in front of them.
- *Killer feature:* museum mode: the dance, narrated, plus "what this painter usually did" and the outlier.
- *Watch:* museum photos differ, so say "as photographed".

**Writers**
- *The job:* the exact word for a color, and its history.
- *Killer feature:* a name is a region (sources compared), words in a sentence, "also called", and first-recorded dates.
- *Watch:* etymology myths (the CLAUDE.md list).

**Colorists and filmmakers**
- *The job:* match shots, read a look, kill a cast.
- *Killer feature:* the Colorist shelf, read-anything on a film still, and films as color data.
- *Watch:* no film frames stored where rights don't allow; data only.

**The curious**
- *The job:* a rabbit hole that leaves them smarter, not just scrolled.
- *Killer feature:* the map, Trails, Misfits, "measured vs remembered", and the daily color.
- *Watch:* depth one tap down, calm on top.

---

## 6. Money

### The options, honestly

**Consumer membership ("Plus")**
- *What:* sync across devices, unlimited saved photos and readings, the full eye history and Passport, the color year, offline packs, the advanced Train worlds.
- *Good:* recurring revenue, and it fits a habit app.
- *Bad:* it's tempting to paywall learning, which would betray the mission. Draw the line at "your stuff and deep personal tools", never at knowledge.

**Maker tier ("Pro")**
- *What:* exports with provenance (ASE, Procreate, Figma plugin, CSS and design tokens), batch image reading, brand palette audits, contrast and color-blind reports, the API.
- *Good:* the highest willingness to pay, and it grows straight from our engine.
- *Bad:* it competes with Coolors (Pro about $3 a month billed yearly) and Adobe, and brings support costs.

**Education licenses**
- *What:* class sets, a teacher view, curriculum units ("how paintings are built", "color and the industrial revolution").
- *Good:* fits the mission, recurring, credible.
- *Bad:* slow sales, and privacy law for minors. Start with universities, art schools and adult programs.

**Museum partnerships**
- *What:* a "Read this painting" companion for a collection, or custom findings about their holdings. In return: sharp images, credibility, links.
- *Good:* prestige and better images.
- *Bad:* bespoke work, slow, small money at first.

**Prints and objects**
- *What:* painter career barcodes, decade posters, a palette card deck (a physical flashcard set with stories), all print-on-demand.
- *Good:* beautiful, no inventory, and every print is marketing.
- *Bad:* printed color isn't screen color. It needs proofing and a "printed colors approximate the screen" note. Thin margins.

**Paid deep-dive courses**
- *What:* for example, "See like a painter: value, temperature, edges", six weeks.
- *Good:* high value per buyer.
- *Bad:* expensive to make well, and it can split the product. Later, if at all.

**A brand and consulting arm**
- *What:* color audits for brands, with historical provenance (it could run through David's studio).
- *Good:* big tickets, revenue now.
- *Bad:* it doesn't scale and pulls focus from the product.

**Patronage and grants**
- *What:* a "Friends of ColorHub" tier (names on a supporters page, early features), cultural and education grants.
- *Good:* fits the ethos perfectly.
- *Bad:* small and unpredictable.

**Licensing aggregate archive data** to researchers or companies (never user data)
- *Good:* fine ethically.
- *Bad:* small market, and it conflicts with the CC BY release unless the paid product is a service (fresh, custom or high volume).

### What not to do
- **No ads.** Nothing cheapens a museum faster.
- **Never sell or share user data.** Photos stay on the device until sync, and synced photos are never used to train anything.
- **Never paywall the encyclopedia.** Every page, finding and article is free.
- **No sponsored colors or sponsored findings.** A paint brand can sponsor the Mix lab only if it's clearly labeled and kept away from pages.
- **No dark patterns:** no streak-loss fear, no fake scarcity, no "your progress will be lost".
- **Never rebuild a proprietary library** (Pantone, RAL Design, NCS) to sell it (LEGAL-COLOR-DATA §8).
- **No NFTs and no AI-generated "paintings".**

### Recommendation: membership, like a museum
**The galleries are free. Members get the studio.**
- **Free forever:** every page and finding, the map, core learning (the whole path to about 1,000 words), the daily color, the basic camera, and a reasonable number of saved photos.
- **Plus** (test about $4 a month or $30 a year, with a lifetime option): sync, unlimited readings and photos, the full Passport and color year, offline, and the advanced Train worlds.
- **Pro** (test about $9 a month or $80 a year): everything in Plus, exports with provenance, the Figma plugin, batch reading, brand audits, and API credits.
- **Later:** Classroom licenses (per seat or per school year) and museum pilots.
- **Alongside:** a print shop and the Friends tier.
- **The rule:** nothing free is ever taken away. Decide the free/paid line *now*, before accounts, so no feature has to be clawed back later.

The prices are only starting guesses to test. Coolors and Pantone Connect (about $60 a year) bracket them.

---

## 7. Growth and distribution

**Search, built on measured pages**
- tools/pages.py already makes static pages for colors, wiki pages and paintings with OG images.
- Add painters (840), decades, aesthetics (159), color pairs ("teal and orange in art"), and the long tail of questions: "what colors go with sage green" (answered with art's evidence), "Monet's palette", "Art Deco colors".
- Add schema.org markup.
- The gate: no page without enough n and one valid finding (move 5).

**Shareable artifacts**
- the finding cards;
- painter barcodes;
- the dance videos;
- "your color year";
- the daily board;
- "Date it" scores;
- send-a-test links.

Each one carries the link to its exact view.

**Communities**
- **Aesthetics TikTok and Instagram:** measured-against-remembered posts ("what Art Deco really looked like") and the dance videos.
- **r/dataisbeautiful:** one honest finding a week, with n and the method ("Across 21,218 paintings, hues within 15° of each other sit together 1.6 times as often as chance").
- **r/ColorPalettes, r/Design, r/painting, r/ArtHistory, r/colorblind:** each one gets its own killer feature (§5).
- **Hacker News and Kaggle or Hugging Face:** the open dataset launch.

**Partnerships**
- Color creators like Peter Donahue (already an open question; Claude drafts, David sends).
- Open-access teams at the Rijksmuseum, SMK, Art Institute of Chicago and Cleveland (show them their collection read through color).
- Art and design schools.
- Wikimedia Commons, where we credit and link back.

**Press**
- Findings make stories: "A painting's colors alone can date it to within a lifetime", "Painters keep hues close: neighbors share a canvas 1.6 times as often as chance", and the Misfits.

**The weekly beat**
- One "Finding of the week" across the app, the site, a short post and the newsletter (later). A small, steady, honest drumbeat.

---

## 8. Risks and honesty guardrails

**Image rights**
- Only public-domain or properly licensed images, as now; modern art is color data only.
- Check pulp covers and posters item by item: many mid-century covers are still under copyright.
- Make "where it lives" crops only from images we're allowed to show.

**Proprietary color data**
- Never rebuild Pantone, RAL Design or NCS. Name single codes in context only, as screen approximations, and say so.
- Brand colors are history, never logos (data/design/brands.json already follows this).

**Myths**
- The CLAUDE.md list is a gate on every writing batch.
- New findings can create new myths, so a striking finding gets a second check before it becomes a share card.

**Statistics that lie**
- The archive is these museums' open-access paintings (heavy on Dutch, Danish and American collections), photographed, often varnished.
- Every finding needs a null baseline, a confidence interval, a minimum n and one caveat (ATLAS already does this, so make it the law).
- Watch for artifacts: yellowed varnish pushes hues together and warms the lights, and the "fingerprint" is partly each museum's camera.
- Test many things and some will look significant by luck, so hold back findings that don't replicate across museums.

**AI credibility**
- The biggest risk to the encyclopedia idea.
- The answer is fact cards with sources, labeled data-written sections, the public method and corrections pages, no generated images, and no generated quotes.
- If one article is caught inventing a fact, the whole archive's trust drops, so fact-checking is part of the product.

**Privacy**
- Photos stay on the device until the user chooses sync.
- Classroom use means consent and data minimization.

**Scope creep against the craft bar**
- This is the real danger. This file has about 60 ideas, and the app already has a lot of surface. The guardrails:
  - **One in, one out** (DAVID-MODEL P22).
  - Every new idea must reuse the five machines (the Thing page, the Set, Compare, the finding unit, the time scrubber) or it waits.
  - Nothing ships without a craft critique and screenshots at 440×956.
- No new rooms. Ideas land as layers on existing pages.

**Performance**
- More data on phones means more lazy shards, workers for image reading, and a size budget per page.

**Bandwidth**
- One founder plus agents: keep to two lanes at a time and Sonnet by default (memory rules). Ten times the vision isn't ten times the lanes.

**Monetization drift**
- Write the "never" list (§6) into CLAUDE.md before the first paywall exists.

---

## 9. The roadmap

### Next two weeks: finish, unify, make it measurable
1. **The finding unit** plus a method page plus a "Something's off?" link. Seed it from ATLAS's 11 findings and superlatives.json, and put it on painting, painter and color pages. *S–M*
2. **Merge ATLAS into painter and painting pages:** the career barcode (a first cut), the dance on painting pages, two careers from the painter page. *M*
3. **Read anything, v1:** finish L27 and the subject palette view as one shared reading screen for paintings and photos. *M*
4. **"A name is a region"** on color pages, using the sources we already have. *S*
5. **Finding share cards** using sharecard.js. *S*
6. Write down the free/paid line and the "never" list (a doc only, no code).

### Next two months: time, teaching, and the open door
1. Decade pages across every medium, plus the era lens on the map, with n everywhere. *M–L*
2. "See it · 30 seconds" on color, pair, painting and decade pages; Learn anything you look at; Seek camera hunts. *M*
3. Harmony learned from art: "Real or made up?", Date it, and the art-based wrong-note round in Train; art's partners as a strategy in the palette engine (beside wheel math, never replacing it). *M*
4. Static pages for painters, decades, aesthetics and pairs, with schema.org and OG cards, gated on data. *M*
5. Open data v1 (CC BY) plus the first "Finding of the week" posts. *S–M*
6. Aesthetics: typed-link glyphs in prose, two palettes per aesthetic, the river (a first version). *M*
7. Accessibility: a CVD-aware mode, plus the name lens as a utility. *S–M*

### Next six months: accounts, membership, institutions
1. Accounts and sync (Supabase was the earlier pick), then launch the membership: Plus and Pro (exports with provenance, a Figma plugin, batch reading).
2. Governance v1: fact-card proposals, the public corrections log, contributor credit.
3. A classroom pilot with two or three university or adult art and design programs: class sets and a teacher view.
4. A museum pilot with one open-access museum: museum mode and sharp images.
5. A print shop: barcodes, decade posters, the flashcard deck (with a proofing step).
6. The Russian edition, once the English app is finished (per HANDOFF).

**What we measure** (honest metrics only):
- names recalled a day or more later;
- the eye's threshold trend from the no-feedback check-ins;
- pages read per visit and how many sessions end with a "See it";
- findings shared;
- corrections received and fixed;
- returning users at day 7 and day 30.

Never "minutes in app".

---

## 10. Skeptic pass on the five moves

**1. Findings with receipts**
- *Against:* statistics bore most people, and many findings are artifacts of the archive (varnish, museum cameras). Half-true findings in a confident card would damage trust faster than prose would. ATLAS's own partner test found that once museum and century are controlled, few cross-hue pairs beat chance.
- *Adjusted:* lead with the visual evidence and a plain sentence, with the numbers one tap down. A finding ships only with a baseline, an interval, a minimum n, a caveat, and a check that it holds across museums. At most three per page. "No effect" counts as a finding too ("painters used it with everything").

**2. Read anything through color**
- *Against:* it's a big screen with many layers, and every analysis app already gives you a palette. The "nearest painting" is weak (7% for the right painter), so users will feel it's random. Phone photos have casts and auto white balance.
- *Adjusted:* the reading is the product and matching is a side note worded "shares colors with", with the shared colors drawn. Show the white-balance caveat and offer the existing white-balance fix. Calm summary first, layers below. Finish L27 instead of starting something new.

**3. Time as a dimension**
- *Against:* the archive is lopsided in time and place, so archive-wide trends may show the collections, not history. Scrubbers are fiddly on a phone.
- *Adjusted:* start inside one painter's career, where the museum mix matters least. Print n per decade and fade thin decades. Normalize by museum where possible. Use one shared scrubber component with big targets and haptic ticks per decade.

**4. Every page teaches you to see**
- *Against:* it's clutter. Readers want to read, David hates overwhelm (P6, P22), and a quiz on every page feels like homework.
- *Adjusted:* one quiet line at the very end, never above the fold, only where a strong generator exists, and always optional. It counts toward the Learner Model, so it pays off in Learn, not as extra chrome.

**5. Measured pages, share cards, open data**
- *Against:* search engines demote mass-generated pages. Open data lets competitors copy us. A solo founder can't keep up a posting schedule.
- *Adjusted:* gate generation on real data and at least one valid finding, and ship fewer, richer page types first (painters, then decades). CC BY means copiers must credit us, which brings links. The moat is the reading and learning experience, not the numbers. "Finding of the week" comes straight out of the finding unit, so posting is close to free.

**What the skeptic pass moved off the top five**
- "Harmony learned from art" as its own headline. ATLAS shows the strongest learned rule is close to "keep hues close" (1.6× chance for neighbors within 15°, 0.6× for opposites), and yellowed varnish pushes in the same direction. It lives on, inside Train and the palette engine, always beside the wheel and never as a replacement.
- Monetization. It's a six-month move. The only thing to do now is fix the free/paid line.

---

## Appendix: the real numbers this file uses

All measured on 2026-10-08/09 from our own data. "As photographed" applies to all of them.

**Corpus sizes**
- **Paintings:** 23,778 with measured 24-color pools (data/gallery/index.json); 840 painter pages (data/artists/p/); 4,656 small images held locally.
- **Design objects:** 11,409 in data/design/objects-*.json (graphic 1,854; textile 1,620; poster 1,267; product 1,187; ceramics 1,178; stamps 943; costume 930; pulp 832; wallpaper 766; glass 646; furniture 186).
- **Other archives:** 6,140 garments (1700s–2020s); 3,465 early color photographs (1,390 Prokudin-Gorsky, 1,042 FSA/OWI Kodachrome, 1,033 autochrome); 11,440 poems.
- **Aesthetics graph:** 1,080 nodes and 3,058 typed edges over 9 edge types (data/aesthetics/graph.json); 159 aesthetics with KB entries.
- **Color graph:** 1,754 nodes and about 10,500 look-alike edges (data/graph/index.json).
- **Writing:** about 1,900 color articles (data/articles/).
- **Names:** 1,000 names cover painting colors at a median ΔE00 of 2.9 (ROADMAP §13).

**Findings** (design/ATLAS/data/findings.json in worktree agent-af180dd956579904d)
- **Close vs opposite hues:** hues 0–15° apart sit together 1.6× as often as chance; near-opposites (165–180°) 0.6× (n = 21,218).
- **Dating:** from its colors alone, half of 23,129 paintings are dated within 86 years (guessing the median year: off by 112). For the 1600s, within 50.
- **Misfit:** Wang Meng's *Writing Books under the Pine Trees* (1308) is dated 1877 by palette.
- **Fingerprint:** the nearest painter-average palette names the right painter 7% of the time (top five: 21%) among 158 painters; chance is 0.6%. Caveat: part of the fingerprint is each museum's camera.
- **Light above:** 84% of landscapes are lighter in their top third (n = 696); portraits 44% (n = 591).
- **Warm lights:** the lights are warmer than the darks in 92% of portraits, 50% of landscapes and 74% of other pictures. Caveat: yellowed varnish.
- **Lit figure:** portrait centers are lighter than the edges in 89% of 1700s portraits, falling to 44% in the 1900s (n = 39, wide interval).
- **Posters:** the 1920s posters' largest areas are Light Ivory (5.8%) and Tan (3.9%) (n = 148, data/design/superlatives.json).
