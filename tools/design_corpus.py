#!/usr/bin/env python3
"""ColorHub design-history color corpus: posters, textiles, wallpaper, ceramics, glass, furniture, graphic design,
product design, costume and stamps, 1800-1979. Built like the painting corpus (tools/corpus.py, which this imports for
its network, image, k-means and color math), re-runnable and resumable; everything caches in research/_raw/ (gitignored).
Feasibility, sources and licenses: research/DESIGN-HISTORY.md.

  python3 tools/design_corpus.py meta [src ...] [--resume]   # 1. object metadata -> research/_raw/<src>/meta.json
  python3 tools/design_corpus.py select                      # 2. balanced pick across category x decade -> research/_raw/design-selected.json
  python3 tools/design_corpus.py images [src ...]            # 3. one 200 px image per selected object (cached, skipped if present)
  python3 tools/design_corpus.py palettes                    # 4. 6-color k-means palette per cached image -> research/_raw/design-palettes.jsonl
  python3 tools/design_corpus.py build                       # 5. name the colors, write data/design/objects-<cat>.json
  python3 tools/design_corpus.py status                      # what is cached, per source
  python3 tools/design_corpus.py sheet [N] [out.png] [seed]  # contact sheet: image | palette | names
Then: python3 tools/analyze_design.py   (per-color, per-category-x-decade stats, superlatives -> data/design/)

Sources (src codes): chndm Cooper Hewitt, rijksd Rijksmuseum design sets, aicd Art Institute of Chicago design
departments, cmad Cleveland decorative arts, commonsd Wikimedia Commons posters and stamps by year, npmd National
Postal Museum stamps, metd the Met (1900-1979 costume, textiles, ephemera). One adapter each in tools/museums/ (its docstring says route, filters, image size, pace).

Selection (select()): objects dated 1800-1979 with a design category; per category x decade cell at most CELL_CAP
objects, at most SRC_CELL_CAP from one source, and one maker/designer at most MAKER_CAP per category, chosen in a
seeded shuffle. So a prolific designer or a big museum cannot outweigh a decade.

Palette (step 4): as tools/corpus.py palette_of() (auto-trim of frames and scanner bed, 2% inset, ~120 px area average,
CIELAB k-means k=6 with a*/b* x1.5, share = pixel area), plus for objects photographed on a studio backdrop (ceramics,
glass, furniture, product, costume, stamps) a flood-fill of the backdrop color from the picture edge, so a white vase on white
paper is read as its glaze and not as 80% white.

Honest limits: every color is "as photographed" (studio light, fading, scanner; some of these are 150-year-old dyes).
Needs Python 3 with Pillow and numpy only.
"""
import io, json, math, random, re, sys, threading, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
from museums import chndm, rijksd, aicd, cmad, commonsd, npmd, metd  # noqa: E402

RAW = C.RAW
_download = C.download


def _download_retry(src, url, path, chunk=1 << 20, tries=6):
    """Large bulk files by curl (Python 3.9's TLS drops S3 connections now and then), with retries."""
    import subprocess
    for i in range(tries):
        r = subprocess.run(["curl", "-s", "-f", "-L", "-m", "300", "-A", C.UA, "-o", str(path) + ".part", url])
        if r.returncode == 0:
            Path(str(path) + ".part").replace(path)
            return
        print(f"   {src} download failed (curl {r.returncode}); retry in {5 * (i + 1)}s", flush=True)
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"could not download {url}")


C.download = _download_retry
OUT = ROOT / "data" / "design"
SEL = RAW / "design-selected.json"
PAL = RAW / "design-palettes.jsonl"
ADAPTERS = dict(chndm=chndm, rijksd=rijksd, aicd=aicd, cmad=cmad, commonsd=commonsd, npmd=npmd, metd=metd)
for _s, _m in ADAPTERS.items():
    C.ADAPTERS[_s] = _m
    C.SRC[_s] = dict(dir=RAW / _s, **_m.INFO)

CATS = ["poster", "graphic", "textile", "wallpaper", "ceramics", "glass", "furniture", "product", "costume", "stamps"]
CAT_NAME = {"poster": "Posters and advertisements", "graphic": "Graphic design and print", "textile": "Textiles", "wallpaper": "Wallpaper",
            "ceramics": "Ceramics and tiles", "glass": "Glass", "furniture": "Furniture and lighting",
            "product": "Product and industrial design", "costume": "Costume, fashion and jewelry", "stamps": "Postage stamps"}
OBJECT_CATS = {"ceramics", "glass", "furniture", "product", "costume"}   # photographed as 3-D objects on a backdrop
YEAR_MIN, YEAR_MAX = 1800, 1979
CELL_CAP, SRC_CELL_CAP, MAKER_CAP = 180, 60, 20
CAT_SRC_CAP = {("commonsd", "stamps"): 50}   # Commons has thousands of stamps; the Postal Museum already covers them
SRC_CAP = {"commonsd": 120, "rijksd": 100, "npmd": 80}   # the sources for 1900-1979 and for commercial work get a larger share


def decade(y):
    return y // 10 * 10


# ---------------------------------------------------------------------------------------------
# 1. metadata (delegated to the adapters)
# ---------------------------------------------------------------------------------------------
def cmd_meta(srcs, resume):
    for s in srcs:
        print(f"--- {s}: {ADAPTERS[s].INFO['name']}", flush=True)
        ADAPTERS[s].meta(C, resume)


def norm_rows(src):
    p = C.SRC[src]["dir"] / "meta.json"
    if not p.exists():
        return []
    out = []
    for x in json.loads(p.read_text())["rows"]:
        try:
            r = ADAPTERS[src].norm(C, x)
        except Exception as e:  # a malformed record is skipped, never fatal
            print(f"   {src}: skipped a record ({e})")
            continue
        if r.get("y") is None or not (YEAR_MIN <= r["y"] <= YEAR_MAX) or r.get("cat") not in CATS or not r.get("img"):
            continue
        r["id"] = re.sub(r"[^\w.\-]+", "_", r["id"])   # safe as a file name
        r["urls"] = ADAPTERS[src].image_urls(x)
        out.append(r)
    return out


# ---------------------------------------------------------------------------------------------
# 2. selection
# ---------------------------------------------------------------------------------------------
def cmd_select(srcs=None):
    """Per source: objects in a fixed hash order, at most SRC_CELL_CAP per category x decade cell and MAKER_CAP per
    maker per category. Then every cell is trimmed to CELL_CAP by dropping, one at a time, from the source that has
    the most objects in that cell. A source's picks never depend on the other sources (so its images can be fetched
    before the others' metadata is finished); the trimming only removes some of them."""
    import hashlib
    h = lambda r: hashlib.md5(r["id"].encode()).hexdigest()
    per = {}
    for s in (srcs or ADAPTERS):
        rows = sorted(norm_rows(s), key=h)
        print(f"select: {s}: {len(rows)} dated design objects 1800-1979", flush=True)
        cells, makers, keep = Counter(), Counter(), []
        for r in rows:
            cell = (r["cat"], decade(r["y"]))
            mk = (r["cat"], (r["a"] or "").lower())
            if cells[cell] >= CAT_SRC_CAP.get((s, r["cat"]), SRC_CAP.get(s, SRC_CELL_CAP)) or (r["a"] and makers[mk] >= MAKER_CAP):
                continue
            cells[cell] += 1
            if r["a"]:
                makers[mk] += 1
            keep.append(r)
        per[s] = keep
    by_cell = defaultdict(lambda: defaultdict(list))
    for s, rows in per.items():
        for r in rows:
            by_cell[(r["cat"], decade(r["y"]))][s].append(r)
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
    print(f"select: {len(picked)} objects picked", flush=True)
    show_matrix(picked)


def show_matrix(rows):
    cells = Counter((r["cat"], decade(r["y"])) for r in rows)
    decs = list(range(YEAR_MIN, YEAR_MAX, 10))
    print("cat        " + " ".join(f"{d % 1000:>4}" for d in decs) + "  total")
    for c in CATS:
        print(f"{c:<10} " + " ".join(f"{cells[(c, d)]:>4}" for d in decs) + f"  {sum(cells[(c, d)] for d in decs)}")
    print("by source:", dict(Counter(r["src"] for r in rows)))


# ---------------------------------------------------------------------------------------------
# 3. images
# ---------------------------------------------------------------------------------------------
def img_path(src, nid):
    return C.SRC[src]["dir"] / "img" / f"{nid}.jpg"


def cmd_images(srcs):
    sel = json.loads(SEL.read_text())
    srcs = srcs or list(ADAPTERS)
    for s in srcs:
        rows = [r for r in sel if r["src"] == s]
        (C.SRC[s]["dir"] / "img").mkdir(parents=True, exist_ok=True)
        todo = [r for r in rows if not img_path(s, r["id"]).exists()]
        print(f"{s}: {len(rows)} selected, {len(todo)} images to fetch", flush=True)
        failed, lock, done, t0 = {}, threading.Lock(), [0], time.time()
        fp = C.SRC[s]["dir"] / "failed.json"

        def one(r):
            err = "no url"
            for url in r["urls"]:
                try:
                    im = Image.open(io.BytesIO(C.fetch(s, url, binary=True, headers={"AIC-User-Agent": C.UA} if s == "aicd" else None))).convert("RGB")
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
                    fp.write_text(json.dumps(failed, indent=0))
                if done[0] % 200 == 1:
                    print(f"{s} images {done[0]}/{len(todo)} {(time.time() - t0) / 60:.1f} min, {len(failed)} failed", flush=True)

        with ThreadPoolExecutor(C.SRC[s].get("workers", 1)) as ex:
            list(ex.map(one, todo))
        print(f"{s}: images done, {len(failed)} failed", flush=True)


# ---------------------------------------------------------------------------------------------
# 4. palettes
# ---------------------------------------------------------------------------------------------
def object_mask(X, h, w, tol=22.0, ring_min=0.3, lo=2.0, hi=0.92):
    """Studio backdrop of a photographed object: pixels connected to the picture edge whose Lab color is within
    `tol` (dE76) of the median edge color, when at least `ring_min` of the edge ring matches it. Unlike
    corpus.backdrop_mask this accepts a tinted or graded backdrop (cream paper, grey sweep); a painted ground that
    is not near-uniform fails the ring test and is kept. Returns a flat boolean mask (True = backdrop) or None."""
    Lab = X.reshape(h, w, 3)
    ring = np.concatenate([Lab[0], Lab[-1], Lab[1:-1, 0], Lab[1:-1, -1]])
    med = np.median(ring, 0)
    dring = np.sqrt(((ring - med) ** 2).sum(-1))
    if (dring < tol).mean() < ring_min:
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
    if frac < lo / 100 or frac > hi:
        return None
    return reach.reshape(-1)


def palette_of(path, cat):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float64)
    l, t, r, b = C.autotrim(a)
    h, w = a.shape[:2]
    il, it = round((w - l - r) * 0.02), round((h - t - b) * 0.02)
    box = (l + il, t + it, w - r - il, h - b - it)
    if box[2] - box[0] < 20 or box[3] - box[1] < 8:
        box = (0, 0, w, h)
    im = im.crop(box)
    s = C.K_SIDE / max(im.size)
    if s < 1:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BOX)
    X = C.rgb_to_lab(np.asarray(im, dtype=np.float64).reshape(-1, 3))
    bg = C.backdrop_mask(X, im.height, im.width)
    if bg is None and (cat in OBJECT_CATS or cat == "stamps"):   # stamps sit on a black or grey photo backdrop
        bg = object_mask(X, im.height, im.width)
    if bg is not None:
        X = X[~bg]
    if len(X) < 30:
        X = C.rgb_to_lab(np.asarray(im, dtype=np.float64).reshape(-1, 3))
        bg = None
    lab = C.kmeans(X * np.array([1, C.CHROMA_W, C.CHROMA_W]), C.K)
    counts = np.bincount(lab, minlength=C.K)
    order = [j for j in np.argsort(-counts) if counts[j] > 0]
    cent = np.array([X[lab == j].mean(0) for j in order])
    shares = counts[order] / counts.sum()
    Lp, Cp, _ = C.lch(X)
    return dict(lab=np.round(cent, 2).tolist(), share=np.round(shares, 4).tolist(), L=round(float(Lp.mean()), 2),
                C=round(float(Cp.mean()), 2), bg=round(float(bg.mean()), 3) if bg is not None else 0)


def _job(args):
    nid, path, cat = args
    try:
        return nid, palette_of(path, cat), None
    except Exception as e:
        return nid, None, str(e)


def cmd_palettes(workers=3):
    done = {r["key"] for r in C.jsonl_read(PAL)} if hasattr(C, "jsonl_read") else set()
    if not done and PAL.exists():
        done = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()}
    sel = json.loads(SEL.read_text())
    jobs = [(r["id"], str(img_path(r["src"], r["id"])), r["cat"]) for r in sel
            if r["id"] not in done and img_path(r["src"], r["id"]).exists()]
    print(f"palettes: {len(done)} cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    t0 = time.time()
    with Pool(workers) as pool, PAL.open("a") as f:
        for i, (nid, res, err) in enumerate(pool.imap_unordered(_job, jobs, chunksize=8)):
            if err:
                print(f"   {nid}: {err}", flush=True)
                continue
            res["key"] = nid
            f.write(json.dumps(res) + "\n")
            if i % 250 == 0:
                f.flush()
                print(f"palettes {i + 1}/{len(jobs)} {time.time() - t0:.0f}s", flush=True)


# ---------------------------------------------------------------------------------------------
# 5. naming and the object shards
# ---------------------------------------------------------------------------------------------
_core = {}


def core():
    """The app's ~1,000 core names (data/core-names.json): name, hex, Lab. Naming = nearest by CIEDE2000."""
    if not _core:
        names = json.loads((ROOT / "data" / "core-names.json").read_text())
        _core["n"] = [c["n"] for c in names]
        _core["hex"] = [c["h"].upper() for c in names]
        _core["lab"] = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in _core["hex"]], dtype=np.float64))
    return _core


def name_labs(labs, chunk=1500):
    """Lab array (N,3) -> (core index array, dE2000 array)."""
    cl = core()["lab"]
    idx, de = [], []
    for i in range(0, len(labs), chunk):
        d = C.de2000(labs[i:i + chunk], cl)
        j = d.argmin(1)
        idx.append(j)
        de.append(d[np.arange(len(j)), j])
    return np.concatenate(idx), np.concatenate(de)


# how a row's img / url are stored: a template per source (index.json) and the part that varies per object
IMG_TPL = {"chndm": ("https://ids.si.edu/ids/deliveryService?id={}&max=300", r"id=([^&]+)&max=300$"),
           "npmd": ("https://ids.si.edu/ids/deliveryService?id={}&max=300", r"id=([^&]+)&max=300$"),
           "aicd": ("https://www.artic.edu/iiif/2/{}/full/400,/0/default.jpg", r"/iiif/2/([^/]+)/full/"),
           "rijksd": ("https://iiif.micr.io/{}/full/400,/0/default.jpg", r"iiif\.micr\.io/([^/]+)/full/"),
           "metd": ("https://images.metmuseum.org/CRDImages/{}", r"CRDImages/(.+)$")}
URL_TPL = {"chndm": ("https://collection.cooperhewitt.org/view/objects/asitem/id/{}", r"/id/(\d+)$"),
           "aicd": ("https://www.artic.edu/artworks/{}", r"/artworks/(\d+)$"),
           "rijksd": ("https://www.rijksmuseum.nl/en/collection/{}", r"/collection/([^/]+)$"),
           "cmad": ("https://www.clevelandart.org/art/{}", r"/art/([^/]+)$"),
           "metd": ("https://www.metmuseum.org/art/collection/search/{}", r"/search/(\d+)$")}


def compact(src, field, tpl, value):
    if not value:
        return None
    if src in tpl:
        m = re.search(tpl[src][1], value)
        if m:
            return m.group(1)
    return value


COM_RX = re.compile(r"advert|poster|label|packag|trade card|catalog|cover|billboard|\bsign\b|signage|brochure|logo|ephemera|"
                    r"wrapper|calendar|sheet music|magazine|broadside|handbill|placard|bandbox|trademark|stamp|"
                    r"playbill|program|menu|postcard|circular|prospectus|invoice|letterhead|bill ?head", re.I)
# Rights of the image shown through the source's own URL: every source here is CC0 or public domain, so a thumbnail is
# cleared. (Objects still under copyright would carry only their colors and a link: none is in the corpus yet.)
RIGHTS = dict(chndm="cc0", npmd="cc0", aicd="pd", cmad="cc0", metd="cc0", rijksd="pd", commonsd="pd")


def commercial(r):
    """Commercial design: advertising, posters, packaging and labels, covers, trade literature, stamps, and product /
    industrial design. A rule on the object's category, type and title, not a judgment of the object."""
    if r["cat"] in ("poster", "stamps", "product"):
        return True
    return r["cat"] == "graphic" and bool(COM_RX.search(f"{r.get('ty') or ''} {r.get('t') or ''}"))


def cmd_build():
    sel = json.loads(SEL.read_text())
    pals = {}
    for line in PAL.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            pals[r["key"]] = r
    rows = [r for r in sel if r["id"] in pals]
    # drop monochrome photographs (mean chroma exactly 0 in the image), as the painting corpus does
    mono = [r for r in rows if pals[r["id"]]["C"] < 0.6]
    rows = [r for r in rows if pals[r["id"]]["C"] >= 0.6]
    labs = np.array([lab for r in rows for lab in pals[r["id"]]["lab"]])
    ci, de = name_labs(labs)
    k, out = 0, []
    for r in rows:
        p = pals[r["id"]]
        n = len(p["lab"])
        cols = []
        for j in range(n):
            hexv = C.rgb_to_hex(C.lab_to_rgb(np.array(p["lab"][j])))
            cols.append([hexv, p["share"][j], int(ci[k + j])])
        k += n
        o = dict(id=r["id"], src=r["src"], t=r["t"], a=r["a"], y=r["y"], co=r.get("co"), cat=r["cat"], ty=r.get("ty"),
                 i=compact(r["src"], "img", IMG_TPL, r["img"]), u=compact(r["src"], "url", URL_TPL, r.get("url")),
                 p=cols, L=p["L"], C=p["C"])
        if commercial(r):
            o["cm"] = 1
        if r.get("lic"):
            o["lic"] = r["lic"]
        out.append(o)
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("objects-*.json"):
        f.unlink()
    by = defaultdict(list)
    for o in out:
        by[o["cat"]].append(o)
    sizes = {}
    for c, lst in by.items():
        lst.sort(key=lambda o: (o["y"], o["id"]))
        txt = json.dumps(lst, ensure_ascii=False, separators=(",", ":"))
        (OUT / f"objects-{c}.json").write_text(txt)
        sizes[c] = (len(lst), len(txt))
    print(f"build: {len(out)} objects ({len(mono)} monochrome photographs left out); core-name dE median "
          f"{float(np.median(de)):.1f}, 90th pct {float(np.percentile(de, 90)):.1f}")
    for c in CATS:
        if c in sizes:
            print(f"  data/design/objects-{c}.json: {sizes[c][0]} objects, {sizes[c][1] / 1e6:.2f} MB")
    show_matrix(out)


def cmd_status():
    sel = json.loads(SEL.read_text()) if SEL.exists() else []
    pal = {json.loads(l)["key"] for l in PAL.read_text().splitlines() if l.strip()} if PAL.exists() else set()
    for s in ADAPTERS:
        mp = C.SRC[s]["dir"] / "meta.json"
        n_meta = len(json.loads(mp.read_text())["rows"]) if mp.exists() else 0
        rows = [r for r in sel if r["src"] == s]
        imgs = sum(1 for r in rows if img_path(s, r["id"]).exists())
        print(f"{s:9} meta {n_meta:6}  selected {len(rows):6}  images {imgs:6}  palettes {sum(1 for r in rows if r['id'] in pal):6}")


def cmd_sheet(n=40, out="research/_raw/design-sheet.png", seed=1, src=None):
    sel = [r for r in json.loads(SEL.read_text()) if (not src or r["src"] == src)]
    pals = {}
    for line in PAL.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            pals[r["key"]] = r
    sel = [r for r in sel if r["id"] in pals]
    random.Random(seed).shuffle(sel)
    sel = sel[:n]
    cols = 4
    W, H = 330, 120
    sheet = Image.new("RGB", (W * cols, H * math.ceil(len(sel) / cols)), "white")
    d = ImageDraw.Draw(sheet)
    for k, r in enumerate(sel):
        x0, y0 = (k % cols) * W, (k // cols) * H
        im = Image.open(img_path(r["src"], r["id"])).convert("RGB")
        im.thumbnail((100, 110))
        sheet.paste(im, (x0 + 4, y0 + 4))
        p = pals[r["id"]]
        rgb = C.lab_to_rgb(np.array(p["lab"]))
        for j in range(len(rgb)):
            d.rectangle([x0 + 110, y0 + 4 + j * 15, x0 + 110 + max(6, int(p["share"][j] * 200)), y0 + 17 + j * 15],
                        fill=tuple(int(v) for v in rgb[j]))
        d.text((x0 + 110, y0 + 98), f"{r['cat']} {r['y']} {r['src']}", fill="black")
        d.text((x0 + 110, y0 + 108), (r["t"] or "")[:34], fill="gray")
    sheet.save(out)
    print("wrote", out)


def main():
    args = sys.argv[1:]
    resume = "--resume" in args
    args = [a for a in args if a != "--resume"]
    cmd, rest = (args[0] if args else "status"), args[1:]
    srcs = [a for a in rest if a in ADAPTERS]
    if cmd == "meta":
        cmd_meta(srcs or list(ADAPTERS), resume)
    elif cmd == "select":
        cmd_select(srcs or None)
    elif cmd == "images":
        cmd_images(srcs)
    elif cmd == "palettes":
        cmd_palettes()
    elif cmd == "build":
        cmd_build()
    elif cmd == "status":
        cmd_status()
    elif cmd == "sheet":
        cmd_sheet(int(rest[0]) if rest else 40, rest[1] if len(rest) > 1 else "research/_raw/design-sheet.png",
                  int(rest[2]) if len(rest) > 2 else 1, rest[3] if len(rest) > 3 else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
