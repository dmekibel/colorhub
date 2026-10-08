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
- Canonical address: colors sorted dark to light (L*, then hex), so the same set is always one URL. A 2-color
  `#/set` opens the pair; a 3+ `#/pair` opens the set.
- Honest minimums: no lift claim under 5 paintings; "a curiosity, not a trend" under 15; never "ever" or
  "always"; every painting number says *as photographed*; the wheel is CIELAB hue, not a painter's wheel.
- Paintings queries take at most 5 colors (the index); a bigger set is measured on its 5 most distinct colors and
  says so.
- One tap on any color opens its page; every pair row opens its pair page; every painting opens the painting.
