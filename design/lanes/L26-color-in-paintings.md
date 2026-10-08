# L26: Where a color lives in paintings: tolerance and coverage (David, 2026-10-08)

David: "When you find paintings of a color and click a painting, that color might not even be mentioned there. The palette ignores the color that brought you, because it might be a single pixel… We need different ways to analyse paintings to understand how this specific niche color applies… Exact matches is one list; allow a few % variation (choose how many: say 3%) and see the paintings that are almost that color; and whether a single pixel is enough or a larger part of the painting: also a slider. Within 3% of this color, covering 5% of the painting: how many paintings match? Then adjust the numbers."

## Build
1. **A finer index (offline).** The 24-color pools miss niche colors, so build a richer per-painting color histogram.
   - Where the image or thumbnail can be read (research/_raw caches; the museums on the CORS allowlist: NGA, Rijks, Met, SMK, AIC, CMA), compute a quantized Lab histogram (e.g. about 2,000 bins at ΔE ~3 resolution, sparse) with each bin's pixel share.
   - Where it can't, fall back to the 24-color pool and mark the painting `coarse`.
   - Write tools/color_index.py → data/colorindex/ shards (sparse, compact, lazy). Report coverage and sizes.
2. **The query.** `paintingsFor(hex, { tol, minCover, sort })`:
   - `tol` is % different (ΔE00 mapped through pctDiff, 0–15%).
   - `minCover` is the % of the canvas, from "any pixel" (0.01%) to 50%.
   - It returns the count plus a list sorted by coverage, by closeness, or by date, each with that painting's exact coverage % and closest match.
3. **The UI** on every color page's "In paintings" section, and on its own screen (`#/paintings-of/<hex>`):
   - two sliders, **How close** (exact … 3% … 10%) and **How much of the painting** (a single touch … 5% … half);
   - a live count ("412 paintings within 3% covering at least 5%");
   - presets: Exact, Close, Family; and Accent (a little, but vivid), Dominant (lots).
4. **Arriving at a painting** (`#/gallery/<n>?c=<hex>&t=<tol>`):
   - The palette always **pins the arriving color first**, with its coverage % and rank: "Your color covers 3.2% of this canvas, its 7th most-used color."
   - If the image's pixels can be read, an overlay lights up **where it lives** (a soft mask, a toggle), and you can tap through each region.
   - If it's coarse-only, say so honestly: "approximate: measured from a 24-color summary".
5. **Connections:** article field notes cite "paintings within 3% covering 5%+" (stated, with n). Map study and the painting games use it. Explore's Art feed uses the same sliders. The painter page shows "colors this painter used in at least X% of works."

Quality: the craft bar. Tests: the query is monotonic (looser tolerance → more paintings), coverage sums stay at or under 100%, and the arriving color is always pinned. Screenshot the sliders and an arrival with the mask.
