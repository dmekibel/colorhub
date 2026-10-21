"""Met staging. Candidate ids come from the Open Access CSV (public domain + classification Paintings / American Wing
"Painting" object name, every department), minus ids already held; each one's record (and image URL) comes from
/public/collection/v1/objects/{id}, cached in scratch as met_objects.jsonl. 403 (the Imperva shield) -> back off."""
import csv
import json
import subprocess
import sys
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, SCR, Held, stage  # noqa: E402

M = C.ADAPTERS["met"]
API = M.API
csv_p = SCR / "MetObjects.csv"
if not csv_p.exists():
    subprocess.run(["curl", "-sL", "-A", C.UA, "-o", str(csv_p), M.CSV_URL], check=True)
csv.field_size_limit(sys.maxsize)
C.SRC["met"]["gap"] = 0.0  # pacing is done below
held = Held()
cands, total_pd, n_csv, held_pre, set_aside = [], 0, 0, 0, 0
# Departments whose "Paintings" are not Western (Asian scrolls and screens, Islamic, Egyptian, Africa/Oceania/Americas)
NON_WESTERN = {"Asian Art", "Islamic Art", "Egyptian Art", "Ancient West Asian Art", "Musical Instruments",
               "Arts of Africa, Oceania, and the Americas"}
with open(csv_p, newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        n_csv += 1
        if r.get("Is Public Domain") == "True" and M.is_painting(r.get("Classification") or "", r.get("Object Name")):
            total_pd += 1
            oid = int(r["Object ID"])
            if f"met-{oid}" in held.ids:
                held_pre += 1
            elif r.get("Department") in NON_WESTERN:
                set_aside += 1
            else:
                cands.append(oid)
print(f"met: CSV {n_csv} objects, {total_pd} public-domain paintings, {len(cands)} not held", flush=True)

import os
REV = bool(os.environ.get("MET_REVERSE"))
obj_p = SCR / ("met_objects_b.jsonl" if REV else "met_objects.jsonl")
have = {}
for q in (SCR / "met_objects.jsonl", SCR / "met_objects_b.jsonl"):
  if q.exists():
    for line in q.read_text().splitlines():
        try:
            x = json.loads(line)
            have[x["objectID"]] = x
        except Exception:
            pass
todo = [i for i in cands if i not in have]
if REV:
    todo.reverse()
print(f"met: {len(have)} cached, {len(todo)} to fetch", flush=True)
lock, out = threading.Lock(), obj_p.open("a")
state = dict(n=0, gap=0.25, bad=0)
last = [0.0]


import os
DEADLINE = time.time() + float(os.environ.get("MET_MINUTES", "75")) * 60
state["gap"] = 1.0


def get(oid):
    while time.time() < DEADLINE:
        time.sleep(state["gap"])
        try:
            r = C.fetch("met", f"{API}/v1/objects/{oid}", tries=1)
            return {k: r.get(k) for k in M.FIELDS}
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {"objectID": oid, "_missing": True}
            print(f"met: HTTP {e.code} on {oid} after {state['n']} this run; cooling down 5 min, gap {state['gap']:.2f}", flush=True)
            if e.code in (403, 429):
                state["gap"] = min(3.0, state["gap"] * 1.25)
                time.sleep(300)
            else:
                time.sleep(5)
        except Exception as e:
            print(f"met: {oid} {type(e).__name__} {e}", flush=True)
            time.sleep(5)
    return None


for oid in todo:
    rec = get(oid)
    if rec is None:
        break
    out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    have[oid] = rec
    state["n"] += 1
    if state["n"] % 100 == 0:
        out.flush()
        print(f"met: {state['n']} fetched this run, {len(have)} cached of {len(cands)}", flush=True)
out.flush()
print(f"met: fetched {state['n']}, failed {state['bad']}", flush=True)

if REV:
    sys.exit(0)  # fetch only; the forward run stages
raw, pre = [], {}
for oid in cands:
    x = have.get(oid)
    if x is None:
        pre["record not fetched (API refused)"] = pre.get("record not fetched (API refused)", 0) + 1
    elif x.get("_missing"):
        pre["404 in API"] = pre.get("404 in API", 0) + 1
    elif not x.get("isPublicDomain"):
        pre["API says not public domain"] = pre.get("API says not public domain", 0) + 1
    elif not x.get("primaryImageSmall"):
        pre["no primary image"] = pre.get("no primary image", 0) + 1
    else:
        raw.append(dict(x, id=x["objectID"]))
stage("met", total_pd, raw, lambda x: C.norm_record("met", x), "CC0", lambda x: x.get("objectURL"),
      dict(pre, **({"non-Western department (Asian Art, Islamic, Egyptian, Africa/Oceania/Americas)": set_aside}
                   if set_aside else {})), held_pre=held_pre)
