#!/usr/bin/env python3
"""Build the painting map's CLUSTER PACKS: data/paintmap/c<k>.webp + cluster.bin + cluster.json.

David (2026-10-25): the painting map's cold open (a random cluster of the Color arrangement) needed ~100 separate tier-1 sheets
(g<N>.webp, ~0.6 MB each, 625 paintings in GALLERY order) to sharpen ~125 visible tiles: ~60 MB for a few pixels of each sheet, because
paintings that sit side by side on the color map are scattered all over the gallery order. A cluster pack holds paintings that are
NEIGHBORS ON THE COLOR MAP: the Color layout (js/paintmap.js pmLayColor, before its neighbor-swap pass) is cut into 48 x 48 cell blocks,
one pack a block, each painting a 40 x 40 tile (downsampled from the existing 80 px tier-1 sheets: no image is downloaded). A screen of the
map then touches ~2-4 packs (~2 MB) instead of ~100 sheets.

  cluster.json  {v, n, tile, cols, numPacks, file:"c{p}.webp", hash, t1}   hash = sha1 of the first n ids (the gallery order is append-only,
                so a longer ids.txt still matches: paintings past n simply use the g sheets), t1 = sha1 of the atlas manifest's groupHash
  cluster.bin   n bytes (pack id, 255 = none) then n x uint16 LE (slot in the pack: row * cols + col); the pack is a sheet of cols tiles
                across, as many rows as it needs

The layout is recomputed here from data/gallery/index.bin the same way js/paintmap.js computes it (hue order, greys in a band at the right,
each column light to dark). It does not have to match the app's float for float: a painting's pack is looked up by its id, the layout only
decides which paintings share a pack, and the app's neighbor-swap pass moves a painting a cell or two at most.

  python3 tools/paintmap_cluster.py [--block 48] [--tile 40] [--quality 60]
"""
import argparse, hashlib, json, math, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GAL = os.path.join(ROOT, "data", "gallery")
OUT = os.path.join(ROOT, "data", "paintmap")


def sha8(b):
    return hashlib.sha1(b).hexdigest()[:8]


def mean_lab(n, rec, buf):
    """per painting: area-weighted mean CIELAB (js/gallery.js glBuild)"""
    a = np.frombuffer(buf, dtype=np.uint8)[: n * rec].reshape(n, rec)
    v = np.arange(256, dtype=np.float64) / 255
    lin = np.where(v > .04045, ((v + .055) / 1.055) ** 2.4, v / 12.92)
    cols = a[:, 6:6 + 24].reshape(n, 6, 4)
    r, g, b = lin[cols[:, :, 0]], lin[cols[:, :, 1]], lin[cols[:, :, 2]]
    s = cols[:, :, 3].astype(np.float64) / 250
    f = lambda t: np.where(t > .008856, np.cbrt(t), 7.787 * t + 16 / 116)
    x = f((r * .4124 + g * .3576 + b * .1805) / .95047)
    y = f(r * .2126 + g * .7152 + b * .0722)
    z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883)
    L, A, B = 116 * y - 16, 500 * (x - y), 200 * (y - z)
    tot = np.maximum(s.sum(1), 1e-9)
    return (s * L).sum(1) / tot, (s * A).sum(1) / tot, (s * B).sum(1) / tot


def color_layout(L, A, B):
    """(col, row) per painting: pmLayColor without the neighbor swaps"""
    n = len(L)
    cols = max(1, round(math.sqrt(n / 1.55))); rows = -(-n // cols)
    grey = np.hypot(A, B) < 5
    H = (np.degrees(np.arctan2(B, A)) % 360 - 330 + 360) % 360
    chroma = np.nonzero(~grey)[0]; chroma = chroma[np.argsort(H[chroma], kind="stable")]
    greys = np.nonzero(grey)[0]; greys = greys[np.argsort(B[greys], kind="stable")]
    order = np.concatenate([chroma, greys])
    X = np.zeros(n, np.int32); Y = np.zeros(n, np.int32)
    k = 0
    for j in range(cols):
        if k >= n:
            break
        col = order[k:k + rows]; col = col[np.argsort(-L[col], kind="stable")]
        X[col] = j; Y[col] = np.arange(len(col)); k += len(col)
    return X, Y, cols, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--block", type=int, default=48)
    ap.add_argument("--tile", type=int, default=40)
    ap.add_argument("--quality", type=int, default=60)
    a = ap.parse_args()
    man = json.load(open(os.path.join(OUT, "manifest.json")))
    n = man["n"]; t1 = man["tier1"]; GS, T1 = t1["groupSize"], t1["tile"]
    head = json.load(open(os.path.join(GAL, "index.json")))
    buf = open(os.path.join(GAL, "index.bin"), "rb").read()
    ids = open(os.path.join(GAL, "ids.txt"), "rb").read().split(b"\n")
    ids = [x for x in ids if x]
    assert len(ids) >= n, "ids.txt shorter than the atlas"
    L, A, B = mean_lab(head["n"], head["rec"], buf)
    L, A, B = L[:n], A[:n], B[:n]
    X, Y, cols, rows = color_layout(L, A, B)
    blk, T = a.block, a.tile
    nbx = -(-cols // blk); nby = -(-rows // blk); npk = nbx * nby
    assert npk <= 255 and blk * blk <= 65535
    pack = ((X // blk) * nby + (Y // blk)).astype(np.uint8)
    slot = ((Y % blk) * blk + (X % blk)).astype(np.uint16)
    missing = set(man.get("missing") or [])
    pack[[i for i in missing if i < n]] = 255   # a painting the atlas never had a picture for has no tile in a pack either
    pack_rows = np.zeros(npk, np.int32)
    for p in range(npk):
        m = pack == p
        if m.any():
            pack_rows[p] = int(slot[m].max()) // blk + 1
    tiles = np.zeros((n, T, T, 3), np.uint8)   # ~1 GB of RAM at 206k x 40 px; nothing goes to disk
    for g in range(t1["numGroups"]):
        lo, hi = g * GS, min(n, g * GS + GS); gc = max(1, math.ceil(math.sqrt(hi - lo)))
        im = Image.open(os.path.join(OUT, t1["file"].replace("{g}", str(g)))).convert("RGB")
        for i in range(lo, hi):
            if i in missing:
                continue
            l = i - lo; x, y = (l % gc) * T1, (l // gc) * T1
            tiles[i] = np.asarray(im.crop((x, y, x + T1, y + T1)).resize((T, T), Image.BOX))
        if g % 40 == 0:
            print("  decoded sheet g%d" % g, flush=True)
    total = 0
    for p in range(npk):
        idx = np.nonzero(pack == p)[0]
        if not len(idx):
            continue
        sh = Image.new("RGB", (blk * T, int(pack_rows[p]) * T), (14, 13, 11))
        for i in idx:
            s = int(slot[i]); sh.paste(Image.fromarray(tiles[i]), ((s % blk) * T, (s // blk) * T))
        name = os.path.join(OUT, "c%d.webp" % p)
        sh.save(name + ".tmp", "WEBP", quality=a.quality, method=6); os.replace(name + ".tmp", name)
        total += os.path.getsize(name)
    with open(os.path.join(OUT, "cluster.bin"), "wb") as f:
        f.write(pack.tobytes()); f.write(slot.astype("<u2").tobytes())
    meta = {"v": 1, "n": n, "tile": T, "cols": blk, "numPacks": int(npk), "file": "c{p}.webp",
            "hash": sha8(b"\n".join(ids[:n]) + b"\n"), "t1": sha8(json.dumps(man["groupHash"], sort_keys=True).encode())}
    with open(os.path.join(OUT, "cluster.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print("cluster: %d paintings in %d packs (%dx%d cells each, %d px tiles), %d bytes in all (%d avg)" % (n, npk, blk, blk, T, total, total // max(1, npk)))


if __name__ == "__main__":
    main()
