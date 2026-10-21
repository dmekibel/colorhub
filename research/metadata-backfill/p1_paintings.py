"""Phase 1: painting-level Wikidata facts for every row that holds a QID (wbgetentities, 50 per request, cached).
Cache: scratchpad paint.jsonl  {qid: {cr:[creator qids], inc:[[year,prec]], mv:[qids], co:[qids], coll:[qids], gen:[qids]}}"""
import json, re, sys
from wd import *

rows = json.load(open(SCR + "/rows.json"))
qs = sorted({r["id"][8:] for r in rows if re.match(r"commons-Q\d+$", r["id"])}, key=lambda q: int(q[1:]))
done = jl_load("paint.jsonl")
import os
todo = [q for q in qs if q not in done]
REV = os.environ.get("REV")
if REV: todo = todo[::-1]
print(len(qs), "QIDs,", len(todo), "to fetch,", (len(todo) + 49) // 50, "requests", flush=True)
for i in range(0, len(todo), 50):
    ch = todo[i:i + 50]
    if REV and (i // 50) % 5 == 0:
        d2 = jl_load("paint.jsonl")
        if all(q in d2 for q in ch): print("met the other worker"); break
    ents = entities(ch)
    for q in ch:
        e = ents.get(q)
        if not e or "missing" in e:
            v = {"missing": 1}
        else:
            v = dict(cr=[x for x, _ in qids(e, "P170")], inc=[list(t) for t in years(e, "P571")],
                     mv=[x for x, _ in qids(e, "P135")], co=[x for x, _ in qids(e, "P495")],
                     coll=[x for x, _ in qids(e, "P195")], gen=[x for x, _ in qids(e, "P136")])
            # creator "unknown/anonymous" is a somevalue snak (skipped above)
        jl_add("paint.jsonl", q, v)
    if (i // 50) % 20 == 0: print(i, "/", len(todo), flush=True)
print("done")
