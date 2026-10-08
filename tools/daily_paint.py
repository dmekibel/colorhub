#!/usr/bin/env python3
"""Today's painting: the offline game set (js/challenge.js reads data/daily-paint.json).

  python3 tools/daily_paint.py            # -> data/daily-paint.json (deterministic; safe to re-run)

One painting a day, the same for everyone, with five rounds that each look at it differently. Every round is
measured here, once, from the painting's own pixels, and every painting must pass every round's solvability gate
before it is allowed into the set. The app only re-reads what is stored here (plus a live overlay drawn from the
same local image), so the game never depends on a remote server being readable.

Which paintings: only ones whose pixels are on disk.
  - the 22 famous paintings (img/paintings/<slug>.jpg, 1200 px, with their own pages in the app);
  - Statens Museum for Kunst paintings with a local 200 px copy (img/gallery/smk/) AND a sharp museum image
    (the detail row's `hi` URL) for display. The local copy is what is measured; the sharp one is only shown.
  Dated (a year we can parse), titled, attributed, and not an extreme panorama. At most 2 per artist.

Per painting (all measured on a copy whose long side is at most 220 px; colors are as photographed):
  pool   up to 10 colors by k-means in CIELAB (seeded), each [hex, share of the canvas].
  grid   gw x gh: each cell's majority pool index (one base64 byte per cell). Used for tap hit-tests (round 1)
         and to place rings, so a tap is judged the same way on every phone.
  hid    round 1, "find the hidden color": a pool index whose color is muted (C* < 22), from a family that isn't
         the painting's dominant one, not one of its two biggest colors (tools/analyze.py's rule for "hidden"),
         covering 1.5-25% of the canvas in mostly one compact region (largest connected piece >= 35% of it).
  foc    round 2, "name the focal color": tools/analyze.py's focal rule (max C* x (0.4 + |L - mean L| / 50) among
         colors with >= 0.8% of the canvas). Its nearest of the ~1,000 core names must be within dE00 7, so the
         name is honest. Its main region's center (fx, fy) places the ring.
  spot   round 3, "the true color of a spot": the most context-shifted uniform patch: a square patch whose pixels
         agree (Lab spread < 4.5), whose square surround differs from it by dE00 >= 12, away from the edges.
         [x, y, r] normalized, plus the patch's mean color and the surround's mean color.
  ord    round 4, "put its palette in order": 4 pool colors at least dE00 15 apart; every pixel goes to the nearest
         of the 4 (so each share is "this color and its near relatives"), and the shares must step down by a
         factor of 1.3 or more each time, with the smallest at least 6% -- an eye can rank them.
  y      round 5, "guess the decade": the year (the first year of a range, or the "c." year).
  lp     the painting's mean lightness as a percentile of the archive's paintings from the same century
         (data/gallery index.bin, the same "mean L*" measure), for one honest finding on the reveal.

Output: data/daily-paint.json (the header: how many days, how many per shard) and data/daily-paint/<s>.json, the
days in shards of 32, so the app fetches about 30 KB for today instead of the whole set.
Schedule: the list order is the day order from No. 1 (2026-10-07, js/challenge.js DP_START). The famous paintings
come first on days 1-2, then one every 12 days; the museum paintings fill the days between in a seeded order.
"""
import base64, json, math, re, struct, subprocess, sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from multiprocessing import Pool
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402  rgb_to_lab, lab_to_rgb, de2000, family

OUT = ROOT / "data" / "daily-paint.json"          # {v, n, per, start, note}
SHARDS = ROOT / "data" / "daily-paint"            # <s>.json: days s*per .. s*per+per-1
PER = 32
MAX_SIDE = 220
GRID = 16                 # hit-test grid columns
SPOT_DE, SPOT_SPREAD = 9, 5.5          # round 3: surround differs by dE00 >= 9; the patch's own Lab spread <= 5.5
ORD_DE, ORD_RATIO, ORD_MIN = 12, 1.2, 0.04   # round 4: 4 colors dE00 >= 12 apart; shares step down x1.2+; smallest >= 4%
K = 10                    # pool size
N_GALLERY = 278           # museum paintings in the set (plus the famous ones)
FIRST = ["painting-sunflowers", "painting-milkmaid"]   # No. 1 (2026-10-07) and No. 2 (2026-10-08)


def year_of(s):
    m = re.search(r"(1[0-9]{3})", str(s or ""))
    return int(m.group(1)) if m else None


def to_hex(lab):
    return LIB.rgb_to_hex(LIB.lab_to_rgb(np.asarray(lab, dtype=float)))


def de_pair(a, b):
    """CIEDE2000 row by row: a, b (N, 3) -> (N,)"""
    out = np.empty(len(a))
    for s in range(0, len(a), 512):
        aa, bb = a[s:s + 512], b[s:s + 512]
        out[s:s + 512] = np.diagonal(LIB.de2000(aa, bb))
    return out


def kmeans(X, k, seed=11, iters=40):
    rng = np.random.default_rng(seed)
    # k-means++ seeding, deterministic
    c = [X[rng.integers(len(X))]]
    for _ in range(1, k):
        d = np.min(((X[:, None, :] - np.array(c)[None]) ** 2).sum(-1), 1)
        if d.sum() == 0:
            break
        c.append(X[rng.choice(len(X), p=d / d.sum())])
    C = np.array(c)
    for _ in range(iters):
        lab_ = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(-1), 1)
        nc = np.array([X[lab_ == j].mean(0) if (lab_ == j).any() else C[j] for j in range(len(C))])
        if np.allclose(nc, C, atol=1e-3):
            break
        C = nc
    return C


def components(mask):
    """sizes of 4-connected pieces of a 2D bool array"""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                st, n, cells = [(y, x)], 0, []
                seen[y, x] = True
                while st:
                    cy, cx = st.pop(); n += 1; cells.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True; st.append((yy, xx))
                out.append((n, cells))
    return sorted(out, key=lambda t: -t[0])


def core_names():
    d = json.load(open(ROOT / "data" / "core-names.json"))
    return d, LIB.labs([e["h"] for e in d])


def analyze(path, core_lab):
    im = Image.open(path).convert("RGB")
    s = MAX_SIDE / max(im.size)
    if s < 1:
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    w, h = im.size
    lab = LIB.rgb_to_lab(np.asarray(im, dtype=np.float64))          # (h, w, 3)
    X = lab.reshape(-1, 3)
    rng = np.random.default_rng(5)
    sub = X[rng.choice(len(X), min(len(X), 5000), replace=False)]
    C = kmeans(sub, K)
    hexes = [to_hex(c) for c in C]
    C = LIB.labs(hexes)                                               # snap to the hex actually shown
    lbl = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(-1), 1).reshape(h, w)
    share = np.bincount(lbl.ravel(), minlength=len(C)) / lbl.size
    order = np.argsort(-share)                                        # pool sorted by share
    remap = np.empty(len(C), int); remap[order] = np.arange(len(C))
    C, hexes, share, lbl = C[order], [hexes[i] for i in order], share[order], remap[lbl]
    keep = share > 0.004
    n = int(keep.sum())
    C, hexes, share = C[:n], hexes[:n], share[:n]
    if n < len(order):                                                # re-assign dropped specks
        lbl = np.argmin(((lab.reshape(-1, 3)[:, None, :] - C[None]) ** 2).sum(-1), 1).reshape(h, w)
        share = np.bincount(lbl.ravel(), minlength=n) / lbl.size
    LCH = [LIB.lch(c) for c in C]
    Lmean = float((C[:, 0] * share).sum())

    # ---- the grid (majority label per cell) ----
    gw = GRID
    gh = max(6, round(GRID * h / w))
    grid = np.zeros((gh, gw), int)
    cover = np.zeros((gh, gw, n))
    for gy in range(gh):
        for gx in range(gw):
            cell = lbl[gy * h // gh:(gy + 1) * h // gh or None, gx * w // gw:(gx + 1) * w // gw or None]
            cnt = np.bincount(cell.ravel(), minlength=n) / max(1, cell.size)
            cover[gy, gx] = cnt
            grid[gy, gx] = int(np.argmax(cnt))

    def region(i, frac=0.3):
        m = cover[:, :, i] >= frac
        comps = components(m)
        return m, comps

    def center(cells, idx=None):
        # the region's own cell nearest its mean (a curved region's mean can fall outside it); for the hidden
        # color, a cell whose majority is that color, so the ring and the hit-test agree
        ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
        my, mx = np.mean(ys), np.mean(xs)
        pool_ = [c for c in cells if idx is None or grid[c[0], c[1]] == idx] or cells
        cy, cx = min(pool_, key=lambda c: (c[0] - my) ** 2 + (c[1] - mx) ** 2)
        return round((cx + .5) / gw, 3), round((cy + .5) / gh, 3)

    fams = [LIB.family(*x) for x in LCH]
    fam_share = defaultdict(float)
    for f, sh in zip(fams, share):
        fam_share[f] += sh
    dom = max(fam_share, key=fam_share.get)

    # ---- round 2: focal ----
    cand = [i for i in range(n) if share[i] >= 0.008] or list(range(n))
    foc = max(cand, key=lambda i: LCH[i][1] * (0.4 + abs(LCH[i][0] - Lmean) / 50))
    near = LIB.de2000(C[foc:foc + 1], core_lab)[0]
    if near.min() >= 7:
        return None, "focal color has no close name"
    fm, fc = region(foc, 0.2)
    if not fc:
        return None, "focal color has no region"
    fx, fy = center(fc[0][1])

    # ---- round 1: hidden ----
    hid, hid_note = None, ""
    top2 = {0, 1}
    # tools/analyze.py's rule first (another family than the dominant one); then any quiet color the eye skips
    for strict in (True, False):
        for i in range(n):
            L_, C_, H_ = LCH[i]
            if i in top2 or i == foc or not (0.012 <= share[i] <= 0.3) or C_ >= (22 if strict else 26):
                continue
            if strict and fams[i] == dom:
                continue
            if LIB.de2000(C[i:i + 1], C[:2]).min() < (10 if strict else 12):
                continue
            m, comps = region(i, 0.25)
            tot = int(m.sum())
            if tot < 3 or tot > 0.4 * m.size or comps[0][0] < 0.3 * tot or not any(grid[c] == i for c in comps[0][1]):
                continue
            hid = i
            break
        if hid is not None:
            break
    if hid is None:
        return None, "no hidden color"
    hm, hc = region(hid, 0.25)
    hx, hy = center(hc[0][1], hid)

    # ---- round 3: spot ----
    r = max(2, round(0.03 * min(w, h)))
    R = 3 * r
    ii = np.pad(np.cumsum(np.cumsum(lab, 0), 1), ((1, 0), (1, 0), (0, 0)))
    ii2 = np.pad(np.cumsum(np.cumsum(lab ** 2, 0), 1), ((1, 0), (1, 0), (0, 0)))
    ys = np.arange(max(R + 2, int(0.12 * h) + 1), min(h - R - 2, int(0.88 * h)), 2)
    xs = np.arange(max(R + 2, int(0.12 * w) + 1), min(w - R - 2, int(0.88 * w)), 2)
    if not len(ys) or not len(xs):
        return None, "too small for a spot"
    YY, XX = np.meshgrid(ys, xs, indexing="ij")
    YY, XX = YY.ravel(), XX.ravel()
    box = lambda I, rr: I[YY + rr + 1, XX + rr + 1] - I[YY - rr, XX + rr + 1] - I[YY + rr + 1, XX - rr] + I[YY - rr, XX - rr]
    na, nb = (2 * r + 1) ** 2, (2 * R + 1) ** 2
    s1, s2, S1 = box(ii, r), box(ii2, r), box(ii, R)
    mu = s1 / na
    spread = np.sqrt(np.clip((s2 / na - mu ** 2).sum(1), 0, None))
    mo = (S1 - s1) / (nb - na)
    ok = spread <= SPOT_SPREAD
    if not ok.any():
        return None, "no uniform spot"
    idx = np.nonzero(ok)[0]
    d = de_pair(mu[idx], mo[idx])
    good = d >= SPOT_DE
    if not good.any():
        return None, "no context-shifted spot"
    sc = d - spread[idx]
    sc[~good] = -1e9
    bi = idx[int(np.argmax(sc))]
    sx, sy, mu, mo = int(XX[bi]), int(YY[bi]), mu[bi], mo[bi]
    spot = dict(x=round(sx / w, 3), y=round(sy / h, 3), r=round((r + .5) / min(w, h), 3), h=to_hex(mu), s=to_hex(mo))

    # ---- round 4: order ----
    from itertools import combinations
    pool_ix = list(range(min(n, 8)))
    D = LIB.de2000(C, C)
    best4 = None
    Xs = X[::3]
    for combo in combinations(pool_ix, 4):
        if min(D[a, b] for a, b in combinations(combo, 2)) < ORD_DE:
            continue
        cc = C[list(combo)]
        l4 = np.argmin(((Xs[:, None, :] - cc[None]) ** 2).sum(-1), 1)
        sh = np.bincount(l4, minlength=4) / l4.size
        o = np.argsort(-sh)
        ss = sh[o]
        if ss[3] < ORD_MIN:
            continue
        ratio = min(ss[0] / ss[1], ss[1] / ss[2], ss[2] / ss[3])
        if ratio < ORD_RATIO:
            continue
        if best4 is None or ratio > best4[0]:
            best4 = (ratio, [[hexes[combo[j]], round(float(sh[j]), 3)] for j in o])
    if best4 is None:
        return None, "no rankable 4 colors"
    pool = [[hexes[i], round(float(share[i]), 3)] for i in range(n)]
    g = base64.b64encode(bytes(int(v) for v in grid.ravel())).decode()
    return dict(w=w, h=h, gw=gw, gh=gh, pool=pool, g=g, hid=hid, hc=[hx, hy], foc=foc, fc=[fx, fy], spot=spot,
                ord=best4[1], Lm=round(Lmean, 1)), ""


def gallery_light():
    """mean L* per painting, by century, from data/gallery/index.bin (the archive's own measure)"""
    head = json.load(open(ROOT / "data/gallery/index.json"))
    b = (ROOT / "data/gallery/index.bin").read_bytes()
    R, y0 = head["rec"], head["year0"]
    byc = defaultdict(list)
    Ls = []
    years = []
    for i in range(head["n"]):
        o = i * R
        y = b[o] | b[o + 1] << 8
        L = b[o + 4] / 2.5
        Ls.append(L); years.append(y - y0 if y else None)
        if y:
            byc[(y - y0) // 100 * 100].append(L)
    return {k: np.sort(np.array(v)) for k, v in byc.items()}, Ls, years, head


_CORE_LAB = None


def _job(path):
    global _CORE_LAB
    if _CORE_LAB is None:
        _CORE_LAB = core_names()[1]
    return analyze(path, _CORE_LAB)


def main():
    core, core_lab = core_names()
    byc, gL, gY, head = gallery_light()

    def pct(L, year):
        arr = byc.get(year // 100 * 100)
        if arr is None or len(arr) < 100:
            return None, None
        return int(round(100 * np.searchsorted(arr, L) / len(arr))), int(year // 100 * 100)

    # ---- famous ----
    js = subprocess.run(["node", "-e", "const window={};eval(require('fs').readFileSync('data/paintings.js','utf8'));"
                         "process.stdout.write(JSON.stringify(window.PAINTINGS))"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    famous = []
    for p in json.loads(js):
        path = ROOT / p["img"]
        y = year_of(p["year"])
        if not path.exists() or not y:
            print("skip famous", p["id"], "(no image)" if not path.exists() else "(no year)")
            continue
        res, why = analyze(path, core_lab)
        if not res:
            print("skip famous", p["id"], why)
            continue
        lp, cn = pct(float(sum(lab_[0] * s for lab_, s in zip(LIB.labs([c["h"] for c in p["palette"]]), [c["share"] for c in p["palette"]]))), y)
        famous.append(dict(id=p["id"], k="f", node=p["id"], t=p["title"], a=p["artist"], yr=str(p["year"]), y=y,
                           pl=p["place"].split(" (")[0], img=p["img"], lp=lp, cn=cn, **res))

    # ---- museum paintings (SMK, local pixels + a sharp museum image) ----
    shard = head["shard"]
    rows = []
    for f in sorted((ROOT / "data/gallery/d").glob("*.json")):
        k = int(f.stem)
        for j, r in enumerate(json.load(open(f))):
            rows.append((k * shard + j, r))
    art_n = Counter(r[2] for _, r in rows if r[2])
    cands = []
    for gi, r in rows:
        rid, t, a, img, hi = r[0], r[1], r[2], r[5], r[9]
        if not str(img).startswith("img/gallery/smk/") or not hi or not a or not t or gY[gi] is None:
            continue
        y = gY[gi]
        if y < 1400 or y > 1950 or re.search(r"^(untitled|study|sketch)\b", t, re.I) or len(t) > 70:
            continue
        if re.search(r"unknown|anonymous|ubekendt|master|mester|workshop|værksted|school|skole|after|efter|copy|kopi", a, re.I):
            continue
        if art_n[a] < 4:
            continue
        cands.append((gi, r, y))
    # prefer the sharpest museum images (IIIF, 1000 px), then well-represented painters; seeded order inside
    rng = np.random.default_rng(2026)
    rng.shuffle(cands)
    cands.sort(key=lambda c: (0 if "iiif" in c[1][9] else 1))
    museum, per_artist, skipped, jobs, sub_n = [], Counter(), Counter(), [], Counter()
    for gi, r, y in cands:
        path = ROOT / r[5]
        if sub_n[r[2]] >= 5 or not path.exists():
            continue
        with Image.open(path) as im:
            ar = im.size[1] / im.size[0]
        if not 0.55 <= ar <= 1.8:
            skipped["aspect"] += 1
            continue
        sub_n[r[2]] += 1
        jobs.append((gi, r, y))
    with Pool(8) as pool:
        for (gi, r, y), (res, why) in zip(jobs, pool.imap(_job, [str(ROOT / j[1][5]) for j in jobs], chunksize=4)):
            if len(museum) >= N_GALLERY:
                break
            if per_artist[r[2]] >= 2:
                continue
            if not res:
                skipped[why] += 1
                continue
            lp, cn = pct(gL[gi], y)
            per_artist[r[2]] += 1
            museum.append(dict(id=r[0], k="g", gi=gi, t=r[1], a=r[2], yr=str(y), y=y, pl="Statens Museum for Kunst, Copenhagen",
                               img=r[5], hi=r[9], lp=lp, cn=cn, **res))
        pool.terminate()
    print(f"famous {len(famous)} · museum {len(museum)} · skipped {dict(skipped)}")

    # ---- the schedule ----
    fam = {p["id"]: p for p in famous}
    first = [fam.pop(i) for i in FIRST if i in fam]
    if len(first) < 2:   # a first-day painting failed a gate: the next famous ones take its place
        first += [fam.pop(i) for i in sorted(fam)[:2 - len(first)]]
    rest_f = sorted(fam.values(), key=lambda p: p["id"])
    np.random.default_rng(7).shuffle(rest_f)
    sched = list(first)
    mi = 0
    while mi < len(museum) or rest_f:
        if (len(sched) - 2) % 12 == 11 and rest_f:
            sched.append(rest_f.pop(0))
        elif mi < len(museum):
            sched.append(museum[mi]); mi += 1
        else:
            sched.append(rest_f.pop(0))
    meta = dict(v=1, n=len(sched), per=PER, start="2026-10-07",
                note="Measured from each painting's own pixels (a copy at most 220 px on its long side); colors are as photographed. "
                     "See tools/daily_paint.py for every round's gate.")
    SHARDS.mkdir(exist_ok=True)
    for f in SHARDS.glob("*.json"):
        f.unlink()
    for s0 in range(0, len(sched), PER):
        (SHARDS / f"{s0 // PER}.json").write_text(json.dumps(sched[s0:s0 + PER], separators=(",", ":"), ensure_ascii=False))
    OUT.write_text(json.dumps(meta, separators=(",", ":")))
    kb = sum(f.stat().st_size for f in SHARDS.glob("*.json")) // 1024
    print(f"wrote {OUT.relative_to(ROOT)} + {SHARDS.relative_to(ROOT)}/: {len(sched)} days in {math.ceil(len(sched) / PER)} shards, {kb} KB")

if __name__ == "__main__":
    main()
