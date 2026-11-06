#!/usr/bin/env python3
"""Apply research/_raw/enrich/enrich.json (tools/wikidata_enrich.py) to data/corpus/*.json, and clean titles.

  python3 tools/apply_enrich.py            DRY RUN: counts only
  python3 tools/apply_enrich.py --write    rewrites the shards that change (one row per line, as everywhere)

Rules (2026-11-07):
  * new fields, always from Wikidata: qid, mu (museum), city, size [h, w] cm, genre [labels], fame (sitelinks)
  * medium and mv only fill an EMPTY field (a museum's own record wins)
  * titles: Commons template leftovers are cut ("...label QS:Len,..." / "title QS:P1476,..."), whitespace squeezed
"""
import glob, json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR = ROOT / "research" / "_raw" / "enrich" / "enrich.json"
JUNK = re.compile(r"\s*(label|title)\s+QS:.*$|\s*QS:P\d+.*$", re.I | re.S)


def clean_title(t):
    if not isinstance(t, str):
        return t
    u = JUNK.sub("", t)
    u = re.sub(r"\{\{.*?\}\}|\[\[|\]\]", "", u)
    u = re.sub(r"\s+", " ", u).strip(" ,;-")
    return u or t


def main():
    write = "--write" in sys.argv
    enr = json.loads(ENR.read_text())
    c = Counter()
    for f in sorted(glob.glob(str(ROOT / "data" / "corpus" / "*.json"))):
        try:
            rows = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(rows, list):
            continue
        changed = False
        for r in rows:
            if not isinstance(r, dict):
                continue
            t = clean_title(r.get("t"))
            if t != r.get("t"):
                r["t"] = t; c["title cleaned"] += 1; changed = True
            e = enr.get(r.get("id"))
            if not e:
                continue
            for k in ("qid", "mu", "city", "size", "genre", "fame"):
                if k in e and r.get(k) != e[k]:
                    r[k] = e[k]; c[k] += 1; changed = True
            for k in ("medium", "mv"):
                if e.get(k) and not r.get(k):
                    r[k] = e[k]; c[k + " filled"] += 1; changed = True
        if changed and write:
            Path(f).write_text("[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in rows) + "\n]\n", encoding="utf-8")
    print(("WROTE " if write else "DRY RUN ") + json.dumps(dict(c)))


if __name__ == "__main__":
    main()
