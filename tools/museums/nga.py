"""National Gallery of Art, Washington: open data on GitHub, CC0. https://github.com/NationalGalleryOfArt/opendata

Records: four CSV files from the repository's data/ folder, downloaded once into nga/ (about 215 MB; --resume keeps
         them): objects.csv (title, dates, attribution, classification), published_images.csv (IIIF image per object,
         with an open-access flag), constituents.csv (artists' nationality) and objects_constituents.csv (who made what).
Kept:    classification "Painting", not a virtual grouping record, and a primary image flagged open access (CC0).
Images:  the NGA IIIF server at 400 px wide (api.nga.gov/iiif/<uuid>/full/400,/0/default.jpg).
Artist:  the first constituent with role type "artist"; none when the attribution says someone else painted it
         ("Workshop of", "Follower of", "Circle of", "After"...). Country: that artist's nationality.
Pace:    the CSVs are four requests; images ~4 a second.
"""
import csv
import json
import sys

from . import common

BASE = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/"
FILES = ["objects.csv", "published_images.csv", "constituents.csv", "objects_constituents.csv"]
INFO = dict(gap=0.25, workers=3, name="National Gallery of Art, Washington",
            api="https://github.com/NationalGalleryOfArt/opendata", license="CC0 metadata and open-access images")
CLASSES = {"Painting"}


def _rows(path):
    csv.field_size_limit(sys.maxsize)
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def meta(C, resume=False):
    d = C.SRC["nga"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    for fn in FILES:
        if not (resume and (d / fn).exists()):
            print(f"nga: downloading {fn}", flush=True)
            C.download("nga", BASE + fn, d / fn)
    objs, classes = {}, {}
    for r in _rows(d / "objects.csv"):
        classes[r["classification"]] = classes.get(r["classification"], 0) + 1
        if r["classification"] in CLASSES and r.get("isvirtual") != "1":
            objs[r["objectid"]] = {k: r.get(k) for k in (
                "objectid", "accessionnum", "title", "displaydate", "beginyear", "endyear", "medium", "attribution",
                "attributioninverted", "classification", "subclassification", "parentid", "departmentabbr")}
    print(f"nga: {len(objs)} paintings; classifications: {sorted(classes.items(), key=lambda kv: -kv[1])[:10]}", flush=True)
    imgs = {}
    for r in _rows(d / "published_images.csv"):
        oid = r["depictstmsobjectid"]
        if oid in objs and r["viewtype"] == "primary" and r["openaccess"] == "1":
            best = imgs.get(oid)
            if best is None or int(r["sequence"] or 0) < int(best["sequence"] or 0):
                imgs[oid] = dict(uuid=r["uuid"], iiif=r["iiifurl"], sequence=r["sequence"],
                                 width=r["width"], height=r["height"])
    artists = {}
    for r in _rows(d / "objects_constituents.csv"):
        if r["objectid"] in objs and r["roletype"] == "artist":
            cur = artists.get(r["objectid"])
            if cur is None or int(r["displayorder"] or 99) < int(cur["displayorder"] or 99):
                artists[r["objectid"]] = dict(cid=r["constituentid"], displayorder=r["displayorder"],
                                              role=r["role"], prefix=r["prefix"])
    want = {a["cid"] for a in artists.values()}
    people = {r["constituentid"]: dict(name=r["forwarddisplayname"], nationality=r["nationality"],
                                       kind=r["constituenttype"])
              for r in _rows(d / "constituents.csv") if r["constituentid"] in want}
    rows = []
    for oid, x in objs.items():
        if oid not in imgs:
            continue
        a = artists.get(oid) or {}
        p = people.get(a.get("cid")) or {}
        rows.append(dict(x, id=int(oid), image=imgs[oid], artist=p.get("name"), artist_kind=p.get("kind"),
                         nationality=p.get("nationality"), role_prefix=a.get("prefix")))
    rows.sort(key=lambda x: x["id"])
    print(f"nga: {len(rows)} open-access paintings with images", flush=True)
    return C.write_meta("nga", rows)


def group_key(C, x):
    return C.leaf_group("nga", x.get("accessionnum"), x.get("title"), x["id"])


def image_urls(x):
    return [x["image"]["iiif"].rstrip("/") + "/full/400,/0/default.jpg"]


def norm(C, x):
    attribution = x.get("attribution") or ""
    name = x.get("artist") if x.get("artist_kind") != "anonymous" else None
    # "Workshop of Rogier van der Weyden": the constituent is Rogier, the attribution says it is not by him
    a = C.clean_artist(common.artist_name(name, (x.get("role_prefix") or "") or attribution))
    if a and common.NOT_BY.match(attribution):
        a = None
    b = int(x["beginyear"]) if (x.get("beginyear") or "").lstrip("-").isdigit() else None
    e = int(x["endyear"]) if (x.get("endyear") or "").lstrip("-").isdigit() else None
    y, span = common.year_span(x.get("displaydate"), b, e)
    co = common.nationality_country(C, x.get("nationality"))
    if co is None and x.get("nationality"):
        C.UNMAPPED["nga: " + x["nationality"]] += 1
    used = C.img_used("nga").get(str(x["id"]))
    return dict(id=f"nga-{x['id']}", src="nga", t=C.clean_title(x.get("title")), a=a, y=y, span=span, co=co, mv=None,
                img=used or image_urls(x)[0])
