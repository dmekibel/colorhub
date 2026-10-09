#!/usr/bin/env python3
"""Write data/design/objects-pulp.json only, from the current research/_raw/design-selected.json +
design-palettes.jsonl (which, for this pulp-only build, hold pulpc/pulpia rows exclusively; see RUN-PULP.md). This is
a scoped variant of design_corpus.py's cmd_build(): that function deletes and rewrites every data/design/objects-*.json
from whatever is in the current selection, which would destroy the other nine categories' committed files when (as
here) the selection was rebuilt for pulp alone rather than refetching every other source's metadata. This script
reuses the same naming/commercial logic but touches only the one new file.
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
import design_corpus as D  # noqa: E402

CAT = "pulp"


def main():
    sel = json.loads(D.SEL.read_text())
    # the brief's own range is 1896-1960s; a few IA fan-reprint/zine identifiers from the 1970s slipped through the
    # title match (e.g. "Odyssey ... Mystery Adventure Magazine ... [1976]") and are dropped here, not in the corpus.
    sel = [r for r in sel if r["cat"] == CAT and r["y"] <= 1969]
    pals = {}
    for line in D.PAL.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            pals[r["key"]] = r
    rows = [r for r in sel if r["id"] in pals]
    mono = [r for r in rows if pals[r["id"]]["C"] < 0.6]
    rows = [r for r in rows if pals[r["id"]]["C"] >= 0.6]
    labs = np.array([lab for r in rows for lab in pals[r["id"]]["lab"]])
    ci, de = D.name_labs(labs)
    k, out = 0, []
    for r in rows:
        p = pals[r["id"]]
        n = len(p["lab"])
        cols = []
        for j in range(n):
            hexv = C.rgb_to_hex(C.lab_to_rgb(np.array(p["lab"][j])))
            cols.append([hexv, p["share"][j], int(ci[k + j])])
        k += n
        o = dict(id=r["id"], src=r["src"], t=r["t"], a=r["a"], y=r["y"], co=r.get("co"), cat=r["cat"], ty=r.get("ty"),
                 i=r.get("img"), u=r.get("url"), p=cols, L=p["L"], C=p["C"])
        if D.commercial(r):
            o["cm"] = 1
        if r.get("lic"):
            o["lic"] = r["lic"]
        if r.get("mag"):
            o["mag"] = r["mag"]
        out.append(o)
    out.sort(key=lambda o: (o["y"], o["id"]))
    D.OUT.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (D.OUT / f"objects-{CAT}.json").write_text(txt)
    print(f"build (pulp only): {len(out)} objects ({len(mono)} monochrome scans left out); core-name dE median "
          f"{float(np.median(de)):.1f}, 90th pct {float(np.percentile(de, 90)):.1f}")
    print(f"  data/design/objects-{CAT}.json: {len(out)} objects, {len(txt) / 1e6:.2f} MB")
    print("  by source:", {s: sum(1 for o in out if o["src"] == s) for s in {o["src"] for o in out}})
    decs = sorted({o["y"] // 10 * 10 for o in out})
    print("  by decade:", {d: sum(1 for o in out if o["y"] // 10 * 10 == d) for d in decs})


if __name__ == "__main__":
    main()
