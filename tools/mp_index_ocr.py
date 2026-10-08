#!/usr/bin/env python3
"""Maerz & Paul 1930 -- OCR of the INDEX OF COLOR NAMES (printed pp. 189-~211; leaf = page + 10).

Each index page has 3 ruled columns of entries:   [year] Name [superscript] .... plate col row

The Internet Archive's own OCR text interleaves the three columns line by line and misreads the bold plate
references, so this re-reads the page from the original camera JP2s:
  1. orient + fine-deskew the page, crop the text block;
  2. one sparse-text pass (psm 11) only to find the three column left edges (from the 4-digit years);
  3. cut each column into text lines with a row-ink profile;
  4. OCR every line three ways: the whole line (psm 7, 2x), the date field at the left (digits only, 3x),
     the plate reference field at the right (digits + A-L only, 3x).
Output: research/_raw/mp-index/leafNNN.json (never committed).  Parsing: tools/mp_dictionary.py.

  python3 tools/mp_index_ocr.py 199 222 [--force]
"""
import json
import os
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maerz_paul as mp  # noqa: E402
from mp_lines import column_edges  # noqa: E402

OUTDIR = mp.ROOT / "research" / "_raw" / "mp-index"
CROP = (450, 1330, 3850, 5200)
COL_W = 820          # usable width of one column, px
REF_W = 215          # width of the plate-reference field at the right end of a column
DATE_W = 120         # width of the date field at the left end
ENV = dict(os.environ, OMP_THREAD_LIMIT="1")


def fine_deskew(img):
    small = img.convert("L").resize((img.width // 2, img.height // 2))
    best, ba = -1, 0.0
    for a in np.arange(-1.0, 1.01, 0.05):
        r = small.rotate(a, resample=Image.BILINEAR, fillcolor=255)
        v = (np.asarray(r)[500:2400, 500:1900] < 150).mean(1).var()
        if v > best:
            best, ba = v, float(a)
    return ba


def binarize(img, scale=1.5):
    """Upscale then threshold at a local-ish Otsu level: bold numerals and thin serifs both survive."""
    a = np.asarray(img)
    hist, _ = np.histogram(a, bins=256, range=(0, 256))
    tot, sumall = a.size, float((np.arange(256) * hist).sum())
    wb = sb = 0.0
    best, thr = -1.0, 150
    for t in range(256):
        wb += hist[t]
        if wb == 0 or wb == tot:
            continue
        sb += t * hist[t]
        mb, mf = sb / wb, (sumall - sb) / (tot - wb)
        v = wb * (tot - wb) * (mb - mf) ** 2
        if v > best:
            best, thr = v, t
    thr = int(max(110, min(thr + 12, 190)))
    big = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    return big.point(lambda v: 255 if v > thr else 0)


def tess(img, psm, whitelist=None, want_conf=False):
    import io
    buf = io.BytesIO()
    img.save(buf, "PNG")
    args = ["tesseract", "stdin", "stdout", "--psm", str(psm)]
    if whitelist:
        args += ["-c", f"tessedit_char_whitelist={whitelist}"]
    if want_conf:
        args += ["tsv"]
    r = subprocess.run(args, input=buf.getvalue(), capture_output=True, env=ENV)
    txt = r.stdout.decode("utf8", "ignore")
    if not want_conf:
        return txt.strip().replace("\n", " "), None
    words, confs = [], []
    for l in txt.split("\n")[1:]:
        x = l.split("\t")
        if len(x) >= 12 and x[11].strip():
            words.append(x[11].strip())
            confs.append(float(x[10]))
    return " ".join(words), (sum(confs) / len(confs) if confs else 0.0)


def sparse_words(img):
    import io
    buf = io.BytesIO()
    img.save(buf, "PNG")
    r = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "11", "tsv"], input=buf.getvalue(),
                       capture_output=True, env=ENV)
    out = []
    for l in r.stdout.decode("utf8", "ignore").split("\n")[1:]:
        x = l.split("\t")
        if len(x) >= 12 and x[11].strip():
            out.append(dict(l=int(x[6]), t=int(x[7]), w=int(x[8]), h=int(x[9]), c=float(x[10]), s=x[11].strip()))
    return out


def find_lines(g, x0, x1):
    """Row runs of ink inside columns x0..x1 of the grayscale crop g -> [(y0, y1)]."""
    ink = (g[:, x0:x1] < 150).sum(1).astype(float)
    ink = np.convolve(ink, np.ones(3) / 3, mode="same")
    on = ink > 2.5
    runs, s = [], None
    for y, v in enumerate(on):
        if v and s is None:
            s = y
        if (not v) and s is not None:
            if y - s >= 14:
                runs.append([s, y])
            s = None
    if not runs:
        return []
    med = float(np.median([b - a for a, b in runs]))
    out = []
    for a, b in runs:
        h = b - a
        n = int(round(h / max(med, 1))) if h > 1.55 * med else 1
        if n > 1:  # two lines fused: split evenly
            for i in range(n):
                out.append((a + h * i // n, a + h * (i + 1) // n))
        else:
            out.append((a, b))
    return out


def ocr_leaf(leaf, force=False):
    OUTDIR.mkdir(parents=True, exist_ok=True)
    out = OUTDIR / f"leaf{leaf}.json"
    if out.exists() and not force:
        return leaf
    im = mp.oriented(leaf)
    ang = fine_deskew(im)
    im = im.rotate(ang, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    c = im.crop(CROP).convert("L")
    words = sparse_words(c)
    ed = column_edges(words)
    if ed is None:
        out.write_text(json.dumps(dict(leaf=leaf, angle=ang, lines=[], note="no columns found")))
        return leaf
    g = np.asarray(c)
    lines = []
    for k in range(3):
        x0 = int(ed[k] - 14)
        x1 = int(min(ed[k] + COL_W, g.shape[1]))
        for (y0, y1) in find_lines(g, x0 + 30, x1 - 30):
            pad = 7
            ya, yb = max(0, y0 - pad), min(g.shape[0], y1 + pad)
            line = c.crop((x0, ya, x1, yb))
            text, conf = tess(binarize(line, 1.5), 7, want_conf=True)
            if not text.strip() or conf < 30:
                for sc, psm in ((2.0, 7), (1.2, 7), (1.5, 6)):
                    t2, c2 = tess(binarize(line, sc), psm, want_conf=True)
                    if c2 > conf:
                        text, conf = t2, c2
            ref_img = c.crop((x1 - REF_W, ya, x1 + 4, yb))
            ref, _ = tess(binarize(ref_img, 2.5), 7, "0123456789ABCDEFGHIJKL")
            dt_img = c.crop((x0 - 4, ya, x0 + DATE_W, yb))
            dt, _ = tess(binarize(dt_img, 2.5), 7, "0123456789-")
            lines.append(dict(col=k, y=(y0 + y1) // 2, h=y1 - y0, text=text, conf=round(conf, 1), ref=ref, date=dt))
    out.write_text(json.dumps(dict(leaf=leaf, angle=ang, edges=ed, lines=lines)))
    return leaf


def _run(a):
    return ocr_leaf(*a)


if __name__ == "__main__":
    a, b = int(sys.argv[1]), int(sys.argv[2])
    force = "--force" in sys.argv
    with Pool(3) as p:
        for leaf in p.imap_unordered(_run, [(l, force) for l in range(a, b + 1)]):
            print("leaf", leaf, "done", flush=True)
