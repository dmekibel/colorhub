#!/usr/bin/env python3
"""Render design/mockups/shots/strip-order-compare.png: real Chromatlas paintings' 10-color strips, current order (by area)
vs palOrderGradient (js/palorder.js, run through node). Paintings only. usage: python3 tools/palorder_compare.py"""
import json, base64, subprocess, glob, os, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ok(h):
    n = int(h[1:], 16); c = [((n >> s & 255) / 255) for s in (16, 8, 0)]
    r, g, b = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]
    l, m, s = np.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), np.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), np.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
    return np.array([.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s])


def pool(b64):
    b = base64.b64decode(b64)
    return sorted([("#%02X%02X%02X" % tuple(b[i:i + 3]), b[i + 3] / 250) for i in range(0, len(b) - 3, 4)], key=lambda x: -x[1])


def pick(pl, k):          # js/gallery.js glPoolPick
    o = [ok(h) for h, _ in pl]; left = list(range(len(pl))); got = []
    while len(got) < k and left:
        def sc(i):
            near = min([np.linalg.norm(o[i] - o[j]) for j in got], default=1)
            return pl[i][1] ** .6 * (.5 + 3 * math.hypot(o[i][1], o[i][2])) * min(1, near / .14) ** 1.5
        b = max(left, key=sc); got.append(b); left.remove(b)
    return [pl[i] for i in got]


def main():
    rows = []
    for f in sorted(glob.glob(f"{ROOT}/data/gallery/d/*.json"))[::40]:
        for r in json.load(open(f)):
            if len(r) > 10 and isinstance(r[10], str) and len(r[10]) > 150:
                pl = pool(r[10]); ch = np.mean([math.hypot(*ok(h)[1:]) for h, _ in pl])
                rows.append((ch, r[0], r[1], r[2], pl)); break
    rows = sorted(rows, key=lambda x: -x[0])
    sel = [rows[i] for i in np.linspace(0, len(rows) - 1, 8).astype(int)]
    cur = [[h for h, _ in pick(r[4], 10)] for r in sel]            # strip order today: by area
    new = json.loads(subprocess.check_output(["node", "-e", "const {palOrderGradient:g}=require('./js/palorder.js');console.log(JSON.stringify(JSON.parse(process.argv[1]).map(g)))", json.dumps(cur)], cwd=ROOT))
    W, bw, bh, pad = 1040, 100, 54, 14
    im = Image.new("RGB", (W, 8 * (2 * bh + 40) + pad), "#111"); d = ImageDraw.Draw(im); y = pad
    for r, a, b in zip(sel, cur, new):
        d.text((pad, y), f"{r[2][:40]} - {r[3][:30]}", fill="#ccc"); y += 16
        for row, lab in ((a, "now"), (b, "new")):
            for i, h in enumerate(row): d.rectangle([pad + 40 + i * (bw - 5), y, pad + 40 + (i + 1) * (bw - 5) - 3, y + bh - 4], fill=h)
            d.text((pad, y + 18), lab, fill="#888"); y += bh
        y += 24 - 16
    os.makedirs(f"{ROOT}/design/mockups/shots", exist_ok=True)
    im.save(f"{ROOT}/design/mockups/shots/strip-order-compare.png"); print("saved", [r[1] for r in sel])


main()
