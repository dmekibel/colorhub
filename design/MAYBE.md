# Maybe list: ideas considered, not built, to rank later (David, 2026-10-28)
Move an item to a plan when David picks it. Decided items live in design/plans/2026-10-28-ux-backlog.md.

## Sharing and growth
- Link previews per painting/color (Cloudflare service, /s/<index>): needs David's OK the day it goes live. (Leaning: do early; it is the foundation for all sharing.)
- Share button on color pages; share text "Check out this painting I found on Chromatlas".
- "My color" card (taste trainer result: "I found my favorite color on Chromatlas").
- Palette card (any built/kept palette), square + 9:16 story size, small tasteful mark.
- Eye score card (real percentiles only; "my score" until enough play data).
- Daily challenge result as a color grid (Wordle-style).
- A painting beside its six measured, named colors.
- Challenge a friend (same round, their score to beat).
- Streaks and badges shown on cards; photo-palette card (on-device only); monthly/yearly colors recap.

## Navigation and layout (not chosen)
- Hold the whole palette strip to open a save/copy/play sheet (replaced by the palette-page flip).
- Swipe back that jumps several steps; feed glyph beside the map glyph on deep trails.
- Tap the lit Explore chip to scroll the feed to top.
- Heart options: top-right cluster, bottom row, image corner (chosen: far left of title row).
- Eyedropper preview: move it into the black space above the picture if still too big.
- Explore search: force Boards above "Places & eras".

## Art and data
- Segmentation pass (SAM/rembg) for uneven-edge images; show whole artwork on transparent (map) / black (Explore).
- Extend duplicate hiding as more rows get embeddings; stronger matcher for the Last Supper leftovers.
- Non-Commons museum sources for Turkmenistan/Kyrgyzstan/Tajikistan (Europeana, museum APIs).
- Post-1955 painters: no (copyright). Colors-only batch: no.

## Games and art education (David, 2026-10-28; later, not now)
- Spot the Difference is the best game: more beautiful colors/palettes, cap the difficulty so it is never invisible, fix its UI.
- Prune weak games (hide or delete; bring back only if good): good games must not sit beside bad ones.
- Trivia, Duolingo style: painting -> pick the year (an educated guess teaches) vs painter name (only for well-known eras); many variants; never too hard.
- Learn loop like colors: quick review, then learn, always at your level, for art history, movements, terms.
- Art education as a paid layer: articles, data visualizations of art history nobody else has, "Wikipedia on steroids"; reason to pay like Great Courses Plus.
- Multiplayer (invite friends); example: two paintings, one color changed, which is original.
- Why art history matters: taste, context, enjoyment, applied to your own work (like chess games, music history).
- Two audiences: the casual art lover and the art person who pays.

## Instagram (David, 2026-10-28; session to be started from the desktop app)
- Painting carousel: slide 1 painting + palette strip + name/painter/year + "Swipe to name the colors"; next slides one color each with its name and hex (maybe name first, answer on the next swipe as a quiz).
- Color carousel: slide 1 a color with its name; slide 2 the color's own line (how it differs from its neighbor, or its story if it has a real one); the rest a collage of paintings that hold that color (exact-speck closeness beats big off-color areas). Same generator as the painting carousel; alternate formats weekly.
- Logo check against competitors (Pantone, Coolors, Adobe Color, I Love Hue, Google Arts & Culture, Artsy, Color Hunt); 2-3 improved directions, no live change.

## Beyond paintings (David asked 2026-10-28; no sculpture archive exists yet)
- Colored objects as a second kind of thing with its own medium tag and filter: polychrome sculpture (Greek/Roman painted, medieval wood saints, Gothic portals, Egyptian painted reliefs, Mesoamerican/Andean figures), stained glass, ceramics and glazes (Iznik, Chinese), mosaics, tapestry. Skip plain marble/bronze. Caveats: 3D objects in uneven light make measured colors weaker; same no post-1955 rule; Met, AIC, Walters, Commons have open sets. Idea for an article: "white marble was never white".
- Cave and rock art (Lascaux, Chauvet, Altamira, Cueva de las Manos, Bhimbetka, Tassili, San art): a "first palettes" prehistory board (red and yellow ochre, manganese black, charcoal); caveat artificial light, replicas vs real walls, dating stated honestly; research queued (Job D with the audit helper).
- Indigenous and African painted art (Native American ledger art and hide paintings, Pueblo watercolors, Mesoamerican codices, Cusco School, Maori, Ethiopian icons, Aboriginal bark painting with sensitivity limits): research queued (Job C); label by community name, skip sacred or restricted material.

## 3D scans of sculpture (discussed 2026-10-28; not built)
- Legally clean sets: Smithsonian 3D (CC0, about 3,500 objects, only part sculpture; count from a blog, verify), Sketchfab museum CC0 program (about 1,700 in 2020, likely several thousand now), a few CC BY museum sets. Estimate usable: 3,000 to 6,000 scans, 1,500 to 3,500 real sculpture. No Gaussian-splat museum archive found (unverified).
- Scan the World and similar sets are non-commercial (from memory, not verified): a paid tier or a free tier that feeds a paid one is commercial use; "we are an archive" is not a legal status (library/archive exceptions need no commercial gain). Options: (1) CC0/CC BY only, (2) ask the owner for a commercial license (draft email), (3) rely on fair use / "faithful scan of a public domain object has no copyright" (unsettled for 3D, differs by country; needs an IP lawyer first).
- Needs a 3D viewer and color measured from rendered views (weaker). Do after painted objects and the painting gaps.
