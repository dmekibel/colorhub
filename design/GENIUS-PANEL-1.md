# Genius panel 1: making every system work as one (2026-10-08)

A review of `design/MASTER-PLAN-2026-10-08.md` against David's standing rule: *how can this be more clever, more genius, and work with every other part of the app?* The panel read the master plan, CLAUDE.md, ROADMAP §1 and §14–§21, JOURNEY.md, COLOR-PAGE-PLAN.md, COLORNERD-IDEAS §3 and the learning KB §1–10, and looked at the real data in `data/analysis/`, `js/` and `research/_raw/ngrams/`.

Tags show who proposed each idea: **[Sci]** color scientist · **[Cur]** curator and art historian · **[Learn]** learning scientist · **[Game]** game designer · **[Apple]** Apple designer · **[Teen]** the 16-year-old.

---

## 0. The verdict in one screen

**The organizing idea:** *ColorHub is one map of all color, which you light up by learning to name and see it, and every painting, painter, flower, poem and photo is a constellation on that same map.* (Section 5 covers navigation.)

**Four structural calls come before any lane builds** (section 2):
1. **The Learner Model has no owner.** No lane builds it, yet every "connection" in the plan depends on it. Today what you know is scattered across `S.cards`, `S.gym`, `S.taste`, `S.palettes` and IndexedDB photos, and nothing records *what you answered when you were wrong*. **Add L19: `js/learner.js`, an event log plus 5 readers (S, build it first).**
2. **One universal object, the ColorSet, with one set of verbs.** A painting, a painter, a decade, a photo, a poem, a flower, a lesson, your mix-ups: each is a set of colors with shares. Each set gets the same verbs: *on the map · learn it · play it · compare · make a palette · save · share*. That gives 10 × 10 connections from one grammar instead of 45 hand-built links. ROADMAP §20 already does this for games; this applies it to the whole app.
3. **One identity per color.** The archive splits single colors into several. Sargent's real analysis file lists *Bistre* and *Bister*, *Olive-Brown* and *Olive brown*, and *Brown Grey* and *Brownish Grey* as different colors. That splits his shares and invents "favorite pairs" (one of his findings: "pairs bister with brownish grey… 3 of 37 paintings"). Merge aliases before any counting.
4. **The archive is brown, and it has to say so.** *Ink* is the top color of every decade from 1860 to 1880, and Sargent's "signature" is Ink at 2.4×. That is varnish plus museum photography, not Sargent. Every archive statistic needs a second lens, **within the painting** (lightness rank, accents, hidden colors), alongside **as photographed**.

---

## 1. The panel

- **The color scientist [Sci].** "Every number you show is a claim about a human eye. CIEDE2000, OKLab averaging, the shown-ΔE after 8-bit rounding: you already do this better than most apps. Now be just as strict about the archive and the words. A photographed varnished canvas is not a pigment, and 'amber' in Google Books is mostly resin. You have the `_ADJ` series, so use it."
- **The curator [Cur].** "You have 23,531 paintings and you're using them as thumbnails. A curator would make each one *teach*: where the eye goes, the color nobody notices, the glue tone holding it together. And please don't let the data say 'Sargent loved ink'. Say what's true: in these photographs his darks dominate, and here is what he did *inside* them."
- **The learning scientist [Learn].** "The connections David wants are retrieval cues. Every time a color shows up somewhere you've already been (a painting you opened, a photo you took), that's the KB's §9 transfer prompt: 'where have you seen this before?' And log what people *answered*. A confusion pair is the most valuable data point in the whole app, and right now you throw it away."
- **The game designer [Game].** "Your core verbs are already great: find, order, recall, name, match, make. The trick is that the *board* can be anything: your photo, the painting you just opened, your three worst mix-ups. Players love a game made from their own stuff. And every game needs a daily shared seed: one painting a day, the same for everyone."
- **The Apple designer [Apple].** "Fewer surfaces, one mark. Your relation to a color (met, yours, confused) should look the same on every screen, the way a checkmark does. Verbs belong next to the thing they act on, not on a separate tab. And the honeycomb is your map: make everything land on it."
- **The 16-year-old [Teen].** "I'd use this every day if it told me something about *me*. Like which painter my camera roll looks like, or what colors are in my room that I don't have words for. And let me screenshot it. If the map fills up as I learn, I'll keep going just to see it fill."

---

## 2. The four structural calls (wire these first)

### 2.1 L19 · The Learner Model core: `js/learner.js` (S, Sonnet, before L9/L10/L16)
- **One write call.** `lmLog({t, k, c, as?, surf, ms?, conf?, ref?})`
  - `k` (kind): `met`, `recall_ok`, `recall_miss`, `pick_wrong`, `seen`, `found`, `read`, `checked`.
  - `c`: color slug. `as`: what you answered instead (the confusion). `surf`: deck, lesson, train, camera, article, painting, photo. `ref`: painting, article or photo id.
- **Storage.** `S.lm` is a capped ring of about 3,000 compact events (~150 KB), plus small derived indexes rebuilt at load. It's additive to `colorhub-v1` and goes through a `migrateState()` step.
- **Five readers that every lane uses:**
  - `lmStatus(c)`: unmet, met or yours, plus dates.
  - `lmPairs(c?)`: confusion pairs `{a, b, n, lastT, dir}`, with the direction of the miss.
  - `lmSeen(c)`: the paintings, articles, photos and finds where you met this color.
  - `lmWeak()`: weak families and weak axes (lightness, chroma or hue), from the gym plus the deck.
  - `lmEdge()`: unmet colors one graph hop from your Yours colors.
- **Writers, one line each:** the deck swipe, `quiz-*` wrong picks (`as`), the `say`/`type` near-misses, gym misses (`dir`), camera keeps, painting and article opens, photo saves.

### 2.2 The ColorSet and its verbs (S–M, conductor-owned, `js/colorsets.js` already exists)
- **Shape:** `{id, kind, title, colors: [{slug, hex, share, role?}], href, src}`. `kind` is one of painting, painter, decade, movement, photo, poem, flower, gem, look, film, lesson, pairs, search or palette.
- **Every page exposes `toSet()`.** Every verb accepts any set:
  - `onMap(set)`: a honeycomb constellation;
  - `learnSet(set)`: a composed 3-minute lesson;
  - `playSet(set, task)`: a game board;
  - `compareSets(a, b)`;
  - `paletteFrom(set)`: Studio;
  - `saveSet(set)`: the Cabinet;
  - `shareSet(set)`: the share card.
- A new system then gets every connection for free by writing one `toSet()`.

### 2.3 One color identity (S, L15 owns the data, L6 consumes it)
- `data/graph/aliases.json`:
  - spelling variants (Bistre/Bister, Grey/Gray);
  - hyphen and case variants (Olive-Brown/Olive brown);
  - "-ish" twins under ΔE 2 (Brown Grey/Brownish Grey);
  - same pigment, different name (Konjō-iro = Prussian blue).
- `tools/analyze.py` and `graph_build.py` merge on the canonical slug **before** shares, lift and pairs.
- A check fails on any two names whose normalized spelling matches and whose ΔE is under 1.

### 2.4 Two lenses on every archive fact (M, L6 computes, L11/L5 show)
- **As photographed:** today's numbers.
- **Within the painting:** the role from the lightness rank inside the painting (shadow, mid, light), membership in `acc` (accents), `hid` (hidden colors) and `foc`/`glu`, which survive varnish because they're relative.
- **Lift against the same museum's baseline**, so a museum's camera can't become a painter's "signature".
- Painter findings need support of at least 10 for pairs (today it's 3).

---

## 3. Lane upgrades (3 per lane; each connects to at least 2 other systems)

### L5 · Rich computed color pages
> [Learn] "The page should know you. A color page that doesn't mention you confused it with lavender yesterday is a brochure."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Learn] "You and this color"**: one line under the hero: "Yours since 3 Oct", "You've answered *lavender* for this 3 times" with a 20-second duel, "Found twice with the camera", "In 4 of your Cabinet pieces" | Learner Model, Train, Camera, Cabinet | `names.js` reads `lmStatus`, `lmPairs`, `lmSeen`. The duel is gym-engine odd-one-out on the two hexes, 5 trials. |
| **[Sci] "Can you see the difference?"**: every look-alike row shows its ΔE00 next to *your* threshold for that family: "ΔE 3.1. Your blue threshold is 2.2, so you can see this." Or: "Below your threshold so far: train it." | Train (eye profile), Learner Model, Journey (late words wait for a finer eye) | A helper `eyeThreshold(family)` from `S.gym` trials (`famHits` already exists). |
| **[Cur] "Its role in paintings"**: a bar of shadow / mid / light / accent from the within-painting lens. Each segment opens the painting where that role is strongest, highlighted on arrival. | Painter/painting pages, Color Graph (*appears in* with role), Journey (`find-in-painting` uses the same pick) | Role counts in `data/analysis/color-*.json`. Highlight-on-arrival already exists. |

### L6 · Color Graph builder
> [Sci] "Identity first. If one color has three ids, every edge built on top of it is wrong three ways."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Sci] Canonical slug + alias merge** before any counting (section 2.3). Name collisions automatically generate disambiguation pages ("Sapphire" vs "Sapphire Blue" vs "Sapphire (Crayola)"). | Painter pages (stats stop splitting), Learner Model (one key per color), Articles (disambiguation for free) | `data/graph/aliases.json`, read by `analyze.py` and `graph_build.py`; a check in `check_names.js`. |
| **[Cur] Two weights on every archive edge**: as photographed and within the painting, plus lift against the same museum's baseline. | Painter pages (honest signatures), field notes, Journey's honesty gate for world steps | `analyze.py`: a baseline per `source`. The `acc`/`hid`/`foc`/`glu` fields already exist per painting. |
| **[Game] `graph-lite.json`**: at most 8 typed edges per color, shipped in the first prefetch, so every surface can make "one more hop" offline. Lesson feedback: "mauve was named after the mallow". The camera: "seen most in…". Cabinet silhouettes: "unlocks with cerulean". | Journey, Camera, Cabinet | Budget ≤ 300 KB; added to the `loader.js` prefetch. The full shards stay lazy. |

### L7 · The article engine (research → write → check)
> [Cur] "A fact written once should light up every page it touches. Right now a card about cochineal is prose trapped in one article."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Cur] Fact cards emit graph edges.** Each card names its nodes (color slugs, pigment, person, place, date) and an edge type (*named after*, *same pigment*, *first recorded*). One card powers every color, hub and "see also" it touches. | Color Graph, Explore hubs, painter pages (person cards link to painters) | Card schema `{claim, src, page, conf, theme, nodes[], edge?}` in the private store. Only node and edge ids go to the repo, never text. |
| **[Learn] Check cards at the end of every Deep or Medium article**: 2–3 questions written from its own fact cards. They become the deep-dive stone's recall questions and a Journey story step 1–7 days after you read the article. Read plus recalled gives that article's Cabinet card its solid disc. | Journey, Learner Model, Cabinet | `checks[]` in `data/articles/<slug>.json`. Gate: every answer must be a card's claim. |
| **[Sci] Data-born hooks.** The gate scores every computed field note for surprise: lift ≥ 3 with support ≥ 20; a percentile ≥ 95; the archive's peak decade far from the word's peak in the Ngram `_ADJ` series. It hands the top 3 to the writer as lead candidates, caveat attached. | Color Graph/analysis, Explore's "Did you know" cards (same list), L17 page descriptions | `tools/article_gate.py surprises(slug)`. Use `research/_raw/ngrams/cs__<word>_ADJ.json` (the color sense), not the noun, which for *amber* is mostly resin. |

### L8 · Article UI
> [Apple] "Tabs hide half the page, and most people never switch. Put the verb right next to the fact."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Apple] Verbs live next to their facts.** Paintings shelf → *Play this board*. Family tree → *Duel the look-alike*. Mixing recipe → *Mix it*. Field-note places and decades → *On the map*. One scroll; the Read/Do pill becomes a jump link to the first verb. | Train, Mix lab, honeycomb | Each `article.js` section renderer takes `verb(set)` from section 2.2. |
| **[Learn] The mix-up card.** If the Learner Model holds a pair with this color, a card shows in **both** articles: "You've mixed this up with teal 4 times. Teal is greener and lighter." It has a 3-round inline duel and disappears once a delayed check gets the pair right twice. | Learner Model, Train, Journey (the pair is flagged for the next review) | `lmPairs(slug)`, `offset()` from gym-engine. |
| **[Teen] The family tree as a living mini-honeycomb.** Parents, siblings, children and look-alikes as a small hex cluster, lit by your status (Yours solid, met outlined, unmet dim). Tapping an unmet sibling offers *Learn it*, and the path skips it later. | Color Graph, Learner Model, honeycomb, Journey | `honey.js` already renders any list. |

### L9 · Learning beyond the 101 and the Journey
> [Learn] "Where have you seen this before?" is the strongest transfer prompt we have. Your own trail is the best source of answers.

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Learn] World steps from your own trail.** The composer first checks `lmSeen(color)` for a painting, article, photo or camera find you already touched that holds the color ("The Hammershøi you opened yesterday: find pearl grey in it"). Only then does it fall back to the archive. | Learner Model, painter pages, Studio photos, Camera | `JR_STEPS[k].eligible` reads the seen log first. The honesty gate stays (≥ 5% of the canvas, ΔE ≤ 5). |
| **[Learn] Personal look-alikes.** Each new name's contrast partner is the known neighbor *you* confuse most (from Train misses, wrong quiz picks, camera corrections), if one is within ΔE 12. Otherwise it's the graph's *confusable* edge. | Learner Model, Train, Color Graph | `composeLesson(record, …)` takes `lmPairs()`. |
| **[Game] Missions you can pass with your own photos.** Chapter and stage missions accept a saved photo. The app proposes regions with `nameOf`; you name the spot first, then see the answer. Confirmed finds go to a *Your finds* drawer and count as review. | Studio photos, Camera, Cabinet, Learner Model | `photos.js` palettes plus a tap-to-name screen. Finds are `found` events. |

### L10 · Train: game grammar and progression
> [Game] "Players love a game made from their own stuff. The board is the content slot, so let anything fill it."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Game] Boards from any set.** `playSet(set, task)` lets every station draw from today's words, your mix-up pairs, the painting you just opened, or your last photo ("Odd one out: the greens in your garden photo"). | Learner Model, painter pages, Studio, Journey | `pickBase(want)` in gym-engine gets a set source; `metColors()` becomes one source of several. |
| **[Cur] "Whose palette?"** Five colors from one painter's typical cluster; pick the painter from three (the analysis's `nearest` painters). The answer opens the painter page with the signature line, and a correct run unlocks the painter's Cabinet card. | Painter pages, Color Graph, Cabinet | `analyze.py` writes `quiz.json`: only painters with n ≥ 12 whose cluster is separable from the distractors by a margin (a solvability check). It uses the within-painting lens, so this doesn't become "spot the varnish". |
| **[Sci] A three-axis eye profile.** Store each miss's direction (ΔL, ΔC, Δh; COLORNERD §6 item 6) and send it outward. Lessons add *which direction* steps on your weak axis, and color-page feedback leads with it ("watch the lightness"). | Learner Model, Journey, color pages | Trials store `dL/dC/dH`; `weakBand` per axis feeds `lmWeak()`. |

### L11 · Painter, painting and movement pages
> [Cur] "Every painting should teach you where to look."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Learn] "Learn this painting."** One button composes a 3-minute lesson from the painting's named palette: at most 3 unknown colors as new words, known ones as review, and the painting as every world step. Works on all 23,531. | Journey composer, Learner Model, Cabinet (the painting's card unlocks on completion) | `learnSet(painting.toSet())` → `composeLesson` with a focus set. |
| **[Cur] A guided look in three stops**: the focal color (`foc`), a hidden color (`hid`, "the greens in the skin") and the glue mid-tone (`glu`). Each stop zooms to the region, shows the precise name *and* the nearest taught word, and asks one guess-first question. | Color pages, Learner Model, Journey (the same step type in lessons) | The fields are already in `data/analysis/paintings-*.json`. The region comes from the `cm` color map. |
| **[Teen] "You and this painter."** How close your taste (`taste.js`), your saved photos and your Yours colors sit to this painter's palette families: "3 of Sargent's cluster colors are Yours. Your Venice photos sit nearest his second palette." | Learner Model, Studio photos, the taste model, Cabinet | Set overlap plus the taste utility over each painter's cluster centroids. All are client-side. |

### L12 · Design lead
> [Apple] "One mark, everywhere, like a checkmark. People should never relearn what 'yours' looks like."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Apple] One relation mark on every chip in the app**: nothing (unmet), an outline ring (met), a solid corner disc (Yours), a hairline thread between two chips (you confuse them). The same mark on the honeycomb, the Cabinet, palettes, painting chips and the lesson fan. | Learner Model, honeycomb, Cabinet, painter pages | One CSS component, `.rel[data-s]`, fed by `lmStatus()`. |
| **[Apple] A global squint key**: one value-only toggle on every image and palette (painting, photo, Cabinet card, honeycomb), the same gesture everywhere, so value becomes a habit. | Train (the squint station), painter pages, Studio | Images: a canvas pass to Lab L*, because CSS `grayscale()` isn't perceptual. Swatches: `lab(h)[0]`. |
| **[Teen] Fly to the map.** At lesson complete, each new color flies from the fan to its spot on the honeycomb and lights it. Over weeks the map visibly fills. | Journey, honeycomb, Cabinet | A position lookup in `honey.js` plus a FLIP animation. Reduced motion means a fade. |

### L13 · Studio: palette engine, mosaic picker, image analysis
> [Cur] "Harmony theory is a wheel. Harmony *practice* is 23,000 paintings. Show both, and say which is which."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Cur] "As painters paired it."** A palette strategy from the graph's *paired with* lift: seed → the partners painters actually put on the same canvas above chance, each with its count and n. Tap to see those paintings. | Color Graph, painter pages, Articles ("Its company" section) | Pair lift from `analyze.py` with merged aliases and support ≥ 20; within-painting lens by default. |
| **[Game] Every palette is a lesson and a board.** A palette card shows how many of its names are Yours, then *Learn the 3 you don't know* (a Journey focus lesson) and *Play it* (an odd-one-out board). | Journey, Train, Learner Model | `learnSet` and `playSet` from section 2.2. |
| **[Sci] One interval vocabulary.** The music framing labels a palette's steps (neighbor, third, complement, plus value steps) with exactly the words the Train interval game and the harmony wiki node use. A palette's "why" line is then a review of a Train skill. | Train, Articles (the harmony node), Mix lab | One shared `intervalOf(a, b)` in core. The analogy hedge from ROADMAP §16 stays. |

### L14 · Mix lab
> [Sci] "Mixing is where the myths live. Give each myth an address you can open."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Sci] Myth presets with addresses.** `#/mix/<a>+<b>/<mode>` deep links. The myth-list corrections (pointillist dots average toward grey; red, yellow and blue are a convention) are pinned presets, embedded in the matching articles and wiki nodes. Every mix step is named with `nameOf`, and one tap opens its page. | Articles, Color Graph, router | A `ROUTED` line plus `openRoute` case; an article embed component. |
| **[Cur] "Reach this painting with a limited palette."** The target is 5 colors from a real archive painting; reach them from a limited set (a Zorn-style earth palette, presented as "in the spirit of"). The lab shows which of the painting's colors fall outside that gamut. | Painter pages, Train (the Atelier station in `match.js`), Color Graph | Your own KM model; the gamut is the hull of 2-pigment mixes. Say plainly that paint is approximate. |
| **[Learn] Predict before you mix.** Every mix opens with a guess (the 50/50 result among 3 same-family neighbors). Misses are logged per hue pair. Train's "predict the mix" and Journey chapter 11 draw from your weakest pairs. | Learner Model, Journey, Train | Each mix guess is a `pick_wrong` or `recall_ok` event with `ref: "mix:a+b"`. |

### L15 · Data quality
> [Sci] "JOURNEY.md found Xanadu in stage 5. That's the order falling back to the alphabet. Give it a second signal."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Sci] A second usefulness signal for the stage order.** Combine the xkcd rank, the Ngram color-sense frequency (`cs__<word>_ADJ.json`), the number of naming sources and archive presence (≥ 5% of the canvas in ≥ N paintings). No more alphabetical fallback after word ~140. | Journey (order), Color Graph, Articles (tier and priority) | A `use` score in `tools/build_core_names.py`. Rerun `journey_coverage.py`. |
| **[Cur] Normalize each museum's camera.** Estimate each source's L*/C*/hue bias from overlapping artists × decades across sources, store the correction, and label findings "adjusted for museum photography". Until this lands, cut "seen most at museum X". | Painter pages, field notes, Explore findings | `analyze.py`: a per-source offset fit on the overlap set; report the residuals. |
| **[Learn] Solvability gates for everything learnable**: every name/look-alike pair must clear a *shown* ΔE floor (`accuracy.js shownDE`); no alias collisions; no two near-twins in one lesson; every game board solvable. They run in `check_names.js`, and failing pairs never reach a lesson or game. Also owns the alias table's content (section 2.3). | Journey, Train, Color Graph | An extension of `check_names.js`. |

### L16 · Explore 2.0
> [Teen] "Search 'stormy' and show me stormy. As colors, on the map, with names."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Learn] For you = the edge of your map.** Unmet colors one graph hop from your Yours colors (`lmEdge()`); paintings that hold two of your mix-up colors side by side; articles for colors you met but never read. | Learner Model, Color Graph, painter pages, Articles | Three queries, one shelf each. |
| **[Teen] Search returns a constellation.** Any query (a mood, a place like "Venice", a decade like "1880s", a painter, a flower, a poem word) resolves to a ColorSet, drawn on the honeycomb with named colors. Save it to the Cabinet or send it to Studio. | Color Graph, honeycomb, Cabinet, Studio | Graph node lookup → `toSet()` → `onMap()`. Moods map to poem lines and passages that use the word, never to invented mood claims. |
| **[Game] The painting of the day.** One archive painting, the same for everyone, shown for 3 seconds. Then name its 4 dominant colors from same-family options, and share the grid. The 4 colors join your "seen in the wild" review. | Painter pages, Learner Model, Journey, `challenge.js` (its share grid and seed) | The seed is `hash(today)` over paintings with 4 well-separated dominant clusters. The answers are taught words; label it "as photographed". |

### L17 · Crawlable pages
> [Teen] "If I google 'what color is puce', the page should be the cool one."

| Upgrade | Connects to | Build today |
|---|---|---|
| **Field notes as text on every static page**: the archive's first appearance, the most devoted painter (lift, n), the word's peak decade. That's content nobody else has. Each page's call to action is "Learn puce in 3 minutes" (`#/color/<slug>` → Learn it). | Articles, Color Graph, Journey | `pages.py` reads `color-*.json` and the graph. |
| **837 crawlable painter pages** (palette families, signature lines with sample sizes, the barcode), cross-linked with the color pages. | Painter pages, Color Graph | `pages.py` adds `painter/<slug>/`. |
| **One share-card renderer** for OG images, the stage exam card, the daily grid, Cabinet cards and palette exports. | Cabinet, Journey, Studio, Explore | `tools/pages.py` plus a client twin with one layout spec. |

### L18 · Honeycomb
> [Apple] "The honeycomb is the map. Every polish hour should make it a better map, not a prettier lattice."

| Upgrade | Connects to | Build today |
|---|---|---|
| **[Teen] Your map.** Shading from `lmStatus` (Yours lit, met outlined, unmet dim, mix-ups threaded). The stage control previews what lighting up the next stage looks like. | Learner Model, Journey stages, Color Graph | `honey.js` draw pass reads one status map. |
| **[Game] Constellation overlay.** Any set (a painting, painter, photo, poem or flower) can be laid over the map, its colors pulsing at their spots, sized by share. *On the map* is on every set page. | Painter pages, Studio, Explore, Cabinet | `onMap(set)`, a second draw layer. |
| **[Sci] Lenses that teach** instead of decorative styles: a **lightness slice** (hue × chroma at a chosen L*, fixing COLORNERD §6 item 7) and a **hue plane** (L* × C* for one hue). The hue plane is also the "color measured" figure in articles. | Articles, Train (value stations), Color Graph | Two layouts in `honey.js`. Cut Globe Fibonacci unless it encodes an axis. |

---

## 4. Ten signature moments (only this app can do them)

| # | Moment | What happens | Why only ColorHub | Built from |
|---|---|---|---|---|
| 1 | **Your photo's twin painting** | Take or pick a photo and get its named palette, then the nearest of 23,531 paintings by palette, its painter and its decade. "Color only, as photographed." | A named-color engine plus a measured archive | Studio, painter pages, Graph (L13, L11, ROADMAP §15) |
| 2 | **Words you didn't have** | "There are 3 colors in this photo you can't name yet." They become tomorrow's new words, and the photo is their world step. | Camera plus the Learner Model plus the composer | Camera, Learner, Journey (L9, L19) |
| 3 | **Your color DNA** | The painter whose signature colors best match the colors you name best, *and* the painter who lives in your weakest family ("your blind-spot painter"). Just for fun; it claims nothing about genes or talent. | The eye profile, the vocabulary and the archive in one place | Learner, Train, painter pages (L10, L11) |
| 4 | **The mix-up atlas** | All your confusion pairs drawn as threads on your map. Tap one for a 60-second duel set in a real painting where both colors sit side by side. | It logs what you *answered*, not only right or wrong | Learner, honeycomb, painter pages, Train (L18, L10) |
| 5 | **Word vs paint** | For any color, the word's color-sense curve (Ngram `_ADJ`) laid over the color's share of the archive by decade, with its first-recorded date. When did painters use it, and when did English name it? | Ngram plus Maerz & Paul plus 23k dated paintings | Graph, Articles, painter pages (L5, L6) |
| 6 | **Whose palette?** | Five colors: guess the painter. The archive's measured families make it fair, and a correct answer opens the painter. | 837 measured painter signatures | Train, painter pages, Cabinet (L10) |
| 7 | **Name it before the camera does** | The camera in guess-first mode: you say or type the name, then it reveals its reading. Counts as delayed, unassisted recall toward Yours. | Turns the camera into an honest memory test | Camera, Learner, Journey (L9, L19) |
| 8 | **Repaint a masterpiece with your words** | The painting shows in value only. You name its 5 main colors from memory, and it's repainted with your named hexes beside the real one, ΔE per region. | Names plus value plus the archive's color maps | Painter pages, Learner, Train (L11, L10) |
| 9 | **Masters' chords** | Harmony from what painters actually put together across 23k canvases, set beside the wheel's theory. "Here's what the wheel says, and here's what painters did." | Measured co-occurrence lift, honestly bounded | Graph, Studio, Articles (L13, L6) |
| 10 | **Learn any painting** | Any of 23,531 paintings becomes a 3-minute lesson about its own colors. The archive is the curriculum. | The composer plus the archive plus the Cabinet | Painter pages, Journey, Cabinet (L11, L9) |

---

## 5. The organizing idea and how navigation shows it

**One sentence:** *ColorHub is one map of all color, which you light up by learning to name and see it, and every painting, painter, flower, poem and photo is a constellation on that same map.*

**Navigation:**
- **Home is your map** (the honeycomb), shaded by what you know. You always start from, and come back to, the map.
- **The four rooms are verbs on the map:**
  - **Learn** lights it (the Journey).
  - **Train** sharpens it (the eye).
  - **Explore** shows the world's constellations (paintings, painters, decades, flowers, poems).
  - **Studio** makes your own (photos, palettes, mixes).
- **Every set page carries *On the map*;** every color page opens with a small locator showing where it sits on *your* map.
- **The Cabinet** is your collected constellations. *Your finds* and *Your photos* are drawers in it, not separate shelves.
- **Back unwinds toward the map** (ROADMAP §17's Pinterest Back, ending at the honeycomb).
- **Progress is visible as territory,** not as a number. "Yours · 64" stays the one honest count, and the map shows *where* those 64 are.

---

## 6. Connections matrix (the one best link in each cell)

Upper triangle; read row × column. "Painters" means painter, painting and movement pages.

| | Learner | Articles | Journey | Train | Explore | Studio | Painters | Cabinet | Camera |
|---|---|---|---|---|---|---|---|---|---|
| **Graph** | Your confusions reweight *confusable* edges | Fact cards emit edges | Look-alike edges choose contrast partners | Distractors come from confusable edges | Search resolves to nodes → sets | *Paired with* lift → Masters' chords | *Favored by* and *paints like* edges | Silhouettes: "unlocks with X" from edges | A hit shows its strongest edge ("seen most in…") |
| **Learner** | · | Mix-up card in both articles | Your pairs choose look-alikes and reviews | Boards built from your pairs and weak axis | For you = the edge of your map | Unnamed photo colors → tomorrow's words | Color DNA | Outline when met, solid when Yours | Guess-first camera = delayed recall |
| **Articles** | | · | Check cards become delayed story steps | "Tell it apart" section embeds a duel | Hubs = graph queries rendered | "Its company" → one-tap palette | Most devoted painter, both ways | Read + recalled → solid disc | Every article ends with a find-it mission |
| **Journey** | | | · | Lesson game = station at step size; station level sets difficulty | Anything you open can become a world step | Missions passable with your photos | Learn this painting | Lesson complete flies cards into drawers | Camera finds count as review |
| **Train** | | | | · | *Play this* on any Explore set | A board from your photo's palette | Whose palette? | "Seen before?" boards from Cabinet pieces | "Sample it": guess a spot's true color in your frame |
| **Explore** | | | | | · | One constellation overlay for both | Decades and movements as browsable sets | Cabinet = Explore's Saved, one shelf system | A find opens its nearest constellation |
| **Studio** | | | | | | · | Photo → twin painting and era | Your photos are a drawer | One capture pipeline: frame → set → named palette |
| **Painters** | | | | | | | · | A painter card unlocks when 5 of their signature colors are Yours | "Point at your room: whose palette is it?" |
| **Cabinet** | | | | | | | | · | *Your finds* drawer: dated, named, located on the map |

---

## 7. Cut or merge (surface that doesn't add seeing)

1. **Merge stories into articles.** One fact-card source, three renderings: the 2-slide card in a lesson, the story player and the full article. Stop writing stories separately.
2. **Drop the Read/Do tab split.** One scroll with the verbs inline (L8). The pill becomes a jump link.
3. **Merge Practice, Learn it, old units and review sessions into one composer** with focus sets (path, color, painting, palette, pair). Lessons stay one engine with many entry points.
4. **Merge the Cabinet, Explore's "Saved" and Studio's "Your photos"** into one collection system with drawers.
5. **Merge the taste profile, the eye profile and the vocabulary** into one *You* page (Color DNA lives there). Three profile screens become one.
6. **Cut decorative honeycomb styles** (Globe Fibonacci and friends) unless they encode an axis. L18's hours go to the lightness and hue-plane lenses.
7. **Cut "seen most at museum X" and country matches** until L15's camera normalization lands. Today they measure museum cameras and painter nationality, not color.
8. **Cut the film step from lessons.** Without stills there's nothing to *see*. Films stay as text and swatches in Explore and the Cabinet (this answers JOURNEY open question 5).
9. **Authored hub pages only where there's a story.** List hubs ("Crayola colors", "University colors") are graph queries rendered with one template, not writing jobs.
10. **One share-card renderer** (L17). No separate share designs per feature. Fold "Mint a card" into it; defer "Ask the color" chat.
11. **Raise the bar on painter findings.** Pairs need support ≥ 10 (today "3 of 37" ships as character). Signatures need the within-painting lens. Fewer, truer lines.

---

## 8. Honesty guardrails the panel insists on

- **The brown archive.** Show "as photographed" on every archive number, and default painter signatures and pair lift to the within-painting lens.
- **Words aren't colors.** Ngram curves use the `_ADJ` color sense. Ambiguous words (rose, orange, cream, salmon, amber) get a note, or no curve.
- **Close, never influenced.** "Your photo's palette is close to…", "paints like…" and "shares colors with…" are about color only. Teacher lines are Wikidata facts; palette closeness is measured. Never join the two as cause.
- **The camera guesses.** Camera finds count toward Yours only when *you* named the color first. A reading never teaches a name to the camera's credit.
- **Fun labels claim nothing.** "Color DNA" and "Your painter" are play. Their screens say what was measured ("from 20 taps and 41 named colors").
- **Solvability before fun.** No board, pair or "Whose palette?" round ships unless its rendered difference clears the gate.

---

## 9. Wiring order (so the lanes compound)

1. **L19 `js/learner.js`** (S): the event log, 5 readers and writers in the deck and quiz. *Everything else reads this.*
2. **Aliases + canonical slug** (S, L15 → L6), then rerun `analyze.py`.
3. **ColorSet verbs** (S–M): `toSet`, `onMap`, `learnSet`, `playSet` in `colorsets.js`.
4. **The relation mark** (S, L12) on chips everywhere.
5. **Within-painting lens + per-museum baseline** (M, L6/L15).
6. Then the lane upgrades above. Signature moments 2, 7 and 10 come almost free once 1 and 3 exist.
