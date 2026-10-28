# UX backlog, decided with David 2026-10-28 ("whatever you recommend")
Build order: 1 palette page, 2 navigation, 3 painting page layout, 4 mockup check on real screenshots (440x956, 375x812, desktop; one wide and one tall painting) before each ships.

## 1. One Palette page (replaces the full-screen palette view and the pair page)
- Top: large swatches with name and hex; the magnifier button moves out of the swatches into a row under them (it covered the "Aa" text).
- Main: endless feed of paintings, tightest match first, then looser, never ends (auto-relaxes how-close and how-much); a thin "Looser matches" divider at each step; beauty as tie-break; caption says why it matched.
- Below: "The colors" list (each opens its color page), "How they relate" (collapsed), keep/share/play row, add or swap a color live.
- How close / How much sliders go behind a settings button; no "Nothing this close yet" state.
- Same page for a painting's palette, a saved palette, a pair, a single color.
- ENTRY FLIP (David confirmed): tap the palette strip under a painting = whole palette page; press and hold a swatch = that color's page. Overrides the 2026-10-08 "one tap on any color opens its page" for strips; palette page lists each color.
- Press-and-hold the whole strip idea is dropped in favor of the flip above.

## 2. Navigation
- Places button bottom-left on EVERY page (hides on scroll down, returns on scroll up); sheet has Explore first and Settings as a row.
- Map + settings round buttons bottom-right (as on the feed). Top: back arrow only.
- Map opens Explore with the same filters (years, color family, painter, movement carried; map-only filters dropped with a one-line note).
- Dropped: multi-step swipe back, feed glyph, tab re-tap.

## 3. Painting page
- Heart far left of the title row (fixed x, not on the image), share on the right of that row.
- Image tools (Pick a color, Look closer, Where each color sits, Select, Value and squint) appear in a tray when the image is tapped; one-time hint. Three-dots menu emptied: "Go" rows (museum full size, play, painter's others) go under the title.
- Eyedropper preview square shrunk on phones (done in css/eyedrop.css, unverified, ships with next ?v= bump).

## 4. Art
- Ukiyo-e: in the main archive tagged "woodblock print" + its own board; include-prints switch in settings.
