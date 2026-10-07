"""SMK, Statens Museum for Kunst (National Gallery of Denmark), Copenhagen: open API, no key. https://open.smk.dk/en/page/api

Records: /api/v1/art/search/ with filters [has_image:true], [public_domain:true], [object_names:painting] and lang=en,
         100 records a page, every page cached as smk/pages/<offset>.json (a resumed run reuses them). The search
         returns whole records, so no per-object requests are needed.
Kept:    public_domain true, an image, object name "Painting" (SMK's drawings, prints, gouaches and portrait miniatures
         are other object names). Images are public domain (PDM); metadata CC0.
Images:  SMK's IIIF thumbnail server at 400 px wide (iip-thumb.smk.dk/.../full/400,/0/default.jpg), else the main IIIF
         server at the same size. About half the paintings have no IIIF image, only a fixed 1600 px JPEG
         (api.smk.dk/api/v1/thumbnail/<uuid>.jpg, which takes no size parameter); for those that is the download
         (scaled to 200 px here) and the row's img.
Country: the first creator's nationality ("Danish" -> Denmark). Artist: the first creator, unless the role says
         someone else painted it (workshop, follower, copy after...).
Pace:    ~4 requests a second, 3 threads.
"""
import json

from . import common

API = "https://api.smk.dk/api/v1/art/search/"
INFO = dict(gap=0.25, workers=3, name="Statens Museum for Kunst (SMK), Copenhagen", api="https://open.smk.dk/en/page/api",
            license="CC0 metadata; public-domain images (PDM)")
FILTERS = "%5Bhas_image:true%5D,%5Bpublic_domain:true%5D,%5Bobject_names:painting%5D"
FIELDS = ["object_number", "titles", "production", "production_date", "object_names", "public_domain", "rights",
          "image_thumbnail", "image_iiif_id", "image_cropped", "has_image", "techniques", "frontend_url", "artist"]
ROWS = 100


def keep(x):
    names = {(n.get("name") or "").lower() for n in x.get("object_names") or []}
    return bool(x.get("public_domain") and (x.get("image_thumbnail") or x.get("image_iiif_id")) and "painting" in names)


def meta(C, resume=False):
    d = C.SRC["smk"]["dir"] / "pages"
    d.mkdir(parents=True, exist_ok=True)
    if not resume:
        for p in d.glob("*.json"):
            p.unlink()
    items, off, total = [], 0, None
    while total is None or off < total:
        p = d / f"{off:06d}.json"
        if p.exists():
            page = json.loads(p.read_text())
        else:
            page = C.fetch("smk", f"{API}?keys=*&filters={FILTERS}&offset={off}&rows={ROWS}&lang=en")
            page = dict(found=page.get("found"), items=[{k: it.get(k) for k in FIELDS} for it in page.get("items") or []])
            p.write_text(json.dumps(page, ensure_ascii=False))
        total = page.get("found") or 0
        items += page["items"]
        if off % 1000 == 0:
            print(f"smk: {len(items)} of {total}", flush=True)
        if not page["items"]:
            break
        off += ROWS
    seen, rows = set(), []
    for x in items:
        if keep(x) and x["object_number"] not in seen:
            seen.add(x["object_number"])
            rows.append(dict(x, id=x["object_number"]))
    print(f"smk: {len(items)} records, {len(rows)} public-domain paintings with images", flush=True)
    return C.write_meta("smk", rows, found=total)


def title(x):
    ts = x.get("titles") or []
    for t in ts:
        if (t.get("language") or "").lower() in ("engelsk", "english", "en"):
            return t.get("title")
    return ts[0].get("title") if ts else None


def creator(x):
    for p in x.get("production") or []:
        if p.get("creator") or p.get("creator_surname"):
            return p
    return {}


def group_key(C, x):
    return C.leaf_group("smk", x.get("object_number"), title(x), x["id"])


def image_urls(x):
    out = []
    if x.get("image_thumbnail") and "/full/!1024,/" in x["image_thumbnail"]:
        out.append(x["image_thumbnail"].replace("/full/!1024,/", "/full/400,/"))
    if x.get("image_iiif_id"):
        out.append(x["image_iiif_id"] + "/full/400,/0/default.jpg")
    if x.get("image_thumbnail") and x["image_thumbnail"] not in out and not out:
        out.append(x["image_thumbnail"])  # no IIIF: SMK's fixed 1600 px JPEG
    return out


def norm(C, x):
    p = creator(x)
    name = " ".join(filter(None, [p.get("creator_forename"), p.get("creator_surname")])) or p.get("creator")
    a = C.clean_artist(common.artist_name(name, p.get("creator_role") or ""))
    pd = (x.get("production_date") or [{}])[0]
    b = int(pd["start"][:4]) if pd.get("start") and pd["start"][:4].lstrip("-").isdigit() else None
    e = int(pd["end"][:4]) if pd.get("end") and pd["end"][:4].lstrip("-").isdigit() else None
    y, span = common.year_span(pd.get("period"), b, e)
    co = common.nationality_country(C, p.get("creator_nationality"))
    if co is None and p.get("creator_nationality"):
        C.UNMAPPED["smk: " + p["creator_nationality"]] += 1
    used = C.img_used("smk").get(str(x["id"]))
    return dict(id=f"smk-{x['id']}", src="smk", t=C.clean_title(title(x)), a=a, y=y, span=span, co=co, mv=None,
                img=used or image_urls(x)[0])
