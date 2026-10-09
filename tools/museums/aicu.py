"""Art Institute of Chicago, ukiyo-e woodblock prints: api.artic.edu, no key, CC0 metadata. https://api.artic.edu/docs/

Records: POST /api/v1/artworks/search, paged by id (the search endpoint refuses any page past 1,000 results), for
         is_public_domain, an image, and classification_titles.keyword "woodblock print" (verified live 2026-10-09:
         6,305 public-domain woodblock prints with images, overwhelmingly Edo-to-Meiji Japanese prints -- Hokusai,
         Hiroshige, Harunobu, Sharaku, Utamaro and hundreds more -- with a handful of non-Japanese "woodblock print"
         outliers the category() filter below drops by requiring a Japanese artist_display or place_of_origin).
Images:  IIIF at 400 px wide, the size the docs recommend for cache hits. Only a smaller copy is cached locally.
Pace:    1 request a second, one thread (the AIC docs ask scrapers for that) -- same INFO shape as museums/aicd.py.
"""
import re

INFO = dict(gap=1.0, workers=1, name="Art Institute of Chicago (ukiyo-e prints)", api="https://api.artic.edu/docs/",
            license="CC0 metadata; public-domain images")
FIELDS = ["id", "title", "artist_title", "artist_display", "date_start", "date_end", "date_display", "place_of_origin",
          "classification_titles", "series_title", "image_id", "department_title", "medium_display",
          "main_reference_number"]
JP = re.compile(r"japan", re.I)


def meta(C, resume=False):
    d = C.SRC["aicu"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    query = {"bool": {"must": [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}},
                               {"term": {"classification_titles.keyword": "woodblock print"}}]}}
    rows, last = [], 0
    while True:
        q = {"bool": {"must": query["bool"]["must"] + [{"range": {"id": {"gt": last}}}]}}
        r = C.fetch("aicu", "https://api.artic.edu/api/v1/artworks/search",
                    data={"query": q, "fields": FIELDS, "limit": 100, "page": 1, "sort": [{"id": "asc"}]},
                    headers={"AIC-User-Agent": C.UA})
        rows += r["data"]
        print(f"aicu meta: {len(rows)} (total matching: {r['pagination']['total']})", flush=True)
        if len(r["data"]) < 100:
            break
        last = r["data"][-1]["id"]
    out = [x for x in rows if JP.search((x.get("artist_display") or "") + " " + (x.get("place_of_origin") or ""))]
    print(f"aicu meta: {len(out)} of {len(rows)} confirmed Japanese (artist/place mentions Japan)", flush=True)
    return C.write_meta("aicu", out)


def group_key(C, x):
    return f"aicu:{x['id']}"


def image_urls(x):
    return [f"https://www.artic.edu/iiif/2/{x['image_id']}/full/400,/0/default.jpg"]


def norm(C, x):
    ys, ye = x.get("date_start"), x.get("date_end")
    y = (ys + ye) // 2 if ys is not None and ye is not None and 0 <= ye - ys <= 25 else (ys if ye in (None, ys) else None)
    a = C.clean_artist(x.get("artist_title") or (x.get("artist_display") or "").split("\n")[0])
    return dict(id=f"aicu-{x['id']}", src="aicu", t=C.clean_title(x.get("title")), a=a or None, y=y,
                series=(x.get("series_title") or None), cat="print", ty="woodblock print",
                img=image_urls(x)[0], url=f"https://www.artic.edu/artworks/{x['id']}")
