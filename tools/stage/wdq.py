"""Polite Wikidata client with an on-disk cache (cache lives in $STAGE_SCRATCH/wdcache; delete it when done).
One request at a time, >= 1.5 s apart, descriptive User-Agent, maxlag=5 on the action API. No image is ever downloaded."""
import hashlib
import json
import os
import sys
import time
import warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
warnings.filterwarnings("ignore")
import requests  # noqa: E402
from lib import SCR  # noqa: E402

CACHE = SCR / "wdcache"
CACHE.mkdir(parents=True, exist_ok=True)
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) python-requests"
sess = requests.Session()
sess.headers["User-Agent"] = UA
_last = [0.0]


def _wait(gap):
    d = time.time() - _last[0]
    if d < gap:
        time.sleep(gap - d)
    _last[0] = time.time()


def _key(kind, payload):
    return CACHE / (kind + "-" + hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest() + ".json")


def sparql(q, gap=1.5, tries=5):
    k = _key("sp", q)
    if k.exists():
        return json.load(open(k))
    for t in range(tries):
        _wait(gap)
        try:
            r = sess.post("https://query.wikidata.org/sparql", data={"query": q, "format": "json"}, timeout=130)
        except Exception as e:
            print("  sparql err", e, flush=True)
            time.sleep(10 * (t + 1))
            continue
        if r.status_code == 200:
            try:
                j = r.json()
            except Exception:
                time.sleep(5)
                continue
            json.dump(j, open(k, "w"))
            return j
        ra = r.headers.get("Retry-After")
        print("  sparql", r.status_code, r.text[:100].replace("\n", " "), flush=True)
        if r.status_code == 500 or "timeout" in r.text.lower():
            return {"error": r.status_code, "text": r.text[:300]}
        time.sleep(int(ra) if ra and ra.isdigit() else 20 * (t + 1))
    return {"error": "gaveup"}


def api(params, gap=1.2, tries=5):
    params = dict(params, format="json", maxlag=5)
    k = _key("api", params)
    if k.exists():
        return json.load(open(k))
    for t in range(tries):
        _wait(gap)
        try:
            r = sess.get("https://www.wikidata.org/w/api.php", params=params, timeout=90)
        except Exception as e:
            print("  api err", e, flush=True)
            time.sleep(10 * (t + 1))
            continue
        if r.status_code == 200:
            j = r.json()
            if "error" in j and j["error"].get("code") == "maxlag":
                ra = r.headers.get("Retry-After")
                time.sleep(int(ra) if ra and ra.isdigit() else 6)
                continue
            json.dump(j, open(k, "w"))
            return j
        ra = r.headers.get("Retry-After")
        time.sleep(int(ra) if ra and ra.isdigit() else 15 * (t + 1))
    return {"error": "gaveup"}


def labels(qids, langs="en|fr|de|es|it|nl|pt|ja|zh|ru"):
    """{qid: label} via wbgetentities, 50 per call, English first then any language."""
    out, qids = {}, sorted(set(qids))
    for i in range(0, len(qids), 50):
        j = api({"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "labels", "languages": langs})
        for q, e in (j.get("entities") or {}).items():
            lab = e.get("labels") or {}
            v = (lab.get("en") or next(iter(lab.values()), {})).get("value") if lab else None
            out[q] = v
    return out


def rows(j):
    return j.get("results", {}).get("bindings", []) if j else []


def val(b, k):
    return b[k]["value"] if k in b else None


def qid(uri):
    return uri.rsplit("/", 1)[1] if uri else None
