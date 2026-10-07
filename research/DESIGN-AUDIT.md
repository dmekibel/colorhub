# Design audit, 2026-10-07

Every main screen captured at **375 × 812** in headless Chrome. The app ran inside an exact 375 px iframe, because headless Chrome won't lay a window out narrower than about 500 px. Without that, every screen looks clipped on the right: an older screenshot setup at 390 px may have been misleading too. Captures are in `design/audit/` (600 px tall copies). The sheet (`02`, `03`) was shot on `main` at 831686a. The home (`01`) and the view panel (`04`) were shot at 2af8f12, which had the Edges ("Watch") lens; main has since gone back to the round fisheye as the default (4822dd6). Everything else was shot on c4929a8.

This audit is blunt by request. It's ranked by impact. **Severity:** P0 makes the app feel broken or like two apps. P1 is visibly weak on every visit. P2 is polish.

---

## The ten that matter most

| # | Problem | Where | Sev |
|---|---|---|---|
| 1 | **Two apps in one.** The honeycomb home has no tab bar. The rooms all have one, and in it the tab called **Today** leads back to the honeycomb. The sheet's **Learn** door opens the *classic Today screen*, with "Today" lit in the tab bar, so one screen has two names. The way home from Train, Explore and Studio is the brand logo (hidden). Deep "Home" buttons after a deck go to the classic Today screen, not the honeycomb. So there are three "homes", and none of them is named Home. | home.js, core.js `go()`, `tabHead`, learn.js `home()` | P0 |
| 2 | **Learn it has no gutter, five layouts and a rule break.** Its screens reuse the `.meet` class, whose `padding:0` removes the side gutter. The ✕ sits at x=0, the "Next" text touches the left edge, and the Next bar runs edge to edge (`10-learnit-meet`). Each of its five steps has a different layout. The **Sort** step breaks the product rule ("thinky exercises live in the gym, never in the flashcard loop"). | learnit.js, home.css `.lt-*` | P0 |
| 3 | **Learn it's progress and ending are broken.** The five step dashes look identical on grey (`.on` = ink, `.now` = soft ≈ the same near-white on #5F5F5F). The finish screen's color fan collapses into **one** bar, because `.lt-done .fan i` inherits meet's absolutely positioned, rotated `.fan i` rules (`10-learnit-done`). The lesson also jumps from booth grey to warm black on the last screen. | home.css, app.css `.fan` | P0 |
| 4 | **See-through and outlined controls on color.** David rejected glass, but it's still there: the color page's "Learn it" is a hairline-outlined pill over the swatch (white outline on salmon is nearly invisible: `09-color-salmon`), the camera's top pills are frosted glass (`35-camera`), and the tab bar uses `backdrop-filter`. `.glass`/`.glass-pill` are still live classes. | app.css, home.css, camera.js | P1 |
| 5 | **Nerd data comes first on the color page.** Under the hero come a four-column HEX / RGB / HSL / CMYK grid (values cut off: "250 128 1…", "180° 100%…") and a 4-line CMYK disclaimer in mono, all before the one-line difference or the story. Tier-4 depth is shown as tier 1. | explore.js `colorPage`, `.codes` | P1 |
| 6 | **Four header patterns.** Tab homes: brand plus ⋯ over a hairline. Articles: ‹ plus a **boxed** "More like this". World pages: ‹ plus a centered mono title ("DECADES"). Gallery: ‹ plus a boxed "CHICAGO", repeated by a second "See it full size at the museum" link. Lessons: ✕ plus dashes. The boxed outline buttons exist nowhere else. | `artTop`, `navTop`, `tabHead`, gallery.js | P1 |
| 7 | **Mono used for sentences.** Mono should only label and code, but here it carries the CMYK paragraph, "Computed by ColorHub, not by the museum…", "Close to Black and Gunmetal · read their stories" (15 px mono in the color sheet) and the station-result footnote. Long mono reads like an error log and fights the serif. | `.fine` everywhere | P1 |
| 8 | **Dead space and empty sections.** On the color page, "Kin" opens onto nothing, "In paintings" is a bare text link, "Connections" is a heading with nothing under it, and the scroll ends in roughly 600 px of black (`07-color-teal-s2`, `08`). The gallery page shows 2 of 6 palette rows, then a blank band (`32`). Explore › Colors shows one card, then nothing. | colorPage, gallery.js, explore.js | P1 |
| 9 | **Two different color sheets.** Honeycomb library bubbles open `colorSheet` (colorsets.js); every other swatch opens `nameSheet` (swatch.js), with a different hero, list and actions. nameSheet labels "between black and gunmetal" a **New word**, though it isn't a word. Painting palettes say "between brown and umber" and "greyish charcoal" (lowercase), against the rule of giving the most precise name ("salmon pink"). The ΔE numbers in every row are tier-4 data. | swatch.js, colorsets.js, gallery.js | P1 |
| 10 | **Today's sheet mixes jobs.** Its top row is the *view chooser and search* (honeycomb controls) and not Today. The doors are the only outlined boxes in a no-box system. "GO · CAMERA · SURPRISE ME" are 11 px mono links. At full height a third of the sheet is empty (`03`). The view chooser itself fills the whole screen (`04`), so you can't see what a view does while you choose it. | home.js `hmRenderBody`, `chooser` | P1 |

---

## Screen by screen

### Home: honeycomb (`01`), sheet (`02`, `03`), view chooser (`04`)
**Works:** this is the most iconic screen in the app. It's full screen, with the two solid corner buttons under the thumbs, and the round fisheye gives it a real center. The eased vignette on main is softer than before.
**Weak:**
- The bubble names are light text at reduced opacity, so they fail on mid-tone bubbles (Teal, Petrol, Slate, Cerulean read at about 2:1). Use ink chosen per bubble (`ink()`, dark or light) at full opacity, and fade only the outer bubbles.
- The vignette is still only darkest along the four edges, and the corners don't compound. Spec in DESIGN-SYSTEM §Canvas.
- The lens: main now has the round fisheye as the default, with Edges as an option. The View panel still covers the whole screen, so you change the lens blind. Spec in DESIGN-SYSTEM §View panel.
- The sheet's three detents aren't labeled, so nothing tells you that "mid" is Today and "full" is the doors.
- The view chooser: "honestly, off your own reviews" is an odd caption. The stage tiles are bordered boxes, each holding just a number. "Character" is cut off at the fold.

### Classic Today, opened from the "Learn" door (`43`)
**Works:** the "8 to recall" headline, the plates and one ruled CTA make this the clearest screen in the app. Today's three is good.
**Weak:** its name (see #1). The tab bar covers the collection count ("27 6" is cut off at the bottom). The brand row adds nothing here.

### Color page (`05`–`09`)
**Works:** the big serif name on a large swatch. The compare strip with the nearest neighbor. A real photo (the teal duck) with a credit.
**Weak:**
- #4, #5, #8.
- The status eyebrow wraps over two lines in caps ("NOT LEARNED YET · UNIT 1 · IN-BETWEENS").
- "LOOK-ALIKES ↗" is a label placed *under* the strip it labels.
- The hero takes 50dvh with the name at the bottom, so the first screen holds no reading at all.
- The "More like this" box competes with Back.
- There is no single primary action. Learn it should be the one filled button.

### Learn it (`10-*`)
**Works:** the idea. The Pick it step (`10-learnit-pick`) is the only step that feels like "our old flashcards": the paper name card above four look-alike swatches.
**Weak:**
- #2 and #3.
- Meet shows a 300 px square floating on grey with centered sans text: a different look from the meet pager it claims to copy (`17-meet-page`).
- Tell apart mixes five cerulean tiles with one teal tile, too easy for a "tell apart". With six tiles in a 3×2 grid it looks like a drill, not a card.
- Sort shows names on the chips (so it tests reading, not seeing), and the names are in sans.
- Memory puts five tiles in a 3-column grid, which leaves a hole.
- Done: a collapsed fan, then a 30 px italic sentence that runs five lines.

### Meet pager and swipe deck (`16`–`19`)
**Works:** these are the best screens in the app, so keep them. Full-bleed color, the name inside the swatch, the compare strip, a big serif "diff" line, the paper label sliding up, ✕/✓ under the thumbs.
**Weak:**
- The cover's fan ends in paper chip-feet, which is the paint-chip motif David rejected, and it's clipped at both edges.
- The segment bar is near-invisible on grey (rule at .24 white).
- The deck shows a desktop "space" key hint on phones.
- "About coral" on the paper label is too faint to read.

### Train: home (`20`, `21`), drills (`22`, `23`), result (`24`)
**Works:** the suggested-station hero with its level ladder. The 2-up station tiles with flat illustrations. The drills use big tiles on booth grey.
**Weak:**
- The 68 px "Train" title costs about 120 px to show a word the tab bar already says.
- The "Your eye" rows cut off their labels ("WHICH IS LIGH…").
- Each drill opens with an eyebrow that repeats the title ("WHICH IS LIGHTER?" / "Which is lighter?") plus a research paragraph (CIEDE2000, "Albers… 60%") right where you judge.
- The result screen mixes six text styles (yellow mono, serif, sans, mono caps, a rule-quote, mono fine print) and three buttons.

### Explore (`25`–`30`)
**Works:** For you's color plates and the World tiles (Decades, Color of the year) have real editorial energy. The Paintings shelf with its palette bars is good.
**Weak:**
- Six lenses overflow at 375 px (World is off-screen, with no fade), against the ~4 rule.
- The Colors lens repeats the home (a honeycomb card with unreadable text on the bubbles).
- For you's eyebrows read strangely ("Yellow · C. 15,000 BCE").
- "Ideas" opens with a ruled table of contents before any content.
- The 68 px title again.

### Museum painting (`31`, `32`) and the color sheet (`33`)
**Works:** the palette bar sized by share is a strong idea, and so are the "Similar palettes" shelf and the honest note on the computed palette.
**Weak:**
- The image sits at half width (the AIC 200 px copy) beside a link.
- The boxed "CHICAGO" button repeats that link.
- Names are lowercase ("between brown and umber").
- The rows carry "also called … Werner, 1821 · your word:" (three facts per row).
- There's a blank band after row 2.
- The sheet: see #9. There are two near-name lists (nearest 1,000 and look-alikes among the 101), and Gunmetal appears in both.

### Studio (`34`) and camera (`35`)
**Works:** Studio is calm, with three tools and one big hero. The camera has a real shutter, a reticle and a big name.
**Weak:** the camera's glass pills ("POINT AT ANYTHING", WB, back). In Studio the 68 px title again, and the empty "From a photo" tile is a grey box with an icon.

### World pages: fashion (`36`), botany (`37`), gems (`38`)
**Works:** the fashion decade page is the cleanest article in the app: a palette band, then ruled rows (swatch · name · hex), then the prose. Gems has a great photo and a fact grid.
**Weak:**
- The botany title repeats three times ("Periwinkle (Vinca minor / major)" as the title, the "named after" fact and the caption).
- The botany hero is a short swatch band with a mono label.
- British spelling ("colour", "coloured") clashes with the rest of the app.
- Three header styles across the three sibling pages.

### Welcome and placement (`39`, `40`)
**Works:** the wall of colors is the product's promise in one image. The placement explainer is clear and Duolingo-like. Keep both.
**Weak:** the "Find my level · 60 sec" row is a ruled text row, so it doesn't look like a button for a first-time user. This is the one place a filled primary matters most.

---

## Cross-cutting

- **Too many type styles.** The CSS has 50 distinct `font:400 <size>` serif declarations (many of them `clamp()`), plus mono at 9.5, 10, 10.5, 11 and 13 px. The fix: one scale with 7 serif and sans steps and 2 mono steps (DESIGN-SYSTEM §Type).
- **Too many radii.** The CSS uses 0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 18, 20, 22, 24, 30, 99 px and 50% (74 uses of 2 px alone). Use four (§Radii).
- **Gutter drift.** The gutter is 22 px in most places, but 0 in Learn it, 12 in the search field and 16 on the corners. Use one 20 px gutter, never under 16.
- **Buttons.** There are four primary styles: the ruled serif row (`.btn`), the paper solid (`.btn.solid`, almost never used), the pill outline (`.c-learnit`) and the round outline (`.act`). `.btn solid` appears exactly once in js/ (gallery.js), and no main screen has a filled primary button, so "one filled button per screen" (DESIGN.md rule 1) isn't actually being followed.
- **Booth-grey legibility.** On #5F5F5F the white tokens (ink .96, soft .88, faint .84) are too close together. On, now and off states and secondary text all look the same.
- **Dead ends.** The Learn it "Done" screen leads to the color page or the honeycomb, never to Today. A finished drill leads to "Back to Train", but there's no route home except the logo.
