"""Wikidata-collection staging (2026-10-22): paintings held by a collection (P195), read from Wikidata (CC0 metadata) with the
Wikimedia Commons image name (P18). Nothing is downloaded: `img` is a Special:FilePath thumbnail URL, as in the existing
commons rows. Rows: id "commons-<QID>", src "commons", url = the Wikidata record, license "PD".

Public-domain gate (the image is a photograph of a flat 2D work; the work itself must be out of copyright):
  creator died in or before PD_DEATH (1955), or no creator is recorded and the work is dated 1800 or earlier.
Real paintings only: P31 painting (or a subclass) and not a drawing/print/photo/sculpture; titles that name those are dropped.
Wikimedia politeness: UA Chromatlas/1.0, maxlag=5 on the Commons API, one request at a time, 2 s apart.
Scratch (SPARQL answers) lives in $STAGE_SCRATCH/raw/wd and is deleted by the caller when done.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib  # noqa: E402
from lib import C, OUT, SCR, Held, clean, NON_WESTERN_CO, _k  # noqa: E402
import glob  # noqa: E402

RAWD = SCR / "raw" / "wd"
RAWD.mkdir(parents=True, exist_ok=True)
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
PD_DEATH = 1955
GAP = 2.0
_last = [0.0]

NOT_PAINTING = re.compile(r"\b(drawing|sketch|etching|engraving|lithograph|woodcut|print|photograph|sculpture|bust|statue|relief|"
                          r"medal|coin|vase|ceramic|tapestry|manuscript|miniature book|map of|poster|stamp|postcard|"
                          r"dibujo|grabado|estampa|escultura|rysunek|rycina|grafika|kresba|rajz|zeichnung|tegning|teckning)\b", re.I)


def sparql(q, tag, tries=6):
    """One SPARQL answer, cached by tag. One request at a time, GAP seconds apart; retries on 429/5xx/timeouts."""
    p = RAWD / (re.sub(r"[^A-Za-z0-9_.-]", "_", tag) + ".json")
    if p.exists():
        return json.loads(p.read_text())
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    for i in range(tries):
        w = _last[0] + GAP - time.time()
        if w > 0:
            time.sleep(w)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read().decode("utf-8"))
            p.write_text(json.dumps(d))
            return d
        except urllib.error.HTTPError as e:
            print(f"   WDQS HTTP {e.code} ({tag}); retry", flush=True)
            if e.code in (400, 403):
                raise
            time.sleep(10 * (i + 1) if e.code == 429 else 6 * (i + 1))
        except Exception as e:  # timeouts, resets
            print(f"   WDQS failed ({e}); retry", flush=True)
            time.sleep(6 * (i + 1))
    raise RuntimeError("WDQS gave up: " + tag)


Q = """SELECT ?item ?im ?inc ?inc2 ?crl ?cr0 ?dd ?ctl ?mvl WHERE {
 ?item wdt:P195 %s . ?item wdt:P31/wdt:P279* wd:Q3305213 . %s
 ?item wdt:P18 ?im .
 OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P1319 ?inc2 }
 OPTIONAL { ?item wdt:P170 ?cr0 . OPTIONAL { ?cr0 rdfs:label ?crl FILTER(lang(?crl)='en') } OPTIONAL { ?cr0 wdt:P570 ?dd }
            OPTIONAL { ?cr0 wdt:P27 ?ct . ?ct rdfs:label ?ctl FILTER(lang(?ctl)='en') } }
 OPTIONAL { ?item wdt:P135 ?mvq . ?mvq rdfs:label ?mvl FILTER(lang(?mvl)='en') }
}"""
LANGS = ['en', 'es', 'pt', 'sv', 'nb', 'no', 'fi', 'pl', 'cs', 'hu', 'de', 'fr', 'el', 'ga', 'lv', 'et', 'lt', 'it', 'nl', 'da', 'ca', 'sk', 'sl', 'hr']
QL = """SELECT ?item ?l (LANG(?l) AS ?lg) WHERE { VALUES ?item { %s } ?item rdfs:label ?l FILTER(lang(?l) IN (""" + ",".join(f"'{x}'" for x in LANGS) + """)) }"""


def collection_items(coll_expr, tag):
    """All painting items (with image) of a collection. One plain query (fast: a LIMIT/ORDER BY subselect is what WDQS chokes on);
    if that fails, the collection is split into PARTS hash partitions of the item number."""
    try:
        d = sparql(Q % (coll_expr, ""), f"{tag}-all", tries=3)
        return aggregate(d["results"]["bindings"])
    except RuntimeError:
        pass
    out, parts = [], 8
    for k in range(parts):
        flt = f"BIND(xsd:integer(SUBSTR(STR(?item), 33)) AS ?n) FILTER(?n - {parts} * FLOOR(?n / {parts}) = {k})"
        d = sparql(Q % (coll_expr, flt), f"{tag}-part{k}")
        out += d["results"]["bindings"]
    return aggregate(out)


def aggregate(bindings):
    """Fold the joined rows into one record per item: earliest date, latest creator death, first creator/country/movement."""
    by = {}
    for b in bindings:
        v = lambda k: b[k]["value"] if k in b else None
        q = v("item").rsplit("/", 1)[1]
        it = by.setdefault(q, dict(q=q, img=None, inc=[], inc2=[], cr=None, crs=set(), death=[], ctry=None, mv=None))
        it["img"] = it["img"] or v("im")
        for k in ("inc", "inc2"):
            if year_of(v(k)) is not None:
                it[k].append(year_of(v(k)))
        if v("cr0"):
            it["crs"].add(v("cr0"))
        if v("crl") and not it["cr"] and not re.fullmatch(r"Q\d+", v("crl")):
            it["cr"] = v("crl")
        if year_of(v("dd")) is not None:
            it["death"].append(year_of(v("dd")))
        it["ctry"] = it["ctry"] or v("ctl")
        it["mv"] = it["mv"] or v("mvl")
    return list(by.values())


def year_of(s):
    m = re.match(r"^(-?\d{1,4})-", s or "")
    return int(m.group(1)) if m else None


def to_row(it, coll_label):
    q = it["q"]
    y1 = min(it["inc"]) if it["inc"] else None
    y2 = max(it["inc2"]) if it["inc2"] else None
    y = y1 if y1 is not None else (min(it["inc2"]) if it["inc2"] else None)
    span = abs(y2 - y1) if y1 is not None and y2 is not None else None
    name = it["cr"]
    img = it["img"]
    img = img.replace("http://", "https://") + ("&" if "?" in img else "?") + "width=400" if img else None
    ctry = C.country_of(it["ctry"]) if it["ctry"] else None
    return dict(q=q, id=f"commons-{q}", src="commons", t=None, a=C.clean_artist(name) if name else None, y=y, span=span,
                co=ctry, mv=it["mv"], img=img, death=max(it["death"]) if it["death"] else None, ncr=len(it["crs"]), coll=coll_label)


def pd_ok(r):
    """Out of copyright by the creator's death (<= 1955), or anonymous and dated 1800 or earlier."""
    if r["death"] is not None:
        return r["death"] <= PD_DEATH
    if r["ncr"] == 0 or not r["a"]:
        return r["y"] is not None and r["y"] <= 1800
    return r["y"] is not None and r["y"] <= 1850   # a named creator whose death is not recorded: only old works


def english_labels(qids, tag):
    """A label for each item (English first, then the other languages in LANGS), 150 items at a time."""
    best = {}
    for i in range(0, len(qids), 150):
        part = qids[i:i + 150]
        d = sparql(QL % " ".join("wd:" + q for q in part), f"{tag}-lab-{i}")
        for b in d["results"]["bindings"]:
            q, lg = b["item"]["value"].rsplit("/", 1)[1], b["lg"]["value"]
            rank = LANGS.index(lg) if lg in LANGS else 99
            if q not in best or rank < best[q][0]:
                best[q] = (rank, b["l"]["value"])
    return {q: v[1] for q, v in best.items()}


def other_staged_twins(held, museum):
    n = 0
    for f in glob.glob(str(OUT / "*.json")):
        if f"zz-museum-{museum}-" in f:
            continue
        for r in json.load(open(f)):
            held.staged_ids.add(r["id"])
            held._tw(r)
            n += 1
    return n


def run(museum, colls, label, country=None, extra_filter=None):
    """colls: list of (QID, label). Stage everything and write the files; returns stats."""
    held = Held()
    other_staged_twins(held, museum)
    drops, rows, seen, held_n, total = Counter(), [], set(), 0, 0
    for c in colls:
        qid, cl = c[0], c[1]
        cc = c[2] if len(c) > 2 else country
        raw = collection_items(f"wd:{qid}", f"{museum}-{qid}")
        total += len(raw)
        rs = [to_row(b, cl) for b in raw]
        labs = english_labels([r["q"] for r in rs], f"{museum}-{qid}")
        for r in rs:
            r["t"] = labs.get(r["q"])
        for r in rs:
            if not r["t"] or re.fullmatch(r"Q\d+", r["t"]):
                drops["no label"] += 1
                continue
            if r["id"] in held.ids:
                held_n += 1
                continue
            if r["id"] in held.staged_ids:
                drops["already staged elsewhere"] += 1
                continue
            if r["id"] in seen:
                drops["duplicate id"] += 1
                continue
            seen.add(r["id"])
            if NOT_PAINTING.search(r["t"]):
                drops["title names a drawing/print/photo/sculpture/object"] += 1
                continue
            if not pd_ok(r):
                drops["not clearly public domain (creator died after 1955 / undated)"] += 1
                continue
            if not r["a"] and r["y"] is None:
                drops["no artist and no date"] += 1
                continue
            if f"commons-{r['q']}" in held.nonpaint:
                drops["hand-listed non-painting"] += 1
                continue
            why = clean(r)
            if why:
                drops[why] += 1
                continue
            if r["co"] in NON_WESTERN_CO:
                drops["non-Western painting, set aside"] += 1
                continue
            if extra_filter and not extra_filter(r):
                drops["source-specific filter"] += 1
                continue
            if held.is_twin(r):
                drops["artist+title+year twin of a held/staged row"] += 1
                continue
            held.add_twin(r)
            r["license"] = "PD"
            r["url"] = "https://www.wikidata.org/wiki/" + r["q"]
            if not r["co"] and cc:
                r["co"] = cc if not r["a"] else None
            rows.append({k: r.get(k) for k in ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")})
    rows.sort(key=lambda r: r["id"])
    for old in OUT.glob(f"zz-museum-{museum}-*.json"):
        old.unlink()
    files = []
    for i in range(0, len(rows), 5000):
        p = OUT / f"zz-museum-{museum}-{i // 5000 + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows[i:i + 5000]) + "\n]\n")
        files.append(p.name)
    st = dict(museum=museum, label=label, source="Wikidata collection query", wd_paintings_with_image=total, already_held=held_n,
              new_staged=len(rows), dropped=dict(drops), files=files, countries=dict(Counter(r["co"] for r in rows).most_common(8)),
              no_artist=sum(1 for r in rows if not r["a"]))
    (SCR / "stats").mkdir(exist_ok=True)
    (SCR / "stats" / f"{museum}.json").write_text(json.dumps(st, indent=1))
    print(json.dumps(st), flush=True)
    return st
