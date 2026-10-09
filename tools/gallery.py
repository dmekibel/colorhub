#!/usr/bin/env python3
"""ColorHub painting gallery: every corpus painting, browsable and searchable by color. Read by js/gallery.js.

  python3 tools/gallery.py [--raw DIR] [--shard N]    # corpus + data/library.json -> data/gallery/

Safe to re-run: it rewrites data/gallery/ from scratch from whatever corpus exists.

Input
  data/corpus.json and/or data/corpus/*.json (tools/corpus.py and its museum expansions): one record per painting,
    {id: "<src>-<museum id>", src, t title, a artist|null, y year|null, co country|null, mv movement|null,
     img image URL, p [[hex, share, app name, family] x 6], L, C, optional url (museum record page)}.
    A record id that appears twice is kept once (first file wins).
  data/library.json (tools/library.py): ~2,700 named colors.
  Image size for the layout (h/w): research/_raw/<src>/meta.json for aic and cma (gitignored; --raw points elsewhere,
    e.g. the main checkout when running in a worktree), else a record's own `r` (h/w) or `w` and `h`. A painting
    without a known size gets a 4:5 box.

Per palette color it adds the most precise library name, picked with tools/library.py's painting rule (pick_lib):
the nearest non-crude name by CIEDE2000, passing over a novelty / brand / signage name when a plain one is within
2.0, never the same name twice in one palette, and never a pigment name newer than the work. Japanese traditional
names are allowed only on works from Japan.

Output: data/gallery/ (deleted and rewritten each run)
  index.json   header: {v, built, n, shard, rec (bytes per painting), app [app words], sources [{k, name, short,
               credit, home}], method}. Small; loaded with index.bin.
  index.bin    the search index, `rec` bytes per painting in corpus order (museum, then id), loaded in one go:
               u16 year + 20000 (0 = undated) · u8 museum (sources index) · u8 aspect (ln(h/w) mapped -1.6..1.6
               onto 0..255) · u8 mean L* x 2.5 · u8 mean C* x 3 · 6 x (R, G, B, share x 250).
               About 30 bytes a painting: 40,000 paintings is 1.2 MB.
  ids.txt      painting ids, one per line, in index order (line i = gallery index i). For the article reader's [[painting:<id>]].
  names.json   the library names used: [[name, hex, "src src", kanji?, meaning?]]. Loaded with the first painting page.
  d/NNN.json   detail shards of `shard` paintings (index order): [id, title, artist, country, movement, image URL,
               record URL, [library name index x 6], [app word index x 6], hi image URL, pool]. Loaded for the
               paintings on screen.
               pool: the dynamic-palette material for ROADMAP §13's 3/6/12/20 slider (js/gallery.js glPoolPick()
               derives any of those sizes from it live, no extra download) -- base64 of up to POOL (24) colors,
               4 bytes each (R, G, B, share x 250, the same byte scheme as index.bin's six), already picked by
               extract_pool()'s port of js/studio.js extractPalette (over-cluster in OKLab, then greedy-pick by
               area x vividness x distinctness); "" when the source image isn't cached locally.
               crop (12th, only when the row has one): [left, top, right, bottom] in thousandths of the image, the painting inside
               its frame, wall or margin (tools/crop_paintings.py). The pool and the six colors were measured inside it, index.bin's
               aspect byte is the CROPPED shape, and js/gallery.js draws the image shifted/scaled so only that box shows.

Museums: one row each in SOURCES (name, credit line, record-URL pattern). A record's own `url` wins over the
pattern. A museum without a row still works (its code is shown) and the script warns.
"""
import base64, json, math, re, shutil, sys
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402  (labs, load_library, silly_names, pick_lib, JP_WORKS)
from paintings import PIGMENT_SINCE  # noqa: E402

OUT = ROOT / "data" / "gallery"
SHARD = 100     # paintings per detail shard: a screen of results spread over the whole corpus loads ~30 small files
REC = 30        # bytes per painting in index.bin
YEAR0 = 20000
# ---------------------------------------------------------------------------------------------------------------
# Pool sizing (David, 2026-10-09 audit -- Gari Melchers' "Maternity": the mother's lilac/mauve sleeve, plainly
# visible and locally concentrated, never appeared in ANY palette mode). Diagnosis (reproduced by hand against the
# live NGA image, see the audit note below): the OLD pipeline (POOL_SIDE=120, POOL=24, pure greedy share^.6 x
# chroma x distinctness pick) doesn't lose the sleeve to the thumbnail alone -- raising POOL_SIDE to 800 and k to
# 64 on its own still drops it. The real cause is that a canvas dominated by one family (here: browns/ochres, the
# dress + chair + autumn background) fields dozens of moderate-chroma, moderate-share clusters in that family,
# and the old greedy objective has no per-hue-family floor, so they out-score the sleeve's few small (~0.15-0.3%
# share each) mauve/violet clusters at ANY k up to 64. The sleeve's clusters are real and present in the raw
# k-means output the whole time -- they just never survive the OLD selection step.
# Fix, in two parts:
#   1) POOL_SIDE 120 -> 512 (a real thumbnail, not a postage stamp -- this alone recovers some chroma the old
#      120px box-resize smeared away).
#   2) extract_pool() over-segments to OVERSEG (48-80, scaled with pool size) clusters, same as before, but the
#      pick step is no longer pure greedy: it first reserves one slot per hue family (12 x 30 degree bins) whose
#      total share clears HUE_FLOOR_SHARE, taking that family's best (share x chroma x spatial compactness x
#      contrast-vs-canvas) cluster -- a guarantee every hue actually present above a small area gets a seat, the
#      direct fix for the sleeve -- and only THEN fills the remaining seats with the old share^.6 x chroma x
#      distinctness greedy rule for by-area coverage/fidelity. A final ΔE_ok-ish min-spacing pass drops near
#      duplicates the two passes both reached for.
# POOL 24 -> 40 so the extra hue-reserved seats don't crowd out area coverage; the wire format (hex + share, 4
# bytes/color, base64) is unchanged, so js/gallery.js's glPoolDecode() needs no migration.
POOL = 40       # dynamic-palette candidates kept per painting: headroom above the live slider's 20-color top
                # (ROADMAP §13 / David 2026-10-09 "any count via one shared slider, 2-20") so picking 20 still
                # drops a few near-duplicates by distinctness, AND every present hue family gets a fair shot
POOL_SIDE = 512 # long side of the copy the pool k-means runs on -- was 120 (a thumbnail so small it was shaving
                # chroma off thin brushwork before clustering even started); 512 keeps run time sane (~1.2s/
                # painting measured) while giving fine brushstroke colors (a sleeve, a sash, a flower) enough
                # pixels to form their own cluster
OVERSEG_MIN = 64   # raw k-means clusters before any selection (David's "k~48-64"); never fewer than this
HUE_BINS = 12      # 30-degree OKLab hue wedges for the diversity floor
HUE_FLOOR_SHARE = .003   # a hue family needs at least this share of the canvas (0.3%) to earn a reserved seat --
                         # below that it's genuine single-pixel noise, not a real color in the picture
MIN_SPACE_OK = .045      # final de-dup: two picks closer than this in OKLab (L,a,b together) are near-duplicates

# One row per museum. rec: record-page pattern; {num} = the id after "<src>-", {acc} = CMA accession number
# (from the image URL). credit: the image and data terms shown under each painting.
SOURCES = {
    "aic": dict(name="Art Institute of Chicago", short="Chicago", credit="public domain · CC0 data",
                home="https://www.artic.edu/collection", rec="https://www.artic.edu/artworks/{num}"),
    "cma": dict(name="Cleveland Museum of Art", short="Cleveland", credit="CC0 image · CC0 data",
                home="https://www.clevelandart.org/art/collection/search", rec="https://clevelandart.org/art/{acc}"),
    # Rows for the museums being added. Patterns from each museum's public site; check credit lines against the
    # corpus build's license notes when their records land (the Met and NGA pages refuse scripted requests).
    "met": dict(name="The Metropolitan Museum of Art", short="The Met", credit="public domain · CC0 data (Open Access)",
                home="https://www.metmuseum.org/art/collection", rec="https://www.metmuseum.org/art/collection/search/{num}"),
    "rijks": dict(name="Rijksmuseum", short="Rijksmuseum", credit="public domain · CC0 data",
                  home="https://www.rijksmuseum.nl/en/collection", rec="https://www.rijksmuseum.nl/en/collection/{num}"),
    "nga": dict(name="National Gallery of Art", short="NGA", credit="public domain · CC0 data (Open Access)",
                home="https://www.nga.gov/collection", rec="https://www.nga.gov/collection/art-object-page.{num}.html"),
    "smk": dict(name="SMK, National Gallery of Denmark", short="SMK", credit="public domain · CC0 data",
                home="https://open.smk.dk", rec="https://open.smk.dk/artwork/image/{num}"),
    "commons": dict(name="Wikimedia Commons", short="Commons", credit="public domain · CC0 data (Wikidata)",
                    home="https://commons.wikimedia.org/wiki/Commons:Welcome", rec="https://www.wikidata.org/wiki/{num}"),
}
CMA_IMG = re.compile(r"^https://openaccess-cdn\.clevelandart\.org/([^/]+)/\1_web\.jpg$")


def load_aliases():
    """{variant painter name: canonical name} from data/artists/aliases.json (tools/artist_aliases.py builds it)."""
    f = ROOT / "data" / "artists" / "aliases.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def load_nonpaintings():
    """Hand-reviewed non-painting ids (letters, personal correspondence, etc.) to drop even if they're still
    sitting in a corpus shard -- see data/corpus-nonpaintings.json and design/CORPUS-NONPAINTINGS.md. tools/corpus.py
    also filters these out at build time; this second check means the gallery never shows one even when it's
    built from a corpus that wasn't freshly rebuilt."""
    f = ROOT / "data" / "corpus-nonpaintings.json"
    return {x["id"] for x in json.loads(f.read_text(encoding="utf-8"))} if f.exists() else set()


def load_corpus(aliases=True):
    """Corpus rows in gallery order. With aliases (the default) a painter's spelling variants are folded into one
    name ("Hilaire Germain Edgar Degas" -> "Edgar Degas") so every later stage sees one identity per painter."""
    al = load_aliases() if aliases else {}
    nonpaintings = load_nonpaintings()
    files = ([ROOT / "data" / "corpus.json"] if (ROOT / "data" / "corpus.json").exists() else []) + \
        sorted((ROOT / "data" / "corpus").glob("*.json"))
    seen, rows = set(), []
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        data = data.get("rows", data) if isinstance(data, dict) else data
        for x in data:
            if x["id"] in seen or not x.get("img") or len(x.get("p") or []) != 6 or x["id"] in nonpaintings:
                continue
            seen.add(x["id"])
            if x.get("a") in al:
                x = dict(x, a=al[x["a"]])
            rows.append(x)
    order = {k: i for i, k in enumerate(SOURCES)}

    def natural(x):
        rest = x["id"].split("-", 1)[1] if "-" in x["id"] else x["id"]
        return (order.get(x["src"], len(order)), x["src"], [(0, int(t), "") if t.isdigit() else (1, 0, t)
                                                             for t in re.findall(r"\d+|\D+", rest)])
    rows.sort(key=natural)
    return rows, files


def sizes(raw):
    """{corpus id: h/w} from cached museum metadata, where present."""
    out = {}
    p = raw / "aic" / "meta.json"
    if p.exists():
        for x in json.loads(p.read_text())["rows"]:
            t = x.get("thumbnail") or {}
            if t.get("width") and t.get("height"):
                out[f"aic-{x['id']}"] = t["height"] / t["width"]
    p = raw / "cma" / "meta.json"
    if p.exists():
        for x in json.loads(p.read_text())["rows"]:
            w = (x.get("images") or {}).get("web") or {}
            if w.get("width") and w.get("height"):
                out[f"cma-{x['id']}"] = int(w["height"]) / int(w["width"])
    # every other museum: read the size of the small copy cached when the palettes were measured
    try:
        from PIL import Image
    except ImportError:
        return out
    for src in ("nga", "rijks", "smk", "met", "commons"):
        d = raw / src / "img"
        if not d.is_dir():
            continue
        for f in d.iterdir():
            if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            try:
                with Image.open(f) as im:
                    w, h = im.size
                out.setdefault(f"{src}-{f.stem}", h / w)
            except Exception:
                pass
    return out


def record_url(x):
    if x.get("url") or x.get("rec"):
        return x.get("url") or x.get("rec")
    s = SOURCES.get(x["src"])
    if not s:
        return None
    num = x["id"].split("-", 1)[1] if "-" in x["id"] else x["id"]
    acc = ""
    if "{acc}" in s["rec"]:
        m = CMA_IMG.match(x["img"] or "")
        if not m:
            return None
        acc = m.group(1)
    return s["rec"].format(num=num, acc=acc)


def byte(v, lo=0, hi=255):
    return max(lo, min(hi, int(round(v))))


# ---------- dynamic palette (ROADMAP §13): js/studio.js extractPalette(), ported to numpy ----------
# Same three steps as the JS original (see its own comment): 1) over-cluster in OKLab (Bjoern Ottosson, 2020) so a
# small vivid detail gets its own group instead of being averaged away; 2) greedy-pick POOL of them by
# share^0.6 x vividness x distinctness-from-what's-already-picked; 3) re-measure shares against the picked colors
# only. Deterministic (a fixed LCG seed for k-means++, exactly as the JS does), so a re-run never churns the data.
def _srgb_to_lin(v):
    v = v / 255.0
    return np.where(v > .04045, ((v + .055) / 1.055) ** 2.4, v / 12.92)


def _oklab_fwd(r, g, b):
    l = np.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b)
    m = np.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b)
    s = np.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
    return np.stack([.2104542553 * l + .793617785 * m - .0040720468 * s,
                      1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
                      .0259040371 * l + .7827717662 * m - .808675766 * s], axis=-1)


def _oklab_to_lin(col):
    L, a, b = col
    l = (L + .3963377774 * a + .2158037573 * b) ** 3
    m = (L - .1055613458 * a - .0638541728 * b) ** 3
    s = (L - .0894841775 * a - 1.291485548 * b) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
            -.0041960863 * l - .7034186147 * m + 1.707614701 * s)


def _enc8(v):
    v = max(0.0, min(1.0, 1.055 * v ** (1 / 2.4) - .055 if v > .0031308 else 12.92 * v))
    return byte(v * 255)


def _ok_hex(col):
    return "#" + "".join(f"{_enc8(v):02X}" for v in _oklab_to_lin(col))


class _Rnd:
    """The JS's own fixed LCG (seed=7), so k-means++ seeding picks the same starting centers every run."""
    def __init__(self, seed=7):
        self.s = seed

    def __call__(self):
        self.s = (self.s * 16807) % 2147483647
        return self.s / 2147483647


def crop_image(im, crop):
    """The painting inside its frame, wall or margin: crop = [l, t, r, b] in thousandths (tools/crop_paintings.py), pulled in
    another 1.5% on every side so a sliver of frame at the cut does not sample as a color."""
    if not crop:
        return im
    W, H = im.size
    l, t, r, b = (crop[0] / 1000, crop[1] / 1000, crop[2] / 1000, crop[3] / 1000)
    iw, ih = (r - l) * 0.015, (b - t) * 0.015
    box = (round((l + iw) * W), round((t + ih) * H), round((r - iw) * W), round((b - ih) * H))
    return im.crop(box) if box[2] - box[0] >= 20 and box[3] - box[1] >= 8 else im


def extract_pool(path, k=POOL, crop=None):
    """Over-cluster in OKLab (OVERSEG_MIN-ish groups), represent each by a real pixel (medoid, never a blended
    average -- "never pick muddy averages"), then pick k: first one seat per hue family that clears
    HUE_FLOOR_SHARE (the diagnosis fix: a small, locally concentrated, genuinely-present color family -- a
    lilac sleeve against an all-brown canvas -- is never allowed to lose every seat to a crowd of browns), then
    fill the rest by the original share^.6 x chroma x distinctness greedy rule for area coverage. A final
    min-spacing pass (MIN_SPACE_OK) drops near-duplicates either pass reached for."""
    im = crop_image(Image.open(path).convert("RGB"), crop)
    w0, h0 = im.size
    sc = min(1.0, POOL_SIDE / max(w0, h0))
    w, h = max(1, round(w0 * sc)), max(1, round(h0 * sc))
    if (w, h) != (w0, h0):
        im = im.resize((w, h), Image.BOX)
    arr = np.asarray(im, dtype=np.float64)
    lin = _srgb_to_lin(arr)
    px = _oklab_fwd(lin[..., 0], lin[..., 1], lin[..., 2]).reshape(-1, 3)
    N = len(px)
    if N == 0:
        return []
    # canvas-level stats used by the hue-floor scoring: the share-weighted mean color (for "contrast vs
    # surroundings") and each pixel's (x, y) on the sampled grid (for "spatial compactness" -- a concentrated
    # patch like a sleeve scores higher than the same area scattered as noise across the canvas)
    mean_col = px.mean(0)
    ys, xs = np.divmod(np.arange(N), w)
    diag = math.hypot(w, h) or 1.0

    rnd = _Rnd()
    K = min(N, max(OVERSEG_MIN, k * 2))
    cents = [px[int(rnd() * N) % N]]
    dmin = ((px - cents[0]) ** 2).sum(1)
    while len(cents) < K:
        tot = dmin.sum()
        if tot <= 0:
            break
        t = rnd() * tot
        i = min(int(np.searchsorted(np.cumsum(dmin), t)), N - 1)
        cents.append(px[i])
        dmin = np.minimum(dmin, ((px - cents[-1]) ** 2).sum(1))
    C = np.array(cents)
    for _ in range(14):
        d2 = ((px[:, None, :] - C[None, :, :]) ** 2).sum(-1)
        lab = d2.argmin(1)
        C = np.array([px[lab == j].mean(0) if np.any(lab == j) else C[j] for j in range(len(C))])
    d2 = ((px[:, None, :] - C[None, :, :]) ** 2).sum(-1)
    lab = d2.argmin(1)
    groups = []
    for j in range(len(C)):
        idxs = np.nonzero(lab == j)[0]
        if not len(idxs):
            continue
        order = idxs[np.argsort(d2[idxs, j])]
        core = order[:max(1, math.ceil(len(order) * .6))]
        chroma = np.hypot(px[core, 1], px[core, 2])
        top = core[np.argsort(-chroma)][:max(1, math.ceil(len(core) * .3))]
        blend = px[top].mean(0)
        # medoid snap: the single real pixel (among the chroma-top subset) nearest the blended center -- the
        # stored color is always a color that actually exists in the painting, never an average of several
        medoid_i = top[int(np.argmin(((px[top] - blend) ** 2).sum(1)))]
        col = np.array(px[medoid_i])   # a plain copy (not a view), used as a numpy array only for math below
        share = len(idxs) / N
        spread = math.hypot(float(xs[idxs].std()), float(ys[idxs].std())) / diag
        compact = 1.0 / (1.0 + 6.0 * spread)                      # tighter spatial spread -> closer to 1
        contrast = float(np.hypot(*(col[1:] - mean_col[1:]))) + abs(float(col[0] - mean_col[0])) * .5
        groups.append({"gid": j, "col": col, "share": share, "compact": compact, "contrast": contrast})
    groups = [g for g in groups if g["share"] > .0015]
    if not groups:
        return []

    def chroma_of(g):
        return math.hypot(g["col"][1], g["col"][2])

    def hue_of(g):
        return math.degrees(math.atan2(g["col"][2], g["col"][1])) % 360

    # ---- pass 1: one reserved seat per hue family actually present above HUE_FLOOR_SHARE (the diagnosis fix) ----
    by_bin = {}
    for g in groups:
        if chroma_of(g) < .02:         # near-neutral: no stable hue, leave it to the area-coverage pass
            continue
        b = int(hue_of(g) // (360 / HUE_BINS)) % HUE_BINS
        by_bin.setdefault(b, []).append(g)
    picked, picked_ids = [], set()
    for b, gs in by_bin.items():
        tot_share = sum(x["share"] for x in gs)
        if tot_share < HUE_FLOOR_SHARE:
            continue
        best = max(gs, key=lambda g: (g["share"] ** .5) * chroma_of(g) * g["compact"] * (.4 + g["contrast"]))
        picked.append(best)
        picked_ids.add(best["gid"])

    # ---- pass 2: fill the rest by area-coverage fidelity (the original share^.6 x chroma x distinctness rule) ----
    left = [g for g in groups if g["gid"] not in picked_ids]
    while len(picked) < k and left:
        bi, bs = 0, -1.0
        for i, g in enumerate(left):
            near = min(float(np.sqrt(((g["col"] - p["col"]) ** 2).sum())) for p in picked) if picked else 1.0
            s = (g["share"] ** .6) * (.5 + 3 * chroma_of(g)) * min(1.0, near / .14) ** 1.5
            if s > bs:
                bi, bs = i, s
        picked.append(left.pop(bi))

    # ---- final min-spacing de-dup: never two picks closer than MIN_SPACE_OK (a ΔE_ok-ish floor) ----
    picked.sort(key=lambda g: -g["share"])
    final_picks = []
    for g in picked:
        if all(float(np.sqrt(((g["col"] - p["col"]) ** 2).sum())) >= MIN_SPACE_OK for p in final_picks):
            final_picks.append(g)
    if not final_picks:
        final_picks = picked[:1]

    # ---- re-measure: every canvas pixel goes to its nearest surviving pick, so the shipped shares are honest ----
    PC = np.array([p["col"] for p in final_picks])
    final = ((px[:, None, :] - PC[None, :, :]) ** 2).sum(-1).argmin(1)
    counts = np.bincount(final, minlength=len(final_picks))
    out = [(_ok_hex(p["col"]), counts[j] / N) for j, p in enumerate(final_picks) if counts[j] > 0]
    out.sort(key=lambda x: -x[1])
    return out


def img_cache_path(raw, src, cid):
    num = cid.split("-", 1)[1] if "-" in cid else cid
    return raw / src / "img" / f"{num}.jpg"


def pack_pool(entries):
    buf = bytearray()
    for hexcol, share in entries:
        h = hexcol.lstrip("#")
        buf += bytes(int(h[i:i + 2], 16) for i in (0, 2, 4))
        buf.append(byte(share * 250))
    return base64.b64encode(bytes(buf)).decode("ascii")


def _pool_job(args):
    key, path, crop = args
    try:
        return key, extract_pool(path, crop=crop), None
    except Exception as e:  # a broken or unreadable image is reported and skipped
        return key, None, str(e)


def run_pools(corpus, raw, workers=8):
    """Pool colors per painting (base64, see pack_pool), cached to research/_raw/corpus-pool.jsonl (corpus.py's
    own corpus-palettes.jsonl pattern): resumable, and a re-run only computes paintings new to the corpus."""
    cache = raw / "corpus-pool.jsonl"
    done, made_with = {}, {}
    if cache.exists():
        for line in cache.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                done[r["key"]] = r["pl"]
                made_with[r["key"]] = r.get("crop") or None   # the newest line for a key wins
    jobs, no_img = [], 0
    for x in corpus:
        crop = x.get("crop") or None   # a painting with a crop box is sampled inside it (tools/crop_paintings.py)
        if x["id"] in done and made_with.get(x["id"]) == crop:
            continue
        p = img_cache_path(raw, x["src"], x["id"])
        if p.exists():
            jobs.append((x["id"], str(p), crop))
        else:
            no_img += 1
    print(f"pools: {len(done)} cached, {len(jobs)} to compute, {no_img} with no cached image", flush=True)
    if jobs:
        from multiprocessing import Pool
        import time
        t0 = time.time()
        crop_of = {j[0]: j[2] for j in jobs}
        with Pool(workers) as pool, cache.open("a") as f:
            for i, (key, entries, err) in enumerate(pool.imap_unordered(_pool_job, jobs, chunksize=8)):
                if err:
                    print(f"   {key}: {err}", flush=True)
                    continue
                pl = pack_pool(entries)
                done[key] = pl
                f.write(json.dumps({"key": key, "pl": pl, "crop": crop_of[key]}) + "\n")
                if i % 500 == 0:
                    f.flush()
                    print(f"pools {i + 1}/{len(jobs)}  {time.time() - t0:.0f}s", flush=True)
    return done


def main():
    args = sys.argv[1:]
    raw = Path(args[args.index("--raw") + 1]) if "--raw" in args else ROOT / "research" / "_raw"
    shard = int(args[args.index("--shard") + 1]) if "--shard" in args else SHARD
    corpus, files = load_corpus()
    if not corpus:
        raise SystemExit("no corpus found (data/corpus.json or data/corpus/*.json)")
    lib = [e for e in LIB.load_library() if not e.get("crude")]
    LL = LIB.labs([e["h"] for e in lib])
    silly = LIB.silly_names(lib)
    by_name = {e["n"]: e for e in lib}
    ratio = sizes(raw)
    pools = run_pools(corpus, raw)

    srcs = list(SOURCES)
    for x in corpus:
        if x["src"] not in srcs:
            srcs.append(x["src"])
            print(f"warning: no SOURCES row for museum '{x['src']}'; add one (name, credit, record URL pattern)")
    used_srcs = [s for s in srcs if any(x["src"] == s for x in corpus)]
    src_idx = {s: i for i, s in enumerate(used_srcs)}

    app_idx, lib_idx, app, libs, details = {}, {}, [], [], []
    index = bytearray(REC * len(corpus))
    no_size = no_rec = no_pool = 0
    pool_bytes = 0
    for k, x in enumerate(corpus):
        if x.get("co") == "Japan":
            LIB.JP_WORKS.add(x["id"])
        year = max(x["y"], 0) if x.get("y") is not None else 1900  # pick_lib compares against pigment dates (0 = ancient)
        chosen, _, _ = LIB.pick_lib(x["id"], year, [{"h": p[0]} for p in x["p"]], lib, LL, silly, PIGMENT_SINCE)
        li = []
        for name, _ in chosen:
            if name not in lib_idx:
                e = by_name[name]
                lib_idx[name] = len(libs)
                row = [e["n"], e["h"], " ".join(e["src"])]
                if e.get("jp"):
                    row += [e["jp"].get("kanji", ""), e["jp"].get("meaning", "")]
                libs.append(row)
            li.append(lib_idx[name])
        wi = []
        for p in x["p"]:
            if p[2] not in app_idx:
                app_idx[p[2]] = len(app)
                app.append(p[2])
            wi.append(app_idx[p[2]])
        rec = record_url(x)
        no_rec += rec is None
        img = x["img"]
        # The Art Institute of Chicago's image server now refuses requests from other sites, so its
        # paintings are served from our own small copies (img/gallery/aic/<number>.jpg, 200px wide).
        # SMK's image server is too slow for a phone (often 15-40 s per image), so it gets the same treatment.
        for pre in ("aic", "smk"):
            if x["id"].startswith(pre + "-") and (ROOT / "img" / "gallery" / pre / (x["id"][len(pre) + 1:] + ".jpg")).exists():
                img = f"img/gallery/{pre}/" + x["id"][len(pre) + 1:] + ".jpg"
        # hi: a bigger image for the painting page when the grid uses our small copy ("" = none reachable)
        if x["id"].startswith("commons-") and "?width=400" in (x["img"] or ""):
            hi = x["img"].replace("?width=400", "?width=1200")  # Commons is hotlinked directly: always a sharper copy
        elif img != x["img"] and x["id"].startswith("smk-"):
            hi = (x["img"] or "").replace("/full/400,/0/", "/full/1000,/0/")
        else:
            hi = ""
        pl = pools.get(x["id"], "")
        no_pool += not pl
        pool_bytes += len(pl)
        det = [x["id"], x.get("t") or "Untitled", x.get("a"), x.get("co"), x.get("mv"), img, rec, li, wi, hi, pl]
        if x.get("crop"):
            det.append(x["crop"])   # [l, t, r, b] in thousandths: the painting inside its frame/wall (tools/crop_paintings.py)
        details.append(det)

        r = ratio.get(x["id"]) or x.get("r") or (x["h"] / x["w"] if x.get("w") and x.get("h") else None)
        if not r:
            no_size += 1
            r = 1.25
        if x.get("crop"):   # the box and its pins are the painting's own shape, not the museum photo's
            cl, ct, cr, cb = x["crop"]
            r = r * (cb - ct) / (cr - cl)
        o = k * REC
        y = x.get("y")
        index[o:o + 2] = (0 if y is None else byte(y + YEAR0, 1, 65535)).to_bytes(2, "little")
        index[o + 2] = src_idx[x["src"]]
        index[o + 3] = byte((math.log(r) + 1.6) / 3.2 * 255)
        index[o + 4] = byte(x["L"] * 2.5)
        index[o + 5] = byte(x["C"] * 3)
        for j, p in enumerate(x["p"]):
            h = p[0].lstrip("#")
            index[o + 6 + j * 4:o + 9 + j * 4] = bytes(int(h[i:i + 2], 16) for i in (0, 2, 4))
            index[o + 9 + j * 4] = byte(p[1] * 250)
        if k % 2000 == 1999:
            print(f"  named {k + 1} of {len(corpus)}", flush=True)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "d").mkdir(parents=True)
    head = dict(v=2, built=date.today().isoformat(), n=len(corpus), shard=shard, rec=REC, year0=YEAR0, app=app,
                sources=[dict(k=s, **{f: (SOURCES.get(s) or {}).get(f, s if f in ("name", "short") else "")
                                      for f in ("name", "short", "credit", "home")}) for s in used_srcs],
                method="Six colors per painting by k-means in CIELAB on the museum's small image (tools/corpus.py); "
                       "each share is that color's area. Names: nearest library name by CIEDE2000 (tools/gallery.py). "
                       f"Dynamic palette (3/6/12/20): up to {POOL} candidates per painting by k-means in OKLab, "
                       "over-clustered then greedy-picked by area x vividness x distinctness (js/studio.js "
                       "extractPalette, ported to Python in tools/gallery.py); the app picks the slider's size "
                       "from that pool live.")
    (OUT / "index.json").write_text(json.dumps(head, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "index.bin").write_bytes(bytes(index))
    names = json.dumps(libs, ensure_ascii=False, separators=(",", ":")).replace('],["', '],\n["')
    (OUT / "names.json").write_text(names, encoding="utf-8")
    n_sh = 0
    for s in range(0, len(details), shard):
        text = json.dumps(details[s:s + shard], ensure_ascii=False, separators=(",", ":")).replace('],["', '],\n["')
        (OUT / "d" / f"{s // shard:03d}.json").write_text(text, encoding="utf-8")
        n_sh += 1
    # ids.txt: painting ids, one per line, in gallery order (line i = gallery index i). The article reader (js/article-refs.js)
    # turns [[painting:<id>]] and the graph's "appears in" ids into gallery numbers with it.
    (OUT / "ids.txt").write_text("\n".join(d[0] for d in details), encoding="utf-8")
    tot = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"data/gallery/: {len(corpus)} paintings from {', '.join(f.name for f in files)}; "
          f"index.bin {len(index) / 1e3:.0f} KB, index.json {(OUT / 'index.json').stat().st_size / 1e3:.1f} KB, "
          f"names.json {(OUT / 'names.json').stat().st_size / 1e3:.0f} KB ({len(libs)} names), "
          f"{n_sh} detail shards of {shard}; {tot / 1e6:.2f} MB in all. "
          f"{no_size} without a known image size, {no_rec} without a record URL, "
          f"{no_pool} without a dynamic palette (no cached image) -- pool data adds ~{pool_bytes / 1e6:.2f} MB.")
    # Every file keyed by a gallery index goes stale when the corpus changes (node tools/check_ids.js fails on it).
    print("Now rebuild what is keyed to this order, in this order: tools/analyze.py, tools/metrics_build.py, "
          "tools/facets.py, tools/artwiki_build.py; then run node tools/check_ids.js.")


if __name__ == "__main__":
    main()
