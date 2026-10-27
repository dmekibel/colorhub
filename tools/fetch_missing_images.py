#!/usr/bin/env python3
"""Download the picture of every gallery painting that has no cached image (2026-10-27: 34,214 rows, 16% of the archive; mostly cf, bsb,
yuag, npg, wales, smb and 11% of commons). Without a cached photo a row gets no CLIP embedding, so it is skipped by the duplicate check
(tools/hide_duplicates.py), the "By look" map, the vibe neighbors and the movement guesses.

  python3 tools/fetch_missing_images.py [--limit N] [--workers 4]

Takes each row's own `img` URL from data/corpus, caches 200 px JPEGs at research/_raw/measure-img/<id>.jpg (the place subjects_clip.py,
hide_nonart.py and color_index.py already read), resumable (cached files are skipped), polite per host: Wikimedia hosts about 1.7 requests per
second in their own lane, every other host 4 per second per host in another. Failures are listed in research/_raw/fetch-missing-failed.json. Nothing under data/ is written.
"""
import argparse, glob, json, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import measure_staged as M  # noqa: E402  (its fetch(), cache_path(), HOST_GAP/LOCK)
import io
from PIL import Image
import corpus as C  # noqa: E402

WM = ("wikimedia.org", "wikipedia.org")


def fetch(url, tries=5):
    host = urllib.parse.urlparse(url).netloc
    gap = 0.6 if host.endswith(WM) else 0.25
    for n in range(tries):
        with M.LOCK:
            wait = M.HOST_GAP.get(host, 0) + gap - time.time()
            M.HOST_GAP[host] = max(time.time(), M.HOST_GAP.get(host, 0) + gap)
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": M.UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(15 * (n + 1))
                continue
            if e.code in (404, 403, 410):
                raise
        except Exception:
            time.sleep(3 * (n + 1))
    raise RuntimeError("fetch failed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    have = {i for i in (ROOT / "research/_raw/subjects/clip-embeds.ids.txt").read_text().split("\n") if i}
    ids = [i for i in (ROOT / "data/gallery/ids.txt").read_text().split("\n") if i]
    want = {i for i in ids if i not in have}
    rows = {}
    for f in glob.glob(str(ROOT / "data/corpus/*.json")):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        for r in (d if isinstance(d, list) else next((v for v in d.values() if isinstance(v, list)), [])):
            if isinstance(r, dict) and r.get("id") in want and r.get("img"):
                rows[r["id"]] = r["img"]
    todo = [(i, u) for i, u in rows.items() if not M.cache_path(i).exists() or M.cache_path(i).stat().st_size < 500]
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(want)} gallery rows without an embedding, {len(rows)} with an image URL, {len(todo)} to fetch", flush=True)
    bad, done = {}, [0]

    def one(item):
        i, u = item
        try:
            im = Image.open(io.BytesIO(fetch(u))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(M.cache_path(i), "JPEG", quality=92)
        except Exception as e:
            bad[i] = str(e)[:100]
        done[0] += 1
        if done[0] % 1000 == 0:
            print(f"  {done[0]}/{len(todo)}  failed {len(bad)}", flush=True)
            (ROOT / "research/_raw/fetch-missing-failed.json").write_text(json.dumps(bad))
    # two lanes so the slow Wikimedia pace never holds up the other hosts: one worker for Wikimedia, a.workers for everything else
    wm = [x for x in todo if urllib.parse.urlparse(x[1]).netloc.endswith(WM)]
    other = [x for x in todo if x not in set(wm)]
    print(f"  lanes: {len(wm)} Wikimedia (1 worker, one request per {0.6}s), {len(other)} other ({a.workers} workers)", flush=True)
    with ThreadPoolExecutor(1) as e1, ThreadPoolExecutor(a.workers) as e2:
        f1 = [e1.submit(one, x) for x in wm]
        f2 = [e2.submit(one, x) for x in other]
        for f in f1 + f2:
            f.result()
    (ROOT / "research/_raw/fetch-missing-failed.json").write_text(json.dumps(bad))
    print(f"done: {len(todo) - len(bad)} fetched, {len(bad)} failed", flush=True)


if __name__ == "__main__":
    main()
