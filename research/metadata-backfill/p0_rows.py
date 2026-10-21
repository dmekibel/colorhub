"""Phase 0: the row list (gallery rows only) into the scratchpad: id, painter, year, country, movement, source."""
import json, glob, os, re
from wd import SCR
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ids = set(open(ROOT + "/data/gallery/ids.txt").read().split())
rows = []
for f in sorted(glob.glob(ROOT + "/data/corpus/*.json")):
    for r in json.load(open(f)):
        if r["id"] in ids:
            rows.append(dict(id=r["id"], a=r.get("a"), y=r.get("y"), co=r.get("co"), mv=r.get("mv"), src=r["src"], t=r.get("t")))
json.dump(rows, open(SCR + "/rows.json", "w"), ensure_ascii=False)
print(len(rows), "rows;", sum(1 for r in rows if re.match(r"commons-Q\d+$", r["id"])), "with a QID")
