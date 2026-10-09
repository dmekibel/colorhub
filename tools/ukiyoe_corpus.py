#!/usr/bin/env python3
"""ColorHub ukiyo-e corpus: Japanese woodblock prints, public-domain/CC0 only, from the Art Institute of Chicago
(aicu) and the Cleveland Museum of Art (cmau) -- both keyless APIs, no account created. Built exactly like the
design-objects corpus (tools/design_corpus.py, which this imports for its network/image/k-means/color math),
re-runnable and resumable; everything caches in research/_raw/ (gitignored).

  python3 tools/ukiyoe_corpus.py meta [src ...] [--resume]   # 1. object metadata -> research/_raw/<src>/meta.json
  python3 tools/ukiyoe_corpus.py select                      # 2. balanced pick across decade x artist -> research/_raw/ukiyoe-selected.json
  python3 tools/ukiyoe_corpus.py images [src ...]             # 3. one cached image per selected print
  python3 tools/ukiyoe_corpus.py palettes                    # 4. 6-color k-means palette per cached image
  python3 tools/ukiyoe_corpus.py build                       # 5. name the colors, write data/ukiyoe/prints.json
  python3 tools/ukiyoe_corpus.py status

Sources: aicu (Art Institute of Chicago, CC0 metadata/public-domain images, keyless) and cmau (Cleveland Museum of
Art, CC0, keyless) -- see tools/museums/aicu.py and tools/museums/cmau.py for the exact query each one runs and the
live counts found 2026-10-09 (6,305 and 606 public-domain prints with images respectively). The Metropolitan Museum
of Art and Wikimedia Commons were not added in this pass (time-boxed); the Rijksmuseum was skipped because its API
needs a registered key, which this session does not create (CLAUDE.md's "no account creation" rule). Re-running
`meta` for either source is additive and safe.

Selection (select()): prints dated 1700-1900 (ukiyo-e's working span; a handful of later shin-hanga/revival prints
that slipped past the classification filter are dropped), at most CELL_CAP per decade, at most SRC_CELL_CAP from one
source in a decade, and at most ARTIST_CAP per artist per decade, in a seeded shuffle -- so Hokusai's "Great Wave"
decade cannot crowd out everyone else working then.

Palette (step 4): tools/corpus.py's palette_of() -- the same auto-trim, 2% inset, CIELAB k-means k=6 method as
the painting and design corpora. No backdrop/object-mask step: these are flat print reproductions, not photographed
3-D objects, so there is no studio backdrop to subtract.

Honest limits: these are scans/photographs of prints that are often 150-250 years old -- aged paper, faded
pigments (beni red fades fastest, followed by some yellows), and a photography/scanning pass, all before the color
reaches a screen. Every page says so once. Needs Python 3 with Pillow and numpy only.
"""
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
import design_corpus as D  # noqa: E402 -- reuses cmd_images/cmd_palettes verbatim via thin wrappers below
from museums import aicu, cmau  # noqa: E402

RAW = C.RAW
OUT = ROOT / "data" / "ukiyoe"
SEL = RAW / "ukiyoe-selected.json"
PAL = RAW / "ukiyoe-palettes.jsonl"
ADAPTERS = dict(aicu=aicu, cmau=cmau)
for _s, _m in ADAPTERS.items():
    C.ADAPTERS[_s] = _m
    C.SRC[_s] = dict(dir=RAW / _s, **_m.INFO)

YEAR_MIN, YEAR_MAX = 1700, 1900
CELL_CAP, SRC_CELL_CAP, ARTIST_CAP = 140, 110, 10


def decade(y):
    return y // 10 * 10


def norm_rows(src):
    p = C.SRC[src]["dir"] / "meta.json"
    if not p.exists():
        return []
    out = []
    for x in json.loads(p.read_text())["rows"]:
        try:
            r = ADAPTERS[src].norm(C, x)
        except Exception as e:
            print(f"   {src}: skipped a record ({e})")
            continue
        if r.get("y") is None or not (YEAR_MIN <= r["y"] <= YEAR_MAX) or not r.get("img"):
            continue
        r["id"] = re.sub(r"[^\w.\-]+", "_", r["id"])
        r["urls"] = ADAPTERS[src].image_urls(x)
        out.append(r)
    return out


def cmd_meta(srcs, resume):
    for s in srcs:
        print(f"--- {s}: {ADAPTERS[s].INFO['name']}", flush=True)
        ADAPTERS[s].meta(C, resume)


def cmd_select():
    import hashlib
    h = lambda r: hashlib.md5(r["id"].encode()).hexdigest()
    per = {}
    for s in ADAPTERS:
        rows = sorted(norm_rows(s), key=h)
        print(f"select: {s}: {len(rows)} dated prints {YEAR_MIN}-{YEAR_MAX}", flush=True)
        cells, artists, keep = Counter(), Counter(), []
        for r in rows:
            cell = decade(r["y"])
            ak = (r["a"] or "").lower()
            if cells[cell] >= SRC_CELL_CAP or (r["a"] and artists[(cell, ak)] >= ARTIST_CAP):
                continue
            cells[cell] += 1
            if r["a"]:
                artists[(cell, ak)] += 1
            keep.append(r)
        per[s] = keep
    by_cell = defaultdict(lambda: defaultdict(list))
    for s, rows in per.items():
        for r in rows:
            by_cell[decade(r["y"])][s].append(r)
    picked = []
    for cell, d in by_cell.items():
        total = sum(len(v) for v in d.values())
        while total > CELL_CAP:
            big = max(d, key=lambda s: len(d[s]))
            d[big].pop()
            total -= 1
        for v in d.values():
            picked += v
    picked.sort(key=lambda r: r["id"])
    SEL.write_text(json.dumps(picked, ensure_ascii=False))
    print(f"select: {len(picked)} prints picked", flush=True)
    decs = list(range(YEAR_MIN, YEAR_MAX, 10))
    print("decade " + " ".join(f"{d % 1000:>4}" for d in decs) + "  total")
    cnt = Counter(decade(r["y"]) for r in picked)
    print("prints " + " ".join(f"{cnt[d]:>4}" for d in decs) + f"  {sum(cnt[d] for d in decs)}")
    print("by source:", dict(Counter(r["src"] for r in picked)))


def img_path(src, nid):
    return C.SRC[src]["dir"] / "img" / f"{nid}.jpg"


def cmd_images(srcs):
    import io
    import threading
    import time
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    sel = json.loads(SEL.read_text())
    srcs = srcs or list(ADAPTERS)
    for s in srcs:
        rows = [r for r in sel if r["src"] == s]
        (C.SRC[s]["dir"] / "img").mkdir(parents=True, exist_ok=True)
        todo = [r for r in rows if not img_path(s, r["id"]).exists()]
        print(f"{s}: {len(rows)} selected, {len(todo)} images to fetch", flush=True)
        failed, lock, done, t0 = {}, threading.Lock(), [0], time.time()

        def one(r):
            err = "no url"
            for url in r["urls"]:
                try:
                    im = Image.open(io.BytesIO(C.fetch(s, url, binary=True, headers={"AIC-User-Agent": C.UA} if s == "aicu" else None))).convert("RGB")
                    if im.width > C.IMG_W:
                        im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
                    im.save(img_path(s, r["id"]), "JPEG", quality=92)
                    err = None
                    break
                except Exception as e:
                    err = e
            with lock:
                done[0] += 1
                if err:
                    failed[r["id"]] = str(err)[:160]
                if done[0] % 100 == 1:
                    print(f"{s} images {done[0]}/{len(todo)} {(time.time() - t0) / 60:.1f} min, {len(failed)} failed", flush=True)

        with ThreadPoolExecutor(C.SRC[s].get("workers", 1)) as ex:
            list(ex.map(one, todo))
        print(f"{s}: images done, {len(failed)} failed", flush=True)


def cmd_palettes(workers=3):
    done = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()} if PAL.exists() else set()
    sel = json.loads(SEL.read_text())
    jobs = [(r["id"], str(img_path(r["src"], r["id"])), r["cat"]) for r in sel
            if r["id"] not in done and img_path(r["src"], r["id"]).exists()]
    print(f"palettes: {len(done)} cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    import time
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


def cmd_build():
    sel = json.loads(SEL.read_text())
    pals = {}
    for line in PAL.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            pals[r["key"]] = r
    rows = [r for r in sel if r["id"] in pals]
    mono = [r for r in rows if pals[r["id"]]["C"] < 0.6]
    rows = [r for r in rows if pals[r["id"]]["C"] >= 0.6]
    labs = np.array([lab for r in rows for lab in pals[r["id"]]["lab"]])
    ci, de = D.name_labs(labs)
    k, out = 0, []
    for r in rows:
        p = pals[r["id"]]
        n = len(p["lab"])
        cols = []
        for j in range(n):
            hexv = C.rgb_to_hex(C.lab_to_rgb(np.array(p["lab"][j])))
            cols.append([hexv, p["share"][j], int(ci[k + j])])
        k += n
        o = dict(id=r["id"], src=r["src"], t=r["t"], a=r["a"], y=r["y"], series=r.get("series"),
                 i=D.compact(r["src"], "img", AICU_URL_TPL, r["img"]) if r["src"] == "aicu" else r["img"],
                 u=r.get("url"), p=cols, L=p["L"], C=p["C"])
        out.append(o)
    out.sort(key=lambda o: (o["y"], o["id"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "prints.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"build: {len(out)} prints ({len(mono)} too-monochrome scans left out); core-name dE median "
          f"{float(np.median(de)):.1f}, 90th pct {float(np.percentile(de, 90)):.1f}", flush=True)
    cnt = Counter(decade(o["y"]) for o in out)
    decs = list(range(YEAR_MIN, YEAR_MAX, 10))
    print("decade " + " ".join(f"{d % 1000:>4}" for d in decs))
    print("prints " + " ".join(f"{cnt[d]:>4}" for d in decs))
    print("by source:", dict(Counter(o["src"] for o in out)))
    artists = Counter(o["a"] for o in out if o["a"])
    print(f"{len(artists)} named artists; top 10: {artists.most_common(10)}")


AICU_URL_TPL = {"aicu": ("https://www.artic.edu/iiif/2/{}/full/400,/0/default.jpg", r"/iiif/2/([^/]+)/full/")}


def cmd_status():
    sel = json.loads(SEL.read_text()) if SEL.exists() else []
    pal = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()} if PAL.exists() else set()
    for s in ADAPTERS:
        mp = C.SRC[s]["dir"] / "meta.json"
        n_meta = len(json.loads(mp.read_text())["rows"]) if mp.exists() else 0
        rows = [r for r in sel if r["src"] == s]
        imgs = sum(1 for r in rows if img_path(s, r["id"]).exists())
        print(f"{s:6} meta {n_meta:6}  selected {len(rows):6}  images {imgs:6}  palettes {sum(1 for r in rows if r['id'] in pal):6}")


def main():
    args = sys.argv[1:]
    resume = "--resume" in args
    args = [a for a in args if a != "--resume"]
    cmd, rest = (args[0] if args else "status"), args[1:]
    srcs = [a for a in rest if a in ADAPTERS]
    if cmd == "meta":
        cmd_meta(srcs or list(ADAPTERS), resume)
    elif cmd == "select":
        cmd_select()
    elif cmd == "images":
        cmd_images(srcs)
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
