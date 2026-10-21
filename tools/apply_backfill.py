#!/usr/bin/env python3
"""Apply the Wikidata metadata backfill to data/corpus/*.json (country, year, movement). PHASE 2 TOOL: phase 1 only prepared it.

  python3 tools/apply_backfill.py                      # DRY RUN (default): counts per field, nothing written
  python3 tools/apply_backfill.py --selftest           # proves the file writer is byte-identical when nothing changes
  python3 tools/apply_backfill.py --write              # patch data/corpus/*.json in place
  options:
    --co-policy birth|citizenship|existing-majority   country source for blank rows (default birth = the audit's policy)
    --mv painting|painter|both|none                    movement source (default painting; painter = the painter's only movement)
    --years P571,commons-date,title                    which year sources to accept (default all three; "title" is the weakest)
    --min-confidence 0.5                               skip painters matched below this confidence
    --corpus DIR                                       default data/corpus

Rules: only BLANK fields are filled (co null/missing, y null/missing, mv null/missing); a non-blank value is never changed.
Rows keep their key order and the file layout (one compact row per line). After --write run, in this order:
  tools/rebuild_all.sh --atlas     (gallery order is append-only, so no row moves; facets/analysis/stat files are rebuilt)
and the usual gates. New countries (Ukraine, Belarus, Latvia, Lithuania, Slovakia ...) must be added to the app's naming
(facets.py reads the names from the rows, so they appear on their own; js/ country lists, flags and NAV text are checked
by tools/check.js). See research/metadata-backfill/README.md for what to decide first.

Inputs: research/metadata-backfill/painters.json (painter label -> country, ...) and paintings.json (row id -> fill fields).
"""
import argparse, glob, json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BF = os.path.join(ROOT, "research", "metadata-backfill")


def dump(rows):
    return "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--co-policy", default="birth", choices=["birth", "citizenship", "existing-majority"])
    ap.add_argument("--mv", default="painting", choices=["painting", "painter", "both", "none"])
    ap.add_argument("--years", default="P571,commons-date,title")
    ap.add_argument("--min-confidence", type=float, default=0.0)
    ap.add_argument("--corpus", default=os.path.join(ROOT, "data", "corpus"))
    a = ap.parse_args()
    files = sorted(glob.glob(os.path.join(a.corpus, "*.json")))
    if a.selftest:
        bad = 0
        for f in files:
            raw = open(f, encoding="utf-8").read()
            if dump(json.loads(raw)) != raw:
                bad += 1; print("NOT byte-identical:", os.path.relpath(f, ROOT))
        print("selftest:", len(files), "files,", bad, "differ")
        return 1 if bad else 0
    P = json.load(open(os.path.join(BF, "painters.json")))["painters"]
    W = json.load(open(os.path.join(BF, "paintings.json")))["rows"]
    ysrc = set(a.years.split(","))
    count = collections.Counter(); after = collections.Counter()
    for f in files:
        rows = json.loads(open(f, encoding="utf-8").read()); changed = 0
        for r in rows:
            w = W.get(r["id"], {})
            pr = P.get(r.get("a") or "")
            # country
            if not r.get("co"):
                c = None
                if pr and pr.get("confidence", 0) >= a.min_confidence:
                    if a.co_policy == "birth": c = pr.get("country_app")
                    elif a.co_policy == "citizenship": c = pr.get("country_p27") or pr.get("country_app")
                    else:
                        ex = pr.get("existing_co") or {}
                        c = max(ex, key=ex.get) if ex else pr.get("country_app")
                c = c or (w.get("co") if w.get("cs") == "P495" else None)
                if c: r["co"] = c; count["co"] += 1; changed += 1
            # year
            if not r.get("y") and "y" in w and w.get("ys", "P571") in ysrc:
                r["y"] = w["y"]; count["y:" + w.get("ys", "P571")] += 1; changed += 1
            # movement
            if not r.get("mv") and "mv" in w:
                src = w.get("ms", "painting")
                if a.mv == "both" or a.mv == src:
                    r["mv"] = w["mv"]; count["mv:" + src] += 1; changed += 1
            if r.get("co"): after["co"] += 1
            if r.get("y"): after["y"] += 1
            if r.get("mv"): after["mv"] += 1
        count["files_touched"] += bool(changed)
        if a.write and changed:
            open(f, "w", encoding="utf-8").write(dump(rows))
    print("MODE:", "WRITE" if a.write else "dry run (nothing written)")
    for k, v in sorted(count.items()): print(f"  {k:24s} {v}")
    print("  rows with country / year / movement after:", after["co"], after["y"], after["mv"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
