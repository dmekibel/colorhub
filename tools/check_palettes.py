#!/usr/bin/env python3
"""Palette answer key (2026-10-20). data/palette-golden.json holds palettes David built by eye with the Pick editor. For each
painting, every one of his anchor colors must have a close match (CIEDE2000 <= MAX_DE) in the painting's measured color pool
(research/_raw/corpus-pool.jsonl) and in its six-color palette (data/corpus). Prints the misses; exit 1 if any.

  python3 tools/check_palettes.py           # the shipped data: what the site serves
  python3 tools/check_palettes.py --live    # measure each golden painting now with the current method (tools/corpus.py
                                            # palette_of + tools/gallery.py extract_pool) from its cached image; use this to
                                            # prove a method change before the full re-measure is run

The six-color palette has 6 slots for the anchors AND the painting's big neutrals, so the six is held to SIX_MIN anchors
(the pool, 40 colors, to all of them). Set COLORHUB_RAW=<dir> to read the caches of another checkout (a worktree).
"""
import base64, glob, json, os, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

MAX_DE = 7.0   # 7 is "the same color, a close shade"; the rust #835438 at 9.8 from his red #9C4129 is visibly another color
SIX_MIN = 4    # anchors the six-color palette must hold (6 slots also have to show the painting's dominant neutrals)


def lab(hexes):
    return C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes]))


def live(g):
    """(pool hexes, six hexes) measured now from the cached image."""
    import gallery as G
    key = g["id"]
    src, rid = key.split("-", 1)
    p = C.img_path(src, rid)
    if not p.exists():
        return [], []
    pool = [h for h, _ in G.extract_pool(str(p))]
    six = C.palette_of(p)["lab"]
    return pool, [C.rgb_to_hex(c) for c in C.lab_to_rgb(np.array(six))]


def main():
    gold = json.loads((ROOT / "data" / "palette-golden.json").read_text())
    want = {g["id"] for g in gold}
    use_live = "--live" in sys.argv
    rows, pools = {}, {}
    if not use_live:
        rows = {r["id"]: r for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")) for r in json.loads(Path(f).read_text()) if r["id"] in want}
        for line in open(C.RAW / "corpus-pool.jsonl"):
            if any(k in line for k in want):
                d = json.loads(line)
                if d.get("key") in want:   # the newest line for a key wins
                    b = base64.b64decode(d["pl"]); pools[d["key"]] = ["#%02X%02X%02X" % tuple(b[i:i + 3]) for i in range(0, len(b), 4)]
    bad = 0
    for g in gold:
        a = lab(g["anchors"])
        if use_live:
            pools[g["id"]], six = live(g)
            sixes = six
        else:
            sixes = [p[0] for p in rows.get(g["id"], {}).get("p", [])]
        for name, cols, need in (("pool", pools.get(g["id"], []), len(g["anchors"])), ("six", sixes, min(SIX_MIN, len(g["anchors"])))):
            if not cols:
                print(f"  {g['id']} {name}: missing"); bad += 1; continue
            d = C.de2000(a, lab(cols)).min(1)
            miss = [f"{h} (closest {d[i]:.0f})" for i, h in enumerate(g["anchors"]) if d[i] > MAX_DE]
            ok = len(g["anchors"]) - len(miss)
            bad += ok < need
            print(f"{g['title'][:40]:40} {name:4} {ok}/{len(g['anchors'])} anchors matched (need {need})" + (f"; missed {', '.join(miss)}" if miss else ""))
    print(f"palette answer key: {len(gold)} paintings, {bad} failing")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
