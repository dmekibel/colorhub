"""Rebuild the three index columns of each OCR'd leaf into text lines (see tools/mp_index_ocr.py)."""
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maerz_paul as mp  # noqa: E402

OCR = mp.RAW / "index_ocr"
YEAR = re.compile(r"^[\[\(lLI1|]?[0-9OSBl]{3}$")


def column_edges(words):
    xs = np.array([w["l"] for w in words if YEAR.match(w["s"]) and w["c"] > 55])
    if len(xs) < 10:
        return None
    x0 = float(np.percentile(xs, 4))
    edges = [x0]
    for k in (1, 2):
        win = xs[(xs > x0 + 852 * k - 90) & (xs < x0 + 852 * k + 90)]
        edges.append(float(np.median(win)) if len(win) >= 3 else x0 + 852 * k)
    return edges


def leaf_lines(leaf):
    """-> list of (col, y, [words]) ordered by column then y; each word dict has l,t,w,h,c,s."""
    d = json.loads((OCR / f"leaf{leaf}.json").read_text())
    W = d["words"]
    ed = column_edges(W)
    if ed is None:
        return []
    bounds = [ed[0] - 70, ed[1] - 45, ed[2] - 45, ed[2] + 860]
    cols = [[], [], []]
    for w in W:
        for k in range(3):
            if bounds[k] <= w["l"] < bounds[k + 1]:
                cols[k].append(w)
                break
    out = []
    for k, ws in enumerate(cols):
        ws = sorted(ws, key=lambda w: w["t"] + w["h"] / 2)
        lines = []
        for w in ws:
            yc = w["t"] + w["h"] / 2
            if lines and abs(yc - lines[-1]["y"]) < 17:
                lines[-1]["w"].append(w)
                n = len(lines[-1]["w"])
                lines[-1]["y"] = (lines[-1]["y"] * (n - 1) + yc) / n
            else:
                lines.append(dict(y=yc, w=[w]))
        for ln in lines:
            ln["w"].sort(key=lambda w: w["l"])
            out.append((k, ln["y"], ln["w"]))
    return out


def line_text(ws):
    return " ".join(w["s"] for w in ws)


if __name__ == "__main__":
    leaf = int(sys.argv[1])
    for k, y, ws in leaf_lines(leaf):
        print(k, int(y), line_text(ws))
