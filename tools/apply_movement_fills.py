#!/usr/bin/env python3
"""Apply research/_scratch-fill/fills-movement-country.json (tools/fill_movement_country.py) to the data/corpus/*.json shards.

  python3 tools/apply_movement_fills.py                  DRY (default): counts by source, nothing written
  python3 tools/apply_movement_fills.py --apply          the only mode that writes (rewrites the shards that change)
  options: --corpus DIR  --fills FILE  --stats FILE  --include-rule-guesses  --no-guesses

(Named apply_movement_fills.py because tools/apply_fills.py already exists for the country/date fills.)

Rules: a row only receives a value it is missing (mv / co empty). Sourced fills (wikidata-*, museum:*) are written unflagged;
guesses also set `mvest` / `coest` = true. A row that ends with no movement gets `pd` (a broad period such as "Early modern,
1600s"), never a movement. Guesses are applied only if they pass the cutoff recorded in stats.json (guess confidence >= the
classifier's cutoff; painter-majority >= 0.8). Rule-based (guess:rule-country-period) and non-Western CLIP (guess:clip-nonwest)
guesses are NOT applied unless --include-rule-guesses (not yet reviewed by David).
Run tools/gallery.py etc. afterwards; gallery.py must be taught to read mvest / pd first (see the patch list in the report).
"""
import argparse, json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "research" / "_scratch-fill"
UNREVIEWED = {"guess:rule-country-period", "guess:clip-nonwest"}


def dump(rows):
    return "[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in rows) + "\n]\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=str(ROOT / "data" / "corpus"))
    ap.add_argument("--fills", default=str(SCRATCH / "fills-movement-country.json"))
    ap.add_argument("--stats", default=str(SCRATCH / "stats.json"))
    ap.add_argument("--apply", action="store_true", help="write the shards (default is a dry run)")
    ap.add_argument("--include-rule-guesses", action="store_true")
    ap.add_argument("--no-guesses", action="store_true", help="sourced fills only")
    a = ap.parse_args()
    fills = json.loads(Path(a.fills).read_text(encoding="utf-8"))
    cl = json.loads(Path(a.stats).read_text(encoding="utf-8")).get("classifier", {})
    cut = {"mv": (cl.get("mv") or {}).get("cutoff"), "co": (cl.get("co") or {}).get("cutoff"),
           "nw": (cl.get("nonwest_clip") or {}).get("cutoff"), "knn": (cl.get("painter_knn") or {}).get("cutoff")}

    def passes(f, fl):
        if not fl["guess"]:
            return True
        if a.no_guesses:
            return False
        src = fl["src"]
        if src in UNREVIEWED:
            return a.include_rule_guesses and (src != "guess:clip-nonwest" or (cut["nw"] is not None and fl.get("conf", 0) >= cut["nw"]))
        c = fl.get("conf") or 0
        if src == "guess:clip":
            return cut[f] is not None and c >= cut[f]
        if src == "guess:painter-knn":
            return cut["knn"] is not None and c >= cut["knn"]
        if src == "guess:painter-majority":
            return c >= 0.8
        return False

    counts, changed = Counter(), []
    for f in sorted(Path(a.corpus).glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        wrapped = isinstance(data, dict)
        rows = data.get("rows", data) if wrapped else data
        touched = 0
        for r in rows:
            fl = fills.get(r["id"])
            if not fl:
                continue
            did = False
            for fld, flag in (("mv", "mvest"), ("co", "coest")):
                x = fl.get(fld)
                if x and not r.get(fld) and passes(fld, x):
                    r[fld] = x["v"]
                    if x["guess"]:
                        r[flag] = True
                    counts["%s %s" % (fld, x["src"])] += 1
                    did = True
            pd = fl.get("pd")
            if pd and not r.get("mv") and not r.get("pd"):
                r["pd"] = pd["v"]; counts["pd period"] += 1; did = True
            touched += did
        if touched:
            changed.append((f, touched))
            if a.apply:
                out = dict(data, rows=rows) if wrapped else rows
                f.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) if wrapped else dump(out), encoding="utf-8")
    print("%s %d rows in %d shards" % ("changed" if a.apply else "DRY RUN: would change", sum(n for _, n in changed), len(changed)))
    for k, v in sorted(counts.items()):
        print("  %-40s %7d" % (k, v))


if __name__ == "__main__":
    main()
