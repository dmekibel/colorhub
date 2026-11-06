#!/usr/bin/env python3
"""Per-painting Wikidata layer: finds each corpus row's Wikidata item and collects museum, size, medium, movement, genre, fame.
READ-ONLY on data/. Writes only under research/_raw/enrich/ (gitignored).

  python3 tools/wikidata_enrich.py                 run (resumes from cache; downloads only what is not cached)
  python3 tools/wikidata_enrich.py --refresh       re-download the bulk Wikidata dumps (do this when Wikidata has changed a lot)
  python3 tools/wikidata_enrich.py --offline       fail instead of downloading anything missing
  python3 tools/wikidata_enrich.py --only met,aic  restrict to some row-id prefixes (met, aic, commons-Q, commons-F, ...)

Incremental on new corpus rows: just rerun (no --refresh). Bulk dumps come from cache; rows are re-matched in seconds, and
QIDs that appear in new rows but not in the cached painting dump are fetched in small VALUES batches (cached per batch).

Outputs
  research/_raw/enrich/enrich.json   {row id: {qid, mu, city, size:[h,w], medium, mv, mv_raw, genre:[..], fame}}   (only fields that exist)
  research/_raw/enrich/report.txt    coverage before/after per field and per source + 30 random samples
  research/_raw/enrich/cache/        TSV dumps of Wikidata (QLever), one file per query

How rows are matched (a row is matched at most once; method recorded in the report):
  commons-Q<n>, bsb-/bsbcc-/smb-/smbcc-/staedel-/wales-Q<n>   the QID is in the id
  commons-F / cf- / commonscc-                                 the Commons file name in the row's img/url == Wikidata image (P18)
  met P3634, aic P4610, nga P4683, rijks P13234, nm P2539, cma P4659 (the museum's own id property on Wikidata)
  smk, ycba, saam, yuag, npg, chndm, fsg, nmafa, walters        inventory number (P217) + the item's collection (P195) must look like the museum
Endpoint: QLever's Wikidata mirror, https://qlever.dev/api/wikidata (polite: one query at a time, back off on 429/503, stop on 403).
"""
import argparse, glob, json, os, random, re, sys, time, urllib.parse, urllib.request, urllib.error
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
OUT = ROOT / "research" / "_raw" / "enrich"
CACHE = OUT / "cache"
ENDPOINT = "https://qlever.dev/api/wikidata"
UA = "Chromatlas-research/1.0 (dmekibel@gmail.com)"
PREFIXES = """PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
"""
PAINTING = "?i wdt:P31 wd:Q3305213 ."
OFFLINE = False
REFRESH = False

# ---------------------------------------------------------------- HTTP
def run_query(q, key, tsv=True):
    f = CACHE / f"{key}.tsv"
    if f.exists() and not REFRESH:
        return f
    if OFFLINE:
        raise SystemExit(f"--offline and no cache for {key}")
    data = urllib.parse.urlencode({"query": PREFIXES + q}).encode()
    delay = 20
    for attempt in range(8):
        try:
            req = urllib.request.Request(ENDPOINT, data=data, headers={
                "User-Agent": UA, "Accept": "text/tab-separated-values"})
            with urllib.request.urlopen(req, timeout=1800) as r:
                tmp = f.with_suffix(".part")
                with open(tmp, "wb") as w:
                    while True:
                        b = r.read(1 << 20)
                        if not b:
                            break
                        w.write(b)
                tmp.rename(f)
            time.sleep(1.0)
            return f
        except urllib.error.HTTPError as e:
            if e.code == 403:
                raise SystemExit(f"403 from endpoint on {key}: blocked, stopping (not working around it)")
            if e.code in (429, 503, 504, 502):
                print(f"  {key}: HTTP {e.code}, waiting {delay}s", flush=True)
                time.sleep(delay); delay = min(delay * 2, 300); continue
            body = e.read()[:300]
            raise SystemExit(f"{key}: HTTP {e.code} {body}")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f"  {key}: {e}, retry in {delay}s", flush=True)
            time.sleep(delay); delay = min(delay * 2, 300)
    raise SystemExit(f"{key}: gave up")


def term(s):
    s = s.strip()
    if s.startswith("<") and s.endswith(">"):
        return s[1:-1]
    if s.startswith('"'):
        m = re.match(r'^"(.*)"(?:@[\w-]+|\^\^<[^>]*>)?$', s, re.S)
        if m:
            s = m.group(1)
        return s.replace("\\t", "\t").replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
    return s


def rows(path):
    with open(path, encoding="utf-8") as fh:
        next(fh, None)
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            yield [term(p) for p in parts]


def qid(u):
    return u.rsplit("/", 1)[-1]

# ---------------------------------------------------------------- vocab
try:
    from wikidata_artists import fold_movement  # the app's own label folding
except Exception:
    def fold_movement(label):
        return None

SUPPORTS = {"canvas": "canvas", "panel": "panel", "wood": "panel", "wood panel": "panel", "oak": "panel", "poplar": "panel", "paper": "paper",
            "copper": "copper", "parchment": "parchment", "vellum": "vellum", "silk": "silk", "cardboard": "cardboard", "board": "board",
            "stone": "stone", "plaster": "plaster", "wall": "wall", "ivory": "ivory", "linen": "linen", "slate": "slate", "paperboard": "paperboard",
            "hardboard": "hardboard", "masonite": "masonite", "tin": "tin", "zinc": "zinc", "glass": "glass", "textile": "textile", "cotton": "cotton",
            "metal": "metal", "silver": "silver", "gold": "gold", "bronze": "bronze", "leather": "leather", "plywood": "plywood", "ceramic": "ceramic",
            "paper on canvas": "paper on canvas", "wove paper": "paper", "laid paper": "paper", "washi": "washi", "rice paper": "rice paper",
            "fiberboard": "fiberboard", "aluminium": "aluminium", "marble": "marble", "limestone": "stone", "lime wood": "panel"}
MEDIA = {"oil paint": "oil", "oil": "oil", "tempera": "tempera", "egg tempera": "egg tempera", "watercolor": "watercolor", "watercolour": "watercolor",
         "watercolor paint": "watercolor", "gouache": "gouache", "acrylic paint": "acrylic", "acrylic": "acrylic", "fresco": "fresco",
         "ink": "ink", "india ink": "ink", "pastel": "pastel", "charcoal": "charcoal", "encaustic": "encaustic", "gold leaf": "gold leaf",
         "graphite": "graphite", "chalk": "chalk", "pencil": "pencil", "paint": "paint", "distemper": "distemper", "oil on canvas": "oil on canvas",
         "secco": "secco", "casein": "casein", "lacquer": "lacquer", "pigment": "pigment", "colour": "color", "color": "color", "ink wash": "ink wash",
         "tusche": "ink", "sumi ink": "ink", "ink painting": "ink", "oil pastel": "oil pastel", "mineral pigment": "mineral pigment",
         "bodycolor": "gouache", "body color": "gouache", "wax": "wax", "varnish": "varnish", "aquarelle": "watercolor", "lead white": "paint"}


def medium_phrase(labels):
    """labels = English P186 labels -> 'oil on canvas' style phrase (or None)."""
    media, sup, other = [], [], []
    for l in labels:
        k = l.strip().lower()
        if re.fullmatch(r".+ on .+", k) and len(k) < 40:
            return k  # already a ready phrase ("oil on canvas")
        if k in MEDIA and MEDIA[k] not in media: media.append(MEDIA[k])
        elif k in SUPPORTS and SUPPORTS[k] not in sup: sup.append(SUPPORTS[k])
        elif k not in other: other.append(k)
    media = [m for m in media if m != "paint"] or media
    if not media and not sup:
        # unknown materials: keep up to two short words so a rare medium is not lost
        o = [x for x in other if len(x) < 24][:2]
        return " and ".join(o) or None
    if media and sup:
        return f"{' and '.join(media[:2])} on {sup[0]}"
    return (" and ".join(media[:2])) if media else sup[0]

UNIT_CM = {"Q174728": 1.0, "Q174789": 0.1, "Q11573": 100.0, "Q218593": 2.54, "Q3710": 30.48, "Q200323": 10.0}

# movement label spelling the corpus already uses
CORPUS_MV = set()
CORPUS_MV_LOWER = {}

def canon_mv(label):
    if not label:
        return None
    if label.lower() in CORPUS_MV_LOWER:
        return CORPUS_MV_LOWER[label.lower()]
    f = fold_movement(label)
    if f:
        return f
    for m in CORPUS_MV:
        if m.lower() == label.lower():
            return m
    return label

# ---------------------------------------------------------------- source tables
QID_IN_ID = {"commons-Q", "bsb-", "bsbcc-", "smb-", "smbcc-", "staedel-", "wales-"}
OWN_PROP = {"met": "P3634", "aic": "P4610", "nga": "P4683", "rijks": "P13234", "nm": "P2539", "cma": "P4659"}
INV_COLL = {  # P217 + collection label regex
    "smk": r"statens museum|smk", "ycba": r"yale center for british", "saam": r"smithsonian american art",
    "yuag": r"yale university art gallery", "npg": r"national portrait gallery", "chndm": r"cooper|smithsonian design",
    "fsg": r"freer|sackler|asian art", "nmafa": r"african art", "walters": r"walters"}
FILE_SRC = ("commons-F", "cf", "commonscc")


def src_of(rid):
    if rid.startswith("commons-Q"): return "commons-Q"
    if rid.startswith("commons-F"): return "commons-F"
    return re.match(r"[a-zA-Z]+", rid).group(0)


def norm_file(name):
    name = urllib.parse.unquote(name)
    name = name.split("?")[0]
    return re.sub(r"[ _]+", " ", name).strip().lower()


def row_filename(r):
    for k in ("img", "url"):
        v = r.get(k) or ""
        m = re.search(r"Special:FilePath/([^?]+)", v) or re.search(r"/wiki/(?:File|Fichier|Datei)(?::|%3A)([^?#]+)", v, re.I)
        if m:
            return norm_file(m.group(1))
    return None


def load_corpus():
    out = []
    for f in sorted(glob.glob(str(ROOT / "data/corpus/*.json"))):
        out.extend(json.load(open(f)))
    return out


def main():
    global OFFLINE, REFRESH
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    OFFLINE, REFRESH = a.offline, a.refresh
    CACHE.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    corpus = load_corpus()
    only = [x for x in a.only.split(",") if x]
    if only:
        corpus = [r for r in corpus if any(r["id"].startswith(o if o.endswith("-") or "-" in o else o + "-") for o in only)]
    CORPUS_MV.update(r["mv"] for r in corpus if r.get("mv"))
    for m in sorted(CORPUS_MV, key=lambda m: m != m[:1].upper() + m[1:]):  # prefer the capitalised spelling
        CORPUS_MV_LOWER[m.lower()] = CORPUS_MV_LOWER.get(m.lower()) or m
    print(f"{len(corpus)} rows", flush=True)

    # ---- 1. id maps -------------------------------------------------
    need_src = Counter(src_of(r["id"]) for r in corpus)
    row_qid, how = {}, {}
    # (a) QID inside the id
    for r in corpus:
        rid = r["id"]
        m = re.match(r"(?:commons|bsb|bsbcc|smb|smbcc|staedel|wales)-(Q\d+)$", rid)
        if m:
            row_qid[rid] = m.group(1); how[rid] = "id"
    # (b) museum own-id properties
    for s, prop in OWN_PROP.items():
        if not need_src.get(s): continue
        f = run_query(f"SELECT ?i ?v WHERE {{ {PAINTING} ?i wdt:{prop} ?v }}", f"ids_{prop}")
        m = defaultdict(list)
        for i, v in rows(f):
            m[v].append(qid(i))
        for r in corpus:
            if src_of(r["id"]) == s and r["id"] not in row_qid:
                c = m.get(r["id"].split("-", 1)[1])
                if c: row_qid[r["id"]] = c[0]; how[r["id"]] = prop
    # (c) inventory number + collection
    if any(need_src.get(s) for s in INV_COLL):
        f = run_query(f"SELECT ?i ?v ?l WHERE {{ {PAINTING} ?i wdt:P217 ?v . ?i wdt:P195 ?m . ?m rdfs:label ?l FILTER(LANG(?l)=\"en\") }}", "ids_P217_coll")
        m = defaultdict(list)
        for i, v, l in rows(f):
            m[v].append((qid(i), l))
        for r in corpus:
            s = src_of(r["id"])
            if s in INV_COLL and r["id"] not in row_qid:
                for q, l in m.get(r["id"].split("-", 1)[1], ()):
                    if re.search(INV_COLL[s], l, re.I):
                        row_qid[r["id"]] = q; how[r["id"]] = "P217+P195"; break
    # (d) commons files via P18
    if any(need_src.get(s) for s in FILE_SRC):
        f = run_query(f"SELECT ?i ?x WHERE {{ {PAINTING} ?i wdt:P18 ?x }}", "ids_P18")
        m = defaultdict(list)
        for i, x in rows(f):
            m[norm_file(x.rsplit("Special:FilePath/", 1)[-1])].append(qid(i))
        for r in corpus:
            if src_of(r["id"]) in FILE_SRC and r["id"] not in row_qid:
                fn = row_filename(r)
                c = m.get(fn) if fn else None
                if c: row_qid[r["id"]] = c[0]; how[r["id"]] = "P18"
    print(f"matched {len(row_qid)} rows ({time.time()-t0:.0f}s)", flush=True)

    # ---- 2. field tables for the needed QIDs -------------------------
    needed = set(row_qid.values())
    T = {k: defaultdict(list) for k in ("mu", "city", "h", "w", "mat", "mv", "genre", "fame")}
    def stream(key, q, fn, subj_vals=None):
        f = run_query(q, key)
        for parts in rows(f):
            q0 = qid(parts[0])
            if q0 in needed: fn(q0, parts)

    FIELDS = {
        "mu": ("?i ?m ?l", "?i wdt:P195 ?m . ?m rdfs:label ?l FILTER(LANG(?l)=\"en\")", lambda q, p: T["mu"][q].append((qid(p[1]), p[2]))),
        "mat": ("?i ?l", "?i wdt:P186 ?m . ?m rdfs:label ?l FILTER(LANG(?l)=\"en\")", lambda q, p: T["mat"][q].append(p[1])),
        "mv": ("?i ?l", "?i wdt:P135 ?m . ?m rdfs:label ?l FILTER(LANG(?l)=\"en\")", lambda q, p: T["mv"][q].append(p[1])),
        "genre": ("?i ?l", "?i wdt:P136 ?m . ?m rdfs:label ?l FILTER(LANG(?l)=\"en\")", lambda q, p: T["genre"][q].append(p[1])),
        "fame": ("?i ?n", "?i wikibase:sitelinks ?n", lambda q, p: T["fame"].__setitem__(q, int(float(p[1])))),
        "h": ("?i ?v ?u", "?i p:P2048 ?s . ?s psv:P2048 ?x . ?x wikibase:quantityAmount ?v ; wikibase:quantityUnit ?u",
              lambda q, p: T["h"][q].append((float(p[1]), qid(p[2])))),
        "w": ("?i ?v ?u", "?i p:P2049 ?s . ?s psv:P2049 ?x . ?x wikibase:quantityAmount ?v ; wikibase:quantityUnit ?u",
              lambda q, p: T["w"][q].append((float(p[1]), qid(p[2])))),
    }
    def fetch_all(subject_clause, tag):
        for name, (sel, body, fn) in FIELDS.items():
            stream(f"f_{name}{tag}", f"SELECT {sel} WHERE {{ {subject_clause} {body} }}", fn)
    fetch_all(PAINTING, "")
    print(f"painting dump read ({time.time()-t0:.0f}s)", flush=True)
    # QIDs not typed as painting (e.g. drawings, icons, miniatures that were found by id) are fetched in VALUES batches
    have = set(T["fame"]) | set(T["mu"]) | set(T["h"]) | set(T["mat"])
    f_known = run_query(f"SELECT ?i WHERE {{ {PAINTING} }}", "painting_items")
    painting_set = {qid(p[0]) for p in rows(f_known)}
    extra = sorted(q for q in needed if q not in painting_set)
    print(f"{len(extra)} matched items are not instance-of painting, fetching in batches", flush=True)
    for b in range(0, len(extra), 800):
        chunk = extra[b:b + 800]
        vals = " ".join("wd:" + q for q in chunk)
        for name, (sel, body, fn) in FIELDS.items():
            f = run_query(f"SELECT {sel} WHERE {{ VALUES ?i {{ {vals} }} {body} }}", f"x_{name}_{b}_{len(chunk)}_{chunk[0]}")
            for parts in rows(f):
                fn(qid(parts[0]), parts)

    # museum -> city (P131 of the holding museum, else P159/P17-less fallback)
    mu_ids = sorted({m for v in T["mu"].values() for m, _ in v})
    city = {}
    CITY_TYPES = "(wd:Q515 1) (wd:Q1549591 1) (wd:Q1637706 1) (wd:Q5119 2) (wd:Q484170 3) (wd:Q3957 3) (wd:Q262166 3) (wd:Q15284 4) (wd:Q123705 4) (wd:Q532 5) (wd:Q15303838 4)"
    best = {}
    for b in range(0, len(mu_ids), 300):
        chunk = mu_ids[b:b + 300]
        vals = " ".join("wd:" + q for q in chunk)
        f = run_query(f"SELECT ?m ?l ?pri WHERE {{ VALUES ?m {{ {vals} }} ?m (wdt:P131|wdt:P159)?/wdt:P131?/wdt:P131?/wdt:P131? ?c . ?c wdt:P31 ?t . VALUES (?t ?pri) {{ {CITY_TYPES} }} ?c rdfs:label ?l FILTER(LANG(?l)=\"en\") }}", f"city2_{b}_{chunk[0]}")
        for parts in rows(f):
            pri = int(float(parts[2]))
            if parts[0] not in best or pri < best[parts[0]][0]:
                best[parts[0]] = (pri, parts[1])
    rest = [q for q in mu_ids if ("http://www.wikidata.org/entity/" + q) not in best]
    for b in range(0, len(rest), 300):  # fallback: the museum's own P131/P159 label (Vienna, Madrid, ... are not typed "city")
        chunk = rest[b:b + 300]
        vals = " ".join("wd:" + q for q in chunk)
        f = run_query(f"SELECT ?m ?l WHERE {{ VALUES ?m {{ {vals} }} ?m wdt:P131|wdt:P159 ?c . ?c rdfs:label ?l FILTER(LANG(?l)=\"en\") }}", f"city3_{b}_{chunk[0]}")
        for parts in rows(f):
            if parts[0] not in best: best[parts[0]] = (9, parts[1])
    for k, (pri, l) in best.items():
        city[qid(k)] = re.sub(r" (Municipality|municipality)$", "", l)

    # ---- 3. build enrich.json --------------------------------------
    def cm(vals):
        for v, u in vals:
            f = UNIT_CM.get(u)
            if f and 0 < v * f < 4000:
                return round(v * f, 1)
        return None
    enrich = {}
    for rid, q in row_qid.items():
        e = {"qid": q}
        mus = T["mu"].get(q)
        if mus:
            mq, ml = mus[0]
            e["mu"] = ml
            if mq in city: e["city"] = city[mq]
        h, w = cm(T["h"].get(q, [])), cm(T["w"].get(q, []))
        if h and w: e["size"] = [h, w]
        if q in T["mat"]:
            ph = medium_phrase(list(dict.fromkeys(T["mat"][q])))
            if ph: e["medium"] = ph
        if q in T["mv"]:
            raw = T["mv"][q][0]
            e["mv_raw"] = raw
            e["mv"] = canon_mv(raw)
        if q in T["genre"]: e["genre"] = list(dict.fromkeys(T["genre"][q]))[:4]
        if q in T["fame"]: e["fame"] = T["fame"][q]
        enrich[rid] = e
    (OUT / "enrich.json").write_text(json.dumps(enrich, ensure_ascii=False, separators=(",", ":")))

    # ---- 4. report ---------------------------------------------------
    by = {r["id"]: r for r in corpus}
    lines = [f"wikidata_enrich report  rows={len(corpus)}  matched={len(row_qid)}  run={time.time()-t0:.0f}s (cached downloads excluded if rerun)", ""]
    def has_corpus(r, f): return bool(r.get(f))
    flds = [("mv", "mv"), ("medium", "medium"), ("mu", None), ("size", None), ("genre", None), ("fame", None), ("city", None)]
    srcs = sorted(need_src, key=lambda s: -need_src[s])
    lines.append("COVERAGE  (rows that now have the field -> rows with the field after merging this layer; 'fills' = rows lacking it that this would fill)")
    lines.append(f"{'field':<8}{'before':>9}{'enrich has':>12}{'fills':>9}{'after':>9}{'after %':>9}")
    for name, cf in flds:
        before = sum(1 for r in corpus if cf and has_corpus(r, cf))
        eh = sum(1 for rid, e in enrich.items() if name in e)
        fills = sum(1 for rid, e in enrich.items() if name in e and not (cf and has_corpus(by[rid], cf)))
        lines.append(f"{name:<8}{before:>9}{eh:>12}{fills:>9}{before+fills:>9}{(before+fills)/len(corpus)*100:>8.1f}%")
    lines += ["", "PER SOURCE  (rows | matched | via | mv before->fills | medium before->fills | mu | size | genre | fame)"]
    for s in srcs:
        ids = [r["id"] for r in corpus if src_of(r["id"]) == s]
        mt = [i for i in ids if i in enrich]
        vias = Counter(how[i] for i in mt)
        def c(f): return sum(1 for i in mt if f in enrich[i])
        mvb = sum(1 for i in ids if by[i].get("mv")); mvf = sum(1 for i in mt if "mv" in enrich[i] and not by[i].get("mv"))
        mdb = sum(1 for i in ids if by[i].get("medium")); mdf = sum(1 for i in mt if "medium" in enrich[i] and not by[i].get("medium"))
        lines.append(f"{s:<10} {len(ids):>7} | {len(mt):>7} ({len(mt)/len(ids)*100:4.0f}%) via {dict(vias)} | mv {mvb}->+{mvf} | medium {mdb}->+{mdf} | mu {c('mu')} | size {c('size')} | genre {c('genre')} | fame {c('fame')}")
    # movement disagreements / new labels
    dis = Counter(); new = Counter()
    for rid, e in enrich.items():
        if "mv" in e:
            old = by[rid].get("mv")
            if old and old != e["mv"]: dis[(old, e["mv"])] += 1
            if e["mv"] not in CORPUS_MV: new[e["mv"]] += 1
    lines += ["", f"MOVEMENT: labels not already in the corpus (top 25): {new.most_common(25)}", f"MOVEMENT: rows where corpus mv != wikidata mv (top 15): {dis.most_common(15)}"]
    mc = Counter(e["medium"] for e in enrich.values() if "medium" in e)
    lines += ["", f"MEDIUM top 25: {mc.most_common(25)}"]
    random.seed(7)
    lines += ["", "30 RANDOM SAMPLES"]
    for rid in random.sample(sorted(enrich), min(30, len(enrich))):
        r = by[rid]
        lines.append(f"{rid} | {r.get('a')} | {r.get('t')} | {r.get('y')} | corpus mv={r.get('mv')} -> {json.dumps(enrich[rid], ensure_ascii=False)}")
    (OUT / "report.txt").write_text("\n".join(lines))
    print("\n".join(lines[:60]))
    print(f"done {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
