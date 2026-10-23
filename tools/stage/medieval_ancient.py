"""Medieval + ancient painting staging (2026-10-23): true paintings dated before 1500 (negative years for the ancient world),
read from Wikidata (CC0 metadata) with the Wikimedia Commons image (Special:FilePath 400 px thumb, public-domain files only).
Classes: painting, mural/fresco/wall painting, icon. Dedupes against data/corpus and other staged files by id, artist+title+year
twin and Commons file name. Rows with a date span over 200 years are dropped. Writes data/corpus-staging/zz-medieval-ancient-<n>.json
Politeness: UA Chromatlas/1.0, one WDQS request at a time (wd.sparql), backoff on 429.
Usage: python3 tools/stage/medieval_ancient.py fetch | stage"""
import glob, json, re, sys, urllib.parse
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd
from lib import C, OUT, SCR, Held, clean, _k

CHUNKS = [(-3500, -500), (-500, 0), (0, 400), (400, 800), (800, 1000), (1000, 1150), (1150, 1250), (1250, 1300), (1300, 1340), (1340, 1370),
          (1370, 1400), (1400, 1420), (1420, 1440), (1440, 1455), (1455, 1470), (1470, 1485), (1485, 1500)]
CLASSES = "VALUES ?cls { wd:Q3305213 wd:Q219423 wd:Q132137 }"
QIDS = """SELECT DISTINCT ?item WHERE { %s ?item wdt:P31/wdt:P279* ?cls . ?item wdt:P18 ?im .
 ?item wdt:P571 ?inc FILTER(?inc >= "%s"^^xsd:dateTime && ?inc < "%s"^^xsd:dateTime) }"""
API = "https://www.wikidata.org/w/api.php"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
import time, urllib.request
_last = [0.0]


def iso(y):
    return ("-" if y < 0 else "") + f"{abs(y):04d}-01-01T00:00:00Z"


def wbget(ids, props):
    """wbgetentities for up to 50 ids, maxlag=600, one request at a time, cached by content hash, backoff on 429/lag."""
    import hashlib
    tag = hashlib.md5((props + ",".join(ids)).encode()).hexdigest()
    p = wd.RAWD / f"wb-{tag}.json"
    if p.exists():
        return json.loads(p.read_text())
    url = API + "?" + urllib.parse.urlencode(dict(action="wbgetentities", ids="|".join(ids), props=props, languages="en|de|fr|it|es|nl|ru|el",
                                                  format="json", maxlag=600))
    for i in range(8):
        w = _last[0] + 1.0 - time.time()
        if w > 0:
            time.sleep(w)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                d = json.loads(r.read().decode())
            if "error" in d:
                print("  wb error", d["error"].get("code"), flush=True)
                time.sleep(10 * (i + 1))
                continue
            p.write_text(json.dumps(d))
            return d
        except urllib.error.HTTPError as e:
            print("  wb HTTP", e.code, flush=True)
            time.sleep(15 * (i + 1))
        except Exception as e:
            print("  wb fail", e, flush=True)
            time.sleep(6 * (i + 1))
    raise RuntimeError("wbget gave up")


CLS = {"painting": "Q3305213", "mural": "Q219423", "wall painting": "Q99516640", "icon": "Q132137", "panel painting": "Q55439",
       "Fayum mummy portrait": "Q646420", "fresco": "Q22669139", "megalographia": "Q1917081", "Gothic mural": "Q5640253",
       "ceiling painting": "Q1181933", "miniature": "Q282129", "manuscript illumination": "Q8362",
       "Indian miniature": "Q123376827", "thangka": "Q916651"}
QI = """SELECT DISTINCT ?item WHERE { ?item wdt:P31 wd:%s . ?item wdt:P18 ?im .
 ?item wdt:P571 ?inc FILTER(?inc >= "%s"^^xsd:dateTime && ?inc < "%s"^^xsd:dateTime) }"""


def qids_range(cq, a, b, depth=0):
    """Item ids of class cq with inception in [a, b); on a WDQS timeout the range is halved."""
    try:
        d = wd.sparql(QI % (cq, iso(a), iso(b)), f"mr-{cq}-{a}-{b}", tries=2)
        return [x["item"]["value"].rsplit("/", 1)[1] for x in d["results"]["bindings"]]
    except RuntimeError:
        if b - a <= 1:
            print("  gave up on", cq, a, b, flush=True)
            return []
        m = (a + b) // 2
        return qids_range(cq, a, m, depth + 1) + qids_range(cq, m, b, depth + 1)


def collect_qids():
    allq = set()
    for name, cq in CLS.items():
        n0 = len(allq)
        for a, b in (CHUNKS if name in ("painting", "mural") else [(-3500, 1500)]):
            allq.update(qids_range(cq, a, b))
        print(name, cq, "+", len(allq) - n0, "total", len(allq), flush=True)
    return sorted(allq)


def entities(ids, props):
    out = {}
    for i in range(0, len(ids), 50):
        out.update(wbget(ids[i:i + 50], props).get("entities", {}))
        if (i // 50) % 20 == 0:
            print(f"  entities {i}/{len(ids)}", flush=True)
    return out


def claim_vals(e, prop):
    out = []
    for c in (e.get("claims") or {}).get(prop, []):
        if c.get("rank") == "deprecated":
            continue
        dv = (c.get("mainsnak") or {}).get("datavalue")
        if dv:
            out.append(dv["value"])
    return out


def qid_of(v):
    return v.get("id") if isinstance(v, dict) else None


def fetch():
    qids = collect_qids()
    print("items:", len(qids), flush=True)
    ents = entities(qids, "claims|labels")
    refs = set()
    for e in ents.values():
        for prop in ("P170", "P135", "P495", "P276", "P195", "P31"):
            for v in claim_vals(e, prop):
                if qid_of(v):
                    refs.add(qid_of(v))
    refs = sorted(refs)
    print("referenced entities:", len(refs), flush=True)
    rents = entities(refs, "claims|labels")
    cc = set()
    for e in rents.values():
        for v in claim_vals(e, "P27"):
            if qid_of(v):
                cc.add(qid_of(v))
    cents = entities(sorted(cc - set(rents)), "labels")
    rents.update(cents)
    return ents, rents


def year_of_iso(s):
    m = re.match(r"^(-?\d+)-", s or "")
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------------------------------------------------------------
# staging
# ---------------------------------------------------------------------------------------------------------------------
import ma_common as M
import de_gb
from nw import country as nw_country

NOT = re.compile(r"\b(drawing|sketch|etching|engraving|lithograph|woodcut|print|photograph|sculpture|bust|statue|statuette|relief|medal|"
                 r"coin|vase|ceramic|tapestry|stamp|coffin|sarcophagus|mosaic|stained glass|amphora|kylix|krater|lekythos|pyxis|hydria|"
                 r"pottery|ostrac|stele|stela|capital|textile|carpet|embroider|reliquary|casket|sherd|fragment of a (vase|pot))\b", re.I)
PLACE_CO = [(re.compile(p, re.I), c) for p, c in [
    (r"pompeii|herculaneum|stabiae|boscoreale|boscotrecase|oplontis|naples|rome\b|roman|etrusc|tarquinia|ostia|italy|florence|siena|venice|padua|assisi", "Italy"),
    (r"egypt|fayum|faiyum|thebes|luxor|saqqara|amarna|karnak|deir el|valley of the|nubia", "Egypt"),
    (r"byzantin|constantinople|istanbul|cappadoc|hagia", "Turkey"),
    (r"russia|novgorod|moscow|vladimir|pskov|rublev|yaroslavl|kiev|kyiv|ukrain", None),
    (r"greece|athos|crete|cretan|thessaloniki|mount sinai|st\.? catherine", None),
    (r"ethiopia|abyssin|lalibela|gondar|tigray", "Ethiopia"), (r"coptic|copt\b", "Egypt"),
    (r"armenia", "Armenia"), (r"georgia \(country\)|georgian", "Georgia"), (r"serbia|sopo|decani|studenica", "Serbia"),
    (r"bulgaria|boyana", "Bulgaria"), (r"romania|moldov|sucevi|voron", "Romania"), (r"cyprus", "Cyprus"),
    (r"spain|catalon|castil|aragon|navarre", "Spain"), (r"england|english|britain", "United Kingdom"),
    (r"france|french|avignon|paris", "France"), (r"germany|german|cologne|bohemia", None), (r"netherlands|flemish|flanders|burgundian", None),
]]


def years_of(e):
    """(y, span) from P571 (+ P1319/P1326) with precision; None when too vague."""
    vals = []
    for v in claim_vals(e, "P571"):
        if isinstance(v, dict) and "time" in v:
            m = re.match(r"([+-])(\d+)-", v["time"])
            if m:
                vals.append((int(m.group(2)) * (-1 if m.group(1) == "-" else 1), v.get("precision", 9)))
    if not vals:
        return None, None
    ys = [y for y, _ in vals]
    prec = min(p for _, p in vals)
    if prec < 7:
        return None, None
    y = min(ys)
    span = {7: 100, 8: 10}.get(prec, 0)
    span = max(span, max(ys) - y)
    for pr in ("P1319", "P1326"):
        for v in claim_vals(e, pr):
            m = re.match(r"([+-])(\d+)-", v.get("time", "")) if isinstance(v, dict) else None
            if m:
                yy = int(m.group(2)) * (-1 if m.group(1) == "-" else 1)
                y = min(y, yy)
                span = max(span, max(ys) - y, yy - y)
    return y, span


def label_of(e):
    for lg in ("en", "de", "fr", "it", "es", "nl", "ru", "el"):
        v = (e.get("labels") or {}).get(lg)
        if v:
            return v["value"]
    return None


def stage(ents, rents):
    held = M.Held("wd")
    drops, cand = Counter(), []
    for q, e in ents.items():
        if "missing" in e:
            drops["entity missing"] += 1
            continue
        t = label_of(e)
        if not t or re.fullmatch(r"Q\d+", t):
            drops["no label"] += 1
            continue
        t = re.sub(r"\s+", " ", t).strip()
        fn = next((v for v in claim_vals(e, "P18") if isinstance(v, str)), None)
        if not fn or not re.search(r"\.(jpe?g|png|tiff?|gif)$", fn, re.I):
            drops["image is not a jpg/png/tif"] += 1
            continue
        y, span = years_of(e)
        if y is None:
            drops["date missing or vaguer than a century"] += 1
            continue
        if y >= 1500 or y < -3500:
            drops["outside -3500..1499"] += 1
            continue
        if span > 200:
            drops["date span over 200 years"] += 1
            continue
        if NOT.search(t) or C.TEXT_PAGE.search(t):
            drops["title names a drawing/print/sculpture/object/text page"] += 1
            continue
        cr = [qid_of(v) for v in claim_vals(e, "P170")]
        cr = [c for c in cr if c and c in rents]
        death, name, cco = [], None, None
        for c in cr:
            re_ = rents[c]
            for v in claim_vals(re_, "P570"):
                if isinstance(v, dict) and "time" in v:
                    m = re.match(r"([+-])(\d+)-", v["time"])
                    if m:
                        death.append(int(m.group(2)) * (-1 if m.group(1) == "-" else 1))
            nm = label_of(re_)
            if nm and not name and not re.search(r"anonym|unknown|master of|workshop|school|circle|follower|studio|atelier", nm, re.I) \
                    and c != "Q4233718":
                name = nm
            for v in claim_vals(re_, "P27"):
                if qid_of(v) in rents and not cco:
                    cco = label_of(rents[qid_of(v)])
        if death and max(death) > 1955:
            drops["creator died after 1955"] += 1
            continue
        names = lambda prop: [label_of(rents[qid_of(v)]) for v in claim_vals(e, prop) if qid_of(v) in rents and label_of(rents[qid_of(v)])]
        orig, loc, coll, mvs = names("P495"), names("P276"), names("P195"), names("P135")
        co = None
        for txt in ([cco] if cco else []) + orig + [t]:
            co = C.country_of(txt)
            if co:
                break
        if not co:
            for txt in orig + loc + [t]:
                for rx, cc_ in PLACE_CO:
                    if cc_ and rx.search(txt):
                        co = cc_
                        break
                if co:
                    break
        if not co and cco:
            co = cco if len(cco) < 28 else None
        if co is None and re.search(r"pompeii|herculaneum|fayum|roman", " ".join(orig + loc + [t]), re.I):
            co = "Italy"
        co = M.norm_co(co)
        fn_ = fn.replace(" ", "_")
        r = dict(q=q, id=f"commons-{q}", src="commons", t=C.clean_title(t), a=C.clean_artist(name) if name else None, y=y, span=span,
                 co=co, mv=mvs[0] if mvs else None, fn=fn, yorck=bool(re.search(r"yorck", fn, re.I)),
                 img="https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn_) + "?width=400",
                 url="https://www.wikidata.org/wiki/" + q)
        if r["id"] in held.ids or f"commons-{q}" in held.ids:
            drops["already held (id)"] += 1
            continue
        if f"commons-{q}" in held.nonpaint:
            drops["hand-listed non-painting"] += 1
            continue
        if M.fname(r["img"]) in held.files:
            drops["image file already held"] += 1
            continue
        cand.append(r)
    print("candidates for licence check:", len(cand), flush=True)
    de_gb.commons_lic([r["fn"].replace("_", " ") for r in cand])
    rows, seen = [], set()
    for r in cand:
        L = de_gb.norm_lic(de_gb.lic.get(r["fn"].replace("_", " "), ""))
        if not L:
            drops["image licence not CC0/PD/CC BY/CC BY-SA on Commons"] += 1
            continue
        if r["id"] in seen:
            drops["duplicate id"] += 1
            continue
        seen.add(r["id"])
        if held.twin(r):
            drops["artist+title+year twin of a held/staged row"] += 1
            continue
        held.add(r)
        r["license"] = L
        if L.startswith("CC BY"):
            r["src"], r["id"] = "commonscc", f"commonscc-{r['q']}"
            r["url"] = "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(r["fn"].replace(" ", "_"))
        rows.append(r)
    files = M.write("wd", rows)
    st = dict(source="Wikidata+Commons", entities=len(ents), new=len(rows), drops=dict(drops), files=files,
              yorck=sum(1 for r in rows if r["yorck"]), licenses=dict(Counter(r["license"] for r in rows)),
              no_country=sum(1 for r in rows if not r["co"]), no_artist=sum(1 for r in rows if not r["a"]))
    print(json.dumps(st, ensure_ascii=False), flush=True)
    (SCR / "stats" / "ma-wd.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))
    return rows
