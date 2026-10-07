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
    the per-row label join alone blew the time budget (3,000 rows took 60s). Labels -- for every painting (the
    title), creator and nationality id -- are resolved after paging, in batches of 50 via the plain wbgetentities
    REST call (cached to commons/labels.json): English first, then (only for ids still missing an English label)
    a second pass with no language restriction, picking Wikidata's language-independent "mul" label when present,
    else a short list of major languages, else whatever is there. A title with no label at all (rare -- about
    1 in 10 at a quick sample) falls back to a cleaned-up Commons filename (strip the artist, dates, museum,
    "Google Art Project" and inventory numbers), never the raw filename.
    `P170` (creator) is also live-rechecked for every item WDQS returned with no creator bound at all: a sample
    showed WDQS (the SPARQL mirror, which can lag live Wikidata) missing a real, normal-rank P170 value about 1
    time in 3 among "no creator" rows -- see recheck_missing_creators() and the counts it prints.
Kept:   public domain by date: the creator's date of death (P570) before 1956, or the painting's inception (P571)
    before 1929 when no creator death date is known -- both comfortably inside the "PD-old" range the task asked
    for, and the same test SPARQL applies server-side before any image is fetched.
Images: Commons' own thumbnail server via Special:FilePath, always https (SPARQL returns these as http://,
    rewritten at ingestion): .../Special:FilePath/<file>?width=400, the same pattern corpus.py's generic pipeline
    then downsamples to 200px for the palette, as it does for every other museum's ~400-900px image. tools/gallery.py
    sets a width=1200 "hi" URL on these rows for the painting page.
Country: P495 ("country of origin"), the modern country the work was made in -- a property of the WORK, matching
    corpus.py's own COUNTRY_RULES definition ("the modern country of the place a work was made") exactly, unlike
    every other field here which is a property of the PERSON. Resolved live via wbgetentities (props=claims, same
    batched pattern as recheck_missing_creators), since it is not worth adding to the big paged SPARQL query (a
    third of items have no collection-adjacent claims to join on cheaply). Only when a painting has no P495 at all
    does this fall back to the creator's citizenship (P27) through corpus.py's country_of() -- a weaker proxy (a
    French-citizen painter working in Italy paints an Italian-made picture), used only as a last resort, same as
    NGA and SMK already do for every painting (they have no place-of-making field either).
Artist:  the creator's resolved label, unless the image's own filename says someone else painted it ("(workshop)",
    "(circle of)", "(follower of)", "(after)", "(attributed to)", "(manner of)", "(copy after)", "(school of)"),
    checked against the raw filename text, not the (now label-preferred) display title: Wikidata often leaves P170
    pointing at the named master even for a workshop piece, with the caveat only in the filename.
Pace:   ~8 requests/second to Commons' CDN thumbnail server and to query.wikidata.org (both far better provisioned
    than a single museum's API); a handful of paged SPARQL queries at the same pace.
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
# Wikidata's own English label is occasionally truncated at the source (checked 2026-10 against every commons
# title: compared each title's last word to the fuller word it's a prefix of in the image filename, keeping only
# matches where the whole reconstructed phrase also appears in the filename -- this was the single hit, confirmed
# against the French/Italian/German labels, which all read "The Fifer/Piper" in full). Add here, never patch
# labels.json by hand, so a resumed or from-scratch fetch stays correct.
TITLE_FIXES = {
    "Q26250": "The Fifer",  # Manet: Wikidata's "en" label is clipped to "The Fif"; fr "Le Fifre", it "Il pifferaio"
}
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

# Preferred language order for a label when no English one exists: "mul" is Wikidata's own language-independent
# default (increasingly used for proper names that don't vary by language, e.g. a painter's own name), tried right
# after English; then a handful of languages likely to carry an old-master painting's title or a person's name.
FALLBACK_LANGS = ["mul", "fr", "de", "nl", "it", "es", "pt", "ru", "da", "sv", "ja", "zh"]


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


_QID_RE = re.compile(r"/(Q\d+)$")


def _qid(uri):
    """The Qnnn id at the end of a Wikidata entity URI, or None. An "unknown value" (somevalue) statement -- used
    for "creator: deliberately unrecorded" -- surfaces via wdt: as a blank-node URI ending in a 32-character hex
    hash, not a Qnnn; rsplit("/")[-1] alone would silently accept that hash as if it were a real id (it did, until
    this was caught: see recheck_missing_creators() and the module docstring)."""
    m = _QID_RE.search(uri or "")
    return m.group(1) if m else None


def _year(v):
    if not v:
        return None
    m = re.match(r"^(-?\d+)-", v)
    return int(m.group(1)) if m else None


def _https(url):
    return re.sub(r"^http://", "https://", url or "", count=1)


def _title_from_file(image_url):
    """Minimally-processed filename text: extension stripped, underscores to spaces, otherwise untouched. Used
    both as the last-resort title (further cleaned by _clean_fallback_title) and, raw, to check for a "workshop
    of"/"after"/"circle of" qualifier that a Commons filename carries but a Wikidata item label usually does not."""
    name = urllib.parse.unquote((image_url or "").rsplit("/", 1)[-1])
    name = re.sub(r"\.(jpe?g|png|tiff?|webp)$", "", name, flags=re.I)
    return re.sub(r"[_\s]+", " ", name).strip()


# Fallback title cleanup (only used when the painting's Wikidata item has no label in any language at all).
_MUSEUM_WORDS = (r"museo del prado|el prado|prado|mus[ée]e du louvre|louvre museum|louvre|"
                r"state hermitage museum|the hermitage|hermitage|galleria degli uffizi|uffizi gallery|uffizi|"
                r"national gallery,? london|national gallery|mus[ée]e d['’]orsay|musee d'orsay|orsay")
_FALLBACK_STRIP = [
    re.compile(r"\bgoogle art project\b", re.I),
    re.compile(r"\(" + _MUSEUM_WORDS + r"\)", re.I),
    re.compile(r"\b(?:" + _MUSEUM_WORDS + r")\b", re.I),
    re.compile(r"\bWGA\d+\b", re.I),                       # Web Gallery of Art catalog codes
    re.compile(r"\bgemldde\d*\w*\s*\d+\b", re.I),          # OCR'd "Gemäldegalerie ..." catalog strings
    re.compile(r"\b[A-Za-zА-Яа-я]{1,4}-\d{2,8}\b"),        # inventory codes like "ГЭ-1271", "INV-20009"
    re.compile(r"\(\d{3,4}(?:[-–]\d{2,4})?,?\s*\)", re.I), # a bare "(1544, )" left after the museum name is gone
    re.compile(r"\((?:19|20)\d{2}-\d{2}-\d{2}\)"),         # a photograph date, e.g. "(2021-01-12)"
    re.compile(r"\(\d+\)$"),                                # trailing "(2)", "(1)" disambiguation
    re.compile(r"\b\d{3,7}\b$"),                            # a trailing bare inventory/accession number
]


def _clean_fallback_title(file_text, artist_name):
    t = file_text
    if artist_name:
        for name in (artist_name, artist_name.split()[-1]):
            t = re.sub(re.escape(name), "", t, flags=re.I)
    for rx in _FALLBACK_STRIP:
        t = rx.sub("", t)
    t = re.sub(r"\s*[-–,]\s*(?=[-–,]|$)", "", t)        # a separator left dangling by a removed piece
    t = re.sub(r"^[\s\-–,.:]+|[\s\-–,.:]+$", "", t)       # leading/trailing punctuation and whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t or file_text  # never return an empty title


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
                r["image"] = _https(_val(b, "image"))
            if "creator" not in r:  # keep trying later bindings until _qid() actually returns a Qnnn (see its
                cq = _qid(_val(b, "creator"))  # docstring: a "creator deliberately unrecorded" statement binds to
                if cq:  # a non-Qnnn blank-node id via wdt:, which must not get "locked in" as this item's creator
                    r["creator"] = cq
            if "dod" not in r and _val(b, "dod"):
                r["dod"] = _year(_val(b, "dod"))
            if "inception" not in r and _val(b, "inception"):
                r["inception"] = _year(_val(b, "inception"))
                prec = _val(b, "inceptionPrecision")
                r["span"] = PRECISION_SPAN.get(int(prec), 0) if prec else 0
            if "citizenship" not in r:
                cq = _qid(_val(b, "citizenship"))
                if cq:
                    r["citizenship"] = cq
        print(f"commons: page offset {offset}, {len(bindings)} rows, {len(rows)} distinct items so far", flush=True)
        offset += PAGE
        if len(bindings) < PAGE:
            break
    return rows


def recheck_missing_creators(C, rows, resume=False):
    """WDQS (the SPARQL mirror) can lag live Wikidata; a sample of items it returned with no P170 bound turned out
    to have one about 1 time in 3. For every item with no creator from fetch_pages(), ask live Wikidata
    (wbgetentities, props=claims, 50/call -- there is no per-property filter, so this is a heavier call than the
    label ones, but it only runs on the "no creator" subset) for its current P170 claims, and recover the first
    normal/preferred-rank value snak found (skipping deprecated-rank statements, which wdt: already excludes, and
    "somevalue"/"novalue" snaks, which mean the creator is explicitly recorded as unknown, not merely unrecorded).
    Mutates `rows` in place (sets r["creator"] when recovered) and returns (recovered, explicit_unknown, no_statement)
    counts for reporting."""
    p = C.SRC["commons"]["dir"] / "creator-recheck.json"
    have = json.loads(p.read_text()) if (resume and p.exists()) else {}
    todo = sorted(qid for qid, r in rows.items() if not r.get("creator") and qid not in have)
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        r = C.fetch("commons", f"{WBGE}?action=wbgetentities&ids={'|'.join(batch)}&props=claims&format=json")
        for qid in batch:
            ent = (r.get("entities") or {}).get(qid) or {}
            claims = (ent.get("claims") or {}).get("P170") or []
            value_snaks = [c for c in claims if c.get("mainsnak", {}).get("snaktype") == "value"
                          and c.get("rank") != "deprecated"]
            preferred = [c for c in value_snaks if c.get("rank") == "preferred"] or value_snaks
            if preferred:
                have[qid] = preferred[0]["mainsnak"]["datavalue"]["value"]["id"]
            elif claims:
                have[qid] = "unknown"  # P170 present, but only as somevalue/novalue: explicitly marked unknown
            else:
                have[qid] = None  # no P170 statement at all
        if i % 500 == 0:
            p.write_text(json.dumps(have, ensure_ascii=False))
            print(f"commons: creator recheck {min(i + 50, len(todo))}/{len(todo)}", flush=True)
    p.write_text(json.dumps(have, ensure_ascii=False))
    recovered = explicit_unknown = no_statement = 0
    for qid, r in rows.items():
        if r.get("creator") or qid not in have:
            continue
        v = have[qid]
        if v == "unknown":
            explicit_unknown += 1
        elif v is None:
            no_statement += 1
        else:
            r["creator"] = v
            recovered += 1
    return recovered, explicit_unknown, no_statement


def resolve_origin_countries(C, item_qids, resume=False):
    """P495 ("country of origin") for every painting item, live via wbgetentities (props=claims, 50/call, cached
    to commons/origin.json). Returns {item_qid: country_qid_or_None}. This is the modern country the WORK was made
    in -- what every other source in the corpus means by "country" (corpus.py's COUNTRY_RULES: "the modern country
    of the place a work was made") -- unlike the creator's citizenship (P27), a property of the PERSON, which
    norm() only falls back to when a painting has no P495 at all."""
    p = C.SRC["commons"]["dir"] / "origin.json"
    have = json.loads(p.read_text()) if (resume and p.exists()) else {}
    todo = sorted(q for q in item_qids if q and q not in have)
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        r = C.fetch("commons", f"{WBGE}?action=wbgetentities&ids={'|'.join(batch)}&props=claims&format=json")
        for qid in batch:
            ent = (r.get("entities") or {}).get(qid) or {}
            claims = (ent.get("claims") or {}).get("P495") or []
            value_snaks = [c for c in claims if c.get("mainsnak", {}).get("snaktype") == "value"
                          and c.get("rank") != "deprecated"]
            preferred = [c for c in value_snaks if c.get("rank") == "preferred"] or value_snaks
            have[qid] = preferred[0]["mainsnak"]["datavalue"]["value"]["id"] if preferred else None
        if i % 1000 == 0:
            p.write_text(json.dumps(have, ensure_ascii=False))
            print(f"commons: country of origin {min(i + 50, len(todo))}/{len(todo)}", flush=True)
    p.write_text(json.dumps(have, ensure_ascii=False))
    return have


def resolve_labels(C, qids, resume=False):
    """id -> label (English preferred), for painting, creator and citizenship qids, via wbgetentities (50/call,
    cached). A second, smaller pass (no language restriction) covers ids still missing an English label; an id
    with no label anywhere is stored as None, never as its own qid string (that bug previously surfaced as a raw
    "Q123740"-style artist name -- see FALLBACK_LANGS and the module docstring)."""
    p = C.SRC["commons"]["dir"] / "labels.json"
    have = json.loads(p.read_text()) if (resume and p.exists()) else {}
    todo = sorted(q for q in qids if q and q not in have)
    missing_en = []
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        r = C.fetch("commons", f"{WBGE}?action=wbgetentities&ids={'|'.join(batch)}&props=labels&languages=en&format=json")
        for qid in batch:
            ent = (r.get("entities") or {}).get(qid) or {}
            lbl = ((ent.get("labels") or {}).get("en") or {}).get("value")
            if lbl:
                have[qid] = lbl
            else:
                missing_en.append(qid)
        if i % 1000 == 0:
            p.write_text(json.dumps(have, ensure_ascii=False))
            print(f"commons: labels (en) {min(i + 50, len(todo))}/{len(todo)}", flush=True)
    for i in range(0, len(missing_en), 50):
        batch = missing_en[i:i + 50]
        r = C.fetch("commons", f"{WBGE}?action=wbgetentities&ids={'|'.join(batch)}&props=labels&format=json")
        for qid in batch:
            labels = ((r.get("entities") or {}).get(qid) or {}).get("labels") or {}
            lbl = next((labels[lang]["value"] for lang in FALLBACK_LANGS if lang in labels), None)
            if not lbl and labels:
                lbl = next(iter(labels.values()))["value"]
            have[qid] = lbl  # None if truly no label in any language
        if i % 500 == 0:
            print(f"commons: labels (fallback language) {min(i + 50, len(missing_en))}/{len(missing_en)}", flush=True)
    p.write_text(json.dumps(have, ensure_ascii=False))
    return have


def meta(C, resume=False):
    d = C.SRC["commons"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    rows = fetch_pages(C, resume)
    recovered, explicit_unknown, no_statement = recheck_missing_creators(C, rows, resume=True)
    print(f"commons: of {recovered + explicit_unknown + no_statement} items WDQS returned with no creator bound, "
          f"a live recheck found {recovered} with a real current P170 value (WDQS lag -- now recovered), "
          f"{explicit_unknown} where Wikidata explicitly records the creator as unknown (an unvalued P170 "
          f"statement), and {no_statement} with no P170 statement at all (never asked).", flush=True)
    origins = resolve_origin_countries(C, set(rows), resume=True)
    n_origin = sum(1 for v in origins.values() if v)
    print(f"commons: {n_origin}/{len(origins)} items have a stated country of origin (P495); the rest fall back "
          f"to the creator's citizenship where that is known.", flush=True)
    ids = (set(rows) | {r.get("creator") for r in rows.values()} | {r.get("citizenship") for r in rows.values()}
          | {v for v in origins.values() if v})
    labels = resolve_labels(C, ids, resume=True)  # always reuse what is already resolved; cheap to extend
    out = []
    for qid, r in rows.items():
        if not r.get("image"):
            continue
        dod, inc = r.get("dod"), r.get("inception")
        if not ((dod is not None and dod < 1956) or (dod is None and inc is not None and inc < 1929)):
            continue  # belt-and-suspenders: the SPARQL FILTER already checked this server-side
        file_text = _title_from_file(r["image"])
        creator_label = labels.get(r.get("creator")) if r.get("creator") else None
        title = labels.get(qid) or _clean_fallback_title(file_text, creator_label)
        origin_qid = origins.get(qid)
        out.append(dict(
            id=qid, image=r["image"], title=title, file_title=file_text,
            creator=creator_label,
            citizenship=labels.get(r.get("citizenship")) if r.get("citizenship") else None,
            origin=labels.get(origin_qid) if origin_qid else None,
            year=inc, span=r.get("span"), file_url=_file_page_url(r["image"]),
        ))
    out.sort(key=lambda x: x["id"])
    no_label = sum(1 for x in out if x["title"] == x["file_title"] and not labels.get(x["id"]))
    print(f"commons: {len(rows)} candidate items (6 target museums + {len(NOTABLE_ARTISTS)} notable artists, "
          f"minus the six museums already in the corpus), {len(out)} public-domain with an image "
          f"({no_label} with no Wikidata label in any language, titled from a cleaned filename)", flush=True)
    return C.write_meta("commons", out)


def group_key(C, x):
    return f"commons:{x['id']}"  # one Wikidata item = one painting; no manuscript-leaf grouping applies here


def image_urls(x):
    return [_https(x["image"]) + "?width=400"]


def norm(C, x):
    name = CREATOR_ALIAS.get(x.get("creator"), x.get("creator"))
    file_text = x.get("file_title") or x.get("title") or ""  # the raw filename carries "(workshop)"/"after ..."
                                                              # qualifiers a Wikidata label usually does not
    if name and (NOT_BY_FILE.search(file_text) or common.NOT_BY.match(file_text)):
        name = None  # the filename says workshop/circle/follower/after/attributed/manner/copy/school, Wikidata's
                     # P170 doesn't always carry that qualifier itself
    a = C.clean_artist(common.artist_name(name))
    # Country = the modern country the painting was made in (P495, "country of origin"), matching what every other
    # source in the corpus means by "country" -- a property of the WORK. Only when a painting has no P495 at all
    # does this fall back to the creator's citizenship (P27), a property of the PERSON and a weaker proxy (used
    # only as a last resort, the same way NGA and SMK already do for every one of their paintings).
    if x.get("origin"):
        co = C.country_of(x["origin"])
        if co is None:
            C.UNMAPPED["commons origin: " + x["origin"]] += 1
    elif x.get("citizenship"):
        co = C.country_of(x["citizenship"])
        if co is None:
            C.UNMAPPED["commons citizenship (no origin stated): " + x["citizenship"]] += 1
    else:
        co = None
    used = C.img_used("commons").get(str(x["id"]))
    img = _https(x["image"]) + "?width=400"
    title = TITLE_FIXES.get(x["id"], x.get("title"))
    return dict(id=f"commons-{x['id']}", src="commons", t=C.clean_title(title), a=a, y=x.get("year"),
                span=x.get("span"), co=co, mv=None, img=used or img, url=x.get("file_url"))
