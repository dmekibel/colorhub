#!/usr/bin/env python3
"""Measure the palette of staged corpus rows that have an image URL but no palette (2026-10-22).

  python3 tools/measure_staged.py [--limit N] [--workers 6] [--files 'data/corpus/zz-*.json']

Why: the staging helpers wrote metadata only (id, t, a, y, co, img, url ...). tools/gallery.py skips any row without `p`
(six colors), so those rows never reached the app. This fetches the row's own image (400 px thumbs, cached in
research/_raw/measure-img/), measures it with corpus.palette_of() (the same vivid method as every other row), names the
six colors the way tools/artist_extra.py does, and writes p / L / C back into the same shard. Resumable: rows that already
have p are skipped, images already cached are not fetched again, and each shard is rewritten every 400 rows.
Rows whose image fails (or is a near-black/white scan, C < BW_C) are left without p, so the gallery skips them.
"""
import argparse, glob, io, json, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
CACHE = ROOT / "research" / "_raw" / "measure-img"
CACHE.mkdir(parents=True, exist_ok=True)
HOST_GAP = {}          # host -> last request time, so one host never gets more than ~5 requests a second
LOCK = threading.Lock()


def cache_path(rid):
    return CACHE / (rid.replace("/", "_") + ".jpg")


def fetch(url, tries=4):
    host = urllib.parse.urlparse(url).netloc
    for n in range(tries):
        with LOCK:
            wait = HOST_GAP.get(host, 0) + 0.2 - time.time()
            HOST_GAP[host] = max(time.time(), HOST_GAP.get(host, 0) + 0.2)
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(5 * (n + 1))
                continue
            if e.code in (404, 403, 410):
                raise
        except Exception:
            time.sleep(2 * (n + 1))
    raise RuntimeError("fetch failed " + url)


def get_image(row):
    p = cache_path(row["id"])
    if p.exists() and p.stat().st_size > 500:
        return p
    im = Image.open(io.BytesIO(fetch(row["img"]))).convert("RGB")
    if im.width > C.IMG_W:
        im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
    im.save(p, "JPEG", quality=92)
    return p


def measure(row, app, app_lab):
    pal = C.palette_of(str(get_image(row)))
    if pal["C"] < C.BW_C:
        return None
    rgbs = C.lab_to_rgb(np.array(pal["lab"]))
    exact = C.rgb_to_lab(rgbs)
    V = C.de2000(exact, app_lab).argmin(1)
    Ls, Cs, Hs = C.lch(exact)
    shares = [round(s, 3) for s in pal["share"]]
    shares[0] = round(shares[0] + 1 - sum(shares), 3)
    p = [[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))]
    return p, round(pal["L"], 1), round(pal["C"], 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--files", default=str(ROOT / "data" / "corpus" / "zz-*.json"))
    a = ap.parse_args()
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    shards = {}
    todo = []
    for f in sorted(glob.glob(a.files)):
        rows = json.load(open(f))
        if not isinstance(rows, list):
            continue
        shards[f] = rows
        todo += [(f, r) for r in rows if r.get("img") and len(r.get("p") or []) != 6 and not r.get("_unmeasurable")]
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(todo)} rows to measure in {len(shards)} shards", flush=True)
    done = bad = 0
    dirty = set()

    def one(item):
        f, r = item
        try:
            res = measure(r, app, app_lab)
        except Exception as e:
            return f, r, None, str(e)[:80]
        return f, r, res, None

    def flush():
        for f in list(dirty):
            tmp = f + ".tmp"
            json.dump(shards[f], open(tmp, "w"), ensure_ascii=False, separators=(",", ":"))
            Path(tmp).replace(f)
        dirty.clear()

    with ThreadPoolExecutor(a.workers) as ex:
        for f, r, res, err in ex.map(one, todo):
            if res:
                r["p"], r["L"], r["C"] = res
                dirty.add(f)
                done += 1
            else:
                r["_unmeasurable"] = err or "too grey"
                dirty.add(f)
                bad += 1
            if (done + bad) % 400 == 0:
                flush()
                print(f"  {done} measured, {bad} failed / grey", flush=True)
    flush()
    print(f"done: {done} measured, {bad} failed / grey", flush=True)


if __name__ == "__main__":
    main()
