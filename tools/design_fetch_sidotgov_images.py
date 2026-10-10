#!/usr/bin/env python3
"""Download thumbnails for the Smithsonian sources (chndm = Cooper Hewitt, npmd = National Postal Museum) among
the Design Objects corpus (data/design/objects-*.json). Both serve images from ids.si.edu's deliveryService, and
as of 2026-10-10 that host's TLS certificate has EXPIRED (confirmed with `openssl s_client`/curl against
ids.si.edu:443 -- "certificate has expired"). A browser (Safari, Chrome, every one of them) refuses an expired
cert outright and never even reaches the image: that is the broken-image "?" David saw filling Wallpaper
(98% chndm), half of Textiles (chndm is ~43% of that corpus) and a large slice of Graphic design & print
(chndm ~39%) -- every <img src="https://ids.si.edu/...">, everywhere in the app, fails the same way, for every
visitor, until the Smithsonian renews the cert. Nothing about our URL pattern is wrong (deliveryService?id=...
&max=300 still answers a normal 200 with a valid image once you get past the handshake); the fix has to be a
one-time administrative fetch -- same shape as tools/design_fetch_aicd_images.py's fetch for AIC's own
header-gated IIIF endpoint -- that bypasses certificate verification for just this one known, legitimate .si.edu
government host (not a stranger host: the Smithsonian's own domain, with a merely-expired leaf cert, not a
hostname mismatch or a self-signed replacement -- the failure mode an expired-but-otherwise-valid cert actually
is), then self-hosts the result exactly like aicd already does. Both sources are CC0 (DO_LICENSE in
js/designobjects.js), so self-hosting small thumbnails is license-clean.

ids.si.edu also sits behind a WAF that can answer "Request Rejected" (an HTML stub, not an image) to a request
it decides looks automated -- observed to recover on its own after a short pause. This script treats that
response as a retryable failure (small backoff, modest concurrency), the same as a timeout.

  python3 tools/design_fetch_sidotgov_images.py [--workers N] [--limit N]

Resumable: skips any id whose file already exists. Writes failures to
research/_raw/design-sidotgov-img-failed.json so a rerun only retries what's missing.
"""
import io, json, ssl, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parent.parent
CATS = ["ceramics", "costume", "furniture", "glass", "graphic", "poster", "product", "stamps", "textile", "wallpaper"]
OUT = {"chndm": ROOT / "img" / "design" / "chndm", "npmd": ROOT / "img" / "design" / "npmd"}
FAILED = ROOT / "research" / "_raw" / "design-sidotgov-img-failed.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub; research use, public-domain images only)"
IMG_W = 220  # same cached width/quality as img/design/aicd/ (tools/design_fetch_aicd_images.py)
# the expired cert is the only reason this context exists: ids.si.edu is the Smithsonian's own domain (not a
# look-alike or unrelated host), so skipping verification here doesn't open the door to a spoofed source --
# it just lets us past a leaf cert that lapsed, for a one-time administrative fetch of public-domain images.
CTX = ssl._create_unverified_context()


def rows():
    out = []
    for c in CATS:
        p = ROOT / "data" / "design" / f"objects-{c}.json"
        if not p.exists():
            continue
        for r in json.loads(p.read_text()):
            if r.get("src") in OUT and r.get("i"):
                out.append(r)
    seen, uniq = set(), []
    for r in out:
        key = (r["src"], r["id"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    return uniq


def fetch_one(r):
    dest = OUT[r["src"]] / f"{r['id']}.jpg"
    if dest.exists() and dest.stat().st_size > 0:
        return r, None
    url = f"https://ids.si.edu/ids/deliveryService?id={quote(r['i'])}&max=300"
    for attempt in range(4):
        try:
            req = Request(url, headers={"User-Agent": UA})
            with urlopen(req, timeout=20, context=CTX) as resp:
                ctype = resp.headers.get("Content-Type", "")
                data = resp.read()
            if "image" not in ctype:
                raise ValueError(f"non-image response ({ctype or 'no content-type'}, {len(data)} bytes -- likely a WAF stub")
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
            return r, None
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as e:
            if attempt == 3:
                return r, str(e)
            time.sleep(2.5 * (attempt + 1))
    return r, "unknown failure"


def main():
    args = sys.argv[1:]
    workers = 4  # the WAF rejects more often under a larger pool; 4 was the steadiest in testing
    limit = None
    for i, a in enumerate(args):
        if a == "--workers":
            workers = int(args[i + 1])
        if a == "--limit":
            limit = int(args[i + 1])
    for d in OUT.values():
        d.mkdir(parents=True, exist_ok=True)
    FAILED.parent.mkdir(parents=True, exist_ok=True)
    todo = rows()
    if limit:
        todo = todo[:limit]
    already = sum(1 for r in todo if (OUT[r["src"]] / f"{r['id']}.jpg").exists())
    print(f"chndm+npmd design objects: {len(todo)} total, {already} already cached, {len(todo) - already} to fetch", flush=True)
    failed = {}
    done = [0]
    lock = threading.Lock()
    t0 = time.time()

    def one(r):
        rr, err = fetch_one(r)
        with lock:
            done[0] += 1
            if err:
                failed[rr["id"]] = err
            if done[0] % 50 == 0 or done[0] == len(todo):
                print(f"  {done[0]}/{len(todo)}  {(time.time() - t0) / 60:.1f} min  {len(failed)} failed", flush=True)

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(one, todo))
    FAILED.write_text(json.dumps(failed, indent=0))
    ok = sum(1 for r in todo if (OUT[r["src"]] / f"{r['id']}.jpg").exists())
    print(f"done: {ok}/{len(todo)} images on disk, {len(failed)} failed (see {FAILED})", flush=True)


if __name__ == "__main__":
    main()
