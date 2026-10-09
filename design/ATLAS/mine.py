#!/usr/bin/env python3
"""Harmony learned from art: an empirical pass over the ColorHub corpus (design/ATLAS/ATLAS.md section 7).

Reads only what is already in the repo:
  data/gallery/index.json + index.bin   year and museum per painting
  data/gallery/d/*.json                 title, artist, image path, the 24-color pool (RGB + area share), crop
  data/analysis/paintings-*.json        nearest core-name code per pool color (cm)
  data/core-names.json                  the names
  img/gallery/{aic,smk}/*.jpg           the ~4,850 small (200 px) images held locally, for the spatial findings
Writes design/ATLAS/data/findings.json. Deterministic (fixed seeds). About a minute on a laptop.

Every finding carries n, an effect size, a null baseline and a 95% interval, and is dropped when n is under its
minimum or its interval includes the null. Colors are "as photographed": varnish, cameras and the archive's mix
(Dutch, Danish and American collections) shape every number.
"""
import base64, glob, json, math, os, re, random
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "data", "findings.json")
rng = np.random.default_rng(7)
random.seed(7)

# ---------------- color math (OKLab, Ottosson 2020) ----------------
def srgb_to_oklab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)

def lch(ok):
    L, a, b = ok[..., 0], ok[..., 1], ok[..., 2]
    return L, np.hypot(a, b), (np.degrees(np.arctan2(b, a)) + 360) % 360

# OKLCH hue families (chroma >= .04), plus three neutrals by lightness. Hue edges follow OKLCH, where pure red
# sits near 29 deg, orange ~55, yellow ~110, green ~142, cyan ~195, blue ~264, magenta ~328.
FAMS = [("Reds", 10, 40), ("Oranges & browns", 40, 70), ("Ochres & olives", 70, 100), ("Yellows", 100, 125),
        ("Yellow-greens", 125, 145), ("Greens", 145, 175), ("Teals", 175, 210), ("Blues", 210, 250),
        ("Deep blues", 250, 285), ("Violets", 285, 325), ("Pinks & crimsons", 325, 370)]
NEUT = ["Darks", "Greys", "Pales"]
FAM_NAMES = [f[0] for f in FAMS] + NEUT
CHROMA_MIN = 0.04

def family_of(L, C, H):
    """vectorized: index into FAM_NAMES"""
    out = np.zeros(L.shape, dtype=np.int16)
    Hh = np.where(H < 10, H + 360, H)
    for i, (_, lo, hi) in enumerate(FAMS):
        out[(Hh >= lo) & (Hh < hi)] = i
    neu = C < CHROMA_MIN
    out[neu & (L < 0.42)] = len(FAMS)
    out[neu & (L >= 0.42) & (L < 0.72)] = len(FAMS) + 1
    out[neu & (L >= 0.72)] = len(FAMS) + 2
    return out

WARM_DIR = np.array([math.cos(math.radians(60)), math.sin(math.radians(60))])   # OKLab a/b toward orange-yellow

def wilson(k, n, z=1.96):
    if n == 0: return [0, 0]
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(c - h, 3), round(c + h, 3)]

def boot_ci(vals, f=np.median, B=1000):
    vals = np.asarray(vals)
    if len(vals) < 5: return [None, None]
    idx = rng.integers(0, len(vals), (B, len(vals)))
    s = np.array([f(vals[i]) for i in idx])
    return [round(float(np.percentile(s, 2.5)), 3), round(float(np.percentile(s, 97.5)), 3)]

# ---------------- load ----------------
head = json.load(open(os.path.join(ROOT, "data/gallery/index.json")))
binb = open(os.path.join(ROOT, "data/gallery/index.bin"), "rb").read()
N, R = head["n"], head["rec"]
years = np.zeros(N, dtype=np.int32); mus = np.zeros(N, dtype=np.int16)
for i in range(N):
    o = i * R; y = binb[o] | binb[o + 1] << 8
    years[i] = (y - head["year0"]) if y else -99999
    mus[i] = binb[o + 2]
rows = []
for f in sorted(glob.glob(os.path.join(ROOT, "data/gallery/d/*.json"))):
    rows.extend(json.load(open(f)))
assert len(rows) == N, (len(rows), N)
names = json.load(open(os.path.join(ROOT, "data/core-names.json")))
cm_rows = []
for f in sorted(glob.glob(os.path.join(ROOT, "data/analysis/paintings-*.json"))):
    cm_rows.extend(json.load(open(f)))
assert len(cm_rows) == N

def pool_of(i):
    b64 = rows[i][10] if len(rows[i]) > 10 else ""
    if not b64: return None
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 4)
    return arr[:, :3], arr[:, 3] / 250.0

def cm_codes(i):
    s = cm_rows[i].get("cm") or ""
    if not s: return []
    raw = base64.b64decode(s)
    return [(raw[k] << 8 | raw[k + 1]) // 16 for k in range(0, len(raw) - 1, 2)]

print("decoding pools...")
POOL = [None] * N
for i in range(N):
    p = pool_of(i)
    if p is None: continue
    ok = srgb_to_oklab(p[0]); sh = p[1] / max(p[1].sum(), 1e-9)
    L, C, H = lch(ok)
    POOL[i] = dict(ok=ok, sh=sh, L=L, C=C, H=H)
have = [i for i in range(N) if POOL[i] is not None]
print("paintings with pools:", len(have))

def era_of(y):
    if y < -9999: return None
    if y < 1500: return "before 1500"
    if y < 1600: return "1500s"
    if y < 1700: return "1600s"
    if y < 1800: return "1700s"
    if y < 1900: return "1800s"
    return "1900s"
ERAS = ["before 1500", "1500s", "1600s", "1700s", "1800s", "1900s"]

findings = []

# ================= A1. Which hue intervals painters actually pair (vs a stratified shuffle) =================
# Every pair of chromatic notes in a painting (C >= .04, >= 1% of the area), weighted by the product of their
# areas, binned by hue difference. Null: the same notes paired with notes from a DIFFERENT painting of the same
# museum and century (which keeps each camera's cast and each century's varnish in the baseline).
print("A1 hue intervals...")
BINS = np.arange(0, 181, 15)
def notes(i):
    P = POOL[i]; m = (P["C"] >= CHROMA_MIN) & (P["sh"] >= 0.01)
    return P["H"][m], P["sh"][m], P["ok"][m]
def pair_hist(A, B, same):
    hA, wA, oA = A; hB, wB, oB = B
    if len(hA) == 0 or len(hB) == 0: return np.zeros(len(BINS) - 1)
    d = np.abs(hA[:, None] - hB[None, :]); d = np.minimum(d, 360 - d)
    w = wA[:, None] * wB[None, :]
    far = np.linalg.norm(oA[:, None, :] - oB[None, :, :], axis=-1) >= 0.08    # two distinct notes, not two shades the
    if same:                                                                    # clustering split out of one patch
        iu = np.triu_indices(len(hA), 1); d = d[iu]; w = w[iu]; far = far[iu]
    else:
        d = d.ravel(); w = w.ravel(); far = far.ravel()
    return np.histogram(d[far], BINS, weights=w[far])[0]
strata = {}
for i in have:
    e = era_of(years[i])
    if e is None: continue
    strata.setdefault((int(mus[i]), e), []).append(i)
NOTE = {i: notes(i) for i in have}
CO, CN, CE = [], [], []
for (m, e), ids in strata.items():
    if len(ids) < 10: continue
    for i in ids:
        if len(NOTE[i][0]) < 2: continue
        o = pair_hist(NOTE[i], NOTE[i], True)
        if o.sum() <= 0: continue
        acc = np.zeros(len(BINS) - 1)
        for _ in range(3):
            j = ids[rng.integers(len(ids))]
            if j != i: acc += pair_hist(NOTE[i], NOTE[j], False)
        if acc.sum() <= 0: continue
        acc *= o.sum() / acc.sum()
        CO.append(o); CN.append(acc); CE.append(e)
CO, CN, CE = np.array(CO), np.array(CN), np.array(CE)
npaint = {e: int((CE == e).sum()) for e in ERAS}; npaint["all"] = len(CE)
def ratio(e):
    m = np.ones(len(CE), bool) if e == "all" else CE == e
    return [round(float(a / b), 3) if b > 0 else None for a, b in zip(CO[m].sum(0), CN[m].sum(0))]
r_all = ratio("all")
lab_bins = [f"{BINS[k]}-{BINS[k+1]}" for k in range(len(BINS) - 1)]
def boot_ratio(k, B=400):
    s = []
    for _ in range(B):
        idx = rng.integers(0, len(CO), len(CO))
        s.append(CO[idx, k].sum() / max(CN[idx, k].sum(), 1e-12))
    return [round(float(np.percentile(s, 2.5)), 2), round(float(np.percentile(s, 97.5)), 2)]
ci_close, ci_comp = boot_ratio(0), boot_ratio(len(BINS) - 2)
findings.append(dict(
    id="intervals", kind="bars", title="Painters keep hues close; opposites are rarer than chance",
    sentence=f"Within one painting, hues 0 to 15 degrees apart sit together {r_all[0]:.1f}x as often as chance predicts; "
             f"near-opposite hues (165 to 180 degrees) {r_all[-1]:.1f}x.",
    n=npaint["all"], effect=dict(close=r_all[0], opposite=r_all[-1], ci_close=ci_close, ci_opposite=ci_comp),
    bins=lab_bins, ratio=r_all, byEra={e: ratio(e) for e in ERAS if npaint[e] >= 200}, nEra={e: npaint[e] for e in ERAS},
    method="Every pair of distinct chromatic notes (OKLCH chroma >= .04, >= 1% of the area, OKLab distance >= .08) in each painting's 24-color pool, weighted "
           "by area x area, binned by hue difference. Null: the same notes paired with a random other painting from the same "
           "museum and century (keeps each camera's cast and each century's varnish). Ratio = observed / null. 95% interval: "
           "bootstrap over paintings.",
    caveat="Varnish pulls every hue toward amber, which the same-museum, same-century null only partly removes."))

# ================= A2. Named pairs that art makes more often than chance (era-stratified lift) =================
print("A2 named pairs...")
pres = []
for i in have:
    codes = cm_codes(i); P = POOL[i]
    if not codes: pres.append(None); continue
    s = {}
    for k, c in enumerate(codes[:len(P["sh"])]):
        s[c] = s.get(c, 0) + P["sh"][k]
    pres.append((i, frozenset(c for c, v in s.items() if v >= 0.02)))
pres = [p for p in pres if p and era_of(years[p[0]])]
by_era = {}
for i, S in pres: by_era.setdefault((era_of(years[i]), int(mus[i])), []).append(S)
cnt = {}; pair = {}
for S in (S for _, S in pres):
    for a in S: cnt[a] = cnt.get(a, 0) + 1
    L_ = sorted(S)
    for x in range(len(L_)):
        for y in range(x + 1, len(L_)):
            pair[(L_[x], L_[y])] = pair.get((L_[x], L_[y]), 0) + 1
era_cnt = {e: {} for e in by_era}
for e, Ss in by_era.items():
    for S in Ss:
        for a in S: era_cnt[e][a] = era_cnt[e].get(a, 0) + 1
name_ok = {}
def nok(c):
    if c not in name_ok: name_ok[c] = srgb_to_oklab(np.array([int(names[c]["h"][k:k + 2], 16) for k in (1, 3, 5)]))
    return name_ok[c]
cands = []
for (a, b), k in pair.items():
    if k < 40: continue
    if np.linalg.norm(nok(a) - nok(b)) < 0.15: continue          # distinct colors only (not two shades of one)
    La, Ca, Ha = lch(nok(a)); Lb, Cb, Hb = lch(nok(b)); dh = abs(Ha - Hb); dh = min(dh, 360 - dh)
    if Ca >= .04 and Cb >= .04 and dh < 45: continue              # cross-hue partners: not a light and dark of one hue
    if Ca < .04 and Cb < .04: continue                             # not two greys
    if min(Ca, Cb) < .04 and (min(Ca, Cb) > .025 or max(Ca, Cb) < .07): continue   # a true grey with a clear hue only
    exp = sum(era_cnt[e].get(a, 0) * era_cnt[e].get(b, 0) / len(Ss) for e, Ss in by_era.items())
    if exp <= 0: continue
    lift = k / exp
    # Poisson 95% interval on the observed count
    lo, hi = (k - 1.96 * math.sqrt(k)) / exp, (k + 1.96 * math.sqrt(k)) / exp
    if lo <= 1: continue
    cands.append(dict(a=names[a]["n"], ah=names[a]["h"], b=names[b]["n"], bh=names[b]["h"], n=k, lift=round(lift, 2), ci=[round(lo, 2), round(hi, 2)],
                      pmi=round(math.log2(lift), 2)))
cands.sort(key=lambda d: -d["lift"] * math.log(d["n"]))
findings.append(dict(
    id="pairs", kind="pairs", title="Partners art chooses",
    sentence=f"Once each museum's and century's habits are taken out, few cross-hue pairs beat chance, and they are mostly a deep red or olive set against near-black. Strongest: {cands[0]['a']} with {cands[0]['b']}, {cands[0]['lift']}x (n = {cands[0]['n']})." if cands else "",
    n=len(pres), pairs=cands[:12],
    method="Each painting's pool colors named with the nearest of the ~900 core names; a name is 'present' at >= 2% of the area. "
           "Lift = paintings holding both / expected, where expected sums each museum-and-century stratum's own rates (so two colors "
           "that are merely both common in one museum's 1600s don't count). Cross-hue partners only (>= 45 deg apart, or a neutral with a hue). Kept: >= 40 paintings, OKLab distance >= .15 (two distinct colors), and a 95% Poisson "
           "interval above 1.",
    caveat="Names are nearest-name labels of photographed color; a pair is a habit of the archive, not a rule of harmony."))

# ================= A3. Inequality of the palette (Gini of area shares) by century =================
print("A3 gini...")
def gini(x):
    x = np.sort(x); n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1).dot(x) / (n * x.sum())) if x.sum() > 0 else 0
G = {e: [] for e in ERAS}
for i in have:
    e = era_of(years[i])
    if e: G[e].append(gini(POOL[i]["sh"]))
findings.append(dict(
    id="gini", kind="line", title="Does one color rule the canvas?",
    sentence="The Gini index of each painting's area shares (0 = every color equal, 1 = one color is everything), median by century.",
    n=sum(len(v) for v in G.values()),
    series=[dict(era=e, n=len(G[e]), median=round(float(np.median(G[e])), 3), ci=boot_ci(G[e])) for e in ERAS if len(G[e]) >= 50],
    method="Gini over the 24 pool shares of each painting (the pool over-clusters, so this is a relative, not absolute, measure).",
    caveat="Dark varnished pictures merge into a few big dark clusters, which raises their Gini."))

# ================= A4. Dating a painting from its palette alone =================
print("A4 dating...")
def feat(i):
    P = POOL[i]; sh = P["sh"]
    Lh = np.histogram(P["L"], [0, .3, .4, .5, .6, .7, .8, 1.01], weights=sh)[0]
    w = sh * np.minimum(P["C"], .2)
    Hh = np.histogram(P["H"], np.arange(0, 361, 45), weights=w)[0] / max(w.sum(), 1e-9) * min(1, (sh * P["C"]).sum() / .06)
    warm = (sh * ((P["ok"][:, 1:] @ WARM_DIR) > 0.01)).sum()
    return np.concatenate([Lh, Hh, [(sh * P["C"]).sum() * 10, (sh * P["L"]).sum(), warm, gini(sh)]])
dat = [i for i in have if 1300 <= years[i] <= 1925]
X = np.array([feat(i) for i in dat]); Y = years[dat].astype(float)
mu, sd = X.mean(0), X.std(0) + 1e-9; Xs = (X - mu) / sd
perm = rng.permutation(len(dat)); folds = np.array_split(perm, 5); pred = np.zeros(len(dat))
for f in folds:
    tr = np.setdiff1d(perm, f)
    for s in np.array_split(f, max(1, len(f) // 500)):
        d = ((Xs[s][:, None, :] - Xs[tr][None, :, :]) ** 2).sum(-1)
        nn = np.argpartition(d, 25, axis=1)[:, :25]
        pred[s] = np.median(Y[tr][nn], axis=1)
err = np.abs(pred - Y); null_err = np.abs(Y - np.median(Y))
# where it fails: most anachronistic (palette says a very different century), well-known painters only
fail = []
for k in np.argsort(-err)[:400]:
    i = dat[k]; r = rows[i]
    if r[2] and len(fail) < 6 and err[k] > 150:
        fail.append(dict(id=r[0], t=r[1], a=r[2], y=int(Y[k]), pred=int(round(pred[k])), img=r[5]))
by_c = {}
for k, i in enumerate(dat):
    by_c.setdefault(int(Y[k] // 100 * 100), []).append(err[k])
findings.append(dict(
    id="dating", kind="dating", title="A palette alone can date a painting",
    sentence=f"From its colors alone, half of {len(dat):,} paintings are dated within {np.median(err):.0f} years; guessing the archive's median year is off by {np.median(null_err):.0f}.",
    n=len(dat), effect=dict(medianErr=round(float(np.median(err)), 1), nullMedianErr=round(float(np.median(null_err)), 1),
                             ci=boot_ci(err), within25=round(float((err <= 25).mean()), 3)),
    byCentury=[dict(c=c, n=len(v), medianErr=round(float(np.median(v)), 1)) for c, v in sorted(by_c.items()) if len(v) >= 50],
    misfits=fail,
    method="Features: share-weighted lightness histogram (7 bins), chroma-weighted hue histogram (8), mean chroma, mean lightness, "
           "warm share, Gini. 25-nearest-neighbor median year, 5-fold cross-validation (a painting never predicts itself).",
    caveat="Part of what dates a picture is its varnish and the museum that photographed it, not only the painter's choices."))

# ================= A5. Telling painters apart from 24 colors =================
print("A5 fingerprint...")
art = {}
for i in have:
    a = rows[i][2]
    if a: art.setdefault(a, []).append(i)
art = {a: v for a, v in art.items() if len(v) >= 20}
A = sorted(art)
FX = {i: (feat(i) - mu) / sd for a in A for i in art[a]}
cent = {a: np.mean([FX[i] for i in art[a]], 0) for a in A}
top1 = top5 = tot = 0
C_ = np.array([cent[a] for a in A])
for ai, a in enumerate(A):
    n_a = len(art[a])
    for i in art[a]:
        c = C_.copy(); c[ai] = (cent[a] * n_a - FX[i]) / (n_a - 1)       # leave this painting out of its own painter
        d = ((c - FX[i]) ** 2).sum(1); rank = int((d < d[ai]).sum())
        top1 += rank == 0; top5 += rank < 5; tot += 1
findings.append(dict(
    id="fingerprint", kind="stat", title="Whose palette is it?",
    sentence=f"Among {len(A)} painters with 20+ works, the nearest painter-average palette names the right painter {top1/tot:.0%} of the time "
             f"(top five: {top5/tot:.0%}); chance is {1/len(A):.1%} (top five {5/len(A):.1%}).",
    n=tot, effect=dict(top1=round(top1 / tot, 3), top5=round(top5 / tot, 3), chance1=round(1 / len(A), 4), painters=len(A),
                       ci1=wilson(top1, tot), ci5=wilson(top5, tot)),
    method="Same 19 palette features; nearest painter centroid, leaving the painting out of its own painter's centroid.",
    caveat="Many painters are held by one museum, so part of the 'fingerprint' is that museum's camera."))

# ================= B. Spatial findings from the local images =================
print("B spatial...")
PORT = re.compile(r"portrait|portræt|self-portrait|selvportræt|bildnis|\bportret", re.I)
LAND = re.compile(r"landscape|landskab|\bview\b|udsigt|river|\bsea\b|coast|kyst|forest|\bskov|\bwood|mountain|valley|\blake|harbou?r|\bfield|\bbay\b|sunset|moonlight|meadow|\bhav\b|\bså\b|strand|beach|hills?\b", re.I)
def genre(t):
    t = t or ""
    if PORT.search(t): return "portrait"
    if LAND.search(t): return "landscape"
    return "other"
VO = {k: {g: [] for g in ("all", "landscape", "portrait")} for k in range(len(FAM_NAMES))}
TB = {g: [0, 0] for g in ("landscape", "portrait", "other")}
FG = {}           # era bucket -> [center lighter, n]
WL = {g: [0, 0] for g in ("landscape", "portrait", "other")}
ADJ_O = np.zeros((len(FAM_NAMES), len(FAM_NAMES))); ADJ_E = np.zeros_like(ADJ_O)
SKIN = []
nimg = 0
for i in range(N):
    r = rows[i]; p = r[5] or ""
    if not p.startswith("img/gallery/"): continue
    fp = os.path.join(ROOT, p)
    if not os.path.exists(fp): continue
    try: im = Image.open(fp).convert("RGB")
    except Exception: continue
    crop = r[11] if len(r) > 11 else None
    if crop and isinstance(crop[0], list): crop = crop[0]
    W0, H0 = im.size
    if crop and len(crop) == 4 and crop[2] - crop[0] > 100 and crop[3] - crop[1] > 100:
        im = im.crop((crop[0] * W0 // 1000, crop[1] * H0 // 1000, crop[2] * W0 // 1000, crop[3] * H0 // 1000))
    im.thumbnail((96, 96), Image.BILINEAR)
    a = np.asarray(im)
    if a.shape[0] < 24 or a.shape[1] < 24: continue
    ok = srgb_to_oklab(a); L, C, H = lch(ok)
    if C.mean() < 0.006: continue                       # a black-and-white photograph slipped through
    nimg += 1
    g = genre(r[1]); h, w = L.shape
    fam = family_of(L, C, H)
    ys = np.repeat(np.linspace(0, 1, h)[:, None], w, 1)
    for k in np.unique(fam):
        m = fam == k
        if m.mean() >= 0.02:
            yy = float(ys[m].mean())
            VO[int(k)]["all"].append(yy)
            if g != "other": VO[int(k)][g].append(yy)
    # top third vs bottom third
    t3, b3 = L[: h // 3].mean(), L[-(h // 3):].mean()
    if g in TB: TB[g][0] += t3 - b3 > 0.02; TB[g][1] += 1
    # figure vs ground (portraits): central box vs outer band
    if g == "portrait":
        cy0, cy1, cx0, cx1 = int(h * .18), int(h * .7), int(w * .3), int(w * .7)
        band = np.ones_like(L, bool); bw = max(2, int(min(h, w) * .12)); band[bw:-bw, bw:-bw] = False
        ctr = L[cy0:cy1, cx0:cx1].mean(); bg = L[band].mean()
        y = years[i]
        e = "before 1700" if y < 1700 else "1700s" if y < 1800 else "1800-1849" if y < 1850 else "1850-1899" if y < 1900 else "1900s"
        if y > -9999:
            FG.setdefault(e, [0, 0]); FG[e][0] += ctr - bg > 0.02; FG[e][1] += 1
        # flesh notes: central pixels in the warm, light-ish band, by era
        cz = ok[cy0:cy1, cx0:cx1].reshape(-1, 3); Lc, Cc, Hc = lch(cz)
        fm = (Hc > 30) & (Hc < 80) & (Lc > .5) & (Lc < .9) & (Cc > .03) & (Cc < .14)
        if fm.mean() > 0.04 and y > -9999: SKIN.append((y, cz[fm].mean(0)))
    # warm lights vs cool shadows
    flatL = L.ravel(); q20, q80 = np.quantile(flatL, [.2, .8]); ab = ok[..., 1:].reshape(-1, 2) @ WARM_DIR
    lw, dw = ab[flatL >= q80].mean(), ab[flatL <= q20].mean()
    WL[g][0] += lw - dw > 0.005; WL[g][1] += 1
    # adjacency of families: right and down neighbours
    for A_, B_ in ((fam[:, :-1], fam[:, 1:]), (fam[:-1, :], fam[1:, :])):
        d = A_ != B_
        np.add.at(ADJ_O, (A_[d], B_[d]), 1); np.add.at(ADJ_O, (B_[d], A_[d]), 1)
    p_ = np.bincount(fam.ravel(), minlength=len(FAM_NAMES)) / fam.size
    T = (h * (w - 1) + (h - 1) * w) * 2
    ADJ_E += T * np.outer(p_, p_)
    if nimg % 1000 == 0: print("   images", nimg)
print("images used:", nimg)

vo = []
for k in range(len(FAM_NAMES)):
    v = VO[k]["all"]
    if len(v) >= 60:
        vo.append(dict(fam=FAM_NAMES[k], n=len(v), median=round(float(np.median(v)), 3), ci=boot_ci(v),
                       land=round(float(np.median(VO[k]["landscape"])), 3) if len(VO[k]["landscape"]) >= 30 else None,
                       nLand=len(VO[k]["landscape"])))
vo.sort(key=lambda d: d["median"])
findings.append(dict(
    id="vertical", kind="vertical", title="The vertical order of color",
    sentence="Where each color family sits on the canvas, from top to bottom: its median height, over every painting where it covers 2% or more.",
    n=nimg, families=vo,
    method="Local 200 px images (Art Institute of Chicago and SMK), frames cropped, reduced to 96 px. Each pixel gets an OKLCH family; "
           "a family's height in a painting is the mean row of its pixels (0 = top, 1 = bottom). Null: 0.5. 95% interval: bootstrap.",
    caveat="Two museums only (Chicago and Copenhagen): Danish and American painting are over-represented."))
findings.append(dict(
    id="topbottom", kind="split", title="Light above, dark below",
    sentence="Share of paintings whose top third is lighter than their bottom third (by more than 2 lightness points).",
    n=sum(v[1] for v in TB.values()),
    groups=[dict(g=g, k=int(v[0]), n=v[1], p=round(v[0] / v[1], 3), ci=wilson(v[0], v[1])) for g, v in TB.items() if v[1] >= 50],
    method="Mean OKLab lightness of the top third vs the bottom third. Genre from title words (portrait / landscape words), the rest 'other'. Null: 50%.",
    caveat="Genre from titles is rough; Danish titles are matched too."))
findings.append(dict(
    id="figureground", kind="split", title="Lit figure, dark ground",
    sentence="Share of portraits whose middle (where the sitter usually is) is lighter than the edges of the canvas, by era.",
    n=sum(v[1] for v in FG.values()),
    groups=[dict(g=e, k=int(FG[e][0]), n=FG[e][1], p=round(FG[e][0] / FG[e][1], 3), ci=wilson(*FG[e])) for e in
            ["before 1700", "1700s", "1800-1849", "1850-1899", "1900s"] if e in FG and FG[e][1] >= 30],
    method="Portraits by title. Center box = middle 40% across, 18-70% down; ground = the outer 12% band. Null: 50%. 95% Wilson interval.",
    caveat="Center-weighting is a stand-in for real figure detection; old varnish darkens edges and corners more than centers."))
findings.append(dict(
    id="warmlights", kind="split", title="Warm lights, cool shadows?",
    sentence="Share of paintings whose lightest fifth of pixels is warmer than its darkest fifth.",
    n=sum(v[1] for v in WL.values()),
    groups=[dict(g=g, k=int(v[0]), n=v[1], p=round(v[0] / v[1], 3), ci=wilson(v[0], v[1])) for g, v in WL.items() if v[1] >= 50],
    method="OKLab a/b projected on the orange-yellow direction (60 deg); lightest 20% of pixels vs darkest 20%. Null: 50%.",
    caveat="Yellowed varnish warms light passages most visibly, so 'warm lights' is inflated for old pictures."))
lift = np.where(ADJ_E > 0, ADJ_O / np.maximum(ADJ_E, 1e-9), 0)
adj = []
for x in range(len(FAM_NAMES)):
    for y in range(x + 1, len(FAM_NAMES)):
        if ADJ_O[x, y] >= 2000:
            adj.append(dict(a=FAM_NAMES[x], b=FAM_NAMES[y], lift=round(float(lift[x, y]), 2), n=int(ADJ_O[x, y])))
adj.sort(key=lambda d: -d["lift"])
findings.append(dict(
    id="adjacency", kind="matrix", title="Which colors touch",
    sentence="How often two color families share an edge, against what their areas alone predict (1.0 = chance).",
    n=nimg, fams=FAM_NAMES, lift=[[round(float(v), 2) for v in row] for row in lift], top=adj[:8], bottom=adj[-6:],
    method="Right and down neighbor pixels with different families; expected = total neighbor pairs x area share x area share, per painting, summed.",
    caveat="Neighbouring hues touch more partly because a soft gradient passes through them; at 96 px, brushwork blurs."))
if SKIN:
    sk = {}
    for y, okv in SKIN:
        e = "before 1700" if y < 1700 else "1700s" if y < 1800 else "1800s" if y < 1900 else "1900s"
        sk.setdefault(e, []).append(okv)
    def okhex(o):
        L, a, b = o; l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3; m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3; s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        rgb = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_]
        f = lambda v: 255 * (1.055 * max(v, 0) ** (1 / 2.4) - 0.055 if v > 0.0031308 else 12.92 * max(v, 0))
        return "#" + "".join(f"{int(max(0, min(255, round(f(v))))):02X}" for v in rgb)
    findings.append(dict(
        id="flesh", kind="swatches", title="The flesh note, century by century",
        sentence="The average light, warm note at the center of portraits, by century.",
        n=len(SKIN), series=[dict(era=e, n=len(v), hex=okhex(np.mean(v, 0)), L=round(float(np.mean(v, 0)[0]), 3)) for e, v in
                            [(e, sk[e]) for e in ["before 1700", "1700s", "1800s", "1900s"] if e in sk and len(sk[e]) >= 20]],
        method="Portraits by title; central pixels with OKLCH hue 30-80, lightness .5-.9, chroma .03-.14 (a broad flesh band), when they cover >= 4% of the center.",
        caveat="Varnish yellows flesh most visibly; this is photographed flesh, not mixed paint."))

json.dump(dict(v=1, built="2026-10-09", nPaintings=N, nPools=len(have), nImages=nimg, findings=findings),
          open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
for f in findings: print("-", f["id"], ":", f.get("sentence", "")[:240])
