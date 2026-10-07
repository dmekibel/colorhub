# Handoff, 2026-10-07

## Where things stand
- **v1 core loop is built and live.** It's a static site at the repo root (`index.html`, `app.js`, `app.css`, `data/colors.js`).
- Flow: welcome screen → how it works → 60-second placement → home → meet the unit → swipe deck → unit done. Daily spaced review starts the next day.
- **Curriculum:** 90 colors in 12 units. Tier 2 "The in-betweens" has 6 units (42 colors) and Tier 3 "The designer's vocabulary" has 6 units (48 colors). The 11 basics are used only in placement.
- **Self-graded deck** (David's call, 2026-10-07): name the color in your head, tap to check, swipe right if you knew it, left if not. Left-swiped cards come back after two other cards.
- **Spaced review:** everything from a unit is due the next day. A right answer on the first try moves the gap to 3, 7, 16, 35, then 90 days; a miss sends it back to tomorrow. Reverse cards (name to color) alternate in once a color has been recalled. A new day starts at 4am.
- **Progress** = names that are yours: picked or named right in an objective check (Pick it, Say it, Make it) a day or more after learning. Swipes are practice: they schedule reviews but never make a name yours. Swipe-only "owns" from before 2026-10-07 are kept and shown as "to confirm" until a check (js/pickit.js).
- **Placement** is objective: the name, four close shades, tap the right one; a tier is skipped only at 6 right before 3 misses. Skipped colors join reviews as "placed", first checked 7 to 13 days later.
- **Self-test** (off by default, About sheet): holds back 3 colors per unit and tests the unit blind at day 7 and 30. See research/SELF-TEST.md.
- **Design:** see `DESIGN.md` for every decision and its source.

## Data rules (`data/colors.js`)
- Each color has a name, a hex value, a neighbor, a line on how it differs from that neighbor, an optional origin, and a source for the hex (`css`, `wiki`, `xkcd` or `pick`).
- `node tools/check.js` is the gate. It fails if a neighbor is missing, if two colors in a unit are too close to tell apart (CIEDE2000 < 6.5), or if a line says "darker", "greener", "softer" and so on and the color math disagrees. Run it after every data edit.
- Changes made to the earlier color list: khaki uses CSS `darkkhaki`, because CSS `khaki` is a pale yellow. Duck egg, persimmon, heliotrope, bone, pewter, flamingo, cardinal, sapphire and seafoam were dropped because each was too close to another color.

## Local preview
- Run `node tools/serve.js 8791`, then open http://localhost:8791.
- On this Mac, Claude's preview server can't read ~/Documents. It serves a mirror in the session scratchpad instead, refreshed with `tools/sync-preview.sh <dir>`.

## Next steps (build order from PLAN.md)
1. David tests on his phone: Add to Home Screen, then one unit end to end. Set swipe feel, card size and map size by eye.
2. Eye-training gym: same or different (staircase), lighter or darker, warmer or cooler, sort the strip.
3. Stories: family stories, signature stories, iconic design colors pack.
4. Paintings: real Wikimedia images, exact 6-color palettes.
5. Paint mixing (Mixbox), palette archive, then accounts and sync.

## Open questions for David
- Should he be able to do more than one new unit per day? Right now he can (the "Next" button), and the review queue handles it.
- Should tier 3 grow to ~60 colors? There are 48 now, because every unit had to pass the "tell apart" gate.
