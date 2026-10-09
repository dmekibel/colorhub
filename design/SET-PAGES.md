# Set pages: a page for every pair, trio and palette

David, 2026-10-08: "Like a page for every color, have a page for every color pair... then the same for three
colors, any number of colors, a whole palette." Plus: "suggest how to improve it, subtly or not so subtly."

## Getting there (js/settray.js, prefix sx)
- **Pair with…** sits under the hex on every color and name page (one hook, `sxPairBtnHTML`, one line in
  js/richpage.js). It opens the **picker sheet** anchored on that color.
- **Long-press any swatch** in the app (anything with `data-swatch`) adds it to the set; a plain tap still opens
  its page (the one-tap rule is untouched).
- **The picker sheet**: the anchor on top, then rows of suggestions, each one tap: *Its harmonies* (complement,
  the triad, the neighbors, on the perceptual wheel), *Painters pair it with* (the affinity table), *Look-alikes*,
  *Your colors* (favorites), *Recent* (the trail); a search box over all ~1,000 names; and *Any color* (the ring
  picker). One tap adds the color and opens the page.
- **The set tray**: a small pill at the foot of every screen while the set holds colors (chips, count, Open, ✕).
  It persists (S.setTray), so you can browse and add from anywhere. Hidden on the set page itself.

## The pages (js/setpage.js, prefix sp)
One screen, `spPage(hexes)`, two shapes:
- **Pair** `#/pair/<a>+<b>`: two big plates side by side, each with a sample of the other as text. Then
  *How they relate* (% apart, lightness, hue angle and the wheel's name for it, which is more vivid, warm/cool,
  the contrast ratio and what it is readable for), *Together in paintings* (the count, the lift with n and
  "as photographed", the peak years, painters, movements, a rail of the paintings, all of them one tap away),
  *In design* (the design-history index) and *Closest looks* (fashion/film/design eras).
- **Set** `#/set/<a>-<b>-<c>…` (3 to 8 colors): the palette strip at the proportions painters used it (the mean
  coverage in the paintings that hold all of it; equal widths when none), *Harmony* (nearest scheme and how far
  off, lightness range, chroma range, warm/cool count, the closest pair), *Pairs inside* (every pair's lift; the
  strongest and the weakest), paintings (closest as a palette, plus all-of-them with lift), design, looks,
  *Complete the palette* (painters' choice from co-occurrence; theory's choice fills the hue gap), and **Improve**.
- **Improve**: Subtle · Clear · Bold. Up to four suggestions that the numbers call for: separate a too-close pair,
  spread the lightness range, unify temperature, snap hues to the nearest scheme, calm all but one accent, swap the
  weakest color for one painters pair with the rest, and nudge toward the top painter's habitual colors. Each shows
  before/after strips, a one-line reason with the measurement, and every changed color as name before → after with
  % change. Apply updates the page (and the address); Undo puts it back.
- Actions on both: Learn these (prQuick), Keep (keepPalette), Share (share card), Add a color.

## Rules
- Address: the colors in the order they arrived or were dragged to (David, 2026-10-09 — order is now a feature,
  not canonicalized away). A 2-color `#/set` opens the pair; a 3+ `#/pair` opens the set.
- Honest minimums: no lift claim under 5 paintings; "a curiosity, not a trend" under 15; never "ever" or
  "always"; every painting number says *as photographed*; the wheel is CIELAB hue, not a painter's wheel.
- Paintings queries take at most 5 colors (the index); a bigger set is measured on its 5 most distinct colors and
  says so.
- One tap on any color opens its page; every pair row opens its pair page; every painting opens the painting.
- Removing a color works at any count: 3+ removes down and offers Undo; removing the second of a pair lands on
  the one color's own page (calmer than opening a picker sheet right after a delete), with "Removed X · Undo".
- **Reorder (David, 2026-10-09):** a set of 3+ can be dragged into a new order — a handle on each row in *The
  names*, or press-drag a segment of the big strip. The new order is a fresh address (push:false, replaces).
- **Together in paintings never shows a noisy near-miss as if it mattered** (David, 2026-10-09: "sooner or later
  something will match" if you loosen enough, so the looseness has to be explicit and chosen, never silent).
  Two sliders — Closeness (ΔE, worded "near-exact/close/loose/very loose") and Minimum share of the canvas — and,
  for a palette of 4+, a third: "Holds at least N of M" (default N=M). Every result genuinely holds that many of
  the colors at that closeness and share; nothing is shown just because it's the least-far-away thing available.
  Empty at the current settings says so plainly, with one tap to "Loosen until something matches" (steps
  Closeness and Minimum share first, then N for a bigger palette, and says exactly what it loosened). A 4+
  result card shows small dots, filled for each color it holds.

## Update 2026-10-08
- **Tray**: only while building. Opening the set page consumes it, two screens without adding clears it, ✕ clears it.
- **Improve**: minimal moves (a pair usually changes one color); per-suggestion color locks; "Teal → slightly lighter teal (+8% lightness)"; the After strip lights only what moved; non-Bold suggestions never rebuild the whole palette.
- **Learn**: pins the set's colors and offers look-alikes (design/STUDY-FLOW.md §5).
