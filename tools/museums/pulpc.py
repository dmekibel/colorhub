"""Wikimedia Commons, pulp magazine and paperback covers, by title: the MediaWiki API, no key.
https://commons.wikimedia.org/w/api.php

Records: Commons keeps pulp covers in per-title categories ("Weird Tales covers", "Wonder Stories covers", "Amazing
         Stories illustrations" ...) and, for many titles, one subcategory per volume or issue ("Weird Tales, Volume 1,
         Issue 3") holding that issue's cover and interior scans. This adapter: (1) searches for a "<title> covers" or
         "<title> illustrations" category per name in MAGS (action=query&list=search, namespace 14 = Category), (2)
         lists that category's own files plus its direct subcategories' files (one level, the issue categories), the
         same two-step shape as commonsd.py's year categories. At most PER_CAT files per category/subcategory, so one
         huge run cannot flood a title. No image is kept unless its own extmetadata license reads as public domain or
         CC0 (OPEN/BAD below, identical rule to commonsd.py): Commons allows CC BY on some pulp scans, but this corpus
         shows only thumbnails that need no attribution, so those are dropped even where the platform would allow them.
Images:  Commons' own 330 px thumbnail URL (upload.wikimedia.org/.../330px-<file>).
Maker:   the file's Artist field as plain text (Margaret Brundage, Frank R. Paul, Hannes Bok, Virgil Finlay... when it
         names a cover, not an interior-only illustrator; this adapter does not try to tell cover from interior beyond
         what the category name says, so a stray interior scan in a "covers" category still carries that artist).
Pace:    one request every 0.5 s to the API and the thumbnail server, three threads sharing that gap (gentler than
         commonsd's year-category crawl, since this one targets far fewer, smaller categories).
"""
import re
import urllib.parse
from html import unescape

API = "https://commons.wikimedia.org/w/api.php"
INFO = dict(gap=0.5, workers=3, name="Wikimedia Commons (pulp magazine and paperback covers, by title)", api=API,
            license="Public domain / CC0 files only (per-file license read from Commons)")
PER_CAT = 150
# classic pulp and dime-novel titles, 1896-1960s: science fiction, weird/horror, detective, western, adventure,
# romance and "spicy" pulps, plus the big dime-novel series. Commons' category names vary ("X covers",
# "X illustrations", "Covers of X"); SEARCH below tries a few suffixes per title.
MAGS = [
    "Weird Tales", "Amazing Stories", "Astounding Stories", "Astounding Science Fiction", "Black Mask", "Argosy",
    "Argosy All-Story Weekly", "Adventure", "All-Story", "All-Story Weekly", "Short Stories", "Munsey's",
    "Cavalier", "Top-Notch", "Wonder Stories", "Science Wonder Stories", "Air Wonder Stories", "Startling Stories",
    "Thrilling Wonder Stories", "Planet Stories", "Fantastic Adventures", "Unknown", "Strange Tales", "Ghost Stories",
    "Doc Savage", "The Shadow", "Dime Detective", "Dime Detective Magazine", "Detective Fiction Weekly",
    "Western Story Magazine", "Ranch Romances", "Love Story Magazine", "Clues Detective Stories", "Dime Mystery",
    "Horror Stories", "Terror Tales", "Operator 5", "G-8 and His Battle Aces", "The Phantom Detective", "The Spider",
    "Thrilling Detective", "Spicy Detective Stories", "Spicy Adventure Stories", "Spicy Mystery Stories",
    "Dime Western Magazine", "Texas Rangers", "Wild West Weekly", "Nick Carter Weekly", "Buffalo Bill Stories",
    "Frank Merriwell", "Tip Top Weekly", "New Nick Carter Weekly",
]
SUFFIXES = [" covers", " illustrations", " cover art"]
OPEN = re.compile(r"^(pd\b|pd-|public domain|cc0|cc-zero|no restrictions|pdm|copyrighted free use|"
                   r"attribution not required)", re.I)
BAD = re.compile(r"\bcc[- ]by|gfdl|fair use|non-free|copyrighted\b(?! free use)|attribution\b(?! not)", re.I)


def _api(C, **kw):
    return C.fetch("pulpc", API + "?" + urllib.parse.urlencode(dict(kw, format="json", formatversion=2)))


def find_cats(C, title):
    """The best-matching 'Category:<title> covers|illustrations|cover art' page(s), from a namespace-14 search."""
    out = []
    for suf in SUFFIXES:
        try:
            r = _api(C, action="query", list="search", srnamespace=14, srsearch=f'intitle:"{title}{suf}"', srlimit=3)
        except Exception:
            continue
        for s in r.get("query", {}).get("search", []):
            t = s["title"]
            if t not in out and title.lower().split(",")[0].split(" (")[0] in t.lower():
                out.append(t)
    return out


def subcats(C, cat_title):
    out, cont = [], {}
    while True:
        r = _api(C, action="query", list="categorymembers", cmtitle=cat_title, cmtype="subcat", cmlimit=200, **cont)
        out += [m["title"] for m in r.get("query", {}).get("categorymembers", [])]
        if "continue" not in r:
            return out
        cont = r["continue"]


def files(C, cat_title, cap):
    out, cont = [], {}
    while len(out) < cap:
        r = _api(C, action="query", generator="categorymembers", gcmtitle=cat_title, gcmtype="file", gcmlimit=50,
                  prop="imageinfo", iiprop="url|extmetadata|mime|size",
                  iiextmetadatafilter="LicenseShortName|Artist|ObjectName|ImageDescription|DateTimeOriginal", **cont)
        out += r.get("query", {}).get("pages", [])
        if "continue" not in r:
            break
        cont = {k: v for k, v in r["continue"].items()}
    return out[:cap]


def plain(html):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html or ""))).strip()


def thumb_url(ii, width=330):
    url, w = (ii.get("url") or "").split("?")[0], ii.get("width") or 0
    if not url or w <= width:
        return url
    m = re.match(r"(https://upload\.wikimedia\.org/wikipedia/commons)/(\w/\w\w)/(.+)$", url)
    return f"{m.group(1)}/thumb/{m.group(2)}/{m.group(3)}/{width}px-{m.group(3)}" if m else url


YEAR_RX = re.compile(r"(18|19)\d{2}")


def usable(page, mag):
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
    title = page["title"].split(":", 1)[-1]
    name = plain((md.get("ObjectName") or {}).get("value")) or re.sub(r"\.\w+$", "", title)
    date_txt = plain((md.get("DateTimeOriginal") or {}).get("value")) or name
    ym = YEAR_RX.search(date_txt) or YEAR_RX.search(title)
    year = int(ym.group(0)) if ym else None
    return dict(title=page["title"], name=name[:140], artist=art or None, license=lic[:40], magazine=mag, year=year,
                thumb=thumb_url(ii), url=ii.get("descriptionshorturl") or ii.get("descriptionurl"),
                w=ii.get("width"), h=ii.get("height"))


def one_magazine(C, mag, done, lock):
    rows = {}
    cats = done.get("cats:" + mag)
    if cats is None:
        cats = find_cats(C, mag)
        with lock:
            done["cats:" + mag] = cats
    for root in cats:
        subs = done.get("sub:" + root)
        if subs is None:
            try:
                subs = subcats(C, root)
            except Exception:
                subs = []
            with lock:
                done["sub:" + root] = subs
        for c in [root] + subs[:300]:
            got = done.get(c)
            if got is None:
                try:
                    got = [u for u in (usable(p, mag) for p in files(C, c, PER_CAT)) if u]
                except Exception as e:
                    print(f"   pulpc {c}: {e}", flush=True)
                    continue
                with lock:
                    done[c] = got
            for u in got:
                rows.setdefault(u["title"], u)
    return rows


def meta(C, resume=False):
    import json
    import threading
    from concurrent.futures import ThreadPoolExecutor
    d = C.SRC["pulpc"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    cache = d / "cats.json"
    done = json.loads(cache.read_text()) if resume and cache.exists() else {}
    old = d / "meta.json"
    rows = {r["title"]: r for r in json.loads(old.read_text())["rows"]} if resume and old.exists() else {}
    lock, n = threading.Lock(), [0]

    def job(mag):
        r = one_magazine(C, mag, done, lock)
        with lock:
            rows.update(r)
            n[0] += 1
            if n[0] % 5 == 0:
                cache.write_text(json.dumps(done))
                C.write_meta("pulpc", sorted(rows.values(), key=lambda r: r["title"]), complete=False)
            print(f"pulpc {mag}: {len(r)} files ({len(rows)} so far, {n[0]}/{len(MAGS)} titles)", flush=True)
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(job, MAGS))
    cache.write_text(json.dumps(done))
    out = sorted(rows.values(), key=lambda r: r["title"])
    return C.write_meta("pulpc", out)


def image_urls(x):
    return [re.sub(r"/\d+px-", "/330px-", x["thumb"])]


MAG_CANON = {"the cavalier": "Cavalier", "the argosy": "Argosy"}   # match pulpia.py's canon for the titles both sources carry


def norm(C, x):
    mag = MAG_CANON.get(x["magazine"].lower(), x["magazine"])
    return dict(id="pulpc-" + re.sub(r"\W+", "_", x["title"].split(":", 1)[-1])[:60], src="pulpc",
                t=C.clean_title(x["name"]), a=x["artist"], y=x["year"], co="United States", cat="pulp",
                ty="pulp magazine cover", img=image_urls(x)[0], url=x["url"], lic=x["license"], mag=mag)
