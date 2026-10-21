"""Phase 2: painter-level Wikidata. Runs after p1_paintings.py.

 a. painter QID per label: majority P170 creator over the label's QID rows (confidence = share of votes);
 b. labels with no QID rows: exact en label (then en alias) in SPARQL VALUES chunks, accepted only when ONE person with an
    artist occupation survives a date-plausibility test against the painter's own painting years;
 c. wbgetentities for every resolved painter (birth place P19, citizenship P27, movement P135, P569/P570, gender P21);
 d. places -> countries (climbing P131 when P17 is only a historical state), country/movement labels.
Caches in the scratchpad: lab2q.jsonl, painters.jsonl, places.jsonl, labels.jsonl.
"""
import json, re, sys, collections
from wd import *

rows = json.load(open(SCR + "/rows.json"))
paint = jl_load("paint.jsonl")
ARTIST_OCC = ["Q1028181", "Q1281618", "Q1925963", "Q329439", "Q15296811", "Q11569986", "Q5322166", "Q483501", "Q1209498",
              "Q17307272", "Q42973", "Q16947657", "Q18074503", "Q1114448", "Q3391743", "Q4610556", "Q644687", "Q10862983",
              "Q4964182", "Q3665646", "Q2526255", "Q33231", "Q1371925", "Q6625963", "Q14467526"]

# ---- a. majority creator per label
by_label = collections.defaultdict(list)       # label -> rows
for r in rows:
    if r["a"]: by_label[r["a"]].append(r)
votes = collections.defaultdict(collections.Counter)
for lab, rs in by_label.items():
    for r in rs:
        if r["id"].startswith("commons-Q"):
            p = paint.get(r["id"][8:])
            if p and not p.get("missing"):
                for c in set(p["cr"]): votes[lab][c] += 1
lab2q = {}
for lab, rs in by_label.items():
    v = votes.get(lab)
    if v:
        q, n = v.most_common(1)[0]
        tot = sum(1 for r in rs if r["id"].startswith("commons-Q"))
        lab2q[lab] = dict(q=q, via="creator", conf=round(n / max(1, tot), 2), n=n)
print(len(by_label), "painter labels;", len(lab2q), "resolved by creator vote", flush=True)


# ---- b. label match for the rest
def yrs(rs): return [r["y"] for r in rs if r["y"]]


lm = jl_load("lab2q.jsonl")
todo = [l for l in by_label if l not in lab2q and l not in lm]
print(len(todo), "labels to match by name", flush=True)


def _yr(v):
    m = re.match(r"([+-]?\d+)-", v)
    return int(m.group(1)) if m else None


def esc(s): return s.replace("\\", "\\\\").replace('"', '\\"')


occ = " ".join("wd:" + o for o in ARTIST_OCC)
for i in range(0, len(todo), 60):
    ch = todo[i:i + 60]
    vals = " ".join('"%s"@en' % esc(l) for l in ch)
    found = collections.defaultdict(dict)
    for kind in ("rdfs:label", "skos:altLabel"):
        try:
            b = sparql("SELECT ?l ?p ?b ?d ?sl WHERE { VALUES ?l { %s } ?p %s ?l ; wdt:P31 wd:Q5 ; wdt:P106 ?o . VALUES ?o { %s } "
                       "OPTIONAL{?p wdt:P569 ?b} OPTIONAL{?p wdt:P570 ?d} ?p wikibase:sitelinks ?sl }" % (vals, kind, occ))
        except Exception as e:
            print("sparql fail", e, flush=True); b = []
        for x in b:
            lab = x["l"]["value"]; q = x["p"]["value"].rsplit("/", 1)[1]
            by = _yr(x["b"]["value"]) if "b" in x else None
            dy = _yr(x["d"]["value"]) if "d" in x else None
            found[lab][q] = (by, dy, int(x["sl"]["value"]), kind)
        if all(l in found for l in ch): break
    for lab in ch:
        cands = found.get(lab, {})
        ys = yrs(by_label[lab]); ok = []
        for q, (by, dy, sl, kind) in cands.items():
            if ys and by is not None:
                hi = (dy if dy else by + 90) + 40
                good = sum(1 for y in ys if by + 5 <= y <= hi) / len(ys)
                if good < 0.7: continue
            ok.append((q, sl, kind))
        if len(ok) == 1: res = dict(q=ok[0][0], via="label-" + ok[0][2].split(":")[1], conf=0.7)
        elif len(ok) > 1:
            ok.sort(key=lambda t: -t[1])
            res = dict(q=ok[0][0], via="label-ambiguous", conf=0.4, alt=[o[0] for o in ok[1:4]]) if ok[0][1] >= 2 * ok[1][1] + 5 else dict(q=None, via="ambiguous", cands=[o[0] for o in ok[:5]])
        else: res = dict(q=None, via="nomatch")
        jl_add("lab2q.jsonl", lab, res); lm[lab] = res
    print("label chunk", i, "/", len(todo), flush=True)
for l, r in lm.items():
    if r.get("q"): lab2q[l] = r
json.dump(lab2q, open(SCR + "/lab2q.json", "w"), ensure_ascii=False)
print(len(lab2q), "painter labels with a QID", flush=True)

# ---- c. painter entities
P = jl_load("painters.jsonl")
pq = sorted({v["q"] for v in lab2q.values()}, key=lambda q: int(q[1:]))
need = [q for q in pq if q not in P]
print(len(pq), "painter QIDs,", len(need), "to fetch", flush=True)
for i in range(0, len(need), 50):
    ch = need[i:i + 50]; ents = entities(ch)
    for q in ch:
        e = ents.get(q)
        if not e or "missing" in e: v = {"missing": 1}
        else:
            v = dict(b=[list(t) for t in years(e, "P569")], d=[list(t) for t in years(e, "P570")],
                     pob=[x for x, c in qids(e, "P19")], cit=[x for x, c in qids(e, "P27") if not has_end(c)] or [x for x, c in qids(e, "P27")],
                     mv=[x for x, _ in qids(e, "P135")], sex=[x for x, _ in qids(e, "P21")],
                     occ=[x for x, _ in qids(e, "P106")][:6])
        jl_add("painters.jsonl", q, v); P[q] = v
    if (i // 50) % 10 == 0: print("painters", i, flush=True)

# ---- d. places -> countries
PL = jl_load("places.jsonl")


def fetch_generic(ids, cache, keep):
    need = [q for q in ids if q not in cache]
    for i in range(0, len(need), 50):
        ch = need[i:i + 50]; ents = entities(ch, props="claims|labels")
        for q in ch:
            e = ents.get(q)
            if not e or "missing" in e: v = {"missing": 1}
            else: v = keep(e)
            jl_add("places.jsonl", q, v); cache[q] = v


def keep_place(e):
    return dict(l=(e.get("labels", {}).get("en") or {}).get("value"),
                c=[[x, int(has_end(c))] for x, c in qids(e, "P17")],
                adm=[[x, int(has_end(c))] for x, c in qids(e, "P131")],
                diss=int(bool(claims(e, "P576"))), inst=[x for x, _ in qids(e, "P31")][:8], cty=[x for x, _ in qids(e, "P30")][:2])


need = set()
for v in P.values():
    need.update(v.get("pob", [])); need.update(v.get("cit", []))
for p in paint.values(): need.update(p.get("co", []))
fetch_generic(sorted(need), PL, keep_place)
print("places done", len(PL), flush=True)
# climb: country entities and admin parents
for rnd in range(4):
    extra = set()
    for q, v in list(PL.items()):
        if v.get("missing"): continue
        for x, _ in v["c"]: extra.add(x)
        if not any(not e for _, e in v["c"]):       # no current country: need the admin parent
            for x, _ in v["adm"]: extra.add(x)
    extra = [x for x in extra if x not in PL]
    if not extra: break
    fetch_generic(sorted(extra), PL, keep_place)
    print("climb round", rnd, len(extra), flush=True)

LB = jl_load("labels.jsonl")
mvq = set()
for p in paint.values():
    for k in ("mv", "gen", "coll"): mvq.update(p.get(k, []))
for v in P.values(): mvq.update(v.get("mv", []))
need = [q for q in sorted(mvq, key=lambda q: int(q[1:])) if q not in LB]
print(len(need), "labels to fetch (movement/genre/collection)", flush=True)
for i in range(0, len(need), 50):
    ch = need[i:i + 50]
    ents = get(API, dict(action="wbgetentities", ids="|".join(ch), props="labels", languages="en", format="json", maxlag=5)).get("entities", {})
    for q in ch:
        l = (ents.get(q, {}).get("labels", {}).get("en") or {}).get("value")
        jl_add("labels.jsonl", q, l); LB[q] = l
print("done")
