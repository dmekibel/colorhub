# Update 2026-10-21 12:40: 104,726 paintings LIVE (c263c1bd)
Italian + Russian staging merged, palette method vivid-v2 applied to EVERY painting (150k pool lines), subject tags done, atlas incremental,
data uploaded to R2, all gates green. Lessons: set OMP/OPENBLAS/VECLIB threads to 1 in pool workers (rebuild_all.sh does; was 75x slower);
`tools/rebuild_all.sh --atlas --skip-gallery` resumes after a finished gallery.py. FOLLOW-UPS: paintmap smoke scenarios are flaky since the
first load grew (thumbs.txt 8 MB + 11 atlas sheets ~15 MB): give them longer waits; consider lazier atlas tiers for phones; check painter
statistics after the color re-measure (mean chroma shifted); more Commons-category passes for the ~150 icons; the Italian/Russian painters'
pages need a visual spot check; rename leftovers in data text ("ColorHub").

# State, 2026-10-21 (end of the long coordinator session; read this first)

**Live:** https://chromatlas.app (GitHub Pages, custom domain, HTTPS). Heavy data is served from Cloudflare R2 at
https://data.chromatlas.app (bucket chromatlas-data, edge-cached; js/loader.js DATA_BASE with a fallback to the repo copy;
`python3 tools/r2_sync.py` uploads changed files; key in ~/.chromatlas-r2, never commit it). Cloudflare is reachable through
the Cloudflare MCP (account 041c8f332ceba311c523162ef6f29cef, zone chromatlas.app).
**Archive:** 74,525 paintings. Gallery order is APPEND-ONLY (ids.txt is the ledger); `tools/rebuild_all.sh --atlas` is the one
command after any corpus change (incremental atlas from cached images: minutes). Staged art waits in data/corpus-staging/
(not read by the app) until moved into data/corpus/ and rebuilt.
**Shipped 2026-10-20/21:** painter page (sort direction, Palettes, 2-5 across + pinch, map on top), one-painter map (Arrange,
filters, count chips), map chrome like the color map, smart map search (country/movement/years/painter combos), palette editor
(Pick a color), palette page redesign (4 previews), palette-mode grid + Proportional|Equal, Similar button, pull-down back to
the painting map, Ukiyo-e crash fix (progressive masonry), duplicate removal by museum record, HD Commons images for AIC,
subject tags (data/gallery/subjects.json: authority + title + CLIP "im"; 90% tagged), palette answer key
(data/palette-golden.json + tools/check_palettes.py).
**In flight when this was written (the old session merges these, then stops):**
- Lane H palette measuring fix: CODE MERGED (tools/corpus.py, tools/gallery.py METHOD="vivid-v2"; tools/check_palettes.py --live: Renoir pool 5/5, six 4/5; before/after sheet research/_raw/palette-before-after.png looked right). NOT YET APPLIED: every painting must be re-measured (~3-4 h at 8-10 workers): recompute the six-color palettes of all corpus rows (corpus.run_palettes + a patch step like crop_paintings.py apply) and the pools (gallery.py run_pools recomputes lines whose "m" differs), then rebuild_all.sh --atlas, review painter stats (they shift: mean C* +6.5), r2_sync, push. Do it AFTER the Italian/Russian data update.
- Lane I DONE and pushed (d7f458c7): Chromatlas everywhere in the UI + subject features (painter page By subject, map search
  "Monet boats", By subject arrangement, Subjects line). Left: data files still say "ColorHub" in some text (paintings.js,
  stories.js, wiki-*.js...) -> a data pass; "Madonna" has no subject tag yet (add to the vocabulary); smoke "sets" has one
  flaky long-press scenario.
- Italian batch (85 painters, Wikidata + Commons categories) downloading to staging; Russians (78, Commons pass) already staged.
  Next data update = move staging -> corpus, `tools/rebuild_all.sh --atlas`, gates, smoke, r2_sync, push.
**Next after that (recommended order):** Commons-category completeness pass for the ~150 icons; Spanish/British/American/Nordic
schools; non-Western painting (Met/CMA/AIC APIs); stop committing heavy data to git now that R2 serves it; video-landing pages
for the colors and paintings the first videos feature (cutroom); Kept palettes open the new palette page.
**Ask David for:** 10-20 more hand-made palettes via Pick a color (answer keys).

# Coordinator plan, 2026-10-20 (Opus strategy pass; overrides older "next" lists below)

**The goal beyond the goal:** launch **Chromatlas** (name decided 2026-10-19; LAUNCH.md's "Mauve" is superseded). The first launch
moment is the VIDEOS, not the App Store: cutroom has vermilion (v28) and ultramarine (v6) nearly done, built on this app's
palette data. Viewers will land on the web app, so its first impression, the colors and paintings the videos feature, and the
name on screen matter more right now than more art or new features.

**Order (each step lands, passes gates, and is pushed before the next):**
1. Data lane (A): finish the atlas rebuild, commit the data ALONE (one revertible commit), push. Fixes the live Van Gogh page
   (stale portraits.json showed a Bonnard and Vermeers).
2. Data lane (A), BEFORE any more art: an append-only gallery order. Freeze today's order in a ledger; new paintings only append.
   Why: inserting mid-order shifts every stored position (the stale-file bug class), forces a 30+ minute full atlas rebuild, and
   rewrites ~100 MB of data per artist batch. The repo pack is already 599 MB (GitHub Pages: keep under ~1 GB) and the app plans
   to bundle all data offline (App Store cellular download limit ~200 MB). With append-only, a batch touches only the tail.
   Same step: a size budget gate (tools/check.js fails if bundled data grows past a set budget), a golden set (~50 famous works
   that must appear on their painter's page, with that painter's portrait or famous work as the hero), stamps on derived files,
   a pre-push hook running check.js + one smoke group, and fix the one known-failing smoke scenario (studio "Name any color") so
   the gates can be trusted.
2b. VIDEO-LANDING lane (before the videos post): rename the site to Chromatlas on screen, in titles and Open Graph previews;
   make the color pages and painting pages the videos feature (ultramarine, vermilion, the Milkmaid, Titian, Cassatt, Manet,
   Ingres...) correct and beautiful, and seed the golden set with exactly those; a clear "get the app / join the waitlist" line.
   Ask cutroom's latest render for the exact list of colors and paintings shown.
3. UI lanes B (painter page slice 1) and C (painter map Arrange/filters), already running in worktrees: merge B, then C, after
   the coordinator reviews 440x956 screenshots; one fresh-context craft critique on the merged result. Then queue (not before):
   portrait carousel (data side first: portraits.json holds a list), "Show frame" toggle, timeline scrubber, "his yellows" chips.
4. Launch-readiness lane (replaces a generic roadmap triage): one page, what blocks Mauve v1 (Capacitor wrap + offline bundle,
   native bits for guideline 4.2, onboarding paywall, RevenueCat, store assets), and which ROADMAP/NOTES-TRACKER items matter for
   v1 vs later vs drop. Top 5 by payoff.
5. More artists only after step 2, and only for painters the videos or the golden set need.

**David-only, outward-facing:** before the first video posts, buy chromatlas.app (and .com if cheap) and claim YouTube @chromatlas
(TikTok and Instagram are done). The Apple Developer account ($99/yr) can wait until the Capacitor build starts: App Store
Connect cannot hold a name without an app record anyway.

**How the coordinator works:** decides in-repo things itself, brings David pros/cons + a recommendation (never an open
question), max 2 Sonnet agents at once, only lane A commits under data/, only the coordinator bumps ?v= and pushes.

# Handoff, 2026-10-08 (end of the big build session)

Read in this order: `CLAUDE.md` (rules), this file (state), `NOTES-TRACKER.md` (every open note from David, in order), `ROADMAP.md` (approved backlog and build order), `DESIGN.md`
(design decisions and the feature hierarchy). Live site: https://dmekibel.github.io/colorhub/ (GitHub Pages from `main` of
the public repo `dmekibel/colorhub`).

## How to work (David's rules from this session)
- **Cost first.** Set the model on every subagent: Sonnet by default, Haiku for lookups, Opus only for hard judgment with
  David's OK. One or two agents at a time. Give a size (S/M/L) and get a go before anything big. Do small edits directly.
  Before saying "everything is paused", check ListAgents for helper agents that agents spawned themselves.
- **In-repo product decisions:** present a recommendation and follow it (David said "follow whatever you recommend").
  Still confirm anything outward-facing (contacting people, publishing copyrighted material, accounts).
- **David wants:** a minimalist, iconic, uncluttered, full-screen feel; beautiful on his iPhone; many features but never a
  "clusterfuck" (DESIGN.md feature hierarchy); honest content (CLAUDE.md myth list); lots of images in articles.
- Russian edition: only after the English app is finished.

## Ship checklist (every push)
1. `node tools/check.js`, `node tools/check_wiki.js`, `node tools/check_names.js` (duplicate top-level names across js/*.js
   break the whole app: all scripts share one global scope), `node --check` on changed js. Feature tests: `tools/gym_sim.js`,
   `tools/pickit_test.js`, `tools/produce_test.js`, `tools/match_test.js`, `tools/taste_sim.js`.
2. Bump the shared `?v=` tag on every script/style in `index.html` (format `2026100Xx`, one value everywhere).
3. Look at the changed screens at phone size (see Preview). Stage explicit paths (never `git add -A`; `.claude/worktrees`
   and `research/_raw` must never be committed). Commit message ends with the Co-Authored-By line. Push to `main`.

## Preview
- `tools/sync-preview.sh <scratchpad>/site` mirrors the repo, then serve it: `python3 -m http.server 8791` from that folder
  (the desktop preview can't read ~/Documents directly). Screenshot mode: `index.html#shot=<screen>` (see js/boot.js);
  routes: `#/today`, `#/color/teal`, `#/explore/paintings`, `#/poem/hyakunin-17`, `#/gallery/<n>` etc. (js/router.js).
- Browser caches: after syncing, `fetch(url + "?v=…", {cache: "reload"})` the changed files, or bump `?v=`.
- Headless Chrome screenshots often hang after writing the file; use your own profile dir and port and kill your own PIDs.

## What's built (all live)
- **Navigation:** four tabs (Today, Train, Explore, Studio) with icons; back gesture via history; every screen has an address
  (js/router.js); static SEO pages in `c/`, `p/`, `art/` + `og/` preview images + sitemap (regenerate: `python3 tools/pages.py`).
- **Learning (Today):** objective placement (Pick it); meet-a-unit pager; swipe deck; spaced review with Pick it / Say it /
  Make it cards (js/pickit.js, js/produce.js); honest "yours" = an objective check a day+ later; optional self-test;
  "About this color" peek inside flashcards (js/peek.js); look-alikes sheet on any color pair (js/lookalikes.js);
  Today's three (challenge, today's color, a Train suggestion); Quick mode (no typing).
- **Train:** stations with an engine (js/gym-engine.js): levels 1-20 with dials, staircases ~76%, weak-spot tips + Fix it,
  confidence taps, weekly no-feedback check-ins, spaced station rotation, mixed sets, Squint on paintings, color memory as a
  level game; screen check; scores measured on the drawn colors; Colorist and Atelier shelves (js/match.js: kill the cast,
  shot matching, Kelvin eye, value scale, big masses, Zorn palette); neutral grey "booth" surround for judging color.
- **Explore:** For you · Colors (full-screen honeycomb explorer, js/colorsets.js + js/honey.js) · Paintings (14,447 museum
  paintings searchable by color, js/gallery.js + data/gallery/) · Poems (11,440 public-domain poems incl. originals,
  js/poems.js) · Ideas (wiki pages, stories, Films, Passages) · World (Fashion, Botany, Gems: js/world.js, botany.js, gems.js).
  Color pages are hubs: In paintings / poems / books / films / fashion / nature / gems.
- **Studio:** gamut-mask wheel, camera that names colors (with white balance), photo palettes, Harmony, Albers, taste tests
  (js/tastemodel.js: taste map, palette dials, matching painters).
- **Content:** fact-checked twice against 25 books (research/FACTCHECK-*.md; private notes in ../color-kb), a 2,700-name
  library (data/library.json), Wikimedia images with credits (data/images.js, botany-images.js, gem-images.js).

## In flight at handoff (check these first)
- **Honeycomb home + Learn it:** shipped 2026-10-07 (js/home.js, js/learnit.js, css/home.css). Follow-up the same day per
  David: full screen with no title bar, no name caption, no handle; a swipe up from the bottom opens the sheet (views +
  search now live at its top); the sheet rises briefly on the first 3 visits so the swipe is discoverable. Zoom-out loosened:
  one whole repeat fits the width and a vignette fades the copies (js/honey.js zFloor + draw). Still rough: Learn it's "Next"
  bar has no side gutter; quick-view swipe on the title is gone with the title.
- **Wikimedia Commons painting batch** (Sonnet agent, worktree `.claude/worktrees/agent-a57968c4ba6d9c2fb`): adds a `commons`
  source to the corpus and rebuilds data/gallery. Merge, run `python3 tools/gallery.py --raw research/_raw`, spot-check images.
- Paused earlier and NOT merged (partial work kept in worktrees): Looks archive (`agent-a50bf8a3c72ce6306`), the ~270 extra
  wiki images (`agent-a7a61bd7e4615b40a`). Decide whether to finish or drop.

## Next (in order, all approved; details in ROADMAP.md)
1. ROADMAP §13 (start with the unified naming system: one list, one nameOf(), modifiers), then painting palettes (highlight the matching swatch, dynamic 3-20 palette precomputed offline, tap-to-name),
   every swatch tappable app-wide, the color link sheet with several nearest words in both tiers, generated library color
   pages, one primary English name per distinct color (alternates as info only; a non-English name is the primary name only when no English name exists; ~1,000 total). Wait for the Commons batch first (it rewrites data/gallery).
2. Color-list swaps from research/COLOR-SELECTION.md (Bistre, Stone, Green grey, Rose, Grape, Seafoam; Terracotta and
   Tangerine hex fixes; a cross-unit near-twin check in tools/check.js).
3. ROADMAP build order: odd-one-out family, rearrange family, memory additions, the path (Duolingo-style lessons), photo
   missions, color-page hubs + Art filter merge, Studio critique/mockups/exports, motion/sound/haptics, design system.
4. Stages and fields (ROADMAP §14: nine stages, 25 / 50 / 100 / 150 / 250 / 400 / 600 / 800 / 1,000 words, no colored belts, basics are placement
   only) as the chapters of the path.
5. Image analysis (ROADMAP §15): upload any image for stats, several palettes, views, and closest painter/era/country/
   painting by color. Then §16: mosaic picker (6-400 tiles, finger-swipe to collect), the palette engine (many strategies:
   extraction, harmony math, learned beauty, painter recipes) and cross-matching with flowers/gems/fashion. Later: business (Plus, a free atlas site), Colordle, the Russian edition.

## Known issues
- Art Institute of Chicago and SMK images are served from our own 200px copies (AIC blocks hotlinking; SMK is slow); SMK
  swaps in a sharp image on the painting page, AIC shows small with a museum link. The Met corpus is only a 165-painting
  sample (its bot shield); resume with `python3 tools/corpus.py fetch met --resume` (slow).
- Explore has 6 filters (rule says ~4): merge Paintings + Poems into "Art" (ROADMAP §7).
- Production cards (Say it keyboard, voice) and camera white balance are untested on a real iPhone.

## Open questions for David
- The app's signature visual object (the paint-chip idea was rejected).
- 3-5 reference screenshots (Duolingo, ALTER, others) before the design-system pass.
- Whether to reach out to Peter Donahue (Color Nerd) once paint features ship (Claude drafts, David sends).
