"""Internet Archive, Pulp Magazine Archive collection (archive.org/details/pulpmagazinearchive): the public
advancedsearch and metadata APIs, no key, no sign-up.

Records: `advancedsearch.php?q=collection:pulpmagazinearchive AND (title:"Weird Tales" OR ...)` (MAGS below, the same
         title list as pulpc.py's Commons pass, since the two sources cover the same titles from different angles)
         returns identifier, title, date/year, publisher and creator; paginated at ROWS a page. The query already
         restricts to this one collection and to titles that match a classic pulp or dime-novel magazine, so an IA
         item for a 1970s fanzine or a slick magazine ("McCall's", "Photoplay") that merely shares a word never
         matches.
Kept:    only items that are public domain in the US by our own rule: publication year 1929 or earlier (hard PD), OR
         an item whose own `licenseurl` names the public-domain mark (IA's uploaders mark a title PD when its
         copyright was not renewed; this corpus takes that assertion the same way commonsd.py takes a Commons file's
         own license field, not a court finding). Everything else -- a scan with no PD marking and a 1930s-60s date --
         is left out, even though many of those pulps did lapse into the public domain: verifying renewal per issue is
         out of scope here.
Images:  IA's own thumbnail service, `archive.org/services/img/<identifier>` (a redirect to the item's cover page
         image, about 180x240). No per-page IIIF call, no image stored beyond our own cached 200px copy.
Pace:    one request every 0.5 s (gentler than IA's own documented limits), one worker thread; items() paginates with
         `page=`, `rows=100`.
"""
import re
import time
import urllib.parse

API = "https://archive.org/advancedsearch.php"
IMG = "https://archive.org/services/img/{}"
INFO = dict(gap=0.5, workers=1, name="Internet Archive (Pulp Magazine Archive collection)", api=API,
            license="Public domain only (pre-1930 publication, or the item's own public-domain-mark license)")
MAGS = [
    "Weird Tales", "Amazing Stories", "Astounding Stories", "Astounding Science Fiction", "Black Mask", "Argosy",
    "Argosy All-Story Weekly", "Adventure", "All-Story", "All-Story Weekly", "Blue Book", "Short Stories", "Munsey's",
    "Cavalier", "Top-Notch", "Wonder Stories", "Science Wonder Stories", "Air Wonder Stories", "Startling Stories",
    "Thrilling Wonder Stories", "Planet Stories", "Fantastic Adventures", "Unknown", "Strange Tales", "Ghost Stories",
    "Doc Savage", "The Shadow", "Dime Detective", "Dime Detective Magazine", "Detective Fiction Weekly",
    "Western Story Magazine", "Ranch Romances", "Love Story Magazine", "Clues Detective Stories", "Dime Mystery",
    "Horror Stories", "Terror Tales", "Operator 5", "G-8 and His Battle Aces", "The Phantom Detective", "The Spider",
    "Thrilling Detective", "Spicy Detective Stories", "Spicy Adventure Stories", "Spicy Mystery Stories",
    "Dime Western Magazine", "Texas Rangers", "Wild West Weekly", "Nick Carter Weekly", "Buffalo Bill Stories",
    "Frank Merriwell", "Tip Top Weekly", "New Nick Carter Weekly", "People's", "Everybody's Magazine",
]
PD_LICENSE = re.compile(r"publicdomain|public_domain|/zero/|creativecommons\.org/publicdomain", re.I)
FIELDS = ["identifier", "title", "date", "year", "publisher", "creator", "licenseurl", "mediatype"]


def _title_query():
    return "collection:pulpmagazinearchive AND (" + " OR ".join(f'title:"{t}"' for t in MAGS) + ")"


def _search(C, q, rows, page):
    params = {"q": q, "rows": rows, "page": page, "output": "json"}
    for f in FIELDS:
        params.setdefault("fl[]", [])
    url = API + "?" + urllib.parse.urlencode({"q": q, "rows": rows, "page": page, "output": "json"}
                                              ) + "".join(f"&fl[]={f}" for f in FIELDS)
    return C.fetch("pulpia", url)


def meta(C, resume=False):
    import json
    d = C.SRC["pulpia"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    out_p = d / "meta.json"
    rows = {r["identifier"]: r for r in json.loads(out_p.read_text())["rows"]} if resume and out_p.exists() else {}
    q = _title_query()
    rows_per_page, page = 100, 1
    while True:
        try:
            r = _search(C, q, rows_per_page, page)
        except Exception as e:
            print(f"   pulpia page {page}: {e}", flush=True)
            break
        docs = r.get("response", {}).get("docs", [])
        if not docs:
            break
        for doc in docs:
            if doc.get("mediatype") not in (None, "texts"):
                continue
            year = doc.get("year")
            try:
                year = int(year) if year is not None else (int(doc["date"][:4]) if doc.get("date") else None)
            except (ValueError, TypeError):
                year = None
            lic = doc.get("licenseurl") or ""
            if not ((year is not None and year <= 1929) or PD_LICENSE.search(lic)):
                continue
            rows[doc["identifier"]] = dict(id=doc["identifier"], title=doc.get("title") or doc["identifier"],
                                            year=year, publisher=doc.get("publisher"), creator=doc.get("creator"),
                                            lic=lic or "public domain mark (pre-1930)")
        total = r.get("response", {}).get("numFound", 0)
        print(f"pulpia page {page}: {len(docs)} docs, {len(rows)} kept so far (of {total} matching)", flush=True)
        if page % 5 == 0:
            C.write_meta("pulpia", sorted(rows.values(), key=lambda r: r["id"]), complete=False)
        if page * rows_per_page >= total:
            break
        page += 1
        time.sleep(0.2)
    out = sorted(rows.values(), key=lambda r: r["id"])
    return C.write_meta("pulpia", out)


def image_urls(x):
    return [IMG.format(x["id"])]


ARTIST_RX = re.compile(r"\b(ill(?:us(?:trated|tration)?)?\.?\s*by|cover\s*(?:art|by)|art\s*by)\s*[:\-]?\s*"
                        r"([A-Z][\w.'\-]+(?:\s+[A-Z][\w.'\-]+){0,3})", re.I)
# Everything after the magazine's own name in an IA title: volume/number/issue counters, a bare date, a parenthetical
# (scan credits, alt titles, story titles), or a trailing comma clause ("Argosy, Aug 3 1919"). Cut at the first one.
MAG_CUT = re.compile(
    r"\s*(,|\(|\[|#|\bv\.?\s*0*\d|\bvol(ume)?\.?\s*0*\d|\bn0*\d|\bno\.?\s*0*\d|\b\d{3,4}\b|"
    r"\b(19|18)\d{2}[\-/]\d{1,2}([\-/]\d{1,2})?\b).*$", re.I)


MAG_CANON = {  # the same title, spelled a few ways across scan filenames
    "the cavalier": "Cavalier", "the argosy": "Argosy", "the golden argosy": "Argosy",
    "golden argosy magazine": "Argosy", "argosy all story weekly": "Argosy All-Story Weekly",
    "argosy and railroad man's magazine": "Argosy", "all story weekly": "All-Story Weekly",
    "all-story": "All-Story Weekly", "the all-story magazine": "All-Story Magazine",
    "all story magazine": "All-Story Magazine", "top-notch": "Top-Notch Magazine",
    "top notch magazine": "Top-Notch Magazine", "nick carter weekly": "New Nick Carter Weekly",
}


def mag_of(title):
    m = MAG_CUT.search(title)
    mag = (title[:m.start()] if m else title).strip(" ,-")
    mag = mag or title.strip()
    return MAG_CANON.get(mag.lower(), mag)


def norm(C, x):
    # creator is usually the writer, not the cover artist (IA metadata rarely separates the two); kept only when
    # the title or creator text itself names a cover-art credit ("ill. by ..."), else left blank.
    art = None
    m = ARTIST_RX.search(f"{x.get('title') or ''} {x.get('creator') or ''}")
    if m:
        art = m.group(2).strip()
    mag = mag_of(x["title"])
    return dict(id="pulpia-" + re.sub(r"\W+", "_", x["id"])[:60], src="pulpia", t=C.clean_title(x["title"]), a=art,
                y=x["year"], co="United States", cat="pulp", ty="pulp magazine cover", img=image_urls(x)[0],
                url=f"https://archive.org/details/{x['id']}", lic=x["lic"][:60], mag=mag[:80])
