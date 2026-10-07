"""The Metropolitan Museum of Art, New York: Open Access API, no key. https://metmuseum.github.io/

Ids:     /public/collection/v1.1/search, paged 500 at a time (the one-shot /v1/search was retired on 2026-10-01):
         medium=Paintings, plus departmentId=11 (European Paintings), both with hasImages=true and q=*. A search past
         10,000 results is split by department.
Filter:  the Met's Open Access CSV (MetObjects.csv, CC0, from the metmuseum/openaccess repository; one ~320 MB
         download) says which of those ids are public domain and classified "Paintings" (the Met's own class;
         codices, miniatures, fans, prints and drawings are other classes), so the API is asked only about those.
Records: GET /public/collection/v1/objects/{id} for each, for its image URL (and the same fields as the CSV), appended
         to met/objects.jsonl. The painting's image is fetched right after its record, in a shuffled order, so a run
         stopped early still leaves a random sample of complete paintings. --resume continues it.
Kept:    isPublicDomain true, a primary image, and classification "Paintings", "Paintings-Panels" or "Paintings-Fresco"
         (the American Wing leaves classification empty: there, object name "Painting" but not "Painting, miniature").
Images:  the "mobile-large" rendition, about 450 px wide: the same path as primaryImageSmall ("web-large", ~600-800 px)
         one size down. If it is missing, web-large. The row's img is the URL that worked.
Pace:    the Met asks for at most 80 requests a second, but the Imperva shield in front of both the API and the image
         server refuses (HTTP 403) much slower clients: it stopped us after ~80 requests at 8 a second and after ~115
         at 2 a second. So this starts at one request every 1.5 s, stands back COOLDOWN seconds on a 403, and comes
         back 1.5x slower each time. At that pace the full set takes hours: run it in the background and --resume.
Country: the object's country, else its culture ("India (Rajasthan, Mewar)"), else the artist's nationality ("Dutch").
School:  the Indian painting schools corpus.py takes from Cleveland's culture field, read from the Met's culture and
         period: Mughal, Rajput (Rajasthan), Pahari (Punjab Hills), Company School.
"""
import csv
import json
import random
import re
import sys
import time
import urllib.error

from . import common

API = "https://collectionapi.metmuseum.org/public/collection"
CSV_URL = "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv"
INFO = dict(gap=1.5, workers=1, name="The Metropolitan Museum of Art", api="https://metmuseum.github.io/",
            license="CC0 metadata and images (Open Access; public-domain works only)")
FIELDS = ["objectID", "isPublicDomain", "primaryImageSmall", "accessionNumber", "department", "objectName", "title",
          "culture", "period", "dynasty", "artistRole", "artistPrefix", "artistDisplayName", "artistNationality",
          "objectDate", "objectBeginDate", "objectEndDate", "medium", "classification", "country", "region",
          "objectURL"]
SEARCHES = [dict(medium="Paintings", hasImages="true", q="*"), dict(departmentId=11, hasImages="true", q="*")]
SCHOOL = [(re.compile(p, re.I), m) for p, m in [
    (r"mughal", "Mughal"), (r"pahari|punjab hills", "Pahari"), (r"company school", "Company School"),
    (r"rajput|rajasthan", "Rajput"), (r"kalighat", "Kalighat")]]
COOLDOWN, MAX_COOLDOWNS, MAX_GAP = 900, 8, 8.0


PAINT_CLASSES = {"Paintings", "Paintings-Panels", "Paintings-Fresco"}
AMERICAN_WING = re.compile(r"^painting\b(?!, miniature)", re.I)  # the American Wing leaves classification empty


def is_painting(cls, name):
    return cls in PAINT_CLASSES or (not cls and bool(AMERICAN_WING.match(name or "")))


def keep(x):
    return bool(x.get("isPublicDomain") and x.get("primaryImageSmall")
                and is_painting(x.get("classification") or "", x.get("objectName")))


def _search_all(C, q, ids):
    """Every id of one search. The paged search stops at 10,000 results (offset + limit), so a bigger result is
    split by department (each object has exactly one), and a department still too big by date range."""
    qs = "&".join(f"{k}={v}" for k, v in q.items())
    r = C.fetch("met", f"{API}/v1.1/search?{qs}&offset=0&limit=500")
    total = r.get("total") or 0
    if total > 9500 and "departmentId" not in q:
        for dep in C.fetch("met", f"{API}/v1/departments")["departments"]:
            _search_all(C, dict(q, departmentId=dep["departmentId"]), ids)
        return
    if total > 9500 and "dateBegin" not in q:
        for lo, hi in [(-5000, 1599), (1600, 1799), (1800, 1899), (1900, 2100)]:
            _search_all(C, dict(q, dateBegin=lo, dateEnd=hi), ids)
        return
    got = r.get("objectIDs") or []
    ids.update(got)
    off = 500
    while off < total and got:
        got = C.fetch("met", f"{API}/v1.1/search?{qs}&offset={off}&limit=500").get("objectIDs") or []
        ids.update(got)
        off += 500
    print(f"met ids {q}: {total}; {len(ids)} distinct so far", flush=True)


def search_ids(C, resume):
    p = C.SRC["met"]["dir"] / "ids.json"
    if resume and p.exists():
        return json.loads(p.read_text())
    ids = set()
    for q in SEARCHES:
        _search_all(C, q, ids)
    ids = sorted(ids)
    p.write_text(json.dumps(ids))
    return ids


def candidates(C, ids, resume):
    """Ids the Open Access CSV marks public domain and "Paintings", in a fixed shuffled order."""
    d = C.SRC["met"]["dir"]
    p = d / "candidates.json"
    if resume and p.exists():
        return json.loads(p.read_text())
    csv_p = d / "MetObjects.csv"
    if not (resume and csv_p.exists()):
        print("met: downloading the Open Access CSV", flush=True)
        C.download("met", CSV_URL, csv_p)
    csv.field_size_limit(sys.maxsize)
    want, seen, out = set(ids), 0, []
    with open(csv_p, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            seen += 1
            try:
                oid = int(r["Object ID"])
            except (TypeError, ValueError):
                continue
            if oid in want and r.get("Is Public Domain") == "True" and \
                    is_painting(r.get("Classification") or "", r.get("Object Name")):
                out.append(oid)
    random.Random(1).shuffle(out)
    print(f"met: the CSV lists {seen} objects; {len(out)} of the {len(ids)} search hits are public-domain paintings",
          flush=True)
    p.write_text(json.dumps(out))
    return out


def _save(C, have, complete):
    rows = sorted((dict(x, id=x["objectID"]) for x in have.values() if not x.get("_missing") and keep(x)),
                  key=lambda x: x["id"])
    C.write_meta("met", rows, complete=complete)
    return rows


def meta(C, resume=False):
    d = C.SRC["met"]["dir"]
    (d / "img").mkdir(parents=True, exist_ok=True)
    ids = search_ids(C, resume)
    todo_all = candidates(C, ids, resume)
    obj_p = d / "objects.jsonl"
    if not resume and obj_p.exists():
        obj_p.rename(d / "objects.prev.jsonl")
    have = {x["objectID"]: x for x in common.jsonl_read(obj_p)}
    t0, n, cooldowns = time.time(), 0, 0
    todo = [i for i in todo_all if i not in have]
    print(f"met: {len(todo_all)} public-domain paintings, {len(have)} records cached, {len(todo)} to fetch "
          f"(one request every {C.SRC['met']['gap']:.1f} s)", flush=True)
    with obj_p.open("a") as f:
        i = 0
        while i < len(todo):
            oid = todo[i]
            try:
                r = C.fetch("met", f"{API}/v1/objects/{oid}")
                rec = {k: r.get(k) for k in FIELDS}
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    rec = {"objectID": oid, "_missing": True}
                elif e.code == 403 and cooldowns < MAX_COOLDOWNS:
                    cooldowns += 1
                    C.SRC["met"]["gap"] = min(MAX_GAP, C.SRC["met"]["gap"] * 1.5)
                    f.flush()
                    _save(C, have, False)
                    print(f"met: refused (403) after {n} records this run; waiting {COOLDOWN // 60} min, then one "
                          f"request every {C.SRC['met']['gap']:.1f} s", flush=True)
                    time.sleep(COOLDOWN)
                    continue
                else:
                    print(f"   met {oid}: HTTP {e.code}; stopping (re-run with --resume later)", flush=True)
                    break
            except RuntimeError as e:
                print(f"   met {oid}: {e}", flush=True)
                i += 1
                continue
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            have[oid] = rec
            n += 1
            i += 1
            if not rec.get("_missing") and keep(rec) and not C.img_path("met", oid).exists():
                err = C.save_image("met", dict(rec, id=oid))
                if isinstance(err, urllib.error.HTTPError) and err.code == 403 and cooldowns < MAX_COOLDOWNS:
                    cooldowns += 1  # the image server shares the shield; the image is retried by `images met`
                    C.SRC["met"]["gap"] = min(MAX_GAP, C.SRC["met"]["gap"] * 1.5)
                    print(f"met: image refused (403); waiting {COOLDOWN // 60} min, then one request every "
                          f"{C.SRC['met']['gap']:.1f} s", flush=True)
                    time.sleep(COOLDOWN)
            if n % 100 == 0:
                f.flush()
                _save(C, have, False)
                el = time.time() - t0
                print(f"met: {n} records this run, {len(have)}/{len(todo_all)} cached, {el / 60:.0f} min", flush=True)
    done = all(i in have for i in todo_all)
    rows = _save(C, have, done)
    print(f"met: {len(rows)} public-domain paintings with images so far; "
          f"{'complete' if done else 'partial, re-run with --resume'}", flush=True)
    return rows


def group_key(C, x):
    return C.leaf_group("met", x.get("accessionNumber"), x.get("title"), x["id"])


def image_urls(x):
    p = x.get("primaryImageSmall") or ""
    small = p.replace("/web-large/", "/mobile-large/")
    return [small, p] if small != p else [p]


def norm(C, x):
    prefix = (x.get("artistPrefix") or "").strip()
    name = (x.get("artistDisplayName") or "").split("|")[0].strip()
    if re.search(r"\bpainters\b|\bworkshop\b", name, re.I):  # "Netherlandish (Antwerp Mannerist) Painters"
        name = ""
    a = C.clean_artist(common.artist_name(name, prefix))
    y, span = common.year_span(x.get("objectDate"), x.get("objectBeginDate"), x.get("objectEndDate"))
    place = " ".join(filter(None, [x.get("country"), x.get("culture")]))
    co = C.country_of(x.get("country")) or C.country_of(x.get("culture")) or \
        common.nationality_country(C, x.get("artistNationality"))
    if co is None and (place or x.get("artistNationality")):
        C.UNMAPPED["met: " + (place or x.get("artistNationality"))] += 1
    school_text = " ".join(filter(None, [x.get("culture"), x.get("period"), x.get("dynasty")]))
    mv = next((m for rx, m in SCHOOL if rx.search(school_text)), None)
    used = C.img_used("met").get(str(x["id"]))
    return dict(id=f"met-{x['id']}", src="met", t=C.clean_title(x.get("title")), a=a, y=y, span=span, co=co, mv=mv,
                img=used or image_urls(x)[0])
