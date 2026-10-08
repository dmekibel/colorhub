"""Rijksmuseum, Amsterdam, design collections: Data Services OAI-PMH, no key. https://data.rijksmuseum.nl/

The same route as tools/museums/rijks.py (ListRecords, Europeana EDM, 50 records a page, cached page by page and
resumable), but for the design sets instead of the paintings set (SETS below): affiches (posters), textiel, glas,
tegels (tiles), sierpapier (decorated paper), porselein and kunstnijverheid.
Kept:    edm:rights the Public Domain Mark or CC0 (anything else is dropped), an image, a date from 1800 to 1979.
Images:  IIIF from iiif.micr.io at 400 px wide (the record gives full/max; the same server serves full/400,).
Maker:   dc:creator as catalogued (the Rijksmuseum records the designer of a poster, the maker of a tile).
Country: dcterms:spatial where given ("Amsterdam", "Delft"), else None.
Pace:    ~4 requests a second.
"""
import json
import re
import urllib.parse

from . import common, rijks

INFO = dict(gap=0.12, workers=6, name="Rijksmuseum, Amsterdam (design collections)", api="https://data.rijksmuseum.nl/",
            license="CC0 metadata; public-domain images (Public Domain Mark / CC0 per record)")
# set -> (category, what the Rijksmuseum calls it)
SETS = {
    "261131": ("poster", "affiches"), "261228": ("textile", "textiel"), "261157": ("glass", "glas"),
    "261195": ("graphic", "sierpapier (decorated paper)"), "261142": ("ceramics", "tegels (tiles)"),
    "261233": ("ceramics", "porselein"), "261119": ("product", "kunstnijverheid"),
}
# Not fetched (the server was slow and these are mostly pre-1800 or monochrome): kostuum- en modeprenten 261172 (fashion
# plates, 5,692), keramiek 261231, Europees keramiek 261224, Europees aardewerk 261140, tinglazuur 261188, ex libris 261129.
YEAR_MIN, YEAR_MAX = 1800, 1979


def _year(created):
    if not created or re.search(r"eeuw|century|unknown|onbekend", created, re.I):
        return None
    ys = [int(n) for n in re.findall(r"(?<!\d)(1[0-9]{3})(?!\d)", created)]
    if not ys:
        return None
    lo, hi = min(ys), max(ys)
    return (lo + hi) // 2 if hi - lo <= 25 else None


def fetch_set(C, setspec, resume):
    d = C.SRC["rijksd"]["dir"] / "oai" / setspec
    d.mkdir(parents=True, exist_ok=True)
    pages = sorted(d.glob("*.xml"))
    recs, tok = [], None
    for p in pages:
        r, tok, _ = rijks.parse_page(p.read_text())
        recs += r
    if pages and not tok:
        return recs  # finished
    url = f"{rijks.OAI}?verb=ListRecords&metadataPrefix=edm&set={setspec}" if not pages else \
        f"{rijks.OAI}?verb=ListRecords&resumptionToken={urllib.parse.quote(tok)}"
    while url:
        xml = C.fetch("rijksd", url, text=True)
        p = d / f"{len(pages):04d}.xml"
        p.write_text(xml)
        pages.append(p)
        r, tok, total = rijks.parse_page(xml)
        recs += r
        if len(pages) % 20 == 0:
            print(f"rijksd {setspec}: {len(recs)} of {total}", flush=True)
        url = f"{rijks.OAI}?verb=ListRecords&resumptionToken={urllib.parse.quote(tok)}" if tok else None
    return recs


def meta(C, resume=False):
    rows = {}
    for setspec, (cat, label) in SETS.items():
        recs = fetch_set(C, setspec, resume)
        n = 0
        for x in recs:
            y = _year(x.get("created"))
            if not (x.get("image") and x.get("rights") and any(k in x["rights"] for k in rijks.OPEN_RIGHTS)
                    and y and YEAR_MIN <= y <= YEAR_MAX):
                continue
            x = dict(x, y=y, cat=cat, setname=label)
            rows.setdefault(x["id"], x)
            n += 1
        print(f"rijksd {setspec} {label}: {len(recs)} records, {n} usable (open rights, image, {YEAR_MIN}-{YEAR_MAX})",
              flush=True)
    out = sorted(rows.values(), key=lambda x: int(x["id"]) if x["id"].isdigit() else 0)
    return C.write_meta("rijksd", out)


def group_key(C, x):
    return f"rijksd:{x['id']}"


def image_urls(x):
    return [re.sub(r"/full/(max|full)/", "/full/400,/", x["image"])]


def norm(C, x):
    c = x["creators"][0] if x["creators"] else {}
    a = C.clean_artist(common.artist_name(c.get("name")))
    place = x["made"][0]["label"] if x.get("made") and x["made"][0].get("label") else None
    return dict(id=f"rijksd-{x['id']}", src="rijksd", t=C.clean_title(x.get("title")), a=a, y=x["y"],
                co=C.country_of(place), cat=x["cat"], ty=x["setname"].split(" (")[0], img=image_urls(x)[0],
                url=f"https://www.rijksmuseum.nl/en/collection/{x['objnum']}" if x.get("objnum") else None)
