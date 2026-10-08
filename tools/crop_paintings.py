#!/usr/bin/env python3
"""Find the painting inside the photograph: trim scan margins, frames and walls so the color pools never sample them.

  python3 tools/crop_paintings.py measure [--n 400] [--seed 3]   # sample across sources, print the share affected
  python3 tools/crop_paintings.py run [--src commons]            # every cached image -> research/_raw/corpus-crops.jsonl
  python3 tools/crop_paintings.py apply                          # recompute the 6-color palettes + 24-color pools of the
                                                                 # cropped images, patch data/corpus/*.json (crop, cf, p, L, C)
  python3 tools/crop_paintings.py sheet [--n 40] [--out PATH]    # before/after contact sheet
  python3 tools/crop_paintings.py report                         # share affected / confidence by source, from the cache

Why (David, 2026-10-08): "Photos of paintings sometimes have wallpaper or a wall behind them, so we have to segment each
picture to make sure we don't sample the background." Museum API images are mostly cropped tight; Wikimedia Commons ones
are often gallery photos (a gilt frame, a wall, a label, a little perspective). Their frame colors (golds, browns,
near-blacks) pollute every statistic.

Method (deterministic, numpy + PIL only, no model). It runs on the cached 200 px-wide copy (the same pixels the palettes
use), and returns fractions of the image so it applies at any size.
  a. Flat borders: from each side, lines that are flat along their length (std small), drift slowly from line to line, and
     end in a clear step to the picture: a scan's white or black margin, a flat wall, a photo backdrop. A painted
     background that fades into the picture has no step and is kept.
  b. Frame: on the trimmed picture, for each side, look for the innermost STRAIGHT edge within 30% of the side. The picture
     is cut into 5 segments along the side; an edge is a line (slope up to about 3 degrees) whose gradient is strong in at
     least 4 of the 5 segments. Gilt frames, dark frames and wallpaper all end at such a line (frame -> canvas).
  c. Perspective: the fitted edges are slightly slanted lines (a quadrilateral). The crop is the largest upright rectangle
     inside that quadrilateral (each side moved to the line's innermost point), so we never sample the frame at a corner.
  d. Confidence. high: a clean crop (nothing found, or the edges agree: 3-4 sides, or an opposite pair of similar depth).
     medium: one side, adjacent sides, or a strongly slanted edge. low: can't tell (weak edges on two or more sides, a
     gilt ring around the image, an edge that would eat more than half the area, or a Commons file name that says frame,
     in situ, installation view or gallery view and nothing found). A low image gets the conservative CENTER crop (the
     central 70%) and is labeled so (cf = "l"), and its statistics are measured on that center.
The crop is stored on the corpus row as `crop` = [left, top, right, bottom] in thousandths of the image, with `cf` = "m" or
"l" when it is not high confidence. A row with no `crop` is the whole image, high confidence.
"""
import json, re, sys, time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw"
CROP_CACHE = RAW / "corpus-crops.jsonl"
MAIN_RAW = Path("/Users/david/Documents/claudeCode/colorhub/research/_raw")  # a worktree has no _raw of its own
if not RAW.exists() and MAIN_RAW.exists():
    RAW = MAIN_RAW
    CROP_CACHE = RAW / "corpus-crops.jsonl"

SIDE_MAX = 0.30      # a frame edge is looked for within 30% of each side
SEGMENTS = 5
SLOPES = np.linspace(-0.05, 0.05, 11)   # edge slope as dx/dy: +-2.9 degrees
EDGE_T = 10.0        # mean signed Lab step (3 px either side), averaged over a segment: "an edge is here"
SUPPORT_OK = 0.8     # an edge line needs 4 of 5 segments
SUPPORT_WEAK = 0.6
CENTER = (150, 150, 850, 850)   # the conservative crop for low confidence: the central 70%
HINT = re.compile(r"\b(frames?|framed|in situ|installation view|gallery view|exhibition view|in the gallery)\b", re.I)


# ---------------------------------------------------------------------------------------------------------------
# color
# ---------------------------------------------------------------------------------------------------------------
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WP = np.array([0.95047, 1.0, 1.08883])


def to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ _M.T / _WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def _turn(L, side):
    """Rotate/flip so `side` becomes the left side of the array (edges vertical, depth along axis 1)."""
    if side == "l":
        return L
    if side == "r":
        return L[:, ::-1]
    if side == "t":
        return L.transpose(1, 0, 2)
    return L.transpose(1, 0, 2)[:, ::-1]   # "b"


# ---------------------------------------------------------------------------------------------------------------
# a. flat borders
# ---------------------------------------------------------------------------------------------------------------
def band_flat(L, side, n, tol_std=4.0):
    """True when the n outermost lines at `side` are flat along their length (central 80%): a scan margin, a wall, a
    photo backdrop. A gilt frame or wallpaper has texture, so it is not flat. (A painted sky is flat too, which is why
    a flat band is trusted only with a straight edge, a modest depth or a matching band on the opposite side.)"""
    T = _turn(L, side)
    h = T.shape[0]
    lines = T[int(h * 0.1):int(h * 0.9), :max(1, n)]
    return bool(lines.std(0).mean() < tol_std)


# ---------------------------------------------------------------------------------------------------------------
# b. straight edges
# ---------------------------------------------------------------------------------------------------------------
def edge_lines(L, side):
    """Straight edge candidates near `side` of Lab image L: dicts(x, slope, support, strength), x = depth in pixels at
    the middle of the side, slope = dx/dy of the edge. Only local maxima with support >= SUPPORT_WEAK."""
    T = _turn(L, side)
    h, w = T.shape[:2]
    if h < 20 or w < 20:
        return []
    # signed step across column x: mean of the 3 columns after minus mean of the 3 before. Averaged over a segment of
    # rows it keeps its sign along a real straight edge and cancels in picture content (texture, a figure's outline).
    cs = np.concatenate([np.zeros((h, 1, 3)), np.cumsum(T, 1)], 1)           # (h, w+1, 3): running sums along x
    xs_ = np.arange(3, w - 3)
    D = (cs[:, xs_ + 3] - cs[:, xs_]) / 3 - (cs[:, xs_] - cs[:, xs_ - 3]) / 3   # (h, w-6, 3); column c <-> x = c + 3
    depth = int(w * SIDE_MAX)
    y0, y1 = int(h * 0.08), int(h * 0.92)
    bounds = np.linspace(y0, y1, SEGMENTS + 1).astype(int)
    prof = np.stack([D[bounds[k]:bounds[k + 1], :depth + 3].mean(0) for k in range(SEGMENTS)])   # (5, depth+3, 3)
    mag = np.sqrt((prof ** 2).sum(-1))
    yc = (bounds[:-1] + bounds[1:]) / 2 - h / 2
    x0 = np.arange(3, depth)
    xs = np.rint(x0[:, None, None] + SLOPES[None, :, None] * yc[None, None, :]).astype(int) - 3   # (x, slope, seg)
    okc = (xs >= 0) & (xs < mag.shape[1])
    xc = np.clip(xs, 0, mag.shape[1] - 1)
    ks = np.arange(SEGMENTS)[None, None, :]
    vals = np.where(okc, mag[ks, xc], 0.0)                                   # (x, slope, seg)
    vec = prof[ks, xc]                                                       # (x, slope, seg, 3)
    ref = np.median(vec, 2)                                                  # the typical step vector along this line
    cosv = (vec * ref[:, :, None, :]).sum(-1) / (np.linalg.norm(vec, axis=-1) * np.linalg.norm(ref, axis=-1)[:, :, None] + 1e-9)
    good = (vals >= EDGE_T) & (cosv > 0.6)                                   # strong AND the same kind of step
    sup = good.mean(2)
    st = np.where(good, vals, 0).sum(2) / SEGMENTS
    pick = (sup * 1000 + st / 1000).argmax(1)
    best = [dict(x=int(x0[i]), support=float(sup[i, pick[i]]), strength=float(st[i, pick[i]]), slope=float(SLOPES[pick[i]]))
            for i in range(len(x0))]
    out = []
    for i, c in enumerate(best):
        if c["support"] < SUPPORT_WEAK:
            continue
        near = best[max(0, i - 3):i + 4]
        if all((c["support"], c["strength"]) >= (o["support"], o["strength"]) for o in near):
            out.append(c)
    return out


# ---------------------------------------------------------------------------------------------------------------
# the detector
# ---------------------------------------------------------------------------------------------------------------
def load_small(path, width=200):
    im = Image.open(path).convert("RGB")
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.BOX)
    return im


def gilt_ring(L):
    """True when the outer ring is gilt-colored (yellow-brown, saturated, not dark) on at least three sides."""
    h, w = L.shape[:2]
    e = max(2, round(min(h, w) * 0.04))
    rings = [L[:, :e], L[:, -e:], L[:e], L[-e:]]
    n = 0
    for r in rings:
        m = r.reshape(-1, 3).mean(0)
        c = float(np.hypot(m[1], m[2]))
        hue = float(np.degrees(np.arctan2(m[2], m[1])) % 360)
        if c > 25 and 50 <= hue <= 100 and m[0] > 35:
            n += 1
    return n >= 3


def detect(im, hint=False):
    """-> dict(box=[l,t,r,b] fractions of the image, conf 'h'|'m'|'l', kinds [...], sides {...}, notes [...]).
    `box` is the crop to sample; for conf 'l' it is the center crop and `found` is what the detector saw instead."""
    a = np.asarray(im, dtype=np.float64)
    H, W = a.shape[:2]
    L = to_lab(a)
    notes, kinds = [], []
    l = t = r = b = 0
    inner = L
    h, w = H, W
    # a + b. The innermost straight edge within 30% of each side is where the picture starts. What lies outside it is a
    # flat margin or wall (kind "flat-border") or textured: a frame, wallpaper ("frame").
    chosen, weak, flat = {}, {}, {}
    for s in "ltrb":
        c = edge_lines(L, s)
        ok = [e for e in c if e["support"] >= SUPPORT_OK]
        if ok:
            chosen[s] = max(ok, key=lambda e: e["x"])      # the innermost straight edge is the painting's own
        elif c:
            weak[s] = max(c, key=lambda e: e["strength"])
    dim = {"l": H, "r": H, "t": W, "b": W}
    opp = {"l": "r", "r": "l", "t": "b", "b": "t"}
    # A deep edge on one side only is more likely a horizon, a doorway or a figure than a frame: keep it only when it is
    # shallow (a scan margin or a thin mat, up to 8%), or the opposite side has a matching edge (a frame or wall all round).
    for s in list(chosen):
        d = chosen[s]["x"] / dim[s]
        o = chosen.get(opp[s])
        match = o is not None and 0.4 * d - 0.02 <= o["x"] / dim[s] <= 2.5 * d + 0.02
        if d > 0.08 and not match:
            weak[s] = chosen.pop(s)
            notes.append("deep edge on %s dropped" % s)
    for s in chosen:
        flat[s] = band_flat(L, s, int(chosen[s]["x"]))
    if any(flat.values()):
        kinds.append("flat-border")
    if any(not v for v in flat.values()):
        kinds.append("frame")
    # c. the largest upright rectangle inside the (slightly slanted) quadrilateral
    edge = {}
    for s in "ltrb":
        if s in chosen:
            e = chosen[s]
            edge[s] = e["x"] + abs(e["slope"]) * dim[s] / 2 + 1       # innermost point of the slanted line, +1 px of blur
        else:
            edge[s] = 0.0
    slanted = [s for s in chosen if abs(chosen[s]["slope"]) > 0.02]
    if slanted:
        kinds.append("perspective")
    bx = [l + edge["l"], t + edge["t"], W - r - edge["r"], H - b - edge["b"]]
    kept = max(0.0, (bx[2] - bx[0]) * (bx[3] - bx[1])) / (W * H)
    # d. confidence
    conf = "h"
    found = None
    depths = {s: chosen[s]["x"] / dim[s] if s in chosen else 0 for s in chosen}
    if kept < 0.5:
        conf = "l"
        notes.append("crop would keep under half the picture")
    elif chosen:
        n = len(chosen)
        opp = ("l" in chosen and "r" in chosen) or ("t" in chosen and "b" in chosen)
        big = max(depths.values())
        if n >= 3:
            conf = "h"
        elif n == 2 and opp:
            d1, d2 = sorted(depths.values())
            conf = "h" if d2 <= 2.5 * max(d1, 0.02) or d2 < 0.06 else "m"
        elif n == 2:
            conf = "m"
        else:
            conf = "m" if big <= 0.10 else "l"
        if slanted and conf == "h":
            conf = "m"
        if big > 0.20 and conf == "h":
            conf = "m"
            notes.append("deep frame")
        if conf == "m" and all(flat.values()) and big <= 0.08 and not slanted:
            conf = "h"          # a thin flat margin (scan, mat, backdrop) on one or two sides: a clean crop
        if conf == "m" and kept < 0.65:
            conf = "l"          # one or two sides, yet a third of the picture gone: painted architecture is more likely than a frame
            notes.append("big cut on weak evidence")
    else:
        # nothing straight found: strong-ish but patchy edges on three sides, or a gilt ring with one patchy edge
        strong_weak = [s for s in weak if weak[s]["strength"] >= 15]
        if len(strong_weak) >= 3:
            conf = "l"
            notes.append("patchy edges on %d sides" % len(strong_weak))
        elif strong_weak and gilt_ring(inner):
            conf = "l"
            notes.append("gilt ring, no clear edge")
    if hint and not chosen:
        conf = "l"
        notes.append("file name says frame/in situ")
    if conf == "l":
        found = [round(v, 4) for v in (bx[0] / W, bx[1] / H, bx[2] / W, bx[3] / H)]
        box = [v / 1000 for v in CENTER]
    else:
        box = [bx[0] / W, bx[1] / H, bx[2] / W, bx[3] / H]
    return dict(box=[round(v, 4) for v in box], conf=conf, kinds=kinds, kept=round(kept, 3), found=found, notes=notes,
                flat=[s for s, v in flat.items() if v], edges={s: [round(e["x"], 1), round(e["slope"], 3), round(e["strength"], 1)]
                                                                 for s, e in chosen.items()},
                weak=sorted(weak), size=[W, H])


def affected(res):
    """True when the crop removes anything real (more than 4% of the area)."""
    l, t, r, b = res["box"]
    return (1 - (r - l) * (b - t)) > 0.04


def permille(box):
    return [int(round(v * 1000)) for v in box]


def row_crop(res):
    """What the corpus row stores: ([l, t, r, b] permille, cf) or None when the whole image is used. cf is None for a high
    confidence crop, "m" for medium, "l" for low (the central 70%). A trim under 2% of the area is not worth a crop."""
    if not res or "error" in res:
        return None
    l, t, r, b = res["box"]
    if res["conf"] == "l":
        return list(CENTER), "l"
    if (1 - (r - l) * (b - t)) > 0.02 or max(l, t, 1 - r, 1 - b) > 0.015:
        return permille(res["box"]), (None if res["conf"] == "h" else "m")
    return None


# ---------------------------------------------------------------------------------------------------------------
# corpus plumbing
# ---------------------------------------------------------------------------------------------------------------
def corpus_rows():
    rows = []
    for f in sorted((ROOT / "data" / "corpus").glob("*.json")):
        rows += json.loads(f.read_text())
    return rows


def img_path(x):
    src, num = x["id"].split("-", 1)
    return RAW / src / "img" / f"{num}.jpg"


def commons_hint(x):
    if x["src"] != "commons":
        return False
    from urllib.parse import unquote
    name = unquote((x.get("img") or "").split("FilePath/")[-1].split("?")[0])
    return bool(HINT.search(name) or HINT.search(x.get("t") or ""))


def load_crops():
    out = {}
    if CROP_CACHE.exists():
        for line in CROP_CACHE.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


def detect_row(x):
    p = img_path(x)
    if not p.exists():
        return None
    res = detect(load_small(p), hint=commons_hint(x))
    res["key"] = x["id"]
    return res


def _job(x):
    try:
        return detect_row(x)
    except Exception as e:
        return dict(key=x["id"], error=str(e))


def summarize(results, rows_by_id):
    by = defaultdict(list)
    for r in results:
        if r and "error" not in r:
            by[rows_by_id[r["key"]]["src"]].append(r)
    lines = []
    hdr = f"{'source':8} {'n':>6} {'affected':>9} {'frame':>7} {'flat':>6} {'persp':>6}   conf high/med/low"
    lines.append(hdr)
    tot = []
    for s in sorted(by):
        rs = by[s]
        tot += rs
        aff = sum(affected(r) and r["conf"] != "l" for r in rs)
        fr = sum("frame" in r["kinds"] for r in rs)
        fl = sum("flat-border" in r["kinds"] for r in rs)
        pe = sum("perspective" in r["kinds"] for r in rs)
        cf = Counter(r["conf"] for r in rs)
        lines.append(f"{s:8} {len(rs):6d} {aff / len(rs):9.1%} {fr / len(rs):7.1%} {fl / len(rs):6.1%} {pe / len(rs):6.1%}   "
                     f"{cf['h'] / len(rs):.1%} / {cf['m'] / len(rs):.1%} / {cf['l'] / len(rs):.1%}")
    cf = Counter(r["conf"] for r in tot)
    lines.append(f"{'ALL':8} {len(tot):6d} {sum(affected(r) and r['conf'] != 'l' for r in tot) / len(tot):9.1%} "
                 f"{sum('frame' in r['kinds'] for r in tot) / len(tot):7.1%} {sum('flat-border' in r['kinds'] for r in tot) / len(tot):6.1%} "
                 f"{sum('perspective' in r['kinds'] for r in tot) / len(tot):6.1%}   "
                 f"{cf['h'] / len(tot):.1%} / {cf['m'] / len(tot):.1%} / {cf['l'] / len(tot):.1%}")
    return "\n".join(lines)


def sample_rows(rows, n, seed):
    """About n rows, spread evenly over sources (commons gets double: that is where the frames are)."""
    import random
    rng = random.Random(seed)
    by = defaultdict(list)
    for x in rows:
        if img_path(x).exists():
            by[x["src"]].append(x)
    w = {s: (2 if s == "commons" else 1) for s in by}
    tot = sum(w.values())
    out = []
    for s, xs in by.items():
        out += rng.sample(xs, min(len(xs), round(n * w[s] / tot)))
    return out


# ---------------------------------------------------------------------------------------------------------------
# contact sheet
# ---------------------------------------------------------------------------------------------------------------
def _font(size):
    for f in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            pass
    return ImageFont.load_default()


def sheet(items, path, cell=170):
    """items: [(row, res)]. Each cell: the original with the crop drawn on it, and the cropped result beside it."""
    cols = 4
    rows_n = (len(items) + cols - 1) // cols
    cw, ch = cell * 2 + 12, cell + 30
    S = Image.new("RGB", (cols * cw, rows_n * ch), (40, 40, 40))
    d = ImageDraw.Draw(S)
    f = _font(11)
    col = {"h": (80, 220, 90), "m": (240, 190, 40), "l": (240, 80, 80)}
    for i, (x, res) in enumerate(items):
        ox, oy = (i % cols) * cw, (i // cols) * ch
        im = load_small(img_path(x), 400)
        W, H = im.size
        box = res["box"]
        px = (box[0] * W, box[1] * H, box[2] * W, box[3] * H)
        a = im.copy()
        a.thumbnail((cell, cell))
        s = a.width / W
        dd = ImageDraw.Draw(a)
        dd.rectangle([px[0] * s, px[1] * s, px[2] * s - 1, px[3] * s - 1], outline=col[res["conf"]], width=2)
        if res.get("found"):
            fb = res["found"]
            dd.rectangle([fb[0] * W * s, fb[1] * H * s, fb[2] * W * s - 1, fb[3] * H * s - 1], outline=(120, 160, 255), width=1)
        S.paste(a, (ox + 4, oy + 2))
        c = im.crop(tuple(int(round(v)) for v in px))
        c.thumbnail((cell, cell))
        S.paste(c, (ox + cell + 8, oy + 2))
        kept = (box[2] - box[0]) * (box[3] - box[1])
        d.text((ox + 4, oy + cell + 4), f"{x['id'][:22]} {res['conf']} {kept:.0%} {','.join(res['kinds']) or '-'}", fill=col[res["conf"]], font=f)
        d.text((ox + 4, oy + cell + 16), (x["a"] or x["t"] or "")[:30], fill=(190, 190, 190), font=f)
    S.save(path)


# ---------------------------------------------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------------------------------------------
def arg(name, default=None, cast=str):
    a = sys.argv
    return cast(a[a.index(name) + 1]) if name in a else default


def cmd_measure():
    n, seed = arg("--n", 400, int), arg("--seed", 3, int)
    rows = corpus_rows()
    byid = {x["id"]: x for x in rows}
    smp = sample_rows(rows, n, seed)
    t0 = time.time()
    res = [detect_row(x) for x in smp]
    print(f"{len(smp)} images in {time.time() - t0:.1f}s")
    print(summarize(res, byid))
    out = arg("--out")
    if out:
        pick = [(byid[r["key"]], r) for r in res if "--all" in sys.argv or affected(r) or r["conf"] != "h"]
        import random
        random.Random(seed).shuffle(pick)
        sheet(pick[:40], out)
        print("sheet:", out, len(pick), "affected or not-high of", len(res))
    return res


def cmd_run():
    rows = corpus_rows()
    only = arg("--src")
    if only:
        rows = [x for x in rows if x["src"] == only]
    done = load_crops()
    todo = [x for x in rows if x["id"] not in done and img_path(x).exists()]
    print(f"crops: {len(done)} cached, {len(todo)} to compute", flush=True)
    t0 = time.time()
    n_err = 0
    with CROP_CACHE.open("a") as f:
        for i, x in enumerate(todo):
            r = _job(x)
            if r is None:
                continue
            if "error" in r:
                n_err += 1
                continue
            f.write(json.dumps(r) + "\n")
            if i % 2000 == 0:
                f.flush()
                print(f"  {i}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)
    print(f"done: {len(todo)} in {time.time() - t0:.0f}s, {n_err} errors")


def cmd_report():
    rows = corpus_rows()
    byid = {x["id"]: x for x in rows}
    res = [r for r in load_crops().values() if r["key"] in byid]
    print(summarize(res, byid))


def cmd_sheet():
    rows = corpus_rows()
    byid = {x["id"]: x for x in rows}
    crops = load_crops()
    n = arg("--n", 40, int)
    import random
    rng = random.Random(arg("--seed", 11, int))
    only = arg("--src")
    aff = [r for r in crops.values() if r["key"] in byid and affected(r) and (not only or byid[r["key"]]["src"] == only)]
    rng.shuffle(aff)
    # a mix: half high, half medium or low, so the sheet shows both the clean crops and the doubtful ones
    hi = [r for r in aff if r["conf"] == "h"][:n // 2]
    lo = [r for r in aff if r["conf"] != "h"][:n - len(hi)]
    pick = hi + lo
    rng.shuffle(pick)
    sheet([(byid[r["key"]], r) for r in pick], arg("--out", str(RAW / "crops-sheet.png")))


def _pal_job(args):
    import corpus as C
    key, path, box, cf = args
    try:
        res = C.palette_of(path, box)
        res["cf"] = cf
        res["key"] = key
        return res
    except Exception as e:
        return dict(key=key, error=str(e))


def cmd_apply():
    """Recompute the 6-color palettes of every cropped image (corpus-palettes.jsonl, newest line wins), then patch
    data/corpus/*.json in place: crop, cf, p, L, C. Rows with no crop are left exactly as they were."""
    sys.path.insert(0, str(ROOT / "tools"))
    import corpus as C
    crops = C.wanted_crops()
    pals = C.load_palettes()
    rows_by_file = {f: json.loads(f.read_text()) for f in sorted((ROOT / "data" / "corpus").glob("*.json"))}
    jobs = []
    for rows in rows_by_file.values():
        for x in rows:
            want, cf = crops.get(x["id"]) or (None, None)
            have = pals.get(x["id"], {})
            if img_path(x).exists() and (have.get("crop") or None) != want:
                jobs.append((x["id"], str(img_path(x)), want, cf))
    print(f"palettes to recompute: {len(jobs)}", flush=True)
    if jobs:
        from multiprocessing import Pool
        with Pool(4) as pool, C.PAL_CACHE.open("a") as f:
            for res in pool.imap_unordered(_pal_job, jobs, chunksize=8):
                if "error" in res:
                    print("  palette failed", res["key"], res["error"])
                    continue
                f.write(json.dumps(res) + "\n")
        pals = C.load_palettes()
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    n_crop = n_pal = 0
    for f, rows in rows_by_file.items():
        out = []
        for x in rows:
            want, cf = crops.get(x["id"]) or (None, None)
            p = pals.get(x["id"])
            new = {}
            for k, v in x.items():
                if k in ("crop", "cf"):
                    continue
                new[k] = v
                if k == "C" and want:
                    new["crop"] = want
                    if cf:
                        new["cf"] = cf
            if (want or x.get("crop")) and p and (p.get("crop") or None) == want:   # untouched rows stay byte-identical
                rgbs = C.lab_to_rgb(np.array(p["lab"]))
                exact = C.rgb_to_lab(rgbs)
                V = C.de2000(exact, app_lab).argmin(1)
                Ls, Cs, Hs = C.lch(exact)
                shares = [round(s, 3) for s in p["share"]]
                shares[0] = round(shares[0] + 1 - sum(shares), 3)
                pnew = [[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))]
                if want and (pnew != x["p"]):
                    n_pal += 1
                new["p"] = pnew
                new["L"], new["C"] = round(p["L"], 1), round(p["C"], 1)
            n_crop += bool(want)
            out.append(new)
        f.write_text("[\n" + ",\n".join(line(r) for r in out) + "\n]\n")
    print(f"patched {len(rows_by_file)} shards: {n_crop} rows with a crop, {n_pal} palettes changed")


def stats_rows():
    """The rows data/stats.js is computed from: the committed corpus shards (not the separate Sargent shard, which the
    statistics never included), each with what compute_stats() needs (span, Lab of its palette, shares). `span` (how loosely
    a work is dated) is not stored in the shards: it comes from corpus.build_rows() by id."""
    sys.path.insert(0, str(ROOT / "tools"))
    import corpus as C
    if not hasattr(np, "bitwise_count"):   # corpus.dedupe() wants numpy 2; this shim is a popcount through a byte table
        tbl = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)
        np.bitwise_count = lambda a: tbl[np.ascontiguousarray(a).view(np.uint8)].reshape(a.shape + (8,)).sum(-1).astype(np.uint8)
    span = {r["id"]: r.get("span") for r in C.build_rows()[0]}
    rows = []
    for f in sorted((ROOT / "data" / "corpus").glob("*.json")):
        if "sargent" in f.name:
            continue
        for x in json.loads(f.read_text()):
            x["span"] = span.get(x["id"])
            x["_lab"] = C.rgb_to_lab(np.array([C.hex_to_rgb(p[0]) for p in x["p"]]))
            x["_share"] = np.array([p[1] for p in x["p"]])
            rows.append(x)
    return rows


def cmd_stats():
    """Recompute data/stats.js from the shard rows (after `apply`). --json PATH writes a summary instead, for comparisons."""
    sys.path.insert(0, str(ROOT / "tools"))
    import corpus as C
    rows = stats_rows()
    app = C.app_names()
    stats = C.compute_stats(rows, app)
    finds = C.findings(rows, stats)
    dest = arg("--json")
    if dest:
        ov = stats["overall"]
        by = {}
        for r in rows:
            d = by.setdefault(r["src"], dict(n=0, black=0.0, umber=0.0, L=0.0, browns=0.0, neutrals=0.0, golds=0.0, crop=0))
            d["n"] += 1
            d["L"] += r["L"]
            d["crop"] += bool(r.get("crop"))
            for h, s, v, f in r["p"]:
                d["black"] += s * (v == "Black")
                d["umber"] += s * (v == "Umber")
                d["browns"] += s * (f == "Browns")
                d["neutrals"] += s * (f == "Neutrals")
                d["golds"] += s * (f in ("Oranges", "Yellows"))
        res = dict(n=len(rows), fam=ov["fam"], top=[(t["vocab"], t["share"]) for t in ov["top"][:12]], L=ov["L"], C=ov["C"],
                   artists=len(stats["byArtist"]), findings=[f.get("numbers") for f in finds],
                   by_src={s: {k: (round(v / d["n"], 4) if k not in ("n", "crop") else v) for k, v in d.items()} for s, d in by.items()})
        Path(dest).write_text(json.dumps(res, indent=1, default=str))
        print("wrote", dest)
        return
    C.write_outputs(rows, stats, finds, {s: C.load_meta(s)["fetched"] for s in C.SRC}, write_rows=False)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "measure"
    {"measure": cmd_measure, "run": cmd_run, "report": cmd_report, "sheet": cmd_sheet, "apply": cmd_apply,
     "stats": cmd_stats}[cmd]()


if __name__ == "__main__":
    main()
