# The color analysis engine: method and caveats

Built 2026-10-08 by `tools/analyze.py` (ROADMAP.md §21, extending §15). Data only — no UI; a later design pass
puts this on painting, painter, movement, decade, country and museum pages. Checks: `tools/analyze_test.py`;
`node tools/check.js`, `check_wiki.js`, `check_names.js` all still pass unchanged.

## Inputs

- The painting corpus, in `tools/gallery.py`'s own order (`load_corpus()`) so `data/analysis/paintings-<n>.json`
  lines up positionally with `data/gallery/d/<n>.json` — 23,531 paintings, same order, same 100-painting shards.
- Each painting's 24-color pool with area shares, `research/_raw/corpus-pool.jsonl` (gitignored; built by
  `tools/gallery.py`'s `run_pools()`). **Not in this worktree** — it's a 3.8 MB cache file under the gitignored
  `research/_raw/`, which worktrees don't share. `find_raw_dir()` falls back to the main checkout three levels
  up (`<checkout>/.claude/worktrees/<id>` → `<checkout>`), the same fallback `tools/gallery.py`'s own docstring
  already documents for this exact situation. 0 of 23,531 paintings fell back to the thinner 6-color `p` palette
  on this run — the pool cache was complete.
- `data/core-names.json` (~1,000 names) for naming, and `tools/paintings.py`'s `PIGMENT_SINCE` for the hedged
  pigment-era hint. Both reused as-is, not modified.

## Naming

"The app's naming" here means `js/naming.js`'s `nameOf()`, ported to Python: nearest of the ~1,000 core names by
CIEDE2000 (`tools/library.py`'s `de2000`/`labs`, reused, not re-derived), with the same thresholds
(`VERY_CLOSE_DE=3`, `NEAR_DE=8`) and the same fixed modifier grammar (pale/light/dark/deep, greyish/dusty/
bright/vivid, five hue leans) when the match isn't close, falling back to an honest "between X and Y" when
nothing is close at all. This is a **different, smaller system** than `tools/gallery.py`'s `pick_lib()` (which
names the 6-color `p` field against the ~2,700-entry reference library for painting-page swatches, with
anachronism filtering via `PIGMENT_SINCE`) — that system is untouched. The 24-color pool is named against the
same ~1,000-name list the rest of the app already uses for "tap a color, get its page," so a swatch tapped from
a painter's palette-cluster card lands on the same name a learner would meet in the Journey.

All 564,744 pool colors across the corpus are named in one batched pass (flatten → one `labs()` call → chunked
`de2000` against the 1,000-entry core matrix → regroup), rather than once per painting, for speed (the full
build takes about 100 seconds end to end on a laptop, naming included).

## What the pool supports, and what it doesn't

The pool is up to 24 (hex, area share) pairs per painting — richer than the corpus's own 6-color `p` field, but
still a palette, not a pixel grid. Two items from §15/§21's wish list need real pixel positions, which don't
survive into the pool, and are **not computed here**:
- "top vs bottom of the picture" (sky vs ground) — no spatial information in a palette.
- the live 3/6/12/20 palette slider — already derived client-side from this same pool by `js/gallery.js`'s
  `glPoolPick()` (per `tools/gallery.py`'s own docstring); duplicating it here would only add bytes.

Everything else in §21's list is computed, but is a **palette-level proxy** of a pixel-level truth: the L*
histogram, contrast range (p5–p95 of L*, weighted by share), gamut area and "distinct color count" all describe
the painting's 10–24 extracted colors, not its millions of pixels. "Focal color" (chroma × local-contrast proxy)
approximates local contrast as chroma × |that color's L* − the painting's own share-weighted mean L*|, since
there's no pixel position to measure real contrast against a color's actual neighbors. These are documented
once, in `data/analysis/index.json`'s `caveats`, rather than repeated on every record.

## Per-painting readings (§21)

- **Palettes.** The pool's hex + share (already share-descending) is **not re-shipped** — `data/gallery/d/*.json`
  already has it, in the same order. Only the new judgment calls are stored, as pool-position indices: accents
  (small share, high chroma, ΔE ≥ 15 in Lab from the top-2 area colors), hidden colors (chroma < 22, a family
  that differs from the painting's dominant family, excluding the top-2), the focal color, the "glue" mid-tone
  (highest-share color in the 35–65 L* band). Value-ordered, darkest/lightest and the shadow/mid/light bucketing
  are **not shipped either** — a viewer that has already decoded the pool's hex can get L* from `js/core.js`'s
  own `lab()` exactly as cheaply as this job can, so shipping a sort or a threshold test again would be pure
  duplication, not new information. Only each color's **name** (the one genuinely expensive lookup) and the
  **judgment-call picks** (focal/glue/accents/hidden, which rest on more than a single mechanical comparison)
  are worth precomputing and shipping.
- **Stats.** Value key (high/mid/low at L* 65/35), a 10-bin L* histogram, contrast range, chroma bands
  (muted/moderate/vivid at C* 15/35), warm/cool balance (share×chroma-weighted, split at the same h=100 boundary
  the app's own family rule already uses for where greens start — see `tools/corpus.py`'s family table), a
  12-bin hue histogram (share×chroma-weighted, per spec), gamut area (convex hull of a\*b\*, `scipy.spatial.
  ConvexHull`), entropy / effective color count, and a harmony-fit heuristic (analogous / complementary / split /
  triad / neutral-dominant) from peak-merging the weighted hue histogram. **Harmony fit is a heuristic, not a
  measurement** — "which template a palette fits" is inherently a matter of convention (Itten, Matsuda), and a
  different, reasonable rule would classify some borderline paintings differently. Treated as a best-effort
  read, not ground truth.
- **Compared.** Percentile vs the whole archive, and vs the painter (when the painter has ≥10 works — a
  stricter bar than the corpus's own ≥6-work inclusion floor, specifically for firing a "than this painter's
  other work" claim). **Decade and movement percentiles are not shipped per painting** — see Size below; they
  live on the group record in `groups.json` instead.
- **Findings.** Generated two ways: a few (vivid-%, same-lightness "glow," the hedged pigment-era hint) are
  computed inline while the painting's raw L/C/share are still in scope; the archive/painter percentile findings
  are added once percentiles are known. Thresholds: vivid ≤ 3% or ≥ 50% of the canvas; percentile ≤ 10 or ≥ 90
  (painter version also needs painter n ≥ 10); the "glow" finding needs the top two area colors within 3 L* of
  each other and ≥ 30% of the canvas together; the pigment hint needs `PIGMENT_SINCE` ≤ the work's year ≤
  `PIGMENT_SINCE` + 80. Every finding either carries its own `n` or is self-evidently about this one painting.

## Per-artist readings (§21)

837 artists with ≥6 works (of 5,447 distinct named artists total) — this matches `research/STATS-FINDINGS.md`'s
own +Commons count exactly, a good cross-check that the corpus loader and inclusion floor are consistent with
the rest of the codebase.

- **Clusters** only computed for n ≥ 12 (`MIN_N.artist_cluster`). k-means (hand-rolled — no sklearn dependency;
  k-means++ seeding, 6 restarts, 60 iterations) over a 6-dimensional, z-scored feature vector (mean L*, mean C*,
  warm fraction, vivid share, muted share, entropy), k chosen in 2–5 by mean silhouette score. Each cluster
  reports its size, share of the artist's work, most-typical painting (closest to the cluster's own centroid),
  and its top colors by weighted share.
- **Signature / avoided colors.** Lift = (the artist's own mean share of a name) / (the expected mean share,
  from the same decade+country peer group, falling back to country-only then the whole archive when that group
  is too thin, with the artist's own paintings subtracted out of the baseline so an artist can't inflate their
  own comparison group). Signature needs lift ≥ 1.15, ≥ 3% own share and ≥ 2 paintings' support; avoided needs
  lift ≤ 0.6 and a baseline share ≥ 2% (common among peers). The finding sentences use a stricter lift (≥ 1.3)
  than the raw stored lists, so a middling 1.2x shows up in the data but not as a sentence.
- **Favorite pairs.** Co-occurrence lift of named colors (≥5% share each) within one painting vs the
  independence baseline from each name's own marginal frequency, minimum 3 co-occurring paintings.
- **Palette by decade + change-point.** Mean L*/C* per decade; a change-point is flagged where the biggest
  single decade-to-decade jump in mean L* is ≥ 8, only when ≥ 3 decades exist.
- **Typical / atypical.** Euclidean distance (z-scored feature vector) to the artist's own centroid.
- **Nearest artists.** Euclidean distance between z-scored mean feature vectors across all 837 artists.
- **Findings**, 8 for a well-populated artist like Sargent (see below) — only fire with n ≥ 10
  (`MIN_N.artist_finding`).

## Per decade / country / source (museum) / movement (§21)

Same shape: top colors by area, "distinctive" colors by lift vs the whole archive (≥ 1.25, ≥ 1% own share),
mean L* + percentile, mean vivid share, and findings with the corpus's own established minimum group sizes
(decade/country 25, movement 20, source 25 — the first three match `research/STATS-FINDINGS.md`'s own
thresholds exactly; movement coverage is noted as a known gap, since movement is AIC-only and Commons rows carry
no movement field at all, per that document's §2). A century-level time trend (mean L*, vivid share) sits in
`index.json` for a quick overall-archive read.

## Honesty

- **"As photographed"** is a blanket caveat for the whole corpus (recorded once in `index.json`, not repeated
  per record) — six-plus museum cameras, aged varnish.
- **Country is often nationality, not place of painting**, for several museums (same limitation
  `research/STATS-FINDINGS.md` already documents); **movement is AIC-only**.
- **Pigment claims stay hedged**: a name's `PIGMENT_SINCE` year landing plausibly close to the work's date, never
  a claim about the actual paint used, and always labeled "screen color only."
- **Small groups are anecdotes**: the corpus's own inclusion floor (6 works) is not the same as the finding floor
  (10) — a painter can have data (clusters, signature colors) without ever getting a "findings" sentence if the
  sample is thin.

## Output and size

`data/analysis/`:
- `index.json` — build metadata, thresholds, the `modCodes` legend, century trend, caveats, and a field-by-field
  key glossary (short keys only make sense with a legend next to them).
- `paintings-<shard>.json` (236 shards of 100, matching `data/gallery/d/<shard>.json` 1:1) — compact, index-based
  records; see `index.json`'s `fields.paintings` for the exact key meanings. Two arrays are binary-packed and
  base64'd rather than shipped as JSON int arrays (`cm` for the per-color name+modifier codes, `Lh`/`hh` for the
  two histograms) — the same idiom `tools/gallery.py`'s own `index.bin`/pool packing already uses, just base64'd
  since these live inside per-shard JSON rather than a separate binary file.
- `artists/<slug>.json` — one file per artist with ≥6 works (837 files).
- `groups.json` — `byDecade` / `byCountry` / `bySource` / `byMovement`.

**Total: 13.63 MB, no single file over 62 KB** (well under the ~1.5 MB per-shard ceiling and the ~15 MB total
budget). The main size lever that got it there: the per-painting records never repeat what `data/gallery/`
already ships (hex, share, and anything else trivially recoverable from the hex) — only the name lookup and the
judgment calls are new information, so only those are stored.

**One deliberate scope cut for size**: per-painting percentiles ship for the whole archive and the painter only,
not the decade or movement too (those stay at the group level in `groups.json`, still real, just not duplicated
onto all 23,531+ painting records). Flagged in `index.json`'s `caveats` as a known limitation if a future pass
wants it added back, e.g. by moving to a leaner percentile encoding (a single packed byte per extra comparison
instead of a full object).

## Sample report: John Singer Sargent

37 paintings in the corpus. `data/analysis/artists/john-singer-sargent.json`:

- **Clusters** (k=3, chosen by silhouette): a 49%-share "near-black" cluster (ink, smoky black, dark olive
  brown, bistre, near black — typical painting `nga-1240`), a 38%-share "brown-grey/olive" cluster (brown grey,
  brownish grey, rifle green, linen grey, bister — typical `nga-166471`), and a 14%-share lighter "olive-brown"
  cluster (buffy olive, café noir, dresden brown, dark brown, olive brown — typical `aic-145807`).
- **Signature colors**: Ink, 2.38x lift over painters of the same decade and country (11.7% of his own canvas on
  average vs 4.7% baseline, support 35 of 37 paintings); Bistre, 1.27x (support 14).
- **Avoided colors**: none clear the 0.6-lift / 2%-baseline bar — an honest empty list, not a forced claim.
- **Favorite pairs**: Brownish Grey + Deep Olive (7.3x lift, 3 paintings), Bister + Brownish Grey (3.7x, 3),
  Café Noir + Olive brown (3.0x, 4), Bistre + Café Noir (2.6x, 4), and four more at ≥1.6x.
- **Palette by decade**: 1870s (n=5, L*=38.3) → 1880s (n=13, L*=27.6, his darkest decade) → 1890s (n=7, L*=42.1)
  → 1900s (n=9, L*=38.6) → 1910s (n=3, L*=44.8). A change-point is flagged at the 1890s (27.6 → 42.1).
- **Typical painting**: `commons-Q17491277`. **Atypical**: `nga-46431`.
- **Nearest painters by palette**: José Casado del Alisal (d=0.46), Eduardo Rosales (0.50), Frederic Edwin
  Church (0.57), Constantin Hansen (0.57), Christen Dalsgaard (0.57).
- **8 findings**:
  1. "Uses ink 2.4x more than painters of the same decade and country (from 37 paintings here)."
  2. "Pairs brownish grey with deep olive more than chance would predict (3 of 37 paintings here)."
  3. "Pairs bister with brownish grey more than chance would predict (3 of 37 paintings here)."
  4. "His single largest palette family (ink, smoky black, dark olive brown) covers 49% of his paintings here."
  5. "Keeps 3 distinct palette families here, from ink, smoky black to buffy olive, café noir."
  6. "Paints most like José Casado del Alisal among the painters in this archive, by palette."
  7. "The palette shifts around the 1890s, from mean lightness 27.6 to 42.1 (from 37 paintings here)."
  8. "Spans the 1870s to the 1910s here, across 5 decades (from 37 paintings here)."

(His archive-wide extreme-lightness percentile is 57.5 — not extreme enough to clear the 20/80 bar, so no
"one of the darker/lighter palettes overall" claim is made for him; that's the honesty threshold working as
intended, not a gap.)
