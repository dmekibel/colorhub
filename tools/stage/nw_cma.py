"""Cleveland Museum of Art non-Western staging (CC0 open access API).
  1. type=Painting rows that tools/stage/cma.py set aside as non-Western (read from the cached meta.json);
  2. type=Manuscript (illustrated Indian / Islamic / Japanese manuscripts, leaves count as paintings; text pages and
     calligraphy dropped by corpus.select, at most GROUP_CAP leaves per manuscript).
Output: zz-museum-cleveland-nw-1.json.   python3 tools/stage/nw_cma.py"""
import json
import sys
import urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nw import C, SCR, country, emit  # noqa: E402

meta = C.load_meta("cma")["rows"]
cache = SCR / "cma_manuscripts.json"
if cache.exists():
    ms = json.load(open(cache))
else:
    ms, skip = [], 0
    while True:
        q = urllib.parse.urlencode({"type": "Manuscript", "cc0": 1, "has_image": 1, "limit": 100, "skip": skip, "fields": C.CMA_FIELDS})
        r = C.fetch("cma", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
        ms += r["data"]
        skip += 100
        if skip >= r["info"]["total"] or not r["data"]:
            break
    for x in ms:
        x["images"] = {"web": (x.get("images") or {}).get("web")}
    cache.write_text(json.dumps(ms))
print("cma painting rows:", len(meta), "manuscript rows:", len(ms), flush=True)
pre, out = {}, []
for label, rows in (("painting", meta), ("manuscript", ms)):
    rows = [x for x in rows if (x.get("images") or {}).get("web")]
    sel = {x["id"] for x in C.select("cma", rows)}
    for x in rows:
        if x["id"] not in sel:
            pre["text page / group cap / hand-listed non-painting (%s)" % label] = pre.get("text page / group cap / hand-listed non-painting (%s)" % label, 0) + 1
            continue
        r = C.norm_record("cma", x)
        r["co"] = r.get("co") or country(*(x.get("culture") or []))
        r["license"] = "CC0"
        r["url"] = x.get("url")
        out.append(r)
emit("cleveland-nw", out, pre_drops=pre, extra_stats=dict(api_total=len(meta) + len(ms)))
