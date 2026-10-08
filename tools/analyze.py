#!/usr/bin/env python3
"""ColorHub color analysis engine (ROADMAP.md §21). Offline, deterministic, no LLM cost.

  python3 tools/analyze.py [--raw DIR] [--limit N] [--out DIR]

Reads the painting corpus (tools/gallery.py's load_corpus(), same order as data/gallery/) and each painting's
24-color pool with area shares (research/_raw/corpus-pool.jsonl, written by tools/gallery.py's run_pools();
gitignored, so a worktree without it falls back to the main checkout -- see find_raw_dir()). Writes
data/analysis/: per-painting readings and stats, per-artist palettes/signatures/connections, and per-decade/
country/source/movement aggregates, plus plain-English findings with honesty thresholds.

This is a DATA-ONLY job: no UI. A later design pass (ROADMAP §21 build step 3) puts this on painting, painter,
movement, decade, country and museum pages.

---------------------------------------------------------------------------------------------------------------
WHAT THE POOL SUPPORTS, AND WHAT IT DOESN'T
---------------------------------------------------------------------------------------------------------------
The pool is up to 24 (hex, area share) pairs per painting -- a richer palette than the 6-color `p` field on each
corpus row, but still a palette, not a pixel grid. Everything below is computed from that palette plus its
shares. Two things in §15/§21's wish list need real pixel positions and are therefore NOT attempted here:
  - "top vs bottom of the picture (sky vs ground)" -- no spatial information survives into the pool.
  - the live 3/20 palette slider -- already derived client-side from this same pool by js/gallery.js's
    glPoolPick() (see tools/gallery.py's own docstring); duplicating it here would just bloat the output.
Contrast range, the L* histogram, gamut area and "distinct color count" are therefore palette-level proxies of
a pixel-level truth, not exact pixel statistics. That caveat, and "as photographed" (aged varnish, six+ museum
cameras), are recorded once in data/analysis/index.json rather than repeated on every one of 23k+ painting
records.

---------------------------------------------------------------------------------------------------------------
NAMING
---------------------------------------------------------------------------------------------------------------
"The app's naming" for this job means js/naming.js's nameOf(): nearest of the ~1,000 names in
data/core-names.json by CIEDE2000, with the fixed modifier grammar (pale/light/dark/deep, greyish/dusty/
bright/vivid, five hue leans) when the match isn't close, and an honest "between X and Y" when nothing is close
at all. That function (and its thresholds, VERY_CLOSE_DE=3 / NEAR_DE=8) is ported here as name_many(); the Lab/
CIEDE2000 math itself is tools/library.py's (de2000, labs, hex_to_rgb), reused rather than re-derived. This is a
different, smaller system than tools/gallery.py's pick_lib() (which names the 6-color `p` palette against the
~2,700-entry reference library for painting-page swatches) -- that system stays as it is; this job names the
24-color pool with the same system the rest of the app uses for "tap a color, get its page".
"""
import argparse, base64, json, math, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gallery as GAL      # noqa: E402  load_corpus(), SOURCES
import library as LIB      # noqa: E402  hex_to_rgb, labs, de2000, family
from paintings import PIGMENT_SINCE  # noqa: E402

OUT = ROOT / "data" / "analysis"
GALLERY_SHARD = GAL.SHARD  # 100: keeps paintings-<n>.json lined up 1:1 with data/gallery/d/<n>.json

# ---------------------------------------------------------------------------------------------------------------
# Thresholds (all in one place, and all printed into index.json so a reader can see exactly what was used)
# ---------------------------------------------------------------------------------------------------------------
VERY_CLOSE_DE, NEAR_DE = 3.0, 8.0            # js/naming.js's own thresholds, ported as-is
MUTED_C, VIVID_C = 15.0, 35.0                # chroma bands: muted < 15, moderate 15-35, vivid >= 35
LOW_L, HIGH_L = 35.0, 65.0                   # value key / lights-mids-shadows split
WARM_LO, WARM_HI = -30.0, 100.0              # warm hue arc (wraps); cool is the rest. Matches the app's own
                                              # family-rule boundary (greens start at h=100; corpus.py doc).
MIN_N = dict(artist_include=6, artist_cluster=12, artist_finding=10, decade=25, country=25, movement=20,
             source=25, pair_support=3)
NN_K = 8                                     # neighbors checked for the "nearest painting, another century" finding


# =================================================================================================================
# research/_raw resolution: gallery.py's own docstring notes that research/_raw is gitignored and a worktree may
# not have it cached locally -- "--raw DIR ... e.g. the main checkout when running in a worktree". This repo's
# worktrees live at <checkout>/.claude/worktrees/<id>, so the main checkout is three levels up; fall back there
# automatically when the local copy is missing, same spirit as gallery.py's sizes().
# =================================================================================================================
def find_raw_dir(explicit=None):
    if explicit:
        return Path(explicit)
    local = ROOT / "research" / "_raw"
    if (local / "corpus-pool.jsonl").exists():
        return local
    main_checkout = ROOT.parent.parent.parent / "research" / "_raw"
    if (main_checkout / "corpus-pool.jsonl").exists():
        print(f"(research/_raw/corpus-pool.jsonl not in this worktree; using {main_checkout})")
        return main_checkout
    return local


def slug(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "unknown"


def byte(v, lo=0, hi=255):
    return max(lo, min(hi, int(round(v))))


def pack_colors(codes):
    """[ci*16+mc, ...] (ci: 0-999 core-name index, mc: 0-14 modifier code, see MOD_CODES) -> base64 of 2 bytes
    each, big-endian. Binary + base64 instead of a JSON int array: at n~15-24 colors/painting x 23k+ paintings,
    this alone is worth over a megabyte (same reasoning, and the same trick, as tools/gallery.py's own pool/
    index.bin packing)."""
    buf = bytearray()
    for c in codes:
        buf.append((c >> 8) & 0xFF)
        buf.append(c & 0xFF)
    return base64.b64encode(bytes(buf)).decode("ascii")


def pack_hist(fracs):
    """A histogram of fractions (summing to ~1) -> base64 of one byte each (0-255), instead of a JSON array of
    permille ints -- same size/idiom reasoning as pack_colors()."""
    return base64.b64encode(bytes(byte(f * 255) for f in fracs)).decode("ascii")


# =================================================================================================================
# Pool decode: research/_raw/corpus-pool.jsonl lines are {"key": corpus id, "pl": base64}; tools/gallery.py's
# pack_pool() wrote each entry as 4 bytes (R, G, B, share*250), largest share first, trailing empty groups
# dropped -- so a painting may have fewer than 24 entries. Decode is the exact inverse.
# =================================================================================================================
def decode_pool(b64):
    if not b64:
        return []
    raw = base64.b64decode(b64)
    out = []
    for i in range(0, len(raw) - 3, 4):
        r, g, b, s = raw[i], raw[i + 1], raw[i + 2], raw[i + 3]
        out.append((f"#{r:02X}{g:02X}{b:02X}", s / 250.0))
    return out


def load_pools(raw_dir, corpus):
    cache = raw_dir / "corpus-pool.jsonl"
    pools = {}
    if cache.exists():
        for line in cache.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                pools[r["key"]] = r["pl"]
    n_fallback = 0
    out, fallback_flags = [], []
    for x in corpus:
        entries = decode_pool(pools.get(x["id"], ""))
        fb = not entries
        if fb:
            entries = [(p[0], p[1]) for p in x["p"]]  # fall back to the 6-color corpus palette
            n_fallback += 1
        tot = sum(s for _, s in entries) or 1.0
        entries = [(h, s / tot) for h, s in entries]
        entries.sort(key=lambda e: -e[1])
        out.append(entries)
        fallback_flags.append(fb)
    return out, fallback_flags, n_fallback


# =================================================================================================================
# Color math helpers on top of tools/library.py (reused, not re-derived)
# =================================================================================================================
def lch_batch(labs):
    L, a, b = labs[..., 0], labs[..., 1], labs[..., 2]
    C = np.hypot(a, b)
    H = np.degrees(np.arctan2(b, a)) % 360
    return L, C, H


def ab_of(C, H):
    r = np.radians(H)
    return C * np.cos(r), C * np.sin(r)


def in_warm_arc(h):
    h = h % 360
    return (h >= 330) | (h < 100)


# =================================================================================================================
# Naming: js/naming.js's nameOf(), ported. data/core-names.json is the ~1,000-name primary list.
# =================================================================================================================
MOD_AXIS = {"L": re.compile(r"\b(light|pale|dark|deep|dusky|bright)\b", re.I),
            "C": re.compile(r"\b(grey|gray|greyish|grayish|dusty|dull|vivid|bright|neon|electric)\b", re.I),
            "H": re.compile(r"\b(reddish|yellowish|greenish|bluish|purplish|orangish|pinkish)\b", re.I)}


def hue_lean(h):
    h = h % 360
    if h < 40 or h >= 345:
        return "reddish"
    if h < 100:
        return "yellowish"
    if h < 170:
        return "greenish"
    if h < 260:
        return "bluish"
    return "purplish"


def pick_modifier(name_lch, target_lch, name=""):
    Ln, Cn, Hn = name_lch
    Lt, Ct, Ht = target_lch
    dL, dC = Lt - Ln, Ct - Cn
    dH = Ht - Hn
    if dH > 180:
        dH -= 360
    if dH < -180:
        dH += 360
    scores = [("L", abs(dL), dL), ("C", abs(dC) * 0.8, dC)]
    if Cn > 8 and Ct > 8:
        scores.append(("H", abs(dH) * min(Cn, Ct) / 40, dH))
    scores.sort(key=lambda s: -s[1])
    ok = [s for s in scores if not MOD_AXIS[s[0]].search(name)]
    if not ok:
        return ""
    axis, _, v = ok[0]
    if axis == "L":
        return ("pale" if Ct < 20 else "light") if v > 0 else ("deep" if Ct > 35 else "dark")
    if axis == "C":
        return ("greyish" if Ct < 15 else "dusty") if v < 0 else ("bright" if Lt > 55 else "vivid")
    return hue_lean(Ht)


def load_core_names():
    data = json.loads((ROOT / "data" / "core-names.json").read_text(encoding="utf-8"))
    labs = LIB.labs([e["h"] for e in data])
    L, C, H = lch_batch(labs)
    return data, labs, L, C, H


def name_many(hexes, Ls, Cs, Hs, core, core_lab, core_L, core_C, core_H, chunk=2000):
    """Nearest core name (+ modifier / between-phrase) for every (hex, L, C, H), batched. Mirrors nameOf()."""
    n = len(hexes)
    out = [None] * n
    if not n:
        return out
    labs = LIB.labs(hexes)
    for i in range(0, n, chunk):
        sl = slice(i, min(i + chunk, n))
        D = LIB.de2000(labs[sl], core_lab)             # (k, 1000)
        order = np.argpartition(D, 1, axis=1)[:, :2]
        for row, (i0_, i1_) in enumerate(order):
            j = i + row
            i0, i1 = (i0_, i1_) if D[row, i0_] <= D[row, i1_] else (i1_, i0_)
            d0 = float(D[row, i0])
            top = core[i0]
            text, mod, si = top["n"], "", None
            if d0 >= NEAR_DE:
                second = core[i1]
                text = f"between {top['n'].lower()} and {second['n'].lower()}"
                mod, si = "far", int(i1)
            elif d0 >= VERY_CLOSE_DE:
                mod = pick_modifier((core_L[i0], core_C[i0], core_H[i0]), (Ls[j], Cs[j], Hs[j]), top["n"])
                if mod:
                    text = f"{mod} {top['n'].lower()}"
            text = text[0].upper() + text[1:]
            out[j] = dict(n=top["n"], nh=top["h"], de=round(d0, 1), text=text, mod=mod,
                          ci=int(i0), mc=MOD_CODE_OF.get(mod, 0), si=si)
    return out


# =================================================================================================================
# Per-painting features
# =================================================================================================================
def weighted_percentile(values, weights, q):
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cum = np.cumsum(w) - 0.5 * w
    cum = cum / w.sum() * 100
    return float(np.interp(q, cum, v))


def entropy_eff(shares):
    p = np.asarray(shares, dtype=np.float64)
    p = p[p > 0]
    p = p / p.sum()
    h = -np.sum(p * np.log(p))
    return float(h), float(math.exp(h))


def convex_hull_area(a, b):
    pts = np.column_stack([a, b])
    if len(pts) < 3:
        return 0.0
    try:
        from scipy.spatial import ConvexHull
        return float(ConvexHull(pts).volume)  # 2D ConvexHull.volume == area
    except Exception:
        return 0.0


HUE_BINS = 12


def hue_hist(H, weight):
    """12-bin hue histogram (ROADMAP §21), weighted by share x chroma. Returns FRACTIONS (sum ~1); pack_hist()
    quantizes to bytes at output time."""
    bins = np.minimum((H // (360 / HUE_BINS)).astype(int), HUE_BINS - 1)
    out = np.zeros(HUE_BINS)
    for b, w in zip(bins, weight):
        out[b] += w
    tot = out.sum()
    return (out / tot).tolist() if tot > 0 else [0.0] * HUE_BINS


def l_hist(L, share):
    """10-bin L* histogram (ROADMAP §21), share-weighted. Returns FRACTIONS (sum ~1)."""
    bins = np.minimum((L // 10).astype(int), 9)
    bins = np.maximum(bins, 0)
    out = np.zeros(10)
    for b, w in zip(bins, share):
        out[b] += w
    tot = out.sum()
    return (out / tot).tolist() if tot > 0 else [0.0] * 10


def classify_harmony(H, weight):
    """A heuristic over the share x chroma-weighted hue distribution: merge nearby hues into "peaks" (>=40 deg
    apart), then read off the peak count and spacing. Documented as a heuristic, not a physical measurement, in
    research/ANALYSIS.md -- harmony fit is inherently a matter of convention (Itten/Matsuda-style templates),
    not a single ground truth."""
    tot = weight.sum()
    if tot <= 0 or len(H) == 0:
        return "neutral-dominant", 1.0
    order = np.argsort(-weight)
    peaks = []  # list of [center_hue, weight]
    for h, w in zip(H[order], weight[order]):
        merged = False
        for p in peaks:
            d = abs(((h - p[0] + 180) % 360) - 180)
            if d <= 40:
                p[0] = (p[0] * p[1] + h * w) / (p[1] + w)
                p[1] += w
                merged = True
                break
        if not merged:
            peaks.append([h, w])
    peaks.sort(key=lambda p: -p[1])
    sig = [p for p in peaks if p[1] >= 0.08 * tot]
    if not sig:
        sig = peaks[:1]

    def ang(a, b):
        return abs(((a - b + 180) % 360) - 180)

    if len(sig) == 1:
        return "analogous", 1.0
    if len(sig) == 2:
        d = ang(sig[0][0], sig[1][0])
        if d >= 150:
            return "complementary", round(1 - abs(d - 180) / 180, 2)
        if d <= 70:
            return "analogous", round(1 - d / 70, 2)
        return "split-complementary", round(1 - abs(d - 150) / 150, 2)
    # 3+: check triad (~120 apart) vs split vs analogous run
    hs = sorted(p[0] for p in sig[:3])
    gaps = [ang(hs[0], hs[1]), ang(hs[1], hs[2]), ang(hs[0], hs[2])]
    if all(abs(g - 120) <= 35 for g in [ang(hs[0], hs[1]), ang(hs[1], hs[2])]):
        return "triad", round(1 - sum(abs(g - 120) for g in gaps[:2]) / 240, 2)
    if max(gaps) <= 100:
        return "analogous", round(1 - max(gaps) / 100, 2)
    return "split-complementary", 0.5


def analyze_painting(x, pool_named, core_meta, pool_fallback):
    """pool_named: list of dicts, one per pool color, each with h (its real hex), s (share), L, C, H, plus naming."""
    h = [c["h"] for c in pool_named]
    s = np.array([c["s"] for c in pool_named])
    L = np.array([c["L"] for c in pool_named])
    C = np.array([c["C"] for c in pool_named])
    H = np.array([c["H"] for c in pool_named])
    a, b = ab_of(C, H)
    n = len(pool_named)

    Lmean = float((L * s).sum())
    Cmean = float((C * s).sum())
    p5 = weighted_percentile(L, s, 5)
    p95 = weighted_percentile(L, s, 95)
    contrast = p95 - p5
    muted = float(s[C < MUTED_C].sum())
    vivid = float(s[C >= VIVID_C].sum())
    moderate = 1.0 - muted - vivid
    chroma_weight = s * C
    warm_w = float(chroma_weight[in_warm_arc(H)].sum())
    cool_w = float(chroma_weight.sum() - warm_w)
    warm_frac = warm_w / (warm_w + cool_w) if (warm_w + cool_w) > 0 else 0.5
    gamut = convex_hull_area(a, b)
    ent, eff_n = entropy_eff(s)
    harmony, hscore = classify_harmony(H, chroma_weight)
    value_key = "high" if Lmean >= HIGH_L else ("low" if Lmean < LOW_L else "mid")

    dark_i, light_i = int(np.argmin(L)), int(np.argmax(L))

    # dominant family (by share) for the "hidden colors" test
    fam = [LIB.family(float(L[i]), float(C[i]), float(H[i])) for i in range(n)]
    fam_share = defaultdict(float)
    for f, sh in zip(fam, s):
        fam_share[f] += sh
    dom_fam = max(fam_share, key=fam_share.get)

    # ---- palettes ----
    # The pool itself (hex + share, in this exact share-descending order) already lives in data/gallery/d/*.json
    # (tools/gallery.py's `pl` field) -- shipping it again here would just duplicate bytes the client already
    # has. So "palette by area" isn't repeated; only the NEW information -- each color's name, and which role it
    # plays -- is stored, as pool-position indices (0..n-1) the client zips against its own decoded pool.
    names_str = [pool_named[i]["name"]["n"] for i in range(n)]

    def dist(i, j):
        return math.hypot(math.hypot(L[i] - L[j], a[i] - a[j]), b[i] - b[j])

    top2 = list(np.argsort(-s)[:2])
    accents = []
    for i in np.argsort(-(C * (1 - s)))[:n]:
        i = int(i)
        if s[i] > 0.12:
            continue
        if any(dist(i, j) < 15 for j in top2 if j != i):
            continue
        accents.append(i)
        if len(accents) == 3:
            break

    bands = [2 if L[i] >= HIGH_L else (0 if L[i] < LOW_L else 1) for i in range(n)]  # 0 shadow, 1 mid, 2 light

    hidden_cands = [i for i in range(n) if fam[i] != dom_fam and C[i] < 22 and i not in top2]
    hidden_cands.sort(key=lambda i: -s[i])
    hidden_out = hidden_cands[:3]

    focal_cands = [i for i in range(n) if s[i] >= 0.008]
    if not focal_cands:
        focal_cands = list(range(n))
    focal_i = max(focal_cands, key=lambda i: C[i] * (0.4 + abs(L[i] - Lmean) / 50))
    mids_idx = [i for i in range(n) if bands[i] == 1]
    glue_i = max(mids_idx, key=lambda i: s[i]) if mids_idx else min(range(n), key=lambda i: abs(L[i] - Lmean))

    pigment_hint, pigment_name = None, None
    yr = x.get("y")
    if yr is not None:
        for i in top2:
            since = PIGMENT_SINCE.get(names_str[i])
            if since and since <= yr <= since + 80:
                pigment_hint = dict(ci=pool_named[i]["name"]["ci"], since=since)
                pigment_name = names_str[i]
                break

    local_findings = []
    vivid_r = round(vivid, 3)
    if vivid_r <= 0.03:
        local_findings.append(f"Only {vivid_r * 100:.0f}% of this canvas is truly vivid.")
    elif vivid_r >= 0.5:
        local_findings.append(f"More than half the canvas ({vivid_r * 100:.0f}%) is vivid color.")
    if len(top2) == 2:
        i0, i1 = top2
        if abs(L[i0] - L[i1]) <= 3 and (s[i0] + s[i1]) >= 0.3:
            local_findings.append(f"{names_str[i0]} and {names_str[i1]} sit at nearly the same lightness "
                                  f"(together {round((s[i0] + s[i1]) * 100):.0f}% of the canvas) -- a likely "
                                  f"source of glow or flatness.")
    if pigment_hint:
        local_findings.append(f"{pigment_name} is consistent with pigments available from the "
                              f"{pigment_hint['since']}s (screen color only; a pigment hint, not a lab test).")

    rec = dict(
        id=x["id"], n=n, fb=pool_fallback,
        nm=[pool_named[i]["name"]["ci"] for i in range(n)],      # core-name index per pool position
        md=[pool_named[i]["name"]["mc"] for i in range(n)],      # modifier code per pool position (see MOD_CODES)
        far={i: pool_named[i]["name"]["si"] for i in range(n) if pool_named[i]["name"]["mc"] == 14},
        bd=bands, acc=accents, hid=hidden_out, foc=focal_i, glu=glue_i, dk=dark_i, lt=light_i,
        stat=dict(key=value_key, Lm=round(Lmean), Cm=round(Cmean), Lh=l_hist(L, s),
                  ct=round(contrast), p5=round(p5), p95=round(p95),
                  ch=[round(muted * 1000), round(moderate * 1000), round(vivid * 1000)],
                  wf=round(warm_frac * 1000), hh=hue_hist(H, chroma_weight), ga=round(gamut),
                  en=round(ent * 100), ef=round(eff_n * 10), hf=harmony, hs=round(hscore * 100),
                  df=dom_fam),
        pigment=pigment_hint,
        _localFindings=local_findings,
        # internal only (not shipped): (name, share) for every color with share >= 5%, still pool-order
        # (share-descending), used by artist/group lift + co-occurrence aggregation below.
        _topNames=[(names_str[i], float(s[i])) for i in range(n) if s[i] >= 0.05],
        # scalar feature vector reused for percentiles / clustering / nearest-neighbor search
        fv=[Lmean, Cmean, warm_frac, vivid, muted, ent],
    )
    return rec


FEATURE_NAMES = ["Lmean", "Cmean", "warmFrac", "vivid", "muted", "entropy"]
MOD_CODES = ["", "pale", "light", "dark", "deep", "greyish", "dusty", "bright", "vivid",
             "reddish", "yellowish", "greenish", "bluish", "purplish", "far"]
MOD_CODE_OF = {m: i for i, m in enumerate(MOD_CODES)}


# =================================================================================================================
# Percentiles
# =================================================================================================================
def percentile_rank(sorted_arr, value):
    import bisect
    i = bisect.bisect_left(sorted_arr, value)
    j = bisect.bisect_right(sorted_arr, value)
    mid = (i + j) / 2
    return round(mid / len(sorted_arr) * 100, 1) if len(sorted_arr) else None


# =================================================================================================================
# k-means (no sklearn dependency) + silhouette, for artist palette clusters
# =================================================================================================================
def kmeans(X, k, seed=7, iters=60, restarts=6):
    rng = np.random.RandomState(seed)
    best_labels, best_centers, best_inertia = None, None, np.inf
    n = len(X)
    for _ in range(restarts):
        centers = [X[rng.randint(n)]]
        for _ in range(k - 1):
            d2 = np.min([(np.sum((X - c) ** 2, axis=1)) for c in centers], axis=0)
            tot = d2.sum()
            if tot <= 0:
                centers.append(X[rng.randint(n)])
                continue
            probs = d2 / tot
            centers.append(X[rng.choice(n, p=probs)])
        C = np.array(centers)
        labels = np.zeros(n, dtype=int)
        for _ in range(iters):
            d2 = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1)
            new_labels = d2.argmin(1)
            if np.array_equal(new_labels, labels) and _ > 0:
                labels = new_labels
                break
            labels = new_labels
            for j in range(k):
                if np.any(labels == j):
                    C[j] = X[labels == j].mean(0)
        inertia = float(((X - C[labels]) ** 2).sum())
        if inertia < best_inertia:
            best_inertia, best_labels, best_centers = inertia, labels, C
    return best_labels, best_centers


def silhouette(X, labels):
    n = len(X)
    k = len(set(labels))
    if k < 2 or k >= n:
        return -1.0
    D = np.sqrt(((X[:, None, :] - X[None, :, :]) ** 2).sum(-1))
    scores = np.zeros(n)
    for i in range(n):
        same = labels == labels[i]
        same[i] = False
        a = D[i, same].mean() if same.any() else 0.0
        b = np.inf
        for j in set(labels):
            if j == labels[i]:
                continue
            mask = labels == j
            if mask.any():
                b = min(b, D[i, mask].mean())
        scores[i] = 0.0 if max(a, b) == 0 else (b - a) / max(a, b)
    return float(scores.mean())


def best_kmeans(X, kmin=2, kmax=5, seed=7):
    kmax = min(kmax, len(X) - 1)
    best = None
    for k in range(kmin, kmax + 1):
        labels, centers = kmeans(X, k, seed=seed)
        sc = silhouette(X, labels)
        if best is None or sc > best[0]:
            best = (sc, k, labels, centers)
    return best  # (score, k, labels, centers)


# =================================================================================================================
# Lift helpers (artist signature/avoided colors, favorite pairs)
# =================================================================================================================
def lift(obs, exp, eps=0.004):
    return (obs + eps) / (exp + eps)


# =================================================================================================================
# Findings
# =================================================================================================================
def finding_painting(rec, pct, x):
    """Percentile-driven findings only (vivid%, same-lightness glow and pigment hints are computed inline in
    analyze_painting -- rec['_localFindings'] -- since they need the raw per-color L/C/share this function no
    longer carries; the two lists are concatenated by the caller)."""
    out = []
    n_arc = pct.get("_n_arc", 0)
    a = pct.get("arc") or {}
    if a.get("Lmean") is not None and (a["Lmean"] <= 10 or a["Lmean"] >= 90):
        word = "Darker" if a["Lmean"] <= 10 else "Lighter"
        pc = a["Lmean"] if a["Lmean"] <= 10 else 100 - a["Lmean"]
        out.append(f"{word} than {100 - pc if word == 'Darker' else pc:.0f}% of the paintings in this archive "
                   f"(n={n_arc:,}).")
    art = pct.get("art")
    if art and art.get("Lmean") is not None and (art["Lmean"] <= 10 or art["Lmean"] >= 90) and pct.get("_n_art", 0) >= MIN_N["artist_finding"]:
        word = "Darker" if art["Lmean"] <= 10 else "Lighter"
        out.append(f"{word} than most of {x.get('a') or 'this painter'}'s other work here "
                   f"(from {pct['_n_art']} paintings here).")
    return out


def finding_artist(a_rec):
    out = []
    n = a_rec["n"]
    if n < MIN_N["artist_finding"]:
        return out
    for sig in a_rec["signature"][:3]:
        if sig["lift"] >= 1.3:
            out.append(f"Uses {sig['name'].lower()} {sig['lift']:.1f}x more than painters of the same decade and "
                       f"country (from {n} paintings here).")
    for av in a_rec["avoided"][:2]:
        out.append(f"Rarely uses {av['name'].lower()}, common among peers of the same decade and country "
                   f"(from {n} paintings here).")
    for pr in a_rec["pairs"][:2]:
        if pr["lift"] >= 1.5 and pr["count"] >= MIN_N["pair_support"]:
            out.append(f"Pairs {pr['a'].lower()} with {pr['b'].lower()} more than chance would predict "
                       f"({pr['count']} of {n} paintings here).")
    if a_rec.get("clusters"):
        top_c = a_rec["clusters"][0]
        if top_c["pct"] >= 35:
            out.append(f"His single largest palette family ({', '.join(top_c['colors'][:3]).lower()}) covers "
                       f"{top_c['pct']:.0f}% of his paintings here.")
        if len(a_rec["clusters"]) >= 2:
            out.append(f"Keeps {len(a_rec['clusters'])} distinct palette families here, from "
                       f"{', '.join(a_rec['clusters'][0]['colors'][:2]).lower()} to "
                       f"{', '.join(a_rec['clusters'][-1]['colors'][:2]).lower()}.")
    if a_rec.get("nearest"):
        out.append(f"Paints most like {a_rec['nearest'][0]['name']} among the painters in this archive, by palette.")
    if a_rec.get("changePoint"):
        cp = a_rec["changePoint"]
        out.append(f"The palette shifts around the {cp['decade']}s, from mean lightness {cp['before']} to "
                   f"{cp['after']} (from {n} paintings here).")
    if a_rec.get("byDecade") and len(a_rec["byDecade"]) >= 2:
        years = [d["decade"] for d in a_rec["byDecade"]]
        out.append(f"Spans the {years[0]}s to the {years[-1]}s here, across {len(years)} decades "
                   f"(from {n} paintings here).")
    if a_rec.get("extremePct") is not None and (a_rec["extremePct"] <= 20 or a_rec["extremePct"] >= 80):
        word = "darker" if a_rec["extremePct"] <= 20 else "lighter"
        out.append(f"Among the {a_rec['_peerN']} painters with enough work here, one of the {word} palettes "
                   f"overall (from {n} paintings here).")
    return out[:8]


def finding_group(label, kind, n, lmean_pct=None, vivid=None):
    out = []
    if n < MIN_N.get(kind, 20):
        return out
    if lmean_pct is not None and (lmean_pct <= 10 or lmean_pct >= 90):
        word = "darker" if lmean_pct <= 10 else "lighter"
        out.append(f"{label} is {word} than most groups of its kind in this archive (n={n}).")
    if vivid is not None and vivid <= 0.03:
        out.append(f"Only {vivid * 100:.0f}% of the average {label.lower()} canvas is vivid (n={n}).")
    return out


# =================================================================================================================
# Main pipeline
# =================================================================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out")
    args = ap.parse_args()

    raw_dir = find_raw_dir(args.raw)
    out_dir = Path(args.out) if args.out else OUT

    print("loading corpus (gallery order)...", flush=True)
    corpus, _files = GAL.load_corpus()
    if args.limit:
        corpus = corpus[:args.limit]
    print(f"{len(corpus)} paintings", flush=True)

    # Movements beyond the AIC/CMA rows' own (tools/wikidata_artists.py -> data/artists/movements-wd.json):
    # tier 1 = Wikidata records the movement for the painting itself; tier 2 = the painter's single recorded
    # movement. tier 0 = the museum's own. A row keeps its museum movement when it has one.
    mv_tier = {}
    mvwd = ROOT / "data" / "artists" / "movements-wd.json"
    if mvwd.exists():
        wd = json.loads(mvwd.read_text())
        for x in corpus:
            if x.get("mv"):
                mv_tier[x["id"]] = 0
                continue
            m = wd["tier1"].get(x["id"])
            if m:
                x["mv"], mv_tier[x["id"]] = m, 1
                continue
            m = wd["tier2"].get(x["id"])
            if m:
                x["mv"], mv_tier[x["id"]] = m, 2
        print(f"movements: {sum(1 for t in mv_tier.values() if t == 0)} museum, "
              f"{sum(1 for t in mv_tier.values() if t == 1)} Wikidata painting, "
              f"{sum(1 for t in mv_tier.values() if t == 2)} via the painter", flush=True)

    print("loading pools...", flush=True)
    pools, fallback_flags, n_fallback = load_pools(raw_dir, corpus)
    print(f"{n_fallback} paintings fell back to the 6-color corpus palette (no cached pool image)", flush=True)

    print("loading core names...", flush=True)
    core, core_lab, core_L, core_C, core_H = load_core_names()

    # ---- flatten every pool color across every painting, name them all in one batched pass ----
    print("flattening + naming pool colors...", flush=True)
    flat_hex, owner = [], []
    for i, entries in enumerate(pools):
        for h, s in entries:
            flat_hex.append(h)
            owner.append(i)
    flat_labs = LIB.labs(flat_hex)
    flat_L, flat_C, flat_H = lch_batch(flat_labs)
    named = name_many(flat_hex, flat_L, flat_C, flat_H, core, core_lab, core_L, core_C, core_H)
    print(f"{len(flat_hex)} colors named", flush=True)

    # ---- regroup per painting (owner preserves the original per-painting, share-desc order) ----
    per_painting_colors = [[] for _ in corpus]
    idx_cursor = [0] * len(corpus)
    for k, i in enumerate(owner):
        h, s = pools[i][idx_cursor[i]]
        idx_cursor[i] += 1
        per_painting_colors[i].append(dict(h=h, s=s, L=float(flat_L[k]), C=float(flat_C[k]), H=float(flat_H[k]),
                                            name=named[k]))

    print("per-painting analysis...", flush=True)
    records = []
    for i, x in enumerate(corpus):
        cols = per_painting_colors[i]
        if not cols:
            cols = [dict(h="#808080", s=1.0, L=50.0, C=0.0, H=0.0, name=dict(n="Grey", nh="#8C9096", de=0, text="Grey", mod=""))]
        rec = analyze_painting(x, cols, core, fallback_flags[i])
        records.append(rec)
        if (i + 1) % 4000 == 0:
            print(f"  {i + 1}/{len(corpus)}", flush=True)

    # ---- percentile scaffolding (archive / artist / decade / movement) ----
    print("percentiles...", flush=True)
    fv = np.array([r["fv"] for r in records])  # Lmean, Cmean, warmFrac, vivid, muted, entropy
    sorted_cols = {name: np.sort(fv[:, j]) for j, name in enumerate(FEATURE_NAMES)}

    artist_idx = defaultdict(list)
    decade_idx = defaultdict(list)
    country_idx = defaultdict(list)
    source_idx = defaultdict(list)
    movement_idx = defaultdict(list)
    for i, x in enumerate(corpus):
        if x.get("a"):
            artist_idx[x["a"]].append(i)
        if x.get("y") is not None:
            decade_idx[(x["y"] // 10) * 10].append(i)
        if x.get("co"):
            country_idx[x["co"]].append(i)
        source_idx[x["src"]].append(i)
        if x.get("mv"):
            movement_idx[x["mv"]].append(i)

    def sorted_scope(idxs, j):
        return np.sort(fv[idxs, j])

    for i, r in enumerate(records):
        x = corpus[i]
        pct = dict(arc={}, art=None, dec=None, mv=None, _n_arc=len(records))
        for j, name in enumerate(["Lmean"]):
            pct["arc"][name] = percentile_rank(sorted_cols[name], fv[i, j])
        a_idx = artist_idx.get(x.get("a"), [])
        if len(a_idx) >= MIN_N["artist_finding"]:
            pct["art"] = {"Lmean": percentile_rank(sorted_scope(a_idx, 0), fv[i, 0])}
            pct["_n_art"] = len(a_idx)
        r["pct"] = pct
        r["finding"] = (r.get("_localFindings") or []) + finding_painting(r, pct, x)

    # ---- artist aggregates ----
    print("artist aggregates...", flush=True)
    artists_out = {}
    artist_mean_fv = {}
    for name, idxs in artist_idx.items():
        if len(idxs) < MIN_N["artist_include"]:
            continue
        artist_mean_fv[name] = fv[idxs].mean(0)

    all_names_in_co_dec = defaultdict(lambda: {"n": 0, "share": Counter()})
    all_names_in_co = defaultdict(lambda: {"n": 0, "share": Counter()})
    all_names_global = {"n": 0, "share": Counter()}
    painting_top_names = []  # per painting: list of (name, share) for share >= 0.05, used for lift + co-occurrence
    for i, x in enumerate(corpus):
        tops = records[i]["_topNames"]
        painting_top_names.append(tops)
        co, dec = x.get("co"), (x["y"] // 10 * 10) if x.get("y") is not None else None
        all_names_global["n"] += 1
        for nm, sh in tops:
            all_names_global["share"][nm] += sh
        if co:
            all_names_in_co[co]["n"] += 1
            for nm, sh in tops:
                all_names_in_co[co]["share"][nm] += sh
        if co and dec is not None:
            all_names_in_co_dec[(co, dec)]["n"] += 1
            for nm, sh in tops:
                all_names_in_co_dec[(co, dec)]["share"][nm] += sh

    def baseline_mean(name, co, dec, exclude_n, exclude_share):
        for table, keyfn, min_n in ((all_names_in_co_dec, lambda: (co, dec), 10),
                                     (all_names_in_co, lambda: co, 15),
                                     (None, None, 0)):
            if table is None:
                bn, bshare = all_names_global["n"], all_names_global["share"][name]
            else:
                key = keyfn()
                if key not in table:
                    continue
                bn, bshare = table[key]["n"], table[key]["share"][name]
            n2, s2 = bn - exclude_n, bshare - exclude_share
            if n2 >= min_n:
                return s2 / n2 if n2 > 0 else 0.0
        return all_names_global["share"][name] / max(1, all_names_global["n"])

    for name, idxs in artist_idx.items():
        n = len(idxs)
        if n < MIN_N["artist_include"]:
            continue
        own_tops = [painting_top_names[i] for i in idxs]
        own_names = Counter()
        for tops in own_tops:
            for nm, sh in tops:
                own_names[nm] += sh
        own_n_with = Counter()
        for tops in own_tops:
            for nm, _ in tops:
                own_n_with[nm] += 1
        own_country = Counter(corpus[i]["co"] for i in idxs if corpus[i].get("co")).most_common(1)
        own_country = own_country[0][0] if own_country else None
        own_decades = Counter((corpus[i]["y"] // 10 * 10) for i in idxs if corpus[i].get("y") is not None)

        # per-painting baseline exclusion counters, grouped by (co, dec) so the artist's own paintings don't
        # inflate their own baseline
        excl_n, excl_share = defaultdict(int), defaultdict(Counter)
        for i in idxs:
            x = corpus[i]
            co, dec = x.get("co"), (x["y"] // 10 * 10) if x.get("y") is not None else None
            excl_n[(co, dec)] += 1
            for nm, sh in painting_top_names[i]:
                excl_share[(co, dec)][nm] += sh

        candidates = set(own_names) | set(w for w, c in all_names_global["share"].most_common(200))
        sigs = []
        for nm in candidates:
            obs = own_names.get(nm, 0.0) / n
            exp_vals = []
            for i in idxs:
                x = corpus[i]
                co, dec = x.get("co"), (x["y"] // 10 * 10) if x.get("y") is not None else None
                exp_vals.append(baseline_mean(nm, co, dec, excl_n[(co, dec)], excl_share[(co, dec)][nm]))
            exp = float(np.mean(exp_vals)) if exp_vals else 0.0
            lf = lift(obs, exp)
            sigs.append(dict(name=nm, lift=round(lf, 2), ownShare=round(obs, 3), baselineShare=round(exp, 3),
                              support=own_n_with.get(nm, 0)))
        sigs_support = [s for s in sigs if s["support"] >= 2 and s["ownShare"] >= 0.03 and s["lift"] >= 1.15]
        signature = sorted(sigs_support, key=lambda s: -s["lift"])[:6]
        avoided_cands = [s for s in sigs if s["baselineShare"] >= 0.02 and s["lift"] <= 0.6]
        avoided = sorted(avoided_cands, key=lambda s: s["lift"])[:6]

        # favorite pairs / triads (co-occurrence lift among the artist's own top-share names)
        pair_count, single_count = Counter(), Counter()
        for tops in own_tops:
            names_here = sorted(set(nm for nm, _ in tops))
            for nm in names_here:
                single_count[nm] += 1
            for a_i in range(len(names_here)):
                for b_i in range(a_i + 1, len(names_here)):
                    pair_count[(names_here[a_i], names_here[b_i])] += 1
        pairs = []
        for (pa, pb), cnt in pair_count.items():
            if cnt < MIN_N["pair_support"]:
                continue
            expected = single_count[pa] / n * single_count[pb] / n * n
            lf = lift(cnt, expected)
            pairs.append(dict(a=pa, b=pb, count=cnt, lift=round(lf, 2)))
        pairs.sort(key=lambda p: -p["lift"])

        barcode = sorted(([corpus[i]["id"], corpus[i].get("y"), [c[0] for c in painting_top_names[i][:3]]]
                          for i in idxs), key=lambda r: (r[1] is None, r[1] or 0))

        # decade palette + change-point
        by_decade = sorted(own_decades.items())
        decade_series = []
        for dec, cnt in by_decade:
            d_idxs = [i for i in idxs if corpus[i].get("y") is not None and corpus[i]["y"] // 10 * 10 == dec]
            decade_series.append(dict(decade=dec, n=cnt, Lmean=round(float(fv[d_idxs, 0].mean()), 1),
                                      Cmean=round(float(fv[d_idxs, 1].mean()), 1)))
        change_point = None
        if len(decade_series) >= 3:
            diffs = [abs(decade_series[k + 1]["Lmean"] - decade_series[k]["Lmean"]) for k in range(len(decade_series) - 1)]
            if diffs:
                k = int(np.argmax(diffs))
                if diffs[k] >= 8:
                    change_point = dict(decade=decade_series[k + 1]["decade"],
                                        before=round(decade_series[k]["Lmean"], 1),
                                        after=round(decade_series[k + 1]["Lmean"], 1))

        # typical / atypical
        X = fv[idxs]
        centroid = X.mean(0)
        norm = X.std(0) + 1e-6
        d_to_centroid = np.sqrt((((X - centroid) / norm) ** 2).sum(1))
        typical_i = idxs[int(np.argmin(d_to_centroid))]
        atypical_i = idxs[int(np.argmax(d_to_centroid))]

        # clusters
        clusters = []
        if n >= MIN_N["artist_cluster"]:
            Xn = (X - X.mean(0)) / (X.std(0) + 1e-6)
            sc, k, labels, centers = best_kmeans(Xn)
            for c in range(k):
                members = [idxs[j] for j in range(n) if labels[j] == c]
                if not members:
                    continue
                cd = np.sqrt((((X[np.array([j for j in range(n) if labels[j] == c])] - X[np.array(
                    [j for j in range(n) if labels[j] == c])].mean(0)) / norm) ** 2).sum(1))
                rep = members[int(np.argmin(cd))] if len(members) else members[0]
                # cluster palette: weighted top colors across its members
                pal = Counter()
                for i2 in members:
                    for nm, sh in records[i2]["_topNames"][:4]:
                        pal[nm] += sh
                top_colors = [nm for nm, _ in pal.most_common(5)]
                clusters.append(dict(size=len(members), pct=round(len(members) / n * 100, 1),
                                     typical=corpus[rep]["id"], colors=top_colors))
            clusters.sort(key=lambda c: -c["size"])

        artists_out[name] = dict(
            name=name, slug=slug(name), n=n, country=own_country,
            Lmean=round(float(X[:, 0].mean()), 1), Cmean=round(float(X[:, 1].mean()), 1),
            warmFrac=round(float(X[:, 2].mean()), 3),
            clusters=clusters, signature=signature, avoided=avoided, pairs=pairs[:8],
            byDecade=decade_series, changePoint=change_point,
            typical=corpus[typical_i]["id"], atypical=corpus[atypical_i]["id"],
            barcode=barcode,
        )

    # nearest artists by palette (Euclidean over mean feature vector, z-scored across artists)
    print("nearest-artist graph...", flush=True)
    names_list = list(artist_mean_fv)
    M = np.array([artist_mean_fv[n] for n in names_list])
    Mn = (M - M.mean(0)) / (M.std(0) + 1e-6)
    Dm = np.sqrt(((Mn[:, None, :] - Mn[None, :, :]) ** 2).sum(-1))
    all_Lmeans = np.array([artists_out[n]["Lmean"] for n in names_list])
    sorted_Lmeans = np.sort(all_Lmeans)
    for i, name in enumerate(names_list):
        order = np.argsort(Dm[i])
        nearest = [dict(name=names_list[j], slug=artists_out[names_list[j]]["slug"], d=round(float(Dm[i, j]), 2))
                  for j in order if j != i][:5]
        artists_out[name]["nearest"] = nearest
        pct = percentile_rank(sorted_Lmeans, all_Lmeans[i])
        artists_out[name]["extremePct"] = pct
        artists_out[name]["_peerN"] = len(names_list)
        artists_out[name]["findings"] = finding_artist(artists_out[name])

    # ---- nearest painting, different century (for painting-level findings) ----
    print("nearest-painting (cross-century) search...", flush=True)
    try:
        from scipy.spatial import cKDTree
        Xall = (fv - fv.mean(0)) / (fv.std(0) + 1e-6)
        tree = cKDTree(Xall)
        dists, idxs_nn = tree.query(Xall, k=NN_K + 1)
        typical_nn = float(np.median(dists[:, 1]))
        centuries = [((x["y"] // 100) * 100) if x.get("y") is not None else None for x in corpus]
        for i in range(len(corpus)):
            if centuries[i] is None:
                continue
            for rank in range(1, NN_K + 1):
                j = idxs_nn[i, rank]
                if centuries[j] is not None and centuries[j] != centuries[i] and dists[i, rank] <= typical_nn:
                    records[i]["nearestOtherCentury"] = dict(id=corpus[j]["id"], century=centuries[j],
                                                             d=round(float(dists[i, rank]), 2))
                    break
    except Exception as e:
        print(f"  (skipped: {e})", flush=True)

    # ---- group aggregates: decade, country, source(museum), movement ----
    print("group aggregates...", flush=True)
    def group_block(idxs_map, min_n, label_fn=lambda k: str(k)):
        out = {}
        for key, idxs in idxs_map.items():
            n = len(idxs)
            if n < min_n:
                continue
            names_count = Counter()
            for i in idxs:
                for nm, sh in painting_top_names[i]:
                    names_count[nm] += sh
            top = [dict(name=nm, share=round(sh / n, 3)) for nm, sh in names_count.most_common(8)]
            dist = []
            for nm, sh in names_count.items():
                base = all_names_global["share"][nm] / max(1, all_names_global["n"])
                own = sh / n
                if own >= 0.01:
                    lf = lift(own, base)
                    if lf >= 1.25:
                        dist.append(dict(name=nm, lift=round(lf, 2), share=round(own, 3)))
            dist.sort(key=lambda d: -d["lift"])
            Lmean_g = float(fv[idxs, 0].mean())
            vivid_g = float(fv[idxs, 3].mean())
            pct = percentile_rank(sorted_cols["Lmean"], Lmean_g)
            label = label_fn(key)
            out[str(key)] = dict(key=key if not isinstance(key, tuple) else list(key), n=n,
                                 Lmean=round(Lmean_g, 1), vivid=round(vivid_g, 3), LmeanPct=pct,
                                 top=top, distinctive=dist[:8],
                                 findings=finding_group(label, "decade" if min_n == MIN_N["decade"] else "country",
                                                        n, pct, vivid_g))
        return out

    groups_out = dict(
        byDecade=group_block(decade_idx, MIN_N["decade"]),
        byCountry=group_block(country_idx, MIN_N["country"]),
        bySource=group_block(source_idx, MIN_N["source"], lambda k: GAL.SOURCES.get(k, {}).get("short", k)),
        byMovement=group_block(movement_idx, MIN_N["movement"]),
    )
    # how each movement's paintings were tagged: by the museum (0), by Wikidata on the painting (1), or only
    # through the painter's recorded movement (2). The UI says which, so the page never overstates.
    for key, g in groups_out["byMovement"].items():
        tiers = Counter(mv_tier.get(corpus[i]["id"], 0) for i in movement_idx[key])
        g["tiers"] = [tiers.get(0, 0), tiers.get(1, 0), tiers.get(2, 0)]

    # time trend: mean Lmean / vivid / warmFrac by century, for the index-level overview
    century_idx = defaultdict(list)
    for i, x in enumerate(corpus):
        if x.get("y") is not None:
            century_idx[(x["y"] // 100) * 100].append(i)
    trend = [dict(century=c, n=len(idxs), Lmean=round(float(fv[idxs, 0].mean()), 1),
                  vivid=round(float(fv[idxs, 3].mean()), 3))
             for c, idxs in sorted(century_idx.items()) if len(idxs) >= 10]

    # ---- write output ----
    print("writing output...", flush=True)
    if out_dir.exists():
        import shutil
        shutil.rmtree(out_dir)
    (out_dir / "artists").mkdir(parents=True)

    def ship_pct(pct):
        o = {"a": pct["arc"].get("Lmean")}
        if pct.get("art") is not None:
            o["p"] = pct["art"].get("Lmean")
            o["pn"] = pct.get("_n_art")
        return o

    def ship_painting(r):
        # cm: one packed base64 string, 2 bytes/color (ci*16+mc), instead of two JSON int arrays -- see
        # pack_colors(). bd/dk/lt (value band, darkest, lightest) are dropped entirely: a viewer that has
        # already decoded the gallery pool's hex can get L* for each color from js/core.js's own lab() just as
        # cheaply as we can here, so shipping them again would be pure duplication for a mechanical lookup
        # (unlike foc/glu/acc/hid, which encode real judgment -- a local-contrast proxy, family-mismatch and
        # distinctness tests -- worth precomputing once rather than reimplementing or recomputing per view).
        codes = [ci * 16 + mc for ci, mc in zip(r["nm"], r["md"])]
        stat = dict(r["stat"])
        stat["Lh"] = pack_hist(stat["Lh"])
        stat["hh"] = pack_hist(stat["hh"])
        o = dict(id=r["id"], n=r["n"], cm=pack_colors(codes), foc=r["foc"], glu=r["glu"],
                 stat=stat, pct=ship_pct(r["pct"]))
        if r["fb"]:
            o["fb"] = True
        if r["far"]:
            o["far"] = r["far"]
        if r["acc"]:
            o["acc"] = r["acc"]
        if r["hid"]:
            o["hid"] = r["hid"]
        if r["pigment"]:
            o["pig"] = r["pigment"]
        if r["finding"]:
            o["find"] = r["finding"]
        if r.get("nearestOtherCentury"):
            o["nn"] = r["nearestOtherCentury"]
        return o

    n_shards = 0
    total_bytes = 0
    for s in range(0, len(records), GALLERY_SHARD):
        chunk = records[s:s + GALLERY_SHARD]
        payload = [ship_painting(r) for r in chunk]
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        p = out_dir / f"paintings-{s // GALLERY_SHARD:03d}.json"
        p.write_text(text, encoding="utf-8")
        total_bytes += p.stat().st_size
        n_shards += 1

    for name, a_rec in artists_out.items():
        p = out_dir / "artists" / f"{a_rec['slug']}.json"
        p.write_text(json.dumps(a_rec, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total_bytes += p.stat().st_size

    groups_text = json.dumps(groups_out, ensure_ascii=False, separators=(",", ":"))
    (out_dir / "groups.json").write_text(groups_text, encoding="utf-8")
    total_bytes += len((out_dir / "groups.json").read_bytes())

    index = dict(
        v=1, built=__import__("datetime").date.today().isoformat(), n=len(corpus), nFallbackPool=n_fallback,
        nArtists=len(artists_out), nArtistsTotal=len(artist_idx),
        galleryShardSize=GALLERY_SHARD, nPaintingShards=n_shards,
        modCodes=MOD_CODES,
        thresholds=dict(veryCloseDE=VERY_CLOSE_DE, nearDE=NEAR_DE, mutedC=MUTED_C, vividC=VIVID_C,
                        lowL=LOW_L, highL=HIGH_L, minN=MIN_N),
        trend=trend,
        caveats=[
            "Photographs of aged, varnished paintings from six-plus museum cameras: every stat is 'as photographed'.",
            "Computed from each painting's 24-color pool + area shares only (tools/gallery.py's extract_pool); "
            "no raw pixel grid in this job, so the L* histogram, contrast range, gamut area and color count are "
            "palette-level proxies, not exact pixel-level statistics.",
            "No spatial information survives into the pool, so 'top vs ground' (sky vs floor) from ROADMAP §15 "
            "is not computed here; it needs a real pixel grid and is a §15 (live image upload) feature.",
            "'Focal color' uses chroma x |L - the painting's own mean L| as a local-contrast proxy, since there is "
            "no pixel position to measure real local contrast against neighbors.",
            "Country is often the painter's nationality, not place of painting, for several museums "
            "(research/STATS-FINDINGS.md §2 Metadata); movement is AIC-only, so byMovement covers a minority of "
            "the corpus (Wikimedia Commons rows carry no movement field at all).",
            "Pigment hints are hedged and screen-color-only: a name whose PIGMENT_SINCE year is plausibly close "
            "to the work's date, never a claim about the actual paint used.",
            "Small groups are anecdotes: artist entries start at 6 works; treat anything under ~15 as noise.",
            "Size tradeoff (ROADMAP §21's ~15 MB budget): each painting ships percentiles vs the whole archive "
            "and vs its own painter only, not vs its decade or movement too -- that comparison is still real, "
            "just computed once per group in groups.json instead of being repeated on all 23k+ painting records.",
        ],
        fields=dict(
            paintings="data/analysis/paintings-<shard>.json: positionally aligned with data/gallery/d/<shard>.json "
                      "(same shard size, same corpus order). id is kept as a self-check, but isn't needed to zip "
                      "the two files up. Deliberately does NOT repeat the pool's own hex/share, or anything a "
                      "viewer can get as cheaply from the hex it already has (L*/C*/H via js/core.js's lab(), "
                      "so darkest/lightest/value-band are a client-side sort/threshold, not shipped) -- only the "
                      "judgment calls and the one genuinely expensive lookup (nearest-of-1000 name) are here: "
                      "cm = base64, 2 bytes per pool color big-endian (code = coreNameIndex*16 + modCode; "
                      "coreNameIndex indexes data/core-names.json, modCode is an index into modCodes -- 14 means "
                      "'far/between', and far[pos] (pos = 0-based position in this painting's pool, matching "
                      "data/gallery's own pool order) then gives the second-nearest core-name index); "
                      "acc/hid = pool positions that are accents / hidden colors; foc/glu = the focal and "
                      "glue-midtone pool positions; "
                      "stat = key (value key), Lm/Cm (mean L*/C*, 0-100), Lh (10-bin L* histogram, base64 1 "
                      "byte/bin, share-weighted), ct/p5/p95 (contrast range), ch ([muted,moderate,vivid], "
                      "permille), wf (warm fraction, permille), hh (12-bin hue histogram, base64 1 byte/bin, "
                      "share x chroma weighted), ga (a*b* gamut/convex-hull area), en/ef (entropy x100 / "
                      "effective color count x10), hf/hs (harmony fit + score x100), df (dominant family); "
                      "pct = {a: percentile vs the whole archive, p/pn: percentile vs this painter + that "
                      "painter's n, when n>=10 -- decade/movement comparisons live on the group record instead "
                      "of being repeated on every painting, to keep shards small}; "
                      "pig = hedged pigment-era hint {ci, since}; find = plain-English findings; "
                      "nn = nearest painting by palette in a different century, when one is unusually close.",
            artists="data/analysis/artists/<slug>.json: one file per artist with >=6 works. clusters (k chosen by "
                    "silhouette, 2-5, only for n>=12), signature/avoided colors (lift vs same decade+country, "
                    "falling back to country then archive when the group is too small), pairs (co-occurrence "
                    "lift), byDecade + changePoint, typical/atypical paintings, nearest artists by palette, "
                    "barcode (chronological [id, year, top names]), findings.",
            groups="data/analysis/groups.json: byDecade / byCountry / bySource (museum) / byMovement, each a map "
                  "of key -> {n, Lmean, vivid, LmeanPct, top, distinctive (lift vs whole archive), findings}.",
        ),
    )
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=None), encoding="utf-8")
    total_bytes += len((out_dir / "index.json").read_bytes())

    biggest = max((f.stat().st_size for f in out_dir.rglob("*.json")), default=0)
    print(f"\ndata/analysis/: {len(corpus)} paintings, {len(artists_out)} artists with >=6 works "
          f"(of {len(artist_idx)} distinct named artists total). {n_shards} painting shards. "
          f"Total {total_bytes / 1e6:.2f} MB; biggest single file {biggest / 1e3:.0f} KB.", flush=True)

    return records, artists_out, groups_out, corpus, index


if __name__ == "__main__":
    main()
