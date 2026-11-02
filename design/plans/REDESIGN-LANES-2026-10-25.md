# Redesign lanes, 2026-10-25 (game plan by Opus, built by Sonnet)

The color page is done and live (main, ea71d30aa). These lanes carry the same shape to the painting and painter pages, then desktop.
Mockups David judged: https://claude.ai/artifact/XAbh1Az1D1mTz6zr1b5GSP . Plan page: https://claude.ai/artifact/7ynxP7ZXpX27YbhWggquFe .

## The shape every page now shares (copy it, don't reinvent it)
- **Hero** (the color / the painting / the painter), then **one sticky chip row** right under it.
- The first chip is **Overview**: the page's reading content (sections, analysis, story). Every other chip is an endless
  **feed** (js/feed.js `fdMount`). The chip row is the page's spine; there is no second row of buttons above the pictures.
- **Arrival rule:** opened from a feed tile, the map or a painter (browsing), the page opens on its feed tab; opened cold or
  from Learn/search, on Overview. Back restores the tab and the exact tile (FD_MEMO). See `rpStartChip` in js/richpage.js.
- **Settings and Map** are a small floating pill at the bottom (`.fd-float`, js/feed.js), shown only while a feed's pictures
  are on screen. Map opens the same list as the painting map (`pmGo("arr=spiral&seed=<painting nearest the top>&…")`),
  and the map's ⋯ sheet offers **Back to the feed** (js/paintmap.js `data-pmtofeed`, shown when the previous trail token is p:/n:/g:/z:).
- Words not percents for closeness ("Nearly identical / Very close / Close / Related").

## Lane A: painting page + the Pinterest flow (js/gallery.js, css/gallery.css, js/feed.js minimal)
- Today a painting page (`galleryPage` / `glPage` in js/gallery.js, route `#/gallery/<n>`) is: picture, title, palette and
  analysis sections, then "Keep exploring" (`fdMount` with `o.i`) at the very bottom.
- Make it: picture (the "pin") → title + painter · year → the sticky chip row: **Overview · Color · Vibe · Painter · Era · Place**.
  Overview holds everything that sits between the title and the feed today (palette, roles, findings, palettes, Look closer
  entry, etc.), unchanged in content. The feed chips are the existing `FD_CHIPS`.
- js/feed.js already supports an About/Overview pane only for color feeds (`isColor && o.about`, `CHIPS` adds `["about","Overview"]`
  only when isColor). Generalize that to painting feeds: `o.about` + `o.startChip` work for both. Keep color pages unchanged.
- Arrival: browsing arrivals (previous XSTACK token `g:`, `p:`/`n:` coming from a feed tile, `r:paintings/map…`, `aw:`) start on
  **Color** (the closest-palette feed); cold opens start on Overview. Back restores tab + tile.
- The Explore pill on the painting (`data-glfeedjump`) is retired the same way the color page's was: the chip row is right under the picture.
- Smoke: update scenarios that assume the feed is at the bottom of a painting page or that click the Explore pill
  (tools/smoke/scenarios.js, search "glfeedjump", "feedOpen(", "[data-glfeed]").

## Lane B: painter page (js/artwiki.js, css/artwiki.css)
- Painter page (`#/painter/<slug>`, js/artwiki.js). Make it: portrait band → sticky chip row: **Overview · Their work · Their colors**.
  Overview = the reading sections (bio, findings, palettes). Their work = the life's-work grid (existing sort chips may move
  into a Settings sheet built like js/feed.js `openSettings`, or stay as chips if a sheet is clearly worse; say which and why).
  Their colors = the painter color map entry (`pcOpen`) or its inline summary.
- Give Their work the same floating Settings/Map pill (reuse `.fd-float` / `.fd-fb` CSS from css/gallery.css): Map opens
  `pmGo("arr=spiral&seed=<top visible painting>&p=<slug>")`.
- The pinned painter header must not stack a second row of jump chips above the chip row (same rule the color page follows).
- Fix or explain the two painter smoke checks that fail on main today: "painter page: a sort chip reorders the life's work grid"
  (no Vivid sort chip) and "painter's color map: opens from the painter page…" (times out).

## Lane C (after A merges): desktop reading and browsing modes (css/desktop.css, js/desktop.js, js/richpage.js bar only)
- Overview on desktop = Wikipedia: the hero as a full-width band that scrolls away, one ~720 px reading column, a slim sticky
  right rail (small swatch, name, hex, section links). Feed tabs = Pinterest: full width masonry. One bar: once the hero
  scrolls away, the app's top bar becomes the page's bar (swatch + name + chips + search). No second bar ever.

## Rules for every lane
- Read CLAUDE.md, design/DESIGN-CANON.md §5 and design/DAVID-MODEL.md before UI work. Opaque controls, no glass, text never below body size.
- Work only in your own files above; touch js/feed.js only where a lane says so, in the smallest way.
- **Do not bump `?v=`, do not push, do not merge main.** Commit on your branch. Opus merges, bumps ?v= once, and pushes.
- Before reporting: `node tools/check.js`, `check_names.js`, `undef_scan.js`, and `tools/smoke.sh --group pages` and
  `--group paintings` (run a failing scenario alone with `--only` to tell flakes from real failures; names with commas
  can't be passed to --only). Known failures on main: the two painter checks above (Lane B owns them), and flaky
  "pinch zooms the feed", "Look closer's Select tool", "end of the feed says so".
- Verify in the browser at 440x956 and 375x812 (node tools/serve.js <port>; port 8791/8795 may be taken by other projects,
  use 127.0.0.1 and a free port). Report: branch name, what changed, screenshots taken, smoke results, anything not done.
