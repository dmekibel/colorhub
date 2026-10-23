"""US museum paintings via Wikidata collection (P195) + Wikimedia Commons image (P18), no API key (2026-10-23).
  WD_MAXLAG=600 python3 tools/stage/us_wd.py [museum-key ...]   # -> data/corpus-staging/zz-museum-us-wd-<n>.json
One SPARQL request at a time (wdq.py), nothing is downloaded: img is Special:FilePath/<file>?width=400 like every Commons row.
Kept: instance of a painting type (not drawing/print/photo/sculpture ...), dated, creator died <= 1955 (public domain),
image on Commons. Dropped: Commons file name already held in data/corpus, id / artist+title+year twin (lib.stage).
Licence "PD" (author died before 1956; Commons only holds the file if it is free), url = the Wikidata item."""
import glob
import json
import re
import sys
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, ROOT, SCR, stage  # noqa: E402
from nw import country  # noqa: E402
from wdq import labels, qid, rows, sparql, val  # noqa: E402

PD_YEAR = 1955
MUSEUMS = {   # key -> Wikidata item (Met, AIC, Cleveland, NGA, SAAM, Walters, Smithsonian units, YUAG come from their own feeds)
    "mfa-boston": "Q49133", "brooklyn": "Q632682", "lacma": "Q1641836", "mia": "Q1700481", "dia": "Q1201549",
    "cincinnati": "Q2970522", "toledo": "Q1743116", "philadelphia": "Q510324", "getty": "Q731126",
    "harvard": "Q3783572", "barnes": "Q808462", "nelson-atkins": "Q1976985", "slam": "Q1760539", "carnegie": "Q1043967",
    "mfa-houston": "Q1565911", "dallas": "Q745866", "seattle": "Q1816301", "indianapolis": "Q1117704",
    "vmfa": "Q4013975", "high": "Q953345", "buffalo-akg": "Q1970945", "worcester": "Q847508", "wadsworth": "Q403080",
    "corcoran": "Q768446", "frick": "Q682827", "gardner": "Q49135", "phillips": "Q578485", "whitney": "Q639791",
    "moma": "Q188740", "guggenheim": "Q201469", "nyhs": "Q1059456", "pafa": "Q1952033", "amon-carter": "Q255559",
    "kimbell": "Q1741629", "famsf": "Q1416890", "sdma": "Q1368166", "norton-simon": "Q1752085", "huntington": "Q1400558",
    "portland": "Q279049", "denver": "Q1189960", "crystal-bridges": "Q1142334", "princeton": "Q2603905",
    "currier": "Q3007727", "pem": "Q3373790", "allen": "Q3816734", "columbus": "Q5935366", "milwaukee": "Q325712",
}
KEEP_INST = re.compile(r"painting|portrait|fresco|mural|altarpiece|triptych|diptych|polyptych|tondo|watercolou?r|"
                       r"gouache|tempera|landscape|still life|genre|panel", re.I)
DROP_INST = re.compile(r"drawing|print\b|etching|lithograph|engraving|woodcut|woodblock|photograph|sculpture|book|manuscript|"
                       r"poster|postcard|illustration|sketch|cartoon|comic|textile|ceramic|vase|stamp|\bmap\b|relief|"
                       r"mosaic|tapestry|stained glass|digital|cover|bookplate|calligraphy|pastel|charcoal|collage|"
                       r"installation|statue|coin|medal|miniature|scroll|screen|thangka|album", re.I)


def fetch_items(m):
    out, off, step = [], 0, 3000
    while True:
        q = """SELECT ?p ?a ?img ?inc ?prec ?inst WHERE { ?p wdt:P195 wd:%s ; wdt:P18 ?img .
 OPTIONAL { ?p wdt:P170 ?a } OPTIONAL { ?p p:P571/psv:P571 ?n . ?n wikibase:timeValue ?inc ; wikibase:timePrecision ?prec }
 OPTIONAL { ?p wdt:P31 ?inst } } ORDER BY ?p LIMIT %d OFFSET %d""" % (m, step, off)
        j = sparql(q)
        if "error" in j:
            raise RuntimeError(f"{m}: {j}")
        rs = rows(j)
        out += rs
        if len(rs) < step:
            return out
        off += step


def assemble(bindings):
    items = {}
    for b in bindings:
        p = qid(val(b, "p"))
        it = items.setdefault(p, dict(q=p, a=set(), img=val(b, "img"), inc=[], inst=set()))
        a = qid(val(b, "a")) if val(b, "a") else None
        if a and re.fullmatch(r"Q\d+", a):
            it["a"].add(a)
        if val(b, "inc"):
            y = year_of(val(b, "inc"))
            if y is not None:
                it["inc"].append((y, int(val(b, "prec") or 9)))
        i = qid(val(b, "inst")) if val(b, "inst") else None
        if i and re.fullmatch(r"Q\d+", i):
            it["inst"].add(i)
    return items


def year_of(s):
    m = re.match(r"^([+-]?)(\d{1,4})", s or "")
    return (-1 if m.group(1) == "-" else 1) * int(m.group(2)) if m else None


def creator_info(qids):
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


def held_files():
    fn = set()
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        for r in json.load(open(f)):
            m = re.search(r"Special:FilePath/([^?]+)", r.get("img") or "")
            if m:
                fn.add(re.sub(r"[ _]", "_", urllib.parse.unquote(m.group(1))).lower())
    return fn


keys = sys.argv[1:] or list(MUSEUMS)
allitems, mus_of, fetched = {}, {}, Counter()
for k in keys:
    try:
        got = assemble(fetch_items(MUSEUMS[k]))
    except RuntimeError as e:
        print("  museum failed", k, str(e)[:200], flush=True)
        continue
    fetched[k] = len(got)
    for q, it in got.items():
        mus_of.setdefault(q, k)
        if q in allitems:
            allitems[q]["a"] |= it["a"]
            allitems[q]["inst"] |= it["inst"]
            allitems[q]["inc"] += it["inc"]
        else:
            allitems[q] = it
    print(f"  {k}: {len(got)} imaged items ({len(allitems)} total)", flush=True)
(SCR / "stats" / "us_wd_fetched.json").write_text(json.dumps(fetched))

need = set()
for it in allitems.values():
    need |= {it["q"]} | it["inst"] | it["a"]
lab = labels(need)
creators = creator_info({a for it in allitems.values() for a in it["a"]})
heldf = held_files()
pre, raw = Counter(), []
for q, it in allitems.items():
    if not it["inc"]:
        pre["no inception date"] += 1
        continue
    insts = [lab.get(i) or "" for i in it["inst"]]
    if not insts or any(DROP_INST.search(s) for s in insts) or not any(KEEP_INST.search(s) for s in insts):
        pre["not a painting (drawing, print, photo, sculpture, no instance-of ...)"] += 1
        continue
    title = lab.get(q)
    if not title or re.fullmatch(r"Q\d+", title) or title.lower().startswith("file:"):
        pre["no title"] += 1
        continue
    y0, prec = min(it["inc"])
    if prec <= 6:
        pre["date too coarse"] += 1
        continue
    span = {7: 100, 8: 10}.get(prec, 0)
    yrs = [y for y, _ in it["inc"]]
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
    img = it["img"].replace("http://", "https://", 1).split("?")[0]
    m = re.search(r"Special:FilePath/(.+)$", img)
    if not m:
        pre["image url not a Commons file"] += 1
        continue
    if re.sub(r"[ _]", "_", urllib.parse.unquote(m.group(1))).lower() in heldf:
        pre["Commons file already held in data/corpus"] += 1
        continue
    name = cr.get("name") or (lab.get(a) if a else None)
    raw.append(dict(id=f"commons-{q}", q=q, t=title, a=name, y=y0, span=span, co=cr.get("co") or "United States",
                    img=img + "?width=400"))

rows_out = stage("us-wd", len(allitems), raw,
                 lambda x: dict(id=x["id"], src="commons", t=C.clean_title(x["t"]), a=C.clean_artist(x["a"]) if x["a"] else None,
                                y=x["y"], span=x["span"], co=x["co"], mv=None, img=x["img"]),
                 "PD", lambda x: f"https://www.wikidata.org/wiki/{x['q']}", pre, group_cap=False)
per = Counter(mus_of.get(r["id"].split("-", 1)[1]) for r in rows_out)
print("per museum:", dict(per.most_common()), flush=True)
(SCR / "stats" / "us_wd_per_museum.json").write_text(json.dumps(dict(per)))
