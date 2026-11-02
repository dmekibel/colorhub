#!/usr/bin/env python3
"""Build the painting map's MICRO layer: data/paintmap/micro-<k>.webp + micro.json.

David (2026-10-25): "Even a super pixelated, blurry, tiny version of the painting is better than a flat color."
Tier 0 (atlas0-*.webp, 12 px a painting) is ~13 MB, too much to wait for on a phone. The micro layer is every
painting as a TILE x TILE (default 5x5) box-filtered thumbnail, packed in gallery order exactly like tier 0
(sheet = i // perSheet, cell = i % perSheet, x/y from cols), so js/paintmap.js places it by the same arithmetic. Two sheets
of ~2 MB in all; the map starts fetching them in <head> and draws them (smoothly upscaled) under everything else.

Cheapest source: it downsamples the tier-0 sheets already in the repo (no image is downloaded). Cells the atlas left
blank (manifest.missing) stay blank here too (the map draws the flat color for those).

micro.json carries n, the tile/cols/perSheet layout, the sheet names, `hash` (sha1 of data/gallery/ids.txt, first 8 hex, same as
look.bin / island-names.json) and `t0` (sha1 of the atlas manifest's groupHash). node tools/check_ids.js warns when either is stale.

  python3 tools/paintmap_micro.py [--tile 5] [--quality 45]
"""
import argparse, hashlib, json, os, sys
from io import BytesIO
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "data", "paintmap")
MAX_SHEET = 2040   # same WebKit-safe ceiling the atlas uses


def sha8(b):
    return hashlib.sha1(b).hexdigest()[:8]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tile", type=int, default=5)
    ap.add_argument("--quality", type=int, default=45)
    a = ap.parse_args()
    man = json.load(open(os.path.join(OUT, "manifest.json")))
    t0 = man["tier0"]; n = man["n"]; T0 = t0["tile"]; T = a.tile
    ids_l = [x for x in open(os.path.join(ROOT, "data", "gallery", "ids.txt"), "rb").read().split(b"\n") if x]
    cols = MAX_SHEET // T
    per = cols * cols
    nsheets = (n + per - 1) // per
    sheets = []
    for k in range(nsheets):
        lo, hi = k * per, min(n, (k + 1) * per)
        rows = (hi - lo + cols - 1) // cols
        sh = Image.new("RGB", (cols * T, rows * T), (14, 13, 11))
        sheets.append((sh, lo, hi))
    src_cache = {}
    def src(si):
        if si not in src_cache:
            src_cache.clear()
            src_cache[si] = Image.open(os.path.join(OUT, t0["sheets"][si])).convert("RGB")
        return src_cache[si]
    # walk by tier-0 sheet so each is decoded once
    for si in range(len(t0["sheets"])):
        im = src(si)
        lo0, hi0 = si * t0["perSheet"], min(n, (si + 1) * t0["perSheet"])
        for i in range(lo0, hi0):
            l = i % t0["perSheet"]
            x, y = (l % t0["cols"]) * T0, (l // t0["cols"]) * T0
            tile = im.crop((x, y, x + T0, y + T0)).resize((T, T), Image.BOX)
            k = i // per; c = i % per
            sheets[k][0].paste(tile, ((c % cols) * T, (c // cols) * T))
    names, total = [], 0
    for k, (sh, lo, hi) in enumerate(sheets):
        name = "micro-%d.webp" % k
        sh.save(os.path.join(OUT, name + ".tmp"), "WEBP", quality=a.quality, method=6)
        os.replace(os.path.join(OUT, name + ".tmp"), os.path.join(OUT, name))
        sz = os.path.getsize(os.path.join(OUT, name)); total += sz; names.append(name)
        print("%s %dx%d %d bytes" % (name, sh.width, sh.height, sz))
    meta = {"v": 1, "n": n, "tile": T, "cols": cols, "perSheet": per, "sheets": names,
            "missing": man.get("missing") or [], "hash": sha8(b"\n".join(ids_l[:n]) + b"\n"), "t0": sha8(json.dumps(man["groupHash"], sort_keys=True).encode())}
    with open(os.path.join(OUT, "micro.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print("micro: %d paintings, %d x %d px, %d bytes total" % (n, T, T, total))


if __name__ == "__main__":
    main()
