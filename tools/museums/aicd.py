"""Art Institute of Chicago, design departments: api.artic.edu, no key, CC0 metadata. https://api.artic.edu/docs/

Records: POST /api/v1/artworks/search, paged by id (the search endpoint refuses any page past 1,000 results), for
         is_public_domain, an image, date_start 1800-1979, and department Textiles, Applied Arts of Europe,
         Architecture and Design, or classification poster / valentine / book / ephemera in other departments.
Kept:    rows whose classification terms and title map to a design category (CATEGORY below).
Images:  IIIF at 400 px wide (https://www.artic.edu/iiif/2/<image_id>/full/400,/0/default.jpg), a size the docs
         recommend for cache hits. Only a 200 px copy is cached.
Pace:    1 request a second, one thread (the AIC docs ask scrapers for that).
"""
import json
import re
from datetime import date

from . import common

INFO = dict(gap=1.0, workers=1, name="Art Institute of Chicago (design departments)", api="https://api.artic.edu/docs/",
            license="CC0 metadata; public-domain images")
FIELDS = ["id", "title", "artist_title", "artist_display", "date_start", "date_end", "date_display", "place_of_origin",
          "classification_titles", "artwork_type_title", "image_id", "department_title", "medium_display",
          "main_reference_number"]
DEPTS = ["Textiles", "Applied Arts of Europe", "Architecture and Design"]
EXTRA_CLASS = ["poster", "posters", "valentine", "ephemera", "advertisement", "trade card", "wallpaper", "postcard",
               "book cover", "bookplate", "label", "packaging", "calendar", "graphic design"]
CATEGORY = [
    ("poster", r"\bposters?\b"),
    ("wallpaper", r"wallpaper|wall covering"),
    ("costume", r"costume|dress\b|garment|fashion|hat\b|shoe|glove|fan\b|jewel|brooch|necklace|bracelet|ring\b"),
    ("textile", r"textile|tapestr|embroider|lace|rug\b|carpet|coverlet|quilt|shawl|weaving|printed|woven|fabric|"
                r"velvet|brocade|damask|sampler|towel|hanging|ribbon|upholstery|bed ?cover|pillow|cushion"),
    ("glass", r"\bglass|paperweight|stained|bottle|goblet|tumbler"),
    ("ceramics", r"ceramic|porcelain|earthenware|stoneware|pottery|tile\b|plate\b|vase|bowl|dish\b|cup\b|jug|teapot|"
                 r"pitcher|figure|faience|majolica|vessel|mug"),
    ("furniture", r"furniture|seating|chair|table\b|desk|cabinet|bed\b|sofa|stool|lamp|lighting|clock|mirror|screen"),
    ("product", r"silver|metalwork|flatware|appliance|radio|telephone|product|tableware|tray|candle|kettle|"
                r"container|tool|toy|game|model|pewter|brass|bronze|iron|enamel|watch|design|object"),
    ("graphic", r"book|print|lithograph|drawing|valentine|ephemera|card\b|label|advertis|packag|calendar|cover|"
                r"typograph|letterform|graphic"),
]
RX = [(c, re.compile(p, re.I)) for c, p in CATEGORY]


def category(x):
    text = " | ".join((x.get("classification_titles") or []) + [x.get("artwork_type_title") or ""])
    for cat, rx in RX:
        if rx.search(text):
            return cat
    text = text + " " + (x.get("title") or "")
    for cat, rx in RX:
        if rx.search(text):
            return cat
    return {"Textiles": "textile", "Applied Arts of Europe": "product", "Architecture and Design": "product"}.get(
        x.get("department_title"))


def meta(C, resume=False):
    d = C.SRC["aicd"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    base = [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}},
            {"range": {"date_start": {"gte": 1800, "lte": 1979}}}]
    should = [{"terms": {"department_title.keyword": DEPTS}},
              {"terms": {"classification_title.keyword": EXTRA_CLASS}},
              {"terms": {"artwork_type_title.keyword": ["Poster", "Wallpaper", "Valentine"]}}]
    rows, last = [], 0
    while True:
        query = {"bool": {"must": base + [{"range": {"id": {"gt": last}}}],
                          "should": should, "minimum_should_match": 1}}
        r = C.fetch("aicd", "https://api.artic.edu/api/v1/artworks/search",
                    data={"query": query, "fields": FIELDS, "limit": 100, "page": 1, "sort": [{"id": "asc"}]},
                    headers={"AIC-User-Agent": C.UA})
        rows += r["data"]
        print(f"aicd meta: {len(rows)} (to go incl. this page: {r['pagination']['total']})", flush=True)
        if len(r["data"]) < 100:
            break
        last = r["data"][-1]["id"]
    out = []
    for x in rows:
        x.pop("_score", None)
        x["cat"] = category(x)
        if x["cat"]:
            out.append(x)
    return C.write_meta("aicd", out)


def group_key(C, x):
    return f"aicd:{x['id']}"


def image_urls(x):
    return [f"https://www.artic.edu/iiif/2/{x['image_id']}/full/400,/0/default.jpg"]


def norm(C, x):
    ys, ye = x.get("date_start"), x.get("date_end")
    y = (ys + ye) // 2 if ys is not None and ye is not None and 0 <= ye - ys <= 25 else (ys if ye in (None, ys) else None)
    a = C.clean_artist(common.artist_name(x.get("artist_title")))
    cl = (x.get("classification_titles") or [x.get("artwork_type_title") or ""])[0]
    return dict(id=f"aicd-{x['id']}", src="aicd", t=C.clean_title(x.get("title")), a=a, y=y,
                co=C.country_of(x.get("place_of_origin")), cat=x["cat"], ty=cl[:40], img=image_urls(x)[0],
                url=f"https://www.artic.edu/artworks/{x['id']}")
