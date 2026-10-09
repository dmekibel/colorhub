#!/usr/bin/env python3
"""Build the painting map's tiered sprite atlas: data/paintmap/atlas0.webp (tier 0, every painting, tiny) and
data/paintmap/g<N>.webp (tier 1, one sheet per contiguous range of ~GROUP_SIZE paintings, mid-size).

David (2026-10-09): "Come up with a clever system for the painting map to load all the pictures in one go. Maybe a
tiny version of every picture, and when you zoom in, it loads the bigger one." Today js/paintmap.js streams a
per-painting request for every tile that scrolls into view -- a waterfall of thousands of requests. This script
builds the two sheet tiers that let the map draw something real at EVERY zoom level from a handful of requests:

  Tier 0  one (or a couple) sprite sheet(s) holding a TIER0_TILE x TIER0_TILE center-cropped square for all
          ~23,778 paintings, in gallery-index order, packed left-to-right/top-to-bottom into a fixed grid
          (cols0 columns). Position is ALGORITHMIC (sheet = i // perSheet, cell = i % perSheet, x = cell % cols0,
          y = cell // cols0) -- no id->position index file needed, js/paintmap.js computes the same arithmetic.
  Tier 1  one sheet per GROUP_SIZE-painting range (g = i // GROUP_SIZE), each a TIER1_TILE x TIER1_TILE grid
          (cols1 columns, algorithmic position within the group the same way). Fetched on demand, one request
          per sheet, cached forever once loaded -- there are only ~16 of these total, so even panning around
          enough to touch most of the dataset costs at most ~16 requests, not one per cell.

Both tiers are built in ONE pass over data/gallery/thumbs.txt (tools/paintmap_thumbs.py's own output: one line per
painting, in gallery order, with the same image address + frame crop js/paintmap.js's pmThumb() already decodes),
fetching each painting's picture exactly once and deriving both tile sizes from the same decoded image -- half the
network traffic of building the tiers separately. A local painting (img/gallery/...) is read straight off disk;
everything else is fetched politely (bounded concurrency, a cap per host, retries, a descriptive User-Agent) from
the same hosts pmThumb() already points the live app at (Commons, Micrio/SMK, NGA, Cleveland, the Met).

Resumable at GROUP granularity: progress is checkpointed to data/paintmap/.progress.json after every completed
group (tier 1 sheet written to disk + tier 0 canvas re-saved). A crash or Ctrl-C loses at most one group's worth
of fetches (<= GROUP_SIZE), never more, and never corrupts a previously-finished sheet (sheets are written with
a temp-name-then-rename). No per-painting cache file is kept on disk (the Mac this runs on is nearly out of
space) -- everything between "fetch" and "paste into the sheet" lives in memory only.

Usage:
  python3 tools/paintmap_atlas.py build [--workers 20] [--limit N] [--start-group G] [--quality0 Q] [--quality1 Q]
  python3 tools/paintmap_atlas.py report                   # sizes + manifest, no network
  python3 tools/paintmap_atlas.py clean                    # remove .progress.json (start over)
"""
import json, os, random, sys, time, threading
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from math import ceil, sqrt

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GAL = os.path.join(ROOT, "data", "gallery")
OUT = os.path.join(ROOT, "data", "paintmap")
THUMBS = os.path.join(GAL, "thumbs.txt")
PROGRESS = os.path.join(OUT, ".progress.json")

TIER0_TILE = 20
TIER1_TILE = 80
GROUP_SIZE = 1500
Q0, Q1 = 78, 76
WORKERS = 20
PER_HOST = 6
TIMEOUT = 15
RETRIES = 2
UA = ("ColorHubPaintingMapAtlasBot/1.0 (+https://dmekibel.github.io/colorhub; "
      "building tiny/mid sprite-sheet thumbnails for a non-commercial color-learning app; contact dmekibel@gmail.com)")
# David 2026-10-09's first full run got HTTP 429 ("Your bot is making too many requests") from Commons partway
# through -- PER_HOST's concurrency cap alone doesn't bound the sustained REQUEST RATE when each request is fast,
# so this adds a minimum gap between request STARTS per host (a simple pacing clock, not just a concurrency cap).
# Commons gets a conservative floor; every other host (Micrio, NGA, Cleveland, the Met) never hit a 429 in that
# run, so they keep moving at the semaphore's pace, just with a touch of spacing.
MIN_INTERVAL = {"commons.wikimedia.org": 0.5}
MIN_INTERVAL_DEFAULT = 0.05

# ---- same decode table as tools/paintmap_thumbs.py's code()/js/paintmap.js's pmThumb() -----------------------
def thumb_url(code_addr):
    k, a = code_addr[0], code_addr[1:]
    if k == "L":
        return ("local", os.path.join(ROOT, "img", "gallery", a))
    if k == "C":
        return ("http", f"https://commons.wikimedia.org/wiki/Special:FilePath/{a}?width=400")
    if k == "M":
        return ("http", f"https://iiif.micr.io/{a}/full/400,/0/default.jpg")
    if k == "N":
        return ("http", f"https://api.nga.gov/iiif/{a}/full/400,/0/default.jpg")
    if k == "V":
        return ("http", f"https://openaccess-cdn.clevelandart.org/{a}")
    if k == "E":
        return ("http", f"https://images.metmuseum.org/CRDImages/{a}")
    return ("http", a)  # "U" -- already a full URL


def host_of(url):
    try:
        return url.split("//", 1)[1].split("/", 1)[0]
    except Exception:
        return "?"


_sema = {}
_sema_lock = threading.Lock()
def host_semaphore(host):
    with _sema_lock:
        s = _sema.get(host)
        if s is None:
            s = threading.Semaphore(PER_HOST)
            _sema[host] = s
        return s


# a strict pacing clock per host: whichever worker arrives next sleeps until at least MIN_INTERVAL[host] has
# passed since the LAST request to that host started, so the sustained rate stays bounded even with PER_HOST
# workers all racing for the semaphore at once (the semaphore alone only bounds how many are in flight, not how
# fast new ones start when each one finishes quickly -- which is exactly what tripped Commons' 429 the first run)
_pace = {}
_pace_lock = threading.Lock()
def pace(host):
    interval = MIN_INTERVAL.get(host, MIN_INTERVAL_DEFAULT)
    with _pace_lock:
        now = time.time()
        due = max(now, _pace.get(host, 0) + interval)
        _pace[host] = due
        wait = due - now
    if wait > 0:
        time.sleep(wait)


def fetch_bytes(kind, loc, retries=RETRIES):
    if kind == "local":
        with open(loc, "rb") as f:
            return f.read()
    host = host_of(loc)
    sem = host_semaphore(host)
    last_err = None
    for attempt in range(retries + 1):
        pace(host)
        backoff = None   # set below on a 429; slept AFTER releasing the semaphore, never while holding it
        with sem:
            try:
                req = urllib.request.Request(loc, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code == 429:
                    # a real block, not a blip -- back off hard, and respect Retry-After if the host sent one,
                    # rather than hammering it again at the same pace that just got us rate-limited. The backoff
                    # itself happens below, outside `with sem`, so it doesn't also block every OTHER worker
                    # waiting on this host's semaphore slot for no reason.
                    retry_after = e.headers.get("Retry-After") if e.headers else None
                    try:
                        backoff = float(retry_after) if retry_after else 8.0 * (attempt + 1)
                    except ValueError:
                        backoff = 8.0 * (attempt + 1)
            except Exception as e:
                last_err = e
        if attempt < retries:
            time.sleep(backoff if backoff is not None else 1.5 * (attempt + 1))
    raise last_err


def square_crop_resize(raw, crop, tile):
    im = Image.open(BytesIO(raw))
    im = im.convert("RGB")
    nw, nh = im.size
    sx, sy, sw, sh = 0, 0, nw, nh
    if crop and crop[2] - crop[0] > 50 and crop[3] - crop[1] > 50:
        l, t, r, b = crop
        sx, sy = l / 1000 * nw, t / 1000 * nh
        sw, sh = (r - l) / 1000 * nw, (b - t) / 1000 * nh
    m = min(sw, sh)
    box = (round(sx + (sw - m) / 2), round(sy + (sh - m) / 2))
    box = (box[0], box[1], round(box[0] + m), round(box[1] + m))
    im = im.crop(box).resize((tile, tile), Image.LANCZOS)
    return im


def parse_line(line):
    tab = line.find("\t")
    code_addr = line if tab < 0 else line[:tab]
    crop_s = "" if tab < 0 else line[tab + 1:]
    crop = [int(x) for x in crop_s.split(",")] if crop_s else None
    return code_addr, crop


def process_one(i, line, retries=RETRIES):
    code_addr, crop = parse_line(line)
    try:
        kind, loc = thumb_url(code_addr)
        raw = fetch_bytes(kind, loc, retries=retries)
        t0 = square_crop_resize(raw, crop, TIER0_TILE)
        t1 = square_crop_resize(raw, crop, TIER1_TILE)
        return i, t0, t1, None
    except Exception as e:
        return i, None, None, str(e)


def load_lines():
    with open(THUMBS) as f:
        return [l.rstrip("\n") for l in f if l.strip() != "" or True]


def grid0(n):
    cols = max(1, ceil(sqrt(n)))
    rows = ceil(n / cols)
    return cols, rows


def grid1(group_n):
    cols = max(1, ceil(sqrt(group_n)))
    rows = ceil(group_n / cols)
    return cols, rows


def load_progress():
    if os.path.exists(PROGRESS):
        try:
            return json.load(open(PROGRESS))
        except Exception:
            pass
    return {"groups_done": [], "fail_count": 0, "ok_count": 0}


def save_progress(p):
    tmp = PROGRESS + ".tmp"
    json.dump(p, open(tmp, "w"))
    os.replace(tmp, PROGRESS)


def atomic_save_webp(im, path, quality):
    tmp = path + ".tmp"
    im.save(tmp, "WEBP", quality=quality, method=6)
    os.replace(tmp, path)


def find_blank_tier0_cells(tier0, man):
    """Indices whose tier-0 cell is still fully transparent -- a fetch that failed during the main build (left
    blank rather than aborting the whole run). A cheap per-cell alpha-channel check, not a second network pass."""
    cols = man["tier0"]["cols"]
    tile = man["tier0"]["tile"]
    blanks = []
    for i in range(man["n"]):
        x0, y0 = (i % cols) * tile, (i // cols) * tile
        cell = tier0.crop((x0, y0, x0 + tile, y0 + tile))
        if cell.getextrema()[3][1] == 0:   # alpha channel's max is 0 -> nothing was ever pasted here
            blanks.append(i)
    return blanks


def cmd_repair(workers, retries, limit):
    """Re-fetch whichever paintings are still blank after `build` (data/paintmap/atlas0.webp's own transparent
    cells are the source of truth, not the truncated fetch-failures.txt), with a MUCH more conservative pace and
    more retries -- the fix for a host that 429'd partway through the main run (Commons, 2026-10-09: PER_HOST's
    concurrency cap didn't bound the sustained rate, so MIN_INTERVAL now does). Patches both atlas0.webp and
    every affected g<N>.webp sheet in place; never touches a cell that already has a real picture."""
    lines = load_lines()
    man = json.load(open(os.path.join(OUT, "manifest.json")))
    n = man["n"]
    atlas0_path = os.path.join(OUT, "atlas0.webp")
    tier0 = Image.open(atlas0_path).convert("RGBA")
    blanks = find_blank_tier0_cells(tier0, man)
    if limit:
        blanks = blanks[:limit]
    print(f"{len(blanks)} blank cells to repair (of {n})")
    if not blanks:
        return

    by_group = {}
    for i in blanks:
        by_group.setdefault(pmT1GroupPy(man, i), []).append(i)

    cols0 = man["tier0"]["cols"]
    fixed, still_failed = 0, []
    t0 = time.time()
    # process group by group (bounds memory to one tier-1 canvas at a time, same as the main build; also means a
    # Ctrl-C only loses the group currently in progress, same resumability contract as `build`)
    for g in sorted(by_group):
        idxs = by_group[g]
        gpath = os.path.join(OUT, f"g{g}.webp")
        group_canvas = Image.open(gpath).convert("RGBA")
        lo = g * man["tier1"]["groupSize"]
        hi = min(n, lo + man["tier1"]["groupSize"])
        cols1, _ = grid1(hi - lo)
        results = {}
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for i, t0img, t1img, err in ex.map(lambda i: process_one(i, lines[i], retries), idxs):
                results[i] = (t0img, t1img, err)
        for i in idxs:
            t0img, t1img, err = results[i]
            if err:
                still_failed.append((i, err))
                continue
            fixed += 1
            x0, y0 = (i % cols0) * TIER0_TILE, (i // cols0) * TIER0_TILE
            tier0.paste(t0img, (x0, y0))
            local = i - lo
            x1, y1 = (local % cols1) * TIER1_TILE, (local // cols1) * TIER1_TILE
            group_canvas.paste(t1img, (x1, y1))
        atomic_save_webp(group_canvas, gpath, Q1)
        atomic_save_webp(tier0, atlas0_path, Q0)   # re-saved after every group so a Ctrl-C loses at most one group
        print(f"repaired group {g}: {len(idxs)} cells, {dt_str(time.time() - t0)} elapsed so far, "
              f"{fixed} fixed / {len(still_failed)} still failing")

    progress = load_progress()
    progress["fail_count"] = max(0, progress.get("fail_count", 0) - fixed)
    progress["ok_count"] = progress.get("ok_count", 0) + fixed
    save_progress(progress)
    print(f"repair done: {fixed} fixed, {len(still_failed)} still failing, in {dt_str(time.time() - t0)}")
    if still_failed:
        with open(os.path.join(OUT, "fetch-failures.txt"), "w") as f:
            for i, err in still_failed:
                f.write(f"{i}\t{err}\n")
        print(f"wrote {len(still_failed)} remaining failures to data/paintmap/fetch-failures.txt")
    elif os.path.exists(os.path.join(OUT, "fetch-failures.txt")):
        os.remove(os.path.join(OUT, "fetch-failures.txt"))
    report()


def pmT1GroupPy(man, i):
    return i // man["tier1"]["groupSize"]


def dt_str(s):
    return f"{s:.1f}s" if s < 90 else f"{s/60:.1f}m"


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "build"
    workers, limit, start_group, q0, q1, retries = WORKERS, None, 0, Q0, Q1, RETRIES
    k = 1
    while k < len(args):
        if args[k] == "--workers": workers = int(args[k + 1]); k += 2
        elif args[k] == "--limit": limit = int(args[k + 1]); k += 2
        elif args[k] == "--start-group": start_group = int(args[k + 1]); k += 2
        elif args[k] == "--quality0": q0 = int(args[k + 1]); k += 2
        elif args[k] == "--quality1": q1 = int(args[k + 1]); k += 2
        elif args[k] == "--retries": retries = int(args[k + 1]); k += 2
        else: k += 1

    os.makedirs(OUT, exist_ok=True)

    if cmd == "clean":
        if os.path.exists(PROGRESS):
            os.remove(PROGRESS)
        print("removed", PROGRESS)
        return

    if cmd == "report":
        report()
        return

    if cmd == "repair":
        cmd_repair(workers=min(workers, 8), retries=max(retries, 5), limit=limit)
        return

    lines = load_lines()
    n = len(lines)
    if limit:
        n = min(n, limit)
    cols0, rows0 = grid0(n)
    num_groups = ceil(n / GROUP_SIZE)
    print(f"n={n} tier0 grid={cols0}x{rows0} ({cols0*TIER0_TILE}x{rows0*TIER0_TILE}px) groups={num_groups} "
          f"tier1 tile={TIER1_TILE}px group_size={GROUP_SIZE}")

    progress = load_progress()
    groups_done = set(progress.get("groups_done", []))
    ok_count, fail_count = progress.get("ok_count", 0), progress.get("fail_count", 0)
    failures = []

    atlas0_path = os.path.join(OUT, "atlas0.webp")
    tier0 = Image.new("RGBA", (cols0 * TIER0_TILE, rows0 * TIER0_TILE), (0, 0, 0, 0))
    if os.path.exists(atlas0_path) and groups_done:
        try:
            prev = Image.open(atlas0_path).convert("RGBA")
            if prev.size == tier0.size:
                tier0 = prev
        except Exception:
            pass

    t_start = time.time()
    total_requests = 0

    for g in range(max(start_group, 0), num_groups):
        lo, hi = g * GROUP_SIZE, min(n, (g + 1) * GROUP_SIZE)
        if g in groups_done:
            continue
        cols1, rows1 = grid1(hi - lo)
        group_canvas = Image.new("RGBA", (cols1 * TIER1_TILE, rows1 * TIER1_TILE), (0, 0, 0, 0))
        t_g0 = time.time()
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for i, t0img, t1img, err in ex.map(lambda i: process_one(i, lines[i]), range(lo, hi)):
                total_requests += 1
                if err:
                    fail_count += 1
                    if len(failures) < 200:
                        failures.append((i, err))
                    continue
                ok_count += 1
                cell = i  # tier0: algorithmic position, whole-dataset index
                x0, y0 = (cell % cols0) * TIER0_TILE, (cell // cols0) * TIER0_TILE
                tier0.paste(t0img, (x0, y0))
                local = i - lo  # tier1: position within this group
                x1, y1 = (local % cols1) * TIER1_TILE, (local // cols1) * TIER1_TILE
                group_canvas.paste(t1img, (x1, y1))
        atomic_save_webp(group_canvas, os.path.join(OUT, f"g{g}.webp"), q1)
        atomic_save_webp(tier0, atlas0_path, q0)
        groups_done.add(g)
        progress = {"groups_done": sorted(groups_done), "ok_count": ok_count, "fail_count": fail_count,
                     "n": n, "num_groups": num_groups}
        save_progress(progress)
        dt = time.time() - t_g0
        print(f"group {g+1}/{num_groups} ({hi-lo} paintings) done in {dt:.1f}s "
              f"({(hi-lo)/dt:.1f}/s) -- ok={ok_count} fail={fail_count}")

    manifest = {
        "v": 1, "n": n,
        "tier0": {"tile": TIER0_TILE, "cols": cols0, "rows": rows0, "sheet": "atlas0.webp"},
        "tier1": {"tile": TIER1_TILE, "groupSize": GROUP_SIZE, "numGroups": num_groups, "file": "g{g}.webp"},
    }
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"))
    total_dt = time.time() - t_start
    print(f"done. {total_requests} requests in {total_dt:.1f}s, ok={ok_count} fail={fail_count}")
    if failures:
        with open(os.path.join(OUT, "fetch-failures.txt"), "w") as f:
            for i, err in failures:
                f.write(f"{i}\t{err}\n")
        print(f"wrote {len(failures)}+ failures to data/paintmap/fetch-failures.txt (truncated at 200 shown here; "
              f"total fail_count={fail_count})")
    report()


def report():
    print("---- data/paintmap report ----")
    if not os.path.isdir(OUT):
        print("not built yet"); return
    total = 0
    for name in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, name)
        if os.path.isfile(p) and name.endswith(".webp"):
            sz = os.path.getsize(p)
            total += sz
            print(f"  {name}\t{sz/1024:.1f} KB")
    print(f"  TOTAL sheets: {total/1024/1024:.2f} MB")
    if os.path.exists(PROGRESS):
        print("progress:", json.load(open(PROGRESS)))
    if os.path.exists(os.path.join(OUT, "manifest.json")):
        print("manifest:", json.load(open(os.path.join(OUT, "manifest.json"))))


if __name__ == "__main__":
    main()
