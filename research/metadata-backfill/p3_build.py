"""Phase 3: assemble painters.json, paintings.json and projection.json from the cached Wikidata pulls (no network).
Policy (kept from the coverage audit): country = the painter's BIRTH country (P19 -> P17, mapped to the modern country),
falling back to citizenship (P27); the app's existing 46-country names are never relabeled, new countries only get
their plain English name."""
import json, re, sys, os, collections
from wd import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT + "/tools")
from wikidata_artists import fold_movement  # noqa: E402

OUT = os.path.dirname(os.path.abspath(__file__))
rows0 = json.load(open(SCR + "/rows.json"))
seen = set(); rows = []
for r in rows0:
    if r["id"] not in seen: seen.add(r["id"]); rows.append(r)
paint = jl_load("paint.jsonl"); lab2q = json.load(open(SCR + "/lab2q.json")); lm = jl_load("lab2q.jsonl")
P = jl_load("painters.jsonl"); PL = jl_load("places.jsonl"); LB = jl_load("labels.jsonl")
fac = json.load(open(ROOT + "/data/facets/facets.json"))
APP_CO = set(fac["countries"]); APP_MV = {m.lower(): m for m in fac["movements"]}

NORM = {"Kingdom of the Netherlands": "Netherlands", "Czech Republic": "Czechia", "South Korea": "Korea", "North Korea": "Korea",
        "People's Republic of China": "China", "Russian Federation": "Russia", "United States of America": "United States",
        "Kingdom of Denmark": "Denmark", "Türkiye": "Turkey", "Republic of Ireland": "Ireland", "Republic of China": "Taiwan",
        "Kingdom of Norway": "Norway", "Kingdom of Sweden": "Sweden", "Kingdom of Spain": "Spain", "Kingdom of Belgium": "Belgium",
        "Burma": "Myanmar", "Swiss Confederation": "Switzerland", "Kingdom of Greece": "Greece", "Republic of India": "India",
        "Islamic Republic of Iran": "Iran", "Federal Republic of Germany": "Germany", "French Republic": "France",
        "Kingdom of Italy": "Italy", "Italian Republic": "Italy"}
HIST = {"Kingdom of Prussia": "Germany", "Prussia": "Germany", "German Empire": "Germany", "Weimar Republic": "Germany", "Nazi Germany": "Germany",
        "Austrian Empire": "Austria", "Austria-Hungary": "Austria", "Habsburg monarchy": "Austria", "Holy Roman Empire": "Germany",
        "Kingdom of France": "France", "First French Empire": "France", "Second French Empire": "France", "Dutch Republic": "Netherlands",
        "Kingdom of Great Britain": "United Kingdom", "Kingdom of England": "United Kingdom", "Kingdom of Scotland": "United Kingdom",
        "Russian Empire": "Russia", "Soviet Union": "Russia", "Tsardom of Russia": "Russia", "Ottoman Empire": "Turkey",
        "Kingdom of Bavaria": "Germany", "Electorate of Saxony": "Germany", "Kingdom of Saxony": "Germany", "Kingdom of Württemberg": "Germany",
        "Kingdom of Hanover": "Germany", "Kingdom of Sardinia": "Italy", "Republic of Venice": "Italy", "Papal States": "Italy",
        "Grand Duchy of Tuscany": "Italy", "Kingdom of Naples": "Italy", "Kingdom of the Two Sicilies": "Italy", "Duchy of Milan": "Italy",
        "Republic of Genoa": "Italy", "Spanish Empire": "Spain", "Crown of Castile": "Spain", "Kingdom of Hungary": "Hungary",
        "Spanish Netherlands": "Belgium", "Austrian Netherlands": "Belgium", "United Kingdom of the Netherlands": "Netherlands",
        "Kingdom of Portugal": "Portugal", "Kingdom of Poland": "Poland", "Polish–Lithuanian Commonwealth": "Poland",
        "Qing dynasty": "China", "Ming dynasty": "China", "Mughal Empire": "India", "British Raj": "India", "Empire of Japan": "Japan",
        "Tokugawa shogunate": "Japan", "Kingdom of Bohemia": "Czechia", "Czechoslovakia": "Czechia", "Kingdom of Denmark–Norway": "Denmark",
        "Denmark–Norway": "Denmark", "Swedish Empire": "Sweden", "Kingdom of Yugoslavia": None, "Yugoslavia": None}
HIST_INST = {"Q3024240", "Q19953632", "Q417175", "Q1620908", "Q28171280", "Q3624078_NOT"}
COUNTRY_INST = {"Q6256", "Q3624078", "Q3024240", "Q46395", "Q112099"}


def clabel(q):
    l = (PL.get(q) or {}).get("l")
    return NORM.get(l, l)


def is_modern(x):
    e = PL.get(x)
    if not e or e.get("missing") or e.get("diss"): return False
    return not (set(e["inst"]) & HIST_INST)


def modern_country(q, depth=0):
    """-> (country name or None, how)"""
    e = PL.get(q)
    if not e or e.get("missing"): return None, "missing"
    if set(e["inst"]) & {"Q6256", "Q3624078"} and is_modern(q): return clabel(q), "self"
    cands = [x for x, end in e["c"] if not end]
    mod = [x for x in cands if is_modern(x)]
    if mod: return clabel(mod[0]), "p17"
    if depth < 4:
        for x, end in e["adm"]:
            if end: continue
            c, how = modern_country(x, depth + 1)
            if c: return c, "p131"
    for x, end in e["c"]:
        l = (PL.get(x) or {}).get("l")
        if l in HIST: return HIST[l], "hist"
    l = e.get("l")
    if l in HIST: return HIST[l], "hist"
    return None, "none"


def ydec(lst):
    """first value with year precision, else None; returns (year, precision)"""
    for y, p in lst:
        if p >= 9: return y, p
    return (lst[0][0], lst[0][1]) if lst else (None, None)


GENDER = {"Q6581097": "male", "Q6581072": "female", "Q1097630": "intersex", "Q2449503": "trans man", "Q1052281": "trans woman"}


def fold_mv(qs):
    out = []
    for q in qs:
        l = LB.get(q)
        if not l: continue
        f = fold_movement(l)
        if f:
            f = APP_MV.get(f.lower(), f)
            if f not in out: out.append(f)
    return out


by_label = collections.defaultdict(list)
for r in rows:
    if r["a"]: by_label[r["a"]].append(r)

# ---------------- painters
painters = {}; nomatch = []
for lab, rs in by_label.items():
    ex = collections.Counter(r["co"] for r in rs if r["co"])
    rec = dict(n=len(rs))
    m = lab2q.get(lab)
    if not m or not m.get("q") or (P.get(m["q"]) or {}).get("missing"):
        info = lm.get(lab, {})
        rec.update(q=None, via=info.get("via", "nomatch"), confidence=0)
        if info.get("cands"): rec["candidates"] = info["cands"]
        painters[lab] = rec; nomatch.append((len(rs), lab)); continue
    p = P[m["q"]]
    by, bp = ydec(p["b"]); dy, dp = ydec(p["d"])
    co = how = src = None
    for q in p["pob"][:2]:
        co, how = modern_country(q)
        if co: src = "birth"; break
    if not co:
        for q in p["cit"]:
            co, how = modern_country(q)
            if co: src = "citizenship"; how = "p27"; break
    mvs = fold_mv(p["mv"])
    g = next((GENDER[x] for x in p["sex"] if x in GENDER), "other" if p["sex"] else None)
    conf = m["conf"] * (1.0 if src == "birth" and how in ("p17", "self", "p131") else 0.8 if src else 0.0)
    rec.update(q=m["q"], via=m["via"], confidence=round(conf, 2), country=co, country_src=src, country_how=how,
               birth=by if (bp or 0) >= 9 else None, death=dy if (dp or 0) >= 9 else None, movements=mvs, gender=g,
               existing_co=dict(ex.most_common(3)))
    if m["via"].startswith("label-ambiguous"): rec["alt"] = m.get("alt")
    # app naming rule: a painter whose rows already say Russia keeps Russia when Wikidata puts the birthplace in a
    # former Soviet/imperial republic that the app has no label for (the Russian batch convention)
    app = co
    if co and co not in APP_CO and ex and ex.most_common(1)[0][0] == "Russia" and ex["Russia"] / sum(ex.values()) >= 0.5:
        app = "Russia"; rec["country_note"] = "kept Russia (existing label); Wikidata birth country " + co
    rec["country_app"] = app
    painters[lab] = rec

matched = [l for l, r in painters.items() if r.get("q")]
withco = [l for l in matched if painters[l].get("country")]
nrows = sum(r["n"] for r in painters.values())
stat = dict(painters=len(painters), matched=len(matched), matched_rows=sum(painters[l]["n"] for l in matched), painter_rows=nrows,
            with_country=len(withco), with_country_rows=sum(painters[l]["n"] for l in withco),
            with_birth=sum(1 for l in matched if painters[l].get("birth")), with_movement=sum(1 for l in matched if painters[l].get("movements")),
            with_gender=sum(1 for l in matched if painters[l].get("gender")),
            women=sum(1 for l in matched if painters[l].get("gender") == "female"),
            women_rows=sum(painters[l]["n"] for l in matched if painters[l].get("gender") == "female"),
            via=dict(collections.Counter(painters[l]["via"] for l in painters)))
top_unmatched = [dict(painter=l, paintings=n) for n, l in sorted(nomatch, reverse=True)[:100]]
json.dump(dict(v=1, built="2026-10-21", policy="country = painter birth country (P19->P17 mapped to the modern country), fallback citizenship P27",
               stats=stat, top100_unmatched=top_unmatched, painters=painters), open(OUT + "/painters.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(json.dumps(stat, indent=1))

# ---------------- paintings
paintings = {}; dis = collections.defaultdict(list); disn = collections.Counter(); fill = collections.Counter()
before = collections.Counter(); after = collections.Counter(); ybefore = 0; yafter = 0; mvb = 0; mva = 0
TY = [re.compile(r"(?:,|\()\s*(?:c\.?|ca\.?|circa|um|around)?\s*(1[2-9]\d\d)\s*(?:ca\.?)?\s*\)?\s*$", re.I), re.compile(r"\b(?:c\.|ca\.|circa)\s*(1[2-9]\d\d)\b", re.I)]


def title_year(t):
    for rx in TY:
        m = rx.search(t or "")
        if m: return int(m.group(1))
    return None


def diff_example(kind, ex):
    disn[kind] += 1
    if len(dis[kind]) < 20: dis[kind].append(ex)


for r in rows:
    pid = r["id"]; q = pid[8:] if re.match(r"commons-Q\d+$", pid) else None
    w = paint.get(q) if q else None
    pr = painters.get(r["a"]) if r["a"] else None
    out = {}
    # ---- country
    pc = pr.get("country_app") if pr else None
    wc = None
    if w and not w.get("missing") and w["co"]:
        for x in w["co"]:
            c, _ = modern_country(x)
            if c: wc = c; break
    if r["co"]:
        before[r["co"]] += 1; after[r["co"]] += 1
        if pc and pc != r["co"]: diff_example("country_vs_painter_birth", dict(id=pid, painter=r["a"], existing=r["co"], wikidata=pc))
        if wc and wc != r["co"]: diff_example("country_vs_painting_P495", dict(id=pid, existing=r["co"], P495=wc))
    else:
        c = pc; cs = "painter" if pc else None
        if not c and wc: c = wc; cs = "P495"
        if c:
            out["co"] = c
            if cs != "painter": out["cs"] = cs
            after[c] += 1; fill["co"] += 1
    # ---- year
    if r["y"]:
        ybefore += 1; yafter += 1
        if w and w.get("inc"):
            y, p = ydec([tuple(t) for t in w["inc"]])
            if y and p >= 9 and abs(y - r["y"]) > 10: diff_example("year_vs_P571", dict(id=pid, existing=r["y"], P571=y))
    else:
        y = ys = ya = None
        if w and w.get("inc"):
            y, p = ydec([tuple(t) for t in w["inc"]])
            if y is not None and p >= 8:
                ys = "P571"; ya = 1 if p == 8 else 0
                if p == 8: y = y // 10 * 10 + 5 if y % 10 == 0 else y
            else: y = None
        if y is None and not q:
            ty = title_year(r["t"])
            if ty: y, ys, ya = ty, "title", 0
        if y is not None and pr and pr.get("birth"):
            hi = (pr["death"] + 3) if pr.get("death") else pr["birth"] + 95
            if not (pr["birth"] + 6 <= y <= hi):
                disn["year_rejected_implausible_for_painter"] += 1; y = None
        if y is not None:
            out["y"] = y; fill["y_" + ys] += 1; yafter += 1
            if ya: out["ya"] = 1
            if ys != "P571": out["ys"] = ys
    # ---- movement
    if r["mv"]: mvb += 1; mva += 1
    wm = fold_mv(w["mv"]) if w and not w.get("missing") else []
    if r["mv"]:
        if wm and r["mv"].lower() not in [x.lower() for x in wm]: diff_example("movement_vs_P135", dict(id=pid, existing=r["mv"], P135=wm))
    else:
        mv = None; ms = None
        if wm: mv, ms = wm[0], "painting"
        elif pr and len(pr.get("movements") or []) == 1: mv, ms = pr["movements"][0], "painter"
        if mv:
            out["mv"] = mv; mva += 1; fill["mv_" + ms] += 1
            if ms != "painting": out["ms"] = ms
    # ---- extras (fields the rows do not carry at all)
    if w and not w.get("missing"):
        coll = [LB.get(x) for x in w["coll"] if LB.get(x)]
        gen = [LB.get(x) for x in w["gen"] if LB.get(x)]
        if coll: out["coll"] = coll[0]; fill["coll"] += 1
        if gen: out["gen"] = gen[:3]; fill["gen"] += 1
        if w["mv"] and not wm:
            raw = [LB.get(x) for x in w["mv"] if LB.get(x)]
            if raw: out["mvr"] = raw[:2]
    if out: paintings[pid] = out

json.dump(dict(v=1, built="2026-10-21", note="Only blanks are filled. co/y/mv fill an empty field; coll/gen/mvr are new fields. Keys: co country, cs country source if not the painter's (P495), y year, ya=1 year is a decade midpoint, ys year source if not P571 (title), mv movement, ms movement source if not the painting's own P135 (painter), coll collection, gen genres, mvr unfolded raw movement labels.",
               rows=paintings), open(OUT + "/paintings.json", "w"), ensure_ascii=False, separators=(",", ":"))
top = lambda c, n=15: [[k, v] for k, v in c.most_common(n)]
proj = dict(rows=len(rows), fill=dict(fill), country_before_total=sum(before.values()), country_after_total=sum(after.values()),
            year_before=ybefore, year_after=yafter, movement_before=mvb, movement_after=mva,
            top15_before=top(before), top15_after=top(after),
            watch={k: [before[k], after[k]] for k in ["Russia", "United Kingdom", "United States", "France", "Italy", "Germany", "Netherlands", "Spain", "Ukraine"]},
            new_countries={k: v for k, v in sorted(after.items(), key=lambda kv: -kv[1]) if k not in APP_CO},
            disagreements=dict(counts=dict(disn), examples=dis))
json.dump(proj, open(OUT + "/projection.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: proj[k] for k in ["rows", "fill", "country_before_total", "country_after_total", "year_before", "year_after", "movement_before", "movement_after", "top15_before", "top15_after", "watch"]}, indent=1))
print(dict(disn))
