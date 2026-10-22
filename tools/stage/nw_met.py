"""Met non-Western painting staging (the Asian / Islamic / Africa-Oceania-Americas rows tools/stage/met.py set aside).
Candidates: Open Access CSV, public domain, Met painting classes, in the NON_WESTERN departments. Records come from the
shared cache $STAGE_SCRATCH/met_objects*.jsonl (filled by tools/stage/met.py) plus a fetch of what is still missing
(1 request/s, 403 -> cool down). Output: data/corpus-staging/zz-museum-met-asia-1.json.
  python3 tools/stage/nw_met.py fetch   # fill the cache (MET_MINUTES=40 deadline)
  python3 tools/stage/nw_met.py         # stage"""
import csv
import json
import os
import sys
import time
import urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nw import C, SCR, country, emit  # noqa: E402

M = C.ADAPTERS["met"]
C.SRC["met"]["gap"] = 0.0
NW_DEPT = {"Asian Art", "Islamic Art", "Arts of Africa, Oceania, and the Americas", "The Michael C. Rockefeller Wing"}
csv.field_size_limit(sys.maxsize)
cands, total_pd = [], 0
with open(SCR / "MetObjects.csv", newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r.get("Is Public Domain") == "True" and r.get("Department") in NW_DEPT and \
                M.is_painting(r.get("Classification") or "", r.get("Object Name")):
            cands.append(int(r["Object ID"]))
print(f"met nw: {len(cands)} public-domain painting-class objects in {sorted(NW_DEPT)}", flush=True)
have = {}
for q in (SCR / "met_objects.jsonl", SCR / "met_objects_b.jsonl", SCR / "met_objects_nw.jsonl"):
    if q.exists():
        for line in q.read_text().splitlines():
            try:
                x = json.loads(line)
                have[x["objectID"]] = x
            except Exception:
                pass
todo = [i for i in cands if i not in have]
print(f"met nw: {len(have)} cached, {len(todo)} to fetch", flush=True)

if len(sys.argv) > 1 and sys.argv[1] == "fetch":
    deadline = time.time() + float(os.environ.get("MET_MINUTES", "40")) * 60
    gap, n = 1.0, 0
    out = (SCR / "met_objects_nw.jsonl").open("a")
    for oid in todo:
        rec = None
        while time.time() < deadline and rec is None:
            time.sleep(gap)
            try:
                r = C.fetch("met", f"{M.API}/v1/objects/{oid}", tries=1)
                rec = {k: r.get(k) for k in M.FIELDS}
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    rec = {"objectID": oid, "_missing": True}
                else:
                    print(f"HTTP {e.code} on {oid} after {n}; cooling 5 min", flush=True)
                    gap = min(3.0, gap * 1.25)
                    time.sleep(300 if e.code in (403, 429) else 5)
            except Exception as e:
                print("err", oid, type(e).__name__, e, flush=True)
                time.sleep(5)
        if rec is None:
            break
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
        n += 1
        if n % 100 == 0:
            out.flush()
            print(f"fetched {n}", flush=True)
    out.flush()
    print(f"met nw: fetched {n}", flush=True)
    sys.exit(0)

pre, rows = {}, []
for oid in cands:
    x = have.get(oid)
    if x is None:
        pre["record not fetched"] = pre.get("record not fetched", 0) + 1
    elif x.get("_missing"):
        pre["404 in API"] = pre.get("404 in API", 0) + 1
    elif not x.get("isPublicDomain"):
        pre["API says not public domain"] = pre.get("API says not public domain", 0) + 1
    elif not x.get("primaryImageSmall"):
        pre["no primary image"] = pre.get("no primary image", 0) + 1
    else:
        x = dict(x, id=x["objectID"])
        ttl = x.get("title") or ""
        if C.TEXT_PAGE.search(ttl):
            pre["text/calligraphy page"] = pre.get("text/calligraphy page", 0) + 1
            continue
        rows.append(x)
sel = {x["id"] for x in C.select("met", rows)}
out = []
for x in rows:
    if x["id"] not in sel:
        pre["group cap / hand-listed non-painting"] = pre.get("group cap / hand-listed non-painting", 0) + 1
        continue
    r = C.norm_record("met", x)
    r["co"] = r.get("co") or country(x.get("country"), x.get("culture"), x.get("region"), x.get("period"),
                                     x.get("artistNationality"))
    r["license"] = "CC0"
    r["url"] = x.get("objectURL")
    out.append(r)
# met-1 (the older Western/American file) still carries Asian Art rows from an early unfiltered run; keep those ids here too
emit("met-asia", out, pre_drops=pre, skip_files=("zz-museum-met-1.json",), extra_stats=dict(api_total=len(cands)))
