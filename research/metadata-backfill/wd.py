"""Shared Wikidata helpers for the metadata backfill (phase 1: fetch and prepare; touches nothing under data/)."""
import json, os, sys, time, threading
import requests

UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) python-requests"
API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"
SCR = os.environ.get("BF_SCRATCH", "/private/tmp/claude-503/-Users-david-Documents-claudeCode-colorhub/39435604-0b2d-422b-8d32-1f4c8f058381/scratchpad")
os.makedirs(SCR, exist_ok=True)
S = requests.Session(); S.headers["User-Agent"] = UA
_lock = threading.Lock(); _last = [0.0]; GAP = 0.6


def _pace():
    with _lock:
        w = _last[0] + GAP - time.time()
        if w > 0: time.sleep(w)
        _last[0] = time.time()


def get(url, params, tries=8):
    for i in range(tries):
        _pace()
        try:
            r = S.get(url, params=params, timeout=90)
        except requests.RequestException:
            time.sleep(5 * (i + 1)); continue
        if r.status_code in (429, 503) or (r.status_code == 200 and url == API and r.text[:80].startswith('{"error"')):
            ra = r.headers.get("Retry-After")
            time.sleep(min(120, float(ra) if ra and ra.replace('.', '').isdigit() else 10 * (i + 1))); continue
        if r.status_code != 200:
            time.sleep(5 * (i + 1)); continue
        return r.json()
    raise RuntimeError("giving up " + url + str(params)[:100])


def entities(ids, props="claims"):
    d = get(API, dict(action="wbgetentities", ids="|".join(ids), props=props, format="json", maxlag=5))
    return d.get("entities", {})


def sparql(q):
    return get(SPARQL, dict(query=q, format="json"))["results"]["bindings"]


def claims(e, p):
    return e.get("claims", {}).get(p, [])


def qids(e, p):
    out = []
    for c in claims(e, p):
        if c.get("rank") == "deprecated": continue
        s = c["mainsnak"]
        if s.get("snaktype") == "value" and s.get("datatype") == "wikibase-item":
            out.append((s["datavalue"]["value"]["id"], c))
    return out


def has_end(c):
    q = c.get("qualifiers", {})
    return "P582" in q or "P8554" in q


def years(e, p):
    """[(year, precision)] for a time property."""
    out = []
    for c in claims(e, p):
        if c.get("rank") == "deprecated": continue
        s = c["mainsnak"]
        if s.get("snaktype") != "value": continue
        v = s["datavalue"]["value"]
        t = v["time"]
        try: y = int(t[1:t.index("-", 1)])
        except Exception: continue
        if t[0] == "-": y = -y
        out.append((y, v.get("precision", 0)))
    return out


def jl_load(name):
    p = os.path.join(SCR, name); d = {}
    if os.path.exists(p):
        for l in open(p):
            try: o = json.loads(l); d[o["k"]] = o["v"]
            except Exception: pass
    return d


def jl_add(name, k, v):
    with open(os.path.join(SCR, name), "a") as f: f.write(json.dumps({"k": k, "v": v}, ensure_ascii=False) + "\n")
