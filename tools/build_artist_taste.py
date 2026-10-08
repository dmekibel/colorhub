#!/usr/bin/env python3
"""Per-painter palettes for the taste profile's "the painter whose palette matches your loves".
Reads data/gallery (index.bin: six colors + area shares per painting; d/*.json: artist names, images) and
data/analysis/artists/*.json (which painters have enough paintings, and each one's typical painting), and writes
data/analysis/artist-taste.json: for each painter, up to 8 palette colors (weighted k-means in CIELAB over ALL their
paintings' colors, by area), mean L and C, and their most typical painting (gallery index, title, image).
Colors are as photographed, so they are screen approximations of varnished paintings.
Run: python3 tools/build_artist_taste.py"""
import json, glob, os
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
G = os.path.join(ROOT, "data/gallery")
head = json.load(open(f"{G}/index.json"))
N, R = head["n"], head["rec"]
buf = np.fromfile(f"{G}/index.bin", dtype=np.uint8).reshape(N, R)
rows = []
for f in sorted(glob.glob(f"{G}/d/*.json")):
    rows += json.load(open(f))
assert len(rows) == N, (len(rows), N)
by_name, by_id = {}, {}
for i, r in enumerate(rows):
    by_name.setdefault(r[2], []).append(i)
    by_id[r[0]] = i


def lab(rgb):
    c = rgb / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = c @ M.T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def hexof(rgb):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in rgb)


def kmeans(P, w, k, it=25):
    idx = np.argsort(-w)[:k] if len(P) >= k else np.arange(len(P))
    C = P[idx].copy()
    for _ in range(it):
        d = ((P[:, None, :] - C[None]) ** 2).sum(2)
        a = d.argmin(1)
        for j in range(len(C)):
            m = a == j
            if m.any():
                C[j] = (P[m] * w[m, None]).sum(0) / w[m].sum()
    return C


out = []
for f in sorted(glob.glob(f"{ROOT}/data/analysis/artists/*.json")):
    a = json.load(open(f))
    name = a["name"]
    ids = by_name.get(name, [])
    if len(ids) < 6:
        continue
    rgbs, ws = [], []
    for i in ids:
        for j in range(6):
            p = 6 + j * 4
            rgbs.append(buf[i, p:p + 3])
            ws.append(buf[i, p + 3] / 250.0)
    rgbs = np.array(rgbs, dtype=float)
    ws = np.array(ws) + 1e-6
    L = lab(rgbs)
    C = kmeans(L, ws, 8)
    d = ((L[:, None, :] - C[None]) ** 2).sum(2)
    asg = d.argmin(1)
    cols = []
    tot = ws.sum()
    for j in range(len(C)):
        m = asg == j
        if m.any():
            cols.append([hexof((rgbs[m] * ws[m, None]).sum(0) / ws[m].sum()), round(float(ws[m].sum() / tot), 3)])
    cols.sort(key=lambda c: -c[1])
    t = by_id.get(a.get("typical"))
    typ = None
    if t is not None:
        typ = {"gi": t, "t": rows[t][1], "img": rows[t][5], "id": rows[t][0]}
    out.append({"n": name, "s": a["slug"], "k": len(ids), "L": a["Lmean"], "C": a["Cmean"], "w": a["warmFrac"], "cols": cols, "typ": typ})

dest = f"{ROOT}/data/analysis/artist-taste.json"
json.dump(out, open(dest, "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "painters,", os.path.getsize(dest) // 1024, "KB")
