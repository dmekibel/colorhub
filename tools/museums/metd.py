"""The Metropolitan Museum of Art, 20th-century design: Open Access CSV + the keyless collection API. https://metmuseum.github.io/

Why: in-copyright 20th-century design is mostly missing from open collections, and the Met's Open Access (CC0) holds
public-domain costume, textiles, ephemera, glass, ceramics and furniture from 1900-1979 that the other sources lack.
Ids:     the Met's Open Access CSV (MetObjects.csv, CC0; the same ~320 MB file tools/museums/met.py downloads, read from
         research/_raw/met/ in this checkout or the main one), "Is Public Domain" True, object begin date 1900-1979,
         mapped to a design category (costume: department Costume Institute; textile: Textiles-*; glass; ceramics;
         furniture; product: metalwork, silver, horology; poster / graphic: ephemera by object name). A seeded sample of
         PER_CELL per category x decade, so the (slow) API is asked about ~1,500 objects, not 30,000.
Records:  GET /public/collection/v1/objects/{id} for the image URL; the image (mobile-large, ~450 px) is fetched right
         after its record and a 200 px copy cached as img/metd-<id>.jpg.
Pace:    as met.py: one request every 1.5 s; the Imperva shield in front of the Met refuses clients that are quick or
         steady for long (HTTP 403), so on a 403 this stands back COOLDOWN seconds and returns 1.5x slower. It never
         tries to get round the shield. --resume continues.
"""
import csv
import json
import random
import re
import sys
import time
import urllib.error
from pathlib import Path

from . import common, met

INFO = dict(gap=1.5, workers=1, name="The Metropolitan Museum of Art (20th-century design)", api="https://metmuseum.github.io/",
            license="CC0 metadata and images (Open Access; public-domain works only)")
API = met.API
PER_CELL = 35
FIELDS = met.FIELDS
POSTER = re.compile(r"poster|broadside|placard|billboard", re.I)
GRAPHIC = re.compile(r"trade card|advertis|label|cover|valentine|greeting|calendar|postcard|brochure|catalog|packag|"
                     r"fashion plate|sheet music|program|menu|bookplate", re.I)


def category(r):
    dept, cl, name = r["Department"], r["Classification"] or "", (r["Object Name"] or "") + " " + (r["Title"] or "")
    if dept == "Costume Institute":
        return "costume"
    if "Ephemera" in cl:
        return "poster" if POSTER.search(name) else "graphic" if GRAPHIC.search(name) else None
    if cl.startswith("Textiles"):
        return "textile"
    if cl.startswith("Glass"):
        return "glass"
    if cl.startswith("Ceramics"):
        return "ceramics"
    if cl.startswith("Furniture") or "Furniture" in cl:
        return "furniture"
    if cl.startswith(("Metalwork", "Silver", "Horology", "Lighting", "Woodwork", "Enamels")):
        return "product"
    if cl.startswith("Jewelry") or cl.startswith("Fans"):
        return "costume"
    return None


def csv_path(C):
    for p in (C.SRC["metd"]["dir"] / "MetObjects.csv", C.RAW / "met" / "MetObjects.csv",
              C.ROOT.parent.parent.parent / "research" / "_raw" / "met" / "MetObjects.csv"):
        if p.exists():
            return p
    p = C.SRC["metd"]["dir"] / "MetObjects.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    C.download("metd", met.CSV_URL, p)
    return p


def candidates(C):
    d = C.SRC["metd"]["dir"]
    cp = d / "candidates.json"
    if cp.exists():
        return json.loads(cp.read_text())
    csv.field_size_limit(sys.maxsize)
    cells = {}
    with open(csv_path(C), newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["Is Public Domain"] != "True":
                continue
            try:
                b = int(r["Object Begin Date"])
            except (TypeError, ValueError):
                continue
            if not 1900 <= b <= 1979:
                continue
            cat = category(r)
            if cat:
                cells.setdefault((cat, b // 10 * 10), []).append(int(r["Object ID"]))
    rng = random.Random(5)
    out = []
    for k in sorted(cells):
        ids = sorted(cells[k])
        rng.shuffle(ids)
        out += [dict(id=i, cat=k[0]) for i in ids[:PER_CELL * 2]]   # twice the quota: some have no image
    rng.shuffle(out)
    d.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps(out))
    print(f"metd: {len(out)} candidate ids from the CSV in {len(cells)} category x decade cells", flush=True)
    return out


def meta(C, resume=False):
    d = C.SRC["metd"]["dir"]
    (d / "img").mkdir(parents=True, exist_ok=True)
    cands = candidates(C)
    obj_p = d / "objects.jsonl"
    have = {x["objectID"]: x for x in common.jsonl_read(obj_p)}
    got = {}   # (cat, decade) -> kept records so far
    for x in have.values():
        if not x.get("_missing") and x.get("isPublicDomain") and x.get("primaryImageSmall"):
            got[(x["cat"], x["objectBeginDate"] // 10 * 10)] = got.get((x["cat"], x["objectBeginDate"] // 10 * 10), 0) + 1
    cooldowns, n, i = 0, 0, 0
    todo = [c for c in cands if c["id"] not in have]
    print(f"metd: {len(cands)} candidates, {len(have)} cached, {len(todo)} to fetch", flush=True)
    with obj_p.open("a") as f:
        while i < len(todo):
            c = todo[i]
            try:
                r = C.fetch("metd", f"{API}/v1/objects/{c['id']}")
                rec = {k: r.get(k) for k in FIELDS}
                rec["cat"] = c["cat"]
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    rec = {"objectID": c["id"], "_missing": True}
                elif e.code == 403 and cooldowns < met.MAX_COOLDOWNS:
                    cooldowns += 1
                    C.SRC["metd"]["gap"] = min(met.MAX_GAP, C.SRC["metd"]["gap"] * 1.5)
                    print(f"metd: refused (403) after {n} records; waiting {met.COOLDOWN // 60} min", flush=True)
                    time.sleep(met.COOLDOWN)
                    continue
                else:
                    print(f"   metd {c['id']}: HTTP {e.code}; stopping (re-run with --resume)", flush=True)
                    break
            except RuntimeError as e:
                print(f"   metd {c['id']}: {e}", flush=True)
                i += 1
                continue
            i += 1
            n += 1
            ok = not rec.get("_missing") and rec.get("isPublicDomain") and rec.get("primaryImageSmall")
            if ok:
                cell = (rec["cat"], rec["objectBeginDate"] // 10 * 10)
                if got.get(cell, 0) >= PER_CELL:
                    rec["_skip"] = True   # the cell is full: keep the record, spend no image request
                else:
                    ip = d / "img" / f"metd-{rec['objectID']}.jpg"
                    err = C.save_image("metd", dict(rec, id=f"metd-{rec['objectID']}"))
                    if isinstance(err, urllib.error.HTTPError) and err.code == 403 and cooldowns < met.MAX_COOLDOWNS:
                        cooldowns += 1
                        C.SRC["metd"]["gap"] = min(met.MAX_GAP, C.SRC["metd"]["gap"] * 1.5)
                        print(f"metd: image refused (403); waiting {met.COOLDOWN // 60} min", flush=True)
                        time.sleep(met.COOLDOWN)
                    if ip.exists():
                        got[cell] = got.get(cell, 0) + 1
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            have[c["id"]] = rec
            if n % 50 == 0:
                f.flush()
                print(f"metd: {n} records this run; kept {sum(got.values())}", flush=True)
    rows = [x for x in have.values() if not x.get("_missing") and not x.get("_skip") and x.get("isPublicDomain")
            and x.get("primaryImageSmall") and (d / "img" / f"metd-{x['objectID']}.jpg").exists()]
    print(f"metd: {len(rows)} objects with images kept", flush=True)
    return C.write_meta("metd", rows)


def group_key(C, x):
    return f"metd:{x['objectID']}"


def image_urls(x):
    return met.image_urls(x)


def norm(C, x):
    a = C.clean_artist(common.artist_name((x.get("artistDisplayName") or "").split("|")[0].strip(), x.get("artistPrefix") or ""))
    y, _ = common.year_span(x.get("objectDate"), x.get("objectBeginDate"), x.get("objectEndDate"))
    return dict(id=f"metd-{x['objectID']}", src="metd", t=C.clean_title(x.get("title")), a=a, y=y,
                co=C.country_of(x.get("country")) or C.country_of(x.get("culture")), cat=x["cat"],
                ty=(x.get("objectName") or "")[:30], img=image_urls(x)[0], url=x.get("objectURL"))
