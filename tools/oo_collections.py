#!/usr/bin/env python3
"""Odd one out, "Play with a painter's colors" (David, 2026-10-11): a swatch book, palette families and a
playable list of works for every painter, movement and decade with enough paintings in the archive.

Reads every painting's measured colors -- the 24-color pool in data/gallery/d/<shard>.json field 10 (base64, 4
bytes a color: r, g, b, share x 250; the area-weighted over-cluster tools/gallery.py extract_pool() made), or
the six-color palette in data/gallery/index.bin when a painting has no pool -- plus the hand-built featured
paintings in data/paintings.js. For each collection:

  swatch book  the union of all its paintings' colors, each weighted by its share of its own canvas (so every
               painting counts once, whatever its size), clustered by weighted k-means in OKLab. The book's size
               is the smallest k (searched between 60 and 200) whose swatches reproduce every measured color to
               within OKLab 0.02 on average (about one just-visible step), so a painter with a wide range of
               color gets a bigger book than one who works in a narrow band; specks under 0.05% of the total
               area are then dropped.
  families     every painting becomes a histogram over the swatch book (smoothed by perceptual distance), and
               the paintings are clustered on those (Hellinger distance): the recurring palettes. A family's
               colors are the swatches it uses far more than the painter does overall (weight x sqrt(lift)),
               its name is those colors' broad hue words, its example is its most typical (famous first) member.
  works        each painting's own 12-color Diverse palette (the painting page's), its family, how typical it is of the collection
               (Bhattacharyya overlap of its histogram with the collection's, as a percentile), whether it is
               famous (a featured page, or the painter's Wikidata-ranked famous list in
               data/artists/portraits.json), and each color's weight in the collection's profile (percentile of
               its nearest swatch). js/games/oo-ui.js picks each round's stops from ONE work's palette with these.

Photographs of varnished paintings, as measured: "the painter's palette" here means the colors of these
photographs, never pigments. Deterministic (fixed seeds, sorted inputs).

Output: data/games/oo/index.json  {v, built, method, c: [[kind, id, name, nPaintings, nSwatches, nFamilies, [3 hex]]]}
        data/games/oo/<kind>/<id>.json  {k, id, name, n, sw: [[hex, weight per 10,000]], fam: [[name, [hex], nMembers, exampleWork]],
          works: [[gallery index or -1, title, year, family, typical 0-100, famous 0/1, diverse [[hex, share per 1000, profile 0-99]], thumb, painting id, artist]]
            (thumb: data/gallery/thumbs.txt's code, or a featured page's own thumb; painting id only for a featured page;
            artist only in movement/decade collections; diverse: the painting page's 12-color Diverse palette (gallery.js
            glPoolDiverse), each [hex, share of the canvas per 1000, profile among the chromatic swatches 0-99]),
          lift: [12 numbers] its vivid-area share per 30-degree OKLab hue bin over the whole archive's,
          beautyPass: share of its paintings whose six-color palette alone clears the game's beauty gate}
Run: python3 tools/oo_collections.py      (prints the Monet example it reports)
"""
import base64, json, os, re, subprocess, sys, unicodedata
from collections import Counter, defaultdict
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, "tools")
import library as L

OUT = "data/games/oo"
MIN_PAINTER, MIN_GROUP = 12, 25          # same floors as data/analysis (artist_cluster, decade/movement)
CAP_PAINTER, CAP_GROUP = 150, 120        # works shipped per collection (the profile always uses all of them)
TARGET, K_LO, K_HI, SPECK, SIGMA = 0.02, 60, 200, 0.0005, 0.05

# ---------- color math ----------
def srgb_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)

def oklab(rgb):
    l = srgb_lin(rgb)
    m = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(l @ m.T)
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ m2.T

def oklab_to_hex(x):
    m2i = np.linalg.inv(np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]]))
    mi = np.linalg.inv(np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]]))
    lin = np.clip(((np.asarray(x) @ m2i.T) ** 3) @ mi.T, 0, 1)
    s = np.where(lin > 0.0031308, 1.055 * lin ** (1 / 2.4) - 0.055, 12.92 * lin)
    return ["#%02X%02X%02X" % tuple(int(round(v * 255)) for v in row) for row in np.atleast_2d(s)]

def hue_word(ok):
    """A broad, plural hue word for an OKLab color (family names: "Blues and violets")."""
    Lk, a, b = ok
    C, H = float(np.hypot(a, b)), float(np.degrees(np.arctan2(b, a)) % 360)
    if C < 0.035:
        return "whites" if Lk > 0.86 else "blacks" if Lk < 0.3 else "greys"
    if Lk < 0.3 and C < 0.08:
        return "blacks"
    if 45 <= H < 100:
        return "browns" if Lk < 0.58 else "oranges" if H < 70 else "golds"
    if 100 <= H < 125:
        return "olives" if Lk < 0.62 else "yellows"
    for lo, hi, w in ((345, 360, "pinks" if Lk > 0.72 else "reds"), (0, 20, "pinks" if Lk > 0.72 else "reds"), (20, 45, "reds"),
                      (125, 170, "greens"), (170, 215, "teals"), (215, 275, "blues"), (275, 320, "violets"), (320, 345, "pinks")):
        if lo <= H < hi:
            return w
    return "greys"

def beauty_good(hexes):
    """js/games/oo-ui.js ooBeautyGood, the same thresholds (CIELAB LCh)."""
    labs = L.labs(hexes)
    Ls = labs[:, 0]; Cs = np.hypot(labs[:, 1], labs[:, 2])
    meanC, maxC, maxL, rng = Cs.mean(), Cs.max(), Ls.max(), Ls.max() - Ls.min()
    return bool(maxC >= 28 and meanC >= 15 and maxL >= 48 and (rng >= 8 or meanC >= 22))

# ---------- clustering ----------
def sqd(X, C):
    return (X * X).sum(1)[:, None] - 2 * X @ C.T + (C * C).sum(1)[None, :]

def wkmeans(X, w, K, seed=0, iters=30):
    rs = np.random.RandomState(seed)
    K = min(K, len(X))
    C = [X[rs.choice(len(X), p=w / w.sum())]]
    d = ((X - C[0]) ** 2).sum(1)
    for _ in range(1, K):
        p = w * d; s = p.sum()
        if s <= 0: break
        C.append(X[rs.choice(len(X), p=p / s)])
        d = np.minimum(d, ((X - C[-1]) ** 2).sum(1))
    C = np.array(C)
    for _ in range(iters):
        a = sqd(X, C).argmin(1)
        W = np.bincount(a, weights=w, minlength=len(C))
        keep = W > 0
        newC = np.stack([np.bincount(a, weights=w * X[:, j], minlength=len(C)) for j in range(X.shape[1])], 1)
        newC[keep] /= W[keep][:, None]
        newC = newC[keep]
        if newC.shape == C.shape and np.abs(newC - C).max() < 1e-6:
            C = newC; break
        C = newC
    a = sqd(X, C).argmin(1)
    return C, a, np.bincount(a, weights=w, minlength=len(C))

def pool_diverse(pool, k, C):
    """js/gallery.js glPoolDiverse(pool, k) with no seed, plus each pick's nearest swatch in C. [((hex, share), swatch)]"""
    tot_all = sum(s for _, s in pool) or 1
    items = sorted([(c, s) for c, s in pool if s > 0], key=lambda x: -x[1])   # glPoolFromB64 sorts by share
    if not items: return []
    ok = oklab(np.array([c for c, _ in items]))
    if k >= len(items):
        picked = list(range(len(items)))
    else:
        start = max(range(len(items)), key=lambda q: items[q][1])
        picked, left = [start], [q for q in range(len(items)) if q != start]
        while len(picked) < k and left:
            d = [min(((ok[q] - ok[p]) ** 2).sum() for p in picked) for q in left]
            b = int(np.argmax(d))   # first max, as reduce((a, b) => b.s > a.s ? b : a) keeps the first
            picked.append(left.pop(b))
    area = np.zeros(len(picked))
    for q in range(len(items)):
        area[int(np.argmin([((ok[q] - ok[p]) ** 2).sum() for p in picked]))] += items[q][1]
    near = sqd(ok[picked], C).argmin(1)
    return [(("#%02X%02X%02X" % items[p][0], area[t] / tot_all), int(near[t])) for t, p in enumerate(picked)]

# ---------- hue lift: which hues this collection reaches for more than the archive does ----------
HUE_BINS = 12
def hue_hist(pool_list):
    """Area-weighted histogram over 12 OKLab hue bins (30 degrees each) of the clearly chromatic, not-dark colors
    (OKLab chroma >= 0.04, lightness >= 0.45) in a list of pools; every painting counts once. Normalized."""
    h = np.zeros(HUE_BINS)
    for pool in pool_list:
        tot = sum(s for _, s in pool) or 1
        ok = oklab(np.array([c for c, _ in pool]))
        Cc, Hh = np.hypot(ok[:, 1], ok[:, 2]), np.degrees(np.arctan2(ok[:, 2], ok[:, 1])) % 360
        m = (Cc >= 0.04) & (ok[:, 0] >= 0.45)
        np.add.at(h, (Hh[m] // 30).astype(int) % HUE_BINS, np.array([s for _, s in pool])[m] / tot)
    return h / max(h.sum(), 1e-9)

# ---------- inputs ----------
def load_gallery():
    head = json.load(open("data/gallery/index.json", encoding="utf-8"))
    buf = open("data/gallery/index.bin", "rb").read()
    N, R, Y0 = head["n"], head["rec"], head["year0"]
    years, six = [], []
    for i in range(N):
        o = i * R
        y = buf[o] | (buf[o + 1] << 8)
        years.append(y - Y0 if y else None)
        six.append([((buf[o + 6 + j * 4], buf[o + 7 + j * 4], buf[o + 8 + j * 4]), buf[o + 9 + j * 4] / 250) for j in range(6)])
    rows = []
    s = 0
    while os.path.exists(f"data/gallery/d/{s:03d}.json"):
        rows += json.load(open(f"data/gallery/d/{s:03d}.json", encoding="utf-8"))
        s += 1
    assert len(rows) == N, (len(rows), N)
    pools = []
    for i, r in enumerate(rows):
        pl = r[10] if len(r) > 10 else ""
        if pl:
            b = base64.b64decode(pl)
            pools.append([((b[k], b[k + 1], b[k + 2]), b[k + 3] / 250) for k in range(0, len(b) - 3, 4)])
        else:
            pools.append(six[i])
    thumbs = [ln.split("\t")[0] for ln in open("data/gallery/thumbs.txt", encoding="utf-8").read().split("\n")[:N]]
    return head, rows, years, six, pools, thumbs

def load_featured():
    """data/paintings.js's featured pages. Their six-color palette is area k-means (Impression, Sunrise's orange
    sun is too small to win one of six), so each also gets a real 24-color pool from its own local image by the
    gallery's own extractor (tools/gallery.py extract_pool), the same kind of pool every archive painting has."""
    js = "global.window={};require('./data/paintings.js');process.stdout.write(JSON.stringify(window.PAINTINGS.map(p=>({id:p.id,t:p.title,a:p.artist,y:p.year,th:p.thumb,img:p.img,pal:(p.palette||[]).map(c=>[c.h,c.share])}))))"
    feats = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))
    import gallery as GALM
    for f in feats:
        f["pool"] = []
        if f.get("img") and os.path.exists(f["img"]):
            f["pool"] = [(hex_rgb(h), s) for h, s in GALM.extract_pool(f["img"], k=24)]
    return feats

def hex_rgb(h):
    h = h.lstrip("#"); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", (t or "").lower()).encode("ascii", "ignore").decode()).strip()

# ---------- one collection ----------
def build(kind, cid, name, members, featured, G, fame_set, cap, base_hue):
    """members: gallery indices. featured: data/paintings.js entries that belong here."""
    head, rows, years, six, pools, thumbs = G
    # a featured page that is also in the gallery (same title) replaces that gallery row
    ftitles = {norm_title(f["t"]): f for f in featured}
    dup = {i for i in members if norm_title(rows[i][1]) in ftitles}
    items = []   # (gallery idx or -1, pool colors [(rgb, share)], featured or None)
    for i in members:
        if i in dup: continue
        items.append((i, pools[i], None))
    for f in featured:
        if f["pool"] or f["pal"]:
            items.append((-1, f["pool"] or [(hex_rgb(h), s) for h, s in f["pal"]], f))
    n = len(items)
    pts, wts, owner = [], [], []
    for p, (_, pool, _f) in enumerate(items):
        tot = sum(s for _, s in pool) or 1
        for rgb, s in pool:
            if s > 0:
                pts.append(rgb); wts.append(s / tot); owner.append(p)
    X = oklab(np.array(pts)); w = np.array(wts); owner = np.array(owner)
    # the smallest book that reproduces the measured colors within TARGET (bisection on k; error falls with k)
    def fit(k):
        C, a, W = wkmeans(X, w, k, seed=1)
        return C, W, float((np.sqrt(((X - C[a]) ** 2).sum(1)) * w).sum() / w.sum())
    lo, hi = K_LO, min(K_HI, len(X))
    best = fit(lo)
    if best[2] > TARGET and hi > lo:
        top = fit(hi)
        if top[2] > TARGET:
            best = top
        else:
            best = top
            while hi - lo > 6:
                mid = (lo + hi) // 2
                m = fit(mid)
                if m[2] <= TARGET: hi, best = mid, m
                else: lo = mid
    C, W, err = best
    K0 = len(C)
    keep = W >= SPECK * w.sum()
    C = C[keep]
    a = sqd(X, C).argmin(1)
    W = np.bincount(a, weights=w, minlength=len(C))
    order = np.argsort(-W); C, W = C[order], W[order]
    a = sqd(X, C).argmin(1)
    K = len(C)
    # per-painting histograms (raw and perceptually smoothed), the profile, typicality
    H = np.zeros((n, K))
    np.add.at(H, (owner, a), w)
    H /= H.sum(1, keepdims=True)
    D2 = sqd(C, C); Km = np.exp(-np.maximum(D2, 0) / (2 * SIGMA ** 2)); Km /= Km.sum(1, keepdims=True)
    Hs = H @ Km
    P = H.mean(0); Ps = Hs.mean(0)
    bc = np.sqrt(Hs * Ps[None, :]).sum(1)
    typ = (np.argsort(np.argsort(bc)) * 100 / max(1, n - 1)).round().astype(int)
    # families
    F0 = int(np.clip(round(n / 18), 2, 7))
    Xf = np.sqrt(Hs)
    Cf, fa, _ = wkmeans(Xf, np.ones(n), F0, seed=2)
    minsz = max(3, int(round(0.04 * n)))
    while True:
        sizes = np.bincount(fa, minlength=len(Cf))
        small = [j for j in range(len(Cf)) if sizes[j] < minsz]
        if not small or len(Cf) <= 1: break
        j = small[0]
        Cf = np.delete(Cf, j, 0)
        fa = sqd(Xf, Cf).argmin(1)
        Cf = np.stack([Xf[fa == k].mean(0) for k in range(len(Cf))])
    sizes = np.bincount(fa, minlength=len(Cf))
    forder = np.argsort(-sizes)
    remap = {int(o): k for k, o in enumerate(forder)}
    fa = np.array([remap[int(x)] for x in fa]); Cf = Cf[forder]
    is_famous = np.array([1 if (it[2] is not None or it[0] in fame_set) else 0 for it in items])
    fams = []
    for k in range(len(Cf)):
        mem = np.where(fa == k)[0]
        Fr = H[mem].mean(0)
        score = Fr * np.sqrt(Fr / (P + 1e-9))
        picks = []
        for j in np.argsort(-score):
            if Fr[j] < 0.004: continue
            if all(np.sqrt(((C[j] - C[q]) ** 2).sum()) > 0.06 for q in picks):
                picks.append(int(j))
            if len(picks) == 5: break
        words = []
        for j in picks:
            wd = hue_word(C[j])
            if wd not in words: words.append(wd)
            if len(words) == 2: break
        label = (words[0].capitalize() + (" and " + words[1] if len(words) > 1 else "")) if words else "Mixed"
        sim = np.sqrt(Hs[mem] * Hs[mem].mean(0)[None, :]).sum(1)
        rank = np.argsort(-sim)
        top = rank[: max(1, len(rank) // 4)]
        fam_top = [m for m in top if is_famous[mem[m]]]
        ex = int(mem[fam_top[0] if fam_top else rank[0]])
        fams.append([label, oklab_to_hex(C[picks]) if picks else [], int(len(mem)), ex])
    # two families with the same hue words are told apart by tone (their mean OKLab lightness)
    famL = [float((H[fa == k].mean(0) * C[:, 0]).sum()) for k in range(len(fams))]
    by_label = defaultdict(list)
    for k, fm in enumerate(fams): by_label[fm[0]].append(k)
    for label, ks in by_label.items():
        if len(ks) < 2: continue
        ks = sorted(ks, key=lambda k: famL[k])
        tags = ["darker", "lighter"] if len(ks) == 2 else ["darkest"] + ["middle"] * (len(ks) - 2) + ["lightest"]
        if len(ks) > 3: tags = ["darkest"] + [f"tone {t + 2}" for t in range(len(ks) - 2)] + ["lightest"]
        for k, t in zip(ks, tags): fams[k][0] = f"{label}, {t}"
    # profile weight of each swatch, as a percentile among the book's swatches; and, for the vivid accents, as a
    # percentile among its CHROMATIC swatches only (OKLab chroma >= 0.04), so a blue Monet returns to again and
    # again outranks a one-off, instead of every color losing to the greys that cover most of every canvas
    pw_sw = (np.argsort(np.argsort(P)) * 99 / max(1, K - 1)).round().astype(int)
    chroma_sw = np.hypot(C[:, 1], C[:, 2])
    chrom = np.where(chroma_sw >= 0.04)[0]
    pwv_sw = np.zeros(K, dtype=int)
    if len(chrom) > 1:
        pwv_sw[chrom] = (np.argsort(np.argsort(P[chrom])) * 99 / (len(chrom) - 1)).round().astype(int)
    # which works ship: every family keeps its share of the cap, best (famous, then typical) first
    rank_key = is_famous * 2 + typ / 100
    chosen = []
    if n <= cap:
        chosen = list(range(n))
    else:
        for k in range(len(Cf)):
            mem = [int(m) for m in np.where(fa == k)[0]]
            quota = max(2, int(round(cap * len(mem) / n)))
            chosen += sorted(mem, key=lambda m: -rank_key[m])[:quota]
        fam_ex = {f[3] for f in fams}
        chosen = sorted(set(chosen) | fam_ex)
    idx_map = {p: q for q, p in enumerate(chosen)}
    works, passes = [], 0
    for p, (gi, pool, f) in enumerate(items):
        pal = [(("#%02X%02X%02X" % c[0]), c[1]) for c in (six[gi] if gi >= 0 else [(hex_rgb(h), s) for h, s in f["pal"]])]
        pal = sorted([x for x in pal if x[1] > 0], key=lambda x: -x[1])[:6]
        if beauty_good([h for h, _ in pal[:5]]): passes += 1
        if p not in idx_map: continue
        # the colors a round picks from: the painting page's own 12-color Diverse palette (David, 2026-10-11:
        # "Monet's vivid colors... not his boring dull colors" / "use the diverse palette from the painting"),
        # js/gallery.js glPoolDiverse ported exactly -- farthest-point sampling in OKLab over the 24-color pool,
        # starting from the biggest color, so every distinct hue family gets a seat, small vivid accents included;
        # shares re-measured as each pool color's nearest pick. (The six-color area palette is mostly
        # varnish-greyed ground; it only feeds the beauty-gate statistic above.)
        colors = [[h, int(round(sh * 1000)), int(pwv_sw[j])] for (h, sh), j in pool_diverse(pool, 12, C)]
        if gi >= 0:
            y = years[gi]
            yr = "" if y is None else (f"{-y} BCE" if y < 0 else str(y))
            title = (rows[gi][1] or "Untitled")
            wrow = [gi, title[:90], yr, int(fa[p]), int(typ[p]), int(is_famous[p]), colors, thumbs[gi] if gi < len(thumbs) else "", "", rows[gi][2] if kind != "painter" else ""]
        else:
            wrow = [-1, f["t"], str(f["y"] or ""), int(fa[p]), int(typ[p]), 1, colors, f["th"] or "", f["id"], f["a"] if kind != "painter" else ""]
        works.append(wrow)
    for fm in fams:
        fm[3] = idx_map.get(fm[3], -1)
    sw = [[h, int(round(x * 10000))] for h, x in zip(oklab_to_hex(C), W / W.sum())]
    # hue lift: this collection's share of vivid area in each 30-degree OKLab hue bin over the whole archive's
    # (smoothed by 0.5% so an empty bin reads as "rare", not divide-by-zero). Monet's blues lift; the warm cast
    # every varnished photograph shares doesn't. js/games/oo-with.js weights a round's pair by it.
    hh = hue_hist([pool for _, pool, _f in items])
    lift = [round(float(x), 2) for x in (hh + 0.005) / (base_hue + 0.005)]
    return {"k": kind, "id": cid, "name": name, "n": n, "sw": sw, "fam": fams, "works": works, "lift": lift, "beautyPass": round(passes / max(1, n), 3)}, {
        "colorsIn": int(len(X)), "K0": K0, "err": err}

def main():
    G = load_gallery()
    head, rows, years, six, pools, thumbs = G
    feat = load_featured()
    meta_a = json.load(open("data/artists/meta.json", encoding="utf-8"))["a"]
    portraits = json.load(open("data/artists/portraits.json", encoding="utf-8"))["a"]
    fame_set = set()
    for slug, v in portraits.items():
        if v.get("famousBy") == "wikidata":
            fame_set.update(v.get("famous") or [])
    os.makedirs(OUT, exist_ok=True)
    index, report = [], {}
    base_hue = hue_hist(pools)

    def emit(kind, cid, name, members, featured, cap):
        data, info = build(kind, cid, name, members, featured, G, fame_set, cap, base_hue)
        os.makedirs(f"{OUT}/{kind}", exist_ok=True)
        with open(f"{OUT}/{kind}/{cid}.json", "w", encoding="utf-8") as fh:
            json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
        # three dots for the search list: its most characteristic vivid swatches -- weight x hue lift, CIELAB chroma
        # >= 25 and lightness >= 45, then a softer pass (12 / 38), hues 25 degrees apart (the same rule as
        # js/games/oo-with.js ooWithDots); else each family's own most distinctive color
        def dot_pass(minC, minL, light, hues):
            cand = []
            for h, w in data["sw"]:
                Lh, Ch, Hh = L.lch(L.labs([h])[0])
                if Ch < minC or Lh < minL or h in light: continue
                ok1 = oklab(np.array([hex_rgb(h)]))[0]
                b = int((np.degrees(np.arctan2(ok1[2], ok1[1])) % 360) // 30) % HUE_BINS
                cand.append((w * min(4.0, max(0.25, data["lift"][b])), h, Hh))
            for _sc, h, Hh in sorted(cand, key=lambda x: -x[0]):
                if len(light) == 3: break
                if any(min(abs(Hh - x) % 360, 360 - abs(Hh - x) % 360) <= 25 for x in hues): continue
                light.append(h); hues.append(Hh)
        light, hues = [], []
        dot_pass(25, 45, light, hues)
        dot_pass(12, 38, light, hues)   # a narrow-palette painter (Rembrandt): lighter, softer colors before any black
        for h in [f[1][0] for f in data["fam"] if f[1]] + [x[0] for x in data["sw"]]:   # fill any gap, never replace
            if len(light) == 3: break
            if h not in light: light.append(h)
        index.append([kind, cid, name, data["n"], len(data["sw"]), len(data["fam"]), light])
        report[(kind, cid)] = (data, info)

    # painters: the painter pages' own slugs and painting lists (data/artists/p/<slug>.json, names in meta.json)
    for fn in sorted(os.listdir("data/artists/p")):
        slug = fn[:-5]
        ix = sorted(set(json.load(open(f"data/artists/p/{fn}", encoding="utf-8")).get("ix") or []))
        nm = (meta_a.get(slug) or {}).get("n")
        if not nm or len(ix) < MIN_PAINTER: continue
        featured = [f for f in feat if f["a"] == nm]
        emit("painter", slug, nm, ix, featured, CAP_PAINTER)
    # movements: the museum's own, else Wikidata's for the painting, else the painter's (same tiers as tools/analyze.py)
    wd = json.load(open("data/artists/movements-wd.json", encoding="utf-8"))
    groups = json.load(open("data/analysis/groups.json", encoding="utf-8"))
    mv_of = {}
    for i, r in enumerate(rows):
        m = r[4] or wd["tier1"].get(r[0]) or wd["tier2"].get(r[0])
        if m: mv_of.setdefault(m, []).append(i)
    for key in sorted(groups["byMovement"]):
        mem = mv_of.get(key, [])
        if len(mem) < MIN_GROUP: continue
        emit("movement", slugify(key), key, mem, [], CAP_GROUP)
    # decades
    by_dec = defaultdict(list)
    for i, y in enumerate(years):
        if y is not None and y > 0: by_dec[y // 10 * 10].append(i)
    for key in sorted(groups["byDecade"], key=int):
        mem = by_dec.get(int(key), [])
        if len(mem) < MIN_GROUP: continue
        emit("decade", key, f"The {key}s", mem, [], CAP_GROUP)

    index.sort(key=lambda e: ({"painter": 0, "movement": 1, "decade": 2}[e[0]], -e[3]))
    meta = {"v": 1, "built": head.get("built"), "method": "tools/oo_collections.py: area-weighted OKLab k-means over every painting's measured colors, near-identical centers merged; paintings clustered into palette families on their swatch histograms.",
            "c": index}
    with open(f"{OUT}/index.json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, separators=(",", ":"), ensure_ascii=False)
    kinds = Counter(e[0] for e in index)
    sizes = [e[4] for e in index]
    print(f"{len(index)} collections {dict(kinds)} · swatch books {min(sizes)}-{max(sizes)} colors (median {int(np.median(sizes))})")
    for key in [("painter", "claude-monet"), ("painter", "vincent-van-gogh"), ("painter", "rembrandt-van-rijn"), ("movement", "impressionism")]:
        if key not in report: continue
        d, info = report[key]
        print(f"\n{d['name']}: {d['n']} paintings, {info['colorsIn']} measured colors -> {len(d['sw'])} swatches (k={info['K0']}, mean error {info['err']:.4f}), "
              f"{len(d['fam'])} families, {len(d['works'])} works shipped, six-color palettes clearing the beauty gate {d['beautyPass']:.0%}")
        print("  hue lift by 30-degree OKLab bin (0 = pinkish red ... 240 = blue ... 300 = violet): " + " ".join(f"{b * 30}:{x}" for b, x in enumerate(d["lift"])))
        for f in d["fam"]:
            ex = d["works"][f[3]] if f[3] >= 0 else None
            print(f"  {f[0]:<24} {f[2]:>4} paintings  {' '.join(f[1])}  e.g. {ex[1] if ex else '-'}")

if __name__ == "__main__":
    main()
