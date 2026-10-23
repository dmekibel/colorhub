"""Cleveland Museum of Art (CC0 open access API): type Painting and Manuscript leaves dated before 1500 (any department:
Chinese, Japanese, Indian, Islamic, Egyptian, Byzantine, medieval Europe). Ids cma-<id> (same as corpus.py).
Spans over 200 years dropped; manuscript leaves capped at GROUP_CAP per accession group.  python3 tools/stage/ma_cma.py"""
import json, re, sys, urllib.parse
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ma_common as M
from ma_common import C, SCR
from nw import country

cache = SCR / "cma_pre1500.json"
if cache.exists():
    allr = json.load(open(cache))
else:
    allr = []
    for typ in ("Painting", "Manuscript"):
        skip = 0
        while True:
            q = urllib.parse.urlencode({"type": typ, "cc0": 1, "has_image": 1, "created_before": 1500, "limit": 100, "skip": skip,
                                        "fields": C.CMA_FIELDS})
            r = C.fetch("cma", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
            for x in r["data"]:
                x["images"] = {"web": (x.get("images") or {}).get("web")}
                x["_type"] = typ
            allr += r["data"]
            skip += 100
            if skip >= r["info"]["total"] or not r["data"]:
                break
    cache.write_text(json.dumps(allr))
print("cma pre-1500 rows:", len(allr), Counter(x["_type"] for x in allr), flush=True)
held = M.Held("cma")
drops, rows = Counter(), []
groups = {}
for x in allr:
    if not (x.get("images") or {}).get("web"):
        drops["no image"] += 1
        continue
    r = C.norm_record("cma", x)
    e, l = x.get("creation_date_earliest"), x.get("creation_date_latest")
    if e is None:
        drops["no usable date"] += 1
        continue
    r["y"], r["span"] = e, (l - e if l is not None else None)
    if (r["span"] or 0) > 200:
        drops["date span over 200 years"] += 1
        continue
    if r["y"] >= 1500:
        drops["1500 or later"] += 1
        continue
    if not r["t"] or C.TEXT_PAGE.search(x.get("title") or ""):
        drops["no usable title / text page"] += 1
        continue
    r["co"] = r.get("co") or country(*(x.get("culture") or []))
    r["license"], r["url"] = "CC0", x.get("url")
    r["_acc"] = x.get("accession_number") or r["id"]
    groups.setdefault(".".join(str(r["_acc"]).split(".")[:2]), []).append(r)
for g in groups.values():
    g.sort(key=lambda r: str(r["_acc"]))
    if len(g) > C.GROUP_CAP:
        drops["leaf cap"] += len(g) - C.GROUP_CAP
        step = len(g) / C.GROUP_CAP
        g = [g[int(i * step)] for i in range(C.GROUP_CAP)]
    for r in g:
        if r["id"] in held.ids:
            drops["already held (id)"] += 1
        elif held.twin(r):
            drops["artist+title+year twin"] += 1
        else:
            held.add(r)
            rows.append(r)
files = M.write("cma", rows)
st = dict(source="Cleveland", fetched=len(allr), new=len(rows), drops=dict(drops), files=files)
print(json.dumps(st), flush=True)
(SCR / "stats" / "ma-cma.json").write_text(json.dumps(st, indent=1))
