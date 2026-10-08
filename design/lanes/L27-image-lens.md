# L27: The image lens and deep analysis for any image (David, 2026-10-08)

David: "For a painting or an image you uploaded, slide around it with your thumb like a color picker, and the app shows which color you're on and instantly names it, above or below your thumb… And the same deep analysis of paintings should apply to any uploaded image: statistics… a clever way to process this color data."

Depends on L13's shared patch sampler (Isolator), so start after L13 merges. Read design/IDEAS-10X/studio.md (Twins with threads, Isolator), ROADMAP §15, research/ANALYSIS.md, tools/analyze.py, and the CLAUDE.md craft bar.

## 1. The lens: thumb naming, on every image (photos, the frozen camera, paintings whose pixels can be read)
- **Touch and slide:** a loupe floats **above the thumb**. It flips sideways near the top edge, so it's never under the finger. It shows a magnified patch, the sampled color (averaged over a small radius, with a size you can adjust: a pixel, a dab, an area), its **name + % match**, and a faint second line with the next name and a direction word ("toward teal: bluer").
- **The name only changes when you cross a boundary,** with a soft haptic tick, so you feel the edges between color words as you slide. Hysteresis stops it flickering.
- **Lift to pin:** the pin drops a numbered chip, and pins collect into a palette strip along the bottom: save, learn these (prInstantDeck), on the map, open any as a page.
- **Modes:** Name (default), Squint (value only), Isolate (the patch on neutral grey; the Isolator's guess-first if on), and "Where else": the same color highlighted across the whole image as a soft mask.
- **Exactness:** sample in linear light, and show "as photographed / camera white balance" caveats where they apply.

## 2. Deep analysis for any image: the same engine as paintings, client-side
- Port tools/analyze.py's per-painting metrics to js/imageanalysis.js, and run them in a worker so the UI never freezes:
  - **Palettes:** the 24-color pool and its shares, accents, lights / mids / shadows, warm vs cool, hidden colors, focal color.
  - **Measures:** value key, contrast, chroma bands, hue histogram, gamut, effective color count, and harmony fit.
- **Percentiles vs the archive** (ship a small archive-distribution summary JSON), e.g. "more muted than 84% of paintings here".
- **Closest in the archive** (L13's glSimilarPal): the nearest paintings, painter, decade and movement by palette, with named color-to-color threads, and honest "nothing close" results.
- **Findings in words,** gated (at most 3 that are surprising and valid), with honesty rules.
- **Views:** value only (squint), posterize to N, chroma map, temperature map, hue only, and the mask of any color.
- The same component powers painting pages (pixel-exact where the image can be read), so paintings and photos share one analysis UI.

## 2b. Closest painting by any metric (David)
From a photo or any painting: the closest paintings by overall palette, dominant colors, accents, mood (key, chroma, warmth, contrast), light structure, one chosen color, or layout (a 4×4 spatial grid, only where the image can be read). L13 builds the search; L27 adds the layout metric from its image buffer and puts the metric chips in the analysis screen.

## 3. Connections
Saved photos get their analysis stored, become ColorSets with every verb, and feed the Learner Model ("words you didn't have": unnamed colors in your photos become next words). Uploaded-photo results can rank against "your own photos" over time.

Quality: the craft bar. Lens performance: 60 fps on an iPhone (precomputed downscaled Lab buffer). Tests: sampler correctness in linear light, boundary hysteresis, the worker's analysis matching analyze.py on 5 paintings within tolerance. Screenshots: lens mid-drag, pins, modes, the analysis summary, and views.
