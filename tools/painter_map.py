#!/usr/bin/env python3
"""Build the data the painter map (js/paintermap.js) needs. One cell per painter in data/artists/meta.json.

Writes
  data/artists/map.json         per painter: face painting, portrait painting, paintings that carry the color
                                (signature color / Color DNA are read from them on the phone), place, movement,
                                the "Paints like" position, teacher/student links.
  data/artists/map-faces.webp   one sheet of 48 px tiles: each painter's face painting, cut from the painting
                                map's own tier-1 sheets (data/paintmap/g*.webp), no network.
  data/artists/map-portraits.webp   the same for painters with a portrait that is one of our own gallery pictures.

Run after tools/rebuild_all.sh (the gallery order moves when paintings are added):  python3 tools/painter_map.py
"""
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
D = lambda *p: os.path.join(ROOT, *p)
TILE, COLS = 48, 64

meta = json.load(open(D("data/artists/meta.json")))["a"]
port = json.load(open(D("data/artists/portraits.json")))["a"]
fac = json.load(open(D("data/facets/facets.json")))
man = json.load(open(D("data/paintmap/manifest.json")))
hid = set(json.load(open(D("data/gallery/hidden.json")))["idx"])
N, R = int(fac["n"]), int(fac["rec"])
b = np.fromfile(D("data/facets/facets.bin"), dtype=np.uint8)[: N * R].reshape(N, R)
art_of = b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8)
mv_of = b[:, 3]
slug_of_art = [a[1] for a in fac["artists"]]
mvnames = fac["movements"]

# ---- the tier-1 sheets: cache the open images ----
G = man["tier1"]["groupSize"]
sheets = {}
def tile(gi):
    g = gi // G
    if g not in sheets:
        if len(sheets) > 24: sheets.clear()
        sheets[g] = Image.open(D("data/paintmap", f"g{g}.webp")).convert("RGB")
    lo, hi = g * G, min(man["n"], g * G + G)
    cols = max(1, math.ceil(math.sqrt(hi - lo))); loc = gi - lo
    x, y = (loc % cols) * 80, (loc // cols) * 80
    t = sheets[g].crop((x, y, x + 80, y + 80))
    a = np.asarray(t)
    if a.std() < 3: return None   # an empty tile (a picture that failed to fetch)
    return t.resize((TILE, TILE), Image.LANCZOS)

# ---- names -> colors, for the "Paints like" histogram ----
def lab(h):
    r, g, bb = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda v: ((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92
    r, g, bb = f(r), f(g), f(bb)
    X, Y, Z = (r * .4124 + g * .3576 + bb * .1805) / .95047, r * .2126 + g * .7152 + bb * .0722, (r * .0193 + g * .1192 + bb * .9505) / 1.08883
    t = lambda v: v ** (1 / 3) if v > .008856 else 7.787 * v + 16 / 116
    fx, fy, fz = t(X), t(Y), t(Z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
name_hex = {}
for f in ("data/core-names.json", "data/library.json"):
    for e in json.load(open(D(f))): name_hex.setdefault(e["n"], e["h"])

def feat(slug):
    """39-dim color-use histogram: 12 hue bands x 3 lightness + 3 neutral lightness bins, from the painter's barcode."""
    p = D("data/analysis/artists", slug + ".json")
    v = np.zeros(39)
    if not os.path.exists(p): return v
    for _, _, names in json.load(open(p)).get("barcode", []):
        for nm in names or []:
            h = name_hex.get(nm)
            if not h: continue
            L, a, bb = lab(h); C = math.hypot(a, bb); li = 0 if L < 38 else 1 if L < 68 else 2
            if C < 9: v[36 + li] += 1
            else:
                H = (math.degrees(math.atan2(bb, a)) + 360) % 360
                v[int(H // 30) * 3 + li] += 1
    return v

slugs = sorted(meta, key=lambda s: (-meta[s]["k"], s))
idx = {s: i for i, s in enumerate(slugs)}
# gallery indices per painter, from the facets (the same record the painting map filters on)
by = {}
for gi in np.nonzero(art_of)[0]:
    s = slug_of_art[art_of[gi]] if art_of[gi] < len(slug_of_art) else None
    if s in idx and gi not in hid: by.setdefault(s, []).append(int(gi))

rows, F = [], []
faces = Image.new("RGB", (COLS * TILE, math.ceil(len(slugs) / COLS) * TILE), (28, 26, 23))
ports = []   # (slug index, tile)
miss = 0
for i, s in enumerate(slugs):
    m, pr = meta[s], port.get(s, {})
    pj = {}
    try: pj = json.load(open(D("data/artists/p", s + ".json")))
    except Exception: pass
    cands = [g for g in (pr.get("famous") or []) if g is not None and g >= 0 and g not in hid]
    famous = len(cands)
    for g in [pj.get("typical")] + (pj.get("ctyp") or []) + (pj.get("ix") or [])[:6]:
        if g is not None and g >= 0 and g not in hid and g not in cands: cands.append(g)
    face = None
    for g in cands[:8]:
        t = tile(g)
        if t is not None: face = g; faces.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE)); break
    if face is None: miss += 1
    pt = pr.get("portrait") or {}
    pg = -1
    if pt.get("src") in ("self", "other") and pt.get("gi") is not None and pt["gi"] not in hid:
        t = tile(pt["gi"])
        if t is not None: pg = pt["gi"]; ports.append((i, t))
    # the paintings that carry the painter's known color: famous ones first, then the typical one (as the painter page's strip)
    ids = [g for g in cands if g != face][:9]
    if face is not None: ids = [face] + ids
    mine = by.get(s, [])
    co = m.get("co") or ""
    ms = {}
    for g in mine:
        k = int(mv_of[g])
        if k: ms[k] = ms.get(k, 0) + 1
    mv = ""
    if ms:
        k, c = max(ms.items(), key=lambda kv: kv[1])
        if c >= max(3, .3 * len(mine)): mv = mvnames[k - 1] if k - 1 < len(mvnames) else ""
    if not mv and m.get("mv"): mv = m["mv"][0]
    rows.append({"s": s, "n": m["n"], "k": m["k"], "f": face if face is not None else -1, "p": pg, "ids": ids, "fm": famous,
                 "y0": m["y0"], "y1": m["y1"], "b": m.get("b"), "d": m.get("d"), "co": co, "mv": mv, "tr": 1 if pr.get("portrait", {}).get("src") == "wikidata" else 0})
    F.append(feat(s))
print("faces missing:", miss, "of", len(slugs))
faces.save(D("data/artists/map-faces.webp"), quality=80, method=6)
pc = max(1, math.ceil(math.sqrt(len(ports))))
ps = Image.new("RGB", (pc * TILE, math.ceil(len(ports) / pc) * TILE), (28, 26, 23))
for k, (i, t) in enumerate(ports):
    ps.paste(t, ((k % pc) * TILE, (k // pc) * TILE)); rows[i]["pt"] = k
ps.save(D("data/artists/map-portraits.webp"), quality=80, method=6)

# ---- "Paints like": hellinger features -> PCA(2) -> an even grid by recursive median split ----
X = np.sqrt(np.array(F)); X = X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-9)
X = X - X.mean(0)
U, S, Vt = np.linalg.svd(X, full_matrices=False)
P2 = X @ Vt[:2].T
n = len(P2)
W = int(math.ceil(math.sqrt(n * 1.15)))
def split(ids, x0, y0, w, h, out):
    if len(ids) == 0 or w <= 0 or h <= 0: return
    if len(ids) == 1 or (w == 1 and h == 1): out[ids[0]] = (x0, y0); return
    if w >= h:
        ids = sorted(ids, key=lambda i: P2[i, 0]); w1 = max(1, min(w - 1, round(w * .5))); k = round(len(ids) * w1 / w)
        split(ids[:k], x0, y0, w1, h, out); split(ids[k:], x0 + w1, y0, w - w1, h, out)
    else:
        ids = sorted(ids, key=lambda i: P2[i, 1]); h1 = max(1, min(h - 1, round(h * .5))); k = round(len(ids) * h1 / h)
        split(ids[:k], x0, y0, w, h1, out); split(ids[k:], x0, y0 + h1, w, h - h1, out)
Hh = int(math.ceil(n / W)); out = {}
split(list(range(n)), 0, 0, W, Hh, out)
for i, r in enumerate(rows):
    r["lx"], r["ly"] = out[i]
    r["nc"] = int(F[i].sum())

# ---- teacher / student links (Wikidata P1066 student of, P802 student; resolved to a painter with a page) ----
edges = set()
for s, m in meta.items():
    for key in ("tt", "in"):
        for t in m.get(key) or []:
            o = t.get("s")
            if o and o in idx and o != s: edges.add((idx[s], idx[o], 0 if key == "tt" else 1))
json.dump({"v": 1, "built": "2026-11-07", "W": W, "H": Hh, "tile": TILE, "cols": COLS, "pc": pc, "a": rows, "e": sorted(edges)},
          open(D("data/artists/map.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("painters", len(rows), "portraits", len(ports), "links", len(edges), "teacher links", sum(1 for e in edges if e[2] == 0))
cm = sum(1 for r in rows if r["mv"]); print("with movement", cm, "feat zero", sum(1 for r in rows if r["nc"] == 0))
