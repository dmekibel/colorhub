"""Art Institute of Chicago non-Western painting staging: public-domain, image, artwork type Painting / Miniature Painting /
Drawing and Watercolor in the Asian, Americas, Africa and Textiles departments, plus any Painting whose place of origin is
non-Western (Mexico, Peru ...). Same API and AIC-User-Agent as corpus.meta_aic (1 request/s). Output: zz-museum-aic-nw-1.json.
  python3 tools/stage/nw_aic.py"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nw import C, SCR, country, emit  # noqa: E402

C.SRC["aic"]["dir"] = SCR / "raw" / "aic-nw"
DEPTS = ["Arts of Asia", "Arts of the Americas", "Arts of Africa", "Textiles", "Arts of the Ancient Mediterranean and Byzantine World",
         "Modern and Contemporary Art", "Painting and Sculpture of Europe", "Arts of Africa, Oceania, and the Americas"]
cache = SCR / "aic_nw.json"
if cache.exists():
    rows = json.load(open(cache))
else:
    rows = []
    for types in (["Painting", "Miniature Painting", "Drawing and Watercolor"],):
        last = 0
        while True:
            must = [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}},
                    {"terms": {"artwork_type_title.keyword": types}},
                    {"terms": {"department_title.keyword": DEPTS[:4] + DEPTS[7:]}},
                    {"range": {"id": {"gt": last}}}]
            r = C.fetch("aic", "https://api.artic.edu/api/v1/artworks/search",
                        data={"query": {"bool": {"must": must}}, "fields": C.AIC_FIELDS, "limit": 100, "page": 1,
                              "sort": [{"id": "asc"}]})
            rows += r["data"]
            print("aic nw:", len(rows), "of", r["pagination"]["total"] + len(rows) - len(r["data"]), flush=True)
            if len(r["data"]) < 100:
                break
            last = r["data"][-1]["id"]
    cache.write_text(json.dumps(rows))
pre, out = {}, []
sel = {x["id"] for x in C.select("aic", rows)}
for x in rows:
    if x["id"] not in sel:
        pre["text page / group cap / hand-listed non-painting"] = pre.get("text page / group cap / hand-listed non-painting", 0) + 1
        continue
    r = C.norm_record("aic", x)
    r["co"] = r.get("co") or country(x.get("place_of_origin"), x.get("artist_display"))
    r["license"] = "CC0"
    r["url"] = "https://www.artic.edu/artworks/%s" % x["id"]
    out.append(r)
emit("aic-nw", out, pre_drops=pre, extra_stats=dict(api_total=len(rows)))
