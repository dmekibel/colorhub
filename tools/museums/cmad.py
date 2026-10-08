"""Cleveland Museum of Art, decorative arts: Open Access API, no key, CC0. https://openaccess-api.clevelandart.org/

Records: /api/artworks/?cc0=1&has_image=1&type=<Textile|Ceramic|Glass|Metalwork|Jewelry|Enamel|Basketry>&
         created_after=1800&created_before=1979, 100 a page, ~2 requests a second.
Kept:    the museum's own `type` gives the category (Textile -> textile, Ceramic -> ceramics, Glass -> glass,
         Metalwork / Jewelry / Enamel -> product / costume, Basketry -> textile); the year is creation_date_earliest /
         latest (midpoint when the span is 25 years or less).
Images:  the ~900 px "web" JPEG, downloaded once; only a 200 px copy is kept. The row's img is that web URL.
"""
import json
import re
import urllib.parse

from . import common

INFO = dict(gap=0.45, workers=1, name="Cleveland Museum of Art (decorative arts)",
            api="https://openaccess-api.clevelandart.org/", license="CC0 metadata and images")
TYPES = {"Textile": "textile", "Ceramic": "ceramics", "Glass": "glass", "Metalwork": "product", "Jewelry": "costume",
         "Enamel": "product", "Basketry": "textile"}
FIELDS = "id,accession_number,title,creation_date,creation_date_earliest,creation_date_latest,culture,creators," \
         "images,type,technique,department,url,share_license_status"


def meta(C, resume=False):
    rows = {}
    for typ, cat in TYPES.items():
        skip = 0
        while True:
            q = urllib.parse.urlencode({"type": typ, "cc0": 1, "has_image": 1, "created_after": 1800,
                                        "created_before": 1979, "limit": 100, "skip": skip, "fields": FIELDS})
            r = C.fetch("cmad", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
            for x in r["data"]:
                web = ((x.get("images") or {}).get("web") or {}).get("url")
                if web:
                    x["images"] = {"web": {"url": web}}
                    x["cat"] = cat
                    rows.setdefault(x["id"], x)
            total = r["info"]["total"]
            print(f"cmad {typ} skip {skip}: {len(rows)} (of {total} for this type)", flush=True)
            skip += 100
            if skip >= total or not r["data"]:
                break
    return C.write_meta("cmad", sorted(rows.values(), key=lambda x: x["id"]))


def group_key(C, x):
    return f"cmad:{x['id']}"


def image_urls(x):
    return [x["images"]["web"]["url"]]


def norm(C, x):
    a, b = x.get("creation_date_earliest"), x.get("creation_date_latest")
    y = (a + b) // 2 if a is not None and b is not None and 0 <= b - a <= 25 else None
    cr = (x.get("creators") or [{}])[0].get("description") or ""
    name = re.split(r"\(|,\s*(?:\d|b\.|d\.)", cr)[0].strip() or None
    a_ = C.clean_artist(common.artist_name(name))
    return dict(id=f"cmad-{x['id']}", src="cmad", t=C.clean_title(x.get("title")), a=a_, y=y,
                co=C.country_of((x.get("culture") or [None])[0]), cat=x["cat"], ty=(x.get("type") or "")[:30],
                img=image_urls(x)[0], url=x.get("url"))
