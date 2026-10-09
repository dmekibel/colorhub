"""Wikimedia Commons: public-domain / CC0 COLOR photography, by named historic collection. No key, no API.
research/PHOTOGRAPHY.md explains why this is the route (the Library of Congress site itself is blocked by a
Cloudflare bot check -- loc.gov/photos returns a "Just a moment" challenge page to a script, so Prokudin-Gorsky
and the FSA/OWI color transparencies are read from Commons instead, which mirrors both collections with per-file
license metadata already attached).

Route:   the MediaWiki API, recursive category walk from a short list of ROOT categories (below), each a named
         historic color-photography collection or process. list=categorymembers with cmtype=subcat|file,
         prop=imageinfo for files (same call shape as tools/museums/commonsd.py, which this borrows its license
         and plain-text helpers from). A category is walked once (cached by title in <dir>/cats.json); each ROOT
         caps at ROOT_CAP files so one huge tree (Autochromes by author has 50+ photographer subcats) cannot
         starve the others, and SKIP_SUBCAT drops a few administrative or wrong-topic branches (modern amateur
         Kodachrome snapshots, maintenance categories) that would otherwise flood a tree with non-historic or
         non-PD files.
Kept:    files whose extmetadata LicenseShortName reads as public domain or CC0 (same OPEN/BAD regexes as
         commonsd.py: PD-old, PD-US, PD-USGov, Public domain, PDM, CC0 ...; CC BY / CC BY-SA dropped even where
         Commons allows them). Bitmap images only.
Color:   this file fetches metadata and the thumbnail only; the actual black-and-white/sepia/cyanotype exclusion
         (mean CIELAB chroma) runs later in tools/photos_corpus.py on the downloaded image, the same chroma test
         tools/corpus.py already uses to drop a museum's black-and-white photo of a painting (BW_C). A bulk,
         metadata-only pre-filter is not reliable here: many Commons titles don't say "autochrome" or "color" even
         when the file is one (and a few "Autochromes" are actually faded near-monochrome), so every candidate's
         real pixels get the final say.
Images:  Commons' own thumbnail URL built from the file's own width (thumb_url(), shared with commonsd.py).
Pace:    one request every 0.25s to the API, 4 threads sharing that gap (Commons' API is far better provisioned
         than a single museum's).
"""
import json
import re
import threading
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

from . import commonsd  # reuses plain(), thumb_url(), usable()'s OPEN/BAD license regexes

API = commonsd.API
INFO = dict(gap=0.25, workers=4, name="Wikimedia Commons (historic color photography collections)", api=API,
            license="Public domain / CC0 files only (per-file license read from Commons)")

# Each root: (category title, default process label, default country-ish hint used only when no better info is
# found). Walked recursively; SKIP_SUBCAT below prunes branches that are off-topic or not safely PD/CC0.
ROOTS = [
    ("Photographs by Sergey Prokudin-Gorsky", "Prokudin-Gorsky glass-plate (RGB composite)", "Russian Empire"),
    ("Color photographs from the Farm Security Administration", "Kodachrome (FSA/OWI)", "United States"),
    ("Autochromes", "Autochrome", None),
]
ROOT_CAP = 2200           # files kept per root, after license+dedup, before the chroma pass in photos_corpus.py
PER_CAT = 1100            # files asked per single category (the FSA root alone holds ~1,031 files directly, no
                          # subcategories to spread across, so this must be able to cover one big category in full)
MAX_CATS_PER_ROOT = 260   # recursion stop: trees like "Autochromes by author" have 50+ photographer subcats

# Branches that are not historic color photography, or not safely PD/CC0 as a whole, so are skipped rather than
# walked (their occasional good file is a small, acceptable loss; the task only needs ~1,500-5,000 total).
SKIP_SUBCAT = re.compile(
    r"maintenance|needing categor|media needing|without source|unidentified|duplicate|deletion requests?|"
    r"restoration|retouched|cleaned|digital reconstructions?|reproductions of|stereo(scopic)?|"
    r"broken autochromes|test (images|photographs)|modern recreations?|colori[sz]ed", re.I)


def _api(C, **kw):
    return C.fetch("photod", API + "?" + urllib.parse.urlencode(dict(kw, format="json", formatversion=2)))


def _subcats(C, title):
    out, cont = [], {}
    while True:
        r = _api(C, action="query", list="categorymembers", cmtitle=title, cmtype="subcat", cmlimit=200, **cont)
        out += [m["title"] for m in r.get("query", {}).get("categorymembers", [])]
        if "continue" not in r:
            return out
        cont = r["continue"]


# 320 is one of the CDN's documented thumbnail size buckets (https://w.wiki/GHai, "anti-stampede" policy on
# upload.wikimedia.org's static /thumb/ path, checked 2026-10-09): a request for an arbitrary width there now gets
# a 400 for plenty of files (a long or punctuation-heavy filename collapses Wikimedia's own thumb path to a
# generic "NNNpx-thumbnail.jpg" that cannot be reconstructed from the filename at all). iiurlwidth asks the API
# itself for the real, working thumburl in the same imageinfo call, no extra request, and it never guesses wrong.
_THUMB_W = 320


def _files(C, title, cap):
    out, cont = [], {}
    while len(out) < cap:
        r = _api(C, action="query", generator="categorymembers", gcmtitle=title, gcmtype="file", gcmlimit=50,
                 prop="imageinfo", iiprop="url|extmetadata|mime|size", iiurlwidth=_THUMB_W,
                 iiextmetadatafilter="LicenseShortName|Artist|ObjectName|ImageDescription|DateTimeOriginal", **cont)
        out += r.get("query", {}).get("pages", [])
        if "continue" not in r:
            break
        cont = dict(r["continue"])
    return out[:cap]


_YEAR = re.compile(r"(1[789]\d\d|20[0-4]\d)")


def _year_of(md, title_text):
    for field in ("DateTimeOriginal", "ObjectName", "ImageDescription"):
        v = commonsd.plain((md.get(field) or {}).get("value"))
        m = _YEAR.search(v or "")
        if m:
            return int(m.group(1))
    m = _YEAR.search(title_text or "")
    return int(m.group(1)) if m else None


def usable(page, process, country_hint):
    ii = (page.get("imageinfo") or [None])[0]
    if not ii or ii.get("mime") not in ("image/jpeg", "image/png", "image/gif", "image/tiff"):
        return None
    md = ii.get("extmetadata") or {}
    lic = (md.get("LicenseShortName") or {}).get("value") or ""
    if not commonsd.OPEN.search(lic) or commonsd.BAD.search(lic):
        return None
    art = commonsd.plain((md.get("Artist") or {}).get("value"))
    if len(art) > 70 or re.search(r"unknown|anonymous|uncredited|various|\bsee\b|http|commons", art, re.I):
        art = ""
    title_text = page["title"].split(":", 1)[-1]
    name = commonsd.plain((md.get("ObjectName") or {}).get("value")) or re.sub(r"\.\w+$", "", title_text)
    thumb = ii.get("thumburl") or commonsd.thumb_url(ii, width=_THUMB_W)  # thumburl is set whenever iiurlwidth
                                                                           # was honored; the fallback is only for
                                                                           # a response that somehow omitted it
    return dict(title=page["title"], name=name[:160], photographer=art or None, license=lic[:40],
                thumb=thumb, url=ii.get("descriptionshorturl") or ii.get("descriptionurl"),
                w=ii.get("width"), h=ii.get("height"), year=_year_of(md, title_text),
                process=process, country=country_hint)


def _walk_root(C, root_title, process, country_hint, done, lock):
    """Breadth-first over subcats (title-cached across calls in `done`), gathering files until ROOT_CAP (post-dedup)
    or MAX_CATS_PER_ROOT categories have been visited, whichever first -- a soft budget, not an exact cut."""
    frontier, seen_cats, rows, visited = [root_title], set(), {}, 0
    while frontier and len(rows) < ROOT_CAP and visited < MAX_CATS_PER_ROOT:
        cat = frontier.pop(0)
        if cat in seen_cats:
            continue
        seen_cats.add(cat)
        visited += 1
        key = "files:" + cat
        if key not in done:
            try:
                pages = _files(C, cat, PER_CAT)
                got = [u for u in (usable(p, process, country_hint) for p in pages) if u]
            except Exception as e:
                print(f"   photod {cat}: {e}", flush=True)
                got = []
            with lock:
                done[key] = got
        for u in done[key]:
            rows.setdefault(u["title"], dict(u, source_category=cat.split(":", 1)[-1]))
        subkey = "sub:" + cat
        if subkey not in done:
            try:
                subs = [s for s in _subcats(C, cat) if not SKIP_SUBCAT.search(s.split(":", 1)[-1])]
            except Exception:
                subs = []
            with lock:
                done[subkey] = subs
        frontier += done[subkey]
        print(f"photod {root_title}: visited {visited} cats, {len(rows)} files kept so far (at {cat})", flush=True)
    return rows


def meta(C, resume=False):
    d = C.SRC["photod"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    cache = d / "cats.json"
    done = json.loads(cache.read_text()) if resume and cache.exists() else {}
    lock = threading.Lock()
    all_rows = {}

    def job(root):
        title, process, country_hint = root
        rows = _walk_root(C, "Category:" + title, process, country_hint, done, lock)
        with lock:
            all_rows.update(rows)
            cache.write_text(json.dumps(done))
        print(f"photod: root '{title}' done, {len(rows)} files", flush=True)

    with ThreadPoolExecutor(len(ROOTS)) as ex:
        list(ex.map(job, ROOTS))
    cache.write_text(json.dumps(done))
    out = sorted(all_rows.values(), key=lambda r: (r["process"], r["title"]))
    print(f"photod: {len(out)} distinct PD/CC0 candidate files across {len(ROOTS)} collections (before the chroma "
          f"color/B&W pass)", flush=True)
    return C.write_meta("photod", out)


# Commons' "Artist" field is written however the uploader typed it: LOC catalog records give "Last, First,
# 1903-1986, photographer"; some autochrome uploads swap name order ("Passet Stéphane" vs "Stéphane Passet"); a
# few carry a trailing "(1875-1942)", "(d. 1942)", a stray ".", or a "?" marking an uncertain attribution; and
# Prokudin-Gorsky himself appears under half a dozen Latin and Cyrillic spellings across different subtrees. All
# of this is cosmetic cleanup of the SAME person, never a judgment about who made the photograph -- no filtering,
# only spelling. A photographer with no real name recorded (an institution, or "?" alone) is left as None.
_PHOTOGRAPHER_ALIAS = {
    "sergei prokudin-gorskii": "Sergey Prokudin-Gorsky", "sergei mikhailovich prokudin-gorskii": "Sergey Prokudin-Gorsky",
    "прокудин-горский": "Sergey Prokudin-Gorsky", "прокудин-горский, сергей михайлович": "Sergey Prokudin-Gorsky",
    "сергей михайлович прокудин-горский": "Sergey Prokudin-Gorsky", "passet stéphane": "Stéphane Passet",
    "léon auguste": "Auguste Léon", "gervais-courtellemont": "Jules Gervais-Courtellemont",
}
_DROP_PHOTOGRAPHER = re.compile(
    r"^(the library of congress|library of congress|rijksmuseum|george eastman house|national library of norway|"
    r"swedish national heritage board|national gallery of denmark|national museum|unknown|anonymous|various)\s*\??$",
    re.I)


def _clean_photographer(raw):
    if not raw:
        return None
    s = re.sub(r"\s+", " ", raw).strip().rstrip(" .?")
    s = re.sub(r"\s*\((?:\d{4}(?:-\d{4})?|d\.\s*\d{4}|b\.\s*\d{4})\)\s*$", "", s).strip()  # "(1875-1942)", "(d. 1942)"
    m = re.match(r"^([^,]+),\s*([^,]+?)(?:,\s*\d{4}(?:-\d{4})?)?(?:,\s*photographer)?$", s, re.I)
    if m and len(m.group(1).split()) <= 3 and len(m.group(2).split()) <= 3:
        s = f"{m.group(2)} {m.group(1)}"  # "Lee, Russell, 1903-1986, photographer" -> "Russell Lee"
    s = re.sub(r"\s+", " ", s).strip()
    key = s.lower()
    s = _PHOTOGRAPHER_ALIAS.get(key, s)
    if not s or _DROP_PHOTOGRAPHER.match(s):
        return None
    return s


def group_key(C, x):
    return f"photod:{x['title']}"


def image_urls(x):
    return [x["thumb"]]


def norm(C, x):
    return dict(id="photod-" + re.sub(r"\W+", "_", x["title"].split(":", 1)[-1])[:70], src="photod",
                t=C.clean_title(x["name"]), a=_clean_photographer(x.get("photographer")), y=x.get("year"),
                co=x.get("country"), process=x.get("process"), img=image_urls(x)[0], url=x.get("url"),
                lic=x.get("license"), category=x.get("source_category"))
