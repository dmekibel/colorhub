#!/usr/bin/env python3
"""The learned palette picker (design/PALETTE-ENGINE.md §4c and §8, Stage 1, David 2026-10-11).

Learns how a human curator picks a painting's palette, from real examples, and is judged only on paintings it
never saw while learning.

Examples: 171 cards (a painting + the curator's five swatches) extracted from David's screen recording of a
Pinterest board, "Painting Palettes" (research/_raw/palette-cards/, gitignored: the curator's palettes are an
evaluation set, never shipped). Even-numbered cards train; odd-numbered cards are the held-out test, the same
split the hand-made recipe and the baselines were scored on (§4c), so the numbers compare directly.

How it picks:
  candidates  real pixel colors: every painting pixel (at the pools' 200 px working size) is binned on a fine
              CIELAB grid (3 x 4 x 4); each occupied cell with a minimum of pixels gives one candidate, the real
              pixel nearest the cell's mean. Nothing is invented.
  features    how a curator sees a candidate: how much of the canvas holds it (within dE76 6) and its family
              (within 15); how vivid it is within its own family and on the whole canvas (percentiles); how light
              it is within its family and on the canvas; its chroma relative to the most the sRGB screen can show
              at that lightness and hue; and, against the colors already chosen, how far it is from the nearest
              one, whether it repeats a hue family, and which pick this is.
  model       logistic regression (plain numpy, L2, Newton steps), trained with the curator's own picks as the
              targets: at each step, with some of the curator's swatches already "chosen", the candidates nearest
              a remaining swatch are positives and the rest negatives (several random orders per card).
  selection   greedy: the best-scoring candidate that is at least delta (CIEDE2000) from everything already
              chosen, then the next. So the 5-color palette is exactly the first five of the 10 or the 20.
Scoring: the mean CIEDE2000 between the curator's five and ours, matched one-to-one (Hungarian), as in §4c.

Run:  python3 tools/palette_picker.py eval      train (with 5-fold CV on the training cards to pick the two
                                                hyperparameters), then the one test on the held-out cards
      python3 tools/palette_picker.py artists   the van Gogh vs Monet check on our own archive images
      python3 tools/palette_picker.py show      the comparison image for the five famous held-out paintings
"""
import json, os, sys, pickle
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as L  # noqa: E402


def raw_dir():
    """research/_raw is gitignored, so a worktree reads the main checkout's (same rule as tools/analyze.py)."""
    local = ROOT / "research" / "_raw"
    if local.exists():
        return local
    s = str(ROOT)
    if "/.claude/worktrees/" in s:
        return Path(s.split("/.claude/worktrees/")[0]) / "research" / "_raw"
    return local


RAW = raw_dir()
CARDS = RAW / "palette-cards"
CACHE = CARDS / "_features.pkl"
MAX_SIDE = 200
GRID = np.array([3.0, 4.0, 4.0])
K = 5
FEAT_V = 2          # bump when the features change (invalidates the cached candidates)

# ---------- color helpers ----------
_MINV = np.linalg.inv(L._M)


def in_gamut(lab):
    lab = np.asarray(lab, float)
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * L._WP
    lin = xyz @ _MINV.T
    return np.all((lin >= -1e-4) & (lin <= 1 + 1e-4), -1)


def rel_chroma(lab):
    """chroma as a share of the most the sRGB screen can show at that lightness and hue"""
    Lc, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    C, H = np.hypot(a, b), np.arctan2(b, a)
    lo, hi = np.zeros_like(C), np.full_like(C, 160.0)
    for _ in range(14):
        m = (lo + hi) / 2
        ok = in_gamut(np.stack([Lc, m * np.cos(H), m * np.sin(H)], 1))
        lo, hi = np.where(ok, m, lo), np.where(ok, hi, m)
    return np.where(lo > 1, np.minimum(1, C / np.maximum(lo, 1e-6)), 0)


def load_px(path, crop=None):
    im = Image.open(path).convert("RGB")
    if crop and len(crop) == 4:
        w, h = im.size
        im = im.crop((crop[0] * w / 1000, crop[1] * h / 1000, crop[2] * w / 1000, crop[3] * h / 1000))
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.BOX)
    return np.asarray(im).reshape(-1, 3)


def hue_deg(lab):
    return np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360


# ---------- one painting: candidates and their static features ----------
class Painting:
    def __init__(self, px):
        self.px = px
        lab = L.rgb_to_lab(px.astype(float))
        self.lab, N = lab, len(px)
        cell = np.floor(lab / GRID).astype(int)
        _, inv, counts = np.unique(cell, axis=0, return_inverse=True, return_counts=True)
        inv = inv.ravel()
        order = np.argsort(inv, kind="stable")
        starts = np.r_[0, np.cumsum(counts)]
        keep = np.where(counts >= max(3, 0.0005 * N))[0]
        ci = []
        for k in keep:
            mem = order[starts[k]:starts[k + 1]]
            m = lab[mem].mean(0)
            ci.append(mem[np.argmin(((lab[mem] - m) ** 2).sum(1))])
        ci = np.array(ci)
        self.ci, self.cand = ci, lab[ci]
        self.cand_rgb = px[ci]
        M = len(ci)
        tree = cKDTree(lab)
        Lp, Cp = lab[:, 0], np.hypot(lab[:, 1], lab[:, 2])
        cC = np.hypot(self.cand[:, 1], self.cand[:, 2])
        a6 = tree.query_ball_point(self.cand, r=6, return_length=True) / N
        fam = tree.query_ball_point(self.cand, r=15)
        a15 = np.array([len(f) for f in fam]) / N
        cpf, lpf, cmaxf = np.zeros(M), np.zeros(M), np.zeros(M)
        for i, f in enumerate(fam):
            f = np.asarray(f)
            cpf[i] = (Cp[f] < cC[i]).mean()
            lpf[i] = (Lp[f] < self.cand[i, 0]).mean()
            cmaxf[i] = cC[i] / max(Cp[f].max(), 1e-6)
        sC, sL = np.sort(Cp), np.sort(Lp)
        cpc = np.searchsorted(sC, cC) / N
        lpc = np.searchsorted(sL, self.cand[:, 0]) / N
        rel = rel_chroma(self.cand)
        Lc = self.cand[:, 0] / 100
        # its hue family, at any lightness: how big it is on the canvas, and how vivid this candidate is within it
        # (a curator takes about one color per hue family, §4c)
        Hp = hue_deg(lab)
        chrom = Cp > 10
        hc = hue_deg(self.cand)
        hshare, hcpct = np.zeros(M), np.zeros(M)
        for i in range(M):
            dh = np.abs(Hp - hc[i]) % 360
            mfam = chrom & (np.minimum(dh, 360 - dh) < 20)
            hshare[i] = mfam.mean()
            hcpct[i] = (Cp[mfam] < cC[i]).mean() if mfam.any() else 0.0
        self.static = np.stack([
            np.log10(a6 + 1e-4), np.log10(a15 + 1e-4),
            cpf, cpf ** 2, lpf, cmaxf,
            cpc, lpc, lpc ** 2,
            rel, rel ** 2, cC / 100, Lc, Lc ** 2,
            (cC < 8).astype(float),
            np.log10(hshare + 1e-4), hcpct, hcpct ** 2,
        ], 1)
        self.rel, self.cC, self.H = rel, cC, hue_deg(self.cand)
        self.share6 = a6

    def setfeats(self, chosen, t):
        M = len(self.cand)
        if len(chosen) == 0:
            md = np.full(M, 60.0)
            same = np.zeros(M)
            dL = np.full(M, 1.0)
            nneu = np.zeros(M)
        else:
            chosen = np.asarray(chosen)
            md = L.de2000(self.cand, chosen).min(1)
            cch = np.hypot(chosen[:, 1], chosen[:, 2])
            ch = hue_deg(chosen)
            dh = np.abs(self.H[:, None] - ch[None, :]) % 360
            dh = np.minimum(dh, 360 - dh)
            same = ((dh < 25) & (cch[None, :] > 12) & (self.cC[:, None] > 12)).sum(1).astype(float)
            dL = np.minimum(np.abs(self.cand[:, None, 0] - chosen[None, :, 0]).min(1), 50) / 50
            nneu = ((cch < 8).sum() * (self.cC < 8)).astype(float)    # a second near-neutral
        mdc = np.minimum(md, 40) / 40
        return np.stack([mdc, mdc ** 2, (md < 10).astype(float), same, np.full(M, t / K), dL, nneu], 1), md

    def features(self, chosen, t):
        s, md = self.setfeats(chosen, t)
        return np.hstack([self.static, s]), md


# ---------- model ----------
class Model:
    def __init__(self, beta, mu, sd):
        self.beta, self.mu, self.sd = beta, mu, sd

    def score(self, X):
        Z = (X - self.mu) / self.sd
        return Z @ self.beta[:-1] + self.beta[-1]

    def to_json(self, names):
        return {"features": names, "mean": self.mu.tolist(), "sd": self.sd.tolist(), "beta": self.beta.tolist()}


FEATURE_NAMES = ["log area (dE6)", "log family area (dE15)", "chroma pct in family", "chroma pct in family^2",
                 "lightness pct in family", "chroma / family max", "chroma pct on canvas", "lightness pct on canvas",
                 "lightness pct on canvas^2", "screen-relative chroma", "screen-relative chroma^2", "chroma/100",
                 "L/100", "(L/100)^2", "near-neutral", "log hue-family area", "chroma pct in hue family",
                 "chroma pct in hue family^2", "dist to chosen (capped)", "dist to chosen^2",
                 "closer than 10 to a chosen", "same hue family as chosen", "pick index", "lightness gap to chosen",
                 "another near-neutral"]


def fit_lr(X, y, w, lam):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = np.hstack([(X - mu) / sd, np.ones((len(X), 1))])
    beta = np.zeros(Z.shape[1])
    reg = np.r_[np.ones(Z.shape[1] - 1), 0.0] * lam
    for _ in range(40):
        p = 1 / (1 + np.exp(-np.clip(Z @ beta, -30, 30)))
        g = Z.T @ (w * (y - p)) - reg * beta
        Hm = Z.T @ (Z * (w * p * (1 - p))[:, None]) + np.diag(reg + 1e-9)
        step = np.linalg.solve(Hm, g)
        beta += step
        if np.abs(step).max() < 1e-7:
            break
    return Model(beta, mu, sd)


def examples(p, sw_lab, seed, n_orders=6, neg=200):
    rng = np.random.RandomState(seed)
    Dm = L.de2000(p.cand, sw_lab)
    X, y, w = [], [], []
    for _ in range(n_orders):
        order = rng.permutation(len(sw_lab))
        for t in range(len(sw_lab)):
            chosen, rem = sw_lab[order[:t]], order[t:]
            F, _ = p.features(chosen, t)
            d = Dm[:, rem].min(1)
            pos = np.where(d <= max(5.0, d.min() + 2.0))[0]
            negi = np.setdiff1d(np.arange(len(d)), pos)
            negi = rng.choice(negi, min(neg, len(negi)), replace=False)
            X += [F[pos], F[negi]]
            y += [np.ones(len(pos)), np.zeros(len(negi))]
            w += [np.full(len(pos), 1 / len(pos)), np.full(len(negi), 1 / len(negi))]
    return np.vstack(X), np.concatenate(y), np.concatenate(w)


def pick(p, model, k=K, delta=9.0):
    """greedy nested selection: indices into p.cand, in pick order. When no candidate is delta away from every
    color already chosen, the spacing loosens step by step (delta x 0.6, x 0.3, then none) rather than stopping,
    so a palette always reaches k colors and its first picks never change."""
    idx = []
    for t in range(min(k, len(p.cand))):
        F, md = p.features(p.cand[idx] if idx else [], t)
        base = model.score(F)
        for d in (delta, delta * 0.6, delta * 0.3, 0.0):
            s = base.copy()
            if idx:
                s[md < d] = -np.inf
                s[idx] = -np.inf
            j = int(np.argmax(s))
            if np.isfinite(s[j]):
                idx.append(j)
                break
        else:
            break
    return idx


def match(ref_lab, lab):
    D = L.de2000(np.asarray(ref_lab), np.asarray(lab))
    r, c = linear_sum_assignment(D)
    return D[r, c]


# ---------- the card set ----------
def load_cards():
    cards = json.load(open(CARDS / "cards.json"))
    if CACHE.exists():
        import __main__
        if not hasattr(__main__, "Painting"):
            __main__.Painting = Painting      # the cache was written when this file ran as a script
        cached = pickle.load(open(CACHE, "rb"))
        if cached.get("n") == len(cards) and cached.get("grid") == GRID.tolist() and cached.get("v") == FEAT_V:
            return cards, cached["paintings"]
    ps = []
    for c in cards:
        ps.append(Painting(load_px(CARDS / f"c{c['id']:03d}.png")))
    pickle.dump({"n": len(cards), "grid": GRID.tolist(), "v": FEAT_V, "paintings": ps}, open(CACHE, "wb"))
    return cards, ps


def train(cards, ps, ids, lam, seed=0):
    Xs, ys, ws = [], [], []
    for i in ids:
        X, y, w = examples(ps[i], L.labs(cards[i]["swatches"]), seed + i)
        Xs.append(X); ys.append(y); ws.append(w)
    return fit_lr(np.vstack(Xs), np.concatenate(ys), np.concatenate(ws), lam)


def evaluate(cards, ps, ids, model, delta):
    out = []
    for i in ids:
        sel = pick(ps[i], model, K, delta)
        out.append(match(L.labs(cards[i]["swatches"]), ps[i].cand[sel]).mean())
    return np.array(out)


def cmd_eval():
    cards, ps = load_cards()
    even = [c["id"] for c in cards if c["id"] % 2 == 0]
    odd = [c["id"] for c in cards if c["id"] % 2 == 1]
    print(f"{len(cards)} cards: {len(even)} train, {len(odd)} held out; candidates per painting median "
          f"{int(np.median([len(p.cand) for p in ps]))}")
    orc = [match(L.labs(cards[i]["swatches"]), ps[i].cand).mean() for i in odd]
    print(f"candidate ceiling on the held-out cards (perfect choice from our candidates): {np.mean(orc):.1f}")
    # 5-fold CV on the training cards only, to choose the regularization and the minimum spacing
    folds = [even[f::5] for f in range(5)]
    best = None
    for lam in (0.3, 3.0, 30.0):
        for delta in (9.0, 12.0, 15.0, 18.0):
            errs = []
            for f in range(5):
                tr = [i for i in even if i not in folds[f]]
                m = train(cards, ps, tr, lam)
                errs += list(evaluate(cards, ps, folds[f], m, delta))
            e = float(np.mean(errs))
            print(f"   CV lam={lam:<5} delta={delta:<5} -> {e:.2f}")
            if best is None or e < best[0]:
                best = (e, lam, delta)
    _, lam, delta = best
    model = train(cards, ps, even, lam)
    test = evaluate(cards, ps, odd, model, delta)
    print(f"\nchosen on training cards only: lam={lam}, delta={delta} (CV {best[0]:.2f})")
    print(f"HELD-OUT TEST ({len(odd)} cards): mean {test.mean():.1f}, median {np.median(test):.1f}")
    json.dump({"lam": lam, "delta": delta, "test": test.tolist(), "odd": odd, "model": model.to_json(FEATURE_NAMES)},
              open(CARDS / "_picker_eval.json", "w"))
    # the final model for everything else is trained on all 171 cards, with the same two settings
    full = train(cards, ps, [c["id"] for c in cards], lam)
    json.dump({"lam": lam, "delta": delta, "model": full.to_json(FEATURE_NAMES)}, open(CARDS / "_picker_full.json", "w"))
    order = np.argsort(-np.abs(model.beta[:-1]))
    print("strongest features (standardized weight):")
    for j in order[:8]:
        print(f"   {FEATURE_NAMES[j]:<32} {model.beta[j]:+.2f}")


def cmd_cv():
    """cross-validation on the training cards only: for development, never looks at the held-out cards"""
    cards, ps = load_cards()
    even = [c["id"] for c in cards if c["id"] % 2 == 0]
    folds = [even[f::5] for f in range(5)]
    for lam in (0.3, 3.0, 30.0):
        for delta in (9.0, 12.0, 15.0):
            errs = []
            for f in range(5):
                m = train(cards, ps, [i for i in even if i not in folds[f]], lam)
                errs += list(evaluate(cards, ps, folds[f], m, delta))
            print(f"   CV lam={lam:<5} delta={delta:<5} -> {np.mean(errs):.2f}")


def load_model(name):
    d = json.load(open(CARDS / name))
    m = d["model"]
    return Model(np.array(m["beta"]), np.array(m["mean"]), np.array(m["sd"])), d["delta"]


# ---------- the van Gogh vs Monet check (our own archive images) ----------
def oklab_rgb(rgb):
    c = np.asarray(rgb, float) / 255
    l = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    lms = np.cbrt(l @ np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                               [0.0883024619, 0.2817188376, 0.6299787005]]).T)
    return lms @ np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                           [0.0259040371, 0.7827717662, -0.8086757660]]).T


def structure(rgbs, rels, fam=None, min_fam=0.05):
    """complementary: two vivid colors (>= 0.35 of the screen's max) at least 140 degrees apart in OKLab hue,
    each a real presence on the canvas (its color family, within dE76 15, covers >= min_fam of the canvas: fixed
    at 5% BEFORE the rerun, 2026-10-11, so the rule couldn't be tuned toward the expected answer);
    analogous: no such pair, and the vivid colors (>= 0.2) that are a real presence fit in a 110-degree arc;
    else mixed. fam=None is the first, area-blind version."""
    ok = oklab_rgb(rgbs)
    H = np.degrees(np.arctan2(ok[:, 2], ok[:, 1])) % 360
    present = np.ones(len(rels), bool) if fam is None else (np.asarray(fam) >= min_fam)
    viv = np.where((rels >= 0.35) & present)[0]
    for i in viv:
        for j in viv:
            if i < j:
                d = abs(H[i] - H[j]) % 360
                if min(d, 360 - d) >= 140:
                    return "complementary"
    chrom = np.sort(H[(rels >= 0.2) & present])
    if len(chrom) >= 2:
        gaps = np.diff(np.r_[chrom, chrom[0] + 360])
        if 360 - gaps.max() <= 110:
            return "analogous"
    return "mixed"


def _archive_job(args):
    gi, path, crop = args
    try:
        model, delta = load_model("_picker_full.json")
        p = Painting(load_px(path, crop))
        idx = pick(p, model, K, delta)
        # the palette's score: how curator-worthy its five colors are, by the learned model, at their own pick step
        logits = []
        for t, j in enumerate(idx):
            F, _ = p.features(p.cand[idx[:t]] if t else [], t)
            logits.append(float(model.score(F[j:j + 1])[0]))
        lab = p.lab
        return gi, {"score": float(np.mean(logits)), "chroma": float(np.hypot(lab[:, 1], lab[:, 2]).mean()),
                    "rel5": float(p.rel[idx].mean()), "structure": structure(p.cand_rgb[idx], p.rel[idx]),
                    "structure_area": structure(p.cand_rgb[idx], p.rel[idx], 10 ** p.static[idx, 1]),
                    "hex": ["#%02X%02X%02X" % tuple(int(v) for v in p.cand_rgb[j]) for j in idx]}
    except Exception as e:
        return gi, {"error": str(e)}


def gallery_rows():
    head = json.load(open(ROOT / "data/gallery/index.json"))
    buf = open(ROOT / "data/gallery/index.bin", "rb").read()
    rows, s = [], 0
    while (ROOT / f"data/gallery/d/{s:03d}.json").exists():
        rows += json.load(open(ROOT / f"data/gallery/d/{s:03d}.json")); s += 1
    years = []
    for i in range(head["n"]):
        y = buf[i * head["rec"]] | (buf[i * head["rec"] + 1] << 8)
        years.append(y - head["year0"] if y else None)
    return rows, years


def img_path(cid):
    src, num = cid.split("-", 1)
    for real in (src, src.rstrip("2")):
        p = RAW / real / "img" / f"{num}.jpg"
        if p.exists():
            return p
    return None


def cmd_artists():
    from multiprocessing import Pool
    rows, years = gallery_rows()
    out = {}
    for slug in ("vincent-van-gogh", "claude-monet"):
        ix = json.load(open(ROOT / f"data/artists/p/{slug}.json"))["ix"]
        jobs = [(i, str(img_path(rows[i][0])), rows[i][11] if len(rows[i]) > 11 else None) for i in ix if img_path(rows[i][0])]
        with Pool(8) as pool:
            res = dict(pool.map(_archive_job, jobs))
        out[slug] = {str(i): dict(res[i], title=rows[i][1], year=years[i]) for i in res if "error" not in res[i]}
        print(f"{slug}: {len(out[slug])} of {len(ix)} paintings scored")
    json.dump(out, open(CARDS / "_artists.json", "w"))

    vg = out["vincent-van-gogh"]
    def period(y):
        return None if y is None else "1881-85 Netherlands" if y <= 1885 else "1886-87 Paris" if y <= 1887 else "1888-90 Arles to Auvers" if y <= 1890 else None
    dated = [(period(v["year"]), v) for v in vg.values() if period(v["year"])]
    names = ["1881-85 Netherlands", "1886-87 Paris", "1888-90 Arles to Auvers"]
    base = {n: np.mean([p == n for p, _ in dated]) for n in names}
    print(f"\nVAN GOGH: {len(dated)} dated paintings. Share of the archive by period: " + ", ".join(f"{n} {base[n]:.0%}" for n in names))
    for key, label in (("score", "learned palette score"), ("rel5", "vividness of its 5 picks"), ("chroma", "plain mean chroma of the painting")):
        ranked = sorted(dated, key=lambda pv: -pv[1][key])
        top = ranked[:max(1, len(ranked) // 10)]
        share = {n: np.mean([p == n for p, _ in top]) for n in names}
        lift = share[names[2]] / base[names[2]] if base[names[2]] else float("nan")
        print(f"  top 10% by {label:<34}: " + ", ".join(f"{n.split()[0]} {share[n]:.0%}" for n in names) + f"   (colorful years x{lift:.1f} vs the archive's share)")
    # does the learned score add anything beyond plain chroma? rank correlation, and colorful-years share among
    # paintings the learned score ranks high but plain chroma does not
    from scipy.stats import spearmanr
    a = np.array([v["score"] for _, v in dated]); b = np.array([v["chroma"] for _, v in dated])
    print(f"  rank correlation, learned score vs plain chroma: {spearmanr(a, b).correlation:.2f}")

    mo = out["claude-monet"]
    import re
    lil = [v for v in mo.values() if re.search(r"water.?lil|nymph|lily pond|bassin", v["title"], re.I)]
    arl = [v for _, v in dated if False] or [v for p, v in dated if p == names[2]]
    def mix(vs, key="structure"):
        from collections import Counter
        c = Counter(v[key] for v in vs); n = len(vs)
        return f"{n:>3} paintings: " + ", ".join(f"{k} {c.get(k, 0) / n:.0%}" for k in ("analogous", "complementary", "mixed"))
    print("\nSTRUCTURE of each painting's 5-color palette (rules in structure()):")
    print("  Monet, water lilies       " + mix(lil))
    print("  Monet, all                " + mix(list(mo.values())))
    print("  van Gogh, 1888-90         " + mix(arl))
    print("  van Gogh, all             " + mix(list(vg.values())))
    print("\nSTRUCTURE, area-aware (both colors of a pair must be a real presence: family >= 5% of the canvas):")
    print("  Monet, water lilies       " + mix(lil, "structure_area"))
    print("  Monet, all                " + mix(list(mo.values()), "structure_area"))
    print("  van Gogh, 1888-90         " + mix(arl, "structure_area"))
    print("  van Gogh, all             " + mix(list(vg.values()), "structure_area"))


# ---------- the comparison image: five famous held-out paintings ----------
SHOW = {37: ("Café Terrace at Night", "Vincent van Gogh, 1888"), 41: ("Starry Night Over the Rhône", "Vincent van Gogh, 1888"),
        73: ("Bridge over a Pond of Water Lilies", "Claude Monet, 1899"), 97: ("Ophelia", "John Everett Millais, 1851–52"),
        85: ("Portrait of Félix Fénéon", "Paul Signac, 1890")}


def cmd_show():
    from PIL import ImageDraw, ImageFont
    import gallery as G, oo_collections as OC
    cards, ps = load_cards()
    ev = json.load(open(CARDS / "_picker_eval.json")); m = ev["model"]
    model, delta = Model(np.array(m["beta"]), np.array(m["mean"]), np.array(m["sd"])), ev["delta"]
    assert all(i % 2 == 1 for i in SHOW), "the showcase must be held-out cards"
    F = lambda sz, w="Regular": ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", sz, index={"Regular": 7, "Medium": 5, "Demi": 2}[w])
    W, BH, top = 1320, 430, 150
    img = Image.new("RGB", (W, top + BH * len(SHOW) + 60), (17, 17, 16)); d = ImageDraw.Draw(img)
    d.text((40, 36), "The learned picker vs the curator", font=F(44, "Demi"), fill=(240, 236, 228))
    d.text((40, 96), "Five famous paintings the picker never saw while learning. Lower numbers are closer to the curator (CIEDE2000).",
           font=F(22), fill=(170, 166, 158))
    tohex = lambda rgb: "#%02X%02X%02X" % tuple(int(v) for v in rgb)
    rows_out = {}
    for b, cid in enumerate(SHOW):
        y0 = top + b * BH
        c, pnt = cards[cid], ps[cid]
        ref = L.labs(c["swatches"])
        idx10 = pick(pnt, model, 10, delta); idx5 = idx10[:5]
        ours = pnt.cand[idx5]
        D = L.de2000(ref, ours); r_, c_ = linear_sum_assignment(D)
        aligned = [tohex(pnt.cand_rgb[idx5[c_[list(r_).index(i)]]]) for i in range(5)]
        s_ours = D[r_, c_].mean()
        pool = G.extract_pool(str(CARDS / f"c{cid:03d}.png"), k=24)
        div = [h for (h, _), _ in OC.pool_diverse([(tuple(L.hex_to_rgb(h)), sh) for h, sh in pool], 5, np.zeros((1, 3)))]
        Dd = L.de2000(ref, L.labs(div)); rd, cd = linear_sum_assignment(Dd)
        div_al = [div[cd[list(rd).index(i)]] for i in range(5)]
        s_div = Dd[rd, cd].mean()
        ten = [tohex(pnt.cand_rgb[j]) for j in idx10]
        rows_out[cid] = {"curator": c["swatches"], "picker": aligned, "diverse": div_al, "picker10": ten, "s_picker": s_ours, "s_div": s_div}
        # painting
        im = Image.open(CARDS / f"c{cid:03d}.png").convert("RGB"); im.thumbnail((470, 360), Image.LANCZOS)
        img.paste(im, (40 + (470 - im.width) // 2, y0 + 20 + (360 - im.height) // 2))
        x0 = 550
        d.text((x0, y0 + 14), SHOW[cid][0], font=F(30, "Demi"), fill=(240, 236, 228))
        d.text((x0, y0 + 52), SHOW[cid][1], font=F(20), fill=(170, 166, 158))
        def row(y, label, hexes, score=None, n=5, gap_after=None):
            d.text((x0, y), label, font=F(19, "Medium"), fill=(200, 196, 188))
            if score is not None:
                d.text((W - 40, y), f"{score:.1f}", font=F(19, "Demi"), fill=(240, 236, 228), anchor="ra")
            sw = (W - 40 - x0 - (n - 1) * 6 - (14 if gap_after else 0)) / n
            x = x0
            for k, h in enumerate(hexes):
                d.rounded_rectangle([x, y + 28, x + sw, y + 28 + 52], radius=8, fill=h)
                x += sw + 6 + (14 if gap_after and k == gap_after - 1 else 0)
        row(y0 + 90, "Curator", c["swatches"])
        row(y0 + 178, "Learned picker", aligned, s_ours)
        row(y0 + 266, "Before: our current Diverse mode", div_al, s_div)
        row(y0 + 354, "Learned picker, expanded to 10 (the same five first)", ten[:5] + ten[5:], None, n=10, gap_after=5)
    img.save(CARDS / "_compare.png")
    json.dump(rows_out, open(CARDS / "_compare.json", "w"), indent=1)
    for cid, r in rows_out.items():
        print(f"#{cid} {SHOW[cid][0]}: picker {r['s_picker']:.1f}, before {r['s_div']:.1f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "eval"
    {"eval": cmd_eval, "cv": cmd_cv, "artists": cmd_artists, "show": cmd_show}[cmd]()
