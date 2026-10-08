#!/usr/bin/env python3
"""ColorHub art wiki: painter metadata and painting movements from Wikidata (CC0).

  python3 tools/wikidata_artists.py [--raw DIR] [--offline]
      -> research/_raw/wikidata/*.json   raw SPARQL responses (gitignored; re-runs read them instead of the network)
      -> data/artists/meta.json          compact painter metadata + the list of all painters (read by js/artwiki.js)
      -> data/artists/movements-wd.json  {painting id: movement} for paintings with no AIC movement (read by
                                         tools/analyze.py, so byMovement can cover more than the AIC rows)

Three questions, asked of query.wikidata.org (all Wikidata statements are CC0):
  1. For every Commons painting in the corpus (ids "commons-Q123"): who is its creator (P170) and what movement
     (P135) does Wikidata record for the painting itself?
  2. For every painter with analysis data (data/analysis/artists/*.json, 837): which Wikidata item are they?
     First by the majority creator of their Commons paintings, else by an exact label match on a person whose
     occupation is an artist's, checked against the painter's own years (a namesake born 300 years too late
     is rejected).
  3. For each resolved painter: birth/death (P569/P570), country of citizenship (P27), movement (P135),
     teacher (P1066), influenced by (P737), portrait image on Commons (P18), English Wikipedia title.

Honesty about coverage is written into meta.json ("cov"): how many painters resolved and how many have each field.
Teacher / influence links are kept only as names (with the Wikidata id); js/artwiki.js links a name to a painter
page when that id belongs to one of our painters ("tie" below: palette similarity from the three numbers
the analysis stores per painter: mean L*, mean C*, warm fraction).

Movement labels are folded into one list of canonical names (MOVE_FOLD) so "French Impressionism" and
"impressionism" are one movement, and only movements that reach MIN_MOVE_N paintings are kept.
"""
import argparse, json, math, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

UA = "ColorHub/1.0 (https://dmekibel.github.io/colorhub/; dmekibel@gmail.com) art-wiki metadata"
ENDPOINT = "https://query.wikidata.org/sparql"
MIN_MOVE_N = 20
ARTIST_OCC = ["Q1028181", "Q1281618", "Q1925963", "Q329439", "Q15296811", "Q11569986", "Q5322166", "Q483501", "Q1209498",
              "Q17307272", "Q42973", "Q16947657", "Q18074503", "Q1114448", "Q3391743", "Q4610556", "Q644687"]
# painter, sculptor, graphic artist, painter-sculptor, draftsperson, printmaker, illustrator(Q644687), artist(Q483501),
# watercolourist(Q18074503) etc.: any of these makes a person a plausible match for an artist's name.

# canonical movement names (kept in AIC's own style so a painting's AIC style and Wikidata's land on one key)
MOVE_FOLD = [
    (r"post-?impression", "Post-Impressionism"), (r"neo-?impression|pointill|divisionis", "Neo-Impressionism"),
    (r"impressionis", "Impressionism"), (r"realism|realist", "Realism"), (r"romanticism|romantic", "Romanticism"),
    (r"baroque", "Baroque"), (r"renaissance", "Renaissance"), (r"mannerism", "Mannerism"), (r"rococo", "Rococo"),
    (r"neoclassic|neo-classic", "Neoclassicism"), (r"symbolis", "Symbolism"), (r"art nouveau|jugendstil", "Art Nouveau"),
    (r"expressionis", "Expressionism"), (r"cubis", "Cubism"), (r"fauvis", "Fauvism"), (r"surrealis", "Surrealism"),
    (r"pre-?raphael", "Pre-Raphaelite"), (r"barbizon", "Barbizon school"), (r"hudson river", "Hudson River School"),
    (r"dutch golden age", "Dutch Golden Age painting"), (r"academic art|academicism", "Academic art"),
    (r"orientalis", "Orientalism"), (r"naturalis", "Naturalism"), (r"luminis", "Luminism"), (r"tonalis", "Tonalism"),
    (r"macchiaioli", "Macchiaioli"), (r"nabis", "Nabis"), (r"ukiyo", "Ukiyo-e"), (r"mughal", "Mughal"),
    (r"early netherlandish|northern renaissance", "Northern Renaissance"), (r"gothic", "Gothic"),
    (r"art deco", "Art Deco"), (r"abstract", "Abstract art"), (r"modernis", "Modernism"), (r"futuris", "Futurism"),
    (r"dada", "Dada"), (r"biedermeier", "Biedermeier"), (r"caravagg|tenebris", "Caravaggisti"),
    (r"pop art", "Pop art"), (r"ashcan", "Ashcan School"), (r"american impression", "American Impressionism"),
    (r"kalighat", "Kalighat"), (r"rajput", "Rajput"), (r"pahari", "Pahari"),
]


def fold_movement(label):
    t = (label or "").lower()
    for pat, name in MOVE_FOLD:
        if re.search(pat, t):
            return name
    return None


def sparql(query, raw_dir, key, offline=False):
    f = raw_dir / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text())
    if offline:
        raise SystemExit(f"--offline and no cache for {key}")
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(ENDPOINT, data=data, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.loads(r.read())
            f.write_text(json.dumps(out))
            time.sleep(1.2)
            return out
        except Exception as e:  # rate limit, timeout...
            print(f"  retry {attempt + 1} for {key}: {e}", flush=True)
            time.sleep(6 * (attempt + 1))
    raise SystemExit(f"gave up on {key}")


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


def year_of(s):
    m = re.match(r"^(-?\d{1,4})", s or "")
    return int(m.group(1)) if m else None


def load_painters():
    out = []
    for f in sorted((ROOT / "data" / "analysis" / "artists").glob("*.json")):
        a = json.loads(f.read_text())
        ys = [b[1] for b in a.get("barcode", []) if b[1]]
        out.append(dict(slug=a["slug"], name=a["name"], n=a["n"], co=a.get("country"), L=a.get("Lmean"), C=a.get("Cmean"),
                        W=a.get("warmFrac"), y0=min(ys) if ys else None, y1=max(ys) if ys else None,
                        commons=[b[0] for b in a.get("barcode", []) if b[0].startswith("commons-Q")]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()
    raw_dir = Path(args.raw) if args.raw else ROOT / "research" / "_raw" / "wikidata"
    raw_dir.mkdir(parents=True, exist_ok=True)
    painters = load_painters()
    print(f"{len(painters)} painters with analysis data", flush=True)

    # corpus: every Commons painting id (movement tier-1 candidates) and which have AIC movement already
    import gallery as GAL
    corpus, _ = GAL.load_corpus()
    commons_ids = [x["id"] for x in corpus if x["id"].startswith("commons-Q")]
    has_mv = {x["id"] for x in corpus if x.get("mv")}
    print(f"{len(commons_ids)} Commons paintings", flush=True)

    # ---- 1. painting -> creator, movement ----
    p_creator, p_moves = {}, defaultdict(set)
    qs = [i.split("-")[1] for i in commons_ids]
    CH = 300
    for k in range(0, len(qs), CH):
        chunk = qs[k:k + CH]
        vals = " ".join("wd:" + q for q in chunk)
        q = f"""SELECT ?p ?c ?m ?ml WHERE {{ VALUES ?p {{ {vals} }}
          OPTIONAL {{ ?p wdt:P170 ?c }}
          OPTIONAL {{ ?p wdt:P135 ?m . ?m rdfs:label ?ml FILTER(LANG(?ml)="en") }} }}"""
        res = sparql(q, raw_dir, f"paintings-{k // CH:03d}", args.offline)
        for b in res["results"]["bindings"]:
            p = qid(b["p"]["value"])
            if "c" in b:
                p_creator.setdefault(p, set()).add(qid(b["c"]["value"]))
            if "ml" in b:
                p_moves[p].add(b["ml"]["value"])
        print(f"  paintings {min(k + CH, len(qs))}/{len(qs)}", flush=True)

    # ---- 2. resolve painters ----
    resolved, how = {}, {}
    for a in painters:
        c = Counter()
        for pid in a["commons"]:
            for cr in p_creator.get(pid.split("-")[1], ()):
                c[cr] += 1
        if c:
            top, cnt = c.most_common(1)[0]
            if cnt >= max(2, 0.4 * len(a["commons"])) or (len(a["commons"]) == 1 and cnt == 1):
                resolved[a["slug"]] = top
                how[a["slug"]] = "creator"
    print(f"{len(resolved)} painters resolved via Commons creators", flush=True)
    todo = [a for a in painters if a["slug"] not in resolved]
    occ = " ".join("wd:" + o for o in ARTIST_OCC)
    cand = defaultdict(list)   # slug -> [(qid, sitelinks, birth, death)]
    NB = 60
    for k in range(0, len(todo), NB):
        chunk = todo[k:k + NB]
        names = " ".join('"%s"@en' % a["name"].replace("\\", "\\\\").replace('"', '\\"') for a in chunk)
        q = f"""SELECT ?l ?a ?sl ?b ?d WHERE {{ VALUES ?l {{ {names} }}
          ?a rdfs:label ?l . ?a wdt:P31 wd:Q5 . ?a wdt:P106 ?o . VALUES ?o {{ {occ} }}
          ?a wikibase:sitelinks ?sl . OPTIONAL {{ ?a wdt:P569 ?b }} OPTIONAL {{ ?a wdt:P570 ?d }} }}"""
        res = sparql(q, raw_dir, f"names-{k // NB:03d}", args.offline)
        by_name = defaultdict(list)
        for b in res["results"]["bindings"]:
            by_name[b["l"]["value"]].append((qid(b["a"]["value"]), int(b["sl"]["value"]), year_of(b.get("b", {}).get("value")), year_of(b.get("d", {}).get("value"))))
        for a in chunk:
            for (qq, sl, by, dy) in by_name.get(a["name"], ()):
                # the painter's own years must fit: born at least ~12 years before the first dated work, and
                # not dead more than ~5 years before the last one (restorations / late dating allowed)
                if a["y0"] is not None and by is not None and not (by <= a["y0"] - 12 or by <= a["y0"] and dy is None):
                    continue
                if a["y1"] is not None and dy is not None and dy < a["y0"] - 5:
                    continue
                if a["y0"] is not None and by is not None and a["y1"] is not None and by > a["y1"]:
                    continue
                cand[a["slug"]].append((qq, sl, by, dy))
        print(f"  names {min(k + NB, len(todo))}/{len(todo)}", flush=True)
    for slug, lst in cand.items():
        lst.sort(key=lambda t: -t[1])
        resolved[slug] = lst[0][0]
        how[slug] = "label"
    print(f"{len(resolved)} painters resolved in all", flush=True)

    # ---- 3. details ----
    qids = sorted(set(resolved.values()))
    det = {}
    ND = 80
    for k in range(0, len(qids), ND):
        chunk = qids[k:k + ND]
        vals = " ".join("wd:" + q for q in chunk)
        q = f"""SELECT ?a ?b ?d ?cl ?ml ?tq ?tl ?iq ?il ?img ?wp WHERE {{ VALUES ?a {{ {vals} }}
          OPTIONAL {{ ?a wdt:P569 ?b }} OPTIONAL {{ ?a wdt:P570 ?d }}
          OPTIONAL {{ ?a wdt:P27 ?c . ?c rdfs:label ?cl FILTER(LANG(?cl)="en") }}
          OPTIONAL {{ ?a wdt:P135 ?m . ?m rdfs:label ?ml FILTER(LANG(?ml)="en") }}
          OPTIONAL {{ ?a wdt:P1066 ?tq . ?tq rdfs:label ?tl FILTER(LANG(?tl)="en") }}
          OPTIONAL {{ ?a wdt:P737 ?iq . ?iq rdfs:label ?il FILTER(LANG(?il)="en") }}
          OPTIONAL {{ ?a wdt:P18 ?img }}
          OPTIONAL {{ ?wp schema:about ?a ; schema:isPartOf <https://en.wikipedia.org/> }} }}"""
        res = sparql(q, raw_dir, f"details-{k // ND:03d}", args.offline)
        for b in res["results"]["bindings"]:
            o = det.setdefault(qid(b["a"]["value"]), dict(b=None, d=None, nat=set(), mv=set(), teacher={}, infl={}, img=None, wp=None))
            if "b" in b and o["b"] is None: o["b"] = year_of(b["b"]["value"])
            if "d" in b and o["d"] is None: o["d"] = year_of(b["d"]["value"])
            if "cl" in b: o["nat"].add(b["cl"]["value"])
            if "ml" in b: o["mv"].add(b["ml"]["value"])
            if "tq" in b: o["teacher"][qid(b["tq"]["value"])] = b["tl"]["value"]
            if "iq" in b: o["infl"][qid(b["iq"]["value"])] = b["il"]["value"]
            if "img" in b and not o["img"]: o["img"] = urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1])
            if "wp" in b and not o["wp"]: o["wp"] = urllib.parse.unquote(b["wp"]["value"].rsplit("/", 1)[-1])
        print(f"  details {min(k + ND, len(qids))}/{len(qids)}", flush=True)

    # ---- palette similarity for ties (three numbers per painter, z-scored over all painters) ----
    def zs(key):
        v = [a[key] for a in painters if a[key] is not None]
        m = sum(v) / len(v)
        s = math.sqrt(sum((x - m) ** 2 for x in v) / len(v)) or 1
        return m, s
    Z = {k: zs(k) for k in ("L", "C", "W")}
    vec = {a["slug"]: [(a[k] - Z[k][0]) / Z[k][1] if a[k] is not None else 0 for k in ("L", "C", "W")] for a in painters}
    q2slug = {q: s for s, q in resolved.items()}

    def dist(s1, s2):
        return math.sqrt(sum((x - y) ** 2 for x, y in zip(vec[s1], vec[s2])))

    meta = {}
    for a in painters:
        s = a["slug"]
        m = dict(n=a["name"], k=a["n"], co=a["co"], y0=a["y0"], y1=a["y1"], L=a["L"], C=a["C"], W=a["W"])
        q = resolved.get(s)
        if q:
            o = det.get(q, {})
            m["q"] = q
            if o.get("b") is not None: m["b"] = o["b"]
            if o.get("d") is not None: m["d"] = o["d"]
            if o.get("nat"): m["nat"] = sorted(o["nat"])[:2]
            mv = sorted({fold_movement(x) or x for x in o.get("mv", ())})
            if mv: m["mv"] = mv
            for key, field in (("teacher", "tt"), ("infl", "in")):
                ties = []
                for tq, tn in sorted(o.get(key, {}).items(), key=lambda kv: kv[1]):
                    t = dict(q=tq, n=tn)
                    ts = q2slug.get(tq)
                    if ts and ts != s:
                        t["s"] = ts
                        t["d"] = round(dist(s, ts), 2)
                    ties.append(t)
                if ties: m[field] = ties[:8]
            if o.get("img"): m["img"] = o["img"]
            if o.get("wp"): m["wp"] = o["wp"]
        meta[s] = m

    # ---- painting movements (tier 1: the painting's own P135; AIC rows keep theirs) ----
    pm = {}
    for pid in commons_ids:
        if pid in has_mv:
            continue
        labs = {fold_movement(x) for x in p_moves.get(pid.split("-")[1], ())} - {None}
        if len(labs) == 1:
            pm[pid] = labs.pop()
    cnt = Counter(pm.values())
    keep = {k for k, v in cnt.items() if v >= 5}
    pm = {k: v for k, v in pm.items() if v in keep}
    # tier 2 -- a painter's single recorded movement, for that painter's Commons/museum paintings that have neither
    # tier-1 nor AIC movement. Marked with a trailing flag in the id map so the UI can say "by the painter".
    # (Kept separate: movements-wd.json carries both, analyze.py uses both, the page says which is which.)
    by_artist_mv = {}
    for a in painters:
        canon = [x for x in meta[a["slug"]].get("mv", []) if x in MOVE_NAMES]
        if len(canon) == 1:
            by_artist_mv[a["name"]] = canon[0]
    p2 = {}
    for x in corpus:
        if x["id"] in has_mv or x["id"] in pm or not x.get("a"):
            continue
        if x["a"] in by_artist_mv:
            p2[x["id"]] = by_artist_mv[x["a"]]
    tot = Counter(pm.values()) + Counter(p2.values())
    keep = {k for k, v in tot.items() if v >= MIN_MOVE_N}
    out_mv = {"v": 1, "tier1": {k: v for k, v in pm.items() if v in keep}, "tier2": {k: v for k, v in p2.items() if v in keep}}
    (ROOT / "data" / "artists").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "artists" / "movements-wd.json").write_text(json.dumps(out_mv, separators=(",", ":"), ensure_ascii=False))

    cov = dict(painters=len(painters), resolved=len(resolved), viaCreator=sum(1 for v in how.values() if v == "creator"),
               viaLabel=sum(1 for v in how.values() if v == "label"),
               birth=sum(1 for m in meta.values() if "b" in m), death=sum(1 for m in meta.values() if "d" in m),
               movement=sum(1 for m in meta.values() if "mv" in m), nationality=sum(1 for m in meta.values() if "nat" in m),
               teacher=sum(1 for m in meta.values() if "tt" in m), influencedBy=sum(1 for m in meta.values() if "in" in m),
               image=sum(1 for m in meta.values() if "img" in m),
               paintingMovementTier1=sum(1 for v in out_mv["tier1"].values()), paintingMovementTier2=len(out_mv["tier2"]))
    doc = {"v": 1, "built": time.strftime("%Y-%m-%d"), "source": "Wikidata (CC0), query.wikidata.org; portraits via Wikimedia Commons (each file has its own licence).",
           "cov": cov, "a": meta}
    (ROOT / "data" / "artists" / "meta.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    print(json.dumps(cov, indent=1))
    print("movements:", Counter(list(out_mv["tier1"].values()) + list(out_mv["tier2"].values())).most_common(30))


MOVE_NAMES = {n for _, n in MOVE_FOLD}
if __name__ == "__main__":
    main()
