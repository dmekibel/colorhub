# Handoff, 2026-10-08 (end of the big build session)

Read in this order: `CLAUDE.md` (rules), this file (state), `ROADMAP.md` (approved backlog and build order), `DESIGN.md`
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
- **Honeycomb home + Learn it** (Sonnet agent, worktree `.claude/worktrees/agent-a4289aed26a66d6e6`): ROADMAP §12. If it
  finished, merge its branch, check screens, push. If not, resume or redo from the spec.
- **Wikimedia Commons painting batch** (Sonnet agent, worktree `.claude/worktrees/agent-a57968c4ba6d9c2fb`): adds a `commons`
  source to the corpus and rebuilds data/gallery. Merge, run `python3 tools/gallery.py --raw research/_raw`, spot-check images.
- Paused earlier and NOT merged (partial work kept in worktrees): Looks archive (`agent-a50bf8a3c72ce6306`), the ~270 extra
  wiki images (`agent-a7a61bd7e4615b40a`). Decide whether to finish or drop.

## Next (in order, all approved; details in ROADMAP.md)
1. ROADMAP §13: painting palettes (highlight the matching swatch, dynamic 3-20 palette precomputed offline, tap-to-name),
   every swatch tappable app-wide, the color link sheet with several nearest words in both tiers, generated library color
   pages, one primary English name per distinct color (alternates as info only; a non-English name is the primary name only when no English name exists; ~1,000 total). Wait for the Commons batch first (it rewrites data/gallery).
2. Color-list swaps from research/COLOR-SELECTION.md (Bistre, Stone, Green grey, Rose, Grape, Seafoam; Terracotta and
   Tangerine hex fixes; a cross-unit near-twin check in tools/check.js).
3. ROADMAP build order: odd-one-out family, rearrange family, memory additions, the path (Duolingo-style lessons), photo
   missions, color-page hubs + Art filter merge, Studio critique/mockups/exports, motion/sound/haptics, design system.
4. Stages and fields (ROADMAP §14: nine stages, 25 / 50 / 100 / 150 / 250 / 400 / 600 / 800 / 1,000 words, no colored belts, basics are placement
   only) as the chapters of the path. Later: business (Plus, a free atlas site), Colordle, the Russian edition.

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
