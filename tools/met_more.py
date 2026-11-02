#!/usr/bin/env python3
"""Second Met Asia/Islamic pass (2026-10-29): same selection and row format as met_asia_extra.py, minus everything
already in any corpus shard (including zz-met-asia-1). Writes data/corpus/zz-met-asia-2.json atomically (tmp in
research/_scratch-met2/, renamed only when complete or at the 02:45 cutoff). Records cached in research/_scratch-met2/objects.jsonl.
  python3 tools/met_more.py [--status]"""
import glob, json, sys, time, datetime, urllib.request, urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import met_asia_extra as M

ROOT = M.ROOT
SCR = ROOT / "research" / "_scratch-met2"; SCR.mkdir(parents=True, exist_ok=True)
TMP = SCR / "zz-met-asia-2.json.tmp"
FINAL = ROOT / "data" / "corpus" / "zz-met-asia-2.json"
M.SCR, M.OUT, M.GAP = SCR, TMP, 0.6
CUT = datetime.time(2, 45)


def held_ids():
    ids = set()
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        if f.endswith("zz-met-asia-2.json"):
            continue
        try:
            ids |= {r["id"] for r in json.load(open(f)) if str(r.get("id", "")).startswith("met-")}
        except Exception:
            pass
    return ids


def past_cut():
    n = datetime.datetime.now()
    return datetime.time(2, 45) <= n.time() < datetime.time(12, 0)


def get_record(oid, gap):
    if past_cut():
        return None
    for n in range(6):
        time.sleep(gap)
        try:
            req = urllib.request.Request(M.API + str(oid), headers={"User-Agent": M.UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
            return {k: d.get(k) for k in M.FIELDS}
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {"objectID": oid, "_missing": True}
            wait = 60 if e.code in (403, 429) else 10
            print(f"HTTP {e.code} on {oid}; cooling {wait}s", flush=True)
            time.sleep(wait)
        except Exception as e:
            print("err", oid, type(e).__name__, flush=True)
            time.sleep(5 * (n + 1))
    return None


M.held_ids, M.get_record = held_ids, get_record
if __name__ == "__main__":
    M.main()
    if "--status" not in sys.argv and TMP.exists():
        TMP.replace(FINAL)
        print("renamed ->", FINAL, flush=True)
