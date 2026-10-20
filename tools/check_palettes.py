#!/usr/bin/env python3
"""Palette answer key (2026-10-20). data/palette-golden.json holds palettes David built by eye with the Pick editor. For each
painting, every one of his anchor colors must have a close match (CIEDE2000 <= MAX_DE) in the painting's measured color pool
(research/_raw/corpus-pool.jsonl) and in its six-color palette (data/corpus). Prints the misses; exit 1 if any.

  python3 tools/check_palettes.py
"""
import base64, glob, json, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

MAX_DE = 7.0   # 7 is "the same color, a close shade"; the rust #835438 at 9.8 from his red #9C4129 is visibly another color


def lab(hexes):
    return C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes]))


def main():
    gold = json.loads((ROOT / "data" / "palette-golden.json").read_text())
    want = {g["id"] for g in gold}
    rows = {r["id"]: r for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")) for r in json.loads(Path(f).read_text()) if r["id"] in want}
    pools = {}
    for line in open(ROOT / "research" / "_raw" / "corpus-pool.jsonl"):
        if any(k in line for k in want):
            d = json.loads(line)
            if d.get("key") in want:
                b = base64.b64decode(d["pl"]); pools[d["key"]] = ["#%02X%02X%02X" % tuple(b[i:i + 3]) for i in range(0, len(b), 4)]
    bad = 0
    for g in gold:
        a = lab(g["anchors"])
        for name, cols in (("pool", pools.get(g["id"], [])), ("six", [p[0] for p in rows.get(g["id"], {}).get("p", [])])):
            if not cols:
                print(f"  {g['id']} {name}: missing"); bad += 1; continue
            d = C.de2000(a, lab(cols)).min(1)
            miss = [f"{h} (closest {d[i]:.0f})" for i, h in enumerate(g["anchors"]) if d[i] > MAX_DE]
            bad += bool(miss)
            print(f"{g['title'][:40]:40} {name:4} {len(g['anchors']) - len(miss)}/{len(g['anchors'])} anchors matched" + (f"; missed {', '.join(miss)}" if miss else ""))
    print(f"palette answer key: {len(gold)} paintings, {bad} failing")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
