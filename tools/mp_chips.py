#!/usr/bin/env python3
"""Maerz & Paul 1930: digitize EVERY cell (12 x 12) of every recovered plate, not just the cells round 1 could
read a name from -- with a corrected grid finder.

WHY A NEW GRID FINDER.  Round 1 (tools/maerz_paul.py grid_bbox) located the grid's left and right border by the
"highest fraction of true-black pixels near the expected position".  On most plates that picks the black edge of the
book cradle / facing page instead of the first ruled line (plate 4: the detected box starts half a column too far
left), so all 12 equal columns were shifted and every chip color was a blend of neighbours and board margin -- most
visibly column A, which sampled the grey board strip (a flat (120,120,118) on 40 plates).  That is a large part of
why round 1's median dE00 against ISCC-NBS was 9.7.  The grid is a mechanically ruled table with 13 evenly spaced
black rules in each direction, so here the rules are found as a comb: the (start, pitch) whose 13 teeth collect the
most high-passed dark-pixel mass.  Same for rows.

Writes research/_raw/mp-index/chips.json (cache, never committed):
  {plate: {"margin": [r,g,b], "grid": [x0,y0,x1,y1], "old_grid": [...], "comb": [sx, sy], "cells": {"A1": [r,g,b], ...}}}
  raw sRGB medians (same sampler as round 1: 44% interior, 2px blur), before any correction.

  python3 tools/mp_chips.py            # all plates, 3 processes
  python3 tools/mp_chips.py 4 9 14     # just those plates (no cache written)
"""
import json
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maerz_paul as mp  # noqa: E402

CACHE = mp.ROOT / "research" / "_raw" / "mp-index" / "chips.json"


def _highpass(p, w=61):
    return p - np.convolve(p, np.ones(w) / w, mode="same")


def _best_comb(hp, lo, hi, pmin, pmax, n=13, step=1):
    best = (-1e9, 0, 0)
    pos = np.arange(n)
    for pitch in range(pmin, pmax + 1):
        for x0 in range(lo, hi, step):
            idx = x0 + pos * pitch
            if idx[-1] >= len(hp):
                break
            s = float(hp[idx].sum())
            if s > best[0]:
                best = (s, x0, pitch)
    return best


def _refine(hp, x0, pitch, n=13):
    """sub-pixel (start, pitch) around an integer comb, by interpolated tooth sums"""
    best = (-1e9, float(x0), float(pitch))
    xs = np.arange(len(hp))
    for dp in np.arange(-1.5, 1.51, 0.25):
        for dx in np.arange(-5, 5.01, 0.5):
            idx = x0 + dx + np.arange(n) * (pitch + dp)
            if idx[0] < 0 or idx[-1] >= len(hp) - 1:
                continue
            sc = float(np.interp(idx, xs, hp).sum())
            if sc > best[0]:
                best = (sc, x0 + dx, pitch + dp)
    return best


def find_grid(im):
    """-> (x0, y0, x1, y1, col_score, row_score): positions of the outermost black rules of the 12 x 12 grid.
    Feature: dips of mean luminance (rules are darker than any chip, even the near-black chips of the dark
    plates, 17 vs 30).  The search windows are priors: on every recovered color page the grid starts at
    x 560-780, y 1290-1440 with a rule pitch of about 208 x 268 px."""
    rgb = np.asarray(im.convert("RGB"), dtype=np.int16)
    g = rgb.mean(2).astype(np.float32)
    dark = ((rgb < 80).all(2)).astype(np.float32)

    def feat(lum, dk):
        a, b_ = -_highpass(lum, 41), _highpass(dk, 41)
        return a / (a.std() + 1e-6) + b_ / (b_.std() + 1e-6)

    hp = feat(g[1500:4400, :].mean(0), dark[1500:4400, :].mean(0))
    s, x0, px = _best_comb(hp, 560, 780, 202, 214)
    s, x0, px = _refine(hp, x0, px)
    x0, px = int(round(x0)), px
    sl = slice(x0 + 30, int(x0 + 12 * px - 30))
    hpr = feat(g[:, sl].mean(1), dark[:, sl].mean(1))
    sy, y0, py = _best_comb(hpr, 1290, 1440, 262, 274)
    sy, y0, py = _refine(hpr, y0, py)
    return int(round(x0)), int(round(y0)), int(round(x0 + 12 * px)), int(round(y0 + 12 * py)), s / 13, sy / 13


def plate_cells(n):
    _, color_leaf = mp.leaf_for(n)
    im = mp.oriented(color_leaf)
    x0, y0, x1, y1, sx, sy = find_grid(im)
    gb = (x0, y0, x1, y1)
    pb = mp.page_bbox(im)
    old = mp.grid_bbox(im, pb)
    margin = mp.margin_sample(im, pb, gb)
    cells = {}
    for ri in range(mp.N_ROWS):
        for ci in range(mp.N_COLS):
            cells[f"{mp.COLS[ci]}{ri + 1}"] = [float(v) for v in mp.sample_color(im, mp.cell_box(gb, ci, ri))]
    return n, {"margin": [float(v) for v in margin], "grid": [int(v) for v in gb], "old_grid": [int(v) for v in old],
               "comb": [round(sx, 3), round(sy, 3)], "cells": cells}


def build(plates=None):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    out = {}
    with Pool(3) as p:
        for n, d in p.imap_unordered(plate_cells, plates or mp.PLATES):
            out[str(n)] = d
            print("plate", n, "grid", d["grid"], "old", d["old_grid"], flush=True)
    if plates is None:
        CACHE.write_text(json.dumps(out))
    return out


def load():
    return json.loads(CACHE.read_text())


if __name__ == "__main__":
    build([int(a) for a in sys.argv[1:]] or None)
