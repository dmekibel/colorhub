#!/usr/bin/env python3
"""One-off repair: data/design/*.json's `ci` (core-name index) fields were baked at build time (commit ea5c4499,
2026-10-08) against data/core-names.json as it stood THEN (984 entries). Three later commits
(aa5a9a47, 78cd739c, 21fbb2a0) merged duplicate core names, removing entries from the middle of the array and
shrinking it to 912 -- so every `ci` baked into the design corpus has pointed at the wrong name (or nothing,
where the old index now runs past the end of the array) ever since. Confirmed live: a Design Objects craft
review (2026-10-09) found ~12% of makers.json's `pal`/`sig` color references resolve to `undefined` in the app.

Two repair strategies, used per field depending on what each file actually stores:
  - Fields that keep the color's own hex alongside `ci` (objects-<cat>.json's `p`, cells.json's `pal`) are fixed
    by recomputing `ci` directly from that hex against the CURRENT core-names.json (most accurate -- no stale
    data involved at all).
  - Fields that only ever stored `ci`, never the hex (makers.json's `pal`/`sig`, cells.json's `sig`,
    superlatives.json's `ev`) are fixed by remapping: data/core-names.json AS IT STOOD AT ea5c4499 is read via
    `git show`, giving the old ci -> old hex; the nearest entry in the CURRENT core-names.json to that old hex
    becomes the new ci. This is a one-time, inherently approximate hop (old hex -> nearest current name), but it
    is the only data the repo still has for these fields, and the alternative (today's broken "-"/raw-hex
    placeholders) is worse.
data/design/colorindex/ and data/design/colors-index.json store names/hexes directly, not a `ci` index, so
they're untouched (verified by inspection, not file-written by this script).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

OLD_COMMIT = "ea5c4499"
DESIGN = ROOT / "data" / "design"


def load_old_core():
    txt = subprocess.run(["git", "show", f"{OLD_COMMIT}:data/core-names.json"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(txt)


def main():
    old = load_old_core()
    new = json.loads((ROOT / "data" / "core-names.json").read_text())
    print(f"old core-names.json ({OLD_COMMIT}): {len(old)} entries; current: {len(new)} entries")
    old_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(e["h"]) for e in old]))
    new_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(e["h"]) for e in new]))
    remap = C.de2000(old_lab, new_lab).argmin(1)   # old ci -> new ci, by nearest old hex
    changed = int((remap != np.arange(len(old))[: len(remap)]).sum()) if len(old) == len(new) else len(old)
    print(f"remap table built: {len(remap)} old indices -> new indices")

    def ci_from_hex(hexes):
        lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes]))
        return C.de2000(lab, new_lab).argmin(1)

    def fix_remap(ci_list):
        return [int(remap[ci]) if 0 <= ci < len(remap) else ci for ci in ci_list]

    # ---- objects-<cat>.json: p = [[hex, share, ci], ...] -- recompute ci straight from hex ----
    obj_files = sorted(DESIGN.glob("objects-*.json"))
    total_objs, total_cols, total_bad_before = 0, 0, 0
    for f in obj_files:
        rows = json.loads(f.read_text())
        hexes, slots = [], []
        for oi, o in enumerate(rows):
            for ji, col in enumerate(o.get("p") or []):
                hexes.append(col[0])
                slots.append((oi, ji))
                if len(col) > 2 and (col[2] < 0 or col[2] >= len(old)):
                    total_bad_before += 1
        if hexes:
            new_ci = ci_from_hex(hexes)
            for (oi, ji), ci in zip(slots, new_ci):
                rows[oi]["p"][ji][2] = int(ci)
        f.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
        total_objs += len(rows)
        total_cols += len(hexes)
        print(f"  {f.name}: {len(rows)} objects, {len(hexes)} palette colors re-indexed from hex")
    print(f"objects-*.json: {total_objs} objects, {total_cols} colors re-indexed ({total_bad_before} were out-of-range before the fix)")

    # ---- makers.json: pal = [[ci, pct], ...], sig = [[ci, lift, pct], ...] -- remap only (no hex stored) ----
    mp = DESIGN / "makers.json"
    makers = json.loads(mp.read_text())
    for m in makers:
        if m.get("pal"):
            m["pal"] = [[fix_remap([c[0]])[0], *c[1:]] for c in m["pal"]]
        if m.get("sig"):
            m["sig"] = [[fix_remap([c[0]])[0], *c[1:]] for c in m["sig"]]
    mp.write_text(json.dumps(makers, ensure_ascii=False, separators=(",", ":")))
    print(f"makers.json: {len(makers)} makers, pal+sig remapped")

    # ---- cells.json: pal = [[ci, pct, hex], ...] (recompute from hex) ; sig = [[ci, lift, pct], ...] (remap) ----
    cp = DESIGN / "cells.json"
    cells = json.loads(cp.read_text())
    for cat, cell in cells.get("cells", {}).items():
        if cell.get("pal"):
            hexes = [c[2] for c in cell["pal"]]
            new_ci = ci_from_hex(hexes)
            cell["pal"] = [[int(new_ci[i]), cell["pal"][i][1], cell["pal"][i][2]] for i in range(len(hexes))]
        if cell.get("sig"):
            cell["sig"] = [[fix_remap([c[0]])[0], *c[1:]] for c in cell["sig"]]
    cp.write_text(json.dumps(cells, ensure_ascii=False, separators=(",", ":")))
    print(f"cells.json: {len(cells.get('cells', {}))} cells, pal re-indexed from hex, sig remapped")

    # ---- superlatives.json: ev = [[ci, pct], ...] -- remap only ----
    sp = DESIGN / "superlatives.json"
    sup = json.loads(sp.read_text())
    for s in sup:
        # one card ("category-extremes") uses `ev` for a different shape entirely ([category, value, n], not
        # [ci, pct]); only touch rows that are actually a core-name index.
        if s.get("ev") and all(isinstance(c[0], int) for c in s["ev"]):
            s["ev"] = [[fix_remap([c[0]])[0], c[1]] for c in s["ev"]]
    sp.write_text(json.dumps(sup, ensure_ascii=False, separators=(",", ":")))
    print(f"superlatives.json: {len(sup)} cards, ev remapped")

    print("done.")


if __name__ == "__main__":
    main()
