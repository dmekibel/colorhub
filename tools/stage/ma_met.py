"""Met Open Access, paintings dated before 1500 in every department (Asian scrolls/panels, Greek+Roman wall paintings and
Fayum-type panels, Cloisters/Medieval panels and frescoes, Egyptian and West Asian wall paintings). CC0. Ids met-<objectID>,
img = primaryImageSmall. Candidates from MetObjects.csv; records from the shared cache or the API at 1 request/s.
  python3 tools/stage/ma_met.py"""
import csv, json, re, sys, time, urllib.error
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ma_common as M
from ma_common import C, SCR
from nw import country

MA = C.ADAPTERS["met"]
csv.field_size_limit(sys.maxsize)
C.SRC["met"]["gap"] = 0.0
BAD = re.compile(r"textile|ceramic|glass|enamel|woodwork|stucco$|furniture|stone sculpture|metal|ivory|mosaic|vase|coin", re.I)
GOOD = re.compile(r"painting|fresco|icon", re.I)
cands, seen = [], Counter()
for r in csv.DictReader(open(SCR / "MetObjects.csv", newline="", encoding="utf-8-sig")):
    if r["Is Public Domain"] != "True":
        continue
    try:
        b, e = int(r["Object Begin Date"]), int(r["Object End Date"])
    except ValueError:
        continue
    if e > 1499 or e - b > 200 or e < -3500:
        continue
    cl = r["Classification"] or ""
    nm = r["Object Name"] or ""
    if BAD.search(cl) or not (GOOD.search(cl) or re.search(r"wall painting|fresco|mummy portrait|panel painting|icon", nm, re.I)):
        continue
    cands.append(int(r["Object ID"]))
    seen[(r["Department"], cl)] += 1
print("met pre-1500 candidates:", len(cands), seen.most_common(12), flush=True)

have = {}
for q in ("met_objects.jsonl", "met_objects_b.jsonl", "met_objects_nw.jsonl", "met_objects_pre1500.jsonl"):
    if (SCR / q).exists():
        for line in (SCR / q).read_text().splitlines():
            try:
                x = json.loads(line)
                have[x["objectID"]] = x
            except Exception:
                pass
todo = [i for i in cands if i not in have]
print(len(have), "cached;", len(todo), "to fetch", flush=True)
out = (SCR / "met_objects_pre1500.jsonl").open("a")
gap, n = 1.0, 0
for oid in todo:
    rec = None
    for _ in range(4):
        time.sleep(gap)
        try:
            r = C.fetch("met", f"{MA.API}/v1/objects/{oid}", tries=1)
            rec = {k: r.get(k) for k in MA.FIELDS}
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                rec = {"objectID": oid, "_missing": True}
                break
            print(f"HTTP {e.code} on {oid}; cooling 3 min", flush=True)
            gap = min(3.0, gap * 1.25)
            time.sleep(180)
        except Exception as e:
            time.sleep(5)
    if rec is None:
        print("giving up on met fetch at", oid, flush=True)
        break
    out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    have[oid] = rec
    n += 1
    if n % 100 == 0:
        out.flush()
        print("fetched", n, flush=True)
out.flush()

held = M.Held("met")
drops, rows = Counter(), []
for oid in cands:
    x = have.get(oid)
    if not x or x.get("_missing"):
        drops["record missing"] += 1
        continue
    if not x.get("isPublicDomain") or not x.get("primaryImageSmall"):
        drops["no public-domain image"] += 1
        continue
    rid = f"met-{oid}"
    if rid in held.ids:
        drops["already held (id)"] += 1
        continue
    t = C.clean_title(x.get("title") or "")
    if not t or re.fullmatch(r"\[?(untitled|unknown)\]?", t, re.I):
        drops["no usable title"] += 1
        continue
    if C.TEXT_PAGE.search(t):
        drops["text page"] += 1
        continue
    y, e = x.get("objectBeginDate"), x.get("objectEndDate")
    if y is None or e is None or e - y > 200:
        drops["date span over 200 years"] += 1
        continue
    a = x.get("artistDisplayName") or None
    a = C.clean_artist(a) if a and not re.search(r"unknown|anonymous|workshop|school", a, re.I) else None
    co = country(x.get("country"), x.get("culture"), x.get("region"), x.get("period"), x.get("artistNationality"), x.get("objectName"))
    r = dict(id=rid, src="met", t=t, a=a, y=y, span=e - y, co=co, mv=None, img=x["primaryImageSmall"], license="CC0", url=x.get("objectURL"))
    if M.fname(r["img"]) in held.files:
        drops["image already held"] += 1
        continue
    if held.twin(r):
        drops["artist+title+year twin"] += 1
        continue
    held.add(r)
    rows.append(r)
files = M.write("met", rows)
st = dict(source="Met", candidates=len(cands), new=len(rows), drops=dict(drops), files=files)
print(json.dumps(st), flush=True)
(SCR / "stats" / "ma-met.json").write_text(json.dumps(st, indent=1))
