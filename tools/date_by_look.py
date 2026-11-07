#!/usr/bin/env python3
"""Estimate a year for undated rows from the painter's own dated work that LOOKS most like it (2026-11-07: Sargent had 637
undated Commons rows; titles and Commons date fields dated about a third).

  research/_raw/clipenv/bin/python tools/date_by_look.py            DRY RUN
  research/_raw/clipenv/bin/python tools/date_by_look.py --write    sets y, yest: true, span, ysrc: "look"

For each undated row with a CLIP embedding (research/_raw/subjects/clip-embeds.npy): the painter's 8 most similar dated rows
(cosine), only if the painter has 12+ dated rows and the nearest is a real match (cosine >= .80). Year = their median; span = the
spread of those 8 (at least 10 years). The app already shows such years as estimates ("about 1880", gallery.py est.json).
Run before tools/gallery.py. Never overwrites a real year.
"""
import glob, json, sys
from collections import defaultdict
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "research/_raw/subjects"


def main():
    write = "--write" in sys.argv
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy").astype(np.float32)
    arr /= np.linalg.norm(arr, axis=1, keepdims=True) + 1e-9
    pos = {k: n for n, k in enumerate(have)}
    files = sorted(glob.glob(str(ROOT / "data/corpus/*.json")))
    data = {f: json.load(open(f, encoding="utf-8")) for f in files}
    by = defaultdict(lambda: ([], []))   # painter -> (dated [(emb row, year)], undated [(file, row)])
    for f, rows in data.items():
        for r in rows if isinstance(rows, list) else []:
            if not isinstance(r, dict) or r.get("id") not in pos: continue
            if isinstance(r.get("y"), int) and not r.get("yest"): by[r.get("a")][0].append((pos[r["id"]], r["y"]))
            elif r.get("y") in (None, ""): by[r.get("a")][1].append((f, r))
    n, skipped, changed = 0, defaultdict(int), set()
    for a, (dated, und) in by.items():
        if not und: continue
        if len(dated) < 12: skipped["painter has < 12 dated"] += len(und); continue
        D = arr[[p for p, _ in dated]]; Y = np.array([y for _, y in dated])
        for f, r in und:
            s = D @ arr[pos[r["id"]]]
            top = np.argsort(-s)[:8]
            if s[top[0]] < .80: skipped["no close match"] += 1; continue
            ys = np.sort(Y[top]); y = int(np.median(ys)); span = max(10, int(ys[-2] - ys[1]))
            r["y"] = y; r["yest"] = True; r["span"] = span; r["ysrc"] = "look"; n += 1; changed.add(f)
    print(("WROTE " if write else "DRY RUN ") + f"{n} years estimated by look; skipped {dict(skipped)}")
    if write:
        for f in changed:
            Path(f).write_text("[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in data[f]) + "\n]\n", encoding="utf-8")


if __name__ == "__main__":
    main()
