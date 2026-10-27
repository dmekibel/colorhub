#!/usr/bin/env python3
"""Hide the second, third... copy of the same painting, WITHOUT touching the gallery order (David, 2026-10-27: "I'm pretty sure there's
like 10 Last Supper images in our app"). Writes data/hide-dups.json; tools/hide_nonart.py turns it into data/gallery/hidden.json
(reason "dup"), the filter the app already reads. Nothing is deleted, an address like #/gallery/<n> still opens a hidden copy.

  python3 tools/hide_duplicates.py            # find pairs from the cached CLIP embeddings, write data/hide-dups.json
  python3 tools/hide_duplicates.py --report   # also print the biggest clusters and what was kept

How a duplicate is decided (measured 2026-10-27 on the 175,262 embedded paintings; 5,606 pairs sit above cosine 0.95):
  * cosine >= 0.99: the same picture (even when titles or painters disagree: that is a data error, one copy goes).
  * cosine 0.90 to 0.99: only when the painter matches AND ORB feature matching (OpenCV, RANSAC) finds 15+ agreeing local features,
    or (cosine >= 0.975) the titles are close. That check separates a painter's different works (0-6) from the same painting in other
    photos, restorations and crops (16-1,000+); CLIP alone cannot (Catlin's different portraits sit at the same 0.95-0.97 as the
    Last Supper photos).
  A first version that accepted any shared title word merged Catlin's different Indian portraits and Canaletto's different Grand
  Canal views (a painter's series looks alike), so a shared word is not enough.
  Pairs are joined into clusters (union-find). One row per cluster stays: the highest quality one (original pixels from Commons via
  tools/dup_quality.py, a bonus for Google Art Project / Yorck / museum uploads, museum-source rows count as a 4 MP professional scan);
  a title that says detail / restored / crop / photo / copy / after / fragment loses; a row already hidden for another reason loses;
  ties go to a Wikidata painting, then the lower gallery index (the older row).
  data/hide-overrides.json "show" still wins over this list (hide_nonart.py applies it last).

The pairs are cached in research/_raw/subjects/dup-pairs.json (keyed to the embeddings' id list, so a new batch recomputes, about 90 s).
Rows without a cached image have no embedding and are not checked (about 34,000, mostly cf / bsb / yuag / npg / wales / smb).
"""
import datetime, glob, json, math, os, re, sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
SUB = RAW / "subjects"
EMB, EMB_IDS, PAIRS = SUB / "clip-embeds.npy", SUB / "clip-embeds.ids.txt", SUB / "dup-pairs.json"
ORBC = SUB / "dup-orb.json"
FLOOR, ORB_MIN = 0.90, 15   # candidate pairs start at cosine 0.90; a pair counts as the same painting at 15+ RANSAC feature matches


def find_pairs(ids):
    if PAIRS.exists():
        c = json.load(open(PAIRS))
        if c.get("n") == len(ids) and c.get("last") == ids[-1] and c.get("floor") == FLOOR:
            return c["pairs"]
    E = np.load(EMB).astype(np.float32)
    E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-9
    pairs, B = [], 1000
    for s in range(0, len(ids), B):
        S = E[s:s + B] @ E.T
        for k in range(S.shape[0]):
            S[k, : s + k + 1] = 0            # upper triangle only: each pair once
        ii, jj = np.where(S >= FLOOR)
        pairs += [(int(s + a), int(b), round(float(S[a, b]), 4)) for a, b in zip(ii, jj)]
    json.dump({"n": len(ids), "last": ids[-1], "floor": FLOOR, "pairs": pairs}, open(PAIRS, "w"))
    return pairs


_orb = {}


def _img(i):
    s_, r_ = i.split("-", 1)
    for p in (RAW / s_ / "img" / f"{r_}.jpg", RAW / "measure-img" / f"{i}.jpg"):
        if p.exists():
            return p


def _feat(cv2, orb, i):
    p = _img(i)
    im = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE) if p else None
    if im is None:
        return None
    h, w = im.shape
    k = 400 / max(h, w)
    im = cv2.resize(im, (max(1, int(w * k)), max(1, int(h * k))))
    kp, d = orb.detectAndCompute(im, None)
    return (np.float32([q.pt for q in kp]), d) if d is not None and len(kp) >= 20 else None


def orb_inliers(pairs):
    """{ "a|b": RANSAC inlier count } for (id, id) pairs: how many local features of the two photos agree on one geometric fit.
    Measured 2026-10-27: different works by one painter (Catlin's portraits, Canaletto's views) score 0-6, the same Last Supper in
    other photos, restorations and crops scores 16-1,000+, so 15 is a clear line. Cached in research/_raw/subjects/dup-orb.json."""
    import cv2
    cache = json.load(open(ORBC)) if ORBC.exists() else {}
    orb, bf, feats = cv2.ORB_create(1500), cv2.BFMatcher(cv2.NORM_HAMMING), {}
    todo = [(a, b) for a, b in pairs if f"{a}|{b}" not in cache]
    for n_, (a, b) in enumerate(todo):
        if len(feats) > 3000:
            feats.clear()
        for i in (a, b):
            if i not in feats:
                feats[i] = _feat(cv2, orb, i)
        fa, fb, val = feats[a], feats[b], 0
        if fa and fb:
            m = [x for x, y in (q for q in bf.knnMatch(fa[1], fb[1], k=2) if len(q) == 2) if x.distance < 0.75 * y.distance]
            if len(m) >= 8:
                H, mask = cv2.findHomography(np.float32([fa[0][x.queryIdx] for x in m]), np.float32([fb[0][x.trainIdx] for x in m]), cv2.RANSAC, 5.0)
                val = int(mask.sum()) if mask is not None else 0
        cache[f"{a}|{b}"] = val
        if n_ % 2000 == 1999:
            json.dump(cache, open(ORBC, "w"))
    json.dump(cache, open(ORBC, "w"))
    return cache


def norm(s):
    return re.sub(r"\W+", " ", (s or "").lower()).strip()


def same_artist(a, b):
    a, b = norm(a), norm(b)
    return bool(a and b and (a == b or a.split()[-1] == b.split()[-1]))


BAD = re.compile(r"detail|restor|retouch|crop|photo|copy|after |fragment|santa maria|cenacolo vinciano|reproduction|facsimile", re.I)
STOP = {"the", "a", "an", "of", "de", "la", "le", "il", "der", "die", "das", "and", "by", "in", "on", "von", "van", "del", "della"}


def words(t):
    return {w for w in norm(t).split() if len(w) > 2 and w not in STOP}


def jac(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


def tier(i):
    src = i.split("-", 1)[0]
    if src in ("commons", "commonscc", "commons2"):
        return 2 if i.split("-", 1)[1].startswith("Q") else 1
    return 3


def main():
    ids_all = (ROOT / "data" / "gallery" / "ids.txt").read_text().split("\n")
    ids_all = [i for i in ids_all if i]
    pos = {i: k for k, i in enumerate(ids_all)}
    emb_ids = [i for i in EMB_IDS.read_text().split("\n") if i]
    meta = {}
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        for r in (d if isinstance(d, list) else next((v for v in d.values() if isinstance(v, list)), [])):
            if isinstance(r, dict) and r.get("id") in pos:
                meta[r["id"]] = r
    hidden_other = set()
    hp = ROOT / "data" / "hide-photos.json"
    if hp.exists():
        hidden_other |= set(json.load(open(hp)).get("ids", []))
    cand = []
    for a, b, c in find_pairs(emb_ids):
        ia, ib = emb_ids[a], emb_ids[b]
        if ia in meta and ib in meta:
            cand.append((ia, ib, c))
    check = [(ia, ib) for ia, ib, c in cand if c < 0.99 and same_artist(meta[ia].get("a"), meta[ib].get("a"))]
    orb = orb_inliers(check)
    edges = []
    for ia, ib, c in cand:
        sa = same_artist(meta[ia].get("a"), meta[ib].get("a"))
        if c >= 0.99:
            edges.append((ia, ib))
        elif sa and (orb.get(f"{ia}|{ib}", 0) >= ORB_MIN or (c >= 0.975 and jac(words(meta[ia].get("t")), words(meta[ib].get("t"))) >= 0.6)):
            edges.append((ia, ib))
    parent = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b in edges:
        parent[find(a)] = find(b)
    groups = defaultdict(list)
    for x in list(parent):
        groups[find(x)].append(x)
    clusters = [g for g in groups.values() if len(g) > 1]

    qual = json.load(open(SUB / "dup-quality.json")) if (SUB / "dup-quality.json").exists() else {}

    def quality(i):
        """log2 of the original pixel count (+2 for a Google Art Project / Yorck / museum-credited upload, -4 for a title that says
        detail / restored / crop / photo ...). Museum-source rows count as a professional scan of about 4 megapixels (22)."""
        if tier(i) == 3:
            q = 22.0
        elif i in qual and qual[i].get("w"):
            q = math.log2(max(1, qual[i]["w"] * qual[i]["h"])) + 2 * qual[i].get("pro", 0)
        else:
            q = 18.0                                        # size unknown (dup_quality.py not run for it): below a 1 MP photo
        return q - (4 if BAD.search(meta[i].get("t") or "") else 0)

    def score(i):
        return (i not in hidden_other, round(quality(i) * 2) / 2, tier(i), bool(meta[i].get("y")), -pos[i])
    hide, keep = [], {}
    for g in clusters:
        g.sort(key=score, reverse=True)
        for x in g[1:]:
            hide.append(x)
            keep[x] = g[0]
    out = {"v": 1, "built": datetime.date.today().isoformat(), "clusters": len(clusters), "ids": sorted(hide), "keep": keep}
    (ROOT / "data" / "hide-dups.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"hide-dups.json: {len(clusters)} clusters, {len(hide)} copies hidden, {len(edges)} pairs used")
    if "--report" in sys.argv:
        for g in sorted(clusters, key=len, reverse=True)[:12]:
            print(len(g), "kept", g[0], "|", (meta[g[0]].get("a") or "")[:24], "|", (meta[g[0]].get("t") or "")[:50])


if __name__ == "__main__":
    main()
