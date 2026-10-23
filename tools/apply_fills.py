#!/usr/bin/env python3
"""Apply data/fills/country-date-fills.json (tools/fill_country_date.py) to the data/corpus/*.json shards.

  python3 tools/apply_fills.py --dry-run            counts by method + a sample of 40, writes nothing
  python3 tools/apply_fills.py                      rewrites the shards that change (same one-row-per-line format)
  options: --corpus DIR  --fills FILE  --only co|y  --min-conf low|med|high  --no-guesses  --no-replace

Rules: a row only receives a value it is missing. `co` is filled only when the row's co is empty; `y` only when it is
null, or (fills with replace=true) when the row still carries exactly the impossible year the fill recorded in `was`.
Fields written: co, y, span (full width in years, the tools/corpus.py meaning), and `coest` / `yest` = true on a GUESS
(artist-country / artist-years); measured fills (record, wikidata) carry no flag. Run tools/gallery.py etc. afterwards
(rebuild_all.sh); gallery.py reads y and co only, so the flags and span do not reach the app until it is taught to.
"""
import argparse, json, random, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = {"low": 0, "med": 1, "high": 2}


def dump(rows):
    return "[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in rows) + "\n]\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=str(ROOT / "data" / "corpus"))
    ap.add_argument("--fills", default=str(ROOT / "data" / "fills" / "country-date-fills.json"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", choices=["co", "y"])
    ap.add_argument("--min-conf", choices=list(CONF), default="low")
    ap.add_argument("--no-guesses", action="store_true", help="apply measured fills only (record / wikidata)")
    ap.add_argument("--no-replace", action="store_true", help="leave impossible years alone, fill blanks only")
    a = ap.parse_args()
    fills = json.loads(Path(a.fills).read_text(encoding="utf-8"))
    floor = CONF[a.min_conf]
    counts, sample, changed_files = Counter(), [], []
    shards = sorted(Path(a.corpus).glob("*.json"))
    for f in shards:
        text = f.read_text(encoding="utf-8")
        data = json.loads(text)
        wrapped = isinstance(data, dict)
        rows = data.get("rows", data) if wrapped else data
        touched = 0
        for r in rows:
            fl = fills.get(r["id"])
            if not fl:
                continue
            did = []
            if "co" in fl and a.only != "y" and not r.get("co") and CONF[fl["co_conf"]] >= floor \
                    and not (a.no_guesses and fl.get("coest")):
                did.append(("co", fl["co_how"], fl["co"], r.get("co")))
                r["co"] = fl["co"]
                if fl.get("coest"):
                    r["coest"] = True
            if "y" in fl and a.only != "co" and CONF[fl["y_conf"]] >= floor and not (a.no_guesses and fl.get("yest")):
                replace = fl.get("replace")
                if (r.get("y") is None and not replace) or (replace and not a.no_replace and r.get("y") == fl.get("was")):
                    did.append(("y-replace" if replace else "y", fl["y_how"], fl["y"], r.get("y")))
                    r["y"] = fl["y"]
                    if fl.get("span"):
                        r["span"] = fl["span"]
                    if fl.get("yest"):
                        r["yest"] = True
            for field, how, new, old in did:
                counts["%s via %s" % (field, how)] += 1
                sample.append("%s  %s: %r -> %r  [%s | %s]" % (r["id"], field, old, new, how,
                              fl.get("co_rule") if field == "co" else fl.get("y_rule")))
            touched += bool(did)
        if touched:
            changed_files.append((f, touched))
            if not a.dry_run:
                out = dict(data, rows=rows) if wrapped else rows
                f.write_text(dump(out) if not wrapped else json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("%s %d rows in %d shards" % ("would change" if a.dry_run else "changed", sum(n for _, n in changed_files), len(changed_files)))
    for k, v in sorted(counts.items()):
        print("  %-34s %7d" % (k, v))
    if a.dry_run:
        print("\nsample of 40:")
        for s in random.Random(1).sample(sample, min(40, len(sample))):
            print("  " + s)


if __name__ == "__main__":
    main()
