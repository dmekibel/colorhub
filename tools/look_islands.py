#!/usr/bin/env python3
"""Painting-map "By look", ISLANDS layout (called by tools/look_layout.py; runs under the same clipenv venv).

The 2-D UMAP cloud (Y) is cut into natural clusters ("islands"); each island is laid out as its own compact, roundish blob of
evenly spaced cells, and the blobs are placed apart at their UMAP centroids (relative positions kept) with empty space between
them. Nothing is drawn in the gaps: plain background, like the rest of the map.

  1. Clusters: HDBSCAN (scikit-learn) on a 40k sample of the cloud ('leaf' selection = fine, natural clusters); every painting
     takes the cluster of its nearest sampled neighbors; slivers (< MIN_N) merge into the nearest island. A cluster far bigger
     than the rest is cut into SUB-ISLANDS with k-means (they share a `par` parent id and sit closer together than top-level
     islands, so a big region reads as an archipelago).
  2. Blob: an ellipse (the island's own aspect, clipped to 1..1.45, at its principal angle) with a deterministic wavy outline;
     the n cells nearest its middle by that outline. Exactly n cells for n paintings.
  3. Paintings -> cells inside the blob by the same recursive median split as the even grid, with the island's own cell set.
  4. Placement: circles of radius r (farthest cell) at UMAP centroids * s, relaxed apart until every pair is >= GAP cells clear.
     The browser multiplies the centers by a "spread" factor >= 1 (water gaps only grow, so islands never touch).
  5. Labels, from data only: the 1-2 tags most over-represented in the island against the whole archive (lift >= 1.6, share >=
     10%), then "<century> <country>" when one clearly dominates (> 50%). Nothing stands out -> "Mixed" (big islands) or none.

Files (all little-endian), `<sfx>` is "" or "-reduced":
  data/gallery/look-islands<sfx>.bin  "LISL", u32 version=1, u32 n, u32 islands, u32 ids-hash, then three planar byte arrays of n:
                                      island id, local x, local y (cell inside the island's w x h box, both < 256).
  data/gallery/look<sfx>.json         gains "islands": [{n, w, h, cx, cy, r, par, lab}] (cx, cy = island middle in cells at spread 1).
"""
import json, struct, time
import numpy as np

GAP = 6            # clear cells between any two islands at spread 1
MIN_N = 150        # smaller clusters merge into their nearest neighbor
BIG_N = 9000       # a cluster above this is cut into sub-islands of ~SUB_N
SUB_N = 4500
SUB_GAP = 3        # clear cells between sub-islands of one parent (they sit closer than top-level islands)
TAG_OK = 94        # tags 0..93 are the genres and things (before the named saints and myths): the only ones used for labels
EXTRA_TAGS = ("saint", "angel", "crucifixion", "dance", "flag")
PLURAL = {"portrait": "Portraits", "self-portrait": "Self-portraits", "group portrait": "Group portraits", "landscape": "Landscapes", "seascape": "Seascapes",
          "cityscape": "Cityscapes", "architecture": "Architecture", "still life": "Still lifes", "flowers": "Flowers", "religious": "Religious scenes",
          "mythological": "Myths", "history": "History scenes", "battle": "Battles", "genre scene": "Genre scenes", "interior": "Interiors", "nude": "Nudes",
          "animal": "Animals", "allegory": "Allegory", "vanitas": "Vanitas", "hunting": "Hunting", "abstract": "Abstract", "orientalist": "Orientalist",
          "fantasy": "Fantasy", "music & dance": "Music and dance", "woman": "Women", "man": "Men", "child": "Children", "fish": "Fish", "fruit": "Fruit",
          "sky": "Skies", "snow": "Snow", "night": "Night scenes", "sun": "Sun", "moon": "Moon", "sea": "Seas", "dance": "Dance", "flower": "Flowers",
          "sheep": "Sheep", "deer": "Deer", "crowd": "Crowds", "family": "Families", "couple": "Couples", "bread": "Bread", "cross": "Crosses"}


GROUP = {t: "water" for t in ("seascape", "sea", "harbor", "beach", "ship", "boat", "longboat", "lake", "river", "waterfall", "body of water")}
GROUP.update({t: "flowers" for t in ("flowers", "flower", "vase", "garden")})
GROUP.update({t: "land" for t in ("landscape", "landscape painting", "field", "tree", "forest", "mountain", "sky", "river", "lake")})
GROUP.update({t: "people" for t in ("portrait", "self-portrait", "group portrait")})
GROUP.update({t: "building" for t in ("architecture", "cityscape", "church", "castle", "house", "village", "city", "street", "ruins", "bridge")})
GROUP.update({t: "sacred" for t in ("religious", "saint", "angel", "cross", "crucifixion")})


def plural(n):
    if n in PLURAL: return PLURAL[n]
    if n[-1] == "y" and n[-2] not in "aeiou": return n[:-1].capitalize() + "ies"
    if n.endswith(("s", "x", "ch", "sh")): return n.capitalize() + "es"
    return n.capitalize() + "s"


def clusters(Y, seed=11):
    """HDBSCAN on a sample, then everything else by nearest sampled neighbors. Returns (labels, parent per label)."""
    from sklearn.cluster import HDBSCAN, KMeans
    from sklearn.neighbors import NearestNeighbors
    n = len(Y)
    rs = np.random.RandomState(seed)
    sub = np.sort(rs.choice(n, min(40000, n), replace=False))
    Z = (Y - Y.mean(0)) / Y.std(0).mean()
    lab = None
    for mcs in (500, 350, 250, 700, 1000):
        h = HDBSCAN(min_cluster_size=mcs, min_samples=20, cluster_selection_method="leaf").fit(Z[sub])
        k = h.labels_.max() + 1
        print(f"  HDBSCAN min_cluster_size {mcs}: {k} clusters, {int((h.labels_ < 0).sum())} noise of {len(sub)}", flush=True)
        if 24 <= k <= 90: lab = h.labels_; break
        if lab is None or abs(k - 50) < abs(lab.max() + 1 - 50): lab = h.labels_
    ok = lab >= 0
    nn = NearestNeighbors(n_neighbors=9).fit(Z[sub][ok])
    _, ix = nn.kneighbors(Z)
    nb = lab[ok][ix]
    k = lab.max() + 1
    cnt = np.zeros((n, k), np.int16)
    for j in range(nb.shape[1]): cnt[np.arange(n), nb[:, j]] += 1
    L = cnt.argmax(1).astype(np.int32)
    L = merge_small(L, Z)
    return split_big(L, Z)


def merge_small(L, Z):
    while True:
        ids, c = np.unique(L, return_counts=True)
        small = ids[c < MIN_N]
        if len(small) == 0 or len(ids) <= 2: return L
        cen = {i: Z[L == i].mean(0) for i in ids}
        s = small[np.argmin(c[np.isin(ids, small)])]
        others = [i for i in ids if i != s]
        t = min(others, key=lambda i: ((cen[i] - cen[s]) ** 2).sum())
        L[L == s] = t


def split_big(L, Z):
    from sklearn.cluster import KMeans
    L = L.copy(); par = {}
    nxt = L.max() + 1
    for i in np.unique(L):
        m = np.where(L == i)[0]
        if len(m) > BIG_N:
            kk = int(round(len(m) / SUB_N))
            km = KMeans(n_clusters=kk, n_init=4, random_state=5).fit(Z[m])
            for j in range(kk):
                sel = m[km.labels_ == j]
                if j == 0: L[sel] = i   # first piece keeps the id
                else: L[sel] = nxt; par[nxt] = i; nxt += 1
            par[i] = i
    # relabel 0..K-1 by painting count, biggest first, so ids are stable and meaningful
    ids, c = np.unique(L, return_counts=True)
    order = ids[np.argsort(-c, kind="stable")]
    remap = {int(o): j for j, o in enumerate(order)}
    out = np.array([remap[int(v)] for v in L], np.int32)
    parent = [remap[par[int(o)]] if int(o) in par else remap[int(o)] for o in order]
    # a parent that is its own only child is not a parent
    return out, parent


def blob_cells(n, ang, aspect, seed):
    """n cells (integer x, y) nearest the middle of a rotated, wavy ellipse; deterministic."""
    R = int(np.sqrt(n / np.pi) * aspect * 1.45) + 6
    g = np.arange(-R, R + 1)
    gx, gy = np.meshgrid(g, g)
    gx = gx.ravel().astype(np.float64); gy = gy.ravel().astype(np.float64)
    c, s = np.cos(ang), np.sin(ang)
    u = (gx * c + gy * s) / np.sqrt(aspect); v = (-gx * s + gy * c) * np.sqrt(aspect)
    th = np.arctan2(v, u)
    ph = [((np.sin(seed * 12.9898 + j * 78.233) * 43758.5453) % 1.0) * 6.2832 for j in range(3)]   # the browser draws the same outline for a filtered island
    wob = 1 + 0.09 * np.sin(2 * th + ph[0]) + 0.06 * np.sin(3 * th + ph[1]) + 0.035 * np.sin(5 * th + ph[2])
    d = np.hypot(u, v) / wob
    o = np.lexsort((gx, gy, np.round(d, 6)))[:n]
    cx, cy = gx[o].astype(np.int64), gy[o].astype(np.int64)
    return cx - cx.min(), cy - cy.min()


def assign(P, cx, cy):
    """Recursive median split: points P (m x 2) onto the m cells (cx, cy). Returns cell index per point."""
    m = len(P); out = np.zeros(m, np.int64)
    stack = [(np.arange(m), np.arange(m))]   # (point idx, cell idx)
    while stack:
        pi, ci = stack.pop()
        if len(pi) == 1: out[pi[0]] = ci[0]; continue
        wx = cx[ci].max() - cx[ci].min(); wy = cy[ci].max() - cy[ci].min()
        ax = 0 if wx >= wy else 1
        cc = (cx, cy)[ax][ci]; co = (cx, cy)[1 - ax][ci]
        oc = np.lexsort((ci, co, cc)); a = len(pi) // 2
        op = np.lexsort((pi, P[pi, ax]))
        stack.append((pi[op[:a]], ci[oc[:a]])); stack.append((pi[op[a:]], ci[oc[a:]]))
    return out


def place(cen, r, par):
    """Centers (cells) for the islands: UMAP centroids scaled, then relaxed until every pair is clear by GAP (SUB_GAP for siblings)."""
    K = len(r)
    sc = np.sqrt((r ** 2).sum() / max(1e-9, ((cen - cen.mean(0)) ** 2).sum())) * 0.8
    base = (cen - cen.mean(0)) * sc
    p = base.copy()
    for it in range(1500):
        moved = 0.0
        for i in range(K):
            d = p[i] - p
            dist = np.hypot(d[:, 0], d[:, 1]) + 1e-9
            gap = np.where(np.array(par) == par[i], SUB_GAP, GAP)
            need = r[i] + r + gap
            ov = need - dist; ov[i] = 0
            push = (np.where(ov > 0, ov, 0) / dist)[:, None] * d * 0.5
            p[i] += push.sum(0) * 0.5
            moved += np.abs(push).sum()
        p += (base - p) * 0.004   # a faint pull back to where UMAP put it
        if moved < 1e-3 and it > 50: break
    # final hard pass: separate whatever the spring left touching
    for _ in range(300):
        bad = False
        for i in range(K):
            for j in range(i + 1, K):
                d = p[j] - p[i]; dist = np.hypot(*d) + 1e-9
                gap = SUB_GAP if par[i] == par[j] else GAP
                need = r[i] + r[j] + gap
                if dist < need - 0.01:
                    sh = d / dist * (need - dist) / 2 + 1e-3; p[j] += sh; p[i] -= sh; bad = True
        if not bad: break
    return p


def labels_for(L, K, ids, root, tags_path, nj):
    """Island labels from data: tag lift against the whole archive, then century + country when one dominates."""
    sj = json.load(open(tags_path))
    tags = sj["tags"]
    ok = [t for t in range(len(tags)) if t < TAG_OK or tags[t] in EXTRA_TAGS]
    n = len(L)
    T = len(tags)
    # per painting tag set (authority + title + image model), as a sparse boolean accumulated per island
    cnt = np.zeros((K, T), np.int64); glob = np.zeros(T, np.int64)
    for i in range(n):
        s = set(sj["ia"][i]) | set(sj["it"][i]) | {r[0] for r in sj["im"][i]}
        for t in s:
            cnt[L[i], t] += 1; glob[t] += 1
    size = np.bincount(L, minlength=K)
    gshare = glob / n
    # years and countries
    idx = np.fromfile(root / "data/gallery/index.bin", dtype="<u2").reshape(n, 15)[:, 0].astype(np.int64)
    year = np.where(idx > 0, idx - 20000, -99999)
    ctry = []
    for f in sorted((root / "data/gallery/d").glob("*.json")):
        ctry.extend(r[3] or "" for r in json.load(open(f, encoding="utf-8")))
    ctry = np.array(ctry if len(ctry) == n else [""] * n)
    out = []
    for k in range(K):
        m = L == k; sz = int(size[k]); parts = []
        sc = []
        for t in ok:
            sh = cnt[k, t] / sz
            if sh >= 0.10 and glob[t] >= 300 and sh / max(gshare[t], 1e-9) >= 1.6:
                sc.append((sh * np.log(sh / gshare[t]), t))
        sc.sort(reverse=True)
        picked = []
        for _, t in sc:
            g = GROUP.get(tags[t], tags[t])
            if g in [GROUP.get(x, x) for x in picked]: continue   # not "Seas and seascapes", "Flowers and flowers"
            picked.append(tags[t])
            if len(picked) == 2: break
        topic = " and ".join(plural(p) for p in picked) if len(picked) < 2 else f"{plural(picked[0])} and {plural(picked[1]).lower()}"
        yk = year[m]; yk = yk[yk > -99999]
        era = ""
        if len(yk) > 0.5 * sz:
            cen = (yk // 100) * 100
            vals, c = np.unique(cen, return_counts=True)
            j = c.argmax()
            if c[j] > 0.5 * len(yk) and 1000 <= vals[j] <= 2000: era = f"{int(vals[j])}s"
        cs = ctry[m]; cs = cs[cs != ""]
        place = ""
        if len(cs) > 0.5 * sz:
            vals, c = np.unique(cs, return_counts=True)
            j = c.argmax()
            if c[j] > 0.5 * len(cs): place = str(vals[j])
        where = " ".join(x for x in (era, place) if x)
        lab = " · ".join(x for x in (topic, where) if x)
        if not topic and where: lab = "Mixed · " + where
        if not lab: lab = "Mixed" if sz >= 3000 else ""
        out.append(lab)
    return out


def build(Y, ids, hsh, out_dir, root, sfx, tags_path):
    n = len(Y)
    t0 = time.time()
    L, parent = clusters(Y)
    K = int(L.max()) + 1
    print(f"islands: {K} ({time.time() - t0:.0f}s); sizes {np.bincount(L).min()}..{np.bincount(L).max()}", flush=True)
    Z = (Y - Y.mean(0)) / Y.std(0).mean()
    cen = np.zeros((K, 2)); w = np.zeros(K, np.int64); h = np.zeros(K, np.int64)
    lid = np.zeros(n, np.uint8); lx = np.zeros(n, np.uint8); ly = np.zeros(n, np.uint8)
    rad = np.zeros(K); mid = np.zeros((K, 2)); aspects = np.zeros(K); angs = np.zeros(K)
    for k in range(K):
        m = np.where(L == k)[0]
        P = Z[m]; mu = P.mean(0); cen[k] = mu
        ev, vec = np.linalg.eigh(np.cov((P - mu).T) + 1e-9 * np.eye(2))
        aspect = float(np.clip(np.sqrt(ev[1] / ev[0]), 1.0, 1.45)); ang = float(np.arctan2(vec[1, 1], vec[0, 1]))
        aspects[k], angs[k] = aspect, ang
        cx, cy = blob_cells(len(m), ang, aspect, k)
        cell = assign(P, cx.astype(np.float64), cy.astype(np.float64))
        assert len(set(cell.tolist())) == len(m)
        assert cx.max() < 256 and cy.max() < 256, f"island {k} wider than 255 cells"
        lid[m] = k; lx[m] = cx[cell]; ly[m] = cy[cell]
        w[k] = cx.max() + 1; h[k] = cy.max() + 1
        mid[k] = (cx.mean(), cy.mean())
        rad[k] = np.sqrt(((cx - mid[k, 0]) ** 2 + (cy - mid[k, 1]) ** 2).max())
    # place by the *blob's* middle of mass; local box origin offset = box centre (w/2,h/2) vs mass centre, kept in the table
    pos = place(cen, rad + 0.5, parent)
    lab = labels_for(L, K, ids, root, tags_path, None)
    isl = []
    for k in range(K):
        isl.append({"n": int((L == k).sum()), "w": int(w[k]), "h": int(h[k]), "mx": round(float(mid[k, 0]), 1), "my": round(float(mid[k, 1]), 1),
                    "cx": round(float(pos[k, 0]), 1), "cy": round(float(pos[k, 1]), 1), "r": round(float(rad[k]) + 0.5, 1), "par": int(parent[k]), "as": round(aspects[k], 2), "an": round(angs[k], 3), "lab": lab[k]})
    buf = bytearray(b"LISL" + struct.pack("<IIII", 1, n, K, int(hsh, 16))) + lid.tobytes() + lx.tobytes() + ly.tobytes()
    (out_dir / f"look-islands{sfx}.bin").write_bytes(buf)
    print(f"wrote look-islands{sfx}.bin ({len(buf)} bytes), {sum(1 for x in lab if x)} labeled, {time.time() - t0:.0f}s total")
    return isl, L, lx, ly
