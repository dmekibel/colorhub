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
  python3 tools/paintmap_atlas.py resplit                  # re-tile existing v1 sheets to the v2, WebKit-safe
                                                             # layout (<=2048px sheets) -- no network at all

David, 2026-10-10: "a more convenient way to view [Design objects, Photography...], similar to paintings... and
even on a map" -- every subcommand above also takes --collection design|photography (default: paintings, the
exact behavior this file always had). A collection's own sheets land at data/paintmap/<collection>/ instead of
data/paintmap/ itself (js/paintmap.js's pmAtlasBase() reads from the same place), built in ONE pass over that
collection's own already-built data file(s) instead of data/gallery/thumbs.txt -- no separate thumbs file to
generate first, since js/designobjects.js's objects-<cat>.json / js/photography.js's photos.json already carry
everything load_lines_design()/load_lines_photography() below need per item, in the SAME array order
loadDesignObjects()/loadPhotography() build their own in-memory array in (concatenated by DO_CATS for Design
objects; file order for Photography), so index i here is the same i js/paintmap.js's adapter uses.
Cooper Hewitt and the National Postal Museum (both served from ids.si.edu) are skipped for Design objects: that
host's TLS certificate is currently expired, and this script never bypasses certificate verification -- those
cells are left blank in the sheet, which js/paintmap.js already draws as a flat fill of the object's own
measured dominant color (the same fallback every cell gets before its picture has loaded), not a missing tile.
`build` prints how many cells were skipped for this reason when the run finishes.
  python3 tools/paintmap_atlas.py build --collection design
  python3 tools/paintmap_atlas.py build --collection photography
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

# ---- the "Collection" switch (David, 2026-10-10) -- "paintings" (default) leaves every path above untouched;
# any other value moves OUT under data/paintmap/<collection>/ (set in main(), once --collection is parsed) and
# load_lines()/process_one() below read that collection's own data file(s) instead of thumbs.txt.
COLLECTION = "paintings"
DESIGN_CATS = ["poster", "graphic", "textile", "wallpaper", "ceramics", "glass", "furniture", "product", "costume", "stamps"]
DESIGN_DIR = os.path.join(ROOT, "data", "design")
PHOTO_FILE = os.path.join(ROOT, "data", "photography", "photos.json")
# ids.si.edu (Cooper Hewitt chndm, National Postal Museum npmd) currently answers with an expired TLS cert --
# skip, never bypass verification (David's explicit instruction). js/paintmap.js's own flat dominant-color fill
# already covers a cell with no picture, so "skipped" here just means that cell never gets a real photo tile.
DESIGN_SKIP_SRC = {"chndm", "npmd"}

TIER0_TILE = 20
TIER1_TILE = 80
GROUP_SIZE = 625   # David's iPhone 16 Pro Max, Home Screen app (WKWebView), 2026-10-10: "every painting is not
# loaded at once" -- a single 3100x3080 (~9.6MP) tier-0 sheet and 3120x3120 tier-1 sheets (at the old 1500/sheet)
# decode fine in desktop-Safari-class memory but a Home Screen WKWebView runs under a tighter JetSam budget, and
# createImageBitmap has no partial-failure mode: if ONE of those big decodes is refused, pmAtlasLoad's whole
# promise rejects and (pre-fix) that failure was silently swallowed forever, leaving every cell on its flat-color
# fallback for the rest of the session -- exactly "every painting is not loaded at once". The fix has two halves:
# js/paintmap.js now retries that fetch+decode and falls back to an <img>+decode() path when createImageBitmap
# itself fails, AND these sheets are now kept at or under 2048x2048 (WebKit's documented safe image-decode
# ceiling) by splitting tier 0 across TIER0_SHEETS small sheets and shrinking tier-1's groupSize from 1500 to 625
# (25 cols x 80px = 2000px, under the ceiling; was 39 cols = 3120px, over it). `resplit` (below) rebuilds both
# from the EXISTING sheets with pure local image slicing -- no re-fetching the ~23,778 source paintings.
TIER0_MAXDIM = 2040   # <= 2048; 2040 is an exact multiple of TIER0_TILE (20)
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


def design_thumb_url(o):
    """A design object's own ('kind', 'loc') for fetch_bytes(), or None to skip this cell entirely (no picture,
    no fetch -- js/paintmap.js's flat dominant-color fill covers it). Mirrors js/designobjects.js's DO_IMG_TPL
    exactly, except chndm/npmd (ids.si.edu's own template there) are never resolved -- see DESIGN_SKIP_SRC."""
    src, i = o.get("src"), o.get("i")
    if not i or src in DESIGN_SKIP_SRC:
        return None
    if src == "rijksd":
        return ("http", f"https://iiif.micr.io/{i}/full/400,/0/default.jpg")
    if src == "metd":
        return ("http", f"https://images.metmuseum.org/CRDImages/{i}")
    if src in ("cmad", "commonsd"):
        return ("http", i)   # already a full, hotlinkable URL (doImgUrl's own cmad/commonsd case)
    if src == "aicd":
        return ("local", os.path.join(ROOT, "img", "design", "aicd", f"{o.get('id')}.jpg"))
    return None


def process_one(i, item, retries=RETRIES):
    """item is a thumbs.txt LINE for the paintings collection (the original contract), or a raw JSON row for
    Design objects / Photography -- load_lines() below hands each collection its own native shape, and this
    branches on COLLECTION to resolve it the right way. Crop is always None for the two newer collections (the
    corpora have no frame-crop data the way paintings' own thumbs.txt does); a skipped/unresolvable item (a
    DESIGN_SKIP_SRC source, or a Photography row with no image) returns the same (None, None, err) shape a
    network failure would, so it's counted and reported the same way, never silently dropped.
    """
    try:
        if COLLECTION == "design":
            resolved = design_thumb_url(item)
            if resolved is None:
                return i, None, None, "skipped (ids.si.edu TLS, or no image)"
            kind, loc, crop = resolved[0], resolved[1], None
        elif COLLECTION == "photography":
            img = item.get("img")
            if not img:
                return i, None, None, "no image field"
            kind, loc, crop = "http", img, None
        else:
            code_addr, crop = parse_line(item)
            kind, loc = thumb_url(code_addr)
        raw = fetch_bytes(kind, loc, retries=retries)
        t0 = square_crop_resize(raw, crop, TIER0_TILE)
        t1 = square_crop_resize(raw, crop, TIER1_TILE)
        return i, t0, t1, None
    except Exception as e:
        return i, None, None, str(e)


def load_lines_design():
    """Every design object, in the EXACT order js/designobjects.js's loadDesignObjects() builds its own DO
    array in: DO_CATS order, each category's own file in its own array order, concatenated ('.flat()')."""
    rows = []
    for cat in DESIGN_CATS:
        path = os.path.join(DESIGN_DIR, f"objects-{cat}.json")
        if os.path.exists(path):
            rows.extend(json.load(open(path)))
    return rows


def load_lines_photography():
    """Every photograph, in file order -- js/photography.js's loadPhotography() maps photos.json 1:1, in order."""
    return json.load(open(PHOTO_FILE))


def load_lines():
    if COLLECTION == "design":
        return load_lines_design()
    if COLLECTION == "photography":
        return load_lines_photography()
    with open(THUMBS) as f:
        return [l.rstrip("\n") for l in f if l.strip() != "" or True]


def grid0(n):
    cols = max(1, ceil(sqrt(n)))
    rows = ceil(n / cols)
    return cols, rows


def tier0_layout(n):
    """Tier 0 as several sheets instead of one, each <= TIER0_MAXDIM square (WebKit's safe decode ceiling --
    see the GROUP_SIZE comment above). cols is the SAME for every sheet (so position arithmetic in js/paintmap.js
    stays `sheet = i // perSheet; local = i % perSheet; x = local % cols; y = local // cols` -- no per-sheet
    lookup table needed); only the last sheet is a partial page, same as a build script's last tier-1 group
    already is. Returns (cols, per_sheet, [count_in_each_sheet...])."""
    cols = max(1, TIER0_MAXDIM // TIER0_TILE)
    per_sheet = cols * cols
    counts, remaining = [], n
    while remaining > 0:
        c = min(per_sheet, remaining)
        counts.append(c)
        remaining -= c
    return cols, per_sheet, counts or [0]


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
    if man.get("v", 1) >= 2:
        raise SystemExit("cmd_repair hasn't been updated for the v2 (multi-sheet tier0) manifest yet -- "
                          "it still assumes one atlas0.webp. Patch find_blank_tier0_cells/cmd_repair for "
                          "tier0.sheets before using it on this dataset, or ask for that update.")
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


class _OldSheetCache:
    """At most 2 decoded old tier-1 sheets open at once -- global index i only ever needs the old group it falls
    in (i // old_group_size) or, right at a new-group boundary, that one and the next, and resplit() visits i in
    increasing order, so an LRU of 2 never re-opens a sheet it already closed."""
    def __init__(self, path_for_group):
        self.path_for_group = path_for_group
        self.order, self.cache = [], {}

    def get(self, g):
        im = self.cache.get(g)
        if im is not None:
            return im
        im = Image.open(self.path_for_group(g)).convert("RGBA")
        self.cache[g] = im
        self.order.append(g)
        while len(self.order) > 2:
            old_g = self.order.pop(0)
            if old_g != g:
                self.cache.pop(old_g, None)
        return im


def cmd_resplit():
    """Rebuild tier 0 + tier 1 at the new, WebKit-safe sheet sizes (TIER0_MAXDIM / GROUP_SIZE's comment) by
    SLICING THE EXISTING SHEETS -- every painting's pixels are already decoded and packed in today's
    atlas0.webp + g<N>.webp, so this never re-fetches a single one of the ~23,778 source images. Reads the old
    (v1) manifest to know the old layout, writes the new (v2) one. Old files are removed once the new ones are
    written and verified to decode (never left half-migrated)."""
    old_man_path = os.path.join(OUT, "manifest.json")
    old_man = json.load(open(old_man_path))
    if old_man.get("v", 1) >= 2:
        print("manifest is already v2 -- nothing to resplit"); return
    n = old_man["n"]
    old_t0_cols, old_t0_tile = old_man["tier0"]["cols"], old_man["tier0"]["tile"]
    old_atlas0_path = os.path.join(OUT, old_man["tier0"]["sheet"])
    old_t1_size, old_t1_tile = old_man["tier1"]["groupSize"], old_man["tier1"]["tile"]
    old_t1_file = old_man["tier1"]["file"]

    assert old_t0_tile == TIER0_TILE and old_t1_tile == TIER1_TILE, \
        "resplit only changes sheet LAYOUT, not tile size -- TIER0_TILE/TIER1_TILE must match the old manifest"

    print(f"resplit: n={n}, old tier0 one sheet {old_t0_cols}x{ceil(n/old_t0_cols)} cells, "
          f"old tier1 {old_man['tier1']['numGroups']} sheets of {old_t1_size}")

    # ---- tier 0: one old sheet -> several new ones, same per-cell pixels, just re-tiled ----
    old_t0 = Image.open(old_atlas0_path).convert("RGBA")
    new_cols0, per_sheet0, counts0 = tier0_layout(n)
    new_t0_names = [f"atlas0-{s}.webp" for s in range(len(counts0))]
    new_t0_sheets = [Image.new("RGBA", (new_cols0 * TIER0_TILE, ceil(c / new_cols0) * TIER0_TILE), (0, 0, 0, 0))
                      for c in counts0]
    for i in range(n):
        ox, oy = (i % old_t0_cols) * TIER0_TILE, (i // old_t0_cols) * TIER0_TILE
        cell = old_t0.crop((ox, oy, ox + TIER0_TILE, oy + TIER0_TILE))
        sheet0, local0 = divmod(i, per_sheet0)
        nx, ny = (local0 % new_cols0) * TIER0_TILE, (local0 // new_cols0) * TIER0_TILE
        new_t0_sheets[sheet0].paste(cell, (nx, ny))
    new_t0_paths = [os.path.join(OUT, name) for name in new_t0_names]
    for canvas, path in zip(new_t0_sheets, new_t0_paths):
        atomic_save_webp(canvas, path, Q0)
    print(f"  tier0: wrote {len(new_t0_names)} sheets, {new_cols0*TIER0_TILE}px wide each")

    # ---- tier 1: old GROUP_SIZE sheets -> new (smaller) GROUP_SIZE sheets, same source pixels ----
    # New sheets reuse the SAME filename pattern as the old ones (g0.webp, g1.webp, ...) and there are now MORE
    # of them than before (39 vs 16) -- so new_g=9's output path is literally old g9.webp's path, and old g9 is
    # still needed as a READ source by later new groups (whichever new_g range falls inside old group 9). Writing
    # straight to the final name would self-clobber that source mid-run. So every new sheet is written to a
    # `.resplit-tmp` name first; nothing touches a real g<N>.webp until ALL new sheets exist and this old_cache
    # (which only ever opens g<N>.webp, never the tmp files) has finished reading every old sheet it needs.
    old_cache = _OldSheetCache(lambda g: os.path.join(OUT, old_t1_file.replace("{g}", str(g))))
    new_num_groups = ceil(n / GROUP_SIZE)
    tmp_t1_paths, final_t1_paths = [], []
    for new_g in range(new_num_groups):
        lo, hi = new_g * GROUP_SIZE, min(n, (new_g + 1) * GROUP_SIZE)
        new_cols1, new_rows1 = grid1(hi - lo)
        canvas = Image.new("RGBA", (new_cols1 * TIER1_TILE, new_rows1 * TIER1_TILE), (0, 0, 0, 0))
        for i in range(lo, hi):
            old_g = i // old_t1_size
            old_lo = old_g * old_t1_size
            old_cols1, _ = grid1(min(old_t1_size, n - old_lo))
            old_local = i - old_lo
            ox, oy = (old_local % old_cols1) * TIER1_TILE, (old_local // old_cols1) * TIER1_TILE
            old_sheet = old_cache.get(old_g)
            cell = old_sheet.crop((ox, oy, ox + TIER1_TILE, oy + TIER1_TILE))
            local = i - lo
            nx, ny = (local % new_cols1) * TIER1_TILE, (local // new_cols1) * TIER1_TILE
            canvas.paste(cell, (nx, ny))
        final_path = os.path.join(OUT, f"g{new_g}.webp")
        tmp_path = final_path + ".resplit-tmp"
        canvas.save(tmp_path, "WEBP", quality=Q1, method=6)
        tmp_t1_paths.append(tmp_path)
        final_t1_paths.append(final_path)
        if (new_g + 1) % 10 == 0 or new_g == new_num_groups - 1:
            print(f"  tier1: {new_g + 1}/{new_num_groups} sheets built")
    old_cache = None   # done reading every old g<N>.webp -- safe to rename the tmp files over them now
    for tmp_path, final_path in zip(tmp_t1_paths, final_t1_paths):
        os.replace(tmp_path, final_path)
    # any OLD sheet beyond the new count (old numGroups was smaller here, so none -- but keep the cleanup for
    # the opposite case, a future dataset where GROUP_SIZE shrinks less than the painting count grows)
    for g in range(new_num_groups, old_man["tier1"]["numGroups"]):
        p = os.path.join(OUT, old_t1_file.replace("{g}", str(g)))
        if os.path.exists(p):
            os.remove(p)
    new_t1_paths = final_t1_paths
    print(f"  tier1: {new_num_groups}/{new_num_groups} sheets written")

    # verify every new sheet actually decodes before deleting the old ones
    for p in new_t0_paths + new_t1_paths:
        Image.open(p).verify()

    new_manifest = {
        "v": 2, "n": n,
        "tier0": {"tile": TIER0_TILE, "cols": new_cols0, "perSheet": per_sheet0, "sheets": new_t0_names},
        "tier1": {"tile": TIER1_TILE, "groupSize": GROUP_SIZE, "numGroups": new_num_groups, "file": "g{g}.webp"},
    }
    json.dump(new_manifest, open(old_man_path, "w"))

    # clean up the old, now-unreferenced sheets (old atlas0.webp + any old g<N>.webp beyond the new count,
    # since new_num_groups > old numGroups here -- GROUP_SIZE shrank -- there's nothing to remove on that side
    # except the old atlas0.webp itself)
    if os.path.exists(old_atlas0_path) and os.path.basename(old_atlas0_path) not in new_t0_names:
        os.remove(old_atlas0_path)
    print(f"resplit done: tier0 {len(new_t0_names)} sheets, tier1 {new_num_groups} sheets (was "
          f"{old_man['tier1']['numGroups']}). manifest.json now v2.")
    report()


def dt_str(s):
    return f"{s:.1f}s" if s < 90 else f"{s/60:.1f}m"


def main():
    global COLLECTION, OUT, PROGRESS
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
        elif args[k] == "--collection": COLLECTION = args[k + 1]; k += 2
        else: k += 1

    if COLLECTION not in ("paintings", "design", "photography"):
        raise SystemExit(f"--collection must be paintings, design or photography (got {COLLECTION!r})")
    # a collection's own sheets live under data/paintmap/<collection>/, never mixed with Paintings' own root
    # files (OUT/PROGRESS are both derived from it, same as at module load -- recomputed here because that
    # original computation ran before --collection was known)
    if COLLECTION != "paintings":
        OUT = os.path.join(ROOT, "data", "paintmap", COLLECTION)
        PROGRESS = os.path.join(OUT, ".progress.json")

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

    if cmd == "resplit":
        cmd_resplit()
        return

    lines = load_lines()
    n = len(lines)
    if limit:
        n = min(n, limit)
    cols0, per_sheet0, counts0 = tier0_layout(n)
    num_groups = ceil(n / GROUP_SIZE)
    print(f"n={n} tier0 cols={cols0} per_sheet={per_sheet0} sheets={len(counts0)} ({cols0*TIER0_TILE}px wide, "
          f"<= {TIER0_MAXDIM}px per side) groups={num_groups} tier1 tile={TIER1_TILE}px group_size={GROUP_SIZE}")

    progress = load_progress()
    groups_done = set(progress.get("groups_done", []))
    ok_count, fail_count = progress.get("ok_count", 0), progress.get("fail_count", 0)
    failures = []

    # tier 0 is now several sheets (see TIER0_MAXDIM's comment) instead of one -- same resumability contract
    # (re-saved after every completed group), just one canvas+path per sheet instead of one
    tier0_names = [f"atlas0-{s}.webp" for s in range(len(counts0))]
    tier0_paths = [os.path.join(OUT, name) for name in tier0_names]
    tier0_sheets = []
    for s, count in enumerate(counts0):
        rows = ceil(count / cols0)
        canvas = Image.new("RGBA", (cols0 * TIER0_TILE, rows * TIER0_TILE), (0, 0, 0, 0))
        if os.path.exists(tier0_paths[s]) and groups_done:
            try:
                prev = Image.open(tier0_paths[s]).convert("RGBA")
                if prev.size == canvas.size:
                    canvas = prev
            except Exception:
                pass
        tier0_sheets.append(canvas)

    def save_tier0():
        for s, canvas in enumerate(tier0_sheets):
            atomic_save_webp(canvas, tier0_paths[s], q0)

    t_start = time.time()
    total_requests = 0
    skip_count = 0   # "skipped" (ids.si.edu TLS / no image), tracked apart from a genuine fetch failure --
    # same cell-left-blank outcome either way, but worth reporting separately (David asked how many)

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
                    if err.startswith("skipped"):
                        skip_count += 1
                    if len(failures) < 200:
                        failures.append((i, err))
                    continue
                ok_count += 1
                sheet0, local0 = divmod(i, per_sheet0)   # tier0: algorithmic position, whole-dataset index
                x0, y0 = (local0 % cols0) * TIER0_TILE, (local0 // cols0) * TIER0_TILE
                tier0_sheets[sheet0].paste(t0img, (x0, y0))
                local = i - lo  # tier1: position within this group
                x1, y1 = (local % cols1) * TIER1_TILE, (local // cols1) * TIER1_TILE
                group_canvas.paste(t1img, (x1, y1))
        atomic_save_webp(group_canvas, os.path.join(OUT, f"g{g}.webp"), q1)
        save_tier0()
        groups_done.add(g)
        progress = {"groups_done": sorted(groups_done), "ok_count": ok_count, "fail_count": fail_count,
                     "n": n, "num_groups": num_groups}
        save_progress(progress)
        dt = time.time() - t_g0
        print(f"group {g+1}/{num_groups} ({hi-lo} paintings) done in {dt:.1f}s "
              f"({(hi-lo)/dt:.1f}/s) -- ok={ok_count} fail={fail_count}")

    manifest = {
        "v": 2, "n": n,
        "tier0": {"tile": TIER0_TILE, "cols": cols0, "perSheet": per_sheet0, "sheets": tier0_names},
        "tier1": {"tile": TIER1_TILE, "groupSize": GROUP_SIZE, "numGroups": num_groups, "file": "g{g}.webp"},
    }
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"))
    total_dt = time.time() - t_start
    print(f"done. {total_requests} requests in {total_dt:.1f}s, ok={ok_count} fail={fail_count}"
          + (f" (of which {skip_count} skipped -- ids.si.edu TLS or no image)" if skip_count else ""))
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
