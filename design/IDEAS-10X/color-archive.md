# Color pages and the archive: ideas 10× (area panel, 2026-10-08)

**Area:** the color pages (`colorPage` in js/explore.js, `namePage` in js/names.js, css/colorpage.css), naming (js/naming.js), and the archive behind them: the article engine (MASTER-PLAN §3, COLOR-PAGE-PLAN, ARTICLE-RESEARCH-FIRST), the Color Graph (L6), the 29-book concordance (index and stats only), `data/analysis`, the design-history corpus (L19), hubs, family trees and disambiguation.

**Builds on, doesn't repeat:** Genius Panel 1 (the Learner Model, ColorSet verbs, one identity per color, two lenses, "You and this color", the threshold line, the role bar, word vs paint, the mini-honeycomb family tree, the mix-up card). Those are assumed. Everything below is new or takes a round-1 idea a step further, and says so.

**Respects:** today's naming policy (English primary names; other languages are secondary and never the title; three layers: Learn about 1,000, Archive about 2,700, Search about 4,300; no 9,000), one tap opens a page, never "the 101", never one palette, no Read/Do tab split, no sheet between a color and its page, no dimming on the honeycomb, solid controls.

---

## 0. What I measured first (so the ideas stand on data)

These are quick passes, run read-only today. Archive distances used CIE76 for speed, so rerun them in ΔE00 before any number ships.

- **Two page engines.** `colorPage` serves the app's 101 deep colors. `namePage` serves the other ~900 core names. The ~1,700 remaining archive colors in `data/library.json` (2,716) only reach a page through `namePage`'s fallback entry.
- **The archive doesn't reach vivid colors.** Of the 1,000 core names, **112 have no pooled color within ΔE 10** anywhere among the 564,744 pool colors of the 23,531 paintings. Examples: Phlox, Magenta, Violet, Chartreuse, Lime, Heliotrope, Electric Blue, Bright Teal, Pure Blue. **140 core names never win nearest-name** for any pool color, including Green, Purple, Pink, Turquoise, Lavender and Emerald. Only one pool color comes within ΔE 6 of Scarlet.
- **Roles are skewed.**
  - `hid` (the "hidden colors") is mostly dark browns: Dark olive brown 4,555, Bistre 3,442, Café Noir 2,729, Ink 2,554.
  - `foc` (the focal color) is mostly yellows and buffs. Mustard Yellow is the focal color in 44% of the 338 paintings it appears in, Ochre Yellow in 35% of 699, Indian Yellow in 32% of 672.
  - `glu` (the glue mid-tone): Brownish Olive 1,487, Bister 1,147.
- **Books (concordance index only).**
  - 9,194 names are indexed across 29 books, and 4,778 have any hit.
  - Of the 1,000 core names, 610 have at least one strong hit, 245 have 20 or more and 75 have 100 or more. 390 have none (Baby Green, Burple, Dark Teal, Carolina Blue…).
  - Of the 2,716 library colors, 221 appear in 10 or more books and 1,567 appear in none.
  - **Word-sense noise:** "lead" 2,104, "dark" 1,230, "earth" 891, "stone" 507, "sky" 483, "wood" 310. A raw count would say the color books are obsessed with stone.
- **Names.**
  - There are 94 spelling-collision groups across core and library (Royal blue / Royal Blue, Teal / Tealish, Bistre / Bister).
  - First-word clusters: "Dusky" 23, "Pearl" 17, "Rose" 15 (Rose Madder, Rose Pompadour, Rose Taupe…), "French" 13.
  - Modifier children (Light / Dark / Pale X) are 205 of the 1,000 core names and 631 of the 2,716 library colors.
- **Rough origin tiers for the 2,716**, a heuristic on `src` plus the concordance's source tags:
  - modifier child 631
  - naturalist standard (Werner, Ridgway) 512
  - crowd (the xkcd survey) 469
  - other, meaning commercial, places and people, 377
  - other-language 226
  - industrial (RAL) 157
  - pigment, dye or mineral 155
  - ISCC-NBS descriptive 120
  - web standard (CSS) 69

  It misfiles some names (RAL's "Rose" lands in industrial), so a hand-override table is needed.
- **Naming-policy conflict, live today:** 226 library colors have Japanese primary names (Ebizome, Benifuji, Budōnezumi…). The new policy says they can never be the title.
- **Ngram:** 151 words have color-sense (`_ADJ`) curves, and there are 850 `n1800` series.
- **The design-history corpus (L19)** wasn't on main or findable in the worktrees when I wrote this. The ideas that use it say so.

---

## 1. Diagnosis: what's thin, boring, confusing or ugly today

1. **Two classes of citizen.** A color in the 101 gets a "Learn it" button, facets, Kin, Connections and Sources. A name page gets a hero, shelves and a list. A library color gets even less.
   - The seams show in the chip: "Library color", "Stage 3 of 9" and "New to you, from Unit 3" are internal words that mean nothing to a visitor.
   - `npFamilyHTML()` in js/names.js is defined and never called, so the "Part of the X family" link that the file's own header promises never renders.
2. **The first screen teaches nothing.** It's 100dvh of flat color, the name, the hex and a bobbing arrow. It's beautiful, but you scroll on faith. A first-time visitor learns the hex code before they learn a single thing about the color.
3. **Every page reads in the same order.** Paintings, poems, books, films, nature, gems and fashion, then Language, History, Kin, Nearest names and Codes, folded in identical `<details>`.
   - Mauve's best fact (the dye and the word's curve) and Bistre's best fact (it's the glue mid-tone in more than a thousand paintings) sit at the same depth as the hex codes.
   - Nothing on the page knows what's remarkable about *this* color.
4. **The archive goes silent exactly where it's most interesting.** Empty shelves collapse (`.gl-in:empty{display:none}`), so Magenta's page just has fewer things on it. David's "almost-empty page" complaint (C2) comes from us **hiding absence**. That the paintings never reach magenta is the single most interesting fact we could tell him.
5. **A round-1 promise would lie on today's data.** "Hidden colors… the greens in the skin" is the pitch. Today `hid` means the dark browns of varnish and shadow, so any "hidden" field note built on it now would mislead. Likewise "focal = yellow" is part painting and part aged varnish.
6. **Numbers without meaning.** "Very close · 3% different" and "12% of the canvas" don't say which way the difference goes, whether your eye could see it, or how unusual it is.
7. **Thin prose, chip soup.** Article prose has a median of about 950 characters. Connections render up to 14 chips × 7 lenses, each with an italic relation word: a tag cloud, not a map.
8. **No "you."** Name pages know nothing about your confusions, finds, Cabinet or camera.
9. **Codes are generic.** CMYK ("rough") is the default. LCH shows only for the paint profile. There's no OKLCH, contrast, color-blind view or Munsell, and C15 hasn't started.
10. **Identity leaks into pages.** Bistre and Bister, and Teal and Tealish, are separate pages with separate archive statistics.
11. **Share is a URL in a text field.** There's no picture, so nothing gets passed around.
12. **The concordance can't be shown as it stands.** Its counts mix the color sense with the word sense ("lead", "stone", "sky"). It needs a sense filter before even one number reaches a page.

---

## 2. North star

**Every one of the ~2,700 archive colors opens to a dossier that a curator, a color scientist and a lexicographer would all respect, and that a 16-year-old would screenshot.**
- **The first screen tells you three true things nobody else can tell you.** They're picked by surprise, come from three witnesses (the books, the paintings, the words people use), and each one is a door to its evidence.
- **The page is shaped by where the name came from.** A pigment reads like an epic, a crowd word like a field survey, a naturalist's name like a specimen label, a modifier like a section of its parent.
- **It locates the color three ways:**
  - in space, with a compass to the nearest named color in each direction and how crowded this corner of color is;
  - in time, from when the word, the pigment and the archive each first appear;
  - in you, from the Learner Model.
- **Absence is shown as data.** When 23,531 paintings never come close to a color, that gap is the headline, not a missing shelf.
- **Hubs, family trees, look-alikes and disambiguation are all one query engine and one template,** so the archive grows by adding edges, not pages.
- **Every page ends with a seeing task in the real world.**

---

## 3. David's article idea, pushed 10×

| David's piece (MASTER-PLAN §3) | Where it stands | The 10× version (idea numbers below) |
|---|---|---|
| Tiers by name origin | 8 tiers; only length changes per tier | The tier sets the page's *shape*: section order, which witness leads, the hero line and the verb. There are three new tiers: **naturalist** (Werner, Ridgway: 512 colors), **crowd** (xkcd: 469) and **modifier child** (631, folded into the parent). Other-language names become a section, never a tier title. Classified automatically, with overrides (#1). |
| Content every color can have | The field notes list | **Three witnesses:** every field note is a sentence attributed to the books, the paintings or the words, with visible confidence, and every number is tappable down to its evidence (#3, #11) |
| Hubs | 7 named hubs, hand-written | **Hubs as computed exhibitions:** a query, a layout on the hue plane, a walking order and one line on what the group teaches you to see. Eight hubs only this archive can make (#7) |
| Family trees | Parents / siblings / children / look-alikes | **Five kinds of kin**, drawn as a lineage from the material root (flower, mineral, insect, chemist) to today's web name (#10) |
| Proximity links | Nearest names list | **The Compass:** walk color space by name (lighter, darker, more vivid, greyer, and one step along the hue each way), plus how crowded this corner is (#5) |
| Disambiguation | "Sapphire vs Sapphire Blue" pages | **Tell-apart pages** that sort the swatches visually and end in a 30-second sort; **versus pages** for every confusable pair (#4, #6) |
| A template | Implied | **One engine, one section registry.** Each section declares its data need, its tier weights, its witness and its verb (#1) |
| Lengths per tier | Fixed word ranges | **Length follows evidence:** the word budget is a function of sourced facts and field-note surprise. The tier only sets the ceiling (#8) |

---

## 4. Ideas, ranked (★ = the five best)

### 1. ★ One engine, shaped by origin
- **What:** Replace `colorPage`, `namePage` and the library fallback with one `colorDossier(entry)`.
  - A section registry (`SECTIONS = [{id, need(entry), weight[tier], witness, render, verb}]`) decides what appears and in what order, from the color's **origin tier** plus a **surprise score** per section.
  - Tiers come from `src` plus the concordance source tags, with a small hand-override table (`data/graph/tiers.json`).
  - **Modifier children** (Light Teal) get a URL and an anchored section on their parent, never a page that looks like a real name.
  - **Japanese-named library entries** get an English title (their nearest English name plus a modifier, or an ISCC-NBS block name), with the Japanese name as "Also called", per today's policy.
- **Why 10×:** It ends the two classes of citizen at a stroke, and makes the 2,700 feel like one archive. Mauve opens on the dye and the curve, Bistre on its work in paintings, Burple on what the crowd meant. Each page leads with what's true and interesting about *that* color.
- **Connections:** Color Graph (the tier and kin edges come from it), articles (writers fill the registry's prose slots), Journey (the Learn-layer badge and "Learn it" for any Learn-layer name), L17 crawlable pages (one template).
- **Effort:** L. The engine is M, the tier data is S, and migrating the existing sections is M.
- **Honesty:** A misfiled tier would tell the wrong origin story. The default for anything unclassified is "Origin undocumented", said plainly. The tier shapes the layout, never the facts.

### 2. ★ The history band and "The Unpainted"
- **What:** Right under the hero, a thin band pairs this color with **the closest color any of the 23,531 paintings actually reaches** (ΔE00, the painting and its date).
  - **Common colors:** "In {n} paintings. Earliest in our archive: {year}."
  - **The 112+ the archive never reaches:** "No painting in our archive comes within ΔE 10. The closest: [crop], ΔE 21." The visible gap between the two swatches *is* the lesson.
  - A hub, **"The Unpainted,"** gathers these colors on the hue plane, with the archive's reach per century drawn as a shape. Synthetic dyes and screens live outside it, and the fact cards explain why (dated pigments and dyes, sourced).
- **Why 10×:** It turns the emptiest pages into the most memorable ones. It teaches gamut (what paint, varnish and photographs can and can't show) without ever using the word. Nobody else has 564,744 measured pool colors to make this claim from.
- **Connections:** Color Graph (`first_in_archive` and `archive_reach` edges), painter and painting pages (the band opens the painting with highlight-on-arrival), the Home map (an "archive reach" lens overlay), Studio and photos ("3 colors in your photo sit outside anything in the archive"), articles (the hub's prose).
- **Effort:** M. The precompute is S (buildable today, §8). The hub is M.
- **Honesty:** High risk, so the caveat is built in. These are photographs of aged, varnished paintings. Each painting is cut to 24 pool colors, so small vivid areas get averaged toward their neighbors. Museum holdings skew pre-1900. It never says "painters couldn't make this" unless a fact card says so with a date.

### 3. ★ Three witnesses, with confidence you can see
- **What:** Every color is testified to by three witnesses, shown as a small triad under the band:
  - **The books:** "Named in 21 of 29 color books; most in Garfield's *Mauve*." Bibliographic counts only, sense-filtered.
  - **The paintings:** presence, role and the peak decade, as photographed.
  - **The words:** the Ngram color-sense curve, the first-recorded date, and how many naming standards list it.

  Every factual sentence in the article carries a **confidence mark**: solid (two or more books agree), dotted (one source), split (books disagree, with both sides in the sentence). Colors where the witnesses disagree become finds and hubs:
  - "Famous in books, rare in paintings";
  - "Everywhere on canvas, unwritten": the workhorses, Bistre and Café Noir;
  - "A word with no history": crowd names with zero books.
- **Why 10×:** It's the only color encyclopedia that shows how sure it is, and why. The disagreements between witnesses are new knowledge, not filler.
- **Connections:** articles (the confidence marks come from fact-card `conf` and corroboration), Color Graph (each witness is an edge family), Explore (the "disagreement" hubs as shelves), Learner Model (a check card's answer must be a solid-confidence claim).
- **Effort:** M. The witness triad is S once the stats are exported. The confidence marks need L7's fact cards.
- **Honesty:**
  - Concordance counts include other word senses. Only "strong" matches ship, behind a deny-list of ambiguous words (lead, dark, earth, stone, sky, warm, wood, sea, leaf, international, artificial…). Ambiguous names show "the books: not countable (the word has other meanings)".
  - Never ship context text, only counts and titles.
  - Ngram uses `_ADJ` only (round-1 rule).

### 4. ★ Versus pages: `#/vs/teal+turquoise`
- **What:** A computed page for any two colors. It shows:
  - the two swatches split, plus the same pair in grey (value only);
  - ΔE00 against your eye threshold;
  - the direction words;
  - which one painters use, which the books discuss, which the crowd names more;
  - a painting where both appear side by side;
  - a 20-second duel.

  Disambiguation, the look-alike strip and the Compass all route here. The ~500 most confusable pairs (graph `confusable` edges plus the most-searched "X vs Y" pairs) get crawlable static copies.
- **Why 10×:** "Teal vs turquoise" is what people actually type into Google. It's the exact moment someone wants to *see* a difference, and it's the app's whole thesis on one screen: a name is a lens.
- **Connections:** Train (the duel is a gym-engine board), Learner Model (your mix-up pairs get a "Your pair" badge, and the delayed check counts), L17 SEO (static `vs/` pages), Color Graph (`look-alike` edges carry the direction words), painter pages (the side-by-side painting).
- **Effort:** M.
- **Honesty:** The pair painting has to be a real co-occurrence, with both colors at 2% or more of the canvas and ΔE ≤ 5. Screen-approximation note.

### 5. ★ The Compass, with a crowding line
- **What:** A small 2×3 grid on every page: **Lighter · Darker · More vivid · Greyer · Toward [green] · Toward [blue]**. Each cell holds the nearest named color in that direction, from all ~2,700, with its ΔE. One tap opens it (the morph), so you can **walk color space by name**.
  - Under the grid, a crowding line: "Crowded corner: 23 named colors within ΔE 5, more than 90% of colors" or "A lonely color: the nearest name is ΔE 9 away."
  - A direction with no name in reach says so: "No named color this way within ΔE 25." That's a gap in the vocabulary.
- **Why 10×:**
  - It turns proximity links into play: you can wander from Mauve to Heliotrope to Phlox and feel the axes.
  - It teaches the three dimensions of color without a diagram.
  - Crowding shows that English names some regions finely (blues, browns) and others barely, which is the case for learning more names.
- **Connections:** Home map (the same six moves become the honeycomb's step gestures), Train (the direction twist uses the same six words), Learner Model (your weakest axis gets a quiet underline: "watch the chroma"), Journey (crowded corners are late-stage words), Versus pages (a long-press on a cell opens the versus).
- **Effort:** S (buildable today, §8).
- **Honesty:** Directions are CIELAB axes, labeled as lightness, chroma and hue, never "brighter" (fix #5 in COLOR-PAGE-PLAN). Hue words come from `hueLean()`.

### 6. Tell-apart pages (disambiguation as a seeing lesson)
- **What:** For name clusters ("Rose ×15", "Pearl ×17", "Dusky ×23") and spelling collisions (94 groups), the page lays every swatch on a mini hue plane, each with its one distinguishing line ("Rose Madder: a pigment name; deeper and bluer"). It ends in a 30-second **sort** that puts them in order of lightness or hue.
  - Search hits on an ambiguous word land here: "Which rose did you mean?"
  - Spelling twins (Bistre / Bister) never get a tell-apart. They merge, with "also spelled".
- **Why 10×:** Wikipedia's disambiguation is a list. Ours is a lesson in fine distinctions that ends with you able to see them.
- **Connections:** Search (the 4,300-alias layer), Train (the Rearrange station on this board), Color Graph (`named after` and alias edges), Learner Model (cluster members you've confused are flagged).
- **Effort:** M.
- **Honesty:** Merges need a spelling match *and* ΔE < 1 (round-1 check). Clusters that are only lexical (French ×13) get grouped by origin, not presented as one family.

### 7. Hubs as computed exhibitions
- **What:** A hub is `{query, layout (hue plane / timeline / grid), walk order, one "what this teaches you to see" line, optional curator prose}`. The template is the same for all of them.
- **Eight hubs only this archive can make:**
  - **The Unpainted** (#2)
  - **The workhorses:** the archive's glue and shadow colors (Bistre, Café Noir, Brownish Olive) with the paintings they hold together
  - **Where the eye goes:** the colors most often focal (Mustard, Ochre and Indian Yellow), caveated
  - **Naturalists' colors:** Werner and Ridgway names, shown with their animal, plant and mineral anchors
  - **Words the crowd invented:** xkcd names with zero books (Burple, Barbie Pink)
  - **One pigment, many names:** Prussian blue / Berlin blue / konjō
  - **Names that died:** M&P 1930 names whose Ngram curve fell
  - **Wordless places:** the largest empty regions between the 2,700 names (#21)
- **Why 10×:** Each hub is a lens you can carry outside. "The workhorses" makes you notice the olive-brown holding a painting together. A hub is never a list for its own sake.
- **Connections:** Explore (hubs are shelves), Home map (each hub is a constellation via `onMap`), Cabinet (finish a hub's walk to unlock its card), Color Graph (each hub is one query).
- **Effort:** M for the engine; each hub is S.
- **Honesty:** Every hub shows its query in plain words ("Colors no painting in our archive comes within ΔE 10 of"), so a hub can't imply more than it measured.

### 8. Length follows evidence
- **What:** The article gate (`tools/article_gate.py`) sets each article's word budget from the evidence: roughly 60 words per corroborated fact card, plus 25 per high-surprise field note, capped by the tier's ceiling. The page shows "Built from 14 sourced facts and 6 measurements." A Crayola name with 2 facts gets ~150 words and stops, and that's honest, not thin.
- **Why 10×:** It makes David's "true depth, none padded" mechanical. It also tells the research queue where depth is missing: a pigment with 3 cards gets flagged for more research instead of being padded.
- **Connections:** articles (the gate), Color Graph (cards emit edges, and more edges mean more budget), Explore (the "deepest pages" shelf), Journey (story steps only from colors with 5 or more cards).
- **Effort:** S.
- **Honesty:** This is the guardrail against filler itself.

### 9. The myth trap
- **What:** For colors with a myth on the list (Isabelline, Indian yellow, Prussian blue "releases cyanide", arsenic and Napoleon, Perkin's puddle…), the article opens with a recall-before-reveal card: "You may have heard: ___. True or false?" You answer, then read the real story with its hedge.
  - The myth list moves from CLAUDE.md prose into `data/myths.json` (`{id, slugs[], claim, verdict, safe_phrasing}`), and the article gate reads the same file.
- **Why 10×:** Correcting a myth you *predicted* sticks far better than a footnote. One file now feeds the gate, the pages and the quizzes.
- **Connections:** Learner Model (a `checked` event), Journey (myth cards as story steps), articles (the gate's myth scan uses the same file), Explore (a "Myths about color" hub).
- **Effort:** S–M.
- **Honesty:** The card must not repeat the myth as if it were true. It states it as a rumor, then gives the verdict. The phrasing comes from CLAUDE.md's hedges word for word ("first aniline dye", "in the 1460s, when Byzantine purple ran out").

### 10. Five kinds of kin, drawn as a lineage
- **What:** It builds on round 1's mini-honeycomb by giving the edges *types and a direction in time*:
  - **material root** (mallow flower, lapis, cochineal insect, coal tar)
  - **named after** (person, place, thing)
  - **same pigment, other names** (other languages, as siblings, never titles)
  - **children** (modifiers, linked to their anchored sections)
  - **standard twins** (the CSS / X11, RAL and ISCC-NBS entries that sit within ΔE 2)

  It's drawn left to right as a short lineage: root → name → children → today's web twin.
- **Why 10×:** A family tree that tells a story ("from a Persian rock to a CSS keyword") instead of a cluster of dots.
- **Connections:** Color Graph (the edge types), articles (the lineage is the article's outline for pigment-tier pages), Studio (standard twins give a designer the exact CSS name), Cabinet (siblings unlock together).
- **Effort:** M.
- **Honesty:** Root edges come only from fact cards. With no card there's no root, and the lineage starts at the name.

### 11. Every number is a door
- **What:** Each number on a page is tappable down to its evidence: "In 338 paintings" → the 338, sorted by share; "focal in 44%" → those paintings, highlighted on arrival; "Named in 21 books" → the list of book titles and counts (no text); "ΔE 9 to the nearest name" → the versus page.
- **Why 10×:** It's how an archive earns trust. Every number opens onto more of the archive, so the page has no dead ends.
- **Connections:** painter and painting pages, Versus pages, Explore (the result lists are ColorSets, so `onMap` and `playSet` come free).
- **Effort:** S per number, using the existing gallery query code.
- **Honesty:** It exposes our own errors, which is the point.

### 12. Typecast: the job a color does in paintings
- **What:** It extends round 1's role bar with **personality versus peers**. "Mustard Yellow is cast as the focal color in 44% of its paintings, the highest of any named color seen in 200 or more." The leaderboards become hubs (#7).
  - **First, fix the data.** Recompute `hid` as *low chroma relative to the painting's own mean, at mid lightness*, which is the actual "greens in the skin" definition. Then `hid` stops meaning "darkest browns".
- **Why 10×:** The insight that context sets the role (the same ochre is the star in one canvas and the glue in another) is the seeing lesson.
- **Connections:** painting pages (the guided look's three stops use the same fields), Journey (`find-in-painting` steps choose paintings where the color plays its strongest role), Train (a "Where does the eye go?" station).
- **Effort:** M. The recompute is S in `tools/analyze.py`.
- **Honesty:** "Focal" is a chroma × contrast proxy with no pixel positions (the `index.json` caveats). Say "measured as the most vivid, most contrasting color", not "where the eye goes", until gaze or position data exists.

### 13. Name lag
- **What:** Measure the years between the color appearing in the archive and the word appearing in print (M&P 1930 first-use dates, Ngram onset). "Painters had this color on canvas long before English had this word for it" becomes a field note, and the extremes become a hub.
- **Why 10×:** It makes concrete that we see before we name, and that naming then sharpens seeing: the app's first conviction.
- **Connections:** Color Graph (`first_recorded` and `first_in_archive` edges), articles (a lead candidate for the surprise score), Home map (the vocabulary timeline, #15).
- **Effort:** M.
- **Honesty:** Archive presence is the nearest-name match on photographed paint, and M&P dates are OCR'd 1930 claims. Show both sources, and only show a lag above 50 years with n ≥ 20.

### 14. Reading roads
- **What:** There are 8–12 authored roads through the archive, such as:
  - **The blue road:** lapis → ultramarine → smalt → Prussian blue → cobalt → cerulean → synthetic ultramarine;
  - **The coal-tar road:** mauveine onward;
  - **The earth road:** ochres, siennas and umbers.

  Each stop is a color page with a "Next on this road" card at its foot. A road is a ColorSet, so it has a map overlay and a lesson.
- **Why 10×:** It turns 2,700 pages into stories you can binge, which is the Read side's own Journey.
- **Connections:** Journey (a road is a focus set for lessons), Learner Model (`read` events, and a road's progress shows on its card), Cabinet (finish a road to unlock its card), Home map (the road drawn as a path).
- **Effort:** M. The engine is S; each road needs about 6–10 written stops from fact cards.
- **Honesty:** Dates and order come only from cards, and disputed dates (synthetic vermilion, magenta) are hedged at the stop.

### 15. The vocabulary grows (a timeline on the map)
- **What:** A scrubber from 1300 to 2010 above the honeycomb. Each named color lights up in the year its word is first recorded (M&P, Ngram onset, standard dates), so you watch English learn to name color: the 1850s–1900s dye boom, the 20th-century crowd names.
- **Why 10×:** It's a beautiful, one-gesture history of color vocabulary that only a dated, named and mapped archive can draw.
- **Connections:** Home map (an overlay, never dimming: unlit names are simply absent, then they appear), Color Graph (`first_recorded`), articles (each lit name links to its page).
- **Effort:** M–L.
- **Honesty:** Dates exist for only a subset, so show "dated names: n of 2,700". The display honors X7: it never dims the honeycomb's true colors. It's a separate lens.

### 16. See it in context: light and surround
- **What:** Two quiet toggles on the hero:
  - **Light:** the swatch as seen under daylight, a tungsten bulb or candlelight (a chromatic-adaptation simulation).
  - **Surround:** the swatch on white, on black, on its complement and on its nearest look-alike (Albers' lesson, our own demo).
- **Why 10×:** It teaches that a color isn't a fixed hex: it shifts with the light and with what surrounds it. That also explains why candle-lit paintings were painted the way they were.
- **Connections:** Train (constancy and contrast stations), painter pages ("see this painting by candlelight"), Studio (palette context), Mix lab.
- **Effort:** S–M.
- **Honesty:** Label it a screen simulation (von Kries style), approximate. No claims about specific painters' lighting without cards.

### 17. Alias landings
- **What:** Each of the ~4,300 search aliases lands on its color's page with a one-line banner, for example: "Konjō-iro is the Japanese name for this color" (with the "In Japan" section opened), or "Berlin blue is another name for Prussian blue". This is the honest way to keep every other-language name findable without ever titling a page with it.
- **Why 10×:** Search never dead-ends, the policy is obeyed, and other-language names become a doorway rather than clutter.
- **Connections:** Search, Color Graph (`same pigment` and alias edges), articles (the "In other languages" sections).
- **Effort:** S.
- **Honesty:** A "same color" claim needs a card or a standard. Otherwise the banner says "close to (ΔE n)", not "is".

### 18. The find-it ending
- **What:** Every page ends with one concrete real-world task picked from the graph: "This week, find it on a ___" (a flower in the botany data, a gem, a brand from the L19 design-history corpus, a fashion decade). Then *Name it before the camera does* (round 1 #7). A successful find is a dated `found` event pinned to the color's page: "You found it 2× (Oct 9, Oct 12)."
- **Why 10×:** Each page ends with you looking at the real world, not at the next page.
- **Connections:** camera, Learner Model, Journey (finds count as review), Cabinet ("Your finds" drawer).
- **Effort:** S–M.
- **Honesty:** A find counts only when you named the color first (round 1 rule). Brand colors carry an "approximate on screen" note.

### 19. Crowd-name pages
- **What:** The 469 crowd-tier names (from the 2010 xkcd survey) get their own shape: what the word means to people, its spread (a swatch plus the range of colors the name covers, where the survey data allows), and how it sits against "proper" names. "Burple: what people call the purple-blue in-between when they have no better word."
  - It links to the Train boundary game: "When does it stop being burple?"
- **Why 10×:** It treats vernacular honestly instead of pretending every name is an heirloom, and makes the crowd a witness.
- **Connections:** Train (the boundary game), Compass (crowd names fill wordless gaps), Three witnesses (the crowd's word), Journey (crowd names that are real words reach the Learn layer).
- **Effort:** S–M.
- **Honesty:** No counts or spreads we don't actually have. The survey is a web survey, self-selected, mostly English speakers, and the page says so.

### 20. The specimen plate
- **What:** A share card in the lineage of Werner (1821) and Ridgway (1912): the swatch, the name, its lineage line, its three anchors (Werner's animal, plant and mineral where they exist, otherwise graph twins) and one archive crop. It also works as the OG image and the Cabinet card face (through the round-1 renderer).
- **Why 10×:** It's shareable and beautiful, and it says what this app is: a naturalist's catalogue of color.
- **Connections:** Cabinet, L17 OG images, Werner and botany data, the Learner Model (a "Yours since" foot line).
- **Effort:** M.
- **Honesty:** Werner's anchors are 1821 descriptions, dated as such. This is a card, not the app's signature object (the paint chip was rejected, and this one should go to David as a mockup first).

### 21. Wordless places
- **What:** Find the largest empty regions between the ~2,700 named colors (the biggest Lab-space spheres with no name inside), then show them as a hub and, on the Compass, as "No named color this way."
  - Your photos' colors that land in a wordless place get flagged: "You found a color English barely names."
- **Why 10×:** It turns the limits of vocabulary into a discovery game. It's the inverse of the archive, and nobody else can compute it.
- **Connections:** Studio and photos, camera, Home map (gaps as an overlay), Compass.
- **Effort:** S–M.
- **Honesty:** "Wordless" means "not in our 2,700". Say "in our archive of names", not "in English".

### 22. Passport stamps
- **What:** A row of dated stamps showing every naming system that lists this color: Werner 1821 · Ridgway 1912 · RAL (1927 on) · Maerz & Paul 1930 · ISCC-NBS 1955 · X11 / CSS · the xkcd survey 2010 · Japanese traditional (secondary). Add the tier line ("A pigment name", "A naturalist's name", "A crowd word") and the books count. Each stamp opens a list hub of that system.
- **Why 10×:** In one glance you see a color's age and pedigree: Bistre has an old passport, Burple a single stamp.
- **Connections:** Color Graph (`standardized by` edges), hubs (#7), Three witnesses (stamps are the words witness), Explore (system hubs as shelves).
- **Effort:** S (buildable today, §8).
- **Honesty:** Use system dates only, not first-use claims. The X11 date is given as "1980s".

### 23. A page that reads your interests
- **What:** Within each tier's order, sections tilt toward the Journey's interest strands (art, nature, science, fashion, design). The same Mauve page leads with the dye chemistry for a science person and with the Impressionist paintings for an art person.
- **Why 10×:** It's one archive with many doors. Depth stays one tap away either way.
- **Connections:** Learner Model (interests), Journey (strands), articles (the section registry's weights).
- **Effort:** S once #1 exists.
- **Honesty:** It reorders, never hides. Every section stays in the table of contents.

### 24. Institution pages from the design-history corpus (L19)
- **What:** The places, institutions and brands tier (UN blue, Yale blue, Tiffany-style blues as "the robin's-egg blue associated with…", Delft) gets a "spec and story" shape: who chose the shade and when, the official spec source, where you meet it, and its ΔE to the nearest historic name.
- **Why 10×:** It connects old color history to the colors people see every day, and the find-it ending (#18) gets real targets.
- **Connections:** Studio (exact specs for designers), find-it (#18), Compass, Three witnesses.
- **Effort:** M, depending on L19 (not yet on main).
- **Honesty:** Trademark colors are referenced, never sold. All specs are screen approximations. No origin legend without a card.

### 25. The etymology chain chip
- **What:** One line under the title tracing the word's route, for example: Latin *malva* → French *mauve* → English, with its first-recorded date. Each link is a node (the flower, the language) you can open.
- **Why 10×:** You learn the word's history in five seconds. Children of the root (mallow → mauve, malva) become kin.
- **Connections:** Color Graph (`named after`), articles (the etymology facet), the Kin lineage (#10).
- **Effort:** M (mostly data, from cards and Paterson notes).
- **Honesty:** Run it through `research/FACTCHECK-ETYMOLOGY` rules. Folk etymologies only appear as myths to correct (garance/guarantee).

---

## 5. Kill list (surface that doesn't add seeing)

1. **The `colorPage` / `namePage` split.** Merge into one engine (#1).
2. **Status-chip jargon:** "Library color", "Stage 3 of 9", "New to you, from Unit 3". Replace with the tier line ("A pigment name") plus your status.
3. **Dead code:** `npFamilyHTML()` in js/names.js is defined and never called. Wire it into Kin (#10) or delete it.
4. **"The full page for X is being written."** A placeholder that promises instead of showing. Replace it with the three witnesses, which every color has.
5. **The Connections chip soup** (up to 14 chips × 7 lenses). It splits into Kin (#10), the Compass (#5) and hub stamps (#22).
6. **The "Nearest names" list with "% different".** The Compass covers it (and says which way), and the versus pages explain any one pair.
7. **CMYK as a default code.** Keep HEX, RGB, HSL and OKLCH (plus Lab and contrast for designers). Show CMYK only for a print profile, labeled rough.
8. **The label "hidden colors"** for today's `hid`, until it's recomputed (#12).
9. **Pages for modifier children** (631 in the library). They become anchored sections of their parent.
10. **Pages for generated shades.** The policy says no 9,000; "A described shade" pages go.
11. **Separate story writing.** Stories are a rendering of fact cards (round 1, restated because the article engine is where it bites).
12. **Hand-written list hubs** ("Crayola colors", "University colors"). They're queries (#7); only story hubs get prose.

---

## 6. The 60-second wow

**Tap Magenta, or any vivid color, from the Home map.**
- The hero fills the screen. Under it is the history band: magenta beside the closest color any of 23,531 paintings ever reached, far apart (the quick CIE76 pass put Magenta about 48 from anything pooled), with the painting's title and year. One line: "No painting in our archive comes close."
- Tap the band, and the painting opens with that region lit.
- Back on the page, the Compass offers its Greyer and Darker neighbors (whatever the real computation picks). Two taps, and you're walking toward the colors the old masters did reach.
- The visitor has just learned what a gamut is, that photographed paintings are muted, and that names carve up space, all without being told.

**Tap Bistre instead,** and the band shows a color the archive is full of (Bistre is the nearest name for pool colors in 8,360 paintings, before the Bister merge), and the typecast line reads "the glue that holds paintings together." Every color has a first screen that only this archive could write.

---

## 7. How these fit together (one paragraph for the conductor)

The engine (#1) is the frame. The band (#2), the witnesses (#3), the Compass (#5) and the stamps (#22) are the **always-present summary** that every one of the 2,700 can fill from data alone, so no page is ever empty, even before a word of prose exists. The articles (L7) slot into the registry with length set by evidence (#8). Versus (#4), Tell-apart (#6), hubs (#7) and roads (#14) are **the same query engine rendered four ways**. The Learner Model shows on the page as your pair badges, your weak-axis underline, your finds and your read roads. One identity per color (round 1, §2.3) must land before #2 and #3 count anything, or Bistre and Bister will split their witnesses.

---

## 8. Buildable today (each under 4 hours)

### A. The Compass (#5): walk color space by name
- **Files:**
  - js/naming.js (allowed to touch the library through `loadLongNames()` under check.js's naming gate): add `compassFor(hex, selfName)`;
  - js/names.js: add `compassHTML(hex, name)` and its wiring;
  - js/explore.js `colorPage` and js/names.js `namePage`: one line each, placed after the strip or the shade line;
  - css/colorpage.css: `.cp-compass`.
- **Data:** `LONG_NAMES` (2,716, Lab precomputed by `loadLongNames()`), deduplicated by lowercased name, with `crude` names already excluded.
- **Logic:** For each candidate, compute ΔL, ΔC and ΔH* = 2√(C₁C₂)·sin(Δh/2) in CIELAB LCh.
  - **Lighter:** ΔL ≥ 4, and both |ΔC| and |ΔH*| ≤ 0.5·ΔL + 4.
  - **Darker:** the mirror of Lighter.
  - **More vivid / Greyer:** ΔC ≥ +5 or ≤ −5 respectively, and both |ΔL| and |ΔH*| ≤ 0.6·|ΔC| + 3.
  - **Toward hue, each way:** ΔH* ≥ 5 on that side, and both |ΔL| and |ΔC| ≤ 0.6·|ΔH*| + 3.
  - In each direction, pick the lowest ΔE00 under 25. Label the hue cells "Toward " + `hueLean(candidate hue)`, minus the "-ish" ("Toward green").
  - Skip near-grey hue cells (C < 8).
- **Render:**
  - A 2×3 grid of solid cells (opaque, DS principle 2). Each cell has the swatch, the direction word as the eyebrow, the name in serif, and "ΔE 6".
  - An empty direction reads "No named color this way" in a quiet cell.
  - Header: "Walk from here". No "% different" anywhere.
- **Crowding line:** Count names within ΔE00 5 of this color (2,716 comparisons, about 10 ms) and compare with a precomputed quantile table: 5 numbers, from `tools/archive_reach.py` in B, or hard-coded from one offline run. Output either "A crowded corner: 23 names within ΔE 5" or "A lonely color: the nearest name is ΔE 9 away."
- **Interaction:** A tap does `morphFrom(cell swatch)` then `openCoreName(h, n)` (the existing one-tap rule; Back returns). The grid renders after `loadLongNames()` resolves, with the space reserved meanwhile so nothing jumps.
- **Checks:** check.js (naming gate), check_names.js, check_wiki.js, smoke. Screenshots at 375×812 of Mauve (a full grid), Magenta (empty "more vivid"), Ink (a near-grey, hue cells skipped) and a tapped in-between color.

### B. The history band (#2): the closest the archive comes
- **Files:**
  - `tools/archive_reach.py` (new), which writes `data/analysis/reach.json`;
  - `loadReach()` in js/names.js, lazy, and never read at load time (the loader.js rule);
  - `reachBandHTML(entry)` in js/names.js, called from both page functions right under the primary row;
  - css/colorpage.css: `.cp-band`.
- **Precompute:**
  - Decode every gallery shard's 24-color pool (the last field, 4 bytes per color: r, g, b, share/250) and the years from `data/gallery/index.bin` (as `glBuild` does: `year − year0`, with 0 meaning undated).
  - For each of the 2,716 library colors plus the 1,000 core names (deduplicated by name), store `{d: min ΔE00 to any pool color with share ≥ 0.02, g: gallery index of that painting, p: pool position, n6: number of paintings with a pool color within ΔE00 6 at share ≥ 0.02, y0: the earliest dated one of those, k5: names within ΔE00 5}`.
  - Use a numpy CIE76 prefilter with a radius of 20, then exact ΔE00 on the survivors.
  - Keyed by lowercased name, the file is about 120 KB, deterministic and committed.
- **Render:**
  - A 56px band of two solid blocks: this color, then the archive's nearest color.
  - **n6 ≥ 20:** "In {n6} paintings · earliest {y0}".
  - **d > 10:** "No painting in our archive comes within ΔE 10 · closest ΔE {d}", plus a fine line: "Photographs of varnished paintings; small vivid areas average toward their neighbors."
  - Otherwise: "{n6} paintings come close".
- **Interaction:** Tapping the archive half opens `galleryPage(g, true, hex)` (the existing highlight-on-arrival). Tapping the count opens the existing in-paintings rail, scrolled into view.
- **Checks:** Same gates. Screenshots at 375×812 of Magenta, Bistre, Mauve and a tapped in-between color. Spot-check 5 values by hand against `npGalleryHits`.

### C. Passport stamps and the tier line (#22, plus the seed of #1)
- **Files:**
  - js/naming.js: `originTier(entry)` and `STAMPS`;
  - js/names.js: `passportHTML(entry)`, rendered in both pages under the band;
  - css/colorpage.css: `.cp-stamps`;
  - data/graph/tiers.json: a small override map that starts with the obvious misfiles (RAL "Rose" → nature).
- **Data:** Core-names `src` and library `src`, which the naming gate allows `originTier` to read inside naming.js.
- **Stamps:** `werner` "Werner · 1821", `ridgway` "Ridgway · 1912", `ral` "RAL · from 1927", `iscc-nbs` "ISCC-NBS · 1955", `css` "Web color · CSS/X11", `xkcd` "Crowd survey · 2010", `jp` "Japanese traditional", `wiki` "Wikipedia list". The M&P 1930 stamp appears when the M&P merge (M9) lands.
- **Tier line,** by first match:
  - pigment (the `pigment` src, or a pigment wiki node) → "A pigment name";
  - Werner or Ridgway → "A naturalist's name";
  - `jp` only → an English title plus "Also called {jp}" (fixes the 226 policy conflicts at the display level until L15 renames them in data);
  - RAL → "An industrial standard";
  - CSS → "A web standard";
  - xkcd → "A crowd word";
  - a modifier pattern → "A described variation of {parent}", with a link to the parent;
  - otherwise "Origin undocumented".
- **Interaction:** Stamps are solid pills. A tap opens a list of every color carrying that stamp, as a generic list screen at `#/hub/src/<key>` (one `ROUTED` line plus an `openRoute` case in router.js, as a small additive edit). Each row taps straight to its page.
- **Leave out today:** the books count. It needs a sense-filtered export from the concordance stats, done as its own step (#3) with the deny-list, never with context text.
- **Checks:** Same gates. Screenshots at 375×812 of a five-stamp color (Red), a one-stamp crowd word (Burple), a Japanese-named library color showing its English title, and one hub list.
