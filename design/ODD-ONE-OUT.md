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

## The gap metric (2026-10-09: "choosing super hard still gives really easy questions")
CIEDE2000 divides chroma differences by 1 + 0.045 C, so on big, glowing, saturated screen tiles a vividness move at "1.1%" was obvious (ΔE76 3.5) while a lightness move at the same 1.1% was hard (ΔE76 1.4). About a third of every chosen level was easy. The game now draws, scores and shows every gap with `ooGapDE`: CIEDE2000 with the chroma slope ×0.15 and the hue slope ×0.5, so the three axes look equally hard at one level (games_test: ΔE76 medians within 25%). The novelty ease (×1.6 for a new layout) is gone from sessions: a chosen level is drawn at exactly its gap from round 1. Old eye-model numbers carry over and re-settle within a session.

## Sessions: Classic or Shuffle, For you or Choose
- **Classic**: one square grid all session, Grid slider 2 × 2 to 16 × 16, Odd tiles slider 1 to 4 (find them all), live preview on the setup. Grids above 4 × 4 get the small-tile modifier (`ooSizeF`, up to ×1.45 at 12+). **Shuffle**: the rotating layouts above.
- **For you** starts three levels below your last edge (`ooSessStart`), or four below your measured threshold, or level 1. **Choose** is one Level slider; a tap on the ladder starts there too. Test-out is retired (the staircase climbs past what you already see in a few rounds).
- **The staircase** (`ooSess`, `ooSessStep`): 30 rounds, Keep going adds 10. A whole level per right answer until the first miss, then +½ level per right and −1½ per miss: Kaernbach's weighted staircase, which settles at 75% right. The level is continuous (gaps log-interpolated between levels). A level meter under the question shows where you are on the 20 levels and the gap ("1.4% apart"); a new level is a moment with the level-up sound.
- **The end**: "Your edge today: 1.4%" (the mean level at the turning points, first two dropped), level, against last time, the climb drawn round by round with the edge dashed, right %, highest level, streak, smallest spotted, misses. The highest level answered right gets its first star; the levels below count as cleared.
- Names go on the tiles after an answer (odd tile: its name and the direction; the nearest plain tile: its name) when tiles are 84 px or wider. Nothing auto-advances: Next, or a tap on the board.
- tools/games_test.js §9: the gap metric, Choose Expert / level 18 round 1 at the level's gap on Classic 3/8/16 and ring/honeycomb, Classic boards with k odd tiles, and 80 simulated sessions per observer landing within a level of their 75% point at 73–75% right.

## Passing (the Mix and extras)
Stars: passed, quick (median under 3.5 s), no hints.

## For you, Choose (other games)
- Chosen-level results update the same hidden estimate from the gap actually drawn, so the eye profile stays honest (tools/games_test.js checks that Easy-only, Hard-only and Edge-only players converge to the same threshold).

## Other games
Across the line, Painters' pairs and Whose palette? have no eye model, so each keeps an edge estimate (`ooEdgeUpdate`, same item-response update); Choose draws at estimate × tier. The Mix follows the Odd one out choice. Map study keeps its own bands: For you follows a per-level skill, Choose adds Expert and Edge, and Test out clears the levels below.
