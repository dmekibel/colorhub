"""Wikimedia Commons, via Wikidata's SPARQL query service: public-domain paintings beyond the six museums above,
prioritizing famous works and artists/collections missing there. https://query.wikidata.org/sparql (no key)

Records: paintings (wd:Q3305213) with an image (P18) whose collection (P195) is one of six target museums rich in
    public-domain holdings (the Uffizi, the Prado, the Louvre, the Hermitage, the National Gallery London, the
    Musee d'Orsay) OR whose creator (P170) is one of ~30 notable old masters most likely to be missing from the
    six museums already in the corpus (Caravaggio, Velazquez, Vermeer, Goya, Turner, Constable, Friedrich, Rubens,
    Durer, van Eyck, Bosch, Bruegel, Titian, Raphael, Botticelli, El Greco, Leonardo, Munch, Courbet, Manet, Cezanne,
    Renoir, Degas, Toulouse-Lautrec, Gauguin, Gentileschi, Monet, van Gogh, Klimt: NOTABLE_ARTISTS below), minus
    paintings already collected by the six museums in the corpus (EXCLUDE_COLLECTIONS, via FILTER NOT EXISTS on
    P195). A plain "all paintings on Commons ranked by fame" query was tried first (wikibase:sitelinks over the full
    P31=painting set) and timed out past WDQS's 60s budget even just counting; narrowing to museum-or-artist first
    (an indexed join, ~20,000 candidates) made every later step fast.
    Paged by LIMIT/OFFSET (PAGE rows, ordered by ?item for a stable page boundary), each page cached as
    commons/pages/<offset>.json (a resumed run reuses them). No inline SERVICE wikibase:label: with ~20,000 rows
    the per-row label join alone blew the time budget (3,000 rows took 60s). Labels for the few thousand distinct
    creators and nationalities are resolved after paging, in batches of 50 ids via the plain wbgetentities REST call
    (cached to commons/labels.json); the painting's own title comes from its Commons filename instead (no per-item
    label lookup needed), since the app only shows titles for casual browsing, not citation.
Kept:   public domain by date: the creator's date of death (P570) before 1956, or the painting's inception (P571)
    before 1929 when no creator death date is known -- both comfortably inside the "PD-old" range the task asked
    for, and the same test SPARQL applies server-side before any image is fetched.
Images: Commons' own thumbnail server via Special:FilePath (no key; this adapter still paces politely): .../
    Special:FilePath/<file>?width=400, the same pattern corpus.py's generic pipeline then downsamples to 200px for
    the palette, as it does for every other museum's ~400-900px image. tools/gallery.py sets a width=1200 "hi" URL
    on these rows for the painting page.
Country: the creator's citizenship (P27), through corpus.py's own country_of() (so "French" maps the same way a
    museum's nationality field would). Not place of making -- Wikidata rarely states that for a painting itself.
Artist:  the creator's label, unless the image's own filename says someone else painted it ("(workshop)", "(circle
    of)", "(follower of)", "(after)", "(attributed to)", "(manner of)", "(copy after)", "(school of)"): Wikidata
    often leaves P170 pointing at the named master even for a workshop piece, with the caveat only in the filename.
Pace:   ~8 requests/second to Commons' CDN thumbnail server and to query.wikidata.org/wbgetentities (both far
    better provisioned than a single museum's API); a handful of paged SPARQL queries at the same pace.
"""
import json
import re
import urllib.parse

from . import common

API = "https://query.wikidata.org/sparql"
WBGE = "https://www.wikidata.org/w/api.php"
INFO = dict(gap=0.12, workers=6, name="Wikimedia Commons (via Wikidata)", api="https://query.wikidata.org/sparql",
            license="Public domain (date-based: creator died before 1956, or made before 1929); CC0 metadata (Wikidata)")
PAGE = 4000

# The six museums already in the corpus: paintings already catalogued there are excluded here.
EXCLUDE_COLLECTIONS = {
    "Q239303": "Art Institute of Chicago", "Q333515": "Cleveland Museum of Art",
    "Q160236": "The Metropolitan Museum of Art", "Q214867": "National Gallery of Art, Washington",
    "Q190804": "Rijksmuseum", "Q671384": "SMK (Statens Museum for Kunst)",
}
# Six museums named in the task, rich in public-domain paintings and missing from the six above.
TARGET_COLLECTIONS = {
    "Q51252": "Uffizi Gallery", "Q160112": "Museo del Prado", "Q19675": "Louvre Museum",
    "Q132783": "State Hermitage Museum", "Q166888": "National Gallery, London", "Q23402": "Musee d'Orsay",
}
# Old masters named in the task, plus the artists most often named alongside them, as a safety net for works the
# museum-based half misses (a minor painting in a smaller collection). A wrong QID here just contributes zero rows.
NOTABLE_ARTISTS = {
    "Q5598": "Rembrandt van Rijn", "Q47551": "Titian", "Q5597": "Raphael", "Q5669": "Sandro Botticelli",
    "Q302": "El Greco", "Q5599": "Peter Paul Rubens", "Q130631": "Pieter Bruegel the Elder",
    "Q130875": "Hieronymus Bosch", "Q164153": "Jan van Eyck", "Q5580": "Albrecht Durer", "Q762": "Leonardo da Vinci",
    "Q41406": "Edvard Munch", "Q45546": "Gustave Courbet", "Q39931": "Edouard Manet", "Q35548": "Paul Cezanne",
    "Q39908": "Pierre-Auguste Renoir", "Q46373": "Edgar Degas", "Q45661": "Henri de Toulouse-Lautrec",
    "Q37693": "Paul Gauguin", "Q236006": "Artemisia Gentileschi",
    "Q42207": "Caravaggio", "Q297": "Diego Velazquez", "Q41264": "Johannes Vermeer", "Q5432": "Francisco Goya",
    "Q192070": "J. M. W. Turner", "Q189119": "John Constable", "Q60064": "Caspar David Friedrich",
    "Q296": "Claude Monet", "Q5582": "Vincent van Gogh", "Q34661": "Gustav Klimt",
}
PRECISION_SPAN = {11: 0, 10: 0, 9: 0, 8: 10, 7: 100, 6: 1000}
# Wikidata's own English label is sometimes a shorter or honorific-bearing variant of the spelling the corpus
# already settled on from the six museums (merge_artists() in corpus.py only merges a "Name (Other Name)" shape,
# not a bare short form), which would otherwise split one painter into two artist entries. Spotted by scanning the
# built corpus for one artist name that is a substring of another with both having a meaningful painting count;
# confirmed by hand (Anton Raphael Mengs is NOT an alias of Raphael, despite the substring).
CREATOR_ALIAS = {
    "Rembrandt": "Rembrandt van Rijn",
    "Sir Anthony van Dyck": "Anthony van Dyck",
    "Auguste Renoir": "Pierre-Auguste Renoir",
    "David Teniers": "David Teniers the Younger",
    "Lucas Cranach": "Lucas Cranach the Elder",
}
NOT_BY_FILE = re.compile(r"\((?:workshop|circle(?: of)?|follower(?:s)? of|manner of|copy after|school of|style of|"
                        r"attributed to|imitator of|after)\b", re.I)
# Commons filenames just as often put the same qualifier as a bare leading phrase, no parentheses: "After Jheronimus
# Bosch 006 colour.jpg", "Workshop of Rembrandt - ...", "Follower of Titian - ...". museum_common.NOT_BY already
# matches this shape (anchored to the start of the string); it is reused here against the title, not just the name.


def _vals(qids):
    return " ".join(f"wd:{q}" for q in qids)


QUERY = """SELECT ?item ?image ?creator ?inception ?inceptionPrecision ?dod ?citizenship WHERE {{
  ?item wdt:P31 wd:Q3305213 .
  ?item wdt:P18 ?image .
  {{
    ?item wdt:P195 ?collection .
    VALUES ?collection {{ {targets} }}
  }} UNION {{
    ?item wdt:P170 ?creator0 .
    VALUES ?creator0 {{ {artists} }}
  }}
  OPTIONAL {{
    ?item p:P571 ?incStmt .
    ?incStmt psv:P571 ?incNode .
    ?incNode wikibase:timeValue ?inception ; wikibase:timePrecision ?inceptionPrecision .
  }}
  OPTIONAL {{
    ?item wdt:P170 ?creator .
    OPTIONAL {{ ?creator wdt:P570 ?dod . }}
    OPTIONAL {{ ?creator wdt:P27 ?citizenship . }}
  }}
  FILTER NOT EXISTS {{ ?item wdt:P195 ?excl . VALUES ?excl {{ {excludes} }} }}
  FILTER(
    (BOUND(?dod) && ?dod < "1956-01-01T00:00:00Z"^^xsd:dateTime) ||
    (!BOUND(?dod) && BOUND(?inception) && ?inception < "1929-01-01T00:00:00Z"^^xsd:dateTime)
  )
}}
ORDER BY ?item
LIMIT {limit}
OFFSET {offset}
"""


def _query(offset):
    return QUERY.format(targets=_vals(TARGET_COLLECTIONS), artists=_vals(NOTABLE_ARTISTS),
                        excludes=_vals(EXCLUDE_COLLECTIONS), limit=PAGE, offset=offset)


def _val(b, k):
    v = b.get(k)
    return v.get("value") if v else None


def _qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


def _year(v):
    if not v:
        return None
    m = re.match(r"^(-?\d+)-", v)
    return int(m.group(1)) if m else None


def _title_from_file(image_url):
    name = urllib.parse.unquote((image_url or "").rsplit("/", 1)[-1])
    name = re.sub(r"\.(jpe?g|png|tiff?|webp)$", "", name, flags=re.I)
    return re.sub(r"[_\s]+", " ", name).strip()


def _file_page_url(image_url):
    name = urllib.parse.unquote((image_url or "").rsplit("/", 1)[-1]).replace(" ", "_")
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(name)


def fetch_pages(C, resume=False):
    d = C.SRC["commons"]["dir"] / "pages"
    d.mkdir(parents=True, exist_ok=True)
    rows, offset = {}, 0
    while True:
        p = d / f"{offset:07d}.json"
        if resume and p.exists():
            page = json.loads(p.read_text())
        else:
            page = C.fetch("commons", f"{API}?format=json&query=" + urllib.parse.quote(_query(offset)))
            p.write_text(json.dumps(page, ensure_ascii=False))
        bindings = page["results"]["bindings"]
        for b in bindings:
            qid = _qid(_val(b, "item"))
            if not qid:
                continue
            r = rows.setdefault(qid, {})
            if "image" not in r and _val(b, "image"):
                r["image"] = _val(b, "image")
            if "creator" not in r and _val(b, "creator"):
                r["creator"] = _qid(_val(b, "creator"))
            if "dod" not in r and _val(b, "dod"):
                r["dod"] = _year(_val(b, "dod"))
            if "inception" not in r and _val(b, "inception"):
                r["inception"] = _year(_val(b, "inception"))
                prec = _val(b, "inceptionPrecision")
                r["span"] = PRECISION_SPAN.get(int(prec), 0) if prec else 0
            if "citizenship" not in r and _val(b, "citizenship"):
                r["citizenship"] = _qid(_val(b, "citizenship"))
        print(f"commons: page offset {offset}, {len(bindings)} rows, {len(rows)} distinct items so far", flush=True)
        offset += PAGE
        if len(bindings) < PAGE:
            break
    return rows


def resolve_labels(C, qids, resume=False):
    """id -> English label, for creator and citizenship qids, via wbgetentities (50 ids/call, cached)."""
    p = C.SRC["commons"]["dir"] / "labels.json"
    have = json.loads(p.read_text()) if (resume and p.exists()) else {}
    todo = sorted(q for q in qids if q and q not in have)
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        r = C.fetch("commons", f"{WBGE}?action=wbgetentities&ids={'|'.join(batch)}&props=labels&languages=en&format=json")
        for qid, ent in (r.get("entities") or {}).items():
            lbl = ((ent.get("labels") or {}).get("en") or {}).get("value")
            have[qid] = lbl or qid
        if i % 500 == 0:
            p.write_text(json.dumps(have, ensure_ascii=False))
            print(f"commons: labels {min(i + 50, len(todo))}/{len(todo)}", flush=True)
    p.write_text(json.dumps(have, ensure_ascii=False))
    return have


def meta(C, resume=False):
    d = C.SRC["commons"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    rows = fetch_pages(C, resume)
    labels = resolve_labels(C, {r.get("creator") for r in rows.values()} | {r.get("citizenship") for r in rows.values()},
                            resume=True)  # always reuse what is already resolved; cheap to extend
    out = []
    for qid, r in rows.items():
        if not r.get("image"):
            continue
        dod, inc = r.get("dod"), r.get("inception")
        if not ((dod is not None and dod < 1956) or (dod is None and inc is not None and inc < 1929)):
            continue  # belt-and-suspenders: the SPARQL FILTER already checked this server-side
        out.append(dict(
            id=qid, image=r["image"], title=_title_from_file(r["image"]),
            creator=labels.get(r.get("creator")) if r.get("creator") else None,
            citizenship=labels.get(r.get("citizenship")) if r.get("citizenship") else None,
            year=inc, span=r.get("span"), file_url=_file_page_url(r["image"]),
        ))
    out.sort(key=lambda x: x["id"])
    print(f"commons: {len(rows)} candidate items (6 target museums + {len(NOTABLE_ARTISTS)} notable artists, "
          f"minus the six museums already in the corpus), {len(out)} public-domain with an image", flush=True)
    return C.write_meta("commons", out)


def group_key(C, x):
    return f"commons:{x['id']}"  # one Wikidata item = one painting; no manuscript-leaf grouping applies here


def image_urls(x):
    return [x["image"] + "?width=400"]


def norm(C, x):
    name = CREATOR_ALIAS.get(x.get("creator"), x.get("creator"))
    title = x.get("title") or ""
    if name and (NOT_BY_FILE.search(title) or common.NOT_BY.match(title)):
        name = None  # the filename says workshop/circle/follower/after/attributed/manner/copy/school, Wikidata's
                     # P170 doesn't always carry that qualifier itself
    a = C.clean_artist(common.artist_name(name))
    co = C.country_of(x.get("citizenship")) if x.get("citizenship") else None
    if co is None and x.get("citizenship"):
        C.UNMAPPED["commons: " + x["citizenship"]] += 1
    used = C.img_used("commons").get(str(x["id"]))
    return dict(id=f"commons-{x['id']}", src="commons", t=C.clean_title(x.get("title")), a=a, y=x.get("year"),
                span=x.get("span"), co=co, mv=None, img=used or (x["image"] + "?width=400"), url=x.get("file_url"))
