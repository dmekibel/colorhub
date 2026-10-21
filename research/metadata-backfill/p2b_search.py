"""Phase 2b: second chance for painter labels that p2 could not match (spelling variants, "Last, First", titles like "Sir").
wbsearchentities (en, 7 hits) on a cleaned name -> fetch the hits -> keep a human with an artist occupation whose life fits the
painter's painting years. Writes the answers into lab2q.jsonl (a later line wins); re-run p2_painters.py afterwards."""
import json, re, collections, unicodedata
from wd import *

rows = json.load(open(SCR + "/rows.json"))
lm = jl_load("lab2q.jsonl")
byq = json.load(open(SCR + "/lab2q.json"))
by_label = collections.defaultdict(list)
for r in rows:
    if r["a"]: by_label[r["a"]].append(r)
ARTIST_OCC = {"Q1028181", "Q1281618", "Q1925963", "Q329439", "Q15296811", "Q11569986", "Q5322166", "Q483501", "Q1209498", "Q17307272",
              "Q42973", "Q16947657", "Q18074503", "Q1114448", "Q3391743", "Q4610556", "Q644687", "Q10862983", "Q4964182", "Q3665646",
              "Q2526255", "Q33231", "Q1371925", "Q6625963", "Q14467526", "Q1393564", "Q10871364", "Q42603", "Q2259451"}
SKIP = re.compile(r"^(master of|workshop|school of|follower|circle of|attributed|manner of|after |unknown|anonymous|studio of|imitator|copy)", re.I)


def clean(l):
    l = re.sub(r"\s*\(.*?\)\s*", " ", l).strip()
    if "," in l and l.count(",") == 1:
        a, b = [x.strip() for x in l.split(",")]
        if a and b and len(b.split()) <= 3: l = b + " " + a
    l = re.sub(r"^(sir|dame|dr\.?|saint|st\.?|lord|baron|count|comte|abbé)\s+", "", l, flags=re.I)
    return re.sub(r"\s+", " ", l).strip()


todo = [l for l in by_label if l not in byq and not SKIP.search(l)]
# also painters resolved only weakly (ambiguous) get a retry
todo += [l for l in by_label if lm.get(l, {}).get("via") == "label-ambiguous" and l not in todo]
print(len(todo), "labels to search", flush=True)
cache = jl_load("search.jsonl")
for k, l in enumerate(todo):
    if l in cache: continue
    d = get(API, dict(action="wbsearchentities", search=clean(l), language="en", type="item", limit=7, format="json", maxlag=5))
    cache[l] = [x["id"] for x in d.get("search", [])]; jl_add("search.jsonl", l, cache[l])
    if k % 100 == 0: print("search", k, flush=True)
_have = jl_load("cand.jsonl")
need = sorted({q for v in cache.values() for q in v if q not in _have}, key=lambda q: int(q[1:]))
print(len(need), "candidate entities", flush=True)
for i in range(0, len(need), 50):
    ch = need[i:i + 50]; ents = entities(ch)
    for q in ch:
        e = ents.get(q, {})
        if not e or "missing" in e: v = {"x": 1}
        else:
            v = dict(h=int(any(x == "Q5" for x, _ in qids(e, "P31"))), occ=[x for x, _ in qids(e, "P106")],
                     b=years(e, "P569")[:1], d=years(e, "P570")[:1], sl=len(e.get("sitelinks", {})) if "sitelinks" in e else 0)
        jl_add("cand.jsonl", q, v)
CAND = jl_load("cand.jsonl")
hit = 0
for l in todo:
    ys = [r["y"] for r in by_label[l] if r["y"]]
    ok = []
    for q in cache.get(l, []):
        c = CAND.get(q)
        if not c or c.get("x") or not c["h"] or not (set(c["occ"]) & ARTIST_OCC): continue
        b = c["b"][0][0] if c["b"] else None; d = c["d"][0][0] if c["d"] else None
        if ys and b is not None:
            hi = (d if d else b + 90) + 40
            if sum(1 for y in ys if b + 5 <= y <= hi) / len(ys) < 0.7: continue
        ok.append(q)
    if ok:
        # the first search hit that passes is the best-ranked one; a lone survivor is stronger
        res = dict(q=ok[0], via="search", conf=0.65 if len(ok) == 1 else 0.5)
        if len(ok) > 1: res["alt"] = ok[1:3]
        jl_add("lab2q.jsonl", l, res); hit += 1
print("matched by search:", hit, "of", len(todo))
