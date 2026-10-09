#!/usr/bin/env python3
"""Download thumbnails for the Art Institute of Chicago (aicd) design objects, the one source among the
Design Objects corpus (data/design/objects-*.json) whose IIIF image endpoint needs a custom AIC-User-Agent
header on every request (tested 2026-10-09: https://www.artic.edu/iiif/2/<id>/full/400,/0/default.jpg answers
403 with no header or a generic browser UA, 200 with AIC-User-Agent set) -- a header a plain <img src> tag in
the browser can never send. So, unlike the app's other five design-object sources (chndm/npmd via ids.si.edu,
rijksd via iiif.micr.io, metd via images.metmuseum.org, cmad and commonsd whose own "i" field is already a
hotlinkable URL), aicd thumbnails are fetched once here and served from img/design/aicd/<id>.jpg, same pattern
as the existing painting gallery's img/gallery/aic/ cache.

  python3 tools/design_fetch_aicd_images.py [--workers N] [--limit N]

Resumable: skips any id whose file already exists. Polite: small thread pool, one retry, writes failures to
research/_raw/design-aicd-img-failed.json so a rerun only retries what's missing.
"""
import io, json, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parent.parent
CATS = ["ceramics", "costume", "furniture", "glass", "graphic", "poster", "product", "stamps", "textile", "wallpaper"]
OUT = ROOT / "img" / "design" / "aicd"
FAILED = ROOT / "research" / "_raw" / "design-aicd-img-failed.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub; research use, public-domain images only)"
IMG_W = 220  # same cached width as the existing painting gallery (tools/corpus.py IMG_W), kept small for the repo


def rows():
    out = []
    for c in CATS:
        p = ROOT / "data" / "design" / f"objects-{c}.json"
        if not p.exists():
            continue
        for r in json.loads(p.read_text()):
            if r.get("src") == "aicd" and r.get("i"):
                out.append(r)
    # de-dupe by id (an id can repeat if ever selected into two category files, shouldn't happen but cheap to guard)
    seen, uniq = set(), []
    for r in out:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        uniq.append(r)
    return uniq


def fetch_one(r):
    dest = OUT / f"{r['id']}.jpg"
    if dest.exists() and dest.stat().st_size > 0:
        return r["id"], None
    url = f"https://www.artic.edu/iiif/2/{r['i']}/full/400,/0/default.jpg"
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": UA, "AIC-User-Agent": UA})
            with urlopen(req, timeout=20) as resp:
                data = resp.read()
            if Image is not None:
                im = Image.open(io.BytesIO(data)).convert("RGB")
                if im.width > IMG_W:
                    im = im.resize((IMG_W, max(1, round(im.height * IMG_W / im.width))), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, "JPEG", quality=82)
                data = buf.getvalue()
            tmp = dest.with_suffix(".jpg.part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return r["id"], None
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            if attempt == 2:
                return r["id"], str(e)
            time.sleep(1.5 * (attempt + 1))
    return r["id"], "unknown failure"


def main():
    args = sys.argv[1:]
    workers = 6
    limit = None
    for i, a in enumerate(args):
        if a == "--workers":
            workers = int(args[i + 1])
        if a == "--limit":
            limit = int(args[i + 1])
    OUT.mkdir(parents=True, exist_ok=True)
    FAILED.parent.mkdir(parents=True, exist_ok=True)
    todo = rows()
    if limit:
        todo = todo[:limit]
    already = sum(1 for r in todo if (OUT / f"{r['id']}.jpg").exists())
    print(f"aicd design objects: {len(todo)} total, {already} already cached, {len(todo) - already} to fetch", flush=True)
    failed = {}
    done = [0]
    lock = threading.Lock()
    t0 = time.time()

    def one(r):
        rid, err = fetch_one(r)
        with lock:
            done[0] += 1
            if err:
                failed[rid] = err
            if done[0] % 100 == 0 or done[0] == len(todo):
                print(f"  {done[0]}/{len(todo)}  {(time.time() - t0) / 60:.1f} min  {len(failed)} failed", flush=True)

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(one, todo))
    FAILED.write_text(json.dumps(failed, indent=0))
    ok = sum(1 for r in todo if (OUT / f"{r['id']}.jpg").exists())
    print(f"done: {ok}/{len(todo)} images on disk, {len(failed)} failed (see {FAILED})", flush=True)


if __name__ == "__main__":
    main()
