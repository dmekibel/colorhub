# Odd one out: the difficulty model (David, 2026-10-08)

"Levels should be ordered by how hard it is to see the distinction. One level can have many visualizations. Moving up a level only implies it's actually getting harder."

## Two axes, kept apart
- **Level** = perceptual difficulty only. One number: the gap (ΔE00, as drawn on this screen) between the odd tile and the rest. Nothing else changes between levels.
- **Layout** = how the board looks (squares, ring, honeycomb, strip, colored ground, hidden shape, flash, gradient field, painting...). Rounds inside a level rotate through the layouts you have met and never repeat one back to back. A layout is unlocked by sets played (`at`), never by level number.

## The ladder (20 levels, log-spaced)
Gap = 12 × (0.6 / 12)^(i / 19). 12, 10, 8.8, 7.5, 6.4, 5.5, 4.7, 4, 3.4, 2.9, 2.5, 2.1, 1.8, 1.5, 1.3, 1.1, 0.96, 0.82, 0.7, 0.6 (percent of black-to-white, `pctFmt`). Four worlds of five: Plain sight, A good look, Fine detail, The edge. About 1% is the smallest difference most people see side by side, so levels 15 to 20 are for sharp eyes on good screens. Level 20 is almost imperceptible.

## Calibration across layouts
A layout multiplies the drawn gap by its modifier (`ooLayoutF`: variant × board × size), so a level means the same perceptual difficulty in every layout: group shapes ×0.72 (many tiles pool), counting ×1.1, twins ×1.35, which-way ×1.3, mosaic ×1.1, gradient ×1.2, painting ×1.8, 5×5 and larger grids up to ×1.28, breathing ×1.1. These are priors, and the same factors divide the answer before the eye model learns from it, so the profile stays comparable across layouts. Twins and the tallest boards are not offered above a 6.5 gap (`gmax`).
Axis (lightness, vividness, hue) and base-color family are drawn at random each round; the model keeps a threshold per axis and per family, so the Your eye page reports "Sharpest: lightness in blues, level 17. Softest: hue in yellows, level 11."

## Passing
A level is 10 rounds; 8 right passes it (the set ends early once decided). Stars: passed, quick (median under 3.5 s), no hints.

## For you, Choose, Test out
- **For you** plays `st.you`: it starts at twice your measured threshold (level 1 for a new eye), rises one level on a pass (two on a clean 10 of 10) and drops one after a set of 5 or fewer at your level.
- **Choose**: Easy, Medium, Hard, Expert (levels 4, 8, 12, 16), **Edge of my eye** (the level at your measured threshold), or any level tapped on the map. Remembered per game in `S.games.oo.pref`.
- Every level is open. A level ahead of you offers **Test out**: 3 rounds at that gap, all right, and every level below counts as cleared. Stars still need playing.
- Chosen-level results update the same hidden estimate from the gap actually drawn, so the eye profile stays honest (tools/games_test.js checks that Easy-only, Hard-only and Edge-only players converge to the same threshold).

## Other games
Across the line, Painters' pairs and Whose palette? have no eye model, so each keeps an edge estimate (`ooEdgeUpdate`, same item-response update); Choose draws at estimate × tier. The Mix follows the Odd one out choice. Map study keeps its own bands: For you follows a per-level skill, Choose adds Expert and Edge, and Test out clears the levels below.
