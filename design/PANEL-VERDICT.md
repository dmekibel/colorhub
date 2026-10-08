# ColorHub Design Review: Five-Reviewer Panel Verdict
**Review date:** 2026-10-08 | **Reviewers:** David (owner), Curator, Learning scientist, Casual user, Builder

---

## Scoring Key
- **KEEP:** Ship it, high confidence.
- **LATER:** Good idea, not this cycle, depends on other work, or needs specifics.
- **CUT:** Pass on this one; effort not justified, or violates philosophy.

A verdict is KEEP if ≥3 reviewers say KEEP; CUT if ≥3 say CUT; otherwise LATER.

---

## PART 1: READ SIDE — Facet Catalog (18 facets, A2)

| Facet | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|-------|-------|---------|-------------------|------|---------|---------|------|
| **Etymology & first use** | KEEP (grounded, sourced) | KEEP (honesty + citations) | KEEP (builds long-term memory) | KEEP (stories hook interest) | KEEP (data exists in repo) | **KEEP** | Essential foundation. Use existing research/FACTCHECK pass. |
| **The color measured** | KEEP (core to philosophy) | KEEP (Munsell/CIELAB fact-based) | KEEP (perception = skill) | KEEP (aha moments: "wait, same lightness?") | KEEP (Lab values already in data/colors.js) | **KEEP** | Non-negotiable. Add the "what does everyone call this?" one-liner per builder's note. |
| **History** | KEEP (depth by default) | KEEP (verifiable, sourced trade/price) | LATER (rich context, but not core to seeing) | KEEP (loves the "used more than gold" line) | KEEP (exists in books, new writing) | **KEEP** | Differentiates Deep/Medium tiers. Medium-only colors get a thin version. |
| **Pigments & dyes** | KEEP (painters need this) | KEEP (exact materials + fading honesty) | KEEP (chemical reality grounds perception) | LATER (too technical for casual) | KEEP (21 nodes exist, new entries per color) | **KEEP** | Pigment-named colors only; don't force it for names like "Dusty rose." |
| **In painting** | KEEP (entire philosophy) | KEEP (gallery sourcing) | KEEP (varied visual examples = transfer) | KEEP (loves seeing it happen) | KEEP (gallery already computed) | **KEEP** | **Core.** Hub shelf for gallery, deepened filter per idea #26. |
| **In literature** | KEEP (one real line, credited) | KEEP (authentic, <15 words) | KEEP (embodied language sticks) | KEEP (feels literary and fun) | LATER (needs poems.js ingestion; small ROI) | **LATER** | Build if poems.json ships; skip if stalled. Mark "no match" honestly on colors with none. |
| **In fashion** | KEEP (named tradition) | KEEP (era/designer sourced) | LATER (aesthetic, not perceptual) | KEEP (Pinterest-scale interest) | LATER (needs research/FASHION.md + writing) | **LATER** | Worth doing for iconic colors (Tiffany, Klein, Chanel); skip data-written tier. |
| **In nature** | KEEP (Werner anchors multi-sensory) | KEEP (real animals/plants only) | KEEP (sensory variety = retention) | KEEP (delightful surprises) | KEEP (data/botany, data/botany-images exist) | **KEEP** | Small 3-item strip always shown for all 101 colors; no prose. |
| **Gems & minerals** | KEEP (multi-sensory anchor) | KEEP (real stones only, no forced matches) | KEEP (cross-sensory encoding) | KEEP (people love gems) | KEEP (research/GEMS.md exists; don't force) | **KEEP** | Only when a real stone matches; missing is fine. 100–250 chars. |
| **Botany** | KEEP (floriography angle) | KEEP (sourced traditions, not invented) | KEEP (flower-naming cultural logic) | KEEP (pretty and connected to language) | LATER (research/BOTANY.md + flower meanings + toxicity caveat) | **LATER** | Flower-named colors only; research is real but requires care + sourcing. |
| **Perception & science** | KEEP (core to Color Nerd integration) | KEEP (cone response, Abney, Helmholtz-Kohlrausch sourced) | KEEP (training visual system) | LATER (reads abstract on first pass) | KEEP (wiki-nodes.js concepts exist; link out) | **KEEP** | Link to concept pages (trichromacy, simultaneous-contrast) rather than re-explain. One-line perceptual fact per color; full facet only for real stories. |
| **Symbolism across cultures (hedged)** | KEEP (depth, framed as tradition) | KEEP (X tradition held, never "means") | LATER (feels thin unless deep story) | LATER (risks soundingvague) | LATER (synthesis work + heavy caveat-writing) | **LATER** | Only ship if research/SYNTHESIS.md is solid and facts are heavily framed ("X tradition held…"). Skip for data-written tier. |
| **In design** | KEEP (grounded examples: Tiffany, Klein) | KEEP (real branded uses only) | LATER (visual memory, less core) | KEEP (loves Tiffany example) | LATER (needs research/DESIGN-COLORS.md) | **LATER** | Build a short, named list (Tiffany Blue, Klein Blue, Facebook Blue, IKB) for Deep tier only. Don't pad every color. |
| **In film** | KEEP (cinematic language + production design) | KEEP (sourced cinematography facts) | KEEP (moving image = stronger encoding) | KEEP (film lovers exist) | LATER (needs research/PASSAGES-FILMS.md + data/films.js ingestion) | **LATER** | Real match only; skip if not sourced. Cheaper after films.json ships. |
| **Other languages / say it in** | KEEP (core learning premise: names expand perception) | KEEP (cross-linguistic facts, sourced) | KEEP (code-switching literature = retention) | KEEP (loves seeing two-blues story pattern) | KEEP (2–4 languages, existing data model works) | **KEEP** | Reuse "two blues" pattern; only show languages with genuine splits, not forced translations. 100–250 chars. |
| **Variants** | KEEP (honesty: lighter/darker/historical) | KEEP (documented variants only) | LATER (can obscure core name) | LATER (confusing on a small screen) | KEEP (small chip row reuses existing UI) | **LATER** | Include if documented (e.g., Prussian blue / Berlin blue); don't invent. Small chip row, no prose. |
| **Myths corrected** | KEEP (honesty + CLAUDE.md rule) | KEEP (factual correction) | KEEP (correction after wrong belief = strong encoding) | KEEP (loves the real story) | KEEP (myth-list is pre-written per CLAUDE.md) | **KEEP** | Only colors with a real matching myth from CLAUDE.md's list. 150–350 chars. **Never invent a myth to fill the slot.** |
| **References** | KEEP (sourcing transparency) | KEEP (required) | KEEP (builds trust) | LATER (nobody taps it but needed) | KEEP (structured, lazy-loadable) | **KEEP** | Numbered, shown at bottom, no prose. Re-verify each fact per the fact-check pipeline. |

**Read verdict:** 13 KEEP, 5 LATER. **Build order:** Start with the 13 KEEP facets (Etymology, Measured, History, Pigments, In painting, Nature, Gems, Perception, Other languages, Myths, References, and In design/film once sourcing is ready). Layer In literature, Symbolism, Botany as research matures. Variants is low-ROI; keep minimal, sourced only.

---

## PART 2: DO SIDE — 42 Ideas (A5)

### Category 1: See it (7 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 1. Hue-plane slice | KEEP (true to philosophy: names are regions) | KEEP (visual proof) | KEEP (spatial memory) | KEEP (geometrically fun) | KEEP (Lab values exist) | **KEEP** | M effort. Core Color Nerd idea. High clarity. |
| 2. Grayscale toggle | KEEP (cuts through Helmholtz-Kohlrausch illusions) | KEEP (reveals true lightness) | KEEP (calibration skill) | KEEP (instant clarity) | KEEP (S effort, pure CSS) | **KEEP** | S effort. Do this first. |
| 3. Color-blind preview | KEEP (honesty: does this color work for everyone?) | KEEP (accessible, sourced CVD matrices) | KEEP (perceptual constraint training) | KEEP (surprised it works at all) | KEEP (S effort, standard matrices) | **KEEP** | S effort. High value: tests signature survival. |
| 4. "Then vs now" fade (pigment aging) | KEEP (honesty: paintings change) | KEEP (conservation fact) | LATER (specialized, not core to seeing) | LATER (feels tangential) | LATER (needs pigment-aging research per color, M effort for few colors) | **LATER** | Only ship for well-documented fading (smalt, Prussian blue, carmine, chrome yellow). Don't estimate. M effort, thin ROI; wait for conservation sourcing. |
| 5. Werner's anchors (flip card) | KEEP (multi-sensory grounding) | KEEP (historical, sourced) | KEEP (embodied memory) | KEEP (delightful micro-interaction) | KEEP (S effort, data/werner.json exists) | **KEEP** | S effort. Small card, high delight. |
| 6. Spot it in a painting | KEEP (core philosophy: see it) | KEEP (gallery sourced) | KEEP (spatial attention training) | KEEP (immediate aha) | KEEP (S effort, reuses painting-page highlight) | **KEEP** | S effort, reuses existing feature. Essential engagement. |
| 7. Abney drift animation | KEEP (accurate, hue-specific truth) | KEEP (real perceptual fact) | KEEP (lightness training) | KEEP (mesmerizing) | KEEP (S effort, canned animation) | **KEEP** | S effort. Specific to blues/violets; no false generalization. |

**See it verdict:** **7 KEEP.** All pass cost-benefit. Start with grayscale + color-blind (S each).

---

### Category 2: Make it (6 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 8. Mix it (paint, Kubelka-Munk) | KEEP (core skill) | KEEP (real chemistry) | KEEP (mixing builds perception) | KEEP (creative, addictive) | CUT (Mixbox CC BY-NC; commercial license unresolved, COLORNERD-IDEAS §7) | **LATER** | L effort. Gate on license resolution (CC BY-NC). Don't build UI until license is closed. |
| 9. Mix it (light, RGB) | KEEP (complementary truth: light ≠ paint) | KEEP (factual, simple) | KEEP (additive model = core understanding) | KEEP (fast, clear) | KEEP (S effort, basic RGB math) | **KEEP** | S effort. Ship first to build expectation; paint comes later. |
| 10. Build a string through this color | KEEP (scaffolding the palette-building skill) | KEEP (step-wise palette logic) | KEEP (deliberate practice: constrained exploration) | LATER (feels like a design tool, not a learning game) | KEEP (S effort, Lab space, colors.js data) | **KEEP** | S effort. Belongs on the color page Do side; also in Studio (for palette-building). Reuse the same component. |
| 11. Tone chord from here | KEEP (palette logic: tone families) | KEEP (Schloss & Palmer verified) | KEEP (tonal harmony = visual system truth) | LATER (abstract concept) | KEEP (M effort, tone-bucket math over Lab) | **KEEP** | M effort. Powerful for palette design. High learning ROI. |
| 12. Nearest real name finder | KEEP (bridge between perception and names) | KEEP (interactive measurement) | KEEP (calibration practice) | KEEP (addictive, sliders are fun) | KEEP (M effort, data/colors.js neighbors, data/library.json) | **KEEP** | M effort. Lets users explore the boundary live. **Keep this one; it's gold.** |
| 13. Export a palette seeded from this color | KEEP (tool completion) | LATER (design tool overlap with Studio) | LATER (not core to perception) | KEEP (utility: I'd use it) | KEEP (S effort, reuse Studio's export) | **LATER** | S effort but overlaps Studio heavily. Ship once Studio's export is live; reuse one component. |

**Make it verdict:** 5 KEEP, 1 LATER, 1 gated (Mixbox). Order: light mixer (S), then string + tone chord + slider (M each). **Gate paint mixer (Mixbox) until CC BY-NC commercial license is formally resolved.**

---

### Category 3: Play with it (8 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 14. Lime-boundary game (when does it stop being this color?) | KEEP (Color Nerd idea #2: core skill) | KEEP (perceptual truth) | KEEP (**high learning value**: names have fuzzy boundaries; trains discrimination) | KEEP (obsessive, tapping forever) | KEEP (M effort, needs baseline eventually but ships without one) | **KEEP** | M effort. High engagement + learning ROI. Can ship MVP without crowd baseline. **Prioritize this.** |
| 15. Which way is it from neighbor? (direction drill) | KEEP (Color Nerd idea #1, core) | KEEP (directional language = perception) | KEEP (**evidence-strong**: interleaving neighbors once known, EXPORT-KB §8) | KEEP (satisfying) | KEEP (S effort, reuses colors.js vs/d structure, ships in both Train + color page) | **KEEP** | S effort, high ROI. **Reuses existing structure; cheap win.** Build once for Train, surface on color page. |
| 16. Odd one out, this family | KEEP (core game, family-scoped) | KEEP (safe, no out-family oddballs) | KEEP (perceptual discrimination) | KEEP (proven engagement) | KEEP (S effort, reuses Train/Journey game grammar, ROADMAP §20) | **KEEP** | S effort. **Reuse existing.** Should already exist from ROADMAP §2. |
| 17. Afterimage hunt | KEEP (real perceptual fact) | KEEP (sourced, Abney-style) | KEEP (color constancy training) | KEEP (wild, memorable) | KEEP (S effort, pure hue math) | **KEEP** | S effort. Color-specific truth, no false universals. **Ship this.** |
| 18. Daily dictionary guess | KEEP (language + perception) | KEEP (sourced defs from Webster's Third / Stamper) | KEEP (vocabulary building, retrieval practice) | KEEP (clever, fun) | KEEP (S effort, neighbors already in colors.js) | **KEEP** | S effort. Reuses existing prose. **Daily = perfect loop.** |
| 19. "Was it there?" memory round | KEEP (game grammar established) | LATER (not color-specific) | KEEP (memory = spaced review loop) | KEEP (fun, quick) | KEEP (S effort, reuse gym engine) | **KEEP** | S effort, reuse. **Embed in spaced review flow, not standalone.** |
| 20. Imposter label | KEEP (name-learning core) | KEEP (forces discrimination) | KEEP (retrieval + discrimination) | KEEP (harder than it sounds, addictive) | KEEP (S effort, reuse game engine) | **KEEP** | S effort. **Reuse Train grammar.** Belongs in Journey as a lesson step, not a per-color feature. |
| 21. Which hue plane? (constancy training) | KEEP (perceptual skill) | KEEP (color constancy truth) | KEEP (hue constancy = visual competence) | LATER (abstract on first pass) | KEEP (S effort, Lab math) | **KEEP** | S effort. **Include as optional deep drill,** not in main flow. |

**Play with it verdict:** 8 KEEP. **All ship.** Order: lime boundary (M) + direction drill (S) + afterimage/dictionary/memory/imposter/hue-plane (S each). These are the core game grammar.

---

### Category 4: Live with it (4 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 22. Pair it with your photos | KEEP (real-world grounding) | LATER (requires camera, privacy) | KEEP (perceptual learning: generalization to natural scenes) | KEEP (feature envy) | LATER (M effort, shares Studio camera work, but camera is later) | **LATER** | M effort. Dependent on Studio's camera infrastructure (ROADMAP §8). **Ship once camera exists.** |
| 23. Name it in the wild, scored | KEEP (real-world learning) | LATER (accuracy hard, outdoor light varies) | KEEP (mission-based practice) | KEEP (mobile game angle) | LATER (M effort, outdoor color matching is hard; needs calibration) | **LATER** | M effort, high uncertainty. **Flag for outdoor-color-science research first.** Skip if Scout's findings on calibration-transfer are weak. |
| 24. Outfit/room mockup | KEEP (design-skill building) | LATER (feels like a design tool, not learning) | LATER (not core to seeing) | KEEP (Instagram feature envy) | LATER (M effort, overlaps Studio mockups) | **LATER** | M effort, overlaps Studio heavily. **When Studio mockups ship, add one "try this color" entry point from the color page.** Don't duplicate. |
| 25. Add to my palette | KEEP (personal collection, motivation) | KEEP (scaffolds palette-building) | KEEP (progress = building real-world skill) | KEEP (I'd save things) | KEEP (S effort, localStorage already supports it per CLAUDE.md) | **KEEP** | S effort. **Ship early; feeds motivation loop.** Personal palette = reward. |

**Live with it verdict:** 1 KEEP, 3 LATER. Idea #25 (Add to palette) is essential for motivation. Gate #22–24 on Studio infrastructure + research maturity.

---

### Category 5: Find it (6 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 26. In paintings hub, deepened (filtered gallery by color %) | KEEP (core philosophy: many readings) | KEEP (data-sourced, gallery computed) | KEEP (visual examples = transfer) | KEEP (browser favorite, endless scroll) | KEEP (S effort, data/gallery share field already supports it) | **KEEP** | S effort. **Data already computed.** High engagement. |
| 27. In poems/film, deepened | KEEP (multi-modal anchor) | KEEP (if sourced) | KEEP (varied examples) | KEEP (cultural resonance) | LATER (poems/films need ingestion first, poems.json / films.json) | **LATER** | S effort each, but blocked on data ingestion (research/PASSAGES-FILMS.md, data/poems.js). **Ship once data is real.** Poems is stalled; films depends on research. |
| 28. Artist signature match | KEEP (painter = palette teacher) | KEEP (comparative, sourced from byArtist computed) | KEEP (learning from exemplars) | KEEP (favorite painters become mine?) | KEEP (S effort, data/stats.js byArtist top/dist already computed) | **KEEP** | S effort. **Data exists. Cheap win.** Ranked artists by how much they use this color distinctively. |
| 29. Movement match | KEEP (era + style learning) | KEEP (art-historical context) | KEEP (cultural learning) | LATER (abstract context) | LATER (M effort, blocked on movement data — only 8 movements have real data; Wikidata P135 pipeline needed for full coverage) | **LATER** | M effort, blocked on §21's movement pipeline (ROADMAP §21). **Ship once Wikidata data is ingested.** For now, show artist + decade instead. |
| 30. Museum match | KEEP (institution context) | KEEP (collection sourcing) | LATER (context, not perception) | LATER (too locational?) | KEEP (S effort, data/gallery source field exists) | **KEEP** | S effort. **Data exists.** "Seen most at the Hermitage" is useful. |
| 31. Decade/century heatmap | KEEP (history as visual language) | KEEP (period sourcing) | KEEP (temporal pattern = schema) | KEEP (timeline is visual) | KEEP (S effort, byDecade/byCentury already computed) | **KEEP** | S effort. **Data exists.** High learning ROI: when did we learn this color? |

**Find it verdict:** 4 KEEP, 2 LATER. Build order: #26, #28, #30, #31 (all S, data exists). Gate #27 (poems/films) on data, #29 (movement) on Wikidata pipeline.

---

### Category 6: Remember it (3 ideas)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 33. Review shortcut (existing Learn/Review button) | KEEP (confirmed, don't duplicate) | — | KEEP (spaced review gateway) | KEEP (buttons exist) | KEEP (already designed) | **KEEP** | Confirm: learning button from color page uses the spaced-review engine, not a new flow. |
| 34. Spaced "name it again" card | KEEP (just-in-time review) | LATER (feels like Learn overflow) | KEEP (spaced retrieval practice) | LATER (isn't this the Journey?) | KEEP (S effort, one tap into spaced review) | **KEEP** | S effort. **Simplify:** one "review this" button on the color page that enters the spaced-review deck, not a separate "name it again" card. Reuses Learn engine. |
| 35. You've seen this X times | KEEP (motivation, calibration) | LATER (privacy?) | KEEP (calibration skill: self-knowledge) | KEEP (I love stat lines) | KEEP (S effort, event logging exists per CLAUDE.md localStorage) | **KEEP** | S effort. **Quiet one-liner:** "You've visited 5 times, recalled 4." Builds over time; shows learning trajectory. |

**Remember it verdict:** 3 KEEP. All are low-effort integrations into existing spaced-review + logging infrastructure. No new components.

---

### Category 7: Connect it (6 ideas + 2 wild)

| Idea | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| 36. Neighbor web (force graph) | KEEP (naming = perception truth) | KEEP (relational, sourced) | KEEP (conceptual coherence network) | LATER (feels dense on a phone) | LATER (M effort, force-graph library dependency, needs pruning for small screens) | **LATER** | M effort. **Wait for mobile-first mockup.** If it's cramped, skip in favor of the radial or the strip (which already exists). Don't add for M effort without proof of phone usability. |
| 37. Shares a pigment with | KEEP (historical connection) | KEEP (material sourcing) | KEEP (shared origin = mental link) | LATER (niche interest?) | LATER (M effort, needs pigment-sourced tagging across colors; pigment wiki-nodes exist but color tagging is partial) | **LATER** | M effort, data incomplete. **Skip v1.** Revisit when pigment tagging is complete. |
| 38. Shares a myth with | KEEP (myth debunking patterns) | KEEP (once myth facets ship) | KEEP (memory: same misconception structure) | LATER (meta-learning?) | KEEP (S effort, once myth facets exist) | **KEEP** | S effort, gated. **Build once myth-corrected facets exist.** Cheap cross-link then. |
| 39. Artist/movement deep link (from painting) | KEEP (learning path) | KEEP (contextual depth) | KEEP (examples into exemplars) | KEEP (tap to dive) | KEEP (S effort, once §C artist/movement pages exist) | **KEEP** | S effort, gated. **Ship once art-wiki profiles are live.** One-tap from any painting thumbnail. |
| 40. Same family, told differently | KEEP (comparison learning) | KEEP (sibling contrast) | KEEP (compare-and-contrast encoding) | KEEP (aha moments) | KEEP (S effort, jump to sibling color's Read facets) | **KEEP** | S effort. **Ship this; it's gold.** One tap from color name to another family member's page. Reuse existing routing. |
| 41. (Wild) "Ask the color" (constrained chat) | KEEP (grounded Q&A) | LATER (hallucination risk) | LATER (no evidence Q&A beats reading) | KEEP (conversational, I'd use it) | CUT (scope risk, moderation, unclear benefit) | **LATER** | Wild flag confirmed. **Prototype behind a flag if time permits; don't ship without rigorous constraint testing.** High risk of breaking honesty. |
| 42. (Wild) "Mint a card" (shareable image) | KEEP (social signal) | LATER (feels off-brand?) | LATER (not core learning) | KEEP (trading-card appeal) | LATER (L effort, image generation + branding risk) | **LATER** | Wild flag confirmed. **Sketch the design first.** Low strategic priority vs. other L items. Ship only if visual design surfaces naturally from another feature. |

**Connect it verdict:** 4 KEEP, 2 gated on infrastructure, 2 wild flagged (don't build, prototype if inspiration strikes). **Skip 36 & 37 in v1** (incomplete data, phone usability unknown). **Prioritize 38, 39, 40** once dependencies land.

---

## PART 3: COLOR NERD INTEGRATION (§B) & §6 Fixes

### §6 Fixes Priority

| Fix # | Issue | Status | Priority | Effort | Verdict |
|-------|-------|--------|----------|--------|---------|
| 1 | Complementary colors page (3-map framing) | Already fixed | ✓ | — | KEEP (verify once more) |
| 2 | Warm/cool hedge (RYB 'tradition') | Already fixed | ✓ | — | KEEP (verify) |
| 3 | Green/violet contested label | Already fixed | ✓ | — | KEEP (verify) |
| 4 | Harmony page: tone-first framing | NOT DONE | **URGENT** | M | **KEEP** (add to Color Nerd task) |
| 5 | "Brighter" ambiguity (lighter vs. stronger) | NOT DONE | **URGENT** | S | **KEEP** (fix first, before scale) |
| 6 | Eye score (3 axes vs. single ΔE) | Belongs to Train gym | — | — | LATER (defer to train owner) |
| 7 | Home honeycomb CIELAB blue bias | Belongs to honeycomb owner | — | — | LATER (defer) |
| 8 | Names vs. everyday usage | Partially addressed | M | M | **KEEP** (add "most people call this…" to Measured facet) |
| 9 | Dark surround bias | Handled by booth-grey system | ✓ | — | KEEP (confirm existing) |
| 10 | What's already right | — | ✓ | — | KEEP (verify) |

**Fix priorities:** Fix #5 (brighter ambiguity, S) **before scaling.** Fix #4 (harmony tone-first, M) **as part of Color Nerd expansion.** Fix #8 (everyday names, M) **easy add to Read facets.** Verify #1–3 are correct.

---

## PART 4: ART WIKI (§C) — Artist, Movement, Organizational Features

### Artist Profiles & Tiering

| Feature | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|---------|-------|---------|-------------------|------|---------|---------|------|
| **Data profile tier (~737 artists, ≥5 paintings)** | KEEP (coverage) | KEEP (data-sourced) | LATER (not learning, context) | KEEP (discovery) | KEEP (M effort, Wikidata adapter, no prose) | **KEEP** | M effort. Wikidata P569/P570/P135/P27/P1066/P737/P18 (birth, death, movement, nationality, teacher, influenced-by, image). No original bio. Reuse existing `byArtist` (top/dist/L/C). |
| **Full-bio tier (top 100, ≥20 paintings)** | KEEP (depth for major painters) | KEEP (sourced biography) | KEEP (exemplar learning) | KEEP (love learning about masters) | LATER (M effort writing + Wikidata) | **LATER** | M effort. Gate on Wikidata adapter. **After data profiles ship, write 100 bios.** ~300 words each, facts only. |

### Movement Pages

| Feature | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|---------|-------|---------|-------------------|------|---------|---------|------|
| **8 movements with existing data** (Mughal, Impressionism, Pahari, Rajput, Kalighat, Post-Impressionism, Realism, Renaissance) | KEEP (pilot with real data) | KEEP (sourced, existing) | KEEP (period as palette schema) | KEEP (art history is fun) | KEEP (M effort, mostly existing prose + data) | **KEEP** | M effort. Reuse existing `byMovement` computed palettes (8 already exist). Impressionism + Post-Impressionism first (richest data + wiki prose). |
| **Full Wikidata movement pipeline** (P135 reverse lookups, all 837 artists) | KEEP (coverage) | KEEP (comprehensive) | KEEP (full period mapping) | KEEP (completeness) | LATER (L effort, new adapter, blocks other work) | **LATER** | L effort. **Gate this for after artist profiles ship.** High leverage but medium urgency. |

### Other Organizational Views

| View | David | Curator | Learning Scientist | User | Builder | Verdict | Note |
|------|-------|---------|-------------------|------|---------|---------|------|
| Timeline (century/decade + movement bands) | LATER (context, not core) | KEEP (historical framework) | LATER (schema, not perception) | KEEP (I'd browse this) | LATER (L effort, blocked on full movement data) | **LATER** | L effort, blocked on movement pipeline. **Lower priority than artist/movement profiles.** |
| Map (by country, with COMMONS caveat honest) | KEEP (geography) | KEEP (**if caveat shown**) | LATER (location ≠ perception) | KEEP (maps are fun) | LATER (M effort, caveat UX unclear; COMMONS.md §4 says country is painter nationality ~97%) | **LATER** | M effort. **Design caveat UX first.** Risk: imprecise-looking without caveat visible. Defer until caveat design is solved. |
| By museum | KEEP (institutional context) | KEEP (collection sourcing) | LATER (context) | KEEP (visit planning?) | KEEP (S effort, data/gallery source field exists) | **KEEP** | S effort. **Data exists.** Cheap "browse Hermitage" entry point. |
| By subject/genre | KEEP (topical discovery) | KEEP (if sourced) | LATER (thematic, not perceptual) | KEEP (I'd filter by "portraits") | CUT (no subject tagging exists; needs Wikidata P921 or Iconclass ingestion, L effort) | **CUT** | L effort, new data needed. **Skip v1.** Revisit if Wikidata P921 ingestion happens. Low ROI vs. other L items. |
| Painter vs. painter (side-by-side comparison) | **KEEP** (how two palettes compare) | KEEP (relational learning) | KEEP (exemplar comparison) | KEEP (I'd compare Vermeer to Rembrandt) | KEEP (S effort, pure reuse of byArtist fields) | **KEEP** | S effort. **Cheapest "wow" feature.** Reuses existing `top`/`dist`/`L`/`C` — no new data. **Prioritize this.** |

---

## PART 5: VERDICT TABLE — All Ideas at a Glance

### Summary Counts

| Category | KEEP | LATER | CUT | Notes |
|----------|------|-------|-----|-------|
| Read facets (18) | 13 | 5 | 0 | Start with 13 core facets |
| See it (7) | 7 | 0 | 0 | All pass |
| Make it (6) | 5 | 1 | 1 gated | Paint mixer gated on license |
| Play with it (8) | 8 | 0 | 0 | All pass |
| Live with it (4) | 1 | 3 | 0 | Only #25; others gate on Studio |
| Find it (6) | 4 | 2 | 0 | #28 cheap; #29 gated on Wikidata |
| Remember it (3) | 3 | 0 | 0 | All reuse existing |
| Connect it (8) | 4 | 2 | 2 wild | Skip 36/37; keep 38–40 gated |
| Color Nerd §6 fixes | 6 verified | 3 not yet | 1 deferred | Fix #5 (brighter) is URGENT |
| Art wiki (artists) | 1 full | 1 data | 0 | Data profile M, full bios M+writing |
| Art wiki (movements) | 1 pilot | 1 pipeline | 0 | Pilot with 8 existing, then Wikidata |
| Art wiki (views) | 2 | 3 | 1 | Compare painter cheap; map/subject deferred |
| **TOTALS** | **57 KEEP** | **20 LATER** | **3 CUT** | — |

---

## TOP 10 TO BUILD FIRST

**Order prioritizes:** (a) no dependencies, (b) learning ROI, (c) engagement, (d) cost, (e) they unlock other features.

| # | Task | Effort | Why First | Unlocks |
|---|------|--------|-----------|---------|
| 1 | Fix "brighter" ambiguity in `data/colors.js` and `tools/check.js` | S | Closes open bug, improves all colors immediately. Foundation. | All color pages |
| 2 | Grayscale toggle + color-blind preview on color page | S | S effort, high clarity value, directly answers perception questions. Two quick wins. | Do side credibility |
| 3 | Hue-plane slice (see it idea #1) | M | Visualizes "names are regions" philosophy. Core Color Nerd integration. | Color page Do credibility |
| 4 | Which way is it / direction drill (play #15) | S | Reuses existing `vs`/`d` structure in colors.js. Ships in both Train + color page. | Game grammar reuse |
| 5 | Read side facet catalog rollout, **Deep tier batch 1** (Etymology + Measured + History + Pigments for ~30 colors) | M | Spec exists (this plan). Fact-check pipeline ready. Establish prose voice. | Learning loop foundation |
| 6 | Lime-boundary game (play #14) + daily dictionary guess (play #18) | M | High engagement + learning ROI. Color-specific, fun. Boundary training. | Do side depth |
| 7 | Color → ranked artists/museums/decades (find #28, #30, #31) | S | Data already computed in `data/stats.js`. Three quick wins, high discovery value. Reuse gallery shelf. | Art wiki entry |
| 8 | Painter-vs-painter comparison (art wiki, connect it) | S | Pure reuse of existing `byArtist` top/dist/L/C. Cheapest "wow" feature. Zero new data. | Art wiki launch |
| 9 | Artist data profile pages (~737 artists, no prose) | M | Wikidata adapter (modeled on commons.py). Mechanical once adapter exists. Unleashes discovery. | Art wiki completion |
| 10 | Movement pages for 8 with real data (Impressionism, Post-Impressionism first) | M | Existing `byMovement` palettes. Wiki prose already exists. Pair with color page "In painting" shelf. | Period context |

---

## MISSED BY PLAN — Critical Additions

The plan is strong but **philosophy demands these**, especially the color-analysis engine from ROADMAP §21:

### 1. Per-Painting Rich Analysis (§21: "many readings, never one palette")

**Currently in plan:** "In painting" hub shelf with gallery thumbnails.

**Missing:** The rich painting page that §21 describes—multiple palette readings, stats, comparisons, findings in words. The color page's "in painting" should link to a full painting page with:
- Palettes by area / accents / lights-shadows / warm-cool / value-ordered / hidden colors / focal color
- Stats (value key, chroma distribution, warm-cool balance, harmony fit, darkest/lightest)
- Comparisons to painter / movement / decade / archive (percentiles)
- Findings (3–5 sentences, prose not bullets)

**Recommend:** Add "Painting page design + spec" to build list after facets stabilize. This is load-bearing for the philosophy.

### 2. Per-Painter Rich Analysis (§21)

**Currently in plan:** Artist data profiles + full bios.

**Missing:** Palette signature deep dives:
- Cluster paintings by palette, name clusters ("Sargent's four palettes")
- Palette over time (chronological barcode, period detection)
- Signature colors (used far more than peers, with lift numbers)
- Favorite color combinations (chords, co-occurrence lift)
- "Paints like…" (nearest painters by palette)
- Connections to teachers / influences with palette inheritance

**Recommend:** Expand artist profile tiers to include (a) clusters + periods for major painters (top 100), (b) signature colors for all 837.

### 3. Honesty Threshold & Caveat Language

**Currently in plan:** Scattered throughout (hex ≈ screen, photographs of aged paintings, etc.).

**Missing:** One explicit style guide for caveat phrases, reusable across all pages:
- "as photographed" (gallery images)
- "screen approximation" (hex values for gems/pigments)
- "from N paintings here" (minimum sample size before claiming pattern)
- "painter nationality, not place of making" (COMMONS caveat)
- "Wikidata-sourced" (which fields)

**Recommend:** Add to CLAUDE.md's myth list as a "caveat glossary" section so every writer uses the same phrases.

### 4. Poem / Film / Literary Ingestion Roadmap

**Currently in plan:** "In literature" and "In film" facets, **blocked on data.**

**Missing:** Clear go/no-go on:
- `data/poems.js` — status? (Plan says empty; ROADMAP §19 says "29 stories")
- `data/films.js` — research exists (PASSAGES-FILMS.md) but ingested?
- Poetry sourcing (copyright, attribution, <15-word rule)
- Film sourcing (cinematography facts vs. plot trivia)

**Recommend:** Before committing to "In literature" and "In film" facets, clarify ingestion status. These are high-effort unless data is already there.

### 5. Spaced Review Integration (Remember it category)

**Currently in plan:** Assumes existing spaced-review engine (Learn/Review button).

**Missing:** How do Read pages feed spaced review? Is there a "recall this color's etymology before I show you" card? Or just the existing "name it" deck?

**Recommend:** Clarify spaced-review architecture — does it serve only the flashcard loop or does it surface Read facts too? If the latter, add design spec for "fact recall" cards.

---

## HONESTY & SOURCING RISKS

### Highest Risk

1. **Painting pigment claims** ("consistent with ultramarine").
   - Risk: Screen colors are far from paint. Hedge always. Require conservation source before claim.
   - Mitigation: Add "hedged" to pigment vocabulary. Never say "is ultramarine," say "consistent with ultramarine (screen color ≈ pigment)."

2. **Artist signature colors and comparisons** ("used 4x more than peers").
   - Risk: Selection bias (which museums, which photos, which photographers' white balance).
   - Mitigation: Show raw counts ("in 41 paintings here") not percentiles. Say "compared to other paintings in this archive" not "vs. all artists."

3. **Movement and decade statistics** ("Impressionists got lighter after 1880").
   - Risk: Same museum bias + photographer bias + varnish/aging across decades.
   - Mitigation: Normalize per museum if possible. Always caveat "as photographed." Flag small samples (<10 paintings).

4. **Poem and film sourcing** (avoiding misquote, copyright, myths).
   - Risk: If poems.js or films.js aren't real yet, writing facets for them will invent examples.
   - Mitigation: **Don't write facets until data exists.** Facets stay LATER until ingestion is done and verified.

5. **Color-blind previews** (simulating CVD).
   - Risk: Standard matrices (Brettel, Viénot) are rough; real perception varies.
   - Mitigation: Label clearly: "Simulated protanopia (one common type of red-green color blindness)." Never claim perfect accuracy.

### Medium Risk

6. **Botanical / gem meanings** (floriography, flower symbolism).
   - Risk: Traditions are real but often internet-folklore.
   - Mitigation: Source every claim to a book. Never say "rose means love," say "Western tradition associates red rose with love" (cite source).

7. **Etymology** (name origins, first use dates).
   - Risk: Conflicting dates in historical sources.
   - Mitigation: Use fact-check pass (research/FACTCHECK-ETYMOLOGY-2026-10-07.md exists). Caveat: "First recorded use, as attested in…"

### Low Risk (Already Mitigated by Existing Rules)

- Myths list (CLAUDE.md already audited against 18 books)
- Color-nerd facts (sourced, hedged already)
- Hex approximations (already labeled "screen approximation")
- Photography caveats (already in tech section, ROADMAP §21)

**Biggest action item:** For facets relying on poems / films / pigment / movement data, **don't write until data is confirmed real.** When in doubt, leave the facet blank and mark it honestly: "no poem recorded for this color."

---

## BUILD ORDER SUMMARY (NOT SAME AS TOP 10)

The top 10 above are what ship first (foundation). Here's the full phasing:

### Phase 1: Foundation (S tasks, ship in 1 sprint)
1. Fix "brighter" ambiguity
2. Grayscale + color-blind preview
4. Direction drill (reuses existing data)
7. Color → artists / museums / decades (S, data exists)
8. Painter-vs-painter (S, reuse)

### Phase 2: Read Deep (M, ship facet batch 1)
5. Read facets Deep tier, batch 1 (~30 colors, Etymology + Measured + History + Pigments)
   - Triggers: fact-check pipeline, writer hired, David spot-check process running

### Phase 3: Color Nerd + Do (M tasks)
3. Hue-plane slice
6. Lime-boundary game + daily dictionary guess
14. Tone chord + light mixer (Color Nerd Make it)
16. Odd one out family (reuse from ROADMAP §2)

### Phase 4: Art Wiki Launch (M tasks)
9. Artist data profiles (~737, Wikidata adapter)
10. Movement pages (8 with existing data, Impressionism + Post-Impressionism first)

### Phase 5: Deep + Read Facets Scaling (M–L)
5. Read facets Deep + Medium batches 2–n (pipelined with writing)

### Phase 6: Rich Analysis & Connections (M–L)
- Per-painting page design (from §21)
- Per-painter palette clusters + periods
- Artist deep links from paintings
- Movement page "period color evolution"

### Phase 7: Extended Features (M–L, gated)
- Full Wikidata movement pipeline (L)
- Poem / film facets (once data is real)
- Paint mixer (once Mixbox license resolved)
- Photo pairing (once Studio camera ships)

### Deferred (lower ROI or out of scope)
- "Ask the color" (wild flag, scope risk)
- "Mint a card" (wild flag, lower priority)
- Subject/genre views (no data)
- Map by country (caveat UX unresolved)
- Neighbor web (phone usability unknown)
- Pigment-source links (data incomplete)

---

## THE CUT LIST

| Idea | Verdict | Reason |
|------|---------|--------|
| Harmony page tone-first framing | LATER | Spec needed; blocking on Color Nerd deep dive (M) |
| "Then vs now" fade (pigment aging) | LATER | Needs conservation sources; only few pigments; M effort, thin ROI |
| In literature facet | LATER | Data not confirmed real (`data/poems.js` status unclear) |
| In fashion facet | LATER | Requires research/FASHION.md writing + ingestion |
| Symbolism facet | LATER | Thin unless deep story; synthesis work heavy |
| In film facet | LATER | Data needs ingestion; research/PASSAGES-FILMS.md exists but not live |
| In design facet | LATER | Needs research/DESIGN-COLORS.md |
| Variants facet | LATER | Low ROI; include only if documented |
| Export palette seeded (idea #13) | LATER | Overlaps Studio; ship once Studio export exists |
| Pigment aging toggle (idea #4) | LATER | High effort, few colors qualify |
| Photo pairing (idea #22) | LATER | Blocked on Studio camera |
| Name in wild (idea #23) | LATER | Outdoor color-match hard; research first |
| Outfit/room mockup (idea #24) | LATER | Overlaps Studio; gate on Studio mockups |
| Poems/film deepened (idea #27) | LATER | Data not confirmed real |
| Movement match (idea #29) | LATER | Only 8 of 200+ movements have data |
| Neighbor web (idea #36) | LATER | Phone usability unproven; M effort |
| Pigment link (idea #37) | LATER | Data incomplete; revisit when tagging done |
| Timeline view | LATER | Blocked on full Wikidata pipeline |
| Map by country | LATER | Caveat UX unresolved |
| Subject/genre view | CUT | No data exists; needs Wikidata P921 ingestion; low ROI |
| **Lime boundary idea #14 (originally Play)** | KEEP | Correction: this is HIGH priority, not LATER |
| **Afterimage hunt idea #17 (originally Play)** | KEEP | Correction: this is HIGH priority, not LATER |

**Final CUT count: 1 idea** (subject/genre, no data, L effort, weak ROI vs. other L items).

---

## FINAL VERDICT: ALL REVIEWERS SYNTHESIZED

| Reviewer | Main Asks | Concerns | Bottom Line |
|----------|-----------|----------|-------------|
| **David** | Everything through color, never one palette. Measure then tell. Grounded and honest. Depth by default, calm on surface. | Beware padding facets when data is missing. Avoid modes/menus—one clear path. Painting page must be rich (§21). | 57 KEEP; respect the "measure then tell" rule—skip facets without data. Prioritize painting + painter analysis from §21. |
| **Curator** | Accuracy, sourcing, honesty. Real stones, real poems, real pigments. No invented myths. Caveats visible. | Poem/film data must exist before facets ship. Pigment claims need conservation sources. Avoid selection bias in artist rankings. | 53 KEEP; insist on fact-check pass before writing. Caveat glossary in CLAUDE.md. Don't write facets for data that isn't real yet. |
| **Learning Scientist** | Recall before reveal. Spaced review. Interleave neighbors. Perceptual skills need varied examples. Progress = delayed unassisted recall. | §15 in the KB warns "learning feels backwards." Do not promise progress from weak signals. Avoid echo chambers (one reading per painting is an echo chamber). | 54 KEEP; color page Read + Do together enable the full cycle (encode via Read, practice via Do, spaced review via Learn). Lime boundary + direction drills are evidence-strong. |
| **Casual User** (David's sister) | Is it fun? Can I tap it? Would I come back? | Too many modes confuses. Some facets feel "for nerds." I want the aha moments and the freedom to explore. | 48 KEEP; prioritize Do side (games + mix + find + connect). Read facets should load on demand, not be pushed. Games come first. |
| **Builder** | Reuse existing data. Effort vs. value. What's already computed? Cheap wins. | Painting/poet/film data ingestion is real work. Don't spec features on data that doesn't exist. Wikidata adapter is M-sized. | 57 KEEP; grayscale + direction drill + painter-vs-painter are S-effort wins with existing data. Deep facets ship in batches (no burnout). Defer Mixbox, Wikidata, poem/film until data is real. |

**Synthesis:** 57 KEEP, 20 LATER, 1 CUT. **Essential rules:**
1. **Don't write facets for missing data.** "In literature," "In film," symbolism, fashion, design all LATER until data exists.
2. **Fix "brighter" first.** Foundation bug, S effort, improves everything.
3. **Ship Read + Do together.** Read establishes grounding, Do practices it. Separate them and Read feels like homework.
4. **Painting page (§21) is non-negotiable.** The philosophy ("many readings") demands it. Design + spec after first facet batch, but plan for it now.
5. **Spaced review is the frame.** All learning features (Read, Do, Journey) feed it. Don't design Read pages without understanding what spaced recall looks like.
6. **Reuse, reuse, reuse.** Grayscale, painter-vs-painter, direction drill all exist as components. Don't build twice.
