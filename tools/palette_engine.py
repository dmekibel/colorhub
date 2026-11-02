"""ONE palette engine: pick a painting's colors, order them, name them. Used by social/instagram (palette.py, make.py)
and mirrored in js/gallery.js for live palettes. Run from colorhub/.

  pool   = vivid_pool(path)              40 real vivid pixels + area shares (tools/corpus.py pick_pool, never a cluster mean)
  chosen = pick(pool, k)                 full range, hue families spread, near-greys do not both earn a slot
  pal    = order(chosen)                 light to dark, each hue family ONE contiguous run
  names  = name_exact(lab) / name_post(lab, taken)

The rules (David, 2026-10-28): vivid core not average; distinct hues; light-to-dark first, smooth by hue second, a hue
family never split across the strip; exact names (min dE2000 over data/core-names.json) with a specific-name preference on posts."""
import json, os, sys
from itertools import permutations
import numpy as np
from PIL import Image
from skimage import color as skcolor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

NEUTRAL_C = 10.0      # below this chroma a color has no hue family; it is grouped by lightness instead
HUE_GAP = 24.0        # hues closer than this (degrees, chained) are one family
MIN_DE = 13.0         # no two picks closer than this
DULL_DE = 24.0        # two low-chroma picks must be at least this far apart (Cement vs Grey)

BASIC = {'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Violet', 'Pink', 'Brown', 'Grey', 'Gray', 'Black', 'White'}
_CORE = None


def de(a, b):
    return float(skcolor.deltaE_ciede2000(np.asarray(a)[None], np.asarray(b)[None])[0])


def lab_of_hex(h):
    return skcolor.rgb2lab(np.array([[[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]]]))[0, 0]


def hex_of_lab(lab):
    r = (skcolor.lab2rgb(np.array([[lab]]))[0, 0] * 255).round().astype(int)
    return '#%02X%02X%02X' % tuple(np.clip(r, 0, 255))


def chroma(lab): return float(np.hypot(lab[1], lab[2]))
def hue(lab): return float(np.degrees(np.arctan2(lab[2], lab[1])) % 360)
def hdist(a, b): d = abs(a - b) % 360; return min(d, 360 - d)


# ---------- pool ----------
def vivid_pool(path, crop=None, k=40):
    """the app's own pool (vivid-v2): each color a real vivid pixel, with its area share. Returns (Lab (m,3), shares (m,))"""
    import corpus as CORP
    im = Image.open(path).convert('RGB')
    if crop: im = CORP.crop_to(im, crop)
    s = CORP.K_SIDE / max(im.size)
    if s < 1: im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BOX)
    X = CORP.rgb_to_lab(np.asarray(im, dtype=np.float64).reshape(-1, 3))
    return CORP.pick_pool(X, k)


# ---------- pick ----------
def pick(S, sh, k=7):
    """Choose k of the pool. Seeds: the biggest area, then the lightest and darkest real colors (the strip needs both
    ends). Then greedy: each next color is the one most unlike what is chosen, favoring vivid and (lightly) big.
    Rejected outright: closer than MIN_DE to a pick, two near-greys closer than DULL_DE."""
    n = len(S)
    C = np.array([chroma(s) for s in S]); Hh = np.array([hue(s) for s in S])
    D = np.array([[de(S[i], S[j]) for j in range(n)] for i in range(n)])
    relax = [1.0]
    ok_pair = lambda i, j: D[i, j] >= (DULL_DE if C[i] < 14 and C[j] < 14 else MIN_DE) * relax[0]
    sig = sh >= .0012                      # ignore dust
    cand = [i for i in range(n) if sig[i]] or list(range(n))
    chosen = [max(cand, key=lambda i: sh[i])]
    seeds = [min(cand, key=lambda i: S[i][0]), max(cand, key=lambda i: S[i][0])]
    for i in sorted(seeds, key=lambda i: -sh[i]):
        # the extremes are seeded only when they are real colors (>= 0.4% area), and not near-duplicates of a pick
        if i not in chosen and len(chosen) < k and all(ok_pair(i, j) for j in chosen): chosen.append(i)
    fams = lambda ch: {int(Hh[i] // 30) for i in ch if C[i] >= NEUTRAL_C}
    while len(chosen) < k:
        best, bs = None, 0
        for i in cand:
            if i in chosen or not all(ok_pair(i, j) for j in chosen): continue
            d = min(D[i, j] for j in chosen)
            newfam = C[i] >= NEUTRAL_C and int(Hh[i] // 30) not in fams(chosen)
            s = min(d, 40) * (sh[i] ** .12) * (1 + C[i] / 45) * (1.35 if newfam else 1.0)
            if s > bs: best, bs = i, s
        if best is None:
            if relax[0] > .55: relax[0] -= .15; continue      # fewer than k distinct enough: loosen a little, never to near-duplicates
            break
        chosen.append(best)
    # vivid core: swap each pick for the most chromatic real pool color just beside it (same family, dE <= 11, lightness
    # within 9): the moon's yellow, not the olive the cluster averages to
    for a, i in enumerate(chosen):
        near = [j for j in cand if j not in chosen and D[i, j] <= 11 and abs(S[j][0] - S[i][0]) <= 9 and C[j] > C[i] + 4]
        if near: chosen[a] = max(near, key=lambda j: C[j])
    return [S[i] for i in chosen], [float(sh[i]) for i in chosen]


# ---------- order ----------
def families(labs):
    """hue families: chromatic colors chained by hue (HUE_GAP), near-neutrals by lightness band"""
    idx = list(range(len(labs))); fam = {}
    chrom = sorted([i for i in idx if chroma(labs[i]) >= NEUTRAL_C], key=lambda i: hue(labs[i]))
    groups = []
    for i in chrom:
        if groups and hdist(hue(labs[groups[-1][-1]]), hue(labs[i])) <= HUE_GAP: groups[-1].append(i)
        else: groups.append([i])
    if len(groups) > 1 and hdist(hue(labs[groups[0][0]]), hue(labs[groups[-1][-1]])) <= HUE_GAP:
        groups[0] = groups.pop() + groups[0]          # the circle closes
    out = [g for g in groups]
    for lo, hi in ((70, 101), (35, 70), (-1, 35)):
        g = [i for i in idx if chroma(labs[i]) < NEUTRAL_C and lo <= labs[i][0] < hi]
        if g: out.append(g)
    return out


def order(labs):
    """indices of `labs` in strip order: light to dark first, hue second, each family one contiguous run.
    Families are chosen by brute force (<= 8! orders) for the smoothest light-to-dark path; inside a family: light to dark."""
    n = len(labs)
    if n < 3: return sorted(range(n), key=lambda i: -labs[i][0])
    fams = [sorted(g, key=lambda i: -labs[i][0]) for g in families(labs)]
    if len(fams) > 8: fams = sorted(fams, key=lambda g: -np.mean([labs[i][0] for i in g]))
    first = max(range(n), key=lambda i: labs[i][0]); last = min(range(n), key=lambda i: labs[i][0])
    def w(a, b):
        La, Lb = labs[a], labs[b]
        up = max(0.0, Lb[0] - La[0] - 4)                 # stepping back to lighter costs
        return float(np.sqrt((2 * (La[0] - Lb[0])) ** 2 + (La[1] - Lb[1]) ** 2 + (La[2] - Lb[2]) ** 2)) + 8 * up
    best, bc = None, 1e18
    for perm in permutations(range(len(fams))):
        seq = [i for p in perm for i in fams[p]]
        c = sum(w(a, b) for a, b in zip(seq, seq[1:]))
        c += 40 * seq.index(first) + 40 * (n - 1 - seq.index(last))     # lightest near the start, darkest near the end
        if c < bc: best, bc = seq, c
    return best


# ---------- names ----------
def core_names():
    global _CORE
    if _CORE is None:
        root = os.path.dirname(HERE)
        core = json.load(open(os.path.join(root, 'data/core-names.json')))
        rgbs = np.array([[tuple(int(c['h'][i:i + 2], 16) / 255 for i in (1, 3, 5)) for c in core]])
        _CORE = (core, skcolor.rgb2lab(rgbs)[0])
    return _CORE


def name_exact(lab):
    """the app's own path: the minimum-dE2000 name over core-names.json (tools/check_nearest.js enforces it)"""
    core, labs = core_names()
    d = skcolor.deltaE_ciede2000(labs, np.asarray(lab)[None]); j = int(d.argmin())
    return core[j]['n'], float(d[j])


def name_post(lab, taken=(), slack=4.0, cap=8.0, learn=600):
    """posts: a specific learnable name among those within `slack` dE of the closest (never over `cap`), not already used"""
    core, labs = core_names()
    d = skcolor.deltaE_ciede2000(labs, np.asarray(lab)[None])
    order_ = [j for j in np.argsort(d) if core[j]['n'] not in taken]
    spec = [j for j in order_ if core[j]['n'] not in BASIC]
    if spec and d[spec[0]] <= cap: order_ = spec
    best = order_[0]
    near = [j for j in order_[:60] if d[j] <= min(d[best] + slack, max(cap, d[best]))]
    rank = lambda j: core[j].get('useRank', core[j].get('rank', 9999))
    j = min(near, key=lambda j: (rank(j) >= learn, rank(j)))
    return core[j]['n'], float(d[j])


# ---------- one call ----------
def palette(path, k=7, crop=None, post=True):
    """[(name, hex, share)] in strip order"""
    S, sh = vivid_pool(path, crop)
    labs, shares = pick(S, sh, k)
    o = order(labs); taken = set(); out = []
    for i in o:
        nm, _ = (name_post(labs[i], taken) if post else name_exact(labs[i])); taken.add(nm)
        out.append((nm, hex_of_lab(labs[i]), shares[i]))
    return out


def split_runs(hexes):
    """audit helper: True when a hue family is split across non-adjacent positions"""
    labs = [lab_of_hex(h) for h in hexes]
    for g in families(labs):
        g = sorted(g)
        if g[-1] - g[0] != len(g) - 1: return True
    return False
