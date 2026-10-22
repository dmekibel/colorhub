"""Wikidata -> staging rows for (1) women painters of all periods and (2) non-Western painting, from items that have an image
on Wikimedia Commons (P18). Nothing is downloaded: img is Special:FilePath/<file>?width=400 like every other Commons row.
  python3 tools/stage/nw_wd.py women     # creators: sex or gender female, occupation painter, died 1955 or earlier (public domain)
  python3 tools/stage/nw_wd.py nw        # painting items whose creator is a citizen of, or which originate in, a non-Western country
Licence: "PD" (author died before 1956; Commons only holds the file if it is free) with url = the Wikidata item.
Items whose collection is a museum already staged or held (Met, AIC, Cleveland, NGA, Rijks, SMK, Walters, SAAM, Freer|Sackler,
Yale) are skipped, so a museum's own row is the only copy."""
import re
import sys
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nw import C, country, emit  # noqa: E402
from wdq import labels, qid, rows, sparql, val  # noqa: E402

MODE = sys.argv[1]
PD_YEAR = 1955
MUSEUM_SKIP = re.compile(r"art institute of chicago|cleveland museum|metropolitan museum|national gallery of art|rijksmuseum|"
                         r"statens museum|walters|smithsonian|freer|sackler|national museum of asian art|yale center|"
                         r"national museum of african art", re.I)
KEEP_INST = re.compile(r"painting|portrait|fresco|mural|altarpiece|triptych|diptych|polyptych|tondo|miniature|watercolou?r|"
                       r"gouache|tempera|landscape|still life|genre|icon\b|folding screen|hanging scroll|handscroll|scroll|"
                       r"thangka|album leaf|panel", re.I)
DROP_INST = re.compile(r"drawing|print\b|etching|lithograph|engraving|woodcut|woodblock|photograph|sculpture|book|manuscript|"
                       r"poster|postcard|illustration|sketch|cartoon|comic|textile|ceramic|vase|stamp|\bmap\b|relief|"
                       r"mosaic|tapestry|stained glass|digital|cover|bookplate|calligraphy|pastel|charcoal|collage|"
                       r"installation|statue|coin|medal", re.I)


def year_of(s):
    m = re.match(r"^([+-]?)(\d{1,4})", s or "")
    return (-1 if m.group(1) == "-" else 1) * int(m.group(2)) if m else None


def fetch_items(where, tag):
    """where: a SPARQL group binding ?p (item) and optionally ?a (creator). Paged by ?p in LIMIT/OFFSET blocks."""
    out, off, step = [], 0, 3000
    while True:
        q = """SELECT ?p ?a ?img ?inc ?prec ?coll ?inst ?co WHERE { %s
 ?p wdt:P18 ?img .
 OPTIONAL { ?p p:P571/psv:P571 ?n . ?n wikibase:timeValue ?inc ; wikibase:timePrecision ?prec }
 OPTIONAL { ?p wdt:P195 ?coll } OPTIONAL { ?p wdt:P31 ?inst } OPTIONAL { ?p wdt:P495 ?co } }
 ORDER BY ?p LIMIT %d OFFSET %d""" % (where, step, off)
        j = sparql(q)
        if "error" in j:
            raise RuntimeError(f"{tag}: {j}")
        rs = rows(j)
        out += rs
        if len(rs) < step:
            return out
        off += step


def assemble(bindings):
    items = {}
    for b in bindings:
        p = qid(val(b, "p"))
        it = items.setdefault(p, dict(q=p, a=set(), img=val(b, "img"), inc=[], coll=set(), inst=set(), co=set()))
        if val(b, "a") and re.fullmatch(r"Q\d+", qid(val(b, "a")) or ""):
            it["a"].add(qid(val(b, "a")))
        if val(b, "inc"):
            y = year_of(val(b, "inc"))
            if y is not None:
                it["inc"].append((y, int(val(b, "prec") or 9)))
        for k, f in (("coll", "coll"), ("inst", "inst"), ("co", "co")):
            v = qid(val(b, k)) if val(b, k) else None
            if v and re.fullmatch(r"Q\d+", v):
                it[f].add(v)
    return items


def build(items, creators, source_tag, require_nw):
    """creators: {qid: dict(name, co, dod)}; returns normalized rows."""
    need = set()
    for it in items.values():
        need |= {it["q"]} | it["inst"] | it["coll"] | it["co"] | it["a"]
    lab = labels(need)
    pre, out = Counter(), []
    for q, it in items.items():
        if not it["inc"]:
            pre["no inception date"] += 1
            continue
        insts = [lab.get(i) or "" for i in it["inst"]]
        if not insts:
            pre["no instance-of"] += 1
            continue
        if any(DROP_INST.search(s) for s in insts) or not any(KEEP_INST.search(s) for s in insts):
            pre["not a painting (drawing, print, photo, sculpture, ...)"] += 1
            continue
        if any(MUSEUM_SKIP.search(lab.get(c) or "") for c in it["coll"]):
            pre["held by a museum staged/held from its own feed"] += 1
            continue
        title = lab.get(q)
        if not title or re.fullmatch(r"Q\d+", title) or title.lower().startswith("file:"):
            pre["no title"] += 1
            continue
        yrs = [y for y, _ in it["inc"]]
        y0, prec = min(it["inc"])
        span = {7: 100, 8: 10}.get(prec, 0)
        if prec <= 6:
            pre["date too coarse"] += 1
            continue
        if max(yrs) - min(yrs) > 0:
            span = max(span, max(yrs) - min(yrs))
        if len(it["a"]) > 1:
            pre["several creators"] += 1
            continue
        a = next(iter(it["a"]), None)
        cr = creators.get(a, {})
        if a and (cr.get("dod") is None or cr["dod"] > PD_YEAR):
            pre["creator died after 1955 or undated (not public domain)"] += 1
            continue
        if not a and y0 > 1900:
            pre["no creator and dated after 1900"] += 1
            continue
        name = cr.get("name") or (lab.get(a) if a else None)
        co = cr.get("co") or country(*[lab.get(c) for c in it["co"]])
        if require_nw and it["co"]:
            co = country(*[lab.get(c) for c in it["co"]]) or co
        img = it["img"]
        if img.startswith("http://"):
            img = "https://" + img[7:]
        img = img.split("?")[0] + "?width=400"
        if not re.search(r"Special:FilePath/", img):
            pre["image url not a Commons file"] += 1
            continue
        out.append(dict(id=f"commons-{q}", src="commons", t=C.clean_title(title), a=C.clean_artist(name) if name else None,
                        y=y0, span=span, co=co, mv=None, img=img, license="PD",
                        url=f"https://www.wikidata.org/wiki/{q}"))
    return out, pre


def creator_info(qids, want_dod=True):
    """name, citizenship country and death year for creators (labels via the API, citizenship via SPARQL)."""
    qids = sorted(qids)
    lab = labels(qids)
    cit, dod = defaultdict(list), {}
    for i in range(0, len(qids), 150):
        vals = " ".join("wd:" + x for x in qids[i:i + 150])
        for b in rows(sparql("SELECT ?a ?c ?d WHERE { VALUES ?a { %s } OPTIONAL { ?a wdt:P27 ?c } OPTIONAL { ?a wdt:P570 ?d } }" % vals)):
            a = qid(val(b, "a"))
            if val(b, "c") and re.fullmatch(r"Q\d+", qid(val(b, "c"))):
                cit[a].append(qid(val(b, "c")))
            d = val(b, "d")
            if d and not d.startswith("http"):
                dod.setdefault(a, year_of(d))
    clab = labels({c for v in cit.values() for c in v})
    info = {}
    for a in qids:
        co = None
        for c in cit.get(a, []):
            co = country(clab.get(c))
            if co:
                break
        info[a] = dict(name=lab.get(a), co=co, dod=dod.get(a))
    return info


if MODE == "women":
    q = """SELECT ?a (COUNT(?p) AS ?n) (MIN(?d) AS ?dod) WHERE {
 ?a wdt:P21 wd:Q6581072 ; wdt:P106 wd:Q1028181 . ?p wdt:P170 ?a ; wdt:P18 [] .
 OPTIONAL { ?a wdt:P570 ?d } } GROUP BY ?a"""
    cands, n_all, n_living = [], 0, 0
    for b in rows(sparql(q)):
        n_all += 1
        d = val(b, "dod")
        y = year_of(d) if d and not d.startswith("http") else None
        if y is not None and y <= PD_YEAR:
            cands.append(qid(val(b, "a")))
        else:
            n_living += 1
    print(f"women painters with an imaged work: {n_all}; died <= {PD_YEAR}: {len(cands)}; later/unknown: {n_living}", flush=True)
    items = {}
    for i in range(0, len(cands), 60):
        vals = " ".join("wd:" + x for x in cands[i:i + 60])
        items.update(assemble(fetch_items("VALUES ?a { %s } ?p wdt:P170 ?a ." % vals, f"women batch {i}")))
        print(f"  creators {min(i + 60, len(cands))}/{len(cands)}: {len(items)} imaged works", flush=True)
    creators = creator_info({a for it in items.values() for a in it["a"]})
    rws, pre = build(items, creators, "women", False)
    pre["women creators dead after 1955 or undated (not public domain), works not fetched"] = n_living
    emit("women", rws, kind="commons", pre_drops=pre, require_nw=False,
         extra_stats=dict(creators_pd=len(cands), creators_with_rows=len({r["a"] for r in rws if r["a"]}), api_total=len(items)))
elif MODE == "nw":
    GROUPS = {   # label -> Wikidata countries / states (citizenship of the creator or country of origin of the painting)
        "china": ["Q148", "Q29520", "Q9903", "Q7209", "Q9683", "Q8733"],   # PRC, Qing, Han?, ... (unknown ones just match nothing)
        "japan": ["Q17", "Q188712", "Q131339"],
        "korea": ["Q884", "Q28179", "Q18097", "Q423"],
        "india": ["Q668", "Q33296", "Q129286", "Q1775277", "Q2133547"],
        "iran": ["Q794", "Q2578", "Q6501", "Q1185206", "Q181270"],
        "ottoman-turkey": ["Q12560", "Q43"],
        "himalaya": ["Q837", "Q17252", "Q917"],
        "southeast-asia": ["Q869", "Q881", "Q252", "Q424", "Q836", "Q928", "Q833", "Q819", "Q334"],
        "south-asia-other": ["Q854", "Q843", "Q902", "Q889"],
        "central-asia-mongolia": ["Q711", "Q265", "Q813", "Q863", "Q865"],
        "arab-world": ["Q79", "Q858", "Q796", "Q822", "Q1028", "Q262", "Q948", "Q810", "Q801"],
        "africa": ["Q1033", "Q117", "Q1041", "Q258", "Q114", "Q115", "Q924", "Q1009", "Q1008", "Q1005", "Q970", "Q953", "Q954", "Q1036"],
        "mexico-central-america": ["Q96", "Q774", "Q783", "Q792", "Q811", "Q800", "Q804"],
        "andes": ["Q419", "Q750", "Q736", "Q739", "Q717"],
        "southern-cone-caribbean": ["Q298", "Q414", "Q77", "Q241", "Q790", "Q786", "Q734", "Q733"],
        "brazil": ["Q155"],
        "oceania": ["Q408", "Q664", "Q691", "Q712"],
    }
    only = sys.argv[2:]
    items, tot = {}, Counter()
    for g, cs in GROUPS.items():
        if only and g not in only:
            continue
        vals = " ".join("wd:" + c for c in cs)
        where = ("{ VALUES ?c { %s } { ?p wdt:P495 ?c } UNION { ?p wdt:P170 ?cr . ?cr wdt:P27 ?c } } "
                 "?p wdt:P31 wd:Q3305213 . OPTIONAL { ?p wdt:P170 ?a }" % vals)
        try:
            got = assemble(fetch_items(where, g))
        except RuntimeError as e:
            print("  group failed", g, str(e)[:200], flush=True)
            continue
        for k, v in got.items():
            tot[g] += 1
            if k in items:
                items[k]["a"] |= v["a"]
            else:
                items[k] = v
        print(f"  {g}: {len(got)} imaged painting items ({len(items)} total)", flush=True)
    creators = creator_info({a for it in items.values() for a in it["a"]})
    rws, pre = build(items, creators, "nw", True)
    emit("nonwestern", rws, kind="commons", pre_drops=pre, require_nw=True,
         extra_stats=dict(api_total=len(items), items_by_group=dict(tot)))
elif MODE == "japan":   # the one group the single big query times out on: go creator by creator batch, like women
    q = """SELECT ?a (COUNT(?p) AS ?n) (MIN(?d) AS ?dod) WHERE {
 ?a wdt:P27 wd:Q17 . ?p wdt:P170 ?a ; wdt:P31 wd:Q3305213 ; wdt:P18 [] .
 OPTIONAL { ?a wdt:P570 ?d } } GROUP BY ?a"""
    cands = []
    for b in rows(sparql(q)):
        d = val(b, "dod")
        y = year_of(d) if d and not d.startswith("http") else None
        if y is not None and y <= PD_YEAR:
            cands.append(qid(val(b, "a")))
    print(f"japanese painters with an imaged painting, died <= {PD_YEAR}: {len(cands)}", flush=True)
    items = {}
    for i in range(0, len(cands), 60):
        vals = " ".join("wd:" + x for x in cands[i:i + 60])
        items.update(assemble(fetch_items("VALUES ?a { %s } ?p wdt:P170 ?a ." % vals, f"japan {i}")))
        print(f"  creators {min(i + 60, len(cands))}/{len(cands)}: {len(items)} works", flush=True)
    anon = assemble(fetch_items("?p wdt:P495 wd:Q17 . ?p wdt:P31 wd:Q3305213 . FILTER NOT EXISTS { ?p wdt:P170 [] }", "japan-anon"))
    items.update(anon)
    creators = creator_info({a for it in items.values() for a in it["a"]})
    rws, pre = build(items, creators, "japan", True)
    emit("japan", rws, kind="commons", pre_drops=pre, require_nw=True, extra_stats=dict(api_total=len(items)))
else:
    raise SystemExit("mode: women | nw | japan")
