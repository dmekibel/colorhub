#!/usr/bin/env python3
"""ColorHub botanical & bird plates: hand-colored natural-history illustrations, public domain only, from
Wikimedia Commons (the MediaWiki API, no key, no account) -- Audubon's "The Birds of America" (plates engraved
by Robert Havell after Audubon's watercolors, published 1827-1838, long public domain), Curtis's Botanical
Magazine (via the Biodiversity Heritage Library's own Flickr stream, re-hosted on Commons and marked PD there),
and Pierre-Joseph Redouté's flower and rose plates. Modeled on tools/design_corpus.py's pipeline shape (reuses
its palette/naming code directly) but Commons categories replace a museum API: one request per page of up to 50
files already returns the thumbnail URL AND the license/credit metadata together (prop=imageinfo), so there is
no separate per-object metadata call the way the museum adapters need.

  python3 tools/botanical_corpus.py meta [key ...]    # 1. walk the Commons categories -> research/_raw/botanical/<key>.jsonl
  python3 tools/botanical_corpus.py select            # 2. balanced pick -> research/_raw/botanical-selected.json
  python3 tools/botanical_corpus.py images            # 3. one cached image per selected plate (for the palette only)
  python3 tools/botanical_corpus.py palettes          # 4. 6-color k-means palette per cached image
  python3 tools/botanical_corpus.py build             # 5. name the colors, write data/botanical/plates.json
  python3 tools/botanical_corpus.py status

Served images are Commons' own thumbnail URLs (upload.wikimedia.org), hotlinked -- the same choice the app
already makes for botany/gem/fashion photos (js/world.js worldImgHTML's own comment: "A hotlinked Commons image
(no local copy)"). The `images` step here downloads a local copy ONLY so Pillow can read real pixels for the
k-means palette; that local copy is never shipped or referenced by the app.

Licensing: every plate is kept only when Commons' own extmetadata.LicenseShortName reads as public domain (the
same OPEN/BAD regex museums/commonsd.py already uses) -- these works are 140-230 years old, so this is almost
always "Public domain" from age, not a borrowed CC license.

Honest limits: these are 19th-century hand-colored engravings and lithographs, scanned or photographed from
surviving bound volumes -- aged paper, hand-applied watercolor that was never perfectly consistent plate to
plate, and a scan/photograph on top of that. Every page says so once.
"""
import io
import json
import re
import sys
import time
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
import design_corpus as D  # noqa: E402

RAW = ROOT / "research" / "_raw" / "botanical"
OUT = ROOT / "data" / "botanical"
SEL = RAW / "selected.json"
PAL = RAW / "palettes.jsonl"
API = "https://commons.wikimedia.org/w/api.php"
UA = C.UA

# key -> (Commons category title, subject kind "bird"/"plant", cap, how to read the plate's subject name)
SOURCES = [
    ("audubon", "The Birds of America", "bird", 500),
    ("curtis", "Curtis's Botanical Magazine - uploaded by Flickr", "plant", 700),
    ("redoute-fleurs", "Choix des plus belles fleurs", "plant", 200),
    ("redoute-roses", "Les Roses (Redouté)", "plant", 200),
]
OPEN = re.compile(r"^(pd\b|pd-|public domain|cc0|cc-zero|no restrictions|pdm|copyrighted free use|"
                  r"attribution not required)", re.I)
BAD = re.compile(r"\bcc[- ]by|gfdl|fair use|non-free|copyrighted\b(?! free use)|attribution\b(?! not)", re.I)
TAG = re.compile(r"<[^>]+>")
PLATE_NUM = re.compile(r"^(plate|pl\.?|no\.?|fig\.?)?\s*\d+[.:\-]?\s*", re.I)


def _api(**kw):
    for i in range(5):
        try:
            qs = urllib.parse.urlencode(dict(kw, format="json", formatversion=2))
            req = __import__("urllib.request", fromlist=["Request"]).Request(API + "?" + qs, headers={"User-Agent": UA})
            with __import__("urllib.request", fromlist=["urlopen"]).urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"   commons API retry ({e})", flush=True)
            time.sleep(3 * (i + 1))
    raise RuntimeError("commons API failed")


def clean_text(s):
    return TAG.sub("", s or "").strip()


def clean_artist_field(s):
    """BHL's own Flickr uploads (almost all of "curtis") carry a semicolon-joined list of contributing
    institutions and catalog citations in the Artist field (e.g. "Bentham-Moxon Trust.; Curtis, William;
    Curtis's botanical magazine dedications, 1827-1927 : portraits and biographical notes.; Royal Botanic
    Gardens, Kew.; Stanley Smith Horticultural Trust.") rather than the one illustrator who actually drew this
    specific plate -- the magazine ran for over a century under many different artists, so crediting "William
    Curtis" (who founded it in 1787 and died in 1799) on a plate from, say, 1900 would be a wrong fact dressed
    as a clean one. Rather than show that whole run-on string as a person's name, this drops it (None) when it
    looks like that citation list (more than one semicolon, or over 60 characters), so the page's honest
    "Collection" fact carries the publication credit instead."""
    if not s:
        return None
    if s.count(";") > 1 or len(s) > 60:
        return None
    return s


GENERIC_TITLE = re.compile(r"^(Curtis'?s botanical magazine|The botanical magazine)\b", re.I)
# BHL's own Flickr uploads (almost all of "curtis") carry the generic serial title ("Curtis's botanical
# magazine (No. 880)") but tag the real species as a Commons category, two shapes seen live: "Genus species -
# botanical illustrations" and "Genus species (illustrations)" -- the same pattern Audubon's own species
# categories use ("Setophaga cerulea (illustrations)"), confirmed 2026-10-09 by inspecting raw category strings.
SPECIES_IN_CATS = [re.compile(r"([A-Z][a-zA-Z×.\-]+(?: [a-zA-Z×.\-]+){1,3}?)\s*-\s*botanical illustrations", re.I),
                   re.compile(r"([A-Z][a-zA-Z×.\-]+(?: [a-zA-Z×.\-]+){1,3}?)\s*\(illustrations\)")]


def species_from_categories(categories):
    for rx in SPECIES_IN_CATS:
        m = rx.search(categories or "")
        if m:
            return m.group(1).strip()
    return None


def subject_from_title(title, row):
    t = re.sub(r"^File:", "", title)
    t = re.sub(r"\.(jpe?g|png|tiff?|gif)$", "", t, flags=re.I)
    t = PLATE_NUM.sub("", t).strip()
    t = re.sub(r"\s*\(cropped\)\s*$", "", t, flags=re.I).strip()
    if not t or GENERIC_TITLE.match(t):
        sp = species_from_categories(row.get("categories"))
        if sp:
            return sp
    return t or title


def walk_category(cat, cap):
    out, cont = [], {}
    while len(out) < cap:
        r = _api(action="query", generator="categorymembers", gcmtitle=f"Category:{cat}", gcmtype="file",
                 gcmlimit=50, prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=400, **cont)
        pages = (r.get("query") or {}).get("pages") or []
        for p in pages:
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            meta = ii.get("extmetadata") or {}
            lic = clean_text((meta.get("LicenseShortName") or {}).get("value", ""))
            if BAD.search(lic) or not OPEN.search(lic):
                continue
            w, h = ii.get("thumbwidth"), ii.get("thumbheight")
            if not w or not h or w < 150 or h < 150:
                continue
            out.append(dict(
                pageid=p.get("pageid"), title=p.get("title"),
                thumb=ii.get("thumburl"), width=w, height=h, descurl=ii.get("descriptionurl"),
                artist=clean_artist_field(clean_text((meta.get("Artist") or {}).get("value", ""))),
                # DateTimeOriginal is the plate's own date ("between 1827 and 1838"); DateTime is when the FILE
                # was uploaded to Commons (e.g. "2012-04-14") -- never used for the artwork's year (parse_year
                # only reads date_original, never falls back to this field, on purpose).
                date_original=clean_text((meta.get("DateTimeOriginal") or {}).get("value", "")),
                credit=clean_text((meta.get("Credit") or {}).get("value", "")),
                license=lic, categories=clean_text((meta.get("Categories") or {}).get("value", "")),
            ))
        if "continue" not in r or not pages:
            break
        cont = r["continue"]
    return out[:cap]


def cmd_meta(keys):
    RAW.mkdir(parents=True, exist_ok=True)
    srcs = [s for s in SOURCES if not keys or s[0] in keys]
    for key, cat, kind, cap in srcs:
        print(f"--- {key}: Category:{cat} (cap {cap})", flush=True)
        rows = walk_category(cat, cap)
        for r in rows:
            r["key"], r["kind"] = key, kind
        (RAW / f"{key}.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows))
        print(f"    {len(rows)} public-domain plates kept", flush=True)


YEAR_RX = re.compile(r"(1[5-9]\d{2})")
# Only a source whose plates could plausibly carry that exact year: a volume/credit mentioning "1845" is the
# botanical magazine's own publication year, never an upload artifact, as long as it is inside the work's real
# span -- this guards against stray 4-digit numbers (plate numbers, accession codes) reading as a year.
PLAUSIBLE = {"audubon": (1826, 1839), "curtis": (1787, 1910), "redoute-fleurs": (1825, 1835), "redoute-roses": (1815, 1826)}


def parse_year(row):
    lo, hi = PLAUSIBLE.get(row.get("key"), (1700, 1950))
    # 1. the plate's own EXIF-style date, when Commons has it (never the upload DateTime -- that field is never read here)
    m = YEAR_RX.search(row.get("date_original") or "")
    if m and lo <= int(m.group(1)) <= hi:
        return int(m.group(1))
    # 2. a year mentioned in the credit line or the category list ("The Botanical Magazine, Volume 45" pages
    # often carry a dated subcategory), filtered to the work's real span so a plate/accession number can't pass
    for text in (row.get("credit") or "", row.get("categories") or ""):
        for y in (int(x) for x in YEAR_RX.findall(text)):
            if lo <= y <= hi:
                return y
    return None


def decade(y):
    return y // 10 * 10


def cmd_select():
    rows = []
    for key, cat, kind, cap in SOURCES:
        p = RAW / f"{key}.jsonl"
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            r["y"] = parse_year(r)
            r["subject"] = subject_from_title(r["title"], r)
            r["artist"] = clean_artist_field(r.get("artist"))
            rows.append(r)
    print(f"select: {len(rows)} total candidates with a license kept", flush=True)
    # Curtis's Botanical Magazine genuinely spans more than a century, so it is capped per decade (one era can't
    # crowd out the rest). Audubon and Redouté's own works were each produced/published over a handful of years
    # (Audubon's plates are nearly all dated 1827, the engraving date, even though the set was issued 1827-1838)
    # -- a decade cap on those would just throw away real species/flower variety for no balancing benefit, so
    # each gets one flat per-source cap instead.
    FLAT_CAP = {"audubon": 220, "redoute-fleurs": 150, "redoute-roses": 50}
    cells = Counter()
    picked = []
    import hashlib
    rows.sort(key=lambda r: hashlib.md5(r["title"].encode()).hexdigest())
    for r in rows:
        if r["key"] in FLAT_CAP:
            cell, cap = r["key"], FLAT_CAP[r["key"]]
        else:
            cell, cap = (r["key"], decade(r["y"]) if r["y"] else "undated"), 90
        if cells[cell] >= cap:
            continue
        cells[cell] += 1
        picked.append(r)
    picked.sort(key=lambda r: r["title"])
    SEL.write_text(json.dumps(picked, ensure_ascii=False))
    print(f"select: {len(picked)} plates picked", flush=True)
    print("by source:", dict(Counter(r["key"] for r in picked)))
    print("by kind:", dict(Counter(r["kind"] for r in picked)))
    print("undated:", sum(1 for r in picked if not r["y"]))


def img_path(pageid):
    return RAW / "img" / f"{pageid}.jpg"


def cmd_images():
    import threading
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    (RAW / "img").mkdir(parents=True, exist_ok=True)
    sel = json.loads(SEL.read_text())
    todo = [r for r in sel if not img_path(r["pageid"]).exists()]
    print(f"{len(sel)} selected, {len(todo)} images to fetch", flush=True)
    failed, lock, done, t0 = {}, threading.Lock(), [0], time.time()

    def one(r):
        try:
            data = C.fetch("botanical", r["thumb"], binary=True)
            im = Image.open(io.BytesIO(data)).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(img_path(r["pageid"]), "JPEG", quality=92)
        except Exception as e:
            with lock:
                failed[r["pageid"]] = str(e)[:160]
        with lock:
            done[0] += 1
            if done[0] % 100 == 1:
                print(f"images {done[0]}/{len(todo)} {(time.time() - t0) / 60:.1f} min, {len(failed)} failed", flush=True)

    C.SRC["botanical"] = dict(dir=RAW, gap=0.3, workers=4)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, todo))
    print(f"images done, {len(failed)} failed", flush=True)


def cmd_palettes(workers=3):
    done = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()} if PAL.exists() else set()
    sel = json.loads(SEL.read_text())
    jobs = [(str(r["pageid"]), str(img_path(r["pageid"])), "plate") for r in sel
            if str(r["pageid"]) not in done and img_path(r["pageid"]).exists()]
    print(f"palettes: {len(done)} cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    t0 = time.time()
    with Pool(workers) as pool, PAL.open("a") as f:
        for i, (nid, res, err) in enumerate(pool.imap_unordered(D._job, jobs, chunksize=8)):
            if err:
                print(f"   {nid}: {err}", flush=True)
                continue
            res["key"] = nid
            f.write(json.dumps(res) + "\n")
            if i % 100 == 0:
                f.flush()
                print(f"palettes {i + 1}/{len(jobs)} {time.time() - t0:.0f}s", flush=True)


ARTIST_FALLBACK = {"redoute-fleurs": "Pierre-Joseph Redouté", "redoute-roses": "Pierre-Joseph Redouté",
                    "audubon": "John James Audubon"}


def cmd_build():
    sel = json.loads(SEL.read_text())
    pals = {}
    for line in PAL.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            pals[r["key"]] = r
    rows = [r for r in sel if str(r["pageid"]) in pals]
    mono = [r for r in rows if pals[str(r["pageid"])]["C"] < 0.6]
    rows = [r for r in rows if pals[str(r["pageid"])]["C"] >= 0.6]
    labs = np.array([lab for r in rows for lab in pals[str(r["pageid"])]["lab"]])
    ci, de = D.name_labs(labs)
    k, out = 0, []
    for r in rows:
        p = pals[str(r["pageid"])]
        n = len(p["lab"])
        cols = []
        for j in range(n):
            hexv = C.rgb_to_hex(C.lab_to_rgb(np.array(p["lab"][j])))
            cols.append([hexv, p["share"][j], int(ci[k + j])])
        k += n
        o = dict(id=f"{r['key']}-{r['pageid']}", src=r["key"], kind=r["kind"], t=r["subject"],
                 a=r.get("artist") or ARTIST_FALLBACK.get(r["key"]), y=r.get("y"), img=r["thumb"], w=r["width"], h=r["height"],
                 u=r.get("descurl"), credit=r.get("credit") or None, p=cols, L=p["L"], C=p["C"])
        out.append(o)
    out.sort(key=lambda o: (o["kind"], o["y"] or 0, o["id"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "plates.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"build: {len(out)} plates ({len(mono)} too-monochrome scans left out); core-name dE median "
          f"{float(np.median(de)):.1f}, 90th pct {float(np.percentile(de, 90)):.1f}", flush=True)
    print("by source:", dict(Counter(o["src"] for o in out)))
    print("by kind:", dict(Counter(o["kind"] for o in out)))
    undated = sum(1 for o in out if not o["y"])
    print(f"undated: {undated}")


def cmd_status():
    for key, cat, kind, cap in SOURCES:
        p = RAW / f"{key}.jsonl"
        n = len(p.read_text().splitlines()) if p.exists() else 0
        print(f"{key:14} meta {n:5}")
    sel = json.loads(SEL.read_text()) if SEL.exists() else []
    pal = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()} if PAL.exists() else set()
    imgs = sum(1 for r in sel if img_path(r["pageid"]).exists())
    print(f"selected {len(sel):5}  images {imgs:5}  palettes {len(pal):5}")


def main():
    args = sys.argv[1:]
    cmd, rest = (args[0] if args else "status"), args[1:]
    if cmd == "meta":
        cmd_meta(rest)
    elif cmd == "select":
        cmd_select()
    elif cmd == "images":
        cmd_images()
    elif cmd == "palettes":
        cmd_palettes()
    elif cmd == "build":
        cmd_build()
    elif cmd == "status":
        cmd_status()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
