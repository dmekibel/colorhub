#!/usr/bin/env python3
"""Deep flat margins: a small picture sitting in a big white (or flat grey / cream / mat-colored) page.

  python3 tools/crop_margins.py                 # every cached image -> data/crop-margins.json (about 2 minutes, 8 workers)
  python3 tools/crop_margins.py --sheets DIR    # also write before/after contact sheets (small jpgs) into DIR
  python3 tools/crop_margins.py --id ID         # print the measurement for one painting

Why (David, 2026-10-25): page scans, miniatures on a mount and botanical sheets show a painting that fills 10-40% of its image;
the white page then dominates the six colors, the pins and the map, so these rank first for every pale color.
tools/crop_paintings.py only finds frames and thin margins (its straight-edge search stops 30% in and trusts a deep edge on one
side only when the opposite side matches); this finds the deep ones.

Method (deterministic; numpy + PIL; on the cached 200 px copy, the same pixels the palettes use).
  1. The page color is the median of the 3 px border ring. All four sides must agree (their medians within 40 per channel: scanner shadow).
  2. A pixel is "picture" when it differs from the page color by more than 30 in some channel. The box is the span of rows and
     columns where more than 1.5% of the line is picture (dust, a hairline or a caption stripe under 1.5% does not count).
  3. The page must be a PAGE, not a painted background: the pixels outside the box must be flat (std <= 12).
     A light page only (luminance >= 170): a dark or mid flat ground is as likely a painted background as a mount, so it is
     never cropped (2026-10-25: dark portrait backgrounds were being trimmed).
  4. The box must cover less than 75% of the image (and more than 2.5%: anything smaller is a blank page, not a picture to
     crop; hide_nonart.py lists those), with margin on at least two sides, and the outside must be at least 25% of the image.
  5. The crop is the box plus a 1.5% breathing margin, in thousandths of the image (the same unit as a corpus row's `crop`).
The result is data/crop-margins.json {id: [l, t, r, b]}; tools/corpus.py wanted_crops() merges it with the frame detector
(intersection when both found something) and data/crop-overrides.json still wins ("none" removes a bad crop). Then
python3 tools/crop_paintings.py apply recomputes the palette of every newly cropped image inside its crop, and
tools/rebuild_all.sh carries it into the gallery (aspect byte, pools, color index, atlas tiles, thumbs.txt).
"""
import json, os, sys, time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
if not RAW.exists():
    RAW = Path("/Users/david/Documents/claudeCode/colorhub/research/_raw")
OUT = ROOT / "data" / "crop-margins.json"

DIFF = 30            # a pixel differs from the page color by more than this in some channel
LINE = 0.015         # a row / column is picture when more than this share of it differs
SIDES_AGREE = 40
FLAT_LIGHT = 12.0
LIGHT = 170          # luminance of a page that is trusted without being perfectly flat
MAX_AREA, MIN_AREA, MIN_OUTSIDE = 0.75, 0.025, 0.25
PAD = 0.015
WEIGHTS = np.array([.299, .587, .114], np.float32)


def img_file(k):
    s, r = k.split("-", 1)
    for p in (RAW / s / "img" / f"{r}.jpg", RAW / "measure-img" / f"{k}.jpg"):
        if p.exists():
            return p
    return None


def load(p, width=200):
    im = Image.open(p)
    im.draft("RGB", (width, width))
    im = im.convert("RGB")
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.BOX)
    return im


def margin_box(im):
    """-> (box [l, t, r, b] in 0..1 with the padding, info dict) or (None, info) with info['why'] saying why not."""
    a = np.asarray(im, dtype=np.float32)
    h, w, _ = a.shape
    if h < 24 or w < 24:
        return None, {"why": "tiny"}
    ring = [a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)]
    meds = np.array([np.median(r, 0) for r in ring])
    bg = np.median(np.concatenate(ring), 0)
    bgL = float(bg @ WEIGHTS)
    if np.abs(meds - bg).max() > SIDES_AGREE or bgL < LIGHT:
        return None, {"why": "sides differ" if bgL >= LIGHT else "dark ground", "bgL": bgL}
    m = np.abs(a - bg).max(2) > DIFF
    rows = np.where(m.mean(1) > LINE)[0]
    cols = np.where(m.mean(0) > LINE)[0]
    if not len(rows) or not len(cols):
        return None, {"why": "blank", "bgL": bgL}
    y0, y1, x0, x1 = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
    area = (y1 - y0) * (x1 - x0) / (h * w)
    info = {"bgL": round(bgL, 1), "area": round(float(area), 3)}
    if area >= MAX_AREA:
        return None, {**info, "why": "fills"}
    if area < MIN_AREA:
        return None, {**info, "why": "blank"}
    out = np.ones((h, w), bool); out[y0:y1, x0:x1] = False
    if out.mean() < MIN_OUTSIDE:
        return None, {**info, "why": "little margin"}
    sides = sum(int(v) for v in (y0 > 0.02 * h, h - y1 > 0.02 * h, x0 > 0.02 * w, w - x1 > 0.02 * w))
    if sides < 2:
        return None, {**info, "why": "margin on %d sides" % sides}
    sd = float(a[out].std(0).mean())
    info["std"] = round(sd, 1)
    if sd > FLAT_LIGHT:
        return None, {**info, "why": "page not flat"}
    box = [max(0.0, x0 / w - PAD), max(0.0, y0 / h - PAD), min(1.0, x1 / w + PAD), min(1.0, y1 / h + PAD)]
    return box, info


def _job(k):
    try:
        p = img_file(k)
        if p is None:
            return k, None, {"why": "no image"}
        return (k,) + margin_box(load(p))
    except Exception as e:
        return k, None, {"why": "error " + str(e)[:40]}


def main():
    argv = sys.argv
    ids = (ROOT / "data" / "gallery" / "ids.txt").read_text().split("\n")
    if "--id" in argv:
        k = argv[argv.index("--id") + 1]
        print(_job(k)[1:])
        return
    from multiprocessing import Pool
    t0 = time.time()
    res = {}
    why = {}
    with Pool(8) as pool:
        for k, box, info in pool.imap_unordered(_job, ids, chunksize=128):
            if box:
                res[k] = [int(round(v * 1000)) for v in box]
            why[info.get("why", "crop")] = why.get(info.get("why", "crop"), 0) + 1
    OUT.write_text("{\n" + ",\n".join(f"{json.dumps(k)}:{json.dumps(res[k], separators=(',', ':'))}" for k in sorted(res)) + "\n}\n")
    print(f"{len(res)} margin crops of {len(ids)} in {time.time() - t0:.0f}s ->", OUT, sorted(why.items(), key=lambda t: -t[1])[:8])
    if "--sheets" in argv:
        sheets(res, Path(argv[argv.index("--sheets") + 1]))


def sheets(res, d, cell=110, cols=10, n=40):
    from PIL import ImageDraw
    import random
    d.mkdir(parents=True, exist_ok=True)
    keys = sorted(res)
    random.Random(7).shuffle(keys)
    pick = keys[:n]
    S = Image.new("RGB", (cols * cell, 2 * ((len(pick) + cols - 1) // cols) * cell), (60, 60, 60))
    rows = (len(pick) + cols - 1) // cols
    for j, k in enumerate(pick):
        im = load(img_file(k)); c = res[k]
        w, h = im.size
        crop = im.crop((round(c[0] * w / 1000), round(c[1] * h / 1000), round(c[2] * w / 1000), round(c[3] * h / 1000)))
        for t, src in enumerate((im, crop)):
            src = src.copy(); src.thumbnail((cell - 4, cell - 4))
            S.paste(src, ((j % cols) * cell + 2, (t * rows + j // cols) * cell + 2))
    S.save(d / "margins-before-after.jpg", quality=70)


if __name__ == "__main__":
    main()
