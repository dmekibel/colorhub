# The color page and its article: design spec (2026-10-08)

**Status:** design round, for David's review. L5 (computed page sections) and L8 (article reader, hubs, Versus) build from this file. The mockups are in `design/colorpage-mockups.html` (23 phones, real data). Screenshots are in `design/colorpage-shots/f01.png … f23.png`. Every count, ΔE and neighbor in them was recomputed on main after the L15 data merge (984 core names, 1,789 library cards, 23,781 paintings), with the scripts' rules written out below so L5 can reproduce them.

**Builds on:** DESIGN-SYSTEM.md (tokens, type, motion, archetypes), MASTER-PLAN §1–3, GENIUS-PANEL-1 (L5/L8 rows), IDEAS-10X/color-archive.md (#1 one engine, #2 the band and the Unpainted, #3 three witnesses, #4 Versus, #5 the Compass, #7 hubs, #9 the myth trap, #10 kin, #11 numbers are doors, #17 alias landings, #22 stamps). Where this spec differs from those, this spec wins for the page's UI, and the reason is given.

**David's ask (2026-10-08):** a real page for every one of the ~2,700 archive colors; articles with statistics and information; the long articles easy to reach; and niche colors with no article connected to the near-identical color that has one. Functional, beautiful, convenient.

---

## 0. The design in five sentences

1. **The color is the cover.** The tapped bubble still grows into a full-bleed color, but the cover now carries the name, where the name comes from (the tier line), a sourced one-sentence definition, and the hex, and the bottom 88 px shows the most surprising facts peeking up.
2. **The article is a book you open from the page,** never a tab: its contents are the door, it reads on warm black with the color as a ribbon that fills as you read, and its notes open in a sheet.
3. **Field notes are five drawers,** each one line of finding, each opening in place, with the verb (play, mix, duel, map) sitting next to the fact it acts on.
4. **Walking color space by name is the core pleasure:** a Compass of six named neighbors, shaped like the honeycomb, reachable by holding the color itself; a trail you can jump back through; Back that unwinds to the map.
5. **A niche color borrows depth honestly:** "Its story lives with Prussian blue · 96% match", with the twin's real opening lines, an exact "how they differ" box, and one tap into the twin's book, which remembers where you came from.

---

## 1. One engine for every color

Replace `colorPage` (js/explore.js) and `namePage` (js/names.js) with **one page function, `colorDossier(entry, opts)`**, for all ~2,700 names (core 1,000 plus library) and any tapped hex.

- `entry`: `{n, h, src[], rank?, tier, also?, notes?}` resolved by the existing `npEntryFor()` / `openCoreName()`.
- `opts`: `{tapped: hex|null, from: {kind, id, title}|null, walk: {hub, i}|null}`. `from` records where a tap came from ("The Great Wave", a photo, a lesson) for the relation line and the trail.
- **Sections come from a registry** (L5 owns it; L8 registers its sections into it):
  ```js
  DOSSIER = [{ id, need(entry, data) -> bool, order(entry, data) -> number, render(entry, data) -> html, wire(el, entry, data) }]
  ```
  `need()` false means the section is not drawn at all: no empty headings, no "being written" placeholders (DESIGN-SYSTEM §10, empty states).
- **Routes stay** (`#/color/<slug>` for the old 101, `#/name/<slug>` for the rest, `?c=<hex>` for a tapped color) and both call `colorDossier`. New routes: `#/read/<slug>[/<chapter>][?from=<slug>]`, `#/vs/<a>+<b>`, `#/hub/<id>`, each one `ROUTED` line plus an `openRoute` case in router.js.
- **Never** show "the 101", "Library color", "Stage 3 of 9" or "New to you, from Unit 3" (Ideas kill list #2). The tier line and the relation line replace them.

---

## 2. Anatomy, top to bottom

### 2.1 The cover (frames 01, 12, 14, 15, 17, 20)

| Element | Spec |
|---|---|
| Hero | Full-bleed swatch, height `calc(100svh − 88px)`, min 520 px. This is where the signature grow lands (DESIGN-SYSTEM §8), unchanged. |
| Floating controls | Level-2 ‹ (top-left) and ⋯ (top-right), 44 px, at `safe-top + 8`. Opaque, with their own 1 px border, so they never depend on the color. The bobbing scroll arrow is removed: the peek replaces it. |
| Foot stack | Bottom-left, gutter 20, bottom 20, in this order: relation line, name, tier line, definition, definition source, hex. All text in `ink(hex)` at full opacity. |
| Relation line | `note` 18. From the Learner Model (`lmStatus`, `lmSeen`), one of: "New to you" · "Met in 2 paintings" · "Learning · seen twice" · "Yours since 3 Oct" · tapped: "Your color · 97% match" · tapped with a source: "Your color, from The Great Wave · 97% match". |
| Name | `hero` serif. **Fit rule:** 96 px if it fits one line in `100vw − 40`; else the largest of 80 / 72 / 64 that fits in two lines (`text-wrap: balance`); 56 px minimum (three lines, only for names like "International Orange (Golden Gate Bridge)", where the parenthetical drops to the tier line). Measure with a canvas `measureText` once per page. |
| Tier line | Italic serif 19. Two halves: the **origin tier** (underlined; tap opens that tier's hub) and **the most specific dated fact** we hold. Vocabulary in §2.1.1. |
| Definition | Serif 20/1.3, one sentence, at most ~95 characters. Sources, in order: the article's `def` (sourced) → ISCC-NBS block descriptor ("Vivid red, ISCC-NBS 1955") → Werner's 1821 anchor ("Werner: the beauty spot on a mallard drake's wing") → a **differential definition** computed from the nearest named neighbor, Webster's-Third style ("A deep night blue, a touch purpler than Prussian blue"). |
| Definition source | Italic serif 14.5, full ink: "From its story · 11 sources" / "ISCC-NBS 1955" / "Werner, 1821" / "Measured", plus a merged alias when one exists ("Measured · RAL calls it Pearl Night Blue"). Tap opens Sources. |
| Hex | `code`, underlined, tap copies (toast "Copied #CC3336"). For a tapped color, the ΔE to the name follows it ("#407497  ΔE 2.6"). |
| Tapped color extra | Under the definition: a 56 × 40 chip of the name's own color with "Dull Blue itself, beside your color" (frame 14). The hero is your color, so the chip *is* the comparison. |
| The peek | The glance strip's first two cards, top 88 px visible: witness glyph + word, then the big figure. The figures are the hook to scroll. |

**Ink failure rule:** if the better of paper-ink and white is under 4.5:1 on the hero (rare mid-tones), the definition and its source drop out of the hero to the ground directly under it; the name and tier line stay (large text needs only 3:1).

#### 2.1.1 Tier-line vocabulary
| Origin tier (from `src` + graph + `data/graph/tiers.json` overrides) | First half | Second half, example |
|---|---|---|
| pigment / mineral | A pigment name | from the madder root · Berlin, about 1706 |
| dye | A dye name | after a battle, June 1859 |
| naturalist (Werner, Ridgway) | A naturalist's name | Ridgway, 1912 |
| color dictionary (Maerz & Paul) | A dictionary name | Maerz & Paul, 1930 |
| nature-named | Named after a flower / a bird / a stone | the mallow |
| place or institution | Named after a place / an institution | Yale, 1890s |
| person | Named after a person | General Skobelev |
| traditional system (Japanese etc.) | A traditional Japanese color | the title is English; "Also called Konjō-iro" goes in the family |
| web / industrial / descriptive standard | A web standard · An industrial standard · A descriptive standard | CSS · RAL 5026 · ISCC-NBS 1955 |
| commercial | A brand name | Crayola, 1990 |
| crowd (xkcd) | A crowd word | from the 2010 color survey |
| modifier child | A described shade | teal, lighter |
| unknown | Origin undocumented | (nothing) |

A dated second half needs a source (card, standard date or M&P). Without one, the tier line is the first half alone. When a name carries several stamps, the tier is the first match in this order: pigment, dye, naturalist, nature / place / person (needs a card), traditional, dictionary, descriptive standard, industrial, web, commercial, crowd, modifier. So Marine (M&P 1930, ISCC-NBS, RAL, crowd survey) is "A dictionary name · Maerz & Paul, 1930".

### 2.2 The color header (frames 02–05, 13, 16, 18, 19)
When the hero scrolls away, a **104 px color header** stays pinned: the color full-bleed, the floating ‹ and ⋯, and the name in serif 25 after ‹ (left-aligned, never centered). You always see which color you're on. Tap the name: scroll back to the cover. Swipe down on it: the page shrinks back into its source (DESIGN-SYSTEM §8). When `contrast(hex, --ground) < 1.6` (Prussian blue, Marine), the header and the hero get a 1 px `rgba(255,255,255,.1)` bottom hairline.

### 2.3 The glance strip (frames 02, 16, 18, 19)
- A horizontal rail of 2–4 cards, 256 × ≥188 px, `--surface-2`, `--r-2`, 10 px gaps, gutter-inset, scroll-snapped; the next card always peeks.
- **Card anatomy:** witness glyph + word (`note` 14.5: "the books", "the paintings", "the words", "measured", "where you found it") and a confidence dot (solid: two or more sources agree; ring: one source; split: sources disagree); the **figure** (serif 40: "1868", "6 in 10", "73 of 188", "ΔE 18", "1 stamp"); one sentence (serif 17/1.3). A card with evidence behind it has a › in its corner and opens that evidence (the paintings list, the source, the Versus page): every number is a door (Ideas #11).
- **Selection (L5, `glanceFor(entry)`):** candidates are the article's `glance[]` (writer-supplied, sourced) plus computed hooks, each scored for surprise:
  - Unpainted (`reach.d > 10`): score 100, always first, rendered as the band card (two swatches: this color | the closest painted color, then "ΔE 18").
  - Matches older than the pigment's dated invention (≥ 20% of matches): 90 ("73 of 188").
  - A myth on `data/myths.json` for this slug: 85, rendered as the myth card (§3.6), answered on the card.
  - Role extreme: one role ≥ 55% of matches with n ≥ 20 ("6 in 10 … accent"): 70.
  - Percentile ≥ 95 or ≤ 5 in lightness or chroma among named colors: 60.
  - Pair lift ≥ 3 with support ≥ 10, excluding partners within ΔE 10 of this color (they are the same color named differently): 55.
  - Article glance items: their own score (writer marks 1–3 → 50/65/80).
  - Tapped from a source with a fact card ("Hokusai's sky is Prussian blue mixed with white"): 95, as "where you found it".
- Take the top 4, at most two from one witness, with no two adjacent cards from the same witness when an alternative exists. **Fewer than 2 candidates: the strip isn't drawn** and the definition carries the first screen alone.

### 2.4 The primary row
- **One paper button per page** (DESIGN-SYSTEM §1.4). The rule, in order:
  1. **Learn it · 2 min** if the name is in the Learn layer (~1,000) and not Yours ("Review it" if Yours and due).
  2. Otherwise **Begin reading · 14 min** inside the story door (§2.5), or **Read its story** inside the story-home card (§2.6), if there is one.
  3. Otherwise none.
- Save and Share live in ⋯ (with Copy hex, On the map, Compare with…, Report a problem). No icon buttons crowd the primary.

### 2.5 The story door: a color with its own article (frames 02, 16)
A `--surface-2` card after the glance strip:
- `note` "The story", then the article title in `title-2` with its italic turn ("The red *at the root*"), the dek in serif 18, and a meta `note`: "14 min · 6 chapters · 11 sources".
- **The chapters are the door:** the first three as rows (`code` number, title in serif 20, minutes as a `note`), then a `+` row naming the rest. Tapping a chapter opens the book at that chapter.
- Then **Begin reading · 14 min** (paper if §2.4 makes it the primary; otherwise a quiet row with the same words).
- **Resume state:** once started, the chapter rows are replaced by a 4 px progress bar in the color's accent (§3.2) and a quiet row "Continue · chapter 2 · 9 min left".
- Articles under 600 words get no door: their text renders inline as the page's lead (serif 20) with numbered notes, and their sources join the page's sources.

### 2.6 The story home: a color without an article (frames 13, 19)
Shown where the story door would be. Full spec in §5.

### 2.7 You and this color (frames 05, 16)
A `--surface-2` card titled `title-3` "You and this color", drawn **only if the Learner Model has at least one line**. Up to three rows, each a 26 px mark (a painting crop, a color dot, the camera glyph), one serif 17 sentence, and its verb as a text link:
- "You've met it in 2 paintings you opened: Odalisque and The Bewitched Mill." (`lmSeen`)
- "You've answered *navy* for it twice." → *Duel the two · 20 s* (`lmPairs`; the duel is a gym-engine odd-one-out on the pair, 5 trials)
- "Found twice with the camera, 9 and 12 Oct." (`found` events)
- The **find-it task** closes the card when nothing personal exists yet for that row: "Find it this week in an old carpet's reds. Name it before the camera does." → *Open the camera* (guess-first mode). Targets come from graph twins (flowers, gems, fashion, brands), never invented.

Placement: after the story door or story home for a returning learner (`lmStatus` ≠ unmet); at the end of the page (§2.11) for a stranger.

### 2.8 Field notes (frame 03)
`title-2` "Field notes", with the `note` "measured, as photographed" on the right. **At most five drawers**, each a row: name (serif 22) and **one headline finding** (serif 16.5, soft), with a › . The finding is the drawer's highest-scoring sentence, never a count of what's inside. One tap opens the drawer in place (accordion, `--dur-2`); only one is open at a time.

| Drawer | Headline example | Inside, in order | Verb at the end |
|---|---|---|---|
| In paintings | "194 paintings, from about 1000 to the 1930s. Mostly a small, vivid accent." | century bars (in the color); the **role bar** (accent / shadow / mid / light, within-painting lens); the paintings where it covers most (rail of 104 px crops, share badge in `code`); the most devoted painter only if n ≥ 10; the caveat line | *Play a board of these* (`playSet`) |
| Its company | "Set beside pale fawns far more than chance: pale vinaceous-fawn 5.3×" | pairs with lift and n (support ≥ 10, partners within ΔE 10 excluded); colors it's never seen with | *Make a palette from these* (Studio) |
| In words | "An old paint name, kept by ISCC-NBS in 1955" | Ngram `_ADJ` curve (only for unambiguous words); first-recorded date and source; poem lines and passages (≤ 15 words each, attributed); books count once the sense filter exists | *Read the poems* |
| In the world | "Its twins: a garnet, a tulip, a 1950s lipstick" | flowers, gems, minerals, fashion decades, films, brands (screen-approximate) | *Find it* (camera) |
| Measured | "Darker than 65% of named colors, more vivid than 88%" | codes (HEX, RGB, HSL, OKLCH, Lab; CMYK only behind "for print, rough"); percentiles; contrast on white and black with AA/AAA; three color-blind views; complement per wheel; a mixing recipe; standard twins within ΔE 2 | *Copy*, *Mix it* |

Every archive number says "as photographed" once per drawer, in the caveat line: "Museum photographs of aged, varnished paintings. A color match, not a pigment test." A drawer with no data isn't drawn. The Unpainted variant of In paintings is §6.4.

### 2.9 Walk from here: the Compass (frame 04)
- `title-2` "Walk from here", `note` "Six neighbors by name. Hold the color at the top to walk without scrolling."
- **The flower:** seven flat-top hexes (122 × 106, 6 px gaps), this color at the center with its name and hex. The six neighbors sit by axis, opposite directions opposite each other:
  - N **Lighter**, S **Darker**;
  - NE **More vivid**, SW **Duller**;
  - NW and SE: the two hue moves, labeled with lookDiff's fixed vocabulary (redder, yellower, greener, bluer, purpler; never a color name).
- Each hex: the neighbor's color, its direction (`note` 13), its name (serif 16.5, ≤ 2 lines) and "ΔE 2.6" (`code`). Tap: it grows into its page (shape memory: a hex grows from a hex). Long-press: the Versus page.
- **Choosing neighbors (L5, `compassFor(hex, self)`):** the Ideas doc's §8A rules over all ~2,700 names, in ΔE00, with three changes:
  1. Skip candidates under ΔE 2: they are twins (§2.10), not directions. **A name fills one hex only:** assign greedily by lowest ΔE across all six cells, so a name that qualifies twice (Vermilion is both lighter and yellower than Madder Lake) takes its closest cell and the other cell takes its next candidate (Blood Orange).
  2. Skip Japanese-primary names (they're "Also called" doors, not titles).
  3. Hue cells need C ≥ 8; for near-greys the two hue hexes become "No hue to turn" (quiet, `--surface-2`).
- **Empty direction:** a quiet hex, "No named color this way". At the sRGB edge (any channel at 0 or 255 and the color is the most chromatic in its hue), More vivid reads "Screens can't show more vivid".
- **Crowding line** under the flower (serif 17, ink): "A crowded corner: 9 named colors within ΔE 5." or "A lonely color: the nearest name is ΔE 9 away."
- At 320 px the flower scales to fit (hex 104 × 90); names drop to serif 15.

### 2.10 Family and look-alikes (frames 04, 05)
- `title-3` "Family": a **lineage**, not a chip cloud (Ideas #10): the material root (a 32 px material glyph, its name, one line, from fact cards only), then this color (ringed), then, indented under a 1 px rule, its children and same-material siblings with one line each ("a lighter, pinker lake of the root"; "its dye, from coal tar since 1868"). Other-language names appear here as "Also called Konjō-iro (Japanese)". Without a root card the lineage starts at the name.
- **"Look-alikes that live here"** (on a page with an article): pill chips of the colors within ΔE 6 whose story home is this page ("Fire Engine Red 97%", "Dull Red 96%"). This is the reverse of §5: correlation works both ways.
- **"Near twins"** (on a page without an article): the names within ΔE 6, also chips, labeled by §5.2 ("Near twins, also crowd words: Purplish Blue 97%, Purpleish Blue 97%", frame 19).
- **Merged aliases** (L15's near-duplicates, `altn` with "near-duplicate") are never chips or pages of their own: they show as "also called" in the family (Madder Lake: "also called Persian Red"; Marine: "RAL calls it Pearl Night Blue").
- Spelling twins (Bistre/Bister) never show as twins: they merge (GENIUS-PANEL §2.3) and show "Also spelled Bister" in the family.

### 2.11 Sources, stamps and the last line (frame 05)
- `title-3` "Sources and stamps": the **passport stamps** (solid pills, system plus date in `code`: "ISCC-NBS 1955", "Ridgway 1912", "RAL from 1927", "Crowd survey 2010", "Web color CSS/X11"; each opens its system's hub), then the numbered sources (the article's, matching its note numbers), then a quiet row "All 11 sources".
- **The last line** (`small`): "Built from 23 sourced facts and 9 measurements. Screen colors are approximate." For a page with no facts: "Built from 7 measurements. No sourced facts yet." (Ideas #8, said plainly.)

### 2.12 Order by case
| # | (a) Color with an article: Madder Lake | (b) Niche color: Marine | (c) Tapped hex: #407497 → Dull Blue |
|---|---|---|---|
| 1 | Cover | Cover (differential definition) | Cover: your color, "from The Great Wave · 97% match", the name's chip |
| 2 | Glance strip | Glance strip | Glance strip: card 1 is "where you found it" |
| 3 | Primary (Learn it), if any | Primary (Learn it), if any | Primary (Learn it), if any |
| 4 | Story door | Story home: "Its story lives with Prussian blue" | Story home of the *name* (Dull Blue → its twin), plus the source's own story link |
| 5 | You and this color (returning) | You and this color (returning) | You and this color, plus *Save your color* |
| 6 | Field notes | Field notes | Field notes (the name's archive; Measured is your exact color) |
| 7 | Walk from here | Walk from here (from your exact color) | Walk from here (from your exact color) |
| 8 | Family, look-alikes that live here | Family, practically the same | Family |
| 9 | You and this color (stranger: find-it only) | same | same |
| 10 | Sources and stamps, last line | Stamps (M&P 1930, ISCC-NBS 1955, RAL, crowd 2010), last line | Stamps of the name, last line |

**Which name a tapped color opens:** the nearest of the ~2,700 by ΔE00, except that a Learn-layer name within +1.0 ΔE of the nearest wins (common words win near-ties). "Exact" (no "Your color" view) only under `VERY_CLOSE_DE`, as today.

---

## 3. The reading mode (L8; frames 06–09)

### 3.1 Entering and leaving
- From the story door's chapter row or Begin reading, or the story-home card's Read its story: **the card grows into the book** (signature motion, rect shape memory, `--grow`). The color header's color becomes the ribbon as the card's top edge rises.
- Back, ‹, swipe down from the top edge, or the system back gesture: the book **shrinks back into the card** it came from, and the page keeps its scroll position. Reading position is saved per article.
- Route `#/read/<slug>/<chapter>`; reading from a twin adds `?from=<slug>`. A shared link opens the book directly, with ‹ going to its color page.

### 3.2 The page of the book
- **Ground:** warm black (DESIGN-SYSTEM §1.5, read on black). A Paper option (`--paper` ground, paper-ink text) lives in the Aa sheet for daylight reading.
- **The ribbon:** 3 px, full-bleed, directly under the status bar. The track is `--rule`; the fill is reading progress through the whole article, in `accentOn(hex, ground)`: the color itself if its contrast against the ground is ≥ 3:1, else the color mixed toward white in OKLab until it reaches 3:1 (toward black on Paper). The color is never used as text color.
- **Header** (52 px, ground): ‹, the article's short title in italic serif 17 (soft), then Aa and the contents icon (44 px each). It hides on scroll down after 24 px and returns on any upward scroll or a tap at the top. The ribbon never hides.
- **Chapter opening:** `code` "2 / 6" and a `note` "3 min", then the chapter title in `title-1`, then the body.
- **Body:** Geist 17/1.62 at the default size (a new `body-read` token; DESIGN-SYSTEM `body` stays 16/1.55 elsewhere), gutter 24, about 45 characters a line, paragraphs 16 px apart, 2–4 sentences each.
- **Color words:** a 9 px dot of the color plus an underline; tap opens the color page on top of the book (Back returns to the same line).
- **Note tabs:** numbers in mono 11 on a small `--surface-2` tab (2 × 3 px padding, radius 4), raised 6 px, with a 32 px invisible hit area. Never bare superscripts. A tapped tab turns paper while its sheet is open.
- **Figures:** full-bleed images, caption in `small` 13 with the title in italic serif. An archive painting's caption states the measurement and the caveat ("A red within ΔE 6 of madder lake covers 6% of it: a color match, not a pigment test.").

### 3.3 Blocks inside the text
| Block | Look | Rule |
|---|---|---|
| Books disagree | `--surface-2` card, split dot + "Books disagree" (`note`), then both sides in one sentence | From fact cards with `conflict`; CLAUDE.md hedges word for word where they apply |
| Myth trap | `--surface-2` card: "You may have heard" (`note`), the claim in serif 19, two quiet pills **True / False**; after the tap, the right pill gets the `--good` ring and the verdict follows with its note tab | Recall before reveal. From `data/myths.json`; the claim is phrased as a rumor; the verdict uses the safe phrasing |
| Verb line | A text link at the end of the paragraph it belongs to: *See it in The Great Wave*, *Mix it*, *Duel teal and petrol* | At most one per paragraph; it opens the tool on top of the book and returns to the same line |
| Field-note embed | A one-line computed fact in a `--surface-2` strip with its witness glyph | Lets the writer cite the archive (`{t:"fieldnote", key}`) without copying numbers into prose |
| Pull figure | A full-bleed swatch band of the colors named in the paragraph | Only when a paragraph names three or more colors |

### 3.4 The note sheet (frame 08)
A modal sheet at content height (≤ 60%), so the sentence it supports stays visible above it. Top: "Note 4" (serif `title-3` with the number in `code`) and "of 11". Then the supported claim in italic serif 17 (≤ 15 words of our own prose, never a book quote), a hairline, the source's title in italic serif 21, author · publisher, year as a `note`, the confidence in words ("Two sources agree. Also *Madder Red*, Robert Chenciner, 2000."), and text links "‹ Note 3 · All sources · Note 5 ›". Swiping sideways steps through the notes; swiping down closes. The text behind never moves.

### 3.5 The contents sheet (frame 09)
The contents icon, or a pull-down at a chapter's top, raises a sheet (≤ 80%): the title in `title-2`, "The red at the root · 10 min left", then one row per chapter with its state (a filled dot of the accent when read, a ring for the current one, a quiet dot otherwise) and its minutes, then three fixed rows: **Check yourself** (3 questions), **Field notes** (jumps to the page's drawers, on top of the book), **Sources**.

### 3.6 The end of a story
- **Check yourself:** 2–3 recall questions from the article's `checks[]` (each answer is a fact card's claim; GENIUS-PANEL L7). One at a time, typed or chosen from same-family options, answer revealed after the attempt. Logged as `checked`. The same questions come back 1–7 days later as a Journey story step.
- Then a card for the **next on this road** if the color is on a reading road ("Next on the blue road: Cobalt"), then **Back to Madder Lake** as the one paper button.

### 3.7 The Aa sheet
Text size (three steps: 16, 17, 19), Night or Paper, and "Reduce motion follows your system". Stored per device (`localStorage` key inside `colorhub-v1`, via `migrateState`).

### 3.8 Reading from a twin (frame 07)
Where the header sits, a solid context pill: the source color's dot, "From **Marine**, its near twin". Tap it, or ‹: the book shrinks back into Marine's story-home card. The ribbon uses the article color's accent. At the end, the paper button reads "Back to Marine".

---

## 4. Moving between colors (frames 10, 11)

### 4.1 The system
| Gesture | Where | Result |
|---|---|---|
| Tap | any colored thing | grows into its page (unchanged) |
| **Press and hold 350 ms** | the cover | **the Compass flower rises under your thumb** |
| Tap / long-press a Compass hex | the page's Compass | grows into that page / opens Versus |
| Swipe down | cover or color header | shrinks back into its source (unchanged) |
| ‹ or edge swipe | anywhere | down exactly one layer (unchanged) |
| **Long-press ‹** | anywhere | **the trail** |
| Tap the color header's name | page | back to the cover |
| Horizontal swipe | glance strip, rails only | scrolls them |

**Hold to walk (frame 10).** After 350 ms of a still press on the cover (8 ms tick), the page dims to 34%, and the flower (the same geometry as §2.9) rises centered on the press point, clamped inside the gutters, its six hexes appearing 30 ms apart from the center. Dragging highlights the hex under the finger (a 6 px white ring, scale 1.12, a 4 ms tick on each change), and its direction, name and "ΔE 2.6 · 97% match" rise large at the top (`title-1`). Let go on a hex: it grows into its page. Let go at the center or outside: the flower sinks and the page undims (`--shrink`). Reduce Motion: the flower fades in.

**The trail (frame 11).** A long press on ‹ opens a level-2 popover under it (≤ 312 px wide, ≤ 7 rows): every place in this walk, newest first, each with its swatch or crop and how you arrived there: "you're here · walked more vivid", "from the painting's story", "where your color was", "tapped · near Dull Blue", and at the foot "The map · where you started". Tapping a row closes everything above it with one shrink. The data is `XSTACK` with a `via` field added to each entry (the Compass direction, "twin", "story", "tapped", "chip"); entries are kept in `sessionStorage` so a reload keeps the walk.

**Back to the map.** When Back reaches the honeycomb, the map pans to the first color of the walk and draws the walk as a thin ink thread from bubble to bubble (700 ms, then it fades after 3 s or at the first touch). Hook: `hmDrawWalk(slugs)` in js/honey.js (L18 owns it; the page only hands it the list).

### 4.2 Why this system
- **Walking by direction teaches.** Each step names its axis (lighter, duller, bluer), so wandering is a lesson in the three dimensions of color, with no diagram (Ideas #5).
- **No horizontal swipe between neighbors.** Neighbors aren't a line: there's no "next color", and a carousel would have to pick one axis and hide the other two. The left edge belongs to iOS Back, and a sideways pager would turn a long scrolling page into a deck. Sideways swipes stay inside rails.
- **The hold uses the honeycomb's own shape.** The flower is seven bubbles of the floor, so walking from a page feels like walking on the map.
- **The trail is the iOS long-press-Back pattern,** so it's familiar and costs no screen space; plain Back stays strictly one layer.
- **The map thread closes the loop:** you return to the floor and see where you went.

---

## 5. Correlation: how a niche color borrows depth (frames 13, 19)

### 5.1 Choosing the story home (`storyHome(entry)`, L8)
Candidates, first match wins:
1. **Same pigment, another name** (graph edge with a card or a standard): this isn't a story card. The page is an **alias landing**: a solid banner on the cover ("Konjō-iro: its Japanese name", frame 15), and the search alias lands on the main page.
2. **Modifier child** (Light Teal): its parent, labeled "A described shade of teal".
3. **Near twins with an article:** colors within ΔE00 10 that have an article of 150 words or more. Score = `sqrt(words) × (1 − ΔE/10)`, and the highest wins. For Marine: Prussian blue (an epic of ~2,400 words at ΔE 4.2) scores 28, Yale blue (an institution page of ~600 words at ΔE 2.6) scores 18, Navy (~250 words at ΔE 3.9) scores 10. Depth outweighs a point of match, which is David's ask; a log weight would have picked Yale blue. A second candidate scoring at least 60% of the first shows as a quiet row ("Also close, with a story: Yale Blue · 97%").
4. **Family head** (`familyOf`) when nothing is within ΔE 10: "Part of the blues", with the family's lede.

### 5.2 The words
The label is set by ΔE00 alone, never by list membership:
| ΔE00 | Label |
|---|---|
| < 1.0 | Identical on screen |
| 1.0–2.5 | Almost identical |
| 2.5–6 | A near twin |
| 6–10 | Its nearest story |

It's always followed by `pctMatch()`: "A near twin · 96% match" (Marine to Prussian blue, ΔE 4.2). The title is "Its story lives with *Prussian blue*". Never "closest of the 101", never a list name.

### 5.3 The card
- **Full card**, when the twin's article has 600 words or more (frame 13): a 72 px split swatch, this color | the twin (tap: the Versus page); the label; the title in `title-2`; **the twin's real lede** (its first 1–2 sentences, serif 18, unedited); the **How they differ** box (`--surface-3`); the paper button "Read its story · 14 min" (or a quiet row, if Learn it is the primary).
- **Compact card**, for a shorter story (frame 19): a 56 px split swatch, the label, the title in `title-3`, the difference sentence, and a text link "Read violet's story".
- **How they differ** is always two sentences:
  1. The look: `lookDiff(twin → this)` plus "at the same depth" when |ΔL| < 2: "Marine is purpler and more vivid, at the same depth."
  2. What is and isn't shared, from the tier pair: "It names a look, in a 1930 dictionary and a 2010 survey; Prussian blue is a pigment with three centuries of history. The story is Prussian blue's, shown here because the two look alike." Templates per tier pair live in `js/article.js` (`TWIN_KIND[tierA][tierB]`), and a crowd word gets "It's the crowd's word for the in-between, not a name with a history."
- **Honesty rules:** the twin's facts are never restated as this color's. The definition stays this color's own. Archive numbers on this page are this color's own (Marine: 142 paintings), never the twin's.

### 5.4 Both directions
The twin's page lists the colors whose story home it is ("Look-alikes that live here", §2.10). Search results for a niche name show its twin's story as a second line ("Marine · story with Prussian blue").

---

## 6. States

| State | Design |
|---|---|
| **Loading** (frame 20) | Hero, name, tier line and hex draw instantly from local data. The definition (two lines) and the glance cards hold their exact layout as pulsing blocks (`.55↔1` over 1.6 s). On a light hero the blocks are `rgba(20,19,17,.09)`, not `--surface-2`. Text "Reading the archive…" appears only after 600 ms. The story door waits for `data/articles/<slug>.json` with its own skeleton. Nothing jumps: every async section reserves its height. |
| **Missing article** | No door, no placeholder. The story home (§5) takes its slot; with no candidate at all, the slot is simply absent. |
| **Error / offline** | A section whose data failed shows one `small` line where it would be ("The paintings didn't load. Try again"), with the retry as a text link. The cover never fails. |
| **Thin data** (frame 19) | Only sections with data render. The glance strip needs 2 cards; the field notes show only drawers with data; the last line says what the page was built from. The page may be two screens long, and that's correct. |
| **The Unpainted** (frames 17, 18) | The band card is glance card 1: this color beside the closest painted color, "ΔE 18", "No painting in our archive of 23,781 comes within ΔE 10. The closest is a painting of a many-armed figure from about 1900." The In paintings drawer shows the three closest paintings with their ΔE, the caveat line, and a row into the hub "The Unpainted · 39 colors". **Closest is searched within ±25° of hue** (for C > 20), because CIEDE2000 is built for small differences: by raw ΔE00, magenta's nearest pool color is a grey (ΔE 14.9). |
| **Very dark** (frames 12, 15) | L* < 12, or contrast against the ground < 1.6: a 1 px light hairline at the hero's and the header's bottom edge; Compass center and chips get a 1 px inner hairline; the reading accent is lightened (§3.2). White ink. |
| **Very light** (frame 20) | Paper-ink text, status bar and home indicator follow `ink()`, and the floating controls stay dark and solid. No hairline needed (the edge against black is strong). |
| **Mid-tone ink failure** | §2.1 ink rule: the definition drops below the hero. |
| **Long names** | The fit rule (§2.1); the color header ellipsizes after one line. |
| **320 px** | Gutter 16; hero name max 80; glance cards 236 wide; Compass hexes 104 × 90. |
| **Reduce Motion** | Every grow and shrink is a 150 ms cross-fade; the hold flower fades in; the ribbon still fills. |

---

## 7. Motion and gestures (within DESIGN-SYSTEM §8)
| Moment | Token | What moves |
|---|---|---|
| Arrive on a page | `--grow` | the signature (unchanged), then the foot stack rises 12 px and fades in (`--dur-1`, from p = .55), then the peek rises 24 px (`--dur-2`) |
| Hero → color header | scroll-linked | the header fades in over the last 60 px of the hero; no other parallax |
| Drawer open / close | `--dur-2` | height and opacity; the chevron turns 90° |
| Story door → book | `--grow` | the card's rect grows to full screen; the ribbon draws in left to right as the card's top passes the status bar |
| Book → page | `--shrink` | the reverse, into the same card |
| Note / contents sheet | `--dur-2` spring | rises over a solid scrim; the tapped tab turns paper (`--dur-0`) |
| Hold to walk | `--dur-2` | hexes stagger out 30 ms apart; the hot hex scales to 1.12 (`--dur-0`) |
| Trail | `--dur-1` | the popover fades and drops 8 px from ‹ |
| Myth answer | `--dur-1` | the ring, then the verdict fades in under it |
| Glance card → evidence | `--grow` | the card's rect grows into the list or sheet |

Haptics: 8 ms when the hold engages, 4 ms per hex crossed, 8 ms when a page settles, 12 ms on a right myth answer, 10·40·10 on a wrong one.

---

## 8. The hub page (frame 21)
- **Route** `#/hub/<id>`. **Data** `data/hubs/<id>.json`: `{id, title, query (plain words), layout: "hueplane" | "timeline" | "grid", members: [slug], order, teaches, prose?, sources?}`. Most hubs are generated by a query in `tools/graph_build.py`; story hubs add prose.
- **Anatomy:**
  - Floating ‹.
  - **The figure is the hero** (360 px): for "hueplane", hue around the circle and chroma outward, the archive's reach drawn as a soft shape (99.5th-percentile chroma per 10° of hue, pooled colors with ≥ 2% share) and the members as dots (the current or tapped one ringed). A one-line axis note sits under it.
  - Title in `title-1`.
  - The query as a `note` ("Color words no painting in our archive comes within ΔE 10 of"), so a hub can never claim more than it measured.
  - One `lead` sentence of what it teaches.
  - The paper button **Walk all 39 · one by one**.
  - Rows (32 px swatch, name, the hub's measure in `code`); each grows into its page.
- **Walk mode:** `?walk=<hub>&i=<n>` adds a solid walk bar at the page's foot (56 px pill, `--surface-2`, inside the gutters, above the home indicator): "3 of 39 · Next: Violet" with the next color's dot. Tap: the next page grows from the bar's dot. The walk is a ColorSet, so *On the map* and *Learn these* come free (GENIUS-PANEL §2.2).
- The first hubs: The Unpainted (39 of the 984 core words by this method on today's main; L6 reruns it), One pigment, many names, The workhorses, Naturalists' colors, Words the crowd invented, Names that died (Ideas #7).

## 9. The Versus page (frames 22, 23)
- **Route** `#/vs/<a>+<b>` (slugs in alphabetical order, so each pair has one address). It's reached from a twin's split swatch, a long-press on a Compass hex, ⋯ → Compare with…, search ("teal vs turquoise") and crawlable static copies for the top ~500 pairs (L17).
- **Top (frame 22):**
  - **Split hero** (410 px): two halves, each name in serif 46 at its bottom-left in its own ink. Each half opens its page.
  - A 30 px **value band** under it: the same pair as L*-matched greys.
  - `note` "Value only, above: the lightness gap is most of it." (computed: shown only when ΔL is more than half of ΔE76; otherwise "…the hue is most of it" or "…the vividness is most of it").
  - Title in `title-1` with the italic turn: "Teal *vs* turquoise".
  - **The answer** in `lead`: both directions of `lookDiff` in one sentence ("Turquoise is much lighter and more vivid. Teal is the deep one, and a touch bluer.").
  - **The measured truth** in an ink `note`, by ΔE00:
    - < 2: "A hair apart: most eyes need them side by side."
    - 2–5: "Close: a trained eye sees it."
    - 5–10: "Clear side by side."
    - > 10: "Easy for any eye." Plus, when the names are a known confusion: "People mix up the words, not the colors."
    - With an eye threshold from Train, it says yours: "Your blue-green threshold is 2.2, so you can see this."
  - **The primary:** for ΔE ≤ 10, **Tell them apart · 20 s** (a gym-engine duel on the pair); for ΔE > 10 with three or more named colors between them, **Find the line · 30 s** (a boundary game on the ladder).
- **Evidence (frame 23):**
  - **The ladder:** the named colors at five equal CIELAB steps between the two, consecutive duplicates removed, as a 36 px-row stack, each row tappable. ("Between them, five named colors": Dark Cyan, Sea, Light Sea Green, Topaz, Medium Turquoise.)
  - **Origins** side by side: a real image and two lines each.
  - **Both in one painting:** a co-occurrence with both colors at ≥ 2% share within ΔE 5. If there's none, the closest pair within ΔE 10, with the threshold stated ("each within ΔE 10"). If still none: "No painting in our archive holds both."
  - The witnesses per side (paintings counts, stamps, books when countable).
  - **Your pair** from the Learner Model, if any ("You've mixed these up 3 times").

---

## 10. Data the page reads (contract)

**The article JSON.** L7's `data/articles/SCHEMA.md` wasn't on main when this was written. The reader needs these fields; if L7's schema names them differently, L8 maps them in one adapter (`artFromJSON`):
```js
{ slug, color: "<name>", hex, tier, title, titleTurn: "at the root", dek,
  def: { text, src },                       // the cover's definition and its source label
  words, minutes,
  chapters: [{ id, title, minutes, blocks: [
    { t: "p", text },                       // [[slug|label]] links, {n:4} note tabs
    { t: "fig", img, caption, credit, gi? },// gi = gallery index for archive figures
    { t: "disagree", text },
    { t: "myth", id },                      // → data/myths.json
    { t: "verb", kind: "painting|mix|duel|map|camera", arg, label },
    { t: "fieldnote", key }                 // a computed fact, rendered live
  ] }],
  notes: [{ n, claim, src, page?, conf: "solid|one|split" }],
  sources: [{ title, author, year, publisher?, url? }],
  glance: [{ fig, text, witness: "books|paintings|words|measured", conf, score: 1|2|3, door? }],
  checks: [{ q, a, options?, card }],
  built: { facts, measures } }
```

**Computed data (L5 / L6):**
- `data/analysis/reach.json`: per name `{d, g, p, n6, y0, k5}`, from `tools/archive_reach.py` (Ideas §8B), with the hue gate of §6.
- Roles and pair lifts per name: `data/analysis/color-*.json`, with partners within ΔE 10 excluded.
- `data/graph/tiers.json`: tier overrides.
- `data/myths.json`.
- Graph edges: same pigment, named after, modifier parent, standard twins.

**The Learner Model:** `lmStatus`, `lmPairs`, `lmSeen` (js/learner.js, L19). Until it lands, read `S.cards` and draw no You rows.

**Events written by the page and the reader:**
- `read` (`{c, ref: article, ch, pct}`, on each chapter finished and on leaving the book);
- `checked` (from Check yourself);
- `seen` (a color page opened from a painting);
- `found` (from the camera ending).

---

## 11. Copy rules for this page
- Never "the 101", "Library color", "Stage n of 9", "closest of the 101", "brighter" (use lighter or more vivid), "hidden colors" (until `hid` is recomputed), or "being written".
- Matches always come from `pctMatch()`. Differences always use lookDiff's words. ΔE always appears as "ΔE" plus a number in `code`.
- Archive numbers say "as photographed" once per drawer, and "a color match, not a pigment test" wherever a painting is tied to a pigment.
- A myth is stated as a rumor ("You may have heard…") and corrected with CLAUDE.md's safe phrasing.
- Article prose in the mockups is draft copy for layout. L7 writes the real text from fact cards.

---

## 12. Build checklist

### L5: computed page sections (owns js/names.js → `colorDossier`, the cover, glance, drawers, Compass, the hold gesture, You, stamps, the trail)
- [ ] `colorDossier(entry, opts)` and the `DOSSIER` registry; `colorPage` and `namePage` become thin wrappers; routes unchanged; `?c=` still works.
- [ ] The cover: hero `calc(100svh − 88px)`; the foot stack; the name fit rule; the relation line from the Learner Model with an `S.cards` fallback; remove `.cp-scroll-hint`.
- [ ] `originTier(entry)` and the tier-line vocabulary (§2.1.1); `data/graph/tiers.json` with the obvious overrides; tap → the tier hub.
- [ ] `definitionFor(entry)` with its four-step fallback, including the differential definition from the nearest neighbor; the ink failure rule.
- [ ] The color header (104 px, scroll-linked) and the dark-color hairline rule.
- [ ] `glanceFor(entry)`: the scoring of §2.3, card rendering, evidence doors, the 2-card minimum.
- [ ] `tools/archive_reach.py` → `data/analysis/reach.json`, with the ±25° hue gate for the closest-painted search; `loadReach()` lazy (never at load time).
- [ ] The five field-note drawers with headline findings, the role bar (within-painting lens), pair lifts excluding partners within ΔE 10, the caveat line, and a verb per drawer.
- [ ] `compassFor(hex, self)` over all names in ΔE00 (skip < 2, skip Japanese-primary names, one hex per name by greedy lowest ΔE, C ≥ 8 for hue cells, the empty-direction and sRGB-edge copy); parenthetical qualifiers ("Carmine (M&P)") drop to the page, the hex shows "Carmine"; the flower render; the crowding line.
- [ ] Hold to walk on the cover (350 ms, the drag highlight, release to open, center to cancel, haptics, Reduce Motion fade).
- [ ] Look-alikes that live here / Near twins (chips; merged aliases shown as "also called", never as chips).
- [ ] You and this color (only lines that exist; the duel; the find-it ending).
- [ ] Stamps, sources and the built-from line.
- [ ] The trail: `via` on XSTACK entries, sessionStorage, the long-press-‹ popover; hand the walk to `hmDrawWalk()` if it exists.
- [ ] States: loading skeletons on light and dark heroes, the error line, thin pages, very dark and very light, 320 px.
- [ ] Gates: check.js, check_wiki.js, check_names.js, tools/smoke.sh; screenshots at 375 × 812 and 375 × 667 of Madder Lake (library), Prussian Blue (Learn layer, dark), Marine, Magenta, Burple, Eggshell, a tapped hex, and a near-grey (Compass without hue cells).

### L8: article reader, story home, family, hubs, Versus (owns js/article.js, css/article.css)
- [ ] `artFromJSON()` adapter to L7's schema; lazy fetch of `data/articles/<slug>.json`; prefetch when a page with a door is opened.
- [ ] The story door (§2.5) with chapter rows, its resume state, and the inline short-article rule (< 600 words); registered into `DOSSIER`.
- [ ] `storyHome(entry)` (§5.1) with alias landings, modifier parents, the twin score and the family fallback; the label table; full and compact cards; `TWIN_KIND` difference templates; the reverse list on the twin's page.
- [ ] The reading mode: the grow/shrink from the card; the ribbon with `accentOn()`; the hiding header; `body-read` type; color words; note tabs; figures with measured captions.
- [ ] Blocks: books disagree, the myth trap (`data/myths.json`, recall before reveal), verb lines, field-note embeds, pull figures.
- [ ] The note sheet (sideways stepping), the contents sheet (states, the three fixed rows), the Aa sheet (size, Night or Paper), resume.
- [ ] Check yourself (`checked` events; questions scheduled as Journey story steps), next on the road, "Back to …".
- [ ] Reading from a twin: the context pill, `?from=`, back to the source card.
- [ ] Routes: `#/read/<slug>[/<chapter>]`, `#/hub/<id>`, `#/vs/<a>+<b>` (a `ROUTED` line plus an `openRoute` case each).
- [ ] The family lineage (§2.10) from graph edges, with "Also called" for other-language names.
- [ ] The hub template (the hue plane figure, the query line, Walk all with the walk bar, rows) and the first hub, The Unpainted.
- [ ] The Versus page: split hero, value band and its computed note, the answer, the measured line (with the Train threshold when known), duel vs boundary primary, the ladder, origins, both-in-one-painting with its stated threshold, your pair.
- [ ] Events: `read` and `checked`.
- [ ] Gates as above; screenshots of a chapter opening, a myth trap answered, the note sheet, the contents sheet, reading from a twin, Paper mode, the Unpainted hub, teal vs turquoise top and evidence, and a close pair (ΔE < 5) to show the duel primary.

### Shared, before either lane merges
- [ ] A fresh-context craft critique (design/CRAFT-RUBRIC.md) of the built pages, with the fixes applied.
- [ ] Confirm with the conductor who adds the three router lines, so L5 and L8 don't both edit router.js in the same place.

---

## 13. Decisions for David (or "go with the recs")
1. **The cover keeps the full-screen color,** but the peek (88 px) and the definition are on it. Recommended. The alternative is DESIGN-SYSTEM §12's 50% hero, which shows more content but loses the "tap a color, it fills the screen" moment you asked for on 2026-10-07.
2. **The book reads on warm black by default, with Paper as an option.** Recommended, to keep "read on black" consistent.
3. **Hold to walk.** Recommended as the signature navigation; the static Compass on the page keeps it discoverable and accessible.
4. **Twin labels by ΔE** (identical on screen < 1, almost identical < 2.5, a near twin < 6, its nearest story < 10). Recommended: "almost identical" is reserved for pairs that really are.
