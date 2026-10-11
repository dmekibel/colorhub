# The taste engine: learning David's eye, deeper with every choice

*Spec, 2026-10-11. David: "the more I select the smarter it gets and the deeper it understands me." Builds on the existing engine (`js/tastemodel.js`: Bayesian Bradley–Terry, updated after every tap, next question = the one it's least sure about) and the existing trainers (`js/taste.js` "Find your color" / "Find your palette", `js/favrank.js` ranking your colors). Mockups shown to David 2026-10-11: start screen, the ladder steps, "Your style" on a painting page. His choice of variant for the palettes step: pick one of two (3A) while learning, keep-or-skip swiping (3B) later as a relaxed mode.*

## 1. What "smarter with every choice" means, measurably

The engine keeps one honest number: **how often it predicts your next choice before you make it.** Every duel is first a prediction, scored when you tap. The running accuracy over your last 30 choices is the progress meter: it starts near 50% (a coin flip) and climbs as it learns you. No points, no fake progress; if it stops climbing, it says so.

## 2. One model, growing in depth

Utility of anything (a color, a pair, a palette) = a weighted sum of features. Weights are a Gaussian belief (mean and covariance), updated by the existing Laplace step after every comparison. Depth grows because the feature set is layered, and **deeper layers start with small prior variance**, so they only move when the evidence supports them (Bayesian Occam: no overfitting a beginner, no ceiling for a regular).

| Layer | Features | Learns from | Meaningful after |
|---|---|---|---|
| 1. Colors | the existing 10 color features (hue harmonics, lightness and chroma ideal points, hue × lightness) | step 1 duels, hearted colors | ~10 choices |
| 2. Relationships | for a pair: hue gap (same / neighbor / third / opposite, as smooth bumps), lightness gap, warm–cool contrast, saturation match, one vivid + one muted | step 2 pairs | ~20 |
| 3. Structure | the existing 6 palette dials with ideal points, plus: deep anchor present, one-hue ramp, analogous vs complementary, accent count | steps 3–4, kept palettes | ~40 |
| 4. Families and contexts | 12 hue-family affinities; context offsets (wear, room, screen, paint), only when the user picks a context | all of the above | ~80 |
| 5. Your palettes | similarity to palettes you kept (a kernel term: "palettes like the ones you keep"), in a 12-number palette space learned offline from the 42,000 archive palettes (PCA of palette features, `tools/taste_space.py`) | keeps, hearts, saves | ~150 |

Every layer's features are computed the same way for a color, a pair or a palette, so a palette duel also teaches layers 1–2 (its colors and their relationships), and a pair duel nudges layer 3. Comparisons always show **equal counts and equal swatch shapes** (David's rule), so proportions never decide a duel.

## 3. Choosing the next question

- **Most informative** (the existing expected-information rule), from real candidates: real colors from paintings, real pairs that touch on canvases, real palettes from the Selector.
- **Exploration**, about 1 question in 5: a question drawn from the posterior (Thompson sampling) rather than the most informative one, so the engine keeps testing corners it thinks you don't like, instead of trapping you in an echo chamber.
- **Never repeat** an item shown in the last 20 questions.
- **The ladder:** colors → pairs → threes → palettes, about 10 each. Each step starts when the previous one's accuracy plateaus, or after 15 questions, whichever comes first. A returning user goes straight to the step that's least certain.

**Revised 2026-10-11 (David): steps 2 and 3 are best-of-four, not a two-plate duel.**

- **Step 1, colors**, and **step 4, whole palettes**, stay a plain duel: two options, pick one (Both/Neither still available), equal counts and equal swatches.
- **Step 2, "Two that go together."** One anchor color, shown big. Below it, four candidate partners as equal swatches (same size and shape — a 2×2 grid or a row of four, never sized by anything but their own slot). Question: "Which goes best with it?" Tap the best one; then a quiet second ask, "And the next best?", with a Skip. The chosen pair is shown together right after the pick, as the answer's feedback.
- **Step 3, "Adding a third."** The same mechanic one rung up: a pair (two equal swatches side by side) plus four candidate thirds. Tap the best third, then the optional runner-up.
- **Why best-of-four:** a single best-of-four pick carries more information than a duel (it implies three pairwise comparisons at once) and exercises the relationship and structure layers directly, since what's compared is the anchor+candidate pair's features (step 2) or the pair+candidate triplet's features (step 3) — not the candidate alone.
- **Modeling it (Plackett–Luce via pairwise decomposition).** A best-of-four pick is folded into three ordinary Bradley–Terry updates: the winner beats each of the other three. Total evidence is budgeted to equal one duel (weight 1.0), split evenly across those three comparisons (1/3 each) — so a best-of-four question is worth the same as a duel, not three times as much. A runner-up tap adds a second, smaller round: the runner-up beats the two remaining candidates, budgeted at half a duel (0.5), split across those two comparisons (0.25 each). Skipping the runner-up just means that second round never happens; nothing is penalized.
- **Picking the four candidates.** Chosen informatively and kept visibly different from each other (a minimum colour distance between all four): one close neighbor of the anchor/pair, one near-opposite, one same-hue step lighter or darker, and one "wildcard" slot that is most-informative under the current model four times in five, and a Thompson-sampled pick (same ~1-in-5 rate as the rest of the ladder) the rest of the time.
- **Honest accuracy.** Best-of-four's chance baseline is 25%, not 50%. The running meter keeps a 30-question window of (hit, chance-for-that-question) pairs, so a mixed-step window can still report plainly: "picks your favorite of four 61% of the time; chance is 25%."

## 4. Every signal counts, at its own weight

| Signal | Evidence | Weight |
|---|---|---|
| A duel pick | A beats B | 1.0 |
| Both / Neither | each beats / loses to an average option | 0.5 |
| Keep / skip (3B) | beats / loses to an average palette | 0.7 |
| Heart a painting | its palette beats a random archive palette of the same count | 0.4 |
| Heart a color | the color beats a random color | 0.4 |
| Save a palette in Studio | beats an average palette | 0.6 |
| Pick a painter in Odd one out "Play with…" | that painter's typical palette beats average | 0.2 |

Implicit signals are softer because liking a painting isn't always liking its colors. Every signal is logged with its date.

## 5. Taste changes, so the engine forgets slowly

Once a week of use, the covariance is inflated slightly (a forgetting factor, about 3%), so recent choices count more and the model can follow a changing taste. Old evidence is never deleted.

## 6. Showing what it knows (honestly)

"What it's learned about you": up to five findings, each only when the belief is confident (a 90% interval that excludes "no preference"). Each comes with its n, for example "You choose close neighbors over opposites, about 3 to 1 (34 choices)". Below each finding, one example palette that shows it. "Not sure yet" is a designed state. Findings name directions ("more muted than most"), never verdicts on the person.

## 7. Where it's used

- **"Your style"** on every painting's palette control: the Selector's candidates re-ranked by your utility, 3 to 20 colors, labeled "tuned to N of your choices".
- **"Matches your taste"** in the gallery (already reads `S.taste`): upgraded to the new model.
- **Odd one out**: an option to play with palettes you'd like.

## 8. Storage and safety

`S.taste.v2 = { mu, S (covariance, packed), layers, log: [[day, kind, a, b, pick, weight]], acc: [recent hits] }` in localStorage. `migrateState()` gets a step that converts the existing `S.taste.color` / `S.taste.palette` beliefs into layers 1 and 3, so nobody loses their history. The log is capped (last 2,000 events) and the model can be rebuilt from it. Everything runs on the phone, with no server.

## 9. Tests

- `tools/taste_sim.js` gains simulated users with known hidden tastes. Pass if prediction accuracy rises with choices and the learned weights recover the hidden ones (correlation > 0.8 after 100 choices), and if a user whose taste flips halfway is followed within ~40 choices.
- Smoke scenarios: the ladder end to end, Both and Neither, a returning user, an empty state, and "Your style" on a painting page.
- Equal swatches and equal counts in every comparison, checked in the scenarios.
- Screenshots of every state at 440×956 and 375×812; a fresh-context craft critique before merge.

## Layer 5 palette space (built)

*2026-10-11. Offline groundwork so "palettes like the ones you keep" (§2, layer 5) has somewhere to compute a
kernel against. Built: `tools/taste_space.py` (numpy only), `data/taste/space.json`, `data/taste/coords.bin`,
`js/tastespace.js` (the browser port, not yet wired into `index.html`), `tools/taste_space_test.js` (the parity
test) and `tools/taste_space_fixture.json` (its 200-painting fixture).*

**The feature list (30, from any 3-24-color palette with area shares — a painting's pool, a Studio palette, a
kept palette).** The same function computes all 30, in both `tools/taste_space.py` `palette_features()` and
`js/tastespace.js` `tsFeatures()`:

| Group | Features |
|---|---|
| Value (CIELAB L*) | `lab_L_q25`, `lab_L_q50`, `lab_L_q75`, `lab_L_iqr`, `lab_L_range` (share-weighted quartiles; range is max−min among colors holding ≥0.5% of the area) |
| Saturation | `relChroma_mean`, `relChroma_max` (chroma as a share of the most the sRGB screen can show at that lightness and hue — `rel_chroma`, the same gamut-bisection as `tools/palette_picker.py`), `chromaC_mean`, `chromaC_max` (raw CIELAB chroma), `nearNeutralShare` (area with C\*<8), `brightAccentShare` (area with L\*>80 and C\*>20) |
| Color axes & warmth | `lab_a_mean`, `lab_b_mean`, `warmth` (chroma-weighted mean of cos(hue−50°) in CIELAB, +1 = all mass at orange, −1 = all mass at its cyan-blue opposite), `deepAnchor` (1 if ≥3% of the area sits below L\*25) |
| Dominance & structure | `dominance`, `secondDominance`, `topTwoShare` (largest / 2nd-largest / top-two area shares), `shareEntropy` (Shannon entropy of the shares, normalized by ln of the color count) |
| Hue (OKLab) | `hueMag1..4` (magnitude of the hue histogram's first 4 circular harmonics, chroma-weighted — the "12-bin histogram compressed"), `huePhase1Cos/Sin` (the dominant hue axis), `hueCircVar` (= 1−`hueMag1`, spread), `distinctHueFamilies` (count of 30°-OKLab-hue bins holding ≥2% area), `analogousComplementary` (= `hueMag2`−`hueMag1`: positive when area splits across two near-opposite hues, since doubling the angle reconciles a complementary pair that cancels in the plain mean; ≈0 for a tightly analogous *or* a scattered palette), `hueBinMaxShare` (the single fullest 30° bin) |
| Count | `nColorsEff` (colors holding ≥1% of the area) |

Measured on `#FF0000`/`#00FFFF` 50/50 (textbook complementary): `hueMag1` 0.28 (low — the two hues mostly cancel),
`hueMag2` 0.97 (high — doubling reconciles them), so `analogousComplementary` = +0.69. On a single warm color, both
land at 1.0 and it nets to 0. Checked by hand, not just by the parity test below.

**Built from:** every archive painting's own 24-color pool (`data/gallery/d/*.json` field 10), or its 6-color
palette (`index.bin`) for the handful with no pool — the same decode as `tools/oo_collections.py`
`load_gallery()`, duplicated in `tools/taste_space.py` so it has no import-time dependency on a file open in
another session. **42,331 paintings.**

**Pipeline:** standardize all 30 features over the corpus (subtract the mean, divide by the sd), then PCA (plain
SVD, numpy only) to 12 components, sign-canonicalized so each component's largest-|loading| feature is positive.

**Variance explained**, 12 components, cumulative 90.80% of the standardized 30-feature space:

| PC | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| own | 21.85% | 18.44% | 12.53% | 8.38% | 6.87% | 5.71% | 5.35% | 3.12% | 2.79% | 2.36% | 1.86% | 1.55% |
| cum | 21.85% | 40.29% | 52.82% | 61.20% | 68.07% | 73.77% | 79.12% | 82.24% | 85.03% | 87.39% | 89.25% | 90.80% |

**The first 5 components, read from their real top loadings** (`data/taste/space.json` `readings`, re-check
against a fresh run's printed loadings before trusting the wording if the feature set or corpus ever changes):

1. **Saturated and varied vs. muted and grey** (21.85%). Top loadings: `chromaC_mean` (+.34), `lab_b_mean` (+.33),
   `nearNeutralShare` (−.30), `hueBinMaxShare` (+.29), `relChroma_mean` (+.25). High = strong mean chroma, a warm
   (yellow-leaning) cast, many distinct colors sharing the canvas. Low = grey-dominated, blue-leaning, chroma low
   everywhere.
2. **One warm, dark hue family vs. many cool, light ones** (18.44%). Top loadings: `hueMag1` (+.32), `hueCircVar`
   (−.32), `hueMag2` (+.28), `hueMag3` (+.27), `lab_L_q75` (−.26). High = hue mass concentrated in one direction,
   warm, darker. Low = hue spread widely, cooler, lighter.
3. **An even, repeating hue pattern with no deep shadow or single vivid accent vs. several hue families with real
   darks and one punchy color** (12.53%). Top loadings: `hueMag4` (+.34), `hueMag3` (+.32), `lab_L_q25` (+.30),
   `relChroma_max` (−.27), `distinctHueFamilies` (−.27).
4. **One or two colors filling most of the canvas vs. many colors sharing it evenly** (8.38%). Top loadings:
   `topTwoShare` (+.36), `dominance` (+.35), `shareEntropy` (−.31), `lab_L_q25` (+.30), `nColorsEff` (−.28).
5. **Strong light-to-dark contrast with a dark anchor and one vivid, cool accent vs. a flat tonal range**
   (6.87%). Top loadings: `lab_L_range` (+.49), `lab_L_iqr` (+.49), `deepAnchor` (+.28), `lab_a_mean` (−.23),
   `relChroma_max` (+.23).

**Files and sizes:**

| File | Bytes | What |
|---|---|---|
| `data/taste/space.json` | 12,209 | feature names, mean/sd, 12×30 PCA loadings, variance explained, 5 readings, per-component int8 scale |
| `data/taste/coords.bin` | 507,972 | 42,331 × 12 bytes, int8 (= `round(coord/scale)`), gallery order |
| `js/tastespace.js` | 13,058 | `tsFeatures`, `tsProject`, `tsLoad()` — standalone, self-contained color math, not yet in `index.html` |
| `tools/taste_space.py` | 16,695 | builder |
| `tools/taste_space_test.js` | 3,199 | the parity test |
| `tools/taste_space_fixture.json` | 228,696 | its 200-painting fixture (real palettes + Python features + coords, full precision) |

**Parity test** (`node tools/taste_space_test.js`, 200 random archive paintings, JS `tsFeatures`/`tsProject`
loaded in a bare VM context against the Python output):

```
checked 200 paintings
features: max |diff| 4.547e-13 (tolerance 0.000001), 0 paintings over tolerance
coords:   max |diff| 8.216e-14 (tolerance 0.0001), 0 paintings over tolerance

PASS
```

**Not yet done:** nothing in `js/tastespace.js` is wired into the running app (no `<script>` tag, no caller) —
that's for whoever picks up the kernel/similarity step on top of this space, once layer 5's own duel/keep
signals exist.
