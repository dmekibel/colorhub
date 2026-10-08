#!/usr/bin/env python3
"""ColorHub art-history color corpus. Re-runnable and resumable; every step caches in research/_raw/ (gitignored).

  python3 tools/corpus.py meta [src ...] [--resume]    # 1. painting metadata -> research/_raw/<src>/meta.json
  python3 tools/corpus.py images [src ...]             # 2. one small image per painting (skips cached ones)
  python3 tools/corpus.py palettes                     # 3. 6-color k-means palette per cached image -> research/_raw/corpus-palettes.jsonl
  python3 tools/corpus.py build                        # 4. write the corpus (data/corpus.json or data/corpus/*.json) and data/stats.js
  python3 tools/corpus.py fetch [src ...] [--resume]   # 1+2 for some sources (run one process per museum in parallel)
  python3 tools/corpus.py status                       # what is cached so far, per source
  python3 tools/corpus.py sheet [N] [out.png] [seed] [src]  # contact sheet of N random paintings (image | palette | names)
  python3 tools/corpus.py all [--resume]               # 1-4 in order
--resume keeps every metadata page or record already cached (a finished source is not asked again; an interrupted one
continues where it stopped). Without it, `meta` asks each API again. Images and palettes are always incremental.

Sources (public-domain / CC0 images only; source codes are the `src` field of every row):
  aic = Art Institute of Chicago API  https://api.artic.edu/docs/   (artwork_type Painting or Miniature Painting,
        is_public_domain, has image). Images via IIIF at 200px wide (a size the docs recommend for cache hits).
        Throttle: the docs ask scrapers for <= 1 request a second, one thread, so AIC runs at 1 req/s.
  cma = Cleveland Museum of Art Open Access API  https://openaccess-api.clevelandart.org/  (type Painting, cc0,
        has_image). The ~900px "web" JPEG is downloaded once and only a 200px copy is kept. ~2 req/s.
  met, nga, rijks, smk = The Met, the National Gallery of Art (Washington), the Rijksmuseum and SMK (Copenhagen):
        one adapter each in tools/museums/ (its docstring says which route, filters and image size it uses).
        Their images are fetched at about 400px and only a 200px copy is kept.

Selection (select()): manuscript text and calligraphy pages are dropped, and one manuscript or album keeps at most
GROUP_CAP leaves, so a 600-leaf book cannot outweigh a century. At build time near-duplicate images are dropped
(dedupe()) and one artist keeps at most ARTIST_CAP paintings (cap_artists()), so a prolific painter cannot outweigh
a country or a decade.

Output shape: one array of rows. Up to SHARD_LIMIT bytes it is data/corpus.json; above that it is split into
data/corpus/<src>-<n>.json (by source, rows in id order, ~2.5 MB each) and data/corpus.json is removed. Readers
should accept both: load_corpus() below does (data/corpus.json if present, else every data/corpus/*.json).

Palette (step 3): the 200px image is auto-trimmed of near-uniform border bands that end in a clear edge (frame, mat,
scanner bed), inset 2%, reduced to ~120px on the long side by area averaging and converted to CIELAB. A flat neutral
photo backdrop around shaped panels, ovals and lockets is masked out (backdrop_mask). Then k-means (k=6, k-means++
seeding, best of 4 restarts). As in tools/paintings.py, a* and b* are scaled by 1.5 for the clustering only, so a
small vivid area is not swallowed by big dark ones; each palette color is the plain Lab mean of its pixels and its
share is its pixel area. Naming, families and statistics happen in step 4, so changing a rule never re-runs k-means.

Outputs (step 4): data/corpus.json (one compact row per painting) and data/stats.js (window.STATS: group aggregates
by century, decade, country, movement and artist, plus findings). Method and findings: research/STATS-FINDINGS.md.

Needs Python 3 with Pillow and numpy only.
"""
import json, math, random, re, sys, time, urllib.request, urllib.parse, urllib.error, io, unicodedata, threading
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
PAL_CACHE = RAW / "corpus-palettes.jsonl"
HASH_CACHE = RAW / "corpus-hashes.jsonl"
IMG_W = 200          # cached image width
K_SIDE = 120         # long side of the copy k-means runs on
K = 6
CHROMA_W = 1.5
THIS = sys.modules[__name__]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from museums import met, nga, rijks, smk, commons  # noqa: E402  (source adapters; they call back into this module)
from museums import common as museum_common  # noqa: E402

ADAPTERS = {"met": met, "nga": nga, "rijks": rijks, "smk": smk, "commons": commons}
SRC = {
    "aic": dict(dir=RAW / "aic", gap=1.0, workers=1, name="Art Institute of Chicago",
                api="https://api.artic.edu/docs/", license="CC0 metadata; public-domain images"),
    "cma": dict(dir=RAW / "cma", gap=0.45, workers=1, name="Cleveland Museum of Art",
                api="https://openaccess-api.clevelandart.org/", license="CC0 metadata and images"),
}
for _s, _m in ADAPTERS.items():
    SRC[_s] = dict(dir=RAW / _s, **_m.INFO)

# ---------------------------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------------------------
_last = defaultdict(float)
_pace_lock = threading.Lock()


def _pace(src):
    """Reserve the next request slot for `src` (thread-safe): requests leave at least SRC[src]['gap'] seconds apart
    however many threads share the source."""
    with _pace_lock:
        now = time.time()
        slot = max(now, _last[src] + SRC[src]["gap"])
        _last[src] = slot
    if slot > now:
        time.sleep(slot - now)


def fetch(src, url, data=None, binary=False, tries=5, headers=None, text=False):
    """GET (or POST json `data`) with the source's polite gap between requests and backoff on errors.
    Returns parsed JSON, or bytes (binary=True), or a str (text=True)."""
    for i in range(tries):
        _pace(src)
        try:
            h = {"User-Agent": UA, "AIC-User-Agent": UA} if src == "aic" else {"User-Agent": UA}
            h.update(headers or {})
            body = None
            if data is not None:
                body = json.dumps(data).encode()
                h["Content-Type"] = "application/json"
            req = urllib.request.Request(url, data=body, headers=h)
            with urllib.request.urlopen(req, timeout=90) as r:
                out = r.read()
            if binary:
                return out
            return out.decode("utf-8") if text else json.loads(out.decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404, 410):
                raise
            back = 10 * (i + 1) if e.code == 429 else 4 * (i + 1)
            print(f"   {src} HTTP {e.code}; retry in {back}s", flush=True)
            time.sleep(back)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, json.JSONDecodeError) as e:
            print(f"   {src} fetch failed ({e}); retry in {4 * (i + 1)}s", flush=True)
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"could not fetch {url}")


def download(src, url, path, chunk=1 << 20):
    """Stream a large file (a CSV dump) to `path` politely; written to a .part file first, so a cut-off download
    is never mistaken for a finished one."""
    _pace(src)
    tmp = Path(str(path) + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
        while True:
            b = r.read(chunk)
            if not b:
                break
            f.write(b)
    tmp.replace(path)


def write_meta(src, rows, **extra):
    d = SRC[src]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    head = dict(fetched=date.today().isoformat(), complete=True)
    head.update(extra)
    (d / "meta.json").write_text(json.dumps(dict(head, rows=rows), ensure_ascii=False))
    return rows


# ---------------------------------------------------------------------------------------------
# Step 1: metadata
# ---------------------------------------------------------------------------------------------
AIC_FIELDS = ["id", "title", "artist_title", "artist_display", "date_start", "date_end", "date_display",
              "place_of_origin", "style_title", "classification_titles", "artwork_type_title", "image_id",
              "department_title", "medium_display", "color", "thumbnail", "main_reference_number"]
CMA_FIELDS = "id,accession_number,title,creation_date,creation_date_earliest,creation_date_latest,culture,creators," \
             "images,type,technique,department,collection,url,share_license_status"


def meta_aic():
    d = SRC["aic"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    # The search endpoint refuses any page past the first 1,000 results (403 "too many results"), so this pages by
    # id instead: sort by id and ask for "id > last id seen", always page 1.
    must = [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}},
            {"terms": {"artwork_type_title.keyword": ["Painting", "Miniature Painting"]}}]
    rows, last = [], 0
    while True:
        query = {"bool": {"must": must + [{"range": {"id": {"gt": last}}}]}}
        r = fetch("aic", "https://api.artic.edu/api/v1/artworks/search",
                  data={"query": query, "fields": AIC_FIELDS, "limit": 100, "page": 1, "sort": [{"id": "asc"}]})
        rows += r["data"]
        print(f"aic meta: {len(rows)} (+{r['pagination']['total']} left incl. this page)", flush=True)
        if len(r["data"]) < 100:
            break
        last = r["data"][-1]["id"]
    for x in rows:
        x.pop("_score", None)
    (d / "meta.json").write_text(json.dumps({"fetched": date.today().isoformat(), "rows": rows}, ensure_ascii=False))
    return rows


def meta_cma():
    d = SRC["cma"]["dir"]
    d.mkdir(parents=True, exist_ok=True)
    rows, skip = [], 0
    while True:
        q = urllib.parse.urlencode({"type": "Painting", "cc0": 1, "has_image": 1, "limit": 100, "skip": skip,
                                    "fields": CMA_FIELDS})
        r = fetch("cma", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
        rows += r["data"]
        total = r["info"]["total"]
        print(f"cma meta skip {skip}: {len(rows)} of {total}", flush=True)
        skip += 100
        if skip >= total or not r["data"]:
            break
    for x in rows:  # keep only the web image reference
        im = x.get("images") or {}
        x["images"] = {"web": im.get("web")}
    (d / "meta.json").write_text(json.dumps({"fetched": date.today().isoformat(), "rows": rows}, ensure_ascii=False))
    return rows


def load_meta(src):
    p = SRC[src]["dir"] / "meta.json"
    return json.loads(p.read_text()) if p.exists() else {"fetched": None, "rows": []}


# Which records count as paintings for the corpus. Two museum habits would skew the statistics:
#  1. Manuscript text pages are catalogued as paintings (CMA's Kalpa-sutra and Perfection of Wisdom manuscripts
#     have hundreds of "Text, folio 12 (verso)" leaves). Pure text and calligraphy pages are dropped; a painting
#     with calligraphy on its back ("... (recto); Calligraphy (verso)") stays, since the image is the painting.
#  2. One manuscript or album can be hundreds of records (CMA owns 654 leaves of the Tuti-nama). Each object group
#     (accession number up to its second dot: 1962.279.146.a -> 1962.279) keeps at most GROUP_CAP leaves, evenly
#     spaced through the group, so one book counts like a handful of paintings, not like a whole century.
GROUP_CAP = 8
TEXT_PAGE = re.compile(r"^(genealogical )?text\b|text page|^(persian )?calligraph(?!y and painting)|calligraphy in \w+ script|"
                       r"triptych of calligraphy|calligraphy ac+ompanying|calligraphic specimen$|colophon by|, colophon$|"
                       r"^poem in |^album cover|title page and front cover|final page and back cover", re.I)


def group_key(src, x):
    if src in ADAPTERS:
        return ADAPTERS[src].group_key(THIS, x)
    acc = (x.get("accession_number") if src == "cma" else x.get("main_reference_number")) or str(x["id"])
    acc = re.sub(r"[a-z]+(-[a-z]+)?$", "", acc.strip())  # 1925.3412a-b -> 1925.3412
    return src + ":" + ".".join(acc.split(".")[:2])


# The newer sources number accessions differently (the Met's 29.100.5 is item 5 of the Havemeyer bequest, not a leaf
# of book 29.100), so for them only records whose title names a leaf, folio, page or album are grouped by accession
# prefix; every other record is its own group.
LEAF = re.compile(r"\b(folio|folios|leaf|leaves|album|page from|pages from)\b", re.I)


def leaf_group(src, acc, title, rid):
    if acc and LEAF.search(title or ""):
        acc = re.sub(r"[a-z]+(-[a-z]+)?$", "", re.sub(r"[\s–—-]+.*$", "", acc.strip()))
        return src + ":" + ".".join(acc.split(".")[:2])
    return f"{src}:{rid}"


def select(src, rows):
    keep = [x for x in rows if not TEXT_PAGE.search(x.get("title") or "")]
    groups = defaultdict(list)
    for x in keep:
        groups[group_key(src, x)].append(x)
    out = []
    for g in groups.values():
        if len(g) > GROUP_CAP:
            g = sorted(g, key=lambda x: str((x.get("accession_number") or x.get("main_reference_number") or x["id"])))
            idx = np.linspace(0, len(g) - 1, GROUP_CAP).round().astype(int)
            g = [g[i] for i in sorted(set(idx))]
        out += g
    ids = {x["id"] for x in out}
    return [x for x in rows if x["id"] in ids]


# ---------------------------------------------------------------------------------------------
# Step 2: images
# ---------------------------------------------------------------------------------------------
def aic_iiif(image_id, w):
    return f"https://www.artic.edu/iiif/2/{image_id}/full/{w},/0/default.jpg"


def img_path(src, rid):
    return SRC[src]["dir"] / "img" / f"{rid}.jpg"


def image_candidates(src, x):
    """URLs to try, in order, for the analysis copy of one painting."""
    if src == "aic":
        return [aic_iiif(x["image_id"], IMG_W)]
    if src == "cma":
        web = (x.get("images") or {}).get("web") or {}
        return [web["url"]] if web.get("url") else []
    return ADAPTERS[src].image_urls(x)


_used = {}


def img_used(src):
    """id -> image URL, for the paintings whose first candidate URL failed and a later one worked."""
    p = SRC[src]["dir"] / "img_used.json"
    key = (src, p.stat().st_mtime if p.exists() else 0)
    if key not in _used:
        _used[key] = json.loads(p.read_text()) if p.exists() else {}
    return _used[key]


_img_lock = threading.Lock()


def save_image(src, x):
    """Fetch one painting's image (first candidate URL that works), keep a IMG_W-wide copy. Returns None, or the
    last error. A later candidate that worked is noted in <src>/img_used.json, so the row's img is a URL that loads."""
    (SRC[src]["dir"] / "img").mkdir(parents=True, exist_ok=True)
    err = "no image URL"
    for j, url in enumerate(image_candidates(src, x)):
        try:
            im = Image.open(io.BytesIO(fetch(src, url, binary=True))).convert("RGB")
            if im.width > IMG_W:
                im = im.resize((IMG_W, max(1, round(im.height * IMG_W / im.width))), Image.LANCZOS)
            im.save(img_path(src, x["id"]), "JPEG", quality=92)
            if j:
                with _img_lock:
                    used = img_used(src)
                    used[str(x["id"])] = url
                    (SRC[src]["dir"] / "img_used.json").write_text(json.dumps(used, indent=0))
            return None
        except Exception as e:  # 404 on a smaller rendition: try the next candidate
            err = e
    return err


def download_images(src):
    rows = select(src, load_meta(src)["rows"])
    failed_p = SRC[src]["dir"] / "failed.json"
    failed = {}  # failures are logged here and retried on the next run (most are transient 503s)
    todo = [x for x in rows if not img_path(src, x["id"]).exists()]
    print(f"{src}: {len(rows)} paintings, {len(todo)} images to fetch", flush=True)
    t0, lock, done, refused = time.time(), threading.Lock(), [0], [0]

    def one(x):
        if refused[0] >= 3:  # the server keeps refusing us (403): stop asking; the next run retries
            return
        err = save_image(src, x)
        with lock:
            refused[0] = refused[0] + 1 if isinstance(err, urllib.error.HTTPError) and err.code == 403 else 0
            if err:
                failed[str(x["id"])] = str(err)[:200]
                failed_p.write_text(json.dumps(failed, indent=0))
                print(f"   {src} {x['id']} failed: {err}", flush=True)
            done[0] += 1
            if done[0] % 100 == 1:
                print(f"{src} images {done[0]}/{len(todo)}  {(time.time() - t0) / 60:.1f} min", flush=True)

    with ThreadPoolExecutor(SRC[src].get("workers", 1)) as ex:
        list(ex.map(one, todo))
    print(f"{src}: images done, {len(failed)} failed", flush=True)




# ---------------------------------------------------------------------------------------------
# Color math (sRGB D65 <-> CIELAB, CIEDE2000): same formulas as tools/paintings.py and tools/colormath.js
# ---------------------------------------------------------------------------------------------
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WP = np.array([0.95047, 1.0, 1.08883])


def rgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ _M.T / _WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WP
    c = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(rgb):
    return "#" + "".join(f"{int(v):02X}" for v in rgb)


def de2000(lab1, lab2):
    """CIEDE2000 between every row of lab1 (N,3) and lab2 (M,3) -> (N,M)."""
    a = np.asarray(lab1, dtype=np.float64)[:, None, :]
    b = np.asarray(lab2, dtype=np.float64)[None, :, :]
    L1, a1, b1 = a[..., 0], a[..., 1], a[..., 2]
    L2, a2, b2 = b[..., 0], b[..., 1], b[..., 2]
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    prod = C1p * C2p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(prod == 0, 0, dh)
    dH = 2 * np.sqrt(prod) * np.sin(np.radians(dh) / 2)
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hs = h1p + h2p
    hb = np.where(np.abs(h1p - h2p) > 180, np.where(hs < 360, hs + 360, hs - 360), hs) / 2
    hb = np.where(prod == 0, hs, hb)
    T = (1 - 0.17 * np.cos(np.radians(hb - 30)) + 0.24 * np.cos(np.radians(2 * hb))
         + 0.32 * np.cos(np.radians(3 * hb + 6)) - 0.2 * np.cos(np.radians(4 * hb - 63)))
    dTh = 30 * np.exp(-(((hb - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / np.sqrt(20 + (Lb - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dTh)) * Rc
    return np.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def app_names():
    """The app's 101 names: 11 basics + 90 unit colors, from data/colors.js."""
    src = (ROOT / "data" / "colors.js").read_text()
    out = re.findall(r'\["([^"]+)","(#[0-9A-Fa-f]{6})"\]', src)
    out += re.findall(r'\{n:"([^"]+)", h:"(#[0-9A-Fa-f]{6})"', src)
    return [(n, h.upper()) for n, h in out]


# ---------------------------------------------------------------------------------------------
# Color families: a rule on CIE LCh (L* lightness 0-100, C* chroma, h hue angle in degrees, all from CIELAB D65).
# Hue bands were set on the hue angles of the app's own colors (sRGB pure blue sits at h=306 in CIELAB, so the
# blue/purple line is 305, not 270). Browns are dark or dull versions of the warm hues, which is what brown is.
# ---------------------------------------------------------------------------------------------
FAMILIES = ["Reds", "Oranges", "Yellows", "Greens", "Blues", "Purples", "Pinks", "Browns", "Neutrals"]
FAMILY_RULE = [
    "Neutrals: C* < 10 (greys, black, white); or L* < 20 and C* < 15 (near-blacks); or L* > 90 and C* < 25 (off-whites such as cream and ivory).",
    "Otherwise by hue angle h: Pinks/Reds 348-20, Reds 20-45, Oranges 45-78, Yellows 78-100, Greens 100-180, Blues 180-305, Purples 305-348.",
    "Browns: dark warm colors (L* < 50) that are not saturated: h 37-100 with C* < 1.5 x L* (sienna, umber, chocolate, mahogany), or h 348-37 with C* < 0.8 x L* (a dark clear red such as brick red stays Reds).",
    "Browns also: h 45-100 with L* >= 50 and C* < 32 (C* < 25 when L* >= 80): tan, camel, beige, taupe; and h 20-45 with L* 50-65 and C* < 25 (rosy browns).",
    "Warm hues that are neither: h 348-20 is Pinks if L* >= 50, else Reds; h 20-45 is Pinks if L* >= 65 (salmon, baby pink), else Reds.",
]


def family(L, C, h):
    if C < 10 or (L < 20 and C < 15) or (L > 90 and C < 25):
        return "Neutrals"
    if L < 50:
        if (h >= 348 or h < 37) and C < 0.8 * L:  # dark and dull on the red side: brown; dark and clear: red
            return "Browns"
        if 37 <= h < 100 and C < 1.5 * L:  # dark orange-reds, oranges and yellows: brown unless very saturated
            return "Browns"
    if h >= 348 or h < 20:
        return "Pinks" if L >= 50 else "Reds"
    if h < 45:
        if L >= 65:
            return "Pinks"
        if L >= 50 and C < 25:
            return "Browns"
        return "Reds"
    if h < 100:
        if L >= 50 and C < (25 if L >= 80 else 32):
            return "Browns"
        return "Oranges" if h < 78 else "Yellows"
    if h < 180:
        return "Greens"
    if h < 305:
        return "Blues"
    return "Purples"


def lch(lab):
    lab = np.asarray(lab, dtype=np.float64)
    return lab[..., 0], np.hypot(lab[..., 1], lab[..., 2]), np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360


# ---------------------------------------------------------------------------------------------
# Step 3: palettes
# ---------------------------------------------------------------------------------------------
def autotrim(a, max_frac=0.08, tol=6.0, step=12.0):
    """Edge rows/columns that are near-uniform, close to the outermost line, and end in a clear step to the
    picture (frame, mat, scanner bed). The step test keeps a dark painted background from being eaten: it is
    near-uniform too, but it fades into the picture instead of stopping at an edge."""
    h, w, _ = a.shape

    def scan(lines, limit):
        ref = lines[0].mean(0)
        n = 0
        for line in lines[:limit]:
            if line.std(0).mean() < tol and np.abs(line.mean(0) - ref).mean() < tol:
                n += 1
            else:
                break
        if n == 0 or n + 3 > len(lines):
            return 0
        band = np.mean([ln.mean(0) for ln in lines[:n]], 0)
        inner = np.mean([ln.mean(0) for ln in lines[n:n + 3]], 0)
        return n if np.abs(band - inner).mean() > step else 0

    t = scan([a[i] for i in range(h)], int(h * max_frac))
    b = scan([a[h - 1 - i] for i in range(h)], int(h * max_frac))
    l = scan([a[:, i] for i in range(w)], int(w * max_frac))
    r = scan([a[:, w - 1 - i] for i in range(w)], int(w * max_frac))
    return (l, t, r, b)


def kmeans(X, k, restarts=4, iters=60, seed=1):
    """Lloyd k-means with k-means++ seeding; best of `restarts` by inertia."""
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(restarts):
        C = [X[rng.integers(len(X))]]
        for _ in range(1, k):
            d = np.min(((X[:, None, :] - np.array(C)[None]) ** 2).sum(-1), 1)
            C.append(X[rng.choice(len(X), p=d / d.sum())] if d.sum() > 0 else X[rng.integers(len(X))])
        C = np.array(C)
        for _ in range(iters):
            lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
            newC = np.array([X[lab == j].mean(0) if np.any(lab == j) else C[j] for j in range(k)])
            if np.abs(newC - C).max() < 1e-3:
                C = newC
                break
            C = newC
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        inertia = d.min(1).sum()
        if best is None or inertia < best[0]:
            best = (inertia, lab)
    return best[1]


def backdrop_mask(X, h, w, tol=4.5, ring_min=0.8, max_frac=0.5):
    """Shaped panels (arched tops, ovals, lockets, fragments) are photographed on a plain grey or black backdrop that
    fills the corners. Mask the pixels connected to the edge that match that backdrop (dE76 < `tol`), but only when
    the edge ring is (a) neutral (C* < 5), (b) mostly one color (80% within tol, median dE < 2) and (c) flat in all
    four corners (mean dE to the corner mean < 1.5). Painted backgrounds that reach the edge fail (b) or (c): they
    are textured and drift, where a photographer's backdrop is flat. Returns a boolean mask (True = backdrop) or None."""
    Lab = X.reshape(h, w, 3)
    ring = np.concatenate([Lab[0], Lab[-1], Lab[1:-1, 0], Lab[1:-1, -1]])
    med = np.median(ring, 0)
    if np.hypot(med[1], med[2]) >= 5:
        return None
    dring = np.sqrt(((ring - med) ** 2).sum(-1))
    if np.median(dring) >= 2.0 or (dring < tol).mean() < ring_min:
        return None
    c = max(3, min(h, w) // 25)
    for patch in (Lab[:c, :c], Lab[:c, -c:], Lab[-c:, :c], Lab[-c:, -c:]):
        if np.sqrt(((patch - patch.mean((0, 1))) ** 2).sum(-1)).mean() >= 1.5:
            return None
    near = np.sqrt(((Lab - med) ** 2).sum(-1)) < tol
    reach = np.zeros_like(near)
    reach[0], reach[-1], reach[:, 0], reach[:, -1] = near[0], near[-1], near[:, 0], near[:, -1]
    while True:
        grow = reach.copy()
        grow[1:] |= reach[:-1]; grow[:-1] |= reach[1:]; grow[:, 1:] |= reach[:, :-1]; grow[:, :-1] |= reach[:, 1:]
        grow &= near
        if (grow == reach).all():
            break
        reach = grow
    frac = reach.mean()
    if frac < 0.005 or frac > max_frac:
        return None
    return reach.reshape(-1)


def palette_of(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float64)
    l, t, r, b = autotrim(a)
    h, w = a.shape[:2]
    # then a 2% inset on every side: photographs often keep a sliver of frame, tape or shadow at the very edge
    il, it = round((w - l - r) * 0.02), round((h - t - b) * 0.02)
    box = (l + il, t + it, w - r - il, h - b - it)
    if box[2] - box[0] < 20 or box[3] - box[1] < 8:
        box = (0, 0, w, h)
    im = im.crop(box)
    s = K_SIDE / max(im.size)
    if s < 1:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BOX)
    px = np.asarray(im, dtype=np.float64).reshape(-1, 3)
    X = rgb_to_lab(px)
    bg = backdrop_mask(X, im.height, im.width)
    if bg is not None:
        X = X[~bg]
    lab = kmeans(X * np.array([1, CHROMA_W, CHROMA_W]), K)
    counts = np.bincount(lab, minlength=K)
    order = [j for j in np.argsort(-counts) if counts[j] > 0]
    cent = np.array([X[lab == j].mean(0) for j in order])
    shares = counts[order] / counts.sum()
    Lp, Cp, _ = lch(X)
    return dict(lab=np.round(cent, 2).tolist(), share=np.round(shares, 4).tolist(),
                L=round(float(Lp.mean()), 2), C=round(float(Cp.mean()), 2),
                size=[im.width, im.height], trim=[l, t, r, b], bg=round(float(bg.mean()), 3) if bg is not None else 0)


def _palette_job(args):
    key, path = args
    try:
        return key, palette_of(path), None
    except Exception as e:  # a broken image is reported and skipped
        return key, None, str(e)


def run_palettes(workers=6):
    done = {}
    if PAL_CACHE.exists():
        for line in PAL_CACHE.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                done[r["key"]] = r
    jobs = []
    for src in SRC:
        for x in select(src, load_meta(src)["rows"]):
            key = f"{src}-{x['id']}"
            p = img_path(src, x["id"])
            if key not in done and p.exists():
                jobs.append((key, str(p)))
    print(f"palettes: {len(done)} cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    t0 = time.time()
    with Pool(workers) as pool, PAL_CACHE.open("a") as f:
        for i, (key, res, err) in enumerate(pool.imap_unordered(_palette_job, jobs, chunksize=8)):
            if err:
                print(f"   {key}: {err}", flush=True)
                continue
            res["key"] = key
            f.write(json.dumps(res) + "\n")
            if i % 250 == 0:
                f.flush()
                print(f"palettes {i + 1}/{len(jobs)}  {time.time() - t0:.0f}s", flush=True)


def load_palettes():
    out = {}
    if PAL_CACHE.exists():
        for line in PAL_CACHE.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


# ---------------------------------------------------------------------------------------------
# Step 4a: metadata normalization
# ---------------------------------------------------------------------------------------------
# Country = the modern country of the place a work was made. AIC's place_of_origin mixes countries, regions and
# towns ("Paris", "Rajasthan", "Prouts Neck"); CMA's culture field is "Country, region/period, ..." and only its
# first term is used. Historic names go to today's country: Holland -> Netherlands, Flanders -> Belgium,
# England/Scotland -> United Kingdom. Tibet stays its own region, as both museums list it. A place that names two
# candidates ("Japan ... or Korea") or no country (Byzantium, Central Asia, "Middle East") gets no country.
US_PLACES = ("america|united states|philadelphia|new york|lancaster|roxbury|massachusetts|long island|boston|"
             "new england|florida|new hampshire|newport|bennington|gloucester|prouts neck|connecticut|virginia|"
             "new jersey|nantucket|niagara|ipswich|wyoming|pennsylvania|baltimore|york harbor|saint louis|montana|"
             "greenwich|\\bbath\\b|new mexico|ohio|cleveland")
COUNTRY_RULES = [(re.compile(p, re.I), c) for p, c in [
    (r"sino-tibet|byzant|central asia|middle east|^islamic", None),
    (r"tibet", "Tibet"), (r"nepal", "Nepal"),
    (r"\bindia|mughal|rajasthan|rajput|deccan|bengal|kalighat|pahari|gujarat|lucknow|murshidabad|avadh|bundi|"
     r"jodhpur|jaipur|\bkota\b|andhra|tanjore|sultanate|bihar|odisha|orissa|malwa|kashmir|punjab|golconda|bijapur|"
     r"patna|jatoli|raghogarh",
     "India"),
    (r"japan|\bueno\b", "Japan"), (r"korea", "Korea"), (r"china|chinese|guangdong", "China"),
    (r"mongolia", "Mongolia"), (r"\biran|persia|shiraz|isfahan", "Iran"), (r"bukhara", "Uzbekistan"),
    (r"afghanistan|herat", "Afghanistan"), (r"pakistan|lahore", "Pakistan"), (r"sri lanka", "Sri Lanka"),
    (r"egypt", "Egypt"),
    (r"south(ern)? netherlands|flanders|flemish|bruges|belgi", "Belgium"),
    (r"netherland|holland|dutch|delft|dordrecht|haarlem", "Netherlands"),
    (r"england|english|scotland|scottish|wales|welsh|united kingdom|britain|british|britisk|london", "United Kingdom"),
    (r"ireland|irish", "Ireland"),
    (r"france|french|paris|provence|brittany|giverny|trouville|saint-r[eé]my|lyon", "France"),
    (r"ital|venice|florence|\brome\b|genoa|naples|bologna|feltre|frascati|umbria|siena|tuscan|milan|pisa|padua|"
     r"cremona|bergamo|pompeii", "Italy"),
    (r"german|munich|bavaria|rhine|nuremberg|cologne", "Germany"),
    (r"spain|spanish|seville|catalonia|valencia", "Spain"),
    (r"austria|salzburg|styria", "Austria"), (r"switzerland|swiss", "Switzerland"), (r"hungar", "Hungary"),
    (r"denmark|danish", "Denmark"), (r"sweden|swedish", "Sweden"), (r"norw", "Norway"), (r"finland|finnish", "Finland"),
    (r"russia", "Russia"), (r"greece|greek|kr[ií]ti|crete|corfu|cretan", "Greece"),
    (r"ethiopia|gond[aä]r", "Ethiopia"), (r"algeria", "Algeria"), (r"australia", "Australia"),
    (r"mexico|mexican|teotihuac", "Mexico"), (r"peru", "Peru"), (r"guatemal", "Guatemala"),
    # added with the Met, NGA, Rijksmuseum and SMK: nationalities and places none of the first two museums used
    (r"poland|polish|krak[oó]w|warsaw", "Poland"), (r"czech|bohemia|prague", "Czechia"),
    (r"portug|lisbon", "Portugal"), (r"canad", "Canada"), (r"turkey|turkish|ottoman|istanbul", "Turkey"),
    (r"argentin", "Argentina"), (r"brazil", "Brazil"), (r"cuba", "Cuba"), (r"ecuador|quito", "Ecuador"),
    (r"bolivia|potos[ií]", "Bolivia"), (r"colombia|bogot", "Colombia"), (r"estonia", "Estonia"),
    (r"latvia", "Latvia"), (r"iceland", "Iceland"), (r"croatia|dalmatia", "Croatia"), (r"sloven", "Slovenia"),
    (r"romania", "Romania"), (r"ukrain", "Ukraine"), (r"luxemb", "Luxembourg"),
    (US_PLACES, "United States"),
]]
UNMAPPED = Counter()


def country_of(text):
    if not text:
        return None
    for rx, c in COUNTRY_RULES:
        if rx.search(text):
            return c
    return None


def country_aic(place):
    c = country_of(place)
    if c is None and place:
        UNMAPPED[place] += 1
    return c


def country_cma(culture):
    if not culture:
        return None
    parts = re.split(r";?\s+or\s+", culture[0])
    found = set()
    for part in parts:
        part = re.sub(r"\?|\b(possibly|probably)\b", "", part, flags=re.I)
        bare = re.split(r"[,.;]", re.sub(r"\(.*?\)", "", part))[0].strip()  # "Russia (worked in France)" -> Russia
        # "Roman Empire (Egypt)" -> Egypt; "Africa, East Africa, Ethiopia" -> Ethiopia
        found.add(country_of(bare) or country_of(re.split(r"[,.;]", part)[0]) or country_of(part))
    found.discard(None)  # "China, Yuan or early Ming dynasty": the part without a place adds nothing
    if len(found) != 1:
        UNMAPPED[culture[0]] += 1
        return None
    return found.pop()


# Movement = AIC's style_title when it names an art movement or school (not a century, culture or country), plus
# the painting schools CMA states in its culture field (Mughal, Rajput, Pahari, Kalighat, Company School).
AIC_STYLE = {"Impressionism": "Impressionism", "Post-Impressionism": "Post-Impressionism", "Realism": "Realism",
             "Renaissance": "Renaissance", "Folk Art": "Folk art", "Modernism": "Modernism",
             "Neoclassicism": "Neoclassicism", "Barbizon School": "Barbizon School", "Baroque": "Baroque",
             "Mannerism": "Mannerism", "Hudson River School": "Hudson River School", "Pre-Raphaelite": "Pre-Raphaelite",
             "Pointillism": "Pointillism", "synthetist": "Synthetism", "mughal": "Mughal"}
CMA_SCHOOL = [(re.compile(p, re.I), m) for p, m in [
    (r"pahari", "Pahari"), (r"kalighat", "Kalighat"), (r"company school", "Company School"), (r"mughal", "Mughal"),
    (r"rajput", "Rajput")]]

GENERIC_WORDS = set("""mughal english dutch spanish teotihuacan russian tuscan german french italian islamic venetian
netherlandish flemish roman austrian bolognese genoese cretan belgian british lakota tibeto chinese cheyenne chancay
ancient egyptian american japanese korean indian persian unknown anonymous artist unidentified school of the north
south northern southern central umbrian sienese florentine lombard neapolitan portuguese swiss himalayan tibetan
nepalese byzantine european asian eastern western mediterranean anoniem onbekend ubekendt ukendt anonym unbekannt
inconnu anonimo danish""".split())


def clean_artist(name):
    if not name:
        return None
    name = re.sub(r",?\s+R\.A\.$", "", re.sub(r"\s+", " ", name).strip())  # "Richard Cosway, R.A."
    toks = [t for t in re.split(r"[\s\-]+", name.lower()) if t]
    if not toks or all(t in GENERIC_WORDS for t in toks):
        return None
    if museum_common.NOT_BY.match(name):  # "After Jean Baptiste Joseph Pater", "Workshop of ...": not by that artist
        return None
    return name


def artist_key(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def clean_title(t, n=90):
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[:n - 1].rstrip(" ,;:") + "…"


def year_cma(x):
    text = x.get("creation_date") or ""
    e, l = x.get("creation_date_earliest"), x.get("creation_date_latest")
    span = (l - e) if (e is not None and l is not None) else None
    if "BCE" in text or "B.C." in text:
        return e, span
    m = re.match(r"^\s*(?:c\.|ca\.|about|circa)?\s*(\d{3,4})(?!\d)", text)
    return (int(m.group(1)) if m else e), span


def norm_record(src, x):
    if src in ADAPTERS:
        return ADAPTERS[src].norm(THIS, x)
    if src == "aic":
        y = x.get("date_start")
        span = (x["date_end"] - x["date_start"]) if x.get("date_end") is not None and y is not None else None
        style = AIC_STYLE.get(x.get("style_title") or "")
        if not style and (x.get("artist_title") or "") == "Mughal":
            style = "Mughal"
        return dict(id=f"aic-{x['id']}", src="aic", t=clean_title(x.get("title")), a=clean_artist(x.get("artist_title")),
                    y=y, span=span, co=country_aic(x.get("place_of_origin")), mv=style,
                    img=aic_iiif(x["image_id"], 400))
    cr = x.get("creators") or []
    artist = clean_artist(re.split(r" \(", cr[0]["description"])[0]) if cr and cr[0].get("description") else None
    y, span = year_cma(x)
    culture = " ".join(x.get("culture") or [])
    mv = next((m for rx, m in CMA_SCHOOL if rx.search(culture)), None)
    return dict(id=f"cma-{x['id']}", src="cma", t=clean_title(x.get("title")), a=artist, y=y, span=span,
                co=country_cma(x.get("culture")), mv=mv, img=((x.get("images") or {}).get("web") or {}).get("url"))


def century_key(y):
    return "BCE" if y < 0 else f"{y // 100 * 100}s"


def century_label(y):
    if y < 0:
        return "BCE"
    c = y // 100 + 1
    suf = "th" if 10 <= c % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(c % 10, "th")
    return f"{c}{suf} century"


# ---------------------------------------------------------------------------------------------
# Step 4b: corpus rows and statistics
# ---------------------------------------------------------------------------------------------
BASIC_HEX = {"Reds": "Red", "Oranges": "Orange", "Yellows": "Yellow", "Greens": "Green", "Blues": "Blue",
             "Purples": "Purple", "Pinks": "Pink", "Browns": "Brown", "Neutrals": "Grey"}
MIN_N = dict(century=10, decade=25, country=25, movement=20, artist=6)
DECADE_SPAN, CENTURY_SPAN = 20, 100  # a work dated to a wider range is left out of decade / century tables


# Some museums still show an old black-and-white photograph for a painting (SMK for over a third of its paintings,
# the Art Institute for about 120). Such an image has mean chroma C* of exactly 0; a real grisaille or a faded ink
# painting still has a tint (C* >= 1). Rows under BW_C are left out.
BW_C = 0.6
BW_DROPPED = Counter()


def build_rows():
    BW_DROPPED.clear()
    app = app_names()
    app_lab = rgb_to_lab(np.array([hex_to_rgb(h) for _, h in app]))
    pals = load_palettes()
    rows = []
    for src in SRC:
        for x in select(src, load_meta(src)["rows"]):
            key = f"{src}-{x['id']}"
            if key not in pals:
                continue
            p = pals[key]
            if p["C"] < BW_C:  # a black-and-white photograph of a painting: its colors are not the painting's
                BW_DROPPED[src] += 1
                continue
            r = norm_record(src, x)
            rgbs = lab_to_rgb(np.array(p["lab"]))
            exact = rgb_to_lab(rgbs)  # Lab of the rounded hex, so names match what the app shows
            V = de2000(exact, app_lab).argmin(1)
            Ls, Cs, Hs = lch(exact)
            shares = [round(s, 3) for s in p["share"]]
            shares[0] = round(shares[0] + 1 - sum(shares), 3)
            r["p"] = [[rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], family(Ls[i], Cs[i], Hs[i])]
                      for i in range(len(shares))]
            r["_lab"] = exact
            r["_share"] = np.array(p["share"])
            r["L"], r["C"] = round(p["L"], 1), round(p["C"], 1)
            rows.append(r)
    merge_artists(rows)
    rows = dedupe(rows)
    rows = cap_artists(rows)
    rows.sort(key=lambda r: (r["y"] if r["y"] is not None else 99999, r["id"]))
    return rows, app


def merge_artists(rows):
    """One display name per artist across museums ("Paul Cezanne" / "Paul Cézanne"; the Met's "Rembrandt (Rembrandt
    van Rijn)" joins "Rembrandt van Rijn" when another museum writes it that way): the most used spelling, preferring
    a name without brackets, ties to the one with diacritics."""
    spell = defaultdict(Counter)
    for r in rows:
        if r["a"]:
            spell[artist_key(r["a"])][r["a"]] += 1
    alias = {}
    for k, c in spell.items():
        m = re.match(r"^(.*?)\s*\((.+)\)\s*$", c.most_common(1)[0][0])
        if m:
            for part in (m.group(2), m.group(1)):
                pk = artist_key(part)
                if pk != k and pk in spell:
                    alias[k] = pk
                    break
    merged = defaultdict(Counter)
    for k, c in spell.items():
        merged[alias.get(k, k)].update(c)
    best = {k: max(c, key=lambda n: ("(" not in n, c[n], sum(ord(ch) > 127 for ch in n))) for k, c in merged.items()}
    for r in rows:
        if r["a"]:
            k = artist_key(r["a"])
            r["a"] = best[alias.get(k, k)]


# Near-duplicates: the same picture catalogued twice, or a replica photographed like its original. Found with a 64-bit
# difference hash (dHash) of each cached image: a pair is a duplicate when the hashes differ in at most DUP_BITS_ANY
# bits, or in at most DUP_BITS_TITLE bits and the titles share most words; and in both cases mean L* and C* differ by
# under 3. The copy from the source listed first in SRC (then the lower id) is kept. Pairs go to research/_raw/dups.tsv.
DUP_BITS_ANY, DUP_BITS_TITLE = 2, 6
STOP = set("a an the of and in with on at to de la le les du des van der den het een".split())


def dhash(path):
    im = Image.open(path).convert("L")
    w, h = im.size
    im = im.crop((round(w * .03), round(h * .03), w - round(w * .03), h - round(h * .03))).resize((9, 8), Image.BOX)
    a = np.asarray(im, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def load_hashes(rows):
    have = {}
    if HASH_CACHE.exists():
        for line in HASH_CACHE.read_text().splitlines():
            if line.strip():
                d = json.loads(line)
                have[d["key"]] = d["h"]
    new = [r for r in rows if r["id"] not in have]
    if new:
        with HASH_CACHE.open("a") as f:
            for r in new:
                src, rid = r["id"].split("-", 1)
                try:
                    have[r["id"]] = dhash(img_path(src, rid))
                except Exception:
                    have[r["id"]] = 0
                f.write(json.dumps(dict(key=r["id"], h=have[r["id"]])) + "\n")
    return have


DUP_DE = 5.0  # and the middle 70% of the two pictures, at 12x12, differs by under this mean dE76 (two lockets in
              # the same gilt frame on the same backdrop hash alike; their sitters do not)


def center_de(a, b):
    def thumb(r):
        src, rid = r["id"].split("-", 1)
        im = Image.open(img_path(src, rid)).convert("RGB")
        w, h = im.size
        im = im.crop((round(w * .15), round(h * .15), round(w * .85), round(h * .85))).resize((12, 12), Image.BOX)
        return rgb_to_lab(np.asarray(im, dtype=np.float64).reshape(-1, 3))
    try:
        return float(np.sqrt(((thumb(a) - thumb(b)) ** 2).sum(-1)).mean())
    except Exception:
        return 99.0


def title_words(t):
    return {w for w in re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore")
                                     .decode().lower()) if w not in STOP}


def dedupe(rows):
    hashes = load_hashes(rows)
    rank = {s: i for i, s in enumerate(SRC)}
    order = sorted(rows, key=lambda r: (rank[r["src"]], r["id"]))
    H = np.array([hashes[r["id"]] for r in order], dtype=np.uint64)
    drop, pairs, seen = set(), [], {}
    for r in order:
        if r["img"] in seen:
            drop.add(r["id"])
            pairs.append((seen[r["img"]], r, 0, "same image URL"))
        else:
            seen[r["img"]] = r
    for s in range(0, len(order), 1000):
        X = np.bitwise_count(H[s:s + 1000, None] ^ H[None, :])
        for i, j in zip(*np.nonzero(X <= DUP_BITS_TITLE)):
            a, b = order[s + i], order[j]
            if j <= s + i or b["id"] in drop or a["id"] in drop or hashes[a["id"]] == 0:
                continue
            if abs(a["L"] - b["L"]) >= 3 or abs(a["C"] - b["C"]) >= 3:
                continue
            bits = int(X[i, j])
            ta, tb = title_words(a["t"]), title_words(b["t"])
            similar = bool(ta and tb) and len(ta & tb) / len(ta | tb) >= 0.6
            if (bits <= DUP_BITS_ANY or similar) and (d := center_de(a, b)) < DUP_DE:
                drop.add(b["id"])
                pairs.append((a, b, bits, ("titles alike" if similar else "same picture") + f", center dE {d:.1f}"))
    with (RAW / "dups.tsv").open("w") as f:
        for a, b, bits, why in pairs:
            f.write(f"{a['id']}\t{b['id']}\t{bits}\t{why}\t{a['t']}\t{b['t']}\n")
    print(f"near-duplicates dropped: {len(drop)} (list in research/_raw/dups.tsv)")
    return [r for r in rows if r["id"] not in drop]


# One artist keeps at most ARTIST_CAP paintings, spread evenly over the artist's dated works (sorted by year, then id),
# so a museum that owns hundreds of one painter's sketches cannot outweigh a country or a decade.
ARTIST_CAP = 50
# painters whose range is the point of the archive get a larger cap (still spread evenly over their dated works): Sargent's
# bright watercolors and plein-air oils (tools/sargent_extra.py) would otherwise be thinned back to the dark portraits
ARTIST_CAP_EXTRA = {"John Singer Sargent": 300}
CAPPED = {}


def cap_artists(rows):
    by = defaultdict(list)
    for r in rows:
        if r["a"]:
            by[r["a"]].append(r)
    drop = set()
    CAPPED.clear()
    for a, rs in by.items():
        cap = ARTIST_CAP_EXTRA.get(a, ARTIST_CAP)
        if len(rs) > cap:
            rs = sorted(rs, key=lambda r: (r["y"] if r["y"] is not None else 99999, r["id"]))
            keep = {rs[i]["id"] for i in np.linspace(0, len(rs) - 1, cap).round().astype(int)}
            drop.update(r["id"] for r in rs if r["id"] not in keep)
            CAPPED[a] = len(rs)
    if CAPPED:
        print(f"artists capped at {ARTIST_CAP}: " + ", ".join(f"{a} ({n})" for a, n in
                                                               sorted(CAPPED.items(), key=lambda kv: -kv[1])))
    return [r for r in rows if r["id"] not in drop]


def fam_vec(r):
    v = dict.fromkeys(FAMILIES, 0.0)
    for _, s, _, f in r["p"]:
        v[f] += s
    return v


def vocab_shares(rs):
    voc = Counter()
    for r in rs:
        for _, s, v, _ in r["p"]:
            voc[v] += s / len(rs)
    return voc


def aggregate(key, rs, app_hex, label=None, n_sample=6, base=None):
    n = len(rs)
    fam = {f: sum(fam_vec(r)[f] for r in rs) / n for f in FAMILIES}
    voc = vocab_shares(rs)
    top = [dict(vocab=v, h=app_hex[v], share=round(s, 3)) for v, s in voc.most_common(8)]
    # dist: the names this group uses more than the whole corpus does, ranked by share x ln(lift), among names with
    # at least 1% of the group's area and lift >= 1.25. "Which colors set Monet apart", next to "which he used most".
    dist = []
    if base:
        score = {v: s * math.log(s / base[v]) for v, s in voc.items() if s >= 0.01 and s >= 1.25 * base[v]}
        dist = [dict(vocab=v, h=app_hex[v], share=round(voc[v], 3), lift=round(voc[v] / base[v], 1))
                for v in sorted(score, key=lambda v: -score[v])[:5]]
    # sample: the most typical paintings (family mix closest to the group's), preferring a named artist
    def gap(r):
        fv = fam_vec(r)
        return sum(abs(fv[f] - fam[f]) for f in FAMILIES) + (0 if r["a"] else 0.05)
    sample = [r["id"] for r in sorted(rs, key=lambda r: (gap(r), r["id"]))[:n_sample]]
    out = dict(key=key)
    if label:
        out["label"] = label
    out.update(n=n, fam={f: round(v, 3) for f, v in fam.items()}, top=top, dist=dist,
               L=round(float(np.mean([r["L"] for r in rs])), 1), C=round(float(np.mean([r["C"] for r in rs])), 1),
               sample=sample)
    return out


def group_by(rows, keyfn):
    g = defaultdict(list)
    for r in rows:
        k = keyfn(r)
        if k is not None:
            g[k].append(r)
    return g


def compute_stats(rows, app):
    app_hex = dict(app)
    base = vocab_shares(rows)
    by_c = group_by(rows, lambda r: century_key(r["y"]) if r["y"] is not None and (r["span"] or 0) <= CENTURY_SPAN else None)
    by_d = group_by(rows, lambda r: f"{r['y'] // 10 * 10}s" if r["y"] is not None and r["y"] >= 0 and (r["span"] or 0) <= DECADE_SPAN else None)
    by_co = group_by(rows, lambda r: r["co"])
    by_mv = group_by(rows, lambda r: r["mv"])
    by_a = group_by(rows, lambda r: r["a"])
    first_y = {k: min(r["y"] for r in v) for k, v in by_c.items()}
    century = [aggregate(k, v, app_hex, label=century_label(first_y[k]), base=base) for k, v in
               sorted(by_c.items(), key=lambda kv: first_y[kv[0]]) if len(v) >= MIN_N["century"]]
    decade = [aggregate(k, v, app_hex, base=base) for k, v in sorted(by_d.items(), key=lambda kv: int(kv[0][:-1]))
              if len(v) >= MIN_N["decade"]]
    country = [aggregate(k, v, app_hex, base=base) for k, v in sorted(by_co.items(), key=lambda kv: -len(kv[1]))
               if len(v) >= MIN_N["country"]]
    movement = [aggregate(k, v, app_hex, base=base) for k, v in sorted(by_mv.items(), key=lambda kv: -len(kv[1]))
                if len(v) >= MIN_N["movement"]]
    artist = []
    for k, v in sorted(by_a.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        if len(v) >= MIN_N["artist"]:
            a = aggregate(k, v, app_hex, base=base)
            ys = [r["y"] for r in v if r["y"] is not None]
            a["years"] = [min(ys), max(ys)] if ys else None
            artist.append(a)
    overall = aggregate("all", rows, app_hex)
    overall["top"] = [dict(vocab=v, h=app_hex[v], share=round(s, 4)) for v, s in base.most_common(20)]
    del overall["dist"]
    # the average color of each family across the corpus (area-weighted mean in CIELAB)
    acc = {f: [np.zeros(3), 0.0] for f in FAMILIES}
    for r in rows:
        for (h, s, v, f), lab, s_ in zip(r["p"], r["_lab"], r["_share"]):
            acc[f][0] += lab * s_
            acc[f][1] += s_
    fam_avg = {f: rgb_to_hex(lab_to_rgb(acc[f][0] / acc[f][1])) for f in FAMILIES if acc[f][1] > 0}
    return dict(families={f: app_hex[BASIC_HEX[f]] for f in FAMILIES}, familyAvg=fam_avg,
                byCentury=century, byDecade=decade, byCountry=country, byMovement=movement, byArtist=artist,
                overall=overall)


# ---------------------------------------------------------------------------------------------
# Step 4c: findings. Each one is computed from the rows, carries the numbers it rests on, and is dropped (with a
# warning) if a re-run makes its claim false. Filled in by findings() below.
# ---------------------------------------------------------------------------------------------
def boot_ci(vals_a, vals_b=None, n=2000, seed=7):
    """95% bootstrap interval of mean(a) (or of mean(a) - mean(b)), resampling paintings."""
    rng = np.random.default_rng(seed)
    a = np.asarray(vals_a, dtype=float)
    ma = a[rng.integers(0, len(a), (n, len(a)))].mean(1)
    if vals_b is None:
        d = ma
    else:
        b = np.asarray(vals_b, dtype=float)
        d = ma - b[rng.integers(0, len(b), (n, len(b)))].mean(1)
    return float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))


CAVEATS = [
    "Aged varnish yellows and darkens old paintings, so older works read warmer, browner and darker than they were painted.",
    "These are photographs of paintings, so screen color is approximate: lighting, camera profiles and museum editing all shift it.",
    "The collection reflects six museums' holdings (Chicago, Cleveland, the Met in New York, the National Gallery in Washington, the Rijksmuseum in Amsterdam and SMK in Copenhagen), not all of art history: what they bought, kept, and could put online as public domain. Four of the six are American, and the two European ones are national collections, so Dutch and Danish painting weigh more than their share of Europe.",
    "A palette is area-weighted: a large dull background counts for more than a small bright accent the eye goes to first.",
    "Every painting counts equally in a group average, whatever its size.",
    "Groups are only reported above a minimum size (century 10, decade 25, country 25, movement 20, artist 6), and small groups still swing on a few works.",
    "Dates are museum start dates; works dated more loosely than 20 years are left out of decades, more loosely than 100 years out of centuries.",
    "Hanging scrolls, albums and lockets are photographed with their mounts or frames where the museum did so; those count as part of the palette.",
]


EUROPE = {"France", "Italy", "United Kingdom", "Netherlands", "Germany", "Belgium", "Spain", "Austria", "Switzerland",
          "Denmark", "Sweden", "Norway", "Hungary", "Russia", "Ireland", "Finland", "Greece", "Poland", "Czechia",
          "Portugal", "Estonia", "Latvia", "Iceland", "Croatia", "Slovenia", "Romania", "Ukraine", "Luxembourg"}


CITY = dict(aic="Chicago", cma="Cleveland", met="New York", nga="Washington", rijks="Amsterdam", smk="Copenhagen")


def src_counts(rs):
    c = Counter(r["src"] for r in rs)
    return ", ".join(f"{c[s]} in {CITY[s]}" for s in SRC if c[s])


def pct(x):
    return "under 0.1%" if 0 < x < 0.0005 else f"{100 * x:.1f}%"


def findings(rows, stats):
    """Short, data-backed sentences. Each states its numbers and group sizes; a comparison is only kept when the
    95% bootstrap interval of the difference excludes zero, so a re-run on different data drops what no longer holds."""
    out, dropped = [], []
    eu = [r for r in rows if r["co"] in EUROPE]

    def cent(rs, c):
        return [r for r in rs if r["y"] is not None and (r["span"] or 0) <= CENTURY_SPAN and r["y"] // 100 * 100 == c]

    def dec(rs, d):
        return [r for r in rs if r["y"] is not None and (r["span"] or 0) <= DECADE_SPAN and r["y"] // 10 * 10 == d]

    def fam(rs, *fs):
        return [sum(fam_vec(r)[f] for f in fs) for r in rs]

    def L(rs):
        return [r["L"] for r in rs]

    def C(rs):
        return [r["C"] for r in rs]

    def add(fid, ok, text, numbers, caveat):
        (out if ok else dropped).append(dict(id=fid, text=text, numbers=numbers, caveat=caveat))

    def diff(a, b):
        lo, hi = boot_ci(a, b)
        return lo > 0 or hi < 0, [round(lo, 4), round(hi, 4)]

    # 1. What paintings are mostly made of
    ov = stats["overall"]
    fm = {f: float(np.mean(fam(rows, f))) for f in FAMILIES}  # unrounded (stats rounds to 3 decimals)
    fam_sorted = sorted(fm.items(), key=lambda kv: kv[1])
    earth = fm["Browns"] + fm["Neutrals"]
    add("earth-and-shadow", earth > 0.7 and {fam_sorted[0][0], fam_sorted[1][0]} == {"Purples", "Pinks"},
        f"Browns and neutrals (greys, blacks, whites) cover {pct(earth)} of the average painting's surface. "
        f"Purples ({pct(fm['Purples'])}) and pinks ({pct(fm['Pinks'])}) are the rarest families: "
        f"they appear as accents, almost never as large areas.",
        dict(browns=round(fm["Browns"], 4), neutrals=round(fm["Neutrals"], 4), purples=round(fm["Purples"], 5),
             pinks=round(fm["Pinks"], 5), n=ov["n"]),
        "Area-weighted: a small vivid accent barely moves these shares. Aged varnish pushes old pictures toward brown.")

    # 2. The single most common app color
    t0, t1 = ov["top"][0], ov["top"][1]
    add("top-name", True,
        f"The app color that covers the most painted area is {t0['vocab'].lower()} ({pct(t0['share'])} of the average "
        f"painting), followed by {t1['vocab'].lower()} ({pct(t1['share'])}).",
        dict(first=t0, second=t1, n=ov["n"]),
        "Each palette color takes the nearest of the app's 101 names, and most of those names are brighter than "
        "real paint, so muted colors pile onto the few muted names.")

    # 3. Europe lightens from the 1600s to the 1800s/1900s
    e16, e18, e19 = cent(eu, 1600), cent(eu, 1800), cent(eu, 1900)
    ok, ci = diff(L(e18), L(e16))
    add("europe-lightens", ok and np.mean(L(e18)) > np.mean(L(e16)),
        f"European paintings get lighter: mean lightness L* rises from {np.mean(L(e16)):.1f} in the 1600s to "
        f"{np.mean(L(e18)):.1f} in the 1800s and {np.mean(L(e19)):.1f} in the 1900s (0 = black, 100 = white).",
        dict(L1600s=round(np.mean(L(e16)), 1), L1800s=round(np.mean(L(e18)), 1), L1900s=round(np.mean(L(e19)), 1),
             n=[len(e16), len(e18), len(e19)], ci_1800_minus_1600=ci),
        "Old varnish and grime darken and yellow older pictures, so part of this gap is age, not the painter. "
        f"The 1900s group is small (n={len(e19)}), because few 20th-century works are public domain.")

    # 4. Blue in Europe by century
    b16, b18, b19 = np.mean(fam(e16, "Blues")), np.mean(fam(e18, "Blues")), np.mean(fam(e19, "Blues"))
    ok, ci = diff(fam(e19, "Blues"), fam(e16, "Blues"))
    add("europe-blues", ok and b19 > b18 > b16,
        f"Blue arrives late: blues cover {pct(b16)} of the average European painting from the 1600s, "
        f"{pct(b18)} in the 1800s and {pct(b19)} in the 1900s.",
        dict(blues1600s=round(b16, 4), blues1800s=round(b18, 4), blues1900s=round(b19, 4),
             n=[len(e16), len(e18), len(e19)], ci_1900_minus_1600=ci),
        "Yellowed varnish turns old blues green-grey, which hides some of the blue in older works. "
        f"The 1900s group is small (n={len(e19)}).")

    # 5. The Impressionist decades in France
    f60, f80 = dec([r for r in rows if r["co"] == "France"], 1860), dec([r for r in rows if r["co"] == "France"], 1880)
    ok_b, ci_b = diff(fam(f80, "Blues", "Greens"), fam(f60, "Blues", "Greens"))
    ok_l, ci_l = diff(L(f80), L(f60))
    add("france-1860s-1880s", ok_b and ok_l and np.mean(L(f80)) > np.mean(L(f60)),
        f"In French paintings, blues and greens together go from {pct(np.mean(fam(f60, 'Blues', 'Greens')))} of the "
        f"surface in the 1860s to {pct(np.mean(fam(f80, 'Blues', 'Greens')))} in the 1880s, and lightness from "
        f"{np.mean(L(f60)):.1f} to {np.mean(L(f80)):.1f}: the decades of open-air Impressionist landscape.",
        dict(bg1860s=round(np.mean(fam(f60, "Blues", "Greens")), 4), bg1880s=round(np.mean(fam(f80, "Blues", "Greens")), 4),
             L1860s=round(np.mean(L(f60)), 1), L1880s=round(np.mean(L(f80)), 1), n=[len(f60), len(f80)],
             ci_bluegreen=ci_b, ci_L=ci_l),
        "The American museums (Chicago, Cleveland, the Met, the National Gallery) collected French Impressionism "
        "heavily, so the 1880s sample leans to it. "
        f"Decade groups are modest (n={len(f60)} and {len(f80)}).")

    # 6. Impressionism vs Realism
    imp = [r for r in rows if r["mv"] == "Impressionism"]
    rea = [r for r in rows if r["mv"] == "Realism"]
    ok, ci = diff(L(imp), L(rea))
    ok2, ci2 = diff(fam(imp, "Blues"), fam(rea, "Blues"))
    add("impressionism-vs-realism", ok and ok2 and len(rea) >= MIN_N["movement"],
        f"Impressionist paintings average lightness {np.mean(L(imp)):.1f} and {pct(np.mean(fam(imp, 'Blues')))} blue; "
        f"Realist paintings, the generation before, average {np.mean(L(rea)):.1f} and {pct(np.mean(fam(rea, 'Blues')))}.",
        dict(L_imp=round(np.mean(L(imp)), 1), L_rea=round(np.mean(L(rea)), 1), blues_imp=round(np.mean(fam(imp, "Blues")), 4),
             blues_rea=round(np.mean(fam(rea, "Blues")), 4), n=[len(imp), len(rea)], ci_L=ci, ci_blues=ci2),
        f"Movement labels come only from the Art Institute's style field, so these are its works (n={len(imp)} and "
        f"{len(rea)}). Subject matters too: Impressionists painted more skies and water.")

    # 7. Monet's signature
    mon = [r for r in rows if r["a"] == "Claude Monet"]
    rest18 = [r for r in e18 if r["a"] != "Claude Monet"]
    if len(mon) >= MIN_N["artist"]:
        ok, ci = diff(fam(mon, "Blues"), fam(rest18, "Blues"))
        ok_l, ci_l = diff(L(mon), L(rest18))
        art = next(a for a in stats["byArtist"] if a["key"] == "Claude Monet")
        names = ", ".join(t["vocab"].lower() for t in art["top"][:4])
        extra = [t for t in art["dist"] if t["vocab"] not in [u["vocab"] for u in art["top"][:4]]][:2]
        dists = " and ".join(f"{t['vocab'].lower()} {t['lift']:.0f} times" for t in extra)
        add("monet", ok and ok_l and np.mean(fam(mon, "Blues")) > np.mean(fam(rest18, "Blues")),
            f"Monet's signature is cool and pale: blues cover {pct(np.mean(fam(mon, 'Blues')))} of his paintings against "
            f"{pct(np.mean(fam(rest18, 'Blues')))} for other European paintings of the 1800s, at lightness "
            f"{np.mean(L(mon)):.1f} against {np.mean(L(rest18)):.1f}. His most common app colors are {names}"
            + (f"; he uses {dists} as much as the average painting does." if extra else "."),
            dict(blues_monet=round(np.mean(fam(mon, "Blues")), 4), blues_others=round(np.mean(fam(rest18, "Blues")), 4),
                 L_monet=round(np.mean(L(mon)), 1), L_others=round(np.mean(L(rest18)), 1), n=[len(mon), len(rest18)],
                 ci_blues=ci, ci_L=ci_l, top=[t["vocab"] for t in art["top"][:4]],
                 dist=[[t["vocab"], t["lift"]] for t in extra]),
            f"{len(mon)} paintings ({src_counts(mon)}). A six-color palette averages his small broken strokes, so "
            "lilacs and pale blues come out as soft greys and slates.")

    # 8. Van Gogh's greens
    vg = [r for r in rows if r["a"] == "Vincent van Gogh"]
    if len(vg) >= MIN_N["artist"]:
        ok, ci = diff(fam(vg, "Greens"), fam(rest18, "Greens"))
        greenest = max(stats["byArtist"], key=lambda a: a["fam"]["Greens"])
        lead = (f"Van Gogh is the greenest of the {len(stats['byArtist'])} artists with at least {MIN_N['artist']} works"
                if greenest["key"] == "Vincent van Gogh" else "Van Gogh leans green")
        add("van-gogh", ok and np.mean(fam(vg, "Greens")) > np.mean(fam(rest18, "Greens")),
            f"{lead}: greens cover {pct(np.mean(fam(vg, 'Greens')))} of his "
            f"paintings, against {pct(np.mean(fam(rest18, 'Greens')))} for other European paintings of the 1800s.",
            dict(greens_vg=round(np.mean(fam(vg, "Greens")), 4), greens_others=round(np.mean(fam(rest18, "Greens")), 4),
                 n=[len(vg), len(rest18)], ci=ci),
            f"Only {len(vg)} paintings; a different handful could shift this.")

    # 9. Indian painting is the most saturated
    ind = [r for r in rows if r["co"] == "India"]
    ok, ci = diff(C(ind), C(eu))
    best_mv = max(stats["byMovement"], key=lambda m: m["C"])
    best_co = max(stats["byCountry"], key=lambda m: m["C"])
    add("india-saturated", ok and best_co["key"] == "India",
        f"Indian paintings are the most saturated country group: mean chroma C* {np.mean(C(ind)):.1f}, against "
        f"{np.mean(C(eu)):.1f} for European paintings. {best_mv['key']} court painting has the highest chroma of any "
        f"movement or school ({best_mv['C']:.1f}), with reds, oranges and yellows covering "
        f"{pct(best_mv['fam']['Reds'] + best_mv['fam']['Oranges'] + best_mv['fam']['Yellows'])} of the surface.",
        dict(C_india=round(np.mean(C(ind)), 1), C_europe=round(np.mean(C(eu)), 1), n=[len(ind), len(eu)], ci=ci,
             top_movement=best_mv["key"], C_top_movement=best_mv["C"]),
        "Gouache on paper, kept in albums away from light and never varnished, keeps its color far better than a "
        "varnished oil on canvas; this compares surviving surfaces, not intentions.")

    # 10. Chinese and Japanese paintings: light grounds, almost no blue
    chj = [r for r in rows if r["co"] in ("China", "Japan")]
    ok, ci = diff(L(chj), L(eu))
    blues_ch = np.mean(fam([r for r in rows if r["co"] == "China"], "Blues"))
    add("east-asia-light", ok and np.mean(L(chj)) > np.mean(L(eu)),
        f"Chinese and Japanese paintings are much lighter than European ones (lightness {np.mean(L(chj)):.1f} against "
        f"{np.mean(L(eu)):.1f}): ink and color on silk or paper leave most of the ground showing. Blue covers just "
        f"{pct(blues_ch)} of the average Chinese painting.",
        dict(L_china_japan=round(np.mean(L(chj)), 1), L_europe=round(np.mean(L(eu)), 1), blues_china=round(blues_ch, 4),
             n=[len(chj), len(eu)], ci=ci),
        "Silk and paper brown with age, and scroll mountings are often in the photograph, so these grounds read as "
        "tan and beige.")

    # 11. Gold grounds before 1500
    early = [r for r in eu if r["y"] is not None and r["y"] < 1500 and (r["span"] or 0) <= CENTURY_SPAN]
    ok, ci = diff(fam(early, "Oranges", "Yellows"), fam(e16, "Oranges", "Yellows"))
    add("gold-grounds", ok and np.mean(fam(early, "Oranges", "Yellows")) > np.mean(fam(e16, "Oranges", "Yellows")),
        f"Oranges and yellows cover {pct(np.mean(fam(early, 'Oranges', 'Yellows')))} of European paintings made "
        f"before 1500, the age of gold-leaf grounds, against {pct(np.mean(fam(e16, 'Oranges', 'Yellows')))} in the 1600s.",
        dict(oy_pre1500=round(np.mean(fam(early, "Oranges", "Yellows")), 4),
             oy_1600s=round(np.mean(fam(e16, "Oranges", "Yellows")), 4), n=[len(early), len(e16)], ci=ci),
        "Photographed gold reads as ochre, amber or brown depending on the light, so much of it lands in browns "
        "instead; not every early painting has a gold ground."
        + (f" The early group is small (n={len(early)})." if len(early) < 50 else ""))

    # 12. Neutrals: present in nearly every European painting, in far fewer Asian ones
    asia = [r for r in rows if r["co"] in ("India", "China", "Japan", "Korea", "Tibet", "Nepal", "Iran")]
    pe = float(np.mean([fam_vec(r)["Neutrals"] >= 0.05 for r in eu]))
    pa = float(np.mean([fam_vec(r)["Neutrals"] >= 0.05 for r in asia]))
    pab = float(np.mean([fam_vec(r)["Browns"] >= 0.05 for r in asia]))
    ok, ci = diff([fam_vec(r)["Neutrals"] >= 0.05 for r in eu], [fam_vec(r)["Neutrals"] >= 0.05 for r in asia])
    add("neutrals-presence", ok and pe > pa and pab > pa,
        f"{pct(pe)} of European paintings give at least 5% of their surface to neutrals (greys, blacks, whites), "
        f"against {pct(pa)} of Asian paintings. In Asian paintings browns and tans take that role: {pct(pab)} of "
        f"them have at least 5% brown.",
        dict(eu=round(pe, 3), asia=round(pa, 3), asia_browns=round(pab, 3), n=[len(eu), len(asia)], ci=ci),
        "Dark varnished backgrounds count as near-black here, whatever color they were painted.")

    # 13. Black: which country uses the most
    blk = sorted(stats["byCountry"], key=lambda c: -next((t["share"] for t in c["top"] if t["vocab"] == "Black"), 0))
    if blk:
        b0 = blk[0]
        share0 = next(t["share"] for t in b0["top"] if t["vocab"] == "Black")
        allb = next((t["share"] for t in stats["overall"]["top"] if t["vocab"] == "Black"), 0)
        grp = [r for r in rows if r["co"] == b0["key"]]
        others = [r for r in rows if r["co"] and r["co"] != b0["key"]]
        black = lambda rs: [sum(s for _, s, v, _ in r["p"] if v == "Black") for r in rs]
        ok, ci = diff(black(grp), black(others))
        cents = Counter(century_key(r["y"]) for r in grp if r["y"] is not None)
        top_c, top_n = cents.most_common(1)[0]
        name = ("the " if b0["key"] in ("Netherlands", "United States", "United Kingdom") else "") + b0["key"]
        add("black-country", ok and share0 > allb,
            f"{name[0].upper() + name[1:]} is the black country: the app color black covers {pct(share0)} of the "
            f"average painting made there, the most of any country, against {pct(allb)} across the whole collection.",
            dict(country=b0["key"], black=share0, black_all=allb, n=b0["n"], ci_vs_other_countries=ci,
                 main_century=top_c, main_century_share=round(top_n / len(grp), 3)),
            f"Dark grounds, deep shadow and darkened varnish all read as black. {pct(top_n / len(grp))} of these "
            f"paintings are from the {top_c}, so this is mostly a portrait of that century.")

    # 14. Darkest and lightest named painters (n >= MIN_N artist)
    arts = [a for a in stats["byArtist"]]
    if arts:
        dark, light = min(arts, key=lambda a: a["L"]), max(arts, key=lambda a: a["L"])
        add("darkest-lightest", True,
            f"Of the {len(arts)} artists with at least {MIN_N['artist']} works, the darkest is {dark['key']} (lightness "
            f"{dark['L']:.1f}, n={dark['n']}) and the lightest is {light['key']} ({light['L']:.1f}, n={light['n']}).",
            dict(darkest=dark["key"], L_dark=dark["L"], n_dark=dark["n"], lightest=light["key"], L_light=light["L"],
                 n_light=light["n"]),
            "Small groups; one museum's choice of works decides these extremes.")

    for d in dropped:
        print("finding dropped (claim not supported on this data):", d["id"], "|", d["text"][:100])
    return out


SHARD_LIMIT = 8_000_000   # bytes: above this the corpus is split into data/corpus/<src>-<n>.json
SHARD_SIZE = 2_500_000    # target bytes per shard


def corpus_files():
    one = ROOT / "data" / "corpus.json"
    return [one] if one.exists() else sorted((ROOT / "data" / "corpus").glob("*.json"))


def load_corpus():
    """Every corpus row, from data/corpus.json or, when the corpus is split, from every data/corpus/*.json shard."""
    return [r for f in corpus_files() for r in json.loads(f.read_text())]


def write_corpus(out_rows):
    """data/corpus.json when it fits under SHARD_LIMIT; otherwise shards by source, rows in id order, each about
    SHARD_SIZE bytes: data/corpus/aic-1.json, data/corpus/met-1.json, data/corpus/met-2.json ... Each file is a JSON
    array of rows in the same format. Stale files of the other shape are removed."""
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    dump = lambda rs: "[\n" + ",\n".join(line(r) for r in rs) + "\n]\n"
    one, shard_dir = ROOT / "data" / "corpus.json", ROOT / "data" / "corpus"
    whole = dump(out_rows)
    if len(whole.encode()) <= SHARD_LIMIT:
        one.write_text(whole)
        for p in shard_dir.glob("*.json"):
            p.unlink()
        return [one]
    shard_dir.mkdir(exist_ok=True)
    written = []
    idkey = lambda r: (r["id"].split("-", 1)[0], int(r["id"].split("-", 1)[1]) if r["id"].split("-", 1)[1].isdigit()
                       else 0, r["id"])
    for s in SRC:
        rs = sorted((r for r in out_rows if r["src"] == s), key=idkey)
        if not rs:
            continue
        size = sum(len(line(r).encode()) + 2 for r in rs)
        n = max(1, math.ceil(size / SHARD_SIZE))
        per = math.ceil(len(rs) / n)
        for k in range(n):
            p = shard_dir / f"{s}-{k + 1}.json"
            p.write_text(dump(rs[k * per:(k + 1) * per]))
            written.append(p)
    for p in shard_dir.glob("*.json"):
        if p not in written:
            p.unlink()
    if one.exists():
        one.unlink()
    return written


def write_outputs(rows, stats, finds, fetched):
    out_rows = []
    for r in rows:
        row = dict(id=r["id"], src=r["src"], t=r["t"], a=r["a"], y=r["y"], co=r["co"], mv=r["mv"],
                  img=r["img"], p=r["p"], L=r["L"], C=r["C"])
        if r.get("url"):  # a record's own page (only Commons sets this; other sources use gallery.py's SOURCES rec)
            row["url"] = r["url"]
        out_rows.append(row)
    files = write_corpus(out_rows)
    n_src = Counter(r["src"] for r in rows)
    meta = dict(
        sources=[dict(id=s, name=SRC[s]["name"], api=SRC[s]["api"], license=SRC[s]["license"], n=n_src[s],
                      fetched=fetched.get(s)) for s in SRC if n_src[s]],
        count=len(rows), built=date.today().isoformat(),
        files=[str(p.relative_to(ROOT)) for p in files],
        method=[
            "Public-domain paintings with an image from each museum's open API or open data. Manuscript text pages are dropped, one manuscript or album keeps at most %d leaves, near-duplicate images and black-and-white photographs (mean C* under %.1f) are dropped, and one artist keeps at most %d paintings, spread over the artist's dates." % (GROUP_CAP, BW_C, ARTIST_CAP),
            "Image: a 200px-wide copy (the Art Institute's 200px IIIF image; the other museums' ~400-900px images scaled down), near-uniform border bands trimmed, plus a 2% inset; a flat neutral photo backdrop around shaped panels and lockets is masked out.",
            "Palette: k-means (k=6) in CIELAB on a ~120px copy, a*/b* weighted 1.5x for clustering only; each color's share is its pixel area.",
            "Names: each palette color gets the nearest of the app's 101 color names by CIEDE2000. Families follow an LCh rule (familyRule).",
            "L and C: mean CIELAB lightness L* (0 black to 100 white) and mean chroma C* (0 grey; higher = more saturated) over every pixel.",
            "Group stats: the mean over paintings of each painting's area shares; top = the 8 app names with the largest mean share; sample = the paintings whose family mix is closest to the group's.",
        ],
        familyRule=FAMILY_RULE, minN=MIN_N, caveats=CAVEATS,
        fields=dict(id="source-id", src=" | ".join(SRC), t="title",
                    a="artist (null when the museum gives only a culture or 'unknown', or says workshop, follower or copy)",
                    y="year (start of the museum's date range)",
                    co="modern country where made (the Met, NGA and SMK: from the artist's nationality where no place is given; the Rijksmuseum: place of making, else catalogue, else birthplace)",
                    mv="movement or school, where stated",
                    img="display image URL (AIC, NGA, Rijksmuseum: IIIF 400px wide; SMK: IIIF 400px, or its fixed 1600px JPEG where it has no IIIF image; the Met: ~450px 'mobile-large' JPEG; CMA: ~900px web JPEG)",
                    p="palette: [hex, area share, nearest app name, family] x up to 6, largest first",
                    L="mean L*", C="mean C*"),
    )
    stats = dict(meta=meta, **stats, findings=finds)
    js = ("// ColorHub art-history color statistics. Generated by tools/corpus.py with the painting corpus "
          "(data/corpus.json or data/corpus/*.json); do not edit.\n"
          "window.STATS = " + json.dumps(stats, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (ROOT / "data" / "stats.js").write_text(js)
    for p in files + [ROOT / "data" / "stats.js"]:
        print(f"{p.relative_to(ROOT)}: {p.stat().st_size / 1e6:.2f} MB")


def build():
    rows, app = build_rows()
    stats = compute_stats(rows, app)
    finds = findings(rows, stats)
    fetched = {s: load_meta(s)["fetched"] for s in SRC}
    write_outputs(rows, stats, finds, fetched)
    if UNMAPPED:
        print("places with no country:", UNMAPPED.most_common(30))
    print(f"black-and-white photographs left out: {dict(BW_DROPPED)}")
    print(f"{len(rows)} paintings ({dict(Counter(r['src'] for r in rows))}); centuries {len(stats['byCentury'])}, decades {len(stats['byDecade'])}, "
          f"countries {len(stats['byCountry'])}, movements {len(stats['byMovement'])}, artists {len(stats['byArtist'])}, "
          f"findings {len(finds)}")
    return rows, stats, finds


# ---------------------------------------------------------------------------------------------
# Contact sheet for eyeballing: image | palette bars (share) | names and families
# ---------------------------------------------------------------------------------------------
def font(size):
    for f in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def contact_sheet(rows, path, n=10, seed=None, ids=None):
    pick = [r for r in rows if r["id"] in ids] if ids else random.Random(seed).sample(rows, n)
    f1, f2 = font(15), font(12)
    rh, W = 190, 1400
    sheet = Image.new("RGB", (W, rh * len(pick) + 10), "white")
    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(pick):
        y0 = i * rh + 8
        src, rid = r["id"].split("-", 1)
        im = Image.open(img_path(src, rid)).convert("RGB")
        s = (rh - 30) / im.height
        if im.width * s > 300:
            s = 300 / im.width
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        sheet.paste(im, (10, y0 + 22))
        d.text((10, y0), f"{r['id']}  {r['t'][:70]}  |  {r['a'] or '?'}, {r['y']}  |  {r['co'] or '?'}  |  "
                         f"{r['mv'] or ''}  L {r['L']}  C {r['C']}", fill="black", font=f1)
        x = 330
        for h, sh, v, f in r["p"]:
            w = max(4, round(1000 * sh))
            d.rectangle([x, y0 + 22, x + w - 2, y0 + 120], fill=h)
            if w > 60:
                d.text((x + 2, y0 + 124), v, fill="black", font=f2)
                d.text((x + 2, y0 + 139), f"{f} {sh:.2f}", fill="#555", font=f2)
                d.text((x + 2, y0 + 154), h, fill="#555", font=f2)
            x += w
    sheet.save(path)
    print("contact sheet:", path)


def fetch_meta(src, resume=False):
    if resume and load_meta(src).get("rows") and load_meta(src).get("complete", True):
        print(f"{src}: metadata cached ({len(load_meta(src)['rows'])} rows); --resume keeps it", flush=True)
        return
    if src == "aic":
        meta_aic()
    elif src == "cma":
        meta_cma()
    else:
        ADAPTERS[src].meta(THIS, resume)


def status():
    pals = load_palettes()
    for s in SRC:
        m = load_meta(s)
        rows = select(s, m["rows"]) if m["rows"] else []
        imgs = sum(img_path(s, x["id"]).exists() for x in rows)
        npal = sum(f"{s}-{x['id']}" in pals for x in rows)
        failed = SRC[s]["dir"] / "failed.json"
        nf = len(json.loads(failed.read_text())) if failed.exists() else 0
        print(f"{s:6} meta {'done' if m.get('complete', bool(m['rows'])) else 'partial'} {m.get('fetched')}: "
              f"{len(m['rows'])} rows, {len(rows)} selected, {imgs} images, {npal} palettes, {nf} image failures")


def main(argv):
    resume = "--resume" in argv
    argv = [a for a in argv if a != "--resume"]
    cmd = argv[0] if argv else "all"
    srcs = [s for s in argv[1:] if s in SRC] or list(SRC)
    if cmd in ("meta", "all", "fetch"):
        for s in srcs:
            fetch_meta(s, resume=resume)
    if cmd in ("images", "all", "fetch"):
        for s in srcs:
            download_images(s)
    if cmd in ("palettes", "all"):
        run_palettes()
    if cmd in ("build", "all"):
        build()
    if cmd == "status":
        status()
    if cmd == "sheet":
        n = int(argv[1]) if len(argv) > 1 else 10
        path = argv[2] if len(argv) > 2 else str(RAW / "corpus-contact.png")
        rows, _ = build_rows()
        if len(argv) > 4:
            rows = [r for r in rows if r["src"] == argv[4]]
        contact_sheet(rows, path, n=n, seed=int(argv[3]) if len(argv) > 3 else None)


if __name__ == "__main__":
    main(sys.argv[1:])
