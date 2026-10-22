#!/usr/bin/env python3
"""Stage more public-domain paintings for famous painters, metadata only (2026-10-22).

  python3 tools/stage_extra.py plan.json

plan.json: [{"name": "Edvard Munch", "q": "Q41406", "life": "1863-1944", "max": 600}, ...]

Same selection as tools/artist_extra.py (Wikidata P170 + P18, painting-like classes, spread over medium x decade) but:
  * writes data/corpus-staging/zz-commons-<slug>-<N>.json, never data/corpus (N = next free number across both folders);
  * downloads NO images, so rows carry no palette (no p / L / C yet): a later lane computes palettes, then moves them in;
  * skips Study/sketch/drawing/print/photograph titles;
  * drops anything already in data/corpus (same id, same Commons file, or same painter + normalized title + year within 2),
    and twins inside the staged set itself;
  * one WDQS request at a time, 3 s apart, back off on 429/5xx, UA names Chromatlas.
"""
import json, re, sys, time, glob, urllib.parse, urllib.request, urllib.error
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads(Path(sys.argv[1]).read_text())
sys.argv = [sys.argv[0], "stage", "Q0", "--stage"]   # artist_extra reads argv at import; we only borrow its helpers
sys.path.insert(0, str(ROOT / "tools"))
import artist_extra as ae  # noqa: E402

UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
STAGE = ROOT / "data" / "corpus-staging"
STAGE.mkdir(parents=True, exist_ok=True)
SKIP_T = re.compile(r"\b(study|studies|sketch|sketches|drawing|drawings|print|prints|photograph|photo|etching|engraving|woodcut|lithograph|cartoon|design for|letter)\b|^study", re.I)
NONP = set(ae.C.NONPAINTINGS)   # hand-reviewed non-paintings, keyed by row id


def wdqs(query):
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(query)
    for t in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            return json.load(urllib.request.urlopen(req, timeout=170))["results"]["bindings"]
        except urllib.error.HTTPError as e:
            wait = 30 * (t + 1) if e.code in (429, 503) else 15
            print("  http", e.code, "wait", wait, flush=True); time.sleep(wait)
        except Exception as e:
            print("  err", str(e)[:80], flush=True); time.sleep(20)
    return None


LEAN = """SELECT ?item (SAMPLE(?lab) AS ?t) (SAMPLE(?img) AS ?im) (GROUP_CONCAT(DISTINCT STR(?inc);separator="|") AS ?incs) (GROUP_CONCAT(DISTINCT STR(?inst);separator="|") AS ?insts) (GROUP_CONCAT(DISTINCT STR(?mat);separator="|") AS ?mats) (GROUP_CONCAT(DISTINCT STR(?coll);separator="|") AS ?colls) (GROUP_CONCAT(DISTINCT STR(?c);separator="|") AS ?cs) (GROUP_CONCAT(DISTINCT ?aicid;separator="|") AS ?aics) (GROUP_CONCAT(DISTINCT ?metid;separator="|") AS ?mets) WHERE { ?item wdt:P170 wd:%s . ?item wdt:P18 ?img . OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P195 ?coll } OPTIONAL { ?item wdt:P31 ?inst } OPTIONAL { ?item wdt:P186 ?mat } OPTIONAL { ?item wdt:P495 ?c } OPTIONAL { ?item wdt:P4610 ?aicid } OPTIONAL { ?item wdt:P3634 ?metid } OPTIONAL { ?item rdfs:label ?lab FILTER(lang(?lab) = "en") } } GROUP BY ?item"""


LABELS = {}


def lab(qid):
    """English label of a type / museum / material / country item (cached across painters)."""
    if qid not in LABELS:
        r = wdqs('SELECT ?l WHERE { wd:%s rdfs:label ?l FILTER(lang(?l) = "en") }' % qid)
        time.sleep(1.5)
        LABELS[qid] = r[0]["l"]["value"] if r else qid
    return LABELS[qid]


def prefetch(rows):
    """Resolve every type / museum / material / country id of a result in a few batched label queries."""
    need = sorted({x.rsplit("/", 1)[-1] for b in rows for k in ("insts", "mats", "colls", "cs") if k in b for x in b[k]["value"].split("|") if x} - set(LABELS))
    for i in range(0, len(need), 120):
        ch = need[i:i + 120]
        r = wdqs("SELECT ?x ?l WHERE { VALUES ?x { %s } ?x rdfs:label ?l FILTER(lang(?l) = \"en\") }" % " ".join("wd:" + q for q in ch))
        time.sleep(2)
        for b in r or []:
            LABELS[b["x"]["value"].rsplit("/", 1)[-1]] = b["l"]["value"]
        for q in ch:
            LABELS.setdefault(q, q)


def lean_items(rows):
    prefetch(rows)
    print("  labels ready", len(LABELS), flush=True)
    """One row per item (aggregated in the query: the cross-product form of artist_extra.QUERY takes minutes for big painters)."""
    by = {}
    for b in rows:
        v = lambda k: b[k]["value"] if k in b else ""
        sp = lambda k: [x for x in v(k).split("|") if x]
        spl = lambda k: [lab(x.rsplit("/", 1)[-1]) for x in sp(k)]
        q = v("item").rsplit("/", 1)[1]
        years = [int(m.group(1)) for x in sp("incs") for m in [re.match(r"^(-?\d{4})", x)] if m]
        by[q] = dict(q=q, t=v("t") or None, img=v("im") or None, years=years, coll=set(spl("colls")), inst=set(spl("insts")), mat=set(spl("mats")),
                     h=None, w=None, co=set(spl("cs")), ext={"aic-" + x for x in sp("aics")} | {"met-" + x for x in sp("mets")})
    return by


def tkey(t):
    return re.sub(r"[^a-z ]", "", (t or "").lower()).strip()


def fnorm(u):
    return urllib.parse.unquote(str(u)).split("?")[0].rsplit("/", 1)[-1].replace(" ", "_").lower()


corpus = []
for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
    corpus += json.loads(Path(f).read_text())
ids = {r["id"] for r in corpus}
files = {fnorm(r["img"]) for r in corpus if r.get("img")}
twins = set()
for r in corpus:
    a = ae.ALIAS.get(r.get("a"), r.get("a"))
    if a and r.get("t"):
        twins.add((a, tkey(r["t"]), r.get("y")))
by_at = {}
for a, k, y in twins:
    by_at.setdefault((a, k), []).append(y)
print("corpus rows", len(corpus), flush=True)

report = []
for p in PLAN:
    name, qid = p["name"], p["q"]
    slug = re.sub(r"[^a-z]+", "", name.lower())
    nxt = 1 + max([int(re.search(r"-(\d+)\.json$", x).group(1)) for d in ("corpus", "corpus-staging")
                   for x in glob.glob(str(ROOT / "data" / d / f"zz-commons-{slug}-*.json"))] or [0])
    ae.LIFE = tuple(int(x) for x in p["life"].split("-")) if p.get("life") else None
    done = glob.glob(str(STAGE / f"zz-commons-{slug}-*.json"))
    if done:   # already staged by an earlier run
        n_done = len(json.loads(Path(done[0]).read_text()))
        report.append((name, qid, "ok", sum(1 for r in corpus if ae.ALIAS.get(r.get("a"), r.get("a")) == name), n_done, None, {"resumed": 1}))
        print(f"{name}: already staged ({n_done})", flush=True); continue
    t0 = time.time()
    rows = wdqs(LEAN % qid)
    print("  main query", None if rows is None else len(rows), round(time.time() - t0), "s", flush=True)
    time.sleep(3)
    if rows is None:
        report.append((name, qid, "FAILED", 0, 0)); print("FAILED", name, flush=True); continue
    cands = ae.candidates(lean_items(rows))
    before = sum(1 for r in corpus if ae.ALIAS.get(r.get("a"), r.get("a")) == name)
    out, drop = [], Counter()
    for it in cands:
        rid = f"commons-{it['q']}"
        t = it["t"] if it["t"] and not re.match(r"^Q\d+$", it["t"]) else "Untitled"
        if rid in ids or rid in NONP:
            drop["in corpus/nonpainting"] += 1; continue
        if fnorm(it["img"]) in files:
            drop["same file"] += 1; continue
        if SKIP_T.search(t):
            drop["study/drawing/print title"] += 1; continue
        k = tkey(t)
        ys = by_at.get((name, k), [])
        if len(k) > 6 and any(it["y"] is None or y is None or abs(it["y"] - y) <= 2 for y in ys):
            drop["title+year twin"] += 1; continue
        by_at.setdefault((name, k), []).append(it["y"])
        co = None
        for c in it["co"]:
            co = ae.C.country_of(c) or co
        out.append(dict(id=rid, src="commons", t=ae.C.clean_title(t) if t != "Untitled" else t, a=name, y=it["y"], co=co or None, mv=None,
                        img=ae.thumb(it["img"], 400), url="https://www.wikidata.org/wiki/" + it["q"], _cls=it["cls"]))
    ae.MAX_NEW = p.get("max", 600)
    chosen = ae.spread(out, ae.MAX_NEW)
    chosen = sorted(chosen, key=lambda r: ((r["y"] if r["y"] is not None else 99999), r["id"]))
    for r in chosen:
        r.pop("_cls", None)
    for r in chosen:   # reserve for later painters' twin checks is unnecessary (per painter)
        ids.add(r["id"])
    if chosen:
        path = STAGE / f"zz-commons-{slug}-{nxt}.json"
        path.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in chosen) + "\n]\n", encoding="utf-8")
    report.append((name, qid, "ok", before, len(chosen), len(cands), dict(drop)))
    print(f"{name}: corpus {before}, wikidata painting-like {len(cands)}, staged {len(chosen)}, dropped {dict(drop)}", flush=True)
    Path(ROOT / "data" / "corpus-staging" / "_report.json").write_text(json.dumps(report, ensure_ascii=False))
