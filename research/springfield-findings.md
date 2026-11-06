# Springfield palettes: how a human curator picks and orders a strip (research, nothing ships)

Source: 14 usable screenshots of @springfield.palettes posts (10 of 24 were unrelated or cut off; frames are 4:3, 10 to 11 bars). Images and colors are copyrighted and live only in gitignored `research/_raw/springfield/`. Tools: `tools/springfield_parse.py` (frame and strip reader), `tools/springfield_analyze.py` (numbers below), `tools/palorder_compare.py` (render). n = 14 posts, so treat everything as indicative.

## Picking (our k=10 from `extract_pool` plus `glPoolPick` vs their strip)
- Mean over their colors of the nearest-of-ours dE2000: 6.8. Coverage (within dE 10): 70%. Reverse direction (ours to theirs): 7.4.
- Of the 30% they have that we miss, 88% already sit in our 40-color pool (nearest dE 4.6). So the extraction is fine and the loss is in the pick, not the pool.
- Their palettes are more saturated and lighter: mean L 45.7 vs 41.6, mean chroma 45.7 vs 39.5. Missed colors are mid-light (L about 50) and vivid (C about 45): flat cartoon fills that our share^0.6 x vividness rule drops for near-twins.
- They keep a wide lightness span (mean min L 17, max L 75) and one or two near-dark bookends, not near-white (flat cartoon frames have few whites). Spacing is slightly tighter than ours (mean nearest-neighbour dE 14.2 vs 15.7): they allow two or three close variants of a hue (a ramp) where we force distinctness.
- Takeaway: for flat or graphic art, relax the distinctness term and favor each major hue family getting 2 to 3 lightness steps.

## Ordering (tau vs theirs, direction-free; path length relative to their order, OKLab)
| candidate | tau | path |
|---|---|---|
| lightness | 0.33 | 0.99 |
| hue, fixed start | 0.28 | 1.25 |
| hue, best rotation | 0.40 | 1.12 |
| greedy nearest-neighbour (best start) | 0.38 | 0.80 |
| shortest Hamiltonian path, OKLab | 0.38 | 0.79 |
| shortest path, lightness weight 0.5 | 0.39 | 0.83 |
| shortest path, lightness weight 2 | 0.32 | 0.87 |
| hue families, alternating ramps | 0.34 | 1.04 |

No candidate reproduces their order (all tau 0.3 to 0.4). Reading the sequences by eye and by numbers: 58% of adjacent chromatic steps move hue forward, 62% stay within 30 degrees of hue. The rule seems to be a hand-built hue wheel: runs of one hue family, each a smooth light-to-dark ramp, with a joint to the next family chosen by eye, so it is about 25% longer than the shortest path (their path is 1.27x the optimum). Best single approximation: shortest path with lightness weighted 0.5 (hue neighbors stay together, ramps stay smooth, no visible jumps), started at the darker end. Hue-sort-with-rotation scores marginally higher tau but its path is 12% longer than theirs and jumps visibly on muted art.

## Prototype
`js/palorder.js` `palOrderGradient(hexes)` (exact DP, n up to 13, not wired in). Comparison on 8 real paintings: `design/mockups/shots/strip-order-compare.png`. New order reads as smooth ramps; current order (by area) looks random.
