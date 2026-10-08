"""Wikimedia Commons, posters and stamps by year: the MediaWiki API, no key. https://commons.wikimedia.org/w/api.php

Records: Commons keeps posters and stamps in year categories ("1925 posters", "1925 posters of France", "1925 film
         posters", "1925 stamps", "1925 postage stamps of Brazil", "1925 stamps of the United States"). For each year
         from 1850 to 1979 this lists the category's files and the files of its direct subcategories whose names match
         (ONLY below), through generator=categorymembers with prop=imageinfo, so one request returns 50 files with their
         thumbnail URL and license: no per-file request. At most PER_CAT files per category, so one very large
         category (a national stamp series) cannot flood a year. The year in the category name is the object's year.
Kept:    files whose extmetadata LicenseShortName reads as public domain or CC0 (PD-old, PD-US, Public domain, PDM,
         CC0 ...). CC BY / CC BY-SA files are dropped even where Commons allows them: this corpus shows only thumbnails
         that need no attribution. Bitmap images only (jpeg/png/gif/tiff).
Images:  Commons' own 330 px thumbnail URL (upload.wikimedia.org/.../330px-<file>); only a 200 px copy is cached.
Maker:   the file's Artist field as plain text, when it is short and not "unknown" (often the poster's designer or the
         stamp's engraver).
Pace:    one request every 0.3 s to the API and the thumbnail server, three threads sharing that gap.
"""
import json
import re
import urllib.parse
from html import unescape

from . import common

API = "https://commons.wikimedia.org/w/api.php"
INFO = dict(gap=0.7, workers=3, name="Wikimedia Commons (posters and stamps by year)", api=API,
            license="Public domain / CC0 files only (per-file license read from Commons)")
import os
_y = os.environ.get("COMMONS_YEARS", "1850-1979").split("-")
YEARS = range(int(_y[0]), int(_y[1]) + 1)   # env COMMONS_YEARS=1924-1967 runs a slice; cached years are not asked again
PER_CAT = 100
SEEDS = [("poster", "{y} posters"), ("stamps", "{y} stamps"), ("stamps", "{y} postage stamps"),
         ("cover", "{y} magazine covers"), ("cover", "{y} book covers"),
         ("advert", "{y} advertisements")]
ONLY = {"poster": re.compile(r"^\d{4} (film |theatre |concert |travel |political |advertising |propaganda |"
                              r"election |sports |exhibition |tourism |war )?posters( of .+)?$", re.I),
        "stamps": re.compile(r"^\d{4} (postage )?stamps( of .+)?$", re.I),
        "cover": re.compile(r"^\d{4} (magazine|book) covers( of .+)?$|^covers of .+|covers?,? \d{4}$|^\d{4} covers of ", re.I),
        "advert": re.compile(r"^\d{4} (automobile |radio receiver |newspaper |magazine )?advertisements( of .+)?$", re.I)}
OPEN = re.compile(r"^(pd\b|pd-|public domain|cc0|cc-zero|no restrictions|pdm|copyrighted free use|"
                  r"attribution not required)", re.I)
BAD = re.compile(r"\bcc[- ]by|gfdl|fair use|non-free|copyrighted\b(?! free use)|attribution\b(?! not)", re.I)


def _api(C, **kw):
    return C.fetch("commonsd", API + "?" + urllib.parse.urlencode(dict(kw, format="json", formatversion=2)))


def subcats(C, title):
    out, cont = [], {}
    while True:
        r = _api(C, action="query", list="categorymembers", cmtitle=title, cmtype="subcat", cmlimit=200, **cont)
        out += [m["title"] for m in r.get("query", {}).get("categorymembers", [])]
        if "continue" not in r:
            return out
        cont = r["continue"]


def files(C, title, cap):
    out, cont = [], {}
    while len(out) < cap:
        r = _api(C, action="query", generator="categorymembers", gcmtitle=title, gcmtype="file", gcmlimit=50,
                 prop="imageinfo", iiprop="url|extmetadata|mime|size",
                 iiextmetadatafilter="LicenseShortName|Artist|ObjectName|ImageDescription", **cont)
        out += r.get("query", {}).get("pages", [])
        if "continue" not in r:
            break
        cont = {k: v for k, v in r["continue"].items()}
    return out[:cap]


def plain(html):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html or ""))).strip()


def thumb_url(ii, width=330):
    """Commons' own thumbnail URL (a standard step, 330 px; Commons refuses other widths), built from the file URL: the API only makes thumbnails on
    request (iiurlwidth), which costs ~20 s a call; the thumbnail server makes it when the image is first fetched."""
    url, w = (ii.get("url") or "").split("?")[0], ii.get("width") or 0
    if not url or w <= width:
        return url
    m = re.match(r"(https://upload\.wikimedia\.org/wikipedia/commons)/(\w/\w\w)/(.+)$", url)
    return f"{m.group(1)}/thumb/{m.group(2)}/{m.group(3)}/{width}px-{m.group(3)}" if m else url


def usable(page):
    ii = (page.get("imageinfo") or [None])[0]
    if not ii or ii.get("mime") not in ("image/jpeg", "image/png", "image/gif"):
        return None
    md = ii.get("extmetadata") or {}
    lic = (md.get("LicenseShortName") or {}).get("value") or ""
    if not OPEN.search(lic) or BAD.search(lic):
        return None
    art = plain((md.get("Artist") or {}).get("value"))
    if len(art) > 70 or re.search(r"unknown|anonymous|uncredited|various|\bsee\b|http|commons", art, re.I):
        art = ""
    name = plain((md.get("ObjectName") or {}).get("value")) or re.sub(r"\.\w+$", "", page["title"].split(":", 1)[-1])
    return dict(title=page["title"], name=name[:140], artist=art or None, license=lic[:40],
                thumb=thumb_url(ii), url=ii.get("descriptionshorturl") or ii.get("descriptionurl"),
                w=ii.get("width"), h=ii.get("height"))


def one_year(C, y, done, lock):
    rows = {}
    for kind, seed in SEEDS:
        root = "Category:" + seed.format(y=y)
        key = "sub:" + root
        if key not in done:
            try:
                subs = [c for c in subcats(C, root) if ONLY[kind].match(c.split(":", 1)[1])]
            except Exception:  # a category that does not exist
                subs = []
            with lock:
                done[key] = subs
        for c in [root] + done[key]:
            if c not in done:
                try:
                    got = [u for u in (usable(p) for p in files(C, c, PER_CAT)) if u]
                except Exception as e:
                    print(f"   commonsd {c}: {e}", flush=True)
                    continue
                with lock:
                    done[c] = got
            for u in done[c]:
                rows.setdefault(u["title"], dict(u, year=y, kind=kind, category=c.split(":", 1)[1]))
    return rows


def meta(C, resume=False):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    d = C.SRC["commonsd"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    cache = d / "cats.json"
    done = json.loads(cache.read_text()) if resume and cache.exists() else {}
    old = d / "meta.json"
    rows = {r["title"]: r for r in json.loads(old.read_text())["rows"]} if resume and old.exists() else {}
    lock, n = threading.Lock(), [0]

    def job(y):
        r = one_year(C, y, done, lock)
        with lock:
            rows.update(r)
            n[0] += 1
            if n[0] % 3 == 0:
                cache.write_text(json.dumps(done))
                C.write_meta("commonsd", sorted(rows.values(), key=lambda r: (r["year"], r["title"])), complete=False)
            print(f"commonsd {y}: {len(r)} files ({len(rows)} so far, {n[0]}/{len(YEARS)} years)", flush=True)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(job, sorted(YEARS, key=lambda y: (y < 1900, -abs(y - 1945) if y >= 1900 else y))))
    cache.write_text(json.dumps(done))
    out = sorted(rows.values(), key=lambda r: (r["year"], r["title"]))
    return C.write_meta("commonsd", out)


def group_key(C, x):
    return f"commonsd:{x['title']}"


def image_urls(x):
    t = re.sub(r"\?utm_source=[^/]*?original", "", x["thumb"])   # an early run kept the API's tracking query
    return [re.sub(r"/\d+px-", "/330px-", t)]


def norm(C, x):
    cat = {"poster": "poster", "stamps": "stamps"}.get(x["kind"], "graphic")
    ctry = re.search(r" of (?:the )?(.+)$", x["category"])
    ty = {"poster": "poster", "stamps": "postage stamp", "cover": "magazine or book cover",
          "advert": "advertisement"}[x["kind"]]
    return dict(id="commonsd-" + re.sub(r"\W+", "_", x["title"].split(":", 1)[-1])[:60], src="commonsd",
                t=C.clean_title(x["name"]), a=x["artist"], y=x["year"], co=C.country_of(ctry.group(1)) if ctry else None,
                cat=cat, ty=ty[:30], img=image_urls(x)[0], url=x["url"], lic=x["license"])
