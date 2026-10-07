"""Rijksmuseum, Amsterdam: Data Services, no key. https://data.rijksmuseum.nl/

Records: the OAI-PMH endpoint (https://data.rijksmuseum.nl/oai), ListRecords in the Europeana (EDM) format for set
         261208 "schilderijen" (the paintings collection): 50 whole records a page, title, date, creator, rights and
         the IIIF image in one response, about 100 requests in all. Every page is cached as rijks/oai/<n>.xml with its
         resumption token, so an interrupted run continues from the last page (--resume). (The Linked Art search API,
         data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true, finds the same ~4,900 paintings but
         needs three more requests per painting to reach its image.)
Kept:    object type "painting" (id.rijksmuseum.nl/2208), edm:rights the Public Domain Mark or CC0, and an image.
Images:  IIIF from iiif.micr.io at 400 px wide (the record gives full/max; the same server serves full/400,).
Country: the place of making where the record gives one (dcterms:spatial, which is the production place
         - took_place_at - of the Linked Art record: "Haarlem", "Cologne", "Northern Netherlands"). Otherwise a
         painting in the museum's catalogue of Dutch 17th-century paintings (set 26121) is Netherlands, of Flemish
         paintings (set 26118) Belgium; otherwise the country of the artist's birthplace. A place becomes a country by
         walking its part_of chain in the Linked Art place records (cached in rijks/places.json), top first. A place
         outside the countries corpus.py knows gives no country.
Pace:    ~4 requests a second.
"""
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET

from . import common

OAI = "https://data.rijksmuseum.nl/oai"
SET = "261208"
INFO = dict(gap=0.25, workers=3, name="Rijksmuseum, Amsterdam", api="https://data.rijksmuseum.nl/",
            license="CC0 metadata; public-domain images (PDM)")
PAINTING = "https://id.rijksmuseum.nl/2208"
OPEN_RIGHTS = ("publicdomain/mark", "publicdomain/zero")
SET_COUNTRY = {"26121": "Netherlands", "26118": "Belgium"}
NS = dict(oai="http://www.openarchives.org/OAI/2.0/", rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          dc="http://purl.org/dc/elements/1.1/", dcterms="http://purl.org/dc/terms/",
          edm="http://www.europeana.eu/schemas/edm/", ore="http://www.openarchives.org/ore/terms/",
          skos="http://www.w3.org/2004/02/skos/core#", rdaGr2="http://rdvocab.info/ElementsGr2/")
RES = "{%s}resource" % NS["rdf"]
ABOUT = "{%s}about" % NS["rdf"]
LANG = "{http://www.w3.org/XML/1998/namespace}lang"
LD = {"Accept": "application/ld+json"}


def _lang(els, prefer=("en", "nl")):
    by = {}
    for e in els:
        if e.text and e.text.strip():
            by.setdefault(e.get(LANG), e.text.strip())
    for l in prefer:
        if l in by:
            return by[l]
    return next(iter(by.values()), None)


def parse_page(xml):
    root = ET.fromstring(xml)
    out = []
    for rec in root.iter("{%s}record" % NS["oai"]):
        h = rec.find("oai:header", NS)
        if h is None or h.get("status") == "deleted":
            continue
        rdf = rec.find("oai:metadata/rdf:RDF", NS)
        if rdf is None:
            continue
        ident = h.findtext("oai:identifier", "", NS)
        agg, cho = rdf.find("ore:Aggregation", NS), rdf.find("edm:ProvidedCHO", NS)
        if cho is None:
            continue
        agents = {a.get(ABOUT): dict(name=_lang(a.findall("skos:prefLabel", NS)),
                                     birth=(a.find("rdaGr2:placeOfBirth", NS).get(RES)
                                            if a.find("rdaGr2:placeOfBirth", NS) is not None else None))
                  for a in rdf.findall("edm:Agent", NS)}
        places = {p.get(ABOUT): _lang(p.findall("skos:prefLabel", NS)) for p in rdf.findall("edm:Place", NS)}
        creators = []
        for c in cho.findall("dc:creator", NS):
            ag = agents.get(c.get(RES)) or dict(name=(c.text or "").strip() or None, birth=None)
            creators.append(dict(ag, birth_label=places.get(ag.get("birth"))))
        el = lambda path: agg.find(path, NS).get(RES) if agg is not None and agg.find(path, NS) is not None else None
        out.append(dict(
            id=ident.rsplit("/", 1)[-1], objnum=cho.findtext("dc:identifier", None, NS),
            title=_lang(cho.findall("dc:title", NS)), created=_lang(cho.findall("dcterms:created", NS)),
            types=[t.get(RES) for t in cho.findall("dc:type", NS) if t.get(RES)], creators=creators,
            made=[dict(id=sp.get(RES), label=places.get(sp.get(RES))) for sp in cho.findall("dcterms:spatial", NS)
                  if sp.get(RES)],
            rights=el("edm:rights"), image=el("edm:isShownBy"),
            sets=[s.text for s in h.findall("oai:setSpec", NS)]))
    tok = root.find(".//oai:resumptionToken", NS)
    return out, (tok.text.strip() if tok is not None and tok.text and tok.text.strip() else None), \
        (int(tok.get("completeListSize")) if tok is not None and tok.get("completeListSize") else None)


def keep(x):
    return bool(PAINTING in x["types"] and x.get("image") and x.get("rights")
                and any(r in x["rights"] for r in OPEN_RIGHTS))


def place_country(C, pid, places):
    """Country of a Rijksmuseum place id, top of its part_of chain first ("Europe" > "Netherlands" > "Zuid-Holland" >
    "Den Haag"), so a town that shares a name with somewhere else (Bath, Greenwich) cannot mislead."""
    chain, cur = [], pid
    for _ in range(10):
        if not cur or cur in chain:
            break
        if cur not in places:
            try:
                r = C.fetch("rijks", cur, headers=LD)
            except Exception as e:  # an unresolvable place: no country
                print(f"   rijks place {cur}: {e}", flush=True)
                places[cur] = dict(name=None, parent=None)
                break
            names = {}
            for n in r.get("identified_by") or []:
                if n.get("type") == "Name" and n.get("content"):
                    lang = ((n.get("language") or [{}])[0].get("id") or "")
                    names["en" if lang.endswith("300388277") else "nl" if lang.endswith("300388256") else "?"] = n["content"]
            parent = (r.get("part_of") or [{}])[0].get("id")
            places[cur] = dict(name=names.get("en") or names.get("nl") or names.get("?"), parent=parent)
        chain.append(cur)
        cur = places[cur]["parent"]
    for p in reversed(chain):
        c = C.country_of(places[p]["name"])
        if c:
            return c
    return None


def meta(C, resume=False):
    d = C.SRC["rijks"]["dir"]
    od = d / "oai"
    od.mkdir(parents=True, exist_ok=True)
    if not resume:
        for p in od.glob("*.xml"):
            p.unlink()
    pages = sorted(od.glob("*.xml"))
    recs, tok, total = [], None, None
    for p in pages:
        r, tok, n = parse_page(p.read_text())
        recs += r
        total = n or total
    url = f"{OAI}?verb=ListRecords&metadataPrefix=edm&set={SET}" if not pages else \
        (f"{OAI}?verb=ListRecords&resumptionToken={urllib.parse.quote(tok)}" if tok else None)
    while url:
        xml = C.fetch("rijks", url, text=True)
        p = od / f"{len(pages):04d}.xml"
        p.write_text(xml)
        pages.append(p)
        r, tok, n = parse_page(xml)
        recs += r
        total = n or total
        if len(pages) % 10 == 0:
            print(f"rijks: {len(recs)} of {total} records", flush=True)
        url = f"{OAI}?verb=ListRecords&resumptionToken={urllib.parse.quote(tok)}" if tok else None
    by_id = {x["id"]: x for x in recs}
    rows = [x for x in by_id.values() if keep(x)]
    # birthplace -> country for artists outside the two national catalogues
    pp = d / "places.json"
    places = json.loads(pp.read_text()) if pp.exists() else {}
    want = set()
    for x in rows:
        want.update(m["id"] for m in x.get("made", [])[:1])
        if not x.get("made") and not any(s in SET_COUNTRY for s in x["sets"]):
            want.update(c["birth"] for c in x["creators"][:1] if c.get("birth"))
    want = sorted(want)
    print(f"rijks: {len(by_id)} records, {len(rows)} public-domain paintings with images; "
          f"{len(want)} places to find a country for", flush=True)
    pc = {}
    for i, b in enumerate(want):
        pc[b] = place_country(C, b, places)
        if i % 50 == 0:
            pp.write_text(json.dumps(places, ensure_ascii=False))
            print(f"rijks places {i}/{len(want)}", flush=True)
    pp.write_text(json.dumps(places, ensure_ascii=False))
    for x in rows:
        c = x["creators"][0] if x["creators"] else {}
        x["made_country"] = pc.get(x["made"][0]["id"]) if x.get("made") else None
        x["birth_country"] = pc.get(c.get("birth")) if c.get("birth") else None
    rows.sort(key=lambda x: int(x["id"]) if x["id"].isdigit() else 0)
    return C.write_meta("rijks", rows, found=total)


def group_key(C, x):
    return C.leaf_group("rijks", x.get("objnum"), x.get("title"), x["id"])


def image_urls(x):
    return [re.sub(r"/full/(max|full)/", "/full/400,/", x["image"])]


def norm(C, x):
    c = x["creators"][0] if x["creators"] else {}
    a = C.clean_artist(common.artist_name(c.get("name")))
    y, span = common.year_span(x.get("created"))
    co = x.get("made_country") or next((SET_COUNTRY[s] for s in x["sets"] if s in SET_COUNTRY), None) \
        or (x.get("birth_country") if not x.get("made") else None)
    used = C.img_used("rijks").get(str(x["id"]))
    return dict(id=f"rijks-{x['id']}", src="rijks", t=C.clean_title(x.get("title")), a=a, y=y, span=span, co=co,
                mv=None, img=used or image_urls(x)[0])
