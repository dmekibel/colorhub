# L16: Explore 2.0: browsing 23,531 paintings without getting lost (David, 2026-10-08)

David: "It's easy to get lost. If we have thousands of paintings we need ways to organise them, filter them and go through them without one giant long list you'll never reach the end of. The Art section of Explore is very unorganised: a giant list, colours on top you scroll through. It's not convenient to reach a specific colour… we need a much more clever system of organising this information and giving people access depending on filters."

Also read: design/IDEAS-10X/explore-art.md (★ Decade River, Life Strip, looks as recipes, colors with a job, twins across time), design/lanes/L26-color-in-paintings.md (the tolerance and coverage query; reuse `paintingsFor`), the CLAUDE.md craft bar, and DESIGN-SYSTEM.md.

## Build
1. **Reaching any color in 2 seconds.** Replace the long bubble row with:
   - a **color dial**: a compact hue ring × lightness, where you drag to any color and the nearest name shows live;
   - **type a name** (search across all ~3,700 names and aliases);
   - **"from my photo / camera / favorites"**;
   - recent colors.
   The chosen color uses L26's two sliders (how close, how much of the painting).
2. **Facets as chips with live counts**, combinable:
   - color (with its tolerance and coverage);
   - **when**: a century or decade range scrubber;
   - painter (search);
   - movement, country, museum;
   - **mood**, computed: light or dark key, muted or vivid, warm or cool, high or low contrast;
   - palette size (minimal ↔ rich).
   Active filters show as removable chips with the count ("1,284 paintings"). Zero results suggests the nearest loosening.
3. **Views, not one long list:**
   - **Grid** (default) with sticky section headers (by decade, painter or color closeness) and a **jump bar** (an A–Z / decade index on the edge, iOS-style).
   - **Timeline / Decade River:** scrub through time, where each decade shows its distinctive colors and paintings.
   - **By painter:** painters as rows with their Life Strips; tap to open.
   - **Wall:** a dense mosaic of the filtered set, sorted by hue, a beautiful overview to zoom into.
   Sort by most of this color, closest, date, or random ("shuffle").
4. **Smart collections** (rooms) as entry points: "Blue before 1700", "Monochrome masterpieces", "The loudest reds", "Twins across time", "Paintings in your favorite colors", "The Unpainted (colors no painting reaches)", and aesthetics as recipes.
5. **Never lost:** a breadcrumb of your filters; save a filter as a room; Back unwinds one filter at a time; a count is always visible; paged sections ("Show 60 more"), not endless scroll.
6. **Connections:** every painting tile → the painting with your color pinned; "on the map" (csOnMap) for the filtered set's palette; "learn these colors" (prInstantDeck); painter → painter page; filters can come from the Learner Model ("colors you're learning").

Quality: the craft bar plus a CRAFT-RUBRIC self-score. Performance: filtering 23,531 paintings is instant (precomputed facet indexes; lazy shards). Tests: facet counts are consistent, combined filters intersect correctly, the jump bar maps to sections. Screenshot every view and the dial at 375×812.
