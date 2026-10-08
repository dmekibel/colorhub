# ColorHub design system

One system for the whole app. It sits on top of DESIGN.md (the decisions and their sources) and the feature hierarchy there. The problems it fixes are in `research/DESIGN-AUDIT.md`. The mockups are in `design/mockups.html`. Status: **approved direction, second pass (2026-10-07)**. Nothing here is built yet.

### Decided (David, 2026-10-07)
1. **Navigation:** the honeycomb is the floor and the four rooms rise over it (§2). No tab bar anywhere.
2. **Today folds into Learn.** Today is the top of the Learn room. The classic Today screen (`home()` in learn.js) retires as a separate screen.
3. **Explore:** Colors is dropped (Home is the colors), and Paintings and Poems merge into **Art**. The four parts are For you, Art, Ideas and World.
4. **One paper-filled primary button per screen.**
5. **Sort and Memory move to Train.** Learn it is Meet, then Recall, then Tell apart.
6. **Full-bleed heroes** on color, painting and article pages. The no-edge-to-edge rule applies to bars, buttons and text.

His bar for the result: superior in every way. Clever, functional, user-friendly, iconic, minimal, beautiful, consistent and expensive-looking.

---

## 1. Principles (seven)

1. **The color is the interface.** A color gets the most room on every screen. Everything else is neutral and recedes.
2. **Controls are solid.** No glass, blur or outline-only buttons over color. A control is either an opaque surface (`--surface-2`) or a paper label. Its contrast with what's under it never depends on the color underneath.
3. **One place, one motion.** The honeycomb is the floor of the app. Every color and every room opens the same way: the bubble you touched grows into the page, and closing shrinks it back into the same bubble. Each place has one name, used everywhere.
4. **One gesture and one filled button per screen.** Each screen has one primary action, drawn as the only filled (paper) button. Everything else is quiet. Depth (codes, ΔE, sources, settings) opens on request.
5. **Judge on grey, read on black.** Any screen where a color is judged uses the booth grey. Screens for reading or browsing use warm black. A screen never mixes the two, and a flow never flips between them halfway through.
6. **The serif speaks; mono only counts.** Hierarchy comes from serif size and contrast, never from small caps labels. Mono appears only on numbers and codes.
7. **Nothing cut off, nothing redundant.** Gutters are at least 16 px, safe areas are respected, and every screen fits a 375 × 667 iPhone SE without clipping. A label never repeats what's already visible (a name already on the bubble, a title already in the header).

---

## 2. Navigation model: one floor, four rooms

This is the most important section. It replaces the current mix: the Today tab that shows the honeycomb, the Learn door that opens the classic Today screen, and the brand logo as a hidden way home.

### Places and names
| Place | What it is | Route | Name on screen |
|---|---|---|---|
| **Explore** (the map) | The full-screen honeycomb, always underneath everything | `#/home` | "Explore · Every color" on the stem; no label on the floor itself. (Was "Home" until 2026-10-08.) |
| **Learn** | Today (what's due, Today's three), then the path, then your collection | `#/learn` (`#/today` opens Learn at Today) | "Learn". Its first block is about today, with no "Today" heading needed. |
| **Train** | The eye gym: stations, levels, check-ins | `#/train` | "Train" |
| **Museum** | Five full-screen covers: For you, Art, Ideas, World, Saved | `#/museum[/art|ideas|world]` (old `#/explore…` still works) | "Museum" (was "Explore" until 2026-10-08) |
| **Studio** | Making: the gamut wheel, the camera, photo palettes, taste | `#/studio` | "Studio" |

### The pieces
- **On Home:** two solid corner buttons, both 56 px.
  - **Left, Rooms:** a glyph of four small circles on a curve, the stem in miniature.
  - **Right, View:** the sliders glyph. It opens the View panel (§12).
- **The stem:** tapping Rooms raises four bubbles in a gentle curve above the left corner, 100 px apart, each 78 px.
  - They are made of the honeycomb's own material and show what's inside today:
    - **Learn:** the colors due, as stripes.
    - **Train:** today's station tile.
    - **Explore:** today's cover image.
    - **Studio:** the gamut wheel.
  - Beside each bubble sits its name (`title-2`) and one line about today (`note`): "8 to recall", "Odd one out, level 9".
  - The honeycomb dims to 30%. The corner turns into a paper ✕.
  - Learn sits lowest, nearest the thumb. The top bubble stays at least 150 px below the status bar on a 375 × 667 screen.
- **A room:** a sheet at full height with a 12 px strip of the dimmed, slightly scaled-back honeycomb showing above it, so you can see you're still on top of Home.
  - The Rooms corner stays in the same spot in every room.
  - In a room, the stem also has **Home** at its foot: the corner itself, marked with the honeycomb glyph.
  - There is no tab bar and no room bar, ever.
- **The shortcut:** a swipe up from the bottom edge of Home opens Learn straight away. It's the fastest way to today's review, and the one gesture the first-launch hint teaches.

### Moving around
| From → to | How | Motion |
|---|---|---|
| Home → the stem | Tap Rooms | The bubbles rise one after another from the corner, 30 ms apart, on a spring (`--dur-2`). The honeycomb dims. |
| The stem → a room | Tap a bubble | **The signature motion (§8):** the bubble grows into the room's sheet. |
| Home → Learn | Swipe up from the bottom edge | Learn's sheet follows the finger. Past 40% it springs to full. |
| Room → another room | Rooms corner, then a bubble | The current sheet shrinks back into its own bubble on the stem while the new one grows. |
| Room → Home | Swipe the sheet down, tap the honeycomb strip, the system back gesture, or Rooms then Home | The sheet shrinks into its bubble, the bubble sinks into the corner, and the honeycomb returns to full brightness exactly where you left it. |
| Anywhere → a color | Tap a bubble, chip, plate or swatch | The signature motion: the shape grows into the color's page. |
| Room → an inner screen (station, article, painting) | Tap | It grows from the tapped picture, using the signature motion with that picture's own shape. |
| Anywhere → a task (deck, Learn it, drill, placement) | Its primary button | The paper button grows into the booth-grey task screen. ✕ shrinks it back. |

**Back** is always one layer down, and always the same motion in reverse. The brand logo is not a control. The old `⋯` menu (settings, backup, placement) moves to the end of the View panel and the end of Learn.

### Why this model
- It keeps David's full-screen honeycomb and his two corners, and ALTER's corner feel.
- It uses no tab bar. The rooms are reached by bubbles, which are the app's own material, so moving between rooms feels like part of the honeycomb, not a second app.
- It's obvious to a first-timer: one tap shows four labeled pictures, and each one says what's waiting today.
- It's thumb-reachable: every target is in the lower-left two thirds.
- **Precedent:** Apple Maps (a canvas home under sheets), Material's speed-dial (actions rising from a corner button) and iOS app launch (the icon grows into the app).

---

## 3. Color tokens

```css
/* reading surfaces (warm black) */
--ground:#0E0D0B;      /* page */
--surface-1:#17160F;   /* sheets, panels */
--surface-2:#1F1D18;   /* floating controls, corner buttons, bar, cards on ground */
--surface-3:#2A2822;   /* pressed / selected */
--ink:#ECE8DF;  --soft:#A39E92;  --faint:#837E73;      /* 15.9 · 7.3 · 4.8 : 1 on ground */
--rule:rgba(236,232,223,.12);  --rule-strong:rgba(236,232,223,.8);
--paper:#EFEBE3; --paper-ink:#141311; --paper-soft:#5E5A51; --paper-line:#DCD7CC;   /* paper-soft 5.8:1 (was 4.5) */
--good:#9AD4AE; --bad:#F09A86; --scrim:rgba(0,0,0,.55);   /* solid scrim, never blur */

/* the viewing booth (set on html for judged screens: deck, meet, Learn it, drills, daily, screen check) */
--booth:#5F5F5F;  --booth-2:#555555;  /* controls on grey: opaque, 1 step darker */
--b-ink:#FFFFFF;  --b-soft:#E4E4E1;  --b-faint:#C9C9C5;   /* 6.4 · 5.0 · 3.8 : 1 (faint: large text only) */
--b-rule:rgba(255,255,255,.22);  --b-track:rgba(0,0,0,.22);   /* progress tracks go DARK on grey, fills go white */
```

**Judged swatches:**
- On booth grey only, with at least 16 px of grey on every side, so the surround always reads.
- No shadow, no border, no film grain, no gradient.
- Radius 4.
- Feedback (right or wrong) goes *outside* the swatch, as a 3 px ring at a 3 px offset. It never sits over the swatch and never dims it, so you can keep comparing.

**Showcase swatches** (heroes, plates, bubbles): on warm black. A swatch darker than L* 12 gets a 1 px `rgba(255,255,255,.08)` inner hairline so its edge stays visible.

**Text on a swatch:** use `ink(hex)` to pick paper-ink or white at full opacity. Never use reduced-opacity text on color.

---

## 4. Type

The serif carries every level of the hierarchy, through size and contrast. Instrument Serif (roman and italic) is used for every name, title and label. Geist is used only for long reading text and small print. Geist Mono is used **only on numbers and codes**: hex, ΔE, percentages, levels and counts. Never in uppercase, never for words.

| Token | Font | Size / line height | Tracking | Use |
|---|---|---|---|---|
| `hero` | serif | 96 / .86 | −.04em | The color name on its own page |
| `display` | serif | 72–76 / .86 | −.04em | Names on meet pages and deck cards, room covers ("Art"), the big count in View |
| `title-1` | serif | 44 / .95 | −.03em | Room titles, lesson questions, "8 to *recall*" |
| `title-2` | serif | 30 / 1.02 | −.02em | Sheet titles, the current unit, room names on the stem |
| `title-3` | serif | 22 / 1.12 | −.01em | Rows, tiles, section heads ("The path") |
| `lead` | serif | 20 / 1.32 | 0 | Differences and lead paragraphs |
| `note` | serif italic | 16 / 1.3, soft | 0 | Replaces every eyebrow and label: "New to you, from the Blues", "Then Reds & pinks". At most one per block. |
| `body` | sans | 16 / 1.55 | 0 | Article text |
| `small` | sans | 14 / 1.5, soft | 0 | Credits and feedback lines |
| `code` | mono 400 | 12 / 1, tabular | +.02em | Numbers and codes only, never uppercase |

**Rules:**
- **Size contrast:** each step is about 1.4× the one below it. Every screen uses at most three steps, with at least one jump of two steps (a 44 title over a 16 note), which gives the expensive feel.
- **No uppercase anywhere,** and no tracked-out labels.
- **Labels are a last resort.** If the content is self-evident (a strip of colors, a row of bubbles), it gets no label. If a block needs one, use one `note`, not a header plus a caption.
- **Italic serif** marks the turn in a headline ("8 to *recall*") once per screen, and is the voice of every `note`.

---

## 5. Space, gutters, safe areas

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Gutter `--g`:** 20 px at widths of 375 px and up, 16 px below that (never less), 24 px at 430 px and up. Full-bleed is allowed only for heroes, images and the honeycomb, never for bars, buttons or text.
- **Safe areas:**
  - Top content starts at `env(safe-area-inset-top) + 8`. Headers are 52 px tall.
  - Bottom controls sit at `env(safe-area-inset-bottom) + 12`, with a minimum of 16 from the edge.
  - A scrolling page reserves `corner height + bottom inset + 24` so the last line clears the Rooms corner.
- **Fit test:** every fixed screen (decks, lessons, drills) is laid out with flex. The swatch is `flex:1; min-height:160px` and absorbs height. Header and footer have fixed heights (52 and 112). At 375 × 667 nothing scrolls or clips.

## 6. Radii

| Token | Value | Use |
|---|---|---|
| `--r-0` | 0 | Full-bleed heroes and images |
| `--r-1` | 4 | Every swatch, tile and plate |
| `--r-2` | 14 | Cards, deck cards, image frames in lists |
| `--r-3` | 24 | Sheet top corners |
| `--r-pill` | 999 | Buttons, the bar, chips, circles |

Retire 1, 2, 3, 6, 8, 10, 12, 18, 20, 22 and 30. During the signature motion the radius is animated between these values (§8).

## 7. Elevation without glass

| Level | Surface | Edge | Shadow | Example |
|---|---|---|---|---|
| 0 | `--ground` | none | none | Page |
| 1 | `--surface-1` | top hairline `--rule` | `0 -16px 48px rgba(0,0,0,.45)` | Sheet, panel |
| 2 | `--surface-2` | 1 px `rgba(236,232,223,.14)` | `0 8px 24px rgba(0,0,0,.5)` | Corner buttons, floating ‹ over a hero, the stem's bubbles (shadow only) |
| Scrim | `--scrim` | — | — | Behind a modal sheet. Under a navigation sheet the honeycomb is dimmed with a filter instead. |

On booth grey, level-2 controls use `--booth-2` with no shadow, because shadows read as dark halos on grey.

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--dur-0` | 120 ms | `ease-out` | Press dip (.94), icon swap, toggles |
| `--dur-1` | 200 ms | `cubic-bezier(.2,.8,.2,1)` | Cross-fades, content swaps |
| `--dur-2` | 300 ms | spring, stiffness 380, damping 34 | Sheets, the stem rising |
| `--grow` | 420 ms | `cubic-bezier(.32,.72,0,1)` | **The signature: a bubble becomes its page** |
| `--shrink` | 340 ms | `cubic-bezier(.4,0,.2,1)` | The signature in reverse |
| `--dur-4` | 700 ms | `--ease` | Celebrations (lesson done, a color owned). Rare and skippable. |

### The signature: a bubble becomes its page
One motion for everything that opens: honeycomb bubbles, palette chips, near-name bubbles in the color sheet, Today's plates, swatches anywhere (`data-swatch`), the room bubbles on the stem, painting thumbnails and the paper primary of a task. The thing you touched *is* the page. It never cuts to a new screen. Key frames are in `design/mockups.html`.

| t | What happens |
|---|---|
| 0 ms | **Press.** The bubble dips to 94% (`--dur-0`) with a 4 ms tick. Its siblings don't move. |
| 0–40 ms | It lifts above the honeycomb (z-order) and grows, still round. The honeycomb starts to dim (to 30%) and lean in (scale 1 → 1.06), so the bubble seems to come toward you. |
| 40–110 ms | The circle becomes a rounded slab heading for the hero's rect. The corner radius follows `min(w,h)/2 × (1 − p)^0.5`, so it stays soft until the end. The name rides the same curve, from 16 px at the bubble's center to the hero size at its bottom-left. |
| 110–420 ms | The corners square off as the slab meets the screen edges: the long, soft settle. From p = .55 the page below rises 24 px into place and fades in, and the page's ground fills in behind it. The floating ‹ and ⋯ fade in last. |
| Back | Exactly the reverse, `--shrink` 340 ms, into the **same** bubble. The honeycomb keeps its pan and zoom while the page is open, so the bubble is always where it was. If the source scrolled away (a chip in a long page), it shrinks to where the chip now is, or to its nearest visible edge. |
| Swipe down | Interactive. The page follows the finger 1:1, scaling to .82 and rounding to 34 px at 40% of the screen height. Release past 120 px (or a flick faster than .6 px/ms) to finish the shrink with the gesture's speed. Otherwise it springs back. |

**Rules:**
- **Shape memory:** a circle grows from a circle, a square chip from a 4 px square, and a painting thumbnail from its rect.
- **Implementation:** `clip-path: inset(... round r)` on a fixed layer drawing the target page's hero. Animate only `clip-path`, `transform` and `opacity`, never layout.
- **Reduce Motion:** a 150 ms cross-fade, no growth.
- **Haptics:** a 4 ms tick at the press, and an 8 ms tick when the page settles.

### Other rules
- The stem's bubbles rise from the corner in order, 30 ms apart, and sink in reverse.
- **Every motion explains something:** where a thing came from, where it went, or what changed. No decorative loops except the single first-run hint.

## 9. Haptics

`buzz()` maps to `navigator.vibrate` where supported (Android). iOS Safari has no vibrate. On iOS, wire the same calls to the iOS 18 `<input type="checkbox" switch>` click trick, or skip them. The app must never depend on a haptic.

| Event | Pattern |
|---|---|
| Tick: a bubble crosses the lens center, a sheet hits a detent, a slider passes a stop | 4 ms |
| Select: a tap on a choice or a swipe committed | 8 ms |
| Right | 12 ms |
| Wrong | 10 · 40 · 10 |
| Done: a lesson or a set | 10 · 30 · 20 |

---

## 10. Components

### Buttons
| Kind | Look | Size | Rule |
|---|---|---|---|
| **Primary** | Paper fill, paper-ink serif 27 px label left, an optional italic note ("2 min") after it, → right | 58 h, full width within the gutter, `--r-pill` | One per screen. On booth grey it's still paper. When tapped it grows into its task (§8). |
| **Quiet row** | No fill; ink serif 22 px label, the current value as a `note` right, then ›, with hairlines between rows | 60 h | Secondary actions and settings (Show, Look) |
| **Text** | `note` serif italic, 17 px, underlined at 4 px | 44 h hit area | Tertiary: "Copy hex", "Paintings in denim", "About petrol" |
| **Icon** | 24 px glyph, no fill | 44 × 44 | In headers |
| **Floating icon** | Level-2 circle, 44 px | 44 × 44 | ‹ and ⋯ over a hero or image (never glass) |
| **Corner** | Level-2 circle, 56 px, 24 px glyph | 56 × 56 at the 16 px corner | Rooms (left, everywhere) and View (right, on Home). When the stem is open, the left corner is a paper ✕. |
| **Answer** (deck) | 66 px circle, `--booth-2`, ✕ in `--bad`, ✓ in `--good`, no text label | 66 | Only in decks |

### Bottom sheet
- `--surface-1`, `--r-3` top corners, grabber 36 × 4 at 8 px from the top.
- **Detents:** a room is full height (top inset + 12, so a strip of the honeycomb stays visible). Modal sheets (the color sheet, View) take their content height, with a maximum of 70%, so what they change stays visible above them.
- Inner padding is the gutter. The header is the title (`title-2`) on the left and up to two solid 44 px icon buttons on the right.
- Drag anywhere on the header to move it. Content scrolls only at full height.

### Cards
`--surface-2` on ground, `--r-2`, no border, and the image or plate flush at the top. Use one card per kind: **daily tile** (Today's three), **station tile** (Train), **cover** (Explore), **tool tile** (Studio). The same kind always has the same anatomy: picture, `title-3`, one `note` line, and an optional done dot.

### List rows
52–64 px tall. A 32 px swatch (square, `--r-1`, or round for colors from the 1,000-word list), then a `title-3` name, then an optional `small` second line, then a trailing `code` value or ›. Rows are separated by `--rule` hairlines. No boxes.

### Swatches
| Use | Size |
|---|---|
| Hero | Full width, 46–52% of the height |
| Plate | 1/n of the width, 96–136 px tall, 2 px gaps |
| Chip | 32 px |
| Dot | 12 px |

Any swatch carrying `data-swatch` opens **the** color sheet, and there is only one color sheet.

### Progress
- **Lesson and deck:** a segmented bar, one segment per color. The track is `--b-track` (dark on grey). A segment fills with *its own color* when it's known. Height 4, radius 2, gap 3.
- **Level:** 20 ticks.
- **Rooms:** never more than one progress element above the fold.

### Lesson / deck card
- `--r-2`, with the 20 px gutter of booth grey around it.
- **Front:** the color, full card.
- **Revealed:** a paper label slides up over the bottom 34%. It shows a `note` ("One of teal's look-alikes") with the hex in `code` on the right, then the `display` name, a hairline, a compare chip pair, and the difference in `lead` at 18 px in `--paper-soft` (5.8:1).
- Stamps (Got it / Again) are paper.

### Empty states
One `title-3` line saying what will be here, one `small` line on how to fill it, and one quiet action. Never show an empty section heading: if a section has no content, it doesn't render.

### Loading
Placeholder blocks in the exact layout, `--surface-2`, pulsing at .55↔1 over 1.6 s. Text appears only after 600 ms ("Loading the paintings…").

---

## 11. Screen archetypes

### Canvas (Home)
- Full bleed. No header and no text except the bubble names.
- Two corner buttons sit at 16 px from the sides and `bottom-inset + 12`.
- **Bubble names:** `ink()` color at full opacity, serif sized with the bubble (11–17 px). Names show only on bubbles wider than 44 px.
- **Vignette:** darkest at the very edge, eased like a Gaussian, and the corners compound.
  - The edge band is 20% of the width horizontally and 15% of the height vertically.
  - Opacity of `--ground` across the band (t = 0 at the edge, 1 at the band's inner end): 1.00 · .90 (t .1) · .70 (.2) · .48 (.3) · .30 (.4) · .16 (.5) · .07 (.62) · .02 (.78) · 0 (1). That's a half-Gaussian with σ ≈ .3.
  - Draw it in the canvas as the last pass: per pixel, `a = 1 − (1 − aX)(1 − aY)`, so the corners come out darkest.
  - The two corner buttons sit inside the vignette, which is why they must stay opaque.
- **Lens:** the round fisheye by default (biggest in the middle, shrinking smoothly all the way out). Its strength and the Edges option live in the View panel (§12). Never the tall eye-shaped lens.

### Article (color page, wiki page, painting, plant, gem, fashion)
- **Header:** floating level-2 ‹ at top-left. Optional floating ⋯ at top-right (share, save, "More like this"). No boxed buttons, no centered title. The title lives in the content.
- **Hero:** a full-bleed swatch, image or palette band, 46–52% of the height, with the title on it (color pages) or right under it (images).
- **Then:** one primary action (if any), the one-line essential (difference or dek), the lead, the image, then **hub rows** (horizontal shelves with pictures: In paintings, In poems, In films, Nature, Gems, Fashion), then collapsible sections.
- **Tier 4 last:** Codes, Sources and Connections, all collapsed.

### Lesson (meet, deck, Learn it, placement, review)
- Booth grey. A full-screen task with no bar.
- **Header (52):** ✕ on the left (44 hit area, glyph at x = gutter), then the segmented progress. No step word: the screen shows which step it is.
- Stage: `flex:1`, holding one card or one pager page.
- Footer (112): the actions for this step, under the thumb.
- One gesture per step: swipe up (meet), tap then swipe (deck), or tap a swatch (pick).

### Station (a Train drill)
- Booth grey, full-screen task.
- Header: ✕, progress, then the level in `code` ("Lv 9").
- The question in `title-1`, *without* an eyebrow that repeats it.
- Stage centered, tiles at most `min(100%, 58dvh)`.
- The footer reserves 112 px. After the answer it shows one `small` feedback line and the paper primary "Next".
- Research notes live on the station's intro card, never on the drill screen.

### Room (Learn, Train, Explore, Studio)
- A full-height sheet over the honeycomb, entered by the signature motion.
- **Room header:** the room name in `title-1` on the left, a `note` (the day, or nothing) or one solid icon on the right.
- **First block, the hero of the room:**
  - Learn: today's plates and one primary.
  - Train: today's station, full width.
  - Explore: the cover pager.
  - Studio: the wheel.
- **Then** a single column with generous rhythm: 32 px between blocks and 14 px inside them. Use pictures and color bands rather than boxes, at most one `note` per block, and no segmented tab rows.
- The Rooms corner floats bottom-left. The last 120 px of the sheet fade into `--surface-1`, so content passes under the corner cleanly.

### Tool (Studio tools, camera)
- Full bleed. The tool's live surface fills the screen.
- Level-2 floating controls only: ‹ top-left, one setting top-right, and the action cluster bottom-center (shutter 72 px, flanked by 48 px circles).
- The result card is a level-1 sheet at mid detent.

---

## 12. Redesign specs for the key screens

### Learn it (rebuilt from existing patterns only)
**Flow (about 2 minutes):** Meet → Recall → Tell apart → Done. That's three steps instead of five, and every one is a pattern David already likes.

1. **Meet.** The meet pager (`meet()` from learn.js), scoped to the group: teal plus its 3–4 nearest taught look-alikes.
   - Cover page: the group's plates, light to dark (no fan, no chip feet), then "Teal and its look-alikes" in `display`, then one `note`: "Five colors that are easy to mix up."
   - Then one page per color, using meet's own page: the full swatch with the `display` name and hex inside it, the compare strip (*this color* | *teal*, or teal | its nearest), the difference at 26 px ("Darker and bluer than teal."), and "About petrol" as a text link. Bottom right: an up chevron and `2/5`.
   - Colors already yours are skipped, but always shown on the cover.
2. **Recall.** `deck("learn")` with the group as the queue, forward cards only. Tap to reveal, swipe until every card is known, with the same paper label, stamps and ✕/✓.
3. **Tell apart.** One look-alike step: three Pick it rounds (the `pickBoard()` paper name card over a 2×2 of the group's own swatches). Wrong answers are same-family by construction. After each tap every swatch is named and the answer is ringed.
4. **Done**, on booth grey (no jump to black).
   - The group as plates.
   - `title-1`: "You met *teal* and four look-alikes."
   - Then 4 ruled rows: chip pair · "Petrol — darker, bluer".
   - `note`: "All five come back tomorrow, after a night's sleep."
   - Primary: "Back to Teal" (it shrinks the lesson back into the color page).

Dropped: Sort and Memory (thinky exercises belong in Train), and the custom `.lt-*` layouts.

**Chrome:** the lesson archetype. One segmented bar covers the *whole* lesson, one segment per color. A segment turns faint in that color when you meet it and solid when you know it. There's no step word. The 20 px gutter holds everywhere, so nothing touches an edge. The paper "Learn it" button grows into the lesson. "Back to Teal" shrinks it back into the color page.

### Color page
1. Hero: a full-bleed swatch at 50% of the height. This is where the tapped bubble lands (§8).
   - Floating level-2 ‹ and ⋯ on top.
   - Bottom-left: one `note` in the swatch's ink at 18 px ("New to you, from the Blues", "Learning" or "Yours since May"), then the name in `hero` (96 px), then the hex in `code`.
2. Primary: **Learn it · 2 min**, a paper pill (the only filled button). For a color already yours it becomes "Review it". To its right, two quiet icons: save and share.
3. The compare strip, with no label (teal | turquoise | petrol, the first wider), each tappable to open the look-alike sheet, then the `lead` diff line.
4. Lead story (serif 20), then the image with its credit.
5. Hub shelves with pictures: In paintings (thumbnails with palette bars), In poems (one line plus the poet), In films, In nature, Gems, Fashion. Only shelves with content render.
6. Collapsed: Language, History (facets), Codes (HEX · RGB · HSL · CMYK, with the CMYK note inside), Sources, Connections.

### Learn (the first room; Today is its top)
- **Header:** "Learn" (`title-1`) and the weekday as a `note`.
- **Today:**
  - A wide plate of the colors due (132 px tall, one stripe per color).
  - "8 to *recall*" (`title-1`), then one `note`: "Then Reds & pinks, nine new names".
  - The paper primary "Begin".
  - Today's three (Challenge, Today's color, a Train suggestion) follow as three equal tiles with done dots, below the fold on smaller phones.
- **The path:** a column of units drawn as their own colors.
  - Finished units are solid 30 px bands with a `note` ("Yours").
  - The current unit is a 72 px band with its name in `title-2`.
  - Future units are 8 px lines with their names in soft serif.
  - This is the path from ROADMAP §1, told with color instead of icons.
- **Your collection:** the quilt and "27 of 101" in `title-2`, at the end.
- Nothing else. Search, views and Surprise me live in View. The camera lives in Studio.

### View panel (Home's right corner)
Calm, with one big control and big targets. Every change previews live on the honeycomb, which stays visible above the panel.
- **Height:** a modal sheet at content height, about 50% (never more than 60%).
- **Header:** "View" (`title-2`), with two solid 44 px icon buttons: Search (it opens a field in place) and Surprise me (dice).
- **The stage:**
  - The count set huge ("101" at 72 px), with one `note` beside it: "colors, stage 3 of 9".
  - Under it, a full-width scrubber: a 48 px hit area across the whole gutter, 9 detents, and a 32 px paper thumb.
  - Dragging it snaps through the nine stages with a 4 ms tick at each one, and the honeycomb repopulates live as you drag.
- **Three quiet rows,** each 60 px tall, each with its current value as a `note`:
  - **Show:** All colors, Learned, Learning or New. It opens a second page of the same sheet with four big rows.
  - **Look:** for example "Round lens, map". It opens the Look page:
    - Two picture tiles, **Round** (default) and **Edges**, each a live miniature of the honeycomb, so you choose by picture.
    - One strength slider from *Gentle* to *Strong*. The gentle end still scales, never flat.
    - A Layout row: Map or Wheel.
  - **Or a collection:** Every name, Even 500, Yours, character, traditions.
- **At the end, below the fold:** Settings, Back up, Retake placement (the old ⋯ menu).

### Train station (drill)
The Station archetype.
- Example: Odd one out, level 9.
- Header: ✕ · progress · "Lv 9".
- `title-1`: "Which tile is different?"
- A 3×3 grid on booth grey.
- The grid sizes itself to the height (`min(335px, 100vh − 410px)`), so it fits a 375 × 667 screen.
- After the tap, the footer shows one line, "Right. It was 2.7 off, a little redder." (`small`, with the number in `code`), and the paper primary "Next".
- The trivia ("Scores use CIEDE2000…") moves to the station intro card's "How it works".

### Explore (a pager of covers)
Explore is unmistakably ColorHub because every screen is led by one great image and its measured colors.
- **The top level** is a vertical pager like the meet pager. There are five full-screen covers, one per part: **For you · Art · Ideas · World · Saved**. You swipe up through them. (Redesigned 2026-10-08 after David's 16 Pro Max screenshot: no card, no margins, no peek.)
- **Each cover** fills the whole screen, edge to edge:
  - The image runs under the status bar (a soft shade behind it) and takes whatever the text below doesn't: about 60% on a 16 Pro Max, 55% on a 375 × 812. Today's pick for that part: a painting (Art), a story's colors with its title set large (Ideas), a color with its name (For you, World), what you've kept as a mosaic (Saved).
  - Under it, the palette band (30–44 px): the image's real colors sized by share, each a button to its color page. Short palettes aren't padded with repeats.
  - Below, a ground tinted from the image's darkest dominant color (L* ≤ 18, chroma ≤ 20), so text stays above 7:1.
  - On the ground: the part's name in `display` (56–76 px), one `lead` line, one `note` about today (with a chip of today's color when there is one), then the paper primary ("Enter Art", "Read Ideas"…) just above the Rooms corner.
  - States: loading paints the image area in the painting's dominant color and fades the photo in; a failed image shows its colors as stripes with the title; empty Saved shows twelve empty frames and a heart, and its primary is "Find something to keep".
- **Navigation:**
  - Five page dots on the right edge, level with the part's name; the current one is a short bar.
  - One solid search button top-right, inside the safe area.
  - There's no tab row and no next-cover peek.
- **Inside a part (Art):**
  - The header takes the tint of the chosen color.
  - A row of 46 px color bubbles picks the color (the honeycomb's material again).
  - Below, a two-column masonry of paintings, each with its palette bar, title in `title-3` and artist in `note`. Tapping a painting grows it into its page (§8).
  - Poems sit in the same feed as paintings, set as lines of verse with the color word in its color.
- **Tinting rule:** the tint is computed per image (darkest dominant color, L* ≤ 18, chroma ≤ 20). Swatches judged inside Explore still sit on neutral surfaces: tint only the ground, never behind a swatch you're asked to compare.

### Museum painting page
- Hero: the image, full width, contain-fit on ground, tap to zoom.
- Floating ‹. A floating ↗ (the museum link) top-right, in place of the boxed "CHICAGO".
- Then: the title in `title-1`, and the artist and year as a `note`.
- **Palette:** the share-sized bar (6 plates, each `data-swatch`). Under it, 6 list rows: chip · **name from the 1,000-word list, capitalized** (Gunmetal, Denim, Slate) · share % in `code`. Tapping a row highlights its area on the image and opens the color sheet.
- The note, then "Similar palettes" (shelf), then collapsed "About this palette" (the computed-palette caveat) and "Image and data".

### The color sheet (one sheet for every swatch)
- A modal sheet at content height (≤ 70%).
  - Hero swatch, 140 h, `--r-1`.
  - The name in `title-1`, capitalized, with the hex in `code` beside it.
  - One `note` about where you are: "A quarter of the painting, and one of your words", or "Closest of the 101: Gunmetal, darker and warmer".
- **Near names:** a row of four 48 px bubbles with their names under them in serif. Tapping one grows it into that color's sheet (the signature, at sheet scale).
- **Actions:**
  - Primary (paper): "Open Gunmetal" if it's a taught color; for any other color, "Paintings with this color".
  - Text links: "Learn it" (taught colors only), "Paintings in denim" and "Copy hex".
- ΔE values and "Also called" sit behind a "Details" disclosure.
- The "New word" tag appears only for real names that aren't yet met. "Between X and Y" is a description, never a name: it shows as the `small` line, with the nearest real name as the title.

---

## 13. Design QA before every push
- [ ] 375 × 667 and 375 × 812: nothing clipped, nothing under the home indicator.
- [ ] Gutters at least 16 px. No bar, button or text runs edge to edge.
- [ ] One filled button per screen. No glass, blur or outline-only control on color.
- [ ] Judged swatches only on booth grey, with no overlay on them.
- [ ] Mono only on numbers and codes. No uppercase text anywhere.
- [ ] Every color, room and picture opens with the signature grow and closes back into its source.
- [ ] No empty section headings. No label repeating visible text.
- [ ] Back goes down exactly one layer.
- [ ] Reduce Motion: every move becomes a cross-fade.
