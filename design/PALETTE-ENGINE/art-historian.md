# Art History Through Color — Panel Contribution: Curator & Historian

## The core insight from my field

Art history already knows that color is never a free choice — it is a function of three things that palette tools treat as irrelevant: *what pigments existed the day the brush touched the canvas*, *what the painter's hand and eye were doing at that specific moment in a decades-long career*, and *what the object has been through since* (varnish yellowing, fading, museum lighting, the photographer's white balance). A palette tool like Coolors or Adobe Color treats every hex code as free-floating and ahistorical; a curator never does. When I stand in front of a late Rembrandt next to an early one, I'm not looking at "his palette" — I'm looking at a moment in a trajectory, shaped by what was in his studio that decade, who taught him, what he'd just seen, and 350 years of oxidizing linseed oil. The thing palette tools ignore completely is **time as a structuring variable**: color is not a property of a painting, it's a property of a *date*, a *place*, a *hand*, and a *supply chain*. Nobody has built a palette tool that treats a painter's output as a time series with regime changes, teacher-student color inheritance, and pigment-availability constraints — which is exactly the kind of data ColorHub already has (year, artist, country, movement, 1,472 painter analyses with palette-by-decade and change points, teacher/influence links) and exactly where I can take this tenfold past every competitor.

---

## System ideas

### 1. The Palette Timeline — a painter's color life as a readable curve, not a static swatch
**Pitch:** Every painter page gets a horizontal "life color" strip: one representative swatch-cluster per career phase, with the *change points* marked as actual historical turns, not just statistical breaks.

**Mechanism:** `data/analysis/artists/<slug>.json` already computes "palette by decade" and "change point" per painter (1,472 of them). Take the decade-level area-weighted OKLab centroids, run a 1D changepoint detection (already implied by the existing "change point" field — if it's currently a single global break, extend to a PELT or binary-segmentation algorithm over the decade-centroid sequence using total OKLab variance as the cost function, penalty tuned so most painters get 1-4 segments, not 15). Each segment becomes one "era" with its own representative palette (use the swatch book for that date range, filtered to the 3-8 most distinctive-vs-archive-lift swatches, not just most-frequent). Render as a horizontal timeline where era boundaries are *proposed* by the statistics but *labeled* by date-matchable facts we actually have: a move (country field changes), a teacher relationship starting/ending (Wikidata TEACHERS/INFLUENCED-BY with dates), or simply "no named cause — the data shows a shift here" when we have no biographical hook. Never invent a reason the data doesn't support.

**Data used:** `data/analysis/artists/<slug>.json` (palette by decade, change point, signature/avoided colors with lift), `data/artists/meta.json` (birth/death, nationality, TEACHERS/INFLUENCED-BY with dates). Missing: exact year-of-move dates for most painters beyond birth/death and movement tags — Wikidata sometimes has residence periods (P551) we aren't currently pulling; would need a targeted Wikidata query per painter to enrich this, flagged as "not yet fetched" rather than guessed.

**User sees:** On van Gogh's painter page, a strip showing Nuenen-era (muted earth, per his own letters and the data: Browns/olive heavy), Paris-era (lightening, per the group stats showing L* rising decade over decade — exactly the "Europe lightens" finding generalized to one painter), Arles/Saint-Rémy (the vivid complementary-tension era he's famous for). Tap any era to open the full palette-timeline-filtered gallery.

**Self-critique:** This is catnip for the myth machine — it's extremely easy to slide from "the data shows a shift" into "he discovered pure color in Arles" as if it were a clean narrative, when change-point detection on noisy decade centroids with n=8-30 paintings per bucket will produce spurious breaks, and "no named cause" will look evasive next to confident-sounding museum wall text elsewhere. It also privileges painters with enough works per decade (≥10, matching the app's own stats floor) — most of the 1,472 painters will show one flat segment, which is honest but a letdown.

**Improved version:** Show a confidence band on every era boundary (bootstrap the changepoint location across resamples of the decade list, display as a soft gradient zone rather than a hard line) so the UI itself communicates "this is where the shift most likely happened," never a single sharp year. For thin painters, collapse to "not enough dated work to show an arc" rather than forcing a fake timeline — consistent with the "honest caveats" rule.

### 2. Lineage Color Diffusion — how a hue moves through a teaching line
**Pitch:** Trace a specific color or color-habit (e.g. a Prussian blue, a particular yellow-green glaze, "uses black as a hue not a shadow") through a master → pupil → pupil's pupil chain, and show whether it propagates, mutates, or dies.

**Mechanism:** Use `TEACHERS`/`INFLUENCED-BY` (362 + 97 painters) as directed edges, build a small DAG per painter. For a chosen signature color (from the "signature colors with lift" field — a color the painter uses meaningfully more than peers), walk the DAG and compute, for each linked painter, the *lift of the same color family* (using the family taxonomy already defined by hue/L/C bins) in their own signature-color list, plus a cosine similarity between full swatch-book histograms (already OKLab k-means books exist per painter — compare histogram vectors directly, Jensen-Shannon divergence is a good "how similar are these two painters' whole color worlds" metric, more robust than any single color). Build a small propagation score: did the pupil inherit the signature hue family (lift ≥ some threshold in the same family), inherit the general palette structure (low JS divergence) but not the exact color, or show no relationship at all.

**Data used:** `data/artists/meta.json` TEACHERS/INFLUENCED-BY, `data/analysis/artists/<slug>.json` signature colors + lift, swatch books from `data/games/oo/`. Missing: the influence graph is sparse (only 97 INFLUENCED-BY edges across 1,472+ painters) — most painters will have no lineage to show. That's an honest limitation to surface plainly ("lineage data exists for X of our painters"), not something to paper over by inferring influence from stylistic similarity, which would quietly manufacture art-historical claims we can't support.

**User sees:** On a painter with real lineage data (say a workshop master and a documented pupil), a small "color inheritance" card: "shares X's cool-shadow habit (similarity score), but not X's red family." On most painters, the card simply doesn't appear — no lineage data, no forced claim.

**Self-critique:** The directionality (teacher *causes* pupil's color habit) is unproven by correlation alone — pupils and teachers often also share geography, era, and available pigments, which would produce "inheritance" signals that are really just "same city, same decade, same paint shop." Risks implying causation art historians would reject.

**Improved version:** Always report it as "color kinship," never "inheritance" or "influence" in the UI copy, and when teacher and pupil worked in the same city within the same 20-year window, add a visible caveat that shared supply and shared era are the more likely explanation than direct teaching. Keep the strongest, most defensible version of the claim (same movement/era painters who are NOT linked by teaching show how much similarity is just "ambient" — compute that baseline explicitly and only call something "more than ambient" when it clears it).

### 3. Pigment Clock — plausible-pigment overlay per date and region
**Pitch:** For any painting, show which named historical pigments were available at that date and place, and flag palette colors that are chemically-plausible vs. likely a modern photographic/varnish artifact.

**Mechanism:** The repo already has `PIGMENT_SINCE` (introduction dates per named pigment/color, used for anachronism filtering in `tools/gallery.py`'s `pick_lib()`). Extend this into a dated "plausible pigment set" per painting: given year + country, filter the full pigment-availability table to what existed then and there (e.g., chrome yellow post-1809, synthetic ultramarine post-1826, cobalt blue post-1802 — standard, well-documented dates, not disputed ones), then for each measured palette color find its nearest plausible historical pigment by Lab distance *and* its nearest named color overall, and flag a mismatch (nearest named color is a pigment invented after the painting's date) as "likely a photography/varnish effect, not the paint" rather than silently mislabeling.

**Data used:** `tools/paintings.py` `PIGMENT_SINCE`, painting `year`/`country` from the gallery shards, measured pool colors. Missing: a real pigment-availability table with hedged dates per pigment per region (we have dates for naming-anachronism purposes already; would need to confirm it's complete/hedged enough to reuse for this stronger claim, and where a pigment's history is disputed per the CLAUDE.md myths list — Drebbel's scarlet, synthetic vs natural indigo — the overlay must say "disputed" rather than assert a year).

**User sees:** On a 1650s Dutch still life, a quiet note: "no pigment here is later than what Dutch painters had access to in this period" (a *consistency check*, which is actually more honest and more interesting than claiming to identify specific pigments from a photograph — we cannot do real pigment ID from an sRGB photo of a varnished painting, full stop). On a painting with a measured near-fluorescent color that has no period-plausible match, surface it as "this reading is likely varnish/photography, not period-accurate color" — turning a limitation into a feature that teaches the honest-caveats philosophy directly.

**Self-critique:** This is the idea most likely to overclaim. "Plausible pigment available" is miles away from "this color IS that pigment" — oil paint mixing, aging, and varnish make any one-to-one pigment identification from a photo close to fraudulent-sounding if phrased confidently. There's also real risk of false confidence: a photographed color landing near a period-correct pigment by coincidence doesn't mean the painter used it.

**Improved version:** Never say "this is pigment X." Only ever run the test in the *falsifying* direction — flagging implausible colors, never confirming plausible ones as identified pigments — and always pair it with the standing caveat that this is a measured sRGB photograph of a varnished surface, not a conservator's pigment analysis. Frame it explicitly as "a consistency check, not a pigment ID," in the UI copy itself.

### 4. The Movement Atlas — color diffusion across space and time as an actual map
**Pitch:** An animated/steppable map-plus-timeline showing how a hue family (e.g. blues, or "vivid orange") spreads across countries and decades — Impressionist blue-green leaving Paris, Fauvist vividness, etc. — grounded entirely in `groups.json`.

**Mechanism:** `data/analysis/groups.json` already has by-decade and by-country aggregates. Build a country × decade matrix of mean share for each hue family (12-bin hue histogram already computed per painting per §21). Render as a small-multiples grid or an animated choropleth: each cell's color intensity = that family's share-weighted presence that decade in that country, normalized by the archive's overall base rate for that family (so it reads as lift, not raw share, correcting for the fact blue pigments got cheaper everywhere over time — the "blue arrives late" archive-wide finding must be subtracted out before a country-specific diffusion claim is meaningful). This is literally a spatial epidemiology method (diffusion of an innovation across a lattice) applied to pigment adoption.

**Data used:** `data/analysis/groups.json` (decade, country, movement groups, hue histograms), the archive-wide decade baseline already in `research/STATS-FINDINGS.md` ("blue arrives late" numbers). Missing: nothing structurally, but country attribution is sparse and inconsistent (as STATS-FINDINGS documents at length: 808 Rijksmuseum works have no country, "country" sometimes means nationality not place-of-work) — this must be surfaced as a filter/caveat, not smoothed over.

**User sees:** A calm default view — "see Impressionist blue-green spread, 1860s→1900s" with Paris lighting up first, decade by decade — then a tap reveals the raw numbers and the country-attribution caveat (nationality vs. place-of-work, sample sizes per cell).

**Self-critique:** Movement tags are explicitly "sparse and partly inferred from the painter" per the ground truth here — animating a map from partly-inferred movement/country data risks presenting inference as fact at the exact moment (a moving map) when caveats are easiest to skip past.

**Improved version:** Any cell built from fewer than the group's own minimum-n threshold (25 for decade, 25 for country per the existing corpus rules) is shown hatched/greyed rather than colored, and the animation includes a persistent small-print "sample size per cell" readout rather than a one-time disclaimer.

### 5. Varnish-Corrected Comparison — the same painting, "as photographed" vs. "as it likely looked"
**Pitch:** A toggle that estimates and removes the generic yellowing/greying of aged varnish for comparison purposes only — never claiming to restore the painting, only to make fairer comparisons across centuries.

**Mechanism:** The "Europe lightens" finding (mean L* 29.5 in 1600s → 44.3 in 1900s) is partially a conservation artifact (old varnish darkens/yellows) and partially real stylistic change — the existing docs already say so. Build a very conservative, clearly-labeled de-yellowing model: estimate a per-decade "varnish shift" as the portion of the lightness/chroma trend that is implausible as pure stylistic change (e.g., using the *within-painter* trajectories of painters who lived through a dated restoration/cleaning — if any of our 1,472 painters has paintings both before and after a documented cleaning in the museum record, which is unlikely to be in our data, skip; more realistically: model varnish yellowing as a shared multiplicative shift in b* (yellow-blue axis) that increases with painting age, fit from the *archive-wide* age-vs-b* trend after controlling for movement and painter, then offer a toggle that subtracts the generic portion of that trend). Label the result "varnish-adjusted estimate, not a restoration" with a confidence caveat on every view.

**Data used:** Painting `year`, mean L*/C* from `data/analysis/paintings-NNN.json`, archive-wide age trend from STATS-FINDINGS. Missing: real reference data on varnish yellowing rates (conservation science has published aging curves for linseed-oil varnish yellowing — this would need external literature, not present in our corpus, and must be cited/hedged as a general physical-chemistry estimate, not derived from our own photographs).

**User sees:** Side-by-side on an old master: "as photographed" (today's photo) vs. "varnish-adjusted estimate" with a one-line explainer and a confidence note; never a confident "this is the true color."

**Self-critique:** This is the single highest-risk idea for fabrication: any generic de-yellowing model will be wrong for specific paintings (different varnishes, different cleaning histories, different museum lighting), and a confident-looking slider risks training users to trust an invented color as historical truth.

**Improved version:** Ship it only as a *relative* illustrative device bounded to the mildest, most defensible correction (explicitly calibrated against the archive's own age-trend, capped so it never exceeds, say, half the measured age-related b*-shift), always rendered with a visible uncertainty band (a color gradient/noise texture, not a crisp swatch) so the UI itself signals "estimate," and gated behind an explicit "why this is a guess" explainer before the toggle is ever shown — or cut entirely if that can't be made honest enough. Given the fabrication risk, I'd actually recommend shelving this one unless a real conservation-science reference curve can be sourced and cited.

### 6. The Patron's Palette — color by commission type and site, not just painter
**Pitch:** Reveal how color choices shifted by *what the painting was for* — altarpiece vs. portrait vs. cabinet picture — independent of painter, since patronage constraints (church commissions favoring certain symbolic colors, portrait conventions, Protestant vs. Catholic markets) are a real, under-told color story.

**Mechanism:** We don't currently have a "commission type" field. This requires new categorical tagging — some of it derivable from existing metadata (museum department/object-type text often distinguishes "portrait," "altarpiece," "history painting," "still life," "genre scene" — worth checking whether AIC/Met/Rijks records carry a classification field we aren't yet using) plus some requiring a lightweight classifier (painting aspect ratio + subject-matter hints from title text, e.g. regex for "Madonna," "Saint," "Portrait of"). Once tagged, run the same family-lift statistics already used for painter/movement/decade groups, but grouped by genre instead.

**Data used:** Would need a new field extracted from museum metadata (title text, possibly an object-type field not yet mapped into the corpus) plus existing palette stats machinery. Flag explicitly: this needs new data extraction work, not yet present.

**User sees:** "Religious commissions in this period favor X at Y% vs. Z% in portraits of the same decade" — a genuinely new cut nobody else offers, because no competitor ties commission context to measured color at all.

**Self-critique:** Title-text genre classification is noisy and will misclassify plenty of paintings (a "Portrait of a Lady as Flora" is both a portrait and an allegory); confident genre-based claims built on a noisy classifier risk real historical error.

**Improved version:** Only report genre findings where the classifier's confidence is high (clear keyword match, no ambiguity flags) and always show the classification method and its coverage rate ("confidently classified: N of M paintings in this group") alongside any finding.

### 7. Regional-School Color Fingerprints, Corrected for Photography Source
**Pitch:** Compare national/regional schools (Dutch vs. Flemish vs. Venetian) on real measured color, but with museum-photography bias explicitly modeled and subtracted, since right now "country" differences are confounded with "which museum photographed it."

**Mechanism:** The data already spans 7 sources with documented differences in resolution and processing (AIC 200px IIIF, CMA 900px web JPEG, etc.) — these are different cameras/pipelines, which is a real systematic bias risk for any cross-museum color comparison. Before any country/school comparison is shown, run a per-source mean-L*/mean-C* baseline check (already implicitly knowable from the shard data: museum field exists per painting) and either (a) restrict high-stakes country comparisons to multi-source countries where the bias partially cancels, or (b) apply a per-source normalization (centering each source's distribution before pooling) and show both raw and normalized views.

**Data used:** `data/gallery/d/NNN.json` museum field, mean L/C per painting. This is a correction to existing comparisons (groups.json by country), not a new feature exactly — but it is the single most important hygiene fix a historian would insist on before any "Dutch painting is darker than Venetian painting" claim ships, because right now that claim is inseparable from "the Rijksmuseum's camera/pipeline differs from the Uffizi's Wikimedia scan."

**User sees:** Nothing new on the surface — this is a correctness layer under existing country/school comparisons — but a "methodology" tap reveals the per-source normalization and why it matters.

**Self-critique:** Perfect normalization isn't achievable without ground-truth color targets per museum photography pipeline; this can only ever reduce, not eliminate, the confound.

**Improved version:** Be explicit about this exact limit in the caveat text rather than implying the normalization solved it — "adjusted for known differences between museum photography sources; some bias may remain."

### 8. Most/Least Typical as a Narrative Device, Expanded to "the painting that doesn't fit"
**Pitch:** Already computed (`most/least typical painting` per painter) — extend this into a guided "the outlier" story: why does this one painting sit apart from everything else this painter made, with real candidate explanations (a commission constraint, an early/late-career date, a different subject genre) rather than just a number.

**Mechanism:** For the least-typical painting (already identified via distance from the painter's centroid/swatch book), cross-reference its date against the painter's own change-point timeline (idea #1) — is it from a transition era? Cross-reference subject via title keywords — is it the painter's only known portrait among 200 landscapes? This is pure recombination of existing fields into a richer "why" layer, no new math.

**Data used:** Existing `most/least typical` field, decade/change-point data, title text.

**User sees:** Instead of just "this is the least typical Monet," a plain-English candidate explanation: "painted in [decade], right around where his palette shifted; also his only known [genre] from this period" — hedged as "likely explanations," not certainties.

**Self-critique:** Easy to reach for a satisfying-sounding single explanation when the real reason is simply noise in a small sample.

**Improved version:** Only surface a candidate explanation when it's independently verifiable (actual transition-era date, actual unique genre tag) — otherwise just report the outlier status honestly with no invented story, matching the house rule against manufactured narrative.

### 9. Workshop vs. Master Disambiguation Signal
**Pitch:** For movements/eras with heavy workshop production (Rubens, Rembrandt-school attributions), use color statistics as a soft, clearly-labeled signal of "closer to the master's hand or closer to typical workshop output" — never an attribution claim, purely descriptive color distance.

**Mechanism:** Compute each attributed painting's OKLab histogram distance to the master's own centroid swatch book vs. to the broader "circle of" output (if we have any workshop-attributed pieces at all — check corpus for "Workshop of"/"Circle of" entries, which the corpus-building docs say are *dropped* from artist attribution currently). This actually surfaces a data gap: the corpus currently excludes workshop/circle attributions entirely ("the row keeps no artist"). 

**Data used:** Would require NOT dropping those rows but instead tagging them distinctly — a corpus change, flagged as needed, not currently available.

**User sees:** Nothing yet — this is a "data we'd need" idea.

**Self-critique:** Even with the data, color-distance-to-master is extremely weak evidence for attribution (conservators use far more: brushwork, underdrawing, dendrochronology) — this must never be framed as evidence for real attribution debates, which are serious scholarly and financial matters.

**Improved version:** Frame purely as "color-similarity to [master]'s signature palette" as one playful data point, with large explicit text that this is not and cannot be an attribution judgment.

### 10. Decade Zeitgeist Cards — the measured mood of a decade, cross-checked against period color theory
**Pitch:** For each of the 67 decades, a short card pairing measured color facts (from `groups.json`) with what period color theory/treatises actually said at the time (Chevreul in the 1830s-40s, Munsell early 1900s, Itten 1920s) — showing where theory and measured practice agreed or diverged.

**Mechanism:** Mostly editorial/curation work layered onto existing decade stats — pull the decade's top/lift colors and harmony-fit distribution, pair with a one-line, well-sourced note on contemporaneous color theory (needs real citation, kept short per the copyright rule, non-fabricated).

**Data used:** `groups.json` decade entries; new editorial content (needs real art-historical sourcing, written by me/curator role, not generated).

**User sees:** "1880s France: the measured data shows blue+green area roughly doubling vs the 1860s; this is the decade Chevreul's simultaneous-contrast ideas were widely discussed in Parisian painting circles" — correlation stated as timing coincidence, not causation, since we can't prove individual painters read Chevreul from pixel data alone.

**Self-critique:** Very easy to imply causation ("Impressionists painted this way *because of* Chevreul") which is a genuinely contested art-historical claim (scholars disagree how directly Chevreul influenced individual painters).

**Improved version:** Always phrase as temporal co-occurrence, explicitly flag the causation question as debated, cite real sources for the theory side only.

---

## My one wild idea: The Color Zeitgeist Engine — a navigable "state space" of Western (and non-Western, where data allows) painting color across 500 years

Take every painting's measured palette (the 24-color pool, OKLab) and every group's aggregate (painter/decade/country/movement), and embed the *entire corpus* in a single low-dimensional space (UMAP or t-SNE over each painting's 12-bin weighted hue histogram + L*/C* summary + entropy — not raw pixels, which we don't have per-pixel anyway) such that paintings that are colorically similar sit near each other regardless of painter, date, or country. Then overlay every grouping we already compute — painter trajectories become literal paths through this space (idea #1's timeline, now spatial), movements become clusters, countries become regions, decades become a time-slider that reveals the whole cloud of Western painting visibly drifting (toward lighter, cooler, more saturated territory) as you scrub forward — and teacher/pupil lineages (idea #2) become visible as short, nearby jumps vs. long leaps. This is literally plotting 500 years of art history as a single navigable color-shaped galaxy, built entirely from data we already have (pool, year, artist, country, movement, lineage), with zero per-painting fabrication because every point is a real measurement and every path is a real painter's real paintings in real sequence. The "wild" part: let a user drop a pin anywhere in the empty space between clusters and see the nearest real paintings to that imagined color-personality — "show me paintings as colorically adventurous as late Monet but as dark as early Rembrandt" becomes a literal nearest-neighbor query across the whole corpus, something no competitor's tool, museum site, or color tool on earth currently offers, because none of them have both the corpus breadth and the per-painting color measurement depth we do.

---

## What I need from the other specialists

- **Mathematician/statistician:** rigor on the changepoint detection in #1 (right algorithm, right penalty, honest confidence intervals) and on what distance metric (JS divergence vs. cosine vs. earth-mover's distance on histograms) is most defensible for comparing swatch books/palettes across painters in #2 and the wild idea's embedding.
- **AI researcher:** whether a learned embedding (not just UMAP on hand-built features) could better capture "feels like the same color-personality" for the Zeitgeist Engine, and how to keep it explainable enough that we can still say *why* two paintings landed near each other (a black-box embedding would violate the "measure, then tell" rule).
- **Painter (practicing):** a gut check on whether the "era" segmentation in #1 and the "signature colors" in #2 actually match what painters experience as real shifts in their own practice — do these feel like real moments, or statistical noise dressed up?
- **Fashion colorist:** a model for how to talk about a painter's "palette aesthetic" (harmony, restraint, boldness) in consumer-friendly language without flattening the historical specificity I'm trying to preserve — fashion colorists are good at naming a "mood" from data in ways a historian's prose sometimes isn't.
- **Web designer:** how to surface a 500-year navigable color-space (the wild idea) on a phone screen without it becoming an overwhelming toy — what's the "calm surface" version of a galaxy of 23,000+ points.