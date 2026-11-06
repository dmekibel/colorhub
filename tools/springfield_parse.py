#!/usr/bin/env python3
"""Research only (nothing ships). Parse iPhone screenshots of @springfield.palettes posts: crop the frame, read the
10-11 bar strip in order. Output stays in research/_raw/springfield/ (gitignored; the images and colors are copyrighted).
usage: python3 tools/springfield_parse.py [raw_dir]"""
import sys, json, glob, os
import numpy as np
from PIL import Image

RAW = sys.argv[1] if len(sys.argv) > 1 else "research/_raw/springfield"


def parse(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    white = (a.min(2) > 225)
    wf = white.mean(1)
    rows = np.where(wf > 0.6)[0]
    if not len(rows):
        return None
    # the white line: a short run of rows
    runs = np.split(rows, np.where(np.diff(rows) > 1)[0] + 1)
    for run in runs:
        if not (3 <= len(run) <= 30):
            continue
        y0, y1 = run[0], run[-1] + 1
        band = white[y1 + 6:y1 + 40]
        if len(band) < 20:
            continue
        gap = band.mean(0) > 0.7           # white-gap columns between bars
        inb = ~gap
        segs, s = [], None
        for x in range(W):
            if inb[x] and s is None: s = x
            if (not inb[x] or x == W - 1) and s is not None:
                if x - s > W * 0.03: segs.append((s, x))
                s = None
        if not 8 <= len(segs) <= 12:
            continue
        # strip bottom: first row where the mid-bar colour of the first bar departs from its top colour
        cx = (segs[0][0] + segs[0][1]) // 2
        ref = np.median(a[y1 + 10:y1 + 30, cx - 10:cx + 10].reshape(-1, 3), 0)
        yb = y1 + 30
        while yb < H - 1 and np.abs(a[yb, cx - 10:cx + 10] - ref).max() < 30:
            yb += 1
        ymid = (y1 + yb) // 2
        # bar centres, away from the mute icon: sample at 1/3 of the strip height, central patch of the bar
        cols = []
        for (x0, x1) in segs:
            c = (x0 + x1) // 2; hw = max(4, (x1 - x0) // 5)
            patch = a[y1 + (yb - y1) // 4: y1 + (yb - y1) // 2, c - hw:c + hw].reshape(-1, 3)
            cols.append("#%02X%02X%02X" % tuple(int(v) for v in np.median(patch, 0)))
        # frame top: walk up while the left/right edge pixels differ from the page background
        bg = a[min(H - 1, yb + 60), 3]
        yt = y0
        while yt > 0 and (np.abs(a[yt - 1, 3] - bg).max() > 10 or np.abs(a[yt - 1, W - 4] - bg).max() > 10):
            yt -= 1
        return dict(frame_box=[0, int(yt), W, int(y0)], strip_box=[int(segs[0][0]), int(y1), int(segs[-1][1]), int(yb)],
                    colors=cols)
    return None


def main():
    out = []
    for f in sorted(glob.glob(f"{RAW}/shots/*.png")):
        r = parse(f)
        name = os.path.basename(f)
        if not r:
            print("skip", name); continue
        r["shot"] = name
        fh = r["frame_box"][3] - r["frame_box"][1]
        if not 985 <= fh <= 1000:       # frames are 4:3 (990 px at 1320 wide): anything else is cut off by the scroll or misread
            print("drop (frame height %d)" % fh, name); continue
        Image.open(f).convert("RGB").crop(tuple(r["frame_box"])).save(f"{RAW}/frames/{name[:8]}.png")
        out.append(r)
        print(name, r["frame_box"], len(r["colors"]))
    json.dump(out, open(f"{RAW}/posts.json", "w"))


if __name__ == "__main__":
    main()
