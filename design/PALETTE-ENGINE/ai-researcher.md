# The AI/ML Researcher's Contribution — ColorHub Palette & Color-History Systems

## The core insight from my field

Palette tools treat color extraction as a *clustering problem on one image*. My field treats it as a *representation-learning problem over a corpus*: once you have 42,331 paintings, the interesting unit isn't a painting's six colors, it's the *distribution* those colors come from, and the *latent structure* — the manifold of "what colors go together in this painter's hand, in this period, in this movement" — that no single painting fully reveals. Three things ML knows that rule-based palette extraction ignores:

1. **"Beautiful" and "typical" are different, learnable targets, and neither is "mean."** Averaging a painter's colors (what every competitor effectively does when they show "Monet's palette") destroys exactly the thing that makes a palette feel like the artist — the outliers *are* the signal. A contrastive or ranking model trained on *relative* preference data (A looks more "like this painter," or more "beautiful," than B) learns a scoring function that rewards distinctiveness and harmony jointly, which is literally what David described wanting in his own words ("not about average").
2. **Palettes are sets, not sequences or vectors, and the right model class for sets is permutation-invariant** (DeepSets/Set Transformer-style pooling), because "5 colors" and "12 colors" are the same object at different resolutions, not different objects. This gives us a principled way to do David's "variable color count" requirement: not "pick N clusters," but "add colors until the set's own objective stops improving," the same logic k-means-with-a-stopping-rule already uses in `tools/oo_collections.py`'s swatch-book sizing, generalized to a learned objective instead of a fixed error threshold.
3. **A corpus this size lets you de-bias.** Varnish yellowing, museum photography drift and chroma loss from aging are *systematic*, not random, which means they're learnable and partially reversible — not by "restoring the true painting" (we can't, and shouldn't claim to) but by modeling the *shift itself* as a nuisance variable and reporting color claims net of it, honestly, with uncertainty.

Everything below is static-buildable (Python offline, ship JSON/weights, run inference in-browser with a tiny model or pure math) unless I say otherwise, per the "static site, no server" constraint.

---

## System ideas

### 1. The Beauty-and-Distinctiveness Palette Scorer ("Vivid-Pick")
**Pitch:** A learned scoring function that picks the palette from *all candidate subsets* of a painting's 24-color pool that is simultaneously harmonious and distinctive — replacing "most colorful" with "most *this painting*."

**Mechanism:** Define a palette score S(P) = w1·Harmony(P) + w2·Distinctiveness(P) + w3·Coverage(P) − w4·Redundancy(P), each term computable from the pool:
- Harmony(P): mean pairwise hue-circle distance against a learned "pleasant spacing" prior (fit from a small human-rated dataset — see missing data below) rather than a hard-coded Itten rule.
- Distinctiveness(P): for each candidate color, its area-weighted vividness (perceived chroma — already computed for Odd-One-Out) relative to the *painter's own* hue-lift vector, so a blue is rewarded only if it's more saturated than this painter's typical blue, not any blue.
- Coverage(P): how much of the pool's total area-weighted information the subset explains — a simple proxy is 1 − KL-divergence between the painting's full hue histogram and the subset's.
- Redundancy(P): penalize two colors within ΔE2000 < 8 unless the user explicitly asked for near-duplicates (a "gradient of two similar colors" mode, which is a *different* explicit control, not this scorer's default).

For variable N: start at N=3, do greedy subset selection (add the pool color that most increases S(P) marginally), stop when the marginal gain drops below a threshold *or* let the user slide N and show the greedy sequence — so "5 colors" and "12 colors" are nested, not recomputed from scratch, which also makes the slider animate smoothly (colors appear, they don't reshuffle).

**Data used:** `data/gallery/d/NNN.json` pool (24 colors × share), painter hue-lift vectors from `data/games/oo/`. Missing: a ground-truth "humans rated this palette as beautiful/distinctive" dataset to fit w1–w4 and the harmony prior properly — see Idea 7 for how to get it from in-app behavior instead of asking David to hand-tune four weights.

**User sees:** On a painting page, a "Vivid pick" mode button next to Diverse/Stand out/Harmonies, with the existing 3–20 slider. Example: *Wheatfield with Crows* — the greedy sequence would plausibly surface the deep navy and oxblood first (highest distinctiveness relative to van Gogh's own palette, since dark saturated reds are rarer in his late work than people assume), then the cobalt and warm yellow as the complementary pair, with sap green as a fifth "glue." (This is what the mechanism *would* produce; I haven't run it — no fabricated numbers.)

**Self-critique:** Four hand-set weights is just a fancier rule engine wearing a scorer's clothes — it will feel arbitrary and will need constant retuning, and "distinctiveness relative to painter" can reward noise (a single mis-extracted pixel color) as much as real character. It also has no way to know if David's *taste* differs from "mathematically distinctive."

**Improved version:** Replace hand-set weights with weights fit by logistic regression on pairwise comparisons collected passively: every time a user picks "Vivid" over "Diverse" on the same painting (or swipes one palette card away faster than another in a future palette-rating UI), that's a preference pair. Even 200–500 such pairs (easy to collect from David alone in a week of normal use) let you fit 4–8 weights with real signal instead of guesses, and the whole thing stays a GLM small enough to ship as four floats — not a neural net, no inference cost, fully static.

---

### 2. Painter Palette Embeddings + the "DNA" Map
**Pitch:** Embed every painter (and movement, decade, country) as a point in a learned color-style space, so "painters near Monet" or "the most Fauvist decade" becomes a nearest-neighbor query instead of a hand-written label.

**Mechanism:** For each painter with n≥12 (already the clustering floor in `data/analysis/artists/`), build a feature vector from existing fields: mean L*, mean C*, warm/cool fraction, entropy, vivid share, the full 12-bin hue histogram (share×chroma weighted), signature-color lift vector, hue-lift vector (12-dim) from Odd-One-Out. Concatenate → z-score → reduce with PCA to ~2-3 components fit once over all 1,472 painters (or 678 with swatch books), store the projection matrix (tiny) in a static JSON. This gives every painter an (x,y) or (x,y,z) coordinate for free, no neural network required — PCA on hand-engineered, already-computed features is honest, cheap, and fully explainable, unlike a black-box embedding.

**Data used:** `data/analysis/artists/<slug>.json` (all fields), `data/games/oo/` hue-lift vectors, `data/analysis/groups.json` for movement/decade/country versions of the same vector. Nothing missing — this is pure recombination of data already built.

**User sees:** A "color-DNA map" — a 2D scatter (like a galaxy) where every painter is a dot, colored by their mean hue, sized by corpus count, with Monet, van Gogh, Sargent labeled and nearby dots revealing painters you've never heard of who share a color signature. Tap a dot → painter page. A slider morphs the same map between "painter view," "decade view," "movement view" — same math, different point set. Example: Hokusai and Hiroshige would likely cluster near each other on a blue-vivid axis distinct from the Barbizon painters' muted greens; the map would show this as literal proximity instead of a sentence.

**Self-critique:** PCA on 20-ish engineered features will mostly just recover "lightness" and "saturation" as the first two axes — a map that's secretly just a brightness/chroma scatter is boring and not new. It also conflates "painted mostly dark portraits" with "has a dark temperament," which is a stretch of the data (photography/varnish confound, see Idea 6).

**Improved version:** Residualize out L*/C* first — regress the feature vector against (mean L*, mean C*) and keep only the residuals, so the map's remaining axes capture *hue character and relationships* (which colors co-occur, lift patterns) rather than "overall darkness," which is already shown elsewhere on every painter page. Also label the axes post-hoc by correlating them back to interpretable fields ("this axis tracks warm/cool fraction," "this axis tracks pair-lift complementary-ness") so the map teaches color vocabulary instead of being a pretty unexplained scatterplot — in keeping with "learn by seeing."

---

### 3. Contrastive Palette Retrieval ("find paintings that feel like this palette")
**Pitch:** Type or build a palette, and retrieve paintings/painters/movements whose *color relationships* match — not whose colors literally overlap, which is what naive nearest-neighbor-on-hex would do and would just retrieve "other paintings with blue in them."

**Mechanism:** Represent a palette (3–20 colors with shares) as a fixed-size "palette signature": a 12-bin hue histogram weighted by share×chroma (already computed per painting for the harmony-fit heuristic) concatenated with 4 relational features — hue-circle spread, max complementary tension (biggest hue-pair at >150° apart weighted by both shares), value contrast range, and chroma variance. This is a ~16-dim vector, cheap, and already derivable from existing per-painting stats in `data/analysis/paintings-NNN.json`. Retrieval = cosine similarity in this 16-dim space, computed client-side (23,531 painting vectors × 16 floats ≈ 1.5MB — small enough to ship as a static binary blob and brute-force in JS, no server, no approximate-NN library needed).

**Data used:** `data/analysis/paintings-*.json` hue histogram + warm/cool + chroma bands; could be precomputed once as a flat binary alongside `index.bin`.

**User sees:** Build-a-palette tool (drag colors, or start from a painting's palette) → "Paintings that feel like this" rail, cross-painter, cross-movement, cross-century. Example: build Café Terrace at Night's cobalt/orange/near-black signature, and the system would surface other high-complementary-tension night scenes — plausibly some Hopper-adjacent or Nighthawks-era American paintings if in the corpus, or Rembrandt's darker candlelit works, purely from relational color math, not subject matching (we have no scene labels, only color).

**Self-critique:** 16 hand-picked relational features is a thin signature; it will retrieve things that are relationally similar but *feel* completely different (two paintings can have the same hue-spread and contrast numbers while looking nothing alike, because the actual spatial arrangement differs and we have no spatial data in the pool, only an unordered 24-color bag with shares). It will also always find *something*, even for weird palettes, with no honesty about weak matches.

**Improved version:** Report and show a similarity score band, not just top-k — "closely related" (cosine > 0.9) vs "same family, looser match" (0.7–0.9) vs none above threshold → say so explicitly ("nothing in the archive matches this closely," which is itself an honest, interesting finding about how rare a palette is). Combine with Idea 7's learned weighting once preference data exists, so retrieval quality improves instead of staying fixed at hand-picked feature weights forever.

### 4. The Varnish/Photography De-biasing Model
**Pitch:** A small learned correction that estimates *how much* a painting's measured colors have likely shifted from aging/varnish/photography, so comparisons across sources and centuries are fairer — and so we can *say* the correction honestly instead of guessing at raw numbers.

**Mechanism:** This is the one place a real statistical/ML model earns its keep over simple caveats. Model each painting's observed mean (L*, C*, b*-shift-toward-yellow) as a function of: museum source (fixed effect per museum — AIC vs Rijksmuseum vs Wikimedia-photographed-under-unknown-light), painting age (years since creation, as a proxy for varnish yellowing accumulation), and the painter's own "true" long-run signature (random effect, i.e. a mixed-effects/hierarchical model: `observed ~ museum + age + (1|painter)`). Fit once offline on the whole corpus with `scipy`/`statsmodels` (no GPU needed, this is a linear mixed model, maybe a few thousand rows of painter-decade aggregates). The museum and age coefficients become a small lookup table (12 museums × a slope ≈ 20 numbers) shippable as static JSON.

**Data used:** `data/gallery/index.json` (museum, year, mean L/C per painting) — exactly the fields already in the lightweight index. Missing: no ground truth for "true" original color (we'll never have this for 500-year-old paintings), so this model estimates a *relative* bias (how much more yellow/lower-chroma a 1600s Dutch panel is than a 1990s-conserved AIC painting of similar subject), not an absolute restoration — and must say so every time.

**User sees:** Nothing by default (calm surface) — but any cross-painting, cross-era "X is more vivid than Y" claim in the app routes through a "source-adjusted" toggle: off shows raw measured values with the caveat; on shows the same comparison net of the estimated museum/age bias, with a one-line honest note ("adjusted for likely photography and varnish differences between sources; still not a restoration"). Example: comparing Vermeer's chroma to a contemporary painter's becomes fairer once you've subtracted out "this is a 17th-century Dutch panel photographed under older conservation norms" from both.

**Self-critique:** This is the single idea in this document most at risk of overclaiming — "de-biasing" sounds like we're recovering truth, and a hierarchical model's museum coefficient could just as easily be absorbing real stylistic differences between what AIC collects vs what Wikimedia users photograph, not photography artifacts at all. Confounded and dangerous if presented as fact.

**Improved version:** Never surface a "corrected" color value as *the* color — only ever as a secondary, clearly-labeled, toggle-able lens for *comparative* claims, with the toggle's tooltip stating the model's actual assumption in one sentence, and never applied to a single painting in isolation (only to group comparisons, where the averaging makes the correction more defensible statistically). This keeps it inside the app's own honesty rules instead of quietly becoming a fabricated "true" color.

### 5. Active-Learning Taste Model for Palette Personalization
**Pitch:** Learn what *this specific user* (David, or any user) finds beautiful from the swipes they already do elsewhere in the app (Odd-One-Out, flashcard swipes, taste-model taps), and use it to re-rank palette candidates — without ever asking for new explicit ratings.

**Mechanism:** `js/tastemodel.js` and `js/prefmodel.js` already exist; the move is to feed Idea 1's scorer with a personalized w-vector instead of a global one. Treat every existing implicit signal (a palette the user screenshotted/shared presumably liked; an Odd-One-Out round where they correctly separated hues presumably attended-to-color; dwell time on a palette card) as a weak preference label, and run online logistic regression (a single small weight vector updated incrementally, no retraining pipeline, trivial in-browser math) that nudges Idea 1's four-ish weights per user, stored in localStorage/the existing taste-model state. Active learning angle: when the model is *uncertain* between two candidate palettes for a painting (scores within epsilon), surface both as an explicit "which feels more like this painting?" micro-choice — maximizing information gain per tap rather than asking randomly.

**Data used:** existing `js/tastemodel.js`, `js/prefmodel.js`, Odd-One-Out eye profile — no new data files, this is almost entirely a software integration idea, not a new dataset need.

**User sees:** Nothing explicit most of the time — palettes just get better-targeted over weeks of use, the way a music recommender quietly improves. Occasionally, a two-up "which one?" nudge, framed as a quick game, not a survey.

**Self-critique:** Cold-start is bad (a new user has no signal, so day-one palettes are generic), and there's a real risk of an echo chamber — if the model always shows you palettes matching your inferred taste, you stop being surprised, which cuts against "learn by seeing more."

**Improved version:** Always reserve one slot in any multi-palette view for an explicitly *off-distribution* pick (an epsilon-greedy exploration term), and cap personalization's effect size so it nudges ordering/emphasis, never hides palette modes entirely — depth stays available even when the surface adapts.

### 6. Movement/Decade Change-Point and Diffusion Modeling
**Pitch:** Treat "how a color palette moves through art history" as a time-series / diffusion problem — which colors *entered* the vocabulary when, and which painters were early vs late — turning the existing per-decade `groups.json` data into a genuine historical narrative instrument instead of a lookup table.

**Mechanism:** For a given hue family (say, Prussian-blue-adjacent blues), build a time series of its area-weighted share across decades (already in `groups.json`'s by-decade aggregation) and detect change points with a simple method already used elsewhere in the codebase (the painter-level change-point logic in `tools/analyze.py`, generalized to the decade-by-country or decade-by-movement grid). Cross-reference with the painter's own earliest use (from `data/analysis/paintings-NNN.json` years) to flag "early adopters" — painters whose first appearance of a color family precedes the broader decade-level uptick by N years, which is a real, checkable claim from the data (not a myth) as long as it's hedged by "first in our sampled corpus," not "first in art history" (the corpus is a sample, explicitly noted as a limit).

**Data used:** `data/analysis/groups.json` (by decade, country, movement), `data/analysis/paintings-NNN.json` years + hue histograms, TEACHERS/INFLUENCED-BY links in `data/artists/meta.json` for a secondary "did the adopter teach/influence the next wave" check.

**User sees:** On a color's own page (e.g., Prussian blue, a real pigment with a real invention date — not a myth), a mini timeline: when it enters the sampled corpus, which decade/movement's share spikes, and (hedged) which painters in the archive used it earliest relative to their peers. Example: synthetic ultramarine's documented post-1826 availability could show up as a visible uptick in blue vividness share starting in the right decade band — a genuinely new, checkable, non-mythical historical color story, distinct from the hand-written pigment-era hint already in `PIGMENT_SINCE`.

**Self-critique:** Movement tags are sparse and partly inferred from the painter (stated as a known limit), and country/decade bins can be thin for early centuries, so change-points there are noise dressed as signal. "Early adopter" claims are exactly the kind of causal-sounding statement that's easy to overclaim into a myth ("X invented the use of Y color") when it's really "first in our incomplete, AIC/Commons-skewed sample."

**Improved version:** Every change-point claim ships with its own n (paintings in that decade/movement bin) and is suppressed below the group-size floors the codebase already enforces (decade/country 25, movement 20); "early adopter" language is always phrased as "earliest documented use *in this archive*" with a one-tap link to see the bin size, turning the limitation into transparency rather than hiding it.

### 7. Learned Harmony Prior from Implicit Panel Data (closing Idea 1's weakness)
**Pitch:** Instead of hand-coding "complementary/analogous/triadic" as geometric hue-circle rules (what `glHarmonyFamily` does now), learn a continuous harmony preference surface from any rating data we can scrounge — including, cheaply, David's own panel-style review process.

**Mechanism:** Every time a craft-critique or design review (already part of ColorHub's process per CLAUDE.md) rates a palette/screen, that's a label. Even 50-100 such judgments, encoded as hue-pair + value-pair + rating, are enough to fit a low-order model (e.g., a small radial-basis or even a 2D histogram-smoothed lookup over hue-difference × chroma-difference → "pleasantness") that's more nuanced than three fixed geometric categories, while staying tiny enough to ship as a lookup table, not a network.

**Data used:** New — this needs a lightweight rating log that doesn't exist yet. Minimal viable version: log every palette a human (David or craft-critique agent) explicitly approves/rejects during design review into a flat CSV/JSON, starting now, cheap to add.

**User sees:** Nothing directly — this is infrastructure that makes Ideas 1 and 3 better over time. Indirectly: palettes feel more "right" without anyone being able to say why a rule changed.

**Self-critique:** 50-100 labels from one person (David) is not enough to generalize past his personal taste, and conflating "harmony" (a near-universal perceptual fact) with "David's taste" (personal) is exactly the kind of silent scope-creep that undermines the "grounded and honest" rule if we ever present it as objective.

**Improved version:** Keep two separate models explicitly labeled: a small corpus-wide "harmony prior" (geometric rules, kept as-is, presented as convention per Itten/Matsuda, already correctly hedged in `research/ANALYSIS.md`) and a separate, clearly-personal "your taste" adjustment layered on top only when personalization is on (ties back to Idea 5) — never merging the two into one number that looks objective but is really one person's panel feedback.

---

## My one wild idea: a generative "palette language model" over the whole corpus

Train a small (few-million-parameter, CPU-trainable, distillable-to-static-lookup) autoregressive or diffusion model over *sequences of (hue, chroma, lightness, share)* tokens, conditioned on painter/movement/decade embeddings from Idea 2 — essentially a tiny "palette GPT" that has seen all 42,331 paintings' 24-color pools as training sequences. Once trained, it can *generate* a plausible-but-novel palette "in the style of van Gogh's colorful period" or "a Fauvist decade-style palette that doesn't exist in any single painting" — sampling from the learned distribution rather than retrieving or re-deriving from one real work. Critically, every generated palette would be labeled, unmissably, as *synthetic / generated, not measured* — a creative tool sitting clearly outside the measurement system, satisfying "never fabricate data" by construction (it's declared fabricated-on-purpose, for inspiration, like a "What If" feature for designers wanting a palette archive entry that captures a movement's *essence* rather than any one painting). Trained once offline, the sampling itself can run as a tiny weight matrix multiply in-browser — no server needed even for generation.

## What I need from the other specialists

- **Mathematician:** A principled, non-ad-hoc objective for "distinctiveness vs harmony" trade-off in Idea 1 (right now it's a weighted sum I can only fit empirically) — ideally a geometric argument for why certain hue-circle distances are inherently more pleasant, to serve as the *prior* that Idea 7's learned layer only has to nudge, not invent from scratch.
- **Statistician:** Rigor on Idea 4's mixed-effects model — is museum really a clean fixed effect, or confounded with country/era in ways that need a proper confound analysis before I ship any "adjusted" number; also proper significance/sample-size floors for Idea 6's change-points.
- **Painter:** Ground-truth intuition on whether Idea 1's "distinctiveness relative to the painter's own hue-lift" actually matches what a trained eye calls "characteristic" — my math might be rewarding noise a painter would immediately dismiss as an outlier pixel, not a real stylistic choice.
- **Art historian:** Which of Idea 6's "early adopter" claims are actually supportable given real pigment history and trade routes (so the hedging is accurate, not just cautious-sounding), and whether movement/decade bins should be re-weighted by known historical events (wars, trade embargoes affecting pigment availability) rather than treated as a neutral time axis.
- **Web/color designer:** How to surface Idea 3's similarity-score bands and Idea 4's "adjusted" toggle without turning the calm surface into a settings panel — these are the two ideas most likely to violate "calm on the surface" if implemented literally as I've described them.