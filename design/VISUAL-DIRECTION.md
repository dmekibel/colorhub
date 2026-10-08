# ColorHub visual direction (2026-10-08)

David asked for a design pass on the whole app: "visually as iconic as possible". He named four problems. Selected buttons turn white, and that's ugly. Button shapes are off. Everything should be sized for a phone and easy to tap. And "no ugly 90s menus".

This file sets the direction. The component and icon lane builds toward it, with tokens in CSS variables and in DESIGN-SYSTEM.md. Where this file and DESIGN-SYSTEM.md disagree on a visual token, this file is newer and wins. Navigation, motion choreography and screen archetypes stay as DESIGN-SYSTEM.md has them.

Files in `design/visual-direction/`:
- `current-app-1.png`, `current-app-2.png`: contact sheets of 21 screens as they are today, at 440x956.
- `a-night-gallery*.png`, `b-swatch-book*.png`, `c-prism*.png`: three directions, each shown on three screens (Home with its corner menu open, the top of a color page, and a game). Each has a triptych plus separate `-home`, `-color` and `-game` PNGs at 880x1912.
- `*.html` and `shared.js`: the source for the mockups.

---

## 1. Critique of the current app

**What already feels iconic (keep it and push it further)**
- **Color as the hero.** The Amber page is a full-bleed yellow with a 96 px serif name, and it's the best screen in the app. The painting page's proportional palette bar (34% · 28% · 11%…) and the Museum cover ("Cocoa / For you") are just as good. None of these could be mistaken for another app.
- **Instrument Serif at display size.** "Name the colors *you see*." and "New personal *best*." have an editorial, museum-label voice. It's the one typographic choice that's unmistakably ColorHub.
- **The bubble map.** A fisheye field of named color bubbles is a real signature. Nobody else has it.
- **The warm near-black ground.** At #0E0D0B, it lets every color read at its true value.

**What feels generic**
- **Train's 16-tile launcher.** Equal tiles with yellow line icons look like a template app grid, the opposite of "one hero" (CANON A4).
- **You and Settings.** List rows with chevrons and a stock toggle copy the iOS Settings app, with nothing ColorHub about them.
- **Mono labels on the color page.** Lowercase "the paintings" in Geist Mono over the stat cards reads like a developer tool, not a museum.
- **Outlined-pill chip rows.** The Learn sheet's "Flashcards · Quiz · Matching · Type it" and the map's "Learn these / Study the map" are the default web pill.

**What looks dated or broken (David's complaints, confirmed)**
- **White flips.** In the Colors sheet, the selected "100 Stage 3" and "All 100" turn into paper-white blocks. In Arrange, the selected "Bubbles" turns white and the hue-map tile gets a white frame. A light slab is the loudest thing on a dark screen, so the *setting* outshouts the *colors*. This is the single ugliest pattern in the app.
- **The corner and Rooms menus.** These are a ragged, right-aligned stack of pills of different widths. Each pill crowds a title, a subtitle and an icon, and the stack cascades over the map. This is the "90s menu": a dropdown cascade with no grid, no grouping and no edge.
- **Three type voices in one card.** Serif, sans and mono all appear in the same card on the color page, the Results screen and the Learn sheet.
- **Text below phone size.** Labels on the map's small bubbles are about 8 px. Train's subtitles are about 11 px. The explanation under Odd one out is about 11 px, which breaks "in-game text is never smaller than body".
- **Native controls.** The Learn sheet uses a stock blue checkbox, and the sliders are browser defaults. Those two controls alone make the sheet look cheap.
- **Trunk test.** On a fresh profile, Home and Learn are the same onboarding screen, and the 100-swatch grid at the top reads like a spreadsheet, not a map.

---

## 2. The identity: Night Gallery

**One sentence:** ColorHub is a dark gallery wall where color is the only bright thing, and every name is set like a museum label.

Five things make it recognizable at a glance:

1. **Color is the only light source.** The UI is warm near-black in three steps. Nothing in the chrome is brighter than the content, except one paper button per screen. A selection never turns white. Instead it lifts one step and takes the color of what you chose.
2. **The museum label.** Every *name* is in Instrument Serif: colors, paintings, rooms, titles. Every *control and number* is in Geist. One italic serif note per block gives the curator's voice ("Easy to mix up with").
3. **The bubble.** Circles stand for colors everywhere: the map, chip dots, the corner buttons and the room glyph. Squares (6 px) stand for *samples*: swatches, tiles and boards. You can tell a shape's role by sight.
4. **The color dot.** A small dot in the item's own color marks "current" or "selected": an 8 px dot on the Colors tile, the dot in a chip, the ring color on a chosen look-alike. It replaces white fills, checkmarks and blue highlights.
5. **A bubble becomes its page** (DESIGN-SYSTEM §8). This motion is the brand in motion. Keep it exactly as specified.

### Tokens

**Type: two families only.** Geist Mono is retired. Numbers use Geist with `font-variant-numeric: tabular-nums`.

| Token | Font | Size / line height | Use |
|---|---|---|---|
| hero | Instrument Serif | 112 / .84, −.045em | A color's name on its page |
| display | Serif | 72 / .86 | Deck names, room covers, big results numbers |
| title-1 | Serif | 44 / .98 | Room titles, game questions |
| title-2 | Serif | 30 / 1.0 | Sheet and menu titles |
| title-3 | Serif | 21 / 1.05 | Tile, chip and row names |
| note | Serif italic | 16–18 / 1.3, soft | One per block |
| ui | Geist 500 | 15–17 / 1.2 | Segments, button labels, meta lines |
| body | Geist 400 | 16 / 1.55 | Reading text |
| small | Geist 400 | 14 / 1.4, soft | Sub-labels; **13 is the floor**, and only under tile names |

Rule: a block never mixes more than two of these. Game text is never below 16.

**Radii: four.** They change from DESIGN-SYSTEM's 4/14/24.

| Token | Value | Use |
|---|---|---|
| `--r-tile` | 6 | Swatches, game tiles, palette bars. At 120 px, 4 px reads as sharp and cheap. |
| `--r-card` | 18 | Cards, menu tiles, stat cards |
| `--r-sheet` | 28 | Sheets and the menu panel (all corners on a floating panel) |
| `--r-pill` | 999 | Buttons, segmented controls, chips, corner buttons, search |

**Elevation: three surfaces, opaque, no glass.**

| Level | Fill | Edge | Shadow | Use |
|---|---|---|---|---|
| e0 | `--ground` #0E0D0B | none | none | Page |
| e1 | `--s1` #171512 | 1 px `--line` rgba(236,232,223,.10) | `0 -16px 48px rgba(0,0,0,.5)` | Sheets, menu panel, cards |
| e2 | `--s2` #201E1A | 1 px `--line-2` (.22) on floating controls only | `0 8px 24px rgba(0,0,0,.5)` | Corner buttons, tiles, chips at rest |

**Color roles on dark**
- Text: `--ink` #ECE8DF, `--soft` #A39E92, `--faint` #7C776C.
- Raised (selected): `--s3` #2B2823.
- Primary action: `--paper` #EFEBE3 with `--paper-ink`. One per screen.
- Feedback: `--good` #9AD4AE, `--bad` #F09A86.
- Identity: `--c` is the color of the current content. It's used for selection rings, dots and progress on that color's own page, never as decoration.
- Booth grey (DESIGN-SYSTEM §3) stays for neutral-ground drills.

**States: no white flips, ever**

| State | Treatment |
|---|---|
| Rest | `--s2` fill (or `--s1` with a `--line` edge for chips) |
| Pressed | Scale .96 and one step lighter (`--s3`), 120 ms, with a 4 ms haptic |
| Selected | `--s3` fill, a 1.5 px inset ring (`--line-2`, or the item's own color `--c` when it *is* a color), and a color dot. The text stays ink. Never a paper or white fill. |
| Disabled | Content at 40% opacity, same fill, no press response, plus a one-line reason in a note when it matters |
| Focus (keyboard) | 2 px ink ring, 2 px offset |
| Right / wrong | A ring in `--good` or `--bad` around the chosen tile, with a ground-colored gap between, plus the side-by-side pair (DAVID-MODEL P8) |
| Switch on | Track `--good`, knob `--ground`. Off: track `--s3`, knob `--soft`. |
| Checkbox | 24 px rounded square (radius 6); on = `--good` fill with a ground-colored tick. No native control. |

**Motion:** keep DESIGN-SYSTEM §8 as is.
- Press: 120 ms ease-out.
- Swap: 200 ms `cubic-bezier(.2,.8,.2,1)`.
- Sheet: spring 380/34.
- Grow: 420 ms `cubic-bezier(.32,.72,0,1)`. Shrink: 340 ms.
- Celebrate: 700 ms.

One addition: menu tiles stagger in at 20 ms each, rising 8 px. No bounce.

### Tap-size rules
- **44 pt is the minimum hit area** for anything tappable. A smaller visual (a 32 px chip dot) gets padding up to 44.
- **48 pt rows and segments. 56 pt** for corner buttons, the primary button and game answer buttons.
- **At least 8 pt between targets.** Map bubbles under 34 px aren't hit targets until you zoom in. Tapping a cluster zooms in; it doesn't guess.
- **Thumb zone:** primary actions sit in the bottom 40% of the screen (the menu panel rises from the corner, and Next sits at the bottom). Only Back, Close and status go at the top.
- **Bubble labels:** a label that would render below 12 px is hidden, not shrunk.

### Ten signature components

1. **Corner button.** A 56 pt circle at e2 with a 24 px line icon (stroke 1.6, round caps). Open, it becomes ✕ on `--s3`. Two per canvas screen: Rooms on the left, the menu on the right.
2. **Menu panel (replaces the pill stacks).** A floating e1 panel, inset 12 from the edges and anchored just above its corner button, radius 28. It has a serif title-2 and a one-line note, a 3-column grid of tiles (108 pt tall), and a search field at the bottom. It works like iOS Control Center, not a dropdown. Rooms uses the same panel with four large room tiles, each showing a live color preview.
3. **Row.** 56 pt tall, with a serif title-3, an optional Geist sub-label and an optional value on the right in soft text. A chevron appears only when the row navigates. A leading swatch is 32 px (a circle for a color, a 6 px square for a sample).
4. **Segmented control.** A 44 pt pill track at e1 with a 3 px inset. The selected segment is a `--s3` pill with a `--line-2` inset ring and ink text. The others are soft. Use 2 to 4 segments; with more, use chips.
5. **Chip.** 44 pt tall: a 32 px color dot plus a serif name, at e1 with a hairline edge. Selected: `--s3` with a 1.5 px ring in the chip's own color.
6. **Tile.** A `--s2` card, radius 18, with an icon or a mini-palette at top left and the name and sub-label at bottom left. Selected: `--s3`, a `--line-2` ring and an 8 px color dot at top right.
7. **Card (stat card).** e1, radius 18. A big serif number in display or title-1, a Geist sentence finding, and a proportional color bar (radius 3) underneath. "Measure, then tell" in one object.
8. **Slider.** A 6 px track at `--s3` with the fill in ink, or in `--c` for a color parameter. The thumb is a 28 px circle at `--ink` with a 44 pt hit area. End labels are Geist small. The live value sits beside it in tabular figures, and the result changes under the thumb (CANON A5).
9. **Swatch.** A 6 px-radius square for a sample, or a circle for a named color. A light swatch on dark (L* > 90) gets a `--line` hairline so ivory doesn't vanish. Tapping a swatch always opens its page.
10. **Results card.** A display-size serif verdict ("New personal *best*."), the before → after number in tabular Geist, the side-by-side pair of the hardest miss, one sentence, and one paper button.

---

## 3. Three directions

### A. Night Gallery (`a-night-gallery*.png`)
This is the identity above, built out. The dark warm wall, serif names, and the corner menu as a tile panel with the active "Colors" tile marked by `--s3`, a ring and an amber dot. The color page is a full-bleed amber hero with the 112 px name, a segmented control with a raised (not white) selection, look-alike chips ringed in their own color, and stat cards with color bars. The game is a 3x3 board with 6 px tiles, a serif question with one italic turn, the answer ringed in `--good`, the big side-by-side pair and a paper Next button.

### B. Swatch Book (`b-swatch-book*.png`)
A light paper canvas. The labelled color chip (a square with a white label strip) is the motif everywhere: the map is a field of chips, the menu is a grid of chip cards, and the color page is one giant chip. Headlines are Geist bold, controls are rectangles (radius 12), and tabs are underlined.
- Strengths: instantly legible, a strong "archive" feel, and great for sharing palettes.
- Weaknesses: on light paper, ivory, cream and pale colors disappear. It reverses the dark-ground decision of 2026-10-07. It reads close to a paint-chip company's trade dress. And it feels like a catalogue, not a place.

### C. Prism (`c-prism*.png`)
OLED black, Geist ExtraBold only, and the hexagon as the motif: a honeycomb map, hexagonal corner buttons, a radial fan menu and a honeycomb game board. Selection is a tinted glow. The color page has a glowing orb hero and Apple-Fitness rings for warmth, paintings and lightness.
- Strengths: energetic and game-like, and the honeycomb board is fun.
- Weaknesses: the orb is a gradient, so it doesn't show the *exact* color, which breaks "grounded and honest". Hexagonal buttons have smaller hit areas than circles of the same size. The glows and rings are the house style of a hundred fitness apps, so it reads as vibe-coded. And losing the serif loses the museum voice.

### Recommendation: A, Night Gallery
- **It's the only one that's already ColorHub.** It keeps what works (color heroes, serif names, the bubble map, the warm ground) and fixes exactly what David named: no white flips, a real panel instead of a pill cascade, one shape grammar, and 44/56 pt targets.
- **It's the most honest about color.** It's a flat true-color hero on a neutral wall. Pale colors keep a hairline, and nothing glows or tints the sample.
- **Color stays the brightest thing on screen,** which is the whole philosophy ("see the whole world through color").
- **It's the cheapest to converge.** It's mostly a token change plus four new components (menu panel, chip, checkbox and switch, slider), not a rewrite.
- **It passes the Duolingo and Apple benchmark** without imitating either.

Borrow two things:
- From B, the **labelled chip** as the share card and the palette-archive export: color block above, paper label below. This is what leaves the app.
- From C, the **honeycomb board** as one *variant* of Odd one out at higher levels. More neighbors per tile makes it harder, and it's built from bubbles, not hexagonal buttons.

---

## 4. Converge in this order

1. **Kill every white flip.** That covers the Colors sheet (stage and family), Arrange (looks and arrangements), the Learn sheet's "Just one way" chips, and the selected-tile frames. Apply the Selected state from the table.
2. **Replace the corner menu and Rooms stacks** with the menu panel (component 2).
3. **Retire Geist Mono.** Numbers move to tabular Geist, and the mono labels on the color page become italic serif notes or go away.
4. **Build the custom checkbox, switch and slider.** No native controls remain.
5. **Enforce minimum sizes.** Hide map labels below 12 px. Train sub-labels go up to 13 and game text up to 16. Every hit area is at least 44 pt.
6. **Move radii to 6/18/28/pill and surfaces to e0/e1/e2 plus `--s3`.** Snap every one-off value.
7. **Rework the screens that are still generic:** Train's launcher into a hero plus groups, You and Settings rows into the Row component with leading swatches, and the fresh-profile Home into a real map.

Every lane with UI checks itself against this file and design/CRAFT-RUBRIC.md, with 440x956 screenshots of every state, before merge.

## Decision (2026-10-08)
David picked **A, Night Gallery**. It is now the app's visual direction and overrides DESIGN-SYSTEM.md where they conflict.
