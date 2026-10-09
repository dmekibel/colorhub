"""Cleveland Museum of Art, Japanese prints: Open Access API, no key, CC0. https://openaccess-api.clevelandart.org/

Records: /api/artworks/?department=Japanese%20Art&type=Print&cc0=1&has_image=1, 100 a page (verified live
         2026-10-09: 606 CC0 prints with images). creation_date_earliest/latest gives the year.
Images:  the museum's own "web" JPEG (~900 px), downloaded once; only a smaller copy is kept locally.
"""
import re
import urllib.parse

from . import common

INFO = dict(gap=0.45, workers=1, name="Cleveland Museum of Art (Japanese prints)",
            api="https://openaccess-api.clevelandart.org/", license="CC0 metadata and images")
FIELDS = "id,accession_number,title,title_in_original_language,series,creation_date,creation_date_earliest," \
         "creation_date_latest,culture,creators,images,type,technique,department,url,share_license_status"


def meta(C, resume=False):
    rows, skip = {}, 0
    while True:
        q = urllib.parse.urlencode({"department": "Japanese Art", "type": "Print", "cc0": 1, "has_image": 1,
                                    "limit": 100, "skip": skip, "fields": FIELDS})
        r = C.fetch("cmau", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
        for x in r["data"]:
            web = ((x.get("images") or {}).get("web") or {}).get("url")
            if web:
                x["images"] = {"web": {"url": web}}
                rows.setdefault(x["id"], x)
        total = r["info"]["total"]
        print(f"cmau skip {skip}: {len(rows)} (of {total})", flush=True)
        skip += 100
        if skip >= total or not r["data"]:
            break
    return C.write_meta("cmau", sorted(rows.values(), key=lambda x: x["id"]))


def group_key(C, x):
    return f"cmau:{x['id']}"


def image_urls(x):
    return [x["images"]["web"]["url"]]


def norm(C, x):
    a, b = x.get("creation_date_earliest"), x.get("creation_date_latest")
    y = (a + b) // 2 if a is not None and b is not None and 0 <= b - a <= 25 else None
    cr = (x.get("creators") or [{}])[0].get("description") or ""
    name = re.split(r"\(|,\s*(?:\d|b\.|d\.)", cr)[0].strip() or None
    a_ = C.clean_artist(common.artist_name(name))
    return dict(id=f"cmau-{x['id']}", src="cmau", t=C.clean_title(x.get("title")), a=a_, y=y,
                series=(x.get("series") or None), cat="print", ty="woodblock print",
                img=image_urls(x)[0], url=x.get("url"))
