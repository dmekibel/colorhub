# ColorHub design system

One system for the whole app. It sits on top of DESIGN.md (the decisions and their sources) and the feature hierarchy there. The problems it fixes are in `research/DESIGN-AUDIT.md`. The mockups are in `design/mockups.html`. Status: **proposed, for David's approval**. Nothing here is built yet.

---

## 1. Principles

1. **The color is the interface.** A color gets the most room on every screen. Everything else is neutral and recedes.
2. **Controls are solid.** No glass, blur or outline-only buttons over color. A control is either an opaque surface (`--surface-2`) or a paper label. Its contrast with what's under it never depends on the color underneath.
3. **One place.** The honeycomb is the floor of the app. Learn, Train, Explore and Studio are sheets that rise over it, and going back always lowers you onto the same floor (the Apple Maps model). Each place has one name, and it's used everywhere.
4. **One gesture and one filled button per screen.** Each screen has one primary action, drawn as the only filled (paper) button. Everything else is quiet. Depth (codes, ΔE, sources, settings) opens on request.
5. **Judge on grey, read on black.** Any screen where a color is judged uses the booth grey. Screens for reading or browsing use warm black. A screen never mixes the two, and a flow never flips between them halfway through.
6. **Nothing cut off, nothing redundant.** Gutters are at least 16 px, safe areas are respected, and every screen fits a 375 × 667 iPhone SE without clipping. A label never repeats what's already visible (a name already on the bubble, a title already in the header).

---

## 2. Navigation model: one floor, four rooms

This is the most important section. It replaces the current mix: the Today tab that shows the honeycomb, the Learn door that opens the classic Today screen, and the brand logo as a hidden way home.

### Places and names
| Place | What it is | Route | Name on screen |
|---|---|---|---|
| **Home** | The full-screen honeycomb. Always underneath everything. | `#/` | No label. The ⬡ button means Home. |
| **Learn** | The path: today's review/continue, Today's three, your units, your collection | `#/learn` (`#/today` = Learn, opened at Today) | "Learn". Its first section is headed "Today". |
| **Train** | The eye gym: stations, levels, check-ins | `#/train` | "Train" |
| **Explore** | Reading: For you · Art · Ideas · World | `#/explore[/art|ideas|world]` | "Explore" |
| **Studio** | Making: gamut wheel, camera, photo palettes, taste | `#/studio` | "Studio" |

"Today" stops being a place. It's the top section of Learn (what's due today). The classic `home()` screen *becomes* the Learn room, so nothing is lost. There is no fifth room. Home isn't a room: it's the floor.

### The pieces
- **On Home:** the two corner buttons, exactly as now. **Left: Today** (sun icon) raises the sheet to *mid*, showing Learn's Today section. **Right: View** (sliders icon) opens the View panel.
- **The sheet:** one sheet with three detents.
  - **Down:** Home, with only the honeycomb and the two corners.
  - **Mid (56%):** Today (Learn's top section), with the honeycomb visible above.
  - **Full:** a room. The sheet stops 10 px below the status bar, so a lip of honeycomb always shows at the top: you can see you're still on top of Home.
- **The room bar:** whenever the sheet is up, a bar sits at the bottom. It's opaque `--surface-2`, 56 px tall, radius 28, with 16 px side gutters.
  - The **⬡ Home** circle stays at exactly the pixel position of the left corner button.
  - Next to it, a pill holds the four rooms: **Learn · Train · Explore · Studio**, each with an icon and an 11 px mono label. The current room gets an ink underline and full ink; the others are soft.
- **The ⬡ circle** is the same object as the Today corner. When the sheet rises, its icon cross-fades from sun to ⬡ in 120 ms, and the room pill grows out of it to the right. That makes it read as one control turning into another, not a new bar appearing.

### Moving around
| From → to | How | Motion |
|---|---|---|
| Home → Today | Tap the left corner, or swipe up from the bottom 120 px | Sheet springs to mid (`--dur-2`, spring). The honeycomb dims to 70% and stays live above it. |
| Home / Today → a room | Tap a room in the bar | Sheet springs to full. The honeycomb scales to .96 and dims to 40% (the iOS card stack). |
| Room → room | Tap another room in the bar | The content cross-fades (`--dur-1`) and the underline slides. The sheet doesn't move. |
| Room → Home | Tap ⬡, drag the sheet down, tap the honeycomb lip, or the system back gesture | Sheet falls, the honeycomb returns to scale 1 and full brightness, and the bar shrinks back into the corner. You land exactly where you were. |
| Anywhere → a color page | Tap a bubble, chip or swatch | Shared-element morph: the tapped swatch grows into the page's hero (`--dur-3`). |
| Room → inner screen (station, article, painting) | Tap | Pushes in from the right over the sheet (`--dur-2`). The bar slides away (the bar belongs to rooms only). Back is ‹ or an edge swipe. |
| Anywhere → a task (deck, Learn it, drill, placement) | Tap its primary button | Full-screen cover from the bottom. The bar hides, ✕ is top-left, and ✕ returns you to where you started. |

**Back** is always one layer: task → origin, inner → room, room → Home. The brand logo stops being a navigation control. The `⋯` menu (settings, backup, placement) moves to the end of the View panel and the Learn room, so the header row loses its brand line.

### Why this model
- It keeps David's full-screen honeycomb and his two corners untouched, and it keeps ALTER's corner feel.
- The rooms never feel like another app: the honeycomb lip and the ⬡ circle are always in view, and the transition is one continuous sheet.
- It uses one bar with four jobs (DESIGN.md tier 2: "never a fifth tab").
- **Precedent:** Apple Maps and Find My (a canvas home, everything else in sheets with detents), iOS card stacks (the dimmed, scaled layer behind) and Duolingo (a fixed bottom bar inside the app).

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

Instrument Serif (400 and italic) for names and headlines. Geist for reading. Geist Mono **only** for labels and codes, never for sentences.

| Token | Font | Size / line height | Tracking | Use |
|---|---|---|---|---|
| `display` | serif | 64 / .9 (56 on SE) | −.035em | The color name on a hero, meet page or deck card |
| `title-1` | serif | 40 / .95 | −.03em | Screen titles (Train, Explore), lesson questions |
| `title-2` | serif | 28 / 1.05 | −.02em | Card titles, sheet titles, the primary button label |
| `title-3` | serif | 21 / 1.15 | −.01em | List rows, tile names, the "diff" line on a swatch |
| `lead` | serif | 20 / 1.35 | 0 | Lead paragraphs and difference sentences |
| `body` | sans | 16 / 1.55 | 0 | Article text |
| `small` | sans | 14 / 1.45 | 0 | Captions, secondary lines, credits |
| `label` | mono 500 | 11 / 1, uppercase | +.12em | Eyebrows, tab labels, section heads |
| `code` | mono 500 | 12 / 1, tabular | +.04em | Hex, ΔE, levels, counts |

**Rules:**
- No more than 3 styles on one card.
- Italic serif marks the second half of a headline ("8 to *recall*"), once per screen.
- No 68 px tab titles. Room titles are `title-1`, set left in the room header.

---

## 5. Space, gutters, safe areas

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Gutter `--g`:** 20 px at widths of 375 px and up, 16 px below that (never less), 24 px at 430 px and up. Full-bleed is allowed only for heroes, images and the honeycomb, never for bars, buttons or text.
- **Safe areas:**
  - Top content starts at `env(safe-area-inset-top) + 8`. Headers are 52 px tall.
  - Bottom controls sit at `env(safe-area-inset-bottom) + 12`, with a minimum of 16 from the edge.
  - A scrolling page reserves `bar height + bottom inset + 24` so the last line clears the bar.
- **Fit test:** every fixed screen (decks, lessons, drills) is laid out with flex. The swatch is `flex:1; min-height:160px` and absorbs height. Header and footer have fixed heights (52 and 112). At 375 × 667 nothing scrolls or clips.

## 6. Radii

| Token | Value | Use |
|---|---|---|
| `--r-0` | 0 | Full-bleed heroes and images |
| `--r-1` | 4 | Every swatch, tile and plate |
| `--r-2` | 14 | Cards, deck cards, image frames in lists |
| `--r-3` | 24 | Sheet top corners |
| `--r-pill` | 999 | Buttons, the bar, chips, circles |

Retire 1, 2, 3, 6, 8, 10, 12, 18, 20, 22 and 30.

## 7. Elevation without glass

| Level | Surface | Edge | Shadow | Example |
|---|---|---|---|---|
| 0 | `--ground` | none | none | Page |
| 1 | `--surface-1` | top hairline `--rule` | `0 -16px 48px rgba(0,0,0,.45)` | Sheet, panel |
| 2 | `--surface-2` | 1 px `rgba(236,232,223,.14)` | `0 8px 24px rgba(0,0,0,.5)` | Corner buttons, room bar, floating ‹ over a hero |
| Scrim | `--scrim` | — | — | Behind a modal sheet. Under a navigation sheet the honeycomb is dimmed with a filter instead. |

On booth grey, level-2 controls use `--booth-2` with no shadow, because shadows read as dark halos on grey.

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--dur-0` | 120 ms | `ease-out` | Press scale (.94), icon swap, toggles |
| `--dur-1` | 200 ms | `--ease` `cubic-bezier(.2,.8,.2,1)` | Cross-fades, content swaps in a room |
| `--dur-2` | 300 ms | `--ease`, or a spring for sheets | Screen push, sheet detents |
| `--dur-3` | 380 ms | `cubic-bezier(.3,.9,.25,1)` | The shared-element morph |
| `--dur-4` | 700 ms | `--ease` | Celebrations (lesson done, color owned). Rare and skippable. |

- **Sheet spring:** stiffness 380, damping 34 (no visible overshoot). Release velocity decides the detent: a flick past 0.5 px/ms goes to the next detent in that direction.
- **Shared-element morph:** the tapped swatch's rect animates to the hero's rect (`transform` only, radius `--r-1`→0, or →`--r-1` for inset heroes). The new page's content fades in at +120 ms over `--dur-1`. Back runs it in reverse to the same bubble. With Reduce Motion it becomes a 150 ms cross-fade.
- **Every motion explains something:** where it came from, where it went, or what changed. No decorative loops except the single first-run hint.

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
| **Primary** | Paper fill, paper-ink `title-2` label left, → right | 56 h, full width within the gutter, `--r-pill` | One per screen. On booth grey it's still paper. |
| **Quiet** | No fill; ink `title-3` label, 1 px `--rule` top and bottom (a ruled row) | 52 h | Secondary actions, stacked under the primary |
| **Text** | `label` mono, underlined at 4 px | 44 h hit area | Tertiary: "Copy #008080", "Sources" |
| **Icon** | 24 px glyph, no fill | 44 × 44 | In headers |
| **Floating icon** | Level-2 circle, 44 px | 44 × 44 | ‹ and ⋯ over a hero or image (never glass) |
| **Corner** | Level-2 circle, 56 px, 24 px glyph | 56 × 56 at the 16 px corner | Home's Today and View, and the ⬡ in the room bar |
| **Answer** (deck) | 64 px circle, `--surface-2` (`--booth-2` on grey), ✕ in `--bad`, ✓ in `--good`, label under it | 64 | Only in decks |

### Bottom sheet
- `--surface-1`, `--r-3` top corners, grabber 36 × 4 at 8 px from the top.
- Detents: navigation sheet at mid 56% and full (top inset + 10). Modal sheets (the color sheet, View) at mid 60% or content height, with a maximum of 88%.
- Inner padding is the gutter. Its header is the title (`title-2`) left and an optional text action right.
- Drag anywhere on the header to move it. Content scrolls only at full height.

### Cards
`--surface-2` on ground, `--r-2`, no border, and the image or plate flush at the top. Use one card per kind: **daily tile** (Today's three), **station tile** (Train), **cover** (Explore), **tool tile** (Studio). The same kind always has the same anatomy: picture, `title-3`, one `small` line, and an optional done dot.

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
- **Revealed:** a paper label slides up over the bottom 34%, showing a `label` meta line (unit · hex), the `display` name, a hairline, then a compare chip pair with the diff sentence (`small`, `--paper-soft`) and "About teal ↗" in `--paper-soft` at 5.8:1.
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
- Header (52): ✕ left (44 hit area, glyph at x = gutter), segmented progress in the middle, a step word or count right (`label`).
- Stage: `flex:1`, holding one card or one pager page.
- Footer (112): the actions for this step, under the thumb.
- One gesture per step: swipe up (meet), tap then swipe (deck), or tap a swatch (pick).

### Station (a Train drill)
- Booth grey, full-screen task.
- Header: ✕, progress, then a level (`code`, "Lv 9").
- The question in `title-1`, *without* an eyebrow that repeats it.
- Stage centered, tiles at most `min(100%, 58dvh)`.
- The footer reserves 112 px. After the answer it shows one `small` feedback line and the paper primary "Next".
- Research notes live on the station's intro card, never on the drill screen.

### Browser (Explore, the Train home, Studio, the Learn room)
- Inside the room sheet.
- **Room header:** `title-1` left, a search icon or room action right.
- **Then:** a segmented lens row of at most 4 items, all fitting at 375 px, then a single column of covers and shelves.
- The first item is a big cover (4:5 or 1:1) with its image flush.

### Tool (Studio tools, camera)
- Full bleed. The tool's live surface fills the screen.
- Level-2 floating controls only: ‹ top-left, one setting top-right, and the action cluster bottom-center (shutter 72 px, flanked by 48 px circles).
- The result card is a level-1 sheet at mid detent.

---

## 12. Redesign specs for the key screens

### Learn it (rebuilt from existing patterns only)
**Flow (about 2 minutes):** Meet → Recall → Tell apart → Done. That's three steps instead of five, and every one is a pattern David already likes.

1. **Meet.** The meet pager (`meet()` from learn.js), scoped to the group: teal plus its 3–4 nearest taught look-alikes.
   - Cover page: a row of the group's plates, light to dark (no fan, no chip feet), "Teal and its look-alikes", "5 colors · about 2 minutes", "Swipe up".
   - Then one page per color, using meet's own page: the full swatch with the `display` name and hex inside it, the compare strip (*this color* | *teal*, or teal | its nearest), the `lead` difference line ("Darker and bluer than teal."), and "About petrol ↗".
   - Colors already yours are skipped, but always shown on the cover.
2. **Recall.** `deck("learn")` with the group as the queue, forward cards only. Tap to reveal, swipe until every card is known, with the same paper label, stamps and ✕/✓.
3. **Tell apart.** One look-alike step: three Pick it rounds (the `pickBoard()` paper name card over a 2×2 of the group's own swatches). Wrong answers are same-family by construction. After each tap every swatch is named and the answer is ringed.
4. **Done**, on booth grey (no jump to black).
   - The group as plates.
   - `title-1`: "You met *teal* and four look-alikes."
   - Then 4 ruled rows: chip pair · "Petrol — darker, bluer".
   - `small`: "All five come back tomorrow, after a night's sleep."
   - Primary: "Back to Teal". Quiet: "Home".

Dropped: Sort and Memory (thinky exercises belong in Train), and the custom `.lt-*` layouts.

**Chrome:** the lesson archetype. One segmented bar for the *whole* lesson, one segment per color, filling with that color as it becomes known in Recall. The header-right word names the step (MEET · RECALL · TELL APART). The 20 px gutter everywhere, so nothing touches an edge.

### Color page
1. Hero: a full-bleed swatch at 52% of the height.
   - Floating level-2 ‹ and ⋯ on top.
   - Bottom-left: a state chip (`label`, a paper chip: NEW · LEARNING · YOURS), then the `display` name, then the hex in `code`.
2. Primary: **Learn it · 2 min**, a paper pill (the only filled button). For a color already yours it becomes "Review it". To its right, two quiet icons: save and share.
3. **Tell it from:** the compare strip (teal | turquoise | petrol, the first wider), each tappable to open the look-alike sheet, then the `lead` diff line.
4. Lead story (serif 20), then the image with its credit.
5. Hub shelves with pictures: In paintings (thumbnails with palette bars), In poems (one line plus the poet), In films, In nature, Gems, Fashion. Only shelves with content render.
6. Collapsed: Language, History (facets), Codes (HEX · RGB · HSL · CMYK, with the CMYK note inside), Sources, Connections.

### Today (the sheet at mid)
- Header: "Today" `title-2` left, the date (`code`) right.
- Primary card: plates of what's due, "8 to *recall*" (`title-1`), "then Reds & pinks" (`small`), and the paper primary "Begin the review".
- Today's three: three equal daily tiles (Challenge · Today's color · Train) with done dots.
- That's all. The view chooser and search move to the View panel. Camera moves to Studio, and "Surprise me" moves into the View panel. The doors disappear: the room bar *is* the doors.

### View panel (Home's right corner)
This keeps the chooser built on main (Stage, Show, Layout, Lens, or a collection) and changes only its height and density.
- A modal sheet at **57%**, not full height, so the honeycomb above stays visible and updates live while you change things. Today the panel covers the whole honeycomb, so you can't see what a setting does.
- **Header:** "View" (`title-2`), with two icon buttons on the right: Search (it opens a field in place) and Surprise me (dice).
- **Lens:**
  - A two-way segmented control, **Round | Edges**. Round is the default: the round fisheye, biggest in the middle and shrinking smoothly all the way out. Edges is the Apple Watch option, with a full-size middle and shrinking only at the edges.
  - A strength slider from "Gentle" to "Strong". The gentle end still scales (never flat), even fully zoomed out.
  - A 4 ms tick at the default and at each quarter. Changes are live, with no Apply button.
- **Show:** a 4-way segmented control (All · Learned · Learning · New).
- **Stage:** one row of 9 numbered chips, with the stage size in `code` under each number. The current stage is a paper chip. This replaces the 3 × 3 grid of bordered boxes.
- **Layout:** Map · Wheel, as two text options on the Stage line, right-aligned.
- **Or a collection ›:** a ruled row that opens the full list (Every name, Even 500, Yours, character, traditions) as a second page of the same sheet.
- At the end, below the fold: Settings, Back up, Retake placement (the old ⋯ menu).

### Train station (drill)
The Station archetype.
- Example: Odd one out, level 9.
- Header: ✕ · progress · "Lv 9".
- `title-1`: "Which tile is different?"
- A 3×3 grid on booth grey.
- After the tap, the footer shows: "Right. It was 2.7 ΔE off, slightly bluer." (`small`, with the number in `code`), and the paper primary "Next".
- The trivia ("Scores use CIEDE2000…") moves to the station intro card's "How it works".

### Explore (top level)
- The room header: "Explore" `title-1`, search icon.
- Lens row: **For you · Art · Ideas · World** (4 items, with Paintings and Poems merged into Art; Colors is dropped because Home *is* the colors).
- **For you:**
  - First, a cover: today's featured story, an image at 4:5, title in `title-2` on a level-2 caption band under the image (no text over the image).
  - Then shelves: "Paintings in your colors" (thumbnails with palette bars), "Stories" (2-up cards), "A color to read" (plate cards).

### Museum painting page
- Hero: the image, full width, contain-fit on ground, tap to zoom.
- Floating ‹. A floating ↗ (the museum link) top-right, in place of the boxed "CHICAGO".
- Then: title in `title-1`, artist · year · place in `small`.
- **Palette:** the share-sized bar (6 plates, each `data-swatch`). Under it, 6 list rows: chip · **name from the 1,000-word list, capitalized** (Gunmetal, Denim, Slate) · share % in `code`. Tapping a row highlights its area on the image and opens the color sheet.
- The note, then "Similar palettes" (shelf), then collapsed "About this palette" (the computed-palette caveat) and "Image and data".

### The color sheet (one sheet for every swatch)
- A modal sheet at content height (≤ 70%).
  - Hero swatch, 140 h, `--r-1`.
  - The name in `title-1`, capitalized, with the hex in `code` beside it.
  - One line in `small`: "Closest of the 101: **Gunmetal** · darker, warmer ›".
- **Near names:** a horizontal row of 4 chips (32 px swatch, name). Tapping one walks to that color's sheet.
- **Actions:**
  - Primary (paper): "Open Gunmetal" if it's a taught color; for any other color, "Paintings with this color".
  - Quiet rows: "Learn it" (taught only) and "Copy #221C14".
- ΔE values and "Also called" sit behind a "Details" disclosure.
- The "New word" tag appears only for real names that aren't yet met. "Between X and Y" is a description, never a name: it shows as the `small` line, with the nearest real name as the title.

---

## 13. Design QA before every push
- [ ] 375 × 667 and 375 × 812: nothing clipped, nothing under the home indicator.
- [ ] Gutters at least 16 px. No bar, button or text runs edge to edge.
- [ ] One filled button per screen. No glass, blur or outline-only control on color.
- [ ] Judged swatches only on booth grey, with no overlay on them.
- [ ] Mono only on labels and codes.
- [ ] No empty section headings. No label repeating visible text.
- [ ] Back goes down exactly one layer.
- [ ] Reduce Motion: every move becomes a cross-fade.
