#!/usr/bin/env python3
"""Archive reach: for each of the ~1,000 core names, the closest color any painting in the archive actually
reaches (the color-archive panel's "history band", 2026-10-08).

Reads the 24-color pools (data/gallery/d/<shard>.json field 10: base64, 4 bytes a color r,g,b,share*250) of all
23,531 paintings and the painting years (data/gallery/index.bin; see js/gallery.js glBuild). For every core name:
  d   closest pool color, CIEDE2000 (1 decimal)
  i   index of the painting holding it (data/gallery order, same as js/gallery.js)
  h   that pool color, as hex (screen approximation)
  n   how many paintings have a pool color within ΔE 6 ("come close")
  y   earliest dated painting among those (or null)
Output: data/analysis/reach.json  { "<core name>": [d, i, "#hex", n, y|null] }

Photographs of aged, varnished paintings, each cut to 24 pool colors (small vivid areas average toward their
neighbors): "no painting reaches this" is a statement about this archive, never about paint.

Run: python3 tools/archive_reach.py
"""
import json, base64, os, sys
import numpy as np
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, "tools")
import library as L

core = json.load(open("data/core-names.json", encoding="utf-8"))
head = json.load(open("data/gallery/index.json", encoding="utf-8"))
buf = open("data/gallery/index.bin", "rb").read()
N, R, Y0 = head["n"], head["rec"], head["year0"]
years = np.zeros(N, dtype=np.int32)
for i in range(N):
    o = i * R
    y = buf[o] | (buf[o + 1] << 8)
    years[i] = (y - Y0) if y else -99999

rgbs, owner = [], []
shard = 0
while os.path.exists(f"data/gallery/d/{shard:03d}.json"):
    rows = json.load(open(f"data/gallery/d/{shard:03d}.json", encoding="utf-8"))
    for j, r in enumerate(rows):
        pl = r[10] if len(r) > 10 else ""
        if not pl:
            continue
        b = base64.b64decode(pl)
        for k in range(0, len(b) - 3, 4):
            rgbs.append((b[k], b[k + 1], b[k + 2]))
            owner.append(shard * head["shard"] + j)
    shard += 1
rgbs = np.array(rgbs, dtype=np.uint8)
owner = np.array(owner, dtype=np.int32)
# dedupe identical colors per painting would shrink little; keep all (564k) but quantize lookup via a KD-tree in Lab
hexes = ["#%02X%02X%02X" % tuple(c) for c in rgbs[:1]]  # placeholder to keep types obvious
pool_lab = np.array(L.labs(["#%02X%02X%02X" % tuple(c) for c in rgbs]))
print(f"{len(rgbs)} pool colors over {len(set(owner.tolist()))} paintings", file=sys.stderr)

tree = cKDTree(pool_lab)
core_lab = np.array(L.labs([e["h"] for e in core]))
out = {}
K = 60
dist76, idx = tree.query(core_lab, k=K)
for ci, e in enumerate(core):
    cand = idx[ci]
    d00 = np.array(L.de2000(core_lab[ci][None, :], pool_lab[cand])).reshape(-1)
    b = int(np.argmin(d00))
    best_i = int(cand[b])
    # painting count within ΔE00 6: ball query in Lab (ΔE76 >= ~ΔE00 for chromatic colors, use a generous radius)
    ball = tree.query_ball_point(core_lab[ci], r=35)
    if ball:
        ball = np.array(ball)
        dd = np.array(L.de2000(core_lab[ci][None, :], pool_lab[ball])).reshape(-1)
        close = ball[dd <= 6]
    else:
        close = np.array([], dtype=int)
    paints = set(owner[close].tolist())
    ys = [int(years[p]) for p in paints if years[p] > -99999]
    out[e["n"]] = [round(float(d00[b]), 1), int(owner[best_i]), "#%02X%02X%02X" % tuple(rgbs[best_i]), len(paints), (min(ys) if ys else None)]

json.dump(out, open("data/analysis/reach.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
none = sum(1 for v in out.values() if v[0] > 10)
print(f"reach.json: {len(out)} names, {none} with no pool color within ΔE 10, {os.path.getsize('data/analysis/reach.json')} bytes")
